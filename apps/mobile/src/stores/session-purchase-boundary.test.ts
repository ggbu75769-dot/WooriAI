import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeOfflineScopeKey } from "../offline/session-scope";
import {
  beginPurchaseFollowup,
  clearAllPurchaseFollowups,
  loadPurchaseFollowup
} from "../purchase-followup/store";
import {
  clearAllReceiptOfflineDrafts,
  createReceiptOfflineDraft,
  readReceiptOfflineDraft,
  writeReceiptOfflineDraft
} from "../receipts/offline-draft";
import { useSelectedChildStore } from "./selected-child.store";
import { useSessionStore } from "./session.store";

describe("session purchase-followup privacy boundary", () => {
  beforeEach(async () => {
    await clearAllPurchaseFollowups();
    await clearAllReceiptOfflineDrafts();
    useSelectedChildStore.setState({
      selectedChildId: null,
      selectedChildHouseholdId: null,
      selectedChildScopeKey: null,
      activeScopeKey: null
    });
    useSessionStore.setState({
      sessionGeneration: 10,
      accessToken: "access-a",
      refreshToken: "refresh-a",
      userId: "user-a",
      defaultHouseholdId: "household-a",
      isTestSession: false
    });
  });

  afterEach(async () => {
    useSessionStore.setState({
      accessToken: null,
      refreshToken: null,
      userId: null,
      defaultHouseholdId: null,
      isTestSession: false
    });
    await clearAllPurchaseFollowups();
    await clearAllReceiptOfflineDrafts();
  });

  it("clears the selected child's non-default household scope when another account replaces the session", async () => {
    useSelectedChildStore.getState().setSelectedChildId("child-b", "household-b");
    const oldScopeKey = makeOfflineScopeKey("user-a", "household-b");
    const followup = await beginPurchaseFollowup({
      scopeKey: oldScopeKey,
      childId: "child-b",
      itemDefinitionId: "item-1",
      offerId: "offer-1"
    });

    useSessionStore.getState().setSession({
      accessToken: "access-c",
      refreshToken: "refresh-c",
      userId: "user-c",
      defaultHouseholdId: "household-c"
    });

    await vi.waitFor(async () => {
      expect(
        await loadPurchaseFollowup({
          intentId: followup.intentId,
          scopeKey: oldScopeKey,
          childId: "child-b"
        })
      ).toBeNull();
    });
    expect(useSelectedChildStore.getState()).toMatchObject({
      selectedChildId: null,
      selectedChildHouseholdId: null
    });
  });

  it("does not let a stale logout cleanup erase a same-account scope that was immediately reactivated", async () => {
    useSelectedChildStore.getState().setSelectedChildId("child-a", "household-a");
    const scopeKey = makeOfflineScopeKey("user-a", "household-a");
    const followup = await beginPurchaseFollowup({
      scopeKey,
      childId: "child-a",
      itemDefinitionId: "item-1",
      offerId: "offer-1"
    });
    const historical = await beginPurchaseFollowup({
      scopeKey: makeOfflineScopeKey("user-a", "household-b"),
      childId: "child-b",
      itemDefinitionId: "item-b",
      offerId: "offer-b"
    });

    useSessionStore.getState().clearSession();
    useSessionStore.getState().setSession({
      accessToken: "access-a-new",
      refreshToken: "refresh-a-new",
      userId: "user-a",
      defaultHouseholdId: "household-a"
    });
    useSelectedChildStore.getState().setSelectedChildId("child-a", "household-a");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      await loadPurchaseFollowup({
        intentId: followup.intentId,
        scopeKey,
        childId: "child-a"
      })
    ).not.toBeNull();
    expect(
      await loadPurchaseFollowup({
        intentId: historical.intentId,
        scopeKey: historical.scopeKey,
        childId: historical.childId
      })
    ).toBeNull();
  });

  it("clears current and historical purchase scopes when logout remains current", async () => {
    const current = await beginPurchaseFollowup({
      scopeKey: makeOfflineScopeKey("user-a", "household-a"),
      childId: "child-a",
      itemDefinitionId: "item-a",
      offerId: "offer-a"
    });
    const historical = await beginPurchaseFollowup({
      scopeKey: makeOfflineScopeKey("older-user", "older-household"),
      childId: "older-child",
      itemDefinitionId: "older-item",
      offerId: "older-offer"
    });

    useSessionStore.getState().clearSession();

    await vi.waitFor(async () => {
      expect(
        await loadPurchaseFollowup({
          intentId: current.intentId,
          scopeKey: current.scopeKey,
          childId: current.childId
        })
      ).toBeNull();
      expect(
        await loadPurchaseFollowup({
          intentId: historical.intentId,
          scopeKey: historical.scopeKey,
          childId: historical.childId
        })
      ).toBeNull();
    });
  });

  it("clears selected-child and historical receipt drafts when logout remains current", async () => {
    useSelectedChildStore.getState().setSelectedChildId("child-b", "household-b");
    const selectedScope = makeOfflineScopeKey("user-a", "household-b");
    const defaultScope = makeOfflineScopeKey("user-a", "household-a");
    const baseDraft = {
      localId: "receipt-b",
      childId: "child-b",
      assetUri: "file:///receipt-b.png",
      fileName: "receipt-b.png",
      mimeType: "image/png" as const,
      fileSizeBytes: 1024,
      contentHash: "b".repeat(64),
      confirmationIdempotencyKey: "confirm-b",
      form: {
        itemName: "기저귀",
        amount: "10000",
        spentOn: "2026-07-24",
        merchant: "",
        categoryId: "category-1"
      },
      updatedAt: "2026-07-24T00:00:00.000Z"
    };
    await writeReceiptOfflineDraft(createReceiptOfflineDraft({ ...baseDraft, scopeKey: selectedScope }));
    await writeReceiptOfflineDraft(createReceiptOfflineDraft({
      ...baseDraft,
      scopeKey: defaultScope,
      localId: "receipt-a",
      childId: "child-a",
      contentHash: "a".repeat(64),
      confirmationIdempotencyKey: "confirm-a"
    }));

    useSessionStore.getState().clearSession();

    await vi.waitFor(async () => {
      expect(await readReceiptOfflineDraft(selectedScope)).toBeNull();
      expect(await readReceiptOfflineDraft(defaultScope)).toBeNull();
    });
  });
});
