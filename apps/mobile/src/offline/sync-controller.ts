import { useEffect, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import { getSyncChanges } from "../api/client";
import { bucketSyncLatencyMs, trackAndFlushAnalyticsEvent } from "../analytics/client";
import { useSessionStore } from "../stores/session.store";
import { isCurrentlyOnline, startConnectivityWatcher } from "./connectivity";
import { clearSyncCursor, runDeltaPull, syncCursorScopeKey } from "./delta-sync";
import { SERVER_CONFIRMED_MESSAGE } from "./messages";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { createClientRemoteExpenseApi } from "./remote-api";
import {
  diffExpenseFields,
  discardFailedMutation,
  flushOutbox,
  recordLocalCreate,
  recordLocalDelete,
  recordLocalUpdate,
  resolveConflictAdoptServer,
  resolveConflictReapplyMine,
  resolveConflictWithMergedPayload,
  retryFailedMutation,
  type FlushSummary
} from "./sync-engine";
import { generateOfflineId, type ExpensePayload, type LocalExpenseRow, type OfflineStore } from "./types";
import type { Expense } from "../api/client";

/**
 * MOB-102 (round5a-sprint1-plan.md §3) glue layer wiring the transport-agnostic offline core
 * (sync-engine.ts, fully unit-tested) to the real app: a singleton SQLite-backed store, a
 * reactive status snapshot for screens (records tab badge, EXP-005 sync-status screen), and
 * connectivity-triggered background flush. None of this file's logic is unit-testable in vitest
 * (native SQLite/AppState/expo-network) -- it is intentionally kept thin, delegating all
 * decision-making to sync-engine.ts.
 */

let storePromise: Promise<OfflineStore> | null = null;

/** expo-sqlite is imported lazily (dynamic import, not a top-level static import) specifically
 * so no test file can accidentally pull in a native module by importing this controller module
 * -- see sqlite-offline-store.ts's header comment. */
async function getOfflineStore(): Promise<OfflineStore> {
  if (!storePromise) {
    storePromise = (async () => {
      if (Platform.OS === "web") {
        return createMemoryOfflineStore();
      }
      const { createSqliteOfflineStore } = await import("./sqlite-offline-store");
      return createSqliteOfflineStore();
    })();
  }
  return storePromise;
}

export type SyncStatusCounts = { pending: number; syncing: number; failed: number; conflict: number };

export type SyncSnapshot = { counts: SyncStatusCounts; rows: LocalExpenseRow[] };

const emptySnapshot: SyncSnapshot = { counts: { pending: 0, syncing: 0, failed: 0, conflict: 0 }, rows: [] };

let latestSnapshot: SyncSnapshot = emptySnapshot;
const snapshotListeners = new Set<() => void>();

function notifySnapshotListeners() {
  for (const listener of snapshotListeners) listener();
}

export async function refreshOfflineSyncSnapshot(): Promise<void> {
  await refreshSnapshot();
}

async function refreshSnapshot(): Promise<void> {
  const store = await getOfflineStore();
  const rows = await store.listLocalExpenses();
  const counts: SyncStatusCounts = { pending: 0, syncing: 0, failed: 0, conflict: 0 };
  for (const row of rows) {
    if (row.syncState === "synced") continue;
    counts[row.syncState] += 1;
  }
  latestSnapshot = { counts, rows };
  notifySnapshotListeners();
}

/** Reactive read of every local expense row not yet fully synced -- backs both the records-tab
 * badge and the EXP-005 sync-status screen's list. */
export function useOfflineSyncSnapshot(): SyncSnapshot {
  return useSyncExternalStore(
    (listener) => {
      snapshotListeners.add(listener);
      return () => snapshotListeners.delete(listener);
    },
    () => latestSnapshot,
    () => emptySnapshot
  );
}

/** Local (not-yet-synced) rows for one child, for a records-list screen to merge alongside the
 * server-confirmed expenses it already fetches via listExpenses. */
export function useOfflinePendingExpenses(childId: string | null): LocalExpenseRow[] {
  const snapshot = useOfflineSyncSnapshot();
  if (!childId) return [];
  return snapshot.rows.filter((row) => row.childId === childId && row.syncState !== "synced" && !row.pendingDelete);
}

// ---------------------------------------------------------------------------
// Flash messages: "서버 확인 후" copy (design doc §3.3) fires once a background flush actually
// confirms a write with the server, which can happen well after the screen that triggered it has
// navigated away. Screens subscribe and show it as a transient Toast (see app/(tabs)/records.tsx).
// ---------------------------------------------------------------------------

export type OfflineFlashMessage = { id: string; text: string };
const flashListeners = new Set<(message: OfflineFlashMessage) => void>();

export function subscribeOfflineFlashMessage(listener: (message: OfflineFlashMessage) => void): () => void {
  flashListeners.add(listener);
  return () => flashListeners.delete(listener);
}

function emitFlashMessage(text: string) {
  const message: OfflineFlashMessage = { id: generateOfflineId("flash"), text };
  for (const listener of flashListeners) listener(message);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function attemptFlush(token: string, queryClient: QueryClient): Promise<FlushSummary> {
  const store = await getOfflineStore();
  const remote = createClientRemoteExpenseApi(token);
  const startedAt = Date.now();
  const summary = await flushOutbox(store, remote);
  await refreshSnapshot();
  if (summary.synced > 0) {
    await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    await queryClient.invalidateQueries({ queryKey: ["home"] });
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

async function flushInBackground(token: string, queryClient: QueryClient): Promise<void> {
  const online = await isCurrentlyOnline();
  if (!online) return;
  await attemptFlush(token, queryClient).catch(() => undefined);
}

/** Records a new expense locally first (design doc §3.2 step 1) and kicks off a background
 * flush attempt if online. Always resolves once the local write lands -- callers show
 * OFFLINE_SAVED_MESSAGE immediately and never wait on the network. */
export async function createExpenseOffline(
  token: string,
  queryClient: QueryClient,
  payload: ExpensePayload
): Promise<LocalExpenseRow> {
  const store = await getOfflineStore();
  const row = await recordLocalCreate(store, payload);
  await refreshSnapshot();
  void flushInBackground(token, queryClient);
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
  const store = await getOfflineStore();
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

  const payload: ExpensePayload = {
    childId: expense.childId,
    categoryId: expense.categoryId,
    amountKrw: expense.amountKrw,
    spentOn: expense.spentOn,
    itemName: expense.itemName,
    merchant: expense.merchant,
    memo: expense.memo,
    expenseType: expense.expenseType === "refund" ? undefined : expense.expenseType
  };
  const timestamp = new Date().toISOString();

  if (already) {
    await store.updateLocalExpense(already.localId, { payload, version: expense.version, updatedAt: timestamp });
    await refreshSnapshot();
    return (await store.getLocalExpense(already.localId)) as LocalExpenseRow;
  }

  const row: LocalExpenseRow = {
    localId: generateOfflineId("lexp"),
    canonicalId: expense.id,
    childId: expense.childId,
    payload,
    version: expense.version,
    syncState: "synced",
    pendingDelete: false,
    conflictCurrent: null,
    lastError: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  await store.insertLocalExpense(row);
  await refreshSnapshot();
  return row;
}

export async function updateExpenseOffline(
  token: string,
  queryClient: QueryClient,
  localId: string,
  patch: Partial<ExpensePayload>
): Promise<LocalExpenseRow> {
  const store = await getOfflineStore();
  const row = await recordLocalUpdate(store, localId, patch);
  await refreshSnapshot();
  void flushInBackground(token, queryClient);
  return row;
}

export async function deleteExpenseOffline(token: string, queryClient: QueryClient, localId: string): Promise<void> {
  const store = await getOfflineStore();
  await recordLocalDelete(store, localId);
  await refreshSnapshot();
  void flushInBackground(token, queryClient);
}

// ---------------------------------------------------------------------------
// Sync-status screen actions (EXP-005)
// ---------------------------------------------------------------------------

export async function retryOfflineMutation(token: string, queryClient: QueryClient, localId: string): Promise<void> {
  const store = await getOfflineStore();
  await retryFailedMutation(store, localId);
  await refreshSnapshot();
  void flushInBackground(token, queryClient);
}

export async function discardOfflineMutation(localId: string): Promise<void> {
  const store = await getOfflineStore();
  await discardFailedMutation(store, localId);
  await refreshSnapshot();
}

/** ① 다른 기기 값 유지 */
export async function resolveConflictKeepServer(queryClient: QueryClient, localId: string): Promise<void> {
  const store = await getOfflineStore();
  await resolveConflictAdoptServer(store, localId);
  await refreshSnapshot();
  await queryClient.invalidateQueries({ queryKey: ["expenses"] });
}

/** ② 내 변경 다시 적용 */
export async function resolveConflictKeepMine(token: string, queryClient: QueryClient, localId: string): Promise<void> {
  const store = await getOfflineStore();
  await resolveConflictReapplyMine(store, localId);
  await refreshSnapshot();
  void flushInBackground(token, queryClient);
}

/** ③ 두 값 나란히 보기 -> chosen field combination */
export async function resolveConflictKeepChosenFields(
  token: string,
  queryClient: QueryClient,
  localId: string,
  mergedPayload: ExpensePayload
): Promise<void> {
  const store = await getOfflineStore();
  await resolveConflictWithMergedPayload(store, localId, mergedPayload);
  await refreshSnapshot();
  void flushInBackground(token, queryClient);
}

const EXPENSE_FIELD_LABELS: Record<string, string> = {
  categoryId: "카테고리",
  amountKrw: "금액",
  spentOn: "날짜",
  itemName: "품목",
  merchant: "구매처",
  memo: "메모",
  paymentMethod: "결제 수단",
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

/** MOB-103b: best-effort delta pull that resumes from the persisted cursor (delta-sync.ts)
 * instead of re-pulling from scratch on every trigger. The cursor is scoped to the current
 * userId (the server's /sync/changes stream spans all of the user's households/children -- see
 * delta-sync.ts's header), advances only after each page is fully fetched, and is cleared +
 * retried as a full re-pull if the server rejects it (400 SYNC_CURSOR_INVALID). */
async function pullDeltaInBackground(token: string, queryClient: QueryClient): Promise<void> {
  try {
    const store = await getOfflineStore();
    const scopeKey = syncCursorScopeKey(useSessionStore.getState().userId);
    const summary = await runDeltaPull(
      store,
      { fetchChanges: (cursor) => getSyncChanges(token, cursor) },
      { scopeKey }
    );
    if (summary.changeCount > 0 || summary.didResetCursor) {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    }
  } catch {
    // Best-effort (design doc §2.3): a failed pull changes nothing locally; the persisted
    // cursor still points at the last fully-applied page for the next trigger.
  }
}

/** Mount once near the app root (see app/_layout.tsx). Flushes the outbox whenever connectivity
 * is regained or the app returns to the foreground, and does a best-effort cursor-resumed delta
 * pull on app start and the same triggers (design doc §2.3's client pull is best-effort -- see
 * getSyncChanges's doc comment in client.ts; MOB-103b added the persisted cursor). */
export function useOfflineSyncLifecycle(token: string | null, queryClient: QueryClient): void {
  useEffect(() => {
    if (!token) return;
    void refreshSnapshot();
    void flushInBackground(token, queryClient);
    void pullDeltaInBackground(token, queryClient);

    const handle = startConnectivityWatcher(() => {
      void flushInBackground(token, queryClient);
      void pullDeltaInBackground(token, queryClient);
    });
    return () => handle.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // MOB-103b: logging out or switching account (userId change, including to/from the local test
  // session) invalidates the persisted delta-sync cursor. There is no wider offline-state
  // teardown path to hook into today (nothing clears local_expenses/mutation_outbox on
  // clearSession -- see the completion report), so the cursor invalidation subscribes to the
  // session store directly here; the scope-key check in delta-sync.ts's loadSyncCursor is the
  // belt-and-braces fallback if this subscription never got the chance to run (e.g. app killed
  // mid-switch). Deliberately NOT keyed on the selected child: the server cursor spans all of
  // the user's children (see delta-sync.ts's header).
  useEffect(() => {
    const unsubscribe = useSessionStore.subscribe((state, previous) => {
      if (state.userId !== previous.userId || state.isTestSession !== previous.isTestSession) {
        void getOfflineStore()
          .then((store) => clearSyncCursor(store))
          .catch(() => undefined);
      }
    });
    return unsubscribe;
  }, []);
}
