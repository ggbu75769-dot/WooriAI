import { normalizeRecordSearchText } from "./records-list-view";

/**
 * 라운드 101 웨이브 2 트랙 F7 — 기록 탭 **최근 검색어 칩**의 순수 로직.
 *
 * ## 무엇이 문제였나
 * 기록 탭 검색은 매번 처음부터 다시 친다. "조리원 비용이 언제였더라"를 이번 주에 세 번 찾는
 * 사용자는 같은 검색어를 세 번 다시 치고, 전체 기간 검색(라운드 101 트랙 A)이 생긴 뒤로는
 * "지난번에 그 검색으로 찾았던 그 화면"으로 돌아가는 길이 더 길어졌다. 그래서 검색 입력에
 * 포커스가 있고 **검색어가 비어 있을 때만** 최근 검색어 최대 5개를 칩으로 내민다 — 탭 한 번이
 * 곧 그 검색이다.
 *
 * ## 판정 한 벌 (K-12의 규율)
 * 검색어의 정규화·동일성은 **검색 필터와 같은 규칙**을 쓴다: 접기는
 * `normalizeRecordSearchText`(줄바꿈·연속 공백 한 칸 + 트림)이고, 중복 판정은 그 필터가
 * 비교할 때 거는 것과 같은 `toLowerCase()`다(matchRecordSearch — 저장은 사용자가 친 표기
 * 그대로, 비교만 소문자). 규칙이 두 벌이면 "같은 결과를 내는 두 검색어"가 칩 두 개로 선다.
 *
 * ## 저장 시점 — "검색 결과를 실제로 본 뒤"
 * 화면의 검색은 keystroke마다 즉시 걸린다(onChangeText → setSearchText, 디바운스 없음). 확정
 * 신호가 될 만한 자리를 실소스에서 찾아보면: `returnKeyType="search"`는 있지만 onSubmitEditing
 * 배선이 없고(키보드의 검색 키는 키보드만 닫는다), 제출·확정 버튼도 없다 — 즉 이 화면에
 * "검색을 확정했다"는 더 단순한 신호는 **없다**. 그래서 다음 두 사실이 함께 설 때만 기록한다:
 *   - 검색어가 `RECENT_SEARCH_RECORD_DELAY_MS`(300ms) 이상 그대로 유지됐다(타이핑 중의 낱자
 *     "조", "조리"가 이력을 채우지 않는다), 그리고
 *   - 그 검색어로 화면에 **결과가 1건 이상** 보였다(0건 검색은 다시 쓸 이유가 없는 이력이다).
 * 판정(`recentSearchRecordDelayMs`)은 여기, 타이머 배선은 화면(app/(tabs)/records.tsx)에 있다.
 *
 * ## 상한·중복 — 슬라이스의 두 끝을 모두 가드
 * 추가(`addRecentSearchTerm`)와 저장본 복원(`sanitizeRecentSearches`)이 **같은 함수 한 벌**을
 * 지나므로, 쓰는 쪽과 읽는 쪽 어느 끝으로도 5개 상한·중복·빈 문자열이 새어 들 수 없다
 * (옛/손상 persist blob도 복원 시점에 같은 규칙으로 걸러진다).
 *
 * 저장소/네트워크/React 의존 없음 — vitest 단위 테스트 대상(recent-searches.test.ts).
 * persist는 src/stores/recent-searches.store.ts가 진다(기기 단위 저장 · 계정 경계는
 * session-teardown이 사용자 단위로 지운다 — 그쪽 주석 참고).
 */

/** 칩 상한. 검색 입력 아래 한두 줄에 접히는 만큼만 — 최근 항목 칩(recent-items.ts)과 같은 5다. */
const RECENT_SEARCH_LIMIT = 5;

/** 검색어가 이만큼 유지되고 결과가 보였을 때만 이력에 남긴다(위 헤더의 저장 시점 근거). */
const RECENT_SEARCH_RECORD_DELAY_MS = 300;

const RECENT_SEARCHES_TITLE = "최근 검색어";
const RECENT_SEARCHES_CLEAR_ALL_LABEL = "전체 지우기";

/** 중복 판정 키 — matchRecordSearch가 비교에 쓰는 것과 같은 소문자 접기(판정 한 벌). */
function recentSearchDedupeKey(term: string): string {
  return term.toLowerCase();
}

/**
 * 저장본(또는 임의의 unknown)에서 살릴 수 있는 목록만 남긴다: 문자열이 아닌 항목 제외,
 * 정규화 후 빈 문자열 제외, 중복(소문자 키) 중 앞선 것만, 최대 5개.
 *
 * 추가 경로(`addRecentSearchTerm`)도 이 함수를 그대로 지나므로 규칙이 한 벌이다.
 */
export function sanitizeRecentSearches(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seenKeys = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const term = normalizeRecordSearchText(entry);
    if (term.length === 0) continue;
    const key = recentSearchDedupeKey(term);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    result.push(term);
    if (result.length >= RECENT_SEARCH_LIMIT) break;
  }
  return result;
}

/**
 * 검색어 하나를 이력 맨 앞에 세운다(최신 우선). 같은 검색어(소문자 키)는 한 번만 남고
 * **가장 최근 표기**가 이긴다 — 비교는 소문자지만 보여 주는 것은 사용자가 마지막으로 친
 * 그대로다(matchRecordSearch가 조각을 원문 그대로 보여 주는 것과 같은 판단).
 *
 * 변화가 없으면(빈 검색어 · 이미 맨 앞에 같은 표기로 있음) **원본 배열을 그대로** 돌려준다 —
 * 스토어가 같은 값 setState를 눕힐 수 있게(records-view.store의 setter 관례).
 */
export function addRecentSearchTerm(list: string[], text: string | null | undefined): string[] {
  const term = normalizeRecordSearchText(text);
  if (term.length === 0) return list;
  if (list[0] === term) return list;
  return sanitizeRecentSearches([term, ...list]);
}

/** 칩 하나의 개별 삭제. 없는 검색어면 원본 배열 그대로다(같은 값 setState 눕히기). */
export function removeRecentSearchTerm(list: string[], text: string): string[] {
  const key = recentSearchDedupeKey(normalizeRecordSearchText(text));
  if (key.length === 0) return list;
  const next = list.filter((entry) => recentSearchDedupeKey(entry) !== key);
  return next.length === list.length ? list : next;
}

/**
 * 이 검색을 이력에 남길지, 남긴다면 몇 ms 유지된 뒤인지. `null`이면 기록하지 않는다.
 *
 *  - 검색어가 비면(공백뿐이어도) null — 기록할 것이 없다.
 *  - 결과가 0건이면 null — "실제로 본 결과"가 없는 검색어는 다시 쓸 이력이 아니다
 *    (로딩·오류 중에는 화면이 resultCount 0을 넘기므로 자연히 기다린다).
 *  - 둘 다 서면 300ms — 타이핑 중의 낱자가 이력을 채우지 않게 하는 유지 시간이다(헤더 참고).
 */
export function recentSearchRecordDelayMs(input: {
  /** 검색어 원본(트림 전) — 화면의 searchText 그대로. */
  searchText: string | null | undefined;
  /** 그 검색어로 화면에 실제로 선 행 수(필터 적용 후, 로딩·오류 중이면 0). */
  resultCount: number;
}): number | null {
  if (normalizeRecordSearchText(input.searchText).length === 0) return null;
  if (!Number.isInteger(input.resultCount) || input.resultCount <= 0) return null;
  return RECENT_SEARCH_RECORD_DELAY_MS;
}

/**
 * 칩 줄을 그릴지 — 검색 입력에 포커스가 있고, 검색어가 비어 있고(공백뿐이어도 빈 것),
 * 보여 줄 이력이 있을 때만. 검색어를 치기 시작하는 순간 접힌다(그 자리는 결과의 것이다).
 */
export function isRecentSearchRowVisible(input: {
  searchFocused: boolean;
  /** 검색어 원본(트림 전). */
  searchText: string | null | undefined;
  recentSearches: readonly string[];
}): boolean {
  if (!input.searchFocused) return false;
  if (normalizeRecordSearchText(input.searchText).length > 0) return false;
  return input.recentSearches.length > 0;
}

/** 칩 줄 위에 서는 제목 한 줄. */
export function recentSearchesRowTitle(): string {
  return RECENT_SEARCHES_TITLE;
}

/** 칩 본체의 스크린리더 라벨 — 무엇이 일어나는지가 문장 안에 있다(recent-items 칩과 같은 관례). */
export function recentSearchChipAccessibilityLabel(term: string): string {
  return `${RECENT_SEARCHES_TITLE} ${term} 다시 검색`;
}

/** 칩의 X 버튼 라벨 — 아이콘만 따로 들으면 무엇을 지우는지 알 수 없다. */
export function recentSearchRemoveAccessibilityLabel(term: string): string {
  return `${RECENT_SEARCHES_TITLE} ${term} 지우기`;
}

/** 전체 지우기 버튼의 표시 라벨. */
export function recentSearchesClearAllLabel(): string {
  return RECENT_SEARCHES_CLEAR_ALL_LABEL;
}

/** 전체 지우기의 스크린리더 라벨 — 버튼만 따로 들어도 대상이 문장 안에 있다. */
export function recentSearchesClearAllAccessibilityLabel(): string {
  return `${RECENT_SEARCHES_TITLE} ${RECENT_SEARCHES_CLEAR_ALL_LABEL}`;
}
