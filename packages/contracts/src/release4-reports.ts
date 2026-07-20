import { z } from "zod";

export const reportExpenseTypeSchema = z.enum(["expense", "gift", "refund", "support"]);
export const reportMaturitySchema = z.object({
  recordCount: z.number().int().nonnegative(),
  distinctMonths: z.number().int().nonnegative(),
  distinctMembers: z.number().int().nonnegative(),
  level: z.enum(["empty", "sparse", "categorized", "trend", "recurring", "annual"]),
  showCategories: z.boolean(),
  showTrend: z.boolean(),
  showRecurring: z.boolean(),
  showMembers: z.boolean(),
  showAnnual: z.boolean()
});

export const reportTotalsSchema = z.object({
  expenseKrw: z.number().int().nonnegative(),
  giftKrw: z.number().int().nonnegative(),
  refundKrw: z.number().int().nonnegative(),
  supportKrw: z.number().int().nonnegative(),
  netHouseholdOutflowKrw: z.number().int(),
  linkedPreparationCostKrw: z.number().int(),
  unlinkedCostKrw: z.number().int(),
  recordCount: z.number().int().nonnegative()
});

export const reportPeriodSchema = z.object({
  householdId: z.string().uuid(),
  childId: z.string().uuid(),
  kind: z.enum(["month", "quarter", "year", "custom"]),
  anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEndExclusive: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.literal("Asia/Seoul"),
  currency: z.literal("KRW"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const reportSummarySchema = z.object({
  period: reportPeriodSchema,
  totals: reportTotalsSchema,
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEndExclusive: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.literal("Asia/Seoul"),
  currency: z.literal("KRW"),
  expenseTotal: z.number().int().nonnegative(),
  refundTotal: z.number().int().nonnegative(),
  giftTotal: z.number().int().nonnegative(),
  supportTotal: z.number().int().nonnegative(),
  netOutflow: z.number().int(),
  categoryBreakdown: z.array(reportTotalsSchema.extend({
    categoryCode: z.string(),
    categoryNameKo: z.string(),
    percentage: z.number().min(0).max(100)
  })),
  series: z.array(reportTotalsSchema.extend({ key: z.string(), label: z.string() })),
  dataMaturity: reportMaturitySchema,
  previousPeriodComparison: z.object({
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    currentNetOutflowKrw: z.number().int(),
    previousNetOutflowKrw: z.number().int(),
    deltaKrw: z.number().int(),
    deltaPercentage: z.number().nullable()
  }).nullable(),
  maturity: reportMaturitySchema,
  recent: z.array(z.object({
    id: z.string().uuid(),
    spentOn: z.string(),
    itemName: z.string(),
    expenseType: reportExpenseTypeSchema,
    amountKrw: z.number().int().nonnegative()
  }))
});

export const reportCategoryRowSchema = reportTotalsSchema.extend({
  categoryId: z.string(),
  categoryCode: z.string(),
  categoryNameKo: z.string(),
  percentage: z.number().min(0).max(100)
});

export const reportCategoriesSchema = z.object({
  period: reportPeriodSchema,
  categories: z.array(reportCategoryRowSchema),
  percentageTotal: z.number().min(0).max(100),
  maturity: reportMaturitySchema
});

export const reportTrendSchema = z.object({
  period: reportPeriodSchema,
  unit: z.enum(["day", "month"]),
  buckets: z.array(reportTotalsSchema.extend({ key: z.string(), label: z.string() })),
  maturity: reportMaturitySchema
});

export const reportMembersSchema = z.object({
  period: reportPeriodSchema,
  members: z.array(reportTotalsSchema.extend({
    userId: z.string().uuid(),
    displayName: z.string(),
    percentage: z.number().min(0).max(100)
  })),
  percentageTotal: z.number().min(0).max(100),
  maturity: reportMaturitySchema
});

export const reportPreparationSchema = z.object({
  period: reportPeriodSchema,
  groups: z.array(reportTotalsSchema.extend({
    necessity: z.enum(["required", "recommended", "conditional", "optional", "unknown"]),
    label: z.string()
  })),
  plannedBudgetKrw: z.number().int().nonnegative(),
  maturity: reportMaturitySchema
});

export const reportRecurringSchema = z.object({
  period: reportPeriodSchema,
  items: z.array(z.object({
    key: z.string(),
    itemName: z.string(),
    merchant: z.string().nullable(),
    totalExpenseKrw: z.number().int().nonnegative(),
    recordCount: z.number().int().positive(),
    distinctMonths: z.number().int().min(2),
    averageExpenseKrw: z.number().int().nonnegative(),
    latestSpentOn: z.string()
  })),
  maturity: reportMaturitySchema
});

export const reportV3Schema = z.object({
  period: reportPeriodSchema,
  maturity: reportMaturitySchema,
  reportState: z.object({
    hasActual: z.boolean(),
    hasPlanned: z.boolean(),
    hasRecurring: z.boolean(),
    displayState: z.enum(["complete_empty", "planned_only", "actual_only", "combined"])
  }),
  summary: z.object({
    plannedPreparationCostKrw: z.number().int().nonnegative(),
    scheduledPlannedCostKrw: z.number().int().nonnegative(),
    unscheduledPlannedCostKrw: z.number().int().nonnegative(),
    actualPreparationCostKrw: z.number().int(),
    remainingPlannedCostKrw: z.number().int().nonnegative(),
    budgetVarianceKrw: z.number().int(),
    unscheduledPlanCount: z.number().int().nonnegative(),
    nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()
  }),
  necessitySplit: z.array(z.object({
    key: z.enum(["essential", "convenience", "optional"]),
    plannedCostKrw: z.number().int().nonnegative(),
    actualCostKrw: z.number().int(),
    remainingPlannedCostKrw: z.number().int().nonnegative(),
    planCount: z.number().int().nonnegative(),
    recordCount: z.number().int().nonnegative()
  })).length(3),
  costNature: z.object({
    oneTime: z.object({ plannedCostKrw: z.number().int().nonnegative(), actualCostKrw: z.number().int() }),
    recurring: z.object({ plannedCostKrw: z.number().int().nonnegative(), actualCostKrw: z.number().int(), monthlyEstimateKrw: z.number().int().nonnegative(), planCount: z.number().int().nonnegative() })
  }),
  payerContributions: z.array(reportTotalsSchema.extend({
    payerUserId: z.string().uuid(),
    displayName: z.string(),
    percentage: z.number().min(0).max(100)
  })),
  ledger: reportTotalsSchema,
  categories: z.array(reportCategoryRowSchema),
  trend: z.object({
    unit: z.enum(["day", "month"]),
    buckets: z.array(reportTotalsSchema.extend({ key: z.string(), label: z.string() }))
  }),
  previousPeriodComparison: z.object({
    currentNetOutflowKrw: z.number().int(),
    previousNetOutflowKrw: z.number().int(),
    deltaKrw: z.number().int(),
    deltaPercentage: z.number().nullable()
  }).nullable(),
  forecast: z.object({
    basis: z.literal("scheduled_plan_budget_minus_period_linked_net_cost"),
    rangeLowKrw: z.number().int().nonnegative(),
    rangeHighKrw: z.number().int().nonnegative(),
    scheduledPlanCount: z.number().int().nonnegative(),
    linkedRecordCount: z.number().int().nonnegative(),
    horizon: z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    confidence: z.literal("limited")
  }).nullable(),
  forecastUnavailableReason: z.string().nullable(),
  selectorProvenance: z.literal("All sections use the same KST report period and expense ledger selector.")
});

export const reportSourceKindSchema = z.enum([
  "planned",
  "unscheduled_planned",
  "recurring_planned",
  "actual_preparation",
  "household_net",
  "gift",
  "refund",
  "support"
]);

const reportPlanSourceSchema = z.object({
  sourceType: z.literal("plan"),
  id: z.string().uuid(),
  itemDefinitionId: z.string().uuid(),
  itemName: z.string(),
  state: z.string(),
  amountKrw: z.number().int(),
  signedAmountKrw: z.number().int(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  recurringIntervalDays: z.number().int().positive().nullable()
});

const reportExpenseSourceSchema = z.object({
  sourceType: z.literal("expense"),
  id: z.string().uuid(),
  itemName: z.string(),
  amountKrw: z.number().int().nonnegative(),
  signedAmountKrw: z.number().int(),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expenseType: reportExpenseTypeSchema,
  payerUserId: z.string().uuid(),
  payerDisplayName: z.string(),
  linkedItemDefinitionId: z.string().uuid().nullable()
});

export const reportSourcesSchema = z.object({
  period: reportPeriodSchema,
  kind: reportSourceKindSchema,
  items: z.array(z.discriminatedUnion("sourceType", [
    reportPlanSourceSchema,
    reportExpenseSourceSchema
  ])),
  totals: z.object({
    amountKrw: z.number().int(),
    signedAmountKrw: z.number().int(),
    recordCount: z.number().int().nonnegative()
  }),
  pageTotals: z.object({
    amountKrw: z.number().int(),
    signedAmountKrw: z.number().int(),
    recordCount: z.number().int().nonnegative()
  }),
  nextCursor: z.string().nullable()
});

export type ReportSummaryContract = z.infer<typeof reportSummarySchema>;
export type ReportCategoriesContract = z.infer<typeof reportCategoriesSchema>;
export type ReportTrendContract = z.infer<typeof reportTrendSchema>;
export type ReportMembersContract = z.infer<typeof reportMembersSchema>;
export type ReportPreparationContract = z.infer<typeof reportPreparationSchema>;
export type ReportRecurringContract = z.infer<typeof reportRecurringSchema>;
export type ReportV3Contract = z.infer<typeof reportV3Schema>;
export type ReportSourceKind = z.infer<typeof reportSourceKindSchema>;
export type ReportSourcesContract = z.infer<typeof reportSourcesSchema>;
