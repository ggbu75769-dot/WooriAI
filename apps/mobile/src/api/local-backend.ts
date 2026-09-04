import {
  assertMoneyKrw,
  calculateChildStage,
  getSeoulMonthRange,
  getSeoulToday,
  isChildStageCode,
  isFutureSeoulDate,
  sortRecommendedItems,
  type CalculatedChildStage,
  type ChildStageCode,
  type ChildStageMode,
  type ExpenseSource,
  type ExpenseType,
  type ImportStatus,
  type ItemStatus,
  type PaymentMethod
} from "@wooriai/domain";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "../stores/persist-storage";
// CLN-131: 월/총 합계에 잡히는 행인지 판정하는 술어(DNC-015)의 단일 소스. 기록 탭이 쓰는
// reconcileMonthlyExpenses와 같은 함수를 써야 데모 세션의 홈·리포트·기록 합계가 갈리지 않는다.
// (offline/expense-list-reconciliation.ts는 React/네이티브 의존이 없어 여기서 안전하게 쓴다.)
import { countsTowardMonthlyTotal } from "../offline/expense-list-reconciliation";
import { categoryCatalog } from "../categories";
import { itemMatchesBand, type StageBandLabel } from "../items/stage-bands";
import type {
  AffiliateClickResponse,
  Budget,
  CategoryListItem,
  CategoryReport,
  Child,
  ConfirmImportResponse,
  CumulativeReport,
  Expense,
  HomeSummary,
  ImportJob,
  ImportRow,
  InviteChannel,
  InviteResponse,
  InvitePreview,
  PendingInvite,
  AcceptInviteResponse,
  ItemDetail,
  ItemSummary,
  MilestoneReport,
  MilestoneReportType,
  MonthlyReport,
  PrivacySettings,
  ProductLink,
  SettingsConfirmResponse,
  SettingsPreview,
  TrendReport,
  UndoImportResponse,
  YearlyReport
} from "./client";

// ITEM-123: 서버 ItemTab의 미러 (apps/api/src/onboarding/items-catalog.service.ts).
// "all"은 상태 필터 없는 전체 스냅샷 탭이다(B5).
type ItemTab = "now" | "soon" | "prepared" | "not_needed" | "all";

// ITEM-123 (B4): 서버 TAB_STATUSES의 미러 — gifted는 "선물로 받아 이미 손에 있다"이므로
// 준비완료 탭에 함께 담긴다(근거는 서버 쪽 주석 참고). 두 정의가 어긋나면 로컬 세션과
// 실서버가 다른 목록을 보여주므로 값 자체를 같은 형태로 둔다.
const LOCAL_TAB_STATUSES: Record<"prepared" | "not_needed", ItemStatus[]> = {
  prepared: ["prepared", "gifted"],
  not_needed: ["not_needed"]
};
import {
  LOCAL_CATEGORY_DETERGENT,
  LOCAL_CATEGORY_DIAPER,
  LOCAL_CATEGORY_FORMULA,
  LOCAL_CATEGORY_IMPORT,
  LOCAL_CHILD_ID,
  LOCAL_DAD_USER_ID,
  LOCAL_DEFAULT_BUDGET_KRW,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_USER_ID,
  localImportStubRows,
  localItemTemplateFixtures,
  localCategoryNameKo,
  localMemberFixtures,
  localProductLinkFixtures,
  localSeedExpenses
} from "./local-fixtures";

type LocalExpenseRecord = {
  id: string;
  childId: string;
  categoryId: string;
  amountKrw: number;
  spentOn: string;
  itemName: string;
  merchant: string | null;
  memo: string | null;
  paymentMethod: PaymentMethod;
  linkedItemTemplateId: string | null;
  expenseType: ExpenseType;
  source: ExpenseSource;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  // MOB-103/MOB-102 (round5a-sprint1-plan.md §2.1, §2.2): mirrors the server's optimistic-
  // concurrency `expenses.version` column -- 1 on create, +1 on every update/soft-delete. The
  // mobile offline outbox (src/offline/*) sends this back as `expectedVersion` on update/delete.
  version: number;
};

/**
 * Local mirror of the server's 409 VERSION_CONFLICT `current` payload (design doc §2.2) --
 * either the latest live expense (with version) or a soft-deleted tombstone.
 */
export type LocalConflictSnapshot =
  | (Expense & { version: number })
  | { id: string; deleted: true; version: number }
  | null;

/** Thrown by updateExpense/deleteExpense below when an `expectedVersion` no longer matches --
 * the local-session (test mode) mirror of the real API's 409 VERSION_CONFLICT response. Caught
 * and re-typed by src/api/client.ts's version-aware wrapper functions. */
export class LocalVersionConflictError extends Error {
  readonly current: LocalConflictSnapshot;
  constructor(current: LocalConflictSnapshot) {
    super("VERSION_CONFLICT");
    this.name = "LocalVersionConflictError";
    this.current = current;
  }
}

/**
 * 실서버 `children` 행의 로컬 판본 — 실계정과 같은 네 가지 단계 입력(stageMode + 예정일/
 * 출생일/수동 단계)을 그대로 들고 있다. 예전에는 `birthDate` 하나뿐이라 데모 세션의 아이는
 * 언제나 "태어난 아이"였고, 임신 중으로 시작하는 사용자를 표현할 방법이 없었다.
 *
 * `stageMode: null`은 **아직 단계 입력이 끝나지 않은 아이**다(아래 createChild 주석 참고).
 * requireChild/listChildren은 이 상태를 "아이 없음"으로 본다 — 절반만 만들어진 아이를
 * 홈·리포트·준비템에 노출하지 않기 위한 것이고, 온보딩 ONB-002가 곧바로 채운다.
 */
type LocalChildRecord = {
  id: string;
  nickname: string;
  stageMode: ChildStageMode | null;
  dueDate: string | null;
  birthDate: string | null;
  manualStage: ChildStageCode | null;
  deletedAt: string | null;
};

type LocalMemberRecord = {
  id: string;
  householdId: string;
  userId: string;
  displayName: string;
  role: "owner" | "co_parent" | "viewer" | "gift_participant";
  status: "pending" | "active" | "removed" | "left";
};

type LocalInviteRecord = {
  // FAM-121B: `id` and `revokedAt` are optional because demo sessions persisted before
  // this ticket have neither; localInviteId()/localInviteStatus() below derive sane
  // values for those older records instead of crashing the new 대기 초대 list.
  id?: string;
  token: string;
  householdId: string;
  householdName: string;
  role: "co_parent" | "viewer" | "gift_participant";
  channel: InviteChannel;
  createdAt: string;
  expiresAt: string;
  acceptedByUserId: string | null;
  revokedAt?: string | null;
};

type LocalImportJobRecord = {
  id: string;
  childId: string;
  status: ImportStatus;
  fileName: string;
  rowCount: number;
  candidateCount: number;
  importedCount: number;
  /**
   * 라운드 67 #3: 이 잡이 만든 지출 id들 — 서버의 `expenses.import_job_id`를 로컬 세션에서
   * 대신하는 값이다(로컬 지출 레코드는 서버 컬럼을 미러하지 않으므로 잡 쪽에 적는다).
   * 옛 저장본에는 없으므로 optional이고, 없으면 되돌릴 것이 없는 것으로 읽는다.
   */
  importedExpenseIds?: string[];
};

type LocalImportRowRecord = {
  id: string;
  importJobId: string;
  rowIndex: number;
  parsedDate?: string;
  parsedItemName?: string;
  parsedAmountKrw?: number;
  categoryId?: string;
  confidence: number;
  selected: boolean;
  validationStatus: string;
  userReviewed: boolean;
};

type LocalBackendState = {
  seeded: boolean;
  child: LocalChildRecord | null;
  budgets: Record<string, number>;
  expenses: LocalExpenseRecord[];
  itemStatuses: Record<string, { status: ItemStatus; expenseId: string | null }>;
  // MOB-101: mirrors the server's `children.prepared_items_set_at` -- set once the
  // prepared-items onboarding step is submitted (even with zero items checked), used by
  // onboardingStatus() below to tell "step not reached yet" apart from "step done, nothing
  // picked". Missing on already-persisted local backends (pre-MOB-101) defaults to false via
  // the initialState merge, which just means those demo sessions replay that one step.
  preparedItemsCompleted: boolean;
  members: LocalMemberRecord[];
  invites: LocalInviteRecord[];
  importJobs: LocalImportJobRecord[];
  importRows: Record<string, LocalImportRowRecord[]>;
  // 라운드 45 UX-AA: `acceptedAt`은 약관·개인정보 화면(SET-003)의 동의 내역 카드가 읽는다.
  // 실서버 Consent.acceptedAt과 같은 ISO 문자열이며, 예전에 저장된 데모 상태에는 없을 수 있어
  // 선택 필드다(그때는 날짜 없이 "동의함"만 보여 준다 -- 지어낸 날짜를 쓰지 않는다).
  consents: Array<{ type: string; version: string; accepted: boolean; acceptedAt?: string | null }>;
  accountDeletedAt: string | null;
  // MOB-102 (round5a-sprint1-plan.md §3.2): local mirror of the real API's Idempotency-Key
  // interceptor for expense creation -- maps a client-supplied idempotency key to the expense id
  // it produced, so the offline outbox replaying a create after a crash/retry never creates a
  // second expense for the same key. See createExpenseIdempotent below.
  idempotencyKeys: Record<string, string>;
};

const initialState: LocalBackendState = {
  seeded: false,
  child: null,
  budgets: {},
  expenses: [],
  itemStatuses: {},
  preparedItemsCompleted: false,
  members: [],
  invites: [],
  importJobs: [],
  importRows: {},
  consents: [],
  accountDeletedAt: null,
  idempotencyKeys: {}
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * MOB-107: `LocalExpenseRecord.version` (MOB-102/103, round5a-sprint1-plan.md §2.1/§2.2) didn't
 * exist before Sprint1 -- an expense record persisted by round4 or earlier has no `version` at
 * all. Downstream code (toExpenseDto, offline/sync-controller.ts's adoptServerExpense, the
 * `expectedVersion` optimistic-concurrency checks) all assume `version` is a number, so an
 * un-migrated `undefined` would silently corrupt version comparisons (e.g. `undefined >=
 * expense.version` is always false). Backfilling to 1 (the value every fresh expense starts at)
 * is a safe default: it only makes a stale-looking client seem "behind" by at most a real
 * server/local edit, which the existing conflict-resolution flow already handles correctly.
 */
function sanitizeLocalExpenseRecord(value: unknown): LocalExpenseRecord | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.id !== "string" || typeof value.childId !== "string" || typeof value.itemName !== "string") {
    return null;
  }
  return {
    id: value.id,
    childId: value.childId,
    categoryId: typeof value.categoryId === "string" ? value.categoryId : "",
    amountKrw: typeof value.amountKrw === "number" ? value.amountKrw : 0,
    spentOn: typeof value.spentOn === "string" ? value.spentOn : "",
    itemName: value.itemName,
    merchant: typeof value.merchant === "string" ? value.merchant : null,
    memo: typeof value.memo === "string" ? value.memo : null,
    paymentMethod: (typeof value.paymentMethod === "string" ? value.paymentMethod : "unknown") as PaymentMethod,
    linkedItemTemplateId: typeof value.linkedItemTemplateId === "string" ? value.linkedItemTemplateId : null,
    expenseType: (typeof value.expenseType === "string" ? value.expenseType : "expense") as ExpenseType,
    source: (typeof value.source === "string" ? value.source : "manual") as ExpenseSource,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
    deletedAt: typeof value.deletedAt === "string" ? value.deletedAt : null,
    // The actual backfill: anything that isn't already a finite number (missing, NaN, etc.)
    // becomes 1, matching what createExpense stamps on every fresh record.
    version: typeof value.version === "number" && Number.isFinite(value.version) ? value.version : 1
  };
}

function optionalDateOnly(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function sanitizeLocalChildRecord(value: unknown): LocalChildRecord | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.id !== "string" || typeof value.nickname !== "string") {
    return null;
  }
  const birthDate = optionalDateOnly(value.birthDate);
  const dueDate = optionalDateOnly(value.dueDate);
  const manualStage = isChildStageCode(value.manualStage) ? value.manualStage : null;
  // 저장된 블롭이 stageMode를 모르는 판본(라운드 50 이전 = birthDate만 있던 아이)일 수도 있으므로
  // 값이 없으면 실제로 들고 있는 날짜에서 되짚는다. 무엇으로도 단계를 계산할 수 없으면 null
  // (= 미완성 아이)로 두어 화면에 노출되지 않게 한다 -- 없는 날짜를 지어내지 않는다.
  const storedMode =
    value.stageMode === "pregnant" || value.stageMode === "born" || value.stageMode === "manual"
      ? value.stageMode
      : null;
  const stageMode: ChildStageMode | null =
    storedMode ?? (birthDate ? "born" : dueDate ? "pregnant" : manualStage ? "manual" : null);
  return {
    id: value.id,
    nickname: value.nickname,
    stageMode,
    dueDate,
    birthDate,
    manualStage,
    deletedAt: typeof value.deletedAt === "string" ? value.deletedAt : null
  };
}

/**
 * MOB-107: validates/repairs a persisted `wooriai-local-backend` blob field by field instead of
 * trusting the shape wholesale. Any field that doesn't look right falls back to its safe default
 * (matching `initialState`) rather than propagating a malformed value into `getHome`/`listItems`
 * (etc.), which would otherwise throw and leave the Home/준비템/리포트 screens stuck -- see the
 * "silent forever-loading" fix in app/(tabs)/index.tsx and items.tsx for the other half of this.
 * `seeded` is deliberately preserved as-is (not reset) when the rest of the shape is plausible: a
 * `false` here would make `ensureSeeded()` wipe and reseed a demo user's real expense history.
 */
function sanitizeLocalBackendState(persisted: unknown): LocalBackendState {
  if (!isPlainObject(persisted)) return initialState;

  const child = "child" in persisted ? sanitizeLocalChildRecord(persisted.child) : null;
  const expenses = Array.isArray(persisted.expenses)
    ? persisted.expenses.map(sanitizeLocalExpenseRecord).filter((record): record is LocalExpenseRecord => record !== null)
    : [];

  return {
    seeded: typeof persisted.seeded === "boolean" ? persisted.seeded : false,
    child,
    budgets: isPlainObject(persisted.budgets) ? (persisted.budgets as Record<string, number>) : {},
    expenses,
    itemStatuses: isPlainObject(persisted.itemStatuses)
      ? (persisted.itemStatuses as LocalBackendState["itemStatuses"])
      : {},
    preparedItemsCompleted: typeof persisted.preparedItemsCompleted === "boolean" ? persisted.preparedItemsCompleted : false,
    members: Array.isArray(persisted.members) ? (persisted.members as LocalMemberRecord[]) : [],
    invites: Array.isArray(persisted.invites) ? (persisted.invites as LocalInviteRecord[]) : [],
    importJobs: Array.isArray(persisted.importJobs) ? (persisted.importJobs as LocalImportJobRecord[]) : [],
    importRows: isPlainObject(persisted.importRows) ? (persisted.importRows as LocalBackendState["importRows"]) : {},
    consents: Array.isArray(persisted.consents) ? (persisted.consents as LocalBackendState["consents"]) : [],
    accountDeletedAt: typeof persisted.accountDeletedAt === "string" ? persisted.accountDeletedAt : null,
    idempotencyKeys: isPlainObject(persisted.idempotencyKeys) ? (persisted.idempotencyKeys as Record<string, string>) : {}
  };
}

export const useLocalBackendStore = create<LocalBackendState>()(
  persist(() => initialState, {
    name: "wooriai-local-backend",
    storage: createJSONStorage(() => persistStorage),
    // MOB-107: bumped from 1 -> 2 for the `version` field added to every expense record
    // (MOB-102/103) plus `preparedItemsCompleted`/`idempotencyKeys` (MOB-101/102), none of which
    // existed in round4 or earlier (all persisted at version 1) -- `migrate` backfills them.
    //
    // 실기기 피드백 1 (zero-start): 3은 **데이터 이전이 아니라 일회성 초기화**다. 버전 2 이하로
    // 저장된 로컬 백엔드는 예외 없이 "다온이" 데모 데이터(아이·시드 지출·가구 구성원·예산)를
    // 자동 생성한 세션이고, 사용자가 요청한 것은 그 데이터 없이 0에서 시작하는 것이다. 이미
    // 설치된 데모 APK를 열었을 때 예전 데모 데이터가 남아 있으면 요청 자체가 지켜지지 않으므로,
    // 옛 블롭은 필드를 옮기지 않고 initialState로 되돌린다(= 온보딩부터 다시 시작). 3 이상에서
    // 저장된 것은 사용자가 직접 입력한 기록이므로 종전대로 필드 단위로 살려 낸다.
    version: 3,
    migrate: (persisted, version) => (version < 3 ? { ...initialState } : sanitizeLocalBackendState(persisted)),
    // FIX-A(실기기): 저장소가 **비어 있던** 재수화(persisted가 undefined/null — zustand는 그때도
    // merge를 부른다)는 지금 메모리에 있는 상태를 그대로 둔다. 예전에는 이 갈래도
    // sanitizeLocalBackendState(undefined) = initialState로 흘러 **현재 상태를 통째로 덮었고**,
    // AsyncStorage 첫 기동이 느린 실기기에서 재수화가 온보딩 입력(방금 등록한 아이)보다 늦게
    // 도착하면 그 아이가 메모리에서 지워졌다 — 첫 화면 진입의 getHome이 "아이 프로필을 찾을 수
    // 없어요"로 실패하는 레이스의 절반이다(나머지 절반은 client.ts local()의 재수화 대기).
    // 저장된 블롭이 실제로 있으면 종전과 한 글자도 다르지 않게 필드 단위로 살려 낸다(MOB-107).
    merge: (persisted, current) =>
      persisted === undefined || persisted === null
        ? current
        : {
            ...current,
            ...sanitizeLocalBackendState(persisted)
          }
  })
);

function wipeLocalBackendState() {
  useLocalBackendStore.setState({
    ...initialState,
    budgets: {},
    expenses: [],
    itemStatuses: {},
    importRows: {},
    idempotencyKeys: {}
  });
}

/** Test-only helper: wipes the local backend back to the zero state a fresh install has. */
export function resetLocalBackendForTests() {
  wipeLocalBackendState();
}

/**
 * Wipes the persisted local backend store (test-mode expenses, child, budgets, etc.) and clears the
 * seeded flag. Call after an account deletion in a local test session so the next
 * ensureLocalBackendSeeded() call reseeds cleanly instead of finding stale, pre-deletion data.
 */
export function resetLocalBackend() {
  wipeLocalBackendState();
}

let localIdCounter = 0;
function generateLocalId(prefix: string): string {
  localIdCounter += 1;
  return `local-${prefix}-${Date.now().toString(36)}-${localIdCounter}`;
}

function daysInMonth(year: number, month1To12: number): number {
  return new Date(Date.UTC(year, month1To12, 0)).getUTCDate();
}

function seoulDateMinusDays(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const utcMs = Date.UTC(year, month - 1, day) - days * 86_400_000;
  const date = new Date(utcMs);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function seoulDateMinusMonths(dateOnly: string, months: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const total = year * 12 + (month - 1) - months;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  const clampedDay = Math.min(day, daysInMonth(nextYear, nextMonth));
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

/** Public init trigger, called from session.store.ts when a local test session starts. */
export function ensureLocalBackendSeeded() {
  ensureSeeded();
}

/**
 * FIX-A(실기기): **로컬 백엔드가 요청을 받을 준비가 됐는가** — 이 스토어의 persist 재수화가
 * 끝났으면 즉시 true, 아직이면 끝나는 순간 true로 resolve한다.
 *
 * 왜 필요한가: 이 파일의 조회/쓰기 함수는 전부 동기라 자기 스스로 재수화를 기다릴 수 없고,
 * AsyncStorage 첫 기동이 느린 실기기(콜드 스타트, 저사양)에서는 앱 라우팅의 3초 안전 밸브
 * (app/index.tsx)가 재수화보다 먼저 열려 **초기화가 끝나기 전의 첫 요청**이 도착할 수 있다.
 * 그 요청은 child: null인 초기 상태를 읽고 "아이 프로필을 찾을 수 없어요"로 실패한다 —
 * 사용자에게는 온보딩을 막 끝냈는데 첫 화면에서 전면 에러 카드가 뜨는 일시 오류로 보인다.
 * client.ts의 local()이 모든 로컬 세션 요청 앞에서 이 함수를 기다린다(서버 모드는 이 경로를
 * 지나지 않으므로 동작 무변).
 *
 * 밸브: zustand persist는 저장소 읽기 자체가 실패하면 onFinishHydration을 영영 부르지 않는다
 * (app/index.tsx·notification 훅들이 같은 이유로 같은 3초 밸브를 둔다). 그때는 timeoutMs 뒤
 * false로 resolve해 요청이 영원히 매달리지 않게 한다 — false는 "준비를 확인하지 못한 채
 * 진행한다"는 사실이고, local()은 그 갈래의 실패에 한해 한 번 더 기다렸다 재시도한다.
 */
export function whenLocalBackendReady(timeoutMs = 3000): Promise<boolean> {
  const persistApi = useLocalBackendStore.persist;
  // 존재 가드: persist 미들웨어가 없는(테스트 더블 등) 환경에서는 기다릴 대상이 없다.
  if (!persistApi || typeof persistApi.hasHydrated !== "function" || persistApi.hasHydrated()) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (hydrated: boolean) => {
      if (settled) return;
      settled = true;
      if (unsubscribe) unsubscribe();
      if (timer !== null) clearTimeout(timer);
      resolve(hydrated);
    };
    unsubscribe = persistApi.onFinishHydration(() => finish(true));
    timer = setTimeout(() => finish(false), timeoutMs);
    // 구독을 걸기 직전에 재수화가 끝났을 수도 있다(경합 봉합).
    if (persistApi.hasHydrated()) finish(true);
  });
}

/**
 * 로컬 세션의 가구 관리자 = 이 기기의 사용자 본인. 실서버에서는 가입 순간 가구와 owner
 * 구성원이 함께 만들어지고, 로컬 세션에는 가입이라는 서버 왕복이 없으므로 여기가 그 자리다.
 * "아빠" 같은 다른 구성원은 데모 데이터라 더 이상 만들지 않는다 -- 가족 화면은 실계정 신규
 * 가입과 똑같이 **나 혼자**로 시작하고, 초대를 수락해야 늘어난다.
 */
function localOwnerMember(): LocalMemberRecord {
  return {
    id: "local-member-self",
    householdId: LOCAL_HOUSEHOLD_ID,
    userId: LOCAL_USER_ID,
    displayName: "나",
    role: "owner",
    status: "active"
  };
}

/**
 * 실기기 피드백 1: 여기서 만드는 것은 **앱 콘텐츠뿐**이다.
 *
 * 예전에는 이 함수가 데모 아이("다온이", 생후 24개월)·시드 지출 3건·가구 구성원 2명·이번 달
 * 예산까지 자동으로 만들어 두었고, 테스트 로그인을 누르면 그 데이터가 이미 쌓인 홈으로 곧장
 * 들어갔다. 사용자가 요청한 것은 정반대다 -- 테스트 로그인도 실계정 신규 가입과 똑같이
 * **데이터 0에서 시작**하고 아이 정보는 온보딩에서 직접 입력한다.
 *
 * 그래서 사용자 데이터는 하나도 만들지 않는다. 준비템 카탈로그·카테고리·상품 링크·고지 문구는
 * 실서버의 시드(콘텐츠)에 해당하므로 그대로 남는다 -- 그것까지 비우면 준비템 탭이 동작하지
 * 않는다. 카탈로그는 상태가 아니라 상수(local-fixtures.ts)라 이 스토어에 담지도 않는다.
 *
 * 남는 유일한 "계정" 흔적은 가구 관리자 한 명(본인)이다. 위 localOwnerMember 주석 참고.
 */
function ensureSeeded() {
  const state = useLocalBackendStore.getState();
  if (state.seeded) return;

  // FIX-A(실기기): `...initialState`를 펼치지 않는다. seeded가 false인 정상 상태는 어차피
  // initialState 그대로라 결과가 같고, 유일하게 다른 경우가 **재수화가 끝나기 전의 호출**이다
  // (AsyncStorage 첫 기동 지연 — startTestSession은 동기라 기다릴 수 없다). 그때 initialState를
  // 펼치면 child: null까지 함께 쓰여 지고, persist 미들웨어가 그 지워진 상태를 곧바로 저장소에
  // 되써서 사용자가 온보딩에서 만든 아이의 블롭을 덮는다(재수화 merge는 raw set이라 되살린
  // 메모리를 다시 저장하지 않는다 — 다음 콜드 스타트에서 아이가 사라진다). seeded 표시와 가구
  // 관리자 한 명만 만든다는 이 함수의 계약(위 주석)은 그대로다.
  useLocalBackendStore.setState({
    seeded: true,
    members: [localOwnerMember()]
  });
}

/**
 * 테스트 전용: 예전 `ensureSeeded()`가 만들던 데모 데이터(아이 "다온이" + 시드 지출 + 가구
 * 구성원 2명 + 이번 달 예산)를 그대로 만들어 둔다.
 *
 * 프로덕션은 이 데이터를 절대 만들지 않는다(위 ensureSeeded 참고). 그럼에도 헬퍼를 남기는
 * 이유는, 기존 데이터 계층·여정 테스트들이 "이미 기록이 쌓인 세션"을 전제로 검증하기
 * 때문이다 -- 그 상태 자체는 사용자가 앱을 며칠 쓰면 실제로 도달하는 상태이므로 테스트의
 * arrange 단계로서 정당하다. 0에서 시작하는 동작은 `resetLocalBackendForTests()`만 부르면
 * 그대로 관찰할 수 있다.
 */
export function seedLocalDemoFixturesForTests() {
  const today = getSeoulToday();
  const yearMonth = getSeoulMonthRange(today).yearMonth;
  const birthDate = seoulDateMinusMonths(today, 24);
  const now = new Date().toISOString();

  useLocalBackendStore.setState({
    ...initialState,
    seeded: true,
    child: {
      id: LOCAL_CHILD_ID,
      nickname: "다온이",
      stageMode: "born",
      dueDate: null,
      birthDate,
      manualStage: null,
      deletedAt: null
    },
    budgets: { [yearMonth]: LOCAL_DEFAULT_BUDGET_KRW },
    expenses: localSeedExpenses.map((seed) => ({
      id: generateLocalId("expense"),
      childId: LOCAL_CHILD_ID,
      categoryId: seed.categoryId,
      amountKrw: seed.amountKrw,
      spentOn: seoulDateMinusDays(today, seed.daysAgo),
      itemName: seed.itemName,
      merchant: null,
      memo: null,
      paymentMethod: seed.paymentMethod,
      linkedItemTemplateId: null,
      expenseType: seed.expenseType,
      source: seed.source,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1
    })),
    members: localMemberFixtures.map((member) => ({ ...member }))
  });
}

function requireMoneyKrw(value: unknown): number {
  try {
    return assertMoneyKrw(value);
  } catch {
    throw new Error("금액은 0보다 큰 원화 정수만 입력할 수 있어요.");
  }
}

// Additive defense-in-depth: `isFutureSeoulDate` only checks the YYYY-MM-DD pattern and a
// lexicographic string compare, so a calendar-invalid date like "2026-02-31" would otherwise
// slip through as "not future" if today is later in the year. Mirrors the same calendar check
// the mobile date-picker UI runs client-side (see app/expenses/new.tsx) so a malformed manual
// date entry can never persist even if a client bypasses/skips its own validation.
function assertValidCalendarDate(dateOnly: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) {
    throw new Error("날짜를 다시 확인해 주세요.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const isValid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!isValid) {
    throw new Error("존재하지 않는 날짜예요.");
  }
}

/**
 * 라운드 68 A 메모 — **여기에는 과거 하한을 넣지 않는다.**
 *
 * 서버는 이번 라운드부터 20년보다 오래된 지출 날짜를 거절한다(apps/api store-shared.ts의
 * `assertExpenseDateWithinPastFloor`). 이 데모 백엔드는 그 서버를 흉내 내는 자리라 같은 규칙을
 * 여기 적을 수도 있지만, 그러지 않는 이유가 셋이다.
 *  1. **이 경로로는 그 값이 들어올 수 없다.** 데모의 유일한 쓰기 입구는 앱 폼 두 화면이고,
 *     그 폼은 저장을 시작하기 전에 하한을 본다(src/expenses/entry-form-guards.ts의
 *     `validateExpenseDateInput`). 여기 가드는 폼을 우회한 호출을 막는 자리가 아니다 —
 *     데모에는 우회할 네트워크가 없다.
 *  2. 데모는 **로그인 없이 화면을 보는 경로**다. 여기서 거절하면 픽셀락 캡처·비세션 미리보기가
 *     쓰는 고정 시드 날짜가 미래에 바뀔 때 캡처가 조용히 깨진다.
 *  3. 하한 판정을 두 벌로 두지 않는다는 것이 이 트랙의 계약이다(값은 도메인 한 곳).
 * 미래 갈래는 종전 그대로다.
 */
function assertNotFutureDate(spentOn: string) {
  let future: boolean;
  try {
    future = isFutureSeoulDate(spentOn);
  } catch {
    throw new Error("날짜를 다시 확인해 주세요.");
  }
  if (future) {
    throw new Error("미래 날짜의 지출은 저장할 수 없어요.");
  }
}

function cleanOptionalText(value?: string | null): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

/** 단계 계산에 필요한 입력이 다 갖춰진 아이인지. stageMode만 있고 날짜가 없으면 미완성이다. */
function isCompleteChild(child: LocalChildRecord | null): child is LocalChildRecord {
  if (!child || child.deletedAt) return false;
  if (child.stageMode === "pregnant") return Boolean(child.dueDate);
  if (child.stageMode === "born") return Boolean(child.birthDate);
  if (child.stageMode === "manual") return Boolean(child.manualStage);
  return false;
}

function requireChild(): LocalChildRecord {
  ensureSeeded();
  const child = useLocalBackendStore.getState().child;
  if (!isCompleteChild(child)) {
    throw new Error("아이 프로필을 찾을 수 없어요.");
  }
  return child;
}

/**
 * 실서버 toChildDto(apps/api/src/onboarding/store-shared.ts)와 **같은 갈래**로 단계를 계산한다 --
 * 임신 중이면 예정일, 태어났으면 출생일, 수동이면 고른 단계. 예전에는 갈래 없이 언제나
 * `stageMode: "born"`이었고, 그래서 데모 세션에는 임신 중인 아이가 존재할 수 없었다.
 */
function calculatedStageFor(child: LocalChildRecord): CalculatedChildStage {
  const today = getSeoulToday();
  if (child.stageMode === "pregnant" && child.dueDate) {
    return calculateChildStage({ stageMode: "pregnant", dueDate: child.dueDate, today });
  }
  if (child.stageMode === "born" && child.birthDate) {
    return calculateChildStage({ stageMode: "born", birthDate: child.birthDate, today });
  }
  if (child.stageMode === "manual" && child.manualStage) {
    return calculateChildStage({ stageMode: "manual", manualStage: child.manualStage, today });
  }
  // requireChild/isCompleteChild를 통과한 아이만 여기 오므로 도달하지 않는다. 도달했다면
  // 단계를 지어내는 대신 실패시킨다(허위 표시 금지).
  throw new Error("아이 프로필을 찾을 수 없어요.");
}

function toChildDto(child: LocalChildRecord) {
  const calculated = calculatedStageFor(child);
  return {
    id: child.id,
    nickname: child.nickname,
    currentStage: calculated.stageCode,
    stageLabel: calculated.stageLabel
  };
}

function currentStageCode(): ChildStageCode {
  return calculatedStageFor(requireChild()).stageCode;
}

function expensesForChild(childId: string, yearMonth?: string): LocalExpenseRecord[] {
  ensureSeeded();
  const range = yearMonth ? getSeoulMonthRange(yearMonth) : null;
  return useLocalBackendStore
    .getState()
    .expenses.filter((expense) => expense.childId === childId)
    .filter((expense) => !expense.deletedAt)
    .filter((expense) => !range || (expense.spentOn >= range.startInclusive && expense.spentOn < range.endExclusive))
    .sort((left, right) => right.spentOn.localeCompare(left.spentOn) || right.createdAt.localeCompare(left.createdAt));
}

/**
 * CLN-131: 합산 술어(DNC-015)는 `countsTowardMonthlyTotal` 한 곳에서만 온다.
 *
 * 데모/로컬 세션의 홈 총액·리포트는 여기서, 기록 탭의 월 합계는
 * `reconcileMonthlyExpenses`(src/offline/expense-list-reconciliation.ts)에서 나온다. 두
 * 경로가 각자 expenseType 엄격 비교를 인라인으로 들고 있으면 한쪽만 고쳐질 때 같은
 * 세션의 두 화면이 다른 총액을 보여준다 — 그래서 술어를 import해 쓴다.
 *
 * 의미 차이 없음(CLN-131 판정): `countsTowardMonthlyTotal`은 `expenseType`이 없는 레거시
 * 페이로드를 지출로 간주하지만, `LocalExpenseRecord.expenseType`은 항상 채워져 있다 —
 * createExpense가 `body.expenseType ?? "expense"`로 찍고(:689 부근),
 * sanitizeLocalExpenseRecord가 재수화 때 문자열이 아니면 `"expense"`로 되돌리며,
 * 픽스처(local-fixtures.ts)도 전부 명시한다. 따라서 데모 픽스처 렌더 결과는 그대로다.
 */
function totalExpenseKrw(expenses: LocalExpenseRecord[]): number {
  return expenses.filter((expense) => countsTowardMonthlyTotal(expense.expenseType)).reduce((sum, expense) => sum + expense.amountKrw, 0);
}

function categoryBreakdown(expenses: LocalExpenseRecord[]) {
  const byCategory = new Map<string, { categoryId: string; amountKrw: number; count: number }>();
  for (const expense of expenses.filter((record) => countsTowardMonthlyTotal(record.expenseType))) {
    const current = byCategory.get(expense.categoryId) ?? { categoryId: expense.categoryId, amountKrw: 0, count: 0 };
    current.amountKrw += expense.amountKrw;
    current.count += 1;
    byCategory.set(expense.categoryId, current);
  }
  return [...byCategory.values()].sort((left, right) => right.amountKrw - left.amountKrw);
}

function toExpenseDto(expense: LocalExpenseRecord): Expense {
  return {
    id: expense.id,
    childId: expense.childId,
    categoryId: expense.categoryId,
    amountKrw: expense.amountKrw,
    spentOn: expense.spentOn,
    itemName: expense.itemName,
    merchant: expense.merchant,
    // 라운드 48 QA(P2-6): 실서버 toExpenseDto/toExpenseSnapshot이 싣는 두 필드를 데모 세션도
    // 싣는다. 이 함수는 충돌 스냅숏(toConflictSnapshot)의 본체이기도 해서, 빠뜨리면 데모에서만
    // "두 값 나란히 보기"가 바꾼 적 없는 결제 수단을 충돌로 띄우고 서버 값을 "없음"으로 그린다.
    paymentMethod: expense.paymentMethod,
    memo: expense.memo,
    linkedItemTemplateId: expense.linkedItemTemplateId,
    expenseType: expense.expenseType,
    source: expense.source,
    version: expense.version
  };
}

/** Snapshot used for LocalVersionConflictError.current -- mirrors the server's toDeletedExpenseSnapshot
 * / toExpenseSnapshot (apps/api/src/finance/expense-snapshot.ts) for the local-session path. */
function toConflictSnapshot(expense: LocalExpenseRecord): LocalConflictSnapshot {
  if (expense.deletedAt) {
    return { id: expense.id, deleted: true, version: expense.version };
  }
  return toExpenseDto(expense);
}

/** Unlike requireExpense, does not filter out soft-deleted rows -- needed so a version-conflict
 * check against an already (soft-)deleted expense can still report the deleted tombstone as
 * `current`, matching the server's 409 contract (design doc §2.2). */
function findExpenseRaw(expenseId: string): LocalExpenseRecord | undefined {
  ensureSeeded();
  return useLocalBackendStore.getState().expenses.find((record) => record.id === expenseId);
}

function budgetKey(yearMonth: string): string {
  return getSeoulMonthRange(yearMonth).yearMonth;
}

function toBudgetDto(childId: string, yearMonth: string, amountKrw: number): Budget {
  const usedAmountKrw = totalExpenseKrw(expensesForChild(childId, yearMonth));
  return { childId, yearMonth, amountKrw, usedAmountKrw, remainingAmountKrw: amountKrw - usedAmountKrw };
}

// ---------------------------------------------------------------------------
// Categories (CAT-101/UX-5B-EXP)
// ---------------------------------------------------------------------------

/**
 * Server seed category codes for the local-only fixture category ids (see the seed taxonomy in
 * src/categories.ts). The demo seed expenses (local-fixtures.ts) and the excel-import stub rows
 * store these `LOCAL_CATEGORY_*` ids directly, so the demo category list must carry the exact
 * same ids for the edit screen's chip preselection to match them.
 */
const localOnlyCategorySeeds: Array<{ id: string; code: string }> = [
  { id: LOCAL_CATEGORY_DIAPER, code: "diaper_hygiene" },
  { id: LOCAL_CATEGORY_FORMULA, code: "feeding_babyfood" },
  { id: LOCAL_CATEGORY_DETERGENT, code: "clothes_laundry" },
  { id: LOCAL_CATEGORY_IMPORT, code: "etc" }
];

/**
 * Local-session mirror of `GET /categories` (apps/api/src/finance/categories.controller.ts;
 * contract: listCategoriesResponseSchema in packages/contracts). Returns the union of:
 *   1. the 8 quick-expense catalog entries (src/categories.ts) -- the ids every expense created
 *      through the app's own UI stores, and
 *   2. the local-only fixture categories above -- the ids the seeded demo expenses and the
 *      excel-import flow store,
 * so that in demo mode every expense's `categoryId` resolves to a chip on the edit screen.
 * Sorted by displayOrder ascending, matching the real endpoint's ordering guarantee.
 *
 * CAT-124: every demo row is `selectable: true`, and the `includeAll` switch is therefore a no-op
 * here. That is not an oversight — the demo catalog has no canonical/alias split to collapse. The
 * real server's alias rows exist only to keep the 8 hardcoded quick-tile UUIDs valid alongside a
 * DIFFERENT canonical taxonomy (12 random-UUID rows); in demo mode those 8 tiles ARE the taxonomy,
 * and the 4 fixture ids are the only other categories the demo expenses use. Marking any of them
 * `selectable: false` would delete a chip a demo expense is filed under, with nothing to absorb it.
 */
export function listCategories(): { categories: CategoryListItem[] } {
  ensureSeeded();
  const catalogCategories: CategoryListItem[] = categoryCatalog.map((entry, index) => ({
    id: entry.id,
    code: entry.code,
    name: entry.label,
    iconName: entry.icon,
    displayOrder: (index + 1) * 10,
    isSystem: true,
    active: true,
    selectable: true
  }));
  const localOnlyCategories: CategoryListItem[] = localOnlyCategorySeeds.map((seed, index) => ({
    id: seed.id,
    code: seed.code,
    name: localCategoryNameKo[seed.id] ?? "기타",
    iconName: null,
    displayOrder: 900 + (index + 1) * 10,
    isSystem: true,
    active: true,
    selectable: true
  }));
  return {
    categories: [...catalogCategories, ...localOnlyCategories].sort(
      (left, right) => left.displayOrder - right.displayOrder
    )
  };
}

// ---------------------------------------------------------------------------
// Home / expenses / budget
// ---------------------------------------------------------------------------

export function getHome(childId: string): HomeSummary {
  const child = requireChild();
  const yearMonth = getSeoulMonthRange(getSeoulToday()).yearMonth;
  const budgetAmount = useLocalBackendStore.getState().budgets[budgetKey(yearMonth)] ?? 0;
  const recentExpenses = expensesForChild(childId, undefined).slice(0, 3);

  return {
    child: toChildDto(child),
    totalExpenseKrw: totalExpenseKrw(expensesForChild(childId)),
    monthly: toBudgetDto(childId, yearMonth, budgetAmount),
    recommendedItems: listItems(childId, "now").items.slice(0, 3),
    recentExpenses: recentExpenses.map(toExpenseDto)
  };
}

export function listExpenses(childId: string, yearMonth?: string): { expenses: Expense[]; totalAmountKrw: number } {
  const expenses = expensesForChild(childId, yearMonth);
  return { expenses: expenses.map(toExpenseDto), totalAmountKrw: totalExpenseKrw(expenses) };
}

export function createExpense(
  childId: string,
  body: {
    categoryId: string;
    amountKrw: number;
    spentOn: string;
    itemName: string;
    merchant?: string;
    paymentMethod?: PaymentMethod;
    memo?: string;
    linkedItemTemplateId?: string;
    expenseType?: ExpenseType;
    source?: ExpenseSource;
  }
): Expense {
  requireChild();
  const itemName = body.itemName.trim();
  if (!itemName) {
    throw new Error("품목명을 입력해 주세요.");
  }
  assertValidCalendarDate(body.spentOn);
  assertNotFutureDate(body.spentOn);
  const amountKrw = requireMoneyKrw(body.amountKrw);
  const now = new Date().toISOString();

  const record: LocalExpenseRecord = {
    id: generateLocalId("expense"),
    childId,
    categoryId: body.categoryId,
    amountKrw,
    spentOn: body.spentOn,
    itemName,
    merchant: cleanOptionalText(body.merchant),
    memo: cleanOptionalText(body.memo),
    paymentMethod: body.paymentMethod ?? "unknown",
    linkedItemTemplateId: body.linkedItemTemplateId ?? null,
    expenseType: body.expenseType ?? "expense",
    source: body.source ?? "manual",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1
  };

  useLocalBackendStore.setState((state) => ({
    expenses: [...state.expenses, record],
    // R19-B: 데모/테스트 세션도 실제 API와 같은 "지출 기록 -> 준비템 준비 완료"
    // 고리를 갖도록 미러링한다 (서버 규칙: apps/api/src/onboarding/store-shared.ts
    // markLinkedItemPrepared). 연결이 없으면 상태 맵은 그대로 둔다.
    itemStatuses: record.linkedItemTemplateId
      ? applyLinkedItemPrepared(state.itemStatuses, record.linkedItemTemplateId, record.id)
      : state.itemStatuses
  }));
  return toExpenseDto(record);
}

/**
 * R19-B: 서버 markLinkedItemPrepared와 동일한 보존 규칙의 로컬 백엔드 판본 —
 * 사용자가 이미 정리해 둔 `gifted`/`not_needed`는 지출이 덮어쓰지 않고, 이미
 * `prepared`이면서 다른 지출이 연결돼 있으면 최초 연결을 그대로 둔다. 카탈로그에
 * 없는 itemTemplateId는(데모 데이터 불일치) 조용히 무시해 지출 기록 자체를 막지 않는다.
 */
function applyLinkedItemPrepared(
  statuses: LocalBackendState["itemStatuses"],
  itemTemplateId: string,
  expenseId: string
): LocalBackendState["itemStatuses"] {
  if (!localItemTemplateFixtures.some((template) => template.id === itemTemplateId)) return statuses;
  const existing = statuses[itemTemplateId];
  if (existing && (existing.status === "gifted" || existing.status === "not_needed")) return statuses;
  if (existing?.status === "prepared" && existing.expenseId) return statuses;
  return { ...statuses, [itemTemplateId]: { status: "prepared", expenseId } };
}

/**
 * MOB-102 (round5a-sprint1-plan.md §3.2): local-session mirror of the real API's
 * Idempotency-Key interceptor for expense creation. The offline outbox flush always sends a
 * per-mutation idempotency key; replaying the same key (e.g. after a crash between the local
 * write and the response being recorded) returns the original expense instead of creating a
 * duplicate.
 */
export function createExpenseIdempotent(
  childId: string,
  body: Parameters<typeof createExpense>[1],
  idempotencyKey: string
): Expense {
  ensureSeeded();
  const existingId = useLocalBackendStore.getState().idempotencyKeys[idempotencyKey];
  if (existingId) {
    const existing = useLocalBackendStore.getState().expenses.find((record) => record.id === existingId);
    if (existing) return toExpenseDto(existing);
  }
  const created = createExpense(childId, body);
  useLocalBackendStore.setState((state) => ({
    idempotencyKeys: { ...state.idempotencyKeys, [idempotencyKey]: created.id }
  }));
  return created;
}

function requireExpense(expenseId: string): LocalExpenseRecord {
  ensureSeeded();
  const expense = useLocalBackendStore.getState().expenses.find((record) => record.id === expenseId);
  if (!expense || expense.deletedAt) {
    throw new Error("지출 기록을 찾을 수 없어요.");
  }
  return expense;
}

export function getExpense(expenseId: string): Expense {
  return toExpenseDto(requireExpense(expenseId));
}

/**
 * `expectedVersion` (MOB-103, design doc §2.2): local-session mirror of ExpensesVersionService.
 * Omitted -> legacy/no-conflict-check behavior (unchanged from before). Provided and mismatched
 * (including against an already soft-deleted row) -> throws LocalVersionConflictError with the
 * current snapshot, exactly like the real API's 409 VERSION_CONFLICT.
 */
export function updateExpense(
  expenseId: string,
  body: Partial<
    Pick<
      Expense,
      "categoryId" | "amountKrw" | "spentOn" | "itemName" | "merchant" | "memo" | "paymentMethod" | "expenseType"
    >
  >,
  expectedVersion?: number
): Expense {
  const raw = findExpenseRaw(expenseId);
  if (!raw) {
    throw new Error("지출 기록을 찾을 수 없어요.");
  }
  if (expectedVersion !== undefined && raw.version !== expectedVersion) {
    throw new LocalVersionConflictError(toConflictSnapshot(raw));
  }

  const expense = requireExpense(expenseId);
  const updated: LocalExpenseRecord = { ...expense };

  if (body.categoryId !== undefined) updated.categoryId = body.categoryId;
  if (body.amountKrw !== undefined) updated.amountKrw = requireMoneyKrw(body.amountKrw);
  if (body.spentOn !== undefined) {
    assertValidCalendarDate(body.spentOn);
    assertNotFutureDate(body.spentOn);
    updated.spentOn = body.spentOn;
  }
  if (body.itemName !== undefined) {
    const itemName = body.itemName.trim();
    if (!itemName) throw new Error("품목명을 입력해 주세요.");
    updated.itemName = itemName;
  }
  // R49-B 후속: 실서버 PATCH가 받는 판매처를 데모/로컬 세션도 같이 받는다 -- 빠뜨리면 수정
  // 화면에서 판매처만 조용히 되돌아간다(memo와 같은 정규화: 빈 문자열은 null).
  if (body.merchant !== undefined) updated.merchant = cleanOptionalText(body.merchant ?? undefined);
  if (body.memo !== undefined) updated.memo = cleanOptionalText(body.memo ?? undefined);
  // 라운드 48 QA(P2-6): 실서버 PATCH가 결제 수단을 받게 됐으므로 데모/로컬 세션도 같이 받는다 --
  // 충돌 병합이 고른 값이 실서버에서만 반영되고 데모에서만 사라지면 두 경로가 갈린다.
  if (body.paymentMethod != null) updated.paymentMethod = body.paymentMethod;
  if (body.expenseType !== undefined) updated.expenseType = body.expenseType;
  updated.updatedAt = new Date().toISOString();
  updated.version = expense.version + 1;

  useLocalBackendStore.setState((state) => ({
    expenses: state.expenses.map((record) => (record.id === expenseId ? updated : record))
  }));
  return toExpenseDto(updated);
}

export function deleteExpense(expenseId: string, expectedVersion?: number): { success: boolean } {
  const raw = findExpenseRaw(expenseId);
  if (!raw) {
    throw new Error("지출 기록을 찾을 수 없어요.");
  }
  if (expectedVersion !== undefined && raw.version !== expectedVersion) {
    throw new LocalVersionConflictError(toConflictSnapshot(raw));
  }

  const expense = requireExpense(expenseId);
  const now = new Date().toISOString();
  useLocalBackendStore.setState((state) => ({
    expenses: state.expenses.map((record) =>
      record.id === expenseId ? { ...record, deletedAt: now, updatedAt: now, version: record.version + 1 } : record
    )
  }));
  return { success: true };
}

/**
 * Minimal local-session mirror of `GET /v1/sync/changes` (design doc §2.3). Deliberately not a
 * full keyset-paginated mirror -- MOB-102's mobile scope treats delta sync as best-effort (see
 * src/offline/sync-controller.ts's foreground-reconnect handling), so this just snapshots every
 * expense the local session currently knows about as a single page, ignoring `cursor`/`limit`.
 */
export function getSyncChanges(): {
  changes: Array<
    | { type: "expense"; op: "upsert"; data: Expense }
    | { type: "expense"; op: "delete"; id: string; version: number; deletedAt: string }
  >;
  nextCursor: string | null;
  hasMore: boolean;
} {
  ensureSeeded();
  const expenses = useLocalBackendStore.getState().expenses;
  const changes = expenses.map((record) =>
    record.deletedAt
      ? { type: "expense" as const, op: "delete" as const, id: record.id, version: record.version, deletedAt: record.deletedAt }
      : { type: "expense" as const, op: "upsert" as const, data: toExpenseDto(record) }
  );
  return { changes, nextCursor: "local-sync-cursor", hasMore: false };
}

export function getBudget(childId: string, yearMonth: string): Budget {
  ensureSeeded();
  const normalizedMonth = budgetKey(yearMonth);
  const amountKrw = useLocalBackendStore.getState().budgets[normalizedMonth];
  if (amountKrw === undefined) {
    throw new Error("월 예산을 찾을 수 없어요.");
  }
  return toBudgetDto(childId, normalizedMonth, amountKrw);
}

export function upsertBudget(childId: string, amountKrw: number, yearMonth: string): Budget {
  requireChild();
  const normalizedMonth = budgetKey(yearMonth);
  const validAmount = requireMoneyKrw(amountKrw);
  useLocalBackendStore.setState((state) => ({ budgets: { ...state.budgets, [normalizedMonth]: validAmount } }));
  return toBudgetDto(childId, normalizedMonth, validAmount);
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export function getMonthlyReport(childId: string, yearMonth: string): MonthlyReport {
  ensureSeeded();
  const normalizedMonth = budgetKey(yearMonth);
  const expenses = expensesForChild(childId, normalizedMonth);
  const budgetAmountKrw = useLocalBackendStore.getState().budgets[normalizedMonth] ?? null;
  return {
    childId,
    yearMonth: normalizedMonth,
    totalExpenseKrw: totalExpenseKrw(expenses),
    budgetAmountKrw,
    categoryTop: categoryBreakdown(expenses)
  };
}

/**
 * REP-128: local-session mirror of GET /children/:childId/reports/trend -- the demo session's
 * 6개월 추이. Assembled from the same fixture expenses getMonthlyReport folds, one month at a
 * time, so every bar matches what the demo's 월간 리포트 카드 would show for that month
 * (기록이 없는 달은 0). Month stepping is plain integer arithmetic on the `YYYY-MM-01` key so
 * a window crossing a year boundary (e.g. 2026-02 back to 2025-09) lands on the right months
 * regardless of the device timezone -- the server does the same (reporting-store.service.ts
 * trailingYearMonths).
 */
export function getTrendReport(childId: string, endYearMonth: string, months: number): TrendReport {
  ensureSeeded();
  const [endYear, endMonth] = budgetKey(endYearMonth).split("-").map(Number) as [number, number];
  return {
    childId,
    months: Array.from({ length: months }, (_, index) => {
      const absoluteMonth = endYear * 12 + (endMonth - 1) - (months - 1 - index);
      const year = Math.floor(absoluteMonth / 12);
      const month = absoluteMonth - year * 12 + 1;
      const yearMonth = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
      return { yearMonth, totalExpenseKrw: totalExpenseKrw(expensesForChild(childId, yearMonth)) };
    })
  };
}

export function getCumulativeReport(childId: string): CumulativeReport {
  ensureSeeded();
  const expenses = expensesForChild(childId).filter((expense) => countsTowardMonthlyTotal(expense.expenseType));
  const yearly = new Map<string, { year: string; amountKrw: number; count: number }>();
  for (const expense of expenses) {
    const year = expense.spentOn.slice(0, 4);
    const current = yearly.get(year) ?? { year, amountKrw: 0, count: 0 };
    current.amountKrw += expense.amountKrw;
    current.count += 1;
    yearly.set(year, current);
  }
  return {
    childId,
    totalExpenseKrw: totalExpenseKrw(expenses),
    yearly: [...yearly.values()].sort((left, right) => right.year.localeCompare(left.year))
  };
}

// REP-104: mirrors the server's period filter -- yearMonth (single month), year (whole
// year), or year+quarter; no period keeps the all-time breakdown.
export function getCategoryReport(
  childId: string,
  period?: { yearMonth?: string; year?: number; quarter?: number }
): CategoryReport {
  ensureSeeded();
  if (period?.yearMonth) {
    return { childId, categories: categoryBreakdown(expensesForChild(childId, budgetKey(period.yearMonth))) };
  }
  let expenses = expensesForChild(childId);
  if (period?.year !== undefined) {
    const startMonth = period.quarter === undefined ? 1 : (period.quarter - 1) * 3 + 1;
    const endMonthExclusive = period.quarter === undefined ? 13 : startMonth + 3;
    const startInclusive = `${period.year}-${String(startMonth).padStart(2, "0")}-01`;
    const endExclusive =
      endMonthExclusive > 12
        ? `${period.year + 1}-01-01`
        : `${period.year}-${String(endMonthExclusive).padStart(2, "0")}-01`;
    expenses = expenses.filter((expense) => expense.spentOn >= startInclusive && expense.spentOn < endExclusive);
  }
  return { childId, categories: categoryBreakdown(expenses) };
}

/** Calendar-day count in [startInclusive, endExclusive), both YYYY-MM-DD strings. */
function diffDateOnlyDays(startInclusive: string, endExclusive: string): number {
  const [sy, sm, sd] = startInclusive.split("-").map(Number);
  const [ey, em, ed] = endExclusive.split("-").map(Number);
  return Math.max(0, Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000));
}

/**
 * REP-103: local-session mirror of GET /children/:childId/reports/milestone.
 *
 * 생년월일이 없는 아이(임신 중·수동 단계)는 실서버와 같이 거절한다 -- 서버는 400
 * MILESTONE_UNAVAILABLE로 답하고, 리포트 탭은 그 실패를 "카드 숨김"으로 읽는다
 * (app/(tabs)/reports.tsx). 문구도 서버(milestone-report.service.ts)와 같게 둔다.
 *
 * 실기기 피드백 1: 예전에는 창 안에 기록이 하나도 없으면 **저장된 모든 지출**로 대신 집계하는
 * 폴백이 있었다. 시드 지출이 생후 24개월 아이의 100일 창 밖에 있어 데모 카드가 늘 비던 것을
 * 메우려던 장치인데, 이제 기록은 전부 사용자가 직접 넣은 것이라 그 폴백은 "100일 리포트"라는
 * 이름으로 100일과 무관한 지출을 합쳐 보여주는 허위 표시가 된다. 창 밖 기록은 집계하지 않는다.
 */
export function getMilestoneReport(childId: string, type: MilestoneReportType): MilestoneReport {
  const child = requireChild();
  if (!child.birthDate) {
    throw new Error(
      "아이 생년월일이 등록되어야 100일/첫돌 리포트를 만들 수 있어요. 아이 프로필에서 생년월일을 입력해 주세요."
    );
  }
  const startDate = child.birthDate;
  const windowEndExclusive =
    type === "d100" ? seoulDateMinusDays(startDate, -100) : seoulDateMinusMonths(startDate, -12);
  const today = getSeoulToday();
  const dayAfterToday = seoulDateMinusDays(today, -1);
  const coveredEndExclusive = windowEndExclusive < dayAfterToday ? windowEndExclusive : dayAfterToday;
  const partial = coveredEndExclusive < windowEndExclusive;
  const daysCovered = diffDateOnlyDays(startDate, coveredEndExclusive);

  const aggregated = expensesForChild(childId)
    .filter((expense) => countsTowardMonthlyTotal(expense.expenseType))
    .filter((expense) => expense.spentOn >= startDate && expense.spentOn < coveredEndExclusive);

  const totalKrw = totalExpenseKrw(aggregated);
  const categoryMetaById = new Map(listCategories().categories.map((category) => [category.id, category]));

  return {
    childId,
    type,
    startDate,
    endDate: seoulDateMinusDays(windowEndExclusive, 1),
    partial,
    daysCovered,
    totalKrw,
    expenseCount: aggregated.length,
    topCategories: categoryBreakdown(aggregated)
      .slice(0, 5)
      .map((entry) => ({
        categoryId: entry.categoryId,
        code: categoryMetaById.get(entry.categoryId)?.code ?? "etc",
        name: categoryMetaById.get(entry.categoryId)?.name ?? localCategoryNameKo[entry.categoryId] ?? "기타",
        totalKrw: entry.amountKrw,
        share: totalKrw > 0 ? Math.round((entry.amountKrw / totalKrw) * 1000) / 1000 : 0
      })),
    avgDailyKrw: daysCovered > 0 ? Math.round(totalKrw / daysCovered) : 0
  };
}

export function getYearlyReport(childId: string, year: number): YearlyReport {
  ensureSeeded();
  const normalizedYear = String(year);
  const monthlyTotals = Array.from({ length: 12 }, (_, index) => {
    const yearMonth = `${normalizedYear}-${String(index + 1).padStart(2, "0")}`;
    return { yearMonth, totalExpenseKrw: totalExpenseKrw(expensesForChild(childId, yearMonth)) };
  });
  return {
    childId,
    year: normalizedYear,
    totalExpenseKrw: monthlyTotals.reduce((sum, month) => sum + month.totalExpenseKrw, 0),
    monthlyTotals
  };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

function itemStatusFor(itemTemplateId: string): ItemStatus {
  ensureSeeded();
  return useLocalBackendStore.getState().itemStatuses[itemTemplateId]?.status ?? "not_prepared";
}

function requireItemTemplate(itemTemplateId: string) {
  const item = localItemTemplateFixtures.find((template) => template.id === itemTemplateId);
  if (!item) {
    throw new Error("준비템을 찾을 수 없어요.");
  }
  return item;
}

function priceBandText(priceMinKrw: number | null, priceMaxKrw: number | null): string | undefined {
  if (priceMinKrw == null && priceMaxKrw == null) return undefined;
  if (priceMinKrw != null && priceMaxKrw != null && priceMinKrw !== priceMaxKrw) {
    return `${priceMinKrw.toLocaleString("ko-KR")}~${priceMaxKrw.toLocaleString("ko-KR")}원`;
  }
  const single = priceMinKrw ?? priceMaxKrw!;
  return `${single.toLocaleString("ko-KR")}원`;
}

function toItemSummaryDto(item: (typeof localItemTemplateFixtures)[number]): ItemSummary {
  return {
    id: item.id,
    name: item.name,
    necessityLevel: item.necessityLevel,
    status: itemStatusFor(item.id),
    timingLabel: item.timingLabel,
    priceBandText: priceBandText(item.priceMinKrw, item.priceMaxKrw),
    stageCodes: item.stageCodes
  };
}

/**
 * ITEM-121: 서버 GET /children/:childId/items의 선택적 `stageBand`와 같은 의미를 로컬
 * 세션에서도 지원한다 — 밴드를 넘기면 그 시기 기준, 생략하면 아이의 현재 단계 기준
 * (기존 호출자 동작 그대로).
 */
export function listItems(
  _childId: string,
  tab: ItemTab = "now",
  stageBand?: StageBandLabel
): { items: ItemSummary[] } {
  ensureSeeded();
  const stageCode = currentStageCode();
  const inSelectedPeriod = (item: (typeof localItemTemplateFixtures)[number]) =>
    stageBand ? itemMatchesBand({ stageCodes: item.stageCodes, timingLabel: item.timingLabel }, stageBand) : item.stageCodes.includes(stageCode);

  // ITEM-123 (B5): 상태로 거르지 않는 전체 스냅샷 — 서버 tab="all"과 같은 집합.
  // F4 정합: 서버와 동일하게 stageBand를 무시해 네 탭의 합집합을 보장한다
  // (now∪soon은 밴드 무관 전체이므로 밴드로 좁히면 soon 집합을 잃는다).
  if (tab === "all") {
    return {
      items: [...localItemTemplateFixtures]
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map(toItemSummaryDto)
    };
  }

  if (tab === "prepared" || tab === "not_needed") {
    const tabStatuses = LOCAL_TAB_STATUSES[tab];
    return {
      items: localItemTemplateFixtures
        .filter((item) => tabStatuses.includes(itemStatusFor(item.id)))
        .filter((item) => (stageBand ? inSelectedPeriod(item) : true))
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map(toItemSummaryDto)
    };
  }

  const stageMatcher =
    tab === "now"
      ? (item: (typeof localItemTemplateFixtures)[number]) => inSelectedPeriod(item)
      : (item: (typeof localItemTemplateFixtures)[number]) => !inSelectedPeriod(item);

  const candidates = localItemTemplateFixtures.filter(stageMatcher).filter((item) => {
    const status = itemStatusFor(item.id);
    return status === "not_prepared" || status === "interested";
  });

  // GAP-072 트랙 D: 실서버 랭킹(apps/api/src/onboarding/item-ranking.ts rankItemsForTab)과
  // **같은 점수 입력 셋**을 넘긴다 — 예전에는 양쪽이 함께 `budgetFits: true`(전 항목 동일
  // 상수라 순서 기여 0)와 `userInterest`(status의 파생 사본이라 상태 점수와 상쇄)를 넘겼고,
  // 둘 다 도메인 입력에서 사라졌다. 찜 신호는 이제 `status` 하나에서만 나온다.
  // ⚠️ 한쪽만 늘리면 데모와 실세션의 "지금 필요" 순서가 갈린다(계약이 두 소스를 맞대 본다).
  const sorted = sortRecommendedItems(
    candidates.map((item) => ({
      id: item.id,
      stageMatches: item.stageCodes.includes(stageCode),
      necessityLevel: item.necessityLevel,
      status: itemStatusFor(item.id)
    }))
  );

  const itemById = new Map(candidates.map((item) => [item.id, item]));
  const ordered = sorted
    .map((entry) => itemById.get(entry.id))
    .filter((item): item is (typeof localItemTemplateFixtures)[number] => Boolean(item));

  return { items: ordered.map(toItemSummaryDto) };
}

export function getItemDetail(_childId: string, itemTemplateId: string): ItemDetail {
  ensureSeeded();
  const item = requireItemTemplate(itemTemplateId);
  const productLinks: ProductLink[] = localProductLinkFixtures
    .filter((link) => link.itemTemplateId === item.id)
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((link) => ({
      id: link.id,
      platform: link.platform,
      title: link.title,
      isAffiliate: link.isAffiliate,
      isSponsored: link.isSponsored,
      disclosureText: link.disclosureText ?? undefined,
      // 라운드 52 C-01: 데모도 실서버와 **같은 규칙**으로 가격을 싣는다 — 가격과 확인 시각이
      // 둘 다 있을 때만 둘 다, 아니면 두 키 자체를 뺀다(계약 productLinkSchema의 refine,
      // 서버 toProductLinkDto와 동일). 데모라고 해서 시각 없는 가격을 흘려보내면, 화면이
      // 정직 규칙을 지키는지 데모 경로에서는 확인할 수 없게 된다.
      ...(link.priceSnapshotKrw !== null && link.priceCheckedAt !== null
        ? { priceSnapshotKrw: link.priceSnapshotKrw, priceCheckedAt: link.priceCheckedAt }
        : {})
    }));

  return {
    ...toItemSummaryDto(item),
    reasonText: item.reasonText,
    skipReasonText: item.skipReasonText,
    usedSecondhandOk: item.usedSecondhandOk,
    safetyNote: item.safetyNote,
    productLinks
  };
}

export function updateItemStatus(
  _childId: string,
  itemTemplateId: string,
  status: ItemStatus,
  expenseId?: string
): ItemSummary {
  ensureSeeded();
  const item = requireItemTemplate(itemTemplateId);
  useLocalBackendStore.setState((state) => ({
    itemStatuses: { ...state.itemStatuses, [itemTemplateId]: { status, expenseId: expenseId ?? null } }
  }));
  return toItemSummaryDto(item);
}

export function clickProductLink(productLinkId: string, _childId: string, _referrerScreenId?: string): AffiliateClickResponse {
  ensureSeeded();
  const link = localProductLinkFixtures.find((record) => record.id === productLinkId);
  if (!link) {
    throw new Error("상품 링크를 찾을 수 없어요.");
  }
  return {
    clickId: generateLocalId("click"),
    redirectUrl: link.affiliateUrl ?? link.url,
    disclosureText: link.disclosureText ?? undefined
  };
}

// ---------------------------------------------------------------------------
// Household / invites
// ---------------------------------------------------------------------------

export function listHouseholdMembers(_householdId: string) {
  ensureSeeded();
  const members = useLocalBackendStore
    .getState()
    .members.filter((member) => member.status !== "removed" && member.status !== "left")
    .map((member) => ({
      id: member.id,
      householdId: member.householdId,
      userId: member.userId,
      displayName: member.displayName,
      role: member.role,
      status: member.status
    }));
  return { members };
}

export function removeHouseholdMember(householdId: string, memberId: string): { success: boolean } {
  ensureSeeded();
  const state = useLocalBackendStore.getState();
  const member = state.members.find((record) => record.householdId === householdId && record.id === memberId);
  if (!member) {
    throw new Error("가족 구성원을 찾을 수 없어요.");
  }
  if (member.userId === LOCAL_USER_ID) {
    throw new Error("본인은 삭제할 수 없어요. 가구 탈퇴를 이용해 주세요.");
  }
  useLocalBackendStore.setState((current) => ({
    members: current.members.map((record) => (record.id === memberId ? { ...record, status: "removed" } : record))
  }));
  return { success: true };
}

/** 초대 미리보기·수락 화면이 읽는 가구 이름. 아이 별명에서 만들고, 아직 없으면 중립 문구. */
function localHouseholdName(): string {
  const child = useLocalBackendStore.getState().child;
  const nickname = child && !child.deletedAt ? child.nickname.trim() : "";
  return nickname ? `${nickname} 패밀리` : "우리 가족";
}

export function createInvite(householdId: string, role: "co_parent" | "viewer" | "gift_participant", channel: InviteChannel): InviteResponse {
  ensureSeeded();
  const token = generateLocalId("invite");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const invite: LocalInviteRecord = {
    id: generateLocalId("invite-id"),
    token,
    householdId,
    // 실기기 피드백 1: 예전에는 데모 아이 이름이 박힌 "다온이 패밀리" 고정 문자열이었다.
    // 아이는 이제 사용자가 직접 만들므로 그 별명에서 가구 이름을 만든다(아직 아이가 없으면
    // 이름을 지어내지 않고 중립적인 "우리 가족").
    householdName: localHouseholdName(),
    role,
    channel,
    createdAt: now.toISOString(),
    expiresAt,
    acceptedByUserId: null,
    revokedAt: null
  };
  useLocalBackendStore.setState((state) => ({ invites: [...state.invites, invite] }));
  return { inviteUrl: `https://wooriai.app/invite/${token}`, expiresAt, householdName: invite.householdName };
}

export function findLocalInvite(token: string): LocalInviteRecord | undefined {
  return useLocalBackendStore.getState().invites.find((invite) => invite.token === token);
}

function localInviteId(invite: LocalInviteRecord) {
  return invite.id ?? invite.token;
}

function localInviteStatus(invite: LocalInviteRecord, now = Date.now()) {
  if (invite.acceptedByUserId) return "accepted" as const;
  if (invite.revokedAt) return "revoked" as const;
  if (new Date(invite.expiresAt).getTime() <= now) return "expired" as const;
  return "pending" as const;
}

/**
 * FAM-121B: mirrors the server's owner-only pending-invite listing. Like the server,
 * it exposes no token and no link — the demo backend keeps the token so it can honor
 * an accept, but the list must behave exactly like the hashed-token API so the UI
 * can't be built around a re-share that production cannot deliver.
 */
export function listHouseholdInvites(householdId: string): { invites: PendingInvite[] } {
  ensureSeeded();
  const now = Date.now();
  const invites = useLocalBackendStore
    .getState()
    .invites.filter((invite) => invite.householdId === householdId && localInviteStatus(invite, now) === "pending")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((invite) => ({
      id: localInviteId(invite),
      householdId: invite.householdId,
      role: invite.role,
      channel: invite.channel,
      status: "pending" as const,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      invitedByUserId: LOCAL_USER_ID,
      canReshareLink: false
    }));
  return { invites };
}

export function cancelHouseholdInvite(householdId: string, inviteId: string): { success: boolean } {
  ensureSeeded();
  const invite = useLocalBackendStore
    .getState()
    .invites.find((record) => record.householdId === householdId && localInviteId(record) === inviteId);
  if (!invite) {
    throw new Error("초대를 찾을 수 없어요.");
  }
  if (localInviteStatus(invite) !== "pending") {
    throw new Error("이미 사용했거나 만료된 초대예요.");
  }
  const revokedAt = new Date().toISOString();
  useLocalBackendStore.setState((state) => ({
    // 리뷰 F9-e: 조회와 같은 조건(가구 + 초대 id)으로 다시 좁힌다 -- id만 보면 다른 가구의
    // 동명 초대까지 함께 취소될 수 있다.
    invites: state.invites.map((record) =>
      record.householdId === householdId && localInviteId(record) === inviteId ? { ...record, revokedAt } : record
    )
  }));
  return { success: true };
}

export function getInvitePreview(token: string): InvitePreview {
  const invite = findLocalInvite(token);
  if (!invite) {
    throw new Error("초대 정보를 찾을 수 없어요.");
  }
  return { householdName: invite.householdName, role: invite.role, expiresAt: invite.expiresAt };
}

export function acceptInvite(token: string): AcceptInviteResponse {
  ensureSeeded();
  const invite = findLocalInvite(token);
  if (!invite) {
    throw new Error("초대 정보를 찾을 수 없어요.");
  }
  // FAM-121B: a cancelled (revoked) invite has to be as dead as an expired one here,
  // otherwise the demo backend would still honor a link the owner just took back.
  if (localInviteStatus(invite) !== "pending") {
    throw new Error("사용할 수 없는 초대 링크예요.");
  }
  const now = new Date().toISOString();
  useLocalBackendStore.setState((state) => ({
    invites: state.invites.map((record) => (record.token === token ? { ...record, acceptedByUserId: LOCAL_DAD_USER_ID } : record)),
    members: state.members.some((member) => member.userId === LOCAL_DAD_USER_ID && member.status === "active")
      ? state.members
      : [
          ...state.members,
          {
            id: generateLocalId("member"),
            householdId: invite.householdId,
            userId: LOCAL_DAD_USER_ID,
            displayName: "아빠",
            role: invite.role,
            status: "active" as const
          }
        ]
  }));
  return { household: { id: invite.householdId, name: invite.householdName, role: invite.role } };
}

// ---------------------------------------------------------------------------
// Excel import
// ---------------------------------------------------------------------------

/**
 * 서버 `ImportPipelineService.validationStatusForImportRow`의 데모 미러.
 *
 * 라운드 41 K-1 확인: 검토 가능 상태의 핵심 규칙 -- `userReviewed`가 서면 저신뢰 판정이 풀리고
 * valid가 된다는 것 -- 은 여기서도 같다(아래 `!row.userReviewed &&` 조건, 그리고
 * `updateImportRow`가 매 PATCH에서 `userReviewed: true`를 세우는 것). 즉 데모에서도 저신뢰 행을
 * 한 번 체크하면 실제로 선택되고 확정에 실린다.
 *
 * `duplicate_candidate`는 여기 없다: 데모 백엔드에는 중복 후보 탐지 자체가 없어(기존 지출과
 * 날짜+금액을 맞춰 보지 않는다) 그 상태를 만들어 낼 경로가 없다. 없는 판정을 흉내 내면 데모가
 * 서버보다 더 많은 것을 아는 척하게 되므로 만들지 않는다.
 */
function validationStatusForImportRow(row: LocalImportRowRecord): string {
  if (!row.parsedDate) return "missing_date";
  try {
    if (isFutureSeoulDate(row.parsedDate)) return "invalid_date";
  } catch {
    return "invalid_date";
  }
  if (!row.parsedItemName?.trim()) return "missing_item_name";
  try {
    assertMoneyKrw(row.parsedAmountKrw);
  } catch {
    return "invalid_amount";
  }
  if (!row.categoryId) return "missing_category";
  if (!row.userReviewed && row.confidence < 0.7) return "low_confidence_duplicate_candidate";
  return "valid";
}

function toImportRowDto(row: LocalImportRowRecord): ImportRow {
  return {
    id: row.id,
    rowIndex: row.rowIndex,
    parsedDate: row.parsedDate,
    parsedItemName: row.parsedItemName,
    parsedAmountKrw: row.parsedAmountKrw,
    categoryId: row.categoryId,
    confidence: row.confidence,
    selected: row.selected,
    // 라운드 58 통합리뷰 P2-4: 서버와 같은 자리에서 같은 선택을 한다 -- 읽기 경로도 저장된
    // 문자열을 되풀이하지 않고 **지금** 판정한다(생성·PATCH·확정과 같은 자). 이 데모 백엔드의
    // 행은 persist blob에 남으므로, 판정이 바뀐 버전에서 옛 blob을 읽는 순간이 정확히 서버가
    // 겪은 그 어긋남이다(import-pipeline.service.ts displayValidationStatusForImportRow 주석).
    validationStatus: validationStatusForImportRow(row)
  };
}

function toImportJobDto(job: LocalImportJobRecord): ImportJob {
  // 라운드 41 K-2: 서버 응답과 같은 모양 -- childId를 실어야 검수 화면의 "대상 아이" 줄이
  // 데모 세션에서도 서버와 같은 기준(잡에 박힌 아이)으로 그려진다.
  return {
    id: job.id,
    childId: job.childId,
    status: job.status,
    rowCount: job.rowCount,
    candidateCount: job.candidateCount,
    importedCount: job.importedCount
  };
}

export function createExcelImport(childId: string, fileName: string): ImportJob {
  requireChild();
  const trimmedName = fileName.trim();
  if (!trimmedName) {
    throw new Error("가져올 파일을 선택해 주세요.");
  }
  const extension = trimmedName.split(".").pop()?.toLowerCase();
  if (extension !== "csv" && extension !== "xlsx") {
    throw new Error("csv 또는 xlsx 파일만 가져올 수 있어요.");
  }

  const today = getSeoulToday();
  const jobId = generateLocalId("import-job");
  const rows: LocalImportRowRecord[] = localImportStubRows.map((stub) => {
    const base: LocalImportRowRecord = {
      id: generateLocalId("import-row"),
      importJobId: jobId,
      rowIndex: stub.rowIndex,
      parsedDate: seoulDateMinusDays(today, stub.daysAgo),
      parsedItemName: stub.itemName,
      parsedAmountKrw: stub.amountKrw,
      categoryId: LOCAL_CATEGORY_IMPORT,
      confidence: stub.confidence,
      selected: stub.selectedByDefault,
      validationStatus: "pending",
      userReviewed: false
    };
    return { ...base, validationStatus: validationStatusForImportRow(base) };
  });

  const job: LocalImportJobRecord = {
    id: jobId,
    childId,
    status: "preview_ready",
    fileName: trimmedName,
    rowCount: rows.length,
    candidateCount: rows.filter((row) => row.confidence >= 0.7).length,
    importedCount: 0
  };

  useLocalBackendStore.setState((state) => ({
    importJobs: [...state.importJobs, job],
    importRows: { ...state.importRows, [jobId]: rows }
  }));

  return toImportJobDto(job);
}

function requireImportJob(importJobId: string): LocalImportJobRecord {
  ensureSeeded();
  const job = useLocalBackendStore.getState().importJobs.find((record) => record.id === importJobId);
  if (!job) {
    throw new Error("가져오기 작업을 찾을 수 없어요.");
  }
  return job;
}

export function getImportJob(importJobId: string): ImportJob {
  return toImportJobDto(requireImportJob(importJobId));
}

export function listImportRows(importJobId: string): { rows: ImportRow[] } {
  requireImportJob(importJobId);
  const rows = useLocalBackendStore.getState().importRows[importJobId] ?? [];
  return { rows: rows.map(toImportRowDto) };
}

export function updateImportRow(
  importJobId: string,
  rowId: string,
  body: Partial<Pick<ImportRow, "selected" | "categoryId" | "parsedItemName" | "parsedAmountKrw">>
): ImportRow {
  const job = requireImportJob(importJobId);
  if (job.status !== "preview_ready") {
    throw new Error("미리보기를 더 이상 수정할 수 없어요.");
  }
  const rows = useLocalBackendStore.getState().importRows[importJobId] ?? [];
  const rowIndex = rows.findIndex((row) => row.id === rowId);
  if (rowIndex === -1) {
    throw new Error("가져오기 행을 찾을 수 없어요.");
  }

  const current = rows[rowIndex];
  const updated: LocalImportRowRecord = {
    ...current,
    categoryId: body.categoryId ?? current.categoryId,
    parsedItemName: body.parsedItemName === undefined ? current.parsedItemName : (cleanOptionalText(body.parsedItemName) ?? undefined),
    parsedAmountKrw: body.parsedAmountKrw ?? current.parsedAmountKrw,
    selected: body.selected ?? current.selected,
    userReviewed: true
  };
  updated.validationStatus = validationStatusForImportRow(updated);
  if (updated.validationStatus !== "valid") {
    updated.selected = false;
  }

  const nextRows = [...rows];
  nextRows[rowIndex] = updated;
  useLocalBackendStore.setState((state) => ({ importRows: { ...state.importRows, [importJobId]: nextRows } }));
  return toImportRowDto(updated);
}

export function confirmImport(importJobId: string, selectedRowIds: string[]): ConfirmImportResponse {
  const job = requireImportJob(importJobId);
  if (job.status !== "preview_ready") {
    throw new Error("이미 가져오기가 완료된 작업이에요.");
  }

  const selectedIdSet = new Set(selectedRowIds);
  const hasExplicitSelection = selectedIdSet.size > 0;
  const rows = useLocalBackendStore.getState().importRows[importJobId] ?? [];
  const selectedRows = rows.filter((row) => (hasExplicitSelection ? selectedIdSet.has(row.id) : row.selected));
  const importableRows = selectedRows.filter((row) => validationStatusForImportRow(row) === "valid");

  const importedExpenseIds: string[] = [];
  for (const row of importableRows) {
    const created = createExpense(job.childId, {
      categoryId: row.categoryId!,
      amountKrw: row.parsedAmountKrw!,
      spentOn: row.parsedDate!,
      itemName: row.parsedItemName!,
      paymentMethod: "unknown",
      source: "excel_import"
    });
    // 라운드 67 #3: 되돌리기가 지울 대상. 서버는 지출 행의 `import_job_id`로 세지만 로컬
    // 지출 레코드에는 그 칸이 없으므로 잡 쪽에 적는다.
    importedExpenseIds.push(created.id);
  }

  const confirmedJob: LocalImportJobRecord = {
    ...job,
    status: "confirmed",
    importedCount: importableRows.length,
    importedExpenseIds
  };
  useLocalBackendStore.setState((state) => ({
    importJobs: state.importJobs.map((record) => (record.id === importJobId ? confirmedJob : record))
  }));

  return { importedCount: importableRows.length, skippedCount: selectedRows.length - importableRows.length };
}

/**
 * 라운드 67 #3 — 데모 세션의 되돌리기. 서버와 **같은 결론**을 낸다: 그 잡이 만든 지출 중
 * 아직 살아 있는 것만 soft delete하고(version +1 — 개별 삭제와 같은 형태) 지운 건수를
 * 돌려준다. 두 번 부르면 두 번째는 0건이다(멱등).
 */
export function undoImport(importJobId: string): UndoImportResponse {
  const job = requireImportJob(importJobId);
  if (job.status !== "confirmed") {
    throw new Error("되돌릴 수 있는 가져오기가 아니에요.");
  }

  const targetIds = new Set(job.importedExpenseIds ?? []);
  const now = new Date().toISOString();
  // 세는 것과 쓰는 것을 나눈다 — set 콜백 안에서 세면 그 콜백이 몇 번 도는지에 건수가 매인다.
  const doomedIds = new Set(
    useLocalBackendStore
      .getState()
      .expenses.filter((record) => targetIds.has(record.id) && !record.deletedAt)
      .map((record) => record.id)
  );
  useLocalBackendStore.setState((state) => ({
    expenses: state.expenses.map((record) =>
      doomedIds.has(record.id) ? { ...record, deletedAt: now, updatedAt: now, version: record.version + 1 } : record
    )
  }));
  return { deletedCount: doomedIds.size };
}

// ---------------------------------------------------------------------------
// Consents / onboarding-adjacent
// ---------------------------------------------------------------------------

/**
 * 라운드 65 B(#4): 데모 GET /consents. 실서버와 같은 정의 한 벌(LOCAL_CONSENT_DEFINITIONS)에
 * 데모 상태가 실제로 기록한 동의 여부·동의일을 얹어 돌려준다 -- 앱은 여기서 받은 type·version을
 * 그대로 되돌려주므로, 데모 경로에도 버전 리터럴이 남지 않는다.
 */
export function listConsents(): { consents: NonNullable<PrivacySettings["consents"]> } {
  ensureSeeded();
  return { consents: localConsentStates() };
}

/**
 * 데모 PUT /consents. 실서버 upsertConsents와 같은 규칙이다:
 * - **정의에 있는 type + version만** 반영한다(모르는 항목은 조용히 무시).
 * - 동의하면 동의 시각을 남기고, 철회하면 지운다(라운드 45 UX-AA -- 동의 내역 카드가 데모
 *   세션에서도 실제 날짜를 보여줄 수 있게 하는 유일한 근거다).
 * - 넘겨받은 항목만 건드린다(선택 동의 스위치 하나를 끄는 것이 필수 동의를 지우면 안 된다).
 *
 * 인자를 생략하면 **필수 항목 전부를 동의**로 본다 -- 로그인 직후의 종전 동작이고, 여기서도
 * 버전은 정의에서 읽는다.
 */
export function upsertConsents(
  consents?: ReadonlyArray<{ type: string; version: string; accepted: boolean }>
): { success: boolean } {
  ensureSeeded();
  const acceptedAt = new Date().toISOString();
  const incoming =
    consents ??
    LOCAL_CONSENT_DEFINITIONS.filter((definition) => definition.required).map((definition) => ({
      type: definition.type as string,
      version: definition.version as string,
      accepted: true
    }));
  useLocalBackendStore.setState((state) => {
    const next = [...state.consents];
    for (const entry of incoming) {
      const known = LOCAL_CONSENT_DEFINITIONS.some(
        (definition) => definition.type === entry.type && definition.version === entry.version
      );
      if (!known) continue;
      const record = {
        type: entry.type,
        version: entry.version,
        accepted: entry.accepted,
        acceptedAt: entry.accepted ? acceptedAt : null
      };
      const index = next.findIndex((saved) => saved.type === entry.type && saved.version === entry.version);
      if (index >= 0) next[index] = record;
      else next.push(record);
    }
    return { consents: next };
  });
  return { success: true };
}

/**
 * 실기기 피드백 1: 이제 진짜로 **아이를 만든다**. 예전에는 시드가 이미 만들어 둔 "다온이"의
 * 이름만 바꿔 줬고, 그래서 온보딩 ONB-002를 지나도 아이는 언제나 데모 아이였다.
 *
 * 단계 입력(stageMode·예정일/출생일/수동 단계)이 여기 없는 이유: client.ts의 로컬 분기가
 * `createChild(token, body)`에서 `{ nickname }`만 로컬 백엔드로 넘긴다. 그래서 아이는 단계
 * 미설정(stageMode: null) 상태로 만들어지고, 온보딩이 곧바로 `updateChild`로 나머지를 채운다
 * (src/onboarding/child-create.ts 참고). 미설정 아이는 requireChild/listChildren이 "없음"으로
 * 보므로 그 사이에 절반짜리 아이가 화면에 나오지 않는다.
 *
 * 로컬 백엔드는 아이를 한 명만 들 수 있어, 이미 아이가 있으면 두 번째를 만드는 대신 그 한
 * 자리를 **통째로 새 프로필로 교체**한다(이름과 단계 입력이 함께 초기화된다). 예전처럼 이름만
 * 바꾸고 예전 단계 입력을 남겨 두면, 온보딩을 중간에 끊고 다시 시작한 사용자가 이번엔 다른
 * 시기를 골랐을 때 아래 updateChild의 전환 규칙(임신 중 → 태어남만 허용)에 걸려 저장 자체가
 * 막히는 막다른 길이 생긴다. 설정 화면이 데모 세션에서 아이 추가를 아예 열지 않는 이유도
 * 이것이다(app/settings/children.tsx의 isDemoSession) -- 데모에서 "추가"는 교체다.
 */
export function createChild(body: { nickname: string }): { id: string } {
  ensureSeeded();
  const nickname = body.nickname.trim();
  if (!nickname) {
    throw new Error("태명 또는 별명을 입력해 주세요.");
  }
  useLocalBackendStore.setState({
    child: {
      id: LOCAL_CHILD_ID,
      nickname,
      stageMode: null,
      dueDate: null,
      birthDate: null,
      manualStage: null,
      deletedAt: null
    }
  });
  return { id: LOCAL_CHILD_ID };
}

/**
 * MOB-118: full-detail child DTO matching the real API's GET /children entry (`Child` in
 * client.ts). The local backend keeps a single child, whose stageMode is whatever the user
 * chose in onboarding (임신 중 / 태어남 / 직접 선택).
 */
function toFullChildDto(child: LocalChildRecord): Child {
  const calculated = calculatedStageFor(child);
  return {
    id: child.id,
    householdId: LOCAL_HOUSEHOLD_ID,
    nickname: child.nickname,
    // isCompleteChild를 통과한 아이만 이 함수에 온다(= stageMode가 null이 아니다).
    stageMode: child.stageMode as ChildStageMode,
    dueDate: child.dueDate,
    birthDate: child.birthDate,
    manualStage: child.manualStage,
    currentStage: calculated.stageCode,
    stageLabel: calculated.stageLabel
  };
}

/** MOB-118: local mirror of GET /children. */
export function listChildren(): { children: Child[] } {
  ensureSeeded();
  const child = useLocalBackendStore.getState().child;
  return { children: isCompleteChild(child) ? [toFullChildDto(child)] : [] };
}

/**
 * 실기기 피드백 1: 이 기기의 로컬 세션이 온보딩에서 아이를 만들었는지 -- 만들었으면 그 id.
 *
 * 라우팅 판정용 순수 조회다(요청 0건). 테스트 로그인도 실계정처럼 아이 없이 시작하므로,
 * app/index.tsx와 session.store.ts는 "고정된 데모 아이 id"를 가정하는 대신 이 값을 본다.
 */
export function localChildId(): string | null {
  ensureSeeded();
  const child = useLocalBackendStore.getState().child;
  return isCompleteChild(child) ? child.id : null;
}

/**
 * 실서버 normalizeChildInput(apps/api/src/onboarding/onboarding-core.service.ts)의 로컬 판본 --
 * 모드별로 반드시 있어야 하는 입력을 같은 문구로 요구한다. 온보딩 화면도 같은 문구를 쓰므로
 * (src/children/child-form.ts) 데모와 실세션이 다른 말을 하지 않는다.
 */
function assertChildStageInput(input: {
  stageMode: ChildStageMode;
  dueDate: string | null;
  birthDate: string | null;
  manualStage: ChildStageCode | null;
}) {
  if (input.stageMode === "pregnant" && !input.dueDate) {
    throw new Error("출산 예정일을 입력해 주세요.");
  }
  if (input.stageMode === "born" && !input.birthDate) {
    throw new Error("아이 생년월일을 입력해 주세요.");
  }
  if (input.stageMode === "manual" && !input.manualStage) {
    throw new Error("아이 단계를 선택해 주세요.");
  }
}

/**
 * MOB-118 / CHILD-127: local mirror of PATCH /children/:childId.
 *
 * 단계 전환 규칙은 실서버와 같다 -- `pregnant → born` 한 방향만 허용하고 그때 출생일이 같은
 * 요청에 함께 와야 한다. 단 하나 다른 점은 **단계 미설정 아이의 최초 설정**을 허용한다는
 * 것이다: 로컬 세션에서는 createChild가 별명만 받으므로(위 주석) 온보딩이 곧바로 이 경로로
 * 나머지 단계 입력을 채운다. 그건 전환이 아니라 생성의 뒷부분이다.
 */
export function updateChild(
  childId: string,
  body: { nickname?: string; stageMode?: string; dueDate?: string; birthDate?: string; manualStage?: string }
): Child {
  ensureSeeded();
  const child = useLocalBackendStore.getState().child;
  if (!child || child.deletedAt || child.id !== childId) {
    throw new Error("아이 프로필을 찾을 수 없어요.");
  }
  if (body.birthDate !== undefined && isFutureSeoulDate(body.birthDate)) {
    throw new Error("출생일은 오늘보다 미래일 수 없어요.");
  }

  const requestedMode =
    body.stageMode === "pregnant" || body.stageMode === "born" || body.stageMode === "manual"
      ? body.stageMode
      : undefined;
  const nextStageMode: ChildStageMode | null = requestedMode ?? child.stageMode;
  if (
    requestedMode !== undefined &&
    child.stageMode !== null &&
    requestedMode !== child.stageMode &&
    !(child.stageMode === "pregnant" && requestedMode === "born")
  ) {
    // 실서버 onboarding-core.service.ts(CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED)와 **글자까지**
    // 같은 문장이다 -- 같은 거절을 데모와 실세션이 다른 말로 설명하면 그 자체가 어긋남이다.
    throw new Error("아이 상태는 '임신 중'에서 '태어났어요'로만 바꿀 수 있어요.");
  }

  const next: LocalChildRecord = {
    ...child,
    nickname: body.nickname !== undefined ? body.nickname.trim() || child.nickname : child.nickname,
    stageMode: nextStageMode,
    dueDate: body.dueDate ?? child.dueDate,
    birthDate: body.birthDate ?? child.birthDate,
    manualStage: isChildStageCode(body.manualStage) ? body.manualStage : child.manualStage
  };
  if (next.stageMode === null) {
    throw new Error("아이 단계를 선택해 주세요.");
  }
  assertChildStageInput({ ...next, stageMode: next.stageMode });

  useLocalBackendStore.setState({ child: next });
  return toFullChildDto(next);
}

/**
 * MOB-101: local-backend mirror of the real API's `GET /onboarding/status` (see
 * OnboardingStoreService.onboardingStatus on the server) so the demo/test-mode path exercises
 * the same {completed, nextStep, canRestart, summary} contract as a real session, even though
 * the standalone test-login flow currently bypasses onboarding entirely via `isTestSession`
 * (see session.store.ts / app/index.tsx).
 */
export function onboardingStatus(): {
  completed: boolean;
  nextStep: "consents" | "child-profile" | "prepared-items" | "budget" | "home";
  canRestart: boolean;
  summary: {
    consentsAccepted: boolean;
    child: { id: string; nickname: string; stageMode: string; currentStage: string; stageLabel: string } | null;
    preparedItemsCount: number | null;
    budget: { yearMonth: string; amountKrw: number } | null;
  };
} {
  ensureSeeded();
  const state = useLocalBackendStore.getState();
  const consentsAccepted =
    state.consents.some((consent) => consent.type === "terms" && consent.accepted) &&
    state.consents.some((consent) => consent.type === "privacy" && consent.accepted);

  if (!consentsAccepted) {
    return {
      completed: false,
      nextStep: "consents",
      canRestart: true,
      summary: { consentsAccepted: false, child: null, preparedItemsCount: null, budget: null }
    };
  }

  const child = isCompleteChild(state.child) ? state.child : null;
  if (!child) {
    return {
      completed: false,
      nextStep: "child-profile",
      canRestart: true,
      summary: { consentsAccepted: true, child: null, preparedItemsCount: null, budget: null }
    };
  }

  const childSummary = { ...toChildDto(child), stageMode: child.stageMode as ChildStageMode };
  if (!state.preparedItemsCompleted) {
    return {
      completed: false,
      nextStep: "prepared-items",
      canRestart: false,
      summary: { consentsAccepted: true, child: childSummary, preparedItemsCount: null, budget: null }
    };
  }

  const preparedItemsCount = Object.keys(state.itemStatuses).length;
  const yearMonth = getSeoulMonthRange(getSeoulToday()).yearMonth;
  const amountKrw = state.budgets[yearMonth];
  if (amountKrw === undefined) {
    return {
      completed: false,
      nextStep: "budget",
      canRestart: false,
      summary: { consentsAccepted: true, child: childSummary, preparedItemsCount, budget: null }
    };
  }

  return {
    completed: true,
    nextStep: "home",
    canRestart: false,
    summary: { consentsAccepted: true, child: childSummary, preparedItemsCount, budget: { yearMonth, amountKrw } }
  };
}

/**
 * 라운드 45 O-3: `updatedCount`는 실서버와 같은 뜻 — **실제로 반영된 건수**다
 * (apps/api/src/onboarding/onboarding-core.service.ts의 validIds 필터). 예전에는 고유 id 개수를
 * 그대로 돌려줘서, 픽스처에 없는 id만 보내도 아무것도 바뀌지 않은 채 "n건 반영"이라는 허위 성공이
 * 나왔다 — 데모 세션에서만 실세션과 다른 수를 말하는 셈이었다. 단계 완료 표시는 종전대로 0건이어도
 * 남긴다(실서버의 preparedItemsSetAt과 같은 규칙).
 */
export function setPreparedItems(_childId: string, itemTemplateIds: string[]): { updatedCount: number } {
  ensureSeeded();
  const applied = [...new Set(itemTemplateIds)].filter((itemTemplateId) =>
    localItemTemplateFixtures.some((item) => item.id === itemTemplateId)
  );
  useLocalBackendStore.setState((state) => {
    const nextStatuses = { ...state.itemStatuses };
    for (const itemTemplateId of applied) {
      nextStatuses[itemTemplateId] = { status: "prepared", expenseId: null };
    }
    return { itemStatuses: nextStatuses, preparedItemsCompleted: true };
  });
  return { updatedCount: applied.length };
}

// ---------------------------------------------------------------------------
// Settings / privacy
// ---------------------------------------------------------------------------

/**
 * 라운드 45 UX-AA: 삭제·탈퇴 미리보기의 "진행하면 이렇게 돼요" 줄.
 *
 * 실서버(apps/api/src/settings/settings.controller.ts · onboarding-core.service.ts)와 **같은
 * 문장**이어야 한다 -- 데모 세션과 실세션이 같은 화면에서 다른 말을 하면 그 자체가 오표기다.
 * 예전에는 영문 원문("account access stops" 등)을 그대로 그렸다(DNC-018 위반).
 * 세 배열을 상수로 뽑은 이유: 아래 목록·미리보기 두 곳이 같은 문장을 각각 들고 있었다.
 */
const ACCOUNT_DELETE_IMPACT = ["이 계정으로는 다시 로그인할 수 없어요", "참여 중인 가구에서 모두 나가게 돼요"];
const HOUSEHOLD_LEAVE_IMPACT = ["이 가구에 공유된 아이 기록을 볼 수 없어요"];
// 아이 삭제 미리보기는 실서버 `childProfileDeleteImpact`(onboarding-core.service.ts)와 글자까지
// 같게 둔다. 예전에는 뜻만 같고 문장이 달라("아이 프로필을 볼 수 없어요" / "이 아이의 지출 기록이
// 리포트에서 빠져요") 위 주석의 "같은 문장" 약속이 이 배열에서만 깨져 있었다.
const CHILD_DELETE_IMPACT = ["아이 프로필을 더는 볼 수 없어요", "관련 지출 기록이 리포트에서 제외돼요"];

/**
 * GAP-070 D 거울: 관리자가 가구를 떠날 때만 서는 한 줄.
 *
 * 실서버 `LAST_OWNER_LEAVE_IMPACT_LINE`(apps/api/src/settings/settings.controller.ts)과
 * **글자까지 같다** -- 위 주석의 "같은 문장" 약속 그대로다. 사실 근거(관리자가 나가면 그
 * 가구에 owner 역할이 아무도 없고, 역할을 넘기는 엔드포인트가 0건이라 되돌릴 수 없다)는
 * 그 파일의 주석에 적혀 있다.
 */
const LAST_OWNER_LEAVE_IMPACT_LINE =
  "관리자인 내가 나가면 그 가족에 관리자가 없어져서 새 구성원 초대와 구성원 관리를 아무도 할 수 없어요";

/**
 * 실서버가 `AuthenticatedUser.households`의 역할을 읽는 자리(새 조회 0건)의 거울. 데모
 * 세션에서 그 값에 해당하는 것은 이 기기 사용자의 구성원 행이다(localOwnerMember).
 * 탈퇴를 마친 뒤에는 그 행이 `left`가 되므로 활성 구성원만 본다 -- 실서버의
 * `householdsForUser`가 `status: "active"`만 싣는 것과 같은 규칙이다.
 */
function localUserIsHouseholdOwner(householdId?: string): boolean {
  return useLocalBackendStore
    .getState()
    .members.some(
      (member) =>
        member.userId === LOCAL_USER_ID &&
        member.status === "active" &&
        member.role === "owner" &&
        (householdId === undefined || member.householdId === householdId)
    );
}

/**
 * 데모 동의 정의: 실서버 `consentDefinitions`(apps/api/src/onboarding/onboarding-core.service.ts)
 * 와 같은 세 가지. 동의 여부·동의일은 데모 상태(upsertConsents)가 실제로 기록한 값만 싣는다 --
 * 누른 적 없는 동의를 "동의함"으로 보이게 하지 않는다.
 */
const LOCAL_CONSENT_DEFINITIONS = [
  { type: "terms", version: "2026-07-06", required: true, title: "서비스 이용약관" },
  { type: "privacy", version: "2026-07-06", required: true, title: "개인정보 처리 동의" },
  { type: "marketing", version: "2026-07-06", required: false, title: "소식 알림 동의" }
] as const;

/**
 * 정의 + 저장된 동의 상태. GET /consents(listConsents)와 GET /settings/privacy가 **같은 한 벌**을
 * 읽는다 -- 두 화면이 같은 사실을 서로 다르게 말하지 않게 하는 자리다.
 */
function localConsentStates(): NonNullable<PrivacySettings["consents"]> {
  const saved = useLocalBackendStore.getState().consents;
  return LOCAL_CONSENT_DEFINITIONS.map((definition) => {
    const record = saved.find(
      (consent) => consent.type === definition.type && consent.version === definition.version
    );
    return {
      ...definition,
      accepted: record?.accepted ?? false,
      acceptedAt: record?.acceptedAt ?? null
    };
  });
}

export function getPrivacySettings(): PrivacySettings {
  ensureSeeded();
  return {
    consents: localConsentStates(),
    flows: [
      {
        id: "account_delete",
        title: "계정 삭제",
        impact: ACCOUNT_DELETE_IMPACT,
        confirmationText: "DELETE ACCOUNT"
      },
      {
        id: "household_leave",
        title: "가구 탈퇴",
        impact: HOUSEHOLD_LEAVE_IMPACT,
        confirmationText: "LEAVE HOUSEHOLD"
      },
      {
        id: "child_profile_delete",
        title: "아이 프로필 삭제",
        impact: CHILD_DELETE_IMPACT,
        confirmationText: "DELETE CHILD"
      }
    ]
  };
}

function assertConfirmation(actual: string, expected: string) {
  if (actual !== expected) {
    throw new Error("확인 문구가 일치하지 않아요.");
  }
}

export function previewChildProfileDeletion(_childId: string): SettingsPreview {
  requireChild();
  return {
    flowId: "child_profile_delete",
    requiresSecondStep: true,
    confirmationText: "DELETE CHILD",
    impact: CHILD_DELETE_IMPACT
  };
}

/**
 * 라운드 49 QA(P2-1): 아이를 지우면 **그 아이 스코프의 상태를 전부** 함께 비운다.
 *
 * 로컬 백엔드의 아이 자리는 하나이고 `createChild`가 언제나 같은 `LOCAL_CHILD_ID`로 새
 * 프로필을 만든다(위 createChild 주석). 그래서 예산(budgets)·준비 상태(itemStatuses)·준비물
 * 단계 완료 표시(preparedItemsCompleted)·멱등키(idempotencyKeys)를 남겨 두면, 삭제 뒤 새로
 * 만든 **다른 아이**에게 이전 아이의 값이 그대로 달라붙는다 -- 예산 화면은 설정한 적 없는
 * 금액을, 준비템 탭은 체크한 적 없는 준비율을, 온보딩은 이미 지난 단계를 말한다. 사용자가
 * 지운 데이터가 다른 이름표를 달고 되살아나는 셈이라 그 자체가 허위 표시다.
 *
 * 지출은 종전대로 soft delete(deletedAt)로 둔다 -- 실서버(DNC-014)와 같은 규칙이고, 조회는
 * 전부 deletedAt으로 거르므로 새 아이의 합계에 섞이지 않는다. 멱등키는 그 지워진 지출 id를
 * 가리키므로 함께 비운다(재생 시 죽은 행을 되돌려주지 않게).
 */
export function confirmChildProfileDeletion(childId: string, confirmationText: string): SettingsConfirmResponse {
  assertConfirmation(confirmationText, "DELETE CHILD");
  requireChild();
  const now = new Date().toISOString();
  useLocalBackendStore.setState((state) => ({
    child: state.child ? { ...state.child, deletedAt: now } : state.child,
    expenses: state.expenses.map((expense) =>
      expense.childId === childId ? { ...expense, deletedAt: now, updatedAt: now } : expense
    ),
    budgets: {},
    itemStatuses: {},
    preparedItemsCompleted: false,
    idempotencyKeys: {}
  }));
  return { success: true, flowId: "child_profile_delete" };
}

export function previewHouseholdLeave(householdId: string): SettingsPreview {
  ensureSeeded();
  return {
    flowId: "household_leave",
    requiresSecondStep: true,
    confirmationText: "LEAVE HOUSEHOLD",
    // GAP-070 D 거울: 실서버와 같이 **요청자의 역할에서 파생**한다(정적 리터럴 금지).
    // 비관리자 데모 세션에서는 종전과 바이트 단위로 같은 배열이다.
    impact: localUserIsHouseholdOwner(householdId)
      ? [...HOUSEHOLD_LEAVE_IMPACT, LAST_OWNER_LEAVE_IMPACT_LINE]
      : HOUSEHOLD_LEAVE_IMPACT
  };
}

export function confirmHouseholdLeave(householdId: string, confirmationText: string): SettingsConfirmResponse {
  assertConfirmation(confirmationText, "LEAVE HOUSEHOLD");
  ensureSeeded();
  useLocalBackendStore.setState((state) => ({
    members: state.members.map((member) =>
      member.householdId === householdId && member.userId === LOCAL_USER_ID
        ? { ...member, status: "left" as const }
        : member
    )
  }));
  return { success: true, flowId: "household_leave" };
}

export function previewAccountDeletion(): SettingsPreview {
  ensureSeeded();
  return {
    flowId: "account_delete",
    requiresSecondStep: true,
    confirmationText: "DELETE ACCOUNT",
    // GAP-070 D 거울: 관리자인 가구가 하나라도 있으면 한 줄(실서버 accountDeletePreview와 같다).
    impact: localUserIsHouseholdOwner() ? [...ACCOUNT_DELETE_IMPACT, LAST_OWNER_LEAVE_IMPACT_LINE] : ACCOUNT_DELETE_IMPACT
  };
}

export function confirmAccountDeletion(confirmationText: string): SettingsConfirmResponse {
  assertConfirmation(confirmationText, "DELETE ACCOUNT");
  ensureSeeded();
  useLocalBackendStore.setState({ accountDeletedAt: new Date().toISOString() });
  return { success: true, flowId: "account_delete" };
}
