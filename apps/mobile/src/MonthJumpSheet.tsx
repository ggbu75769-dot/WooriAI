import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "./design-system";
import {
  buildMonthJumpYear,
  monthJumpInitialYear,
  MONTH_JUMP_CLOSE_LABEL,
  MONTH_JUMP_HINT,
  MONTH_JUMP_SHEET_TITLE,
  type MonthJumpBounds,
  type MonthJumpCell
} from "./month-jump";
import { theme } from "./theme";
import { BottomSheetFrame, TextButton } from "./ui";

/**
 * GAP-066 트랙 A(#2) — 기록/리포트 탭의 **월 선택 시트**.
 *
 * 판정은 하나도 여기 없다: 어느 달을 고를 수 있는지·연도 스테퍼의 잠금·칸 라벨은 전부 순수 모듈
 * (./month-jump.ts)이 정하고, 이 파일에는 **모양만** 남는다(월 달력 픽커 ExpenseDatePicker와 같은
 * 규율). 시트 껍데기는 아이 전환 시트와 **같은** `BottomSheetFrame`이라, 같은 앱의 두 시트가 서로
 * 다른 문법으로 열리지 않는다.
 *
 * 보고 있는 연도는 이 컴포넌트가 스스로 들고 있고 화면의 달과 **따로** 움직인다 — 연도만 넘겨
 * 보다가 아무 달도 안 고르고 닫는 일이 흔한데, 그때 화면의 달이 따라 움직이면 사용자가 고른 적
 * 없는 달이 열린다. 두 탭 모두 **열려 있을 때만** 이 컴포넌트를 그리므로, 열 때마다 "지금 보고
 * 있는 달의 연도"에서 다시 시작한다.
 *
 * 못 고르는 칸을 `Pressable disabled`가 아니라 `View`로 그리는 이유도 픽커와 같다 — disabled
 * 버튼은 스크린리더에 "버튼, 비활성"으로만 읽혀 "왜 못 누르지"를 남긴다. 라벨이 그 이유를 직접
 * 말한다(순수 모듈의 `accessibilityLabel`).
 */

/** 비활성 표기의 투명도. 기록 탭 달 내비·내보내기 달 스테퍼·월 달력 픽커와 **같은 값**이다. */
const MONTH_JUMP_DISABLED_OPACITY = 0.35;

const monthJumpSheetStyle = StyleSheet.create({
  yearRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  yearLabel: {
    color: theme.colors.brown,
    fontSize: 16,
    fontWeight: "800"
  },
  navButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: theme.touchTarget,
    minWidth: theme.touchTarget
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  cell: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: theme.radii.small,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: theme.touchTarget,
    // 3열 격자: gap 6 두 칸을 뺀 나머지를 셋이 나눈다.
    width: "31%"
  },
  cellCurrent: {
    borderColor: theme.colors.mainCoral
  },
  cellSelected: {
    backgroundColor: theme.colors.coral[50],
    borderColor: theme.colors.mainCoral
  },
  cellLabel: {
    color: theme.colors.brown,
    fontSize: 14,
    fontWeight: "700"
  },
  cellLabelDisabled: {
    // 색이 아니라 투명도로 비활성을 말한다(gray300은 크림/흰 배경에서 AA 미달이라 이 앱이
    // 이미 버린 방식이다 — 월 달력 픽커 P2-1의 근거 그대로).
    color: theme.colors.gray900,
    opacity: MONTH_JUMP_DISABLED_OPACITY
  },
  cellLabelSelected: {
    color: theme.colors.coral[700],
    fontWeight: "800"
  },
  hint: {
    color: theme.colors.gray600,
    fontSize: 11,
    lineHeight: 16
  }
});

export type MonthJumpSheetProps = {
  testID: string;
  /** 지금 화면이 보고 있는 달 `YYYY-MM`. */
  selectedYearMonth: string;
  bounds: MonthJumpBounds;
  /**
   * 라운드 67 트랙 C(#5) 가산 — 시트 아래 한 줄 안내. 없으면 기록·리포트 두 탭의 기존 문장
   * (`MONTH_JUMP_HINT`)이라 그 두 호출부는 종전과 한 글자도 다르지 않다. 내보내기 화면은 이
   * 시트로 **이동하지 않고 시작/끝 달을 정하므로**("그 달로 이동해요"가 사실이 아니다) 자기
   * 문장을 넘긴다 — 문장은 그 화면의 순수 모듈(src/export/export-range.ts)에 있고 여기서 짓지 않는다.
   */
  hint?: string;
  /** 칸을 눌렀을 때. 호출부가 `resolveMonthJumpOffset`으로 환산해 화면 상태를 옮긴다. */
  onSelect: (yearMonth: string) => void;
  onClose: () => void;
};

export function MonthJumpSheet({
  testID,
  selectedYearMonth,
  bounds,
  hint = MONTH_JUMP_HINT,
  onSelect,
  onClose
}: MonthJumpSheetProps) {
  const [year, setYear] = useState(() => monthJumpInitialYear(selectedYearMonth, bounds.todayIso));
  const view = buildMonthJumpYear({ year, selectedYearMonth, bounds });

  const renderCell = (cell: MonthJumpCell) => {
    const labelStyle = [
      monthJumpSheetStyle.cellLabel,
      cell.isSelectable ? null : monthJumpSheetStyle.cellLabelDisabled,
      cell.isSelected ? monthJumpSheetStyle.cellLabelSelected : null
    ];
    const cellStyle = [
      monthJumpSheetStyle.cell,
      cell.isCurrentMonth ? monthJumpSheetStyle.cellCurrent : null,
      cell.isSelected ? monthJumpSheetStyle.cellSelected : null
    ];
    if (!cell.isSelectable) {
      // 라운드 95 트랙 A: 순수 모듈이 라벨에서 "선택됨"을 걷었으므로(같은 사실을 두 번 읽지
      // 않는다), **선택됐는데 못 고르는 칸**이 그 사실을 잃지 않도록 이 가지도 상태를 진다.
      // ⚠️ `disabled`는 걸지 않는다 — 못 고르는 이유는 라벨이 문장으로 말하고 있고, 상태로 한 번
      // 더 말하면 이 트랙이 걷어 낸 바로 그 이중 낭독이 다시 선다(이 파일에서 눌림을 막는 프롭은
      // 여전히 연도 스테퍼 둘뿐이다).
      return (
        <View
          accessible
          accessibilityLabel={cell.accessibilityLabel}
          accessibilityState={{ selected: cell.isSelected }}
          key={cell.yearMonth}
          style={cellStyle}
        >
          <Text style={labelStyle}>{cell.label}</Text>
        </View>
      );
    }
    return (
      <Pressable
        accessibilityLabel={cell.accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ selected: cell.isSelected }}
        key={cell.yearMonth}
        onPress={() => onSelect(cell.yearMonth)}
        style={({ pressed }) => [...cellStyle, { opacity: pressed ? 0.76 : 1 }]}
      >
        <Text style={labelStyle}>{cell.label}</Text>
      </Pressable>
    );
  };

  return (
    <View testID={testID}>
      <BottomSheetFrame title={MONTH_JUMP_SHEET_TITLE} showHandle={false}>
        <View style={monthJumpSheetStyle.yearRow}>
          <Pressable
            accessibilityLabel="이전 연도"
            accessibilityRole="button"
            accessibilityState={{ disabled: !view.canGoPreviousYear }}
            disabled={!view.canGoPreviousYear}
            onPress={() => setYear((value) => value - 1)}
            style={({ pressed }) => [
              monthJumpSheetStyle.navButton,
              { opacity: view.canGoPreviousYear ? (pressed ? 0.76 : 1) : MONTH_JUMP_DISABLED_OPACITY }
            ]}
          >
            <AppIcon color={theme.colors.gray900} name="chevron-left" size={26} />
          </Pressable>
          <Text accessibilityRole="header" style={monthJumpSheetStyle.yearLabel}>
            {view.yearLabel}
          </Text>
          <Pressable
            accessibilityLabel="다음 연도"
            accessibilityRole="button"
            accessibilityState={{ disabled: !view.canGoNextYear }}
            disabled={!view.canGoNextYear}
            onPress={() => setYear((value) => value + 1)}
            style={({ pressed }) => [
              monthJumpSheetStyle.navButton,
              { opacity: view.canGoNextYear ? (pressed ? 0.76 : 1) : MONTH_JUMP_DISABLED_OPACITY }
            ]}
          >
            <AppIcon color={theme.colors.gray900} name="chevron-right" size={26} />
          </Pressable>
        </View>
        <View style={monthJumpSheetStyle.grid}>{view.cells.map((cell) => renderCell(cell))}</View>
        <Text style={monthJumpSheetStyle.hint}>{hint}</Text>
        <TextButton label={MONTH_JUMP_CLOSE_LABEL} onPress={onClose} />
      </BottomSheetFrame>
    </View>
  );
}
