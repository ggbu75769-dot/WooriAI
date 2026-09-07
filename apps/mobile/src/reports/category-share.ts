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
  /**
   * 화면에 적는 표시 문자열. **표기 전용**이라 `percent`와 한 글자씩 대응하지 않는다 --
   * 양 끝(0% · 100%)에서 갈라진다. 규칙과 근거는 아래 `percentDisplayLabel` 주석에 있다.
   */
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
 * 조각 하나가 **화면에 적히는 글자**. `percent`(위 최대잔여법 결과)는 손대지 않는다 --
 * 여기서 바뀌는 것은 표기뿐이다.
 *
 * ## 0으로 반올림된 조각 → "<1%" (종전 그대로, 그때도 지금도 참)
 * 실제로 돈이 든 조각을 "0%"라고 적으면 같은 줄의 금액("2,000원")과 퍼센트가 서로를 부정한다.
 *
 * ## 100으로 반올림된 조각 → 조각이 둘 이상이면 "99%" (⚠️ 두 시점 — 이번에 더한 갈래)
 *
 * **종전(그때는 참): `percent === 100`이면 조건 없이 "100%"였다.** 그 규칙 자체가 잘못 고른
 * 것은 아니었다 -- 0 쪽 갈래가 이미 그 자리에 있었고, category-share.test.ts는 정확히 이 조합
 * (`slices[0].percentLabel === "100%"` + `slices[1].percentLabel === "<1%"`)을 **의도로 단언해
 * 두었다**. 왜 그때는 문제로 보이지 않았는가: 이 모듈의 계약 문장(위 `CategoryShareSlice` ·
 * `computeCategoryShares` 머리말)이 **0% 쪽만** 말했기 때문이다("a non-zero slice that rounds to
 * 0% reads "<1%", never "0%""). 한쪽 끝만 보면 그 단언은 완결돼 보인다.
 *
 * **→ 이제: 다른 조각과 함께 서 있는 100은 "99%"라고 적는다.** 근거는 실측값이다
 * (조리원 3,000,000 + 편의점 2,000 -- 흔한 한 달):
 *  · ratio  = 99.933378% / 0.066622%  → `percent` = [100, 0] (합계 정확히 **100**, 계산은 옳다)
 *  · 종전 라벨 = "100%" + "<1%"  → 범례 두 줄이 **100을 넘겨 읽힌다**("전부" + "0보다 큼").
 *    화면이 스스로를 반박한다: "전체의 100%" 바로 아래 줄에 **돈이 든 다른 카테고리**가 선다.
 *  · 이제 라벨 = "99%" + "<1%"  → 두 줄의 합이 100을 넘지 않고, "전부는 아니다"가 참이 된다.
 * 고칠 대상이 라벨인 이유도 그 실측에 있다 -- `percent` 합은 이미 정확히 100이다(계산은 옳다).
 *
 * ## "실제로 정확히 100%인 달"과는 어떻게 갈리나 — **개수로 가른다(반올림이 아니라)**
 * `sliceCount === 1`일 때만 "100%"가 남는다. `isCountable`이 0·음수·비유한 금액을 이미
 * 떨어뜨렸으므로 살아남은 조각은 전부 `amountKrw > 0`이고, 따라서 `sliceCount > 1`은 곧
 * **돈이 든 다른 카테고리가 실제로 있다**는 뜻이다(반올림 결과를 다시 읽어 추정하는 것이
 * 아니다). 실측: [42,000] → 조각 1개 → "100%"(종전 그대로) / [3,000,000, 2,000] → 조각 2개 →
 * "99%". 반대로 `ratio === 1` 같은 부동소수 비교로 갈랐다면 1e18과 1이 섞인 집합에서 ratio가
 * 1.0으로 떨어져 "100%"가 다시 새어 나온다 -- 개수는 그런 구멍이 없다.
 *
 * ## 선례 두 곳과 **같은 판단·같은 형태**다
 *  · `src/items/prep-milestones.ts`의 `prepDisplayPercent(percent, isComplete)` -- "판정
 *    (`isComplete`·`tier`)에는 손대지 않는다. 여기서 바뀌는 것은 **표기**뿐이다", 그리고 그
 *    판정은 반올림이 아니라 **개수**(resolvedCount === totalCount)로 한다. 199/200이 100%로
 *    반올림되던 그 자리와 이 자리는 같은 실패다.
 *  · `src/home/budget-progress.ts`의 `budgetUsagePercent` --
 *    `!isBudgetUsedUp(budgetKrw, spentKrw) && rounded >= 100 ? 99 : rounded`. "그 구간을 99로
 *    캡해 **100%는 실제로 다 쓴 달에만** 나오게 한다." 여기서도 100%는 실제로 그 카테고리가
 *    전부인 달에만 나온다.
 *
 * ## 왜 ">99%"가 아닌가
 * ">99%"는 참인 표기이고 "<1%"와 대칭이라 후보였지만, 이 라벨은 범례 칸에만 사는 값이 아니다 --
 * 월간 인사이트 문장에 그대로 박혀 `Share.share`로 **앱 밖으로 나간다**("… 가장 많이 썼어요
 * (3,000,000원 · 전체의 99%)"). 문장 한가운데에 부등호를 넣으면 받는 사람이 보는 것은 낯선
 * 표기이고, 선례 두 곳도 같은 문제를 특수 표기가 아니라 **평범한 99**로 닫았다. "<1%"는 문장에
 * 들어갈 수 없어(1위 조각은 정의상 percent가 0일 수 없다) 그 비대칭은 화면에서 보이지 않는다.
 * 잃는 것은 "99.93%인 달과 진짜 99.4%인 달을 구별할 수 없다"는 것뿐인데, 두 달이 말해야 하는
 * 사실("거의 전부지만 전부는 아니다")은 같다.
 */
function percentDisplayLabel(percent: number, sliceCount: number): string {
  if (percent === 0) return "<1%";
  if (percent === 100 && sliceCount > 1) return "99%";
  return `${percent}%`;
}

/**
 * Turns raw category amounts into the slices the 카테고리 비중 bar and its legend render.
 *
 * - Zero, negative and non-finite amounts are dropped (they cannot own a share of the bar).
 * - An empty input, or one whose amounts all drop out, returns [] -- callers render their own
 *   empty state rather than a bar of nothing.
 * - `percent` values always sum to exactly 100; `widthPercent` values always sum to exactly 100.
 * - `percentLabel`은 그 합계 성질을 **물려받지 않는다**. 양 끝에서 표기가 값을 떠나기 때문이다:
 *   0으로 반올림된 조각은 "<1%"(0보다 크다고 말한다), 다른 조각과 함께 서 있으면서 100으로
 *   반올림된 조각은 "99%"(전부는 아니라고 말한다). 두 갈래의 근거는 `percentDisplayLabel` 주석.
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
    percentLabel: percentDisplayLabel(percents[index], countable.length),
    widthPercent: widths[index]
  }));
}
