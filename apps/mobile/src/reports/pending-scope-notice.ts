import { countsTowardMonthlyTotal } from "../offline/expense-list-reconciliation";
import { SYNC_ROW_PENDING_LABEL } from "../offline/messages";

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
 * ## 대기 행의 두 종류 — 세 모듈이 공유하는 근거 (라운드 57 QA P1-2)
 *
 * `syncState !== "synced"`인 행은 한 가지가 아니다. **생성 대기** 행은 서버에 아직 없지만,
 * **수정 대기·삭제 대기** 행이 가리키는 지출은 서버에 이미 있고 그 값이 곧 달라질 뿐이다.
 * 그래서 "아직 서버에 없어요"는 이 집합 전체를 가리키는 참인 문장이 아니다. 세 모듈은 각자의
 * 목적에 맞게 다르게 세되(코드 규칙이 같아질 이유는 없다) **근거는 이 한 문단을 함께 가리킨다**:
 *
 *  - **내보내기 고지**(`src/export/export-pending-notice.ts`): 전부 센다. CSV는 서버 조회로
 *    만들므로 생성 대기 행은 통째로 빠지고, 수정·삭제 대기 행은 **옛 값**이 실린다 — 셋 다
 *    "그 파일에 아직 반영되지 않은 변경"이라는 점에서 같고, 문구도 그 약한 주장까지만 한다.
 *  - **리포트 고지**(이 모듈): 아래 숫자를 실제로 움직일 행만 센다(DNC-015). 삭제 대기도
 *    포함이다 — 서버 집계에 아직 **들어 있는** 값이라 역시 "아직 반영되지 않은" 차이다.
 *  - **정기 지출 판정**(`src/expenses/recurring-template.ts`): `syncState`를 아예 보지 않고
 *    **삭제 대기만** 뺀다. 거기서 묻는 것은 "이번 달에 이 품목이 기록됐는가"라 서버가 아는지와
 *    무관하고, 곧 사라질 기록은 "기록됐다"의 근거가 될 수 없다.
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

export type PendingScopeNotice = {
  /** 이 기간의 대기 건수(1 이상). */
  count: number;
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

/** 이 아이·이 기간의 대기 건수. 규칙은 이 파일 머리말 참고. */
export function countPendingExpensesInReportScope({ rows, childId, scope }: PendingScopeNoticeInput): number {
  if (!childId) return 0;
  return rows.filter(
    (row) =>
      row.childId === childId &&
      row.syncState !== "synced" &&
      // P2-4: 아래 숫자를 실제로 움직일 행만 센다(DNC-015 — 합계와 같은 술어).
      countsTowardMonthlyTotal(row.payload?.expenseType) &&
      isSpentOnInReportScope(row.payload?.spentOn, scope)
  ).length;
}

/**
 * 고지 한 줄.
 *
 * 어휘는 offline/messages.ts의 단일 소스("동기화 대기")를 그대로 쓴다 — 기록 탭 행 부제·동기화
 * 상태 화면·홈의 대기 한 줄과 같은 단어여야 사용자가 같은 상태를 같은 것으로 읽는다
 * (REC-123(H4) 규칙). 뒷문장이 "아래 숫자"를 짚는 이유는 이 줄이 있는 자리 때문이다: 바로
 * 아래의 총 지출·카테고리 비중이 그 건수를 아직 세지 않았다는 사실이 이 고지의 전부다.
 */
export function reportPendingScopeNoticeText(count: number): string {
  return `${SYNC_ROW_PENDING_LABEL} 중인 기록 ${count}건은 아래 숫자에 아직 반영되지 않았어요.`;
}

/**
 * 화면이 부르는 단 하나의 함수. 대기 0건이면 **null**이라 아무것도 그리지 않는다 —
 * "0건이 대기 중이에요" 같은 줄은 소음이고, 평소(대다수) 화면을 한 줄 밀어낼 이유가 없다.
 */
export function evaluateReportPendingScopeNotice(input: PendingScopeNoticeInput): PendingScopeNotice | null {
  const count = countPendingExpensesInReportScope(input);
  if (count <= 0) return null;
  return { count, text: reportPendingScopeNoticeText(count) };
}
