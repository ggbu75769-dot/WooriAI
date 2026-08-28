import {
  OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE,
  recordsCountPhrase,
  SYNC_ROW_PENDING_LABEL,
  unsendableRecordsSuffixText
} from "../offline/messages";
import { countPermanentlyFailedRows } from "../offline/permission-denied";
import type { OfflineStorageState } from "../offline/sync-controller";
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
  /**
   * 라운드 59 트랙 A — 영구 실패 갈래를 가르는 데 필요한 실패 사유. 리포트 고지의
   * `PendingScopeExpenseRow`와 **같은 세 필드**이고(같은 술어가 읽는다), 전부 선택이라 이 값을
   * 모르는 호출부는 종전 그대로 동작한다.
   */
  lastError?: string | null;
  lastErrorStatus?: number | null;
  lastErrorCode?: string | null;
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
  /**
   * 라운드 61 S-4 — 위 `rows`를 **믿어도 되는가**(`useOfflineSyncSnapshot().storage`).
   *
   * 홈 최하단 줄이 맞은 것과 같은 뿌리다(M-1, src/home/home-sync-status.ts): 저장소를 열지
   * 못한 부팅에서 스냅숏은 빈 초기값이라 여기서 세면 0건이 되고, 0건이면 이 고지는 통째로
   * 사라진다. 그 침묵은 "이 파일에 다 담겼어요"로 읽히는데, 실제로 앱이 아는 것은 0건이 아니라
   * **모름**이다 — 아직 서버에 못 보낸 지출이 그 파일에서 빠져 있어도 화면이 아무 말도 하지
   * 않는다(DNC: 허위 데이터 표시 금지).
   *
   * 기본값 `"ok"`는 후방 호환이다 — 이 값을 모르는 호출부·테스트는 종전과 같은 결과를 받는다.
   */
  storage?: OfflineStorageState;
};

/**
 * 라운드 59 트랙 A — 리포트 고지(`PendingScopeBreakdown`)와 **같은 구분**이다. 이름·의미가
 * 같아야 두 화면의 같은 문장이 같은 규칙에서 나온다는 사실이 코드에서 보인다.
 */
export type ExportPendingBreakdown = {
  /** 이 구간에서 파일에 아직 반영되지 않은 행의 수(영구 실패 포함). */
  count: number;
  /** 그중 **보낼 수 없는**(영구 실패 4xx) 행의 수. 0이면 종전 문구 그대로다. */
  unsendableCount: number;
};

export type ExportPendingNotice = ExportPendingBreakdown & {
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

/** 이 아이·이 구간에서 서버가 아직 모르는 행. 규칙은 이 파일 머리말 참고. */
function pendingRowsForExport({ rows, childId, storage: _storage, ...scope }: ExportPendingNoticeInput): ExportPendingExpenseRow[] {
  if (!childId) return [];
  return rows.filter(
    (row) =>
      row.childId === childId &&
      // 합산 술어(countsTowardMonthlyTotal)를 쓰지 않는다 -- 선물·환불도 CSV에서는 빠지는 행이다.
      row.syncState !== "synced" &&
      isSpentOnInExportScope(row.payload?.spentOn, scope)
  );
}

/**
 * 라운드 59 트랙 A — 건수와 **그중 보낼 수 없는 건수**. 리포트 고지의
 * `countPendingScopeBreakdown`과 같은 모양이고, 구분 술어(`isPermanentlyFailedSyncRow`)도 하나다.
 * 두 숫자를 같은 배열에서 뽑는 이유도 같다: "그중 M건"이 N을 넘는 문장이 만들어질 수 없어야 한다.
 *
 * 라운드 59 통합리뷰 P2-2: 총건수만 돌려주던 옛 이름(`countPendingExpensesForExport`)은
 * **없앴다** — 프로덕션 호출부가 한 곳도 없었고, 같은 값을 두 이름으로 부를 수 있으면 다음
 * 호출부가 어느 쪽을 쓰는지에 따라 "그중 M건"을 함께 받아 갈지가 갈린다. 건수만 필요하면
 * `countPendingExportBreakdown(...).count`다.
 */
export function countPendingExportBreakdown(input: ExportPendingNoticeInput): ExportPendingBreakdown {
  const pendingRows = pendingRowsForExport(input);
  return { count: pendingRows.length, unsendableCount: countPermanentlyFailedRows(pendingRows) };
}

/**
 * 라운드 61 S-4 — **저장소를 못 열었을 때**의 고지. 카드("이 파일")와 토스트("이 CSV")가 목적어
 * 하나만 갈아 끼운 같은 문장을 쓴다(아래 두 함수의 평소 갈래와 같은 관례다).
 *
 * ## 왜 건수를 말하지 않는가
 *
 * 이 상태에서 스냅숏의 행 목록은 관측이 아니다(빈 초기값 또는 마지막으로 읽어 둔 옛 값 —
 * sync-controller.ts의 `publishStorageUnavailableSnapshot`). 그 위에서 "N건"을 적으면 앞의 두
 * 갈래와 똑같은 세기의 단정이 되는데, 그 N은 지금 참인지 알 수 없는 숫자다.
 *
 * ## 어휘
 *
 * 앞 문장은 홈 최하단 줄·동기화 상태 화면과 **같은 단일 소스**다
 * (`OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE`, offline/messages.ts) — 한 앱 안에서 같은 상태를
 * 세 가지 말로 부르지 않는다(REC-123(H4)). 뒷 문장은 평소 갈래의 술어("…에 아직 반영되지
 * 않았어요")를 **한 단계 더 약하게** 되돌린 형태다: 세는 규칙이 무너진 상태라 "반영되지
 * 않았다"조차 관측이 아니고, 말할 수 있는 것은 가능성뿐이다. DNC-018 해요체.
 */
function exportStorageUnknownNoticeText(target: "이 파일" | "이 CSV"): string {
  return `${OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE} ${target}에 아직 반영되지 않은 기록이 있을 수 있어요.`;
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
 *
 * 라운드 59 트랙 A — **영구 실패가 섞이면 어휘를 가른다.** 그 행은 다음 CSV에도, 그다음 CSV에도
 * 담기지 않는다(payload가 그대로인 한 서버가 같은 4xx를 돌려준다). 그걸 "동기화 대기"라고
 * 부르면 "다음에 내보내면 들어 있겠지"라는 잘못된 기대를 만들고, 사용자는 같은 파일을 다시
 * 만들어 확인하게 된다. 그래서 주어에서 그 수식을 떼고("기록 N건") 그중 몇 건이 보낼 수 없는
 * 기록인지 뒷문장이 따로 말한다 — 리포트 고지와 **같은 두 조각**(offline/messages.ts)이고,
 * 다른 것은 목적어("이 파일" vs "아래 숫자")뿐이다.
 *
 * 라운드 59 통합리뷰 P1-1 — **술어는 두 갈래가 같다.** 한때 영구 실패 갈래만 "빠져 있어요"로
 * 세게 말했는데, 그것은 바로 위 문단이 되돌린 그 주장("담기지 않는다")과 같은 세기다: 이
 * 모집단의 **수정 대기** 행은 옛 값으로 실제 CSV에 담기므로 그 행에 대해 거짓이다. 두 갈래 모두
 * 관측 하나만 말한다 — "이 파일에 아직 반영되지 않았어요".
 */
export function exportPendingNoticeText(count: number, unsendableCount = 0, storage: OfflineStorageState = "ok"): string {
  if (storage === "unavailable") return exportStorageUnknownNoticeText("이 파일");
  if (unsendableCount <= 0) {
    return `${SYNC_ROW_PENDING_LABEL} 중인 기록 ${count}건은 이 파일에 아직 반영되지 않았어요.`;
  }
  return `${recordsCountPhrase(count)}은 이 파일에 아직 반영되지 않았어요. ${unsendableRecordsSuffixText(unsendableCount)}`;
}

/**
 * 결과 토스트 뒤에 붙는 한 문장. 0건이면 **빈 문자열**이라 평소 토스트는 한 글자도 길어지지 않는다.
 *
 * 앞에 공백 하나를 달고 시작하는 이유: 호출부가 `${base}${suffix}` 한 줄로 이어 붙이기 때문이다
 * (문장 사이 공백을 호출부마다 다르게 넣지 않는다). 성공 토스트에도, "내보낼 기록이 없어요"
 * 토스트에도 같은 문장이 붙는다 — 두 경우 모두 **이 CSV에 아직 반영되지 않았다**는 같은 사실이다.
 *
 * 라운드 57 QA(P1-2): 카드 고지와 **같은 주장**이다(위 `exportPendingNoticeText` 주석). 시제만
 * 다르다 — 카드는 누르기 전, 이 줄은 파일이 나간 뒤다. 라운드 59 트랙 A의 어휘 분리도 같은
 * 규칙으로 따라온다: 영구 실패가 섞이면 여기서도 주어가 바뀌고 뒷문장이 붙는다.
 */
export function exportPendingToastSuffix(count: number, unsendableCount = 0, storage: OfflineStorageState = "ok"): string {
  // 라운드 61 S-4: 건수가 0이어도 **먼저** 걸린다 — 저장소를 못 연 부팅에서는 그 0이 관측이
  // 아니라 초기값이라, 여기서 빈 문자열을 돌려주면 토스트가 파일을 전량으로 단정한다.
  if (storage === "unavailable") return ` ${exportStorageUnknownNoticeText("이 CSV")}`;
  if (count <= 0) return "";
  if (unsendableCount <= 0) {
    return ` ${SYNC_ROW_PENDING_LABEL} 중인 기록 ${count}건은 이 CSV에 아직 반영되지 않았어요.`;
  }
  return ` ${recordsCountPhrase(count)}은 이 CSV에 아직 반영되지 않았어요. ${unsendableRecordsSuffixText(unsendableCount)}`;
}

/**
 * 카드가 부르는 단 하나의 함수. 대기 0건이면 **null**이라 아무것도 그리지 않는다 —
 * "0건이 빠졌어요" 같은 줄은 소음이고, 평소(대다수) 카드를 한 줄 밀어낼 이유가 없다.
 */
/**
 * 라운드 61 S-4 — **저장소를 못 열었으면 0건이어도 null이 아니다.** 그때의 0은 "세어 보니
 * 없더라"가 아니라 "세지 못했다"이고, 이 카드에서 침묵은 "다 담겼어요"로 읽힌다.
 *
 * 다만 **아이가 없으면 여전히 null**이다(로그아웃·아이 미선택). 그 상태에서는 내보내기 자체가
 * 없어 이 고지가 말할 대상(그 파일)이 존재하지 않는다 — `pendingRowsForExport`가 아무것도
 * 세지 않는 조건과 같은 자리다.
 */
export function evaluateExportPendingNotice(input: ExportPendingNoticeInput): ExportPendingNotice | null {
  const { count, unsendableCount } = countPendingExportBreakdown(input);
  const storage = input.storage ?? "ok";
  if (!input.childId) return null;
  if (storage === "ok" && count <= 0) return null;
  return { count, unsendableCount, text: exportPendingNoticeText(count, unsendableCount, storage) };
}
