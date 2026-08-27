import type { ItemTemplate } from "./admin-api";
import { linkFilterSummary } from "./link-filters";

// UX-X C7: 준비템 목록의 클라이언트 필터. 링크 목록(link-filters.ts)과 같은 관례 —
// 목록 응답을 이미 통째로 받아오므로 서버 요청을 늘리지 않고 받아온 배열만 좁힌다.
// 목적은 두 가지다: (1) 이름으로 바로 찾기, (2) "상품 링크가 하나도 없는 준비템"
// 골라내기 — 링크가 없는 준비템은 구매 링크 클릭으로 이어지지 않아 핵심 루프가
// 그 지점에서 끊긴다.

/** 필터가 실제로 읽는 필드만 요구한다(테스트가 ItemTemplate 전체를 만들 필요 없게). */
export type FilterableItem = Pick<ItemTemplate, "name" | "productLinks">;

export type ItemFilterState = {
  query?: string;
  missingLinksOnly?: boolean;
};

export const EMPTY_ITEM_FILTERS: ItemFilterState = {};

/** 목록 응답에 이미 실려 오는 productLinks 배열의 길이 — 추가 요청 없음. */
export function productLinkCount(item: Pick<ItemTemplate, "productLinks">): number {
  return item.productLinks?.length ?? 0;
}

/**
 * 주어진 필터를 모두 만족하는 준비템만 남긴다(AND 결합, 원본 순서 유지).
 * 비어 있는(undefined / 공백뿐인 query) 필터 항목은 무시한다.
 */
export function filterItemTemplates<T extends FilterableItem>(
  items: readonly T[],
  filters: ItemFilterState = EMPTY_ITEM_FILTERS
): T[] {
  const normalizedQuery = (filters.query ?? "").trim().toLowerCase();

  return items.filter((item) => {
    if (filters.missingLinksOnly && productLinkCount(item) > 0) return false;
    if (normalizedQuery && !item.name.toLowerCase().includes(normalizedQuery)) return false;
    return true;
  });
}

/** "120개 중 3개" — 링크 목록과 같은 건수 문구를 그대로 쓴다(두 화면의 표현 통일). */
export const itemFilterSummary = linkFilterSummary;

export function hasAnyItemFilter(filters: ItemFilterState): boolean {
  return Boolean(filters.missingLinksOnly || (filters.query ?? "").trim());
}
