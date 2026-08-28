import { describe, expect, it } from "vitest";
import { adaptiveTabBarHeight, compactGridColumnCount, compactGridItemWidth, usesLargeTextLayout } from "./responsive";

describe("large-text responsive layout", () => {
  it("reduces compact phone grids to two columns at the accessibility threshold", () => {
    expect(usesLargeTextLayout(1.49)).toBe(false);
    expect(usesLargeTextLayout(1.5)).toBe(true);
    expect(compactGridColumnCount(393, 1)).toBe(3);
    expect(compactGridColumnCount(393, 2)).toBe(2);
    expect(compactGridItemWidth(2)).toBe("48.4%");
  });

  it("retains four columns only when a large-text layout has enough width", () => {
    expect(compactGridColumnCount(800, 1)).toBe(4);
    expect(compactGridColumnCount(800, 2)).toBe(2);
    expect(compactGridColumnCount(900, 2)).toBe(4);
    expect(compactGridItemWidth(4)).toBe("23.4%");
  });

  it("grows the ordinary bottom tab bar instead of clipping scaled labels", () => {
    expect(adaptiveTabBarHeight(64, 1)).toBe(64);
    expect(adaptiveTabBarHeight(64, 1.5)).toBe(76);
    expect(adaptiveTabBarHeight(64, 2)).toBe(88);
    expect(adaptiveTabBarHeight(64, 3)).toBe(88);
  });
});
