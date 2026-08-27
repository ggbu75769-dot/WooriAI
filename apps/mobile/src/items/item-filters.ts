import type { NecessityLevel } from "@wooriai/domain";

/**
 * ITEM-121 (B2/B3): 준비템 목록의 클라이언트 전용 좁히기 — 필수도 칩과 이름 검색.
 *
 * 서버로 보내지 않는 이유: 두 조건 모두 이미 받은 목록 항목의 필드(necessityLevel, name)만
 * 보므로 왕복이 필요 없고, 시기(stageBand)·상태(tab)처럼 목록의 모집단을 바꾸지 않는다.
 * 시기/상태 필터는 서버가 담당한다(apps/api/src/onboarding/items-catalog.service.ts).
 */
export type NecessityFilter = "all" | NecessityLevel;

export const NECESSITY_FILTER_OPTIONS: Array<{ value: NecessityFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "essential", label: "필수" },
  { value: "convenience", label: "편의" },
  { value: "optional", label: "선택" }
];

export type FilterableItem = {
  name: string;
  necessityLevel: NecessityLevel;
};

export type ItemFilterInput = {
  necessity: NecessityFilter;
  /** 사용자가 입력한 원문. 앞뒤 공백·대소문자는 여기서 정규화한다. */
  searchText: string;
};

/** 검색어 정규화 — 기록 탭(app/(tabs)/records.tsx)의 검색 관례와 동일하게 trim + 소문자. */
export function normalizeItemSearchText(searchText: string): string {
  return searchText.trim().toLowerCase();
}

export function itemMatchesNecessity(item: FilterableItem, necessity: NecessityFilter): boolean {
  return necessity === "all" || item.necessityLevel === necessity;
}

/** 이름 부분 일치(대소문자 무시). 빈 검색어는 모든 항목을 통과시킨다. */
export function itemMatchesSearch(item: FilterableItem, normalizedSearch: string): boolean {
  if (!normalizedSearch) return true;
  return item.name.toLowerCase().includes(normalizedSearch);
}

/**
 * 두 조건을 모두 만족하는 항목만, 서버가 준 순서(추천 점수 순) 그대로 남긴다 —
 * 필터가 정렬을 바꾸면 추천 순서 계약(DNC-009 주변)이 흐려진다.
 */
export function filterItems<T extends FilterableItem>(items: T[], input: ItemFilterInput): T[] {
  const normalizedSearch = normalizeItemSearchText(input.searchText);
  return items.filter((item) => itemMatchesNecessity(item, input.necessity) && itemMatchesSearch(item, normalizedSearch));
}

/** 좁히기 조건이 하나라도 걸려 있는지 — 빈 화면 문구를 고르는 데 쓴다. */
export function hasActiveItemFilter(input: ItemFilterInput): boolean {
  return input.necessity !== "all" || normalizeItemSearchText(input.searchText).length > 0;
}
