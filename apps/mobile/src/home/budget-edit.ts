import { countsTowardMonthlyTotal } from "../offline/expense-list-reconciliation";
import { formatKrw } from "../money";

/**
 * BUD-001(라운드 38 UX-M) — 월 예산 수정 화면(app/budget.tsx)의 **판단 근거** 순수 로직.
 *
 * 문제: 화면은 "현재 예산 1,600,000원" 한 줄과 빈 입력칸만 보여줬다. 예산을 올릴지 내릴지
 * 정하려면 사람이 알아야 하는 건 세 가지인데(이번 달 얼마 썼는지 · 남았는지 · 지난달엔 실제로
 * 얼마 썼는지) 화면에는 하나도 없어서, 사용자는 홈 → 리포트를 오가며 숫자를 외운 뒤 돌아와야
 * 했다. 여기서는 그 세 값을 **이미 캐시에 있는 데이터만으로** 문장·칩으로 만든다.
 *
 * ## 허위 표시 방지 규칙(이 모듈의 존재 이유)
 * - 사용액을 **모르면 줄을 만들지 않는다**(null). 캐시가 비어 있을 때 0원으로 떨어뜨리면
 *   화면이 "이번 달 지금까지 0원 사용"이라는, 확인한 적 없는 사실을 말하게 된다.
 *   (홈 히어로가 예산 미설정 달에 `amountKrw: 0`을 100%로 그리던 HOME-127과 같은 종류의 버그다.)
 * - 예산을 넘긴 달에 "남은 예산 0원"이라고 말하지 않는다. 남은 게 없는 것과 초과한 것은
 *   다른 사실이라, 초과분을 **중립 서술**로 밝힌다("예산보다 N원 더 썼어요"). 죄책감을 얹는
 *   표현("너무 많이 썼어요" 등)은 쓰지 않는다.
 * - 지난달 실지출 칩의 금액은 기록 탭·홈의 월 합계와 **같은 술어**
 *   (`countsTowardMonthlyTotal`, DNC-015 선물·환불 제외)로만 더한다. 여기서 규칙이 갈리면
 *   칩이 제안하는 "지난달 실지출"이 기록 탭이 보여준 지난달 합계와 어긋난다.
 *
 * React/react-native/네트워크에 의존하지 않는다 — 화면 밖에서 vitest로 검증하기 위해서다
 * (src/home/budget-progress.ts와 같은 관례).
 */

/** 조정 칩 한 번의 증감 폭(원). "-10만 / +10만". */
export const BUDGET_STEP_KRW = 100_000;

/**
 * 조정 칩으로 만들 수 있는 상한(원, 1억). 지출 프리셋 칩과 **같은 상한**을 쓴다
 * (src/expenses/amount-presets.ts `QUICK_AMOUNT_MAX_KRW`) — 반복 탭으로 금액이 발산하거나
 * 안전 정수 범위를 넘지 않게 하는 입력 보조용 클램프일 뿐, 서버 계약에는 상한이 없다.
 * 값을 여기 다시 적는 이유는 지출 입력 모듈(다른 트랙 소유)에 의존을 만들지 않기 위해서다.
 */
export const BUDGET_MAX_KRW = 100_000_000;

/** 숫자만 남긴 뒤 앞자리 0을 지운다. 숫자가 없으면 빈 문자열(= 아직 입력 없음). */
function normalizeDigits(digits: string): string {
  const onlyDigits = digits.replace(/[^0-9]/g, "");
  if (onlyDigits.length === 0) return "";
  return onlyDigits.replace(/^0+(?=\d)/, "");
}

function isUsableAmount(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export type BudgetUsageLineInput = {
  /** 화면이 "현재 예산"으로 보여주고 있는 값(원). 예산 미설정이면 null. */
  budgetKrw: number | null | undefined;
  /**
   * 이번 달 사용액(원) — `["home", childId]` 캐시의 `monthly.usedAmountKrw`(선물·환불 제외,
   * DNC-015). **모르면 null/undefined를 넘겨야 한다**(0으로 바꿔 넘기지 말 것).
   */
  usedKrw: number | null | undefined;
};

/**
 * 현재 예산 카드 아래에 붙는 한 줄. 만들 수 없으면 null(줄 자체를 그리지 않는다).
 *
 * - 사용액을 모르면            → null
 * - 예산이 없으면(0 이하/미설정) → "이번 달 지금까지 1,245,700원 사용"
 * - 예산 이내면                → "이번 달 지금까지 1,245,700원 사용 · 남은 예산 354,300원"
 * - 예산을 넘겼으면            → "이번 달 지금까지 1,745,700원 사용 · 예산보다 145,700원 더 썼어요"
 *
 * 남은 금액·초과분은 **화면이 보여주고 있는 예산**에서 뺀다. 서버도 같은 값을
 * `remainingAmountKrw`로 주지만, 바로 위 카드의 "현재 예산"과 이 줄의 뺄셈이 한 소스에서
 * 나와야 "사용 + 남음 = 현재 예산"이 어긋날 여지가 없다(budget-progress.ts와 같은 판단).
 */
export function buildBudgetUsageLine(input: BudgetUsageLineInput): string | null {
  if (!isUsableAmount(input.usedKrw)) return null;
  const usedKrw = input.usedKrw;
  const usedText = `이번 달 지금까지 ${formatKrw(usedKrw)} 사용`;

  if (!isUsableAmount(input.budgetKrw) || input.budgetKrw <= 0) return usedText;
  const budgetKrw = input.budgetKrw;

  if (usedKrw > budgetKrw) {
    // 중립 서술: 사실(초과 금액)만 말하고 평가하지 않는다.
    return `${usedText} · 예산보다 ${formatKrw(usedKrw - budgetKrw)} 더 썼어요`;
  }
  return `${usedText} · 남은 예산 ${formatKrw(budgetKrw - usedKrw)}`;
}

/**
 * 지난달 실지출 합계(원). `["expenses", childId, 지난달]` 캐시의 행을 받아 월 합계와 **같은
 * 술어**로만 더한다(DNC-015 선물·환불 제외). 캐시가 없으면 null을 넘기고 null을 돌려받는다.
 */
export function sumLastMonthActualKrw(
  records: ReadonlyArray<{ amountKrw: number; expenseType?: string | null }> | null | undefined
): number | null {
  if (!records) return null;
  let total = 0;
  for (const record of records) {
    if (!countsTowardMonthlyTotal(record.expenseType)) continue;
    if (!Number.isFinite(record.amountKrw)) continue;
    total += record.amountKrw;
  }
  return total;
}

export type BudgetAdjustChip = {
  /** React key 및 테스트용 식별자. */
  id: "minus-step" | "plus-step" | "last-month";
  /** 칩에 그리는 문구. */
  label: string;
  /** 스크린리더용 문장 — "-10만" 같은 축약이 소리로 뭉개지지 않게 따로 준다. */
  accessibilityLabel: string;
  /** 탭했을 때 입력칸에 들어갈 숫자 문자열(빈 문자열 없음). */
  nextDigits: string;
};

export type BudgetAdjustChipsInput = {
  /** 입력칸의 현재 숫자 문자열. 비어 있으면 "아직 안 고쳤다" = 현재 예산이 기준. */
  amountDigits: string;
  /** 현재 예산(원). 미설정이면 null — 그때 기준값은 0이다. */
  currentBudgetKrw: number | null | undefined;
  /** 지난달 실지출 합계(원). 캐시가 없으면 null → 그 칩은 만들지 않는다. */
  lastMonthActualKrw: number | null | undefined;
};

/**
 * 조정 칩이 기준으로 삼는 금액: 사용자가 뭔가 입력했으면 그 값, 아니면 현재 예산.
 * 둘 다 없으면 0(그 상태에서 "+10만"은 100,000원이 된다).
 */
export function budgetAdjustBaseKrw(amountDigits: string, currentBudgetKrw: number | null | undefined): number {
  const digits = normalizeDigits(amountDigits);
  if (digits.length > 0) {
    const typed = Number(digits);
    if (!Number.isSafeInteger(typed)) return BUDGET_MAX_KRW;
    return typed;
  }
  return isUsableAmount(currentBudgetKrw) ? Math.floor(currentBudgetKrw) : 0;
}

/**
 * 기준 금액에 delta를 더한 새 입력 문자열. 0 아래로는 내려가지 않고(0에서 멈춤) 상한에서도
 * 멈춘다 — "-10만"을 계속 눌러 음수 예산을 만들 수 없다.
 */
export function adjustBudgetDigits(
  amountDigits: string,
  currentBudgetKrw: number | null | undefined,
  deltaKrw: number
): string {
  const base = budgetAdjustBaseKrw(amountDigits, currentBudgetKrw);
  if (!Number.isFinite(deltaKrw)) return String(base);
  return String(Math.min(BUDGET_MAX_KRW, Math.max(0, base + Math.trunc(deltaKrw))));
}

/**
 * 화면에 그릴 조정 칩 목록.
 *
 * 지난달 칩은 **캐시가 있고 실지출이 0보다 클 때만** 만든다. 캐시가 없으면 근거가 없고,
 * 0원이면 "지난달 실지출(0원)로"라는 제안이 저장할 수 없는 값(0 이하)을 권하게 된다 —
 * 둘 다 칩을 감추는 편이 정직하다.
 */
export function buildBudgetAdjustChips(input: BudgetAdjustChipsInput): BudgetAdjustChip[] {
  const chips: BudgetAdjustChip[] = [
    {
      id: "minus-step",
      label: "-10만",
      accessibilityLabel: "10만 원 줄이기",
      nextDigits: adjustBudgetDigits(input.amountDigits, input.currentBudgetKrw, -BUDGET_STEP_KRW)
    },
    {
      id: "plus-step",
      label: "+10만",
      accessibilityLabel: "10만 원 늘리기",
      nextDigits: adjustBudgetDigits(input.amountDigits, input.currentBudgetKrw, BUDGET_STEP_KRW)
    }
  ];

  const lastMonthKrw = input.lastMonthActualKrw;
  if (isUsableAmount(lastMonthKrw) && lastMonthKrw > 0) {
    const amountText = formatKrw(lastMonthKrw);
    chips.push({
      id: "last-month",
      label: `지난달 실지출(${amountText})로`,
      accessibilityLabel: `지난달 실지출 ${amountText}으로 맞추기`,
      nextDigits: String(Math.min(BUDGET_MAX_KRW, Math.floor(lastMonthKrw)))
    });
  }

  return chips;
}
