/**
 * Round 5A D0 money-format helper (docs/5차/round5a-design-spec.md §D0 "타이포 (금액 규칙)").
 *
 * Single source of truth for rendering KRW amounts as "12,000원" (comma-grouped, '원' suffix,
 * no '₩'). Uses `Intl.NumberFormat('ko-KR')` per the spec rather than a hand-rolled regex.
 *
 * Amounts are always rendered as their absolute value -- this helper never emits a leading "-".
 * Sign (income/refund vs. expense) is a presentation concern handled by the caller, not by the
 * number formatter itself.
 *
 * (MOB-121 removed the D0 `MoneyText` component and, with it, this module's only caller of the
 * split number/suffix variant; `formatKrwParts`/`MoneyKrwParts` were dropped in R19-E as dead
 * exports. The money type scale those two rendered lives on in `theme.money`, which `ui/ListRow`
 * still consumes.)
 */

const krwFormatter = new Intl.NumberFormat("ko-KR");

function safeAbsoluteAmount(amount: number): number {
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

/** Formats a KRW amount as "12,000원". Negative input and non-finite input render as 0. */
export function formatKrw(amount: number): string {
  return `${krwFormatter.format(safeAbsoluteAmount(amount))}원`;
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
