import { getSeoulMonthRange, getSeoulToday } from "@wooriai/domain";
import * as localBackend from "./local-backend";
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

type RequestOptions = {
  token?: string | null;
  body?: unknown;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.formData as unknown as BodyInit
  });

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

export function createChild(
  token: string,
  body: {
    householdId: string;
    nickname: string;
    stageMode: string;
    dueDate?: string;
    birthDate?: string;
    manualStage?: string | null;
  }
) {
  if (isLocalToken(token)) return local(() => localBackend.createChild({ nickname: body.nickname }));
  return requestJson<{ id: string }>("/children", { method: "POST", token, body });
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

export function updateExpense(
  token: string,
  expenseId: string,
  body: Partial<Pick<Expense, "categoryId" | "amountKrw" | "spentOn" | "itemName" | "memo" | "expenseType">>
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
