import { categoryCatalog } from "../categories";

/**
 * ANA-103: pure payload builders for the analytics events fired from screens.
 *
 * Mirrors packages/contracts/src/analytics.ts's payload schemas (ANA-101 §5).
 * Like ./client.ts, this module deliberately re-declares the enum literal
 * unions instead of importing @wooriai/contracts (not a mobile workspace
 * dependency -- see client.ts's header comment) and never imports
 * "react-native", so every helper here stays unit-testable under plain
 * vitest. Keep the literals in sync with the contracts registry by hand.
 *
 * PII-safety rule (contracts analytics.pii-lint.test.ts): every field a
 * builder returns is an enum literal or a boolean -- raw amounts, item
 * names, category ids and any other free-form strings are bucketed/mapped
 * on-device and never leave it.
 */

export type ExpenseAmountBucket = "lt10k" | "10k_50k" | "50k_100k" | "100k_500k" | "gte500k";

export type ExpenseRecordSource = "manual" | "import" | "followup";

/** The locked 12-category list -- packages/contracts/src/analytics.ts's ANALYTICS_CATEGORY_CODES. */
export type AnalyticsCategoryCode =
  | "pregnancy_mother"
  | "hospital_checkup"
  | "birth_postpartum"
  | "diaper_hygiene"
  | "feeding_babyfood"
  | "clothes_laundry"
  | "sleep_furniture"
  | "outing_mobility"
  | "toys_books"
  | "care_education"
  | "insurance_savings"
  | "etc";

export type AnalyticsItemStatus = "not_prepared" | "prepared" | "gifted" | "not_needed" | "interested";

export type AnalyticsProductPlatform = "coupang" | "naver" | "custom";

export type AffiliateClickScreen = "item_detail" | "checklist" | "home";

/**
 * Buckets a raw KRW amount into the same enum literal set as the contracts
 * registry's expense_recorded v1 `amountBucket` field
 * (EXPENSE_AMOUNT_BUCKETS = ["lt10k", "10k_50k", "50k_100k", "100k_500k",
 * "gte500k"]) -- keep the boundaries in sync with that file. The raw amount
 * itself never enters an analytics payload.
 */
export function bucketExpenseAmountKrw(amountKrw: number): ExpenseAmountBucket {
  if (amountKrw < 10_000) return "lt10k";
  if (amountKrw < 50_000) return "10k_50k";
  if (amountKrw < 100_000) return "50k_100k";
  if (amountKrw < 500_000) return "100k_500k";
  return "gte500k";
}

/**
 * Runtime mirror of `AnalyticsCategoryCode` above (the type stays the compile-time source of
 * truth; the tuple is what a server-supplied `code` string is validated against). Order and
 * contents mirror packages/contracts/src/analytics.ts's ANALYTICS_CATEGORY_CODES -- events.test.ts
 * asserts that against the contracts file so the two cannot drift.
 */
export const ANALYTICS_CATEGORY_CODES: readonly AnalyticsCategoryCode[] = [
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
];

const ANALYTICS_CATEGORY_CODE_SET: ReadonlySet<string> = new Set<string>(ANALYTICS_CATEGORY_CODES);

/** `mobileCategoryAliasSeeds` prefix (apps/api/prisma/seed-data.ts) -- see below. */
const MOBILE_ALIAS_CODE_PREFIX = "mobile_";

/**
 * The two `mobile_` alias codes whose suffix is NOT one of the 12 analytics codes:
 * `mobile_feeding_dairy` ("분유/유제품") and `mobile_feeding_meal` ("식비") both belong to the
 * canonical `feeding_babyfood` family -- the same judgment call src/categories.ts's
 * `categoryCatalog` already encodes for those two quick-input tiles.
 */
const MOBILE_ALIAS_CODE_FALLBACKS: Readonly<Record<string, AnalyticsCategoryCode>> = {
  feeding_dairy: "feeding_babyfood",
  feeding_meal: "feeding_babyfood"
};

/**
 * C2/REC-121: resolves a server category `code` (`GET /categories`) to the coarse analytics
 * enum, or null when it is not an analytics category at all (the `import_stub_default` stub, or
 * any future code the registry does not know).
 *
 * The 12 canonical seed codes ARE the registry's enum (ANALYTICS_CATEGORY_CODES in
 * packages/contracts/src/analytics.ts mirrors apps/api/prisma/seed-data.ts), so they map
 * through unchanged; the 8 `mobile_`-prefixed alias rows map to the canonical family they
 * alias. Anything else returns null so the caller can fall back rather than emit a literal the
 * contract's `analyticsCategoryCodeSchema` would reject.
 */
export function analyticsCategoryCodeForServerCode(code: string | null | undefined): AnalyticsCategoryCode | null {
  const raw = (code ?? "").trim();
  if (!raw) return null;
  if (ANALYTICS_CATEGORY_CODE_SET.has(raw)) return raw as AnalyticsCategoryCode;
  if (!raw.startsWith(MOBILE_ALIAS_CODE_PREFIX)) return null;
  const stripped = raw.slice(MOBILE_ALIAS_CODE_PREFIX.length);
  if (ANALYTICS_CATEGORY_CODE_SET.has(stripped)) return stripped as AnalyticsCategoryCode;
  return MOBILE_ALIAS_CODE_FALLBACKS[stripped] ?? null;
}

/** Minimal `GET /categories` shape this module needs (id + taxonomy code). Structural on purpose. */
export type AnalyticsServerCategory = { id: string; code?: string | null };

/**
 * Maps a stored `categoryId` to the coarse analytics category code.
 *
 * Resolution order:
 *   1. the static quick-expense catalog (src/categories.ts) -- the 8 tile ids;
 *   2. `serverCategories`, when the caller has the shared `["categories"]` list at hand: its
 *      `code` is resolved through `analyticsCategoryCodeForServerCode` above.
 *   3. "etc".
 *
 * Why (2) exists: the catalog only knows the 8 tile ids, so every OTHER id -- the canonical 12
 * seed categories (random per-database UUIDs, reachable from the expense edit screen), imported
 * rows, and the demo backend's fixture categories -- collapsed to "etc", which quietly made the
 * expense_recorded categoryCode distribution meaningless on a real session. Unknown/legacy ids
 * still fall back to "etc" rather than leaking the raw id: payloads carry only the enum, never
 * the id (PII-safety rule, contracts analytics.pii-lint.test.ts).
 */
export function analyticsCategoryCodeForCategoryId(
  categoryId: string,
  serverCategories?: readonly AnalyticsServerCategory[] | null
): AnalyticsCategoryCode {
  const match = categoryCatalog.find((entry) => entry.id === categoryId);
  if (match) return match.code;
  if (!categoryId) return "etc";
  const serverMatch = (serverCategories ?? []).find((category) => category?.id === categoryId);
  return (serverMatch ? analyticsCategoryCodeForServerCode(serverMatch.code) : null) ?? "etc";
}

/**
 * Derives the coarse analytics category for a prepared-item template from its
 * display name. The items API (ItemSummary/ItemDetail in src/api/client.ts)
 * does not expose the template's server-side category, so this keyword map is
 * the best available on-device signal; anything unrecognized reports "etc".
 * The name itself never enters the payload -- only the resulting enum does.
 */
export function analyticsCategoryCodeForItemName(itemName: string): AnalyticsCategoryCode {
  const rules: Array<{ keywords: string[]; code: AnalyticsCategoryCode }> = [
    { keywords: ["기저귀", "물티슈", "위생"], code: "diaper_hygiene" },
    { keywords: ["분유", "이유식", "젖병", "수유", "유아식"], code: "feeding_babyfood" },
    { keywords: ["아기띠", "힙시트", "유모차", "카시트"], code: "outing_mobility" },
    { keywords: ["블록", "장난감", "도서", "그림책", "인형", "놀잇감"], code: "toys_books" },
    { keywords: ["의류", "내복", "세제", "옷"], code: "clothes_laundry" },
    { keywords: ["침대", "매트리스", "가구", "수면"], code: "sleep_furniture" }
  ];
  for (const rule of rules) {
    if (rule.keywords.some((keyword) => itemName.includes(keyword))) {
      return rule.code;
    }
  }
  return "etc";
}

/** expense_recorded v1 payload -- categoryCode + amountBucket + source + offline, nothing else. */
export function buildExpenseRecordedPayload(input: {
  categoryId: string;
  amountKrw: number;
  source: ExpenseRecordSource;
  offline: boolean;
  /**
   * Optional shared `["categories"]` list, so a categoryId outside the 8 static tiles still
   * resolves to its real code instead of "etc" -- see analyticsCategoryCodeForCategoryId. The
   * list itself never enters the payload; only the resulting enum does.
   */
  serverCategories?: readonly AnalyticsServerCategory[] | null;
}): { categoryCode: AnalyticsCategoryCode; amountBucket: ExpenseAmountBucket; source: ExpenseRecordSource; offline: boolean } {
  return {
    categoryCode: analyticsCategoryCodeForCategoryId(input.categoryId, input.serverCategories),
    amountBucket: bucketExpenseAmountKrw(input.amountKrw),
    source: input.source,
    offline: input.offline
  };
}

/** item_status_changed v1 payload -- the coarse category enum + the new status, nothing else. */
export function buildItemStatusChangedPayload(input: {
  itemName: string;
  status: AnalyticsItemStatus;
}): { itemCategoryCode: AnalyticsCategoryCode; status: AnalyticsItemStatus } {
  return {
    itemCategoryCode: analyticsCategoryCodeForItemName(input.itemName),
    status: input.status
  };
}

/** affiliate_link_clicked v1 payload -- platform + screen enums only (never the link URL/title/id). */
export function buildAffiliateLinkClickedPayload(input: {
  platform: AnalyticsProductPlatform;
  screenId: AffiliateClickScreen;
}): { platform: AnalyticsProductPlatform; screenId: AffiliateClickScreen } {
  return {
    platform: input.platform,
    screenId: input.screenId
  };
}
