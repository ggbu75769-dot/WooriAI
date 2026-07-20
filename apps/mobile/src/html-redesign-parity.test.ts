import { readFileSync } from "node:fs";
import { join } from "node:path";
import glyphMap from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json";
import { release4CatalogItems } from "@wooriai/domain";
import { describe, expect, it } from "vitest";
import { htmlPreparationItemVisuals, resolvePreparationItemVisual } from "./preparation/item-visuals";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("standalone HTML redesign parity", () => {
  it("uses the exact outlined and filled bottom-navigation icon pairs", () => {
    const layout = source("app/(tabs)/_layout.tsx");
    expect(layout).toContain('items: { title: "준비템", outline: "basket-outline", filled: "basket" }');
    expect(layout).toContain('reports: { title: "리포트", outline: "chart-box-outline", filled: "chart-box" }');
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

  it("gives all 408 extended catalog categories a real glyph and the full pastel palette", () => {
    const visuals = release4CatalogItems.map((item) => resolvePreparationItemVisual({
      code: item.code,
      nameKo: item.nameKo,
      primaryCategory: { code: item.categoryCode, iconKey: null, nameKo: "" }
    }));
    expect(visuals).toHaveLength(408);
    expect(visuals.every(({ icon }) => icon !== "baby-face-outline")).toBe(true);
    expect(new Set(visuals.map(({ icon }) => icon)).size).toBeGreaterThanOrEqual(20);
    expect(new Set(visuals.map(({ iconBackgroundColor }) => iconBackgroundColor)).size).toBeGreaterThanOrEqual(10);
    for (const { icon } of visuals) expect(glyphMap).toHaveProperty(icon);
  });

  it("wires catalog visuals into both the production and pixel preparation cards", () => {
    expect(source("src/preparation/Release4PreparationScreen.tsx")).toContain("resolvePreparationItemVisual");
    expect(source("app/(tabs)/items.tsx")).toContain("resolvePreparationItemVisual");
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

  it("matches the compact 36dp chips and 64dp HTML bottom navigation", () => {
    const primitives = source("src/design-system/components/ApplicationPrimitives.tsx");
    const preparation = source("src/preparation/Release4PreparationScreen.tsx");
    const tabs = source("src/pixelLock/styles/BottomTabPixelStyles.ts");
    expect(primitives).toContain("hitSlop={6}");
    expect(primitives).toContain("minHeight: 36");
    expect(preparation).toContain("hitSlop={6}");
    expect(preparation).toContain("minHeight: 36");
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
    expect(colors).toContain('<color name="splashscreen_background">#FFFDFC</color>');
    expect(styles).toContain('<item name="android:windowBackground">@drawable/ic_launcher_background</item>');
    expect(background).toContain('@drawable/assets_illustrations_logo_mark');
    expect(background).not.toContain('@drawable/splashscreen_logo');
  });
});
