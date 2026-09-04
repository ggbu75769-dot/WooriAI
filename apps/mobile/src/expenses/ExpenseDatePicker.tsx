import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ENTRY_DATE_MAX_PAST_YEARS } from "@wooriai/domain";
import {
  buildExpenseDatePickerMonth,
  canGoToNextExpenseDatePickerMonth,
  canGoToPreviousExpenseDatePickerMonth,
  expenseDatePickerCellAccessibilityLabel,
  expenseDatePickerHint,
  expenseDatePickerInitialMonth,
  expenseDatePickerMonthLabel,
  isExpenseDatePickerCellSelectable,
  shiftExpenseDatePickerMonth,
  EXPENSE_DATE_PICKER_MAX_FUTURE_DAYS,
  EXPENSE_DATE_PICKER_MAX_FUTURE_WEEKS,
  EXPENSE_DATE_PICKER_MAX_PAST_MONTHS,
  type ExpenseDatePickerDirection
} from "./date-picker-month";
import { CALENDAR_WEEKDAY_LABELS_KO, type CalendarCell, type CalendarMonth } from "./records-calendar";
import { shiftIsoDate } from "./records-date-groups";
import { AppIcon } from "../design-system";
import { MONTH_JUMP_TRIGGER_HINT, monthJumpTriggerAccessibilityLabel, type MonthJumpBounds } from "../month-jump";
import { MonthJumpSheet } from "../MonthJumpSheet";
import { theme } from "../theme";

/**
 * GAP-054 #7(트랙 C) → 라운드 54 P2-5 — 지출 날짜를 고르는 **월 달력 픽커**.
 *
 * 원래는 빠른 기록 시트(app/expenses/new.tsx) 안에만 있던 컴포넌트다. 라운드 54 P2-5에서
 * 지출 상세(app/expenses/[expenseId].tsx)에도 같은 픽커가 필요해지면서 이 모듈로 옮겼다 —
 * 화면마다 달력을 따로 그리면 같은 앱의 두 달력이 서로 다른 문법(터치 타깃·미래 잠금·라벨)을
 * 갖게 되고, 실제로 상세 화면에는 14일 칩과 손타이핑밖에 없어서 그보다 오래된 영수증을 고쳐
 * 적으려면 ISO를 직접 쳐야 했다(입력 시트가 P2-C에서 고친 바로 그 구멍이다).
 *
 * 판정은 하나도 여기 없다: 격자·미래 잠금·달 이동 한계·라벨은 전부 순수 모듈
 * (./date-picker-month.ts)이 정하고, 이 파일에는 **모양만** 남는다.
 *
 * 보고 있는 달은 이 컴포넌트가 스스로 들고 있고, 고른 날짜와 **따로** 움직인다 — 달만 넘겨
 * 보다가 아무 날짜도 안 고르고 닫는 일이 흔한데 그때 폼의 날짜가 따라 움직이면 사용자가 고른
 * 적 없는 날짜가 저장된다. 두 화면 모두 **열려 있을 때만** 이 컴포넌트를 그리므로, 열 때마다
 * "지금 고른 날짜의 달"에서 다시 시작한다(지난번에 넘겨 본 달에 서 있으면 방금 칩으로 고른
 * 날짜가 화면 밖에 있는 달력이 열린다).
 *
 * 두 화면 모두 **세션 게이트 뒤**에서만 그린다 — EXP-001/EXP-003 비세션 캡처 경로는 한 픽셀도
 * 바뀌지 않는다.
 *
 * ## 라운드 65 D — 아이 날짜 입력(ONB-002 · SET-005)도 이 컴포넌트를 쓴다
 *
 * 이름은 `Expense…`로 남는다: 두 지출 화면이 이 이름으로 이 컴포넌트를 부르고 있고, 이름을
 * 바꾸면 그 두 화면을 고쳐야 한다(이번 트랙의 금지 사항 — 가산 인자의 기본값이 종전 동작과
 * 같다는 것으로 증명해야 하는 변경이다). 달력을 하나 더 짓지 않는 것이 이 파일의 존재 이유이므로,
 * 생년월일·예정일도 **같은 문법**(48dp 달 이동 · 44dp 칸 · 못 고르는 이유를 말하는 라벨)을 쓴다.
 *
 * 새로 생긴 것은 `direction` 한 칸뿐이고 기본값은 종전 그대로다(`"past"`). 출산 예정일만
 * `"future"`로 열리며, 그 상한은 도메인의 임신 주차 규칙에서 온다(순수 모듈 주석 참고).
 */

/**
 * GAP-054 #7 — 월 달력 픽커의 수치. 격자·판정은 순수 모듈(src/expenses/date-picker-month.ts)에
 * 있고 여기에는 **모양만** 남는다.
 *
 * 칸은 44dp 이상(가로는 7열 flex, 세로는 minHeight 44)이고 달 이동 버튼은 48dp다 — 이 화면의
 * 다른 터치 타깃(닫기 48, 달력 버튼 48)과 같은 규칙이다.
 *
 * ## 라운드 54 P2-1 — 비활성 표기를 gray300에서 걷어낸 이유
 *
 * 미래 칸의 숫자를 `gray300`으로 그렸고, 주석은 그것을 "정보 텍스트가 아니다"라고 단언했다.
 * 그 단언이 사실이 아니다: 그 숫자는 **그 칸이 며칠인지 말하는 유일한 글자**다(달력의 격자를
 * 읽는 근거이고, 스크린리더 라벨도 같은 날짜를 읽는다). 눌리지 않는다는 것과 읽히지 않아도
 * 된다는 것은 다른 말인데, 흰 배경 위 gray300은 약 1.24:1이라 사실상 보이지 않았다.
 *
 * 그래서 이 앱이 이미 쓰는 비활성 표기 문법으로 통일한다 — **gray900 + opacity 0.35**
 * (기록 탭 달 내비의 `opacity: canGoNextMonth ? 1 : 0.35`, 내보내기 달 스테퍼의 같은 줄).
 * 색을 흐린 회색으로 바꾸는 대신 진한 색을 투명도로 낮추면, "누를 수 없음"은 그대로 읽히면서
 * 숫자 자체는 남는다. 달 이동 chevron도 같은 방식이다(그 화살표들이 gray300을 버린 자리와
 * 같은 근거 — src/export/ExpenseCsvExport.tsx의 ExportMonthStepper 주석).
 */
/**
 * P2-1: 비활성 표기의 투명도. 기록 탭 달 내비(`opacity: canGoNextMonth ? 1 : 0.35`)·내보내기
 * 달 스테퍼와 **같은 값**이라, 같은 뜻이 화면마다 다르게 보이지 않는다.
 */
const PICKER_DISABLED_OPACITY = 0.35;

/**
 * T9(토스급 정비) — **달 라벨이 월 점프 시트의 입구가 된다.**
 *
 * 이 픽커의 달 이동은 ‹ › 한 칸씩뿐이라, 예정일(최대 만삭 ≈ 아홉 달 뒤)이나 몇 달 지난
 * 영수증에 닿으려면 같은 버튼을 아홉 번 눌러야 했다. 기록·리포트 탭과 내보내기 카드가 이미
 * 같은 문제를 월 선택 시트(src/MonthJumpSheet.tsx)로 풀었으므로 **그 시트를 그대로 소비한다**
 * (네 번째 소비처 — 시트·순수 모듈은 한 글자도 손대지 않는다). 트리거 문법(라벨을 Pressable로
 * 감싸고, 라벨은 순수 모듈의 monthJumpTriggerAccessibilityLabel, 힌트는 MONTH_JUMP_TRIGGER_HINT,
 * 열림은 expanded 상태)도 그 세 자리와 같다.
 *
 * ## 시트에 넘기는 경계 — 픽커 자신의 규칙을 그대로 옮겨 적는다
 *  - **과거 방향**(지출 날짜·출생일): 상한은 이번 달, 하한은 20년 — 시트의 기본 규칙
 *    (`MonthJumpBounds.todayIso`만 넘긴 상태)과 **같은 값**이다(둘 다 MAX_PAST_MONTH_OFFSET이
 *    단일 소스다). 하한 문장만 덮어쓴다 — 시트의 기본 문장("아이 기록이 시작되기 전…")은
 *    기록 탭의 사실이지 이 달력의 사실이 아니다.
 *  - **미래 방향**(출산 예정일): 시트는 "미래 달 금지"가 절대 규칙이라(`monthJumpCeilingYearMonth`가
 *    이번 달로 접는다) 인자로는 만삭까지 열 수 없다. 그래서 기준일을 **만삭 날짜**로 옮겨 넘긴다 —
 *    ‹ › 이동의 상한(`latestSelectableIso`)과 같은 산술(shiftIsoDate + MAX_FUTURE_DAYS)이라 시트가
 *    여는 범위와 달력이 실제로 서는 범위가 갈릴 수 없다. 하한은 실제 오늘 기준 20년을 명시해
 *    기준일 이동으로 바닥이 따라 밀리지 않게 한다.
 *
 * ⚠️ 기준일을 옮긴 대가 하나를 기록한다: 미래 방향 시트에서 "이번 달" 표기(테두리·낭독)가
 * 실제 이번 달이 아니라 **만삭이 든 달**(고를 수 있는 마지막 달)에 선다. 시트의 그 표기는
 * 기준일에서 파생되고 인자로 끌 수 없다(읽기 전용 소비 — 시트를 고치는 것은 이 트랙의 소유가
 * 아니다). 아래 안내 한 줄이 그 달력의 실제 경계(만삭)를 문장으로 말한다.
 */
const DUE_DATE_MONTH_JUMP_HINT = `달을 눌러 이동해요. 만삭(${EXPENSE_DATE_PICKER_MAX_FUTURE_WEEKS}주)보다 먼 달은 고를 수 없어요.`;

/** 하한(20년) 이전 달 칸의 이유 한 줄. 연 수는 도메인 단일 소스에서 읽는다(숫자를 짓지 않는다). */
const BEFORE_FLOOR_MONTH_HINT = `${ENTRY_DATE_MAX_PAST_YEARS}년보다 오래된 달이라 고를 수 없어요`;

/** 시트에 넘길 경계. 판정 규칙은 위 헤더 주석 — 값은 전부 기존 단일 소스에서 파생한다. */
function expenseDatePickerMonthJumpBounds(todayIso: string, direction: ExpenseDatePickerDirection): MonthJumpBounds {
  // ‹ 이동이 실제로 멈추는 그 달(오늘 기준 20년) — 시트에서만 더 열리거나 더 잠기지 않게 한다.
  const floorYearMonth = shiftExpenseDatePickerMonth(
    todayIso.slice(0, 7),
    -EXPENSE_DATE_PICKER_MAX_PAST_MONTHS,
    todayIso
  );
  if (direction !== "future") {
    return { todayIso, earliestYearMonth: floorYearMonth, beforeEarliestHint: BEFORE_FLOOR_MONTH_HINT };
  }
  return {
    todayIso: shiftIsoDate(todayIso, EXPENSE_DATE_PICKER_MAX_FUTURE_DAYS) ?? todayIso,
    earliestYearMonth: floorYearMonth,
    beforeEarliestHint: BEFORE_FLOOR_MONTH_HINT
  };
}

const expenseDatePickerStyle = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.10)",
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 10
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  monthLabel: {
    color: theme.colors.brown,
    fontSize: 15,
    fontWeight: "800"
  },
  // T9: 달 라벨 트리거. 글자 한 줄(≈20dp)만으로는 최소 터치 타깃에 못 미치므로 기록 탭의
  // 같은 트리거처럼 48dp를 채운다 — 이 줄은 이미 48dp 화살표 둘이 높이를 잡고 있어
  // 늘어나는 것은 히트 영역뿐이다.
  monthTrigger: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  navButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    minWidth: 48
  },
  weekRow: {
    flexDirection: "row",
    gap: 2
  },
  weekdayLabel: {
    color: theme.colors.gray600,
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center"
  },
  cell: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: theme.radii.small,
    borderWidth: 2,
    flex: 1,
    justifyContent: "center",
    minHeight: 44
  },
  cellToday: {
    borderColor: theme.colors.mainCoral
  },
  cellSelected: {
    backgroundColor: theme.colors.coral[50],
    borderColor: theme.colors.mainCoral
  },
  cellDay: {
    color: theme.colors.brown,
    fontSize: 13,
    fontWeight: "700"
  },
  cellDayDisabled: {
    // P2-1: 색이 아니라 **투명도**로 비활성을 말한다(위 헤더 주석). 기록 탭·내보내기의
    // 달 이동 버튼과 같은 수치라, 같은 뜻이 화면마다 다른 회색으로 갈리지 않는다.
    color: theme.colors.gray900,
    opacity: PICKER_DISABLED_OPACITY
  },
  cellDaySelected: {
    color: theme.colors.coral[700],
    fontWeight: "800"
  },
  hint: {
    color: theme.colors.gray600,
    fontSize: 11
  }
});

/**
 * GAP-054 #7 — 월 달력 픽커의 격자.
 *
 * 주 배열은 기록 탭 달력과 **같은** `buildCalendarMonth`가 만든 것을 그대로 그리고(월요일 시작·
 * 달 앞뒤 빈 칸), 누를 수 있는지·라벨을 뭐라고 읽을지는 전부 순수 모듈이 답한다. 미래 날짜는
 * `Pressable` 대신 `View`로 그린다 — disabled 버튼도 스크린리더에는 "버튼, 비활성"으로 읽혀
 * "왜 못 누르지"라는 질문을 남기므로, 라벨이 그 이유를 직접 말하게 한다(기록 탭 달력 관례).
 */
function ExpenseDatePickerGrid({
  direction,
  month,
  onSelectDate,
  selectedIso,
  todayIso
}: {
  direction: ExpenseDatePickerDirection;
  month: CalendarMonth;
  onSelectDate: (dateIso: string) => void;
  selectedIso: string;
  todayIso: string;
}) {
  const renderCell = (cell: CalendarCell) => {
    if (cell.date === null) return <View key={cell.key} style={expenseDatePickerStyle.cell} />;
    const selectable = isExpenseDatePickerCellSelectable(cell, todayIso, direction);
    const selected = cell.date === selectedIso;
    // 라운드 95 리뷰 M-6: 라벨 함수는 selectedIso를 읽지 않는다(선택 여부는 아래 상태 프롭이
    // 진다) — 읽히지 않는 값을 만들어 넘기던 유령 인자를 걷었다.
    const accessibilityLabel =
      expenseDatePickerCellAccessibilityLabel(cell, { todayIso, direction }) ?? undefined;
    const dayText = (
      <Text
        style={[
          expenseDatePickerStyle.cellDay,
          selectable ? null : expenseDatePickerStyle.cellDayDisabled,
          selected ? expenseDatePickerStyle.cellDaySelected : null
        ]}
      >
        {cell.day}
      </Text>
    );
    const cellStyle = [
      expenseDatePickerStyle.cell,
      cell.isToday ? expenseDatePickerStyle.cellToday : null,
      selected ? expenseDatePickerStyle.cellSelected : null
    ];
    if (!selectable) {
      // 라운드 95 트랙 A: 순수 모듈이 라벨에서 "선택됨"을 걷었으므로(같은 사실을 두 번 읽지
      // 않는다), **선택됐는데 못 고르는 칸**이 그 사실을 잃지 않도록 이 가지도 상태를 진다.
      // ⚠️ `disabled`는 걸지 않는다 — 못 누르는 이유는 라벨이 문장으로 말하고 있고(위 머리말의
      // 그 판단), 상태로 한 번 더 말하면 이 트랙이 걷어 낸 바로 그 이중 낭독이 다시 선다.
      return (
        <View
          accessible
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ selected }}
          key={cell.key}
          style={cellStyle}
        >
          {dayText}
        </View>
      );
    }
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        key={cell.key}
        onPress={() => onSelectDate(cell.date as string)}
        style={({ pressed }) => [...cellStyle, { opacity: pressed ? 0.76 : 1 }]}
      >
        {dayText}
      </Pressable>
    );
  };
  return (
    <View style={expenseDatePickerStyle.card}>
      {/* 요일 머리글은 스크린리더에는 소음이다 -- 칸 라벨이 이미 "8월 12일"이라는 완전한
          날짜를 읽어 준다(기록 탭 달력과 같은 판단). */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={expenseDatePickerStyle.weekRow}
      >
        {CALENDAR_WEEKDAY_LABELS_KO.map((label) => (
          <Text key={label} style={expenseDatePickerStyle.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>
      {month.weeks.map((week, weekIndex) => (
        <View key={`${month.yearMonth}-week-${weekIndex}`} style={expenseDatePickerStyle.weekRow}>
          {week.map((cell) => renderCell(cell))}
        </View>
      ))}
      <Text style={expenseDatePickerStyle.hint}>{expenseDatePickerHint(direction)}</Text>
    </View>
  );
}

export type ExpenseDatePickerProps = {
  /** 지금 폼이 들고 있는 지출 날짜(ISO). 아직 없으면 null/빈 문자열. */
  selectedIso: string | null;
  /** 오늘(서울 기준) `YYYY-MM-DD`. 화면이 이미 계산해 둔 값을 그대로 넘긴다. */
  todayIso: string;
  /** 칸을 눌렀을 때. 두 화면 모두 14일 칩 탭과 **같은 상태 갱신**을 한다. */
  onSelectDate: (dateIso: string) => void;
  /**
   * 라운드 65 D — 고를 수 있는 쪽. 생략하면 종전 그대로 `"past"`(지출 날짜·출생일)이고,
   * 출산 예정일만 `"future"`다. 지출 두 화면은 이 값을 넘기지 않는다.
   */
  direction?: ExpenseDatePickerDirection;
};

/**
 * 달 머리글(‹ 2026년 8월 ›) + 격자 + 안내 한 줄.
 *
 * 보고 있는 달을 읽을 수 없으면 null이라, 화면은 그때 격자를 접고 14일 칩·직접 입력만 남긴다
 * (순수 모듈 `buildExpenseDatePickerMonth`의 계약).
 */
export function ExpenseDatePicker({
  selectedIso,
  todayIso,
  onSelectDate,
  direction = "past"
}: ExpenseDatePickerProps) {
  const [pickerYearMonth, setPickerYearMonth] = useState(() =>
    expenseDatePickerInitialMonth(selectedIso, todayIso, direction)
  );
  // T9: 월 점프 시트의 열림. 훅은 조기 반환 위에 선다(FIX-A 규율).
  const [monthJumpOpen, setMonthJumpOpen] = useState(false);
  const pickerMonth = buildExpenseDatePickerMonth(pickerYearMonth, todayIso);
  if (!pickerMonth) return null;
  const monthLabel = expenseDatePickerMonthLabel(pickerYearMonth);
  return (
    <View style={{ gap: 6 }}>
      <View style={expenseDatePickerStyle.header}>
        <Pressable
          accessibilityLabel="이전 달"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGoToPreviousExpenseDatePickerMonth(pickerYearMonth, todayIso) }}
          disabled={!canGoToPreviousExpenseDatePickerMonth(pickerYearMonth, todayIso)}
          onPress={() => setPickerYearMonth((value) => shiftExpenseDatePickerMonth(value, -1, todayIso, direction))}
          style={({ pressed }) => [
            expenseDatePickerStyle.navButton,
            // P2-1: "더 갈 수 없음"은 색이 아니라 opacity로 말한다 — 기록 탭 달 내비·
            // 내보내기 달 스테퍼와 같은 수치(gray300 화살표는 AA 미달이라 그 화면들이
            // 이미 버린 방식이다).
            { opacity: canGoToPreviousExpenseDatePickerMonth(pickerYearMonth, todayIso) ? (pressed ? 0.76 : 1) : PICKER_DISABLED_OPACITY }
          ]}
        >
          <AppIcon color={theme.colors.gray900} name="chevron-left" size={26} />
        </Pressable>
        {/* T9: 달 라벨이 곧 월 선택 시트의 입구다 — 기록·리포트 탭(GAP-066)·내보내기 카드
            (라운드 67 C#5)와 같은 트리거 문법. 종전의 header 역할 대신 button 역할이 선다
            (같은 전환을 기록 탭 달 라벨이 이미 했다). 라벨·힌트는 순수 모듈이 짓는다. */}
        <Pressable
          accessibilityHint={MONTH_JUMP_TRIGGER_HINT}
          accessibilityLabel={monthJumpTriggerAccessibilityLabel(monthLabel)}
          accessibilityRole="button"
          accessibilityState={{ expanded: monthJumpOpen }}
          hitSlop={8}
          onPress={() => setMonthJumpOpen((open) => !open)}
          testID="expense-date-picker-month-jump-trigger"
          style={({ pressed }) => [expenseDatePickerStyle.monthTrigger, { opacity: pressed ? 0.76 : 1 }]}
        >
          <Text style={expenseDatePickerStyle.monthLabel}>{monthLabel}</Text>
        </Pressable>
        {/* 다음 달 버튼은 이번 달에서 잠긴다 -- 미래 달을 열어 봐야 칸이 전부
            비활성이라 아무것도 고를 수 없는 달력이 된다(기록 탭 월 이동과 같은 상한). */}
        <Pressable
          accessibilityLabel="다음 달"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGoToNextExpenseDatePickerMonth(pickerYearMonth, todayIso, direction) }}
          disabled={!canGoToNextExpenseDatePickerMonth(pickerYearMonth, todayIso, direction)}
          onPress={() => setPickerYearMonth((value) => shiftExpenseDatePickerMonth(value, 1, todayIso, direction))}
          style={({ pressed }) => [
            expenseDatePickerStyle.navButton,
            // P2-1: "더 갈 수 없음"은 색이 아니라 opacity로 말한다 — 기록 탭 달 내비·
            // 내보내기 달 스테퍼와 같은 수치(gray300 화살표는 AA 미달이라 그 화면들이
            // 이미 버린 방식이다).
            { opacity: canGoToNextExpenseDatePickerMonth(pickerYearMonth, todayIso, direction) ? (pressed ? 0.76 : 1) : PICKER_DISABLED_OPACITY }
          ]}
        >
          <AppIcon color={theme.colors.gray900} name="chevron-right" size={26} />
        </Pressable>
      </View>
      {/* T9: 시트가 열려 있는 동안은 격자 대신 시트가 선다 — 달을 고르면 그 달의 격자로
          돌아온다(고른 날짜(폼 상태)는 그대로다: 이 시트가 옮기는 것은 **보고 있는 달**뿐이고,
          그 관계는 이 픽커가 원래 갖던 것이다 — 헤더 주석 "고른 날짜와 따로 움직인다").
          닫혀 있으면 렌더는 종전과 한 줄도 다르지 않다. */}
      {monthJumpOpen ? (
        <MonthJumpSheet
          testID="expense-date-picker-month-jump-sheet"
          selectedYearMonth={pickerYearMonth}
          bounds={expenseDatePickerMonthJumpBounds(todayIso, direction)}
          hint={direction === "future" ? DUE_DATE_MONTH_JUMP_HINT : undefined}
          onSelect={(yearMonth) => {
            setPickerYearMonth(yearMonth);
            setMonthJumpOpen(false);
          }}
          onClose={() => setMonthJumpOpen(false)}
        />
      ) : (
        <ExpenseDatePickerGrid
          direction={direction}
          month={pickerMonth}
          onSelectDate={onSelectDate}
          selectedIso={selectedIso ?? ""}
          todayIso={todayIso}
        />
      )}
    </View>
  );
}
