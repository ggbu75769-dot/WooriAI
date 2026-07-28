import { describe, expect, it } from "vitest";
import { buildReportRequestPlan } from "./request-plan";

describe("Report V3 initial request plan", () => {
  it.each(["월간", "분기", "연간"] as const)(
    "uses only the aggregate source in production for %s",
    (period) => {
      expect(
        buildReportRequestPlan({ hasSession: true, pixelLockMode: false, period })
      ).toEqual({
        aggregate: true,
        legacyMonthly: false,
        legacyPreviousMonth: false,
        legacyCumulative: false,
        legacyCategory: false,
        legacyQuarter: false,
        legacyYear: false,
        legacyMonthlyTrend: false
      });
    }
  );

  it("does not request report data before a session and child are available", () => {
    expect(
      Object.values(
        buildReportRequestPlan({ hasSession: false, pixelLockMode: false, period: "월간" })
      ).some(Boolean)
    ).toBe(false);
  });
});
