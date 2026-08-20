import { beforeEach, describe, expect, it } from "vitest";
import {
  applyPurchaseLinkClick,
  applySnooze,
  applyStatus,
  isPromptEligible,
  PURCHASE_FOLLOWUP_MAX_AGE_MS,
  PURCHASE_FOLLOWUP_MAX_ENTRIES,
  PURCHASE_FOLLOWUP_MAX_PROMPTS,
  PURCHASE_FOLLOWUP_MIN_AGE_MS,
  selectPromptEligibleFollowup,
  usePurchaseFollowupStore,
  type PurchaseFollowupClick,
  type PurchaseFollowupEntry
} from "./purchase-followup.store";

const NOW = 1_700_000_000_000;

function click(overrides: Partial<PurchaseFollowupClick> = {}): PurchaseFollowupClick {
  return {
    itemTemplateId: "item-diaper",
    itemName: "네이처러브 기저귀 팬티형",
    childId: "child-1",
    priceBandText: "42,900원 ~ 48,900원",
    clickedAt: NOW,
    ...overrides
  };
}

function pendingEntry(overrides: Partial<PurchaseFollowupEntry> = {}): PurchaseFollowupEntry {
  return { ...click(), status: "pending", promptCount: 0, ...overrides };
}

describe("COM-108 purchase-followup click recording", () => {
  it("records a click as a pending entry with a zeroed prompt budget", () => {
    const entries = applyPurchaseLinkClick([], click());
    expect(entries).toEqual([
      {
        itemTemplateId: "item-diaper",
        itemName: "네이처러브 기저귀 팬티형",
        childId: "child-1",
        priceBandText: "42,900원 ~ 48,900원",
        clickedAt: NOW,
        status: "pending",
        promptCount: 0
      }
    ]);
  });

  it("keeps only the most recent click per itemTemplateId, resetting status and prompt budget", () => {
    const stale = pendingEntry({ clickedAt: NOW - 1000, status: "expired", promptCount: 2 });
    const entries = applyPurchaseLinkClick([stale], click({ clickedAt: NOW }));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ clickedAt: NOW, status: "pending", promptCount: 0 });
  });

  it("caps the list, dropping the oldest clicks first", () => {
    let entries: PurchaseFollowupEntry[] = [];
    for (let index = 0; index < PURCHASE_FOLLOWUP_MAX_ENTRIES + 2; index += 1) {
      entries = applyPurchaseLinkClick(entries, click({ itemTemplateId: `item-${index}`, clickedAt: NOW + index }));
    }
    expect(entries).toHaveLength(PURCHASE_FOLLOWUP_MAX_ENTRIES);
    const ids = entries.map((entry) => entry.itemTemplateId);
    expect(ids).not.toContain("item-0");
    expect(ids).not.toContain("item-1");
    expect(ids).toContain(`item-${PURCHASE_FOLLOWUP_MAX_ENTRIES + 1}`);
  });
});

describe("COM-108 prompt eligibility window (3min–24h)", () => {
  it("is not eligible before 3 minutes have passed (user is probably still mid-purchase)", () => {
    const entry = pendingEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MIN_AGE_MS + 1 });
    expect(isPromptEligible(entry, NOW)).toBe(false);
  });

  it("is eligible from exactly 3 minutes up to exactly 24 hours", () => {
    expect(isPromptEligible(pendingEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MIN_AGE_MS }), NOW)).toBe(true);
    expect(isPromptEligible(pendingEntry({ clickedAt: NOW - 60 * 60 * 1000 }), NOW)).toBe(true);
    expect(isPromptEligible(pendingEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MAX_AGE_MS }), NOW)).toBe(true);
  });

  it("silently expires past 24 hours", () => {
    const entry = pendingEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MAX_AGE_MS - 1 });
    expect(isPromptEligible(entry, NOW)).toBe(false);
  });

  it("selects the most recent eligible entry when several are in the window", () => {
    const older = pendingEntry({ itemTemplateId: "item-a", clickedAt: NOW - 2 * 60 * 60 * 1000 });
    const newer = pendingEntry({ itemTemplateId: "item-b", clickedAt: NOW - 10 * 60 * 1000 });
    const tooFresh = pendingEntry({ itemTemplateId: "item-c", clickedAt: NOW - 1000 });
    expect(selectPromptEligibleFollowup([older, newer, tooFresh], NOW)?.itemTemplateId).toBe("item-b");
  });

  it("returns null when nothing is eligible", () => {
    expect(selectPromptEligibleFollowup([], NOW)).toBeNull();
    expect(selectPromptEligibleFollowup([pendingEntry({ clickedAt: NOW })], NOW)).toBeNull();
  });
});

describe("COM-108 snooze (아직이요) -- max 2 prompts total, then auto-expire", () => {
  it("keeps the entry pending after the first snooze so one re-prompt is allowed", () => {
    const eligibleAt = NOW - 10 * 60 * 1000;
    const once = applySnooze([pendingEntry({ clickedAt: eligibleAt })], "item-diaper");
    expect(once[0]).toMatchObject({ status: "pending", promptCount: 1 });
    expect(isPromptEligible(once[0]!, NOW)).toBe(true);
  });

  it("auto-expires on the 2nd snooze (2 prompts total), never prompting again", () => {
    const eligibleAt = NOW - 10 * 60 * 1000;
    let entries = applySnooze([pendingEntry({ clickedAt: eligibleAt })], "item-diaper");
    entries = applySnooze(entries, "item-diaper");
    expect(entries[0]).toMatchObject({ status: "expired", promptCount: PURCHASE_FOLLOWUP_MAX_PROMPTS });
    expect(selectPromptEligibleFollowup(entries, NOW)).toBeNull();
  });

  it("only touches the targeted pending entry", () => {
    const other = pendingEntry({ itemTemplateId: "item-other" });
    const done = pendingEntry({ itemTemplateId: "item-done", status: "done" });
    const entries = applySnooze([other, done], "item-done");
    expect(entries).toEqual([other, done]);
  });
});

describe("COM-108 done (샀어요) and dismiss (괜찮아요)", () => {
  it("marks the entry done so it never prompts again", () => {
    const eligibleAt = NOW - 10 * 60 * 1000;
    const entries = applyStatus([pendingEntry({ clickedAt: eligibleAt })], "item-diaper", "done");
    expect(entries[0]!.status).toBe("done");
    expect(selectPromptEligibleFollowup(entries, NOW)).toBeNull();
  });

  it("dismisses the entry permanently", () => {
    const eligibleAt = NOW - 10 * 60 * 1000;
    const entries = applyStatus([pendingEntry({ clickedAt: eligibleAt })], "item-diaper", "dismissed");
    expect(entries[0]!.status).toBe("dismissed");
    expect(selectPromptEligibleFollowup(entries, NOW)).toBeNull();
  });
});

describe("COM-108 persisted store wiring", () => {
  beforeEach(() => {
    usePurchaseFollowupStore.setState({ entries: [] });
  });

  it("records, snoozes, completes, and dismisses through the store actions", () => {
    const store = usePurchaseFollowupStore.getState();
    store.recordLinkClick(click({ itemTemplateId: "item-a" }));
    store.recordLinkClick(click({ itemTemplateId: "item-b", clickedAt: NOW + 1 }));
    expect(usePurchaseFollowupStore.getState().entries).toHaveLength(2);

    usePurchaseFollowupStore.getState().snoozeFollowup("item-a");
    expect(usePurchaseFollowupStore.getState().entries.find((entry) => entry.itemTemplateId === "item-a")).toMatchObject(
      { status: "pending", promptCount: 1 }
    );

    usePurchaseFollowupStore.getState().completeFollowup("item-a");
    expect(usePurchaseFollowupStore.getState().entries.find((entry) => entry.itemTemplateId === "item-a")?.status).toBe(
      "done"
    );

    usePurchaseFollowupStore.getState().dismissFollowup("item-b");
    expect(usePurchaseFollowupStore.getState().entries.find((entry) => entry.itemTemplateId === "item-b")?.status).toBe(
      "dismissed"
    );
  });

  it("re-clicking a done item re-arms a fresh pending entry", () => {
    const store = usePurchaseFollowupStore.getState();
    store.recordLinkClick(click());
    usePurchaseFollowupStore.getState().completeFollowup("item-diaper");
    usePurchaseFollowupStore.getState().recordLinkClick(click({ clickedAt: NOW + 5000 }));
    expect(usePurchaseFollowupStore.getState().entries).toEqual([
      expect.objectContaining({ itemTemplateId: "item-diaper", clickedAt: NOW + 5000, status: "pending", promptCount: 0 })
    ]);
  });
});
