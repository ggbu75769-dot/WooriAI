import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeCategoryShares } from "./category-share";
import {
  buildPeriodInsight,
  PERIOD_INSIGHT_MAX_SENTENCES,
  PERIOD_INSIGHT_TOTAL_TOLERANCE_KRW
} from "./period-insight";

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
    // ⚠️ 두 시점 (라벨 100% 캡). 위 단언은 **파생**이라 규칙이 바뀌어도 조용히 통과한다 —
    // 이 문장이 실제로 무슨 글자를 말했는지는 리터럴로 적어 둔다.
    // 종전(그때는 참): 1위 라벨이 "100%"였고 문장은 "… 전체의 100%)"로 끝났다. 바로 아래
    // 범례 줄에 100원짜리 "기타"가 서 있는데도 그랬다(그때는 그것이 이 모듈들이 함께 고른
    // 규칙이었다 — category-share.test.ts가 그 조합을 의도로 단언해 두었다).
    // → 이제 "99%": 조각이 둘 이상이면 100은 "전부"라고 적지 않는다. `percent`는 여전히
    //   [100, 0]이고 합계도 100이라 계산은 그대로다(근거는 category-share.ts의
    //   percentDisplayLabel 주석).
    expect(legend[0].percentLabel).toBe("99%");
    expect(insight!.headline).toBe("2026년에는 기저귀/위생에 가장 많이 썼어요 (1,000,000원 · 전체의 99%)");
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
   * 라운드 82 리뷰 L-13 — **"전체의 47%"의 *전체*는 화면의 "총 지출"과 같은 수여야 한다.**
   *
   * 분기·연간은 총액과 분해가 **엔드포인트 둘**에서 온다. 두 응답이 서로 다른 시점의 스냅숏이면
   * 문장의 분모(조각 합)와 바로 위 카드의 숫자가 갈리는데, 종전에는 `totalExpenseKrw`를 "0원인가"
   * 판정에만 썼기 때문에 그 어긋남이 화면에 그대로 나갔다.
   */
  describe("ⓑ 분모와 화면 총액이 갈리면 말하지 않는다 (L-13)", () => {
    it("허용 오차는 0원이다 — 두 집계는 같은 술어·같은 경계의 정수 합계다", () => {
      expect(PERIOD_INSIGHT_TOTAL_TOLERANCE_KRW).toBe(0);
    });

    it("조각 합이 기간 총액과 1원이라도 다르면 null", () => {
      const denominator = 분기분해.reduce((sum, segment) => sum + segment.amountKrw, 0);
      for (const totalExpenseKrw of [denominator + 1, denominator - 1, denominator * 2]) {
        expect(
          buildPeriodInsight({ unit: "quarter", periodLabel: "2026년 3분기", totalExpenseKrw, segments: 분기분해 })
        ).toBeNull();
      }
      // 같은 수이면 종전 그대로 문장이 선다(위 단언이 "언제나 null"이라 통과한 것이 아님).
      expect(
        buildPeriodInsight({
          unit: "quarter",
          periodLabel: "2026년 3분기",
          totalExpenseKrw: denominator,
          segments: 분기분해
        })
      ).not.toBeNull();
    });

    it("분모는 범례가 세는 조각만 더한 값이다(0원 조각이 섞여도 문장이 사라지지 않는다)", () => {
      const segments = [...분기분해, { label: "기타", amountKrw: 0, categoryId: "cat-etc" }];
      const denominator = computeCategoryShares(segments).reduce((sum, slice) => sum + slice.amountKrw, 0);

      const insight = buildPeriodInsight({
        unit: "quarter",
        periodLabel: "2026년 3분기",
        totalExpenseKrw: denominator,
        segments
      });

      expect(insight).not.toBeNull();
      expect(insight!.topCategoryLabel).toBe("기저귀/위생");
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
    expect(src).toContain("segments: categories.isSuccess && activeCategory.isSuccess ? categorySegments : undefined");
    expect(src).toContain("segments={categorySegments}");
    // 카테고리 조회는 한 벌 그대로다(분기·연간 문장을 위해 새로 부르지 않는다).
    expect(src.match(/getCategoryReport\(/g) ?? []).toHaveLength(1);
    // ⓔ 쿼리는 **줄어들기만** 한다: 종전 열하나에서 ["home", childId] 하나가 빠진 열이다.
    expect(src.match(/useQuery\(\{/g) ?? []).toHaveLength(10);
  });

  /**
   * 라운드 82 리뷰 M-1 — **성공 게이트가 월간과 같은 모양이다.**
   *
   * 종전에는 이 카드가 `hasSession && period !== "월간"` 뒤에만 서서, 도넛이 에러 카드를 그리는
   * 화면에서도 아래 peach 카드가 **같은 실패 쿼리의 옛 캐시**로 문장을 단언했다(react-query는
   * 재조회가 실패해도 마지막 성공 `data`를 남긴다). 월간 카드는 처음부터 `monthly.isSuccess` 뒤에
   * 있었으므로 비대칭이었다.
   */
  it("M-1: 총액 쿼리와 분해 쿼리가 **둘 다 성공**했을 때만 문장을 만든다", () => {
    const src = reportSource();

    // ① 기간 총액 쿼리 — 월간의 monthly.isSuccess와 같은 자리를 세그먼트별로 고른 값 하나.
    expect(src).toContain(
      'period === "월간" ? monthly.isSuccess : period === "분기" ? quarterTrend.isSuccess : yearly.isSuccess'
    );
    expect(src).toContain('hasSession && period !== "월간" && activeIsSuccess');
    // ② 분해 쿼리 — 바로 위 도넛이 에러 카드를 그리는 그 판정.
    expect(src).toContain("categories.isSuccess && activeCategory.isSuccess ? categorySegments : undefined");
    // 종전의 비대칭 형태가 남아 있지 않다.
    expect(src).not.toContain("segments: categories.isSuccess ? categorySegments : undefined");

    // 도넛의 에러 분기는 종전 그대로다 — 같은 쿼리의 실패를 두 카드가 같은 판정으로 읽는다.
    expect(src).toContain("activeCategory.isError ? (");
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

/**
 * 라운드 108 — **분류 이름의 개행 가드(분기·연간)**. 라운드 106 T6(share-text.ts의 마일스톤 줄)과
 * 그 후속(monthly-insight.ts의 월간 문장)이 막은 그 슬라이스의 **남은 한 끝**이다.
 *
 * 종전(그때는 참): 이 모듈은 도넛 조각의 `label`을 그대로 문장에 끼웠고, 그때는 분류 이름이 시드
 * 21행의 고정 문자열뿐이라 개행이 섞일 자리가 없었다.
 * → 그다음(라운드 108 — **그때는 참이었다**): 이름은 자유 문자열이 됐고, 어드민 이름 변경 경로가
 * 개행을 접지 않았다(`admin-categories.dto.ts`의 `@Transform`이 `.trim()`뿐이라 `"기저귀\n위생"`이
 * MinLength(1)·MaxLength(50)을 통과했고, `buildCategoryNameLookup`도 내부 개행 무손질 `.trim()`
 * 이었다). 그래서 이 가드가 섰다.
 * → **이제(라운드 109 — 오늘 소스에서 직접 재확인): 위 두 문장은 둘 다 거짓이다.** 그 라운드가
 * 서버 유입 지점(`normalizeDisplayName` + `@IsSafeDisplayName`)과 앱의 해석기
 * (`buildCategoryNameLookup` → `displaySafeCategoryName`)를 함께 고쳤다. **그래도 이 가드는
 * 그대로 남는다**: 조립기는 순수 함수라 라벨을 호출부에서 받고(아래 테스트도 직접 넘긴다),
 * ⓐ 그 고침 이전에 저장돼 캐시에 실린 값 · ⓑ 서버 DTO를 지나지 않는 데모/로컬 대역 · ⓒ 아직
 * 그 거절이 없는 가구 커스텀 유입 지점이 남는다(근거는 `src/reports/period-insight.ts`와
 * `src/categories.ts`의 두 시점 주석). 이 파일이 무는 것은 유입 경로가 아니라 **조립기의 계약**
 * 이므로, 유입이 닫혀도 기대값은 한 글자도 달라지지 않는다.
 *
 * 이 모듈에서 깨지는 자리는 **둘**이다: 카드 문장(`headline`)이 두 줄로 갈라지는 것과, 카드를 한
 * 요소로 읽어 주는 `accessibilityLabel`에 낭독을 끊는 제어문자가 들어가는 것. 월간의 셋째 자리
 * (공유 문구가 한 줄 늘어나는 것)는 이 카드에 공유 버튼이 없어 **해당 없음**이다.
 *
 * 기대값은 전부 **리터럴**이다 — 조립기를 다시 불러 만든 값과 비교하지 않는다.
 */
describe("라운드 108 — 분기·연간 문장의 분류 이름 개행 가드", () => {
  /**
   * 조립기가 받을 수 있는 이름. ⚠️ 두 시점 — 종전 이 줄은 *"어드민 경로로 저장될 수 있는 이름"*
   * 이라고 적었고 그때는 참이었다. 오늘 그 유입은 400으로 막힌다(위 머리말 라운드 109) — 그래도
   * 이 값이 남는 이유는 조립기가 **순수 함수**여서 호출부가 무엇을 넘기든 문장이 한 줄이어야
   * 하기 때문이고, 손질을 지나지 않는 세 경로(옛 캐시 · 로컬 대역 · 가구 커스텀)가 아직 남기
   * 때문이다. 내부 개행은 `trim`으로 사라지지 않는다.
   */
  const 깨진분해 = [
    { label: "기저귀\n위생", amountKrw: 840_000, categoryId: "cat-diaper" },
    { label: "수유/이유식", amountKrw: 620_000, categoryId: "cat-feed" },
    { label: "의류", amountKrw: 340_000, categoryId: "cat-cloth" }
  ];

  it("① 이름 안의 개행을 한 칸 공백으로 접어 문장을 한 줄로 유지한다", () => {
    const insight = buildPeriodInsight({
      unit: "quarter",
      periodLabel: "2026년 3분기",
      totalExpenseKrw: 1_800_000,
      segments: 깨진분해
    });

    expect(insight!.headline).toBe("2026년 3분기에는 기저귀 위생에 가장 많이 썼어요 (840,000원 · 전체의 47%)");
    expect(insight!.headline).not.toContain("\n");
    // 검산값도 문장이 실제로 말한 그 이름이다(원본을 내면 이 필드의 뜻이 거짓이 된다).
    expect(insight!.topCategoryLabel).toBe("기저귀 위생");
  });

  it("② 낭독 라벨에도 제어문자가 남지 않는다", () => {
    const insight = buildPeriodInsight({
      unit: "year",
      periodLabel: "2026년",
      totalExpenseKrw: 1_800_000,
      segments: 깨진분해
    });

    expect(insight!.accessibilityLabel).toBe("2026년에는 기저귀 위생에 가장 많이 썼어요 (840,000원 · 전체의 47%)");
    expect(insight!.accessibilityLabel).not.toContain("\n");
    expect(insight!.sentences).toEqual(["2026년에는 기저귀 위생에 가장 많이 썼어요 (840,000원 · 전체의 47%)"]);
  });

  it("캐리지 리턴·탭·수직 탭·줄 구분자(U+2028/2029)·연속 공백도 같은 규칙으로 한 칸이 된다", () => {
    const insight = buildPeriodInsight({
      unit: "quarter",
      periodLabel: "2026년 3분기",
      totalExpenseKrw: 840_000,
      // 탭·CR·LF·수직 탭·U+2028(줄 구분자)·U+2029(문단 구분자)·NBSP·연속 공백을 한꺼번에 섞는다.
      // 전부 JS `\s`가 잡는 부류다(오늘 실측) — 접고 나면 한 칸 공백 하나만 남아야 한다.
      segments: [{ label: "  기저귀\r\n\t\v \u2028\u2029\u00a0위생  ", amountKrw: 840_000 }]
    });

    expect(insight!.headline).toBe("2026년 3분기에는 기저귀 위생에 가장 많이 썼어요 (840,000원 · 전체의 100%)");
  });

  it("금액 무접촉 — 이름이 깨진 조각도 떨어뜨리지 않아 '전체'의 분모가 그대로다", () => {
    // 세 조각 전부 이름이 깨져도 분모는 840,000+620,000+340,000 = 1,800,000 그대로이고,
    // 1위는 840,000 / 1,800,000 = 46.67% → 47%(최대잔여법)다. 조각을 하나라도 떨어뜨리면
    // 이 퍼센트가 달라진다 = 숫자가 거짓이 된다.
    const insight = buildPeriodInsight({
      unit: "quarter",
      periodLabel: "2026년 3분기",
      totalExpenseKrw: 1_800_000,
      segments: [
        { label: "기저귀\n위생", amountKrw: 840_000 },
        { label: "\n\n", amountKrw: 620_000 },
        { label: "의류\t세탁", amountKrw: 340_000 }
      ]
    });

    expect(insight!.headline).toBe("2026년 3분기에는 기저귀 위생에 가장 많이 썼어요 (840,000원 · 전체의 47%)");
    expect(insight!.topCategoryPercentLabel).toBe("47%");
  });

  it("1위 이름이 접고 나서 비면 카드가 없다(근거 없는 문장 금지 — 문장이 하나뿐이라 카드 미렌더)", () => {
    for (const label of ["   \n\t  ", "", "\r\n", "  "]) {
      expect(
        buildPeriodInsight({
          unit: "quarter",
          periodLabel: "2026년 3분기",
          totalExpenseKrw: 840_000,
          segments: [{ label, amountKrw: 840_000 }]
        })
      ).toBeNull();
    }
  });

  it("1위가 아닌 조각의 이름이 비어도 문장은 선다(가드는 지목한 이름에만 건다)", () => {
    const insight = buildPeriodInsight({
      unit: "year",
      periodLabel: "2026년",
      totalExpenseKrw: 1_000_000,
      segments: [
        { label: "기저귀/위생", amountKrw: 900_000 },
        { label: "  \n  ", amountKrw: 100_000 }
      ]
    });

    expect(insight!.headline).toBe("2026년에는 기저귀/위생에 가장 많이 썼어요 (900,000원 · 전체의 90%)");
  });

  it("정상 이름의 바이트는 한 글자도 바뀌지 않는다(DNC-018·DNC-020 무접촉)", () => {
    for (const [label, expected] of [
      ["기저귀/위생", "2026년 3분기에는 기저귀/위생에 가장 많이 썼어요 (840,000원 · 전체의 100%)"],
      ["분유 · 이유식", "2026년 3분기에는 분유 · 이유식에 가장 많이 썼어요 (840,000원 · 전체의 100%)"],
      ["산후도우미", "2026년 3분기에는 산후도우미에 가장 많이 썼어요 (840,000원 · 전체의 100%)"]
    ]) {
      const insight = buildPeriodInsight({
        unit: "quarter",
        periodLabel: "2026년 3분기",
        totalExpenseKrw: 840_000,
        segments: [{ label, amountKrw: 840_000 }]
      });
      expect(insight!.headline).toBe(expected);
    }
  });

  /**
   * 형제 경로가 **같은 규칙 한 벌**을 쓰는지 값으로 고정한다. 월간 헬퍼는 export 되어 있지 않고,
   * 이 모듈은 `monthly-insight` import 자체가 금지돼 있어(위 "월간 문장의 단일 소스" 테스트)
   * 규칙만 같은 한 벌을 각자 둔다 — 두 자리가 갈리면 같은 이름이 월간과 분기에서 다르게 읽힌다.
   */
  it("접기 규칙이 월간·커스텀 분류 정규화와 글자 그대로 같다", () => {
    const moduleSource = source("src/reports/period-insight.ts");
    expect(moduleSource).toContain('rawLabel.trim().replace(/\\s+/gu, " ")');
    // 앱 소스에 새 export const를 더하지 않는다(이 폴더의 관례).
    expect(moduleSource.match(/export const /g) ?? []).toHaveLength(2);
  });
});
