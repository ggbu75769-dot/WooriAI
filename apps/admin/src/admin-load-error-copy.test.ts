import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { AdminApiError, AdminApiTimeoutError } from "./lib/admin-api";
import {
  LOAD_ERROR_COPY_EXEMPT_SITES,
  LOAD_ERROR_COPY_SITES,
  loadErrorCopy,
  loadErrorMessage,
  loadErrorReason,
  loadErrorRetryable
} from "./lib/load-error-copy";

/**
 * 라운드 73 트랙 D(GAP-073 #4ⓐ·ⓓ) — **어드민이 아는 것을 말한다.**
 *
 * 정찰 노트가 센 것: 조회 실패 자리 열다섯 중 **열**이 `admin-api.ts`가 만든 구체적인
 * 문장(타임아웃·네트워크·서버 문장)을 통째로 버리고 `"…를 불러오지 못했어요."` 하나로
 * 수렴했고, 나머지 넷은 각자 다른 타임아웃 문장을 손으로 지어 갈랐다. 판정이 없어서가
 * 아니라 화면이 그 판정을 읽지 않아서다.
 *
 * 이 계약이 지키는 것은 셋이다.
 *  ⓐ **소비 집합이 값이다** — `app/**`의 조회 catch 전수가 한 벌을 부른다(파생 단언).
 *  ⓑ **네 갈래가 값이고, 이 트랙이 만든 문구는 0건이다**(부정 단언).
 *  ⓒ **[다시 시도]가 서지 않는 실패가 값이다.**
 */

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/**
 * **스윕이 걷는 뿌리**(라운드 75 트랙 D ⓐ).
 *
 * 라운드 73~74의 스윕은 `app/**` 하나만 걸었다. 그래서 파생 단언(소비 집합 ↔ 값)이
 * `src/**`를 **구조적으로 보지 못했고**, 어드민에서 가장 먼저 만나는 화면
 * (`src/components/AdminShell.tsx`의 MFA 등록 관문)이 한 벌을 부르지 않은 채 목록에도
 * 면제 목록에도 없이 통과했다. 어드민의 화면 소스는 이 두 뿌리가 전부다.
 */
const SCREEN_SOURCE_ROOTS = ["app", "src/components"] as const;

/**
 * 그리고 **걷지 않는 뿌리와 그 이유**. 값으로 남기는 이유는 `LOAD_ERROR_COPY_EXEMPT_SITES`와
 * 같다 — 다음 라운드가 "왜 여기는 안 보나"를 다시 재지 않는다.
 */
const NON_SCREEN_SOURCE_ROOTS: Readonly<Record<string, string>> = {
  "src/lib":
    "화면이 아니라 판정·API 래퍼·세션 컨텍스트 모듈만 있는 뿌리다. `.tsx`가 하나 있지만" +
    "(`admin-token-context.tsx`) 그것은 프로바이더라 조회 실패를 그릴 자리가 없고, 이 뿌리의" +
    "나머지는 화면이 **소비하는** 판정(load-error-copy·worker-health-view·revision-rows)이다."
};

/** 화면 소스 전수(어드민 루트 기준 POSIX 경로). */
function appScreenPaths(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;
      found.push(relative(adminRoot, fullPath).split(sep).join("/"));
    }
  };
  for (const root of SCREEN_SOURCE_ROOTS) walk(join(adminRoot, ...root.split("/")));
  return found.sort();
}

/**
 * `catch (error) {` … 대응하는 `}` 까지의 블록 본문 전수.
 *
 * 라운드 73 후속(적대적 리뷰 ⑩): 401 갈래 순서를 **파일 전체의 첫 위치**로 재면, 두 번째
 * catch가 로그아웃보다 문구를 먼저 세워도 통과한다(첫 catch 하나가 통과를 사 준다).
 * 그래서 자리별로 — catch 블록 단위로 — 묻는다.
 */
function catchBlocks(source: string): string[] {
  const blocks: string[] = [];
  for (const match of source.matchAll(/catch \((?:error|err)\) \{/g)) {
    const open = (match.index as number) + match[0].length - 1;
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      else if (source[index] === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(source.slice(open, index + 1));
          break;
        }
      }
    }
  }
  return blocks;
}

/**
 * **401 갈래가 없는 catch와 그 이유**(자리별 단언의 예외 — 값으로 남긴다).
 *
 * 예외가 늘어나면 이 표가 먼저 빨개지고, 늘린 라운드가 이유를 적게 된다
 * (`LOAD_ERROR_COPY_EXEMPT_SITES`와 같은 관례). `marker`는 그 블록을 알아보는 문자열이다.
 */
const NO_AUTH_BRANCH_CATCH_SITES: Readonly<Record<string, { marker: string; reason: string }[]>> = {
  "app/page.tsx": [
    {
      marker: "setWorkerError(",
      reason:
        "워커 상태는 무인증 공개 엔드포인트(GET /health/worker)라 401이 오지 않는다 — " +
        "이 자리에 로그아웃 갈래를 세우면 오지 않는 응답을 다루는 코드가 된다."
    }
  ]
};

function timeoutError(method = "GET"): AdminApiTimeoutError {
  return new AdminApiTimeoutError(new Error("aborted"), method);
}

/** admin-api.ts의 request()가 fetch 거절에 씌우는 그 에러(연결 실패). */
function networkError(): AdminApiError {
  const api = readSource("src/lib/admin-api.ts");
  const message = /throw new AdminApiError\(0, "([^"]+)"\)/.exec(api)?.[1];
  expect(message, "admin-api.ts의 연결 실패 문장을 찾지 못했어요").toBeTruthy();
  return new AdminApiError(0, message as string);
}

describe("조회 실패 한 벌: 네 갈래 (라운드 73 트랙 D ⓑ)", () => {
  it("타임아웃이면 admin-api.ts의 읽기 타임아웃 문장을 그대로 쓴다", () => {
    const error = timeoutError();
    const copy = loadErrorCopy(error, "감사 로그를 불러오지 못했어요.");
    expect(copy.reason).toBe("timeout");
    expect(copy.message).toBe(error.message);
    // 그 문장의 출처는 admin-api.ts 한 곳이다.
    expect(readSource("src/lib/admin-api.ts")).toContain(error.message);
    expect(copy.message).not.toBe("감사 로그를 불러오지 못했어요.");
  });

  it("네트워크 실패면 admin-api.ts의 연결 실패 문장을 그대로 쓴다", () => {
    const error = networkError();
    const copy = loadErrorCopy(error, "상품 링크 목록을 불러오지 못했어요.");
    expect(copy.reason).toBe("network");
    expect(copy.message).toBe(error.message);
    expect(copy.message).toContain("서버에 연결하지 못했어요");
  });

  it("서버가 문장을 줬으면 그 문장을 쓴다(화면이 고쳐 쓰지 않는다)", () => {
    const copy = loadErrorCopy(
      new AdminApiError(400, "행위자 ID는 UUID여야 해요.", "VALIDATION_FAILED"),
      "감사 로그를 불러오지 못했어요."
    );
    expect(copy.reason).toBe("server");
    expect(copy.message).toBe("행위자 ID는 UUID여야 해요.");
  });

  it("그 밖이면 종전 화면별 기본문장이 한 글자도 다르지 않게 남는다", () => {
    const copy = loadErrorCopy(new TypeError("boom"), "대시보드 요약을 불러오지 못했어요.");
    expect(copy.reason).toBe("unknown");
    expect(copy.message).toBe("대시보드 요약을 불러오지 못했어요.");
    // 서버가 상태 코드만 주고 문장이 비었을 때도 기본문장으로 물러선다.
    expect(loadErrorMessage(new AdminApiError(500, "   "), "분석 요약을 불러오지 못했어요.")).toBe(
      "분석 요약을 불러오지 못했어요."
    );
  });

  it("갈래는 이 넷뿐이다", () => {
    expect(loadErrorReason(timeoutError())).toBe("timeout");
    expect(loadErrorReason(networkError())).toBe("network");
    expect(loadErrorReason(new AdminApiError(503, "잠시 후 다시 시도해 주세요."))).toBe("server");
    expect(loadErrorReason("문자열 실패")).toBe("unknown");
  });

  /**
   * 부정 단언: **이 트랙은 문구를 하나도 짓지 않았다.** 네 갈래 전부 admin-api.ts가 이미
   * 만든 문장이거나 호출부가 넘긴 종전 문장이라, 이 모듈 안에 한글 문자열 리터럴이
   * 있을 이유가 없다(주석은 제외 — 판정의 근거는 오히려 길게 적혀 있어야 한다).
   */
  it("한 벌 자신은 한국어 문구를 하나도 갖지 않는다 (새 문구 0건)", () => {
    const source = readSource("src/lib/load-error-copy.ts");
    // 아래 두 목록(소비 자리·예외)은 **판정이 아니라 값과 그 이유**라 한국어가 있어야 한다 —
    // 문구를 짓지 않았다는 단언의 대상은 그 위의 판정 코드다.
    const judgement = source.split("export const LOAD_ERROR_COPY_SITES")[0];
    expect(judgement.length, "판정 부분을 찾지 못했어요").toBeGreaterThan(500);
    const withoutComments = judgement
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    const literals = [...withoutComments.matchAll(/"([^"\\]*)"/g)]
      .map((match) => match[1])
      .filter((value) => /[가-힣]/.test(value));
    expect(literals).toEqual([]);
  });
});

describe("조회 실패 한 벌: [다시 시도]가 서지 않는 실패 (라운드 73 트랙 D ⓒ)", () => {
  it("타임아웃·네트워크 실패에는 다시 시도가 선다 — 다음 번엔 닿을 수 있다", () => {
    expect(loadErrorRetryable(timeoutError())).toBe(true);
    expect(loadErrorRetryable(networkError())).toBe(true);
  });

  it("서버 장애(5xx)와 혼잡(408·425·429)에도 선다", () => {
    for (const status of [500, 502, 503, 408, 425, 429]) {
      expect(loadErrorRetryable(new AdminApiError(status, "오류")), String(status)).toBe(true);
    }
  });

  it("요청 자체가 거절된 4xx에는 서지 않는다 — 다시 눌러도 같은 답이 온다", () => {
    for (const status of [400, 403, 404, 409, 422]) {
      expect(loadErrorRetryable(new AdminApiError(status, "오류")), String(status)).toBe(false);
      expect(loadErrorCopy(new AdminApiError(status, "오류"), "기본").canRetry, String(status)).toBe(false);
    }
  });

  it("모르는 실패에는 한 번 더가 답일 수 있으므로 그대로 선다", () => {
    expect(loadErrorRetryable(new TypeError("boom"))).toBe(true);
  });

  /**
   * 401은 이 한 벌에 닿지 않는다 — 모든 화면의 **첫 갈래**가 로그아웃이고, 그 앞에
   * 아무것도 끼우지 않는다는 것이 이 트랙의 설계 긴장 ⓐ다. 자리마다 그 순서를 확인한다.
   */
  it("401 로그아웃이 여전히 모든 자리의 첫 갈래다 (catch 블록 단위)", () => {
    let checkedBlocks = 0;
    for (const [path, count] of Object.entries(LOAD_ERROR_COPY_SITES)) {
      const source = readSource(path);
      const blocks = catchBlocks(source).filter((block) => /loadError(?:Copy|Message)\(/.test(block));
      // 한 벌을 부르는 자리는 전부 catch 안이다 — 소비 집합의 수와 자리 수가 같아야 한다.
      expect(blocks.length, `${path}: 한 벌을 부르는 catch 블록 수`).toBe(count);

      for (const [index, block] of blocks.entries()) {
        const where = `${path} #${index + 1}`;
        const exempt = (NO_AUTH_BRANCH_CATCH_SITES[path] ?? []).find((entry) => block.includes(entry.marker));
        if (exempt) {
          // 면제는 장식이 아니다 — 그 자리에 401 갈래가 **실제로 없어야** 하고 이유가 적혀 있어야 한다.
          expect(block, `${where}: 면제 자리인데 401 갈래가 있다`).not.toContain("isAuthError(error)");
          expect(exempt.reason.length, `${where}의 면제 이유`).toBeGreaterThan(20);
          checkedBlocks += 1;
          continue;
        }
        const auth = block.indexOf("isAuthError(error)");
        expect(auth, `${where}에 401 갈래가 있다`).toBeGreaterThanOrEqual(0);
        expect(block, `${where}: 401은 세션을 지우고 끝난다`).toContain("clearSession()");
        expect(auth, `${where}: isAuthError → clearSession 앞에 아무것도 끼우지 않는다`).toBeLessThan(
          block.search(/loadError(?:Copy|Message)\(/)
        );
        checkedBlocks += 1;
      }
    }
    expect(checkedBlocks, "확인한 catch 자리 수 = 소비 집합의 합").toBe(
      Object.values(LOAD_ERROR_COPY_SITES).reduce((sum, count) => sum + count, 0)
    );
  });
});

describe("조회 실패 판정의 소비 집합 (라운드 73 트랙 D ⓐ)", () => {
  /**
   * 파생 단언: 목록을 손으로 적어 두는 것이 아니라 `app/**`을 훑어 **실제 호출 자리 수**와
   * 대조한다(모바일 쪽 `messages.test.ts`의 useLoadErrorCopy 스윕과 같은 형태).
   *
   * ⚠️ 잡는 것은 **목록 ↔ 사용 집합의 불일치**다: 부르는데 목록에 없다 · 목록에 있는데 안 부른다 ·
   * 자리 수가 달라졌다. 새 화면이 한 벌을 **아예 부르지 않고** 자기 문장을 손으로 적으면 양쪽이
   * 일치한 채 통과한다 — 새 리터럴을 감지하는 단언이 아니다(known-limitations N-3의 정정).
   */
  it("app/** + src/components/**의 소비 자리 수가 값(LOAD_ERROR_COPY_SITES)과 정확히 일치한다", () => {
    const wired: Record<string, number> = {};
    for (const path of appScreenPaths()) {
      const count = readSource(path).match(/loadError(?:Copy|Message)\(/g)?.length ?? 0;
      if (count > 0) wired[path] = count;
    }
    expect(wired).toEqual({ ...LOAD_ERROR_COPY_SITES });
  });

  /**
   * 라운드 75 트랙 D ⓐ — **범위가 값이다.**
   *
   * 위 파생 단언이 무엇을 보고 무엇을 못 보는지가 이 계약의 절반이다. 라운드 73~74에는
   * 그 범위가 `app/**` 하나였고, 그 사실이 어디에도 값으로 없어서 사각이 **일치한 채**
   * 열 달을 통과했다. 이제 뿌리 목록과 제외 이유가 둘 다 값이고, 어드민의 `.tsx` 전수가
   * 그 둘 중 하나에 속한다(제외한 뿌리에 화면이 생기면 이 줄이 먼저 빨개진다).
   */
  it("스윕 범위가 어드민의 화면 소스 전부를 덮는다 (전수 단언 · 제외 뿌리는 이유와 함께)", () => {
    expect([...SCREEN_SOURCE_ROOTS]).toEqual(["app", "src/components"]);

    // 어드민 루트의 `.tsx` 전수 — 스윕이 걷는 뿌리이거나, 이유가 적힌 제외 뿌리이거나.
    const everyTsx: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (entry.name.endsWith(".tsx")) everyTsx.push(relative(adminRoot, fullPath).split(sep).join("/"));
      }
    };
    walk(adminRoot);
    expect(everyTsx.length, "어드민에 .tsx가 있다").toBeGreaterThan(10);

    const swept = new Set(appScreenPaths());
    for (const path of everyTsx) {
      if (swept.has(path)) continue;
      const root = Object.keys(NON_SCREEN_SOURCE_ROOTS).find((entry) => path.startsWith(`${entry}/`));
      expect(root, `${path}: 스윕 밖인데 이유가 없다`).toBeTruthy();
    }
    for (const [root, reason] of Object.entries(NON_SCREEN_SOURCE_ROOTS)) {
      expect(existsSync(join(adminRoot, ...root.split("/"))), `${root}가 실재한다`).toBe(true);
      expect(reason.length, `${root}의 제외 이유가 비어 있다`).toBeGreaterThan(40);
      expect([...SCREEN_SOURCE_ROOTS], `${root}는 걷는 뿌리가 아니다`).not.toContain(root);
    }

    // 그리고 그 사각에 실제로 화면이 하나 있었다 — 이번 라운드가 더한 자리다.
    expect(swept).toContain("src/components/AdminShell.tsx");
    expect(Object.keys(LOAD_ERROR_COPY_SITES)).toContain("src/components/AdminShell.tsx");
  });

  it("오늘의 자리는 열여섯이다 (라운드 75가 스윕 밖 관문 하나를 더했다)", () => {
    const total = Object.values(LOAD_ERROR_COPY_SITES).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(16);
    // ⚠️ app/**의 열다섯은 한 자리도 늘지도 줄지도 않는다(설계 긴장 ⓐ).
    const appTotal = Object.entries(LOAD_ERROR_COPY_SITES)
      .filter(([path]) => path.startsWith("app/"))
      .reduce((sum, [, count]) => sum + count, 0);
    expect(appTotal).toBe(15);
    expect(LOAD_ERROR_COPY_SITES["src/components/AdminShell.tsx"]).toBe(1);
  });

  /**
   * 종전에 이유를 버린 열 자리. 각 화면의 **기본문장은 그대로**여야 하고(종전과 한 글자도
   * 다르지 않다), 그 문장이 이제 한 벌의 마지막 갈래로만 쓰여야 한다.
   */
  it("열 자리의 기본문장이 종전 그대로 남아 있고, 한 벌을 통해서만 쓰인다", () => {
    const discardedSites: [string, string][] = [
      ["app/page.tsx", "대시보드 요약을 불러오지 못했어요."],
      ["app/page.tsx", "상태를 확인하지 못했어요."],
      ["app/items/page.tsx", "준비템 목록을 불러오지 못했어요."],
      ["app/links/page.tsx", "상품 링크 목록을 불러오지 못했어요."],
      ["app/clicks/page.tsx", "클릭 통계를 불러오지 못했어요."],
      ["app/analytics/page.tsx", "분석 요약을 불러오지 못했어요."],
      ["app/reviews/page.tsx", "검토 목록을 불러오지 못했어요."],
      ["app/reviews/page.tsx", "검토 상세 정보를 불러오지 못했어요."],
      ["app/disclosures/page.tsx", "고지 문구 목록을 불러오지 못했어요."],
      ["app/users/page.tsx", "관리자 계정 목록을 불러오지 못했어요."]
    ];
    expect(discardedSites).toHaveLength(10);
    for (const [path, fallback] of discardedSites) {
      const source = readSource(path);
      expect(source, `${path}: 종전 문장이 그대로 남는다`).toContain(fallback);
      expect(source, `${path}: 그 문장은 한 벌의 마지막 갈래로만 쓰인다`).toMatch(
        new RegExp(`loadError(?:Copy|Message)\\(error, "${fallback}"\\)`)
      );
    }
  });

  /**
   * 형제 넷은 종전에도 타임아웃을 갈랐지만 **각자 지은 문장**이었다 — 같은 실패가 화면마다
   * 다른 등급으로 말해지던 자리다. 이제 그 손 문장들이 사라지고 판정이 한 곳에서 온다.
   */
  it("손으로 지은 타임아웃 **판정 문장**이 app/**에서 사라졌다 (부정 단언 · 화면의 조각은 대상이 아니다)", () => {
    // 라운드 73 후속(적대적 리뷰 ③): 이 부정 단언이 무엇을 겨누는지 좁혀 적는다.
    // 사라져야 하는 것은 **판정을 다시 말하는 문장**("…시간이 너무 오래 걸렸어요")이다 —
    // 같은 사실을 화면마다 다른 등급으로 말하던 자리이고, 그 판정은 이제 한 곳에서 온다.
    // 사라지면 안 되는 것은 **그 화면만 아는 다음 행동**이다. 사용자 조회의 종전 손문장은 둘로
    // 되어 있었고("조회에 시간이 너무 오래 걸렸어요." + "검색어를 좁혀서 다시 시도해 주세요."),
    // 판정 쪽만 공용으로 옮기면서 뒷조각까지 함께 사라졌다 — 그 조각은 판정의 사본이 아니라
    // 부분 일치 검색에서 **실제로 스캔 범위를 줄이는** 행동이라 화면이 아는 것을 잃은 것이었다.
    // 아래에서 그 조각이 공용 문장을 **대체하지 않고 뒤에 얹히는** 형태를 값으로 고정한다.
    const handWrittenTimeoutCopy = [
      "카테고리를 불러오는 데 시간이 너무 오래 걸렸어요",
      "조회에 시간이 너무 오래 걸렸어요"
    ];
    for (const path of appScreenPaths()) {
      const source = readSource(path);
      for (const copy of handWrittenTimeoutCopy) {
        expect(source, `${path}에 ${copy}`).not.toContain(copy);
      }
      // 읽기 타임아웃 문장을 화면이 다시 옮겨 적지 않는다(단일 소스는 admin-api.ts).
      expect(source, `${path}가 타임아웃 문장을 옮겨 적었다`).not.toContain("요청 시간이 초과됐어요(10초)");
    }
    // 그 문장은 여전히 admin-api.ts에 있고, 한 벌이 그것을 읽는다.
    expect(readSource("src/lib/admin-api.ts")).toContain("요청 시간이 초과됐어요(10초)");

    // 사용자 조회의 조각: 타임아웃 갈래에서만, 공용 문장 **뒤에** 붙는다(문장 교체가 아니다).
    const lookup = readSource("app/users-lookup/page.tsx");
    expect(lookup).toContain('const LOOKUP_TIMEOUT_NARROWING_HINT = "검색어를 좁혀서 다시 시도해 주세요.";');
    expect(lookup, "조각은 loadErrorReason의 타임아웃 갈래에만 얹힌다").toMatch(
      /loadErrorReason\(error\) === "timeout"[\s\S]{0,80}\$\{message\} \$\{LOOKUP_TIMEOUT_NARROWING_HINT\}/
    );
    // 다른 갈래는 공용 문장 그대로다 — 조각이 조건 없이 붙지 않는다.
    expect(lookup).toMatch(/\}`\s*:\s*message/);
  });

  it("조회 실패 문장을 화면이 직접 상태에 박아 넣는 자리가 없다 (부정 단언)", () => {
    for (const path of appScreenPaths()) {
      const source = readSource(path);
      expect(source, `${path}: setLoadError에 리터럴을 바로 넣지 않는다`).not.toMatch(/setLoadError\(\s*"/);
      expect(source, `${path}: setDetailError에 리터럴을 바로 넣지 않는다`).not.toMatch(/setDetailError\(\s*"/);
    }
  });

  /**
   * 부르지 않는 자리는 **이유와 함께** 값으로 남는다. 예외가 늘어나면 이 줄이 먼저
   * 빨개지고, 늘린 라운드가 이유를 적게 된다.
   */
  it("한 벌을 부르지 않는 조회 catch는 이유와 함께 목록에 적혀 있다", () => {
    expect(Object.keys(LOAD_ERROR_COPY_EXEMPT_SITES)).toEqual(["app/reviews/page.tsx#worker-health"]);
    for (const [site, reason] of Object.entries(LOAD_ERROR_COPY_EXEMPT_SITES)) {
      const path = site.split("#")[0];
      expect(Object.keys(LOAD_ERROR_COPY_SITES), `${site}의 화면은 목록 안에 있다`).toContain(path);
      expect(reason.length, `${site}의 이유가 비어 있다`).toBeGreaterThan(20);
    }
    // 그 자리는 실패했을 때 아무 말도 하지 않는다 — 화면에 세울 문장이 아예 없다.
    const reviews = readSource("app/reviews/page.tsx");
    expect(reviews).toContain("setWorker(null);");
    expect(reviews).toContain("LOAD_ERROR_COPY_EXEMPT_SITES");
  });
});

describe("[다시 시도] 버튼의 렌더 규칙 (라운드 73 트랙 D ⓒ)", () => {
  /** 조회 실패 배너 아래 [다시 시도]가 서는 열한 자리. */
  const RETRY_BUTTON_SCREENS = [
    "app/page.tsx",
    "app/items/page.tsx",
    "app/links/page.tsx",
    "app/clicks/page.tsx",
    "app/analytics/page.tsx",
    "app/reviews/page.tsx",
    "app/disclosures/page.tsx",
    "app/users/page.tsx",
    "app/categories/page.tsx",
    "app/audit-logs/page.tsx"
  ] as const;

  it("모든 조회 실패 배너의 [다시 시도]가 canRetry에서 파생된다", () => {
    for (const path of RETRY_BUTTON_SCREENS) {
      const source = readSource(path);
      expect(source, `${path}에 다시 시도 버튼이 있다`).toContain("styles.retryButton");
      expect(source, `${path}: 버튼이 판정에서 파생된다`).toContain("loadError.canRetry ? (");
      expect(source, `${path}: 문장도 한 벌에서 온다`).toContain("{loadError.message}");
    }
    // 대시보드의 워커 한 줄도 같은 규칙을 따른다(두 번째 자리).
    expect(readSource("app/page.tsx")).toContain("workerError.canRetry ? (");
  });

  it("[다시 시도]가 없는 자리는 문장만 받는다 (loadErrorMessage)", () => {
    // 검토 상세 · 준비템 분류 · 사용자 조회 · 감사 로그 CSV 내보내기.
    expect(readSource("app/reviews/page.tsx")).toContain('loadErrorMessage(error, "검토 상세 정보를');
    expect(readSource("app/items/page.tsx")).toContain('loadErrorMessage(error, "분류 목록을');
    expect(readSource("app/users-lookup/page.tsx")).toContain('loadErrorMessage(error, "사용자를 조회하지');
    expect(readSource("app/audit-logs/page.tsx")).toContain('loadErrorMessage(error, "CSV 내보내기에');
  });

  /**
   * 설계 긴장 ⓓ: 쓰기 실패 문구는 무접촉이다. R19-F가 근거와 함께 세운
   * `WRITE_TIMEOUT_MESSAGE`("재시도를 권하지 않는다")와 그 갈래는 이 트랙이 만지지 않는다.
   */
  it("쓰기 쪽 판정은 그대로다 (이 트랙은 조회만 만진다)", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("반영 여부가 확실하지 않으니 목록을 새로고침해 확인한 뒤 다시 시도하세요.");
    expect(api).toContain("isRetryUnsafeTimeoutError");
    // 쓰기 타임아웃을 다루는 화면의 갈래도 그대로.
    expect(readSource("app/users/page.tsx")).toContain("isIdempotentTimeoutError(error)");
    expect(readSource("app/categories/page.tsx")).toContain("저장 결과를 확인하지 못했어요.");
  });
});

/**
 * 라운드 75 트랙 D(GAP-075 #4) — **관문 화면이 막다른 길이 아니다.**
 *
 * `MfaSetupScreen`은 처음 로그인한 관리자가 반드시 지나야 하는 관문이고, 어드민 전체가 그
 * 뒤에 있다. 종전에는 `adminMfaSetupStart()`가 실패하면 오류 한 줄만 남고 [다시 시도]가
 * 없었으며, 등록 버튼은 `!secret`이라 눌리지 않았고 QR도 수동 키도 그려지지 않았다 —
 * 읽기 타임아웃 한 번(10초)으로 운영자가 어드민에 못 들어가는 화면에 갇혔다.
 */
describe("MFA 등록 관문의 조회 실패 (라운드 75 트랙 D)", () => {
  const shellPath = "src/components/AdminShell.tsx";

  it("등록 정보 조회가 한 벌을 부르고, 종전 폴백 문장은 바이트 그대로다 (ⓓ)", () => {
    const shell = readSource(shellPath);
    // ⚠️ 종전 문장 그대로 — 서버도 클라이언트도 이유를 못 준 갈래에서만 쓰인다.
    expect(shell).toContain('loadErrorCopy(error, "MFA 등록 정보를 불러오지 못했어요.")');
    // 그 문장이 다른 자리에 또 적혀 있지 않다(한 벌의 마지막 갈래가 유일한 출구다).
    expect((shell.match(/MFA 등록 정보를 불러오지 못했어요\./g) ?? []).length).toBe(1);
    // 화면이 상태에 문장을 직접 박아 넣던 종전 모양은 사라졌다.
    expect(shell).not.toMatch(/setLoadError\(\s*"/);
    expect(shell).not.toContain('setLoadError(error instanceof AdminApiError');
    // 이유는 한 벌이 준 값에서 온다.
    expect(shell).toContain("{loadError.message}");
  });

  it("[다시 시도]가 canRetry에서 파생된다 (ⓒ)", () => {
    const shell = readSource(shellPath);
    expect(shell).toContain("loadError.canRetry ? (");
    // 재시도는 등록 시작 절차를 처음부터 다시 밟는다(이펙트가 그 값을 의존성으로 진다).
    expect(shell).toContain("setReloadKey((key) => key + 1)");
    expect(shell).toMatch(/\}, \[reloadKey\]\);/);
    expect(shell).toContain("const [reloadKey, setReloadKey] = useState(0);");
  });

  /**
   * ⚠️ 새 한국어 문구 0건: 배너 문장은 `admin-api.ts`가 만든 것이거나 종전 폴백이고,
   * 버튼 라벨은 `app/**`의 열한 자리가 **이미 쓰는** 그 문자열이다.
   */
  it("[다시 시도] 라벨이 새 문구가 아니다 (새 한국어 문구 0건)", () => {
    const label = "다시 시도";
    for (const path of ["app/page.tsx", "app/links/page.tsx", "app/audit-logs/page.tsx"]) {
      expect(readSource(path), `${path}의 재시도 버튼 라벨`).toMatch(
        new RegExp(`styles\\.retryButton\\}[\\s\\S]{0,120}?>\\s*${label}\\s*</button>`)
      );
    }
    // 적대적 리뷰 S-6: 라벨만이 아니라 **모양도** 그 열한 자리와 같다. 종전에는 이 자리만
    // `.legacyToggle`(회색 #7a7a7a · 대비 4.29:1로 AA 미달 · 여백 0이라 문장에 붙는다)이었다.
    expect(readSource(shellPath), "셸이 같은 라벨과 같은 클래스를 쓴다").toMatch(
      new RegExp(`styles\\.retryButton\\}[\\s\\S]{0,120}?>\\s*${label}\\s*</button>`)
    );
    // 그 클래스가 셸의 스타일 시트에 실제로 있다(값은 admin-page.module.css에서 그대로 왔고
    // 새 색을 만들지 않았다 — 두 파일이 같은 색을 적는다).
    const shellCss = readSource("src/components/admin-shell.module.css");
    const pageCss = readSource("src/components/admin-page.module.css");
    expect(shellCss).toContain(".retryButton {");
    for (const declaration of ["border: 1px solid #a13030;", "color: #a13030;", "margin-left: 8px;"]) {
      expect(shellCss, `.retryButton의 ${declaration}`).toContain(declaration);
      expect(pageCss, `admin-page.module.css의 ${declaration}`).toContain(declaration);
    }
  });

  /**
   * ⓔ 401 갈래 판정: **로그아웃 첫 갈래가 여기서도 맞다.** 이 화면은 로그인이 끝나고 등록만
   * 남은 자리라 401은 세션이 더 이상 유효하지 않다는 뜻이고, 그 실패에 [다시 시도]를 세우면
   * 같은 401을 몇 번이고 다시 받는다. 그래서 면제 목록에 들어가지 않는다(위 자리별 단언이
   * 순서까지 확인한다 — 여기서는 **면제가 아니라는 사실**을 값으로 고정한다).
   */
  it("401은 여기서도 첫 갈래다 — 면제 목록에 들어가지 않는다 (ⓔ)", () => {
    expect(Object.keys(NO_AUTH_BRANCH_CATCH_SITES)).toEqual(["app/page.tsx"]);
    expect(Object.keys(NO_AUTH_BRANCH_CATCH_SITES)).not.toContain(shellPath);
    const shell = readSource(shellPath);
    expect(shell).toContain("isAuthError(error)");
    expect(shell).toContain("clearSession()");
    // 면제 목록의 값도 그대로다(설계 긴장: 기존 항목 무변경).
    expect(Object.keys(LOAD_ERROR_COPY_EXEMPT_SITES)).toEqual(["app/reviews/page.tsx#worker-health"]);
  });

  /**
   * 설계 긴장 ⓒ: 고쳐지는 것은 **실패했을 때 무엇이 보이는가**뿐이다.
   * 등록 판정·API 호출·QR 생성·수동 키·복구 코드 표시·`finishSetup`·`switchAccount` 무변경.
   */
  it("등록 절차 자체는 한 줄도 바뀌지 않았다", () => {
    const shell = readSource(shellPath);
    expect(shell).toContain("const result = await adminMfaSetupStart();");
    expect(shell).toContain('const QRCode = await import("qrcode");');
    expect(shell).toContain("await QRCode.toDataURL(result.otpauthUrl)");
    expect(shell).toContain('<img src={qrDataUrl} alt="MFA 등록 QR 코드" width={200} height={200} />');
    expect(shell).toContain("QR을 스캔할 수 없다면 인증 앱에 수동 키를 입력해 주세요:");
    // 등록 완료 버튼의 조건은 종전 그대로다 — secret 없이 확인 요청을 보낼 수는 없다.
    expect(shell).toContain("disabled={verifying || !secret}");
    expect(shell).toContain("setRecoveryCodes(result.recoveryCodes);");
    expect(shell).toContain("복구 코드를 저장해 주세요");
    expect(shell).toContain("mfaEnabled: true, mfaRecoveryCodesRemaining: recoveryCodes?.length");
    expect(shell).toContain("다른 계정으로 로그인");
    expect(shell).toContain("임시 비밀번호를 먼저 변경할래요");
  });
});

describe("검토 화면이 워커 상태를 실제로 조회한다 (라운드 73 트랙 D ⓓ)", () => {
  it("getWorkerHealth를 부르고, 문장은 순수 함수 한 자리에서 온다", () => {
    const source = readSource("app/reviews/page.tsx");
    expect(source).toContain("getWorkerHealth");
    expect(source).toContain("schedulingWorkerNote(worker)");
    // 문구를 화면이 짓지 않는다 — worker-health-view.ts가 이미 가진 문장이다.
    expect(source).not.toContain("워커가 꺼져 있어요");
    expect(readSource("src/lib/worker-health-view.ts")).toContain("워커가 꺼져 있어요(WORKER_ENABLED=0)");
  });

  it("예약 게시를 막지 않는다 — 말할 뿐이다", () => {
    const source = readSource("app/reviews/page.tsx");
    // 예약 버튼의 disabled 조건은 종전 그대로(제출 중이거나 시각을 안 골랐을 때만).
    expect(source).toContain("disabled={actionSubmitting || !scheduleAt}");
    expect(source).not.toContain("disabled={actionSubmitting || !scheduleAt || ");
    expect(source).not.toMatch(/schedulingWorkerNote\([^)]*\)\s*\|\|/);
    // 종전 정적 안내도 그대로 남는다.
    expect(source).toContain("WORKER_ENABLED=1");
  });

  it("worker-health-view.ts는 읽기만 한다 (새 상태·새 문장 0건)", () => {
    const view = readSource("src/lib/worker-health-view.ts");
    expect(view).toContain('export type WorkerHealthState = "off" | "stale" | "degraded" | "ok";');
    const stateLabels = /WORKER_HEALTH_STATE_LABELS: Record<WorkerHealthState, string> = \{([^}]*)\}/.exec(view)?.[1];
    expect(stateLabels).toBeTruthy();
    expect([...(stateLabels as string).matchAll(/(\w+):/g)].map((match) => match[1])).toEqual([
      "off",
      "stale",
      "degraded",
      "ok"
    ]);
  });

  it("지난 예약 표시가 목록의 예약 칸에서 순수 함수로 나온다", () => {
    const source = readSource("app/reviews/page.tsx");
    expect(source).toContain("overdueScheduleNote(revision)");
    expect(source).toContain("formatDate(revision.scheduledFor)");
    // 판정은 화면이 아니라 revision-rows.ts에 있다.
    expect(source).not.toContain("scheduledFor < ");
    expect(readSource("src/lib/revision-rows.ts")).toContain("isOverdueScheduledRevision");
  });
});

describe("트랙 D의 무접촉 계약", () => {
  it("admin-api.ts의 문장·타임아웃 값·멱등 판정이 그대로다 (읽기만)", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("DEFAULT_FETCH_TIMEOUT_MS = 10_000");
    expect(api).toContain("WRITE_FETCH_TIMEOUT_MS = 60_000");
    expect(api).toContain("서버에 연결하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.");
    expect(api).toContain("요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    // 한 벌은 admin-api.ts를 부르기만 하고, 반대 방향 의존은 없다.
    expect(api).not.toContain("load-error-copy");
  });

  /**
   * 라운드 75 트랙 D 설계 긴장 ⓑ — **쓰기 실패 다섯은 그대로다.**
   *
   * (라운드 73의 이 자리는 "AdminShell은 이 트랙 밖이다"였다. 그 판정이 바로 후보 4가 센
   * 사각이다 — 셸의 조회 실패 **하나**는 트랙 안이었고, 스윕이 `app/**`만 걸어서 그 사실이
   * 드러나지 않았다. 지금은 그 하나만 안으로 들어오고, 나머지는 종전 모양 그대로다.)
   *
   * R19-F가 근거와 함께 세운 경계는 조회/쓰기다. 셸의 나머지 catch 다섯(비밀번호 변경 ·
   * MFA 해제 · 로그인 · 로그인 2단계 확인 · 인증 코드 확인)은 전부 쓰기이고, 그 자리는
   * **폼 자체가 재시도**라 `AdminApiError.message`를 그대로 보여 주는 종전 모양을 지킨다.
   */
  it("셸의 쓰기 실패 다섯은 종전 모양 그대로다 (조회 하나만 한 벌로 옮겼다)", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect((shell.match(/error instanceof AdminApiError \? error\.message/g) ?? []).length).toBe(5);
    for (const fallback of [
      "비밀번호를 변경하지 못했어요. 다시 시도해 주세요.",
      "2단계 인증을 해제하지 못했어요. 다시 시도해 주세요.",
      "로그인하지 못했어요. 다시 시도해 주세요.",
      "인증하지 못했어요. 다시 시도해 주세요.",
      "인증 코드를 확인하지 못했어요."
    ]) {
      expect(shell, `쓰기 실패 문구: ${fallback}`).toContain(fallback);
    }
    // 한 벌은 조회 자리 하나에만 쓰인다.
    expect((shell.match(/loadError(?:Copy|Message)\(/g) ?? []).length).toBe(1);
    expect(shell).toContain('loadErrorCopy(error, "MFA 등록 정보를 불러오지 못했어요.")');
  });

  it("역할 안내 화면은 조회 실패가 아니라 권한 표시다 (무변경)", () => {
    for (const path of ["app/users/page.tsx", "app/audit-logs/page.tsx", "app/users-lookup/page.tsx"]) {
      expect(readSource(path), path).toContain("관리자(admin) 권한에서만 사용할 수 있어요.");
    }
  });

  /**
   * 라운드 74 적대적 리뷰 E-2 — **"18스텝"이 문장이 아니라 값이 된다.**
   *
   * 아래 앵커 테스트는 화면 쪽 앵커(문구·구조)만 봤고, 스텝이 **몇 개인지**와 **이름·순서가
   * 보존됐는지**는 아무도 세지 않았다. 그런데 라운드 74 트랙 E가 내건 약속이 정확히 그것이다:
   * *"새 스텝은 맨 뒤에 붙고 앞의 열일곱은 이름도 순서도 그대로다"* — 실패 리포트의 스텝
   * 이름으로 과거 실행 기록을 대조하는 규율이라, 이름 하나가 바뀌면 그 대조가 조용히 끊긴다.
   *
   * 그래서 하네스 소스에서 스텝 이름을 **순서대로** 읽어 값과 맞춘다. 브라우저를 띄우지 않는다.
   */
  it("admin-e2e의 스텝이 열여덟이고, 앞의 열일곱은 이름도 순서도 그대로다 (E-2)", () => {
    const harness = readSource(join("..", "..", "scripts", "qa", "admin-e2e.mjs"));
    const stepNames = [...harness.matchAll(/\brunStep\("([^"]+)"/g)].map((match) => match[1]);

    // 라운드 73까지의 열일곱 — 이름도 순서도 이 배열이 값으로 진다.
    const ROUND73_STEPS = [
      "login-mfa-dashboard",
      "dashboard-summary-cards",
      "items-table",
      "links-table-and-bulk-preview",
      "analytics-toggle-and-tables",
      "analytics-onboarding-dropoff-card",
      "users-self-marker",
      "reviews-page-loads",
      "audit-logs-table-and-pagination",
      "audit-logs-action-filter",
      "audit-logs-csv-export",
      "users-lookup-search-and-audit-deeplink",
      "categories-table-and-filter",
      "disclosures-page-loads",
      "clicks-summary-and-range-toggle",
      "mfa-reenroll-entry-point",
      "audit-logs-editor-role-gate"
    ];

    expect(stepNames).toHaveLength(18);
    expect(stepNames.slice(0, ROUND73_STEPS.length)).toEqual(ROUND73_STEPS);
    expect(stepNames.at(-1)).toBe("header-recovery-codes-remaining");
    expect(new Set(stepNames).size).toBe(stepNames.length);

    // 스텝이 SKIP으로 빠지는 두 자리는 runStep을 우회하므로 이름이 **결과 배열에** 따로 실린다.
    // 그 이름이 runStep 쪽 이름과 갈리면 실패 리포트에서 같은 스텝이 둘로 보인다.
    const skipNames = [...harness.matchAll(/results\.push\(\{\s*\n?\s*name: "([^"]+)"/g)].map((m) => m[1]);
    expect(skipNames.sort()).toEqual(["audit-logs-editor-role-gate", "header-recovery-codes-remaining"]);
    for (const name of skipNames) expect(stepNames, `${name}의 SKIP 갈래`).toContain(name);
  });

  it("admin-e2e의 18스텝 앵커가 그대로다", () => {
    const home = readSource("app/page.tsx");
    // 요약 카드는 링크 여부와 상관없이 <article>로 남는다(스텝 2가 8개를 센다).
    expect(home).toContain("scripts/qa/admin-e2e.mjs가 요약 카드를 article로 세고 있어서다.");
    expect((home.match(/<article key=\{card\.key\}/g) ?? []).length).toBe(1);
    const summaryCards = /const SUMMARY_CARDS[^=]*=\s*\[([\s\S]*?)\n\];/.exec(home)?.[1];
    expect([...(summaryCards as string).matchAll(/\{ key:/g)]).toHaveLength(8);

    // 스텝 7(검토 화면)이 기다리는 앵커 셋.
    const reviews = readSource("app/reviews/page.tsx");
    expect(reviews).toContain("해당 상태의 초안이 없어요.");
    expect(reviews).toContain("검토 목록을 불러오지 못했어요.");
    expect(reviews).toContain("<h1>콘텐츠 검토</h1>");

    // 스텝 9·11(감사 로그)·13(고지 문구)·14(클릭 통계)의 배너/빈 상태 문구.
    expect(readSource("app/audit-logs/page.tsx")).toContain("감사 로그를 불러오지 못했어요.");
    expect(readSource("app/audit-logs/page.tsx")).toContain("조건에 맞는 기록이 없어요.");
    expect(readSource("app/disclosures/page.tsx")).toContain("고지 문구 목록을 불러오지 못했어요.");
    expect(readSource("app/clicks/page.tsx")).toContain("클릭 통계를 불러오지 못했어요.");

    // 스텝 13·14는 "불러오는 중..."이 사라지는 것을 로드 완료 신호로 쓴다 —
    // 이 트랙이 그 문자열을 새로 심지 않았다.
    for (const path of ["app/disclosures/page.tsx", "app/clicks/page.tsx"]) {
      expect((readSource(path).match(/불러오는 중\.\.\./g) ?? []).length, path).toBe(1);
    }
  });

  /**
   * 설계 긴장 ⓖ: 서버 0건. 검토 화면이 새로 부르는 것은 **읽기 하나**
   * (무인증 공개 엔드포인트 GET /health/worker)뿐이고, 예약·승인·롤백 쓰기 경로는
   * 종전 그대로다 — 서버의 예약 처리·CAS는 손대지 않는다.
   */
  it("검토 화면이 새로 부르는 것은 읽기 하나뿐이다 (예약 처리·CAS 무접촉)", () => {
    const source = readSource("app/reviews/page.tsx");
    const beforeImportEnd = source.split('} from "../../src/lib/admin-api";')[0];
    const importBlock = beforeImportEnd.slice(beforeImportEnd.lastIndexOf("import {") + "import {".length);
    expect(importBlock).toBeTruthy();
    const imported = (importBlock as string)
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry && !entry.startsWith("type "));
    expect(imported.sort()).toEqual([
      "AdminApiError",
      "approvePublishContentRevision",
      "createIdempotencyKeyHolder",
      "getContentRevision",
      "getWorkerHealth",
      "isAuthError",
      "listContentRevisions",
      "rejectContentRevision",
      "rollbackContentRevision",
      "scheduleContentRevision"
    ]);
    // 워커 조회는 GET 하나다 — 이 화면에 새 쓰기가 생기지 않았다.
    expect(readSource("src/lib/admin-api.ts")).toContain('return request<WorkerHealth>("/health/worker");');
  });
});

/**
 * 라운드 75 적대적 리뷰 채택 — **옛/직접 리터럴 부정 단언 스윕**(모바일 `messages.test.ts`의 대칭).
 *
 * 이 파일의 파생 단언 둘은 "배선해 놓고 목록에 안 적었다"와 "목록에 적어 놓고 배선을 뗐다"를
 * 잡는다. 잡지 못하는 축은 모바일 쪽 라운드 74 D가 이미 이름 붙여 두었다 — **새 화면이 한 벌을
 * 아예 부르지 않고 자기 문장을 손으로 적으면 사용 집합에도 목록에도 없으므로 양쪽이 일치한 채
 * 통과한다.** 어드민에서 실제로 그렇게 통과한 채 살아 있던 자리가 MFA 등록 관문이었다.
 *
 * 그래서 반대 방향의 단언을 여기 세운다. 묻는 것은 둘이다.
 *  ⓐ **한 벌이 하는 일의 손 사본 형태**(`error instanceof AdminApiError ? error.message : "…"`)가
 *    살아 있는 자리는 예외 없이 **이유와 함께 값으로** 적혀 있을 것. 오늘 그 자리는 전부
 *    **쓰기** 실패다(R19-F의 경계 — 조회에 이 형태가 다시 생기면 여기가 먼저 빨개진다).
 *  ⓑ **이미 허용된 리터럴**(각 화면이 한 벌에 넘기는 종전 폴백 문장)은 **기대 출현 수로 고정**.
 *    자리가 하나라도 늘면(= 화면이 그 문장을 손으로 되쓰면) 이 단언이 먼저 빨개진다.
 *
 * ⚠️ 바늘을 파생시키지 못하는 이유도 값이다: 모바일은 공용 상수 한 문장(`LOAD_ERROR_NOTICE`)에서
 * 바늘을 잘라 오지만, 어드민의 폴백은 **화면마다 다른 종전 문장**이고 그것이 라운드 73 트랙 D의
 * 판정(“그 밖이면 종전 화면별 기본문장 그대로”)이다. 공통분모는 어미 한 조각뿐이라 여기서는
 * 그 조각을 바늘로 쓴다.
 */
describe("옛/직접 리터럴 부정 단언 스윕 (모바일 messages.test.ts의 대칭)", () => {
  /** 주석은 걷어낸다 — 이 저장소의 화면 주석은 자기가 무엇을 고쳤는지 설명하려고 옛 문장을 인용한다. */
  const codeOnly = (text: string) =>
    text
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");

  /** 화면별 출현 횟수(코드만 — 0건인 화면은 담지 않는다). */
  const screenPhraseCounts = (phrase: string): Record<string, number> => {
    const found: Record<string, number> = {};
    for (const path of appScreenPaths()) {
      const count = codeOnly(readSource(path)).split(phrase).length - 1;
      if (count > 0) found[path] = count;
    }
    return found;
  };

  /** 한 벌이 하는 일의 **손 사본** 형태. 라운드 73 트랙 D가 열다섯 자리에서 걷어낸 그 모양이다. */
  const HAND_COPIED_SHAPE = "error instanceof AdminApiError ? error.message";

  /** 그 형태가 살아 있는 자리와 이유. 오늘은 한 파일이고, 그 안의 다섯이 전부 **쓰기**다. */
  const HAND_COPIED_SHAPE_OCCURRENCES: Readonly<Record<string, { count: number; reason: string }>> = {
    "src/components/AdminShell.tsx": {
      count: 5,
      reason:
        "다섯 자리 전부 **쓰기** 실패다(비밀번호 변경 · MFA 해제 · 로그인 · MFA 인증 · 등록 코드 확인). " +
        "쓰기 실패의 판정은 R19-F가 근거와 함께 세워 뒀고(WRITE_TIMEOUT_MESSAGE — \"재시도를 권하지 않는다\"), " +
        "그 자리는 폼 자체가 재시도라 조회 한 벌의 대상이 아니다. 같은 파일의 **조회** 한 자리는 " +
        "라운드 75 트랙 D가 이 형태에서 loadErrorCopy로 옮겼다."
    }
  };

  it("ⓐ 손 사본 형태가 살아 있는 자리는 예외 없이 이유와 함께 값으로 적혀 있다", () => {
    const counts = screenPhraseCounts(HAND_COPIED_SHAPE);
    // 그물이 실제로 두 뿌리를 훑고 있다는 증거(빈 답이 조용히 통과하지 않게).
    expect(appScreenPaths().length).toBeGreaterThan(10);
    expect(counts).toEqual(
      Object.fromEntries(Object.entries(HAND_COPIED_SHAPE_OCCURRENCES).map(([path, entry]) => [path, entry.count]))
    );
    for (const [path, entry] of Object.entries(HAND_COPIED_SHAPE_OCCURRENCES)) {
      expect(entry.reason.trim().length, `${path}의 사유가 값으로 남아 있다`).toBeGreaterThan(30);
    }
  });

  it("ⓐ 그 형태가 조회 상태에 다시 들어오지 않는다 (부정 단언)", () => {
    for (const path of appScreenPaths()) {
      const source = codeOnly(readSource(path));
      expect(source, `${path}: 조회 실패 상태에 손 사본을 넣지 않는다`).not.toMatch(
        /set(?:Load|Detail)Error\(\s*error instanceof AdminApiError/
      );
    }
  });

  /**
   * ⓑ 이미 **허용된** 리터럴. 전부 `loadErrorCopy`/`loadErrorMessage`에 넘기는 종전 폴백
   * 문장이거나(라운드 73 트랙 D: "그 밖이면 종전 화면별 기본문장 그대로") 오류 경계의 제목이다.
   */
  const FALLBACK_PHRASE = "불러오지 못했어요";

  const FALLBACK_PHRASE_OCCURRENCES: Readonly<Record<string, number>> = {
    "app/analytics/page.tsx": 1,
    "app/audit-logs/page.tsx": 1,
    "app/categories/page.tsx": 1,
    "app/clicks/page.tsx": 1,
    "app/disclosures/page.tsx": 1,
    "app/error.tsx": 1,
    "app/items/page.tsx": 1,
    "app/links/page.tsx": 1,
    "app/page.tsx": 1,
    "app/reviews/page.tsx": 2,
    "app/users/page.tsx": 1,
    "src/components/AdminShell.tsx": 1
  };

  /** 한 벌의 소비 자리가 아닌데 그 어미를 쓰는 곳과 그 이유. */
  const FALLBACK_PHRASE_NON_SITE_SCREENS: Readonly<Record<string, string>> = {
    "app/error.tsx":
      "Next의 오류 경계 화면 제목이다(\"화면을 불러오지 못했어요\"). 이 자리는 조회 실패가 아니라 " +
      "렌더 자체가 던진 예외를 받는 곳이라 AdminApiError가 없고, 한 벌이 물어볼 상태 코드도 없다."
  };

  it("ⓑ 허용된 폴백 문장의 화면별 출현 수가 값과 정확히 일치한다", () => {
    expect(screenPhraseCounts(FALLBACK_PHRASE)).toEqual(FALLBACK_PHRASE_OCCURRENCES);
  });

  it("ⓑ 그 문장을 쓰는 화면은 소비 목록 안이거나, 밖인 이유가 값으로 적혀 있다", () => {
    for (const [path, count] of Object.entries(FALLBACK_PHRASE_OCCURRENCES)) {
      if (Object.hasOwn(FALLBACK_PHRASE_NON_SITE_SCREENS, path)) {
        expect(
          FALLBACK_PHRASE_NON_SITE_SCREENS[path].trim().length,
          `${path}가 소비 목록 밖인 이유`
        ).toBeGreaterThan(30);
        expect(Object.keys(LOAD_ERROR_COPY_SITES), `${path}는 소비 목록 밖이다`).not.toContain(path);
        continue;
      }
      expect(Object.keys(LOAD_ERROR_COPY_SITES), `${path}는 소비 목록 안이다`).toContain(path);
      // 폴백 문장은 자리 하나당 하나다 — 자리 수보다 많으면 화면이 그 문장을 되쓰고 있다.
      expect(count, `${path}의 폴백 문장 수가 소비 자리 수를 넘지 않는다`).toBeLessThanOrEqual(
        LOAD_ERROR_COPY_SITES[path]
      );
    }
  });
});
