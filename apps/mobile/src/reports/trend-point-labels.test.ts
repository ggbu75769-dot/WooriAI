import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatKrw } from "../money";
import { buildPeriodTrendPoints } from "./period-trend-points";
import { buildTrendPointLabels, EMPTY_TREND_POINT_LABELS } from "./trend-point-labels";

/** 화면·공용 카드는 vitest에서 렌더할 수 없다(react-native 네이티브 바인딩 없음) — 소스로 읽는다. */
const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * 라운드 85 트랙 C — 추이 차트가 어느 달의 얼마인지 말한다.
 *
 * 계약: ⓐ 라벨은 응답의 `yearMonth`에서만 나오고 수가 어긋나면 그리지 않는다 · ⓑ 월간·분기·
 * 연간 세 갈래가 같은 모듈을 지나고 자른 기간에서도 라벨과 점이 어긋나지 않는다 · ⓒ 낭독에
 * 각 점의 달과 값이 들어간다 · ⓔ 금액은 `formatKrw` 하나로만 만든다.
 */
describe("buildTrendPointLabels ⓐ 파생", () => {
  it("응답의 yearMonth에서만 달 라벨을 만든다", () => {
    const result = buildTrendPointLabels({
      yearMonths: ["2026-03", "2026-04", "2026-05"],
      points: [120_000, 98_000, 143_500]
    });

    expect(result.labels).toEqual(["3월", "4월", "5월"]);
  });

  it("해가 바뀌어도 그 달의 번호를 그대로 읽는다 (연 경계에서 인덱스로 세지 않는다)", () => {
    const result = buildTrendPointLabels({
      yearMonths: ["2025-11", "2025-12", "2026-01", "2026-02"],
      points: [10, 20, 30, 40]
    });

    expect(result.labels).toEqual(["11월", "12월", "1월", "2월"]);
  });

  it("라벨 수와 점 수가 다르면 축을 그리지 않는다 (지어내지 않는다)", () => {
    const tooManyMonths = buildTrendPointLabels({
      yearMonths: ["2026-01", "2026-02", "2026-03"],
      points: [10, 20]
    });
    const tooFewMonths = buildTrendPointLabels({
      yearMonths: ["2026-01"],
      points: [10, 20]
    });

    expect(tooManyMonths).toEqual(EMPTY_TREND_POINT_LABELS);
    expect(tooFewMonths).toEqual(EMPTY_TREND_POINT_LABELS);
  });

  it("형식이 어긋난 달이 하나라도 있으면 축 전체를 포기한다 (반쯤 지어낸 축을 만들지 않는다)", () => {
    for (const broken of ["2026-13", "2026-00", "26-03", "2026-3", "", "2026-03-01"]) {
      const result = buildTrendPointLabels({
        yearMonths: ["2026-01", broken, "2026-03"],
        points: [10, 20, 30]
      });

      expect(result, `깨진 달을 그냥 지나쳤다: ${broken}`).toEqual(EMPTY_TREND_POINT_LABELS);
    }
  });

  it("입력이 아직 없으면(로딩·실패·비세션) 두 값 모두 null이다", () => {
    expect(buildTrendPointLabels({ yearMonths: undefined, points: [10, 20] })).toEqual(EMPTY_TREND_POINT_LABELS);
    expect(buildTrendPointLabels({ yearMonths: ["2026-01", "2026-02"], points: undefined })).toEqual(
      EMPTY_TREND_POINT_LABELS
    );
    expect(buildTrendPointLabels({ yearMonths: null, points: null })).toEqual(EMPTY_TREND_POINT_LABELS);
    expect(buildTrendPointLabels({ yearMonths: [], points: [] })).toEqual(EMPTY_TREND_POINT_LABELS);
  });
});

describe("buildTrendPointLabels ⓒ 낭독", () => {
  it("각 점의 달과 값을 순서대로 읽는다", () => {
    const result = buildTrendPointLabels({
      yearMonths: ["2026-06", "2026-07", "2026-08"],
      points: [120_000, 0, 143_500]
    });

    expect(result.accessibilitySeries).toBe("6월 120,000원, 7월 0원, 8월 143,500원");
  });

  it("델타·평가·예측을 스스로 만들어 붙이지 않는다", () => {
    const result = buildTrendPointLabels({
      yearMonths: ["2026-07", "2026-08"],
      points: [100_000, 200_000]
    });

    expect(result.accessibilitySeries).toBe("7월 100,000원, 8월 200,000원");
    for (const forbidden of ["%", "대비", "늘", "줄", "절약", "예상"]) {
      expect(result.accessibilitySeries, `계열이 판단을 말한다: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("축을 그리지 않는 입력에서는 낭독 계열도 만들지 않는다 (보이는 것과 읽히는 것이 갈리지 않는다)", () => {
    const mismatched = buildTrendPointLabels({ yearMonths: ["2026-01"], points: [10, 20] });

    expect(mismatched.labels).toBeNull();
    expect(mismatched.accessibilitySeries).toBeNull();
  });
});

describe("buildTrendPointLabels ⓔ 표기", () => {
  it("금액은 formatKrw 하나로만 만든다 (새 표기 규칙 0건)", () => {
    const amounts = [0, 1_234, 1_234_567, -500, Number.NaN];
    const result = buildTrendPointLabels({
      yearMonths: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"],
      points: amounts
    });

    expect(result.accessibilitySeries).toBe(
      amounts.map((amount, index) => `${index + 1}월 ${formatKrw(amount)}`).join(", ")
    );
    // ₩ 기호도, 그룹 없는 숫자도 나오지 않는다(D0 규칙은 money.ts 하나가 진다).
    expect(result.accessibilitySeries).toContain("1,234,567원");
    expect(result.accessibilitySeries).not.toContain("₩");
  });
});

describe("buildTrendPointLabels ⓑ 세 갈래 한 모듈", () => {
  it("월간 탭: 선택한 달로 끝나는 6개월이 그대로 여섯 라벨이 된다", () => {
    const months = [
      { yearMonth: "2026-03", totalExpenseKrw: 810_000 },
      { yearMonth: "2026-04", totalExpenseKrw: 742_000 },
      { yearMonth: "2026-05", totalExpenseKrw: 903_000 },
      { yearMonth: "2026-06", totalExpenseKrw: 655_000 },
      { yearMonth: "2026-07", totalExpenseKrw: 712_000 },
      { yearMonth: "2026-08", totalExpenseKrw: 480_000 }
    ];

    const result = buildTrendPointLabels({
      yearMonths: months.map((month) => month.yearMonth),
      points: months.map((month) => month.totalExpenseKrw)
    });

    expect(result.labels).toEqual(["3월", "4월", "5월", "6월", "7월", "8월"]);
    expect(result.accessibilitySeries).toBe(
      "3월 810,000원, 4월 742,000원, 5월 903,000원, 6월 655,000원, 7월 712,000원, 8월 480,000원"
    );
  });

  /**
   * ⓑ 자른 기간의 정합 — 라운드 52 C-02는 **아직 오지 않은 달**을 잘라 낸다
   * (src/reports/period-trend-points.ts). 화면은 그 모듈이 센 `elapsedMonths`만큼 달 목록도
   * 함께 자르므로, 잘라 낸 뒤에도 라벨과 점이 1:1이다 — 잘려 나간 달에는 라벨도 없다.
   */
  it("연간 탭(진행 중): 잘라 낸 점과 라벨이 어긋나지 않고, 미래 달에는 라벨도 없다", () => {
    const monthlyTotals = Array.from({ length: 12 }, (_, index) => ({
      yearMonth: `2026-${String(index + 1).padStart(2, "0")}`,
      totalExpenseKrw: index < 8 ? (index + 1) * 100_000 : 0
    }));

    const periodTrend = buildPeriodTrendPoints({
      startYearMonth: "2026-01",
      points: monthlyTotals.map((entry) => entry.totalExpenseKrw),
      todayIso: "2026-08-30"
    });
    expect(periodTrend.elapsedMonths).toBe(8);

    const result = buildTrendPointLabels({
      yearMonths: monthlyTotals.slice(0, periodTrend.elapsedMonths).map((entry) => entry.yearMonth),
      points: periodTrend.points
    });

    expect(result.labels).toEqual(["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월"]);
    expect(result.labels).toHaveLength(periodTrend.points!.length);
    expect(result.accessibilitySeries).toContain("8월 800,000원");
    for (const futureMonth of ["9월", "10월", "11월", "12월"]) {
      expect(result.accessibilitySeries, `잘라 낸 달이 낭독에 남았다: ${futureMonth}`).not.toContain(futureMonth);
    }
  });

  it("연간 탭(끝난 해): 열두 달 전부가 라벨을 받는다 (그때의 0원은 전부 사실이다)", () => {
    const monthlyTotals = Array.from({ length: 12 }, (_, index) => ({
      yearMonth: `2025-${String(index + 1).padStart(2, "0")}`,
      totalExpenseKrw: index === 4 ? 0 : 200_000
    }));

    const periodTrend = buildPeriodTrendPoints({
      startYearMonth: "2025-01",
      points: monthlyTotals.map((entry) => entry.totalExpenseKrw),
      todayIso: "2026-08-30"
    });
    expect(periodTrend.truncated).toBe(false);

    const result = buildTrendPointLabels({
      yearMonths: monthlyTotals.slice(0, periodTrend.elapsedMonths).map((entry) => entry.yearMonth),
      points: periodTrend.points
    });

    expect(result.labels).toHaveLength(12);
    expect(result.labels?.[11]).toBe("12월");
    expect(result.accessibilitySeries).toContain("5월 0원");
  });

  it("분기 탭(진행 중): 지나간 두 달만 라벨을 받는다", () => {
    const months = [
      { yearMonth: "2026-07", totalExpenseKrw: 300_000 },
      { yearMonth: "2026-08", totalExpenseKrw: 250_000 },
      { yearMonth: "2026-09", totalExpenseKrw: 0 }
    ];

    const periodTrend = buildPeriodTrendPoints({
      startYearMonth: "2026-07",
      points: months.map((month) => month.totalExpenseKrw),
      todayIso: "2026-08-30"
    });

    const result = buildTrendPointLabels({
      yearMonths: months.slice(0, periodTrend.elapsedMonths).map((month) => month.yearMonth),
      points: periodTrend.points
    });

    expect(result.labels).toEqual(["7월", "8월"]);
    expect(result.accessibilitySeries).toBe("7월 300,000원, 8월 250,000원");
  });

  /**
   * ⓓ 부정 — 점이 2개 미만이면 화면은 카드에 점을 아예 넘기지 않는다(라운드 52 QA P2-3의
   * `chartNotice` 갈래). 그 조건과 같은 입력에서는 라벨도 만들어지지 않아야, 선 없는 빈 상태
   * 자리에 축만 남는 일이 생기지 않는다.
   */
  it("차트가 빈 상태로 접히는 기간에는 축도 만들어지지 않는다", () => {
    const months = [{ yearMonth: "2026-01", totalExpenseKrw: 120_000 }];
    const periodTrend = buildPeriodTrendPoints({
      startYearMonth: "2026-01",
      points: months.map((month) => month.totalExpenseKrw),
      todayIso: "2026-01-15"
    });
    expect(periodTrend.rendersRealData).toBe(false);
    expect(periodTrend.chartNotice).not.toBeNull();

    // 화면은 chartNotice가 있으면 점을 넘기지 않는다 — 라벨 조립도 같은 조건으로 비운다.
    const result = buildTrendPointLabels({
      yearMonths: months.slice(0, periodTrend.elapsedMonths).map((month) => month.yearMonth),
      points: periodTrend.chartNotice ? undefined : periodTrend.points
    });

    expect(result).toEqual(EMPTY_TREND_POINT_LABELS);
  });
});

/**
 * 라운드 85 리뷰 L-11 — **배선의 소스 계약이 0건이었다.**
 *
 * 위 단언들은 순수 모듈이 *무엇을 받으면 무엇을 내놓는가*만 물었고, 화면이 실제로 그 값을
 * 만들어 넘기는지는 아무도 세지 않았다. 그래서 `activeYearMonths`가 사라지거나
 * `slice(0, elapsedMonths)`가 빠지거나 `pointLabels` 프롭이 끊겨도 이 파일은 초록이었다 —
 * 그때 화면에서는 축이 조용히 없어지거나(끊긴 프롭), **잘라 내지 않은 열두 달이 여덟 점 위에
 * 실릴** 뻔한 자리가 열린다(조립기가 수를 세어 막지만, 그 방어가 마지막 문이어서는 안 된다).
 */
describe("리포트 탭 배선 (라운드 85 트랙 C · 리뷰 L-11)", () => {
  const reports = () => source("app/(tabs)/reports.tsx");

  it("세 갈래가 한 배열(activeYearMonths)로 모이고, 자른 기간은 elapsedMonths로 함께 잘린다", () => {
    const reportsSource = reports();
    expect(reportsSource).toContain("const activeYearMonths =");
    // 월간은 자르지 않는다(getTrendReport는 언제나 6개월을 준다) · 분기·연간만 C-02가 자른 만큼.
    expect(reportsSource).toContain('period === "월간"\n      ? monthlyTrendYearMonths');
    expect(reportsSource).toContain(
      ': (period === "분기" ? quarterYearMonths : yearlyYearMonths)?.slice(0, periodTrend.elapsedMonths);'
    );
  });

  it("조립기가 그 배열과 **차트가 실제로 그리는 점**을 같은 조건으로 받는다", () => {
    const reportsSource = reports();
    expect(reportsSource).toContain("const trendPointLabels = buildTrendPointLabels({");
    expect(reportsSource).toContain("yearMonths: activeYearMonths,");
    // 점을 넘기지 않는 빈 상태에서는 라벨도 만들지 않는다 — 아래 points 프롭과 **같은 식**이다.
    expect(reportsSource).toContain("points: trendChartNotice ? undefined : activePoints");
    expect(reportsSource).toContain("points={trendChartNotice ? undefined : activePoints}");
  });

  it("만든 값이 카드까지 간다(프롭이 끊기면 축도 낭독 계열도 조용히 사라진다)", () => {
    const reportsSource = reports();
    expect(reportsSource).toContain("pointLabels={trendPointLabels}");
    // 조립기도 프롭도 한 자리뿐이다 — 화면이 두 번째 라벨 조립기를 두면 축이 카드마다 갈린다.
    expect(reportsSource.match(/buildTrendPointLabels\(\{/g) ?? []).toHaveLength(1);
    expect(reportsSource.match(/pointLabels=\{/g) ?? []).toHaveLength(1);
    // 비세션 미리보기의 LineChartCard는 이 프롭에 닿지 않는다(REP-001 픽셀락).
    expect(reportsSource.match(/<LineChartCard/g) ?? []).toHaveLength(2);
  });
});

/**
 * 라운드 85 리뷰 M-2 — **축 라벨의 글자·배율·수축.**
 *
 * `records-calendar.test.ts`의 L9 계약("앱 최소 글자 9px을 10px로 올린다 — 새 최소치를 만들지
 * 않는다")은 `RecordsCalendar.tsx` **한 파일만** 읽는다. 그래서 같은 앱의 다른 파일이 9px을
 * 다시 들여와도 그 계약은 초록이었고, 실제로 이 축이 그렇게 들어왔다. 부정 단언을 축이 사는
 * 파일에도 건다.
 */
describe("추이 차트 축 라벨의 글자 (라운드 85 리뷰 M-2)", () => {
  const ui = () => source("src/ui.tsx");
  const axisStyleBlock = () => {
    const uiSource = ui();
    const start = uiSource.indexOf("const lineChartAxisLabelStyle");
    expect(start, "축 라벨 스타일 상수를 찾지 못했어요").toBeGreaterThan(-1);
    return uiSource.slice(start, uiSource.indexOf("const reportCategoryLegend"));
  };
  /** 축이 실제로 그려지는 JSX 한 덩어리(`{axisLabels ? (` … `) : null}`). */
  const axisRenderBlock = () => {
    const uiSource = ui();
    const start = uiSource.indexOf("{axisLabels ? (");
    expect(start, "축 렌더 갈래를 찾지 못했어요").toBeGreaterThan(-1);
    const end = uiSource.indexOf(") : null}", start);
    expect(end, "축 렌더 갈래가 닫히지 않았어요").toBeGreaterThan(start);
    return uiSource.slice(start, end);
  };

  it("9px을 되살리지 않는다 (L9의 부정 단언이 이 파일에도 선다)", () => {
    expect(axisStyleBlock()).toContain("fontSize: 10");
    expect(axisStyleBlock()).not.toContain("fontSize: 9");
    // 파일 전체에도 9px 글자가 0건이다 — 다음 사람이 옆자리에 다시 만들지 않게.
    expect(ui(), "src/ui.tsx에 9px 글자가 생겼어요 — 라운드 34 L9는 앱 최소치를 10px로 올렸어요").not.toContain(
      "fontSize: 9,"
    );
  });

  it("캘린더 칸과 같은 배율 상한을 쓰고, 그 값이 두 파일에서 같다", () => {
    expect(ui()).toContain("const CHART_AXIS_MAX_FONT_SCALE = 1.2;");
    expect(ui()).toContain("maxFontSizeMultiplier={CHART_AXIS_MAX_FONT_SCALE}");
    // 관례의 출처(라운드 34 M2) — 같은 기기에서 한쪽만 잘리지 않게 값이 같아야 한다.
    expect(source("src/expenses/RecordsCalendar.tsx")).toContain("const CALENDAR_CELL_MAX_FONT_SCALE = 1.2;");
  });

  it("열둘이 실려도 카드 밖으로 밀려나지 않는다(수축 허용 · 한 줄)", () => {
    expect(axisStyleBlock()).toContain("flexShrink: 1");
    const axisBlock = axisRenderBlock();
    expect(axisBlock).toContain("numberOfLines={1}");
    expect(axisBlock).toContain("style={lineChartAxisLabelStyle}");
  });

  /**
   * ⓐ 계약("라벨 수 = 점 수 아니면 포기")과 부딪히지 않는다 — 밀도 방어로 **칸을 비우거나
   * 건너뛰지 않는다.** 격단 표기는 남은 라벨을 자기 점에서 밀어내고(칸 너비가 배치를 정한다),
   * 낭독은 열둘을 그대로 읽어 보는 것과 듣는 것이 갈린다.
   */
  it("라벨을 건너뛰거나 비우지 않는다 — 열둘이면 열둘을 그린다", () => {
    const axisBlock = axisRenderBlock();
    expect(axisBlock).toContain("{axisLabels.map((label, index) => (");
    for (const skipping of ["index % 2", "filter(", 'label : ""', "slice("]) {
      expect(axisBlock, `축이 라벨을 골라 그리기 시작했어요: ${skipping}`).not.toContain(skipping);
    }
    // 카드는 여전히 수가 어긋나면 축 전체를 버린다(조립기와 같은 판정을 화면에서도 한 번 더).
    expect(ui()).toContain("pointLabels.labels.length === drawnPoints.length");

    // 가장 빽빽한 갈래(끝난 해의 연간)가 실제로 열두 라벨이라는 사실을 값으로 함께 센다.
    const yearly = buildTrendPointLabels({
      yearMonths: Array.from({ length: 12 }, (_, index) => `2025-${String(index + 1).padStart(2, "0")}`),
      points: Array.from({ length: 12 }, () => 100_000)
    });
    expect(yearly.labels).toHaveLength(12);
    expect(Math.max(...yearly.labels!.map((label) => label.length))).toBe(3);
  });
});
