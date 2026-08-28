/**
 * 라운드 52 C-10 — 알림함 행의 롱프레스 액션시트(순수 로직).
 *
 * 왜 필요한가: 알림함의 정리 수단은 "모두 지우기" 하나뿐이었다. 이미 처리한 구매 확인 알림
 * 하나를 치우려면 아직 안 본 예산·주간 알림까지 통째로 버려야 했다는 뜻이다(게다가 지운 알림은
 * dedupe 키가 남아 다시 오지 않는다 — 되돌릴 수 없는 손실이다).
 *
 * 관례는 기록 탭의 행 액션(src/expenses/record-row-actions.ts)을 그대로 따른다: 항목·문구·버튼
 * 구성은 전부 이 순수 모듈에 있고, 화면은 그것을 RN Alert과 `accessibilityActions`에 꽂기만
 * 한다. 한 곳에 두는 이유도 같다 — 눈에 보이는 액션시트와 스크린리더의 커스텀 액션 메뉴가
 * 갈리면, 롱프레스를 발견할 수 없는 스크린리더 사용자에게만 항목이 없어진다.
 *
 * 이 모듈은 react-native / expo-router / 저장소에 의존하지 않는다(vitest 단위 테스트 대상).
 */

/** 알림 행에서 고를 수 있는 동작. 지금은 하나뿐이지만 액션 키로 다루는 형태를 유지한다. */
export type NotificationRowActionKey = "delete";

export type NotificationRowAction = {
  key: NotificationRowActionKey;
  /** 액션시트 버튼 · 스크린리더 액션 메뉴에 보이는 문구. */
  label: string;
  /** 힌트 문장에 늘어놓을 때 쓰는 짧은 이름. */
  shortLabel: string;
  destructive: boolean;
};

/** "삭제"만으로는 무엇이 지워지는지(이 줄인지 전체인지) 헷갈린다 — 헤더의 "모두 지우기"와 짝. */
export const NOTIFICATION_ROW_DELETE_LABEL = "이 알림 지우기";
export const NOTIFICATION_ROW_CANCEL_LABEL = "취소";

/**
 * 액션시트 본문. 되돌릴 수 없다는 사실을 **여기서** 말한다.
 *
 * "모두 지우기"는 확인 Alert을 한 번 더 띄우지만(app/notifications.tsx의 confirmClearAll),
 * 한 줄 지우기는 액션시트 자체가 이미 사용자가 의도적으로 연 확인 단계다. Alert을 두 번 겹치면
 * 한 줄 치우는 데 탭이 네 번 든다 — 대신 결과를 이 문장으로 미리 알리고 버튼을 destructive로
 * 둔다(문구는 confirmClearAll의 것과 같은 사실을 말한다).
 */
export const NOTIFICATION_ROW_SHEET_MESSAGE = "지운 알림은 다시 볼 수 없어요.";

/** 제목이 빈 행(옛/손상 저장본)에서 쓰는 액션시트 제목 — 없는 제목을 지어내지 않는다. */
export const NOTIFICATION_ROW_SHEET_FALLBACK_TITLE = "알림";

/**
 * RN Alert(Android)의 버튼 상한. record-row-actions.ts와 같은 값·같은 이유다(Alert.js가
 * `buttons.slice(0, 3)`으로 말없이 잘라낸다). 지금 이 화면의 버튼은 동작 1개 + 취소 = 2개라
 * 어느 플랫폼에서도 상한에 닿지 않지만, 항목이 늘 때 조용히 잘리지 않도록 계산은 남겨 둔다.
 */
export const ANDROID_ALERT_BUTTON_LIMIT = 3;

export function buildNotificationRowActions(): NotificationRowAction[] {
  return [
    {
      key: "delete",
      label: NOTIFICATION_ROW_DELETE_LABEL,
      shortLabel: "지우기",
      destructive: true
    }
  ];
}

/** RN `accessibilityActions` 배열. 이름은 액션 키 그대로라 핸들러가 문자열을 다시 매핑하지 않는다. */
export function notificationRowAccessibilityActions(
  actions: readonly NotificationRowAction[]
): { name: NotificationRowActionKey; label: string }[] {
  return actions.map((action) => ({ name: action.key, label: action.label }));
}

/**
 * `onAccessibilityAction`이 받은 이름 → 이 행이 실제로 제공하는 동작. 목록에 없는 이름
 * (다른 화면의 액션, OS 표준 액션)은 null로 떨어뜨린다.
 */
export function resolveNotificationRowAction(
  actionName: string,
  actions: readonly NotificationRowAction[]
): NotificationRowActionKey | null {
  const matched = actions.find((action) => action.key === actionName);
  return matched ? matched.key : null;
}

/**
 * 스크린리더 힌트. 롱프레스는 눈에 보이지 않는 제스처라 "여기에 뭔가 더 있다"는 사실 자체를
 * 말해 줘야 한다(record-row-actions.ts의 같은 판단).
 */
export function notificationRowAccessibilityHint(actions: readonly NotificationRowAction[]): string {
  return `길게 누르면 ${actions.map((action) => action.shortLabel).join("·")}를 고를 수 있어요.`;
}

/**
 * 행 전체의 스크린리더 라벨.
 *
 * 롱프레스·커스텀 액션을 얹으려면 바깥 Pressable 하나가 행의 접근성 요소가 되어야 하고(안쪽
 * 공용 ListRow는 접근성 트리에서 감춘다), 그러면 라벨을 명시해야 한다. 인자는 화면이 ListRow에
 * 넘기는 **바로 그 세 문자열**이라 보이는 것과 읽히는 것이 갈릴 수 없다.
 *
 * "새 소식" 점은 이 라벨에 넣지 않는다 — 행 바로 앞의 독립 접근성 요소로 이미 읽히므로
 * (app/notifications.tsx), 여기 넣으면 같은 사실이 두 번 들린다.
 */
export function notificationRowAccessibilityLabel(input: {
  title: string;
  body: string;
  timeLabel: string;
}): string {
  return [input.title, input.body, input.timeLabel].filter((part) => part.trim().length > 0).join(", ");
}

/** 액션시트 버튼 하나. `actionKey`가 null이면 취소(아무 일도 하지 않는다). */
export type NotificationRowAlertButton = {
  label: string;
  actionKey: NotificationRowActionKey | null;
  style?: "cancel" | "destructive";
};

export type NotificationRowActionSheet = {
  title: string;
  message: string;
  buttons: NotificationRowAlertButton[];
  /** Android Alert은 기본이 cancelable:false다 — 취소를 못 넣을 때 반드시 켜야 갇히지 않는다. */
  cancelable: boolean;
};

/**
 * 액션시트(= 이 앱의 관례인 RN Alert 다중 버튼) 구성. 플랫폼별 버튼 상한 흡수 규칙은
 * record-row-actions.ts의 buildRecordRowActionSheet와 같다.
 */
export function buildNotificationRowActionSheet(input: {
  /** 행에 보이는 제목(태명 접두가 붙은 그 문자열). */
  title: string;
  platform: string;
}): NotificationRowActionSheet {
  const buttons: NotificationRowAlertButton[] = buildNotificationRowActions().map((action) => ({
    label: action.label,
    actionKey: action.key,
    ...(action.destructive ? { style: "destructive" as const } : {})
  }));
  const buttonLimit = input.platform === "android" ? ANDROID_ALERT_BUTTON_LIMIT : Number.POSITIVE_INFINITY;
  if (buttons.length < buttonLimit) {
    buttons.push({ label: NOTIFICATION_ROW_CANCEL_LABEL, actionKey: null, style: "cancel" });
  }
  return {
    title: input.title.trim() || NOTIFICATION_ROW_SHEET_FALLBACK_TITLE,
    message: NOTIFICATION_ROW_SHEET_MESSAGE,
    buttons,
    cancelable: true
  };
}
