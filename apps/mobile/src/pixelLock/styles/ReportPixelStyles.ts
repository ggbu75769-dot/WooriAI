import { pixelNumber } from "../overrides";

export const ReportPixelStyles = {
  get horizontalOffset() {
    return pixelNumber("REP-001", "horizontalOffset", 0);
  },
  get topOffset() {
    return pixelNumber("REP-001", "topOffset", 0);
  },
  get scale() {
    return pixelNumber("REP-001", "scale", 1);
  },
  get cardRadius() {
    return pixelNumber("REP-001", "cardRadius", 22);
  },
  get chartCardHeight() {
    return pixelNumber("REP-001", "chartCardHeight", 0);
  },
  get chartBarWidth() {
    return pixelNumber("REP-001", "chartBarWidth", 0);
  },
  get chartBarGap() {
    return pixelNumber("REP-001", "chartBarGap", 0);
  },
  get rowHeight() {
    return pixelNumber("REP-001", "rowHeight", 0);
  }
} as const;
