import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CategoryCode } from "./categories";

// Round 5A design foundation contract (docs/5차/round5a-design-spec.md §D0/§D1/§D6).
//
// theme.ts has no react-native import, so its token values are asserted directly. The new
// src/ui/*.tsx components (and app/(tabs)/_layout.tsx) import "react-native", which this repo's
// plain-node vitest setup cannot execute (no RN test renderer/mock is configured here -- see the
// existing source-contract tests such as ui-pixel-lock-flow.test.ts), so those are asserted as
// source-string contracts instead, matching the rest of this suite's convention.
const mobileRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(mobileRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

describe("D0 theme tokens", () => {
  it("defines the coral scale", async () => {
    const { theme } = await import("./theme");
    expect(theme.colors.coral).toEqual({
      50: "#FFF3F0",
      100: "#FFE4DD",
      200: "#FFC9BB",
      300: "#FFA88E",
      400: "#F97B5C",
      500: "#EF6644",
      600: "#DB4F2E",
      700: "#B93E23"
    });
  });

  it("defines cream, text, and semantic token groups", async () => {
    const { theme } = await import("./theme");
    expect(theme.colors.cream).toEqual({ bg: "#FFF8F1", surface: "#FFFFFF", surfaceAlt: "#FFF9F3" });
    expect(theme.colors.text).toEqual({ primary: "#3D3733", secondary: "#6E645C", tertiary: "#9C918A" });
    expect(theme.colors.semantic).toEqual({
      success: "#2E9E6B",
      warning: "#E8A13A",
      danger: "#D3382F",
      info: "#5B7FA6"
    });
  });

  it("redirects legacy flat color keys onto the new D0 tokens instead of deleting them", async () => {
    const { theme } = await import("./theme");
    expect(theme.colors.mainCoral).toBe(theme.colors.coral[500]);
    expect(theme.colors.subCoral).toBe(theme.colors.coral[400]);
    expect(theme.colors.peach).toBe(theme.colors.coral[100]);
    expect(theme.colors.beige).toBe(theme.colors.cream.surfaceAlt);
    expect(theme.colors.brown).toBe(theme.colors.text.primary);
    expect(theme.colors.gray600).toBe(theme.colors.text.secondary);
    expect(theme.colors.background).toBe(theme.colors.cream.bg);
    expect(theme.colors.success).toBe(theme.colors.semantic.success);
    expect(theme.colors.warning).toBe(theme.colors.semantic.warning);
    expect(theme.colors.danger).toBe(theme.colors.semantic.danger);
  });

  it("defines a fixed 8-10 color warm-pastel category palette mapped onto every category code", async () => {
    const { theme } = await import("./theme");
    const { categoryCatalog } = await import("./categories");

    expect(theme.colors.categoryPalette.length).toBeGreaterThanOrEqual(8);
    expect(theme.colors.categoryPalette.length).toBeLessThanOrEqual(10);

    const allCodes = new Set<CategoryCode>(categoryCatalog.map((entry) => entry.code));
    for (const code of allCodes) {
      const color = theme.colors.categoryColors[code];
      expect(color, `categoryColors should map ${code}`).toBeDefined();
      expect(theme.colors.categoryPalette as readonly string[]).toContain(color);
    }
  });

  it("defines a 3-tier tabular-nums money typography scale (hero 30/800, section 17/700, row 15/600)", async () => {
    const { theme } = await import("./theme");
    expect(theme.money.hero).toMatchObject({ fontSize: 30, fontWeight: "800", fontVariant: ["tabular-nums"] });
    expect(theme.money.section).toMatchObject({ fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"] });
    expect(theme.money.row).toMatchObject({ fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] });
  });
});

// MOB-121: the D0 MoneyText contract block was removed along with src/ui/MoneyText.tsx —
// a dead component no screen adopted; money rendering goes through src/money.ts's formatKrw.

// CLN-130: the D0 ListRow contract block was removed along with src/ui/ListRow.tsx — the
// "additive, alongside src/ui.tsx" component that no screen ever adopted. Rows go through
// src/ui.tsx's ListRow (settings, records, notifications), whose touch-target and button-role
// contracts live in src/a11y-contract.test.ts.

describe("D0/D6 Skeleton component contract", () => {
  const source = readSource("src/ui/Skeleton.tsx");

  it("exposes Skeleton plus SkeletonCard/SkeletonRow presets", () => {
    expect(source).toContain("export function Skeleton(");
    expect(source).toContain("export function SkeletonRow(");
    expect(source).toContain("export function SkeletonCard(");
  });

  it("pulses opacity via Animated and respects reduce-motion", () => {
    expect(source).toContain("Animated.loop(");
    expect(source).toContain("Animated.sequence(");
    expect(source).toContain("useNativeDriver: true");
    expect(source).toContain("AccessibilityInfo.isReduceMotionEnabled");
    expect(source).toContain("reduceMotionEnabled");
  });
});

// MOB-121: the D6 EmptyState contract block was removed along with src/ui/EmptyState.tsx —
// a dead component no screen adopted; screens use src/ui.tsx's EmptyStateCard instead.

// CLN-130: the D0 StageBadge contract block was removed along with src/ui/StageBadge.tsx —
// another unadopted D0 component. The coral[50]/coral[700] badge recipe it defined survives in
// src/ui.tsx's StatusBadge (warning tone), pinned by src/a11y-contract.test.ts (A11Y-117).

// R20-A: the report tab's 카테고리 비중 chart. The old donut arc was drawn with the
// border-quadrant trick (four border colors on a rounded View), which can only express four fixed
// 90° wedges -- the angles carried no data. It is replaced, for real data, by a stacked share bar
// whose slice widths are the actual proportions. The logged-out preview keeps the decorative donut
// so the pixel-lock capture stays unchanged.
describe("R20-A 카테고리 비중 proportional share bar", () => {
  const source = readSource("src/ui.tsx");
  const chartBlock = source.slice(source.indexOf("export function DonutChartCard"), source.indexOf("export function EmptyStateCard"));

  it("drives real segments through the pure share math instead of fixed wedges", () => {
    expect(source).toContain('import { computeCategoryShares } from "./reports/category-share"');
    expect(chartBlock).toContain("computeCategoryShares(segments)");
    // Widths are the proportions themselves -- no rounded-off percentage strings, no 90° wedges.
    expect(chartBlock).toContain("flexGrow: slice.widthPercent");
    expect(chartBlock).toContain("flexBasis: 0");
    // Real data must never reach the four-wedge arc again.
    expect(chartBlock).not.toContain("arcColors = segments");
  });

  it("keeps the legend readable: swatch color, category name, amount and corrected percent", () => {
    expect(chartBlock).toContain("donutSegmentPalette[index % donutSegmentPalette.length]");
    expect(chartBlock).toContain("{slice.label}");
    expect(chartBlock).toContain("{formatKrw(slice.amountKrw)}");
    expect(chartBlock).toContain("{slice.percentLabel}");
    // A11Y-117: the bar is decorative, each legend row is one announced element.
    expect(chartBlock).toContain("accessibilityElementsHidden");
    expect(chartBlock).toContain("accessibilityLabel={`${slice.label}, ${slice.percentLabel}, ${formatKrw(slice.amountKrw)}`}");
  });

  it("never falls back to the decorative preview legend when real amounts add up to nothing", () => {
    expect(chartBlock).toContain("shares.length === 0");
    expect(chartBlock).toContain("아직 비중을 보여줄 지출이 없어요.");
  });

  it("leaves the logged-out preview donut in place for the pixel-lock capture", () => {
    expect(chartBlock).toContain("reportCategoryLegend.map(([label, percent])");
    expect(chartBlock).toContain('transform: [{ rotate: "-22deg" }]');
  });

  it("computes shares that fill the bar exactly and keep tiny categories visible", async () => {
    const { computeCategoryShares, MIN_SLICE_WIDTH_PERCENT } = await import("./reports/category-share");
    const slices = computeCategoryShares([
      { label: "기저귀/위생", amountKrw: 700_000 },
      { label: "식비/간식", amountKrw: 299_000 },
      { label: "기타", amountKrw: 1_000 },
      { label: "빈 카테고리", amountKrw: 0 }
    ]);

    expect(slices.map((slice) => slice.label)).toEqual(["기저귀/위생", "식비/간식", "기타"]);
    expect(slices.reduce((sum, slice) => sum + slice.percent, 0)).toBe(100);
    expect(slices.reduce((sum, slice) => sum + slice.widthPercent, 0)).toBeCloseTo(100, 9);
    expect(slices[2].widthPercent).toBe(MIN_SLICE_WIDTH_PERCENT);
    expect(slices[0].widthPercent).toBeGreaterThan(slices[1].widthPercent);
  });
});

describe("D1 tab bar outlined/filled wiring", () => {
  const source = readSource("app/(tabs)/_layout.tsx");

  it("keeps the 4 always-visible tab labels and the hidden more route", () => {
    for (const label of ["홈", "기록", "준비템", "리포트", "더보기"]) {
      expect(source).toContain(label);
    }
    expect(source).toContain('name="more"');
    expect(source).toContain("href: null");
  });

  it("defines an outlined (inactive) and filled (active) icon glyph pair per tab", () => {
    expect(source).toContain("outline");
    expect(source).toContain("filled");
    expect(source).toContain("focused ? tabs[name].filled : tabs[name].outline");
  });

  it("tints the active tab with coral-500", () => {
    expect(source).toContain("theme.colors.coral[500]");
    expect(source).toContain("tabBarActiveTintColor: theme.colors.coral[500]");
  });
});
