import { pixelNumber } from "../overrides";

export const ExcelPreviewPixelStyles = {
  topOffset: pixelNumber("IMP-003", "topOffset", -8),
  scale: pixelNumber("IMP-003", "scale", 0.902),
  scaleY: pixelNumber("IMP-003", "scaleY", 1.149),
  screenPadding: pixelNumber("IMP-003", "screenPadding", 24),
  cardRadius: pixelNumber("IMP-003", "cardRadius", 22),
  rowHeight: pixelNumber("IMP-003", "rowHeight", 0),
  ctaHeight: pixelNumber("IMP-003", "ctaHeight", 56),
  ctaBottomInset: pixelNumber("IMP-003", "ctaBottomInset", 0)
} as const;
