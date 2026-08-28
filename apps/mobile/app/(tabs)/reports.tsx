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
import {
  childSwitchTriggerAccessibilityLabel,
  resolveChildScopeLabel,
  withChildScopeLabel,
  withSpokenChildScopeLabel,
  CHILD_SWITCH_TRIGGER_HINT
} from "../../src/children/child-switch";
import { ChildSwitchSheet, useChildSwitchSheet } from "../../src/children/ChildSwitchSheet";
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
import {
  buildCategoryDrilldownTarget,
  categoryDrilldownHint,
  categoryDrilldownNote,
  resolveDrilldownMonth
} from "../../src/reports/category-drilldown";
import { buildMonthlyInsight, resolveMonthStatus } from "../../src/reports/monthly-insight";
import {
  evaluateReportPendingScopeNotice,
  REPORT_PENDING_SCOPE_NOTICE_TEST_ID
} from "../../src/reports/pending-scope-notice";
import { buildPeriodTrendPoints } from "../../src/reports/period-trend-points";
import { buildMonthlyShareMessage } from "../../src/reports/share-text";
import { evaluateTrendDirection } from "../../src/reports/trend-direction";
import { canGoToNextPeriod, periodLabelForOffset, type PeriodUnit } from "../../src/period-navigation";
import { refreshOfflineSyncSnapshot, useOfflineSyncSnapshot } from "../../src/offline/sync-controller";
import { useLoadErrorCopy } from "../../src/offline/use-load-error-copy";
import { EXPENSE_VIEW_ONLY_EMPTY_TITLE } from "../../src/family/record-permissions";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
import { usePullToRefresh } from "../../src/query/use-pull-to-refresh";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { announceForA11y, AppScreen, Card, DonutChartCard, EmptyStateCard, LineChartCard, SegmentedControl } from "../../src/ui";
// DSN-053 P2-D: 월 내비 화살표를 승인 캡처(REP-001)의 MaterialCommunityIcons chevron으로.
// 글리프(‹ ›)는 기기 폰트에 따라 굵기가 제각각이라 캡처와 다른 그림이 됐다 -- 아이콘 계열은
// 앱 전역과 같은 MCI다(docs/5차/design-restore-spec.md §아이콘 계열, 신규 의존성 0).
import { AppIcon } from "../../src/design-system";
import { SkeletonCard } from "../../src/ui/Skeleton";
import { theme } from "../../src/theme";
import { ReportPixelStyles } from "../../src/pixelLock/styles";

const reportReferenceScreenId = "pixel-screen-REP-001 REP-001 · REP-002";
const previewReportTotalKrw = 1_245_700;
const previewCumulativeTotalKrw = 1_245_700;
// REP-128: 월간 탭 라인 차트가 그리는 막대 수(선택한 달 포함 최근 6개월). 서버 기본값과
// 같은 값이지만, 캐시 키에 들어가고 요청에도 실리므로 화면 쪽에서 명시한다.
const MONTHLY_TREND_MONTHS = 6;
// PIX-133(실기기 피드백): 아래 보정 오프셋·스케일은 REP-001 픽셀 캡처를 기준 이미지에
// 맞추기 위한 값이지 실사용 레이아웃이 아니다. 종전에는 세션 렌더에도 무조건 적용돼
// 리포트 탭 전체가 왼쪽 16dp·위 4dp 밀려 "꽉 차 보이지 않는" 실기기 결함이 됐다.
// 캡처 빌드(EXPO_PUBLIC_PIXEL_LOCK=1)에서만 적용한다 — launch-animation의 R49 선례.
const isPixelLockCalibration = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";
const reportReferenceHorizontalOffset = isPixelLockCalibration ? -16 : 0;
const reportReferenceVerticalOffset = isPixelLockCalibration ? -4 : 0;
function reportReferenceScaleFrameStyle() {
  if (!isPixelLockCalibration) return undefined;
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

/**
 * DSN-053 P2-D — 월/분기/연 내비의 화살표 하나.
 *
 * 승인 캡처(REP-001)의 치수는 **48dp 정사각 터치 타깃 안의 28px chevron**이다. 종전에는 세
 * 기간 분기가 각자 `‹`/`›` 글리프를 24px Text로 그려(터치 타깃도 hitSlop 12뿐) 같은 컨트롤이
 * 세 번 복제돼 있었다. 색·크기는 예전 스타일 토큰(reportReferencePeriodArrowStyle)에서 그대로
 * 읽어 쓴다 -- A11Y-117의 "다음 화살표 dim" 계약은 색 교체가 아니라 기록 탭과 같은
 * opacity(reportReferencePeriodArrowDisabledOpacity)로 지킨다.
 *
 * prop 이름이 `accessibilityLabel`/`isDisabled`인 이유: 호출부와 이 안쪽이 화면 계약
 * (src/a11y-contract.test.ts · src/android-native-ui-quality.test.ts)이 grep하는 형태
 * (`accessibilityLabel="이전 달"` · `accessibilityState={{ disabled: …`)를 그대로 유지해야
 * 하기 때문이다 -- shorthand로 접히면 계약이 형태만 보고 놓친다.
 */
function ReportPeriodArrow({
  accessibilityLabel,
  direction,
  isDisabled = false,
  onPress
}: {
  accessibilityLabel: string;
  direction: "left" | "right";
  isDisabled?: boolean;
  onPress: () => void;
}) {
  const glyph = reportReferencePeriodArrowStyle;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      hitSlop={4}
      onPress={onPress}
      style={[
        reportReferencePeriodArrowButtonStyle,
        { opacity: isDisabled ? reportReferencePeriodArrowDisabledOpacity : 1 }
      ]}
    >
      <AppIcon color={glyph.color} name={direction === "left" ? "chevron-left" : "chevron-right"} size={glyph.fontSize} />
    </Pressable>
  );
}

export default function ReportsScreen() {
  const [period, setPeriod] = useState("월간");
  const [monthOffset, setMonthOffset] = useState(0);
  /**
   * 라운드 52 QA P1-1/P2-1 — 카테고리 드릴다운의 **탭 회차 카운터**.
   *
   * 착지 링크에 실려 기록 탭이 "이번에 새로 누른 것인가"를 판단하는 유일한 근거다. 화면 상태로만
   * 살아 있고(세션 간 저장 없음), 표시되지도 서버로 나가지도 않는다.
   */
  const [drilldownNonce, setDrilldownNonce] = useState(0);
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

  /**
   * GAP-054 #3 — 이 기간에 **아직 서버에 반영되지 않은 기록**이 몇 건인가.
   *
   * 리포트 탭의 숫자는 전부 서버 집계라, 오프라인으로 적은 기록은 홈·기록 탭에는 이미 보이는데
   * 여기서만 빠져 있다. 합계를 클라이언트에서 다시 맞추지 않고(집계 규칙이 두 벌이 되는 위험 —
   * 판단은 src/reports/pending-scope-notice.ts 머리말) 그 사실을 한 줄로 밝히기만 한다.
   *
   * 홈과 **같은 구독**(useOfflineSyncSnapshot)이라 새 요청은 0건이고, 기간 판정과 건수 계산은
   * 전부 순수 모듈이 한다. 비세션 미리보기(REP-001 픽셀락 캡처)는 childId가 없어 어차피 0건
   * 이지만, 그 경로를 판정에 들이지 않도록 hasSession으로 한 번 더 막는다.
   */
  const offlineSyncSnapshot = useOfflineSyncSnapshot();
  useEffect(() => {
    // GAP-054 라운드 54 P2-3: 스냅샷은 앱 루트(useOfflineSyncLifecycle)와 저장 경로가 갱신하지만,
    // 이 탭으로 곧장 들어온 첫 렌더에서도 큐를 한 번 읽어 두어야 위 고지가 한 박자 늦게 나타나지
    // 않는다(준비템 탭의 대기 배지가 같은 이유로 같은 호출을 한다 — app/(tabs)/items.tsx).
    // 콜드 스타트에서 "반영되지 않은 기록 3건" 안내가 숫자를 다 그린 뒤에 뜨면, 사용자는 그
    // 한 박자 동안 아무 고지 없는 숫자를 사실로 읽는다.
    void refreshOfflineSyncSnapshot();
  }, []);
  const pendingScopeNotice = hasSession
    ? evaluateReportPendingScopeNotice({
        rows: offlineSyncSnapshot.rows,
        childId,
        scope:
          period === "월간"
            ? { unit: "month", yearMonth: reportYearMonth }
            : period === "분기"
              ? { unit: "quarter", yearMonths: quarterMonths.map(yearMonthOf) }
              : { unit: "year", year: yearStart.getFullYear() }
      })
    : null;

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
  // 라운드 49 C-09: 그 이름이 곧 아이 전환 입구가 된다. 종전에는 리포트에서 둘째 숫자를 보려면
  // 홈으로 갔다가 돌아와야 했다. 상태·부수효과·시트는 홈/기록 탭과 **같은 한 벌**을 쓴다
  // (src/children/ChildSwitchSheet.tsx). 이 화면의 쿼리 키는 전부 ["report", …, childId, …]라
  // 이미 아이별로 갈려 있고, 전환이 그 프리픽스를 통째로 무효화한다.
  //
  // REP-001 픽셀락 이중 게이트: hasSession(비세션 캡처에서 false) **그리고** 아이 2명 이상.
  // 둘 중 하나라도 아니면 아래 헤더는 종전의 <Text>리포트</Text> 그대로다(Pressable로 감싸지도
  // 않는다) -- withChildScopeLabel의 조건(childScopeLabel)과 정확히 같은 범위다.
  const childSwitch = useChildSwitchSheet({
    hasSession,
    childId,
    children: childrenQuery.data?.children
  });
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
  // 라운드 52 C-03: `categoryId`를 **버리지 않는다**. 예전에는 여기서 이름만 남겨서, 범례가
  // "기저귀/위생 34%"까지 말해 놓고도 그 34%가 어떤 기록인지로 갈 방법이 화면에 없었다.
  // 조각이 자기 id를 들고 다니므로 0원 카테고리가 섞여 걸러지더라도(computeCategoryShares의
  // isCountable) 인덱스가 밀려 엉뚱한 필터가 걸릴 여지가 없다.
  const categorySegments = activeCategory.data
    ? categoryData.map((entry) => ({
        label: categoryName(entry.categoryId),
        amountKrw: entry.amountKrw,
        categoryId: entry.categoryId
      }))
    : undefined;

  // 라운드 52 C-03: 범례 한 줄 → 기록 탭의 그 카테고리. 착지 월 규칙(진행 중이면 현재 달, 끝난
  // 기간이면 마지막 달)과 파라미터 형식은 전부 src/reports/category-drilldown.ts에 있다 --
  // 링크를 만드는 이 화면과 읽는 기록 탭이 같은 모듈을 쓴다.
  const drilldownPeriod = {
    startYearMonth: period === "월간" ? reportYearMonth : period === "분기" ? yearMonthOf(quarterStart) : `${yearStart.getFullYear()}-01`,
    monthCount: period === "월간" ? 1 : period === "분기" ? 3 : 12,
    todayIso: seoulToday
  };
  const drilldownMonth = hasSession ? resolveDrilldownMonth(drilldownPeriod) : null;
  // 분기·연간에서는 한 달로 좁혀 간다는 사실을 **누르기 전에** 말한다(카드 아래 한 줄 + 힌트).
  // 월간 탭은 착지 월이 보고 있는 달 그대로라 보이는 줄이 없다(같은 사실을 두 번 말하지 않는다).
  const drilldownHint = drilldownMonth ? categoryDrilldownHint(drilldownMonth) : null;
  const drilldownNote = drilldownMonth ? categoryDrilldownNote(drilldownMonth, drilldownPeriod.monthCount) : null;
  // 드릴다운 입구를 **범례 한 곳**으로만 두는 이유(검토 후 의도적으로 뺀 두 자리):
  //  - **마일스톤 카드**의 1위 카테고리 줄: 그 카드가 말하는 창은 100일/첫돌, 즉 여러 달에 걸친
  //    구간이다. 기록 탭은 한 달치 화면이라 어느 달로 보내도 카드가 보여 준 비중과 다른 숫자에
  //    내려놓게 된다 -- "가장 많이 든 건 기저귀 42%"를 누르고 도착한 달의 1위가 다른 카테고리인
  //    상황을 앱이 스스로 만든다. 착지 월 규칙이 정직하게 성립하지 않는 자리다.
  //  - **월간 인사이트 카드**의 1위 문장: 착지는 정확하지만(그 달·그 카테고리) 바로 아래 도넛
  //    범례의 첫 줄이 같은 곳으로 가는 같은 입구다. 두 번째 입구를 만들면서 카드의 accessible
  //    문장 묶음까지 버튼으로 감싸면, TalkBack이 한 덩어리로 읽던 두 문장이 쪼개진다(UX-H가 공유
  //    버튼을 그룹 **형제**로 둔 것과 같은 이유).
  const openCategoryDrilldown = (categoryId: string | undefined) => {
    // 라운드 52 QA P1-1/P2-1: 링크에 **이번 탭의 회차**를 함께 싣는다. 기록 탭은 값별 가드로
    // 파라미터를 한 번만 적용하므로(가져오기 착지의 규칙), 회차가 없으면 "착지 월이 같은 다른
    // 카테고리"는 월을 재적용하지 못하고 "같은 카테고리 다시 누르기"는 아무 일도 하지 않는다.
    // 카운터는 이 화면이 들고 있는 단조 증가 state다 -- Date.now()가 아니라서 테스트에서
    // 값이 고정되고, 같은 밀리초의 두 번째 탭도 반드시 다른 값을 받는다.
    const nonce = drilldownNonce + 1;
    const target = buildCategoryDrilldownTarget({ ...drilldownPeriod, categoryId, nonce });
    // 말이 되지 않는 값(id 없음·형식 어긋남)이면 아무 데도 가지 않는다 -- 엉뚱한 달/필터에
    // 내려놓느니 누른 자리에 그대로 있는 편이 낫다. 이동하지 않았으므로 회차도 올리지 않는다.
    if (!target) return;
    setDrilldownNonce(nonce);
    router.push(target);
  };

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

  // 라운드 52 C-02: 분기·연간의 **미래 달 0원 절벽**을 잘라 낸다.
  //
  // 서버는 연간 리포트의 monthlyTotals를 12개월 전부 채워 주고(기록 없는 달은 0원), 분기 탭도
  // 그 분기의 세 달을 각각 물어보므로 아직 오지 않은 달이 0원으로 온다. 그대로 그리면 8월에 연간
  // 탭을 열었을 때 9~12월이 바닥에 눌어붙은 선이 되어 "연말에 지출이 끊겼다"는 사실 주장이 된다.
  // 서버는 그대로 두고(그 배열은 합계의 근거이자 정직한 계약이다) 화면이 현재 달까지만 그린다 --
  // 판정과 캡션 문구는 전부 src/reports/period-trend-points.ts에 있다. 끝난 연도/분기는 자르지
  // 않는다(그때의 0원은 전부 사실이다). 월간 탭은 이 모듈을 거치지 않는다 -- getTrendReport는
  // 선택한 달로 **끝나는** 6개월이라 미래 달이 애초에 없다.
  const periodTrend = buildPeriodTrendPoints({
    startYearMonth:
      period === "분기" ? yearMonthOf(quarterStart) : `${yearStart.getFullYear()}-01`,
    points: period === "분기" ? quarterPoints : period === "연간" ? yearlyPoints : undefined,
    todayIso: seoulToday
  });
  const activePoints = period === "월간" ? monthlyTrendPoints : periodTrend.points;
  /**
   * 라운드 52 QA P2-3 — 세션 경로에서 **장식선을 그리지 않는다.**
   *
   * LineChartCard는 점이 2개 미만이면 장식용 고정 좌표로 폴백한다(비세션 픽셀락 캡처를 위한
   * 설계). 그 폴백이 세션 경로에서도 일어나서, 점 하나뿐인 기간에는 그럴듯한 우상향 선이
   * 사용자의 기록인 척 그려졌다 — C-02가 미래 달 0원 절벽에서 없앤 것과 같은 종류의 거짓
   * 신호다. 판정과 문구는 순수 모듈에 있고(periodTrend.chartNotice), 화면은 그 값이 있으면
   * 점을 넘기지 않는다.
   *
   * 월간 탭은 이 판정을 거치지 않는다(getTrendReport는 언제나 6개월을 준다). 비세션 미리보기도
   * 이 분기에 닿지 않는다 — 위쪽 `!hasSession` 가지의 LineChartCard는 손대지 않았다(REP-001).
   * 아직 데이터가 없는 동안(로딩·실패)에도 chartNotice는 null이라 종전 렌더 그대로다.
   */
  const trendChartNotice = period === "월간" ? null : periodTrend.chartNotice;

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

  // ---------------------------------------------------------------------------------------------
  // 라운드 49 QA(P2-3) — 홈·준비템(C-07)과 **같은 규칙**을 리포트 탭에도 적용한다.
  //
  // 이 화면의 미리보기 폴백도 기준이 `hasSession = authToken && childId`였다. 즉 **토큰은 있는데
  // 아이를 아직 모르는 창**이 통째로 픽스처로 떨어져, 실사용자가 자기 리포트에서 ₩1,245,700이라는
  // 있지도 않은 총액과 "지난 달보다 112,000원을 절약했어요!", "다온이와의 오늘도 소중한 하루였어요"를
  // 자기 기록으로 읽었다. 그 창은 드물지 않다(마지막 아이 삭제 직후 오프라인 · childScopeRejected
  // 직후 · MOB-116 복구의 유예 3초).
  //
  // 비세션(`!authToken`) 분기는 한 글자도 바뀌지 않는다 -- REP-001 픽셀 락 캡처는 세션을 지우고
  // 찍으므로(app/pixel-lock.tsx) 이 게이트에 닿지 않는다.
  if (authToken && !childId) {
    return (
      <AppScreen>
        <View testID="reports-child-pending" style={{ gap: theme.spacing.section }}>
          <SkeletonCard />
          <SkeletonCard />
          <EmptyStateCard
            title="아이 정보를 불러오고 있어요"
            actionLabel="아이 선택하기"
            onPress={() => router.push("/settings/children")}
          />
        </View>
      </AppScreen>
    );
  }

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
          {/* 라운드 48 T4(D3) → 49 C-08/C-09: 다자녀 가구에서만 "다온이 — 리포트"가 되고, 그
              제목이 아이 전환 입구가 된다. 구분자가 " · "에서 줄표로 바뀐 이유는 이름이 본문의
              동급 항목처럼 읽히지 않게 하기 위해서다(소리로는 쉼표 — withSpokenChildScopeLabel).
              아이가 하나이거나 비세션 미리보기(REP-001 픽셀락 캡처)에서는 라벨이 null·canSwitch가
              false라 아래 else 분기, 즉 종전의 <Text>리포트</Text> 그대로다. */}
          {childSwitch.canSwitch && childScopeLabel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={childSwitchTriggerAccessibilityLabel(
                withSpokenChildScopeLabel("리포트", childScopeLabel)
              )}
              accessibilityHint={CHILD_SWITCH_TRIGGER_HINT}
              hitSlop={8}
              onPress={childSwitch.toggle}
              testID="reports-child-switch-trigger"
            >
              <Text style={reportReferenceHeaderStyle}>{withChildScopeLabel("리포트", childScopeLabel)}</Text>
            </Pressable>
          ) : (
            <Text style={reportReferenceHeaderStyle}>{withChildScopeLabel("리포트", childScopeLabel)}</Text>
          )}
          {childSwitch.canSwitch && childSwitch.isOpen ? (
            <ChildSwitchSheet
              testID="reports-child-switch-sheet"
              options={childSwitch.options}
              currentChildId={childId}
              onSelect={childSwitch.switchTo}
              onClose={childSwitch.close}
            />
          ) : null}

          <SegmentedControl options={["월간", "분기", "연간"]} value={period} onChange={setPeriod} />

          <View style={reportReferencePeriodRowStyle}>
            {period === "월간" ? (
              <>
                <ReportPeriodArrow accessibilityLabel="이전 달" direction="left" onPress={goToPreviousPeriod} />
                <Text style={reportReferencePeriodTextStyle}>{periodLabel}</Text>
                <ReportPeriodArrow accessibilityLabel="다음 달" direction="right" isDisabled={!canGoNextPeriod} onPress={goToNextPeriod} />
              </>
            ) : period === "분기" ? (
              <>
                <ReportPeriodArrow accessibilityLabel="이전 분기" direction="left" onPress={goToPreviousPeriod} />
                <Text style={reportReferencePeriodTextStyle}>{periodLabel}</Text>
                <ReportPeriodArrow accessibilityLabel="다음 분기" direction="right" isDisabled={!canGoNextPeriod} onPress={goToNextPeriod} />
              </>
            ) : (
              <>
                <ReportPeriodArrow accessibilityLabel="이전 연도" direction="left" onPress={goToPreviousPeriod} />
                <Text style={reportReferencePeriodTextStyle}>{periodLabel}</Text>
                <ReportPeriodArrow accessibilityLabel="다음 연도" direction="right" isDisabled={!canGoNextPeriod} onPress={goToNextPeriod} />
              </>
            )}
          </View>

          {/* GAP-054 #3: 이 기간에 아직 올라가지 않은 기록이 있을 때만 서는 한 줄. 0건이면
              아무것도 그리지 않으므로 캡처(REP-001) 6구획 레이아웃은 평소 그대로다 -- 비세션
              미리보기에서는 애초에 판정 자체가 돌지 않는다. 목록도 CTA도 붙이지 않는다(홈의
              대기 한 줄과 같은 태도: 이 자리의 역할은 요약이지 처리 화면이 아니다 -- 처리는
              기록 탭 배지 → 동기화 상태 화면이 이미 맡고 있다). */}
          {pendingScopeNotice ? (
            <Text style={reportPendingScopeNoticeStyle} testID={REPORT_PENDING_SCOPE_NOTICE_TEST_ID}>
              {pendingScopeNotice.text}
            </Text>
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
              {/* DSN-053 P2-D — 세션 경로의 구획 순서는 승인 캡처(REP-001)를 따른다:
                  ① 세그먼트 ② 월 내비(위) ③ 총 지출 LineChartCard ④ 카테고리 도넛+%범례
                  ⑤ peach 카드(캡처의 "절약 팁" 자리 = 세션에서는 UX-F 인사이트 한 문장)
                  ⑥ 누적 peach 카드. 세션에만 있는 확장 구획(마일스톤 카드)은 그 **뒤**에 선다.

                  인사이트 카드가 ⑤로 내려온 이유: 캡션·방향 행이 차트에 붙어 있어(marginTop -10)
                  카드가 그 위에 끼면 차트 구획이 둘로 갈리고, 캡처에서 peach 카드 두 장이
                  연달아 서는 아래쪽 리듬도 깨진다. 문장 자체는 그대로다(문장 수 상한은
                  src/reports/monthly-insight.ts의 MONTHLY_INSIGHT_MAX_SENTENCES가 진다). */}
              <LineChartCard
                title="총 지출"
                value={formatKrw(activeTotal ?? 0)}
                // UX-F: 방향 행이 붙는 달에는 카드 내장 델타를 숨긴다 -- 같은 비교를 두 번 말하지
                // 않고, 비교 의미(진행 중 / 끝난 달)를 밝힌 아래 행만 남긴다.
                // 라운드 34 L1: 방향 행을 접은 달(인사이트가 이미 비교를 말했다)에도 델타를 되살리지
                // 않는다 -- 되살리면 접은 이유였던 중복이 카드 안으로 옮겨 갈 뿐이다.
                deltaLabel={trendDirection || insightSpokeComparison ? null : deltaLabel}
                // 라운드 52 QA P2-3: 그릴 점이 모자라면 **점을 넘기지 않는다**. 넘기면 카드가
                // 장식용 고정 좌표로 폴백해, 점 하나뿐인 기간(1월의 연간·분기 첫 달)에 그럴듯한
                // 우상향 선이 사용자의 기록인 척 그려진다. 그 자리에는 사실 한 줄만 남긴다.
                points={trendChartNotice ? undefined : activePoints}
                chartNotice={trendChartNotice}
              />

              {/* C-02: 분기·연간 차트가 **어느 달까지**를 그린 것인지 한 줄로 말한다. 잘라 낸
                  기간에는 "1~8월 기준", 아직 두 달이 쌓이지 않아 LineChartCard가 장식선으로
                  폴백한 경우에는 그 선이 기록이 아니라는 사실을 같은 줄이 덧붙인다. 월간 탭에는
                  이 줄이 없고(periodTrend.caption === null), 비세션 미리보기는 이 분기 자체에
                  닿지 않는다(REP-001 픽셀락). */}
              {periodTrend.caption ? (
                <View
                  accessible
                  accessibilityLabel={periodTrend.accessibilityLabel ?? periodTrend.caption}
                  style={reportTrendDirectionRowStyle}
                  testID="reports-period-trend-caption"
                >
                  <Text style={reportTrendDirectionCaptionStyle}>{periodTrend.caption}</Text>
                </View>
              ) : null}

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
                // C-03: 범례 줄이 곧 기록 탭 입구다. 조각이 들고 온 categoryId를 그대로 쓴다.
                <>
                  <DonutChartCard
                    title={categoryCardTitle}
                    segments={categorySegments}
                    onSelect={(slice) => openCategoryDrilldown(slice.categoryId)}
                    selectHint={drilldownHint}
                  />
                  {drilldownNote ? (
                    <Text style={reportCategoryDrilldownNoteStyle} testID="reports-category-drilldown-note">
                      {drilldownNote}
                    </Text>
                  ) : null}
                </>
              )}

              {/* UX-F: 그 달을 한 문장으로 요약한다. 말할 근거가 없으면(총액 0원·카테고리
                  없음·지난달 0원) 카드 자체가 렌더되지 않는다. 캡처의 "절약 팁" 카드와 **같은
                  peach 카드·같은 18/800 제목 줄**을 쓴다(reportInsightCardStyle 참고). */}
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
  // PIX-133: 보정 모드가 아니면 두 값이 0이라 항등 변환이다(실사용 레이아웃 불변).
  transform: [{ translateX: reportReferenceHorizontalOffset }, { translateY: reportReferenceVerticalOffset }]
};

const reportReferenceHeaderStyle = {
  color: theme.colors.gray900,
  fontSize: 22,
  fontWeight: "800",
  lineHeight: 30,
  textAlign: "center"
} as const;

// DSN-053 P2-D: 승인 캡처의 월 내비 줄은 48dp 화살표 두 개가 양 끝을 잡는다 -- 종전의
// minHeight 26 + paddingHorizontal 6은 화살표가 글리프 Text였을 때의 값이라, 터치 타깃이
// 44dp에 못 미치고 줄 높이도 캡처보다 얕았다. 좌우 여백은 이제 화살표 버튼 자신이 만든다.
const reportReferencePeriodRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
  minHeight: theme.touchTarget
} as const;

const reportReferencePeriodArrowStyle = {
  color: theme.colors.gray900,
  fontSize: 28,
  fontWeight: "900",
  lineHeight: 32
} as const;

// 48dp 정사각(theme.touchTarget) — 캡처의 화살표 히트 영역.
const reportReferencePeriodArrowButtonStyle = {
  alignItems: "center",
  height: theme.touchTarget,
  justifyContent: "center",
  width: theme.touchTarget
} as const;

/**
 * A11Y-117: 다음 화살표 dim (현재 기간에서 미래 이동 불가).
 *
 * 흐림은 **opacity**로 준다 — 기록 탭(app/(tabs)/records.tsx의 `opacity: canGoNextMonth ? 1 : 0.35`)과
 * 같은 방식이다. 종전처럼 색을 gray300으로 갈아끼우면 크림 배경 위에서 chevron이 거의 사라져,
 * "누를 수 없는 버튼"이 아니라 "없는 버튼"으로 읽혔다. 글리프 색·크기는 활성과 같은 토큰을 쓴다.
 */
const reportReferencePeriodArrowDisabledOpacity = 0.35;

const reportReferencePeriodTextStyle = {
  color: theme.colors.brown,
  fontSize: 18,
  fontWeight: "800",
  lineHeight: 26
} as const;

// GAP-054 #3: 기간 상단의 "동기화 대기" 한 줄. 카드도 배지도 아니고 캡션 한 줄이다 -- 화면의
// 구획을 늘리지 않기 위해서(DSN-053 6구획 유지) 카테고리 드릴다운 안내 줄(아래)과 같은
// 12/18 gray600 캡션 토큰을 그대로 쓴다.
const reportPendingScopeNoticeStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 18,
  paddingHorizontal: 6
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

// DSN-053 P2-D: 첫 줄은 캡처의 팁 카드 제목과 **같은 18/800**이다 -- 같은 자리(peach 카드
// ⑤번 구획)에 서는 두 카드가 세션 여부에 따라 다른 크기로 읽히지 않게 한다. 두 번째 줄
// (reportInsightDetailStyle)은 캡처의 본문 13px 그대로다.
const reportInsightHeadlineStyle = reportReferenceTipTitleStyle;

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

// C-03: 도넛 카드 바로 아래 "카테고리를 누르면 8월 기록을 보여드려요" 한 줄(분기·연간 전용).
// 방향 행과 같은 관례로 카드에 붙인다(화면 gap 18을 -10으로 당긴다).
const reportCategoryDrilldownNoteStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 18,
  marginTop: -10,
  paddingHorizontal: 6
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
