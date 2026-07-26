import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Redirect, router, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";
import {
  getCatalogItem,
  getHome,
  getTodayPreferenceResolution,
  listHouseholdMembers,
  updateTodayPreference
} from "../../src/api/client";
import {
  fixtureSessionToken,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_USER_ID,
  pixelEvidenceId
} from "../../src/api/fixture-identifiers";
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
import { resolveOfflineScopeKey } from "../../src/offline/session-scope";
import {
  canManagePurchaseFollowup,
  loadVisiblePurchaseFollowup,
  removePurchaseFollowup,
  snoozePurchaseFollowup,
  subscribePurchaseFollowups,
  type PurchaseFollowup
} from "../../src/purchase-followup/store";
import { resolveVerifiedPurchaseRole } from "../../src/purchase-followup/access-context";
import {
  PurchaseFollowupCard,
  purchaseExpenseRouteParams
} from "../../src/purchase-followup/PurchaseFollowupCard";
import { TodayCenterCard } from "../../src/home/TodayCenterCard";
import { todayActionHref } from "../../src/home/today-center";
import { executeTodaySnooze } from "../../src/home/today-center-mutation";

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

const frequentExpenseActions = [
  { label: "기저귀", itemName: "기저귀" },
  { label: "병원비", itemName: "병원비" },
  { label: "분유", itemName: "분유" }
] as const;

function PixelHomeScreen() {
  const progress = Math.round((previewHome.monthly.usedAmountKrw / previewHome.monthly.amountKrw) * 100);
  const recentExpense = previewHome.recentExpenses[0];
  const recentVisual = expenseCategoryVisual(recentExpense.categoryId);

  return (
    <AppScreen>
      <View
        accessibilityLabel={pixelEvidenceId("HOME-001")}
        style={{ backgroundColor: theme.colors.coral[50], flex: 1, gap: theme.spacing.card, margin: -theme.spacing.screen, padding: theme.spacing.screen }}
        testID={pixelEvidenceId("HOME-001")}
      >
        <View style={{ alignItems: "center", flexDirection: "row", minHeight: theme.touchTarget }}>
          <Pressable
            accessibilityLabel="아이 전환"
            accessibilityRole="button"
            onPress={() => router.push("/children" as Href)}
            style={({ pressed }) => ({ alignItems: "center", flex: 1, flexDirection: "row", gap: 10, opacity: pressed ? 0.76 : 1 })}
          >
            <AppIcon color={theme.colors.coral[500]} name="account-child-circle" size={34} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 17, fontWeight: "800" }}>{previewHome.child.nickname}</Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: "700" }}>{previewHome.child.stageLabel}</Text>
                <Text style={{ color: theme.colors.coral[500], fontSize: 11, fontWeight: "700" }}>아이 전환⌄</Text>
              </View>
            </View>
          </Pressable>
          <IconButton accessibilityLabel="내 프로필" icon="account-circle-outline" onPress={() => router.push("/(tabs)/more" as Href)} />
        </View>

        <View
          accessibilityLabel={`이번 달 우리 아이 비용 ${formatKrw(previewHome.monthly.usedAmountKrw)}, 예산 사용률 ${progress}퍼센트`}
          accessibilityRole="summary"
          style={{ backgroundColor: theme.colors.subCoral, borderRadius: theme.radii.card, gap: 8, justifyContent: "center", minHeight: 140, padding: theme.spacing.card }}
        >
          <Text style={{ color: theme.colors.white, fontSize: 12, fontWeight: "700" }}>이번 달 우리 아이 비용</Text>
          <Text style={{ color: theme.colors.white, fontSize: 27, fontWeight: "800" }}>{formatKrw(previewHome.monthly.usedAmountKrw)}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: theme.colors.white, fontSize: 11 }}>예산 {formatKrw(previewHome.monthly.amountKrw)} 중</Text>
            <Text style={{ color: theme.colors.white, fontSize: 11, fontWeight: "800" }}>{progress}%</Text>
          </View>
          <View
            accessibilityLabel={`예산 사용률 ${progress}퍼센트`}
            accessibilityRole="progressbar"
            accessibilityValue={{ max: 100, min: 0, now: progress }}
            style={{ backgroundColor: theme.colors.coral[200], borderRadius: theme.radii.pill, height: 8, overflow: "hidden" }}
          >
            <View style={{ backgroundColor: theme.colors.white, borderRadius: theme.radii.pill, height: 8, width: `${progress}%` }} />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: "800" }}>자주 기록해요</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {frequentExpenseActions.map((action) => (
              <PixelHomeActionChip key={action.label} label={action.label} onPress={() => router.push({ pathname: "/expenses/new", params: { itemName: action.itemName } })} />
            ))}
            <PixelHomeActionChip label="+ 직접 입력" onPress={() => router.push("/expenses/new")} />
          </View>
        </View>

        <Card style={{ gap: 10, minHeight: 140, padding: 14 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
            <AppIcon color={theme.colors.coral[500]} name="package-variant-closed" size={21} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: "800" }}>이번 주 준비 현황</Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>지금 필요한 준비템 {previewHome.recommendedItems.length}개</Text>
            </View>
          </View>
          <Pressable
            accessibilityLabel="지금 필요한 준비템 보기"
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/items")}
            style={({ pressed }) => ({ alignItems: "center", backgroundColor: theme.colors.subCoral, borderRadius: theme.radii.small, justifyContent: "center", minHeight: 52, opacity: pressed ? 0.82 : 1 })}
          >
            <Text style={{ color: theme.colors.white, fontSize: 14, fontWeight: "800" }}>지금 필요한 준비템 보기</Text>
          </Pressable>
        </Card>

        <View style={{ gap: 8 }}>
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Text accessibilityRole="header" style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: "800" }}>최근 기록</Text>
            <Pressable accessibilityLabel="최근 기록 전체 보기" accessibilityRole="button" onPress={() => router.push("/(tabs)/records")} style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget, minWidth: theme.touchTarget }}>
              <Text style={{ color: theme.colors.coral[500], fontSize: 12, fontWeight: "700" }}>전체 보기</Text>
            </Pressable>
          </View>
          <ListRow
            icon={<AppIcon color={recentVisual.iconColor} name={recentVisual.icon} size={19} />}
            iconBackgroundColor={recentVisual.iconBackgroundColor}
            onPress={() => router.push(expenseDetailRoute(recentExpense.id))}
            subtitle={recentExpense.spentOn}
            title={recentExpense.itemName}
            value={formatKrw(recentExpense.amountKrw)}
          />
        </View>
      </View>
    </AppScreen>
  );
}

function PixelHomeActionChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", backgroundColor: theme.colors.white, borderColor: theme.colors.gray300, borderRadius: theme.radii.pill, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: theme.touchTarget, opacity: pressed ? 0.78 : 1, paddingHorizontal: 6 })}
    >
      <Text numberOfLines={1} style={{ color: theme.colors.textPrimary, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const currentUserId = useSessionStore((state) => state.userId);
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const selectedChildHouseholdId = useSelectedChildStore((state) => state.selectedChildHouseholdId);
  const [purchaseFollowup, setPurchaseFollowup] = useState<PurchaseFollowup | null>(null);
  const syncSnapshot = useOfflineSyncSnapshot();
  const online = useConnectivityStatus();
  const syncStatus = normalizeAppSyncStatus(syncSnapshot.counts, online);
  const hasSession = childScopedRequestEnabled(authToken, childId);
  const home = useQuery({
    queryKey: ["home", childId],
    enabled: hasSession,
    queryFn: () => getHome(authToken!, childId!)
  });
  useEffect(() => {
    const resolvedChild = home.data?.child;
    if (
      resolvedChild?.id === childId &&
      resolvedChild.householdId &&
      resolvedChild.householdId !== selectedChildHouseholdId
    ) {
      useSelectedChildStore.getState().setSelectedChildId(childId!, resolvedChild.householdId);
    }
  }, [childId, home.data?.child, selectedChildHouseholdId]);
  const purchaseHouseholdId = isTestSession
    ? LOCAL_HOUSEHOLD_ID
    : home.data?.child.householdId ?? selectedChildHouseholdId ?? null;
  const purchaseScopeKey = resolveOfflineScopeKey({
    accessToken,
    userId: currentUserId,
    defaultHouseholdId: purchaseHouseholdId,
    isTestSession,
    testUserId: LOCAL_USER_ID,
    testHouseholdId: LOCAL_HOUSEHOLD_ID
  });
  const followupItem = useQuery({
    queryKey: ["purchase-followup-item", childId, purchaseFollowup?.itemDefinitionId],
    enabled: Boolean(!isPixelLockMode && authToken && childId && purchaseFollowup),
    queryFn: () => getCatalogItem(authToken!, purchaseFollowup!.itemDefinitionId, childId!)
  });
  const members = useQuery({
    queryKey: ["household-members", purchaseHouseholdId],
    enabled: Boolean(!isPixelLockMode && purchaseFollowup && authToken && purchaseHouseholdId && !isTestSession),
    queryFn: () => listHouseholdMembers(authToken!, purchaseHouseholdId!)
  });

  useEffect(() => {
    setPurchaseFollowup(null);
    if (isPixelLockMode || !purchaseScopeKey || !childId) {
      return;
    }
    let active = true;
    const refresh = () => {
      void loadVisiblePurchaseFollowup(purchaseScopeKey, childId).then((followup) => {
        if (
          active &&
          useSelectedChildStore.getState().selectedChildId === childId
        ) {
          setPurchaseFollowup(followup);
        }
      }).catch(() => {
        if (active) setPurchaseFollowup(null);
      });
    };
    refresh();
    const unsubscribe = subscribePurchaseFollowups(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [childId, purchaseScopeKey]);
  if (!hasSession && !isPixelLockMode) {
    return <Redirect href="/onboarding/child-status" />;
  }

  if (hasSession && !isPixelLockMode && home.isLoading) {
    return (
      <AppScreen>
        {isTestSession ? <SampleDataBanner /> : null}
        <EmptyStateCard title="홈 정보를 불러오고 있어요." actionLabel="잠시만요" />
      </AppScreen>
    );
  }

  if (hasSession && !isPixelLockMode && home.isError) {
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

  if (isPixelLockMode) {
    return <PixelHomeScreen />;
  }

  const monthlyUsed = visibleHome.monthly.usedAmountKrw;
  const budget = visibleHome.monthly.amountKrw;
  const currentRole = childId
    ? resolveVerifiedPurchaseRole({
        expectedChildId: childId,
        child: visibleHome.child,
        queriedHouseholdId: purchaseHouseholdId,
        currentUserId,
        members: members.data?.members ?? []
      })
    : null;
  const canHandlePurchaseFollowup = canManagePurchaseFollowup({
    childContext: Boolean(childId),
    isTestSession,
    role: currentRole
  });
  const visiblePurchaseFollowup =
    canHandlePurchaseFollowup &&
    purchaseFollowup?.scopeKey === purchaseScopeKey &&
    purchaseFollowup.childId === childId
      ? purchaseFollowup
      : null;
  const followupItemName = followupItem.data?.nameKo ?? "확인한 준비템";
  const refetchTodayActions = async () => {
    const refreshed = await home.refetch();
    if (refreshed.error) throw refreshed.error;
    return refreshed.data?.todayCenter?.actions ?? [];
  };
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

          {!isPixelLockMode && visibleHome.todayCenter ? (
            <TodayCenterCard
              center={visibleHome.todayCenter}
              onNavigate={(action) => router.push(todayActionHref(action) as Href)}
              onRefresh={async () => { await refetchTodayActions(); }}
              onSnooze={(action) => executeTodaySnooze({
                action,
                write: () => updateTodayPreference(authToken!, {
                  householdId: purchaseHouseholdId!,
                  childId: action.preferenceScope.childId,
                  actionKey: action.actionKey,
                  mode: "snooze",
                  expectedVersion: action.preferenceVersion
                }),
                resolveExact: () => getTodayPreferenceResolution(authToken!, {
                  householdId: purchaseHouseholdId!,
                  childId: action.preferenceScope.childId,
                  actionKey: action.actionKey
                }),
                refetchActions: refetchTodayActions
              })}
            />
          ) : null}

          {visiblePurchaseFollowup ? (
            <PurchaseFollowupCard
              followup={visiblePurchaseFollowup}
              itemName={followupItemName}
              onRecord={() => router.push(
                purchaseExpenseRouteParams(
                  visiblePurchaseFollowup,
                  followupItem.data?.nameKo ?? ""
                )
              )}
              onRemove={() => void removePurchaseFollowup(visiblePurchaseFollowup.intentId)}
              onReviewSync={() => router.push("/sync-status" as Href)}
              onSnooze={() => void snoozePurchaseFollowup(visiblePurchaseFollowup.intentId)}
            />
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
