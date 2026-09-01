import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

/** admin-api.ts의 request()가 fetch 거절에 씌우는 그 에러(연결 실패).
 * ⚠️ 꼬리를 `[,)]`로 여는 이유: 라운드 77 리뷰 P-2가 그 throw에 `CONNECTION_FAILURE_CODE`
 * 하나를 더했다(술어가 status 0이 아니라 code를 읽게 하려고). 이 헬퍼가 읽는 것은
 * **문장**이고 그것은 바이트 불변이다 — 인자 수가 아니라 그 문장이 이 그물의 단위다. */
function networkError(): AdminApiError {
  const api = readSource("src/lib/admin-api.ts");
  const message = /throw new AdminApiError\(0, "([^"]+)"[,)]/.exec(api)?.[1];
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

/**
 * 라운드 93 트랙 D(GAP-093 #4) — **[다시 시도] 관례의 모집단이 전수가 된다.**
 *
 * ⚠️⚠️ **두 시점 — 이 절의 모집단은 손 목록이었다.**
 *  · **라운드 73~92 시점**: 이 자리에는 `RETRY_BUTTON_SCREENS`라는 **손으로 적은 경로 열 줄**이
 *    있었고, 그 위의 주석은 *"조회 실패 배너 아래 [다시 시도]가 서는 **열한 자리**"* 라고 적었다.
 *    ⚠️ **그 두 수는 서로 갈려 있었고 둘 다 참일 수 있었다** — *열*은 [다시 시도]가 선
 *    **화면(`page.tsx`)** 의 수였고, *열하나*는 `app/**`의 `styles.retryButton` **출현** 수였다
 *    (대시보드가 배너를 둘 세운다). **두 수를 한 낱말로 적지 않는다.** 그리고 모집단이 손
 *    목록이었으므로 **조회 실패 배너를 [다시 시도] 없이 세운 열두 번째 화면은 조용히 통과했다.**
 *  · **오늘(라운드 93 트랙 D)**: 모집단이 `app/**`의 `page.tsx` **전수 걷기**다(오늘 **11** ·
 *    하한). 자리마다 판정 하나를 소스에서 낸다 — *[다시 시도]가 선다*(오늘 **10**) ·
 *    *문장만 받는다 + 이유*(오늘 **하나** · `users-lookup`). **손 목록은 없다.**
 *
 * ⚠️ **어드민 소스 0바이트** — 이 트랙이 만든 것은 **세는 자 하나**이고 화면·컴포넌트·`lib`은
 * 한 바이트도 고치지 않았다(아래 ⓔ가 그것을 값으로 문다).
 *
 * ⚠️ **재개 조건(결정형 · 축: 이 파일의 *다른* 손 목록)**: 같은 파일의 `discardedSites`(열)와
 * `FALLBACK_PHRASE_OCCURRENCES`(열둘)도 손으로 적은 모집단이다 — **한 트랙이 한 축을 진다**는
 * 규율 때문에 이 라운드는 열지 않았다. 그 둘을 누가 전수 파생으로 옮기는지가 정해지는 날 재개한다.
 */

/** 오늘의 전수(하한 · 래칫). ⚠️ **줄지 않는다** — 화면이 늘면 이 수를 올려 적는다. */
const PAGE_ENTRY_FLOOR = 11;
/** [다시 시도]가 선 **화면** 수(하한 · 래칫). ⚠️ **줄지 않는다.** */
const RETRY_SCREEN_FLOOR = 10;
/** 배너를 세우고도 판정에서 파생하지 않는 화면 — **0을 넘지 않는다**(상한). */
const UNDERIVED_BANNER_CEILING = 0;

/**
 * 판정을 내는 바늘 셋. ⚠️ 이 셋에는 **한국어 문장이 없다** — 문구가 옳은지는 이 자가 묻지
 * 않는다(아래 사각 ⓓ가 그 사실을 값으로 잰다).
 */
const RETRY_NEEDLES = ["styles.retryButton", "loadError.canRetry ? (", "{loadError.message}"] as const;

/**
 * `app/**`의 `page.tsx` 전수(뿌리 기준 POSIX 경로 · 정렬). ⚠️ **뿌리를 인자로 받는다** —
 * 아래 픽스처가 이 자를 실제로 잰다(걷기가 유령이면 부정 단언이 전부 조용해진다).
 *
 * ⚠️ `admin-route-surface.test.ts`(라운드 92 C)가 같은 사실을 자기 축으로 파생한다. **사본을
 * 만들지 않고 각자 파생한다** — 사본이면 두 자리가 조용히 갈린다.
 */
function pageEntryPaths(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.name !== "page.tsx") continue;
      found.push(relative(root, fullPath).split(sep).join("/"));
    }
  };
  walk(join(root, "app"));
  return found.sort();
}

/**
 * 한 화면의 판정. 넷 중 하나이고, **전수가 정확히 이 넷으로 나뉜다**(빠지는 자리가 없다).
 *  · `retry` — 조회 실패 배너 아래 [다시 시도]가 서고, 그 버튼과 문장이 **판정에서 파생**한다.
 *  · `message-only` — [다시 시도]가 없고 한 벌의 **문장만** 받는다(이유가 값으로 있어야 한다).
 *  · `underived-banner` — ⚠️ 배너는 있는데 판정에서 파생하지 않는다(**오늘 0건 · 상한**).
 *  · `no-load-failure` — 조회 실패를 아예 그리지 않는다(오늘 0건 · 서는 날 이유를 적는다).
 */
type RetryVerdict = "retry" | "message-only" | "underived-banner" | "no-load-failure";

function retryVerdictOf(source: string): RetryVerdict {
  const retryButtons = (source.match(/styles\.retryButton/g) ?? []).length;
  const derivedBanners = (source.match(/\.canRetry \? \(/g) ?? []).length;
  const callsCopySet = /loadError(?:Copy|Message)\(/.test(source);
  if (retryButtons > 0) {
    // 배너가 여럿이면 **하나도 빠짐없이** 판정에서 나와야 한다(대시보드의 워커 줄이 그 자리다).
    if (derivedBanners < retryButtons) return "underived-banner";
    for (const needle of RETRY_NEEDLES) if (!source.includes(needle)) return "underived-banner";
    return "retry";
  }
  return callsCopySet ? "message-only" : "no-load-failure";
}

type RetryScan = {
  readonly paths: string[];
  readonly byVerdict: Record<RetryVerdict, string[]>;
  /** 화면별 `styles.retryButton` **출현** 수 — 자리(화면)와 다른 수다. */
  readonly retryButtonOccurrences: Record<string, number>;
};

function scanRetryVerdicts(root: string): RetryScan {
  const byVerdict: Record<RetryVerdict, string[]> = {
    retry: [],
    "message-only": [],
    "underived-banner": [],
    "no-load-failure": []
  };
  const retryButtonOccurrences: Record<string, number> = {};
  const paths = pageEntryPaths(root);
  for (const path of paths) {
    const filePath = join(root, ...path.split("/"));
    if (!existsSync(filePath)) throw new Error(`${path}를 읽지 못했어요`);
    const source = readFileSync(filePath, "utf8");
    byVerdict[retryVerdictOf(source)].push(path);
    const occurrences = (source.match(/styles\.retryButton/g) ?? []).length;
    if (occurrences > 0) retryButtonOccurrences[path] = occurrences;
  }
  return { paths, byVerdict, retryButtonOccurrences };
}

let retryScanCache: RetryScan | null = null;
/** 저장소를 한 번만 걷는다(모듈 최상단에서 `expect`를 부르지 않으려고 지연 계산한다). */
function retryScan(): RetryScan {
  if (!retryScanCache) retryScanCache = scanRetryVerdicts(adminRoot);
  return retryScanCache;
}

/**
 * **[다시 시도]가 서지 않는 자리와 그 이유.** ⚠️ 결함 목록이 아니라 **판정**이다 —
 * 예외가 늘면 아래 단언이 먼저 빨개지고, 늘린 라운드가 이유를 적게 된다
 * (`LOAD_ERROR_COPY_EXEMPT_SITES`·`NON_SCREEN_SOURCE_ROOTS`와 같은 관례).
 */
const RETRY_ABSENT_REASONS: Readonly<Record<string, string>> = {
  "app/users-lookup/page.tsx":
    "검색형 화면이라 **조회 폼 자체가 재시도**다 — 실패한 요청은 사용자가 방금 입력한 검색어에 매여 " +
    "있고, 같은 요청을 다시 보내는 버튼은 폼의 [검색]과 같은 것이 되어 한 자리를 둘로 그리게 된다. " +
    "그래서 이 자리는 `loadErrorMessage`로 **문장만** 받아 `styles.errorBanner`에 세운다. " +
    "⚠️ **결함이 아니라 판정이다** — 아래 `it`이 그 자리를 이름으로 이미 적고 있었다."
};

describe("[다시 시도] 버튼의 렌더 규칙 (라운드 73 트랙 D ⓒ · 라운드 93 트랙 D: 모집단이 전수가 된다)", () => {
  it("ⓐ 모집단이 손 목록이 아니라 app/**의 page.tsx 전수 걷기다 (오늘 11 · 하한)", () => {
    const scan = retryScan();
    expect(scan.paths.length, "page.tsx 전수가 하한 아래로 내려갔어요").toBeGreaterThanOrEqual(PAGE_ENTRY_FLOOR);
    // 걷기가 실제로 파일에서 나온다(유령 방지 — 0이면 아래 부정 단언이 전부 조용해진다).
    for (const path of scan.paths) {
      expect(path, `${path}: 걷기가 app/** 밖을 집었어요`).toMatch(/^app\/(?:.+\/)?page\.tsx$/);
    }
    expect(scan.paths, "손 목록에 없던 열한째가 모집단 안이다").toContain("app/users-lookup/page.tsx");
    expect(scan.paths).toContain("app/page.tsx");

    // 판정 넷이 전수를 남김없이 덮는다 — 어느 화면도 판정 없이 빠져나가지 않는다.
    const judged = Object.values(scan.byVerdict).reduce((sum, paths) => sum + paths.length, 0);
    expect(judged, "판정이 전수를 덮지 못했어요").toBe(scan.paths.length);

    // ⚠️ 그리고 이 절에 **손 목록이 다시 서지 않는다**(라운드 93 트랙 D가 걷어낸 그 모양).
    // 바늘을 조각으로 잇는 이유: 통짜로 적으면 이 줄 자신이 그 바늘에 걸려 늘 빨갛다.
    const handListNeedle = ["const RETRY", "_BUTTON_SCREENS = ["].join("");
    expect(readSource("src/admin-load-error-copy.test.ts"), "손 목록이 다시 섰어요").not.toContain(handListNeedle);
  });

  it("ⓑ 판정 하나 — [다시 시도]가 선다: 버튼도 문장도 canRetry에서 파생된다 (오늘 10 · 하한)", () => {
    const scan = retryScan();
    expect(scan.byVerdict.retry.length, "[다시 시도]가 선 화면 수가 하한 아래로 내려갔어요").toBeGreaterThanOrEqual(
      RETRY_SCREEN_FLOOR
    );
    for (const path of scan.byVerdict.retry) {
      const source = readSource(path);
      for (const needle of RETRY_NEEDLES) {
        expect(source, `${path}: 판정의 바늘 \`${needle}\``).toContain(needle);
      }
    }
    // 대시보드의 워커 한 줄도 같은 규칙을 따른다(한 화면의 두 번째 배너 — 사각 ⓑ).
    expect(readSource("app/page.tsx")).toContain("workerError.canRetry ? (");
  });

  it("ⓑ 판정 둘 — 문장만 받는 자리는 이유와 함께 값으로 적혀 있다 (오늘 하나 · users-lookup)", () => {
    const scan = retryScan();
    expect(scan.byVerdict["message-only"], "손 목록에 없던 열한째의 판정").toContain("app/users-lookup/page.tsx");
    for (const path of scan.byVerdict["message-only"]) {
      const reason = RETRY_ABSENT_REASONS[path];
      expect(reason, `${path}: [다시 시도]가 없는데 이유가 없어요`).toBeTruthy();
      expect(reason.trim().length, `${path}의 이유가 짧아요`).toBeGreaterThan(40);
      const source = readSource(path);
      expect(source, `${path}: 문장만 받는 자리에 버튼이 생겼어요`).not.toContain("styles.retryButton");
      expect(source, `${path}: 문장은 한 벌에서 온다`).toMatch(/loadErrorMessage\(error, "/);
    }
    // 낡은 이유가 남지 않는다 — 목록의 모든 열쇠가 오늘의 전수 안에 실재하고, 오늘도 그 판정이다.
    for (const path of Object.keys(RETRY_ABSENT_REASONS)) {
      expect(scan.paths, `${path}: 이유는 있는데 화면이 없어요`).toContain(path);
      expect(
        [...scan.byVerdict["message-only"], ...scan.byVerdict["no-load-failure"]],
        `${path}: 이제 [다시 시도]가 서는데 이유가 남아 있어요`
      ).toContain(path);
    }
  });

  it("ⓑ 셋째 판정은 0건이다 — 배너를 세우고 판정에서 파생하지 않는 화면 (부정 단언 · 상한)", () => {
    const scan = retryScan();
    expect(scan.byVerdict["underived-banner"], "배너가 판정에서 파생하지 않는 화면이 생겼어요").toEqual([]);
    expect(scan.byVerdict["underived-banner"].length).toBeLessThanOrEqual(UNDERIVED_BANNER_CEILING);
    // 조회 실패를 아예 그리지 않는 `page.tsx`도 오늘 0건이다 — 서는 날 이 줄이 먼저 빨개지고,
    // 그 라운드가 `RETRY_ABSENT_REASONS`에 *왜 이 화면은 조회 실패가 없는가*를 적게 된다.
    expect(scan.byVerdict["no-load-failure"], "조회 실패를 그리지 않는 page.tsx가 생겼어요").toEqual([]);
  });

  it("ⓔ 이 트랙은 어드민 소스를 0바이트 고쳤다 (부정 단언)", () => {
    // ⚠️ 이 단언이 재는 것은 **이 트랙의 손자국이 화면에 없다**는 것이다: 라운드 93은 세는 자만
    // 세웠으므로 어드민 소스 어디에도 이 라운드의 표식이 없어야 한다(있으면 화면을 고친 것이다).
    const scan = retryScan();
    for (const path of [...scan.paths, "src/components/AdminShell.tsx", "src/lib/load-error-copy.ts"]) {
      const source = readSource(path);
      expect(source, `${path}에 라운드 93의 손자국이 있어요`).not.toContain("라운드 93");
      expect(source, `${path}에 GAP-093의 손자국이 있어요`).not.toContain("GAP-093");
    }
    // 그리고 이 트랙이 읽기만 한 본보기(라운드 92 C)도 이 라운드가 고치지 않았다.
    expect(readSource("src/admin-route-surface.test.ts"), "라운드 92 C의 계약을 이 트랙이 고쳤어요").not.toContain(
      "라운드 93"
    );
  });

  it("⚠️ 걷기가 유령이 아니다 — 픽스처의 새 page.tsx를 이 자가 실제로 센다", () => {
    const base = mkdtempSync(join(tmpdir(), "wooriai-retry-population-"));
    try {
      mkdirSync(join(base, "app", "새화면"), { recursive: true });
      mkdirSync(join(base, "app", "deep", "nested"), { recursive: true });
      writeFileSync(join(base, "app", "page.tsx"), "export default function Page() { return null; }\n");
      writeFileSync(join(base, "app", "새화면", "page.tsx"), "export default function Page() { return null; }\n");
      writeFileSync(join(base, "app", "deep", "nested", "page.tsx"), "export default function Page() { return null; }\n");
      // 바늘 밖 진입(라운드 92 C가 이름 붙인 경계)과 화면 아닌 파일은 세지 않는다.
      writeFileSync(join(base, "app", "error.tsx"), "export default function Error() { return null; }\n");
      writeFileSync(join(base, "app", "layout.tsx"), "export default function Layout() { return null; }\n");

      const walked = pageEntryPaths(base);
      expect(walked).toEqual(["app/deep/nested/page.tsx", "app/page.tsx", "app/새화면/page.tsx"]);
      expect(walked, "page.tsx가 아닌 진입을 셌어요").not.toContain("app/error.tsx");

      // 그리고 판정 자체 — 넷이 실제로 갈린다(순수 판정).
      const scanned = scanRetryVerdicts(base);
      expect(scanned.byVerdict["no-load-failure"]).toEqual(walked);
      expect(retryVerdictOf('styles.retryButton loadError.canRetry ? ( {loadError.message}')).toBe("retry");
      expect(retryVerdictOf('setSearchError(loadErrorMessage(error, "…"))')).toBe("message-only");
      // ⚠️ 배너는 있는데 판정에서 파생하지 않는 모양 — 오늘 저장소에 0건인 그 셋째 판정.
      expect(retryVerdictOf('<button className={styles.retryButton}>다시 시도</button>')).toBe("underived-banner");
      // 배너 둘 중 하나만 판정에서 나와도 셋째다(대시보드 모양의 반쪽).
      expect(
        retryVerdictOf(
          'styles.retryButton loadError.canRetry ? ( {loadError.message} styles.retryButton'
        )
      ).toBe("underived-banner");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  /**
   * ⓕ **사각** — 못 보는 것을 값·이유·재개 조건으로 적는다(AD-5 · 옆 파일
   * `admin-route-surface.test.ts`·`admin-landmark-current.test.ts`의 관례 그대로).
   *
   * ⚠️ **자는 진짜 자여야 한다**(라운드 91 리뷰 L-6): 상수를 돌려주는 자는 저장소가 통째로
   * 바뀌어도 조용하다. 아래 넷은 전부 걷기·소스에서 값을 낸다.
   *
   * ⚠️⚠️ **두 시점(라운드 93 리뷰 L-4) — 위 문장은 넷 가운데 셋에만 참이었다.** `copy-correctness`의
   * 자(`measure`)는 걷지도 읽지도 않고 **이 파일의 상수 `RETRY_NEEDLES`(:457)를 센다.** 그 사실을
   * 숨기지 않고 여기 적는다. ⚠️ **그런데 이 하나는 그래도 되는 자다** — 그 사각이 묻는 것이
   * *"저장소가 어떤가"* 가 아니라 **"이 계약의 판정 바늘에 한국어가 들어갔는가"** 이고, 그 바늘은
   * 정확히 그 상수이기 때문이다(:500의 판정이 같은 상수를 쓴다 — **인용한 사본이 아니라 그 자신**).
   * 나머지 셋과 갈리는 것은 **모집단이지 규율이 아니다**: 셋은 저장소를 재고 하나는 이 계약을 잰다.
   * ⚠️ **재개 조건(사건형): 판정 바늘이 이 파일 밖으로 나가는 날**(공용 상수가 되거나 제품 소스에서
   * 파생되는 날) — 그날 이 자도 걷기가 되어야 하고, 첫 모집단은 오늘의 세 바늘이다.
   */
  type RetryBlindSpot = {
    readonly key: string;
    readonly reason: string;
    readonly measure: () => number;
    readonly today: number;
    readonly resumeCondition: string;
  };

  const RETRY_BLIND_SPOTS: readonly RetryBlindSpot[] = [
    {
      key: "page-only-needle",
      reason:
        "바늘은 `page.tsx` 하나다 — `error.tsx`·`global-error.tsx`·`not-found.tsx`(오늘 3)는 라우트 " +
        "진입이지만 주소를 만들지 않아 이 바늘 밖이고, 그 경계는 **라운드 92 C가 " +
        "`admin-route-surface.test.ts`의 `NON_PAGE_ENTRY_NAMES`로 이미 이름 붙였다**(발명이 아니라 인용). " +
        "그 셋 중 `app/error.tsx`는 *\"화면을 불러오지 못했어요\"* 를 실제로 그리는데, [다시 시도] 관례는 " +
        "그 자리를 보지 않는다 — 그 화면의 재시도는 Next가 주는 `reset()`이라 `canRetry` 판정이 없다",
      measure: () =>
        ["error.tsx", "global-error.tsx", "not-found.tsx"].filter((name) =>
          existsSync(join(adminRoot, "app", name))
        ).length,
      today: 3,
      resumeCondition:
        "재개 조건(사건형): `error.tsx` 계열이 `canRetry` 꼴의 판정을 쓰기 시작하는 날 — 그날 이 " +
        "계약의 모집단은 `page.tsx` 전수에서 *배너를 세우는 진입* 전수로 넓어져야 한다"
    },
    {
      key: "second-banner-per-screen",
      reason:
        "**자리는 화면 단위이고 배너 단위가 아니다.** 대시보드는 조회 실패 배너를 둘 세우는데" +
        "(요약 · 워커 한 줄) 이 자는 그 화면을 **하나로** 센다 — 그래서 *열*(화면)과 " +
        "*열하나*(`styles.retryButton` 출현)가 갈리고, 라운드 73~92의 손 목록과 그 주석이 정확히 " +
        "그 두 수를 한 낱말로 적어 서로 갈려 있었다. 이 자가 재는 것은 **그 차이 자체**다",
      measure: () => {
        const scan = retryScan();
        const occurrences = Object.values(scan.retryButtonOccurrences).reduce((sum, count) => sum + count, 0);
        return occurrences - Object.keys(scan.retryButtonOccurrences).length;
      },
      today: 1,
      resumeCondition:
        "재개 조건(사건형): 한 화면이 배너를 셋 세우거나 두 화면이 둘씩 세우는 날 — 그날 이 수가 1을 " +
        "벗어나고, 자리의 단위를 화면에서 배너로 내릴지 결정해야 한다(내리면 위 하한 둘이 함께 바뀐다)"
    },
    {
      key: "source-not-browser",
      reason:
        "**소스 대조이지 브라우저가 아니다**(#130 계열). 이 자가 아는 것은 *그 문자열이 그 파일에 " +
        "있다*까지이고, 실패했을 때 그 버튼이 **실제로 그려지는가**는 묻지 않는다 — 조건이 거짓인 " +
        "가지 안에 있어도 초록이다. 그 축은 `scripts/qa/admin-e2e.mjs`가 브라우저로 진다",
      // ⚠️ 바늘을 조각으로 잇는다 — 통짜 리터럴로 적으면 이 자가 **자기 자신**을 세어 늘 1 이상이 된다.
      measure: () => {
        const self = readSource("src/admin-load-error-copy.test.ts");
        return ["@testing" + "-library", "play" + "wright", "js" + "dom"].filter((needle) => self.includes(needle))
          .length;
      },
      today: 0,
      resumeCondition:
        "재개 조건(결정형 · 손은 저장소 안): 어드민에 컴포넌트 렌더 하네스가 서는 날 — 그날 이 수가 " +
        "0을 벗어나고, [다시 시도]의 *그려짐*을 소스 대조가 아니라 렌더로 물을 수 있게 된다"
    },
    {
      key: "copy-correctness",
      reason:
        "**문장이 옳은지는 이 자가 묻지 않는다.** 판정의 바늘 셋에는 한국어가 한 글자도 없고" +
        "(`styles.retryButton`·`loadError.canRetry ? (`·`{loadError.message}`), 배너 문장이 그 화면에 " +
        "맞는 말인지는 이 파일의 **다른 절**(네 갈래 · 폴백 문장 스윕)이 이미 진다. 이 자에게 " +
        "[다시 시도]는 **모양**이지 문구가 아니다",
      // ⚠️⚠️ **이 자는 걷지 않는다 — 이 계약의 상수 `RETRY_NEEDLES`(:457)를 센다**(라운드 93
      // 리뷰 L-4가 위 머리말과 이 줄을 두 시점으로 맞췄다). 그래도 되는 이유는 **묻는 것이
      // 저장소가 아니라 이 계약의 판정 바늘이기 때문**이고, 그 바늘은 사본이 아니라 :500의
      // 판정이 실제로 쓰는 **그 상수 자신**이다. 아래 두 줄이 그 사실을 값으로 못 박는다.
      measure: () => {
        // 유령 방지 — 바늘이 비어 있으면 이 자는 아무것도 세지 않고 늘 0이 된다.
        expect(RETRY_NEEDLES.length, "판정 바늘이 비어 있으면 이 자는 뜻이 없어요").toBeGreaterThan(0);
        return RETRY_NEEDLES.filter((needle) => /[가-힣]/.test(needle)).length;
      },
      today: 0,
      resumeCondition:
        "재개 조건(사건형): 판정의 바늘에 한국어가 처음 들어가는 날 — 그날 이 자는 모양이 아니라 문구를 " +
        "묻기 시작한 것이고, 그 축이 이 파일의 다른 절과 겹치는지 먼저 확인해야 한다"
    },
    {
      // ⚠️ 라운드 93 리뷰(L-5)가 값으로 적은 한 줄 — **바늘의 파일 이름 좁힘**.
      key: "page-entry-name-narrowed-to-tsx",
      reason:
        "**걷기가 무는 이름은 `page.tsx` 하나다**(`pageEntryPaths`의 `entry.name !== \"page.tsx\"`). " +
        "Next는 라우트 진입을 `page.ts`·`page.jsx`·`page.js`로도 받으므로, 진입 하나가 그 이름으로 " +
        "서면 이 계약은 빨개지지 않고 **그냥 못 본다** — 오차의 방향은 조용한 쪽(거짓 초록)이다. " +
        "⚠️ **오늘 그 실피해는 0건이다**: `app/**`에 `page.tsx`가 아닌 `page.*`가 한 파일도 없고, " +
        "아래 자가 그 0을 트리에서 다시 센다. **0인 것은 규율이 아니라 오늘의 값이다.** " +
        "⚠️ 위 `page-only-needle`과 다른 사각이다 — 그쪽은 *`page`가 아닌 진입 이름*(`error.tsx` 계열)을 " +
        "말하고 이쪽은 *`page`인데 확장자가 다른 것*을 말한다(두 수를 한 낱말로 적지 않는다)",
      measure: () => {
        const found: string[] = [];
        const walk = (dir: string): void => {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              walk(fullPath);
              continue;
            }
            if (!/^page\.[a-z]+$/.test(entry.name) || entry.name === "page.tsx") continue;
            found.push(relative(adminRoot, fullPath).split(sep).join("/"));
          }
        };
        walk(join(adminRoot, "app"));
        return found.length;
      },
      today: 0,
      resumeCondition:
        "재개 조건(사건형): `app/**`에 `page.tsx`가 아닌 `page.*`가 처음 서는 날 — 그날 이 수가 0을 " +
        "벗어나고, 걷기의 이름 바늘을 확장자까지 넓힐지(넓히면 `admin-route-surface.test.ts`의 같은 " +
        "사실도 함께 넓혀야 한다) 그 라운드가 판단해야 한다"
    }
  ];

  it("ⓕ 사각마다 이유와 재개 조건이 있다 (빈 이유 금지 · 최소 넷)", () => {
    expect(RETRY_BLIND_SPOTS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(RETRY_BLIND_SPOTS.map((spot) => spot.key)).size).toBe(RETRY_BLIND_SPOTS.length);
    for (const spot of RETRY_BLIND_SPOTS) {
      expect(spot.reason.length, `${spot.key}: 이유가 비어 있어요`).toBeGreaterThan(40);
      expect(spot.resumeCondition.length, `${spot.key}: 재개 조건이 비어 있어요`).toBeGreaterThan(20);
      expect(spot.resumeCondition, `${spot.key}: 재개 조건이 형을 밝히지 않았어요`).toMatch(/재개 조건\((사건형|결정형)/);
    }
  });

  it("ⓕ 사각의 값이 오늘도 그대로다 (유령 사각 금지)", () => {
    for (const spot of RETRY_BLIND_SPOTS) {
      expect(spot.measure(), `${spot.key}: 오늘 다시 잰 값이 갈렸어요`).toBe(spot.today);
    }
  });

  it("ⓕ 사각 ⓐ의 경계는 발명이 아니라 인용이다 (라운드 92 C가 이름 붙였다)", () => {
    const routeSurface = readSource("src/admin-route-surface.test.ts");
    expect(routeSurface, "라운드 92 C의 경계 이름").toContain("NON_PAGE_ENTRY_NAMES");
    for (const name of ["error.tsx", "global-error.tsx", "not-found.tsx"]) {
      expect(routeSurface, `${name}이 그 경계 안에 이름으로 있다`).toContain(name);
      expect(existsSync(join(adminRoot, "app", name)), `app/${name}이 실재한다`).toBe(true);
    }
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
   * 버튼 라벨은 `app/**`이 **이미 쓰는** 그 문자열이다.
   *
   * ⚠️ **두 시점 — 이 줄은 *"`app/**`의 열한 자리"* 라고 적었다**(라운드 93 트랙 D의 정정).
   *  · **라운드 75 시점**: *열하나*는 `app/**`의 `styles.retryButton` **출현** 수였다. 같은 날
   *    윗 절의 손 목록은 **열 줄**이었고, 그 위 주석도 *"열한 자리"* 라고 적었다 — 한 낱말이
   *    두 수를 가리키고 있었다.
   *  · **오늘**: 출현은 여전히 **열하나**이고 화면은 **열**이다(대시보드가 배너를 둘 세운다).
   *    **두 수를 한 낱말로 적지 않는다** — 윗 절의 전수 걷기가 그 둘을 각각 값으로 지고,
   *    그 차이는 사각 `second-banner-per-screen`이 오늘도 다시 잰다.
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
    // 요약 카드는 링크 여부와 상관없이 <article>로 남는다(스텝 2가 카드 수를 센다).
    // 라운드 83 트랙 C: 카탈로그 크기 카드가 아홉 번째로 붙어 하네스의 기대 수도 함께 올랐다 —
    // 카드 수는 두 자리(화면·하네스)에 적히므로 여기서 **둘이 같은 수인지**를 함께 묻는다.
    expect(home).toContain("scripts/qa/admin-e2e.mjs가 요약 카드를 article로 세고 있어서다.");
    expect((home.match(/<article key=\{card\.key\}/g) ?? []).length).toBe(1);
    const summaryCards = /const SUMMARY_CARDS[^=]*=\s*\[([\s\S]*?)\n\];/.exec(home)?.[1];
    expect([...(summaryCards as string).matchAll(/\{ key:/g)]).toHaveLength(9);
    const harnessSource = readSource(join("..", "..", "scripts", "qa", "admin-e2e.mjs"));
    expect(harnessSource).toContain("if (count !== 9) throw new Error(`expected 9 summary cards");

    // 스텝 7(검토 화면)이 기다리는 앵커 셋.
    const reviews = readSource("app/reviews/page.tsx");
    expect(reviews).toContain("해당 상태의 초안이 없어요.");
    expect(reviews).toContain("검토 목록을 불러오지 못했어요.");
    expect(reviews).toContain("<h1>콘텐츠 검토</h1>");

    // 스텝 9·11(감사 로그)·13(고지 문구)·14(클릭 통계)의 배너/빈 상태 문구.
    expect(readSource("app/audit-logs/page.tsx")).toContain("감사 로그를 불러오지 못했어요.");
    // ⚠️ 라운드 87 리뷰 M-3 — **앵커가 문장의 새 집을 따라가고, 주석은 보지 않는다.** 당시 이 줄은
    // 같은 문장을 `app/audit-logs/page.tsx`에서 찾았는데, 같은 라운드의 트랙 A가 정본을
    // `src/lib/audit-log-rows.ts`(auditLogEmptyStateMessage)로 옮기면서 화면에는 **주석 두 줄만**
    // 남았다 — 즉 이 앵커는 그 주석 덕에 초록이었고 양방향으로 뜻을 잃었다(문장을 지워도 주석이
    // 남으면 초록, 주석만 고쳐도 빨강). 라운드 87 리뷰 이후에는 스텝 9·11이 실제로 기다리는
    // 그 문장을 **정본 파일의 코드에서** 찾는다(그 파일의 머리말도 같은 문장을 인용하므로,
    // 파일만 바꾸고 주석을 함께 걷지 않으면 앵커가 자리만 옮긴 채 같은 이유로 초록이 된다).
    const emptyStateSource = readSource("src/lib/audit-log-rows.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    expect(emptyStateSource).toContain('"조건에 맞는 기록이 없어요."');
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
