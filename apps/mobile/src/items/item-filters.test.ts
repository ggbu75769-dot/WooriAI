import { describe, expect, it } from "vitest";
import {
  filterItems,
  hasActiveItemFilter,
  itemMatchesNecessity,
  itemMatchesSearch,
  NECESSITY_FILTER_OPTIONS,
  normalizeItemSearchText
} from "./item-filters";

const items = [
  { name: "카시트", necessityLevel: "essential" as const },
  { name: "젖병/소독 세트", necessityLevel: "essential" as const },
  { name: "모빌/백색소음기", necessityLevel: "convenience" as const },
  { name: "태교 일기장", necessityLevel: "optional" as const }
];

describe("NECESSITY_FILTER_OPTIONS", () => {
  it("offers 전체 first, then exactly the three necessity levels in essential -> optional order", () => {
    expect(NECESSITY_FILTER_OPTIONS.map((option) => option.value)).toEqual([
      "all",
      "essential",
      "convenience",
      "optional"
    ]);
    expect(NECESSITY_FILTER_OPTIONS.map((option) => option.label)).toEqual(["전체", "필수", "편의", "선택"]);
  });
});

describe("itemMatchesNecessity", () => {
  it("keeps everything under 전체", () => {
    for (const item of items) {
      expect(itemMatchesNecessity(item, "all")).toBe(true);
    }
  });

  it("keeps only the selected level", () => {
    expect(itemMatchesNecessity(items[0], "essential")).toBe(true);
    expect(itemMatchesNecessity(items[0], "convenience")).toBe(false);
    expect(itemMatchesNecessity(items[2], "convenience")).toBe(true);
    expect(itemMatchesNecessity(items[3], "optional")).toBe(true);
  });
});

describe("itemMatchesSearch", () => {
  it("passes every item when the query is empty", () => {
    expect(itemMatchesSearch(items[0], "")).toBe(true);
  });

  it("matches on a partial name, ignoring case", () => {
    expect(itemMatchesSearch({ name: "Baby 카시트", necessityLevel: "essential" }, "baby")).toBe(true);
    expect(itemMatchesSearch(items[0], "시트")).toBe(true);
    expect(itemMatchesSearch(items[0], "유모차")).toBe(false);
  });
});

describe("normalizeItemSearchText", () => {
  it("trims and lowercases, mirroring the records tab search convention", () => {
    expect(normalizeItemSearchText("  KaSiTeu  ")).toBe("kasiteu");
    expect(normalizeItemSearchText("   ")).toBe("");
  });
});

describe("filterItems", () => {
  it("returns the list untouched (same order, same objects) with no filter applied", () => {
    expect(filterItems(items, { necessity: "all", searchText: "" })).toEqual(items);
  });

  it("applies necessity and search together (AND)", () => {
    expect(filterItems(items, { necessity: "essential", searchText: "세트" }).map((item) => item.name)).toEqual([
      "젖병/소독 세트"
    ]);
    expect(filterItems(items, { necessity: "convenience", searchText: "세트" })).toEqual([]);
  });

  it("preserves the server's recommendation order rather than re-sorting", () => {
    const reversed = [...items].reverse();
    expect(filterItems(reversed, { necessity: "all", searchText: "" }).map((item) => item.name)).toEqual(
      reversed.map((item) => item.name)
    );
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(filterItems(items, { necessity: "all", searchText: "  카시트 " }).map((item) => item.name)).toEqual(["카시트"]);
  });
});

describe("hasActiveItemFilter", () => {
  it("is false only when nothing narrows the list", () => {
    expect(hasActiveItemFilter({ necessity: "all", searchText: "" })).toBe(false);
    expect(hasActiveItemFilter({ necessity: "all", searchText: "   " })).toBe(false);
    expect(hasActiveItemFilter({ necessity: "essential", searchText: "" })).toBe(true);
    expect(hasActiveItemFilter({ necessity: "all", searchText: "카시트" })).toBe(true);
  });
});
