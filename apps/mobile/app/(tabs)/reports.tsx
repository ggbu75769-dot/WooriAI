import { useEffect, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, RefreshControl, Share, StyleSheet, Text, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import {
  getCategoryReport,
  getCumulativeReport,
  getHome,
  getMilestoneReport,
  getMonthlyReport,
  getYearlyReport,
  listCategories,
  LOCAL_SESSION_TOKEN
} from "../../src/api/client";
import { buildCategoryNameLookup } from "../../src/categories";
import { formatKrw } from "../../src/money";
import { buildMilestoneShareMessage } from "../../src/reports/milestone-share";
import { canGoToNextPeriod, periodLabelForOffset, type PeriodUnit } from "../../src/period-navigation";
import { usePullToRefresh } from "../../src/query/use-pull-to-refresh";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { announceForA11y, AppScreen, Card, DonutChartCard, EmptyStateCard, LineChartCard, SegmentedControl } from "../../src/ui";
import { SkeletonCard } from "../../src/ui/Skeleton";
import { theme } from "../../src/theme";
import { ReportPixelStyles } from "../../src/pixelLock/styles";

const reportReferenceScreenId = "pixel-screen-REP-001 REP-001 · REP-002";
const previewReportTotalKrw = 1_245_700;
const previewCumulativeTotalKrw = 1_245_700;
const reportReferenceHorizontalOffset = -16;
const reportReferenceVerticalOffset = -4;
function reportReferenceScaleFrameStyle() {
  return {
    transform: [
      { translateX: ReportPixelStyles.horizontalOffset },
      { translateY: ReportPixelStyles.topOffset },
      { scale: ReportPixelStyles.scale }
    ]
  } as const;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addYears(date: Date, years: number) {
  return new Date(date.getFullYear() + years, date.getMonth(), 1);
}

function startOfQuarter(date: Date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function yearMonthOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportsScreen() {
  const [period, setPeriod] = useState("월간");
  const [monthOffset, setMonthOffset] = useState(0);
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const hasSession = Boolean(authToken && childId);

  // MOB-117 당겨서 새로고침: 이 화면의 쿼리 키는 모두 ["report", ...]로 시작한다(월간/이전달/
  // 누적/카테고리/분기/연간/추이/100일). ["home"]은 100일 리포트 공유 문구의 아이 닉네임이
  // 읽는 캐시라 함께 갱신한다. invalidate는 활성 쿼리 refetch 완료까지 resolve된다.
  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["report"] }),
      queryClient.invalidateQueries({ queryKey: ["home"] })
    ])
  );

  // Reset navigation offset whenever the selected period changes so "다음/이전"
  // always starts from the current month/quarter/year for the newly selected unit.
  useEffect(() => {
    setMonthOffset(0);
  }, [period]);

  // Use the Seoul-local calendar day (not the device's local timezone) so report periods
  // line up with the server, which computes "이번 달/분기/연도" in KST.
  const baseDate = hasSession ? new Date(`${getSeoulToday()}T00:00:00`) : new Date(2025, 4, 1);

  const reportDate = period === "월간" ? addMonths(baseDate, monthOffset) : baseDate;
  const reportYearMonth = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, "0")}`;
  const reportMonthLabel = `${reportDate.getFullYear()}년 ${reportDate.getMonth() + 1}월`;

  const quarterStart = period === "분기" ? addMonths(startOfQuarter(baseDate), monthOffset * 3) : startOfQuarter(baseDate);
  const quarterMonths = [quarterStart, addMonths(quarterStart, 1), addMonths(quarterStart, 2)];
  const quarterLabel = `${quarterStart.getFullYear()}년 ${Math.floor(quarterStart.getMonth() / 3) + 1}분기`;

  const yearStart = period === "연간" ? addYears(new Date(baseDate.getFullYear(), 0, 1), monthOffset) : new Date(baseDate.getFullYear(), 0, 1);
  const yearLabel = `${yearStart.getFullYear()}년`;

  const periodLabel = period === "월간" ? reportMonthLabel : period === "분기" ? quarterLabel : yearLabel;

  // A11Y-117: 월/분기/연 이동 시 새 기간 라벨을 TalkBack으로 읽어주고, 현재 기간(offset 0)
  // 이후로는 "다음" 이동을 막는다(미래 빈 화면 무한 이동 제거) -- src/period-navigation.ts.
  const periodUnit: PeriodUnit = period === "월간" ? "month" : period === "분기" ? "quarter" : "year";
  const canGoNextPeriod = canGoToNextPeriod(monthOffset);
  const goToPreviousPeriod = () => {
    setMonthOffset((value) => value - 1);
    announceForA11y(periodLabelForOffset(baseDate, periodUnit, monthOffset - 1));
  };
  const goToNextPeriod = () => {
    if (!canGoNextPeriod) return;
    setMonthOffset((value) => value + 1);
    announceForA11y(periodLabelForOffset(baseDate, periodUnit, monthOffset + 1));
  };

  const previousMonthDate = addMonths(reportDate, -1);
  const previousMonthYearMonth = yearMonthOf(previousMonthDate);

  const monthly = useQuery({
    queryKey: ["report", "monthly", childId, reportYearMonth],
    enabled: Boolean(authToken && childId),
    queryFn: () => getMonthlyReport(authToken!, childId!, reportYearMonth)
  });
  const previousMonth = useQuery({
    queryKey: ["report", "monthly", childId, previousMonthYearMonth],
    enabled: Boolean(authToken && childId && period === "월간"),
    queryFn: () => getMonthlyReport(authToken!, childId!, previousMonthYearMonth)
  });
  const cumulative = useQuery({
    queryKey: ["report", "cumulative", childId],
    enabled: Boolean(authToken && childId),
    queryFn: () => getCumulativeReport(authToken!, childId!)
  });
  // REP-104: 카테고리 비중도 선택된 기간을 그대로 따른다 -- 월간은 yearMonth, 분기는
  // year+quarter, 연간은 year 필터로 서버(및 로컬 데모 백엔드)가 해당 기간만 집계한다.
  const categoryPeriod =
    period === "월간"
      ? { yearMonth: reportYearMonth }
      : period === "분기"
        ? { year: quarterStart.getFullYear(), quarter: Math.floor(quarterStart.getMonth() / 3) + 1 }
        : { year: yearStart.getFullYear() };
  const activeCategory = useQuery({
    queryKey: ["report", "category", childId, categoryPeriod],
    enabled: Boolean(authToken && childId),
    queryFn: () => getCategoryReport(authToken!, childId!, categoryPeriod)
  });
  // 카테고리 리포트는 categoryId만 내려주므로 이름은 GET /categories로 따로 해석한다. 서버가
  // 시드하는 정식 12개 카테고리는 고정 id가 없어(DB마다 랜덤 UUID) 모바일의 정적 8타일 매핑
  // (categoryNameFor)으로는 전부 "기타"로 보였다 -- src/categories.ts의 buildCategoryNameLookup
  // 주석 참고. 캐시 키는 지출 수정 화면(app/expenses/[expenseId].tsx)과 같은 ["categories"]라
  // 두 화면이 같은 응답을 공유하고, 오프라인/실패 시에는 마지막 성공 목록(react-query 캐시)이
  // 그대로 쓰이며 그마저 없으면 기존 정적 매핑으로 폴백한다.
  const categories = useQuery({
    queryKey: ["categories"],
    enabled: Boolean(authToken),
    staleTime: 5 * 60 * 1000,
    queryFn: () => listCategories(authToken!)
  });
  const categoryName = buildCategoryNameLookup(categories.data?.categories);
  const categoryCardTitle = period === "월간" ? `${reportDate.getMonth() + 1}월 카테고리 비중` : `${periodLabel} 카테고리 비중`;
  const quarterQueries = useQueries({
    queries: quarterMonths.map((date) => {
      const ym = yearMonthOf(date);
      return {
        queryKey: ["report", "monthly", childId, ym],
        enabled: Boolean(authToken && childId && period === "분기"),
        queryFn: () => getMonthlyReport(authToken!, childId!, ym)
      };
    })
  });
  const yearly = useQuery({
    queryKey: ["report", "yearly", childId, yearStart.getFullYear()],
    enabled: Boolean(authToken && childId && period === "연간"),
    queryFn: () => getYearlyReport(authToken!, childId!, yearStart.getFullYear())
  });

  // REP-103: 100일 비용 리포트 for the 누적 section. The server answers 400
  // MILESTONE_UNAVAILABLE for a child without a birthDate (pregnant/manual stage), so an
  // error simply hides the card instead of surfacing a retry UI -- retry: false keeps that
  // expected 400 from being re-fetched. A birthDate under 100 days ago comes back as a
  // partial window (partial: true + daysCovered) and still shows the card. Demo (local
  // test) sessions are served by the local backend's fixture-based milestone report.
  const milestone = useQuery({
    queryKey: ["report", "milestone", childId, "d100"],
    enabled: Boolean(authToken && childId),
    retry: false,
    queryFn: () => getMilestoneReport(authToken!, childId!, "d100")
  });
  // Shares the home screen's query cache entry -- only used for the child nickname in the
  // milestone share message.
  const home = useQuery({
    queryKey: ["home", childId],
    enabled: Boolean(authToken && childId),
    queryFn: () => getHome(authToken!, childId!)
  });
  const milestoneReport = milestone.data;
  const milestoneTopCategory = milestoneReport?.topCategories[0];
  const milestoneChildName = home.data?.child.nickname ?? "우리 아이";
  const shareMilestoneReport = async () => {
    if (!milestoneReport) return;
    try {
      await Share.share({ message: buildMilestoneShareMessage(milestoneReport, milestoneChildName) });
    } catch {
      // Share sheet dismissed/unavailable -- nothing to recover.
    }
  };

  // Trailing 6 months (current month included) feeding the 월간 tab's line chart, following
  // the same useQueries pattern as quarterQueries above.
  const monthlyTrendMonths = Array.from({ length: 6 }, (_, index) => addMonths(reportDate, index - 5));
  const monthlyTrendQueries = useQueries({
    queries: monthlyTrendMonths.map((date) => {
      const ym = yearMonthOf(date);
      return {
        queryKey: ["report", "monthly", childId, ym],
        enabled: Boolean(authToken && childId && period === "월간"),
        queryFn: () => getMonthlyReport(authToken!, childId!, ym)
      };
    })
  });

  const monthlyTotal = monthly.data?.totalExpenseKrw ?? previewReportTotalKrw;
  const cumulativeTotal = cumulative.data?.totalExpenseKrw ?? previewCumulativeTotalKrw;

  const quarterTotal = quarterQueries.reduce((sum, query) => sum + (query.data?.totalExpenseKrw ?? 0), 0);
  const quarterIsLoading = quarterQueries.some((query) => query.isLoading);
  const quarterIsError = quarterQueries.some((query) => query.isError);
  const refetchQuarter = () => quarterQueries.forEach((query) => query.refetch());

  const activeIsLoading = period === "월간" ? monthly.isLoading : period === "분기" ? quarterIsLoading : yearly.isLoading;
  const activeIsError = period === "월간" ? monthly.isError : period === "분기" ? quarterIsError : yearly.isError;
  const activeTotal = period === "월간" ? monthly.data?.totalExpenseKrw : period === "분기" ? quarterTotal : yearly.data?.totalExpenseKrw;
  const refetchActive = () => {
    if (period === "월간") monthly.refetch();
    else if (period === "분기") refetchQuarter();
    else yearly.refetch();
  };

  // The delta/tip comparisons only make sense against last month while the 월간 tab is active.
  const hasDeltaData = hasSession && period === "월간" && monthly.isSuccess && previousMonth.isSuccess;
  const deltaPercent =
    hasDeltaData && previousMonth.data!.totalExpenseKrw > 0
      ? Math.round(((monthly.data!.totalExpenseKrw - previousMonth.data!.totalExpenseKrw) / previousMonth.data!.totalExpenseKrw) * 1000) / 10
      : null;
  const deltaLabel = !hasSession ? undefined : deltaPercent === null ? null : `${deltaPercent > 0 ? "+" : ""}${deltaPercent}%`;

  const categoryData = activeCategory.data?.categories ?? [];
  const categorySegments = activeCategory.data
    ? categoryData.map((entry) => ({ label: categoryName(entry.categoryId), amountKrw: entry.amountKrw }))
    : undefined;

  const tipDeltaKrw = hasDeltaData ? previousMonth.data!.totalExpenseKrw - monthly.data!.totalExpenseKrw : null;
  const showTip = hasSession && period === "월간" && tipDeltaKrw !== null && tipDeltaKrw !== 0;

  // Real per-period amounts for the line chart's trend, only once every underlying query for
  // the active tab has resolved (otherwise leave undefined so LineChartCard keeps its
  // decorative placeholder line instead of drawing a series full of zeros mid-fetch).
  const monthlyTrendPoints =
    period === "월간" && monthlyTrendQueries.every((query) => query.isSuccess)
      ? monthlyTrendQueries.map((query) => query.data!.totalExpenseKrw)
      : undefined;
  const quarterPoints =
    period === "분기" && quarterQueries.every((query) => query.isSuccess)
      ? quarterQueries.map((query) => query.data!.totalExpenseKrw)
      : undefined;
  const yearlyPoints =
    period === "연간" && yearly.isSuccess ? yearly.data!.monthlyTotals.map((entry) => entry.totalExpenseKrw) : undefined;
  const activePoints = period === "월간" ? monthlyTrendPoints : period === "분기" ? quarterPoints : yearlyPoints;

  return (
    <AppScreen
      refreshControl={
        // 비세션 미리보기에는 새로고침할 서버 데이터가 없으므로 붙이지 않는다 (MOB-117).
        hasSession ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.mainCoral}
            colors={[theme.colors.mainCoral]}
          />
        ) : undefined
      }
    >
      <View style={reportReferenceScaleFrameStyle()}>
        <View testID={reportReferenceScreenId} style={reportReferenceFrameStyle}>
          <Text style={reportReferenceHeaderStyle}>리포트</Text>

          <SegmentedControl options={["월간", "분기", "연간"]} value={period} onChange={setPeriod} />

          <View style={reportReferencePeriodRowStyle}>
            {period === "월간" ? (
              <>
                <Pressable accessibilityLabel="이전 달" accessibilityRole="button" hitSlop={12} onPress={goToPreviousPeriod}>
                  <Text style={reportReferencePeriodArrowStyle}>‹</Text>
                </Pressable>
                <Text style={reportReferencePeriodTextStyle}>{periodLabel}</Text>
                <Pressable
                  accessibilityLabel="다음 달"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canGoNextPeriod }}
                  disabled={!canGoNextPeriod}
                  hitSlop={12}
                  onPress={goToNextPeriod}
                >
                  <Text style={canGoNextPeriod ? reportReferencePeriodArrowStyle : reportReferencePeriodArrowDisabledStyle}>›</Text>
                </Pressable>
              </>
            ) : period === "분기" ? (
              <>
                <Pressable accessibilityLabel="이전 분기" accessibilityRole="button" hitSlop={12} onPress={goToPreviousPeriod}>
                  <Text style={reportReferencePeriodArrowStyle}>‹</Text>
                </Pressable>
                <Text style={reportReferencePeriodTextStyle}>{periodLabel}</Text>
                <Pressable
                  accessibilityLabel="다음 분기"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canGoNextPeriod }}
                  disabled={!canGoNextPeriod}
                  hitSlop={12}
                  onPress={goToNextPeriod}
                >
                  <Text style={canGoNextPeriod ? reportReferencePeriodArrowStyle : reportReferencePeriodArrowDisabledStyle}>›</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable accessibilityLabel="이전 연도" accessibilityRole="button" hitSlop={12} onPress={goToPreviousPeriod}>
                  <Text style={reportReferencePeriodArrowStyle}>‹</Text>
                </Pressable>
                <Text style={reportReferencePeriodTextStyle}>{periodLabel}</Text>
                <Pressable
                  accessibilityLabel="다음 연도"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canGoNextPeriod }}
                  disabled={!canGoNextPeriod}
                  hitSlop={12}
                  onPress={goToNextPeriod}
                >
                  <Text style={canGoNextPeriod ? reportReferencePeriodArrowStyle : reportReferencePeriodArrowDisabledStyle}>›</Text>
                </Pressable>
              </>
            )}
          </View>

          {!hasSession ? (
            <>
              <LineChartCard title="총 지출" value={formatKrw(monthlyTotal)} />
              <DonutChartCard title="카테고리 비중" />

              <Card style={reportReferenceTipCardStyle}>
                <Text style={reportReferenceTipTitleStyle}>이번 달 절약 팁</Text>
                <Text style={reportReferenceTipBodyStyle}>지난 달보다 112,000원을 절약했어요!</Text>
                <Text style={reportReferenceTipBodyStyle}>절약 습관 최고예요!</Text>
              </Card>

              <Card style={reportReferenceMemoryCardStyle}>
                <Text style={reportReferenceMemoryTitleStyle}>다온이와의 오늘도 소중한 하루였어요</Text>
                <Text style={reportReferenceMemoryBodyStyle}>누적 기록 {formatKrw(cumulativeTotal)}</Text>
              </Card>
            </>
          ) : activeIsLoading ? (
            // UX-5B-5 (D6): 가짜 버튼이 달린 EmptyStateCard 대신 스켈레톤 로딩.
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : activeIsError ? (
            <EmptyStateCard
              title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
              actionLabel="다시 시도"
              onPress={refetchActive}
            />
          ) : (
            <>
              <LineChartCard title="총 지출" value={formatKrw(activeTotal ?? 0)} deltaLabel={deltaLabel} points={activePoints} />

              {activeCategory.isLoading ? (
                <SkeletonCard />
              ) : activeCategory.isError ? (
                <EmptyStateCard
                  title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
                  actionLabel="다시 시도"
                  onPress={() => activeCategory.refetch()}
                />
              ) : categoryData.length === 0 ? (
                <EmptyStateCard
                  title="첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요."
                  actionLabel="지출 기록하기"
                  onPress={() => router.push("/expenses/new")}
                />
              ) : (
                // 월간/분기/연간 모두 categoryPeriod로 해당 기간만 집계한 비중을 보여준다 (REP-104).
                <DonutChartCard title={categoryCardTitle} segments={categorySegments} />
              )}

              {showTip ? (
                <Card style={reportReferenceTipCardStyle}>
                  <Text style={reportReferenceTipTitleStyle}>이번 달 절약 팁</Text>
                  {tipDeltaKrw !== null && tipDeltaKrw > 0 ? (
                    <>
                      <Text style={reportReferenceTipBodyStyle}>지난 달보다 {formatKrw(tipDeltaKrw)}을 절약했어요!</Text>
                      <Text style={reportReferenceTipBodyStyle}>절약 습관 최고예요!</Text>
                    </>
                  ) : (
                    <Text style={reportReferenceTipBodyStyle}>
                      지난 달보다 {formatKrw(Math.abs(tipDeltaKrw ?? 0))} 더 썼어요. 다음 구매 전에 같이 확인해 볼까요?
                    </Text>
                  )}
                </Card>
              ) : null}

              {cumulative.isLoading ? (
                <SkeletonCard />
              ) : cumulative.isError ? (
                <EmptyStateCard
                  title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
                  actionLabel="다시 시도"
                  onPress={() => cumulative.refetch()}
                />
              ) : cumulative.data ? (
                <Card style={reportReferenceMemoryCardStyle}>
                  <Text style={reportReferenceMemoryTitleStyle}>오늘도 소중한 하루였어요</Text>
                  <Text style={reportReferenceMemoryBodyStyle}>누적 기록 {formatKrw(cumulative.data.totalExpenseKrw)}</Text>
                </Card>
              ) : null}

              {/* REP-103: 100일 비용 리포트 카드 -- 생년월일 없는 아이(400 MILESTONE_UNAVAILABLE)는 숨김,
                  100일 미만이면 partial 상태로 지금까지의 기록을 보여준다. */}
              {milestone.isSuccess && milestoneReport ? (
                <Card style={reportMilestoneCardStyle}>
                  <Text style={reportReferenceMemoryTitleStyle}>100일 리포트</Text>
                  <Text style={reportReferenceMemoryBodyStyle}>
                    {milestoneReport.partial
                      ? `태어나서 ${milestoneReport.daysCovered}일째 기록 중 · ${formatKrw(milestoneReport.totalKrw)}`
                      : `태어나서 100일 동안 ${formatKrw(milestoneReport.totalKrw)}`}
                  </Text>
                  {milestoneTopCategory ? (
                    <Text style={reportReferenceMemoryBodyStyle}>가장 많이 든 건 {milestoneTopCategory.name} 💛</Text>
                  ) : null}
                  <Pressable
                    accessibilityLabel="100일 리포트 공유하기"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={shareMilestoneReport}
                    style={reportMilestoneShareButtonStyle}
                  >
                    <Text style={reportMilestoneShareButtonTextStyle}>공유하기</Text>
                  </Pressable>
                </Card>
              ) : null}
            </>
          )}
        </View>
      </View>
    </AppScreen>
  );
}

const reportReferenceFrameStyle = {
  gap: 18,
  transform: [{ translateX: reportReferenceHorizontalOffset }, { translateY: reportReferenceVerticalOffset }]
};

const reportReferenceHeaderStyle = {
  color: theme.colors.gray900,
  fontSize: 22,
  fontWeight: "800",
  lineHeight: 30,
  textAlign: "center"
} as const;

const reportReferencePeriodRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
  minHeight: 26,
  paddingHorizontal: 6
} as const;

const reportReferencePeriodArrowStyle = {
  color: theme.colors.gray900,
  fontSize: 24,
  fontWeight: "900",
  lineHeight: 28
} as const;

// A11Y-117: 다음 화살표 dim (현재 기간에서 미래 이동 불가 -- 색만 gray300으로).
const reportReferencePeriodArrowDisabledStyle = {
  ...reportReferencePeriodArrowStyle,
  color: theme.colors.gray300
} as const;

const reportReferencePeriodTextStyle = {
  color: theme.colors.brown,
  fontSize: 18,
  fontWeight: "800",
  lineHeight: 26
} as const;

const reportReferenceTipCardStyle = StyleSheet.flatten([
  {
    backgroundColor: theme.colors.peach,
    gap: 6,
    paddingVertical: 16
  }
]);

const reportReferenceTipTitleStyle = {
  color: theme.colors.brown,
  fontSize: 18,
  fontWeight: "800",
  lineHeight: 24
} as const;

const reportReferenceTipBodyStyle = {
  color: theme.colors.gray600,
  fontSize: 13,
  lineHeight: 20
} as const;

const reportReferenceMemoryCardStyle = StyleSheet.flatten([
  {
    backgroundColor: theme.colors.peach,
    gap: 8,
    paddingVertical: 18
  }
]);

const reportReferenceMemoryTitleStyle = {
  color: theme.colors.brown,
  fontSize: 18,
  fontWeight: "800",
  lineHeight: 24
} as const;

const reportMilestoneCardStyle = StyleSheet.flatten([
  {
    backgroundColor: theme.colors.peach,
    gap: 8,
    paddingVertical: 18
  }
]);

const reportMilestoneShareButtonStyle = {
  alignItems: "center",
  alignSelf: "flex-start",
  backgroundColor: theme.colors.brown,
  borderRadius: 999,
  marginTop: 4,
  paddingHorizontal: 18,
  paddingVertical: 8
} as const;

const reportMilestoneShareButtonTextStyle = {
  color: theme.colors.white,
  fontSize: 14,
  fontWeight: "800",
  lineHeight: 20
} as const;

const reportReferenceMemoryBodyStyle = {
  color: theme.colors.gray600,
  fontSize: 13,
  lineHeight: 20
} as const;
