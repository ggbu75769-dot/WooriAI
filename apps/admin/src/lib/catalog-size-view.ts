// 라운드 83 트랙 C — 대시보드 "활성 준비템" 카드가 쓰는 순수 표시 로직.
//
// ⚠️ **이 모듈은 판정하지 않는다. 인용한다.** 문턱(카탈로그 200건)은 여기서 새로 정한 값이
// 아니라 docs/operations/known-limitations.md **N-4**가 준비템 탭 비가상화를 기각하며 적어 둔
// **재개 트리거**이고, 라운드 82가 `getHome`의 카탈로그 전량 읽기를 기각하며 적은 재개 조건도
// 같은 값이다. W-3이 그 공백을 이름으로 적어 두었다: *"카탈로그의 크기를 세는 자리는 오늘도
// 0건이다"* — 표를 늘리는 것은 어드민(items-catalog.service.ts의 `adminCreateItemTemplate`)이고
// 늘어난 날 아무 코드도 바뀌지 않으므로, 문턱은 코드 리뷰가 아니라 운영이 넘는다.
//
// 화면과 분리해 두는 이유는 worker-health-view.ts의 `brokenLinkCountCaption`과 같다 — 문장이
// 갈리는 자리를 테스트로 못 박기 위해서다. 형식도 그 함수를 그대로 따른다(수 + 그 수를 어떻게
// 읽어야 하는지 한 줄).
//
// ## 이 모듈이 하지 않는 것 (값으로 적어 둔다)
//
//  · **알림·경고·차단 0건.** 문턱을 넘었을 때 무엇을 할지는 **운영 결정**이다. 이 카드가 만드는
//    것은 **보이는 수 하나**이고, 캡션은 "그때 다시 판정하기로 적어 두었다"는 사실의 인용까지다.
//  · **밴드별 표시 행 수 0건.** N-4의 두 번째 트리거(*"한 밴드의 표시 행 100"*)는 여기서 세지
//    않는다 — `ItemTemplateStage`에 `ItemTemplate` 관계 필드가 없어(apps/api/prisma/schema.prisma)
//    `where: { itemTemplate: { active: true } }`를 쓸 수 없고, 우회는 활성 id 전량을 먼저 읽는
//    비례 조회이거나 원시 SQL이라 dashboard-summary.service.ts가 스스로 적어 둔 규율
//    (*"no row scans, no aggregation"*) 밖이다. **재개 조건: 그 관계 필드가 생기는 날, 또는 이
//    카운트가 아래 문턱을 넘는 날**(그날은 어차피 두 트리거를 함께 다시 판정한다).
//  · **목록으로 넘어가는 링크 0건**(화면 쪽 계약). 이 수의 모집단은 `active=true` 전수인데
//    준비템 목록 화면의 모집단이 그것과 같다고 말할 수 없다 — 라운드 44 N-5가 깨진 링크 카드에서
//    겪은 어긋남(카드의 수와 넘어간 목록의 줄 수가 다르다)을 되풀이하지 않는다.

/**
 * N-4가 준비템 탭 비가상화를 **다시 판정하겠다고 적어 둔 카탈로그 크기**.
 * ⚠️ 새로 정한 문턱이 아니라 **인용**이다(known-limitations.md N-4 · 라운드 82의 `getHome` 기각).
 * 조건은 *"200건을 **넘는** 날"* 이라 경계값 200 자체는 아직 아래다.
 */
export const CATALOG_SIZE_REVIEW_THRESHOLD = 200;

/**
 * 문턱이 도래하려면 활성 준비템이 **몇 개 더 늘어야 하는가**.
 * 조건이 "초과"이므로 문턱과 같은 수(200)에서도 **하나**가 남는다. 이미 넘었으면 0.
 */
export function catalogSizeRemainingToThreshold(activeCount: number): number {
  return Math.max(0, CATALOG_SIZE_REVIEW_THRESHOLD - activeCount + 1);
}

/** 활성 준비템 수가 N-4의 재개 트리거를 넘었는가(초과 — 같은 수는 아직 아니다). */
export function isCatalogSizeOverThreshold(activeCount: number): boolean {
  return activeCount > CATALOG_SIZE_REVIEW_THRESHOLD;
}

/**
 * "활성 준비템" 카드에 붙는 캡션. 값이 문턱 아래/위에서 문장이 갈린다.
 *
 * 두 갈래 모두 **문턱을 인용**할 뿐 새 판정을 만들지 않는다 — 넘은 쪽에서도 무엇을 하라고
 * 말하지 않고, 저장소가 "그때 다시 판정한다"고 적어 두었다는 사실만 적는다(처분은 운영 결정).
 */
export function catalogSizeCaption(activeCount: number): string {
  if (isCatalogSizeOverThreshold(activeCount)) {
    return `재검토 문턱(카탈로그 ${CATALOG_SIZE_REVIEW_THRESHOLD}건 초과)을 넘었어요 — 준비템 탭 렌더와 홈 카탈로그 조회를 다시 판정하기로 적어 둔 조건이에요(운영 한계 N-4).`;
  }
  return `재검토 문턱은 카탈로그 ${CATALOG_SIZE_REVIEW_THRESHOLD}건 초과예요 — ${catalogSizeRemainingToThreshold(activeCount)}개 더 늘면 도래해요(운영 한계 N-4).`;
}
