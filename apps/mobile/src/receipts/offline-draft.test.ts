import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadModules() {
  const [{ persistStorage }, receiptStorage] = await Promise.all([
    import("../stores/persist-storage"),
    import("./offline-draft")
  ]);
  return { persistStorage, ...receiptStorage };
}

function input(scopeKey: string) {
  return {
    scopeKey,
    localId: "local-receipt-1",
    childId: "child-1",
    assetUri: "file:///receipt.png",
    fileName: "receipt.png",
    mimeType: "image/png" as const,
    fileSizeBytes: 2048,
    contentHash: "a".repeat(64),
    confirmationIdempotencyKey: "confirm-once-1",
    form: { itemName: "기저귀", amount: "12000", spentOn: "2026-07-17", merchant: "우리상점", categoryId: "category-1" },
    updatedAt: "2026-07-17T01:00:00.000Z"
  };
}

describe("scoped receipt offline draft", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.resetModules());

  it("round-trips only inside the same user-household scope", async () => {
    const storage = await loadModules();
    const draft = storage.createReceiptOfflineDraft(input("v1:user-a:house-a"));
    await storage.writeReceiptOfflineDraft(draft, "write");

    expect(await storage.readReceiptOfflineDraft("v1:user-a:house-a", "read-a")).toEqual(draft);
    expect(await storage.readReceiptOfflineDraft("v1:user-b:house-a", "read-b")).toBeNull();
  });

  it("keeps one confirmation idempotency key across 30 response-loss retries", async () => {
    const storage = await loadModules();
    const local = storage.createReceiptOfflineDraft(input("v1:user-a:house-a"));
    const uploaded = storage.updateReceiptOfflineDraft(local, {
      uploadState: "review_ready",
      serverDraft: { id: "server-draft-1", version: 1 }
    });
    await storage.writeReceiptOfflineDraft(uploaded, "write");
    const restored = await storage.readReceiptOfflineDraft(uploaded.scopeKey, "read");

    const attempts = Array.from({ length: 30 }, () => storage.toReceiptConfirmationInput(restored!));
    expect(new Set(attempts.map((attempt) => attempt.idempotencyKey))).toEqual(new Set(["confirm-once-1"]));
    expect(attempts.every((attempt) => attempt.expectedVersion === 1 && attempt.amountKrw === 12000)).toBe(true);
  });

  it("purges only the logged-out scope", async () => {
    const storage = await loadModules();
    await storage.writeReceiptOfflineDraft(storage.createReceiptOfflineDraft(input("v1:user-a:house-a")), "write-a");
    await storage.writeReceiptOfflineDraft(storage.createReceiptOfflineDraft({ ...input("v1:user-b:house-b"), localId: "local-receipt-2" }), "write-b");

    await storage.clearReceiptOfflineDraft("v1:user-a:house-a", "clear");
    expect(await storage.readReceiptOfflineDraft("v1:user-a:house-a", "read-a")).toBeNull();
    expect(await storage.readReceiptOfflineDraft("v1:user-b:house-b", "read-b")).not.toBeNull();
  });

  it("retains only the newly active scope during an account transition", async () => {
    const storage = await loadModules();
    await storage.writeReceiptOfflineDraft(storage.createReceiptOfflineDraft(input("v1:user-a:house-a")), "write-a");
    await storage.writeReceiptOfflineDraft(storage.createReceiptOfflineDraft({ ...input("v1:user-b:house-b"), localId: "local-receipt-2" }), "write-b");

    await storage.clearReceiptOfflineDraftsExceptScope("v1:user-b:house-b", "retain-b");
    expect(await storage.readReceiptOfflineDraft("v1:user-a:house-a", "read-a")).toBeNull();
    expect(await storage.readReceiptOfflineDraft("v1:user-b:house-b", "read-b")).not.toBeNull();
  });

  it("serializes logout cleanup after an already-started draft write so the draft cannot resurrect", async () => {
    const storage = await loadModules();
    await storage.clearAllReceiptOfflineDrafts();
    const draft = storage.createReceiptOfflineDraft(input("v1:user-a:house-a"));
    const originalSetItem = storage.persistStorage.setItem.bind(storage.persistStorage);
    let releaseWrite!: () => void;
    let markWriteStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    const writeBarrier = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let delayed = false;
    vi.spyOn(storage.persistStorage, "setItem").mockImplementation(async (key, value) => {
      if (key === storage.RECEIPT_DRAFT_STORAGE_KEY && !delayed) {
        delayed = true;
        markWriteStarted();
        await writeBarrier;
      }
      await originalSetItem(key, value);
    });

    const staleWrite = storage.writeReceiptOfflineDraft(draft, "stale-write");
    await writeStarted;
    const logoutCleanup = storage.clearAllReceiptOfflineDrafts();
    releaseWrite();
    await Promise.all([staleWrite, logoutCleanup]);

    expect(await storage.readReceiptOfflineDraft(draft.scopeKey, "after-logout")).toBeNull();
  });

  it("quarantines a corrupt payload instead of restoring it", async () => {
    const storage = await loadModules();
    await storage.persistStorage.setItem(storage.RECEIPT_DRAFT_STORAGE_KEY, "{not-json");

    expect(await storage.readReceiptOfflineDraft("v1:user-a:house-a", "corrupt-1")).toBeNull();
    expect(await storage.persistStorage.getItem(storage.RECEIPT_DRAFT_STORAGE_KEY)).toBeNull();
    expect(await storage.persistStorage.getItem(`${storage.RECEIPT_DRAFT_STORAGE_KEY}:quarantine:corrupt-1`)).toBe("{not-json");
  });
});
