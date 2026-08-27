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

/**
 * "이번 달 예산을 다 썼는가"의 **단일 판정**.
 *
 * 부등호가 `>=`인 것은 경고 배너(@wooriai/domain `reachedBudgetBoundaries`의 reached100 =
 * `spent >= budget`)와 같은 경계를 쓰기 위해서다. 이 모듈 안에서 히어로(subtext)와 넛지가
 * 각자 부등호를 들고 있으면 정확히 100%인 달에 한쪽은 "다 썼다", 다른 쪽은 "잘 관리하고
 * 있다"고 말한다(라운드 38 H-2) -- 그래서 판정을 여기 한 줄로 모은다.
 */
function isBudgetUsedUp(budgetKrw: number, spentKrw: number): boolean {
  return spentKrw >= budgetKrw;
}

export type BudgetUsagePercentInput = {
  /** 월 예산(원). 0 이하/비정상이면 0%를 돌려준다(퍼센트를 말할 근거가 없다). */
  budgetKrw: number;
  /** 선물 제외 월 누계(원, DNC-015). */
  spentKrw: number;
  /**
   * 초과 구간을 100으로 물릴지.
   * - 홈 히어로·넛지: `true` — 프로그레스 바가 100을 넘을 수 없고, 초과 **금액**은 경고 배너가
   *   따로 말한다.
   * - 주간 알림(src/notifications/generators.ts): `false` — 종전처럼 "예산의 120%예요"라고
   *   초과율을 그대로 말한다(그쪽에는 바가 없고, 초과 사실을 숨길 이유도 없다).
   */
  clampToFull: boolean;
};

/**
 * 예산 대비 사용률(%) — **반올림 + "미소진 100% 금지" 캡**의 단일 소스.
 *
 * 라운드 37 G-2: 아직 다 쓰지 않았는데 반올림만으로 100%가 되는 구간(99.5% ~ 100% 직전)에서는
 * 바로 옆 보조 문구가 "남은 예산 5,000원"이라고 말한다 — 한 카드 안에서 "다 썼다"와 "남았다"가
 * 동시에 서는 자기모순이다. 그 구간을 99로 캡해 **100%는 실제로 다 쓴 달에만** 나오게 한다
 * (준비율 카드와 같은 규칙). 경고 배너는 미소진 구간을 Math.floor로 99%라 말하므로 100%
 * 경계에서 두 표기가 어긋나지 않고, 78% 같은 평소 값은 반올림 그대로라 HOME-001 캡처도 불변이다.
 *
 * 라운드 38 H-3: 그 캡이 홈에만 있어서, 99.5%~99.99%인 달에 홈은 "남은 예산 N원 · 99%"인데
 * 주간 알림만 "예산의 100%예요"라고 말했다(같은 사실을 두 화면이 다르게 말하는 허위 표시다).
 * 계산을 이 함수 하나로 모아 두 곳이 갈릴 수 없게 한다 — 알림은 `clampToFull: false`로,
 * 초과율만 종전처럼 그대로 말한다.
 */
export function budgetUsagePercent({ budgetKrw, spentKrw, clampToFull }: BudgetUsagePercentInput): number {
  if (!Number.isFinite(budgetKrw) || budgetKrw <= 0 || !Number.isFinite(spentKrw)) return 0;
  const raw = (spentKrw / budgetKrw) * 100;
  const rounded = Math.round(Math.max(0, clampToFull ? Math.min(100, raw) : raw));
  return !isBudgetUsedUp(budgetKrw, spentKrw) && rounded >= 100 ? 99 : rounded;
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
  const usedUp = isBudgetUsedUp(budgetKrw, spentKrw);
  // 0 ≤ 남은 예산 ≤ 예산: 잘못된 입력(음수 지출)에도 "예산보다 많이 남았다"고 말하지 않는다.
  const remainingKrw = Math.min(budgetKrw, Math.max(0, budgetKrw - spentKrw));

  return {
    hasBudget: true,
    // 반올림·100% 캡 규칙은 budgetUsagePercent 하나에만 있다(라운드 37 G-2 / 38 H-3).
    percent: budgetUsagePercent({ budgetKrw, spentKrw, clampToFull: true }),
    subtext:
      input.showRemaining && !usedUp
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
 *   중복해서 말하지 않는다. "다 썼는가"의 경계는 히어로·배너와 같은 `isBudgetUsedUp`(>=)이다
 *   (라운드 38 H-2 — 정확히 100%인 달에 배너와 넛지가 서로를 부정하던 자리).
 *
 * 라운드 41 UX-T(B) — **문구와 목적지가 같은 곳을 가리킨다**: 예산이 있는 달의 넛지는 오랫동안
 * "/(tabs)/items"(추천/쇼핑 탭)로 갔다. 그래서 예산을 초과한 사람이 "이번 달 지출을 확인해
 * 볼까요?"를 누르면 지출 목록이 아니라 **상품 추천**이 열렸다 — 지출을 줄이려고 누른 자리에서
 * 물건을 권하는 셈이라, 문구가 약속한 것과 화면이 하는 일이 정반대였다(라운드 33 F1이 마일스톤
 * 카드에서 고친 것과 같은 종류의 어긋남). 사용률 넛지는 **기록 탭**으로 보낸다: "확인해 볼까요?"도
 * "잘 관리하고 있어요"도 근거가 되는 화면은 이번 달 지출 목록 하나뿐이다. 예산 미설정 CTA는
 * 종전대로 /budget이다(그 문구가 약속하는 곳은 예산 편집 화면이다).
 */
export type HomeBudgetNudge = {
  variant: "set-budget" | "usage";
  title: string;
  subtitle: string;
  /**
   * expo-router 경로. 예산 미설정이면 예산 편집 화면, 예산이 있으면 그 숫자의 근거인 기록 탭이다
   * (라운드 41 UX-T(B) — 종전 "/(tabs)/items"는 문구와 어긋난 목적지였다).
   */
  route: "/budget" | "/(tabs)/records";
};

export type HomeBudgetNudgeInput = HomeBudgetInput & {
  /** HOME-BUDGET-113 경고 배너가 렌더 중인지(초과 금액 중복 방지). */
  hasWarningBanner: boolean;
  /**
   * 라운드 48 B1(c) — 지난달에 설정되어 있던 월 예산(원). 모르면 null/undefined.
   *
   * 월 예산은 (childId, yearMonth) 유니크라 **매달 1일에 사라진다**. 그날 홈은 진행바도
   * 경고도 없이 "월 예산 설정하기"만 남고, 왜 어제까지 있던 숫자가 없어졌는지 아무도 말해
   * 주지 않았다. 지난달 값을 알면 그 사실을 한 줄로 덧붙인다 — 앱이 예산을 대신 만들어 주는
   * 것이 아니라(그건 사용자가 정한 적 없는 값을 지어내는 것이다) **지난달에 무엇이었는지만**
   * 말하고, 실제 설정은 사람이 /budget에서 저장할 때 일어난다.
   *
   * 데이터가 없으면(아직 조회 전·지난달에도 예산 없음) 문구는 종전과 한 글자도 다르지 않다.
   */
  lastMonthBudgetKrw?: number | null;
};

/**
 * 예산 미설정 넛지의 보조 문구. 지난달 예산을 알 때만 사실 한 조각을 덧붙인다.
 *
 * 순서는 "약속 → 사실"이다: 앞부분(이 카드를 누르면 무엇이 좋아지는지)은 종전 문장 그대로 두고,
 * 뒤에 지난달 값을 붙인다. 과거형("이었어요")으로 말해 지금 그 예산이 살아 있다고 오해할 여지를
 * 남기지 않는다(DNC-018 해요체 · 재촉·죄책감 없음).
 */
function setBudgetNudgeSubtitle(lastMonthBudgetKrw: number | null | undefined): string {
  const base = "이번 달 예산을 정하면 남은 금액을 알려드려요";
  if (typeof lastMonthBudgetKrw !== "number" || !Number.isFinite(lastMonthBudgetKrw) || lastMonthBudgetKrw <= 0) {
    return base;
  }
  return `${base} · 지난달 예산은 ${formatKrw(lastMonthBudgetKrw)}이었어요`;
}

export function buildHomeBudgetNudge(input: HomeBudgetNudgeInput): HomeBudgetNudge {
  const progress = evaluateHomeBudgetProgress(input);
  if (!progress.hasBudget) {
    return {
      variant: "set-budget",
      title: "월 예산 설정하기",
      subtitle: setBudgetNudgeSubtitle(input.lastMonthBudgetKrw),
      route: "/budget"
    };
  }

  const budgetKrw = normalizeAmount(input.budgetKrw);
  const spentKrw = normalizeAmount(input.spentKrw);
  // 라운드 38 H-2: 히어로·경고 배너와 **같은 경계**(>=)를 쓴다. 종전에는 여기만 `>`라, 정확히
  // 100%인 달에 배너는 "이번 달 예산을 모두 사용했어요"인데 넛지는 "예산의 100% 사용 중이에요!
  // / 이번 달도 잘 관리하고 있어요 👏"를 한 화면에서 함께 말했다(서로를 부정하는 두 문장).
  // 경계를 맞추면 그 달에도 hasWarningBanner 중복 방지 분기(라운드 13 m-7)가 정상 작동한다.
  const usedUp = isBudgetUsedUp(budgetKrw, spentKrw);
  const overAmountKrw = spentKrw - budgetKrw;

  // 초과 **금액**을 말할 수 있는 건 실제로 초과했을 때뿐이다 — 정확히 다 쓴 달에 "예산을 0원
  // 초과했어요."는 없는 사실이라, 배너 유무와 무관하게 "모두 사용했어요"로 말한다.
  const title = usedUp
    ? input.hasWarningBanner || overAmountKrw <= 0
      ? "예산을 모두 사용했어요."
      : `예산을 ${formatKrw(overAmountKrw)} 초과했어요.`
    : `예산의 ${progress.percent}% 사용 중이에요!`;

  return {
    variant: "usage",
    title,
    // 라운드 41 UX-T(B): 초과한 달의 보조 문구에서 "😥"를 뺐다. 예산을 넘긴 것은 대개 아이에게
    // 필요한 것을 산 결과인데, 그 옆에 우는 얼굴을 붙이면 앱이 사용자의 한 달을 **평가**하는
    // 문장이 된다(DNC-018의 톤 경계 -- 이 앱은 지출을 기록하게 만드는 것이 목적이지 죄책감을
    // 주는 것이 아니다). 문장은 그대로 두고 감정 부호만 뺀 중립 권유로 남긴다. 반대쪽의 "👏"는
    // 격려라 그대로 둔다 -- 문제는 이모지가 있다는 것이 아니라 **부정적 평가**를 붙였다는 것이다.
    subtitle: usedUp ? "이번 달 지출을 확인해 볼까요?" : "이번 달도 잘 관리하고 있어요 👏",
    // 문구가 가리키는 화면 = 실제 목적지(위 doc comment 참고).
    route: "/(tabs)/records"
  };
}
