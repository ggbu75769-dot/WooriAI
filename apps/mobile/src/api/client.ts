import {
  getSeoulMonthRange,
  getSeoulToday
} from "@wooriai/domain/money-date";
import type { ChildStageCode, ChildStageMode } from "@wooriai/domain/enums";
import type { ChildSex, OnboardingCompletionInput } from "@wooriai/domain/onboarding";
import type {
  PreparationRecommendationReasonCode,
  PreparationRecommendationReasonParams
} from "@wooriai/domain/preparation-lifecycle";
import type { CatalogScenarioCode } from "@wooriai/domain/release4-catalog";
import {
  currentAccountDeletionResponseSchema,
  onboardingCompletionRequestSchema,
  onboardingCompletionResponseSchema,
  onboardingProgressSchema,
  onboardingStarterPreviewRequestSchema,
  onboardingStarterPreviewResponseSchema,
  type CustomBundleContract,
  type OnboardingCompletionResponseContract,
  type OnboardingChildSummaryContract,
  type OnboardingProgressContract,
  type OnboardingStarterItemContract,
  type OnboardingStarterPreviewResponseContract,
  type PreparationCalendarContract,
  type ReceiptDraftContract,
  type ReportCategoriesContract,
  type ReportMembersContract,
  type ReportPreparationContract,
  type ReportRecurringContract,
  type ReportSourceKind,
  type ReportSourcesContract,
  type ReportSummaryContract,
  type ReportTrendContract,
  type ReportV3Contract,
  type TodayCenterContract,
  type WeeklyBriefingContract
} from "@wooriai/contracts";
import {
  fixtureRuntimeEnabled as internalFixtureRuntimeEnabled,
  LOCAL_HOUSEHOLD_ID,
  fixtureSessionToken,
  LOCAL_USER_ID
} from "./fixture-identifiers";
import { fixtureBackend as localBackend } from "./fixture-backend-loader";
import { useSessionStore } from "../stores/session.store";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";

/**
 * Computed fresh on every call (never cached at module scope) so "이번 달" always tracks the
 * current Asia/Seoul month -- a fixed module-level constant would freeze "this month" forever
 * once the clock crossed into a new month (see money-date.ts for the Seoul-timezone helpers).
 */
function currentYearMonth(): string {
  return getSeoulToday().slice(0, 7);
}

function currentYearMonthDate(): string {
  return getSeoulMonthRange(currentYearMonth()).startInclusive;
}

/**
 * Token used by screens when `isTestSession` is true. The session store's real `accessToken`
 * always stays null for a local test session (see src/stores/session.store.ts and
 * src/test-login-flow.test.ts) -- screens instead pass this constant so client.ts can route
 * the call to the in-memory/persisted local backend instead of a real HTTP request.
 */
export { LOCAL_HOUSEHOLD_ID, fixtureSessionToken, LOCAL_USER_ID };

function isLocalToken(token?: string | null): boolean {
  return internalFixtureRuntimeEnabled && token === fixtureSessionToken;
}

function local<T>(factory: () => T): Promise<T> {
  // Yield one native frame before evaluating the standalone backend. A microtask runs before
  // React Native can commit its loading surface; a zero-delay task lets the UI paint first.
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(factory());
      } catch (error) {
        reject(error);
      }
    }, 0);
  });
}

/**
 * Bug fix (round5a post-Sprint2 hotfix): a leftover/real (non-`fixtureSessionToken`) session on
 * a standalone/demo device has no reachable API_BASE_URL server, and plain `fetch()` against an
 * unreachable "localhost"/dev host was observed (via on-device logcat repro) to hang for 60-90+
 * seconds per attempt instead of failing fast with a connection error -- with react-query's
 * default 3 retries, this left Home/준비템/리포트 stuck on their loading state indefinitely,
 * which is exactly the "무한 로딩" bug this constant fixes. Every real HTTP call below is wrapped
 * with this bound so a request that never settles is force-failed into the existing (already
 * correct) error/재시도 UI instead of hanging forever. Local-session calls (`local()` above) are
 * synchronous and unaffected.
 */
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

/** Wraps `fetch` with an AbortController-based timeout so a hung/unreachable connection always
 * settles (as a rejection) within `timeoutMs` instead of relying on the OS/network stack's own
 * (sometimes much longer, or absent) timeout behavior. */
function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  });
}

type RequestOptions = {
  token?: string | null;
  body?: unknown;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  signal?: AbortSignal;
  skipAuthRefresh?: boolean;
};

export type Expense = {
  id: string;
  childId: string;
  categoryId: string;
  amountKrw: number;
  spentOn: string;
  itemName: string;
  merchant?: string | null;
  paymentMethod: "unknown" | "cash" | "card" | "transfer" | "mobile_pay";
  paymentMethodId?: string | null;
  memo?: string | null;
  linkedItemDefinitionId?: string | null;
  expenseCategoryV2Id?: string | null;
  expenseType: "expense" | "gift" | "refund" | "support";
  source: "manual" | "excel_import" | "purchase_followup" | "receipt" | "admin";
  createdByUserId?: string | null;
  payerUserId?: string | null;
  // MOB-103 (round5a-sprint1-plan.md §2.1): optimistic-concurrency version, 1 on create, +1 on
  // every update/soft-delete. Used by MOB-102's offline outbox as `expectedVersion` on
  // update/delete -- see createExpenseWithIdempotency/updateExpenseWithVersion/
  // deleteExpenseWithVersion below.
  version: number;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message = "요청을 처리하지 못했어요.",
    requestId?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

export function isApiErrorCode(error: unknown, ...codes: string[]) {
  if (error instanceof ApiClientError) return codes.includes(error.code);
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return codes.includes(error.code);
  }
  // Local fixture errors predate the HTTP error envelope. Exact equality keeps this
  // compatibility path typed and prevents screens from parsing arbitrary/raw messages.
  return error instanceof Error && codes.includes(error.message);
}

function apiClientError(response: Response, data: unknown) {
  const errorEnvelope = data && typeof data === "object" && "error" in data
    ? (data as { error?: unknown }).error
    : null;
  const errorRecord = errorEnvelope && typeof errorEnvelope === "object"
    ? errorEnvelope as { code?: unknown; message?: unknown; requestId?: unknown; details?: unknown }
    : null;
  const code = typeof errorRecord?.code === "string" ? errorRecord.code : `HTTP_${response.status}`;
  const message = typeof errorRecord?.message === "string" ? errorRecord.message : "요청을 처리하지 못했어요.";
  const requestId = typeof errorRecord?.requestId === "string" ? errorRecord.requestId : undefined;
  const details = errorRecord?.details && typeof errorRecord.details === "object" && !Array.isArray(errorRecord.details)
    ? errorRecord.details as Record<string, unknown>
    : undefined;
  return new ApiClientError(response.status, code, message, requestId, details);
}

export type UserPaymentMethod = {
  id: string;
  type: "unknown" | "cash" | "card" | "transfer" | "mobile_pay";
  label: string;
  isDefault: boolean;
  active: boolean;
  displayOrder: number;
};

export type ExpenseShortcut = {
  itemName: string;
  categoryId: string;
  lastAmountKrw: number;
  useCount: number;
};

export type QuickExpensePreset = {
  id: string;
  householdId: string;
  userId: string | null;
  itemName: string;
  categoryId: string;
  defaultAmountKrw: number | null;
  paymentMethodId: string | null;
  pinned: boolean;
  useCount: number;
  lastUsedAt: string | null;
  displayOrder: number;
};

export type Budget = {
  childId: string;
  yearMonth: string;
  amountKrw: number;
  usedAmountKrw: number;
  remainingAmountKrw: number;
};

export type HomeSummary = {
  child: { id: string; householdId?: string; nickname: string; currentStage: string; stageLabel: string };
  totalExpenseKrw: number;
  monthly: Budget;
  recommendedItems: Array<{ id: string; name: string; status: string }>;
  recentExpenses: Expense[];
  todayCenter?: TodayCenterContract | null;
};

export type OnboardingStarterItem = OnboardingStarterItemContract;

export type CompleteOnboardingInput = OnboardingCompletionInput;

export type MonthlyReport = {
  childId: string;
  yearMonth: string;
  totalExpenseKrw: number;
  budgetAmountKrw: number | null;
  categoryTop: Array<{ categoryId: string; amountKrw: number; count: number }>;
};

export type CumulativeReport = {
  childId: string;
  totalExpenseKrw: number;
  yearly: Array<{ year: string; amountKrw: number; count: number }>;
};

export type CategoryReport = {
  childId: string;
  categories: Array<{ categoryId: string; amountKrw: number; count: number }>;
};

export type YearlyReport = {
  childId: string;
  year: string;
  totalExpenseKrw: number;
  monthlyTotals: Array<{ yearMonth: string; totalExpenseKrw: number }>;
};

export type ItemStatus = "not_prepared" | "prepared" | "gifted" | "not_needed" | "interested";

export type ItemSummary = {
  id: string;
  name: string;
  shortReason?: string;
  necessityLevel: "essential" | "convenience" | "optional";
  status: ItemStatus;
  timingLabel?: string;
  priceBandText?: string;
  stageCodes?: ChildStageCode[];
};

export type ProductLink = {
  id: string;
  platform: "coupang" | "naver" | "custom";
  title: string;
  isAffiliate: boolean;
  isSponsored: boolean;
  disclosureText?: string;
};

export type ItemDetail = ItemSummary & {
  reasonText: string;
  skipReasonText?: string | null;
  usedSecondhandOk: boolean;
  safetyNote?: string | null;
  productLinks: ProductLink[];
};

export type CatalogPlanState =
  | "not_considered"
  | "need"
  | "researching"
  | "planned"
  | "ordered"
  | "owned"
  | "borrowed"
  | "rented"
  | "gift_expected"
  | "gifted"
  | "not_needed"
  | "replacement_needed"
  | "replacement_due"
  | "replaced"
  | "ended"
  | "retired";

export type CatalogNodeSummary = {
  id: string;
  code: string;
  parentId: string | null;
  level: "domain" | "category" | "subcategory";
  nameKo: string;
  description: string | null;
  iconKey: string | null;
  displayOrder: number;
};

export type CatalogItemPlanSummary = {
  id?: string;
  state: CatalogPlanState;
  desiredQuantity: number | null;
  ownedQuantity: number | null;
  quantityNeeded?: number | null;
  quantityOwned?: number | null;
  dueDate?: string | null;
  acquisitionMode?: CatalogItemPlan["acquisitionMode"];
  acquisitionType?: CatalogItemPlan["acquisitionMode"];
  assignedUserId?: string | null;
  budgetKrw?: number | null;
  note?: string | null;
  notes?: string | null;
  size?: string | null;
  variant?: string | null;
  purchasedAt?: string | null;
  openedAt?: string | null;
  expiresAt?: string | null;
  replacementDueAt?: string | null;
  usageEndedAt?: string | null;
  storageLocation?: string | null;
  recurringIntervalDays?: number | null;
  nextPurchaseDueAt?: string | null;
  version?: number;
};

export type CatalogItemSummary = {
  id: string;
  code: string;
  nameKo: string;
  shortDescription: string;
  targetSubject: "mother" | "child" | "caregiver" | "household" | "shared";
  necessity: "required" | "recommended" | "conditional" | "optional";
  recommendationState: "recommended" | "conditional" | "professional_review_required" | "not_recommended" | "recalled_or_blocked" | "retired";
  timingSummary: string;
  safetyTier: "normal" | "elevated" | "high";
  safetyNote: string | null;
  status:
    | "draft"
    | "in_review"
    | "review_requested"
    | "editorial_review"
    | "domain_review"
    | "safety_review"
    | "changes_requested"
    | "approved"
    | "scheduled"
    | "published"
    | "suspended"
    | "recalled"
    | "archived"
    | "retired";
  primaryCategory: CatalogNodeSummary | null;
  plan: CatalogItemPlanSummary | null;
  searchMatch?: { score: number; reason: "canonical_exact" | "canonical_prefix" | "alias_exact" | "alias_contains" | "initials" | "typo" | "category"; matchedText: string };
};

export type CatalogProductOffer = {
  id: string;
  seller: string;
  brand: string | null;
  productName: string;
  modelName: string | null;
  publicUrl: string;
  affiliateUrl: string | null;
  isAffiliate: boolean;
  isSponsored: boolean;
  disclosureText: string | null;
  priceSnapshotKrw: number | null;
  priceCheckedAt: string | null;
  stockState: "in_stock" | "out_of_stock" | "preorder" | "discontinued" | "unknown";
  recallState: "clear" | "check_required" | "recalled" | "unknown";
  healthState: "healthy" | "stale" | "failed" | "blocked";
};

export type CatalogComparison = {
  item: { id: string; code: string; nameKo: string };
  schema: { schemaCode: string | null; fields: Array<{ key: string; labelKo: string; valueType: "text" | "number" }> };
  rankingPolicy: "catalog_display_order_only_no_affiliate_or_sponsor_signal";
  offers: Array<{
    id: string;
    seller: string;
    brand: string | null;
    modelName: string | null;
    productName: string;
    publicUrl: string;
    isAffiliate: boolean;
    isSponsored: boolean;
    disclosureText: string | null;
    priceSnapshotKrw: number | null;
    priceCheckedAt: string | null;
    priceFreshness: "current" | "stale" | "unknown";
    priceAgeDays: number | null;
    stockState: CatalogProductOffer["stockState"];
    recallState: "clear";
    attributes: Record<string, string | number | boolean>;
  }>;
};

export type CatalogItemDetail = CatalogItemSummary & {
  reasonText: string;
  skipReasonText: string | null;
  quantityGuidance: string | null;
  priceMinKrw: number | null;
  priceMaxKrw: number | null;
  secondhandPolicy: "allowed" | "inspect" | "avoid" | "prohibited";
  rentalPolicy: "suitable" | "conditional" | "unsuitable";
  medicalDisclaimerRequired: boolean;
  categories: CatalogNodeSummary[];
  lifecycles: Array<{ axis: "mother" | "child"; lifecycleCode: string; timingText: string | null }>;
  contexts: Array<{ contextCode: string; weight: number; required: boolean }>;
  offers: CatalogProductOffer[];
  reviewPending: boolean;
};

export type CatalogItemPlan = {
  id: string;
  householdId: string;
  childId: string | null;
  motherProfileId: string | null;
  itemDefinitionId: string;
  state: CatalogPlanState;
  desiredQuantity: number | null;
  ownedQuantity: number | null;
  dueDate: string | null;
  acquisitionMode: "new_purchase" | "secondhand" | "rental" | "borrow" | "gift" | "existing" | "undecided" | null;
  assignedUserId: string | null;
  budgetKrw: number | null;
  note: string | null;
  linkedExpenseId: string | null;
  quantityNeeded?: number | null;
  quantityOwned?: number | null;
  acquisitionType?: CatalogItemPlan["acquisitionMode"];
  notes?: string | null;
  size?: string | null;
  variant?: string | null;
  purchasedAt?: string | null;
  openedAt?: string | null;
  expiresAt?: string | null;
  replacementDueAt?: string | null;
  usageEndedAt?: string | null;
  storageLocation?: string | null;
  recurringIntervalDays?: number | null;
  nextPurchaseDueAt?: string | null;
  version: number;
};

export type CatalogItemPlanActivity = {
  plan: CatalogItemPlan;
  history: Array<{ id: string; actorUserId: string | null; actorDisplayName: string; fromVersion: number | null; toVersion: number; changesJson: Record<string, unknown>; createdAt: string }>;
  comments: Array<{ id: string; authorUserId: string; authorDisplayName: string; body: string; createdAt: string; deletedAt: string | null }>;
};

export type CatalogTimelineBucket = "this_week" | "this_month" | "next_stage" | "overdue" | "completed" | "not_needed";

export type CatalogTimelineItem = {
  id: string;
  code: string;
  nameKo: string;
  necessity: CatalogItemSummary["necessity"];
  safetyTier: CatalogItemSummary["safetyTier"];
  matchedContextCodes: CatalogScenarioCode[];
  bucket: CatalogTimelineBucket;
  dueWindow: {
    start: string | null;
    end: string | null;
    label: string;
    derivedFrom: "lifecycle" | "user_due" | "replacement" | "repeat_purchase";
  };
  recommendationReason: string;
  recommendationReasonCode: PreparationRecommendationReasonCode;
  recommendationReasonParams: PreparationRecommendationReasonParams;
  plan: CatalogItemPlan | null;
};

export type CatalogTimelineResponse = {
  context: {
    childId?: string;
    motherProfileId?: string;
    lifecycleAxis: "mother" | "child";
    lifecycleCode: string;
    nextLifecycleCode: string | null;
    selectedContextCodes: CatalogScenarioCode[];
    derivedContextCodes: CatalogScenarioCode[];
    activeContextCodes: CatalogScenarioCode[];
    contextVersion: number;
  };
  generatedAt: string;
  rankingPolicy: "user_due_then_timeline_then_lifecycle_priority_then_context_then_necessity_no_commerce_signal";
  buckets: Record<CatalogTimelineBucket, CatalogTimelineItem[]>;
};

export type PreparationContextResponse = {
  childId: string | null;
  motherProfileId: string | null;
  contextCodes: CatalogScenarioCode[];
  availableContextCodes: readonly CatalogScenarioCode[];
  version: number;
  updatedAt: string | null;
};

export type CatalogSafetyAlert = {
  id: string;
  itemDefinitionId: string;
  userItemPlanId: string;
  eventType: "blocked" | "recalled";
  reason: string;
  itemContentVersion: number;
  state: "unread" | "acknowledged";
  acknowledgedAt: string | null;
  version: number;
  createdAt: string;
  planState: CatalogPlanState | null;
  item: Pick<CatalogItemSummary, "id" | "code" | "nameKo" | "safetyTier" | "safetyNote" | "status"> | null;
  actionGuidance: string;
  sourceStatus: "official_or_professional_source_required";
};

export type CatalogBundle = {
  id: string;
  code: string;
  nameKo: string;
  description: string;
  items: Array<CatalogItemSummary & { bundleNecessity: CatalogItemSummary["necessity"]; defaultQuantity: number | null }>;
  progress: { totalCount: number; completedCount: number; percentage: number };
};

export type CatalogBundleApplyItem = {
  itemId: string;
  state: CatalogPlanState;
  quantityNeeded?: number;
  assignedUserId?: string;
  dueDate?: string;
  budgetKrw?: number;
  note?: string;
  expectedVersion?: number;
};

export type CatalogBundleApplyResponse = {
  bundleId: string;
  childId: string;
  selectedCount: number;
  excludedCount: number;
  warnings: Array<{ code: "DUPLICATE_PURCHASE_RISK"; itemId: string; currentState: CatalogPlanState; requestedState: CatalogPlanState }>;
  appliedCount: number;
  plans: CatalogItemPlan[];
};

export type AffiliateClickResponse = {
  clickId: string;
  redirectUrl: string;
  disclosureText?: string;
};

export type HouseholdMember = {
  id: string;
  householdId: string;
  userId: string;
  displayName: string;
  role: "owner" | "co_parent" | "viewer" | "gift_participant";
  status: "pending" | "active" | "removed" | "left";
  joinedAt?: string;
};

export type InviteRole = "co_parent" | "viewer" | "gift_participant";

export type InviteChannel = "kakao" | "sms" | "link";

export type InviteResponse = {
  inviteUrl: string;
  expiresAt: string;
  householdName?: string;
};

export type InvitePreview = {
  householdName: string;
  role: InviteRole;
  expiresAt: string;
};

export type AcceptInviteResponse = {
  household: {
    id: string;
    name: string;
    role: InviteRole;
  };
};

export type ImportJob = {
  id: string;
  status: "uploaded" | "analyzing" | "preview_ready" | "confirmed" | "failed" | "cancelled";
  rowCount: number;
  candidateCount: number;
  importedCount: number;
};

export type ImportRow = {
  id: string;
  rowIndex: number;
  parsedDate?: string;
  parsedItemName?: string;
  parsedAmountKrw?: number;
  categoryId?: string;
  confidence: number;
  selected: boolean;
  validationStatus: string;
};

export type ConfirmImportResponse = {
  importedCount: number;
  skippedCount: number;
};

export type PrivacySettings = {
  flows: Array<{
    id: "account_delete" | "household_leave" | "child_profile_delete";
    title: string;
    impact: string[];
    confirmationText: string;
  }>;
};

export type SettingsPreview = {
  flowId: "account_delete" | "household_leave" | "child_profile_delete";
  requiresSecondStep: boolean;
  confirmationText: string;
  impact: string[];
};

export type SettingsConfirmResponse = {
  success: boolean;
  flowId: string;
  deletion?: AccountDeletionRequest;
};

export type AccountDeletionRequest = {
  id: string;
  requestType: "deletion";
  state: "requested" | "access_revoked" | "processor_delete_queued" | "purging" | "retained_exception" | "completed" | "failed" | "cancelled";
  requestedAt: string;
  dueAt: string | null;
  completedAt: string | null;
  failureCode: string | null;
  exportExpiresAt: string | null;
  statusToken?: string;
};

export type OnboardingNextStep = "consents" | "child-profile" | "prepared-items" | "budget" | "home";

export type OnboardingChildSummary = OnboardingChildSummaryContract;

/**
 * MOB-101 (round5a-sprint1-plan.md §4): server-side source of truth for where a session left
 * off in onboarding, so app restart / re-login / token refresh restores the exact right step
 * instead of always restarting at ONB-001. `canRestart` is false once a child has been
 * created for the household -- the "처음부터 시작" option on the resume screen (ONB-006) is
 * only offered while nothing exists yet to duplicate or orphan.
 */
export type OnboardingProgress = OnboardingProgressContract;

export function getOnboardingProgress(token: string) {
  if (isLocalToken(token)) return local(() => onboardingProgressSchema.parse(localBackend.onboardingStatus()));
  return requestJson<unknown>("/onboarding/status", { token })
    .then((response): OnboardingProgressContract => onboardingProgressSchema.parse(response));
}

/** Thrown by refreshAccessToken so callers can tell an expired/invalid refresh token (401) apart
 * from a network failure -- only the former should clear the session. */
class RefreshHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RefreshSessionSnapshot = Readonly<{
  sessionGeneration: number;
  userId: string;
  defaultHouseholdId: string | null;
  accessToken: string;
  refreshToken: string;
}>;

/**
 * Captures the credential owner before a request leaves the device. A delayed
 * 401 must never read whatever session happens to be current when the response
 * arrives: that could redeem or erase a different user's refresh token.
 */
function captureRefreshSession(accessToken: string | null | undefined): RefreshSessionSnapshot | null {
  const session = useSessionStore.getState();
  if (
    !accessToken ||
    !session.accessToken ||
    !session.refreshToken ||
    !session.userId ||
    accessToken !== session.accessToken
  ) {
    return null;
  }
  return {
    sessionGeneration: session.sessionGeneration,
    userId: session.userId,
    defaultHouseholdId: session.defaultHouseholdId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken
  };
}

function isSameRefreshOwner(
  session: ReturnType<typeof useSessionStore.getState>,
  owner: RefreshSessionSnapshot
): boolean {
  return (
    session.sessionGeneration === owner.sessionGeneration &&
    session.userId === owner.userId &&
    session.defaultHouseholdId === owner.defaultHouseholdId
  );
}

function ownsOriginalCredentials(
  session: ReturnType<typeof useSessionStore.getState>,
  owner: RefreshSessionSnapshot
): boolean {
  return (
    isSameRefreshOwner(session, owner) &&
    session.accessToken === owner.accessToken &&
    session.refreshToken === owner.refreshToken
  );
}

/**
 * Single-flight is scoped to the captured identity epoch and refresh token.
 * This keeps concurrent 401s for one session on one redemption while allowing
 * a newly logged-in session to proceed independently.
 */
const refreshFlights = new Map<string, Promise<string | null>>();

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new RefreshHttpError(response.status, JSON.stringify(data));
  }
  return data as { accessToken: string; refreshToken: string };
}

function performSessionBoundRefresh(owner: RefreshSessionSnapshot): Promise<string | null> {
  const current = useSessionStore.getState();
  if (!isSameRefreshOwner(current, owner)) return Promise.resolve(null);

  // Another request from this same identity epoch may already have completed
  // rotation. Reuse its access token without redeeming the consumed token again.
  if (!ownsOriginalCredentials(current, owner)) {
    return Promise.resolve(current.accessToken);
  }

  const flightKey = [
    owner.sessionGeneration,
    owner.userId,
    owner.defaultHouseholdId ?? "",
    owner.refreshToken
  ].join(":");
  const existing = refreshFlights.get(flightKey);
  if (existing) return existing;

  const flight = refreshAccessToken(owner.refreshToken)
    .then((refreshed) => {
      const latest = useSessionStore.getState();
      if (ownsOriginalCredentials(latest, owner)) {
        latest.setTokens(refreshed.accessToken, refreshed.refreshToken);
        return refreshed.accessToken;
      }
      // Logout/login happened while the refresh was in flight. The old result
      // is intentionally discarded and the caller will expose its original 401.
      if (!isSameRefreshOwner(latest, owner)) return null;
      return latest.accessToken;
    })
    .catch((error: unknown) => {
      const latest = useSessionStore.getState();
      if (
        error instanceof RefreshHttpError &&
        error.status === 401 &&
        ownsOriginalCredentials(latest, owner)
      ) {
        latest.clearSession();
      }
      throw error;
    })
    .finally(() => {
      if (refreshFlights.get(flightKey) === flight) {
        refreshFlights.delete(flightKey);
      }
    });
  refreshFlights.set(flightKey, flight);
  return flight;
}

async function requestJson<T>(
  path: string,
  options: RequestOptions = {},
  isRetry = false,
  refreshOwner = captureRefreshSession(options.token)
): Promise<T> {
  // Network failures (fetch rejecting -- offline, DNS, etc.) are distinct from a resolved 401
  // response: only a resolved 401 should trigger a refresh attempt, so a rejected fetch is
  // rethrown immediately without touching the refresh flow.
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  }, DEFAULT_FETCH_TIMEOUT_MS, options.signal);

  const canAttemptRefresh =
    response.status === 401 &&
    !isRetry &&
    options.token &&
    !isLocalToken(options.token) &&
    !options.skipAuthRefresh &&
    refreshOwner;
  if (canAttemptRefresh) {
    try {
      const retryToken = await performSessionBoundRefresh(refreshOwner);
      if (retryToken) {
        return requestJson<T>(path, { ...options, token: retryToken }, true, refreshOwner);
      }
    } catch {
      // Falls through to the original 401 response below, whether the refresh failed due to
      // an expired/invalid refresh token or a network error while refreshing.
    }
  }

  const data = (await response.json().catch(() => null)) as T;
  if (!response.ok) {
    throw apiClientError(response, data);
  }
  return data;
}

/**
 * Revokes the captured refresh-token family without rotating credentials.
 * Logout already committed a local tombstone; a late 401 must never revive or
 * mutate that ended local session.
 */
export function logoutSession(
  _accessToken: string,
  refreshToken: string,
  signal?: AbortSignal
): Promise<{ success: boolean }> {
  return requestJson<{ success: boolean }>("/auth/logout/refresh", {
    method: "POST",
    body: { refreshToken },
    signal,
    skipAuthRefresh: true
  });
}

/**
 * Multipart counterpart to requestJson, used only by createExcelImport's real-backend path.
 * Shares the same single-flight 401/refresh retry behavior as requestJson (see there for the
 * network-error-vs-401 and single-retry rules) but sends a FormData body instead of JSON --
 * fetch sets the multipart boundary Content-Type header itself when given a FormData body, so
 * none is set explicitly here.
 */
async function requestMultipartJson<T>(
  path: string,
  options: { token?: string | null; formData: FormData },
  isRetry = false,
  refreshOwner = captureRefreshSession(options.token)
): Promise<T> {
  // File uploads legitimately take longer than a plain JSON request -- a wider bound than
  // DEFAULT_FETCH_TIMEOUT_MS still guarantees this settles instead of hanging forever, without
  // punishing a real (slow-network) import upload.
  const response = await fetchWithTimeout(
    `${API_BASE_URL}${path}`,
    {
      method: "POST",
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
      },
      body: options.formData as unknown as BodyInit
    },
    30_000
  );

  const canAttemptRefresh =
    response.status === 401 &&
    !isRetry &&
    options.token &&
    !isLocalToken(options.token) &&
    refreshOwner;
  if (canAttemptRefresh) {
    try {
      const retryToken = await performSessionBoundRefresh(refreshOwner);
      if (retryToken) {
        return requestMultipartJson<T>(path, { ...options, token: retryToken }, true, refreshOwner);
      }
    } catch {
      // The original 401 below remains the public error for this request.
    }
  }

  const data = (await response.json().catch(() => null)) as T;
  if (!response.ok) {
    throw apiClientError(response, data);
  }
  return data;
}

export type OAuthLoginResult = {
    user: {
      id: string;
      displayName: string;
      email: string | null;
      households?: Array<{ id: string; name: string; role: string }>;
    };
    tokens: { accessToken: string; refreshToken: string; expiresIn: number };
    onboardingRequired: boolean;
};

export type LegalDocument = {
  documentType: "terms" | "privacy";
  version: string;
  locale: string;
  title: string;
  bodyMarkdown: string;
  publicUrl: string | null;
  contentHash: string;
  effectiveAt: string;
  publishedAt: string;
  placeholder: false;
};

export type ConsentSelection = Pick<LegalDocument, "documentType" | "version" | "contentHash"> & {
  accepted: true;
};

export type NotificationInboxItem = {
  id: string;
  eventType: string;
  category: "safety" | "replacement" | "family" | "budget" | "invitation" | "service";
  title: string;
  body: string;
  importance: "normal" | "critical";
  route: "preparation" | "family" | "reports" | null;
  navigation:
    | { kind: "item"; householdId: string; childId: string; itemId: string }
    | { kind: "family"; householdId: string }
    | { kind: "reports"; householdId: string; childId: string }
    | null;
  requiresAcknowledgement: boolean;
  read: boolean;
  occurredAt: string;
};

/** Development-only login retained for API tests and the isolated local fixture lane. */
export async function oauthLogin(provider: "kakao" | "apple" | "google") {
  return requestJson<OAuthLoginResult>("/auth/oauth-login", {
    method: "POST",
    body: { provider, providerToken: `dev-${provider}` }
  });
}

export function prepareKakaoLogin(input: { redirectUri: string; codeChallenge: string }) {
  return requestJson<{
    transactionId: string;
    state: string;
    nonce: string;
    authorizationUrl: string;
  }>("/auth/kakao/prepare", {
    method: "POST",
    body: input
  });
}

export function exchangeKakaoLogin(input: {
  transactionId: string;
  state: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}) {
  return requestJson<OAuthLoginResult>("/auth/kakao/exchange", {
    method: "POST",
    body: input
  });
}

export function getCurrentLegalDocuments(token?: string | null) {
  if (isLocalToken(token)) return local(() => localBackend.getCurrentLegalDocuments());
  return requestJson<LegalDocument[]>("/legal/documents/current", { token });
}

export function upsertConsents(token: string, consents: ConsentSelection[]) {
  if (isLocalToken(token)) return local(() => localBackend.upsertConsents(consents));
  return requestJson<{ success: boolean }>("/consents", {
    method: "PUT",
    token,
    body: {
      consents: consents.map(({ documentType, ...consent }) => ({ type: documentType, ...consent }))
    }
  });
}

export function listNotifications(token: string, cursor?: string, limit = 20) {
  if (isLocalToken(token)) {
    return local(() => ({ items: [] as NotificationInboxItem[], nextCursor: null as string | null }));
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return requestJson<{ items: NotificationInboxItem[]; nextCursor: string | null }>(`/notifications?${params.toString()}`, { token });
}

export function markNotificationsRead(token: string, ids: string[]) {
  if (isLocalToken(token)) return local(() => ({ requestedCount: new Set(ids).size, changedCount: 0, readAt: new Date().toISOString() }));
  return requestJson<{ requestedCount: number; changedCount: number; readAt: string }>("/notifications/read", {
    method: "PUT",
    token,
    body: { ids }
  });
}

/**
 * `idempotencyKey` (MOB-101, round5a-sprint1-plan.md §4): the onboarding-progress store hands
 * out one stable key per child draft (see getOrCreateChildCreateIdempotencyKey) and reuses it
 * across retries of the same child-profile submission, so a lost response / app restart mid
 * request can safely resubmit without the server creating a second child for the household.
 */
export function createChild(
  token: string,
  body: {
    householdId: string;
    nickname: string;
    stageMode: ChildStageMode;
    dueDate?: string;
    birthDate?: string;
    manualStage?: ChildStageCode | null;
    gender?: string;
  },
  idempotencyKey?: string
) {
  if (isLocalToken(token)) return local(() => localBackend.createChild(body));
  return requestJson<{ id: string }>("/children", {
    method: "POST",
    token,
    body,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined
  });
}

export function previewOnboardingStarterItems(
  token: string,
  body: { stageMode: ChildStageMode; dueDate?: string; birthDate?: string; manualStage?: ChildStageCode }
) {
  const request = onboardingStarterPreviewRequestSchema.parse(body);
  if (isLocalToken(token)) {
    return local(() => onboardingStarterPreviewResponseSchema.parse(localBackend.previewOnboardingStarterItems(request)));
  }
  return requestJson<unknown>("/onboarding/starter-items/preview", { method: "POST", token, body: request })
    .then((response): OnboardingStarterPreviewResponseContract => onboardingStarterPreviewResponseSchema.parse(response));
}

export function completeOnboarding(token: string, body: CompleteOnboardingInput, idempotencyKey: string) {
  if (isLocalToken(token)) {
    return local(() => onboardingCompletionResponseSchema.parse(localBackend.completeOnboarding(body, idempotencyKey)));
  }
  const request = onboardingCompletionRequestSchema.parse(body);
  return requestJson<unknown>("/onboarding/complete", {
    method: "POST",
    token,
    body: request,
    headers: { "Idempotency-Key": idempotencyKey }
  }).then((response): OnboardingCompletionResponseContract => onboardingCompletionResponseSchema.parse(response));
}

export function listChildren(token: string) {
  if (isLocalToken(token)) return local(() => localBackend.listChildren());
  return requestJson<{ children: OnboardingChildSummary[] }>("/children", { token });
}

export function getChild(token: string, childId: string) {
  if (isLocalToken(token)) return local(() => localBackend.getChild(childId));
  return requestJson<OnboardingChildSummary>(`/children/${childId}`, { token });
}

export function updateChild(
  token: string,
  childId: string,
  body: {
    nickname?: string;
    stageMode?: ChildStageMode;
    dueDate?: string;
    birthDate?: string;
    manualStage?: ChildStageCode;
    gender?: string;
  }
) {
  if (isLocalToken(token)) return local(() => localBackend.updateChild(childId, body));
  return requestJson<OnboardingChildSummary>(`/children/${childId}`, {
    method: "PATCH",
    token,
    body
  });
}

export function setPreparedItems(token: string, childId: string, itemTemplateIds: string[]) {
  if (isLocalToken(token)) return local(() => localBackend.setPreparedItems(childId, itemTemplateIds));
  return requestJson<{ updatedCount: number }>(`/children/${childId}/prepared-items`, {
    method: "POST",
    token,
    body: { itemTemplateIds }
  });
}

/**
 * Resolves to `null` (instead of rejecting) when no budget has been set for the month yet --
 * both the local backend and the real API surface this as a 404/"not found" condition, which
 * is a normal "budget not set" state for screens to render, not an error to show a retry card for.
 */
export async function getBudget(token: string, childId: string, yearMonth?: string): Promise<Budget | null> {
  const effectiveYearMonth = yearMonth ?? currentYearMonth();
  if (isLocalToken(token)) {
    try {
      return await local(() => localBackend.getBudget(childId, effectiveYearMonth));
    } catch (error) {
      if (error instanceof Error && error.message.includes("월 예산을 찾을 수 없어요")) return null;
      throw error;
    }
  }
  try {
    return await requestJson<Budget>(`/children/${childId}/budget?yearMonth=${effectiveYearMonth}`, { token });
  } catch (error) {
    if (error instanceof Error && error.message.includes("BUDGET_NOT_FOUND")) return null;
    throw error;
  }
}

export function upsertBudget(
  token: string,
  childId: string,
  amountKrw: number,
  yearMonth?: string
) {
  const effectiveYearMonth = yearMonth ?? currentYearMonthDate();
  if (isLocalToken(token)) return local(() => localBackend.upsertBudget(childId, amountKrw, effectiveYearMonth));
  return requestJson<Budget>(`/children/${childId}/budget`, {
    method: "PUT",
    token,
    body: { yearMonth: effectiveYearMonth, amountKrw }
  });
}

export function getHome(token: string, childId: string) {
  if (isLocalToken(token)) return local(() => localBackend.getHome(childId));
  return requestJson<HomeSummary>(`/home?childId=${childId}`, { token });
}

export function listPaymentMethods(token: string) {
  if (isLocalToken(token)) return local(() => localBackend.listPaymentMethods());
  return requestJson<{ paymentMethods: UserPaymentMethod[] }>("/me/payment-methods", { token });
}

export function createPaymentMethod(
  token: string,
  body: Pick<UserPaymentMethod, "type" | "label"> & { isDefault?: boolean }
) {
  if (isLocalToken(token)) return local(() => localBackend.createPaymentMethod(body));
  return requestJson<UserPaymentMethod>("/me/payment-methods", { method: "POST", token, body });
}

export function updatePaymentMethod(
  token: string,
  paymentMethodId: string,
  body: Partial<Pick<UserPaymentMethod, "type" | "label" | "displayOrder" | "isDefault">>
) {
  if (isLocalToken(token)) return local(() => localBackend.updatePaymentMethod(paymentMethodId, body));
  return requestJson<UserPaymentMethod>(`/me/payment-methods/${paymentMethodId}`, { method: "PATCH", token, body });
}

export function deactivatePaymentMethod(token: string, paymentMethodId: string) {
  if (isLocalToken(token)) return local(() => localBackend.deactivatePaymentMethod(paymentMethodId));
  return requestJson<UserPaymentMethod>(`/me/payment-methods/${paymentMethodId}`, { method: "DELETE", token });
}

export function setDefaultPaymentMethod(token: string, paymentMethodId: string) {
  if (isLocalToken(token)) return local(() => localBackend.setDefaultPaymentMethod(paymentMethodId));
  return requestJson<UserPaymentMethod>(`/me/payment-methods/${paymentMethodId}/default`, { method: "PUT", token });
}

export function createExpense(
  token: string,
  childId: string,
  body: {
    categoryId: string;
    amountKrw: number;
    spentOn: string;
    itemName: string;
    merchant?: string;
    paymentMethod?: "unknown" | "cash" | "card" | "transfer" | "mobile_pay";
    paymentMethodId?: string;
    memo?: string;
    linkedItemTemplateId?: string;
    linkedItemDefinitionId?: string;
    expenseCategoryV2Id?: string;
    expenseType?: "expense" | "gift";
    payerUserId?: string;
  }
) {
  if (isLocalToken(token)) return local(() => localBackend.createExpense(childId, body));
  return requestJson<Expense>(`/children/${childId}/expenses`, {
    method: "POST",
    token,
    body
  });
}

export function listExpenses(token: string, childId: string, yearMonth?: string) {
  const effectiveYearMonth = yearMonth ?? currentYearMonth();
  if (isLocalToken(token)) return local(() => localBackend.listExpenses(childId, effectiveYearMonth));
  return requestJson<{ expenses: Expense[]; totalAmountKrw: number }>(
    `/children/${childId}/expenses?yearMonth=${effectiveYearMonth}`,
    { token }
  );
}

export function listExpenseShortcuts(token: string, childId: string) {
  if (isLocalToken(token)) return local(() => localBackend.listExpenseShortcuts(childId));
  return requestJson<{ shortcuts: ExpenseShortcut[] }>(`/children/${childId}/expense-shortcuts`, { token });
}

export function listQuickExpensePresets(token: string, householdId: string) {
  if (isLocalToken(token)) return local(() => ({ presets: [] as QuickExpensePreset[] }));
  return requestJson<{ presets: QuickExpensePreset[] }>(`/households/${householdId}/expense-presets`, { token });
}

export function createQuickExpensePreset(
  token: string,
  householdId: string,
  body: {
    itemName: string;
    categoryId: string;
    defaultAmountKrw?: number;
    paymentMethodId?: string;
    pinned?: boolean;
  }
) {
  return requestJson<QuickExpensePreset>(`/households/${householdId}/expense-presets`, {
    method: "POST",
    token,
    body
  });
}

export function recordQuickExpensePresetUse(token: string, householdId: string, presetId: string) {
  return requestJson<QuickExpensePreset>(`/households/${householdId}/expense-presets/${presetId}/use`, {
    method: "POST",
    token
  });
}

export function getExpense(token: string, expenseId: string) {
  if (isLocalToken(token)) return local(() => localBackend.getExpense(expenseId));
  return requestJson<Expense>(`/expenses/${expenseId}`, { token });
}

export function updateExpense(
  token: string,
  expenseId: string,
  body: Partial<Pick<Expense, "categoryId" | "amountKrw" | "spentOn" | "itemName" | "memo" | "expenseType" | "paymentMethod" | "paymentMethodId">>
) {
  if (isLocalToken(token)) return local(() => localBackend.updateExpense(expenseId, body));
  return requestJson<Expense>(`/expenses/${expenseId}`, { method: "PATCH", token, body });
}

export function deleteExpense(token: string, expenseId: string) {
  if (isLocalToken(token)) return local(() => localBackend.deleteExpense(expenseId));
  return requestJson<{ success: boolean }>(`/expenses/${expenseId}`, {
    method: "DELETE",
    token
  });
}

// ---------------------------------------------------------------------------
// MOB-102/MOB-103 (round5a-sprint1-plan.md §2.2, §2.3, §3) -- additive-only extensions for the
// offline outbox (src/offline/*). These are new exports; none of the functions above are
// touched or change signature. They carry `expectedVersion`/`Idempotency-Key` explicitly instead
// of reusing createExpense/updateExpense/deleteExpense so those existing call sites/behavior
// stay byte-for-byte unchanged.
// ---------------------------------------------------------------------------

export const EXPENSE_IDEMPOTENCY_HEADER = "Idempotency-Key";

/** Mirrors the server's 409 VERSION_CONFLICT `current` field (design doc §2.2). */
export type ExpenseConflictSnapshot = (Expense & { version: number }) | { id: string; deleted: true; version: number } | null;

export class ExpenseVersionConflictError extends Error {
  readonly current: ExpenseConflictSnapshot;
  constructor(current: ExpenseConflictSnapshot) {
    super("VERSION_CONFLICT");
    this.name = "ExpenseVersionConflictError";
    this.current = current;
  }
}

export class ExpenseHttpError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown) {
    super(`Expense request failed with status ${status}`);
    this.name = "ExpenseHttpError";
    this.status = status;
    this.body = body;
  }
}

/** Bridges a LocalVersionConflictError thrown by the local-session backend into the same typed
 * error shape a real 409 response produces, so callers (the offline sync engine) never need to
 * branch on local vs. real session. */
function rethrowAsExpenseError(error: unknown): never {
  if (error instanceof localBackend.LocalVersionConflictError) {
    throw new ExpenseVersionConflictError(error.current as ExpenseConflictSnapshot);
  }
  if (error instanceof Error) {
    throw new ExpenseHttpError(422, { error: { code: "VALIDATION_ERROR", message: error.message } });
  }
  throw error;
}

type ExpenseRequestOptions = {
  token?: string | null;
  method?: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

/**
 * Fetch wrapper dedicated to the version-aware expense endpoints: unlike requestJson, this
 * surfaces the HTTP status/body distinctly (as ExpenseVersionConflictError for 409, or
 * ExpenseHttpError for any other non-2xx) instead of collapsing every failure into a single
 * `Error(JSON.stringify(data))`, since the offline sync engine (src/offline/sync-engine.ts)
 * needs to tell a version conflict apart from a permanent validation failure apart from a
 * network error. Reuses the same single-flight refresh-on-401 flow as requestJson.
 */
async function requestExpenseJson<T>(
  path: string,
  options: ExpenseRequestOptions,
  isRetry = false,
  refreshOwner = captureRefreshSession(options.token)
): Promise<T> {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.idempotencyKey ? { [EXPENSE_IDEMPOTENCY_HEADER]: options.idempotencyKey } : {})
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  }, DEFAULT_FETCH_TIMEOUT_MS, options.signal);

  const canAttemptRefresh =
    response.status === 401 &&
    !isRetry &&
    options.token &&
    !isLocalToken(options.token) &&
    refreshOwner;
  if (canAttemptRefresh) {
    try {
      const retryToken = await performSessionBoundRefresh(refreshOwner);
      if (retryToken) {
        return requestExpenseJson<T>(path, { ...options, token: retryToken }, true, refreshOwner);
      }
    } catch {
      // The original 401 below remains the public error for this request.
    }
  }

  const data = await response.json().catch(() => null);
  if (response.status === 409) {
    // H-1 fix: not every 409 on these endpoints is a VERSION_CONFLICT -- the shared
    // IdempotencyInterceptor (apps/api/src/common/idempotency/idempotency.interceptor.ts) also
    // 409s with IDEMPOTENCY_KEY_CONFLICT when the same Idempotency-Key is replayed with a
    // different body, and that body has no `current` field at all. Only treat it as a version
    // conflict when the server actually says so; anything else is a permanent HTTP failure like
    // any other non-2xx, not a conflict the offline sync engine should try to resolve.
    const conflictBody = data as { error?: { code?: string }; current?: ExpenseConflictSnapshot } | null;
    if (conflictBody?.error?.code === "VERSION_CONFLICT") {
      throw new ExpenseVersionConflictError(conflictBody.current ?? null);
    }
    throw new ExpenseHttpError(response.status, data);
  }
  if (!response.ok) {
    throw new ExpenseHttpError(response.status, data);
  }
  return data as T;
}

export function createExpenseWithIdempotency(
  token: string,
  childId: string,
  body: {
    categoryId: string;
    amountKrw: number;
    spentOn: string;
    itemName: string;
    merchant?: string;
    paymentMethod?: "unknown" | "cash" | "card" | "transfer" | "mobile_pay";
    paymentMethodId?: string;
    memo?: string;
    linkedItemTemplateId?: string;
    linkedItemDefinitionId?: string;
    expenseCategoryV2Id?: string;
    expenseType?: "expense" | "gift";
  },
  idempotencyKey: string,
  signal?: AbortSignal
): Promise<Expense> {
  if (isLocalToken(token)) {
    return local(() => localBackend.createExpenseIdempotent(childId, body, idempotencyKey)).catch(rethrowAsExpenseError);
  }
  return requestExpenseJson<Expense>(`/children/${childId}/expenses`, {
    token,
    method: "POST",
    body,
    idempotencyKey,
    signal
  });
}

export function updateExpenseWithVersion(
  token: string,
  expenseId: string,
  body: Partial<Pick<Expense, "categoryId" | "amountKrw" | "spentOn" | "itemName" | "memo" | "expenseType" | "paymentMethod" | "paymentMethodId">>,
  expectedVersion: number,
  idempotencyKey: string,
  signal?: AbortSignal
): Promise<Expense> {
  if (isLocalToken(token)) {
    return local(() => localBackend.updateExpense(expenseId, body, expectedVersion)).catch(rethrowAsExpenseError);
  }
  return requestExpenseJson<Expense>(`/expenses/${expenseId}`, {
    token,
    method: "PATCH",
    body: { ...body, expectedVersion },
    idempotencyKey,
    signal
  });
}

export function deleteExpenseWithVersion(
  token: string,
  expenseId: string,
  expectedVersion: number,
  idempotencyKey: string,
  signal?: AbortSignal
): Promise<{ success: boolean }> {
  if (isLocalToken(token)) {
    return local(() => localBackend.deleteExpense(expenseId, expectedVersion)).catch(rethrowAsExpenseError);
  }
  return requestExpenseJson<{ success: boolean }>(`/expenses/${expenseId}?expectedVersion=${expectedVersion}`, {
    token,
    method: "DELETE",
    idempotencyKey,
    signal
  });
}

export type SyncChange =
  | { type: "expense"; op: "upsert"; data: Expense }
  | { type: "expense"; op: "delete"; id: string; version: number; deletedAt: string };

export type SyncChangesResult = {
  changes: SyncChange[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type SyncChangeV2 =
  | {
      type: "expense";
      op: "upsert";
      householdId: string;
      childId: string;
      data: Expense;
    }
  | {
      type: "expense";
      op: "delete";
      householdId: string;
      childId: string;
      id: string;
      version: number;
      deletedAt: string;
    };

export type SyncChangesV2Result = {
  changes: SyncChangeV2[];
  nextCursor: string | null;
  hasMore: boolean;
};

/**
 * MOB-102/MOB-103 §2.3 delta sync -- kept intentionally minimal on the mobile side per the
 * design doc's note that client-side delta pull is best-effort this sprint: the sync controller
 * (src/offline/sync-controller.ts) uses this only for a single best-effort pull on app
 * foreground/reconnect, not a persisted incremental cursor/merge pipeline.
 */
export function getSyncChanges(token: string, cursor?: string, limit?: number): Promise<SyncChangesResult> {
  if (isLocalToken(token)) return local(() => localBackend.getSyncChanges());
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return requestJson<SyncChangesResult>(`/sync/changes${query ? `?${query}` : ""}`, { token });
}

export function getSyncChangesV2(
  token: string,
  householdId: string,
  cursor?: string,
  limit?: number,
  signal?: AbortSignal
): Promise<SyncChangesV2Result> {
  if (isLocalToken(token)) {
    return local(() => ({ changes: [], nextCursor: cursor ?? null, hasMore: false }));
  }
  const params = new URLSearchParams({ householdId });
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", String(limit));
  return requestJson<SyncChangesV2Result>(`/sync/v2/changes?${params}`, { token, signal });
}

export type LegacyOfflineReconcileMutation = {
  sourceLocalId: string;
  sourceMutationId: string;
  idempotencyKey: string;
  method: "POST" | "PATCH" | "DELETE";
  path: string;
  body: Record<string, unknown>;
};

export type LegacyOfflineReconcileResult = {
  sourceLocalId: string;
  sourceMutationId: string;
  disposition: "attributable" | "already_synced" | "ambiguous";
  reasonCode: string;
  response?: unknown;
};

export function reconcileLegacyOfflineMutations(
  token: string,
  mutations: LegacyOfflineReconcileMutation[],
  signal?: AbortSignal
) {
  if (isLocalToken(token)) {
    return local(() => ({
      results: mutations.map((mutation) => ({
        sourceLocalId: mutation.sourceLocalId,
        sourceMutationId: mutation.sourceMutationId,
        disposition: "ambiguous" as const,
        reasonCode: "LOCAL_FIXTURE_HAS_NO_SERVER_IDEMPOTENCY_LEDGER"
      }))
    }));
  }
  return requestJson<{ results: LegacyOfflineReconcileResult[] }>(
    "/sync/offline/reconcile-legacy",
    { method: "POST", token, body: { mutations }, signal }
  );
}

export function getMonthlyReport(token: string, childId: string, yearMonth?: string) {
  const effectiveYearMonth = yearMonth ?? currentYearMonth();
  if (isLocalToken(token)) return local(() => localBackend.getMonthlyReport(childId, effectiveYearMonth));
  return requestJson<MonthlyReport>(`/children/${childId}/reports/monthly?yearMonth=${effectiveYearMonth}`, {
    token
  });
}

export function getCumulativeReport(token: string, childId: string) {
  if (isLocalToken(token)) return local(() => localBackend.getCumulativeReport(childId));
  return requestJson<CumulativeReport>(`/children/${childId}/reports/cumulative`, { token });
}

export function getCategoryReport(token: string, childId: string, yearMonth?: string) {
  if (isLocalToken(token)) return local(() => localBackend.getCategoryReport(childId, yearMonth));
  const query = yearMonth ? `?yearMonth=${yearMonth}` : "";
  return requestJson<CategoryReport>(`/children/${childId}/reports/category${query}`, { token });
}

export function getYearlyReport(token: string, childId: string, year: number) {
  if (isLocalToken(token)) return local(() => localBackend.getYearlyReport(childId, year));
  return requestJson<YearlyReport>(`/children/${childId}/reports/yearly?year=${year}`, { token });
}

export function listItems(
  token: string,
  childId: string,
  tab: "now" | "soon" | "prepared" | "not_needed" = "now"
) {
  if (isLocalToken(token)) return local(() => localBackend.listItems(childId, tab));
  return requestJson<{ items: ItemSummary[] }>(`/children/${childId}/items?tab=${tab}`, { token });
}

export type ReportV2Period = "month" | "quarter" | "year";

function reportV2Query(childId: string, period: ReportV2Period, anchor: string, extra = "") {
  return `childId=${encodeURIComponent(childId)}&period=${period}&anchor=${encodeURIComponent(anchor)}${extra}`;
}

export function getReportV2Summary(token: string, childId: string, period: ReportV2Period, anchor: string) {
  if (isLocalToken(token)) return local(() => localBackend.getReportV2Summary(childId, period, anchor));
  return requestJson<ReportSummaryContract>(`/reports/summary?${reportV2Query(childId, period, anchor)}`, { token });
}

export function getReportV2Categories(token: string, childId: string, period: ReportV2Period, anchor: string) {
  if (isLocalToken(token)) return local(() => localBackend.getReportV2Categories(childId, period, anchor));
  return requestJson<ReportCategoriesContract>(`/reports/categories?${reportV2Query(childId, period, anchor)}`, { token });
}

export function getReportV2Trend(token: string, childId: string, period: ReportV2Period, anchor: string, unit: "day" | "month" = "month") {
  if (isLocalToken(token)) return local(() => localBackend.getReportV2Trend(childId, period, anchor, unit));
  return requestJson<ReportTrendContract>(`/reports/trend?${reportV2Query(childId, period, anchor, `&unit=${unit}`)}`, { token });
}

export function getReportV2Members(token: string, childId: string, period: ReportV2Period, anchor: string) {
  if (isLocalToken(token)) return local(() => localBackend.getReportV2Members(childId, period, anchor));
  return requestJson<ReportMembersContract>(`/reports/members?${reportV2Query(childId, period, anchor)}`, { token });
}

export function getReportV2Preparation(token: string, childId: string, period: ReportV2Period, anchor: string) {
  if (isLocalToken(token)) return local(() => localBackend.getReportV2Preparation(childId, period, anchor));
  return requestJson<ReportPreparationContract>(`/reports/preparation?${reportV2Query(childId, period, anchor)}`, { token });
}

export function getReportV2Recurring(token: string, childId: string, period: ReportV2Period, anchor: string) {
  if (isLocalToken(token)) return local(() => localBackend.getReportV2Recurring(childId, period, anchor));
  return requestJson<ReportRecurringContract>(`/reports/recurring?${reportV2Query(childId, period, anchor)}`, { token });
}

export function getReportV3(token: string, childId: string, period: ReportV2Period, anchor: string) {
  if (isLocalToken(token)) return local(() => localBackend.getReportV3(childId, period, anchor));
  return requestJson<ReportV3Contract>(`/reports/v3?${reportV2Query(childId, period, anchor)}`, { token });
}

export function getReportV3Sources(
  token: string,
  childId: string,
  period: ReportV2Period,
  anchor: string,
  kind: ReportSourceKind,
  cursor?: string,
  limit = 30
) {
  if (isLocalToken(token)) {
    return local(() => localBackend.getReportV3Sources(childId, period, anchor, kind, cursor, limit));
  }
  const extra = `&kind=${encodeURIComponent(kind)}&limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
  return requestJson<ReportSourcesContract>(
    `/reports/v3/sources?${reportV2Query(childId, period, anchor, extra)}`,
    { token }
  );
}

export type CatalogListQuery = {
  childId?: string;
  motherProfileId?: string;
  lifecycleAxis?: "mother" | "child";
  lifecycleCode?: string;
  domainCode?: string;
  contextCode?: string;
  necessity?: CatalogItemSummary["necessity"];
  safetyTier?: CatalogItemSummary["safetyTier"];
  secondhandPolicy?: "allowed" | "inspect" | "avoid" | "prohibited";
  rentalPolicy?: "suitable" | "conditional" | "unsuitable";
  state?: CatalogPlanState;
  query?: string;
  cursor?: string;
  limit?: number;
};

export type CatalogMotherProfile = {
  id: string;
  householdId: string;
  childId: string | null;
  dueDate: string | null;
  active: boolean;
};

export function listCatalogDomains(token: string) {
  if (isLocalToken(token)) return local(() => localBackend.listCatalogDomains());
  return requestJson<{ domains: Array<CatalogNodeSummary & { children: Array<CatalogNodeSummary & { children: CatalogNodeSummary[] }> }> }>("/catalog/domains", { token });
}

export function getCatalogContexts(token: string) {
  if (isLocalToken(token)) return local(() => localBackend.getCatalogContexts());
  return requestJson<{ motherProfiles: CatalogMotherProfile[] }>("/catalog/contexts", { token });
}

export function listCatalogItems(token: string, query: CatalogListQuery = {}) {
  if (isLocalToken(token)) return local(() => localBackend.listCatalogItems(query));
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  const suffix = params.toString();
  return requestJson<{ items: CatalogItemSummary[]; nextCursor: string | null; total: number; search?: { normalizedQueryLength: number; matchedCount: number; rawQueryStored: false } }>(`/catalog/items${suffix ? `?${suffix}` : ""}`, { token });
}

export function getCatalogTimeline(token: string, childId?: string, motherProfileId?: string) {
  if (isLocalToken(token)) return local(() => localBackend.getCatalogTimeline(childId, motherProfileId));
  const params = new URLSearchParams();
  if (childId) params.set("childId", childId);
  if (motherProfileId) params.set("motherProfileId", motherProfileId);
  return requestJson<CatalogTimelineResponse>(`/catalog/timeline?${params.toString()}`, { token });
}

export function getPreparationContext(token: string, childId?: string, motherProfileId?: string) {
  if (isLocalToken(token)) return local(() => localBackend.getPreparationContext(childId, motherProfileId));
  const params = new URLSearchParams();
  if (childId) params.set("childId", childId);
  if (motherProfileId) params.set("motherProfileId", motherProfileId);
  return requestJson<PreparationContextResponse>(`/catalog/preparation-context?${params.toString()}`, { token });
}

export function updatePreparationContext(token: string, childId: string | undefined, motherProfileId: string | undefined, input: { contextCodes: CatalogScenarioCode[]; expectedVersion?: number }) {
  if (isLocalToken(token)) return local(() => localBackend.updatePreparationContext(childId, motherProfileId, input));
  const params = new URLSearchParams();
  if (childId) params.set("childId", childId);
  if (motherProfileId) params.set("motherProfileId", motherProfileId);
  return requestJson<PreparationContextResponse>(`/catalog/preparation-context?${params.toString()}`, { method: "PUT", token, body: input });
}

export function getCatalogSafetyAlerts(token: string, childId?: string, motherProfileId?: string) {
  if (isLocalToken(token)) return local(() => localBackend.getCatalogSafetyAlerts(childId, motherProfileId));
  const params = new URLSearchParams();
  if (childId) params.set("childId", childId);
  if (motherProfileId) params.set("motherProfileId", motherProfileId);
  return requestJson<{ alerts: CatalogSafetyAlert[] }>(`/catalog/safety-alerts?${params.toString()}`, { token });
}

export function acknowledgeCatalogSafetyAlert(token: string, alertId: string, expectedVersion: number) {
  if (isLocalToken(token)) return local(() => localBackend.acknowledgeCatalogSafetyAlert(alertId, expectedVersion));
  return requestJson<CatalogSafetyAlert>(`/catalog/safety-alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: "POST", token, body: { expectedVersion } });
}

export function listCatalogBundles(token: string, childId: string) {
  if (isLocalToken(token)) return local(() => localBackend.listCatalogBundles(childId));
  return requestJson<{ bundles: CatalogBundle[] }>(`/catalog/bundles?childId=${encodeURIComponent(childId)}`, { token });
}

export function applyCatalogBundle(token: string, childId: string, bundleId: string, input: { dryRun: boolean; items: CatalogBundleApplyItem[]; acknowledgeWarningItemIds?: string[] }) {
  if (isLocalToken(token)) return local(() => localBackend.applyCatalogBundle(childId, bundleId, input));
  return requestJson<CatalogBundleApplyResponse>(`/catalog/bundles/${encodeURIComponent(bundleId)}/apply?childId=${encodeURIComponent(childId)}`, { method: "POST", token, body: input });
}

export function searchCatalogItems(token: string, query: CatalogListQuery & { query: string }) {
  if (isLocalToken(token)) return local(() => localBackend.listCatalogItems(query));
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  return requestJson<{ items: CatalogItemSummary[]; nextCursor: string | null; total: number; search: { normalizedQueryLength: number; matchedCount: number; rawQueryStored: false } }>(`/catalog/search?${params.toString()}`, { token });
}

export function reportMissingCatalogItem(token: string, requestedName: string, detail?: string) {
  if (isLocalToken(token)) return local(() => localBackend.reportMissingCatalogItem(requestedName, detail));
  return requestJson<{ report: { id: string; reasonCode: "missing_item"; state: "open" }; idempotent: boolean }>("/catalog/missing-item-reports", { method: "POST", token, body: { requestedName, ...(detail ? { detail } : {}) } });
}

export function getCatalogItem(token: string, itemId: string, childId?: string, motherProfileId?: string) {
  if (isLocalToken(token)) return local(() => localBackend.getCatalogItem(itemId, childId, motherProfileId));
  const params = new URLSearchParams();
  if (childId) params.set("childId", childId);
  if (motherProfileId) params.set("motherProfileId", motherProfileId);
  const suffix = params.size ? `?${params.toString()}` : "";
  return requestJson<CatalogItemDetail>(`/catalog/items/${itemId}${suffix}`, { token });
}

export function getCatalogItemComparison(token: string, itemId: string) {
  if (isLocalToken(token)) return local(() => localBackend.getCatalogItemComparison(itemId));
  return requestJson<CatalogComparison>(`/catalog/items/${encodeURIComponent(itemId)}/comparison`, { token });
}

export function putMotherItemPlan(
  token: string,
  motherProfileId: string,
  itemId: string,
  body: Parameters<typeof putItemPlan>[3]
) {
  if (isLocalToken(token)) return local(() => localBackend.putMotherCatalogItemPlan(motherProfileId, itemId, body));
  return requestJson<CatalogItemPlan>(`/mother-profiles/${motherProfileId}/item-plans/${itemId}`, { method: "PUT", token, body });
}

export function listItemPlans(token: string, childId: string) {
  if (isLocalToken(token)) return local(() => localBackend.listCatalogItemPlans(childId));
  return requestJson<{ plans: CatalogItemPlan[] }>(`/children/${childId}/item-plans`, { token });
}

export function putItemPlan(
  token: string,
  childId: string,
  itemId: string,
  body: {
    state: CatalogPlanState;
    desiredQuantity?: number;
    ownedQuantity?: number;
    quantityNeeded?: number;
    quantityOwned?: number;
    dueDate?: string;
    acquisitionMode?: CatalogItemPlan["acquisitionMode"];
    acquisitionType?: CatalogItemPlan["acquisitionMode"];
    assignedUserId?: string;
    budgetKrw?: number;
    note?: string;
    notes?: string;
    linkedExpenseId?: string;
    size?: string;
    variant?: string;
    purchasedAt?: string;
    openedAt?: string;
    expiresAt?: string;
    replacementDueAt?: string;
    usageEndedAt?: string;
    storageLocation?: string;
    recurringIntervalDays?: number;
    nextPurchaseDueAt?: string;
    expectedVersion?: number;
  }
) {
  if (isLocalToken(token)) return local(() => localBackend.putCatalogItemPlan(childId, itemId, body));
  return requestJson<CatalogItemPlan>(`/children/${childId}/item-plans/${itemId}`, { method: "PUT", token, body });
}

export function getItemPlanActivity(token: string, childId: string, itemId: string) {
  if (isLocalToken(token)) return local(() => localBackend.getCatalogItemPlanActivity(childId, itemId));
  return requestJson<CatalogItemPlanActivity>(`/children/${childId}/item-plans/${itemId}/activity`, { token });
}

export function newClientMutationId() {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function addItemPlanComment(token: string, childId: string, itemId: string, body: string, clientMutationId = newClientMutationId()) {
  if (isLocalToken(token)) return local(() => localBackend.addCatalogItemPlanComment(childId, itemId, body, clientMutationId));
  return requestJson<CatalogItemPlanActivity["comments"][number]>(`/children/${childId}/item-plans/${itemId}/comments`, {
    method: "POST",
    token,
    headers: { "Idempotency-Key": clientMutationId },
    body: { body, clientMutationId }
  });
}

export function getItemDetail(token: string, childId: string, itemTemplateId: string) {
  if (isLocalToken(token)) return local(() => localBackend.getItemDetail(childId, itemTemplateId));
  return requestJson<ItemDetail>(`/children/${childId}/items/${itemTemplateId}`, { token });
}

export function updateItemStatus(
  token: string,
  childId: string,
  itemTemplateId: string,
  status: ItemStatus,
  expenseId?: string
) {
  if (isLocalToken(token)) return local(() => localBackend.updateItemStatus(childId, itemTemplateId, status, expenseId));
  return requestJson<ItemSummary>(`/children/${childId}/items/${itemTemplateId}/status`, {
    method: "PATCH",
    token,
    body: { status, expenseId }
  });
}

export function clickProductLink(
  token: string,
  productLinkId: string,
  childId: string,
  referrerScreenId = "ITEM-003"
) {
  if (isLocalToken(token)) return local(() => localBackend.clickProductLink(productLinkId, childId, referrerScreenId));
  return requestJson<AffiliateClickResponse>(`/product-links/${productLinkId}/click`, {
    method: "POST",
    token,
    body: { childId, referrerScreenId }
  });
}

export function listHouseholdMembers(token: string, householdId: string) {
  if (isLocalToken(token)) return local(() => localBackend.listHouseholdMembers(householdId));
  return requestJson<{ members: HouseholdMember[] }>(`/households/${householdId}/members`, { token });
}

export function removeHouseholdMember(token: string, householdId: string, memberId: string) {
  if (isLocalToken(token)) return local(() => localBackend.removeHouseholdMember(householdId, memberId));
  return requestJson<{ success: boolean }>(`/households/${householdId}/members/${memberId}`, {
    method: "DELETE",
    token
  });
}

export function createInvite(
  token: string,
  householdId: string,
  role: InviteRole,
  channel: InviteChannel = "link"
) {
  if (isLocalToken(token)) return local(() => localBackend.createInvite(householdId, role, channel));
  return requestJson<InviteResponse>(`/households/${householdId}/invites`, {
    method: "POST",
    token,
    body: { role, channel }
  });
}

export function getInvite(token: string) {
  if (internalFixtureRuntimeEnabled) {
    const localInvite = localBackend.findLocalInvite(token);
    if (localInvite) return local(() => localBackend.getInvitePreview(token));
  }
  return requestJson<InvitePreview>(`/invites/${token}`);
}

export function transferHouseholdOwnership(token: string, householdId: string, targetUserId: string) {
  if (isLocalToken(token)) return local(() => localBackend.transferHouseholdOwnership(householdId, targetUserId));
  return requestJson<{ success: boolean; ownerUserId: string }>(`/households/${householdId}/transfer-ownership`, {
    method: "POST",
    token,
    body: { targetUserId }
  });
}

export function leaveHousehold(token: string, householdId: string) {
  if (isLocalToken(token)) return local(() => localBackend.leaveHousehold(householdId));
  return requestJson<{ success: boolean; flowId: string }>(`/households/${householdId}/leave`, {
    method: "POST",
    token
  });
}

export function acceptInvite(accessToken: string, token: string) {
  if (isLocalToken(accessToken)) return local(() => localBackend.acceptInvite(token));
  return requestJson<AcceptInviteResponse>(`/invites/${token}/accept`, {
    method: "POST",
    token: accessToken
  });
}

/** Minimal shape of an expo-document-picker asset needed to upload the picked file's bytes. */
export type PickedImportFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

export function createExcelImport(token: string, childId: string, file: PickedImportFile) {
  if (isLocalToken(token)) return local(() => localBackend.createExcelImport(childId, file.name));

  const formData = new FormData();
  // React Native's FormData accepts this {uri, name, type} shape for file parts; the DOM
  // FormData/File types don't model it, hence the cast.
  formData.append(
    "file",
    { uri: file.uri, name: file.name, type: file.mimeType || "application/octet-stream" } as unknown as Blob
  );
  formData.append("fileName", file.name);

  return requestMultipartJson<ImportJob>(`/children/${childId}/imports/excel`, { token, formData });
}

export function getImportJob(token: string, importJobId: string) {
  if (isLocalToken(token)) return local(() => localBackend.getImportJob(importJobId));
  return requestJson<ImportJob>(`/imports/${importJobId}`, { token });
}

export function listImportRows(token: string, importJobId: string) {
  if (isLocalToken(token)) return local(() => localBackend.listImportRows(importJobId));
  return requestJson<{ rows: ImportRow[] }>(`/imports/${importJobId}/rows`, { token });
}

export function updateImportRow(
  token: string,
  importJobId: string,
  rowId: string,
  body: Partial<Pick<ImportRow, "selected" | "categoryId" | "parsedItemName" | "parsedAmountKrw">>
) {
  if (isLocalToken(token)) return local(() => localBackend.updateImportRow(importJobId, rowId, body));
  return requestJson<ImportRow>(`/imports/${importJobId}/rows/${rowId}`, {
    method: "PATCH",
    token,
    body
  });
}

export function confirmImport(token: string, importJobId: string, selectedRowIds: string[]) {
  if (isLocalToken(token)) return local(() => localBackend.confirmImport(importJobId, selectedRowIds));
  return requestJson<ConfirmImportResponse>(`/imports/${importJobId}/confirm`, {
    method: "POST",
    token,
    body: { selectedRowIds }
  });
}

export function getPrivacySettings(token: string) {
  if (isLocalToken(token)) return local(() => localBackend.getPrivacySettings());
  return requestJson<PrivacySettings>("/settings/privacy", { token });
}

export function previewChildProfileDeletion(token: string, childId: string) {
  if (isLocalToken(token)) return local(() => localBackend.previewChildProfileDeletion(childId));
  return requestJson<SettingsPreview>(`/settings/children/${childId}/delete-preview`, {
    method: "POST",
    token
  });
}

export function confirmChildProfileDeletion(token: string, childId: string, confirmationText: string) {
  if (isLocalToken(token)) return local(() => localBackend.confirmChildProfileDeletion(childId, confirmationText));
  return requestJson<SettingsConfirmResponse>(`/settings/children/${childId}/delete-confirm`, {
    method: "POST",
    token,
    body: { confirmationText }
  });
}

export function previewHouseholdLeave(token: string, householdId: string) {
  if (isLocalToken(token)) return local(() => localBackend.previewHouseholdLeave(householdId));
  return requestJson<SettingsPreview>(`/settings/households/${householdId}/leave-preview`, {
    method: "POST",
    token
  });
}

export function confirmHouseholdLeave(token: string, householdId: string, confirmationText: string) {
  if (isLocalToken(token)) return local(() => localBackend.confirmHouseholdLeave(householdId, confirmationText));
  return requestJson<SettingsConfirmResponse>(`/settings/households/${householdId}/leave-confirm`, {
    method: "POST",
    token,
    body: { confirmationText }
  });
}

export function previewAccountDeletion(token: string) {
  if (isLocalToken(token)) return local(() => localBackend.previewAccountDeletion());
  return requestJson<SettingsPreview>("/settings/account/delete-preview", {
    method: "POST",
    token
  });
}

export function confirmAccountDeletion(token: string, confirmationText: string) {
  if (isLocalToken(token)) return local(() => localBackend.confirmAccountDeletion(confirmationText));
  return requestJson<SettingsConfirmResponse>("/settings/account/delete-confirm", {
    method: "POST",
    token,
    body: { confirmationText }
  });
}

export function cancelAccountDeletion(token: string, requestId: string) {
  if (isLocalToken(token)) return local(() => localBackend.cancelAccountDeletion(requestId));
  return requestJson<AccountDeletionRequest>(`/privacy/account-deletion/${requestId}/cancel`, { method: "POST", token });
}

export function getCurrentAccountDeletion(token: string) {
  if (isLocalToken(token)) return local(() => ({ deletion: localBackend.getCurrentAccountDeletion() }));
  return requestJson<unknown>("/privacy/account-deletion/current", { token })
    .then((response) => currentAccountDeletionResponseSchema.parse(response));
}

export function getPreparationCalendar(token: string, householdId: string, month: string, childId?: string) {
  if (isLocalToken(token)) return local<PreparationCalendarContract>(() => ({ month, timezone: "Asia/Seoul", events: [] }));
  const query = new URLSearchParams({ month });
  if (childId) query.set("childId", childId);
  return requestJson<PreparationCalendarContract>(`/households/${householdId}/preparation-calendar?${query}`, { token });
}

export function listCustomBundles(token: string, householdId: string) {
  if (isLocalToken(token)) return local<{ bundles: CustomBundleContract[] }>(() => ({ bundles: [] }));
  return requestJson<{ bundles: CustomBundleContract[] }>(`/households/${householdId}/custom-bundles`, { token });
}

export function createCustomBundle(token: string, householdId: string, body: { title: string; scopeType: "child" | "household"; items: Array<{ itemDefinitionId: string; defaultQuantity?: number }> }) {
  return requestJson<CustomBundleContract>(`/households/${householdId}/custom-bundles`, { method: "POST", token, body });
}

export function applyCustomBundle(token: string, householdId: string, bundleId: string, body: { childId: string; expectedVersion: number; idempotencyKey: string }) {
  return requestJson<{ createdCount: number; existingCount: number }>(`/households/${householdId}/custom-bundles/${bundleId}/apply`, { method: "POST", token, body });
}

export function getWeeklyBriefing(token: string, householdId: string, referenceDate?: string) {
  if (isLocalToken(token)) return local<WeeklyBriefingContract>(() => ({ id: "00000000-0000-4000-8000-000000000001", householdId, weekStart: getSeoulToday(), generatedAt: new Date().toISOString(), sourceHash: "0".repeat(64), sections: { safety: [], completed: 0, dueNextWeek: 0, unassigned: 0, financial: null } }));
  return requestJson<WeeklyBriefingContract>(`/households/${householdId}/weekly-briefings/current${referenceDate ? `?referenceDate=${referenceDate}` : ""}`, { token });
}

export function createReceiptDraft(
  token: string,
  body: { childId: string; contentHash: string; fileName: string; mimeType: string; fileSizeBytes: number },
  signal?: AbortSignal
) {
  return requestJson<{ duplicate: boolean; providerMode?: "LOCAL_FIXTURE" | "EXTERNAL_BLOCKED"; draft: ReceiptDraftContract }>("/receipt-drafts", { method: "POST", token, body, signal });
}

export function confirmReceiptDraft(
  token: string,
  draftId: string,
  body: { confirmed: true; idempotencyKey: string; expectedVersion: number; categoryId: string; amountKrw: number; spentOn: string; itemName: string; merchant?: string },
  signal?: AbortSignal
) {
  return requestJson<{ expenseId: string; duplicate: boolean }>(`/receipt-drafts/${draftId}/confirm`, { method: "POST", token, body, signal });
}

export type NotificationPreferences = {
  safetyEnabled: true;
  familyEnabled: boolean;
  marketingEnabled: boolean;
  marketingOptInAt: string | null;
  replacementEnabled: boolean;
  recurringEnabled: boolean;
  budgetEnabled: boolean;
  weeklyBriefingEnabled: boolean;
  externalChannelEnabled: boolean;
  externalChannelAvailable: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: "Asia/Seoul";
  weeklyFrequency: "weekly" | "biweekly" | "off";
  updatedAt?: string;
  version: number;
};

export function getNotificationPreferences(token: string) {
  return requestJson<NotificationPreferences>("/notification-preferences", { token });
}

export function updateNotificationPreferences(token: string, body: Partial<Omit<NotificationPreferences, "safetyEnabled" | "externalChannelAvailable" | "timezone" | "version">> & { expectedVersion: number }) {
  return requestJson<NotificationPreferences>("/notification-preferences", { method: "PUT", token, body });
}

export type ExpensePlanLinkSuggestion = {
  planId: string;
  itemDefinitionId: string;
  itemName: string;
  reasonCodes: string[];
  explanation: string;
};

export function getExpensePlanLinkSuggestions(token: string, expenseId: string) {
  if (isLocalToken(token)) return local<{ expenseId: string; suggestions: ExpensePlanLinkSuggestion[] }>(() => ({ expenseId, suggestions: [] }));
  return requestJson<{ expenseId: string; suggestions: ExpensePlanLinkSuggestion[] }>(`/expenses/${expenseId}/plan-link-suggestions`, { token });
}

export function linkExpensePlan(token: string, expenseId: string, body: { planId: string; expectedVersion: number; reasonCode: string }) {
  return requestJson<{ expenseId: string; planId: string; linked: boolean; version: number; duplicate: boolean }>(`/expenses/${expenseId}/plan-link`, { method: "PUT", token, body });
}

export type RecurringPredictionResponse = {
  planId: string;
  confirmedDueDate: string | null;
  prediction: { predictedDate: string; intervalDays: number; confidence: "low" | "medium" | "high" } | null;
  predictionEnabled: boolean;
  minimumPurchaseCount: number;
  historyCount: number;
  unavailableReason: string | null;
};

export function getRecurringPrediction(token: string, planId: string) {
  return requestJson<RecurringPredictionResponse>(`/item-plans/${planId}/recurring-prediction`, { token });
}

export type BudgetVarianceExplanation = {
  varianceKrw: number;
  direction: "over" | "under" | "matched";
  summary: string;
  topDrivers: Array<{ name: string; actualKrw: number }>;
  adjustments: { giftKrw: number; refundKrw: number; supportKrw: number };
  basis: "report_v3_ledger_and_plan";
};

export function getBudgetVarianceExplanation(token: string, childId: string, period: "month" | "quarter" | "year", anchor: string) {
  if (isLocalToken(token)) return local<{ explanation: BudgetVarianceExplanation | null; source: "report_v3" }>(() => ({ explanation: null, source: "report_v3" }));
  return requestJson<{ explanation: BudgetVarianceExplanation | null; source: "report_v3" }>(`/reports/variance-explanation?childId=${childId}&period=${period}&anchor=${anchor}`, { token });
}
