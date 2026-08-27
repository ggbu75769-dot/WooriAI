import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCalendarMonth,
  calendarCellAccessibilityLabel,
  calendarIntensity,
  CALENDAR_MAX_INTENSITY,
  CALENDAR_WEEKDAY_LABELS_KO,
  dailyTotalsFromDateGroups,
  daysInMonth,
  formatCompactKrw,
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
    expect(recordsSource).toContain("calendarCellAccessibilityLabel(cell)");
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

  it("달력 뷰에서도 로딩·오류·빈 달 안내는 그대로 나온다", () => {
    expect(recordsSource).toContain("isCalendarView && showList && calendarMonth ?");
    expect(recordsSource).toContain("ListEmptyComponent={isCalendarView && hasVisibleRecords ? undefined : listEmpty}");
  });

  it("음영은 기존 coral 토큰 단계만 쓴다 (DNC-017: 새 색 도입 금지)", () => {
    const paletteBlock = recordsSource.slice(
      recordsSource.indexOf("const calendarIntensityBackgrounds"),
      recordsSource.indexOf("const calendarWeekRowStyle")
    );
    expect(paletteBlock).toContain("theme.colors.beige");
    expect(paletteBlock).toContain("theme.colors.coral[50]");
    expect(paletteBlock).toContain("theme.colors.coral[100]");
    expect(paletteBlock).toContain("theme.colors.coral[200]");
    expect(paletteBlock).toContain("theme.colors.coral[300]");
    // 새 hex를 지어내지 않는다.
    expect(paletteBlock).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
