import { pixelNumber } from "../overrides";

export const ExcelPreviewPixelStyles = {
  get horizontalOffset() {
    return pixelNumber("IMP-003", "horizontalOffset", 0);
  },
  get topOffset() {
    return pixelNumber("IMP-003", "topOffset", 0);
  },
  get scale() {
    return pixelNumber("IMP-003", "scale", 1);
  },
  get scaleY() {
    return pixelNumber("IMP-003", "scaleY", 1);
  },
  get screenPadding() {
    return pixelNumber("IMP-003", "screenPadding", 24);
  },
  get cardRadius() {
    return pixelNumber("IMP-003", "cardRadius", 22);
  },
  get rowHeight() {
    return pixelNumber("IMP-003", "rowHeight", 0);
  },
  get ctaHeight() {
    return pixelNumber("IMP-003", "ctaHeight", 56);
  },
  get ctaBottomInset() {
    return pixelNumber("IMP-003", "ctaBottomInset", 56);
  }
} as const;
