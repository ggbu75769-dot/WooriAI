import { formatKrw } from "../money";
import { countsTowardMonthlyTotal } from "../offline/expense-list-reconciliation";
import { recordsCountPhrase, SYNC_ROW_PENDING_LABEL, unsendableRecordsSuffixText } from "../offline/messages";
import { countPermanentlyFailedRows } from "../offline/permission-denied";
import { milestoneSubtitleShowsTotal } from "./milestone-countdown";

/**
 * 라운드 48 B2 — 홈 "임신~첫돌 누적 총액" 카드의 **표시 판정**과 문구.
 *
 *   "지금까지의 지출 합계 1,245,700원"
 *
 * ## 왜 필요한가
 *
 * 홈은 이미 서버에서 전 기간 누적을 받는다(`HomeSummary.totalExpenseKrw` —
 * apps/api/src/onboarding/reporting-store.service.ts). 그런데 그 숫자를 화면에 내는 곳은
 * 마일스톤 카운트다운 카드의 부제 **한 곳뿐**이고, 그 카드는
 *  - `stageMode !== "born"`이면 아예 만들어지지 않고(임신 단계·manual),
 *  - 첫돌이 지나면 셀 다음 마일스톤이 없어 스스로 사라진다
 * (src/home/milestone-countdown.ts). 그래서 임신기 내내, 그리고 첫돌 다음 날부터 영원히,
 * 이 앱이 세는 가장 큰 숫자 — "임신부터 지금까지 이 아이에게 쓴 돈" — 가 홈 어디에도 없다.
 * 정작 그 시기는 지출이 가장 많은 때(출산 준비)이거나, 누적을 되돌아보기 가장 좋은 때다.
 *
 * ## 중복 금지 (F5 · L1 선례)
 *
 * 마일스톤 카드가 떠 있고 그 부제가 이미 금액을 말하고 있으면 이 카드는 **접는다**. 같은
 * 사실을 한 화면에서 두 번 말하지 않는다는 홈의 기존 규율이고, 판정은 마일스톤 모듈이
 * 내보내는 `milestoneSubtitleShowsTotal` 하나를 그대로 쓴다 — 문구 규칙을 여기서 다시
 * 짐작하면(예: "카드가 있으면 무조건 접는다") 기록이 0건인 달에는 마일스톤 부제가 권유
 * 문장이라 누적을 말하는 자리가 아무 데도 없게 된다.
 *
 * ## 허위 표시 방지
 *
 * - 누적을 **모르면 카드를 만들지 않는다**(응답 전·필드 없음 → null). 0원으로 떨어뜨리면
 *   확인한 적 없는 사실을 말하게 된다(budget-edit.ts의 사용액 줄과 같은 규율).
 * - 누적이 0원인 계정에도 만들지 않는다. "지금까지의 지출 합계 0원"은 첫 기록을 앞둔 사람에게
 *   할 말이 아니고, 그 자리는 이미 첫 지출 유도 카드가 맡고 있다(src/home/first-run-guide.ts).
 * - 금액은 홈이 이미 들고 있는 서버 집계를 **그대로** 쓴다. 새 요청도, 클라이언트 재집계도
 *   없다(선물·환불 제외 — DNC-015).
 * - 부제가 **구간과 제외 항목**을 스스로 밝힌다. 이 숫자는 월 히어로(이번 달)와도, 마일스톤
 *   리포트의 창 합계(100일·첫돌)와도 다른 **전 기간** 합계이고, 그 전 기간 안에서도 선물은
 *   빠져 있기 때문이다(DNC-015). 라운드 33 F5가 마일스톤 부제에서 고친 것과 같은 종류의 오해를
 *   여기서 다시 만들지 않는다 — 자세한 근거는 아래 CUMULATIVE_TOTAL_SUBTITLE 참고.
 *
 * React/react-native/네트워크에 의존하지 않는다 — 화면 밖에서 vitest로 검증하기 위해서다
 * (src/home/budget-progress.ts와 같은 관례).
 */

export type HomeCumulativeTotal = {
  /** 카드 제목 — "지금까지의 지출 합계 1,245,700원". */
  title: string;
  /** 구간과 제외 항목을 밝히는 한 줄 — 이번 달 합계·마일스톤 리포트 합계와 혼동되지 않게. */
  subtitle: string;
  /**
   * GAP-062 #9 — 아직 서버에 반영되지 않은 기록이 있을 때만 서는 한 줄. 없으면 null이라 카드는
   * 예전과 완전히 같다(자세한 근거는 아래 `cumulativeTotalPendingNoticeText`).
   */
  pendingNotice: string | null;
  /** TalkBack 문장(제목 + 부제 + 고지를 한 번에 읽는다). */
  accessibilityLabel: string;
};

/**
 * GAP-062 #9 — 이 판정이 오프라인 스냅숏 행에서 읽는 것 전부(src/offline/types.ts와 구조 호환).
 * 리포트 고지가 쓰는 모양과 같다(src/reports/pending-scope-notice.ts) — 다른 것은 **기간이
 * 없다**는 점뿐이라 `spentOn`을 보지 않는다.
 */
export type CumulativeTotalPendingRow = {
  syncState: string;
  /** 영구 실패(4xx) 갈래를 가르는 데 필요한 사유. 전부 선택 — 모르면 종전대로 일시 실패로 읽힌다. */
  lastError?: string | null;
  lastErrorStatus?: number | null;
  lastErrorCode?: string | null;
  payload?: { expenseType?: string | null } | null;
};

export type HomeCumulativeTotalInput = {
  /**
   * 세션이 있는 실제 홈인지. 비세션 미리보기(previewHome)는 픽셀락 HOME-001 캡처의 원본이라
   * 카드가 하나도 늘면 안 된다(UX-A 카드들과 같은 게이트).
   */
  hasSession: boolean;
  /** HomeSummary.totalExpenseKrw — 전 기간 누적(선물·환불 제외, DNC-015). 모르면 null. */
  totalExpenseKrw: number | null | undefined;
  /**
   * 마일스톤 카운트다운 카드가 지금 홈에 떠 있는지(`evaluateMilestoneCountdown`의 결과가
   * null이 아닌지). 떠 있고 그 부제가 금액을 말하는 중이면 이 카드는 접힌다.
   */
  hasMilestoneCard: boolean;
  /**
   * GAP-062 #9 — **지금 보고 있는 아이의** 오프라인 스냅숏 행(홈이 이미 구독 중인
   * `childOfflineRows`). 모르면 생략 — 그때는 고지를 만들지 않는다(없는 사실을 말하지 않는다).
   */
  pendingRows?: readonly CumulativeTotalPendingRow[] | null;
};

/**
 * 카드 제목의 앞머리(뒤에 금액이 붙는다).
 *
 * 라운드 48 QA(P2-3) — 예전 문구 "지금까지 함께한 지출"을 버린다. 그 표현은 **라운드 33 F5가
 * 마일스톤 부제에서 이미 폐기한 것**이다(src/home/milestone-countdown.ts 금액 규칙 참고):
 * "지금까지"가 어느 구간인지 말하지 않아, 카드 금액과 마일스톤 리포트의 창 합계가 같아야 할
 * 것처럼 읽혔다. 그 판단으로 마일스톤 부제는 "지금까지 총 지출"이 됐는데, 이 카드가 폐기된 쪽을
 * 되살려 두 카드가 같은 숫자를 서로 다른 이름으로 부르고 있었다.
 */
export const CUMULATIVE_TOTAL_TITLE_PREFIX = "지금까지의 지출 합계";

/**
 * 구간과 제외 항목을 함께 밝히는 한 줄.
 *
 * 라운드 48 QA(P2-3) — 예전 부제 "임신 때부터 지금까지 기록한 전체 합계예요"는 두 군데가 사실과
 * 어긋났다.
 *
 * ① **"임신 때부터"가 거짓일 수 있다.** 이 숫자의 시작점은 임신이 아니라 **이 앱에 기록을
 *    남기기 시작한 시점**이다. 출산 후에 가입한 사람, 생년월일 없이 시작한 manual 아이에게는
 *    임신기 지출이 애초에 한 건도 없다 — 그런 계정에 "임신 때부터"라고 적으면 이 앱이 세지
 *    않은 기간까지 센 것처럼 말하는 셈이다.
 * ② **"전체 합계"가 아니다.** `HomeSummary.totalExpenseKrw`는 `expenseType='expense'`만
 *    더한다(DNC-015: 선물 제외 — apps/api/src/onboarding/reporting-store.service.ts). 선물로
 *    받아 기록해 둔 항목은 이 숫자에 없는데 "전체"라고 말하면, 사용자는 기록 탭에서 보이는
 *    합과 이 카드가 왜 다른지 알 길이 없다. 빼놓은 것이 있으면 그 사실을 카드가 스스로 밝힌다.
 *
 * 그래서 시작점은 확인 가능한 사실("기록을 시작한 뒤")로, 범위는 제외 항목을 괄호로 명시한다.
 * 마일스톤 부제의 근거 주석(전 기간 누적 ≠ 리포트 창 합계)과도 어긋나지 않는다 — 여전히
 * "창이 아닌 전 기간"이라고 말하되, 그 전 기간의 시작을 지어내지 않을 뿐이다.
 */
export const CUMULATIVE_TOTAL_SUBTITLE = "기록을 시작한 뒤의 지출을 모두 더했어요 (선물로 받은 건 제외)";

/** 고지 한 줄의 식별자(리포트 고지의 `REPORT_PENDING_SCOPE_NOTICE_TEST_ID`와 같은 관례). */
export const HOME_CUMULATIVE_TOTAL_PENDING_NOTICE_TEST_ID = "home-cumulative-total-pending-notice";

/**
 * GAP-063 트랙 A — **리포트 탭 누적 카드**의 같은 고지 한 줄.
 *
 * 식별자를 이 모듈에 두는 이유는 그 카드가 그리는 숫자(`getCumulativeReport`의
 * `totalExpenseKrw` — `expenseType='expense'`, 삭제 제외, 기간 없음)가 홈 누적 카드와 **같은
 * 모집단**이기 때문이다. 세는 규칙도 문구도 아래 `cumulativeTotalPendingNotice` 한 벌을
 * 그대로 부르므로, 두 화면이 다른 말을 하게 될 자리가 없다.
 */
export const REPORT_CUMULATIVE_TOTAL_PENDING_NOTICE_TEST_ID = "reports-cumulative-total-pending-notice";

/**
 * GAP-062 #9 — **이 카드가 오프라인 대기를 밝히는 한 줄.**
 *
 * ## 무엇이 문제였나
 *
 * 같은 화면의 히어로 금액은 재조정된 값이다(`reconcileMonthlyExpenses` — 서버 응답 + 이 기기의
 * 대기 행). 그런데 바로 아래 이 카드는 서버 집계(`totalExpenseKrw`)를 **그대로** 쓴다. 그래서
 * 오프라인으로 5건을 적은 직후 홈에서 히어로는 그 5건을 포함한 이번 달 금액을, 누적 카드는
 * 그 5건이 빠진 전 기간 금액을 말한다 — 한 화면의 두 숫자가 서로 다른 시점을 말한다.
 *
 * 부제는 이미 제외 항목을 스스로 밝히는 자리인데("선물로 받은 건 제외") **아직 반영되지 않은
 * 기록**은 밝히지 않았다. 정직성 규율(빼놓은 것은 밝힌다)을 이 카드만 절반 지키고 있었다.
 *
 * ## 왜 숫자를 고치지 않는가
 *
 * 재집계는 **불가능하다**: 누적은 전 기간이라 클라이언트에 재조정할 모집단(월 캐시) 자체가
 * 없다(H절 "기간 합계 엔드포인트"는 여전히 비범위). 그래서 답은 숫자를 고치는 것이 아니라
 * 사실을 밝히는 것이다 — 리포트 탭이 같은 이유로 이미 택한 답이고
 * (src/reports/pending-scope-notice.ts 머리말), 이 줄은 그 결정을 그대로 따른다.
 *
 * ## 무엇을 세는가 (리포트 고지와 같은 술어, 기간만 없다)
 *
 * `syncState !== "synced"`이고 **이 숫자를 실제로 움직일** 행만 센다 — 판정은 합계와 같은 단일
 * 소스다(`countsTowardMonthlyTotal`, DNC-015: `totalExpenseKrw`도 `expenseType='expense'`만
 * 더한다). 선물·환불 대기 행을 세면 그것들이 동기화된 뒤에도 이 금액은 한 원도 움직이지 않아,
 * 사용자를 오지 않을 변화에 기다리게 하는 안내가 된다.
 *
 * 다른 것은 **기간 필터가 없다**는 점 하나다. 리포트 고지는 보고 있는 달/분기/연도로 자르지만
 * (`spentOn` 기준) 이 카드의 모집단은 전 기간이라 자를 것이 없다.
 *
 * ## 어휘 (offline/messages.ts 단일 소스)
 *
 * 문장은 리포트 고지와 **같은 두 조각**으로 만든다: 주어("동기화 대기 중인 기록 N건" / 영구
 * 실패가 섞이면 수식을 뗀 "기록 N건" + "그중 M건은 보낼 수 없는 기록이에요.")와 약한 술어
 * ("아직 반영되지 않았어요"). 술어를 "빠져 있어요"로 세게 쓰지 않는 이유도 같다 — 이 모집단에는
 * 삭제 대기 행(그 금액이 아직 **들어 있다**)이 섞인다.
 *
 * 갈리는 것은 지시어 하나다: 리포트 고지는 화면 아래의 숫자들을 가리켜 "아래 숫자에"라고 하고,
 * 이 카드는 **바로 위 제목의 금액**을 가리키므로 "이 금액에"라고 한다. 같은 자리를 가리키지
 * 않는 두 문장을 한 상수로 묶으면 둘 중 하나가 화면에서 엉뚱한 곳을 짚는다.
 *
 * ## GAP-063 트랙 A — 이 문장이 서는 자리가 셋이 됐다
 *
 * 라운드 62는 이 줄을 **홈 누적 카드 한 장에만** 붙였는데, 그 카드는 마일스톤 카운트다운
 * 카드가 서면 스스로 접힌다(아래 `evaluateHomeCumulativeTotal`의 `hasMilestoneCard` 게이트).
 * 접히는 이유가 "그 카드가 이미 같은 금액을 말하고 있어서"인데 정작 그 카드의 부제는 같은
 * `totalExpenseKrw`를 **고지 없이** 그렸다 — 즉 대상 사용자의 대다수가 머무는 생후 0일~첫돌
 * 구간에서는 라운드 62의 고지가 구조적으로 한 번도 뜨지 않았다. 리포트 탭의 누적 카드도
 * 같은 숫자를 말없이 그린다(그 탭 머리의 고지는 **선택한 기간**만 세므로 무기간인 이 숫자를
 * 가리키지 못한다 — src/reports/pending-scope-notice.ts).
 *
 * 그래서 문구를 새로 만들지 않고 **같은 함수**(아래 `cumulativeTotalPendingNotice`)를 세 자리가
 * 부른다: 홈 누적 카드 · 홈 마일스톤 카드 부제 · 리포트 탭 누적 카드. 셋 다 지시어가 짚는
 * 대상이 같다 — 바로 위에 선 전 기간 누적 금액이다.
 *
 * 마일스톤 **리포트** 카드(리포트 탭의 창 합계 — "태어나서 100일 동안 N원")는 여기서 뺀다.
 * 그 숫자의 모집단은 `[출생일, 출생일+100일)`이라는 **제3의 기간**이라, 이 무기간 규칙으로도
 * 리포트 고지의 월/분기/연 규칙으로도 셀 수 없다. 창 경계를 클라이언트에서 다시 계산하는
 * 순간 집계 규칙이 두 벌이 되므로(pending-scope-notice.ts 머리말의 판단 그대로), 그 카드는
 * "고지를 붙인다"가 아니라 별도 판단으로 남긴다 — 모르는 것을 세는 척하지 않는다.
 */
export function cumulativeTotalPendingNoticeText(count: number, unsendableCount = 0): string {
  if (unsendableCount <= 0) {
    return `${SYNC_ROW_PENDING_LABEL} 중인 기록 ${count}건은 이 금액에 아직 반영되지 않았어요.`;
  }
  return `${recordsCountPhrase(count)}은 이 금액에 아직 반영되지 않았어요. ${unsendableRecordsSuffixText(unsendableCount)}`;
}

/** 이 아이의 행 중 위 금액이 아직 모르는 것. 규칙은 `cumulativeTotalPendingNoticeText` 머리말. */
function pendingRowsBehindCumulativeTotal(
  rows: readonly CumulativeTotalPendingRow[]
): CumulativeTotalPendingRow[] {
  return rows.filter((row) => row.syncState !== "synced" && countsTowardMonthlyTotal(row.payload?.expenseType));
}

/**
 * GAP-063 트랙 A — **전 기간 누적 금액을 그리는 자리라면 어디서든 부르는 한 함수.**
 *
 * 넘기는 행은 **이미 이 아이로 걸러진** 오프라인 스냅숏 행이다(홈은 `childOfflineRows`,
 * 리포트 탭은 같은 스냅숏을 `childId`로 거른 것 — 둘 다 새 요청 0건). 아이를 모르면 빈 배열이
 * 들어와 null이 나온다: 누구의 대기인지 모르는 채로 건수를 말하지 않는다.
 *
 * 0건이면 **null**이라 세 화면 모두 예전과 한 줄도 다르지 않다("0건이 대기 중이에요"는 소음).
 * 세는 규칙(`syncState !== "synced"` ∧ 이 합계를 움직이는 구분만)과 문구는 위 두 함수 한 벌이
 * 지므로, 부르는 자리가 늘어도 같은 상황에서 같은 문장이 나온다.
 */
export function cumulativeTotalPendingNotice(
  rows?: readonly CumulativeTotalPendingRow[] | null
): string | null {
  const pendingRows = pendingRowsBehindCumulativeTotal(rows ?? []);
  if (pendingRows.length === 0) return null;
  return cumulativeTotalPendingNoticeText(pendingRows.length, countPermanentlyFailedRows(pendingRows));
}

/** 홈 누적 총액 카드를 만든다. 보여줄 이유가 없으면 null(그 자리는 비어 있는다). */
export function evaluateHomeCumulativeTotal(input: HomeCumulativeTotalInput): HomeCumulativeTotal | null {
  if (!input.hasSession) return null;
  // 모르거나 0원이면 말하지 않는다(위 "허위 표시 방지").
  if (!milestoneSubtitleShowsTotal(input.totalExpenseKrw)) return null;
  // 중복 금지. **순서가 계약이다**: 위 줄을 통과했다는 것은 금액을 말할 수 있다는 뜻이고,
  // 그 조건이 곧 마일스톤 부제가 권유 문장 대신 금액을 그리는 조건이다(같은 함수). 즉 여기
  // 도달한 시점에 "카드가 있다 = 그 카드가 이 금액을 이미 말하고 있다"가 성립한다.
  if (input.hasMilestoneCard) return null;

  const amountText = formatKrw(input.totalExpenseKrw);
  const title = `${CUMULATIVE_TOTAL_TITLE_PREFIX} ${amountText}`;
  const subtitle = CUMULATIVE_TOTAL_SUBTITLE;
  // GAP-062 #9: 대기 0건이면 null이라 카드가 예전과 한 줄도 다르지 않다 — "0건이 대기 중이에요"는
  // 소음이고, 대다수인 그 경우에 카드를 한 줄 키울 이유가 없다(리포트 고지와 같은 규칙).
  // GAP-063 트랙 A: 판정을 위 공용 함수로 옮겼다 — 홈 마일스톤 부제·리포트 누적 카드가 같은
  // 금액을 그리므로 같은 함수를 부른다(결과는 종전과 동치다).
  const pendingNotice = cumulativeTotalPendingNotice(input.pendingRows);
  return {
    title,
    subtitle,
    pendingNotice,
    // 고지는 부제 다음에 붙는다 — 화면의 읽기 순서(제목 → 부제 → 고지)와 같아야 TalkBack
    // 사용자가 눈으로 보는 사람과 같은 순서로 같은 사실을 듣는다.
    accessibilityLabel: pendingNotice ? `${title}. ${subtitle}. ${pendingNotice}` : `${title}. ${subtitle}`
  };
}
