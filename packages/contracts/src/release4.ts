import { z } from "zod";

export const lifecycleAxisSchema = z.enum(["mother", "child"]);
export const targetSubjectSchema = z.enum(["mother", "child", "caregiver", "household", "shared"]);
export const itemNecessitySchema = z.enum(["required", "recommended", "conditional", "optional"]);
export const recommendationStateSchema = z.enum([
  "recommended",
  "conditional",
  "professional_review_required",
  "not_recommended",
  "recalled_or_blocked",
  "retired"
]);
export const safetyTierSchema = z.enum(["normal", "elevated", "high"]);
export const catalogReviewStatusSchema = z.enum(["draft", "in_review", "published", "retired"]);
export const userItemPlanStateSchema = z.enum([
  "not_considered",
  "need",
  "researching",
  "planned",
  "ordered",
  "owned",
  "borrowed",
  "rented",
  "gift_expected",
  "gifted",
  "not_needed",
  "replacement_needed",
  "replaced",
  "retired"
]);
export const acquisitionModeSchema = z.enum([
  "new_purchase",
  "secondhand",
  "rental",
  "borrow",
  "gift",
  "existing",
  "undecided"
]);

export const catalogNodeSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  parentId: z.string().uuid().nullable(),
  level: z.enum(["domain", "category", "subcategory"]),
  nameKo: z.string().min(1),
  description: z.string().nullable(),
  iconKey: z.string().nullable(),
  displayOrder: z.number().int()
});

export const catalogItemSummarySchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  nameKo: z.string().min(1),
  shortDescription: z.string().min(1),
  targetSubject: targetSubjectSchema,
  necessity: itemNecessitySchema,
  recommendationState: recommendationStateSchema,
  timingSummary: z.string().min(1),
  safetyTier: safetyTierSchema,
  safetyNote: z.string().nullable(),
  status: catalogReviewStatusSchema,
  primaryCategory: catalogNodeSchema.nullable(),
  plan: z.object({ state: userItemPlanStateSchema, desiredQuantity: z.number().int().nullable(), ownedQuantity: z.number().int().nullable() }).nullable()
});

export const productOfferSchema = z.object({
  id: z.string().uuid(),
  seller: z.string().min(1),
  brand: z.string().nullable(),
  productName: z.string().min(1),
  modelName: z.string().nullable(),
  publicUrl: z.string().url(),
  affiliateUrl: z.string().url().nullable(),
  isAffiliate: z.boolean(),
  isSponsored: z.boolean(),
  disclosureText: z.string().nullable(),
  priceSnapshotKrw: z.number().int().nonnegative().nullable(),
  priceCheckedAt: z.date().nullable(),
  stockState: z.enum(["in_stock", "out_of_stock", "preorder", "discontinued", "unknown"]),
  recallState: z.enum(["clear", "check_required", "recalled", "unknown"]),
  healthState: z.enum(["healthy", "stale", "failed", "blocked"])
});

export const catalogItemDetailSchema = catalogItemSummarySchema.extend({
  reasonText: z.string().min(1),
  skipReasonText: z.string().nullable(),
  quantityGuidance: z.string().nullable(),
  priceMinKrw: z.number().int().nonnegative().nullable(),
  priceMaxKrw: z.number().int().nonnegative().nullable(),
  secondhandPolicy: z.enum(["allowed", "inspect", "avoid", "prohibited"]),
  rentalPolicy: z.enum(["suitable", "conditional", "unsuitable"]),
  medicalDisclaimerRequired: z.boolean(),
  categories: z.array(catalogNodeSchema),
  lifecycles: z.array(z.object({ axis: lifecycleAxisSchema, lifecycleCode: z.string().min(1), timingText: z.string().nullable() })),
  contexts: z.array(z.object({ contextCode: z.string().min(1), weight: z.number().int(), required: z.boolean() })),
  offers: z.array(productOfferSchema),
  reviewPending: z.boolean()
});

export const catalogListResponseSchema = z.object({
  items: z.array(catalogItemSummarySchema),
  nextCursor: z.string().uuid().nullable(),
  total: z.number().int().nonnegative()
});

export const userItemPlanSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  childId: z.string().uuid().nullable(),
  motherProfileId: z.string().uuid().nullable(),
  itemDefinitionId: z.string().uuid(),
  state: userItemPlanStateSchema,
  desiredQuantity: z.number().int().nonnegative().nullable(),
  ownedQuantity: z.number().int().nonnegative().nullable(),
  dueDate: z.date().nullable(),
  acquisitionMode: acquisitionModeSchema.nullable(),
  assignedUserId: z.string().uuid().nullable(),
  budgetKrw: z.number().int().nonnegative().nullable(),
  note: z.string().nullable(),
  linkedExpenseId: z.string().uuid().nullable(),
  version: z.number().int().positive(),
  item: catalogItemSummarySchema.optional()
});

export const expenseCategoryV2Schema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid().nullable(),
  parentCategoryId: z.string().uuid().nullable(),
  code: z.string().min(1),
  nameKo: z.string().min(1),
  iconKey: z.string().nullable(),
  isSystem: z.boolean(),
  hidden: z.boolean(),
  displayOrder: z.number().int()
});

export type CatalogItemSummaryContract = z.infer<typeof catalogItemSummarySchema>;
export type CatalogItemDetailContract = z.infer<typeof catalogItemDetailSchema>;
export type UserItemPlanContract = z.infer<typeof userItemPlanSchema>;
