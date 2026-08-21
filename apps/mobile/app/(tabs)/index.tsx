import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { getHome, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { evaluateBudgetWarning } from "../../src/home/budget-warning";
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
            visibleHome.recentExpenses.slice(0, 3).map((expense) => (
              <ListRow
                key={expense.id}
                icon="▣"
                title={expense.itemName}
                subtitle={expense.spentOn}
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
