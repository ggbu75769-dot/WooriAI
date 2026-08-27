import type { ItemTemplate } from "./admin-api";
import { linkFilterSummary } from "./link-filters";

// UX-X C7: 준비템 목록의 클라이언트 필터. 링크 목록(link-filters.ts)과 같은 관례 —
// 목록 응답을 이미 통째로 받아오므로 서버 요청을 늘리지 않고 받아온 배열만 좁힌다.
// 목적은 두 가지다: (1) 이름으로 바로 찾기, (2) "상품 링크가 하나도 없는 준비템"
// 골라내기 — 링크가 없는 준비템은 구매 링크 클릭으로 이어지지 않아 핵심 루프가
// 그 지점에서 끊긴다.

/** 필터가 실제로 읽는 필드만 요구한다(테스트가 ItemTemplate 전체를 만들 필요 없게). */
export type FilterableItem = Pick<ItemTemplate, "name" | "productLinks" | "activeLinkCount">;

export type ItemFilterState = {
  query?: string;
  missingLinksOnly?: boolean;
};

export const EMPTY_ITEM_FILTERS: ItemFilterState = {};

/**
 * 등록된 링크 전체 수(비활성 포함). 목록 응답에 이미 실려 오는 productLinks 배열의
 * 길이 — 추가 요청 없음.
 *
 * UX-X(R43) M-5: 이 수는 "사용자에게 보이는 구매처 수"가 아니다. 전부 비활성인
 * 준비템도 여기서는 1 이상이 나온다. 그래도 지우지 않고 남기는 이유는, 어드민이
 * "링크는 있는데 전부 내려가 있다"(= 되살리면 되는 상태)와 "링크 자체가 없다"
 * (= 새로 등록해야 하는 상태)를 구분해야 하기 때문이다. 화면의 기본 표시와 필터는
 * activeProductLinkCount를 쓰고, 이 수는 그 옆의 참고 값(비활성 N)으로만 쓴다.
 */
export function productLinkCount(item: Pick<ItemTemplate, "productLinks">): number {
  return item.productLinks?.length ?? 0;
}

/**
 * 사용자에게 실제로 보이는 구매처 수. 서버가 세어 준 값(activeLinkCount)을 그대로
 * 쓴다 — 어드민 목록과 앱이 같은 정의를 두 번 구현하지 않게.
 */
export function activeProductLinkCount(item: Pick<ItemTemplate, "activeLinkCount">): number {
  return item.activeLinkCount ?? 0;
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
    // '상품 링크 없음만 보기'는 사용자 관점이다: 링크가 전부 비활성인 준비템도
    // 상세 화면에서는 구매처 0이라 핵심 루프가 거기서 끊긴다 — 함께 걸러 낸다.
    if (filters.missingLinksOnly && activeProductLinkCount(item) > 0) return false;
    if (normalizedQuery && !item.name.toLowerCase().includes(normalizedQuery)) return false;
    return true;
  });
}

/** "120개 중 3개" — 링크 목록과 같은 건수 문구를 그대로 쓴다(두 화면의 표현 통일). */
export const itemFilterSummary = linkFilterSummary;

export function hasAnyItemFilter(filters: ItemFilterState): boolean {
  return Boolean(filters.missingLinksOnly || (filters.query ?? "").trim());
}
