import type { ItemTemplate } from "./admin-api";
import { NO_ITEM_CATEGORY_LABEL, UNKNOWN_ITEM_CATEGORY_LABEL } from "./item-category-options";
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
//
// 라운드 85 트랙 D가 네 번째를 더한다: (4) "분류가 비어 있는 준비템" 골라내기, 그리고
// 검색이 이름뿐 아니라 **분류 표시명**도 보게 하기. 앱은 준비템 목록을 분류로 **묶어**
// 그리고(app/(tabs)/items.tsx의 groupKeyOf) 그 이름으로 **검색까지** 하는데
// (apps/mobile/src/items/item-filters.ts의 itemMatchesSearch), 운영자의 목록에는 그 축이
// 통째로 없었다 — 분류를 비울 수 있는 폼이 바로 그 화면인데도.

/** 필터가 실제로 읽는 필드만 요구한다(테스트가 ItemTemplate 전체를 만들 필요 없게). */
export type FilterableItem = Pick<ItemTemplate, "name" | "productLinks" | "activeLinkCount" | "categoryId">;

/**
 * 항목 하나가 **화면에서** 어떤 분류 이름으로 그려지는지 알려 주는 함수.
 *
 * 모바일의 `ItemCategoryNameResolver`와 같은 모양이고 같은 이유다: 이 파일은 분류 id에서
 * 이름을 **조립하지 않는다**. 이름은 화면이 이미 들고 있는 목록(listAdminCategories의 응답)
 * 하나에서 나오고, 그 해석기를 그대로 받는다 — 여기에 두 번째 조립기를 두면 검색이 화면에
 * 없는 이름을 찾거나 화면에 있는 이름을 못 찾게 된다.
 *
 * 이름을 알 수 없으면(분류 없음 · 목록에 없는 분류) null/undefined를 돌려준다 —
 * 그때 검색은 종전과 정확히 같게 이름만 본다.
 */
export type ItemCategoryNameResolver<TItem extends FilterableItem = FilterableItem> = (
  item: TItem
) => string | null | undefined;

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
  /**
   * 라운드 85 트랙 D: "분류가 비어 있는 준비템만" 보기. 위 둘과 또 **다른 질문**이다 —
   * 저 둘은 구매처(링크)를 묻고, 이쪽은 앱이 목록을 **묶는 축**이 그 준비템에 있는지 묻는다.
   * 분류가 없으면 앱에서 **"분류 없음"** 그룹으로 떨어지고, 지출 기록 시트의 분류 프리필도 비어 온다.
   *
   * ⚠️ 라운드 85 리뷰 L-9: 종전 이 줄은 그 그룹 이름을 *"기타"* 라고 적었는데, 그것은 **다른
   * 갈래의 이름**이다 — 앱에서 "기타"는 *분류는 붙어 있는데 그 이름을 모를 때*의 폴백이고
   * (`categories.ts`의 `categoryNameFor` 마지막 줄), 분류가 아예 없는 항목의 그룹 이름은
   * `UNCATEGORIZED_GROUP_NAME = "분류 없음"`이다(`app/(tabs)/items.tsx`의 `groupKeyOf`).
   * 같은 트랙의 화면 힌트는 처음부터 "분류 없음 그룹"이라고 말하고 있었으므로, 이 줄만 다른
   * 사실을 적고 있었다(그 힌트가 참인지는 item-filters.test.ts ⓔ가 앱 소스로 확인한다).
   */
  missingCategoryOnly?: boolean;
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
 * 라운드 85 트랙 D: 저장된 분류가 **비어 있는가**.
 *
 * ⚠️ 판정이 `!item.categoryId`가 아니라 `=== null`인 이유(폴백 방향을 값으로 적어 둔다).
 * 어드민 응답은 **"분류 없음"과 "모름"을 일부러 구분해서** 싣는다 — 서버가 그렇게 적어 두었다
 * (items-catalog.service.ts의 toAdminItemDetailDto: *"어드민 응답은 '분류 없음'과 '모름'을
 * 구분해야 하므로 null을 그대로 싣는다"*). 그래서 `null`은 근거 있는 "분류 없음"이고,
 * **키가 아예 없는 응답**(이 필드 이전에 캐시된 응답 — 타입이 optional인 이유)은 "모름"이다.
 *
 * 모름을 "분류 없음"으로 세면 N-8이 고른 방향의 반대로 떨어진다 — 멀쩡히 분류가 붙은 준비템
 * 전부가 이 필터에 걸리고, 운영자는 이미 있는 분류를 다시 고르러 간다. 그래서 모름은 걸리지
 * 않는다(없는 문제를 만들지 않는 쪽). 빈 문자열도 함께 받는 이유는 폼의 "고르지 않음"이
 * `""`이기 때문이다(page.tsx의 ItemFormState.categoryId).
 */
export function isUncategorizedItem(item: Pick<ItemTemplate, "categoryId">): boolean {
  return item.categoryId === null || item.categoryId === "";
}

/**
 * ⚠️ **라운드 85 리뷰 M-7 — 해석기의 `null` 갈래가 검색을 조용히 막고 있었다.**
 *
 * 이 화면의 이름 해석기(page.tsx의 `categoryNameOf`)는 이름을 **모르면 null**이다. 그것은 열
 * 표시에는 옳다(지어내지 않는다). 그런데 그 함수가 검색에도 그대로 들어가면서, 세 상태 중 둘이
 * 검색으로 **도달 불가**가 됐다:
 *
 * | 항목의 상태 | 앱의 그룹 헤더 | 어드민의 분류 열 | 종전 어드민 검색 |
 * |---|---|---|---|
 * | 분류 있음 | 분류 이름 | 분류 이름 | 이름으로 찾힌다 |
 * | 분류 없음(null·`""`) | "분류 없음" | `-` | ⚠️ **못 찾는다** |
 * | 목록에 없는 분류 | "기타" | "(목록에 없는 분류)" | ⚠️ **못 찾는다** |
 *
 * 앱은 그 둘을 **찾을 수 있다** — 화면이 그 항목 위에 실제로 그리는 글자가 있고 술어가 그 글자를
 * 보기 때문이다(라운드 81 D: *"화면이 자기가 그린 이름을 자기 검색으로 못 찾았다"*). 어드민만
 * 그 둘에서 그 성질을 잃고 있었다.
 *
 * ## 고른 방향: **검색 갈래에만** 폴백을 태우고 열 표시는 그대로 둔다
 * 앱과 **글자를 맞추지 않는다**(그쪽 폴백은 "분류 없음"·"기타"다). 두 화면이 지는 계약은
 * *"같은 문자열을 찾는다"* 가 아니라 *"자기 화면이 그 항목에 붙여 쓰는 글자로 찾힌다"* 이기
 * 때문이다 — 어드민에 "기타"를 태우면 **이 화면 어디에도 없는 글자**로 검색이 걸리고, 그것은
 * 라운드 81 D가 막으려던 두 방향 중 나머지 하나("검색이 화면에 없는 이름을 찾는다")다.
 * 그래서 어드민은 자기 라벨 둘을 쓴다: 폼의 `분류 없음`과 열의 `(목록에 없는 분류)`.
 * 열 표시(`-`)는 손대지 않는다 — 값 없음의 관례는 다른 열과 같아야 하고, `-`는 이름이 아니다.
 *
 * 해석기는 여전히 **하나**다(이 함수는 그 하나를 감쌀 뿐 두 번째 조립기가 아니다).
 */
export function withDisplayedCategoryFallbacks<T extends FilterableItem>(
  categoryNameOf: ItemCategoryNameResolver<T>
): (item: T) => string {
  return (item) =>
    categoryNameOf(item) ?? (isUncategorizedItem(item) ? NO_ITEM_CATEGORY_LABEL : UNKNOWN_ITEM_CATEGORY_LABEL);
}

/**
 * 검색어 한 갈래. **이름 ∨ 분류 표시명** — 앱의 술어(itemMatchesSearch)와 같은 질문이고,
 * 갈래의 순서도 같다(이름이 먼저 걸리면 해석기를 부르지 않는다).
 *
 * 정규화 규칙은 이 파일의 기존 것 하나(trim + 소문자)를 그대로 쓴다 — 갈래마다 다른 규칙을
 * 쓰면 같은 글자가 자리에 따라 다르게 걸린다. 해석기가 없거나 이름을 모르면 종전과 정확히
 * 같게 이름만 본다.
 */
function matchesItemQuery<T extends FilterableItem>(
  item: T,
  normalizedQuery: string,
  categoryNameOf?: ItemCategoryNameResolver<T>
): boolean {
  if (item.name.toLowerCase().includes(normalizedQuery)) return true;
  const categoryName = categoryNameOf?.(item);
  if (!categoryName) return false;
  return categoryName.toLowerCase().includes(normalizedQuery);
}

/**
 * 주어진 필터를 모두 만족하는 준비템만 남긴다(AND 결합, 원본 순서 유지).
 * 비어 있는(undefined / 공백뿐인 query) 필터 항목은 무시한다.
 *
 * `categoryNameOf`는 선택이다 — 주면 검색이 분류 표시명까지 보고, 주지 않으면 술어는
 * 종전과 정확히 같게 이름만 본다(모바일 `ItemFilterInput.categoryNameOf`와 같은 관례).
 */
export function filterItemTemplates<T extends FilterableItem>(
  items: readonly T[],
  filters: ItemFilterState = EMPTY_ITEM_FILTERS,
  categoryNameOf?: ItemCategoryNameResolver<T>
): T[] {
  const normalizedQuery = (filters.query ?? "").trim().toLowerCase();

  return items.filter((item) => {
    // '상품 링크 없음만 보기'는 사용자 관점이다: 링크가 전부 비활성인 준비템도
    // 상세 화면에서는 구매처 0이라 핵심 루프가 거기서 끊긴다 — 함께 걸러 낸다.
    if (filters.missingLinksOnly && activeProductLinkCount(item) > 0) return false;
    // 라운드 84 트랙 A: 강조되는 구매 버튼을 받을 링크(활성 · 비스폰서)가 0건인 준비템만.
    if (filters.missingNonSponsoredLinksOnly && activeNonSponsoredLinkCount(item) > 0) return false;
    // 라운드 85 트랙 D: 분류가 비어 있는 준비템만. 판정은 저장된 값 하나(categoryId)만 보므로
    // 분류 **이름** 목록을 못 불러온 화면에서도 답이 달라지지 않는다.
    if (filters.missingCategoryOnly && !isUncategorizedItem(item)) return false;
    if (normalizedQuery && !matchesItemQuery(item, normalizedQuery, categoryNameOf)) return false;
    return true;
  });
}

/** "120개 중 3개" — 링크 목록과 같은 건수 문구를 그대로 쓴다(두 화면의 표현 통일). */
export const itemFilterSummary = linkFilterSummary;

export function hasAnyItemFilter(filters: ItemFilterState): boolean {
  return Boolean(
    filters.missingLinksOnly ||
      filters.missingNonSponsoredLinksOnly ||
      filters.missingCategoryOnly ||
      (filters.query ?? "").trim()
  );
}
