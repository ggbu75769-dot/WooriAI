import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeCategoryShares } from "./category-share";
import { buildPeriodInsight, PERIOD_INSIGHT_MAX_SENTENCES } from "./period-insight";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 라운드 82 트랙 A: 분기·연간 세그먼트의 한 문장.
 *
 * 이 스위트가 지는 것은 넷이다.
 *  ⓐ **파생** — 문장이 지목하는 카테고리·퍼센트가 같은 화면 도넛 범례의 1위와 **같은 값**이다
 *    (같은 `computeCategoryShares`를 지난다 — 반올림 규칙의 두 번째 벌 금지).
 *  ⓑ **부정** — 근거가 없으면 카드가 없다(총액 0 · 분해 없음 · 이름 캐시 없음 · 라벨 없음).
 *  ⓒ **부정** — 그 카드에 예산 문장도 비교 문장도 공유 버튼도 서지 않는다.
 *  ⓓ **바이트 불변** — 월간 세그먼트의 렌더가 종전과 정확히 같다(문장·카드·버튼 전부).
 *
 * 화면 배선은 이 폴더의 관례대로 소스 그렙으로 잰다(리포트 탭은 vitest에서 렌더되지 않는다 —
 * src/reports/monthly-insight-flow.test.ts와 같은 방식).
 */
describe("분기·연간 인사이트 조립기", () => {
  const 분기분해 = [
    { label: "기저귀/위생", amountKrw: 840_000, categoryId: "cat-diaper" },
    { label: "수유/이유식", amountKrw: 620_000, categoryId: "cat-feed" },
    { label: "의류", amountKrw: 340_000, categoryId: "cat-cloth" }
  ];

  it("분기 라벨과 1위 카테고리로 한 문장을 만든다", () => {
    const insight = buildPeriodInsight({
      unit: "quarter",
      periodLabel: "2026년 3분기",
      totalExpenseKrw: 1_800_000,
      segments: 분기분해
    });

    expect(insight).not.toBeNull();
    expect(insight!.headline).toBe("2026년 3분기에는 기저귀/위생에 가장 많이 썼어요 (840,000원 · 전체의 47%)");
    // 카드가 한 요소로 읽힌다(월간 카드와 같은 관례).
    expect(insight!.accessibilityLabel).toBe(insight!.headline);
    expect(insight!.sentences).toEqual([insight!.headline]);
    expect(insight!.detail).toBeNull();
    expect(insight!.unit).toBe("quarter");
  });

  it("연간도 같은 문장 틀을 쓴다(기간 라벨만 다르다)", () => {
    const insight = buildPeriodInsight({
      unit: "year",
      periodLabel: "2026년",
      totalExpenseKrw: 1_800_000,
      segments: 분기분해
    });

    expect(insight!.headline).toBe("2026년에는 기저귀/위생에 가장 많이 썼어요 (840,000원 · 전체의 47%)");
    expect(insight!.unit).toBe("year");
  });

  /**
   * ⓐ 파생 계약. 문장의 퍼센트를 이 테스트가 **다시 계산하지 않는다** — 도넛 범례가 부르는 그
   * 함수를 여기서도 불러 1위 조각과 맞춘다. 두 값이 갈리는 순간(예: 조립기가 자기 반올림을
   * 들이는 순간) 이 단언이 깨진다.
   */
  it("ⓐ 문장의 카테고리·퍼센트가 도넛 범례 1위와 같은 값이다", () => {
    const legend = computeCategoryShares(분기분해);
    const legendTop = legend.reduce((best, slice) => (slice.amountKrw > best.amountKrw ? slice : best), legend[0]);

    const insight = buildPeriodInsight({
      unit: "quarter",
      periodLabel: "2026년 3분기",
      totalExpenseKrw: 1_800_000,
      segments: 분기분해
    });

    expect(insight!.topCategoryLabel).toBe(legendTop.label);
    expect(insight!.topCategoryPercentLabel).toBe(legendTop.percentLabel);
    expect(insight!.headline).toContain(legendTop.label);
    expect(insight!.headline).toContain(`전체의 ${legendTop.percentLabel}`);
  });

  it("ⓐ 서버가 내림차순으로 주지 않아도 1위는 금액이 가장 큰 조각이다", () => {
    const insight = buildPeriodInsight({
      unit: "quarter",
      periodLabel: "2026년 3분기",
      totalExpenseKrw: 1_800_000,
      // 일부러 뒤섞은 순서.
      segments: [분기분해[2],분기분해[0], 분기분해[1]]
    });

    expect(insight!.topCategoryLabel).toBe("기저귀/위생");
  });

  it("ⓐ 1% 미만 조각도 범례와 같은 '<1%' 표기를 쓴다(반올림 규칙 한 벌)", () => {
    const segments = [
      { label: "기저귀/위생", amountKrw: 1_000_000 },
      { label: "기타", amountKrw: 100 }
    ];
    const legend = computeCategoryShares(segments);

    const insight = buildPeriodInsight({
      unit: "year",
      periodLabel: "2026년",
      totalExpenseKrw: 1_000_100,
      segments
    });

    expect(legend[1].percentLabel).toBe("<1%");
    expect(insight!.topCategoryPercentLabel).toBe(legend[0].percentLabel);
  });

  describe("ⓑ 근거가 없으면 카드가 없다", () => {
    it("기간 총액이 0원이면 null", () => {
      expect(
        buildPeriodInsight({ unit: "quarter", periodLabel: "2026년 3분기", totalExpenseKrw: 0, segments: 분기분해 })
      ).toBeNull();
    });

    it("총액을 아직 모르거나 값이 이상하면 null", () => {
      for (const total of [null, undefined, Number.NaN, -1]) {
        expect(
          buildPeriodInsight({ unit: "year", periodLabel: "2026년", totalExpenseKrw: total, segments: 분기분해 })
        ).toBeNull();
      }
    });

    it("카테고리 분해가 없으면(아직 안 옴 · 빈 배열 · 전부 0원) null", () => {
      for (const segments of [undefined, null, [], [{ label: "기저귀/위생", amountKrw: 0 }]]) {
        expect(
          buildPeriodInsight({ unit: "quarter", periodLabel: "2026년 3분기", totalExpenseKrw: 1_800_000, segments })
        ).toBeNull();
      }
    });

    it("기간 라벨이 비면 null(문장의 주어가 없다)", () => {
      for (const periodLabel of ["", "   "]) {
        expect(
          buildPeriodInsight({ unit: "year", periodLabel, totalExpenseKrw: 1_800_000, segments: 분기분해 })
        ).toBeNull();
      }
    });
  });

  /**
   * ⓒ 이 모듈이 **말하지 않기로 한 것**. 예산·비교는 이 화면에 근거가 없는 값이고(합친 예산이
   * 존재하지 않고, 직전 분기/해의 합계를 화면이 갖고 있지 않다), 공유 문구는 별도 결정이다.
   * 문장 상한이 1인 것이 그 규율의 값이다.
   */
  it("ⓒ 예산·비교·공유 문장을 만들지 않는다(문장은 하나)", () => {
    expect(PERIOD_INSIGHT_MAX_SENTENCES).toBe(1);

    const insight = buildPeriodInsight({
      unit: "quarter",
      periodLabel: "2026년 3분기",
      totalExpenseKrw: 1_800_000,
      segments: 분기분해
    });

    expect(insight!.sentences).toHaveLength(1);
    for (const banned of ["예산", "지난", "적게", "보다", "하루 평균", "공유"]) {
      expect(insight!.headline).not.toContain(banned);
    }
    // 조립기의 입력 자체에 예산·직전 기간 값이 들어올 자리가 없다(구조적으로 불가능하다).
    const moduleSource = source("src/reports/period-insight.ts");
    expect(moduleSource).not.toContain("budgetAmountKrw");
    expect(moduleSource).not.toContain("previous");
    // 새 반올림/새 집계를 만들지 않는다 — 범례와 같은 함수 하나만 부른다.
    expect(moduleSource).toContain('from "./category-share"');
    expect(moduleSource).toContain("computeCategoryShares(segments)");
    expect(moduleSource).not.toContain("Math.round");
    // 이 폴더의 관례: 순수 모듈은 react-native를 들이지 않는다(단위 테스트 가능).
    expect(moduleSource).not.toContain("react-native");
  });

  it("월간 문장의 단일 소스를 침범하지 않는다", () => {
    const moduleSource = source("src/reports/period-insight.ts");
    // 월간은 monthly-insight.ts 하나가 소유한다 — 이 모듈은 그 소스를 읽지도 부르지도 않는다.
    expect(moduleSource).not.toContain('from "./monthly-insight"');
    expect(moduleSource).not.toContain("buildMonthlyInsight");
    // unit에 월간이 없는 것이 그 규율의 타입 표현이다.
    expect(moduleSource).toContain('export type PeriodInsightUnit = "quarter" | "year";');
  });
});

describe("라운드 82 트랙 A 리포트 인사이트 배선", () => {
  const reportSource = () => source("app/(tabs)/reports.tsx");

  it("보고 있는 기간의 분해를 **도넛에 넘어가는 그 배열 그대로** 넘긴다(새 요청 0건)", () => {
    const src = reportSource();

    expect(src).toContain('import { buildPeriodInsight } from "../../src/reports/period-insight";');
    expect(src).toContain('hasSession && period !== "월간"');
    expect(src).toContain("periodLabel,");
    expect(src).toContain("totalExpenseKrw: activeTotal,");
    // 도넛이 받는 그 변수 그대로다 -- 라벨을 다시 만들면 문장과 범례가 갈릴 수 있다.
    expect(src).toContain("segments: categories.isSuccess ? categorySegments : undefined");
    expect(src).toContain("segments={categorySegments}");
    // 카테고리 조회는 한 벌 그대로다(분기·연간 문장을 위해 새로 부르지 않는다).
    expect(src.match(/getCategoryReport\(/g) ?? []).toHaveLength(1);
    // ⓔ 쿼리는 **줄어들기만** 한다: 종전 열하나에서 ["home", childId] 하나가 빠진 열이다.
    expect(src.match(/useQuery\(\{/g) ?? []).toHaveLength(10);
  });

  it("ⓒ 분기·연간 카드에는 공유 버튼도 예산 줄도 서지 않는다", () => {
    const src = reportSource();

    const cardStart = src.indexOf("{periodInsight ? (");
    const cardEnd = src.indexOf("{cumulative.isLoading ? (", cardStart);
    expect(cardStart, "{periodInsight ? ( 렌더 블록을 찾지 못했다").toBeGreaterThan(-1);
    expect(cardEnd, "{cumulative.isLoading ? ( 표식을 찾지 못했다").toBeGreaterThan(cardStart);
    const card = src.slice(cardStart, cardEnd);

    expect(card).not.toContain("reportShareButtonStyle");
    expect(card).not.toContain("공유하기");
    expect(card).not.toContain("completedMonthBudgetLine");
    expect(card).not.toContain("deltaLabel");
    // 공유 버튼은 화면 전체에서 여전히 둘(마일스톤·월간)뿐이다.
    expect(src.match(/style=\{reportShareButtonStyle\}/g) ?? []).toHaveLength(2);

    // 예산·비교의 판정은 종전 그대로 월간에만 매여 있다(무접촉).
    expect(src).toContain(
      'hasSession && period === "월간" && monthly.isSuccess && !monthlyInsightSpokeBudget(monthlyInsight)'
    );
    expect(src).toContain("const insightSpokeComparison = Boolean(monthlyInsight?.hasComparison);");
  });

  /**
   * ⓓ 바이트 불변. 월간 카드 블록은 종전과 **같은 문자열**이고, 새 카드는 그 **뒤**에 선다
   * (DSN-053 구획 순서: 도넛 → peach 카드 → 누적 peach 카드). 두 카드는 서로 배타라
   * 한 화면에 peach 인사이트 카드가 두 장 설 수 없다.
   */
  it("ⓓ 월간 카드 블록은 종전 그대로이고 새 카드는 같은 구획 안에서 그 뒤에 선다", () => {
    const src = reportSource();

    const donut = src.lastIndexOf("<DonutChartCard");
    const monthlyCard = src.indexOf("{monthlyInsight ? (");
    const periodCard = src.indexOf("{periodInsight ? (");
    const cumulativeCard = src.indexOf(">오늘도 소중한 하루였어요<");
    for (const [name, position] of Object.entries({ donut, monthlyCard, periodCard, cumulativeCard })) {
      expect(position, `${name} 자리를 찾지 못했다`).toBeGreaterThan(-1);
    }
    expect(donut).toBeLessThan(monthlyCard);
    expect(monthlyCard).toBeLessThan(periodCard);
    expect(periodCard).toBeLessThan(cumulativeCard);

    // 월간 렌더의 문장·카드·버튼이 전부 종전 형태 그대로다.
    expect(src).toContain("accessibilityLabel={monthlyInsight.accessibilityLabel}");
    expect(src).toContain("monthlyInsight.detail ? <Text");
    expect(src).toContain("{monthlyShareMessage ? (");
    // 월간 문장은 여전히 monthly-insight 하나에서만 온다.
    expect(src.match(/buildMonthlyInsight\(/g) ?? []).toHaveLength(1);
    expect(src.match(/buildPeriodInsight\(/g) ?? []).toHaveLength(1);
    // 두 카드는 같은 peach 카드 스타일을 쓴다(새 카드 룩 0건).
    expect(src.match(/<Card style=\{reportInsightCardStyle\}>/g) ?? []).toHaveLength(2);
    expect(src.match(/style=\{reportInsightTextGroupStyle\}/g) ?? []).toHaveLength(2);
    expect(src.match(/style=\{reportInsightHeadlineStyle\}/g) ?? []).toHaveLength(2);
  });

  it("월간 세그먼트는 이 조립기를 지나지 않는다(월간 문장 단일 소스)", () => {
    const src = reportSource();

    const callStart = src.indexOf("buildPeriodInsight({");
    const callEnd = src.indexOf("GAP-066 트랙 A(#1)", callStart);
    expect(callStart, "buildPeriodInsight({ 호출을 찾지 못했다").toBeGreaterThan(-1);
    expect(callEnd, "GAP-066 트랙 A(#1) 표식을 찾지 못했다").toBeGreaterThan(callStart);
    const call = src.slice(callStart, callEnd);

    // 월간 응답을 이 조립기에 넘기지 않는다.
    expect(call).not.toContain("monthly.data");
    expect(call).not.toContain("previousMonth");
    expect(call).not.toContain("reportYearMonth");
    // 단위는 두 갈래뿐이다.
    expect(call).toContain('unit: period === "분기" ? "quarter" : "year"');
  });
});
