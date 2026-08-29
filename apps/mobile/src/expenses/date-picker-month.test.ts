import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateChildStage, getSeoulToday, isFutureSeoulDate } from "@wooriai/domain";
import {
  buildExpenseDatePickerMonth,
  canGoToNextExpenseDatePickerMonth,
  canGoToPreviousExpenseDatePickerMonth,
  expenseDatePickerCellAccessibilityLabel,
  expenseDatePickerHint,
  expenseDatePickerInitialMonth,
  expenseDatePickerMonthLabel,
  expenseDatePickerUnselectableHint,
  isExpenseDatePickerCellSelectable,
  isExpenseDatePickerDateSelectable,
  shiftExpenseDatePickerMonth,
  EXPENSE_DATE_PICKER_BEYOND_TERM_HINT,
  EXPENSE_DATE_PICKER_FUTURE_DIRECTION_HINT,
  EXPENSE_DATE_PICKER_FUTURE_HINT,
  EXPENSE_DATE_PICKER_HINT,
  EXPENSE_DATE_PICKER_MAX_FUTURE_DAYS,
  EXPENSE_DATE_PICKER_MAX_FUTURE_WEEKS,
  EXPENSE_DATE_PICKER_MAX_PAST_MONTHS
} from "./date-picker-month";
import { computeDateError } from "../children/child-form";
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
    for (const text of [
      EXPENSE_DATE_PICKER_HINT,
      EXPENSE_DATE_PICKER_FUTURE_HINT,
      EXPENSE_DATE_PICKER_FUTURE_DIRECTION_HINT,
      EXPENSE_DATE_PICKER_BEYOND_TERM_HINT
    ]) {
      expect(text.endsWith("요.") || text.endsWith("요")).toBe(true);
      for (const blaming of ["잘못", "오류", "실패", "안 됩니다"]) expect(text).not.toContain(blaming);
    }
  });
});

/**
 * 라운드 65 D — 가산 인자 `direction`.
 *
 * 이 픽커는 이제 지출 두 화면과 **아이 날짜 입력 두 화면**이 함께 쓴다. 그래서 여기서 가장 먼저
 * 못박는 것은 새 기능이 아니라 **종전 동작의 불변**이다: 인자를 생략한 호출은 한 값도 달라지지
 * 않는다(지출 두 화면은 이 인자를 넘기지 않는다 — 그 사실도 아래에서 소스로 확인한다).
 */
describe("라운드 65 D — direction 기본값은 종전 동작과 정확히 같다", () => {
  const dates = ["2026-08-26", TODAY, "2026-08-28", "2026-09-01", "2027-01-01", "2006-08-01", "깨진값", ""];
  const months = ["2026-06", "2026-08", "2026-09", "2027-06", "2006-08", "2026-13"];

  it("날짜 판정: 생략 = \"past\"", () => {
    for (const date of dates) {
      expect(isExpenseDatePickerDateSelectable(date, TODAY), date).toBe(
        isExpenseDatePickerDateSelectable(date, TODAY, "past")
      );
    }
    // 그리고 그 답은 종전 그대로 "미래가 아닌가"다.
    expect(isExpenseDatePickerDateSelectable("2026-08-28", TODAY, "past")).toBe(false);
  });

  it("칸 판정·라벨: 생략 = \"past\"", () => {
    for (const cell of dayCells("2026-08")) {
      expect(isExpenseDatePickerCellSelectable(cell, TODAY), cell.date!).toBe(
        isExpenseDatePickerCellSelectable(cell, TODAY, "past")
      );
      expect(expenseDatePickerCellAccessibilityLabel(cell, { selectedIso: null, todayIso: TODAY }), cell.date!).toBe(
        expenseDatePickerCellAccessibilityLabel(cell, { selectedIso: null, todayIso: TODAY, direction: "past" })
      );
    }
  });

  it("달 이동·처음 서는 달: 생략 = \"past\"", () => {
    for (const month of months) {
      expect(canGoToNextExpenseDatePickerMonth(month, TODAY), month).toBe(
        canGoToNextExpenseDatePickerMonth(month, TODAY, "past")
      );
      expect(shiftExpenseDatePickerMonth(month, 1, TODAY), month).toBe(
        shiftExpenseDatePickerMonth(month, 1, TODAY, "past")
      );
      expect(shiftExpenseDatePickerMonth(month, -1, TODAY), month).toBe(
        shiftExpenseDatePickerMonth(month, -1, TODAY, "past")
      );
    }
    for (const date of dates) {
      expect(expenseDatePickerInitialMonth(date, TODAY), date).toBe(expenseDatePickerInitialMonth(date, TODAY, "past"));
    }
    expect(expenseDatePickerInitialMonth(null, TODAY)).toBe(expenseDatePickerInitialMonth(null, TODAY, "past"));
  });

  it("안내 문구: 생략 = \"past\"(지출 화면의 그 문장 그대로)", () => {
    expect(expenseDatePickerHint()).toBe(EXPENSE_DATE_PICKER_HINT);
    expect(expenseDatePickerUnselectableHint()).toBe(EXPENSE_DATE_PICKER_FUTURE_HINT);
    expect(expenseDatePickerHint("future")).toBe(EXPENSE_DATE_PICKER_FUTURE_DIRECTION_HINT);
    expect(expenseDatePickerUnselectableHint("future")).toBe(EXPENSE_DATE_PICKER_BEYOND_TERM_HINT);
  });

  it("지출 두 화면은 이 인자를 넘기지 않는다(두 화면 무변경의 증거)", () => {
    for (const path of ["app/expenses/new.tsx", "app/expenses/[expenseId].tsx"]) {
      const screen = readFileSync(join(process.cwd(), path), "utf8");
      const pickerTag = screen.slice(screen.indexOf("<ExpenseDatePicker"), screen.indexOf("/>", screen.indexOf("<ExpenseDatePicker")));
      expect(pickerTag, path).not.toContain("direction");
    }
  });
});

/**
 * 라운드 65 D — `direction: "future"`(출산 예정일).
 *
 * 출산 예정일은 **미래여야 하는** 유일한 날짜다(지출·출생일과 정반대). 그래서 미래 쪽을 열되
 * 무한히 열지는 않는다 — 상한은 도메인의 임신 주차 규칙에서 읽는다.
 *
 * 과거 쪽은 열어 둔다: 손타이핑 가드(`computeDateError`)도 지난 예정일을 막지 않고, 예정일이
 * 지난 임신 프로필은 실제로 존재한다(src/home/stage-display-label.ts가 그 화면을 위해 있다).
 * 픽커가 가드보다 좁으면 손으로 칠 수 있는 날짜를 달력만 잠그게 된다.
 */
describe("라운드 65 D — direction: \"future\"(출산 예정일)", () => {
  /** TODAY(2026-08-27)로부터 만삭(280일)이 되는 날. 그 다음 날부터 잠긴다. */
  const FULL_TERM_DAY = "2027-06-03";

  it("상한을 새로 짓지 않고 도메인의 임신 주차 규칙에서 읽는다", () => {
    // 도메인은 "예정일이 곧 오늘"이면 만삭 주차를 답한다(packages/domain/src/stage.ts).
    const fullTerm = calculateChildStage({ stageMode: "pregnant", dueDate: TODAY, today: TODAY });
    expect("pregnancyWeek" in fullTerm && fullTerm.pregnancyWeek).toBe(EXPENSE_DATE_PICKER_MAX_FUTURE_WEEKS);
    expect(EXPENSE_DATE_PICKER_MAX_FUTURE_WEEKS).toBe(40);
    // 라운드 65 후속(정보 반영): **0이면 미래 쪽이 통째로 잠긴다.** `readFullTermPregnancyWeeks`는
    // 도메인 응답에 `pregnancyWeek`가 없으면 0을 돌려주므로(도메인이 만삭 응답의 모양을 바꾸면
    // 조용히 그렇게 된다), 출산 예정일 달력이 오늘 이후를 하나도 못 고르는 상태가 아무 오류
    // 없이 만들어질 수 있다. 위 `toBe(40)`을 새 값으로 갱신하는 날에도 이 하한은 남는다.
    expect(EXPENSE_DATE_PICKER_MAX_FUTURE_WEEKS, "만삭 주차가 0이면 미래 달력이 통째로 잠긴다").toBeGreaterThan(0);
    expect(EXPENSE_DATE_PICKER_MAX_FUTURE_DAYS).toBe(EXPENSE_DATE_PICKER_MAX_FUTURE_WEEKS * 7);
    // 그리고 그 값은 **소스에서도** 도메인을 거쳐 들어온다 — 40도 280도 여기 다시 적히지 않는다.
    const moduleSource = readFileSync(join(process.cwd(), "src/expenses/date-picker-month.ts"), "utf8");
    expect(moduleSource).toContain('import { calculateChildStage, getSeoulToday, isFutureSeoulDate } from "@wooriai/domain";');
    expect(moduleSource).toContain('calculateChildStage({ stageMode: "pregnant", dueDate: probeIso, today: probeIso })');
    expect(moduleSource).not.toMatch(/\b280\b/);
    expect(moduleSource).not.toMatch(/\b40\b/);
  });

  it("오늘·내일·만삭 당일까지 고를 수 있고, 만삭 다음 날부터 잠긴다", () => {
    expect(isExpenseDatePickerDateSelectable(TODAY, TODAY, "future")).toBe(true);
    expect(isExpenseDatePickerDateSelectable("2026-08-28", TODAY, "future")).toBe(true);
    expect(isExpenseDatePickerDateSelectable("2026-12-25", TODAY, "future")).toBe(true);
    expect(isExpenseDatePickerDateSelectable(FULL_TERM_DAY, TODAY, "future")).toBe(true);
    expect(isExpenseDatePickerDateSelectable("2027-06-04", TODAY, "future")).toBe(false);
    expect(isExpenseDatePickerDateSelectable("2028-01-01", TODAY, "future")).toBe(false);
  });

  it("지난 예정일도 고를 수 있다(손타이핑 가드가 막지 않는 날짜를 달력만 잠그지 않는다)", () => {
    expect(isExpenseDatePickerDateSelectable("2026-08-26", TODAY, "future")).toBe(true);
    expect(dayCells("2026-05").every((cell) => isExpenseDatePickerCellSelectable(cell, TODAY, "future"))).toBe(true);
  });

  it("픽커가 고를 수 있게 한 날짜는 저장 직전 가드도 통과한다", () => {
    for (const yearMonth of ["2026-05", "2026-08", "2027-06"]) {
      for (const cell of dayCells(yearMonth)) {
        if (!isExpenseDatePickerCellSelectable(cell, TODAY, "future")) continue;
        expect(computeDateError("pregnant", cell.date!), cell.date!).toBeNull();
      }
    }
  });

  it("기준일을 읽을 수 없으면 미래 방향도 열리지 않는다(상한을 지어내지 않는다)", () => {
    expect(isExpenseDatePickerDateSelectable("2026-08-28", "오늘", "future")).toBe(false);
    expect(canGoToNextExpenseDatePickerMonth("2026-08", "오늘", "future")).toBe(false);
  });

  it("달 이동이 만삭이 든 달에서 멈춘다(과거 20년 상한은 그대로)", () => {
    expect(canGoToNextExpenseDatePickerMonth("2026-08", TODAY, "future")).toBe(true);
    expect(canGoToNextExpenseDatePickerMonth("2027-05", TODAY, "future")).toBe(true);
    expect(canGoToNextExpenseDatePickerMonth("2027-06", TODAY, "future")).toBe(false);
    expect(shiftExpenseDatePickerMonth("2027-05", 1, TODAY, "future")).toBe("2027-06");
    expect(shiftExpenseDatePickerMonth("2027-06", 1, TODAY, "future")).toBe("2027-06");
    // 과거 쪽은 방향과 무관하게 종전 그대로다.
    expect(canGoToPreviousExpenseDatePickerMonth("2006-08", TODAY)).toBe(false);
    expect(shiftExpenseDatePickerMonth("2026-08", -1, TODAY, "future")).toBe("2026-07");
  });

  it("저장된 예정일의 달에서 시작한다(past였다면 이번 달로 물러섰을 자리)", () => {
    expect(expenseDatePickerInitialMonth("2027-02-10", TODAY, "future")).toBe("2027-02");
    expect(expenseDatePickerInitialMonth("2027-02-10", TODAY, "past")).toBe("2026-08");
    // 상한 밖·너무 먼 과거는 여전히 이번 달이다(모르면 지어내지 않는다).
    expect(expenseDatePickerInitialMonth("2027-07-01", TODAY, "future")).toBe("2026-08");
    expect(expenseDatePickerInitialMonth("1999-01-01", TODAY, "future")).toBe("2026-08");
    // 그리고 처음 서는 달과 달 이동 상한이 같은 값을 본다(› 로는 가는데 열면 안 서는 일이 없다).
    expect(expenseDatePickerInitialMonth(FULL_TERM_DAY, TODAY, "future")).toBe("2027-06");
  });

  it("못 고르는 칸이 **이 화면의** 이유를 말한다(라운드 61 E 계약: 왜 못 누르는지까지)", () => {
    const juneCells = dayCells("2027-06", TODAY);
    const byDate = (date: string) => juneCells.find((cell) => cell.date === date)!;
    expect(
      expenseDatePickerCellAccessibilityLabel(byDate("2027-06-04"), {
        selectedIso: null,
        todayIso: TODAY,
        direction: "future"
      })
    ).toBe(`6월 4일, ${EXPENSE_DATE_PICKER_BEYOND_TERM_HINT}`);
    // 예정일 달력에서 "아직 오지 않은 날이라 고를 수 없어요"는 사실이 아니다 — 미래 칸은
    // 이유 없이 그냥 날짜로 읽힌다(고를 수 있으니까).
    expect(
      expenseDatePickerCellAccessibilityLabel(byDate("2027-06-03"), {
        selectedIso: null,
        todayIso: TODAY,
        direction: "future"
      })
    ).toBe("6월 3일");
    expect(EXPENSE_DATE_PICKER_BEYOND_TERM_HINT).toContain(`${EXPENSE_DATE_PICKER_MAX_FUTURE_WEEKS}주`);
    expect(EXPENSE_DATE_PICKER_FUTURE_DIRECTION_HINT).toContain(`${EXPENSE_DATE_PICKER_MAX_FUTURE_WEEKS}주`);
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
  const guardsSource = readFileSync(join(process.cwd(), "src/expenses/entry-form-guards.ts"), "utf8");
  const detailScreen = readFileSync(join(process.cwd(), "app/expenses/[expenseId].tsx"), "utf8");

  it("P2-C 달력 버튼(48dp)이 진짜 월 픽커를 연다", () => {
    expect(entrySheet).toContain('accessibilityLabel="지출 날짜 변경"');
    expect(entrySheet).toContain('name="calendar-blank-outline"');
    expect(source).toContain("expenseDatePickerInitialMonth(selectedIso, todayIso, direction)");
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
    expect(source).toContain("isExpenseDatePickerCellSelectable(cell, todayIso, direction)");
    expect(source).toContain("expenseDatePickerCellAccessibilityLabel(cell, { selectedIso, todayIso, direction })");
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
    expect(source).toContain("disabled={!canGoToNextExpenseDatePickerMonth(pickerYearMonth, todayIso, direction)}");
    expect(source).toContain("disabled={!canGoToPreviousExpenseDatePickerMonth(pickerYearMonth, todayIso)}");
    expect(source).toContain("shiftExpenseDatePickerMonth(value, -1, todayIso, direction)");
    expect(source).toContain("shiftExpenseDatePickerMonth(value, 1, todayIso, direction)");
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
    // 라운드 68 A: 손타이핑 판정은 이 화면에서 순수 모듈 한 벌로 걷혔다(복제를 걷지 않으면
    // 이번 라운드의 과거 하한이 두 벌로 태어난다). 화면이 그 판정을 여전히 지나는지를 본다.
    expect(entrySheet).toContain("validateExpenseDateInput(cleaned);");
    expect(guardsSource).toContain('if (isFutureSeoulDate(dateOnly)) return "미래 날짜는 선택할 수 없어요.";');
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
      "{ opacity: canGoToNextExpenseDatePickerMonth(pickerYearMonth, todayIso, direction) ? (pressed ? 0.76 : 1) : PICKER_DISABLED_OPACITY }"
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

/**
 * 라운드 65 D 화면 배선 — 아이 생년월일·예정일(ONB-002 · SET-005).
 *
 * 앱에서 가장 중요한 한 값(단계 밴드·준비템·리포트·홈 히어로가 전부 여기서 나온다)을 첫 실행에서
 * 열 글자 손타이핑으로 받고 있었다. 안드로이드에서는 숫자 키보드조차 뜨지 않는다
 * (`numbers-and-punctuation`은 iOS 전용 값 — 그 사실이 두 화면 주석에 적혀 있다).
 *
 * 여기서 고정하는 것: ⓐ 두 화면이 **이미 있는 픽커**를 쓴다(새 달력 0개), ⓑ 방향은 폼 모듈의
 * 판정 한 곳에서 온다(화면이 "예정일은 미래"를 다시 적지 않는다), ⓒ **손타이핑 칸이 그대로
 * 남는다**(달력은 대안이지 대체가 아니다).
 */
describe("라운드 65 D 화면 배선 — 아이 날짜 입력", () => {
  const onboarding = readFileSync(join(process.cwd(), "app/(onboarding)/child-profile.tsx"), "utf8");
  const settings = readFileSync(join(process.cwd(), "app/settings/children.tsx"), "utf8");

  it("두 화면이 지출과 **같은 픽커 컴포넌트**를 쓴다(달력을 새로 만들지 않는다)", () => {
    expect(onboarding).toContain('import { ExpenseDatePicker } from "../../src/expenses/ExpenseDatePicker";');
    expect(settings).toContain('import { ExpenseDatePicker } from "../../src/expenses/ExpenseDatePicker";');
    for (const [label, screen] of [
      ["child-profile.tsx", onboarding],
      ["children.tsx", settings]
    ] as const) {
      expect(screen, label).toContain("<ExpenseDatePicker");
      expect(screen, label).toContain("todayIso={todayIso}");
      // 화면이 격자를 다시 계산하지 않는다 — 판정은 전부 순수 모듈에서 온다.
      expect(screen, label).not.toContain("buildExpenseDatePickerMonth(");
      expect(screen, label).not.toContain("CALENDAR_WEEKDAY_LABELS_KO");
    }
  });

  it("방향은 폼 모듈의 판정에서 온다(화면이 \"예정일은 미래\"를 다시 적지 않는다)", () => {
    expect(onboarding).toContain("direction={childDatePickerDirection(draft.stageMode)}");
    expect(settings).toContain("direction={childDatePickerDirection(stageMode)}");
    // 출생 전환 카드의 날짜도 출생일이므로 같은 판정을 지난다.
    expect(settings).toContain('direction={childDatePickerDirection("born")}');
    for (const [label, screen] of [
      ["child-profile.tsx", onboarding],
      ["children.tsx", settings]
    ] as const) {
      expect(screen, label).not.toContain('direction="future"');
      expect(screen, label).not.toContain('direction="past"');
    }
    expect(readFileSync(join(process.cwd(), "src/children/child-form.ts"), "utf8")).toContain(
      "export function childDatePickerDirection"
    );
  });

  it("손타이핑 칸이 그대로 남는다(달력은 대안이지 대체가 아니다)", () => {
    for (const [label, screen] of [
      ["child-profile.tsx", onboarding],
      ["children.tsx", settings]
    ] as const) {
      expect(screen, label).toContain("accessibilityLabel={`${dateLabel} 입력`}");
      expect(screen, label).toContain('placeholder="YYYY-MM-DD"');
      expect(screen, label).toContain("maxLength={10}");
      expect(screen, label).toContain('keyboardType="numbers-and-punctuation"');
      // 달력 버튼은 지출 시트와 같은 48dp·같은 아이콘이고, 열림 상태를 소리로도 말한다
      // (라운드 61 E의 달력 접근성 계약과 같은 관례 — 라벨·역할·상태를 다 갖춘다).
      expect(screen, label).toContain("accessibilityLabel={`${dateLabel} 달력에서 고르기`}");
      expect(screen, label).toContain('accessibilityRole="button"');
      expect(screen, label).toContain('name="calendar-blank-outline"');
      expect(screen, label).toContain("height: 48,");
      expect(screen, label).toContain("width: 48");
    }
    expect(onboarding).toContain("accessibilityState={{ expanded: datePickerOpen }}");
    expect(settings).toContain("accessibilityState={{ expanded: pickerOpen }}");
  });

  it("고른 날짜가 손타이핑 칸과 **같은 상태**로 들어간다(검증·저장이 보는 값이 하나다)", () => {
    // 온보딩: dateText 하나만 buildCreateChildBody로 간다.
    const onboardingHandler = onboarding.slice(
      onboarding.indexOf("onSelectDate={(dateIso) => {"),
      onboarding.indexOf("selectedIso={dateText}")
    );
    expect(onboardingHandler).toContain("setDateText(dateIso);");
    expect(onboardingHandler).toContain("setDateTouched(true);");
    // 설정: 세 폼(편집·추가·출생 전환)이 쓰는 그 한 칸의 onChange 그대로.
    const settingsHandler = settings.slice(
      settings.indexOf("onSelectDate={(dateIso) => {"),
      settings.indexOf("selectedIso={value}")
    );
    expect(settingsHandler).toContain("onChange(dateIso);");
  });
});
