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
      50: "#FFF4EF",
      100: "#FFE4D8",
      200: "#FFC8B5",
      300: "#FFA58A",
      400: "#F98060",
      500: "#E85F3B",
      600: "#C94627",
      700: "#A93720",
      800: "#862D1D",
      900: "#67251B"
    });
  });

  it("defines cream, text, and semantic token groups", async () => {
    const { theme } = await import("./theme");
    expect(theme.colors.cream).toEqual({ bg: "#FFFDFC", surface: "#FFFFFF", surfaceAlt: "#F8F6F4" });
    expect(theme.colors.text).toEqual({ primary: "#211E1C", secondary: "#5F5854", tertiary: "#7A716B" });
    expect(theme.colors.semantic).toEqual({
      success: "#16794B",
      warning: "#B45309",
      danger: "#B42318",
      info: "#1D4ED8"
    });
  });

  it("redirects legacy flat color keys onto the new D0 tokens instead of deleting them", async () => {
    const { theme } = await import("./theme");
    expect(theme.colors.mainCoral).toBe(theme.colors.coral[600]);
    expect(theme.colors.subCoral).toBe(theme.colors.coral[500]);
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

describe("D0 MoneyText component contract", () => {
  const source = readSource("src/ui/MoneyText.tsx");

  it("exposes hero|section|row size tiers backed by theme.money", () => {
    expect(source).toContain('export type MoneyTextSize = "hero" | "section" | "row"');
    expect(source).toContain("theme.money[size]");
  });

  it("renders the 원 suffix a step smaller than the number and applies tabular-nums", () => {
    expect(source).toContain("formatKrwParts");
    expect(source).toContain("suffixFontSize");
    expect(source).toContain("tier.fontSize * 0.6");
    expect(source).toContain('fontVariant: ["tabular-nums"]');
  });

  it("prefixes income/refund amounts with + and colors them with semantic.success", () => {
    expect(source).toContain('sign?: "income" | "refund"');
    expect(source).toContain("theme.colors.semantic.success");
    expect(source).toContain('sign ? "+" : ""');
  });
});

describe("D0 ListRow component contract", () => {
  const source = readSource("src/ui/ListRow.tsx");

  it("is additive -- does not replace the pre-existing ListRow in src/ui.tsx", () => {
    const legacyUiSource = readSource("src/ui.tsx");
    expect(legacyUiSource).toContain("export function ListRow(");
  });

  it("exposes a left circular color icon slot, title+subtitle, and a right value/badge slot", () => {
    expect(source).toContain("iconBackgroundColor");
    expect(source).toContain("borderRadius: 20");
    expect(source).toContain("title: string");
    expect(source).toContain("subtitle?: string");
    expect(source).toContain("value?: string");
    expect(source).toContain("badge?: React.ReactNode");
  });

  it("keeps the row's touch target at theme.touchTarget (>= 44dp) regardless of onPress", () => {
    expect(source).toContain("minHeight: theme.touchTarget");
  });
});

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

describe("D6 EmptyState component contract", () => {
  const source = readSource("src/ui/EmptyState.tsx");

  it("exposes icon/title/description/cta props", () => {
    expect(source).toContain("icon?: string");
    expect(source).toContain("title: string");
    expect(source).toContain("description?: string");
    expect(source).toContain("ctaLabel?: string");
    expect(source).toContain("onPressCta?: () => void");
  });
});

describe("D0 StageBadge component contract", () => {
  const source = readSource("src/ui/StageBadge.tsx");

  it("uses coral-50 background with coral-700 text", () => {
    expect(source).toContain("theme.colors.coral[50]");
    expect(source).toContain("theme.colors.coral[700]");
  });
});

describe("D1 tab bar outlined/filled wiring", () => {
  const source = readSource("app/(tabs)/_layout.tsx");

  it("keeps the five product tab labels visible", () => {
    for (const label of ["홈", "기록", "준비템", "리포트", "더보기"]) {
      expect(source).toContain(label);
    }
    expect(source).toContain('name="more"');
    expect(source).not.toContain('name="more" options={{ href: null }}');
  });

  it("defines an outlined (inactive) and filled (active) icon glyph pair per tab", () => {
    expect(source).toContain("outline");
    expect(source).toContain("filled");
    expect(source).toContain("focused ? tabs[name].filled : tabs[name].outline");
  });

  it("tints the active tab with the canonical primary alias", () => {
    expect(source).toContain("theme.colors.mainCoral");
    expect(source).toContain("tabBarActiveTintColor: theme.colors.mainCoral");
  });
});
