import { describe, expect, it, vi } from "vitest";
import { createMemoryOfflineStore, createMemoryOfflineStoreBackend } from "./memory-offline-store";
import { makeOfflineScopeKey, resolveOfflineScopeKey } from "./session-scope";
import {
  flushOutbox,
  purgeOfflineStore,
  recordLocalCreate,
  recordLocalUpdate,
  type RemoteExpenseApi
} from "./sync-engine";
import type { ExpensePayload } from "./types";

const payload: ExpensePayload = {
  childId: "child-a",
  categoryId: "category-a",
  amountKrw: 12_000,
  spentOn: "2026-07-16",
  itemName: "기저귀"
};

describe("offline session scope", () => {
  it("never exposes or flushes another user's pending expense after an account switch", async () => {
    const backend = createMemoryOfflineStoreBackend();
    const ownerScope = makeOfflineScopeKey("user-owner", "household-owner");
    const otherScope = makeOfflineScopeKey("user-other", "household-other");
    const ownerStore = createMemoryOfflineStore(ownerScope, backend);
    const otherStore = createMemoryOfflineStore(otherScope, backend);

    const ownerRow = await recordLocalCreate(ownerStore, payload, "2026-07-16T00:00:00.000Z");

    expect(await otherStore.listLocalExpenses()).toEqual([]);
    expect(await otherStore.listOutboxMutations()).toEqual([]);
    await expect(recordLocalUpdate(otherStore, ownerRow.localId, { amountKrw: 99_000 })).rejects.toThrow();

    const createExpense = vi.fn(async () => ({ id: "server-other", version: 1 }));
    const remote: RemoteExpenseApi = {
      createExpense,
      async updateExpense() {
        throw new Error("not used");
      },
      async deleteExpense() {
        throw new Error("not used");
      }
    };

    await expect(flushOutbox(otherStore, remote)).resolves.toEqual({
      synced: 0,
      failed: 0,
      conflicted: 0,
      stoppedForNetwork: false
    });
    expect(createExpense).not.toHaveBeenCalled();

    await expect(flushOutbox(ownerStore, remote)).resolves.toMatchObject({ synced: 1 });
    expect(createExpense).toHaveBeenCalledTimes(1);
  });

  it("keeps legacy unscoped rows quarantined instead of assigning them to the next login", async () => {
    const backend = createMemoryOfflineStoreBackend();
    const legacyStore = createMemoryOfflineStore(undefined, backend);
    const legacyRow = await recordLocalCreate(legacyStore, payload, "2026-07-16T00:00:00.000Z");
    const signedInStore = createMemoryOfflineStore(
      makeOfflineScopeKey("new-user", "new-household"),
      backend
    );

    expect(await legacyStore.getLocalExpense(legacyRow.localId)).not.toBeNull();
    expect(await signedInStore.getLocalExpense(legacyRow.localId)).toBeNull();
    expect(await signedInStore.listOutboxMutations()).toEqual([]);
  });

  it("purges only the deleted account's local scope", async () => {
    const backend = createMemoryOfflineStoreBackend();
    const deletedStore = createMemoryOfflineStore(makeOfflineScopeKey("deleted-user", "household-a"), backend);
    const retainedStore = createMemoryOfflineStore(makeOfflineScopeKey("retained-user", "household-b"), backend);
    await recordLocalCreate(deletedStore, payload);
    await recordLocalCreate(retainedStore, { ...payload, childId: "child-b" });

    await purgeOfflineStore(deletedStore);

    expect(await deletedStore.listLocalExpenses()).toEqual([]);
    expect(await deletedStore.listOutboxMutations()).toEqual([]);
    expect(await retainedStore.listLocalExpenses()).toHaveLength(1);
    expect(await retainedStore.listOutboxMutations()).toHaveLength(1);
  });

  it("derives a stable scope only when the authenticated identity is complete", () => {
    expect(
      resolveOfflineScopeKey({
        accessToken: "token-a",
        userId: "user-a",
        defaultHouseholdId: "household-a",
        isTestSession: false
      })
    ).toBe(makeOfflineScopeKey("user-a", "household-a"));
    expect(
      resolveOfflineScopeKey({
        accessToken: "token-a",
        userId: null,
        defaultHouseholdId: "household-a",
        isTestSession: false
      })
    ).toBeNull();
    expect(
      resolveOfflineScopeKey({
        accessToken: null,
        userId: null,
        defaultHouseholdId: null,
        isTestSession: false
      })
    ).toBeNull();
    expect(
      resolveOfflineScopeKey({
        accessToken: null,
        userId: null,
        defaultHouseholdId: null,
        isTestSession: true,
        testUserId: "test-user",
        testHouseholdId: "test-household"
      })
    ).toBe(makeOfflineScopeKey("test-user", "test-household"));
    expect(
      resolveOfflineScopeKey({
        accessToken: null,
        userId: null,
        defaultHouseholdId: null,
        isTestSession: true
      })
    ).toBeNull();
  });
});
