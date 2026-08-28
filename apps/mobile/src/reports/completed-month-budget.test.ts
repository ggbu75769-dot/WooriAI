import { describe, expect, it } from "vitest";
import { buildCompletedMonthBudgetLine, monthlyInsightSpokeBudget } from "./completed-month-budget";
import { buildMonthlyInsight, type MonthlyInsight } from "./monthly-insight";

/**
 * GAP-066 트랙 A(#1) — 끝난 달의 예산 결과 한 줄.
 *
 * 이 테스트가 붙드는 사실 넷:
 *  1. **끝난 달에만** 선다(진행 중인 달은 홈이 이미 말하고 있다).
 *  2. 예산이 없는 달·지출이 0원인 달에는 줄이 **아예 없다**(없는 사실을 지어내지 않는다).
 *  3. 초과한 달은 퍼센트가 아니라 **초과 금액**을 말한다(홈 퍼센트가 100%에서 잘리므로).
 *  4. 인사이트 카드가 이미 예산을 말한 달에는 접는다(한 화면에서 같은 사실을 두 번 말하지 않는다).
 */

const TODAY = "2026-08-27";

const categoryLabel = (categoryId: string) => (categoryId === "diaper" ? "기저귀/위생" : "기타");

describe("끝난 달의 예산 결과 한 줄", () => {
  it("끝난 달에는 예산 금액과 사용률을 함께 말한다", () => {
    expect(
      buildCompletedMonthBudgetLine({
        yearMonth: "2026-07",
        monthStatus: "complete",
        budgetAmountKrw: 200_000,
        totalExpenseKrw: 156_000
      })
    ).toBe("7월은 예산 200,000원의 78%를 썼어요");
  });

  it("예산을 넘긴 달은 퍼센트 대신 초과 금액을 말한다 (100% 캡이 130%를 감추지 않게)", () => {
    expect(
      buildCompletedMonthBudgetLine({
        yearMonth: "2026-07",
        monthStatus: "complete",
        budgetAmountKrw: 200_000,
        totalExpenseKrw: 232_000
      })
    ).toBe("7월은 예산 200,000원보다 32,000원 많이 썼어요");
  });

  it("정확히 다 쓴 달은 초과 금액이 없으므로 100%로 말한다", () => {
    expect(
      buildCompletedMonthBudgetLine({
        yearMonth: "2026-07",
        monthStatus: "complete",
        budgetAmountKrw: 200_000,
        totalExpenseKrw: 200_000
      })
    ).toBe("7월은 예산 200,000원의 100%를 썼어요");
  });

  it("진행 중인 달·아직 오지 않은 달에는 줄이 없다 (홈이 이미 말하고 있다)", () => {
    const shared = { yearMonth: "2026-08", budgetAmountKrw: 200_000, totalExpenseKrw: 156_000 } as const;
    expect(buildCompletedMonthBudgetLine({ ...shared, monthStatus: "in-progress" })).toBeNull();
    expect(buildCompletedMonthBudgetLine({ ...shared, monthStatus: "future" })).toBeNull();
    expect(buildCompletedMonthBudgetLine({ ...shared, monthStatus: null })).toBeNull();
  });

  it("근거가 없으면 줄을 만들지 않는다 (예산 미설정 · 지출 0원 · 형식 오염)", () => {
    const complete = { yearMonth: "2026-07", monthStatus: "complete" } as const;
    expect(buildCompletedMonthBudgetLine({ ...complete, budgetAmountKrw: null, totalExpenseKrw: 156_000 })).toBeNull();
    expect(buildCompletedMonthBudgetLine({ ...complete, budgetAmountKrw: 0, totalExpenseKrw: 156_000 })).toBeNull();
    expect(buildCompletedMonthBudgetLine({ ...complete, budgetAmountKrw: 200_000, totalExpenseKrw: 0 })).toBeNull();
    expect(buildCompletedMonthBudgetLine({ ...complete, budgetAmountKrw: 200_000, totalExpenseKrw: null })).toBeNull();
    expect(
      buildCompletedMonthBudgetLine({ yearMonth: "2026-13", monthStatus: "complete", budgetAmountKrw: 200_000, totalExpenseKrw: 1 })
    ).toBeNull();
  });

  it("퍼센트는 홈 히어로와 **같은 함수**의 답이다 (미소진 100% 금지 캡 포함)", () => {
    // 199,999 / 200,000 = 99.9995% -- 반올림만으로 100%가 되는 구간은 99로 캡된다(라운드 37 G-2).
    expect(
      buildCompletedMonthBudgetLine({
        yearMonth: "2026-07",
        monthStatus: "complete",
        budgetAmountKrw: 200_000,
        totalExpenseKrw: 199_999
      })
    ).toBe("7월은 예산 200,000원의 99%를 썼어요");
  });
});

describe("인사이트가 이미 예산을 말한 달에는 접는다", () => {
  const insightFor = (input: { categoryTop?: { categoryId: string; amountKrw: number }[]; previousMonthTotalKrw: number }) =>
    buildMonthlyInsight({
      yearMonth: "2026-07",
      todayIso: TODAY,
      totalExpenseKrw: 156_000,
      budgetAmountKrw: 200_000,
      categoryTop: input.categoryTop,
      categoryLabel,
      previousMonthTotalKrw: input.previousMonthTotalKrw
    });

  it("카테고리 1위와 지난달 비교가 **둘 다** 있으면 예산 문장이 밀려나므로 줄이 선다", () => {
    const insight = insightFor({ categoryTop: [{ categoryId: "diaper", amountKrw: 156_000 }], previousMonthTotalKrw: 124_000 });
    expect(insight?.sentences).toHaveLength(2);
    expect(insight?.sentences.some((sentence) => sentence.includes("예산"))).toBe(false);
    expect(monthlyInsightSpokeBudget(insight)).toBe(false);
  });

  it("지난달이 0원인 달(사실상 첫 달)에는 인사이트가 예산을 말하므로 줄을 접는다", () => {
    const insight = insightFor({ categoryTop: [{ categoryId: "diaper", amountKrw: 156_000 }], previousMonthTotalKrw: 0 });
    expect(insight?.sentences.some((sentence) => sentence.includes("예산"))).toBe(true);
    expect(monthlyInsightSpokeBudget(insight)).toBe(true);
  });

  it("카테고리 분해가 아직 없으면 인사이트가 비교+예산을 말하므로 줄을 접는다", () => {
    const insight = insightFor({ categoryTop: undefined, previousMonthTotalKrw: 124_000 });
    expect(insight?.sentences.some((sentence) => sentence.includes("예산"))).toBe(true);
    expect(monthlyInsightSpokeBudget(insight)).toBe(true);
  });

  it("카드가 없거나 진행 중인 달이면 '말한 것'도 없다", () => {
    expect(monthlyInsightSpokeBudget(null)).toBe(false);
    expect(monthlyInsightSpokeBudget(undefined)).toBe(false);
    const inProgress = buildMonthlyInsight({
      yearMonth: "2026-08",
      todayIso: TODAY,
      totalExpenseKrw: 156_000,
      budgetAmountKrw: 200_000,
      categoryTop: [{ categoryId: "diaper", amountKrw: 156_000 }],
      categoryLabel,
      previousMonthTotalKrw: 124_000
    }) as MonthlyInsight;
    expect(inProgress.monthStatus).toBe("in-progress");
    expect(monthlyInsightSpokeBudget(inProgress)).toBe(false);
  });
});
