// R19-D: 예산 경계(80%/100%) 판정 단일 소스의 경계값 전수 테스트.
// 모바일 홈 배너(apps/mobile/src/home/budget-warning.test.ts)와 서버 푸시
// (apps/api/test/push-dispatch.db.test.ts resolveReachedBoundaries)에 흩어져 있던
// 경계 케이스를 여기로 모았다 — 각 표면의 테스트는 카피/배선만 검증한다.
import { describe, expect, it } from "vitest";
import { reachedBudgetBoundaries } from "./budget-boundary";

const BUDGET = 1_000_000;

describe("reachedBudgetBoundaries — 예산 미설정", () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, null, undefined] as Array<number | null | undefined>)(
    "budgetKrw=%s 이면 아무 경계도 도달하지 않는다",
    (budgetKrw) => {
      expect(reachedBudgetBoundaries({ budgetKrw, spentKrw: 999_999_999 })).toEqual({
        hasBudget: false,
        reached80: false,
        reached100: false,
        exceeded: false,
        overAmountKrw: 0,
        usedPercent: 0
      });
    }
  );
});

describe("reachedBudgetBoundaries — 지출이 없거나 유효하지 않은 경우", () => {
  it.each([0, -1, Number.NaN, null, undefined] as Array<number | null | undefined>)(
    "spentKrw=%s 는 0으로 흡수돼 어떤 경계도 도달하지 않는다",
    (spentKrw) => {
      expect(reachedBudgetBoundaries({ budgetKrw: BUDGET, spentKrw })).toEqual({
        hasBudget: true,
        reached80: false,
        reached100: false,
        exceeded: false,
        overAmountKrw: 0,
        usedPercent: 0
      });
    }
  );
});

describe("reachedBudgetBoundaries — 80% 경계", () => {
  it("79.99%는 미도달, 정확히 80%부터 도달", () => {
    expect(reachedBudgetBoundaries({ budgetKrw: BUDGET, spentKrw: 799_999 }).reached80).toBe(false);
    expect(reachedBudgetBoundaries({ budgetKrw: BUDGET, spentKrw: 800_000 }).reached80).toBe(true);
  });

  it("80%대에서는 100% 경계에 닿지 않는다", () => {
    const status = reachedBudgetBoundaries({ budgetKrw: BUDGET, spentKrw: 999_999 });
    expect(status).toEqual({
      hasBudget: true,
      reached80: true,
      reached100: false,
      exceeded: false,
      overAmountKrw: 0,
      usedPercent: 99
    });
  });

  it("정수 연산이라 부동소수점 경계 오차가 없다", () => {
    // 예산 3원: 80%는 2.4원 — 2원(66.6%)은 미도달, 3원은 정확히 100%.
    expect(reachedBudgetBoundaries({ budgetKrw: 3, spentKrw: 2 }).reached80).toBe(false);
    expect(reachedBudgetBoundaries({ budgetKrw: 3, spentKrw: 3 }).reached100).toBe(true);
    // 예산 5원: 4원이 정확히 80%.
    expect(reachedBudgetBoundaries({ budgetKrw: 5, spentKrw: 4 })).toEqual({
      hasBudget: true,
      reached80: true,
      reached100: false,
      exceeded: false,
      overAmountKrw: 0,
      usedPercent: 80
    });
    // 0.1 + 0.2 류의 오차가 생길 수 있는 값들도 정확히 판정된다.
    expect(reachedBudgetBoundaries({ budgetKrw: 3_000_000, spentKrw: 2_400_000 }).reached80).toBe(true);
    expect(reachedBudgetBoundaries({ budgetKrw: 3_000_000, spentKrw: 2_399_999 }).reached80).toBe(false);
  });
});

describe("reachedBudgetBoundaries — 100% 경계와 '도달 vs 초과' 구분", () => {
  it("정확히 100%: 도달했지만 초과는 아니다 (0원 초과라고 말하면 허위)", () => {
    expect(reachedBudgetBoundaries({ budgetKrw: BUDGET, spentKrw: BUDGET })).toEqual({
      hasBudget: true,
      reached80: true,
      reached100: true,
      exceeded: false,
      overAmountKrw: 0,
      usedPercent: 100
    });
  });

  it("1원 초과부터 exceeded + 정확한 초과 금액", () => {
    expect(reachedBudgetBoundaries({ budgetKrw: BUDGET, spentKrw: BUDGET + 1 })).toEqual({
      hasBudget: true,
      reached80: true,
      reached100: true,
      exceeded: true,
      overAmountKrw: 1,
      usedPercent: 100
    });
    const far = reachedBudgetBoundaries({ budgetKrw: BUDGET, spentKrw: 2_234_567 });
    expect(far.exceeded).toBe(true);
    expect(far.overAmountKrw).toBe(1_234_567);
    expect(far.usedPercent).toBe(223);
  });

  it("reached100이면 reached80은 언제나 참이다", () => {
    for (const spentKrw of [BUDGET, BUDGET + 1, BUDGET * 10]) {
      const status = reachedBudgetBoundaries({ budgetKrw: BUDGET, spentKrw });
      expect(status.reached100 && status.reached80).toBe(true);
    }
  });
});

describe("reachedBudgetBoundaries — usedPercent(표시용)는 내림", () => {
  it("99.99%는 99%로 내려간다 (예산 안인데 '100%'라고 적으면 허위)", () => {
    expect(reachedBudgetBoundaries({ budgetKrw: BUDGET, spentKrw: 999_999 }).usedPercent).toBe(99);
    expect(reachedBudgetBoundaries({ budgetKrw: BUDGET, spentKrw: 990_000 }).usedPercent).toBe(99);
    expect(reachedBudgetBoundaries({ budgetKrw: BUDGET, spentKrw: 800_000 }).usedPercent).toBe(80);
  });
});

describe("reachedBudgetBoundaries — 서버 푸시 판정표(기존 resolveReachedBoundaries 이관)", () => {
  it.each([
    // [spentKrw, budgetKrw, reached80, reached100]
    [0, 100_000, false, false],
    [79_999, 100_000, false, false],
    [80_000, 100_000, true, false], // 정확히 80%
    [99_999, 100_000, true, false],
    [100_000, 100_000, true, true], // 정확히 100% — 경계 도달 (카피만 '모두 사용')
    [100_001, 100_000, true, true],
    [50_000, 0, false, false] // 예산 미설정
  ] as Array<[number, number, boolean, boolean]>)(
    "spent=%d budget=%d -> 80:%s 100:%s",
    (spentKrw, budgetKrw, reached80, reached100) => {
      const status = reachedBudgetBoundaries({ budgetKrw, spentKrw });
      expect({ reached80: status.reached80, reached100: status.reached100 }).toEqual({ reached80, reached100 });
    }
  );
});

describe("reachedBudgetBoundaries — 선물 제외 합계 계약(DNC-015)", () => {
  it("선물을 포함해 합산하면 없던 경계가 생긴다 — 호출자는 선물 제외 합계를 넘겨야 한다", () => {
    const monthRecords = [
      { expenseType: "expense" as const, amountKrw: 700_000 },
      { expenseType: "gift" as const, amountKrw: 500_000 },
      { expenseType: "expense" as const, amountKrw: 90_000 }
    ];
    const giftExcluded = monthRecords
      .filter((record) => record.expenseType === "expense")
      .reduce((sum, record) => sum + record.amountKrw, 0);
    expect(giftExcluded).toBe(790_000);
    expect(reachedBudgetBoundaries({ budgetKrw: BUDGET, spentKrw: giftExcluded }).reached80).toBe(false);
    const giftIncluded = monthRecords.reduce((sum, record) => sum + record.amountKrw, 0);
    expect(reachedBudgetBoundaries({ budgetKrw: BUDGET, spentKrw: giftIncluded }).reached100).toBe(true);
  });
});
