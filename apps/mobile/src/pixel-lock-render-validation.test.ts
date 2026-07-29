import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isEvidenceCurrentForScreenshot,
  isLikelyBlankOrShell
} from "../../../scripts/pixel-lock/render-validation";

describe("Android Pixel Lock sparse-screen validation", () => {
  it("rejects UI evidence captured before the screenshot it claims to validate", () => {
    expect(isEvidenceCurrentForScreenshot(2000, 1999)).toBe(false);
    expect(isEvidenceCurrentForScreenshot(2000, 2000)).toBe(true);
    expect(isEvidenceCurrentForScreenshot(2000, 2001)).toBe(true);
  });

  it("waits for the requested screen and validates fresh evidence in capture-only mode", () => {
    const source = readFileSync(resolve(__dirname, "../../../scripts/pixel-lock/android-pixel-lock.ts"), "utf8");
    const captureBranch = source.slice(source.indexOf('if (command === "capture")'), source.indexOf('if (command === "diff")'));

    expect(captureBranch).toContain("waitForScreenReady(screenId)");
    expect(captureBranch).toContain("captureStableScreen(screenId)");
    expect(captureBranch).toContain("validateRender(screenId, screenshotPath, true)");
  });

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
