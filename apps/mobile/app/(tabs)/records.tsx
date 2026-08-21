import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import type { ListRenderItemInfo, ViewStyle } from "react-native";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { listExpenses, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { categoryCatalog } from "../../src/categories";
import { formatKrw } from "../../src/money";
import { reconcileMonthlyExpenses } from "../../src/offline/expense-list-reconciliation";
import { refreshOfflineSyncSnapshot, subscribeOfflineFlashMessage, useOfflineSyncSnapshot } from "../../src/offline/sync-controller";
import type { LocalExpenseRow } from "../../src/offline/types";
import { usePullToRefresh } from "../../src/query/use-pull-to-refresh";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { Card, CategoryChip, EmptyStateCard, ListRow, PrimaryButton, ScreenHeader, StatusBadge, Toast } from "../../src/ui";
import { SkeletonCard, SkeletonRow } from "../../src/ui/Skeleton";
import { theme } from "../../src/theme";

type ServerExpense = Awaited<ReturnType<typeof listExpenses>>["expenses"][number];

// A11Y-115: the sync chip row announces the actual pending/failed/conflict counts, not just
// "동기화 상태 보기" -- sighted users read the same numbers off the StatusBadge chips.
function syncStatusChipAccessibilityLabel(counts: { pending: number; syncing: number; failed: number; conflict: number }) {
  const parts: string[] = [];
  const waiting = counts.pending + counts.syncing;
  if (waiting > 0) parts.push(`대기 ${waiting}건`);
  if (counts.failed > 0) parts.push(`실패 ${counts.failed}건`);
  if (counts.conflict > 0) parts.push(`충돌 ${counts.conflict}건`);
  return parts.length > 0 ? `동기화 상태 보기, ${parts.join(", ")}` : "동기화 상태 보기";
}

// PERF-102: a month of heavy use is hundreds of rows. The old ScrollView(+AppScreen) + .map()
// mounted every row eagerly (jank + memory). The screen scroller is now the FlatList itself --
// nesting a FlatList inside AppScreen's ScrollView would disable virtualization ("VirtualizedLists
// should never be nested"), so this screen replicates AppScreen's background/padding/scrollbar
// styling directly on the FlatList instead of wrapping in AppScreen.
const webScrollHiddenStyle = {
  msOverflowStyle: "none",
  scrollbarWidth: "none"
} as unknown as ViewStyle;

type RecordsListItem =
  | { kind: "offline"; key: string; row: LocalExpenseRow }
  | { kind: "server"; key: string; expense: ServerExpense };

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

function offlineStatusIcon(syncState: string) {
  if (syncState === "conflict") return "⚠";
  if (syncState === "failed") return "!";
  if (syncState === "syncing") return "↻";
  return "⏱";
}

// Module-scope (stable) press handler for offline rows -- every offline row routes to the same
// EXP-005 sync-status screen, so no per-row lambda is needed.
function pushSyncStatus() {
  router.push("/sync-status");
}

// PERF-102: memoized row components. Row props are the stable expense/row objects coming from
// react-query / the offline snapshot, so unrelated screen re-renders (search keystrokes, flash
// toasts) skip re-rendering already-mounted rows.
const OfflineExpenseListRow = memo(function OfflineExpenseListRow({ row }: { row: LocalExpenseRow }) {
  return (
    <ListRow
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
      onPress={pushSyncStatus}
    />
  );
});

const ServerExpenseListRow = memo(function ServerExpenseListRow({ expense }: { expense: ServerExpense }) {
  return (
    <ListRow
      title={expense.itemName}
      subtitle={
        expense.expenseType === "gift"
          ? `선물 · ${formatSpentOn(expense.spentOn)}`
          : formatSpentOn(expense.spentOn)
      }
      value={formatKrw(expense.amountKrw)}
      onPress={() => router.push(`/expenses/${expense.id}`)}
    />
  );
});

// Stable renderItem / keyExtractor / separator (module scope -- no inline lambdas handed to the
// FlatList, so the list props stay referentially identical across screen re-renders).
function renderRecordsRow({ item }: ListRenderItemInfo<RecordsListItem>) {
  return item.kind === "offline" ? <OfflineExpenseListRow row={item.row} /> : <ServerExpenseListRow expense={item.expense} />;
}

function recordsRowKey(item: RecordsListItem) {
  return item.key;
}

function RecordsRowSeparator() {
  return <View style={{ height: theme.spacing.gap }} />;
}

// Note on getItemLayout: intentionally omitted -- ListRow height is not fixed (optional subtitle,
// wrapping text under large font scales), so a hardcoded row height would corrupt scroll offsets.

export default function RecordsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
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
    enabled: Boolean(authToken && childId),
    queryFn: () => listExpenses(authToken!, childId!, recordsYearMonth)
  });

  // MOB-117 당겨서 새로고침: 보고 있는 달의 서버 목록 refetch + 오프라인 스냅샷(대기/실패/충돌
  // 배지, 로컬 대기 행) 재조회를 함께 수행한다. 세션이 없으면(비활성 쿼리) refetch가 잘못된
  // 토큰으로 queryFn을 강제 실행하므로 RefreshControl 자체를 붙이지 않는다.
  const hasRecordsSession = Boolean(authToken && childId);
  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([expenses.refetch(), refreshOfflineSyncSnapshot()])
  );

  // EXP-005: not-yet-synced local expenses for this child, so a record created/edited while
  // offline shows up immediately even though the server hasn't confirmed it yet.
  const syncSnapshot = useOfflineSyncSnapshot();
  const unsyncedCount = syncSnapshot.counts.pending + syncSnapshot.counts.syncing + syncSnapshot.counts.failed + syncSnapshot.counts.conflict;

  // H-2 fix: reconcile the server's listExpenses response with any not-yet-synced local rows for
  // this month -- an edited/deleted *existing* server expense would otherwise show up twice (the
  // stale server row + the local pending row) and double-count in the total. See
  // src/offline/expense-list-reconciliation.ts (unit-tested) for the full rationale.
  const serverExpenses = expenses.data?.expenses;
  const { visibleServerExpenses: monthlyServerExpenses, offlinePendingRows, monthlyTotalKrw } = useMemo(() => {
    const childOfflineRows = childId ? syncSnapshot.rows.filter((row) => row.childId === childId) : [];
    return reconcileMonthlyExpenses(serverExpenses ?? [], childOfflineRows, recordsYearMonth);
  }, [serverExpenses, syncSnapshot.rows, childId, recordsYearMonth]);

  const normalizedSearch = searchText.trim().toLowerCase();
  const { visibleExpenses, visibleOfflineRows } = useMemo(() => {
    return {
      visibleExpenses: monthlyServerExpenses.filter((expense) => {
        if (selectedCategoryId && expense.categoryId !== selectedCategoryId) return false;
        if (!normalizedSearch) return true;
        const haystack = `${expense.itemName} ${expense.memo ?? ""}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      }),
      visibleOfflineRows: offlinePendingRows.filter((row) => {
        if (selectedCategoryId && row.payload.categoryId !== selectedCategoryId) return false;
        if (!normalizedSearch) return true;
        const haystack = `${row.payload.itemName} ${row.payload.memo ?? ""}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    };
  }, [monthlyServerExpenses, offlinePendingRows, selectedCategoryId, normalizedSearch]);
  const hasSearchQuery = normalizedSearch.length > 0;

  // Offline pending rows first (same order as the old eager render), then server rows.
  const listData = useMemo<RecordsListItem[]>(
    () => [
      ...visibleOfflineRows.map((row): RecordsListItem => ({ kind: "offline", key: `offline:${row.localId}`, row })),
      ...visibleExpenses.map((expense): RecordsListItem => ({ kind: "server", key: `server:${expense.id}`, expense }))
    ],
    [visibleOfflineRows, visibleExpenses]
  );

  const monthlyRecordCount = monthlyServerExpenses.length + offlinePendingRows.length;
  const hasMonthlyRecords = Boolean(expenses.data) && monthlyRecordCount > 0;
  // Same gating as the old conditional render: rows only appear once the server list has
  // resolved (loading -> skeleton, error -> retry card, disabled query -> empty state).
  const showList = !expenses.isLoading && !expenses.isError && Boolean(expenses.data);
  const flatListData = showList ? listData : [];
  const hasVisibleRecords = showList && listData.length > 0;

  // Rendered as an element (not an inline component) so the TextInput keeps focus across
  // re-renders -- FlatList remounts ListHeaderComponent when it's a new function each render.
  const listHeader = (
    <View style={{ gap: theme.spacing.section, marginBottom: theme.spacing.section }}>
      <ScreenHeader eyebrow="지출 기록" title="기록" subtitle="이번 달 지출 내역을 한눈에 확인해 보세요." />

      <PrimaryButton label="빠른 지출 기록" onPress={() => router.push("/expenses/new")} />

      {confirmedFlash ? <Toast message={confirmedFlash} tone="success" /> : null}

      {unsyncedCount > 0 ? (
        <Pressable
          accessibilityLabel={syncStatusChipAccessibilityLabel(syncSnapshot.counts)}
          accessibilityRole="button"
          onPress={() => router.push("/sync-status")}
          style={{ alignItems: "center", flexDirection: "row", gap: 8 }}
        >
          {syncSnapshot.counts.pending + syncSnapshot.counts.syncing > 0 ? (
            <StatusBadge label={`대기 ${syncSnapshot.counts.pending + syncSnapshot.counts.syncing}`} tone="neutral" />
          ) : null}
          {syncSnapshot.counts.failed > 0 ? <StatusBadge label={`실패 ${syncSnapshot.counts.failed}`} tone="warning" /> : null}
          {syncSnapshot.counts.conflict > 0 ? <StatusBadge label={`충돌 ${syncSnapshot.counts.conflict}`} tone="warning" /> : null}
        </Pressable>
      ) : null}

      <View style={{ gap: 6 }}>
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 6
          }}
        >
          <Pressable accessibilityLabel="이전 달" accessibilityRole="button" hitSlop={12} onPress={() => setMonthOffset((value) => value - 1)}>
            <Text style={{ color: theme.colors.gray900, fontSize: 22, fontWeight: "900" }}>‹</Text>
          </Pressable>
          <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>{recordsMonthLabel}</Text>
          <Pressable accessibilityLabel="다음 달" accessibilityRole="button" hitSlop={12} onPress={() => setMonthOffset((value) => value + 1)}>
            <Text style={{ color: theme.colors.gray900, fontSize: 22, fontWeight: "900" }}>›</Text>
          </Pressable>
        </View>
        {/* PERF-102: lightweight month summary from already-fetched data (no extra API call). */}
        {expenses.data ? (
          <Text
            accessibilityLabel={`이번 달 ${monthlyRecordCount}건, 합계 ${formatKrw(monthlyTotalKrw)}`}
            style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, textAlign: "center" }}
          >
            {`이번 달 ${monthlyRecordCount}건 · 합계 ${formatKrw(monthlyTotalKrw)}`}
          </Text>
        ) : null}
      </View>

      <TextInput
        accessibilityLabel="품목명, 메모로 검색"
        returnKeyType="search"
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <CategoryChip label="전체" selected={selectedCategoryId === null} onPress={() => setSelectedCategoryId(null)} />
        {categoryCatalog.map((category) => (
          <CategoryChip
            key={category.id}
            label={`${category.icon} ${category.label}`}
            selected={category.id === selectedCategoryId}
            onPress={() => setSelectedCategoryId(category.id)}
          />
        ))}
      </ScrollView>

      {hasVisibleRecords ? (
        <Card>
          <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
            {recordsMonthLabel} 합계
          </Text>
          <Text style={{ color: theme.colors.brown, fontSize: 24, fontWeight: "800" }}>
            {formatKrw(monthlyTotalKrw)}
          </Text>
        </Card>
      ) : null}
    </View>
  );

  const listEmpty = expenses.isLoading ? (
    // UX-5B-5 (D6): 가짜 버튼이 달린 EmptyStateCard 대신 스켈레톤 로딩.
    <View style={{ gap: theme.spacing.gap }}>
      <SkeletonCard />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  ) : expenses.isError ? (
    <EmptyStateCard
      title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
      actionLabel="다시 시도"
      onPress={() => expenses.refetch()}
    />
  ) : hasMonthlyRecords ? (
    // The month has records, but the category filter / search hid them all.
    <EmptyStateCard
      title={selectedCategoryId ? "이 카테고리의 기록이 없어요." : "검색 결과가 없어요."}
      actionLabel={selectedCategoryId ? "카테고리 필터 해제" : "검색어 지우기"}
      onPress={() => {
        if (selectedCategoryId) setSelectedCategoryId(null);
        else setSearchText("");
      }}
    />
  ) : (
    <EmptyStateCard
      title={hasSearchQuery ? "검색 결과가 없어요." : "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요."}
      actionLabel={hasSearchQuery ? "검색어 지우기" : "기록하기"}
      onPress={() => (hasSearchQuery ? setSearchText("") : router.push("/expenses/new"))}
    />
  );

  return (
    <View testID="screen-EXP-004" style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <FlatList
        data={flatListData}
        keyExtractor={recordsRowKey}
        renderItem={renderRecordsRow}
        // MOB-117: PERF-102대로 이 화면의 스크롤러는 FlatList 자체이므로(AppScreen 중첩 금지)
        // RefreshControl도 FlatList prop으로 단다.
        refreshControl={
          hasRecordsSession ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.mainCoral}
              colors={[theme.colors.mainCoral]}
            />
          ) : undefined
        }
        ItemSeparatorComponent={RecordsRowSeparator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        style={[{ backgroundColor: theme.colors.background, flex: 1 }, webScrollHiddenStyle]}
        contentContainerStyle={{
          backgroundColor: theme.colors.background,
          flexGrow: 1,
          padding: theme.spacing.screen
        }}
      />
    </View>
  );
}
