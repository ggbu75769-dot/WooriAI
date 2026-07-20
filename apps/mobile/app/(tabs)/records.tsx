import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { listExpenses, fixtureSessionToken } from "../../src/api/client";
import { categoryCatalog, categoryNameFor } from "../../src/categories";
import { formatKrw } from "../../src/money";
import { expenseDetailRoute } from "../../src/navigation/routes";
import { expenseCategoryVisual } from "../../src/preparation/item-visuals";
import { reconcileMonthlyExpenses } from "../../src/offline/expense-list-reconciliation";
import { useConnectivityStatus } from "../../src/offline/connectivity";
import { subscribeOfflineFlashMessage, useOfflineSyncSnapshot } from "../../src/offline/sync-controller";
import { normalizeAppSyncStatus } from "../../src/offline/sync-display-state";
import { childScopedRequestEnabled } from "../../src/query/child-scope";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppIcon, AppScreen, Card, CategoryChip, EmptyStateCard, ListRow, SampleDataBanner, StatusBadge, SyncStatusBar, Toast, TopAppBar } from "../../src/design-system";
import { theme } from "../../src/theme";

const recordsScreenId = "EXP-004";

function formatSpentOn(spentOn: string) {
  const parts = spentOn.split("-");
  if (parts.length !== 3) return spentOn;
  return `${Number(parts[1])}월 ${Number(parts[2])}일`;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function yearMonthOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function RecordsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const [monthOffset, setMonthOffset] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  // MOB-102 (round5a-sprint1-plan.md §3.3): flash message shown once a background flush confirms
  // a write that was previously only saved locally -- see src/offline/sync-controller.ts.
  const [confirmedFlash, setConfirmedFlash] = useState<string | null>(null);
  // Recommended fix (diff review): track the dismiss timer in a ref so a message that arrives
  // right before unmount (or a second message arriving before the first's timer fires) can never
  // fire a setState after this screen is gone / clobber a still-pending timer.
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeOfflineFlashMessage((message) => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setConfirmedFlash(message.text);
      flashTimerRef.current = setTimeout(() => {
        setConfirmedFlash(null);
        flashTimerRef.current = null;
      }, 3200);
    });
    return () => {
      unsubscribe();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const baseDate = new Date(`${getSeoulToday()}T00:00:00`);
  const recordsDate = addMonths(baseDate, monthOffset);
  const recordsYearMonth = yearMonthOf(recordsDate);
  const recordsMonthLabel = `${recordsDate.getFullYear()}년 ${recordsDate.getMonth() + 1}월`;

  const expenses = useQuery({
    queryKey: ["expenses", childId, recordsYearMonth],
    enabled: childScopedRequestEnabled(authToken, childId),
    queryFn: () => listExpenses(authToken!, childId!, recordsYearMonth)
  });

  // EXP-005: not-yet-synced local expenses for this child, so a record created/edited while
  // offline shows up immediately even though the server hasn't confirmed it yet.
  const syncSnapshot = useOfflineSyncSnapshot();
  const online = useConnectivityStatus();
  const syncStatus = normalizeAppSyncStatus(syncSnapshot.counts, online);
  const unsyncedCount =
    syncSnapshot.counts.pending +
    syncSnapshot.counts.syncing +
    syncSnapshot.counts.retryWait +
    syncSnapshot.counts.failed +
    syncSnapshot.counts.conflict;

  // H-2 fix: reconcile the server's listExpenses response with any not-yet-synced local rows for
  // this month -- an edited/deleted *existing* server expense would otherwise show up twice (the
  // stale server row + the local pending row) and double-count in the total. See
  // src/offline/expense-list-reconciliation.ts (unit-tested) for the full rationale.
  const childOfflineRows = childId ? syncSnapshot.rows.filter((row) => row.childId === childId) : [];
  const { visibleServerExpenses: monthlyServerExpenses, offlinePendingRows, monthlyTotalKrw } = reconcileMonthlyExpenses(
    expenses.data?.expenses ?? [],
    childOfflineRows,
    recordsYearMonth
  );

  const normalizedSearch = searchText.trim().toLowerCase();
  const visibleExpenses = monthlyServerExpenses.filter((expense) => {
    if (selectedCategoryId && expense.categoryId !== selectedCategoryId) return false;
    if (!normalizedSearch) return true;
    const haystack = `${expense.itemName} ${expense.memo ?? ""} ${expense.merchant ?? ""}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });
  const visibleOfflineRows = offlinePendingRows.filter((row) => {
    if (selectedCategoryId && row.payload.categoryId !== selectedCategoryId) return false;
    if (!normalizedSearch) return true;
    const haystack = `${row.payload.itemName} ${row.payload.memo ?? ""}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });
  const hasSearchQuery = normalizedSearch.length > 0;
  const hasAnyRecords = monthlyServerExpenses.length + offlinePendingRows.length > 0;
  const groupedExpenses = visibleExpenses.reduce<Array<{ spentOn: string; totalKrw: number; expenses: typeof visibleExpenses }>>(
    (groups, expense) => {
      const current = groups[groups.length - 1];
      if (current?.spentOn === expense.spentOn) {
        current.expenses.push(expense);
        current.totalKrw += expense.amountKrw;
      } else {
        groups.push({ spentOn: expense.spentOn, totalKrw: expense.amountKrw, expenses: [expense] });
      }
      return groups;
    },
    []
  );

  function offlineStatusIcon(syncState: string) {
    const name = syncState === "conflict" ? "alert-circle-outline" : syncState === "failed" ? "alert-outline" : syncState === "syncing" ? "sync" : "clock-outline";
    return <AppIcon color={syncState === "failed" || syncState === "conflict" ? theme.colors.warning : theme.colors.gray600} name={name} size={20} />;
  }

  return (
    <AppScreen>
      <View accessibilityLabel={recordsScreenId} testID="screen-EXP-004" style={{ gap: theme.spacing.section }}>
        {isTestSession ? <SampleDataBanner /> : null}
        <TopAppBar title="기록" />

        {confirmedFlash ? <Toast message={confirmedFlash} tone="success" /> : null}

        {unsyncedCount > 0 ? (
          <Pressable
            accessibilityLabel="동기화 상태 보기"
            accessibilityRole="button"
            onPress={() => router.push("/sync-status")}
            style={{ alignItems: "center", flexDirection: "row", gap: 8 }}
          >
            {syncSnapshot.counts.pending + syncSnapshot.counts.syncing + syncSnapshot.counts.retryWait > 0 ? (
              <StatusBadge label={`대기 ${syncSnapshot.counts.pending + syncSnapshot.counts.syncing + syncSnapshot.counts.retryWait}`} tone="neutral" />
            ) : null}
            {syncSnapshot.counts.failed > 0 ? <StatusBadge label={`실패 ${syncSnapshot.counts.failed}`} tone="warning" /> : null}
            {syncSnapshot.counts.conflict > 0 ? <StatusBadge label={`충돌 ${syncSnapshot.counts.conflict}`} tone="warning" /> : null}
          </Pressable>
        ) : null}

        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 6
          }}
        >
          <Pressable accessibilityLabel="이전 달" accessibilityRole="button" hitSlop={12} onPress={() => setMonthOffset((value) => value - 1)} style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget, minWidth: theme.touchTarget }}>
            <AppIcon name="chevron-left" size={26} />
          </Pressable>
          <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>{recordsMonthLabel}</Text>
          <Pressable accessibilityLabel="다음 달" accessibilityRole="button" accessibilityState={{ disabled: monthOffset >= 0 }} disabled={monthOffset >= 0} hitSlop={12} onPress={() => setMonthOffset((value) => value + 1)} style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget, minWidth: theme.touchTarget, opacity: monthOffset >= 0 ? 0.35 : 1 }}>
            <AppIcon name="chevron-right" size={26} />
          </Pressable>
        </View>

        {hasAnyRecords ? (
          <>
        <TextInput
          onChangeText={setSearchText}
          placeholder="품목명, 메모로 검색"
          style={{
            backgroundColor: theme.colors.white,
            borderColor: "rgba(74, 63, 53, 0.10)",
            borderRadius: theme.radii.small,
            borderWidth: 1,
            color: theme.colors.brown,
            fontSize: theme.typography.body1.fontSize,
            minHeight: theme.touchTarget,
            paddingHorizontal: 14
          }}
          value={searchText}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
          <CategoryChip label="전체" selected={selectedCategoryId === null} onPress={() => setSelectedCategoryId(null)} />
          {categoryCatalog.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.label}
              selected={category.id === selectedCategoryId}
              onPress={() => setSelectedCategoryId(category.id)}
            />
          ))}
        </ScrollView>
          </>
        ) : null}

        {expenses.isLoading ? (
          <EmptyStateCard title="기록을 불러오고 있어요." actionLabel="잠시만요" />
        ) : expenses.isError ? (
          <EmptyStateCard
            title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
            actionLabel="다시 시도"
            onPress={() => expenses.refetch()}
          />
        ) : expenses.data && hasAnyRecords ? (
          visibleExpenses.length + visibleOfflineRows.length > 0 ? (
            <>
              <Card>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  이번 달 비용 · {monthlyServerExpenses.length + offlinePendingRows.length}건
                </Text>
                <Text style={{ color: theme.colors.brown, fontSize: 24, fontWeight: "800" }}>
                  {formatKrw(monthlyTotalKrw)}
                </Text>
              </Card>

              <View style={{ gap: theme.spacing.gap }}>
                {visibleOfflineRows.map((row) => (
                  <ListRow
                    key={row.localId}
                    icon={offlineStatusIcon(row.syncState)}
                    title={row.payload.itemName}
                    subtitle={
                      row.pendingDelete
                        ? "삭제 대기 중"
                        : row.syncState === "conflict"
                          ? "다른 기기와 충돌 · 확인 필요"
                          : row.syncState === "failed"
                            ? "동기화 실패 · 확인 필요"
                            : `동기화 대기 · ${formatSpentOn(row.payload.spentOn)}`
                    }
                    value={formatKrw(row.payload.amountKrw)}
                    onPress={() => router.push("/sync-status")}
                  />
                ))}
                {groupedExpenses.map((group) => (
                  <View key={group.spentOn} style={{ gap: 8 }}>
                    <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 }}>
                      <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "800" }}>{formatSpentOn(group.spentOn)}</Text>
                      <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>{formatKrw(group.totalKrw)}</Text>
                    </View>
                    {group.expenses.map((expense) => {
                      const visual = expenseCategoryVisual(expense.categoryId);
                      return (
                        <ListRow
                          key={expense.id}
                          icon={<AppIcon color={visual.iconColor} name={visual.icon} size={20} />}
                          iconBackgroundColor={visual.iconBackgroundColor}
                          title={expense.itemName}
                          subtitle={`${categoryNameFor(expense.categoryId)}${expense.expenseType === "gift" ? " · 선물" : ""}`}
                          value={formatKrw(expense.amountKrw)}
                          onPress={() => router.push(expenseDetailRoute(expense.id))}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </>
          ) : (
            <EmptyStateCard
              title={selectedCategoryId ? "이 카테고리의 기록이 없어요." : "검색 결과가 없어요."}
              actionLabel={selectedCategoryId ? "카테고리 필터 해제" : "검색어 지우기"}
              onPress={() => {
                if (selectedCategoryId) setSelectedCategoryId(null);
                else setSearchText("");
              }}
            />
          )
        ) : (
          <EmptyStateCard
            title={hasSearchQuery ? "검색 결과가 없어요." : "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요."}
            actionLabel={hasSearchQuery ? "검색어 지우기" : "기록하기"}
            onPress={() => (hasSearchQuery ? setSearchText("") : router.push("/expenses/new"))}
          />
        )}
        <Pressable accessibilityLabel="지출 기록 추가" accessibilityRole="button" onPress={() => router.push("/expenses/new")} style={({ pressed }) => ({ alignItems: "center", alignSelf: "flex-end", backgroundColor: theme.colors.mainCoral, borderRadius: 28, height: 56, justifyContent: "center", opacity: pressed ? 0.82 : 1, width: 56 })}>
          <AppIcon color={theme.colors.white} name="plus" size={28} />
        </Pressable>
        <SyncStatusBar onPress={() => router.push("/sync-status" as Href)} status={syncStatus} />
      </View>
    </AppScreen>
  );
}
