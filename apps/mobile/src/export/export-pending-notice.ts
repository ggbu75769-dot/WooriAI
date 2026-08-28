import { SYNC_ROW_PENDING_LABEL } from "../offline/messages";
import { pendingRowYearMonth } from "../reports/pending-scope-notice";
import { normalizeCustomRange, type CustomExportRange, type ExportRange } from "./export-range";

/**
 * GAP-056 #3 — CSV 내보내기가 **아직 서버에 올라가지 않은 기록**을 조용히 빠뜨리는 문제.
 *
 * ## 무엇이 문제였나
 *
 * 내보내기의 수집기는 `listExpenses`(서버 조회)만 부른다(ExpenseCsvExport.tsx의 runExport).
 * 이 앱의 지출 기록은 SQLite 우선 저장이라(MOB-102/EXP-005) 오프라인에서 적은 5건은 아웃박스에
 * 남아 있고 서버에는 아직 없다. 그 상태로 내보내면 CSV에는 그 5건이 없는데 토스트는
 * "기록 N건을 내보냈어요."라고 성공을 단정한다 — 사용자는 그 파일을 **전량**으로 믿고
 * 엑셀에서 합계를 낸다. 홈·기록 탭은 같은 순간 그 5건을 이미 세고 있으므로, 두 숫자가
 * 어긋나는 이유를 사용자가 알 길이 없다.
 *
 * ## 리포트(GAP-054 #3)와 같은 판정, 다른 모집단
 *
 * 기간에 걸린 대기 행을 세는 관례는 `src/reports/pending-scope-notice.ts`와 같다: 이 아이의
 * 행 가운데 `syncState !== "synced"`인 것(대기·전송 중·실패·충돌·삭제 대기)이면 서버는 그
 * 변경을 아직 모른다. 기간 판정의 기준도 같은 **지출 날짜**(`payload.spentOn`)이고, 연-월을
 * 뽑는 함수(`pendingRowYearMonth`)를 그 모듈에서 그대로 가져다 쓴다 — 같은 사실을 두 벌의
 * 정규식으로 판정하지 않는다.
 *
 * **다른 점은 모집단 하나다.** 리포트의 고지는 총 지출·카테고리 비중이 움직일 행만 세느라
 * 선물·환불을 뺐다(DNC-015 `countsTowardMonthlyTotal` — 합산되지 않는 행을 "반영되지 않았다"고
 * 말하면 동기화된 뒤에도 숫자가 한 원도 안 움직여 사용자를 헛되이 기다리게 한다). 내보내기는
 * 반대다: CSV는 합계가 아니라 **행 목록**이고, 구분(지출/선물/환불) 열까지 실어 내보낸다
 * (expense-csv.ts의 CSV-127 주석). 선물 3건이 대기 중이면 그 3건은 실제로 파일에서 빠진다.
 * 그래서 여기서는 **합산 여부와 무관하게 아직 서버에 없는 행 전부**가 대상이다.
 *
 * ## 대기 행의 두 종류 — 세 모듈이 공유하는 근거 (라운드 57 QA P1-2)
 *
 * `syncState !== "synced"`인 행은 한 가지가 아니다. **생성 대기** 행은 서버에 아직 없지만,
 * **수정 대기·삭제 대기** 행이 가리키는 지출은 서버에 이미 있고 그 값이 곧 달라질 뿐이다.
 * 그래서 "아직 서버에 없어요"는 이 집합 전체를 가리키는 참인 문장이 아니다. 세 모듈은 각자의
 * 목적에 맞게 다르게 세되(코드 규칙이 같아질 이유는 없다) **근거는 이 한 문단을 함께 가리킨다**:
 *
 *  - **내보내기 고지**(이 모듈): 전부 센다. CSV는 서버 조회로 만들므로 생성 대기 행은 통째로
 *    빠지고, 수정·삭제 대기 행은 **옛 값**이 실린다 — 셋 다 "이 파일에 아직 반영되지 않은 변경"
 *    이라는 점에서 같다. 그래서 문구도 딱 그 약한 주장까지만 한다(아래 `exportPendingNoticeText`).
 *  - **리포트 고지**(`src/reports/pending-scope-notice.ts`): 아래 숫자를 실제로 움직일 행만
 *    센다(DNC-015). 삭제 대기도 포함이다 — 서버 집계에 아직 **들어 있는** 값이라 역시 "아직
 *    반영되지 않은" 차이다.
 *  - **정기 지출 판정**(`src/expenses/recurring-template.ts`): `syncState`를 아예 보지 않고
 *    **삭제 대기만** 뺀다. 거기서 묻는 것은 "이번 달에 이 품목이 기록됐는가"라 서버가 아는지와
 *    무관하고, 곧 사라질 기록은 "기록됐다"의 근거가 될 수 없다.
 *
 * ## 왜 대기 행을 CSV에 합쳐 넣지 않는가 (고지 우선)
 *
 * 로컬 행(`ExpensePayload`)과 서버 행(`Expense`)은 같은 모양이 아니다 — 서버 id·version·
 * `source`가 없고, 삭제 대기 행은 "서버에는 아직 있지만 곧 사라질" 값이다. 그것들을 임의로
 * 채워 CSV에 섞으면 내보낸 파일이 서버 상태와도, 이 기기 상태와도 다른 제3의 목록이 된다
 * (되먹임: 그 파일은 엑셀 가져오기로 다시 들어올 수 있다 — 중복 행의 씨앗이다). 그래서
 * 숫자를 지어내지 않고, 화면이 **자기가 무엇을 못 담는지** 밝히는 한 줄만 둔다.
 */

/** `LocalExpenseRow`에서 이 판정에 필요한 것만 (src/offline/types.ts와 구조 호환). */
export type ExportPendingExpenseRow = {
  childId: string;
  syncState: string;
  payload?: { spentOn?: string | null } | null;
};

/**
 * 내보내기 카드가 지금 고르고 있는 기간. 화면의 칩(이번 달·올해·전체·직접 선택)과 1:1이고,
 * 값은 카드가 이미 들고 있는 것들이다(`range` · `getSeoulToday()` · `customRange`).
 */
export type ExportPendingScope = {
  range: ExportRange;
  /** `getSeoulToday()`의 "YYYY-MM-DD". */
  todaySeoul: string;
  /** `range === "custom"`일 때의 시작/끝 달. 다른 구간에서는 무시된다. */
  custom?: Partial<CustomExportRange> | null;
};

export type ExportPendingNoticeInput = ExportPendingScope & {
  /** 이 기기의 오프라인 스냅숏 행 전체(`useOfflineSyncSnapshot().rows`). */
  rows: readonly ExportPendingExpenseRow[];
  /** 지금 고른 아이. 아직 모르면(또는 로그아웃) null -- 그때는 아무것도 세지 않는다. */
  childId: string | null | undefined;
};

export type ExportPendingNotice = {
  /** 이 기간의 대기 건수(1 이상). */
  count: number;
  /** 카드에 그리는 한 줄. */
  text: string;
};

export const EXPORT_PENDING_NOTICE_TEST_ID = "export-pending-notice";

/**
 * 이 지출 날짜가 지금 고른 내보내기 구간에 속하는가.
 *
 * 구간별 근거(수집기 `collectExpensesForRange`가 실제로 요청하는 달과 같은 규칙):
 *  - `month` : 오늘의 서울 연-월 한 달.
 *  - `year`  : 오늘의 서울 연도(1월~이번 달) — 아직 오지 않은 달에는 기록이 있을 수 없으므로
 *              연도 비교만으로 충분하다.
 *  - `custom`: 정규화된 시작~끝 달(닫힌 구간). 정규화를 여기서 다시 부르는 이유는 화면이 넘기는
 *              값과 수집기가 쓰는 값이 **같은 함수를 통과한 뒤**여야 고지와 파일이 같은 기간을
 *              말하기 때문이다.
 *  - `all`   : 날짜를 보지 않고 전부 센다. 대기 행은 정의상 서버와 어긋나 있어서, "전체"가
 *              어디까지 거슬러 올라가든 그 행의 변경은 파일에 반영되지 않는다. 날짜가 깨진 행도
 *              마찬가지라 여기서만은 `spentOn`을 요구하지 않는다.
 *
 * 날짜 형식 판정은 리포트 고지와 **같은 함수**다(`pendingRowYearMonth`) — `YYYY-MM-DD`가
 * 아니면 어떤 기간에도 속하지 않는다(깨진 값을 아무 달에나 세어 넣지 않는다).
 */
export function isSpentOnInExportScope(spentOn: unknown, scope: ExportPendingScope): boolean {
  if (scope.range === "all") return true;
  const yearMonth = pendingRowYearMonth(spentOn);
  if (!yearMonth) return false;
  if (scope.range === "month") return yearMonth === scope.todaySeoul.slice(0, 7);
  if (scope.range === "year") return yearMonth.slice(0, 4) === scope.todaySeoul.slice(0, 4);
  const custom = normalizeCustomRange(scope.custom, scope.todaySeoul);
  return yearMonth >= custom.startYearMonth && yearMonth <= custom.endYearMonth;
}

/** 이 아이·이 구간에서 서버가 아직 모르는 행의 수. 규칙은 이 파일 머리말 참고. */
export function countPendingExpensesForExport({ rows, childId, ...scope }: ExportPendingNoticeInput): number {
  if (!childId) return 0;
  return rows.filter(
    (row) =>
      row.childId === childId &&
      // 합산 술어(countsTowardMonthlyTotal)를 쓰지 않는다 -- 선물·환불도 CSV에서는 빠지는 행이다.
      row.syncState !== "synced" &&
      isSpentOnInExportScope(row.payload?.spentOn, scope)
  ).length;
}

/**
 * 카드에 그리는 고지 한 줄.
 *
 * 어휘는 offline/messages.ts의 단일 소스("동기화 대기")를 그대로 쓴다 — 기록 탭 행 부제·동기화
 * 상태 화면·리포트 탭 고지와 같은 단어여야 사용자가 같은 상태를 같은 것으로 읽는다(REC-123(H4)).
 * 이 줄은 버튼을 누르기 **전에** 서므로 아직 일어나지 않은 일을 현재형으로 말한다.
 *
 * 라운드 57 QA(P1-2) — **문구를 세는 규칙에 맞춰 약하게 되돌렸다.** 예전 문장은 "아직 서버에 없어
 * 이 파일에 담기지 않아요"였는데, 세는 것은 `syncState !== "synced"` 전부다(위 머리말의 "대기 행의
 * 두 종류"). 수정 대기 행이 가리키는 지출은 **서버에 있고 CSV에도 담긴다** — 담기는 것이 옛 값일
 * 뿐이다. 즉 옛 문장은 그 행에 대해 두 번 틀렸다("서버에 없다"·"담기지 않는다"). 세는 규칙을
 * 좁히는 대신(그러면 옛 값으로 나가는 행을 아무도 말해 주지 않는다) 문구를 리포트 고지와 **같은
 * 약한 주장**으로 맞춘다: 무엇이 빠졌는지·무엇이 옛 값인지를 구분해 단언하지 않고, "이 파일에
 * 아직 반영되지 않은 변경이 N건 있다"는 관측만 말한다.
 */
export function exportPendingNoticeText(count: number): string {
  return `${SYNC_ROW_PENDING_LABEL} 중인 기록 ${count}건은 이 파일에 아직 반영되지 않았어요.`;
}

/**
 * 결과 토스트 뒤에 붙는 한 문장. 0건이면 **빈 문자열**이라 평소 토스트는 한 글자도 길어지지 않는다.
 *
 * 앞에 공백 하나를 달고 시작하는 이유: 호출부가 `${base}${suffix}` 한 줄로 이어 붙이기 때문이다
 * (문장 사이 공백을 호출부마다 다르게 넣지 않는다). 성공 토스트에도, "내보낼 기록이 없어요"
 * 토스트에도 같은 문장이 붙는다 — 두 경우 모두 **이 CSV에 아직 반영되지 않았다**는 같은 사실이다.
 *
 * 라운드 57 QA(P1-2): 카드 고지와 **같은 주장**이다(위 `exportPendingNoticeText` 주석). 시제만
 * 다르다 — 카드는 누르기 전, 이 줄은 파일이 나간 뒤다.
 */
export function exportPendingToastSuffix(count: number): string {
  if (count <= 0) return "";
  return ` ${SYNC_ROW_PENDING_LABEL} 중인 기록 ${count}건은 이 CSV에 아직 반영되지 않았어요.`;
}

/**
 * 카드가 부르는 단 하나의 함수. 대기 0건이면 **null**이라 아무것도 그리지 않는다 —
 * "0건이 빠졌어요" 같은 줄은 소음이고, 평소(대다수) 카드를 한 줄 밀어낼 이유가 없다.
 */
export function evaluateExportPendingNotice(input: ExportPendingNoticeInput): ExportPendingNotice | null {
  const count = countPendingExpensesForExport(input);
  if (count <= 0) return null;
  return { count, text: exportPendingNoticeText(count) };
}
