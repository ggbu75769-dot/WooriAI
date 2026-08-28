import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reconcileMonthlyExpenses } from "../offline/expense-list-reconciliation";
import type { LocalExpenseRow } from "../offline/types";
import {
  daysInYearMonth,
  evaluateLastMonthComparison,
  PERCENT_MIN_BASELINE_KRW,
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

  // 정밀 리뷰 F3(부수): 술어를 countsTowardMonthlyTotal 한 곳으로 모은 결과.
  it("expenseType이 없는 레거시 로컬 행도 지출로 센다 -- 기록 탭 월 합계와 같은 술어", () => {
    const records = [{ amountKrw: 20_000, spentOn: "2025-07-03" }, { amountKrw: 5_000, spentOn: "2025-07-04", expenseType: undefined }];
    // 예전에는 `expenseType !== "expense"`로 걸러 둘 다 0원 취급했다 -- 같은 행이 이번 달
    // 합계(reconcileMonthlyExpenses)에는 들어가므로 델타의 두 항이 어긋났다.
    expect(sumMonthExpensesThroughDay(records, "2025-07", 31)).toBe(25_000);
  });

  it("알 수 없는 새 expenseType은 여전히 제외한다 (화이트리스트 유지)", () => {
    const records = [expense(3, 10_000), expense(4, 90_000, "reimbursement")];
    expect(sumMonthExpensesThroughDay(records, "2025-07", 31)).toBe(10_000);
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

  // 리뷰 F8: 매달 1~3일은 "하루 대 하루" 비교라 비율이 발산한다(1,000원 → 50,000원 = 4900%).
  // 그 구간에서는 같은 사실을 금액으로 말한다.
  it("states the amount instead of a diverging percent on the first days of a month", () => {
    const result = evaluateLastMonthComparison({
      todayIso: "2025-08-01",
      thisMonthToDateKrw: 50_000,
      lastMonthRecords: [expense(1, 1_000), expense(20, 900_000)]
    });
    expect(result).toMatchObject({
      direction: "more",
      comparedThroughDay: 1,
      lastMonthToDateKrw: 1_000,
      differenceKrw: 49_000,
      percent: null,
      text: "지난달 같은 시점보다 49,000원 많이 썼어요."
    });
  });

  it("keeps the day-3 / day-4 boundary of the percent rule explicit", () => {
    const bigBaseline = [expense(1, 400_000), expense(2, 400_000), expense(3, 400_000), expense(4, 400_000)];
    // 3일까지는 구간이 짧아 금액으로 말한다(기준액이 커도 마찬가지).
    const day3 = evaluateLastMonthComparison({
      todayIso: "2025-08-03",
      thisMonthToDateKrw: 600_000,
      lastMonthRecords: bigBaseline
    });
    expect(day3?.comparedThroughDay).toBe(3);
    expect(day3?.percent).toBeNull();
    expect(day3?.text).toBe("지난달 같은 시점보다 600,000원 적게 썼어요.");
    // 4일부터는 퍼센트가 켜진다.
    const day4 = evaluateLastMonthComparison({
      todayIso: "2025-08-04",
      thisMonthToDateKrw: 800_000,
      lastMonthRecords: bigBaseline
    });
    expect(day4?.comparedThroughDay).toBe(4);
    expect(day4?.percent).toBe(50);
    expect(day4?.text).toBe("지난달 같은 시점보다 50% 적게 썼어요.");
  });

  it("states the amount when the baseline is too small for a percentage to mean anything", () => {
    // 구간은 충분히 길지만(10일) 기준액이 소액이라 비율이 잡음이 된다.
    const result = evaluateLastMonthComparison({
      todayIso: TODAY,
      thisMonthToDateKrw: 40_000,
      lastMonthRecords: [expense(3, 20_000), expense(20, 500_000)]
    });
    expect(result?.lastMonthToDateKrw).toBe(20_000);
    expect(result?.percent).toBeNull();
    expect(result?.text).toBe("지난달 같은 시점보다 20,000원 많이 썼어요.");
    // 기준액이 임계값에 닿으면 다시 퍼센트로 말한다.
    const atThreshold = evaluateLastMonthComparison({
      todayIso: TODAY,
      thisMonthToDateKrw: 75_000,
      lastMonthRecords: [expense(3, PERCENT_MIN_BASELINE_KRW)]
    });
    expect(atThreshold?.percent).toBe(50);
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
    // REC-124(H1): 한 페이지가 아니라 그 달 전량을 모은다(src/expenses/month-expenses.ts).
    expect(homeSource).toContain(
      "fetchMonthExpenses((page) => listExpenses(authToken!, childId!, lastYearMonth!, page))"
    );
    // 서울 달력 기준 오늘로 지난달을 정한다(디바이스 타임존 아님).
    expect(homeSource).toContain("getSeoulToday()");
    expect(homeSource).toContain("previousYearMonth(seoulToday)");
  });

  it("keeps the logged-out pixel-lock preview inert (no line rendered, previewHome untouched)", () => {
    expect(homeSource).toContain("const lastMonthInsight = hasSession");
    expect(homeSource).toContain("    : null;");
    // DSN-053 P2-A: 이 줄은 우선순위 판정이 고르는 카드 중 하나라 렌더 함수 안의 분기가 됐다.
    expect(homeSource).toContain("lastMonthInsight ? (");
    // 미리보기 고정 값은 그대로 -- 픽셀락 스크린샷에 영향이 없다.
    expect(homeSource).toContain("1_245_700");
  });

  it("announces the line as one labeled element with the decorative glyph hidden", () => {
    expect(homeSource).toContain("accessibilityLabel={lastMonthInsight.text}");
    // D1 후속(실기기 피드백 2): 장식 글리프(▤)는 Ionicons로 바뀌었지만 "접근성 트리에서
    // 감춘다"는 계약은 그대로다 -- 색·크기도 같은 스타일 토큰에서 그대로 읽어 쓴다.
    expect(homeSource).toMatch(/accessible=\{false\}\s+name="stats-chart-outline"/);
    expect(homeSource).toContain("size={homeLastMonthInsightStyle.glyph.fontSize}");
    expect(homeSource).toContain("color={homeLastMonthInsightStyle.glyph.color}");
    // 의미는 문장이 지고, 저대비 coral 소형 텍스트를 쓰지 않는다(A11Y-117).
    expect(homeSource).toContain("color: theme.colors.brown,\n    flex: 1,");
  });
});

describe("REC-123(D1) 기록 탭 wiring contract", () => {
  const recordsSource = readFileSync(join(process.cwd(), "app/(tabs)/records.tsx"), "utf8");
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

  it("reuses the home module instead of recomputing the comparison, and renders it under the month summary line", () => {
    expect(recordsSource).toContain('from "../../src/home/last-month-comparison"');
    expect(recordsSource).toContain("evaluateLastMonthComparison({");
    expect(recordsSource).toContain('testID="records-last-month-insight"');
    expect(recordsSource).toContain("{lastMonthInsight.text}");
    // 요약 줄 바로 아래 -- 검색 입력/카테고리 칩보다 위.
    const insightIndex = recordsSource.indexOf('testID="records-last-month-insight"');
    expect(insightIndex).toBeGreaterThan(recordsSource.indexOf("이번 달 ${monthlyRecordCount}건"));
    // GAP-054 D#8: 검색창 라벨이 판매처를 포함하도록 늘었다 -- 여기서는 자리 기준점으로만 쓴다.
    expect(insightIndex).toBeLessThan(recordsSource.indexOf("accessibilityLabel={RECORDS_SEARCH_PLACEHOLDER}"));
  });

  it("compares against the total this screen actually shows, and only while the current month is on screen", () => {
    // 화면에 보이는 합계와 같은 값으로 비교한다(오프라인 대기 행 포함, 선물/환불 제외).
    expect(recordsSource).toContain("thisMonthToDateKrw: monthlyTotalKrw");
    // 과거 달 탐색 중에는 "같은 시점"이 성립하지 않으므로 계산도 렌더도 하지 않는다.
    expect(recordsSource).toContain("const isCurrentMonth = monthOffset === 0;");
    expect(recordsSource).toContain("isCurrentMonth && expenses.data");
  });

  it("shares the home cache key for last month, so the extra insight costs no extra request", () => {
    expect(recordsSource).toContain("previousYearMonth(seoulToday)");
    expect(recordsSource).toContain('queryKey: ["expenses", childId, lastYearMonth]');
    // 홈(app/(tabs)/index.tsx)과 문자 그대로 같은 키여야 캐시가 실제로 공유된다.
    expect(homeSource).toContain('queryKey: ["expenses", childId, lastYearMonth]');
    // 과거 달을 보는 동안에는 조회 자체가 비활성.
    expect(recordsSource).toContain("enabled: Boolean(authToken && childId && lastYearMonth && isCurrentMonth)");
  });
});

/**
 * 정밀 리뷰 F3: 기록 탭 델타의 두 항이 **같은 데이터 소스/같은 산출 규칙**에서 나와야 한다.
 *
 * 예전에는 이번 달 항만 reconcileMonthlyExpenses(미동기화 로컬 행 포함)를 거치고 지난달 항은
 * 서버 목록 원본이었다. 아래 헬퍼는 기록 탭(app/(tabs)/records.tsx)이 지금 실제로 하는 계산을
 * 그대로 재현한다 -- 두 달 모두 같은 로컬 행 집합으로 재조정한 뒤 비교한다.
 */
const F3_TODAY = "2025-08-15";

type ServerRecord = { id: string; amountKrw: number; spentOn: string; expenseType: string };

function serverRecord(id: string, spentOn: string, amountKrw: number, expenseType = "expense"): ServerRecord {
  return { id, amountKrw, spentOn, expenseType };
}

type LocalRowOverrides = Omit<Partial<LocalExpenseRow>, "payload"> & { payload?: Partial<LocalExpenseRow["payload"]> };

function localRow(overrides: LocalRowOverrides): LocalExpenseRow {
  const { payload, ...rest } = overrides;
  return {
    localId: "local-1",
    canonicalId: null,
    childId: "child-1",
    payload: { childId: "child-1", categoryId: "cat-1", amountKrw: 10_000, spentOn: "2025-07-12", itemName: "기저귀", ...payload },
    version: null,
    syncState: "pending",
    pendingDelete: false,
    conflictCurrent: null,
    lastError: null,
    createdAt: "2025-07-12T00:00:00.000Z",
    updatedAt: "2025-07-12T00:00:00.000Z",
    ...rest
  };
}

/** app/(tabs)/records.tsx의 두 항 산출을 그대로 흉내 낸다(F3 수정 후). */
function recordsScreenComparison(input: {
  thisMonthServer: ServerRecord[];
  lastMonthServer: ServerRecord[];
  offlineRows: LocalExpenseRow[];
  todayIso?: string;
}) {
  const todayIso = input.todayIso ?? F3_TODAY;
  const thisYearMonth = todayIso.slice(0, 7);
  const lastYearMonth = previousYearMonth(todayIso)!;
  const thisMonth = reconcileMonthlyExpenses(input.thisMonthServer, input.offlineRows, thisYearMonth);
  const lastMonth = reconcileMonthlyExpenses(input.lastMonthServer, input.offlineRows, lastYearMonth);
  const lastMonthRecords: ComparableExpenseRecord[] = [
    ...lastMonth.visibleServerExpenses,
    ...lastMonth.offlinePendingRows.map((row) => ({
      amountKrw: row.payload.amountKrw,
      spentOn: row.payload.spentOn,
      expenseType: row.payload.expenseType
    }))
  ];
  return evaluateLastMonthComparison({
    todayIso,
    thisMonthToDateKrw: thisMonth.monthlyTotalKrw,
    lastMonthRecords
  });
}

describe("F3 기록 탭 전월 동시점 델타 -- 두 항의 대칭", () => {
  it("지난달에 남아 있는 미동기화 로컬 행도 기준액에 넣는다 (허위 '200% 많이' 방지)", () => {
    const offlineRows = [
      // 오프라인에서 기록해 아직 서버에 못 올라간 지난달 행 -- 서버 목록에는 없다.
      localRow({ localId: "local-jul", payload: { amountKrw: 900_000, spentOn: "2025-07-12" } })
    ];

    const result = recordsScreenComparison({
      thisMonthServer: [serverRecord("aug-1", "2025-08-05", 300_000)],
      lastMonthServer: [serverRecord("jul-1", "2025-07-10", 100_000)],
      offlineRows
    });

    // 수정 전: 기준액 100,000원(서버 원본) 대 이번 달 300,000원 -> "200% 많이 썼어요".
    // 수정 후: 기준액 1,000,000원(= 100,000 + 미동기화 900,000) 대 300,000원.
    expect(result?.lastMonthToDateKrw).toBe(1_000_000);
    expect(result?.direction).toBe("less");
    expect(result?.text).toBe("지난달 같은 시점보다 70% 적게 썼어요.");
  });

  it("지난달 서버 행을 로컬에서 수정해 둔 상태면 기준액도 새 금액으로 본다 (낡은 서버 값 중복 금지)", () => {
    const offlineRows = [
      localRow({
        localId: "local-edit",
        canonicalId: "jul-1",
        payload: { amountKrw: 200_000, spentOn: "2025-07-10" }
      })
    ];

    const result = recordsScreenComparison({
      thisMonthServer: [serverRecord("aug-1", "2025-08-05", 200_000)],
      lastMonthServer: [serverRecord("jul-1", "2025-07-10", 800_000)],
      offlineRows
    });

    // 낡은 서버 행(800,000)은 숨고 로컬 값(200,000)만 센다 -- 이번 달 항과 같은 규칙.
    expect(result?.lastMonthToDateKrw).toBe(200_000);
    expect(result?.direction).toBe("same");
  });

  it("지난달 행에 삭제 대기가 걸려 있으면 기준액에서도 빠진다 (이미 취소한 지출로 비교하지 않는다)", () => {
    const offlineRows = [
      localRow({ localId: "local-del", canonicalId: "jul-2", pendingDelete: true, payload: { spentOn: "2025-07-11" } })
    ];

    const result = recordsScreenComparison({
      thisMonthServer: [serverRecord("aug-1", "2025-08-05", 100_000)],
      lastMonthServer: [serverRecord("jul-1", "2025-07-10", 100_000), serverRecord("jul-2", "2025-07-11", 500_000)],
      offlineRows
    });

    expect(result?.lastMonthToDateKrw).toBe(100_000);
    expect(result?.direction).toBe("same");
  });

  it("같은 종류의 레거시 로컬 행(expenseType 없음)이 두 항에서 똑같이 취급된다", () => {
    // 같은 금액·같은 일자의 레거시 로컬 행을 두 달에 하나씩 두면 결과는 '동일'이어야 한다.
    // 한쪽만 세던 시절에는 이 입력이 "100% 많이/적게"로 갈렸다.
    const offlineRows = [
      localRow({ localId: "local-jul-legacy", payload: { amountKrw: 60_000, spentOn: "2025-07-08" } }),
      localRow({ localId: "local-aug-legacy", payload: { amountKrw: 60_000, spentOn: "2025-08-08" } })
    ];
    expect(offlineRows[0].payload.expenseType).toBeUndefined();

    const result = recordsScreenComparison({ thisMonthServer: [], lastMonthServer: [], offlineRows });

    expect(result?.lastMonthToDateKrw).toBe(60_000);
    expect(result?.thisMonthToDateKrw).toBe(60_000);
    expect(result?.direction).toBe("same");
  });

  it("선물·환불 제외(DNC-015)는 두 항 모두에 그대로 걸린다", () => {
    const offlineRows = [
      localRow({ localId: "local-gift", payload: { amountKrw: 500_000, spentOn: "2025-07-09", expenseType: "gift" } })
    ];

    const result = recordsScreenComparison({
      thisMonthServer: [serverRecord("aug-1", "2025-08-05", 100_000), serverRecord("aug-gift", "2025-08-06", 400_000, "gift")],
      lastMonthServer: [serverRecord("jul-1", "2025-07-10", 100_000), serverRecord("jul-refund", "2025-07-11", 300_000, "refund")],
      offlineRows
    });

    expect(result?.lastMonthToDateKrw).toBe(100_000);
    expect(result?.thisMonthToDateKrw).toBe(100_000);
    expect(result?.direction).toBe("same");
  });

  it("로컬 대기 행이 없으면 예전과 동일한 결과다 (서버-서버 비교 회귀 없음)", () => {
    const result = recordsScreenComparison({
      thisMonthServer: [serverRecord("aug-1", "2025-08-05", 880_000)],
      lastMonthServer: [serverRecord("jul-1", "2025-07-01", 600_000), serverRecord("jul-2", "2025-07-15", 400_000), serverRecord("jul-3", "2025-07-20", 300_000)],
      offlineRows: []
    });

    expect(result?.lastMonthToDateKrw).toBe(1_000_000);
    expect(result?.text).toBe("지난달 같은 시점보다 12% 적게 썼어요.");
  });
});

describe("F3 기록 탭 배선 계약 (app/(tabs)/records.tsx)", () => {
  const recordsSource = readFileSync(join(process.cwd(), "app/(tabs)/records.tsx"), "utf8");

  it("지난달 목록에도 같은 재조정을 건다 -- 서버 목록 원본을 그대로 넘기지 않는다", () => {
    expect(recordsSource).toContain("reconcileMonthlyExpenses(lastMonthServerExpenses, childOfflineRows, lastYearMonth)");
    expect(recordsSource).toContain("lastMonthRecords: lastMonthComparableRecords");
    // 회귀 방지: 예전에는 서버 응답을 곧바로 비교 항으로 썼다.
    expect(recordsSource).not.toContain("lastMonthRecords: lastMonthExpenses.data?.expenses ?? null");
  });

  it("두 달 재조정이 같은 로컬 행 집합을 쓴다 (대칭의 전제)", () => {
    expect(recordsSource).toContain("const childOfflineRows = useMemo(");
    expect(recordsSource).toContain("reconcileMonthlyExpenses(serverExpenses ?? [], childOfflineRows, recordsYearMonth)");
  });
});
