import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { QueryClient, QueryObserver, focusManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { CHILD_REMOVAL_INVALIDATE_KEYS } from "../children/child-deletion";
import { HOUSEHOLD_JOIN_INVALIDATE_KEYS } from "../children/household-join";
import {
  CHILDREN_WRITE_APIS,
  CHILDREN_WRITE_APIS_EXCLUDED,
  CHILDREN_WRITE_LEDGER,
  LONG_SHARED_STALE_TIME_MS,
  SHARED_CACHE_POLICIES
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
