import { pixelNumber } from "../overrides";

export const BottomTabPixelStyles = {
  get height() {
    return pixelNumber("TAB-001", "height", 72);
  },
  get paddingTop() {
    return pixelNumber("TAB-001", "paddingTop", 8);
  },
  get paddingBottom() {
    return pixelNumber("TAB-001", "paddingBottom", 10);
  },
  get iconSize() {
    return pixelNumber("TAB-001", "iconSize", 19);
  },
  get labelSize() {
    return pixelNumber("TAB-001", "labelSize", 10);
  }
} as const;
