import { describe, expect, it } from "vitest";
import { createMemoryOfflineStore } from "./memory-offline-store";
import type { LocalExpenseRow, MutationOutboxRow } from "./types";

const timestamp = "2026-07-24T00:00:00.000Z";

function localRow(scopeKey: string): LocalExpenseRow {
  return {
    scopeKey,
    localId: "local-1",
    canonicalId: null,
    childId: "child-1",
    payload: {
      childId: "child-1",
      categoryId: "category-1",
      amountKrw: 1_000,
      spentOn: "2026-07-24",
      itemName: "기저귀"
    },
    version: null,
    syncState: "pending",
    pendingDelete: false,
    conflictCurrent: null,
    lastError: null,
    failureKind: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function mutation(scopeKey: string): MutationOutboxRow {
  return {
    scopeKey,
    mutationId: "mutation-1",
    idempotencyKey: "idempotency-1",
    operation: "create",
    targetLocalId: "local-1",
    payload: localRow(scopeKey).payload,
    expectedVersion: null,
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: timestamp
  };
}

describe("atomic offline row and outbox storage", () => {
  it("rejects the whole composite write when one member has the wrong scope", async () => {
    const store = createMemoryOfflineStore("scope-a");
    await expect(
      store.commitLocalMutation({
        targetLocalId: "local-1",
        expectedLocalRow: null,
        expectedMutations: [],
        localRow: localRow("scope-a"),
        deleteMutationIds: [],
        upsertMutations: [mutation("scope-b")]
      })
    ).rejects.toThrow("OFFLINE_SCOPE_MISMATCH");
    expect(await store.getLocalExpense("local-1")).toBeNull();
    expect(await store.listOutboxMutations()).toEqual([]);
  });

  it("keeps a newer queued payload while acknowledging an older in-flight mutation", async () => {
    const store = createMemoryOfflineStore("scope-a");
    const older = mutation("scope-a");
    const newer = {
      ...mutation("scope-a"),
      mutationId: "mutation-2",
      payload: { ...mutation("scope-a").payload!, itemName: "최신 수정" }
    };
    await store.commitLocalMutation({
      targetLocalId: "local-1",
      expectedLocalRow: null,
      expectedMutations: [],
      localRow: {
        ...localRow("scope-a"),
        payload: newer.payload!
      },
      deleteMutationIds: [],
      upsertMutations: [older, newer]
    });
    const result = await store.acknowledgeOutboxMutation({
      mutationId: older.mutationId,
      targetLocalId: "local-1",
      deleteLocalExpense: false,
      acknowledgedAt: "2026-07-24T00:01:00.000Z",
      rowPatch: {
        canonicalId: "expense-1",
        version: 1,
        payload: { ...older.payload!, itemName: "서버의 이전 값" }
      }
    });
    expect(result.remainingMutationCount).toBe(1);
    expect(await store.getLocalExpense("local-1")).toMatchObject({
      canonicalId: "expense-1",
      version: 1,
      syncState: "pending",
      payload: { itemName: "최신 수정" }
    });
  });

  it("rejects a stale composite edit after flush marks its mutation in flight", async () => {
    const store = createMemoryOfflineStore("scope-a");
    const originalRow = localRow("scope-a");
    const originalMutation = mutation("scope-a");
    await store.commitLocalMutation({
      targetLocalId: "local-1",
      expectedLocalRow: null,
      expectedMutations: [],
      localRow: originalRow,
      deleteMutationIds: [],
      upsertMutations: [originalMutation]
    });

    const staleRow = await store.getLocalExpense("local-1");
    const staleMutations = await store.listOutboxMutationsForLocalId("local-1");
    await store.updateOutboxMutation(originalMutation.mutationId, { inFlight: true });

    await expect(
      store.commitLocalMutation({
        targetLocalId: "local-1",
        expectedLocalRow: staleRow,
        expectedMutations: staleMutations.map((row) => ({
          mutationId: row.mutationId,
          inFlight: row.inFlight === true
        })),
        localRow: {
          ...originalRow,
          payload: { ...originalRow.payload, itemName: "유실되면 안 되는 최신 수정" }
        },
        deleteMutationIds: [],
        upsertMutations: staleMutations
      })
    ).rejects.toThrow("OFFLINE_MUTATION_RACE");

    expect(await store.getOutboxMutation(originalMutation.mutationId)).toMatchObject({
      inFlight: true,
      payload: { itemName: "기저귀" }
    });
  });
});
