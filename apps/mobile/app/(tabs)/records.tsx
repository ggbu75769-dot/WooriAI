import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useScrollToTop } from "@react-navigation/native";
import { router, type Href } from "expo-router";
import { Keyboard, Pressable, ScrollView, SectionList, TextInput, View } from "react-native";
import { KoreanText as Text } from "../../src/design-system/components/KoreanText";
import { getSeoulToday } from "@wooriai/domain";
import { ApiClientError, listExpenses, fixtureSessionToken, type Expense, type ExpenseListResponse } from "../../src/api/client";
import { categoryCatalog, categoryNameFor } from "../../src/categories";
import { formatKrw } from "../../src/money";
import { expenseDetailRoute } from "../../src/navigation/routes";
import { expenseCategoryVisual } from "../../src/preparation/item-visuals";
import { reconcileMonthlyExpenses } from "../../src/offline/expense-list-reconciliation";
import { useConnectivityStatus } from "../../src/offline/connectivity";
import {
  offlineExpenseFallbackAllowed,
  syncedExpenseMirrors
} from "../../src/offline/expense-fallback";
import {
  captureCurrentOfflineSyncOwner,
  recordOfflineAuthorization,
  subscribeOfflineFlashMessage,
  useOfflineSyncSnapshot
} from "../../src/offline/sync-controller";
import { normalizeAppSyncStatus } from "../../src/offline/sync-display-state";
import type { LocalExpenseRow } from "../../src/offline/types";
import { childScopedRequestEnabled } from "../../src/query/child-scope";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppIcon, AppScreen, Card, CategoryChip, EmptyStateCard, ListRow, SampleDataBanner, SecondaryButton, StatusBadge, SyncStatusBar, Toast, TopAppBar } from "../../src/design-system";
import { theme } from "../../src/theme";
import { isPixelLockBuild } from "../../src/pixelLock/build-profile";

const recordsScreenId = "EXP-004";

type RecordListItem =
  | { id: string; kind: "offline"; row: LocalExpenseRow; spentOn: string }
  | { expense: Expense; id: string; kind: "expense"; spentOn: string };

type RecordListSection = {
  data: RecordListItem[];
  key: string;
  spentOn: string;
  totalKrw?: number;
};

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

function formatSeoulSyncTime(value: string | null): string {
  if (!value) return "확인 전";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

export default function RecordsScreen() {
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const [monthOffset, setMonthOffset] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const recordsListRef = useRef<SectionList<RecordListItem, RecordListSection>>(null);
  useScrollToTop(recordsListRef);
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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  const baseDate = new Date(`${getSeoulToday()}T00:00:00`);
  const recordsDate = addMonths(baseDate, monthOffset);
  const recordsYearMonth = yearMonthOf(recordsDate);
  const recordsMonthLabel = `${recordsDate.getFullYear()}년 ${recordsDate.getMonth() + 1}월`;

  const expenses = useInfiniteQuery<
    ExpenseListResponse,
    Error,
    InfiniteData<ExpenseListResponse>,
    readonly unknown[],
    string | null
  >({
    queryKey: ["expenses", childId, recordsYearMonth, debouncedSearch, selectedCategoryId],
    enabled: childScopedRequestEnabled(authToken, childId),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    queryFn: async ({ pageParam }) => {
      const owner = captureCurrentOfflineSyncOwner();
      try {
        const response = await listExpenses(authToken!, childId!, recordsYearMonth, {
          categoryId: selectedCategoryId,
          cursor: pageParam,
          limit: 50,
          search: debouncedSearch
        });
        await recordOfflineAuthorization(owner, "authorized", queryClient);
        return response;
      } catch (error) {
        if (error instanceof ApiClientError && [401, 403, 404].includes(error.status)) {
          await recordOfflineAuthorization(owner, "denied", queryClient);
        }
        throw error;
      }
    }
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
  const usingOfflineFallback =
    expenses.isError &&
    Boolean(childId) &&
    offlineExpenseFallbackAllowed(expenses.error, online, syncSnapshot.remoteSync);
  const deniedStatus =
    syncSnapshot.remoteSync.authorizationState === "denied"
      ? 403
      : expenses.error instanceof ApiClientError &&
          [401, 403, 404].includes(expenses.error.status)
        ? expenses.error.status
        : null;
  const firstExpensePage = expenses.data?.pages[0];
  const pagedExpenses = expenses.data?.pages.flatMap((page) => page.expenses);
  const expenseSource =
    (!deniedStatus ? pagedExpenses : undefined) ??
    (usingOfflineFallback && childId
      ? syncedExpenseMirrors(childOfflineRows, childId, recordsYearMonth)
      : []);
  const { visibleServerExpenses: monthlyServerExpenses, offlinePendingRows } = reconcileMonthlyExpenses(
    expenseSource,
    childOfflineRows,
    recordsYearMonth
  );
  const seoulToday = getSeoulToday();
  const normalizedSearch = debouncedSearch.toLocaleLowerCase("ko-KR");
  const hasFilters = normalizedSearch.length > 0 || Boolean(selectedCategoryId);
  const matchesFilters = (expense: Pick<Expense, "categoryId" | "itemName" | "memo" | "merchant">) => {
    if (selectedCategoryId && expense.categoryId !== selectedCategoryId) return false;
    if (!normalizedSearch) return true;
    return `${expense.itemName} ${expense.memo ?? ""} ${expense.merchant ?? ""}`
      .toLocaleLowerCase("ko-KR")
      .includes(normalizedSearch);
  };
  const includedInExpenseTotal = (expense: { expenseType?: string; spentOn: string }) =>
    expense.spentOn <= seoulToday && expense.expenseType === "expense";
  const visibleExpenses = monthlyServerExpenses.filter((expense) => {
    return matchesFilters(expense);
  });
  const visibleOfflineRows = offlinePendingRows.filter((row) => {
    return matchesFilters(row.payload);
  });
  const monthlyOfflineRows = childOfflineRows.filter(
    (row) => row.syncState !== "synced" && row.payload.spentOn.startsWith(recordsYearMonth)
  );
  const hasMonthlyRecords = Boolean(
    (firstExpensePage?.totalRecordCount ?? 0) > 0 ||
    monthlyServerExpenses.length > 0 ||
    monthlyOfflineRows.some((row) => !row.pendingDelete)
  );
  const hasUsableOfflineFallback = usingOfflineFallback && (monthlyServerExpenses.length + offlinePendingRows.length > 0);
  const combinedRecordItems: RecordListItem[] = [
    ...visibleExpenses.map((expense) => ({ expense, id: `expense:${expense.id}`, kind: "expense" as const, spentOn: expense.spentOn })),
    ...visibleOfflineRows.map((row) => ({ id: `offline:${row.localId}`, kind: "offline" as const, row, spentOn: row.payload.spentOn }))
  ].sort((left, right) => right.spentOn.localeCompare(left.spentOn));
  const recordSections = combinedRecordItems.reduce<RecordListSection[]>((sections, item) => {
    const record = item.kind === "expense" ? item.expense : item.row.payload;
    const amountKrw = includedInExpenseTotal(record) ? record.amountKrw : 0;
    const current = sections.at(-1);
    if (current?.spentOn === item.spentOn) {
      current.data.push(item);
      current.totalKrw = (current.totalKrw ?? 0) + amountKrw;
    } else {
      sections.push({ data: [item], key: item.spentOn, spentOn: item.spentOn, totalKrw: amountKrw });
    }
    return sections;
  }, []);

  let summaryRecordCount = hasFilters
    ? firstExpensePage?.filteredRecordCount ?? combinedRecordItems.length
    : firstExpensePage?.totalRecordCount ?? combinedRecordItems.length;
  let summaryExpenseCount = hasFilters
    ? firstExpensePage?.filteredExpenseCount ?? combinedRecordItems.filter((item) => includedInExpenseTotal(item.kind === "expense" ? item.expense : item.row.payload)).length
    : firstExpensePage?.totalExpenseCount ?? combinedRecordItems.filter((item) => includedInExpenseTotal(item.kind === "expense" ? item.expense : item.row.payload)).length;
  const loadedSummaryTotalKrw = combinedRecordItems
    .filter((item) => includedInExpenseTotal(item.kind === "expense" ? item.expense : item.row.payload))
    .reduce((sum, item) => sum + (item.kind === "expense" ? item.expense.amountKrw : item.row.payload.amountKrw), 0);
  let summaryTotalKrw = hasFilters
    ? firstExpensePage?.filteredTotalAmountKrw ?? loadedSummaryTotalKrw
    : firstExpensePage?.totalAmountKrw ?? loadedSummaryTotalKrw;
  const serverExpenseById = new Map((pagedExpenses ?? []).map((expense) => [expense.id, expense]));
  for (const row of firstExpensePage ? monthlyOfflineRows : []) {
    const serverExpense = row.canonicalId ? serverExpenseById.get(row.canonicalId) : undefined;
    const serverMatches = serverExpense ? matchesFilters(serverExpense) : false;
    const localMatches = !row.pendingDelete && matchesFilters(row.payload);
    if (serverExpense && serverMatches) {
      summaryRecordCount -= 1;
      if (includedInExpenseTotal(serverExpense)) {
        summaryExpenseCount -= 1;
        summaryTotalKrw -= serverExpense.amountKrw;
      }
    }
    if ((!row.canonicalId || serverExpense) && localMatches) {
      summaryRecordCount += 1;
      if (includedInExpenseTotal(row.payload)) {
        summaryExpenseCount += 1;
        summaryTotalKrw += row.payload.amountKrw;
      }
    }
  }
  summaryRecordCount = Math.max(0, summaryRecordCount);
  summaryExpenseCount = Math.max(0, summaryExpenseCount);
  summaryTotalKrw = Math.max(0, summaryTotalKrw);

  function changeMonth(delta: number) {
    setMonthOffset((value) => value + delta);
    setSearchText("");
    setDebouncedSearch("");
    setSelectedCategoryId(null);
  }

  function offlineStatusIcon(syncState: string) {
    const name = syncState === "conflict" ? "alert-circle-outline" : syncState === "failed" ? "alert-outline" : syncState === "syncing" ? "sync" : "clock-outline";
    return <AppIcon color={syncState === "failed" || syncState === "conflict" ? theme.colors.warning : theme.colors.gray600} name={name} size={20} />;
  }

  function renderRecordItem({ item }: { item: RecordListItem }) {
    if (item.kind === "offline") {
      const { row } = item;
      return (
        <ListRow
          badgeLabel={row.payload.spentOn > seoulToday ? "예정" : undefined}
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
      );
    }

    const { expense } = item;
    const visual = expenseCategoryVisual(expense.categoryId);
    return (
      <ListRow
        badgeLabel={expense.spentOn > seoulToday ? "예정" : undefined}
        icon={<AppIcon color={visual.iconColor} name={visual.icon} size={20} />}
        iconBackgroundColor={visual.iconBackgroundColor}
        title={expense.itemName}
        subtitle={`${categoryNameFor(expense.categoryId)}${expense.expenseType === "gift" ? " · 선물" : ""}${hasUsableOfflineFallback ? " · 오프라인 저장" : ""}`}
        value={formatKrw(expense.amountKrw)}
        onPress={() =>
          router.push(
            hasUsableOfflineFallback
              ? ("/sync-status" as Href)
              : expenseDetailRoute(expense.id)
          )
        }
      />
    );
  }

  return (
    <AppScreen scrollable={false}>
      <View accessibilityLabel={recordsScreenId} testID="screen-EXP-004" style={{ flex: 1 }}>
        <SectionList<RecordListItem, RecordListSection>
          contentContainerStyle={{ gap: theme.spacing.gap, paddingBottom: 88 }}
          initialNumToRender={12}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ref={recordsListRef}
          ListHeaderComponent={(
            <View style={{ gap: theme.spacing.section }}>
              {isTestSession ? <SampleDataBanner /> : null}
              <TopAppBar
                title="기록"
                trailing={(
                  <Pressable
                    accessibilityLabel="지출 기록 추가"
                    accessibilityRole="button"
                    onPress={() => router.push("/expenses/new")}
                    style={({ pressed }) => ({
                      alignItems: "center",
                      backgroundColor: theme.colors.mainCoral,
                      borderRadius: theme.radii.pill,
                      flexDirection: "row",
                      gap: 4,
                      minHeight: theme.touchTarget,
                      opacity: pressed ? 0.82 : 1,
                      paddingHorizontal: 14
                    })}
                  >
                    <AppIcon color={theme.colors.white} name="plus" size={20} />
                    <Text style={{ color: theme.colors.white, fontSize: 13, fontWeight: "800" }}>추가</Text>
                  </Pressable>
                )}
              />
              {confirmedFlash ? <Toast message={confirmedFlash} tone="success" /> : null}
              {unsyncedCount > 0 ? (
                <Pressable accessibilityLabel="동기화 상태 보기" accessibilityRole="button" onPress={() => router.push("/sync-status")} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                  {syncSnapshot.counts.pending + syncSnapshot.counts.syncing + syncSnapshot.counts.retryWait > 0 ? <StatusBadge label={`대기 ${syncSnapshot.counts.pending + syncSnapshot.counts.syncing + syncSnapshot.counts.retryWait}`} tone="neutral" /> : null}
                  {syncSnapshot.counts.failed > 0 ? <StatusBadge label={`실패 ${syncSnapshot.counts.failed}`} tone="warning" /> : null}
                  {syncSnapshot.counts.conflict > 0 ? <StatusBadge label={`충돌 ${syncSnapshot.counts.conflict}`} tone="warning" /> : null}
                </Pressable>
              ) : null}
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6 }}>
                <Pressable accessibilityLabel="이전 달" accessibilityRole="button" hitSlop={12} onPress={() => changeMonth(-1)} style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget, minWidth: theme.touchTarget }}>
                  <AppIcon name="chevron-left" size={26} />
                </Pressable>
                <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>{recordsMonthLabel}</Text>
                <Pressable accessibilityLabel="다음 달" accessibilityRole="button" accessibilityState={{ disabled: monthOffset >= 0 }} disabled={monthOffset >= 0} hitSlop={12} onPress={() => changeMonth(1)} style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget, minWidth: theme.touchTarget, opacity: monthOffset >= 0 ? 0.35 : 1 }}>
                  <AppIcon name="chevron-right" size={26} />
                </Pressable>
              </View>
              {authToken && !isPixelLockBuild() ? (
                <Pressable accessibilityLabel="엑셀로 여러 지출 기록 가져오기" accessibilityRole="button" onPress={() => router.push("/import" as Href)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: theme.colors.white, borderColor: "rgba(74, 63, 53, 0.10)", borderRadius: theme.radii.small, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: theme.touchTarget, opacity: pressed ? 0.78 : 1, paddingHorizontal: 14 })}>
                  <AppIcon color={theme.colors.mainCoral} name="file-excel-outline" size={20} />
                  <Text style={{ color: theme.colors.brown, flex: 1, fontSize: 13, fontWeight: "800" }}>기록이 많다면 엑셀로 한 번에 가져오기</Text>
                  <AppIcon color={theme.colors.gray600} name="chevron-right" size={20} />
                </Pressable>
              ) : null}
              {hasMonthlyRecords || hasFilters ? (
                <>
                  <View style={{ justifyContent: "center", position: "relative" }}>
                    <TextInput
                      accessibilityLabel="기록 검색"
                      onChangeText={setSearchText}
                      onSubmitEditing={Keyboard.dismiss}
                      placeholder="품목명, 판매처, 메모로 검색"
                      returnKeyType="search"
                      style={{ backgroundColor: theme.colors.white, borderColor: "rgba(74, 63, 53, 0.10)", borderRadius: theme.radii.small, borderWidth: 1, color: theme.colors.brown, fontSize: theme.typography.body1.fontSize, minHeight: theme.touchTarget, paddingLeft: 14, paddingRight: searchText ? 58 : 14 }}
                      value={searchText}
                    />
                    {searchText ? (
                      <Pressable
                        accessibilityLabel="검색어 지우기"
                        accessibilityRole="button"
                        hitSlop={4}
                        onPress={() => {
                          setSearchText("");
                          setDebouncedSearch("");
                        }}
                        style={({ pressed }) => ({ alignItems: "center", height: theme.touchTarget, justifyContent: "center", opacity: pressed ? 0.62 : 1, position: "absolute", right: 2, width: theme.touchTarget })}
                      >
                        <AppIcon color={theme.colors.gray600} name="close-circle" size={22} />
                      </Pressable>
                    ) : null}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
                    <CategoryChip label="전체" selected={selectedCategoryId === null} onPress={() => setSelectedCategoryId(null)} />
                    {categoryCatalog.map((category) => <CategoryChip key={category.id} label={category.label} selected={category.id === selectedCategoryId} onPress={() => setSelectedCategoryId(category.id)} />)}
                  </ScrollView>
                </>
              ) : null}
              {hasUsableOfflineFallback ? (
                <Card style={{ gap: 4 }}>
                  <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>오프라인 저장 기록을 보여드리고 있어요</Text>
                  <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "600" }}>마지막 동기화 · {formatSeoulSyncTime(syncSnapshot.remoteSync.lastSuccessfulPullAt)}</Text>
                </Card>
              ) : null}
              {recordSections.length > 0 ? (
                <Card style={{ gap: 4 }}>
                  <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>{hasUsableOfflineFallback ? "저장된 기록" : hasFilters ? "검색 결과" : "이번 달 기록"} · {summaryRecordCount}건</Text>
                  <Text style={{ color: theme.colors.brown, fontSize: 24, fontWeight: "800" }}>{formatKrw(summaryTotalKrw)}</Text>
                  <Text style={{ color: theme.colors.gray600, fontSize: 11, fontWeight: "600" }}>합계 대상 {summaryExpenseCount}건 · 선물과 예정 기록 제외</Text>
                </Card>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            expenses.isLoading ? <EmptyStateCard title="기록을 불러오고 있어요." actionLabel="잠시만요" />
              : deniedStatus ? <EmptyStateCard title={deniedStatus === 401 ? "로그인이 만료됐어요. 다시 로그인해 주세요." : "이 가족 기록을 볼 권한이 없어요."} actionLabel={deniedStatus === 401 ? "로그인하기" : "아이 다시 선택"} onPress={() => deniedStatus === 401 ? router.replace("/login") : router.push("/children" as Href)} />
                : expenses.isError && !hasUsableOfflineFallback && !expenses.data ? <EmptyStateCard title={syncSnapshot.remoteSync.baselineComplete ? "불러오지 못했어요. 잠시 후 다시 시도해 주세요." : "서버 확인 전이라 저장된 전체 기록을 표시할 수 없어요."} actionLabel="다시 시도" onPress={() => expenses.refetch()} />
                  : hasFilters && hasMonthlyRecords ? <EmptyStateCard title={selectedCategoryId ? "이 카테고리의 기록이 없어요." : "검색 결과가 없어요."} actionLabel="필터 모두 해제" onPress={() => { setSelectedCategoryId(null); setSearchText(""); setDebouncedSearch(""); }} />
                    : <EmptyStateCard title="첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요." actionLabel="기록하기" onPress={() => router.push("/expenses/new")} />
          }
          ListFooterComponent={(
            <View style={{ gap: theme.spacing.gap }}>
              {expenses.hasNextPage ? (
                <SecondaryButton
                  disabled={expenses.isFetchingNextPage}
                  label={expenses.isFetchingNextPage ? "다음 기록 불러오는 중" : "다음 기록 더 보기"}
                  onPress={() => void expenses.fetchNextPage()}
                />
              ) : null}
              <SyncStatusBar onPress={() => router.push("/sync-status" as Href)} status={syncStatus} />
            </View>
          )}
          maxToRenderPerBatch={12}
          onEndReached={() => {
            if (expenses.hasNextPage && !expenses.isFetchingNextPage) void expenses.fetchNextPage();
          }}
          onEndReachedThreshold={0.35}
          renderItem={renderRecordItem}
          renderSectionFooter={({ section }) => expenses.isFetchingNextPage && section.key === recordSections.at(-1)?.key ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.gray600, fontSize: 12, paddingVertical: 10, textAlign: "center" }}>다음 기록을 불러오고 있어요.</Text> : null}
          renderSectionHeader={({ section }) => (
            <View style={{ alignItems: "center", backgroundColor: theme.colors.background, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, paddingVertical: 4 }}>
              <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "800" }}>{formatSpentOn(section.spentOn)}</Text>
              <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>
                {expenses.hasNextPage && section.key === recordSections.at(-1)?.key
                  ? "더 내려 합계 보기"
                  : formatKrw(section.totalKrw ?? 0)}
              </Text>
            </View>
          )}
          sections={recordSections}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          style={{ flex: 1 }}
          windowSize={7}
        />
      </View>
    </AppScreen>
  );
}
