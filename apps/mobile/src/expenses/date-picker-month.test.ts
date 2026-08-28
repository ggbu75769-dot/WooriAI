import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getSeoulToday, isFutureSeoulDate } from "@wooriai/domain";
import {
  buildExpenseDatePickerMonth,
  canGoToNextExpenseDatePickerMonth,
  canGoToPreviousExpenseDatePickerMonth,
  expenseDatePickerCellAccessibilityLabel,
  expenseDatePickerInitialMonth,
  expenseDatePickerMonthLabel,
  isExpenseDatePickerCellSelectable,
  isExpenseDatePickerDateSelectable,
  shiftExpenseDatePickerMonth,
  EXPENSE_DATE_PICKER_FUTURE_HINT,
  EXPENSE_DATE_PICKER_HINT,
  EXPENSE_DATE_PICKER_MAX_PAST_MONTHS
} from "./date-picker-month";
import { buildCalendarMonth, type CalendarCell } from "./records-calendar";

/**
 * GAP-054 #7 — 지출 입력의 월 달력 픽커.
 *
 * 고정하는 사실: 달 경계(빈 칸·주 수·윤년), 미래 날짜·미래 달 잠금, 오늘 표시, 라벨.
 * 격자 자체는 기록 탭 달력과 **같은 buildCalendarMonth**여야 한다는 것도 여기서 검산한다
 * (픽커가 자기만의 달력 계산을 갖는 순간 두 화면이 다른 날짜를 그린다).
 */
const TODAY = "2026-08-27";

/** 그 달의 모든 날짜 칸(달 밖 빈 칸 제외). */
function dayCells(yearMonth: string, todayIso = TODAY): CalendarCell[] {
  const month = buildExpenseDatePickerMonth(yearMonth, todayIso);
  if (!month) throw new Error(`no month for ${yearMonth}`);
  return month.weeks.flat().filter((cell) => cell.date !== null);
}

describe("buildExpenseDatePickerMonth — 기록 탭 달력과 같은 격자를 쓴다", () => {
  it("격자가 buildCalendarMonth의 결과 그대로다(픽커가 달력을 새로 만들지 않는다)", () => {
    expect(buildExpenseDatePickerMonth("2026-08", TODAY)).toEqual(buildCalendarMonth("2026-08", [], TODAY));
  });

  it("달 전체 날짜를 빠짐없이 그리고, 앞뒤는 빈 칸으로 메운다(월요일 시작)", () => {
    const month = buildExpenseDatePickerMonth("2026-08", TODAY);
    expect(month).not.toBeNull();
    expect(dayCells("2026-08")).toHaveLength(31);
    // 2026-08-01은 토요일 -> 월요일 시작 격자에서 앞 빈 칸 5개.
    const firstWeek = month!.weeks[0];
    expect(firstWeek.filter((cell) => cell.date === null)).toHaveLength(5);
    expect(firstWeek[5].date).toBe("2026-08-01");
    // 모든 주가 7칸이고, 마지막 주 뒤도 빈 칸으로 채워진다.
    for (const week of month!.weeks) expect(week).toHaveLength(7);
  });

  it("윤년 2월도 정확하다(2024-02는 29일)", () => {
    expect(dayCells("2024-02", "2026-08-27")).toHaveLength(29);
    expect(dayCells("2025-02", "2026-08-27")).toHaveLength(28);
  });

  it("픽커는 금액을 그리지 않는다 — 다른 달을 칠할 근거가 이 화면에는 없다", () => {
    const month = buildExpenseDatePickerMonth("2026-06", TODAY)!;
    expect(month.totalKrw).toBe(0);
    expect(month.maxDailyKrw).toBe(0);
    for (const cell of month.weeks.flat()) {
      expect(cell.totalKrw).toBe(0);
      expect(cell.intensity).toBe(0);
    }
  });

  it("오늘 칸만 isToday다", () => {
    const today = dayCells("2026-08").filter((cell) => cell.isToday);
    expect(today).toHaveLength(1);
    expect(today[0].date).toBe(TODAY);
    // 다른 달에는 오늘이 없다.
    expect(dayCells("2026-07").some((cell) => cell.isToday)).toBe(false);
  });

  it("읽을 수 없는 달은 null — 그럴듯한 아무 달이나 그리지 않는다", () => {
    for (const bad of ["", "2026-13", "2026-8", "abc", "2026"]) {
      expect(buildExpenseDatePickerMonth(bad, TODAY)).toBeNull();
    }
  });
});

describe("미래 날짜는 고를 수 없다 (isFutureSeoulDate와 같은 규칙)", () => {
  it("오늘은 고를 수 있고 내일부터 막힌다", () => {
    expect(isExpenseDatePickerDateSelectable("2026-08-27", TODAY)).toBe(true);
    expect(isExpenseDatePickerDateSelectable("2026-08-26", TODAY)).toBe(true);
    expect(isExpenseDatePickerDateSelectable("2026-08-28", TODAY)).toBe(false);
    expect(isExpenseDatePickerDateSelectable("2026-09-01", TODAY)).toBe(false);
  });

  it("도메인 판정(isFutureSeoulDate)과 한 칸도 어긋나지 않는다", () => {
    // 화면의 손타이핑 가드가 쓰는 함수와 같은 답을 내야, 픽커에서 고른 날짜가 저장 직전
    // 가드에 걸려 막히는 일이 생기지 않는다.
    const reference = new Date(`${TODAY}T12:00:00+09:00`);
    for (const cell of dayCells("2026-08")) {
      expect(isExpenseDatePickerCellSelectable(cell, TODAY)).toBe(!isFutureSeoulDate(cell.date!, reference));
    }
  });

  it("이번 달 달력에서 오늘 이후 칸만 비활성이다", () => {
    const cells = dayCells("2026-08");
    const selectable = cells.filter((cell) => isExpenseDatePickerCellSelectable(cell, TODAY)).map((cell) => cell.date);
    expect(selectable).toHaveLength(27);
    expect(selectable[0]).toBe("2026-08-01");
    expect(selectable[selectable.length - 1]).toBe(TODAY);
  });

  it("지난 달은 전부 고를 수 있다", () => {
    expect(dayCells("2026-07").every((cell) => isExpenseDatePickerCellSelectable(cell, TODAY))).toBe(true);
  });

  it("달 밖 빈 칸은 누를 수 없다", () => {
    const blanks = buildExpenseDatePickerMonth("2026-08", TODAY)!.weeks.flat().filter((cell) => cell.date === null);
    expect(blanks.length).toBeGreaterThan(0);
    expect(blanks.every((cell) => isExpenseDatePickerCellSelectable(cell, TODAY))).toBe(false);
  });

  it("기준일을 모르면 아무 날짜도 고를 수 없다(미래를 눌러 저장이 막히는 화면을 만들지 않는다)", () => {
    expect(isExpenseDatePickerDateSelectable("2026-08-01", "오늘")).toBe(false);
    expect(isExpenseDatePickerDateSelectable("2026-08-32", TODAY)).toBe(false);
    expect(isExpenseDatePickerDateSelectable("", TODAY)).toBe(false);
  });
});

describe("월 이동 — 미래 월로는 가지 않는다", () => {
  it("이번 달에서는 다음 달 버튼이 잠긴다", () => {
    expect(canGoToNextExpenseDatePickerMonth("2026-08", TODAY)).toBe(false);
    expect(canGoToNextExpenseDatePickerMonth("2026-09", TODAY)).toBe(false);
    expect(canGoToNextExpenseDatePickerMonth("2026-07", TODAY)).toBe(true);
  });

  it("잠긴 방향으로는 달이 움직이지 않는다", () => {
    expect(shiftExpenseDatePickerMonth("2026-08", 1, TODAY)).toBe("2026-08");
    expect(shiftExpenseDatePickerMonth("2026-07", 1, TODAY)).toBe("2026-08");
  });

  it("해 경계를 정확히 넘는다", () => {
    expect(shiftExpenseDatePickerMonth("2026-01", -1, TODAY)).toBe("2025-12");
    expect(shiftExpenseDatePickerMonth("2025-12", 1, TODAY)).toBe("2026-01");
    expect(shiftExpenseDatePickerMonth("2026-08", -1, TODAY)).toBe("2026-07");
  });

  it("과거는 20년에서 멈춘다(오늘로 돌아오는 길을 잃지 않게)", () => {
    const oldest = shiftExpenseDatePickerMonth("2006-09", -1, TODAY);
    expect(oldest).toBe("2006-08");
    expect(canGoToPreviousExpenseDatePickerMonth("2006-08", TODAY)).toBe(false);
    expect(shiftExpenseDatePickerMonth("2006-08", -1, TODAY)).toBe("2006-08");
    expect(EXPENSE_DATE_PICKER_MAX_PAST_MONTHS).toBe(240);
  });

  it("읽을 수 없는 달에서는 이번 달로 되돌아온다", () => {
    expect(shiftExpenseDatePickerMonth("2026-13", -1, TODAY)).toBe("2026-08");
    expect(canGoToNextExpenseDatePickerMonth("2026-13", TODAY)).toBe(false);
    expect(canGoToPreviousExpenseDatePickerMonth("2026-13", TODAY)).toBe(false);
  });
});

describe("expenseDatePickerInitialMonth — 열었을 때 어느 달에 서는가", () => {
  it("지금 고른 날짜의 달에서 시작한다", () => {
    expect(expenseDatePickerInitialMonth("2026-03-14", TODAY)).toBe("2026-03");
    expect(expenseDatePickerInitialMonth(TODAY, TODAY)).toBe("2026-08");
  });

  it("없거나·깨졌거나·미래거나·너무 먼 과거면 이번 달이다", () => {
    expect(expenseDatePickerInitialMonth(null, TODAY)).toBe("2026-08");
    expect(expenseDatePickerInitialMonth("", TODAY)).toBe("2026-08");
    expect(expenseDatePickerInitialMonth("2026-8-1", TODAY)).toBe("2026-08");
    expect(expenseDatePickerInitialMonth("2027-01-01", TODAY)).toBe("2026-08");
    expect(expenseDatePickerInitialMonth("1999-01-01", TODAY)).toBe("2026-08");
  });

  it("기본 인자는 서울 오늘이다", () => {
    expect(expenseDatePickerInitialMonth(null)).toBe(getSeoulToday().slice(0, 7));
  });
});

describe("라벨 — 눈으로 보는 사실을 소리로도 전한다", () => {
  it("머리글은 해까지 적는다", () => {
    expect(expenseDatePickerMonthLabel("2026-08")).toBe("2026년 8월");
    expect(expenseDatePickerMonthLabel("2026-13")).toBe("");
  });

  it("칸 라벨이 날짜·오늘·선택됨·못 누르는 이유를 말한다", () => {
    const cells = dayCells("2026-08");
    const byDate = (date: string) => cells.find((cell) => cell.date === date)!;
    expect(expenseDatePickerCellAccessibilityLabel(byDate("2026-08-12"), { selectedIso: null, todayIso: TODAY })).toBe(
      "8월 12일"
    );
    expect(expenseDatePickerCellAccessibilityLabel(byDate(TODAY), { selectedIso: null, todayIso: TODAY })).toBe(
      "오늘, 8월 27일"
    );
    expect(
      expenseDatePickerCellAccessibilityLabel(byDate("2026-08-12"), { selectedIso: "2026-08-12", todayIso: TODAY })
    ).toBe("8월 12일, 선택됨");
    expect(expenseDatePickerCellAccessibilityLabel(byDate("2026-08-30"), { selectedIso: null, todayIso: TODAY })).toBe(
      `8월 30일, ${EXPENSE_DATE_PICKER_FUTURE_HINT}`
    );
  });

  it("달 밖 빈 칸은 라벨이 없다", () => {
    const blank = buildExpenseDatePickerMonth("2026-08", TODAY)!.weeks[0][0];
    expect(blank.date).toBeNull();
    expect(expenseDatePickerCellAccessibilityLabel(blank, { selectedIso: null, todayIso: TODAY })).toBeNull();
  });

  it("안내 문구는 해요체이고 사용자를 탓하지 않는다(DNC-018)", () => {
    for (const text of [EXPENSE_DATE_PICKER_HINT, EXPENSE_DATE_PICKER_FUTURE_HINT]) {
      expect(text.endsWith("요.") || text.endsWith("요")).toBe(true);
      for (const blaming of ["잘못", "오류", "실패", "안 됩니다"]) expect(text).not.toContain(blaming);
    }
  });
});

/**
 * 화면 배선(소스 계약) — RN 화면은 vitest에서 렌더할 수 없으므로 같은 폴더의 다른 배선
 * 테스트와 같은 관례로 소스를 읽어 고정한다.
 */
describe("GAP-054 #7 화면 배선", () => {
  const source = readFileSync(join(process.cwd(), "app/expenses/new.tsx"), "utf8");

  it("P2-C 달력 버튼(48dp)이 진짜 월 픽커를 연다", () => {
    expect(source).toContain('accessibilityLabel="지출 날짜 변경"');
    expect(source).toContain('name="calendar-blank-outline"');
    expect(source).toContain("setPickerYearMonth(expenseDatePickerInitialMonth(expenseDateIso, todayIso))");
    expect(source).toContain("<ExpenseDatePickerGrid");
  });

  it("격자·판정은 전부 순수 모듈에서 온다(화면이 달력을 다시 계산하지 않는다)", () => {
    expect(source).toContain("buildExpenseDatePickerMonth(pickerYearMonth, todayIso)");
    expect(source).toContain("isExpenseDatePickerCellSelectable(cell, todayIso)");
    expect(source).toContain("expenseDatePickerCellAccessibilityLabel(cell, { selectedIso, todayIso })");
    expect(source).toContain("CALENDAR_WEEKDAY_LABELS_KO.map");
    // 화면이 records-calendar에서 가져오는 것은 요일 머리글과 타입뿐이다 -- 격자 계산은
    // 순수 모듈을 거쳐서만 들어온다(화면이 달 길이·주 시작 요일을 직접 세지 않는다).
    expect(source).toContain(
      'import { CALENDAR_WEEKDAY_LABELS_KO, type CalendarCell, type CalendarMonth } from "../../src/expenses/records-calendar";'
    );
  });

  it("월 이동 버튼이 48dp이고 미래 월에서 잠긴다", () => {
    expect(source).toContain('accessibilityLabel="이전 달"');
    expect(source).toContain('accessibilityLabel="다음 달"');
    expect(source).toContain("disabled={!canGoToNextExpenseDatePickerMonth(pickerYearMonth, todayIso)}");
    expect(source).toContain("disabled={!canGoToPreviousExpenseDatePickerMonth(pickerYearMonth, todayIso)}");
    expect(source).toContain("shiftExpenseDatePickerMonth(value, -1, todayIso)");
    expect(source).toContain("shiftExpenseDatePickerMonth(value, 1, todayIso)");
    const navStyle = source.slice(source.indexOf("navButton: {"), source.indexOf("weekRow: {"));
    expect(navStyle).toContain("minHeight: 48");
    expect(navStyle).toContain("minWidth: 48");
  });

  it("날짜 칸이 44dp 이상이다", () => {
    const cellStyle = source.slice(source.indexOf("  cell: {"), source.indexOf("cellToday: {"));
    expect(cellStyle).toContain("minHeight: 44");
  });

  it("픽커는 고른 날짜를 기존 상태에 그대로 반영한다(초안·저장 payload가 같은 값을 본다)", () => {
    const handler = source.slice(source.indexOf("onSelectDate={(dateIso) => {"), source.indexOf("selectedIso={expenseDateIso}"));
    expect(handler).toContain("setExpenseDateIso(dateIso);");
    expect(handler).toContain("setCustomDateMode(false);");
    expect(handler).toContain('setCustomDateText("");');
    expect(source).toContain("spentOnIso: expenseDateIso,");
    expect(source).toContain("spentOn: expenseDate.iso");
  });

  it("기존 pill 3칸·14일 칩·직접 입력 경로가 그대로 남아 있다", () => {
    expect(source).toContain("const quickDateChips = recentDateChips.slice(0, 3).reverse();");
    expect(source).toContain("recentDateChips.map");
    expect(source).toContain('accessibilityLabel="날짜 직접 입력"');
    expect(source).toContain('if (isFutureSeoulDate(dateOnly)) return "미래 날짜는 선택할 수 없어요.";');
  });

  it("EXP-001 비세션 캡처 경로 밖이다(세션 게이트 뒤에서만 그린다)", () => {
    expect(source).toContain("const pickerMonth = authToken && showDatePicker ? buildExpenseDatePickerMonth(");
    expect(source).toContain("{authToken && showDatePicker ? (");
  });
});
