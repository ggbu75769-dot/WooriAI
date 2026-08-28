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
  OFFLINE_STORAGE_UNAVAILABLE_NOTICE,
  syncStatusBadgeLabel,
  syncStatusDiscardAllConfirmMessage,
  syncStatusDiscardFailedExpensesLabel,
  syncStatusRetryFailedExpensesLabel,
  SYNC_STATUS_CONFLICT_LABEL,
  SYNC_STATUS_DISCARD_ALL_CONFIRM_TITLE,
  SYNC_STATUS_DISCARD_ALL_LABEL,
  SYNC_STATUS_DISCARD_LABEL,
  SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE,
  SYNC_STATUS_DISCARD_PENDING_CONFIRM_MESSAGE,
  SYNC_STATUS_DISCARD_PENDING_CONFIRM_TITLE,
  SYNC_STATUS_DISCARD_PENDING_LABEL,
  SYNC_STATUS_FAILED_LABEL,
  SYNC_STATUS_FIX_AND_RESEND_LABEL,
  SYNC_STATUS_PENDING_LABEL,
  SYNC_STATUS_RETRY_LABEL,
  SYNC_STATUS_SYNCING_LABEL,
  SYNC_STATUS_SYNCING_ROW_MESSAGE
} from "../src/offline/messages";
import {
  countRetryableFailedRows,
  isPermissionDeniedSyncError,
  isRetryableSyncFailureRow,
  SYNC_STATUS_ITEM_STATUS_PERMANENT_FAILURE_HINT,
  SYNC_STATUS_PERMANENT_FAILURE_HINT,
  SYNC_STATUS_PERMISSION_DENIED_HINT
} from "../src/offline/permission-denied";
import { isDiscardablePendingRow } from "../src/offline/pending-row-actions";
import { buildFailedRowPrefillParams, FAILED_ROW_OTHER_CHILD_NOTICE } from "../src/expenses/failed-row-prefill";
import { useExpenseEntryGate } from "../src/family/useExpenseEntryGate";
import { itemStatusLabel } from "../src/items/item-labels";
import { ITEM_STATUS_QUEUED_MESSAGE } from "../src/items/status-mutation-messages";
import {
  discardAllOfflineMutations,
  discardOfflineItemStatus,
  discardOfflineMutation,
  discardPendingOfflineMutation,
  diffExpenseFieldsForDisplay,
  refreshOfflineSyncSnapshot,
  resolveConflictKeepChosenFields,
  resolveConflictKeepMine,
  resolveConflictKeepServer,
  retryAllOfflineMutations,
  retryOfflineItemStatus,
  retryOfflineMutation,
  useOfflineSyncSnapshot
} from "../src/offline/sync-controller";
import type { ExpensePayload, ItemStatusOutboxRow, LocalExpenseRow } from "../src/offline/types";
import { formatKrw } from "../src/money";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
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
  | { kind: "pending"; key: string; row: LocalExpenseRow }
  // 라운드 51 C-10: 준비템 상태 변경도 같은 두 섹션(실패 → 대기)에 섞여 들어온다. 행 종류는
  // 배지로 구분한다 -- 사용자에게는 "아직 반영되지 않은 것들"이 한 화면에 모여 있는 편이 낫고,
  // 무엇에 대한 대기인지는 행이 스스로 말해야 한다.
  | { kind: "item-status-failed"; key: string; row: ItemStatusOutboxRow }
  | { kind: "item-status-pending"; key: string; row: ItemStatusOutboxRow };

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
 * 바꾸고 삭제는 그대로 남긴다(판정 근거는 src/offline/permission-denied.ts).
 *
 * 라운드 57 #8: 그 예외가 **재시도가 무익한 4xx 전부**로 넓어진다. 미래 날짜·금액 상한 초과·
 * 품목명 누락처럼 서버가 이미 "이 내용으로는 받을 수 없다"고 답한 실패는 같은 payload를 몇 번
 * 보내도 같은 답이 온다 -- 그런데도 화면은 지금까지 "재시도"를 내밀고 있었다. 이제 status로
 * 판정해(문구 비교가 아니라) 그 자리를 정직한 안내로 바꾼다. 두 안내 모두 "버리기"는 그대로
 * 남긴다: 그 행에서 사용자가 취할 수 있는 유일한 유효한 행동이기 때문이다.
 *
 * 무엇이 잘못됐는지는 위쪽 `lastError` 줄이 이미 서버 코드별 문구로 말한다(api-error.ts의 표) --
 * 안내 한 줄은 그 사실을 반복하지 않고 "재시도가 무익하다"는 것만 말한다. */
const FailedRow = memo(function FailedRow({
  row,
  token,
  queryClient,
  selectedChildId,
  expenseEntryLocked,
  explainExpenseEntryLock
}: {
  row: LocalExpenseRow;
  token: string;
  queryClient: ReturnType<typeof useQueryClient>;
  /**
   * 라운드 58 통합리뷰 P1-1 — 지금 선택된 아이. 아래 "고쳐서 다시 보내기" 게이트의 재료다
   * (문자열이라 참조가 안정적이고 이 memo를 깨지 않는다).
   */
  selectedChildId: string | null;
  /**
   * 라운드 58 #5 / UX-R(M): "고쳐서 다시 보내기"는 **새 지출을 만드는 진입점**이라 보기 전용
   * 참여자에게는 잠긴다(라운드 40 J-9의 역방향 계약 — /expenses/new로 가는 파일은 전부 이
   * 게이트를 지난다). 판정은 화면 하나에서 한 번만 하고(useExpenseEntryGate) 행에는 참조가
   * 안정적인 두 값만 내려 보낸다 — 매 렌더 새 핸들러를 만들면 이 memo가 무의미해진다.
   */
  expenseEntryLocked: boolean;
  explainExpenseEntryLock: () => void;
}) {
  if (isPermissionDeniedSyncError(row)) {
    return (
      <SyncRow row={row}>
        <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>{SYNC_STATUS_PERMISSION_DENIED_HINT}</Text>
        <SecondaryButton label={SYNC_STATUS_DISCARD_LABEL} onPress={() => discardOfflineMutation(row.localId)} />
      </SyncRow>
    );
  }
  if (!isRetryableSyncFailureRow(row)) {
    // 라운드 58 #5: 위 안내가 시키는 "내용을 고쳐 새로 기록"에 실제 경로를 준다. 프리필을 만들
    // 수 없는 행(선물·환불, 빈 품목명, 0 이하 금액)에서는 params가 null이라 버튼 자체를 내지
    // 않는다 -- 눌러도 아무 일이 없는 버튼을 남기지 않는다(그 행에도 버리기는 그대로 남는다).
    // 원본 행은 여기서 지우지 않는다: 새 저장이 확정된 뒤에 기록 시트가 버린다(failedLocalId).
    //
    // 라운드 58 통합리뷰 P1-1 — **아이 게이트**. 트랙 A의 canRegisterRecurring이 같은 자리에서
    // 같은 판단을 한다(app/expenses/[expenseId].tsx): "관리 화면은 언제나 **지금 선택된 아이**의
    // 템플릿을 만든다(app/expenses/recurring.tsx의 `selectedChildId`). 그래서 다른 아이의 지출을
    // 보다가 이 버튼을 누르면, 사용자가 고른 적 없는 아이 밑으로 정기 지출이 조용히 들어간다".
    // 기록 시트도 언제나 지금 선택된 아이 밑으로 저장하므로 같은 규칙이 그대로 적용되는데,
    // 여기서는 대가가 더 크다: 새 저장이 확정되면 **원본 실패 행이 폐기된다**. 즉 아이 A의 행을
    // B 선택 상태에서 고치면 A의 지출 한 건이 B 밑으로 옮겨 앉고 원본은 사라진다(서버에 없는
    // 행이라 되돌릴 수 없다 — 데이터 손실). 그래서 어긋난 행에는 버튼을 내지 않는다.
    // **버리기는 그대로 남는다**: 그 행에서 사용자가 취할 수 있는 행동을 없애지 않는다.
    // 시트에도 같은 판정이 한 겹 더 있다(failed-row-prefill.ts `isFailedRowChildMismatch`).
    const rowChildId = row.payload.childId?.trim() ?? "";
    const isSelectedChildRow = rowChildId.length > 0 && rowChildId === selectedChildId;
    // 라운드 59 통합리뷰 P1-3: 프리필 가능 여부는 **아이와 무관한** 행 자체의 성질이다(선물·환불,
    // 빈 품목명, 0 이하 금액 — failed-row-prefill.ts). 그래서 한 번만 묻고, 아이 게이트는 그
    // 위에 얹는다: 버튼은 선택된 아이의 행에만, 아래 안내는 "아이만 바꾸면 된다"가 참인 행에만.
    const prefillParams = buildFailedRowPrefillParams(row);
    const fixParams = isSelectedChildRow ? prefillParams : null;
    /**
     * 라운드 59 #5 — 뗀 버튼 자리에 **사실 한 줄**을 남긴다(라운드 40 J-9: 지우지 않고 말한다).
     * 종전에는 다른 아이의 행에서 버튼만 조용히 사라져, 같은 실패 행 둘 중 하나에만 버튼이 있는
     * 이유를 화면이 아무 데서도 말하지 않았다.
     *
     * 아이를 아직 고르지 않았을 때는 켜지 않는다: 비교할 아이가 없으니 "다른 아이의 기록이에요"
     * 가 참이 아니고(모르는 것을 말하지 않는다), 그 상태에서 사용자가 할 일은 아이 선택이라
     * 화면 전체가 이미 그것을 묻는다. 프리필 자체를 만들 수 없는 행(선물·환불·빈 품목명)에도
     * 켜지 않는다 — 그 행의 사유는 아이가 아니고, 위 `SYNC_STATUS_PERMANENT_FAILURE_HINT`가
     * 이미 무엇을 할 수 있는지("고쳐 새로 기록하거나 버려 주세요") 말하고 있다.
     *
     * 라운드 59 통합리뷰 P1-3 — 그 마지막 문장이 **주석에만 있었다.** 판정이 프리필 가능성을 보지
     * 않아, 다른 아이의 선물 행에도 "그 아이를 선택하면 고쳐서 다시 보낼 수 있어요"가 섰다. 아이를
     * 바꿔도 그 행에는 버튼이 서지 않으므로(선물은 이 시트가 만들 수 없는 구분이다) 그 문장은
     * 지키지 못할 약속이고, 사용자는 아이를 전환하고 돌아와 아무것도 달라지지 않은 화면을 본다.
     * 이제 `prefillParams`가 실제로 만들어지는 행에서만 선다 — 안내가 참인 행에서만 뜬다.
     */
    const showOtherChildNotice =
      !isSelectedChildRow && rowChildId.length > 0 && Boolean(selectedChildId?.trim()) && prefillParams !== null;
    return (
      <SyncRow row={row}>
        <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>{SYNC_STATUS_PERMANENT_FAILURE_HINT}</Text>
        {fixParams ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SecondaryButton
              label={SYNC_STATUS_FIX_AND_RESEND_LABEL}
              onPress={() => {
                // 보기 전용 참여자에게는 안내로 답한다. 목적지 시트의 저장도 같은 판정을
                // 지나지만(라운드 40 J-1), 다 채운 뒤 저장에서 막히는 것보다 지금 말하는 편이
                // 정직하다. 버튼을 지우지 않는 것은 이 앱의 관례다(useExpenseEntryGate 주석).
                if (expenseEntryLocked) {
                  explainExpenseEntryLock();
                  return;
                }
                /**
                 * 라운드 59 #2 — **push가 아니라 replace로 연다.**
                 *
                 * 저장이 끝나면 시트는 `router.replace`로 이 화면에 돌아온다(목적지 판정은
                 * src/expenses/post-save-destination.ts, `from=sync-fix`). 여기서 push로 열면
                 * 그 복귀가 스택에 **같은 화면 두 장**을 남긴다: 사용자가 뒤로가기를 눌러도
                 * 똑같이 생긴 동기화 상태 화면이 다시 서고, 마지막 실패 행을 고친 직후라면
                 * 빈 목록의 "닫기"(router.back)가 똑같이 빈 같은 화면으로 되돌아간다.
                 *
                 * replace면 왕복이 제자리로 끝난다(이 화면 → 시트 → 이 화면, 깊이 그대로).
                 * 대가는 시트에서 그냥 뒤로 나갔을 때 이 화면이 아니라 그 아래 화면(기록 탭·홈)
                 * 으로 나간다는 것인데, 그 두 화면 모두 동기화 배지가 서 있어 한 번 눌러 다시
                 * 들어올 수 있다 — 스택에 눌러도 아무 일이 없는 뒤로가기를 남기는 쪽이 나쁘다.
                 */
                router.replace({ pathname: "/expenses/new", params: fixParams });
              }}
              style={{ flex: 1 }}
            />
            <SecondaryButton
              label={SYNC_STATUS_DISCARD_LABEL}
              onPress={() => discardOfflineMutation(row.localId)}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <>
            {showOtherChildNotice ? (
              <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>{FAILED_ROW_OTHER_CHILD_NOTICE}</Text>
            ) : null}
            <SecondaryButton label={SYNC_STATUS_DISCARD_LABEL} onPress={() => discardOfflineMutation(row.localId)} />
          </>
        )}
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

/**
 * GAP-062 #3 — 대기 행에 취할 수 있는 행동 **하나**("버리기").
 *
 * 종전에는 이 행에 문장 한 줄뿐이었다. 실패 행에는 재시도·삭제·고쳐서 다시 보내기가, 충돌
 * 행에는 세 갈래가 있는데 대기 행에만 아무것도 없어서, 오프라인에서 금액을 잘못 적으면 연결이
 * 돌아올 때까지 고칠 수도 지울 수도 없었다.
 *
 * 버튼이 서는 행은 순수 판정이 고른다(src/offline/pending-row-actions.ts): **전송 중이 아니고
 * 서버가 아직 모르는 생성 대기 행**뿐이다. 수정·삭제 대기 행에는 서버 값이 따로 있어 같은
 * 버튼이 다른 일을 하게 되고(그쪽은 "변경 취소"다), 전송 중인 행을 지우면 서버에만 남는 고아
 * 지출이 된다 — 그 근거는 전부 그 모듈 머리말에 있다.
 *
 * 되돌릴 수 없는 파괴적 동작이라 확인 Alert을 앞에 둔다(전체 버리기·지출 삭제와 같은 관례).
 * 누른 시점에 조건이 어긋났을 수 있으므로(스냅샷은 한 박자 낡는다) 실제 폐기는 저장소를 다시
 * 읽어 판정한다 — 이 화면은 결과를 기다리지 않는다(스냅샷이 곧 새 상태를 그린다).
 *
 * 라운드 62 #2: 다만 **거절됐을 때는** 스냅샷만으로 부족하다. 지금 전송 중이라 거절된 경우
 * (라운드 62 #1의 flush 가드) 행은 그 자리에 그대로 남아, 확인까지 누른 사용자에게는 눌린 것을
 * 앱이 못 봤다고 읽힌다. 그래서 컨트롤러가 돌려주는 boolean을 받아 거절이면 이 행 안에 한 줄을
 * 남긴다(SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE). 이 화면에는 records 탭의 플래시 토스트
 * 같은 화면 전역 자리가 없고, 어차피 특정 행에 대한 답이라 그 행 안이 제자리다. 다시 누르면
 * 지워지고, 그 사이 행이 확정돼 사라지면 컴포넌트와 함께 사라진다.
 */
const PendingRow = memo(function PendingRow({ row }: { row: LocalExpenseRow }) {
  const [discardBlocked, setDiscardBlocked] = useState(false);
  const confirmDiscard = useCallback(() => {
    setDiscardBlocked(false);
    Alert.alert(SYNC_STATUS_DISCARD_PENDING_CONFIRM_TITLE, SYNC_STATUS_DISCARD_PENDING_CONFIRM_MESSAGE, [
      { text: "취소", style: "cancel" },
      {
        text: SYNC_STATUS_DISCARD_PENDING_LABEL,
        style: "destructive",
        onPress: () => {
          void discardPendingOfflineMutation(row.localId).then((discarded) => {
            if (!discarded) setDiscardBlocked(true);
          });
        }
      }
    ]);
  }, [row.localId]);

  return (
    <SyncRow row={row}>
      <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>
        {row.syncState === "syncing" ? SYNC_STATUS_SYNCING_ROW_MESSAGE : "연결되면 자동으로 반영할게요."}
      </Text>
      {discardBlocked ? (
        <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE}</Text>
      ) : null}
      {isDiscardablePendingRow(row) ? (
        <SecondaryButton label={SYNC_STATUS_DISCARD_PENDING_LABEL} onPress={confirmDiscard} />
      ) : null}
    </SyncRow>
  );
});

/**
 * 라운드 51 C-10 — 준비템 상태 변경 행.
 *
 * 지출 행(SyncRow)과 나란히 서므로 같은 카드 문법을 쓰되, 왼쪽 위에 "준비템" 배지를 달아 무엇에
 * 대한 대기인지 한눈에 갈리게 한다. 오른쪽에는 금액 자리 대신 **바뀔 상태 이름**을 그린다
 * (목록·상세와 같은 단어 -- src/items/item-labels.ts). 충돌 섹션에는 절대 오지 않는다: 상태는
 * 단일 값이라 서버 충돌 개념이 없다(마지막 쓰기 승리).
 */
function ItemStatusSyncRow({
  row,
  token,
  queryClient
}: {
  row: ItemStatusOutboxRow;
  token: string;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const isFailed = row.syncState === "failed";
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
        <View style={{ alignItems: "center", flexDirection: "row", flexShrink: 1, gap: 6 }}>
          <StatusBadge label="준비템" />
          <Text style={{ color: theme.colors.brown, flexShrink: 1, fontSize: 14, fontWeight: "700" }}>{row.itemName}</Text>
        </View>
        <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "700" }}>{itemStatusLabel(row.status)}</Text>
      </View>
      {row.lastError ? <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{row.lastError}</Text> : null}
      {isFailed ? (
        // 라운드 47 UX-AB와 같은 규칙: 403은 재시도가 정의상 무익하므로 그 자리를 안내로 바꾼다
        // (보기 전용 역할이 준비 상태를 바꾸려 한 경우가 정확히 이 자리다).
        isPermissionDeniedSyncError(row) ? (
          <>
            <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>{SYNC_STATUS_PERMISSION_DENIED_HINT}</Text>
            <SecondaryButton
              label={SYNC_STATUS_DISCARD_LABEL}
              onPress={() => discardOfflineItemStatus(queryClient, row.mutationId)}
            />
          </>
        ) : !isRetryableSyncFailureRow(row) ? (
          // 라운드 57 #8: 준비템 실패 행도 지출 행과 같은 판정을 받는다. 재시도가 무익한 4xx
          // (없어진 준비템·잘못된 상태값 등)에서 "재시도"를 내밀지 않는다. 문구만 이 행에서
          // 실제로 할 수 있는 일에 맞춘다(고칠 '내용'이 없는 행이다 — permission-denied.ts).
          <>
            <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>
              {SYNC_STATUS_ITEM_STATUS_PERMANENT_FAILURE_HINT}
            </Text>
            <SecondaryButton
              label={SYNC_STATUS_DISCARD_LABEL}
              onPress={() => discardOfflineItemStatus(queryClient, row.mutationId)}
            />
          </>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SecondaryButton
              label={SYNC_STATUS_RETRY_LABEL}
              onPress={() => token && retryOfflineItemStatus(token, queryClient, row.mutationId)}
              style={{ flex: 1 }}
            />
            <SecondaryButton
              label={SYNC_STATUS_DISCARD_LABEL}
              onPress={() => discardOfflineItemStatus(queryClient, row.mutationId)}
              style={{ flex: 1 }}
            />
          </View>
        )
      ) : (
        <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>
          {row.syncState === "syncing" ? SYNC_STATUS_SYNCING_ROW_MESSAGE : ITEM_STATUS_QUEUED_MESSAGE}
        </Text>
      )}
    </Card>
  );
}

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
  // 라운드 58 #5: 이 화면이 /expenses/new 진입점이 됐다("고쳐서 다시 보내기"). 판정은 여기서
  // 한 번만 하고, 두 값 모두 렌더 간 참조가 안정적이라(불리언 · 모듈 스코프 함수) 행 memo를
  // 깨지 않는다 -- 기록 탭의 행 액션이 같은 이유로 같은 모양을 쓴다.
  const expenseGate = useExpenseEntryGate();
  const expenseEntryLocked = expenseGate.locked;
  const explainExpenseEntryLock = expenseGate.explain;
  // 라운드 58 통합리뷰 P1-1: "고쳐서 다시 보내기"가 여는 시트는 **지금 선택된 아이** 밑으로
  // 저장한다. 그래서 그 버튼은 이 아이의 행에만 선다(판정 근거는 FailedRow의 fixParams 주석).
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);

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
   *
   * 라운드 46 Q-6(잠재 결합 기록): 이 구독은 `queryFn`이 없어 **스스로 다시 못 채운다**. 나중에
   * 어딘가에서 `["categories"]`를 invalidate/remove 하도록 바뀌면, 이 화면만 이름을 잃고 UUID
   * 꼬리표로 되돌아갈 수 있다 — 무효화를 추가할 때 이 화면(과 conflict-display 포매터)이 채워진
   * 캐시에 의존한다는 사실을 함께 본다.
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
  /**
   * 라운드 58 #4 — 일괄 "재시도"가 **실제로 다룰 수 있는** 지출 실패 행 수.
   *
   * 종전에는 라벨이 실패 행을 전량 셌다(`failedRows.length`). 그런데 그 버튼이 부르는
   * `retryAllFailedMutations`는 라운드 47·57 이후 403과 재시도가 무익한 4xx를 제외하고 큐에
   * 올린다 -- 화면에 403 한 건과 400 두 건만 남으면 "지출 3건 재시도"라고 적힌 버튼이 0건을
   * 되돌렸다. 개별 행에서는 이미 재시도 자리를 안내로 바꿔 두고서, 섹션 머리의 라벨만 그
   * 사실과 어긋난 숫자를 말하고 있었던 것이다.
   *
   * 계수 판정은 엔진의 필터와 **같은 함수**다(permission-denied.ts `isBulkRetryableFailedRow`).
   * 0건이면 아래에서 버튼을 아예 그리지 않는다 -- 준비템 실패만 남은 섹션에서 일괄 액션을
   * 떼어낸 라운드 51 P2-3의 규칙을 같은 이유로 넓힌 것이다. "버리기"는 그대로 전량이 대상이라
   * 라벨도 `failedRows.length`를 유지한다.
   */
  const retryableFailedCount = countRetryableFailedRows(failedRows);
  // 라운드 51 C-10: 준비템 상태 큐. 충돌 갈래는 없다(상태에는 버전 충돌이 없다).
  const pendingItemStatusRows = snapshot.itemStatusRows.filter((row) => row.syncState !== "failed");
  const failedItemStatusRows = snapshot.itemStatusRows.filter((row) => row.syncState === "failed");
  const hasAny =
    pendingRows.length +
      failedRows.length +
      conflictRows.length +
      pendingItemStatusRows.length +
      failedItemStatusRows.length >
    0;

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
  if (failedRows.length + failedItemStatusRows.length > 0) {
    listData.push({
      kind: "section",
      key: "section-failed",
      title: SYNC_STATUS_FAILED_LABEL,
      // 라운드 51 QA(P2-3): 일괄 액션은 **지출 실패 행이 있을 때만** 그린다. 준비템 실패만
      // 남은 섹션에서는 두 버튼이 눌려도 다룰 행이 0건이라(대상이 지출 큐뿐이다) 눌리는 죽은
      // 버튼과 "0건" 확인창만 만들었다.
      ...(failedRows.length > 0 ? { actions: "failed-bulk" as const } : {})
    });
    for (const row of failedRows) listData.push({ kind: "failed", key: `failed-${row.localId}`, row });
    // C-10: 준비템 실패 행은 같은 섹션 뒤에 붙는다. 일괄 액션(재시도/버리기)은 여전히
    // **지출 행만** 대상이다 -- 그 두 버튼이 부르는 컨트롤러 함수가 지출 큐의 것이라,
    // 라벨이 대상과 건수를 직접 말한다("지출 3건 재시도").
    for (const row of failedItemStatusRows) {
      listData.push({ kind: "item-status-failed", key: `item-status-failed-${row.mutationId}`, row });
    }
  }
  if (pendingRows.length + pendingItemStatusRows.length > 0) {
    listData.push({
      kind: "section",
      key: "section-pending",
      title: `${SYNC_STATUS_PENDING_LABEL} / ${SYNC_STATUS_SYNCING_LABEL}`
    });
    for (const row of pendingRows) listData.push({ kind: "pending", key: `pending-${row.localId}`, row });
    for (const row of pendingItemStatusRows) {
      listData.push({ kind: "item-status-pending", key: `item-status-pending-${row.mutationId}`, row });
    }
  }

  const renderSyncRow = useCallback(
    ({ item }: ListRenderItemInfo<SyncListItem>) => {
      if (item.kind === "section") {
        return (
          <SectionTitle title={item.title}>
            {item.actions === "failed-bulk" ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {/* 라운드 51 QA(P2-3): 라벨이 대상(지출)과 건수를 함께 말하므로 스크린리더용
                    문구를 따로 두지 않는다 -- 두 문장이 갈라질 자리를 만들지 않는다.
                    라운드 58 #4: 그 건수는 이제 **재시도가 다룰 수 있는 행**만 센다(위
                    retryableFailedCount). 0건이면 버튼 자체가 없다 -- 눌러도 아무 일이 없는
                    버튼과 거짓 숫자를 함께 없앤다. */}
                {retryableFailedCount > 0 ? (
                  <TextButton
                    label={syncStatusRetryFailedExpensesLabel(retryableFailedCount)}
                    onPress={retryAll}
                    disabled={!authToken}
                  />
                ) : null}
                <TextButton label={syncStatusDiscardFailedExpensesLabel(failedRows.length)} onPress={discardAll} />
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
        return (
          <FailedRow
            row={item.row}
            token={authToken ?? ""}
            queryClient={queryClient}
            selectedChildId={selectedChildId}
            expenseEntryLocked={expenseEntryLocked}
            explainExpenseEntryLock={explainExpenseEntryLock}
          />
        );
      }
      if (item.kind === "item-status-failed" || item.kind === "item-status-pending") {
        return <ItemStatusSyncRow row={item.row} token={authToken ?? ""} queryClient={queryClient} />;
      }
      return <PendingRow row={item.row} />;
    },
    [
      authToken,
      discardAll,
      expenseEntryLocked,
      explainExpenseEntryLock,
      failedRows.length,
      formatConflictValue,
      queryClient,
      retryAll,
      retryableFailedCount,
      selectedChildId
    ]
  );

  const listHeader = (
    <View testID="screen-EXP-005" style={{ gap: theme.spacing.gap, paddingBottom: theme.spacing.gap }}>
      <ScreenHeader eyebrow="동기화" title="동기화 상태" subtitle="아직 서버에 반영되지 않은 기록을 확인하고 정리할 수 있어요." />

      {/* REC-123(H4): 배지/섹션 제목 문구는 기록 탭과 같은 src/offline/messages.ts에서 온다.
          라운드 51 C-10: 이 화면의 배지는 목록에 실제로 그리는 행 수를 세므로 준비템 상태 행까지
          포함한다(기록 탭 배지는 지출만 센다 -- 그쪽 목록에는 준비템 행이 없기 때문이다:
          SyncSnapshot.counts 주석). */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <StatusBadge
          label={syncStatusBadgeLabel("pending", pendingRows.length + pendingItemStatusRows.length)}
          tone={pendingRows.length + pendingItemStatusRows.length > 0 ? "warning" : "neutral"}
        />
        <StatusBadge
          label={syncStatusBadgeLabel("failed", failedRows.length + failedItemStatusRows.length)}
          tone={failedRows.length + failedItemStatusRows.length > 0 ? "warning" : "neutral"}
        />
        <StatusBadge label={syncStatusBadgeLabel("conflict", conflictRows.length)} tone={conflictRows.length > 0 ? "warning" : "neutral"} />
      </View>
    </View>
  );

  // 라운드 61 #6: 저장소를 못 연 상태에서 "모든 기록이 동기화됐어요"는 확인할 방법이 없는
  // 주장이다 -- 그때 화면이 아는 것은 0건이 아니라 **모름**이다(문구 근거는 messages.ts).
  const listEmpty = !hasAny ? (
    <EmptyStateCard
      title={snapshot.storage === "unavailable" ? OFFLINE_STORAGE_UNAVAILABLE_NOTICE : "모든 기록이 동기화됐어요."}
      actionLabel="닫기"
      onPress={() => router.back()}
    />
  ) : null;

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
