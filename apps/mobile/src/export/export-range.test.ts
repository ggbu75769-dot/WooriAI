import { describe, expect, it } from "vitest";
import type { Expense } from "../api/client";
import {
  ALL_EMPTY_MONTH_STOP,
  ALL_MAX_MONTHS,
  collectExpensesForRange,
  EXPORT_RANGE_OPTIONS,
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
  it("offers exactly the three agreed range chips", () => {
    expect(EXPORT_RANGE_OPTIONS).toEqual([
      { value: "month", label: "이번 달" },
      { value: "year", label: "올해" },
      { value: "all", label: "전체" }
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

  it("올해 loops January through the current month to completion", async () => {
    expect(yearMonthsForRange("year", "2026-03-01")).toEqual(["2026-01", "2026-02", "2026-03"]);
    const { fetchMonth, calls } = fetcherFromPages({
      "2026-01": [makeExpense("2026-01-15")],
      "2026-03": [makeExpense("2026-03-05")]
    });
    const result = await collectExpensesForRange(fetchMonth, "year", "2026-03-20");
    expect(calls).toEqual(["2026-01", "2026-02", "2026-03"]);
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
});
