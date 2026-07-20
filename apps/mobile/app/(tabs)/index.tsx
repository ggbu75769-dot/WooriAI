import { useQuery } from "@tanstack/react-query";
import { Redirect, router, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { getHome } from "../../src/api/client";
import { fixtureSessionToken, pixelEvidenceId } from "../../src/api/fixture-identifiers";
import { formatKrw } from "../../src/money";
import { expenseDetailRoute } from "../../src/navigation/routes";
import { expenseCategoryVisual } from "../../src/preparation/item-visuals";
import { isPixelLockBuild } from "../../src/pixelLock/build-profile";
import { useConnectivityStatus } from "../../src/offline/connectivity";
import { useOfflineSyncSnapshot } from "../../src/offline/sync-snapshot";
import { normalizeAppSyncStatus } from "../../src/offline/sync-display-state";
import {
  AppIcon,
  AppScreen,
  Card,
  EmptyStateCard,
  IconButton,
  ListRow,
  PrimaryButton,
  SampleDataBanner,
  type AppIconName
} from "../../src/design-system/components/ApplicationPrimitives";
import { ChildSwitcher } from "../../src/design-system/components/CorePrimitives";
import { BudgetSummary } from "../../src/design-system/components/ModV1Primitives";
import { SyncStatusBar } from "../../src/design-system/patterns/AsyncState";
import { childScopedRequestEnabled } from "../../src/query/child-scope";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";

const isPixelLockMode = isPixelLockBuild();

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
  ],
  todayCenter: null
} as const;

const quickActions: Array<{ label: string; icon: AppIconName; route: Href }> = [
  { label: "지출 기록", icon: "pencil-plus-outline", route: "/expenses/new" },
  { label: "준비템", icon: "basket-outline", route: "/(tabs)/items" },
  { label: "리포트", icon: "chart-box-outline", route: "/(tabs)/reports" },
  { label: "프로필", icon: "account-circle-outline", route: "/(tabs)/more" }
];

export default function HomeScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const syncSnapshot = useOfflineSyncSnapshot();
  const online = useConnectivityStatus();
  const syncStatus = normalizeAppSyncStatus(syncSnapshot.counts, online);
  const hasSession = childScopedRequestEnabled(authToken, childId);
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
  return (
    <AppScreen>
      <View accessibilityLabel={pixelEvidenceId("HOME-001")} testID={pixelEvidenceId("HOME-001")}>
        <View style={{ gap: theme.spacing.section }}>
          {isTestSession ? <SampleDataBanner /> : null}

          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ChildSwitcher name={visibleHome.child.nickname} onPress={() => router.push("/children" as Href)} stage={visibleHome.child.stageLabel} />
            </View>
            <IconButton accessibilityLabel="알림" icon="bell-outline" onPress={() => router.push("/notifications" as Href)} />
          </View>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 }}>우리 아이에게 해준 것을 따뜻하게 기록해요.</Text>

          {!isPixelLockMode && visibleHome.todayCenter?.actions.length ? (
            <Card style={{ gap: 8 }}>
              <Text style={{ color: theme.colors.brown, fontSize: 17, fontWeight: "800" }}>오늘의 가족 준비</Text>
              <Text style={{ color: theme.colors.gray600, fontSize: 13 }}>지금 처리할 중요한 행동만 최대 3개 보여드려요.</Text>
              {visibleHome.todayCenter.actions.map((action) => (
                <ListRow
                  key={action.actionKey}
                  icon={<AppIcon color={action.kind === "safety_acknowledgement" ? theme.colors.danger : theme.colors.coral[600]} name={action.kind === "safety_acknowledgement" ? "shield-alert-outline" : "calendar-check-outline"} size={21} />}
                  title={action.reasonParams.itemName ? String(action.reasonParams.itemName) : "가족 준비 확인"}
                  subtitle={action.kind === "safety_acknowledgement" ? "공식 안전 안내를 확인해 주세요" : action.dueDate ? `${action.dueDate}까지 준비` : "준비 상태를 확인해 주세요"}
                  onPress={() => action.navigation.kind === "calendar"
                    ? router.push("/preparation-calendar" as Href)
                    : router.push(`/items/${action.sourceId}` as Href)}
                />
              ))}
            </Card>
          ) : null}

          <BudgetSummary budgetKrw={budget > 0 ? budget : null} usedKrw={monthlyUsed} />

          <View accessibilityLabel="빠른 실행" style={{ flexDirection: "row", gap: 8 }}>
            {quickActions.map((action) => <QuickAction key={action.label} {...action} />)}
          </View>

          {visibleHome.recommendedItems.length > 0 ? <Card style={{ gap: 12 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              <AppIcon color={theme.colors.coral[600]} name="package-variant-closed" />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>지금 준비할 것 {visibleHome.recommendedItems.length}개가 있어요</Text>
                <Text style={{ color: theme.colors.gray600, fontSize: 13 }}>
                  {visibleHome.child.stageLabel}에 맞는 준비 목록을 확인해 보세요.
                </Text>
              </View>
            </View>
            <PrimaryButton label="지금 필요한 준비템 보기" onPress={() => router.push("/(tabs)/items")} />
          </Card> : null}

          {visibleHome.recentExpenses.length > 0 ? (
            <View style={{ gap: 10 }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.colors.brown, fontSize: 17, fontWeight: "800" }}>최근 기록</Text>
                <Pressable accessibilityLabel="최근 기록 전체 보기" accessibilityRole="button" onPress={() => router.push("/(tabs)/records")} style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget, minWidth: theme.touchTarget }}>
                  <Text style={{ color: theme.colors.coral[600], fontSize: 12, fontWeight: "700" }}>전체 보기</Text>
                </Pressable>
              </View>
              {visibleHome.recentExpenses.slice(0, 3).map((expense) => {
                const visual = expenseCategoryVisual(expense.categoryId);
                return (
                  <ListRow
                    key={expense.id}
                    icon={<AppIcon color={visual.iconColor} name={visual.icon} size={20} />}
                    iconBackgroundColor={visual.iconBackgroundColor}
                    title={expense.itemName}
                    subtitle={expense.spentOn}
                    value={formatKrw(expense.amountKrw)}
                    onPress={() => router.push(expenseDetailRoute(expense.id))}
                  />
                );
              })}
            </View>
          ) : (
            <EmptyStateCard title="아직 지출 기록이 없어요." description="첫 기록을 남기면 최근 지출과 리포트를 만들어드릴게요." actionLabel="지출 기록하기" onPress={() => router.push("/expenses/new")} />
          )}

          <SyncStatusBar onPress={() => router.push("/sync-status" as Href)} status={syncStatus} />
        </View>
      </View>
    </AppScreen>
  );
}

function QuickAction({ label, icon, route }: { label: string; icon: AppIconName; route: Href }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={() => router.push(route)} style={({ pressed }) => ({ alignItems: "center", flex: 1, gap: 6, minHeight: 72, opacity: pressed ? 0.76 : 1 })}>
      <View style={{ alignItems: "center", backgroundColor: theme.colors.surface, borderColor: theme.colors.gray300, borderRadius: 16, borderWidth: 1, height: 48, justifyContent: "center", width: 48 }}>
        <AppIcon color={theme.colors.textPrimary} name={icon} size={21} />
      </View>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 11, fontWeight: "700", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}
