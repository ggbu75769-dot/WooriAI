import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatSpentOnWithWeekday,
  groupExpensesByDate,
  shiftIsoDate,
  weekdayLabelKo,
  type GroupableExpenseRow
} from "./records-date-groups";

/**
 * UX-B: 기록 탭을 날짜별 그룹(헤더 + 일별 소계)으로 읽히게 만든 순수 모듈의 계약.
 *
 * 고정하려는 것은 세 가지다:
 *  1. 라벨 -- 오늘/어제, 요일 표기(서울 달력), 파싱 불가 값의 원본 통과;
 *  2. 소계 -- 월 합계와 **같은 술어**(countsTowardMonthlyTotal, DNC-015 선물·환불 제외)를 쓰고,
 *     합산 대상이 없는 날은 0원을 찍지 않고 소계 자체를 감춘다;
 *  3. 구조 -- 최신 날짜 먼저, 그룹 안은 입력 순서 보존, 빈 그룹 없음.
 */

const TODAY = "2026-08-27"; // 목요일
const YESTERDAY = "2026-08-26";

function row(spentOn: string, amountKrw: number, expenseType?: string | null, id = `${spentOn}:${amountKrw}`) {
  return { id, spentOn, amountKrw, expenseType } satisfies GroupableExpenseRow & { id: string };
}

describe("weekdayLabelKo (서울 달력 요일)", () => {
  it("달력 날짜의 요일을 한 글자로 준다", () => {
    expect(weekdayLabelKo("2026-08-27")).toBe("목");
    expect(weekdayLabelKo("2026-08-26")).toBe("수");
    expect(weekdayLabelKo("2026-08-23")).toBe("일");
    expect(weekdayLabelKo("2026-08-29")).toBe("토");
  });

  it("기기 타임존과 무관하다 -- 날짜 문자열만 보고 판정한다", () => {
    // spentOn은 시각이 없는 달력 날짜다. 로컬 파싱(new Date("...")/getDay)에 기대면 KST가 아닌
    // 기기에서 하루가 밀린다. UTC 자정 기준으로 읽으므로 아래 값들은 어디서 돌려도 같다.
    expect(weekdayLabelKo("2026-01-01")).toBe("목");
    expect(weekdayLabelKo("2025-12-31")).toBe("수");
  });

  it("파싱할 수 없거나 실재하지 않는 날짜에는 요일을 지어내지 않는다", () => {
    expect(weekdayLabelKo("오늘")).toBeNull();
    expect(weekdayLabelKo("2026-ab-cd")).toBeNull();
    expect(weekdayLabelKo("2026-02-31")).toBeNull();
    expect(weekdayLabelKo("2026-13-01")).toBeNull();
  });
});

describe("formatSpentOnWithWeekday", () => {
  it("월/일 포맷은 formatSpentOn 그대로 쓰고 요일만 덧붙인다", () => {
    expect(formatSpentOnWithWeekday("2026-08-27")).toBe("8월 27일 (목)");
    expect(formatSpentOnWithWeekday("2026-08-04")).toBe("8월 4일 (화)");
  });

  it("요일을 붙일 수 없으면 원본을 그대로 통과시킨다", () => {
    expect(formatSpentOnWithWeekday("오늘")).toBe("오늘");
    expect(formatSpentOnWithWeekday("2026-ab-cd")).toBe("2026-ab-cd");
  });
});

describe("shiftIsoDate", () => {
  it("달/해 경계를 넘어서도 정확히 이동한다", () => {
    expect(shiftIsoDate("2026-08-27", -1)).toBe("2026-08-26");
    expect(shiftIsoDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftIsoDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftIsoDate("2024-03-01", -1)).toBe("2024-02-29"); // 윤년
  });

  it("파싱할 수 없으면 null", () => {
    expect(shiftIsoDate("어제", -1)).toBeNull();
  });
});

describe("groupExpensesByDate 라벨", () => {
  it('오늘/어제는 "오늘"·"어제"로, 나머지는 요일이 붙은 달력 표기로 그린다', () => {
    const groups = groupExpensesByDate(
      [row(TODAY, 12000), row(YESTERDAY, 8000), row("2026-08-20", 5000)],
      TODAY
    );

    expect(groups.map((group) => group.headerLabel)).toEqual(["오늘", "어제", "8월 20일 (목)"]);
    // dateLabel은 오늘/어제여도 달력 표기를 그대로 들고 있다(헤더 문구와 별개의 값).
    expect(groups[0].dateLabel).toBe("8월 27일 (목)");
    expect(groups.map((group) => group.isToday)).toEqual([true, false, false]);
    expect(groups.map((group) => group.isYesterday)).toEqual([false, true, false]);
  });

  it("기준일을 넘기지 않아도(=오늘) 동작하고, 과거 달을 볼 때는 오늘/어제가 하나도 없다", () => {
    const groups = groupExpensesByDate([row("2026-06-11", 3000), row("2026-06-10", 4000)], TODAY);
    expect(groups.every((group) => !group.isToday && !group.isYesterday)).toBe(true);
    expect(groups.map((group) => group.headerLabel)).toEqual(["6월 11일 (목)", "6월 10일 (수)"]);
  });

  it("월 경계에서도 어제 판정이 맞는다", () => {
    const groups = groupExpensesByDate([row("2026-07-31", 1000)], "2026-08-01");
    expect(groups[0].isYesterday).toBe(true);
    expect(groups[0].headerLabel).toBe("어제");
  });
});

describe("groupExpensesByDate 소계 (DNC-015)", () => {
  it("같은 날의 지출만 더한다 -- 선물·환불은 소계에서 빠진다", () => {
    const groups = groupExpensesByDate(
      [row(TODAY, 30000, "expense"), row(TODAY, 15000, "expense"), row(TODAY, 90000, "gift"), row(TODAY, 5000, "refund")],
      TODAY
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].subtotalKrw).toBe(45000);
    expect(groups[0].hasSubtotal).toBe(true);
    // 소계에서 빠지는 것과 목록에서 사라지는 것은 다르다 -- 선물·환불 행 자체는 그대로 남는다.
    expect(groups[0].rows).toHaveLength(4);
  });

  it('선물·환불만 있는 날은 "0원" 대신 소계를 감춘다', () => {
    const groups = groupExpensesByDate([row(TODAY, 90000, "gift"), row(TODAY, 5000, "refund")], TODAY);

    expect(groups[0].hasSubtotal).toBe(false);
    expect(groups[0].rows).toHaveLength(2);
  });

  it("expenseType이 없는 레거시/오프라인 행은 지출로 센다 (countsTowardMonthlyTotal과 같은 규칙)", () => {
    const groups = groupExpensesByDate([row(TODAY, 7000, undefined), row(TODAY, 3000, null)], TODAY);
    expect(groups[0].subtotalKrw).toBe(10000);
    expect(groups[0].hasSubtotal).toBe(true);
  });

  it("모르는 구분은 지출로 세지 않는다 (화이트리스트 규칙 그대로 상속)", () => {
    const groups = groupExpensesByDate([row(TODAY, 7000, "reimbursement")], TODAY);
    expect(groups[0].hasSubtotal).toBe(false);
  });

  it("필터가 걸린 목록을 넘기면 소계도 그날 그 부분집합의 합이 된다", () => {
    const all = [row(TODAY, 30000, "expense", "diaper"), row(TODAY, 12000, "expense", "formula")];
    const filtered = all.filter((candidate) => candidate.id === "diaper");

    expect(groupExpensesByDate(all, TODAY)[0].subtotalKrw).toBe(42000);
    expect(groupExpensesByDate(filtered, TODAY)[0].subtotalKrw).toBe(30000);
  });

  it("필터 없는 소계의 총합은 화면의 월 합계와 정확히 같다", () => {
    const rows = [
      row(TODAY, 30000, "expense"),
      row(TODAY, 90000, "gift"),
      row(YESTERDAY, 12000, "expense"),
      row("2026-08-20", 5000, "refund"),
      row("2026-08-20", 8000, "expense")
    ];
    const monthlyTotalKrw = 30000 + 12000 + 8000; // reconcileMonthlyExpenses가 내는 값과 같은 규칙
    const sum = groupExpensesByDate(rows, TODAY).reduce((total, group) => total + group.subtotalKrw, 0);
    expect(sum).toBe(monthlyTotalKrw);
  });
});

describe("groupExpensesByDate 구조", () => {
  it("최신 날짜가 먼저이고, 그룹 안의 순서는 입력 순서 그대로다", () => {
    const groups = groupExpensesByDate(
      [
        row("2026-08-20", 1000, "expense", "old-a"),
        row(TODAY, 2000, "expense", "today-a"),
        row("2026-08-20", 3000, "expense", "old-b"),
        row(TODAY, 4000, "expense", "today-b")
      ],
      TODAY
    );

    expect(groups.map((group) => group.key)).toEqual([TODAY, "2026-08-20"]);
    expect(groups[0].rows.map((item) => item.id)).toEqual(["today-a", "today-b"]);
    expect(groups[1].rows.map((item) => item.id)).toEqual(["old-a", "old-b"]);
  });

  it("행이 없는 날은 그룹이 만들어지지 않는다 (빈 섹션 없음)", () => {
    // 8월 21~26일에는 기록이 없다 -- 그 사이 날짜의 빈 헤더가 끼면 안 된다.
    const groups = groupExpensesByDate([row(TODAY, 1000), row("2026-08-20", 1000)], TODAY);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.rows.length > 0)).toBe(true);
  });

  it("빈 입력은 빈 배열", () => {
    expect(groupExpensesByDate([], TODAY)).toEqual([]);
  });

  it("파싱할 수 없는 날짜는 라벨을 지어내지 않고 맨 뒤로 모은다", () => {
    const groups = groupExpensesByDate([row("알 수 없음", 1000), row(TODAY, 2000)], TODAY);
    expect(groups.map((group) => group.key)).toEqual([TODAY, "알 수 없음"]);
    expect(groups[1].headerLabel).toBe("알 수 없음");
    expect(groups[1].isToday).toBe(false);
  });
});

/**
 * 배선 계약: 화면이 이 모듈을 실제로 쓰고, 가상화(SectionList)를 유지하는지 원본에서 확인한다
 * (react-native가 vitest에서 네이티브 바인딩 없이 렌더되지 않으므로 이 저장소의 관례인
 * 소스 grep 계약을 따른다 -- src/records-list-virtualization.test.ts와 동일).
 */
describe("UX-B 기록 화면 배선 (app/(tabs)/records.tsx)", () => {
  const recordsSource = readFileSync(join(process.cwd(), "app/(tabs)/records.tsx"), "utf8");

  it("그룹핑 규칙을 화면에 다시 적지 않고 순수 모듈에서 가져온다", () => {
    expect(recordsSource).toContain('from "../../src/expenses/records-date-groups"');
    expect(recordsSource).toContain("groupExpensesByDate(listData, seoulToday)");
    // 화면이 소계를 자체 계산하면 월 합계와 갈릴 수 있다 -- 술어는 순수 모듈 한 곳에만 있다.
    expect(recordsSource).not.toContain('expenseType === "expense"');
  });

  it("가상화 유지: 평평한 FlatList가 아니라 SectionList로 그린다", () => {
    expect(recordsSource).toContain("<SectionList");
    expect(recordsSource).toContain("sections={sections}");
    expect(recordsSource).not.toContain("<FlatList");
    // 비가상화 렌더(행/헤더를 map으로 미리 마운트) 금지 -- PERF-102 계약 유지.
    expect(recordsSource).not.toMatch(/\.map\([\s\S]{0,200}<ListRow/);
  });

  it("섹션 헤더는 날짜와 일별 소계를 함께 그리고, 합산 대상이 없는 날은 소계를 감춘다", () => {
    expect(recordsSource).toContain("renderSectionHeader={renderRecordsSectionHeader}");
    expect(recordsSource).toContain("{section.headerLabel}");
    expect(recordsSource).toContain("section.hasSubtotal ? <Text style={recordsSectionHeaderSubtotalStyle}>{formatKrw(section.subtotalKrw)}</Text> : null");
  });

  it("소계는 필터가 걸린 목록(listData) 기준이다 -- 보이지 않는 행이 섞이지 않는다", () => {
    const groupingIndex = recordsSource.indexOf("groupExpensesByDate(listData, seoulToday)");
    expect(groupingIndex).toBeGreaterThan(recordsSource.indexOf("const listData = useMemo<RecordsListItem[]>"));
    // listData는 이미 카테고리 칩/검색이 걸러낸 visibleExpenses/visibleOfflineRows에서 나온다.
    expect(recordsSource).toContain("visibleOfflineRows.map(");
    expect(recordsSource).toContain("visibleExpenses.map(");
  });

  it("월 합계·전월 델타·작성자 라벨·오프라인 대기 행 등 기존 표시는 그대로다", () => {
    // 라운드 39 UX-P: 월 요약 줄은 여전히 월 전체(monthlyRecordCount/monthlyTotalKrw)를 말한다 --
    // 달 이름만 "이번 달" 하드코딩에서 보고 있는 달 라벨로 바뀌었다.
    expect(recordsSource).toContain("recordCount: monthlyRecordCount,");
    expect(recordsSource).toContain("totalKrw: monthlyTotalKrw");
    expect(recordsSource).toContain('testID="records-last-month-insight"');
    expect(recordsSource).toContain("resolveExpenseAuthorLabel(expenseCreatedByUserId(expense), householdMemberRefs)");
    expect(recordsSource).toContain("offlineStatusIcon(row.syncState)");
    expect(recordsSource).toContain("<CategoryChip");
  });

  it("헤더에도 접근성 라벨이 붙는다 (월 요약 줄과 같은 '합계 …' 관례)", () => {
    expect(recordsSource).toContain(
      "section.hasSubtotal ? `${section.headerLabel}, 합계 ${formatKrw(section.subtotalKrw)}` : section.headerLabel"
    );
  });
});
