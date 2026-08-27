import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import type { ListRenderItemInfo, ViewStyle } from "react-native";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { LOCAL_SESSION_TOKEN, type CategoryListItem } from "../src/api/client";
import { buildConflictValueFormatter, type ConflictValueFormatter } from "../src/offline/conflict-display";
import {
  CONFLICT_BANNER_MESSAGE,
  CONFLICT_OPTION_ADOPT_SERVER_LABEL,
  CONFLICT_OPTION_REAPPLY_MINE_LABEL,
  CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL,
  syncStatusBadgeLabel,
  syncStatusDiscardAllConfirmMessage,
  SYNC_STATUS_CONFLICT_LABEL,
  SYNC_STATUS_DISCARD_ALL_CONFIRM_TITLE,
  SYNC_STATUS_DISCARD_ALL_LABEL,
  SYNC_STATUS_DISCARD_LABEL,
  SYNC_STATUS_FAILED_LABEL,
  SYNC_STATUS_PENDING_LABEL,
  SYNC_STATUS_RETRY_ALL_LABEL,
  SYNC_STATUS_RETRY_LABEL,
  SYNC_STATUS_SYNCING_LABEL
} from "../src/offline/messages";
import { isPermissionDeniedSyncError, SYNC_STATUS_PERMISSION_DENIED_HINT } from "../src/offline/permission-denied";
import {
  discardAllOfflineMutations,
  discardOfflineMutation,
  diffExpenseFieldsForDisplay,
  refreshOfflineSyncSnapshot,
  resolveConflictKeepChosenFields,
  resolveConflictKeepMine,
  resolveConflictKeepServer,
  retryAllOfflineMutations,
  retryOfflineMutation,
  useOfflineSyncSnapshot
} from "../src/offline/sync-controller";
import type { ExpensePayload, LocalExpenseRow } from "../src/offline/types";
import { formatKrw } from "../src/money";
import { useSessionStore } from "../src/stores/session.store";
import { Card, EmptyStateCard, ScreenHeader, SecondaryButton, StatusBadge, TextButton } from "../src/ui";
import { theme } from "../src/theme";

/**
 * SYNC-127: 이 화면의 스크롤러는 FlatList 자체다. 예전에는 AppScreen(ScrollView) 안에서 대기/
 * 실패/충돌 세 배열을 각각 `.map()`으로 전량 마운트했는데, 실패 100건이면 100개의 Card가 한 번에
 * 마운트돼 진입 자체가 버벅였다(기록 탭이 PERF-102에서 똑같은 이유로 FlatList로 옮겨간 선례).
 * FlatList를 AppScreen 안에 중첩하면 가상화가 꺼지므로("VirtualizedLists should never be
 * nested"), 기록 탭과 같은 방식으로 AppScreen의 배경·패딩·스크롤바 스타일을 FlatList에 직접
 * 옮겨 적는다.
 */
const webScrollHiddenStyle = {
  msOverflowStyle: "none",
  scrollbarWidth: "none"
} as unknown as ViewStyle;

/**
 * 세 섹션(충돌 → 실패 → 대기)을 하나의 평평한 배열로 만든다. 섹션 제목도 하나의 행이라
 * 스크롤과 함께 자연스럽게 흘러가고, 행 자체는 종류별로 다른 컴포넌트가 그린다.
 */
type SyncListItem =
  | { kind: "section"; key: string; title: string; actions?: "failed-bulk" }
  | { kind: "conflict"; key: string; row: LocalExpenseRow }
  | { kind: "failed"; key: string; row: LocalExpenseRow }
  | { kind: "pending"; key: string; row: LocalExpenseRow };

function SyncRow({ row, children }: { row: LocalExpenseRow; children?: React.ReactNode }) {
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "700" }}>{row.payload.itemName}</Text>
        <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "700" }}>{formatKrw(row.payload.amountKrw)}</Text>
      </View>
      {row.lastError ? <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{row.lastError}</Text> : null}
      {children}
    </Card>
  );
}

function ConflictFieldPicker({
  local,
  server,
  formatValue,
  onConfirm
}: {
  local: ExpensePayload;
  server: ExpensePayload;
  formatValue: ConflictValueFormatter;
  onConfirm: (merged: ExpensePayload) => void;
}) {
  const diff = diffExpenseFieldsForDisplay(local, server);
  const [chosenFromServer, setChosenFromServer] = useState<Set<string>>(new Set());

  return (
    <View style={{ gap: 10 }}>
      {diff.map((entry) => (
        <View key={entry.field} style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>{entry.fieldLabel}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: !chosenFromServer.has(entry.field) }}
              onPress={() =>
                setChosenFromServer((prev) => {
                  const next = new Set(prev);
                  next.delete(entry.field);
                  return next;
                })
              }
              style={{
                borderColor: chosenFromServer.has(entry.field) ? theme.colors.gray300 : theme.colors.mainCoral,
                borderRadius: theme.radii.pill,
                borderWidth: 1,
                flex: 1,
                paddingVertical: 8
              }}
            >
              {/* 라운드 45 UX-AA: 표시만 사람 말로 바꾼다 -- 아래 병합 루프가 저장하는 값은
                  여전히 원시 entry.serverValue다(src/offline/conflict-display.ts 주석). */}
              <Text style={{ color: theme.colors.brown, fontSize: 12, textAlign: "center" }}>
                내 값: {formatValue(entry.field, entry.localValue)}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: chosenFromServer.has(entry.field) }}
              onPress={() =>
                setChosenFromServer((prev) => {
                  const next = new Set(prev);
                  next.add(entry.field);
                  return next;
                })
              }
              style={{
                borderColor: chosenFromServer.has(entry.field) ? theme.colors.mainCoral : theme.colors.gray300,
                borderRadius: theme.radii.pill,
                borderWidth: 1,
                flex: 1,
                paddingVertical: 8
              }}
            >
              <Text style={{ color: theme.colors.brown, fontSize: 12, textAlign: "center" }}>
                다른 기기 값: {formatValue(entry.field, entry.serverValue)}
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
      <SecondaryButton
        label="이 조합으로 저장"
        onPress={() => {
          const merged: ExpensePayload = { ...local };
          for (const entry of diff) {
            if (chosenFromServer.has(entry.field)) {
              (merged as Record<string, unknown>)[entry.field] = entry.serverValue;
            }
          }
          onConfirm(merged);
        }}
      />
    </View>
  );
}

function ConflictRow({
  row,
  token,
  queryClient,
  formatValue
}: {
  row: LocalExpenseRow;
  token: string;
  queryClient: ReturnType<typeof useQueryClient>;
  formatValue: ConflictValueFormatter;
}) {
  const [sideBySide, setSideBySide] = useState(false);
  if (!row.conflictCurrent || row.conflictCurrent.deleted) {
    return (
      <SyncRow row={row}>
        {/* A11Y-117: 12px 배너 -- coral[500]은 흰 카드 위 3.16:1(AA 미달), coral[700]은 5.56:1 */}
        <Text style={{ color: theme.colors.coral[700], fontSize: 12, fontWeight: "700" }}>{CONFLICT_BANNER_MESSAGE}</Text>
        <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>다른 기기에서 이 기록을 삭제했어요.</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <SecondaryButton
            label={CONFLICT_OPTION_ADOPT_SERVER_LABEL}
            onPress={() => resolveConflictKeepServer(queryClient, row.localId)}
            style={{ flex: 1 }}
          />
          <SecondaryButton
            label={CONFLICT_OPTION_REAPPLY_MINE_LABEL}
            onPress={() => resolveConflictKeepMine(token, queryClient, row.localId)}
            style={{ flex: 1 }}
          />
        </View>
      </SyncRow>
    );
  }

  return (
    <SyncRow row={row}>
      {/* A11Y-117: 12px 배너 -- coral[500]은 흰 카드 위 3.16:1(AA 미달), coral[700]은 5.56:1 */}
      <Text style={{ color: theme.colors.coral[700], fontSize: 12, fontWeight: "700" }}>{CONFLICT_BANNER_MESSAGE}</Text>
      {sideBySide ? (
        <ConflictFieldPicker
          local={row.payload}
          server={row.conflictCurrent.expense}
          formatValue={formatValue}
          onConfirm={(merged) => {
            setSideBySide(false);
            resolveConflictKeepChosenFields(token, queryClient, row.localId, merged);
          }}
        />
      ) : (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SecondaryButton
              label={CONFLICT_OPTION_ADOPT_SERVER_LABEL}
              onPress={() => resolveConflictKeepServer(queryClient, row.localId)}
              style={{ flex: 1 }}
            />
            <SecondaryButton
              label={CONFLICT_OPTION_REAPPLY_MINE_LABEL}
              onPress={() => resolveConflictKeepMine(token, queryClient, row.localId)}
              style={{ flex: 1 }}
            />
          </View>
          <TextButton label={CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL} onPress={() => setSideBySide(true)} />
        </View>
      )}
    </SyncRow>
  );
}

/** SYNC-127: 개별 재시도/삭제 버튼 묶음. 문구·동작 모두 예전 그대로 -- 일괄 액션이 생겼다고
 * 한 건만 다루고 싶은 사용자의 길을 없애지 않는다.
 *
 * 라운드 47 UX-AB: 단 하나의 예외가 403 권한 거절이다. 재시도가 정의상 무익한 행에까지 재시도
 * 버튼을 남겨 두면 눌러도 같은 403이 돌아오는 버튼을 반복해 누르게 된다 -- 그 자리만 안내 한 줄로
 * 바꾸고 삭제는 그대로 남긴다(판정 근거는 src/offline/permission-denied.ts). */
const FailedRow = memo(function FailedRow({
  row,
  token,
  queryClient
}: {
  row: LocalExpenseRow;
  token: string;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  if (isPermissionDeniedSyncError(row.lastError)) {
    return (
      <SyncRow row={row}>
        <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>{SYNC_STATUS_PERMISSION_DENIED_HINT}</Text>
        <SecondaryButton label={SYNC_STATUS_DISCARD_LABEL} onPress={() => discardOfflineMutation(row.localId)} />
      </SyncRow>
    );
  }
  return (
    <SyncRow row={row}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <SecondaryButton
          label={SYNC_STATUS_RETRY_LABEL}
          onPress={() => token && retryOfflineMutation(token, queryClient, row.localId)}
          style={{ flex: 1 }}
        />
        <SecondaryButton label={SYNC_STATUS_DISCARD_LABEL} onPress={() => discardOfflineMutation(row.localId)} style={{ flex: 1 }} />
      </View>
    </SyncRow>
  );
});

const PendingRow = memo(function PendingRow({ row }: { row: LocalExpenseRow }) {
  return (
    <SyncRow row={row}>
      <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>
        {row.syncState === "syncing" ? "동기화 중이에요." : "연결되면 자동으로 반영할게요."}
      </Text>
    </SyncRow>
  );
});

function SectionTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
      <Text style={{ color: theme.colors.brown, flexShrink: 1, fontSize: 14, fontWeight: "800" }}>{title}</Text>
      {children}
    </View>
  );
}

function syncRowKey(item: SyncListItem) {
  return item.key;
}

function SyncRowSeparator() {
  return <View style={{ height: theme.spacing.gap }} />;
}

// getItemLayout은 의도적으로 생략한다 -- 카드 높이가 고정이 아니다(lastError 유무, 충돌 행의
// 필드 선택 펼침, 글꼴 크기 확대). 고정 높이를 넣으면 스크롤 오프셋이 어긋난다(PERF-102 선례).

export default function SyncStatusScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const queryClient = useQueryClient();
  const snapshot = useOfflineSyncSnapshot();

  useEffect(() => {
    void refreshOfflineSyncSnapshot();
  }, []);

  /**
   * 라운드 45 UX-AA: 충돌 값의 카테고리 이름은 기록 탭·리포트·CSV와 **같은 ["categories"] 캐시**
   * 에서 온다. 여기서 목록을 새로 부르지 않는 이유: 이 화면은 오프라인·동기화 실패 상황에서
   * 열리는 화면이라, 여기서만 새 요청을 쏘면 실패가 하나 더 늘 뿐이다. 캐시가 비어 있으면
   * 포매터가 정적 8타일까지만 알고 나머지는 "알 수 없는 분류"라고 말한다(지어내지 않는다).
   *
   * 라운드 45 O-5: 읽는 방법만 바꿨다. `queryClient.getQueryData`는 렌더 순간의 값을 **한 번**
   * 베끼는 것이라, 이 화면이 열려 있는 동안 다른 화면이 목록을 받아 와도(백그라운드 refetch,
   * 탭 전환) 여기 이름은 UUID 꼬리표인 채로 남았다. `enabled:false` + `queryFn: skipToken`은
   * **요청을 만들지 않으면서** 같은 캐시 항목을 구독한다 — 캐시가 채워지는 순간 이 화면도 이름을
   * 얻는다(새 요청 0건은 그대로다).
   */
  const cachedCategoriesQuery = useQuery<{ categories: CategoryListItem[] }>({
    queryKey: ["categories"],
    enabled: false,
    queryFn: skipToken
  });
  const cachedCategories = cachedCategoriesQuery.data;
  const formatConflictValue = useMemo(
    () => buildConflictValueFormatter(cachedCategories?.categories),
    [cachedCategories?.categories]
  );

  const pendingRows = snapshot.rows.filter((row) => row.syncState === "pending" || row.syncState === "syncing");
  const failedRows = snapshot.rows.filter((row) => row.syncState === "failed");
  const conflictRows = snapshot.rows.filter((row) => row.syncState === "conflict");
  const hasAny = pendingRows.length + failedRows.length + conflictRows.length > 0;

  /** SYNC-127 "전체 재시도": 실패 행 전부를 한 번에 되돌린 뒤 flush 한 번. 100건이면 예전에는
   * 버튼을 100번 눌러 flush를 100번 트리거해야 했다. */
  const retryAll = useCallback(() => {
    if (!authToken) return;
    void retryAllOfflineMutations(authToken, queryClient);
  }, [authToken, queryClient]);

  /** SYNC-127 "전체 버리기": 되돌릴 수 없는 파괴적 동작이라 지출 삭제(app/expenses/[expenseId].tsx)
   * 와 같은 확인 Alert 관례를 따른다. 몇 건이 사라지는지 본문에 숫자로 밝힌다. */
  const discardAll = useCallback(() => {
    const count = failedRows.length;
    if (count === 0) return;
    Alert.alert(SYNC_STATUS_DISCARD_ALL_CONFIRM_TITLE, syncStatusDiscardAllConfirmMessage(count), [
      { text: "취소", style: "cancel" },
      {
        text: SYNC_STATUS_DISCARD_ALL_LABEL,
        style: "destructive",
        onPress: () => {
          void discardAllOfflineMutations();
        }
      }
    ]);
  }, [failedRows.length]);

  const listData: SyncListItem[] = [];
  if (conflictRows.length > 0) {
    listData.push({ kind: "section", key: "section-conflict", title: SYNC_STATUS_CONFLICT_LABEL });
    for (const row of conflictRows) listData.push({ kind: "conflict", key: `conflict-${row.localId}`, row });
  }
  if (failedRows.length > 0) {
    listData.push({ kind: "section", key: "section-failed", title: SYNC_STATUS_FAILED_LABEL, actions: "failed-bulk" });
    for (const row of failedRows) listData.push({ kind: "failed", key: `failed-${row.localId}`, row });
  }
  if (pendingRows.length > 0) {
    listData.push({
      kind: "section",
      key: "section-pending",
      title: `${SYNC_STATUS_PENDING_LABEL} / ${SYNC_STATUS_SYNCING_LABEL}`
    });
    for (const row of pendingRows) listData.push({ kind: "pending", key: `pending-${row.localId}`, row });
  }

  const renderSyncRow = useCallback(
    ({ item }: ListRenderItemInfo<SyncListItem>) => {
      if (item.kind === "section") {
        return (
          <SectionTitle title={item.title}>
            {item.actions === "failed-bulk" ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextButton
                  label={SYNC_STATUS_RETRY_ALL_LABEL}
                  accessibilityLabel={`${SYNC_STATUS_RETRY_ALL_LABEL}, ${failedRows.length}건`}
                  onPress={retryAll}
                  disabled={!authToken}
                />
                <TextButton
                  label={SYNC_STATUS_DISCARD_ALL_LABEL}
                  accessibilityLabel={`${SYNC_STATUS_DISCARD_ALL_LABEL}, ${failedRows.length}건`}
                  onPress={discardAll}
                />
              </View>
            ) : null}
          </SectionTitle>
        );
      }
      if (item.kind === "conflict") {
        return (
          <ConflictRow
            row={item.row}
            token={authToken ?? ""}
            queryClient={queryClient}
            formatValue={formatConflictValue}
          />
        );
      }
      if (item.kind === "failed") {
        return <FailedRow row={item.row} token={authToken ?? ""} queryClient={queryClient} />;
      }
      return <PendingRow row={item.row} />;
    },
    [authToken, discardAll, failedRows.length, formatConflictValue, queryClient, retryAll]
  );

  const listHeader = (
    <View testID="screen-EXP-005" style={{ gap: theme.spacing.gap, paddingBottom: theme.spacing.gap }}>
      <ScreenHeader eyebrow="동기화" title="동기화 상태" subtitle="아직 서버에 반영되지 않은 기록을 확인하고 정리할 수 있어요." />

      {/* REC-123(H4): 배지/섹션 제목 문구는 기록 탭과 같은 src/offline/messages.ts에서 온다. */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <StatusBadge label={syncStatusBadgeLabel("pending", pendingRows.length)} tone={pendingRows.length > 0 ? "warning" : "neutral"} />
        <StatusBadge label={syncStatusBadgeLabel("failed", failedRows.length)} tone={failedRows.length > 0 ? "warning" : "neutral"} />
        <StatusBadge label={syncStatusBadgeLabel("conflict", conflictRows.length)} tone={conflictRows.length > 0 ? "warning" : "neutral"} />
      </View>
    </View>
  );

  const listEmpty = !hasAny ? <EmptyStateCard title="모든 기록이 동기화됐어요." actionLabel="닫기" onPress={() => router.back()} /> : null;

  return (
    <FlatList
      data={listData}
      keyExtractor={syncRowKey}
      renderItem={renderSyncRow}
      ItemSeparatorComponent={SyncRowSeparator}
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
  );
}
