import { pixelNumber } from "../overrides";

export const QuickExpensePixelStyles = {
  topOffset: pixelNumber("EXP-001", "topOffset", 11),
  screenPadding: pixelNumber("EXP-001", "screenPadding", 24),
  chipHeight: pixelNumber("EXP-001", "chipHeight", 0),
  chipGap: pixelNumber("EXP-001", "chipGap", 0),
  inputCardHeight: pixelNumber("EXP-001", "inputCardHeight", 0),
  ctaHeight: pixelNumber("EXP-001", "ctaHeight", 56),
  ctaBottomInset: pixelNumber("EXP-001", "ctaBottomInset", 0)
} as const;
