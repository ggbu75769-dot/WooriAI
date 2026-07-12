import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");
const mobileRoot = process.cwd();

describe("UI Pixel Lock source contract", () => {
  it("records the reference-image analysis artifacts required before visual implementation", () => {
    const requiredArtifacts = [
      "docs/ui-pixel-lock/reference-analysis.md",
      "docs/ui-pixel-lock/reference-crop-map.json",
      "docs/ui-pixel-lock/asset-extraction-report.md",
      "docs/ui-pixel-lock/visual-qa-report.md",
      "docs/ui-pixel-lock/mismatch-log.md"
    ];

    for (const relativePath of requiredArtifacts) {
      const filePath = join(repoRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
    }
  });

  it("uses the image-locked visual navigation labels while preserving existing route modules", () => {
    const layoutSource = readFileSync(join(mobileRoot, "app/(tabs)/_layout.tsx"), "utf8");

    for (const expectedLabel of ["홈", "기록", "준비템", "리포트", "더보기"]) {
      expect(layoutSource).toContain(expectedLabel);
    }

    for (const expectedRoute of ['name="index"', 'name="records"', 'name="items"', 'name="reports"', 'name="more"']) {
      expect(layoutSource).toContain(expectedRoute);
    }
  });

  it("exposes reusable pixel-lock tokens and component primitives instead of one-off card styles", async () => {
    const { theme } = await import("./theme");
    const uiSource = readFileSync(join(mobileRoot, "src/ui.tsx"), "utf8");

    expect(theme.colors.mainCoral).toBe("#FF6B52");
    expect(theme.radii.card).toBeGreaterThanOrEqual(20);
    expect(uiSource).toContain("AppScreen");
    expect(uiSource).toContain("PrimaryButton");
    expect(uiSource).toContain("HeroSummaryCard");
    expect(uiSource).toContain("BottomSheetFrame");
    expect(uiSource).toContain("showHandle = true");
    expect(uiSource).toContain("style?: StyleProp<ViewStyle>");
    expect(uiSource).toContain("AffiliateDisclosure");
    expect(uiSource).toContain("onChange?: (option: string) => void");
    expect(uiSource).toContain("onPress={() => onChange?.(option)}");
    expect(uiSource).toContain("lineChartPoints");
    expect(uiSource).toContain("lineChartSegments");
    expect(uiSource).toContain("reportCategoryLegend");
    expect(uiSource).toContain("donutSegmentPalette");
    expect(uiSource).not.toContain("[18, 26, 22, 34, 30, 42, 50].map");
    expect(uiSource).toContain("ensurePixelLockWebStyles");
    expect(uiSource).toContain("::-webkit-scrollbar");
    expect(uiSource).toContain("scrollbarWidth");
    expect(uiSource).toContain("showsVerticalScrollIndicator={false}");
  });

  it("migrates the primary mobile surfaces onto the pixel-lock component set", () => {
    const surfaceExpectations = [
      ["app/(tabs)/index.tsx", "HeroSummaryCard"],
      ["app/(tabs)/index.tsx", "QuickActionIconButton"],
      ["app/(tabs)/index.tsx", "FloatingActionButton"],
      ["app/(tabs)/index.tsx", "previewHome"],
      ["app/(tabs)/index.tsx", "1_245_700"],
      ["app/expenses/new.tsx", "BottomSheetFrame"],
      ["app/expenses/new.tsx", "showHandle={false}"],
      ["app/expenses/new.tsx", "quickExpenseCategories"],
      ["app/expenses/new.tsx", "QuickExpensePixelStyles.scale"],
      ["app/expenses/new.tsx", "QuickExpensePixelStyles.horizontalOffset"],
      ["app/expenses/new.tsx", "QuickExpensePixelStyles.topOffset"],
      ["app/expenses/new.tsx", "quickExpensePixelFrameStyle"],
      ["app/expenses/new.tsx", "₩ 38,500"],
      ["app/expenses/new.tsx", "formatExpenseDate(today)"],
      ["app/(tabs)/items.tsx", "ProductCard"],
      ["app/(tabs)/items.tsx", "CategoryChip"],
      ["app/(tabs)/items.tsx", "recommendationBabyCarrierImage"],
      ["app/(tabs)/items.tsx", "recommendationDiaperImage"],
      ["app/(tabs)/items.tsx", "recommendationBlocksImage"],
      ["app/(tabs)/items.tsx", "recommendationHorizontalOffset = 0"],
      ["app/(tabs)/items.tsx", "recommendationVerticalOffset = 0"],
      ["app/(tabs)/items.tsx", "ItemListPixelStyles.scale"],
      ["app/(tabs)/items.tsx", "ItemListPixelStyles.horizontalOffset"],
      ["app/(tabs)/items.tsx", "ItemListPixelStyles.topOffset"],
      ["app/(tabs)/items.tsx", "recommendationPixelScaleFrameStyle"],
      ["app/(tabs)/items.tsx", "recommendationPixelFrameStyle"],
      ["app/items/[itemTemplateId].tsx", "ProductComparisonRow"],
      ["app/items/[itemTemplateId].tsx", "AffiliateDisclosure"],
      ["app/items/[itemTemplateId].tsx", "product_diaper_pack.png"],
      ["app/items/[itemTemplateId].tsx", "우리아이몰"],
      ["app/items/[itemTemplateId].tsx", "네이처 공식몰"],
      ["app/items/[itemTemplateId].tsx", "쿠팡"],
      ["app/(tabs)/reports.tsx", "SegmentedControl"],
      ["app/(tabs)/reports.tsx", "LineChartCard"],
      ["app/(tabs)/reports.tsx", "DonutChartCard"],
      ["app/family/index.tsx", "FamilyPixelStyles.scale"],
      ["app/family/index.tsx", "FamilyPixelStyles.horizontalOffset"],
      ["app/family/index.tsx", "FamilyPixelStyles.topOffset"],
      ["app/family/index.tsx", "familyReferenceFrameStyle"],
      ["app/family/index.tsx", "familyInviteRows"],
      ["app/family/index.tsx", "FamilyInviteRow"]
    ];

    for (const [relativePath, expectedText] of surfaceExpectations) {
      const filePath = join(mobileRoot, relativePath);
      expect(readFileSync(filePath, "utf8")).toContain(expectedText);
    }

    const familyPixelStyleSource = readFileSync(join(mobileRoot, "src/pixelLock/styles/FamilyPixelStyles.ts"), "utf8");
    expect(familyPixelStyleSource).toContain('return pixelNumber("FAM-001", "scale", 1)');
    expect(familyPixelStyleSource).toContain('return pixelNumber("FAM-001", "topOffset", 0)');

    const itemListPixelStyleSource = readFileSync(join(mobileRoot, "src/pixelLock/styles/ItemListPixelStyles.ts"), "utf8");
    expect(itemListPixelStyleSource).toContain('return pixelNumber("ITEM-001", "scale", 1)');
    expect(itemListPixelStyleSource).toContain('return pixelNumber("ITEM-001", "topOffset", 0)');
    expect(itemListPixelStyleSource).toContain('return pixelNumber("ITEM-001", "horizontalOffset", 0)');

    for (const asset of ["recommendation_baby_carrier.png", "recommendation_diaper.png", "recommendation_blocks.png"]) {
      expect(existsSync(join(mobileRoot, "assets/illustrations", asset)), `${asset} should exist`).toBe(true);
    }
  });

  it("keeps the home first viewport compact without an extra recommendation product card", () => {
    const homeSource = readFileSync(join(mobileRoot, "app/(tabs)/index.tsx"), "utf8");

    expect(homeSource).toContain("homeBudgetNudgeStyle");
    expect(homeSource).toContain("homeBudgetNudgeArrowStyle");
    expect(homeSource).toContain("HomePixelStyles.horizontalOffset");
    expect(homeSource).toContain("HomePixelStyles.topOffset");
    expect(homeSource).toContain("HomePixelStyles.scale");
    expect(homeSource).toContain("HomePixelStyles.scaleX");
    expect(homeSource).toContain("HomePixelStyles.scaleHorizontalOffset");
    expect(homeSource).toContain("HomePixelStyles.scaleVerticalOffset");
    expect(homeSource).toContain("homePixelScaleFrameStyle");
    expect(homeSource).toContain("homePixelFrameStyle");
    expect(homeSource).toContain('router.push("/(tabs)/items")');
    expect(homeSource).not.toContain("ProductCard");
    expect(homeSource).not.toContain("toddlerImage");

    const homePixelStyleSource = readFileSync(join(mobileRoot, "src/pixelLock/styles/HomePixelStyles.ts"), "utf8");
    expect(homePixelStyleSource).toContain('return pixelNumber("HOME-001", "scale", 1)');
    expect(homePixelStyleSource).toContain('return pixelNumber("HOME-001", "topOffset", 0)');
    expect(homePixelStyleSource).toContain('return pixelNumber("HOME-001", "horizontalOffset", 0)');
  });

  it("locks the quick expense category picker to the reference icon grid", () => {
    const quickExpenseSource = readFileSync(join(mobileRoot, "app/expenses/new.tsx"), "utf8");
    const cropMap = JSON.parse(readFileSync(join(repoRoot, "docs/ui-pixel-lock/reference-crop-map.json"), "utf8"));
    const quickExpenseCrop = cropMap.crops.find((crop: { id: string }) => crop.id === "1_png_quick_expense");

    expect(quickExpenseSource).not.toContain("QuickExpenseStatusBar");
    expect(quickExpenseSource).not.toContain("QuickExpenseAdjacentPreview");
    expect(quickExpenseSource).not.toContain("quickExpenseStatusBarStyle");
    expect(quickExpenseSource).not.toContain("quickExpenseAdjacentPreviewStyle");
    expect(quickExpenseSource).not.toContain("9:41");
    expect(quickExpenseSource).toContain("ExpenseCategoryIconButton");
    expect(quickExpenseSource).toContain("quickExpenseCategoryGridStyle");
    expect(quickExpenseSource).toContain("quickExpenseCategoryTileStyle");
    expect(quickExpenseCrop).toMatchObject({ x: 790, y: 222, width: 230, height: 600 });

    const quickExpensePixelStyleSource = readFileSync(join(mobileRoot, "src/pixelLock/styles/QuickExpensePixelStyles.ts"), "utf8");
    expect(quickExpensePixelStyleSource).toContain('return pixelNumber("EXP-001", "scale", 1)');
    expect(quickExpensePixelStyleSource).toContain('return pixelNumber("EXP-001", "topOffset", 0)');
    expect(quickExpensePixelStyleSource).toContain('return pixelNumber("EXP-001", "horizontalOffset", 0)');

    // Category labels are the single source of truth in src/categories.ts (the catalog
    // feeding new.tsx's picker), so assert against that file, not new.tsx comments.
    const categoryCatalogSource = readFileSync(join(mobileRoot, "src/categories.ts"), "utf8");
    for (const expectedCategory of ["기저귀", "분유/유제품", "식비", "의류", "약품/교통", "병원/약", "교육/도서", "기타"]) {
      expect(categoryCatalogSource).toContain(expectedCategory);
    }
  });

  it("keeps product detail screen IDs accessible without rendering the source-lock eyebrow", () => {
    const productDetailSource = readFileSync(join(mobileRoot, "app/items/[itemTemplateId].tsx"), "utf8");
    expect(productDetailSource).toContain("productDetailScreenId");
    expect(productDetailSource).toContain("accessibilityLabel={productDetailScreenId}");
    expect(productDetailSource).toContain("productDetailHeaderSpacerStyle");
    expect(productDetailSource).toContain("productDetailHeaderSpacerStyle = { minHeight: 0 }");
    expect(productDetailSource).toContain("productDetailViewportOffset = 8");
    expect(productDetailSource).toContain("ProductDetailPixelStyles.horizontalOffset");
    expect(productDetailSource).toContain("ProductDetailPixelStyles.scale");
    expect(productDetailSource).toContain("ProductDetailPixelStyles.scaleX");
    expect(productDetailSource).toContain("ProductDetailPixelStyles.topOffset");
    expect(productDetailSource).toContain("productDetailReferenceScaleFrameStyle");
    expect(productDetailSource).toContain("productDetailFrameStyle");
    expect(productDetailSource).toContain("productDetailHeroCardStyle");
    expect(productDetailSource).toContain('borderColor: "transparent"');
    expect(productDetailSource).toContain('boxShadow: "none"');
    expect(productDetailSource).toContain("productDetailInfoCardStyle");
    expect(productDetailSource).toContain("marginTop: -8");

    const productDetailStyleSource = readFileSync(join(mobileRoot, "src/pixelLock/styles/ProductDetailPixelStyles.ts"), "utf8");
    expect(productDetailStyleSource).toContain('return pixelNumber("ITEM-002", "scale", 1)');
    expect(productDetailStyleSource).toContain('return pixelNumber("ITEM-002", "scaleX", 1)');
    expect(productDetailStyleSource).toContain('return pixelNumber("ITEM-002", "topOffset", 0)');
    expect(productDetailStyleSource).toContain('return pixelNumber("ITEM-002", "horizontalOffset", 0)');
    expect(productDetailSource).not.toContain("productDetailStatusBarStyle");
    expect(productDetailSource).toContain("productDetailFloatingControlsStyle");
    expect(productDetailSource).toContain("ProductDetailNavigation");
    expect(productDetailSource).not.toContain('ScreenHeader eyebrow="ITEM-002');
  });

  it("locks the report route to the reference-detail first viewport", () => {
    const reportSource = readFileSync(join(mobileRoot, "app/(tabs)/reports.tsx"), "utf8");

    expect(reportSource).toContain("reportReferenceScreenId");
    expect(reportSource).toContain("accessibilityLabel={reportReferenceScreenId}");
    expect(reportSource).not.toContain("ReportPixelStatusBar");
    expect(reportSource).toContain("reportReferenceHeaderStyle");
    expect(reportSource).toContain("reportReferenceHorizontalOffset = -16");
    expect(reportSource).toContain("reportReferenceVerticalOffset = -4");
    expect(reportSource).toContain("ReportPixelStyles.scale");
    expect(reportSource).toContain("ReportPixelStyles.horizontalOffset");
    expect(reportSource).toContain("ReportPixelStyles.topOffset");
    expect(reportSource).toContain("reportReferenceScaleFrameStyle");
    expect(reportSource).toContain("reportReferencePeriodRowStyle");
    expect(reportSource).toContain("previewReportTotalKrw");
    expect(reportSource).toContain("onChange={setPeriod}");
    expect(reportSource).toContain("reportMonthLabel");
    expect(reportSource).toContain("getMonthlyReport(authToken!, childId!, reportYearMonth)");
    expect(reportSource).toContain("LineChartCard");
    expect(reportSource).toContain("DonutChartCard");
    expect(reportSource).not.toContain('ScreenHeader eyebrow="REP-001');
    expect(reportSource).not.toContain('["월간", "분기", "연간"].map');

    const reportPixelStyleSource = readFileSync(join(mobileRoot, "src/pixelLock/styles/ReportPixelStyles.ts"), "utf8");
    expect(reportPixelStyleSource).toContain('return pixelNumber("REP-001", "scale", 1)');
    expect(reportPixelStyleSource).toContain('return pixelNumber("REP-001", "topOffset", 0)');
    expect(reportPixelStyleSource).toContain('return pixelNumber("REP-001", "horizontalOffset", 0)');
  });

  it("locks the excel import route to the reference preview-before-save surface", () => {
    const importSource = readFileSync(join(mobileRoot, "app/import/index.tsx"), "utf8");

    expect(importSource).toContain("excelPreviewRows");
    expect(importSource).toContain("ImportPreviewCategoryRow");
    expect(importSource).toContain("excelUploadedFileCardStyle");
    expect(importSource).toContain("ExcelPreviewPixelStyles.scale");
    expect(importSource).toContain("ExcelPreviewPixelStyles.scaleY");
    expect(importSource).toContain("ExcelPreviewPixelStyles.horizontalOffset");
    expect(importSource).toContain("ExcelPreviewPixelStyles.topOffset");
    expect(importSource).toContain("excelPreviewPixelFrameStyle");
    expect(importSource).toContain("AI 분류 미리보기");
    expect(importSource).toContain("적용하고 리포트 보기");
    expect(importSource).toContain("createExcelImport");
    expect(importSource).toContain("승인하기 전까지는 지출로 저장되지 않아요");

    const excelPixelStyleSource = readFileSync(join(mobileRoot, "src/pixelLock/styles/ExcelPreviewPixelStyles.ts"), "utf8");
    expect(excelPixelStyleSource).toContain('return pixelNumber("IMP-003", "scale", 1)');
    expect(excelPixelStyleSource).toContain('return pixelNumber("IMP-003", "scaleY", 1)');
    expect(excelPixelStyleSource).toContain('return pixelNumber("IMP-003", "horizontalOffset", 0)');
    expect(excelPixelStyleSource).toContain('return pixelNumber("IMP-003", "ctaBottomInset", 56)');
  });

  it("locks the more route to the compact single-screen reference menu", () => {
    const moreSource = readFileSync(join(mobileRoot, "app/(tabs)/more.tsx"), "utf8");

    expect(moreSource).toContain("moreReferenceScreenId");
    expect(moreSource).not.toContain("MorePixelStatusBar");
    expect(moreSource).toContain("moreMenuRows");
    expect(moreSource).toContain("MoreMenuRow");
    expect(moreSource).toContain("moreReferenceFrameStyle");
    expect(moreSource).toContain("moreProfileCardStyle");
    expect(moreSource).not.toContain("ScreenHeader");
    expect(moreSource).not.toContain("PrimaryButton");
  });

  it("provides a launch growth animation route with real stage assets and skip flow", () => {
    const launchSource = readFileSync(join(mobileRoot, "app/launch-animation.tsx"), "utf8");

    for (const expectedText of [
      "SPL-001",
      "Animated",
      "family.png",
      "logo_mark.png",
      "intro",
      "animationStages",
      "growth_fetus.png",
      "growth_baby.png",
      "growth_toddler.png",
      "건너뛰기"
    ]) {
      expect(launchSource).toContain(expectedText);
    }

    expect(launchSource).toContain("splashScreenId");
    expect(launchSource).toContain("introHoldMs");
    expect(launchSource).toContain("introImageStyle");
    expect(launchSource).toContain("SplashPixelStyles.groupScale");
    expect(launchSource).toContain("SplashPixelStyles.topOffset");
    expect(launchSource).toContain("splashPixelFrameStyle");
    expect(launchSource).toContain("paddingTop: 112");
    expect(launchSource).toContain("SplashPixelStyles.introImageMarginTop");
    expect(launchSource).toContain("stageIndex < 0 ? introHoldMs");
    expect(launchSource).toContain("accessibilityLabel={splashScreenId}");
    expect(launchSource).not.toContain(">SPL-001</Text>");
    expect(launchSource).not.toContain("<BrandLogo");

    const splashPixelStyleSource = readFileSync(join(mobileRoot, "src/pixelLock/styles/SplashPixelStyles.ts"), "utf8");
    expect(splashPixelStyleSource).toContain('return pixelNumber("SPL-001", "groupScale", 1)');
    expect(splashPixelStyleSource).toContain('return pixelNumber("SPL-001", "topOffset", -40)');
    expect(splashPixelStyleSource).toContain('return pixelNumber("SPL-001", "introImageMarginTop", 56)');

    for (const asset of ["growth_fetus.png", "growth_baby.png", "growth_toddler.png", "growth_elementary.png", "growth_middle.png", "growth_high.png"]) {
      expect(existsSync(join(mobileRoot, "assets/illustrations", asset)), `${asset} should exist`).toBe(true);
    }
  });
});
