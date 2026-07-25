import { describe, expect, it } from "vitest";
import { isLikelyBlankOrShell } from "../../../scripts/pixel-lock/render-validation";

describe("Android Pixel Lock sparse-screen validation", () => {
  it("rejects a genuinely blank capture even if stale UI evidence exists", () => {
    expect(isLikelyBlankOrShell({ whitePixelRatio: 0.995, uniqueColorCount: 12, nonBackgroundAreaRatio: 0.006 }, true)).toBe(true);
  });

  it("rejects a sparse shell without the requested screen sentinel", () => {
    expect(isLikelyBlankOrShell({ whitePixelRatio: 0.912, uniqueColorCount: 894, nonBackgroundAreaRatio: 0.0875 })).toBe(true);
  });

  it("accepts a sparse white screen only when the requested screen sentinel is present", () => {
    expect(isLikelyBlankOrShell({ whitePixelRatio: 0.912, uniqueColorCount: 894, nonBackgroundAreaRatio: 0.0875 }, true)).toBe(false);
  });
});
