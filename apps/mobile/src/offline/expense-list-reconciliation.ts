import { countPermanentlyFailedRows } from "./permission-denied";
import type { LocalExpenseRow } from "./types";

/**
 * H-2 fix (diff review): the records screen (app/(tabs)/records.tsx) renders the server's
 * listExpenses response merged with any not-yet-synced local rows. Editing or deleting an
 * *existing* server expense goes through adoptServerExpense, which reuses the server's expense
 * id as `canonicalId` on an otherwise-normal local_expenses row -- so while that edit/delete is
 * still unsynced, the server's listExpenses response still returns the OLD row (the server
 * hasn't seen the change yet) *in addition to* the local row reflecting the new value or
 * pending-delete. Naively concatenating both lists would show a duplicate row and double-count
 * the total (old amount + new amount, or an amount that should already be gone for a pending
 * delete). This module is the single place that reconciles the two into one consistent view,
 * kept dependency-free (no React/React Native imports) so it's directly unit-testable and usable
 * from both sync-controller.ts and records.tsx without pulling in native modules.
 *
 * ## 영구 실패 행의 네 자리 — 다섯 모듈이 공유하는 근거 (라운드 59 트랙 A)
 *
 * `syncState !== "synced"`인 행은 한 가지가 아니다. **생성 대기** 행은 서버에 아직 없지만,
 * **수정 대기·삭제 대기** 행이 가리키는 지출은 서버에 이미 있고 그 값이 곧 달라질 뿐이다
 * (라운드 57 QA P1-2). 그 위에 라운드 59가 갈래를 하나 더 갈랐다: 서버가 4xx로 거절해 **다시
 * 보내도 같은 답이 오는** 행이다(`isPermanentlyFailedSyncRow` — src/offline/permission-denied.ts).
 * 그 행을 "동기화 대기"라고 부르면 오지 않을 시점을 약속하는 것이고, 없는 셈 치면 화면에 보이는
 * 목록과 숫자가 어긋난다.
 *
 * 그래서 **네 자리가 각자 다른 답을 낸다.** 한 술어로 통일하지 않는다 — 통일하는 순간 그중
 * 최소 한 자리가 거짓을 말한다:
 *
 *  1. **합계 유지**(`src/offline/expense-list-reconciliation.ts`): 월 합계에서 **빼지 않는다.**
 *     그 행은 기록 탭 목록에 그대로 서 있어 사용자가 눈으로 셀 수 있다 — 목록에 있는 금액이
 *     합계에 없으면 앱이 산수를 틀린 것으로 읽힌다. 대신 영구 실패 **건수**를 결과에 실어,
 *     화면이 고지 한 줄을 덧붙일 수 있게 한다.
 *  2. **정기 지출 판정**(`src/expenses/recurring-template.ts`의 `recordedItemNamesForMonth`):
 *     "기록됨"에서 **뺀다.** 묻는 것이 "이번 달에 이 품목을 샀는가"인데 영구 실패 행은 서버에
 *     결코 닿지 않는다. 실패한 기저귀 한 줄이 카드를 끄면 사용자는 다시 기록할 기회를 잃는다.
 *     일시 실패·대기 행은 종전대로 센다(그것들은 언젠가 반영된다).
 *  3. **고지 어휘 분리**(`src/reports/pending-scope-notice.ts` ·
 *     `src/export/export-pending-notice.ts`): 세는 대상은 그대로 두고 **부르는 이름을 가른다.**
 *     영구 실패가 섞이면 주어가 "동기화 대기 중인 기록"에서 "아직 반영되지 않은 기록"으로
 *     바뀌고, 그중 몇 건이 "보낼 수 없는 기록"인지 뒷문장이 따로 말한다(offline/messages.ts).
 *     두 모듈의 모집단은 다르지만(DNC-015) **구분 규칙은 하나**다.
 *  4. **자동완성 모집단**(`src/expenses/suggest-source.ts`): 제안에서 **뺀다.** 400을 부른 바로
 *     그 값이 첫 후보로 돌아오면 사용자는 같은 실패를 다시 만든다(실패 공장). 빼도 잃는 것이
 *     없다 — 이력은 남고, 그 지출의 서버 값이 있으면 그쪽이 대신 후보가 된다.
 *
 * 대기 행을 **세는 방식**이 모듈마다 다른 이유(라운드 57 QA P1-2)는 그대로다: 내보내기 고지는
 * 전부 세고, 리포트 고지는 아래 숫자를 움직일 행만 세고(DNC-015), 정기 지출 판정은 대기·전송
 * 중·일시 실패·충돌을 가리지 않고 센다(빼는 것은 삭제 대기와 위 2번의 영구 실패뿐이다).
 */

type ServerExpenseLike = {
  id: string;
  amountKrw: number;
  expenseType: string;
};

export type MonthlyExpenseReconciliation<TServerExpense extends ServerExpenseLike> = {
  /** Server-sourced expenses for the month, minus any whose canonicalId has an outstanding
   * local mutation (edit, pending delete, failed, or conflict) -- those are stale and superseded
   * by (or about to be removed by) the corresponding offline row instead. */
  visibleServerExpenses: TServerExpense[];
  /** Local-only rows to render *instead of* the now-hidden stale server rows: excludes
   * `pendingDelete` rows (nothing to show for a record on its way out) and fully-'synced' rows
   * (those are already reflected correctly in the server list). Exception (COV-T5 bug 3):
   * a 'conflict' row stays visible even when `pendingDelete` is true -- the server contested
   * the delete, so the expense is still live server-side and vanishing it from the list and
   * the monthly total would misreport reality. It renders as a conflict row like any other
   * (records.tsx shows the ⚠ conflict icon with the "삭제 대기 중" subtitle) and its amount is
   * counted the same way every other conflict row's is: from its local payload. */
  offlinePendingRows: LocalExpenseRow[];
  /** Sum of `visibleServerExpenses` + `offlinePendingRows`, counting only real expenses
   * (`expenseType === "expense"`) -- computed directly from the already-deduped sets above so it
   * can never drift from what's actually listed. See `countsTowardMonthlyTotal`. */
  monthlyTotalKrw: number;
  /**
   * 라운드 59 트랙 A — `offlinePendingRows` 가운데 **보낼 수 없는**(영구 실패 4xx) 행의 수.
   *
   * ## 왜 합계에서 빼지 않고 건수만 내놓는가
   *
   * 처음 후보는 "영구 실패 행을 월 합계에서 뺀다"였다. 그러면 이 화면이 스스로 모순된다:
   * 그 행은 `offlinePendingRows`에 그대로 남아 목록에 **보이고**(사용자는 그 금액을 눈으로
   * 읽는다), 합계에서만 조용히 빠진다. 목록의 금액을 다 더해도 위의 총액이 나오지 않는 화면은
   * 사용자가 그 자리에서 반박할 수 있는 거짓이다. 반대로 목록에서까지 지우면 서버에도 없고
   * 화면에도 없는 기록이 되어, 고쳐 보낼 수도 버릴 수도 없는 유령이 된다(그 행을 다루는 화면은
   * app/sync-status.tsx 하나뿐이다).
   *
   * 그래서 숫자와 목록은 **둘 다 그대로 두고**, 화면이 사실을 한 줄 덧붙일 수 있도록 건수만
   * 실어 보낸다(`unsendableRowsNoticeText` — src/offline/messages.ts). 판정과 문구는 각각
   * 순수 모듈에 있고, 화면이 하는 일은 0이면 아무것도 그리지 않는 것뿐이다.
   *
   * 세는 대상을 `offlinePendingRows`로 한정하는 이유: 이 줄이 가리키는 것은 **바로 위 목록**
   * 이라("이 중 N건은…") 목록에 없는 행을 세면 지시 대상이 어긋난다. 삭제 대기 행처럼 목록에서
   * 빠지는 행은 여기서도 빠진다.
   */
  permanentlyFailedCount: number;
};

/**
 * REC-121b: 월 합계에 잡히는 행인지 판정한다 — 서버 집계와 **같은 술어**를 쓴다.
 *
 * 서버의 `sumExpenses`(apps/api/src/onboarding/expenses-store.service.ts)는 `expenseType ===
 * "expense"`만 더해 선물(gift)과 환불(refund)을 **둘 다** 제외한다(DNC-015). 홈의 총액·예산
 * 사용액과 리포트 월 합계가 전부 그 집계다. 그런데 여기서는 `!== "gift"`로만 걸러 환불을
 * 지출처럼 더하고 있었고, 그래서 환불 행이 있는 달에는 홈/리포트와 기록 탭 합계가 어긋났다
 * (REC-121이 "곁가지로 드러난 불일치"로 문서화만 하고 남긴 항목).
 *
 * 화이트리스트(`=== "expense"`)가 블랙리스트(`!== "gift"`)보다 안전하기도 하다 — 서버가 새
 * `expenseType`을 추가해도 기록 탭이 그걸 자동으로 지출로 세지 않는다.
 *
 * `expenseType`이 없는 레거시 페이로드는 expense로 간주한다 — src/expenses/recent-items.ts의
 * 관례와 동일하고, 필드가 도입되기 전에 저장된 오프라인 행을 합계에서 통째로 떨어뜨리지
 * 않기 위해서다. (오프라인 저장소의 ExpenseKind는 아직 "expense" | "gift"뿐이라 환불은 서버
 * 목록으로만 들어오지만, 두 집합에 같은 규칙을 적용해 두는 편이 드리프트를 막는다.)
 *
 * 정밀 리뷰 F3(부수): src/home/last-month-comparison.ts의 sumMonthExpensesThroughDay가 이 술어를
 * **그대로 import해서** 쓴다. 기록 탭의 "지난달 같은 시점 대비" 한 줄은 이번 달 항을 여기서,
 * 지난달 항을 저기서 계산하므로 두 곳의 규칙이 갈리면 그 자체가 허위 비교가 된다. 예전에는
 * 저쪽이 `!== "expense"`로 걸러 `expenseType` 없는 레거시 로컬 행을 떨어뜨렸다 -- 같은 행이
 * 이번 달에는 세어지고 지난달에는 빠지는 비대칭이었다. 술어를 한 곳(여기)에만 두어 막는다.
 *
 * CLN-131: src/api/local-backend.ts(데모/로컬 세션 백엔드)의 totalExpenseKrw·categoryBreakdown·
 * getCumulativeReport·getMilestoneReport도 이 함수를 import한다. 예전에는 그쪽이
 * `expenseType === "expense"` 엄격 비교를 네 번 인라인으로 들고 있어서, 술어가 바뀔 때
 * 같은 데모 세션의 홈/리포트(local-backend)와 기록 탭(여기)이 서로 다른 합계를 낼 수 있었다.
 * (실제 값 차이는 없었다 — LocalExpenseRecord.expenseType은 생성·재수화·픽스처 전 경로에서
 * 항상 채워진다. 단일화의 목적은 앞으로의 드리프트 차단이다.)
 * 서버 쪽 같은 규칙은 apps/api의 sumExpenses(DB 집계)/totalExpenseKrw가 따로 들고 있다 —
 * 모바일은 관례상 contracts/서버 코드에 의존하지 않으므로 술어를 값으로 미러링만 한다.
 */
export function countsTowardMonthlyTotal(expenseType: string | null | undefined): boolean {
  return expenseType === undefined || expenseType === null || expenseType === "expense";
}

export function reconcileMonthlyExpenses<TServerExpense extends ServerExpenseLike>(
  serverExpenses: TServerExpense[],
  childOfflineRows: LocalExpenseRow[],
  recordsYearMonth: string
): MonthlyExpenseReconciliation<TServerExpense> {
  const staleServerCanonicalIds = new Set(
    childOfflineRows
      .filter((row) => row.canonicalId && row.syncState !== "synced")
      .map((row) => row.canonicalId as string)
  );

  const visibleServerExpenses = serverExpenses.filter((expense) => !staleServerCanonicalIds.has(expense.id));

  const offlinePendingRows = childOfflineRows.filter(
    (row) =>
      row.syncState !== "synced" &&
      // COV-T5 bug 3: a pendingDelete row is hidden while the delete is merely queued, but a
      // delete the server CONTESTED ('conflict') must stay visible -- see the doc comment above.
      (row.syncState === "conflict" || !row.pendingDelete) &&
      row.payload.spentOn.startsWith(recordsYearMonth)
  );

  const monthlyTotalKrw =
    visibleServerExpenses
      .filter((expense) => countsTowardMonthlyTotal(expense.expenseType))
      .reduce((sum, expense) => sum + expense.amountKrw, 0) +
    offlinePendingRows
      .filter((row) => countsTowardMonthlyTotal(row.payload.expenseType))
      .reduce((sum, row) => sum + row.payload.amountKrw, 0);

  // 합계는 위에서 이미 확정됐다 -- 아래 계수는 그 숫자에 손대지 않는다(위 필드 주석).
  const permanentlyFailedCount = countPermanentlyFailedRows(offlinePendingRows);

  return { visibleServerExpenses, offlinePendingRows, monthlyTotalKrw, permanentlyFailedCount };
}
