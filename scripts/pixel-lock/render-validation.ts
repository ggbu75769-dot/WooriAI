export type RenderBlanknessMetrics = {
  whitePixelRatio: number;
  uniqueColorCount: number;
  nonBackgroundAreaRatio: number;
};

export function isEvidenceCurrentForScreenshot(screenshotMtimeMs: number, evidenceMtimeMs: number) {
  return evidenceMtimeMs >= screenshotMtimeMs;
}

export function isLikelyBlankOrShell(metrics: RenderBlanknessMetrics, hasScreenSentinel = false) {
  const undeniablyBlank =
    (metrics.whitePixelRatio > 0.97 && metrics.nonBackgroundAreaRatio < 0.025) ||
    (metrics.uniqueColorCount < 100 && metrics.nonBackgroundAreaRatio < 0.02);
  if (undeniablyBlank) return true;
  if (hasScreenSentinel) return false;
  if (metrics.nonBackgroundAreaRatio >= 0.1 && metrics.uniqueColorCount >= 1000) return false;
  return (
    (metrics.whitePixelRatio > 0.82 &&
      metrics.uniqueColorCount < 2500 &&
      metrics.nonBackgroundAreaRatio < 0.2) ||
    (metrics.whitePixelRatio > 0.93 && metrics.nonBackgroundAreaRatio < 0.08) ||
    (metrics.uniqueColorCount < 500 && metrics.nonBackgroundAreaRatio < 0.04)
  );
}
