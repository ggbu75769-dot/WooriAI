import { useEffect } from "react";
import { Platform } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import { getSyncChanges, LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID } from "../api/client";
import { bucketSyncLatencyMs, trackAndFlushAnalyticsEvent } from "../analytics/client";
import { isCurrentlyOnline, startConnectivityWatcher } from "./connectivity";
import { SERVER_CONFIRMED_MESSAGE } from "./messages";
import { expenseToOfflinePayload } from "./expense-payload";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { createClientRemoteExpenseApi } from "./remote-api";
import { reconcileLegacyOfflineScope } from "./legacy-reconciliation";
import { resolveOfflineScopeKey } from "./session-scope";
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
import { invalidateFinancialMutationQueries } from "../query/mutation-invalidation";
import { useSessionStore } from "../stores/session.store";
import {
  activateOfflineSyncSnapshotScope,
  clearOfflineSyncSnapshot,
  createEmptySyncStatusCounts,
  publishOfflineSyncSnapshot,
  type OfflineSyncDisplayRow
} from "./sync-snapshot";

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

function currentOfflineScopeKey(): string | null {
  const session = useSessionStore.getState();
  return resolveOfflineScopeKey({
    accessToken: session.accessToken,
    userId: session.userId,
    defaultHouseholdId: session.defaultHouseholdId,
    isTestSession: session.isTestSession,
    testUserId: LOCAL_USER_ID,
    testHouseholdId: LOCAL_HOUSEHOLD_ID
  });
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
  const [localRows, mutations, quarantine] = await Promise.all([
    store.listLocalExpenses(),
    store.listOutboxMutations(),
    store.getLegacyQuarantineSummary()
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
  publishOfflineSyncSnapshot(scopeKey, { counts, rows, quarantine });
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

async function scheduleNextRetry(token: string, queryClient: QueryClient, scopeKey: string) {
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
      if (currentOfflineScopeKey() === scopeKey) {
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

async function attemptFlush(token: string, queryClient: QueryClient, scopeKey: string): Promise<FlushSummary> {
  const store = await getOfflineStore(scopeKey);
  const pendingChildIds = [...new Set(
    (await store.listLocalExpenses())
      .filter((row) => row.syncState !== "synced")
      .map((row) => row.childId)
  )];
  const remote = createClientRemoteExpenseApi(token);
  const startedAt = Date.now();
  const summary = await flushOutbox(store, remote);
  await refreshSnapshot(scopeKey);
  await scheduleNextRetry(token, queryClient, scopeKey);
  if (summary.synced > 0) {
    await invalidateFinancialMutationQueries(queryClient, pendingChildIds);
    emitFlashMessage(SERVER_CONFIRMED_MESSAGE);
    // ANA-101 (round5a-sprint2-plan.md §5): fires once per flush pass that
    // actually confirmed at least one write with the server, not once. A
    // no-op while analytics opt-in is OFF (its default) -- see
    // src/analytics/flag.ts.
    trackAndFlushAnalyticsEvent(token, {
      eventName: "expense_synced",
      payload: { latencyBucket: bucketSyncLatencyMs(Date.now() - startedAt) },
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
    });
  }
  return summary;
}

async function flushInBackground(token: string, queryClient: QueryClient, scopeKey: string): Promise<void> {
  const online = await isCurrentlyOnline();
  if (!online) return;
  await attemptFlush(token, queryClient, scopeKey).catch(() => undefined);
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
  let result = { restored: 0, remaining: 0 };
  await runMutationActionOnce(`legacy-reconcile:${scopeKey}`, async () => {
    const store = await getOfflineStore(scopeKey);
    result = await reconcileLegacyOfflineScope(token, store);
    await refreshSnapshot(scopeKey);
  });
  return result;
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
// App-level wiring: connectivity/foreground triggers + a best-effort delta pull.
// ---------------------------------------------------------------------------

/** Mount once near the app root (see app/_layout.tsx). Flushes the outbox whenever connectivity
 * is regained or the app returns to the foreground, and does a best-effort one-shot delta pull
 * on the same triggers (design doc §2.3's client pull is explicitly optional/best-effort for
 * this sprint -- see getSyncChanges's doc comment in client.ts). */
export function useOfflineSyncLifecycle(
  token: string | null,
  scopeKey: string | null,
  queryClient: QueryClient
): void {
  useEffect(() => {
    if (scopeKey) activateOfflineSyncSnapshotScope(scopeKey);
    if (!token || !scopeKey) {
      clearOfflineSyncSnapshot();
      return;
    }
    void (async () => {
      const store = await getOfflineStore(scopeKey);
      if (!reconciledLegacyScopes.has(scopeKey)) {
        reconciledLegacyScopes.add(scopeKey);
        await reconcileLegacyOfflineScope(token, store).catch(() => {
          reconciledLegacyScopes.delete(scopeKey);
        });
      }
      const authRequiredRows = (await store.listLocalExpenses()).filter(
        (row) => row.syncState === "failed" && row.failureKind === "auth_required"
      );
      for (const row of authRequiredRows) {
        await retryFailedMutation(store, row.localId);
      }
      await refreshSnapshot(scopeKey);
      await flushInBackground(token, queryClient, scopeKey);
    })();

    const handle = startConnectivityWatcher(() => {
      void flushInBackground(token, queryClient, scopeKey);
      void getSyncChanges(token)
        .then(async () => {
          const store = await getOfflineStore(scopeKey);
          const childIds = [...new Set((await store.listLocalExpenses()).map((row) => row.childId))];
          await invalidateFinancialMutationQueries(queryClient, childIds);
        })
        .catch(() => undefined);
    });
    return () => {
      handle.stop();
      clearRetryTimer(scopeKey);
      clearOfflineSyncSnapshot(scopeKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, scopeKey]);
}
