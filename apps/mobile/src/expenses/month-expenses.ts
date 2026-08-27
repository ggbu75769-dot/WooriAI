import { EXPENSE_LIST_MAX_LIMIT, type Expense, type ListExpensesResponse } from "../api/client";
import { collectExpensePages } from "../export/expense-page-collector";

/**
 * REC-124(H1): 화면이 "한 달 = 한 응답"을 전제로 지출 목록을 읽던 것을 **전량 수집**으로 바꾸는
 * 얇은 어댑터.
 *
 * 배경: API-124가 `GET /children/:childId/expenses`에 keyset 페이지네이션을 넣으면서 한 요청이
 * 기본 200건(상한 500건)만 싣게 됐다. 기록 탭/홈의 세 호출부는 여전히 첫 페이지만 읽고 있었고,
 * 정렬이 `spentOn desc`라 **잘리는 쪽은 그 달의 앞날짜**다. 결과는 전부 조용한 허위 표시였다:
 *  - 기록 탭 "이번 달 N건 · 합계 X원"이 과소 표시(월 300건이면 200건까지만 센다).
 *  - "지난달 같은 시점 대비" 한 줄은 지난달 앞부분(1일~)이 통째로 잘려나가, 200건을 넘는 달에서는
 *    비교 기준이 0원이 되어 "지난달 같은 시점까지는 지출 기록이 없었어요"라는 **없는 사실**을
 *    말한다(src/home/last-month-comparison.ts의 no-baseline 분기).
 *
 * CSV 내보내기(CSV-124)는 같은 문제를 이미 `collectExpensePages`로 풀었으므로 여기서는 그 순수
 * 루프를 **그대로 재사용**한다 -- 커서 전진/중복 id/안전 상한 규칙이 두 벌로 갈리지 않는다.
 *
 * 설계 규칙:
 * - `limit`은 서버 상한(EXPENSE_LIST_MAX_LIMIT=500)으로 올린다. 월 500건 이하 사용자(대다수)는
 *   종전과 똑같이 **요청 한 번**으로 끝나고, 그 이상만 커서로 이어 붙는다.
 * - 전량을 담았다고 보장할 수 없으면 collectExpensePages가 ExpensePageCollectionError를 던지고,
 *   이 함수는 그것을 잡지 않는다 -- react-query의 기존 오류 경로(기록 탭의 "불러오지 못했어요"
 *   재시도 카드)로 그대로 나가야 한다. 부분 목록을 성공으로 위장해 돌려주면 이 티켓이 고치려는
 *   조용한 잘림이 그대로 남는다.
 - 서버의 `totalAmountKrw`는 **일부러 노출하지 않는다**. 기록 탭의 월 합계는
 *   `reconcileMonthlyExpenses(...).monthlyTotalKrw`(오프라인 대기 행 포함)이고 홈은
 *   `.expenses`만 쓴다 -- 여기서 서버 집계를 함께 내보내면 다음 사람이 그것을 화면
 *   합계로 쓸 수 있고, 그러면 오프라인 대기 행이 빠진 숫자가 화면의 다른 합계와
 *   어긋난다(F3가 잡았던 소스 비대칭의 재생산). 서버 집계가 필요하면
 *   collectExpensePages를 직접 쓰는 CSV 경로처럼 명시적으로 받아라.
 * - 로컬 목업(src/api/local-backend.ts)은 limit/cursor를 무시하고 그 달 전량을 한 번에 주며
 *   `hasMore`를 붙이지 않으므로, 수집 루프가 첫 페이지에서 자연 종료한다(동작 불변).
 *
 * 네트워크 호출을 직접 하지 않고 페처를 주입받는 이유는 화면 밖에서 단위 테스트하기 위해서다
 * (react-native 화면은 vitest에서 렌더할 수 없다는 이 저장소의 제약 -- month-expenses.test.ts).
 */

/** 한 페이지 요청. 화면은 `(page) => listExpenses(token, childId, yearMonth, page)`를 넘긴다. */
export type MonthExpensePageFetcher = (page: { limit: number; cursor?: string }) => Promise<ListExpensesResponse>;

/** 화면이 실제로 읽는 필드만 담은 결과 -- ListExpensesResponse의 부분집합이라 호출부가 그대로 쓴다. */
export type MonthExpenses = {
  /** 그 달의 모든 페이지를 이어 붙인 전량. */
  expenses: Expense[];
};

export async function fetchMonthExpenses(fetchPage: MonthExpensePageFetcher): Promise<MonthExpenses> {
  const collected = await collectExpensePages((cursor) => fetchPage({ limit: EXPENSE_LIST_MAX_LIMIT, cursor }));
  return { expenses: collected.expenses };
}
