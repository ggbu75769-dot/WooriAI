import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import type { ListRenderItemInfo, SectionListData, ViewStyle } from "react-native";
import { Pressable, RefreshControl, ScrollView, SectionList, Text, TextInput, View } from "react-native";
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
  CALENDAR_LEGEND_TEXT,
  CALENDAR_WEEKDAY_LABELS_KO,
  dailyTotalsFromDateGroups,
  formatCompactKrw,
  type CalendarCell,
  type CalendarMonth
} from "../../src/expenses/records-calendar";
import { groupExpensesByDate, type RecordsDateGroup } from "../../src/expenses/records-date-groups";
import {
  buildRecordsCategoryChips,
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
import { refreshOfflineSyncSnapshot, subscribeOfflineFlashMessage, useOfflineSyncSnapshot } from "../../src/offline/sync-controller";
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
  | { kind: "server"; expense: ServerExpense; categoryName: CategoryNameLookup; authorLabel: string | null }
);

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
const ServerExpenseListRow = memo(function ServerExpenseListRow({
  expense,
  categoryName,
  authorLabel
}: {
  expense: ServerExpense;
  categoryName: CategoryNameLookup;
  authorLabel: string | null;
}) {
  return (
    <ListRow
      title={expense.itemName}
      subtitle={recordsRowSubtitle({
        expenseType: expense.expenseType,
        authorLabel,
        categoryLabel: categoryName(expense.categoryId),
        dateLabel: formatSpentOn(expense.spentOn)
      })}
      value={formatKrw(expense.amountKrw)}
      onPress={() => router.push(`/expenses/${expense.id}`)}
    />
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
    <ServerExpenseListRow expense={item.expense} categoryName={item.categoryName} authorLabel={item.authorLabel} />
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
 * 글자는 전 단계 모두 brown(text.primary)이다 -- 가장 진한 coral[300] 위에서도 대비가
 * 충분하고(A11Y-117의 "작은 coral 글자" 함정을 애초에 피한다), 단계마다 글자색을 바꾸면
 * 옅은 칸의 숫자가 배경에 묻힌다.
 */
const calendarIntensityBackgrounds = [
  theme.colors.beige,
  theme.colors.coral[50],
  theme.colors.coral[100],
  theme.colors.coral[200],
  theme.colors.coral[300]
] as const;

const calendarWeekRowStyle = {
  flexDirection: "row",
  gap: 4
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
  minHeight: theme.touchTarget,
  paddingVertical: 4
} as const;

const calendarCellTodayBorderStyle = {
  borderColor: theme.colors.mainCoral
} as const;

// 달 밖 빈 칸: 자리만 차지하고 눌리지 않는다(옆 달 날짜를 그려 봐야 이 달 목록에는 그날 기록이
// 없어서 눌러도 아무 일도 일어나지 않는다).
const calendarCellSpacerStyle = {
  flex: 1,
  minHeight: theme.touchTarget
} as const;

const calendarCellDayStyle = {
  color: theme.colors.brown,
  fontSize: theme.typography.caption.fontSize,
  fontWeight: "700"
} as const;

const calendarCellAmountStyle = {
  color: theme.colors.brown,
  fontSize: 10,
  fontWeight: "800"
} as const;

const calendarCellGiftStyle = {
  color: theme.colors.gray600,
  fontSize: 9,
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
  onSelectDate
}: {
  cell: CalendarCell;
  onSelectDate: (date: string) => void;
}) {
  const date = cell.date;
  if (date === null) return <View style={calendarCellSpacerStyle} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={calendarCellAccessibilityLabel(cell) ?? undefined}
      onPress={() => onSelectDate(date)}
      style={[
        calendarCellStyle,
        { backgroundColor: calendarIntensityBackgrounds[cell.intensity] },
        cell.isToday ? calendarCellTodayBorderStyle : null
      ]}
    >
      <Text style={calendarCellDayStyle}>{cell.day}</Text>
      {cell.totalKrw > 0 ? (
        <Text numberOfLines={1} style={calendarCellAmountStyle}>
          {formatCompactKrw(cell.totalKrw)}
        </Text>
      ) : cell.hasGiftOnly ? (
        // 선물·환불만 있던 날. "0원"을 찍으면 아무것도 안 한 날처럼 보이는데 그날엔 기록이 있다
        // (UX-B 날짜 헤더가 소계를 감추는 것과 같은 판단).
        <Text style={calendarCellGiftStyle}>선물</Text>
      ) : null}
    </Pressable>
  );
});

/** 요일 헤더 + 주 격자 + 범례. 주 배열은 순수 모듈이 만들어 둔 것을 그대로 그린다. */
const RecordsCalendarGrid = memo(function RecordsCalendarGrid({
  month,
  onSelectDate
}: {
  month: CalendarMonth;
  onSelectDate: (date: string) => void;
}) {
  return (
    <Card>
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
              <CalendarDayCell key={cell.key} cell={cell} onSelectDate={onSelectDate} />
            ))}
          </View>
        ))}
        <Text style={calendarLegendStyle}>{CALENDAR_LEGEND_TEXT}</Text>
      </View>
    </Card>
  );
});

// scrollToLocation은 대상 섹션이 아직 마운트되지 않았을 때 실패할 수 있다. 목록으로의 전환은 이미
// 끝났으므로(사용자가 원한 것의 대부분) 여기서는 조용히 삼킨다 -- 크래시나 경고를 띄우지 않는다.
function handleRecordsScrollToIndexFailed() {
  // no-op (실패 안전): 사용자는 이미 그 달의 목록을 보고 있다.
}

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
          authorLabel: resolveExpenseAuthorLabel(expenseCreatedByUserId(expense), householdMemberRefs)
        })
      )
    ],
    [visibleOfflineRows, visibleExpenses, categoryName, householdMemberRefs]
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

  // 달력 칸 → 그날 기록. 목록으로 전환하고, 그 다음 렌더에서 해당 날짜 섹션으로 스크롤한다.
  // 안정된 참조여야 CalendarDayCell의 memo가 매 렌더 깨지지 않는다.
  const handleSelectCalendarDate = useCallback((date: string) => {
    setViewMode(RECORDS_VIEW_LIST);
    setPendingScrollDate(date);
    announceForA11y(`${formatSpentOn(date)} 기록`);
  }, []);

  useEffect(() => {
    if (!pendingScrollDate) return;
    const sectionIndex = sections.findIndex((section) => section.key === pendingScrollDate);
    // 한 번 시도하고 끝낸다 -- 재시도 루프를 돌면 사용자가 직접 스크롤한 위치를 빼앗는다.
    setPendingScrollDate(null);
    if (sectionIndex < 0) return;
    try {
      sectionListRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, viewPosition: 0, animated: true });
    } catch {
      // 실패 안전: 스크롤이 안 되더라도 사용자는 이미 그 달의 목록을 보고 있다(onScrollToIndexFailed도 참고).
    }
  }, [pendingScrollDate, sections]);

  // Rendered as an element (not an inline component) so the TextInput keeps focus across
  // re-renders -- FlatList remounts ListHeaderComponent when it's a new function each render.
  const listHeader = (
    <View style={{ gap: theme.spacing.section, marginBottom: theme.spacing.section }}>
      <ScreenHeader eyebrow="지출 기록" title="기록" subtitle="이번 달 지출 내역을 한눈에 확인해 보세요." />

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
        {/* PERF-102: lightweight month summary from already-fetched data (no extra API call). */}
        {expenses.data ? (
          <Text
            accessibilityLabel={`이번 달 ${monthlyRecordCount}건, 합계 ${formatKrw(monthlyTotalKrw)}`}
            style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, textAlign: "center" }}
          >
            {`이번 달 ${monthlyRecordCount}건 · 합계 ${formatKrw(monthlyTotalKrw)}`}
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
        <RecordsCalendarGrid month={calendarMonth} onSelectDate={handleSelectCalendarDate} />
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
