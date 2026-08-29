import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
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
// GAP-063 트랙 A: 리포트 탭의 누적 카드는 홈 누적 카드와 **같은 숫자**(전 기간 · 선물 제외)를
// 그린다. 부제와 대기 고지를 여기서 새로 쓰지 않고 그 카드의 단일 소스를 그대로 부른다 —
// 한 앱이 같은 숫자를 두 정직성 등급으로 말하지 않게.
import {
  cumulativeTotalPendingNotice,
  CUMULATIVE_TOTAL_SUBTITLE,
  REPORT_CUMULATIVE_TOTAL_PENDING_NOTICE_TEST_ID
} from "../../src/home/cumulative-total";
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
// GAP-066 트랙 A(#1): 끝난 달의 예산 결과 한 줄. 판정·문구는 전부 순수 모듈에 있고, 예산
// 퍼센트는 홈 히어로·인사이트와 **같은** evaluateHomeBudgetProgress에서 온다(두 벌 금지).
import {
  buildCompletedMonthBudgetLine,
  monthlyInsightSpokeBudget,
  COMPLETED_MONTH_BUDGET_LINE_TEST_ID
} from "../../src/reports/completed-month-budget";
// GAP-066 트랙 A(#2): 달 라벨 → 월 선택 시트, 그리고 이 탭의 **달 착지 파라미터**(값 + 회차).
import {
  monthJumpTriggerAccessibilityLabel,
  resolveMonthJumpEarliestMonth,
  resolveMonthJumpOffset,
  MONTH_JUMP_TRIGGER_HINT
} from "../../src/month-jump";
import { MonthJumpSheet } from "../../src/MonthJumpSheet";
import {
  resolveReportsMonthLandingNonceParam,
  resolveReportsMonthLandingParam,
  REPORTS_MONTH_NONCE_PARAM,
  REPORTS_MONTH_PARAM
} from "../../src/reports/month-landing";
// GAP-072 트랙 C(#3): 기록이 0건인 기간의 카드(제목·액션). 끝난 기간에는 약속 대신 사실 한 줄이
// 서고, 현재 기간은 종전 그대로다 -- 문장 틀은 기록 탭의 순수 모듈에서 온다(문장 한 벌).
import { buildReportEmptyPeriodCard } from "../../src/reports/empty-period-card";
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
// GAP-067 트랙 A(#6): 분기 탭이 한 번에 받는 개월 수. 그 분기의 세 달이고, 마지막 달이
// 요청의 endYearMonth다(같은 엔드포인트 · 같은 캐시 키 모양 — 아래 quarterTrend 주석).
const QUARTER_TREND_MONTHS = 3;
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
  /**
   * GAP-066 트랙 A(#2) — 월 선택 시트의 열림 상태. 화면 상태로만 살아 있고(세션 간 저장 없음),
   * 월간 탭에서만 열린다(분기·연간 라벨은 이미 한 번에 3·12개월을 건넌다).
   */
  const [monthJumpOpen, setMonthJumpOpen] = useState(false);
  /**
   * GAP-066 트랙 A(#2) — 달 착지가 세울 오프셋을 아래 "기간이 바뀌면 0으로" 효과에 넘기는 자리.
   *
   * 그 효과는 세그먼트를 바꿀 때마다 오프셋을 0으로 되돌린다(종전 규칙 그대로). 그런데 달 착지는
   * 분기·연간에서 들어올 수 있고, 그때 `period`를 "월간"으로 바꾸는 순간 같은 커밋에서 세운
   * 착지 오프셋이 그 효과에 지워진다. 그래서 착지가 **자기 오프셋을 이 ref에 맡기고**, 효과는
   * 맡겨진 값이 있으면 0 대신 그 값을 세운다(맡긴 값은 한 번 쓰고 비운다 — 그다음 세그먼트
   * 변경은 종전대로 0이다).
   */
  const pendingPeriodResetOffsetRef = useRef<number | null>(null);
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
  // GAP-066 트랙 A(#2): 달 착지가 방금 월간으로 바꾼 경우에만, 그 착지 오프셋을 그대로 세운다
  // (위 pendingPeriodResetOffsetRef 주석 -- 맡긴 값이 없으면 종전과 똑같이 0이다).
  useEffect(() => {
    const landedOffset = pendingPeriodResetOffsetRef.current;
    pendingPeriodResetOffsetRef.current = null;
    setMonthOffset(landedOffset ?? 0);
    // 시트는 월간 탭의 컨트롤이다 -- 세그먼트를 옮기면 닫아, 돌아왔을 때 열어 둔 적 없는
    // 시트가 서 있지 않게 한다.
    setMonthJumpOpen(false);
  }, [period]);

  // Use the Seoul-local calendar day (not the device's local timezone) so report periods
  // line up with the server, which computes "이번 달/분기/연도" in KST.
  const seoulToday = getSeoulToday();
  const baseDate = hasSession ? new Date(`${seoulToday}T00:00:00`) : new Date(2025, 4, 1);

  /**
   * GAP-066 트랙 A(#2 후속) — **달 착지**: `month=YYYY-MM` + 회차(`monthJump`)로 이 탭의 그 달을
   * 연다. 규약(이름·형식·방어)은 링크를 만드는 쪽과 같은 모듈에 있다
   * (src/reports/month-landing.ts) -- 이 화면은 읽기만 한다.
   *
   * **회차 단위로** 적용하는 이유는 기록 탭이 드릴다운·달력 착지에서 배운 것과 같다(라운드 52 QA
   * P1-1 · 라운드 57 QA P1-1): 탭 화면은 한 번 열리면 계속 마운트된 채 남으므로 값만 보고 가드
   * 하면 같은 달로 두 번째 들어올 때 아무 일도 일어나지 않고(링크가 죽은 것처럼 보인다), 가드가
   * 아예 없으면 재렌더·아이 전환마다 사용자가 ‹ 로 옮겨 둔 달을 착지가 되감는다.
   *
   * 초기값이 `undefined`인 것은 의도다(null이 아니다) — 회차 없는 링크의 회차는 `null`이라,
   * "아직 아무것도 적용하지 않음"과 구별할 값이 하나 필요하다. 그래야 회차 없는 링크(수기
   * 딥링크)도 첫 진입에서 정확히 한 번 적용된다.
   *
   * 비세션 미리보기(REP-001 픽셀락 캡처)는 파라미터 없이 들어오므로 이 효과가 곧바로 빠져나간다.
   */
  const reportParams = useLocalSearchParams<{ month?: string; monthJump?: string }>();
  const monthLandingParam = resolveReportsMonthLandingParam(reportParams[REPORTS_MONTH_PARAM]);
  const monthLandingNonce = resolveReportsMonthLandingNonceParam(reportParams[REPORTS_MONTH_NONCE_PARAM]);
  const appliedMonthLandingNonceRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!monthLandingParam) return;
    if (appliedMonthLandingNonceRef.current === monthLandingNonce) return;
    appliedMonthLandingNonceRef.current = monthLandingNonce;
    // 환산은 시트와 **같은 함수**다 — 미래 월·20년보다 먼 과거는 종전대로 이번 달(0)이다.
    const landedOffset = resolveMonthJumpOffset(monthLandingParam, getSeoulToday());
    // 달 착지는 월간 탭의 사실이다. 분기·연간에서 들어오면 세그먼트를 옮기고, 그때 도는
    // "기간이 바뀌면 0" 효과가 이 오프셋을 지우지 않도록 값을 맡긴다(위 ref 주석).
    if (period !== "월간") {
      pendingPeriodResetOffsetRef.current = landedOffset;
      setPeriod("월간");
    }
    setMonthOffset(landedOffset);
  }, [monthLandingParam, monthLandingNonce, period]);

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
  /**
   * GAP-072 트랙 C(#3): 끝난 빈 기간 카드의 액션 — 현재 기간으로 되돌아간다.
   *
   * 화살표 이동과 **같은 문법**이다(오프셋 하나를 옮기고 새 기간 라벨을 읽어 준다). 눈으로는
   * 화면 전체가 바뀌지만 소리로만 쓰는 사람에게는 침묵이라, 위 두 함수와 같은 announce를 남긴다
   * -- 문장은 `periodLabelForOffset`이 만드는 그 라벨 그대로다(새 문구 0건).
   *
   * 이 버튼은 **읽기 동작**이라 지출 게이트를 지나지 않는다(기록 탭이 끝난 빈 달의 두 갈래에
   * 내린 판정과 같다). 이미 현재 기간이면 카드가 이 액션을 내지 않지만, 그래도 한 번 막는다.
   */
  const goToCurrentPeriod = () => {
    if (!canGoNextPeriod) return;
    setMonthOffset(0);
    announceForA11y(periodLabelForOffset(baseDate, periodUnit, 0));
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
  /**
   * GAP-063 트랙 A — 위 기간 고지(`pendingScopeNotice`)는 **선택한 기간**(월/분기/연)만 센다.
   * 그런데 이 화면 아래쪽 누적 카드의 숫자는 기간이 없는 전 기간 합계라, 8월을 보고 있을 때
   * 7월에 적어 둔 대기 행은 그 고지에도 잡히지 않으면서 누적 카드의 값만 낮춘다. 그래서 그
   * 카드는 **자기 모집단의** 고지를 따로 단다 — 홈 누적 카드와 같은 함수·같은 문장이다
   * (src/home/cumulative-total.ts).
   *
   * 재집계는 여기서도 하지 않는다(전 기간에는 재조정할 월 캐시가 없다). 행은 그 고지가 이미
   * 구독 중인 같은 스냅숏이라 새 요청은 0건이고, 아이로 거르는 것도 같은 규칙이다 — 아이를
   * 모르면(비세션 미리보기 포함) 아무것도 세지 않는다.
   *
   * 라운드 63 리뷰 #3 — **누적이 0원/모름이면 고지도 없다.** 문장이 "이 금액에 아직 반영되지
   * 않았어요"인데 그 자리의 금액이 0원이면 짚을 것이 없다. 홈의 두 자리는 그 게이트를 이미
   * 갖고 있었고 이 카드만 금액을 보지 않아 규칙이 갈렸다 — 이제 판정은 공용 함수 한 곳이
   * 지므로 서버 누적을 그대로 넘기기만 한다. (그래서 이 줄은 `cumulative` 조회 **뒤**에 선다.)
   */
  const cumulativePendingNotice = hasSession
    ? cumulativeTotalPendingNotice(
        offlineSyncSnapshot.rows.filter((row) => row.childId === childId),
        cumulative.data?.totalExpenseKrw ?? null
      )
    : null;
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
  /**
   * GAP-072 트랙 C(#3) — 그 기간에 기록이 0건일 때 도넛 자리에 서는 카드.
   *
   * **바로 위 줄과 같은 기간을 가리키게** 하는 것이 이 배선의 전부다: 도넛 제목이 `periodLabel`
   * (·같은 `reportDate`)에서 오므로 빈 카드도 같은 값을 받는다. 종전에는 이 카드만 "이번 달"을
   * 고정 문자열로 말해서, 21개월 전으로 점프한 화면이 "2025년 11월 카테고리 비중"과 "이번 달"을
   * 동시에 말했다.
   *
   * 판정·문구는 전부 순수 모듈에 있고(src/reports/empty-period-card.ts) 화면은 아래에서 키
   * (action)로 배선만 한다. "끝난 기간인가"도 새로 판정하지 않는다 -- 화살표가 이미 쓰는
   * `canGoNextPeriod`(= 과거 오프셋에서만 참)를 그대로 뒤집어 넘긴다.
   */
  const emptyPeriodCard = buildReportEmptyPeriodCard({
    unit: periodUnit,
    periodLabel,
    isCurrentPeriod: !canGoNextPeriod,
    // 라운드 40 J-5: 보기 전용 세션의 제목 갈래는 종전 그대로 순수 모듈이 고른다.
    expenseEntryLocked: expenseGate.locked
  });
  /**
   * GAP-067 트랙 A(#6) — 분기 합계도 **한 번의 범위 질의**로 접는다.
   *
   * 종전에는 `useQueries`로 `getMonthlyReport`를 그 분기의 세 달마다 한 번씩 불러 클라이언트에서
   * 더했다. 그 모양은 REP-128이 **이 파일 안에서** 이미 없앤 워터폴과 같은 것이다(월간 추이
   * 차트가 막대 하나당 한 번씩 여섯 번 부르던 자리 — 바로 아래 `monthlyTrend`). 분기가 쓰는 값은
   * 달마다 `totalExpenseKrw` 하나뿐이라 그 엔드포인트의 응답이 그대로 답이고, 서버는 한 줄도
   * 바뀌지 않는다(`GET /children/:id/reports/trend`는 REP-128이 이미 열어 둔 경로다).
   *
   * 세 번이 한 번이 되면서 화면의 판정도 단순해진다: 로딩·실패가 `some(...)`이 아니라 이 쿼리
   * 하나이므로 **실패 확률이 세 배**이던 자리가 사라지고(셋 중 하나만 늦어도 스켈레톤에 머물던
   * 지연도 마찬가지다), 분기 화살표로 한 칸 옮길 때 나가는 요청도 3 → 1이다.
   *
   * ## 잃는 것(값으로 남긴다 — 다음 라운드가 근거 없이 되돌리지 않도록)
   * 종전 세 요청의 캐시 키는 `["report","monthly",childId,ym]`로 **월간 탭과 같은 키**였다. 그래서
   * 분기를 한 번 열면 그 세 달의 월간 카드가 공짜였고(그 반대도), 트렌드 키로 바꾸면 그 온기가
   * 사라진다. 그 교환을 받아들이는 이유: **분기 진입은 매번 일어나고**(세그먼트 탭 · 분기 이동마다
   * 세 요청) 분기를 본 뒤 그 세 달을 월간으로 다시 여는 경로는 드물다. 즉 확실한 3배를 없애고
   * 드문 1회의 재요청을 감수하는 교환이다.
   *
   * 캐시 무효화는 아무것도 늘지 않는다 — 이 키도 `["report", …]` 프리픽스라 당겨서 새로고침
   * (위 usePullToRefresh)·아이 전환(CHILD_SCOPED_QUERY_KEY_PREFIXES)·지출 쓰기 경로가 이미
   * 무효화하는 그 목록에 그대로 걸린다.
   */
  const quarterEndYearMonth = yearMonthOf(quarterMonths[2]);
  const quarterTrend = useQuery({
    queryKey: ["report", "trend", childId, quarterEndYearMonth, QUARTER_TREND_MONTHS],
    enabled: Boolean(authToken && childId && period === "분기"),
    queryFn: () => getTrendReport(authToken!, childId!, quarterEndYearMonth, QUARTER_TREND_MONTHS)
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
   * GAP-066 트랙 A(#2) — 월 선택 시트의 경계.
   *
   * 위쪽은 `canGoToNextPeriod`가 이미 말하는 "미래 아님" 규칙 그대로이고, 아래쪽은 **아이의
   * 생년월일/예정일에서 파생**한다("기록이 있는 가장 오래된 달"을 아는 API가 없다 — 새 엔드포인트는
   * 이번 범위 밖이다). 그 값은 바로 위 `["children"]` 캐시에서 그대로 읽으므로 **새 요청이 0건**
   * 이고, 모르면 하한을 두지 않는다(모르면 막지 않는다 — 월 달력 픽커의 관례). 판정은 전부
   * src/month-jump.ts에 있다.
   */
  const monthJumpBounds = {
    todayIso: seoulToday,
    earliestYearMonth: resolveMonthJumpEarliestMonth(selectedChild)
  };
  // 시트가 고른 달은 **기존 monthOffset으로 환산**해 넘긴다(이 화면의 상태 모양은 그대로다).
  // 이동 안내는 화살표 이동과 **같은 계산**을 읽어 준다(A11Y-117).
  const goToMonthFromJump = (yearMonth: string) => {
    const nextOffset = resolveMonthJumpOffset(yearMonth, seoulToday);
    setMonthJumpOpen(false);
    setMonthOffset(nextOffset);
    announceForA11y(periodLabelForOffset(baseDate, "month", nextOffset));
  };
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

  // REP-128: 월간 탭 라인 차트의 최근 6개월(선택한 달 포함) 추이. 종전에는 분기 합계와
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

  // GAP-067 트랙 A(#6): 합계는 **서버가 준 달별 값의 합**이다 — 종전 세 응답을 더하던 것과 같은
  // 산수이고(재집계 0건), 응답이 아직 없으면 종전처럼 0이다.
  const quarterTotal = (quarterTrend.data?.months ?? []).reduce((sum, month) => sum + month.totalExpenseKrw, 0);
  const quarterIsLoading = quarterTrend.isLoading;
  const quarterIsError = quarterTrend.isError;
  const refetchQuarter = () => quarterTrend.refetch();

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
  // GAP-067 트랙 A(#6): 순서는 종전과 같다 — 트렌드 응답의 `months`는 오름차순이고 마지막
  // 원소가 요청한 endYearMonth(그 분기의 셋째 달)라, 배열이 곧 분기 첫 달부터의 세 점이다.
  const quarterPoints =
    period === "분기" && quarterTrend.isSuccess
      ? quarterTrend.data!.months.map((month) => month.totalExpenseKrw)
      : undefined;
  const yearlyPoints =
    period === "연간" && yearly.isSuccess ? yearly.data!.monthlyTotals.map((entry) => entry.totalExpenseKrw) : undefined;

  // 라운드 52 C-02: 분기·연간의 **미래 달 0원 절벽**을 잘라 낸다.
  //
  // 서버는 연간 리포트의 monthlyTotals를 12개월 전부 채워 주고(기록 없는 달은 0원), 분기 탭도
  // 그 분기의 세 달을 한 범위로 받으므로(GAP-067 트랙 A(#6) 이후 — 그전에는 세 달을 각각
  // 물어봤다. 판정은 그대로다: 어느 쪽이든 아직 오지 않은 달이 0원으로 온다) 미래 달이 섞인다. 그대로 그리면 8월에 연간
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

  /**
   * GAP-066 트랙 A(#1) — **끝난 달의 예산 결과** 한 줄("총 지출" 카드 아래).
   *
   * 서버는 어느 달이든 그 달의 예산을 실어 보내는데(monthly.data.budgetAmountKrw), 인사이트
   * 카드의 2문장 상한이 끝난 달의 예산 문장을 거의 언제나 잘라 냈다 — 그래서 "지난달엔 지켰나"에
   * 앱이 답하지 못했다. 새 요청도 새 집계도 없다: **이 화면이 이미 받아 둔 값 두 개**를 그대로
   * 순수 모듈에 넘긴다(재집계 금지 — 서버 값 그대로).
   *
   * 게이트가 셋이다: ① 월간 탭에서만(분기·연간에는 합친 예산이라는 것이 존재하지 않는다),
   * ② 끝난 달에서만(진행 중인 달은 홈이 진행률 바·경고 배너로 이미 말한다 — 모듈이 monthStatus로
   * 막는다), ③ 인사이트가 그 달의 예산을 이미 말했으면 접는다(라운드 34 L1이 방향 행에서 내린
   * 것과 같은 중복 방지 — 판정은 인사이트가 공개한 두 값만 읽는 monthlyInsightSpokeBudget).
   */
  const completedMonthBudgetLine =
    hasSession && period === "월간" && monthly.isSuccess && !monthlyInsightSpokeBudget(monthlyInsight)
      ? buildCompletedMonthBudgetLine({
          yearMonth: reportYearMonth,
          monthStatus,
          budgetAmountKrw: monthly.data.budgetAmountKrw,
          totalExpenseKrw: monthly.data.totalExpenseKrw
        })
      : null;

  // UX-H: 월간 요약 공유 문구. 인사이트 카드가 화면에 그린 문장과 "총 지출" 카드가 그린 금액을
  // **그대로** 실어, 보낸 문구와 화면이 어긋날 수 없게 한다(DNC-013/015).
  // 라운드 36 F-1/F-5: 어느 문장을 싣는지("가족에게 보내도 되는" 카테고리 1위 문장)와 진행 중인
  // 달의 "8월 1일~27일 기준" 줄은 **인사이트 하나에서만** 나온다 — 이 화면이 yearMonth/todayIso를
  // 공유 조립기에 따로 넘기면 두 소스가 어긋나 부분 구간 합계가 한 달치처럼 나갈 수 있었다.
  // 카드가 없으면(말할 근거 없음) null이라 버튼도 붙지 않는다.
  //
  // GAP-064 #3 — 화면 머리의 대기 고지가 **공유 문구에는 따라가지 않던** 자리를 닫는다. 화면은
  // "기록 3건은 아래 숫자에 아직 반영되지 않았어요"를 이미 그리고 있는데, 그 아래 버튼이 내보내는
  // 금액에는 그 3건이 빠진 채 아무 말도 붙지 않았다 — 보낸 사람만 고지를 본 셈이다.
  // 넘기는 것은 **위에서 이미 센 그 값 하나**다(`pendingScopeNotice`): 같은 스냅숏·같은 판정이라
  // 새 요청도 새 집계도 0건이고, 화면의 고지와 공유의 고지가 서로 다른 건수를 말할 자리가 없다.
  // 기간 게이트를 여기서 명시하는 이유: 그 고지는 **선택한 기간**(월/분기/연)을 세므로 월간이
  // 아닐 때 그대로 넘기면 분기·연 건수가 "2026년 8월" 카드에 실린다. 지금은 인사이트가 월간에만
  // 만들어져 결과적으로 막히지만(그러면 문구 자체가 null), 정확성을 그 우연에 기대지 않는다.
  const monthlyShareMessage = buildMonthlyShareMessage({
    monthLabel: reportMonthLabel,
    childName: shareChildName,
    totalExpenseKrw: monthly.data?.totalExpenseKrw ?? 0,
    insight: monthlyInsight,
    pending: period === "월간" ? pendingScopeNotice : null
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
                {/* GAP-066 트랙 A(#2): 달 라벨이 곧 월 선택 시트의 입구다. 선례는 같은 화면에
                    있다 -- 라운드 49 C-09가 리포트 제목을 아이 전환 입구로 만들 때 <Text>를
                    Pressable로 **감싸기만** 해 렌더를 바꾸지 않았다. 여기서도 라벨의 스타일·
                    문자열은 한 글자도 손대지 않는다(레이아웃 속성 무변경).
                    REP-001 픽셀락 게이트: 비세션 미리보기에서는 hasSession이 false라 아래 else
                    분기, 즉 종전의 <Text>{periodLabel}</Text> 그대로다.
                    라운드 66 적대 리뷰(M-2): 감싸기만 하면 버튼의 몸은 글자 줄 하나라 hitSlop 8을
                    더해도 최소 터치 타깃에 못 미쳤다. 기록 탭의 아이 전환 트리거와 **같은 한 줄**로
                    48dp를 채운다 -- 이 줄(reportReferencePeriodRowStyle)은 이미 minHeight
                    theme.touchTarget에 세로 가운데 정렬이라 늘어난 것은 히트 영역뿐이다. */}
                {hasSession ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={monthJumpTriggerAccessibilityLabel(periodLabel)}
                    accessibilityHint={MONTH_JUMP_TRIGGER_HINT}
                    hitSlop={8}
                    onPress={() => setMonthJumpOpen((open) => !open)}
                    testID="reports-month-jump-trigger"
                    style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget }}
                  >
                    <Text style={reportReferencePeriodTextStyle}>{periodLabel}</Text>
                  </Pressable>
                ) : (
                  <Text style={reportReferencePeriodTextStyle}>{periodLabel}</Text>
                )}
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

          {/* GAP-066 트랙 A(#2): 월 선택 시트. 월간 탭에서 라벨을 눌렀을 때만 그린다 --
              분기·연간 라벨은 이미 한 번에 3·12개월을 건너므로 붙이지 않는다. */}
          {hasSession && period === "월간" && monthJumpOpen ? (
            <MonthJumpSheet
              testID="reports-month-jump-sheet"
              selectedYearMonth={reportYearMonth}
              bounds={monthJumpBounds}
              onSelect={goToMonthFromJump}
              onClose={() => setMonthJumpOpen(false)}
            />
          ) : null}

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

              {/* GAP-066 트랙 A(#1): 끝난 달의 예산 결과 한 줄. 근거가 없는 달(진행 중 · 예산
                  미설정 · 지출 0원 · 인사이트가 이미 말한 달)에는 null이라 화면이 한 줄도 늘지
                  않는다 -- 판정과 문구는 전부 순수 모듈에 있다. 캡션 토큰은 바로 위 방향 행 ·
                  아래 드릴다운 안내 줄과 같은 12/18 gray600이다(구획을 늘리지 않는다). */}
              {completedMonthBudgetLine ? (
                <Text style={reportCompletedMonthBudgetStyle} testID={COMPLETED_MONTH_BUDGET_LINE_TEST_ID}>
                  {completedMonthBudgetLine}
                </Text>
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
                /* GAP-072 트랙 C(#3): 제목·라벨·액션 모두 순수 모듈이 고른다(화면에 문구 리터럴
                   0건). 끝난 기간에서는 그 기간을 이름으로 부르는 사실 한 줄과 [이번 달 보기 ·
                   이번 분기 보기 · 올해 보기]가 서고, 현재 기간·보기 전용 갈래는 종전과 바이트
                   단위로 같다. 라운드 40 J-5의 보기 전용 문구도 그 모듈을 지나 온다. */
                <EmptyStateCard
                  title={emptyPeriodCard.title}
                  actionLabel={emptyPeriodCard.actionLabel}
                  onPress={
                    // 끝난 기간의 액션은 **화면 이동**이라 지출 게이트를 지나지 않는다(읽기
                    // 동작이다). 지출 생성 입구인 "record"만 종전처럼 게이트를 지난다 --
                    // 날짜를 지어내지 않으므로 그 입구는 현재 기간에만 열린다.
                    emptyPeriodCard.action === "go-current-period"
                      ? goToCurrentPeriod
                      : expenseGate.guard(() => router.push("/expenses/new"))
                  }
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
                  {/* GAP-063 트랙 A: 이 숫자는 홈 누적 카드와 **같은 모집단**이다(전 기간 ·
                      expenseType='expense'만 — DNC-015). 그 카드는 라운드 48 QA에서 제외 항목을
                      밝히는 부제를 얻었는데 여기만 말없이 그려, 한 앱이 같은 숫자를 두 정직성
                      등급으로 말하고 있었다. 문구는 그 카드의 상수를 그대로 쓴다. */}
                  <Text style={reportReferenceMemoryBodyStyle}>{CUMULATIVE_TOTAL_SUBTITLE}</Text>
                  {/* 대기 0건이면 null이라 카드는 한 줄도 늘지 않는다(위 판정 주석 참고). */}
                  {cumulativePendingNotice ? (
                    <Text
                      style={reportReferenceMemoryBodyStyle}
                      testID={REPORT_CUMULATIVE_TOTAL_PENDING_NOTICE_TEST_ID}
                    >
                      {cumulativePendingNotice}
                    </Text>
                  ) : null}
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

// GAP-066 트랙 A(#1): "총 지출" 카드 아래 끝난 달의 예산 결과 한 줄. 방향 행·드릴다운 안내와
// 같은 12/18 gray600 캡션 토큰이고, 같은 관례로 카드에 붙인다(화면 gap 18을 -10으로 당긴다).
const reportCompletedMonthBudgetStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 18,
  marginTop: -10,
  paddingHorizontal: 6
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
