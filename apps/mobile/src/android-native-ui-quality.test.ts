import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("Android native UI quality contract", () => {
  it("uses the transparent brand mark for the native splash instead of an opaque square tile", () => {
    const appConfig = JSON.parse(source("app.json"));

    expect(appConfig.expo.icon).toBe("./assets/icon.png");
    expect(appConfig.expo.splash.image).toBe("./assets/splash-mark.png");
    expect(appConfig.expo.splash.resizeMode).toBe("contain");
    expect(appConfig.expo.splash.backgroundColor).toBe("#FFF9F3");
    expect(appConfig.expo.notification.color).toBe("#FF6B4A");
    expect(appConfig.expo.android.adaptiveIcon.foregroundImage).toBe("./assets/adaptive-icon.png");
    expect(appConfig.expo.android.adaptiveIcon.backgroundColor).toBe("#FFF9F3");
  });

  it("uses the Sprout Wallet identity across every production brand surface", () => {
    const mark = source("assets/brand/wooriai-mark.svg");
    const foreground = source("assets/brand/wooriai-foreground.svg");
    const monochrome = source("assets/brand/wooriai-monochrome.svg");
    const notification = source("assets/brand/wooriai-notification.svg");
    const lockup = source("assets/brand/wooriai-lockup.svg");
    const generator = source("../../scripts/generate-brand-assets.ts");

    expect(mark).toContain("우리아이 스프라우트 월렛 공식 로고");
    expect(mark).toContain("#17324D");
    expect(mark).toContain("#FF6B4A");
    expect(mark).toContain("#FFD76A");
    expect(source("src/theme.ts")).toContain('navy: "#17324D"');
    expect(source("app/(auth)/login.tsx")).toContain("logo_lockup.png");
    expect(foreground).toContain("우리아이 스프라우트 월렛 투명 전경");
    expect(monochrome).toContain("우리아이 스프라우트 월렛 단색 로고");
    expect(notification).toContain("우리아이 스프라우트 월렛 알림 로고");
    expect(lockup).toContain("우리아이 스프라우트 월렛 공식 가로형 로고");
    expect(lockup).toContain(">우리아이</text>");
    expect(generator).toContain('input: "wooriai-lockup.svg"');
    expect(generator).not.toContain("wooriai-portal-master.png");
    for (const asset of [mark, foreground, monochrome, notification, lockup]) {
      expect(asset).not.toMatch(/포털|linearGradient|#5B43E6|#52C7FF|#4937C8/);
    }
  });

  it("keeps the five product tabs visible and exposes the more hub", () => {
    const tabsSource = source("app/(tabs)/_layout.tsx");

    expect(tabsSource).toContain('items: { title: "준비템"');
    expect(tabsSource).toContain('more: { title: "더보기"');
    expect(tabsSource).toContain('name="more" options={{ title: tabs.more.title');
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

  it("requires screen evidence before accepting sparse white Android screens", () => {
    const pixelGateSource = source("../../scripts/pixel-lock/android-pixel-lock.ts");
    expect(pixelGateSource).toContain("isLikelyBlankOrShell(metrics, sentinelsFound.length > 0)");
  });

  it("prewarms the native runtime and waits for the tab bar to settle before taking Android evidence", () => {
    const pixelGateSource = source("../../scripts/pixel-lock/android-pixel-lock.ts");
    expect(pixelGateSource).toContain("process.env.PIXEL_ANDROID_SETTLE_MS || 5000");
    expect(pixelGateSource).toContain('openScreen("HOME-001", screens, { coldStart: true })');
    expect(pixelGateSource).toContain('const coldStart = process.env.PIXEL_ANDROID_COLD_EACH === "1"');
  });

  it("installs and verifies the source-bound Pixel APK before a full Android gate", () => {
    const pixelGateSource = source("../../scripts/pixel-lock/android-pixel-lock.ts");
    expect(pixelGateSource).toContain('join(reportDir, "pixel-apk.json")');
    expect(pixelGateSource).toContain('adb(["install", "-r", apkPath])');
    expect(pixelGateSource).toContain('adb(["shell", "pm", "clear", packageName])');
    expect(pixelGateSource).toContain('adbText(["shell", "sha256sum", installedApkPath])');
    expect(pixelGateSource).toContain("apkEvidence: latestPixelApkEvidence");
    expect(pixelGateSource).toContain("Installed base SHA-256");
    expect(pixelGateSource).toContain('if (["android", "all"].includes(command))');
  });

  it("diffs the latest capture against evidence saved for the same screen", () => {
    const pixelGateSource = source("../../scripts/pixel-lock/android-pixel-lock.ts");
    expect(pixelGateSource).toContain("validateRender(screenId, screenshotPath, false)");
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
    expect(pixelGateSource).toContain("isEvidenceCurrentForScreenshot");
    expect(pixelGateSource).toContain("readCurrentEvidence(xmlPath)");
    expect(pixelGateSource).toContain("readCurrentEvidence(logcatPath)");
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
    expect(expenseSource).toContain('disabled={saveExpense.isPending || hasSaved || isSaveInvalid}');
    expect(expenseSource).toContain("validateExpenseForm({ itemName, amountText, spentOn: expenseDate.iso })");
  });

  it("keeps expense editing aligned with native date and vector category controls", () => {
    const expenseEditSource = source("app/expenses/[expenseId].tsx");

    expect(expenseEditSource).toContain("DateTimePickerAndroid.open");
    expect(expenseEditSource).toContain('accessibilityLabel="지출 품목명"');
    expect(expenseEditSource).toContain('accessibilityLabel="지출 금액"');
    expect(expenseEditSource).toContain("icon={category.icon as AppIconName}");
    expect(expenseEditSource).toContain("label={category.label}");
    expect(expenseEditSource).not.toContain("`${category.icon} ${category.label}`");
    expect(expenseEditSource).not.toContain('placeholder="YYYY-MM-DD"');
  });

  it("uses labeled native date review fields for receipt and preparation workflows", () => {
    const receiptSource = source("app/receipts/new.tsx");
    const itemDetailSource = source("src/preparation/Release4ItemDetailScreen.tsx");

    expect(receiptSource).toContain("validateExpenseForm({ itemName, amountText: amount, spentOn })");
    expect(receiptSource).toContain('<DateField clearable={false}');
    expect(receiptSource).toContain('<FormField error={receiptValidation.itemNameError} label="지출 항목"');
    expect(receiptSource).toContain('accessibilityRole="radiogroup"');
    expect(receiptSource).not.toContain('placeholder="YYYY-MM-DD"');
    expect(itemDetailSource.match(/<DateField label=/g)).toHaveLength(4);
    expect(itemDetailSource).not.toContain("준비 예정일 YYYY-MM-DD");
    expect(itemDetailSource).not.toContain("실제 구매일 YYYY-MM-DD");
    expect(itemDetailSource).not.toContain("교체 예정일 YYYY-MM-DD");
  });

  it("reveals the saved expense category when its chip starts outside the viewport", () => {
    const expenseEditSource = source("app/expenses/[expenseId].tsx");
    const sharedUiSource = source("src/ui.tsx");

    expect(expenseEditSource).toContain("ref={categoryScrollRef}");
    expect(expenseEditSource).toContain("categoryChipXById.current[category.id] = event.nativeEvent.layout.x");
    expect(expenseEditSource).toContain("if (category.id === categoryId) revealSelectedCategory(category.id)");
    expect(expenseEditSource).toContain("categoryScrollRef.current?.scrollTo({");
    expect(expenseEditSource).toContain("x: Math.max(0, chipX - theme.spacing.card)");
    expect(sharedUiSource).toContain("onLayout={onLayout}");
  });
});
