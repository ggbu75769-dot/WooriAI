import { describe, expect, it } from "vitest";
import type { ProductLink } from "../api/client";
import { lowestPriceProductLinkId, sortProductOffers } from "./product-offer-sort";

const links: ProductLink[] = [
  { id: "a", platform: "coupang", title: "A", isAffiliate: true, isSponsored: false, rating: 5, reviewCount: 20, searchRank: 3, priceSnapshotKrw: 20_000, priceCheckedAt: "2026-09-14T00:00:00.000Z" },
  { id: "b", platform: "coupang", title: "B", isAffiliate: true, isSponsored: false, rating: 4.5, reviewCount: 300, searchRank: 2, priceSnapshotKrw: 15_000, priceCheckedAt: "2026-09-14T00:00:00.000Z" },
  { id: "c", platform: "coupang", title: "C", isAffiliate: true, isSponsored: false, rating: 5, reviewCount: 100, searchRank: 1 }
];

describe("product offer sorting", () => {
  it("sorts popularity by observable review count, then rating", () => {
    expect(sortProductOffers(links, "popular").map((link) => link.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts checked prices and keeps unknown prices last", () => {
    expect(sortProductOffers(links, "lowest_price").map((link) => link.id)).toEqual(["b", "a", "c"]);
    expect(lowestPriceProductLinkId(links)).toBe("b");
  });

  it("sorts by the observed Coupang search position", () => {
    expect(sortProductOffers(links, "search_rank").map((link) => link.id)).toEqual(["c", "b", "a"]);
  });
});
