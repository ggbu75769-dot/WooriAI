import { z } from "zod";
import { CHILD_SEX_VALUES, CHILD_STAGE_CODES, CHILD_STAGE_MODES } from "@wooriai/domain";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const onboardingCompletionRequestSchema = z.object({
  householdId: z.string().uuid(),
  draftVersion: z.number().int().positive(),
  child: z.object({
    nickname: z.string().trim().min(1).max(60),
    stageMode: z.enum(CHILD_STAGE_MODES),
    dueDate: dateOnlySchema.optional(),
    birthDate: dateOnlySchema.optional(),
    manualStage: z.enum(CHILD_STAGE_CODES).optional(),
    stageOverride: z.boolean(),
    gender: z.enum(CHILD_SEX_VALUES)
  }).strict(),
  prepared: z.object({
    state: z.enum(["selected", "skipped", "completed_none"]),
    itemDefinitionIds: z.array(z.string().uuid()).max(12)
  }).strict(),
  budget: z.object({
    yearMonth: yearMonthSchema,
    amountKrw: z.number().int().positive()
  }).strict().nullable().optional()
}).strict();

export const onboardingChildSummarySchema = z.object({
  id: z.string().min(1),
  householdId: z.string().min(1).optional(),
  nickname: z.string().min(1),
  stageMode: z.enum(CHILD_STAGE_MODES),
  dueDate: dateOnlySchema.nullable(),
  birthDate: dateOnlySchema.nullable(),
  manualStage: z.enum(CHILD_STAGE_CODES).nullable(),
  gender: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  currentStage: z.enum(CHILD_STAGE_CODES),
  stageLabel: z.string().min(1)
});

export const onboardingCompletionResponseSchema = z.object({
  child: onboardingChildSummarySchema,
  prepared: z.object({
    state: z.enum(["selected", "skipped", "completed_none"]),
    appliedCount: z.number().int().nonnegative().max(12)
  }).strict(),
  budget: z.object({
    yearMonth: yearMonthSchema,
    amountKrw: z.number().int().positive()
  }).strict().nullable(),
  onboardingCompleted: z.literal(true)
}).strict();

export const onboardingStarterItemSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  categoryCode: z.string().min(1).nullable(),
  nameKo: z.string().min(1),
  shortDescription: z.string(),
  iconKey: z.string().nullable(),
  safetyTier: z.enum(["normal", "elevated", "high"]),
  onboardingPriority: z.number().int().nullable()
}).strict();

export const onboardingStarterPreviewRequestSchema = z.object({
  stageMode: z.enum(CHILD_STAGE_MODES),
  dueDate: dateOnlySchema.optional(),
  birthDate: dateOnlySchema.optional(),
  manualStage: z.enum(CHILD_STAGE_CODES).optional()
}).strict();

export const onboardingStarterPreviewResponseSchema = z.object({
  availability: z.enum(["available", "external_blocked"]),
  blockerCode: z.literal("EXTERNAL_BLOCKED_ONBOARDING_CATALOG").nullable(),
  eligibleCount: z.number().int().nonnegative(),
  items: z.array(onboardingStarterItemSchema).max(12),
  rankingPolicy: z.string().min(1)
}).strict();

export const onboardingProgressSchema = z.object({
  completed: z.boolean(),
  nextStep: z.enum(["consents", "child-profile", "prepared-items", "budget", "home"]),
  canRestart: z.boolean(),
  summary: z.object({
    consentsAccepted: z.boolean(),
    child: onboardingChildSummarySchema.nullable(),
    preparedItemsCount: z.number().int().nonnegative().nullable(),
    budget: z.object({
      yearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(?:-01)?$/),
      amountKrw: z.number().int().positive()
    }).strict().nullable()
  }).strict()
}).strict();

export type OnboardingCompletionRequestContract = z.infer<typeof onboardingCompletionRequestSchema>;
export type OnboardingChildSummaryContract = z.infer<typeof onboardingChildSummarySchema>;
export type OnboardingCompletionResponseContract = z.infer<typeof onboardingCompletionResponseSchema>;
export type OnboardingProgressContract = z.infer<typeof onboardingProgressSchema>;
export type OnboardingStarterItemContract = z.infer<typeof onboardingStarterItemSchema>;
export type OnboardingStarterPreviewRequestContract = z.infer<typeof onboardingStarterPreviewRequestSchema>;
export type OnboardingStarterPreviewResponseContract = z.infer<typeof onboardingStarterPreviewResponseSchema>;
