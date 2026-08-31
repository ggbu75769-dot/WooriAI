/**
 * 준비템 목록 검색 입력의 **판정 두 개**(PreparationListParity의 두 effect가 쓴다).
 *
 * 순수 모듈로 뺀 이유: 화면 컴포넌트는 react-native를 import해서 이 저장소의 vitest에서 실행할
 * 수 없다. 그런데 여기서 틀렸던 것은 렌더가 아니라 **판정**이었으므로, 판정만 꺼내 두면 두
 * 시나리오를 소스 그렙이 아니라 실제 호출로 고정할 수 있다.
 *
 * 고친 두 가지:
 *
 * 1. **다 지운 검색어를 보내지 않았다.** 디바운스 조건이 `if (!query || …) return`이라 빈
 *    문자열은 아예 나가지 않았다 — 사용자가 검색어를 지워도 목록은 계속 걸러진 채 남아,
 *    입력칸이 말하는 것과 화면이 말하는 것이 어긋났다. 빈 문자열도 "검색을 그만두겠다"는 하나의
 *    입력이다.
 * 2. **밖에서 비운 검색어를 입력칸이 따라가지 않았다.** 동기화 조건이 `activeSearchQuery &&`라
 *    빈 값일 때만 건너뛰었다 — "필터 초기화"로 목록은 전체로 돌아왔는데 입력칸에는 옛 검색어가
 *    남아, 그 글자가 지금 걸린 필터처럼 읽혔다.
 */

/**
 * 디바운스가 실제로 내보낼 검색어. 보낼 변화가 없으면 `null`.
 *
 * `draft`는 다듬어서(trim) 비교한다 — 공백만 남은 입력은 빈 검색어와 같은 뜻이다.
 */
export function pendingSearchSubmission(draft: string, submitted: string): string | null {
  const query = draft.trim();
  return query === submitted ? null : query;
}

/**
 * 밖에서 바뀐 검색어(`activeSearchQuery`)로 입력칸을 맞춰야 하는가.
 *
 * 값이 다르면 언제나 맞춘다 — 비워지는 경우도 포함이다.
 */
export function shouldSyncSearchDraft(draft: string, activeSearchQuery: string): boolean {
  return draft !== activeSearchQuery;
}

/**
 * 검색 결과 줄이 **소리로** 나갈 때의 그 한 문장.
 *
 * 라운드 90 트랙 A(#1) — 준비템 탭의 검색 결과 개수 줄에는 `accessibilityLiveRegion="polite"`가
 * 반쪽으로 걸려 있었다. 그 프롭은 RN 문서가 `@platform android`로 표시한 것이고 iOS/VoiceOver에는
 * 대응하는 짝이 없어, **안드로이드에서만** 소리가 났다 — 검색을 제출한 사람이 iOS에서는
 * *아무 일도 일어나지 않은 것*처럼 듣는다. 눈으로는 굵은 글씨 한 줄이 서는데, 소리로는 목록이
 * 조용히 줄어들 뿐이다. 저장소의 크로스플랫폼 출구는 `announceForA11y`(src/ui.tsx)이고,
 * 화면이 그 함수에 넘길 문장을 여기서 짓는다.
 *
 * ⚠️ **새 한국어는 한 글자도 없다** — 이 템플릿은 화면이 이미 그리는 그 줄과 **글자로 같다**
 * (`‘{activeSearchQuery}’ 검색 결과 {displayedItems.length}개`). 눈과 귀가 다른 말을 하지
 * 않는다는 계약(a11y-contract.test.ts)이 두 자리의 산출을 실제로 맞춰 본다 — 화면의 렌더
 * 바이트는 이 라운드에 한 글자도 움직이지 않았으므로, 갈리면 이쪽이 먼저 빨개진다.
 *
 * ⚠️ 문장을 화면이 아니라 모듈이 짓는 이유는 두 가지다: ⓐ 화면 파일은 react-native를 값으로
 * import해 이 저장소의 vitest에서 실행할 수 없고(이 파일 머리말), ⓑ 낭독 문장은 실행해서
 * 확인해야 하는 값이지 소스 그렙으로 확인할 값이 아니다.
 */
export function searchResultCountAnnouncement(query: string, count: number): string {
  return `‘${query}’ 검색 결과 ${count}개`;
}
