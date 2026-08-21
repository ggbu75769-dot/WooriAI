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
      hitSlop={4}
      onPress={() => router.push("/notifications")}
      style={bellButtonStyle}
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
