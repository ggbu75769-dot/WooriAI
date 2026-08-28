// R20-A: pure share math for the report tab's 카테고리 비중 chart (src/ui.tsx DonutChartCard).
//
// Split out of ui.tsx so it can be unit tested without importing "react-native" -- react-native's
// entry module ships untranspiled Flow syntax that Vitest's default parser cannot handle, so any
// test importing ui.tsx directly fails before it can run (same reason as src/lineChartMath.ts).
//
// Why a stacked bar instead of a proportional donut arc: the previous arc was drawn with the
// border-quadrant trick (four border colors on a rounded View), which can only ever express four
// fixed 90° wedges -- the angles carried no information, so a 60% category and a 5% category drew
// the same quarter. No SVG/conic-gradient dependency is available in this app and adding one is
// out of scope, and the alternative pure-View technique (rotated half-discs inside overflow-hidden
// clips) cannot be verified visually from this environment. A horizontal stacked bar expresses the
// exact proportion with plain flex widths, so it is the honest rendering: a correct bar beats a
// decorative circle whose angles lie about the data.

export type CategoryShareInput = {
  label: string;
  amountKrw: number;
  /**
   * 라운드 52 C-03: 이 조각이 **어느 카테고리인지**. 드릴다운(리포트 범례 → 기록 탭 필터)이
   * 쓰는 유일한 식별자다.
   *
   * 왜 인덱스가 아니라 값으로 들고 다니는가: 이 함수는 금액이 0/음수/비정상인 항목을 **떨어
   * 뜨리므로**(`isCountable`) 입력 배열과 출력 배열의 인덱스가 어긋날 수 있다. 화면이 인덱스로
   * categoryId를 되짚으면 "0원 카테고리가 하나 섞인 달"에서 조용히 **한 칸 밀린 엉뚱한 필터**가
   * 걸린다. 그래서 조각이 자기 id를 함께 들고 나간다.
   *
   * 선택 필드다 — 넘기지 않으면(비중 문장을 만드는 monthly-insight 등) 결과에도 없고, 이 필드가
   * 생기기 전과 동작이 같다.
   */
  categoryId?: string;
};

export type CategoryShareSlice = {
  label: string;
  amountKrw: number;
  /** 입력 조각의 `categoryId`를 그대로 통과시킨 값(넘기지 않았으면 undefined). */
  categoryId?: string;
  /** Exact share of the total, 0..1. */
  ratio: number;
  /** Integer percent, largest-remainder corrected so the whole set sums to exactly 100. */
  percent: number;
  /** Display string for `percent`; a non-zero slice that rounds to 0% reads "<1%", never "0%". */
  percentLabel: string;
  /** Bar width in percent: proportional, floored at MIN_SLICE_WIDTH_PERCENT, sums to 100. */
  widthPercent: number;
};

/**
 * A slice narrower than this would render as a hairline (or disappear entirely) in the bar, so
 * every non-zero slice is drawn at least this wide. On a ~300dp card that is ~6dp -- visible, and
 * small enough that the widths it steals from the large slices stay imperceptible.
 */
export const MIN_SLICE_WIDTH_PERCENT = 2;

function isCountable(amountKrw: number): boolean {
  return Number.isFinite(amountKrw) && amountKrw > 0;
}

/**
 * Integer percents that sum to exactly 100 (largest remainder / Hare quota). Ties break toward the
 * larger raw ratio, then toward the earlier slice, so the result is deterministic.
 */
function largestRemainderPercents(ratios: number[]): number[] {
  const scaled = ratios.map((ratio) => ratio * 100);
  const percents = scaled.map((value) => Math.floor(value));
  let remaining = 100 - percents.reduce((sum, value) => sum + value, 0);

  const order = scaled
    .map((value, index) => ({ index, remainder: value - Math.floor(value), value }))
    .sort((a, b) => b.remainder - a.remainder || b.value - a.value || a.index - b.index);

  for (const entry of order) {
    if (remaining <= 0) break;
    percents[entry.index] += 1;
    remaining -= 1;
  }

  return percents;
}

/**
 * Proportional bar widths with a minimum-visible floor. Slices that fall under the floor are
 * pinned to it and the rest are rescaled to share what is left, repeating until no rescaled slice
 * has dropped under the floor. Widths always sum to 100.
 */
function flooredWidths(ratios: number[]): number[] {
  const count = ratios.length;
  if (count === 0) return [];

  // Too many slices for every one to clear the floor -- split the bar evenly instead of
  // producing widths that sum past 100.
  if (count * MIN_SLICE_WIDTH_PERCENT >= 100) {
    return ratios.map(() => 100 / count);
  }

  // Common case: every slice already clears the floor, so the raw proportions are the widths.
  const raw = ratios.map((ratio) => ratio * 100);
  if (raw.every((width) => width >= MIN_SLICE_WIDTH_PERCENT)) return raw;

  const pinned = ratios.map(() => false);

  for (;;) {
    const pinnedCount = pinned.filter(Boolean).length;
    const budget = 100 - pinnedCount * MIN_SLICE_WIDTH_PERCENT;
    const freeRatioTotal = ratios.reduce((sum, ratio, index) => (pinned[index] ? sum : sum + ratio), 0);
    let changed = false;

    for (let index = 0; index < count; index += 1) {
      if (pinned[index]) continue;
      const width = freeRatioTotal > 0 ? (ratios[index] / freeRatioTotal) * budget : budget / (count - pinnedCount);
      if (width < MIN_SLICE_WIDTH_PERCENT) {
        pinned[index] = true;
        changed = true;
      }
    }

    if (!changed) {
      const finalBudget = 100 - pinned.filter(Boolean).length * MIN_SLICE_WIDTH_PERCENT;
      const finalFreeTotal = ratios.reduce((sum, ratio, index) => (pinned[index] ? sum : sum + ratio), 0);
      return ratios.map((ratio, index) =>
        pinned[index] ? MIN_SLICE_WIDTH_PERCENT : finalFreeTotal > 0 ? (ratio / finalFreeTotal) * finalBudget : 0
      );
    }
  }
}

/**
 * Turns raw category amounts into the slices the 카테고리 비중 bar and its legend render.
 *
 * - Zero, negative and non-finite amounts are dropped (they cannot own a share of the bar).
 * - An empty input, or one whose amounts all drop out, returns [] -- callers render their own
 *   empty state rather than a bar of nothing.
 * - `percent` values always sum to exactly 100; `widthPercent` values always sum to exactly 100.
 * - 살아남은 조각들은 **입력 순서 그대로**이고 꼬리를 "기타"로 접지도 않는다. 그래서 조각 하나는
 *   언제나 입력 조각 하나에 1:1로 대응하고, 함께 들고 나온 `categoryId`가 그 조각의 것이 맞다
 *   (라운드 52 C-03 — category-share.test.ts가 이 성질을 고정한다).
 */
export function computeCategoryShares(segments: readonly CategoryShareInput[]): CategoryShareSlice[] {
  const countable = segments.filter((segment) => isCountable(segment.amountKrw));
  const total = countable.reduce((sum, segment) => sum + segment.amountKrw, 0);
  if (countable.length === 0 || total <= 0) return [];

  const ratios = countable.map((segment) => segment.amountKrw / total);
  const percents = largestRemainderPercents(ratios);
  const widths = flooredWidths(ratios);

  return countable.map((segment, index) => ({
    label: segment.label,
    amountKrw: segment.amountKrw,
    categoryId: segment.categoryId,
    ratio: ratios[index],
    percent: percents[index],
    percentLabel: percents[index] === 0 ? "<1%" : `${percents[index]}%`,
    widthPercent: widths[index]
  }));
}
