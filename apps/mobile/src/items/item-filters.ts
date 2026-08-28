import type { ItemStatus, NecessityLevel } from "@wooriai/domain";

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

/**
 * 라운드 49 C-01: **찜(♡) 칩** — 상세에서 토글하는 `interested` 상태에 도달하는 유일한 경로.
 *
 * 찜하기(app/items/[itemTemplateId].tsx의 toggleInterested)는 서버에 실제로
 * `status = "interested"`를 남기지만, 목록의 상태 칩은 서버 tab 파라미터와 1:1인
 * now/soon/prepared/not_needed 넷뿐이었다. interested는 now/soon의 후보 상태
 * (apps/api/src/onboarding/item-ranking.ts의 OPEN_STATUSES)라 그 두 탭에 **섞여** 나올 뿐,
 * "내가 찜한 것만" 모아 보는 화면은 어디에도 없었다 — 찜은 눌러도 다시 찾을 수 없는 기능이었다.
 *
 * ## 서버를 건드리지 않는 이유
 * 화면은 준비율(ITEM-114) 때문에 이미 `tab="all"` 스냅샷 1건을 받아 두고 있고
 * (app/(tabs)/items.tsx의 allStatusItems), all은 상태로 거르지 않으므로 찜한 항목이 전부 들어
 * 있다. 즉 필요한 데이터는 이미 손에 있다 — 새 탭 값도, 새 요청도, 새 쿼리 키도 필요 없다.
 * 판정은 받은 항목의 `status` 하나만 보는 순수 함수라 이 파일의 다른 칩(필수도)과 성격이 같다.
 *
 * ## 시기(밴드)로 좁히지 않는다
 * `tab="all"` 스냅샷은 서버가 일부러 밴드를 무시한다(item-ranking.ts의 FIX/F4). 찜은
 * "지금 시기에 필요한 것"이 아니라 **사용자가 표시해 둔 목록**이라, 시기 칩을 따라 사라지면
 * 방금 찜한 물건이 이유 없이 안 보이게 된다. 그래서 화면은 찜 목록 위에 이 사실을 한 줄로
 * 밝힌다(INTERESTED_FILTER_SCOPE_NOTE) — 조용히 다른 규칙을 쓰지 않는다.
 */
// 라벨은 곧 스크린 리더 문장이다 — CategoryChip(src/ui.tsx)이 label을 그대로
// accessibilityLabel로 읽어 주므로, 별도의 a11y 문구를 두지 않고 라벨 하나만 관리한다.
export const INTERESTED_FILTER_LABEL = "찜한 것만";

/** 찜 목록이 시기 칩을 따르지 않는다는 사실을 그 자리에서 밝히는 한 줄(해요체, DNC-018). */
export const INTERESTED_FILTER_SCOPE_NOTE = "찜한 준비템은 시기와 상관없이 모두 보여요.";

/** 찜한 항목이 하나도 없을 때의 빈 화면 문구. 찜을 안 한 것을 탓하지 않는다(DNC-018). */
export const INTERESTED_FILTER_EMPTY_TEXT = "아직 찜한 준비템이 없어요.";

export type InterestFilterableItem = { status: ItemStatus };

/** 찜 판정은 상태 하나로 끝난다 — 상세의 찜하기가 저장하는 그 값이다. */
export function itemIsInterested(item: InterestFilterableItem): boolean {
  return item.status === "interested";
}

/**
 * 찜한 항목만, 받은 순서 그대로 남긴다. 다른 필터(필수도·검색·출산 전)와 AND로 겹치도록
 * 정렬은 손대지 않는다 — 여기서 재정렬하면 추천 순서 계약이 흐려진다(DNC-009 주변).
 */
export function filterInterestedItems<T extends InterestFilterableItem>(items: readonly T[]): T[] {
  return items.filter(itemIsInterested);
}
