import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const todayActionSchema = z.object({
  actionKey: z.string(),
  kind: z.enum(["safety_acknowledgement", "sync_conflict", "overdue_assigned", "replacement_due", "recurring_due", "due_this_week", "planned_cost_unassigned", "recommendation"]),
  sourceId: z.string().uuid(),
  childId: z.string().uuid().nullable(),
  dueDate: dateOnly.nullable(),
  assignedUserId: z.string().uuid().nullable(),
  reasonCode: z.string(),
  reasonParams: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  navigation: z.object({ kind: z.enum(["item", "calendar", "notifications", "sync"]), itemId: z.string().uuid().optional(), childId: z.string().uuid().optional() }),
  preferenceScope: z.object({ kind: z.literal("child"), childId: z.string().uuid() }).strict(),
  preferenceVersion: z.number().int().nonnegative()
}).strict();

export const todayCenterSchema = z.object({
  generatedAt: z.string().datetime(),
  referenceDate: dateOnly,
  source: z.literal("database"),
  actions: z.array(todayActionSchema).max(3)
}).strict();

export const todayPreferenceSchema = z.object({
  actionKey: z.string(),
  mode: z.literal("snooze"),
  snoozedUntil: dateOnly,
  version: z.number().int().positive()
}).strict();

export const legacyTodayPreferenceSchema = z.object({
  actionKey: z.string(),
  mode: z.literal("hide_lifecycle"),
  snoozedUntil: z.null(),
  lifecycleCode: z.string().nullable(),
  version: z.number().int().positive()
}).strict();

export const todayPreferenceResolutionSchema = z.object({
  actionKey: z.string(),
  preferenceScope: z.object({ kind: z.literal("child"), childId: z.string().uuid() }).strict(),
  preference: z.union([todayPreferenceSchema, legacyTodayPreferenceSchema]).nullable()
}).strict();

export const preparationCalendarEventSchema = z.object({
  eventId: z.string(),
  type: z.enum(["preparation", "replacement", "recurring"]),
  date: dateOnly,
  planId: z.string().uuid(),
  itemDefinitionId: z.string().uuid(),
  itemName: z.string(),
  childId: z.string().uuid().nullable(),
  assignedUserId: z.string().uuid().nullable(),
  status: z.enum(["overdue", "today", "upcoming"])
}).strict();

export const preparationCalendarSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  timezone: z.literal("Asia/Seoul"),
  events: z.array(preparationCalendarEventSchema)
}).strict();

export const customBundleSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  title: z.string(),
  scopeType: z.enum(["child", "household"]),
  version: z.number().int().positive(),
  archivedAt: z.string().datetime().nullable(),
  items: z.array(z.object({ itemDefinitionId: z.string().uuid(), itemName: z.string(), defaultQuantity: z.number().int().positive().nullable(), displayOrder: z.number().int().nonnegative() }).strict())
}).strict();

export const weeklyBriefingSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  weekStart: dateOnly,
  generatedAt: z.string().datetime(),
  sourceHash: z.string().regex(/^[0-9a-f]{64}$/),
  sections: z.object({
    safety: z.array(z.object({ itemId: z.string().uuid(), reason: z.string() })),
    completed: z.number().int().nonnegative(),
    dueNextWeek: z.number().int().nonnegative(),
    unassigned: z.number().int().nonnegative(),
    financial: z.object({ plannedKrw: z.number().int().nonnegative(), actualKrw: z.number().int() }).nullable()
  }).strict()
}).strict();

export const recurringPredictionSchema = z.object({
  predictedDate: dateOnly,
  intervalDays: z.number().int().positive(),
  confidence: z.enum(["low", "medium", "high"])
}).strict().nullable();

export const receiptDraftSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  childId: z.string().uuid(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  fileName: z.string(),
  mimeType: z.string(),
  fileSizeBytes: z.number().int().nonnegative(),
  status: z.enum(["draft", "extracting", "review_ready", "extraction_failed", "confirmed", "deleted"]),
  extraction: z.object({
    amountKrw: z.number().int().positive().nullable(),
    spentOn: dateOnly.nullable(),
    merchant: z.string().nullable(),
    itemName: z.string().nullable(),
    confidence: z.object({ amount: z.number().min(0).max(1), date: z.number().min(0).max(1), merchant: z.number().min(0).max(1) })
  }).nullable(),
  confirmedExpenseId: z.string().uuid().nullable(),
  version: z.number().int().positive()
}).strict();

export const expensePlanLinkSuggestionSchema = z.object({
  planId: z.string().uuid(),
  itemDefinitionId: z.string().uuid(),
  itemName: z.string(),
  reasonCodes: z.array(z.enum(["explicit_item", "canonical_match", "name_match", "amount_range", "date_proximity", "purchase_history"])),
  explanation: z.string()
}).strict();

export const budgetVarianceExplanationSchema = z.object({
  varianceKrw: z.number().int(),
  direction: z.enum(["over", "under", "matched"]),
  summary: z.string(),
  topDrivers: z.array(z.object({ name: z.string(), actualKrw: z.number().int() })).max(2),
  adjustments: z.object({ giftKrw: z.number().int().nonnegative(), refundKrw: z.number().int().nonnegative(), supportKrw: z.number().int().nonnegative() }),
  basis: z.literal("report_v3_ledger_and_plan")
}).strict().nullable();

export type TodayCenterContract = z.infer<typeof todayCenterSchema>;
export type TodayActionContract = z.infer<typeof todayActionSchema>;
export type TodayPreferenceContract = z.infer<typeof todayPreferenceSchema>;
export type TodayPreferenceResolutionContract = z.infer<typeof todayPreferenceResolutionSchema>;
export type PreparationCalendarContract = z.infer<typeof preparationCalendarSchema>;
export type CustomBundleContract = z.infer<typeof customBundleSchema>;
export type WeeklyBriefingContract = z.infer<typeof weeklyBriefingSchema>;
export type ReceiptDraftContract = z.infer<typeof receiptDraftSchema>;
