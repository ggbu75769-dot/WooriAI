/**
 * UX-121 — 지출 금액 입력 프리셋(누적 칩)의 순수 로직.
 *
 * "10초 기록" 루프에서 금액 입력은 남은 탭 수의 대부분을 차지한다(35,000원 = 숫자 5탭).
 * +1천/+5천/+1만/+5만 칩을 탭해 현재 금액에 더하면 같은 금액을 2~4탭으로 만들 수 있다.
 * 칩은 입력을 대체하지 않고 보조할 뿐이라, 칩을 탭한 뒤에도 키패드로 자유롭게 고칠 수 있다
 * (화면은 이 모듈이 돌려준 숫자 문자열을 그대로 amountText 상태에 넣는다).
 *
 * 저장소/네트워크/React에 의존하지 않는 계산만 담아 vitest 단위 테스트 대상으로 둔다
 * (src/expenses/recent-items.ts와 같은 관례).
 *
 * 금액 규칙은 DNC-013("지출 금액은 0보다 큰 원화 정수")과 정합한다:
 * - 결과는 항상 0 이상의 정수 문자열(소수·부호·구분기호·불필요한 앞자리 0 없음) —
 *   저장 시점의 `Number(amountText)` 정수 검증(app/expenses/new.tsx의 isAmountInvalid)을
 *   그대로 통과한다.
 * - 반복 탭이 IEEE754 안전 정수 범위를 넘기지 않도록 상한(QUICK_AMOUNT_MAX_KRW)에서 멈춘다.
 *   상한은 이 화면의 입력 보조용 클램프일 뿐이며 서버/계약(moneyKrwSchema: int >= 1)에는
 *   상한이 없다 — 그래서 사용자가 직접 타이핑해 이미 상한을 넘긴 금액은 칩이 깎지 않는다
 *   (더 이상 늘리지 않고 친 값 그대로 둔다).
 */

/** 칩으로 제공하는 가산 단위(원). 화면의 칩 순서와 같다. */
export const QUICK_AMOUNT_PRESETS_KRW = [1000, 5000, 10000, 50000] as const;

/**
 * 누적 가산의 상한(원, 1억). 육아 지출 한 건으로 현실적인 최댓값을 크게 웃도는 값이라
 * 정상 입력을 막지 않으면서, 칩을 계속 눌러도 금액이 발산하지 않게 한다.
 */
export const QUICK_AMOUNT_MAX_KRW = 100_000_000;

/**
 * 금액 입력 문자열을 정규화한 숫자 문자열로 만든다: 숫자 아닌 문자 제거(붙여넣기/포맷된
 * 값 방어) + 앞자리 0 제거. 숫자가 하나도 없으면 빈 문자열(= 아직 입력 없음).
 */
function normalizeAmountDigits(amountText: string): string {
  const digits = amountText.replace(/[^0-9]/g, "");
  if (digits.length === 0) return "";
  return digits.replace(/^0+(?=\d)/, "");
}

/**
 * 금액 입력 문자열을 정수 원화 값으로 읽는다. 빈 값·숫자 없는 값은 0.
 * 안전 정수 범위를 넘는 자릿수는 어차피 상한을 넘긴 값이므로 상한 초과로 취급한다
 * (칩 탭이 NaN이나 정밀도 깨진 값을 만들지 않게 한다).
 */
export function parseAmountText(amountText: string): number {
  const digits = normalizeAmountDigits(amountText);
  if (digits.length === 0) return 0;
  const parsed = Number(digits);
  if (!Number.isSafeInteger(parsed)) return Number.MAX_SAFE_INTEGER;
  return parsed;
}

/**
 * 현재 금액 문자열에 프리셋 금액을 더한 새 금액 문자열을 돌려준다.
 *
 * - 빈 값(또는 숫자가 없는 값)에서 시작하면 프리셋 값 자체가 된다.
 * - 결과는 QUICK_AMOUNT_MAX_KRW에서 멈춘다.
 * - 이미 상한 이상인 금액은 바뀌지 않는다(타이핑한 자릿수를 그대로 보존).
 * - 프리셋 값이 양의 정수가 아니면(방어) 현재 금액을 정규화만 해서 돌려준다.
 */
export function addAmountPreset(currentAmountText: string, presetKrw: number): string {
  const digits = normalizeAmountDigits(currentAmountText);
  const current = parseAmountText(digits);
  if (!Number.isInteger(presetKrw) || presetKrw <= 0) return digits;
  if (current >= QUICK_AMOUNT_MAX_KRW) return digits;
  return String(Math.min(current + presetKrw, QUICK_AMOUNT_MAX_KRW));
}

/**
 * 금액을 비운다(0으로 리셋). 빈 문자열을 돌려주는 이유: 화면이 빈 값을 "₩ 0"으로 렌더하고
 * 저장 버튼은 비활성으로 두므로, "0"을 남겨 사용자가 지우고 다시 쳐야 하는 상태를 만들지 않는다.
 */
export function clearAmountText(): string {
  return "";
}

/** 프리셋 칩을 눌러 금액이 실제로 늘어날 수 있는지(상한 도달 시 false). */
export function canAddAmountPreset(currentAmountText: string): boolean {
  return parseAmountText(currentAmountText) < QUICK_AMOUNT_MAX_KRW;
}

/**
 * 프리셋 금액의 한국어 짧은 표기: 1000 -> "1천", 10000 -> "1만", 15000 -> "1만 5천",
 * 500 -> "500". 만·천 단위로 떨어지지 않는 나머지는 숫자 그대로 붙인다.
 */
export function formatPresetAmountKorean(presetKrw: number): string {
  if (!Number.isInteger(presetKrw) || presetKrw <= 0) return "0";
  const parts: string[] = [];
  let remainder = presetKrw;
  const manUnits = Math.floor(remainder / 10000);
  if (manUnits > 0) {
    parts.push(`${manUnits.toLocaleString("ko-KR")}만`);
    remainder -= manUnits * 10000;
  }
  const cheonUnits = Math.floor(remainder / 1000);
  if (cheonUnits > 0) {
    parts.push(`${cheonUnits}천`);
    remainder -= cheonUnits * 1000;
  }
  if (remainder > 0) parts.push(String(remainder));
  return parts.join(" ");
}

/** 칩에 보이는 텍스트: "+1천" */
export function formatPresetChipLabel(presetKrw: number): string {
  return `+${formatPresetAmountKorean(presetKrw)}`;
}

/** 스크린리더용 라벨: "1천 원 더하기" */
export function presetChipAccessibilityLabel(presetKrw: number): string {
  return `${formatPresetAmountKorean(presetKrw)} 원 더하기`;
}
