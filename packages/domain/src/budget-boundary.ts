/**
 * R19-D 예산 경계(80% / 100%) 판정 — 단일 소스.
 *
 * 이전에는 같은 규칙이 세 곳에 각각 구현돼 있었다:
 * - apps/mobile/src/home/budget-warning.ts (홈 배너)
 * - apps/mobile/src/notifications/generators.ts (인앱 알림)
 * - apps/api/src/push/push-dispatch.service.ts (서버 푸시)
 * 세 구현이 조금씩 어긋나면 같은 지출에 대해 화면마다 다른 말을 하게 된다(실제로
 * 정확히 100% 소진 시 인앱 알림만 "80%를 사용했어요"라고 말하고 있었다). 판정은
 * 여기 한 곳에만 두고, 각 표면은 이 결과에서 자기 카피를 만든다.
 *
 * 이 모듈은 판정만 한다 — 카피(문구)는 포함하지 않는다. 표면마다 금액 포맷이
 * 다르고(모바일 formatKrw는 "1,000원", 서버 푸시는 toLocaleString("ko-KR") + "원"),
 * 인앱 알림은 한 번 기록되면 남는 스냅샷이라 초과 금액을 굳혀 적지 않는 등
 * 표면별 판단이 있기 때문이다. 대신 카피를 가르는 데 필요한 판별
 * (reached80 / reached100 / exceeded / overAmountKrw / usedPercent)을 모두 돌려준다.
 *
 * 규칙 (DNC-013: KRW는 정수 — 모든 비교를 정수 연산으로 해 부동소수점 경계 오차가 없다):
 * - 예산 미설정(0/음수/비유한): 어떤 경계도 도달하지 않음 — 절대 알리지 않는다.
 *   (홈 API는 예산이 없으면 amountKrw: 0을 준다.)
 * - reached80: spent * 5 >= budget * 4 — 정확히 "사용률 >= 80%".
 * - reached100: spent >= budget — 정확히 예산과 같아도 100% 경계는 '도달'이다.
 * - exceeded: spent > budget — '초과'는 strict >. 정확히 예산을 다 쓴 상태를
 *   "0원 초과했어요"라고 말하면 허위 데이터이므로, 도달(reached100)과
 *   초과(exceeded)를 분리해 카피를 가른다.
 * - usedPercent: Math.floor — 99.6%를 "100%"로 올려 적으면 (아직 예산 안이면서)
 *   허위가 되므로 반올림하지 않는다.
 *
 * spentKrw는 반드시 '선물 제외' 월 합계여야 한다(DNC-015): apps/api와
 * apps/mobile/src/api/local-backend.ts 모두 expenseType === "expense"만 합산한
 * HomeSummary.monthly.usedAmountKrw가 그 값이다.
 */

export type BudgetBoundaryInput = {
  /** 월 예산(KRW). 0/음수/nullish = "예산 미설정". */
  budgetKrw: number | null | undefined;
  /** 선물 제외 월 지출 합계(KRW, DNC-015). 0 이하/nullish는 0으로 본다. */
  spentKrw: number | null | undefined;
};

export type BudgetBoundaryStatus = {
  /** 유효한 양수 예산이 있는가 — false면 나머지는 모두 false/0이다. */
  hasBudget: boolean;
  /** 사용률 >= 80% (reached100이면 항상 true). */
  reached80: boolean;
  /** 사용률 >= 100% — 정확히 예산과 같은 경우 포함. */
  reached100: boolean;
  /** 예산을 실제로 넘겼는가 (strict >): 정확히 예산이면 false. */
  exceeded: boolean;
  /** 초과 금액(KRW). 정확히 예산이거나 예산 이하면 0. */
  overAmountKrw: number;
  /** 내림한 사용률(%) — 표시용. 예산 미설정이면 0. */
  usedPercent: number;
};

const NO_BUDGET: BudgetBoundaryStatus = {
  hasBudget: false,
  reached80: false,
  reached100: false,
  exceeded: false,
  overAmountKrw: 0,
  usedPercent: 0
};

function finiteNumberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * 어떤 입력에도 예외를 던지지 않는 전역 함수(total function): 비유한/음수/nullish는
 * "알리지 않는다"로 흡수된다 — 세 표면 모두 서버·로컬 백엔드 응답을 그대로 넘기므로
 * 방어적으로 총계여야 한다.
 */
export function reachedBudgetBoundaries(input: BudgetBoundaryInput): BudgetBoundaryStatus {
  const budgetKrw = finiteNumberOrNull(input.budgetKrw);
  if (budgetKrw === null || budgetKrw <= 0) return { ...NO_BUDGET };

  const rawSpent = finiteNumberOrNull(input.spentKrw);
  // 지출 0/음수/비유한은 0으로 흡수 — 예산이 있어도 어떤 경계에도 닿지 않는다.
  const spentKrw = rawSpent === null || rawSpent <= 0 ? 0 : rawSpent;

  const reached100 = spentKrw >= budgetKrw;
  const overAmountKrw = reached100 ? spentKrw - budgetKrw : 0;
  return {
    hasBudget: true,
    // 정수 비교로 "사용률 >= 80%" (spent/budget >= 4/5).
    reached80: spentKrw * 5 >= budgetKrw * 4,
    reached100,
    exceeded: overAmountKrw > 0,
    overAmountKrw,
    usedPercent: Math.floor((spentKrw * 100) / budgetKrw)
  };
}
