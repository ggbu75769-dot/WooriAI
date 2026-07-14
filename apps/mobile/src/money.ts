/**
 * Round 5A D0 money-format helper (docs/5차/round5a-design-spec.md §D0 "타이포 (금액 규칙)").
 *
 * Single source of truth for rendering KRW amounts as "12,000원" (comma-grouped, '원' suffix,
 * no '₩'). Uses `Intl.NumberFormat('ko-KR')` per the spec rather than a hand-rolled regex.
 *
 * Amounts are always rendered as their absolute value -- this helper never emits a leading "-".
 * Sign (income/refund vs. expense) is a presentation concern handled by the caller (see
 * `MoneyText`'s `sign` prop in src/ui/MoneyText.tsx), not by the number formatter itself.
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
