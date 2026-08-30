import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { QueryClient, QueryObserver, focusManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { CHILD_REMOVAL_INVALIDATE_KEYS } from "../children/child-deletion";
import { CHILD_SCOPED_QUERY_KEY_PREFIXES } from "../children/child-switch";
import { HOUSEHOLD_JOIN_INVALIDATE_KEYS } from "../children/household-join";
import {
  CHILDREN_WRITE_APIS,
  CHILDREN_WRITE_APIS_EXCLUDED,
  CHILDREN_WRITE_LEDGER,
  EXPENSE_WRITE_APIS,
  EXPENSE_WRITE_APIS_EXCLUDED,
  EXPENSE_WRITE_LEDGER,
  INVALIDATION_ONLY_KEYS,
  LONG_SHARED_STALE_TIME_MS,
  NON_LITERAL_QUERY_KEY_SITES,
  SHARED_CACHE_POLICIES,
  SHARED_KEY_COVERAGE
} from "./shared-cache-policy";

/**
 * 라운드 83 트랙 D(GAP-083 #3) — 공유 캐시 신선도 정책의 계약 다섯.
 *
 * ⓐ 선행 재현(react-query 실물) · ⓑ 정책 대장(두 방향) · ⓒ 무효화 대장(두 방향) ·
 * ⓓ 정책 원천 단일 · ⓔ 바이트 불변.
 *
 * ⓑ·ⓒ는 **저장소를 스스로 훑어 모집단을 센다** — 자리 수를 손으로 적으면 그 수가 낡는 날
 * 계약이 초록인 채로 거짓이 된다(known-limitations V-3이 말한 그 차이).
 */

const MOBILE_ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** 저장소 루트 기준 상대경로(대장에 적는 형식과 같다). */
function relative(file: string): string {
  return file.slice(MOBILE_ROOT.length + 1).split("\\").join("/");
}

function productionSources(): string[] {
  return [...walk(join(MOBILE_ROOT, "app")), ...walk(join(MOBILE_ROOT, "src"))];
}

/** 주석 줄(한 줄 주석·블록 주석 본문)은 소스가 아니다 — 주석에 적힌 예시가 모집단을 늘리면 안 된다. */
function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

/** `30_000` · `5 * 60 * 1000` 같은 상수식만 읽는다(변수가 섞이면 null). */
function parseDurationLiteral(expression: string): number | null {
  const cleaned = expression.replace(/_/g, "").trim();
  if (!/^[\d\s*]+$/.test(cleaned)) return null;
  return cleaned
    .split("*")
    .map((part) => Number(part.trim()))
    .reduce((product, value) => product * value, 1);
}

type QuerySite = {
  file: string;
  keyHead: string;
  line: number;
  /** 그 useQuery 옵션 객체에 인라인으로 적힌 staleTime(밀리초). 없으면 null. */
  inlineStaleTimeMs: number | null;
  inlineStaleTimeText: string | null;
};

/**
 * `queryKey: ["…"` 선언 전수와, 그 선언이 속한 옵션 객체의 인라인 `staleTime`.
 *
 * 옵션 객체의 범위는 중괄호 깊이로 잡는다(queryKey 줄에서 깊이 1로 시작해 0이 되면 끝).
 * 주석 줄은 세지 않는다.
 */
function collectQuerySites(): QuerySite[] {
  const sites: QuerySite[] = [];
  for (const file of productionSources()) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (isCommentLine(lines[i])) continue;
      const head = lines[i].trim().match(/^queryKey:\s*\["([a-z-]+)"/);
      if (!head) continue;
      let depth = 1;
      let inlineStaleTimeText: string | null = null;
      for (let j = i + 1; j < lines.length && depth > 0; j += 1) {
        if (isCommentLine(lines[j])) continue;
        const stale = lines[j].trim().match(/^staleTime:\s*(.+?),?\s*$/);
        if (stale && depth === 1) inlineStaleTimeText = stale[1];
        depth += (lines[j].match(/\{/g)?.length ?? 0) - (lines[j].match(/\}/g)?.length ?? 0);
      }
      sites.push({
        file: relative(file),
        keyHead: head[1],
        line: i + 1,
        inlineStaleTimeText,
        inlineStaleTimeMs: inlineStaleTimeText ? parseDurationLiteral(inlineStaleTimeText) : null
      });
    }
  }
  return sites;
}

/** 둘 이상의 **서로 다른 파일**이 켜는 키의 첫 칸 전수. */
function sharedKeyHeads(sites: QuerySite[]): string[] {
  const filesByKey = new Map<string, Set<string>>();
  for (const site of sites) {
    if (!filesByKey.has(site.keyHead)) filesByKey.set(site.keyHead, new Set());
    filesByKey.get(site.keyHead)!.add(site.file);
  }
  return [...filesByKey.entries()]
    .filter(([, files]) => files.size >= 2)
    .map(([key]) => key)
    .sort();
}

afterEach(() => {
  // 재현 테스트가 만진 전역 포커스 상태를 원래대로(다른 스위트에 새지 않게).
  focusManager.setFocused(undefined);
});

describe("ⓐ 선행 재현 — 한 키에 staleTime이 다른 관찰자 둘이 붙으면 짧은 쪽이 실효 주기를 정한다", () => {
  /**
   * ⚠️ 정찰(round83-scout.md 후보 3)은 이 문장을 **소스로만** 쟀다. 최소안 전체가 이 사실 위에
   * 서 있으므로 react-query 실물로 먼저 못 박는다. 결과: **가설대로다.**
   *
   * 앱과 같은 조건으로 세운다 — 전역 기본 30초, `client.mount()`(QueryClientProvider가 하는 일),
   * focusManager 포커스 전환(MOB-117이 AppState에 연결한 그 신호).
   */
  function appLikeClient() {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } });
    client.mount();
    return client;
  }

  /** 실시간을 기다리지 않고 캐시 항목만 31초 늙힌다(30초는 넘고 5분에는 못 미치는 나이). */
  function ageEntry(client: QueryClient, queryKey: string[], byMs: number) {
    const entry = client.getQueryCache().find({ queryKey })!;
    (entry.state as { dataUpdatedAt: number }).dataUpdatedAt = Date.now() - byMs;
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

  it("5분 관찰자 옆에 30초 관찰자가 서면, 31초 뒤 포커스에서 공유 항목이 재조회된다", async () => {
    const client = appLikeClient();
    let fetches = 0;
    const queryFn = async () => {
      fetches += 1;
      return fetches;
    };
    const long = new QueryObserver(client, { queryKey: ["k"], queryFn, staleTime: LONG_SHARED_STALE_TIME_MS });
    const short = new QueryObserver(client, { queryKey: ["k"], queryFn });
    const unsubscribeLong = long.subscribe(() => {});
    const unsubscribeShort = short.subscribe(() => {});
    await settle();
    expect(fetches, "두 관찰자가 같은 항목을 공유하므로 최초 조회는 한 번").toBe(1);

    ageEntry(client, ["k"], 31_000);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await settle();

    // 5분을 적어 둔 관찰자는 아무것도 요청하지 않았는데도 데이터가 갈렸다.
    expect(fetches, "짧은 쪽(30초)이 실효 주기를 정한다").toBe(2);
    expect(long.getCurrentResult().data, "긴 쪽도 새 응답을 함께 받는다").toBe(2);

    unsubscribeShort();
    unsubscribeLong();
    client.unmount();
    client.clear();
  });

  it("대조 — 5분 관찰자만 있으면 같은 31초에서 재조회가 0건이다", async () => {
    const client = appLikeClient();
    let fetches = 0;
    const long = new QueryObserver(client, {
      queryKey: ["j"],
      queryFn: async () => {
        fetches += 1;
        return fetches;
      },
      staleTime: LONG_SHARED_STALE_TIME_MS
    });
    const unsubscribe = long.subscribe(() => {});
    await settle();
    ageEntry(client, ["j"], 31_000);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await settle();

    expect(fetches, "위 테스트의 재조회는 짧은 관찰자가 만든 것이다").toBe(1);

    unsubscribe();
    client.unmount();
    client.clear();
  });

  it("키별 기본(setQueryDefaults)은 인라인 staleTime이 없는 관찰자에게 그대로 닿고, 접두사 부분 일치로 [key, id]까지 덮는다", async () => {
    const client = appLikeClient();
    client.setQueryDefaults(["children"], { staleTime: LONG_SHARED_STALE_TIME_MS });
    // ⚠️ 아래 ["household-members"] 등록은 **react-query의 접두사 규칙을 재는 자리**이지 오늘의
    // 정책이 아니다 — 그 키는 리뷰 M-3 뒤로 전역 30초(staleTimeMs: null)라 등록되지 않는다.
    // `[key, id]` 꼴을 한 칸 접두사가 덮는다는 사실 자체는 표가 기대는 규칙이므로 계속 잰다.
    client.setQueryDefaults(["household-members"], { staleTime: LONG_SHARED_STALE_TIME_MS });

    expect(client.getQueryDefaults(["household-members", "household-1"])).toEqual({
      staleTime: LONG_SHARED_STALE_TIME_MS
    });

    let fetches = 0;
    const observer = new QueryObserver(client, {
      queryKey: ["children"],
      queryFn: async () => {
        fetches += 1;
        return fetches;
      }
    });
    const unsubscribe = observer.subscribe(() => {});
    await settle();
    ageEntry(client, ["children"], 31_000);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await settle();

    expect(fetches, "인라인 선언이 없어도 키 기본 5분이 적용돼 31초에는 재조회하지 않는다").toBe(1);

    unsubscribe();
    client.unmount();
    client.clear();
  });
});

describe("ⓑ 정책 대장 (두 방향)", () => {
  it("둘 이상의 소스가 켜는 키 전수가 대장에 있고, 대장에 낡은 줄이 없다", () => {
    const shared = sharedKeyHeads(collectQuerySites());
    const ledger = SHARED_CACHE_POLICIES.map((policy) => policy.queryKeyPrefix[0]).sort();

    // 방향 1: 공유 키인데 대장에 없으면 빨강(둘째 소비처가 생긴 키를 아무도 안 본다).
    expect(shared.filter((key) => !ledger.includes(key)), "정책 대장에 없는 공유 키").toEqual([]);
    // 방향 2: 대장에 있는데 더는 공유 키가 아니면 빨강(낡은 줄).
    expect(ledger.filter((key) => !shared.includes(key)), "더는 공유 키가 아닌 대장의 줄").toEqual([]);
  });

  it("모든 정책 줄에 이유가 적혀 있고, 접두사는 한 칸이다", () => {
    for (const policy of SHARED_CACHE_POLICIES) {
      expect(policy.queryKeyPrefix, `${policy.queryKeyPrefix[0]} 접두사`).toHaveLength(1);
      expect(policy.why.length, `${policy.queryKeyPrefix[0]} 이유`).toBeGreaterThan(40);
      if (policy.staleTimeMs !== null) {
        expect(policy.staleTimeMs, `${policy.queryKeyPrefix[0]} 값`).toBeGreaterThan(30_000);
      }
    }
  });

  it("공유 키를 켜는 화면의 인라인 staleTime이 키 기본과 같거나 없다", () => {
    const sites = collectQuerySites();
    const shared = new Set(sharedKeyHeads(sites));
    const policyByKey = new Map(SHARED_CACHE_POLICIES.map((policy) => [policy.queryKeyPrefix[0], policy]));

    const divergent: string[] = [];
    for (const site of sites) {
      if (!shared.has(site.keyHead)) continue;
      if (site.inlineStaleTimeText === null) continue; // 선언 없음 = 키 기본을 그대로 받는다.
      const expected = policyByKey.get(site.keyHead)!.staleTimeMs;
      // 상수식이 아니면(변수·조건식) 값을 확인할 수 없으므로 그것 자체를 어긋남으로 본다.
      if (site.inlineStaleTimeMs === null || site.inlineStaleTimeMs !== expected) {
        divergent.push(
          `${site.file}:${site.line} ["${site.keyHead}"] staleTime=${site.inlineStaleTimeText} (키 기본=${expected})`
        );
      }
    }
    expect(
      divergent,
      "화면이 키 기본과 다른 staleTime을 적었다 — 값을 맞추거나 이유와 함께 shared-cache-policy.ts에 등재할 것"
    ).toEqual([]);
  });

  it("`5 * 60 * 1000`을 적은 자리가 실재하고 그 값이 대장의 값과 같다(값이 조용히 갈리지 않는다)", () => {
    const sites = collectQuerySites().filter((site) => site.inlineStaleTimeMs !== null);
    expect(sites.length, "인라인 staleTime 자리").toBeGreaterThanOrEqual(7);
    for (const site of sites) {
      expect([LONG_SHARED_STALE_TIME_MS, 30_000], `${site.file}:${site.line}`).toContain(site.inlineStaleTimeMs);
    }
  });
});

describe("ⓒ 무효화 대장 (두 방향)", () => {
  /** `["children"]` 목록을 바꾸는 API를 실제로 부르는 소스 전수. */
  function childrenWriteSites(): string[] {
    const found = new Set<string>();
    const pattern = new RegExp(`\\b(${CHILDREN_WRITE_APIS.join("|")})\\s*\\(`);
    for (const file of productionSources()) {
      const rel = relative(file);
      // src/api/**: 이 이름들을 **정의**하고 로컬 백엔드로 분기하는 자리라 호출부가 아니다.
      // src/query/**: 이 대장 자신(이름을 문자열로 들고 있다).
      if (rel.startsWith("src/api/") || rel.startsWith("src/query/")) continue;
      const hit = readFileSync(file, "utf8")
        .split("\n")
        .some((line) => !isCommentLine(line) && pattern.test(line));
      if (hit) found.add(rel);
    }
    return [...found].sort();
  }

  it("쓰기 경로 전수가 대장에 있고, 대장에 적힌 경로가 실재한다", () => {
    const actual = childrenWriteSites();
    const ledger = [...new Set(CHILDREN_WRITE_LEDGER.map((row) => row.writeSite))].sort();

    // 방향 1: 소스에 있는데 대장에 없으면 빨강 — 무효화를 잊은 새 쓰기 경로가 이 줄에 걸린다.
    expect(actual.filter((file) => !ledger.includes(file)), "대장에 없는 [children] 쓰기 경로").toEqual([]);
    // 방향 2: 대장에 있는데 소스에 없으면 빨강(낡은 줄).
    expect(ledger.filter((file) => !actual.includes(file)), "실재하지 않는 대장의 경로").toEqual([]);
  });

  /**
   * 한 뮤테이션의 구간 — `const <name> = useMutation(`부터 **다음 useMutation 선언**(또는 파일 끝)까지.
   *
   * ⚠️ 라운드 83 리뷰 M-5: 종전 이 검사는 **파일 전체**를 봤다. 그래서 형제 뮤테이션이 적어 둔
   * 무효화 한 줄이 같은 파일의 **다른** 뮤테이션까지 초록으로 만들었다(app/settings/children.tsx의
   * 세 줄이 정확히 그 모양이다 — 셋 다 같은 문자열을 대장에 적고 있었고, 그 문자열은 셋 중 어느
   * 뮤테이션에도 직접 적혀 있지 않다). 구간으로 자르면 그 창이 닫힌다.
   */
  function mutationSlice(source: string, mutation: string): string {
    const marker = `const ${mutation} = useMutation(`;
    const start = source.indexOf(marker);
    expect(start, `${mutation} 뮤테이션 선언이 없다`).toBeGreaterThan(-1);
    const next = source.indexOf("= useMutation(", start + marker.length);
    // 다음 선언의 `const`부터가 다음 구간이다 — 그 앞줄까지가 이 뮤테이션의 몸통(실재 가드 포함).
    const end = next === -1 ? source.length : source.lastIndexOf("const ", next);
    return source.slice(start, end === -1 ? source.length : end);
  }

  it("대장의 모든 쓰기 경로가 성공 뒤 명시 무효화를 갖는다 (뮤테이션 구간 단위)", () => {
    const keySets: Record<string, ReadonlyArray<ReadonlyArray<string>>> = {
      CHILD_REMOVAL_INVALIDATE_KEYS,
      HOUSEHOLD_JOIN_INVALIDATE_KEYS
    };

    for (const row of CHILDREN_WRITE_LEDGER) {
      const writeSource = readFileSync(join(MOBILE_ROOT, row.writeSite), "utf8");
      for (const api of row.apis) {
        expect(writeSource, `${row.writeSite} 가 ${api} 를 부르지 않는다(대장이 낡았다)`).toMatch(
          new RegExp(`\\b${api}\\s*\\(`)
        );
      }

      const invalidationSource = readFileSync(join(MOBILE_ROOT, row.invalidatedIn), "utf8");
      const slice = mutationSlice(invalidationSource, row.mutation);

      if (row.via) {
        // 2단계 ①: 이 뮤테이션 구간이 실제로 그 헬퍼를 부른다.
        expect(slice, `${row.invalidatedIn} (${row.mutation}) 가 ${row.via} 를 부르지 않는다`).toMatch(
          new RegExp(`\\b${row.via}\\s*\\(`)
        );
        // 2단계 ②: 그 헬퍼 **정의**가 무효화를 담고 있다(이름만 맞고 속이 빈 헬퍼는 통과하지 못한다).
        const helperStart = invalidationSource.indexOf(`const ${row.via} = `);
        expect(helperStart, `${row.invalidatedIn} 에 ${row.via} 정의가 없다`).toBeGreaterThan(-1);
        const helperEnd = invalidationSource.indexOf("\n  };", helperStart);
        expect(helperEnd, `${row.via} 정의의 끝을 찾지 못했다`).toBeGreaterThan(helperStart);
        expect(
          invalidationSource.slice(helperStart, helperEnd),
          `${row.via} 정의에 명시 무효화가 없다`
        ).toContain(row.invalidation);
      } else {
        expect(slice, `${row.invalidatedIn} (${row.mutation}) 에 명시 무효화가 없다`).toContain(
          row.invalidation
        );
      }

      if (row.invalidation.includes('["children"]')) continue;
      // 키 집합 상수를 거치는 경로는 **그 상수의 실제 값**으로 확인한다(문자열만 보면 이름이
      // 맞고 내용이 빈 상수도 통과한다).
      const usedKeySet = Object.keys(keySets).find((name) => row.invalidation.includes(name));
      expect(usedKeySet, `${row.invalidatedIn} 의 무효화가 [children]도 아는 키 집합도 아니다`).toBeDefined();
      expect(
        keySets[usedKeySet!].some((key) => key.length === 1 && key[0] === "children"),
        `${usedKeySet} 가 ["children"]을 포함하지 않는다`
      ).toBe(true);
    }
  });

  it("via로 적힌 헬퍼가 실재하고, 직접 무효화하는 줄에는 via가 없다 (대장이 두 형식을 섞지 않는다)", () => {
    for (const row of CHILDREN_WRITE_LEDGER) {
      const source = readFileSync(join(MOBILE_ROOT, row.invalidatedIn), "utf8");
      const slice = mutationSlice(source, row.mutation);
      const direct = slice.includes(row.invalidation);
      if (row.via) {
        expect(direct, `${row.mutation} 는 구간 안에서 직접 무효화하므로 via 칸이 필요 없다`).toBe(false);
      } else {
        expect(direct, `${row.mutation} 는 via 없이 구간 안 직접 무효화여야 한다`).toBe(true);
      }
    }
  });

  it("온보딩의 아이 생성이 그 대장의 한 줄이다 (라운드 83 이전의 유일한 빨간 줄)", () => {
    const row = CHILDREN_WRITE_LEDGER.find((entry) => entry.invalidatedIn.includes("(onboarding)/child-profile"));
    expect(row, "온보딩 아이 생성이 대장에서 사라졌다").toBeDefined();
    const source = readFileSync(join(MOBILE_ROOT, row!.invalidatedIn), "utf8");
    const successStart = source.indexOf("onSuccess:");
    expect(successStart, "온보딩 저장 뮤테이션에 onSuccess 분기가 없다").toBeGreaterThan(-1);
    const successBranch = source.slice(successStart);
    // 무효화는 성공 분기 안에 있어야 하고, 이동보다 먼저 선다.
    const invalidateAt = successBranch.indexOf('invalidateQueries({ queryKey: ["children"] })');
    const navigateAt = successBranch.indexOf('router.push("/onboarding/prepared-items")');
    expect(invalidateAt, "성공 분기에 [children] 무효화가 없다").toBeGreaterThan(-1);
    expect(navigateAt).toBeGreaterThan(invalidateAt);
    // 저장 규칙은 무접촉이다 — 멱등키·동의 복구가 그대로 있는지 같은 자리에서 본다.
    expect(source).toContain("saveWithConsentRecovery(submitChild, () => upsertConsents(authToken!))");
    expect(source).toContain("getOrCreateChildCreateIdempotencyKey()");
    expect(source).toContain("clearChildCreateIdempotencyKey();");
  });

  it("모집단에서 뺀 이름은 이유와 함께 적혀 있고, 실제로 쓰기 API 목록에 없다", () => {
    expect(CHILDREN_WRITE_APIS_EXCLUDED.length).toBeGreaterThanOrEqual(1);
    for (const excluded of CHILDREN_WRITE_APIS_EXCLUDED) {
      expect(CHILDREN_WRITE_APIS).not.toContain(excluded.api);
      expect(excluded.why.length, `${excluded.api} 제외 이유`).toBeGreaterThan(10);
    }
  });
});

describe("ⓓ 정책 원천 단일", () => {
  it("setQueryDefaults를 부르는 자리는 app/_layout.tsx 하나뿐이다", () => {
    const callers = productionSources()
      .filter((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .some((line) => !isCommentLine(line) && line.includes("setQueryDefaults("))
      )
      .map(relative)
      .sort();
    expect(callers).toEqual(["app/_layout.tsx"]);
  });

  it("SHARED_CACHE_POLICIES를 정의하는 자리는 shared-cache-policy.ts 하나뿐이다", () => {
    const definers = productionSources()
      .filter((file) => /export const SHARED_CACHE_POLICIES/.test(readFileSync(file, "utf8")))
      .map(relative);
    expect(definers).toEqual(["src/query/shared-cache-policy.ts"]);
  });

  it("등록 자리는 값을 적지 않고 표를 훑기만 한다", () => {
    const layout = readFileSync(join(MOBILE_ROOT, "app/_layout.tsx"), "utf8");
    expect(layout).toContain("for (const policy of SHARED_CACHE_POLICIES)");
    expect(layout).toContain("queryClient.setQueryDefaults([...policy.queryKeyPrefix], { staleTime: policy.staleTimeMs })");
    // 5분이라는 값이 등록 자리에 다시 적히면 원천이 둘이 된다.
    expect(layout).not.toContain("5 * 60 * 1000");
    expect(layout).not.toContain("300_000");
  });
});

describe("ⓔ 바이트 불변 — 이 트랙이 건드리지 않기로 한 것들", () => {
  const layout = () => readFileSync(join(MOBILE_ROOT, "app/_layout.tsx"), "utf8");

  it("전역 기본은 30초 그대로이고 다른 기본 옵션은 여전히 0건이다", () => {
    const source = layout();
    expect(source).toContain("staleTime: 30_000");
    const defaultsStart = source.indexOf("defaultOptions:");
    expect(defaultsStart, "_layout에 defaultOptions 선언이 없다").toBeGreaterThan(-1);
    // fromIndex 없이 찾으면 파일 상단 import의 이름이 걸려 slice가 빈 문자열이 되고
    // 아래 not.toContain 단언이 공허하게 통과한다(가드를 세우다 드러난 잠재 결함).
    const defaultsEnd = source.indexOf("registerAppQueryClient(", defaultsStart);
    expect(defaultsEnd, "_layout에 defaultOptions 뒤 registerAppQueryClient 호출이 없다").toBeGreaterThan(defaultsStart);
    const defaults = source.slice(defaultsStart, defaultsEnd);
    for (const untouched of ["refetchOnWindowFocus", "gcTime", "retry", "refetchOnReconnect"]) {
      expect(defaults, `전역 기본에 ${untouched}가 생겼다`).not.toContain(`${untouched}:`);
    }
  });

  it('["categories"]의 두 계약(includeAll · 구독 전용 skipToken)이 그대로다', () => {
    const guard = readFileSync(join(MOBILE_ROOT, "src/categories-cache-contract.test.ts"), "utf8");
    expect(guard).toContain('"includeAll: true"');
    expect(guard).toContain("/enabled:\\s*false,\\s*\\n\\s*queryFn:\\s*skipToken/");
  });

  it("계정 전환 teardown 경로가 그대로다(FIX-118A)", () => {
    expect(layout()).toContain("registerAppQueryClient(queryClient);");
    expect(readFileSync(join(MOBILE_ROOT, "src/offline/session-teardown.ts"), "utf8")).toContain(
      "clearAppQueryCache();"
    );
    // 이 트랙은 teardown·clearAppQueryCache 경로를 0건 건드린다.
    expect(readFileSync(join(MOBILE_ROOT, "src/query/shared-cache-policy.ts"), "utf8")).not.toContain(
      "clearAppQueryCache("
    );
  });
});

/* ===========================================================================================
 * 라운드 84 트랙 D(GAP-084 #4) — 무효화 대장의 모집단(공유 키 전수) · 지출 쓰기 대장(다섯 경로) ·
 * 갈린 이유와 **그 이유의 참**.
 *
 * 위 라운드 83의 계약 다섯은 한 글자도 바뀌지 않는다(그 ⓐ 재현이 이 트랙의 전제이기도 하다).
 * 아래 넷이 세는 것은 신선도가 아니라 **무효화**다.
 * =========================================================================================== */

/** `저장소 루트 기준 상대경로`의 소스에서 한 구간을 자른다(파일 단위 검사를 막는다 — 라운드 83 M-5). */
function sliceBetween(file: string, sliceStart: string, sliceEnd: string): string {
  const source = readFileSync(join(MOBILE_ROOT, file), "utf8");
  const start = source.indexOf(sliceStart);
  // ⚠️ 실재 확인 가드: 표시가 사라지면 slice가 조용히 파일 전체(또는 빈 문자열)가 되어
  // 아래 단언들이 공허하게 통과한다.
  expect(start, `${file}: 구간 시작 "${sliceStart}" 이 없다`).toBeGreaterThan(-1);
  const end = source.indexOf(sliceEnd, start + sliceStart.length);
  expect(end, `${file}: 구간 끝 "${sliceEnd}" 이 시작 뒤에 없다`).toBeGreaterThan(start);
  return source.slice(start, end);
}

/** 그 구간이 **리터럴로** 무효화하는 키의 첫 칸 전수(주석 줄은 세지 않는다). */
function invalidatedKeyHeads(slice: string): string[] {
  const heads = new Set<string>();
  for (const line of slice.split("\n")) {
    if (isCommentLine(line)) continue;
    const match = line.match(/invalidateQueries\(\{\s*queryKey:\s*\["([a-z-]+)"/);
    if (match) heads.add(match[1]);
  }
  return [...heads].sort();
}

/**
 * 이 이름들을 실제로 **부르는** 소스 전수.
 *
 * 정의하는 자리는 호출부가 아니다: `src/api/**`(계약 클라이언트) · `src/offline/**`(로컬 우선
 * 쓰기의 정의 · flush 자신) · `src/query/**`(이 대장 자신 — 이름을 문자열로 들고 있다).
 */
function apiCallSites(apis: readonly string[]): string[] {
  if (apis.length === 0) return [];
  const pattern = new RegExp(`\\b(${apis.join("|")})\\s*\\(`);
  const found = new Set<string>();
  for (const file of productionSources()) {
    const rel = relative(file);
    if (rel.startsWith("src/api/") || rel.startsWith("src/offline/") || rel.startsWith("src/query/")) continue;
    const hit = readFileSync(file, "utf8")
      .split("\n")
      .some((line) => !isCommentLine(line) && pattern.test(line));
    if (hit) found.add(rel);
  }
  return [...found].sort();
}

/** 그 키를 **리터럴로** 무효화하는 소스 전수(`src/query/**`는 문자열로 들고 있을 뿐이라 뺀다). */
function literalInvalidationSites(keyHead: string): string[] {
  const pattern = new RegExp(`invalidateQueries\\(\\{\\s*queryKey:\\s*\\["${keyHead}"`);
  const found = new Set<string>();
  for (const file of productionSources()) {
    const rel = relative(file);
    if (rel.startsWith("src/query/")) continue;
    const hit = readFileSync(file, "utf8")
      .split("\n")
      .some((line) => !isCommentLine(line) && pattern.test(line));
    if (hit) found.add(rel);
  }
  return [...found].sort();
}

/**
 * 라운드 84 리뷰 M-4 — 무효화 키를 **집합 상수**로 들고 있는 자리들. 이름이 아니라 **실제 값**을
 * import해서 전개하므로, 상수의 내용이 바뀌면 그 순간 이 스윕이 세는 키도 함께 바뀐다.
 */
const KEY_SET_CONSTANTS: Record<string, ReadonlyArray<ReadonlyArray<string>>> = {
  CHILD_SCOPED_QUERY_KEY_PREFIXES,
  CHILD_REMOVAL_INVALIDATE_KEYS,
  HOUSEHOLD_JOIN_INVALIDATE_KEYS
};

/**
 * 그 키를 **상수를 거쳐** 무효화하는 소스 전수.
 *
 * 판정: ① 그 상수의 실제 값이 `[keyHead]`를 담고 ② 파일이 그 상수 이름을 주석이 아닌 줄에서
 * 쓰며 ③ 같은 파일이 `invalidateQueries`를 부른다. ②만으로 세면 주석에서 이름만 인용하는 파일
 * (app/(tabs)/reports.tsx · src/notifications/notification.store.ts)이 모집단에 들어오고,
 * ③만으로 세면 상수를 **정의만** 하는 파일(src/children/child-deletion.ts)이 들어온다.
 */
function constantInvalidationSites(keyHead: string): string[] {
  const names = Object.entries(KEY_SET_CONSTANTS)
    .filter(([, keys]) => keys.some((key) => key.length === 1 && key[0] === keyHead))
    .map(([name]) => name);
  if (names.length === 0) return [];
  const found = new Set<string>();
  for (const file of productionSources()) {
    const rel = relative(file);
    if (rel.startsWith("src/query/")) continue;
    const lines = readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => !isCommentLine(line));
    const usesConstant = lines.some((line) => names.some((name) => line.includes(name)));
    const invalidates = lines.some((line) => line.includes("invalidateQueries("));
    if (usesConstant && invalidates) found.add(rel);
  }
  return [...found].sort();
}

/** 리터럴 + 상수 경유 = 그 키를 실제로 비우는 자리 전수(리뷰 M-4 뒤의 모집단). */
function invalidationSites(keyHead: string): string[] {
  return [...new Set([...literalInvalidationSites(keyHead), ...constantInvalidationSites(keyHead)])].sort();
}

/** 한 무효화 줄의 위치 — 구간 안 중괄호 깊이와 그 줄 자신. */
type InvalidationLine = { keyHead: string; depth: number; text: string };

/**
 * ⚠️ 라운드 84 리뷰 H-1 — 구간이 무효화하는 키를 **깊이와 함께** 센다.
 *
 * 깊이는 구간 **첫 줄의 여는 중괄호**를 1로 본다. 즉 `if (summary.synced > 0) {` 로 시작하는
 * 구간에서 `depth === 1`은 "그 갈래 최상위 = 조건 없음"이고, 무효화를 갈래 하나로 더 감싸면
 * 2가 된다. 종전 검사(문자열이 구간 안에 있는가)는 그 차이를 보지 못했다.
 */
function invalidationLines(slice: string): InvalidationLine[] {
  const found: InvalidationLine[] = [];
  let depth = 0;
  for (const line of slice.split("\n")) {
    if (isCommentLine(line)) {
      continue;
    }
    const match = line.match(/invalidateQueries\(\{\s*queryKey:\s*\["([a-z-]+)"/);
    if (match) found.push({ keyHead: match[1], depth, text: line.trim() });
    depth += (line.match(/\{/g)?.length ?? 0) - (line.match(/\}/g)?.length ?? 0);
  }
  return found;
}

/** 그 줄 자신이 조건절을 앞에 달고 있지 않은가(`if (…) await queryClient…` · 삼항을 막는다). */
const UNCONDITIONAL_INVALIDATION_LINE = /^(await\s+)?(void\s+)?queryClient\.invalidateQueries\(/;

/** 세부를 대신 세는 대장이 아는 자리(쓰기 자리 + 무효화 자리). */
const DETAIL_LEDGER_SITES: Record<string, readonly string[]> = {
  CHILDREN_WRITE_LEDGER: CHILDREN_WRITE_LEDGER.flatMap((row) => [row.writeSite, row.invalidatedIn]),
  EXPENSE_WRITE_LEDGER: EXPENSE_WRITE_LEDGER.map((row) => row.writeSite)
};

describe("라운드 84 ⓐ 무효화 대장의 모집단 = 공유 키 전수 (두 방향)", () => {
  it("공유 키 전수가 무효화 대장에 있고, 대장에 낡은 줄이 없다", () => {
    const shared = sharedKeyHeads(collectQuerySites());
    const ledger = SHARED_KEY_COVERAGE.map((row) => row.queryKeyPrefix[0]).sort();

    // 방향 1: 공유 키인데 무효화 대장에 없으면 빨강(둘째 소비처가 생긴 키를 아무도 안 본다).
    expect(shared.filter((key) => !ledger.includes(key)), "무효화 대장에 없는 공유 키").toEqual([]);
    // 방향 2: 대장에 있는데 더는 공유 키가 아니면 빨강(낡은 줄).
    expect(ledger.filter((key) => !shared.includes(key)), "더는 공유 키가 아닌 무효화 대장의 줄").toEqual([]);
    // 그리고 정책 대장과 **같은 모집단**이다 — 한쪽에만 줄이 늘면 두 표가 갈린다.
    expect(ledger).toEqual(SHARED_CACHE_POLICIES.map((policy) => policy.queryKeyPrefix[0]).sort());
  });

  it("각 키가 ① 앱 안 쓰기 0건 또는 ② 쓰기 전수 + 무효화 자리를 값으로 갖는다", () => {
    for (const row of SHARED_KEY_COVERAGE) {
      const key = row.queryKeyPrefix[0];
      expect(row.queryKeyPrefix, `${key} 접두사`).toHaveLength(1);
      expect(row.why.length, `${key} 이유`).toBeGreaterThan(40);
      if (row.hasNoAppWrites) {
        // ①: 쓰기 0건이라고 말했으면 쓰기 칸이 전부 비어 있어야 한다(말과 값이 갈리지 않는다).
        expect(row.writeApis, `${key} 쓰기 0건인데 API가 적혀 있다`).toEqual([]);
        expect(row.writes, `${key} 쓰기 0건인데 경로가 적혀 있다`).toEqual([]);
        expect(row.detailLedger, `${key} 쓰기 0건인데 세부 대장을 가리킨다`).toBeNull();
      } else {
        // ②: 이 파일이 세든(writeApis) 다른 대장이 세든(detailLedger) **누군가는 세야 한다**.
        expect(
          row.writeApis.length > 0 || row.detailLedger !== null,
          `${key} 쓰기 0건도 아닌데 쓰기 전수를 세는 자리가 없다`
        ).toBe(true);
      }
      for (const site of row.otherInvalidationSites) {
        expect(site.why.length, `${key} 의 ${site.file} 무효화 이유`).toBeGreaterThan(10);
      }
    }
  });

  it("쓰기 API의 호출부 전수가 대장의 쓰기 자리와 같다 (두 방향)", () => {
    for (const row of SHARED_KEY_COVERAGE) {
      const key = row.queryKeyPrefix[0];
      const actual = apiCallSites(row.writeApis);
      const ledger = [...new Set(row.writes.map((write) => write.writeSite))].sort();
      // 방향 1: 소스에 있는데 대장에 없으면 빨강 — 무효화를 잊은 새 쓰기 경로가 여기 걸린다.
      expect(actual.filter((file) => !ledger.includes(file)), `${key} 대장에 없는 쓰기 경로`).toEqual([]);
      // 방향 2: 대장에 있는데 소스에 없으면 빨강(낡은 줄).
      expect(ledger.filter((file) => !actual.includes(file)), `${key} 실재하지 않는 대장의 경로`).toEqual([]);
    }
  });

  it("대장의 모든 쓰기가 무효화 자리를 갖거나, 없는 이유를 값으로 갖는다 (뮤테이션 구간 단위)", () => {
    const keySets: Record<string, ReadonlyArray<ReadonlyArray<string>>> = {
      CHILD_REMOVAL_INVALIDATE_KEYS,
      HOUSEHOLD_JOIN_INVALIDATE_KEYS
    };

    for (const row of SHARED_KEY_COVERAGE) {
      const key = row.queryKeyPrefix[0];
      for (const write of row.writes) {
        expect(write.why.length, `${write.writeSite} (${write.mutation}) 이유`).toBeGreaterThan(20);
        // 쓰기 자리가 정말 이 키의 쓰기 API를 부른다(대장이 낡으면 여기서 걸린다).
        const writeSource = readFileSync(join(MOBILE_ROOT, write.writeSite), "utf8");
        expect(
          row.writeApis.some((api) => new RegExp(`\\b${api}\\s*\\(`).test(writeSource)),
          `${write.writeSite} 가 ${key} 의 쓰기 API를 부르지 않는다`
        ).toBe(true);

        if (write.invalidatedIn === null) {
          // 무효화 0건은 **숨기지 않고** 이유로 남긴다(그 이유에는 재개 조건이 있다).
          expect(write.invalidation, `${write.mutation} 무효화 0건인데 표현식이 적혀 있다`).toBeNull();
          expect(write.why.length, `${write.mutation} 무효화 0건의 이유`).toBeGreaterThan(60);

          // ⚠️ 라운드 84 리뷰 M-5 — 이유만 적혀 있으면 그 이유가 참인지는 아무도 세지 않는다
          // (종전 이 자리의 이유는 실제로 **거짓**이었다: markHomeReached 선행 경로가 둘 있었다).
          expect(
            write.zeroInvalidationProvenBy,
            `${write.writeSite} (${write.mutation}) 무효화 0건인데 그 이유를 검증하는 이름이 없다`
          ).toBeDefined();
          if (write.zeroInvalidationProvenBy === "child-scoped-key-new-child") {
            // ① 이 화면은 그 키를 **열지 않는다**. 열고 있으면 "무효화할 대상이 없다"가 아니다.
            expect(
              collectQuerySites().filter((site) => site.file === write.writeSite && site.keyHead === key),
              `${write.writeSite} 가 ["${key}"] 를 스스로 연다 — 무효화 0건의 이유가 성립하지 않는다`
            ).toEqual([]);
            // ② 그 키가 정말 childId 스코프다 — 선언 전수의 둘째 칸이 childId다.
            const scoped = new RegExp(`^queryKey:\\s*\\["${key}",\\s*childId\\b`);
            const unscoped: string[] = [];
            for (const file of productionSources()) {
              const lines = readFileSync(file, "utf8").split("\n");
              for (let i = 0; i < lines.length; i += 1) {
                const trimmed = lines[i].trim();
                if (isCommentLine(lines[i]) || !trimmed.startsWith(`queryKey: ["${key}"`)) continue;
                if (!scoped.test(trimmed)) unscoped.push(`${relative(file)}:${i + 1} ${trimmed}`);
              }
            }
            expect(unscoped, `["${key}"] 선언 중 childId 스코프가 아닌 자리`).toEqual([]);
            // ③ 이 경로 **앞 단계**가 새 아이를 만든다(그 사실은 CHILDREN_WRITE_LEDGER가 이미 센다).
            expect(write.writeSite.startsWith("app/(onboarding)/"), `${write.writeSite} 가 온보딩 화면이 아니다`).toBe(
              true
            );
            expect(
              CHILDREN_WRITE_LEDGER.find(
                (entry) => entry.invalidatedIn.startsWith("app/(onboarding)/") && entry.apis.includes("createChild")
              ),
              "온보딩이 새 아이를 만드는 줄이 CHILDREN_WRITE_LEDGER에서 사라졌다"
            ).toBeDefined();
          }
          continue;
        }

        const slice = sliceBetween(write.invalidatedIn, write.sliceStart, write.sliceEnd);
        if (write.invalidatedKeyHeads) {
          // ⚠️ 라운드 84 리뷰 L-13 — 이유가 말하는 집합을 **소스에서 세어** 맞댄다(두 방향).
          expect(
            invalidatedKeyHeads(slice),
            `${write.writeSite} (${write.mutation}) 의 무효화 키 집합`
          ).toEqual([...write.invalidatedKeyHeads].sort());
        }
        const invalidationSource = readFileSync(join(MOBILE_ROOT, write.invalidatedIn), "utf8");
        if (write.via) {
          // 2단계 ①: 이 구간이 실제로 그 헬퍼를 부른다.
          expect(slice, `${write.invalidatedIn} (${write.mutation}) 가 ${write.via} 를 부르지 않는다`).toMatch(
            new RegExp(`\\b${write.via}\\s*\\(`)
          );
          // 2단계 ②: 그 헬퍼 **정의**가 무효화를 담고 있다(이름만 맞고 속이 빈 헬퍼는 통과하지 못한다).
          const helperStart = Math.max(
            invalidationSource.indexOf(`function ${write.via}(`),
            invalidationSource.indexOf(`const ${write.via} = `)
          );
          expect(helperStart, `${write.invalidatedIn} 에 ${write.via} 정의가 없다`).toBeGreaterThan(-1);
          const helperEnd = invalidationSource.indexOf("\n  }", helperStart);
          expect(helperEnd, `${write.via} 정의의 끝을 찾지 못했다`).toBeGreaterThan(helperStart);
          expect(
            invalidationSource.slice(helperStart, helperEnd),
            `${write.via} 정의에 명시 무효화가 없다`
          ).toContain(write.invalidation!);
        } else {
          expect(slice, `${write.invalidatedIn} (${write.mutation}) 구간에 명시 무효화가 없다`).toContain(
            write.invalidation!
          );
        }
        if (write.invalidation!.includes(`["${key}"]`)) continue;
        // 키 집합 상수를 거치는 경로는 **그 상수의 실제 값**으로 확인한다(이름만 맞고 속이 빈
        // 상수도 문자열 검사는 통과한다).
        const usedKeySet = Object.keys(keySets).find((name) => write.invalidation!.includes(name));
        expect(usedKeySet, `${write.invalidatedIn} 의 무효화가 ["${key}"]도 아는 키 집합도 아니다`).toBeDefined();
        expect(
          keySets[usedKeySet!].some((entry) => entry.length === 1 && entry[0] === key),
          `${usedKeySet} 가 ["${key}"]을 포함하지 않는다`
        ).toBe(true);
      }
    }
  });

  /**
   * ⚠️ 라운드 84 리뷰 M-4 — 상수 경유 스윕이 **실제로 무언가를 센다**(0건이면 죽은 코드다).
   *
   * 그리고 그 넷은 리터럴 스윕이 끝내 볼 수 없는 자리다: 상수를 훑는 줄에는 키 이름이 한 글자도
   * 적혀 있지 않다. 이름이 아니라 **import한 값**으로 판정한다는 사실도 여기서 함께 못 박는다.
   */
  it("상수를 거쳐 아이 스코프 캐시를 비우는 자리가 모집단에 들어온다 (이름이 아니라 값으로 판정한다)", () => {
    expect(
      CHILD_SCOPED_QUERY_KEY_PREFIXES.map((key) => key[0]).sort(),
      "아이 스코프 상수의 실제 값"
    ).toEqual(["budget", "expense", "expenses", "home", "item-detail", "items", "report"]);

    for (const key of ["expenses", "budget"]) {
      const constantOnly = constantInvalidationSites(key).filter(
        (file) => !literalInvalidationSites(key).includes(file)
      );
      expect(constantOnly, `["${key}"] 를 상수로만 비우는 자리`).toEqual([
        "app/family/accept/[token].tsx",
        "app/settings/children.tsx",
        "app/settings/privacy.tsx",
        "src/children/child-switch.ts"
      ]);
    }
    // 그 상수가 담지 않는 키에는 상수 경유 자리가 0건이다(스윕이 아무 파일이나 끌어오지 않는다).
    expect(constantInvalidationSites("categories"), "[categories] 상수 경유 자리").toEqual([]);
    // 주석에서 이름만 인용하는 파일은 세지 않는다(그 둘이 실제로 이 저장소에 있다).
    for (const key of ["expenses", "budget", "children"]) {
      expect(constantInvalidationSites(key)).not.toContain("app/(tabs)/reports.tsx");
      expect(constantInvalidationSites(key)).not.toContain("src/notifications/notification.store.ts");
    }
  });

  it("세부를 대신 세는 대장이 실재하고, 비어 있지 않다", () => {
    for (const row of SHARED_KEY_COVERAGE) {
      if (row.detailLedger === null) continue;
      const sites = DETAIL_LEDGER_SITES[row.detailLedger];
      expect(sites, `${row.detailLedger} 라는 대장이 이 파일에 없다`).toBeDefined();
      expect(sites.length, `${row.detailLedger} 가 비어 있다`).toBeGreaterThan(0);
    }
  });

  it("그 키를 무효화하는 자리 전수가 대장이 아는 자리이고, 쓰기 뒤처리가 아닌 자리는 이유와 함께 있다", () => {
    for (const row of SHARED_KEY_COVERAGE) {
      const key = row.queryKeyPrefix[0];
      // ⚠️ 라운드 84 리뷰 M-4 — 리터럴 + **상수 경유**가 함께 모집단이다.
      const actual = invalidationSites(key);
      const known = new Set<string>([
        ...row.writes.flatMap((write) => (write.invalidatedIn ? [write.invalidatedIn] : [])),
        ...(row.detailLedger ? DETAIL_LEDGER_SITES[row.detailLedger] : [])
      ]);
      const explained = new Set(row.otherInvalidationSites.map((site) => site.file));

      // 방향 1: 이 키를 무효화하는데 대장이 모르는 자리가 있으면 빨강 — 새 쓰기 경로가
      // 이유 없이 생긴 자리이거나, 당김 새로고침처럼 이유를 적어 둬야 하는 자리다.
      expect(
        actual.filter((file) => !known.has(file) && !explained.has(file)),
        `${key} 를 무효화하는데 대장이 모르는 자리 — 쓰기면 writes에, 아니면 이유와 함께 otherInvalidationSites에`
      ).toEqual([]);
      // 방향 2: 이유가 적힌 자리가 더는 무효화하지 않으면 빨강(낡은 줄).
      expect(
        [...explained].filter((file) => !actual.includes(file)),
        `${key} 를 더는 무효화하지 않는 otherInvalidationSites의 줄`
      ).toEqual([]);
    }
  });
});

describe("라운드 84 ⓑ 지출 쓰기 대장 (다섯 경로 · 두 방향)", () => {
  const screenRows = EXPENSE_WRITE_LEDGER.filter((row) => row.kind === "screen");
  const flushRows = EXPENSE_WRITE_LEDGER.filter((row) => row.kind === "flush");

  it("지출 한 건을 바꾸는 쓰기 API의 호출부 전수가 대장의 화면 줄과 같다 (두 방향)", () => {
    const actual = apiCallSites(EXPENSE_WRITE_APIS);
    const ledger = [...new Set(screenRows.map((row) => row.writeSite))].sort();
    // 방향 1: 소스에 있는데 대장에 없으면 빨강(무효화 집합을 아무도 세지 않는 새 경로).
    expect(actual.filter((file) => !ledger.includes(file)), "대장에 없는 지출 쓰기 경로").toEqual([]);
    // 방향 2: 대장에 있는데 소스에 없으면 빨강(낡은 줄).
    expect(ledger.filter((file) => !actual.includes(file)), "실재하지 않는 대장의 경로").toEqual([]);
  });

  it("대장은 다섯 줄이고, flush 줄 하나가 확정 시점을 진다", () => {
    // 수를 손으로 적는 것이 아니라 **모집단의 모양**을 못 박는다: 화면 넷(파일 셋 · 뮤테이션 넷)
    // + 확정 하나. 경로가 늘면 위 두 방향 단언이 먼저 빨개진다.
    expect(flushRows.map((row) => row.writeSite)).toEqual(["src/offline/sync-controller.ts"]);
    expect(EXPENSE_WRITE_LEDGER.length).toBe(screenRows.length + flushRows.length);
    for (const row of EXPENSE_WRITE_LEDGER) {
      expect(row.why.length, `${row.label} 이유`).toBeGreaterThan(40);
      expect(row.label.length, `${row.label} 이름`).toBeGreaterThan(1);
    }
  });

  it("다섯 경로의 무효화 키 집합이 소스에서 센 것과 정확히 같다", () => {
    for (const row of EXPENSE_WRITE_LEDGER) {
      const counted = invalidatedKeyHeads(sliceBetween(row.writeSite, row.sliceStart, row.sliceEnd));
      expect(counted.length, `${row.label} 구간에 무효화가 0건이다(구간을 잘못 잘랐다)`).toBeGreaterThan(0);
      expect(counted, `${row.label} (${row.writeSite}) 의 무효화 키 집합`).toEqual(
        [...row.invalidatedKeyHeads].sort()
      );
    }
  });

  it("flush 줄은 쓰기 API를 **정의**하는 자리라 호출부 스윕에 잡히지 않는다", () => {
    const source = readFileSync(join(MOBILE_ROOT, "src/offline/sync-controller.ts"), "utf8");
    for (const api of EXPENSE_WRITE_APIS) {
      expect(source, `${api} 정의가 sync-controller에 없다`).toContain(`export async function ${api}(`);
    }
    expect(apiCallSites(EXPENSE_WRITE_APIS)).not.toContain("src/offline/sync-controller.ts");
  });

  it("모집단에서 뺀 이름은 이유와 함께 적혀 있고, 실제로 쓰기 API 목록에 없다", () => {
    expect(EXPENSE_WRITE_APIS_EXCLUDED.length).toBeGreaterThanOrEqual(1);
    for (const excluded of EXPENSE_WRITE_APIS_EXCLUDED) {
      expect(EXPENSE_WRITE_APIS).not.toContain(excluded.api);
      expect(excluded.why.length, `${excluded.api} 제외 이유`).toBeGreaterThan(10);
      // 뺀 이름도 **어딘가는 세야 한다** — 공유 키 대장의 ["expenses"] 줄이 센다.
      const coverage = SHARED_KEY_COVERAGE.find((row) => row.queryKeyPrefix[0] === "expenses")!;
      expect(coverage.writeApis, `${excluded.api} 를 세는 자리가 0건이다`).toContain(excluded.api);
    }
  });
});

describe("라운드 84 ⓒ·ⓓ 갈린 이유와 그 이유의 참 (이유 없이 갈린 집합 0건)", () => {
  /** 확정 시점의 집합 — 소스에서 센다(대장에 적힌 배열이 아니라). */
  function confirmBaseline(): string[] {
    const flush = EXPENSE_WRITE_LEDGER.find((row) => row.kind === "flush")!;
    return invalidatedKeyHeads(sliceBetween(flush.writeSite, flush.sliceStart, flush.sliceEnd));
  }

  it("확정 시점 집합과 갈리는 자리 전수가 대장의 이유와 정확히 같다 (두 방향 = 래칫)", () => {
    const baseline = confirmBaseline();
    for (const row of EXPENSE_WRITE_LEDGER) {
      const counted = invalidatedKeyHeads(sliceBetween(row.writeSite, row.sliceStart, row.sliceEnd));
      const actual = [
        ...baseline.filter((key) => !counted.includes(key)).map((key) => `missing:${key}`),
        ...counted.filter((key) => !baseline.includes(key)).map((key) => `extra:${key}`)
      ].sort();
      const declared = row.divergences.map((entry) => `${entry.direction}:${entry.keyHead}`).sort();

      // 방향 1 = 래칫: 소스에서 갈렸는데 이유가 없으면 빨강. **이유 없이 갈린 집합은 0건이다.**
      expect(
        actual.filter((entry) => !declared.includes(entry)),
        `${row.label}: 확정 시점 집합과 갈렸는데 이유가 0건이다 — shared-cache-policy.ts에 이유와 함께 등재할 것`
      ).toEqual([]);
      // 방향 2: 이유가 적혔는데 더는 갈리지 않으면 빨강(낡은 이유).
      expect(
        declared.filter((entry) => !actual.includes(entry)),
        `${row.label}: 더는 갈리지 않는 이유`
      ).toEqual([]);

      for (const divergence of row.divergences) {
        expect(divergence.why.length, `${row.label} ${divergence.keyHead} 이유`).toBeGreaterThan(40);
      }
    }
  });

  it('⚠️ 이유의 참 ①(flush-confirm) — sync-controller의 `summary.synced > 0` 갈래가 그 키를 무효화한다', () => {
    const source = readFileSync(join(MOBILE_ROOT, "src/offline/sync-controller.ts"), "utf8");
    // 그 갈래가 정말 flush 확정 함수 안에 있다(다른 곳의 같은 이름 갈래를 재지 않는다).
    const attemptFlushAt = source.indexOf("async function attemptFlush(");
    expect(attemptFlushAt, "sync-controller에 attemptFlush 정의가 없다").toBeGreaterThan(-1);
    const branchAt = source.indexOf("if (summary.synced > 0) {", attemptFlushAt);
    expect(branchAt, "attemptFlush 안에 summary.synced > 0 갈래가 없다").toBeGreaterThan(attemptFlushAt);

    const flush = EXPENSE_WRITE_LEDGER.find((row) => row.kind === "flush")!;
    const branch = sliceBetween(flush.writeSite, flush.sliceStart, flush.sliceEnd);
    const confirmed = invalidatedKeyHeads(branch);
    const lines = invalidationLines(branch);

    const claims = EXPENSE_WRITE_LEDGER.flatMap((row) =>
      row.divergences.filter((entry) => entry.provenBy === "flush-confirm").map((entry) => ({ row, entry }))
    );
    // 오늘 이 이유에 기대는 자리가 실재한다(0건이면 이 검증기 자체가 죽은 코드가 된다).
    expect(claims.length, "flush-confirm 이유가 0건이다").toBeGreaterThan(0);
    for (const { row, entry } of claims) {
      expect(entry.direction, `${row.label} ${entry.keyHead}: flush가 덮는다는 이유는 missing에만 선다`).toBe(
        "missing"
      );
      expect(
        confirmed,
        `${row.label} 의 이유가 거짓이 됐다 — 확정 갈래가 ["${entry.keyHead}"]을 더는 무효화하지 않는다`
      ).toContain(entry.keyHead);

      // ⚠️ 라운드 84 리뷰 H-1 — **조건이 붙으면 그 이유는 이미 거짓이다.** 화면 셋은 "flush가
      // 어떤 mutation이었는지 모르므로 조건 없이 덮는다"에 기대고 있으므로, 그 무효화가
      // ① 갈래 최상위 깊이에 있고 ② 줄 자신이 조건절로 시작하지 않아야 한다.
      const unconditional = lines.filter(
        (line) =>
          line.keyHead === entry.keyHead &&
          line.depth === 1 &&
          UNCONDITIONAL_INVALIDATION_LINE.test(line.text)
      );
      expect(
        unconditional.length,
        `${row.label} 의 이유가 거짓이 됐다 — 확정 갈래의 ["${entry.keyHead}"] 무효화에 조건이 붙었다 ` +
          `(발견: ${lines
            .filter((line) => line.keyHead === entry.keyHead)
            .map((line) => `깊이 ${line.depth} · ${line.text}`)
            .join(" / ") || "0건"})`
      ).toBeGreaterThan(0);
    }
    // 이 트랙 전체가 서 있는 그 한 줄을 문자 그대로도, 조건 없음으로도 못 박는다.
    expect(branch, "확정 갈래의 [\"home\"] 무효화가 사라졌다").toContain('invalidateQueries({ queryKey: ["home"] })');
    expect(
      lines.filter((line) => line.keyHead === "home").map((line) => line.depth),
      '확정 갈래의 ["home"] 무효화가 갈래 최상위(깊이 1)에 있다'
    ).toEqual([1]);
  });

  /**
   * ⚠️ 라운드 84 리뷰 H-1 — **판정기를 픽스처로 실제로 돌린다.**
   *
   * 위 단언이 무엇을 잡는지는 픽스처가 보여야 한다: 같은 무효화 줄을 갈래 하나로 감싸면
   * 깊이가 2가 되고(그래서 빨개지고), 줄 앞에 조건절을 붙이면 줄 모양 검사가 잡는다.
   * 종전 검사(문자열이 구간 안에 있는가)는 셋을 전부 초록으로 통과시켰다.
   */
  it("조건으로 감싼 무효화는 갈래 최상위가 아니다 (그 창이 닫혔다는 것을 픽스처로 보인다)", () => {
    const unconditional = [
      "if (summary.synced > 0) {",
      '    await queryClient.invalidateQueries({ queryKey: ["home"] });',
      "  }"
    ].join("\n");
    const wrapped = [
      "if (summary.synced > 0) {",
      "    if (summary.expenseSynced > 0) {",
      '      await queryClient.invalidateQueries({ queryKey: ["home"] });',
      "    }",
      "  }"
    ].join("\n");
    const guardedOnOneLine = [
      "if (summary.synced > 0) {",
      '    if (touchedHome) await queryClient.invalidateQueries({ queryKey: ["home"] });',
      "  }"
    ].join("\n");

    // 종전 검사는 셋을 구분하지 못한다 — 집합도, 문자열 포함도 똑같다.
    for (const source of [unconditional, wrapped, guardedOnOneLine]) {
      expect(invalidatedKeyHeads(source)).toEqual(["home"]);
      expect(source).toContain('invalidateQueries({ queryKey: ["home"] })');
    }

    expect(invalidationLines(unconditional).map((line) => line.depth)).toEqual([1]);
    expect(UNCONDITIONAL_INVALIDATION_LINE.test(invalidationLines(unconditional)[0].text)).toBe(true);
    // ① 감싸는 갈래가 한 겹 생기면 깊이가 2다.
    expect(invalidationLines(wrapped).map((line) => line.depth)).toEqual([2]);
    // ② 같은 줄에 조건이 붙으면 깊이는 1이지만 줄 모양이 아니다.
    expect(invalidationLines(guardedOnOneLine).map((line) => line.depth)).toEqual([1]);
    expect(UNCONDITIONAL_INVALIDATION_LINE.test(invalidationLines(guardedOnOneLine)[0].text)).toBe(false);
  });

  it("이유의 참 ②(single-file-key) — 그 키를 켜는 파일이 그 경로 하나뿐이고, 공유 키가 아니다", () => {
    const sites = collectQuerySites();
    const shared = new Set(sharedKeyHeads(sites));
    const claims = EXPENSE_WRITE_LEDGER.flatMap((row) =>
      row.divergences.filter((entry) => entry.provenBy === "single-file-key").map((entry) => ({ row, entry }))
    );
    expect(claims.length, "single-file-key 이유가 0건이다").toBeGreaterThan(0);
    for (const { row, entry } of claims) {
      expect(entry.direction, `${row.label} ${entry.keyHead}: 단일 파일 키 이유는 extra에만 선다`).toBe("extra");
      const files = [...new Set(sites.filter((site) => site.keyHead === entry.keyHead).map((site) => site.file))];
      expect(files, `["${entry.keyHead}"] 를 켜는 파일`).toEqual([row.writeSite]);
      expect(shared.has(entry.keyHead), `["${entry.keyHead}"] 가 공유 키가 됐다 — 정책 대장이 세야 한다`).toBe(false);
    }
  });

  it('오늘의 그림: `["home"]`은 확정 시점에만 있고 화면 셋에는 없다 (그 셋이 flush에 기대고 있다)', () => {
    const withoutHome = EXPENSE_WRITE_LEDGER.filter(
      (row) => !invalidatedKeyHeads(sliceBetween(row.writeSite, row.sliceStart, row.sliceEnd)).includes("home")
    ).map((row) => row.label);
    // ⚠️ 이 수가 줄면(= 화면이 ["home"]을 스스로 무효화하기 시작하면) 그것은 개선이 아니라
    // **로컬 우선 쓰기에서 서버의 옛 값을 다시 받아오는 변경**이다 — 이 줄이 그 판단을 세운다.
    expect(withoutHome, '["home"]을 무효화하지 않는 지출 쓰기 경로').toEqual([
      "상세 수정",
      "상세 삭제",
      "기록 탭 행 삭제"
    ]);
  });
});

/**
 * ⚠️ 라운드 84 리뷰 L-14 — **모집단 단위가 담지 못하는 것을 다른 대장이 진다.**
 *
 * ⓐ·ⓑ의 단위는 *"그 키를 켜는 파일 수 ≥ 2"* 다(이유는 shared-cache-policy.ts 머리말에 값으로
 * 있다 — 신선도는 읽는 자리가 정한다). 그 단위 밖에 **읽는 자리는 하나인데 비우는 자리는 여럿**인
 * 키가 있고, 그 전수를 세지 않으면 "모집단 밖"과 "사각"의 구분이 사라진다.
 */
describe("라운드 84 ⓕ 선언 한 파일 · 무효화 여러 자리인 키 (두 방향)", () => {
  /** 그 키를 켜는 파일 전수(정책 대장과 같은 스윕). */
  function declaringFiles(sites: QuerySite[], keyHead: string): string[] {
    return [...new Set(sites.filter((site) => site.keyHead === keyHead).map((site) => site.file))].sort();
  }

  it("소스에서 그 모양인 키 전수가 대장과 같고, 대장에 낡은 줄이 없다", () => {
    const sites = collectQuerySites();
    const shared = new Set(sharedKeyHeads(sites));
    const actual = [...new Set(sites.map((site) => site.keyHead))]
      .filter((keyHead) => !shared.has(keyHead))
      .filter((keyHead) => invalidationSites(keyHead).length >= 2)
      .sort();
    const ledger = INVALIDATION_ONLY_KEYS.map((row) => row.keyHead).sort();

    // 방향 1: 그 모양인데 대장에 없으면 빨강(아무도 세지 않는 무효화 집합이 생겼다).
    expect(actual.filter((key) => !ledger.includes(key)), "대장에 없는 '무효화만 여럿' 키").toEqual([]);
    // 방향 2: 대장에 있는데 더는 그 모양이 아니면 빨강(공유 키가 됐거나 무효화가 하나로 줄었다).
    expect(ledger.filter((key) => !actual.includes(key)), "실재하지 않는 대장의 줄").toEqual([]);
  });

  it("각 줄의 선언 파일이 실재하고 하나뿐이며, 이유가 비어 있지 않다", () => {
    const sites = collectQuerySites();
    for (const row of INVALIDATION_ONLY_KEYS) {
      expect(declaringFiles(sites, row.keyHead), `["${row.keyHead}"] 를 켜는 파일`).toEqual([row.declaredIn]);
      expect(row.why.length, `["${row.keyHead}"] 이유`).toBeGreaterThan(40);
      expect(invalidationSites(row.keyHead).length, `["${row.keyHead}"] 무효화 자리`).toBeGreaterThanOrEqual(2);
    }
  });

  it('그 단위가 실제로 무엇을 놓치는지 값으로 센다 — ["home"]은 여섯 자리에서 비워지지만 공유 키가 아니다', () => {
    const shared = new Set(sharedKeyHeads(collectQuerySites()));
    expect(shared.has("home"), '["home"] 이 공유 키가 됐다 — 정책 대장이 세야 한다').toBe(false);
    expect(literalInvalidationSites("home").length, '["home"] 을 비우는 자리').toBeGreaterThanOrEqual(6);
    expect(INVALIDATION_ONLY_KEYS.map((row) => row.keyHead)).toContain("home");
  });
});

describe("라운드 84 ⓔ 리터럴이 아닌 queryKey 자리 (정책 대장 스윕의 사각)", () => {
  /** `queryKey:` 로 시작하는 선언 줄 중 리터럴 배열이 **아닌** 것 전수(스윕이 세지 못하는 자리). */
  function nonLiteralQueryKeyLines(): { file: string; constantName: string }[] {
    const found: { file: string; constantName: string }[] = [];
    for (const file of productionSources()) {
      const lines = readFileSync(file, "utf8").split("\n");
      for (const line of lines) {
        if (isCommentLine(line)) continue;
        const trimmed = line.trim();
        if (!trimmed.startsWith("queryKey:")) continue;
        if (/^queryKey:\s*\["([a-z-]+)"/.test(trimmed)) continue;
        const name = trimmed.replace(/^queryKey:\s*/, "").replace(/[,\s]+$/, "");
        found.push({ file: relative(file), constantName: name });
      }
    }
    return found.sort((a, b) => `${a.file}${a.constantName}`.localeCompare(`${b.file}${b.constantName}`));
  }

  it("리터럴이 아닌 선언 전수가 대장에 이름으로 있고, 대장에 낡은 줄이 없다 (두 방향)", () => {
    const actual = nonLiteralQueryKeyLines().map((site) => `${site.file}:${site.constantName}`);
    const ledger = NON_LITERAL_QUERY_KEY_SITES.map((site) => `${site.file}:${site.constantName}`).sort();
    expect(actual.filter((entry) => !ledger.includes(entry)), "대장에 없는 비리터럴 queryKey 자리").toEqual([]);
    expect(ledger.filter((entry) => !actual.includes(entry)), "실재하지 않는 대장의 줄").toEqual([]);
  });

  it("각 줄의 선언이 실재하고, 그 키가 오늘도 단일 파일이라 값이 0건이다", () => {
    const sites = collectQuerySites();
    const shared = new Set(sharedKeyHeads(sites));
    for (const site of NON_LITERAL_QUERY_KEY_SITES) {
      expect(site.why.length, `${site.constantName} 이유`).toBeGreaterThan(40);
      const source = readFileSync(join(MOBILE_ROOT, site.file), "utf8");
      expect(source, `${site.file} 에 ${site.constantName} 선언이 없다`).toContain(site.declaration);
      expect(site.declaration, `${site.constantName} 선언이 ["${site.keyHead}"] 를 가리키지 않는다`).toContain(
        `["${site.keyHead}"`
      );
      // ⚠️ 이 키가 둘째 파일을 얻는 날 값이 0건이 아니게 된다 — 정책 대장의 스윕은 그것을
      // 세지 못하므로(리터럴만 센다) 여기가 그 사실을 알리는 유일한 자리다.
      const declaringFiles = new Set<string>();
      for (const file of productionSources()) {
        // `src/query/**`는 이 대장 자신 — 선언 문자열을 값으로 들고 있을 뿐이다.
        if (relative(file).startsWith("src/query/")) continue;
        const hit = readFileSync(file, "utf8")
          .split("\n")
          .some((line) => !isCommentLine(line) && line.includes(`["${site.keyHead}"`));
        if (hit) declaringFiles.add(relative(file));
      }
      expect([...declaringFiles].sort(), `["${site.keyHead}"] 를 선언하는 파일`).toEqual([site.file]);
      expect(shared.has(site.keyHead), `["${site.keyHead}"] 가 공유 키가 됐다`).toBe(false);
    }
  });
});
