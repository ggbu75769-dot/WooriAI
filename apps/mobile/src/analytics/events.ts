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
 * truth). Order and contents mirror packages/contracts/src/analytics.ts's ANALYTICS_CATEGORY_CODES
 * -- events.test.ts asserts that against the contracts file so the two cannot drift.
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

/**
 * Maps a stored `categoryId` to the coarse analytics category code: the static quick-expense
 * catalog (src/categories.ts) answers for its 8 tile ids, anything else reports "etc" rather
 * than leaking the raw id (payloads carry only the enum -- PII-safety rule, contracts
 * analytics.pii-lint.test.ts).
 *
 * 리뷰 F6: expense_recorded는 8타일 화면(app/expenses/new.tsx)에서만 발화하므로 여기 들어오는
 * categoryId는 언제나 카탈로그의 8개 중 하나다 -- 서버 카테고리 목록으로 한 번 더 해석하던
 * 경로(REC-121)는 도달 불가라 걷어냈다(지출 수정 화면은 이 이벤트를 발화하지 않는다).
 */
export function analyticsCategoryCodeForCategoryId(categoryId: string): AnalyticsCategoryCode {
  const match = categoryCatalog.find((entry) => entry.id === categoryId);
  return match ? match.code : "etc";
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
}): { categoryCode: AnalyticsCategoryCode; amountBucket: ExpenseAmountBucket; source: ExpenseRecordSource; offline: boolean } {
  return {
    categoryCode: analyticsCategoryCodeForCategoryId(input.categoryId),
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
