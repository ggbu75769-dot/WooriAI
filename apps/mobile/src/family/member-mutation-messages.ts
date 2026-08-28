/**
 * 라운드 52 C-05 — 구성원 삭제·초대 취소가 조용히 실패하지 않게 하는 문구 단일 소스.
 *
 * ## 무엇이 잘못돼 있었나
 *
 * 가족 화면의 두 파괴적 동작(구성원 삭제, 대기 중인 초대 취소)에는 `onSuccess`만 배선돼 있었다.
 * 실패하면 확인 Alert는 닫히고, 목록은 그대로이고, 화면은 **아무 말도 하지 않았다.** 사용자가
 * 읽는 것은 "지웠는데 아직 남아 있다"이고, 그래서 같은 버튼을 다시 누른다. 앱이 "할 수 있다"고
 * 말한 일이 조용히 실패하는 자리는 허위 표시에 가장 가깝다(UX-Q(A)가 초대 생성에서 고친 것과
 * 같은 문제이고, 이 두 자리가 같은 화면에 남아 있었다).
 *
 * ## 세 갈래로 나눠 말한다
 *
 * 1. **권한 없음(403)** — 서버는 두 동작 모두 가구 owner에게만 허용한다(assertOwner). 재시도로
 *    풀리지 않으므로 "다시 시도해 주세요"라고 하지 않는다(invite-permissions.ts의 403 원칙과 같다).
 * 2. **오프라인** — 요청이 서버에 닿지도 못한 경우. "잠시 후 다시"는 기다릴 대상이 있다는 뜻이라
 *    사실과 어긋난다. 지금 할 수 있는 행동(연결된 뒤 다시)을 말한다(src/offline/messages.ts).
 * 3. **그 밖의 실패** — 종류별 일반 재시도 문구. 서버가 코드로 사유를 말해 준 경우에만 아래 표로
 *    한 겹 더 구체화한다.
 *
 * ## 왜 서버 문구를 그대로 쓰지 않고 여기 표를 두는가
 *
 * `src/api/api-error.ts`의 화이트리스트는 앱 전역에서 중립적으로 읽혀야 하는 코드만 담는다. 여기
 * 다루는 코드들은 서버 원문이 영어이거나(HOUSEHOLD_MEMBER_NOT_FOUND: "Household member was not
 * found.") 이 화면의 맥락에서만 뜻이 통한다("이미 가족에서 빠진 구성원이에요"). 코드 추출 자체는
 * 그 모듈의 `apiErrorCodeOf`를 그대로 쓴다 — 봉투 파싱을 한 벌 더 만들지 않는다.
 *
 * 순수 모듈이라 vitest에서 그대로 테스트하고(member-mutation-messages.test.ts), 화면 배선은 같은
 * 파일의 소스 grep 계약이 맡는다.
 */

import { apiErrorCodeOf } from "../api/api-error";
import { OFFLINE_RETRY_NOTICE } from "../offline/messages";

/** 어떤 동작이 실패했는지 — 제목·일반 문구 선택에만 쓰인다. */
export type FamilyMemberMutationKind = "remove_member" | "cancel_invite";

export const MEMBER_REMOVE_FAILED_ALERT_TITLE = "구성원을 삭제하지 못했어요";
export const INVITE_CANCEL_FAILED_ALERT_TITLE = "초대를 취소하지 못했어요";

export const MEMBER_REMOVE_FAILED_MESSAGE = "구성원을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.";
export const INVITE_CANCEL_FAILED_MESSAGE = "초대를 취소하지 못했어요. 잠시 후 다시 시도해 주세요.";

/**
 * 403 전용 문구. 두 동작을 하나로 묶어 말하는 이유: 사용자가 마주한 사실은 "이 가족의 관리자만
 * 할 수 있는 일"이라는 하나이고, 다음에 할 수 있는 행동도 하나다(관리자에게 부탁하기).
 * 재시도를 권하지 않는다 — 다시 눌러도 결과가 같다.
 */
export const MEMBER_MANAGE_FORBIDDEN_MESSAGE = "가족 구성원 관리는 관리자만 할 수 있어요. 가족 관리자에게 부탁해 주세요.";

const ALERT_TITLE_BY_KIND: Record<FamilyMemberMutationKind, string> = {
  remove_member: MEMBER_REMOVE_FAILED_ALERT_TITLE,
  cancel_invite: INVITE_CANCEL_FAILED_ALERT_TITLE
};

const FALLBACK_MESSAGE_BY_KIND: Record<FamilyMemberMutationKind, string> = {
  remove_member: MEMBER_REMOVE_FAILED_MESSAGE,
  cancel_invite: INVITE_CANCEL_FAILED_MESSAGE
};

/**
 * 이 화면에서만 뜻이 통하는 코드별 문구. 어느 것도 재시도를 권하지 않는다 — 셋 다 "이미 그렇게
 * 돼 있다"는 사실이라 다시 눌러도 같은 답이 온다.
 * (apps/api/src/households/household-runtime.service.ts의 removeMember/cancelInvite)
 */
const MESSAGE_BY_CODE: Readonly<Record<string, string>> = {
  HOUSEHOLD_MEMBER_NOT_FOUND: "이미 가족에서 빠진 구성원이에요.",
  HOUSEHOLD_MEMBER_REMOVE_OWNER_FORBIDDEN: "가족 관리자는 목록에서 삭제할 수 없어요.",
  INVITE_NOT_FOUND: "이미 없는 초대예요.",
  INVITE_NOT_PENDING: "이미 사용했거나 만료된 초대예요."
};

const FORBIDDEN_ERROR_CODE = "FORBIDDEN";

/**
 * 던져진 값에서 서버 오류 코드를 뽑는다.
 *
 * 1차는 `apiErrorCodeOf` — 지금 client.ts가 던지는 `ApiHttpError`(code/body를 들고 있다)를 읽는다.
 * 2차는 `Error.message`에 담긴 봉투 JSON — 옛 `new Error(JSON.stringify(data))` 관례로 던져지는
 * 값도 같은 판정을 받게 하기 위한 폴백이다(invite-permissions.ts가 지금도 그 형태를 파싱한다).
 * 어느 쪽도 아니면 `null`이고, `null`은 아무것도 바꾸지 않는다(호출부 폴백 유지).
 */
export function familyErrorCodeOf(error: unknown): string | null {
  const fromEnvelope = apiErrorCodeOf(error);
  if (fromEnvelope) return fromEnvelope;

  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 네트워크 오류 등 JSON이 아닌 실패.
    return null;
  }
  return apiErrorCodeOf({ body: parsed });
}

/** 실패한 동작 → Alert 제목. */
export function memberMutationAlertTitle(kind: FamilyMemberMutationKind): string {
  return ALERT_TITLE_BY_KIND[kind];
}

/**
 * 실패 → 사용자에게 보여줄 문구.
 *
 * 판정 순서: 권한 → 서버가 말해 준 사유 → 오프라인 → 일반. 앞의 둘이 먼저인 이유는 **서버가
 * 답을 줬다는 사실 자체**가 연결이 있었다는 뜻이라, 그 경우까지 오프라인으로 말하면 틀린 안내가
 * 되기 때문이다. 연결 상태(`isOnline`)는 화면이 실패 시점에 한 번 확인해 넘긴다
 * (src/offline/connectivity.ts의 isCurrentlyOnline — 판정이 불가능한 플랫폼에서는 true라,
 * 어긋나도 기존 일반 문구로 안전하게 떨어진다).
 *
 * 원문 오류 메시지는 어떤 경로로도 화면에 나가지 않는다(save-error-messages.ts와 같은 규칙).
 */
export function memberMutationErrorMessage(
  kind: FamilyMemberMutationKind,
  error: unknown,
  { isOnline }: { isOnline: boolean }
): string {
  const code = familyErrorCodeOf(error);
  if (code === FORBIDDEN_ERROR_CODE) return MEMBER_MANAGE_FORBIDDEN_MESSAGE;
  if (code && Object.prototype.hasOwnProperty.call(MESSAGE_BY_CODE, code)) return MESSAGE_BY_CODE[code];
  if (!isOnline) return OFFLINE_RETRY_NOTICE;
  return FALLBACK_MESSAGE_BY_KIND[kind];
}
