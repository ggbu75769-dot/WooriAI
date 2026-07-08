import { pixelNumber } from "../overrides";

export const ReportPixelStyles = {
  topOffset: pixelNumber("REP-001", "topOffset", -81),
  scale: pixelNumber("REP-001", "scale", 0.732),
  cardRadius: pixelNumber("REP-001", "cardRadius", 22),
  chartCardHeight: pixelNumber("REP-001", "chartCardHeight", 0),
  chartBarWidth: pixelNumber("REP-001", "chartBarWidth", 0),
  chartBarGap: pixelNumber("REP-001", "chartBarGap", 0),
  rowHeight: pixelNumber("REP-001", "rowHeight", 0)
} as const;
