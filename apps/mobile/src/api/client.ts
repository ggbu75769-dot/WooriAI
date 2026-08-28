import { getSeoulMonthRange, getSeoulToday, type ChildStageCode, type ChildStageMode } from "@wooriai/domain";
import { ApiHttpError, parseApiErrorEnvelope } from "./api-error";
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

/**
 * 라운드 45 UX-Z: 비-2xx 응답의 타입 있는 실패. 화면들이 client.ts 하나만 import 하는 관례를
 * 지키기 위해 여기서 다시 내보낸다(정의는 src/api/api-error.ts — 문구 화이트리스트도 그 옆).
 */
export { ApiHttpError };

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
  /**
   * 라운드 48 T3: 입력 화면(app/expenses/new.tsx)이 저장하던 결제 수단이 이제 응답에도
   * 실린다(서버 toExpenseDto). **optional**이다 — 로컬 목업(local-backend)·오프라인 대기
   * 행·구버전 서버 응답에는 없고, 그때 화면은 이 행을 아예 그리지 않는다(없는 값을
   * "unknown"으로 지어내지 않는다).
   */
  paymentMethod?: "unknown" | "cash" | "card" | "transfer" | "mobile_pay" | null;
  memo?: string | null;
  /**
   * 라운드 48 T3: 준비템 → 지출 역방향 링크. 준비템 상세에서 "이 준비템으로 기록하기"로
   * 남긴 지출에만 값이 있고(없으면 null/미포함), 지출 상세가 그 준비템으로 되돌아가는
   * 링크를 그린다. 품목 이름은 이 응답에 없다 — 이름이 필요하면 준비템 상세를 따로 연다.
   */
  linkedItemTemplateId?: string | null;
  /**
   * 라운드 49 C-06: 어떤 제휴 링크를 눌러서 산 것인지(product_links.id). 구매 확인 카드의
   * "샀어요"에서 이어진 기록에만 값이 있고, 그 밖에는 null/미포함이다.
   *
   * ⚠️ DNC-009: **기록·정산용 식별자다.** 추천 점수·정렬(src/items/item-ranking.ts)에
   * 절대 유입되면 안 된다 — 수수료가 추천 순서를 바꾸는 순간 화면의 순위가 거짓이 된다.
   * 화면에 그리는 값도 아니다(지금 이 값을 읽는 UI는 없다).
   */
  linkedProductLinkId?: string | null;
  expenseType: "expense" | "gift" | "refund";
  source: "manual" | "excel_import" | "purchase_followup" | "admin";
  // MOB-103 (round5a-sprint1-plan.md §2.1): optimistic-concurrency version, 1 on create, +1 on
  // every update/soft-delete. Used by MOB-102's offline outbox as `expectedVersion` on
  // update/delete -- see createExpenseWithIdempotency/updateExpenseWithVersion/
  // deleteExpenseWithVersion below.
  version: number;
};

/**
 * API-124: `GET /children/:childId/expenses` 응답 — packages/contracts의
 * `listExpensesResponseSchema` 수기 미러(모바일은 @wooriai/contracts에 의존하지 않는다,
 * 위 CategoryListItem 주석과 같은 관례).
 *
 * `hasMore`/`nextCursor`는 **추가 필드라 optional**이다. 페이지네이션 이전 서버나
 * 로컬 목업(local-backend.listExpenses)은 두 필드를 아예 주지 않으므로, 소비하는 쪽은
 * `hasMore !== true`를 "더 없음"으로 읽어 자연 종료해야 한다.
 *
 * ⚠️ `totalAmountKrw`는 페이지 합이 아니라 **조회 범위 전체의 합**이다(DNC-015: 선물 제외).
 * 페이지를 모아 다시 더하지 말고 이 값을 그대로 쓴다.
 */
export type ListExpensesResponse = {
  expenses: Expense[];
  totalAmountKrw: number;
  hasMore?: boolean;
  nextCursor?: string | null;
};

/** API-124 서버 상한(packages/contracts EXPENSE_LIST_MAX_LIMIT). 초과 요청은 400. */
export const EXPENSE_LIST_MAX_LIMIT = 500;

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
  /**
   * CAT-124: 사용자에게 고르라고 내밀 카테고리인지. 모바일 퀵타일 별칭 8행과 가져오기
   * 스텁 1행이 false다. 필드가 없던 시절의 서버 응답·캐시도 그대로 동작해야 하므로
   * optional이며, 소비자(src/categories.ts `selectableCategories`)는 `false`일 때만 감춘다.
   */
  selectable?: boolean;
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

/**
 * REP-128: `GET /children/:childId/reports/trend` 응답. 리포트 월간 탭의 추이 차트가
 * `getMonthlyReport`를 6번 부르던 워터폴을 이 한 번으로 접는다 -- 차트가 쓰는 값은 달마다
 * `totalExpenseKrw` 하나뿐이라 예산·카테고리 분해는 담기지 않는다(그게 필요한 카드는
 * 종전대로 `getMonthlyReport`를 쓴다). `months`는 오름차순 연속 배열이고 마지막 원소가
 * 요청한 `endYearMonth`, 기록이 없는 달도 0으로 채워 길이가 항상 요청한 개월 수와 같다.
 * 손으로 선언한 `reportTrendSchema`(packages/contracts/src/schemas.ts)의 미러 -- 이 파일의
 * 다른 응답 타입과 같은 관례다.
 */
export type TrendReport = {
  childId: string;
  months: Array<{ yearMonth: string; totalExpenseKrw: number }>;
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
  // 라운드 49 C-02: 준비템이 속한 지출 분류(categories.id). "준비템 → 지출 기록" 프리필이
  // 품목명만 넘기고 분류는 늘 기본 타일로 떨어지던 구멍을 메운다. optional인 이유는 두 가지다:
  // 서버 컬럼 자체가 nullable이고, 로컬 백엔드 픽스처처럼 값을 갖지 않는 경로가 있다.
  categoryId?: string;
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
  // 라운드 48 T1: 의료/영양제 성격 준비템의 상담 안내 표시 여부(DNC-020). 서버는 항상
  // boolean을 주지만, 로컬 백엔드 픽스처처럼 값을 갖지 않는 경로가 있어 optional이다.
  medicalDisclaimerRequired?: boolean;
  // 라운드 49 C-04: 이 준비템으로 실제 기록한 지출(연결이 없거나 그 지출이 삭제됐으면 null).
  // 서버가 삭제되지 않은 지출만 싣는다 — 지운 지출의 금액이 상세에 남으면 총액과 어긋난다.
  // 로컬 백엔드 픽스처는 아직 이 필드를 만들지 않으므로 optional이다.
  linkedExpense?: { id: string; amountKrw: number; spentOn: string } | null;
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
  /**
   * 라운드 41 K-2: 이 잡이 묶인 아이. 서버가 확정 시 지출을 넣는 곳이 바로 이 값이라
   * (import-pipeline.service.ts의 confirmImport → insertExpense(job.childId)), 검수 화면의
   * "대상 아이" 표시는 선택 아이 스토어가 아니라 **이 필드**를 기준으로 삼는다.
   */
  childId: string;
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
  /**
   * 라운드 45 UX-AA: 서버 GET /settings/privacy는 진작부터 동의 내역을 함께 내려주고 있었는데
   * (onboarding-core.service.ts의 getPrivacySettings → listConsents) 이 타입에 없어서 약관 및
   * 개인정보 화면(SET-003)은 "동의 내역과 삭제 · 탈퇴를 관리해요"라고 적어 놓고 동의 내역을
   * 한 줄도 보여주지 못했다. 선택 필드인 이유: 예전 서버·데모 응답에는 없을 수 있고, 그때
   * 화면은 카드를 그리지 않는다(없는 동의를 지어내지 않는다).
   */
  consents?: Array<{
    type: string;
    version: string;
    required: boolean;
    title: string;
    accepted: boolean;
    /** 동의한 시각(ISO). 동의한 적이 없거나 기록이 없으면 null. */
    acceptedAt?: string | null;
  }>;
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

/**
 * AUTH-127 — the single place that ends a session because the SERVER said the refresh token is
 * gone (30-day TTL elapsed, or the family was revoked by reuse detection). All three transports
 * below (requestJson, requestMultipartJson, requestExpenseJson) funnel their refresh-401 branch
 * through here so the reason can never diverge between them.
 *
 * The reason matters twice downstream, and both are deliberate:
 *   1. src/stores/session.store.ts keeps `userId` for an `"expired"` end, so PRIV-104's teardown
 *      (which keys on a userId change) does NOT wipe the unsynced offline outbox out from under a
 *      user who never asked to be logged out;
 *   2. src/offline/sync-controller.ts watches for the transition and ejects the app to /login
 *      instead of leaving the user on a tab that silently falls back to the preview fixtures.
 *
 * Concurrent 401s all call this (they each catch the same shared refresh rejection); the store set
 * is idempotent and the redirect is edge-triggered, so repeats are harmless.
 */
function endSessionAsExpired(): void {
  useSessionStore.getState().clearSession("expired");
}

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
          endSessionAsExpired();
        }
        // Falls through to the original 401 response below, whether the refresh failed due to
        // an expired/invalid refresh token or a network error while refreshing.
      }
    }
  }

  const data = (await response.json()) as T;
  if (!response.ok) {
    // 라운드 45 UX-Z: 예전에는 `new Error(JSON.stringify(data))`였다 -- 상태코드도 서버가 보낸
    // 오류 코드도 잃어버려서, 화면은 "다시 눌러도 절대 성공하지 않는 실패"에까지 "잠시 후 다시
    // 시도해 주세요."를 붙일 수밖에 없었다. ApiHttpError는 Error를 상속하고 message도 예전과
    // 같은 JSON 원문이라(하위 호환: getBudget의 BUDGET_NOT_FOUND, delta-sync의
    // SYNC_CURSOR_INVALID, invite-permissions의 봉투 파싱이 그대로 동작한다) 기존 소비자는
    // 무엇도 바뀌지 않고, 새 소비자만 status/code로 분기한다(src/api/api-error.ts).
    throw new ApiHttpError(response.status, data);
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
          endSessionAsExpired();
        }
      }
    }
  }

  const data = (await response.json()) as T;
  if (!response.ok) {
    // requestJson과 같은 타입 있는 실패(위 주석 참고). 가져오기 업로드 거절(행 초과·형식·용량)이
    // 바로 이 경로로 오므로, 화면이 "잠시 후 다시" 대신 사실을 말할 수 있는 유일한 자리다.
    throw new ApiHttpError(response.status, data);
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

/**
 * GET /me — 지금 이 토큰이 속한 **가구 전체와 그 안에서의 내 역할**(apps/api의
 * AuthController.me → householdsForUser). 로그인 응답과 같은 모양이라 세션 스토어가
 * 그대로 받아 역할 표를 갈아 끼울 수 있다(session.store.ts의 setHouseholdRoles).
 *
 * 라운드 40 J-3: 역할 변경(보기 전용 → 공동부모 승격)은 지금까지 사용자가 가족 화면을
 * 열어 볼 때만 반영됐고, 기본 가구가 아닌 가구는 그 화면조차 조회하지 않아 영영 반영되지
 * 않았다. 잠금 안내를 띄우는 순간 이 호출로 서버 기준을 다시 확인한다(스로틀은
 * src/family/role-revalidation.ts).
 *
 * 데모(local) 세션에는 서버 가구가 없으므로 이 함수를 부르지 않는다 — 호출부가
 * accessToken(실토큰)일 때만 부른다.
 */
export function getMe(token: string) {
  return requestJson<{
    user: { id: string };
    households: Array<{ id: string; name: string; role: string }>;
  }>("/me", { token });
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
 * (apps/api/src/onboarding/dto/child.dto.ts). CHILD-127: `stageMode`는 이제 허용되지만
 * **pregnant → born 단방향 전환 전용**이다(서버가 역방향·manual 전환을
 * CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED 400으로 거절, birthDate 동반 필수). 일반 편집은
 * 여전히 stageMode를 보내지 않는다 -- 전환 바디 조립은 buildUpdateChildBody의
 * transitionToStageMode 옵션(src/children/child-form.ts)이 단일 경로다.
 */
export type UpdateChildBody = {
  nickname?: string;
  dueDate?: string;
  birthDate?: string;
  manualStage?: ChildStageCode;
  stageMode?: ChildStageMode;
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
 *
 * CAT-124: `includeAll` maps to the server's `?includeAll=1`, which adds the rows that are NOT
 * offered as choices (the 8 mobile quick-tile aliases + the excel-import stub). The app asks for
 * the full list on purpose: the single shared `["categories"]` cache feeds BOTH the pickers and
 * `buildCategoryNameLookup`, and an expense already stored under an alias id would fall back to
 * "기타" in the records rows / report legend / CSV export if those rows were missing. Narrowing
 * for display happens client-side in `selectableCategories` (src/categories.ts), which honors the
 * server's `selectable` flag -- so the picker shows the canonical 12, not 19.
 */
export function listCategories(token: string, options?: { includeAll?: boolean }) {
  if (isLocalToken(token)) return local(() => localBackend.listCategories());
  const path = options?.includeAll ? "/categories?includeAll=1" : "/categories";
  return requestJson<{ categories: CategoryListItem[] }>(path, { token });
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
    /** 라운드 49 C-06: 눌러서 산 제휴 링크 id(서버 CreateExpenseDto의 미러).
     *  ⚠️ DNC-009 — 기록·정산용이며 추천 점수·정렬에 유입 금지(Expense 타입 주석 참고). */
    linkedProductLinkId?: string;
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

/**
 * CSV-124: `page`(limit/cursor)는 **선택적**이라 기존 호출부(기록 탭·홈)는 종전과 똑같이
 * 3-인자로 부르고 서버 기본 페이지(200건)를 받는다. 전량이 필요한 CSV 내보내기만
 * `limit`을 서버 상한까지 올리고 `cursor`로 다음 페이지를 잇는다
 * (src/export/expense-page-collector.ts).
 *
 * 커서는 불투명 문자열이라 그대로 URL 인코딩해 실어 보낸다 — 손상된 커서는 서버가 400.
 * 로컬 목업 경로는 limit/cursor를 무시하고 그 달 전량을 한 번에 돌려주므로(hasMore 없음)
 * 수집 루프가 첫 페이지에서 자연 종료된다.
 */
export function listExpenses(
  token: string,
  childId: string,
  yearMonth?: string,
  page: { limit?: number; cursor?: string } = {}
): Promise<ListExpensesResponse> {
  const effectiveYearMonth = yearMonth ?? currentYearMonth();
  if (isLocalToken(token)) return local(() => localBackend.listExpenses(childId, effectiveYearMonth));
  const query = [`yearMonth=${effectiveYearMonth}`];
  if (page.limit !== undefined) query.push(`limit=${page.limit}`);
  if (page.cursor) query.push(`cursor=${encodeURIComponent(page.cursor)}`);
  return requestJson<ListExpensesResponse>(`/children/${childId}/expenses?${query.join("&")}`, { token });
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
// 라운드 48 QA(P2-6): `paymentMethod`가 더해졌다 — 서버 UpdateExpenseDto가 이제 받는다
// (packages/contracts `updateExpenseRequestSchema`). 충돌 병합 화면이 결제 수단을 고르게 해 놓고
// 그 선택을 보낼 자리가 없던 구멍을 막는다. optional이라 기존 호출부는 그대로다.
// 라운드 49 C-03: `merchant`가 더해졌다 — 서버 UpdateExpenseDto가 이제 받는다. 판매처는
// 충돌 병합 화면의 비교 항목이면서(`diffExpenseFields`) 지출 상세의 편집 대상인데도 보낼
// 자리가 없어, 결제 수단과 똑같이 **고르게 해 놓고 조용히 무시**하던 필드였다.
export type UpdateExpenseBody = Partial<
  Pick<Expense, "categoryId" | "amountKrw" | "spentOn" | "itemName" | "memo" | "paymentMethod" | "merchant">
> & {
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
  /**
   * 라운드 45 UX-Z: 서버 봉투(`{ error: { code, message } }`)의 오류 코드. body는 예전부터
   * 실려 있었지만 코드를 꺼내는 일을 소비자마다 반복하면 판정이 갈라지므로 여기서 한 번만
   * 꺼낸다(봉투가 아니면 null = 모름). message는 예전 그대로 두어 기존 계약을 건드리지 않는다.
   */
  readonly code: string | null;
  constructor(status: number, body: unknown) {
    super(`Expense request failed with status ${status}`);
    this.name = "ExpenseHttpError";
    this.status = status;
    this.body = body;
    this.code = parseApiErrorEnvelope(body)?.code ?? null;
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
          endSessionAsExpired();
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
    /** 라운드 49 C-06: 위 createExpense와 같은 계약(오프라인 아웃박스 flush가 쓰는 경로).
     *  ⚠️ DNC-009 — 기록·정산용이며 추천 점수·정렬에 유입 금지. */
    linkedProductLinkId?: string;
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

/**
 * REP-128: 리포트 월간 탭 추이 차트가 그리는 막대 수. 서버 계약(`TREND_REPORT_DEFAULT_MONTHS`
 * -- packages/contracts/src/schemas.ts)의 손선언 미러다(모바일은 @wooriai/contracts에
 * 의존하지 않는다 -- 이 파일의 응답 타입들과 같은 관례). 서버 상한은 12.
 */
export const TREND_REPORT_DEFAULT_MONTHS = 6;

/**
 * REP-128: 최근 `months`개월(기본 6) 월별 합계를 한 번에. 종전 6번의 getMonthlyReport
 * 워터폴을 대체한다 -- `endYearMonth`를 생략하면 서울 기준 이번 달이 구간의 마지막 달이다.
 */
export function getTrendReport(token: string, childId: string, endYearMonth?: string, months?: number) {
  const effectiveEndYearMonth = endYearMonth ?? currentYearMonth();
  const effectiveMonths = months ?? TREND_REPORT_DEFAULT_MONTHS;
  if (isLocalToken(token)) return local(() => localBackend.getTrendReport(childId, effectiveEndYearMonth, effectiveMonths));
  return requestJson<TrendReport>(
    `/children/${childId}/reports/trend?endYearMonth=${effectiveEndYearMonth}&months=${effectiveMonths}`,
    { token }
  );
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
