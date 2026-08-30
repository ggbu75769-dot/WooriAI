/**
 * UX-Q(A): 가족 초대 권한 판정 단일 소스.
 *
 * 서버는 초대 생성을 가구 owner에게만 허용한다(households/household-runtime.service.ts —
 * 403 FORBIDDEN "가족 초대는 관리자만 할 수 있어요."). 그런데 가족 화면은 owner 전용 UI 중
 * **멤버 삭제·대기 중인 초대 섹션만** 가려 두고, 초대 진입점 세 개(아바타 줄의 `+`,
 * "링크로 초대" 행, 아래 "가족 초대하기" 버튼)는 역할과 무관하게 그대로 눌리게 두었다.
 * 게다가 그 자리의 빠른 초대 뮤테이션에는 onError가 없어서, 초대받아 들어온 공동부모가 그 버튼을
 * 누르면 요청이 403으로 죽고 화면은 아무 말도 하지 않았다 — 앱이 "할 수 있다"고 말한 일이
 * 조용히 실패하는, 허위 표시에 가장 가까운 자리다.
 *
 * 라운드 52 C-04: 그 뮤테이션 자체가 사라졌다. 가족 화면은 더 이상 초대를 만들지 않고 역할만
 * 골라 초대 화면으로 넘긴다(src/family/invite-flow.ts). 그래서 아래 문구가 실제로 나가는 자리는
 * **초대 화면의 생성 에러 줄 하나**이고, 진입점 잠금(1번)은 그대로 세 진입점에 남는다.
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
 * ## 라운드 76 트랙 A(GAP-076 #1) — 3) **오프라인도 재시도로 풀리지 않는다**
 *
 * 위 2)의 논리에는 한 갈래가 빠져 있었다. 요청이 서버에 **닿지도 못한** 실패에서도 이 모듈은
 * 일반 문구("초대 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.")를 말했다. 기다릴 대상이
 * 없는 사람에게 기다리라고 하는 것이라 403에 재시도를 권하던 그 거짓말과 같은 모양이고, 하필
 * 여기가 **가족 참여 여정의 첫 단추**다 — 지하철에서 배우자를 부르려던 사람은 이 한 문장 앞에서
 * 멈추고, 초대 수락 화면·역할·공동 기록을 한 번도 보지 못한다.
 *
 * 형제 모듈은 이미 그 갈래를 지나 있었다: 같은 폴더의 `member-mutation-messages.ts`가
 * `{ isOnline }`을 받아 **아는 코드 → 오프라인 → 일반** 순서로 답한다. 그 관례를 그대로 들여온다
 * (새 문구 0건 — 오프라인 문장은 `src/offline/messages.ts`의 `OFFLINE_RETRY_NOTICE` 한 벌이다).
 *
 * ⚠️ 403이 오프라인보다 **먼저**인 것이 계약이다. 연결 판정은 point-in-time 폴 하나라 어긋날 수
 * 있는데(src/offline/connectivity.ts), 서버가 403을 돌려줬다는 사실 자체가 연결이 있었다는 뜻이다 —
 * 그 경우까지 오프라인으로 말하면 그것이 또 하나의 틀린 안내가 된다(member-mutation-messages.ts의
 * 판정 순서 머리말과 같은 근거).
 *
 * ## 라운드 77 트랙 E(GAP-077 #5) — 4) **서버가 코드로 말한 실패도 이 자리에서 말한다**
 *
 * 라운드 76이 세운 배선에는 절반이 버려지고 있었다. 화면은 공용 훅(`useSaveErrorCopy` →
 * `resolveSaveErrorCopy`)이 만든 **완성된 문장**을 받아 놓고, 그것을 `!== OFFLINE_SAVE_NOTICE`로
 * **한 번 비교해 불리언 한 칸으로 접은 뒤 버렸다.** 훅의 판정 순서가 **아는 코드 → 오프라인 →
 * 모르는 실패**라, 서버가 코드를 준 실패는 훅에서 이미 표의 문장으로 갈라져 나오는데도 그 사실은
 * `isOnline: true` 하나로만 전달됐고, 이 모듈은 그 실패를 **모르는 실패**로 취급해 일반 폴백을
 * 돌려줬다. 즉 **"서버가 코드로 말한 실패"의 문장은 이 화면에 구조적으로 설 수 없었다.**
 *
 * 오늘 결함이 아닌 이유는 하나뿐이다: 초대 생성이 서버에서 얻는 코드가 `FORBIDDEN` 하나이고
 * (household-runtime.service.ts — owner 전용 403), 그것은 위 2)의 **첫 갈래**가 이미 전용 문장으로
 * 답한다. 두 판정이 오늘 같은 값으로 수렴할 뿐이다. 그런데 `API_ERROR_MESSAGES`(src/api/api-error.ts)는
 * 라운드마다 코드를 받아 왔다 — 초대 경로에 코드가 하나 생기는 날(초대 개수 상한·이미 구성원 …)
 * 이 화면은 **아무 단언도 깨지 않은 채** 일반 문장을 말하고, 사용자는 정리해야 할 대기 초대가
 * 바로 전 화면에 떠 있는 줄도 모른 채 30초 뒤 같은 버튼을 다시 누른다.
 *
 * 그래서 판정이 인자를 하나 더 받는다(`serverCopy`) — **버리던 그 값**이다. 갈래는 넷이 된다:
 * **403 → 오프라인 → 서버가 말한 문장 → 초대 전용 폴백.** 새 문구는 0건이고 오늘 도달 가능한
 * 모든 입력의 답은 바이트 불변이다(늘어난 것은 갈래 하나뿐).
 *
 * ⓓ 형제 화면(`app/family/accept/[token].tsx:367`)은 라운드 73 E부터 훅의 문장을 **그대로 그려**
 * 왔다 — 한 여정의 두 화면이 같은 훅을 정반대로 쓰던 것이 이 갈래가 없던 이유이고, 이제 둘은
 * 같은 축에 선다(초대 화면은 자기 폴백 문장이 따로 있어 그 자리만 이 모듈이 고른다).
 *
 * 화면(react-native)은 이 repo의 vitest에서 렌더할 수 없으므로 판정은 여기서 단위 테스트하고,
 * 배선은 소스 grep 계약 테스트가 맡는다(invite-permissions.test.ts).
 */

import { OFFLINE_RETRY_NOTICE, OFFLINE_SAVE_NOTICE, SAVE_ERROR_NOTICE } from "../offline/messages";

/** 비활성 진입점에 붙는 캡션 — more.tsx의 "캡션 + onPress 없음" 비활성 행 관례를 따른다. */
export const INVITE_OWNER_ONLY_CAPTION = "가족 초대는 관리자만 할 수 있어요";

/**
 * 초대 생성이 403으로 막혔을 때의 문구. 일반 실패 문구와 달리 **재시도를 권하지 않는다** —
 * 다시 눌러도 결과가 같기 때문이다. 대신 실제로 통하는 다음 행동(관리자에게 부탁하기)을 준다.
 */
export const INVITE_FORBIDDEN_MESSAGE = "가족 초대는 관리자만 만들 수 있어요. 가족 관리자에게 초대를 부탁해 주세요.";

/**
 * 권한 말고 다른 이유로 실패했을 때의 일반 문구. 원래 app/family/invite.tsx에 인라인돼 있던
 * 문장을 그대로 옮겨, 403 문구와 같은 자리에서 갈라지게 한다 — 같은 실패를 서로 다른 문형으로
 * 말하지 않기 위해서다. 문구 자체는 바뀌지 않았다.
 */
export const INVITE_CREATE_FAILED_MESSAGE = "초대 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.";

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
 * 공용 훅이 "이 실패의 사유를 나도 모른다"고 답할 때 쓰는 두 문장.
 *
 * `resolveSaveErrorCopy`가 돌려줄 수 있는 값은 셋뿐이다 — 표의 문장(아는 코드) · 이 둘 중 하나.
 * 그래서 훅의 답이 이 둘 **밖**이라는 사실이 곧 "서버가 코드로 사유를 말했다"는 뜻이고, 그때만
 * 그 문장을 이 자리에 세운다. 두 문장 자체는 여기서 절대 돌려주지 않는다: `SAVE_ERROR_NOTICE`는
 * 초대 전용 폴백(`INVITE_CREATE_FAILED_MESSAGE`)이 이미 같은 뜻을 이 여정의 말로 하고 있고,
 * `OFFLINE_SAVE_NOTICE`는 *"연결된 뒤 다시 **저장**해 주세요"* 라서 "만들기"인 이 자리에서는
 * 틀린 안내다(그래서 오프라인 갈래는 `OFFLINE_RETRY_NOTICE`다 — 라운드 76이 그 갈래를 고른 이유).
 */
const HOOK_FALLBACK_COPIES: ReadonlyArray<string> = [SAVE_ERROR_NOTICE, OFFLINE_SAVE_NOTICE];

/**
 * 초대 생성 실패 → 사용자에게 보여줄 문구. 원인을 사용자가 알 수도 고칠 수도 없는 실패에
 * 원문/스택을 그대로 노출하지 않는다(save-error-messages.ts와 같은 규칙).
 *
 * 판정 순서는 **403 → 오프라인 → 서버가 말한 문장 → 초대 전용 폴백** 네 칸이다
 * (앞 두 칸은 member-mutation-messages.ts와 같다 — 근거는 이 파일 머리말 3), 셋째 칸이
 * 라운드 77 트랙 E가 더한 갈래다 — 근거는 머리말 4)).
 *
 * 화면이 넘기는 값 둘은 **같은 공용 훅 한 벌**에서 온다(`useSaveErrorCopy` →
 * `useErrorTimeConnectivity`가 실패 시점에 연결을 한 번 묻는다 — 화면은 직접 `isCurrentlyOnline()`을
 * 부르지 않는다). `isOnline`은 그 훅의 답에서 파생한 **연결 사실**이고(`!== OFFLINE_SAVE_NOTICE`),
 * `serverCopy`는 **그 답 자체**다. 종전에는 앞의 하나만 넘어와 뒤의 문장이 버려졌다.
 *
 * ⚠️ 두 문구(`INVITE_FORBIDDEN_MESSAGE`·`INVITE_CREATE_FAILED_MESSAGE`)는 바이트 불변이고,
 * **오늘 도달 가능한 모든 입력의 답이 종전과 한 글자도 다르지 않다** — 서버가 초대 생성에 주는
 * 코드는 `FORBIDDEN` 하나이고 그것은 첫 갈래가 먼저 잡는다. 셋째 칸은 표가 자라는 날을 위한
 * 자리이고, `serverCopy`를 넘기지 않으면(구 호출부·단위 테스트) 판정은 종전 셋 그대로다.
 */
export function inviteCreateErrorMessage(
  error: unknown,
  { isOnline, serverCopy }: { isOnline: boolean; serverCopy?: string }
): string {
  if (isInviteForbiddenError(error)) return INVITE_FORBIDDEN_MESSAGE;
  if (!isOnline) return OFFLINE_RETRY_NOTICE;
  if (serverCopy && !HOOK_FALLBACK_COPIES.includes(serverCopy)) return serverCopy;
  return INVITE_CREATE_FAILED_MESSAGE;
}
