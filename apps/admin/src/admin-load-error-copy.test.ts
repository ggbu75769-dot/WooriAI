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

/** `app/**`의 화면 소스 전수(어드민 루트 기준 POSIX 경로). */
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
  walk(join(adminRoot, "app"));
  return found.sort();
}

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
  it("401 로그아웃이 여전히 모든 화면의 첫 갈래다", () => {
    for (const path of Object.keys(LOAD_ERROR_COPY_SITES)) {
      const source = readSource(path);
      const firstAuth = source.indexOf("isAuthError(error)");
      const firstCopy = source.search(/loadError(?:Copy|Message)\(/);
      expect(firstAuth, `${path}에 401 갈래가 있다`).toBeGreaterThanOrEqual(0);
      expect(firstAuth, `${path}: isAuthError → clearSession 앞에 아무것도 끼우지 않는다`).toBeLessThan(firstCopy);
    }
  });
});

describe("조회 실패 판정의 소비 집합 (라운드 73 트랙 D ⓐ)", () => {
  /**
   * 파생 단언: 목록을 손으로 적어 두는 것이 아니라 `app/**`을 훑어 **실제 호출 자리 수**와
   * 대조한다. 새 조회 화면이 생겼는데 한 벌을 부르지 않으면 이 줄이 먼저 빨개진다
   * (모바일 쪽 `messages.test.ts`의 useLoadErrorCopy 스윕과 같은 형태).
   */
  it("app/**의 소비 자리 수가 값(LOAD_ERROR_COPY_SITES)과 정확히 일치한다", () => {
    const wired: Record<string, number> = {};
    for (const path of appScreenPaths()) {
      const count = readSource(path).match(/loadError(?:Copy|Message)\(/g)?.length ?? 0;
      if (count > 0) wired[path] = count;
    }
    expect(wired).toEqual({ ...LOAD_ERROR_COPY_SITES });
  });

  it("오늘의 자리는 열다섯이다 (라운드 73 전에는 그중 열이 이유를 통째로 버렸다)", () => {
    const total = Object.values(LOAD_ERROR_COPY_SITES).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(15);
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
  it("손으로 지은 타임아웃 문장이 app/**에서 사라졌다 (부정 단언)", () => {
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

  it("AdminShell은 이 트랙 밖이다 (세션·MFA 화면 무접촉)", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).not.toContain("load-error-copy");
    // 종전대로 AdminApiError.message를 그대로 보여 주는 자리 — 이 트랙이 만들려는 모양이다.
    expect(shell).toContain("error instanceof AdminApiError ? error.message");
  });

  it("역할 안내 화면은 조회 실패가 아니라 권한 표시다 (무변경)", () => {
    for (const path of ["app/users/page.tsx", "app/audit-logs/page.tsx", "app/users-lookup/page.tsx"]) {
      expect(readSource(path), path).toContain("관리자(admin) 권한에서만 사용할 수 있어요.");
    }
  });

  it("admin-e2e의 17스텝 앵커가 그대로다", () => {
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
