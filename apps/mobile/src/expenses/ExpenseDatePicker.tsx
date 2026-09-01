import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  type ExpenseDatePickerDirection
} from "./date-picker-month";
import { CALENDAR_WEEKDAY_LABELS_KO, type CalendarCell, type CalendarMonth } from "./records-calendar";
import { AppIcon } from "../design-system";
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
    const accessibilityLabel =
      expenseDatePickerCellAccessibilityLabel(cell, { selectedIso, todayIso, direction }) ?? undefined;
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
  const pickerMonth = buildExpenseDatePickerMonth(pickerYearMonth, todayIso);
  if (!pickerMonth) return null;
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
        <Text accessibilityRole="header" style={expenseDatePickerStyle.monthLabel}>
          {expenseDatePickerMonthLabel(pickerYearMonth)}
        </Text>
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
      <ExpenseDatePickerGrid
        direction={direction}
        month={pickerMonth}
        onSelectDate={onSelectDate}
        selectedIso={selectedIso ?? ""}
        todayIso={todayIso}
      />
    </View>
  );
}
