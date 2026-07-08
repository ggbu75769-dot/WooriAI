import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getHome } from "../../src/api/client";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import {
  AppScreen,
  Card,
  FloatingActionButton,
  HeroSummaryCard,
  ListRow,
  QuickActionIconButton,
  ScreenHeader
} from "../../src/ui";
import { theme } from "../../src/theme";

const homeHorizontalOffset = 0;
const homeVerticalOffset = 0;
const homePixelScale = 1;
const homePixelScaleX = 1;
const homeScaleHorizontalOffset = 0;
const homeScaleVerticalOffset = 0;
const homePixelScaleFrameStyle = {
  transform: [
    { translateX: homeScaleHorizontalOffset },
    { translateY: homeScaleVerticalOffset },
    { scale: homePixelScale },
    { scaleX: homePixelScaleX }
  ]
} as const;
const homePixelFrameStyle = {
  gap: theme.spacing.section,
  transform: [{ translateX: homeHorizontalOffset }, { translateY: homeVerticalOffset }]
};

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

function formatKrw(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export default function HomeScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const home = useQuery({
    queryKey: ["home", childId],
    enabled: Boolean(accessToken && childId),
    queryFn: () => getHome(accessToken!, childId!)
  });

  const visibleHome = home.data ?? previewHome;
  const monthlyUsed = visibleHome.monthly.usedAmountKrw;
  const budget = visibleHome.monthly.amountKrw;
  const progress = Math.round(Math.min(100, Math.max(0, (monthlyUsed / Math.max(1, budget)) * 100)));

  return (
    <AppScreen>
      <View accessibilityLabel="pixel-screen-HOME-001" testID="pixel-screen-HOME-001" style={homePixelScaleFrameStyle}>
        <View style={homePixelFrameStyle}>
          <ScreenHeader
            eyebrow="HOME-001"
            title={`${visibleHome.child.nickname} ${visibleHome.child.stageLabel}`}
            subtitle="우리 아이에게 해준 것을 따뜻하게 기록해요."
            action={<Text style={{ color: theme.colors.mainCoral, fontSize: 20 }}>🔔</Text>}
          />

          <HeroSummaryCard
            label="이번 달 지출"
            amount={formatKrw(monthlyUsed)}
            subtext={`예산 ${formatKrw(budget)}`}
            progress={progress}
          />

          <View style={{ flexDirection: "row", gap: 8 }}>
            <QuickActionIconButton icon="▣" label="지출 기록" onPress={() => router.push("/expenses/new")} />
            <QuickActionIconButton icon="☆" label="추천템" onPress={() => router.push("/(tabs)/items")} />
            <QuickActionIconButton icon="▥" label="성장 리포트" onPress={() => router.push("/(tabs)/reports")} />
            <QuickActionIconButton icon="☰" label="더보기" onPress={() => router.push("/(tabs)/more")} />
          </View>

          <Pressable onPress={() => router.push("/(tabs)/items")}>
            <Card style={homeBudgetNudgeStyle.card}>
              <View style={homeBudgetNudgeStyle.iconBox}>
                <Text style={homeBudgetNudgeStyle.icon}>▮</Text>
              </View>
              <View style={homeBudgetNudgeStyle.copy}>
                <Text style={homeBudgetNudgeStyle.title}>예산의 {progress}% 사용 중이에요!</Text>
                <Text style={homeBudgetNudgeStyle.subtitle}>이번 달도 잘 관리하고 있어요 👏</Text>
              </View>
              <View style={homeBudgetNudgeArrowStyle.button}>
                <Text style={homeBudgetNudgeArrowStyle.glyph}>›</Text>
              </View>
            </Card>
          </Pressable>

          <ScreenHeader title="최근 지출" action={<Text style={{ color: theme.colors.brown, fontSize: 12, fontWeight: "700" }}>전체 보기</Text>} />
          {visibleHome.recentExpenses.slice(0, 3).map((expense) => (
            <ListRow
              key={expense.id}
              icon="▣"
              title={expense.itemName}
              subtitle={expense.spentOn}
              value={formatKrw(expense.amountKrw)}
              onPress={() => router.push(`/expenses/${expense.id}`)}
            />
          ))}

          <FloatingActionButton onPress={() => router.push("/expenses/new")} />
        </View>
      </View>
    </AppScreen>
  );
}
