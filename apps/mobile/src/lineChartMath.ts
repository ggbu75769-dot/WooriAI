// Pure geometry helpers for LineChartCard (src/ui.tsx), split out of that file so they can be
// unit tested without importing "react-native" — react-native's own entry module ships
// untranspiled Flow syntax (e.g. `import typeof X from '...'`) that Vitest's default parser
// cannot handle, so any test that imports ui.tsx directly fails before it can run.

export type LineChartPoint = { x: number; y: number };

export type LineChartSegment = {
  angle: string;
  length: number;
  x: number;
  y: number;
};

// Turns a series of raw amounts into pixel coordinates for the line chart's plot area.
export function normalizeLineChartPoints(
  values: number[],
  width: number,
  height: number = 104,
  paddingTop: number = 10,
  paddingBottom: number = 20
): LineChartPoint[] {
  if (values.length === 0) return [];

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  const usableHeight = Math.max(height - paddingTop - paddingBottom, 0);

  return values.map((rawValue, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    // A flat (all-equal, including all-zero) series renders as a flat mid-height line
    // rather than dividing by zero.
    const normalized = range === 0 ? 0.5 : (rawValue - minValue) / range;
    const y = paddingTop + (1 - normalized) * usableHeight;
    return { x, y };
  });
}

export function lineChartSegmentsFor(points: LineChartPoint[]): LineChartSegment[] {
  return points.slice(1).map((point, index) => {
    const previous = points[index];
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;

    return {
      angle: `${Math.atan2(dy, dx) * (180 / Math.PI)}deg`,
      length: Math.hypot(dx, dy),
      x: (previous.x + point.x) / 2,
      y: (previous.y + point.y) / 2
    };
  });
}
