import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { getHome, listExpenses, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { homeRecentExpenseSubtitle } from "../../src/expenses/records-list-view";
import { evaluateBudgetWarning } from "../../src/home/budget-warning";
import { evaluateLastMonthComparison, previousYearMonth } from "../../src/home/last-month-comparison";
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
  const lastMonthExpenses = useQuery({
    queryKey: ["expenses", childId, lastYearMonth],
    enabled: Boolean(authToken && childId && lastYearMonth),
    queryFn: () => listExpenses(authToken!, childId!, lastYearMonth!)
  });
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

  if (hasSession && (home.isLoading || !home.data)) {
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

  if (hasSession && home.isError) {
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

  const visibleHome = hasSession ? home.data! : previewHome;
  const monthlyUsed = visibleHome.monthly.usedAmountKrw;
  const budget = visibleHome.monthly.amountKrw;
  const rawProgress = (monthlyUsed / Math.max(1, budget)) * 100;
  const progress = Math.round(Math.min(100, Math.max(0, rawProgress)));
  // budget === 0 means "no budget set" (home API returns amountKrw: 0 then) -- never call
  // that state "over budget"; strict > also avoids "₩0 초과" when spending equals the budget.
  const isOverBudget = hasSession && budget > 0 && monthlyUsed > budget;
  const overAmount = monthlyUsed - budget;
  // HOME-BUDGET-113: session-gated like isOverBudget/NOTI-102 so the logged-out preview stays
  // inert. usedAmountKrw is the gift-excluded month total (DNC-015), see budget-warning.ts.
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
  // 라운드 13 m-7: 초과 금액은 HOME-BUDGET-113 배너가 상위 정보로 이미 알린다. 배너가 보이는
  // 동안(임박·초과)에는 넛지가 "예산을 N원 초과했어요"를 중복 렌더하지 않고, 초과 상태에서는
  // 금액 없는 "예산을 모두 사용했어요."로 대체한다. 배너가 없을 때(80% 미만 등)는 기존 동작 유지.
  const showNudgeOverAmountCopy = isOverBudget && !budgetWarning;
  const budgetNudgeTitle = showNudgeOverAmountCopy
    ? `예산을 ${formatKrw(overAmount)} 초과했어요.`
    : isOverBudget
      ? "예산을 모두 사용했어요."
      : `예산의 ${progress}% 사용 중이에요!`;
  const budgetNudgeSubtitle = isOverBudget
    ? "이번 달 지출을 확인해 볼까요? 😥"
    : "이번 달도 잘 관리하고 있어요 👏";
  // NOTI-102: 알림 센터가 실제 기능이 되어 UX-5B-8에서 숨겼던 홈 알림 벨을 미확인 배지와 함께 복원.
  return (
    <AppScreen refreshControl={refreshControl}>
      <View testID="pixel-screen-HOME-001" style={homePixelScaleFrameStyle()}>
        <View style={homePixelFrameStyle()}>
          <ScreenHeader
            title={`${visibleHome.child.nickname} ${visibleHome.child.stageLabel}`}
            subtitle="우리 아이에게 해준 것을 따뜻하게 기록해요."
            action={<NotificationBell />}
          />

          <HeroSummaryCard
            label="이번 달 지출"
            amount={formatKrw(monthlyUsed)}
            subtext={`예산 ${formatKrw(budget)}`}
            progress={progress}
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

          <View style={{ flexDirection: "row", gap: 8 }}>
            <QuickActionIconButton icon="▣" label="지출 기록" onPress={() => router.push("/expenses/new")} />
            <QuickActionIconButton icon="☆" label="추천템" onPress={() => router.push("/(tabs)/items")} />
            <QuickActionIconButton icon="▥" label="성장 리포트" onPress={() => router.push("/(tabs)/reports")} />
            <QuickActionIconButton icon="☰" label="더보기" onPress={() => router.push("/(tabs)/more")} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${budgetNudgeTitle} ${budgetNudgeSubtitle}`}
            onPress={() => router.push("/(tabs)/items")}
          >
            <Card style={homeBudgetNudgeStyle.card}>
              <View style={homeBudgetNudgeStyle.iconBox}>
                <Text style={homeBudgetNudgeStyle.icon}>▮</Text>
              </View>
              <View style={homeBudgetNudgeStyle.copy}>
                <Text style={homeBudgetNudgeStyle.title}>{budgetNudgeTitle}</Text>
                <Text style={homeBudgetNudgeStyle.subtitle}>{budgetNudgeSubtitle}</Text>
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
