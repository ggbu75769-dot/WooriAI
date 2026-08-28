import { countsTowardMonthlyTotal } from "../offline/expense-list-reconciliation";
import {
  recordsCountPhrase,
  SYNC_ROW_PENDING_LABEL,
  unsendableRecordsSuffixText
} from "../offline/messages";
import { countPermanentlyFailedRows } from "../offline/permission-denied";

/**
 * GAP-054 #3 — 리포트 탭이 보고 있는 기간에 **아직 서버에 반영되지 않은 기록**이 몇 건인가.
 *
 * ## 무엇이 문제였나
 *
 * 홈·기록 탭·예산 화면은 서버 응답을 이 기기의 오프라인 대기 행과 재조정해서 그린다
 * (src/offline/expense-list-reconciliation.ts, src/home/budget-edit.ts의 resolveThisMonthUsedKrw).
 * 리포트 탭만 서버 집계(`getMonthlyReport`/`getCategoryReport`/…)를 그대로 읽는다. 그래서
 * 오프라인에서 3건을 적고 나면 같은 순간 홈은 재조정된 합계를, 리포트는 그 3건이 빠진 합계를
 * 말한다 — 사용자에게는 두 화면 중 하나가 고장난 것으로 읽힌다.
 *
 * ## 왜 합계를 다시 계산하지 않는가 (고지 우선)
 *
 * 리포트 탭의 숫자는 총액만이 아니다: 카테고리 비중·추이 6개월·분기/연간 집계·누적·마일스톤이
 * 전부 서버 집계다. 그것들을 클라이언트에서 다시 맞추려면 **같은 집계 규칙을 두 벌**(서버 SQL과
 * 클라 재계산) 유지해야 하고, 한쪽만 바뀌는 순간 이 화면은 조용히 틀린 숫자를 그린다. 그래서
 * 이번에는 숫자를 건드리지 않고, 화면이 **자기가 무엇을 아직 모르는지 밝히는** 한 줄만 둔다.
 * 이 줄은 없는 사실을 지어내지 않는다(허위 표시 금지) — 세는 것은 이 기기의 대기 행 수뿐이다.
 *
 * ## 무엇을 세는가
 *
 * 대상은 **지출 아웃박스(local_expenses)** 행이다. 준비템 상태 변경(item_status_outbox)은
 * 리포트의 숫자에 들어가지 않으므로 여기서 세지 않는다.
 *
 * 라운드 54 P2-4: 같은 이유로 **선물·환불 행도 세지 않는다.** 이 줄이 말하는 "아래 숫자"는
 * 총 지출·카테고리 비중이고, 그 집계는 `expense` 구분만 더한다(DNC-015 —
 * `countsTowardMonthlyTotal`이 앱 쪽 단일 소스다). 선물 3건이 대기 중일 때 "3건이 아직
 * 반영되지 않았어요"라고 말하면, 그 3건이 동기화된 뒤에도 아래 숫자는 한 원도 움직이지
 * 않는다 — 사용자가 기다리게 만드는 사실이 아닌 안내다. 건수를 세는 술어를 합계 술어와
 * 같은 곳에서 가져와, 고지와 숫자가 **같은 모집단**을 말하게 한다.
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
 *  1. **합계 유지**(`src/offline/expense-list-reconciliation.ts`): 서버에 아직 없는 행(생성이
 *     거절된 행)은 월 합계에서 **빼지 않는다.** 그 행은 기록 탭 목록에 그대로 서 있어 사용자가
 *     눈으로 셀 수 있다 — 목록에 있는 금액이 합계에 없으면 앱이 산수를 틀린 것으로 읽힌다. 대신
 *     영구 실패 **건수**를 결과에 실어, 화면이 고지 한 줄을 덧붙일 수 있게 한다. 반대로 **서버
 *     지출을 가리키는 행**(수정·삭제가 거절된 행)에서는 그 변경이 영영 닿지 않으므로 **서버 값이
 *     목록·합계로 되돌아온다**(4번과 같은 규칙 — 죽은 로컬 값이 산 서버 값을 가리지 않는다).
 *     그러지 않으면 403으로 거절된 삭제가 화면에서만 성사돼, 서버에 멀쩡히 남아 있는 지출 한 줄이
 *     목록에서도 합계에서도 사라진다.
 *  2. **정기 지출 판정**(`src/expenses/recurring-template.ts`의 `recordedItemNamesForMonth`):
 *     "기록됨"에서 **뺀다.** 묻는 것이 "이번 달에 이 품목을 샀는가"인데 영구 실패 행은 서버에
 *     결코 닿지 않는다. 실패한 기저귀 한 줄이 카드를 끄면 사용자는 다시 기록할 기회를 잃는다.
 *     일시 실패·대기 행은 종전대로 센다(그것들은 언젠가 반영된다).
 *  3. **고지 어휘 분리**(`src/reports/pending-scope-notice.ts` ·
 *     `src/export/export-pending-notice.ts`): 세는 대상은 그대로 두고 **부르는 이름만 가른다.**
 *     영구 실패가 섞이면 주어에서 "동기화 대기 중인"이 떨어져 그냥 "기록 N건"이 되고, 그중 몇
 *     건이 "보낼 수 없는 기록"인지 뒷문장이 따로 말한다(offline/messages.ts). **술어는 두 갈래가
 *     같다**("…에 아직 반영되지 않았어요"): 이 모집단에는 삭제 대기 행(그 숫자에 아직 들어 있다)과
 *     수정 대기 행(옛 값으로 담긴다)이 섞여 있어, "빠져 있어요"처럼 세게 말하면 그 부분집합에
 *     거짓이다. 두 모듈의 모집단은 다르지만(DNC-015) **구분 규칙은 하나**다.
 *  4. **자동완성 모집단**(`src/expenses/suggest-source.ts`): 제안에서 **뺀다.** 400을 부른 바로
 *     그 값이 첫 후보로 돌아오면 사용자는 같은 실패를 다시 만든다(실패 공장). 빼도 잃는 것이
 *     없다 — 이력은 남고, 그 지출의 서버 값이 있으면 그쪽이 대신 후보가 된다.
 *
 * 대기 행을 **세는 방식**이 모듈마다 다른 이유(라운드 57 QA P1-2)는 그대로다: 내보내기 고지는
 * 전부 세고, 리포트 고지는 아래 숫자를 움직일 행만 세고(DNC-015), 정기 지출 판정은 대기·전송
 * 중·일시 실패·충돌을 가리지 않고 센다(빼는 것은 삭제 대기와 위 2번의 영구 실패뿐이다).
 *
 * 판정은 `src/home/budget-edit.ts`의 `hasPendingMonthAdjustments`와 **같은 규칙**이다:
 * 이 아이의 행 가운데 `syncState !== "synced"`인 것(대기 중인 생성·수정, 삭제 대기, 실패, 충돌)
 * 이면 서버 집계는 그 변경을 아직 모른다. 삭제 대기도 포함된다 — 그 행이 가리키는 지출은 서버
 * 집계에 아직 **들어 있는** 값이라, 역시 "아직 반영되지 않은" 차이다.
 *
 * 기간 판정의 기준은 행의 **지출 날짜**(`payload.spentOn`)다. 리포트가 기간을 나누는 기준이
 * 그것이기 때문이다(서버 집계도 spent_on 범위로 자른다). 저장 시각이 아니다 — 어제 적었어도
 * 지난달 날짜의 지출이면 지난달 리포트가 모르는 건수다.
 */

/** `LocalExpenseRow`에서 이 판정에 필요한 것만 (src/offline/types.ts와 구조 호환). */
export type PendingScopeExpenseRow = {
  childId: string;
  syncState: string;
  /**
   * 라운드 59 트랙 A — 영구 실패 갈래를 가르는 데 필요한 실패 사유. 전부 선택이라 이 값을 모르는
   * 호출부·픽스처는 종전 그대로(= 영구 실패가 아닌 행으로) 읽힌다. 판정은
   * `isPermanentlyFailedSyncRow` 하나뿐이고 규칙을 여기 다시 적지 않는다.
   */
  lastError?: string | null;
  lastErrorStatus?: number | null;
  lastErrorCode?: string | null;
  payload?: { spentOn?: string | null; expenseType?: string | null } | null;
};

/**
 * 리포트 탭이 지금 보여 주는 기간. 화면의 세그먼트(월간/분기/연간)와 1:1이고, 값은 화면이
 * 이미 계산해 둔 것들이다(`reportYearMonth` · 분기 3개월 · 연도).
 */
export type ReportPeriodScope =
  | { unit: "month"; yearMonth: string }
  | { unit: "quarter"; yearMonths: readonly string[] }
  | { unit: "year"; year: number };

export type PendingScopeNoticeInput = {
  /** 이 기기의 오프라인 스냅숏 행 전체(`useOfflineSyncSnapshot().rows`). */
  rows: readonly PendingScopeExpenseRow[];
  /** 지금 보고 있는 아이. 아직 모르면 null -- 그때는 아무것도 세지 않는다. */
  childId: string | null | undefined;
  scope: ReportPeriodScope;
};

/**
 * 라운드 59 트랙 A — 세는 것은 하나(아직 반영되지 않은 건수)지만 **부르는 이름은 둘**이다.
 * 모집단을 좁히지 않고 내역만 가른다: 좁히면 영구 실패 행이 아래 숫자에서 빠져 있다는 사실을
 * 아무도 말해 주지 않게 된다.
 */
export type PendingScopeBreakdown = {
  /** 이 기간에 아래 숫자가 아직 모르는 행의 수(영구 실패 포함). */
  count: number;
  /** 그중 **보낼 수 없는**(영구 실패 4xx) 행의 수. 0이면 종전 문구 그대로다. */
  unsendableCount: number;
};

export type PendingScopeNotice = PendingScopeBreakdown & {
  /** 화면에 그리는 한 줄. */
  text: string;
};

export const REPORT_PENDING_SCOPE_NOTICE_TEST_ID = "reports-pending-scope-notice";

/**
 * `spentOn`("2026-08-05")에서 연-월("2026-08")을 뽑는다. 형식이 아니면 null이라 그 행은 어떤
 * 기간에도 속하지 않는다 — 깨진 값을 아무 달에나 세어 넣는 것보다 세지 않는 편이 안전하다.
 *
 * 라운드 54 P2-9: 일자를 옵셔널로 두던 패턴(`(?:-\d{2})?`)을 걷어냈다. 이 함수가 받는 값은
 * 오프라인 payload의 `spentOn` 하나뿐이고 그것은 계약상 언제나 `YYYY-MM-DD`다(서버 응답이거나
 * 입력 화면이 검증한 값). 있지도 않은 입력 모양을 받아 주는 관대함은, 언젠가 진짜로 "YYYY-MM"이
 * 흘러들었을 때 그것을 조용히 정상으로 세어 버리는 구멍이 된다.
 */
export function pendingRowYearMonth(spentOn: unknown): string | null {
  if (typeof spentOn !== "string") return null;
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(spentOn);
  return match ? `${match[1]}-${match[2]}` : null;
}

/** 이 지출 날짜가 지금 보고 있는 기간에 속하는가. */
export function isSpentOnInReportScope(spentOn: unknown, scope: ReportPeriodScope): boolean {
  const yearMonth = pendingRowYearMonth(spentOn);
  if (!yearMonth) return false;
  if (scope.unit === "month") return yearMonth === scope.yearMonth;
  if (scope.unit === "quarter") return scope.yearMonths.includes(yearMonth);
  return yearMonth.slice(0, 4) === String(scope.year);
}

/** 이 아이·이 기간에서 아래 숫자가 아직 모르는 행. 규칙은 이 파일 머리말 참고. */
function pendingRowsInReportScope({ rows, childId, scope }: PendingScopeNoticeInput): PendingScopeExpenseRow[] {
  if (!childId) return [];
  return rows.filter(
    (row) =>
      row.childId === childId &&
      row.syncState !== "synced" &&
      // P2-4: 아래 숫자를 실제로 움직일 행만 센다(DNC-015 — 합계와 같은 술어).
      countsTowardMonthlyTotal(row.payload?.expenseType) &&
      isSpentOnInReportScope(row.payload?.spentOn, scope)
  );
}

/**
 * 라운드 59 트랙 A — 건수와 **그중 보낼 수 없는 건수**를 함께 낸다.
 *
 * 모집단은 위 함수 하나이고, 두 숫자는 같은 배열에서 나온다 — 고지의 앞뒤 문장이 서로 다른
 * 집합을 말하는 일이 구조적으로 불가능해야 한다("그중 M건"이 N보다 클 수 없다).
 * 구분 규칙은 CSV 고지(`src/export/export-pending-notice.ts`)와 **같은 술어**다.
 *
 * 라운드 59 통합리뷰 P2-2: 총건수만 돌려주던 옛 이름(`countPendingExpensesInReportScope`)은
 * **없앴다** — 프로덕션 호출부가 한 곳도 없었다. 건수만 필요하면
 * `countPendingScopeBreakdown(...).count`다(CSV 고지와 같은 관례).
 */
export function countPendingScopeBreakdown(input: PendingScopeNoticeInput): PendingScopeBreakdown {
  const pendingRows = pendingRowsInReportScope(input);
  return { count: pendingRows.length, unsendableCount: countPermanentlyFailedRows(pendingRows) };
}

/**
 * 고지 한 줄.
 *
 * ## 영구 실패가 없을 때 (기본)
 *
 * 어휘는 offline/messages.ts의 단일 소스("동기화 대기")를 그대로 쓴다 — 기록 탭 행 부제·동기화
 * 상태 화면·홈의 대기 한 줄과 같은 단어여야 사용자가 같은 상태를 같은 것으로 읽는다
 * (REC-123(H4) 규칙). 뒷문장이 "아래 숫자"를 짚는 이유는 이 줄이 있는 자리 때문이다: 바로
 * 아래의 총 지출·카테고리 비중이 그 건수를 아직 세지 않았다는 사실이 이 고지의 전부다.
 *
 * ## 영구 실패가 섞였을 때 (라운드 59 트랙 A — 어휘 분리)
 *
 * 그 행은 기다려도 반영되지 않는다. "동기화 대기 중인 기록 5건"이라고 부르면 5건 전부가 곧
 * 합쳐질 것처럼 읽혀, 사용자는 오지 않을 시점을 기다린다(그리고 며칠 뒤 같은 문장을 다시
 * 본다). 그렇다고 세는 대상에서 빼면 아래 숫자에 그만큼이 빠져 있다는 사실을 아무도 말하지
 * 않는다 — 숫자만 조용히 틀리는 쪽이 더 나쁘다.
 *
 * 그래서 **주어에서 "동기화 대기 중인"만 떼고 내역을 덧붙인다**: 남는 주어는 세어진 것 자체
 * ("기록 N건")이고, 그중 몇 건이 "보낼 수 없는 기록"인지 뒷문장이 따로 말한다. 두 조각 모두
 * offline/messages.ts의 단일 소스이고, CSV 고지가 **같은 두 조각**을 쓴다(목적어만 다르다).
 *
 * ## 술어는 두 갈래가 같다 (라운드 59 통합리뷰 P1-1)
 *
 * 어느 갈래든 문장이 하는 주장은 하나다 — "아래 숫자에 **아직 반영되지 않았어요**". 한때 영구
 * 실패 갈래만 "빠져 있어요"로 세게 말했는데, 그 말은 세는 규칙보다 세다: 이 모집단에는 **삭제
 * 대기** 행이 들어 있고 그 행이 가리키는 지출은 아래 숫자에 아직 **들어 있다**(빠진 것이 아니라
 * 빠져야 할 것이 남아 있다). 부분집합에 거짓인 문장을 쓰지 않는다(라운드 57 QA P1-2의 규율).
 */
export function reportPendingScopeNoticeText(count: number, unsendableCount = 0): string {
  if (unsendableCount <= 0) {
    return `${SYNC_ROW_PENDING_LABEL} 중인 기록 ${count}건은 아래 숫자에 아직 반영되지 않았어요.`;
  }
  return `${recordsCountPhrase(count)}은 아래 숫자에 아직 반영되지 않았어요. ${unsendableRecordsSuffixText(unsendableCount)}`;
}

/**
 * 화면이 부르는 단 하나의 함수. 대기 0건이면 **null**이라 아무것도 그리지 않는다 —
 * "0건이 대기 중이에요" 같은 줄은 소음이고, 평소(대다수) 화면을 한 줄 밀어낼 이유가 없다.
 */
export function evaluateReportPendingScopeNotice(input: PendingScopeNoticeInput): PendingScopeNotice | null {
  const { count, unsendableCount } = countPendingScopeBreakdown(input);
  if (count <= 0) return null;
  return { count, unsendableCount, text: reportPendingScopeNoticeText(count, unsendableCount) };
}
