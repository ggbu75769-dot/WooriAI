import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeNewNotificationMarks, removeNotificationMark } from "./new-notification-marks";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 라운드 40 J-7 — 재포커스가 "아직 안 본 항목"의 점까지 지우던 문제.
 *
 * 알림함은 포커스와 동시에 전부 읽음 처리하므로, 재포커스 순간의 안읽음은 0건이다. 스냅샷을
 * 그 값으로 **교체**하면 3건 중 1건만 보고 돌아온 사용자의 나머지 2건 점이 함께 사라진다.
 * 규칙은 "합집합 − 사용자가 실제로 탭한 항목"이다.
 */
describe("라운드 40 J-7 새 소식 표시 규칙", () => {
  const present = ["n-1", "n-2", "n-3"];

  it("첫 포커스: 그때 안읽음이던 항목이 새 소식이다", () => {
    expect(mergeNewNotificationMarks([], ["n-1", "n-2", "n-3"], present)).toEqual(["n-1", "n-2", "n-3"]);
  });

  it("3건 중 1건 탭 후 재포커스 → 나머지 2건의 점이 그대로 남는다", () => {
    const first = mergeNewNotificationMarks([], ["n-1", "n-2", "n-3"], present);
    // 사용자가 n-1을 눌러 그 화면으로 갔다(그 순간 표시가 빠진다).
    const afterTap = removeNotificationMark(first, "n-1");
    expect(afterTap).toEqual(["n-2", "n-3"]);
    // 돌아온다: 이미 전부 읽음 처리되어 안읽음은 0건이다 -- 종전에는 여기서 전부 사라졌다.
    expect(mergeNewNotificationMarks(afterTap, [], present)).toEqual(["n-2", "n-3"]);
  });

  it("화면을 떠 있는 동안 새로 도착한 항목은 점이 붙는다(I-7이 고친 동작 유지)", () => {
    const afterTap = ["n-2", "n-3"];
    expect(mergeNewNotificationMarks(afterTap, ["n-4"], [...present, "n-4"])).toEqual([
      "n-2",
      "n-3",
      "n-4"
    ]);
  });

  it("같은 항목이 두 경로로 들어와도 한 번만 센다", () => {
    expect(mergeNewNotificationMarks(["n-2"], ["n-2", "n-3"], present)).toEqual(["n-2", "n-3"]);
  });

  it("목록에서 사라진 항목(모두 지우기)의 표시는 들고 있지 않는다", () => {
    expect(mergeNewNotificationMarks(["n-1", "n-2"], ["n-3"], [])).toEqual([]);
    expect(mergeNewNotificationMarks(["n-1", "n-2"], [], ["n-2"])).toEqual(["n-2"]);
  });

  it("탭하지 않은 항목을 지우려 하면 같은 배열을 그대로 돌려준다(무의미한 리렌더 없음)", () => {
    const marks = ["n-2", "n-3"];
    expect(removeNotificationMark(marks, "n-9")).toBe(marks);
  });
});

describe("라운드 40 J-7 배선 (app/notifications.tsx)", () => {
  const screen = () => source("app/notifications.tsx");

  it("포커스 스냅샷은 교체가 아니라 합집합이다", () => {
    const screenSource = screen();
    expect(screenSource).toContain('from "../src/notifications/new-notification-marks"');
    const focusEffect = screenSource.slice(
      screenSource.indexOf("useFocusEffect("),
      screenSource.indexOf("}, [markAllRead])")
    );
    expect(focusEffect).toContain("mergeNewNotificationMarks(");
    // 읽음 처리보다 먼저 스냅샷을 뜬다(I-7의 순서는 그대로다).
    expect(focusEffect.indexOf("setNewNotificationIds(")).toBeLessThan(focusEffect.indexOf("markAllRead()"));
    // 안읽음 스냅샷을 그대로 대입하던 교체 규칙은 남아 있지 않다.
    expect(focusEffect).not.toContain(
      "setNewNotificationIds(selectUnreadNotificationIds(useNotificationStore.getState().entries));"
    );
  });

  it("점을 지우는 것은 행을 실제로 탭했을 때뿐이다", () => {
    const screenSource = screen();
    expect(screenSource).toContain("removeNotificationMark(previous, entry.id)");
    // 탭 핸들러 안에 있다(읽음 처리와 라우팅 사이).
    const tapHandler = screenSource.slice(
      screenSource.indexOf("markRead(entry.id);"),
      screenSource.indexOf("router.push(notificationTapRoute(entry));")
    );
    expect(tapHandler).toContain("removeNotificationMark(previous, entry.id)");
  });
});
