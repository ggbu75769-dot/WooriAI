import { pixelNumber } from "../overrides";

export const BottomTabPixelStyles = {
  get height() {
    return pixelNumber("TAB-001", "height", 64);
  },
  get paddingTop() {
    return pixelNumber("TAB-001", "paddingTop", 4);
  },
  get paddingBottom() {
    return pixelNumber("TAB-001", "paddingBottom", 4);
  },
  get iconSize() {
    return pixelNumber("TAB-001", "iconSize", 24);
  },
  get labelSize() {
    return pixelNumber("TAB-001", "labelSize", 11);
  }
} as const;
