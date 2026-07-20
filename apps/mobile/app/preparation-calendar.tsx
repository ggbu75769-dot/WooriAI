import { useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { Text, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { fixtureSessionToken, getPreparationCalendar } from "../src/api/client";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";
import { AppIcon, AppScreen, EmptyStateCard, ListRow, ScreenHeader } from "../src/ui";
import { theme } from "../src/theme";

export default function PreparationCalendarScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const householdId = useSessionStore((state) => state.defaultHouseholdId);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const month = getSeoulToday().slice(0, 7);
  const calendar = useQuery({
    queryKey: ["preparation-calendar", householdId, childId, month],
    enabled: Boolean(token && householdId),
    queryFn: () => getPreparationCalendar(token!, householdId!, month, childId ?? undefined)
  });
  if (!token || !householdId) return <Redirect href="/launch-animation" />;
  return (
    <AppScreen>
      <ScreenHeader eyebrow="가족 준비" title="준비 캘린더" subtitle={`${month} · Asia/Seoul`} />
      {calendar.isLoading ? <EmptyStateCard title="준비 일정을 불러오고 있어요" actionLabel="잠시만 기다려 주세요" /> : null}
      {calendar.isError ? <EmptyStateCard title="준비 일정을 불러오지 못했어요" actionLabel="다시 시도" onPress={() => calendar.refetch()} /> : null}
      {calendar.data && calendar.data.events.length === 0 ? <EmptyStateCard title="이번 달에 예정된 준비가 없어요" actionLabel="준비 항목 보기" onPress={() => router.push("/(tabs)/items")} /> : null}
      <View style={{ gap: 8 }}>
        {calendar.data?.events.map((event) => (
          <ListRow
            key={event.eventId}
            icon={<AppIcon color={event.status === "overdue" ? theme.colors.danger : theme.colors.coral[600]} name={event.type === "replacement" ? "swap-horizontal" : event.type === "recurring" ? "repeat" : "calendar-check-outline"} size={21} />}
            title={event.itemName}
            subtitle={`${event.date} · ${event.type === "replacement" ? "교체" : event.type === "recurring" ? "반복구매" : "준비"}`}
            value={event.status === "overdue" ? "지연" : event.status === "today" ? "오늘" : "예정"}
            onPress={() => router.push(`/items/${event.itemDefinitionId}`)}
          />
        ))}
      </View>
      <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>상태는 글자와 아이콘으로도 구분돼요.</Text>
    </AppScreen>
  );
}
