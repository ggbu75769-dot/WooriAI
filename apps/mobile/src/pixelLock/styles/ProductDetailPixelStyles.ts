import { pixelNumber } from "../overrides";

export const ProductDetailPixelStyles = {
  get horizontalOffset() {
    return pixelNumber("ITEM-002", "horizontalOffset", 0);
  },
  get topOffset() {
    return pixelNumber("ITEM-002", "topOffset", 0);
  },
  get scale() {
    return pixelNumber("ITEM-002", "scale", 1);
  },
  get scaleX() {
    return pixelNumber("ITEM-002", "scaleX", 1);
  },
  get heroHeight() {
    return pixelNumber("ITEM-002", "heroHeight", 215);
  },
  get cardRadius() {
    return pixelNumber("ITEM-002", "cardRadius", 22);
  },
  get cardGap() {
    return pixelNumber("ITEM-002", "cardGap", 12);
  },
  get disclosureMargin() {
    return pixelNumber("ITEM-002", "disclosureMargin", 0);
  },
  get ctaBottomInset() {
    return pixelNumber("ITEM-002", "ctaBottomInset", 0);
  }
} as const;
