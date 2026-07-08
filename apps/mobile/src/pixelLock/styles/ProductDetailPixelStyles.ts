import { pixelNumber } from "../overrides";

export const ProductDetailPixelStyles = {
  topOffset: pixelNumber("ITEM-002", "topOffset", -40),
  scale: pixelNumber("ITEM-002", "scale", 0.806),
  scaleX: pixelNumber("ITEM-002", "scaleX", 1.35),
  heroHeight: pixelNumber("ITEM-002", "heroHeight", 215),
  cardRadius: pixelNumber("ITEM-002", "cardRadius", 22),
  cardGap: pixelNumber("ITEM-002", "cardGap", 12),
  disclosureMargin: pixelNumber("ITEM-002", "disclosureMargin", 0),
  ctaBottomInset: pixelNumber("ITEM-002", "ctaBottomInset", 0)
} as const;
