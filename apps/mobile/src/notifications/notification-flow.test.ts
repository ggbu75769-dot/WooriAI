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
    // 라운드 54 P1-3: 세 번째 인자는 홈이 이미 구독 중인 오프라인 스냅샷에서 나온 순수 판정이다
    // (record_gap 억제 근거 -- 새 요청·새 구독 없음).
    expect(homeSource).toContain(
      "useHomeNotificationEvaluation(hasSession ? home.data : undefined, weeklySpendForNotification, hasPendingLocalRecords)"
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
    // 라운드 39 UX-O: 목적지 판정 자체는 src/notifications/notification-route.ts의 순수 함수로
    // 옮겼다(종류별 목적지는 notification-route.test.ts가 값으로 검증한다). 화면은 그 판정을
    // 그대로 router.push에 넘기기만 한다.
    expect(screenSource).toContain("markRead(entry.id)");
    expect(screenSource).toContain("router.push(notificationTapRoute(entry, nextRecordsViewNonce()))");
    expect(screenSource).toContain(
      'import { nextRecordsViewNonce, notificationTapRoute } from "../src/notifications/notification-route";'
    );
    // 예전의 화면 내 if 사슬은 남아 있지 않다 -- 특히 weekly_summary를 /budget으로 보내던 조건.
    expect(screenSource).not.toContain('entry.type === "weekly_summary"');
    expect(screenSource).not.toContain("function openNotification(");
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

  /**
   * 라운드 39 UX-O: 알림함의 두 구멍.
   * - 포커스 즉시 전부 읽음 처리라 20줄이 전부 똑같이 보였다 -> 읽음 처리 직전의 안읽음 스냅샷.
   * - 뒤로가기가 빈 상태 카드에만 있어서, 알림이 있으면 화면 안에 나갈 길이 없었다.
   *
   * 라운드 39 I-7: 그 스냅샷은 **포커스마다** 다시 뜬다. 알림을 눌러 나갔다 돌아오는 경로는 같은
   * 인스턴스의 재포커스라 마운트 1회 스냅샷이 낡는다(방금 본 항목에 점이 남고, 그 사이 새로 온
   * 항목에는 점이 붙지 않는다).
   */
  it("marks the notifications that were new when the screen opened, and keeps a 뒤로가기 in the list state", () => {
    const screenSource = source("app/notifications.tsx");
    // 스냅샷: 스토어 selector를 읽음 처리 직전에 읽는다(읽음 처리는 지금까지처럼 markAllRead).
    expect(screenSource).toContain("selectUnreadNotificationIds(useNotificationStore.getState().entries)");
    expect(screenSource).toContain("useState<string[]>(");
    expect(screenSource).toContain("newNotificationIds.includes(entry.id)");
    expect(screenSource).toContain("markAllRead()");
    // I-7: 포커스 콜백 안에서, markAllRead()보다 **먼저** 스냅샷을 뜬다.
    const focusEffect = screenSource.slice(
      screenSource.indexOf("useFocusEffect("),
      screenSource.indexOf("}, [markAllRead])")
    );
    // 라운드 40 J-7: 그 스냅샷은 이제 **교체가 아니라 합집합**이다(재포커스가 아직 안 본
    // 항목의 점까지 지우던 문제 — 규칙과 단위 테스트는 new-notification-marks.ts).
    expect(focusEffect).toContain("selectUnreadNotificationIds(stored)");
    expect(focusEffect).toContain("mergeNewNotificationMarks(");
    expect(focusEffect.indexOf("setNewNotificationIds(")).toBeLessThan(focusEffect.indexOf("markAllRead()"));
    // 아직 rehydrate 전이면 잘못된(빈) 스냅샷으로 덮어쓰지 않는다.
    expect(focusEffect).toContain("if (useNotificationStore.persist.hasHydrated()) {");
    // 시각 구분 + 스크린 리더 접두. 새 hex 없이 기존 토큰만 쓴다.
    expect(screenSource).toContain('accessibilityLabel="새 소식"');
    expect(screenSource).toContain("backgroundColor: theme.colors.mainCoral");
    expect(screenSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // 목록 상태에서도 화면 안 뒤로가기: UX-Q(C)가 낸 ScreenHeader의 onBack 슬롯을 쓴다
    // (‹ 표기·"뒤로가기" 라벨·44dp 타깃이 그 컴포넌트 한 곳에 있다 -- screen-header-back.test.ts).
    // 빈 상태 카드의 뒤로가기는 그대로 남는다.
    const headerBlock = screenSource.slice(screenSource.indexOf("<ScreenHeader"), screenSource.indexOf("/>", screenSource.indexOf("<ScreenHeader")) + 2);
    expect(headerBlock).toContain("onBack={() => router.back()}");
  });

  it("turns the more tab's '알림 설정 · 준비 중' stub row into a live /notifications link", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    // 라운드 41 UX-U(A): 세션 메뉴 구성이 src/settings/more-menu.ts로 옮겨졌고, 행 이름은 설정 안의
    // "알림 설정"(푸시 수신 관리)과 구분되도록 "알림함"이 됐다. 계약(더보기에서 /notifications로
    // 실제 이동, "준비 중" 비활성 스텁 없음)은 그대로다.
    expect(source("src/settings/more-menu.ts")).toContain('title: "알림함", route: "/notifications"');
    expect(moreSource).toContain("buildMoreSessionMenuRows(");
    expect(moreSource).not.toContain('title: "알림 설정", caption: "준비 중"');
  });

  it("wires the NOTI-103 weekly summary through the existing evaluation path (no new data fetching)", () => {
    // The generator is composed inside evaluateHomeNotifications from the same home snapshot the
    // NOTI-102 hook already passes. UX-J: 주간 숫자는 홈이 이미 만든 값을 받아 쓰므로 여전히
    // **새 API 호출이 없다**(NOTI-103의 제약 그대로) -- 주간 값이 없을 때만 월 페이스로 폴백한다.
    const generatorsSource = source("src/notifications/generators.ts");
    expect(generatorsSource).toContain("export function weeklySummaryNotification(");
    // GAP-054 #6에서 같은 모듈의 서울 달력 헬퍼가 함께 들어와 import 한 줄이 넓어졌다 --
    // 요지(주 식별자는 iso-week.ts 단일 소스)는 그대로다.
    expect(generatorsSource).toContain('seoulIsoWeekKey } from "./iso-week"');
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

    // 알 수 없는 종류는 여전히 안전하게 그려진다: 아이콘 조회는 undefined일 수 있고(ListRow의
    // icon prop은 선택·가드됨), 목적지는 준비템 목록으로 떨어진다. 라운드 39 UX-O에서 그
    // 폴백은 화면에서 src/notifications/notification-route.ts로 옮겨 갔고, weekly_summary는
    // 이제 폴백이 아니라 제 목적지(/(tabs)/records)를 갖는다 -- notification-route.test.ts 참고.
    const routeSource = source("src/notifications/notification-route.ts");
    expect(routeSource).toContain('return "/(tabs)/items";');
    expect(routeSource).toContain('if (entry.type === "weekly_summary") return "/(tabs)/records";');
    // CLN-130: 이 단언은 app/notifications.tsx가 실제로 쓰지 않는 src/ui/ListRow.tsx(죽은 D0
    // 컴포넌트, 제거됨)를 보고 있었다. 화면이 `../src/ui`에서 가져오는 ListRow는 src/ui.tsx의
    // 것이므로 그쪽으로 옮긴다 -- guarded optional icon이라는 요지는 그대로다.
    const listRowSource = source("src/ui.tsx");
    const listRowBlock = listRowSource.slice(listRowSource.indexOf("export function ListRow"), listRowSource.indexOf("export function ProductCard"));
    // D1 후속(실기기 피드백 2): icon은 Ionicons 노드도 받도록 넓어졌다. 문자열이면 예전처럼
    // Text로 그리고, undefined면 여전히 아무 것도 그리지 않는다는 요지는 그대로다.
    expect(listRowBlock).toContain("icon?: React.ReactNode;");
    // 라운드 49 QA(P3-8): 빈 문자열도 "아이콘 없음"이라 자리를 만들지 않는다 -- 문자열이면
    // 예전처럼 Text로 그린다는 요지는 그대로다(design-foundation.test.ts가 형태를 고정한다).
    expect(listRowBlock).toContain('typeof icon === "string" ? (');
    expect(listRowBlock).toContain("<Text style={{ color: theme.colors.mainCoral, fontSize: 20 }}>{icon}</Text>");
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
