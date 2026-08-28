import { persistStorage } from "../stores/persist-storage";

export type QuickExpenseDraft = {
  itemName: string;
  amountText: string;
  memo: string;
  /**
   * 라운드 51 C-#5: **선택 사항**이다. 기록 시트의 초기 상태가 "미선택"이 되면서, 분류를
   * 고르지 않은 채 닫은 초안이 정상적인 값이 됐다. 복원 쪽은 이 값이 8타일 중 하나일 때만
   * 타일을 눌러 준다(없거나 못 찾으면 미선택 그대로 -- 자동 추천도 계속 돈다).
   */
  categoryId?: string;
  spentOnIso: string;
  isGift: boolean;
};

const QUICK_EXPENSE_DRAFT_KEY = "wooriai-quick-expense-draft";

export async function readQuickExpenseDraft(): Promise<QuickExpenseDraft | null> {
  const raw = await persistStorage.getItem(QUICK_EXPENSE_DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as QuickExpenseDraft;
  } catch {
    return null;
  }
}

export async function writeQuickExpenseDraft(draft: QuickExpenseDraft): Promise<void> {
  await persistStorage.setItem(QUICK_EXPENSE_DRAFT_KEY, JSON.stringify(draft));
}

export async function clearQuickExpenseDraft(): Promise<void> {
  await persistStorage.removeItem(QUICK_EXPENSE_DRAFT_KEY);
}
