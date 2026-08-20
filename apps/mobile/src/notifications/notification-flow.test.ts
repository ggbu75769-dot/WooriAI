import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("NOTI-102 in-app notification center wiring (source verification -- follows the\n  export-flow.test.ts / import-flow.test.ts source-grep convention; screens aren't\n  runtime-rendered because react-native has no native binding under vitest)", () => {
  it("restores the home-header bell (hidden by UX-5B-8) with an unread badge", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    expect(homeSource).toContain("action={<NotificationBell />}");
    expect(homeSource).toContain("useHomeNotificationEvaluation(hasSession ? home.data : undefined)");
    // The UX-5B-8 hide-the-bell note must be gone -- the bell is a real feature again.
    expect(homeSource).not.toContain("홈의 알림 벨은 당분간 숨긴다");

    const bellSource = source("src/notifications/NotificationBell.tsx");
    expect(bellSource).toContain('router.push("/notifications")');
    expect(bellSource).toContain("selectUnreadCount(state.entries)");
    // Badge: coral count dot, capped display, hidden at zero (bell alone in preview/empty state).
    expect(bellSource).toContain("backgroundColor: theme.colors.mainCoral");
    expect(bellSource).toContain('unreadCount > 9 ? "9+" : String(unreadCount)');
    expect(bellSource).toContain("unreadCount > 0 ? (");
  });

  it("session-gates evaluation in the home screen and waits for store rehydration", () => {
    const hookSource = source("src/notifications/useHomeNotificationEvaluation.ts");
    expect(hookSource).toContain("if (!home) return;");
    expect(hookSource).toContain("useNotificationStore.persist.hasHydrated()");
    expect(hookSource).toContain("useNotificationStore.persist.onFinishHydration");
    // Read-only peek at the COM-108 store -- selectors only, no writes.
    expect(hookSource).toContain("usePurchaseFollowupStore.getState().entries");
    expect(hookSource).toContain("evaluateHomeNotifications(");
    expect(hookSource).toContain("recordSeenStage(home.child.id, home.child.stageLabel)");
  });

  it("renders the notification list from the store with read-on-focus and per-type routing", () => {
    const screenSource = source("app/notifications.tsx");
    expect(screenSource).toContain("useNotificationStore((state) => state.entries)");
    expect(screenSource).toContain("useFocusEffect(");
    expect(screenSource).toContain("markAllRead()");
    // Per-row tap: mark read, then route to the surface the notification is about.
    expect(screenSource).toContain("markRead(entry.id)");
    expect(screenSource).toContain('router.push("/budget")');
    expect(screenSource).toContain('router.push("/(tabs)/items")');
    expect(screenSource).toContain("itemTemplateIdFromPurchaseDedupeKey(entry.dedupeKey)");
    expect(screenSource).toContain("router.push(`/items/${itemTemplateId}`)");
    // Relative timestamps + list rows from the shared pixel-lock component set.
    expect(screenSource).toContain("formatRelativeTime(entry.createdAt, now)");
    expect(screenSource).toContain("<ListRow");
    // 모두 지우기 + a warm empty state that keeps the 뒤로가기 escape hatch.
    expect(screenSource).toContain("모두 지우기");
    expect(screenSource).toContain("clearAll()");
    expect(screenSource).toContain("아직 알림이 없어요");
    expect(screenSource).toContain('actionLabel="뒤로가기"');
    expect(screenSource).toContain("EmptyStateCard");
  });

  it("turns the more tab's '알림 설정 · 준비 중' stub row into a live /notifications link", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    expect(moreSource).toContain('title: "알림", onPress: () => router.push("/notifications")');
    expect(moreSource).not.toContain('title: "알림 설정", caption: "준비 중"');
  });

  it("wires the NOTI-103 weekly summary through the existing evaluation path (no new data fetching)", () => {
    // The generator is composed inside evaluateHomeNotifications from the same home snapshot the
    // NOTI-102 hook already passes -- monthly-pace variant, since HomeSummary has no weekly data
    // (recentExpenses is server-capped at 3) and NOTI-103 forbids new API calls.
    const generatorsSource = source("src/notifications/generators.ts");
    expect(generatorsSource).toContain("export function weeklySummaryNotification(");
    expect(generatorsSource).toContain('import { seoulIsoWeekKey } from "./iso-week"');
    expect(generatorsSource).toContain('import { formatKrw } from "../money"');
    expect(generatorsSource).toContain("dedupeKey: `weekly_summary:${childId}:${seoulIsoWeekKey(now)}`");
    // Wired inside evaluateHomeNotifications, so the unchanged hook picks it up for free.
    expect(generatorsSource).toContain("const weekly = weeklySummaryNotification({");
    expect(generatorsSource).toContain("if (weekly) candidates.push(weekly);");
    const hookSource = source("src/notifications/useHomeNotificationEvaluation.ts");
    expect(hookSource).toContain("monthly: home.monthly");
    expect(hookSource).toContain("evaluateHomeNotifications(");

    // The store's persisted-blob sanitizer accepts the new type.
    const storeSource = source("src/notifications/notification.store.ts");
    expect(storeSource).toContain('"weekly_summary"');

    // app/notifications.tsx (off-limits to NOTI-103) renders unknown types safely today: the
    // icon lookup may yield undefined (ListRow's icon prop is optional and guarded) and
    // openNotification falls through to the /(tabs)/items push. A follow-up one-liner there can
    // add a weekly_summary icon + /budget route, after which AppNotificationType can be
    // re-closed (see the KnownAppNotificationType note in notification.store.ts).
    const screenSource = source("app/notifications.tsx");
    expect(screenSource).toContain('router.push("/(tabs)/items")');
    const listRowSource = source("src/ui/ListRow.tsx");
    expect(listRowSource).toContain("icon?: string;");
  });

  it("keeps the notification store on the persisted-store conventions (cap, dedupe, teardown)", () => {
    const storeSource = source("src/notifications/notification.store.ts");
    expect(storeSource).toContain('name: "wooriai-notifications"');
    expect(storeSource).toContain("createJSONStorage(() => persistStorage)");
    expect(storeSource).toContain("export const NOTIFICATION_MAX_ENTRIES = 50;");
    // Defensive migrate/merge + resetAll, mirroring purchase-followup.store.ts.
    expect(storeSource).toContain("migrate: (persisted) => sanitizedState(persisted)");
    expect(storeSource).toContain("merge: (persisted, current) => ({ ...current, ...sanitizedState(persisted) })");
    expect(storeSource).toContain("resetAll: () =>");
  });
});
