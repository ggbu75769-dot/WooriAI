import { pixelNumber } from "../overrides";

export const SplashPixelStyles = {
  topOffset: pixelNumber("SPL-001", "topOffset", -22),
  groupScale: pixelNumber("SPL-001", "groupScale", 1.27),
  logoSize: pixelNumber("SPL-001", "logoSize", 64),
  logoGap: pixelNumber("SPL-001", "logoGap", 10),
  introImageHeight: pixelNumber("SPL-001", "introImageHeight", 320),
  introImageMarginTop: pixelNumber("SPL-001", "introImageMarginTop", 72),
  pagerGap: pixelNumber("SPL-001", "pagerGap", 6)
} as const;
