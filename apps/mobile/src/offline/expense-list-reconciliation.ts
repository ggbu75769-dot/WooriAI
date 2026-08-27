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
   * (those are already reflected correctly in the server list). Exception (COV-T5 bug 3):
   * a 'conflict' row stays visible even when `pendingDelete` is true -- the server contested
   * the delete, so the expense is still live server-side and vanishing it from the list and
   * the monthly total would misreport reality. It renders as a conflict row like any other
   * (records.tsx shows the ⚠ conflict icon with the "삭제 대기 중" subtitle) and its amount is
   * counted the same way every other conflict row's is: from its local payload. */
  offlinePendingRows: LocalExpenseRow[];
  /** Sum of `visibleServerExpenses` + `offlinePendingRows`, counting only real expenses
   * (`expenseType === "expense"`) -- computed directly from the already-deduped sets above so it
   * can never drift from what's actually listed. See `countsTowardMonthlyTotal`. */
  monthlyTotalKrw: number;
};

/**
 * REC-121b: 월 합계에 잡히는 행인지 판정한다 — 서버 집계와 **같은 술어**를 쓴다.
 *
 * 서버의 `sumExpenses`(apps/api/src/onboarding/expenses-store.service.ts)는 `expenseType ===
 * "expense"`만 더해 선물(gift)과 환불(refund)을 **둘 다** 제외한다(DNC-015). 홈의 총액·예산
 * 사용액과 리포트 월 합계가 전부 그 집계다. 그런데 여기서는 `!== "gift"`로만 걸러 환불을
 * 지출처럼 더하고 있었고, 그래서 환불 행이 있는 달에는 홈/리포트와 기록 탭 합계가 어긋났다
 * (REC-121이 "곁가지로 드러난 불일치"로 문서화만 하고 남긴 항목).
 *
 * 화이트리스트(`=== "expense"`)가 블랙리스트(`!== "gift"`)보다 안전하기도 하다 — 서버가 새
 * `expenseType`을 추가해도 기록 탭이 그걸 자동으로 지출로 세지 않는다.
 *
 * `expenseType`이 없는 레거시 페이로드는 expense로 간주한다 — src/expenses/recent-items.ts의
 * 관례와 동일하고, 필드가 도입되기 전에 저장된 오프라인 행을 합계에서 통째로 떨어뜨리지
 * 않기 위해서다. (오프라인 저장소의 ExpenseKind는 아직 "expense" | "gift"뿐이라 환불은 서버
 * 목록으로만 들어오지만, 두 집합에 같은 규칙을 적용해 두는 편이 드리프트를 막는다.)
 *
 * 정밀 리뷰 F3(부수): src/home/last-month-comparison.ts의 sumMonthExpensesThroughDay가 이 술어를
 * **그대로 import해서** 쓴다. 기록 탭의 "지난달 같은 시점 대비" 한 줄은 이번 달 항을 여기서,
 * 지난달 항을 저기서 계산하므로 두 곳의 규칙이 갈리면 그 자체가 허위 비교가 된다. 예전에는
 * 저쪽이 `!== "expense"`로 걸러 `expenseType` 없는 레거시 로컬 행을 떨어뜨렸다 -- 같은 행이
 * 이번 달에는 세어지고 지난달에는 빠지는 비대칭이었다. 술어를 한 곳(여기)에만 두어 막는다.
 */
export function countsTowardMonthlyTotal(expenseType: string | null | undefined): boolean {
  return expenseType === undefined || expenseType === null || expenseType === "expense";
}

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
    (row) =>
      row.syncState !== "synced" &&
      // COV-T5 bug 3: a pendingDelete row is hidden while the delete is merely queued, but a
      // delete the server CONTESTED ('conflict') must stay visible -- see the doc comment above.
      (row.syncState === "conflict" || !row.pendingDelete) &&
      row.payload.spentOn.startsWith(recordsYearMonth)
  );

  const monthlyTotalKrw =
    visibleServerExpenses
      .filter((expense) => countsTowardMonthlyTotal(expense.expenseType))
      .reduce((sum, expense) => sum + expense.amountKrw, 0) +
    offlinePendingRows
      .filter((row) => countsTowardMonthlyTotal(row.payload.expenseType))
      .reduce((sum, row) => sum + row.payload.amountKrw, 0);

  return { visibleServerExpenses, offlinePendingRows, monthlyTotalKrw };
}
