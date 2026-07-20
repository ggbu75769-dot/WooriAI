import { describe, expect, it } from "vitest";
import { release4BundleDefinitions, release4CatalogItems } from "./release4-catalog";

describe("Release 4 catalog bundles", () => {
  it("uses explicit canonical item membership for every bundle", () => {
    const canonicalNames = new Set(release4CatalogItems.map((item) => item.nameKo));
    const canonicalCodes = new Set(release4CatalogItems.map((item) => item.code));
    expect(release4BundleDefinitions.length).toBeGreaterThanOrEqual(15);
    expect(new Set(release4BundleDefinitions.map((bundle) => bundle.nameKo)).size).toBe(release4BundleDefinitions.length);
    for (const bundle of release4BundleDefinitions) {
      expect(bundle.itemNames.length).toBeGreaterThanOrEqual(5);
      expect(new Set(bundle.itemNames).size).toBe(bundle.itemNames.length);
      expect(bundle.itemNames.every((name) => canonicalNames.has(name))).toBe(true);
      expect(bundle.itemCodes).toHaveLength(bundle.itemNames.length);
      expect(bundle.itemCodes.every((code) => canonicalCodes.has(code))).toBe(true);
    }
  });

  it("keeps the required daily-use scenarios semantically anchored", () => {
    const byName = new Map(release4BundleDefinitions.map((bundle) => [bundle.nameKo, bundle.itemNames]));
    expect(byName.get("출산 입원 가방")).toContain("출산 입원 가방");
    expect(byName.get("자동차 이동")).toContain("신생아용 카시트");
    expect(byName.get("이유식 시작")).toContain("이유식 조리 냄비");
    expect(byName.get("응급·재난 대비")).toContain("가정용 응급 처치함");
    expect(byName.get("유치원·학교 입학")).toContain("학교 준비물 파일");
  });
});
