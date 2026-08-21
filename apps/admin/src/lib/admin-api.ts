// Admin CMS API client. Talks to the NestJS admin endpoints under `/admin/*`
// through the Next.js same-origin rewrite proxy (see next.config.js) using an
// HttpOnly `admin_session` cookie for auth (SEC-102) and a double-submit
// `X-CSRF-Token` header on state-changing requests. No runtime dependency
// beyond `fetch`.
//
// 후속 과제 (FIX-118C, 이번 스코프 아님): admin 쓰기 엔드포인트에는 서버 측
// 멱등키 장치(IdempotencyInterceptor)가 붙어 있지 않다. 모바일 동기화 경로와
// 달리 /admin/* 의 POST/PUT/PATCH/DELETE 는 같은 요청이 두 번 도달하면 두 번
// 반영된다 (bulk-apply 500행 재실행, displayOrder 중복, 계정 중복 생성 등).
// 그래서 클라이언트는 쓰기 타임아웃을 "실패"로 단정하지 않는다 — 아래
// WRITE_FETCH_TIMEOUT_MS 분기와 AdminApiTimeoutError.retryUnsafe 참고.
// 근본 해결(서버 Idempotency-Key 헤더 + 인터셉터 적용)은 별도 티켓으로 다룬다.

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

// ADM-117 timeout hardening: mirrors the mobile client's fetch-timeout
// precedent (apps/mobile/src/api/client.ts DEFAULT_FETCH_TIMEOUT_MS) -- a
// plain `fetch` against a hung/unreachable API can sit for 60-90+ seconds (or
// forever) before the OS gives up, leaving admin pages stuck on their
// "처리 중..."/"불러오는 중..." state indefinitely. Every request below is
// bounded so a call that never settles is force-failed into the existing
// AdminApiError-based error/재시도 UI instead of hanging.
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

// FIX-118C: 쓰기(비-GET)에는 더 넉넉한 상한을 쓴다. 읽기는 끊어도 다시 부르면
// 그만이지만, admin 쓰기는 서버 멱등 장치가 없어(위 후속 과제 주석) 클라이언트가
// 먼저 끊는 순간 "실패했는지 성공했는지 모르는" 상태가 된다. 서버가 10초를 넘겨
// 성공했는데 UI가 "시간 초과"로 표시하면 운영자가 재시도해 이중 반영(bulk 500행
// 2회 적용, displayOrder 중복 등)이 일어난다. 60초는 실제로 무거운 admin 쓰기
// (bulk-apply 최대 500행, 승인·게시)가 끝나기에 충분하면서도, 완전히 죽은
// 연결이 UI를 영원히 "처리 중..."에 묶어두지는 않는 절충값이다.
export const WRITE_FETCH_TIMEOUT_MS = 60_000;

/** 메서드별 fetch 타임아웃 상한. GET(읽기)은 10초, 나머지(쓰기)는 60초. */
export function timeoutMsForMethod(method: string): number {
  return STATE_CHANGING_METHODS.has(method.toUpperCase()) ? WRITE_FETCH_TIMEOUT_MS : DEFAULT_FETCH_TIMEOUT_MS;
}

const READ_TIMEOUT_MESSAGE = "요청 시간이 초과됐어요(10초). 네트워크 상태를 확인하고 다시 시도해 주세요.";

// 쓰기 타임아웃 문구는 의도적으로 재시도를 권하지 않는다 — 서버가 이미 반영했을
// 수 있으므로 "다시 시도해 주세요"는 이중 반영을 유도하는 안내가 된다.
const WRITE_TIMEOUT_MESSAGE =
  "요청이 오래 걸리고 있어요(60초). 반영 여부가 확실하지 않으니 목록을 새로고침해 확인한 뒤 다시 시도하세요.";

/** Thrown when fetchWithTimeout's OWN timeout bound fires (never for genuine
 * network failures -- those keep the "서버에 연결하지 못했어요" mapping below).
 * Extends AdminApiError (status 0, code "TIMEOUT") so every existing
 * `error instanceof AdminApiError`/`error.message` display path shows the
 * Korean timeout guidance without changes. `cause` carries the original abort
 * rejection (typically a DOMException named "AbortError") for debugging.
 *
 * FIX-118C: `method`와 `retryUnsafe`를 함께 실어 보낸다. `retryUnsafe === true`
 * (비-GET 쓰기)면 서버가 이미 처리했을 수 있으므로 호출부는 자동 재시도를 걸거나
 * 재시도를 권하는 문구를 보여선 안 된다. */
export class AdminApiTimeoutError extends AdminApiError {
  /** 타임아웃된 요청의 HTTP 메서드(대문자). */
  readonly method: string;
  /** 비-GET 쓰기라 재시도 시 이중 반영 위험이 있는지. */
  readonly retryUnsafe: boolean;

  constructor(cause: unknown, method: string = "GET") {
    const normalized = method.toUpperCase();
    const retryUnsafe = STATE_CHANGING_METHODS.has(normalized);
    super(0, retryUnsafe ? WRITE_TIMEOUT_MESSAGE : READ_TIMEOUT_MESSAGE, "TIMEOUT");
    this.name = "AdminApiTimeoutError";
    this.method = normalized;
    this.retryUnsafe = retryUnsafe;
    this.cause = cause;
  }
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof AdminApiTimeoutError;
}

/** 쓰기 타임아웃(반영 여부 불명 → 재시도 시 이중 반영 위험) 판별. 읽기 타임아웃과
 * 일반 네트워크 실패에는 false. */
export function isRetryUnsafeTimeoutError(error: unknown): boolean {
  return error instanceof AdminApiTimeoutError && error.retryUnsafe;
}

/** Wraps `fetch` with an AbortController-based timeout so a hung connection
 * always settles (as a rejection) within `timeoutMs`. A rejection caused by
 * this function's own timeout abort is translated into AdminApiTimeoutError
 * (callers never pass their own `signal` -- the spread always overrides it, so
 * the only abort source here is the timer); every other rejection is rethrown
 * untouched. Same double guard as the mobile client: `timedOut` (our timer
 * actually fired) AND the abort shape (`name === "AbortError"`), so a genuine
 * network error landing in the same tick as the timer is never mislabeled. */
function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
  method: string = "GET"
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return fetch(input, { ...init, signal: controller.signal })
    .catch((error: unknown) => {
      if (timedOut && (error as { name?: unknown } | null)?.name === "AbortError") {
        throw new AdminApiTimeoutError(error, method);
      }
      throw error;
    })
    .finally(() => clearTimeout(timer));
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
    response = await fetchWithTimeout(
      `${apiBaseUrl()}${path}`,
      { ...init, method, credentials: "include", headers },
      // FIX-118C: 읽기 10초 / 쓰기 60초. 쓰기를 일찍 끊으면 서버는 성공했는데
      // 운영자가 재시도해 이중 반영될 수 있어서다.
      timeoutMsForMethod(method),
      method
    );
  } catch (error) {
    // The timeout keeps its own typed error (and Korean guidance); every
    // other rejection stays the generic connection failure, exactly as before.
    if (error instanceof AdminApiTimeoutError) throw error;
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
