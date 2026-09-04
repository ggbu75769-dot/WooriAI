import { formatKrw } from "../money";
import { BUDGET_MAX_KRW } from "./budget-edit";

/**
 * 기능 라운드 1 트랙 E — 예산 편집 화면의 **최근 3개월 실지출 평균 제안 칩** 순수 로직.
 *
 * 문제: 이 화면의 제안은 "지난달과 같은 N원으로 시작"(라운드 48 B1 — 지난달 *예산*)뿐이라,
 * 예산 기능을 늦게 발견한 사용자(지난달 예산이 없던 사용자)에게는 제안이 아예 서지 않았다.
 * 지출 기록은 이미 쌓여 있는데 그 사실이 예산의 근거로 쓰이지 않는다 — 여기서는 기존
 * `getTrendReport`(REP-128, 서버 0바이트)의 월별 합계를 받아 **최근 3개월 실지출 평균**을
 * 시작값으로 제안한다. 칩은 값을 입력칸에 채울 뿐이고 저장은 사람이 [저장]을 눌러야 일어난다
 * (이 화면의 확립된 규율 — 자동 저장 금지, B1 주석 참고).
 *
 * ## 허위 표시 방지 규칙(이 모듈의 존재 이유 — budget-edit.ts와 같은 계열)
 * - **기록이 있는 달만 분모로 센다.** 0원 달을 분모에 넣으면 "석 달 평균"이 실제로 쓴 달의
 *   평균보다 낮게 깎여, 근거 없이 작은 예산을 권하게 된다. 반대로 세 달 모두 0원이면 평균이
 *   말할 사실이 없다 — 제안하지 않는다(지어낸 예산 금지).
 * - **분모가 3개월이 아니면 라벨이 그렇게 말한다.** "최근 3개월 평균"이라고 적고 두 달로
 *   나누면 라벨이 거짓이다 — 기록이 1~2개월뿐이면 "최근 3개월 중 기록이 있는 N개월 평균"으로
 *   분모를 그대로 밝힌다.
 * - **라벨과 입력값이 같은 숫자에서 나온다**(라운드 38 H-10의 그 규율). 제안값은 천원 단위로
 *   반올림하는데, 반올림한 값을 "평균"이라고 단정하면 최대 500원의 거짓이 생기므로 라벨에는
 *   `약`을 붙인다 — 칩이 약속한 금액이 곧 입력칸에 들어가는 금액이고, 그 금액이 정확한 평균이
 *   아니라는 사실도 함께 말한다.
 * - 반올림 결과가 0원(평균 500원 미만)이거나 상한(1억)을 넘으면 칩을 만들지 않는다 — 저장할
 *   수 없는 값·자를 수밖에 없는 값을 권하는 것은 그 자체로 허위 표시다(H-10과 같은 판단).
 *
 * "이월 칩과 값이 같으면 하나만" 같은 **나란히 서는 규칙**은 이 모듈이 아니라
 * `buildBudgetAdjustChips`(budget-edit.ts)가 갖는다 — 어느 칩이 서는지는 칩 목록을 조립하는
 * 한 곳에서만 정한다(규칙이 갈릴 자리를 만들지 않는다).
 *
 * React/react-native/네트워크에 의존하지 않는다(budget-edit.ts와 같은 관례 — vitest 단위 검증).
 */

/**
 * 제안이 근거로 삼는 창(개월). 화면(app/budget.tsx)의 `RECENT_AVERAGE_TREND_MONTHS`와 같은
 * 값이어야 한다 — 두 값의 정합은 budget-suggestion.test.ts가 소스 계약으로 문다(export 하지
 * 않는 이유: 이 수는 라벨 문구와 요청 개월 수를 함께 묶는 이 트랙의 지역 결정이라, 값이
 * 갈리면 테스트가 빨개지는 것으로 충분하다). 방어적으로 아래 함수는 `slice(-3)`을 쓰므로
 * 화면이 더 긴 응답을 넘겨도 창은 마지막 3개월로 고정된다.
 */
const RECENT_AVERAGE_WINDOW_MONTHS = 3;

/** `TrendReport.months` 한 원소에서 이 모듈이 실제로 읽는 최소 모양. */
export type TrendMonthTotalLike = {
  totalExpenseKrw: number;
};

/**
 * 칩 한 장의 내용물. id는 칩 목록을 조립하는 budget-edit.ts(`buildBudgetAdjustChips`)가
 * `"recent-average"`로 붙인다 — 이 모듈은 문구·값만 만든다.
 */
export type RecentAverageChipContent = {
  /** 칩에 그리는 문구. 낭독과 같은 조사·같은 표면이다(라운드 94~95의 칩 관례). */
  label: string;
  /** 스크린리더용 문장 — 구분자만 쉼표(child-switch.ts의 낭독 구분자 관례), 꼬리만 "…하기". */
  accessibilityLabel: string;
  /** 탭했을 때 입력칸에 들어갈 숫자 문자열. 라벨의 금액과 언제나 같은 숫자다(H-10). */
  nextDigits: string;
};

/**
 * 최근 3개월 실지출 평균 제안 칩의 내용물. 만들 수 없으면 null(칩 자체를 그리지 않는다).
 *
 * - 응답이 없으면(조회 전·실패·캐시 없음)          → null — 모르면 제안하지 않는다.
 * - 창 안에 기록이 있는 달(합계 > 0)이 하나도 없으면 → null — 0원 셋의 평균은 지어낸 예산이다.
 * - 반올림 결과가 0원이거나 상한(1억) 초과            → null — 저장할 수 없는 값을 권하지 않는다.
 *
 * `months`는 REP-128 계약대로 **오름차순**이고 마지막 원소가 요청한 endYearMonth(지난달)다.
 * 기록 없는 달도 0으로 채워 오므로(길이 = 요청 개월 수) "합계 0원"과 "달이 빠짐"을 여기서
 * 구분할 수 없다 — 둘 다 분모에서 뺀다(어느 쪽이든 평균의 근거가 아니다).
 */
export function buildRecentAverageChip(
  months: ReadonlyArray<TrendMonthTotalLike> | null | undefined
): RecentAverageChipContent | null {
  if (!Array.isArray(months) || months.length === 0) return null;

  const window = months.slice(-RECENT_AVERAGE_WINDOW_MONTHS);
  const recordedMonths = window.filter(
    (month) =>
      typeof month?.totalExpenseKrw === "number" &&
      Number.isFinite(month.totalExpenseKrw) &&
      month.totalExpenseKrw > 0
  );
  if (recordedMonths.length === 0) return null;

  const averageKrw =
    recordedMonths.reduce((total, month) => total + month.totalExpenseKrw, 0) / recordedMonths.length;
  // 천원 단위 반올림 — 시작값 제안이지 회계 수치가 아니라서, 라벨에 `약`을 붙여 반올림 사실을 밝힌다.
  const suggestedKrw = Math.round(averageKrw / 1000) * 1000;
  if (!Number.isSafeInteger(suggestedKrw) || suggestedKrw <= 0 || suggestedKrw > BUDGET_MAX_KRW) return null;

  const nextDigits = String(suggestedKrw);
  // 라벨의 금액은 입력칸에 들어갈 바로 그 숫자에서 만든다(H-10 — 약속과 입력이 갈리지 않는다).
  const amountText = formatKrw(Number(nextDigits));
  // 분모가 창보다 작으면 라벨이 분모를 그대로 밝힌다 — "3개월 평균"이라 적고 2로 나누지 않는다.
  const scopeText =
    recordedMonths.length === RECENT_AVERAGE_WINDOW_MONTHS
      ? `최근 ${RECENT_AVERAGE_WINDOW_MONTHS}개월`
      : `최근 ${RECENT_AVERAGE_WINDOW_MONTHS}개월 중 기록이 있는 ${recordedMonths.length}개월`;

  return {
    // 보이는 줄과 낭독이 같은 낱말·같은 조사다(라운드 94~95 칩 관례) — 다른 것은 구분자(· ↔ 쉼표)와
    // 꼬리("시작" ↔ "시작하기")뿐이다. 금액 뒤 `씩`은 받침에서 갈리지 않는 보조사라 값 꼬리와
    // 무관하게 언제나 옳다(korean-particle-guard의 받침 의존 쌍 밖).
    label: `${scopeText} 평균 약 ${amountText}씩 썼어요 · 이 값으로 시작`,
    accessibilityLabel: `${scopeText} 평균 약 ${amountText}씩 썼어요, 이 값으로 시작하기`,
    nextDigits
  };
}
