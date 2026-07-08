import { pixelNumber } from "../overrides";

export const HomePixelStyles = {
  screenPadding: pixelNumber("HOME-001", "screenPadding", 24),
  topOffset: pixelNumber("HOME-001", "topOffset", 0),
  heroHeight: pixelNumber("HOME-001", "heroHeight", 0),
  cardGap: pixelNumber("HOME-001", "cardGap", 12),
  rowHeight: pixelNumber("HOME-001", "rowHeight", 0),
  bottomTabHeight: pixelNumber("HOME-001", "bottomTabHeight", 72)
} as const;
