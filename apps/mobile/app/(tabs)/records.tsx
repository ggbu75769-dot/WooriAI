import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
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
import { fetchMonthExpenses } from "../../src/expenses/month-expenses";
import {
  buildCalendarMonth,
  calendarCellAccessibilityLabel,
  calendarLegendText,
  CALENDAR_WEEKDAY_LABELS_KO,
  dailyTotalsFromDateGroups,
  formatCompactKrw,
  isCalendarCellInteractive,
  type CalendarCell,
  type CalendarMonth
} from "../../src/expenses/records-calendar";
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
  buildRecordsFilterScopeSummary,
  buildRecordsMonthSummary,
  buildRecordsSearchPreviousMonthAction,
  buildRecordsSearchScopeNotice,
  expenseCreatedByUserId,
  formatSpentOn,
  recordsRowSubtitle,
  resolveExpenseAuthorLabel,
  resolveExpenseHouseholdId
} from "../../src/expenses/records-list-view";
import { evaluateLastMonthComparison, previousYearMonth, type ComparableExpenseRecord } from "../../src/home/last-month-comparison";
import { formatKrw } from "../../src/money";
import { reconcileMonthlyExpenses } from "../../src/offline/expense-list-reconciliation";
import {
  syncStatusBadgeLabel,
  syncStatusCountLabel,
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
import { usePullToRefresh } from "../../src/query/use-pull-to-refresh";
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
          ? SYNC_ROW_PENDING_DELETE_LABEL
          : row.syncState === "conflict"
            ? SYNC_ROW_CONFLICT_LABEL
            : row.syncState === "failed"
              ? SYNC_ROW_FAILED_LABEL
              : `${SYNC_ROW_PENDING_LABEL} · ${formatSpentOn(row.payload.spentOn)}`
      }
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
  onAction
}: {
  expense: ServerExpense;
  categoryName: CategoryNameLookup;
  authorLabel: string | null;
  onAction: RecordRowActionHandler;
}) {
  const subtitle = recordsRowSubtitle({
    expenseType: expense.expenseType,
    authorLabel,
    categoryLabel: categoryName(expense.categoryId),
    dateLabel: formatSpentOn(expense.spentOn)
  });
  // 아래 ListRow의 `value`와 **같은 식**이다(스크린리더 라벨이 보이는 금액과 갈릴 수 없다).
  const amountLabel = formatKrw(expense.amountKrw);
  // 이 행이 실제로 제공하는 동작. 선물·환불 행에는 "또 기록"이 없다(DNC-015 -- 모듈 주석 참고).
  const rowActions = useMemo(() => buildRecordRowActions({ expenseType: expense.expenseType }), [expense.expenseType]);
  // A11Y: 롱프레스는 스크린리더로 **발견할 수 없는** 제스처다. 같은 목록을 커스텀 액션으로도
  // 내놓아 TalkBack/VoiceOver의 액션 메뉴에서 똑같이 고를 수 있게 한다.
  const rowAccessibilityActions = useMemo(() => recordRowAccessibilityActions(rowActions), [rowActions]);
  const rowAccessibilityHint = useMemo(() => recordRowAccessibilityHint(rowActions), [rowActions]);

  const openRowActionSheet = useCallback(() => {
    const sheet = buildRecordRowActionSheet({
      itemName: expense.itemName,
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

/**
 * 음영 팔레트(DNC-017): **새 색을 만들지 않는다**. 0단계(지출 없음)는 카드 배경톤,
 * 1~4단계는 기존 coral 스케일 토큰을 옅은 것부터 그대로 쓴다. rgba로 새 alpha 값을 지어내는
 * 대신 스케일 토큰을 쓰는 이유: 그 다섯 색은 이미 디자인 시스템이 고른 단계라, 팔레트가
 * 바뀌어도 달력만 따로 어긋나지 않는다.
 *
 * 라운드 34 L6 — 1단계를 coral[50]에서 **coral[100]으로 한 칸 올렸다**. beige(#FFF9F3)와
 * coral[50](#FFF3F0)은 채널 차이가 (0,6,3)뿐이라, "그날 돈을 썼다"와 "안 썼다"가 사실상
 * 같은 색이었다 -- 히트맵의 첫 단계가 안 보이면 달력이 하려던 말("언제 몰아서 썼나")의 절반이
 * 사라진다. coral[100](#FFE4DD)은 beige와 (0,21,22) 떨어져 눈에 잡히고, 위 단계 간격
 * (100→200: 0,27,34 / 200→300: 0,33,29 / 300→400: 0,30,20)과도 균일하다.
 *
 * 글자색 재검산(WCAG 2.1 상대휘도, 소형 볼드 = AA 4.5:1 기준): 단계가 한 칸씩 진해지면서
 * 가장 진한 칸이 coral[300](#FFA88E) → coral[400](#F97B5C)이 됐고, 예전 글자색
 * brown(#3D3733)은 그 위에서 **4.47:1로 AA에 미달**한다(coral[300] 위에서는 6.27:1이었다).
 * 그래서 칸 글자만 gray900(#1F1F1F)으로 낮춘다 -- 0단계 beige 위 15.8:1, 4단계 coral[400] 위
 * 6.29:1로 다섯 단계가 모두 AA를 넘는다. 단계마다 글자색을 바꾸지 않는 원칙은 그대로다
 * (한 색으로 전 단계를 통과시키는 것이 요점이고, 옅은 칸의 숫자도 그만큼 더 또렷해진다).
 * gray900은 이 화면이 이미 쓰는 토큰이라(월 이동 화살표) 새 색이 아니다.
 */
const calendarIntensityBackgrounds = [
  theme.colors.beige,
  theme.colors.coral[100],
  theme.colors.coral[200],
  theme.colors.coral[300],
  theme.colors.coral[400]
] as const;

/** 위 대비 재검산에 따른 칸 글자색. 다섯 단계 공통이다. */
const calendarCellTextColor = theme.colors.gray900;

/**
 * 라운드 34 M1 — 칸 가로 실측을 44dp에 최대한 붙인다.
 *
 * 예전 폭(폭 360dp 기기 기준):
 *   360 − 48(리스트 contentContainer padding = theme.spacing.screen 24 × 2)
 *       − 34(Card 테두리 1 × 2 + 기본 padding theme.spacing.card 16 × 2)
 *       − 24(칸 사이 gap 4 × 6) = 254 ÷ 7 = **36.3dp**.
 * 44dp 최소 터치 타깃에 8dp 가까이 모자랐고, 인접 간격이 4dp뿐이라 hitSlop으로 넓히면 옆
 * 날짜의 영역을 침범한다(잘못된 날짜로 이동하는 편이 좁은 것보다 나쁘다).
 *
 * 지금:
 *   360 − 48 − 18(테두리 1 × 2 + 축소한 카드 padding 8 × 2) − 12(gap 2 × 6) = 282 ÷ 7 = **40.3dp**.
 * 격자에서 44dp를 온전히 얻으려면 7 × 44 + gap = 314dp가 필요해 화면 가로 여백(48dp)을 통째로
 * 없애야 한다 -- 그건 이 화면만 다른 레이아웃을 갖게 되므로 하지 않는다. 대신 **세로로 갚는다**:
 * 칸 높이를 44 → 48dp로 올려 터치 면적을 40.3 × 48 ≈ 1,934dp²로 만들었다(44 × 44 = 1,936dp²와
 * 사실상 같다). 좁아진 축은 가로 한 방향뿐이고, 세로 여유가 위아래 오탭도 함께 줄인다.
 */
const CALENDAR_CARD_PADDING = 8;
const CALENDAR_CELL_GAP = 2;
const CALENDAR_CELL_MIN_HEIGHT = 48;

/**
 * 라운드 34 M2 — 칸 글자의 배율 상한.
 *
 * 축약 표기(formatCompactKrw)의 근거는 "잘린 숫자는 틀린 숫자"(45,0…)인데, 기기 글꼴 배율을
 * 크게 올리면 그 축약마저 칸을 넘쳐 잘렸다 -- 모듈이 지키던 규칙을 화면이 도로 깨고 있었다.
 * 여기서 배율을 1.2배로 물려 **칸 안에서 끝까지 읽히는 숫자**를 보장한다. 앱의 글꼴 최소치를
 * 새로 낮추지 않는다(fontSize는 그대로, 상한만 둔다). 정확한 금액은 어차피 스크린리더 라벨과
 * 그날 목록이 전한다.
 */
const CALENDAR_CELL_MAX_FONT_SCALE = 1.2;

const calendarCardStyle = { padding: CALENDAR_CARD_PADDING } as const;

const calendarWeekRowStyle = {
  flexDirection: "row",
  gap: CALENDAR_CELL_GAP
} as const;

const calendarWeekdayLabelStyle = {
  color: theme.colors.gray600,
  flex: 1,
  fontSize: theme.typography.caption.fontSize,
  fontWeight: "700",
  textAlign: "center"
} as const;

// 테두리 두께를 오늘/평일 모두 2로 고정하고 **색만** 바꾼다 -- 두께를 바꾸면 오늘 칸만 안쪽
// 크기가 달라져 격자가 한 줄 흔들린다.
const calendarCellStyle = {
  alignItems: "center",
  borderColor: "rgba(74, 63, 53, 0.10)",
  borderRadius: theme.radii.small,
  borderWidth: 2,
  flex: 1,
  gap: 1,
  justifyContent: "center",
  minHeight: CALENDAR_CELL_MIN_HEIGHT,
  paddingVertical: 4
} as const;

const calendarCellTodayBorderStyle = {
  borderColor: theme.colors.mainCoral
} as const;

// 달 밖 빈 칸: 자리만 차지하고 눌리지 않는다(옆 달 날짜를 그려 봐야 이 달 목록에는 그날 기록이
// 없어서 눌러도 아무 일도 일어나지 않는다).
const calendarCellSpacerStyle = {
  flex: 1,
  minHeight: CALENDAR_CELL_MIN_HEIGHT
} as const;

const calendarCellDayStyle = {
  color: calendarCellTextColor,
  fontSize: theme.typography.caption.fontSize,
  fontWeight: "700"
} as const;

const calendarCellAmountStyle = {
  color: calendarCellTextColor,
  fontSize: 10,
  fontWeight: "800"
} as const;

// L9: 9px는 이 앱에서 가장 작은 글자였다(다음으로 작은 것이 10px). 한 단어("선물")뿐이라
// 칸을 넘치지 않으므로 10px로 올리고, 금액과 **같은 배율 상한**을 함께 물린다.
const calendarCellGiftStyle = {
  color: theme.colors.gray600,
  fontSize: 10,
  fontWeight: "700"
} as const;

const calendarLegendStyle = {
  color: theme.colors.gray600,
  fontSize: theme.typography.caption.fontSize,
  lineHeight: theme.typography.caption.lineHeight
} as const;

/**
 * 달력 한 칸. 라벨/축약 표기 규칙은 전부 순수 모듈(src/expenses/records-calendar.ts)에 있다.
 *
 * 칸에 보이는 금액은 축약("4.5만")이고 스크린리더 라벨은 정확한 금액("45,000원")이다 --
 * 44pt 칸에 "45,000원"을 넣으면 잘려서 **틀린 숫자**로 읽힌다.
 */
const CalendarDayCell = memo(function CalendarDayCell({
  cell,
  filterLabel,
  onSelectDate
}: {
  cell: CalendarCell;
  filterLabel: string | null;
  onSelectDate: (date: string) => void;
}) {
  const date = cell.date;
  if (date === null) return <View style={calendarCellSpacerStyle} />;
  // 칸 안쪽(날짜 + 금액/선물)은 누를 수 있든 없든 완전히 같다 -- 비대화형이라고 정보를 지우지
  // 않는다(그날 지출이 없었다는 것도 히트맵이 말해야 할 사실이다).
  const cellContent = (
    <>
      <Text maxFontSizeMultiplier={CALENDAR_CELL_MAX_FONT_SCALE} style={calendarCellDayStyle}>
        {cell.day}
      </Text>
      {cell.totalKrw > 0 ? (
        <Text maxFontSizeMultiplier={CALENDAR_CELL_MAX_FONT_SCALE} numberOfLines={1} style={calendarCellAmountStyle}>
          {formatCompactKrw(cell.totalKrw)}
        </Text>
      ) : cell.hasGiftOnly ? (
        // 선물·환불만 있던 날. "0원"을 찍으면 아무것도 안 한 날처럼 보이는데 그날엔 기록이 있다
        // (UX-B 날짜 헤더가 소계를 감추는 것과 같은 판단).
        <Text maxFontSizeMultiplier={CALENDAR_CELL_MAX_FONT_SCALE} style={calendarCellGiftStyle}>
          선물
        </Text>
      ) : null}
    </>
  );
  const cellStyle = [
    calendarCellStyle,
    { backgroundColor: calendarIntensityBackgrounds[cell.intensity] },
    cell.isToday ? calendarCellTodayBorderStyle : null
  ];
  const accessibilityLabel = calendarCellAccessibilityLabel(cell, { filterLabel }) ?? undefined;

  // 라운드 34 L4: 그날 기록이 없는 칸은 **누를 수 없다**. 달 밖 빈 칸과 같은 근거로, 눌러도
  // 이동할 섹션이 목록에 없어 아무 일도 일어나지 않는다(버튼처럼 보이는데 반응이 없는 편이
  // 비대화형보다 나쁘다). disabled Pressable 대신 아예 View로 그리는 이유: disabled 버튼도
  // 스크린리더에는 "버튼, 비활성"으로 읽혀 "왜 못 누르지"라는 질문을 남긴다. 라벨은 그대로
  // 읽어 주므로 "8월 6일, 지출 없음"이라는 사실은 사라지지 않는다.
  if (!isCalendarCellInteractive(cell)) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel} style={cellStyle}>
        {cellContent}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => onSelectDate(date)}
      style={cellStyle}
    >
      {cellContent}
    </Pressable>
  );
});

/** 요일 헤더 + 주 격자 + 범례. 주 배열은 순수 모듈이 만들어 둔 것을 그대로 그린다. */
const RecordsCalendarGrid = memo(function RecordsCalendarGrid({
  month,
  filterLabel,
  onSelectDate
}: {
  month: CalendarMonth;
  /** L5: 필터가 걸렸을 때의 스코프 이름(F8 스코프 줄과 같은 문자열). 없으면 null. */
  filterLabel: string | null;
  onSelectDate: (date: string) => void;
}) {
  return (
    // M1: 카드 내부 패딩을 줄여 칸 폭을 벌었다(위 CALENDAR_CARD_PADDING 계산 참고).
    <Card style={calendarCardStyle}>
      <View style={{ gap: 4 }}>
        {/* 요일 머리글은 스크린리더에는 소음이다 -- 각 칸 라벨이 이미 "8월 27일"이라는 완전한
            날짜를 읽어준다. */}
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={calendarWeekRowStyle}>
          {CALENDAR_WEEKDAY_LABELS_KO.map((label) => (
            <Text key={label} style={calendarWeekdayLabelStyle}>
              {label}
            </Text>
          ))}
        </View>
        {month.weeks.map((week, weekIndex) => (
          <View key={`${month.yearMonth}-week-${weekIndex}`} style={calendarWeekRowStyle}>
            {week.map((cell) => (
              <CalendarDayCell key={cell.key} cell={cell} filterLabel={filterLabel} onSelectDate={onSelectDate} />
            ))}
          </View>
        ))}
        {/* L5: 필터가 걸리면 범례가 "무엇의 히트맵인지"까지 말한다(칸 라벨 접두와 같은 사실). */}
        <Text style={calendarLegendStyle}>{calendarLegendText(filterLabel)}</Text>
      </View>
    </Card>
  );
});

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
  const [monthOffset, setMonthOffset] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  // UX-D: 리스트/달력 보기. 리포트 탭의 기간 세그먼트(app/(tabs)/reports.tsx의 `period`)와 같은
  // 관례로 **화면 상태**만 둔다 -- 세션 간 저장은 하지 않는다. 기록 탭의 기본 동작은 "방금 적은
  // 것을 확인하는 목록"이고, 달력은 그 위에서 잠깐 훑는 뷰다.
  const [viewMode, setViewMode] = useState<string>(RECORDS_VIEW_LIST);
  const isCalendarView = viewMode === RECORDS_VIEW_CALENDAR;
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
    }
  });
  // react-query의 `mutate`는 렌더마다 같은 참조라, 아래 핸들러가 안정된 참조로 남아 행 memo가
  // 깨지지 않는다(뮤테이션 객체 자체는 isPending이 바뀔 때마다 새로 만들어진다).
  const removeExpenseMutate = removeExpense.mutate;

  const handleRowAction = useCallback<RecordRowActionHandler>(
    (action, expense) => {
      if (action === "edit") {
        router.push(`/expenses/${expense.id}`);
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
    [removeExpenseMutate]
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
  const { visibleServerExpenses: monthlyServerExpenses, offlinePendingRows, monthlyTotalKrw } = useMemo(
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

  const normalizedSearch = searchText.trim().toLowerCase();
  const { visibleExpenses, visibleOfflineRows } = useMemo(() => {
    return {
      visibleExpenses: monthlyServerExpenses.filter((expense) => {
        if (selectedCategoryIds && !selectedCategoryIds.has(expense.categoryId)) return false;
        if (!normalizedSearch) return true;
        const haystack = `${expense.itemName} ${expense.memo ?? ""}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      }),
      visibleOfflineRows: offlinePendingRows.filter((row) => {
        if (selectedCategoryIds && !selectedCategoryIds.has(row.payload.categoryId)) return false;
        if (!normalizedSearch) return true;
        const haystack = `${row.payload.itemName} ${row.payload.memo ?? ""}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    };
  }, [monthlyServerExpenses, offlinePendingRows, selectedCategoryIds, normalizedSearch]);
  const hasSearchQuery = normalizedSearch.length > 0;

  // Offline pending rows first (same order as the old eager render), then server rows.
  const listData = useMemo<RecordsListItem[]>(
    () => [
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
          // UX-L(A): 롱프레스 액션 실행부. 안정된 참조라 행 memo(PERF-102)가 그대로 유지된다.
          // 오프라인 대기 행에는 붙이지 않는다 -- 아직 서버 id가 없어 상세로 갈 수도, 같은
          // 삭제 경로(adoptServerExpense)를 탈 수도 없다(그 행은 종전대로 동기화 상태로 간다).
          onAction: handleRowAction
        })
      )
    ],
    [visibleOfflineRows, visibleExpenses, categoryName, handleRowAction, householdMemberRefs]
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
  // 라운드 34 L7: 문장에 넣는 것은 칩의 표시 라벨이 아니라 **이모지 없는 이름**(plainLabel)이다.
  // 폴백 8타일 칩의 라벨에는 아이콘이 붙어 있어("🧷 기저귀") 그대로 넣으면 스코프 줄과 달력
  // 라벨/범례 문장 한가운데로 이모지가 흘러들었다.
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
  const searchScopeNotice = buildRecordsSearchScopeNotice({ searchText, monthLabel: recordsMonthLabel });
  const previousMonthSearchAction = buildRecordsSearchPreviousMonthAction({ searchText, previousMonthLabel });

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

      <PrimaryButton label="빠른 지출 기록" onPress={() => router.push("/expenses/new")} />

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
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 6
          }}
        >
          <Pressable accessibilityLabel="이전 달" accessibilityRole="button" hitSlop={12} onPress={goToPreviousMonth}>
            <Text style={{ color: theme.colors.gray900, fontSize: 22, fontWeight: "900" }}>‹</Text>
          </Pressable>
          <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>{recordsMonthLabel}</Text>
          <Pressable
            accessibilityLabel="다음 달"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canGoNextMonth }}
            disabled={!canGoNextMonth}
            hitSlop={12}
            onPress={goToNextMonth}
          >
            <Text style={{ color: canGoNextMonth ? theme.colors.gray900 : theme.colors.gray300, fontSize: 22, fontWeight: "900" }}>›</Text>
          </Pressable>
        </View>
        {/* PERF-102: lightweight month summary from already-fetched data (no extra API call).
            라운드 39 UX-P: 문구는 보고 있는 달의 라벨에서 나온다(buildRecordsMonthSummary) --
            아래 합계 카드의 "{recordsMonthLabel} 합계"와 같은 한 문자열이라 표기가 갈릴 수 없다. */}
        {expenses.data ? (
          <Text
            testID="records-month-summary"
            accessibilityLabel={monthSummary.accessibilityLabel}
            style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, textAlign: "center" }}
          >
            {monthSummary.text}
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
  ) : hasMonthlyRecords ? (
    // The month has records, but the category filter / search hid them all.
    <View style={{ gap: theme.spacing.gap }}>
      <EmptyStateCard
        title={selectedCategoryId ? "이 카테고리의 기록이 없어요." : "검색 결과가 없어요."}
        actionLabel={selectedCategoryId ? "카테고리 필터 해제" : "검색어 지우기"}
        onPress={() => {
          if (selectedCategoryId) setSelectedCategoryId(null);
          else setSearchText("");
        }}
      />
      {previousMonthSearchActionButton}
    </View>
  ) : (
    <View style={{ gap: theme.spacing.gap }}>
      <EmptyStateCard
        title={hasSearchQuery ? "검색 결과가 없어요." : "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요."}
        actionLabel={hasSearchQuery ? "검색어 지우기" : "기록하기"}
        onPress={() => (hasSearchQuery ? setSearchText("") : router.push("/expenses/new"))}
      />
      {previousMonthSearchActionButton}
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
