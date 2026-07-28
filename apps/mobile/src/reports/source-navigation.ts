import type { ReportSourceKind } from "@wooriai/contracts";
import type { ReportV2Period } from "../api/client";
import type { ReportPeriod } from "./period-aggregation";

export type ReportSection =
  | "summary"
  | "expenses"
  | "preparation"
  | "recurring"
  | "family"
  | "adjustments"
  | "forecast";

const reportSections = new Set<ReportSection>([
  "summary",
  "expenses",
  "preparation",
  "recurring",
  "family",
  "adjustments",
  "forecast"
]);

export function restoreReportViewState(input: {
  reportPeriod?: string;
  reportOffset?: string;
  reportSection?: string;
}) {
  const period: ReportPeriod =
    input.reportPeriod === "quarter" ? "분기" : input.reportPeriod === "year" ? "연간" : "월간";
  const parsedOffset = Number(input.reportOffset);
  return {
    period,
    offset: Number.isFinite(parsedOffset) ? parsedOffset : 0,
    section: reportSections.has(input.reportSection as ReportSection)
      ? input.reportSection as ReportSection
      : "summary" as const
  };
}

export function reportSourceRoute(input: {
  householdId: string;
  childId: string;
  period: ReportV2Period;
  anchor: string;
  kind: ReportSourceKind;
}) {
  return {
    pathname: "/reports/sources" as const,
    params: input
  };
}

export function reportSourceScopeMatches(
  actual: {
    householdId: string;
    childId: string;
    kind: string;
    anchor: string;
  },
  expected: {
    householdId: string;
    childId: string;
    period: string;
    anchor: string;
  }
) {
  return (
    actual.householdId === expected.householdId &&
    actual.childId === expected.childId &&
    actual.kind === expected.period &&
    actual.anchor === expected.anchor
  );
}
