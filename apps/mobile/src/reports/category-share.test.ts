import { describe, expect, it } from "vitest";
import { computeCategoryShares, MIN_SLICE_WIDTH_PERCENT } from "./category-share";

const sumOf = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

describe("computeCategoryShares", () => {
  it("maps amounts onto their real proportions instead of fixed equal slices", () => {
    const slices = computeCategoryShares([
      { label: "기저귀/위생", amountKrw: 600_000 },
      { label: "분유/유제품", amountKrw: 300_000 },
      { label: "의류/잡화", amountKrw: 100_000 }
    ]);

    expect(slices.map((slice) => slice.percent)).toEqual([60, 30, 10]);
    expect(slices.map((slice) => slice.widthPercent)).toEqual([60, 30, 10]);
    expect(slices.map((slice) => slice.ratio)).toEqual([0.6, 0.3, 0.1]);
  });

  it("keeps the input order and carries each label and amount through untouched", () => {
    const slices = computeCategoryShares([
      { label: "장난감/도서", amountKrw: 12_000 },
      { label: "식비/간식", amountKrw: 88_000 }
    ]);

    expect(slices.map((slice) => slice.label)).toEqual(["장난감/도서", "식비/간식"]);
    expect(slices.map((slice) => slice.amountKrw)).toEqual([12_000, 88_000]);
  });

  it("corrects rounding so the displayed percents sum to exactly 100", () => {
    // Three equal thirds each round to 33% -> 99 without correction.
    const thirds = computeCategoryShares([
      { label: "a", amountKrw: 100 },
      { label: "b", amountKrw: 100 },
      { label: "c", amountKrw: 100 }
    ]);
    expect(sumOf(thirds.map((slice) => slice.percent))).toBe(100);
    expect(thirds.map((slice) => slice.percent)).toEqual([34, 33, 33]);

    // Seven equal slices: 14.28% each -> floors to 14 (98), two slices take the remainder.
    const sevenths = computeCategoryShares(
      Array.from({ length: 7 }, (_, index) => ({ label: `c${index}`, amountKrw: 1_000 }))
    );
    expect(sumOf(sevenths.map((slice) => slice.percent))).toBe(100);

    const messy = computeCategoryShares([
      { label: "a", amountKrw: 33_333 },
      { label: "b", amountKrw: 33_333 },
      { label: "c", amountKrw: 33_334 },
      { label: "d", amountKrw: 1 }
    ]);
    expect(sumOf(messy.map((slice) => slice.percent))).toBe(100);
  });

  it("drops zero, negative and non-finite amounts instead of drawing empty slices", () => {
    const slices = computeCategoryShares([
      { label: "기저귀/위생", amountKrw: 50_000 },
      { label: "빈 카테고리", amountKrw: 0 },
      { label: "환불", amountKrw: -10_000 },
      { label: "깨진 값", amountKrw: Number.NaN },
      { label: "식비/간식", amountKrw: 50_000 }
    ]);

    expect(slices.map((slice) => slice.label)).toEqual(["기저귀/위생", "식비/간식"]);
    expect(slices.map((slice) => slice.percent)).toEqual([50, 50]);
  });

  it("returns an empty list when there is nothing to draw", () => {
    expect(computeCategoryShares([])).toEqual([]);
    expect(computeCategoryShares([{ label: "a", amountKrw: 0 }])).toEqual([]);
    expect(computeCategoryShares([{ label: "a", amountKrw: -5 }])).toEqual([]);
  });

  it("gives a single category the whole bar", () => {
    const slices = computeCategoryShares([{ label: "기저귀/위생", amountKrw: 42_000 }]);

    expect(slices).toHaveLength(1);
    expect(slices[0].percent).toBe(100);
    expect(slices[0].percentLabel).toBe("100%");
    expect(slices[0].widthPercent).toBe(100);
  });

  it("keeps a tiny slice visible at the minimum width and never labels it 0%", () => {
    const slices = computeCategoryShares([
      { label: "기저귀/위생", amountKrw: 1_000_000 },
      { label: "기타", amountKrw: 1_000 }
    ]);

    // 0.0999...% of the total: too thin to see, so it is pinned to the floor.
    expect(slices[1].ratio).toBeCloseTo(0.000999, 6);
    expect(slices[1].widthPercent).toBe(MIN_SLICE_WIDTH_PERCENT);
    expect(slices[0].widthPercent).toBe(100 - MIN_SLICE_WIDTH_PERCENT);
    // Rounds to 0% -- shown as "<1%" so a real amount never reads as nothing.
    expect(slices[1].percent).toBe(0);
    expect(slices[1].percentLabel).toBe("<1%");
    expect(slices[0].percentLabel).toBe("100%");
  });

  it("always fills the bar exactly, whatever the shape of the data", () => {
    const cases = [
      [1],
      [1, 1],
      [999_999, 1],
      [500, 300, 200],
      [1_000_000, 900, 800, 700, 1],
      Array.from({ length: 12 }, (_, index) => (index + 1) * 137),
      Array.from({ length: 60 }, () => 1_000)
    ];

    for (const amounts of cases) {
      const slices = computeCategoryShares(amounts.map((amountKrw, index) => ({ label: `c${index}`, amountKrw })));

      expect(slices).toHaveLength(amounts.length);
      expect(sumOf(slices.map((slice) => slice.widthPercent))).toBeCloseTo(100, 9);
      expect(sumOf(slices.map((slice) => slice.percent))).toBe(100);
      for (const slice of slices) {
        expect(slice.widthPercent).toBeGreaterThan(0);
      }
    }
  });

  it("falls back to an even split when there are more categories than the floor allows", () => {
    const slices = computeCategoryShares(
      Array.from({ length: 80 }, (_, index) => ({ label: `c${index}`, amountKrw: index + 1 }))
    );

    expect(sumOf(slices.map((slice) => slice.widthPercent))).toBeCloseTo(100, 9);
    expect(new Set(slices.map((slice) => slice.widthPercent)).size).toBe(1);
  });

  it("preserves the large slices' relative proportions after the minimum-width floor is applied", () => {
    const slices = computeCategoryShares([
      { label: "a", amountKrw: 600_000 },
      { label: "b", amountKrw: 300_000 },
      { label: "c", amountKrw: 100 }
    ]);

    expect(slices[2].widthPercent).toBe(MIN_SLICE_WIDTH_PERCENT);
    // a stays twice as wide as b; only the shared budget shrank.
    expect(slices[0].widthPercent / slices[1].widthPercent).toBeCloseTo(2, 9);
    expect(sumOf(slices.map((slice) => slice.widthPercent))).toBeCloseTo(100, 9);
  });
});
