import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { theme } from "../theme";
import { selectUnreadCount, useNotificationStore } from "./notification.store";

/**
 * NOTI-102: the home-header bell hidden by UX-5B-8 (알림 화면이 스텁이던 시절), restored as a real
 * feature. Shows a small coral unread-count badge and routes to /notifications. Rendered in both
 * a session and the logged-out preview -- the preview simply has no notifications, so no badge,
 * and the screen shows its empty state.
 */
export function NotificationBell() {
  const unreadCount = useNotificationStore((state) => selectUnreadCount(state.entries));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `알림, 새 알림 ${unreadCount}개` : "알림"}
      hitSlop={NOTIFICATION_BELL_HIT_SLOP}
      onPress={() => router.push("/notifications")}
      // T1(디자인 시스템): 누르는 동안만 흐려지는 시각 피드백 — 휴지 렌더는 bellButtonStyle
      // 그대로다(레이아웃 상수는 아래 as const 선언에 남아 GAP-065 #7 계약이 계속 읽는다).
      style={({ pressed }) => [bellButtonStyle, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={bellGlyphStyle}>🔔</Text>
      {unreadCount > 0 ? (
        <View style={bellBadgeStyle}>
          <Text style={bellBadgeTextStyle}>{unreadCount > 9 ? "9+" : String(unreadCount)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * GAP-065 #7: 36dp 정사각 + 6 = 48(theme.touchTarget). 홈 헤더의 알림 입구는 **이웃 컨트롤이
 * 없는 자리**라(제목 블록은 텍스트고, 반대편은 화면 여백이다) 네 변을 같이 넓혀도 다른 것의
 * 몸에 닿지 않는다 — 라운드 64가 칩에서 세로만 넓힌 이유(옆 칩과 겹침)가 여기엔 없다.
 * 값은 src/ui.tsx의 프리미티브 주석과 같은 규율을 따른다(레이아웃 속성 무접촉 = 렌더 불변).
 */
const NOTIFICATION_BELL_HIT_SLOP = 6;

const bellButtonStyle = {
  alignItems: "center",
  height: 36,
  justifyContent: "center",
  width: 36
} as const;

const bellGlyphStyle = {
  color: theme.colors.brown,
  fontSize: 20
} as const;

const bellBadgeStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.mainCoral,
  borderColor: theme.colors.white,
  borderRadius: 9,
  borderWidth: 1,
  height: 17,
  justifyContent: "center",
  minWidth: 17,
  paddingHorizontal: 3,
  position: "absolute",
  right: 1,
  top: 1
} as const;

const bellBadgeTextStyle = {
  color: theme.colors.white,
  fontSize: 10,
  fontWeight: "800",
  lineHeight: 12
} as const;
