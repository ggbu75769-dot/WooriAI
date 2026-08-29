/**
 * 라운드 71 트랙 B(#2) — **되돌릴 수 없는 세 흐름의 실패가 이름을 얻는 자리.**
 *
 * ## 무엇이 잘못돼 있었나
 *
 * 개인정보 화면(app/settings/privacy.tsx)의 마지막 버튼 셋 — 아이 프로필 삭제 · 가구 탈퇴 ·
 * 계정 삭제 — 은 실패하면 전부 한 문장으로 접혔다:
 *
 *   `const actionFailedText = "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";`
 *
 * 그 화면은 **오프라인도 오류 코드도 모르는** 화면이었다(라운드 71 정찰의 전수 grep:
 * `useLoadErrorCopy`·`useSaveErrorCopy`·`apiErrorMessage`·`isCurrentlyOnline` 0건). 그런데 세
 * 확정은 아웃박스를 타지 않는 **서버 직행 쓰기**다. 지하철에서 [계정 삭제하기]를 누른 사람이
 * 받는 답은 위 한 줄뿐이고, 그 사람이 가장 알고 싶은 것 — **내 계정이 지워졌나?** — 에 대해
 * 화면은 연결이 없었다는 사실조차 말하지 않았다. 그리고 "잠시 후 다시 시도해 주세요"는 기다릴
 * 대상이 있다는 뜻이라, 연결이 없는 그 자리에서는 사실과 어긋난다(라운드 52 C-07이 예산·아이
 * 프로필에서, 라운드 68 C가 커머스에서 없앤 바로 그 문장이다).
 *
 * **영구 실패도 실재한다.** 관리자가 그사이 나를 내보냈거나(403) 다른 기기에서 이미 나갔다면
 * (404) 다시 눌러도 영원히 같은 답이 온다 — 그 자리에 재시도를 권하는 것은 안내가 아니다.
 *
 * ## 네 갈래로 나눠 말한다 (판정 순서 = 403 → 대상 없음 → 오프라인 → 모르는 실패)
 *
 * 1. **권한 없음(403)** — 재시도로 풀리지 않으므로 "다시 시도"를 붙이지 않고 지금 상태를 말한다.
 * 2. **대상 없음(404)** — 같은 이유로 재시도를 권하지 않는다. 이미 그렇게 돼 있다는 사실이다.
 * 3. **오프라인** — 이 트랙의 본체다. 아래 `destructiveFlowOfflineMessage` 머리말 참고.
 * 4. **모르는 실패** — 종전 문장 **그대로**다(바이트 불변). 5xx·타임아웃·데모 세션의 평문
 *    Error가 여기로 떨어진다.
 *
 * 앞의 둘이 오프라인보다 먼저인 이유는 `member-mutation-messages.ts`가 적어 둔 것과 같다:
 * **서버가 답을 줬다는 사실 자체**가 연결이 있었다는 뜻이라, 그 경우까지 오프라인으로 말하면
 * 그것이 또 하나의 틀린 안내가 된다. 연결 상태는 실패 시점 폴 한 번이다
 * (src/offline/connectivity.ts의 `isCurrentlyOnline` — 판정할 수 없는 플랫폼에서는 true라,
 * 어긋나도 종전 문구로 안전하게 떨어진다).
 *
 * ## 이 앱이 말할 수 있는 것의 상한
 *
 * **"실패했으니 되돌려졌다"고 단언하지 않는다.** 응답을 받지 못한 앱이 아는 것은 "응답이 없다"
 * 까지이고, 오프라인 갈래만 "요청이 서버에 닿지 못했다"까지 말할 수 있다. 그 이상(계정이 그대로
 * 남아 있다 · 아무 일도 일어나지 않았다)은 이 앱이 확인한 적 없는 사실이다.
 *
 * ## 왜 `api-error.ts`의 표를 그대로 쓰지 않는가
 *
 * 그 표의 문구는 **앱 전역에서 중립적으로** 읽혀야 한다(`FORBIDDEN`: "권한이 없어 처리하지
 * 못했어요. 가족 구성원 여부와 내 역할을 확인해 주세요."). 여기 서는 문장은 되돌릴 수 없는
 * 결정 앞에서 **무엇이 지금 어떤 상태인지**를 말해야 하므로 흐름별로 갈린다. 코드 추출만 그
 * 모듈의 `apiErrorCodeOf`를 그대로 쓴다 — 봉투 파서를 한 벌 더 만들지 않는다(그 파일은 이
 * 트랙에서 **읽기만** 한다).
 *
 * 순수 모듈이라 vitest에서 그대로 테스트하고(destructive-flow-messages.test.ts), 화면 배선과
 * "서버가 실제로 그 코드를 던지는가"는 같은 파일의 소스 계약이 맡는다.
 */

import { apiErrorCodeOf } from "../api/api-error";
import { OFFLINE_RETRY_NOTICE } from "../offline/messages";

/**
 * 이 화면에서 **서버로 직행하는 쓰기** 넷.
 *
 * 앞의 셋은 되돌릴 수 없는 확정이고, 넷째(필수 동의 재동의·선택 동의 스위치)는 파괴적이지 않다.
 * 그래도 같은 표를 지나는 이유는 라운드 65 B(#4ⓑ)가 세운 것이 **되돌아올 길**이기 때문이다 —
 * 약관 개정으로 필수 동의가 뒤집힌 사람이 그 길에서 실패하면 화면은 다시 막다른 길이 된다.
 * 같은 화면 · 같은 네 갈래 · 같은 판정 순서라 표가 둘일 이유가 없다.
 */
export type DestructiveFlowKind =
  | "child_profile_delete"
  | "household_leave"
  | "account_delete"
  | "consent_update";

/**
 * 모르는 실패의 문장. **종전 화면 리터럴과 바이트 단위로 같다**(privacy.tsx의 `actionFailedText`).
 * 5xx·타임아웃처럼 정말로 "잠시 후"가 참일 수 있는 실패만 여기로 온다.
 */
export const DESTRUCTIVE_ACTION_FAILED_MESSAGE = "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** 동의 저장의 모르는 실패. 이쪽도 종전 리터럴 그대로다(`CONSENT_UPDATE_FAILED_TEXT`). */
export const CONSENT_UPDATE_FAILED_MESSAGE = "동의를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

const FALLBACK_MESSAGE_BY_KIND: Readonly<Record<DestructiveFlowKind, string>> = {
  child_profile_delete: DESTRUCTIVE_ACTION_FAILED_MESSAGE,
  household_leave: DESTRUCTIVE_ACTION_FAILED_MESSAGE,
  account_delete: DESTRUCTIVE_ACTION_FAILED_MESSAGE,
  consent_update: CONSENT_UPDATE_FAILED_MESSAGE
};

/**
 * 오프라인 문장의 주어. 사용자가 방금 누른 버튼의 이름과 같은 대상을 가리킨다 — 셋 중 어느
 * 버튼을 눌렀는지 화면이 되짚어 주지 않으면 "요청"이 무엇을 가리키는지 알 수 없다.
 */
const REQUEST_LABEL_BY_KIND: Readonly<Record<DestructiveFlowKind, string>> = {
  child_profile_delete: "아이 프로필 삭제 요청",
  household_leave: "가구 탈퇴 요청",
  account_delete: "계정 삭제 요청",
  consent_update: "동의 저장 요청"
};

const FORBIDDEN_ERROR_CODE = "FORBIDDEN";

/**
 * 흐름별 코드 표. **어느 줄도 재시도를 권하지 않는다** — 넷 다 "이미 그렇게 돼 있다"는 사실이라
 * 다시 눌러도 같은 답이 온다.
 *
 * 서버 근거(이 표의 반대편은 테스트가 실제 서버 파일을 읽어 고정한다):
 *  - 아이 삭제: `requireChildAccess(user, childId, true)` — 보기 전용 역할이거나 그 가족의
 *    구성원이 아니면 403, 아이가 없거나 이미 삭제됐으면 404
 *    (apps/api/src/onboarding/child-access.service.ts).
 *  - 가구 탈퇴: `assertMember`의 403과 구성원 행이 없을 때의 404
 *    (apps/api/src/households/household-runtime.service.ts의 `leaveHousehold`).
 *
 * 403 줄이 네 흐름 모두에 서 있는 이유: `FORBIDDEN`은 도메인 예외와 `GlobalExceptionFilter`의
 * 403 기본 코드가 **같은 값**이라 어느 경로로 와도 뜻이 하나다(다시 눌러도 같다). 계정 삭제·동의
 * 저장 쪽 도달성이 낮다는 것은 표에 넣지 않을 이유가 되지 않는다 — 그때 사용자가 보는 것이
 * **잘못된 재시도 권유**라는 것이 비용이고, 낮은 도달성이 곧 낮은 비용이다(api-error.ts가
 * `EXPENSE_DATE_TOO_OLD`에 적어 둔 판단 그대로).
 *
 * 반대로 404 줄은 **도메인 코드가 있는 두 흐름에만** 선다. 404의 기본 코드(`NOT_FOUND`)는
 * "요청한 API를 찾을 수 없어요"(라우트 부재)까지 함께 뜻하므로, 그것을 "대상이 사라졌다"로
 * 읽으면 없는 사실을 지어내게 된다. 계정 삭제·동의 저장에 404 줄이 없는 근거는 아래
 * `DESTRUCTIVE_FLOW_ABSENT_TARGET_BRANCHES`에 이유와 함께 적어 둔다.
 */
export const DESTRUCTIVE_FLOW_MESSAGE_BY_CODE: Readonly<
  Record<DestructiveFlowKind, Readonly<Record<string, string>>>
> = {
  child_profile_delete: {
    FORBIDDEN: "이 아이 프로필을 삭제할 권한이 없어요. 보기 전용 역할이거나 이 가족의 구성원이 아닐 수 있어요.",
    CHILD_NOT_FOUND: "이 아이 프로필은 이미 없어요. 다른 기기에서 먼저 삭제됐을 수 있어요."
  },
  household_leave: {
    FORBIDDEN: "이 가족의 구성원이 아니에요. 관리자가 내보냈거나 다른 기기에서 이미 나갔을 수 있어요.",
    HOUSEHOLD_MEMBER_NOT_FOUND: "이미 이 가족에서 나와 있어요. 다른 기기에서 먼저 나갔을 수 있어요."
  },
  account_delete: {
    FORBIDDEN: "권한이 없어 계정을 삭제하지 못했어요."
  },
  consent_update: {
    FORBIDDEN: "권한이 없어 동의를 저장하지 못했어요."
  }
};

/**
 * **대상 없음(404) 줄이 서지 않는 흐름과 그 근거.** 근거를 값으로 적어 두지 않으면 다음 라운드가
 * 빈칸을 문장으로 채운다(그 문장은 서버가 한 번도 말한 적 없는 사실이 된다). 서버가 이 경로에
 * 404 도메인 코드를 만들면 테스트가 빨개지고, 만든 사람이 "그때 사용자가 무엇을 보는가"에
 * 답해야 한다.
 */
export const DESTRUCTIVE_FLOW_ABSENT_TARGET_BRANCHES: Readonly<Partial<Record<DestructiveFlowKind, string>>> = {
  account_delete:
    "withdrawUser는 조회 없이 자기 행을 갱신하는 트랜잭션이라 404를 던지는 자리가 없다(households/household-runtime.service.ts). 이미 탈퇴한 계정의 토큰은 그보다 앞선 인증 가드에서 401로 걸린다.",
  consent_update:
    "upsertConsents는 서버 정의 목록과 일치하는 항목만 upsert하고 없는 항목은 조용히 건너뛴다(onboarding/onboarding-core.service.ts) — 대상이 없다는 404가 나오는 자리가 없다."
};

/**
 * **오프라인 갈래 — 이 트랙의 본체.**
 *
 * 두 가지를 말하고 그 이상은 말하지 않는다.
 *  1. **요청이 서버에 닿지 못했다** — 되돌릴 수 없는 버튼을 누른 사람이 가장 알고 싶은 사실이고,
 *     이 앱이 확인할 수 있는 최대치다.
 *  2. 지금 상태와 다음에 할 수 있는 일 — 공용 단일 소스 `OFFLINE_RETRY_NOTICE`를 **글자 그대로**
 *     뒤에 붙인다(라운드 52 C-05·C-07이 쓰는 그 문장. 같은 상황을 화면마다 다른 말로 부르지
 *     않는다).
 *
 * 말하지 않는 것: **"그래서 아무 일도 일어나지 않았다"·"계정은 그대로예요"**. 연결 판정은
 * point-in-time 폴 한 번이라 어긋날 수 있고(요청이 나갔는데 응답만 잃은 경우), 그 단언이 틀리면
 * 이 화면이 하는 거짓말은 종전 침묵보다 나쁘다. 재시도를 권하는 것은 이 갈래뿐이다 — 오프라인은
 * 실제로 풀리는 상태이고, 그때 기다릴 대상은 연결이다.
 */
export function destructiveFlowOfflineMessage(kind: DestructiveFlowKind): string {
  return `${REQUEST_LABEL_BY_KIND[kind]}이 서버에 닿지 못했어요. ${OFFLINE_RETRY_NOTICE}`;
}

/** 모르는 실패의 문장 — 종전 화면 리터럴과 바이트 단위로 같다. */
export function destructiveFlowFallbackMessage(kind: DestructiveFlowKind): string {
  return FALLBACK_MESSAGE_BY_KIND[kind];
}

/**
 * 실패 → 사용자에게 보여줄 문구.
 *
 * 판정 순서는 403 → 대상 없음 → 오프라인 → 모르는 실패다(모듈 머리말). 원문 오류 메시지는 어떤
 * 경로로도 화면에 나가지 않는다(save-error-messages·member-mutation-messages와 같은 규칙).
 */
export function destructiveFlowErrorMessage(
  kind: DestructiveFlowKind,
  error: unknown,
  { isOnline }: { isOnline: boolean }
): string {
  const code = apiErrorCodeOf(error);
  const byCode = DESTRUCTIVE_FLOW_MESSAGE_BY_CODE[kind];
  if (code === FORBIDDEN_ERROR_CODE && Object.prototype.hasOwnProperty.call(byCode, FORBIDDEN_ERROR_CODE)) {
    return byCode[FORBIDDEN_ERROR_CODE];
  }
  if (code && Object.prototype.hasOwnProperty.call(byCode, code)) return byCode[code];
  if (!isOnline) return destructiveFlowOfflineMessage(kind);
  return FALLBACK_MESSAGE_BY_KIND[kind];
}
