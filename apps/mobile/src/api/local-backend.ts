import {
  assertMoneyKrw,
  calculateChildStage,
  getSeoulMonthRange,
  getSeoulToday,
  isFutureSeoulDate,
  sortRecommendedItems,
  type ChildStageCode,
  type ExpenseSource,
  type ExpenseType,
  type ImportStatus,
  type ItemStatus,
  type PaymentMethod
} from "@wooriai/domain";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "../stores/persist-storage";
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
  YearlyReport
} from "./client";

type ItemTab = "now" | "soon" | "prepared" | "not_needed";
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

type LocalChildRecord = {
  id: string;
  nickname: string;
  birthDate: string;
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
  consents: Array<{ type: string; version: string; accepted: boolean }>;
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

function sanitizeLocalChildRecord(value: unknown): LocalChildRecord | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.id !== "string" || typeof value.nickname !== "string" || typeof value.birthDate !== "string") {
    return null;
  }
  return {
    id: value.id,
    nickname: value.nickname,
    birthDate: value.birthDate,
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
    version: 2,
    migrate: (persisted) => sanitizeLocalBackendState(persisted),
    merge: (persisted, current) => ({
      ...current,
      ...sanitizeLocalBackendState(persisted)
    })
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

/** Test-only helper: wipes the local backend so the next call reseeds from fixtures. */
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

/** Public seed trigger, called from session.store.ts when a local test session starts. */
export function ensureLocalBackendSeeded() {
  ensureSeeded();
}

function ensureSeeded() {
  const state = useLocalBackendStore.getState();
  if (state.seeded) return;

  const today = getSeoulToday();
  const yearMonth = getSeoulMonthRange(today).yearMonth;
  const birthDate = seoulDateMinusMonths(today, 24);

  const expenses: LocalExpenseRecord[] = localSeedExpenses.map((seed) => {
    const now = new Date().toISOString();
    return {
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
    };
  });

  const members: LocalMemberRecord[] = localMemberFixtures.map((member) => ({ ...member }));

  useLocalBackendStore.setState({
    seeded: true,
    child: { id: LOCAL_CHILD_ID, nickname: "다온이", birthDate, deletedAt: null },
    budgets: { [yearMonth]: LOCAL_DEFAULT_BUDGET_KRW },
    expenses,
    itemStatuses: {},
    members,
    invites: [],
    importJobs: [],
    importRows: {},
    consents: [],
    accountDeletedAt: null,
    idempotencyKeys: {}
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

function requireChild(): LocalChildRecord {
  ensureSeeded();
  const child = useLocalBackendStore.getState().child;
  if (!child || child.deletedAt) {
    throw new Error("아이 프로필을 찾을 수 없어요.");
  }
  return child;
}

function toChildDto(child: LocalChildRecord) {
  const calculated = calculateChildStage({ stageMode: "born", birthDate: child.birthDate, today: getSeoulToday() });
  return {
    id: child.id,
    nickname: child.nickname,
    currentStage: calculated.stageCode,
    stageLabel: calculated.stageLabel
  };
}

function currentStageCode(): ChildStageCode {
  const child = requireChild();
  return calculateChildStage({ stageMode: "born", birthDate: child.birthDate, today: getSeoulToday() }).stageCode;
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

function totalExpenseKrw(expenses: LocalExpenseRecord[]): number {
  return expenses.filter((expense) => expense.expenseType === "expense").reduce((sum, expense) => sum + expense.amountKrw, 0);
}

function categoryBreakdown(expenses: LocalExpenseRecord[]) {
  const byCategory = new Map<string, { categoryId: string; amountKrw: number; count: number }>();
  for (const expense of expenses.filter((record) => record.expenseType === "expense")) {
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
    memo: expense.memo,
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
    active: true
  }));
  const localOnlyCategories: CategoryListItem[] = localOnlyCategorySeeds.map((seed, index) => ({
    id: seed.id,
    code: seed.code,
    name: localCategoryNameKo[seed.id] ?? "기타",
    iconName: null,
    displayOrder: 900 + (index + 1) * 10,
    isSystem: true,
    active: true
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
  body: Partial<Pick<Expense, "categoryId" | "amountKrw" | "spentOn" | "itemName" | "memo" | "expenseType">>,
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
  if (body.memo !== undefined) updated.memo = cleanOptionalText(body.memo ?? undefined);
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

export function getCumulativeReport(childId: string): CumulativeReport {
  ensureSeeded();
  const expenses = expensesForChild(childId).filter((expense) => expense.expenseType === "expense");
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
 * The demo child's birthDate is seeded ~24 months ago while the demo expenses are seeded
 * within the last few days (local-fixtures.ts `daysAgo`), so the true milestone window
 * [birthDate, birthDate+100d/1y) contains no fixture expenses. When that happens the
 * aggregation falls back to every stored (non-deleted, expenseType "expense") record so
 * the demo preview still shows a representative 100일 리포트 instead of an empty card.
 */
export function getMilestoneReport(childId: string, type: MilestoneReportType): MilestoneReport {
  const child = requireChild();
  const startDate = child.birthDate;
  const windowEndExclusive =
    type === "d100" ? seoulDateMinusDays(startDate, -100) : seoulDateMinusMonths(startDate, -12);
  const today = getSeoulToday();
  const dayAfterToday = seoulDateMinusDays(today, -1);
  const coveredEndExclusive = windowEndExclusive < dayAfterToday ? windowEndExclusive : dayAfterToday;
  const partial = coveredEndExclusive < windowEndExclusive;
  const daysCovered = diffDateOnlyDays(startDate, coveredEndExclusive);

  const stored = expensesForChild(childId).filter((expense) => expense.expenseType === "expense");
  const inWindow = stored.filter((expense) => expense.spentOn >= startDate && expense.spentOn < coveredEndExclusive);
  const aggregated = inWindow.length > 0 ? inWindow : stored;

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

  if (tab === "prepared" || tab === "not_needed") {
    return {
      items: localItemTemplateFixtures
        .filter((item) => itemStatusFor(item.id) === tab)
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

  const sorted = sortRecommendedItems(
    candidates.map((item) => ({
      id: item.id,
      stageMatches: item.stageCodes.includes(stageCode),
      necessityLevel: item.necessityLevel,
      status: itemStatusFor(item.id),
      budgetFits: true,
      userInterest: itemStatusFor(item.id) === "interested"
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
      disclosureText: link.disclosureText ?? undefined
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

export function createInvite(householdId: string, role: "co_parent" | "viewer" | "gift_participant", channel: InviteChannel): InviteResponse {
  ensureSeeded();
  const token = generateLocalId("invite");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const invite: LocalInviteRecord = {
    id: generateLocalId("invite-id"),
    token,
    householdId,
    householdName: "다온이 패밀리",
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
    invites: state.invites.map((record) => (localInviteId(record) === inviteId ? { ...record, revokedAt } : record))
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
    validationStatus: row.validationStatus
  };
}

function toImportJobDto(job: LocalImportJobRecord): ImportJob {
  return { id: job.id, status: job.status, rowCount: job.rowCount, candidateCount: job.candidateCount, importedCount: job.importedCount };
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

  for (const row of importableRows) {
    createExpense(job.childId, {
      categoryId: row.categoryId!,
      amountKrw: row.parsedAmountKrw!,
      spentOn: row.parsedDate!,
      itemName: row.parsedItemName!,
      paymentMethod: "unknown",
      source: "excel_import"
    });
  }

  const confirmedJob: LocalImportJobRecord = { ...job, status: "confirmed", importedCount: importableRows.length };
  useLocalBackendStore.setState((state) => ({
    importJobs: state.importJobs.map((record) => (record.id === importJobId ? confirmedJob : record))
  }));

  return { importedCount: importableRows.length, skippedCount: selectedRows.length - importableRows.length };
}

// ---------------------------------------------------------------------------
// Consents / onboarding-adjacent
// ---------------------------------------------------------------------------

export function upsertConsents(): { success: boolean } {
  ensureSeeded();
  useLocalBackendStore.setState({
    consents: [
      { type: "terms", version: "2026-07-06", accepted: true },
      { type: "privacy", version: "2026-07-06", accepted: true }
    ]
  });
  return { success: true };
}

export function createChild(body: { nickname: string }): { id: string } {
  ensureSeeded();
  useLocalBackendStore.setState((state) => ({
    child: state.child ? { ...state.child, nickname: body.nickname.trim() || state.child.nickname } : state.child
  }));
  return { id: LOCAL_CHILD_ID };
}

/**
 * MOB-118: full-detail child DTO matching the real API's GET /children entry (`Child` in
 * client.ts). The local demo backend keeps a single born-mode child, so the list has at most
 * one entry and stageMode is always "born" here.
 */
function toFullChildDto(child: LocalChildRecord): Child {
  const calculated = calculateChildStage({ stageMode: "born", birthDate: child.birthDate, today: getSeoulToday() });
  return {
    id: child.id,
    householdId: LOCAL_HOUSEHOLD_ID,
    nickname: child.nickname,
    stageMode: "born",
    dueDate: null,
    birthDate: child.birthDate,
    manualStage: null,
    currentStage: calculated.stageCode,
    stageLabel: calculated.stageLabel
  };
}

/** MOB-118: local mirror of GET /children. */
export function listChildren(): { children: Child[] } {
  ensureSeeded();
  const child = useLocalBackendStore.getState().child;
  return { children: child && !child.deletedAt ? [toFullChildDto(child)] : [] };
}

/**
 * MOB-118: local mirror of PATCH /children/:childId. The local child is always born-mode, so
 * only `nickname` and `birthDate` apply; a future birth date is rejected with the same message
 * the UI's shared guard uses (the real server enforces this via stage calculation inputs).
 */
export function updateChild(
  childId: string,
  body: { nickname?: string; dueDate?: string; birthDate?: string; manualStage?: string }
): Child {
  const child = requireChild();
  if (child.id !== childId) {
    throw new Error("아이 프로필을 찾을 수 없어요.");
  }
  if (body.birthDate !== undefined && isFutureSeoulDate(body.birthDate)) {
    throw new Error("출생일은 오늘보다 미래일 수 없어요.");
  }
  useLocalBackendStore.setState((state) => ({
    child: state.child
      ? {
          ...state.child,
          nickname: body.nickname !== undefined ? body.nickname.trim() || state.child.nickname : state.child.nickname,
          birthDate: body.birthDate ?? state.child.birthDate
        }
      : state.child
  }));
  return toFullChildDto(requireChild());
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

  const child = state.child && !state.child.deletedAt ? state.child : null;
  if (!child) {
    return {
      completed: false,
      nextStep: "child-profile",
      canRestart: true,
      summary: { consentsAccepted: true, child: null, preparedItemsCount: null, budget: null }
    };
  }

  const childSummary = { ...toChildDto(child), stageMode: "born" };
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

export function setPreparedItems(_childId: string, itemTemplateIds: string[]): { updatedCount: number } {
  ensureSeeded();
  const unique = new Set(itemTemplateIds);
  useLocalBackendStore.setState((state) => {
    const nextStatuses = { ...state.itemStatuses };
    for (const itemTemplateId of unique) {
      if (localItemTemplateFixtures.some((item) => item.id === itemTemplateId)) {
        nextStatuses[itemTemplateId] = { status: "prepared", expenseId: null };
      }
    }
    return { itemStatuses: nextStatuses, preparedItemsCompleted: true };
  });
  return { updatedCount: unique.size };
}

// ---------------------------------------------------------------------------
// Settings / privacy
// ---------------------------------------------------------------------------

export function getPrivacySettings(): PrivacySettings {
  ensureSeeded();
  return {
    flows: [
      {
        id: "account_delete",
        title: "계정 삭제",
        impact: ["account access stops", "active household memberships are left"],
        confirmationText: "DELETE ACCOUNT"
      },
      {
        id: "household_leave",
        title: "가구 탈퇴",
        impact: ["shared child data is no longer accessible from this account"],
        confirmationText: "LEAVE HOUSEHOLD"
      },
      {
        id: "child_profile_delete",
        title: "아이 프로필 삭제",
        impact: ["child profile becomes inaccessible", "related expense records are removed from reports"],
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
    impact: ["child profile becomes inaccessible", "related expense records are removed from reports"]
  };
}

export function confirmChildProfileDeletion(childId: string, confirmationText: string): SettingsConfirmResponse {
  assertConfirmation(confirmationText, "DELETE CHILD");
  requireChild();
  const now = new Date().toISOString();
  useLocalBackendStore.setState((state) => ({
    child: state.child ? { ...state.child, deletedAt: now } : state.child,
    expenses: state.expenses.map((expense) =>
      expense.childId === childId ? { ...expense, deletedAt: now, updatedAt: now } : expense
    )
  }));
  return { success: true, flowId: "child_profile_delete" };
}

export function previewHouseholdLeave(_householdId: string): SettingsPreview {
  ensureSeeded();
  return {
    flowId: "household_leave",
    requiresSecondStep: true,
    confirmationText: "LEAVE HOUSEHOLD",
    impact: ["shared child data is no longer accessible from this account"]
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
    impact: ["account access stops", "active household memberships are left"]
  };
}

export function confirmAccountDeletion(confirmationText: string): SettingsConfirmResponse {
  assertConfirmation(confirmationText, "DELETE ACCOUNT");
  ensureSeeded();
  useLocalBackendStore.setState({ accountDeletedAt: new Date().toISOString() });
  return { success: true, flowId: "account_delete" };
}
