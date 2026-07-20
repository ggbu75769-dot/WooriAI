export type ReportV3DisplayState = "complete_empty" | "planned_only" | "actual_only" | "combined";

export function resolveReportV3State(input: {
  actualRecordCount: number;
  plannedPreparationCostKrw: number;
  recurringPlanCount: number;
  monthlyRecurringEstimateKrw: number;
}) {
  const hasActual = input.actualRecordCount > 0;
  const hasPlanned = input.plannedPreparationCostKrw > 0;
  const hasRecurring = input.recurringPlanCount > 0 || input.monthlyRecurringEstimateKrw > 0;
  const displayState: ReportV3DisplayState = hasActual
    ? hasPlanned || hasRecurring
      ? "combined"
      : "actual_only"
    : hasPlanned || hasRecurring
      ? "planned_only"
      : "complete_empty";
  return { hasActual, hasPlanned, hasRecurring, displayState };
}
