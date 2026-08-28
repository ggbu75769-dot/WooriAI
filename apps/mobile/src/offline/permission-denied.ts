import { API_ERROR_MESSAGES, apiErrorCodeOf } from "../api/api-error";

/**
 * 라운드 47 UX-AB / 라운드 57 #8 — 동기화 실패 행의 **사유 판정**. 이 모듈 하나가
 * "이 행을 다시 보내면 성공할 수 있나"에 답하고, 동기화 상태 화면(app/sync-status.tsx)과
 * 일괄 재시도(sync-engine.ts `retryAllFailedMutations`)가 같은 답을 쓴다.
 *
 * ## 원래 문제 (라운드 47)
 *
 * sync-status 화면의 실패 행은 사유와 무관하게 늘 "재시도" 버튼을 고정으로 그렸다. 그런데 403은
 * **정의상 재시도가 무익하다** — 서버가 이 계정의 역할로는 쓰기를 허용하지 않는다고 답한 것이라,
 * 역할이 바뀌기 전에는 몇 번을 눌러도 같은 403이 돌아온다(보기 전용 역할이 지출을 기록한 경우가
 * 정확히 이 자리다 — src/family/record-permissions.ts의 배경 설명 참고). 사용자는 눌러도 아무것도
 * 변하지 않는 버튼을 반복해서 누르게 되고, 화면은 그 이유를 말하지 않았다.
 *
 * ## 문자열 비교를 걷어낸 이유 (라운드 57 #8)
 *
 * 라운드 47의 판정은 `lastError === API_ERROR_MESSAGES.FORBIDDEN`, 즉 **화면 문구와의 글자 단위
 * 일치**였다. 행이 들고 있는 단서가 그 문자열 하나뿐이었기 때문이다(당시 주석이 "저장 스키마
 * 변경이라 별도 티켓"이라고 남겨 둔 것이 이 티켓이다). 그 판정에는 두 가지 한계가 있었다.
 *
 *  1. **깨지기 쉽다.** `API_ERROR_MESSAGES.FORBIDDEN`의 문구를 한 글자만 다듬어도 이미 기기에
 *     저장된 행들의 판정이 조용히 false로 바뀐다(문구는 계약이 아니다 — api-error.ts).
 *  2. **403 말고는 아무것도 구분할 수 없다.** 검증 거부(400)·상한 초과(400)처럼 다시 보내도
 *     같은 답이 오는 4xx가 전부 "재시도" 버튼을 달고 남았다.
 *
 * 이제 저장 계층이 `last_error_status`/`last_error_code`를 들고 있으므로(v2 마이그레이션 —
 * sqlite-offline-store.ts) 판정은 **숫자 status**로 한다.
 *
 * **레거시 폴백을 남기는 이유**: v2 이전에 실패해 기기에 남아 있는 행에는 status가 없다. 그 행에는
 * 예전과 **똑같은** 문자열 비교를 적용한다 — 판정 근거가 바뀌었다고 이미 저장된 행의 동작까지
 * 바뀌면 안 되고, "모르면 기존 동작"이 이 모듈이 지켜 온 안전한 방향이기 때문이다.
 */

/** 403. 상수로 두는 이유는 아래 두 판정이 같은 숫자를 보고 있다는 사실을 코드로 못 박기 위해서다. */
export const FORBIDDEN_STATUS = 403;

/** 실패 행이 판정에 내놓는 것. 지출 행(LocalExpenseRow)과 준비템 행(ItemStatusOutboxRow)이
 * 공유하는 부분집합이라 두 화면 갈래가 같은 함수를 쓴다. */
export type SyncFailureRow = {
  lastError?: string | null;
  lastErrorStatus?: number | null;
  lastErrorCode?: string | null;
};

/** 실패를 행에 저장할 수 있는 모양으로 줄인 값. `null`은 언제나 "모름"이다. */
export type SyncFailureReason = {
  status: number | null;
  code: string | null;
};

/**
 * 던져진 오류에서 (status, code)를 뽑는다. sync-engine이 실패 행에 남길 값을 만드는 **유일한**
 * 자리다.
 *
 * 어디서 오는가: `RemotePermanentError`(src/offline/errors.ts)는 `status`와 서버 응답 `body`를
 * 그대로 들고 다니고, 5xx·네트워크 실패에서 remote-api.ts가 원본 그대로 다시 던지는
 * `ExpenseHttpError`/`ApiHttpError`도 같은 두 필드를 들고 있다. `code`는 그 body의 서버 봉투
 * (`{ error: { code, message } }`)에서 나오며, 꺼내는 규칙은 앱 전체가 쓰는 `apiErrorCodeOf`를
 * 그대로 재사용한다(봉투 → `.code` 순으로 읽고, 모르면 null).
 *
 * 네트워크/타임아웃처럼 status가 아예 없는 실패는 `{ status: null, code: null }`이고, 그 값은
 * `isRetryableSyncError`에서 **재시도 가능**으로 읽힌다(모르면 사용자의 손을 묶지 않는다).
 */
export function syncFailureReasonOf(error: unknown): SyncFailureReason {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  return {
    status: typeof status === "number" ? status : null,
    code: apiErrorCodeOf(error)
  };
}

/**
 * **이 status의 실패를 그대로 다시 보내면 성공할 여지가 있나** — 순수 판정.
 *
 * 이것은 sync-engine의 자동 백오프 분류(remote-api.ts: 4xx=permanent, 5xx·네트워크=transient)와
 * **다른 질문**이다. 저쪽은 "앱이 알아서 계속 보내도 되나"이고, 여기는 "사용자가 지금 누르는
 * 재시도 버튼이 무언가를 바꿀 수 있나"다. 그래서 자동 재시도를 포기한 5xx 행(F2 탈출구)도 여기서는
 * 재시도 가능이다 — 서버가 회복되면 그대로 성공한다.
 *
 * 규칙:
 *  - status 모름(네트워크·타임아웃) → **가능**. 모를 때 버튼을 없애면 사용자가 손쓸 방법이 사라진다.
 *  - 5xx → **가능**. 서버 사정이고, 회복되면 같은 요청이 그대로 통과한다.
 *  - 401·408·429 → **가능**. 4xx이지만 원인이 요청 내용이 아니다: 401은 다시 로그인하면 풀리고
 *    (src/offline/session-expiry.ts — 만료는 로컬 큐를 지우지 않는다), 408·429는 시간이 지나면
 *    같은 요청이 통과한다. 이 셋까지 "무익"이라고 말하면 그 자체가 허위 안내다.
 *  - 그 밖의 4xx(400 검증 거부·상한 초과, 403 권한, 404, 422 …) → **불가능**. 로컬 payload가
 *    그대로인 한 서버의 답도 그대로다.
 */
const RETRYABLE_CLIENT_ERROR_STATUSES = new Set([401, 408, 429]);

export function isRetryableSyncError(status: number | null | undefined): boolean {
  if (status == null) return true;
  if (status >= 500) return true;
  return RETRYABLE_CLIENT_ERROR_STATUSES.has(status);
}

/**
 * 행 단위 판정. status를 모르는 레거시 행은 **재시도 가능**으로 본다 — 예전에는 403을 뺀 모든
 * 실패 행에 재시도 버튼이 있었고, 그 행들의 동작을 이제 와서 좁히지 않는다.
 */
export function isRetryableSyncFailureRow(row: SyncFailureRow | null | undefined): boolean {
  if (!row) return true;
  return isRetryableSyncError(row.lastErrorStatus);
}

/**
 * 권한 거절(403)로 실패한 행인가.
 *
 * status가 있으면 숫자로 판정하고, 없으면(v2 이전 행) 예전 그대로 표의 FORBIDDEN 문구와 **정확히
 * 같을 때만** true다. 부분 일치를 쓰지 않는 이유는 라운드 47 그대로다: 잘못 true를 주면 재시도할
 * 수 있었던 행에서 재시도 수단이 사라지고(사용자가 손쓸 방법이 없어지는 방향), 잘못 false를 주면
 * 예전과 똑같이 재시도 버튼이 남을 뿐이다.
 *
 * 문자열도 그대로 받는다: 행 전체가 아니라 `lastError` 한 값만 들고 있는 호출부(테스트 포함)가
 * 이미 있고, 그 자리는 정의상 레거시 폴백과 같은 질문을 하고 있기 때문이다.
 */
export function isPermissionDeniedSyncError(
  row: SyncFailureRow | string | null | undefined
): boolean {
  if (row == null) return false;
  const reason: SyncFailureRow = typeof row === "string" ? { lastError: row } : row;
  if (typeof reason.lastErrorStatus === "number") return reason.lastErrorStatus === FORBIDDEN_STATUS;
  if (!reason.lastError) return false;
  return reason.lastError === API_ERROR_MESSAGES.FORBIDDEN;
}

/**
 * 권한 거절 행에서 "재시도" 버튼 자리를 대신하는 안내. 재시도가 무익하다는 사실만 말하고
 * 무엇을 해야 하는지는 `lastError` 문구가 이미 말하고 있으므로(역할·구성원 확인) 반복하지
 * 않는다. 해요체(DNC-018).
 */
export const SYNC_STATUS_PERMISSION_DENIED_HINT = "권한이 생기면 다시 시도할 수 있어요.";

/**
 * 라운드 57 #8 — 403이 아닌 **재시도 불가 4xx**(검증 거부·상한 초과·대상 없음 …) 행의 안내.
 *
 * 왜 사유를 여기서 반복하지 않나: 무엇이 잘못됐는지는 바로 윗줄의 `lastError`가 이미 서버 코드별
 * 문구로 말하고 있다(api-error.ts의 표 — "미래 날짜의 지출은 저장할 수 없어요.", 금액 상한 안내
 * 등). 같은 사실을 두 문장이 각자 말하기 시작하면 표와 이 파일이 갈라지는 순간을 아무도 모른다.
 * 그래서 이 한 줄은 표가 말할 수 없는 것 — **재시도라는 행동이 무익하다는 사실과 대신 할 일** —
 * 만 말한다. 해요체(DNC-018).
 */
export const SYNC_STATUS_PERMANENT_FAILURE_HINT =
  "다시 보내도 같은 결과예요. 내용을 고쳐 새로 기록하거나 버려 주세요.";

/**
 * 같은 상황의 **준비템 상태 행** 버전. 문장을 나눈 이유는 다음에 할 일이 실제로 다르기 때문이다:
 * 지출 실패 행은 사용자가 고칠 내용(금액·날짜·품목명)을 들고 있지만, 준비 상태 변경에는 고칠
 * 내용이라는 것이 없다(보낸 것은 상태값 하나다). 지출용 문장을 그대로 쓰면 "내용을 고쳐 새로
 * 기록하라"는, 이 행에서는 할 수 없는 일을 시키는 안내가 된다. 해요체(DNC-018).
 */
export const SYNC_STATUS_ITEM_STATUS_PERMANENT_FAILURE_HINT =
  "다시 보내도 같은 결과예요. 이 변경은 버리고 준비템 화면에서 다시 확인해 주세요.";
