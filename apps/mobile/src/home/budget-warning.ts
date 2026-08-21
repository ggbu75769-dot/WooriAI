import { formatKrw } from "../money";

/**
 * HOME-BUDGET-113 home budget warning banner -- pure decision logic.
 *
 * Input contract:
 * - `budgetKrw` is HomeSummary.monthly.amountKrw. The home API returns 0 when no monthly budget
 *   is set, so 0 (or nullish/invalid) means "no budget" and never warns.
 * - `spentKrw` is HomeSummary.monthly.usedAmountKrw -- the month-to-date total that ALREADY
 *   excludes gifts per DNC-015 (both apps/api and src/api/local-backend.ts sum only
 *   expenseType === "expense" records, see totalExpenseKrw). Callers must pass that
 *   gift-excluded total, never a re-derived sum that includes gift records.
 *
 * Buckets (HOME-BUDGET-113):
 * - under 80%              -> no banner (null)
 * - 80% <= usage < 100%    -> "approaching": "이번 달 예산의 N%를 사용했어요"
 * - usage >= 100%          -> "exceeded":    "이번 달 예산을 N원 초과했어요"
 *
 * Details:
 * - Thresholds are compared in exact integer arithmetic (KRW amounts are integers, DNC-013),
 *   so 80% has no floating-point edge: spent*5 >= budget*4 is exactly "usage >= 80%".
 * - The approaching percent is Math.floor, never Math.round -- 99.6% must display as 99%,
 *   because displaying "100%" while still under budget would be false data.
 * - Spending EXACTLY the budget lands in the exceeded bucket per the ticket ("100% 이상"),
 *   but with dedicated copy "이번 달 예산을 모두 사용했어요": claiming "0원 초과했어요" would be
 *   false (the home screen's isOverBudget and NOTI-102's budget_100 both keep strict > for
 *   "초과" for the same reason), while hiding the banner would violate the 100%-bucket rule.
 */

export type BudgetWarningLevel = "approaching" | "exceeded";

export type BudgetWarning = {
  level: BudgetWarningLevel;
  /** Floored usage percent (only meaningful for display; >= 100 in the exceeded bucket). */
  usedPercent: number;
  /** KRW over budget; 0 when spending equals the budget exactly. */
  overAmountKrw: number;
  /** Banner headline -- carries the meaning in text (never color-only). */
  title: string;
  /** Supporting line, 해요체 tone per DNC-018. */
  body: string;
};

export type BudgetWarningInput = {
  /** HomeSummary.monthly.amountKrw -- 0/nullish means "no budget set". */
  budgetKrw: number | null | undefined;
  /** HomeSummary.monthly.usedAmountKrw -- gift-excluded month total (DNC-015). */
  spentKrw: number | null | undefined;
};

export function evaluateBudgetWarning(input: BudgetWarningInput): BudgetWarning | null {
  const budgetKrw = input.budgetKrw;
  const spentKrw = input.spentKrw;
  if (typeof budgetKrw !== "number" || !Number.isFinite(budgetKrw) || budgetKrw <= 0) return null;
  if (typeof spentKrw !== "number" || !Number.isFinite(spentKrw) || spentKrw <= 0) return null;

  const usedPercent = Math.floor((spentKrw * 100) / budgetKrw);

  if (spentKrw >= budgetKrw) {
    const overAmountKrw = spentKrw - budgetKrw;
    return {
      level: "exceeded",
      usedPercent,
      overAmountKrw,
      title:
        overAmountKrw > 0
          ? `이번 달 예산을 ${formatKrw(overAmountKrw)} 초과했어요`
          : "이번 달 예산을 모두 사용했어요",
      body: "이번 달 지출을 확인해 볼까요?"
    };
  }

  // Exact integer comparison for "usage >= 80%" (spent/budget >= 4/5).
  if (spentKrw * 5 >= budgetKrw * 4) {
    return {
      level: "approaching",
      usedPercent,
      overAmountKrw: 0,
      title: `이번 달 예산의 ${usedPercent}%를 사용했어요`,
      body: "남은 예산을 확인해보세요."
    };
  }

  return null;
}
