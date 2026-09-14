import type { ProductLink } from "../api/client";

export type ProductOfferSort = "popular" | "lowest_price" | "search_rank";

export const PRODUCT_OFFER_SORT_OPTIONS: Array<{ value: ProductOfferSort; label: string }> = [
  { value: "popular", label: "인기순" },
  { value: "lowest_price", label: "최저가순" },
  { value: "search_rank", label: "쿠팡 노출순" }
];

export function sortProductOffers(links: ProductLink[], sort: ProductOfferSort): ProductLink[] {
  return links
    .map((link, index) => ({ link, index }))
    .sort((a, b) => {
      if (sort === "lowest_price") {
        return (a.link.priceSnapshotKrw ?? Number.MAX_SAFE_INTEGER) -
          (b.link.priceSnapshotKrw ?? Number.MAX_SAFE_INTEGER) || a.index - b.index;
      }
      if (sort === "search_rank") {
        return (a.link.searchRank ?? Number.MAX_SAFE_INTEGER) -
          (b.link.searchRank ?? Number.MAX_SAFE_INTEGER) || a.index - b.index;
      }
      return (b.link.reviewCount ?? -1) - (a.link.reviewCount ?? -1) ||
        (b.link.rating ?? -1) - (a.link.rating ?? -1) ||
        (a.link.searchRank ?? Number.MAX_SAFE_INTEGER) - (b.link.searchRank ?? Number.MAX_SAFE_INTEGER) ||
        a.index - b.index;
    })
    .map(({ link }) => link);
}

export function lowestPriceProductLinkId(links: ProductLink[]): string | undefined {
  return links.reduce<{ id: string; price: number } | undefined>((lowest, link) => {
    if (link.priceSnapshotKrw === undefined || link.priceCheckedAt === undefined) return lowest;
    return !lowest || link.priceSnapshotKrw < lowest.price ? { id: link.id, price: link.priceSnapshotKrw } : lowest;
  }, undefined)?.id;
}
