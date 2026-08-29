import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import type { AccessibilityActionEvent, ListRenderItemInfo, SectionListData, ViewStyle } from "react-native";
import { Alert, Platform, Pressable, RefreshControl, ScrollView, SectionList, Text, TextInput, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import {
  listCategories,
  listChildren,
  listExpenses,
  listHouseholdMembers,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_SESSION_TOKEN
} from "../../src/api/client";
import { buildCategoryNameLookup, type CategoryNameLookup } from "../../src/categories";
import {
  childSwitchTriggerAccessibilityLabel,
  resolveChildScopeLabel,
  withSpokenChildScopeLabel,
  CHILD_SWITCH_TRIGGER_HINT
} from "../../src/children/child-switch";
import { ChildSwitchSheet, useChildSwitchSheet } from "../../src/children/ChildSwitchSheet";
import { resolveInitialMonthOffset } from "../../src/expenses/import-landing-month";
import { fetchMonthExpenses } from "../../src/expenses/month-expenses";
import { buildCalendarMonth, dailyTotalsFromDateGroups } from "../../src/expenses/records-calendar";
// 라운드 68 E(#9): 달력 **뷰**는 별도 모듈이다. 계산은 위 records-calendar.ts, 그리기는 이쪽.
import { RecordsCalendarGrid } from "../../src/expenses/RecordsCalendar";
import { groupExpensesByDate, type RecordsDateGroup } from "../../src/expenses/records-date-groups";
import {
  buildRecordRowActions,
  buildRecordRowActionSheet,
  buildRepeatExpenseParams,
  recordRowAccessibilityActions,
  recordRowAccessibilityHint,
  recordRowAccessibilityLabel,
  resolveRecordRowAction,
  type RecordRowActionKey
} from "../../src/expenses/record-row-actions";
import {
  EXPENSE_DELETE_CONFIRM_ACTION_LABEL,
  EXPENSE_DELETE_CONFIRM_CANCEL_LABEL,
  EXPENSE_DELETE_CONFIRM_MESSAGE,
  EXPENSE_DELETE_CONFIRM_TITLE,
  EXPENSE_DELETE_FAILED_ALERT_TITLE,
  EXPENSE_NOT_READY_ERROR,
  expenseMutationErrorMessage
} from "../../src/expenses/save-error-messages";
import {
  buildRecordsCategoryChips,
  buildRecordsEmptyMonthState,
  buildRecordsFilteredEmptyState,
  buildRecordsFilterScopeSummary,
  buildRecordsMonthSummary,
  buildRecordsSearchMonthJumpAction,
  buildRecordsSearchPreviousMonthAction,
  buildRecordsSearchScopeNotice,
  expenseCreatedByUserId,
  formatSpentOn,
  matchRecordSearch,
  offlineRecordRowSubtitle,
  recordsRowSubtitle,
  RECORDS_SEARCH_PLACEHOLDER,
  resolveExpenseAuthorLabel,
  resolveExpenseHouseholdId
} from "../../src/expenses/records-list-view";
import { evaluateLastMonthComparison, previousYearMonth, type ComparableExpenseRecord } from "../../src/home/last-month-comparison";
// 라운드 56 D#10: `view=calendar` 파라미터 규약은 링크를 만드는 알림 목적지 모듈과 **같은 곳**에서 읽는다.
import {
  isRecordsCalendarViewParam,
  RECORDS_VIEW_NONCE_PARAM,
  RECORDS_VIEW_PARAM,
  resolveRecordsViewNonceParam
} from "../../src/notifications/notification-route";
import { formatKrw } from "../../src/money";
import { reconcileMonthlyExpenses } from "../../src/offline/expense-list-reconciliation";
// C-03: 드릴다운 파라미터 규약은 링크를 만드는 리포트 탭과 **같은 모듈**에서 읽는다.
import {
  RECORDS_DRILLDOWN_NONCE_PARAM,
  resolveDrilldownCategoryIdParam,
  resolveDrilldownNonceParam
} from "../../src/reports/category-drilldown";
import {
  syncStatusBadgeLabel,
  syncStatusCountLabel,
  unsendableRowsNoticeText,
  SYNC_ROW_CONFLICT_LABEL,
  SYNC_ROW_FAILED_LABEL,
  SYNC_ROW_PENDING_DELETE_LABEL,
  SYNC_ROW_PENDING_LABEL
} from "../../src/offline/messages";
import { useLoadErrorCopy } from "../../src/offline/use-load-error-copy";
import {
  adoptServerExpense,
  deleteExpenseOffline,
  refreshOfflineSyncSnapshot,
  subscribeOfflineFlashMessage,
  useOfflineSyncSnapshot
} from "../../src/offline/sync-controller";
import type { LocalExpenseRow } from "../../src/offline/types";
import { canGoToNextPeriod, periodLabelForOffset } from "../../src/period-navigation";
// GAP-066 트랙 A(#2): 달 라벨 → 월 선택 시트. 판정은 전부 순수 모듈(src/month-jump.ts)이 하고
// 이 화면은 고른 달을 **기존 monthOffset으로 환산**해 세우기만 한다(상태 모양 무변경).
import {
  monthJumpTriggerAccessibilityLabel,
  resolveMonthJumpEarliestMonth,
  resolveMonthJumpOffset,
  MONTH_JUMP_TRIGGER_HINT
} from "../../src/month-jump";
import { MonthJumpSheet } from "../../src/MonthJumpSheet";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
import { usePullToRefresh } from "../../src/query/use-pull-to-refresh";
import {
  useRecordsViewStore,
  RECORDS_VIEW_MODE_CALENDAR,
  RECORDS_VIEW_MODE_LIST
} from "../../src/stores/records-view.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import {
  announceForA11y,
  Card,
  CategoryChip,
  EmptyStateCard,
  ListRow,
  PrimaryButton,
  ScreenHeader,
  SegmentedControl,
  StatusBadge,
  TextButton,
  Toast
} from "../../src/ui";
import { AppIcon } from "../../src/design-system";
import { SkeletonCard, SkeletonRow } from "../../src/ui/Skeleton";
import { theme } from "../../src/theme";

type ServerExpense = Awaited<ReturnType<typeof listExpenses>>["expenses"][number];

// A11Y-115: the sync chip row announces the actual pending/failed/conflict counts, not just
// "동기화 상태 보기" -- sighted users read the same numbers off the StatusBadge chips.
// REC-123(H4): 상태 이름은 src/offline/messages.ts가 단일 소스다 -- 이 화면의 배지와 동기화 상태
// 화면(app/sync-status.tsx)이 같은 상수/헬퍼를 쓰므로 문구가 다시 갈릴 수 없다.
function syncStatusChipAccessibilityLabel(counts: { pending: number; syncing: number; failed: number; conflict: number }) {
  const parts: string[] = [];
  const waiting = counts.pending + counts.syncing;
  if (waiting > 0) parts.push(syncStatusCountLabel("pending", waiting));
  if (counts.failed > 0) parts.push(syncStatusCountLabel("failed", counts.failed));
  if (counts.conflict > 0) parts.push(syncStatusCountLabel("conflict", counts.conflict));
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

// UX-B: 목록 항목은 `spentOn`/`amountKrw`/`expenseType`을 **최상위로** 들고 다닌다. 날짜 그룹핑과
// 일별 소계(src/expenses/records-date-groups.ts)가 오프라인 행(payload 안쪽)과 서버 행(평평한
// 필드)을 구분하지 않고 같은 규칙으로 읽어야 하기 때문이다 -- 순수 모듈이 화면의 항목 모양을
// 알 필요가 없어진다.
type RecordsListItem = { key: string; spentOn: string; amountKrw: number; expenseType?: string | null } & (
  | { kind: "offline"; row: LocalExpenseRow }
  // FAM-127: `authorLabel`은 목록을 만들 때 이미 해석해 둔 **문자열(또는 null)**이다 -- 행에
  // 구성원 배열이나 해석 함수를 넘기면 PERF-102의 행 memo가 매 렌더 깨진다.
  // UX-L(A): `onAction`도 같은 규칙을 따른다 -- 화면에서 useCallback으로 한 번만 만든 안정된
  // 참조를 그대로 태워 보낸다(행마다 새 람다를 만들면 memo가 무의미해진다).
  | {
      kind: "server";
      expense: ServerExpense;
      categoryName: CategoryNameLookup;
      authorLabel: string | null;
      // 라운드 41 UX-T(C) → GAP-054 D#8: 행 제목에는 없는 곳(메모·판매처)에서 검색어가 맞은
      // 행의 근거 조각. `authorLabel`과 같은 규칙으로 **목록을 만들 때 문자열로 해석해 둔다** --
      // 행에 검색어와 원문을 넘겨 계산하게 하면 행마다 같은 판정을 반복하고, 검색과 무관한
      // 행까지 매 렌더 다시 그린다(PERF-102 행 memo 유지).
      searchSnippet: string | null;
      onAction: RecordRowActionHandler;
    }
);

/** UX-L(A): 행에서 고른 동작을 화면 쪽 실행부로 넘기는 핸들러(수정 이동 / 또 기록 / 삭제 확인). */
type RecordRowActionHandler = (action: RecordRowActionKey, expense: ServerExpense) => void;

/** UX-B: SectionList가 요구하는 `data`를 붙인 날짜 그룹(순수 모듈의 `rows`를 그대로 옮긴다). */
type RecordsSection = Omit<RecordsDateGroup<RecordsListItem>, "rows"> & { data: RecordsListItem[] };

// HOME-124: `formatSpentOn`은 src/expenses/records-list-view.ts로 승격했다 -- 홈의 "최근 지출"
// 행이 같은 포맷을 쓰도록 하기 위해서다(예전에는 ISO 원본을 그대로 그렸다).

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function yearMonthOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * D1 후속(실기기 피드백 2 "아이콘들이 다 예전걸로 돌아간 것 같음"): 오프라인 대기 행의 상태
 * 글리프(⚠ ! ↻ ⏱)를 탭바(app/(tabs)/_layout.tsx)와 같은 Ionicons outlined 계열로 바꾼다.
 * 문자열 글리프는 기기 폰트에 따라 굵기·크기가 제각각이거나 네모(tofu)로 떨어졌다.
 *
 * 상태별 의미는 그대로다: 충돌=경고, 실패=오류, 전송 중=회전 화살표, 대기=시계. 크기·색은 공용
 * ListRow가 문자열 글리프를 그릴 때 쓰던 값(coral, 20)이라 행 모양이 종전과 같고, 상태를 말로
 * 전하는 것은 아래 부제(SYNC_ROW_* 문구)이므로 아이콘은 장식이다.
 */
function offlineStatusIconName(syncState: string): keyof typeof Ionicons.glyphMap {
  if (syncState === "conflict") return "warning-outline";
  if (syncState === "failed") return "alert-circle-outline";
  if (syncState === "syncing") return "refresh-outline";
  return "time-outline";
}

function offlineStatusIcon(syncState: string) {
  return (
    <Ionicons accessible={false} name={offlineStatusIconName(syncState)} size={20} color={theme.colors.mainCoral} />
  );
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
      // GAP-054 라운드 54 P1-2: 대기 행도 구분(선물·환불)을 앞세운다 -- 같은 기록의 "환불 ·"이
      // 동기화 상태에 따라 나타났다 사라지지 않도록. 규칙은 서버 행과 같은 순수 모듈에 있다.
      subtitle={offlineRecordRowSubtitle({
        expenseType: row.payload.expenseType,
        statusLabel: row.pendingDelete
          ? SYNC_ROW_PENDING_DELETE_LABEL
          : row.syncState === "conflict"
            ? SYNC_ROW_CONFLICT_LABEL
            : row.syncState === "failed"
              ? SYNC_ROW_FAILED_LABEL
              : `${SYNC_ROW_PENDING_LABEL} · ${formatSpentOn(row.payload.spentOn)}`
      })}
      value={formatKrw(row.payload.amountKrw)}
      onPress={pushSyncStatus}
    />
  );
});

// REC-121 (D2/K1): 행 부제는 "[선물|환불 ·] [작성자 ·] 카테고리 · 날짜". `categoryName`은 화면에서
// 한 번만 만들어(useMemo) 내려주는 안정된 함수라 PERF-102의 memo 효과가 깨지지 않는다.
// FAM-127: `authorLabel`은 1인 가구·해석 실패 시 null이고, 그때 부제는 예전과 완전히 같다.
//
// UX-L(A): 행 하나에서 수정 / 같은 내용으로 또 기록 / 삭제를 바로 고른다.
//
// 예전에는 행 탭이 무조건 상세로 갔고, 삭제는 그 상세 맨 아래 텍스트 링크였다(탭 3회 + 스크롤).
// 반복 구매를 다시 적는 경로는 없었다. 탭의 기본 동작(상세 이동)은 그대로 두고 **롱프레스**로
// 세 갈래를 연다 -- 항목 구성·문구·선물 행 제외 규칙은 전부 순수 모듈
// (src/expenses/record-row-actions.ts)에 있고, 이 컴포넌트는 그것을 RN Alert과
// accessibilityActions에 꽂기만 한다.
//
// ListRow는 공용 컴포넌트라(다른 화면 다수가 쓴다) 손대지 않고, 이 화면 전용 래퍼로 감싼다.
const ServerExpenseListRow = memo(function ServerExpenseListRow({
  expense,
  categoryName,
  authorLabel,
  searchSnippet,
  onAction
}: {
  expense: ServerExpense;
  categoryName: CategoryNameLookup;
  authorLabel: string | null;
  searchSnippet: string | null;
  onAction: RecordRowActionHandler;
}) {
  const subtitle = recordsRowSubtitle({
    expenseType: expense.expenseType,
    authorLabel,
    categoryLabel: categoryName(expense.categoryId),
    dateLabel: formatSpentOn(expense.spentOn),
    // UX-T(C): 검색 중이 아니거나 품목명이 맞은 행에서는 null이라 부제가 종전과 같다
    // (GAP-054 D#8 이후에는 "메모 …" 말고 "판매처 …"도 이 자리에 온다).
    searchSnippet
  });
  // 아래 ListRow의 `value`와 **같은 식**이다(스크린리더 라벨이 보이는 금액과 갈릴 수 없다).
  const amountLabel = formatKrw(expense.amountKrw);
  // 이 행이 실제로 제공하는 동작. 선물·환불 행에는 "또 기록"이 없다(DNC-015 -- 모듈 주석 참고).
  //
  // 라운드 39 I-2: 품목명·금액까지 넘긴다. 판정 모듈은 라운드 38 H-7부터 프리필 규칙(빈 품목명·
  // 0 이하 금액 제외)까지 함께 보는데, 이 호출부가 expenseType만 넘겨서 0원·품목명 없는 행에는
  // 눌러도 아무 일도 일어나지 않는 "또 기록"이 그대로 남아 있었다. 아래 액션시트도 같은 세 필드를
  // 받으므로 눈에 보이는 목록과 스크린리더 액션 메뉴가 갈릴 수 없다.
  const rowActions = useMemo(
    () =>
      buildRecordRowActions({
        itemName: expense.itemName,
        amountKrw: expense.amountKrw,
        expenseType: expense.expenseType
      }),
    [expense.itemName, expense.amountKrw, expense.expenseType]
  );
  // A11Y: 롱프레스는 스크린리더로 **발견할 수 없는** 제스처다. 같은 목록을 커스텀 액션으로도
  // 내놓아 TalkBack/VoiceOver의 액션 메뉴에서 똑같이 고를 수 있게 한다.
  const rowAccessibilityActions = useMemo(() => recordRowAccessibilityActions(rowActions), [rowActions]);
  const rowAccessibilityHint = useMemo(() => recordRowAccessibilityHint(rowActions), [rowActions]);

  const openRowActionSheet = useCallback(() => {
    const sheet = buildRecordRowActionSheet({
      itemName: expense.itemName,
      amountKrw: expense.amountKrw,
      expenseType: expense.expenseType,
      platform: Platform.OS
    });
    Alert.alert(
      sheet.title,
      sheet.message,
      sheet.buttons.map((button) => {
        const actionKey = button.actionKey;
        return {
          text: button.label,
          style: button.style,
          ...(actionKey ? { onPress: () => onAction(actionKey, expense) } : {})
        };
      }),
      { cancelable: sheet.cancelable }
    );
  }, [expense, onAction]);

  const handleRowAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      // 이 행이 내놓지 않은 액션 이름은 무시한다 -- 선물 행에 "또 기록"이 어떤 경로로도
      // 실행되지 않아야 한다.
      const action = resolveRecordRowAction(event.nativeEvent.actionName, rowActions);
      if (action) onAction(action, expense);
    },
    [expense, onAction, rowActions]
  );

  const openExpenseDetail = useCallback(() => onAction("edit", expense), [expense, onAction]);

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={recordRowAccessibilityLabel({ itemName: expense.itemName, subtitle, amountLabel })}
      accessibilityActions={rowAccessibilityActions}
      accessibilityHint={rowAccessibilityHint}
      onAccessibilityAction={handleRowAccessibilityAction}
      onLongPress={openRowActionSheet}
      onPress={openExpenseDetail}
    >
      {/* 안쪽을 잠그는 이유 두 가지.
          (1) 터치: 공용 ListRow는 자기 루트가 Pressable이라 그대로 두면 그것이 responder를
              가져가 바깥의 롱프레스가 영영 오지 않는다. onPress를 넘기지 않고
              pointerEvents="none"으로 잠가 탭/롱프레스를 바깥 하나가 소유한다.
          (2) 접근성: Pressable은 기본적으로 스스로 접근성 요소라, 감추지 않으면 행 안에 초점이
              두 개 생겨 커스텀 액션이 붙은 바깥이 아닌 안쪽에 초점이 갈 수 있다. 감추는 대신
              바깥이 같은 세 문자열로 만든 라벨을 읽어 준다(보이는 것과 읽히는 것이 같다).
          그려지는 모양은 예전과 같은 ListRow 그대로이고, 다른 화면의 ListRow 사용은 그대로다. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
        <ListRow title={expense.itemName} subtitle={subtitle} value={formatKrw(expense.amountKrw)} />
      </View>
    </Pressable>
  );
});

// Stable renderItem / keyExtractor / separator (module scope -- no inline lambdas handed to the
// FlatList, so the list props stay referentially identical across screen re-renders). REC-121's
// category-name lookup rides along on each list item (it is a stable useMemo'd function, so the
// row memo still holds), which keeps renderItem itself a module-scope function.
function renderRecordsRow({ item }: ListRenderItemInfo<RecordsListItem>) {
  return item.kind === "offline" ? (
    <OfflineExpenseListRow row={item.row} />
  ) : (
    <ServerExpenseListRow
      expense={item.expense}
      categoryName={item.categoryName}
      authorLabel={item.authorLabel}
      searchSnippet={item.searchSnippet}
      onAction={item.onAction}
    />
  );
}

function recordsRowKey(item: RecordsListItem) {
  return item.key;
}

function RecordsRowSeparator() {
  return <View style={{ height: theme.spacing.gap }} />;
}

// UX-B 날짜 헤더 스타일. 모듈 스코프 상수라 매 렌더 새 객체를 만들지 않는다.
//
// 배경을 배경색으로 **명시**하는 이유: sticky 헤더는 RN 기본 동작에 맡기는데(iOS는 켜짐,
// Android는 꺼짐 -- SectionList 기본값을 그대로 둔다) 투명한 헤더가 붙박이로 떠 있으면 그 아래로
// 지나가는 행이 글자에 겹쳐 보인다.
const recordsSectionHeaderStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.background,
  flexDirection: "row",
  justifyContent: "space-between",
  paddingBottom: 8,
  // 앞 섹션의 마지막 행과 이 헤더 사이 여백. SectionList의 ItemSeparatorComponent는 같은 섹션
  // 안에서만 그려지므로 섹션 사이 간격은 헤더가 직접 낸다.
  paddingTop: theme.spacing.gap,
  paddingHorizontal: 2
} as const;

const recordsSectionHeaderDateStyle = {
  color: theme.colors.brown,
  fontSize: theme.typography.body2.fontSize,
  fontWeight: "800"
} as const;

const recordsSectionHeaderSubtotalStyle = {
  color: theme.colors.gray600,
  fontSize: theme.typography.body2.fontSize,
  fontWeight: "700"
} as const;

/**
 * UX-B: 날짜 그룹 헤더 -- 왼쪽에 날짜("오늘"/"어제"/"8월 27일 (수)"), 오른쪽에 일별 소계.
 *
 * 소계는 화면 위쪽 월 합계와 **같은 규칙**(countsTowardMonthlyTotal, DNC-015 선물·환불 제외)으로
 * 순수 모듈이 계산해 둔 값이다. 그날 합산 대상 행이 하나도 없으면(선물·환불만 있는 날) 소계 자리를
 * 비운다 -- "0원"은 그날 아무것도 안 썼다는 뜻으로 읽히는데, 선물 행은 그 아래 그대로 보인다.
 */
const RecordsSectionHeader = memo(function RecordsSectionHeader({ section }: { section: RecordsSection }) {
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={
        section.hasSubtotal ? `${section.headerLabel}, 합계 ${formatKrw(section.subtotalKrw)}` : section.headerLabel
      }
      style={recordsSectionHeaderStyle}
    >
      <Text style={recordsSectionHeaderDateStyle}>{section.headerLabel}</Text>
      {section.hasSubtotal ? <Text style={recordsSectionHeaderSubtotalStyle}>{formatKrw(section.subtotalKrw)}</Text> : null}
    </View>
  );
});

// 모듈 스코프 renderSectionHeader -- renderItem/keyExtractor와 같은 이유로 인라인 람다를 쓰지 않는다.
function renderRecordsSectionHeader({ section }: { section: SectionListData<RecordsListItem, RecordsSection> }) {
  return <RecordsSectionHeader section={section} />;
}

// Note on getItemLayout: intentionally omitted -- ListRow height is not fixed (optional subtitle,
// wrapping text under large font scales), so a hardcoded row height would corrupt scroll offsets.

// ---------------------------------------------------------------------------------------------
// UX-D: 월 캘린더 뷰
//
// 왜 리스트 안에 있나: 이 화면의 스크롤러는 SectionList 자체다(PERF-102 -- AppScreen/ScrollView로
// 감싸면 가상화가 꺼진다). 그래서 달력도 별도 스크롤 컨테이너를 만들지 않고 ListHeaderComponent
// 안에 그린다. 한 달은 최대 6주 × 7칸 = 42칸이라 가상화가 필요 없고(가상화 계약이 막는 것은
// "행/섹션 헤더를 map으로 미리 마운트하는 것"이다 -- 지출 행은 여전히 renderItem으로만 나온다),
// 42칸은 한 화면 안에 들어오는 고정 격자다.
// ---------------------------------------------------------------------------------------------

const RECORDS_VIEW_LIST = "리스트";
const RECORDS_VIEW_CALENDAR = "달력";
// SegmentedControl(src/ui.tsx)은 옵션 문자열 자체를 accessibilityLabel/accessibilityState로 쓴다
// -- TalkBack은 "리스트, 탭, 선택됨"처럼 읽는다.
const RECORDS_VIEW_OPTIONS = [RECORDS_VIEW_LIST, RECORDS_VIEW_CALENDAR];

// 라운드 68 E(#9): 격자·칸·음영·범례의 뷰는 src/expenses/RecordsCalendar.tsx로 옮겼다
// (순수 이동 — 값·문구 무변경). 이 화면에 남는 것은 그 격자를 어디에 그리느냐의 결정뿐이다.

/**
 * 라운드 34 M3: 스크롤 재시도 상한.
 *
 * scrollToLocation은 대상 섹션이 아직 마운트되지 않았을 때 실패한다 -- 달력에서 누른 날짜가
 * 목록 한참 아래에 있으면(초기 렌더 12행 밖) 첫 시도가 거의 항상 실패했고, 예전 코드는 그것을
 * 그냥 삼켜서 "날짜를 눌렀는데 목록 맨 위만 보이는" 상태로 끝났다. 실패 콜백이 오면 그 사이
 * 리스트가 몇 행 더 마운트됐다는 뜻이므로, 다음 프레임에 한 번 더 시도하면 대개 도달한다.
 *
 * 상한이 2인 이유: 재시도는 **무한 루프가 될 수 있다**(도달할 수 없는 좌표면 실패 → 재시도 →
 * 실패가 끝없이 반복되고, 그동안 사용자가 직접 스크롤한 위치까지 계속 빼앗긴다). 두 번으로
 * 끊고, 그 뒤에는 목록 상단을 그대로 둔다 -- 사용자는 이미 그 달의 목록을 보고 있고, 누른
 * 날짜는 탭 시점의 announce가 이미 말해 줬다(무음 실패가 아니다).
 */
const RECORDS_SCROLL_RETRY_LIMIT = 2;

export default function RecordsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  // UX-R(M): 보기 전용 참여자에게는 서버가 지출 생성·수정·삭제를 막는다(403). 이 탭의 기록
  // 진입점(상단 "빠른 지출 기록" 버튼, 빈 상태의 "기록하기", 행 롱프레스의 "또 기록"·"삭제")을
  // 같은 판정 하나로 잠근다 -- src/family/record-permissions.ts.
  const expenseGate = useExpenseEntryGate();
  // 행 액션 핸들러(useCallback)가 읽을 두 값만 따로 뽑아 둔다 -- 훅이 돌려주는 객체는 매 렌더
  // 새 참조지만 이 둘은 아니라, 의존성에 넣어도 핸들러가 안정적으로 남는다.
  const expenseEntryLocked = expenseGate.locked;
  const explainExpenseEntryLock = expenseGate.explain;
  /**
   * 라운드 51 C-#11 — 착지 월.
   *
   * 엑셀 가져오기 확정이 `month=YYYY-MM`을 붙여 이 탭으로 보낸다(app/import/[importJobId].tsx).
   * 지난 몇 달치를 128건 가져온 사용자를 무조건 이번 달에 내려놓으면 "가져왔는데 안 보인다"가
   * 된다 -- 기록은 멀쩡히 들어갔고 화면만 다른 달을 보고 있는 것이다.
   *
   * **파라미터당 딱 한 번만** 적용한다. 이 탭은 한 번 열리면 계속 마운트된 채로 남으므로
   * (가져오기 화면은 탭 위에 쌓인 스택이다) 첫 렌더의 초기값만으로는 부족하다 -- 그래서
   * 지연 초기화(첫 마운트)와, **파라미터 값이 실제로 바뀔 때** 한 번 도는 effect 둘을 함께
   * 둔다. 이미 적용한 값(appliedMonthParamRef)에는 다시 손대지 않으므로, 재렌더나 아이 전환이
   * 사용자가 ‹ 로 옮겨 둔 달을 딥링크 파라미터로 되돌리는 일은 없다. 화면 안의 월 이동
   * (goToPreviousMonth/goToNextMonth)은 종전 로직 그대로다.
   *
   * 파싱은 전부 순수 모듈에 있다: 파라미터가 없거나 형식이 깨졌거나 미래 월이면 0(이번 달)이라
   * 종전 동작과 완전히 같다.
   */
  const monthParams = useLocalSearchParams<{
    month?: string;
    categoryId?: string;
    drilldown?: string;
    view?: string;
    // 라운드 57 QA(P1-1): 달력 착지의 회차(notification-route.ts의 RECORDS_VIEW_NONCE_PARAM).
    viewNonce?: string;
  }>();
  const monthParam = Array.isArray(monthParams.month) ? monthParams.month[0] : monthParams.month;
  const [monthOffset, setMonthOffset] = useState(() =>
    resolveInitialMonthOffset({ monthParam, todayIso: getSeoulToday() })
  );
  const appliedMonthParamRef = useRef<string | undefined>(monthParam);
  useEffect(() => {
    if (!monthParam) return;
    if (appliedMonthParamRef.current === monthParam) return;
    appliedMonthParamRef.current = monthParam;
    setMonthOffset(resolveInitialMonthOffset({ monthParam, todayIso: getSeoulToday() }));
  }, [monthParam]);
  const [searchText, setSearchText] = useState("");
  /**
   * 라운드 52 C-03 — 리포트 카테고리 드릴다운의 착지 필터.
   *
   * 리포트 탭의 도넛 범례가 `month=YYYY-MM&categoryId=…`를 붙여 이 탭으로 보낸다. 달 파라미터
   * (라운드 51 C-#11)와 **완전히 같은 관례**다: 지연 초기화 + 값이 실제로 바뀔 때만 도는 effect,
   * 그리고 이미 적용한 값(appliedCategoryParamRef)에는 다시 손대지 않는다 -- 그래서 사용자가
   * 착지한 뒤 칩을 직접 바꾸거나 "전체"로 풀면 재렌더가 그것을 딥링크 값으로 되돌리지 않는다.
   *
   * 형식 방어는 파라미터를 만드는 쪽과 같은 모듈에 있다(resolveDrilldownCategoryIdParam):
   * 값이 없거나 형식이 깨졌으면 null이라 필터가 걸리지 않고 화면은 종전과 똑같다. 형식은 맞지만
   * 이 가구에 없는 id는 목록이 비동기라 여기서 걸러낼 수 없는데, 그때는 칩 폴백
   * (buildRecordsCategoryChips)이 그 id로 칩 하나를 만들어 0건 + "필터 해제"를 보여준다 --
   * 최악의 경우도 빈 목록과 탈출구이지, 엉뚱한 기록이 그 카테고리인 척하지는 않는다.
   */
  const categoryIdParam = Array.isArray(monthParams.categoryId) ? monthParams.categoryId[0] : monthParams.categoryId;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(() =>
    resolveDrilldownCategoryIdParam(categoryIdParam)
  );
  const appliedCategoryParamRef = useRef<string | undefined>(categoryIdParam);
  useEffect(() => {
    if (!categoryIdParam) return;
    if (appliedCategoryParamRef.current === categoryIdParam) return;
    appliedCategoryParamRef.current = categoryIdParam;
    setSelectedCategoryId(resolveDrilldownCategoryIdParam(categoryIdParam));
  }, [categoryIdParam]);
  /**
   * 라운드 52 QA P1-1/P2-1 — **드릴다운 착지는 회차 단위로 다시 적용한다.**
   *
   * 위 두 effect는 각자 자기 파라미터의 **값 변화**만 본다. 가져오기 착지(month 하나)에는 그
   * 규칙이 맞지만, 파라미터가 둘인 드릴다운에서는 두 가지가 깨졌다:
   *
   *  - 다른 카테고리로 다시 드릴다운했는데 착지 월이 같으면(연간 탭에서 흔하다) `month`는
   *    "값이 안 바뀌었다"로 걸러져 재적용되지 않는다. 사용자가 그 사이 ‹ 로 다른 달을 보고
   *    있었다면 리포트 카드가 한 **"○월 기록을 보여드려요"** 약속이 그대로 깨진다.
   *  - 같은 카테고리를 다시 누르면 두 값이 모두 그대로라 아무 일도 일어나지 않는다(필터를
   *    "전체"로 풀어 둔 뒤 다시 눌러도 마찬가지다 — 버튼이 죽은 것처럼 보인다).
   *
   * 그래서 링크가 회차(`drilldown` nonce)를 함께 싣고, 이 effect가 **그 회차 단위로** 월과
   * 카테고리를 한 묶음으로 적용한다. 위 두 effect의 appliedRef를 여기서 함께 갱신하므로
   * 같은 커밋에서 어느 쪽이 먼저 돌든 적용은 정확히 한 번이고, 결과도 같다.
   *
   * nonce가 없는 링크(가져오기 착지)는 이 effect가 곧바로 빠져나가 **종전 가드 그대로**다.
   * 사용자가 착지 뒤에 옮긴 달·바꾼 칩도 그대로 남는다 — 같은 회차에서는 이 effect가 다시
   * 돌지 않기 때문이다(재렌더·아이 전환이 착지를 되감지 않는다).
   */
  const drilldownNonceParam = resolveDrilldownNonceParam(monthParams[RECORDS_DRILLDOWN_NONCE_PARAM]);
  const appliedDrilldownNonceRef = useRef<string | null>(drilldownNonceParam);
  useEffect(() => {
    if (!drilldownNonceParam) return;
    if (appliedDrilldownNonceRef.current === drilldownNonceParam) return;
    appliedDrilldownNonceRef.current = drilldownNonceParam;
    appliedMonthParamRef.current = monthParam;
    appliedCategoryParamRef.current = categoryIdParam;
    if (monthParam) setMonthOffset(resolveInitialMonthOffset({ monthParam, todayIso: getSeoulToday() }));
    setSelectedCategoryId(resolveDrilldownCategoryIdParam(categoryIdParam));
  }, [drilldownNonceParam, monthParam, categoryIdParam]);
  /**
   * UX-D: 리스트/달력 보기.
   *
   * 라운드 56 D#10 — 예전에는 화면 안 `useState`라 **앱을 다시 열 때마다 리스트로 돌아갔다**.
   * 달력으로 훑는 것이 습관인 사용자는 같은 토글을 매번 다시 눌러야 했다. 이제 선택은
   * src/stores/records-view.store.ts 한 곳에 있고 세션 간 남는다(저장 값은 화면 라벨이 아니라
   * `"list" | "calendar"`다 -- 문구를 다듬어도 저장본이 무효가 되지 않는다).
   *
   * 화면이 쓰는 값은 여전히 세그먼트 라벨이므로, 라벨 ↔ 저장 값 변환을 이 자리 하나에 둔다.
   */
  const setRecordsViewMode = useRecordsViewStore((state) => state.setMode);
  const viewMode = useRecordsViewStore((state) =>
    state.mode === RECORDS_VIEW_MODE_CALENDAR ? RECORDS_VIEW_CALENDAR : RECORDS_VIEW_LIST
  );
  const setViewMode = useCallback(
    (next: string) =>
      setRecordsViewMode(next === RECORDS_VIEW_CALENDAR ? RECORDS_VIEW_MODE_CALENDAR : RECORDS_VIEW_MODE_LIST),
    [setRecordsViewMode]
  );
  const isCalendarView = viewMode === RECORDS_VIEW_CALENDAR;
  /**
   * 라운드 56 D#10 — **기록 리마인더 알림이 달력으로 착지한다.**
   *
   * record_gap 알림이 말하는 사실은 "며칠 동안 기록이 없어요"인데, 리스트로 내려놓으면 그 사람이
   * 보는 것은 **있는 기록의 목록**이다 -- 알림이 가리킨 빈 며칠은 목록에 없어서 화면 어디에도
   * 나타나지 않는다. 비어 있는 날을 보여 주는 화면은 달력 격자뿐이라, 알림 목적지가
   * `view=calendar`를 싣고 이 effect가 그것을 적용한다(파라미터 규약은 링크를 만드는
   * src/notifications/notification-route.ts와 같은 모듈에서 온다).
   *
   * **회차(nonce) 단위로 적용한다** — 라운드 57 QA(P1-1). 이 탭은 한 번 열리면 계속 마운트된
   * 채로 남으므로(알림함은 탭 위에 쌓인 스택이다) 가드가 없으면 재렌더·뒤로가기·아이 전환마다
   * 사용자가 방금 고른 리스트를 달력으로 되돌린다. 그래서 가드 자체는 그대로 필요하다.
   *
   * 그런데 예전 판의 가드는 **boolean 한 개**(`appliedViewParamRef`)였다. `view=calendar`는 값이
   * 하나뿐이라, 알림을 두 번째로 누르면 파라미터가 지난번과 글자 하나 다르지 않아 effect의
   * deps조차 움직이지 않는다 — 즉 이 착지는 **앱 실행당 한 번만** 동작했고, 두 번째부터는
   * 사용자에게 알림이 죽은 것처럼 보였다. 드릴다운이 라운드 52 QA에서 겪은 것과 같은 결함이라
   * 처방도 같게 맞춘다: 링크가 회차를 함께 싣고(`viewNonce`), 이 effect는 **회차가 달라질 때마다**
   * 다시 적용한다.
   *
   * 초기값이 `undefined`인 것은 의도다(null이 아니다). 회차 없는 링크의 회차는 `null`이므로,
   * "아직 아무것도 적용하지 않음"을 그 null과 구별할 값이 하나 필요하다 — 그래야 회차 없는
   * 링크(구 빌드·수기 딥링크)도 첫 진입에서 **정확히 한 번** 적용되고, 그 뒤로는 예전 가드와
   * 똑같이 조용하다.
   *
   * 착지는 세그먼트를 직접 누른 것과 같은 경로로 들어가므로(같은 setter) 그 뒤로는 달력이
   * 기억된다. 사용자가 리스트로 되돌리면 그 선택이 곧바로 덮어쓴다 -- 앱이 정한 것이 사용자가
   * 정한 것보다 오래 남지 않는다(같은 회차 안에서는 이 effect가 다시 돌지 않는다).
   */
  const viewParam = monthParams[RECORDS_VIEW_PARAM];
  const viewNonceParam = resolveRecordsViewNonceParam(monthParams[RECORDS_VIEW_NONCE_PARAM]);
  const appliedViewNonceRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!isRecordsCalendarViewParam(viewParam)) return;
    if (appliedViewNonceRef.current === viewNonceParam) return;
    appliedViewNonceRef.current = viewNonceParam;
    setRecordsViewMode(RECORDS_VIEW_MODE_CALENDAR);
  }, [viewParam, viewNonceParam, setRecordsViewMode]);
  // 달력에서 누른 날짜. 리스트로 전환된 **다음 렌더**에 그 섹션으로 스크롤한다(전환과 스크롤을
  // 한 렌더에서 하려 하면 아직 섹션이 만들어지기 전이라 좌표가 없다).
  const [pendingScrollDate, setPendingScrollDate] = useState<string | null>(null);
  // M3: 재시도용으로 "무슨 날짜를 향하고 있었는지"를 따로 들고 있는다. pendingScrollDate는 시도
  // 직전에 비워지므로(아래 effect) 실패 콜백이 왔을 때는 이미 null이다.
  const scrollTargetDateRef = useRef<string | null>(null);
  const scrollRetryCountRef = useRef(0);
  // 라운드 35 F7: 재시도 rAF 핸들. flashTimerRef와 같은 이유로 ref에 보관한다 -- 예약해 둔
  // 프레임이 언마운트 뒤에 깨어나면 사라진 화면에 setState가 걸린다(달력에서 날짜를 누르고 곧장
  // 탭을 떠나면 실제로 그 순서가 된다). 언마운트 시 취소하고, 다음 예약 전에도 이전 것을
  // 취소해서 프레임이 겹쳐 쌓이지 않게 한다.
  const scrollRetryFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const sectionListRef = useRef<SectionList<RecordsListItem, RecordsSection>>(null);
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

  const seoulToday = getSeoulToday();
  const baseDate = new Date(`${seoulToday}T00:00:00`);
  const recordsDate = addMonths(baseDate, monthOffset);
  const recordsYearMonth = yearMonthOf(recordsDate);
  const recordsMonthLabel = periodLabelForOffset(baseDate, "month", monthOffset);
  // 라운드 39 UX-P: 0건 카드의 "지난달에서 찾기"가 어디로 가는지 스크린리더에 말해 주려면
  // 이동해 갈 달의 이름이 필요하다. ‹ 이동(goToPreviousMonth)이 읽어주는 라벨과 **같은 계산**이다.
  const previousMonthLabel = periodLabelForOffset(baseDate, "month", monthOffset - 1);

  // A11Y-117: 월 이동 시 새 기간 라벨을 TalkBack으로 읽어주고(포커스가 화살표에 머물러 라벨
  // 변경을 놓치는 문제), 현재 달 이후로는 "다음 달" 이동을 막는다(미래 빈 화면 제거).
  const canGoNextMonth = canGoToNextPeriod(monthOffset);
  const goToPreviousMonth = () => {
    setMonthOffset((value) => value - 1);
    announceForA11y(periodLabelForOffset(baseDate, "month", monthOffset - 1));
  };
  const goToNextMonth = () => {
    if (!canGoNextMonth) return;
    setMonthOffset((value) => value + 1);
    announceForA11y(periodLabelForOffset(baseDate, "month", monthOffset + 1));
  };
  /**
   * GAP-067 트랙 A(#2) — 끝난 빈 달의 **달력 보기**에서 되돌아가는 자리.
   *
   * 그 화면에는 달력이 이미 서 있어 "달력에서 고르기"가 보낼 곳이 없으므로, 빈 달 카드가
   * 제안하는 나머지 하나가 이번 달로 돌아오는 것이다(문구·판정은 순수 모듈). 이동 안내는
   * 화살표·월 선택 시트와 **같은 계산**을 읽어 준다(A11Y-117).
   */
  const goToCurrentMonth = () => {
    setMonthOffset(0);
    announceForA11y(periodLabelForOffset(baseDate, "month", 0));
  };
  /**
   * GAP-066 트랙 A(#2) — 달 라벨을 눌러 여는 **월 선택 시트**.
   *
   * 종전에는 이동 수단이 ±1 화살표뿐이라, 1년 전 기록을 찾으려면 ‹ 를 열두 번 눌러야 했고
   * (0건 카드의 "지난달에서 찾기"도 한 달씩 되감는다) 그 열두 번이 열두 번의 조회를 태웠다.
   * 시트는 그 이동을 한 번으로 줄이기만 한다 — 고른 달은 아래에서 **기존 monthOffset으로
   * 환산**되므로 이 화면의 상태 모양·쿼리 키는 한 칸도 바뀌지 않는다.
   */
  const [monthJumpOpen, setMonthJumpOpen] = useState(false);
  const goToMonthFromJump = (yearMonth: string) => {
    const nextOffset = resolveMonthJumpOffset(yearMonth, seoulToday);
    setMonthJumpOpen(false);
    setMonthOffset(nextOffset);
    // 이동 안내는 화살표 이동과 **같은 계산**을 읽어 준다(A11Y-117).
    announceForA11y(periodLabelForOffset(baseDate, "month", nextOffset));
  };

  // REC-124(H1): 한 요청은 한 페이지(기본 200 · 상한 500건)다 -- 목록·건수·합계·지난달 비교가
  // 모두 이 응답에서 나오므로, 첫 페이지만 읽으면 월 200건을 넘는 달이 조용히 잘린다(정렬이
  // spentOn desc라 잘리는 쪽은 그 달의 앞날짜다). fetchMonthExpenses가 CSV 내보내기와 같은
  // 커서 루프로 전량을 모으고, 모으지 못하면 오류를 던져 아래 재시도 카드로 드러난다
  // (src/expenses/month-expenses.ts).
  const expenses = useQuery({
    queryKey: ["expenses", childId, recordsYearMonth],
    enabled: Boolean(authToken && childId),
    queryFn: () => fetchMonthExpenses((page) => listExpenses(authToken!, childId!, recordsYearMonth, page))
  });

  // REC-123(D1): 월 요약 줄 아래 "지난달 같은 시점 대비" 한 줄. 홈(REP-121)이 쓰는 순수 모듈
  // src/home/last-month-comparison.ts를 **그대로 재사용**한다 -- 부분 합계 정직 비교, 짧은 구간·
  // 소액 기준에서의 퍼센트 발산 방지, 지난달 무기록 시 미표시까지 규칙이 한 곳에만 산다.
  //
  // 홈과 문구가 겹치는 것이 아니라 **위치 보완**이다: 홈의 한 줄은 "오늘 상태"를 훑는 자리에
  // 있고, 기록 탭은 사용자가 "이 합계가 왜 이 숫자인지" 확인하러 들어오는 자리다. 합계 바로
  // 아래에 같은 기준점이 있어야 홈으로 되돌아가지 않고 판단할 수 있다.
  //
  // 이번 달을 보고 있을 때만 렌더한다. 과거 달 탐색 중에는 "같은 시점"이라는 개념 자체가
  // 성립하지 않는다(6월을 보며 "지난달 같은 시점"이라 하면 5월 전체인지 오늘 일자까지인지
  // 알 수 없다) -- 사실이 아닌 비교를 만들 바에 아무 말도 하지 않는다.
  const isCurrentMonth = monthOffset === 0;
  const lastYearMonth = previousYearMonth(seoulToday);
  // 캐시 키가 홈과 완전히 동일한 ["expenses", childId, 지난달]이라 추가 네트워크 비용이 0이다
  // (react-query가 같은 응답을 공유하고, 지출 생성/수정 경로가 이미 invalidate하는 ["expenses"]
  // 프리픽스에 그대로 걸린다). 과거 달을 보는 동안에는 쿼리 자체를 비활성화한다.
  //
  // REC-124(H1): 비교 기준이 되는 지난달도 전량을 모은다. 첫 페이지만 읽으면 200건을 넘는 달의
  // 앞날짜가 통째로 잘려 기준 합계가 0이 되고, "지난달 같은 시점까지는 지출 기록이 없었어요"라는
  // 사실이 아닌 문장이 나온다. 홈도 같은 페처를 쓰므로 두 화면의 캐시 내용이 계속 같다.
  const lastMonthExpenses = useQuery({
    queryKey: ["expenses", childId, lastYearMonth],
    enabled: Boolean(authToken && childId && lastYearMonth && isCurrentMonth),
    queryFn: () => fetchMonthExpenses((page) => listExpenses(authToken!, childId!, lastYearMonth!, page))
  });

  // REC-121: 카테고리 필터 칩의 원천. 예전에는 정적 8타일(categoryCatalog)이라 실세션에서 정식
  // 12개 카테고리(서버가 DB마다 랜덤 UUID로 시드)로 기록된 지출은 어떤 칩을 눌러도 0건이었다.
  // 지출 수정·리포트·더보기 화면과 같은 ["categories"] 캐시를 공유하므로 보통 이미 채워져 있고,
  // 로딩/실패/오프라인이면 buildRecordsCategoryChips가 기존 8타일로 폴백한다.
  const categories = useQuery({
    queryKey: ["categories"],
    enabled: Boolean(authToken),
    staleTime: 5 * 60 * 1000,
    // CAT-124: includeAll=1 — 같은 응답이 칩(selectableCategories로 좁힘)과 행 부제의 이름
    // 해석(buildCategoryNameLookup, 별칭 라벨까지 필요)을 동시에 먹인다.
    queryFn: () => listCategories(authToken!, { includeAll: true })
  });
  const serverCategories = categories.data?.categories;
  // 안정된 함수 참조(행 memo 유지) + 칩과 같은 목록에서 나오는 이름 해석 — R19-A buildCategoryNameLookup.
  const categoryName = useMemo(() => buildCategoryNameLookup(serverCategories), [serverCategories]);

  // FAM-127: 작성자 이름 해석용 구성원 목록. **새 엔드포인트를 부르지 않는다** -- 가족 관리
  // (app/family/index.tsx)·설정(app/settings/index.tsx)이 이미 쓰는 ["household-members",
  // householdId] 캐시를 그대로 재사용하므로, 그 화면들을 거친 사용자에게는 요청이 0건이다.
  // 카테고리 캐시와 같은 이유로 staleTime을 길게 둔다(구성원은 거의 바뀌지 않고, 초대 수락·
  // 내보내기 경로가 이미 이 키를 invalidate한다).
  //
  // 라운드 27 L-4: 물어볼 가구는 세션의 기본 가구가 아니라 **보고 있는 아이의 가구**다. 아이의
  // householdId도 새 엔드포인트 없이 아이 관리·설정·리포트 화면과 같은 ["children"] 캐시에서
  // 읽는다(대개 이미 채워져 있다). 판정 규칙은 resolveExpenseHouseholdId에 있다.
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const childrenQuery = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  const householdId = resolveExpenseHouseholdId({
    children: childrenQuery.data?.children,
    childId,
    fallbackHouseholdId: sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null)
  });
  const householdMembers = useQuery({
    queryKey: ["household-members", householdId],
    enabled: Boolean(authToken && householdId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => listHouseholdMembers(authToken!, householdId!)
  });
  // 목록이 아직 없으면(로딩·실패·1인 가구) undefined가 그대로 흘러가 라벨이 생략된다 --
  // 기록 목록은 이 쿼리의 성공 여부와 무관하게 예전과 똑같이 그려진다.
  const householdMemberRefs = householdMembers.data?.members;

  // MOB-117 당겨서 새로고침: 보고 있는 달의 서버 목록 refetch + 오프라인 스냅샷(대기/실패/충돌
  // 배지, 로컬 대기 행) 재조회를 함께 수행한다. 세션이 없으면(비활성 쿼리) refetch가 잘못된
  // 토큰으로 queryFn을 강제 실행하므로 RefreshControl 자체를 붙이지 않는다.
  const hasRecordsSession = Boolean(authToken && childId);
  // 라운드 49 C-09: 이 탭에서도 아이를 바꾼다. 종전에는 입구가 홈 헤더와 설정뿐이라 둘째의
  // 기록을 보려면 기록 → 홈 → (전환) → 기록으로 세 화면을 돌아야 했다. 상태·부수효과·시트는
  // 홈과 **같은 한 벌**을 쓴다(src/children/ChildSwitchSheet.tsx) -- 캐시 무효화를 여기서
  // 다시 적으면 한쪽이 빠뜨렸을 때 아이 A의 목록이 아이 B 화면에 남는다(라운드 28).
  // 목록은 위 childrenQuery(["children"] 캐시)를 그대로 넘기므로 새 요청이 없다. 전환 후
  // 이 화면의 쿼리는 ["expenses", childId, …] 키라 이미 아이별로 갈려 있다.
  const childSwitch = useChildSwitchSheet({
    hasSession: hasRecordsSession,
    childId,
    children: childrenQuery.data?.children
  });
  /**
   * GAP-066 트랙 A(#2) — 월 선택 시트의 경계.
   *
   * 위쪽은 `canGoToNextPeriod`가 이미 말하는 "미래 아님" 규칙 그대로이고, 아래쪽은 **아이의
   * 생년월일/예정일에서 파생**한다("기록이 있는 가장 오래된 달"을 아는 API가 없다). 그 값은
   * 위 `["children"]` 캐시에서 그대로 읽으므로 **새 요청이 0건**이고, 모르면 하한을 두지
   * 않는다(모르면 막지 않는다). 판정은 전부 src/month-jump.ts에 있다.
   */
  const monthJumpBounds = {
    todayIso: seoulToday,
    earliestYearMonth: resolveMonthJumpEarliestMonth(
      childrenQuery.data?.children.find((child) => child.id === childId) ?? null
    )
  };
  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([expenses.refetch(), refreshOfflineSyncSnapshot()])
  );

  // -------------------------------------------------------------------------------------------
  // UX-L(A): 행 액션 실행부(수정 이동 / 같은 내용으로 또 기록 / 삭제 확인).
  //
  // 삭제는 지출 상세 화면(app/expenses/[expenseId].tsx)과 **완전히 같은 경로**를 탄다:
  // adoptServerExpense로 서버 행을 로컬 테이블에 들인 뒤(오프라인 아웃박스가 expectedVersion을
  // 붙여 보낼 수 있게) deleteExpenseOffline으로 삭제 대기를 건다. 목록에서만 쓰는 두 번째 삭제
  // 경로를 만들면 오프라인 큐·충돌 처리 규칙이 화면마다 갈린다.
  // -------------------------------------------------------------------------------------------
  const queryClient = useQueryClient();
  const removeExpense = useMutation({
    mutationFn: async (expense: ServerExpense) => {
      if (!authToken) throw new Error(EXPENSE_NOT_READY_ERROR);
      const localRow = await adoptServerExpense(expense);
      await deleteExpenseOffline(authToken, queryClient, localRow.localId);
    },
    // 삭제는 확인 Alert에서 이어지는 흐름이라 실패도 같은 자리(Alert)에서 알린다 -- 상세 화면과
    // 같은 판단이고 문구도 같은 모듈에서 온다.
    onError: (error) => {
      Alert.alert(EXPENSE_DELETE_FAILED_ALERT_TITLE, expenseMutationErrorMessage("delete", error));
    },
    // 삭제 대기 행은 오프라인 스냅숏이 곧바로 알려 주고(아래 재조정이 낡은 서버 행을 숨긴다),
    // 서버 확정 뒤의 목록 정리는 이 무효화가 맡는다 -- 상세 화면의 삭제와 같은 키다.
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      // GAP-062 #1 후속: 이 액션시트는 다섯 번째 지출 쓰기 경로다 — 지운 금액만큼 리포트
      // 집계와 예산 사용액이 줄어든다. 근거 전문은 app/expenses/new.tsx의 같은 두 줄 위.
      await queryClient.invalidateQueries({ queryKey: ["report"] });
      await queryClient.invalidateQueries({ queryKey: ["budget"] });
    }
  });
  // react-query의 `mutate`는 렌더마다 같은 참조라, 아래 핸들러가 안정된 참조로 남아 행 memo가
  // 깨지지 않는다(뮤테이션 객체 자체는 isPending이 바뀔 때마다 새로 만들어진다).
  const removeExpenseMutate = removeExpense.mutate;

  const handleRowAction = useCallback<RecordRowActionHandler>(
    (action, expense) => {
      if (action === "edit") {
        // UX-R(M): "수정"은 상세 화면으로 **가는** 동작이고, 상세 화면은 보기 전용 참여자도
        // 볼 수 있어야 한다(행 탭도 같은 경로로 온다 -- openExpenseDetail). 그래서 여기서는
        // 막지 않고, 그 화면의 저장·삭제 버튼이 같은 판정으로 답한다.
        router.push(`/expenses/${expense.id}`);
        return;
      }
      // "또 기록"(새 지출 생성)과 "삭제"는 서버 쓰기라 여기서 막는다. 액션시트 항목 자체는
      // 남겨 둔다 -- 항목이 사라지면 왜 사라졌는지 알 길이 없고, 눌렀을 때의 안내가 그 답이다.
      if (expenseEntryLocked) {
        explainExpenseEntryLock();
        return;
      }
      if (action === "repeat") {
        // 프리필은 품목명·금액·카테고리까지이고 **날짜는 넘기지 않는다** -- 과거 기록의 복사가
        // 아니라 새 기록이라 시트가 늘 하듯 오늘로 시작해야 한다(record-row-actions.ts 주석).
        const params = buildRepeatExpenseParams(expense);
        if (!params) return;
        router.push({ pathname: "/expenses/new", params });
        return;
      }
      Alert.alert(EXPENSE_DELETE_CONFIRM_TITLE, EXPENSE_DELETE_CONFIRM_MESSAGE, [
        { text: EXPENSE_DELETE_CONFIRM_CANCEL_LABEL, style: "cancel" },
        {
          text: EXPENSE_DELETE_CONFIRM_ACTION_LABEL,
          style: "destructive",
          onPress: () => removeExpenseMutate(expense)
        }
      ]);
    },
    // 두 값 모두 렌더 간 참조가 안정적이다(불리언 · 모듈 스코프 함수)라, 행 memo를 깨는
    // 새 핸들러가 매 렌더 만들어지지 않는다 -- 위 removeExpenseMutate와 같은 이유다.
    [removeExpenseMutate, expenseEntryLocked, explainExpenseEntryLock]
  );

  // EXP-005: not-yet-synced local expenses for this child, so a record created/edited while
  // offline shows up immediately even though the server hasn't confirmed it yet.
  const syncSnapshot = useOfflineSyncSnapshot();
  // FIX-118A (m-11): the snapshot's `counts` span EVERY child on this device, but this screen
  // only ever shows the selected child's records (see the childId filter used for the list rows
  // just below). Using the global counts made the badge claim "대기 3" while the list showed a
  // single pending row -- tapping through to 동기화 상태 then listed another child's records.
  // Recomputed here over the same childId filter so the badge and the rows always agree.
  const childSyncCounts = useMemo(() => {
    const counts = { pending: 0, syncing: 0, failed: 0, conflict: 0 };
    if (!childId) return counts;
    for (const row of syncSnapshot.rows) {
      if (row.childId !== childId || row.syncState === "synced") continue;
      counts[row.syncState] += 1;
    }
    return counts;
  }, [syncSnapshot.rows, childId]);
  const unsyncedCount = childSyncCounts.pending + childSyncCounts.syncing + childSyncCounts.failed + childSyncCounts.conflict;

  // H-2 fix: reconcile the server's listExpenses response with any not-yet-synced local rows for
  // this month -- an edited/deleted *existing* server expense would otherwise show up twice (the
  // stale server row + the local pending row) and double-count in the total. See
  // src/offline/expense-list-reconciliation.ts (unit-tested) for the full rationale.
  const serverExpenses = expenses.data?.expenses;
  // 이 아이의 미동기화 로컬 행 -- 보고 있는 달과 지난달 재조정이 **같은 집합**을 써야 두 항이
  // 대칭이 된다(아래 F3 주석).
  const childOfflineRows = useMemo(
    () => (childId ? syncSnapshot.rows.filter((row) => row.childId === childId) : []),
    [syncSnapshot.rows, childId]
  );
  // 라운드 59 트랙 A 후속 배선: `permanentlyFailedCount`는 이 달 목록에 그대로 보이지만 **다시
  // 보내도 반영되지 않는**(영구 실패 4xx) 행의 수다. 합계에서 빼지 않는 이유와 세는 범위는 순수
  // 모듈이 정한다(src/offline/expense-list-reconciliation.ts) -- 화면은 0이면 아무것도 그리지
  // 않고, 0이 아니면 아래 요약 줄 밑에 사실 한 줄을 덧붙이기만 한다.
  const {
    visibleServerExpenses: monthlyServerExpenses,
    offlinePendingRows,
    monthlyTotalKrw,
    permanentlyFailedCount
  } = useMemo(
    () => reconcileMonthlyExpenses(serverExpenses ?? [], childOfflineRows, recordsYearMonth),
    [serverExpenses, childOfflineRows, recordsYearMonth]
  );

  // 정밀 리뷰 F3: 델타의 두 항이 **같은 규칙**으로 나와야 한다.
  //
  // 이번 달 항(monthlyTotalKrw)은 reconcileMonthlyExpenses를 거쳐 미동기화 로컬 행까지 포함하는데,
  // 지난달 항은 서버 목록 원본을 그대로 넘기고 있었다. 오프라인에서 기록해 아직 올라가지 않은 행이
  // 남아 있으면(동기화 실패·충돌로 며칠씩 남는 경우가 실제로 있다) 이번 달에는 더해지고 지난달에는
  // 빠져서 "지난달 같은 시점보다 200% 많이 썼어요" 같은 **허위 비교**가 나온다. 반대로 지난달 서버
  // 행을 로컬에서 수정/삭제 대기시켜 둔 경우에는 기준액이 과대 계상된다(이미 취소한 지출로 비교).
  //
  // 그래서 지난달 목록에도 **똑같은 재조정**을 건다: 로컬 변경이 걸린 낡은 서버 행은 숨기고, 지난달
  // 날짜를 가진 로컬 대기 행은 더한다. 재조정 결과를 합계가 아니라 **행 목록**으로 되돌려주는 이유는
  // evaluateLastMonthComparison이 "같은 일자까지"를 스스로 잘라야 하기 때문이다(월 전체 합계로는
  // 동시점 비교가 불가능하다 -- src/home/last-month-comparison.ts 참고).
  //
  // 선물·환불 제외 기준(DNC-015)도 양쪽이 같다: reconcileMonthlyExpenses의 countsTowardMonthlyTotal을
  // sumMonthExpensesThroughDay가 그대로 import해 쓴다(expenseType 없는 레거시 로컬 행 = expense 포함).
  const lastMonthComparableRecords = useMemo<ComparableExpenseRecord[] | null>(() => {
    const lastMonthServerExpenses = lastMonthExpenses.data?.expenses;
    if (!lastYearMonth || !lastMonthServerExpenses) return null;
    const reconciled = reconcileMonthlyExpenses(lastMonthServerExpenses, childOfflineRows, lastYearMonth);
    return [
      ...reconciled.visibleServerExpenses,
      ...reconciled.offlinePendingRows.map((row) => ({
        amountKrw: row.payload.amountKrw,
        spentOn: row.payload.spentOn,
        expenseType: row.payload.expenseType
      }))
    ];
  }, [lastMonthExpenses.data, childOfflineRows, lastYearMonth]);

  // REC-123(D1): 이번 달 값으로는 화면에 이미 보이는 합계(monthlyTotalKrw)를 그대로 넘긴다 --
  // 오프라인 대기 행까지 반영된 이 화면의 숫자와 비교 문장이 어긋나면 그 자체가 허위 표시다.
  // 서버 목록이 아직 없으면(로딩/오류) 합계 0을 "이번 달 지출 없음"으로 오해할 수 있으므로
  // 요약 줄과 똑같이 expenses.data가 있을 때만 계산한다.
  const lastMonthInsight =
    isCurrentMonth && expenses.data
      ? evaluateLastMonthComparison({
          todayIso: seoulToday,
          thisMonthToDateKrw: monthlyTotalKrw,
          lastMonthRecords: lastMonthComparableRecords
        })
      : null;

  const categoryChips = useMemo(
    () => buildRecordsCategoryChips(serverCategories, selectedCategoryId),
    [serverCategories, selectedCategoryId]
  );
  // 선택된 칩이 흡수한 동명 중복 id까지 모두 매칭한다 -- 서버 시드에는 정식 "기타"와 mobile_etc
  // 별칭 "기타"가 함께 있고(별칭 id는 빠른 기록 8타일이 실제로 쓰는 값), 데모 백엔드에도 카탈로그
  // "기저귀"와 픽스처 "기저귀"가 함께 있어서, 살아남은 칩의 id 하나로만 거르면 나머지 절반이
  // 통째로 사라진다. src/expenses/records-list-view.ts 참고.
  const selectedCategoryIds = useMemo(() => {
    if (!selectedCategoryId) return null;
    const chip = categoryChips.find((candidate) => candidate.id === selectedCategoryId);
    return new Set(chip ? chip.matchIds : [selectedCategoryId]);
  }, [categoryChips, selectedCategoryId]);

  // 라운드 41 K-12: 검색 판정은 **순수 모듈 한 곳**에 있다. 예전에는 여기서
  // `${itemName} ${memo}` 연결 문자열을 훑고 스니펫은 품목명·메모를 따로 봐서, 경계에 걸친
  // 검색어("귀 조" ← "기저귀" + "조리원")가 필터만 통과하고 근거는 없는 행을 만들었다.
  // 이제 두 자리가 같은 함수를 부르므로 그런 조합이 정의상 생기지 않는다.
  const { visibleExpenses, visibleOfflineRows } = useMemo(() => {
    return {
      visibleExpenses: monthlyServerExpenses.filter((expense) => {
        if (selectedCategoryIds && !selectedCategoryIds.has(expense.categoryId)) return false;
        return matchRecordSearch({
          itemName: expense.itemName,
          merchant: expense.merchant,
          memo: expense.memo,
          searchText
        }).matches;
      }),
      visibleOfflineRows: offlinePendingRows.filter((row) => {
        if (selectedCategoryIds && !selectedCategoryIds.has(row.payload.categoryId)) return false;
        return matchRecordSearch({
          itemName: row.payload.itemName,
          merchant: row.payload.merchant,
          memo: row.payload.memo,
          searchText
        }).matches;
      })
    };
  }, [monthlyServerExpenses, offlinePendingRows, selectedCategoryIds, searchText]);

  // Offline pending rows first (same order as the old eager render), then server rows.
  const listData = useMemo<RecordsListItem[]>(
    () => [
      // UX-T(C): 오프라인 대기 행에는 메모 스니펫을 붙이지 않는다 -- 그 행의 부제 자리는 이미
      // 동기화 상태("동기화 대기 · 8월 4일")가 쓰고 있고, 지금 이 기기에서 방금 적은 기록이라
      // "왜 걸렸는지"를 설명할 이유도 적다(작성자 라벨을 생략하는 것과 같은 판단).
      ...visibleOfflineRows.map(
        (row): RecordsListItem => ({
          kind: "offline",
          key: `offline:${row.localId}`,
          spentOn: row.payload.spentOn,
          amountKrw: row.payload.amountKrw,
          expenseType: row.payload.expenseType,
          row
        })
      ),
      ...visibleExpenses.map(
        (expense): RecordsListItem => ({
          kind: "server",
          key: `server:${expense.id}`,
          spentOn: expense.spentOn,
          amountKrw: expense.amountKrw,
          expenseType: expense.expenseType,
          expense,
          categoryName,
          // FAM-127: 오프라인 대기 행에는 라벨을 붙이지 않는다 -- 아직 이 기기에서 방금 만든
          // 내 기록이라 작성자가 자명하고, 서버가 준 createdByUserId도 아직 없다.
          authorLabel: resolveExpenseAuthorLabel(expenseCreatedByUserId(expense), householdMemberRefs),
          // UX-T(C) → K-12: "조리원"으로 검색해 3건이 나왔는데 화면 어디에도 조리원이 없던
          // 자리 -- 위 필터와 **같은 함수**가 "어디서 맞았는지"까지 돌려주므로, 그 근거를 그대로
          // 부제에 붙인다(품목명에서 맞은 행은 제목이 곧 근거라 null). 검색어가 없으면 null이라
          // 목록은 종전과 완전히 같다(판정·자르기 규칙은 순수 모듈에 있다).
          // GAP-054 D#8: 판매처 갈래도 같은 함수에서 나온다 -- 필터가 통과시키는데 근거를
          // 말하지 못하는 조합이 정의상 생기지 않는다(위 필터와 인자가 한 벌이다).
          searchSnippet: matchRecordSearch({
            itemName: expense.itemName,
            merchant: expense.merchant,
            memo: expense.memo,
            searchText: searchText
          }).snippet,
          // UX-L(A): 롱프레스 액션 실행부. 안정된 참조라 행 memo(PERF-102)가 그대로 유지된다.
          // 오프라인 대기 행에는 붙이지 않는다 -- 아직 서버 id가 없어 상세로 갈 수도, 같은
          // 삭제 경로(adoptServerExpense)를 탈 수도 없다(그 행은 종전대로 동기화 상태로 간다).
          onAction: handleRowAction
        })
      )
    ],
    [visibleOfflineRows, visibleExpenses, categoryName, handleRowAction, householdMemberRefs, searchText]
  );

  const monthlyRecordCount = monthlyServerExpenses.length + offlinePendingRows.length;
  const hasMonthlyRecords = Boolean(expenses.data) && monthlyRecordCount > 0;
  // Same gating as the old conditional render: rows only appear once the server list has
  // resolved (loading -> skeleton, error -> retry card, disabled query -> empty state).
  const showList = !expenses.isLoading && !expenses.isError && Boolean(expenses.data);
  const hasVisibleRecords = showList && listData.length > 0;

  // UX-B: 평평한 목록 대신 **날짜 그룹**. 그룹핑·라벨·소계 규칙은 전부 순수 모듈에 있고
  // (src/expenses/records-date-groups.ts) 여기서는 SectionList가 요구하는 `data` 이름만 붙인다.
  //
  // 넘기는 것은 **필터가 이미 걸린** listData다 -- 카테고리 칩/검색이 켜져 있으면 일별 소계도
  // 화면에 실제로 보이는 행의 합이 된다(보이지 않는 행이 소계에 섞이면 그게 허위 표시다).
  // 필터가 없을 때 모든 소계의 합은 위 월 합계(monthlyTotalKrw)와 정확히 같다 -- 양쪽이
  // countsTowardMonthlyTotal(DNC-015)이라는 같은 술어를 쓰기 때문이다.
  const dateGroups = useMemo(
    () => (showList ? groupExpensesByDate(listData, seoulToday) : []),
    [showList, listData, seoulToday]
  );

  // 달력 뷰에서는 섹션을 비운다 -- 같은 데이터를 격자와 목록으로 동시에 마운트할 이유가 없고,
  // 목록을 그대로 둔 채 격자를 헤더에 얹으면 한 화면에 같은 내용이 두 번 나온다.
  const sections = useMemo<RecordsSection[]>(
    () =>
      isCalendarView
        ? []
        : dateGroups.map(({ rows, ...group }) => ({
            ...group,
            data: rows
          })),
    [isCalendarView, dateGroups]
  );

  // UX-D: 달력 격자. 일별 합계는 **UX-B가 이미 만든 날짜 그룹**에서 그대로 나온다(소계 술어는
  // countsTowardMonthlyTotal 한 곳뿐이라 칸의 금액 = 그날 섹션 헤더의 소계 = 월 합계의 부분).
  // 필터가 걸린 listData에서 나온 그룹이므로, 카테고리 칩을 고르면 달력이 그 카테고리의
  // 히트맵이 된다 -- 목록과 달력이 늘 같은 모집단을 본다.
  const calendarMonth = useMemo(
    () => (isCalendarView ? buildCalendarMonth(recordsYearMonth, dailyTotalsFromDateGroups(dateGroups), seoulToday) : null),
    [isCalendarView, recordsYearMonth, dateGroups, seoulToday]
  );

  // F8: 필터가 걸렸을 때의 스코프 줄. 금액은 **새로 계산하지 않고** 화면이 이미 그리는 일별
  // 소계(dateGroups[].subtotalKrw)를 그대로 더한다 -- 정의상 "화면에 보이는 소계의 합"이라
  // 사용자가 눈으로 검산해도 어긋날 수 없다(달력 뷰의 칸 금액도 같은 그룹에서 나온다).
  // 소계가 없는 날(선물·환불만 있는 날)의 subtotalKrw는 0이므로 그대로 더해도 된다.
  const filteredSubtotalKrw = useMemo(
    () => dateGroups.reduce((sum, group) => sum + group.subtotalKrw, 0),
    [dateGroups]
  );
  // 선택한 칩의 라벨. 칩은 selectedCategoryId를 항상 흡수하도록 만들어지지만(선택이 서버 목록에
  // 없으면 buildRecordsCategoryChips가 맨 앞에 끼워 넣는다), 못 찾은 경우에도 이름을 지어내지
  // 않도록 categoryFiltered를 따로 넘긴다.
  //
  // 라운드 34 L7: 문장에 넣는 것은 칩의 표시 라벨이 아니라 **문장용 이름**(plainLabel)이다.
  // 그때는 폴백 8타일 칩의 라벨에 아이콘 이모지가 붙어 있어("🧷 기저귀") 스코프 줄과 달력
  // 범례 문장 한가운데로 이모지가 흘러들었다. D1 후속으로 그 접두는 사라져 지금은 두 값이
  // 같지만, 문장 쪽 출처는 계속 plainLabel 하나로 둔다(records-list-view.ts의 필드 주석).
  const selectedCategoryLabel = selectedCategoryId
    ? (categoryChips.find((chip) => chip.id === selectedCategoryId)?.plainLabel ?? null)
    : null;
  const filterScopeSummary = useMemo(
    () =>
      buildRecordsFilterScopeSummary({
        categoryLabel: selectedCategoryLabel,
        categoryFiltered: selectedCategoryId !== null,
        searchText,
        recordCount: listData.length,
        totalKrw: filteredSubtotalKrw
      }),
    [selectedCategoryLabel, selectedCategoryId, searchText, listData.length, filteredSubtotalKrw]
  );

  // 라운드 39 UX-P: 월 요약 줄 · 검색 범위 고지 · 0건 카드의 "지난달에서 찾기" 보조 액션.
  // 셋 다 순수 문구 모듈(src/expenses/records-list-view.ts)에서 나오고, 달 이름은 화면이 이미
  // 그리고 있는 라벨을 그대로 넘긴다 -- 여기서 날짜를 다시 계산하지 않으므로 어긋날 수 없다.
  const monthSummary = buildRecordsMonthSummary({
    monthLabel: recordsMonthLabel,
    recordCount: monthlyRecordCount,
    totalKrw: monthlyTotalKrw
  });
  // 라운드 48 T4(D3): 다자녀 가구에서만 이 숫자가 **누구의 것인지**를 요약 줄 앞에 붙인다.
  // 새 요청은 없다 -- 위에서 이미 읽고 있는 ["children"] 캐시(householdId 해석용)를 그대로 쓴다.
  // 아이가 하나이거나 목록을 아직/영영 해석할 수 없으면 null이라 화면이 종전과 한 글자도
  // 다르지 않다(규칙은 src/children/child-switch.ts resolveChildScopeLabel).
  const childScopeLabel = resolveChildScopeLabel(childId, childrenQuery.data?.children);
  const searchScopeNotice = buildRecordsSearchScopeNotice({ searchText, monthLabel: recordsMonthLabel });
  // 라운드 39 I-4: 이 이동은 검색어뿐 아니라 카테고리 칩도 그대로 들고 간다 -- 스크린리더 라벨이
  // 그 사실을 말해야 넘어간 달의 0건이 "그 달에 없다"로 잘못 들리지 않는다. 0건 카드의 제목·기본
  // 액션도 같은 두 필터를 함께 보고 만든다(문구는 전부 순수 모듈에서 나온다).
  const previousMonthSearchAction = buildRecordsSearchPreviousMonthAction({
    searchText,
    previousMonthLabel,
    categoryFiltered: selectedCategoryId !== null,
    categoryLabel: selectedCategoryLabel
  });
  const filteredEmptyState = buildRecordsFilteredEmptyState({
    searchText,
    categoryFiltered: selectedCategoryId !== null,
    categoryLabel: selectedCategoryLabel
  });
  // GAP-067 트랙 A(#2) 곁가지: 검색 0건의 두 번째 탈출구 — 한 달 되감기 옆에 **달을 고르는**
  // 자리를 하나 더 둔다(시트는 이미 이 화면에 있다 — 여는 자리만 늘린다). 라벨·접근성 문구는
  // 위 "지난달에서 찾기"와 같은 순수 모듈·같은 조립이다.
  const monthJumpSearchAction = buildRecordsSearchMonthJumpAction({
    searchText,
    categoryFiltered: selectedCategoryId !== null,
    categoryLabel: selectedCategoryLabel
  });
  // 라운드 39 I-5 → GAP-067 트랙 A(#2): 그 달에 기록이 하나도 없을 때의 문구·액션. 현재 달이면
  // 종전 "이번 달" 문구·[기록하기] 그대로이고(홈 화면의 같은 카드와 한 글자도 다르지 않다),
  // 끝난 달에서는 사실 한 줄 + 그 달에서 실제로 할 수 있는 일을 가리킨다. 판정은 전부 순수
  // 모듈에 있고 화면은 아래에서 키(action)로 배선만 한다.
  const emptyMonthState = buildRecordsEmptyMonthState({
    monthLabel: recordsMonthLabel,
    isCurrentMonth: monthOffset === 0,
    // 라운드 40 J-5: 보기 전용 세션에는 "첫 기록을 남기면 …"이라는 약속 대신 사실을 말한다
    // (홈의 빈 카드와 같은 문장 · 같은 단일 소스). 버튼은 그대로 서서 눌렀을 때 안내한다.
    expenseEntryLocked,
    // 달력이 이미 화면에 서 있으면 "달력에서 고르기"는 보낼 곳이 없다(순수 모듈의 판정).
    isCalendarView
  });

  // UX-N: 조회 실패 카드 문구는 연결 상태에 따라 갈린다(items 탭과 같은 배선).
  const loadErrorCopy = useLoadErrorCopy(expenses.isError);

  // 달력 칸 → 그날 기록. 목록으로 전환하고, 그 다음 렌더에서 해당 날짜 섹션으로 스크롤한다.
  // 안정된 참조여야 CalendarDayCell의 memo가 매 렌더 깨지지 않는다.
  const handleSelectCalendarDate = useCallback((date: string) => {
    setViewMode(RECORDS_VIEW_LIST);
    // 라운드 36 F-6: 이전 날짜로 예약해 둔 재시도 프레임을 먼저 취소한다. 8/12를 누르고
    // (스크롤 실패로 rAF가 예약된 채) 곧바로 8/20을 누르면, 살아남은 프레임이 깨어나
    // pendingScrollDate를 8/12로 되돌려 방금 고른 날짜의 스크롤을 덮어썼다.
    if (scrollRetryFrameRef.current !== null) cancelAnimationFrame(scrollRetryFrameRef.current);
    scrollRetryFrameRef.current = null;
    // M3: 새로 고른 날짜마다 재시도 예산을 처음부터 준다(칸을 다시 누르는 것이 곧 재시도 요청이다).
    scrollTargetDateRef.current = date;
    scrollRetryCountRef.current = 0;
    setPendingScrollDate(date);
    announceForA11y(`${formatSpentOn(date)} 기록`);
  }, []);

  /**
   * 라운드 63 C(#8) — 달력의 **빈 날 칸** → 그날로 기록하기.
   *
   * 왜 이 자리인가: `record_gap` 알림("3일 동안 기록이 없어요")의 목적지가 이 달력이고
   * (라운드 56 D#10), 그 근거는 "비어 있는 날을 보여 주는 화면은 달력 격자 하나뿐"이다.
   * 그런데 그 빈 칸이 화면에서 유일하게 손댈 수 없는 것이라 알림이 막다른 길로 착지했다.
   *
   * 날짜를 싣는 근거(프리필 계약의 세 번째 경우)는 src/expenses/record-row-actions.ts 머리말에
   * 함께 적혀 있다 -- 규칙을 두 벌로 만들지 않는다. 파라미터 이름·파싱도 "고쳐서 다시 보내기"와
   * 같은 것을 쓰므로(`spentOn` → resolveFailedRowPrefillDate) 시트에는 새 파싱이 0건이다.
   *
   * 보기 전용 참여자는 여기서 막는다(행 액션의 "또 기록"·삭제와 같은 판정 · 같은 안내) --
   * 잠긴 칸을 지우는 대신 눌렀을 때 사실을 말하는 것이 이 앱의 관례다.
   */
  const handleRecordForCalendarDate = useCallback(
    (date: string) => {
      if (expenseEntryLocked) {
        explainExpenseEntryLock();
        return;
      }
      router.push({ pathname: "/expenses/new", params: { spentOn: date } });
    },
    [expenseEntryLocked, explainExpenseEntryLock]
  );

  useEffect(() => {
    if (!pendingScrollDate) return;
    const sectionIndex = sections.findIndex((section) => section.key === pendingScrollDate);
    // 시도 표시는 여기서 지운다. 실제 재시도는 onScrollToIndexFailed가 상한(2회) 안에서만 건다.
    setPendingScrollDate(null);
    if (sectionIndex < 0) {
      // 그 날짜 섹션이 아예 없다(필터가 그 사이 바뀌었다 등) -- 재시도해도 결과가 같으므로 멈춘다.
      scrollTargetDateRef.current = null;
      return;
    }
    try {
      sectionListRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, viewPosition: 0, animated: true });
    } catch {
      // 실패 안전: 스크롤이 안 되더라도 사용자는 이미 그 달의 목록을 보고 있다(onScrollToIndexFailed도 참고).
    }
  }, [pendingScrollDate, sections]);

  // M3: 실패 → 다음 프레임에 같은 날짜로 한 번 더(최대 2회). 상한을 넘으면 목록 상단을 유지한다.
  const handleRecordsScrollToIndexFailed = useCallback(() => {
    const date = scrollTargetDateRef.current;
    if (!date) return;
    if (scrollRetryCountRef.current >= RECORDS_SCROLL_RETRY_LIMIT) {
      scrollTargetDateRef.current = null;
      return;
    }
    scrollRetryCountRef.current += 1;
    // 같은 프레임에 다시 부르면 리스트가 아직 그대로라 똑같이 실패한다 -- 한 틱 미뤄 그 사이
    // 마운트된 행을 반영시킨다. F7: 핸들을 보관해 언마운트/재예약 때 취소한다.
    if (scrollRetryFrameRef.current !== null) cancelAnimationFrame(scrollRetryFrameRef.current);
    scrollRetryFrameRef.current = requestAnimationFrame(() => {
      scrollRetryFrameRef.current = null;
      setPendingScrollDate(date);
    });
  }, []);

  // F7: 예약된 재시도 프레임은 화면과 함께 사라져야 한다.
  useEffect(
    () => () => {
      if (scrollRetryFrameRef.current !== null) cancelAnimationFrame(scrollRetryFrameRef.current);
    },
    []
  );

  // Rendered as an element (not an inline component) so the TextInput keeps focus across
  // re-renders -- FlatList remounts ListHeaderComponent when it's a new function each render.
  const listHeader = (
    <View style={{ gap: theme.spacing.section, marginBottom: theme.spacing.section }}>
      {/* 라운드 39 UX-P: 부제도 보고 있는 달을 말한다. 종전에는 6월을 펼쳐 놓고도 "이번 달
          지출 내역"이라고 적혀 있어, 바로 아래 월 이동 라벨("2026년 6월")과 어긋났다. */}
      <ScreenHeader eyebrow="지출 기록" title="기록" subtitle={`${recordsMonthLabel} 지출 내역을 한눈에 확인해 보세요.`} />

      <PrimaryButton label="빠른 지출 기록" onPress={expenseGate.guard(() => router.push("/expenses/new"))} />

      {confirmedFlash ? <Toast message={confirmedFlash} tone="success" /> : null}

      {unsyncedCount > 0 ? (
        <Pressable
          accessibilityLabel={syncStatusChipAccessibilityLabel(childSyncCounts)}
          accessibilityRole="button"
          onPress={() => router.push("/sync-status")}
          style={{ alignItems: "center", flexDirection: "row", gap: 8 }}
        >
          {childSyncCounts.pending + childSyncCounts.syncing > 0 ? (
            <StatusBadge label={syncStatusBadgeLabel("pending", childSyncCounts.pending + childSyncCounts.syncing)} tone="neutral" />
          ) : null}
          {childSyncCounts.failed > 0 ? <StatusBadge label={syncStatusBadgeLabel("failed", childSyncCounts.failed)} tone="warning" /> : null}
          {childSyncCounts.conflict > 0 ? (
            <StatusBadge label={syncStatusBadgeLabel("conflict", childSyncCounts.conflict)} tone="warning" />
          ) : null}
        </Pressable>
      ) : null}

      <View style={{ gap: 6 }}>
        {/* 라운드 49 C-08/C-09: 아이 이름은 이제 요약 문장 **앞에 붙는 항목**이 아니라 이 블록의
            첫 줄이다. " · "로 이어 붙이면("다온이 · 2026년 8월 42건 · 합계 …") 구분자가 셋이
            되면서 이름이 "8월"·"합계"와 동급 항목처럼 읽혔다. 줄을 나누면 층위가 눈에 보이고
            (아이 → 달 → 그 달의 숫자), 그 줄이 곧 아이 전환 입구가 된다(C-09).
            달 이동·요약 줄보다 **위**에, 그리고 목록 데이터와 무관하게 그린다 -- 전환 직후
            새 아이의 조회가 로딩/실패여도 되돌아갈 입구가 남아야 한다(홈 H-9와 같은 판단).
            아이가 하나이거나 비세션이면 canSwitch·childScopeLabel이 모두 거짓/null이라 이 줄이
            통째로 없다 = 종전 화면 그대로다. */}
        {childSwitch.canSwitch && childScopeLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={childSwitchTriggerAccessibilityLabel(childScopeLabel)}
            accessibilityHint={CHILD_SWITCH_TRIGGER_HINT}
            hitSlop={8}
            onPress={childSwitch.toggle}
            testID="records-child-switch-trigger"
            style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget }}
          >
            <Text style={{ color: theme.colors.brown, fontSize: theme.typography.body1.fontSize, fontWeight: "800" }}>
              {childScopeLabel}
            </Text>
          </Pressable>
        ) : null}
        {childSwitch.canSwitch && childSwitch.isOpen ? (
          <ChildSwitchSheet
            testID="records-child-switch-sheet"
            options={childSwitch.options}
            currentChildId={childId}
            onSelect={childSwitch.switchTo}
            onClose={childSwitch.close}
          />
        ) : null}
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 6
          }}
        >
          {/* DSN-053 P2-C: 달 내비 화살표를 텍스트 글리프(‹ ›)에서 승인 원본의 아이콘 문법으로
              옮긴다 -- c20deeb `app/(tabs)/records.tsx`와 같은 chevron 26 + 48dp 터치 타깃이다.
              글리프는 기기 폰트에 따라 굵기가 제각각이었고, hitSlop만으로는 실제 눌리는 상자가
              화면에 드러나지 않았다. 이동 규칙·비활성 조건·라벨은 한 글자도 바뀌지 않는다
              (다음 달 잠금은 색이 아니라 opacity로 말한다 -- gray300 화살표는 AA 미달이었다). */}
          <Pressable
            accessibilityLabel="이전 달"
            accessibilityRole="button"
            hitSlop={12}
            onPress={goToPreviousMonth}
            style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget, minWidth: theme.touchTarget }}
          >
            <AppIcon color={theme.colors.gray900} name="chevron-left" size={26} />
          </Pressable>
          {/* GAP-066 트랙 A(#2): 달 라벨이 곧 월 선택 시트의 입구다. 라운드 49 C-09의 선례대로
              <Text>를 Pressable로 **감싸기만** 한다 -- 라벨의 스타일·문자열은 한 글자도 손대지
              않으므로 렌더는 종전 그대로다(레이아웃 속성 무변경).
              라운드 66 적대 리뷰(M-2): 감싸기만 하면 버튼의 몸은 16px 글자 줄 하나(약 20dp)라
              hitSlop 8을 더해도 최소 터치 타깃에 못 미쳤다. 위 아이 전환 트리거와 **같은 한 줄**로
              48dp를 채운다 -- 이 줄은 이미 48dp 화살표 둘이 높이를 잡고 있고 라벨은 가운데
              정렬이라, 늘어난 것은 히트 영역뿐이고 렌더는 종전 그대로다. */}
          {hasRecordsSession ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={monthJumpTriggerAccessibilityLabel(recordsMonthLabel)}
              accessibilityHint={MONTH_JUMP_TRIGGER_HINT}
              hitSlop={8}
              onPress={() => setMonthJumpOpen((open) => !open)}
              testID="records-month-jump-trigger"
              style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget }}
            >
              <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>{recordsMonthLabel}</Text>
            </Pressable>
          ) : (
            <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>{recordsMonthLabel}</Text>
          )}
          <Pressable
            accessibilityLabel="다음 달"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canGoNextMonth }}
            disabled={!canGoNextMonth}
            hitSlop={12}
            onPress={goToNextMonth}
            style={{
              alignItems: "center",
              justifyContent: "center",
              minHeight: theme.touchTarget,
              minWidth: theme.touchTarget,
              opacity: canGoNextMonth ? 1 : 0.35
            }}
          >
            <AppIcon color={theme.colors.gray900} name="chevron-right" size={26} />
          </Pressable>
        </View>
        {/* GAP-066 트랙 A(#2): 월 선택 시트. 라벨을 눌렀을 때만 그린다(닫혀 있으면 화면은
            종전과 한 줄도 다르지 않다). */}
        {hasRecordsSession && monthJumpOpen ? (
          <MonthJumpSheet
            testID="records-month-jump-sheet"
            selectedYearMonth={recordsYearMonth}
            bounds={monthJumpBounds}
            onSelect={goToMonthFromJump}
            onClose={() => setMonthJumpOpen(false)}
          />
        ) : null}
        {/* PERF-102: lightweight month summary from already-fetched data (no extra API call).
            라운드 39 UX-P: 문구는 보고 있는 달의 라벨에서 나온다(buildRecordsMonthSummary) --
            아래 합계 카드의 "{recordsMonthLabel} 합계"와 같은 한 문자열이라 표기가 갈릴 수 없다.
            라운드 48 T4(D3) → 49 C-08: 보이는 문구는 위 줄이 이미 누구인지 말했으므로 종전
            그대로 두고, 스크린리더 라벨에만 이름을 쉼표로 앞세운다 -- 소리로는 줄 사이의 층위가
            전달되지 않아 이 한 줄만 따로 들으면 누구의 숫자인지 알 수 없기 때문이다. */}
        {expenses.data ? (
          <Text
            testID="records-month-summary"
            accessibilityLabel={withSpokenChildScopeLabel(monthSummary.accessibilityLabel, childScopeLabel)}
            style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, textAlign: "center" }}
          >
            {monthSummary.text}
          </Text>
        ) : null}
        {/* 라운드 59 트랙 A 후속 배선 — **"동기화 대기"라고 부를 수 없는 행**이 이 달 목록에 섞여
            있다는 사실 한 줄.

            바로 위 요약 줄(건수 · 총액)과 아래 합계 카드는 그 행의 금액을 **그대로 세고 있다**
            (순수 모듈이 합계에서 빼지 않는 이유는 expense-list-reconciliation.ts의
            `permanentlyFailedCount` 주석 참고 -- 목록에 보이는 금액을 다 더해도 총액이 나오지
            않는 화면은 사용자가 그 자리에서 반박할 수 있는 거짓이다). 대신 그 숫자가 아직 서버에
            반영되지 않았고 기다려도 반영되지 않는다는 것을 이 줄이 말한다.

            문구는 messages.ts 한 곳에서 나오고(동기화 상태 화면·리포트·CSV 고지와 같은 어휘),
            0건이면 아예 그리지 않는다 -- 평소 화면은 한 줄도 늘지 않는다. 목록을 그리지 않는
            상태(로딩·오류)에서도 그리지 않는다: "이 중"이 가리킬 목록이 화면에 없다.

            라운드 59 통합리뷰 P2-8 — **필터가 걸려 있을 때도 그리지 않는다.** 이 건수는 필터와
            무관한 그 달 전체에서 나오는데(reconcileMonthlyExpenses는 검색어·칩을 모르므로 바로 위
            월 요약 줄과 같은 모집단이다), "이 중"은 **바로 아래 보이는 목록**을 가리킨다. 검색어를
            친 순간 그 둘이 어긋난다: "조리원"으로 좁혀 2건만 보이는 화면에서 "이 중 3건은 보낼 수
            없는 기록이에요"는 어떤 셈으로도 맞지 않는다(사용자가 그 자리에서 반박할 수 있다).
            문구를 필터 무관 사실로 바꾸는 길도 있었지만, 그러면 이 줄만 위 요약 줄 계열이 되고
            아래 스코프 줄 계열과 층위가 섞인다 -- 필터가 걸린 화면에는 이미 그 사실을 말하는
            줄(records-filter-scope)이 따로 서 있으므로, 여기서는 **가리킬 대상이 확실할 때만
            말한다**. 판정은 그 스코프 줄과 같은 단일 소스다(filterScopeSummary가 null = 무필터). */}
        {showList && !filterScopeSummary && permanentlyFailedCount > 0 ? (
          <Text
            testID="records-unsendable-notice"
            style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, textAlign: "center" }}
          >
            {unsendableRowsNoticeText(permanentlyFailedCount)}
          </Text>
        ) : null}
        {/* 라운드 39 UX-P: 검색 범위 고지. 이 화면의 검색은 보고 있는 한 달치 응답
            (["expenses", childId, recordsYearMonth])에만 걸리므로, 검색 중일 때만 그 사실을
            한 줄로 밝힌다. 검색어가 없으면 null이라 예전 화면 그대로다. */}
        {searchScopeNotice ? (
          <Text
            testID="records-search-scope"
            style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, textAlign: "center" }}
          >
            {searchScopeNotice}
          </Text>
        ) : null}
        {/* F8: 카테고리 칩/검색이 켜져 있을 때만 붙는 스코프 줄. 위 월 요약 줄은 필터와 무관한
            그 달 전체이고, 이 줄은 화면에 보이는 행(=일별 소계의 합)이다 -- 필터가 없으면
            buildRecordsFilterScopeSummary가 null을 돌려주어 예전 화면 그대로다. 목록이 아직
            안 나온 상태(로딩·오류)에서는 그리지 않는다: 그때 "0건 · 0원"은 사실이 아니다. */}
        {showList && filterScopeSummary ? (
          <Text
            testID="records-filter-scope"
            accessibilityLabel={filterScopeSummary.accessibilityLabel}
            style={{
              color: theme.colors.gray600,
              fontSize: theme.typography.caption.fontSize,
              fontWeight: "700",
              textAlign: "center"
            }}
          >
            {filterScopeSummary.text}
          </Text>
        ) : null}
        {/* REC-123(D1): 요약 줄 바로 아래 한 줄. 홈과 같은 모듈이 만든 같은 문장이며, 이번 달을
            보고 있을 때만(과거 달 탐색 중에는 null) 나타난다. */}
        {lastMonthInsight ? (
          <Text
            testID="records-last-month-insight"
            style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, textAlign: "center" }}
          >
            {lastMonthInsight.text}
          </Text>
        ) : null}
        {/* UX-D: 월 요약 바로 아래 리스트/달력 토글. 요약 숫자를 본 다음 "그래서 언제 썼지?"로
            넘어가는 자리라, 달력 진입점이 그 숫자 옆에 있어야 한다. */}
        <View style={{ paddingTop: 6 }}>
          <SegmentedControl options={RECORDS_VIEW_OPTIONS} value={viewMode} onChange={setViewMode} />
        </View>
      </View>

      {/* GAP-054 D#8: 판매처 갈래가 더해졌으므로 placeholder도 실제로 훑는 곳을 말한다 --
          matchRecordSearch의 갈래 순서(품목명 → 판매처 → 메모)와 같은 순서이고, 범위 고지 줄의
          RECORDS_SEARCH_FIELDS_LABEL과 같은 목록이다. 약속과 판정이 갈리면 그 자체가 허위 표시다.
          라운드 54 P2-10: 그 목록을 여기 다시 적지 않고 **같은 상수에서** 만든다 -- 구분자가
          자리마다 갈려(고지는 가운뎃점, 여기는 쉼표) 소리로는 다른 문장이 되던 자리다. */}
      <TextInput
        accessibilityLabel={RECORDS_SEARCH_PLACEHOLDER}
        returnKeyType="search"
        onChangeText={setSearchText}
        placeholder={RECORDS_SEARCH_PLACEHOLDER}
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
        {categoryChips.map((category) => (
          <CategoryChip
            key={category.id}
            label={category.label}
            selected={category.id === selectedCategoryId}
            onPress={() => setSelectedCategoryId(category.id)}
          />
        ))}
      </ScrollView>

      {/* UX-D: 달력 격자. 서버 목록이 아직 안 왔을 때(로딩·오류)는 그리지 않는다 -- 빈 격자는
          "이번 달 지출이 하나도 없다"는 **사실이 아닌** 말이 된다. 그때는 아래 ListEmptyComponent의
          스켈레톤/재시도 카드가 그대로 나온다. */}
      {isCalendarView && showList && calendarMonth ? (
        // L5: 필터가 걸렸으면 그 스코프 이름을 그대로 넘긴다 -- 칸 라벨 접두와 범례가 F8 스코프
        // 줄과 **같은 문자열**을 쓰므로 세 표기가 갈릴 수 없다.
        <RecordsCalendarGrid
          month={calendarMonth}
          filterLabel={filterScopeSummary?.scopeLabel ?? null}
          onSelectDate={handleSelectCalendarDate}
          onRecordForDate={handleRecordForCalendarDate}
        />
      ) : null}

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

  // 라운드 39 UX-P: 검색 0건일 때만 붙는 보조 액션. 종전 0건 카드가 제안하는 유일한 다음 행동은
  // "검색어 지우기"(= 찾기를 포기하기)였는데, 이 화면의 검색은 한 달 안에서만 걸리므로 사용자가
  // 찾던 기록은 대개 이전 달에 있다. 이동은 **기존 ‹ 동작을 그대로 재사용**한다 -- 검색어 state는
  // 건드리지 않으므로 넘어간 달에서 같은 검색이 이어진다.
  const previousMonthSearchActionButton = previousMonthSearchAction ? (
    <TextButton
      accessibilityLabel={previousMonthSearchAction.accessibilityLabel}
      label={previousMonthSearchAction.label}
      onPress={goToPreviousMonth}
      style={{ alignItems: "center" }}
    />
  ) : null;

  // GAP-067 트랙 A(#2) 곁가지: 같은 카드에서 **달을 골라** 계속 찾는 자리. 여는 것은 헤더에 이미
  // 있는 그 시트 하나이고(새 컴포넌트·새 판정 0건), 검색어·필터 state는 건드리지 않으므로 고른
  // 달에서 같은 검색이 그대로 이어진다. 비세션에서는 시트 자체가 그려지지 않으므로 버튼도 없다.
  const monthJumpSearchActionButton =
    hasRecordsSession && monthJumpSearchAction ? (
      <TextButton
        accessibilityLabel={monthJumpSearchAction.accessibilityLabel}
        label={monthJumpSearchAction.label}
        onPress={() => setMonthJumpOpen(true)}
        style={{ alignItems: "center" }}
      />
    ) : null;

  const listEmpty = expenses.isLoading ? (
    // UX-5B-5 (D6): 가짜 버튼이 달린 EmptyStateCard 대신 스켈레톤 로딩.
    <View style={{ gap: theme.spacing.gap }}>
      <SkeletonCard />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  ) : expenses.isError ? (
    // UX-N: 오프라인이면 "잠시 후 다시" 대신 오프라인이라는 사실을 말한다. 카드 구조와
    // [다시 시도] 버튼은 그대로 -- 문구만 바뀐다(src/offline/messages.ts).
    <EmptyStateCard
      title={loadErrorCopy.title}
      actionLabel={loadErrorCopy.actionLabel}
      onPress={() => expenses.refetch()}
    />
  ) : hasMonthlyRecords && filteredEmptyState ? (
    // The month has records, but the category filter / search hid them all.
    // 라운드 39 I-4: 제목·액션 라벨은 두 필터를 함께 본 결과다(검색어가 있으면 검색 프레이밍이
    // 우선이고, 칩이 걸려 있으면 그 필터 이름과 해제 액션이 카드 안에 그대로 적힌다).
    <View style={{ gap: theme.spacing.gap }}>
      <EmptyStateCard
        title={filteredEmptyState.title}
        actionLabel={filteredEmptyState.actionLabel}
        onPress={() => {
          if (filteredEmptyState.action === "clear-category") setSelectedCategoryId(null);
          else setSearchText("");
        }}
      />
      {previousMonthSearchActionButton}
      {monthJumpSearchActionButton}
    </View>
  ) : (
    <View style={{ gap: theme.spacing.gap }}>
      <EmptyStateCard
        title={filteredEmptyState ? filteredEmptyState.title : emptyMonthState.title}
        actionLabel={filteredEmptyState ? filteredEmptyState.actionLabel : emptyMonthState.actionLabel}
        onPress={() => {
          // 필터/검색을 푸는 갈래는 잠금과 무관하다(읽기 동작이다).
          if (filteredEmptyState) {
            if (filteredEmptyState.action === "clear-category") setSelectedCategoryId(null);
            else setSearchText("");
            return;
          }
          // GAP-067 트랙 A(#2): 끝난 빈 달의 두 갈래는 **화면 이동**이라 잠금과 무관하다(읽기
          // 동작이다). 지출 생성 입구인 "record"만 종전처럼 게이트를 지난다.
          if (emptyMonthState.action === "open-calendar") {
            setViewMode(RECORDS_VIEW_CALENDAR);
            // 이 버튼은 눌린 자리에 그대로 있고 라벨만 바뀌므로(달력이 서면 카드의 액션이
            // "이번 달 보기"가 된다), 소리로는 아무 일도 일어나지 않은 것처럼 들린다. 세그먼트
            // 컨트롤이 이미 쓰는 그 옵션 이름을 그대로 읽어 준다(새 문구 0건).
            announceForA11y(RECORDS_VIEW_CALENDAR);
            return;
          }
          if (emptyMonthState.action === "go-current-month") {
            goToCurrentMonth();
            return;
          }
          expenseGate.guard(() => router.push("/expenses/new"))();
        }}
      />
      {previousMonthSearchActionButton}
      {monthJumpSearchActionButton}
    </View>
  );

  return (
    <View testID="screen-EXP-004" style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <SectionList
        ref={sectionListRef}
        sections={sections}
        keyExtractor={recordsRowKey}
        renderItem={renderRecordsRow}
        // UX-B: 날짜 헤더 + 일별 소계. sticky 여부는 SectionList 기본 동작에 맡긴다.
        renderSectionHeader={renderRecordsSectionHeader}
        // GAP-065 #6: 이 화면의 스크롤러는 리스트 자체다(PERF-102) — 검색 입력이 그 리스트의
        // 헤더 안에 있으므로, 기본값("never")이면 검색어를 친 직후의 첫 탭이 카테고리 칩·결과
        // 행에 가지 않고 키보드만 내린다. "always"가 아니라 "handled"인 이유는 src/ui.tsx의
        // AppScreen 주석과 같다(빈 자리를 누르면 키보드는 여전히 내려가야 한다).
        keyboardShouldPersistTaps="handled"
        // MOB-117: PERF-102대로 이 화면의 스크롤러는 리스트 자체이므로(AppScreen 중첩 금지)
        // RefreshControl도 리스트 prop으로 단다.
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
        // UX-D: 달력 뷰에서는 섹션이 비어 있는 것이 **정상**이라(격자가 헤더에 있다) 빈 상태 카드를
        // 띄우지 않는다. 다만 보여줄 기록이 실제로 없을 때(로딩·오류·빈 달·필터 0건)는 달력 뷰에서도
        // 같은 안내가 필요하므로 그대로 내보낸다.
        ListEmptyComponent={isCalendarView && hasVisibleRecords ? undefined : listEmpty}
        // UX-D: 달력에서 누른 날짜로 스크롤할 때 대상 섹션이 아직 마운트되지 않았으면 조용히 포기한다.
        onScrollToIndexFailed={handleRecordsScrollToIndexFailed}
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
