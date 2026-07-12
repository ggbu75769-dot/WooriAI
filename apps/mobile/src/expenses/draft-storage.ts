import { persistStorage } from "../stores/persist-storage";

export type QuickExpenseDraft = {
  itemName: string;
  amountText: string;
  memo: string;
  categoryId: string;
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
