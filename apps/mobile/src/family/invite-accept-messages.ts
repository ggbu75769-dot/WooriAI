/**
 * 라운드 70 A — 초대를 **받은 사람**이 만나는 막다른 길의 문구 단일 소스.
 *
 * ## 무엇이 잘못돼 있었나
 *
 * 초대는 7일 · 1회용이다(apps/api/src/households/household-runtime.service.ts의 `INVITE_TTL_MS`,
 * 수락 시 `status: accepted`). 즉 만료·사용됨은 예외가 아니라 **정상 수명의 끝**이고, 링크를
 * 늦게 연 사람은 반드시 그 자리에 선다.
 *
 * 그런데 FAM-003(app/family/accept/[token].tsx)은 조회 실패 전량을 "초대 정보를 불러오지
 * 못했어요. 잠시 후 다시 시도해 주세요." 한 줄로 접고 그 아래에 [다시 시도]를 세웠다. 만료된
 * 초대는 다시 눌러도 **영원히** 같은 답이고, 그 옆에는 "로그인하면 이 초대로 바로 돌아와서
 * 참여할 수 있어요."가 실패와 **무관하게** 서 있었다 — 계정이 없는 사람은 그 약속을 믿고
 * 카카오 로그인 · 약관 동의 · 계정 생성까지 마치고 돌아와 **똑같은 한 줄**을 다시 읽었다.
 *
 * 같은 실패를 **브라우저는 이미 한국어로 정직하게 설명하고 있었다**(아래 "같은 사실").
 *
 * ## 오라클을 만들지 않는다 (이 모듈의 가장 중요한 규칙)
 *
 * 서버는 두 코드로 사유를 말한다 — `INVITE_NOT_FOUND`(404, "초대 링크를 찾을 수 없어요.") ·
 * `INVITE_NOT_PENDING`(400, "이미 사용했거나 만료된 초대예요.") — `requirePendingInvite`.
 * 그런데 조회 엔드포인트 `GET /api/v1/invites/:token`은 **무인증 공개**다
 * (apps/api/src/households/households.controller.ts — 클래스 가드가 없다). 두 코드를 서로 다른
 * 문장으로 가르면 앱이 "이 토큰이 존재하는가"를 알려 주는 기계가 된다(토큰을 긁어 유효한
 * 초대를 찾아낼 수 있다). 그래서 **둘을 한 문장으로 받는다** — 초대 랜딩 페이지가 세 갈래를
 * 하나의 페이지로 받는 그 이유 그대로(invite-landing.controller.ts의 "No existence oracle" 주석).
 *
 * ## 같은 사실 · 같은 톤 (앱 ↔ 초대 랜딩 페이지)
 *
 * 같은 토큰의 같은 실패를 두 표면이 다르게 부르면, 링크를 보낸 사람과 받은 사람이 **다른
 * 이야기**를 듣는다. 그래서 아래 세 문장은 `apps/api/src/households/invite-landing.controller.ts`의
 * `renderUnavailableInvitePage()`가 그리는 세 줄과 **같은 사실을 같은 순서로** 말한다:
 *   1. 초대가 만료되었거나 유효하지 않다  2. 이미 사용했거나 기간이 지났을 수 있다
 *   3. 새 초대 링크를 요청하면 된다
 * 문자열을 서버에서 가져오지는 **않는다**(src/api/api-error.ts 머리말이 세 이유로 거절한 길이다).
 * 계약은 뜻·톤의 대조이고, 그 대조는 invite-accept-messages.test.ts가 두 파일의 소스를 함께
 * 읽어 고정한다. 랜딩 컨트롤러는 이 라운드에서 **한 줄도 바뀌지 않는다**(서버 0건).
 * 한 곳만 다듬는다: 랜딩의 "가족에게"를 앱에서는 "가족 관리자에게"로 좁힌다 — 초대를 만들 수
 * 있는 사람은 관리자뿐이고(`assertOwner`), 앱은 그 사실을 아는 자리다
 * (member-mutation-messages.ts의 MEMBER_MANAGE_FORBIDDEN_MESSAGE와 같은 표현).
 *
 * ## 왜 오프라인 갈래가 없는가
 *
 * 형식은 member-mutation-messages.ts(403 → 코드별 → 오프라인 → 일반)를 따르지만 이 화면에는
 * **403도 오프라인 갈래도 두지 않는다.** 403은 이 두 엔드포인트가 던지지 않고(무인증 공개
 * 조회 + 수락은 자기 자신에 대한 요청이다), 오프라인은 이 라운드의 회귀 계약이 **"재시도로
 * 풀리는 실패(네트워크·5xx)는 종전과 한 글자도 다르지 않을 것"**이기 때문이다. 여기서 새 문구를
 * 하나라도 끼우면 그 계약이 깨진다. 그래서 이 모듈이 하는 일은 하나다: **재시도로 절대 풀리지
 * 않는 두 코드를 가려내고, 그 갈래의 문장을 준다.** 나머지 실패는 호출부의 종전 문구 그대로다.
 *
 * 코드 추출은 src/api/api-error.ts의 `hasApiErrorCode`(= `apiErrorCodeOf`)를 그대로 쓴다 —
 * 봉투 파서를 한 벌 더 만들지 않는다. 데모 백엔드(local-backend)는 코드 없는 평문 Error를
 * 던지므로 아래 판정이 언제나 false다 = 데모 세션의 동작은 종전 그대로다.
 *
 * react-native / expo-router import 없이 유지해서 vitest에서 그대로 단위 테스트한다
 * (member-mutation-messages.ts와 같은 규율).
 */

import { hasApiErrorCode } from "../api/api-error";

/**
 * 재시도로 **절대** 풀리지 않는 두 코드. 서로 다른 문장으로 가르지 않는다(위 "오라클을 만들지
 * 않는다"). 이 배열이 두 개인 것 자체가 계약이다 — 셋이 되면 그 코드도 같은 한 문장을 받는지
 * 먼저 판단해야 한다.
 */
export const INVITE_UNAVAILABLE_CODES = ["INVITE_NOT_FOUND", "INVITE_NOT_PENDING"] as const;

/** 이 초대는 끝났다는 사실. 랜딩 페이지의 h1과 같은 사실이다. */
export const INVITE_UNAVAILABLE_TITLE = "초대가 만료되었거나 유효하지 않아요.";

/**
 * 왜 그런지 — **단정하지 않는다.** 두 코드를 한 갈래로 받으므로 "만료됐다"고 못 박으면 존재한
 * 적 없는 토큰에도 그렇게 말하게 된다. 랜딩 페이지가 "…일 수 있어요"로 적어 둔 그 이유다.
 */
export const INVITE_UNAVAILABLE_DETAIL = "이미 사용했거나 기간이 지난 초대 링크일 수 있어요.";

/**
 * 다음에 무엇을 하면 되는지(DNC-018). 재시도를 권하지 않는다 — 이 화면에서 다시 눌러 풀리는
 * 것은 아무것도 없고, 실제로 통하는 유일한 행동은 새 링크를 받는 것이다.
 */
export const INVITE_UNAVAILABLE_NEXT_STEP = "가족 관리자에게 새 초대 링크를 요청해 주세요.";

/**
 * 이 갈래의 탈출구 라벨.
 *
 * 문장이 "새 링크를 요청하세요"라고 끝나면 이 화면에서 **지금 할 수 있는 일이 하나도 없다.**
 * 라운드 60 #3이 수락 **후** 막다른 길에 세운 것과 같은 형식으로, 수락 **전** 막다른 길에도
 * 나가는 문 하나를 둔다(목적지는 `householdJoinEscapePlan`이 계정 상태로 정한다).
 * 라벨이 "나중에 하기"가 아닌 이유: 이 초대는 나중에도 되살아나지 않는다.
 */
export const INVITE_UNAVAILABLE_ESCAPE_LABEL = "앱 둘러보기";

/**
 * 이 실패가 "초대 자체가 끝났다"인가.
 *
 * 참이면 화면은 (1) 위 세 문장을 말하고 (2) [다시 시도]를 내리고 (3) 로그인 CTA를 접는다 —
 * 지킬 수 없는 약속을 하지 않는다. 거짓이면(네트워크·5xx·그 밖의 코드) 호출부는 **종전 그대로**다.
 */
export function isInviteUnavailableError(error: unknown): boolean {
  return hasApiErrorCode(error, ...INVITE_UNAVAILABLE_CODES);
}
