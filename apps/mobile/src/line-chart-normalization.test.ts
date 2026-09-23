import { describe, expect, it } from "vitest";
import { lineChartAxisLabelPosition, normalizeLineChartPoints } from "./lineChartMath";

describe("LineChartCard point normalization", () => {
  it("maps values onto the chart width, inset by the point radius, with even horizontal spacing", () => {
    const points = normalizeLineChartPoints([10, 20, 30, 40], 300);

    expect(points).toHaveLength(4);
    expect(points.map((point) => point.x)).toEqual([6, 102, 198, 294]);
  });

  it("insets the first and last point so their marker radius does not get clipped", () => {
    const pointRadius = 6;
    const width = 260;
    const points = normalizeLineChartPoints([100, 250, 80, 400, 300], width);

    expect(points[0].x).toBe(pointRadius);
    expect(points[points.length - 1].x).toBe(width - pointRadius);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(pointRadius);
      expect(point.x).toBeLessThanOrEqual(width - pointRadius);
    }
  });

  it("puts the highest value at the smallest y (closest to the top of the plot area)", () => {
    const points = normalizeLineChartPoints([10, 50, 30], 200, 104, 10, 20);

    const [low, high, mid] = points;
    expect(high.y).toBeLessThan(mid.y);
    expect(mid.y).toBeLessThan(low.y);
  });

  it("renders a flat mid-height line when every value is equal, including all zeros", () => {
    const zeroPoints = normalizeLineChartPoints([0, 0, 0], 200, 104, 10, 20);
    const flatY = zeroPoints[0].y;

    expect(zeroPoints.every((point) => point.y === flatY)).toBe(true);

    const equalPoints = normalizeLineChartPoints([500, 500, 500, 500], 200, 104, 10, 20);
    expect(equalPoints.every((point) => point.y === equalPoints[0].y)).toBe(true);
  });

  it("keeps every y coordinate within the padded plot area", () => {
    const height = 104;
    const paddingTop = 10;
    const paddingBottom = 20;
    const points = normalizeLineChartPoints([0, 5_000, 1_200, 8_800, 300], 260, height, paddingTop, paddingBottom);

    for (const point of points) {
      expect(point.y).toBeGreaterThanOrEqual(paddingTop);
      expect(point.y).toBeLessThanOrEqual(height - paddingBottom);
    }
  });

  it("returns an empty array for an empty input instead of throwing", () => {
    expect(normalizeLineChartPoints([], 200)).toEqual([]);
  });
});

describe("LineChartCard axis labels", () => {
  it.each([6, 12])("keeps all %i month labels inside the plot and aligned with their points", (count) => {
    const chartWidth = 280;
    const points = normalizeLineChartPoints(Array.from({ length: count }, () => 0), chartWidth);
    const positions = points.map((point) => lineChartAxisLabelPosition(point.x, chartWidth, count));

    for (const [index, label] of positions.entries()) {
      expect(label.left).toBeGreaterThanOrEqual(0);
      expect(label.left + label.width).toBeLessThanOrEqual(chartWidth);
      expect(Math.abs(label.left + label.width / 2 - points[index].x)).toBeLessThanOrEqual(6);
    }
    expect(positions[0].left).toBe(0);
    expect(positions[count - 1].left + positions[count - 1].width).toBe(chartWidth);
  });
});
