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
    // 조각이 하나뿐인 달 -- **"100%"가 남는 유일한 자리**다(아래 "100% 표기" describe의 판정 근거).
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
    // ⚠️ 두 시점 (범례 100 초과 읽힘).
    // 종전: 여기서 `expect(slices[0].percentLabel).toBe("100%")`였다. **그때는 그것이 고른
    // 규칙이었다** -- 이 파일이 바로 이 조합("100%" + "<1%")을 의도로 단언해 두었고, 모듈의
    // 계약 문장도 0% 쪽만 말했기 때문에(`a non-zero slice that rounds to 0% reads "<1%"`)
    // 한쪽 끝만 보면 완결돼 보였다. 100 쪽은 아무도 보지 않은 자리였다.
    // → 이제 "99%". 근거(값): 이 집합의 ratio는 99.9001% / 0.0999%이고 `percent`는 [100, 0]
    //   이라 **계산은 그대로 옳다**(합계 정확히 100 -- 바로 아래 줄이 그것을 못박는다).
    //   틀린 것은 표기였다: "100%"는 "전부"라고 말하는데 바로 아래 범례 줄에 1,000원짜리
    //   카테고리가 서 있어 화면이 스스로를 반박했고, 같은 라벨이 월간 인사이트 문장에 박혀
    //   Share.share로 앱 밖까지 나갔다. 조각이 둘 이상이면 100은 99로 적는다
    //   (src/home/budget-progress.ts · src/items/prep-milestones.ts의 캡과 같은 판단).
    expect(slices[0].percent).toBe(100);
    expect(slices[0].percentLabel).toBe("99%");
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

/**
 * 라운드 52 C-03: 드릴다운이 서 있는 땅.
 *
 * 리포트 범례를 누르면 그 조각의 카테고리로 기록 탭이 걸러진다. 그 대응이 성립하려면 조각 하나가
 * 입력 조각 하나에 정확히 대응해야 한다 -- 이 함수가 꼬리를 "기타"로 접거나 순서를 바꾸는 순간
 * 화면은 **조용히 엉뚱한 카테고리**를 필터링한다(0건이면 그나마 티가 나지만, 다른 카테고리의
 * 기록이 뜨면 그게 곧 허위 표시다). 그래서 그 성질을 여기서 못 박는다.
 */
describe("C-03 드릴다운 대응 (꼬리 접기 없음 · id 통과)", () => {
  it("keeps every countable slice in input order and folds no tail into 기타", () => {
    const input = Array.from({ length: 12 }, (_, index) => ({
      label: `c${index}`,
      amountKrw: 1_000_000 - index * 80_000,
      categoryId: `id-${index}`
    }));
    const slices = computeCategoryShares(input);

    expect(slices).toHaveLength(input.length);
    expect(slices.map((slice) => slice.label)).toEqual(input.map((segment) => segment.label));
    expect(slices.map((slice) => slice.categoryId)).toEqual(input.map((segment) => segment.categoryId));
    expect(slices.map((slice) => slice.label)).not.toContain("기타");
  });

  it("carries each slice's own categoryId even when zero-amount entries are dropped", () => {
    // 인덱스로 되짚었다면 여기서 한 칸씩 밀린다: 걸러지는 것은 1번인데 출력 1번은 원래 2번이다.
    const slices = computeCategoryShares([
      { label: "기저귀/위생", amountKrw: 340_000, categoryId: "cat-diaper" },
      { label: "빈 카테고리", amountKrw: 0, categoryId: "cat-empty" },
      { label: "수유/이유식", amountKrw: 160_000, categoryId: "cat-feeding" }
    ]);

    expect(slices.map((slice) => slice.categoryId)).toEqual(["cat-diaper", "cat-feeding"]);
    expect(slices[1].label).toBe("수유/이유식");
  });

  it("leaves categoryId undefined for callers that do not pass one (unchanged behaviour)", () => {
    const slices = computeCategoryShares([{ label: "기저귀/위생", amountKrw: 10_000 }]);
    expect(slices[0].categoryId).toBeUndefined();
  });
});

/**
 * 범례가 **100을 넘겨 읽히던 자리**(percentLabel 100% 캡).
 *
 * 무엇이 틀렸었나 — 값으로: 조리원 3,000,000 + 편의점 2,000인 흔한 한 달에서
 *   ratio        = 99.933378% / 0.066622%
 *   percent      = [100, 0]  → 합계 **정확히 100** (최대잔여법은 옳게 돌았다)
 *   종전 라벨    = "100%" + "<1%"  → 사람이 읽는 두 줄은 "전부" + "0보다 큼" = **100 초과**
 * 즉 고칠 대상은 계산이 아니라 **표기 한 자리**였다. 이 describe는 그 경계를 값으로 못박는다.
 *
 * 이 라벨은 범례 칸에서 끝나지 않는다: 월간 인사이트가 같은 문자열을 문장에 끼워
 * ("… 가장 많이 썼어요 (3,000,000원 · 전체의 99%)") `Share.share`로 앱 밖으로 내보낸다.
 * 그래서 이 자리의 허위 표시는 화면 밖까지 간다 — 소비 자리 넷의 전수와 공유 문구의 최종
 * 바이트는 category-share-label-consumers.test.ts가 값으로 센다.
 */
describe("100% 표기 — 다른 카테고리가 함께 서 있으면 99%", () => {
  const labelsOf = (amounts: number[]) =>
    computeCategoryShares(amounts.map((amountKrw, index) => ({ label: `c${index}`, amountKrw }))).map(
      (slice) => slice.percentLabel
    );

  it("조리원 3,000,000 + 편의점 2,000: 계산은 100으로 맞고, 라벨만 99%로 적는다", () => {
    const slices = computeCategoryShares([
      { label: "출산/산후조리", amountKrw: 3_000_000 },
      { label: "식비/간식", amountKrw: 2_000 }
    ]);

    // 계산은 손대지 않았다 -- 종전과 같은 값이다.
    expect(slices.map((slice) => slice.percent)).toEqual([100, 0]);
    expect(slices[0].percent + slices[1].percent).toBe(100);
    expect(slices.map((slice) => slice.widthPercent)).toEqual([98, 2]);

    // 표기만 바뀌었다.
    expect(slices.map((slice) => slice.percentLabel)).toEqual(["99%", "<1%"]);
  });

  it("조각이 하나뿐인 달에만 '100%'가 남는다 — 개수로 가른다(반올림 결과가 아니라)", () => {
    // 실제로 그 카테고리가 전부인 달: 100%는 참이다.
    expect(labelsOf([1_000_000])).toEqual(["100%"]);
    expect(labelsOf([42_000])).toEqual(["100%"]);

    // 돈이 든 다른 카테고리가 한 줄이라도 있으면 100%는 그 줄과 모순이다.
    expect(labelsOf([1_000_000, 1])).toEqual(["99%", "<1%"]);
    expect(labelsOf([1_000_000, 300, 300])).toEqual(["99%", "<1%", "<1%"]);

    // 0원·음수 카테고리는 조각이 되기 전에 떨어진다(isCountable) -- 그래서 그런 행이 섞여 있어도
    // "조각 하나뿐"은 그대로이고 100%가 남는다.
    const withEmptyRows = computeCategoryShares([
      { label: "기저귀/위생", amountKrw: 500_000 },
      { label: "빈 카테고리", amountKrw: 0 },
      { label: "환불", amountKrw: -10_000 }
    ]);
    expect(withEmptyRows).toHaveLength(1);
    expect(withEmptyRows[0].percentLabel).toBe("100%");
  });

  it("100 경계 밖의 라벨은 한 글자도 달라지지 않는다", () => {
    expect(labelsOf([600_000, 300_000, 100_000])).toEqual(["60%", "30%", "10%"]);
    expect(labelsOf([500_000, 499_000, 300])).toEqual(["50%", "50%", "<1%"]);
    expect(labelsOf([100, 100, 100])).toEqual(["34%", "33%", "33%"]);
    // 99로 반올림되는 조각은 종전에도 "99%"였다 -- 캡이 새 값을 만들어 내지 않는다는 뜻이다.
    expect(labelsOf([990_000, 10_000])).toEqual(["99%", "1%"]);
  });

  it("어떤 집합에서도 '100%'와 다른 조각이 한 화면에 함께 서지 않는다", () => {
    const cases = [
      [3_000_000, 2_000],
      [999_999, 1],
      [1_000_000, 900, 800, 700, 1],
      [1, 1],
      [500, 300, 200],
      [1_000_000_000_000, 1]
    ];

    for (const amounts of cases) {
      const labels = labelsOf(amounts);
      expect(labels).toHaveLength(amounts.length);
      expect(labels).not.toContain("100%");
    }
  });
});
