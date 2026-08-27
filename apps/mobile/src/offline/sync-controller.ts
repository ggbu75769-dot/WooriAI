import { useEffect, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { getSyncChanges, LOCAL_SESSION_TOKEN } from "../api/client";
import { bucketSyncLatencyMs, trackAndFlushAnalyticsEvent } from "../analytics/client";
import { useSessionStore } from "../stores/session.store";
import { isCurrentlyOnline, startConnectivityWatcher } from "./connectivity";
import { runDeltaPull, syncCursorScopeKey } from "./delta-sync";
import { isSessionExpiryTransition, LOGIN_HREF } from "./session-expiry";
import {
  clearSessionScopedQueryCache,
  isSessionIdentityChange,
  subscribeToHydratedSessionTransitions,
  teardownOfflineSessionState
} from "./session-teardown";
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
  retryAllFailedMutations,
  discardAllFailedMutations,
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
    // FIX-119B/F1 (R19 H-2): 준비템 무효화의 "실제" 시점은 여기다. 지출 저장은 로컬 우선
    // (createExpenseOffline)이라 화면(app/expenses/new.tsx)의 무효화는 아직 서버에 아무것도
    // 보내기 전에 실행된다 -- 서버가 연결 지출을 받아 준비템을 '준비 완료'로 올리는 것
    // (apps/api store-shared.ts markLinkedItemPrepared)은 이 flush가 성공한 뒤다. 여기서
    // 함께 무효화하지 않으면 방금 기록한 준비템이 다음 자연 refetch(최대 30초+)까지 계속
    // 미준비로 보이고 준비율도 정체된 것처럼 읽힌다. ["items"] 프리픽스는 목록·탭·준비율
    // (app/(tabs)/items.tsx의 ["items", childId, "prep-progress"])을 모두 덮는다.
    // 어떤 mutation이 연결 지출이었는지는 FlushSummary가 알지 못하므로(그리고 flush는 여러
    // 건을 한 번에 확정하므로) 조건 없이 무효화한다 -- 최악이라도 refetch 한 번이다.
    await queryClient.invalidateQueries({ queryKey: ["items"] });
    await queryClient.invalidateQueries({ queryKey: ["item-detail"] });
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

/**
 * SYNC-127 "전체 재시도". Same shape as `retryOfflineMutation` (requeue → snapshot → one background
 * flush) but for every failed row at once: the point of the bulk action is that 100 failed rows
 * cost one flush pass instead of 100 individually-triggered ones. Returns the number of rows
 * requeued so the screen can say nothing happened when there were none.
 */
export async function retryAllOfflineMutations(token: string, queryClient: QueryClient): Promise<number> {
  const store = await getOfflineStore();
  const count = await retryAllFailedMutations(store);
  await refreshSnapshot();
  if (count > 0) void flushInBackground(token, queryClient);
  return count;
}

/** SYNC-127 "전체 버리기". Destructive — the screen confirms with an Alert first. */
export async function discardAllOfflineMutations(): Promise<number> {
  const store = await getOfflineStore();
  const count = await discardAllFailedMutations(store);
  await refreshSnapshot();
  return count;
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

  // MOB-103b + PRIV-104: logging out or switching account (userId change, including to/from the
  // local test session) tears down ALL user-scoped offline state -- the delta-sync cursor
  // (MOB-103b) plus, since PRIV-104, the local_expenses/mutation_outbox/sync_meta tables and the
  // persisted purchase-followup store, so the next account on this device never inherits the
  // previous account's rows. The policy (which transitions wipe, race sequencing against an
  // in-flight flush) lives in session-teardown.ts, unit-tested; this subscription is only the
  // trigger. The scope-key check in delta-sync.ts's loadSyncCursor is the belt-and-braces
  // fallback for the cursor if this subscription never got the chance to run (e.g. app killed
  // mid-switch). Deliberately NOT keyed on the selected child: the server cursor spans all of
  // the user's children (see delta-sync.ts's header).
  // AUTH-127: eject to the login screen the moment a refresh-401 ends the session involuntarily.
  //
  // Why here, of all places: the redirect must fire no matter which screen is focused (an expiry
  // can land on 기록 탭, 지출 상세, 설정 — anywhere a request is in flight), so it needs a mount
  // that lives for the whole app lifetime, and it must not live in src/api/client.ts because that
  // module is imported by dozens of vitest files that cannot load expo-router. This hook is
  // already exactly that mount (app/_layout.tsx renders it once, inside the router tree) and
  // already owns the session-store subscription that reacts to session transitions, so the new
  // policy sits next to the one it is a sibling of: session-teardown decides "wipe?",
  // session-expiry decides "eject?". Both are unit-tested pure functions; this stays glue.
  //
  // Without it the user simply stayed put with a dead token, and every screen's
  // `Boolean(authToken && childId)` gate — now false — quietly swapped in the logged-out preview
  // fixtures (다온이 / 1,245,700원), which read as their own data. The redirect removes that
  // exposure at the source; the preview gates themselves are untouched by AUTH-127.
  useEffect(() => {
    const unsubscribe = useSessionStore.subscribe((state, previous) => {
      if (!isSessionExpiryTransition(previous, state)) return;
      try {
        router.replace(LOGIN_HREF);
      } catch {
        // Navigating before the root navigator is mounted throws. Nothing is lost: the reason is
        // persisted, so app/index.tsx's own hydrated redirect sends the user to /login on the very
        // next render pass (and the login screen still shows the notice).
      }
    });
    return unsubscribe;
  }, []);

  // AUTH-127 (round27 H-1): subscribed through subscribeToHydratedSessionTransitions, NOT
  // useSessionStore.subscribe directly. zustand's persist middleware ends its rehydration with an
  // ordinary replace-set, which notifies every subscriber with the pre-hydration (initial,
  // userId: null) state as `previous` — so on a cold start a raw subscriber reads the restored
  // `null → "user-a"` as a login and wipes the outbox an expiry had deliberately preserved. The
  // helper (unit-tested in session-teardown.test.ts) defers this subscription until hydration is
  // done; every real transition after that arrives unchanged.
  //
  // The expiry subscription above is deliberately NOT gated the same way: rehydrating into a
  // persisted "expired" state on a cold start genuinely does belong on the login screen (which is
  // where app/index.tsx sends it anyway), and that path is edge-triggered and idempotent.
  useEffect(
    () =>
      subscribeToHydratedSessionTransitions(useSessionStore, (state, previous) => {
        if (isSessionIdentityChange(previous, state)) {
          // FIX-118A: the token of the session that is LEAVING (the store already holds the
          // incoming one), so teardown's best-effort push-device deactivation can still
          // authenticate as the outgoing account. Mirrors the token derivation in
          // app/_layout.tsx's OfflineSyncLifecycle.
          const outgoingToken = previous.accessToken ?? (previous.isTestSession ? LOCAL_SESSION_TOKEN : null);
          // Round27 M-1: synchronous, in the same tick as the session-store `set` that just
          // scheduled the incoming account's re-render — everything below is a promise hop and
          // therefore lands after it. See clearSessionScopedQueryCache's contract.
          clearSessionScopedQueryCache();
          void getOfflineStore()
            .then((store) => teardownOfflineSessionState(store, { authToken: outgoingToken }))
            .catch(() => undefined);
        }
      }),
    []
  );
}
