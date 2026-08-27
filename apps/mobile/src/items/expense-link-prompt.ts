import type { ItemStatus } from "@wooriai/domain";

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
 * 준비템 → 지출 기록 프리필 파라미터.
 *
 * 계약은 app/expenses/new.tsx가 정한다(`useLocalSearchParams<{ itemName?, itemTemplateId? }>`).
 * 새 파라미터를 더하지 않는 것이 요점이다 — 저장 경로가 갈라지면 "지출을 저장하면 준비템도
 * 준비 완료로 표시된다"는 서버 쪽 연결(R19-B)이 한쪽에서만 동작한다.
 */
export function expenseLinkParams(input: ExpenseLinkParams): ExpenseLinkParams {
  return { itemName: input.itemName, itemTemplateId: input.itemTemplateId };
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
 * 상세 진입점 노출 조건 — 세션이 있을 때만.
 *
 * 비세션(미리보기)에서는 렌더 자체를 하지 않는다. (1) 기록할 대상이 없고, (2) 픽셀 락
 * ITEM-002 캡처가 세션을 지운 프리뷰 렌더라(app/pixel-lock.tsx) 버튼이 한 줄 더 들어가면
 * 기준 이미지와 어긋난다. 같은 화면의 "선물로 받았어요"(ITEM-123 리뷰 F1)와 같은 게이트다.
 */
export function shouldShowItemDetailExpenseLink(input: { hasSession: boolean }): boolean {
  return input.hasSession;
}

/** 목록 행 아래 한 줄 인라인 링크 문구. */
export const ITEM_LIST_EXPENSE_LINK_LABEL = "지출도 기록할까요?";

/** 목록 화면이 기억하는 "방금 준비했어요를 누른 행". 한 번에 하나만 있다. */
export type ExpenseLinkPrompt = {
  itemTemplateId: string;
  itemName: string;
};

/**
 * 상태 변경 성공 직후 프롬프트를 남길지 판정한다.
 *
 * "준비했어요"(prepared)에서만 남긴다. "괜찮아요"(not_needed)는 **사지 않기로 한** 판단이라
 * 지출이 있을 수 없고, 거기서 지출 기록을 권하면 판단을 되묻는 잔소리가 된다(DNC-018).
 */
export function nextExpenseLinkPrompt(input: {
  itemTemplateId: string;
  itemName: string;
  status: ItemStatus;
}): ExpenseLinkPrompt | null {
  if (input.status !== "prepared") return null;
  if (!input.itemTemplateId || !input.itemName) return null;
  return { itemTemplateId: input.itemTemplateId, itemName: input.itemName };
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
 * - `"none"`: 세션이 없거나 남겨 둔 프롬프트가 없다.
 */
export type ExpenseLinkPromptPlacement = "none" | "inline" | "detached";

export function expenseLinkPromptPlacement(input: {
  hasSession: boolean;
  prompt: ExpenseLinkPrompt | null | undefined;
  visibleItemIds: readonly string[];
}): ExpenseLinkPromptPlacement {
  if (!input.hasSession) return "none";
  if (!input.prompt) return "none";
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
