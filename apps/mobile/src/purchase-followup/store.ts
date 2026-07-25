import type { StateStorage } from "zustand/middleware";
import type { LocalExpenseRow } from "../offline/types";
import { persistStorage } from "../stores/persist-storage";

const STORAGE_KEY = "wooriai-purchase-followups-v1";
const OPENING_TIMEOUT_MS = 30_000;
const PROMPT_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const SNOOZE_MS = 24 * 60 * 60 * 1_000;
const MAX_FOLLOWUPS_PER_SCOPE = 5;

export type PurchaseFollowupState =
  | "opening"
  | "pending"
  | "snoozed"
  | "recorded_pending_sync";

/**
 * Deliberately opaque local record. It never stores seller/product names,
 * prices, URLs, affiliate data, credentials, or child names.
 */
export type PurchaseFollowup = {
  intentId: string;
  scopeKey: string;
  childId: string;
  itemDefinitionId: string;
  offerId: string;
  state: PurchaseFollowupState;
  openedAt: string;
  updatedAt: string;
  snoozedUntil: string | null;
  localExpenseId: string | null;
};

export type PurchaseFollowupStorage = Pick<StateStorage, "getItem" | "setItem" | "removeItem">;

export function canManagePurchaseFollowup(input: {
  childContext: boolean;
  isTestSession: boolean;
  role: "owner" | "co_parent" | "viewer" | "gift_participant" | null | undefined;
}): boolean {
  return (
    input.childContext &&
    (input.isTestSession || input.role === "owner" || input.role === "co_parent")
  );
}

type BeginPurchaseFollowupInput = Pick<
  PurchaseFollowup,
  "scopeKey" | "childId" | "itemDefinitionId" | "offerId"
>;

const listeners = new Set<() => void>();
let mutationQueue: Promise<unknown> = Promise.resolve();

function notifyListeners() {
  for (const listener of listeners) listener();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isFollowup(value: unknown): value is PurchaseFollowup {
  if (!isRecord(value)) return false;
  return (
    typeof value.intentId === "string" &&
    typeof value.scopeKey === "string" &&
    typeof value.childId === "string" &&
    typeof value.itemDefinitionId === "string" &&
    typeof value.offerId === "string" &&
    ["opening", "pending", "snoozed", "recorded_pending_sync"].includes(String(value.state)) &&
    typeof value.openedAt === "string" &&
    Number.isFinite(Date.parse(value.openedAt)) &&
    typeof value.updatedAt === "string" &&
    Number.isFinite(Date.parse(value.updatedAt)) &&
    (value.snoozedUntil === null ||
      (typeof value.snoozedUntil === "string" && Number.isFinite(Date.parse(value.snoozedUntil)))) &&
    (value.localExpenseId === null || typeof value.localExpenseId === "string")
  );
}

async function readAll(storage: PurchaseFollowupStorage): Promise<PurchaseFollowup[]> {
  const raw = await storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("invalid purchase follow-up collection");
    return parsed.filter(isFollowup);
  } catch {
    await storage.removeItem(STORAGE_KEY);
    return [];
  }
}

async function writeAll(
  storage: PurchaseFollowupStorage,
  records: PurchaseFollowup[],
  notify = true
): Promise<void> {
  if (records.length === 0) {
    await storage.removeItem(STORAGE_KEY);
  } else {
    await storage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
  if (notify) notifyListeners();
}

function isExpired(record: PurchaseFollowup, nowMs: number): boolean {
  const openedAtMs = Date.parse(record.openedAt);
  if (record.state === "opening") return nowMs - openedAtMs > OPENING_TIMEOUT_MS;
  if (record.state === "recorded_pending_sync") return false;
  return nowMs - openedAtMs > PROMPT_TTL_MS;
}

function normalize(records: PurchaseFollowup[], nowMs: number): PurchaseFollowup[] {
  return records
    .filter((record) => !isExpired(record, nowMs))
    .map((record) =>
      record.state === "snoozed" &&
      record.snoozedUntil &&
      Date.parse(record.snoozedUntil) <= nowMs
        ? {
            ...record,
            state: "pending" as const,
            snoozedUntil: null,
            updatedAt: new Date(nowMs).toISOString()
          }
        : record
    );
}

function enqueueMutation<T>(
  storage: PurchaseFollowupStorage,
  work: (records: PurchaseFollowup[]) => {
    records: PurchaseFollowup[];
    result: T;
    notify?: boolean;
  },
  nowMs = Date.now()
): Promise<T> {
  const operation = mutationQueue.then(async () => {
    const current = normalize(await readAll(storage), nowMs);
    const { records, result, notify } = work(current);
    await writeAll(storage, records, notify);
    return result;
  });
  mutationQueue = operation.catch(() => undefined);
  return operation;
}

function newIntentId(nowMs: number): string {
  return `purchase-${nowMs.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function subscribePurchaseFollowups(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function beginPurchaseFollowup(
  input: BeginPurchaseFollowupInput,
  options: { nowMs?: number; storage?: PurchaseFollowupStorage } = {}
): Promise<PurchaseFollowup> {
  const nowMs = options.nowMs ?? Date.now();
  const storage = options.storage ?? persistStorage;
  return enqueueMutation(
    storage,
    (records) => {
      const recordedExpense = records.find(
        (record) =>
          record.scopeKey === input.scopeKey &&
          record.childId === input.childId &&
          record.itemDefinitionId === input.itemDefinitionId &&
          record.state === "recorded_pending_sync"
      );
      if (recordedExpense) {
        throw new Error("PURCHASE_EXPENSE_PENDING_SYNC");
      }
      const timestamp = new Date(nowMs).toISOString();
      const created: PurchaseFollowup = {
        ...input,
        intentId: newIntentId(nowMs),
        state: "opening",
        openedAt: timestamp,
        updatedAt: timestamp,
        snoozedUntil: null,
        localExpenseId: null
      };
      const withoutDuplicate = records.filter(
        (record) =>
          !(
            record.scopeKey === input.scopeKey &&
            record.childId === input.childId &&
            record.itemDefinitionId === input.itemDefinitionId &&
            record.state !== "recorded_pending_sync"
          )
      );
      const protectedRecorded = withoutDuplicate.filter(
        (record) => record.scopeKey === input.scopeKey && record.state === "recorded_pending_sync"
      );
      const actionable = [
        created,
        ...withoutDuplicate.filter(
          (record) => record.scopeKey === input.scopeKey && record.state !== "recorded_pending_sync"
        )
      ]
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        .slice(0, MAX_FOLLOWUPS_PER_SCOPE);
      const otherScopes = withoutDuplicate.filter((record) => record.scopeKey !== input.scopeKey);
      return { records: [...otherScopes, ...protectedRecorded, ...actionable], result: created };
    },
    nowMs
  );
}

export function markPurchaseFollowupOpened(
  intentId: string,
  options: { nowMs?: number; storage?: PurchaseFollowupStorage } = {}
): Promise<PurchaseFollowup | null> {
  const nowMs = options.nowMs ?? Date.now();
  const storage = options.storage ?? persistStorage;
  return enqueueMutation(
    storage,
    (records) => {
      let updated: PurchaseFollowup | null = null;
      const next = records.map((record) => {
        if (record.intentId !== intentId || record.state !== "opening") return record;
        updated = {
          ...record,
          state: "pending",
          updatedAt: new Date(nowMs).toISOString()
        };
        return updated;
      });
      return { records: next, result: updated };
    },
    nowMs
  );
}

export function removePurchaseFollowup(
  intentId: string,
  storage: PurchaseFollowupStorage = persistStorage
): Promise<void> {
  return enqueueMutation(storage, (records) => ({
    records: records.filter((record) => record.intentId !== intentId),
    result: undefined
  }));
}

export function snoozePurchaseFollowup(
  intentId: string,
  options: { nowMs?: number; storage?: PurchaseFollowupStorage } = {}
): Promise<PurchaseFollowup | null> {
  const nowMs = options.nowMs ?? Date.now();
  const storage = options.storage ?? persistStorage;
  return enqueueMutation(
    storage,
    (records) => {
      let updated: PurchaseFollowup | null = null;
      const next = records.map((record) => {
        if (record.intentId !== intentId || record.state !== "pending") return record;
        updated = {
          ...record,
          state: "snoozed",
          snoozedUntil: new Date(nowMs + SNOOZE_MS).toISOString(),
          updatedAt: new Date(nowMs).toISOString()
        };
        return updated;
      });
      return { records: next, result: updated };
    },
    nowMs
  );
}

export function markPurchaseFollowupRecorded(
  input: {
    intentId: string;
    scopeKey: string;
    childId: string;
    itemDefinitionId: string;
    localExpenseId: string;
  },
  options: { nowMs?: number; storage?: PurchaseFollowupStorage } = {}
): Promise<PurchaseFollowup | null> {
  const nowMs = options.nowMs ?? Date.now();
  const storage = options.storage ?? persistStorage;
  return enqueueMutation(
    storage,
    (records) => {
      let updated: PurchaseFollowup | null = null;
      const next = records.map((record) => {
        if (
          record.intentId !== input.intentId ||
          record.scopeKey !== input.scopeKey ||
          record.childId !== input.childId ||
          record.itemDefinitionId !== input.itemDefinitionId ||
          (record.state !== "pending" && record.state !== "snoozed")
        ) {
          return record;
        }
        updated = {
          ...record,
          state: "recorded_pending_sync",
          localExpenseId: input.localExpenseId,
          snoozedUntil: null,
          updatedAt: new Date(nowMs).toISOString()
        };
        return updated;
      });
      return { records: next, result: updated };
    },
    nowMs
  );
}

export async function loadPurchaseFollowup(
  input: { intentId: string; scopeKey: string; childId: string },
  options: { nowMs?: number; storage?: PurchaseFollowupStorage } = {}
): Promise<PurchaseFollowup | null> {
  const nowMs = options.nowMs ?? Date.now();
  const storage = options.storage ?? persistStorage;
  return enqueueMutation(
    storage,
    (records) => ({
      records,
      result:
        records.find(
          (record) =>
            record.intentId === input.intentId &&
            record.scopeKey === input.scopeKey &&
            record.childId === input.childId
        ) ?? null,
      notify: false
    }),
    nowMs
  );
}

export async function loadVisiblePurchaseFollowup(
  scopeKey: string,
  childId: string,
  options: { nowMs?: number; storage?: PurchaseFollowupStorage } = {}
): Promise<PurchaseFollowup | null> {
  const nowMs = options.nowMs ?? Date.now();
  const storage = options.storage ?? persistStorage;
  try {
    return await enqueueMutation(
      storage,
      (records) => {
        const visible = records
          .filter(
            (record) =>
              record.scopeKey === scopeKey &&
              record.childId === childId &&
              (record.state === "pending" || record.state === "recorded_pending_sync")
          )
          .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
        return { records, result: visible, notify: false };
      },
      nowMs
    );
  } catch {
    // Home must remain usable when device storage is temporarily unavailable.
    // A later subscription refresh retries; no purchase state is guessed.
    return null;
  }
}

export async function loadRecordedPurchaseFollowupForItem(
  input: { scopeKey: string; childId: string; itemDefinitionId: string },
  options: { nowMs?: number; storage?: PurchaseFollowupStorage } = {}
): Promise<PurchaseFollowup | null> {
  const nowMs = options.nowMs ?? Date.now();
  const storage = options.storage ?? persistStorage;
  return enqueueMutation(
    storage,
    (records) => ({
      records,
      result:
        records.find(
          (record) =>
            record.scopeKey === input.scopeKey &&
            record.childId === input.childId &&
            record.itemDefinitionId === input.itemDefinitionId &&
            record.state === "recorded_pending_sync"
        ) ?? null,
      notify: false
    }),
    nowMs
  );
}

export function reconcilePurchaseFollowups(
  scopeKey: string,
  rows: Pick<LocalExpenseRow, "localId" | "syncState">[],
  storage: PurchaseFollowupStorage = persistStorage
): Promise<void> {
  const syncStateByLocalId = new Map(rows.map((row) => [row.localId, row.syncState]));
  return enqueueMutation(storage, (records) => ({
    records: records.filter(
      (record) =>
        !(
          record.scopeKey === scopeKey &&
          record.state === "recorded_pending_sync" &&
          record.localExpenseId &&
          syncStateByLocalId.get(record.localExpenseId) === "synced"
        )
    ),
    result: undefined
  }));
}

export function removePurchaseFollowupForLocalExpense(
  scopeKey: string,
  localExpenseId: string,
  storage: PurchaseFollowupStorage = persistStorage
): Promise<void> {
  return enqueueMutation(storage, (records) => ({
    records: records.filter(
      (record) => !(record.scopeKey === scopeKey && record.localExpenseId === localExpenseId)
    ),
    result: undefined
  }));
}

export function clearPurchaseFollowupScope(
  scopeKey: string,
  storage: PurchaseFollowupStorage = persistStorage
): Promise<void> {
  return enqueueMutation(storage, (records) => ({
    records: records.filter((record) => record.scopeKey !== scopeKey),
    result: undefined
  }));
}

export function clearAllPurchaseFollowups(
  storage: PurchaseFollowupStorage = persistStorage
): Promise<void> {
  return enqueueMutation(storage, () => ({ records: [], result: undefined }));
}

export function clearPurchaseFollowupsExceptScope(
  scopeKey: string | null,
  storage: PurchaseFollowupStorage = persistStorage
): Promise<void> {
  return enqueueMutation(storage, (records) => ({
    records: scopeKey ? records.filter((record) => record.scopeKey === scopeKey) : [],
    result: undefined
  }));
}
