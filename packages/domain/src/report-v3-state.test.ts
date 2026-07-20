import { describe, expect, it } from "vitest";
import { resolveReportV3State } from "./report-v3-state";

describe("Report V3 display state", () => {
  it.each([
    [{ actualRecordCount: 0, plannedPreparationCostKrw: 0, recurringPlanCount: 0, monthlyRecurringEstimateKrw: 0 }, "complete_empty"],
    [{ actualRecordCount: 0, plannedPreparationCostKrw: 120_000, recurringPlanCount: 0, monthlyRecurringEstimateKrw: 0 }, "planned_only"],
    [{ actualRecordCount: 0, plannedPreparationCostKrw: 0, recurringPlanCount: 1, monthlyRecurringEstimateKrw: 35_000 }, "planned_only"],
    [{ actualRecordCount: 1, plannedPreparationCostKrw: 0, recurringPlanCount: 0, monthlyRecurringEstimateKrw: 0 }, "actual_only"],
    [{ actualRecordCount: 1, plannedPreparationCostKrw: 120_000, recurringPlanCount: 0, monthlyRecurringEstimateKrw: 0 }, "combined"]
  ] as const)("resolves %o as %s", (input, expected) => {
    expect(resolveReportV3State(input).displayState).toBe(expected);
  });
});
