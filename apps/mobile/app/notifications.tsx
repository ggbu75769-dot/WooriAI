import { useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { itemTemplateIdFromPurchaseDedupeKey } from "../src/notifications/generators";
import { useNotificationStore, type AppNotification } from "../src/notifications/notification.store";
import { formatRelativeTime } from "../src/notifications/relative-time";
import { theme } from "../src/theme";
import { AppScreen, EmptyStateCard, ListRow, ScreenHeader } from "../src/ui";

/**
 * NOTI-102 인앱 알림 센터: lists the client-side notifications persisted in
 * src/notifications/notification.store.ts (fed by the home screen's evaluation hook). Opening the
 * screen marks everything read (the home bell badge clears); tapping a row routes to the surface
 * the notification is about; "모두 지우기" empties the list without re-arming dedupe keys.
 */

const notificationIconByType: Record<AppNotification["type"], string> = {
  budget_80: "▮",
  budget_100: "▮",
  stage_transition: "☆",
  purchase_pending: "▣",
  weekly_summary: "▮"
};

function openNotification(entry: AppNotification) {
  if (entry.type === "budget_80" || entry.type === "budget_100" || entry.type === "weekly_summary") {
    router.push("/budget");
    return;
  }
  if (entry.type === "stage_transition") {
    router.push("/(tabs)/items");
    return;
  }
  const itemTemplateId = itemTemplateIdFromPurchaseDedupeKey(entry.dedupeKey);
  if (itemTemplateId) {
    router.push(`/items/${itemTemplateId}`);
    return;
  }
  router.push("/(tabs)/items");
}

export default function NotificationsScreen() {
  const entries = useNotificationStore((state) => state.entries);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const markRead = useNotificationStore((state) => state.markRead);
  const clearAll = useNotificationStore((state) => state.clearAll);

  // Read marks on open: whenever this screen gains focus, everything becomes read (no-op when
  // nothing is unread -- markAllNotificationsRead returns the same array then).
  useFocusEffect(
    useCallback(() => {
      markAllRead();
    }, [markAllRead])
  );

  const now = Date.now();

  return (
    <AppScreen>
      <View testID="screen-notifications" accessibilityLabel="screen-notifications" style={{ gap: theme.spacing.section }}>
        <ScreenHeader
          eyebrow="알림"
          title="알림"
          subtitle="예산과 아이 성장 소식을 모아 보여드려요"
          action={
            entries.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="알림 모두 지우기" onPress={() => clearAll()}>
                <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>모두 지우기</Text>
              </Pressable>
            ) : undefined
          }
        />
        {entries.length === 0 ? (
          <EmptyStateCard
            title="아직 알림이 없어요. 예산과 아이 성장, 구매 확인 소식이 여기에 따뜻하게 모일 거예요."
            actionLabel="뒤로가기"
            onPress={() => router.back()}
          />
        ) : (
          entries.map((entry) => (
            <ListRow
              key={entry.id}
              icon={notificationIconByType[entry.type]}
              title={entry.title}
              subtitle={entry.body}
              value={formatRelativeTime(entry.createdAt, now)}
              onPress={() => {
                markRead(entry.id);
                openNotification(entry);
              }}
            />
          ))
        )}
      </View>
    </AppScreen>
  );
}
