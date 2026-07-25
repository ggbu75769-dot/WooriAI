import { describe, expect, it } from "vitest";
import type { Expense } from "../api/client";
import { createMemoryOfflineStore, createMemoryOfflineStoreBackend } from "./memory-offline-store";
import type { LocalExpenseRow, MutationOutboxRow, RemoteSyncChange } from "./types";

const scopeKey = "v1:user-a:household-a";
const householdId = "household-a";

function expense(id: string, version: number, amountKrw = 10_000): Expense {
  return {
    id,
    childId: "child-a",
    categoryId: "category-a",
    amountKrw,
    spentOn: "2026-07-24",
    itemName: `기록 ${id}`,
    paymentMethod: "card",
    expenseType: "expense",
    source: "manual",
    version
  };
}

function upsert(id: string, version: number, amountKrw = 10_000): RemoteSyncChange {
  return {
    type: "expense",
    op: "upsert",
    householdId,
    childId: "child-a",
    data: expense(id, version, amountKrw)
  };
}

function tombstone(id: string, version: number): RemoteSyncChange {
  return {
    type: "expense",
    op: "delete",
    householdId,
    childId: "child-a",
    id,
    version,
    deletedAt: "2026-07-24T03:00:00.000Z"
  };
}

function localRow(
  id: string,
  overrides: Partial<LocalExpenseRow> = {}
): LocalExpenseRow {
  return {
    scopeKey,
    localId: `local-${id}`,
    canonicalId: id,
    childId: "child-a",
    payload: {
      childId: "child-a",
      categoryId: "category-a",
      amountKrw: 10_000,
      spentOn: "2026-07-24",
      itemName: `기록 ${id}`,
      paymentMethod: "card",
      expenseType: "expense"
    },
    version: 1,
    syncState: "synced",
    pendingDelete: false,
    conflictCurrent: null,
    lastError: null,
    failureKind: null,
    createdAt: "2026-07-24T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:00.000Z",
    ...overrides
  };
}

function mutation(localId: string, operation: MutationOutboxRow["operation"]): MutationOutboxRow {
  return {
    scopeKey,
    mutationId: `mutation-${localId}`,
    idempotencyKey: `idem-${localId}`,
    operation,
    targetLocalId: localId,
    payload: operation === "delete" ? null : localRow("payload").payload,
    expectedVersion: 1,
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: "2026-07-24T01:00:00.000Z"
  };
}

describe("atomic household delta reconciliation", () => {
  it("converges more than 200 changes across persisted pages", async () => {
    const store = createMemoryOfflineStore(scopeKey);
    const first = Array.from({ length: 200 }, (_, index) =>
      upsert(`expense-${index.toString().padStart(3, "0")}`, 1)
    );
    await store.applyRemoteSyncPage({
      householdId,
      expectedCursor: null,
      changes: first,
      nextCursor: "cursor-200",
      hasMore: true,
      appliedAt: "2026-07-24T02:00:00.000Z"
    });
    expect((await store.getRemoteSyncMetadata()).baselineComplete).toBe(false);

    await store.applyRemoteSyncPage({
      householdId,
      expectedCursor: "cursor-200",
      changes: [upsert("expense-200", 1)],
      nextCursor: "cursor-201",
      hasMore: false,
      appliedAt: "2026-07-24T02:01:00.000Z"
    });

    expect(await store.listLocalExpenses()).toHaveLength(201);
    expect(await store.getRemoteSyncMetadata()).toEqual({
      protocolVersion: 2,
      cursor: "cursor-201",
      baselineComplete: true,
      lastSuccessfulPullAt: "2026-07-24T02:01:00.000Z",
      authorizationState: "authorized",
      authorizationCheckedAt: "2026-07-24T02:01:00.000Z"
    });
  });

  it("rolls back rows and cursor when ownership changes before commit", async () => {
    const store = createMemoryOfflineStore(scopeKey);
    let checks = 0;
    await expect(
      store.applyRemoteSyncPage({
        householdId,
        expectedCursor: null,
        changes: [upsert("expense-1", 1)],
        nextCursor: "cursor-1",
        hasMore: false,
        appliedAt: "2026-07-24T02:00:00.000Z",
        ownerStillCurrent: () => {
          checks += 1;
          return checks === 1;
        }
      })
    ).rejects.toThrow("SYNC_OWNER_CHANGED");
    expect(await store.listLocalExpenses()).toEqual([]);
    expect((await store.getRemoteSyncMetadata()).cursor).toBeNull();
  });

  it("rejects malformed pages atomically", async () => {
    const store = createMemoryOfflineStore(scopeKey);
    await expect(
      store.applyRemoteSyncPage({
        householdId,
        expectedCursor: null,
        changes: [upsert("expense-1", 1), upsert("expense-1", 1)],
        nextCursor: "cursor-1",
        hasMore: false,
        appliedAt: "2026-07-24T02:00:00.000Z"
      })
    ).rejects.toThrow("SYNC_PAGE_INVARIANT_FAILED");
    await expect(
      store.applyRemoteSyncPage({
        householdId,
        expectedCursor: null,
        changes: [],
        nextCursor: null,
        hasMore: true,
        appliedAt: "2026-07-24T02:00:00.000Z"
      })
    ).rejects.toThrow("SYNC_CURSOR_NOT_ADVANCING");
    expect(await store.listLocalExpenses()).toEqual([]);
  });

  it("replays equal content, applies higher versions, and quarantines equal-version divergence", async () => {
    const store = createMemoryOfflineStore(scopeKey);
    await store.insertLocalExpense(localRow("expense-1"));

    await store.applyRemoteSyncPage({
      householdId,
      expectedCursor: null,
      changes: [upsert("expense-1", 1)],
      nextCursor: "cursor-1",
      hasMore: false,
      appliedAt: "2026-07-24T02:00:00.000Z"
    });
    expect((await store.getLocalExpense("local-expense-1"))?.syncState).toBe("synced");

    await store.applyRemoteSyncPage({
      householdId,
      expectedCursor: "cursor-1",
      changes: [upsert("expense-1", 2, 20_000)],
      nextCursor: "cursor-2",
      hasMore: false,
      appliedAt: "2026-07-24T02:01:00.000Z"
    });
    expect((await store.getLocalExpense("local-expense-1"))?.payload.amountKrw).toBe(20_000);

    await store.applyRemoteSyncPage({
      householdId,
      expectedCursor: "cursor-2",
      changes: [upsert("expense-1", 2, 30_000)],
      nextCursor: "cursor-3",
      hasMore: false,
      appliedAt: "2026-07-24T02:02:00.000Z"
    });
    const divergent = await store.getLocalExpense("local-expense-1");
    expect(divergent?.syncState).toBe("conflict");
    expect(divergent?.payload.amountKrw).toBe(20_000);
    expect(divergent?.conflictCurrent).toMatchObject({
      deleted: false,
      expense: { amountKrw: 30_000, version: 2 }
    });
  });

  it("preserves pending updates at their base, conflicts on advancement, and converges completed deletes", async () => {
    const store = createMemoryOfflineStore(scopeKey);
    const pendingUpdate = localRow("expense-update", { syncState: "pending" });
    const pendingDelete = localRow("expense-delete", {
      syncState: "pending",
      pendingDelete: true
    });
    await store.insertLocalExpense(pendingUpdate);
    await store.insertOutboxMutation(mutation(pendingUpdate.localId, "update"));
    await store.insertLocalExpense(pendingDelete);
    await store.insertOutboxMutation(mutation(pendingDelete.localId, "delete"));

    await store.applyRemoteSyncPage({
      householdId,
      expectedCursor: null,
      changes: [upsert("expense-update", 1), tombstone("expense-delete", 2)],
      nextCursor: "cursor-1",
      hasMore: false,
      appliedAt: "2026-07-24T02:00:00.000Z"
    });
    expect((await store.getLocalExpense(pendingUpdate.localId))?.syncState).toBe("pending");
    expect(await store.getLocalExpense(pendingDelete.localId)).toBeNull();
    expect(await store.listOutboxMutationsForLocalId(pendingDelete.localId)).toEqual([]);

    await store.applyRemoteSyncPage({
      householdId,
      expectedCursor: "cursor-1",
      changes: [upsert("expense-update", 2, 25_000)],
      nextCursor: "cursor-2",
      hasMore: false,
      appliedAt: "2026-07-24T02:01:00.000Z"
    });
    const conflicted = await store.getLocalExpense(pendingUpdate.localId);
    expect(conflicted?.syncState).toBe("conflict");
    expect(conflicted?.payload.amountKrw).toBe(10_000);
    expect(await store.listOutboxMutationsForLocalId(pendingUpdate.localId)).toHaveLength(1);
  });

  it("isolates cursor metadata by local user-household scope", async () => {
    const backend = createMemoryOfflineStoreBackend();
    const first = createMemoryOfflineStore("scope-a", backend);
    const second = createMemoryOfflineStore("scope-b", backend);
    await first.applyRemoteSyncPage({
      householdId,
      expectedCursor: null,
      changes: [],
      nextCursor: "cursor-a",
      hasMore: false,
      appliedAt: "2026-07-24T02:00:00.000Z"
    });
    expect((await first.getRemoteSyncMetadata()).cursor).toBe("cursor-a");
    expect((await second.getRemoteSyncMetadata()).cursor).toBeNull();
    await first.resetRemoteSyncMetadata({
      expectedCursor: "cursor-a",
      resetAt: "2026-07-24T02:00:01.000Z"
    });
    expect((await first.getRemoteSyncMetadata()).cursor).toBeNull();
  });
});
