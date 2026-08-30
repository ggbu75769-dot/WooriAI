import { describe, expect, it } from "vitest";
import { formatKrw } from "../money";
import { buildPeriodTrendPoints } from "./period-trend-points";
import { buildTrendPointLabels, EMPTY_TREND_POINT_LABELS } from "./trend-point-labels";

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
