import { pixelNumber } from "../overrides";

export const HomePixelStyles = {
  get horizontalOffset() {
    return pixelNumber("HOME-001", "horizontalOffset", 0);
  },
  get topOffset() {
    return pixelNumber("HOME-001", "topOffset", 0);
  },
  get scale() {
    return pixelNumber("HOME-001", "scale", 1);
  },
  get scaleX() {
    return pixelNumber("HOME-001", "scaleX", 1);
  },
  get scaleHorizontalOffset() {
    return pixelNumber("HOME-001", "scaleHorizontalOffset", 0);
  },
  get scaleVerticalOffset() {
    return pixelNumber("HOME-001", "scaleVerticalOffset", 0);
  },
  get screenPadding() {
    return pixelNumber("HOME-001", "screenPadding", 24);
  },
  get heroHeight() {
    return pixelNumber("HOME-001", "heroHeight", 0);
  },
  get cardGap() {
    return pixelNumber("HOME-001", "cardGap", 12);
  },
  get rowHeight() {
    return pixelNumber("HOME-001", "rowHeight", 0);
  },
  get bottomTabHeight() {
    return pixelNumber("HOME-001", "bottomTabHeight", 72);
  }
} as const;
