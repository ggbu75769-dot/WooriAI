import { memo, useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import type { ListRenderItemInfo, ViewStyle } from "react-native";
import { FlatList, Pressable, Text, View } from "react-native";
import {
  confirmImport,
  getImportJob,
  listImportRows,
  LOCAL_SESSION_TOKEN,
  updateImportRow,
  type Child,
  type ConfirmImportResponse,
  type ImportJob,
  type ImportRow
} from "../../src/api/client";
import {
  attentionFilterChipLabel,
  buildImportBulkSelectionPlan,
  canBulkSelectImportRows,
  confirmableSelectedRowIds,
  countImportRowsNeedingAttention,
  filterImportRows,
  importBulkProgressLabel,
  importBulkSelectionLabel,
  importRowBadge,
  importRowDisplay,
  isImportRowConfirmable,
  rollbackImportRowSelection,
  setImportRowSelection,
  shouldShowAttentionFilter,
  toggleImportRowSelection,
  IMPORT_ATTENTION_FILTER_EMPTY_TEXT,
  IMPORT_ROW_LOCKED_A11Y_PREFIX,
  IMPORT_ROW_LOCKED_MESSAGE,
  IMPORT_TARGET_CHILD_LABEL,
  resolveImportTargetChildName,
  type ImportRowFilter
} from "../../src/import/preview-rows";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { Card, EmptyStateCard, PrimaryButton, ScreenHeader, SecondaryButton, StatusBadge } from "../../src/ui";

/**
 * 확정 요청에 실을 행 id. 판정 자체(확정 가능 + 선택됨)는 순수 모듈이 갖고 있다 --
 * 서버가 `validationStatus !== "valid"`인 행을 어차피 건너뛰므로(import-pipeline.service.ts:233)
 * 화면이 그런 id를 실어 보낼 이유가 없다.
 */
const selectedRowIds = (rows: ImportRow[]) => confirmableSelectedRowIds(rows);

type ImportRowsResponse = { rows: ImportRow[] };

const statusCopy: Record<ImportJob["status"], { label: string; tone: "neutral" | "success" | "warning" }> = {
  uploaded: { label: "업로드 완료 · 분석 대기 중", tone: "neutral" },
  analyzing: { label: "분석 진행 중이에요", tone: "warning" },
  preview_ready: { label: "검수 대기 중이에요", tone: "warning" },
  confirmed: { label: "가져오기 완료", tone: "success" },
  failed: { label: "분석에 실패했어요", tone: "warning" },
  cancelled: { label: "가져오기가 취소됐어요", tone: "neutral" }
};

const loadFailedText = "불러오지 못했어요. 잠시 후 다시 시도해 주세요.";

// UX-S: 이 화면의 스크롤러는 FlatList 자체다(아래 주석 참고) -- 웹에서 스크롤바만 감추는
// 기록 탭과 같은 스타일을 그대로 쓴다.
const webScrollHiddenStyle = {
  msOverflowStyle: "none",
  scrollbarWidth: "none"
} as unknown as ViewStyle;

type ImportRowToggleHandler = (row: ImportRow) => void;

/** FlatList 한 항목. 행 memo가 깨지지 않도록 **이미 계산된 값**만 담는다(함수는 안정된 참조). */
type ImportRowListItem = {
  row: ImportRow;
  disabled: boolean;
  onToggle: ImportRowToggleHandler;
};

/**
 * 확정 불가 행. 체크박스를 그리지 않는 이유:
 * 서버는 `validationStatus !== "valid"`인 행의 `selected`를 무조건 false로 되돌린다
 * (apps/api/src/onboarding/import-pipeline.service.ts:192). 예전 화면은 그 행도 똑같은
 * 체크박스로 그려서, 눌러도 아무 일이 없는 **침묵하는 컨트롤**이 2,000행짜리 목록 안에 섞여
 * 있었다. 이제는 누를 수 있는 척을 하지 않고, 서버 규칙을 화면이 문장으로 말한다.
 */
const LockedImportRowCard = memo(function LockedImportRowCard({ row }: { row: ImportRow }) {
  const display = importRowDisplay(row);
  const badge = importRowBadge(row);

  return (
    <View
      accessible
      accessibilityLabel={`${IMPORT_ROW_LOCKED_A11Y_PREFIX}, ${display.title}, ${display.amountText}, ${display.dateText}, ${IMPORT_ROW_LOCKED_MESSAGE}`}
      style={rowCardLockedStyle}
    >
      <View style={rowHeaderStyle}>
        <View style={lockMarkStyle}>
          <Text accessible={false} style={lockMarkTextStyle}>🔒</Text>
        </View>
        <Text style={rowTitleStyle}>{display.title}</Text>
      </View>
      <Text style={rowAmountStyle}>{display.amountText}</Text>
      <Text style={rowDateStyle}>{display.dateText}</Text>
      {badge ? <StatusBadge label={badge.label} tone={badge.tone} /> : null}
      <Text style={rowLockedNoticeStyle}>{IMPORT_ROW_LOCKED_MESSAGE}</Text>
    </View>
  );
});

function ImportRowCard({
  row,
  disabled,
  onToggle
}: {
  row: ImportRow;
  disabled: boolean;
  onToggle: ImportRowToggleHandler;
}) {
  const display = importRowDisplay(row);
  const badge = importRowBadge(row);
  const handlePress = useCallback(() => onToggle(row), [onToggle, row]);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: row.selected, disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={[rowCardStyle, row.selected ? rowCardSelectedStyle : null, disabled ? rowCardDisabledStyle : null]}
    >
      <View style={rowHeaderStyle}>
        <View style={checkboxStyle(row.selected)}>{row.selected ? <Text style={checkmarkStyle}>✓</Text> : null}</View>
        <Text style={rowTitleStyle}>{display.title}</Text>
      </View>
      <Text style={rowAmountStyle}>{display.amountText}</Text>
      {/* UX-S: 같은 품목·같은 금액이 여러 줄인 파일(정기 구매)에서 어떤 줄인지 구분하려면 날짜가
          있어야 한다. */}
      <Text style={rowDateStyle}>{display.dateText}</Text>
      {badge ? <StatusBadge label={badge.label} tone={badge.tone} /> : null}
    </Pressable>
  );
}

// PERF: 행은 memo로 감싼다 -- 2,000행 상한에서 한 행을 체크할 때마다 전 행이 다시 그려지면
// 가상화의 이점이 사라진다(기록 탭 ServerExpenseListRow와 같은 관례).
const SelectableImportRowCard = memo(ImportRowCard);

// 모듈 스코프 renderItem / keyExtractor / 구분자 -- 화면이 리렌더돼도 FlatList가 받는 prop
// 참조가 그대로다(기록 탭과 같은 관례).
function renderImportRow({ item }: ListRenderItemInfo<ImportRowListItem>) {
  return isImportRowConfirmable(item.row) ? (
    <SelectableImportRowCard row={item.row} disabled={item.disabled} onToggle={item.onToggle} />
  ) : (
    <LockedImportRowCard row={item.row} />
  );
}

function importRowKey(item: ImportRowListItem) {
  return item.row.id;
}

function ImportRowSeparator() {
  return <View style={{ height: theme.spacing.gap }} />;
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={filterChipStyle(selected)}
    >
      <Text style={{ color: selected ? theme.colors.white : theme.colors.brown, fontSize: 13, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function CompletionSummaryCard({ summary, onDone }: { summary: { importedCount: number; skippedCount: number }; onDone: () => void }) {
  return (
    <Card style={{ gap: 12 }}>
      <Text style={summaryTitleStyle}>가져오기를 완료했어요</Text>
      <View style={summaryRowStyle}>
        <Text style={summaryLabelStyle}>가져온 항목</Text>
        <Text style={summaryValueStyle}>{summary.importedCount}건</Text>
      </View>
      <View style={summaryRowStyle}>
        <Text style={summaryLabelStyle}>제외한 항목</Text>
        <Text style={summaryValueStyle}>{summary.skippedCount}건</Text>
      </View>
      <PrimaryButton label="가계부에서 확인하기" onPress={onDone} />
    </Card>
  );
}

export default function ImportPreviewScreen() {
  const params = useLocalSearchParams<{ importJobId?: string }>();
  const importJobId = String(params.importJobId ?? "");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const queryClient = useQueryClient();
  const [completionSummary, setCompletionSummary] = useState<ConfirmImportResponse | null>(null);
  const [rowFilter, setRowFilter] = useState<ImportRowFilter>("all");
  const [pendingRowIds, setPendingRowIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkFailed, setBulkFailed] = useState(false);

  const rowsQueryKey = useMemo(() => ["import-rows", importJobId] as const, [importJobId]);

  const job = useQuery({
    queryKey: ["import-job", importJobId],
    enabled: Boolean(authToken && importJobId),
    queryFn: () => getImportJob(authToken!, importJobId),
    refetchInterval: (query) => (query.state.data?.status === "analyzing" ? 1500 : false)
  });
  const rows = useQuery({
    queryKey: rowsQueryKey,
    enabled: Boolean(authToken && importJobId && job.data?.status !== "analyzing"),
    queryFn: () => listImportRows(authToken!, importJobId)
  });

  /**
   * UX-S: 검수 화면이 **어느 아이의 가계부**에 쓰는지 한 줄로 밝힌다.
   *
   * 가져오기 작업은 `POST /children/:childId/imports/excel`로 만들어지므로 특정 아이에 묶이는데,
   * 이 화면에는 그 이름이 어디에도 없어서 다자녀 가구에서 아이를 바꾼 뒤 예전 링크로 돌아오면
   * 엉뚱한 아이에게 수백 건을 확정할 수 있었다.
   *
   * `["children"]` 캐시를 **읽기만** 한다(useQuery가 아니라 getQueryData -- 이 화면 때문에 새로
   * 도는 요청은 0). 캐시가 없으면 순수 모듈이 null을 돌려주고 줄 자체가 사라진다(허위 표시 금지).
   */
  const cachedChildren = queryClient.getQueryData<{ children: Child[] }>(["children"])?.children;
  const targetChildName = resolveImportTargetChildName(childId, cachedChildren);

  const toggleRow = useMutation({
    mutationFn: (row: ImportRow) =>
      updateImportRow(authToken!, importJobId, row.id, {
        selected: !row.selected,
        categoryId: row.categoryId,
        parsedItemName: row.parsedItemName,
        parsedAmountKrw: row.parsedAmountKrw
      }),
    // 낙관적 갱신: 캐시의 그 행만 뒤집는다. 예전에는 PATCH가 끝나야 화면이 바뀌었고, 그동안
    // `toggleRow.isPending`이 **전 행을 잠갔다** -- 2,000행짜리 목록에서 체크 한 번마다 목록
    // 전체가 굳었다.
    onMutate: async (row) => {
      await queryClient.cancelQueries({ queryKey: rowsQueryKey });
      const snapshot = queryClient.getQueryData<ImportRowsResponse>(rowsQueryKey);
      setPendingRowIds((ids) => {
        const next = new Set(ids);
        next.add(row.id);
        return next;
      });
      queryClient.setQueryData<ImportRowsResponse>(rowsQueryKey, (current) =>
        current ? { rows: toggleImportRowSelection(current.rows, row.id) as ImportRow[] } : current
      );
      return { snapshot };
    },
    // 성공하면 **서버가 돌려준 행**을 그대로 캐시에 꽂는다 -- 전체 재조회가 사라지고, 서버가
    // selected를 되돌린 경우에도 화면이 즉시 진실을 보여 준다.
    onSuccess: (updated) => {
      queryClient.setQueryData<ImportRowsResponse>(rowsQueryKey, (current) =>
        current ? { rows: current.rows.map((row) => (row.id === updated.id ? updated : row)) } : current
      );
    },
    // 실패하면 그 행만 원래대로 되돌린다(스냅샷 통째로 덮으면 그 사이 성공한 다른 행까지 지워진다).
    onError: (_error, row, context) => {
      const snapshot = context?.snapshot;
      if (!snapshot) return;
      queryClient.setQueryData<ImportRowsResponse>(rowsQueryKey, (current) =>
        current ? { rows: rollbackImportRowSelection(current.rows, row.id, snapshot.rows) as ImportRow[] } : current
      );
    },
    onSettled: (_data, _error, row) => {
      setPendingRowIds((ids) => {
        if (!ids.has(row.id)) return ids;
        const next = new Set(ids);
        next.delete(row.id);
        return next;
      });
    }
  });
  const confirm = useMutation({
    mutationFn: () => confirmImport(authToken!, importJobId, selectedRowIds(rows.data?.rows ?? [])),
    onSuccess: async (result) => {
      setCompletionSummary(result);
      await queryClient.invalidateQueries({ queryKey: ["import-job", importJobId] });
      // Import confirmation changes expense totals that feed every report tab (monthly,
      // category, cumulative, yearly all share the "report" key prefix), plus the home
      // summary, the records list, and budget "used" tracking — invalidate all of them so
      // nothing goes stale after a confirm.
      await queryClient.invalidateQueries({ queryKey: ["report"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["budget"] });
    }
  });

  const rowList = rows.data?.rows ?? [];
  const selectedCount = selectedRowIds(rowList).length;
  const attentionCount = countImportRowsNeedingAttention(rowList);
  const status = job.data?.status;
  const isPreviewReady = status === "preview_ready";
  const isBulkRunning = bulkProgress !== null;
  const goToRecords = () => router.replace("/(tabs)/records");

  // `mutate`는 react-query가 렌더마다 같은 참조로 돌려주는 값이다 -- 뮤테이션 객체(`toggleRow`)를
  // 의존성으로 잡으면 매 렌더 새 핸들러가 생겨 행 memo가 통째로 깨진다.
  const toggleMutate = toggleRow.mutate;
  const handleToggle = useCallback<ImportRowToggleHandler>((row) => toggleMutate(row), [toggleMutate]);

  /**
   * "전체 선택/해제". 서버 계약에 **일괄 PATCH가 없어서**
   * (apps/api/src/imports/imports.controller.ts는 `PATCH imports/:importJobId/rows/:rowId` 단건만
   * 노출한다 — 129줄) 클라이언트가 순차로 보낸다. 그래서 진행 표시가 선택이 아니라 필수다:
   * 2,000행 상한에서는 수백 건이 오갈 수 있다. 서버에 일괄 엔드포인트가 생기면 순수 모듈이 이미
   * 계산해 둔 `targetRowIds`를 그대로 본문에 실으면 되므로 이 호출부만 바뀐다.
   *
   * 이미 원하는 상태인 행과 확정 불가 행은 계획에서 빠진다 — 서버가 false로 되돌릴 요청을
   * 굳이 보내지 않는다.
   */
  const applyBulkSelection = useCallback(async () => {
    if (!authToken || isBulkRunning) return;
    const plan = buildImportBulkSelectionPlan(queryClient.getQueryData<ImportRowsResponse>(rowsQueryKey)?.rows ?? []);
    if (plan.targetRowIds.length === 0) return;
    setBulkFailed(false);
    setBulkProgress({ done: 0, total: plan.targetRowIds.length });
    let done = 0;
    try {
      for (const rowId of plan.targetRowIds) {
        // `selected`만 보낸다 — 서버는 나머지 필드를 현재 값과 병합한다(같은 서비스의 merge 규칙).
        await updateImportRow(authToken, importJobId, rowId, { selected: plan.nextSelected });
        done += 1;
        setBulkProgress({ done, total: plan.targetRowIds.length });
        queryClient.setQueryData<ImportRowsResponse>(rowsQueryKey, (current) =>
          current ? { rows: setImportRowSelection(current.rows, rowId, plan.nextSelected) as ImportRow[] } : current
        );
      }
    } catch {
      // 중간에 끊기면 몇 건이 반영됐는지 화면이 알 수 없다 — 재조회로 진실을 다시 받아 온다.
      setBulkFailed(true);
      await queryClient.invalidateQueries({ queryKey: rowsQueryKey });
    } finally {
      setBulkProgress(null);
    }
  }, [authToken, importJobId, isBulkRunning, queryClient, rowsQueryKey]);

  const filteredRows = useMemo(() => filterImportRows(rowList, rowFilter), [rowList, rowFilter]);
  const listData = useMemo<ImportRowListItem[]>(
    () =>
      filteredRows.map((row) => ({
        row,
        // 잠기는 것은 **그 행 하나**뿐이다(진행 중이거나, 일괄 작업 중이거나, 서버가 편집을 더는
        // 받지 않는 상태). 예전처럼 목록 전체가 굳지 않는다.
        disabled: pendingRowIds.has(row.id) || isBulkRunning || !isPreviewReady,
        onToggle: handleToggle
      })),
    [filteredRows, handleToggle, isBulkRunning, isPreviewReady, pendingRowIds]
  );

  const showList = !rows.isLoading && !rows.isError && rowList.length > 0;
  const canBulkSelect = canBulkSelectImportRows(rowList);

  const listHeader = (
    <View style={{ gap: theme.spacing.section, marginBottom: theme.spacing.section }}>
      <ScreenHeader
        eyebrow="데이터 가져오기"
        title="가져오기 진행 상황"
        subtitle="분석 결과를 확인하고 가져올 항목을 골라요"
        onBack={() => router.back()}
      />

      {job.isLoading ? (
        <Card>
          <Text style={mutedTextStyle}>불러오는 중이에요...</Text>
        </Card>
      ) : null}

      {job.isError ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text>
          <SecondaryButton label="다시 시도" onPress={() => job.refetch()} />
        </Card>
      ) : null}

      {job.data ? (
        <Card style={{ gap: 8 }}>
          <StatusBadge label={statusCopy[job.data.status].label} tone={statusCopy[job.data.status].tone} />
          {targetChildName ? (
            <View style={summaryRowStyle}>
              <Text style={summaryLabelStyle}>{IMPORT_TARGET_CHILD_LABEL}</Text>
              <Text style={summaryValueStyle}>{targetChildName}</Text>
            </View>
          ) : null}
          <View style={summaryRowStyle}>
            <Text style={summaryLabelStyle}>전체 행</Text>
            <Text style={summaryValueStyle}>{job.data.rowCount}건</Text>
          </View>
          <View style={summaryRowStyle}>
            <Text style={summaryLabelStyle}>선택됨</Text>
            <Text style={summaryValueStyle}>{selectedCount}건</Text>
          </View>
          {attentionCount > 0 ? (
            <View style={summaryRowStyle}>
              <Text style={summaryLabelStyle}>확인 필요</Text>
              <Text style={summaryValueStyle}>{attentionCount}건</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* 검수 도구는 서버가 편집을 받는 동안(preview_ready)에만 낸다 -- 확정이 끝난 뒤에 누를 수
          없는 버튼을 남겨 두지 않는다. */}
      {showList && isPreviewReady ? (
        <View style={{ gap: theme.spacing.gap }}>
          <View style={toolbarRowStyle}>
            {shouldShowAttentionFilter(attentionCount) ? (
              <FilterChip
                label={attentionFilterChipLabel(attentionCount)}
                selected={rowFilter === "attention"}
                onPress={() => setRowFilter((current) => (current === "attention" ? "all" : "attention"))}
              />
            ) : null}
            <SecondaryButton
              label={bulkProgress ? importBulkProgressLabel(bulkProgress.done, bulkProgress.total) : importBulkSelectionLabel(rowList)}
              disabled={!isPreviewReady || !canBulkSelect || isBulkRunning}
              onPress={applyBulkSelection}
              style={{ flexGrow: 1, flexShrink: 1 }}
            />
          </View>
          {bulkFailed ? <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text> : null}
        </View>
      ) : null}

      {rows.isLoading ? (
        <Card>
          <Text style={mutedTextStyle}>미리보기를 불러오는 중이에요...</Text>
        </Card>
      ) : null}

      {rows.isError ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text>
          <SecondaryButton label="다시 시도" onPress={() => rows.refetch()} />
        </Card>
      ) : null}
    </View>
  );

  const listFooter = (
    <View style={{ gap: theme.spacing.gap, marginTop: theme.spacing.section }}>
      {toggleRow.isError ? <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text> : null}
      <PrimaryButton
        label={confirm.isPending ? "가져오는 중..." : "선택한 항목 가져오기"}
        disabled={!isPreviewReady || !selectedCount || confirm.isPending || isBulkRunning}
        onPress={() => confirm.mutate()}
      />
      {confirm.isError ? <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text> : null}
    </View>
  );

  const listEmpty =
    rows.isLoading || rows.isError ? null : rowList.length === 0 ? (
      <EmptyStateCard title="가져올 항목이 없어요" actionLabel="돌아가기" onPress={() => router.replace("/import")} />
    ) : (
      // 필터 때문에 비었을 때 "가져올 항목이 없어요"는 사실이 아니다.
      <Card>
        <Text style={mutedTextStyle}>{IMPORT_ATTENTION_FILTER_EMPTY_TEXT}</Text>
      </Card>
    );

  if (status === "confirmed" && job.data) {
    return (
      <View testID="screen-IMP-003" style={screenStyle}>
        <FlatList
          data={emptyRowList}
          keyExtractor={importRowKey}
          renderItem={renderImportRow}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <CompletionSummaryCard
              summary={completionSummary ?? { importedCount: job.data.importedCount, skippedCount: job.data.rowCount - job.data.importedCount }}
              onDone={goToRecords}
            />
          }
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={[listStyle, webScrollHiddenStyle]}
          contentContainerStyle={listContentStyle}
        />
      </View>
    );
  }

  // PERF: 서버 상한이 2,000행이다. 예전에는 AppScreen(ScrollView) 안에서 `.map()`으로 전 행을
  // 즉시 마운트했다 — 큰 파일 하나로 화면이 굳었다. 이제 스크롤러가 FlatList 자체이고
  // (ScrollView 안에 중첩하면 가상화가 꺼진다 — 기록 탭 PERF-102와 같은 이유) 헤더·푸터는
  // ListHeaderComponent/ListFooterComponent로 옮겼다.
  return (
    <View testID="screen-IMP-003" style={screenStyle}>
      <View testID="screen-IMP-004" style={{ flex: 1 }}>
        <FlatList
          data={listData}
          keyExtractor={importRowKey}
          renderItem={renderImportRow}
          ItemSeparatorComponent={ImportRowSeparator}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={listFooter}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={[listStyle, webScrollHiddenStyle]}
          contentContainerStyle={listContentStyle}
        />
      </View>
    </View>
  );
}

/** 완료 화면에서 FlatList에 넘기는 빈 목록(모듈 스코프 상수 — 매 렌더 새 배열을 만들지 않는다). */
const emptyRowList: ImportRowListItem[] = [];

const screenStyle = {
  backgroundColor: theme.colors.background,
  flex: 1
} as const;

const listStyle = {
  backgroundColor: theme.colors.background,
  flex: 1
} as const;

const listContentStyle = {
  backgroundColor: theme.colors.background,
  flexGrow: 1,
  padding: theme.spacing.screen
} as const;

const mutedTextStyle = {
  color: theme.colors.gray600,
  fontSize: 13
} as const;

const toolbarRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  flexWrap: "wrap",
  gap: theme.spacing.gap
} as const;

function filterChipStyle(selected: boolean) {
  return {
    alignItems: "center",
    backgroundColor: selected ? theme.colors.mainCoral : theme.colors.white,
    borderColor: selected ? theme.colors.mainCoral : theme.colors.primary100,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    // 44dp 터치 타깃(theme.touchTarget) — 새 치수를 만들지 않는다.
    minHeight: theme.touchTarget,
    paddingHorizontal: 16
  } as const;
}

const summaryRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between"
} as const;

const summaryLabelStyle = {
  color: theme.colors.gray600,
  fontSize: 13,
  fontWeight: "700"
} as const;

const summaryValueStyle = {
  color: theme.colors.brown,
  fontSize: 13,
  fontWeight: "800"
} as const;

const summaryTitleStyle = {
  color: theme.colors.brown,
  fontSize: 16,
  fontWeight: "800"
} as const;

const rowCardStyle = {
  backgroundColor: theme.colors.white,
  borderColor: theme.colors.gray300,
  borderRadius: theme.radii.card,
  borderWidth: 1,
  gap: 6,
  // 44dp 터치 타깃: 카드 자체가 체크박스라 카드 높이가 곧 터치 타깃이다.
  minHeight: theme.touchTarget,
  padding: theme.spacing.card
} as const;

const rowCardSelectedStyle = {
  borderColor: theme.colors.mainCoral
} as const;

const rowCardDisabledStyle = {
  opacity: 0.6
} as const;

const rowCardLockedStyle = {
  backgroundColor: theme.colors.beige,
  borderColor: theme.colors.gray300,
  borderRadius: theme.radii.card,
  borderWidth: 1,
  gap: 6,
  minHeight: theme.touchTarget,
  padding: theme.spacing.card
} as const;

const rowHeaderStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 10
} as const;

function checkboxStyle(checked: boolean) {
  return {
    alignItems: "center",
    backgroundColor: checked ? theme.colors.mainCoral : theme.colors.white,
    borderColor: checked ? theme.colors.mainCoral : theme.colors.gray300,
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    width: 20
  } as const;
}

const lockMarkStyle = {
  alignItems: "center",
  height: 20,
  justifyContent: "center",
  width: 20
} as const;

const lockMarkTextStyle = {
  color: theme.colors.gray600,
  fontSize: 13
} as const;

const checkmarkStyle = {
  color: theme.colors.white,
  fontSize: 12,
  fontWeight: "800"
} as const;

const rowTitleStyle = {
  color: theme.colors.brown,
  flex: 1,
  fontSize: 14,
  fontWeight: "800"
} as const;

const rowAmountStyle = {
  color: theme.colors.brown,
  fontSize: 13,
  fontWeight: "700"
} as const;

const rowDateStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  fontWeight: "600"
} as const;

const rowLockedNoticeStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  fontWeight: "600",
  lineHeight: 18
} as const;
