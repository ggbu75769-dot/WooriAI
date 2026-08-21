import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { listChildren, LOCAL_SESSION_TOKEN } from "../src/api/client";
import { itemTemplateIdFromPurchaseDedupeKey } from "../src/notifications/generators";
import {
  formatNotificationRowTitle,
  resolveNotificationChildLabel
} from "../src/notifications/notification-child-label";
import { useNotificationStore, type AppNotification } from "../src/notifications/notification.store";
import { formatRelativeTime } from "../src/notifications/relative-time";
import { useSessionStore } from "../src/stores/session.store";
import { theme } from "../src/theme";
import { AppScreen, EmptyStateCard, ListRow, ScreenHeader } from "../src/ui";

/**
 * NOTI-102 인앱 알림 센터: lists the client-side notifications persisted in
 * src/notifications/notification.store.ts (fed by the home screen's evaluation hook). Opening the
 * screen marks everything read (the home bell badge clears); tapping a row routes to the surface
 * the notification is about; "모두 지우기" empties the list without re-arming dedupe keys.
 *
 * R20-C 다자녀 표시: each entry carries the `childId` R19-D stamps on it, so in a household with
 * 2+ children the row title is prefixed with that child's 태명 ("다온이 · 이번 달 예산의 80%를
 * 사용했어요") -- previously two children produced two identical-looking budget rows in the same
 * month. Names come from the shared `["children"]` query cache (same key as
 * app/settings/children.tsx, so opening this screen usually costs no extra request). All the
 * "don't show it" cases -- one child, a pre-R19-D entry without childId, a child the list can't
 * resolve -- live in src/notifications/notification-child-label.ts and leave the row untouched
 * rather than rendering an empty prefix.
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

  // R20-C: child names for the multi-child row prefix. Shares the ["children"] query key with
  // app/settings/children.tsx / the onboarding recovery path, so this reads the cache instead of
  // refetching in the common case, and stays disabled (data undefined -> no prefix) in the
  // logged-out preview.
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childrenQuery = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  const householdChildren = childrenQuery.data?.children;

  // Read marks on open: whenever this screen gains focus, everything becomes read (no-op when
  // nothing is unread -- markAllNotificationsRead returns the same array then).
  useFocusEffect(
    useCallback(() => {
      markAllRead();
    }, [markAllRead])
  );

  // A11Y-117: 모두 지우기는 되돌릴 수 없는 파괴적 동작(dedupe 키가 유지되어 지운 알림은 다시
  // 오지 않는다) -- family/index.tsx의 구성원 삭제와 같은 관례대로 즉시 실행 대신 확인
  // Alert를 거친다.
  const confirmClearAll = () => {
    Alert.alert("알림을 모두 지울까요?", "지운 알림은 다시 볼 수 없어요.", [
      { text: "취소", style: "cancel" },
      { text: "모두 지우기", style: "destructive", onPress: () => clearAll() }
    ]);
  };

  const now = Date.now();

  return (
    <AppScreen>
      <View testID="screen-notifications" style={{ gap: theme.spacing.section }}>
        <ScreenHeader
          eyebrow="알림"
          title="알림"
          subtitle="예산과 아이 성장 소식을 모아 보여드려요"
          action={
            entries.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="알림 모두 지우기" hitSlop={12} onPress={confirmClearAll}>
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
          entries.map((entry) => {
            const childLabel = resolveNotificationChildLabel(entry.childId, householdChildren);
            return (
              <ListRow
                key={entry.id}
                icon={notificationIconByType[entry.type]}
                // The 태명 prefix is part of the title text, so it is announced as part of the
                // row's accessibility label too (ListRow reads its Text children).
                title={formatNotificationRowTitle(entry.title, childLabel)}
                subtitle={entry.body}
                value={formatRelativeTime(entry.createdAt, now)}
                onPress={() => {
                  markRead(entry.id);
                  openNotification(entry);
                }}
              />
            );
          })
        )}
      </View>
    </AppScreen>
  );
}
