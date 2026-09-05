export const LARGE_TEXT_SCALE_THRESHOLD = 1.5;

export function usesLargeTextLayout(fontScale: number) {
  return fontScale >= LARGE_TEXT_SCALE_THRESHOLD;
}

export function compactGridColumnCount(width: number, fontScale: number) {
  if (usesLargeTextLayout(fontScale)) return width >= 900 ? 4 : 2;
  return width >= 600 ? 4 : 3;
}

export function compactGridItemWidth(columns: number) {
  if (columns >= 4) return "23.4%" as const;
  if (columns === 2) return "48.4%" as const;
  return "31.4%" as const;
}

export function adaptiveTabBarHeight(baseHeight: number, fontScale: number) {
  return baseHeight + Math.max(0, Math.min(fontScale, 2) - 1) * 24;
}
