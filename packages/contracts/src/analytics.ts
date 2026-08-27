import { z } from "zod";
import { uuidSchema, itemStatusSchema, productPlatformSchema } from "./schemas";

/**
 * ANA-101 analytics event envelope + payload registry (design doc
 * docs/5차/round5a-sprint2-plan.md §5).
 *
 * Every payload schema in `analyticsEventRegistry` must stay "PII-safe by
 * construction": each field is either an enum literal, a boolean, or an
 * integer count (never a free-form string, and never a raw money amount).
 * `analytics.pii-lint.test.ts` asserts this for every registry entry plus
 * checks property keys against a forbidden-name list, so a new event that
 * violates the rule fails CI automatically -- no manual review checklist to
 * remember.
 */

export const ANALYTICS_PLATFORMS = ["ios", "android"] as const;
export const analyticsPlatformSchema = z.enum(ANALYTICS_PLATFORMS);

// Mirrors the locked 12-category list in apps/api/prisma/seed-data.ts
// (seed-data.test.ts asserts that list exactly). Analytics payloads reference
// the coarse category, never the finer-grained (and more volatile) item
// template code.
export const ANALYTICS_CATEGORY_CODES = [
  "pregnancy_mother",
  "hospital_checkup",
  "birth_postpartum",
  "diaper_hygiene",
  "feeding_babyfood",
  "clothes_laundry",
  "sleep_furniture",
  "outing_mobility",
  "toys_books",
  "care_education",
  "insurance_savings",
  "etc"
] as const;
export const analyticsCategoryCodeSchema = z.enum(ANALYTICS_CATEGORY_CODES);

export const EXPENSE_AMOUNT_BUCKETS = ["lt10k", "10k_50k", "50k_100k", "100k_500k", "gte500k"] as const;
export const expenseAmountBucketSchema = z.enum(EXPENSE_AMOUNT_BUCKETS);

export const EXPENSE_RECORD_SOURCES = ["manual", "import", "followup"] as const;
export const expenseRecordSourceSchema = z.enum(EXPENSE_RECORD_SOURCES);

export const SYNC_LATENCY_BUCKETS = ["lt1s", "1s_5s", "5s_30s", "30s_2m", "gte2m"] as const;
export const syncLatencyBucketSchema = z.enum(SYNC_LATENCY_BUCKETS);

/**
 * ANA-127: item detail is the only screen that renders product links (the
 * checklist/home item rows carry an ItemSummary, which has no productLinks),
 * so it is the only screen affiliate_link_clicked can fire from. The
 * previously reserved "checklist"/"home" literals were never emitted by any
 * shipped client and were dropped rather than left as permanently-empty
 * dimensions; adding a new fire point means adding its literal back here
 * first (the collection endpoint validates payloads against this registry, so
 * an unregistered screenId would be rejected, not silently stored).
 */
export const AFFILIATE_CLICK_SCREENS = ["item_detail"] as const;
export const affiliateClickScreenSchema = z.enum(AFFILIATE_CLICK_SCREENS);

/**
 * ANA-127: the three answers COM-108's 구매 확인 프롬프트 offers --
 * "샀어요" / "아직이요" / "괜찮아요". Kept as neutral analytics literals rather
 * than the store's internal status names (done/pending/dismissed) so the
 * funnel reads as an answer, not as a storage state.
 */
export const PURCHASE_FOLLOWUP_ANSWERS = ["purchased", "not_purchased", "dismissed"] as const;
export const purchaseFollowupAnswerSchema = z.enum(PURCHASE_FOLLOWUP_ANSWERS);

export const analyticsEventEnvelopeSchema = z
  .object({
    eventName: z.string().min(1).max(64),
    eventVersion: z.number().int().min(1),
    eventId: uuidSchema,
    occurredAt: z.string().datetime({ offset: true }),
    appVersion: z.string().min(1).max(32).optional(),
    platform: analyticsPlatformSchema.optional(),
    payload: z.record(z.string(), z.unknown())
  })
  .strict();

export type AnalyticsEventEnvelope = z.infer<typeof analyticsEventEnvelopeSchema>;

const appOpenedV1Payload = z.object({}).strict();

const onboardingCompletedV1Payload = z
  .object({
    stepCount: z.number().int().min(0)
  })
  .strict();

const expenseRecordedV1Payload = z
  .object({
    categoryCode: analyticsCategoryCodeSchema,
    amountBucket: expenseAmountBucketSchema,
    source: expenseRecordSourceSchema,
    offline: z.boolean()
  })
  .strict();

const expenseSyncedV1Payload = z
  .object({
    latencyBucket: syncLatencyBucketSchema
  })
  .strict();

const itemStatusChangedV1Payload = z
  .object({
    itemCategoryCode: analyticsCategoryCodeSchema,
    status: itemStatusSchema
  })
  .strict();

const affiliateLinkClickedV1Payload = z
  .object({
    platform: productPlatformSchema,
    screenId: affiliateClickScreenSchema
  })
  .strict();

/**
 * ANA-127: the purchase loop's missing middle. Fired once per app launch per
 * (child, item) when the 준비템 상세 screen has actually rendered its loaded
 * detail, so the funnel has a real 준비템 확인 -> 상세 열람 -> 링크 클릭 chain
 * instead of jumping straight from a status change to a click.
 *
 * `hasProductLink`/`linkCount` are what make the next stage's drop-off
 * readable: a detail view with no purchasable link can never convert, so it
 * must be separable from one that could.
 */
const itemDetailViewedV1Payload = z
  .object({
    itemCategoryCode: analyticsCategoryCodeSchema,
    hasProductLink: z.boolean(),
    linkCount: z.number().int().min(0)
  })
  .strict();

/**
 * ANA-127: COM-108's 구매 확인 프롬프트 answer. `platform` is the product
 * platform of the click being asked about (matching affiliate_link_clicked's
 * `platform`), which is what makes 링크 클릭 -> 구매 전환 joinable per platform.
 * Optional on purpose: entries persisted by a build that predates ANA-127 have
 * no platform recorded, and guessing one would be inventing data.
 */
const purchaseFollowupAnsweredV1Payload = z
  .object({
    answer: purchaseFollowupAnswerSchema,
    platform: productPlatformSchema.optional()
  })
  .strict();

export type AnalyticsEventRegistryEntry = {
  eventName: string;
  eventVersion: number;
  payloadSchema: z.ZodObject<z.ZodRawShape>;
};

/** eventName@version -> payload schema. Add new events here only. */
export const analyticsEventRegistry: readonly AnalyticsEventRegistryEntry[] = [
  { eventName: "app_opened", eventVersion: 1, payloadSchema: appOpenedV1Payload },
  { eventName: "onboarding_completed", eventVersion: 1, payloadSchema: onboardingCompletedV1Payload },
  { eventName: "expense_recorded", eventVersion: 1, payloadSchema: expenseRecordedV1Payload },
  { eventName: "expense_synced", eventVersion: 1, payloadSchema: expenseSyncedV1Payload },
  { eventName: "item_status_changed", eventVersion: 1, payloadSchema: itemStatusChangedV1Payload },
  { eventName: "affiliate_link_clicked", eventVersion: 1, payloadSchema: affiliateLinkClickedV1Payload },
  // ANA-127. Append-only: this array's order is the admin summary's `byName` order, and
  // apps/api/test/admin-analytics-summary.e2e.test.ts pins the first six names in place --
  // so a new event goes at the end, never inserted into the existing sequence.
  { eventName: "item_detail_viewed", eventVersion: 1, payloadSchema: itemDetailViewedV1Payload },
  { eventName: "purchase_followup_answered", eventVersion: 1, payloadSchema: purchaseFollowupAnsweredV1Payload }
];

function registryKey(eventName: string, eventVersion: number): string {
  return `${eventName}@${eventVersion}`;
}

const registryByKey = new Map<string, AnalyticsEventRegistryEntry>(
  analyticsEventRegistry.map((entry) => [registryKey(entry.eventName, entry.eventVersion), entry])
);

/** Looks up the payload schema for `eventName@eventVersion`, or undefined if unregistered. */
export function getAnalyticsEventPayloadSchema(
  eventName: string,
  eventVersion: number
): z.ZodObject<z.ZodRawShape> | undefined {
  return registryByKey.get(registryKey(eventName, eventVersion))?.payloadSchema;
}

/**
 * True when `schema` is an allowed analytics payload field type: an enum
 * literal, a boolean, or an integer number (optionally wrapped in
 * optional/nullable/default). Free-form strings and non-integer numbers
 * (e.g. raw money amounts) are rejected. Exported so the PII-lint test can
 * apply the same rule to every registry entry without duplicating it.
 */
export function isAllowedAnalyticsFieldSchema(schema: z.ZodTypeAny): boolean {
  let inner: z.ZodTypeAny = schema;
  while (
    inner instanceof z.ZodOptional ||
    inner instanceof z.ZodNullable ||
    inner instanceof z.ZodDefault
  ) {
    inner = inner._def.innerType as z.ZodTypeAny;
  }

  if (inner instanceof z.ZodBoolean || inner instanceof z.ZodEnum) {
    return true;
  }

  if (inner instanceof z.ZodNumber) {
    return inner._def.checks.some((check) => check.kind === "int");
  }

  return false;
}

/**
 * Property keys never allowed in an analytics payload, regardless of type.
 * Kept intentionally broad (backlog ANA-101 acceptance criteria +
 * docs/5차/round5a-sprint2-plan.md §5) -- this is a denylist, not an
 * allowlist, so it only catches known-bad names; the type check in
 * `isAllowedAnalyticsFieldSchema` is the primary defense.
 */
export const ANALYTICS_FORBIDDEN_PAYLOAD_KEYS = [
  "memo",
  "itemName",
  "merchant",
  "email",
  "phone",
  "displayName",
  "name",
  "nickname",
  "birthDate",
  "amountKrw",
  "amount",
  "url",
  "token",
  "address",
  "childName",
  "householdName",
  "ip",
  "ipAddress",
  "userAgent",
  "deviceId",
  "pushToken"
] as const;

const forbiddenKeySet = new Set(
  ANALYTICS_FORBIDDEN_PAYLOAD_KEYS.map((key) => key.toLowerCase())
);

export function isForbiddenAnalyticsPayloadKey(key: string): boolean {
  return forbiddenKeySet.has(key.toLowerCase());
}
