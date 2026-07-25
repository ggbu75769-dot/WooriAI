import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReceiptDraft } from "../api/client";
import { makeOfflineScopeKey } from "../offline/session-scope";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { useSessionStore } from "../stores/session.store";
import {
  beginReceiptOperation,
  captureReceiptOperationOwner,
  receiptOperationOwnerIsActive
} from "./operation-owner";

describe("receipt operation ownership", () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessionGeneration: 20,
      accessToken: "access-a",
      refreshToken: "refresh-a",
      userId: "user-a",
      defaultHouseholdId: "household-a",
      isTestSession: false
    });
    useSelectedChildStore.setState({
      selectedChildId: "child-a",
      selectedChildHouseholdId: "household-a",
      selectedChildScopeKey: null,
      activeScopeKey: null
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useSessionStore.setState({
      sessionGeneration: 21,
      accessToken: null,
      refreshToken: null,
      userId: null,
      defaultHouseholdId: null,
      isTestSession: false
    });
    useSelectedChildStore.setState({
      selectedChildId: null,
      selectedChildHouseholdId: null,
      selectedChildScopeKey: null,
      activeScopeKey: null
    });
  });

  it("aborts a delayed operation immediately when the session generation changes", () => {
    const owner = captureReceiptOperationOwner(
      "access-a",
      makeOfflineScopeKey("user-a", "household-a"),
      "child-a"
    );
    expect(owner).not.toBeNull();
    const operation = beginReceiptOperation(owner!);

    useSessionStore.setState({ sessionGeneration: 21 });

    expect(operation.signal.aborted).toBe(true);
    expect(receiptOperationOwnerIsActive(owner!)).toBe(false);
    expect(operation.assertActive).toThrow("SYNC_OWNER_CHANGED");
    operation.release();
  });

  it("aborts a delayed operation when the selected child changes households", () => {
    const owner = captureReceiptOperationOwner(
      "access-a",
      makeOfflineScopeKey("user-a", "household-a"),
      "child-a"
    );
    const operation = beginReceiptOperation(owner!);

    useSelectedChildStore.getState().setSelectedChildId("child-b", "household-b");

    expect(operation.signal.aborted).toBe(true);
    expect(operation.assertActive).toThrow("SYNC_OWNER_CHANGED");
    operation.release();
  });

  it("keeps the same operation active across a normal 401 refresh and successful retry", async () => {
    const owner = captureReceiptOperationOwner(
      "access-a",
      makeOfflineScopeKey("user-a", "household-a"),
      "child-a"
    )!;
    const operation = beginReceiptOperation(owner);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (url.endsWith("/receipt-drafts") && authorization === "Bearer access-a") {
        return new Response(JSON.stringify({ message: "expired" }), { status: 401 });
      }
      if (url.endsWith("/auth/refresh")) {
        return new Response(JSON.stringify({
          accessToken: "access-a-refreshed",
          refreshToken: "refresh-a-refreshed"
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/receipt-drafts") && authorization === "Bearer access-a-refreshed") {
        return new Response(JSON.stringify({
          duplicate: false,
          draft: { id: "draft-1", version: 1 }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createReceiptDraft(owner.token, {
      childId: owner.childId,
      contentHash: "a".repeat(64),
      fileName: "receipt.png",
      mimeType: "image/png",
      fileSizeBytes: 1024
    }, operation.signal)).resolves.toMatchObject({
      draft: { id: "draft-1", version: 1 }
    });

    expect(operation.signal.aborted).toBe(false);
    expect(receiptOperationOwnerIsActive(owner)).toBe(true);
    expect(operation.assertActive).not.toThrow();
    expect(useSessionStore.getState()).toMatchObject({
      sessionGeneration: owner.sessionGeneration,
      accessToken: "access-a-refreshed",
      refreshToken: "refresh-a-refreshed"
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    operation.release();
  });
});
