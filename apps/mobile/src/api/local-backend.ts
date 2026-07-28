import {
  assertMoneyKrw,
  getSeoulMonthRange,
  getSeoulToday,
  isBeyondSeoulTomorrow,
  isFutureSeoulDate
} from "@wooriai/domain/money-date";
import { CHILD_STAGE_CODES, CHILD_STAGE_MODES, type ChildStageCode, type ChildStageMode, type ExpenseSource, type ExpenseType, type ImportStatus, type ItemStatus, type PaymentMethod } from "@wooriai/domain/enums";
import { CHILD_SEX_VALUES, normalizeOnboardingCompletionInput } from "@wooriai/domain/onboarding";
import { buildPreparationRecommendationReason, calculatePreparationLifecycle } from "@wooriai/domain/preparation-lifecycle";
import { sortRecommendedItems } from "@wooriai/domain/recommendation";
import { resolveReportV3State } from "@wooriai/domain/report-v3-state";
import { comparePreparationTimelineRank, type CatalogScenarioCode, type Release4CatalogItem } from "@wooriai/domain/release4-catalog";
import { calculateChildStage } from "@wooriai/domain/stage";
import { create } from "zustand";
import type { ReportCategoriesContract, ReportMembersContract, ReportPreparationContract, ReportRecurringContract, ReportSourceKind, ReportSourcesContract, ReportSummaryContract, ReportTrendContract, ReportV3Contract, TodayActionContract, TodayPreferenceContract, TodayPreferenceResolutionContract } from "@wooriai/contracts";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandPersistStorage } from "../stores/persist-storage";
import type {
  AffiliateClickResponse,
  AccountDeletionRequest,
  Budget,
  CategoryReport,
  CatalogItemDetail,
  CatalogItemPlan,
  CatalogItemSummary,
  CatalogBundleApplyResponse,
  CatalogTimelineResponse,
  CatalogTimelineBucket,
  CatalogListQuery,
  CatalogNodeSummary,
  CatalogSafetyAlert,
  CatalogSafetyAlternativesResponse,
  ConfirmImportResponse,
  CumulativeReport,
  CompleteOnboardingInput,
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
  OnboardingChildSummary,
  PrivacySettings,
  ProductLink,
  NotificationInboxItem,
  SettingsConfirmResponse,
  SettingsPreview,
  UserPaymentMethod,
  YearlyReport
  ,ReportV2Period,
  TodayPreferenceInput
} from "./client";

type ItemTab = "now" | "soon" | "prepared" | "not_needed";
import {
  LOCAL_CATEGORY_IMPORT,
  LOCAL_CHILD_ID,
  LOCAL_DAD_USER_ID,
  LOCAL_DEFAULT_BUDGET_KRW,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_ITEM_CARRIER,
  LOCAL_ITEM_DIAPER,
  LOCAL_MOTHER_PROFILE_ID,
  LOCAL_USER_ID,
  localImportStubRows,
  localItemTemplateFixtures,
  localMemberFixtures,
  localProductLinkFixtures,
  localSeedExpenses
} from "./local-fixtures";
import { ONBOARDING_STARTER_ITEM_REGISTRY } from "../onboarding/starter-items";
import { categoryNameFor } from "../categories";
import { catalogDomain } from "./catalog-domain-loader";

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
  paymentMethodId: string | null;
  linkedItemTemplateId: string | null;
  linkedItemDefinitionId: string | null;
  expenseCategoryV2Id: string | null;
  expenseType: ExpenseType;
  source: ExpenseSource;
  payerUserId?: string | null;
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
  stageMode: ChildStageMode;
  dueDate: string | null;
  birthDate: string | null;
  manualStage: ChildStageCode | null;
  gender: string | null;
  profileImageUrl: string | null;
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

type LocalPlanHistoryRecord = {
  id: string;
  planId: string;
  actorUserId: string;
  actorDisplayName: string;
  fromVersion: number | null;
  toVersion: number;
  changesJson: Record<string, unknown>;
  createdAt: string;
};

type LocalPlanCommentRecord = {
  id: string;
  planId: string;
  authorUserId: string;
  authorDisplayName: string;
  body: string;
  createdAt: string;
  deletedAt: null;
};

type LocalTodayActionPreferenceRecord = TodayPreferenceContract & {
  userId: string;
  householdId: string;
  childId: string;
  scopeKey: string;
};

const LEGACY_LOCAL_TODAY_SAFETY_ALERT_ID = "local-today-safety-alert";
const LOCAL_TODAY_SAFETY_ALERT_PREFIX = "local-today-safety-alert:";
const LOCAL_SAFETY_ALTERNATIVE_ALERT_PREFIX = "local-safety-alternative-alert:";

function localTodaySafetyAlertId(childId: string) {
  return `${LOCAL_TODAY_SAFETY_ALERT_PREFIX}${childId}`;
}

function localTodaySafetyActionKey(childId: string) {
  return `safety:${localTodaySafetyAlertId(childId)}`;
}

function childIdFromLocalTodaySafetyAlertId(alertId: string) {
  return alertId.startsWith(LOCAL_TODAY_SAFETY_ALERT_PREFIX)
    ? alertId.slice(LOCAL_TODAY_SAFETY_ALERT_PREFIX.length)
    : null;
}

type LocalBackendState = {
  seeded: boolean;
  child: LocalChildRecord | null;
  additionalChildren: LocalChildRecord[];
  budgets: Record<string, number>;
  expenses: LocalExpenseRecord[];
  paymentMethods: UserPaymentMethod[];
  itemStatuses: Record<string, { status: ItemStatus; expenseId: string | null }>;
  itemPlans: Record<string, CatalogItemPlan>;
  planHistory: Record<string, LocalPlanHistoryRecord[]>;
  planComments: Record<string, LocalPlanCommentRecord[]>;
  preparationContexts: Record<string, { contextCodes: CatalogScenarioCode[]; version: number; updatedAt: string }>;
  todayActionPreferences: LocalTodayActionPreferenceRecord[];
  acknowledgedSafetyAlertIds: string[];
  // MOB-101: mirrors the server's `children.prepared_items_set_at` -- set once the
  // prepared-items onboarding step is submitted (even with zero items checked), used by
  // onboardingStatus() below to tell "step not reached yet" apart from "step done, nothing
  // picked". Missing on already-persisted local backends (pre-MOB-101) defaults to false via
  // the initialState merge, which just means those demo sessions replay that one step.
  preparedItemsCompleted: boolean;
  onboardingCompleted: boolean;
  members: LocalMemberRecord[];
  invites: LocalInviteRecord[];
  importJobs: LocalImportJobRecord[];
  importRows: Record<string, LocalImportRowRecord[]>;
  consents: Array<{ type: string; version: string; contentHash: string; accepted: boolean }>;
  accountDeletedAt: string | null;
  accountDeletionRequest: AccountDeletionRequest | null;
  // MOB-102 (round5a-sprint1-plan.md §3.2): local mirror of the real API's Idempotency-Key
  // interceptor for expense creation -- maps a client-supplied idempotency key to the expense id
  // it produced, so the offline outbox replaying a create after a crash/retry never creates a
  // second expense for the same key. See createExpenseIdempotent below.
  idempotencyKeys: Record<string, string>;
};

const initialState: LocalBackendState = {
  seeded: false,
  child: null,
  additionalChildren: [],
  budgets: {},
  expenses: [],
  paymentMethods: [],
  itemStatuses: {},
  itemPlans: {},
  planHistory: {},
  planComments: {},
  preparationContexts: {},
  todayActionPreferences: [],
  acknowledgedSafetyAlertIds: [],
  preparedItemsCompleted: false,
  onboardingCompleted: false,
  members: [],
  invites: [],
  importJobs: [],
  importRows: {},
  consents: [],
  accountDeletedAt: null,
  accountDeletionRequest: null,
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
    paymentMethodId: typeof value.paymentMethodId === "string" ? value.paymentMethodId : null,
    linkedItemTemplateId: typeof value.linkedItemTemplateId === "string" ? value.linkedItemTemplateId : null,
    linkedItemDefinitionId: typeof value.linkedItemDefinitionId === "string" ? value.linkedItemDefinitionId : null,
    expenseCategoryV2Id: typeof value.expenseCategoryV2Id === "string" ? value.expenseCategoryV2Id : null,
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
  if (typeof value.id !== "string" || typeof value.nickname !== "string") {
    return null;
  }
  // Persisted standalone data from the pre-stageMode schema still has exactly
  // one authoritative date field. Migrate only that known legacy shape; an
  // explicit unknown enum, both dates, or neither date remains fail-closed.
  const hasDueDate = typeof value.dueDate === "string";
  const hasBirthDate = typeof value.birthDate === "string";
  const legacyStageMode = value.stageMode === undefined || value.stageMode === null
    ? hasDueDate !== hasBirthDate
      ? hasDueDate ? "pregnant" : "born"
      : null
    : null;
  const stageMode = CHILD_STAGE_MODES.includes(value.stageMode as ChildStageMode)
    ? value.stageMode as ChildStageMode
    : legacyStageMode;
  if (!stageMode) return null;
  if (value.manualStage !== null && value.manualStage !== undefined && !CHILD_STAGE_CODES.includes(value.manualStage as ChildStageCode)) return null;
  if (value.gender !== null && value.gender !== undefined && !CHILD_SEX_VALUES.includes(value.gender as never)) return null;
  return {
    id: value.id,
    nickname: value.nickname,
    stageMode,
    dueDate: typeof value.dueDate === "string" ? value.dueDate : null,
    birthDate: typeof value.birthDate === "string" ? value.birthDate : null,
    manualStage: typeof value.manualStage === "string" ? (value.manualStage as ChildStageCode) : null,
    gender: typeof value.gender === "string" ? value.gender : null,
    profileImageUrl: typeof value.profileImageUrl === "string" ? value.profileImageUrl : null,
    deletedAt: typeof value.deletedAt === "string" ? value.deletedAt : null
  };
}

function localSafetyAlternativeAlertId(childId: string) {
  return `${LOCAL_SAFETY_ALTERNATIVE_ALERT_PREFIX}${childId}`;
}

function childIdFromLocalSafetyAlternativeAlertId(alertId: string) {
  return alertId.startsWith(LOCAL_SAFETY_ALTERNATIVE_ALERT_PREFIX)
    ? alertId.slice(LOCAL_SAFETY_ALTERNATIVE_ALERT_PREFIX.length)
    : null;
}

function validDateOnly(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function sanitizeTodayActionPreferences(
  value: unknown,
  allowedChildIds: Set<string>
): LocalTodayActionPreferenceRecord[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, LocalTodayActionPreferenceRecord>();
  for (const candidate of value) {
    if (!isPlainObject(candidate)) continue;
    if (
      candidate.userId !== LOCAL_USER_ID ||
      candidate.householdId !== LOCAL_HOUSEHOLD_ID ||
      typeof candidate.childId !== "string" ||
      !allowedChildIds.has(candidate.childId) ||
      candidate.scopeKey !== candidate.childId ||
      typeof candidate.actionKey !== "string" ||
      candidate.actionKey.length < 1 ||
      candidate.actionKey.length > 191 ||
      candidate.actionKey.startsWith("safety:") ||
      candidate.mode !== "snooze" ||
      !validDateOnly(candidate.snoozedUntil) ||
      !Number.isInteger(candidate.version) ||
      (candidate.version as number) < 1
    ) continue;
    const record: LocalTodayActionPreferenceRecord = {
      userId: LOCAL_USER_ID,
      householdId: LOCAL_HOUSEHOLD_ID,
      childId: candidate.childId,
      scopeKey: candidate.childId,
      actionKey: candidate.actionKey,
      mode: "snooze",
      snoozedUntil: candidate.snoozedUntil,
      version: candidate.version as number
    };
    unique.set(`${record.childId}:${record.actionKey}`, record);
  }
  return [...unique.values()];
}

const LEGACY_FIXTURE_CHILD_ID = "local-child-daon";
const LEGACY_FIXTURE_HOUSEHOLD_ID = "local-household-daon";

export function isLegacyFixtureChildFingerprint(child: LocalChildRecord | null, persisted: unknown): boolean {
  if (!child || child.id !== LEGACY_FIXTURE_CHILD_ID || child.nickname !== "다온이" || !isPlainObject(persisted)) return false;
  const members = Array.isArray(persisted.members) ? persisted.members : [];
  return members.some((member) =>
    isPlainObject(member) &&
    member.householdId === LEGACY_FIXTURE_HOUSEHOLD_ID &&
    member.userId === LOCAL_USER_ID
  );
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
  const additionalChildren = Array.isArray(persisted.additionalChildren)
    ? persisted.additionalChildren
        .map(sanitizeLocalChildRecord)
        .filter((record): record is LocalChildRecord => record !== null)
    : [];
  const expenses = Array.isArray(persisted.expenses)
    ? persisted.expenses.map(sanitizeLocalExpenseRecord).filter((record): record is LocalExpenseRecord => record !== null)
    : [];
  const allowedChildIds = new Set([child, ...additionalChildren]
    .filter((record): record is LocalChildRecord => Boolean(record && !record.deletedAt))
    .map((record) => record.id));

  const sanitized: LocalBackendState = {
    seeded: typeof persisted.seeded === "boolean" ? persisted.seeded : false,
    child,
    additionalChildren,
    budgets: isPlainObject(persisted.budgets) ? (persisted.budgets as Record<string, number>) : {},
    expenses,
    paymentMethods: Array.isArray(persisted.paymentMethods)
      ? (persisted.paymentMethods as UserPaymentMethod[])
      : [],
    itemStatuses: isPlainObject(persisted.itemStatuses)
      ? (persisted.itemStatuses as LocalBackendState["itemStatuses"])
      : {},
    itemPlans: isPlainObject(persisted.itemPlans)
      ? (persisted.itemPlans as LocalBackendState["itemPlans"])
      : {},
    planHistory: isPlainObject(persisted.planHistory) ? (persisted.planHistory as LocalBackendState["planHistory"]) : {},
    planComments: isPlainObject(persisted.planComments) ? (persisted.planComments as LocalBackendState["planComments"]) : {},
    preparationContexts: isPlainObject(persisted.preparationContexts) ? (persisted.preparationContexts as LocalBackendState["preparationContexts"]) : {},
    todayActionPreferences: sanitizeTodayActionPreferences(persisted.todayActionPreferences, allowedChildIds),
    acknowledgedSafetyAlertIds: Array.isArray(persisted.acknowledgedSafetyAlertIds)
      ? [
          ...persisted.acknowledgedSafetyAlertIds.filter((alertId): alertId is string =>
            typeof alertId === "string" &&
            [...allowedChildIds].some((childId) =>
              alertId === localTodaySafetyAlertId(childId)
              || alertId === localSafetyAlternativeAlertId(childId)
            )
          ),
          ...(persisted.acknowledgedSafetyAlertIds.includes(LEGACY_LOCAL_TODAY_SAFETY_ALERT_ID) && child
            ? [localTodaySafetyAlertId(child.id)]
            : [])
        ].filter((alertId, index, values) => values.indexOf(alertId) === index)
      : [],
    preparedItemsCompleted: typeof persisted.preparedItemsCompleted === "boolean" ? persisted.preparedItemsCompleted : false,
    onboardingCompleted: typeof persisted.onboardingCompleted === "boolean" ? persisted.onboardingCompleted : false,
    members: Array.isArray(persisted.members) ? (persisted.members as LocalMemberRecord[]) : [],
    invites: Array.isArray(persisted.invites) ? (persisted.invites as LocalInviteRecord[]) : [],
    importJobs: Array.isArray(persisted.importJobs) ? (persisted.importJobs as LocalImportJobRecord[]) : [],
    importRows: isPlainObject(persisted.importRows) ? (persisted.importRows as LocalBackendState["importRows"]) : {},
    consents: Array.isArray(persisted.consents) ? (persisted.consents as LocalBackendState["consents"]) : [],
    accountDeletedAt: typeof persisted.accountDeletedAt === "string" ? persisted.accountDeletedAt : null,
    accountDeletionRequest: isPlainObject(persisted.accountDeletionRequest)
      ? persisted.accountDeletionRequest as AccountDeletionRequest
      : null,
    idempotencyKeys: isPlainObject(persisted.idempotencyKeys) ? (persisted.idempotencyKeys as Record<string, string>) : {}
  };
  if (!isLegacyFixtureChildFingerprint(child, persisted)) return sanitized;
  return {
    ...sanitized,
    child: null,
    additionalChildren: sanitized.additionalChildren.filter((candidate) => candidate.id !== LEGACY_FIXTURE_CHILD_ID),
    budgets: Object.fromEntries(Object.entries(sanitized.budgets).filter(([key]) => !key.startsWith(`${LEGACY_FIXTURE_CHILD_ID}:`))),
    expenses: sanitized.expenses.filter((expense) => expense.childId !== LEGACY_FIXTURE_CHILD_ID),
    itemStatuses: Object.fromEntries(Object.entries(sanitized.itemStatuses).filter(([key]) => !key.startsWith(`${LEGACY_FIXTURE_CHILD_ID}:`))),
    itemPlans: Object.fromEntries(Object.entries(sanitized.itemPlans).filter(([, plan]) => plan.childId !== LEGACY_FIXTURE_CHILD_ID)),
    preparedItemsCompleted: false,
    onboardingCompleted: false
  };
}

export const useLocalBackendStore = create<LocalBackendState>()(
  persist(() => initialState, {
    name: "wooriai-local-backend",
    storage: createJSONStorage(() => zustandPersistStorage),
    // Version 3 adds `additionalChildren`; the sanitizer backfills it to an empty array while
    // preserving the version-2 expense/onboarding migrations below.
    version: 12,
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
    itemPlans: {},
    planHistory: {},
    planComments: {},
    preparationContexts: {},
    todayActionPreferences: [],
    acknowledgedSafetyAlertIds: [],
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

/** Starts the explicit test-login profile without a synthetic child or child-scoped data. */
export function startLocalOnboardingSession() {
  ensureSeeded();
  useLocalBackendStore.setState({
    child: null,
    additionalChildren: [],
    budgets: {},
    expenses: [],
    itemStatuses: {},
    itemPlans: {},
    todayActionPreferences: [],
    acknowledgedSafetyAlertIds: [],
    preparedItemsCompleted: false,
    onboardingCompleted: false,
    consents: localLegalDocuments.map((document) => ({
      type: document.documentType,
      version: document.version,
      contentHash: document.contentHash,
      accepted: true
    })),
    idempotencyKeys: {}
  });
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
      paymentMethodId: null,
      linkedItemTemplateId: null,
      linkedItemDefinitionId: null,
      expenseCategoryV2Id: null,
      expenseType: seed.expenseType,
      source: seed.source,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1
    };
  });

  const authorityRecoveryFixture = process.env.EXPO_PUBLIC_AUTHORITY_RECOVERY_FIXTURE === "1";
  const members: LocalMemberRecord[] = localMemberFixtures
    .filter((member) => !authorityRecoveryFixture || member.userId === LOCAL_USER_ID)
    .map((member) => ({ ...member }));
  if (authorityRecoveryFixture) {
    members.push(
      {
        id: "local-recovery-owner",
        householdId: AUTHORITY_RECOVERY_HOUSEHOLD_ID,
        userId: LOCAL_USER_ID,
        displayName: "엄마 (나)",
        role: "owner",
        status: "active"
      },
      {
        id: "local-recovery-coparent",
        householdId: AUTHORITY_RECOVERY_HOUSEHOLD_ID,
        userId: LOCAL_DAD_USER_ID,
        displayName: "아빠",
        role: "co_parent",
        status: "active"
      }
    );
  }

  useLocalBackendStore.setState({
    seeded: true,
    child: { id: LOCAL_CHILD_ID, nickname: "검증용 아이", stageMode: "born", dueDate: null, birthDate, manualStage: null, gender: null, profileImageUrl: null, deletedAt: null },
    additionalChildren: [],
    budgets: { [`${LOCAL_CHILD_ID}:${yearMonth}`]: LOCAL_DEFAULT_BUDGET_KRW },
    expenses,
    itemStatuses: {},
    itemPlans: {},
    todayActionPreferences: [],
    acknowledgedSafetyAlertIds: [],
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

function activeChildren(): LocalChildRecord[] {
  ensureSeeded();
  const state = useLocalBackendStore.getState();
  return [state.child, ...state.additionalChildren].filter(
    (child): child is LocalChildRecord => Boolean(child && !child.deletedAt)
  );
}

function assertExpenseDateWithinScheduleWindow(spentOn: string) {
  assertValidCalendarDate(spentOn);
  try {
    if (isBeyondSeoulTomorrow(spentOn)) {
      throw new Error("예정 지출은 내일까지만 저장할 수 있어요.");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "예정 지출은 내일까지만 저장할 수 있어요.") throw error;
    throw new Error("날짜를 다시 확인해 주세요.");
  }
}

function seoulDatePlusDays(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * 86_400_000).toISOString().slice(0, 10);
}

function localMotherDueDate() {
  return seoulDatePlusDays(getSeoulToday(), 56);
}

function requireChild(childId?: string): LocalChildRecord {
  const children = activeChildren();
  const child = childId ? children.find((candidate) => candidate.id === childId) : children[0];
  if (!child || child.deletedAt) {
    throw new Error("아이 프로필을 찾을 수 없어요.");
  }
  return child;
}

function toChildDto(child: LocalChildRecord) {
  const calculated =
    child.stageMode === "pregnant"
      ? calculateChildStage({ stageMode: "pregnant", dueDate: child.dueDate!, today: getSeoulToday() })
      : child.stageMode === "born"
        ? calculateChildStage({ stageMode: "born", birthDate: child.birthDate!, today: getSeoulToday() })
        : calculateChildStage({ stageMode: "manual", manualStage: child.manualStage!, today: getSeoulToday() });
  return {
    id: child.id,
    householdId: LOCAL_HOUSEHOLD_ID,
    nickname: child.nickname,
    stageMode: child.stageMode,
    dueDate: child.dueDate,
    birthDate: child.birthDate,
    manualStage: child.manualStage,
    gender: child.gender ?? null,
    profileImageUrl: child.profileImageUrl ?? null,
    currentStage: calculated.stageCode,
    stageLabel: calculated.stageLabel
  };
}

function currentStageCode(childId: string): ChildStageCode {
  return toChildDto(requireChild(childId)).currentStage;
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
    paymentMethod: expense.paymentMethod,
    paymentMethodId: expense.paymentMethodId,
    memo: expense.memo,
    linkedItemDefinitionId: expense.linkedItemDefinitionId,
    expenseCategoryV2Id: expense.expenseCategoryV2Id,
    expenseType: expense.expenseType,
    source: expense.source,
    payerUserId: expense.payerUserId ?? LOCAL_USER_ID,
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

function realizedExpensesForChild(childId: string, yearMonth?: string): LocalExpenseRecord[] {
  const today = getSeoulToday();
  return expensesForChild(childId, yearMonth).filter((expense) => expense.spentOn <= today);
}

function budgetStorageKey(childId: string, yearMonth: string): string {
  return `${childId}:${budgetKey(yearMonth)}`;
}

function budgetAmountFor(childId: string, yearMonth: string): number | undefined {
  const state = useLocalBackendStore.getState();
  return state.budgets[budgetStorageKey(childId, yearMonth)] ??
    (childId === LOCAL_CHILD_ID ? state.budgets[budgetKey(yearMonth)] : undefined);
}

function toBudgetDto(childId: string, yearMonth: string, amountKrw: number): Budget {
  const usedAmountKrw = totalExpenseKrw(realizedExpensesForChild(childId, yearMonth));
  return { childId, yearMonth, amountKrw, usedAmountKrw, remainingAmountKrw: amountKrw - usedAmountKrw };
}

// ---------------------------------------------------------------------------
// Home / expenses / budget
// ---------------------------------------------------------------------------

export function getLocalTodayCenter(childId: string): NonNullable<HomeSummary["todayCenter"]> {
  const today = getSeoulToday();
  const state = useLocalBackendStore.getState();
  const acknowledged = state.acknowledgedSafetyAlertIds.includes(localTodaySafetyAlertId(childId));
  const candidates: TodayActionContract[] = [
    ...(!acknowledged ? [{
      actionKey: localTodaySafetyActionKey(childId),
      kind: "safety_acknowledgement" as const,
      sourceId: LOCAL_ITEM_DIAPER,
      childId,
      dueDate: null,
      assignedUserId: null,
      reasonCode: "safety_acknowledgement",
      reasonParams: { itemName: "기저귀" },
      navigation: { kind: "notifications" as const },
      preferenceScope: { kind: "child" as const, childId },
      preferenceVersion: 0
    }] : []),
    {
      actionKey: `local:${childId}:${LOCAL_ITEM_DIAPER}:recurring`,
      kind: "recurring_due",
      sourceId: LOCAL_ITEM_DIAPER,
      childId,
      dueDate: today,
      assignedUserId: LOCAL_USER_ID,
      reasonCode: "recurring_due",
      reasonParams: { itemName: "기저귀", dueDate: today },
      navigation: { kind: "item", itemId: LOCAL_ITEM_DIAPER, childId },
      preferenceScope: { kind: "child", childId },
      preferenceVersion: 0
    },
    {
      actionKey: `local:${childId}:${LOCAL_ITEM_CARRIER}:replacement`,
      kind: "replacement_due",
      sourceId: LOCAL_ITEM_CARRIER,
      childId,
      dueDate: seoulDatePlusDays(today, 3),
      assignedUserId: null,
      reasonCode: "replacement_due",
      reasonParams: { itemName: "아기띠", dueDate: seoulDatePlusDays(today, 3) },
      navigation: { kind: "item", itemId: LOCAL_ITEM_CARRIER, childId },
      preferenceScope: { kind: "child", childId },
      preferenceVersion: 0
    }
  ];
  const preferences = new Map(state.todayActionPreferences
    .filter((entry) => entry.childId === childId)
    .map((entry) => [entry.actionKey, entry]));
  return {
    generatedAt: new Date().toISOString(),
    referenceDate: today,
    source: "local_fixture",
    actions: candidates
      .map((candidate) => ({ ...candidate, preferenceVersion: preferences.get(candidate.actionKey)?.version ?? 0 }))
      .filter((candidate) => {
        const preference = preferences.get(candidate.actionKey);
        return !preference || preference.snoozedUntil <= today;
      })
      .slice(0, 3)
  };
}

export function getHome(childId: string): HomeSummary {
  const child = requireChild(childId);
  const yearMonth = getSeoulMonthRange(getSeoulToday()).yearMonth;
  const budgetAmount = budgetAmountFor(childId, yearMonth) ?? 0;
  const recentExpenses = realizedExpensesForChild(childId, undefined).slice(0, 3);

  return {
    child: toChildDto(child),
    totalExpenseKrw: totalExpenseKrw(realizedExpensesForChild(childId)),
    monthly: toBudgetDto(childId, yearMonth, budgetAmount),
    recommendedItems: listItems(childId, "now").items.slice(0, 3),
    recentExpenses: recentExpenses.map(toExpenseDto),
    todayCenter: null
  };
}

function assertTodayPreferenceScope(input: Pick<TodayPreferenceInput, "householdId" | "childId" | "actionKey">) {
  ensureSeeded();
  if (input.householdId !== LOCAL_HOUSEHOLD_ID) {
    throw localApiError("HOUSEHOLD_FORBIDDEN", "가족 접근 권한이 필요해요.");
  }
  const child = requireChild(input.childId);
  if (child.id !== input.childId) {
    throw localApiError("CHILD_SCOPE_MISMATCH", "아이와 가족 범위가 일치하지 않아요.");
  }
  if (!input.actionKey || input.actionKey.length > 191) {
    throw localApiError("TODAY_ACTION_INVALID", "알림 정보를 다시 확인해 주세요.");
  }
}

export function updateTodayPreference(input: TodayPreferenceInput): TodayPreferenceContract {
  assertTodayPreferenceScope(input);
  if (input.actionKey.startsWith("safety:")) {
    throw localApiError("SAFETY_ACTION_NOT_SNOOZABLE", "안전 확인은 미룰 수 없어요.");
  }
  if (input.mode !== "snooze") {
    throw localApiError("TODAY_PREFERENCE_MODE_INVALID", "지원하지 않는 알림 설정이에요.");
  }
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
    throw localApiError("TODAY_PREFERENCE_VERSION_INVALID", "알림 버전을 다시 확인해 주세요.");
  }
  const state = useLocalBackendStore.getState();
  const index = state.todayActionPreferences.findIndex((entry) =>
    entry.userId === LOCAL_USER_ID &&
    entry.householdId === input.householdId &&
    entry.childId === input.childId &&
    entry.actionKey === input.actionKey
  );
  const existing = index >= 0 ? state.todayActionPreferences[index] : null;
  if (
    (input.expectedVersion === 0 && existing) ||
    (input.expectedVersion > 0 && existing?.version !== input.expectedVersion)
  ) {
    throw localApiError("TODAY_PREFERENCE_CONFLICT", "다른 변경 내용을 먼저 반영했어요.");
  }
  const saved: LocalTodayActionPreferenceRecord = {
    userId: LOCAL_USER_ID,
    householdId: input.householdId,
    childId: input.childId,
    scopeKey: input.childId,
    actionKey: input.actionKey,
    mode: "snooze",
    snoozedUntil: seoulDatePlusDays(getSeoulToday(), 1),
    version: (existing?.version ?? 0) + 1
  };
  useLocalBackendStore.setState((current) => ({
    todayActionPreferences: index >= 0
      ? current.todayActionPreferences.map((entry, entryIndex) => entryIndex === index ? saved : entry)
      : [...current.todayActionPreferences, saved]
  }));
  const { userId: _userId, householdId: _householdId, childId: _childId, scopeKey: _scopeKey, ...contract } = saved;
  return contract;
}

export function getTodayPreferenceResolution(
  input: Pick<TodayPreferenceInput, "householdId" | "childId" | "actionKey">
): TodayPreferenceResolutionContract {
  assertTodayPreferenceScope(input);
  const existing = useLocalBackendStore.getState().todayActionPreferences.find((entry) =>
    entry.userId === LOCAL_USER_ID &&
    entry.householdId === input.householdId &&
    entry.childId === input.childId &&
    entry.actionKey === input.actionKey
  );
  const preference = existing
    ? {
        actionKey: existing.actionKey,
        mode: existing.mode,
        snoozedUntil: existing.snoozedUntil,
        version: existing.version
      }
    : null;
  return {
    actionKey: input.actionKey,
    preferenceScope: { kind: "child", childId: input.childId },
    preference
  };
}

export function listExpenses(childId: string, yearMonth?: string): { expenses: Expense[]; totalAmountKrw: number } {
  const expenses = expensesForChild(childId, yearMonth);
  return { expenses: expenses.map(toExpenseDto), totalAmountKrw: totalExpenseKrw(expenses) };
}

export function listExpenseShortcuts(childId: string) {
  const sinceIso = seoulDateMinusDays(getSeoulToday(), 90);
  const grouped = new Map<
    string,
    { itemName: string; categoryId: string; lastAmountKrw: number; lastSpentOn: string; useCount: number }
  >();
  for (const expense of expensesForChild(childId).filter((entry) => entry.spentOn >= sinceIso)) {
    const key = `${expense.itemName.trim().toLocaleLowerCase("ko-KR")}|${expense.categoryId}`;
    const current = grouped.get(key);
    if (current) current.useCount += 1;
    else {
      grouped.set(key, {
        itemName: expense.itemName,
        categoryId: expense.categoryId,
        lastAmountKrw: expense.amountKrw,
        lastSpentOn: expense.spentOn,
        useCount: 1
      });
    }
  }
  return {
    shortcuts: [...grouped.values()]
      .sort((left, right) => right.useCount - left.useCount || right.lastSpentOn.localeCompare(left.lastSpentOn))
      .slice(0, 6)
      .map(({ lastSpentOn: _lastSpentOn, ...shortcut }) => shortcut)
  };
}

function normalizePaymentMethodLabel(value: string) {
  const label = value.trim();
  if (!label) throw new Error("결제수단 이름을 입력해 주세요.");
  if (/(?:\d[\s-]*){8,}/.test(label)) {
    throw new Error("카드번호나 계좌번호 대신 알아보기 쉬운 이름만 입력해 주세요.");
  }
  return label;
}

function requireLocalPaymentMethod(paymentMethodId: string, requireActive = false) {
  const method = useLocalBackendStore.getState().paymentMethods.find(
    (entry) => entry.id === paymentMethodId && (!requireActive || entry.active)
  );
  if (!method) throw new Error("결제수단을 찾을 수 없어요.");
  return method;
}

export function listPaymentMethods(): { paymentMethods: UserPaymentMethod[] } {
  const paymentMethods = [...useLocalBackendStore.getState().paymentMethods].sort(
    (left, right) =>
      Number(right.active) - Number(left.active) ||
      Number(right.isDefault) - Number(left.isDefault) ||
      left.displayOrder - right.displayOrder
  );
  return { paymentMethods };
}

export function createPaymentMethod(
  body: Pick<UserPaymentMethod, "type" | "label"> & { isDefault?: boolean }
): UserPaymentMethod {
  const label = normalizePaymentMethodLabel(body.label);
  if (useLocalBackendStore.getState().paymentMethods.some((method) => method.label === label)) {
    throw new Error("이미 사용 중인 결제수단 이름이에요.");
  }
  const methods = useLocalBackendStore.getState().paymentMethods;
  const created: UserPaymentMethod = {
    id: generateLocalId("payment-method"),
    type: body.type,
    label,
    isDefault: body.isDefault ?? false,
    active: true,
    displayOrder: methods.reduce((max, method) => Math.max(max, method.displayOrder), -1) + 1
  };
  useLocalBackendStore.setState((state) => ({
    paymentMethods: [
      ...state.paymentMethods.map((method) => (created.isDefault ? { ...method, isDefault: false } : method)),
      created
    ]
  }));
  return created;
}

export function updatePaymentMethod(
  paymentMethodId: string,
  body: Partial<Pick<UserPaymentMethod, "type" | "label" | "displayOrder" | "isDefault">>
): UserPaymentMethod {
  const existing = requireLocalPaymentMethod(paymentMethodId);
  const label = body.label === undefined ? existing.label : normalizePaymentMethodLabel(body.label);
  if (
    useLocalBackendStore.getState().paymentMethods.some(
      (method) => method.id !== paymentMethodId && method.label === label
    )
  ) {
    throw new Error("이미 사용 중인 결제수단 이름이에요.");
  }
  const updated = { ...existing, ...body, label };
  useLocalBackendStore.setState((state) => ({
    paymentMethods: state.paymentMethods.map((method) =>
      method.id === paymentMethodId
        ? updated
        : body.isDefault
          ? { ...method, isDefault: false }
          : method
    )
  }));
  return updated;
}

export function deactivatePaymentMethod(paymentMethodId: string): UserPaymentMethod {
  const existing = requireLocalPaymentMethod(paymentMethodId);
  const updated = { ...existing, active: false, isDefault: false };
  useLocalBackendStore.setState((state) => ({
    paymentMethods: state.paymentMethods.map((method) => (method.id === paymentMethodId ? updated : method))
  }));
  return updated;
}

export function setDefaultPaymentMethod(paymentMethodId: string): UserPaymentMethod {
  const existing = requireLocalPaymentMethod(paymentMethodId, true);
  const updated = { ...existing, isDefault: true };
  useLocalBackendStore.setState((state) => ({
    paymentMethods: state.paymentMethods.map((method) =>
      method.id === paymentMethodId ? updated : { ...method, isDefault: false }
    )
  }));
  return updated;
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
    paymentMethodId?: string;
    memo?: string;
    linkedItemTemplateId?: string;
    linkedItemDefinitionId?: string;
    expenseCategoryV2Id?: string;
    expenseType?: ExpenseType;
    source?: ExpenseSource;
    payerUserId?: string;
  }
): Expense {
  requireChild(childId);
  const itemName = body.itemName.trim();
  if (!itemName) {
    throw new Error("품목명을 입력해 주세요.");
  }
  assertValidCalendarDate(body.spentOn);
  assertExpenseDateWithinScheduleWindow(body.spentOn);
  const amountKrw = requireMoneyKrw(body.amountKrw);
  const selectedPaymentMethod = body.paymentMethodId
    ? requireLocalPaymentMethod(body.paymentMethodId, true)
    : null;
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
    paymentMethod: selectedPaymentMethod?.type ?? body.paymentMethod ?? "unknown",
    paymentMethodId: selectedPaymentMethod?.id ?? null,
    linkedItemTemplateId: body.linkedItemTemplateId ?? null,
    linkedItemDefinitionId: body.linkedItemDefinitionId ?? null,
    expenseCategoryV2Id: body.expenseCategoryV2Id ?? null,
    expenseType: body.expenseType ?? "expense",
    source: body.source ?? "manual",
    payerUserId: body.payerUserId ?? LOCAL_USER_ID,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1
  };

  useLocalBackendStore.setState((state) => ({ expenses: [...state.expenses, record] }));
  return toExpenseDto(record);
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
  body: Partial<Pick<Expense, "categoryId" | "amountKrw" | "spentOn" | "itemName" | "memo" | "expenseType" | "paymentMethod" | "paymentMethodId">>,
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
    assertExpenseDateWithinScheduleWindow(body.spentOn);
    updated.spentOn = body.spentOn;
  }
  if (body.itemName !== undefined) {
    const itemName = body.itemName.trim();
    if (!itemName) throw new Error("품목명을 입력해 주세요.");
    updated.itemName = itemName;
  }
  if (body.memo !== undefined) updated.memo = cleanOptionalText(body.memo ?? undefined);
  if (body.expenseType !== undefined) updated.expenseType = body.expenseType;
  if (body.paymentMethodId !== undefined) {
    if (body.paymentMethodId === null) {
      updated.paymentMethodId = null;
      updated.paymentMethod = body.paymentMethod ?? "unknown";
    } else {
      const method = requireLocalPaymentMethod(body.paymentMethodId, body.paymentMethodId !== expense.paymentMethodId);
      updated.paymentMethodId = method.id;
      updated.paymentMethod = method.type;
    }
  } else if (body.paymentMethod !== undefined) {
    updated.paymentMethod = body.paymentMethod;
  }
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
  requireChild(childId);
  const normalizedMonth = budgetKey(yearMonth);
  const amountKrw = budgetAmountFor(childId, normalizedMonth);
  if (amountKrw === undefined) {
    throw new Error("월 예산을 찾을 수 없어요.");
  }
  return toBudgetDto(childId, normalizedMonth, amountKrw);
}

export function upsertBudget(childId: string, amountKrw: number, yearMonth: string): Budget {
  requireChild(childId);
  const normalizedMonth = budgetKey(yearMonth);
  const validAmount = requireMoneyKrw(amountKrw);
  useLocalBackendStore.setState((state) => ({
    budgets: { ...state.budgets, [budgetStorageKey(childId, normalizedMonth)]: validAmount }
  }));
  return toBudgetDto(childId, normalizedMonth, validAmount);
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export function getMonthlyReport(childId: string, yearMonth: string): MonthlyReport {
  ensureSeeded();
  const normalizedMonth = budgetKey(yearMonth);
  const expenses = realizedExpensesForChild(childId, normalizedMonth);
  const budgetAmountKrw = budgetAmountFor(childId, normalizedMonth) ?? null;
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
  const expenses = realizedExpensesForChild(childId).filter((expense) => expense.expenseType === "expense");
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
  return { childId, categories: categoryBreakdown(realizedExpensesForChild(childId, normalizedMonth)) };
}

export function getYearlyReport(childId: string, year: number): YearlyReport {
  ensureSeeded();
  const normalizedYear = String(year);
  const monthlyTotals = Array.from({ length: 12 }, (_, index) => {
    const yearMonth = `${normalizedYear}-${String(index + 1).padStart(2, "0")}`;
    return { yearMonth, totalExpenseKrw: totalExpenseKrw(realizedExpensesForChild(childId, yearMonth)) };
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

function catalogPlanKey(contextId: string, itemId: string) {
  return `${contextId}:${itemId}`;
}

type LocalReportTotals = ReportSummaryContract["totals"];

function localReportPeriod(childId: string, kind: ReportV2Period, anchor: string): ReportSummaryContract["period"] {
  const parsed = new Date(`${anchor}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor) || Number.isNaN(parsed.getTime())) throw new Error("리포트 기준일이 올바르지 않아요.");
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  const start = kind === "month"
    ? new Date(Date.UTC(year, month, 1))
    : kind === "quarter"
      ? new Date(Date.UTC(year, Math.floor(month / 3) * 3, 1))
      : new Date(Date.UTC(year, 0, 1));
  const endExclusive = kind === "month"
    ? new Date(Date.UTC(year, month + 1, 1))
    : kind === "quarter"
      ? new Date(Date.UTC(year, Math.floor(month / 3) * 3 + 3, 1))
      : new Date(Date.UTC(year + 1, 0, 1));
  const from = start.toISOString().slice(0, 10);
  const to = new Date(endExclusive.getTime() - 86_400_000).toISOString().slice(0, 10);
  return {
    householdId: LOCAL_HOUSEHOLD_ID,
    childId,
    kind,
    anchor,
    periodStart: from,
    periodEnd: to,
    periodEndExclusive: endExclusive.toISOString().slice(0, 10),
    timezone: "Asia/Seoul",
    currency: "KRW",
    from,
    to
  };
}

function localReportRows(childId: string, from: string, to: string) {
  ensureSeeded();
  const today = getSeoulToday();
  return useLocalBackendStore.getState().expenses.filter((row) => row.childId === childId && !row.deletedAt && row.spentOn >= from && row.spentOn <= to && row.spentOn <= today);
}

function localReportTotals(rows: LocalExpenseRecord[]): LocalReportTotals {
  const totals: LocalReportTotals = { expenseKrw: 0, giftKrw: 0, refundKrw: 0, supportKrw: 0, netHouseholdOutflowKrw: 0, linkedPreparationCostKrw: 0, unlinkedCostKrw: 0, recordCount: 0 };
  for (const row of rows) {
    if (row.expenseType === "expense") totals.expenseKrw += row.amountKrw;
    else if (row.expenseType === "gift") totals.giftKrw += row.amountKrw;
    else if (row.expenseType === "refund") totals.refundKrw += row.amountKrw;
    else totals.supportKrw += row.amountKrw;
    const signed = row.expenseType === "expense" ? row.amountKrw : row.expenseType === "refund" || row.expenseType === "support" ? -row.amountKrw : 0;
    if (row.linkedItemDefinitionId) totals.linkedPreparationCostKrw += signed;
    else totals.unlinkedCostKrw += signed;
    totals.netHouseholdOutflowKrw += signed;
    totals.recordCount += 1;
  }
  return totals;
}

function localReportMaturity(rows: LocalExpenseRecord[]): ReportSummaryContract["maturity"] {
  const distinctMonths = new Set(rows.map((row) => row.spentOn.slice(0, 7))).size;
  const distinctMembers = rows.length ? 1 : 0;
  const showCategories = rows.length >= 1;
  const showTrend = distinctMonths >= 2;
  const showRecurring = distinctMonths >= 3;
  const showAnnual = distinctMonths >= 12;
  return { recordCount: rows.length, distinctMonths, distinctMembers, level: rows.length === 0 ? "empty" : rows.length < 3 ? "sparse" : showAnnual ? "annual" : showRecurring ? "recurring" : showTrend ? "trend" : "categorized", showCategories, showTrend, showRecurring, showMembers: false, showAnnual };
}

export function getReportV2Summary(childId: string, kind: ReportV2Period, anchor: string): ReportSummaryContract {
  const period = localReportPeriod(childId, kind, anchor);
  const rows = localReportRows(childId, period.from, period.to);
  const currentTotals = localReportTotals(rows);
  const start = new Date(`${period.periodStart}T00:00:00.000Z`);
  const previousAnchor = kind === "month"
    ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1))
    : kind === "quarter"
      ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 3, 1))
      : new Date(Date.UTC(start.getUTCFullYear() - 1, 0, 1));
  const previousPeriod = localReportPeriod(childId, kind, previousAnchor.toISOString().slice(0, 10));
  const previousTotals = localReportTotals(localReportRows(childId, previousPeriod.from, previousPeriod.to));
  const deltaKrw = currentTotals.netHouseholdOutflowKrw - previousTotals.netHouseholdOutflowKrw;
  const maturity = localReportMaturity(rows);
  const categoryBreakdown = getReportV2Categories(childId, kind, anchor).categories.map(({ categoryId: _categoryId, ...category }) => category);
  const series = getReportV2Trend(childId, kind, anchor, kind === "quarter" || kind === "year" ? "month" : "day").buckets;
  return {
    period,
    totals: currentTotals,
    periodStart: period.periodStart,
    periodEndExclusive: period.periodEndExclusive,
    timezone: period.timezone,
    currency: period.currency,
    expenseTotal: currentTotals.expenseKrw,
    refundTotal: currentTotals.refundKrw,
    giftTotal: currentTotals.giftKrw,
    supportTotal: currentTotals.supportKrw,
    netOutflow: currentTotals.netHouseholdOutflowKrw,
    categoryBreakdown,
    series,
    dataMaturity: maturity,
    previousPeriodComparison: {
      periodStart: previousPeriod.periodStart,
      periodEnd: previousPeriod.periodEnd,
      currentNetOutflowKrw: currentTotals.netHouseholdOutflowKrw,
      previousNetOutflowKrw: previousTotals.netHouseholdOutflowKrw,
      deltaKrw,
      deltaPercentage: previousTotals.netHouseholdOutflowKrw === 0 ? null : Math.round((deltaKrw / previousTotals.netHouseholdOutflowKrw) * 1000) / 10
    },
    maturity,
    recent: [...rows].sort((a, b) => b.spentOn.localeCompare(a.spentOn)).slice(0, 5).map((row) => ({ id: row.id, spentOn: row.spentOn, itemName: row.itemName, expenseType: row.expenseType, amountKrw: row.amountKrw }))
  };
}

export function getReportV2Categories(childId: string, kind: ReportV2Period, anchor: string): ReportCategoriesContract {
  const period = localReportPeriod(childId, kind, anchor);
  const rows = localReportRows(childId, period.from, period.to);
  const grouped = new Map<string, LocalExpenseRecord[]>();
  for (const row of rows) grouped.set(row.categoryId, [...(grouped.get(row.categoryId) ?? []), row]);
  const raw = [...grouped.entries()]
    .map(([categoryId, entries]) => ({
      categoryId,
      categoryCode: categoryId,
      categoryNameKo: categoryNameFor(categoryId),
      ...localReportTotals(entries)
    }))
    .sort((a, b) => b.netHouseholdOutflowKrw - a.netHouseholdOutflowKrw);
  const denominator = raw.reduce((sum, entry) => sum + Math.max(0, entry.netHouseholdOutflowKrw), 0);
  let assigned = 0;
  const categories = raw.map((entry, index) => {
    const percentage = denominator === 0 ? 0 : index === raw.length - 1 ? Math.round((100 - assigned) * 100) / 100 : Math.round((Math.max(0, entry.netHouseholdOutflowKrw) / denominator) * 10000) / 100;
    assigned += percentage;
    return { ...entry, percentage };
  });
  return { period, categories, percentageTotal: Math.round(assigned * 100) / 100, maturity: localReportMaturity(rows) };
}

export function getReportV2Trend(childId: string, kind: ReportV2Period, anchor: string, unit: "day" | "month"): ReportTrendContract {
  const period = localReportPeriod(childId, kind, anchor);
  const rows = localReportRows(childId, period.from, period.to);
  const grouped = new Map<string, LocalExpenseRecord[]>();
  for (const row of rows) {
    const key = unit === "month" ? row.spentOn.slice(0, 7) : row.spentOn;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const buckets = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, entries]) => ({ key, label: unit === "month" ? `${Number(key.slice(5))}월` : key.slice(5).replace("-", "/"), ...localReportTotals(entries) }));
  return { period, unit, buckets, maturity: localReportMaturity(rows) };
}

export function getReportV2Members(childId: string, kind: ReportV2Period, anchor: string): ReportMembersContract {
  const period = localReportPeriod(childId, kind, anchor);
  const rows = localReportRows(childId, period.from, period.to);
  const totals = localReportTotals(rows);
  return { period, members: rows.length ? [{ userId: LOCAL_USER_ID, displayName: "엄마", ...totals, percentage: 100 }] : [], percentageTotal: rows.length ? 100 : 0, maturity: localReportMaturity(rows) };
}

export function getReportV2Preparation(childId: string, kind: ReportV2Period, anchor: string): ReportPreparationContract {
  const period = localReportPeriod(childId, kind, anchor);
  const rows = localReportRows(childId, period.from, period.to);
  const linked = rows.filter((row) => row.linkedItemDefinitionId);
  const groups = new Map<"required" | "recommended" | "conditional" | "optional" | "unknown", LocalExpenseRecord[]>();
  for (const row of linked) {
    const necessity = catalogDomain.release4CatalogItems.find((item) => item.code === row.linkedItemDefinitionId)?.necessity ?? "unknown";
    groups.set(necessity, [...(groups.get(necessity) ?? []), row]);
  }
  const labels = { required: "필수 준비", recommended: "권장 준비", conditional: "상황별 준비", optional: "선택 준비", unknown: "기타 준비" } as const;
  const plannedBudgetKrw = Object.values(useLocalBackendStore.getState().itemPlans).filter((plan) => ["need", "researching", "planned", "ordered", "replacement_needed"].includes(plan.state)).reduce((sum, plan) => sum + (plan.budgetKrw ?? 0), 0);
  return { period, groups: [...groups.entries()].map(([necessity, entries]) => ({ necessity, label: labels[necessity], ...localReportTotals(entries) })), plannedBudgetKrw, maturity: localReportMaturity(rows) };
}

export function getReportV2Recurring(childId: string, kind: ReportV2Period, anchor: string): ReportRecurringContract {
  const period = localReportPeriod(childId, kind, anchor);
  const rows = localReportRows(childId, period.from, period.to);
  const maturity = localReportMaturity(rows);
  if (!maturity.showRecurring) return { period, items: [], maturity };
  const grouped = new Map<string, LocalExpenseRecord[]>();
  for (const row of rows.filter((entry) => entry.expenseType === "expense")) {
    const key = `${row.merchant ?? ""}::${row.itemName}`.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\s\p{P}\p{S}]/gu, "");
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const items = [...grouped.entries()].flatMap(([key, entries]) => {
    const distinctMonths = new Set(entries.map((entry) => entry.spentOn.slice(0, 7))).size;
    if (distinctMonths < 2) return [];
    const totalExpenseKrw = entries.reduce((sum, entry) => sum + entry.amountKrw, 0);
    return [{ key, itemName: entries[0].itemName, merchant: entries[0].merchant, totalExpenseKrw, recordCount: entries.length, distinctMonths, averageExpenseKrw: Math.round(totalExpenseKrw / entries.length), latestSpentOn: entries.reduce((latest, entry) => entry.spentOn > latest ? entry.spentOn : latest, entries[0].spentOn) }];
  });
  return { period, items, maturity };
}

export function getReportV3(childId: string, kind: ReportV2Period, anchor: string): ReportV3Contract {
  const period = localReportPeriod(childId, kind, anchor);
  const rows = localReportRows(childId, period.from, period.to);
  const linkedRows = rows.filter((row) => row.linkedItemDefinitionId);
  const ledger = localReportTotals(rows);
  const actualPreparationCostKrw = localReportTotals(linkedRows).netHouseholdOutflowKrw;
  const plans = Object.values(useLocalBackendStore.getState().itemPlans).filter((plan) => plan.childId === childId && !["not_considered", "not_needed", "retired", "ended"].includes(plan.state));
  const scheduledPlans = plans.filter((plan) => plan.dueDate && plan.dueDate >= period.from && plan.dueDate <= period.to);
  const unscheduledPlans = plans.filter((plan) => !plan.dueDate);
  const reportPlans = [...scheduledPlans, ...unscheduledPlans];
  const plannedPreparationCostKrw = reportPlans.reduce((sum, plan) => sum + (plan.budgetKrw ?? 0), 0);
  const splitKeys = ["essential", "convenience", "optional"] as const;
  const necessitySplit = splitKeys.map((key) => {
    const planRows = reportPlans.filter((plan) => {
      const necessity = catalogDomain.release4CatalogItems.find((item) => `local-item-${item.code}` === plan.itemDefinitionId)?.necessity;
      return key === "essential" ? necessity === "required" : key === "optional" ? necessity === "optional" : necessity !== "required" && necessity !== "optional";
    });
    const expenseRows = linkedRows.filter((row) => {
      const necessity = catalogDomain.release4CatalogItems.find((item) => `local-item-${item.code}` === row.linkedItemDefinitionId)?.necessity;
      return key === "essential" ? necessity === "required" : key === "optional" ? necessity === "optional" : necessity !== "required" && necessity !== "optional";
    });
    const plannedCostKrw = planRows.reduce((sum, plan) => sum + (plan.budgetKrw ?? 0), 0);
    const actualCostKrw = localReportTotals(expenseRows).netHouseholdOutflowKrw;
    return { key, plannedCostKrw, actualCostKrw, remainingPlannedCostKrw: Math.max(0, plannedCostKrw - Math.max(0, actualCostKrw)), planCount: planRows.length, recordCount: expenseRows.length };
  });
  const remainingPlannedCostKrw = Math.max(0, plannedPreparationCostKrw - Math.max(0, actualPreparationCostKrw));
  const recurringPlans = reportPlans.filter((plan) => plan.recurringIntervalDays);
  const recurringItemIds = new Set(recurringPlans.map((plan) => plan.itemDefinitionId));
  const recurringActualRows = linkedRows.filter((row) => recurringItemIds.has(row.linkedItemDefinitionId!));
  const monthlyRecurringEstimateKrw = recurringPlans.reduce(
    (sum, plan) => sum + Math.round((plan.budgetKrw ?? 0) * 30.4375 / plan.recurringIntervalDays!),
    0
  );
  const maturity = localReportMaturity(rows);
  const categories = getReportV2Categories(childId, kind, anchor).categories;
  const trendUnit = kind === "quarter" || kind === "year" ? "month" as const : "day" as const;
  const trend = getReportV2Trend(childId, kind, anchor, trendUnit);
  const start = new Date(`${period.periodStart}T00:00:00.000Z`);
  const previousAnchor = kind === "month"
    ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1))
    : kind === "quarter"
      ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 3, 1))
      : new Date(Date.UTC(start.getUTCFullYear() - 1, 0, 1));
  const previousPeriod = localReportPeriod(childId, kind, previousAnchor.toISOString().slice(0, 10));
  const previousTotals = localReportTotals(localReportRows(childId, previousPeriod.from, previousPeriod.to));
  const deltaKrw = ledger.netHouseholdOutflowKrw - previousTotals.netHouseholdOutflowKrw;
  const reportState = resolveReportV3State({
    actualRecordCount: ledger.recordCount,
    plannedPreparationCostKrw,
    recurringPlanCount: recurringPlans.length,
    monthlyRecurringEstimateKrw
  });
  return {
    period,
    maturity,
    reportState,
    summary: {
      plannedPreparationCostKrw,
      scheduledPlannedCostKrw: scheduledPlans.reduce((sum, plan) => sum + (plan.budgetKrw ?? 0), 0),
      unscheduledPlannedCostKrw: unscheduledPlans.reduce((sum, plan) => sum + (plan.budgetKrw ?? 0), 0),
      actualPreparationCostKrw,
      remainingPlannedCostKrw,
      budgetVarianceKrw: actualPreparationCostKrw - plannedPreparationCostKrw,
      unscheduledPlanCount: unscheduledPlans.length,
      nextDueDate: scheduledPlans.flatMap((plan) => plan.dueDate ? [plan.dueDate] : []).sort()[0] ?? null
    },
    necessitySplit,
    costNature: {
      oneTime: {
        plannedCostKrw: reportPlans.filter((plan) => !plan.recurringIntervalDays).reduce((sum, plan) => sum + (plan.budgetKrw ?? 0), 0),
        actualCostKrw: localReportTotals(linkedRows.filter((row) => !recurringItemIds.has(row.linkedItemDefinitionId!))).netHouseholdOutflowKrw
      },
      recurring: {
        plannedCostKrw: recurringPlans.reduce((sum, plan) => sum + (plan.budgetKrw ?? 0), 0),
        actualCostKrw: localReportTotals(recurringActualRows).netHouseholdOutflowKrw,
        monthlyEstimateKrw: monthlyRecurringEstimateKrw,
        planCount: recurringPlans.length
      }
    },
    payerContributions: rows.length ? [{ payerUserId: LOCAL_USER_ID, displayName: "엄마", ...ledger, percentage: 100 }] : [],
    ledger,
    categories,
    trend: { unit: trend.unit, buckets: trend.buckets },
    previousPeriodComparison: {
      currentNetOutflowKrw: ledger.netHouseholdOutflowKrw,
      previousNetOutflowKrw: previousTotals.netHouseholdOutflowKrw,
      deltaKrw,
      deltaPercentage: previousTotals.netHouseholdOutflowKrw === 0
        ? null
        : Math.round((deltaKrw / previousTotals.netHouseholdOutflowKrw) * 1000) / 10
    },
    forecast: null,
    forecastUnavailableReason: "At least three scheduled plan budgets and three linked expense records are required.",
    selectorProvenance: "All sections use the same KST report period and expense ledger selector."
  };
}

export function getReportV3Sources(
  childId: string,
  kind: ReportV2Period,
  anchor: string,
  sourceKind: ReportSourceKind,
  cursor?: string,
  limit = 30
): ReportSourcesContract {
  const period = localReportPeriod(childId, kind, anchor);
  const rows = localReportRows(childId, period.from, period.to);
  const plans = Object.values(useLocalBackendStore.getState().itemPlans).filter(
    (plan) =>
      plan.childId === childId &&
      !["not_considered", "not_needed", "retired", "ended"].includes(plan.state)
  );
  const scheduledPlans = plans.filter(
    (plan) => plan.dueDate && plan.dueDate >= period.from && plan.dueDate <= period.to
  );
  const unscheduledPlans = plans.filter((plan) => !plan.dueDate);
  const reportPlans = [...scheduledPlans, ...unscheduledPlans];

  const items: ReportSourcesContract["items"] =
    sourceKind === "planned" || sourceKind === "unscheduled_planned" || sourceKind === "recurring_planned"
      ? (sourceKind === "unscheduled_planned"
          ? unscheduledPlans
          : sourceKind === "recurring_planned"
            ? reportPlans.filter((plan) => Boolean(plan.recurringIntervalDays))
            : reportPlans
        ).map((plan) => {
          const amountKrw = sourceKind === "recurring_planned" && plan.recurringIntervalDays
            ? Math.round((plan.budgetKrw ?? 0) * 30.4375 / plan.recurringIntervalDays)
            : (plan.budgetKrw ?? 0);
          const catalogItem = catalogDomain.release4CatalogItems.find(
            (item) => `local-item-${item.code}` === plan.itemDefinitionId
          );
          return {
            sourceType: "plan" as const,
            id: plan.id,
            itemDefinitionId: plan.itemDefinitionId,
            itemName: catalogItem?.nameKo ?? "준비 항목",
            state: plan.state,
            amountKrw,
            signedAmountKrw: amountKrw,
            dueDate: plan.dueDate,
            recurringIntervalDays: plan.recurringIntervalDays ?? null
          };
        })
      : (sourceKind === "actual_preparation"
          ? rows.filter((row) => Boolean(row.linkedItemDefinitionId))
          : sourceKind === "household_net"
            ? rows
            : rows.filter((row) => row.expenseType === sourceKind)
        ).map((row) => ({
          sourceType: "expense" as const,
          id: row.id,
          itemName: row.itemName,
          amountKrw: row.amountKrw,
          signedAmountKrw:
            row.expenseType === "expense"
              ? row.amountKrw
              : row.expenseType === "refund" || row.expenseType === "support"
                ? -row.amountKrw
                : 0,
          spentOn: row.spentOn,
          expenseType: row.expenseType,
          payerUserId: row.payerUserId ?? LOCAL_USER_ID,
          payerDisplayName: "엄마",
          linkedItemDefinitionId: row.linkedItemDefinitionId
        }));
  const start = cursor ? Math.max(0, Number.parseInt(cursor, 10)) : 0;
  const page = items.slice(start, start + limit);
  return {
    period,
    kind: sourceKind,
    items: page,
    totals: {
      amountKrw: items.reduce((sum, item) => sum + item.amountKrw, 0),
      signedAmountKrw: items.reduce((sum, item) => sum + item.signedAmountKrw, 0),
      recordCount: items.length
    },
    pageTotals: {
      amountKrw: page.reduce((sum, item) => sum + item.amountKrw, 0),
      signedAmountKrw: page.reduce((sum, item) => sum + item.signedAmountKrw, 0),
      recordCount: page.length
    },
    nextCursor: start + page.length < items.length ? String(start + page.length) : null
  };
}

function localCatalogNode(code: string): CatalogNodeSummary {
  const node = catalogDomain.release4CatalogNodes.find((entry) => entry.code === code);
  if (!node) throw new Error("준비 분류를 찾을 수 없어요.");
  return {
    id: `local-node-${node.code}`,
    code: node.code,
    parentId: node.parentCode ? `local-node-${node.parentCode}` : null,
    level: node.level,
    nameKo: node.nameKo,
    description: null,
    iconKey: null,
    displayOrder: node.displayOrder
  };
}

function localCatalogPlan(childId: string | undefined, motherProfileId: string | undefined, itemId: string) {
  const contextId = motherProfileId ? `mother-${motherProfileId}` : childId;
  return contextId ? useLocalBackendStore.getState().itemPlans[catalogPlanKey(contextId, itemId)] ?? null : null;
}

function toCatalogItemSummary(item: Release4CatalogItem, childId?: string, motherProfileId?: string): CatalogItemSummary {
  const plan = localCatalogPlan(childId, motherProfileId, item.code);
  return {
    id: item.code,
    code: item.code,
    nameKo: item.nameKo,
    shortDescription: `${item.nameKo}의 필요 여부와 준비 상태를 관리하는 일반 품목입니다.`,
    targetSubject: item.targetSubject,
    necessity: item.necessity,
    recommendationState: item.recommendationState,
    timingSummary: "연결된 생애주기와 실제 생활 계획을 함께 확인하세요.",
    safetyTier: item.safetyTier,
    safetyNote: item.safetyTier === "high"
      ? "안전·의학 관련 조건은 판매 상품보다 전문가 확인과 최신 공공 지침 확인이 우선입니다."
      : item.safetyTier === "elevated"
        ? "사용 환경과 대상 연령을 확인하고 제조사 안전 안내를 따르세요."
        : null,
    status: "in_review",
    primaryCategory: localCatalogNode(item.subcategoryCode),
    plan: plan ? {
      state: plan.state, desiredQuantity: plan.desiredQuantity, ownedQuantity: plan.ownedQuantity,
      quantityNeeded: plan.desiredQuantity, quantityOwned: plan.ownedQuantity, dueDate: plan.dueDate,
      acquisitionMode: plan.acquisitionMode, acquisitionType: plan.acquisitionMode, assignedUserId: plan.assignedUserId,
      budgetKrw: plan.budgetKrw, note: plan.note, notes: plan.note, size: plan.size, variant: plan.variant,
      purchasedAt: plan.purchasedAt, openedAt: plan.openedAt, expiresAt: plan.expiresAt,
      replacementDueAt: plan.replacementDueAt, usageEndedAt: plan.usageEndedAt, storageLocation: plan.storageLocation,
      recurringIntervalDays: plan.recurringIntervalDays, nextPurchaseDueAt: plan.nextPurchaseDueAt, version: plan.version
    } : null
  };
}

function normalizeCatalogSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\s\p{P}\p{S}]/gu, "");
}

const localKoreanInitials = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"] as const;

function catalogInitials(value: string) {
  return [...value.normalize("NFC")].map((char) => {
    const offset = char.charCodeAt(0) - 0xac00;
    return offset >= 0 && offset < 11_172 ? localKoreanInitials[Math.floor(offset / 588)] : char;
  }).join("").replace(/[\s\p{P}\p{S}]/gu, "").toLocaleLowerCase("ko-KR");
}

function catalogEditDistance(left: string, right: string) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) current[rightIndex] = Math.min(current[rightIndex - 1]! + 1, previous[rightIndex]! + 1, previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1));
    previous = current;
  }
  return previous[right.length]!;
}

function catalogCommonPrefixLength(left: string, right: string) {
  let length = 0;
  while (length < left.length && length < right.length && left[length] === right[length]) length += 1;
  return length;
}

function localCatalogSearchMatch(item: Release4CatalogItem, rawQuery: string): CatalogItemSummary["searchMatch"] {
  const query = normalizeCatalogSearch(rawQuery);
  const code = normalizeCatalogSearch(item.code);
  const canonical = normalizeCatalogSearch(item.nameKo);
  const initials = catalogInitials(rawQuery);
  if (code === query || code.includes(query)) return { score: code === query ? 98 : 88, reason: "code", matchedText: item.code };
  if (canonical === query) return { score: 100, reason: "canonical_exact", matchedText: item.nameKo };
  const exactAlias = item.aliases.find((alias) => normalizeCatalogSearch(alias) === query);
  if (exactAlias) return { score: 95, reason: "alias_exact", matchedText: exactAlias };
  if (canonical.startsWith(query) || query.startsWith(canonical)) return { score: 90, reason: "canonical_prefix", matchedText: item.nameKo };
  const containing = item.aliases.find((alias) => normalizeCatalogSearch(alias).includes(query));
  if (containing) return { score: 80, reason: "alias_contains", matchedText: containing };
  if (initials.length >= 2 && catalogInitials(item.nameKo).includes(initials)) return { score: 75, reason: "initials", matchedText: item.nameKo };
  const initialAlias = item.aliases.find((candidate) => initials.length >= 2 && catalogInitials(candidate).includes(initials));
  if (initialAlias) return { score: 72, reason: "initials", matchedText: initialAlias };
  if (query.length >= 3) {
    const threshold = query.length >= 7 ? 2 : 1;
    const typo = [item.nameKo, ...item.aliases].map((candidate) => {
      const normalized = normalizeCatalogSearch(candidate);
      return { candidate, normalized, distance: catalogEditDistance(normalized, query), prefix: catalogCommonPrefixLength(normalized, query) };
    }).filter((candidate) => Math.abs(candidate.normalized.length - query.length) <= 2 && candidate.distance <= threshold)
      .sort((left, right) => left.distance - right.distance || right.prefix - left.prefix || Math.abs(left.normalized.length - query.length) - Math.abs(right.normalized.length - query.length))[0];
    if (typo) return { score: 60 + (threshold - typo.distance) * 4 + Math.min(typo.prefix, 4), reason: "typo", matchedText: typo.candidate };
  }
  const category = [item.domainCode, item.categoryCode, item.subcategoryCode].map((code) => catalogDomain.release4CatalogNodes.find((node) => node.code === code)?.nameKo ?? "").find((name) => normalizeCatalogSearch(name).includes(query));
  return category ? { score: 50, reason: "category", matchedText: category } : undefined;
}

export function listCatalogDomains() {
  const nodes = catalogDomain.release4CatalogNodes.map((node) => localCatalogNode(node.code));
  return {
    domains: nodes.filter((node) => node.level === "domain").map((domain) => ({
      ...domain,
      children: nodes.filter((node) => node.parentId === domain.id).map((category) => ({
        ...category,
        children: nodes.filter((node) => node.parentId === category.id)
      }))
    }))
  };
}

export function getCatalogContexts() {
  return {
    motherProfiles: [
      {
        id: LOCAL_MOTHER_PROFILE_ID,
        householdId: LOCAL_HOUSEHOLD_ID,
        childId: LOCAL_CHILD_ID,
        dueDate: localMotherDueDate(),
        active: true
      }
    ]
  };
}

export function listCatalogItems(query: CatalogListQuery = {}) {
  ensureSeeded();
  const normalizedQuery = query.query ? normalizeCatalogSearch(query.query) : null;
  const searchMatches = normalizedQuery ? new Map<string, NonNullable<CatalogItemSummary["searchMatch"]>>() : null;
  if (normalizedQuery && searchMatches) {
    for (const item of catalogDomain.release4CatalogItems) {
      const match = localCatalogSearchMatch(item, query.query!);
      if (match) searchMatches.set(item.code, match);
    }
  }
  const filtered = catalogDomain.release4CatalogItems.filter((item) => {
    if (query.domainCode && item.domainCode !== query.domainCode) return false;
    if (query.lifecycleAxis && !item.lifecycles.some((rule) => rule.axis === query.lifecycleAxis)) return false;
    if (query.lifecycleCode && !item.lifecycles.some((rule) => rule.code === query.lifecycleCode)) return false;
    if (query.contextCode && !item.scenarioCodes.includes(query.contextCode as (typeof item.scenarioCodes)[number])) return false;
    if (query.necessity && item.necessity !== query.necessity) return false;
    if (query.safetyTier && item.safetyTier !== query.safetyTier) return false;
    if (query.secondhandPolicy && (item.safetyTier === "normal" ? "allowed" : "inspect") !== query.secondhandPolicy) return false;
    if (query.rentalPolicy && "conditional" !== query.rentalPolicy) return false;
    if (normalizedQuery && !searchMatches?.has(item.code)) return false;
    if (query.state && (query.childId || query.motherProfileId)) {
      const state = localCatalogPlan(query.childId, query.motherProfileId, item.code)?.state ?? "not_considered";
      if (state !== query.state) return false;
    }
    return true;
  }).sort((left, right) =>
    (searchMatches?.get(right.code)?.score ?? 0) - (searchMatches?.get(left.code)?.score ?? 0)
    || left.displayOrder - right.displayOrder
    || left.code.localeCompare(right.code)
  );
  const limit = Math.min(100, Math.max(1, query.limit ?? 40));
  const startIndex = query.cursor ? Math.max(0, filtered.findIndex((item) => item.code === query.cursor) + 1) : 0;
  const page = filtered.slice(startIndex, startIndex + limit);
  return {
    items: page.map((item) => ({ ...toCatalogItemSummary(item, query.childId, query.motherProfileId), ...(searchMatches?.get(item.code) ? { searchMatch: searchMatches.get(item.code) } : {}) })),
    nextCursor: startIndex + limit < filtered.length ? page.at(-1)?.code ?? null : null,
    total: filtered.length,
    ...(normalizedQuery ? { search: { normalizedQueryLength: normalizedQuery.length, matchedCount: filtered.length, rawQueryStored: false as const } } : {})
  };
}

export function reportMissingCatalogItem(requestedName: string, detail?: string) {
  const normalized = normalizeCatalogSearch(requestedName);
  if (!normalized) throw new Error("신고할 품목 이름을 입력해 주세요.");
  const key = `catalog-missing:${normalized}`;
  const existingId = useLocalBackendStore.getState().idempotencyKeys[key];
  const id = existingId ?? `local-missing-item-${normalized}`;
  if (!existingId) useLocalBackendStore.setState((state) => ({ idempotencyKeys: { ...state.idempotencyKeys, [key]: id } }));
  return {
    report: { id, reasonCode: "missing_item" as const, state: "open" as const, reportedText: requestedName.trim(), detail: detail?.trim() || null },
    idempotent: Boolean(existingId)
  };
}

export function getCatalogSafetyAlerts(childId?: string, motherProfileId?: string) {
  if (Boolean(childId) === Boolean(motherProfileId)) throw new Error("아이 또는 산모 준비 대상을 하나만 선택해 주세요.");
  if (childId) requireChild(childId);
  if (motherProfileId && motherProfileId !== LOCAL_MOTHER_PROFILE_ID) throw new Error("산모 프로필을 찾을 수 없어요.");
  if (process.env.EXPO_PUBLIC_SAFETY_ALTERNATIVE_FIXTURE === "1" && childId) {
    const source = catalogDomain.release4CatalogItems[0]!;
    const item = toCatalogItemSummary(source, childId);
    const alertId = localSafetyAlternativeAlertId(childId);
    if (useLocalBackendStore.getState().acknowledgedSafetyAlertIds.includes(alertId)) {
      return { alerts: [] };
    }
    const alert: CatalogSafetyAlert = {
      id: alertId,
      itemDefinitionId: source.code,
      userItemPlanId: "local-safety-alternative-plan",
      eventType: "provider_recalled",
      reason: "제조사 공식 리콜 안내가 확인되었어요.",
      itemContentVersion: 1,
      state: "unread",
      acknowledgedAt: null,
      version: 1,
      createdAt: "2026-07-26T00:00:00.000Z",
      planState: "owned",
      item,
      actionGuidance: "사용을 중지하고 검증된 대체 품목과 검증 근거를 확인해 주세요.",
      sourceStatus: "official_or_professional_source_required"
    };
    return { alerts: [alert] };
  }
  const alertId = childId ? localTodaySafetyAlertId(childId) : null;
  if (!childId || !alertId || useLocalBackendStore.getState().acknowledgedSafetyAlertIds.includes(alertId)) {
    return { alerts: [] };
  }
  const source = catalogDomain.release4CatalogItems.find((item) => item.nameKo.includes("기저귀"))
    ?? catalogDomain.release4CatalogItems[0]!;
  const item = toCatalogItemSummary(source, childId);
  const alert: CatalogSafetyAlert = {
    id: alertId,
    itemDefinitionId: LOCAL_ITEM_DIAPER,
    userItemPlanId: "local-today-safety-plan",
    eventType: "provider_recalled",
    reason: "공식 안전 안내가 확인되었어요.",
    itemContentVersion: 1,
    state: "unread",
    acknowledgedAt: null,
    version: 1,
    createdAt: "2026-07-26T00:00:00.000Z",
    planState: "owned",
    item: {
      ...item,
      id: LOCAL_ITEM_DIAPER,
      code: LOCAL_ITEM_DIAPER,
      nameKo: "기저귀"
    },
    actionGuidance: "사용을 멈추고 공식 안내를 확인한 뒤 확인 완료를 눌러 주세요.",
    sourceStatus: "official_or_professional_source_required"
  };
  return { alerts: [alert] };
}

export function acknowledgeCatalogSafetyAlert(alertId: string, expectedVersion: number): CatalogSafetyAlert {
  const scopedChildId = childIdFromLocalTodaySafetyAlertId(alertId);
  const alternativeChildId = childIdFromLocalSafetyAlternativeAlertId(alertId);
  const alertChildId = scopedChildId && activeChildren().some((child) => child.id === scopedChildId)
    ? scopedChildId
    : alternativeChildId && activeChildren().some((child) => child.id === alternativeChildId)
      ? alternativeChildId
      : null;
  const alert = alertChildId
    ? getCatalogSafetyAlerts(alertChildId).alerts.find((entry) => entry.id === alertId)
    : null;
  if (!alert) throw localApiError("SAFETY_ALERT_NOT_FOUND", "확인할 안전 알림이 없어요.");
  if (alert.version !== expectedVersion) {
    throw localApiError("SAFETY_ALERT_CONFLICT", "안전 알림 상태가 달라졌어요.");
  }
  useLocalBackendStore.setState((state) => ({
    acknowledgedSafetyAlertIds: [...new Set([...state.acknowledgedSafetyAlertIds, alertId])]
  }));
  return { ...alert, state: "acknowledged", acknowledgedAt: new Date().toISOString(), version: alert.version + 1 };
}

export function listLocalNotifications(): { items: NotificationInboxItem[]; nextCursor: null } {
  ensureSeeded();
  const acknowledged = new Set(useLocalBackendStore.getState().acknowledgedSafetyAlertIds);
  const items: NotificationInboxItem[] = activeChildren()
    .filter((child) => !acknowledged.has(localTodaySafetyAlertId(child.id)))
    .map((child) => ({
      id: child.id,
      eventType: "provider_recalled",
      category: "safety" as const,
      title: `${child.nickname} · 기저귀 공식 안전 안내`,
      body: "선택한 아이의 준비 화면에서 안전 안내를 확인해 주세요.",
      importance: "critical" as const,
      route: "preparation" as const,
      navigation: {
        kind: "item" as const,
        householdId: LOCAL_HOUSEHOLD_ID,
        childId: child.id,
        itemId: LOCAL_ITEM_DIAPER
      },
      requiresAcknowledgement: true,
      read: false,
      occurredAt: "2026-07-26T00:00:00.000Z"
    }));
  return { items, nextCursor: null };
}

export function getCatalogSafetyAlternatives(alertId: string): CatalogSafetyAlternativesResponse {
  const childId = childIdFromLocalSafetyAlternativeAlertId(alertId);
  if (
    process.env.EXPO_PUBLIC_SAFETY_ALTERNATIVE_FIXTURE !== "1"
    || !childId
    || !activeChildren().some((child) => child.id === childId)
  ) {
    return {
      state: "review_required",
      actionGuidance: "공식 안내를 확인해 주세요.",
      alternatives: []
    };
  }
  const alternative = catalogDomain.release4CatalogItems[1]!;
  return {
    state: "recalled",
    actionGuidance: "사용을 중지하고 공식 안내를 확인해 주세요.",
    alternatives: [{
      id: alternative.code,
      nameKo: alternative.nameKo,
      safetyNote: "제품 식별 정보와 최신 제조사 안내를 다시 확인하세요.",
      reason: "현재 리콜 대상과 다른 게시 품목이며 근거 수집·독립 검토·활성화를 서로 다른 담당자가 수행했어요.",
      evidence: {
        id: "local-safety-alternative-evidence",
        title: "제조사 공식 리콜 및 대체 품목 안내",
        publicUrl: "https://www.wooriai.kr/safety-alternative-fixture"
      }
    }]
  };
}

function preparationContextKey(childId?: string, motherProfileId?: string) {
  if (Boolean(childId) === Boolean(motherProfileId)) throw new Error("아이 또는 산모 준비 대상을 하나만 선택해 주세요.");
  if (childId) {
    requireChild(childId);
    return `child:${childId}`;
  }
  if (motherProfileId !== LOCAL_MOTHER_PROFILE_ID) throw new Error("산모 프로필을 찾을 수 없어요.");
  return `mother:${motherProfileId}`;
}

const preparationContextExclusiveGroups: readonly (readonly CatalogScenarioCode[])[] = [
  ["first_child", "second_or_later"],
  ["vaginal_delivery", "cesarean_delivery"],
  ["breastfeeding", "formula_feeding", "mixed_feeding"],
  ["daycare", "kindergarten", "school"],
  ["car_primary", "no_car"],
  ["car_primary", "public_transport_primary"],
  ["summer_birth", "winter_birth"]
];

export function getPreparationContext(childId?: string, motherProfileId?: string) {
  ensureSeeded();
  const key = preparationContextKey(childId, motherProfileId);
  const profile = useLocalBackendStore.getState().preparationContexts[key];
  return {
    childId: childId ?? null,
    motherProfileId: motherProfileId ?? null,
    contextCodes: profile?.contextCodes ?? [],
    availableContextCodes: catalogDomain.catalogScenarioCodes,
    version: profile?.version ?? 0,
    updatedAt: profile?.updatedAt ?? null
  };
}

export function updatePreparationContext(
  childId: string | undefined,
  motherProfileId: string | undefined,
  input: { contextCodes: CatalogScenarioCode[]; expectedVersion?: number }
) {
  ensureSeeded();
  const key = preparationContextKey(childId, motherProfileId);
  const existing = useLocalBackendStore.getState().preparationContexts[key];
  if (existing ? input.expectedVersion !== existing.version : input.expectedVersion !== undefined && input.expectedVersion !== 0) {
    throw new Error("다른 가족이 준비 상황을 변경했어요. 새로고침 후 다시 시도해 주세요.");
  }
  if (input.contextCodes.some((code) => !catalogDomain.catalogScenarioCodes.includes(code))) throw new Error("지원하지 않는 준비 상황이에요.");
  if (preparationContextExclusiveGroups.some((group) => group.filter((code) => input.contextCodes.includes(code)).length > 1)) {
    throw new Error("서로 함께 선택할 수 없는 준비 상황이 있어요.");
  }
  const profile = {
    contextCodes: [...new Set(input.contextCodes)].sort() as CatalogScenarioCode[],
    version: (existing?.version ?? 0) + 1,
    updatedAt: new Date().toISOString()
  };
  useLocalBackendStore.setState((state) => ({ preparationContexts: { ...state.preparationContexts, [key]: profile } }));
  return { childId: childId ?? null, motherProfileId: motherProfileId ?? null, availableContextCodes: catalogDomain.catalogScenarioCodes, ...profile };
}

export function getCatalogTimeline(childId?: string, motherProfileId?: string): CatalogTimelineResponse {
  ensureSeeded();
  if (Boolean(childId) === Boolean(motherProfileId)) throw new Error("아이 또는 산모 준비 대상을 하나만 선택해 주세요.");
  if (childId) requireChild(childId);
  if (motherProfileId && motherProfileId !== LOCAL_MOTHER_PROFILE_ID) throw new Error("산모 프로필을 찾을 수 없어요.");

  const preparationContext = getPreparationContext(childId, motherProfileId);
  const selectedContextCodes = preparationContext.contextCodes;
  const child = childId ? [useLocalBackendStore.getState().child, ...useLocalBackendStore.getState().additionalChildren].find((candidate) => candidate?.id === childId) : null;
  const lifecycle = calculatePreparationLifecycle(motherProfileId
    ? { stageMode: "pregnant", dueDate: localMotherDueDate(), today: getSeoulToday() }
    : {
        stageMode: child!.stageMode,
        dueDate: child!.dueDate,
        birthDate: child!.birthDate,
        manualStage: child!.manualStage,
        today: getSeoulToday()
      });
  if (!lifecycle.available) throw new Error("출산 예정일, 생년월일 또는 직접 선택한 성장 단계를 확인해 주세요.");
  const lifecycleAxis = lifecycle.axis;
  const lifecycleCode = lifecycle.code;
  const nextLifecycleCode = lifecycle.nextCode;
  const seasonDateText = child?.birthDate ?? child?.dueDate ?? null;
  const seasonMonth = seasonDateText ? Number(seasonDateText.slice(5, 7)) : null;
  const derivedContextCodes: CatalogScenarioCode[] = seasonMonth && [6, 7, 8].includes(seasonMonth)
    ? ["summer_birth"]
    : seasonMonth && [12, 1, 2].includes(seasonMonth)
      ? ["winter_birth"]
      : [];
  const activeContextCodes = [...new Set([...selectedContextCodes, ...derivedContextCodes])] as CatalogScenarioCode[];
  const currentItems = catalogDomain.release4CatalogItems.filter((item) => item.lifecycles.some((rule) => rule.axis === lifecycleAxis && rule.code === lifecycleCode));
  const nextItems = catalogDomain.release4CatalogItems.filter((item) => item.lifecycles.some((rule) => rule.axis === lifecycleAxis && rule.code === nextLifecycleCode));
  const plannedItems = catalogDomain.release4CatalogItems.filter((item) => Boolean(localCatalogPlan(childId, motherProfileId, item.code)));
  const itemMap = new Map([...currentItems, ...nextItems, ...plannedItems].map((item) => [item.code, item]));
  const currentIds = new Set(currentItems.filter((item) => item.lifecycles.some((rule) => rule.axis === lifecycleAxis && rule.code === lifecycleCode && rule.priorityWeight > 0)).map((item) => item.code));
  const todayText = getSeoulToday();
  const today = new Date(`${todayText}T00:00:00.000Z`);
  const dateText = (value: Date) => value.toISOString().slice(0, 10);
  const addDays = (value: Date, days: number) => new Date(value.getTime() + days * 86_400_000);
  const weekEnd = addDays(today, 6);
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  const completedStates = new Set<CatalogItemPlan["state"]>(["owned", "borrowed", "rented", "gifted", "replaced", "retired", "ended"]);
  const lifecyclePriority = (item: (typeof catalogDomain.release4CatalogItems)[number]) => Math.max(0, ...item.lifecycles
    .filter((rule) => rule.axis === lifecycleAxis && (rule.code === lifecycleCode || rule.code === nextLifecycleCode))
    .map((rule) => rule.priorityWeight));
  const contextWeight = (item: (typeof catalogDomain.release4CatalogItems)[number]) => item.contextRules
    .filter((rule) => activeContextCodes.includes(rule.code))
    .reduce((total, rule) => total + rule.weight, 0);
  const contextRequired = (item: (typeof catalogDomain.release4CatalogItems)[number]) => item.contextRules
    .some((rule) => activeContextCodes.includes(rule.code) && rule.required);
  const rows = [...itemMap.values()].map((item) => {
    const plan = localCatalogPlan(childId, motherProfileId, item.code);
    const userDueText = plan?.dueDate ?? plan?.replacementDueAt ?? plan?.nextPurchaseDueAt ?? null;
    const userDue = userDueText ? new Date(`${userDueText.slice(0, 10)}T00:00:00.000Z`) : null;
    const bucket = (plan?.state === "not_needed" ? "not_needed"
      : plan && completedStates.has(plan.state) ? "completed"
        : userDue && userDue < today ? "overdue"
          : userDue && userDue <= weekEnd ? "this_week"
            : currentIds.has(item.code) && (item.necessity === "required" || contextRequired(item)) ? "this_week"
              : currentIds.has(item.code) ? "this_month"
                : "next_stage") as CatalogTimelineBucket;
    const dueWindow = bucket === "next_stage"
      ? { start: null, end: null, label: "다음 생애주기", derivedFrom: "lifecycle" as const }
      : userDue
        ? { start: dateText(userDue), end: dateText(userDue), label: bucket === "overdue" ? "사용자가 정한 날짜가 지났어요" : "사용자가 정한 날짜", derivedFrom: plan?.dueDate ? "user_due" as const : plan?.replacementDueAt ? "replacement" as const : "repeat_purchase" as const }
        : bucket === "this_week"
          ? { start: todayText, end: dateText(weekEnd), label: "이번 주", derivedFrom: "lifecycle" as const }
          : { start: todayText, end: dateText(monthEnd), label: "이번 달", derivedFrom: "lifecycle" as const };
    const matchedContextCodes = item.scenarioCodes.filter((code) => activeContextCodes.includes(code));
    const reason = buildPreparationRecommendationReason({
      lifecycleCode,
      nextLifecycleCode,
      matchedContextCodes,
      bucket,
      dueWindow
    });
    return {
      id: item.code,
      code: item.code,
      nameKo: item.nameKo,
      necessity: item.necessity,
      safetyTier: item.safetyTier,
      matchedContextCodes,
      bucket,
      dueWindow,
      ...reason,
      plan
    };
  }).filter((row) => lifecyclePriority(itemMap.get(row.code)!) > 0 || Boolean(row.plan))
    .sort((left, right) => {
      const leftItem = itemMap.get(left.code)!;
      const rightItem = itemMap.get(right.code)!;
      const rankInput = (row: typeof left, item: typeof leftItem) => ({
        bucket: row.bucket,
        hasPlan: Boolean(row.plan),
        userDueTime: row.plan?.dueDate || row.plan?.replacementDueAt || row.plan?.nextPurchaseDueAt
          ? Date.parse(row.plan.dueDate ?? row.plan.replacementDueAt ?? row.plan.nextPurchaseDueAt!)
          : null,
        lifecyclePriority: lifecyclePriority(item),
        contextWeight: contextWeight(item),
        necessity: row.necessity,
        displayOrder: item.displayOrder,
        code: row.code
      });
      return comparePreparationTimelineRank(rankInput(left, leftItem), rankInput(right, rightItem));
    });
  const bucketNames = ["this_week", "this_month", "next_stage", "overdue", "completed", "not_needed"] as const;
  return {
    context: { ...(childId ? { childId } : { motherProfileId }), lifecycleAxis, lifecycleCode, nextLifecycleCode, selectedContextCodes, derivedContextCodes, activeContextCodes, contextVersion: preparationContext.version },
    generatedAt: new Date().toISOString(),
    rankingPolicy: "user_due_then_timeline_then_lifecycle_priority_then_context_then_necessity_no_commerce_signal",
    buckets: Object.fromEntries(bucketNames.map((bucket) => [bucket, rows.filter((row) => row.bucket === bucket)])) as CatalogTimelineResponse["buckets"]
  };
}

export function listCatalogBundles(childId: string) {
  ensureSeeded();
  requireChild(childId);
  const completedStates = new Set<CatalogItemPlan["state"]>(["owned", "borrowed", "rented", "gifted", "replaced", "retired", "ended", "not_needed"]);
  return {
    bundles: catalogDomain.release4BundleDefinitions.map((bundle, bundleIndex) => {
      const items = bundle.itemCodes.flatMap((itemCode) => {
        const item = catalogDomain.release4CatalogItems.find((candidate) => candidate.code === itemCode);
        return item ? [{ ...toCatalogItemSummary(item, childId), bundleNecessity: item.necessity, defaultQuantity: 1 }] : [];
      });
      const completedCount = items.filter((item) => item.plan && completedStates.has(item.plan.state)).length;
      return {
        id: `local-bundle-${bundleIndex + 1}`,
        code: `R4-BUNDLE-${String(bundleIndex + 1).padStart(3, "0")}`,
        nameKo: bundle.nameKo,
        description: `${bundle.nameKo} 상황에서 필요한 canonical 품목을 한 번에 검토해요.`,
        items,
        progress: { totalCount: items.length, completedCount, percentage: items.length ? Math.round(completedCount * 100 / items.length) : 0 }
      };
    })
  };
}

export function applyCatalogBundle(
  childId: string,
  bundleId: string,
  input: { dryRun: boolean; items: Array<{ itemId: string; state: CatalogItemPlan["state"]; quantityNeeded?: number; assignedUserId?: string; dueDate?: string; budgetKrw?: number; note?: string; expectedVersion?: number }>; acknowledgeWarningItemIds?: string[] }
): CatalogBundleApplyResponse {
  const bundle = listCatalogBundles(childId).bundles.find((candidate) => candidate.id === bundleId);
  if (!bundle) throw new Error("준비 묶음을 찾을 수 없어요.");
  const memberIds = new Set(bundle.items.map((item) => item.id));
  if (input.items.some((item) => !memberIds.has(item.itemId))) throw new Error("선택한 품목이 준비 묶음에 포함되어 있지 않아요.");
  const purchaseIntent = new Set<CatalogItemPlan["state"]>(["need", "researching", "planned", "ordered"]);
  const duplicateStates = new Set<CatalogItemPlan["state"]>(["ordered", "owned", "borrowed", "rented", "gifted"]);
  const warnings = input.items.flatMap((entry) => {
    const current = localCatalogPlan(childId, undefined, entry.itemId);
    return current && duplicateStates.has(current.state) && purchaseIntent.has(entry.state)
      ? [{ code: "DUPLICATE_PURCHASE_RISK" as const, itemId: entry.itemId, currentState: current.state, requestedState: entry.state }]
      : [];
  });
  if (input.dryRun) return { bundleId, childId, selectedCount: input.items.length, excludedCount: bundle.items.length - input.items.length, warnings, appliedCount: 0, plans: [] };
  const acknowledged = new Set(input.acknowledgeWarningItemIds ?? []);
  if (warnings.some((warning) => !acknowledged.has(warning.itemId))) throw new Error("중복 구매 경고를 확인해 주세요.");
  const plans = input.items.map((entry) => putCatalogItemPlan(childId, entry.itemId, {
    state: entry.state,
    desiredQuantity: entry.quantityNeeded,
    assignedUserId: entry.assignedUserId,
    dueDate: entry.dueDate,
    budgetKrw: entry.budgetKrw,
    note: entry.note,
    expectedVersion: entry.expectedVersion
  }));
  return { bundleId, childId, selectedCount: input.items.length, excludedCount: bundle.items.length - input.items.length, warnings, appliedCount: plans.length, plans };
}

export function getCatalogItem(itemId: string, childId?: string, motherProfileId?: string): CatalogItemDetail {
  ensureSeeded();
  const item = catalogDomain.release4CatalogItems.find((entry) => entry.code === itemId);
  if (!item) throw new Error("준비 품목을 찾을 수 없어요.");
  return {
    ...toCatalogItemSummary(item, childId, motherProfileId),
    reasonText: `가족 상황에 따라 ${item.nameKo}의 필요 여부, 수량, 준비 시기를 검토하고 기록할 수 있습니다.`,
    skipReasonText: "가족 상황과 사용 계획에 맞지 않으면 준비하지 않아도 됩니다.",
    quantityGuidance: "가족 구성과 사용 빈도에 따라 수량을 정하세요.",
    priceMinKrw: null,
    priceMaxKrw: null,
    secondhandPolicy: item.safetyTier === "normal" ? "allowed" : "inspect",
    rentalPolicy: "conditional",
    medicalDisclaimerRequired: item.safetyTier === "high",
    categories: [item.domainCode, item.categoryCode, item.subcategoryCode].map(localCatalogNode),
    lifecycles: item.lifecycles.map((lifecycle) => ({ axis: lifecycle.axis, lifecycleCode: lifecycle.code, timingText: "해당 생애주기에서 필요 여부를 확인하세요." })),
    contexts: [{ contextCode: "all", weight: 0, required: false }],
    offers: [],
    reviewPending: true
  };
}

export function getCatalogItemComparison(itemId: string) {
  const item = catalogDomain.release4CatalogItems.find((entry) => entry.code === itemId);
  if (!item) throw new Error("준비 품목을 찾을 수 없어요.");
  const schema = item.nameKo.includes("카시트")
    ? { schemaCode: "car_seat_v1", fields: [{ key: "usageDirection", labelKo: "사용 방향", valueType: "text" as const }, { key: "maxWeightKg", labelKo: "허용 체중(kg)", valueType: "number" as const }, { key: "maxHeightCm", labelKo: "허용 신장(cm)", valueType: "number" as const }, { key: "installationType", labelKo: "차량 설치 방식", valueType: "text" as const }] }
    : item.nameKo.includes("유모차")
      ? { schemaCode: "stroller_v1", fields: [{ key: "weightKg", labelKo: "무게(kg)", valueType: "number" as const }, { key: "foldedDimensions", labelKo: "접은 크기", valueType: "text" as const }, { key: "usageRange", labelKo: "사용 범위", valueType: "text" as const }] }
      : item.nameKo.includes("젖병")
        ? { schemaCode: "bottle_v1", fields: [{ key: "capacityMl", labelKo: "용량(ml)", valueType: "number" as const }, { key: "material", labelKo: "소재", valueType: "text" as const }, { key: "compatibility", labelKo: "호환 정보", valueType: "text" as const }] }
        : { schemaCode: null, fields: [] };
  return {
    item: { id: item.code, code: item.code, nameKo: item.nameKo },
    schema,
    rankingPolicy: "catalog_display_order_only_no_affiliate_or_sponsor_signal" as const,
    // Standalone qualification fixture only. It is explicitly non-affiliate,
    // has no price claim, and opens a neutral HTTPS page so the installed APK
    // can exercise the purchase-return follow-up without production commerce
    // data or a reachable backend.
    offers: [
      {
        id: `local-offer-${item.code}`,
        seller: "테스트 판매처",
        brand: null,
        modelName: null,
        productName: `${item.nameKo} 테스트 페이지`,
        publicUrl: "https://example.com/",
        isAffiliate: false,
        isSponsored: false,
        disclosureText: null,
        priceSnapshotKrw: null,
        priceCheckedAt: null,
        priceFreshness: "unknown" as const,
        priceAgeDays: null,
        stockState: "unknown" as const,
        recallState: "clear" as const,
        attributes: {}
      }
    ]
  };
}

export function listCatalogItemPlans(childId: string) {
  ensureSeeded();
  requireChild(childId);
  return { plans: Object.values(useLocalBackendStore.getState().itemPlans).filter((plan) => plan.childId === childId) };
}

export function putCatalogItemPlan(
  childId: string,
  itemId: string,
  input: {
    state: CatalogItemPlan["state"];
    desiredQuantity?: number;
    ownedQuantity?: number;
    quantityNeeded?: number;
    quantityOwned?: number;
    dueDate?: string;
    acquisitionMode?: CatalogItemPlan["acquisitionMode"];
    acquisitionType?: CatalogItemPlan["acquisitionMode"];
    assignedUserId?: string;
    budgetKrw?: number;
    note?: string;
    notes?: string;
    linkedExpenseId?: string;
    size?: string;
    variant?: string;
    purchasedAt?: string;
    openedAt?: string;
    expiresAt?: string;
    replacementDueAt?: string;
    usageEndedAt?: string;
    storageLocation?: string;
    recurringIntervalDays?: number;
    nextPurchaseDueAt?: string;
    expectedVersion?: number;
  }
) {
  ensureSeeded();
  requireChild(childId);
  if (!catalogDomain.release4CatalogItems.some((item) => item.code === itemId)) throw new Error("준비 품목을 찾을 수 없어요.");
  if (input.assignedUserId && !useLocalBackendStore.getState().members.some((member) => member.userId === input.assignedUserId && member.status === "active" && member.role !== "gift_participant")) throw new Error("담당자는 활성 가족 구성원이어야 해요.");
  const key = catalogPlanKey(childId, itemId);
  const existing = useLocalBackendStore.getState().itemPlans[key];
  if (existing && input.expectedVersion !== existing.version) {
    throw new Error("다른 기기에서 준비 상태가 변경됐어요. 새로고침 후 다시 시도해 주세요.");
  }
  const plan: CatalogItemPlan = {
    id: existing?.id ?? `local-plan-${childId}-${itemId}`,
    householdId: LOCAL_HOUSEHOLD_ID,
    childId,
    motherProfileId: null,
    itemDefinitionId: itemId,
    state: input.state,
    desiredQuantity: input.quantityNeeded ?? input.desiredQuantity ?? existing?.desiredQuantity ?? null,
    ownedQuantity: input.quantityOwned ?? input.ownedQuantity ?? existing?.ownedQuantity ?? null,
    dueDate: input.dueDate ?? existing?.dueDate ?? null,
    acquisitionMode: input.acquisitionType ?? input.acquisitionMode ?? existing?.acquisitionMode ?? null,
    assignedUserId: input.assignedUserId ?? existing?.assignedUserId ?? null,
    budgetKrw: input.budgetKrw ?? existing?.budgetKrw ?? null,
    note: input.notes ?? input.note ?? existing?.note ?? null,
    linkedExpenseId: input.linkedExpenseId ?? existing?.linkedExpenseId ?? null,
    size: input.size ?? existing?.size ?? null,
    variant: input.variant ?? existing?.variant ?? null,
    purchasedAt: input.purchasedAt ?? existing?.purchasedAt ?? null,
    openedAt: input.openedAt ?? existing?.openedAt ?? null,
    expiresAt: input.expiresAt ?? existing?.expiresAt ?? null,
    replacementDueAt: input.replacementDueAt ?? existing?.replacementDueAt ?? null,
    usageEndedAt: input.usageEndedAt ?? existing?.usageEndedAt ?? null,
    storageLocation: input.storageLocation ?? existing?.storageLocation ?? null,
    recurringIntervalDays: input.recurringIntervalDays ?? existing?.recurringIntervalDays ?? null,
    nextPurchaseDueAt: input.nextPurchaseDueAt ?? existing?.nextPurchaseDueAt ?? null,
    version: existing ? existing.version + 1 : 1
  };
  const history: LocalPlanHistoryRecord = { id: generateLocalId("plan-history"), planId: plan.id, actorUserId: LOCAL_USER_ID, actorDisplayName: "테스트 사용자", fromVersion: existing?.version ?? null, toVersion: plan.version, changesJson: { ...input, expectedVersion: undefined }, createdAt: new Date().toISOString() };
  useLocalBackendStore.setState((state) => ({ itemPlans: { ...state.itemPlans, [key]: plan }, planHistory: { ...state.planHistory, [plan.id]: [history, ...(state.planHistory[plan.id] ?? [])].slice(0, 100) } }));
  return plan;
}

export function putMotherCatalogItemPlan(
  motherProfileId: string,
  itemId: string,
  input: Parameters<typeof putCatalogItemPlan>[2]
) {
  ensureSeeded();
  if (!catalogDomain.release4CatalogItems.some((item) => item.code === itemId)) throw new Error("준비 품목을 찾을 수 없어요.");
  if (input.assignedUserId && !useLocalBackendStore.getState().members.some((member) => member.userId === input.assignedUserId && member.status === "active" && member.role !== "gift_participant")) throw new Error("담당자는 활성 가족 구성원이어야 해요.");
  const contextId = `mother-${motherProfileId}`;
  const key = catalogPlanKey(contextId, itemId);
  const existing = useLocalBackendStore.getState().itemPlans[key];
  if (existing && input.expectedVersion !== existing.version) {
    throw new Error("다른 기기에서 준비 상태가 변경됐어요. 새로고침 후 다시 시도해 주세요.");
  }
  const plan: CatalogItemPlan = {
    id: existing?.id ?? `local-plan-${contextId}-${itemId}`,
    householdId: LOCAL_HOUSEHOLD_ID,
    childId: null,
    motherProfileId,
    itemDefinitionId: itemId,
    state: input.state,
    desiredQuantity: input.quantityNeeded ?? input.desiredQuantity ?? existing?.desiredQuantity ?? null,
    ownedQuantity: input.quantityOwned ?? input.ownedQuantity ?? existing?.ownedQuantity ?? null,
    dueDate: input.dueDate ?? existing?.dueDate ?? null,
    acquisitionMode: input.acquisitionType ?? input.acquisitionMode ?? existing?.acquisitionMode ?? null,
    assignedUserId: input.assignedUserId ?? existing?.assignedUserId ?? null,
    budgetKrw: input.budgetKrw ?? existing?.budgetKrw ?? null,
    note: input.notes ?? input.note ?? existing?.note ?? null,
    linkedExpenseId: input.linkedExpenseId ?? existing?.linkedExpenseId ?? null,
    size: input.size ?? existing?.size ?? null,
    variant: input.variant ?? existing?.variant ?? null,
    purchasedAt: input.purchasedAt ?? existing?.purchasedAt ?? null,
    openedAt: input.openedAt ?? existing?.openedAt ?? null,
    expiresAt: input.expiresAt ?? existing?.expiresAt ?? null,
    replacementDueAt: input.replacementDueAt ?? existing?.replacementDueAt ?? null,
    usageEndedAt: input.usageEndedAt ?? existing?.usageEndedAt ?? null,
    storageLocation: input.storageLocation ?? existing?.storageLocation ?? null,
    recurringIntervalDays: input.recurringIntervalDays ?? existing?.recurringIntervalDays ?? null,
    nextPurchaseDueAt: input.nextPurchaseDueAt ?? existing?.nextPurchaseDueAt ?? null,
    version: existing ? existing.version + 1 : 1
  };
  const history: LocalPlanHistoryRecord = { id: generateLocalId("plan-history"), planId: plan.id, actorUserId: LOCAL_USER_ID, actorDisplayName: "테스트 사용자", fromVersion: existing?.version ?? null, toVersion: plan.version, changesJson: { ...input, expectedVersion: undefined }, createdAt: new Date().toISOString() };
  useLocalBackendStore.setState((state) => ({ itemPlans: { ...state.itemPlans, [key]: plan }, planHistory: { ...state.planHistory, [plan.id]: [history, ...(state.planHistory[plan.id] ?? [])].slice(0, 100) } }));
  return plan;
}

export function getCatalogItemPlanActivity(childId: string, itemId: string) {
  ensureSeeded();
  requireChild(childId);
  const plan = useLocalBackendStore.getState().itemPlans[catalogPlanKey(childId, itemId)];
  if (!plan) throw new Error("준비 계획을 먼저 저장해 주세요.");
  const state = useLocalBackendStore.getState();
  return { plan, history: state.planHistory[plan.id] ?? [], comments: state.planComments[plan.id] ?? [] };
}

export function addCatalogItemPlanComment(childId: string, itemId: string, body: string, clientMutationId = generateLocalId("plan-comment")) {
  ensureSeeded();
  requireChild(childId);
  const normalized = body.trim();
  if (!normalized || normalized.length > 1000) throw new Error("댓글은 1~1,000자로 입력해 주세요.");
  const plan = useLocalBackendStore.getState().itemPlans[catalogPlanKey(childId, itemId)];
  if (!plan) throw new Error("준비 계획을 먼저 저장해 주세요.");
  const existingComment = (useLocalBackendStore.getState().planComments[plan.id] ?? []).find((entry) => entry.id === clientMutationId);
  if (existingComment) {
    if (existingComment.body === normalized && existingComment.authorUserId === LOCAL_USER_ID) return existingComment;
    throw new Error("ITEM_PLAN_COMMENT_IDEMPOTENCY_CONFLICT");
  }
  const comment: LocalPlanCommentRecord = { id: clientMutationId, planId: plan.id, authorUserId: LOCAL_USER_ID, authorDisplayName: "테스트 사용자", body: normalized, createdAt: new Date().toISOString(), deletedAt: null };
  useLocalBackendStore.setState((state) => ({ planComments: { ...state.planComments, [plan.id]: [...(state.planComments[plan.id] ?? []), comment].slice(-100) } }));
  return comment;
}

function itemStatusKey(childId: string, itemTemplateId: string): string {
  return `${childId}:${itemTemplateId}`;
}

function itemStatusFor(childId: string, itemTemplateId: string): ItemStatus {
  ensureSeeded();
  const statuses = useLocalBackendStore.getState().itemStatuses;
  return statuses[itemStatusKey(childId, itemTemplateId)]?.status ??
    (childId === LOCAL_CHILD_ID ? statuses[itemTemplateId]?.status : undefined) ??
    "not_prepared";
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

function toItemSummaryDto(childId: string, item: (typeof localItemTemplateFixtures)[number]): ItemSummary {
  return {
    id: item.id,
    name: item.name,
    necessityLevel: item.necessityLevel,
    status: itemStatusFor(childId, item.id),
    timingLabel: item.timingLabel,
    priceBandText: priceBandText(item.priceMinKrw, item.priceMaxKrw),
    stageCodes: item.stageCodes
  };
}

export function listItems(childId: string, tab: ItemTab = "now"): { items: ItemSummary[] } {
  ensureSeeded();
  const stageCode = currentStageCode(childId);

  if (tab === "prepared") {
    return {
      items: localItemTemplateFixtures
        .filter((item) => itemStatusFor(childId, item.id) === "prepared")
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((item) => toItemSummaryDto(childId, item))
    };
  }

  if (tab === "not_needed") {
    return {
      items: localItemTemplateFixtures
        .filter((item) => itemStatusFor(childId, item.id) === "not_needed")
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((item) => toItemSummaryDto(childId, item))
    };
  }

  const stageMatcher =
    tab === "now"
      ? (item: (typeof localItemTemplateFixtures)[number]) => item.stageCodes.includes(stageCode)
      : (item: (typeof localItemTemplateFixtures)[number]) => !item.stageCodes.includes(stageCode);

  const candidates = localItemTemplateFixtures.filter(stageMatcher).filter((item) => {
    const status = itemStatusFor(childId, item.id);
    return status === "not_prepared" || status === "interested";
  });

  const sorted = sortRecommendedItems(
    candidates.map((item) => ({
      id: item.id,
      stageMatches: item.stageCodes.includes(stageCode),
      necessityLevel: item.necessityLevel,
      status: itemStatusFor(childId, item.id),
      budgetFits: true,
      userInterest: itemStatusFor(childId, item.id) === "interested"
    }))
  );

  const itemById = new Map(candidates.map((item) => [item.id, item]));
  const ordered = sorted
    .map((entry) => itemById.get(entry.id))
    .filter((item): item is (typeof localItemTemplateFixtures)[number] => Boolean(item));

  return { items: ordered.map((item) => toItemSummaryDto(childId, item)) };
}

export function getItemDetail(childId: string, itemTemplateId: string): ItemDetail {
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
    ...toItemSummaryDto(childId, item),
    reasonText: item.reasonText,
    skipReasonText: item.skipReasonText,
    usedSecondhandOk: item.usedSecondhandOk,
    safetyNote: item.safetyNote,
    productLinks
  };
}

export function updateItemStatus(
  childId: string,
  itemTemplateId: string,
  status: ItemStatus,
  expenseId?: string
): ItemSummary {
  ensureSeeded();
  const item = requireItemTemplate(itemTemplateId);
  useLocalBackendStore.setState((state) => ({
    itemStatuses: {
      ...state.itemStatuses,
      [itemStatusKey(childId, itemTemplateId)]: { status, expenseId: expenseId ?? null }
    }
  }));
  return toItemSummaryDto(childId, item);
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

const AUTHORITY_RECOVERY_HOUSEHOLD_ID = "a1170a17-0000-4a17-8a17-000000000006";

function localApiError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

export function listHouseholdMembers(householdId: string) {
  ensureSeeded();
  const members = useLocalBackendStore
    .getState()
    .members.filter((member) => member.status !== "removed" && member.status !== "left")
    .filter((member) => member.householdId === householdId)
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

export function listMyHouseholds() {
  ensureSeeded();
  const memberships = useLocalBackendStore
    .getState()
    .members.filter((member) => member.userId === LOCAL_USER_ID && member.status === "active");
  return {
    households: memberships.map((member) => ({
      id: member.householdId,
      name: member.householdId === LOCAL_HOUSEHOLD_ID ? "우리 가족" : "소유권 복구 가족",
      role: member.role
    }))
  };
}

export function removeHouseholdMember(householdId: string, memberId: string): { success: boolean } {
  ensureSeeded();
  const state = useLocalBackendStore.getState();
  const member = state.members.find((record) => record.householdId === householdId && record.id === memberId);
  if (!member) {
    throw localApiError("HOUSEHOLD_MEMBER_NOT_FOUND", "가족 구성원을 찾을 수 없어요.");
  }
  if (member.role === "owner") {
    throw localApiError("OWNER_TRANSFER_REQUIRED", "소유권을 이전한 뒤 현재 소유자 구성원을 변경해 주세요.");
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
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const invite: LocalInviteRecord = {
    token,
    householdId,
    householdName: "검증용 가족",
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
  requireChild(childId);
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

const localLegalDocuments = [
  {
    documentType: "terms",
    version: "local-test-2026-07-16",
    locale: "ko-KR-test",
    title: "이용약관",
    bodyMarkdown: "내부 standalone 테스트에서만 사용하는 이용약관 fixture입니다.",
    publicUrl: null,
    contentHash: "1f2f9bcfded142ba9c6add4eef44d9f7f738c7f71cd91d0c53e763e12012bbde",
    effectiveAt: "2026-07-16T00:00:00.000Z",
    publishedAt: "2026-07-16T00:00:00.000Z",
    placeholder: false
  },
  {
    documentType: "privacy",
    version: "local-test-2026-07-16",
    locale: "ko-KR-test",
    title: "개인정보 처리방침",
    bodyMarkdown: "내부 standalone 테스트에서만 사용하는 개인정보 처리방침 fixture입니다.",
    publicUrl: null,
    contentHash: "ab76f13f2de5dca2901e4cb80a341f2ca2a95f40a674db9a3807578823bbff68",
    effectiveAt: "2026-07-16T00:00:00.000Z",
    publishedAt: "2026-07-16T00:00:00.000Z",
    placeholder: false
  }
] as const;

export function getCurrentLegalDocuments() {
  return localLegalDocuments.map((document) => ({ ...document }));
}

export function transferHouseholdOwnership(householdId: string, targetUserId: string) {
  ensureSeeded();
  const state = useLocalBackendStore.getState();
  const owner = state.members.find((member) => member.householdId === householdId && member.userId === LOCAL_USER_ID && member.role === "owner" && member.status === "active");
  const target = state.members.find((member) => member.householdId === householdId && member.userId === targetUserId && member.role === "co_parent" && member.status === "active");
  if (!owner) throw localApiError("OWNERSHIP_CHANGED", "가족 소유자가 이미 변경됐어요.");
  if (!target) throw localApiError("OWNER_TRANSFER_TARGET_CHANGED", "대상 구성원의 역할이나 상태가 변경됐어요.");
  useLocalBackendStore.setState((current) => ({
    members: current.members.map((member) => member.id === owner.id
      ? { ...member, role: "co_parent" }
      : member.id === target.id
        ? { ...member, role: "owner" }
        : member)
  }));
  return { success: true, ownerUserId: targetUserId };
}

export function leaveHousehold(householdId: string) {
  ensureSeeded();
  const state = useLocalBackendStore.getState();
  const current = state.members.find((member) => member.householdId === householdId && member.userId === LOCAL_USER_ID && member.status === "active");
  if (!current) throw localApiError("OWNERSHIP_CHANGED", "가족 구성원 상태가 이미 변경됐어요.");
  if (current.role === "owner") {
    throw localApiError("OWNER_TRANSFER_REQUIRED", "소유권을 이전하거나 가족을 삭제한 뒤 탈퇴해 주세요.");
  }
  useLocalBackendStore.setState((snapshot) => ({
    members: snapshot.members.map((member) => member.id === current.id ? { ...member, status: "left" } : member)
  }));
  return { success: true, flowId: "household_leave" };
}

export function upsertConsents(
  consents: Array<{ documentType: string; version: string; contentHash: string; accepted: true }>
): { success: boolean } {
  ensureSeeded();
  const validated = localLegalDocuments.map((document) => {
    const consent = consents.find((candidate) => candidate.documentType === document.documentType);
    if (
      !consent ||
      consent.version !== document.version ||
      consent.contentHash !== document.contentHash ||
      consent.accepted !== true
    ) {
      throw new Error("현재 약관 문서를 다시 확인해 주세요.");
    }
    return {
      type: document.documentType,
      version: document.version,
      contentHash: document.contentHash,
      accepted: true
    };
  });
  useLocalBackendStore.setState({
    consents: validated
  });
  return { success: true };
}

export function createChild(body: {
  nickname: string;
  stageMode: ChildStageMode;
  dueDate?: string;
  birthDate?: string;
  manualStage?: ChildStageCode | null;
  gender?: string;
}): { id: string } {
  ensureSeeded();
  const nickname = body.nickname.trim();
  if (!nickname) throw new Error("아이 이름을 입력해 주세요.");
  if (body.stageMode === "pregnant" && !body.dueDate) throw new Error("출산 예정일을 입력해 주세요.");
  if (body.stageMode === "born" && !body.birthDate) throw new Error("아이 생년월일을 입력해 주세요.");
  if (body.stageMode === "manual" && !body.manualStage) throw new Error("아이 단계를 선택해 주세요.");
  const child: LocalChildRecord = {
    id: generateLocalId("child"),
    nickname,
    stageMode: body.stageMode,
    dueDate: body.dueDate ?? null,
    birthDate: body.birthDate ?? null,
    manualStage: body.manualStage ?? null,
    gender: body.gender?.trim() || null,
    profileImageUrl: null,
    deletedAt: null
  };
  toChildDto(child);
  useLocalBackendStore.setState((state) => ({ additionalChildren: [...state.additionalChildren, child] }));
  return { id: child.id };
}

export function previewOnboardingStarterItems(body: {
  stageMode: ChildStageMode;
  dueDate?: string;
  birthDate?: string;
  manualStage?: ChildStageCode;
}) {
  if (body.stageMode === "pregnant" && !body.dueDate) throw new Error("출산 예정일을 입력해 주세요.");
  if (body.stageMode === "born" && !body.birthDate) throw new Error("생일을 입력해 주세요.");
  if (body.stageMode === "manual" && !body.manualStage) throw new Error("현재 단계를 선택해 주세요.");
  const items = localOnboardingStarterCatalogItems().map(({ item, code, presentation }, index) => {
    return {
      id: item.code,
      code,
      categoryCode: presentation.categoryCode,
      nameKo: item.nameKo,
      shortDescription: "현재 단계에 맞춰 준비 상태를 시작해요.",
      iconKey: presentation.icon,
      safetyTier: item.safetyTier,
      onboardingPriority: 120 - index * 10
    };
  });
  return {
    availability: "available" as const,
    blockerCode: null,
    eligibleCount: items.length,
    items,
    rankingPolicy: "lifecycle_then_onboarding_priority_then_necessity_then_canonical_code"
  };
}

export function completeOnboarding(body: CompleteOnboardingInput, idempotencyKey: string) {
  ensureSeeded();
  body = normalizeOnboardingCompletionInput(body, getSeoulToday());
  const state = useLocalBackendStore.getState();
  const replayKey = `onboarding:${idempotencyKey}`;
  const requestFingerprint = JSON.stringify(body);
  const replay = state.idempotencyKeys[replayKey];
  if (replay) {
    const parsed = JSON.parse(replay) as { fingerprint: string; childId: string };
    if (parsed.fingerprint !== requestFingerprint) throw new Error("IDEMPOTENCY_KEY_CONFLICT");
    const child = activeChildren().find((candidate) => candidate.id === parsed.childId);
    if (!child) throw new Error("ONBOARDING_REPLAY_CHILD_MISSING");
    return {
      child: toChildDto(child),
      prepared: { state: body.prepared.state, appliedCount: body.prepared.itemDefinitionIds.length },
      budget: body.budget,
      onboardingCompleted: true as const
    };
  }
  if (state.child || state.additionalChildren.some((child) => !child.deletedAt)) {
    throw new Error("ONBOARDING_ALREADY_COMPLETED");
  }
  const nickname = body.child.nickname.trim();
  if (!nickname) throw new Error("아이 이름을 입력해 주세요.");
  const child: LocalChildRecord = {
    id: LOCAL_CHILD_ID,
    nickname,
    stageMode: body.child.stageMode,
    dueDate: body.child.dueDate ?? null,
    birthDate: body.child.birthDate ?? null,
    manualStage: body.child.manualStage ?? null,
    gender: body.child.gender,
    profileImageUrl: null,
    deletedAt: null
  };
  toChildDto(child);
  const selectedIds = [...new Set(body.prepared.itemDefinitionIds)];
  if ((body.prepared.state === "selected") !== (selectedIds.length > 0)) throw new Error("PREPARED_STATE_INVALID");
  const starterItems = localOnboardingStarterCatalogItems();
  const selectedMappings = selectedIds.map((id) => starterItems.find(({ item, legacyId }) => item.code === id || legacyId === id));
  if (selectedMappings.some((item) => !item)) {
    throw new Error("STARTER_ITEMS_STALE");
  }
  const validSelectedMappings = selectedMappings.filter((mapping): mapping is NonNullable<typeof mapping> => Boolean(mapping));
  const itemStatuses = Object.fromEntries(
    validSelectedMappings.map((mapping) => [itemStatusKey(child.id, mapping.legacyId), { status: "prepared" as const, expenseId: null }])
  );
  const itemPlans = Object.fromEntries(validSelectedMappings.map(({ item }) => {
    const key = catalogPlanKey(child.id, item.code);
    const plan: CatalogItemPlan = {
      id: `local-plan-${child.id}-${item.code}`,
      householdId: LOCAL_HOUSEHOLD_ID,
      childId: child.id,
      motherProfileId: null,
      itemDefinitionId: item.code,
      state: "owned",
      desiredQuantity: 1,
      ownedQuantity: 1,
      dueDate: null,
      acquisitionMode: null,
      assignedUserId: null,
      budgetKrw: null,
      note: null,
      linkedExpenseId: null,
      size: null,
      variant: null,
      purchasedAt: null,
      openedAt: null,
      expiresAt: null,
      replacementDueAt: null,
      usageEndedAt: null,
      storageLocation: null,
      recurringIntervalDays: null,
      nextPurchaseDueAt: null,
      version: 1
    };
    return [key, plan];
  }));
  const budgets = body.budget
    ? { [`${child.id}:${getSeoulMonthRange(body.budget.yearMonth).yearMonth}`]: body.budget.amountKrw }
    : {};
  useLocalBackendStore.setState((current) => ({
    child,
    additionalChildren: [],
    budgets,
    itemStatuses,
    itemPlans,
    preparedItemsCompleted: true,
    onboardingCompleted: true,
    idempotencyKeys: {
      ...current.idempotencyKeys,
      [replayKey]: JSON.stringify({ fingerprint: requestFingerprint, childId: child.id })
    }
  }));
  return {
    child: toChildDto(child),
    prepared: { state: body.prepared.state, appliedCount: selectedIds.length },
    budget: body.budget,
    onboardingCompleted: true as const
  };
}

function localOnboardingStarterCatalogItems() {
  const exactNames: Record<keyof typeof ONBOARDING_STARTER_ITEM_REGISTRY, string> = {
    diaper: "신생아 기저귀",
    baby_carrier: "신생아 아기띠",
    blocks: "쌓기 블록",
    crib: "신생아 침대",
    newborn_clothing: "신생아 배냇저고리",
    swaddle: "아기 수면조끼",
    baby_bottle: "젖병",
    thermometer: "아기 체온계",
    baby_bathtub: "신생아 욕조",
    handkerchief: "후드형 아기 타월",
    car_seat: "신생아용 카시트",
    stroller: "신생아 유모차"
  };
  return Object.entries(ONBOARDING_STARTER_ITEM_REGISTRY).flatMap(([rawCode, presentation], index) => {
    const code = rawCode as keyof typeof ONBOARDING_STARTER_ITEM_REGISTRY;
    const targetName = exactNames[code];
    const item = catalogDomain.release4CatalogItems.find((candidate) => candidate.nameKo === targetName)
      ?? catalogDomain.release4CatalogItems.find((candidate) => candidate.nameKo.includes(presentation.label));
    const legacyId = localItemTemplateFixtures[index]?.id;
    return item && legacyId ? [{ item, code, presentation, legacyId }] : [];
  });
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
    child: OnboardingChildSummary | null;
    preparedItemsCount: number | null;
    budget: { yearMonth: string; amountKrw: number } | null;
  };
} {
  ensureSeeded();
  const state = useLocalBackendStore.getState();
  const consentsAccepted = localLegalDocuments.every((document) =>
    state.consents.some(
      (consent) =>
        consent.type === document.documentType &&
        consent.version === document.version &&
        consent.contentHash === document.contentHash &&
        consent.accepted
    )
  );

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

  const childSummary = toChildDto(child);
  if (state.onboardingCompleted) {
    const completionYearMonth = getSeoulMonthRange(getSeoulToday()).yearMonth;
    const completionBudget = budgetAmountFor(child.id, completionYearMonth);
    return {
      completed: true,
      nextStep: "home",
      canRestart: false,
      summary: {
        consentsAccepted: true,
        child: childSummary,
        preparedItemsCount: Object.keys(state.itemStatuses).length,
        budget: completionBudget === undefined ? null : { yearMonth: completionYearMonth, amountKrw: completionBudget }
      }
    };
  }
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
  const amountKrw = budgetAmountFor(child.id, yearMonth);
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

export function listChildren(): { children: OnboardingChildSummary[] } {
  return { children: activeChildren().map(toChildDto) };
}

export function getChild(childId: string): OnboardingChildSummary {
  return toChildDto(requireChild(childId));
}

export function updateChild(
  childId: string,
  body: {
    nickname?: string;
    stageMode?: ChildStageMode;
    dueDate?: string;
    birthDate?: string;
    manualStage?: ChildStageCode;
    gender?: string;
  }
): OnboardingChildSummary {
  const current = requireChild(childId);
  const updated: LocalChildRecord = {
    ...current,
    ...(body.nickname !== undefined ? { nickname: body.nickname.trim() } : {}),
    ...(body.stageMode !== undefined ? { stageMode: body.stageMode } : {}),
    ...(body.dueDate !== undefined ? { dueDate: body.dueDate } : {}),
    ...(body.birthDate !== undefined ? { birthDate: body.birthDate } : {}),
    ...(body.manualStage !== undefined ? { manualStage: body.manualStage } : {}),
    ...(body.gender !== undefined ? { gender: body.gender.trim() || null } : {})
  };
  if (!updated.nickname) throw new Error("아이 이름을 입력해 주세요.");
  const dto = toChildDto(updated);
  useLocalBackendStore.setState((state) => ({
    child: state.child?.id === childId ? updated : state.child,
    additionalChildren: state.additionalChildren.map((child) => (child.id === childId ? updated : child))
  }));
  return dto;
}

export function setPreparedItems(childId: string, itemTemplateIds: string[]): { updatedCount: number } {
  requireChild(childId);
  const unique = new Set(itemTemplateIds);
  useLocalBackendStore.setState((state) => {
    const nextStatuses = { ...state.itemStatuses };
    for (const itemTemplateId of unique) {
      if (localItemTemplateFixtures.some((item) => item.id === itemTemplateId)) {
        nextStatuses[itemStatusKey(childId, itemTemplateId)] = { status: "prepared", expenseId: null };
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

export function previewChildProfileDeletion(childId: string): SettingsPreview {
  requireChild(childId);
  return {
    flowId: "child_profile_delete",
    requiresSecondStep: true,
    confirmationText: "DELETE CHILD",
    impact: ["child profile becomes inaccessible", "related expense records are removed from reports"]
  };
}

export function confirmChildProfileDeletion(childId: string, confirmationText: string): SettingsConfirmResponse {
  assertConfirmation(confirmationText, "DELETE CHILD");
  requireChild(childId);
  const now = new Date().toISOString();
  useLocalBackendStore.setState((state) => ({
    child: state.child?.id === childId ? { ...state.child, deletedAt: now } : state.child,
    additionalChildren: state.additionalChildren.map((child) =>
      child.id === childId ? { ...child, deletedAt: now } : child
    ),
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
  return leaveHousehold(householdId);
}

export function previewAccountDeletion(): SettingsPreview {
  ensureSeeded();
  return {
    flowId: "account_delete",
    requiresSecondStep: true,
    confirmationText: "DELETE ACCOUNT",
    impact: ["요청 후 7일 동안 계정과 데이터가 유지됩니다", "유예 기간 안에는 삭제 요청을 취소할 수 있습니다", "7일이 지나면 데이터 삭제가 시작됩니다"]
  };
}

export function confirmAccountDeletion(confirmationText: string): SettingsConfirmResponse {
  assertConfirmation(confirmationText, "DELETE ACCOUNT");
  ensureSeeded();
  const existing = useLocalBackendStore.getState().accountDeletionRequest;
  const now = new Date();
  const recoveryFixture = process.env.EXPO_PUBLIC_AUTHORITY_RECOVERY_FIXTURE === "1";
  const deletion: AccountDeletionRequest = existing?.state === "requested" || existing?.state === "failed" ? existing : {
    id: generateLocalId("account-deletion"),
    requestType: "deletion",
    state: recoveryFixture ? "failed" : "requested",
    requestedAt: now.toISOString(),
    dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: null,
    failureCode: recoveryFixture ? "OWNER_TRANSFER_REQUIRED" : null,
    exportExpiresAt: null,
    statusToken: generateLocalId("privacy-status"),
    details: recoveryFixture ? { householdId: AUTHORITY_RECOVERY_HOUSEHOLD_ID, accessRevoked: false } : undefined
  };
  useLocalBackendStore.setState({ accountDeletionRequest: deletion });
  return { success: true, flowId: "account_delete", deletion };
}

export function cancelAccountDeletion(requestId: string): AccountDeletionRequest {
  const current = useLocalBackendStore.getState().accountDeletionRequest;
  if (!current || current.id !== requestId) throw new Error("삭제 요청을 찾을 수 없어요.");
  const ownershipBlocked = current.state === "failed" && current.failureCode === "OWNER_TRANSFER_REQUIRED";
  if ((!ownershipBlocked && current.state !== "requested") || (!ownershipBlocked && (!current.dueAt || current.dueAt <= new Date().toISOString()))) {
    throw new Error("삭제 유예 기간이 지나 취소할 수 없어요.");
  }
  const cancelled: AccountDeletionRequest = { ...current, state: "cancelled", failureCode: null, details: undefined };
  useLocalBackendStore.setState({ accountDeletionRequest: cancelled });
  return cancelled;
}

export function getCurrentAccountDeletion(): AccountDeletionRequest | null {
  const current = useLocalBackendStore.getState().accountDeletionRequest;
  return current?.state === "requested" || (current?.state === "failed" && current.failureCode === "OWNER_TRANSFER_REQUIRED")
    ? current
    : null;
}

export function retryAccountDeletion(requestId: string): AccountDeletionRequest {
  const current = useLocalBackendStore.getState().accountDeletionRequest;
  if (!current || current.id !== requestId || current.state !== "failed" || current.failureCode !== "OWNER_TRANSFER_REQUIRED") {
    throw localApiError("PRIVACY_RETRY_NOT_ALLOWED", "다시 시도할 수 있는 삭제 요청이 아니에요.");
  }
  const blocker = useLocalBackendStore.getState().members.find((member) =>
    member.userId === LOCAL_USER_ID &&
    member.role === "owner" &&
    member.status === "active" &&
    useLocalBackendStore.getState().members.some((candidate) =>
      candidate.householdId === member.householdId &&
      candidate.userId !== LOCAL_USER_ID &&
      candidate.status === "active"
    )
  );
  if (blocker) {
    throw localApiError("OWNER_TRANSFER_REQUIRED", "계정 삭제 전에 공동 양육자에게 가족 소유권을 이전해 주세요.");
  }
  const requested: AccountDeletionRequest = {
    ...current,
    state: "requested",
    failureCode: null,
    dueAt: new Date().toISOString(),
    details: undefined
  };
  useLocalBackendStore.setState({ accountDeletionRequest: requested });
  return requested;
}
