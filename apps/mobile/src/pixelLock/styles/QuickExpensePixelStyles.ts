import { pixelNumber } from "../overrides";

export const QuickExpensePixelStyles = {
  get horizontalOffset() {
    return pixelNumber("EXP-001", "horizontalOffset", 0);
  },
  get topOffset() {
    return pixelNumber("EXP-001", "topOffset", -40);
  },
  get scale() {
    return pixelNumber("EXP-001", "scale", 0.84);
  },
  get screenPadding() {
    return pixelNumber("EXP-001", "screenPadding", 24);
  },
  get chipHeight() {
    return pixelNumber("EXP-001", "chipHeight", 0);
  },
  get chipGap() {
    return pixelNumber("EXP-001", "chipGap", 0);
  },
  get inputCardHeight() {
    return pixelNumber("EXP-001", "inputCardHeight", 0);
  },
  get ctaHeight() {
    return pixelNumber("EXP-001", "ctaHeight", 56);
  },
  get ctaBottomInset() {
    return pixelNumber("EXP-001", "ctaBottomInset", 0);
  }
} as const;
