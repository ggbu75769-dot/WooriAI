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

  it("stamps the candidate's childId on the entry, and omits the field when there is none", () => {
    const scoped = addNotifications([], [], [candidate({ childId: "child-1" })], NOW);
    expect(scoped.entries[0]!.childId).toBe("child-1");
    expect(addNotifications([], [], [candidate()], NOW).entries[0]).not.toHaveProperty("childId");
  });

  describe("R19-D legacyDedupeKeys (dedupeKey rename migration)", () => {
    // The budget generators' keys gained a childId segment. Without the legacy check, every user
    // who already saw this month's budget alert under the old key would get it a second time.
    const renamed = () =>
      candidate({ dedupeKey: "budget_80:child-1:2026-08", legacyDedupeKeys: ["budget_80:2026-08"], childId: "child-1" });

    it("drops a renamed candidate whose OLD key is already in the dedupe memory, and records the NEW key in its place", () => {
      const old = addNotifications([], [], [candidate()], NOW); // pre-update app version
      const afterUpdate = addNotifications(old.entries, old.seenDedupeKeys, [renamed()], NOW + 1000);
      // 목록은 그대로(같은 참조) -- 억제는 알림을 추가하지 않는다.
      expect(afterUpdate.entries).toBe(old.entries);
      // FIX-119B/F4: 새 키가 dedupe 메모리에 함께 남는다(아래 자립성 테스트 참고).
      expect(afterUpdate.seenDedupeKeys).toEqual(["budget_80:2026-08", "budget_80:child-1:2026-08"]);
      // 멱등: 다음 평가에서는 새 키만으로 억제되고, 목록은 여전히 그대로다.
      const later = addNotifications(afterUpdate.entries, afterUpdate.seenDedupeKeys, [renamed()], NOW + 2000);
      expect(later.entries).toHaveLength(1);
      expect(later.entries).toBe(afterUpdate.entries);
      expect(later.seenDedupeKeys).toBe(afterUpdate.seenDedupeKeys);
    });

    /**
     * FIX-119B/F4 (R19 M-4): 억제가 legacy 키의 수명에 매달려 있으면 안 된다. seen은 200개
     * 캡으로 오래된 키부터 잊히므로, 알림이 많은 사용자에게서 legacy 키가 밀려나는 순간
     * "이미 본 알림"이 새 키로 다시 발화했다.
     */
    it("legacy 키가 seen 캡에서 밀려나도 억제가 유지된다 (억제의 자립성)", () => {
      const seenAfterSuppression = addNotifications([], ["budget_80:2026-08"], [renamed()], NOW).seenDedupeKeys;

      expect(seenAfterSuppression).toEqual(["budget_80:2026-08", "budget_80:child-1:2026-08"]);

      // 정확히 legacy 키 하나만 캡 밖으로 밀려날 만큼(가장 오래된 키가 먼저 잊힌다) 쌓는다.
      let entries: AppNotification[] = [];
      let seen = seenAfterSuppression;
      for (let index = 0; index < NOTIFICATION_MAX_SEEN_KEYS - 1; index += 1) {
        const result = addNotifications(entries, seen, [candidate({ dedupeKey: `purchase_pending:${index}` })], NOW + index);
        entries = result.entries;
        seen = result.seenDedupeKeys;
      }
      expect(seen).not.toContain("budget_80:2026-08"); // legacy 키는 잊혔다
      expect(seen).toContain("budget_80:child-1:2026-08"); // 새 키는 남아 있다

      // 같은 달의 같은 알림이 다시 평가돼도 재발화하지 않는다.
      const reEvaluated = addNotifications(entries, seen, [renamed()], NOW + 999);
      expect(reEvaluated.entries).toBe(entries);
    });

    it("still fires for a user who has NOT seen the old key (fresh install, or a sibling child)", () => {
      const fresh = addNotifications([], [], [renamed()], NOW);
      expect(fresh.entries).toHaveLength(1);
      expect(fresh.entries[0]!.dedupeKey).toBe("budget_80:child-1:2026-08");
      // A second child's alert is a different new key and a different legacy key set is irrelevant
      // -- the sibling is no longer suppressed (that was the R19-D bug).
      const sibling = addNotifications(
        fresh.entries,
        fresh.seenDedupeKeys,
        [candidate({ dedupeKey: "budget_80:child-2:2026-08", childId: "child-2" })],
        NOW + 1000
      );
      expect(sibling.entries).toHaveLength(2);
    });
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

  it("keeps persisted NOTI-103 weekly_summary entries through sanitization (VALID_TYPES knows the type)", () => {
    const migrate = useNotificationStore.persist.getOptions().migrate!;
    const weekly: AppNotification = {
      id: "notif:weekly_summary:child-1:2026-W34",
      type: "weekly_summary",
      title: "이번 달 지금까지 300,000원 · 예산의 30%예요",
      body: "『다온이』 지출 내역을 확인해보세요.",
      createdAt: NOW,
      dedupeKey: "weekly_summary:child-1:2026-W34"
    };
    const migrated = migrate(
      { entries: [weekly], seenDedupeKeys: ["weekly_summary:child-1:2026-W34"], lastSeenStageByChild: {} },
      1
    );
    expect(migrated).toEqual({
      entries: [weekly],
      seenDedupeKeys: ["weekly_summary:child-1:2026-W34"],
      lastSeenStageByChild: {}
    });
  });
});
