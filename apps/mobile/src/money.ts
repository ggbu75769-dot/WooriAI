/**
 * Round 5A D0 money-format helper (docs/5차/round5a-design-spec.md §D0 "타이포 (금액 규칙)").
 *
 * Single source of truth for rendering KRW amounts as "12,000원" (comma-grouped, '원' suffix,
 * no '₩'). Uses `Intl.NumberFormat('ko-KR')` per the spec rather than a hand-rolled regex.
 *
 * Amounts are always rendered as their absolute value -- this helper never emits a leading "-".
 * Sign (income/refund vs. expense) is a presentation concern handled by the caller (see
 * `MoneyText`'s `sign` prop in src/ui/MoneyText.tsx), not by the number formatter itself.
 *
 * (근거 갱신 — DSN-053 P1: R19-E가 `formatKrwParts`/`MoneyKrwParts`를 지운 사유는 "죽은
 * export"였고, 그 판단은 MOB-121이 `src/ui/MoneyText.tsx`를 지운 뒤에 내려진 것이다. 그
 * MoneyText는 승인 캡처(c20deeb)의 금액 표기 규칙 — 숫자와 '원'을 서로 다른 크기로 그리는
 * 위계 — 을 실제로 구현한 유일한 렌더러였다. P1에서 그 컴포넌트를 c20deeb에서 되돌리면서
 * 이 두 export도 함께 살아난다: 지금은 다시 호출부가 있으므로 죽은 export가 아니다.)
 */

const krwFormatter = new Intl.NumberFormat("ko-KR");

function safeAbsoluteAmount(amount: number): number {
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

/** Formats a KRW amount as "12,000원". Negative input and non-finite input render as 0. */
export function formatKrw(amount: number): string {
  return `${krwFormatter.format(safeAbsoluteAmount(amount))}원`;
}

export type MoneyKrwParts = {
  /** Comma-grouped digits, e.g. "12,000". */
  number: string;
  /** Always "원". */
  suffix: string;
};

/**
 * Same formatting rules as `formatKrw`, split into the numeric part and the '원' suffix so a
 * caller (namely `MoneyText`) can render the suffix one size step smaller than the number, per
 * the D0 hierarchy rule ("'원'은 숫자 대비 1단계 작게·가늘게").
 */
export function formatKrwParts(amount: number): MoneyKrwParts {
  return { number: krwFormatter.format(safeAbsoluteAmount(amount)), suffix: "원" };
}

/**
 * FMT-127: strips everything but digits out of a money TextInput's raw text.
 *
 * The controlled-amount screens (app/budget.tsx, app/(onboarding)/budget.tsx,
 * app/expenses/[expenseId].tsx) each carried a byte-identical private `toDigits`; they now share
 * this one so the "what counts as typed input" rule can never drift between the three fields.
 */
export function amountDigitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/**
 * FMT-127: formats a digit string ("38500") for display inside a money TextInput ("38,500").
 *
 * Deliberately WITHOUT the '원' suffix and without '₩': every caller renders '원' as a sibling
 * <Text> next to the field, so appending it here would double it ("38,500원원"). That is why this
 * is a separate export rather than a call to `formatKrw` — the D0 rule being enforced is the same
 * one (comma-grouped, no '₩'); only the suffix ownership differs.
 *
 * An empty digit string stays empty so the field's placeholder keeps showing (returning "0" would
 * make an untouched field look like a typed zero, and on the 예산 screens an untouched field means
 * "leave the current 예산 alone" — see app/budget.tsx's "비워두면 현재 예산이 그대로 유지돼요").
 *
 * This was duplicated verbatim in the same three screens as `formatAmount`. See the re-inline
 * guard in src/money.test.ts.
 */
export function formatAmountDigits(digits: string): string {
  if (!digits) return "";
  return krwFormatter.format(Number(digits));
}
