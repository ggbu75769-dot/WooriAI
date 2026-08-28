import { spacing } from "./spacing";

export const breakpoints = {
  compactMax: 479,
  mediumMax: 839,
  contentMax: 720
} as const;

export function horizontalPaddingForWidth(width: number) {
  return width <= breakpoints.compactMax ? spacing.lg : width < breakpoints.mediumMax ? spacing.xl : spacing.xxl;
}
