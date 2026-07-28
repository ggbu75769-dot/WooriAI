import { describe, expect, it } from "vitest";
import { canShowTrend, mergeCategoryReports, monthsForPeriod } from "./period-aggregation";

describe("Release 4 report period aggregation", () => {
  it("uses only the selected month, quarter, or year", () => {
    const anchor = new Date(2026, 6, 1);
    expect(monthsForPeriod("월간", anchor)).toEqual(["2026-07"]);
    expect(monthsForPeriod("분기", anchor)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(monthsForPeriod("연간", anchor)).toHaveLength(12);
    expect(monthsForPeriod("연간", anchor).at(-1)).toBe("2026-12");
  });

  it("merges category rows from the selected period instead of reusing all-time data", () => {
    expect(
      mergeCategoryReports([
        { childId: "child", categories: [{ categoryId: "health", amountKrw: 1000, count: 1 }] },
        {
          childId: "child",
          categories: [
            { categoryId: "health", amountKrw: 2000, count: 2 },
            { categoryId: "care", amountKrw: 4000, count: 1 }
          ]
        }
      ])
    ).toEqual([
      { categoryId: "care", amountKrw: 4000, count: 1 },
      { categoryId: "health", amountKrw: 3000, count: 3 }
    ]);
  });

  it("never renders a trend from zero or one populated period", () => {
    expect(canShowTrend(undefined)).toBe(false);
    expect(canShowTrend([0, 0, 0])).toBe(false);
    expect(canShowTrend([0, 1000, 0])).toBe(false);
    expect(canShowTrend([1000, 2000, 0])).toBe(true);
  });
});
