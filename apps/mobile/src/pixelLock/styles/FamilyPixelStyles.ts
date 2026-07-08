import { pixelNumber } from "../overrides";

export const FamilyPixelStyles = {
  topOffset: pixelNumber("FAM-001", "topOffset", 0),
  cardRadius: pixelNumber("FAM-001", "cardRadius", 22),
  roleCardHeight: pixelNumber("FAM-001", "roleCardHeight", 0),
  roleCardGap: pixelNumber("FAM-001", "roleCardGap", 0),
  inviteRowHeight: pixelNumber("FAM-001", "inviteRowHeight", 0),
  iconSize: pixelNumber("FAM-001", "iconSize", 0)
} as const;
