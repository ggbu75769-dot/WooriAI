import { describe, expect, it } from "vitest";
import {
  buildPeriodTrendPoints,
  PERIOD_TREND_DECORATIVE_NOTE,
  PERIOD_TREND_FUTURE_NOTE,
  PERIOD_TREND_MIN_REAL_POINTS
} from "./period-trend-points";

/** 서버 연간 리포트가 실제로 내려주는 모양: 12개월 전부, 기록 없는 달은 0원. */
const yearWithDataThroughAugust = [
  120_000, 98_000, 143_000, 87_000, 210_000, 176_000, 132_000, 155_000, 0, 0, 0, 0
];

describe("C-02 buildPeriodTrendPoints", () => {
  it("cuts the not-yet-arrived months off the current year instead of drawing them as 0원", () => {
    const result = buildPeriodTrendPoints({
      startYearMonth: "2026-01",
      points: yearWithDataThroughAugust,
      todayIso: "2026-08-27"
    });

    expect(result.points).toEqual(yearWithDataThroughAugust.slice(0, 8));
    expect(result.monthCount).toBe(12);
    expect(result.elapsedMonths).toBe(8);
    expect(result.truncated).toBe(true);
    // 마지막 점이 0원 바닥이 아니라 8월의 실제 값이다 -- "연말에 지출이 끊겼다"는 그림이 사라진다.
    expect(result.points!.at(-1)).toBe(155_000);
  });

  it("says which months the chart is showing when it truncated", () => {
    const result = buildPeriodTrendPoints({
      startYearMonth: "2026-01",
      points: yearWithDataThroughAugust,
      todayIso: "2026-08-27"
    });

    expect(result.rangeLabel).toBe("1~8월");
    expect(result.caption).toBe("1~8월 기준");
    expect(result.accessibilityLabel).toBe("1~8월 기준");
    expect(result.rendersRealData).toBe(true);
  });

  it("leaves a finished year alone -- its 0원 months really were 0원", () => {
    const finishedYear = [10_000, 0, 0, 20_000, 0, 0, 0, 0, 0, 0, 0, 30_000];
    const result = buildPeriodTrendPoints({
      startYearMonth: "2025-01",
      points: finishedYear,
      todayIso: "2026-08-27"
    });

    expect(result.points).toEqual(finishedYear);
    expect(result.truncated).toBe(false);
    expect(result.elapsedMonths).toBe(12);
    // 기간 라벨은 남는다 -- 점 12개가 어느 달들인지 차트 아래에서 읽을 수 있어야 한다.
    expect(result.caption).toBe("1~12월");
  });

  it("truncates a quarter that is still running and keeps a finished quarter whole", () => {
    const running = buildPeriodTrendPoints({
      startYearMonth: "2026-07",
      points: [140_000, 96_000, 0],
      todayIso: "2026-08-03"
    });
    expect(running.points).toEqual([140_000, 96_000]);
    expect(running.caption).toBe("7~8월 기준");

    const finished = buildPeriodTrendPoints({
      startYearMonth: "2026-04",
      points: [140_000, 96_000, 0],
      todayIso: "2026-08-03"
    });
    expect(finished.points).toEqual([140_000, 96_000, 0]);
    expect(finished.truncated).toBe(false);
    expect(finished.caption).toBe("4~6월");
  });

  it("admits that the drawn line is decoration when fewer than two months have passed", () => {
    // 1월의 연간 탭: 점 하나만 남으므로 LineChartCard가 장식 좌표로 폴백한다(src/ui.tsx).
    const result = buildPeriodTrendPoints({
      startYearMonth: "2026-01",
      points: Array.from({ length: 12 }, () => 0).map((_, index) => (index === 0 ? 84_000 : 0)),
      todayIso: "2026-01-09"
    });

    expect(result.elapsedMonths).toBe(1);
    expect(result.points).toEqual([84_000]);
    expect(result.rendersRealData).toBe(false);
    expect(result.points!.length).toBeLessThan(PERIOD_TREND_MIN_REAL_POINTS);
    expect(result.caption).toBe(`1월 기준 · ${PERIOD_TREND_DECORATIVE_NOTE}`);
    // 소리로는 "·" 대신 쉼표.
    expect(result.accessibilityLabel).toBe(`1월 기준, ${PERIOD_TREND_DECORATIVE_NOTE}`);
  });

  it("changes nothing while the data has not arrived (loading / error / no session)", () => {
    for (const points of [undefined, null, []]) {
      const result = buildPeriodTrendPoints({ startYearMonth: "2026-01", points, todayIso: "2026-08-27" });
      expect(result.points).toBeUndefined();
      expect(result.caption).toBeNull();
      expect(result.accessibilityLabel).toBeNull();
      expect(result.rendersRealData).toBe(false);
    }
  });

  it("does not cut anything when the dates cannot be parsed", () => {
    const result = buildPeriodTrendPoints({
      startYearMonth: "2026-13",
      points: yearWithDataThroughAugust,
      todayIso: "2026-08-27"
    });
    expect(result.points).toEqual(yearWithDataThroughAugust);
    expect(result.truncated).toBe(false);
    expect(result.caption).toBeNull();

    const badToday = buildPeriodTrendPoints({
      startYearMonth: "2026-01",
      points: yearWithDataThroughAugust,
      todayIso: "오늘"
    });
    expect(badToday.points).toEqual(yearWithDataThroughAugust);
    expect(badToday.caption).toBeNull();
  });

  it("folds a wholly-future period to nothing and says so (defensive -- navigation blocks it)", () => {
    const result = buildPeriodTrendPoints({
      startYearMonth: "2027-01",
      points: yearWithDataThroughAugust,
      todayIso: "2026-08-27"
    });

    expect(result.points).toEqual([]);
    expect(result.elapsedMonths).toBe(0);
    expect(result.rangeLabel).toBeNull();
    expect(result.caption).toBe(PERIOD_TREND_FUTURE_NOTE);
    expect(result.rendersRealData).toBe(false);
  });

  it("keeps the current month itself in the window (it is in progress, not future)", () => {
    const result = buildPeriodTrendPoints({
      startYearMonth: "2026-08",
      points: [77_000, 0, 0],
      todayIso: "2026-08-01"
    });
    expect(result.points).toEqual([77_000]);
    expect(result.elapsedMonths).toBe(1);
  });
});
