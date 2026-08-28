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
import { MAX_PAST_MONTH_OFFSET } from "./import-landing-month";
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

  /**
   * GAP-054 라운드 54 P2-8 — 20년 상한이 **한 곳에서만** 정해진다.
   *
   * 예전에는 "기록 탭 딥링크의 MAX_PAST_MONTH_OFFSET과 같은 값"이라고 주석으로 적어 두고
   * 240을 여기 다시 적었다. 주석은 드리프트를 막지 못한다 — 한쪽만 바뀌면 픽커에서는 고를 수
   * 있는데 기록 탭은 그 달로 가 주지 않는(또는 그 반대) 상태가 조용히 생긴다.
   */
  it("과거 상한은 기록 탭 딥링크와 같은 상수를 import한다", () => {
    expect(EXPENSE_DATE_PICKER_MAX_PAST_MONTHS).toBe(MAX_PAST_MONTH_OFFSET);
    expect(EXPENSE_DATE_PICKER_MAX_PAST_MONTHS).toBe(240);
    const moduleSource = readFileSync(join(process.cwd(), "src/expenses/date-picker-month.ts"), "utf8");
    expect(moduleSource).toContain('import { MAX_PAST_MONTH_OFFSET } from "./import-landing-month";');
    expect(moduleSource).toContain("export const EXPENSE_DATE_PICKER_MAX_PAST_MONTHS = MAX_PAST_MONTH_OFFSET;");
  });

  /**
   * GAP-054 라운드 54 P2-9 — 도달할 수 없는 폴백 두 개를 걷어냈다.
   *
   * (1) `shiftExpenseDatePickerMonth` 끝의 `parseYearMonth(next) ? next : yearMonth` 삼항:
   *     위에서 `current`가 확정됐고 아래 나눗셈이 월을 항상 1~12로 되돌리므로 거짓 갈래가 없다.
   * (2) `isExpenseDatePickerDateSelectable`의 try/catch: `isFutureSeoulDate`가 던지는 유일한
   *     경우(형식 불일치)를 그보다 엄격한 ISO 검사가 이미 걸러 낸 뒤였다.
   *
   * 도달할 수 없는 폴백은 "여기서 무언가 실패할 수 있다"는 잘못된 인상만 남긴다. 동작은
   * 그대로라는 것을 아래에서 다시 확인한다(이 describe의 나머지 케이스가 그 증거다).
   */
  it("도달 불가 폴백을 걷어내도 동작이 같다", () => {
    const moduleSource = readFileSync(join(process.cwd(), "src/expenses/date-picker-month.ts"), "utf8");
    expect(moduleSource).not.toContain("parseYearMonth(next) ? next : yearMonth");
    expect(moduleSource).not.toContain("} catch {");
    // 형식이 깨진 입력은 여전히 거부된다(try/catch가 하던 일이 아니라 위 두 줄이 하던 일이다).
    for (const broken of ["2026-13-01", "2026-08", "not-a-date", ""]) {
      expect(isExpenseDatePickerDateSelectable(broken, TODAY), broken).toBe(false);
    }
    expect(isExpenseDatePickerDateSelectable("2026-08-01", "깨진-기준일")).toBe(false);
    // 달 이동도 종전과 같은 값을 낸다.
    expect(shiftExpenseDatePickerMonth("2026-01", -1, TODAY)).toBe("2025-12");
    expect(shiftExpenseDatePickerMonth("2025-12", 1, TODAY)).toBe("2026-01");
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
  /**
   * 라운드 54 P2-5: 픽커는 두 화면이 공유하는 컴포넌트(src/expenses/ExpenseDatePicker.tsx)로
   * 옮겨졌다. 모양·수치는 여기서, 화면이 그것을 어떻게 꽂는지는 아래 두 화면 소스에서 본다.
   */
  const source = readFileSync(join(process.cwd(), "src/expenses/ExpenseDatePicker.tsx"), "utf8");
  const entrySheet = readFileSync(join(process.cwd(), "app/expenses/new.tsx"), "utf8");
  const detailScreen = readFileSync(join(process.cwd(), "app/expenses/[expenseId].tsx"), "utf8");

  it("P2-C 달력 버튼(48dp)이 진짜 월 픽커를 연다", () => {
    expect(entrySheet).toContain('accessibilityLabel="지출 날짜 변경"');
    expect(entrySheet).toContain('name="calendar-blank-outline"');
    expect(source).toContain("expenseDatePickerInitialMonth(selectedIso, todayIso)");
    expect(source).toContain("<ExpenseDatePickerGrid");
  });

  /**
   * 라운드 54 P2-5 — 지출 상세도 **같은 픽커**를 쓴다.
   *
   * 그 화면의 날짜 입력은 14일 칩과 ISO 손타이핑뿐이라, 두 주보다 오래된 영수증의 날짜를
   * 고쳐 적으려면 문자열을 직접 쳐야 했고 한 글자만 틀려도 저장이 막혔다. 두 화면이 달력을
   * 각자 그리면 같은 앱의 두 달력이 다른 문법을 갖게 되므로, 컴포넌트 하나를 공유한다.
   */
  it("두 화면(빠른 기록·지출 상세)이 같은 컴포넌트를 쓴다", () => {
    for (const [label, screen] of [
      ["new.tsx", entrySheet],
      ["[expenseId].tsx", detailScreen]
    ] as const) {
      expect(screen, label).toContain('import { ExpenseDatePicker } from "../../src/expenses/ExpenseDatePicker";');
      expect(screen, label).toContain("<ExpenseDatePicker");
      expect(screen, label).toContain("todayIso={todayIso}");
      // 화면이 달력을 다시 계산하지 않는다 -- 격자·판정은 컴포넌트 안에서만 쓰인다.
      expect(screen, label).not.toContain("buildExpenseDatePickerMonth(");
      expect(screen, label).not.toContain("CALENDAR_WEEKDAY_LABELS_KO");
    }
    // 상세 화면은 14일 칩·직접 입력을 그대로 유지한다(달력이 기존 경로를 대체하지 않는다).
    expect(detailScreen).toContain("recentDateChips.map");
    expect(detailScreen).toContain('accessibilityLabel="날짜 직접 입력"');
    // 고른 날짜는 저장 payload가 보는 그 한 값으로 들어간다.
    expect(detailScreen).toContain("setSpentOnIso(dateIso);");
    // 세션 게이트: 세션이 없으면 픽커 자체를 그리지 않는다(EXP-003 비세션 경로 불변).
    expect(detailScreen).toContain("{authToken ? (");
  });

  it("격자·판정은 전부 순수 모듈에서 온다(컴포넌트가 달력을 다시 계산하지 않는다)", () => {
    expect(source).toContain("buildExpenseDatePickerMonth(pickerYearMonth, todayIso)");
    expect(source).toContain("isExpenseDatePickerCellSelectable(cell, todayIso)");
    expect(source).toContain("expenseDatePickerCellAccessibilityLabel(cell, { selectedIso, todayIso })");
    expect(source).toContain("CALENDAR_WEEKDAY_LABELS_KO.map");
    // 컴포넌트가 records-calendar에서 가져오는 것은 요일 머리글과 타입뿐이다 -- 격자 계산은
    // 순수 모듈을 거쳐서만 들어온다(달 길이·주 시작 요일을 직접 세지 않는다).
    expect(source).toContain(
      'import { CALENDAR_WEEKDAY_LABELS_KO, type CalendarCell, type CalendarMonth } from "./records-calendar";'
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
    const handler = entrySheet.slice(
      entrySheet.indexOf("onSelectDate={(dateIso) => {"),
      entrySheet.indexOf("selectedIso={expenseDateIso}")
    );
    expect(handler).toContain("setExpenseDateIso(dateIso);");
    expect(handler).toContain("setCustomDateMode(false);");
    expect(handler).toContain('setCustomDateText("");');
    expect(entrySheet).toContain("spentOnIso: expenseDateIso,");
    expect(entrySheet).toContain("spentOn: expenseDate.iso");
  });

  it("기존 pill 3칸·14일 칩·직접 입력 경로가 그대로 남아 있다", () => {
    expect(entrySheet).toContain("const quickDateChips = recentDateChips.slice(0, 3).reverse();");
    expect(entrySheet).toContain("recentDateChips.map");
    expect(entrySheet).toContain('accessibilityLabel="날짜 직접 입력"');
    expect(entrySheet).toContain('if (isFutureSeoulDate(dateOnly)) return "미래 날짜는 선택할 수 없어요.";');
  });

  /**
   * GAP-054 라운드 54 P2-1 — 비활성 표기가 gray300(≈1.24:1)에서 앱 표준 문법으로 옮겨졌다.
   *
   * 미래 칸의 숫자는 "그 칸이 며칠인가"를 말하는 유일한 글자다(스크린리더도 같은 날짜를
   * 읽는다). 눌리지 않는다는 것과 읽히지 않아도 된다는 것은 다른 말이라, 기록 탭 달 내비·
   * 내보내기 달 스테퍼가 이미 쓰는 **gray900 + opacity 0.35**로 통일한다.
   */
  it("비활성(미래 칸·잠긴 달 이동)을 색이 아니라 opacity로 말한다", () => {
    expect(source).toContain("const PICKER_DISABLED_OPACITY = 0.35;");
    const disabledDayStyle = source.slice(source.indexOf("cellDayDisabled: {"), source.indexOf("cellDaySelected: {"));
    expect(disabledDayStyle).toContain("color: theme.colors.gray900");
    expect(disabledDayStyle).toContain("opacity: PICKER_DISABLED_OPACITY");
    // 달 이동 chevron도 같은 방식이다 — 색을 바꾸지 않고 버튼을 흐리게 한다.
    expect(source).toContain(
      "{ opacity: canGoToPreviousExpenseDatePickerMonth(pickerYearMonth, todayIso) ? (pressed ? 0.76 : 1) : PICKER_DISABLED_OPACITY }"
    );
    expect(source).toContain(
      "{ opacity: canGoToNextExpenseDatePickerMonth(pickerYearMonth, todayIso) ? (pressed ? 0.76 : 1) : PICKER_DISABLED_OPACITY }"
    );
    expect(source).toContain('<AppIcon color={theme.colors.gray900} name="chevron-left" size={26} />');
    expect(source).toContain('<AppIcon color={theme.colors.gray900} name="chevron-right" size={26} />');
    // 픽커 구역에 gray300이 되살아나면 여기서 먼저 빨개진다.
    const pickerBlock = source.slice(
      source.indexOf("const PICKER_DISABLED_OPACITY"),
      source.indexOf("type QuickExpenseCategory")
    );
    expect(pickerBlock).not.toContain("theme.colors.gray300");
  });

  it("EXP-001 비세션 캡처 경로 밖이다(세션 게이트 뒤에서만 그린다)", () => {
    expect(entrySheet).toContain("{authToken && showDatePicker ? (");
  });
});
