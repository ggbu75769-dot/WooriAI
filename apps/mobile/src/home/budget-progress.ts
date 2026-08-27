import { formatKrw } from "../money";

/**
 * HOME-127: 홈 히어로 카드 · 예산 넛지 카드의 "예산이 있느냐" 판정.
 *
 * 왜 순수 모듈인가 — 예전 홈 화면은 퍼센트를 `(monthlyUsed / Math.max(1, budget)) * 100`으로
 * 냈다. `/home` 응답은 **예산을 설정하지 않은 달에 `monthly.amountKrw: 0`** 을 돌려주므로
 * (apps/api/src/onboarding/reporting-store.service.ts `getHome` → `budget?.amountKrw ?? 0`),
 * 분모가 1로 치환되어 지출 1건만 있어도 퍼센트가 100을 넘고 화면에는
 * "예산 0원 · 100%" + "예산의 100% 사용 중이에요!"가 떴다. 사용자가 정한 적 없는 예산을
 * 다 썼다고 말하는 **허위 표시**다. 판정을 화면 밖 순수 함수로 빼서 단위 테스트로 못 박는다.
 *
 * 입력 계약(HOME-BUDGET-113 `evaluateBudgetWarning`와 동일):
 * - `budgetKrw` = HomeSummary.monthly.amountKrw. 0/음수/nullish = "예산 미설정".
 * - `spentKrw`  = HomeSummary.monthly.usedAmountKrw — 선물 제외 월 누계(DNC-015). 호출자는
 *   이 값을 그대로 넘겨야 하며, 선물이 섞인 합계를 다시 만들어 넘기면 안 된다.
 *
 * 예산이 있을 때의 퍼센트는 `Math.round`로 0~100에 물린다 — 비세션 프리뷰 HOME-001 캡처가
 * 그 반올림 결과다(1,245,700 / 1,600,000 = 77.86% → **78%**). 경고 배너(budget-warning.ts)처럼
 * `Math.floor`로 통일하면 같은 값이 77%가 되어 픽셀락 캡처가 깨지므로, 세 표기를 맞추는 방법은
 * 반올림을 버리는 것이 아니라 **아래 라운드 37 G-2의 100% 캡**이다.
 *
 * UX-J "남은 예산": 이 화면은 예산 미설정일 때 "예산을 정하면 남은 금액을 보여드릴게요"라고,
 * 넛지 카드는 "이번 달 예산을 정하면 남은 금액을 알려드려요"라고 약속해 놓고, 정작 예산이 있는
 * 달에는 **총액만**("예산 1,600,000원") 말했다. 약속한 숫자를 실제로 보여준다:
 * `남은 예산 354,300원 · 예산 1,600,000원`.
 *  - 남은 금액은 `budgetKrw - spentKrw`로 **여기서** 낸다. 서버도 같은 식으로 계산해
 *    `HomeSummary.monthly.remainingAmountKrw`를 주지만(apps/api/src/onboarding/store-shared.ts),
 *    바로 옆 퍼센트·프로그레스 바가 budget/spent에서 나오므로 한 카드 안의 세 숫자를 한 소스에서
 *    내야 "남은 예산 + 사용 = 예산"이 어긋날 여지가 없다(같은 값의 출처가 둘이면 언젠가 갈린다).
 *  - 예산을 다 쓴 달(spent >= budget)은 종전 문구를 유지한다. 초과 금액도 "모두 사용했어요"도
 *    HOME-BUDGET-113 경고 배너가 이미 상위 정보로 말하고 있어서(라운드 13 m-7의 중복 방지 규칙),
 *    히어로가 "남은 예산 0원"을 덧붙이면 같은 사실을 두 번 말하게 된다.
 *    라운드 37 G-5: 이 경계의 부등호를 배너와 **같은 것**으로 맞췄다. 종전에는 히어로만 `>`라
 *    spent === budget인 달에 히어로가 "남은 예산 0원", 배너가 "이번 달 예산을 모두 사용했어요"를
 *    한 화면에서 동시에 말했다(배너의 판정은 @wooriai/domain reachedBudgetBoundaries의
 *    reached100 = `spent >= budget`이다).
 *  - `showRemaining`은 **세션이 있을 때만** true다. 비세션 미리보기(previewHome)는 픽셀락
 *    HOME-001 캡처의 원본이라 기존 문자열 그대로여야 한다(UX-A 카드들과 같은 관례). 기본값
 *    false라 이 플래그를 넘기지 않는 호출부의 동작도 종전과 같다.
 */

export type HomeBudgetProgress = {
  /** 예산이 실제로 설정되어 있는지(> 0). false면 퍼센트·프로그레스 바를 그리지 않는다. */
  hasBudget: boolean;
  /**
   * 0~100 정수. 예산 미설정이면 null — "0%"조차 표시하지 않는다.
   * 라운드 37 G-2: 아직 다 쓰지 않은 달(spent < budget)은 99가 상한이다 — 아래 참고.
   */
  percent: number | null;
  /** 히어로 카드 보조 문구. 예산 미설정이면 설정을 권하는 안내로 대체된다. */
  subtext: string;
};

export type HomeBudgetInput = {
  /** HomeSummary.monthly.amountKrw — 0/nullish면 "예산 미설정". */
  budgetKrw: number | null | undefined;
  /** HomeSummary.monthly.usedAmountKrw — 선물 제외 월 누계(DNC-015). */
  spentKrw: number | null | undefined;
  /**
   * UX-J: 보조 문구에 "남은 예산 N원 ·"을 앞세울지. 세션이 있는 실제 홈에서만 true이고,
   * 비세션 미리보기는 기본값 false로 HOME-001 픽셀락 문자열을 그대로 유지한다.
   */
  showRemaining?: boolean;
};

function normalizeAmount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function evaluateHomeBudgetProgress(input: HomeBudgetInput): HomeBudgetProgress {
  const budgetKrw = normalizeAmount(input.budgetKrw);
  const spentKrw = normalizeAmount(input.spentKrw);

  if (budgetKrw <= 0) {
    return {
      hasBudget: false,
      percent: null,
      subtext: "예산을 정하면 남은 금액을 보여드릴게요"
    };
  }

  // 예산을 다 쓴 달에는 말할 "남은 금액"이 없다(0원도 음수도 남은 예산이 아니다) — 경고 배너에
  // 맡기고 총액만 말한다. 부등호(>=)는 배너의 reached100과 같다(라운드 37 G-5, 위 주석).
  const isBudgetUsedUp = spentKrw >= budgetKrw;
  // 0 ≤ 남은 예산 ≤ 예산: 잘못된 입력(음수 지출)에도 "예산보다 많이 남았다"고 말하지 않는다.
  const remainingKrw = Math.min(budgetKrw, Math.max(0, budgetKrw - spentKrw));

  // 라운드 37 G-2: 아직 다 쓰지 않았는데 반올림만으로 100%가 되는 구간(99.5% ~ 100% 직전)에서는
  // 바로 옆 보조 문구가 "남은 예산 5,000원"이라고 말한다 — 한 카드 안에서 "다 썼다"와 "남았다"가
  // 동시에 서는 자기모순이다. 그 구간을 99로 캡해 **100%는 실제로 다 쓴 달에만** 나오게 한다
  // (준비율 카드와 같은 규칙). 경고 배너는 미소진 구간을 Math.floor로 99%라 말하므로 100%
  // 경계에서 두 표기가 어긋나지 않고, 78% 같은 평소 값은 반올림 그대로라 HOME-001 캡처도 불변이다.
  const roundedPercent = Math.round(Math.min(100, Math.max(0, (spentKrw / budgetKrw) * 100)));

  return {
    hasBudget: true,
    percent: !isBudgetUsedUp && roundedPercent >= 100 ? 99 : roundedPercent,
    subtext:
      input.showRemaining && !isBudgetUsedUp
        ? `남은 예산 ${formatKrw(remainingKrw)} · 예산 ${formatKrw(budgetKrw)}`
        : `예산 ${formatKrw(budgetKrw)}`
  };
}

/**
 * 히어로 카드 아래 넛지 카드의 문구와 이동 경로.
 *
 * - 예산 미설정: 홈에는 예산을 정할 진입점이 아예 없었다(설정 탭이나 알림에서만 /budget에
 *   닿았다). 넛지 자리를 "월 예산 설정하기" CTA로 바꿔 그 구멍을 메운다.
 * - 예산 있음: 종전 문구를 그대로 유지한다. `hasWarningBanner`는 HOME-BUDGET-113 경고 배너가
 *   보이는 중인지로, 배너가 이미 초과 금액을 말하고 있으면(라운드 13 m-7) 넛지는 금액을
 *   중복해서 말하지 않는다.
 */
export type HomeBudgetNudge = {
  variant: "set-budget" | "usage";
  title: string;
  subtitle: string;
  /** expo-router 경로. 예산 미설정일 때만 예산 편집 화면으로 보낸다. */
  route: "/budget" | "/(tabs)/items";
};

export type HomeBudgetNudgeInput = HomeBudgetInput & {
  /** HOME-BUDGET-113 경고 배너가 렌더 중인지(초과 금액 중복 방지). */
  hasWarningBanner: boolean;
};

export function buildHomeBudgetNudge(input: HomeBudgetNudgeInput): HomeBudgetNudge {
  const progress = evaluateHomeBudgetProgress(input);
  if (!progress.hasBudget) {
    return {
      variant: "set-budget",
      title: "월 예산 설정하기",
      subtitle: "이번 달 예산을 정하면 남은 금액을 알려드려요",
      route: "/budget"
    };
  }

  const budgetKrw = normalizeAmount(input.budgetKrw);
  const spentKrw = normalizeAmount(input.spentKrw);
  const isOverBudget = spentKrw > budgetKrw;
  const overAmountKrw = spentKrw - budgetKrw;

  const title = isOverBudget
    ? input.hasWarningBanner
      ? "예산을 모두 사용했어요."
      : `예산을 ${formatKrw(overAmountKrw)} 초과했어요.`
    : `예산의 ${progress.percent}% 사용 중이에요!`;

  return {
    variant: "usage",
    title,
    subtitle: isOverBudget ? "이번 달 지출을 확인해 볼까요? 😥" : "이번 달도 잘 관리하고 있어요 👏",
    route: "/(tabs)/items"
  };
}
