import { describe, expect, it, vi } from "vitest";
import { ApiClientError, type Expense, type SyncChangesV2Result } from "../api/client";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { runPersistedDeltaPull } from "./delta-pull-runner";

const householdId = "household-a";

function expense(id: string): Expense {
  return {
    id,
    childId: "child-a",
    categoryId: "category-a",
    amountKrw: 10_000,
    spentOn: "2026-07-24",
    itemName: id,
    paymentMethod: "unknown",
    expenseType: "expense",
    source: "manual",
    version: 1
  };
}

function page(ids: string[], cursor: string, hasMore: boolean): SyncChangesV2Result {
  return {
    changes: ids.map((id) => ({
      type: "expense",
      op: "upsert",
      householdId,
      childId: "child-a",
      data: expense(id)
    })),
    nextCursor: cursor,
    hasMore
  };
}

describe("persisted delta pull runner", () => {
  it("fetches and commits every page to completion", async () => {
    const store = createMemoryOfflineStore("scope-a");
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(Array.from({ length: 200 }, (_, i) => `expense-${i}`), "c1", true))
      .mockResolvedValueOnce(page(["expense-200"], "c2", false));
    const committed: string[][] = [];

    await expect(
      runPersistedDeltaPull({
        store,
        householdId,
        signal: new AbortController().signal,
        fetchPage,
        isActive: () => true,
        isInvalidCursorError: () => false,
        onPageCommitted: async (childIds) => {
          committed.push(childIds);
        }
      })
    ).resolves.toMatchObject({ complete: true, pages: 2, changes: 201 });
    expect(fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual([null, "c1"]);
    expect(await store.listLocalExpenses()).toHaveLength(201);
    expect(committed).toEqual([["child-a"], ["child-a"]]);
  });

  it("resets an invalid persisted cursor once and restarts from null", async () => {
    const store = createMemoryOfflineStore("scope-a");
    await store.applyRemoteSyncPage({
      householdId,
      expectedCursor: null,
      changes: [],
      nextCursor: "bad-cursor",
      hasMore: false,
      appliedAt: "2026-07-24T00:00:00.000Z"
    });
    const fetchPage = vi
      .fn()
      .mockRejectedValueOnce(new ApiClientError(400, "SYNC_CURSOR_INVALID"))
      .mockResolvedValueOnce(page(["expense-1"], "fresh-cursor", false));

    await expect(
      runPersistedDeltaPull({
        store,
        householdId,
        signal: new AbortController().signal,
        fetchPage,
        isActive: () => true,
        isInvalidCursorError: (error) =>
          error instanceof ApiClientError && error.code === "SYNC_CURSOR_INVALID"
      })
    ).resolves.toMatchObject({ complete: true, resetAttempted: true });
    expect(fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual(["bad-cursor", null]);
    expect((await store.getRemoteSyncMetadata()).cursor).toBe("fresh-cursor");
  });

  it("does not reset indefinitely when the fresh baseline is also rejected", async () => {
    const store = createMemoryOfflineStore("scope-a");
    const error = new ApiClientError(400, "SYNC_CURSOR_INVALID");
    const fetchPage = vi.fn().mockRejectedValue(error);

    await expect(
      runPersistedDeltaPull({
        store,
        householdId,
        signal: new AbortController().signal,
        fetchPage,
        isActive: () => true,
        isInvalidCursorError: (candidate) => candidate === error
      })
    ).rejects.toBe(error);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("keeps the committed continuation cursor when a bounded run yields", async () => {
    const store = createMemoryOfflineStore("scope-a");
    const result = await runPersistedDeltaPull({
      store,
      householdId,
      signal: new AbortController().signal,
      fetchPage: async () => page(["expense-1"], "cursor-1", true),
      isActive: () => true,
      isInvalidCursorError: () => false,
      maxPages: 1
    });
    expect(result.complete).toBe(false);
    expect(await store.getRemoteSyncMetadata()).toMatchObject({
      cursor: "cursor-1",
      baselineComplete: false
    });
  });

  it("aborts before applying a returned page when the session owner changes", async () => {
    const store = createMemoryOfflineStore("scope-a");
    let active = true;
    await expect(
      runPersistedDeltaPull({
        store,
        householdId,
        signal: new AbortController().signal,
        fetchPage: async () => {
          active = false;
          return page(["expense-1"], "cursor-1", false);
        },
        isActive: () => active,
        isInvalidCursorError: () => false
      })
    ).rejects.toMatchObject({ name: "RemoteSyncCancelledError" });
    expect(await store.listLocalExpenses()).toEqual([]);
    expect((await store.getRemoteSyncMetadata()).cursor).toBeNull();
  });
});
