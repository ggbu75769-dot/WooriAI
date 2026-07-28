import type { ReportPeriod } from "./period-aggregation";

export type ReportRequestPlan = {
  aggregate: boolean;
  legacyMonthly: boolean;
  legacyPreviousMonth: boolean;
  legacyCumulative: boolean;
  legacyCategory: boolean;
  legacyQuarter: boolean;
  legacyYear: boolean;
  legacyMonthlyTrend: boolean;
};

export function buildReportRequestPlan(input: {
  hasSession: boolean;
  pixelLockMode: boolean;
  period: ReportPeriod;
}): ReportRequestPlan {
  if (!input.hasSession) {
    return {
      aggregate: false,
      legacyMonthly: false,
      legacyPreviousMonth: false,
      legacyCumulative: false,
      legacyCategory: false,
      legacyQuarter: false,
      legacyYear: false,
      legacyMonthlyTrend: false
    };
  }
  if (!input.pixelLockMode) {
    return {
      aggregate: true,
      legacyMonthly: false,
      legacyPreviousMonth: false,
      legacyCumulative: false,
      legacyCategory: false,
      legacyQuarter: false,
      legacyYear: false,
      legacyMonthlyTrend: false
    };
  }
  return {
    aggregate: false,
    legacyMonthly: true,
    legacyPreviousMonth: input.period === "월간",
    legacyCumulative: true,
    legacyCategory: true,
    legacyQuarter: input.period === "분기",
    legacyYear: input.period === "연간",
    legacyMonthlyTrend: input.period === "월간"
  };
}
