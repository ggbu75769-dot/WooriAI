import { describe, expect, it } from "vitest";
import {
  buildMonthlyInsight,
  elapsedDaysInMonth,
  MONTHLY_INSIGHT_MAX_SENTENCES,
  resolveMonthStatus,
  type MonthlyInsightInput
} from "./monthly-insight";

/**
 * UX-F 월간 인사이트 문장 조립 단위 테스트.
 *
 * 고정 좌표: 오늘은 2025-08-15(서울). "2025-08"은 진행 중인 달, "2025-07"은 끝난 달이다.
 */
const TODAY = "2025-08-15";

/** 시드 카테고리처럼 UUID 대신 읽기 쉬운 id를 쓰고, 이름 해석은 화면과 같은 함수 형태로 넘긴다. */
const categoryNames: Record<string, string> = {
  diaper: "기저귀/위생",
  feeding: "분유/이유식",
  clothes: "의류/세탁"
};
const categoryLabel = (categoryId: string) => categoryNames[categoryId] ?? "기타";

function input(overrides: Partial<MonthlyInsightInput> = {}): MonthlyInsightInput {
  return {
    yearMonth: "2025-08",
    todayIso: TODAY,
    totalExpenseKrw: 263_000,
    budgetAmountKrw: null,
    categoryTop: [
      { categoryId: "diaper", amountKrw: 84_200 },
      { categoryId: "feeding", amountKrw: 60_000 },
      { categoryId: "clothes", amountKrw: 118_800 }
    ],
    categoryLabel,
    previousMonthTotalKrw: null,
    ...overrides
  };
}

describe("UX-F resolveMonthStatus / elapsedDaysInMonth", () => {
  it("classifies the selected month against the Seoul calendar day", () => {
    expect(resolveMonthStatus("2025-08", TODAY)).toBe("in-progress");
    expect(resolveMonthStatus("2025-07", TODAY)).toBe("complete");
    expect(resolveMonthStatus("2024-12", TODAY)).toBe("complete");
    expect(resolveMonthStatus("2025-09", TODAY)).toBe("future");
  });

  it("rejects malformed inputs instead of guessing", () => {
    expect(resolveMonthStatus("2025-13", TODAY)).toBeNull();
    expect(resolveMonthStatus("2025-8", TODAY)).toBeNull();
    expect(resolveMonthStatus("2025-08", "2025-08")).toBeNull();
  });

  it("counts elapsed days from the 1st and stops at the last day of the month", () => {
    // 경계 1: 달의 첫날 -- 경과일 1(0으로 나누지 않는다).
    expect(elapsedDaysInMonth("2025-08", "2025-08-01", "in-progress")).toBe(1);
    // 경계 2: 달의 마지막 날 -- 경과일 = 그 달의 길이.
    expect(elapsedDaysInMonth("2025-08", "2025-08-31", "in-progress")).toBe(31);
    expect(elapsedDaysInMonth("2025-02", "2025-02-28", "in-progress")).toBe(28);
    // 윤년 2월.
    expect(elapsedDaysInMonth("2024-02", "2024-02-29", "in-progress")).toBe(29);
    // 끝난 달은 통째로 경과했다.
    expect(elapsedDaysInMonth("2025-06", TODAY, "complete")).toBe(30);
    expect(elapsedDaysInMonth("2025-09", TODAY, "future")).toBeNull();
  });
});

describe("UX-F 카테고리 1위 문장", () => {
  it("names the largest category with its amount and share of the month total", () => {
    const insight = buildMonthlyInsight(input());

    // 1위는 서버가 준 순서가 아니라 금액으로 고른다(위 픽스처는 3번째가 최대).
    expect(insight?.headline).toBe("이번 달은 의류/세탁에 가장 많이 썼어요 (118,800원 · 전체의 45%)");
  });

  it("reuses the donut legend's rounding so the two numbers on one screen cannot disagree", () => {
    // 84,200 / 263,000 = 32.01...% -> 32%. 최대잔여법이라 전체 합은 정확히 100%다.
    const insight = buildMonthlyInsight(
      input({
        categoryTop: [
          { categoryId: "diaper", amountKrw: 84_200 },
          { categoryId: "feeding", amountKrw: 178_800 }
        ]
      })
    );
    expect(insight?.headline).toContain("전체의 68%");

    const flipped = buildMonthlyInsight(
      input({
        totalExpenseKrw: 100_000,
        categoryTop: [
          { categoryId: "diaper", amountKrw: 84_200 },
          { categoryId: "feeding", amountKrw: 15_800 }
        ]
      })
    );
    expect(flipped?.headline).toBe("이번 달은 기저귀/위생에 가장 많이 썼어요 (84,200원 · 전체의 84%)");
  });

  it("says 이번 달 only for the month in progress and names the month otherwise", () => {
    const lastMonth = buildMonthlyInsight(input({ yearMonth: "2025-07" }));
    expect(lastMonth?.headline.startsWith("7월은 ")).toBe(true);
    expect(lastMonth?.headline).not.toContain("이번 달");
  });

  it("omits the sentence when the category breakdown is missing or empty (데이터 불충분)", () => {
    expect(buildMonthlyInsight(input({ categoryTop: [] }))?.headline).not.toContain("가장 많이");
    expect(buildMonthlyInsight(input({ categoryTop: undefined }))?.headline).not.toContain("가장 많이");
    // 금액이 전부 0이면 비중을 말할 수 없다.
    expect(
      buildMonthlyInsight(input({ categoryTop: [{ categoryId: "diaper", amountKrw: 0 }] }))?.headline
    ).not.toContain("가장 많이");
  });
});

describe("UX-F 지난달 비교 문장", () => {
  it("compares whole month against whole month only once the month has ended", () => {
    const insight = buildMonthlyInsight(
      input({ yearMonth: "2025-07", totalExpenseKrw: 251_000, previousMonthTotalKrw: 263_000 })
    );

    expect(insight?.hasComparison).toBe(true);
    expect(insight?.sentences).toContain("지난달 전체보다 12,000원 적게 썼어요");
  });

  it("says 많이 썼어요 in the other direction and 같아요 when the two months tie", () => {
    expect(
      buildMonthlyInsight(input({ yearMonth: "2025-07", totalExpenseKrw: 275_000, previousMonthTotalKrw: 263_000 }))
        ?.sentences
    ).toContain("지난달 전체보다 12,000원 많이 썼어요");
    expect(
      buildMonthlyInsight(input({ yearMonth: "2025-07", totalExpenseKrw: 263_000, previousMonthTotalKrw: 263_000 }))
        ?.sentences
    ).toContain("지난달 전체와 지출이 같아요");
  });

  /**
   * 이 화면이 가진 지난달 데이터는 **월 전체 합계** 하나뿐이라, 진행 중인 달과 비교하면
   * 매달 1일마다 "적게 썼어요"가 뜨는 허위 비교가 된다. 그래서 문장 자체를 만들지 않는다.
   */
  it("never compares an in-progress month against last month's full total", () => {
    const insight = buildMonthlyInsight(input({ previousMonthTotalKrw: 263_000 }));

    expect(insight?.monthStatus).toBe("in-progress");
    expect(insight?.hasComparison).toBe(false);
    expect(insight?.sentences.join(" ")).not.toContain("지난달");
  });

  it("omits the comparison when last month has no spending at all (첫 달 사용자 포함)", () => {
    for (const previousMonthTotalKrw of [0, null, undefined, -1]) {
      const insight = buildMonthlyInsight(input({ yearMonth: "2025-07", previousMonthTotalKrw }));
      expect(insight?.hasComparison, `previous=${previousMonthTotalKrw}`).toBe(false);
    }
  });
});

describe("UX-F 예산 · 하루 평균 문장", () => {
  it("states the budget share and the daily average for the month in progress", () => {
    // 15일 경과, 243,000원 -> 하루 평균 16,200원. 예산 380,000원의 64%.
    const insight = buildMonthlyInsight(
      input({ totalExpenseKrw: 243_000, budgetAmountKrw: 380_000, categoryTop: [] })
    );

    expect(insight?.headline).toBe("예산의 64%를 썼고, 하루 평균 16,200원이에요");
    expect(insight?.elapsedDays).toBe(15);
    expect(insight?.dailyAverageKrw).toBe(16_200);
  });

  it("divides by elapsed days at both month boundaries (1일 · 말일)", () => {
    const firstDay = buildMonthlyInsight(
      input({ todayIso: "2025-08-01", totalExpenseKrw: 30_000, categoryTop: [] })
    );
    expect(firstDay?.elapsedDays).toBe(1);
    expect(firstDay?.headline).toBe("하루 평균 30,000원이에요");

    const lastDay = buildMonthlyInsight(
      input({ todayIso: "2025-08-31", totalExpenseKrw: 310_000, categoryTop: [] })
    );
    expect(lastDay?.elapsedDays).toBe(31);
    expect(lastDay?.headline).toBe("하루 평균 10,000원이에요");
  });

  it("reports the overspend instead of a 100%-clamped share when the budget is exceeded", () => {
    const insight = buildMonthlyInsight(
      input({ totalExpenseKrw: 420_000, budgetAmountKrw: 380_000, categoryTop: [] })
    );

    expect(insight?.headline).toBe("예산보다 40,000원 많이 썼고, 하루 평균 28,000원이에요");
    expect(insight?.headline).not.toContain("100%");
  });

  it("drops the budget clause when no budget is set (0원 예산을 예산으로 말하지 않는다)", () => {
    for (const budgetAmountKrw of [null, undefined, 0]) {
      const insight = buildMonthlyInsight(input({ budgetAmountKrw, categoryTop: [] }));
      expect(insight?.headline, `budget=${budgetAmountKrw}`).not.toContain("예산");
    }
  });

  it("keeps 하루 평균 out of a finished month (경과일 개념이 없는 구간)", () => {
    const insight = buildMonthlyInsight(
      input({ yearMonth: "2025-07", budgetAmountKrw: 380_000, categoryTop: [], previousMonthTotalKrw: null })
    );

    expect(insight?.headline).toBe("예산의 69%를 썼어요");
    expect(insight?.dailyAverageKrw).toBeNull();
  });
});

describe("UX-F 카드 조립", () => {
  it("keeps the card to at most two sentences, ordered by what matters for that month", () => {
    const inProgress = buildMonthlyInsight(input({ budgetAmountKrw: 380_000, previousMonthTotalKrw: 263_000 }));
    expect(inProgress?.sentences).toHaveLength(MONTHLY_INSIGHT_MAX_SENTENCES);
    expect(inProgress?.sentences[0]).toContain("가장 많이 썼어요");
    expect(inProgress?.sentences[1]).toContain("하루 평균");

    const finished = buildMonthlyInsight(
      input({ yearMonth: "2025-07", totalExpenseKrw: 251_000, budgetAmountKrw: 380_000, previousMonthTotalKrw: 263_000 })
    );
    expect(finished?.sentences).toHaveLength(MONTHLY_INSIGHT_MAX_SENTENCES);
    expect(finished?.sentences[0]).toContain("가장 많이 썼어요");
    expect(finished?.sentences[1]).toContain("지난달 전체보다");
    // 상한에 밀린 예산 문장은 "말한 것"으로 집계되지 않는다.
    expect(finished?.dailyAverageKrw).toBeNull();
  });

  it("exposes headline/detail and one joined TalkBack label", () => {
    const insight = buildMonthlyInsight(input({ budgetAmountKrw: 380_000 }));

    expect(insight?.detail).toBe(insight?.sentences[1]);
    expect(insight?.accessibilityLabel).toBe(insight?.sentences.join(" "));
  });

  it("renders nothing when the month has no spending to summarize", () => {
    expect(buildMonthlyInsight(input({ totalExpenseKrw: 0 }))).toBeNull();
    expect(buildMonthlyInsight(input({ totalExpenseKrw: null }))).toBeNull();
    expect(buildMonthlyInsight(input({ totalExpenseKrw: undefined }))).toBeNull();
    expect(buildMonthlyInsight(input({ totalExpenseKrw: Number.NaN }))).toBeNull();
  });

  it("renders nothing for a future month or a malformed period", () => {
    expect(buildMonthlyInsight(input({ yearMonth: "2025-09" }))).toBeNull();
    expect(buildMonthlyInsight(input({ yearMonth: "not-a-month" }))).toBeNull();
    expect(buildMonthlyInsight(input({ todayIso: "2025-08" }))).toBeNull();
  });

  /** DNC-018: 사실만 말한다 -- 평가·조언·죄책감 유발 문구 금지(홈 한 줄과 같은 금칙어). */
  it("keeps evaluation, advice and guilt out of every sentence it can produce", () => {
    const forbidden = ["잘하", "훌륭", "줄여", "아껴", "절약", "주의", "권장", "추천", "해보세요", "위험", "낭비"];
    const variants: MonthlyInsightInput[] = [
      input(),
      input({ budgetAmountKrw: 380_000 }),
      input({ totalExpenseKrw: 420_000, budgetAmountKrw: 380_000 }),
      input({ yearMonth: "2025-07", previousMonthTotalKrw: 263_000 }),
      input({ yearMonth: "2025-07", totalExpenseKrw: 300_000, previousMonthTotalKrw: 263_000 }),
      input({ todayIso: "2025-08-01" })
    ];

    for (const variant of variants) {
      const text = buildMonthlyInsight(variant)?.accessibilityLabel ?? "";
      expect(text.length).toBeGreaterThan(0);
      for (const word of forbidden) {
        expect(text, `${text} should not contain ${word}`).not.toContain(word);
      }
      expect(text).toContain("어요");
    }
  });
});
