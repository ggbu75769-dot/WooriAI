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

export function isAdminApiErrorStatus(error: unknown, status: number): error is AdminApiError {
  return error instanceof Error
    && error.name === "AdminApiError"
    && "status" in error
    && (error as { status?: unknown }).status === status;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const isMultipart = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers: Record<string, string> = { ...(isMultipart ? {} : { "Content-Type": "application/json" }), ...(init?.headers as Record<string, string> ?? {}) };
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
  services: Array<{ serviceType: string; instanceId: string; bootId: string; state: string; activeConfigVersion: number | null; configSource: string | null; restartCount: number; lastHeartbeatAt: string; stoppedAt: string | null; stale: boolean }>;
  remoteConfig: { source: string; version: number | null; updatedAt: string | null };
  storage: { state: string; adapter: string };
  queues: {
    pendingOutbox: number;
    leasedOutbox: number;
    failedOutbox: number;
    oldestPendingAgeSeconds: number | null;
    openDlq: number;
    failedPrivacy: number;
    unknownDeliveries: number;
    imports: Array<{ state: string; _count: { _all: number } }>;
  };
};

export type RemoteConfigOperations = {
  active: { config: Record<string, unknown> & { configVersion: number }; source: string };
  revisions: Array<{ version: number; contentHash: string; action: string; actorAdminId: string | null; reason: string; activatedAt: string }>;
  instances: Array<{ instanceId: string; state: string; activeConfigVersion: number | null; configSource: string | null; lastHeartbeatAt: string; restartCount: number }>;
};

export type CatalogImportReconciliation = {
  dryRun: boolean;
  adapter: string;
  scanned: { objects: number; jobs: number };
  orphanObjects: Array<{ objectKey: string; size: number; lastModified: string | null }>;
  missingObjectJobs: Array<{ id: string; state: string; version: number; objectKey: string | null }>;
  staleJobs: Array<{ id: string; state: string; version: number; objectKey: string | null }>;
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
  return request<RemoteConfigOperations>("/admin/app-config/operations");
}

export function updateRemoteAppConfig(input: { expectedVersion: number; reason: string; config: Record<string, unknown> }) {
  return request<{ config: Record<string, unknown>; revision: { version: number } }>("/admin/app-config", { method: "PATCH", body: JSON.stringify(input) });
}

export function rollbackRemoteAppConfig(input: { expectedVersion: number; targetVersion: number; reason: string }) {
  return request<{ config: Record<string, unknown>; revision: { version: number } }>("/admin/app-config/rollback", { method: "POST", body: JSON.stringify(input) });
}

export function previewCatalogImportReconciliation() {
  return request<CatalogImportReconciliation>("/admin/catalog/imports/reconciliation/preview", { method: "POST", body: JSON.stringify({ dryRun: true }) });
}

export function repairCatalogImport(importId: string, expectedVersion: number) {
  return request<{ id: string; state: string; version: number }>(`/admin/catalog/imports/${encodeURIComponent(importId)}/reconcile`, { method: "POST", body: JSON.stringify({ expectedVersion }) });
}

export function cleanupCatalogImportOrphan(objectKey: string) {
  return request<{ success: true }>("/admin/catalog/imports/reconciliation/orphans/cleanup", { method: "POST", body: JSON.stringify({ objectKey }) });
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

export function listNotificationReconciliation() {
  return request<{ deliveries: Array<{ id: string; eventType: string; state: "sending" | "unknown"; failureCode: string | null; retryCount: number; createdAt: string }> }>("/admin/operations/notification-reconciliation");
}

export function reconcileNotificationDelivery(id: string, expectedState: "sending" | "unknown") {
  return request<{ code: string }>(`/admin/operations/notification-deliveries/${encodeURIComponent(id)}/reconcile`, { method: "POST", body: JSON.stringify({ expectedState }) });
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
  return isAdminApiErrorStatus(error, 401);
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

export type CatalogV2AdminItem = {
  id: string;
  code: string;
  nameKo: string;
  status: "draft" | "review_requested" | "editorial_review" | "domain_review" | "safety_review" | "changes_requested" | "approved" | "scheduled" | "in_review" | "published" | "suspended" | "recalled" | "archived" | "retired";
  safetyTier: "normal" | "elevated" | "high";
  targetSubject: "mother" | "child" | "caregiver" | "household" | "shared";
  reviewedAt: string | null;
  reviewedByAdminId: string | null;
  lastEditedByAdminId: string | null;
  contentVersion: number;
  contentHash: string | null;
  aliasCount: number;
  openReportCount: number;
  offerCount: number;
};

export type CatalogV2Coverage = {
  summary: {
    domains: number;
    canonicalItems: number;
    aliases: number;
    highRiskAwaitingProfessionalReview: number;
    matrix: Record<string, number>;
    applicability: Record<string, number>;
    gapTypes: Record<string, number>;
    unclassifiedApplicability: number;
    externalReviewBlockers: number;
    publishBlocked: boolean;
  };
  cells: Array<{ id: string; lifecycleAxis: "mother" | "child"; lifecycleCode: string; contextCode: string; state: "covered" | "not_applicable" | "gap"; applicability: "required" | "recommended" | "optional" | "not_applicable" | "review_needed"; gapType: "missing_item" | "insufficient_depth" | "missing_lifecycle_rule" | "missing_context_rule" | "missing_source" | "review_blocked" | "taxonomy_mismatch" | "unclassified_applicability" | null; reason: string | null }>;
};

export type CatalogV2Queues = {
  summary: Record<CatalogV2QueueKey, number>;
  missingMetadata: Array<CatalogQueueTarget & { missingFields: Array<"shortDescription" | "reasonText" | "timingSummary" | "sourceSummary"> }>;
  reviewRequired: Array<CatalogQueueTarget & { status: CatalogV2AdminItem["status"]; safetyTier: CatalogV2AdminItem["safetyTier"]; professionalReviewRequired: boolean }>;
  expiredReviews: Array<CatalogQueueTarget & { safetyRuleId: string; severity: CatalogV2AdminItem["safetyTier"]; expiresAt: string }>;
  duplicateCandidates: Array<{ normalizedName: string; targets: CatalogQueueTarget[] }>;
  brokenOffers: Array<CatalogQueueTarget & { offerId: string; seller: string; productName: string; healthState: "healthy" | "stale" | "failed" | "blocked"; recallState: "clear" | "check_required" | "recalled" | "unknown"; healthCheckState: "available" | "queued" | "processing" | "dead_letter" | "unavailable"; retryEligible: boolean; retryBlockedReason: string | null; updatedAt: string }>;
  staleOffers: Array<CatalogQueueTarget & { offerId: string; seller: string; productName: string; priceSnapshotKrw: number | null; priceCheckedAt: string | null; refreshAvailable: false; refreshBlockedReason: "PRICE_PROVIDER_NOT_CONNECTED" }>;
  openReports: Array<{ itemId: string | null; itemCode: string | null; itemName: string; reportId: string; reasonCode: string; detail: string | null; createdAt: string }>;
  capabilities: { offerHealthRetry: "legacy_product_link_only"; priceRefresh: false };
};

export type CatalogV2QueueKey = "missingMetadata" | "reviewRequired" | "expiredReviews" | "duplicateCandidates" | "brokenOffers" | "staleOffers" | "openReports";
export type CatalogQueueTarget = { itemId: string; itemCode: string; itemName: string };

export type CatalogTaxonomyNode = {
  id: string;
  code: string;
  parentId: string | null;
  level: "domain" | "category" | "subcategory";
  nameKo: string;
  description: string | null;
  iconKey: string | null;
  displayOrder: number;
  active: boolean;
  version: number;
  depth: number;
  directChildCount: number;
  directItemCount: number;
  descendantItemCount: number;
};

export type CatalogTaxonomyArchiveImpact = {
  node: CatalogTaxonomyNode;
  activeChildCount: number;
  directItemCount: number;
  coverageDecisionCount: number;
  blockers: Array<{ code: "ACTIVE_CHILDREN" | "ITEM_MAPPINGS" | "COVERAGE_DECISIONS"; count: number }>;
  canArchive: boolean;
};

export type CatalogTaxonomyReorderInput = {
  parentId?: string;
  nodes: Array<{ id: string; expectedVersion: number }>;
};

export type CatalogTaxonomyReorderPreview = {
  parentId: string | null;
  siblingCount: number;
  changes: Array<{ id: string; code: string; nameKo: string; currentOrder: number; nextOrder: number; version: number }>;
  canApply: boolean;
  itemMappingsAffected: 0;
  appliedCount?: number;
};

export type CatalogDraftImportRowInput = {
  code?: string;
  nameKo?: string;
  shortDescription?: string;
  reasonText?: string;
  timingSummary?: string;
  sourceSummary?: string;
};

export type CatalogDraftImportPreview = {
  schemaVersion: 1;
  mode: "existing-item-editorial-update";
  summary: { total: number; valid: number; invalid: number };
  rows: Array<{
    rowNumber: number;
    code: string;
    valid: boolean;
    errors: string[];
    changes: Partial<Record<Exclude<keyof CatalogDraftImportRowInput, "code">, string>>;
    expectedVersion?: number;
    contentHash?: string;
    expectedStatus?: CatalogV2AdminItem["status"];
  }>;
};

export type CatalogDraftImportPreviewResponse = {
  import: { id: string; state: "ready" | "rejected" | "applied" | "retryable_failure" | "permanent_failure" | "missing_object"; sourceName: string; rowCount: number; version: number };
  preview: CatalogDraftImportPreview;
  idempotent: boolean;
};

export type CatalogItemRevisionHistory = {
  current: { id: string; contentVersion: number; contentHash: string | null };
  revisions: Array<{ revision: number; contentHash: string; authoredByAdminId: string; createdAt: string }>;
  approvals: Array<{ revision: number; contentHash: string; approvalType: "editorial" | "domain" | "safety"; reviewedByAdminId: string; evidenceUrl: string | null; evidenceTitle: string | null; expiresAt: string | null; createdAt: string }>;
  events: Array<{ id: string; revision: number; contentHash: string; fromStatus: string; toStatus: string; actorAdminId: string; metadataJson: unknown; createdAt: string }>;
};

export type CatalogRollbackPreview = {
  itemId: string;
  currentRevision: number;
  currentContentHash: string;
  targetRevision: number;
  targetContentHash: string;
  resultRevision: number;
  resultStatus: "draft";
  invalidatesApprovals: true;
  publishesDirectly: false;
  changes: Array<{ field: string; current: unknown; restored: unknown }>;
};

export function listCatalogV2Items(filter?: { query?: string; status?: CatalogV2AdminItem["status"]; safetyTier?: CatalogV2AdminItem["safetyTier"] }) {
  const params = new URLSearchParams({ limit: "50" });
  if (filter?.query) params.set("query", filter.query);
  if (filter?.status) params.set("status", filter.status);
  if (filter?.safetyTier) params.set("safetyTier", filter.safetyTier);
  return request<{ items: CatalogV2AdminItem[]; total: number; nextCursor: string | null }>(`/admin/catalog/items?${params.toString()}`);
}

export function getCatalogV2Coverage() {
  return request<CatalogV2Coverage>("/admin/catalog/coverage");
}

export function getCatalogV2Queues() {
  return request<CatalogV2Queues>("/admin/catalog/queues");
}

export function retryCatalogOfferHealth(offerId: string) {
  return request<{ queued: true; alreadyQueued: boolean; outboxId: string; state: "queued" | "processing" }>(`/admin/catalog/offers/${encodeURIComponent(offerId)}/retry-health-check`, { method: "POST", body: "{}" });
}

export function approveCatalogOffer(offerId: string, expectedUpdatedAt: string) {
  return request<{ id: string; active: true; approvedAt: string; approvedByAdminId: string }>(`/admin/catalog/offers/${encodeURIComponent(offerId)}/approve`, {
    method: "POST",
    body: JSON.stringify({ expectedUpdatedAt })
  });
}

export function resolveCatalogReports(reportIds: string[], note?: string) {
  return request<{ resolvedCount: number; reportIds: string[]; resolvedAt: string }>("/admin/catalog/reports/resolve-batch", {
    method: "POST",
    body: JSON.stringify({ reportIds, ...(note?.trim() ? { note: note.trim() } : {}) })
  });
}

export function getCatalogTaxonomyTree() {
  return request<{ nodes: CatalogTaxonomyNode[] }>("/admin/catalog/taxonomy/tree");
}

export function createCatalogTaxonomyNode(input: {
  code: string;
  level: CatalogTaxonomyNode["level"];
  parentId?: string;
  nameKo: string;
  description?: string;
  iconKey?: string;
}) {
  return request<CatalogTaxonomyNode>("/admin/catalog/taxonomy/nodes", { method: "POST", body: JSON.stringify(input) });
}

export function updateCatalogTaxonomyNode(nodeId: string, input: { expectedVersion: number; nameKo?: string; description?: string; iconKey?: string }) {
  return request<CatalogTaxonomyNode>(`/admin/catalog/taxonomy/nodes/${encodeURIComponent(nodeId)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function previewCatalogTaxonomyArchive(nodeId: string) {
  return request<CatalogTaxonomyArchiveImpact>(`/admin/catalog/taxonomy/nodes/${encodeURIComponent(nodeId)}/archive-preview`, { method: "POST" });
}

export function archiveCatalogTaxonomyNode(nodeId: string, expectedVersion: number) {
  return request<CatalogTaxonomyNode>(`/admin/catalog/taxonomy/nodes/${encodeURIComponent(nodeId)}/archive`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion })
  });
}

export function previewCatalogTaxonomyReorder(input: CatalogTaxonomyReorderInput) {
  return request<CatalogTaxonomyReorderPreview>("/admin/catalog/taxonomy/reorder-preview", { method: "POST", body: JSON.stringify(input) });
}

export function applyCatalogTaxonomyReorder(input: CatalogTaxonomyReorderInput) {
  return request<CatalogTaxonomyReorderPreview>("/admin/catalog/taxonomy/reorder", { method: "POST", body: JSON.stringify(input) });
}

export function previewCatalogV2Import(input: { sourceName: string; sourceHash: string; rows: CatalogDraftImportRowInput[] }) {
  return request<CatalogDraftImportPreviewResponse>("/admin/catalog/imports/preview", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function previewCatalogV2FileImport(file: File) {
  const body = new FormData();
  body.append("file", file, file.name);
  return request<CatalogDraftImportPreviewResponse>("/admin/catalog/imports/file-preview", { method: "POST", body });
}

export function applyCatalogV2Import(importId: string, expectedVersion: number, rowNumbers: number[]) {
  return request<{ import: { id: string; state: "applied"; version: number }; appliedCount: number; appliedRowNumbers: number[]; idempotent: boolean }>(
    `/admin/catalog/imports/${encodeURIComponent(importId)}/apply`,
    { method: "POST", body: JSON.stringify({ expectedVersion, rowNumbers }) }
  );
}

export function catalogV2ImportErrorsUrl(importId: string) {
  return `/api/v1/admin/catalog/imports/${encodeURIComponent(importId)}/errors.csv`;
}

export function getCatalogItemRevisions(itemId: string) {
  return request<CatalogItemRevisionHistory>(`/admin/catalog/items/${encodeURIComponent(itemId)}/revisions`);
}

export function previewCatalogItemRollback(itemId: string, targetRevision: number, expectedVersion: number, contentHash: string) {
  return request<CatalogRollbackPreview>(`/admin/catalog/items/${encodeURIComponent(itemId)}/revisions/${targetRevision}/rollback-preview`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion, contentHash })
  });
}

export function rollbackCatalogItem(itemId: string, targetRevision: number, expectedVersion: number, contentHash: string) {
  return request<{ item: CatalogV2AdminItem; rollbackSourceRevision: number; approvalsInvalidated: true; publishesDirectly: false }>(`/admin/catalog/items/${encodeURIComponent(itemId)}/revisions/${targetRevision}/rollback`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion, contentHash })
  });
}

export function requestCatalogV2ItemReview(itemId: string, expectedVersion: number, contentHash: string) {
  return request<CatalogV2AdminItem>(`/admin/catalog/items/${itemId}/request-review`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion, contentHash })
  });
}

export function reviewCatalogV2Item(itemId: string, input: {
  reviewType: "editorial" | "domain" | "safety";
  expectedVersion: number;
  contentHash: string;
  professionalReviewConfirmed?: boolean;
  evidenceUrl?: string;
  evidenceTitle?: string;
  expiresAt?: string;
}) {
  return request<CatalogV2AdminItem>(`/admin/catalog/items/${itemId}/review`, { method: "POST", body: JSON.stringify(input) });
}

export function publishCatalogV2Item(itemId: string, expectedVersion: number, contentHash: string) {
  return request<CatalogV2AdminItem>(`/admin/catalog/items/${itemId}/publish`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion, contentHash })
  });
}

export type Release5PilotWorklist = {
  counts: {
    candidates: number;
    ready: number;
    notApproved: number;
    missingStructure: number;
    missingEvidence: number;
    missingEditorialApproval: number;
    missingDomainApproval: number;
    missingApprovalReviewerSeparation: number;
  };
  items: Array<{
    id: string;
    code: string;
    nameKo: string;
    contentVersion: number;
    contentHash: string | null;
    safetyTier: string;
    status: string;
    structureReady: boolean;
    evidenceReady: boolean;
    editorialApproved: boolean;
    domainApproved: boolean;
    approvalReviewersIndependent: boolean;
    ready: boolean;
  }>;
};

export type Release5RecallWorklist = {
  events: Array<{
    id: string;
    providerKey: string;
    providerEventId: string;
    providerVersion: number;
    eventStatus: string;
    title: string;
    normalizedGuidance: string;
    itemDefinitionId: string | null;
    matchConfidence: number;
    version: number;
    occurredAt: string;
  }>;
};

export type Release5LegalCandidate = {
  documentType: "terms" | "privacy" | "marketing" | "analytics";
  locale?: string;
  version: string;
  title: string;
  bodyMarkdown: string;
  publicUrl?: string;
  required: boolean;
  effectiveAt: string;
};

export type Release5MerchantRowInput = {
  merchantIdentity: string;
  itemDefinitionId: string;
  productName: string;
  publicUrl: string;
  priceKrw: number;
  currency: string;
  stockState: "in_stock" | "out_of_stock" | "preorder" | "discontinued" | "unknown";
  shipping?: Record<string, unknown>;
  affiliate?: boolean;
  disclosureText?: string;
  priceCheckedAt: string;
};

export function getRelease5PilotWorklist() {
  return request<Release5PilotWorklist>("/admin/release5/catalog/pilot-worklist");
}

export function getRelease5RecallWorklist() {
  return request<Release5RecallWorklist>("/admin/release5/external/recalls/worklist");
}

export function previewRelease5LegalDocument(input: Release5LegalCandidate) {
  return request<{ document: Release5LegalCandidate & { locale: string; publicUrl: string | null }; contentHash: string; validation: { valid: true; placeholder: false } }>(
    "/admin/release5/legal/preview",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function importRelease5LegalDocument(input: Release5LegalCandidate) {
  return request<{ id: string; revision: number; contentHash: string; publishedAt: string | null }>(
    "/admin/release5/legal/documents",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function createRelease5EvidenceSource(itemId: string, input: {
  sourceType: string;
  title: string;
  publicUrl: string;
  publisher?: string;
  revision: number;
  applicableClaims: string[];
  expiresAt?: string;
  reviewDueAt?: string;
}) {
  return request<{ id: string; contentHash: string; status: string }>(
    `/admin/release5/catalog/items/${encodeURIComponent(itemId)}/evidence`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function reviewRelease5EvidenceSource(evidenceId: string, input: {
  expectedContentHash: string;
  approved: boolean;
}) {
  return request<{ id: string; contentHash: string; status: string; reviewedByAdminId: string | null }>(
    `/admin/release5/catalog/evidence/${encodeURIComponent(evidenceId)}/review`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function upsertRelease5SafetyAlternative(itemId: string, input: {
  alternativeItemDefinitionId: string;
  reason: string;
}) {
  return request<{
    itemDefinitionId: string;
    alternativeItemDefinitionId: string;
    reason: string;
    active: boolean;
    evidenceSourceId: string | null;
  }>(`/admin/release5/catalog/items/${encodeURIComponent(itemId)}/safety-alternatives`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function approveRelease5SafetyAlternative(itemId: string, input: {
  alternativeItemDefinitionId: string;
  evidenceSourceId: string;
}) {
  return request<{
    itemDefinitionId: string;
    alternativeItemDefinitionId: string;
    active: boolean;
    evidenceSourceId: string;
    approvedByAdminId: string;
  }>(`/admin/release5/catalog/items/${encodeURIComponent(itemId)}/safety-alternatives/approve`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function deactivateRelease5SafetyAlternative(itemId: string, alternativeItemDefinitionId: string) {
  return request<{ active: boolean; evidenceSourceId: string | null }>(
    `/admin/release5/catalog/items/${encodeURIComponent(itemId)}/safety-alternatives/${encodeURIComponent(alternativeItemDefinitionId)}/deactivate`,
    { method: "POST" }
  );
}

export function previewRelease5PilotManifest(itemIds: string[]) {
  return request<{ id: string; contentHash: string; itemIds: string[]; status: string }>(
    "/admin/release5/catalog/pilot-manifests/preview",
    { method: "POST", body: JSON.stringify({ itemIds }) }
  );
}

export function previewRelease5MerchantFeed(sourceName: string, rows: Release5MerchantRowInput[]) {
  return request<{
    duplicate: boolean;
    import: { id: string; state: string; sourceHash: string; resultJson: { valid: number; invalid: number } };
    rows: Array<{ id: string; rowIndex: number; validationState: string; validationErrors: string[]; reviewState: string }>;
  }>("/admin/release5/external/merchant-feeds/preview", {
    method: "POST",
    body: JSON.stringify({ sourceName, rows })
  });
}
