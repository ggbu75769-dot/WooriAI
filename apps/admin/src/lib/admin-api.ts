// Admin CMS API client. Talks to the NestJS admin endpoints under `/admin/*`
// through the Next.js same-origin rewrite proxy (see next.config.js) using an
// HttpOnly `admin_session` cookie for auth (SEC-102) and a double-submit
// `X-CSRF-Token` header on state-changing requests. No runtime dependency
// beyond `fetch`.

export type NecessityLevel = "essential" | "convenience" | "optional";
export const NECESSITY_LEVELS: NecessityLevel[] = ["essential", "convenience", "optional"];
export const NECESSITY_LEVEL_LABELS: Record<NecessityLevel, string> = {
  essential: "필수",
  convenience: "편의",
  optional: "선택"
};

export type ChildStageCode =
  | "pregnancy_early"
  | "pregnancy_mid"
  | "pregnancy_late"
  | "newborn_0_3"
  | "infant_4_6"
  | "infant_7_12"
  | "toddler_1_3"
  | "kid_4_7"
  | "elementary"
  | "middle_school";

export const CHILD_STAGE_CODES: ChildStageCode[] = [
  "pregnancy_early",
  "pregnancy_mid",
  "pregnancy_late",
  "newborn_0_3",
  "infant_4_6",
  "infant_7_12",
  "toddler_1_3",
  "kid_4_7",
  "elementary",
  "middle_school"
];

export const CHILD_STAGE_LABELS: Record<ChildStageCode, string> = {
  pregnancy_early: "임신 초기",
  pregnancy_mid: "임신 중기",
  pregnancy_late: "임신 후기",
  newborn_0_3: "신생아 (0~3개월)",
  infant_4_6: "영아 (4~6개월)",
  infant_7_12: "영아 (7~12개월)",
  toddler_1_3: "유아 (1~3세)",
  kid_4_7: "유아동 (4~7세)",
  elementary: "초등학생",
  middle_school: "중학생"
};

export type ProductPlatform = "coupang" | "naver" | "custom";
export const PRODUCT_PLATFORMS: ProductPlatform[] = ["coupang", "naver", "custom"];
export const PRODUCT_PLATFORM_LABELS: Record<ProductPlatform, string> = {
  coupang: "쿠팡",
  naver: "네이버",
  custom: "기타"
};

// COM-105: 워커 헬스체크 판정. null = 아직 확인 전(미확인).
export type LinkHealthStatus = "ok" | "broken" | "unstable";

export const LINK_HEALTH_LABELS: Record<LinkHealthStatus, string> = {
  ok: "정상",
  broken: "깨짐",
  unstable: "불안정"
};

export const LINK_HEALTH_UNKNOWN_LABEL = "미확인";

export type ProductLink = {
  id: string;
  itemTemplateId: string;
  platform: ProductPlatform;
  title: string;
  url: string;
  affiliateUrl: string | null;
  isAffiliate: boolean;
  isSponsored: boolean;
  disclosureText: string | null;
  active: boolean;
  // COM-105: link_health 워커 잡이 기록한 최근 헬스체크 결과 (ISO 8601 타임스탬프).
  healthStatus: LinkHealthStatus | null;
  healthCheckedAt: string | null;
};

export type ItemTemplate = {
  id: string;
  name: string;
  necessityLevel: NecessityLevel;
  status: string;
  timingLabel?: string;
  priceBandText?: string;
  reasonText: string;
  skipReasonText?: string | null;
  usedSecondhandOk: boolean;
  safetyNote?: string | null;
  active: boolean;
  stageCodes: ChildStageCode[];
  productLinks: ProductLink[];
};

export type Disclosure = { id: string | null; key: string; text: string };

export type ClickSummary = {
  totalClicks: number;
  byPlatform: { platform: string; count: number }[];
};

export type ItemTemplateInput = {
  name?: string;
  necessityLevel?: NecessityLevel;
  timingLabel?: string;
  priceMinKrw?: number;
  priceMaxKrw?: number;
  reasonText?: string;
  skipReasonText?: string;
  usedSecondhandOk?: boolean;
  safetyNote?: string;
  stageCodes?: ChildStageCode[];
  active?: boolean;
};

export type ProductLinkInput = {
  itemTemplateId?: string;
  platform?: ProductPlatform;
  title?: string;
  url?: string;
  affiliateUrl?: string;
  isAffiliate?: boolean;
  isSponsored?: boolean;
  disclosureText?: string;
  active?: boolean;
};

// Same-origin `/api/v1` (relative, no host) so every request goes through the
// next.config.js rewrite (`/api/v1/:path*` -> the real API), which is what
// makes the `admin_session`/`admin_csrf` cookies same-origin in the first
// place. Only overridden for setups that intentionally call the API
// cross-origin (uncommon; loses that same-origin cookie simplicity).
const DEFAULT_API_BASE_URL = "/api/v1";

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_COOKIE_NAME = "admin_csrf";
const CSRF_HEADER_NAME = "X-CSRF-Token";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

export class AdminApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init?.headers as Record<string, string> ?? {}) };
  if (STATE_CHANGING_METHODS.has(method)) {
    const csrfToken = readCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { ...init, method, credentials: "include", headers });
  } catch {
    throw new AdminApiError(0, "서버에 연결하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.");
  }

  let text = "";
  try {
    text = await response.text();
  } catch {
    text = "";
  }

  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const errorBody = body && typeof body === "object" ? (body as Record<string, unknown>).error : undefined;
    const code =
      errorBody && typeof errorBody === "object" && "code" in (errorBody as Record<string, unknown>)
        ? String((errorBody as Record<string, unknown>).code)
        : undefined;
    const message =
      errorBody && typeof errorBody === "object" && "message" in (errorBody as Record<string, unknown>)
        ? String((errorBody as Record<string, unknown>).message)
        : "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
    throw new AdminApiError(response.status, message, code);
  }

  return (body ?? ({} as unknown)) as T;
}

export function listItemTemplates() {
  return request<{ items: ItemTemplate[] }>("/admin/item-templates");
}

export function createItemTemplate(input: ItemTemplateInput) {
  return request<ItemTemplate>("/admin/item-templates", { method: "POST", body: JSON.stringify(input) });
}

export function updateItemTemplate(itemTemplateId: string, input: ItemTemplateInput) {
  return request<ItemTemplate>(`/admin/item-templates/${itemTemplateId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function listProductLinks() {
  return request<{ links: ProductLink[] }>("/admin/product-links");
}

export function createProductLink(input: ProductLinkInput) {
  return request<ProductLink>("/admin/product-links", { method: "POST", body: JSON.stringify(input) });
}

export function updateProductLink(productLinkId: string, input: ProductLinkInput) {
  return request<ProductLink>(`/admin/product-links/${productLinkId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

// COM-107-prep: CSV bulk affiliate-link replacement. Admin-role-only on the
// API side (RequireAdminRoles("admin") in product-link-bulk.controller.ts),
// matching the direct product-link write endpoints; the links page hides the
// panel for editor/analyst sessions. Preview never writes; apply updates only
// valid rows and is idempotent (unchanged rows count as skipped).
export type ProductLinkBulkPreviewRow = {
  /** 1-based CSV line number; line 1 is the header row. */
  rowNumber: number;
  status: "valid" | "error";
  matchedProductLinkId: string | null;
  matchedTitle: string | null;
  currentAffiliateUrl: string | null;
  newAffiliateUrl: string | null;
  errorCode?: string;
  errorMessage?: string;
};

export type ProductLinkBulkPreviewResult = {
  rows: ProductLinkBulkPreviewRow[];
  summary: { total: number; valid: number; errors: number };
};

export type ProductLinkBulkApplyResult = { applied: number; skipped: number; errors: number };

/** CSV 템플릿 헤더: productLinkId 또는 itemTemplate(코드/이름)+platform 중 하나로 대상을 지정한다. */
export const PRODUCT_LINK_BULK_CSV_HEADER = "productLinkId,itemTemplate,platform,affiliateUrl,priceSnapshotKrw";

export function bulkPreviewProductLinks(csv: string) {
  return request<ProductLinkBulkPreviewResult>("/admin/product-links/bulk-preview", {
    method: "POST",
    body: JSON.stringify({ csv })
  });
}

export function bulkApplyProductLinks(csv: string) {
  return request<ProductLinkBulkApplyResult>("/admin/product-links/bulk-apply", {
    method: "POST",
    body: JSON.stringify({ csv })
  });
}

export function listDisclosures() {
  return request<{ disclosures: Disclosure[] }>("/admin/disclosures");
}

export function updateDisclosure(key: string, text: string) {
  return request<Disclosure>(`/admin/disclosures/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ text })
  });
}

export function getAffiliateClickSummary() {
  return request<ClickSummary>("/admin/affiliate-clicks/summary");
}

// ADM-008: read-only ops counters for the admin dashboard home. Any admin role
// (admin/editor/analyst) may read it — the API route has no RequireAdminRoles.
export type AdminDashboardSummary = {
  activeUsers: number;
  households: number;
  childrenCount: number;
  expensesTotal: number;
  affiliateClicks7d: number;
  analyticsEvents7d: number;
  pendingContentRevisions: number;
  productLinksBrokenCount: number;
};

export function getAdminDashboardSummary() {
  return request<AdminDashboardSummary>("/admin/dashboard/summary");
}

// ADM-009: read-only analytics-event aggregation for the KPI funnel page
// (/analytics). Any admin role (admin/editor/analyst) may read it — the API
// route has no RequireAdminRoles, same as the dashboard summary.
export type AnalyticsSummaryDays = 7 | 30;

/** Canonical registry event names (packages/contracts/src/analytics.ts), in
 * registry order. The API's `byName` always contains all six (0 included). */
export type AnalyticsEventName =
  | "app_opened"
  | "onboarding_completed"
  | "expense_recorded"
  | "expense_synced"
  | "item_status_changed"
  | "affiliate_link_clicked";

export const ANALYTICS_EVENT_NAMES: AnalyticsEventName[] = [
  "app_opened",
  "onboarding_completed",
  "expense_recorded",
  "expense_synced",
  "item_status_changed",
  "affiliate_link_clicked"
];

export const ANALYTICS_EVENT_LABELS: Record<AnalyticsEventName, string> = {
  app_opened: "앱 실행",
  onboarding_completed: "온보딩 완료",
  expense_recorded: "지출 기록",
  expense_synced: "지출 동기화",
  item_status_changed: "준비템 상태 변경",
  affiliate_link_clicked: "제휴 링크 클릭"
};

export type AdminAnalyticsFunnel = {
  appOpened: number;
  onboardingCompleted: number;
  expenseRecorded: number;
  itemStatusChanged: number;
  affiliateLinkClicked: number;
  expenseSynced: number;
};

export type AdminAnalyticsSummary = {
  days: AnalyticsSummaryDays;
  totalEvents: number;
  /** All six registry names always present (count 0 included). */
  byName: { name: string; count: number }[];
  /** One entry per Seoul-calendar day in the window (ascending, zero-filled). */
  dailyTotals: { date: string; count: number }[];
  /** Same counts as byName, keyed for convenience (KPI funnel). */
  funnel: AdminAnalyticsFunnel;
  /** count(distinct user_anon_id) in the window. */
  uniqueAnonUsers: number;
};

export function getAdminAnalyticsSummary(days: AnalyticsSummaryDays) {
  return request<AdminAnalyticsSummary>(`/admin/analytics/summary?days=${days}`);
}

/** Session-expiry only: a role-forbidden (RBAC), CSRF, or MFA-setup-required 403
 * is not "log the admin out", so this intentionally checks 401 alone. */
export function isAuthError(error: unknown): boolean {
  return error instanceof AdminApiError && error.status === 401;
}

export type AdminRole = "admin" | "editor" | "analyst";
export const ADMIN_ROLES: AdminRole[] = ["admin", "editor", "analyst"];
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  admin: "관리자",
  editor: "편집자",
  analyst: "분석가"
};

export type AdminProfile = { id: string; email: string; displayName: string; role: AdminRole };

export type AdminLoginResult =
  | { mfaRequired: true; mfaToken: string; expiresIn: number }
  | { mfaRequired: false; admin: AdminProfile; mfaEnabled: boolean };

export function adminLogin(email: string, password: string) {
  return request<AdminLoginResult>("/admin/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function adminVerifyMfaLogin(mfaToken: string, code: string) {
  return request<Extract<AdminLoginResult, { mfaRequired: false }>>("/admin/auth/mfa/verify-login", {
    method: "POST",
    body: JSON.stringify({ mfaToken, code })
  });
}

export function adminMe() {
  return request<{ admin: AdminProfile; mfaEnabled: boolean }>("/admin/auth/me");
}

export function adminLogout() {
  return request<{ success: true }>("/admin/auth/logout", { method: "POST" });
}

/** ADM-007: change the logged-in admin's own password. MFA-exempt on the API
 * side (same precedent as mfa/setup) so a freshly created admin can rotate the
 * one-time temp password from POST /admin/users before enrolling MFA. On
 * success the API revokes every OTHER session of the admin; the session that
 * performed the change stays valid. */
export function adminChangePassword(currentPassword: string, newPassword: string) {
  return request<{ success: true }>("/admin/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword })
  });
}

export function adminMfaSetupStart() {
  return request<{ otpauthUrl: string; secret: string; email: string }>("/admin/auth/mfa/setup/start", {
    method: "POST"
  });
}

export function adminMfaSetupVerify(code: string) {
  return request<{ recoveryCodes: string[] }>("/admin/auth/mfa/setup/verify", {
    method: "POST",
    body: JSON.stringify({ code })
  });
}

export function adminMfaDisable(code: string) {
  return request<{ success: true }>("/admin/auth/mfa/disable", { method: "POST", body: JSON.stringify({ code }) });
}

// COM-103: CMS draft -> review -> publish workflow. editor sessions route
// items/links/disclosures saves through these instead of the direct
// create/update endpoints above (see app/items,links,disclosures/page.tsx and
// app/reviews/page.tsx).
export type ContentRevisionEntityType = "item_template" | "product_link" | "disclosure";
// "publishing" is a short-lived internal state between an approve-publish/
// rollback CAS claim and the live write completing (see the API's M-2
// diff-review follow-up) -- included so a GET polled mid-flight round-trips
// through this type without falling outside the union.
export type ContentRevisionStatus = "draft" | "in_review" | "publishing" | "published" | "rejected" | "archived";

export type ContentRevision = {
  id: string;
  entityType: ContentRevisionEntityType;
  entityId: string | null;
  revisionNo: number;
  payload: Record<string, unknown>;
  status: ContentRevisionStatus;
  authorAdminId: string;
  reviewerAdminId: string | null;
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentRevisionDetail = ContentRevision & { live: Record<string, unknown> | null };

export function listContentRevisions(filter?: {
  entityType?: ContentRevisionEntityType;
  entityId?: string;
  status?: ContentRevisionStatus;
}) {
  const params = new URLSearchParams();
  if (filter?.entityType) params.set("entityType", filter.entityType);
  if (filter?.entityId) params.set("entityId", filter.entityId);
  if (filter?.status) params.set("status", filter.status);
  const qs = params.toString();
  return request<{ revisions: ContentRevision[] }>(`/admin/content-revisions${qs ? `?${qs}` : ""}`);
}

export function getContentRevision(id: string) {
  return request<ContentRevisionDetail>(`/admin/content-revisions/${id}`);
}

export function createContentRevision(input: {
  entityType: ContentRevisionEntityType;
  entityId?: string;
  payload: Record<string, unknown>;
}) {
  return request<ContentRevision>("/admin/content-revisions", { method: "POST", body: JSON.stringify(input) });
}

export function updateContentRevisionDraft(id: string, payload: Record<string, unknown>) {
  return request<ContentRevision>(`/admin/content-revisions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ payload })
  });
}

export function submitContentRevision(id: string) {
  return request<ContentRevision>(`/admin/content-revisions/${id}/submit`, { method: "POST" });
}

export function approvePublishContentRevision(id: string) {
  return request<ContentRevision>(`/admin/content-revisions/${id}/approve-publish`, { method: "POST" });
}

export function rejectContentRevision(id: string, note: string) {
  return request<ContentRevision>(`/admin/content-revisions/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ note })
  });
}

export function rollbackContentRevision(id: string) {
  return request<ContentRevision>(`/admin/content-revisions/${id}/rollback`, { method: "POST" });
}

/** COM-103b: set (ISO timestamp, must be in the future) or clear (null) the
 * scheduled-publish time on an in_review revision. Admin-only on the API side,
 * with the same author/approver separation as approve-publish — scheduling is
 * a publish decision. The actual publish is performed by the background worker
 * (a process started with WORKER_ENABLED=1) once the time arrives. */
export function scheduleContentRevision(id: string, scheduledFor: string | null) {
  return request<ContentRevision>(`/admin/content-revisions/${id}/schedule`, {
    method: "PATCH",
    body: JSON.stringify({ scheduledFor })
  });
}

// ADM-006: admin account management. Every endpoint is admin-role-only on the
// API side (RequireAdminRoles("admin") in admin-users.controller.ts); the
// frontend additionally hides the page/nav for editor/analyst sessions (see
// app/users/page.tsx and AdminShell.tsx).
export type AdminUserAccount = {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type AdminUserCreateInput = { email: string; role: AdminRole; displayName?: string };
export type AdminUserUpdateInput = { role?: AdminRole; active?: boolean };

export function listAdminUsers() {
  return request<{ adminUsers: AdminUserAccount[] }>("/admin/users");
}

/** The `tempPassword` in this response is shown EXACTLY ONCE by the API and can
 * never be retrieved again — render it immediately, never persist it anywhere. */
export function createAdminUser(input: AdminUserCreateInput) {
  return request<{ admin: AdminUserAccount; tempPassword: string }>("/admin/users", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateAdminUser(adminUserId: string, input: AdminUserUpdateInput) {
  return request<{ admin: AdminUserAccount }>(`/admin/users/${adminUserId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

/** ADM-006: the API 403s an admin demoting or deactivating their own account
 * (last-admin lockout prevention) with this dedicated code. */
export function isSelfUpdateForbiddenError(error: unknown): boolean {
  return error instanceof AdminApiError && error.code === "ADMIN_SELF_UPDATE_FORBIDDEN";
}

// ADM-113: read-only audit log viewer. The API route is admin-role-only
// (RequireAdminRoles("admin") in audit-logs.controller.ts), same as ADM-006;
// the frontend hides the nav entry from editor/analyst sessions (AdminShell)
// and the page renders an access notice instead of a broken screen. The API
// masks credential-like values in before/after snapshots server-side.
export type AdminAuditLogEntry = {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  /** actorUserId가 관리자 계정이면 그 이메일, 아니면 null (일반 사용자/시스템 행위). */
  actorEmail: string | null;
  householdId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  before: unknown;
  after: unknown;
  ipHash: string | null;
};

export type AdminAuditLogsPageInfo = { total: number; limit: number; offset: number; hasMore: boolean };

export type AdminAuditLogsResult = { auditLogs: AdminAuditLogEntry[]; pageInfo: AdminAuditLogsPageInfo };

export type AdminAuditLogsQuery = {
  limit?: number;
  offset?: number;
  /** 액션 타입 정확 일치 (예: "admin.admin_user.update"). */
  action?: string;
  actorUserId?: string;
  /** createdAt >= from (ISO-8601). */
  from?: string;
  /** createdAt <= to (ISO-8601). */
  to?: string;
};

export function listAuditLogs(query?: AdminAuditLogsQuery) {
  const params = new URLSearchParams();
  if (query?.limit !== undefined) params.set("limit", String(query.limit));
  if (query?.offset !== undefined) params.set("offset", String(query.offset));
  if (query?.action) params.set("action", query.action);
  if (query?.actorUserId) params.set("actorUserId", query.actorUserId);
  if (query?.from) params.set("from", query.from);
  if (query?.to) params.set("to", query.to);
  const qs = params.toString();
  return request<AdminAuditLogsResult>(`/admin/audit-logs${qs ? `?${qs}` : ""}`);
}

/** Convenience: draft-create then immediately submit for review, the shape
 * every editor save flow needs (create+submit is always paired in this CMS). */
export async function draftAndSubmitContentRevision(input: {
  entityType: ContentRevisionEntityType;
  entityId?: string;
  payload: Record<string, unknown>;
}) {
  const draft = await createContentRevision(input);
  return await submitContentRevision(draft.id);
}
