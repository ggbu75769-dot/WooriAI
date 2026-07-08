import { pixelNumber } from "../overrides";

export const MoreSettingsPixelStyles = {
  get topOffset() {
    return pixelNumber("SET-001", "topOffset", 0);
  },
  get horizontalOffset() {
    return pixelNumber("SET-001", "horizontalOffset", 0);
  },
  get screenPadding() {
    return pixelNumber("SET-001", "screenPadding", 24);
  },
  get cardRadius() {
    return pixelNumber("SET-001", "cardRadius", 20);
  },
  get rowHeight() {
    return pixelNumber("SET-001", "rowHeight", 44);
  },
  get rowGap() {
    return pixelNumber("SET-001", "rowGap", 0);
  },
  get avatarSize() {
    return pixelNumber("SET-001", "avatarSize", 48);
  }
} as const;
