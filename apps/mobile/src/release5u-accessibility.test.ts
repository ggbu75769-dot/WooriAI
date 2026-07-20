import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { horizontalPaddingForWidth } from "./design-system/tokens/breakpoint";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("Release 5U accessibility and responsive contract", () => {
  it("keeps all six viewport/font-scale pairs within a responsive shared scaffold", () => {
    const pairs = [
      { width: 320, fontScale: 1 },
      { width: 320, fontScale: 1.5 },
      { width: 360, fontScale: 1.3 },
      { width: 412, fontScale: 1.5 },
      { width: 600, fontScale: 1.5 },
      { width: 840, fontScale: 1.3 }
    ];

    for (const pair of pairs) {
      const horizontalPadding = horizontalPaddingForWidth(pair.width);
      expect(pair.width - horizontalPadding * 2).toBeGreaterThanOrEqual(280);
      expect(pair.fontScale).toBeLessThanOrEqual(1.5);
    }
    const scaffold = source("src/design-system/components/ScreenScaffold.tsx");
    expect(scaffold).toContain('width: "100%"');
    expect(scaffold).toContain('keyboardShouldPersistTaps="handled"');
  });

  it("keeps primary actions wrap-safe and Android keyboards in resize mode", () => {
    const ui = source("src/ui.tsx");
    const config = source("app.json");
    expect(ui).toContain("minHeight: theme.ctaHeight");
    expect(ui).not.toContain('numberOfLines={1} ellipsizeMode="tail"');
    expect(config).toContain('"softwareKeyboardLayoutMode": "resize"');
  });

  it("exposes selected radio/checkbox state, progress, date hints, and associated validation", () => {
    const controls = source("src/design-system/components/OnboardingControls.tsx");
    const preparedItems = source("src/onboarding/PreparedItemsV2Screen.tsx");
    expect(controls).toContain('accessibilityRole="radio"');
    expect(controls).toContain("accessibilityState={{ checked: selected, selected }}");
    expect(controls).toContain('accessibilityRole="checkbox"');
    expect(controls).toContain('accessibilityRole="progressbar"');
    expect(controls).toContain('accessibilityHint={error ? `${error}. 두 번 탭하면 달력이 열려요`');
    expect(controls).toContain("accessibilityHint={error ?? inputProps.accessibilityHint}");
    expect(preparedItems).toContain('accessibilityLabel="준비물 선택 진행률"');
    expect(preparedItems).toContain("accessibilityValue={{ min: 0, max: visibleItems.length, now: selectedVisibleCount");
    expect(preparedItems).toContain('label={allVisibleSelected ? "모두 해제" : "모두 선택"}');
  });

  it("keeps explicit no-items and deferred prepared-item outcomes distinct", () => {
    const preparedItems = source("src/onboarding/PreparedItemsV2Screen.tsx");
    expect(preparedItems).toContain('onSecondary={() => continueToBudget("completed_none")}');
    expect(preparedItems).toContain('secondaryLabel="아직 준비한 물건이 없어요"');
    expect(preparedItems).toContain('onText={() => continueToBudget("skipped")}');
    expect(preparedItems).toContain('textLabel="나중에 할게요"');
    expect(preparedItems).toContain('preparedItemIds: state === "selected" ? selectedVisibleIds : []');
  });

  it("keeps decorative icons out of the tree and modal focus deterministic", () => {
    const ui = source("src/ui.tsx");
    const controls = source("src/design-system/components/OnboardingControls.tsx");
    expect(ui).toContain("accessibilityElementsHidden");
    expect(ui).toContain('importantForAccessibility="no"');
    expect(controls).toContain("AccessibilityInfo.setAccessibilityFocus");
    expect(controls).toContain("onShow={focusModalHeading}");
    expect(controls).toContain("setTimeout(restoreFocus, 0)");
  });
});
