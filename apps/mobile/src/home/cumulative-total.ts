import { formatKrw } from "../money";
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
  /** TalkBack 문장(제목 + 부제를 한 번에 읽는다). */
  accessibilityLabel: string;
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
  return {
    title,
    subtitle,
    accessibilityLabel: `${title}. ${subtitle}`
  };
}
