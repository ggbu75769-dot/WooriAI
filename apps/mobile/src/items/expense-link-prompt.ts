import type { ItemStatus } from "@wooriai/domain";
import { EXPENSE_ENTRY_SOURCE_PARAM, type ExpenseEntrySource } from "../expenses/post-save-destination";
import { normalizeItemSearchText } from "./item-filters";

/**
 * 라운드 37 UX-I: **준비템 ↔ 지출 기록의 빈 고리**를 잇는 순수 판정 + 문구.
 *
 * 핵심 루프(지출 기록 → 총액 확인 → 시기별 준비템 확인 → 구매 링크 클릭 → 구매 후 기록/상태
 * 체크)에는 한 군데 구멍이 있었다. 앱 밖(마트·당근·지인)에서 이미 산 사람은 준비템과 지출을
 * 이을 방법이 없었다:
 *  - 아이템 상세의 "지출 기록하고 준비 완료" 카드는 `clickedTitle` 게이트 안에 있어서 **제휴
 *    링크를 연 뒤에만** 나타났다. 링크를 누를 일이 없는 사람에게는 존재하지 않는 기능이다.
 *  - 목록 행의 "준비했어요"는 상태만 바꾸고 끝이라, 지출은 영영 기록되지 않은 채 총액이
 *    실제보다 작게 남았다.
 *
 * 이 파일은 **새 저장 경로를 만들지 않는다.** 기존 /expenses/new 프리필 계약
 * (itemName, itemTemplateId — app/expenses/new.tsx가 읽는 파라미터 두 개)을 그대로 쓰고,
 * 여기서는 "언제 보여줄 것인가 + 뭐라고 말할 것인가"만 정한다.
 *
 * ## 문구 원칙
 * - 해요체 · 권유형. 아직 기록하지 않은 것을 탓하거나 재촉하지 않는다(DNC-018).
 *   "지출도 기록할까요?"는 물음이지 할 일 목록이 아니다 — 무시해도 아무 일도 일어나지 않는다.
 * - 추천 점수·정렬에는 아무것도 관여하지 않는다(DNC-009 무접촉).
 * - 제휴/스폰서 고지와 섞이지 않는다 — 이건 구매 유도가 아니라 **이미 산 것의 기록**이다
 *   (그래서 상세 화면에서도 제휴 고지와 구매 CTA 사이에는 절대 끼지 않는다, DNC-010).
 */

/** /expenses/new가 읽는 프리필 파라미터. 두 진입점이 같은 모양을 보내도록 한 곳에서 만든다. */
export type ExpenseLinkParams = {
  itemName: string;
  itemTemplateId: string;
};

/**
 * 만들어진 파라미터. 프리필 두 개에, 라우팅 힌트 `from`이 **있을 수도 있다**.
 *
 * `from`은 화면에 보이지 않는 식별자이고(post-save-destination.ts), 붙지 않으면 저장 후 목적지는
 * 종전 그대로 기록 탭이다 — 그래서 optional이다.
 */
export type ExpenseLinkParamsWithSource = ExpenseLinkParams & {
  [EXPENSE_ENTRY_SOURCE_PARAM]?: ExpenseEntrySource;
};

/**
 * 준비템 → 지출 기록 프리필 파라미터.
 *
 * 계약은 app/expenses/new.tsx가 정한다(`useLocalSearchParams<{ itemName?, itemTemplateId?, from? }>`).
 * **저장 경로는 여전히 하나다** — 프리필 계약(itemName, itemTemplateId)을 갈라 놓으면 "지출을
 * 저장하면 준비템도 준비 완료로 표시된다"는 서버 쪽 연결(R19-B)이 한쪽에서만 동작한다.
 *
 * ## 라운드 48 QA(P2-5): `from`을 실제로 붙인다
 *
 * 라운드 48 T4(D1)가 "저장 후 준비템 탭 복귀" 판정을 만들었지만
 * (`resolvePostSaveDestination`), 그 판정에 값을 넣어 주는 진입점이 준비템 쪽에는 하나도
 * 배선되지 않아 **어느 경로에서도 동작하지 않았다** — 준비템에서 기록해도 늘 기록 탭으로
 * 튕겨 나갔고, 방금 오른 준비율과 100% 축하 배너는 아무도 못 봤다(핵심 루프의 마지막 고리).
 *
 * `source`는 **선택 인자**다. 넘기지 않으면 `from` 키 자체를 만들지 않아 종전 동작이
 * 한 글자도 바뀌지 않는다 — 아직 배선하지 않았거나 일부러 기본값을 쓰는 호출처(홈·기록 탭)는
 * 그대로 둔다. 목록과 상세를 구분해 받는 이유는 목적지가 달라서가 아니라(둘 다 준비템 탭),
 * 그 구분이 판정 모듈의 계약이기 때문이다 — 나중에 한쪽만 규칙이 바뀌어도 여기는 손댈 것이 없다.
 */
export function expenseLinkParams(
  input: ExpenseLinkParams,
  source?: ExpenseEntrySource
): ExpenseLinkParamsWithSource {
  const params: ExpenseLinkParamsWithSource = { itemName: input.itemName, itemTemplateId: input.itemTemplateId };
  if (source) params[EXPENSE_ENTRY_SOURCE_PARAM] = source;
  return params;
}

/** 아이템 상세: 제휴 링크를 열지 않아도 항상 보이는 "이미 샀어요" 진입점의 라벨. */
export const ITEM_DETAIL_EXPENSE_LINK_LABEL = "이미 샀어요 · 지출로 기록";

/**
 * 상세 진입점의 스크린 리더 문장. 화면에는 준비템 이름이 위쪽 카드에 있지만, TalkBack은
 * 버튼 하나만 읽으므로 무엇에 대한 기록인지 이름을 함께 말해 준다(items 탭 상태 버튼과 같은 관례).
 */
export function itemDetailExpenseLinkAccessibilityLabel(itemName: string): string {
  return `${itemName} 이미 샀어요, 지출로 기록`;
}

/**
 * 상세 진입점 노출 조건.
 *
 * ① 세션이 있을 때만. 비세션(미리보기)에서는 렌더 자체를 하지 않는다 — (1) 기록할 대상이 없고,
 *    (2) 픽셀 락 ITEM-002 캡처가 세션을 지운 프리뷰 렌더라(app/pixel-lock.tsx) 버튼이 한 줄 더
 *    들어가면 기준 이미지와 어긋난다. 같은 화면의 "선물로 받았어요"(ITEM-123 리뷰 F1)와 같은
 *    게이트다.
 *
 * ② 라운드 37 G-8: 제휴 링크를 연 뒤 뜨는 "준비 완료로 남길까요?" 카드가 화면에 서 있는 동안에는
 *    숨긴다. 그 카드의 기본 버튼("지출 기록하고 준비 완료")과 이 버튼은 **같은 곳으로 가는 같은
 *    행동**이라, 둘이 함께 보이면 화면에 지출 기록 입구가 두 개 생겨 어느 쪽이 무엇인지 묻게 된다
 *    (핵심 루프를 흐리는 중복 CTA). 이 상시 진입점은 "링크를 누를 일이 없는 사람"을 위한 것이므로,
 *    링크를 눌러 카드가 뜬 사람에게는 카드 쪽이 더 많은 맥락(자동 준비 완료 안내)을 준다.
 *    카드가 사라지면 다시 돌아온다.
 *
 * 배치 자체는 그대로다 — 제휴 고지와 구매 CTA 사이에는 아무것도 끼지 않는다(DNC-010 인접성).
 */
export function shouldShowItemDetailExpenseLink(input: {
  hasSession: boolean;
  /** 링크 클릭 후 "준비 완료로 남길까요?" 카드(`clickedTitle`)가 지금 떠 있는지. */
  clickedPromptVisible: boolean;
}): boolean {
  if (!input.hasSession) return false;
  return !input.clickedPromptVisible;
}

/** 목록 행 아래 한 줄 인라인 링크 문구. */
export const ITEM_LIST_EXPENSE_LINK_LABEL = "지출도 기록할까요?";

/**
 * 프롬프트가 만들어진 순간의 **목록 화면 좌표**(라운드 37 G-3).
 *
 * 프롬프트는 화면 상태로만 살아 있고 서버에는 아무 흔적이 없다. 그래서 "어느 목록을 보다가 남긴
 * 줄인가"를 함께 기억하지 않으면, 그 목록이 통째로 바뀐 뒤에도 줄만 남아 다른 목록 위에 떠 있게
 * 된다. 가장 무거운 경우가 **아이 전환**이다: A에서 준비했어요 → 떨어져 나온 줄 → 설정에서
 * B로 전환 → 준비템 탭 복귀 → 그 줄을 누르면 B의 지출로 기록되고, 서버는 그 지출에 딸린
 * 준비템(B의 같은 템플릿)까지 준비 완료로 바꾼다(R19-B). 즉 A에서 한 행동이 B의 데이터를
 * 바꾼다 — 사용자가 시킨 적 없는 일이다.
 *
 * 시기 밴드 칩·필수도 칩·검색어도 같은 이유로 함께 기억한다. 이쪽은 데이터를 오염시키지는
 * 않지만(같은 아이·같은 준비템), 조건을 바꿔 목록을 갈아 끼운 뒤에도 떨어져 나온 줄이 무기한
 * 남아 지금 보고 있는 목록과 무관한 안내가 화면에 붙어 있게 된다.
 *
 * **상태 탭(now/soon/prepared/not_needed)은 일부러 넣지 않는다.** 이 프롬프트가 떨어져 나오는
 * 가장 흔한 경로가 "지금 필요"에서 준비했어요를 눌러 항목이 준비완료 탭으로 옮겨 가는 것이라,
 * 사용자가 그 항목을 보러 준비완료 탭으로 이동하는 것은 프롬프트를 **버리는 행동이 아니라
 * 따라가는 행동**이다. 거기서 줄을 지우면 방금 만든 링크를 스스로 끊는 셈이 된다.
 */
export type ExpenseLinkPromptScope = {
  /** 그때 선택돼 있던 아이. 아직 모르면 null. */
  childId: string | null;
  /** 그때 선택돼 있던 시기 밴드 칩 라벨. */
  stageLabel: string;
  /** 그때 선택돼 있던 필수도 칩 값. */
  necessityFilter: string;
  /** 그때 입력돼 있던 검색어 원문(비교는 목록 필터와 같은 규칙으로 정규화해서 한다). */
  searchText: string;
};

/** 목록 화면이 기억하는 "방금 준비했어요를 누른 행". 한 번에 하나만 있다. */
export type ExpenseLinkPrompt = {
  itemTemplateId: string;
  itemName: string;
  /** 이 줄이 만들어진 순간의 화면 좌표. 지금 화면과 어긋나면 이 줄은 무효다. */
  scope: ExpenseLinkPromptScope;
};

/**
 * 두 좌표가 같은 목록을 가리키는가.
 *
 * 검색어는 목록을 거를 때와 **같은 정규화**(trim + 소문자, src/items/item-filters.ts)를 거친 뒤
 * 비교한다 — 뒤에 공백 하나를 더 치는 것은 목록을 바꾸지 않으므로 프롬프트도 살아 있어야 한다.
 */
export function sameExpenseLinkPromptScope(a: ExpenseLinkPromptScope, b: ExpenseLinkPromptScope): boolean {
  return (
    a.childId === b.childId &&
    a.stageLabel === b.stageLabel &&
    a.necessityFilter === b.necessityFilter &&
    normalizeItemSearchText(a.searchText) === normalizeItemSearchText(b.searchText)
  );
}

/**
 * 지금 화면에서 이 프롬프트가 **무효인가**(= 그리지도 말고, 상태에서도 걷어야 하는가).
 *
 * 화면은 이 판정을 두 번 쓴다: 렌더 직전에 한 번(오래된 줄을 한 프레임도 그리지 않기 위해),
 * 그리고 useEffect에서 한 번(그 줄을 상태에서 실제로 지우기 위해). 두 곳이 같은 함수를 보므로
 * "화면에는 없는데 상태에는 남아 있는" 어긋남이 생기지 않는다.
 */
export function isExpenseLinkPromptStale(input: {
  prompt: ExpenseLinkPrompt | null | undefined;
  scope: ExpenseLinkPromptScope;
}): boolean {
  if (!input.prompt) return false;
  return !sameExpenseLinkPromptScope(input.prompt.scope, input.scope);
}

/**
 * 상태 변경 성공 직후 프롬프트를 남길지 판정한다.
 *
 * "준비했어요"(prepared)에서만 남긴다. "괜찮아요"(not_needed)는 **사지 않기로 한** 판단이라
 * 지출이 있을 수 없고, 거기서 지출 기록을 권하면 판단을 되묻는 잔소리가 된다(DNC-018).
 *
 * 남길 때는 지금 화면 좌표(`scope`)를 함께 박아 둔다 — 그래야 나중에 "아직 그 목록인가"를
 * 되물을 수 있다(G-3).
 */
export function nextExpenseLinkPrompt(input: {
  itemTemplateId: string;
  itemName: string;
  status: ItemStatus;
  scope: ExpenseLinkPromptScope;
}): ExpenseLinkPrompt | null {
  if (input.status !== "prepared") return null;
  if (!input.itemTemplateId || !input.itemName) return null;
  return { itemTemplateId: input.itemTemplateId, itemName: input.itemName, scope: input.scope };
}

/**
 * 프롬프트를 어디에 그릴지.
 *
 * - `"inline"`: 그 행이 아직 목록에 보인다 -> 행 바로 아래 한 줄. 이름이 바로 위에 있으므로
 *   문구에 이름을 넣지 않는다(행 높이 변화 최소화).
 * - `"detached"`: 행이 목록에서 빠졌다 -> 목록 위 한 줄. "지금 필요" 탭에서 준비했어요를
 *   누르면 그 항목은 준비완료 탭으로 옮겨 가 **행 자체가 사라진다**. 그때 인라인만
 *   그리면 링크가 깜빡이고 없어져 기능이 사실상 죽는다(가장 흔한 경로가 바로 이 경로다).
 *   같은 한 줄 링크를 자리만 옮겨 그리고, 어느 준비템인지 이름을 붙인다.
 * - `"none"`: 세션이 없거나, 남겨 둔 프롬프트가 없거나, 남아 있어도 **지금 목록의 것이 아니다**
 *   (G-3: 아이 전환·시기 밴드·필터·검색 변경. 상태에서 걷히기 전에도 그리지 않는다).
 */
export type ExpenseLinkPromptPlacement = "none" | "inline" | "detached";

export function expenseLinkPromptPlacement(input: {
  hasSession: boolean;
  prompt: ExpenseLinkPrompt | null | undefined;
  scope: ExpenseLinkPromptScope;
  visibleItemIds: readonly string[];
}): ExpenseLinkPromptPlacement {
  if (!input.hasSession) return "none";
  if (!input.prompt) return "none";
  if (isExpenseLinkPromptStale({ prompt: input.prompt, scope: input.scope })) return "none";
  return input.visibleItemIds.includes(input.prompt.itemTemplateId) ? "inline" : "detached";
}

/** 이 행이 인라인 링크를 달아야 하는 행인가 (한 행에서만 보인다). */
export function isExpenseLinkPromptRow(input: {
  placement: ExpenseLinkPromptPlacement;
  prompt: ExpenseLinkPrompt | null | undefined;
  itemTemplateId: string;
}): boolean {
  if (input.placement !== "inline") return false;
  return input.prompt?.itemTemplateId === input.itemTemplateId;
}

/**
 * 자리에 맞는 눈에 보이는 문구.
 *
 * 떨어져 나온 줄에는 이름을 『』로 감싸 붙인다 — 구매 확인 프롬프트
 * (src/commerce/PurchaseFollowupPrompt.tsx)가 쓰는 것과 같은 표기 관례다.
 */
export function itemListExpenseLinkLabel(placement: ExpenseLinkPromptPlacement, itemName: string): string {
  if (placement === "detached") return `『${itemName}』 ${ITEM_LIST_EXPENSE_LINK_LABEL}`;
  return ITEM_LIST_EXPENSE_LINK_LABEL;
}

/** 두 자리 모두 스크린 리더에는 이름을 함께 읽어 준다(인라인은 시각적 인접에만 기댈 수 없다). */
export function itemListExpenseLinkAccessibilityLabel(itemName: string): string {
  return `${itemName} ${ITEM_LIST_EXPENSE_LINK_LABEL}`;
}
