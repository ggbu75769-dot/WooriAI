import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANDROID_ALERT_BUTTON_LIMIT,
  NOTIFICATION_ROW_CANCEL_LABEL,
  NOTIFICATION_ROW_DELETE_LABEL,
  NOTIFICATION_ROW_SHEET_FALLBACK_TITLE,
  NOTIFICATION_ROW_SHEET_MESSAGE,
  buildNotificationRowActionSheet,
  buildNotificationRowActions,
  notificationRowAccessibilityActions,
  notificationRowAccessibilityHint,
  notificationRowAccessibilityLabel,
  resolveNotificationRowAction
} from "./notification-row-actions";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * 라운드 52 C-10 — 알림함 행의 롱프레스 액션시트.
 *
 * 관례(순수 모듈 + 화면은 Alert/accessibilityActions에 꽂기만)는 기록 탭의
 * src/expenses/record-row-actions.ts를 그대로 따른다. 그 파일은 손대지 않는다.
 */
describe("라운드 52 C-10 알림 행 액션(순수 로직)", () => {
  it("행이 내놓는 동작은 파괴적인 '이 알림 지우기' 하나다", () => {
    const actions = buildNotificationRowActions();
    expect(actions.map((action) => action.key)).toEqual(["delete"]);
    expect(actions[0]!.label).toBe(NOTIFICATION_ROW_DELETE_LABEL);
    expect(actions[0]!.destructive).toBe(true);
    // "삭제"만으로는 이 줄인지 전체인지 알 수 없다 -- 헤더의 "모두 지우기"와 짝이 되는 문구.
    expect(NOTIFICATION_ROW_DELETE_LABEL).toBe("이 알림 지우기");
  });

  it("스크린리더 커스텀 액션은 눈에 보이는 목록과 같은 항목이다(롱프레스는 발견할 수 없는 제스처)", () => {
    const actions = buildNotificationRowActions();
    expect(notificationRowAccessibilityActions(actions)).toEqual([
      { name: "delete", label: NOTIFICATION_ROW_DELETE_LABEL }
    ]);
    expect(notificationRowAccessibilityHint(actions)).toBe("길게 누르면 지우기를 고를 수 있어요.");
  });

  it("이 행이 내놓지 않은 액션 이름은 실행되지 않는다", () => {
    const actions = buildNotificationRowActions();
    expect(resolveNotificationRowAction("delete", actions)).toBe("delete");
    expect(resolveNotificationRowAction("repeat", actions)).toBeNull();
    expect(resolveNotificationRowAction("activate", actions)).toBeNull();
  });

  it("행 라벨은 화면이 ListRow에 넘기는 그 세 문자열이다(보이는 것과 읽히는 것이 같다)", () => {
    expect(
      notificationRowAccessibilityLabel({
        title: "다온이 · 이번 달 예산의 80%를 사용했어요",
        body: "남은 예산을 확인해보세요.",
        timeLabel: "3시간 전"
      })
    ).toBe("다온이 · 이번 달 예산의 80%를 사용했어요, 남은 예산을 확인해보세요., 3시간 전");
    // 빈 조각은 조용히 빠진다(쉼표만 남은 라벨을 만들지 않는다).
    expect(notificationRowAccessibilityLabel({ title: "제목", body: "", timeLabel: "  " })).toBe("제목");
  });

  it("액션시트는 되돌릴 수 없다는 사실을 먼저 말하고, 취소로 빠져나갈 수 있다", () => {
    const sheet = buildNotificationRowActionSheet({ title: "이번 달 예산의 80%를 사용했어요", platform: "ios" });
    expect(sheet.title).toBe("이번 달 예산의 80%를 사용했어요");
    expect(sheet.message).toBe(NOTIFICATION_ROW_SHEET_MESSAGE);
    expect(NOTIFICATION_ROW_SHEET_MESSAGE).toBe("지운 알림은 다시 볼 수 없어요.");
    expect(sheet.buttons).toEqual([
      { label: NOTIFICATION_ROW_DELETE_LABEL, actionKey: "delete", style: "destructive" },
      { label: NOTIFICATION_ROW_CANCEL_LABEL, actionKey: null, style: "cancel" }
    ]);
    expect(sheet.cancelable).toBe(true);
  });

  it("안드로이드에서도 버튼이 잘리지 않는다(2개 < 상한 3개)", () => {
    const sheet = buildNotificationRowActionSheet({ title: "제목", platform: "android" });
    expect(sheet.buttons.length).toBeLessThanOrEqual(ANDROID_ALERT_BUTTON_LIMIT);
    expect(sheet.buttons.some((button) => button.actionKey === null)).toBe(true);
    expect(sheet.cancelable).toBe(true);
  });

  it("제목이 빈 행(옛/손상 저장본)에서는 이름을 지어내지 않는다", () => {
    expect(buildNotificationRowActionSheet({ title: "   ", platform: "ios" }).title).toBe(
      NOTIFICATION_ROW_SHEET_FALLBACK_TITLE
    );
  });
});

describe("라운드 52 C-10 배선 (source verification -- 화면은 vitest에서 렌더하지 않는 관례)", () => {
  const screen = () => source("app/notifications.tsx");

  it("행에 롱프레스 액션시트와 스크린리더 커스텀 액션을 함께 얹는다", () => {
    const screenSource = screen();
    expect(screenSource).toContain("onLongPress={() => openRowActionSheet(entry, rowTitle)}");
    expect(screenSource).toContain("accessibilityActions={notificationRowAccessibilityActions(rowActions)}");
    expect(screenSource).toContain("accessibilityHint={notificationRowAccessibilityHint(rowActions)}");
    expect(screenSource).toContain(
      "onAccessibilityAction={(event) => handleRowAccessibilityAction(event, entry, rowTitle)}"
    );
    // 항목·문구 구성은 순수 모듈에서 온다(화면이 문구를 다시 적지 않는다).
    expect(screenSource).toContain('from "../src/notifications/notification-row-actions"');
    expect(screenSource).not.toContain("이 알림 지우기");
  });

  /**
   * 라운드 52 QA P3-2 — 액션시트 버튼 → 동작 매핑.
   *
   * 예전 배선은 `actionKey`가 **있기만 하면** 삭제를 실행했다. 동작이 하나뿐인 지금은 결과가
   * 같지만, 항목이 늘어나는 순간 취소가 아닌 모든 버튼이 삭제를 실행한다 -- 되돌릴 수 없는
   * 동작에서 가장 나쁜 종류의 잠재 오동작이다.
   */
  it("액션시트 버튼은 액션 키로 분기한다(비취소 버튼이 전부 삭제를 실행하지 않는다)", () => {
    const screenSource = screen();
    expect(screenSource).toContain("onPress: () => runRowAction(button.actionKey!, entry)");
    expect(screenSource).toContain("const runRowAction = (actionKey: NotificationRowActionKey, entry: AppNotification) => {");
    expect(screenSource).toContain("switch (actionKey) {");
    expect(screenSource).toContain('case "delete":');
    // 알 수 없는 키에서 파괴적 동작이 기본값이 되지 않는다.
    const runBlock = screenSource.slice(
      screenSource.indexOf("const runRowAction ="),
      screenSource.indexOf("const openRowActionSheet =")
    );
    expect(runBlock).toContain("default:");
    expect(runBlock.match(/deleteNotification\(entry\);/g) ?? []).toHaveLength(1);
    // 액션 키 목록은 순수 모듈이 단일 소스다(화면이 자기 키를 지어내지 않는다).
    expect(screenSource).toContain("type NotificationRowActionKey");
  });

  /**
   * 라운드 52 QA P3-3 — 시각/비시각 안전장치 대칭.
   *
   * 눈으로 쓰는 경로는 롱프레스 → 액션시트 → destructive 버튼의 두 단계인데, 스크린리더
   * 커스텀 액션은 고르는 즉시 지웠다. 되돌릴 수 없는 동작(dedupe 키가 남아 같은 알림은 다시
   * 오지 않는다)에서 확인 단계가 한쪽에만 있으면 안 된다.
   */
  it("스크린리더 커스텀 액션도 삭제 전에 확인 경로(액션시트)를 지난다", () => {
    const screenSource = screen();
    const handler = screenSource.slice(
      screenSource.indexOf("const handleRowAccessibilityAction = ("),
      screenSource.indexOf("const now = Date.now();")
    );
    // 이 행이 내놓지 않은 액션 이름은 여전히 무시한다.
    expect(handler).toContain("if (!resolveNotificationRowAction(event.nativeEvent.actionName, rowActions)) return;");
    // 확인 없이 곧바로 지우지 않는다 -- 눈으로 쓰는 경로와 **같은** 액션시트를 연다.
    expect(handler).toContain("openRowActionSheet(entry, rowTitle);");
    expect(handler).not.toContain("deleteNotification(");
  });

  it("탭의 기본 동작(읽음 -> 점 제거 -> 이동)은 그대로다", () => {
    const screenSource = screen();
    const tapHandler = screenSource.slice(
      screenSource.indexOf("markRead(entry.id);"),
      screenSource.indexOf("router.push(notificationTapRoute(entry, nextRecordsViewNonce()));")
    );
    expect(tapHandler).toContain("removeNotificationMark(previous, entry.id)");
  });

  it("공용 ListRow는 접근성·터치에서 잠그고 바깥 Pressable이 행을 소유한다(기록 탭과 같은 구조)", () => {
    const screenSource = screen();
    expect(screenSource).toContain('importantForAccessibility="no-hide-descendants"');
    expect(screenSource).toContain("pointerEvents=\"none\"");
    expect(screenSource).toContain("accessibilityLabel={notificationRowAccessibilityLabel({");
    // ListRow는 더 이상 자기 onPress를 갖지 않는다(가지면 바깥 롱프레스가 오지 않는다).
    const listRowBlock = screenSource.slice(screenSource.indexOf("<ListRow"), screenSource.indexOf("/>", screenSource.indexOf("<ListRow")));
    expect(listRowBlock).not.toContain("onPress");
  });

  it("지운 뒤에는 '새 소식' 점 목록에서도 그 id가 빠진다", () => {
    const screenSource = screen();
    const deleteHandler = screenSource.slice(
      screenSource.indexOf("const deleteNotification = (entry: AppNotification) => {"),
      screenSource.indexOf("const openRowActionSheet =")
    );
    expect(deleteHandler).toContain("removeNotificationEntry(entry.id)");
    expect(deleteHandler).toContain("removeNotificationMark(previous, entry.id)");
  });

  it("'모두 지우기'의 확인 Alert은 그대로 남아 있다(둘은 다른 동작이다)", () => {
    const screenSource = screen();
    expect(screenSource).toContain('Alert.alert("알림을 모두 지울까요?"');
    expect(screenSource).toContain("clearAll()");
  });

  it("기록 탭의 순수 모듈은 손대지 않는다(패턴만 따랐다)", () => {
    const recordRowSource = source("src/expenses/record-row-actions.ts");
    expect(recordRowSource).not.toContain("notification");
    expect(recordRowSource).not.toContain("알림");
  });
});
