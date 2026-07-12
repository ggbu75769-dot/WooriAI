import { useEffect, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { getCategoryReport, getCumulativeReport, getMonthlyReport, getYearlyReport, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { categoryNameFor } from "../../src/categories";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, DonutChartCard, EmptyStateCard, LineChartCard, SegmentedControl } from "../../src/ui";
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

function formatKrw(value: number) {
  return `₩${value.toLocaleString("ko-KR")}`;
}

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
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
  // 분기/연간 탭은 기간 파라미터 없이 전체 기간 카테고리 비중을 그대로 보여준다.
  const category = useQuery({
    queryKey: ["report", "category", childId],
    enabled: Boolean(authToken && childId && period !== "월간"),
    queryFn: () => getCategoryReport(authToken!, childId!)
  });
  // 월간 탭은 선택된 월의 카테고리 비중만 보여준다 (서버가 yearMonth 필터를 지원).
  const monthlyCategory = useQuery({
    queryKey: ["report", "category", childId, reportYearMonth],
    enabled: Boolean(authToken && childId && period === "월간"),
    queryFn: () => getCategoryReport(authToken!, childId!, reportYearMonth)
  });
  const activeCategory = period === "월간" ? monthlyCategory : category;
  const categoryCardTitle = period === "월간" ? `${reportDate.getMonth() + 1}월 카테고리 비중` : "전체 기간 카테고리 비중";
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
    ? categoryData.map((entry) => ({ label: categoryNameFor(entry.categoryId), amountKrw: entry.amountKrw }))
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
    <AppScreen>
      <View style={reportReferenceScaleFrameStyle()}>
        <View accessibilityLabel={reportReferenceScreenId} style={reportReferenceFrameStyle}>
          <Text style={reportReferenceHeaderStyle}>리포트</Text>

          <SegmentedControl options={["월간", "분기", "연간"]} value={period} onChange={setPeriod} />

          <View style={reportReferencePeriodRowStyle}>
            {period === "월간" ? (
              <>
                <Pressable accessibilityLabel="이전 달" accessibilityRole="button" hitSlop={12} onPress={() => setMonthOffset((value) => value - 1)}>
                  <Text style={reportReferencePeriodArrowStyle}>‹</Text>
                </Pressable>
                <Text style={reportReferencePeriodTextStyle}>{periodLabel}</Text>
                <Pressable accessibilityLabel="다음 달" accessibilityRole="button" hitSlop={12} onPress={() => setMonthOffset((value) => value + 1)}>
                  <Text style={reportReferencePeriodArrowStyle}>›</Text>
                </Pressable>
              </>
            ) : period === "분기" ? (
              <>
                <Pressable accessibilityLabel="이전 분기" accessibilityRole="button" hitSlop={12} onPress={() => setMonthOffset((value) => value - 1)}>
                  <Text style={reportReferencePeriodArrowStyle}>‹</Text>
                </Pressable>
                <Text style={reportReferencePeriodTextStyle}>{periodLabel}</Text>
                <Pressable accessibilityLabel="다음 분기" accessibilityRole="button" hitSlop={12} onPress={() => setMonthOffset((value) => value + 1)}>
                  <Text style={reportReferencePeriodArrowStyle}>›</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable accessibilityLabel="이전 연도" accessibilityRole="button" hitSlop={12} onPress={() => setMonthOffset((value) => value - 1)}>
                  <Text style={reportReferencePeriodArrowStyle}>‹</Text>
                </Pressable>
                <Text style={reportReferencePeriodTextStyle}>{periodLabel}</Text>
                <Pressable accessibilityLabel="다음 연도" accessibilityRole="button" hitSlop={12} onPress={() => setMonthOffset((value) => value + 1)}>
                  <Text style={reportReferencePeriodArrowStyle}>›</Text>
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
            <EmptyStateCard title="리포트를 불러오고 있어요." actionLabel="잠시만요" />
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
                <EmptyStateCard title="카테고리 정보를 불러오고 있어요." actionLabel="잠시만요" />
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
                // 월간 탭은 getCategoryReport에 yearMonth를 전달해 해당 월만 집계하고,
                // 분기/연간 탭은 기간 파라미터 없이 전체 기간 비중을 그대로 보여준다.
                <DonutChartCard title={categoryCardTitle} segments={categorySegments} />
              )}

              {showTip ? (
                <Card style={reportReferenceTipCardStyle}>
                  <Text style={reportReferenceTipTitleStyle}>이번 달 절약 팁</Text>
                  {tipDeltaKrw !== null && tipDeltaKrw > 0 ? (
                    <>
                      <Text style={reportReferenceTipBodyStyle}>지난 달보다 {formatWon(tipDeltaKrw)}을 절약했어요!</Text>
                      <Text style={reportReferenceTipBodyStyle}>절약 습관 최고예요!</Text>
                    </>
                  ) : (
                    <Text style={reportReferenceTipBodyStyle}>
                      지난 달보다 {formatWon(Math.abs(tipDeltaKrw ?? 0))} 더 썼어요. 다음 구매 전에 같이 확인해 볼까요?
                    </Text>
                  )}
                </Card>
              ) : null}

              {cumulative.isLoading ? (
                <EmptyStateCard title="누적 기록을 불러오고 있어요." actionLabel="잠시만요" />
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

const reportReferenceMemoryBodyStyle = {
  color: theme.colors.gray600,
  fontSize: 13,
  lineHeight: 20
} as const;
