/**
 * UX-C — 품목명 부분일치 규칙의 단일 소스.
 *
 * 지출 입력 화면(app/expenses/new.tsx)에는 타이핑에 반응하는 두 가지 보조가 붙는다:
 * 카테고리 자동 추천(category-suggestion.ts)과 과거 항목 자동완성(item-autocomplete.ts).
 * 둘 다 "지금 친 글자가 과거에 기록한 품목명과 같은 항목인가?"를 판단하므로, 그 규칙이
 * 두 벌로 갈리면 같은 입력에서 칩은 뜨는데 카테고리는 안 바뀌는(혹은 그 반대의) 어긋남이
 * 생긴다. 그래서 정규화·매칭 등급·최신순 정렬을 여기 한 곳에만 둔다.
 *
 * 범위: 단순 문자열 포함 비교다. 한글 초성 검색("ㄱㅈㄱ" → 기저귀)이나 오타 교정은
 * 의도적으로 하지 않는다 — 잘못 걸린 추천이 사용자의 카테고리를 조용히 바꿔 놓는 쪽이
 * 추천이 없는 것보다 나쁘기 때문이다.
 *
 * 저장소/네트워크/React에 의존하지 않는 계산만 담아 vitest 단위 테스트 대상으로 둔다
 * (src/expenses/recent-items.ts, amount-presets.ts와 같은 관례).
 */

/**
 * 추천/자동완성을 시작하는 최소 글자 수. 한글은 한 글자가 곧 한 음절이라("책", "옷")
 * 1글자부터 의미가 있고, 어차피 결과는 상위 3개까지만 보여준다.
 */
export const ITEM_NAME_MATCH_MIN_QUERY_LENGTH = 1;

/**
 * 비교용 정규화: 앞뒤 공백 제거 + 소문자화(영문 상품명) + 내부 공백 제거.
 * 내부 공백까지 지우는 이유는 "물 티슈"/"물티슈", "기저귀 크림"/"기저귀크림"처럼 같은 물건을
 * 띄어쓰기만 다르게 적는 일이 흔하기 때문이다.
 */
export function normalizeItemName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * 매칭 등급(낮을수록 더 좋은 매칭). 정렬에 쓰이는 값이므로 숫자 자체를 계약으로 고정한다.
 * - exact: 완전히 같은 이름
 * - prefix: 과거 이름이 지금 친 글자로 시작 ("기저" → "기저귀 대형")
 * - contains: 과거 이름 중간에 지금 친 글자가 들어 있음 ("대형" → "기저귀 대형")
 * - containedBy: 지금 친 글자가 과거 이름을 품고 있음 ("기저귀 대형 2팩" → "기저귀")
 */
export const ITEM_NAME_MATCH_RANK = {
  exact: 0,
  prefix: 1,
  contains: 2,
  containedBy: 3
} as const;

/**
 * 지금 친 글자(query)와 과거 품목명(candidate)의 매칭 등급을 돌려준다. 매칭이 아니면 null.
 *
 * `containedBy`만 후보 이름이 2글자 이상일 것을 요구한다: 1글자 후보("물", "약")는 거의 모든
 * 긴 입력에 우연히 포함되어 엉뚱한 과거 기록을 최상위로 끌어올린다.
 */
export function itemNameMatchRank(query: string, candidate: string): number | null {
  const normalizedQuery = normalizeItemName(query);
  const normalizedCandidate = normalizeItemName(candidate);
  if (normalizedQuery.length < ITEM_NAME_MATCH_MIN_QUERY_LENGTH) return null;
  if (normalizedCandidate.length === 0) return null;

  if (normalizedQuery === normalizedCandidate) return ITEM_NAME_MATCH_RANK.exact;
  if (normalizedCandidate.startsWith(normalizedQuery)) return ITEM_NAME_MATCH_RANK.prefix;
  if (normalizedCandidate.includes(normalizedQuery)) return ITEM_NAME_MATCH_RANK.contains;
  if (normalizedCandidate.length >= 2 && normalizedQuery.includes(normalizedCandidate)) {
    return ITEM_NAME_MATCH_RANK.containedBy;
  }
  return null;
}

/** 최신순 정렬이 읽는 필드만 구조적으로 요구한다(지출 발생일, ISO `YYYY-MM-DD`). */
export type ItemNameRecencyRow = { spentOn?: string };

/**
 * 최신(spentOn 내림차순) 우선으로 정렬한 **복사본**을 돌려준다. ISO 날짜 문자열은 사전순
 * 비교가 시간순 비교와 일치한다. `spentOn`이 없는 행은 맨 뒤로 보내고, 같은 날짜끼리는
 * 입력 순서를 유지한다(ES2019부터 Array#sort는 안정 정렬).
 */
export function sortByRecency<T extends ItemNameRecencyRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const left = a.spentOn ?? "";
    const right = b.spentOn ?? "";
    if (left === right) return 0;
    return left < right ? 1 : -1;
  });
}
