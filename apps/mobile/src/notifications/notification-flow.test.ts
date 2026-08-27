import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("NOTI-102 in-app notification center wiring (source verification -- follows the\n  export-flow.test.ts / import-flow.test.ts source-grep convention; screens aren't\n  runtime-rendered because react-native has no native binding under vitest)", () => {
  it("restores the home-header bell (hidden by UX-5B-8) with an unread badge", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    expect(homeSource).toContain("action={<NotificationBell />}");
    // UX-J: 두 번째 인자는 홈 주간 카드가 이미 만든 값(새 요청 없음) -- 세션 게이트는 그대로다.
    // 라운드 37 G-1: 그 값은 "아직 모름(undefined)"과 "확정 실패(null)"를 구분해서 넘어간다.
    expect(homeSource).toContain(
      "useHomeNotificationEvaluation(hasSession ? home.data : undefined, weeklySpendForNotification)"
    );
    expect(homeSource).toContain("resolveWeeklySpendForNotification({");
    expect(homeSource).toContain("expensesFailed: thisMonthExpenses.isError || lastMonthExpenses.isError");
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
    // NOTI-102 hook already passes. UX-J: 주간 숫자는 홈이 이미 만든 값을 받아 쓰므로 여전히
    // **새 API 호출이 없다**(NOTI-103의 제약 그대로) -- 주간 값이 없을 때만 월 페이스로 폴백한다.
    const generatorsSource = source("src/notifications/generators.ts");
    expect(generatorsSource).toContain("export function weeklySummaryNotification(");
    expect(generatorsSource).toContain('import { seoulIsoWeekKey } from "./iso-week"');
    expect(generatorsSource).toContain('import { formatKrw } from "../money"');
    expect(generatorsSource).toContain("dedupeKey: `weekly_summary:${childId}:${seoulIsoWeekKey(now)}`");
    // Wired inside evaluateHomeNotifications, so the hook stays the single evaluation entry point.
    expect(generatorsSource).toContain("const weeklyCandidate = weeklySummaryNotification({");
    expect(generatorsSource).toContain("if (weeklyCandidate) candidates.push(weeklyCandidate);");
    expect(generatorsSource).toContain("weekly: input.weekly");
    // UX-J: 주간 문구는 홈 카드 모듈의 결과를 그대로 쓴다(타입 전용 import라 런타임 의존 없음).
    expect(generatorsSource).toContain('import type { WeeklySummary } from "../home/weekly-summary"');
    const hookSource = source("src/notifications/useHomeNotificationEvaluation.ts");
    expect(hookSource).toContain("monthly: home.monthly");
    expect(hookSource).toContain("evaluateHomeNotifications(");
    // 라운드 37 G-1: 훅은 세 상태를 그대로 흘린다 -- `?? null`로 평탄화하면 "아직 모름"이
    // "확정 실패"가 되어 첫 평가가 월 페이스 폴백으로 그 주의 dedupeKey를 소진한다.
    expect(hookSource).toContain("weekly: WeeklySpendResolution");
    expect(hookSource).not.toContain("weekly ?? null");

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
    // CLN-130: 이 단언은 app/notifications.tsx가 실제로 쓰지 않는 src/ui/ListRow.tsx(죽은 D0
    // 컴포넌트, 제거됨)를 보고 있었다. 화면이 `../src/ui`에서 가져오는 ListRow는 src/ui.tsx의
    // 것이므로 그쪽으로 옮긴다 -- guarded optional icon이라는 요지는 그대로다.
    const listRowSource = source("src/ui.tsx");
    const listRowBlock = listRowSource.slice(listRowSource.indexOf("export function ListRow"), listRowSource.indexOf("export function ProductCard"));
    expect(listRowBlock).toContain("icon?: string;");
    expect(listRowBlock).toContain("{icon ? <Text");
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
