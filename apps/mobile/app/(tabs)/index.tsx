import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { getHome, listChildren, listExpenses, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { fetchMonthExpenses } from "../../src/expenses/month-expenses";
import { homeRecentExpenseSubtitle } from "../../src/expenses/records-list-view";
import { evaluateBabyCounter } from "../../src/home/baby-counter";
import { buildHomeBudgetNudge, evaluateHomeBudgetProgress } from "../../src/home/budget-progress";
import { evaluateBudgetWarning } from "../../src/home/budget-warning";
import { evaluateLastMonthComparison, previousYearMonth } from "../../src/home/last-month-comparison";
import { evaluateMilestoneCountdown } from "../../src/home/milestone-countdown";
import { evaluateWeeklySummary } from "../../src/home/weekly-summary";
import { formatKrw } from "../../src/money";
import { NotificationBell } from "../../src/notifications/NotificationBell";
import { useHomeNotificationEvaluation } from "../../src/notifications/useHomeNotificationEvaluation";
import { usePullToRefresh } from "../../src/query/use-pull-to-refresh";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import {
  AppScreen,
  Card,
  EmptyStateCard,
  FloatingActionButton,
  HeroSummaryCard,
  ListRow,
  QuickActionIconButton,
  ScreenHeader
} from "../../src/ui";
import { SkeletonCard, SkeletonRow } from "../../src/ui/Skeleton";
import { resolveScreenPhase } from "../../src/screen-phase";
import { theme } from "../../src/theme";
import { HomePixelStyles } from "../../src/pixelLock/styles/HomePixelStyles";

function homePixelScaleFrameStyle() {
  return {
    transform: [
      { translateX: HomePixelStyles.scaleHorizontalOffset },
      { translateY: HomePixelStyles.scaleVerticalOffset },
      { scale: HomePixelStyles.scale },
      { scaleX: HomePixelStyles.scaleX }
    ]
  } as const;
}

function homePixelFrameStyle() {
  return {
    gap: theme.spacing.section,
    transform: [{ translateX: HomePixelStyles.horizontalOffset }, { translateY: HomePixelStyles.topOffset }]
  };
}

const homeBudgetNudgeStyle = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 18,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  copy: {
    flex: 1,
    gap: 4
  },
  icon: {
    color: theme.colors.mainCoral,
    fontSize: 22,
    fontWeight: "800"
  },
  iconBox: {
    alignItems: "center",
    backgroundColor: theme.colors.peach,
    borderRadius: 14,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  subtitle: {
    color: theme.colors.gray600,
    fontSize: 12,
    lineHeight: 18
  },
  title: {
    color: theme.colors.brown,
    fontSize: 14,
    fontWeight: "800"
  }
});

// HOME-BUDGET-113: warning banner shown from 80% budget usage. Tone colors come from the
// brand semantic tokens (theme.colors.warning / theme.colors.danger); the meaning itself is
// always carried by the banner text, never by color alone.
const homeBudgetWarningStyle = StyleSheet.create({
  banner: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderLeftWidth: 4,
    borderRadius: 14,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  bannerApproaching: {
    borderLeftColor: theme.colors.warning
  },
  bannerExceeded: {
    borderLeftColor: theme.colors.danger
  },
  body: {
    color: theme.colors.gray600,
    fontSize: 12,
    lineHeight: 18
  },
  copy: {
    flex: 1,
    gap: 2
  },
  icon: {
    fontSize: 16,
    fontWeight: "800"
  },
  iconApproaching: {
    color: theme.colors.warning
  },
  iconExceeded: {
    color: theme.colors.danger
  },
  title: {
    color: theme.colors.brown,
    fontSize: 14,
    fontWeight: "800"
  }
});

// REP-121: "지난달 같은 시점 대비" 한 줄. 의미는 전부 문장이 지고(색상 단독 전달 금지) 앞의
// 글리프는 장식이라 accessible={false}로 TalkBack에서 감춘다. 텍스트는 본문 색(brown)이라
// 크림 배경에서 대비가 충분하다(coral 계열 소형 텍스트 금지 규칙, A11Y-117).
const homeLastMonthInsightStyle = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  glyph: {
    color: theme.colors.gray600,
    fontSize: 14,
    fontWeight: "800"
  },
  text: {
    color: theme.colors.brown,
    flex: 1,
    fontSize: 13,
    lineHeight: 20
  }
});

const homeBudgetNudgeArrowStyle = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.10)",
    borderRadius: 16,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  glyph: {
    color: theme.colors.brown,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24
  }
});

// UX-A 아기 카운터 헤더: 홈 최상단의 인사말을 "아이 자신"으로 바꾼다. 기존 ScreenHeader와 같은
// 골격(왼쪽 카피 + 오른쪽 알림 벨)이지만 제목이 카운터 문장이라 한 줄이 길어질 수 있어 자체
// 스타일을 쓴다. 단계 라벨("24개월")은 아이브로우로 살아남는다 -- 기존 헤더가 주던 정보를
// 잃지 않기 위해서다. 아이브로우 색은 A11Y-117 규칙대로 coral[700](소형 coral 텍스트).
const homeBabyCounterStyle = StyleSheet.create({
  copy: {
    flex: 1,
    gap: 4
  },
  eyebrow: {
    color: theme.colors.coral[700],
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2
  },
  header: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  subtitle: {
    color: theme.colors.gray600,
    fontSize: 13,
    lineHeight: 20
  },
  title: {
    color: theme.colors.brown,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 30
  }
});

// UX-A 이번 주 요약 · 기록 스트릭: 한 달보다 짧은 호흡의 숫자 + 습관 한 줄. 의미는 전부 문장이
// 지고(색상 단독 전달 금지) 앞의 글리프는 장식이라 accessible={false}로 감춘다.
const homeWeeklySummaryStyle = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 14,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  glyph: {
    color: theme.colors.gray600,
    fontSize: 14,
    fontWeight: "800"
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  streak: {
    color: theme.colors.gray600,
    fontSize: 12,
    lineHeight: 18,
    paddingLeft: 24
  },
  text: {
    color: theme.colors.brown,
    flex: 1,
    fontSize: 13,
    lineHeight: 20
  }
});

// UX-A 100일 · 첫돌 카운트다운: 눌러서 리포트 탭으로 가는 카드라 넛지 카드와 같은 골격
// (아이콘 박스 + 카피 + › 화살표)을 따른다.
const homeMilestoneStyle = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 18,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  copy: {
    flex: 1,
    gap: 4
  },
  icon: {
    color: theme.colors.coral[700],
    fontSize: 20,
    fontWeight: "800"
  },
  iconBox: {
    alignItems: "center",
    backgroundColor: theme.colors.peach,
    borderRadius: 14,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  subtitle: {
    color: theme.colors.gray600,
    fontSize: 12,
    lineHeight: 18
  },
  title: {
    color: theme.colors.brown,
    fontSize: 14,
    fontWeight: "800"
  }
});

const previewHome = {
  child: { id: "preview-child-daon", nickname: "다온이", currentStage: "toddler", stageLabel: "24개월" },
  monthly: {
    childId: "preview-child-daon",
    yearMonth: "2025-05",
    amountKrw: 1_600_000,
    usedAmountKrw: 1_245_700,
    remainingAmountKrw: 354_300
  },
  recommendedItems: [
    { id: "preview-diaper-party-pack", name: "네이처러브 기저귀 팬티형", status: "not_prepared" },
    { id: "preview-baby-carrier", name: "베이비 아기띠 힙시트", status: "interested" }
  ],
  recentExpenses: [
    {
      id: "preview-expense-diaper",
      childId: "preview-child-daon",
      categoryId: "preview-category-diaper",
      amountKrw: 45_900,
      spentOn: "오늘",
      itemName: "기저귀",
      expenseType: "expense",
      source: "manual"
    },
    {
      id: "preview-expense-formula",
      childId: "preview-child-daon",
      categoryId: "preview-category-formula",
      amountKrw: 32_400,
      spentOn: "05.20",
      itemName: "분유/유제품",
      expenseType: "expense",
      source: "manual"
    },
    {
      id: "preview-expense-cleanser",
      childId: "preview-child-daon",
      categoryId: "preview-category-cleanser",
      amountKrw: 18_900,
      spentOn: "05.19",
      itemName: "유아용 세제",
      expenseType: "expense",
      source: "manual"
    }
  ]
} as const;

export default function HomeScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const home = useQuery({
    queryKey: ["home", childId],
    enabled: Boolean(authToken && childId),
    queryFn: () => getHome(authToken!, childId!)
  });
  const hasSession = Boolean(authToken && childId);
  // REP-121: 홈 한 줄 인사이트는 "지난달 같은 일자까지"의 부분 합계를 필요로 한다. /home 응답에는
  // 지난달 값이 없고, 월간 리포트 API(reports/monthly)는 yearMonth 단위 **월 전체** 합계만 주므로
  // (endDate 파라미터 없음 -- apps/api/src/onboarding/reporting-store.service.ts) 그 값으로 비교하면
  // 월초마다 "적게 썼어요"가 뜨는 허위 비교가 된다. 그래서 지난달 지출 행을 한 번 조회해 클라이언트
  // 에서 같은 일자까지 잘라 더한다(src/home/last-month-comparison.ts). 캐시 키는 기록 탭과 같은
  // ["expenses", childId, yearMonth]라 두 화면이 응답을 공유하고, 지출 생성/수정/가져오기 경로가
  // 이미 invalidate하는 ["expenses"] 프리픽스에 그대로 걸려 최신 상태가 유지된다.
  const seoulToday = getSeoulToday();
  const lastYearMonth = previousYearMonth(seoulToday);
  //
  // REC-124(H1): API-124 이후 한 요청은 한 페이지(기본 200 · 상한 500건)이고 정렬이 spentOn desc라,
  // 첫 페이지만 읽으면 200건을 넘는 달의 **앞날짜가 통째로 빠진다**. 그러면 "같은 일자까지"의 부분
  // 합계가 0이 되어 이 한 줄이 "지난달 같은 시점까지는 지출 기록이 없었어요"라는 없는 사실을
  // 말한다. fetchMonthExpenses가 CSV 내보내기와 같은 커서 루프로 전량을 모은다
  // (src/expenses/month-expenses.ts). 기록 탭도 같은 페처를 쓰므로 공유 캐시의 내용이 어긋나지 않는다.
  const lastMonthExpenses = useQuery({
    queryKey: ["expenses", childId, lastYearMonth],
    enabled: Boolean(authToken && childId && lastYearMonth),
    queryFn: () => fetchMonthExpenses((page) => listExpenses(authToken!, childId!, lastYearMonth!, page))
  });
  // UX-A 주간 요약: 이번 달 지출 행. 기록 탭이 이번 달을 볼 때와 **같은 캐시 키**라
  // (["expenses", childId, 이번 달]) 대개 이미 채워진 캐시를 그대로 읽고, 지출 생성/수정/
  // 가져오기가 invalidate하는 ["expenses"] 프리픽스에 그대로 걸린다. 지난달 캐시(위)와 함께
  // 넘겨야 달을 걸친 주("9월 1일 화요일"의 이번 주 월요일 = 8월 31일)도 정확히 더해진다 --
  // 근거는 src/home/weekly-summary.ts.
  const thisYearMonth = seoulToday.slice(0, 7);
  const thisMonthExpenses = useQuery({
    queryKey: ["expenses", childId, thisYearMonth],
    enabled: Boolean(authToken && childId),
    queryFn: () => fetchMonthExpenses((page) => listExpenses(authToken!, childId!, thisYearMonth, page))
  });
  // UX-A 아기 카운터·마일스톤 카드가 쓰는 dueDate/birthDate/stageMode는 /home 응답에 없다
  // (HomeSummary.child는 nickname/currentStage/stageLabel만 준다). 새 엔드포인트를 만들지 않고
  // 아이 관리·설정·리포트 화면과 **같은 캐시 키**(["children"])를 재사용해 읽는다.
  const childrenQuery = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  const selectedChild = childrenQuery.data?.children.find((child) => child.id === childId) ?? null;
  // NOTI-102: evaluate client-side notifications (budget/stage/purchase) once the home query has
  // resolved -- session-gated by passing undefined otherwise, so preview/logged-out stays inert.
  useHomeNotificationEvaluation(hasSession ? home.data : undefined);
  // MOB-117 당겨서 새로고침: 홈 요약·최근 지출은 모두 ["home"] 쿼리에서 나온다. invalidate는
  // 활성 쿼리 refetch 완료까지 resolve되므로 스피너가 실제 완료에 맞춰 닫힌다.
  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = usePullToRefresh(() => queryClient.invalidateQueries({ queryKey: ["home"] }));
  // 세션 없는 미리보기에는 새로고침할 서버 데이터가 없으므로 RefreshControl을 붙이지 않는다.
  const refreshControl = hasSession ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={theme.colors.mainCoral}
      colors={[theme.colors.mainCoral]}
    />
  ) : undefined;

  // MOB-130: 에러 → 로딩 → 정상 순서는 resolveScreenPhase가 정한다(src/screen-phase.ts).
  const homePhase = resolveScreenPhase({ isPending: home.isPending, isError: home.isError, hasData: Boolean(home.data) });

  if (hasSession && homePhase === "error") {
    return (
      <AppScreen>
        <EmptyStateCard
          title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
          actionLabel="다시 시도"
          onPress={() => home.refetch()}
        />
      </AppScreen>
    );
  }

  if (hasSession && homePhase === "loading") {
    // UX-5B-5 (D6): 가짜 버튼이 달린 EmptyStateCard 대신 스켈레톤 로딩.
    return (
      <AppScreen>
        <View style={{ gap: theme.spacing.section }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </AppScreen>
    );
  }

  const visibleHome = hasSession ? home.data! : previewHome;
  const monthlyUsed = visibleHome.monthly.usedAmountKrw;
  const budget = visibleHome.monthly.amountKrw;
  // HOME-127: 퍼센트 판정은 src/home/budget-progress.ts가 한다. 종전에는 여기서
  // `(monthlyUsed / Math.max(1, budget)) * 100`으로 냈는데, /home은 예산 미설정 달에
  // amountKrw: 0을 주므로 분모가 1이 되어 지출 한 건에 "예산 0원 · 100% 사용 중"이라는
  // 허위 표시가 됐다. 예산이 없으면 퍼센트 자체를 만들지 않는다(hasBudget: false).
  const budgetProgress = evaluateHomeBudgetProgress({ budgetKrw: budget, spentKrw: monthlyUsed });
  const progress = budgetProgress.percent ?? 0;
  // HOME-BUDGET-113: session-gated like NOTI-102 so the logged-out preview stays inert.
  // usedAmountKrw is the gift-excluded month total (DNC-015), see budget-warning.ts.
  const budgetWarning = hasSession ? evaluateBudgetWarning({ budgetKrw: budget, spentKrw: monthlyUsed }) : null;
  // REP-121: 세션이 있을 때만 계산한다 -- 비세션 픽셀락 미리보기(previewHome)에는 지난달 데이터가
  // 없으므로 한 줄이 아예 렌더되지 않고, 미리보기 스크린샷은 기존과 동일하게 유지된다. 지난달에
  // 기록이 없는 첫 달 사용자도 순수 모듈이 null을 돌려줘 렌더되지 않는다.
  const lastMonthInsight = hasSession
    ? evaluateLastMonthComparison({
        todayIso: seoulToday,
        thisMonthToDateKrw: monthlyUsed,
        lastMonthRecords: lastMonthExpenses.data?.expenses ?? null
      })
    : null;
  // HOME-127: 넛지 카드의 문구·경로도 같은 순수 모듈이 고른다.
  //  - 예산이 없으면 "월 예산 설정하기" CTA가 되어 /budget으로 보낸다. 홈에는 예산을 정할
  //    진입점이 아예 없어서(설정 탭·알림에서만 닿았다) 허위 퍼센트를 지우기만 하면 사용자가
  //    할 수 있는 일이 사라지기 때문이다.
  //  - 예산이 있으면 문구·경로 모두 종전과 동일하다. 라운드 13 m-7: 초과 금액은
  //    HOME-BUDGET-113 배너가 상위 정보로 이미 알리므로, 배너가 보이는 동안에는 넛지가
  //    "예산을 N원 초과했어요"를 중복 렌더하지 않는다(hasWarningBanner).
  const budgetNudge = buildHomeBudgetNudge({
    budgetKrw: budget,
    spentKrw: monthlyUsed,
    hasWarningBanner: Boolean(budgetWarning)
  });
  // UX-A: 아래 세 가지는 전부 세션이 있을 때만 계산한다 -- 비세션 픽셀락 미리보기(previewHome)에는
  // 아이의 실제 날짜도 지출 행도 없으므로 아무것도 렌더되지 않고, HOME-001 캡처는 종전 그대로다
  // (REP-121 한 줄과 같은 관례). 셋 다 순수 모듈이 null을 돌려주면 그 자리는 비어 있는다.
  const babyCounter = hasSession
    ? evaluateBabyCounter({
        stageMode: selectedChild?.stageMode,
        nickname: selectedChild?.nickname ?? visibleHome.child.nickname,
        dueDate: selectedChild?.dueDate,
        birthDate: selectedChild?.birthDate,
        todayIso: seoulToday
      })
    : null;
  const weeklySummary = hasSession
    ? evaluateWeeklySummary({
        todayIso: seoulToday,
        thisMonthRecords: thisMonthExpenses.data?.expenses ?? null,
        lastMonthRecords: lastMonthExpenses.data?.expenses ?? null
      })
    : null;
  const milestoneCountdown = hasSession
    ? evaluateMilestoneCountdown({
        stageMode: selectedChild?.stageMode,
        birthDate: selectedChild?.birthDate,
        nickname: selectedChild?.nickname ?? visibleHome.child.nickname,
        todayIso: seoulToday,
        // 누적 총액은 홈 캐시가 이미 들고 있는 서버 집계다(선물 제외, DNC-015). 비세션
        // 미리보기 픽스처에는 없는 필드라 home.data에서 직접 읽는다.
        totalExpenseKrw: home.data?.totalExpenseKrw ?? null
      })
    : null;
  // NOTI-102: 알림 센터가 실제 기능이 되어 UX-5B-8에서 숨겼던 홈 알림 벨을 미확인 배지와 함께 복원.
  return (
    <AppScreen refreshControl={refreshControl}>
      <View testID="pixel-screen-HOME-001" style={homePixelScaleFrameStyle()}>
        <View style={homePixelFrameStyle()}>
          {babyCounter ? (
            // UX-A: 홈을 여는 사람이 가장 먼저 보는 줄. 단계 라벨은 아이브로우로 남고, 화면에
            // 그리는 "D-32"는 TalkBack이 "디 마이너스 삼십이"로 읽으므로 소리용 문장을 따로 준다.
            <View style={homeBabyCounterStyle.header}>
              <View style={homeBabyCounterStyle.copy}>
                <Text style={homeBabyCounterStyle.eyebrow}>{visibleHome.child.stageLabel}</Text>
                <Text
                  accessible
                  accessibilityRole="header"
                  accessibilityLabel={babyCounter.accessibilityLabel}
                  testID="home-baby-counter"
                  style={homeBabyCounterStyle.title}
                >
                  {babyCounter.title}
                </Text>
                <Text style={homeBabyCounterStyle.subtitle}>우리 아이에게 해준 것을 따뜻하게 기록해요.</Text>
              </View>
              <NotificationBell />
            </View>
          ) : (
            <ScreenHeader
              title={`${visibleHome.child.nickname} ${visibleHome.child.stageLabel}`}
              subtitle="우리 아이에게 해준 것을 따뜻하게 기록해요."
              action={<NotificationBell />}
            />
          )}

          <HeroSummaryCard
            label="이번 달 지출"
            amount={formatKrw(monthlyUsed)}
            subtext={budgetProgress.subtext}
            progress={progress}
            showProgress={budgetProgress.hasBudget}
          />

          {budgetWarning ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${budgetWarning.title}. ${budgetWarning.body}`}
              testID="home-budget-warning-banner"
              style={[
                homeBudgetWarningStyle.banner,
                budgetWarning.level === "exceeded"
                  ? homeBudgetWarningStyle.bannerExceeded
                  : homeBudgetWarningStyle.bannerApproaching,
                theme.shadows.card
              ]}
            >
              <Text
                style={[
                  homeBudgetWarningStyle.icon,
                  budgetWarning.level === "exceeded"
                    ? homeBudgetWarningStyle.iconExceeded
                    : homeBudgetWarningStyle.iconApproaching
                ]}
              >
                ⚠
              </Text>
              <View style={homeBudgetWarningStyle.copy}>
                <Text style={homeBudgetWarningStyle.title}>{budgetWarning.title}</Text>
                <Text style={homeBudgetWarningStyle.body}>{budgetWarning.body}</Text>
              </View>
            </View>
          ) : null}

          {weeklySummary ? (
            <View
              accessible
              accessibilityLabel={weeklySummary.accessibilityLabel}
              testID="home-weekly-summary"
              style={[homeWeeklySummaryStyle.card, theme.shadows.card]}
            >
              <View style={homeWeeklySummaryStyle.row}>
                <Text accessible={false} style={homeWeeklySummaryStyle.glyph}>
                  ▦
                </Text>
                <Text style={homeWeeklySummaryStyle.text}>{weeklySummary.text}</Text>
              </View>
              <Text style={homeWeeklySummaryStyle.streak}>{weeklySummary.streakText}</Text>
            </View>
          ) : null}

          {milestoneCountdown ? (
            // 탭하면 리포트 탭 -- 그 탭이 100일/첫돌 마일스톤 리포트를 이미 연다(REP-127).
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={milestoneCountdown.accessibilityLabel}
              testID="home-milestone-countdown"
              onPress={() => router.push("/(tabs)/reports")}
            >
              <Card style={homeMilestoneStyle.card}>
                <View style={homeMilestoneStyle.iconBox}>
                  <Text accessible={false} style={homeMilestoneStyle.icon}>
                    ★
                  </Text>
                </View>
                <View style={homeMilestoneStyle.copy}>
                  <Text style={homeMilestoneStyle.title}>{milestoneCountdown.title}</Text>
                  <Text style={homeMilestoneStyle.subtitle}>{milestoneCountdown.subtitle}</Text>
                </View>
                <View accessible={false} style={homeBudgetNudgeArrowStyle.button}>
                  <Text accessible={false} style={homeBudgetNudgeArrowStyle.glyph}>
                    ›
                  </Text>
                </View>
              </Card>
            </Pressable>
          ) : null}

          <View style={{ flexDirection: "row", gap: 8 }}>
            <QuickActionIconButton icon="▣" label="지출 기록" onPress={() => router.push("/expenses/new")} />
            <QuickActionIconButton icon="☆" label="추천템" onPress={() => router.push("/(tabs)/items")} />
            <QuickActionIconButton icon="▥" label="성장 리포트" onPress={() => router.push("/(tabs)/reports")} />
            <QuickActionIconButton icon="☰" label="더보기" onPress={() => router.push("/(tabs)/more")} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${budgetNudge.title} ${budgetNudge.subtitle}`}
            testID={budgetNudge.variant === "set-budget" ? "home-set-budget-cta" : "home-budget-nudge"}
            onPress={() => router.push(budgetNudge.route)}
          >
            <Card style={homeBudgetNudgeStyle.card}>
              <View style={homeBudgetNudgeStyle.iconBox}>
                <Text style={homeBudgetNudgeStyle.icon}>▮</Text>
              </View>
              <View style={homeBudgetNudgeStyle.copy}>
                <Text style={homeBudgetNudgeStyle.title}>{budgetNudge.title}</Text>
                <Text style={homeBudgetNudgeStyle.subtitle}>{budgetNudge.subtitle}</Text>
              </View>
              <View accessible={false} style={homeBudgetNudgeArrowStyle.button}>
                <Text accessible={false} style={homeBudgetNudgeArrowStyle.glyph}>›</Text>
              </View>
            </Card>
          </Pressable>

          {lastMonthInsight ? (
            <View
              accessible
              accessibilityLabel={lastMonthInsight.text}
              testID="home-last-month-insight"
              style={[homeLastMonthInsightStyle.card, theme.shadows.card]}
            >
              <Text accessible={false} style={homeLastMonthInsightStyle.glyph}>
                ▤
              </Text>
              <Text style={homeLastMonthInsightStyle.text}>{lastMonthInsight.text}</Text>
            </View>
          ) : null}

          <ScreenHeader
            title="최근 지출"
            action={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="최근 지출 전체 보기"
                hitSlop={12}
                onPress={() => router.push("/(tabs)/records")}
              >
                <Text style={{ color: theme.colors.brown, fontSize: 12, fontWeight: "700" }}>전체 보기</Text>
              </Pressable>
            }
          />
          {visibleHome.recentExpenses.length === 0 ? (
            // MOB-117 홈 최근 지출 빈 상태: 기록 탭(records.tsx)의 첫-기록 빈 상태 문구와 톤
            // 일치. 비세션 미리보기(previewHome)는 항상 3건이라 이 분기에 도달하지 않는다.
            <EmptyStateCard
              title="첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요."
              actionLabel="기록하기"
              onPress={() => router.push("/expenses/new")}
            />
          ) : (
            // HOME-124: 부제는 기록 탭과 **같은 함수**가 만든다. 예전에는 서버가 준 ISO 원본을
            // 그대로 그려("2026-08-27") 같은 지출이 기록 탭에서는 "8월 27일"로 보였고, 선물/환불
            // 행은 홈에서 일반 지출과 전혀 구분되지 않았다(기록 탭은 "선물 ·"/"환불 ·" 접두).
            // 비세션 미리보기 픽스처("오늘"/"05.20")는 formatSpentOn의 통과 규칙 + expenseType
            // "expense"라 출력이 한 글자도 바뀌지 않는다 -- HOME-001 픽셀락 캡처 유지.
            visibleHome.recentExpenses.slice(0, 3).map((expense) => (
              <ListRow
                key={expense.id}
                icon="▣"
                title={expense.itemName}
                subtitle={homeRecentExpenseSubtitle(expense)}
                value={formatKrw(expense.amountKrw)}
                onPress={() => router.push(`/expenses/${expense.id}`)}
              />
            ))
          )}

          <FloatingActionButton onPress={() => router.push("/expenses/new")} />
        </View>
      </View>
    </AppScreen>
  );
}
