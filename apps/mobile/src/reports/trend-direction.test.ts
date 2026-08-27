import { describe, expect, it } from "vitest";
import {
  evaluateTrendDirection,
  TREND_CAPTION_COMPLETE,
  TREND_CAPTION_IN_PROGRESS
} from "./trend-direction";

/** 추이 차트가 넘기는 값과 같은 모양: 오름차순 6개월, 마지막 원소가 선택한 달. */
const SIX_MONTHS = [180_000, 210_000, 190_000, 240_000, 263_000, 251_000];

describe("UX-F 추이 방향 표시", () => {
  it("compares the last two months of the chart and floors the percent", () => {
    const direction = evaluateTrendDirection({ points: SIX_MONTHS, monthStatus: "complete" });

    // 12,000 / 263,000 = 4.56% -> 내림 4% (표시값이 실제 변화보다 커지지 않는다).
    expect(direction).toMatchObject({
      kind: "down",
      arrow: "▼",
      percent: 4,
      valueText: "4%",
      differenceKrw: 12_000,
      captionText: TREND_CAPTION_COMPLETE
    });
    expect(direction?.accessibilityLabel).toBe("지난달 대비 4% 줄었어요.");
  });

  it("keeps an increase in a neutral tone and a decrease positive (죄책감 금지)", () => {
    expect(evaluateTrendDirection({ points: [200_000, 260_000], monthStatus: "complete" })).toMatchObject({
      kind: "up",
      arrow: "▲",
      percent: 30,
      tone: "neutral"
    });
    expect(evaluateTrendDirection({ points: [260_000, 200_000], monthStatus: "complete" })?.tone).toBe("positive");
  });

  /**
   * 진행 중인 달의 마지막 막대는 아직 자라는 중이라, 지난달 **전체**와의 비교는 "지금까지 vs
   * 한 달 전체"다. 캡션이 그 사실을 말하고, 감소에도 긍정 톤을 주지 않는다.
   */
  it("labels the in-progress month's comparison for what it is and withholds the positive tone", () => {
    const direction = evaluateTrendDirection({ points: SIX_MONTHS, monthStatus: "in-progress" });

    expect(direction?.captionText).toBe(TREND_CAPTION_IN_PROGRESS);
    expect(direction?.kind).toBe("down");
    expect(direction?.tone).toBe("neutral");
    expect(direction?.accessibilityLabel).toBe("지난달 전체 대비 지금까지 4% 줄었어요. 이번 달은 아직 진행 중이에요.");
  });

  it("falls back to the amount when a percent would be meaningless", () => {
    // 분모 0원: 비율을 만들 수 없다.
    expect(evaluateTrendDirection({ points: [0, 84_200], monthStatus: "complete" })).toMatchObject({
      kind: "up",
      percent: null,
      valueText: "84,200원"
    });
    // 내림 결과가 0%: "0% 늘었어요" 대신 금액으로 말한다.
    expect(evaluateTrendDirection({ points: [1_000_000, 1_005_000], monthStatus: "complete" })).toMatchObject({
      percent: null,
      valueText: "5,000원"
    });
  });

  it("says 변화 없음 when the two months are equal", () => {
    expect(evaluateTrendDirection({ points: [263_000, 263_000], monthStatus: "complete" })).toMatchObject({
      kind: "same",
      arrow: "―",
      valueText: "변화 없음",
      tone: "neutral",
      accessibilityLabel: "지난달과 지출이 같아요."
    });
  });

  it("renders nothing without two comparable months", () => {
    expect(evaluateTrendDirection({ points: undefined, monthStatus: "complete" })).toBeNull();
    expect(evaluateTrendDirection({ points: [263_000], monthStatus: "complete" })).toBeNull();
    // 두 달 다 0원이면 방향이랄 것이 없다.
    expect(evaluateTrendDirection({ points: [0, 0], monthStatus: "complete" })).toBeNull();
    expect(evaluateTrendDirection({ points: [Number.NaN, 10_000], monthStatus: "complete" })).toBeNull();
    expect(evaluateTrendDirection({ points: [10_000, -5], monthStatus: "complete" })).toBeNull();
    // 아직 오지 않은 달·판정 불가는 아무것도 말하지 않는다.
    expect(evaluateTrendDirection({ points: SIX_MONTHS, monthStatus: "future" })).toBeNull();
    expect(evaluateTrendDirection({ points: SIX_MONTHS, monthStatus: null })).toBeNull();
  });

  it("stays free of react-native imports so it can be unit tested (helper convention)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const helperSource = readFileSync(join(process.cwd(), "src/reports/trend-direction.ts"), "utf8");

    expect(helperSource).not.toContain("react-native");
    // 금액 문자열은 앱 전역 포매터에서만 나온다.
    expect(helperSource).toContain('import { formatKrw } from "../money"');
  });
});
