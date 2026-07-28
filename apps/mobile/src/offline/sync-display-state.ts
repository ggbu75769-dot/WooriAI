import type { OfflineFailureKind, SyncState } from "./types";

export type AppSyncStatus = "synced" | "syncing" | "offline" | "pending" | "conflict";

export function normalizeAppSyncStatus(
  counts: { pending: number; syncing: number; retryWait: number; failed: number; conflict: number },
  online: boolean | null = null
): AppSyncStatus {
  if (counts.conflict > 0 || counts.failed > 0) return "conflict";
  if (online === false) return "offline";
  if (counts.syncing > 0) return "syncing";
  if (counts.pending > 0 || counts.retryWait > 0) return "pending";
  return "synced";
}

export type SyncDisplayState =
  | "pending"
  | "syncing"
  | "retry_wait"
  | "auth_required"
  | "conflict"
  | "permission_denied"
  | "permanent_failure"
  | "retry_exhausted"
  | "synced";

export function resolveSyncDisplayState(
  input: {
    syncState: SyncState;
    failureKind: OfflineFailureKind | null;
    nextRetryAt: string | null;
  },
  nowIso = new Date().toISOString()
): SyncDisplayState {
  if (input.syncState === "synced") return "synced";
  if (input.syncState === "syncing") return "syncing";
  if (input.syncState === "conflict") return "conflict";
  if (input.syncState === "pending") {
    return input.nextRetryAt && input.nextRetryAt > nowIso ? "retry_wait" : "pending";
  }
  if (input.failureKind === "auth_required") return "auth_required";
  if (input.failureKind === "permission_denied") return "permission_denied";
  if (input.failureKind === "retry_exhausted") return "retry_exhausted";
  return "permanent_failure";
}

export function syncDisplayMessage(state: SyncDisplayState): string {
  switch (state) {
    case "pending":
      return "연결되면 자동으로 동기화합니다.";
    case "syncing":
      return "서버에 안전하게 반영하고 있어요.";
    case "retry_wait":
      return "잠시 후 자동으로 다시 시도합니다.";
    case "auth_required":
      return "로그인이 필요해 동기화를 멈췄어요.";
    case "conflict":
      return "다른 기기에서 먼저 수정된 기록을 확인해 주세요.";
    case "permission_denied":
      return "이 기록을 변경할 권한이 없어요.";
    case "retry_exhausted":
      return "자동 재시도를 마쳤어요. 상태를 확인한 뒤 다시 시도해 주세요.";
    case "permanent_failure":
      return "입력 내용을 확인한 뒤 다시 시도해 주세요.";
    case "synced":
      return "서버에 반영됐어요.";
  }
}

export type SyncRecoveryGroups<T> = {
  authRequired: T[];
  conflicts: T[];
  permissionDenied: T[];
  permanentFailures: T[];
  retryExhausted: T[];
  retryWait: T[];
  pending: T[];
  syncing: T[];
};

export function groupSyncRecoveryRows<
  T extends {
    syncState: SyncState;
    failureKind: OfflineFailureKind | null;
    nextRetryAt: string | null;
  }
>(rows: T[], nowIso = new Date().toISOString()): SyncRecoveryGroups<T> {
  const groups: SyncRecoveryGroups<T> = {
    authRequired: [],
    conflicts: [],
    permissionDenied: [],
    permanentFailures: [],
    retryExhausted: [],
    retryWait: [],
    pending: [],
    syncing: []
  };
  for (const row of rows) {
    const state = resolveSyncDisplayState(row, nowIso);
    if (state === "auth_required") groups.authRequired.push(row);
    else if (state === "conflict") groups.conflicts.push(row);
    else if (state === "permission_denied") groups.permissionDenied.push(row);
    else if (state === "permanent_failure") groups.permanentFailures.push(row);
    else if (state === "retry_exhausted") groups.retryExhausted.push(row);
    else if (state === "retry_wait") groups.retryWait.push(row);
    else if (state === "pending") groups.pending.push(row);
    else if (state === "syncing") groups.syncing.push(row);
  }
  return groups;
}

export function highestPriorityRecoveryState<T>(
  groups: SyncRecoveryGroups<T>,
  quarantineCount: number
): SyncDisplayState | "quarantined_legacy" | null {
  if (groups.authRequired.length) return "auth_required";
  if (groups.conflicts.length) return "conflict";
  if (groups.permissionDenied.length || groups.permanentFailures.length) return "permanent_failure";
  if (groups.retryExhausted.length) return "retry_exhausted";
  if (quarantineCount > 0) return "quarantined_legacy";
  if (groups.retryWait.length) return "retry_wait";
  if (groups.pending.length) return "pending";
  if (groups.syncing.length) return "syncing";
  return null;
}
