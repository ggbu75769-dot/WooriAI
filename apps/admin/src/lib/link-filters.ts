import { LINK_HEALTH_LABELS, LINK_HEALTH_UNKNOWN_LABEL, type LinkHealthStatus, type ProductLink } from "./admin-api";

// ADM-125: 상품 링크 목록의 클라이언트 필터. 링크는 시드 기준 77개라 서버
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

export function hasAnyLinkFilter(filters: LinkFilterState): boolean {
  return Boolean(
    filters.healthStatus || filters.itemTemplateId || filters.activeOnly || (filters.query ?? "").trim()
  );
}
