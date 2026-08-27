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

  it("only ever sets filters it knows (query and other params stay untouched)", () => {
    expect(linkFiltersFromSearchParams(new URLSearchParams("health=ok&query=욕조"))).toEqual({ healthStatus: "ok" });
  });

  /**
   * 라운드 44 리뷰 N-5: 대시보드 "깨진 상품 링크" 카드의 숫자는 서버가 활성 링크 안에서만
   * 센 값인데(dashboard-summary.service.ts) 넘어간 목록은 비활성까지 보여 줬다 — 카드는 3인데
   * 목록은 7줄인, 같은 것을 세는 두 화면이 다른 수를 말하는 자리였다.
   */
  it("N-5: reads the card's active=1 so the list opens on the same population as the count", () => {
    expect(linkFiltersFromSearchParams(new URLSearchParams("health=broken&active=1"))).toEqual({
      healthStatus: "broken",
      activeOnly: true
    });
    // 헬스 칩 없이 active만 와도 그 조건은 선다.
    expect(linkFiltersFromSearchParams(new URLSearchParams("active=1"))).toEqual({ activeOnly: true });
  });

  it("N-5: any other active value means no filter (opt-in only)", () => {
    expect(linkFiltersFromSearchParams(new URLSearchParams("health=broken&active=0"))).toEqual({
      healthStatus: "broken"
    });
    expect(linkFiltersFromSearchParams(new URLSearchParams("active=true"))).toEqual(EMPTY_LINK_FILTERS);
    expect(linkFiltersFromSearchParams(new URLSearchParams("active="))).toEqual(EMPTY_LINK_FILTERS);
  });

  it("N-5: the filter it builds is one the chips can actually undo", () => {
    const filters = linkFiltersFromSearchParams(new URLSearchParams("health=broken&active=1"));
    // 화면이 "필터 있음"으로 인식해야 초기화 버튼이 뜬다 -- 풀 수 없는 필터로 열지 않는다.
    expect(hasAnyLinkFilter(filters)).toBe(true);

    const links = [
      makeLink({ title: "깨진 활성", healthStatus: "broken", active: true }),
      makeLink({ title: "깨진 비활성", healthStatus: "broken", active: false }),
      makeLink({ title: "정상 활성", healthStatus: "ok", active: true })
    ];
    // 카드 숫자와 같은 모집단: 비활성 링크는 사용자에게 안 보이니 세지도 보여 주지도 않는다.
    expect(filterProductLinks(links, filters).map((entry) => entry.title)).toEqual(["깨진 활성"]);
  });
});
