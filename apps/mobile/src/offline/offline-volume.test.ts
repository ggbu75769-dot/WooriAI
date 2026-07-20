import { describe, expect, it, vi } from "vitest";
import {
  createMemoryOfflineStore,
  createMemoryOfflineStoreBackend
} from "./memory-offline-store";
import { makeOfflineScopeKey } from "./session-scope";
import { flushOutbox, recordLocalCreate, type RemoteExpenseApi } from "./sync-engine";

describe("offline queue volume and scheduler safety", () => {
  it("flushes 500 pending rows once with stable, unique idempotency keys", async () => {
    const store = createMemoryOfflineStore("v1:user-a:household-a");
    for (let index = 0; index < 500; index += 1) {
      await recordLocalCreate(store, {
        childId: "child-a",
        categoryId: "category-a",
        amountKrw: index + 1,
        spentOn: "2026-07-17",
        itemName: `준비 지출 ${index + 1}`
      }, `2026-07-17T00:${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000Z`);
    }

    const receivedKeys = new Set<string>();
    const createExpense = vi.fn(async (_payload, idempotencyKey: string) => {
      receivedKeys.add(idempotencyKey);
      return { id: `server-${receivedKeys.size}`, version: 1 };
    });
    const remote: RemoteExpenseApi = {
      createExpense,
      async updateExpense() {
        throw new Error("not used");
      },
      async deleteExpense() {
        throw new Error("not used");
      }
    };

    const [first, duplicateScheduler] = await Promise.all([
      flushOutbox(store, remote),
      flushOutbox(store, remote)
    ]);

    expect(first).toEqual(duplicateScheduler);
    expect(first).toEqual({
      synced: 500,
      failed: 0,
      conflicted: 0,
      stoppedForNetwork: false
    });
    expect(createExpense).toHaveBeenCalledTimes(500);
    expect(receivedKeys.size).toBe(500);
    expect(await store.listOutboxMutations()).toEqual([]);
    expect((await store.listLocalExpenses()).every((row) => row.syncState === "synced")).toBe(true);

    await flushOutbox(store, remote);
    expect(createExpense).toHaveBeenCalledTimes(500);
  });

  it("does not duplicate a server-committed create after 50 lost responses", async () => {
    for (let repeat = 0; repeat < 50; repeat += 1) {
      const store = createMemoryOfflineStore(`v1:user-${repeat}:household-${repeat}`);
      const created = await recordLocalCreate(store, {
        childId: `child-${repeat}`,
        categoryId: "category-a",
        amountKrw: repeat + 1,
        spentOn: "2026-07-17",
        itemName: `응답 유실 ${repeat + 1}`
      });
      const committedByKey = new Map<string, { id: string; version: number }>();
      let firstResponse = true;
      const remote: RemoteExpenseApi = {
        async createExpense(_payload, idempotencyKey) {
          const committed = committedByKey.get(idempotencyKey) ?? {
            id: `server-${repeat}`,
            version: 1
          };
          committedByKey.set(idempotencyKey, committed);
          if (firstResponse) {
            firstResponse = false;
            throw new TypeError("Network response was lost");
          }
          return committed;
        },
        async updateExpense() {
          throw new Error("not used");
        },
        async deleteExpense() {
          throw new Error("not used");
        }
      };

      await flushOutbox(store, remote);
      const pendingMutation = (await store.listOutboxMutationsForLocalId(created.localId))[0]!;
      await store.updateOutboxMutation(pendingMutation.mutationId, { nextRetryAt: null });
      await flushOutbox(store, remote);

      expect(committedByKey.size).toBe(1);
      expect(await store.getLocalExpense(created.localId)).toMatchObject({
        canonicalId: `server-${repeat}`,
        syncState: "synced"
      });
      expect(await store.listOutboxMutations()).toEqual([]);
    }
  });

  it("keeps user A and B queues isolated across 50 account switches", async () => {
    for (let repeat = 0; repeat < 50; repeat += 1) {
      const backend = createMemoryOfflineStoreBackend();
      const userA = createMemoryOfflineStore(
        makeOfflineScopeKey(`user-a-${repeat}`, `household-a-${repeat}`),
        backend
      );
      const userB = createMemoryOfflineStore(
        makeOfflineScopeKey(`user-b-${repeat}`, `household-b-${repeat}`),
        backend
      );
      await recordLocalCreate(userA, {
        childId: `child-a-${repeat}`,
        categoryId: "category-a",
        amountKrw: repeat + 1,
        spentOn: "2026-07-17",
        itemName: `사용자 A ${repeat + 1}`
      });

      expect(await userB.listLocalExpenses()).toEqual([]);
      expect(await userB.listOutboxMutations()).toEqual([]);
      expect(await userA.listLocalExpenses()).toHaveLength(1);
      expect(await userA.listOutboxMutations()).toHaveLength(1);
    }
  });
});
