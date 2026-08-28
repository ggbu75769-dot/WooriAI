import { describe, expect, it } from "vitest";
import type { Expense } from "../api/client";
import {
  ALL_EMPTY_MONTH_STOP,
  ALL_MAX_MONTHS,
  canShiftCustomRange,
  collectExpensesForRange,
  CUSTOM_RANGE_MAX_MONTHS,
  customRangeBounds,
  customRangeLabel,
  defaultCustomRange,
  EXPORT_RANGE_OPTIONS,
  exportFileName,
  isExpenseInCustomRange,
  normalizeCustomRange,
  shiftCustomRange,
  yearMonthLabel,
  yearMonthsBetween,
  yearMonthsForRange
} from "./export-range";

function makeExpense(spentOn: string, itemName = "item"): Expense {
  return {
    id: `e-${spentOn}-${itemName}`,
    childId: "child-1",
    categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
    amountKrw: 1000,
    spentOn,
    itemName,
    merchant: null,
    memo: null,
    expenseType: "expense",
    source: "manual",
    version: 1
  };
}

function fetcherFromPages(pages: Record<string, Expense[]>) {
  const calls: string[] = [];
  const fetchMonth = async (yearMonth: string) => {
    calls.push(yearMonth);
    return pages[yearMonth] ?? [];
  };
  return { fetchMonth, calls };
}

describe("EXP-106 export range collection", () => {
  it("offers the three fixed range chips plus GAP-054 D#11's 직접 선택", () => {
    expect(EXPORT_RANGE_OPTIONS).toEqual([
      { value: "month", label: "이번 달" },
      { value: "year", label: "올해" },
      { value: "all", label: "전체" },
      { value: "custom", label: "직접 선택" }
    ]);
  });

  it("이번 달 fetches only the current Seoul yearMonth", async () => {
    expect(yearMonthsForRange("month", "2026-08-14")).toEqual(["2026-08"]);
    const { fetchMonth, calls } = fetcherFromPages({ "2026-08": [makeExpense("2026-08-02")] });
    const result = await collectExpensesForRange(fetchMonth, "month", "2026-08-14");
    expect(calls).toEqual(["2026-08"]);
    expect(result.expenses).toHaveLength(1);
    expect(result.truncated).toBe(false);
  });

  it("올해 loops the whole year to completion, newest month first (GAP-056 #9)", async () => {
    // 달 목록 자체는 오름차순 그대로다 -- 방향을 정하는 것은 수집기다.
    expect(yearMonthsForRange("year", "2026-03-01")).toEqual(["2026-01", "2026-02", "2026-03"]);
    const { fetchMonth, calls } = fetcherFromPages({
      "2026-01": [makeExpense("2026-01-15")],
      "2026-03": [makeExpense("2026-03-05")]
    });
    const result = await collectExpensesForRange(fetchMonth, "year", "2026-03-20");
    // GAP-056 #9: "전체"·"직접 선택"과 같은 걷기 방향(최신 달 우선). 결과는 종전대로 오름차순이다.
    expect(calls).toEqual(["2026-03", "2026-02", "2026-01"]);
    expect(result.monthsFetched).toBe(3);
    expect(result.expenses.map((expense) => expense.spentOn)).toEqual(["2026-01-15", "2026-03-05"]);
  });

  it("전체 walks backward across a year boundary and stops after the empty-month streak", async () => {
    const { fetchMonth, calls } = fetcherFromPages({
      "2026-02": [makeExpense("2026-02-01")],
      "2025-11": [makeExpense("2025-11-20"), makeExpense("2025-11-02")]
    });
    const result = await collectExpensesForRange(fetchMonth, "all", "2026-02-10");
    // Walks 2026-02, 2026-01, 2025-12, 2025-11, then 12 consecutive empty months and stops.
    expect(calls[0]).toBe("2026-02");
    expect(calls).toContain("2025-11");
    expect(calls[calls.length - 1]).toBe("2024-11");
    expect(result.monthsFetched).toBe(4 + ALL_EMPTY_MONTH_STOP);
    // Sorted ascending by spentOn regardless of newest-first fetch order.
    expect(result.expenses.map((expense) => expense.spentOn)).toEqual(["2025-11-02", "2025-11-20", "2026-02-01"]);
    expect(result.truncated).toBe(false);
  });

  it("전체 never walks farther back than ALL_MAX_MONTHS even if every month has data", async () => {
    const fetchMonth = async (yearMonth: string) => [makeExpense(`${yearMonth}-01`)];
    const result = await collectExpensesForRange(fetchMonth, "all", "2026-08-14", { maxRows: 100000 });
    expect(result.monthsFetched).toBe(ALL_MAX_MONTHS);
    expect(result.expenses).toHaveLength(ALL_MAX_MONTHS);
  });

  it("caps collected rows at maxRows, keeps the newest months for 전체, and flags truncation", async () => {
    const fetchMonth = async (yearMonth: string) => [
      makeExpense(`${yearMonth}-01`, "a"),
      makeExpense(`${yearMonth}-02`, "b")
    ];
    const result = await collectExpensesForRange(fetchMonth, "all", "2026-08-14", { maxRows: 3 });
    expect(result.truncated).toBe(true);
    expect(result.expenses).toHaveLength(3);
    // Newest-first walk means the cap keeps the most recent months (2026-08, part of 2026-07).
    expect(result.expenses.map((expense) => expense.spentOn)).toEqual(["2026-07-01", "2026-08-01", "2026-08-02"]);
  });

  it("올해 flags truncation only when rows are actually dropped", async () => {
    const pages: Record<string, Expense[]> = {
      "2026-01": [makeExpense("2026-01-01", "a"), makeExpense("2026-01-02", "b")]
    };
    const { fetchMonth } = fetcherFromPages(pages);
    const exact = await collectExpensesForRange(fetchMonth, "year", "2026-02-10", { maxRows: 2 });
    expect(exact.truncated).toBe(false);
    expect(exact.expenses).toHaveLength(2);

    const over = await collectExpensesForRange(fetchMonth, "year", "2026-02-10", { maxRows: 1 });
    expect(over.truncated).toBe(true);
    expect(over.expenses).toHaveLength(1);
  });

  /**
   * GAP-056 #9 — 닫힌 구간("이번 달"·"올해")의 절단 방향.
   *
   * 예전에는 1월부터 오름차순으로 모은 뒤 뒤를 잘라, 상한에 걸린 "올해"가 **1월·2월만 담고
   * 이번 달을 버렸다**. "전체"·"직접 선택"은 이미 반대(최신 우선)라, 같은 앱 안에서 구간마다
   * 잘리는 쪽이 달랐다. 세 구간이 한 규칙("오래된 쪽이 빠진다")임을 여기서 고정한다.
   */
  describe("GAP-056 #9 올해 절단 방향", () => {
    const yearPages = async (yearMonth: string) => [
      makeExpense(`${yearMonth}-01`, "a"),
      makeExpense(`${yearMonth}-02`, "b")
    ];

    it("상한에 걸리면 최근 달이 남고 오래된 달이 빠진다 (전체 구간과 같은 규칙)", async () => {
      const result = await collectExpensesForRange(yearPages, "year", "2026-04-10", { maxRows: 3 });
      expect(result.truncated).toBe(true);
      expect(result.expenses).toHaveLength(3);
      // 4월(2건) + 3월(1건). 1월·2월은 요청조차 하지 않는다 -- 어차피 버릴 행이다.
      expect(result.expenses.map((expense) => expense.spentOn)).toEqual([
        "2026-03-01",
        "2026-04-01",
        "2026-04-02"
      ]);
      expect(result.monthsFetched).toBe(2);
    });

    it("가장 오래된 달에서 정확히 상한에 닿으면 잃은 것이 없으므로 잘림을 알리지 않는다", async () => {
      // 2026-01 ~ 2026-03, 달마다 2건 = 6건.
      const result = await collectExpensesForRange(yearPages, "year", "2026-03-10", { maxRows: 6 });
      expect(result.truncated).toBe(false);
      expect(result.expenses).toHaveLength(6);
      expect(result.monthsFetched).toBe(3);
    });

    it("빈 달은 상한 판정에 끼어들지 않고 그대로 지나간다", async () => {
      const { fetchMonth, calls } = fetcherFromPages({
        "2026-01": [makeExpense("2026-01-09")],
        "2026-05": [makeExpense("2026-05-09")]
      });
      const result = await collectExpensesForRange(fetchMonth, "year", "2026-05-31");
      expect(calls).toEqual(["2026-05", "2026-04", "2026-03", "2026-02", "2026-01"]);
      expect(result.truncated).toBe(false);
      expect(result.expenses.map((expense) => expense.spentOn)).toEqual(["2026-01-09", "2026-05-09"]);
    });

    /**
     * 라운드 57 QA(P2-12) — **세 갈래가 한 규칙을 쓴다(관측 사실 기반).**
     *
     * `truncated`는 "행을 실제로 버렸다(> maxRows)" 또는 "상한 때문에 멈춘 시점에 **아직 열어
     * 보지 않은** 과거 달이 남았다"이다. 앞의 두 테스트가 그 두 항을 각각 잡고, 아래 두 개는
     * 예전에 갈라져 있던 자리를 잡는다.
     */
    it("아직 열어 보지 않은 과거 달이 남으면 알린다 -- 그 달이 비어 있을 수도 있어 문구가 '있을 수 있어요'다", async () => {
      // 3월에 2건, 그 앞(1~2월)은 열어 보지도 않은 채 상한에 닿는다.
      const result = await collectExpensesForRange(yearPages, "year", "2026-03-10", { maxRows: 4 });
      expect(result.truncated).toBe(true);
      expect(result.monthsFetched).toBe(2);
      expect(result.expenses).toHaveLength(4);
    });

    it("'전체'도 같은 규칙이다 -- 정확히 상한에 닿아도 남은 과거 달이 있으면 알린다", async () => {
      const { fetchMonth } = fetcherFromPages({
        "2026-08": [makeExpense("2026-08-01", "a"), makeExpense("2026-08-02", "b")]
      });
      const result = await collectExpensesForRange(fetchMonth, "all", "2026-08-14", { maxRows: 2 });
      // 버린 행은 없지만 8월 앞을 아직 열어 보지 않았다 -- 그 사실을 삼키면 진짜 조용한 손실이 된다.
      expect(result.truncated).toBe(true);
      expect(result.monthsFetched).toBe(1);
      expect(result.expenses).toHaveLength(2);
    });

    it("한 달짜리 '이번 달' 구간은 방향이 바뀌어도 종전과 같다", async () => {
      const { fetchMonth, calls } = fetcherFromPages({
        "2026-08": [makeExpense("2026-08-01", "a"), makeExpense("2026-08-02", "b")]
      });
      const result = await collectExpensesForRange(fetchMonth, "month", "2026-08-14", { maxRows: 2 });
      expect(calls).toEqual(["2026-08"]);
      expect(result.truncated).toBe(false);
      expect(result.expenses).toHaveLength(2);
    });
  });
});

/**
 * GAP-054 D#11 — 사용자 지정 기간.
 *
 * 고정 3구간으로는 "작년 11월~올해 1월"(조리원 정산)이나 "작년 한 해"(연말정산)를 만들 수
 * 없었다. 경계 규칙(미래 달 금지·시작>끝 금지·길이 상한)과 파일 이름·행 필터가 전부 이
 * 순수 모듈에 있는지를 고정한다.
 */
describe("GAP-054 D#11 사용자 지정 기간", () => {
  const today = "2026-08-14";

  it("기본값은 이번 달 한 달 -- 고정 '이번 달' 구간과 같은 자리에서 시작한다", () => {
    expect(defaultCustomRange(today)).toEqual({ startYearMonth: "2026-08", endYearMonth: "2026-08" });
    expect(customRangeBounds(today)).toEqual({ earliest: "2016-09", latest: "2026-08" });
    expect(yearMonthLabel("2026-08")).toBe("2026년 8월");
    expect(customRangeLabel({ startYearMonth: "2026-08", endYearMonth: "2026-08" })).toBe("2026년 8월");
    expect(customRangeLabel({ startYearMonth: "2025-11", endYearMonth: "2026-01" })).toBe("2025년 11월~2026년 1월");
  });

  it("미래 달은 이번 달로 당기고, 형식이 깨진 값도 이번 달로 접는다", () => {
    expect(normalizeCustomRange({ startYearMonth: "2027-03", endYearMonth: "2027-05" }, today)).toEqual({
      startYearMonth: "2026-08",
      endYearMonth: "2026-08"
    });
    for (const broken of [null, undefined, {}, { startYearMonth: "2026-13", endYearMonth: "abc" }]) {
      expect(normalizeCustomRange(broken, today)).toEqual({ startYearMonth: "2026-08", endYearMonth: "2026-08" });
    }
  });

  it("시작>끝이면 잘라 버리지 않고 맞바꾼다 (고른 두 달이 그대로 양 끝으로 남는다)", () => {
    expect(normalizeCustomRange({ startYearMonth: "2026-06", endYearMonth: "2026-02" }, today)).toEqual({
      startYearMonth: "2026-02",
      endYearMonth: "2026-06"
    });
  });

  it("길이 상한을 넘으면 최근 쪽을 남기고 시작 달을 당긴다", () => {
    const normalized = normalizeCustomRange({ startYearMonth: "1990-01", endYearMonth: "2026-08" }, today);
    expect(normalized.endYearMonth).toBe("2026-08");
    expect(yearMonthsBetween(normalized)).toHaveLength(CUSTOM_RANGE_MAX_MONTHS);
    // 절대 하한(customRangeBounds.earliest)과 같은 자리다 -- 두 규칙이 갈리지 않는다.
    expect(normalized.startYearMonth).toBe(customRangeBounds(today).earliest);
  });

  it("화살표가 시작>끝과 미래 달을 애초에 막는다 (경계에서 눌러도 값이 안 움직인다)", () => {
    const oneMonth = { startYearMonth: "2026-08", endYearMonth: "2026-08" };
    // 시작은 끝을 넘지 못한다.
    expect(canShiftCustomRange(oneMonth, "start", 1, today)).toBe(false);
    expect(shiftCustomRange(oneMonth, "start", 1, today)).toEqual(oneMonth);
    // 끝은 시작 아래로 내려가지 못한다.
    expect(canShiftCustomRange(oneMonth, "end", -1, today)).toBe(false);
    expect(shiftCustomRange(oneMonth, "end", -1, today)).toEqual(oneMonth);
    // 끝은 이번 달을 넘지 못한다(기록/리포트 탭의 "다음 기간" 잠금과 같은 규칙).
    expect(canShiftCustomRange(oneMonth, "end", 1, today)).toBe(false);
    // 과거로 넓히는 방향은 열려 있다.
    expect(canShiftCustomRange(oneMonth, "start", -1, today)).toBe(true);
    expect(shiftCustomRange(oneMonth, "start", -1, today)).toEqual({
      startYearMonth: "2026-07",
      endYearMonth: "2026-08"
    });
    // 한 쪽을 옮겨도 반대쪽 달은 사용자가 고른 그대로다.
    const widened = shiftCustomRange({ startYearMonth: "2025-11", endYearMonth: "2026-01" }, "start", -1, today);
    expect(widened).toEqual({ startYearMonth: "2025-10", endYearMonth: "2026-01" });
    // 절대 하한에서는 더 내려가지 않는다.
    const earliest = customRangeBounds(today).earliest;
    expect(canShiftCustomRange({ startYearMonth: earliest, endYearMonth: "2026-08" }, "start", -1, today)).toBe(false);
  });

  it("연 경계를 넘는 범위의 달 목록을 오름차순으로 만든다", () => {
    expect(yearMonthsBetween({ startYearMonth: "2025-11", endYearMonth: "2026-01" })).toEqual([
      "2025-11",
      "2025-12",
      "2026-01"
    ]);
    expect(yearMonthsBetween({ startYearMonth: "2026-03", endYearMonth: "2026-03" })).toEqual(["2026-03"]);
    // 뒤집힌 범위는 여기서 지어내지 않는다(정규화가 이미 막았다).
    expect(yearMonthsBetween({ startYearMonth: "2026-05", endYearMonth: "2026-02" })).toEqual([]);
    expect(yearMonthsForRange("custom", today, { startYearMonth: "2025-12", endYearMonth: "2026-02" })).toEqual([
      "2025-12",
      "2026-01",
      "2026-02"
    ]);
    // custom을 넘기지 않으면 이번 달 한 달(없는 달을 요청하지 않는다).
    expect(yearMonthsForRange("custom", today)).toEqual(["2026-08"]);
  });

  it("고른 달만 수집하고, 범위 밖 행은 CSV에 실리지 않는다", async () => {
    const { fetchMonth, calls } = fetcherFromPages({
      "2025-12": [makeExpense("2025-12-24")],
      "2026-01": [makeExpense("2026-01-05"), makeExpense("2026-02-01", "leaked")],
      "2026-02": [makeExpense("2026-02-14")]
    });
    const result = await collectExpensesForRange(fetchMonth, "custom", today, {
      custom: { startYearMonth: "2025-12", endYearMonth: "2026-02" }
    });
    // 라운드 54 P2-10: 요청은 **최신 달부터 거슬러** 나간다("전체" 구간과 같은 걷기 방향) --
    // 연속 빈 달에서 멈추는 규칙이 "기록이 시작되기 전"에 도달했다는 뜻이 되려면 이 방향이어야
    // 한다. 결과 목록은 종전대로 날짜 오름차순이다.
    expect(calls).toEqual(["2026-02", "2026-01", "2025-12"]);
    expect(result.monthsFetched).toBe(3);
    // 양 끝 달은 포함(닫힌 구간)이고, 그 앞뒤 달은 요청조차 하지 않는다.
    expect(result.expenses.map((expense) => expense.spentOn)).toEqual([
      "2025-12-24",
      "2026-01-05",
      "2026-02-01",
      "2026-02-14"
    ]);
    // 행 필터: 2026-01 페이지에 섞여 온 2월 행은 범위 안이라 남고,
    expect(isExpenseInCustomRange({ spentOn: "2026-02-01" }, { startYearMonth: "2025-12", endYearMonth: "2026-02" })).toBe(
      true
    );
    // 범위 밖(구간 앞뒤 한 달)은 걸러진다.
    for (const spentOn of ["2025-11-30", "2026-03-01"]) {
      expect(isExpenseInCustomRange({ spentOn }, { startYearMonth: "2025-12", endYearMonth: "2026-02" })).toBe(false);
    }
  });

  it("페처가 범위 밖 달의 행을 섞어 보내도 CSV로 나가지 않는다 (마지막 방어선)", async () => {
    const fetchMonth = async (yearMonth: string) => [makeExpense(`${yearMonth}-01`), makeExpense("2024-01-01", "old")];
    const result = await collectExpensesForRange(fetchMonth, "custom", today, {
      custom: { startYearMonth: "2026-07", endYearMonth: "2026-08" }
    });
    expect(result.expenses.map((expense) => expense.spentOn)).toEqual(["2026-07-01", "2026-08-01"]);
  });

  it("행 상한은 고정 구간과 같은 규칙으로 걸리고 잘림을 알린다", async () => {
    const fetchMonth = async (yearMonth: string) => [makeExpense(`${yearMonth}-01`), makeExpense(`${yearMonth}-02`)];
    const result = await collectExpensesForRange(fetchMonth, "custom", today, {
      custom: { startYearMonth: "2026-06", endYearMonth: "2026-08" },
      maxRows: 3
    });
    expect(result.truncated).toBe(true);
    expect(result.expenses).toHaveLength(3);
  });

  /**
   * GAP-054 라운드 54 P2-10 — 넓게 고른 기간에 120번의 왕복을 물리지 않는다.
   *
   * "전체" 구간이 이미 쓰는 규칙(ALL_EMPTY_MONTH_STOP 연속 빈 달에서 중단)을 그대로 가져오되,
   * 방향이 핵심이다: **최신 달부터** 거슬러 올라가며 멈춘다. 오래된 쪽부터 올라오며 멈추면
   * 아직 안 본 최신 달의 기록이 통째로 빠지는 조용한 데이터 손실이 된다.
   */
  it("연속 빈 달에서 멈춘다 -- 기록보다 훨씬 넓게 고른 기간이 전 구간을 요청하지 않는다", async () => {
    const { fetchMonth, calls } = fetcherFromPages({ "2026-08": [makeExpense("2026-08-03")] });
    const result = await collectExpensesForRange(fetchMonth, "custom", today, {
      // 2016-09 ~ 2026-08 = 120개월. 기록은 이번 달 한 건뿐이다.
      custom: { startYearMonth: customRangeBounds(today).earliest, endYearMonth: "2026-08" }
    });

    // 2026-08(1건) + 그 앞 연속 빈 달 12개 = 13번에서 멈춘다(120번이 아니다).
    expect(result.monthsFetched).toBe(1 + ALL_EMPTY_MONTH_STOP);
    expect(calls[0]).toBe("2026-08");
    expect(calls.at(-1)).toBe("2025-08");
    expect(result.expenses.map((expense) => expense.spentOn)).toEqual(["2026-08-03"]);
    // 멈춘 것은 왕복이지 결과가 아니다 -- 버린 행이 없으므로 잘림을 알리지 않는다.
    expect(result.truncated).toBe(false);
  });

  it("공백이 12개월에 못 미치면 계속 따라간다(중단이 멀쩡한 기록을 삼키지 않는다)", async () => {
    const { fetchMonth } = fetcherFromPages({
      "2026-08": [makeExpense("2026-08-03")],
      // 2025-10 ~ 2026-07 = 10개월 공백(상한 12 미만)이라 그 너머까지 간다.
      "2025-09": [makeExpense("2025-09-11")]
    });
    const result = await collectExpensesForRange(fetchMonth, "custom", today, {
      custom: { startYearMonth: "2025-09", endYearMonth: "2026-08" }
    });

    expect(result.monthsFetched).toBe(12);
    expect(result.expenses.map((expense) => expense.spentOn)).toEqual(["2025-09-11", "2026-08-03"]);
  });

  it("파일 이름은 고른 기간을 담고, 개인 정보는 담지 않는다", () => {
    expect(exportFileName({ range: "month", todaySeoul: today })).toBe("우리아이-지출-2026-08.csv");
    expect(exportFileName({ range: "year", todaySeoul: today })).toBe("우리아이-지출-2026.csv");
    expect(exportFileName({ range: "all", todaySeoul: today })).toBe("우리아이-지출-전체.csv");
    expect(
      exportFileName({ range: "custom", todaySeoul: today, custom: { startYearMonth: "2025-11", endYearMonth: "2026-01" } })
    ).toBe("우리아이-지출-2025-11~2026-01.csv");
    // 한 달이면 물결 없이 그 달 하나만.
    expect(
      exportFileName({ range: "custom", todaySeoul: today, custom: { startYearMonth: "2026-03", endYearMonth: "2026-03" } })
    ).toBe("우리아이-지출-2026-03.csv");
    // 뒤집힌/미래 입력도 정규화된 범위 그대로 이름이 된다(화면과 파일 이름이 갈리지 않는다).
    expect(
      exportFileName({ range: "custom", todaySeoul: today, custom: { startYearMonth: "2026-06", endYearMonth: "2026-02" } })
    ).toBe("우리아이-지출-2026-02~2026-06.csv");
  });

  it("고정 3구간의 동작은 D#11 이전과 한 글자도 다르지 않다", async () => {
    const { fetchMonth, calls } = fetcherFromPages({ "2026-08": [makeExpense("2026-08-02")] });
    // custom 옵션을 함께 넘겨도 고정 구간에서는 무시된다.
    const result = await collectExpensesForRange(fetchMonth, "month", today, {
      custom: { startYearMonth: "2020-01", endYearMonth: "2020-12" }
    });
    expect(calls).toEqual(["2026-08"]);
    expect(result.expenses).toHaveLength(1);
    expect(yearMonthsForRange("year", "2026-03-01", { startYearMonth: "2020-01", endYearMonth: "2020-02" })).toEqual([
      "2026-01",
      "2026-02",
      "2026-03"
    ]);
  });
});
