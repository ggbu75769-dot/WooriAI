import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { breakpoints } from "./tokens/breakpoint";
import { semanticColors } from "./tokens/color";
import { iconSize } from "./tokens/icon";
import { motion } from "./tokens/motion";
import { radius } from "./tokens/radius";
import { spacing } from "./tokens/spacing";
import { typography } from "./tokens/typography";

const mobileRoot = resolve(__dirname, "../..");
const source = (relativePath: string) => readFileSync(resolve(mobileRoot, relativePath), "utf8");

describe("Release 4 design system", () => {
  it("exposes semantic tokens for color, type, spacing, shape, motion, icons, and responsive widths", () => {
    expect(semanticColors).toMatchObject({ background: expect.any(String), surface: expect.any(String), textPrimary: expect.any(String), actionPrimary: expect.any(String), danger: expect.any(String) });
    expect(typography.heading1.fontSize).toBeGreaterThan(typography.body.fontSize);
    expect(spacing.xxl).toBeGreaterThan(spacing.xs);
    expect(radius.card).toBeGreaterThan(0);
    expect(motion.standardMs).toBeGreaterThan(0);
    expect(iconSize.hero).toBeGreaterThan(iconSize.small);
    expect(breakpoints.contentMax).toBeGreaterThan(breakpoints.compactMax);
    expect(breakpoints.contentMax).toBeLessThanOrEqual(breakpoints.mediumMax);
  });

  it("keeps MOD_V1 home and profile free of viewport transform tricks while retaining isolated legacy capture paths", () => {
    expect(source("app/(tabs)/index.tsx")).not.toContain("homePixelScaleFrameStyle");
    expect(source("app/(tabs)/reports.tsx")).toContain("isPixelLockMode ? reportReferenceScaleFrameStyle() : undefined");
    expect(source("app/expenses/new.tsx")).toContain("isPixelLockMode ? quickExpensePixelFrameStyle() : { gap: 14 }");
    expect(source("app/family/index.tsx")).toContain("isPixelLockMode ? familyReferenceFrameStyle() : { gap: 16 }");
    expect(source("app/(tabs)/more.tsx")).not.toContain("moreReferenceFrameStyle");
    expect(source("app/import/index.tsx")).toContain("isPixelLockMode ? excelPreviewPixelFrameStyle() : undefined");
  });

  it("uses the common scaffold and cards in the Release 4 preparation and report surfaces", () => {
    expect(source("src/preparation/Release4PreparationScreen.tsx")).toContain("<ScreenScaffold");
    expect(source("src/preparation/Release4PreparationScreen.tsx")).toContain("<SectionCard");
    expect(source("app/(tabs)/reports.tsx")).toContain("<SectionCard>");
    expect(source("src/ui.tsx")).toContain("return <ScreenScaffold>{children}</ScreenScaffold>");
  });

  it("defines shared async/offline states and 48dp core controls without text glyph icons", () => {
    const stateSource = source("src/design-system/patterns/AsyncState.tsx");
    const uiSource = source("src/ui.tsx");
    expect(stateSource).toContain("export function LoadingState");
    expect(stateSource).toContain("export function EmptyState");
    expect(stateSource).toContain("export function ErrorState");
    expect(stateSource).toContain("export function OfflineState");
    expect(stateSource).toContain("export function SyncStatusBar");
    expect(stateSource).toContain("minHeight: 48");
    expect(uiSource).toContain("height: theme.touchTarget");
    expect(uiSource).not.toMatch(/isError \? "⚠" : "✓"/u);
  });
});
