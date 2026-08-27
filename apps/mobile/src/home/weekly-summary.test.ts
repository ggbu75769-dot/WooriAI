import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ComparableExpenseRecord } from "./last-month-comparison";
import { evaluateWeeklySummary } from "./weekly-summary";

/** 2026-08-27은 목요일 -- 이번 주는 08-24(월)~08-27, 지난주 같은 요일까지는 08-17~08-20. */
const THURSDAY = "2026-08-27";

function record(spentOn: string, amountKrw: number, expenseType = "expense"): ComparableExpenseRecord {
  return { spentOn, amountKrw, expenseType };
}

describe("UX-A 주간 요약 (월요일 시작)", () => {
  const thisWeek = [
    record("2026-08-24", 30_000),
    record("2026-08-25", 24_200),
    record("2026-08-26", 20_000),
    record("2026-08-27", 10_000)
  ];
  const lastWeek = [
    record("2026-08-17", 50_000),
    record("2026-08-19", 46_200),
    // 지난주지만 "같은 요일" 이후(금·일)라 비교 구간 밖이다.
    record("2026-08-21", 500_000),
    record("2026-08-23", 500_000)
  ];

  it("이번 주 합계와 지난주 같은 요일까지의 비교를 한 줄로 만든다", () => {
    const summary = evaluateWeeklySummary({
      todayIso: THURSDAY,
      thisMonthRecords: [...thisWeek, ...lastWeek],
      lastMonthRecords: []
    });

    expect(summary).toMatchObject({ weekStartIso: "2026-08-24", totalKrw: 84_200, recordedDayCount: 4 });
    expect(summary?.comparison).toMatchObject({ direction: "less", lastWeekToDateKrw: 96_200, differenceKrw: 12_000 });
    expect(summary?.text).toBe("이번 주 84,200원 · 지난주 같은 요일까지보다 12,000원 적게 썼어요");
    expect(summary?.streakText).toBe("이번 주 4일 기록했어요");
    expect(summary?.accessibilityLabel).toBe(
      "이번 주 84,200원 · 지난주 같은 요일까지보다 12,000원 적게 썼어요. 이번 주 4일 기록했어요"
    );
  });

  it("지난주보다 많이 쓴 주와 같은 주도 사실만 말한다", () => {
    const more = evaluateWeeklySummary({
      todayIso: THURSDAY,
      thisMonthRecords: [record("2026-08-24", 100_000), record("2026-08-17", 40_000)],
      lastMonthRecords: []
    });
    expect(more?.text).toBe("이번 주 100,000원 · 지난주 같은 요일까지보다 60,000원 많이 썼어요");

    const same = evaluateWeeklySummary({
      todayIso: THURSDAY,
      thisMonthRecords: [record("2026-08-24", 40_000), record("2026-08-17", 40_000)],
      lastMonthRecords: []
    });
    expect(same?.comparison?.direction).toBe("same");
    expect(same?.text).toBe("이번 주 40,000원 · 지난주 같은 요일까지와 같아요");
  });

  it("월요일에는 그날 하루만 이번 주다 (전날 일요일은 지난주)", () => {
    const summary = evaluateWeeklySummary({
      todayIso: "2026-08-24",
      thisMonthRecords: [record("2026-08-23", 90_000), record("2026-08-24", 12_000)],
      lastMonthRecords: []
    });
    expect(summary).toMatchObject({ weekStartIso: "2026-08-24", totalKrw: 12_000, recordedDayCount: 1 });
    // 지난주 같은 요일까지 = 08-17 하루뿐이고 기록이 없으므로 비교하지 않는다.
    expect(summary?.comparison).toBeNull();
    expect(summary?.text).toBe("이번 주 12,000원");
  });

  it("지난주 같은 시점까지 기록이 없으면 비교 문장을 만들지 않는다", () => {
    const summary = evaluateWeeklySummary({
      todayIso: THURSDAY,
      thisMonthRecords: [record("2026-08-25", 12_000)],
      lastMonthRecords: []
    });
    expect(summary?.comparison).toBeNull();
    expect(summary?.text).toBe("이번 주 12,000원");
  });
});

describe("UX-A 주간 요약 (달을 걸친 주)", () => {
  // 2026-09-01은 화요일 -- 이번 주 월요일은 8월 31일이라 이번 달 캐시만으로는 하루가 빠진다.
  const thisMonth = [record("2026-09-01", 10_000)];
  const lastMonth = [record("2026-08-31", 20_000), record("2026-08-24", 5_000), record("2026-08-25", 5_000)];

  it("지난달 캐시까지 합쳐 정확한 주 합계와 비교를 낸다", () => {
    const summary = evaluateWeeklySummary({
      todayIso: "2026-09-01",
      thisMonthRecords: thisMonth,
      lastMonthRecords: lastMonth
    });

    expect(summary).toMatchObject({ weekStartIso: "2026-08-31", totalKrw: 30_000, recordedDayCount: 2 });
    // 지난주 같은 요일까지 = 08-24(월)~08-25(화) = 10,000원.
    expect(summary?.comparison).toMatchObject({ direction: "more", lastWeekToDateKrw: 10_000, differenceKrw: 20_000 });
  });

  it("지난달 캐시가 아직 없으면 부분 합계에 '이번 주'라는 이름을 붙이지 않는다", () => {
    expect(
      evaluateWeeklySummary({ todayIso: "2026-09-01", thisMonthRecords: thisMonth, lastMonthRecords: null })
    ).toBeNull();
  });

  it("이번 주는 이번 달 안이지만 지난주가 지난달에 걸치면 비교만 생략한다", () => {
    // 2026-09-10(목)의 이번 주 월요일은 09-07, 지난주 구간은 08-31~09-03.
    const summary = evaluateWeeklySummary({
      todayIso: "2026-09-10",
      thisMonthRecords: [record("2026-09-08", 15_000)],
      lastMonthRecords: null
    });
    expect(summary).toMatchObject({ weekStartIso: "2026-09-07", totalKrw: 15_000 });
    expect(summary?.comparison).toBeNull();
    expect(summary?.text).toBe("이번 주 15,000원");
  });
});

describe("UX-A 기록 스트릭 · 금액 기준", () => {
  it("기록이 없는 주는 비난 없이 다음 한 걸음만 권한다", () => {
    const summary = evaluateWeeklySummary({ todayIso: THURSDAY, thisMonthRecords: [], lastMonthRecords: [] });
    expect(summary).toMatchObject({ totalKrw: 0, recordedDayCount: 0, comparison: null });
    expect(summary?.text).toBe("이번 주 지출은 아직 없어요");
    expect(summary?.streakText).toBe("이번 주 첫 기록을 남겨보세요");
  });

  it("합계는 선물·환불을 빼고(DNC-015) 세지만, 기록한 날은 그 행들도 센다", () => {
    const summary = evaluateWeeklySummary({
      todayIso: THURSDAY,
      thisMonthRecords: [
        record("2026-08-25", 50_000, "gift"),
        record("2026-08-26", 30_000, "refund"),
        record("2026-08-27", 10_000)
      ],
      lastMonthRecords: []
    });
    expect(summary).toMatchObject({ totalKrw: 10_000, recordedDayCount: 3 });
    expect(summary?.text).toBe("이번 주 10,000원");
  });

  it("선물만 기록한 주는 '지출 없음'이면서도 기록한 날을 인정한다", () => {
    const summary = evaluateWeeklySummary({
      todayIso: THURSDAY,
      thisMonthRecords: [record("2026-08-25", 50_000, "gift")],
      lastMonthRecords: []
    });
    expect(summary?.text).toBe("이번 주 지출은 아직 없어요");
    expect(summary?.streakText).toBe("이번 주 1일 기록했어요");
  });

  it("이번 달 캐시가 없거나 오늘 형식이 깨졌으면 아무것도 만들지 않는다", () => {
    expect(evaluateWeeklySummary({ todayIso: THURSDAY, thisMonthRecords: null, lastMonthRecords: [] })).toBeNull();
    expect(evaluateWeeklySummary({ todayIso: "오늘", thisMonthRecords: [], lastMonthRecords: [] })).toBeNull();
  });
});

describe("UX-A 주간 요약 화면 배선 계약 (app/(tabs)/index.tsx)", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
  const recordsSource = readFileSync(join(process.cwd(), "app/(tabs)/records.tsx"), "utf8");

  it("이번 달 지출은 기록 탭과 같은 캐시 키를 쓰고 전량 수집 페처를 거친다", () => {
    expect(homeSource).toContain('queryKey: ["expenses", childId, thisYearMonth]');
    expect(homeSource).toContain(
      "fetchMonthExpenses((page) => listExpenses(authToken!, childId!, thisYearMonth, page))"
    );
    // 키 모양이 기록 탭과 같아야 두 화면이 같은 응답을 공유한다.
    expect(recordsSource).toContain('queryKey: ["expenses", childId, recordsYearMonth]');
  });

  it("세션이 있을 때만 계산하고 두 달치 캐시를 함께 넘긴다", () => {
    expect(homeSource).toContain("const weeklySummary = hasSession");
    expect(homeSource).toContain("thisMonthRecords: thisMonthExpenses.data?.expenses ?? null");
    expect(homeSource).toContain("lastMonthRecords: lastMonthExpenses.data?.expenses ?? null");
  });

  it("카드에 소리용 라벨이 붙고 장식 글리프는 접근성 트리에서 감춰진다", () => {
    expect(homeSource).toContain("accessibilityLabel={weeklySummary.accessibilityLabel}");
    expect(homeSource).toContain('testID="home-weekly-summary"');
    expect(homeSource).toContain("<Text accessible={false} style={homeWeeklySummaryStyle.glyph}>");
  });
});
