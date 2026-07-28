import { useQuery } from "@tanstack/react-query";
import { Redirect, router, type Href } from "expo-router";
import { Text, View } from "react-native";
import { fixtureSessionToken, getWeeklyBriefing } from "../src/api/client";
import { useSessionStore } from "../src/stores/session.store";
import { AppScreen, Card, EmptyStateCard, PrimaryButton, ScreenHeader } from "../src/ui";
import { formatKrw } from "../src/money";
import { theme } from "../src/theme";

export default function WeeklyBriefingScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const householdId = useSessionStore((state) => state.defaultHouseholdId);
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const briefing = useQuery({ queryKey: ["weekly-briefing", householdId], enabled: Boolean(token && householdId), queryFn: () => getWeeklyBriefing(token!, householdId!) });
  if (!token || !householdId) return <Redirect href="/launch-animation" />;
  if (briefing.isError) return <AppScreen><ScreenHeader title="가족 주간 브리핑" /><EmptyStateCard title="브리핑을 불러오지 못했어요" actionLabel="다시 시도" onPress={() => briefing.refetch()} /></AppScreen>;
  return (
    <AppScreen>
      <ScreenHeader eyebrow="이번 주 한눈에" title="가족 주간 브리핑" subtitle={briefing.data ? `${briefing.data.weekStart} 기준` : "데이터를 모으고 있어요"} />
      {briefing.data ? <>
        <Card><Text style={titleStyle}>준비 현황</Text><Text style={bodyStyle}>지난주 완료 {briefing.data.sections.completed}개</Text><Text style={bodyStyle}>다음 주 예정 {briefing.data.sections.dueNextWeek}개</Text><Text style={bodyStyle}>담당자 없음 {briefing.data.sections.unassigned}개</Text></Card>
        <Card><Text style={titleStyle}>안전 확인</Text><Text style={bodyStyle}>{briefing.data.sections.safety.length ? `${briefing.data.sections.safety.length}개의 안내를 확인해 주세요.` : "새로운 안전 안내가 없어요."}</Text></Card>
        {briefing.data.sections.financial ? <Card><Text style={titleStyle}>비용</Text><Text style={bodyStyle}>예정 {formatKrw(briefing.data.sections.financial.plannedKrw)}</Text><Text style={bodyStyle}>실제 {formatKrw(briefing.data.sections.financial.actualKrw)}</Text></Card> : null}
        <PrimaryButton label="준비 캘린더 열기" onPress={() => router.push("/preparation-calendar" as Href)} />
      </> : <EmptyStateCard title="브리핑을 생성하고 있어요" actionLabel="잠시만 기다려 주세요" />}
    </AppScreen>
  );
}

const titleStyle = { color: theme.colors.brown, fontSize: 16, fontWeight: "800" } as const;
const bodyStyle = { color: theme.colors.gray600, fontSize: 14 } as const;
