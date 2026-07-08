import { pixelNumber } from "../overrides";

export const ItemListPixelStyles = {
  topOffset: pixelNumber("ITEM-001", "topOffset", -50),
  scale: pixelNumber("ITEM-001", "scale", 0.82),
  tabHeight: pixelNumber("ITEM-001", "tabHeight", 0),
  tabGap: pixelNumber("ITEM-001", "tabGap", 0),
  itemCardHeight: pixelNumber("ITEM-001", "itemCardHeight", 0),
  badgeHeight: pixelNumber("ITEM-001", "badgeHeight", 0),
  listGap: pixelNumber("ITEM-001", "listGap", 0)
} as const;
