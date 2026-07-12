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
import type {
  AffiliateClickResponse,
  Budget,
  CategoryReport,
  ConfirmImportResponse,
  CumulativeReport,
  Expense,
  HomeSummary,
  ImportJob,
  ImportRow,
  InviteChannel,
  InviteResponse,
  InvitePreview,
  AcceptInviteResponse,
  ItemDetail,
  ItemSummary,
  MonthlyReport,
  PrivacySettings,
  ProductLink,
  SettingsConfirmResponse,
  SettingsPreview,
  YearlyReport
} from "./client";

type ItemTab = "now" | "soon" | "prepared" | "not_needed";
import {
  LOCAL_CATEGORY_IMPORT,
  LOCAL_CHILD_ID,
  LOCAL_DAD_USER_ID,
  LOCAL_DEFAULT_BUDGET_KRW,
  LOCAL_USER_ID,
  localImportStubRows,
  localItemTemplateFixtures,
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
};

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
  token: string;
  householdId: string;
  householdName: string;
  role: "co_parent" | "viewer" | "gift_participant";
  channel: InviteChannel;
  createdAt: string;
  expiresAt: string;
  acceptedByUserId: string | null;
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
  members: LocalMemberRecord[];
  invites: LocalInviteRecord[];
  importJobs: LocalImportJobRecord[];
  importRows: Record<string, LocalImportRowRecord[]>;
  consents: Array<{ type: string; version: string; accepted: boolean }>;
  accountDeletedAt: string | null;
};

const initialState: LocalBackendState = {
  seeded: false,
  child: null,
  budgets: {},
  expenses: [],
  itemStatuses: {},
  members: [],
  invites: [],
  importJobs: [],
  importRows: {},
  consents: [],
  accountDeletedAt: null
};

export const useLocalBackendStore = create<LocalBackendState>()(
  persist(() => initialState, {
    name: "wooriai-local-backend",
    storage: createJSONStorage(() => persistStorage),
    version: 1
  })
);

function wipeLocalBackendState() {
  useLocalBackendStore.setState({ ...initialState, budgets: {}, expenses: [], itemStatuses: {}, importRows: {} });
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
      deletedAt: null
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
    accountDeletedAt: null
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
    source: expense.source
  };
}

function budgetKey(yearMonth: string): string {
  return getSeoulMonthRange(yearMonth).yearMonth;
}

function toBudgetDto(childId: string, yearMonth: string, amountKrw: number): Budget {
  const usedAmountKrw = totalExpenseKrw(expensesForChild(childId, yearMonth));
  return { childId, yearMonth, amountKrw, usedAmountKrw, remainingAmountKrw: amountKrw - usedAmountKrw };
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
    deletedAt: null
  };

  useLocalBackendStore.setState((state) => ({ expenses: [...state.expenses, record] }));
  return toExpenseDto(record);
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

export function updateExpense(
  expenseId: string,
  body: Partial<Pick<Expense, "categoryId" | "amountKrw" | "spentOn" | "itemName" | "memo" | "expenseType">>
): Expense {
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

  useLocalBackendStore.setState((state) => ({
    expenses: state.expenses.map((record) => (record.id === expenseId ? updated : record))
  }));
  return toExpenseDto(updated);
}

export function deleteExpense(expenseId: string): { success: boolean } {
  const expense = requireExpense(expenseId);
  const now = new Date().toISOString();
  useLocalBackendStore.setState((state) => ({
    expenses: state.expenses.map((record) => (record.id === expenseId ? { ...record, deletedAt: now, updatedAt: now } : record))
  }));
  return { success: true };
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

export function getCategoryReport(childId: string, yearMonth?: string): CategoryReport {
  ensureSeeded();
  const normalizedMonth = yearMonth ? budgetKey(yearMonth) : undefined;
  return { childId, categories: categoryBreakdown(expensesForChild(childId, normalizedMonth)) };
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

export function listItems(_childId: string, tab: ItemTab = "now"): { items: ItemSummary[] } {
  ensureSeeded();
  const stageCode = currentStageCode();

  if (tab === "prepared") {
    return {
      items: localItemTemplateFixtures
        .filter((item) => itemStatusFor(item.id) === "prepared")
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map(toItemSummaryDto)
    };
  }

  if (tab === "not_needed") {
    return {
      items: localItemTemplateFixtures
        .filter((item) => itemStatusFor(item.id) === "not_needed")
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map(toItemSummaryDto)
    };
  }

  const stageMatcher =
    tab === "now"
      ? (item: (typeof localItemTemplateFixtures)[number]) => item.stageCodes.includes(stageCode)
      : (item: (typeof localItemTemplateFixtures)[number]) => !item.stageCodes.includes(stageCode);

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
    token,
    householdId,
    householdName: "다온이 패밀리",
    role,
    channel,
    createdAt: now.toISOString(),
    expiresAt,
    acceptedByUserId: null
  };
  useLocalBackendStore.setState((state) => ({ invites: [...state.invites, invite] }));
  return { inviteUrl: `https://wooriai.app/invite/${token}`, expiresAt, householdName: invite.householdName };
}

export function findLocalInvite(token: string): LocalInviteRecord | undefined {
  return useLocalBackendStore.getState().invites.find((invite) => invite.token === token);
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
  if (new Date(invite.expiresAt).getTime() <= Date.now()) {
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
    return { itemStatuses: nextStatuses };
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
