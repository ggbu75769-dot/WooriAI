/**
 * User-facing copy for MOB-102 / EXP-005 (round5a-sprint1-plan.md §3.3, §3.4). Centralized so
 * every screen that touches offline save/sync/conflict state renders the exact same wording the
 * design doc specifies, and so tests can assert on the copy without duplicating literals.
 */

/** Shown immediately after a local (SQLite-first) save, before the server has confirmed it. */
export const OFFLINE_SAVED_MESSAGE = "기기에 저장했어요. 연결되면 자동으로 반영할게요.";

/** Shown only once the server has actually accepted the write -- never shown pre-emptively. */
export const SERVER_CONFIRMED_MESSAGE = "기록했어요. 이번 달 우리 아이 비용에 더해둘게요.";

/** Conflict banner headline (D-10 default). */
export const CONFLICT_BANNER_MESSAGE = "다른 기기에서 이 기록이 바뀌었어요.";

export const CONFLICT_OPTION_ADOPT_SERVER_LABEL = "다른 기기 값 유지";
export const CONFLICT_OPTION_REAPPLY_MINE_LABEL = "내 변경 다시 적용";
export const CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL = "두 값 나란히 보기";

/**
 * REC-123(H4) 동기화 상태 문구 단일 소스.
 *
 * 이 네 상태를 그리는 화면은 둘이다 — 기록 탭(app/(tabs)/records.tsx)의 배지·행 부제와, 그
 * 배지를 눌러 들어가는 동기화 상태 화면(app/sync-status.tsx). 두 화면이 각자 문자열을 인라인
 * 하는 동안 아래 상수들은 아무도 import하지 않았고, 그 사이 같은 상태의 표기가 셋으로 갈렸다:
 * 배지는 "대기", 기록 탭 행 부제는 "동기화 대기", 이 파일의 상수는 "충돌 발생". 한 흐름 안에서
 * 세 표기가 섞이면 사용자는 같은 상태를 서로 다른 것으로 읽는다(DNC-018 톤 일관성).
 *
 * 새 문구를 만들지 않고 **두 화면 중 더 명확한 쪽**으로 확정했다:
 * - 카운트가 붙는 배지/스크린리더 라벨: 두 화면이 이미 함께 쓰던 짧은 라벨("대기 3"). 숫자가
 *   바로 뒤에 붙는 자리라 "동기화 대기 3"보다 짧은 쪽이 읽기 쉽다.
 * - 기록 탭 행 부제: 기록 탭 쪽 긴 문구("동기화 대기", "동기화 실패 · 확인 필요"). 일반 지출
 *   행들 사이에 섞여 있어서 무엇에 대한 대기·실패인지 문장이 스스로 말해야 한다.
 */
export type SyncStatusKind = "pending" | "syncing" | "failed" | "conflict";

/** 카운트 배지·스크린리더 라벨에 쓰는 짧은 상태 이름. */
export const SYNC_STATUS_PENDING_LABEL = "대기";
export const SYNC_STATUS_SYNCING_LABEL = "동기화 중";
export const SYNC_STATUS_FAILED_LABEL = "실패";
export const SYNC_STATUS_CONFLICT_LABEL = "충돌";

/**
 * 라운드 51 QA(P3-9) — 전송이 실제로 나가 있는 행이 스스로 말하는 한 줄.
 *
 * 동기화 상태 화면의 지출 행과 준비템 행이 같은 문장을 각자 인라인 문자열로 들고 있었다.
 * REC-123(H4)이 정리한 그 문제(같은 상태를 화면·행마다 다른 말로 부르는 것)의 씨앗이라,
 * 배지 라벨과 **같은 단어**에서 문장을 만들어 한 곳에서만 정한다.
 */
export const SYNC_STATUS_SYNCING_ROW_MESSAGE = `${SYNC_STATUS_SYNCING_LABEL}이에요.`;

const SYNC_STATUS_LABELS: Record<SyncStatusKind, string> = {
  pending: SYNC_STATUS_PENDING_LABEL,
  syncing: SYNC_STATUS_SYNCING_LABEL,
  failed: SYNC_STATUS_FAILED_LABEL,
  conflict: SYNC_STATUS_CONFLICT_LABEL
};

/** 화면에 보이는 배지 문구 — "대기 3". */
export function syncStatusBadgeLabel(kind: SyncStatusKind, count: number): string {
  return `${SYNC_STATUS_LABELS[kind]} ${count}`;
}

/**
 * 스크린리더가 읽는 카운트 문구 — "대기 3건". 배지에는 단위 없이 숫자만 보이지만(공간 문제)
 * TalkBack에서는 "대기 3"이 무엇의 3인지 모호해 단위를 붙인다(A11Y-115).
 */
export function syncStatusCountLabel(kind: SyncStatusKind, count: number): string {
  return `${SYNC_STATUS_LABELS[kind]} ${count}건`;
}

/**
 * 기록 탭 목록에서 아직 서버에 반영되지 않은 행의 부제. 대기 행만 날짜가 뒤에 붙으므로
 * (`동기화 대기 · 8월 5일`) 상수는 접두 부분까지만 담는다.
 */
export const SYNC_ROW_PENDING_DELETE_LABEL = "삭제 대기 중";
export const SYNC_ROW_CONFLICT_LABEL = "다른 기기와 충돌 · 확인 필요";
export const SYNC_ROW_FAILED_LABEL = "동기화 실패 · 확인 필요";
export const SYNC_ROW_PENDING_LABEL = "동기화 대기";

/**
 * 라운드 59 트랙 A — **영구 실패(4xx) 행을 부르는 이름**. "동기화 대기"와 갈라 두는 단일 소스다.
 *
 * ## 왜 새 어휘가 필요한가
 *
 * `syncState !== "synced"`인 행을 한 단어로 "동기화 대기"라고 부르던 자리가 셋이었다(기록 탭
 * 합계 고지·리포트 고지·CSV 고지). 그런데 그중 일부는 **기다려도 반영되지 않는다**: 서버가
 * 400/403/404/422로 거절한 행은 payload가 그대로인 한 몇 번을 보내도 같은 답이 온다
 * (`isPermanentlyFailedSyncRow` — src/offline/permission-denied.ts). 그 행을 "대기 중"이라고
 * 부르는 문장은 사용자가 기다리기만 하면 숫자가 맞아떨어진다는 뜻이 되어, 실제로는 영원히
 * 오지 않을 시점을 약속한다(허위 안내).
 *
 * ## 왜 "실패"가 아니라 "보낼 수 없는 기록"인가
 *
 * 동기화 상태 화면의 짧은 배지 라벨은 이미 "실패"다(`SYNC_STATUS_FAILED_LABEL`). 그 단어를
 * 여기서 재사용하면 두 가지가 섞인다 — 그 배지는 **일시 실패**(5xx·네트워크, 다시 보내면 되는
 * 행)까지 함께 세기 때문이다. 이 어휘가 가리키는 것은 그중 다시 보내도 소용없는 갈래 하나뿐이라,
 * 상태 이름이 아니라 **할 수 없는 일**로 부른다. 그래야 바로 다음 행동(고쳐서 다시 보내기 ·
 * 버리기 — SYNC_STATUS_PERMANENT_FAILURE_HINT)이 같은 말에서 이어진다. 해요체(DNC-018).
 */
export const SYNC_ROW_UNSENDABLE_LABEL = "보낼 수 없는 기록";

/**
 * 영구 실패가 섞였을 때 고지의 **주어**. "동기화 대기 중인 기록 N건"을 대신한다 — 이 집합에는
 * 기다려도 오지 않을 행이 들어 있으므로 "대기"라고 부를 수 없고, 그렇다고 전부를 "보낼 수 없다"고
 * 하면 대다수(일시 실패·대기)에 대해 거짓이다. 그래서 수식을 **떼기만 한다**: 남는 것은 세어진
 * 것 자체("기록 N건")이고, 무엇이 참인지는 뒤따르는 술어가 말한다.
 *
 * 라운드 59 통합리뷰 P1-1 — 주어에 "아직 반영되지 않은"을 넣고 술어를 "빠져 있어요"로 바꾸던
 * 종전 문장을 되돌린 자리다. 그 술어는 세는 규칙보다 **세다**: 이 모집단에는 삭제 대기 행(리포트
 * 숫자에는 아직 들어 있다)과 수정 대기 행(CSV에는 옛 값으로 담긴다)이 섞여 있어, 그 부분집합에
 * 대해서는 "빠져 있다"가 그냥 거짓이다. 두 갈래의 술어는 이제 한 문장으로 같다 —
 * "…에 아직 반영되지 않았어요"(라운드 57 QA P1-2가 세운 약한 주장). 갈리는 것은 주어의 수식과
 * 뒤에 한 문장이 더 붙는지 뿐이다.
 */
export function recordsCountPhrase(count: number): string {
  return `기록 ${count}건`;
}

/**
 * 위 주어 뒤에 붙는 구분 한 문장 — 리포트 고지·CSV 고지가 **같은 문장**을 쓴다(둘의 모집단은
 * 다르지만 구분 규칙은 하나다).
 */
export function unsendableRecordsSuffixText(count: number): string {
  return `그중 ${count}건은 ${SYNC_ROW_UNSENDABLE_LABEL}이에요.`;
}

/**
 * 기록 탭 목록 고지. 이 자리만 "그중"이 아니라 "이 중"인 이유: 리포트·CSV의 고지는 **앞 문장이
 * 센 숫자**를 되받지만(그중), 기록 탭은 바로 위에 **행 목록 자체가 보이는** 자리라 지시 대상이
 * 문장이 아니라 화면이다. 합계에서 빼지 않는 대신 이 한 줄이 서는 이유는
 * `src/offline/expense-list-reconciliation.ts`의 `permanentlyFailedCount` 주석 참고.
 */
export function unsendableRowsNoticeText(count: number): string {
  return `이 중 ${count}건은 ${SYNC_ROW_UNSENDABLE_LABEL}이에요.`;
}

/**
 * 라운드 61 M-1 — 아래 긴 고지의 **가운데 한 문장**. 저장소를 못 열었을 때 이 앱이 아는 것은
 * "0건"이 아니라 **모름**이라는 사실만 말한다.
 *
 * ## 왜 조각으로 떼어 두는가
 *
 * 이 사실을 말해야 하는 자리가 셋인데 길이 예산이 다르다: 동기화 상태 화면의 빈 상태 카드는
 * 세 문장(무슨 일이 있었나 · 그래서 모르는 것 · 다음에 할 일)을 다 실을 수 있지만, 홈 최하단
 * 한 줄(design-system/patterns/AsyncState.tsx의 `SyncStatusBar`)과 CSV 내보내기 고지
 * (src/export/export-pending-notice.ts)는 한 줄짜리 자리다. 그 자리에 새 문장을 지어 넣으면
 * 같은 상태를 부르는 말이 다시 셋으로 갈린다(REC-123(H4)이 정리한 그 문제).
 *
 * 그래서 **새 단정을 만들지 않고 이 한 문장을 나눠 쓴다.** 아래 상수는 이 문장을 그대로
 * 품으므로 두 자리의 어휘가 구조적으로 어긋날 수 없다(messages.test.ts가 그 포함 관계를 고정).
 * "열지 못했어요"·"다시 켜면 다시 시도할게요"를 함께 싣지 않는 이유는 짧은 자리의 예산 때문이지
 * 그 사실을 숨기려는 것이 아니다 — 그 두 문장은 줄을 눌러 들어가는 동기화 상태 화면이 말한다.
 *
 * DNC-018: 해요체, 비난·지시형 없음. 건수를 말하지 않는다(0건도 주장할 수 없다).
 */
export const OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE = "대기 중인 기록이 있는지 지금은 알 수 없어요.";

/**
 * 라운드 61 #6 — **이 기기의 저장소를 열지 못했을 때** 동기화 상태 화면이 띄우는 한 줄.
 *
 * ## 왜 새 문장이 필요한가
 *
 * 그 화면의 빈 상태 문구는 "모든 기록이 동기화됐어요."다. 저장소를 못 연 상태에서는 그 문장이
 * **확인할 방법이 없는 주장**이 된다: 대기 건수도 실패 건수도 저장소에서 읽는 값인데, 그 저장소가
 * 안 열렸으니 화면이 아는 것은 0이 아니라 **모름**이다. 아직 서버에 못 보낸 지출을 들고 있는
 * 사람에게 "전부 동기화됐다"고 말하는 것은 사용자가 그 자리에서 반박할 수도 없는 종류의
 * 거짓말이다(DNC: 허위 데이터 표시 금지).
 *
 * ## 문장이 말하는 것과 말하지 않는 것
 *
 * 말하는 것: (1) 지금 일어난 일 — 저장소를 열지 못했다, (2) 그래서 모르는 것 — 대기 중인 기록이
 * 있는지, (3) 사용자가 할 수 있는 일 — 앱을 다시 켜면 다시 시도한다.
 *
 * 말하지 않는 것: **기록이 사라졌다/안전하다**는 어느 쪽 주장도 하지 않는다. 열지 못한 파일의
 * 내용은 이 앱도 모른다. 또 "곧 자동으로 복구할게요" 같은 약속도 하지 않는다 — 재시도는 이 앱
 * 세션에 한 번뿐이고(store-open-gate.ts), 그 한 번이 실패하면 다음 기회는 정말로 재시작이다.
 *
 * DNC-018: 해요체·비난 없음("저장 공간을 확보하세요" 같은 지시형 대신 상태를 담담히 말한다).
 *
 * ## 실기기 확인 항목이 좁아지는 자리
 *
 * docs/qa/runtime-verification-required.md의 잔여 리스크 항목("마이그레이션 실패 시 사용자
 * 가시성 — 의도된 브릭이지만 표시 미확인", round58-scout P3)은 지금까지 "실패하면 사용자에게
 * 무엇이 보이는가?"라는 열린 질문이었다. 코드가 답을 갖게 됐으므로 기기에서 볼 것은 **뜨는지
 * 확인하는 일**로 좁혀진다.
 *
 * 라운드 61 S-3 — 그 문서의 §5 항목을 실제로 그렇게 갱신했다(그전까지 이 문단만 좁혀졌다고
 * 적고 있었고 문서는 옛 문장 그대로였다). 지금 그 항목이 이름을 대는 것은 **두 줄**이다:
 * 이 상수(동기화 상태 화면, 재오픈 게이트 1회 동작 포함)와, 홈 최하단 동기화 줄의 `"unknown"`
 * 상태(라운드 61 M-1 — src/home/home-sync-status.ts, 문구는 바로 위
 * `OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE`).
 */
export const OFFLINE_STORAGE_UNAVAILABLE_NOTICE =
  `이 기기의 저장소를 열지 못했어요. ${OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE} 앱을 다시 켜면 다시 시도할게요.`;

export const SYNC_STATUS_RETRY_LABEL = "재시도";
export const SYNC_STATUS_DISCARD_LABEL = "삭제";

/**
 * 라운드 58 #5 — 재시도가 무익한 실패 행(4xx, 403 제외)에서 **재시도 자리를 대신하는 행동**.
 *
 * 라운드 57 #8은 그 행의 재시도 버튼을 안내 한 줄로 바꿨다("다시 보내도 같은 결과예요. 내용을
 * 고쳐 새로 기록하거나 버려 주세요." — permission-denied.ts). 그런데 그 "내용을 고쳐 새로
 * 기록하는" 길이 화면에 없었다: 사용자는 실패 행의 값을 눈으로 읽어 기억한 뒤, 기록 시트를 새로
 * 열어 품목명·금액·분류·결제 수단·판매처·메모·날짜를 전부 다시 쳐야 했다(그리고 원본 실패 행은
 * 그대로 남아 스스로 버려야 했다). 이 버튼이 그 두 단계를 하나로 만든다 — 행의 payload를 그대로
 * 실은 기록 시트가 열리고, **저장이 확정된 뒤에만** 원본 행이 사라진다.
 *
 * 문구: "수정"이 아니라 문장형인 이유는 이 행이 서버에 없는 기록이라 "수정"할 대상이 없기
 * 때문이다 — 실제로 일어나는 일은 고쳐서 **다시 보내는** 것이다. 해요체·비난 없음(DNC-018).
 */
export const SYNC_STATUS_FIX_AND_RESEND_LABEL = "고쳐서 다시 보내기";

/**
 * 라운드 58 #5 — 위 버튼으로 연 기록 시트에서 **날짜만 프리필하지 못했을 때** 뜨는 한 줄.
 *
 * 언제 뜨나: 실패 행의 `spentOn`이 이 시트의 날짜 가드를 통과하지 못할 때다. 실제로 그런 행이
 * 존재한다 — 기기 시계가 앞서 있거나 자정 경계에서 만들어진 행은 서울 기준 미래 날짜로 저장돼
 * 서버에서 400(EXPENSE_FUTURE_DATE)을 받고 실패 행으로 굳는다. 즉 **바로 그 날짜 때문에 실패한
 * 행**이 이 버튼의 대표 사례다.
 *
 * 왜 날짜를 지어내지 않나: 앱이 "오늘"로 조용히 바꿔 저장하면 사용자가 고른 적 없는 날짜가
 * 기록에 남고, 그 달 합계가 사실과 어긋난다(DNC: 허위 데이터 금지). 그래서 지금 상태를 그대로
 * 밝히고 고르는 것은 사용자에게 남긴다 — 날짜 칩·달력은 바로 위에 있다. 해요체(DNC-018).
 */
export const FAILED_ROW_PREFILL_DATE_RESET_NOTICE = "그 날짜로는 저장할 수 없어서 오늘로 두었어요. 맞는 날짜를 골라 주세요.";

/**
 * 라운드 58 통합리뷰 P1-1 — 실패 행의 아이와 **지금 선택된 아이**가 어긋날 때 저장을 막는 한 줄.
 *
 * 이 시트의 저장은 언제나 지금 선택된 아이 밑으로 간다. 그래서 아이 A의 실패 행을 B가 선택된
 * 상태에서 고쳐 저장하면 그 지출이 B의 합계에 들어가고, 저장 확정과 동시에 A의 원본 실패 행이
 * 폐기돼 되돌릴 방법이 사라진다(서버에 없는 행이다 — 데이터 손실).
 *
 * 그래서 조용히 옮겨 담지 않고 **막고 말한다**. 무엇을 하면 되는지까지 한 문장에 담는다:
 * 아이를 그 기록의 아이로 되돌리면 그대로 이어서 저장할 수 있다(입력값은 남는다).
 * 해요체·책망 없음(DNC-018).
 */
export const FAILED_ROW_PREFILL_CHILD_MISMATCH_NOTICE =
  "이 기록은 다른 아이의 기록이에요. 그 아이로 바꾼 뒤에 저장할 수 있어요.";

/**
 * SYNC-127 일괄 액션 문구. 개별 행의 "재시도"/"삭제"와 같은 동사를 쓰되 범위를 앞에 붙여
 * ("전체") 한 화면 안에서 두 액션이 서로 다른 것을 가리킨다는 사실이 문구만으로 드러나게 한다.
 * 버리기 쪽만 "삭제"가 아니라 "버리기"인 이유: 개별 삭제는 한 건이라 취소가 쉽지만, 일괄은
 * 되돌릴 수 없는 파괴적 동작이라 확인 Alert를 거친다 -- 문구도 그만큼 무겁게 읽혀야 한다.
 */
/** "버리기" 동사 단일 소스 — 아래 범위별 두 라벨이 같은 단어를 쓴다. */
const SYNC_STATUS_DISCARD_ALL_VERB = "버리기";
export const SYNC_STATUS_RETRY_ALL_LABEL = `전체 ${SYNC_STATUS_RETRY_LABEL}`;
export const SYNC_STATUS_DISCARD_ALL_LABEL = `전체 ${SYNC_STATUS_DISCARD_ALL_VERB}`;
export const SYNC_STATUS_DISCARD_ALL_CONFIRM_TITLE = "실패한 기록을 모두 버릴까요?";

/**
 * 라운드 51 QA(P2-3) — 실패 섹션의 일괄 버튼이 **무엇을** 다루는지 문구가 말한다.
 *
 * 그 섹션에는 지출 실패 행과 준비템 상태 실패 행이 함께 서는데(app/sync-status.tsx), 두 버튼이
 * 부르는 컨트롤러 함수는 지출 큐만 다룬다. 그 자리에서 "전체 재시도"라고 하면 라벨이 화면에
 * 보이는 전부를 가리키는 말로 읽혀, 준비템 실패 행이 남아 있는데도 "전체"를 눌렀다고 믿게 된다.
 * 그래서 대상(지출)과 건수를 라벨이 직접 말한다 — 스크린리더도 같은 문장을 읽으므로 별도
 * 접근성 문구를 만들지 않는다.
 */
export function syncStatusRetryFailedExpensesLabel(count: number): string {
  return `지출 ${count}건 ${SYNC_STATUS_RETRY_LABEL}`;
}

export function syncStatusDiscardFailedExpensesLabel(count: number): string {
  return `지출 ${count}건 ${SYNC_STATUS_DISCARD_ALL_VERB}`;
}

/** 확인 Alert 본문. 몇 건이 사라지는지 숫자로 못박고, 서버에 없는 기록이라는 사실을 밝힌다. */
export function syncStatusDiscardAllConfirmMessage(count: number): string {
  return `${count}건은 아직 이 기기에만 저장돼 있어요. 버리면 되돌릴 수 없어요.`;
}

/**
 * GAP-062 #3 — **대기 행** 하나를 버리는 행동의 문구.
 *
 * 라벨이 개별 실패 행의 "삭제"(`SYNC_STATUS_DISCARD_LABEL`)가 아니라 일괄 액션의 동사
 * ("버리기")를 쓰는 이유: 이 행은 **되돌릴 수 없다**. 실패 행은 이미 서버가 거절해 멈춰 선
 * 행이고 화면이 그 사실을 말하고 있지만, 대기 행은 가만히 두면 곧 반영될 멀쩡한 기록이라
 * 없애는 쪽이 사용자의 값을 실제로 지운다 — 확인 Alert를 거치는 무게(전체 버리기와 같은
 * 관례)를 라벨도 함께 져야 한다. 그래서 동사 단일 소스를 그대로 쓴다.
 *
 * 본문이 "이 기기에만 저장돼 있어요"라고 단언할 수 있는 것은 이 버튼이 **생성 대기 행에만**
 * 서기 때문이다(src/offline/pending-row-actions.ts — 수정·삭제 대기 행에는 서버 값이 따로
 * 있어 그 문장이 거짓이 된다). 문장은 전체 버리기 본문과 같은 두 가지를 말한다: 어디에만
 * 있는지, 되돌릴 수 있는지. 해요체(DNC-018).
 */
export const SYNC_STATUS_DISCARD_PENDING_LABEL = SYNC_STATUS_DISCARD_ALL_VERB;
export const SYNC_STATUS_DISCARD_PENDING_CONFIRM_TITLE = "이 기록을 버릴까요?";
export const SYNC_STATUS_DISCARD_PENDING_CONFIRM_MESSAGE =
  "아직 이 기기에만 저장돼 있어요. 버리면 되돌릴 수 없어요.";

/**
 * AUTH-127 — 로그인 화면 안내. 리프레시 토큰이 만료(30일)되거나 재사용 감지로 폐기돼
 * 사용자가 원하지 않은 로그아웃이 일어났을 때만 뜬다(명시적 로그아웃에는 뜨지 않는다).
 * 뒷문장이 오프라인 대기분을 약속하는 이유: AUTH-127이 만료 시 outbox를 보존하기로 했고,
 * 같은 계정으로 다시 로그인하면 실제로 그대로 이어서 전송된다(src/offline/session-expiry.ts).
 * 지키지 못할 약속을 하지 않는다 -- 다른 계정으로 로그인하면 PRIV-104 teardown이 그대로
 * 동작하지만, 그 경우 이 안내를 읽은 사람과 로그인한 사람이 다르다.
 */
export const SESSION_EXPIRED_LOGIN_NOTICE =
  "세션이 만료됐어요. 다시 로그인하면 저장하지 않은 기록도 이어서 반영할게요.";

/**
 * UX-N — 조회 실패 카드 문구 단일 소스.
 *
 * ## 무엇이 문제였나
 *
 * 조회 실패 카드는 원인과 상관없이 늘 "불러오지 못했어요. 잠시 후 다시 시도해 주세요."였다.
 * 지하철·엘리베이터처럼 아예 연결이 없는 자리에서는 이 문장이 사실과 어긋난다: 기다릴 대상이
 * 없고, [다시 시도]를 눌러도 같은 실패로 되돌아온다. 사용자가 읽는 것은 "앱이 고장났다"이고,
 * 실제로는 그냥 오프라인이다.
 *
 * ## 왜 "연결되면 자동으로 불러올게요"라고 하지 않았나
 *
 * 처음 후보 문구는 "지금은 오프라인이에요. 연결되면 자동으로 불러올게요."였다. 확인해 보니 이
 * 앱에서는 그 약속을 지킬 수 없다 — react-query의 `refetchOnReconnect` 기본값(true)은 그대로지만,
 * 그 트리거가 되는 onlineManager 배선은 FIX-118A에서 의도적으로 제거됐다(src/query/app-refetch.ts
 * 헤더 참고: online=false 동안 쿼리가 paused로 묶여 무한 스피너·백지 화면을 만들었다). RN에는
 * window의 online 이벤트도 없으므로 네이티브에서 재연결 재조회는 **한 번도 발화하지 않는다**.
 * 실제로 배선된 자동 갱신은 포그라운드 복귀(focusManager ← AppState "active")뿐이다.
 *
 * 그래서 못 지킬 약속 대신 지금 할 수 있는 행동을 말한다: "연결된 뒤 다시 시도해 주세요".
 * (onlineManager를 다시 배선하게 되면 이 문구를 "연결되면 자동으로"로 되돌릴 수 있다.)
 *
 * ## 버튼은 그대로 둔다
 *
 * 오프라인이라고 [다시 시도]를 숨기지 않는다. 오프라인 판정은 point-in-time 폴 한 번이라
 * (isCurrentlyOnline, web에서는 항상 true) 틀릴 수 있고, 판정이 틀렸을 때 사용자가 되돌릴
 * 유일한 수단이 이 버튼이다. 문구만 정직해지고 구조·동작은 그대로다(DNC-018: 비난·불안 문구 금지 —
 * "연결을 확인하세요" 같은 지시형 대신 상태를 담담히 말한다).
 */
export const LOAD_ERROR_NOTICE = "불러오지 못했어요. 잠시 후 다시 시도해 주세요.";

/**
 * "지금은 연결이 없다 + 다음에 할 수 있는 일"을 말하는 한 문장. 조회 실패 카드에서 시작했지만
 * 같은 문장이 필요한 자리가 더 있다(라운드 52 C-05: 구성원 삭제·초대 취소 실패). 이름을 동작에
 * 묶지 않고 여기 한 번만 적는다 — 같은 상황을 화면마다 다른 말로 부르지 않기 위해서다.
 */
export const OFFLINE_RETRY_NOTICE = "지금은 오프라인이에요. 연결된 뒤 다시 시도해 주세요.";

/** UX-N 조회 실패 카드가 쓰는 이름. 위 문장과 **같은 값**이다(기존 소비자 이름을 유지한다). */
export const OFFLINE_LOAD_NOTICE = OFFLINE_RETRY_NOTICE;
export const LOAD_ERROR_RETRY_LABEL = "다시 시도";

export type LoadErrorCopy = { title: string; actionLabel: string };

/**
 * 순수 판정 함수: 연결 상태만 보고 카드 문구·버튼 라벨을 고른다. 화면은 이 결과를
 * EmptyStateCard에 그대로 넘긴다(문자열만 교체, 구조 변경 없음).
 *
 * `isOnline: true`는 "온라인인데 요청이 실패했다"(서버 오류·타임아웃 등)와 "연결 상태를 알 수
 * 없다"(web 폴백)를 함께 덮는 기본값이라, 판정이 어긋나도 기존 문구로 안전하게 떨어진다.
 */
export function resolveLoadErrorCopy({ isOnline }: { isOnline: boolean }): LoadErrorCopy {
  return {
    title: isOnline ? LOAD_ERROR_NOTICE : OFFLINE_LOAD_NOTICE,
    actionLabel: LOAD_ERROR_RETRY_LABEL
  };
}

/**
 * 라운드 52 C-07 — **저장** 실패 문구의 오프라인 갈래.
 *
 * ## 어떤 저장인가 (여기가 적용 범위의 전부다)
 *
 * 이 앱의 지출 기록은 SQLite 우선 저장이라 연결이 없어도 성공하고, 대기분은 아웃박스가 나중에
 * 올린다(MOB-102/EXP-005). 그런데 **월 예산 저장(app/budget.tsx)** 과 **아이 프로필 저장·추가
 * (app/settings/children.tsx)** 는 아웃박스를 거치지 않는 서버 직행 쓰기다. 그래서 오프라인에서
 * 누르면 그냥 실패하는데, 두 화면 모두 원인과 무관하게 "저장하지 못했어요. 잠시 후 다시 시도해
 * 주세요."라는 한 문장만 띄웠다. 지하철·엘리베이터에서 그 문장은 사실과 어긋난다 — 기다릴 대상이
 * 없고, 다시 눌러도 같은 실패로 되돌아온다(LOAD_ERROR_NOTICE 헤더의 조회 쪽 문제와 같은 모양이다).
 *
 * ## "연결되면 자동으로 저장할게요"라고 하지 않는 이유
 *
 * 그렇게 말하려면 이 두 쓰기를 담아 둘 대기열이 있어야 한다. 예산·아이 프로필에는 없다(아웃박스는
 * 지출 전용이고, 이번 변경은 새 대기열을 만들지 않는다). 지키지 못할 약속 대신 지금 할 수 있는
 * 행동만 말한다: "연결된 뒤 다시 저장해 주세요".
 *
 * 온라인 쪽 문장이 지출 저장 실패(EXPENSE_CREATE_FAILED_MESSAGE)와 **글자까지 같은 것은
 * 의도한 것**이다 — 같은 실패가 화면마다 다르게 들리지 않아야 한다. 갈라지는 것은 오프라인
 * 갈래뿐이다.
 */
export const SAVE_ERROR_NOTICE = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
export const OFFLINE_SAVE_NOTICE = "지금은 오프라인이에요. 연결된 뒤 다시 저장해 주세요.";

/**
 * 순수 판정 함수: 연결 상태만 보고 저장 실패 문구를 고른다. 화면은 저장이 실패한 그 순간에
 * 연결을 한 번 확인해(isCurrentlyOnline) 이 함수에 넘긴다.
 *
 * `isOnline: true`가 기본 안전값인 이유는 resolveLoadErrorCopy와 같다 — "온라인인데 실패했다"와
 * "연결 상태를 알 수 없다"(web 폴백)를 함께 덮어, 판정이 어긋나도 기존 문구로 떨어진다.
 */
export function resolveSaveErrorCopy({ isOnline }: { isOnline: boolean }): string {
  return isOnline ? SAVE_ERROR_NOTICE : OFFLINE_SAVE_NOTICE;
}
