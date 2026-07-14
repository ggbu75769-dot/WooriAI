import { useQuery } from "@tanstack/react-query";
import { Redirect, router, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { getHome, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { formatKrw } from "../../src/money";
import { HomePixelStyles } from "../../src/pixelLock/styles/HomePixelStyles";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import {
  AppIcon,
  AppScreen,
  Card,
  CategoryChip,
  EmptyStateCard,
  HeroSummaryCard,
  IconButton,
  ListRow,
  PrimaryButton,
  SampleDataBanner,
  StatusBadge
} from "../../src/ui";

const isPixelLockMode = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";

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

const previewHome = {
  child: { id: "pixel-child", nickname: "우리아이", currentStage: "toddler", stageLabel: "생후 24개월" },
  monthly: {
    childId: "pixel-child",
    yearMonth: "2026-07",
    amountKrw: 1_600_000,
    usedAmountKrw: 428_000,
    remainingAmountKrw: 1_172_000
  },
  recommendedItems: [
    { id: "preview-car-seat", name: "카시트", status: "not_prepared" },
    { id: "preview-picture-book", name: "그림책", status: "interested" },
    { id: "preview-training-cup", name: "연습용 컵", status: "not_prepared" }
  ],
  recentExpenses: [
    {
      id: "preview-expense-hospital",
      childId: "pixel-child",
      categoryId: "preview-category-hospital",
      amountKrw: 11_111,
      spentOn: "7월 13일",
      itemName: "병원비",
      expenseType: "expense",
      source: "manual"
    }
  ]
} as const;

const frequentItems = ["기저귀", "병원비", "분유"] as const;

export default function HomeScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const hasSession = Boolean(authToken && childId);
  const home = useQuery({
    queryKey: ["home", childId],
    enabled: hasSession,
    queryFn: () => getHome(authToken!, childId!)
  });

  if (!hasSession && !isPixelLockMode) {
    return <Redirect href="/onboarding/child-status" />;
  }

  if (hasSession && home.isLoading) {
    return (
      <AppScreen>
        {isTestSession ? <SampleDataBanner /> : null}
        <EmptyStateCard title="홈 정보를 불러오고 있어요." actionLabel="잠시만요" />
      </AppScreen>
    );
  }

  if (hasSession && home.isError) {
    return (
      <AppScreen>
        {isTestSession ? <SampleDataBanner /> : null}
        <EmptyStateCard
          title="홈 정보를 불러오지 못했어요."
          actionLabel="다시 시도"
          onPress={() => home.refetch()}
        />
      </AppScreen>
    );
  }

  const visibleHome = hasSession ? home.data : isPixelLockMode ? previewHome : null;
  if (!visibleHome) {
    return <Redirect href="/onboarding/child-status" />;
  }

  const monthlyUsed = visibleHome.monthly.usedAmountKrw;
  const budget = visibleHome.monthly.amountKrw;
  const hasExpenses = monthlyUsed > 0 || visibleHome.recentExpenses.length > 0;
  const progress = budget > 0 ? Math.round(Math.min(100, Math.max(0, (monthlyUsed / budget) * 100))) : 0;

  return (
    <AppScreen>
      <View accessibilityLabel="pixel-screen-HOME-001" testID="pixel-screen-HOME-001" style={homePixelScaleFrameStyle()}>
        <View style={homePixelFrameStyle()}>
          {isTestSession ? <SampleDataBanner /> : null}

          <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
            <Pressable
              accessibilityLabel="아이 전환"
              accessibilityRole="button"
              onPress={() => router.push("/children" as Href)}
              style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: 10, minHeight: theme.touchTarget }}
            >
              <AppIcon color={theme.colors.coral[600]} name="account-child-circle" size={36} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: theme.colors.brown, fontSize: 18, fontWeight: "800" }}>{visibleHome.child.nickname}</Text>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                  <StatusBadge label={visibleHome.child.stageLabel} />
                  <Text style={{ color: theme.colors.coral[600], fontSize: 11, fontWeight: "700" }}>아이 전환⌄</Text>
                </View>
              </View>
            </Pressable>
            <IconButton accessibilityLabel="내 프로필" icon="account-circle-outline" onPress={() => router.push("/settings")} />
          </View>

          {hasExpenses ? (
            <HeroSummaryCard
              label="이번 달 우리 아이 비용"
              amount={formatKrw(monthlyUsed)}
              subtext={budget > 0 ? `예산 ${formatKrw(budget)} 중` : "예산 미설정"}
              progress={budget > 0 ? progress : null}
            />
          ) : (
            <EmptyStateCard
              title="아직 지출 기록이 없어요. 첫 기록을 남기면 월 비용과 리포트를 만들어드릴게요."
              actionLabel="첫 지출 기록하기"
              onPress={() => router.push("/expenses/new")}
            />
          )}

          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.brown, fontSize: 17, fontWeight: "800" }}>자주 기록해요</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {frequentItems.map((itemName) => (
                <CategoryChip
                  key={itemName}
                  label={itemName}
                  onPress={() => router.push({ pathname: "/expenses/new", params: { itemName } })}
                />
              ))}
              <CategoryChip label="+ 직접 입력" onPress={() => router.push("/expenses/new")} />
            </View>
          </View>

          <Card style={{ gap: 12 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              <AppIcon color={theme.colors.coral[600]} name="package-variant-closed" />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>이번 주 준비 현황</Text>
                <Text style={{ color: theme.colors.gray600, fontSize: 13 }}>
                  지금 필요한 준비템 {visibleHome.recommendedItems.length}개
                </Text>
              </View>
            </View>
            <PrimaryButton label="지금 필요한 준비템 보기" onPress={() => router.push("/(tabs)/items")} />
          </Card>

          {visibleHome.recentExpenses.length > 0 ? (
            <View style={{ gap: 10 }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.colors.brown, fontSize: 17, fontWeight: "800" }}>최근 기록</Text>
                <Pressable accessibilityLabel="최근 기록 전체 보기" onPress={() => router.push("/(tabs)/records")}>
                  <Text style={{ color: theme.colors.coral[600], fontSize: 12, fontWeight: "700" }}>전체 보기</Text>
                </Pressable>
              </View>
              {visibleHome.recentExpenses.slice(0, 3).map((expense) => (
                <ListRow
                  key={expense.id}
                  icon={<AppIcon color={theme.colors.coral[600]} name="receipt" size={20} />}
                  title={expense.itemName}
                  subtitle={expense.spentOn}
                  value={formatKrw(expense.amountKrw)}
                  onPress={() => router.push(`/expenses/${expense.id}`)}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </AppScreen>
  );
}
