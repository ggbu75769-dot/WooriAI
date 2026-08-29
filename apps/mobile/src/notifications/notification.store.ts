import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "../stores/persist-storage";
import {
  filterMutedNotificationCandidates,
  useNotificationPreferencesStore
} from "./notification-preferences.store";

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
 * weekly_summary + GAP-054 #6's record_gap + GAP-066 #8's monthly_wrapup). This is what
 * candidate-producing code should be typed against. */
export type KnownAppNotificationType =
  | "budget_80"
  | "budget_100"
  | "stage_transition"
  | "purchase_pending"
  | "weekly_summary"
  | "record_gap"
  | "monthly_wrapup";

/**
 * `AppNotification["type"]`은 NOTI-102 리터럴 넷 + `(string & {})` 탈출구다. 닫힌
 * `KnownAppNotificationType`이 아닌 이유는 **저장본 호환** 때문이다: 이 타입은 기기에 남아 있는
 * 예전 앱 버전의 blob에도 붙으므로, 지금 앱이 모르는 종류가 들어 있어도 타입이 먼저 깨지지
 * 않아야 한다. 런타임 유효성은 아래 닫힌 `VALID_TYPES` 목록이 `sanitizedEntries`에서 진다.
 *
 * ⚠️ 라운드 54 P1-4로 **오래된 이유 하나가 사실이 아니게 됐다.** 예전 주석은 "app/
 * notifications.tsx의 아이콘 맵이 exhaustive Record라 리터럴을 늘리면 같은 커밋에서 그 화면을
 * 고쳐야 한다"고 적고 있었는데, 두 가지가 모두 틀렸다.
 *  1. 그 맵의 타입은 `Record<AppNotification["type"], …>`이고 이 유니온에 `(string & {})`가
 *     있으므로 결국 `Record<string, …>`이다 — 애초에 exhaustive가 아니고, 누락을 컴파일러가
 *     잡아 주지도 않았다. 실제로 `record_gap`은 아이콘 없이 몇 라운드를 지났다.
 *  2. 그 화면은 이제 `weekly_summary`와 `record_gap`을 **둘 다** 안다(아이콘 맵에 있다).
 *
 * 아이콘 누락은 타입이 아니라 아래 `VALID_TYPES`와 그 화면의 맵을 함께 읽는 테스트로 막는다
 * (src/notifications/record-gap.test.ts).
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
   * key is already in the dedupe memory the candidate is dropped AND the new key is recorded in
   * its place (FIX-119B/F4 -- see addNotifications below for why the recording matters). Safe to
   * delete once a month has rolled over past the release, since the keys are month-scoped anyway.
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
 *
 * FIX-119B/F4 (R19 M-4): legacy 키로 억제한 후보의 **새 키도 dedupe 메모리에 기록**한다. 예전에는
 * 기록하지 않아서 억제가 legacy 키의 수명에 매달려 있었다 -- seen은 NOTIFICATION_MAX_SEEN_KEYS
 * (200) 캡으로 오래된 키부터 잊히므로, 알림이 200개 넘게 쌓인 사용자에게서 legacy 키가 밀려나는
 * 순간 "이미 본 알림"이 새 키로 다시 발화했다. 새 키를 함께 기록해 두면 다음 평가부터는 위의
 * 첫 번째 검사(`seen.has(candidate.dedupeKey)`)가 단독으로 억제를 성립시키므로, legacy 키가
 * 사라져도 억제가 유지된다(억제는 여전히 멱등이다 -- 알림이 목록에 추가되지는 않는다).
 */
export function addNotifications(
  entries: AppNotification[],
  seenDedupeKeys: string[],
  // 라운드 52 C-08(b): `readonly`인 것은 muted 필터가 걸러 낸 목록이 그대로 들어오기 때문이다
  // (filterMutedNotificationCandidates는 아무것도 꺼지지 않았을 때 원본 배열을 그대로 돌려준다).
  candidates: readonly AppNotificationCandidate[],
  now: number
): NotificationIngestResult {
  const seen = new Set(seenDedupeKeys);
  const added: AppNotification[] = [];
  /** 발화 없이 dedupe 메모리에만 남길 키(legacy 키로 억제된 후보의 새 키) -- 위 F4 주석 참고. */
  const suppressedKeys: string[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.dedupeKey)) continue;
    // R19-D: a key this notification used in an earlier app version counts as "already seen",
    // so a dedupeKey rename never re-fires a notification the user has had.
    if (candidate.legacyDedupeKeys?.some((legacyKey) => seen.has(legacyKey))) {
      seen.add(candidate.dedupeKey);
      suppressedKeys.push(candidate.dedupeKey);
      continue;
    }
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
  if (added.length === 0 && suppressedKeys.length === 0) return { entries, seenDedupeKeys };
  return {
    // 억제만 있었던 경우 목록은 손대지 않는다(같은 참조를 돌려줘 구독자가 헛돌지 않게).
    entries: added.length === 0 ? entries : [...added, ...entries].slice(0, NOTIFICATION_MAX_ENTRIES),
    seenDedupeKeys: [...seenDedupeKeys, ...suppressedKeys, ...added.map((entry) => entry.dedupeKey)].slice(
      -NOTIFICATION_MAX_SEEN_KEYS
    )
  };
}

export function selectUnreadCount(entries: AppNotification[]): number {
  return entries.reduce((count, entry) => (entry.readAt === undefined ? count + 1 : count), 0);
}

/**
 * 라운드 39 UX-O: 알림함을 여는 **그 순간** 아직 안 읽은 항목들의 id.
 *
 * 알림함은 포커스와 동시에 전부 읽음 처리하므로(app/notifications.tsx의 markAllRead), 화면에
 * 그려지는 20줄은 방금 들어온 소식이든 지난주에 본 것이든 모양이 완전히 같았다 -- "새 소식"이
 * 어느 것인지 알 방법이 없다. 화면이 이 스냅샷을 마운트 시 한 번만 떠서, 그 목록에 든 행에만
 * 시각 구분과 스크린 리더 접두를 붙인다.
 *
 * dedupe·readAt 규칙은 건드리지 않는다: 이건 읽기 전용 selector이고, 읽음 처리는 지금까지처럼
 * markAllRead가 한다. 스냅샷이 화면 상태로만 살아 있으므로 다시 들어오면 자연히 사라진다.
 */
export function selectUnreadNotificationIds(entries: AppNotification[]): string[] {
  return entries.filter((entry) => entry.readAt === undefined).map((entry) => entry.id);
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

/**
 * 라운드 52 C-10 — 알림 한 줄 지우기.
 *
 * dedupe 규칙은 "모두 지우기"(clearAll)와 **똑같다**: 목록에서만 빼고 `seenDedupeKeys`는 그대로
 * 둔다. 지운 알림이 다음 평가에서 곧바로 되살아나면 지운 행위 자체가 무의미해지기 때문이다
 * (그래서 화면의 액션시트도 "지운 알림은 다시 볼 수 없어요"라고 미리 말한다).
 *
 * 없는 id면 **같은 배열**을 돌려준다 — markAllNotificationsRead와 같은 no-op 관례라 구독자가
 * 헛돌지 않는다.
 */
export function removeNotification(entries: AppNotification[], id: string): AppNotification[] {
  if (!entries.some((entry) => entry.id === id)) return entries;
  return entries.filter((entry) => entry.id !== id);
}

/**
 * 라운드 62 트랙 B(#5) — **삭제된 아이 한 명분**의 기기 잔재를 지운다.
 *
 * 왜 필요한가: 아이 프로필 삭제의 뒤처리는 지금 쿼리 캐시 무효화뿐이다(CHILD_REMOVAL_INVALIDATE_KEYS).
 * 기기에 persist된 이 목록은 그대로 남아, 사라진 아이의 알림 줄이 알림함에 계속 서 있다 -- 이름을
 * 해석할 수 없으니 태명 접두도 붙지 않아(notification-child-label.ts) 어느 아이 것인지조차 보이지
 * 않고, 그 줄을 누르면 지금 아이의 화면이 열린다.
 *
 * `resetAll`(PRIV-104 세션 teardown)과 **섞지 않는 별도 판정**이다: 그쪽은 정체성이 바뀔 때 전부
 * 지우는 계약이고, 이쪽은 같은 사람이 계속 로그인한 채 아이 하나만 지운 경우다. 두 규칙을 한
 * 함수에 넣으면 한쪽을 고칠 때 다른 쪽이 함께 움직인다.
 *
 * ## `seenDedupeKeys`는 **건드리지 않는다** (dedupe 정책 근거)
 *
 * 지울 수도 있었다(정찰 노트가 둘 다 정직하다고 적었다). 남기기를 고르는 이유는 둘이다.
 *  1. **키의 형식을 여기서 다시 알아야 한다.** dedupe 키는 이 스토어에게 불투명한 문자열이고,
 *     childId 조각이 어디에 있는지는 종류마다 다르다(`budget_80:{childId}:{yearMonth}`,
 *     `purchase_pending:{itemTemplateId}:{clickedAt}` — 뒤엣것에는 childId가 아예 없다).
 *     여기서 키를 파싱하면 generators.ts 말고 **두 번째** 키 형식 소스가 생기고, 형식이 바뀌는
 *     날 조용히 어긋난다.
 *  2. **남겨도 아무것도 억제하지 않는다.** 키는 childId(서버가 주는 고유 id)를 품고 있어 지운
 *     아이의 키가 다른 아이의 알림을 막을 수 없고, 삭제된 아이의 알림이 다시 평가될 일도 없다.
 *     남은 키는 200칸 상한(NOTIFICATION_MAX_SEEN_KEYS)에서 오래된 순으로 자연히 잊힌다.
 * 즉 "정확히 지울 수 없는 것은 건드리지 않는다"는 쪽을 택했다.
 *
 * `lastSeenStageByChild`는 **함께 지운다** — 그쪽은 childId가 키 자체라 파싱이 필요 없고, 사라진
 * 아이의 시기 라벨을 계속 들고 있을 이유가 없다.
 *
 * 바뀌는 것이 없으면 **같은 참조**를 돌려준다(markAllNotificationsRead와 같은 no-op 관례).
 */
export function clearNotificationsForChild(
  state: Pick<NotificationState, "entries" | "lastSeenStageByChild">,
  childId: string
): Pick<NotificationState, "entries" | "lastSeenStageByChild"> {
  // 빈 id로는 아무것도 지우지 않는다: childId 없는 옛 항목(어느 아이 것인지 모르는 줄)까지
  // 쓸어 버리는 사고를 원천 차단한다.
  const target = childId.trim();
  if (target.length === 0) return state;
  const entries = state.entries.some((entry) => entry.childId === target)
    ? state.entries.filter((entry) => entry.childId !== target)
    : state.entries;
  let lastSeenStageByChild = state.lastSeenStageByChild;
  if (Object.prototype.hasOwnProperty.call(lastSeenStageByChild, target)) {
    const { [target]: _removed, ...rest } = lastSeenStageByChild;
    lastSeenStageByChild = rest;
  }
  return { entries, lastSeenStageByChild };
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
  /** 라운드 52 C-10 "이 알림 지우기": 한 줄만 뺀다. dedupe 키 유지 규칙은 clearAll과 같다. */
  remove: (id: string) => void;
  /**
   * 라운드 62 트랙 B(#5): **아이 하나가 삭제됐을 때** 그 아이의 알림 줄과 시기 메타를 지운다.
   * 규칙·근거는 위 `clearNotificationsForChild` 주석에(특히 seenDedupeKeys를 남기는 이유).
   * PRIV-104 teardown(`resetAll`)과는 별개 액션이다 -- 호출부는 아이 삭제 뒤처리 한 곳뿐이다.
   */
  clearForChild: (childId: string) => void;
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
  "weekly_summary",
  // GAP-054 #6. weekly_summary와 같은 이유로 AppNotificationType 유니온에는 리터럴로 넣지
  // 않는다(저장본 호환 -- 위 주석). 저장본 검증은 여기 이 목록이 그대로 지고, 화면 표시
  // (아이콘·탭 목적지)는 app/notifications.tsx의 맵과 notification-route.ts가 진다.
  "record_gap",
  // GAP-066 #8(지난달 정리). 같은 이유로 리터럴 유니온이 아니라 이 목록에만 넣는다. **저장본
  // 마이그레이션은 없다**: 항목의 필드 모양은 한 칸도 바뀌지 않았고(새 종류일 뿐이다), 이 목록에
  // 없는 종류를 담은 옛/새 blob은 예전과 똑같이 그 항목만 조용히 떨어진다.
  "monthly_wrapup"
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
      /**
       * 라운드 52 C-08(b): 사용자가 끈 종류의 후보는 **여기서** 떨어진다 — ingest가 유일한
       * 유입구라 어느 호출부(홈 평가 훅, 테스트의 직접 호출)로 들어와도 같은 규칙을 지난다.
       *
       * 필터가 `addNotifications`보다 **앞**에 있는 것이 계약의 전부다: 걸러진 후보는 dedupe
       * 메모리에 닿지 않으므로 키가 소모되지 않고, 다시 켜면 다음 평가에서 평소대로 발화한다
       * (근거는 filterMutedNotificationCandidates 주석).
       *
       * 이 필터는 **알림 생성만** 막는다. 홈의 예산 경고 배너처럼 화면이 지금 상태를 그대로
       * 그리는 것(app/(tabs)/index.tsx)은 여기와 무관하다 — 같은 사실을 두 층에서 끄면 예산을
       * 넘긴 사용자가 그 사실을 아무 데서도 볼 수 없게 된다. 이 설정의 이름도 "앱 알림함"이다.
       */
      ingest: (candidates, now = Date.now()) =>
        set((state) =>
          addNotifications(
            state.entries,
            state.seenDedupeKeys,
            filterMutedNotificationCandidates(candidates, useNotificationPreferencesStore.getState().mutedTypes),
            now
          )
        ),
      markAllRead: (now = Date.now()) => set((state) => ({ entries: markAllNotificationsRead(state.entries, now) })),
      markRead: (id, now = Date.now()) => set((state) => ({ entries: markNotificationRead(state.entries, id, now) })),
      clearAll: () => set({ entries: [] }),
      remove: (id) => set((state) => ({ entries: removeNotification(state.entries, id) })),
      clearForChild: (childId) =>
        set((state) => {
          const next = clearNotificationsForChild(state, childId);
          // 지울 것이 없으면 상태를 통째로 그대로 둔다(구독자가 헛돌지 않게).
          return next.entries === state.entries && next.lastSeenStageByChild === state.lastSeenStageByChild
            ? state
            : next;
        }),
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
