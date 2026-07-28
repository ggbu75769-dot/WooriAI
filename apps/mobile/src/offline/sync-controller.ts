import { useEffect } from "react";
import { Platform } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import {
  ApiClientError,
  fixtureSessionToken,
  getSyncChangesV2,
  isApiErrorCode,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_USER_ID
} from "../api/client";
import { bucketSyncLatencyMs, trackAndFlushAnalyticsEvent } from "../analytics/client";
import { isCurrentlyOnline, startConnectivityWatcher } from "./connectivity";
import { SERVER_CONFIRMED_MESSAGE } from "./messages";
import { expenseToOfflinePayload } from "./expense-payload";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { createClientRemoteExpenseApi } from "./remote-api";
import { reconcileLegacyOfflineScope } from "./legacy-reconciliation";
import { resolveOfflineScopeKey } from "./session-scope";
import { RemoteSyncCancelledError } from "./errors";
import { runPersistedDeltaPull } from "./delta-pull-runner";
import { resumeAfterActiveScopeFlight } from "./sync-continuation";
import {
  diffExpenseFields,
  discardFailedMutation,
  flushOutbox,
  recordLocalCreate,
  recordLocalDelete,
  recordLocalUpdate,
  purgeOfflineStore,
  resolveConflictAdoptServer,
  resolveConflictReapplyMine,
  resolveConflictWithMergedPayload,
  retryFailedMutation,
  type FlushSummary
} from "./sync-engine";
import {
  generateOfflineId,
  type ExpensePayload,
  type LocalExpenseRow,
  type OfflineStore
} from "./types";
import type { Expense } from "../api/client";
import {
  invalidateFinancialMutationQueries,
  removeFinancialQueries
} from "../query/mutation-invalidation";
import { useSessionStore } from "../stores/session.store";
import {
  householdIdForSelectedChildScope,
  useSelectedChildStore
} from "../stores/selected-child.store";
import {
  activateOfflineSyncSnapshotScope,
  clearOfflineSyncSnapshot,
  createEmptySyncStatusCounts,
  publishOfflineSyncSnapshot,
  type OfflineSyncDisplayRow
} from "./sync-snapshot";
import { reconcilePurchaseFollowups } from "../purchase-followup/store";

export {
  useOfflinePendingExpenses,
  useOfflineSyncSnapshot,
  type OfflineSyncDisplayRow,
  type SyncSnapshot,
  type SyncStatusCounts
} from "./sync-snapshot";

/**
 * MOB-102 (round5a-sprint1-plan.md §3) glue layer wiring the transport-agnostic offline core
 * (sync-engine.ts, fully unit-tested) to the real app: a singleton SQLite-backed store, a
 * reactive status snapshot for screens (records tab badge, EXP-005 sync-status screen), and
 * connectivity-triggered background flush. None of this file's logic is unit-testable in vitest
 * (native SQLite/AppState/expo-network) -- it is intentionally kept thin, delegating all
 * decision-making to sync-engine.ts.
 */

const storePromises = new Map<string, Promise<OfflineStore>>();
const reconciledLegacyScopes = new Set<string>();

/** expo-sqlite is imported lazily (dynamic import, not a top-level static import) specifically
 * so no test file can accidentally pull in a native module by importing this controller module
 * -- see sqlite-offline-store.ts's header comment. */
async function getOfflineStore(scopeKey: string): Promise<OfflineStore> {
  const existing = storePromises.get(scopeKey);
  if (existing) return existing;
  const storePromise = (async () => {
      if (Platform.OS === "web") {
        return createMemoryOfflineStore(scopeKey);
      }
      const { createSqliteOfflineStore } = await import("./sqlite-offline-store");
      return createSqliteOfflineStore(scopeKey);
    })();
  storePromises.set(scopeKey, storePromise);
  return storePromise;
}

function currentSessionToken(): string | null {
  const session = useSessionStore.getState();
  return session.accessToken ?? (session.isTestSession ? fixtureSessionToken : null);
}

function currentOfflineScopeKey(): string | null {
  const session = useSessionStore.getState();
  const selectedChild = useSelectedChildStore.getState();
  return resolveOfflineScopeKey({
    accessToken: session.accessToken,
    userId: session.userId,
    defaultHouseholdId: householdIdForSelectedChildScope(
      selectedChild.selectedChildId,
      selectedChild.selectedChildHouseholdId,
      session.defaultHouseholdId
    ),
    isTestSession: session.isTestSession,
    testUserId: LOCAL_USER_ID,
    testHouseholdId: LOCAL_HOUSEHOLD_ID
  });
}

export type OfflineSyncOwner = {
  sessionGeneration: number;
  token: string;
  scopeKey: string;
  householdId: string;
};

function currentOfflineHouseholdId(): string | null {
  const session = useSessionStore.getState();
  const selectedChild = useSelectedChildStore.getState();
  return householdIdForSelectedChildScope(
    selectedChild.selectedChildId,
    selectedChild.selectedChildHouseholdId,
    session.defaultHouseholdId ?? (session.isTestSession ? LOCAL_HOUSEHOLD_ID : null)
  );
}

function captureOfflineSyncOwner(
  token: string,
  scopeKey: string,
  expectedGeneration?: number
): OfflineSyncOwner | null {
  const session = useSessionStore.getState();
  const householdId = currentOfflineHouseholdId();
  if (
    (expectedGeneration !== undefined && session.sessionGeneration !== expectedGeneration) ||
    currentSessionToken() !== token ||
    currentOfflineScopeKey() !== scopeKey ||
    !householdId
  ) {
    return null;
  }
  return { sessionGeneration: session.sessionGeneration, token, scopeKey, householdId };
}

export function captureCurrentOfflineSyncOwner(): OfflineSyncOwner | null {
  const token = currentSessionToken();
  const scopeKey = currentOfflineScopeKey();
  if (!token || !scopeKey) return null;
  return captureOfflineSyncOwner(token, scopeKey);
}

export async function recordOfflineAuthorization(
  owner: OfflineSyncOwner | null,
  state: "authorized" | "denied",
  queryClient?: QueryClient
): Promise<void> {
  if (!owner || !offlineSyncOwnerIsActive(owner)) return;
  const store = await getOfflineStore(owner.scopeKey);
  if (!offlineSyncOwnerIsActive(owner)) return;
  await store.setRemoteSyncAuthorization({
    state,
    checkedAt: new Date().toISOString(),
    ownerStillCurrent: () => offlineSyncOwnerIsActive(owner)
  });
  if (state === "denied" && queryClient && offlineSyncOwnerIsActive(owner)) {
    removeFinancialQueries(queryClient);
  }
  if (offlineSyncOwnerIsActive(owner)) await refreshSnapshot(owner.scopeKey);
}

function offlineSyncOwnerIsActive(owner: OfflineSyncOwner): boolean {
  return (
    useSessionStore.getState().sessionGeneration === owner.sessionGeneration &&
    currentOfflineScopeKey() === owner.scopeKey &&
    currentOfflineHouseholdId() === owner.householdId
  );
}

function assertOfflineSyncOwnerIsActive(owner: OfflineSyncOwner): void {
  if (!offlineSyncOwnerIsActive(owner)) throw new RemoteSyncCancelledError();
}

type ActiveFlushExecution = {
  owner: OfflineSyncOwner;
  controller: AbortController;
};

const activeFlushExecutions = new Set<ActiveFlushExecution>();

function abortStaleFlushExecutions(): void {
  for (const execution of activeFlushExecutions) {
    if (!offlineSyncOwnerIsActive(execution.owner)) {
      execution.controller.abort();
    }
  }
}

useSessionStore.subscribe(abortStaleFlushExecutions);
useSelectedChildStore.subscribe(abortStaleFlushExecutions);

function beginFlushExecution(owner: OfflineSyncOwner, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  }
  const execution = { owner, controller };
  activeFlushExecutions.add(execution);
  abortStaleFlushExecutions();
  return {
    signal: controller.signal,
    release: () => {
      externalSignal?.removeEventListener("abort", abortFromExternalSignal);
      activeFlushExecutions.delete(execution);
    }
  };
}

async function requireCurrentOfflineStore(): Promise<OfflineStore> {
  const scopeKey = currentOfflineScopeKey();
  if (!scopeKey) throw new Error("OFFLINE_SCOPE_UNAVAILABLE");
  return getOfflineStore(scopeKey);
}

export async function refreshOfflineSyncSnapshot(): Promise<void> {
  const scopeKey = currentOfflineScopeKey();
  if (!scopeKey) {
    clearOfflineSyncSnapshot();
    return;
  }
  activateOfflineSyncSnapshotScope(scopeKey);
  await refreshSnapshot(scopeKey);
}

async function refreshSnapshot(scopeKey: string): Promise<void> {
  const store = await getOfflineStore(scopeKey);
  const [localRows, mutations, quarantine, remoteSync] = await Promise.all([
    store.listLocalExpenses(),
    store.listOutboxMutations(),
    store.getLegacyQuarantineSummary(),
    store.getRemoteSyncMetadata()
  ]);
  const mutationByLocalId = new Map(
    mutations.map((mutation) => [mutation.targetLocalId, mutation])
  );
  const rows: OfflineSyncDisplayRow[] = localRows.map((row) => {
    const mutation = mutationByLocalId.get(row.localId);
    return {
      ...row,
      attemptCount: mutation?.attemptCount ?? 0,
      nextRetryAt: mutation?.nextRetryAt ?? null
    };
  });
  await reconcilePurchaseFollowups(scopeKey, rows);
  const counts = createEmptySyncStatusCounts();
  const now = new Date().toISOString();
  for (const row of rows) {
    if (row.syncState === "synced") continue;
    if (row.syncState === "pending") {
      if (row.nextRetryAt && row.nextRetryAt > now) counts.retryWait += 1;
      else counts.pending += 1;
    } else if (row.syncState === "syncing") {
      counts.syncing += 1;
    } else if (row.syncState === "conflict") {
      counts.conflict += 1;
    } else {
      counts.failed += 1;
      if (row.failureKind === "auth_required") counts.authRequired += 1;
      else if (row.failureKind === "permission_denied") counts.permissionDenied += 1;
      else if (row.failureKind === "retry_exhausted") counts.retryExhausted += 1;
      else counts.permanentFailure += 1;
    }
  }
  publishOfflineSyncSnapshot(scopeKey, { counts, rows, quarantine, remoteSync });
}

// ---------------------------------------------------------------------------
// Flash messages: "서버 확인 후" copy (design doc §3.3) fires once a background flush actually
// confirms a write with the server, which can happen well after the screen that triggered it has
// navigated away. Screens subscribe and show it as a transient Toast (see app/(tabs)/records.tsx).
// ---------------------------------------------------------------------------

export type OfflineFlashMessage = { id: string; text: string };
const flashListeners = new Set<(message: OfflineFlashMessage) => void>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const mutationActions = new Map<string, Promise<void>>();

export function subscribeOfflineFlashMessage(listener: (message: OfflineFlashMessage) => void): () => void {
  flashListeners.add(listener);
  return () => flashListeners.delete(listener);
}

function emitFlashMessage(text: string) {
  const message: OfflineFlashMessage = { id: generateOfflineId("flash"), text };
  for (const listener of flashListeners) listener(message);
}

function clearRetryTimer(scopeKey: string) {
  const timer = retryTimers.get(scopeKey);
  if (timer) clearTimeout(timer);
  retryTimers.delete(scopeKey);
}

async function scheduleNextRetry(queryClient: QueryClient, scopeKey: string) {
  clearRetryTimer(scopeKey);
  const store = await getOfflineStore(scopeKey);
  const nextRetryAt = (await store.listOutboxMutations())
    .flatMap((mutation) => mutation.nextRetryAt ? [mutation.nextRetryAt] : [])
    .sort()[0];
  if (!nextRetryAt) return;
  const delay = Math.max(0, new Date(nextRetryAt).getTime() - Date.now());
  retryTimers.set(
    scopeKey,
    setTimeout(() => {
      retryTimers.delete(scopeKey);
      const token = currentSessionToken();
      if (token && currentOfflineScopeKey() === scopeKey) {
        void flushInBackground(token, queryClient, scopeKey);
      }
    }, delay)
  );
}

function runMutationActionOnce(key: string, work: () => Promise<void>): Promise<void> {
  const existing = mutationActions.get(key);
  if (existing) return existing;
  const action = work().finally(() => mutationActions.delete(key));
  mutationActions.set(key, action);
  return action;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function attemptFlush(
  owner: OfflineSyncOwner,
  queryClient: QueryClient,
  signal: AbortSignal
): Promise<FlushSummary> {
  assertOfflineSyncOwnerIsActive(owner);
  const store = await getOfflineStore(owner.scopeKey);
  assertOfflineSyncOwnerIsActive(owner);
  const pendingChildIds = [...new Set(
    (await store.listLocalExpenses())
      .filter((row) => row.syncState !== "synced")
      .map((row) => row.childId)
  )];
  assertOfflineSyncOwnerIsActive(owner);
  const activeToken = currentSessionToken();
  if (!activeToken) throw new RemoteSyncCancelledError();
  const remote = createClientRemoteExpenseApi(activeToken, signal);
  const startedAt = Date.now();
  const summary = await flushOutbox(store, remote, {
    signal,
    isActive: () => offlineSyncOwnerIsActive(owner)
  });
  if (summary.cancelled || signal.aborted || !offlineSyncOwnerIsActive(owner)) {
    return { ...summary, cancelled: true };
  }
  await refreshSnapshot(owner.scopeKey);
  assertOfflineSyncOwnerIsActive(owner);
  await scheduleNextRetry(queryClient, owner.scopeKey);
  assertOfflineSyncOwnerIsActive(owner);
  if (summary.synced > 0) {
    await invalidateFinancialMutationQueries(queryClient, pendingChildIds);
    emitFlashMessage(SERVER_CONFIRMED_MESSAGE);
    // ANA-101 (round5a-sprint2-plan.md §5): fires once per flush pass that
    // actually confirmed at least one write with the server, not once. A
    // no-op while analytics opt-in is OFF (its default) -- see
    // src/analytics/flag.ts.
    trackAndFlushAnalyticsEvent(activeToken, {
      eventName: "expense_synced",
      payload: { latencyBucket: bucketSyncLatencyMs(Date.now() - startedAt) },
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
    });
  }
  return summary;
}

async function flushInBackground(
  token: string,
  queryClient: QueryClient,
  scopeKey: string,
  expectedGeneration?: number,
  externalSignal?: AbortSignal
): Promise<void> {
  await runScopeSynchronization(
    token,
    queryClient,
    scopeKey,
    expectedGeneration,
    externalSignal
  );
}

/** Records a new expense locally first (design doc §3.2 step 1) and kicks off a background
 * flush attempt if online. Always resolves once the local write lands -- callers show
 * OFFLINE_SAVED_MESSAGE immediately and never wait on the network. */
export async function createExpenseOffline(
  token: string,
  queryClient: QueryClient,
  payload: ExpensePayload
): Promise<LocalExpenseRow> {
  const store = await requireCurrentOfflineStore();
  const row = await recordLocalCreate(store, payload);
  await refreshSnapshot(store.scopeKey);
  void flushInBackground(token, queryClient, store.scopeKey);
  return row;
}

/**
 * A server-confirmed expense (loaded via the normal getExpense/listExpenses calls -- one that
 * never went through the offline create flow) has no local_expenses row yet. Editing/deleting it
 * needs to go through the same outbox pipeline as an offline-authored one (so expectedVersion,
 * conflict handling, etc. are all uniform), so this "adopts" it into the local table as an
 * already-synced row on first touch -- see app/expenses/[expenseId].tsx.
 */
export async function adoptServerExpense(expense: Expense): Promise<LocalExpenseRow> {
  const store = await requireCurrentOfflineStore();
  const existing = await store.listLocalExpenses(expense.childId);
  const already = existing.find((row) => row.canonicalId === expense.id);
  if (already && (already.version ?? 0) >= expense.version) {
    return already;
  }
  // M-1 fix: a row with an outstanding local mutation (pending edit, pending delete, failed, or
  // conflict) owns its own payload/version -- the offline outbox and conflict-resolution flow
  // are the only things allowed to change them from here on. Blindly overwriting the payload
  // with whatever the server/query cache currently has (which can be a version behind, or a
  // *different* device's edit during an active conflict) would silently discard the user's
  // pending change out from under them, right before they try to resolve it. Only a row that is
  // fully 'synced' (no outstanding mutation) is safe to refresh from the server value here.
  if (already && already.syncState !== "synced") {
    return already;
  }

  const payload = expenseToOfflinePayload(expense);
  const timestamp = new Date().toISOString();

  if (already) {
    await store.updateLocalExpense(already.localId, { payload, version: expense.version, updatedAt: timestamp });
    await refreshSnapshot(store.scopeKey);
    return (await store.getLocalExpense(already.localId)) as LocalExpenseRow;
  }

  const row: LocalExpenseRow = {
    scopeKey: store.scopeKey,
    localId: generateOfflineId("lexp"),
    canonicalId: expense.id,
    childId: expense.childId,
    payload,
    version: expense.version,
    syncState: "synced",
    pendingDelete: false,
    conflictCurrent: null,
    lastError: null,
    failureKind: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  await store.insertLocalExpense(row);
  await refreshSnapshot(store.scopeKey);
  return row;
}

export async function updateExpenseOffline(
  token: string,
  queryClient: QueryClient,
  localId: string,
  patch: Partial<ExpensePayload>
): Promise<LocalExpenseRow> {
  const store = await requireCurrentOfflineStore();
  const row = await recordLocalUpdate(store, localId, patch);
  await refreshSnapshot(store.scopeKey);
  void flushInBackground(token, queryClient, store.scopeKey);
  return row;
}

export async function deleteExpenseOffline(token: string, queryClient: QueryClient, localId: string): Promise<void> {
  const store = await requireCurrentOfflineStore();
  await recordLocalDelete(store, localId);
  await refreshSnapshot(store.scopeKey);
  void flushInBackground(token, queryClient, store.scopeKey);
}

// ---------------------------------------------------------------------------
// Sync-status screen actions (EXP-005)
// ---------------------------------------------------------------------------

export async function retryOfflineMutation(token: string, queryClient: QueryClient, localId: string): Promise<void> {
  return runMutationActionOnce(`retry:${localId}`, async () => {
    const store = await requireCurrentOfflineStore();
    await retryFailedMutation(store, localId);
    await refreshSnapshot(store.scopeKey);
    await flushInBackground(token, queryClient, store.scopeKey);
  });
}

export async function discardOfflineMutation(localId: string): Promise<void> {
  return runMutationActionOnce(`discard:${localId}`, async () => {
    const store = await requireCurrentOfflineStore();
    await discardFailedMutation(store, localId);
    const { removePurchaseFollowupForLocalExpense } = await import("../purchase-followup/store");
    await removePurchaseFollowupForLocalExpense(store.scopeKey, localId);
    await refreshSnapshot(store.scopeKey);
  });
}

/** ① 다른 기기 값 유지 */
export async function resolveConflictKeepServer(queryClient: QueryClient, localId: string): Promise<void> {
  return runMutationActionOnce(`conflict-server:${localId}`, async () => {
    const store = await requireCurrentOfflineStore();
    const row = await store.getLocalExpense(localId);
    await resolveConflictAdoptServer(store, localId);
    await refreshSnapshot(store.scopeKey);
    if (row) await invalidateFinancialMutationQueries(queryClient, row.childId);
  });
}

/** ② 내 변경 다시 적용 */
export async function resolveConflictKeepMine(token: string, queryClient: QueryClient, localId: string): Promise<void> {
  return runMutationActionOnce(`conflict-mine:${localId}`, async () => {
    const store = await requireCurrentOfflineStore();
    await resolveConflictReapplyMine(store, localId);
    await refreshSnapshot(store.scopeKey);
    void flushInBackground(token, queryClient, store.scopeKey);
  });
}

/** ③ 두 값 나란히 보기 -> chosen field combination */
export async function resolveConflictKeepChosenFields(
  token: string,
  queryClient: QueryClient,
  localId: string,
  mergedPayload: ExpensePayload
): Promise<void> {
  return runMutationActionOnce(`conflict-merged:${localId}`, async () => {
    const store = await requireCurrentOfflineStore();
    await resolveConflictWithMergedPayload(store, localId, mergedPayload);
    await refreshSnapshot(store.scopeKey);
    void flushInBackground(token, queryClient, store.scopeKey);
  });
}

export async function retryLegacyQuarantineReconciliation(
  token: string
): Promise<{ restored: number; remaining: number }> {
  const scopeKey = currentOfflineScopeKey();
  if (!scopeKey) throw new Error("OFFLINE_SCOPE_UNAVAILABLE");
  const owner = captureOfflineSyncOwner(token, scopeKey);
  if (!owner) throw new RemoteSyncCancelledError();
  const execution = beginFlushExecution(owner);
  let result = { restored: 0, remaining: 0 };
  try {
    await runMutationActionOnce(`legacy-reconcile:${scopeKey}`, async () => {
      assertOfflineSyncOwnerIsActive(owner);
      const store = await getOfflineStore(scopeKey);
      assertOfflineSyncOwnerIsActive(owner);
      result = await reconcileLegacyOfflineScope(token, store, {
        signal: execution.signal,
        isActive: () => offlineSyncOwnerIsActive(owner)
      });
      assertOfflineSyncOwnerIsActive(owner);
      await refreshSnapshot(scopeKey);
    });
    return result;
  } finally {
    execution.release();
  }
}

export async function purgeCurrentOfflineScope(): Promise<void> {
  const scopeKey = currentOfflineScopeKey();
  if (!scopeKey) return;
  const store = await getOfflineStore(scopeKey);
  await purgeOfflineStore(store);
  await refreshSnapshot(scopeKey);
}

const EXPENSE_FIELD_LABELS: Record<string, string> = {
  categoryId: "카테고리",
  amountKrw: "금액",
  spentOn: "날짜",
  itemName: "품목",
  merchant: "구매처",
  memo: "메모",
  paymentMethod: "결제 수단",
  paymentMethodId: "사용자 결제 수단",
  expenseType: "구분"
};

/** Field-by-field diff for the "두 값 나란히 보기" screen, with Korean field labels attached. */
export function diffExpenseFieldsForDisplay(
  local: ExpensePayload,
  server: ExpensePayload
): Array<{ field: string; fieldLabel: string; localValue: unknown; serverValue: unknown }> {
  return diffExpenseFields(local, server).map((entry) => ({
    ...entry,
    fieldLabel: EXPENSE_FIELD_LABELS[entry.field] ?? entry.field
  }));
}

// ---------------------------------------------------------------------------
// App-level wiring: one serialized push -> pull pipeline per exact scope.
// ---------------------------------------------------------------------------

const scopeSyncFlights = new Map<
  string,
  { owner: OfflineSyncOwner; promise: Promise<void> }
>();
const pullContinuationTimers = new Map<string, ReturnType<typeof setTimeout>>();

function sameOfflineOwner(left: OfflineSyncOwner, right: OfflineSyncOwner): boolean {
  return (
    left.sessionGeneration === right.sessionGeneration &&
    left.scopeKey === right.scopeKey &&
    left.householdId === right.householdId
  );
}

function schedulePullContinuation(queryClient: QueryClient, owner: OfflineSyncOwner): void {
  if (pullContinuationTimers.has(owner.scopeKey)) return;
  pullContinuationTimers.set(
    owner.scopeKey,
    setTimeout(() => {
      pullContinuationTimers.delete(owner.scopeKey);
      void resumeAfterActiveScopeFlight(
        () => scopeSyncFlights.get(owner.scopeKey)?.promise,
        async () => {
          if (!offlineSyncOwnerIsActive(owner)) return;
          const token = currentSessionToken();
          if (!token) return;
          await runScopeSynchronization(
            token,
            queryClient,
            owner.scopeKey,
            owner.sessionGeneration
          );
        }
      );
    }, 0)
  );
}

async function pullRemoteDelta(
  owner: OfflineSyncOwner,
  store: OfflineStore,
  queryClient: QueryClient,
  signal: AbortSignal
): Promise<void> {
  let result;
  try {
    result = await runPersistedDeltaPull({
      store,
      householdId: owner.householdId,
      signal,
      isActive: () => offlineSyncOwnerIsActive(owner),
      isInvalidCursorError: (error) => isApiErrorCode(error, "SYNC_CURSOR_INVALID"),
      fetchPage: (cursor, requestSignal) => {
        assertOfflineSyncOwnerIsActive(owner);
        const activeToken = currentSessionToken();
        if (!activeToken) throw new RemoteSyncCancelledError();
        return getSyncChangesV2(
          activeToken,
          owner.householdId,
          cursor ?? undefined,
          200,
          requestSignal
        );
      },
      onPageCommitted: (childIds) =>
        invalidateFinancialMutationQueries(queryClient, childIds)
    });
  } catch (error) {
    if (
      error instanceof ApiClientError &&
      [401, 403, 404].includes(error.status) &&
      offlineSyncOwnerIsActive(owner)
    ) {
      await recordOfflineAuthorization(owner, "denied", queryClient);
    }
    throw error;
  }
  if (!result.complete) {
    // The committed cursor remains on the same immutable baseline. Yield to
    // the UI thread and resume in a new bounded run.
    schedulePullContinuation(queryClient, owner);
  }
}

async function performScopeSynchronization(
  owner: OfflineSyncOwner,
  queryClient: QueryClient,
  externalSignal?: AbortSignal
): Promise<void> {
  const execution = beginFlushExecution(owner, externalSignal);
  try {
    const online = await isCurrentlyOnline();
    if (!online || execution.signal.aborted || !offlineSyncOwnerIsActive(owner)) return;
    const store = await getOfflineStore(owner.scopeKey);
    assertOfflineSyncOwnerIsActive(owner);
    if (!reconciledLegacyScopes.has(owner.scopeKey)) {
      reconciledLegacyScopes.add(owner.scopeKey);
      await reconcileLegacyOfflineScope(currentSessionToken()!, store, {
        signal: execution.signal,
        isActive: () => offlineSyncOwnerIsActive(owner)
      }).catch(() => {
        reconciledLegacyScopes.delete(owner.scopeKey);
      });
      assertOfflineSyncOwnerIsActive(owner);
    }

    const authRequiredRows = (await store.listLocalExpenses()).filter(
      (row) => row.syncState === "failed" && row.failureKind === "auth_required"
    );
    for (const row of authRequiredRows) {
      assertOfflineSyncOwnerIsActive(owner);
      await retryFailedMutation(store, row.localId);
    }
    await refreshSnapshot(owner.scopeKey);

    const summary = await attemptFlush(owner, queryClient, execution.signal);
    if (
      summary.cancelled ||
      summary.stoppedForNetwork ||
      execution.signal.aborted ||
      !offlineSyncOwnerIsActive(owner)
    ) {
      return;
    }
    await pullRemoteDelta(owner, store, queryClient, execution.signal);
    await refreshSnapshot(owner.scopeKey);
  } catch (error) {
    if (
      !(error instanceof RemoteSyncCancelledError) &&
      !execution.signal.aborted &&
      offlineSyncOwnerIsActive(owner)
    ) {
      throw error;
    }
  } finally {
    execution.release();
  }
}

async function runScopeSynchronization(
  token: string,
  queryClient: QueryClient,
  scopeKey: string,
  expectedGeneration?: number,
  externalSignal?: AbortSignal
): Promise<void> {
  const owner = captureOfflineSyncOwner(token, scopeKey, expectedGeneration);
  if (!owner) return;
  const existing = scopeSyncFlights.get(scopeKey);
  if (existing) {
    await existing.promise;
    if (
      !sameOfflineOwner(existing.owner, owner) &&
      offlineSyncOwnerIsActive(owner) &&
      !externalSignal?.aborted
    ) {
      return runScopeSynchronization(
        currentSessionToken() ?? token,
        queryClient,
        scopeKey,
        owner.sessionGeneration,
        externalSignal
      );
    }
    return;
  }

  const promise = performScopeSynchronization(owner, queryClient, externalSignal)
    .catch(() => undefined)
    .finally(() => {
      if (scopeSyncFlights.get(scopeKey)?.promise === promise) {
        scopeSyncFlights.delete(scopeKey);
      }
    });
  scopeSyncFlights.set(scopeKey, { owner, promise });
  await promise;
}

/** Mount once near the app root (see app/_layout.tsx). Initial load, reconnect,
 * and foreground events all join the same exact-scope pipeline. */
export function useOfflineSyncLifecycle(
  token: string | null,
  scopeKey: string | null,
  sessionGeneration: number,
  queryClient: QueryClient
): void {
  const hasSessionToken = Boolean(token);
  useEffect(() => {
    if (scopeKey) activateOfflineSyncSnapshotScope(scopeKey);
    if (!hasSessionToken || !scopeKey) {
      clearOfflineSyncSnapshot();
      return;
    }
    const activeToken = currentSessionToken();
    if (!activeToken) {
      clearOfflineSyncSnapshot(scopeKey);
      return;
    }
    const owner = captureOfflineSyncOwner(activeToken, scopeKey, sessionGeneration);
    if (!owner) {
      clearOfflineSyncSnapshot(scopeKey);
      return;
    }
    const lifecycleController = new AbortController();
    void runScopeSynchronization(
      activeToken,
      queryClient,
      scopeKey,
      sessionGeneration,
      lifecycleController.signal
    );

    const handle = startConnectivityWatcher(() => {
      if (!offlineSyncOwnerIsActive(owner)) return;
      const currentToken = currentSessionToken();
      if (!currentToken) return;
      void runScopeSynchronization(
        currentToken,
        queryClient,
        scopeKey,
        sessionGeneration,
        lifecycleController.signal
      );
    });
    return () => {
      lifecycleController.abort();
      handle.stop();
      clearRetryTimer(scopeKey);
      const continuation = pullContinuationTimers.get(scopeKey);
      if (continuation) clearTimeout(continuation);
      pullContinuationTimers.delete(scopeKey);
      clearOfflineSyncSnapshot(scopeKey);
    };
  }, [hasSessionToken, queryClient, scopeKey, sessionGeneration]);
}
