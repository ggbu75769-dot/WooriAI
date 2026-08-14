import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "../stores/persist-storage";

/**
 * COM-108 구매 확인 루프: today the commerce loop dies at "link click" -- we open the affiliate
 * link and never hear back. This store remembers each outbound product-link click as a
 * "pending purchase check" so the app can ask 『…』 구매하셨나요? on the next foreground return /
 * cold start (see PurchaseFollowupPrompt.tsx) and funnel a "샀어요" answer straight into the
 * existing quick-expense sheet (source: "followup").
 *
 * Pure client feature: nothing here talks to the server, so it works identically for a real
 * session and the demo/test session. All decision logic lives in the exported pure functions
 * below (unit-tested in purchase-followup.store.test.ts); the store actions are thin wrappers.
 */

export type PurchaseFollowupStatus = "pending" | "done" | "dismissed" | "expired";

export type PurchaseFollowupEntry = {
  itemTemplateId: string;
  itemName: string;
  childId: string;
  priceBandText?: string;
  /** Date.now() at click time -- passed in by the caller so the pure logic stays clock-free. */
  clickedAt: number;
  status: PurchaseFollowupStatus;
  /** How many times the user answered "아직이요" to a prompt for this entry. */
  promptCount: number;
};

export type PurchaseFollowupClick = {
  itemTemplateId: string;
  itemName: string;
  childId: string;
  priceBandText?: string;
  clickedAt: number;
};

/** Only the most recent N clicks are remembered (oldest dropped first). */
export const PURCHASE_FOLLOWUP_MAX_ENTRIES = 5;
/** A click younger than this is probably still mid-purchase -- don't nag. */
export const PURCHASE_FOLLOWUP_MIN_AGE_MS = 3 * 60 * 1000;
/** A click older than this is stale -- silently stop asking. */
export const PURCHASE_FOLLOWUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** "아직이요" allows one re-prompt on a later app-return; after the 2nd prompt the entry expires. */
export const PURCHASE_FOLLOWUP_MAX_PROMPTS = 2;

/**
 * Records a click: keeps only the most recent click per itemTemplateId (a re-click replaces the
 * old entry entirely, resetting status/promptCount) and caps the whole list at
 * PURCHASE_FOLLOWUP_MAX_ENTRIES, dropping the oldest clicks first.
 */
export function applyPurchaseLinkClick(
  entries: PurchaseFollowupEntry[],
  click: PurchaseFollowupClick
): PurchaseFollowupEntry[] {
  const next = entries.filter((entry) => entry.itemTemplateId !== click.itemTemplateId);
  next.push({ ...click, status: "pending", promptCount: 0 });
  next.sort((a, b) => a.clickedAt - b.clickedAt);
  return next.slice(-PURCHASE_FOLLOWUP_MAX_ENTRIES);
}

/** An entry may be shown as a prompt: still pending, inside the 3min–24h window, under the
 * prompt budget. (The once-per-app-session gate lives in PurchaseFollowupPrompt.tsx -- it's
 * runtime state, not persisted.) */
export function isPromptEligible(entry: PurchaseFollowupEntry, now: number): boolean {
  if (entry.status !== "pending") return false;
  if (entry.promptCount >= PURCHASE_FOLLOWUP_MAX_PROMPTS) return false;
  const age = now - entry.clickedAt;
  return age >= PURCHASE_FOLLOWUP_MIN_AGE_MS && age <= PURCHASE_FOLLOWUP_MAX_AGE_MS;
}

/** The single entry to prompt for right now (most recent eligible click), or null. */
export function selectPromptEligibleFollowup(
  entries: PurchaseFollowupEntry[],
  now: number
): PurchaseFollowupEntry | null {
  let best: PurchaseFollowupEntry | null = null;
  for (const entry of entries) {
    if (!isPromptEligible(entry, now)) continue;
    if (!best || entry.clickedAt >= best.clickedAt) best = entry;
  }
  return best;
}

/** "아직이요": counts the prompt that was just answered; the 2nd one auto-expires the entry so
 * we never nag more than PURCHASE_FOLLOWUP_MAX_PROMPTS times per click. */
export function applySnooze(entries: PurchaseFollowupEntry[], itemTemplateId: string): PurchaseFollowupEntry[] {
  return entries.map((entry) => {
    if (entry.itemTemplateId !== itemTemplateId || entry.status !== "pending") return entry;
    const promptCount = entry.promptCount + 1;
    return {
      ...entry,
      promptCount,
      status: promptCount >= PURCHASE_FOLLOWUP_MAX_PROMPTS ? "expired" : "pending"
    };
  });
}

export function applyStatus(
  entries: PurchaseFollowupEntry[],
  itemTemplateId: string,
  status: "done" | "dismissed"
): PurchaseFollowupEntry[] {
  return entries.map((entry) => (entry.itemTemplateId === itemTemplateId ? { ...entry, status } : entry));
}

export type PurchaseFollowupState = {
  entries: PurchaseFollowupEntry[];
  recordLinkClick: (click: PurchaseFollowupClick) => void;
  /** "아직이요" */
  snoozeFollowup: (itemTemplateId: string) => void;
  /** "샀어요" */
  completeFollowup: (itemTemplateId: string) => void;
  /** "괜찮아요" */
  dismissFollowup: (itemTemplateId: string) => void;
};

const VALID_STATUSES: readonly PurchaseFollowupStatus[] = ["pending", "done", "dismissed", "expired"];

/** Defensive shape check for a persisted blob from an unknown/older app version (mirrors the
 * convention in src/stores/*.store.ts): anything that doesn't look like a valid entry list falls
 * back to [] instead of feeding malformed values into the prompt logic. */
function sanitizedEntries(value: unknown): PurchaseFollowupEntry[] {
  const list = value && typeof value === "object" ? (value as { entries?: unknown }).entries : undefined;
  if (!Array.isArray(list)) return [];
  const entries: PurchaseFollowupEntry[] = [];
  for (const candidate of list) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Record<string, unknown>;
    if (
      typeof entry.itemTemplateId === "string" &&
      entry.itemTemplateId.length > 0 &&
      typeof entry.itemName === "string" &&
      typeof entry.childId === "string" &&
      (entry.priceBandText === undefined || typeof entry.priceBandText === "string") &&
      typeof entry.clickedAt === "number" &&
      Number.isFinite(entry.clickedAt) &&
      typeof entry.status === "string" &&
      (VALID_STATUSES as readonly string[]).includes(entry.status) &&
      typeof entry.promptCount === "number" &&
      Number.isFinite(entry.promptCount)
    ) {
      entries.push(candidate as PurchaseFollowupEntry);
    }
  }
  return entries.slice(-PURCHASE_FOLLOWUP_MAX_ENTRIES);
}

export const usePurchaseFollowupStore = create<PurchaseFollowupState>()(
  persist(
    (set) => ({
      entries: [],
      recordLinkClick: (click) => set((state) => ({ entries: applyPurchaseLinkClick(state.entries, click) })),
      snoozeFollowup: (itemTemplateId) => set((state) => ({ entries: applySnooze(state.entries, itemTemplateId) })),
      completeFollowup: (itemTemplateId) =>
        set((state) => ({ entries: applyStatus(state.entries, itemTemplateId, "done") })),
      dismissFollowup: (itemTemplateId) =>
        set((state) => ({ entries: applyStatus(state.entries, itemTemplateId, "dismissed") }))
    }),
    {
      name: "wooriai-purchase-followup",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      migrate: (persisted) => ({ entries: sanitizedEntries(persisted) }),
      merge: (persisted, current) => ({ ...current, entries: sanitizedEntries(persisted) })
    }
  )
);
