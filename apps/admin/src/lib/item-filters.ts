import type { ItemTemplate } from "./admin-api";
import { linkFilterSummary } from "./link-filters";

// UX-X C7: 준비템 목록의 클라이언트 필터. 링크 목록(link-filters.ts)과 같은 관례 —
// 목록 응답을 이미 통째로 받아오므로 서버 요청을 늘리지 않고 받아온 배열만 좁힌다.
// 목적은 두 가지다: (1) 이름으로 바로 찾기, (2) "상품 링크가 하나도 없는 준비템"
// 골라내기 — 링크가 없는 준비템은 구매 링크 클릭으로 이어지지 않아 핵심 루프가
// 그 지점에서 끊긴다.
//
// 라운드 84 트랙 A가 세 번째를 더한다: (3) "앱에서 가장 강조되는 구매 버튼이 서지
// 않는 준비템"(= 활성 비스폰서 링크 0건) 골라내기. (2)와는 다른 질문이다 — 광고
// 링크 하나만 걸린 준비템은 구매처가 0이 아니지만 그 버튼은 서지 않는다.

/** 필터가 실제로 읽는 필드만 요구한다(테스트가 ItemTemplate 전체를 만들 필요 없게). */
export type FilterableItem = Pick<ItemTemplate, "name" | "productLinks" | "activeLinkCount">;

export type ItemFilterState = {
  query?: string;
  missingLinksOnly?: boolean;
  /**
   * 라운드 84 트랙 A: "앱에서 **강조되는 구매 버튼**이 서지 않는 준비템만" 보기.
   * 위 missingLinksOnly와는 **다른 질문**이다 — 저쪽은 구매처가 0인 자리를 묻고, 이쪽은
   * 구매처는 있는데 그 전부가 스폰서(광고)라 화면에서 채워진 버튼을 받는 링크가 없는
   * 자리까지 함께 묻는다. 링크 0건인 준비템은 두 필터 모두에 걸린다.
   */
  missingNonSponsoredLinksOnly?: boolean;
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
 *
 * 라운드 44 리뷰 N-8: 종전 폴백은 `?? 0`이었다. 타입상 필수 필드지만 응답은 런타임에
 * 검증되지 않으므로(admin-api.ts의 request()는 JSON을 그대로 캐스팅한다), 필드를 아직
 * 안 내려주는 서버 버전과 붙으면 **모든 준비템이 활성 링크 0개**가 된다. 그 방향의 오류는
 * 화면에서 "구매처 없음"이라는 단정으로 읽히고, '상품 링크 없음만 보기'가 62개 전부를
 * 남기며, 운영자는 멀쩡한 링크를 다시 등록하러 간다.
 *
 * 그래서 필드가 없을 때는 0이 아니라 **등록된 링크 전체 수**로 떨어진다. 이 폴백도 정확하지는
 * 않지만(비활성 링크를 활성으로 세는 쪽이다) 틀리는 방향이 다르다 — 없는 문제를 만들어
 * 내지 않고, 링크가 정말 하나도 없는 준비템은 여전히 0으로 남아 필터에 걸린다.
 */
export function activeProductLinkCount(item: Pick<ItemTemplate, "productLinks" | "activeLinkCount">): number {
  if (typeof item.activeLinkCount === "number") return item.activeLinkCount;
  return productLinkCount(item);
}

/**
 * 라운드 84 트랙 A: 앱 상세 화면에서 **채워진(가장 강조되는) "구매하기" 버튼**을 받을 수 있는
 * 링크의 수 — 활성이면서 스폰서가 아닌 링크다.
 *
 * 판정을 새로 만들지 않는다. 모바일의 정본은 `apps/mobile/src/items/link-marker.ts`의
 * `primaryPurchaseLinkIndex`이고, 그 술어가 `findIndex((link) => !link.isSponsored)`다
 * (스폰서 링크는 순서와 무관하게 외곽선 버튼이고, 전부 스폰서면 채워진 버튼이 하나도 없다 —
 * 구분이 우대가 되지 않게 한다는 DNC-011의 자리). 앱이 그 술어를 먹이는 목록에는 **활성 링크만**
 * 실리므로(items-catalog.service.ts의 상세 조회가 `active: true`로 좁힌다) 어드민에서 같은 질문을
 * 하려면 활성 조건이 함께 붙는다. 술어가 갈리면 item-filters.test.ts의 동치 대조가 먼저 빨개진다.
 *
 * ⚠️ 이 수는 **세고 고르는** 데만 쓴다 — 스폰서 링크를 숨기거나 뒤로 미는 일은 여기서도, 이
 * 화면 어디에서도 하지 않는다(DNC-011). 정렬·추천 점수와도 무관하다(DNC-009).
 *
 * ⚠️ **라운드 84 리뷰 L-12 — 필드 부재 폴백의 방향이 N-8과 반대다(값으로 적어 둔다).**
 * 종전 이 문단은 *"activeProductLinkCount의 N-8 폴백과 방향이 같다"* 고 적었는데 그것은 틀렸다.
 * `productLinks`가 통째로 비어 오는 응답에서 두 함수가 가는 방향은 정확히 반대다:
 *   - `activeProductLinkCount`는 **없는 문제를 만들지 않는** 쪽으로 떨어진다(등록 링크 수 → 필터에
 *     걸리지 않는다). 그것이 N-8이 고른 방향이다.
 *   - 이 함수는 0으로 떨어져 **없는 문제를 만드는** 쪽이다 — 링크가 멀쩡히 있어도 "강조 버튼이
 *     서지 않는 준비템"으로 목록에 남는다.
 *
 * 그래도 오늘 코드 동작을 바꾸지 않는 이유: `productLinks`는 목록 응답의 **필수 필드**이고
 * (admin-api.ts의 ItemTemplate), 이 판정은 그 배열의 `active`·`isSponsored`를 **직접 읽어야만**
 * 성립한다 — 서버가 세어 준 요약 수(activeLinkCount) 같은 대체 근거가 없다. 즉 배열이 없으면
 * 어느 방향으로 떨어져도 근거 없는 단정이고, 그 상태에서 "링크가 있다"고 가정하는 폴백은 **필터가
 * 존재 이유를 잃는 방향**(스폰서만 걸린 자리를 영영 못 찾는다)이다. 그래서 방향을 여기 적어 두고,
 * 그 사실 자체는 테스트가 값으로 고정한다(item-filters.test.ts의 L-12 줄). 배열이 정말 선택 필드가
 * 되는 날 그 줄이 먼저 이 판단을 다시 하게 만든다.
 */
export function activeNonSponsoredLinkCount(item: Pick<ItemTemplate, "productLinks">): number {
  return (item.productLinks ?? []).filter((link) => link.active && !link.isSponsored).length;
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
    // 라운드 84 트랙 A: 강조되는 구매 버튼을 받을 링크(활성 · 비스폰서)가 0건인 준비템만.
    if (filters.missingNonSponsoredLinksOnly && activeNonSponsoredLinkCount(item) > 0) return false;
    if (normalizedQuery && !item.name.toLowerCase().includes(normalizedQuery)) return false;
    return true;
  });
}

/** "120개 중 3개" — 링크 목록과 같은 건수 문구를 그대로 쓴다(두 화면의 표현 통일). */
export const itemFilterSummary = linkFilterSummary;

export function hasAnyItemFilter(filters: ItemFilterState): boolean {
  return Boolean(
    filters.missingLinksOnly || filters.missingNonSponsoredLinksOnly || (filters.query ?? "").trim()
  );
}
