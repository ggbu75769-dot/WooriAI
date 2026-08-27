import { describe, expect, it } from "vitest";
import type { ProductLink } from "./admin-api";
import {
  EMPTY_ITEM_FILTERS,
  filterItemTemplates,
  hasAnyItemFilter,
  itemFilterSummary,
  productLinkCount,
  type FilterableItem
} from "./item-filters";

function link(id: string): ProductLink {
  return {
    id,
    itemTemplateId: "item-1",
    platform: "coupang",
    title: `링크 ${id}`,
    url: "https://example.com",
    affiliateUrl: null,
    isAffiliate: false,
    isSponsored: false,
    disclosureText: null,
    active: true,
    healthStatus: null,
    healthCheckedAt: null
  };
}

const swaddle: FilterableItem = { name: "신생아 속싸개", productLinks: [link("a"), link("b")] };
const sterilizer: FilterableItem = { name: "젖병 소독기", productLinks: [] };
const tub: FilterableItem = { name: "아기 욕조 Tub", productLinks: [link("c")] };
const items = [swaddle, sterilizer, tub];

describe("filterItemTemplates (UX-X C7)", () => {
  it("returns everything, in order, with no filters", () => {
    expect(filterItemTemplates(items)).toEqual(items);
    expect(filterItemTemplates(items, EMPTY_ITEM_FILTERS)).toEqual(items);
  });

  it("matches the name case-insensitively as a substring", () => {
    expect(filterItemTemplates(items, { query: "속싸개" })).toEqual([swaddle]);
    expect(filterItemTemplates(items, { query: "tub" })).toEqual([tub]);
    expect(filterItemTemplates(items, { query: "  " })).toEqual(items);
    expect(filterItemTemplates(items, { query: "없는이름" })).toEqual([]);
  });

  it("keeps only link-less items for 상품 링크 없음만 보기", () => {
    expect(filterItemTemplates(items, { missingLinksOnly: true })).toEqual([sterilizer]);
  });

  it("combines the two filters with AND", () => {
    expect(filterItemTemplates(items, { missingLinksOnly: true, query: "소독" })).toEqual([sterilizer]);
    expect(filterItemTemplates(items, { missingLinksOnly: true, query: "속싸개" })).toEqual([]);
  });
});

describe("productLinkCount / itemFilterSummary / hasAnyItemFilter", () => {
  it("counts the links already carried by the list response", () => {
    expect(productLinkCount(swaddle)).toBe(2);
    expect(productLinkCount(sterilizer)).toBe(0);
  });

  it("uses the same 건수 wording as the links page", () => {
    expect(itemFilterSummary(3, 3)).toBe("3개");
    expect(itemFilterSummary(3, 1)).toBe("3개 중 1개");
  });

  it("knows whether any filter is actually applied", () => {
    expect(hasAnyItemFilter(EMPTY_ITEM_FILTERS)).toBe(false);
    expect(hasAnyItemFilter({ query: "  " })).toBe(false);
    expect(hasAnyItemFilter({ query: "속" })).toBe(true);
    expect(hasAnyItemFilter({ missingLinksOnly: true })).toBe(true);
  });
});
