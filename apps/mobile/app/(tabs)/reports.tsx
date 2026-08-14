import { useEffect, useRef, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useScrollToTop } from "@react-navigation/native";
import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { KoreanText as Text } from "../../src/design-system/components/KoreanText";
import { getSeoulToday } from "@wooriai/domain";
import type { ReportSourceKind, ReportV3Contract } from "@wooriai/contracts";
import { getBudgetVarianceExplanation, getCategoryReport, getCumulativeReport, getMonthlyReport, getReportV3, getYearlyReport, fixtureSessionToken } from "../../src/api/client";
import { pixelEvidenceId } from "../../src/api/fixture-runtime";
import { categoryNameFor } from "../../src/categories";
import { AccessibleDataTable, AppIcon, AppScreen, Card, EmptyStateCard, SampleDataBanner, ScreenScaffold, SectionCard, SyncStatusBar, TopAppBar, chartColors, semanticColors } from "../../src/design-system";
import { useConnectivityStatus } from "../../src/offline/connectivity";
import { useOfflineSyncSnapshot } from "../../src/offline/sync-controller";
import { normalizeAppSyncStatus } from "../../src/offline/sync-display-state";
import { childScopedRequestEnabled } from "../../src/query/child-scope";
import { formatKrw } from "../../src/money";
import { addMonths, canShowTrend, mergeCategoryReports, monthsForPeriod, yearMonthOf, type ReportPeriod } from "../../src/reports/period-aggregation";
import { buildReportRequestPlan } from "../../src/reports/request-plan";
import {
  reportSourceRoute,
  restoreReportViewState,
  type ReportSection
} from "../../src/reports/source-navigation";
import { householdIdForFeatureScope, useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
// release5v-source-quality-exception: report chart and selector widgets remain domain visualizations; owner=mobile-design-system; review=2026-10-01.
import { DonutChartCard, LineChartCard, SegmentedControl } from "../../src/ui";
import { theme } from "../../src/theme";
import { ReportPixelStyles } from "../../src/pixelLock/styles";
import { isPixelLockBuild } from "../../src/pixelLock/build-profile";
import { usesLargeTextLayout } from "../../src/design-system/responsive";

const reportReferenceScreenId = pixelEvidenceId("REP-001 REP-001 · REP-002");
const isPixelLockMode = isPixelLockBuild();
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

function addYears(date: Date, years: number) {
  return new Date(date.getFullYear() + years, date.getMonth(), 1);
}

function localDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfQuarter(date: Date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

type CategoryRow = { categoryId: string; amountKrw: number; count: number; label?: string };

function CategoryRankList({ rows, title }: { rows: CategoryRow[]; title: string }) {
  const total = rows.reduce((sum, row) => sum + row.amountKrw, 0);
  const visibleRows = rows.slice(0, 6);
  const overflowRows = rows.slice(6);
  const displayRows = overflowRows.length
    ? [
        ...visibleRows,
        {
          categoryId: "other",
          amountKrw: overflowRows.reduce((sum, row) => sum + row.amountKrw, 0),
          count: overflowRows.reduce((sum, row) => sum + row.count, 0)
        }
      ]
    : visibleRows;

  return (
    <Card style={{ gap: 14 }}>
      <Text style={{ color: semanticColors.textPrimary, fontSize: 17, fontWeight: "800" }}>{title}</Text>
      {displayRows.map((row, index) => {
        const percentage = total > 0 ? Math.round((row.amountKrw / total) * 100) : 0;
         const label = row.label ?? (row.categoryId === "other" ? "기타" : categoryNameFor(row.categoryId));
        return (
          <View accessibilityLabel={`${label} ${formatKrw(row.amountKrw)} ${percentage}%`} key={row.categoryId} style={{ gap: 6 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
              <Text style={{ color: semanticColors.textPrimary, flex: 1, fontSize: 14, fontWeight: "700" }}>{label}</Text>
              <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>{formatKrw(row.amountKrw)} · {percentage}%</Text>
            </View>
            <View style={{ backgroundColor: semanticColors.borderSubtle, borderRadius: 999, height: 8, overflow: "hidden" }}>
              <View style={{ backgroundColor: chartColors[index % chartColors.length], height: 8, width: `${percentage}%` }} />
            </View>
          </View>
        );
      })}
      <AccessibleDataTable
        label={`${title} 접근성 표`}
        rows={displayRows.map((row) => {
          const percentage = total > 0 ? Math.round((row.amountKrw / total) * 100) : 0;
          const label = row.label ?? (row.categoryId === "other" ? "기타" : categoryNameFor(row.categoryId));
          return { label, value: `${formatKrw(row.amountKrw)} · ${percentage}%`, detail: `${row.count}건` };
        })}
      />
    </Card>
  );
}

function PeriodArrow({ label, direction, onPress, disabled = false }: { label: string; direction: "left" | "right"; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ alignItems: "center", height: 48, justifyContent: "center", opacity: disabled ? 0.32 : 1, width: 48 }}
    >
      <AppIcon color={theme.colors.gray900} name={direction === "left" ? "chevron-left" : "chevron-right"} size={28} />
    </Pressable>
  );
}

type ReportV3Section = ReportSection;

const reportV3Sections: Array<{ key: ReportV3Section; label: string }> = [
  { key: "summary", label: "요약" },
  { key: "expenses", label: "지출" },
  { key: "preparation", label: "준비 비용" },
  { key: "recurring", label: "반복 비용" },
  { key: "family", label: "가족별" },
  { key: "adjustments", label: "선물·환불·지원" },
  { key: "forecast", label: "예측" }
];

function SourceLink({
  label,
  value,
  onPress
}: {
  label: string;
  value: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label} ${formatKrw(value)} 근거 보기`}
      accessibilityRole="button"
      onPress={onPress}
      style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 48 }}
    >
      <Text style={{ color: semanticColors.textSecondary, flex: 1, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: semanticColors.actionPrimary, fontSize: 13, fontWeight: "800" }}>{formatKrw(value)} · 보기</Text>
    </Pressable>
  );
}

function ReportV3Card({
  data,
  section,
  onSectionChange,
  onOpenSource
}: {
  data: ReportV3Contract;
  section: ReportV3Section;
  onSectionChange: (section: ReportV3Section) => void;
  onOpenSource: (kind: ReportSourceKind) => void;
}) {
  const maxPreparationValue = Math.max(1, ...data.necessitySplit.flatMap((row) => [Math.max(0, row.plannedCostKrw), Math.max(0, row.actualCostKrw)]));
  const necessityLabel = (key: ReportV3Contract["necessitySplit"][number]["key"]) => key === "essential" ? "필수" : key === "convenience" ? "편의·권장" : "선택";
  return (
    <SectionCard style={{ gap: 12 }}>
      <Text style={{ color: semanticColors.textPrimary, fontSize: 17, fontWeight: "800" }}>준비 비용 상세</Text>
      <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>{data.period.periodStart}~{data.period.periodEnd} · 모든 내용이 같은 기간을 기준으로 해요.</Text>
      <View accessibilityLabel="비용 상세 보기 선택" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {reportV3Sections.map((entry) => (
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: section === entry.key }} key={entry.key} onPress={() => onSectionChange(entry.key)} style={{ alignItems: "center", backgroundColor: section === entry.key ? semanticColors.actionPrimary : semanticColors.surface, borderColor: semanticColors.borderSubtle, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 11 }}>
            <Text style={{ color: section === entry.key ? semanticColors.textInverse : semanticColors.textSecondary, fontSize: 12, fontWeight: "800" }}>{entry.label}</Text>
          </Pressable>
        ))}
      </View>
      {section === "summary" ? (
        <View accessibilityLabel={`예정 ${formatKrw(data.summary.plannedPreparationCostKrw)}, 실제 ${formatKrw(data.summary.actualPreparationCostKrw)}, 남음 ${formatKrw(data.summary.remainingPlannedCostKrw)}`} style={{ gap: 6 }}>
          <SourceLink label="전체 예정비용" value={data.summary.plannedPreparationCostKrw} onPress={() => onOpenSource("planned")} />
          <SourceLink label="실제 준비 지출" value={data.summary.actualPreparationCostKrw} onPress={() => onOpenSource("actual_preparation")} />
          <Text style={{ color: semanticColors.textPrimary, fontSize: 15, fontWeight: "800" }}>남은 예정 비용 {formatKrw(data.summary.remainingPlannedCostKrw)}</Text>
          <SourceLink label="일정 미지정 예정비용" value={data.summary.unscheduledPlannedCostKrw} onPress={() => onOpenSource("unscheduled_planned")} />
          <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>예산 차이 {formatKrw(data.summary.budgetVarianceKrw)} · 일정 미지정 {data.summary.unscheduledPlanCount}개</Text>
          {data.summary.nextDueDate ? <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>다음 준비 예정일 {data.summary.nextDueDate}</Text> : null}
        </View>
      ) : section === "expenses" ? (
        <View style={{ gap: 6 }}>
          <SourceLink label="가계 순지출" value={data.ledger.netHouseholdOutflowKrw} onPress={() => onOpenSource("household_net")} />
          <SourceLink label="준비 품목 연결 지출" value={data.ledger.linkedPreparationCostKrw} onPress={() => onOpenSource("actual_preparation")} />
          <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>예정 비용과 실제 지출은 합치지 않고 별도로 표시해요.</Text>
        </View>
      ) : section === "preparation" ? (
        <View style={{ gap: 10 }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: 8 }}>
            {data.necessitySplit.map((row) => (
              <View key={`chart-${row.key}`} style={{ gap: 4 }}>
                <Text style={{ color: semanticColors.textSecondary, fontSize: 11 }}>{necessityLabel(row.key)}</Text>
                <View style={{ backgroundColor: semanticColors.borderSubtle, borderRadius: 999, height: 8, overflow: "hidden" }}><View style={{ backgroundColor: chartColors[0], height: 8, width: `${Math.round(Math.max(0, row.plannedCostKrw) * 100 / maxPreparationValue)}%` }} /></View>
                <View style={{ backgroundColor: semanticColors.borderSubtle, borderRadius: 999, height: 8, overflow: "hidden" }}><View style={{ backgroundColor: chartColors[1], height: 8, width: `${Math.round(Math.max(0, row.actualCostKrw) * 100 / maxPreparationValue)}%` }} /></View>
              </View>
            ))}
          </View>
          {data.necessitySplit.map((row) => (
            <View accessibilityLabel={`${necessityLabel(row.key)}, 예정 ${formatKrw(row.plannedCostKrw)}, 실제 ${formatKrw(row.actualCostKrw)}, 남음 ${formatKrw(row.remainingPlannedCostKrw)}`} key={row.key} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>{necessityLabel(row.key)}</Text>
              <Text style={{ color: semanticColors.textPrimary, fontSize: 13 }}>예정 {formatKrw(row.plannedCostKrw)} · 실제 {formatKrw(row.actualCostKrw)} · 남음 {formatKrw(row.remainingPlannedCostKrw)}</Text>
            </View>
          ))}
          <Text style={{ color: semanticColors.textSecondary, fontSize: 11 }}>위 막대와 아래 표는 같은 준비 비용 계산 기준을 사용해요.</Text>
        </View>
      ) : section === "recurring" ? (
        <View style={{ gap: 6 }}>
          <SourceLink label="월 반복 예상" value={data.costNature.recurring.monthlyEstimateKrw} onPress={() => onOpenSource("recurring_planned")} />
          <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>이번 기간 반복 예정 {formatKrw(data.costNature.recurring.plannedCostKrw)} · 실제 {formatKrw(data.costNature.recurring.actualCostKrw)}</Text>
          <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>일회성 예정 {formatKrw(data.costNature.oneTime.plannedCostKrw)} · 실제 {formatKrw(data.costNature.oneTime.actualCostKrw)}</Text>
        </View>
      ) : section === "family" ? (
        <View style={{ gap: 6 }}>
          {data.payerContributions.length ? data.payerContributions.map((payer) => <Text accessibilityLabel={`${payer.displayName}, 순지출 ${formatKrw(payer.netHouseholdOutflowKrw)}, ${payer.percentage}%`} key={payer.payerUserId} style={{ color: semanticColors.textSecondary, fontSize: 13 }}>{payer.displayName} 결제 기여 · {formatKrw(payer.netHouseholdOutflowKrw)} · {payer.percentage}%</Text>) : <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>가족별 결제 기록이 아직 없어요.</Text>}
        </View>
      ) : section === "adjustments" ? (
        <View style={{ gap: 6 }}>
          <SourceLink label="선물" value={data.ledger.giftKrw} onPress={() => onOpenSource("gift")} />
          <SourceLink label="환불" value={data.ledger.refundKrw} onPress={() => onOpenSource("refund")} />
          <SourceLink label="지원금" value={data.ledger.supportKrw} onPress={() => onOpenSource("support")} />
          <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>선물은 가계 지출에서 제외하고 환불·지원은 순지출에서 차감했어요.</Text>
        </View>
      ) : data.forecast ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: semanticColors.textPrimary, fontSize: 14, fontWeight: "800" }}>예측 범위 {formatKrw(data.forecast.rangeLowKrw)}~{formatKrw(data.forecast.rangeHighKrw)}</Text>
          <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>예정 예산, 연결 지출, 반복 구매 월 추정에 근거한 제한된 신뢰도예요. {data.forecast.horizon.from}~{data.forecast.horizon.to}</Text>
        </View>
      ) : <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>기록이 충분하지 않아 예측을 만들지 않았어요.</Text>}
    </SectionCard>
  );
}

export default function ReportsScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { fontScale } = useWindowDimensions();
  const largeTextLayout = usesLargeTextLayout(fontScale);
  const params = useLocalSearchParams<{
    reportPeriod?: string;
    reportOffset?: string;
    reportSection?: string;
  }>();
  const restoredView = restoreReportViewState(params);
  const [period, setPeriodState] = useState<ReportPeriod>(restoredView.period);
  const [monthOffset, setMonthOffset] = useState(restoredView.offset);
  const [reportSection, setReportSection] = useState<ReportV3Section>(restoredView.section);
  const setPeriod = (option: string) => {
    setPeriodState(option === "월" ? "월간" : option as ReportPeriod);
    setMonthOffset(0);
  };
  const accessToken = useSessionStore((state) => state.accessToken);
  const defaultHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const selectedChildHouseholdId = useSelectedChildStore((state) => state.selectedChildHouseholdId);
  const householdId = householdIdForFeatureScope(
    childId,
    selectedChildHouseholdId,
    defaultHouseholdId,
    isTestSession
  );
  const hasSession = childScopedRequestEnabled(authToken, childId);
  const requestPlan = buildReportRequestPlan({ hasSession, pixelLockMode: isPixelLockMode, period });
  const syncSnapshot = useOfflineSyncSnapshot();
  const online = useConnectivityStatus();
  const syncStatus = normalizeAppSyncStatus(syncSnapshot.counts, online);

  useEffect(() => {
    router.setParams({
      reportPeriod: period === "월간" ? "month" : period === "분기" ? "quarter" : "year",
      reportOffset: String(monthOffset),
      reportSection
    });
  }, [monthOffset, period, reportSection]);

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

  const reportApiPeriod = period === "월간" ? "month" : period === "분기" ? "quarter" : "year";
  const reportAnchor = localDateOnly(period === "월간" ? reportDate : period === "분기" ? quarterStart : yearStart);

  function openReportSource(kind: ReportSourceKind) {
    if (!childId || !householdId) return;
    router.push(reportSourceRoute({ householdId, childId, period: reportApiPeriod, anchor: reportAnchor, kind }) as unknown as Href);
  }

  const previousMonthDate = addMonths(reportDate, -1);
  const previousMonthYearMonth = yearMonthOf(previousMonthDate);
  const reportV3 = useQuery({
    queryKey: ["report-v3", householdId, childId, reportApiPeriod, reportAnchor],
    enabled: requestPlan.aggregate,
    queryFn: () => getReportV3(authToken!, childId!, reportApiPeriod, reportAnchor)
  });
  const overviewPeriods = [
    { key: "월간" as const, label: "이번 달", period: "month" as const, anchor: localDateOnly(baseDate) },
    { key: "분기" as const, label: "이번 분기", period: "quarter" as const, anchor: localDateOnly(startOfQuarter(baseDate)) },
    { key: "연간" as const, label: "올해", period: "year" as const, anchor: localDateOnly(new Date(baseDate.getFullYear(), 0, 1)) }
  ];
  const overviewQueries = useQueries({
    queries: overviewPeriods.map((entry) => ({
      queryKey: ["report-v3", householdId, childId, entry.period, entry.anchor],
      enabled: Boolean(hasSession && !isPixelLockMode),
      queryFn: () => getReportV3(authToken!, childId!, entry.period, entry.anchor)
    }))
  });
  const overviewMonthStartIndex = Math.max(0, baseDate.getMonth() - 5);
  const overviewMonthDates = Array.from(
    { length: baseDate.getMonth() - overviewMonthStartIndex + 1 },
    (_, index) => new Date(baseDate.getFullYear(), overviewMonthStartIndex + index, 1)
  );
  const overviewYearTrend = new Map(
    (overviewQueries[2]?.data?.trend.buckets ?? []).map((bucket) => [bucket.key, bucket.netHouseholdOutflowKrw])
  );
  const overviewMonthValues = overviewMonthDates.map((date) => overviewYearTrend.get(yearMonthOf(date)) ?? 0);
  const varianceExplanation = useQuery({
    queryKey: ["budget-variance-explanation", householdId, childId, reportApiPeriod, reportAnchor],
    enabled: Boolean(requestPlan.aggregate && !isPixelLockMode),
    queryFn: () => getBudgetVarianceExplanation(authToken!, childId!, reportApiPeriod, reportAnchor)
  });

  const monthly = useQuery({
    queryKey: ["report", "monthly", childId, reportYearMonth],
    enabled: requestPlan.legacyMonthly,
    queryFn: () => getMonthlyReport(authToken!, childId!, reportYearMonth)
  });
  const previousMonth = useQuery({
    queryKey: ["report", "monthly", childId, previousMonthYearMonth],
    enabled: requestPlan.legacyPreviousMonth,
    queryFn: () => getMonthlyReport(authToken!, childId!, previousMonthYearMonth)
  });
  const cumulative = useQuery({
    queryKey: ["report", "cumulative", childId],
    enabled: requestPlan.legacyCumulative,
    queryFn: () => getCumulativeReport(authToken!, childId!)
  });
  const categoryYearMonths = monthsForPeriod(
    period,
    period === "월간" ? reportDate : period === "분기" ? quarterStart : yearStart
  );
  const categoryQueries = useQueries({
    queries: categoryYearMonths.map((yearMonth) => ({
      queryKey: ["report", "category", childId, yearMonth],
      enabled: requestPlan.legacyCategory,
      queryFn: () => getCategoryReport(authToken!, childId!, yearMonth)
    }))
  });
  const categoryCardTitle = `${periodLabel} 카테고리별 비용`;
  const quarterQueries = useQueries({
    queries: quarterMonths.map((date) => {
      const ym = yearMonthOf(date);
      return {
        queryKey: ["report", "monthly", childId, ym],
        enabled: requestPlan.legacyQuarter,
        queryFn: () => getMonthlyReport(authToken!, childId!, ym)
      };
    })
  });
  const yearly = useQuery({
    queryKey: ["report", "yearly", childId, yearStart.getFullYear()],
    enabled: requestPlan.legacyYear,
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
        enabled: requestPlan.legacyMonthlyTrend,
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

  const legacyActiveIsLoading = period === "월간" ? monthly.isLoading : period === "분기" ? quarterIsLoading : yearly.isLoading;
  const legacyActiveIsError = period === "월간" ? monthly.isError : period === "분기" ? quarterIsError : yearly.isError;
  const legacyActiveTotal = period === "월간" ? monthly.data?.totalExpenseKrw : period === "분기" ? quarterTotal : yearly.data?.totalExpenseKrw;
  const activeIsLoading = isPixelLockMode ? legacyActiveIsLoading : reportV3.isLoading;
  const activeIsError = isPixelLockMode ? legacyActiveIsError : reportV3.isError;
  const activeTotal = isPixelLockMode ? legacyActiveTotal : reportV3.data?.ledger.netHouseholdOutflowKrw;
  const refetchActive = () => {
    if (!isPixelLockMode) reportV3.refetch();
    else if (period === "월간") monthly.refetch();
    else if (period === "분기") refetchQuarter();
    else yearly.refetch();
  };

  // Pixel Lock keeps its historical monthly fixture; production comparison comes from
  // the server-owned previous period using the same month/quarter/year unit.
  const currentMonthTotal = isPixelLockMode ? monthly.data?.totalExpenseKrw : reportV3.data?.ledger.netHouseholdOutflowKrw;
  const priorMonthTotal = isPixelLockMode ? previousMonth.data?.totalExpenseKrw : reportV3.data?.previousPeriodComparison?.previousNetOutflowKrw;
  const hasDeltaData = hasSession && currentMonthTotal !== undefined && priorMonthTotal !== undefined;
  const deltaPercent = isPixelLockMode
    ? hasDeltaData && priorMonthTotal! > 0
      ? Math.round(((currentMonthTotal! - priorMonthTotal!) / priorMonthTotal!) * 1000) / 10
      : null
    : reportV3.data?.previousPeriodComparison?.deltaPercentage ?? null;
  const deltaLabel = !hasSession ? undefined : deltaPercent === null ? null : `${deltaPercent > 0 ? "+" : ""}${deltaPercent}%`;

  const legacyCategoryData = mergeCategoryReports(
    categoryQueries.flatMap((query) => (query.isSuccess && query.data ? [query.data] : []))
  );
  const categoryData: CategoryRow[] = isPixelLockMode
    ? legacyCategoryData
    : (reportV3.data?.categories ?? []).map((entry) => ({ categoryId: entry.categoryCode, label: entry.categoryNameKo, amountKrw: entry.netHouseholdOutflowKrw, count: entry.recordCount }));
  const categoryIsLoading = isPixelLockMode ? categoryQueries.some((query) => query.isLoading) : reportV3.isLoading;
  const categoryIsError = isPixelLockMode ? categoryQueries.some((query) => query.isError) : reportV3.isError;
  const refetchCategories = () => isPixelLockMode ? categoryQueries.forEach((query) => query.refetch()) : reportV3.refetch();
  const activeRecordCount = isPixelLockMode ? categoryData.reduce((sum, entry) => sum + entry.count, 0) : (reportV3.data?.maturity.recordCount ?? 0);

  const tipDeltaKrw = hasDeltaData ? priorMonthTotal! - currentMonthTotal! : null;
  const showTip = hasSession && period === "월간" && activeRecordCount >= 3 && tipDeltaKrw !== null && tipDeltaKrw !== 0;

  // Real per-period amounts only. The UI hides the chart until at least two periods contain data.
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
  const legacyActivePoints = period === "월간" ? monthlyTrendPoints : period === "분기" ? quarterPoints : yearlyPoints;
  const activePoints = isPixelLockMode ? legacyActivePoints : reportV3.data?.trend.buckets.map((bucket) => bucket.netHouseholdOutflowKrw);
  const hasEnoughAnalysis = activeRecordCount >= 1;
  const showTrend = Boolean((isPixelLockMode || reportV3.data?.maturity.showTrend) && canShowTrend(activePoints));

  if (!hasSession && !isPixelLockMode) {
    return <Redirect href="/onboarding/child-status" />;
  }

  const reportContent = (
      <View style={isPixelLockMode ? reportReferenceScaleFrameStyle() : undefined}>
        <View accessibilityLabel={reportReferenceScreenId} style={isPixelLockMode ? reportReferenceFrameStyle : productionReportFrameStyle}>
          {isTestSession ? <SampleDataBanner /> : null}
          <TopAppBar title="리포트" />

          {!isPixelLockMode ? (
            <View accessibilityLabel="현재 비용 요약" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {overviewPeriods.map((entry, index) => (
                <Pressable
                  accessibilityLabel={`${entry.label} 순지출 ${formatKrw(overviewQueries[index]?.data?.ledger.netHouseholdOutflowKrw ?? 0)}, 이전 기간 대비 ${overviewQueries[index]?.data?.previousPeriodComparison?.deltaPercentage ?? 0}%, 실제 기록 ${overviewQueries[index]?.data?.maturity.recordCount ?? 0}건, 예정 기록 제외`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: period === entry.key }}
                  key={entry.key}
                  onPress={() => { setPeriodState(entry.key); setMonthOffset(0); }}
                  style={({ pressed }) => ({
                    backgroundColor: period === entry.key ? semanticColors.actionSecondary : semanticColors.surface,
                    borderColor: period === entry.key ? semanticColors.actionPrimary : semanticColors.borderSubtle,
                    borderRadius: 14,
                    borderWidth: 1,
                    flexBasis: "47%",
                    flexGrow: 1,
                    gap: 5,
                    minHeight: 112,
                    opacity: pressed ? 0.78 : 1,
                    padding: 12
                  })}
                >
                  <Text style={{ color: semanticColors.textSecondary, fontSize: 12, fontWeight: "700" }}>{entry.label}</Text>
                  {largeTextLayout ? (
                    <View style={{ gap: 1 }}>
                      <Text style={{ color: semanticColors.textSecondary, fontSize: 11, fontWeight: "800" }}>순지출</Text>
                      <Text style={{ color: semanticColors.textPrimary, fontSize: 15, fontWeight: "900" }}>{formatKrw(overviewQueries[index]?.data?.ledger.netHouseholdOutflowKrw ?? 0)}</Text>
                    </View>
                  ) : (
                    <Text style={{ color: semanticColors.textPrimary, fontSize: 15, fontWeight: "900" }}>순지출 {formatKrw(overviewQueries[index]?.data?.ledger.netHouseholdOutflowKrw ?? 0)}</Text>
                  )}
                  <Text style={{ color: semanticColors.textSecondary, fontSize: 11 }}>
                    이전 대비 {overviewQueries[index]?.data?.previousPeriodComparison?.deltaPercentage == null
                      ? "비교 없음"
                      : `${overviewQueries[index]!.data!.previousPeriodComparison!.deltaPercentage! > 0 ? "+" : ""}${overviewQueries[index]!.data!.previousPeriodComparison!.deltaPercentage}%`}
                  </Text>
                  <Text style={{ color: semanticColors.textSecondary, fontSize: 11 }}>실제 기록 {overviewQueries[index]?.data?.maturity.recordCount ?? 0}건 · 예정 제외</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <SegmentedControl
            options={["월", "분기", "연간"]}
            value={period === "월간" ? "월" : period}
             onChange={setPeriod}
          />

          <View style={reportReferencePeriodRowStyle}>
            {period === "월간" ? (
              <>
                <PeriodArrow direction="left" label="이전 달" onPress={() => setMonthOffset((value) => value - 1)} />
                <Text style={reportReferencePeriodTextStyle}>{periodLabel}</Text>
                <PeriodArrow direction="right" disabled={monthOffset >= 0} label="다음 달" onPress={() => setMonthOffset((value) => value + 1)} />
              </>
            ) : period === "분기" ? (
              <>
                <PeriodArrow direction="left" label="이전 분기" onPress={() => setMonthOffset((value) => value - 1)} />
                <Text style={reportReferencePeriodTextStyle}>{periodLabel}</Text>
                <PeriodArrow direction="right" disabled={monthOffset >= 0} label="다음 분기" onPress={() => setMonthOffset((value) => value + 1)} />
              </>
            ) : (
              <>
                <PeriodArrow direction="left" label="이전 연도" onPress={() => setMonthOffset((value) => value - 1)} />
                <Text style={reportReferencePeriodTextStyle}>{periodLabel}</Text>
                <PeriodArrow direction="right" disabled={monthOffset >= 0} label="다음 연도" onPress={() => setMonthOffset((value) => value + 1)} />
              </>
            )}
          </View>

          {!isPixelLockMode && varianceExplanation.data?.explanation ? (
            <Card style={{ gap: 7 }}>
              <Text style={{ color: semanticColors.textPrimary, fontSize: 17, fontWeight: "800" }}>예정과 실제 비용 차이</Text>
              <Text style={{ color: semanticColors.textPrimary, fontSize: 14 }}>{varianceExplanation.data.explanation.summary}</Text>
              {varianceExplanation.data.explanation.topDrivers.length ? <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>차이가 큰 항목 · {varianceExplanation.data.explanation.topDrivers.map((driver) => driver.name).join(", ")}</Text> : null}
              <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>선택한 기간의 같은 지출 기록을 기준으로 설명해요.</Text>
            </Card>
          ) : null}

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
                <Text style={reportReferenceMemoryTitleStyle}>우리 아이와의 기록을 차곡차곡 모았어요</Text>
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
          ) : !isPixelLockMode && reportV3.data?.reportState.displayState === "complete_empty" ? (
            <EmptyStateCard
              title="아직 리포트를 만들 기록이 없어요. 첫 지출을 남기면 이번 달 비용을 바로 정리해드려요."
              actionLabel="지출 기록하기"
              onPress={() => router.push("/expenses/new")}
            />
          ) : !isPixelLockMode && reportV3.data?.reportState.displayState === "planned_only" ? (
            <>
              <Card style={{ gap: 8 }}>
                <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>준비 계획은 있지만 아직 기록된 지출은 없어요.</Text>
                <Text accessibilityLabel={`전체 예정비용 ${formatKrw(reportV3.data.summary.plannedPreparationCostKrw)}`} style={{ color: semanticColors.textPrimary, fontSize: 30, fontWeight: "800" }}>
                  {formatKrw(reportV3.data.summary.plannedPreparationCostKrw)}
                </Text>
                <SourceLink
                  label="전체 예정비용 근거"
                  value={reportV3.data.summary.plannedPreparationCostKrw}
                  onPress={() => openReportSource("planned")}
                />
                <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>
                  일정 지정 {formatKrw(reportV3.data.summary.scheduledPlannedCostKrw)} · 일정 미지정 {formatKrw(reportV3.data.summary.unscheduledPlannedCostKrw)}
                </Text>
                <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>
                  반복 예정 {formatKrw(reportV3.data.costNature.recurring.monthlyEstimateKrw)} · 실제 지출 0원
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/expenses/new")}
                  style={{ alignItems: "center", backgroundColor: semanticColors.actionPrimary, borderRadius: 14, justifyContent: "center", minHeight: 48, marginTop: 4, paddingHorizontal: 16 }}
                >
                  <Text style={{ color: semanticColors.textInverse, fontSize: 15, fontWeight: "800" }}>첫 지출 기록하기</Text>
                </Pressable>
              </Card>
              <ReportV3Card
                data={reportV3.data}
                section={reportSection}
                onSectionChange={setReportSection}
                onOpenSource={openReportSource}
              />
            </>
          ) : isPixelLockMode && (activeTotal ?? 0) === 0 ? (
            <EmptyStateCard
              title="아직 리포트를 만들 기록이 없어요. 첫 지출을 남기면 이번 달 비용을 바로 정리해드려요."
              actionLabel="지출 기록하기"
              onPress={() => router.push("/expenses/new")}
            />
          ) : (
            <>
              <Card style={{ gap: 8 }}>
                <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>{periodLabel} 가족 비용</Text>
                <Text style={{ color: semanticColors.textPrimary, fontSize: 30, fontWeight: "800" }}>{formatKrw(activeTotal ?? 0)}</Text>
                {deltaLabel ? <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>{isPixelLockMode ? "지난달" : "이전 기간"} 대비 {deltaLabel}</Text> : null}
              </Card>

              {!isPixelLockMode && overviewMonthValues.some((value) => value > 0) ? (
                <SectionCard style={{ gap: 12 }}>
                  <Text style={{ color: semanticColors.textPrimary, fontSize: 17, fontWeight: "800" }}>월별 비용 추이</Text>
                  {overviewMonthDates.map((date, index) => {
                    const value = overviewMonthValues[index] ?? 0;
                    const max = Math.max(1, ...overviewMonthValues);
                    return (
                      <View key={yearMonthOf(date)} style={{ gap: 5 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>{date.getMonth() + 1}월</Text>
                          <Text style={{ color: semanticColors.textPrimary, fontSize: 12, fontWeight: "700" }}>{formatKrw(value)}</Text>
                        </View>
                        <View style={{ backgroundColor: semanticColors.borderSubtle, borderRadius: 999, height: 7, overflow: "hidden" }}>
                          <View style={{ backgroundColor: semanticColors.actionPrimary, height: 7, width: `${Math.round((value / max) * 100)}%` }} />
                        </View>
                      </View>
                    );
                  })}
                  <AccessibleDataTable
                    label="월별 비용 추이 접근성 표"
                    rows={overviewMonthDates.map((date, index) => ({
                      label: `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
                      value: formatKrw(overviewMonthValues[index] ?? 0)
                    }))}
                  />
                </SectionCard>
              ) : null}

              {!isPixelLockMode && reportV3.data && (reportV3.data.ledger.giftKrw > 0 || reportV3.data.ledger.refundKrw > 0 || reportV3.data.ledger.supportKrw > 0) ? (
                <SectionCard>
                  <Text style={{ color: semanticColors.textPrimary, fontSize: 17, fontWeight: "800" }}>선물·환불·지원</Text>
                  <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>선물 {formatKrw(reportV3.data.ledger.giftKrw)} · 환불 {formatKrw(reportV3.data.ledger.refundKrw)} · 지원 {formatKrw(reportV3.data.ledger.supportKrw)}</Text>
                  <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>선물은 가계 지출에서 제외하고, 환불과 지원금은 순지출에서 차감했어요.</Text>
                </SectionCard>
              ) : null}

              {!isPixelLockMode && reportV3.data ? (
                <ReportV3Card
                  data={reportV3.data}
                  section={reportSection}
                  onSectionChange={setReportSection}
                  onOpenSource={openReportSource}
                />
              ) : null}

              {showTrend ? <LineChartCard title="기간별 비용 추이" value={formatKrw(activeTotal ?? 0)} points={activePoints} /> : null}

              {!hasEnoughAnalysis ? null : categoryIsLoading ? (
                <EmptyStateCard title="카테고리 정보를 불러오고 있어요." actionLabel="잠시만요" />
              ) : categoryIsError ? (
                <EmptyStateCard
                  title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
                  actionLabel="다시 시도"
                  onPress={refetchCategories}
                />
              ) : categoryData.length === 0 ? (
                <EmptyStateCard
                  title="첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요."
                  actionLabel="지출 기록하기"
                  onPress={() => router.push("/expenses/new")}
                />
              ) : <CategoryRankList rows={categoryData} title={categoryCardTitle} />}

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
                <EmptyStateCard title="누적 기록을 불러오고 있어요." actionLabel="잠시만요" />
              ) : cumulative.isError ? (
                <EmptyStateCard
                  title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
                  actionLabel="다시 시도"
                  onPress={() => cumulative.refetch()}
                />
              ) : cumulative.data ? (
                <Card style={reportReferenceMemoryCardStyle}>
                  <Text style={reportReferenceMemoryTitleStyle}>누적 가족 비용</Text>
                  <Text style={reportReferenceMemoryBodyStyle}>{formatKrw(cumulative.data.totalExpenseKrw)}</Text>
                </Card>
              ) : null}
            </>
          )}
          <SyncStatusBar onPress={() => router.push("/sync-status" as Href)} status={syncStatus} />
        </View>
      </View>
  );

  return isPixelLockMode ? <AppScreen scrollRef={scrollRef}>{reportContent}</AppScreen> : <ScreenScaffold scrollRef={scrollRef} testID="release4-report-screen">{reportContent}</ScreenScaffold>;
}

const reportReferenceFrameStyle = {
  gap: 18,
  transform: [{ translateX: reportReferenceHorizontalOffset }, { translateY: reportReferenceVerticalOffset }]
};

const productionReportFrameStyle = {
  alignSelf: "stretch",
  gap: 18,
  width: "100%"
} as const;

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
  minHeight: 48
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
