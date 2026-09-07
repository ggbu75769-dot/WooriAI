/**
 * Round 5A D0 money-format helper (docs/5차/round5a-design-spec.md §D0 "타이포 (금액 규칙)").
 *
 * Single source of truth for rendering KRW amounts as "12,000원" (comma-grouped, '원' suffix,
 * no '₩'). Uses `Intl.NumberFormat('ko-KR')` per the spec rather than a hand-rolled regex.
 *
 * Amounts are always rendered as their absolute value -- this helper never emits a leading "-".
 * Sign (income/refund vs. expense) is a presentation concern handled by the caller, not by the
 * number formatter itself.
 */

const krwFormatter = new Intl.NumberFormat("ko-KR");

function safeAbsoluteAmount(amount: number): number {
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

/** Formats a KRW amount as "12,000원". Negative input and non-finite input render as 0. */
export function formatKrw(amount: number): string {
  return `${krwFormatter.format(safeAbsoluteAmount(amount))}원`;
}

// R19-E가 지웠던 formatKrwParts/MoneyKrwParts는 DSN-053 P1에서 MoneyText와 함께 되살아났다가,
// P2가 그 컴포넌트를 채택하지 않아 다시 제거됐다(유일 호출부 소멸 — R19-E와 같은 판단).

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

/**
 * A11Y-115: 금액 입력칸이 **스크린리더에** 넘길 값(`accessibilityValue`) — 단위가 붙은 쪽이다.
 *
 * 바로 위 `formatAmountDigits`의 머리말이 적어 둔 그 비대칭이 낭독에서 결함이 된다: 입력칸은
 * 접미사 없는 "38,500"을 그리고 '원'은 **형제 `<Text>`**로 따로 서므로, 칸에 포커스하면 소리로는
 * 단위가 사라진다. 빠른 기록 시트(`app/expenses/new.tsx`)는 이 사실을 이미 알고 접미사 붙은
 * 표기를 `accessibilityValue`로 넘기고 있었는데(*"숫자만 읽어 주면 단위가 사라진다"* — 그 파일의
 * 근거 주석) 나머지 금액 칸 셋(지출 수정 · 예산 총액 · 카테고리별 예산 행)에는 그 한 칸이 없어,
 * **같은 앱의 같은 성격 입력칸이 화면마다 다르게 읽혔다.** 그 규칙을 세 화면이 각자 적지 않도록
 * 여기(표기의 단일 소스)에 한 벌로 둔다 — `formatKrw`가 만드는 그 문자열 그대로다.
 *
 * ⚠️ **빈 자릿수에는 넘길 사실이 없다(`undefined`).** `formatKrw(0)`("0원")을 넘기면 아무것도
 * 치지 않은 칸이 *"0원"* 으로 읽히는데, 예산 화면에서 빈 칸은 0원이 아니라 **"현재 예산을 그대로
 * 둔다"** 이고(화면이 눈으로도 그렇게 말한다 — "비워두면 현재 예산이 그대로 유지돼요"),
 * 카테고리 행의 빈 칸은 **"그 카테고리 예산 해제"** 다. 위 `formatAmountDigits`가 빈 자릿수를 빈
 * 문자열로 돌려주는 것과 **같은 이유·같은 방향**이다(*"returning '0' would make an untouched
 * field look like a typed zero"*) — 눈에 빈 칸이면 귀에도 빈 칸이다.
 *
 * 반환 모양은 React Native `AccessibilityValue`의 `text` 한 칸과 구조가 같다(이 모듈은 react-native를
 * 들여오지 않는다 — 순수 모듈로 남아야 vitest가 값으로 검증할 수 있다).
 */
export function amountFieldAccessibilityValue(digits: string): { readonly text: string } | undefined {
  if (!digits) return undefined;
  return { text: formatKrw(Number(digits)) };
}
