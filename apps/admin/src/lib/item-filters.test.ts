import { describe, expect, it } from "vitest";
import type { ProductLink } from "./admin-api";
import {
  EMPTY_ITEM_FILTERS,
  activeProductLinkCount,
  filterItemTemplates,
  hasAnyItemFilter,
  itemFilterSummary,
  productLinkCount,
  type FilterableItem
} from "./item-filters";

function link(id: string, active = true): ProductLink {
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
    active,
    healthStatus: null,
    healthCheckedAt: null
  };
}

/** 서버가 세어 주는 활성 링크 수(activeLinkCount)를 픽스처에서도 같은 규칙으로 만든다. */
function item(name: string, productLinks: ProductLink[]): FilterableItem {
  return { name, productLinks, activeLinkCount: productLinks.filter((entry) => entry.active).length };
}

const swaddle = item("신생아 속싸개", [link("a"), link("b")]);
const sterilizer = item("젖병 소독기", []);
const tub = item("아기 욕조 Tub", [link("c")]);
// UX-X(R43) M-5: 링크는 등록돼 있는데 전부 비활성 — 사용자 화면에서는 구매처가 0이다.
const bottleWarmer = item("젖병 워머", [link("d", false), link("e", false)]);
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

  /**
   * UX-X(R43) M-5: 종전에는 productLinks.length로 걸러서, 링크가 전부 비활성인
   * 준비템이 "링크 있음"으로 취급돼 이 필터에서 빠졌다 — 사용자에게는 구매처가
   * 0인 화면인데 운영자에게는 보이지 않는 지점이었다.
   */
  it("also catches items whose links are all inactive (구매처 0 for the user)", () => {
    const withInactiveOnly = [...items, bottleWarmer];
    expect(filterItemTemplates(withInactiveOnly, { missingLinksOnly: true })).toEqual([sterilizer, bottleWarmer]);
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

  // 두 수를 나란히 둔다: 화면의 기본 표시는 활성 수, 그 옆의 "비활성 N"은 차이값.
  it("separates the user-visible count from the total registered count", () => {
    expect(activeProductLinkCount(bottleWarmer)).toBe(0);
    expect(productLinkCount(bottleWarmer)).toBe(2);
    expect(activeProductLinkCount(swaddle)).toBe(2);
    expect(activeProductLinkCount(sterilizer)).toBe(0);
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
