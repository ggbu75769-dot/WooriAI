import { LINK_HEALTH_LABELS, LINK_HEALTH_UNKNOWN_LABEL, type LinkHealthStatus, type ProductLink } from "./admin-api";

// ADM-125: 상품 링크 목록의 클라이언트 필터. 링크는 시드 기준 67개라 서버
// 쿼리를 늘리지 않고 이미 받아온 배열을 그대로 좁힌다 — 깨진 링크를 눈으로
// 훑는 대신 헬스 상태 칩 하나로 골라내는 게 목적.

// 헬스 칩 값. healthStatus가 null(아직 검사 전이거나 제휴 URL 없음)인 링크는
// 별도 상태 값이 없으므로 "unknown" 칩으로 모은다.
export type LinkHealthFilter = LinkHealthStatus | "unknown";

export const LINK_HEALTH_FILTERS: readonly LinkHealthFilter[] = ["ok", "broken", "unstable", "unknown"];

export const LINK_HEALTH_FILTER_LABELS: Record<LinkHealthFilter, string> = {
  ...LINK_HEALTH_LABELS,
  unknown: LINK_HEALTH_UNKNOWN_LABEL
};

// 필터가 실제로 읽는 필드만 요구한다(테스트가 ProductLink 전체를 만들 필요 없게).
export type FilterableLink = Pick<ProductLink, "title" | "url" | "itemTemplateId" | "active" | "healthStatus">;

export type LinkFilterState = {
  healthStatus?: LinkHealthFilter;
  itemTemplateId?: string;
  query?: string;
  activeOnly?: boolean;
};

export const EMPTY_LINK_FILTERS: LinkFilterState = {};

/** healthStatus(null 포함)를 대응하는 칩 값으로 매핑. */
export function healthFilterValue(status: LinkHealthStatus | null): LinkHealthFilter {
  return status ?? "unknown";
}

export function linkHealthFilterLabel(value: LinkHealthFilter): string {
  return LINK_HEALTH_FILTER_LABELS[value];
}

function matchesQuery(link: FilterableLink, normalizedQuery: string): boolean {
  return (
    link.title.toLowerCase().includes(normalizedQuery) || link.url.toLowerCase().includes(normalizedQuery)
  );
}

/**
 * 주어진 필터를 모두 만족하는 링크만 남긴다(AND 결합, 원본 순서 유지).
 * 비어 있는(undefined / 공백뿐인 query) 필터 항목은 무시한다.
 */
export function filterProductLinks<T extends FilterableLink>(
  links: readonly T[],
  filters: LinkFilterState = EMPTY_LINK_FILTERS
): T[] {
  const normalizedQuery = (filters.query ?? "").trim().toLowerCase();

  return links.filter((link) => {
    if (filters.healthStatus && healthFilterValue(link.healthStatus) !== filters.healthStatus) return false;
    if (filters.itemTemplateId && link.itemTemplateId !== filters.itemTemplateId) return false;
    if (filters.activeOnly && !link.active) return false;
    if (normalizedQuery && !matchesQuery(link, normalizedQuery)) return false;
    return true;
  });
}

export type ItemTemplateOption = { id: string; label: string };

/**
 * 링크 목록에 실제로 등장하는 준비템만 select 옵션으로 뽑는다(라벨 가나다순).
 * 링크가 하나도 없는 준비템으로 필터해 봐야 빈 결과뿐이라 후보에서 제외한다.
 */
export function collectItemTemplateOptions(
  links: readonly FilterableLink[],
  labelOf: (itemTemplateId: string) => string
): ItemTemplateOption[] {
  const ids = new Set<string>();
  for (const link of links) ids.add(link.itemTemplateId);
  return [...ids]
    .map((id) => ({ id, label: labelOf(id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko-KR"));
}

/** "77개 중 3개" 형태의 결과 건수 문구. */
export function linkFilterSummary(totalCount: number, filteredCount: number): string {
  if (totalCount === filteredCount) return `${totalCount}개`;
  return `${totalCount}개 중 ${filteredCount}개`;
}

/**
 * UX-X C5: 대시보드 "깨진 상품 링크" 카드가 /links?health=broken&active=1 로 넘어온다.
 * 칩 값이 아닌 값이나 파라미터 없음은 필터 없음으로 떨어뜨린다 — 화면에 없는 상태로
 * 걸려 빈 목록만 보이는 일이 없게. 초기값 1회 계산에만 쓰고(그 뒤 필터는 클라 상태)
 * URL은 다시 쓰지 않는다.
 *
 * 라운드 44 리뷰 N-5: `active`도 함께 읽는다. 대시보드의 깨진 링크 **숫자**는 서버가
 * `active: true` 안에서만 센 값인데(dashboard-summary.service.ts), 넘어온 목록은 비활성
 * 링크까지 다 보여 줬다 — 카드가 "3"인데 목록에는 7줄이 뜨는, 같은 것을 세는 두 화면이
 * 서로 다른 수를 말하는 자리였다. 카드가 `active=1`을 붙이고 여기서 그 조건을 초기 필터로
 * 세운다(체크박스가 켜진 채 열리므로 사용자가 직접 풀 수 있다).
 */
export const ACTIVE_ONLY_SEARCH_PARAM_VALUE = "1";

export function linkFiltersFromSearchParams(
  params: { get(name: string): string | null } | null | undefined
): LinkFilterState {
  const raw = params?.get("health") ?? null;
  const healthStatus = LINK_HEALTH_FILTERS.find((value) => value === raw);
  const activeOnly = params?.get("active") === ACTIVE_ONLY_SEARCH_PARAM_VALUE;

  const filters: LinkFilterState = {};
  if (healthStatus) filters.healthStatus = healthStatus;
  if (activeOnly) filters.activeOnly = true;
  return hasAnyLinkFilter(filters) ? filters : EMPTY_LINK_FILTERS;
}

export function hasAnyLinkFilter(filters: LinkFilterState): boolean {
  return Boolean(
    filters.healthStatus || filters.itemTemplateId || filters.activeOnly || (filters.query ?? "").trim()
  );
}
