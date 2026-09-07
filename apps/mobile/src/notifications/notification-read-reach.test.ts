import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  markAllNotificationsRead,
  selectUnreadCount,
  selectUnreadNotificationIds,
  type AppNotification
} from "./notification.store";

const mobileRoot = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(join(mobileRoot, relativePath), "utf8");
}

/**
 * 라운드 107 — **알림함을 다 보고 나왔는데 배지가 그대로인 자리.**
 *
 * 이 앱에서 "안 본 소식 N건"을 말하는 표면은 둘이고 스토어는 하나다: 홈 종 아이콘의 배지는
 * `selectUnreadCount(state.entries)`를(src/notifications/NotificationBell.tsx), 알림함은 같은
 * `entries`를 그대로 그린다(app/notifications.tsx). 그래서 두 표면이 갈릴 수 있는 자리는
 * **읽음 처리가 일어나는 순간** 하나뿐이고, 그 순간은 알림함의 포커스 효과 한 곳이다.
 *
 * 실패 시나리오(콜드 경로): 저장소 복구(zustand persist rehydrate)가 **첫 포커스보다 늦게**
 * 끝나면 그 포커스 효과는 아직 빈 목록 위에서 돈다 — 아래 첫 테스트가 값으로 보이듯
 * `markAllNotificationsRead([])`는 아무것도 하지 않는다. 그 뒤 복구가 끝나 항목들이
 * **안 읽음 그대로** 화면에 그려지고, 포커스 효과는 다시 오지 않는다(같은 화면 인스턴스에
 * 포커스가 이미 서 있다). 사용자는 목록을 다 보고 뒤로 나오지만 배지는 계속 N을 단다 —
 * 배지가 "아직 안 본 소식이 N건 있다"는 거짓을 말하는 유일한 자리다.
 *
 * 고침: 복구가 끝나는 바로 그 콜백에서 포커스 효과가 하려던 일을 마저 한다(스냅샷 먼저,
 * 읽음 처리 나중 — I-7이 포커스 효과에 세운 순서 규칙 그대로).
 *
 * 화면은 vitest에서 렌더되지 않으므로(react-native 네이티브 바인딩 없음) 배선은 이 저장소의
 * 관례대로 소스 계약으로 문다(notification-flow.test.ts와 같은 형식). 읽음 처리 규칙 자체는
 * 순수 함수가 지고, 아래 첫 두 테스트가 이 갈래가 왜 생기는지를 값으로 남긴다.
 */

const entry = (overrides: Partial<AppNotification> = {}): AppNotification => ({
  id: "notif:budget_80:child-1:2026-09",
  type: "budget_80",
  title: "이번 달 예산의 80%를 사용했어요",
  body: "남은 예산을 확인해 보세요.",
  createdAt: 1_757_000_000_000,
  dedupeKey: "budget_80:child-1:2026-09",
  childId: "child-1",
  ...overrides
});

describe("라운드 107 알림함 읽음 처리가 복구 경합에서 유실되던 자리", () => {
  it("복구 전 목록(빈 배열) 위의 읽음 처리는 아무 일도 하지 않는다 — 이 갈래가 생기는 이유", () => {
    const before: AppNotification[] = [];
    const after = markAllNotificationsRead(before, 1_757_000_100_000);
    expect(after).toEqual([]);
    // 같은 배열 참조를 돌려주므로 구독자도 움직이지 않는다(no-op 관례).
    expect(after).toBe(before);
  });

  it("복구가 끝나면 항목은 안 읽음 그대로 돌아오고, 배지와 목록이 같은 값을 본다", () => {
    const restored = [entry(), entry({ id: "notif:record_gap:child-1:2026-W37", type: "record_gap" })];
    // 배지가 세는 수와 알림함이 "새 소식" 점으로 쓰는 id 목록은 같은 사실의 두 얼굴이다.
    expect(selectUnreadCount(restored)).toBe(2);
    expect(selectUnreadNotificationIds(restored)).toEqual([
      "notif:budget_80:child-1:2026-09",
      "notif:record_gap:child-1:2026-W37"
    ]);
    // 읽음 처리가 실제로 도달하면 배지는 0이 된다.
    expect(selectUnreadCount(markAllNotificationsRead(restored, 1_757_000_100_000))).toBe(0);
  });

  it("화면의 복구 완료 콜백이 스냅샷을 뜬 **뒤** 읽음 처리를 마저 한다", () => {
    const screen = readSource("app/notifications.tsx");
    const start = screen.indexOf("useNotificationStore.persist.onFinishHydration(");
    expect(start, "복구 완료 구독 자리").toBeGreaterThan(-1);
    const hydrationCallback = screen.slice(start, screen.indexOf("useFocusEffect("));

    expect(hydrationCallback).toContain("setNewNotificationIds(selectUnreadNotificationIds(state.entries));");
    expect(hydrationCallback).toContain("useNotificationStore.getState().markAllRead();");
    // 순서: "새 소식" 스냅샷이 먼저다 — 뒤집으면 이번에 새로 온 것이 무엇인지가 그 자리에서
    // 영영 사라진다(포커스 효과의 I-7 규칙과 같은 이유).
    expect(hydrationCallback.indexOf("setNewNotificationIds(")).toBeLessThan(
      hydrationCallback.indexOf("markAllRead()")
    );
    // 구독은 마운트 1회다(deps가 늘면 이미 끝난 복구를 놓친다) — 그래서 액션을 getState()로
    // 부르고 훅의 반환값을 deps에 싣지 않는다.
    expect(hydrationCallback).toContain("}, []);");
  });

  it("포커스 경로의 읽음 처리는 종전 그대로 남아 있다(이 라운드가 그 자리를 옮기지 않았다)", () => {
    const screen = readSource("app/notifications.tsx");
    const focusEffect = screen.slice(screen.indexOf("useFocusEffect("), screen.indexOf("}, [markAllRead])"));
    expect(focusEffect).toContain("markAllRead();");
    expect(focusEffect).toContain("if (useNotificationStore.persist.hasHydrated()) {");
    // 읽음 처리를 부르는 자리는 정확히 둘이다(포커스 · 복구 완료). 셋째 자리가 생기면 여기서 걸린다.
    expect(screen.match(/markAllRead\(\)/g) ?? []).toHaveLength(2);
  });

  it("배지와 목록이 같은 스토어의 같은 사실을 읽는다(갈릴 수 있는 자리는 읽음 처리 하나뿐)", () => {
    expect(readSource("src/notifications/NotificationBell.tsx")).toContain(
      "useNotificationStore((state) => selectUnreadCount(state.entries))"
    );
    expect(readSource("app/notifications.tsx")).toContain("useNotificationStore((state) => state.entries)");
  });
});
