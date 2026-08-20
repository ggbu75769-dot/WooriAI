import { beforeEach, describe, expect, it } from "vitest";
import {
  addNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATION_MAX_ENTRIES,
  NOTIFICATION_MAX_SEEN_KEYS,
  selectUnreadCount,
  useNotificationStore,
  type AppNotification,
  type AppNotificationCandidate
} from "./notification.store";

const NOW = 1_700_000_000_000;

function candidate(overrides: Partial<AppNotificationCandidate> = {}): AppNotificationCandidate {
  return {
    type: "budget_80",
    title: "이번 달 예산의 80%를 사용했어요",
    body: "남은 예산을 확인해보세요.",
    dedupeKey: "budget_80:2026-08",
    ...overrides
  };
}

describe("NOTI-102 notification ingestion (pure helpers)", () => {
  it("adds a candidate as an unread entry with a deterministic id", () => {
    const result = addNotifications([], [], [candidate()], NOW);
    expect(result.entries).toEqual([
      {
        id: "notif:budget_80:2026-08",
        type: "budget_80",
        title: "이번 달 예산의 80%를 사용했어요",
        body: "남은 예산을 확인해보세요.",
        createdAt: NOW,
        dedupeKey: "budget_80:2026-08"
      }
    ]);
    expect(result.seenDedupeKeys).toEqual(["budget_80:2026-08"]);
    expect(selectUnreadCount(result.entries)).toBe(1);
  });

  it("never adds the same dedupeKey twice -- within a batch or across batches", () => {
    const first = addNotifications([], [], [candidate(), candidate()], NOW);
    expect(first.entries).toHaveLength(1);
    const second = addNotifications(first.entries, first.seenDedupeKeys, [candidate()], NOW + 1000);
    expect(second.entries).toBe(first.entries); // untouched: no-op returns same references
    expect(second.seenDedupeKeys).toBe(first.seenDedupeKeys);
  });

  it("remembers dedupeKeys even after the entries were cleared (모두 지우기 must not re-fire)", () => {
    const first = addNotifications([], [], [candidate()], NOW);
    const afterClear = addNotifications([], first.seenDedupeKeys, [candidate()], NOW + 1000);
    expect(afterClear.entries).toHaveLength(0);
  });

  it("keeps newest first and caps at 50 entries, dropping the oldest", () => {
    let entries: AppNotification[] = [];
    let seen: string[] = [];
    for (let index = 0; index < NOTIFICATION_MAX_ENTRIES + 3; index += 1) {
      const result = addNotifications(entries, seen, [candidate({ dedupeKey: `budget_80:key-${index}` })], NOW + index);
      entries = result.entries;
      seen = result.seenDedupeKeys;
    }
    expect(entries).toHaveLength(NOTIFICATION_MAX_ENTRIES);
    expect(entries[0]!.dedupeKey).toBe(`budget_80:key-${NOTIFICATION_MAX_ENTRIES + 2}`);
    const keys = entries.map((entry) => entry.dedupeKey);
    expect(keys).not.toContain("budget_80:key-0");
    // Dedupe memory outlives the cap: an aged-out notification still never re-fires.
    expect(seen).toContain("budget_80:key-0");
    const reAdd = addNotifications(entries, seen, [candidate({ dedupeKey: "budget_80:key-0" })], NOW + 999);
    expect(reAdd.entries).toBe(entries);
  });

  it("caps the dedupe memory itself, forgetting the oldest keys first", () => {
    let entries: AppNotification[] = [];
    let seen: string[] = [];
    for (let index = 0; index < NOTIFICATION_MAX_SEEN_KEYS + 5; index += 1) {
      const result = addNotifications(entries, seen, [candidate({ dedupeKey: `budget_80:key-${index}` })], NOW + index);
      entries = result.entries;
      seen = result.seenDedupeKeys;
    }
    expect(seen).toHaveLength(NOTIFICATION_MAX_SEEN_KEYS);
    expect(seen[0]).toBe("budget_80:key-5");
    expect(seen[seen.length - 1]).toBe(`budget_80:key-${NOTIFICATION_MAX_SEEN_KEYS + 4}`);
  });
});

describe("NOTI-102 read marks and unread count", () => {
  it("counts only entries without readAt", () => {
    const { entries } = addNotifications(
      [],
      [],
      [candidate({ dedupeKey: "a" }), candidate({ dedupeKey: "b" })],
      NOW
    );
    expect(selectUnreadCount(entries)).toBe(2);
    const read = markNotificationRead(entries, "notif:a", NOW + 10);
    expect(selectUnreadCount(read)).toBe(1);
    expect(read.find((entry) => entry.id === "notif:a")?.readAt).toBe(NOW + 10);
  });

  it("marks everything read at once and no-ops (same reference) when nothing is unread", () => {
    const { entries } = addNotifications(
      [],
      [],
      [candidate({ dedupeKey: "a" }), candidate({ dedupeKey: "b" })],
      NOW
    );
    const allRead = markAllNotificationsRead(entries, NOW + 5);
    expect(selectUnreadCount(allRead)).toBe(0);
    expect(allRead.every((entry) => entry.readAt === NOW + 5)).toBe(true);
    // No-op guard so app/notifications.tsx's focus effect can call this every focus safely.
    expect(markAllNotificationsRead(allRead, NOW + 99)).toBe(allRead);
    expect(markNotificationRead(allRead, "notif:a", NOW + 99)).toBe(allRead);
    expect(markNotificationRead(allRead, "notif:missing", NOW + 99)).toBe(allRead);
  });

  it("never re-stamps an already-read entry's readAt", () => {
    const { entries } = addNotifications([], [], [candidate({ dedupeKey: "a" })], NOW);
    const once = markNotificationRead(entries, "notif:a", NOW + 10);
    const twice = markNotificationRead(once, "notif:a", NOW + 999);
    expect(twice).toBe(once);
    expect(twice[0]!.readAt).toBe(NOW + 10);
  });
});

describe("NOTI-102 persisted store wiring", () => {
  beforeEach(() => {
    useNotificationStore.getState().resetAll();
  });

  it("ingests, marks read, clears, and records stage meta through the store actions", () => {
    const store = useNotificationStore.getState();
    store.ingest([candidate({ dedupeKey: "a" }), candidate({ dedupeKey: "b" })], NOW);
    expect(useNotificationStore.getState().entries).toHaveLength(2);
    expect(selectUnreadCount(useNotificationStore.getState().entries)).toBe(2);

    useNotificationStore.getState().markRead("notif:a", NOW + 1);
    expect(selectUnreadCount(useNotificationStore.getState().entries)).toBe(1);

    useNotificationStore.getState().markAllRead(NOW + 2);
    expect(selectUnreadCount(useNotificationStore.getState().entries)).toBe(0);

    useNotificationStore.getState().recordSeenStage("child-1", "24개월");
    expect(useNotificationStore.getState().lastSeenStageByChild).toEqual({ "child-1": "24개월" });

    useNotificationStore.getState().clearAll();
    expect(useNotificationStore.getState().entries).toEqual([]);
    // clearAll keeps dedupe memory: cleared notifications never re-fire on the next evaluation.
    useNotificationStore.getState().ingest([candidate({ dedupeKey: "a" })], NOW + 3);
    expect(useNotificationStore.getState().entries).toEqual([]);
  });

  it("resetAll drops entries, dedupe memory, and stage meta (session teardown semantics)", () => {
    const store = useNotificationStore.getState();
    store.ingest([candidate({ dedupeKey: "a" })], NOW);
    store.recordSeenStage("child-1", "24개월");
    useNotificationStore.getState().resetAll();
    expect(useNotificationStore.getState().entries).toEqual([]);
    expect(useNotificationStore.getState().seenDedupeKeys).toEqual([]);
    expect(useNotificationStore.getState().lastSeenStageByChild).toEqual({});
    // After reset the same dedupeKey may fire again (fresh account, fresh state).
    useNotificationStore.getState().ingest([candidate({ dedupeKey: "a" })], NOW + 1);
    expect(useNotificationStore.getState().entries).toHaveLength(1);
  });

  it("defensively migrates malformed persisted blobs back to a clean state", () => {
    const migrate = useNotificationStore.persist.getOptions().migrate!;
    expect(migrate(undefined, 0)).toEqual({ entries: [], seenDedupeKeys: [], lastSeenStageByChild: {} });
    expect(migrate({ entries: "corrupt", seenDedupeKeys: 42, lastSeenStageByChild: [] }, 0)).toEqual({
      entries: [],
      seenDedupeKeys: [],
      lastSeenStageByChild: {}
    });
    const valid: AppNotification = {
      id: "notif:budget_80:2026-08",
      type: "budget_80",
      title: "t",
      body: "b",
      createdAt: NOW,
      dedupeKey: "budget_80:2026-08"
    };
    const migrated = migrate(
      {
        entries: [valid, { id: "", type: "budget_80" }, { ...valid, type: "hacked" }, null],
        seenDedupeKeys: ["budget_80:2026-08", 7, ""],
        lastSeenStageByChild: { "child-1": "24개월", "child-2": 3, "": "x" }
      },
      0
    );
    expect(migrated).toEqual({
      entries: [valid],
      seenDedupeKeys: ["budget_80:2026-08"],
      lastSeenStageByChild: { "child-1": "24개월" }
    });
  });
});
