import { describe, expect, it } from "vitest";
import { canGoToNextPeriod, periodLabelForOffset } from "./period-navigation";

// A11Y-117 — 기간 이동 순수 로직 (미래 상한 판정 + announce용 기간 라벨).

describe("canGoToNextPeriod (future cap)", () => {
  it("blocks moving past the current period (offset 0)", () => {
    expect(canGoToNextPeriod(0)).toBe(false);
  });

  it("blocks any accidental future offset too", () => {
    expect(canGoToNextPeriod(1)).toBe(false);
    expect(canGoToNextPeriod(12)).toBe(false);
  });

  it("allows moving forward from any past period", () => {
    expect(canGoToNextPeriod(-1)).toBe(true);
    expect(canGoToNextPeriod(-24)).toBe(true);
  });
});

describe("periodLabelForOffset", () => {
  const base = new Date(2026, 7, 21); // 2026-08-21 (3분기)

  it("formats month labels like the records/reports screens", () => {
    expect(periodLabelForOffset(base, "month", 0)).toBe("2026년 8월");
    expect(periodLabelForOffset(base, "month", -1)).toBe("2026년 7월");
  });

  it("rolls month labels across year boundaries", () => {
    expect(periodLabelForOffset(base, "month", -8)).toBe("2025년 12월");
    expect(periodLabelForOffset(new Date(2026, 0, 15), "month", -1)).toBe("2025년 12월");
  });

  it("formats quarter labels from the base date's quarter", () => {
    expect(periodLabelForOffset(base, "quarter", 0)).toBe("2026년 3분기");
    expect(periodLabelForOffset(base, "quarter", -1)).toBe("2026년 2분기");
  });

  it("rolls quarter labels across year boundaries", () => {
    expect(periodLabelForOffset(base, "quarter", -3)).toBe("2025년 4분기");
    expect(periodLabelForOffset(new Date(2026, 1, 1), "quarter", -1)).toBe("2025년 4분기");
  });

  it("formats year labels", () => {
    expect(periodLabelForOffset(base, "year", 0)).toBe("2026년");
    expect(periodLabelForOffset(base, "year", -2)).toBe("2024년");
  });
});
