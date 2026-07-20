import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("Android native UI quality contract", () => {
  it("keeps the five MOD_V1 bottom tabs visible", () => {
    const tabsSource = source("app/(tabs)/_layout.tsx");

    expect(tabsSource).toContain('items: { title: "준비템"');
    expect(tabsSource).toContain('more: { title: "프로필"');
    expect(tabsSource).toContain('<Tabs.Screen name="more"');
    expect(tabsSource).not.toContain('name="more" options={{ href: null }}');
    expect(tabsSource).toContain('index: { title: "홈"');
    expect(tabsSource).toContain('records: { title: "기록"');
    expect(tabsSource).toContain('reports: { title: "리포트"');
  });

  it("uses the Android system status bar instead of drawing duplicate status bars", () => {
    const screenPaths = [
      "app/expenses/new.tsx",
      "app/(tabs)/reports.tsx",
      "app/family/index.tsx",
      "app/import/index.tsx",
      "app/(tabs)/more.tsx",
      "app/items/[itemTemplateId].tsx"
    ];

    for (const screenPath of screenPaths) {
      expect(source(screenPath), screenPath).not.toContain('>9:41<');
    }
  });

  it("renders full-width Android layouts without center-shrink or horizontal-stretch hacks", () => {
    const styleExpectations = [
      ["src/pixelLock/styles/HomePixelStyles.ts", 'return pixelNumber("HOME-001", "scale", 1)'],
      ["src/pixelLock/styles/QuickExpensePixelStyles.ts", 'return pixelNumber("EXP-001", "scale", 1)'],
      ["src/pixelLock/styles/ItemListPixelStyles.ts", 'return pixelNumber("ITEM-001", "scale", 1)'],
      ["src/pixelLock/styles/ProductDetailPixelStyles.ts", 'return pixelNumber("ITEM-002", "scale", 1)'],
      ["src/pixelLock/styles/ProductDetailPixelStyles.ts", 'return pixelNumber("ITEM-002", "scaleX", 1)'],
      ["src/pixelLock/styles/ReportPixelStyles.ts", 'return pixelNumber("REP-001", "scale", 1)'],
      ["src/pixelLock/styles/FamilyPixelStyles.ts", 'return pixelNumber("FAM-001", "scale", 1)'],
      ["src/pixelLock/styles/ExcelPreviewPixelStyles.ts", 'return pixelNumber("IMP-003", "scale", 1)'],
      ["src/pixelLock/styles/ExcelPreviewPixelStyles.ts", 'return pixelNumber("IMP-003", "scaleY", 1)']
    ] as const;

    for (const [relativePath, expected] of styleExpectations) {
      expect(source(relativePath), relativePath).toContain(expected);
    }
  });

  it("keeps screen ids accessible without showing debug ids as user copy", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    expect(homeSource).toContain('accessibilityLabel={pixelEvidenceId("HOME-001")}');
    expect(homeSource).not.toContain('eyebrow="HOME-001"');
  });

  it("provides real interactive product-detail navigation controls", () => {
    const detailSource = source("app/items/[itemTemplateId].tsx");
    expect(detailSource).toContain("router.back()");
    expect(detailSource).toContain("accessibilityLabel=\"뒤로가기\"");
    expect(detailSource).not.toContain('pointerEvents="none"');
  });

  it("uses a cross-platform perceptual Android diff instead of binary glyph-level mismatch", () => {
    const pixelGateSource = source("../../scripts/pixel-lock/android-pixel-lock.ts");
    expect(pixelGateSource).toContain("perceptualScoreSigma = 12");
    expect(pixelGateSource).toContain("sumDistance / (width * height * 3 * 255)");
    expect(pixelGateSource).toContain('comparisonPolicy: `perceptual-blurred-mae:sigma-${perceptualScoreSigma}`');
  });

  it("accepts content-rich white Android screens while still rejecting blank shells", () => {
    const pixelGateSource = source("../../scripts/pixel-lock/android-pixel-lock.ts");
    expect(pixelGateSource).toContain("metrics.nonBackgroundAreaRatio >= 0.1 && metrics.uniqueColorCount >= 1000");
  });

  it("prewarms the native runtime and waits for the tab bar to settle before taking Android evidence", () => {
    const pixelGateSource = source("../../scripts/pixel-lock/android-pixel-lock.ts");
    expect(pixelGateSource).toContain("process.env.PIXEL_ANDROID_SETTLE_MS || 5000");
    expect(pixelGateSource).toContain('openScreen("HOME-001", screens, { coldStart: true })');
    expect(pixelGateSource).toContain('const coldStart = process.env.PIXEL_ANDROID_COLD_EACH === "1"');
  });

  it("does not overwrite a requested Pixel Lock deep link with HOME-001", () => {
    const indexSource = source("app/index.tsx");
    const pixelLauncherSource = source("app/pixel-lock.tsx");
    const mainActivitySource = source("android/app/src/main/java/com/anonymous/wooriai/MainActivity.kt");

    expect(indexSource).not.toContain('<Redirect href="/pixel-lock?screen=HOME-001" />');
    expect(pixelLauncherSource).toContain("parsePixelLockRequest(url)");
    expect(pixelLauncherSource).toContain("!nativeLinkResolved");
    expect(mainActivitySource).toContain('data = Uri.parse("wooriai:///pixel-lock?screen=HOME-001")');
  });

  it("reuses the matching per-screen render evidence when an Android capture is cached", () => {
    const pixelGateSource = source("../../scripts/pixel-lock/android-pixel-lock.ts");
    expect(pixelGateSource).toContain("validateRender(targetId, screenshotPath, !canSkipCapture)");
    expect(pixelGateSource).toContain('existsSync(xmlPath)');
    expect(pixelGateSource).toContain('readFileSync(xmlPath, "utf8")');
    expect(pixelGateSource).toContain('readFileSync(logcatPath, "utf8")');
    expect(pixelGateSource).toContain("else delete cache[targetId]");
  });

  it("normalizes the tall Excel reference without center-shrinking the Android capture", () => {
    const config = JSON.parse(source("../../scripts/pixel-lock/pixel-lock-screens.json"));
    expect(config["IMP-003"].androidNormalization).toBe("fill");
  });

  it("makes visible family and report navigation controls interactive", () => {
    const familySource = source("app/family/index.tsx");
    expect(familySource).toContain('accessibilityLabel="뒤로가기"');
    expect(familySource).toContain("router.back()");

    const reportSource = source("app/(tabs)/reports.tsx");
    expect(reportSource).toContain('accessibilityLabel={label}');
    expect(reportSource).toContain('label="이전 달"');
    expect(reportSource).toContain('label="다음 달"');
    expect(reportSource).toContain("setMonthOffset((value) => value - 1)");
    expect(reportSource).toContain("setMonthOffset((value) => value + 1)");
  });

  it("records the displayed current date and lets the payment row change method", () => {
    const expenseSource = source("app/expenses/new.tsx");
    expect(expenseSource).toContain("formatExpenseDate(today)");
    expect(expenseSource).toContain("spentOn: expenseDate.iso");
    expect(expenseSource).toContain('accessibilityLabel="결제 수단 변경"');
    expect(expenseSource).toContain("setPaymentMethodIndex");
  });

  it("keeps the EXP-001 pixel-lock capture deterministic while real sessions see the actual Seoul date", () => {
    const expenseSource = source("app/expenses/new.tsx");
    expect(expenseSource).toContain('"2025. 05. 24 (토)"');
    expect(expenseSource).toContain("getSeoulToday");
    expect(expenseSource).toContain("authToken ? formatExpenseDate(today) : previewExpenseDate");
    expect(expenseSource).toContain('disabled={saveExpense.isPending || isSaveInvalid}');
    expect(expenseSource).toContain("validateExpenseForm({ itemName, amountText, spentOn: expenseDate.iso })");
  });
});
