import { describe, expect, it } from "vitest";
import { resolvePixelLockHref } from "./deep-link";

describe("Pixel Lock Android deep links", () => {
  it("routes an allowlisted host-form screen URL into the Expo Router path", () => {
    expect(resolvePixelLockHref("wooriai://pixel-lock?screen=SPL-001")).toBe(
      "/pixel-lock?screen=SPL-001"
    );
    expect(resolvePixelLockHref("wooriai://pixel-lock?screen=EXP-001")).toBe(
      "/pixel-lock?screen=EXP-001"
    );
    expect(resolvePixelLockHref("wooriai:///pixel-lock?screen=SET-001")).toBe(
      "/pixel-lock?screen=SET-001"
    );
  });

  it("preserves encoded style overrides without accepting another route", () => {
    const overrides = encodeURIComponent(JSON.stringify({ "SPL-001": { logoTop: 12 } }));
    expect(resolvePixelLockHref(`wooriai://pixel-lock?screen=SPL-001&overrides=${overrides}`)).toBe(
      `/pixel-lock?screen=SPL-001&overrides=${overrides}`
    );
  });

  it("rejects unknown screens and non-Pixel app links", () => {
    expect(resolvePixelLockHref("wooriai://pixel-lock?screen=UNKNOWN")).toBeNull();
    expect(resolvePixelLockHref("wooriai://oauth/kakao?code=secret")).toBeNull();
    expect(resolvePixelLockHref("https://example.com/pixel-lock?screen=SPL-001")).toBeNull();
  });
});
