import { describe, expect, it } from "vitest";
import { reportSourceRoute, restoreReportViewState } from "./source-navigation";

describe("Report source navigation", () => {
  it("preserves period offset and selected section across drill-down navigation", () => {
    expect(restoreReportViewState({
      reportPeriod: "quarter",
      reportOffset: "-2",
      reportSection: "preparation"
    })).toEqual({ period: "분기", offset: -2, section: "preparation" });
    expect(reportSourceRoute({
      householdId: "household-1",
      childId: "child-1",
      period: "quarter",
      anchor: "2026-01-01",
      kind: "planned"
    })).toEqual({
      pathname: "/reports/sources",
      params: {
        householdId: "household-1",
        childId: "child-1",
        period: "quarter",
        anchor: "2026-01-01",
        kind: "planned"
      }
    });
  });

  it("rejects stale household, child, period, and anchor source responses", async () => {
    const { reportSourceScopeMatches } = await import("./source-navigation");
    const expected = {
      householdId: "household-1",
      childId: "child-1",
      period: "quarter",
      anchor: "2026-01-01"
    };
    expect(reportSourceScopeMatches({
      householdId: "household-1",
      childId: "child-1",
      kind: "quarter",
      anchor: "2026-01-01"
    }, expected)).toBe(true);
    for (const actual of [
      { householdId: "household-2", childId: "child-1", kind: "quarter", anchor: "2026-01-01" },
      { householdId: "household-1", childId: "child-2", kind: "quarter", anchor: "2026-01-01" },
      { householdId: "household-1", childId: "child-1", kind: "month", anchor: "2026-01-01" },
      { householdId: "household-1", childId: "child-1", kind: "quarter", anchor: "2026-04-01" }
    ]) {
      expect(reportSourceScopeMatches(actual, expected)).toBe(false);
    }
  });

  it("fails closed to the summary view for invalid route parameters", () => {
    expect(restoreReportViewState({
      reportPeriod: "week",
      reportOffset: "NaN",
      reportSection: "internal_selector_code"
    })).toEqual({ period: "월간", offset: 0, section: "summary" });
  });
});
