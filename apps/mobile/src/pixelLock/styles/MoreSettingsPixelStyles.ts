import { pixelNumber } from "../overrides";

export const MoreSettingsPixelStyles = {
  topOffset: pixelNumber("SET-001", "topOffset", 0),
  screenPadding: pixelNumber("SET-001", "screenPadding", 24),
  cardRadius: pixelNumber("SET-001", "cardRadius", 20),
  rowHeight: pixelNumber("SET-001", "rowHeight", 44),
  rowGap: pixelNumber("SET-001", "rowGap", 0),
  avatarSize: pixelNumber("SET-001", "avatarSize", 48)
} as const;
