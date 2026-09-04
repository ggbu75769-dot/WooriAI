import { reachedBudgetBoundaries } from "@wooriai/domain";
import { formatKrw } from "../money";

/**
 * HOME-BUDGET-113 home budget warning banner -- copy + level, on top of the shared boundary rule.
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
 * - R19-D: the 80%/100% judgement itself now lives in @wooriai/domain's reachedBudgetBoundaries
 *   (packages/domain/src/budget-boundary.ts) -- the SAME function the in-app notification
 *   generator (src/notifications/generators.ts) and the server push dispatcher
 *   (apps/api/src/push/push-dispatch.service.ts) call, so the three surfaces can no longer drift.
 *   Only the copy/level mapping below is home-screen specific. Thresholds are integer arithmetic
 *   (KRW amounts are integers, DNC-013), so 80% has no floating-point edge.
 * - The approaching percent is Math.floor, never Math.round -- 99.6% must display as 99%,
 *   because displaying "100%" while still under budget would be false data.
 * - Spending EXACTLY the budget lands in the exceeded bucket per the ticket ("100% 이상"),
 *   but with dedicated copy "이번 달 예산을 모두 사용했어요": claiming "0원 초과했어요" would be
 *   false, while hiding the banner would violate the 100%-bucket rule. That is exactly the
 *   domain module's reached100 (도달) vs exceeded (strict >, 초과) split.
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
  // Shared judgement (R19-D). The domain function is total: no-budget / zero / invalid input all
  // come back as "no boundary reached", which is exactly the banner's silent case.
  const status = reachedBudgetBoundaries(input);
  if (!status.reached80) return null;

  if (status.reached100) {
    return {
      level: "exceeded",
      usedPercent: status.usedPercent,
      overAmountKrw: status.overAmountKrw,
      title: status.exceeded
        ? `이번 달 예산을 ${formatKrw(status.overAmountKrw)} 초과했어요`
        : "이번 달 예산을 모두 사용했어요",
      body: "이번 달 지출을 확인해 볼까요?"
    };
  }

  return {
    level: "approaching",
    usedPercent: status.usedPercent,
    overAmountKrw: 0,
    title: `이번 달 예산의 ${status.usedPercent}%를 사용했어요`,
    body: "남은 예산을 확인해 보세요."
  };
}
