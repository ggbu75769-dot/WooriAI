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
};

export type ItemTemplate = {
  id: string;
  name: string;
  shortReason: string;
  necessityLevel: NecessityLevel;
  status: string;
  timingLabel?: string;
  priceBandText?: string;
  reasonText: string;
  skipReasonText?: string | null;
  usedSecondhandOk: boolean;
  safetyNote?: string | null;
  medicalDisclaimerRequired: boolean;
  active: boolean;
  reviewedAt?: string | null;
  nextReviewAt?: string | null;
  sourceNote?: string | null;
  contentStatus: "draft" | "reviewed" | "retired";
  stageCodes: ChildStageCode[];
  productLinks: ProductLink[];
};

export type CatalogCompleteness = {
  totalCount: number;
  reviewedActiveCount: number;
  stageCoverage: Array<{ stageCode: ChildStageCode; activeCount: number }>;
  commerceCoverage: {
    activeLinkCount: number;
    commerceEnabledCount: number;
    zeroLinkCount: number;
    oneLinkCount: number;
    twoPlusLinkCount: number;
  };
  issues: {
    missingStage: number;
    missingReason: number;
    missingSkipReason: number;
    missingPrice: number;
    missingMedicalSafety: number;
    coreWithoutLinks: number;
    staleReview: number;
    imageMissing: number;
    imageFieldSupported: boolean;
  };
  statusCounts: { draft: number; reviewed: number; retired: number };
  publicationBlocked: boolean;
  publicationBlockers: {
    missingStage: number;
    missingReason: number;
    missingSkipReason: number;
    invertedPrice: number;
    missingMedicalSafety: number;
  };
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

export type DeadLetterJobSummary = {
  id: string;
  topic: string;
  failureCode: string;
  attempts: number;
  lastFailedAt: string;
};

export type OperationsRuntime = {
  nodeEnv: string;
  adapters: Record<string, boolean>;
  queues: { pendingOutbox: number; openDlq: number; failedPrivacy: number };
};

export function getOperationsRuntime() {
  return request<OperationsRuntime>("/admin/operations/runtime");
}

export function listDeadLetterJobs() {
  return request<{ jobs: DeadLetterJobSummary[] }>("/admin/jobs/dead-letter");
}

export function retryDeadLetterJob(id: string) {
  return request<{ success: true }>(`/admin/jobs/dead-letter/${id}/retry`, { method: "POST", body: "{}" });
}

export function cancelDeadLetterJob(id: string) {
  return request<{ success: true }>(`/admin/jobs/dead-letter/${id}/cancel`, { method: "POST", body: "{}" });
}

export function listPrivacyOperations() {
  return request<{ requests: Array<{ id: string; requestType: string; state: string; requestedAt: string; failureCode: string | null }> }>("/admin/operations/privacy-requests");
}

export function retryPrivacyOperation(id: string) {
  return request<{ success: true }>(`/admin/operations/privacy-requests/${id}/retry`, { method: "POST", body: "{}" });
}

export function getRemoteAppConfig() {
  return request<Record<string, unknown>>("/app-config");
}

export function updateRemoteAppConfig(config: Record<string, unknown>) {
  return request<Record<string, unknown>>("/admin/app-config", { method: "PATCH", body: JSON.stringify(config) });
}

export function listLinkHealthOperations() {
  return request<{ links: Array<{ id: string; title: string; active: boolean; health: { state: string; checkedAt: string | null } | null }> }>("/admin/operations/link-health");
}

export function listScheduledOperations() {
  return request<{ revisions: Array<{ id: string; entityType: string; status: string; scheduledFor: string; publishErrorCode: string | null }> }>("/admin/operations/scheduled-content");
}

export function getNotificationOperations() {
  return request<{ states: Array<{ state: string; _count: { _all: number } }> }>("/admin/operations/notification-summary");
}

export function listIntegrityOperations() {
  return request<{ checks: Array<{ id: string; childId: string; yearMonth: string; checkedAt: string }> }>("/admin/operations/integrity-mismatches");
}

export function getCatalogCompleteness() {
  return request<CatalogCompleteness>("/admin/catalog-completeness");
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

/** Session-expiry only: a role-forbidden (RBAC), CSRF, or MFA-setup-required 403
 * is not "log the admin out", so this intentionally checks 401 alone. */
export function isAuthError(error: unknown): boolean {
  return error instanceof AdminApiError && error.status === 401;
}

export type AdminProfile = { id: string; email: string; displayName: string; role: "admin" | "editor" | "analyst" };

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
