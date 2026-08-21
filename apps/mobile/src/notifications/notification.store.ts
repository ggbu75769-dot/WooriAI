import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "../stores/persist-storage";

/**
 * NOTI-102 인앱 알림 센터: no push infra -- notifications are computed client-side from data the
 * app already has (home budget/stage + purchase-followup clicks, see generators.ts) and stored
 * here. The home-header bell (src/notifications/NotificationBell.tsx) shows the unread count and
 * app/notifications.tsx lists the entries.
 *
 * Pure client feature (same contract as src/commerce/purchase-followup.store.ts): nothing talks
 * to the server, so it works identically for a real session and the demo/test session. All
 * decision logic lives in the exported pure functions below (unit-tested in
 * notification.store.test.ts); the store actions are thin wrappers.
 */

/** The closed list of types the generators actually produce (NOTI-102 + NOTI-103's
 * weekly_summary). This is what candidate-producing code should be typed against. */
export type KnownAppNotificationType =
  | "budget_80"
  | "budget_100"
  | "stage_transition"
  | "purchase_pending"
  | "weekly_summary";

/**
 * NOTI-103 compatibility note: `AppNotification["type"]` is deliberately the NOTI-102 literals
 * plus a `(string & {})` escape hatch rather than the closed KnownAppNotificationType union.
 * app/notifications.tsx (NOTI-102 code, out of scope for NOTI-103) types its icon map as an
 * exhaustive `Record<AppNotification["type"], string>`; adding "weekly_summary" as a literal
 * member here would force a same-commit edit of that screen. The widened union keeps the screen
 * compiling unchanged, and it already renders unknown types safely at runtime (ListRow's `icon`
 * prop is optional, and openNotification falls back to /(tabs)/items). Runtime validity of
 * persisted entries is still enforced against the closed VALID_TYPES list in sanitizedEntries.
 * Once app/notifications.tsx learns weekly_summary, this can be re-closed to
 * KnownAppNotificationType.
 */
export type AppNotificationType =
  | "budget_80"
  | "budget_100"
  | "stage_transition"
  | "purchase_pending"
  | (string & {});

export type AppNotification = {
  id: string;
  type: AppNotificationType;
  title: string;
  body: string;
  /** Date.now() when the notification was ingested -- passed in by the caller so the pure
   * logic stays clock-free. */
  createdAt: number;
  /** Set once the user has seen the notification center (undefined = unread). */
  readAt?: number;
  /** Stable identity from generators.ts -- the same dedupeKey is never added twice, even after
   * the entry itself was cleared or aged out of the cap. */
  dedupeKey: string;
  /**
   * R19-D: which child the notification is about, when the generator knows (every generator
   * except none today -- budget/stage/purchase/weekly all stamp it). OPTIONAL on purpose, so no
   * persisted-store migration is needed: entries written by an older app version simply have no
   * childId, and every reader must treat it as "unknown child". R20-C is the first reader:
   * app/notifications.tsx resolves it to a 태명 prefix when the household has 2+ children (rules in
   * src/notifications/notification-child-label.ts), which is why "unknown child" must stay a
   * silent no-prefix case rather than a placeholder. sanitizedEntries below keeps a
   * string value and drops a malformed one, so an old blob can never inject a non-string here.
   */
  childId?: string;
};

/** A generator's output: everything except the ingestion bookkeeping (id/createdAt/readAt).
 * Typed against the closed union so a typo'd type in a generator is a compile error. */
export type AppNotificationCandidate = {
  type: KnownAppNotificationType;
  title: string;
  body: string;
  dedupeKey: string;
  childId?: string;
  /**
   * R19-D migration shim: dedupeKeys an EARLIER app version used for this very notification.
   * The budget generators' keys gained a childId segment (`budget_80:{yearMonth}` ->
   * `budget_80:{childId}:{yearMonth}`), so without this a user who already saw this month's
   * budget alert would get it once more the first time the updated app evaluates. If any legacy
   * key is already in the dedupe memory the candidate is dropped (and the new key is NOT
   * recorded -- the check stays idempotent on every later evaluation). Safe to delete once a
   * month has rolled over past the release, since the keys are month-scoped anyway.
   */
  legacyDedupeKeys?: string[];
};

/** Only the most recent N notifications are kept (oldest dropped first). */
export const NOTIFICATION_MAX_ENTRIES = 50;
/** Dedupe memory outlives the visible list so cleared/aged-out notifications never re-fire.
 * Capped so the persisted blob stays bounded; oldest keys are forgotten first, which is safe
 * because generators key on month / stage / click identity that has long since passed by then. */
export const NOTIFICATION_MAX_SEEN_KEYS = 200;

export type NotificationIngestResult = {
  entries: AppNotification[];
  seenDedupeKeys: string[];
};

/**
 * Adds candidates the store has never seen (by dedupeKey) as unread entries, newest first, and
 * records their dedupeKeys. Entries beyond NOTIFICATION_MAX_ENTRIES are dropped oldest-first;
 * seen keys beyond NOTIFICATION_MAX_SEEN_KEYS are forgotten oldest-first.
 */
export function addNotifications(
  entries: AppNotification[],
  seenDedupeKeys: string[],
  candidates: AppNotificationCandidate[],
  now: number
): NotificationIngestResult {
  const seen = new Set(seenDedupeKeys);
  const added: AppNotification[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.dedupeKey)) continue;
    // R19-D: a key this notification used in an earlier app version counts as "already seen",
    // so a dedupeKey rename never re-fires a notification the user has had.
    if (candidate.legacyDedupeKeys?.some((legacyKey) => seen.has(legacyKey))) continue;
    seen.add(candidate.dedupeKey);
    added.push({
      id: `notif:${candidate.dedupeKey}`,
      type: candidate.type,
      title: candidate.title,
      body: candidate.body,
      createdAt: now,
      dedupeKey: candidate.dedupeKey,
      ...(candidate.childId ? { childId: candidate.childId } : {})
    });
  }
  if (added.length === 0) return { entries, seenDedupeKeys };
  return {
    entries: [...added, ...entries].slice(0, NOTIFICATION_MAX_ENTRIES),
    seenDedupeKeys: [...seenDedupeKeys, ...added.map((entry) => entry.dedupeKey)].slice(-NOTIFICATION_MAX_SEEN_KEYS)
  };
}

export function selectUnreadCount(entries: AppNotification[]): number {
  return entries.reduce((count, entry) => (entry.readAt === undefined ? count + 1 : count), 0);
}

/** Marks every unread entry read. Returns the SAME array when nothing was unread so store
 * subscribers (e.g. the focus-effect in app/notifications.tsx) don't loop on no-op updates. */
export function markAllNotificationsRead(entries: AppNotification[], now: number): AppNotification[] {
  if (selectUnreadCount(entries) === 0) return entries;
  return entries.map((entry) => (entry.readAt === undefined ? { ...entry, readAt: now } : entry));
}

export function markNotificationRead(entries: AppNotification[], id: string, now: number): AppNotification[] {
  if (!entries.some((entry) => entry.id === id && entry.readAt === undefined)) return entries;
  return entries.map((entry) => (entry.id === id && entry.readAt === undefined ? { ...entry, readAt: now } : entry));
}

export type NotificationState = {
  entries: AppNotification[];
  seenDedupeKeys: string[];
  /** stage_transition meta: the stage label this device last saw per child id, so a label change
   * (e.g. 24개월 → 36개월) can be detected on the next home load. */
  lastSeenStageByChild: Record<string, string>;
  ingest: (candidates: AppNotificationCandidate[], now?: number) => void;
  markAllRead: (now?: number) => void;
  markRead: (id: string, now?: number) => void;
  /** "모두 지우기": empties the visible list but keeps seenDedupeKeys so cleared notifications
   * are not immediately re-generated on the next evaluation. */
  clearAll: () => void;
  recordSeenStage: (childId: string, stageLabel: string) => void;
  /** Session teardown convention (see purchase-followup.store.ts resetAll): drops every persisted
   * entry and the per-child stage meta so the next account on this device starts clean. */
  resetAll: () => void;
};

const VALID_TYPES: readonly KnownAppNotificationType[] = [
  "budget_80",
  "budget_100",
  "stage_transition",
  "purchase_pending",
  "weekly_summary"
];

/** Defensive shape check for a persisted blob from an unknown/older app version (mirrors the
 * convention in src/commerce/purchase-followup.store.ts): anything that doesn't look like a
 * valid entry list falls back to defaults instead of feeding malformed values into the UI. */
function sanitizedEntries(value: unknown): AppNotification[] {
  const list = value && typeof value === "object" ? (value as { entries?: unknown }).entries : undefined;
  if (!Array.isArray(list)) return [];
  const entries: AppNotification[] = [];
  for (const candidate of list) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Record<string, unknown>;
    if (
      typeof entry.id === "string" &&
      entry.id.length > 0 &&
      typeof entry.type === "string" &&
      (VALID_TYPES as readonly string[]).includes(entry.type) &&
      typeof entry.title === "string" &&
      typeof entry.body === "string" &&
      typeof entry.createdAt === "number" &&
      Number.isFinite(entry.createdAt) &&
      (entry.readAt === undefined || (typeof entry.readAt === "number" && Number.isFinite(entry.readAt))) &&
      typeof entry.dedupeKey === "string" &&
      entry.dedupeKey.length > 0 &&
      // R19-D: childId is optional (older blobs have none) but must be a non-empty string when
      // present -- an entry with a malformed childId is dropped like any other malformed entry.
      (entry.childId === undefined || (typeof entry.childId === "string" && entry.childId.length > 0))
    ) {
      entries.push(candidate as AppNotification);
    }
  }
  return entries.slice(0, NOTIFICATION_MAX_ENTRIES);
}

function sanitizedSeenKeys(value: unknown): string[] {
  const list = value && typeof value === "object" ? (value as { seenDedupeKeys?: unknown }).seenDedupeKeys : undefined;
  if (!Array.isArray(list)) return [];
  return list.filter((key): key is string => typeof key === "string" && key.length > 0).slice(-NOTIFICATION_MAX_SEEN_KEYS);
}

function sanitizedStageMeta(value: unknown): Record<string, string> {
  const record =
    value && typeof value === "object" ? (value as { lastSeenStageByChild?: unknown }).lastSeenStageByChild : undefined;
  if (!record || typeof record !== "object" || Array.isArray(record)) return {};
  const meta: Record<string, string> = {};
  for (const [childId, stageLabel] of Object.entries(record as Record<string, unknown>)) {
    if (childId.length > 0 && typeof stageLabel === "string" && stageLabel.length > 0) meta[childId] = stageLabel;
  }
  return meta;
}

function sanitizedState(persisted: unknown) {
  return {
    entries: sanitizedEntries(persisted),
    seenDedupeKeys: sanitizedSeenKeys(persisted),
    lastSeenStageByChild: sanitizedStageMeta(persisted)
  };
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      entries: [],
      seenDedupeKeys: [],
      lastSeenStageByChild: {},
      ingest: (candidates, now = Date.now()) =>
        set((state) => addNotifications(state.entries, state.seenDedupeKeys, candidates, now)),
      markAllRead: (now = Date.now()) => set((state) => ({ entries: markAllNotificationsRead(state.entries, now) })),
      markRead: (id, now = Date.now()) => set((state) => ({ entries: markNotificationRead(state.entries, id, now) })),
      clearAll: () => set({ entries: [] }),
      recordSeenStage: (childId, stageLabel) =>
        set((state) =>
          state.lastSeenStageByChild[childId] === stageLabel
            ? state
            : { lastSeenStageByChild: { ...state.lastSeenStageByChild, [childId]: stageLabel } }
        ),
      resetAll: () => set({ entries: [], seenDedupeKeys: [], lastSeenStageByChild: {} })
    }),
    {
      name: "wooriai-notifications",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      migrate: (persisted) => sanitizedState(persisted),
      merge: (persisted, current) => ({ ...current, ...sanitizedState(persisted) })
    }
  )
);
