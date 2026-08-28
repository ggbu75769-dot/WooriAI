import { describe, expect, it } from "vitest";
import {
  buildPeriodTrendPoints,
  PERIOD_TREND_EMPTY_NOTICE,
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
    // 실데이터 선을 그릴 수 있으면 차트 자리를 대체하지 않는다.
    expect(result.chartNotice).toBeNull();
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
    // QA P3-7: 기간 라벨은 남되 **자기 설명적**이어야 한다 -- 예전에는 "1~12월"이 아무 서술
    // 없이 홀로 떠 있어, 무엇을 말하는 값인지(차트 범위인지 필터인지) 알 수 없었다.
    expect(result.caption).toBe("1~12월 전체");
    expect(result.accessibilityLabel).toBe("1~12월 전체");
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
    expect(finished.caption).toBe("4~6월 전체");
  });

  it("draws an honest empty chart instead of a decorative line when fewer than two months have passed", () => {
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
    // QA P2-3: 사실은 차트 **자리**가 말한다 -- 장식선을 그려 놓고 아래 줄에서 해명하지 않는다.
    expect(result.chartNotice).toBe(PERIOD_TREND_EMPTY_NOTICE);
    expect(PERIOD_TREND_EMPTY_NOTICE).toBe("기록이 두 달 이상 쌓이면 추이를 보여드려요");
    // 캡션에는 어느 달까지인지만 남는다(같은 사실을 두 번 말하지 않는다).
    expect(result.caption).toBe("1월 기준");
    expect(result.accessibilityLabel).toBe("1월 기준");
  });

  it("changes nothing while the data has not arrived (loading / error / no session)", () => {
    for (const points of [undefined, null, []]) {
      const result = buildPeriodTrendPoints({ startYearMonth: "2026-01", points, todayIso: "2026-08-27" });
      expect(result.points).toBeUndefined();
      expect(result.caption).toBeNull();
      expect(result.accessibilityLabel).toBeNull();
      expect(result.rendersRealData).toBe(false);
      // 아직 데이터가 없는 동안에는 차트 자리도 종전 그대로다(로딩 중에 빈 상태를 띄우지 않는다).
      expect(result.chartNotice).toBeNull();
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
    // 지나간 달이 하나도 없는 기간은 이유가 달라 문구도 다르다.
    expect(result.chartNotice).toBe(PERIOD_TREND_FUTURE_NOTE);
    expect(result.caption).toBeNull();
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
