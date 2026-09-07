import { HOUSEHOLD_JOIN_VIEWER_NOTICE, isChildCreateBlockedRole } from "../children/household-join";

/**
 * 설정 화면 두 곳(SET-005 아이 관리 · SET-003 약관 및 개인정보)의 **0건 카드 판정** 단일 소스.
 *
 * 빈 상태 하나가 성립하려면 셋이 있어야 한다:
 *  ⓐ 무슨 일이 있었는지 말한다 · ⓑ 다음에 무엇을 하면 되는지 말한다 · ⓒ 그 행동으로 가는
 *  버튼이 그 자리에 있다.
 *
 * ## 아이 관리(SET-005) — ⓑⓒ가 없었다
 *
 * 종전 카드는 `title="등록된 아이가 없어요" actionLabel="새로고침"`이었다. 새로고침은 **이미
 * 성공한 조회**를 다시 부를 뿐이라(그 조회가 0건을 정직하게 돌려준 자리다) 눌러도 같은 화면이
 * 돌아온다. 이 빈 상태를 실제로 푸는 행동인 `[아이 추가]`는 카드 **밖** — 빈 목록과 안내 카드
 * 몇 장을 지나 화면 아래 — 에 서 있었다.
 *
 * 그래서 카드가 그 입구를 진다. 다만 **아무에게나 그 버튼을 주지 않는다**: 추가는 대상 가구의
 * 역할이 정하고(owner/co_parent), 데모 세션에서는 추가 자체가 일어나지 않으며(FIX-118B F3),
 * 폼이 이미 열려 있으면 다시 눌러 봐야 입력이 초기화될 뿐이다(`startAdd`가 폼과 멱등 키를
 * 되돌린다). 그 넷이 이 모듈의 갈래다.
 *
 * ## 약관 및 개인정보(SET-003) — ⓐ가 없었다
 *
 * 종전 카드는 `title="표시할 항목이 없어요"`라 **무엇이 없는지조차** 말하지 않았고, 판정은
 * 서버 응답의 `flows`(삭제·탈퇴 흐름 목록) 개수를 읽고 있었다.
 *
 * ⚠️ 그런데 그 이름으로 고쳐 쓸 수는 없다: 삭제·탈퇴 카드 셋(SET-004)은 **응답이 아니라 화면
 * 안 로컬 문구표(`flowCopy`)로 언제나 그려진다**. "삭제·탈퇴 항목이 없어요"라고 적으면 바로
 * 아래 서 있는 그 카드 셋과 화면이 자기 모순에 빠진다. 이 자리(SET-003)에서 응답이 정하는
 * 것은 **동의 내역** 하나뿐이므로, 카드는 그 이름으로 말하고 판정도 그 값(동의 카드가 서는가)을
 * 읽는다. 그래야 "동의 내역이 보이는데 표시할 항목이 없다"는 종전의 어긋남도 함께 사라진다.
 *
 * 여기서 `[새로고침]`은 남는다 — 이 자리의 데이터는 서버에서만 오므로 다시 부르는 것이 실제로
 * 그 상태를 풀 수 있는 행동이다(아이 목록 쪽과 다른 점이다).
 *
 * 로그인 없이 이 화면에 서면 그 조회 자체가 꺼져 있어(`enabled: Boolean(authToken)`) 새로고침이
 * 아무것도 부르지 않는다. 그때는 이 앱이 잠금 카드 셋(app-lock · children · notifications)에서
 * 이미 쓰는 그 한 벌을 그대로 쓴다 — 새 문구를 짓지 않는다.
 *
 * 문구 규율은 세 화면 공통이다(DNC-018): 단정·다그침 없이 관찰과 다음 행동만, 해요체.
 */

/** 아이 0건 카드가 제안하는 다음 행동 — 화면은 이 키로 무엇을 배선할지 정한다. */
export type ChildrenEmptyAction = "add-child" | "refresh";

export type ChildrenEmptyStateCard =
  | { action: ChildrenEmptyAction; title: string; actionLabel: string }
  /** 지금 이 사람이 할 수 있는 일이 없는 갈래 — 낭독되는 가짜 버튼을 만들지 않는다. */
  | { action: null; title: string };

/** 개인정보 화면 0건 카드가 제안하는 다음 행동. */
export type PrivacyEmptyAction = "login" | "refresh";

export type PrivacyEmptyStateCard = { action: PrivacyEmptyAction; title: string; actionLabel: string };

/** 종전 문구 그대로. 목록이 비었다는 **사실**이지 누구를 다그치는 말이 아니다(DNC-018). */
function childrenEmptyTitle(): string {
  return "등록된 아이가 없어요";
}

/**
 * 아이가 0건일 때 서는 카드. 목록이 비지 않았거나 아직 0건이라고 말할 수 없으면 null이다.
 *
 * @param listEmpty    조회가 **성공했고** 그 결과가 0건인가(화면의 `children.isSuccess &&
 *                     childList.length === 0`). 로딩·실패는 각자의 얼굴이 따로 있다.
 * @param canAddChild  대상 가구의 역할이 추가를 허용하는가(화면의 `canAddChild`). 이 값은
 *                     역할을 **모르는 동안에도 false**라(구성원 목록 로딩 중), 이것만으로
 *                     "당신은 추가할 수 없어요"라고 말하지 않는다 — 아래 role이 그 답을 낸다.
 * @param isDemoSession 데모(로컬 백엔드) 세션인가. 데모의 추가는 실제로 일어나지 않는다.
 * @param addFormOpen  추가 폼이 이미 열려 있는가. 열려 있으면 다시 여는 버튼은 입력을 지운다.
 * @param role         대상 가구에서의 내 역할(모르면 undefined).
 */
export function buildChildrenEmptyStateCard(input: {
  listEmpty: boolean;
  canAddChild: boolean;
  isDemoSession: boolean;
  addFormOpen: boolean;
  role?: string | null;
}): ChildrenEmptyStateCard | null {
  if (!input.listEmpty) return null;
  // 확실히 막힌 역할(viewer · gift_participant)에게 추가는 길이 아니라 403 벽이다. 그 사람에게
  // 참인 문장은 이 앱에 이미 있다(가구 참여 직후 같은 상황에서 읽히는 그 한 줄) — 다시 짓지 않고,
  // 눌러도 결과가 같은 버튼도 붙이지 않는다(src/children/household-join.ts).
  if (isChildCreateBlockedRole(input.role)) return { action: null, title: HOUSEHOLD_JOIN_VIEWER_NOTICE };
  if (input.canAddChild && !input.isDemoSession) {
    // 폼이 이미 열려 있으면 다음 행동은 그 폼을 채우는 것이다 — 같은 버튼을 다시 주면 눌린
    // 순간 입력과 멱등 키가 처음으로 되돌아간다(app/settings/children.tsx의 startAdd).
    if (input.addFormOpen) return { action: null, title: childrenEmptyTitle() };
    return { action: "add-child", title: childrenEmptyTitle(), actionLabel: "아이 추가" };
  }
  // 역할을 아직 모르거나(구성원 목록 로딩) 데모라 추가가 열리지 않은 갈래 — 종전 그대로다.
  // 모를 때 "추가할 수 없어요"라고 말하는 것이 이 화면에서 할 수 있는 가장 나쁜 단정이다.
  return { action: "refresh", title: childrenEmptyTitle(), actionLabel: "새로고침" };
}

/**
 * 목록 **아래**의 상시 `[아이 추가]` 버튼을 세울 것인가.
 *
 * 카드가 그 입구를 지는 갈래에서만 자리를 넘긴다. 그 밖의 모든 상태(목록이 있음 · 로딩 · 실패 ·
 * 폼이 열림)에서는 종전 그대로 이 버튼이 선다 — 화면에 입구가 언제나 정확히 하나다.
 */
export function showsStandingAddChildEntry(card: ChildrenEmptyStateCard | null): boolean {
  return card?.action !== "add-child";
}

/**
 * SET-003에서 응답이 정하는 자리(동의 내역)가 비었을 때 서는 카드. 그릴 것이 없으면 null이다.
 *
 * @param hasSession       로그인 토큰이 있는가. 없으면 이 화면의 조회 자체가 꺼져 있다.
 * @param settled          조회가 끝났는가(`!privacy.isLoading && !privacy.isError`). 로딩은
 *                         스켈레톤이, 실패는 LoadErrorCard가 이미 말한다.
 * @param showsConsentCard 동의 내역 카드가 서는가(동의 줄 또는 선택 동의 스위치가 하나라도 있음).
 */
export function buildPrivacyEmptyStateCard(input: {
  hasSession: boolean;
  settled: boolean;
  showsConsentCard: boolean;
}): PrivacyEmptyStateCard | null {
  if (!input.settled) return null;
  // 잠금 카드 셋과 같은 한 벌(라운드 96 T6 — 버튼 글자가 목적지를 말한다).
  if (!input.hasSession) return { action: "login", title: "로그인 후 이용할 수 있어요.", actionLabel: "로그인하기" };
  if (input.showsConsentCard) return null;
  // 무엇이 없는지 이름으로 말한다 — 이 자리의 카드 제목("동의 내역")과 같은 낱말이다.
  return { action: "refresh", title: "표시할 동의 내역이 없어요.", actionLabel: "새로고침" };
}
