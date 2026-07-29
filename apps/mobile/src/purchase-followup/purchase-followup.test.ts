import { describe, expect, it, vi } from "vitest";
import type { StateStorage } from "zustand/middleware";
import { isSafePurchaseUrl, openPurchaseOffer } from "./link-orchestrator";
import {
  beginPurchaseFollowup,
  canManagePurchaseFollowup,
  loadPurchaseFollowup,
  loadVisiblePurchaseFollowup,
  markPurchaseFollowupOpened,
  markPurchaseFollowupRecorded,
  reconcilePurchaseFollowups,
  removePurchaseFollowupForLocalExpense,
  snoozePurchaseFollowup
} from "./store";

function memoryStorage(): StateStorage & { dump: () => string[] } {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    dump: () => [...values.values()]
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const input = {
  scopeKey: "scope-1",
  childId: "child-1",
  itemDefinitionId: "item-1",
  offerId: "offer-1"
};

describe("purchase follow-up state machine", () => {
  it("allows child-context owners and co-parents while excluding mother context and read-only roles", () => {
    expect(canManagePurchaseFollowup({ childContext: true, isTestSession: false, role: "owner" })).toBe(true);
    expect(canManagePurchaseFollowup({ childContext: true, isTestSession: false, role: "co_parent" })).toBe(true);
    expect(canManagePurchaseFollowup({ childContext: true, isTestSession: false, role: "viewer" })).toBe(false);
    expect(canManagePurchaseFollowup({ childContext: true, isTestSession: false, role: "gift_participant" })).toBe(false);
    expect(canManagePurchaseFollowup({ childContext: false, isTestSession: false, role: "owner" })).toBe(false);
    expect(canManagePurchaseFollowup({ childContext: true, isTestSession: true, role: null })).toBe(true);
  });

  it("persists only opaque identifiers and promotes opening after the OS accepts the HTTPS link", async () => {
    const storage = memoryStorage();
    const openURL = vi.fn(async () => undefined);
    const result = await openPurchaseOffer(
      { ...input, publicUrl: "https://seller.example/product?affiliate=secret" },
      {
        storage,
        now: () => Date.parse("2026-07-24T00:00:00.000Z"),
        canOpenURL: async () => true,
        openURL
      }
    );

    expect(result.state).toBe("pending");
    expect(openURL).toHaveBeenCalledOnce();
    const persisted = storage.dump().join("");
    expect(persisted).not.toContain("seller.example");
    expect(persisted).not.toContain("affiliate");
    expect(persisted).not.toContain("secret");
  });

  it("single-flights a rapid double tap for the same scope, child, and item", async () => {
    const storage = memoryStorage();
    const opened = deferred<void>();
    const openURL = vi.fn(() => opened.promise);
    const dependencies = {
      storage,
      canOpenURL: async () => true,
      openURL
    };
    const first = openPurchaseOffer(
      { ...input, publicUrl: "https://seller.example/product" },
      dependencies
    );
    const second = openPurchaseOffer(
      { ...input, offerId: "offer-2", publicUrl: "https://seller.example/product-2" },
      dependencies
    );
    expect(second).toBe(first);
    opened.resolve();
    await expect(first).resolves.toMatchObject({ state: "pending", offerId: "offer-1" });
    expect(openURL).toHaveBeenCalledOnce();
  });

  it("rejects unsafe or credential-bearing URLs before persisting an intent", async () => {
    const storage = memoryStorage();
    for (const url of [
      "http://seller.example/product",
      "https://user:password@seller.example/product",
      "javascript:alert(1)",
      "not-a-url"
    ]) {
      await expect(
        openPurchaseOffer(
          { ...input, publicUrl: url },
          { storage, canOpenURL: async () => true, openURL: async () => undefined }
        )
      ).rejects.toThrow("PURCHASE_URL_UNSAFE");
    }
    expect(storage.dump()).toEqual([]);
    expect(isSafePurchaseUrl("https://seller.example/product")).toBe(true);
  });

  it("uses openURL as the final authority when canOpenURL reports a false negative", async () => {
    const storage = memoryStorage();
    const openURL = vi.fn(async () => undefined);
    const followup = await openPurchaseOffer(
      { ...input, publicUrl: "https://seller.example/product" },
      { storage, canOpenURL: async () => false, openURL }
    );
    expect(openURL).toHaveBeenCalledOnce();
    expect(followup.state).toBe("pending");
    expect(storage.dump()).toHaveLength(1);
  });

  it("recovers fail-closed from corrupt persisted JSON", async () => {
    const storage = memoryStorage();
    await storage.setItem("wooriai-purchase-followups-v1", "{not-json");
    expect(await loadVisiblePurchaseFollowup(input.scopeKey, input.childId, { storage })).toBeNull();
    expect(storage.dump()).toEqual([]);
  });

  it("removes opening intents when openURL fails and expires unresolved opening intents", async () => {
    const storage = memoryStorage();
    await expect(
      openPurchaseOffer(
        { ...input, publicUrl: "https://seller.example/product" },
        {
          storage,
          canOpenURL: async () => false,
          openURL: async () => {
            throw new Error("OS rejected");
          }
        }
      )
    ).rejects.toThrow("OS rejected");
    expect(await loadVisiblePurchaseFollowup(input.scopeKey, input.childId, { storage })).toBeNull();

    await beginPurchaseFollowup(input, { storage, nowMs: 1_000 });
    expect(
      await loadVisiblePurchaseFollowup(input.scopeKey, input.childId, {
        storage,
        nowMs: 31_001
      })
    ).toBeNull();
  });

  it("deduplicates per scope+child+item and enforces snooze and seven-day expiry", async () => {
    const storage = memoryStorage();
    const first = await beginPurchaseFollowup(input, { storage, nowMs: 1_000 });
    await markPurchaseFollowupOpened(first.intentId, { storage, nowMs: 2_000 });
    const second = await beginPurchaseFollowup({ ...input, offerId: "offer-2" }, { storage, nowMs: 3_000 });
    await markPurchaseFollowupOpened(second.intentId, { storage, nowMs: 4_000 });
    expect((await loadVisiblePurchaseFollowup(input.scopeKey, input.childId, { storage, nowMs: 4_000 }))?.offerId).toBe("offer-2");

    await snoozePurchaseFollowup(second.intentId, { storage, nowMs: 5_000 });
    expect(await loadVisiblePurchaseFollowup(input.scopeKey, input.childId, { storage, nowMs: 5_001 })).toBeNull();
    expect((await loadVisiblePurchaseFollowup(input.scopeKey, input.childId, { storage, nowMs: 86_405_001 }))?.state).toBe("pending");
    expect(await loadVisiblePurchaseFollowup(input.scopeKey, input.childId, { storage, nowMs: 604_803_001 })).toBeNull();
  });

  it("keeps recorded follow-up visible through failure, conflict, and a stale unrelated snapshot until sync or explicit discard", async () => {
    const storage = memoryStorage();
    const opening = await beginPurchaseFollowup(input, { storage, nowMs: 1_000 });
    await markPurchaseFollowupOpened(opening.intentId, { storage, nowMs: 2_000 });
    await markPurchaseFollowupRecorded(
      {
        intentId: opening.intentId,
        scopeKey: input.scopeKey,
        childId: input.childId,
        itemDefinitionId: input.itemDefinitionId,
        localExpenseId: "local-1"
      },
      { storage, nowMs: 3_000 }
    );

    await reconcilePurchaseFollowups(input.scopeKey, [{ localId: "local-1", syncState: "failed" }], storage);
    expect((await loadVisiblePurchaseFollowup(input.scopeKey, input.childId, { storage }))?.state).toBe("recorded_pending_sync");
    await reconcilePurchaseFollowups(input.scopeKey, [{ localId: "local-1", syncState: "conflict" }], storage);
    expect(await loadVisiblePurchaseFollowup(input.scopeKey, input.childId, { storage })).not.toBeNull();
    await reconcilePurchaseFollowups(input.scopeKey, [{ localId: "other", syncState: "synced" }], storage);
    expect(await loadVisiblePurchaseFollowup(input.scopeKey, input.childId, { storage })).not.toBeNull();
    await removePurchaseFollowupForLocalExpense(input.scopeKey, "local-1", storage);
    expect(await loadVisiblePurchaseFollowup(input.scopeKey, input.childId, { storage })).toBeNull();
  });

  it("returns no Home card without an unhandled rejection when storage reads fail", async () => {
    const storage: StateStorage = {
      getItem: () => {
        throw new Error("storage read unavailable");
      },
      setItem: () => {
        throw new Error("storage write unavailable");
      },
      removeItem: () => {
        throw new Error("storage remove unavailable");
      }
    };
    await expect(
      loadVisiblePurchaseFollowup(input.scopeKey, input.childId, { storage })
    ).resolves.toBeNull();
  });

  it("protects a recorded expense from same-item replacement and the actionable-record cap", async () => {
    const storage = memoryStorage();
    const opening = await beginPurchaseFollowup(input, { storage, nowMs: 1_000 });
    await markPurchaseFollowupOpened(opening.intentId, { storage, nowMs: 2_000 });
    await markPurchaseFollowupRecorded(
      {
        intentId: opening.intentId,
        scopeKey: input.scopeKey,
        childId: input.childId,
        itemDefinitionId: input.itemDefinitionId,
        localExpenseId: "local-protected"
      },
      { storage, nowMs: 3_000 }
    );

    const openURL = vi.fn(async () => undefined);
    await expect(
      openPurchaseOffer(
        { ...input, publicUrl: "https://seller.example/product" },
        {
          storage,
          now: () => 3_500,
          canOpenURL: async () => true,
          openURL
        }
      )
    ).resolves.toMatchObject({
      intentId: opening.intentId,
      state: "recorded_pending_sync",
      localExpenseId: "local-protected"
    });
    expect(openURL).toHaveBeenCalledOnce();
    await expect(
      beginPurchaseFollowup({ ...input, offerId: "offer-new" }, { storage, nowMs: 4_000 })
    ).rejects.toThrow("PURCHASE_EXPENSE_PENDING_SYNC");
    for (let index = 0; index < 7; index += 1) {
      const next = await beginPurchaseFollowup(
        { ...input, itemDefinitionId: `other-${index}`, offerId: `offer-${index}` },
        { storage, nowMs: 5_000 + index }
      );
      await markPurchaseFollowupOpened(next.intentId, { storage, nowMs: 6_000 + index });
    }
    expect(storage.dump().join("")).toContain("local-protected");
    await removePurchaseFollowupForLocalExpense(input.scopeKey, "local-protected", storage);
    expect(storage.dump().join("")).not.toContain("local-protected");
  });

  it("requires the exact scope, child, item and intent when recording", async () => {
    const storage = memoryStorage();
    const opening = await beginPurchaseFollowup(input, { storage, nowMs: 1_000 });
    await markPurchaseFollowupOpened(opening.intentId, { storage, nowMs: 2_000 });
    expect(
      await loadPurchaseFollowup(
        { intentId: opening.intentId, scopeKey: "other-scope", childId: input.childId },
        { storage, nowMs: 2_000 }
      )
    ).toBeNull();
    expect(
      await markPurchaseFollowupRecorded(
        {
          intentId: opening.intentId,
          scopeKey: input.scopeKey,
          childId: input.childId,
          itemDefinitionId: "wrong-item",
          localExpenseId: "local-wrong"
        },
        { storage, nowMs: 3_000 }
      )
    ).toBeNull();
    expect(
      (
        await loadVisiblePurchaseFollowup(input.scopeKey, input.childId, {
          storage,
          nowMs: 3_000
        })
      )?.state
    ).toBe("pending");

    await markPurchaseFollowupRecorded(
      {
        intentId: opening.intentId,
        scopeKey: input.scopeKey,
        childId: input.childId,
        itemDefinitionId: input.itemDefinitionId,
        localExpenseId: "local-1"
      },
      { storage, nowMs: 4_000 }
    );
    await reconcilePurchaseFollowups(input.scopeKey, [{ localId: "local-1", syncState: "synced" }], storage);
    expect(await loadVisiblePurchaseFollowup(input.scopeKey, input.childId, { storage })).toBeNull();
  });
});
