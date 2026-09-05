import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Re-imports draft-storage and its persist-storage dependency together after a vi.resetModules()
 * call, so both references come from the same fresh module graph (mirrors the pattern used in
 * src/stores/secure-session-storage.test.ts to avoid a stale persist-storage instance with its
 * own, unrelated in-memory map).
 */
async function loadModules() {
  const [{ persistStorage }, draftStorage] = await Promise.all([
    import("../stores/persist-storage"),
    import("./draft-storage")
  ]);
  return { persistStorage, ...draftStorage };
}

describe("quick expense draft storage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("round-trips a written draft through read", async () => {
    const { writeQuickExpenseDraft, readQuickExpenseDraft } = await loadModules();

    const draft = {
      itemName: "기저귀",
      amountText: "12000",
      memo: "대용량",
      categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
      spentOnIso: "2026-07-10",
      isGift: false
    };

    await writeQuickExpenseDraft(draft);
    const result = await readQuickExpenseDraft();

    expect(result).toEqual(draft);
  });

  it("returns null after clearing the draft", async () => {
    const { writeQuickExpenseDraft, clearQuickExpenseDraft, readQuickExpenseDraft } = await loadModules();

    await writeQuickExpenseDraft({
      itemName: "분유",
      amountText: "35000",
      memo: "",
      categoryId: "c0a7e901-0000-4c02-8c02-c47e900ec002",
      spentOnIso: "2026-07-11",
      isGift: true
    });
    await clearQuickExpenseDraft();

    expect(await readQuickExpenseDraft()).toBeNull();
  });

  it("serializes clearing after an already-started write so the draft cannot resurrect", async () => {
    const { persistStorage, writeQuickExpenseDraft, clearQuickExpenseDraft, readQuickExpenseDraft } = await loadModules();
    const originalSetItem = persistStorage.setItem.bind(persistStorage);
    let releaseWrite!: () => void;
    let markWriteStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => { markWriteStarted = resolve; });
    const writeGate = new Promise<void>((resolve) => { releaseWrite = resolve; });
    vi.spyOn(persistStorage, "setItem").mockImplementationOnce(async (name, value) => {
      markWriteStarted();
      await writeGate;
      await originalSetItem(name, value);
    });

    const staleWrite = writeQuickExpenseDraft({
      itemName: "분유",
      amountText: "1234",
      memo: "",
      categoryId: "c0a7e901-0000-4c02-8c02-c47e900ec002",
      spentOnIso: "2026-08-03",
      isGift: false
    });
    await writeStarted;
    const clear = clearQuickExpenseDraft();
    releaseWrite();
    await Promise.all([staleWrite, clear]);

    expect(await readQuickExpenseDraft()).toBeNull();
  });

  it("returns null when no draft has ever been written", async () => {
    const { readQuickExpenseDraft } = await loadModules();

    expect(await readQuickExpenseDraft()).toBeNull();
  });
});
