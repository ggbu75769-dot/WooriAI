import { useSyncExternalStore } from "react";
import type {
  LegacyQuarantineSummary,
  LocalExpenseRow,
  RemoteSyncMetadata
} from "./types";

export type SyncStatusCounts = {
  pending: number;
  syncing: number;
  retryWait: number;
  failed: number;
  authRequired: number;
  permissionDenied: number;
  permanentFailure: number;
  retryExhausted: number;
  conflict: number;
};

export type OfflineSyncDisplayRow = LocalExpenseRow & {
  attemptCount: number;
  nextRetryAt: string | null;
};

export type SyncSnapshot = {
  counts: SyncStatusCounts;
  rows: OfflineSyncDisplayRow[];
  quarantine: LegacyQuarantineSummary;
  remoteSync: RemoteSyncMetadata;
};

export function createEmptySyncStatusCounts(): SyncStatusCounts {
  return {
    pending: 0,
    syncing: 0,
    retryWait: 0,
    failed: 0,
    authRequired: 0,
    permissionDenied: 0,
    permanentFailure: 0,
    retryExhausted: 0,
    conflict: 0
  };
}

const emptySnapshot: SyncSnapshot = {
  counts: createEmptySyncStatusCounts(),
  rows: [],
  quarantine: {
    total: 0,
    awaitingReconciliation: 0,
    ambiguous: 0,
    corrupt: 0,
    duplicate: 0,
    alreadySynced: 0
  },
  remoteSync: {
  protocolVersion: 2,
  cursor: null,
  baselineComplete: false,
  lastSuccessfulPullAt: null,
  authorizationState: "unknown",
  authorizationCheckedAt: null
  }
};

let latestSnapshot: SyncSnapshot = emptySnapshot;
let activeSnapshotScopeKey: string | null = null;
const snapshotListeners = new Set<() => void>();

function notifySnapshotListeners() {
  for (const listener of snapshotListeners) listener();
}

export function activateOfflineSyncSnapshotScope(scopeKey: string): void {
  activeSnapshotScopeKey = scopeKey;
}

export function clearOfflineSyncSnapshot(scopeKey?: string): void {
  if (scopeKey !== undefined && activeSnapshotScopeKey !== scopeKey) return;
  activeSnapshotScopeKey = null;
  latestSnapshot = emptySnapshot;
  notifySnapshotListeners();
}

export function publishOfflineSyncSnapshot(scopeKey: string, snapshot: SyncSnapshot): void {
  if (activeSnapshotScopeKey !== scopeKey) return;
  latestSnapshot = snapshot;
  notifySnapshotListeners();
}

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

export function useOfflinePendingExpenses(childId: string | null): LocalExpenseRow[] {
  const snapshot = useOfflineSyncSnapshot();
  if (!childId) return [];
  return snapshot.rows.filter((row) => row.childId === childId && row.syncState !== "synced" && !row.pendingDelete);
}
