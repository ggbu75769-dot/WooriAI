import { getSeoulMonthRange, getSeoulToday, type ChildStageCode } from "@wooriai/domain";
import * as localBackend from "./local-backend";
import type { StageBandLabel } from "../items/stage-bands";
import * as localDevices from "../notifications/local-devices";
import { LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID } from "./local-fixtures";
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
export const LOCAL_SESSION_TOKEN = "wooriai-local-session";

export { LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID };

function isLocalToken(token?: string | null): boolean {
  return token === LOCAL_SESSION_TOKEN;
}

function local<T>(factory: () => T): Promise<T> {
  return Promise.resolve().then(factory);
}

/**
 * Bug fix (round5a post-Sprint2 hotfix): a leftover/real (non-`LOCAL_SESSION_TOKEN`) session on
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

/**
 * FIX-MOB-DX (COV-T3 관찰): thrown by fetchWithTimeout when ITS OWN timeout bound fires. Before
 * this, the raw "AbortError" DOMException from the aborted fetch propagated unwrapped, so callers
 * could only recognize the 10s timeout by string/name sniffing a platform-dependent error shape.
 * `cause` carries the original abort rejection (typically a DOMException named "AbortError") for
 * logging/debugging. Genuine network failures (DNS, connection refused, offline TypeError) are
 * NOT wrapped -- they propagate exactly as before.
 */
export class ApiTimeoutError extends Error {
  constructor(cause: unknown) {
    super("요청 시간이 초과되었어요(10초)", { cause });
    this.name = "ApiTimeoutError";
  }
}

/** Wraps `fetch` with an AbortController-based timeout so a hung/unreachable connection always
 * settles (as a rejection) within `timeoutMs` instead of relying on the OS/network stack's own
 * (sometimes much longer, or absent) timeout behavior. A rejection caused by this function's own
 * timeout abort is translated into the typed ApiTimeoutError above (callers never pass their own
 * `signal` -- the spread below always overrides it, so the only abort source here is the timer);
 * every other rejection is rethrown untouched. */
function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return fetch(input, { ...init, signal: controller.signal })
    .catch((error: unknown) => {
      // Guarded on BOTH flags: `timedOut` (our timer actually fired -- not some other abort or a
      // network error racing the timer) and the abort shape (`name === "AbortError"`, the one
      // observable mark real fetch puts on an abort rejection across platforms) so a genuine
      // network error that lands in the same tick as the timer is never mislabeled as a timeout.
      if (timedOut && (error as { name?: unknown } | null)?.name === "AbortError") {
        throw new ApiTimeoutError(error);
      }
      throw error;
    })
    .finally(() => clearTimeout(timer));
}

type RequestOptions = {
  token?: string | null;
  body?: unknown;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
};

export type Expense = {
  id: string;
  childId: string;
  categoryId: string;
  amountKrw: number;
  spentOn: string;
  itemName: string;
  merchant?: string | null;
  memo?: string | null;
  expenseType: "expense" | "gift" | "refund";
  source: "manual" | "excel_import" | "purchase_followup" | "admin";
  // MOB-103 (round5a-sprint1-plan.md §2.1): optimistic-concurrency version, 1 on create, +1 on
  // every update/soft-delete. Used by MOB-102's offline outbox as `expectedVersion` on
  // update/delete -- see createExpenseWithIdempotency/updateExpenseWithVersion/
  // deleteExpenseWithVersion below.
  version: number;
};

export type Budget = {
  childId: string;
  yearMonth: string;
  amountKrw: number;
  usedAmountKrw: number;
  remainingAmountKrw: number;
};

export type HomeSummary = {
  child: { id: string; nickname: string; currentStage: string; stageLabel: string };
  totalExpenseKrw: number;
  monthly: Budget;
  recommendedItems: Array<{ id: string; name: string; status: string }>;
  recentExpenses: Expense[];
};

/**
 * CAT-101/UX-5B-EXP: one entry of `GET /categories`. Hand-declared mirror of
 * `categoryListItemSchema` in packages/contracts/src/schemas.ts -- this file declares all of its
 * response types locally (the mobile app does not depend on @wooriai/contracts), so this type
 * follows the same convention as Expense/Budget/etc. above.
 */
export type CategoryListItem = {
  id: string;
  code: string;
  name: string;
  iconName?: string | null;
  displayOrder: number;
  isSystem: boolean;
  active: boolean;
};

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

/**
 * FAM-121B: a still-usable invite as returned by GET /households/:id/invites.
 *
 * There is deliberately no token/link field: the server stores only a sha256 hash
 * of the invite token, so the original link cannot be shown again — `canReshareLink`
 * is the server saying so explicitly, and the UI's recovery path is 취소 후 재생성.
 */
export type PendingInvite = {
  id: string;
  householdId: string;
  role: InviteRole;
  channel: InviteChannel;
  status: "pending";
  expiresAt: string;
  createdAt: string;
  invitedByUserId: string;
  canReshareLink: boolean;
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
};

export type OnboardingNextStep = "consents" | "child-profile" | "prepared-items" | "budget" | "home";

export type OnboardingChildSummary = {
  id: string;
  nickname: string;
  stageMode: string;
  currentStage: string;
  stageLabel: string;
};

/**
 * MOB-101 (round5a-sprint1-plan.md §4): server-side source of truth for where a session left
 * off in onboarding, so app restart / re-login / token refresh restores the exact right step
 * instead of always restarting at ONB-001. `canRestart` is false once a child has been
 * created for the household -- the "처음부터 시작" option on the resume screen (ONB-006) is
 * only offered while nothing exists yet to duplicate or orphan.
 */
export type OnboardingProgress = {
  completed: boolean;
  nextStep: OnboardingNextStep;
  canRestart: boolean;
  summary: {
    consentsAccepted: boolean;
    child: OnboardingChildSummary | null;
    preparedItemsCount: number | null;
    budget: { yearMonth: string; amountKrw: number } | null;
  };
};

/**
 * R19-C(F1): optional `childId` scopes the summary/완료 판정 to one child. Omitted (the default),
 * the server keeps its original behavior and answers for the household's first child, so this
 * stays wire-compatible with the pre-R19 contract. The demo/local backend holds a single child,
 * so it ignores the argument.
 */
export function getOnboardingProgress(token: string, childId?: string) {
  if (isLocalToken(token)) return local(() => localBackend.onboardingStatus());
  const query = childId ? `?childId=${encodeURIComponent(childId)}` : "";
  return requestJson<OnboardingProgress>(`/onboarding/status${query}`, { token });
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

/**
 * Single-flight refresh: concurrent 401s that land while a refresh is already in progress all
 * await the same in-flight promise instead of each redeeming the refresh token themselves. This
 * matters because the API's refresh tokens are single-use (rotated/revoked on redemption) -- a
 * second concurrent redemption would fail with 401 even though the first one succeeded.
 */
let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

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

function performSingleFlightRefresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(refreshToken)
      .then((refreshed) => {
        // Persisting the rotated tokens *inside* the shared single-flight promise
        // chain -- before it resolves -- guarantees the store is already updated
        // by the time any awaiter (or a subsequent, independent refresh cycle
        // that starts once `refreshPromise` is cleared below) can run. Without
        // this, each awaiter used to call setTokens itself after waking up, which
        // left a window where a fresh 401 landing right as this promise settles
        // could read the store's still-old (already single-use, now invalid)
        // refreshToken and kick off a doomed refresh with it.
        useSessionStore.getState().setTokens(refreshed.accessToken, refreshed.refreshToken);
        return refreshed;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function requestJson<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
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
  });

  const canAttemptRefresh = response.status === 401 && !isRetry && options.token && !isLocalToken(options.token);
  if (canAttemptRefresh) {
    const session = useSessionStore.getState();
    const currentRefreshToken = session.refreshToken;
    if (currentRefreshToken) {
      try {
        const refreshed = await performSingleFlightRefresh(currentRefreshToken);
        return requestJson<T>(path, { ...options, token: refreshed.accessToken }, true);
      } catch (refreshError) {
        if (refreshError instanceof RefreshHttpError && refreshError.status === 401) {
          useSessionStore.getState().clearSession();
        }
        // Falls through to the original 401 response below, whether the refresh failed due to
        // an expired/invalid refresh token or a network error while refreshing.
      }
    }
  }

  const data = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data;
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
  isRetry = false
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

  const canAttemptRefresh = response.status === 401 && !isRetry && options.token && !isLocalToken(options.token);
  if (canAttemptRefresh) {
    const session = useSessionStore.getState();
    const currentRefreshToken = session.refreshToken;
    if (currentRefreshToken) {
      try {
        const refreshed = await performSingleFlightRefresh(currentRefreshToken);
        return requestMultipartJson<T>(path, { ...options, token: refreshed.accessToken }, true);
      } catch (refreshError) {
        if (refreshError instanceof RefreshHttpError && refreshError.status === 401) {
          useSessionStore.getState().clearSession();
        }
      }
    }
  }

  const data = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data;
}

export async function oauthLogin(provider: "kakao" | "apple" | "google") {
  return requestJson<{
    user: {
      id: string;
      households?: Array<{ id: string; name: string; role: string }>;
    };
    tokens: { accessToken: string; refreshToken: string; expiresIn: number };
    onboardingRequired: boolean;
  }>("/auth/oauth-login", {
    method: "POST",
    body: { provider, providerToken: `dev-${provider}` }
  });
}

export function upsertConsents(token: string) {
  if (isLocalToken(token)) return local(() => localBackend.upsertConsents());
  return requestJson<{ success: boolean }>("/consents", {
    method: "PUT",
    token,
    body: {
      consents: [
        { type: "terms", version: "2026-07-06", accepted: true },
        { type: "privacy", version: "2026-07-06", accepted: true }
      ]
    }
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
    stageMode: string;
    dueDate?: string;
    birthDate?: string;
    manualStage?: string | null;
  },
  idempotencyKey?: string
) {
  if (isLocalToken(token)) return local(() => localBackend.createChild({ nickname: body.nickname }));
  return requestJson<{ id: string }>("/children", {
    method: "POST",
    token,
    body,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined
  });
}

/**
 * MOB-118: one child of `GET /children` -- hand-declared mirror of
 * toChildDto (apps/api/src/onboarding/store-shared.ts),
 * following the same local-declaration convention as Expense/Budget/CategoryListItem above.
 * `currentStage`/`stageLabel` are server-computed from the dates, which is why editing a
 * birth/due date must invalidate every child-scoped query (stage drives 준비템/추천/리포트).
 */
export type Child = {
  id: string;
  householdId: string;
  nickname: string;
  stageMode: "pregnant" | "born" | "manual";
  dueDate: string | null;
  birthDate: string | null;
  manualStage: ChildStageCode | null;
  currentStage: string;
  stageLabel: string;
};

export function listChildren(token: string) {
  if (isLocalToken(token)) return local(() => localBackend.listChildren());
  return requestJson<{ children: Child[] }>("/children", { token });
}

/**
 * MOB-118: PATCH /children/:childId body -- mirror of the server's UpdateChildDto
 * (apps/api/src/onboarding/dto/child.dto.ts). `stageMode` is intentionally absent: the DTO
 * whitelist does not accept it (forbidNonWhitelisted rejects extras), so a child's stage mode
 * is fixed at creation and edits are validated against it server-side (normalizeChildInput).
 */
export type UpdateChildBody = {
  nickname?: string;
  dueDate?: string;
  birthDate?: string;
  manualStage?: ChildStageCode;
};

export function updateChild(token: string, childId: string, body: UpdateChildBody) {
  if (isLocalToken(token)) return local(() => localBackend.updateChild(childId, body));
  return requestJson<Child>(`/children/${childId}`, { method: "PATCH", token, body });
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

/**
 * CAT-101/UX-5B-EXP: active seed categories (displayOrder ascending) for the expense edit
 * screen's category chip row -- see apps/api/src/finance/categories.controller.ts. A local test
 * session serves the demo fixture categories instead, whose ids match what the local backend's
 * own expenses use (see localBackend.listCategories).
 */
export function listCategories(token: string) {
  if (isLocalToken(token)) return local(() => localBackend.listCategories());
  return requestJson<{ categories: CategoryListItem[] }>("/categories", { token });
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
    memo?: string;
    linkedItemTemplateId?: string;
    expenseType?: "expense" | "gift";
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

export function getExpense(token: string, expenseId: string) {
  if (isLocalToken(token)) return local(() => localBackend.getExpense(expenseId));
  return requestJson<Expense>(`/expenses/${expenseId}`, { token });
}

/**
 * CON-115: PATCH 지출 수정 body — 서버 UpdateExpenseDto(apps/api/src/finance/dto/expense.dto.ts)의
 * 미러. Expense.expenseType에는 표시 전용 "refund"도 있지만 수정 요청은 expense|gift만 허용된다
 * (서버가 refund를 400 VALIDATION_ERROR로 거부) — Pick<Expense, "expenseType">을 그대로 쓰면
 * 컴파일은 통과하는데 런타임에서만 터지는 타입 함정이 생겨 여기서 좁힌다.
 */
export type UpdateExpenseBody = Partial<Pick<Expense, "categoryId" | "amountKrw" | "spentOn" | "itemName" | "memo">> & {
  expenseType?: "expense" | "gift";
};

export function updateExpense(token: string, expenseId: string, body: UpdateExpenseBody) {
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
};

/**
 * Fetch wrapper dedicated to the version-aware expense endpoints: unlike requestJson, this
 * surfaces the HTTP status/body distinctly (as ExpenseVersionConflictError for 409, or
 * ExpenseHttpError for any other non-2xx) instead of collapsing every failure into a single
 * `Error(JSON.stringify(data))`, since the offline sync engine (src/offline/sync-engine.ts)
 * needs to tell a version conflict apart from a permanent validation failure apart from a
 * network error. Reuses the same single-flight refresh-on-401 flow as requestJson.
 */
async function requestExpenseJson<T>(path: string, options: ExpenseRequestOptions, isRetry = false): Promise<T> {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.idempotencyKey ? { [EXPENSE_IDEMPOTENCY_HEADER]: options.idempotencyKey } : {})
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  const canAttemptRefresh = response.status === 401 && !isRetry && options.token && !isLocalToken(options.token);
  if (canAttemptRefresh) {
    const session = useSessionStore.getState();
    const currentRefreshToken = session.refreshToken;
    if (currentRefreshToken) {
      try {
        const refreshed = await performSingleFlightRefresh(currentRefreshToken);
        return requestExpenseJson<T>(path, { ...options, token: refreshed.accessToken }, true);
      } catch (refreshError) {
        if (refreshError instanceof RefreshHttpError && refreshError.status === 401) {
          useSessionStore.getState().clearSession();
        }
      }
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
    memo?: string;
    linkedItemTemplateId?: string;
    expenseType?: "expense" | "gift";
  },
  idempotencyKey: string
): Promise<Expense> {
  if (isLocalToken(token)) {
    return local(() => localBackend.createExpenseIdempotent(childId, body, idempotencyKey)).catch(rethrowAsExpenseError);
  }
  return requestExpenseJson<Expense>(`/children/${childId}/expenses`, {
    token,
    method: "POST",
    body,
    idempotencyKey
  });
}

export function updateExpenseWithVersion(
  token: string,
  expenseId: string,
  // CON-115: updateExpense와 동일한 body 계약 — expenseType은 expense|gift만 (refund 400 거부).
  body: UpdateExpenseBody,
  expectedVersion: number,
  idempotencyKey: string
): Promise<Expense> {
  if (isLocalToken(token)) {
    return local(() => localBackend.updateExpense(expenseId, body, expectedVersion)).catch(rethrowAsExpenseError);
  }
  return requestExpenseJson<Expense>(`/expenses/${expenseId}`, {
    token,
    method: "PATCH",
    body: { ...body, expectedVersion },
    idempotencyKey
  });
}

export function deleteExpenseWithVersion(
  token: string,
  expenseId: string,
  expectedVersion: number,
  idempotencyKey: string
): Promise<{ success: boolean }> {
  if (isLocalToken(token)) {
    return local(() => localBackend.deleteExpense(expenseId, expectedVersion)).catch(rethrowAsExpenseError);
  }
  return requestExpenseJson<{ success: boolean }>(`/expenses/${expenseId}?expectedVersion=${expectedVersion}`, {
    token,
    method: "DELETE",
    idempotencyKey
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

export function getCategoryReport(
  token: string,
  childId: string,
  // REP-104: string keeps the legacy yearMonth-only call shape; the object form scopes the
  // breakdown to a month, whole year, or year+quarter to match the reports screen's selector.
  period?: string | { yearMonth?: string; year?: number; quarter?: number }
) {
  const normalizedPeriod = typeof period === "string" ? { yearMonth: period } : period;
  if (isLocalToken(token)) return local(() => localBackend.getCategoryReport(childId, normalizedPeriod));
  const params = [
    normalizedPeriod?.yearMonth ? `yearMonth=${normalizedPeriod.yearMonth}` : null,
    normalizedPeriod?.year !== undefined ? `year=${normalizedPeriod.year}` : null,
    normalizedPeriod?.quarter !== undefined ? `quarter=${normalizedPeriod.quarter}` : null
  ].filter(Boolean);
  const query = params.length > 0 ? `?${params.join("&")}` : "";
  return requestJson<CategoryReport>(`/children/${childId}/reports/category${query}`, { token });
}

export function getYearlyReport(token: string, childId: string, year: number) {
  if (isLocalToken(token)) return local(() => localBackend.getYearlyReport(childId, year));
  return requestJson<YearlyReport>(`/children/${childId}/reports/yearly?year=${year}`, { token });
}

/** REP-103: 100일(d100)/첫돌(first-birthday) milestone cost report. */
export type MilestoneReportType = "d100" | "first-birthday";

export type MilestoneReport = {
  childId: string;
  type: MilestoneReportType;
  startDate: string;
  /** Last day inside the milestone window (inclusive). */
  endDate: string;
  /** True while today is still before the window's end; totals then cover only [startDate, today]. */
  partial: boolean;
  daysCovered: number;
  totalKrw: number;
  expenseCount: number;
  topCategories: Array<{ categoryId: string; code: string; name: string; totalKrw: number; share: number }>;
  avgDailyKrw: number;
};

export function getMilestoneReport(token: string, childId: string, type: MilestoneReportType) {
  if (isLocalToken(token)) return local(() => localBackend.getMilestoneReport(childId, type));
  return requestJson<MilestoneReport>(`/children/${childId}/reports/milestone?type=${type}`, { token });
}

/**
 * ITEM-121: `stageBand`는 선택적이다. 넘기면 서버가 그 시기 밴드 기준으로 목록을 만들고
 * (현재 단계와 다른 시기의 준비물도 미리 볼 수 있다), 생략하면 종전대로 아이의 현재 단계
 * 기준이다 — 준비율 스냅샷처럼 밴드와 무관한 호출은 그대로 두면 된다.
 *
 * ITEM-123 (B5): tab="all"은 상태로 거르지 않는 전체 스냅샷이다 — 네 상태 탭의 합집합과
 * 같은 집합(gifted 포함)을 한 번에 받는다. 준비율(ITEM-114)이 탭 4개를 각각 부르던 것을
 * 이 한 요청으로 대체한다.
 */
export function listItems(
  token: string,
  childId: string,
  tab: "now" | "soon" | "prepared" | "not_needed" | "all" = "now",
  stageBand?: StageBandLabel
) {
  if (isLocalToken(token)) return local(() => localBackend.listItems(childId, tab, stageBand));
  const stageBandQuery = stageBand ? `&stageBand=${encodeURIComponent(stageBand)}` : "";
  return requestJson<{ items: ItemSummary[] }>(`/children/${childId}/items?tab=${tab}${stageBandQuery}`, { token });
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

/** FAM-121B: owner-only list of invites that are still pending and unexpired. */
export function listHouseholdInvites(token: string, householdId: string) {
  if (isLocalToken(token)) return local(() => localBackend.listHouseholdInvites(householdId));
  return requestJson<{ invites: PendingInvite[] }>(`/households/${householdId}/invites`, { token });
}

/** FAM-121B: owner cancels a pending invite, killing that link for good. */
export function cancelHouseholdInvite(token: string, householdId: string, inviteId: string) {
  if (isLocalToken(token)) return local(() => localBackend.cancelHouseholdInvite(householdId, inviteId));
  return requestJson<{ success: boolean }>(`/households/${householdId}/invites/${inviteId}`, {
    method: "DELETE",
    token
  });
}

export function getInvite(token: string) {
  const localInvite = localBackend.findLocalInvite(token);
  if (localInvite) return local(() => localBackend.getInvitePreview(token));
  return requestJson<InvitePreview>(`/invites/${token}`);
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

// ---------------------------------------------------------------------------
// AUTH-102 (real Kakao OIDC login) -- additive-only extensions consumed by
// src/auth/kakao-login.ts. Request/response shapes mirror the server exactly:
// apps/api/src/auth/kakao/kakao-auth.{controller,service}.ts and
// apps/api/test/auth-kakao-oidc.e2e.test.ts. None of the functions above are
// touched. Both calls are unauthenticated (they *establish* the session), so
// neither takes a token nor participates in the 401-refresh flow.
// ---------------------------------------------------------------------------

/** POST /auth/kakao/prepare success shape: `nonce` is returned in plaintext exactly once. */
export type KakaoPrepareResponse = {
  transactionId: string;
  state: string;
  nonce: string;
};

/** POST /auth/kakao/exchange success shape -- identical to the dev-stub oauthLogin result, so
 * login.tsx's existing success handling (setSession + upsertConsents) is reused as-is. */
export type KakaoExchangeResult = {
  user: {
    id: string;
    households?: Array<{ id: string; name: string; role: string }>;
  };
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  onboardingRequired: boolean;
};

/** The API validates with forbidNonWhitelisted: send ONLY these keys (in particular, no
 * `codeChallengeMethod` -- S256 is implied server-side). */
export function kakaoPrepare(body: { redirectUri: string; codeChallenge?: string }) {
  return requestJson<KakaoPrepareResponse>("/auth/kakao/prepare", {
    method: "POST",
    body
  });
}

export function kakaoExchange(body: {
  transactionId: string;
  state: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}) {
  return requestJson<KakaoExchangeResult>("/auth/kakao/exchange", {
    method: "POST",
    body
  });
}

// ---------------------------------------------------------------------------
// PUSH-116 (mobile half of the push pipeline) -- additive-only extensions for the
// /me/devices push-device registration API (apps/api/src/devices/*, NOTI-100).
// Request/response shapes are hand-declared mirrors of the server's
// RegisterDeviceDto/UpdateDeviceDto (apps/api/src/devices/dto/device.dto.ts) and
// DevicesController.toDeviceResponse, following the same local-declaration
// convention as Expense/Budget/CategoryListItem above. Local test sessions are
// served by the in-memory mirror in src/notifications/local-devices.ts.
// ---------------------------------------------------------------------------

/** Registerable push platforms -- mirror of DEVICE_PLATFORMS in the server DTO. */
export type DevicePlatform = "ios" | "android";

/**
 * One device row as the API returns it. The server deliberately never echoes `pushToken`
 * back (see toDeviceResponse in devices.controller.ts), so "which of these rows is THIS
 * device" cannot be answered from the list alone -- the boot-registration hook keeps the id
 * that POST /me/devices returned instead (src/notifications/usePushDeviceRegistration.ts).
 * `platform` stays a plain string on read: the DB column is free-text varchar(20); only
 * *registration* is constrained to DevicePlatform.
 */
export type UserDeviceSummary = {
  id: string;
  platform: string;
  notificationEnabled: boolean;
  appVersion: string | null;
  osVersion: string | null;
  createdAt: string;
  updatedAt: string;
};

/** POST /me/devices body -- mirror of RegisterDeviceDto (whitelist-validated server-side). */
export type RegisterDeviceBody = {
  platform: DevicePlatform;
  /** DTO 상한 2000자 -- 길면 서버가 400 VALIDATION_ERROR로 거른다(인덱스 행 크기 방어). */
  pushToken: string;
  notificationEnabled?: boolean;
  appVersion?: string;
  osVersion?: string;
  deviceIdHash?: string;
};

/**
 * Upsert registration: the server keys on (user, pushToken), so calling this again with the
 * same token updates the existing row instead of creating a duplicate -- safe to fire on
 * every app boot (see usePushDeviceRegistration).
 */
export function registerDevice(token: string, body: RegisterDeviceBody) {
  if (isLocalToken(token)) return local(() => localDevices.registerLocalDevice(body));
  return requestJson<UserDeviceSummary>("/me/devices", { method: "POST", token, body });
}

export function listMyDevices(token: string) {
  if (isLocalToken(token)) return local(() => localDevices.listLocalDevices());
  return requestJson<{ devices: UserDeviceSummary[] }>("/me/devices", { token });
}

/** PATCH /me/devices/:deviceId -- per-device 알림 on/off (본인 소유 기기만, 아니면 404). */
export function updateDevice(token: string, deviceId: string, notificationEnabled: boolean) {
  if (isLocalToken(token)) return local(() => localDevices.updateLocalDevice(deviceId, notificationEnabled));
  return requestJson<UserDeviceSummary>(`/me/devices/${deviceId}`, {
    method: "PATCH",
    token,
    body: { notificationEnabled }
  });
}
