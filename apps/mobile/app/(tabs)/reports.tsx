import { useEffect, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Platform, Pressable, RefreshControl, Share, StyleSheet, Text, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";
import { buildReportShareTappedPayload } from "../../src/analytics/events";
import {
  getCategoryReport,
  getCumulativeReport,
  getHome,
  getMilestoneReport,
  getMonthlyReport,
  getTrendReport,
  getYearlyReport,
  listCategories,
  listChildren,
  LOCAL_SESSION_TOKEN
} from "../../src/api/client";
import { buildCategoryNameLookup } from "../../src/categories";
import { resolveChildScopeLabel, withChildScopeLabel } from "../../src/children/child-switch";
import { formatKrw } from "../../src/money";
import {
  milestoneOtherCategoriesLine,
  milestoneRecordCountLine,
  milestoneTopCategoryLine
} from "../../src/reports/milestone-card";
import {
  buildMilestoneShareMessage,
  milestoneReportTitle,
  milestoneWindowPhrase
} from "../../src/reports/milestone-share";
import { selectMilestoneReportType } from "../../src/reports/milestone-selection";
import { buildMonthlyInsight, resolveMonthStatus } from "../../src/reports/monthly-insight";
import { buildMonthlyShareMessage } from "../../src/reports/share-text";
import { evaluateTrendDirection } from "../../src/reports/trend-direction";
import { canGoToNextPeriod, periodLabelForOffset, type PeriodUnit } from "../../src/period-navigation";
import { useLoadErrorCopy } from "../../src/offline/use-load-error-copy";
import { EXPENSE_VIEW_ONLY_EMPTY_TITLE } from "../../src/family/record-permissions";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
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
// REP-128: 월간 탭 라인 차트가 그리는 막대 수(선택한 달 포함 최근 6개월). 서버 기본값과
// 같은 값이지만, 캐시 키에 들어가고 요청에도 실리므로 화면 쪽에서 명시한다.
const MONTHLY_TREND_MONTHS = 6;
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
  // UX-R(M): 빈 리포트의 "지출 기록하기"도 지출 생성 화면 입구다 — 보기 전용 참여자에게는
  // 같은 판정으로 안내한다(src/family/record-permissions.ts).
  const expenseGate = useExpenseEntryGate();
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
  const seoulToday = getSeoulToday();
  const baseDate = hasSession ? new Date(`${seoulToday}T00:00:00`) : new Date(2025, 4, 1);

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
    // CAT-124: includeAll=1 — 범례 이름 해석은 전량이 필요하다. 기본 목록(노출 대상 12개)만
    // 받으면 퀵타일 별칭 id로 저장된 지출이 범례에서 "기타"로 무너진다.
    queryFn: () => listCategories(authToken!, { includeAll: true })
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

  // REP-127: 어떤 마일스톤을 부를지는 아이의 생년월일이 정한다. 종전에는 "d100"이 하드코딩돼
  // 있어 서버에 완전히 구현된 첫돌 리포트가 UI에서 영영 도달 불가였다. 생년월일은 새 API를
  // 만들지 않고 아이 관리·설정 화면과 **같은 캐시 키**(["children"])를 재사용해 읽는다 —
  // 대부분의 경우 이미 채워진 캐시를 그대로 읽는다.
  const childrenQuery = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  const selectedChild = childrenQuery.data?.children.find((child) => child.id === childId) ?? null;
  /**
   * 라운드 48 T4(D3): 리포트 제목이 **누구의 리포트인지** 말하게 한다. 다자녀 가구에서는 아이를
   * 전환해도 이 화면이 똑같이 생겨서, 지금 보고 있는 숫자가 누구 것인지 확인할 방법이 화면 안에
   * 없었다. 새 요청은 없다 -- 바로 위 ["children"] 캐시를 그대로 읽는다.
   *
   * REP-001 픽셀락: 비세션 미리보기에서는 이 쿼리 자체가 비활성(enabled: authToken)이라 목록이
   * undefined이고, 아이가 하나인 가구에서도 null이다. 두 경우 모두 제목은 종전의 "리포트"
   * 그대로다(withChildScopeLabel은 라벨이 없으면 원문을 그대로 돌려준다).
   */
  const childScopeLabel = resolveChildScopeLabel(childId, childrenQuery.data?.children);
  const milestoneType = selectMilestoneReportType({ birthDate: selectedChild?.birthDate, todayIso: seoulToday });
  // 생년월일을 알기 전에 d100을 먼저 쏘면 첫돌이 지난 아이에게 낭비 요청 + 카드 깜빡임이
  // 생기므로, 아이 목록이 성공/실패로 **결론난 뒤에** 조회한다(실패 시 birthDate 미상 →
  // 종전과 같은 d100 폴백).
  const childrenSettled = childrenQuery.isSuccess || childrenQuery.isError;
  // REP-103: 마일스톤 비용 리포트 for the 누적 section. The server answers 400
  // MILESTONE_UNAVAILABLE for a child without a birthDate (pregnant/manual stage), so an
  // error simply hides the card instead of surfacing a retry UI -- retry: false keeps that
  // expected 400 from being re-fetched. A birthDate under 100 days ago comes back as a
  // partial window (partial: true + daysCovered) and still shows the card. Demo (local
  // test) sessions are served by the local backend's fixture-based milestone report.
  const milestone = useQuery({
    queryKey: ["report", "milestone", childId, milestoneType],
    enabled: Boolean(authToken && childId && childrenSettled),
    retry: false,
    queryFn: () => getMilestoneReport(authToken!, childId!, milestoneType)
  });
  // Shares the home screen's query cache entry -- only used for the child nickname in the
  // 공유 문구(마일스톤 카드 + UX-H 월간 요약). 새 요청이 아니라 홈 탭이 이미 채워 둔 캐시다.
  const home = useQuery({
    queryKey: ["home", childId],
    enabled: Boolean(authToken && childId),
    queryFn: () => getHome(authToken!, childId!)
  });
  const milestoneReport = milestone.data;
  // 라운드 45 UX-AA: 카드가 그리는 세 줄. 예전에는 1위 카테고리 이름 하나(milestoneTopCategory)만
  // 쓰고 기록 수 · 하루 평균 · 2~3위 카테고리를 버렸다 -- 전부 같은 응답 안에 있던 값이다.
  const milestoneCountLine = milestoneReport ? milestoneRecordCountLine(milestoneReport) : null;
  const milestoneTopLine = milestoneReport ? milestoneTopCategoryLine(milestoneReport) : null;
  const milestoneRestLine = milestoneReport ? milestoneOtherCategoriesLine(milestoneReport) : null;
  // UX-H: 두 공유 카드(마일스톤·월간)가 같은 이름을 쓴다. 닉네임/태명은 사용자가 스스로
  // 보내는 값이고, 이 화면이 공유 문구에 싣는 유일한 식별 정보다(이메일·계정 식별자 없음).
  const shareChildName = home.data?.child.nickname ?? "우리 아이";
  // REP-127: 제목·공유 라벨은 요청한 타입이 아니라 **응답의 type**에서 파생한다. 요청 타입이
  // 바뀌는 사이(첫돌 도달 직후 재조회)에도 화면에 남아 있는 데이터와 제목이 어긋나지 않는다.
  const milestoneCardTitle = milestoneReport ? milestoneReportTitle(milestoneReport.type) : "";
  // 라운드 39 UX-P: 두 공유 버튼의 계측. `report_share_tapped`는 **공유 시트를 띄운 시점**만
  // 센다 -- Share.share의 결과(어디로 보냈는지·취소했는지)는 플랫폼마다 신뢰할 수 없고, 그
  // 이상을 이 이름으로 주장하면 그게 허위 집계다. 그래서 시트를 여는 자리에서 한 번 발사한다.
  // 동의 게이트(ANA-102)와 데모 세션 토큰 규약(라운드 27 L-2)은 공용 클라이언트가 그대로 진다.
  const trackReportShareTapped = (reportType: "monthly" | "milestone") => {
    trackAndFlushAnalyticsEvent(authToken, {
      eventName: "report_share_tapped",
      payload: buildReportShareTappedPayload({ reportType }),
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
    });
  };

  const shareMilestoneReport = async () => {
    if (!milestoneReport) return;
    trackReportShareTapped("milestone");
    try {
      await Share.share({ message: buildMilestoneShareMessage(milestoneReport, shareChildName) });
    } catch {
      // Share sheet dismissed/unavailable -- nothing to recover.
    }
  };

  // REP-128: 월간 탭 라인 차트의 최근 6개월(선택한 달 포함) 추이. 종전에는 quarterQueries와
  // 같은 useQueries 패턴으로 `getMonthlyReport`를 **막대 하나당 한 번씩 6번** 불렀다 — 탭을
  // 열 때마다, 그리고 달을 옮길 때마다 6개의 요청이 나가는 워터폴이었다. 차트가 실제로 쓰는
  // 값은 달마다 totalExpenseKrw 하나뿐이라(아래 monthlyTrendPoints) 예산·카테고리 분해까지
  // 6번 다시 계산할 이유가 없어, 서버가 한 번의 범위 질의로 접어 주는 단일 엔드포인트로
  // 바꾼다. 달 이동은 endYearMonth만 바뀌므로 캐시 키도 그것만 달라진다.
  // 위 monthly/previousMonth 카드는 예산·카테고리 분해를 쓰므로 종전 monthly 요청 그대로다.
  const monthlyTrend = useQuery({
    queryKey: ["report", "trend", childId, reportYearMonth, MONTHLY_TREND_MONTHS],
    enabled: Boolean(authToken && childId && period === "월간"),
    queryFn: () => getTrendReport(authToken!, childId!, reportYearMonth, MONTHLY_TREND_MONTHS)
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

  // UX-N: 오프라인이면 "잠시 후 다시" 대신 오프라인이라는 사실을 말한다(src/offline/messages.ts).
  // 이 화면은 카드 세 장(기간 합계·카테고리 비중·누적)이 각자 실패할 수 있지만, 연결 판정은
  // 화면당 한 번이면 충분하다 — 셋 중 무엇이든 실패하면 그때의 연결 상태를 한 번 확인해 세 카드가
  // 같은 문구를 쓴다. 한 화면 안에서 같은 원인의 실패가 서로 다르게 읽히면 안 된다(DNC-018 톤 일관성).
  const loadErrorCopy = useLoadErrorCopy(activeIsError || activeCategory.isError || cumulative.isError);

  // The delta comparison only makes sense against last month while the 월간 tab is active.
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

  // 세션 경로의 절약 팁 카드는 제거했다 (허위 비교 제거).
  //
  // 무엇이 문제였나: 카드는 `previousMonth`(지난달 **월 전체** 합계)에서 `monthly`(보고 있는 달
  // 합계)를 빼 그 차액만큼 아꼈다고 **단언**하고 습관을 칭찬했다. 진행 중인 달에서는 두 항의 구간
  // 길이가 다르다 -- 매달 1일이면 하루치 vs 한 달치라 언제나 "덜 썼다"가 된다.
  // src/home/last-month-comparison.ts 헤더가 바로 이 형태를 허위 비교로 규정하고, 그래서
  // 홈은 지난달 **행 목록**을 따로 받아 같은 시점까지로 잘라 비교한다. 리포트 화면에는 그 행
  // 목록이 없다(월간 리포트 API에 부분 구간 파라미터가 없다).
  //
  // 왜 "다른 내용으로 교체"가 아니라 제거인가: 끝난 달의 정직한 비교는 UX-F 인사이트 카드가 이미
  // 같은 자리(월간 탭 상단)에서 "지난달 전체보다 …"로 말하고 있어 카드를 남기면 같은 비교를 두 번
  // 하게 된다(추이 방향 행에서 `deltaLabel`을 숨긴 것과 같은 판단). 그리고 대체 후보로 검토한
  // "이번 달 최다 지출일"은 이 화면이 가진 데이터로 만들 수 없다 -- monthly/trend/category 응답에는
  // 일자별 값이 없어 지출 행 목록을 새로 불러와야 하고(REP-128이 줄인 요청 수를 다시 늘린다),
  // 그건 "화면이 이미 가진 정직한 데이터"라는 전제 자체를 깬다.
  //
  // 비세션 프리뷰(REP-001 픽셀락 캡처)의 팁 카드는 고정 문구 픽스처라 그대로 둔다.

  // Real per-period amounts for the line chart's trend, only once every underlying query for
  // the active tab has resolved (otherwise leave undefined so LineChartCard keeps its
  // decorative placeholder line instead of drawing a series full of zeros mid-fetch).
  const monthlyTrendPoints =
    period === "월간" && monthlyTrend.isSuccess
      ? monthlyTrend.data!.months.map((month) => month.totalExpenseKrw)
      : undefined;
  const quarterPoints =
    period === "분기" && quarterQueries.every((query) => query.isSuccess)
      ? quarterQueries.map((query) => query.data!.totalExpenseKrw)
      : undefined;
  const yearlyPoints =
    period === "연간" && yearly.isSuccess ? yearly.data!.monthlyTotals.map((entry) => entry.totalExpenseKrw) : undefined;
  const activePoints = period === "월간" ? monthlyTrendPoints : period === "분기" ? quarterPoints : yearlyPoints;

  // UX-F: 월간 탭 상단 "이번 달 한 문장" 인사이트. 새 요청 없이 이 화면이 이미 받아 둔 집계값
  // (monthly 응답의 총액·예산·categoryTop + previousMonth 응답의 지난달 월 전체 합계)만 조합한다
  // -- 문장 규칙과 "왜 지난달 전체 기준인가"는 src/reports/monthly-insight.ts 헤더 참고.
  const monthStatus = resolveMonthStatus(reportYearMonth, seoulToday);
  const monthlyInsight =
    hasSession && period === "월간" && monthly.isSuccess
      ? buildMonthlyInsight({
          yearMonth: reportYearMonth,
          todayIso: seoulToday,
          totalExpenseKrw: monthly.data.totalExpenseKrw,
          budgetAmountKrw: monthly.data.budgetAmountKrw,
          // 카테고리 이름 목록이 아직 없으면 1위 문장을 만들지 않는다 -- 이름 폴백("기타")으로
          // 엉뚱한 카테고리를 지목하느니 문장을 생략한다(도넛 범례와 같은 ["categories"] 캐시).
          categoryTop: categories.isSuccess ? monthly.data.categoryTop : undefined,
          categoryLabel: categoryName,
          // 지난달 **월 전체** 합계. 진행 중인 달에서는 모듈이 비교 문장을 스스로 생략한다.
          previousMonthTotalKrw: previousMonth.isSuccess ? previousMonth.data.totalExpenseKrw : null
        })
      : null;

  // UX-H: 월간 요약 공유 문구. 인사이트 카드가 화면에 그린 문장과 "총 지출" 카드가 그린 금액을
  // **그대로** 실어, 보낸 문구와 화면이 어긋날 수 없게 한다(DNC-013/015).
  // 라운드 36 F-1/F-5: 어느 문장을 싣는지("가족에게 보내도 되는" 카테고리 1위 문장)와 진행 중인
  // 달의 "8월 1일~27일 기준" 줄은 **인사이트 하나에서만** 나온다 — 이 화면이 yearMonth/todayIso를
  // 공유 조립기에 따로 넘기면 두 소스가 어긋나 부분 구간 합계가 한 달치처럼 나갈 수 있었다.
  // 카드가 없으면(말할 근거 없음) null이라 버튼도 붙지 않는다.
  const monthlyShareMessage = buildMonthlyShareMessage({
    monthLabel: reportMonthLabel,
    childName: shareChildName,
    totalExpenseKrw: monthly.data?.totalExpenseKrw ?? 0,
    insight: monthlyInsight
  });
  const shareMonthlySummary = async () => {
    if (!monthlyShareMessage) return;
    trackReportShareTapped("monthly");
    try {
      await Share.share({ message: monthlyShareMessage });
    } catch {
      // 공유 시트를 닫은(취소) 경우가 정상 경로다 -- 오류 배너를 띄우지 않는다.
    }
  };

  // UX-F: 6개월 추이 차트의 전월 대비 방향 한 줄. 차트가 그리는 값(monthlyTrendPoints)의 마지막
  // 두 달만 비교하므로 추가 요청이 없다. 색은 기존 토큰에서 고르고 **증가는 중립**이다 --
  // 지출이 늘었다는 사실에 경고색을 찍어 죄책감을 주지 않는다(DNC-018).
  const trendDirection =
    hasSession && period === "월간" ? evaluateTrendDirection({ points: monthlyTrendPoints, monthStatus }) : null;
  // 라운드 34 L1: 인사이트 카드가 이미 "지난달 전체보다 …"를 말한 달에는 방향 행을 접는다.
  // 두 줄은 **같은 두 달을 같은 방향으로** 비교한 결과라(끝난 달에서만 비교 문장이 붙는다),
  // 나란히 두면 한 화면에서 같은 사실을 세 번(카드 델타·방향 행·인사이트) 말하게 된다.
  // 남기는 쪽이 인사이트인 이유: 문장이 비교 대상("지난달 전체")을 못 박고 있어 의미가 더 분명하다.
  const insightSpokeComparison = Boolean(monthlyInsight?.hasComparison);
  const showTrendDirectionRow = Boolean(trendDirection) && !insightSpokeComparison;
  const trendDirectionColor =
    trendDirection?.tone === "positive" ? theme.colors.semantic.success : theme.colors.gray600;

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
          {/* 라운드 48 T4(D3): 다자녀 가구에서만 "다온이 · 리포트"가 된다. 아이가 하나이거나
              비세션 미리보기(REP-001 픽셀락 캡처)에서는 라벨이 null이라 종전의 "리포트" 그대로다. */}
          <Text style={reportReferenceHeaderStyle}>{withChildScopeLabel("리포트", childScopeLabel)}</Text>

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
              title={loadErrorCopy.title}
              actionLabel={loadErrorCopy.actionLabel}
              onPress={refetchActive}
            />
          ) : (
            <>
              {/* UX-F: 숫자 카드보다 먼저 읽히는 한 문장. 말할 근거가 없으면(총액 0원·카테고리
                  없음·지난달 0원) 카드 자체가 렌더되지 않는다. */}
              {monthlyInsight ? (
                <Card style={reportInsightCardStyle}>
                  <View accessible accessibilityLabel={monthlyInsight.accessibilityLabel} style={reportInsightTextGroupStyle}>
                    <Text style={reportInsightHeadlineStyle}>{monthlyInsight.headline}</Text>
                    {monthlyInsight.detail ? <Text style={reportInsightDetailStyle}>{monthlyInsight.detail}</Text> : null}
                  </View>
                  {/* UX-H: 버튼은 위 accessible 그룹의 **형제**여야 한다 -- 그룹 안에 넣으면
                      TalkBack이 카드를 한 덩어리로 읽으면서 버튼을 삼킨다. */}
                  {monthlyShareMessage ? (
                    <Pressable
                      accessibilityLabel={`${reportMonthLabel} 요약 공유하기`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={shareMonthlySummary}
                      style={reportShareButtonStyle}
                    >
                      <Text style={reportShareButtonTextStyle}>공유하기</Text>
                    </Pressable>
                  ) : null}
                </Card>
              ) : null}

              <LineChartCard
                title="총 지출"
                value={formatKrw(activeTotal ?? 0)}
                // UX-F: 방향 행이 붙는 달에는 카드 내장 델타를 숨긴다 -- 같은 비교를 두 번 말하지
                // 않고, 비교 의미(진행 중 / 끝난 달)를 밝힌 아래 행만 남긴다.
                // 라운드 34 L1: 방향 행을 접은 달(인사이트가 이미 비교를 말했다)에도 델타를 되살리지
                // 않는다 -- 되살리면 접은 이유였던 중복이 카드 안으로 옮겨 갈 뿐이다.
                deltaLabel={trendDirection || insightSpokeComparison ? null : deltaLabel}
                points={activePoints}
              />

              {showTrendDirectionRow && trendDirection ? (
                <View
                  accessible
                  accessibilityLabel={trendDirection.accessibilityLabel}
                  style={reportTrendDirectionRowStyle}
                >
                  <Text style={reportTrendDirectionCaptionStyle}>{trendDirection.captionText}</Text>
                  <Text style={[reportTrendDirectionValueStyle, { color: trendDirectionColor }]}>
                    {trendDirection.arrow} {trendDirection.valueText}
                  </Text>
                </View>
              ) : null}

              {activeCategory.isLoading ? (
                <SkeletonCard />
              ) : activeCategory.isError ? (
                <EmptyStateCard
                  title={loadErrorCopy.title}
                  actionLabel={loadErrorCopy.actionLabel}
                  onPress={() => activeCategory.refetch()}
                />
              ) : categoryData.length === 0 ? (
                <EmptyStateCard
                  // 라운드 40 J-5: 보기 전용 세션에서는 "첫 기록을 남기면 …"이 지킬 수 없는
                  // 약속이 된다(그 조건을 이 사람은 만족시킬 수 없다) -- 홈·기록 탭의 빈 자리와
                  // 같은 사실 한 줄로 바꾼다(문구 단일 소스: src/family/record-permissions.ts).
                  title={
                    expenseGate.locked
                      ? EXPENSE_VIEW_ONLY_EMPTY_TITLE
                      : "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요."
                  }
                  actionLabel="지출 기록하기"
                  onPress={expenseGate.guard(() => router.push("/expenses/new"))}
                />
              ) : (
                // 월간/분기/연간 모두 categoryPeriod로 해당 기간만 집계한 비중을 보여준다 (REP-104).
                <DonutChartCard title={categoryCardTitle} segments={categorySegments} />
              )}

              {cumulative.isLoading ? (
                <SkeletonCard />
              ) : cumulative.isError ? (
                <EmptyStateCard
                  title={loadErrorCopy.title}
                  actionLabel={loadErrorCopy.actionLabel}
                  onPress={() => cumulative.refetch()}
                />
              ) : cumulative.data ? (
                <Card style={reportReferenceMemoryCardStyle}>
                  <Text style={reportReferenceMemoryTitleStyle}>오늘도 소중한 하루였어요</Text>
                  <Text style={reportReferenceMemoryBodyStyle}>누적 기록 {formatKrw(cumulative.data.totalExpenseKrw)}</Text>
                </Card>
              ) : null}

              {/* REP-103/REP-127: 마일스톤 비용 리포트 카드 -- 생년월일 없는 아이(400
                  MILESTONE_UNAVAILABLE)는 숨김, 창이 아직 안 끝났으면 partial 상태로 지금까지의
                  기록을 보여준다. 첫돌이 지난 아이는 첫돌 리포트가 이 자리를 차지한다. */}
              {milestone.isSuccess && milestoneReport ? (
                <Card style={reportMilestoneCardStyle}>
                  <Text style={reportReferenceMemoryTitleStyle}>{milestoneCardTitle}</Text>
                  <Text style={reportReferenceMemoryBodyStyle}>
                    {milestoneReport.partial
                      ? `태어나서 ${milestoneReport.daysCovered}일째 기록 중 · ${formatKrw(milestoneReport.totalKrw)}`
                      : `태어나서 ${milestoneWindowPhrase(milestoneReport.type)} ${formatKrw(milestoneReport.totalKrw)}`}
                  </Text>
                  {/* 라운드 45 UX-AA: 응답이 이미 주는 기록 수 · 하루 평균 · 상위 3개 카테고리를
                      그린다(새 요청 없음). 예전에는 1위 카테고리 **이름 하나**만 쓰고 나머지를
                      전부 버렸다 -- 판정은 src/reports/milestone-card.ts. */}
                  {milestoneCountLine ? (
                    <Text style={reportReferenceMemoryBodyStyle}>{milestoneCountLine}</Text>
                  ) : null}
                  {milestoneTopLine ? <Text style={reportReferenceMemoryBodyStyle}>{milestoneTopLine}</Text> : null}
                  {milestoneRestLine ? <Text style={reportReferenceMemoryBodyStyle}>{milestoneRestLine}</Text> : null}
                  <Pressable
                    accessibilityLabel={`${milestoneCardTitle} 공유하기`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={shareMilestoneReport}
                    style={reportShareButtonStyle}
                  >
                    <Text style={reportShareButtonTextStyle}>공유하기</Text>
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

// UX-F 인사이트 카드: 새 카드 스타일을 만들지 않고 기존 팁 카드 스타일(peach 배경)을 그대로
// 쓴다 -- 리포트 탭의 카드 룩을 하나 더 늘리지 않기 위해서다.
const reportInsightCardStyle = reportReferenceTipCardStyle;

// 두 문장을 한 요소로 묶어 TalkBack이 카드를 한 번에 읽게 한다(Card는 접근성 props를 받지 않는다).
const reportInsightTextGroupStyle = { gap: 4 } as const;

const reportInsightHeadlineStyle = {
  color: theme.colors.brown,
  fontSize: 16,
  fontWeight: "800",
  lineHeight: 24
} as const;

const reportInsightDetailStyle = reportReferenceTipBodyStyle;

// 추이 차트 바로 아래에 붙는 전월 대비 방향 행(카드 밖, 화면 gap 18을 -10으로 당겨 차트에 붙인다).
const reportTrendDirectionRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 6,
  marginTop: -10,
  paddingHorizontal: 6
} as const;

const reportTrendDirectionCaptionStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 18
} as const;

const reportTrendDirectionValueStyle = {
  fontSize: 12,
  fontWeight: "800",
  lineHeight: 18
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

// UX-H: 마일스톤 카드와 월간 인사이트 카드가 **같은** 공유 버튼을 쓴다(둘 다 peach 카드 안의
// 알약 버튼). 카드마다 다른 버튼을 만들면 같은 동작이 두 모양으로 보인다.
const reportShareButtonStyle = {
  alignItems: "center",
  alignSelf: "flex-start",
  backgroundColor: theme.colors.brown,
  borderRadius: 999,
  marginTop: 4,
  paddingHorizontal: 18,
  paddingVertical: 8
} as const;

const reportShareButtonTextStyle = {
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
