/**
 * UX-Q(A): 가족 초대 권한 판정 단일 소스.
 *
 * 서버는 초대 생성을 가구 owner에게만 허용한다(households/household-runtime.service.ts —
 * 403 FORBIDDEN "가족 초대는 관리자만 할 수 있어요."). 그런데 가족 화면은 owner 전용 UI 중
 * **멤버 삭제·대기 중인 초대 섹션만** 가려 두고, 초대 진입점 세 개(아바타 줄의 `+`,
 * "링크로 초대" 행, 아래 "가족 초대하기" 버튼)는 역할과 무관하게 그대로 눌리게 두었다.
 * 게다가 quickInvite 뮤테이션에는 onError가 없어서, 초대받아 들어온 공동부모가 그 버튼을
 * 누르면 요청이 403으로 죽고 화면은 아무 말도 하지 않는다 — 앱이 "할 수 있다"고 말한 일이
 * 조용히 실패하는, 허위 표시에 가장 가까운 자리다.
 *
 * 그래서 판정을 화면 밖 순수 함수로 꺼내 두 가지를 고정한다.
 *
 * 1) **어떤 세션에서 진입점을 잠그는가** — `hasSession && myRole !== "owner"`.
 *    비로그인 미리보기(hasSession=false)는 잠그지 않는다. 미리보기 화면은 픽셀락 FAM-001
 *    캡처가 그대로 찍는 화면이라, 여기서 행을 지우거나 캡션을 붙이면 락이 깨진다. 또한
 *    미리보기에는 "내 역할"이라는 것 자체가 없으므로 잠글 근거도 없다. 반대로 실세션에서
 *    역할을 아직/끝내 알 수 없으면(undefined) 잠근다 — 모르는 쪽으로 열어 두면 위 무반응이
 *    그대로 되살아난다.
 *
 * 2) **403은 재시도로 풀리지 않는다** — 일반 실패("잠시 후 다시 시도해 주세요")와 분리한
 *    전용 문구를 쓴다. 권한이 없어서 막힌 사람에게 다시 눌러 보라고 하는 것은 두 번째 거짓말이다.
 *
 * 화면(react-native)은 이 repo의 vitest에서 렌더할 수 없으므로 판정은 여기서 단위 테스트하고,
 * 배선은 소스 grep 계약 테스트가 맡는다(invite-permissions.test.ts).
 */

/** 비활성 진입점에 붙는 캡션 — more.tsx의 "캡션 + onPress 없음" 비활성 행 관례를 따른다. */
export const INVITE_OWNER_ONLY_CAPTION = "가족 초대는 관리자만 할 수 있어요";

/**
 * 초대 생성이 403으로 막혔을 때의 문구. 일반 실패 문구와 달리 **재시도를 권하지 않는다** —
 * 다시 눌러도 결과가 같기 때문이다. 대신 실제로 통하는 다음 행동(관리자에게 부탁하기)을 준다.
 */
export const INVITE_FORBIDDEN_MESSAGE = "가족 초대는 관리자만 만들 수 있어요. 가족 관리자에게 초대를 부탁해 주세요.";

/**
 * 권한 말고 다른 이유로 실패했을 때의 일반 문구. 원래 app/family/invite.tsx에만 있던 문장을
 * 그대로 옮겨 두 화면(가족 화면의 빠른 초대 · 초대 만들기 화면)이 같은 상수를 읽게 한다 —
 * 같은 실패를 화면마다 다르게 말하지 않기 위해서다. 문구 자체는 바뀌지 않았다.
 */
export const INVITE_CREATE_FAILED_MESSAGE = "초대 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.";

/** 초대 생성 실패를 Alert로 띄울 때의 제목(가족 화면의 빠른 초대 경로). */
export const INVITE_CREATE_FAILED_ALERT_TITLE = "초대를 만들지 못했어요";

export type InviteEntryPointInput = {
  /** 실제 로그인 세션인가(토큰 + 가구 id). 비로그인 미리보기면 false. */
  hasSession: boolean;
  /** 이 가구에서 내 역할. 아직 모르거나 구성원 목록에서 나를 찾지 못하면 undefined/null. */
  myRole: string | null | undefined;
};

/**
 * 초대 진입점을 비활성 행으로 내려야 하는가.
 *
 * 주의: `canManageMembers`(= hasSession && myRole === "owner")의 부정이 아니다. 그 값으로
 * 가리면 비로그인 미리보기까지 잠겨 FAM-001 픽셀락 캡처에서 행이 사라진다.
 */
export function isInviteEntryPointLocked({ hasSession, myRole }: InviteEntryPointInput): boolean {
  if (!hasSession) return false;
  return myRole !== "owner";
}

const FORBIDDEN_ERROR_CODE = "FORBIDDEN";

/**
 * 던져진 값에서 비교 가능한 문자열을 뽑는다. react-query의 onError는 무엇이든 넘겨줄 수 있어
 * (Error, 문자열, undefined) 방어적으로 읽는다 — src/expenses/save-error-messages.ts와 같은 관례.
 */
function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

/**
 * 초대 생성 실패가 "권한 없음"인가.
 *
 * src/api/client.ts의 requestJson은 실패 응답 본문을 그대로 JSON 문자열로 만들어 Error에 담는다
 * (`throw new Error(JSON.stringify(data))`). 서버 봉투는 GlobalExceptionFilter가 고정한
 * `{ error: { code, message, ... } }` 형태이므로 code만 본다 — 사람이 읽는 message 문구는
 * 언제든 바뀔 수 있어 비교 기준으로 쓰지 않는다.
 */
export function isInviteForbiddenError(error: unknown): boolean {
  const raw = errorMessageOf(error);
  if (!raw) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 네트워크 오류 등 JSON이 아닌 실패 — 권한 문제로 단정하지 않는다.
    return false;
  }

  if (!parsed || typeof parsed !== "object") return false;
  const envelope = (parsed as { error?: unknown }).error;
  if (!envelope || typeof envelope !== "object") return false;
  return (envelope as { code?: unknown }).code === FORBIDDEN_ERROR_CODE;
}

/**
 * 초대 생성 실패 → 사용자에게 보여줄 문구. 403만 전용 문구로 갈라내고, 나머지 실패는 일반
 * 재시도 문구로 남긴다(원인을 사용자가 알 수도 고칠 수도 없는 실패에 원문/스택을 그대로
 * 노출하지 않는다 — save-error-messages.ts와 같은 규칙).
 */
export function inviteCreateErrorMessage(
  error: unknown,
  fallbackMessage: string = INVITE_CREATE_FAILED_MESSAGE
): string {
  return isInviteForbiddenError(error) ? INVITE_FORBIDDEN_MESSAGE : fallbackMessage;
}
