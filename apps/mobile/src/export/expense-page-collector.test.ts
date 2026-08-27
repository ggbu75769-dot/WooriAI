import { describe, expect, it } from "vitest";
import type { Expense, ListExpensesResponse } from "../api/client";
import {
  collectExpensePages,
  EXPORT_MAX_PAGES_PER_MONTH,
  ExpensePageCollectionError
} from "./expense-page-collector";

/**
 * CSV-124: API-124의 keyset 페이지네이션(기본 200 · 상한 500건) 위에서 CSV 내보내기가 전량을
 * 담는지 잠근다. 회귀 시나리오는 "월 200건 초과 사용자의 CSV가 첫 페이지만 담고 잘림"이다.
 */

function makeExpense(id: string, spentOn = "2026-08-02"): Expense {
  return {
    id,
    childId: "child-1",
    categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
    amountKrw: 1000,
    spentOn,
    itemName: id,
    merchant: null,
    memo: null,
    expenseType: "expense",
    source: "manual",
    version: 1
  };
}

/** 커서로 이어지는 가짜 서버. 각 페이지는 [응답, 그 페이지를 얻기 위해 보낸 커서]로 검증한다. */
function fetcherFromPages(pages: ListExpensesResponse[]) {
  const cursors: Array<string | undefined> = [];
  let index = 0;
  const fetchPage = async (cursor: string | undefined) => {
    cursors.push(cursor);
    const page = pages[index];
    index += 1;
    if (!page) throw new Error(`unexpected extra page request (cursor=${String(cursor)})`);
    return page;
  };
  return { fetchPage, cursors };
}

describe("CSV-124 expense page collection", () => {
  it("hasMore가 true인 동안 nextCursor로 이어 2페이지 전량을 모은다", async () => {
    const { fetchPage, cursors } = fetcherFromPages([
      { expenses: [makeExpense("e1"), makeExpense("e2")], totalAmountKrw: 4000, hasMore: true, nextCursor: "cursor-1" },
      { expenses: [makeExpense("e3")], totalAmountKrw: 4000, hasMore: false, nextCursor: null }
    ]);

    const result = await collectExpensePages(fetchPage);

    // 첫 요청은 커서 없이, 두 번째는 직전 응답의 nextCursor를 그대로 실어 보낸다.
    expect(cursors).toEqual([undefined, "cursor-1"]);
    expect(result.pagesFetched).toBe(2);
    expect(result.expenses.map((expense) => expense.id)).toEqual(["e1", "e2", "e3"]);
    // 페이지 합(2000+2000)이 아니라 서버가 준 범위 전체 집계를 그대로 쓴다.
    expect(result.totalAmountKrw).toBe(4000);
  });

  it("hasMore가 없으면(페이지네이션 이전 서버·로컬 목업) 첫 페이지에서 자연 종료한다", async () => {
    const { fetchPage, cursors } = fetcherFromPages([
      { expenses: [makeExpense("e1")], totalAmountKrw: 1000 }
    ]);

    const result = await collectExpensePages(fetchPage);

    expect(cursors).toEqual([undefined]);
    expect(result.pagesFetched).toBe(1);
    expect(result.expenses).toHaveLength(1);
  });

  it("hasMore가 false면 nextCursor가 남아 있어도 더 요청하지 않는다", async () => {
    const { fetchPage } = fetcherFromPages([
      { expenses: [makeExpense("e1")], totalAmountKrw: 1000, hasMore: false, nextCursor: "cursor-1" }
    ]);

    const result = await collectExpensePages(fetchPage);

    expect(result.pagesFetched).toBe(1);
  });

  it("안전 상한을 넘으면 조용히 자르지 않고 명시적 오류로 중단한다", async () => {
    // 언제나 hasMore=true인, 끝나지 않는 서버.
    let issued = 0;
    const fetchPage = async () => {
      issued += 1;
      return {
        expenses: [makeExpense(`e${issued}`)],
        totalAmountKrw: 1000,
        hasMore: true,
        nextCursor: `cursor-${issued}`
      };
    };

    await expect(collectExpensePages(fetchPage, { maxPages: 3 })).rejects.toBeInstanceOf(ExpensePageCollectionError);
    expect(issued).toBe(3);
    // 기본 상한도 유한하다 -- 무한 루프로 앱이 매달리는 일이 없어야 한다.
    expect(EXPORT_MAX_PAGES_PER_MONTH).toBeGreaterThan(1);
    expect(Number.isFinite(EXPORT_MAX_PAGES_PER_MONTH)).toBe(true);
  });

  it("hasMore는 true인데 nextCursor가 없으면 부분 결과를 성공으로 위장하지 않는다", async () => {
    const { fetchPage } = fetcherFromPages([
      { expenses: [makeExpense("e1")], totalAmountKrw: 1000, hasMore: true, nextCursor: null }
    ]);

    await expect(collectExpensePages(fetchPage)).rejects.toBeInstanceOf(ExpensePageCollectionError);
  });

  it("커서가 제자리를 맴돌면 무한 루프 대신 오류로 끊는다", async () => {
    const fetchPage = async () => ({
      expenses: [makeExpense("e1")],
      totalAmountKrw: 1000,
      hasMore: true,
      nextCursor: "same-cursor"
    });

    await expect(collectExpensePages(fetchPage)).rejects.toBeInstanceOf(ExpensePageCollectionError);
  });

  it("페이지 경계가 겹쳐도 같은 지출이 CSV에 두 번 들어가지 않는다", async () => {
    const { fetchPage } = fetcherFromPages([
      { expenses: [makeExpense("e1"), makeExpense("e2")], totalAmountKrw: 3000, hasMore: true, nextCursor: "cursor-1" },
      { expenses: [makeExpense("e2"), makeExpense("e3")], totalAmountKrw: 3000, hasMore: false, nextCursor: null }
    ]);

    const result = await collectExpensePages(fetchPage);

    expect(result.expenses.map((expense) => expense.id)).toEqual(["e1", "e2", "e3"]);
  });

  it("월 200건 초과 회귀: 3페이지(500+500+30)를 모두 담는다", async () => {
    const page = (start: number, count: number) =>
      Array.from({ length: count }, (_, offset) => makeExpense(`e${start + offset}`));
    const { fetchPage } = fetcherFromPages([
      { expenses: page(1, 500), totalAmountKrw: 1_030_000, hasMore: true, nextCursor: "c1" },
      { expenses: page(501, 500), totalAmountKrw: 1_030_000, hasMore: true, nextCursor: "c2" },
      { expenses: page(1001, 30), totalAmountKrw: 1_030_000, hasMore: false, nextCursor: null }
    ]);

    const result = await collectExpensePages(fetchPage);

    expect(result.expenses).toHaveLength(1030);
    expect(result.pagesFetched).toBe(3);
  });
});
