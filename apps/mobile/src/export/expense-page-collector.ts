import type { Expense, ListExpensesResponse } from "../api/client";

/**
 * CSV-124 데이터 내보내기: 한 달(yearMonth) 안의 **모든 페이지**를 커서로 이어 모으는 순수 루프.
 *
 * 배경: API-124가 `GET /children/:childId/expenses`에 keyset 페이지네이션을 넣으면서 한 요청이
 * 기본 200건(상한 500건)만 싣게 됐다. export-range.ts의 월별 수집 루프는 "한 달 = 한 요청"을
 * 전제로 만들어졌기 때문에, 그대로 두면 월 200건을 넘는 사용자의 CSV가 **첫 페이지만 담고
 * 조용히 잘린다**. 잘린 CSV는 사용자가 파일을 열어보기 전까지 알 수 없는 종류의 허위 데이터라,
 * 이 모듈이 `hasMore`가 true인 동안 `cursor=nextCursor`로 끝까지 순회한다.
 *
 * 설계 규칙:
 * - **조용한 잘림 금지.** 안전 상한(EXPORT_MAX_PAGES_PER_MONTH)을 넘거나, `hasMore`는 true인데
 *   `nextCursor`가 없거나, 커서가 앞으로 나아가지 않으면 -- 즉 전량을 담았다고 보장할 수 없으면 --
 *   부분 결과를 돌려주지 않고 ExpensePageCollectionError를 던진다. 호출부(useExpenseCsvExport)는
 *   이를 오류 토스트로 드러낸다.
 * - `hasMore`가 undefined이면 그 응답이 곧 전량이다(페이지네이션 이전 서버·로컬 목업). 첫 페이지에서
 *   자연 종료한다.
 * - `limit`은 호출부가 서버 상한(EXPENSE_LIST_MAX_LIMIT=500)으로 올려 요청 수를 최소화한다.
 *   500 x 50페이지 = 한 달 25,000건까지 커버되며, 이는 CSV 행 상한(EXPORT_MAX_ROWS=5000)보다
 *   훨씬 크다.
 * - `totalAmountKrw`는 **첫 페이지 값**을 그대로 쓴다. 서버 계약상 이 값은 페이지 합이 아니라
 *   조회 범위(그 달) 전체의 집계라, 페이지별로 다시 더하면 오히려 몇 배로 부풀어 오른다.
 *
 * 네트워크 모듈을 import하지 않는(타입만 import) 순수 함수라 단위 테스트가 가능하다 --
 * export-range.ts와 같은 관례.
 */

/** 한 달치를 잇는 동안 허용하는 최대 페이지 수. 초과 시 조용히 자르지 않고 오류로 중단한다. */
export const EXPORT_MAX_PAGES_PER_MONTH = 50;

/** `fetchPage(undefined)`가 첫 페이지, 이후에는 직전 응답의 nextCursor가 그대로 들어온다. */
export type ExpensePageFetcher = (cursor: string | undefined) => Promise<ListExpensesResponse>;

export type CollectedExpensePages = {
  /** 서버가 돌려준 순서 그대로 이어 붙인 전량(같은 id 중복은 제거). */
  expenses: Expense[];
  /** 첫 페이지의 totalAmountKrw -- 그 달 전체 집계(페이지 합이 아니다). */
  totalAmountKrw: number;
  /** 실제로 요청한 페이지 수(진단·테스트용). */
  pagesFetched: number;
};

/**
 * 전량 수집을 보장할 수 없을 때 던진다. 부분 결과를 성공으로 위장해 돌려주지 않기 위한 타입이라,
 * 호출부는 이 오류를 잡아 "일부만 담긴 CSV"가 아니라 실패로 알려야 한다.
 */
export class ExpensePageCollectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpensePageCollectionError";
  }
}

export async function collectExpensePages(
  fetchPage: ExpensePageFetcher,
  options: { maxPages?: number } = {}
): Promise<CollectedExpensePages> {
  const maxPages = options.maxPages ?? EXPORT_MAX_PAGES_PER_MONTH;
  const expenses: Expense[] = [];
  const seenIds = new Set<string>();
  // 커서가 제자리를 맴돌면(서버 버그·중복 응답) 무한 루프가 되므로, 이미 쓴 커서는 재사용하지 않는다.
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  let totalAmountKrw = 0;
  let pagesFetched = 0;

  for (;;) {
    const page = await fetchPage(cursor);
    pagesFetched += 1;
    if (pagesFetched === 1) totalAmountKrw = page.totalAmountKrw;

    for (const expense of page.expenses) {
      // keyset 페이지네이션은 원래 겹치지 않지만, 경계에서 겹쳐 오더라도 CSV에 같은 지출이 두 줄로
      // 나가지는 않게 한다.
      if (seenIds.has(expense.id)) continue;
      seenIds.add(expense.id);
      expenses.push(expense);
    }

    if (page.hasMore !== true) break;

    const nextCursor = page.nextCursor;
    if (!nextCursor) {
      throw new ExpensePageCollectionError(
        "지출 목록 응답이 다음 페이지가 있다고 알리면서 커서를 주지 않았어요(전량 내보내기 실패)."
      );
    }
    if (seenCursors.has(nextCursor)) {
      throw new ExpensePageCollectionError("지출 목록 커서가 더 나아가지 않아 전량을 모으지 못했어요.");
    }
    seenCursors.add(nextCursor);

    if (pagesFetched >= maxPages) {
      throw new ExpensePageCollectionError(
        `지출 목록이 ${maxPages}페이지를 넘어 전량을 모으지 못했어요. 기간을 좁혀서 다시 시도해 주세요.`
      );
    }
    cursor = nextCursor;
  }

  return { expenses, totalAmountKrw, pagesFetched };
}
