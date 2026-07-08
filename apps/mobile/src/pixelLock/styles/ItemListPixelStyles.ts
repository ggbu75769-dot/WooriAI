import { pixelNumber } from "../overrides";

export const ItemListPixelStyles = {
  get horizontalOffset() {
    return pixelNumber("ITEM-001", "horizontalOffset", 0);
  },
  get topOffset() {
    return pixelNumber("ITEM-001", "topOffset", -30);
  },
  get scale() {
    return pixelNumber("ITEM-001", "scale", 0.48);
  },
  get tabHeight() {
    return pixelNumber("ITEM-001", "tabHeight", 0);
  },
  get tabGap() {
    return pixelNumber("ITEM-001", "tabGap", 0);
  },
  get itemCardHeight() {
    return pixelNumber("ITEM-001", "itemCardHeight", 0);
  },
  get badgeHeight() {
    return pixelNumber("ITEM-001", "badgeHeight", 0);
  },
  get listGap() {
    return pixelNumber("ITEM-001", "listGap", 0);
  }
} as const;
