import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { fixtureSessionToken, listNotifications, markNotificationsRead, type NotificationInboxItem } from "../src/api/client";
import { AppIcon, AppScreen, EmptyStateCard, ScreenHeader, semanticColors } from "../src/design-system";
import { notificationRouteHref } from "../src/notifications/route";
import { useSessionStore } from "../src/stores/session.store";
import { theme } from "../src/theme";

const categoryLabels: Record<NotificationInboxItem["category"], string> = {
  safety: "안전·리콜",
  replacement: "교체·반복구매",
  family: "가족 활동",
  budget: "예산",
  invitation: "초대·권한",
  service: "서비스"
};

export default function NotificationsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const queryClient = useQueryClient();
  const inbox = useInfiniteQuery({
    queryKey: ["notifications"],
    enabled: Boolean(token),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listNotifications(token!, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
  const read = useMutation({
    mutationFn: (ids: string[]) => markNotificationsRead(token!, ids),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["notifications"] })
  });
  const items = inbox.data?.pages.flatMap((page) => page.items) ?? [];
  const unreadIds = items.filter((item) => !item.read).map((item) => item.id);

  if (!token) return <Redirect href="/login" />;

  const openNotification = async (item: NotificationInboxItem) => {
    if (!item.read) await read.mutateAsync([item.id]);
    const href = notificationRouteHref(item.route, item.navigation, item.category);
    if (href) router.push(href);
  };

  return (
    <AppScreen>
      <View testID="screen-notifications" accessibilityLabel="screen-notifications" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="알림" title="알림" subtitle="안전 안내와 가족 활동을 한곳에서 확인하세요" />
        {inbox.isLoading ? (
          <EmptyStateCard title="알림을 불러오고 있어요." actionLabel="잠시만요" />
        ) : inbox.isError && items.length === 0 ? (
          <EmptyStateCard title="알림을 불러오지 못했어요." description="연결을 확인하고 다시 시도해 주세요." actionLabel="다시 시도" onPress={() => void inbox.refetch()} />
        ) : items.length === 0 ? (
          <EmptyStateCard
            title="새 알림이 없어요."
            description="안전 알림과 가족 활동이 생기면 여기에 표시됩니다."
            actionLabel="준비 화면 보기"
            onPress={() => router.push("/(tabs)/items")}
          />
        ) : (
          <View style={{ gap: theme.spacing.gap }}>
            {inbox.isError ? (
              <Text accessibilityLiveRegion="polite" style={{ color: semanticColors.warning, fontSize: 12 }}>
                저장된 알림을 보여드리고 있어요. 연결되면 새 알림을 확인합니다.
              </Text>
            ) : null}
            {unreadIds.length > 0 ? (
              <Pressable accessibilityRole="button" disabled={read.isPending} onPress={() => read.mutate(unreadIds)} style={{ alignItems: "center", alignSelf: "flex-end", justifyContent: "center", minHeight: 48, paddingHorizontal: 8 }}>
                <Text style={{ color: semanticColors.actionPrimary, fontSize: 13, fontWeight: "900" }}>현재 목록 모두 읽음</Text>
              </Pressable>
            ) : null}
            {items.map((item) => (
              <Pressable
                accessibilityLabel={`${categoryLabels[item.category]}. ${item.title}. ${item.body}. ${item.read ? "읽음" : "읽지 않음"}`}
                accessibilityRole="button"
                key={item.id}
                onPress={() => void openNotification(item)}
                style={{
                  backgroundColor: item.read ? semanticColors.surface : semanticColors.actionSecondary,
                  borderColor: item.importance === "critical" ? semanticColors.warning : semanticColors.borderSubtle,
                  borderRadius: 16,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: 12,
                  minHeight: 88,
                  padding: 14
                }}
              >
                <AppIcon color={item.importance === "critical" ? semanticColors.warning : semanticColors.actionPrimary} name={item.importance === "critical" ? "alert-octagon-outline" : "bell-outline"} size={24} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: semanticColors.textSecondary, fontSize: 11, fontWeight: "800" }}>{categoryLabels[item.category]} · {new Date(item.occurredAt).toLocaleString("ko-KR")}</Text>
                  <Text style={{ color: semanticColors.textPrimary, fontSize: 15, fontWeight: item.read ? "700" : "900" }}>{item.title}</Text>
                  <Text numberOfLines={2} style={{ color: semanticColors.textSecondary, fontSize: 12, lineHeight: 18 }}>{item.body}</Text>
                  {item.requiresAcknowledgement ? <Text style={{ color: semanticColors.warning, fontSize: 11, fontWeight: "900" }}>준비 화면에서 안전 안내 확인 필요</Text> : null}
                </View>
                {item.route ? <AppIcon color={semanticColors.textDisabled} name="chevron-right" size={22} /> : null}
              </Pressable>
            ))}
            {inbox.hasNextPage ? (
              <Pressable accessibilityRole="button" disabled={inbox.isFetchingNextPage} onPress={() => void inbox.fetchNextPage()} style={{ alignItems: "center", borderColor: semanticColors.borderSubtle, borderRadius: 14, borderWidth: 1, justifyContent: "center", minHeight: 48 }}>
                <Text style={{ color: semanticColors.actionPrimary, fontSize: 13, fontWeight: "900" }}>{inbox.isFetchingNextPage ? "불러오는 중" : "알림 더 보기"}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </AppScreen>
  );
}
