import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Round 5A 리디자인으로 기준 교체 -- QA-101 재측정 필요.
// (docs/5차/round5a-design-spec.md 구현 순서·회귀 규칙: "이 리디자인은 기준 이미지 자체를 의도적으로
// 교체하는 작업 -- ui-pixel-lock-flow 계약 테스트는 새 토큰 기준으로 갱신"). The mainCoral assertion
// below was updated from the pre-Round-5A "#FF6B52" to the D0 coral token; the original QA-101
// reference screenshots/pixel-lock captures were taken against the old value and need to be
// recaptured against the new token set.
//
// DSN-053 P1: mainCoral은 이제 승인 캡처(c20deeb)의 coral[600] "#C94627"이다. Round 5A가
// coral[500] "#EF6644"로 옮겨 둔 것이 캡처와 어긋나 있었다.
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

    expect(theme.colors.mainCoral).toBe("#C94627");
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
      // DSN-053 P1: 캡처에 실제로 찍혀 있는 문자열은 "38,500원"이다(승인 원본 c20deeb 기준).
      ["app/expenses/new.tsx", "38,500원"],
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

  it("keeps product detail screen IDs locatable via testID without rendering the source-lock eyebrow", () => {
    const productDetailSource = readFileSync(join(mobileRoot, "app/items/[itemTemplateId].tsx"), "utf8");
    expect(productDetailSource).toContain("productDetailScreenId");
    // A11Y-115: the screen ID rides on testID (tooling-only) -- accessibilityLabel would make
    // TalkBack read the internal ID out loud, which the a11y contract now forbids.
    expect(productDetailSource).toContain("testID={productDetailScreenId}");
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
    expect(reportSource).toContain("testID={reportReferenceScreenId}");
    expect(reportSource).not.toContain("ReportPixelStatusBar");
    expect(reportSource).toContain("reportReferenceHeaderStyle");
    // PIX-133: 보정 오프셋(-16/-4)은 캡처 빌드에서만 적용된다 — 실기기에서 리포트 탭이
    // 왼쪽·위로 밀려 보이던 결함의 원인. 캡처 경로 값(-16/-4)과 실사용 항등(0) 게이트를
    // 둘 다 고정한다.
    expect(reportSource).toContain('reportReferenceHorizontalOffset = isPixelLockCalibration ? -16 : 0');
    expect(reportSource).toContain('reportReferenceVerticalOffset = isPixelLockCalibration ? -4 : 0');
    expect(reportSource).toContain('isPixelLockCalibration = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1"');
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
      // DSN-053 P1 §8: 스플래시 마크는 승인 캡처대로 splash-mark(캡처 경로는 pixel-splash-mark)다.
      // 예전에는 illustrations/logo_mark.png를 정사각 박스에 cover로 채워 좌우를 자르고 있었다.
      "splash-mark.png",
      "pixel-splash-mark.png",
      "growth_logo.png",
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
    expect(launchSource).toContain("testID={splashScreenId}");
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

  /**
   * SPL-001 실기기 잘림 수정: 기준 이미지에 맞춘 고정 박스(390 폭 · paddingTop 112 ·
   * translateY/scale 보정 · logo cover)는 **픽셀 락 경로 전용**이다. 일반 실행은 화면
   * 폭/높이에 맞춰 줄어드는 박스를 쓴다 -- 폭 390dp 미만 기기에서 첫 화면이 잘려 보였다.
   *
   * 이 테스트가 고정하는 것은 "픽셀 락 값이 픽셀 락 분기 안에 그대로 있다"는 사실이다.
   * 값 자체(390 / 112 / topOffset / groupScale / introImageMarginTop)는 불변이므로
   * `?pixelLock=1` 캡처 결과는 예전과 동일하게 유지된다.
   */
  it("keeps the SPL-001 fixed reference box inside the pixel-lock branch and renders responsively otherwise", () => {
    const launchSource = readFileSync(join(mobileRoot, "app/launch-animation.tsx"), "utf8");

    const introBlock = launchSource.slice(
      launchSource.indexOf("function introImageStyle("),
      launchSource.indexOf("function splashPixelFrameStyle(")
    );
    expect(introBlock).toContain("if (isPixelLockMode) {");
    // 픽셀 락 가지: 예전 고정 박스 그대로.
    const pixelLockIntroBranch = introBlock.slice(introBlock.indexOf("if (isPixelLockMode) {"), introBlock.indexOf("const availableWidth"));
    expect(pixelLockIntroBranch).toContain("height: SplashPixelStyles.introImageHeight");
    expect(pixelLockIntroBranch).toContain("marginTop: SplashPixelStyles.introImageMarginTop");
    expect(pixelLockIntroBranch).toContain("width: 390");
    // 일반 가지: 창 크기에서 계산한다(고정 폭 없음).
    expect(introBlock).toContain("windowWidth - splashHorizontalPadding");
    expect(introBlock).toContain("introImageMaxHeightRatio");
    expect(introBlock).toContain("Math.min(introImageMaxWidth, availableWidth, heightCappedWidth)");

    // 프레임 보정(translateY/scale)과 112 상단 여백도 픽셀 락 전용이다.
    const frameBlock = launchSource.slice(
      launchSource.indexOf("function splashPixelFrameStyle("),
      launchSource.indexOf("export default function LaunchAnimationScreen")
    );
    expect(frameBlock).toContain("if (!isPixelLockMode) return null;");
    expect(frameBlock).toContain("paddingTop: 112");
    expect(frameBlock).toContain("translateY: SplashPixelStyles.topOffset");
    expect(frameBlock).toContain("scale: SplashPixelStyles.groupScale");

    // 호출부는 모드를 넘긴다 + 로고 잘림(cover)도 캡처 경로에만 남는다.
    expect(launchSource).toContain("splashPixelFrameStyle(isPixelLockMode)");
    expect(launchSource).toContain("introImageStyle(isPixelLockMode, windowWidth, windowHeight)");
    // DSN-053 P1 §8: 로고는 두 경로 모두 contain이다. 잘림(cover)은 캡처 전용 예외가 아니라
    // 마크를 정사각 박스에 억지로 채우던 것이었고, 캡처 경로는 이제 전용 파일을 쓴다.
    expect(launchSource).toContain('source={isPixelLockMode ? pixelSplashLogo : splashLogo}');
    expect(launchSource).toContain('resizeMode="contain"');
    expect(launchSource).not.toContain('resizeMode={isPixelLockMode ? "cover" : "contain"}');
    expect(launchSource).toContain("useWindowDimensions()");
    // 일반 실행 경로에는 고정 폭/여백이 남아 있지 않다.
    expect(launchSource).not.toContain("paddingTop: 112 }, splashPixelFrameStyle()");
  });
});
