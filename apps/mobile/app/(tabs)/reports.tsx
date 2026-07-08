import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { getCumulativeReport, getMonthlyReport } from "../../src/api/client";
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

function ReportPixelStatusBar() {
  return (
    <View style={reportReferenceStatusBarStyle}>
      <Text style={reportReferenceStatusTextStyle}>9:41</Text>
      <View style={reportReferenceSignalGroupStyle}>
        <View style={reportReferenceSignalDotStyle} />
        <View style={reportReferenceSignalPillStyle} />
        <View style={reportReferenceBatteryStyle} />
      </View>
    </View>
  );
}

export default function ReportsScreen() {
  const [period, setPeriod] = useState("월간");
  const accessToken = useSessionStore((state) => state.accessToken);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const monthly = useQuery({
    queryKey: ["report", "monthly", childId],
    enabled: Boolean(accessToken && childId),
    queryFn: () => getMonthlyReport(accessToken!, childId!)
  });
  const cumulative = useQuery({
    queryKey: ["report", "cumulative", childId],
    enabled: Boolean(accessToken && childId),
    queryFn: () => getCumulativeReport(accessToken!, childId!)
  });

  const monthlyTotal = monthly.data?.totalExpenseKrw ?? previewReportTotalKrw;
  const cumulativeTotal = cumulative.data?.totalExpenseKrw ?? previewCumulativeTotalKrw;

  return (
    <AppScreen>
      <View style={reportReferenceScaleFrameStyle()}>
        <View accessibilityLabel={reportReferenceScreenId} style={reportReferenceFrameStyle}>
          <ReportPixelStatusBar />
          <Text style={reportReferenceHeaderStyle}>리포트</Text>

          <SegmentedControl options={["월간", "분기", "연간"]} value={period} onChange={setPeriod} />

          <View style={reportReferencePeriodRowStyle}>
            <Text style={reportReferencePeriodArrowStyle}>‹</Text>
            <Text style={reportReferencePeriodTextStyle}>2025년 5월</Text>
            <Text style={reportReferencePeriodArrowStyle}>›</Text>
          </View>

          {monthly.isLoading ? (
            <EmptyStateCard title="리포트를 불러오고 있어요." actionLabel="잠시만요" />
          ) : (
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

const reportReferenceStatusBarStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
  minHeight: 15
} as const;

const reportReferenceStatusTextStyle = {
  color: theme.colors.gray900,
  fontSize: 11,
  fontWeight: "800"
} as const;

const reportReferenceSignalGroupStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 5
} as const;

const reportReferenceSignalDotStyle = {
  backgroundColor: theme.colors.gray900,
  borderRadius: 4,
  height: 7,
  width: 7
} as const;

const reportReferenceSignalPillStyle = {
  backgroundColor: theme.colors.gray900,
  borderRadius: 5,
  height: 8,
  width: 10
} as const;

const reportReferenceBatteryStyle = {
  backgroundColor: theme.colors.gray900,
  borderRadius: 2,
  height: 8,
  width: 14
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
