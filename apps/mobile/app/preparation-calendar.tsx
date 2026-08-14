import { useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { KoreanText as Text } from "../src/design-system/components/KoreanText";
import { getSeoulToday } from "@wooriai/domain";
import { fixtureSessionToken, getPreparationCalendar } from "../src/api/client";
import { householdIdForFeatureScope, useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";
import { AppIcon, AppScreen, EmptyStateCard, ListRow, ScreenHeader } from "../src/ui";
import { theme } from "../src/theme";

function shiftMonth(value: string, offset: number) {
  const [year, month] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${year}년 ${Number(month)}월`;
}

export default function PreparationCalendarScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const defaultHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const selectedChildHouseholdId = useSelectedChildStore((state) => state.selectedChildHouseholdId);
  const householdId = householdIdForFeatureScope(
    childId,
    selectedChildHouseholdId,
    defaultHouseholdId,
    isTestSession
  );
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const currentMonth = getSeoulToday().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const calendar = useQuery({
    queryKey: ["preparation-calendar", householdId, childId, month],
    enabled: Boolean(token && householdId),
    queryFn: () => getPreparationCalendar(token!, householdId!, month, childId ?? undefined)
  });
  if (!token || !householdId) return <Redirect href="/launch-animation" />;
  return (
    <AppScreen>
      <ScreenHeader eyebrow="가족 준비" onBack={() => router.back()} title="준비 캘린더" subtitle="모든 일정은 Asia/Seoul 기준이에요." />
      <View accessibilityLabel="준비 캘린더 월 선택" style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable accessibilityLabel="이전 달" accessibilityRole="button" onPress={() => setMonth((value) => shiftMonth(value, -1))} style={({ pressed }) => ({ alignItems: "center", height: 48, justifyContent: "center", opacity: pressed ? 0.72 : 1, width: 48 })}>
          <AppIcon color={theme.colors.coral[700]} name="chevron-left" size={24} />
        </Pressable>
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: "800" }}>{monthLabel(month)}</Text>
          {month !== currentMonth ? (
            <Pressable accessibilityRole="button" onPress={() => setMonth(currentMonth)} style={({ pressed }) => ({ minHeight: 36, opacity: pressed ? 0.72 : 1, paddingHorizontal: 10, paddingVertical: 8 })}>
              <Text style={{ color: theme.colors.coral[700], fontSize: 13, fontWeight: "800" }}>이번 달로 돌아가기</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable accessibilityLabel="다음 달" accessibilityRole="button" onPress={() => setMonth((value) => shiftMonth(value, 1))} style={({ pressed }) => ({ alignItems: "center", height: 48, justifyContent: "center", opacity: pressed ? 0.72 : 1, width: 48 })}>
          <AppIcon color={theme.colors.coral[700]} name="chevron-right" size={24} />
        </Pressable>
      </View>
      {calendar.isLoading ? <EmptyStateCard title="준비 일정을 불러오고 있어요" actionLabel="잠시만 기다려 주세요" /> : null}
      {calendar.isError ? <EmptyStateCard title="준비 일정을 불러오지 못했어요" actionLabel="다시 시도" onPress={() => calendar.refetch()} /> : null}
      {calendar.data && calendar.data.events.length === 0 ? <EmptyStateCard title={`${monthLabel(month)}에 예정된 준비가 없어요`} actionLabel="준비 항목 보기" onPress={() => router.push("/(tabs)/items")} /> : null}
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
