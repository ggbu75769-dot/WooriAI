import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCalendarMonth,
  calendarCellAccessibilityLabel,
  calendarIntensity,
  calendarLegendText,
  CALENDAR_LEGEND_TEXT,
  CALENDAR_MAX_INTENSITY,
  CALENDAR_WEEKDAY_LABELS_KO,
  dailyTotalsFromDateGroups,
  daysInMonth,
  formatCompactKrw,
  isCalendarCellInteractive,
  resolveCalendarCellAction,
  CALENDAR_FUTURE_HINT,
  type CalendarCell,
  type CalendarDailyTotal
} from "./records-calendar";
import { groupExpensesByDate } from "./records-date-groups";

/**
 * UX-D 월 캘린더 뷰 — 순수 계산 테스트.
 *
 * 달력이 틀리는 방식은 대부분 **조용하다**: 주 시작 요일이 밀리면 모든 칸이 하루씩 어긋나고,
 * 월 경계 처리를 잘못하면 옆 달 지출이 이 달 히트맵에 섞이고, 분위 계산이 절대 기준이면 조용한
 * 달이 통째로 백지가 된다. 어느 쪽도 화면만 봐서는 "그럴듯해" 보이므로 여기서 못 박는다.
 */

/** 이 달에 속하는 하루치 입력을 만드는 헬퍼. */
function daily(date: string, totalKrw: number, hasSubtotal = totalKrw > 0): CalendarDailyTotal {
  return { date, totalKrw, hasSubtotal };
}

/** 격자에서 실제 날짜 칸만 뽑는다. */
function dayCells(weeks: CalendarCell[][]): CalendarCell[] {
  return weeks.flat().filter((cell) => cell.date !== null);
}

function cellFor(weeks: CalendarCell[][], date: string): CalendarCell {
  const cell = weeks.flat().find((candidate) => candidate.date === date);
  if (!cell) throw new Error(`${date} 칸이 격자에 없다`);
  return cell;
}

describe("daysInMonth", () => {
  it("윤년 2월을 포함해 달의 마지막 날을 센다", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 8)).toBe(31);
    expect(daysInMonth(2026, 11)).toBe(30);
    expect(daysInMonth(2025, 12)).toBe(31);
  });
});

describe("buildCalendarMonth 격자 구조 (월요일 시작)", () => {
  it("1일이 놓이는 열이 월요일 기준 요일이다 — 2026-08-01(토)은 여섯째 칸", () => {
    const month = buildCalendarMonth("2026-08", [], "2026-08-27");
    expect(month).not.toBeNull();
    const first = month!.weeks[0];
    // 앞 다섯 칸은 빈 칸(월~금), 여섯째 칸이 1일(토).
    expect(first.slice(0, 5).every((cell) => cell.date === null)).toBe(true);
    expect(first[5].date).toBe("2026-08-01");
    expect(first[5].day).toBe(1);
    expect(first[5].weekdayIndex).toBe(5);
    // 요일 헤더도 같은 순서다.
    expect(CALENDAR_WEEKDAY_LABELS_KO[5]).toBe("토");
    expect(CALENDAR_WEEKDAY_LABELS_KO[0]).toBe("월");
    expect(CALENDAR_WEEKDAY_LABELS_KO[6]).toBe("일");
  });

  it("모든 주는 7칸이고, 이번 달을 덮는 주만 만든다 (최대 6주 = 42칸)", () => {
    const august = buildCalendarMonth("2026-08", [], "2026-08-27")!;
    expect(august.weeks).toHaveLength(6);
    expect(august.weeks.every((week) => week.length === 7)).toBe(true);
    expect(august.weeks.flat()).toHaveLength(42);

    // 2021년 2월은 월요일에 시작하는 28일 달 — 딱 4주. 항상 6주를 만들면 빈 주가 두 줄 생긴다.
    const shortest = buildCalendarMonth("2021-02", [], "2021-02-10")!;
    expect(shortest.weeks).toHaveLength(4);
    expect(shortest.weeks[0][0].date).toBe("2021-02-01");
    expect(shortest.weeks[3][6].date).toBe("2021-02-28");
    expect(dayCells(shortest.weeks)).toHaveLength(28);
  });

  it("그 달의 모든 날이 정확히 한 번씩 나오고, 앞뒤는 빈 칸으로 메운다", () => {
    const month = buildCalendarMonth("2026-08", [], "2026-08-27")!;
    const days = dayCells(month.weeks);
    expect(days).toHaveLength(31);
    expect(days.map((cell) => cell.day)).toEqual(Array.from({ length: 31 }, (_, index) => index + 1));
    expect(days[0].date).toBe("2026-08-01");
    expect(days[30].date).toBe("2026-08-31");
    // 빈 칸은 날짜도 금액도 없다(옆 달 날짜를 그리지 않는다).
    const blanks = month.weeks.flat().filter((cell) => cell.date === null);
    expect(blanks).toHaveLength(11);
    expect(blanks.every((cell) => cell.day === null && cell.totalKrw === 0 && cell.intensity === 0)).toBe(true);
    // key는 빈 칸까지 전부 고유하다(렌더 key 충돌 방지).
    const keys = month.weeks.flat().map((cell) => cell.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("윤년 2월도 29일까지 그린다", () => {
    const month = buildCalendarMonth("2024-02", [], "2024-02-10")!;
    expect(dayCells(month.weeks)).toHaveLength(29);
    expect(cellFor(month.weeks, "2024-02-29").day).toBe(29);
  });

  it("해가 바뀌는 달도 자기 달만 그린다", () => {
    const december = buildCalendarMonth("2025-12", [daily("2026-01-02", 50_000)], "2025-12-20")!;
    expect(dayCells(december.weeks)).toHaveLength(31);
    expect(december.totalKrw).toBe(0);
    const january = buildCalendarMonth("2026-01", [daily("2025-12-31", 50_000), daily("2026-01-02", 20_000)], "2026-01-05")!;
    expect(january.totalKrw).toBe(20_000);
    expect(cellFor(january.weeks, "2026-01-02").totalKrw).toBe(20_000);
  });

  it("해석할 수 없는 yearMonth는 null — 그럴듯한 아무 달이나 그리지 않는다", () => {
    expect(buildCalendarMonth("2026-13", [], "2026-08-27")).toBeNull();
    expect(buildCalendarMonth("2026-00", [], "2026-08-27")).toBeNull();
    expect(buildCalendarMonth("2026", [], "2026-08-27")).toBeNull();
    expect(buildCalendarMonth("", [], "2026-08-27")).toBeNull();
    expect(buildCalendarMonth("2026-08-27", [], "2026-08-27")).toBeNull();
  });
});

describe("buildCalendarMonth 일별 금액·오늘·선물", () => {
  const totals = [daily("2026-08-03", 12_000), daily("2026-08-11", 45_000), daily("2026-08-27", 6_000)];

  it("입력한 날짜에만 금액이 붙고 나머지는 0이다", () => {
    const month = buildCalendarMonth("2026-08", totals, "2026-08-27")!;
    expect(cellFor(month.weeks, "2026-08-03").totalKrw).toBe(12_000);
    expect(cellFor(month.weeks, "2026-08-11").totalKrw).toBe(45_000);
    expect(cellFor(month.weeks, "2026-08-27").totalKrw).toBe(6_000);
    expect(cellFor(month.weeks, "2026-08-04").totalKrw).toBe(0);
    expect(month.totalKrw).toBe(63_000);
    expect(month.maxDailyKrw).toBe(45_000);
    expect(month.spentDayCount).toBe(3);
  });

  it("오늘 칸만 isToday다 — 다른 달을 보고 있으면 아무 칸도 오늘이 아니다", () => {
    const august = buildCalendarMonth("2026-08", totals, "2026-08-27")!;
    const todayCells = dayCells(august.weeks).filter((cell) => cell.isToday);
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0].date).toBe("2026-08-27");

    const july = buildCalendarMonth("2026-07", [], "2026-08-27")!;
    expect(dayCells(july.weeks).some((cell) => cell.isToday)).toBe(false);
  });

  it("선물·환불만 있던 날은 0원이지만 '지출 없는 날'과 구분된다", () => {
    const month = buildCalendarMonth(
      "2026-08",
      [daily("2026-08-05", 0, false), daily("2026-08-11", 45_000)],
      "2026-08-27"
    )!;
    const giftDay = cellFor(month.weeks, "2026-08-05");
    expect(giftDay.totalKrw).toBe(0);
    expect(giftDay.intensity).toBe(0);
    expect(giftDay.hasGiftOnly).toBe(true);
    // 기록이 아예 없던 날은 hasGiftOnly가 false다.
    expect(cellFor(month.weeks, "2026-08-06").hasGiftOnly).toBe(false);
    // 합산 대상이 있던 날도 물론 false.
    expect(cellFor(month.weeks, "2026-08-11").hasGiftOnly).toBe(false);
    // 소계 없는 날은 월 합계·지출일 수에도 잡히지 않는다.
    expect(month.totalKrw).toBe(45_000);
    expect(month.spentDayCount).toBe(1);
  });

  it("같은 날짜가 여러 번 들어오면 합친다 — 한 건만 보여주는 일이 없다", () => {
    const month = buildCalendarMonth(
      "2026-08",
      [daily("2026-08-03", 10_000), daily("2026-08-03", 5_000)],
      "2026-08-27"
    )!;
    expect(cellFor(month.weeks, "2026-08-03").totalKrw).toBe(15_000);
    expect(month.totalKrw).toBe(15_000);
    expect(month.spentDayCount).toBe(1);
  });

  it("기록이 하나도 없는 달: 격자는 그대로 나오고 모든 칸이 0단계다", () => {
    const month = buildCalendarMonth("2026-08", [], "2026-08-27")!;
    expect(month.weeks).toHaveLength(6);
    expect(month.totalKrw).toBe(0);
    expect(month.maxDailyKrw).toBe(0);
    expect(month.spentDayCount).toBe(0);
    expect(dayCells(month.weeks).every((cell) => cell.intensity === 0)).toBe(true);
  });
});

describe("음영 분위 (그 달 최대 일지출 대비)", () => {
  it("0원은 0단계, 최대치는 항상 4단계", () => {
    expect(calendarIntensity(0, 100_000)).toBe(0);
    expect(calendarIntensity(-5_000, 100_000)).toBe(0);
    expect(calendarIntensity(100_000, 100_000)).toBe(CALENDAR_MAX_INTENSITY);
  });

  it("1/4씩 끊어 1~4단계로 나눈다", () => {
    expect(calendarIntensity(1, 100_000)).toBe(1);
    expect(calendarIntensity(25_000, 100_000)).toBe(1);
    expect(calendarIntensity(25_001, 100_000)).toBe(2);
    expect(calendarIntensity(50_000, 100_000)).toBe(2);
    expect(calendarIntensity(50_001, 100_000)).toBe(3);
    expect(calendarIntensity(75_000, 100_000)).toBe(3);
    expect(calendarIntensity(75_001, 100_000)).toBe(4);
  });

  it("아무리 적게 쓴 날도 0단계로 지워지지 않는다 (기록이 있었다는 사실은 남는다)", () => {
    expect(calendarIntensity(100, 10_000_000)).toBe(1);
  });

  it("분모가 없거나 이상하면 0단계", () => {
    expect(calendarIntensity(10_000, 0)).toBe(0);
    expect(calendarIntensity(Number.NaN, 100)).toBe(0);
    expect(calendarIntensity(10_000, Number.NaN)).toBe(0);
  });

  it("절대 기준이 아니라 상대 분위다 — 조용한 달도 백지가 되지 않는다", () => {
    const quiet = buildCalendarMonth(
      "2026-08",
      [daily("2026-08-02", 1_000), daily("2026-08-09", 4_000)],
      "2026-08-27"
    )!;
    expect(cellFor(quiet.weeks, "2026-08-09").intensity).toBe(4);
    expect(cellFor(quiet.weeks, "2026-08-02").intensity).toBe(1);

    // 같은 비율이면 규모가 100배여도 같은 단계가 나온다.
    const loud = buildCalendarMonth(
      "2026-08",
      [daily("2026-08-02", 100_000), daily("2026-08-09", 400_000)],
      "2026-08-27"
    )!;
    expect(cellFor(loud.weeks, "2026-08-09").intensity).toBe(4);
    expect(cellFor(loud.weeks, "2026-08-02").intensity).toBe(1);
  });
});

describe("formatCompactKrw (칸에 들어가는 짧은 표기)", () => {
  it("만·천 단위로 줄인다", () => {
    expect(formatCompactKrw(45_000)).toBe("4.5만");
    expect(formatCompactKrw(10_000)).toBe("1만");
    expect(formatCompactKrw(123_000)).toBe("12.3만");
    expect(formatCompactKrw(3_500)).toBe("3.5천");
    expect(formatCompactKrw(1_000)).toBe("1천");
    expect(formatCompactKrw(800)).toBe("800");
    expect(formatCompactKrw(0)).toBe("0");
  });

  it("반올림 경계에서는 단위를 올린다 — '10천' 같은 표기를 만들지 않는다", () => {
    expect(formatCompactKrw(9_990)).toBe("1만");
    expect(formatCompactKrw(9_950)).toBe("1만");
    expect(formatCompactKrw(9_949)).toBe("9.9천");
    expect(formatCompactKrw(999)).toBe("1천");
    expect(formatCompactKrw(994)).toBe("994");
  });

  it("100만을 넘으면 소수점을 떼어 칸을 넘치지 않게 한다", () => {
    expect(formatCompactKrw(1_234_567)).toBe("123만");
    expect(formatCompactKrw(999_500)).toBe("100만");
  });

  it("이상한 입력도 칸을 깨뜨리지 않는다", () => {
    expect(formatCompactKrw(Number.NaN)).toBe("0");
    expect(formatCompactKrw(Number.POSITIVE_INFINITY)).toBe("0");
    expect(formatCompactKrw(-45_000)).toBe("4.5만");
  });
});

describe("칸 접근성 라벨", () => {
  const month = buildCalendarMonth(
    "2026-08",
    [daily("2026-08-27", 45_000), daily("2026-08-05", 0, false)],
    "2026-08-27"
  )!;

  it("날짜와 **정확한** 금액을 읽어준다 (화면의 축약이 아니라)", () => {
    expect(calendarCellAccessibilityLabel(cellFor(month.weeks, "2026-08-27"))).toBe("오늘, 8월 27일, 45,000원");
    const other = buildCalendarMonth("2026-08", [daily("2026-08-11", 45_000)], "2026-08-27")!;
    expect(calendarCellAccessibilityLabel(cellFor(other.weeks, "2026-08-11"))).toBe("8월 11일, 45,000원");
  });

  it("지출 없는 날과 선물·환불만 있는 날을 구분해 말한다", () => {
    expect(calendarCellAccessibilityLabel(cellFor(month.weeks, "2026-08-06"))).toBe("8월 6일, 지출 없음");
    expect(calendarCellAccessibilityLabel(cellFor(month.weeks, "2026-08-05"))).toBe("8월 5일, 선물·환불 기록만 있어요");
  });

  it("빈 칸은 라벨이 없다 (스크린리더가 읽을 것이 없다)", () => {
    const blank = month.weeks[0][0];
    expect(blank.date).toBeNull();
    expect(calendarCellAccessibilityLabel(blank)).toBeNull();
  });

  /**
   * 라운드 34 L5: 필터가 걸리면 달력은 **그 필터의 히트맵**이다. 눈으로 보는 사람은 칩 줄과
   * 스코프 줄에서 그 사실을 읽지만, 칸 라벨만 듣는 사람에게는 그 달 전체 지출로 들린다.
   */
  it("L5: 필터 스코프를 칸 라벨 앞에 붙인다 (필터가 없으면 예전 문장 그대로)", () => {
    const cell = cellFor(month.weeks, "2026-08-27");

    expect(calendarCellAccessibilityLabel(cell, { filterLabel: "기저귀/위생 필터" })).toBe(
      "기저귀/위생 필터 기준, 오늘, 8월 27일, 45,000원"
    );
    expect(calendarCellAccessibilityLabel(cellFor(month.weeks, "2026-08-06"), { filterLabel: "검색 결과" })).toBe(
      "검색 결과 기준, 8월 6일, 지출 없음"
    );
    // 가운뎃점은 TalkBack이 읽지 않으므로 쉼표로 바꾼다.
    expect(calendarCellAccessibilityLabel(cell, { filterLabel: "기저귀/위생 필터 · 검색 결과" })).toBe(
      "기저귀/위생 필터, 검색 결과 기준, 오늘, 8월 27일, 45,000원"
    );
    // 필터가 없으면 접두가 붙지 않는다(옵션 자체를 넘기지 않은 경우와 같다).
    for (const filterLabel of [null, undefined, "   "]) {
      expect(calendarCellAccessibilityLabel(cell, { filterLabel })).toBe("오늘, 8월 27일, 45,000원");
    }
    // 달 밖 빈 칸은 필터가 걸려도 여전히 라벨이 없다.
    expect(calendarCellAccessibilityLabel(month.weeks[0][0], { filterLabel: "검색 결과" })).toBeNull();
  });

  /**
   * 라운드 63 C(#8): 이 라운드부터 기록 없는 칸의 대다수가 눌린다("그날로 기록"). 이유를 적지
   * 않으면 스크린리더 사용자에게 "8월 6일, 지출 없음"(눌린다)과 "8월 30일, 지출 없음"(안 눌린다)이
   * 똑같이 들린다 -- 날짜 픽커가 라운드 61 #8에서 고정한 관례를 이 달력에도 적용한다.
   */
  it("#8: 누를 수 없는 미래 칸만 **왜** 못 누르는지를 말한다", () => {
    expect(calendarCellAccessibilityLabel(cellFor(month.weeks, "2026-08-28"))).toBe(
      `8월 28일, 지출 없음, ${CALENDAR_FUTURE_HINT}`
    );
    // 누를 수 있는 칸(지난 빈 날·기록 있는 날)의 문장은 한 글자도 바뀌지 않는다.
    expect(calendarCellAccessibilityLabel(cellFor(month.weeks, "2026-08-06"))).toBe("8월 6일, 지출 없음");
    expect(calendarCellAccessibilityLabel(cellFor(month.weeks, "2026-08-27"))).toBe("오늘, 8월 27일, 45,000원");
    // 필터 접두와 함께 와도 꼬리말은 맨 뒤다(스코프 → 날짜 → 사실 → 이유 순서).
    expect(calendarCellAccessibilityLabel(cellFor(month.weeks, "2026-08-28"), { filterLabel: "검색 결과" })).toBe(
      `검색 결과 기준, 8월 28일, 지출 없음, ${CALENDAR_FUTURE_HINT}`
    );
    // 미래 힌트는 "고를 수 없다"가 아니라 "기록할 수 없다"다 -- 이 칸은 날짜 선택지가 아니라
    // 기록 입구이고, 미래를 막는 규칙 자체는 한 벌이다(DNC-013).
    expect(CALENDAR_FUTURE_HINT).toBe("아직 오지 않은 날이라 기록할 수 없어요");
  });

  it("L5: 범례도 같은 스코프를 말한다 (칸 라벨과 범례가 갈리지 않는다)", () => {
    expect(calendarLegendText()).toBe(CALENDAR_LEGEND_TEXT);
    expect(calendarLegendText(null)).toBe(CALENDAR_LEGEND_TEXT);
    expect(calendarLegendText("  ")).toBe(CALENDAR_LEGEND_TEXT);
    expect(calendarLegendText("기저귀/위생 필터")).toBe(
      `${CALENDAR_LEGEND_TEXT} 지금은 기저귀/위생 필터 기준으로 보고 있어요.`
    );
  });

  /**
   * 라운드 63 C(#8): 범례는 라운드 34의 세계관("기록이 있는 날짜를 누르면…")을 그대로 말하고
   * 있었다. 빈 칸에 목적지가 생긴 이상 그 문장은 사실이 아니다 -- 화면에서 유일하게 "무엇을
   * 누를 수 있는가"를 말하는 줄이라, 여기서 빠지면 새 동선은 발견되지 않는다.
   */
  it("#8: 범례가 두 목적지를 모두 말한다 (DNC-018 해요체)", () => {
    expect(CALENDAR_LEGEND_TEXT).toBe(
      "색이 진할수록 그날 지출이 많아요. 기록이 있는 날짜를 누르면 그날 기록으로 이동하고, 기록이 없는 날짜를 누르면 그날로 기록할 수 있어요."
    );
  });
});

/**
 * 라운드 34 L4 / 라운드 63 C(#8): 칸을 누르면 **무슨 일이 일어나는가**.
 *
 * L4는 기록 없는 칸을 통째로 비대화형으로 만들었고 근거는 목록 내비게이션이었다("이동할 섹션이
 * 없다"). 라운드 56 D#10이 `record_gap` 알림("3일 동안 기록이 없어요")의 목적지를 이 달력으로
 * 옮기면서 그 빈 칸에 목적지가 생겼다 -- 그날로 기록하기. L4의 원칙(반응 없는 버튼 금지)은
 * 그대로이고, 대상이 없는 칸(달 밖 · 미래)은 여전히 비대화형이다(DNC-013).
 */
describe("L4/#8 칸 상호작용 판정", () => {
  const month = buildCalendarMonth(
    "2026-08",
    [daily("2026-08-27", 45_000), daily("2026-08-05", 0, false)],
    "2026-08-27"
  )!;

  it("기록이 있는 날은 그날 기록으로 간다", () => {
    // 지출이 있던 날.
    expect(resolveCalendarCellAction(cellFor(month.weeks, "2026-08-27"))).toBe("open-records");
    // 선물·환불만 있던 날도 목록에 그 행이 보이므로 누를 수 있어야 한다(소계 0에 속으면 안 된다).
    expect(cellFor(month.weeks, "2026-08-05").totalKrw).toBe(0);
    expect(resolveCalendarCellAction(cellFor(month.weeks, "2026-08-05"))).toBe("open-records");
  });

  it("기록이 없는 **지난** 날은 그날로 기록하는 목적지를 갖는다 (알림이 지목한 그 칸)", () => {
    expect(resolveCalendarCellAction(cellFor(month.weeks, "2026-08-06"))).toBe("record-new");
    expect(isCalendarCellInteractive(cellFor(month.weeks, "2026-08-06"))).toBe(true);
    // 오늘도 기록할 수 있는 날이다.
    const emptyToday = buildCalendarMonth("2026-08", [], "2026-08-27")!;
    expect(resolveCalendarCellAction(cellFor(emptyToday.weeks, "2026-08-27"))).toBe("record-new");
  });

  it("미래 날짜와 달 밖 빈 칸은 계속 비대화형이다 (DNC-013)", () => {
    for (const date of ["2026-08-28", "2026-08-31"]) {
      expect(cellFor(month.weeks, date).isFuture).toBe(true);
      expect(resolveCalendarCellAction(cellFor(month.weeks, date))).toBeNull();
      expect(isCalendarCellInteractive(cellFor(month.weeks, date))).toBe(false);
    }
    expect(month.weeks[0][0].isFuture).toBe(false);
    expect(resolveCalendarCellAction(month.weeks[0][0])).toBeNull();
    expect(isCalendarCellInteractive(month.weeks[0][0])).toBe(false);
  });

  it("미래인데 기록이 있는 칸(기기 시계가 앞선 오프라인 행)은 그 기록을 보여 준다", () => {
    // 보여 주지 않으면 사용자가 그 행을 고칠 수도 지울 수도 없다.
    const skewed = buildCalendarMonth("2026-08", [daily("2026-08-30", 12_000)], "2026-08-27")!;
    const cell = cellFor(skewed.weeks, "2026-08-30");
    expect(cell).toMatchObject({ isFuture: true, hasRecords: true });
    expect(resolveCalendarCellAction(cell)).toBe("open-records");
  });

  it("isCalendarCellInteractive는 목적지 판정의 파생이다 (규칙이 두 벌이 되지 않는다)", () => {
    for (const cell of month.weeks.flat()) {
      expect(isCalendarCellInteractive(cell)).toBe(resolveCalendarCellAction(cell) !== null);
    }
  });

  it("hasRecords는 금액이 아니라 '그날 그룹이 있었는지'다", () => {
    expect(cellFor(month.weeks, "2026-08-27").hasRecords).toBe(true);
    expect(cellFor(month.weeks, "2026-08-05")).toMatchObject({ hasRecords: true, hasGiftOnly: true, totalKrw: 0 });
    expect(cellFor(month.weeks, "2026-08-06")).toMatchObject({ hasRecords: false, hasGiftOnly: false, totalKrw: 0 });
    expect(month.weeks[0][0].hasRecords).toBe(false);
  });
});

describe("UX-B 날짜 그룹 재사용 (소계 규칙은 한 곳뿐이다 — DNC-015)", () => {
  const rows = [
    { spentOn: "2026-08-27", amountKrw: 30_000, expenseType: "expense" },
    { spentOn: "2026-08-27", amountKrw: 15_000, expenseType: "expense" },
    // 선물은 소계에서 빠진다 — 서버 sumExpenses와 같은 술어.
    { spentOn: "2026-08-27", amountKrw: 99_000, expenseType: "gift" },
    { spentOn: "2026-08-05", amountKrw: 40_000, expenseType: "gift" },
    { spentOn: "2026-08-05", amountKrw: 20_000, expenseType: "refund" },
    { spentOn: "2026-08-03", amountKrw: 12_000, expenseType: "expense" }
  ];

  it("groupExpensesByDate 결과를 그대로 달력 입력으로 바꾼다", () => {
    const groups = groupExpensesByDate(rows, "2026-08-27");
    const totals = dailyTotalsFromDateGroups(groups);
    expect(totals).toEqual(
      expect.arrayContaining([
        { date: "2026-08-27", totalKrw: 45_000, hasSubtotal: true },
        { date: "2026-08-05", totalKrw: 0, hasSubtotal: false },
        { date: "2026-08-03", totalKrw: 12_000, hasSubtotal: true }
      ])
    );
    expect(totals).toHaveLength(3);
  });

  it("달력 칸의 금액은 그날 섹션 헤더의 소계와 같은 숫자다 (선물·환불 제외)", () => {
    const groups = groupExpensesByDate(rows, "2026-08-27");
    const month = buildCalendarMonth("2026-08", dailyTotalsFromDateGroups(groups), "2026-08-27")!;
    for (const group of groups) {
      const cell = cellFor(month.weeks, group.key);
      expect(cell.totalKrw).toBe(group.hasSubtotal ? group.subtotalKrw : 0);
      expect(cell.hasGiftOnly).toBe(!group.hasSubtotal);
    }
    // 달력 월 합계 = 소계의 합 = 화면 상단 월 합계.
    const subtotalSum = groups.reduce((sum, group) => sum + (group.hasSubtotal ? group.subtotalKrw : 0), 0);
    expect(month.totalKrw).toBe(subtotalSum);
    expect(month.totalKrw).toBe(57_000);
  });

  it("파싱할 수 없는 날짜(레거시 데이터)는 격자에 섞이지 않는다", () => {
    const groups = groupExpensesByDate([{ spentOn: "언젠가", amountKrw: 10_000, expenseType: "expense" }], "2026-08-27");
    const month = buildCalendarMonth("2026-08", dailyTotalsFromDateGroups(groups), "2026-08-27")!;
    expect(month.totalKrw).toBe(0);
    expect(dayCells(month.weeks).every((cell) => cell.totalKrw === 0)).toBe(true);
  });
});

/**
 * 배선 계약: 화면이 이 모듈을 실제로 쓰고, 달력을 넣느라 PERF-102 가상화/UX-B 그룹 계약을 깨지
 * 않았는지 원본에서 확인한다(react-native가 vitest에서 렌더되지 않으므로 이 저장소의 관례인
 * 소스 grep 계약 — src/records-list-virtualization.test.ts와 동일).
 */
describe("UX-D 기록 화면 배선 (app/(tabs)/records.tsx)", () => {
  const recordsSource = readFileSync(join(process.cwd(), "app/(tabs)/records.tsx"), "utf8");

  it("격자·음영·라벨 규칙을 화면에 다시 적지 않고 순수 모듈에서 가져온다", () => {
    expect(recordsSource).toContain('from "../../src/expenses/records-calendar"');
    expect(recordsSource).toContain("buildCalendarMonth(recordsYearMonth, dailyTotalsFromDateGroups(dateGroups), seoulToday)");
    expect(recordsSource).toContain("calendarCellAccessibilityLabel(cell, { filterLabel })");
    expect(recordsSource).toContain("formatCompactKrw(cell.totalKrw)");
    expect(recordsSource).toContain("CALENDAR_WEEKDAY_LABELS_KO.map(");
    // 화면이 자체 분위 계산을 갖지 않는다 — 음영 규칙이 두 벌이 되면 칸 색과 테스트가 갈린다.
    expect(recordsSource).not.toContain("maxDailyKrw /");
  });

  it("일별 합계는 UX-B 날짜 그룹을 재사용한다 (그룹핑을 두 번 하지 않는다)", () => {
    // UX-B 계약이 고정한 표현 그대로에서 그룹을 만들고, 달력·섹션이 그것을 나눠 쓴다.
    expect(recordsSource).toContain("showList ? groupExpensesByDate(listData, seoulToday) : []");
    expect(recordsSource).toContain("dailyTotalsFromDateGroups(dateGroups)");
    const groupingIndex = recordsSource.indexOf("groupExpensesByDate(listData, seoulToday)");
    expect(groupingIndex).toBeGreaterThan(recordsSource.indexOf("const listData = useMemo<RecordsListItem[]>"));
    // 필터가 걸린 listData에서 나오므로 달력도 카테고리 칩/검색을 그대로 따른다.
    expect(recordsSource).toContain("const dateGroups = useMemo(");
  });

  it("리스트/달력 토글은 기존 SegmentedControl을 재사용한다 (새 컴포넌트 없음)", () => {
    expect(recordsSource).toContain("SegmentedControl");
    expect(recordsSource).toContain('const RECORDS_VIEW_LIST = "리스트"');
    expect(recordsSource).toContain('const RECORDS_VIEW_CALENDAR = "달력"');
    expect(recordsSource).toContain("<SegmentedControl options={RECORDS_VIEW_OPTIONS} value={viewMode} onChange={setViewMode} />");
  });

  it("가상화 계약 유지: 지출 행은 여전히 renderItem으로만 나온다", () => {
    // 달력 칸은 42칸 고정 격자라 map으로 그리지만, 지출 행/섹션 헤더는 예전 그대로 렌더 콜백이다.
    expect(recordsSource).toContain("<SectionList");
    expect(recordsSource).not.toContain("<FlatList");
    expect(recordsSource).toContain("renderItem={renderRecordsRow}");
    expect(recordsSource).toContain("renderSectionHeader={renderRecordsSectionHeader}");
    expect(recordsSource).not.toMatch(/\.map\([\s\S]{0,200}<ListRow/);
    expect(recordsSource).not.toMatch(/\.map\([\s\S]{0,200}<RecordsSectionHeader/);
    // 달력을 넣느라 스크롤 컨테이너를 새로 만들지 않았다(가로 칩 스트립 하나가 전부).
    expect(recordsSource.match(/<ScrollView/g) ?? []).toHaveLength(1);
    expect(recordsSource).not.toContain("<AppScreen");
    // 칸 컴포넌트도 memo + 안정된 콜백이라 화면 재렌더에 42칸이 통째로 다시 그려지지 않는다.
    expect(recordsSource).toContain("const CalendarDayCell = memo(");
    expect(recordsSource).toContain("const RecordsCalendarGrid = memo(");
    expect(recordsSource).toContain("const handleSelectCalendarDate = useCallback(");
  });

  it("날짜를 누르면 리스트로 전환하고 그 날짜 섹션으로 스크롤한다 (실패해도 전환은 남는다)", () => {
    expect(recordsSource).toContain("setViewMode(RECORDS_VIEW_LIST);");
    expect(recordsSource).toContain("setPendingScrollDate(date);");
    expect(recordsSource).toContain("sections.findIndex((section) => section.key === pendingScrollDate)");
    expect(recordsSource).toContain("sectionListRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, viewPosition: 0, animated: true })");
    expect(recordsSource).toContain("onScrollToIndexFailed={handleRecordsScrollToIndexFailed}");
    // 스크롤 실패가 화면을 깨뜨리지 않는다.
    expect(recordsSource).toMatch(/try \{[\s\S]{0,240}scrollToLocation[\s\S]{0,240}\} catch \{/);
  });

  /**
   * 라운드 34 M3: 첫 시도는 대상 섹션이 아직 마운트되지 않아 자주 실패한다(초기 렌더 12행).
   * 실패를 그냥 삼키면 "날짜를 눌렀는데 목록 맨 위"로 끝난다 -- 다음 프레임에 상한 안에서
   * 다시 시도하고, 상한을 넘으면 조용히 멈춘다(무한 루프 금지).
   */
  it("M3: 스크롤 실패는 다음 프레임에 재시도하되 상한이 있다", () => {
    // 재시도 대상 날짜는 pendingScrollDate와 별도로 ref에 남는다(시도 직전에 state를 비우므로).
    expect(recordsSource).toContain("const scrollTargetDateRef = useRef<string | null>(null);");
    expect(recordsSource).toContain("const scrollRetryCountRef = useRef(0);");
    expect(recordsSource).toContain("const RECORDS_SCROLL_RETRY_LIMIT = 2;");
    // 새 날짜를 고르면 재시도 예산이 초기화된다.
    expect(recordsSource).toContain("scrollTargetDateRef.current = date;");
    expect(recordsSource).toContain("scrollRetryCountRef.current = 0;");
    // 실패 콜백: 상한 검사 → 카운트 증가 → requestAnimationFrame 한 틱 뒤 재시도.
    expect(recordsSource).toContain("const handleRecordsScrollToIndexFailed = useCallback(() => {");
    expect(recordsSource).toContain("if (scrollRetryCountRef.current >= RECORDS_SCROLL_RETRY_LIMIT) {");
    expect(recordsSource).toContain("scrollRetryCountRef.current += 1;");
    // 라운드 35 F7: 예약한 프레임은 핸들을 ref에 보관해 재예약·언마운트 때 취소한다 --
    // 언마운트 뒤에 깨어난 프레임이 사라진 화면에 setState를 걸지 않게 한다(flashTimerRef 관례).
    expect(recordsSource).toContain(
      "const scrollRetryFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);"
    );
    expect(recordsSource).toContain("scrollRetryFrameRef.current = requestAnimationFrame(() => {");
    expect(recordsSource).toContain("setPendingScrollDate(date);");
    // 취소는 세 곳에서 일어난다: 다음 예약 직전 · 언마운트 cleanup · 그리고 라운드 36 F-6으로
    // 더해진 **날짜 재선택**(살아남은 프레임이 이전 날짜로 스크롤을 되돌리지 못하게).
    expect(recordsSource.match(/cancelAnimationFrame\(scrollRetryFrameRef\.current\)/g) ?? []).toHaveLength(3);
    const selectHandler = recordsSource.slice(
      recordsSource.indexOf("const handleSelectCalendarDate = useCallback("),
      recordsSource.indexOf("announceForA11y(`${formatSpentOn(date)} 기록`);")
    );
    expect(selectHandler).toContain("cancelAnimationFrame(scrollRetryFrameRef.current)");
    expect(selectHandler).toContain("scrollRetryFrameRef.current = null;");
    // 취소는 재시도 예산 초기화보다 먼저다(예약된 프레임이 새 예산을 쓰고 깨어나지 않게).
    expect(selectHandler.indexOf("cancelAnimationFrame")).toBeLessThan(
      selectHandler.indexOf("scrollTargetDateRef.current = date;")
    );
    // 예전의 무동작 콜백은 남아 있지 않다.
    expect(recordsSource).not.toContain("function handleRecordsScrollToIndexFailed() {");
    // 실패해도 그 날짜 announce는 탭 시점에 이미 나갔다(무음 실패가 아니다).
    expect(recordsSource).toContain("announceForA11y(`${formatSpentOn(date)} 기록`);");
  });

  /**
   * 라운드 34 M1: 360dp 기기에서 칸 실폭이 36.3dp였다(44dp 미달). 인접 간격이 4dp뿐이라
   * hitSlop으로는 옆 날짜를 침범하므로, gap·카드 패딩을 줄여 폭을 벌고 높이로 면적을 갚는다.
   */
  it("M1: 칸 폭 계산 상수(카드 패딩·gap·높이)가 화면에 한 곳으로 있다", () => {
    expect(recordsSource).toContain("const CALENDAR_CARD_PADDING = 8;");
    expect(recordsSource).toContain("const CALENDAR_CELL_GAP = 2;");
    expect(recordsSource).toContain("const CALENDAR_CELL_MIN_HEIGHT = 48;");
    // 실측 근거가 주석으로 남아 있어야 다음 리뷰가 다시 재기 시작하지 않는다.
    expect(recordsSource).toContain("÷ 7 = **40.3dp**");
    // 카드 패딩 축소가 실제로 격자 카드에 걸린다.
    expect(recordsSource).toContain("const calendarCardStyle = { padding: CALENDAR_CARD_PADDING } as const;");
    expect(recordsSource).toContain("<Card style={calendarCardStyle}>");
    expect(recordsSource).toContain("gap: CALENDAR_CELL_GAP");
    expect(recordsSource).toContain("minHeight: CALENDAR_CELL_MIN_HEIGHT");
    // 44dp를 채우지 못하는 폭에 hitSlop을 얹어 옆 날짜를 침범하지 않는다.
    const cellBlock = recordsSource.slice(
      recordsSource.indexOf("const CalendarDayCell = memo("),
      recordsSource.indexOf("const RecordsCalendarGrid = memo(")
    );
    expect(cellBlock).not.toContain("hitSlop");
  });

  /**
   * 라운드 34 M2/L9: 축약 표기의 근거는 "잘린 숫자는 틀린 숫자"인데, 글꼴 배율을 키우면 그
   * 축약마저 잘렸다 -- 화면이 모듈의 규칙을 도로 깨고 있었다.
   */
  it("M2: 칸 글자에 배율 상한이 걸려 있고, 선물 라벨도 같은 상한을 쓴다", () => {
    expect(recordsSource).toContain("const CALENDAR_CELL_MAX_FONT_SCALE = 1.2;");
    const cellBlock = recordsSource.slice(
      recordsSource.indexOf("const CalendarDayCell = memo("),
      recordsSource.indexOf("const RecordsCalendarGrid = memo(")
    );
    // 날짜·금액·선물 세 Text 모두.
    expect(cellBlock.match(/maxFontSizeMultiplier=\{CALENDAR_CELL_MAX_FONT_SCALE\}/g) ?? []).toHaveLength(3);
    expect(cellBlock).toContain("numberOfLines={1}");
    // L9: 앱 최소 글자였던 9px 선물 라벨을 10px로 올린다(새 최소치를 만들지 않는다).
    const giftStyleBlock = recordsSource.slice(
      recordsSource.indexOf("const calendarCellGiftStyle"),
      recordsSource.indexOf("const calendarLegendStyle")
    );
    expect(giftStyleBlock).toContain("fontSize: 10");
    expect(giftStyleBlock).not.toContain("fontSize: 9");
  });

  it("L4/#8: 목적지 판정은 순수 모듈이 하고, 비대화형 칸은 Pressable이 아니다", () => {
    expect(recordsSource).toContain("const action = resolveCalendarCellAction(cell);");
    expect(recordsSource).toContain("if (action === null) {");
    // 판정은 순수 모듈에만 있다 -- 화면이 금액·미래를 다시 판정하면 규칙이 두 벌이 된다.
    expect(recordsSource).not.toContain("cell.hasRecords ?");
    expect(recordsSource).not.toContain("cell.isFuture ?");
    // 비대화형 칸도 라벨은 그대로 읽어 준다(이제 그 라벨이 이유까지 말한다).
    expect(recordsSource).toContain("<View accessible accessibilityLabel={accessibilityLabel} style={cellStyle}>");
    // disabled 버튼으로 남겨 두지 않는다(스크린리더에 "버튼, 비활성"으로 읽힌다).
    const cellBlock = recordsSource.slice(
      recordsSource.indexOf("const CalendarDayCell = memo("),
      recordsSource.indexOf("const RecordsCalendarGrid = memo(")
    );
    expect(cellBlock).not.toContain("disabled=");
    expect(cellBlock).not.toContain("accessibilityState");
  });

  /**
   * 라운드 63 C(#8) — `record_gap` 알림의 착지가 막다른 길이 아니게 되는 마지막 한 걸음.
   * 순수 모듈이 "record-new"라고 답해도 화면이 그 갈래를 만들지 않으면 아무 일도 일어나지 않는다.
   */
  it("#8: 빈 칸 탭이 그 날짜를 실은 기록 시트로 간다 (보기 전용은 종전 안내로 막힌다)", () => {
    expect(recordsSource).toContain(
      'onPress={() => (action === "record-new" ? onRecordForDate(date) : onSelectDate(date))}'
    );
    expect(recordsSource).toContain("const handleRecordForCalendarDate = useCallback(");
    // 프리필 파라미터는 "고쳐서 다시 보내기"와 같은 이름을 쓴다 -- 시트에 새 파싱이 0건이다.
    expect(recordsSource).toContain('router.push({ pathname: "/expenses/new", params: { spentOn: date } });');
    // 보기 전용 참여자는 행 액션의 "또 기록"과 같은 판정·같은 안내로 막힌다.
    const handlerBlock = recordsSource.slice(
      recordsSource.indexOf("const handleRecordForCalendarDate = useCallback("),
      recordsSource.indexOf("[expenseEntryLocked, explainExpenseEntryLock]")
    );
    expect(handlerBlock).toContain("if (expenseEntryLocked) {");
    expect(handlerBlock).toContain("explainExpenseEntryLock();");
    // 새 프리필 규칙을 화면에 적지 않는다(날짜 검증은 시트의 순수 모듈 한 곳).
    expect(recordsSource).not.toContain("resolveFailedRowPrefillDate(");
    // 예외의 근거는 프리필 계약 파일 머리말에 남는다 -- 규칙이 두 벌이 되지 않게.
    const rowActionsSource = readFileSync(join(process.cwd(), "src/expenses/record-row-actions.ts"), "utf8");
    expect(rowActionsSource).toContain("라운드 63 C(#8) — **두 번째 예외**");
  });

  it("L5: 필터 스코프는 F8 스코프 줄과 같은 문자열로 달력에 흘러간다", () => {
    expect(recordsSource).toContain("filterLabel={filterScopeSummary?.scopeLabel ?? null}");
    expect(recordsSource).toContain("{calendarLegendText(filterLabel)}");
  });

  it("달력 뷰에서도 로딩·오류·빈 달 안내는 그대로 나온다", () => {
    expect(recordsSource).toContain("isCalendarView && showList && calendarMonth ?");
    expect(recordsSource).toContain("ListEmptyComponent={isCalendarView && hasVisibleRecords ? undefined : listEmpty}");
  });

  /**
   * 라운드 34 L6: 0단계(beige)와 1단계(coral[50])는 채널 차이가 거의 없어 "썼다/안 썼다"가
   * 사실상 같은 색이었다. 1단계를 coral[100]으로 한 칸 올린다 -- 새 hex를 만들지 않고 기존
   * 스케일 안에서만 옮긴다(DNC-017). 이 테스트가 고정하는 것은 **어느 토큰을 쓰는가**이지
   * 그 토큰의 값이 아니라, DSN-053 P1의 팔레트 롤백에도 그대로 유효하다.
   */
  it("음영은 기존 coral 토큰 단계만 쓰고, 1단계가 0단계와 구별된다 (DNC-017: 새 색 도입 금지)", () => {
    const paletteBlock = recordsSource.slice(
      recordsSource.indexOf("const calendarIntensityBackgrounds"),
      recordsSource.indexOf("const calendarCellTextColor")
    );
    expect(paletteBlock).toContain("theme.colors.beige");
    expect(paletteBlock).toContain("theme.colors.coral[100]");
    expect(paletteBlock).toContain("theme.colors.coral[200]");
    expect(paletteBlock).toContain("theme.colors.coral[300]");
    expect(paletteBlock).toContain("theme.colors.coral[400]");
    // 배경과 사실상 구별되지 않던 첫 단계는 더 쓰지 않는다.
    expect(paletteBlock).not.toContain("theme.colors.coral[50]");
    // 새 hex를 지어내지 않는다(주석의 대비 재검산 값은 hex 표기가 아니라 비율로 적는다).
    const paletteCode = paletteBlock
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("*") && !line.trimStart().startsWith("/*"))
      .join("\n");
    expect(paletteCode).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("L6: 진해진 4단계 위에서도 칸 글자가 대비를 유지한다 (한 색으로 전 단계 통과)", () => {
    // brown은 진해진 coral[400] 위에서 AA에 미달해 gray900으로 낮췄다(재검산 값은 화면 쪽
    // 주석에 비율로 적혀 있다 -- 여기서는 어느 토큰을 쓰는지만 고정한다).
    expect(recordsSource).toContain("const calendarCellTextColor = theme.colors.gray900;");
    // 라운드 35 F8: 종전 주석은 "세 Text가 모두 같은 토큰을 쓴다"였지만 사실이 아니다 --
    // 아래 루프가 도는 것은 날짜·금액 **두** Text뿐이고, 세 번째인 "선물" 라벨은 보조 정보라
    // gray600을 쓴다(calendarCellGiftStyle). 고정하려는 규칙은 "음영 단계마다 글자색을 바꾸지
    // 않는다"이고, 그 규칙은 값을 그리는 두 Text에 걸린다. 선물 라벨 색은 아래에서 따로 못박아
    // 두 색이 조용히 뒤섞이지 않게 한다.
    for (const styleName of ["calendarCellDayStyle", "calendarCellAmountStyle"]) {
      const block = recordsSource.slice(recordsSource.indexOf(`const ${styleName}`), recordsSource.indexOf(`const ${styleName}`) + 200);
      expect(block).toContain("color: calendarCellTextColor");
    }
    // F8: 세 번째 Text("선물")는 gray600 보조색이다 -- 위 주석이 말하는 예외를 실제로 고정한다.
    const giftStyleBlock = recordsSource.slice(
      recordsSource.indexOf("const calendarCellGiftStyle"),
      recordsSource.indexOf("const calendarLegendStyle")
    );
    expect(giftStyleBlock).toContain("color: theme.colors.gray600");
    expect(giftStyleBlock).not.toContain("color: calendarCellTextColor");
    // 재검산 근거(대비 비율)가 주석에 남아 있어야 다음 팔레트 변경이 다시 계산한다.
    // DSN-053 P1에서 팔레트가 c20deeb 값으로 롤백되며 두 비율을 다시 계산했다.
    expect(recordsSource).toContain("15.28:1");
    expect(recordsSource).toContain("6.50:1");
  });
});
