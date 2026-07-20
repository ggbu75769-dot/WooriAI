import { describe, expect, it } from "vitest";
import { groupSyncRecoveryRows, highestPriorityRecoveryState, resolveSyncDisplayState, syncDisplayMessage } from "./sync-display-state";

describe("offline sync display state", () => {
  it("separates retry wait, authentication, conflict, and exhausted states", () => {
    const now = "2026-07-17T00:00:00.000Z";
    expect(resolveSyncDisplayState({ syncState: "pending", failureKind: null, nextRetryAt: "2026-07-17T00:01:00.000Z" }, now)).toBe("retry_wait");
    expect(resolveSyncDisplayState({ syncState: "failed", failureKind: "auth_required", nextRetryAt: null }, now)).toBe("auth_required");
    expect(resolveSyncDisplayState({ syncState: "conflict", failureKind: null, nextRetryAt: null }, now)).toBe("conflict");
    expect(resolveSyncDisplayState({ syncState: "failed", failureKind: "retry_exhausted", nextRetryAt: null }, now)).toBe("retry_exhausted");
  });

  it("never returns a raw transport or SQLite message", () => {
    for (const state of ["auth_required", "permission_denied", "permanent_failure", "retry_exhausted"] as const) {
      expect(syncDisplayMessage(state)).not.toMatch(/sqlite|sql|stack|http|401|403|500/i);
    }
  });

  it("groups recovery states in the user-action priority order", () => {
    const now = "2026-07-17T00:00:00.000Z";
    const rows = [
      { id: "wait", syncState: "pending" as const, failureKind: null, nextRetryAt: "2026-07-17T00:01:00.000Z" },
      { id: "auth", syncState: "failed" as const, failureKind: "auth_required" as const, nextRetryAt: null },
      { id: "conflict", syncState: "conflict" as const, failureKind: null, nextRetryAt: null },
      { id: "validation", syncState: "failed" as const, failureKind: "validation" as const, nextRetryAt: null },
      { id: "exhausted", syncState: "failed" as const, failureKind: "retry_exhausted" as const, nextRetryAt: null }
    ];
    const groups = groupSyncRecoveryRows(rows, now);
    expect(groups.authRequired.map((row) => row.id)).toEqual(["auth"]);
    expect(groups.conflicts.map((row) => row.id)).toEqual(["conflict"]);
    expect(groups.permanentFailures.map((row) => row.id)).toEqual(["validation"]);
    expect(groups.retryExhausted.map((row) => row.id)).toEqual(["exhausted"]);
    expect(groups.retryWait.map((row) => row.id)).toEqual(["wait"]);
    expect(highestPriorityRecoveryState(groups, 1)).toBe("auth_required");

    const withoutAuth = { ...groups, authRequired: [] };
    expect(highestPriorityRecoveryState(withoutAuth, 1)).toBe("conflict");
    expect(highestPriorityRecoveryState({
      ...withoutAuth,
      conflicts: [],
      permanentFailures: [],
      retryExhausted: [],
      retryWait: []
    }, 1)).toBe("quarantined_legacy");
  });
});
