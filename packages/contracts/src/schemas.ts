import { z } from "zod";
import {
  CHILD_STAGE_CODES,
  CHILD_STAGE_MODES,
  EXPENSE_SOURCES,
  EXPENSE_TYPES,
  IMPORT_STATUSES,
  ITEM_STATUSES,
  NECESSITY_LEVELS,
  PAYMENT_METHODS,
  PRODUCT_PLATFORMS
} from "@wooriai/domain";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableDateOnlySchema = dateOnlySchema.nullable().optional();

export const uuidSchema = z.string().uuid();
export const moneyKrwSchema = z.number().int().min(1);

export const childStageModeSchema = z.enum(CHILD_STAGE_MODES);
export const childStageCodeSchema = z.enum(CHILD_STAGE_CODES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const expenseTypeSchema = z.enum(EXPENSE_TYPES);
export const expenseSourceSchema = z.enum(EXPENSE_SOURCES);
export const necessityLevelSchema = z.enum(NECESSITY_LEVELS);
export const itemStatusSchema = z.enum(ITEM_STATUSES);
export const productPlatformSchema = z.enum(PRODUCT_PLATFORMS);
export const importStatusSchema = z.enum(IMPORT_STATUSES);

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    requestId: z.string().optional()
  })
});

export const childSchema = z.object({
  id: uuidSchema,
  householdId: uuidSchema,
  nickname: z.string().min(1),
  stageMode: childStageModeSchema,
  dueDate: nullableDateOnlySchema,
  birthDate: nullableDateOnlySchema,
  manualStage: childStageCodeSchema.nullable().optional(),
  currentStage: childStageCodeSchema,
  stageLabel: z.string().min(1)
});

export const categorySchema = z.object({
  id: uuidSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  iconName: z.string().optional()
});

export const createExpenseRequestSchema = z.object({
  categoryId: uuidSchema,
  amountKrw: moneyKrwSchema,
  spentOn: dateOnlySchema,
  itemName: z.string().min(1).max(100),
  merchant: z.string().max(100).optional(),
  paymentMethod: paymentMethodSchema.default("unknown"),
  memo: z.string().max(500).optional(),
  linkedItemTemplateId: uuidSchema.optional(),
  expenseType: z.enum(["expense", "gift"]).default("expense")
});

export const expenseSchema = z.object({
  id: uuidSchema,
  childId: uuidSchema,
  categoryId: uuidSchema.optional(),
  amountKrw: moneyKrwSchema,
  spentOn: dateOnlySchema,
  itemName: z.string().min(1),
  merchant: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  expenseType: expenseTypeSchema.default("expense"),
  source: expenseSourceSchema.default("manual"),
  createdByUserId: uuidSchema.optional()
});

export const budgetSchema = z.object({
  childId: uuidSchema,
  yearMonth: dateOnlySchema,
  amountKrw: moneyKrwSchema,
  usedAmountKrw: z.number().int(),
  remainingAmountKrw: z.number().int()
});

// Home summary reports a budget of 0 (rather than omitting it) when no monthly
// budget has been set yet, so its amountKrw allows 0 unlike the strict
// moneyKrwSchema-backed budgetSchema used by the dedicated budget endpoints.
export const homeMonthlyBudgetSchema = budgetSchema.extend({
  amountKrw: z.number().int().min(0)
});

export const itemSummarySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  necessityLevel: necessityLevelSchema,
  status: itemStatusSchema,
  timingLabel: z.string().optional(),
  priceBandText: z.string().optional()
});

export const productLinkSchema = z.object({
  id: uuidSchema,
  platform: productPlatformSchema,
  title: z.string().min(1),
  isAffiliate: z.boolean(),
  isSponsored: z.boolean(),
  disclosureText: z.string().optional()
});

export const itemDetailSchema = itemSummarySchema.extend({
  reasonText: z.string().min(1),
  skipReasonText: z.string().nullable().optional(),
  usedSecondhandOk: z.boolean(),
  safetyNote: z.string().nullable().optional(),
  productLinks: z.array(productLinkSchema)
});

export const homeSummarySchema = z.object({
  child: childSchema,
  totalExpenseKrw: z.number().int().min(0),
  monthly: homeMonthlyBudgetSchema,
  recommendedItems: z.array(itemSummarySchema),
  recentExpenses: z.array(expenseSchema)
});

export const affiliateClickResponseSchema = z.object({
  clickId: uuidSchema,
  redirectUrl: z.string().url(),
  disclosureText: z.string().optional()
});

export const reportMonthlySchema = z.object({
  childId: uuidSchema,
  yearMonth: dateOnlySchema,
  totalExpenseKrw: z.number().int().min(0),
  budgetAmountKrw: z.number().int().min(1).nullable().optional(),
  categoryTop: z.array(z.record(z.unknown()))
});

export const reportYearlySchema = z.object({
  childId: uuidSchema,
  year: z.string().regex(/^\d{4}$/),
  totalExpenseKrw: z.number().int().min(0),
  monthlyTotals: z.array(
    z.object({
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
      totalExpenseKrw: z.number().int().min(0)
    })
  ).length(12)
});

export const importJobSchema = z.object({
  id: uuidSchema,
  status: importStatusSchema,
  rowCount: z.number().int().optional(),
  candidateCount: z.number().int().optional(),
  importedCount: z.number().int().optional()
});

export const importRowSchema = z.object({
  id: uuidSchema,
  rowIndex: z.number().int().min(0),
  parsedDate: dateOnlySchema.optional(),
  parsedItemName: z.string().max(100).optional(),
  parsedAmountKrw: moneyKrwSchema.optional(),
  categoryId: uuidSchema.optional(),
  confidence: z.number().min(0).max(1),
  selected: z.boolean(),
  validationStatus: z.string().min(1)
});

export type ChildDto = z.infer<typeof childSchema>;
export type CreateExpenseRequestDto = z.infer<typeof createExpenseRequestSchema>;
export type ExpenseDto = z.infer<typeof expenseSchema>;
export type HomeSummaryDto = z.infer<typeof homeSummarySchema>;
export type ImportRowDto = z.infer<typeof importRowSchema>;
export type ItemSummaryDto = z.infer<typeof itemSummarySchema>;
export type ProductLinkDto = z.infer<typeof productLinkSchema>;
export type YearlyReportDto = z.infer<typeof reportYearlySchema>;
