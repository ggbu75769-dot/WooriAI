import { describe, expect, it } from "vitest";
import {
  filterInterestedItems,
  filterItems,
  hasActiveItemFilter,
  INTERESTED_FILTER_EMPTY_TEXT,
  INTERESTED_FILTER_LABEL,
  INTERESTED_FILTER_SCOPE_NOTE,
  itemIsInterested,
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

/**
 * 라운드 49 C-01: 찜(♡) 필터. 상세의 찜하기가 서버에 `interested`를 남기는데도 그것만 모아
 * 보는 경로가 없어, 찜은 눌러도 다시 찾을 수 없는 기능이었다.
 */
describe("interested (찜) filter", () => {
  const snapshot = [
    { id: "car-seat", name: "카시트", status: "not_prepared" as const },
    { id: "bottle", name: "젖병/소독 세트", status: "interested" as const },
    { id: "mobile", name: "모빌/백색소음기", status: "prepared" as const },
    { id: "diary", name: "태교 일기장", status: "interested" as const },
    { id: "gift", name: "손수건 세트", status: "gifted" as const },
    { id: "skip", name: "젖병 소독기", status: "not_needed" as const }
  ];

  it("판정은 상세의 찜하기가 저장하는 status 하나로 끝난다", () => {
    expect(itemIsInterested({ status: "interested" })).toBe(true);
    for (const status of ["not_prepared", "prepared", "gifted", "not_needed"] as const) {
      expect(itemIsInterested({ status })).toBe(false);
    }
  });

  it("찜한 항목만 남기고, 나머지 상태는 전부 걸러 낸다", () => {
    expect(filterInterestedItems(snapshot).map((item) => item.id)).toEqual(["bottle", "diary"]);
  });

  it("받은 순서를 바꾸지 않는다 (추천 순서 계약 무접촉)", () => {
    const reversed = [...snapshot].reverse();
    expect(filterInterestedItems(reversed).map((item) => item.id)).toEqual(["diary", "bottle"]);
  });

  it("찜한 것이 하나도 없으면 빈 배열 — 없는 항목을 지어내지 않는다", () => {
    expect(filterInterestedItems(snapshot.filter((item) => item.status !== "interested"))).toEqual([]);
    expect(filterInterestedItems([])).toEqual([]);
  });

  /**
   * 문구는 화면과 테스트가 같은 상수를 본다. 시기 칩을 따르지 않는다는 사실을 화면이 실제로
   * 밝히는지는 아래 wiring 테스트(item-expense-roundtrip-wiring.test.ts)가 확인한다.
   */
  it("칩 라벨과 안내 문구는 해요체이고 찜을 재촉하지 않는다", () => {
    expect(INTERESTED_FILTER_LABEL).toBe("찜한 것만");
    expect(INTERESTED_FILTER_SCOPE_NOTE).toBe("찜한 준비템은 시기와 상관없이 모두 보여요.");
    expect(INTERESTED_FILTER_EMPTY_TEXT).toBe("아직 찜한 준비템이 없어요.");
    for (const text of [INTERESTED_FILTER_SCOPE_NOTE, INTERESTED_FILTER_EMPTY_TEXT]) {
      expect(text.endsWith("요.")).toBe(true);
    }
  });
});
