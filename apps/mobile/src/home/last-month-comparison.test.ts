import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  daysInYearMonth,
  evaluateLastMonthComparison,
  previousYearMonth,
  sumMonthExpensesThroughDay,
  type ComparableExpenseRecord
} from "./last-month-comparison";

/** 지난달(2025-07) 지출 행 헬퍼 -- 기본은 일반 지출. */
function expense(day: number, amountKrw: number, expenseType = "expense", yearMonth = "2025-07"): ComparableExpenseRecord {
  return { amountKrw, spentOn: `${yearMonth}-${String(day).padStart(2, "0")}`, expenseType };
}

const TODAY = "2025-08-15";

describe("REP-121 previousYearMonth / daysInYearMonth", () => {
  it("steps back one month, crossing the year boundary", () => {
    expect(previousYearMonth("2025-08-15")).toBe("2025-07");
    expect(previousYearMonth("2025-01-03")).toBe("2024-12");
    expect(previousYearMonth("2025-03")).toBe("2025-02");
  });

  it("returns null for a malformed date", () => {
    expect(previousYearMonth("어제")).toBeNull();
    expect(previousYearMonth("2025-13-01")).toBeNull();
  });

  it("knows month lengths including leap February", () => {
    expect(daysInYearMonth("2025-02")).toBe(28);
    expect(daysInYearMonth("2024-02")).toBe(29);
    expect(daysInYearMonth("2025-04")).toBe(30);
    expect(daysInYearMonth("2025-07")).toBe(31);
  });
});

describe("REP-121 sumMonthExpensesThroughDay", () => {
  it("sums only the days up to and including the cutoff", () => {
    const records = [expense(1, 10_000), expense(15, 5_000), expense(16, 999_000)];
    expect(sumMonthExpensesThroughDay(records, "2025-07", 15)).toBe(15_000);
  });

  it("excludes gifts and refunds (DNC-015), matching the server's gift-excluded month total", () => {
    const records = [expense(2, 100_000), expense(3, 500_000, "gift"), expense(4, 30_000, "refund")];
    expect(sumMonthExpensesThroughDay(records, "2025-07", 31)).toBe(100_000);
  });

  it("ignores rows from another month or with an unparseable date", () => {
    const records = [expense(5, 40_000), expense(5, 70_000, "expense", "2025-06"), { amountKrw: 1_000, spentOn: "오늘", expenseType: "expense" }];
    expect(sumMonthExpensesThroughDay(records, "2025-07", 31)).toBe(40_000);
  });
});

describe("REP-121 evaluateLastMonthComparison", () => {
  it("reports a decrease as a floored percent (감소)", () => {
    const result = evaluateLastMonthComparison({
      todayIso: TODAY,
      thisMonthToDateKrw: 880_000,
      lastMonthRecords: [expense(1, 600_000), expense(15, 400_000), expense(20, 300_000)]
    });
    expect(result).toMatchObject({
      direction: "less",
      lastYearMonth: "2025-07",
      comparedThroughDay: 15,
      lastMonthToDateKrw: 1_000_000,
      thisMonthToDateKrw: 880_000,
      differenceKrw: 120_000,
      percent: 12,
      text: "지난달 같은 시점보다 12% 적게 썼어요."
    });
  });

  it("reports an increase (증가)", () => {
    const result = evaluateLastMonthComparison({
      todayIso: TODAY,
      thisMonthToDateKrw: 1_250_000,
      lastMonthRecords: [expense(10, 1_000_000)]
    });
    expect(result?.direction).toBe("more");
    expect(result?.percent).toBe(25);
    expect(result?.text).toBe("지난달 같은 시점보다 25% 많이 썼어요.");
  });

  it("floors the percent so the sentence never overstates the difference", () => {
    // 129,999 / 1,000,000 = 12.99% -> "12%".
    const result = evaluateLastMonthComparison({
      todayIso: TODAY,
      thisMonthToDateKrw: 1_129_999,
      lastMonthRecords: [expense(10, 1_000_000)]
    });
    expect(result?.percent).toBe(12);
    expect(result?.text).toBe("지난달 같은 시점보다 12% 많이 썼어요.");
  });

  it("falls back to the amount when the change floors below 1% (no '0% 적게')", () => {
    const result = evaluateLastMonthComparison({
      todayIso: TODAY,
      thisMonthToDateKrw: 997_000,
      lastMonthRecords: [expense(10, 1_000_000)]
    });
    expect(result?.percent).toBeNull();
    expect(result?.text).toBe("지난달 같은 시점보다 3,000원 적게 썼어요.");
  });

  it("states equality plainly when both sides match (동일)", () => {
    const result = evaluateLastMonthComparison({
      todayIso: TODAY,
      thisMonthToDateKrw: 1_000_000,
      lastMonthRecords: [expense(10, 1_000_000)]
    });
    expect(result).toMatchObject({ direction: "same", differenceKrw: 0, percent: null, text: "지난달 같은 시점과 지출이 같아요." });
  });

  it("never invents a percentage when the baseline is 0원 (지난달 같은 시점 0원)", () => {
    // 지난달 기록은 20일에만 있다 -> 15일까지의 기준값은 0원.
    const result = evaluateLastMonthComparison({
      todayIso: TODAY,
      thisMonthToDateKrw: 300_000,
      lastMonthRecords: [expense(20, 900_000)]
    });
    expect(result).toMatchObject({
      direction: "no-baseline",
      lastMonthToDateKrw: 0,
      percent: null,
      text: "지난달 같은 시점까지는 지출 기록이 없었어요."
    });
  });

  it("states the baseline amount instead of '100% 적게' when this month has no records yet", () => {
    const result = evaluateLastMonthComparison({
      todayIso: TODAY,
      thisMonthToDateKrw: 0,
      lastMonthRecords: [expense(10, 450_000)]
    });
    expect(result).toMatchObject({ direction: "no-spending-yet", percent: null });
    expect(result?.text).toBe("지난달 같은 시점까지는 450,000원을 썼어요.");
  });

  it("renders nothing for a first-month user (지난달 데이터 없음)", () => {
    // 첫 달 사용자: 지난달 응답이 비어 있다.
    expect(evaluateLastMonthComparison({ todayIso: TODAY, thisMonthToDateKrw: 500_000, lastMonthRecords: [] })).toBeNull();
    // 아직 안 불러왔거나 조회 실패.
    expect(evaluateLastMonthComparison({ todayIso: TODAY, thisMonthToDateKrw: 500_000, lastMonthRecords: null })).toBeNull();
    expect(evaluateLastMonthComparison({ todayIso: TODAY, thisMonthToDateKrw: 500_000, lastMonthRecords: undefined })).toBeNull();
    // 지난달에 선물만 있었던 경우도 비교 기준(선물 제외 합계)이 없어 렌더하지 않는다.
    expect(
      evaluateLastMonthComparison({
        todayIso: TODAY,
        thisMonthToDateKrw: 500_000,
        lastMonthRecords: [expense(3, 800_000, "gift")]
      })
    ).toBeNull();
  });

  it("clamps the compared day to the last day of a shorter previous month (3/31 -> 2월)", () => {
    const result = evaluateLastMonthComparison({
      todayIso: "2025-03-31",
      thisMonthToDateKrw: 100_000,
      lastMonthRecords: [expense(28, 200_000, "expense", "2025-02")]
    });
    expect(result?.lastYearMonth).toBe("2025-02");
    expect(result?.comparedThroughDay).toBe(28);
    expect(result?.lastMonthToDateKrw).toBe(200_000);
  });

  it("compares across the year boundary (1월 -> 지난해 12월)", () => {
    const result = evaluateLastMonthComparison({
      todayIso: "2025-01-10",
      thisMonthToDateKrw: 50_000,
      lastMonthRecords: [expense(5, 100_000, "expense", "2024-12"), expense(11, 100_000, "expense", "2024-12")]
    });
    expect(result?.lastYearMonth).toBe("2024-12");
    expect(result?.lastMonthToDateKrw).toBe(100_000);
    expect(result?.text).toBe("지난달 같은 시점보다 50% 적게 썼어요.");
  });

  it("stays silent on unusable input instead of guessing", () => {
    const records = [expense(10, 1_000_000)];
    expect(evaluateLastMonthComparison({ todayIso: "오늘", thisMonthToDateKrw: 1, lastMonthRecords: records })).toBeNull();
    expect(evaluateLastMonthComparison({ todayIso: TODAY, thisMonthToDateKrw: null, lastMonthRecords: records })).toBeNull();
    expect(evaluateLastMonthComparison({ todayIso: TODAY, thisMonthToDateKrw: undefined, lastMonthRecords: records })).toBeNull();
    expect(evaluateLastMonthComparison({ todayIso: TODAY, thisMonthToDateKrw: Number.NaN, lastMonthRecords: records })).toBeNull();
    expect(evaluateLastMonthComparison({ todayIso: TODAY, thisMonthToDateKrw: -1, lastMonthRecords: records })).toBeNull();
  });

  it("keeps the copy factual: no advice, praise or judgement (DNC-018 tone / 과잉 해석 금지)", () => {
    const sentences = [
      evaluateLastMonthComparison({ todayIso: TODAY, thisMonthToDateKrw: 880_000, lastMonthRecords: [expense(10, 1_000_000)] })?.text,
      evaluateLastMonthComparison({ todayIso: TODAY, thisMonthToDateKrw: 1_200_000, lastMonthRecords: [expense(10, 1_000_000)] })?.text,
      evaluateLastMonthComparison({ todayIso: TODAY, thisMonthToDateKrw: 1_000_000, lastMonthRecords: [expense(10, 1_000_000)] })?.text,
      evaluateLastMonthComparison({ todayIso: TODAY, thisMonthToDateKrw: 0, lastMonthRecords: [expense(10, 1_000_000)] })?.text,
      evaluateLastMonthComparison({ todayIso: TODAY, thisMonthToDateKrw: 10, lastMonthRecords: [expense(20, 1_000_000)] })?.text
    ];
    const forbidden = ["잘하", "훌륭", "줄여", "아껴", "절약", "주의", "권장", "추천", "해보세요", "위험", "낭비"];
    for (const sentence of sentences) {
      expect(sentence, "every branch must produce a sentence").toBeTruthy();
      expect(sentence, `"${sentence}" should stay in 해요체 (DNC-018)`).toMatch(/요\.$/);
      for (const word of forbidden) {
        expect(sentence, `"${sentence}" must not editorialize with "${word}"`).not.toContain(word);
      }
    }
  });
});

describe("REP-121 home screen wiring contract", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

  it("renders one line from the pure module, between the budget nudge and 최근 지출", () => {
    expect(homeSource).toContain("evaluateLastMonthComparison");
    expect(homeSource).toContain('testID="home-last-month-insight"');
    expect(homeSource).toContain("{lastMonthInsight.text}");
    expect(homeSource.indexOf('testID="home-last-month-insight"')).toBeGreaterThan(homeSource.indexOf("budgetNudgeTitle"));
    expect(homeSource.indexOf('testID="home-last-month-insight"')).toBeLessThan(homeSource.indexOf('title="최근 지출"'));
  });

  it("reads last month from the expenses list query, sharing the 기록 탭 cache key", () => {
    expect(homeSource).toContain('queryKey: ["expenses", childId, lastYearMonth]');
    expect(homeSource).toContain("listExpenses(authToken!, childId!, lastYearMonth!)");
    // 서울 달력 기준 오늘로 지난달을 정한다(디바이스 타임존 아님).
    expect(homeSource).toContain("getSeoulToday()");
    expect(homeSource).toContain("previousYearMonth(seoulToday)");
  });

  it("keeps the logged-out pixel-lock preview inert (no line rendered, previewHome untouched)", () => {
    expect(homeSource).toContain("const lastMonthInsight = hasSession");
    expect(homeSource).toContain("    : null;");
    expect(homeSource).toContain("{lastMonthInsight ? (");
    // 미리보기 고정 값은 그대로 -- 픽셀락 스크린샷에 영향이 없다.
    expect(homeSource).toContain("1_245_700");
  });

  it("announces the line as one labeled element with the decorative glyph hidden", () => {
    expect(homeSource).toContain("accessibilityLabel={lastMonthInsight.text}");
    expect(homeSource).toContain("<Text accessible={false} style={homeLastMonthInsightStyle.glyph}>");
    // 의미는 문장이 지고, 저대비 coral 소형 텍스트를 쓰지 않는다(A11Y-117).
    expect(homeSource).toContain("color: theme.colors.brown,\n    flex: 1,");
  });
});
