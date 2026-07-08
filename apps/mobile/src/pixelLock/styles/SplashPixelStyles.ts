import { pixelNumber } from "../overrides";

export const SplashPixelStyles = {
  get topOffset() {
    return pixelNumber("SPL-001", "topOffset", -40);
  },
  get groupScale() {
    return pixelNumber("SPL-001", "groupScale", 1);
  },
  get logoSize() {
    return pixelNumber("SPL-001", "logoSize", 64);
  },
  get logoGap() {
    return pixelNumber("SPL-001", "logoGap", 10);
  },
  get titleFontSize() {
    return pixelNumber("SPL-001", "titleFontSize", 25);
  },
  get taglineFontSize() {
    return pixelNumber("SPL-001", "taglineFontSize", 14);
  },
  get taglineLineHeight() {
    return pixelNumber("SPL-001", "taglineLineHeight", 21);
  },
  get taglineMaxWidth() {
    return pixelNumber("SPL-001", "taglineMaxWidth", 230);
  },
  get introImageHeight() {
    return pixelNumber("SPL-001", "introImageHeight", 380);
  },
  get introImageMarginTop() {
    return pixelNumber("SPL-001", "introImageMarginTop", 56);
  },
  get pagerGap() {
    return pixelNumber("SPL-001", "pagerGap", 6);
  }
} as const;
