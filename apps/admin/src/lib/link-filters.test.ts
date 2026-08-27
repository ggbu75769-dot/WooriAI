import { describe, expect, it } from "vitest";
import {
  EMPTY_LINK_FILTERS,
  LINK_HEALTH_FILTERS,
  collectItemTemplateOptions,
  filterProductLinks,
  hasAnyLinkFilter,
  healthFilterValue,
  linkFilterSummary,
  linkFiltersFromSearchParams,
  linkHealthFilterLabel,
  type FilterableLink
} from "./link-filters";

function makeLink(overrides: Partial<FilterableLink> = {}): FilterableLink {
  return {
    title: "코멧 신생아 속싸개",
    url: "https://example.com/products/1",
    itemTemplateId: "item-swaddle",
    active: true,
    healthStatus: "ok",
    ...overrides
  };
}

const ok = makeLink({ title: "속싸개 3종", url: "https://shop.example.com/ok", healthStatus: "ok" });
const broken = makeLink({
  title: "젖병 소독기",
  url: "https://shop.example.com/BROKEN-item",
  itemTemplateId: "item-sterilizer",
  healthStatus: "broken"
});
const unstable = makeLink({
  title: "아기 욕조",
  url: "https://other.example.com/tub",
  itemTemplateId: "item-tub",
  healthStatus: "unstable"
});
const unknown = makeLink({
  title: "손수건 10매",
  url: "https://shop.example.com/handkerchief",
  itemTemplateId: "item-swaddle",
  healthStatus: null,
  active: false
});
const all = [ok, broken, unstable, unknown];

describe("healthFilterValue (ADM-125)", () => {
  it("passes concrete statuses through", () => {
    expect(healthFilterValue("ok")).toBe("ok");
    expect(healthFilterValue("broken")).toBe("broken");
    expect(healthFilterValue("unstable")).toBe("unstable");
  });

  it("maps a null health status onto the unknown chip", () => {
    expect(healthFilterValue(null)).toBe("unknown");
  });

  it("labels every chip, unknown included", () => {
    expect(LINK_HEALTH_FILTERS).toEqual(["ok", "broken", "unstable", "unknown"]);
    expect(LINK_HEALTH_FILTERS.map(linkHealthFilterLabel)).toEqual(["정상", "깨짐", "불안정", "미확인"]);
  });
});

describe("filterProductLinks (ADM-125)", () => {
  it("returns everything when no filter is set", () => {
    expect(filterProductLinks(all)).toEqual(all);
    expect(filterProductLinks(all, EMPTY_LINK_FILTERS)).toEqual(all);
  });

  it("keeps the original order", () => {
    expect(filterProductLinks(all, { query: "e" })).toEqual(all);
  });

  it("filters by health status alone", () => {
    expect(filterProductLinks(all, { healthStatus: "broken" })).toEqual([broken]);
    expect(filterProductLinks(all, { healthStatus: "unstable" })).toEqual([unstable]);
  });

  it("selects null-health links through the unknown chip", () => {
    expect(filterProductLinks(all, { healthStatus: "unknown" })).toEqual([unknown]);
    expect(filterProductLinks(all, { healthStatus: "ok" })).toEqual([ok]);
  });

  it("filters by item template alone", () => {
    expect(filterProductLinks(all, { itemTemplateId: "item-swaddle" })).toEqual([ok, unknown]);
  });

  it("filters by active-only toggle alone", () => {
    expect(filterProductLinks(all, { activeOnly: true })).toEqual([ok, broken, unstable]);
  });

  it("passes inactive links through when the toggle is off", () => {
    expect(filterProductLinks(all, { activeOnly: false })).toEqual(all);
  });

  it("matches the query against the title", () => {
    expect(filterProductLinks(all, { query: "욕조" })).toEqual([unstable]);
  });

  it("matches the query against the url", () => {
    expect(filterProductLinks(all, { query: "other.example.com" })).toEqual([unstable]);
  });

  it("matches partially and ignores case in both title and url", () => {
    expect(filterProductLinks(all, { query: "BROKEN" })).toEqual([broken]);
    expect(filterProductLinks(all, { query: "broken-ITEM" })).toEqual([broken]);
    expect(filterProductLinks([makeLink({ title: "Comet Swaddle" })], { query: "swaddle" })).toHaveLength(1);
  });

  it("ignores a blank or whitespace-only query", () => {
    expect(filterProductLinks(all, { query: "" })).toEqual(all);
    expect(filterProductLinks(all, { query: "   " })).toEqual(all);
  });

  it("trims the query before matching", () => {
    expect(filterProductLinks(all, { query: "  욕조  " })).toEqual([unstable]);
  });

  it("combines filters with AND", () => {
    expect(filterProductLinks(all, { healthStatus: "unknown", itemTemplateId: "item-swaddle" })).toEqual([unknown]);
    expect(filterProductLinks(all, { itemTemplateId: "item-swaddle", query: "shop.example.com" })).toEqual([
      ok,
      unknown
    ]);
    expect(filterProductLinks(all, { itemTemplateId: "item-swaddle", activeOnly: true })).toEqual([ok]);
  });

  it("returns an empty array when the combination matches nothing", () => {
    expect(filterProductLinks(all, { healthStatus: "broken", itemTemplateId: "item-tub" })).toEqual([]);
    expect(filterProductLinks(all, { healthStatus: "unknown", activeOnly: true })).toEqual([]);
    expect(filterProductLinks(all, { query: "존재하지 않는 상품" })).toEqual([]);
    expect(filterProductLinks([], { healthStatus: "ok" })).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [...all];
    filterProductLinks(input, { healthStatus: "ok" });
    expect(input).toEqual(all);
  });
});

describe("collectItemTemplateOptions (ADM-125)", () => {
  it("derives unique options from the links, sorted by label", () => {
    const names: Record<string, string> = {
      "item-swaddle": "속싸개",
      "item-sterilizer": "젖병 소독기",
      "item-tub": "아기 욕조"
    };
    expect(collectItemTemplateOptions(all, (id) => names[id] ?? id)).toEqual([
      { id: "item-swaddle", label: "속싸개" },
      { id: "item-tub", label: "아기 욕조" },
      { id: "item-sterilizer", label: "젖병 소독기" }
    ]);
  });

  it("falls back to the id when the template name is unknown", () => {
    expect(collectItemTemplateOptions([ok], (id) => id)).toEqual([{ id: "item-swaddle", label: "item-swaddle" }]);
  });

  it("returns nothing for an empty link list", () => {
    expect(collectItemTemplateOptions([], (id) => id)).toEqual([]);
  });
});

describe("linkFilterSummary (ADM-125)", () => {
  it("shows the narrowed count against the total", () => {
    expect(linkFilterSummary(77, 3)).toBe("77개 중 3개");
    expect(linkFilterSummary(77, 0)).toBe("77개 중 0개");
  });

  it("shows a plain count when nothing was filtered out", () => {
    expect(linkFilterSummary(77, 77)).toBe("77개");
    expect(linkFilterSummary(0, 0)).toBe("0개");
  });
});

describe("hasAnyLinkFilter (ADM-125)", () => {
  it("is false for an empty filter state", () => {
    expect(hasAnyLinkFilter(EMPTY_LINK_FILTERS)).toBe(false);
    expect(hasAnyLinkFilter({ query: "  ", activeOnly: false })).toBe(false);
  });

  it("is true once any filter is set", () => {
    expect(hasAnyLinkFilter({ healthStatus: "broken" })).toBe(true);
    expect(hasAnyLinkFilter({ itemTemplateId: "item-tub" })).toBe(true);
    expect(hasAnyLinkFilter({ query: "욕조" })).toBe(true);
    expect(hasAnyLinkFilter({ activeOnly: true })).toBe(true);
  });
});

describe("linkFiltersFromSearchParams (UX-X C5)", () => {
  it("reads the dashboard card's ?health=broken as the initial health chip", () => {
    expect(linkFiltersFromSearchParams(new URLSearchParams("health=broken"))).toEqual({ healthStatus: "broken" });
    expect(linkFiltersFromSearchParams(new URLSearchParams("health=unknown"))).toEqual({ healthStatus: "unknown" });
  });

  it("ignores a missing or unknown value instead of filtering to nothing", () => {
    expect(linkFiltersFromSearchParams(new URLSearchParams(""))).toEqual(EMPTY_LINK_FILTERS);
    expect(linkFiltersFromSearchParams(new URLSearchParams("health=nonsense"))).toEqual(EMPTY_LINK_FILTERS);
    expect(linkFiltersFromSearchParams(null)).toEqual(EMPTY_LINK_FILTERS);
    expect(linkFiltersFromSearchParams(undefined)).toEqual(EMPTY_LINK_FILTERS);
  });

  it("only ever sets the health chip (other filters stay untouched)", () => {
    expect(linkFiltersFromSearchParams(new URLSearchParams("health=ok&query=욕조"))).toEqual({ healthStatus: "ok" });
  });
});
