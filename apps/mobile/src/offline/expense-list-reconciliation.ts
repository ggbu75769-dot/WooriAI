import type { LocalExpenseRow } from "./types";

/**
 * H-2 fix (diff review): the records screen (app/(tabs)/records.tsx) renders the server's
 * listExpenses response merged with any not-yet-synced local rows. Editing or deleting an
 * *existing* server expense goes through adoptServerExpense, which reuses the server's expense
 * id as `canonicalId` on an otherwise-normal local_expenses row -- so while that edit/delete is
 * still unsynced, the server's listExpenses response still returns the OLD row (the server
 * hasn't seen the change yet) *in addition to* the local row reflecting the new value or
 * pending-delete. Naively concatenating both lists would show a duplicate row and double-count
 * the total (old amount + new amount, or an amount that should already be gone for a pending
 * delete). This module is the single place that reconciles the two into one consistent view,
 * kept dependency-free (no React/React Native imports) so it's directly unit-testable and usable
 * from both sync-controller.ts and records.tsx without pulling in native modules.
 */

type ServerExpenseLike = {
  id: string;
  amountKrw: number;
  expenseType: string;
};

export type MonthlyExpenseReconciliation<TServerExpense extends ServerExpenseLike> = {
  /** Server-sourced expenses for the month, minus any whose canonicalId has an outstanding
   * local mutation (edit, pending delete, failed, or conflict) -- those are stale and superseded
   * by (or about to be removed by) the corresponding offline row instead. */
  visibleServerExpenses: TServerExpense[];
  /** Local-only rows to render *instead of* the now-hidden stale server rows: excludes
   * `pendingDelete` rows (nothing to show for a record on its way out) and fully-'synced' rows
   * (those are already reflected correctly in the server list). */
  offlinePendingRows: LocalExpenseRow[];
  /** Sum of `visibleServerExpenses` + `offlinePendingRows`, excluding gifts -- computed directly
   * from the already-deduped sets above so it can never drift from what's actually listed. */
  monthlyTotalKrw: number;
};

export function reconcileMonthlyExpenses<TServerExpense extends ServerExpenseLike>(
  serverExpenses: TServerExpense[],
  childOfflineRows: LocalExpenseRow[],
  recordsYearMonth: string
): MonthlyExpenseReconciliation<TServerExpense> {
  const staleServerCanonicalIds = new Set(
    childOfflineRows
      .filter((row) => row.canonicalId && row.syncState !== "synced")
      .map((row) => row.canonicalId as string)
  );

  const visibleServerExpenses = serverExpenses.filter((expense) => !staleServerCanonicalIds.has(expense.id));

  const offlinePendingRows = childOfflineRows.filter(
    (row) => row.syncState !== "synced" && !row.pendingDelete && row.payload.spentOn.startsWith(recordsYearMonth)
  );

  const monthlyTotalKrw =
    visibleServerExpenses
      .filter((expense) => expense.expenseType !== "gift")
      .reduce((sum, expense) => sum + expense.amountKrw, 0) +
    offlinePendingRows
      .filter((row) => row.payload.expenseType !== "gift")
      .reduce((sum, row) => sum + row.payload.amountKrw, 0);

  return { visibleServerExpenses, offlinePendingRows, monthlyTotalKrw };
}
