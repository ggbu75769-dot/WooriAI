import { describe, expect, it } from "vitest";
import { reportCategoriesSchema, reportSourcesSchema, reportSummarySchema } from "./release4-reports";

describe("Release 4 report contracts", () => {
  const period = {
    householdId: "f48cd188-2b83-4be1-90db-a9f0d089586e",
    childId: "d1976ad7-0f5e-4f58-86f1-29b70f4a294d",
    kind: "month" as const,
    anchor: "2026-07-15",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    periodEndExclusive: "2026-08-01",
    timezone: "Asia/Seoul" as const,
    currency: "KRW" as const,
    from: "2026-07-01",
    to: "2026-07-31"
  };
  const maturity = { recordCount: 3, distinctMonths: 1, distinctMembers: 1, level: "categorized", showCategories: true, showTrend: false, showRecurring: false, showMembers: false, showAnnual: false } as const;
  const totals = { expenseKrw: 10000, giftKrw: 3000, refundKrw: 1000, supportKrw: 2000, netHouseholdOutflowKrw: 7000, linkedPreparationCostKrw: 5000, unlinkedCostKrw: 2000, recordCount: 4 };

  it("keeps expense, gift, refund, support, linked, and unlinked values separate", () => {
    const previousPeriodComparison = { periodStart: "2026-06-01", periodEnd: "2026-06-30", currentNetOutflowKrw: 7000, previousNetOutflowKrw: 5000, deltaKrw: 2000, deltaPercentage: 40 };
    const parsed = reportSummarySchema.parse({
      period,
      totals,
      periodStart: period.periodStart,
      periodEndExclusive: period.periodEndExclusive,
      timezone: period.timezone,
      currency: period.currency,
      expenseTotal: totals.expenseKrw,
      refundTotal: totals.refundKrw,
      giftTotal: totals.giftKrw,
      supportTotal: totals.supportKrw,
      netOutflow: totals.netHouseholdOutflowKrw,
      categoryBreakdown: [{ ...totals, categoryCode: "other", categoryNameKo: "기타", percentage: 100 }],
      series: [{ ...totals, key: "2026-07", label: "7월" }],
      dataMaturity: maturity,
      previousPeriodComparison,
      maturity,
      recent: []
    });
    expect(parsed.totals).toEqual(totals);
    expect(parsed.categoryBreakdown.reduce((sum, row) => sum + row.netHouseholdOutflowKrw, 0)).toBe(parsed.netOutflow);
    expect(parsed.series.reduce((sum, row) => sum + row.netHouseholdOutflowKrw, 0)).toBe(parsed.netOutflow);
    expect(parsed.previousPeriodComparison).toEqual(previousPeriodComparison);
  });

  it("requires category percentages to be explicit and bounded", () => {
    const parsed = reportCategoriesSchema.parse({ period, maturity, percentageTotal: 100, categories: [{ ...totals, categoryId: "other", categoryCode: "other", categoryNameKo: "기타", percentage: 100 }] });
    expect(parsed.percentageTotal).toBe(100);
  });

  it("keeps planned and actual source rows discriminated", () => {
    const parsed = reportSourcesSchema.parse({
      period,
      kind: "planned",
      totals: { amountKrw: 120000, signedAmountKrw: 120000, recordCount: 1 },
      pageTotals: { amountKrw: 120000, signedAmountKrw: 120000, recordCount: 1 },
      nextCursor: null,
      items: [{
        sourceType: "plan",
        id: "bb0ef066-c858-4a14-9a06-e89f26e519b2",
        itemDefinitionId: "a7c0f289-3b25-4f7b-88d5-42973e8e8c2c",
        itemName: "카시트",
        state: "planned",
        amountKrw: 120000,
        signedAmountKrw: 120000,
        dueDate: null,
        recurringIntervalDays: null
      }]
    });
    expect(parsed.items[0].sourceType).toBe("plan");
  });
});
