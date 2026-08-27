import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPENSE_LIST_MAX_LIMIT, type Expense, type ListExpensesResponse } from "../api/client";
import { ExpensePageCollectionError } from "../export/expense-page-collector";
import { evaluateLastMonthComparison } from "../home/last-month-comparison";
import { reconcileMonthlyExpenses } from "../offline/expense-list-reconciliation";
import { fetchMonthExpenses } from "./month-expenses";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * REC-124(H1): API-124가 지출 목록에 keyset 페이지네이션(기본 200 · 상한 500건)을 넣은 뒤로,
 * 기록 탭과 홈은 첫 페이지만 읽고 있었다. 정렬이 `spentOn desc`라 **잘리는 쪽은 그 달의 앞날짜**라
 * 두 가지 허위 표시가 났다:
 *  1) 기록 탭 "이번 달 N건 · 합계 X원"이 200건/그 합계까지만 센다.
 *  2) "지난달 같은 시점 대비" 한 줄의 기준(1일~오늘)이 통째로 잘려나가 0원이 되고,
 *     "지난달 같은 시점까지는 지출 기록이 없었어요"라는 없는 사실을 말한다.
 *
 * 화면은 vitest에서 렌더할 수 없으므로(이 저장소의 제약) queryFn에 넘기는 페처를 순수 모듈로
 * 분리해 여기서 고정하고, 세 호출부가 실제로 그 페처를 쓰는지는 소스 grep 계약으로 잠근다 --
 * src/export/expense-page-collector.test.ts / status-mutation-messages.test.ts와 같은 관례.
 */

const YEAR_MONTH = "2026-07";

function makeExpense(id: string, spentOn: string, amountKrw = 10_000): Expense {
  return {
    id,
    childId: "child-1",
    categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
    amountKrw,
    spentOn,
    itemName: id,
    merchant: null,
    memo: null,
    expenseType: "expense",
    source: "manual",
    version: 1
  };
}

/** `spentOn desc` 서버 정렬 그대로: 말일부터 거꾸로 채운 한 달치 행. */
function monthOfExpenses(count: number, amountKrw = 10_000): Expense[] {
  return Array.from({ length: count }, (_, index) => {
    const day = 31 - Math.floor((index * 30) / count); // 31일 -> 1일로 내려간다
    return makeExpense(`e${index}`, `${YEAR_MONTH}-${String(day).padStart(2, "0")}`, amountKrw);
  });
}

/** 커서로 이어지는 가짜 서버. 요청마다 받은 {limit, cursor}를 그대로 기록한다. */
function pagedFetcher(all: Expense[], pageSize: number, totalAmountKrw: number) {
  const requests: Array<{ limit: number; cursor?: string }> = [];
  const fetchPage = async (page: { limit: number; cursor?: string }): Promise<ListExpensesResponse> => {
    requests.push(page);
    const offset = page.cursor ? Number(page.cursor) : 0;
    const slice = all.slice(offset, offset + pageSize);
    const nextOffset = offset + slice.length;
    const hasMore = nextOffset < all.length;
    return {
      expenses: slice,
      totalAmountKrw,
      hasMore,
      nextCursor: hasMore ? String(nextOffset) : null
    };
  };
  return { fetchPage, requests };
}

describe("REC-124(H1) 한 달 지출 전량 수집", () => {
  it("200건을 넘는 달도 커서를 끝까지 이어 전량을 모은다", async () => {
    const all = monthOfExpenses(300);
    const { fetchPage, requests } = pagedFetcher(all, 200, 3_000_000);

    const result = await fetchMonthExpenses(fetchPage);

    expect(result.expenses).toHaveLength(300);
    expect(result.expenses.map((expense) => expense.id)).toEqual(all.map((expense) => expense.id));
    // 서버 집계 totalAmountKrw는 노출하지 않는다 -- 화면 합계는 오프라인 대기 행을 포함하는
    // reconcileMonthlyExpenses가 계산하며, 여기서 서버 값을 내보내면 소스 비대칭(F3)이 재생산된다.
    expect("totalAmountKrw" in result).toBe(false);
    // 요청은 항상 서버 상한 limit으로 나가고, 두 번째부터 직전 nextCursor를 싣는다.
    expect(requests).toEqual([
      { limit: EXPENSE_LIST_MAX_LIMIT, cursor: undefined },
      { limit: EXPENSE_LIST_MAX_LIMIT, cursor: "200" }
    ]);
  });

  it("한 페이지로 끝나거나 hasMore가 없으면(로컬 목업) 요청 한 번으로 끝난다 -- 동작 불변", async () => {
    const all = monthOfExpenses(12);
    const { fetchPage, requests } = pagedFetcher(all, 500, 120_000);
    expect((await fetchMonthExpenses(fetchPage)).expenses).toHaveLength(12);
    expect(requests).toHaveLength(1);

    // 로컬 백엔드는 limit/cursor를 무시하고 hasMore도 붙이지 않는다.
    let calls = 0;
    const localLike = async (): Promise<ListExpensesResponse> => {
      calls += 1;
      return { expenses: all, totalAmountKrw: 120_000 };
    };
    const collected = await fetchMonthExpenses(localLike);
    expect(calls).toBe(1);
    expect(collected.expenses).toHaveLength(12);
  });

  it("전량을 모으지 못하면 부분 목록을 성공으로 위장하지 않고 오류를 던진다", async () => {
    // hasMore는 true인데 커서가 없다 = 이어 붙일 방법이 없다. react-query의 기존 오류 경로
    // (기록 탭 "불러오지 못했어요" 재시도 카드)로 나가야 한다.
    const brokenPager = async (): Promise<ListExpensesResponse> => ({
      expenses: monthOfExpenses(200),
      totalAmountKrw: 2_000_000,
      hasMore: true,
      nextCursor: null
    });

    await expect(fetchMonthExpenses(brokenPager)).rejects.toBeInstanceOf(ExpensePageCollectionError);
  });

  it("전량 수집이라야 기록 탭 건수·합계가 맞는다 (첫 페이지만 읽으면 과소 표시)", async () => {
    const all = monthOfExpenses(300, 10_000);
    const { fetchPage } = pagedFetcher(all, 200, 3_000_000);

    const collected = await fetchMonthExpenses(fetchPage);
    const reconciled = reconcileMonthlyExpenses(collected.expenses, [], YEAR_MONTH);
    expect(reconciled.visibleServerExpenses).toHaveLength(300);
    expect(reconciled.monthlyTotalKrw).toBe(3_000_000);

    // 회귀 전 동작(첫 페이지만): 100건과 1,000,000원이 통째로 빠졌다.
    const firstPageOnly = reconcileMonthlyExpenses(all.slice(0, 200), [], YEAR_MONTH);
    expect(firstPageOnly.monthlyTotalKrw).toBe(2_000_000);
    expect(firstPageOnly.monthlyTotalKrw).toBeLessThan(reconciled.monthlyTotalKrw);
  });

  it("전량 수집이라야 '지난달 같은 시점' 비교가 허위 문장으로 새지 않는다", async () => {
    // spentOn desc 정렬에서 첫 페이지(200건)는 말일 쪽이다 -- 1~15일 행은 전부 두 번째 페이지에
    // 몰려 있어, 첫 페이지만 읽으면 "15일까지의 지난달 합계"가 0원이 된다.
    const all = [
      ...Array.from({ length: 200 }, (_, index) => makeExpense(`late-${index}`, `${YEAR_MONTH}-25`, 10_000)),
      ...Array.from({ length: 100 }, (_, index) => makeExpense(`early-${index}`, `${YEAR_MONTH}-10`, 10_000))
    ];
    const { fetchPage } = pagedFetcher(all, 200, 3_000_000);
    const collected = await fetchMonthExpenses(fetchPage);

    const input = { todayIso: "2026-08-15", thisMonthToDateKrw: 500_000 };
    const truncated = evaluateLastMonthComparison({ ...input, lastMonthRecords: all.slice(0, 200) });
    const full = evaluateLastMonthComparison({ ...input, lastMonthRecords: collected.expenses });

    // 회귀 전: 기준이 0원이라 "기록이 없었어요"라는 없는 사실을 말했다.
    expect(truncated?.direction).toBe("no-baseline");
    expect(truncated?.text).toBe("지난달 같은 시점까지는 지출 기록이 없었어요.");
    // 수정 후: 15일까지의 실제 기준액(1,000,000원)과 비교한다.
    expect(full?.direction).toBe("less");
    expect(full?.lastMonthToDateKrw).toBe(1_000_000);
    expect(full?.percent).toBe(50);
  });
});

describe("REC-124(H1) 화면 배선 계약", () => {
  const records = source("app/(tabs)/records.tsx");
  const home = source("app/(tabs)/index.tsx");

  it("기록 탭의 이번 달·지난달 조회가 모두 전량 수집을 거친다", () => {
    expect(records).toContain('from "../../src/expenses/month-expenses"');
    expect(records).toContain(
      "fetchMonthExpenses((page) => listExpenses(authToken!, childId!, recordsYearMonth, page))"
    );
    expect(records).toContain(
      "fetchMonthExpenses((page) => listExpenses(authToken!, childId!, lastYearMonth!, page))"
    );
  });

  it("홈의 지난달 조회도 같은 페처를 쓴다 (공유 캐시의 내용이 화면마다 달라지지 않는다)", () => {
    expect(home).toContain('from "../../src/expenses/month-expenses"');
    expect(home).toContain(
      "fetchMonthExpenses((page) => listExpenses(authToken!, childId!, lastYearMonth!, page))"
    );
  });

  it("첫 페이지만 읽는 3-인자 호출이 화면에 남아 있지 않다", () => {
    for (const [path, screenSource] of [
      ["app/(tabs)/records.tsx", records],
      ["app/(tabs)/index.tsx", home]
    ] as const) {
      expect(screenSource, `${path} must not read only the first page`).not.toMatch(
        /listExpenses\(authToken!, childId!, [A-Za-z]+!?\)/
      );
    }
  });

  it("수집 루프는 CSV 내보내기와 같은 한 벌을 쓴다 (규칙이 두 벌로 갈리지 않는다)", () => {
    const collectorUser = source("src/expenses/month-expenses.ts");
    expect(collectorUser).toContain('from "../export/expense-page-collector"');
    expect(collectorUser).toContain("collectExpensePages((cursor) => fetchPage({ limit: EXPENSE_LIST_MAX_LIMIT, cursor }))");
  });
});
