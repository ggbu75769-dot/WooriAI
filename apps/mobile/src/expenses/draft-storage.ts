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

let quickExpenseDraftStorageQueue: Promise<void> = Promise.resolve();

function withQuickExpenseDraftStorageLock<T>(work: () => Promise<T>): Promise<T> {
  const operation = quickExpenseDraftStorageQueue.then(work, work);
  quickExpenseDraftStorageQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function readQuickExpenseDraft(): Promise<QuickExpenseDraft | null> {
  return withQuickExpenseDraftStorageLock(async () => {
    const raw = await persistStorage.getItem(QUICK_EXPENSE_DRAFT_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed as QuickExpenseDraft;
    } catch {
      return null;
    }
  });
}

export async function writeQuickExpenseDraft(draft: QuickExpenseDraft): Promise<void> {
  await withQuickExpenseDraftStorageLock(async () => {
    await persistStorage.setItem(QUICK_EXPENSE_DRAFT_KEY, JSON.stringify(draft));
  });
}

export async function clearQuickExpenseDraft(): Promise<void> {
  await withQuickExpenseDraftStorageLock(async () => {
    await persistStorage.removeItem(QUICK_EXPENSE_DRAFT_KEY);
  });
}
