import { AdminApiError, isTimeoutError } from "./admin-api";

/**
 * 라운드 73 트랙 D(GAP-073 #4ⓐ) — **어드민 조회 실패의 이유를 화면이 읽는다.**
 *
 * `admin-api.ts`의 `request()`는 실패할 때마다 이미 구체적인 한국어 문장을 만든다:
 *  - 읽기 타임아웃 → `READ_TIMEOUT_MESSAGE`("요청 시간이 초과됐어요(10초)…")
 *  - 네트워크 실패 → `AdminApiError(0, "서버에 연결하지 못했어요…")`
 *  - 서버가 준 본문 → `error.message`(서버가 쓴 문장, 없으면 admin-api의 일반 문장)
 * 그런데 오늘 어드민 화면 열다섯 자리 중 열은 그 문장을 통째로 버리고
 * `"…를 불러오지 못했어요."` 한 문장으로 수렴했다. 판정이 없어서가 아니라
 * **화면이 그 판정을 읽지 않아서**다(정찰 노트 선행 확인 9).
 *
 * 이 모듈은 그 판정을 **소비**하기만 한다. 새로 만드는 것이 없다는 것이 이 파일의 계약이다:
 *  - **문구를 짓지 않는다.** 아래 어디에도 한국어 문자열 리터럴이 없다 — 세 갈래는
 *    `error.message`(= admin-api.ts가 이미 만든 문장)를 그대로 읽고, 네 번째 갈래는
 *    호출부가 넘긴 **종전 화면별 기본문장**을 그대로 돌려준다.
 *  - **판정을 새로 만들지 않는다.** 타임아웃 판별은 `isTimeoutError`(admin-api.ts),
 *    네트워크/서버 구분은 `AdminApiError.status`다.
 *  - **401은 이 모듈에 닿지 않는다.** 모든 화면의 첫 갈래가
 *    `isAuthError(error) → clearSession()`이고, 그 앞에 아무것도 끼우지 않는다.
 *  - **쓰기 실패는 이 모듈이 다루지 않는다.** 쓰기 타임아웃의 "재시도를 권하지 않는다"
 *    판정은 R19-F가 근거와 함께 세워 뒀다(`WRITE_TIMEOUT_MESSAGE`) — 여기는 **조회**만이다.
 */

/** 조회 실패의 네 갈래. 이 넷 말고는 없다. */
export type LoadErrorReason =
  /** 읽기 타임아웃(10초). 문장은 admin-api.ts의 READ_TIMEOUT_MESSAGE. */
  | "timeout"
  /** 요청이 서버에 닿지 못했다. 문장은 admin-api.ts의 연결 실패 문장. */
  | "network"
  /** 서버가 상태 코드와 함께 문장을 줬다(서버 본문 또는 admin-api의 일반 문장). */
  | "server"
  /** AdminApiError가 아닌 실패(직렬화 오류·예상 못 한 예외). 화면별 기본문장이 답이다. */
  | "unknown";

export type LoadErrorCopy = {
  reason: LoadErrorReason;
  /** 화면에 그대로 적는 문장. 새로 지어진 문장은 하나도 없다. */
  message: string;
  /**
   * 이 실패에 [다시 시도] 버튼을 세워도 되는가.
   *
   * 모바일이 라운드 70 B·71 A·72 E에서 세운 규율("다시 눌러도 같은 답이 오는 실패에
   * 기다리라고 말하지 않는다")을 어드민에도 적용한다. 판정 근거는 `AdminApiError.status`
   * 하나이고, 자리별 버튼 렌더는 이 값에서 **파생**된다.
   */
  canRetry: boolean;
};

/**
 * 다시 눌러도 답이 달라질 수 있는 4xx. 나머지 4xx(400·403·404·409·422 …)는
 * 요청 자체가 거절된 것이라 같은 요청을 다시 보내도 같은 답이 온다.
 * (401은 여기까지 오지 않는다 — 위 머리말의 로그아웃 첫 갈래 참고.)
 */
const RETRYABLE_CLIENT_STATUSES = new Set([408, 425, 429]);

/**
 * 한글 음절 한 자라도 있는가 — **읽을 수 있는 사유인가**를 묻는 재료 하나.
 *
 * ⚠️ 범위를 유니코드 이스케이프로 적는 이유는 옆 한 벌이 이미 적어 둔 그것과 같다: 이 파일의
 * 계약은 "판정 코드에 한국어 **문구**가 0건"이고, 문자 범위는 문구가 아니라 판정의 재료다.
 * 리터럴로 적으면 옆 테스트의 부정 단언이 문구와 범위를 구별하지 못한다.
 *
 * ⚠️⚠️ **이것은 쓰기 한 벌에 있는 같은 재료의 사본이고, 사본인 것이 이 라운드의 결정이다.**
 * 그쪽 것을 내보내 여기서 부르는 안을 먼저 세워 봤는데, 그러면 이 파일이 그 파일의 **이름**을
 * 지니게 되고 저장소에는 그것을 금지하는 계약이 이미 서 있다: 쓰기 쪽 스윕의 무접촉 단언
 * (*"조회 한 벌은 쓰기 한 벌을 부르지 않는다"*)이 이 파일에 그 이름이 **한 번도** 없기를
 * 요구하고(주석까지 포함한 원문을 본다), `packages/test-utils`의 주석 관용 앵커 대장이 그
 * 단언의 바이트를 **면제의 증명**으로 들고 있다. 두 한 벌이 서로를 모르는 것이 이 저장소가
 * 고른 경계이고, 이 라운드가 그 경계를 뒤집을 자리는 아니다.
 *
 * 그래서 사본을 두되 **드리프트를 테스트가 문다**: `src/lib/admin-session-notice.test.ts` ⓑ의
 * 마지막 단언이 같은 문장 넷에 두 한 벌이 **같은 답**을 내는지 잰다 — 한쪽만 고치면 그 자리가
 * 먼저 빨개진다(사본이 조용히 갈리는 길을 막는 것이 사본을 없애는 것 다음으로 옳은 손이다).
 */
const HANGUL_SYLLABLE = /[\uAC00-\uD7A3]/;

export function loadErrorReason(error: unknown): LoadErrorReason {
  if (isTimeoutError(error)) return "timeout";
  if (!(error instanceof AdminApiError)) return "unknown";
  // request()가 fetch 거절을 status 0으로 감싼다 — 응답이 아예 없었다는 뜻이다.
  return error.status === 0 ? "network" : "server";
}

/** [다시 시도]가 통하는 실패인가. AdminApiError가 아니면(모르는 실패) 한 번 더가 답일 수 있다. */
export function loadErrorRetryable(error: unknown): boolean {
  if (!(error instanceof AdminApiError)) return true;
  if (error.status === 0) return true; // 타임아웃·네트워크: 다음 번엔 닿을 수 있다.
  if (error.status >= 500) return true; // 서버 쪽 일시 장애.
  if (RETRYABLE_CLIENT_STATUSES.has(error.status)) return true;
  return false;
}

/**
 * 조회 실패 하나를 화면이 쓸 값으로.
 *
 * @param fallbackMessage 이 화면이 **종전에 쓰던 그 문장**. 서버도 클라이언트도 이유를
 * 말해 주지 못했을 때만 쓰인다(그때는 종전과 한 글자도 다르지 않다).
 */
export function loadErrorCopy(error: unknown, fallbackMessage: string): LoadErrorCopy {
  const reason = loadErrorReason(error);
  const fromError = error instanceof AdminApiError ? error.message.trim() : "";
  /**
   * 라운드 107 트랙 J — **읽을 수 없는 서버 문장은 이 한 벌에서도 화면에 서지 않는다.**
   *
   * ⚠️ 두 시점. 종전 이 자리의 조건은 `!fromError` 하나였고 **그때는 그것이 옳아 보였다**:
   * 이 한 벌이 세워진 라운드 73의 근거는 *"서버가 이미 한국어 문장을 준다"* 였고, 조회 쪽에서
   * 영문 문장이 오는 경로가 값으로 확인된 적이 없었다. 라운드 76 리뷰 M-1이 쓰기 쪽에서 그
   * 경로를 찾아 겹을 세웠고(`analyst`의 저장 → `ADMIN_FORBIDDEN` / 영문), 조회 쪽은 그때
   * 그대로 남았다 — 라운드 107 트랙 I의 특성화 ⑤가 그 비대칭을 값으로 고정했다.
   *
   * 조회 쪽 도달 경로는 쓰기와 다르다: 다른 관리자가 역할을 강등했는데 클라이언트 세션 캐시가
   * 옛 역할을 들고 있는 동안의 GET이다(캐시는 `adminMe()` 응답 하나라 서버의 강등을 바로
   * 알지 못한다). 그 순간 열여섯 자리가 *"Admin access is required."* 를 한국어 화면에 세웠다.
   *
   * ⚠️ **이 한 겹은 판정이 아니라 소비 규칙이다** — 코드도 상태도 보지 않고 "이 문장을 사용자
   * 화면에 세울 수 있는가"만 묻는다. 그래서 위 머리말의 *"판정을 새로 만들지 않는다"* 는
   * 오늘도 참이다: 갈래(`reason`)도 재시도(`canRetry`)도 종전 그대로이고, 바뀐 것은 **어느
   * 문장을 세우는가** 하나다. 재료(`HANGUL_SYLLABLE`)가 사본인 이유는 그 상수의 주석에 있다.
   */
  const displayable = fromError !== "" && HANGUL_SYLLABLE.test(fromError);
  return {
    reason,
    // 빈 문장을 화면에 세우지 않는다 — 이유를 못 받은 것은 "그 밖"과 같다.
    message: reason === "unknown" || !displayable ? fallbackMessage : fromError,
    canRetry: loadErrorRetryable(error)
  };
}

/** [다시 시도] 버튼이 없는 자리(폼 자체가 재시도이거나, 배너가 아닌 한 줄)용 축약. */
export function loadErrorMessage(error: unknown, fallbackMessage: string): string {
  return loadErrorCopy(error, fallbackMessage).message;
}

/**
 * **조회 실패 판정을 소비하는 자리 집합**(라운드 73 트랙 D 계약 ⓐ).
 *
 * 키는 어드민 루트 기준 경로, 값은 그 파일 안에서 이 한 벌을 부르는 자리 수다.
 * `src/admin-load-error-copy.test.ts`가 이 표와 **정확히 일치**하는지 본다.
 *
 * ⚠️ **스윕 범위**(라운드 75 트랙 D ⓐ): `app/**` + `src/components/**`. 라운드 73~74 동안
 * 스윕은 `app/**`만 걸었고, 그래서 어드민의 화면 소스 중 **하나**가 구조적으로 보이지 않았다 —
 * `src/components/AdminShell.tsx`의 MFA 등록 관문이다(그 자리는 한 벌을 부르지 않아 목록에도
 * 면제 목록에도 없었고, 양쪽이 일치한 채 통과했다). 어드민의 화면 소스는 그 두 뿌리가 전부이고,
 * `src/lib/**`는 화면이 아니라 **판정·API 래퍼·세션 컨텍스트 모듈**이라 범위 밖이다
 * (`src/lib/admin-token-context.tsx`가 `.tsx`이지만 화면을 그리지 않는 이유가 그것이다).
 *
 * ⚠️ 그 스윕이 잡는 것은 **목록 ↔ 사용 집합의 불일치**다(부르는데 목록에 없다 · 목록에 있는데
 * 안 부른다 · 자리 수가 달라졌다). 새 화면이 이 한 벌을 **아예 부르지 않고** 자기 문장을 손으로
 * 적으면 사용 집합에도 목록에도 없어 통과한다 — 새 리터럴을 감지하는 단언이 아니다
 * (판정 범위: `docs/operations/known-limitations.md` N-3).
 *
 * 오늘의 합은 **열여섯**이다. 라운드 73 전에는 그중 열이 이유를 통째로 버렸고
 * (`"…를 불러오지 못했어요."` 한 문장으로 수렴), 넷은 각자 다른 타임아웃 문장을
 * 손으로 지어 갈랐다(카테고리·감사 로그 둘·사용자 조회). 라운드 75가 스윕 밖에 있던
 * 열여섯 번째(MFA 등록 관문)를 더했다. 이제 열여섯이 같은 판정을 읽는다.
 */
export const LOAD_ERROR_COPY_SITES: Readonly<Record<string, number>> = {
  // 대시보드 요약 · 워커 상태 한 줄.
  "app/page.tsx": 2,
  // 준비템 목록 · 분류 선택지(목록과 독립적으로 실패한다).
  "app/items/page.tsx": 2,
  "app/links/page.tsx": 1,
  "app/clicks/page.tsx": 1,
  "app/analytics/page.tsx": 1,
  // 검토 목록 · 검토 상세.
  "app/reviews/page.tsx": 2,
  "app/disclosures/page.tsx": 1,
  "app/users/page.tsx": 1,
  "app/categories/page.tsx": 1,
  // 감사 로그 목록 · CSV 내보내기(같은 목록 API를 페이지 순회한다).
  "app/audit-logs/page.tsx": 2,
  "app/users-lookup/page.tsx": 1,
  // MFA 등록 관문(`MfaSetupScreen`)의 등록 정보 조회. 같은 파일의 나머지 다섯 catch는
  // 전부 **쓰기** 실패라 이 한 벌의 대상이 아니다(R19-F의 `WRITE_TIMEOUT_MESSAGE` 경계).
  "src/components/AdminShell.tsx": 1
};

/**
 * 그리고 **부르지 않는 자리와 그 이유**.
 *
 * 목록의 값은 "이유가 어딘가에 적혀 있다"가 아니라 **다음 라운드가 이 자리를 다시
 * 세지 않는다**는 것이다(모바일 쪽 `OFFLINE_AWARE_LOAD_ERROR_NON_CARD_SCREENS`와 같은 관례).
 */
export const LOAD_ERROR_COPY_EXEMPT_SITES: Readonly<Record<string, string>> = {
  "app/reviews/page.tsx#worker-health":
    "검토 화면의 워커 상태 조회는 실패해도 아무 말도 하지 않는다 — 워커가 꺼졌는지 멈췄는지 " +
    "**모르는** 상태에서 예약 폼 위에 문장을 세우면 그것이 곧 허위 표시가 된다. " +
    "대시보드는 이 조회를 사용자에게 보여 주는 자리라 실패를 말하지만(app/page.tsx), " +
    "여기서는 확인된 사실(꺼짐·멈춤)만 말한다."
};
