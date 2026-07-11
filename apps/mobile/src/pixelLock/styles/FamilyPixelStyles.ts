import { pixelNumber } from "../overrides";

export const FamilyPixelStyles = {
  get horizontalOffset() {
    return pixelNumber("FAM-001", "horizontalOffset", 0);
  },
  get topOffset() {
    return pixelNumber("FAM-001", "topOffset", 0);
  },
  get scale() {
    return pixelNumber("FAM-001", "scale", 1);
  },
  get cardRadius() {
    return pixelNumber("FAM-001", "cardRadius", 22);
  },
  get roleCardHeight() {
    return pixelNumber("FAM-001", "roleCardHeight", 0);
  },
  get roleCardGap() {
    return pixelNumber("FAM-001", "roleCardGap", 0);
  },
  get inviteRowHeight() {
    return pixelNumber("FAM-001", "inviteRowHeight", 0);
  },
  get iconSize() {
    return pixelNumber("FAM-001", "iconSize", 0);
  }
} as const;
