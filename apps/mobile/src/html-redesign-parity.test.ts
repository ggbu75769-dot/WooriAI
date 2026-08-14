import { readFileSync } from "node:fs";
import { join } from "node:path";
import glyphMap from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json";
import { release4CatalogItems } from "@wooriai/domain";
import { describe, expect, it } from "vitest";
import { htmlPreparationItemVisuals, resolvePreparationItemVisual } from "./preparation/item-visuals";
import { preparationDisplayGroupIds, resolvePreparationDisplayGroupId } from "./preparation/preparation-grouping";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("standalone HTML redesign parity", () => {
  it("locks the attached ITEM-001 HTML hash, viewport, and no-background boundary", () => {
    const manifest = JSON.parse(source("../../docs/ui-pixel-lock/item-001-html-reference.json"));
    expect(manifest).toMatchObject({
      screenId: "ITEM-001",
      sourceSha256: "2198D0452E73E00303FC03584D403486DD792BA2CF29626EFC49A440EB7ACC6F",
      viewport: { width: 390, height: 820 },
      parityScope: "app bar through missing-item report"
    });
    expect(manifest.renderingRule).toContain("real React Native components only");
  });

  it("uses five outlined and filled bottom-navigation icon pairs", () => {
    const layout = source("app/(tabs)/_layout.tsx");
    expect(layout).toContain('items: { title: "준비템", outline: "basket-outline", filled: "basket" }');
    expect(layout).toContain('reports: { title: "리포트", outline: "chart-box-outline", filled: "chart-box" }');
    expect(layout).toContain('more: { title: "더보기", outline: "dots-horizontal-circle-outline", filled: "dots-horizontal-circle" }');
    expect(layout).toContain('<Tabs.Screen name="more" options={{ title: tabs.more.title');
  });

  it("splits preparation into ten categories, hides sparse groups, and groups timing into accordions", () => {
    const preparation = source("src/preparation/PreparationListParity.tsx");
    for (const label of ["건강·진료", "의류·착용", "편안함·회복", "위생·목욕", "입원·출산", "수유·이유식", "수면·공간", "기저귀·생활", "외출·놀이·교육", "가족·기록"]) {
      expect(preparation).toContain(`name: "${label}"`);
    }
    expect(preparation).toContain("toggleTimingBand");
    expect(preparation).toContain(".filter((band) => band.items.length >= INITIAL_GROUP_LIMIT)");
    expect(preparation).toContain("accessibilityState={{ expanded }}");
    expect(preparation).toContain("nextPreparationGroupLimit");
  });

  it("assigns every catalog domain to exactly one of the ten preparation groups", () => {
    expect(preparationDisplayGroupIds).toHaveLength(10);
    expect(new Set(preparationDisplayGroupIds)).toHaveLength(10);
    for (let domain = 1; domain <= 24; domain += 1) {
      const code = `R4-C${String(domain).padStart(2, "0")}-001`;
      expect(preparationDisplayGroupIds).toContain(resolvePreparationDisplayGroupId({ code, nameKo: "실물 준비품" }));
    }
    expect(resolvePreparationDisplayGroupId({ code: "R4-C05-003", nameKo: "퇴원 이동 계획표" })).toBe("family_records");
    expect(resolvePreparationDisplayGroupId({ code: "R4-C12-007", nameKo: "아기 손톱 파일" })).toBe("health_care");
  });

  it("keeps the nine preparation-card glyphs from the HTML reference", () => {
    expect(htmlPreparationItemVisuals).toEqual([
      ["유모차", "baby-carriage"],
      ["카시트", "car-child-seat"],
      ["젖병", "baby-bottle-outline"],
      ["아기 침대", "bed-outline"],
      ["속싸개", "cradle-outline"],
      ["체온계", "thermometer"],
      ["아기 욕조", "bathtub-outline"],
      ["배냇저고리", "tshirt-crew-outline"],
      ["손수건", "hand-wash-outline"]
    ]);
    expect(new Set(htmlPreparationItemVisuals.map(([, icon]) => icon)).size).toBe(9);
  });

  it("resolves meaningful category icons instead of the generic package fallback", () => {
    for (const [nameKo, icon] of htmlPreparationItemVisuals) {
      expect(resolvePreparationItemVisual({ code: nameKo, nameKo, primaryCategory: null }).icon).toBe(icon);
    }
    expect(resolvePreparationItemVisual({
      code: "C01-BABY-SLEEP-CRIB",
      nameKo: "원목 아기 침대",
      primaryCategory: { code: "C01-SLEEP", iconKey: null, nameKo: "수면·가구" }
    }).icon).toBe("bed-outline");
  });

  it("covers every preparation category shown by the installed fixture without the baby-face fallback", () => {
    const installedFixtureItems = [
      ["계절 의류 보관함", "tshirt-crew-outline"],
      ["기저귀 교환대", "human-baby-changing-table"],
      ["끼우기 놀잇감", "toy-brick-outline"],
      ["낮잠 공간 안내판", "bed-outline"],
      ["목욕용품 건조망", "bathtub-outline"],
      ["물려쓰기 분류 상자", "archive-outline"],
      ["물려쓰기 자산 목록", "clipboard-list-outline"],
      ["밤중 수유 정리함", "baby-bottle-outline"],
      ["배변훈련 팬티", "tshirt-crew-outline"],
      ["분실 방지 이름표", "tag-outline"],
      ["분유 보관 용기", "baby-bottle-outline"],
      ["산후도우미 상담 기록", "account-heart-outline"]
    ] as const;

    for (const [nameKo, icon] of installedFixtureItems) {
      expect(resolvePreparationItemVisual({ code: nameKo, nameKo, primaryCategory: null }).icon).toBe(icon);
    }
  });

  it("gives all 409 extended catalog categories a real glyph and the full pastel palette", () => {
    const visuals = release4CatalogItems.map((item) => resolvePreparationItemVisual({
      code: item.code,
      nameKo: item.nameKo,
      primaryCategory: { code: item.categoryCode, iconKey: null, nameKo: "" }
    }));
    expect(visuals).toHaveLength(409);
    expect(visuals.every(({ icon }) => icon !== "baby-face-outline")).toBe(true);
    expect(new Set(visuals.map(({ icon }) => icon)).size).toBeGreaterThanOrEqual(20);
    expect(new Set(visuals.map(({ iconBackgroundColor }) => iconBackgroundColor)).size).toBeGreaterThanOrEqual(10);
    for (const { icon } of visuals) expect(glyphMap).toHaveProperty(icon);
  });

  it("wires catalog visuals into both the production and pixel preparation cards", () => {
    expect(source("src/preparation/Release4PreparationScreen.tsx")).toContain("PreparationListParity");
    expect(source("app/(tabs)/items.tsx")).toContain("PreparationListParity");
    expect(source("src/preparation/PreparationListParity.tsx")).toContain("resolvePreparationItemVisual");
  });

  it("renders expense rows with category-colored circular icon slots", () => {
    const records = source("app/(tabs)/records.tsx");
    const home = source("app/(tabs)/index.tsx");
    const primitives = source("src/design-system/components/ApplicationPrimitives.tsx");
    expect(primitives).toContain("iconBackgroundColor");
    expect(primitives).toContain("borderRadius: radius.pill");
    expect(records).toContain("expenseCategoryVisual");
    expect(home).toContain("expenseCategoryVisual");
  });

  it("keeps HTML styling while expanding preparation controls to 48dp touch targets", () => {
    const primitives = source("src/design-system/components/ApplicationPrimitives.tsx");
    const preparation = source("src/preparation/PreparationListParity.tsx");
    const tabs = source("src/pixelLock/styles/BottomTabPixelStyles.ts");
    expect(primitives).toContain("hitSlop={6}");
    expect(primitives).toContain("minHeight: 36");
    expect(preparation).toContain("hitSlop={6}");
    expect(preparation).toContain("minHeight: 48");
    expect(tabs).toContain('"height", 64');
    expect(tabs).toContain('"iconSize", 24');
    expect(tabs).toContain('"labelSize", 11');
  });

  it("renders the HTML child switcher and colorful preparation statuses", () => {
    const core = source("src/design-system/components/CorePrimitives.tsx");
    const items = source("src/design-system/components/ModV1Primitives.tsx");
    expect(core).not.toContain('name="account-child-circle"');
    expect(core).toContain("semanticColors.actionSecondary");
    expect(core).toContain("semanticColors.brandPrimary");
    for (const tone of ["infoSurface", "successSurface", "warningSurface", "reviewSurface"]) {
      expect(items).toContain(`semanticColors.${tone}`);
    }
  });

  it("never returns a blank React tree while persisted startup state hydrates", () => {
    const root = source("app/_layout.tsx");
    const index = source("app/index.tsx");
    expect(root).not.toContain("if (!hydrated) return null;");
    expect(index).not.toContain("if (!hydrated) {\n    return null;");
    expect(index).not.toContain('if (progressFetch === "loading") {\n      return null;');
    expect(root).toContain('title="앱을 준비하고 있어요"');
    expect(index).toContain('title="시작 화면을 준비하고 있어요"');
  });

  it("keeps the Android launch window visible with the real app mark before React mounts", () => {
    const colors = source("android/app/src/main/res/values/colors.xml");
    const styles = source("android/app/src/main/res/values/styles.xml");
    const background = source("android/app/src/main/res/drawable/ic_launcher_background.xml");
    expect(colors).toContain('<color name="splashscreen_background">#FFF9F3</color>');
    expect(styles).toContain('<item name="android:windowBackground">@drawable/ic_launcher_background</item>');
    expect(background).toContain('@drawable/splashscreen_logo');
    expect(background).not.toContain('@drawable/assets_illustrations_logo_mark');
  });
});
