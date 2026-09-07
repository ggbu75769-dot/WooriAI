# 라운드 104 스카우트 C — 체감 속도와 정보 밀도 실측

> 기준: 2026-09-07 03:50~04:20 (KST 기준 워킹트리 HEAD, git 명령 미사용 — 파일 실독만).
> 방법: 추측 없이 **소스가 실제로 하는 일**만 적는다. 쿼리 수·의존 관계·재계산 조건·순회 횟수는
> 값으로 세었고, 그 수를 어디서 셌는지(파일:줄)를 함께 적는다.
> 읽은 것: `app/(tabs)/*.tsx` 5벌(11,726줄) · `src/api/client.ts` · `src/query/*` ·
> `src/expenses/{records-list-view,records-search-scope,use-search-scope-collection,month-expenses}.ts` ·
> `src/preparation/PreparationListParity.tsx` · `src/offline/sync-controller.ts` ·
> `app/expenses/{new,[expenseId]}.tsx` · `app/items/[itemTemplateId].tsx` · `app/_layout.tsx` ·
> `apps/api/src/onboarding/reporting-store.service.ts` · `apps/api/prisma/seed-data.ts`.
>
> ⚠️ **지적 대상에서 뺀 것(다른 에이전트가 편집 중)**: `apps/mobile/app/settings/` ·
> `apps/mobile/src/categories/`(디렉터리) · `apps/mobile/src/api/api-error.ts` ·
> `apps/mobile/src/family/record-permissions.ts` · `apps/mobile/src/route-surface.test.ts`.
> (`apps/mobile/src/categories.ts`는 그 **디렉터리와 다른 파일**이지만, 경계가 붙어 있어 아래
> 발견 6은 그 파일을 건드리지 않는 안으로 좁혔다.)
>
> ⚠️ **라인 번호 유효기간.** `app/(tabs)/index.tsx`는 이 정찰이 도는 사이에 실제로 바뀌었다
> (mtime `2026-09-07 03:45:02`, 첫 훑기와 재훑기 사이 쿼리 선언이 4줄 밀렸다 — 첫 grep `1174` →
> 재확인 `1178`). 이 노트의 index.tsx 줄 번호는 **재확인 시점 값**이고, 인용은 전부 심볼명을
> 함께 적어 줄이 밀려도 찾아갈 수 있게 했다. 홈 탭을 만지는 트랙이 이미 하나 더 있다는 뜻이므로
> 아래 트랙 경계에서 그 파일을 **단독 소유로 묶지 않았다**.

---

## 요약

| # | 한 줄 | 체감 영향 | 크기 | 즉시 착수 |
| --- | --- | --- | --- | --- |
| 1 | "전체 기간에서 찾기"가 21~33개월을 **한 달씩 직렬로** 걷는다(왕복 수는 그대로 두고 동시성만 주면 된다) | 상 | M | 가능 |
| 2 | 기록 탭 검색은 **디바운스가 없다** — 전체 기간 스코프에서는 키 한 번마다 수집한 전 기간 행을 다시 훑고 SectionList를 다시 만든다 | 상 | M | 가능 |
| 3 | 지출 상세가 **목록 캐시에 이미 있는 그 행**을 두고 네트워크를 기다리며 스켈레톤 3장을 그린다 | 상 | S | 가능 |
| 4 | 준비템 탭에 `useMemo`가 **0개** — 렌더마다 카탈로그를 14번 훑고, 자식의 `useMemo` 2개를 매번 무효화한다 | 중 | M | 가능(선행 정리 필요) |
| 5 | 준비템 상세도 목록 캐시의 이름·상태를 두고 **빈 스켈레톤 5장**을 그린다(같은 파일에 캐시 읽기 선례가 이미 있다) | 중 | S | 가능 |
| 6 | 홈 "최근 지출" 3줄이 분류 이름을 말하지 않는다 — **그러기로 한 근거가 지금은 사실이 아니다** | 중 | S | 가능 |
| 7 | 준비템 상태 체크 한 번마다 SQLite 전량 읽기 2회가 촉각·시각 확인 **앞에** 선다 | 하 | M | 이월 권고 |

---

## 발견 1 — "전체 기간에서 찾기"는 달을 한 줄로 세워 하나씩 기다린다

**1. 무엇이 기다림으로 보이나.** 기록 탭에서 "조리원"을 치고 [전체 기간에서 찾기]를 누르면 버튼이
잠기고 `불러오는 중 1/21 … 2/21 …`이 한 칸씩 오른다 — 21번(아이가 크면 33번)의 네트워크 왕복이
**끝나야** 결과가 선다.

**2. 근거.**
- `apps/mobile/src/expenses/records-search-scope.ts:106-121` `collectSearchScopeMonths` —
  `for (let index = months.length - 1; index >= 0; index -= 1) { … await ensureMonth(yearMonth); … }`.
  루프 몸통이 `await` 하나뿐이므로 **동시성 1**이다.
- `apps/mobile/src/expenses/use-search-scope-collection.ts:118-136` — `ensureMonth`는
  `queryClient.ensureQueryData({ queryKey: ["expenses", childId, yearMonth], queryFn: fetchMonthExpenses(...), retry: 1 })`.
  같은 파일 `:129-131` 주석이 이 성질을 이미 값으로 적어 두었다: *"이 루프가 21개월을 직렬로
  걷기 때문이다(달마다 재시도가 길면 수집 전체가 그 배수로 늘어진다)"*.
- 달 수 = `resolveSearchScopeMonths`(`records-search-scope.ts:63-79`) →
  `monthJumpFloorYearMonth`(`apps/mobile/src/month-jump.ts:197-207`) → 하한은
  `resolveMonthJumpEarliestMonth`(`month-jump.ts:163-175`)의 **앵커 연도 − 1년 1월**.
  · 2026-03 출생 → 하한 `2025-01`, 상한 이번 달 `2026-09` = **21개월**(코드 주석의 그 21이다).
  · 2025-06 출생 → 하한 `2024-01` = **33개월**.
- 달 하나당 요청 수: `fetchMonthExpenses`(`apps/mobile/src/expenses/month-expenses.ts:48-51`)가
  `limit = EXPENSE_LIST_MAX_LIMIT = 500`(`packages/contracts/src/schemas.ts:300`)으로 커서 루프를
  돈다 — 월 500건 이하면 왕복 1회. 즉 **직렬 21~33 왕복**이 통상값이고, 캐시가 따뜻한 달은 0회다.
- 진행 라벨은 `searchScopeCollectingProgressLabel`(`records-search-scope.ts:158-166`)이 만든다 —
  즉 **저장소도 이 대기가 눈에 보인다는 것을 알고 있고**, 그래서 진행 표시를 붙여 뒀다.

**3. 얼마나 자주.** 사용자가 그 버튼을 누를 때마다(온디맨드 — 자동 전환은 없다). 실패한 달의
[다시 시도]도 같은 루프를 탄다.

**4. 고치는 크기 — M(파일 2: 소스 1 + 테스트 1).** `collectSearchScopeMonths`의 for-루프를
**고정 동시성 워커 풀**(예: 4~6)로 바꾼다. 순수 함수라 화면·훅·계약 타입은 한 글자도 바뀌지 않고,
`ensureMonth` 주입 규약도 그대로다. **서버 왕복 수는 정확히 같다**(달마다 정확히 한 번, 캐시된
달은 여전히 0회) — 늘어나는 것은 동시에 떠 있는 요청 수뿐이다. 결과 배열은 인덱스 자리에 써 넣어
현재의 "최신 달부터" 순서를 그대로 보존한다(`failedMonths`는 지금도 마지막에 `sort()`한다).

**5. 막는 것.**
- `apps/mobile/src/expenses/records-search-scope.test.ts`의 수집 순서·부분 실패·진행 콜백 계약 —
  `onProgress(done, total)`가 지금은 "끝난 순서 = 걷는 순서"라 동시성이 들어오면 `done`이 달 순서와
  분리된다(값은 여전히 단조 증가여야 한다). 테스트를 그 뜻으로 다시 적어야 한다.
- `use-search-scope-collection.ts:26-31, 129-131`의 머리말 주석이 "직렬"을 전제로 `retry: 1`을
  정당화한다 — 근거 문장을 함께 갱신하지 않으면 다음 라운드가 근거 없이 되돌린다.
- 새 npm 의존성 0(Promise만으로 가능) · 계약 변경 0 · 픽셀락 무접촉.

---

## 발견 2 — 기록 탭 검색은 키 한 번마다 전 기간을 다시 훑는다(디바운스 없음)

**1. 무엇이 기다림으로 보이나.** 전체 기간 검색을 켜 둔 채 검색어를 고치면(한 글자 지우기,
"조리원비" → "조리원") 키 입력마다 목록 전체가 다시 계산되고 SectionList가 통째로 다시 그려진다.
저사양 안드로이드에서 글자가 늦게 따라오는 그 구간이다.

**2. 근거.**
- 입력은 즉시 상태다: `app/(tabs)/records.tsx:2209` `onChangeText={setSearchText}`. 같은 파일
  `:1618-1622` 주석이 스스로 적어 뒀다 — *"이 화면의 검색은 keystroke마다 즉시 걸리고
  (onChangeText — 디바운스 없음)"*.
- 재계산되는 사슬(전부 `searchText`에 직접·간접으로 묶여 있다):
  · `records.tsx:1537-1558` `visibleExpenses/visibleOfflineRows` — deps `[scopeServerExpenses,
    scopeOfflineRows, selectedCategoryIds, searchText]`. 모집단 전량에 `matchRecordSearch`.
  · `records.tsx:1562-1610` `listData` — 통과한 행마다 객체 신규 생성.
  · `records.tsx:1644-1650` `dateGroups` → `:1655-1668` `sections` → `:1683-1687`
    `filteredSubtotalKrw` → `:1698-1711` `filterScopeSummary`.
- **모집단 크기**가 스코프에 따라 갈린다: `records.tsx:1438-1450` `fullScopePopulation`이
  수집한 **모든 달**을 이어 붙이고, `:1451-1452`가 `scopeServerExpenses`로 넘긴다. 즉 전체 기간
  스코프에서는 21~33개월치 행(월 200건이면 4,000~6,000행)이 **키 한 번마다** 다시 훑린다.
- 행 하나당 비용: `records-list-view.ts:999-1051` `matchRecordSearch`가
  `normalizeRecordSearchText`(`:967-969`, 정규식 `\s+` 치환 + trim)를 **4회**, `toLowerCase()`를
  최대 4회, 경계 걸침 갈래에서 문자열 결합 1회를 한다.
- 스코프는 타이핑 중에 유지된다: `records.tsx:872-885` — 수집물은 **검색어가 빌 때만** 걷힌다
  (`if (searchText.trim().length > 0) return;`). 글자를 더 치거나 지워도 전체 스코프 그대로다.
- **같은 저장소에 반대 선례가 있다**: 준비템 탭의 검색은
  `src/preparation/PreparationListParity.tsx:428-445`에서 350ms 디바운스로 확정된다
  (`searchDraft` 로컬 state → `onSearch(query)`). 즉 이 앱은 그 패턴을 이미 갖고 있고, 기록 탭만
  갖고 있지 않다.

**3. 얼마나 자주.** 기록 탭에서 **키를 누를 때마다**. 월 스코프에서는 그 달의 행 수(수십~수백)
만큼, 전체 기간 스코프에서는 수집한 전 기간 행 수만큼.

**4. 고치는 크기 — M(파일 1: `records.tsx`).** 준비템 탭과 **같은 모양**으로 입력 초안
(`searchDraft`)과 확정 검색어(`searchText`)를 분리한다. 입력칸은 초안을 그려 즉시 반응하고,
무거운 사슬은 확정값에만 걸린다. 새 요청 0건 · 계약 타입 0 · 순수 모듈 무접촉(필터·스니펫·
그룹핑 규칙은 한 글자도 바뀌지 않는다). 디바운스 상수는 준비템 탭의 350ms와 **같은 값**으로 두어
한 앱 안에서 검색 확정 시점이 갈리지 않게 한다.

**5. 막는 것.**
- `records.tsx:1624-1637` `recentSearchRecordDelayMs`(검색어 유지 300ms + 결과 1건 이상)가
  `searchText`를 신호로 쓴다. 디바운스가 들어가면 최근 검색어 저장이 **350ms만큼 늦어진다** —
  판정 자체는 그대로 두되 "무엇을 확정으로 보는가"가 한 겹 바뀐다는 사실을 순수 모듈 주석에
  남겨야 한다(`src/expenses/` 순수 모듈은 건드리지 않고 화면 쪽 배선만 바꾸는 안이다).
- `PreparationListParity.tsx:624-628`의 검색 결과 낭독처럼, 기록 탭도 결과 수를 말하는 자리가
  있다(`filterScopeSummary`). 낭독/라이브 리전 타이밍이 350ms 밀린다 — A11Y 관례상 오히려
  낱자 낭독이 줄어드는 방향이지만, 값으로 적어야 한다.
- `apps/mobile/src/records-list-virtualization.test.ts:63-67` — ListHeader를 **엘리먼트**로
  넘기는 계약(검색 TextInput이 포커스를 잃지 않게)과, `:99-100` `listExpenses(authToken!` 호출
  지점 **정확히 2개** 상한. 이 안은 조회를 늘리지 않으므로 후자는 그대로 통과하지만, 같은 파일을
  만지므로 두 계약 모두 재확인 대상이다.

---

## 발견 3 — 지출 상세는 손에 든 행을 두고 네트워크를 기다린다

**1. 무엇이 기다림으로 보이나.** 기록 탭(또는 홈 최근 기록)에서 줄 하나를 누르면 상세 화면이
**스켈레톤 카드 2장 + 줄 1개**로 열리고, 방금 목록에서 읽은 품목명·금액·날짜가 왕복 한 번 뒤에
나타난다.

**2. 근거.**
- `app/expenses/[expenseId].tsx:277-281` — `useQuery({ queryKey: ["expense", expenseId], … })`,
  `initialData`/`placeholderData` **없음**. ⚠️ 이 세 옵션(`initialData` · `placeholderData` · `keepPreviousData`)은 **`apps/` · `packages/` 전수에서 0건**이다 — 즉 이 앱은 "이미 받은 데이터로 먼저 그리는" 수단을 한 번도 쓰지 않는다.
- `:892-897` `resolveScreenPhase({ isPending, isError, hasData })` → `:932-944`
  `expensePhase === "loading"` 갈래가 `<SkeletonCard /><SkeletonCard /><SkeletonRow />`.
- **필요한 값은 이미 캐시에 있다.** `getExpense`는 `Expense`를 돌려주고
  (`src/api/client.ts:1047-1050`), 목록 캐시 `["expenses", childId, ym]`의 원소도 **같은
  `Expense` 타입**이다(`client.ts:138-168`). 부분 타입이 아니라 **동일 타입**이라
  `initialData`가 성립한다.
- 이 화면은 **이미 그 캐시를 읽고 있다** — 다만 자기 행이 아니라 이력용으로만:
  `:529-545` `queryClient.getQueryData<MonthExpenses>(["expenses", historyChildId, currentYearMonth])`
  + 지난달까지. 주석이 규율을 못 박아 뒀다: *"useQuery가 아니라 getQueryData — 상세 화면을 여는
  것만으로 새 요청이 도는 일이 없다"*.
- **늦게 오는 더 정확한 값을 다루는 기계도 이미 있다.** `:454-495` 폼 시딩 effect가
  "손 안 댄 폼이면 새 서버 값 채택 / 손댔으면 값은 지키고 고지 한 줄"을 이미 구현한다
  (`expenseEditBaselineOf` · `sameExpenseEditBaseline` · `remoteChangeNotice`). 즉 캐시로 먼저
  칠하고 응답으로 수렴하는 시나리오가 **새로 만드는 상태가 아니다**.

**3. 얼마나 자주.** 지출 상세를 여는 **모든** 진입(기록 탭 행 탭 · 홈 최근 기록 행 탭 ·
알림/딥링크). 캐시가 비어 있는 딥링크 진입에서만 종전과 같다.

**4. 고치는 크기 — S(파일 1).** `["expenses"]` 프리픽스의 캐시를 훑어 그 `expenseId` 행을 찾고
(`queryClient.getQueriesData`), 있으면 `initialData`로 넘긴다. **새 요청 0건**(읽기만) ·
계약 변경 0 · 서버 무접촉.
⚠️ `initialDataUpdatedAt`을 **반드시 함께** 넘긴다(원본 쿼리의 `dataUpdatedAt`). 빠뜨리면
react-query가 그 값을 방금 받은 것으로 보고 전역 `staleTime: 30_000`(`app/_layout.tsx:22-34`)
동안 재조회를 하지 않는다 — 즉시 그리려다 낡은 값을 30초 붙드는 거래가 된다.

**5. 막는 것.**
- `apps/mobile/src/loading-skeleton-contract.test.ts:31` — 이 파일에 `<SkeletonCard />`·
  `<SkeletonRow />` 문자열이 **살아 있어야** 한다. 캐시가 없는 진입(딥링크)의 갈래로 그대로
  남으므로 통과하지만, 스켈레톤 분기를 지우는 방향은 금지다.
- 오프라인 대기 행(이 기기에서 방금 고친 값)은 `["expenses"]` 서버 캐시가 아니라 스냅숏에 있다.
  이 화면은 이미 스냅숏을 구독하므로(`:528` `useOfflineSyncSnapshot`) 캐시 행을 그대로 쓰면
  **재조정 없는 서버 행**을 한 프레임 보여줄 수 있다 — 목록 탭이 쓰는 재조정 규칙
  (`reconcileMonthlyExpenses`)과 같은 답을 내는지 값으로 확인해야 한다. 확신이 안 서면
  "대기 행이 있는 지출에는 initialData를 붙이지 않는다"가 안전한 하한이다.
- EXP-003 픽셀락은 비세션 렌더(`canLoadExpense === false`)라 이 경로에 닿지 않는다.

---

## 발견 4 — 준비템 탭에 `useMemo`가 0개다(그리고 그 때문에 자식의 `useMemo` 2개가 죽어 있다)

**1. 무엇이 기다림으로 보이나.** 준비템 탭에서 "준비했어요"를 누르거나 시기/필수도 칩을 바꿀
때마다 화면 전체가 다시 계산된다 — 탭 반응이 한 박자 늦게 붙는 그 느낌이다.

**2. 근거.**
- `grep -c useMemo`: `app/(tabs)/items.tsx` **0** / `records.tsx` 23 / `index.tsx` 15 /
  `reports.tsx` 0. 준비템 탭은 목록 화면인데 메모가 0이다.
- **렌더 한 번에 목록 전량을 도는 자리 14곳**(전부 `items.tsx`, 세션 렌더 경로):
  `:663` `effectiveStatusItems`(map) · `:676-677` `filterInterestedItems`(찜 켤 때) ·
  `:729` `filterItems` + `applyPreBirthFilter`(2회) · `:745` `computeEssentialPrepProgress` ·
  `:812` `buildNextStagePrepGapNote` · `:816` `nextPrepFocusIds` · `:817`
  `nextPrepFocusHintText`(**816과 같은 계산을 한 번 더** — `src/items/prep-milestones.ts:226,236`이
  둘 다 `selectNextPrepFocusItems`를 부른다) · `:826` `listedItems.map(id)` · `:928` `sessionRows` ·
  `:940` `new Map(sessionRows.map(...))`(2회) · `:945-962` `categoryGroups` 루프 · `:964`
  `parityItems`. 여기에 `:688` `buildCategoryNameLookup` · `:943` `buildTileCategoryResolver`
  두 개의 Map/Set 재조립이 더 붙는다.
- **모집단 크기**: `listItems(tab="all")`는 그 아이의 활성 카탈로그 전량이고, 시드 템플릿은
  **62건**(`apps/api/prisma/seed-data.ts:93` `itemTemplateSeeds` — 항목 62개, 실측) + 커스텀 품목.
  → 렌더당 약 **870회**의 항목 방문(14 × 62), 그 위에 자식 몫이 더 붙는다.
- **자식의 메모가 매 렌더 무효화된다.** `PreparationListParity`는 `React.memo`가 아니고
  (`src/preparation/PreparationListParity.tsx:297` 평범한 `export function`), 그 안의 두
  `useMemo`가 `items`/`categoryGroups` **참조**에 걸려 있다(`:396-403` `categories` —
  그룹 수 × N 필터, `:404-409` `populatedTimingBands` — 4 × N). `items.tsx`가 그 두 배열을
  렌더마다 새로 만드므로(`:964`, `:945`) **메모는 한 번도 적중하지 않는다**.
  그룹이 12개면 `categories`만으로 12 × 62 = **744회** 추가 방문.
- 같은 이유로 `:416-433`의 자동 펼침 effect(`deps: [activeSearchQuery, categories,
  expandedGroups, selectedContextKey]`)가 **렌더마다 재발화**해 `resolvePreparationAutoExpand`를
  다시 판정한다(결정이 null이면 조용히 빠져나가므로 루프는 아니다).
- **렌더를 유발하는 것들**(세어 둔다): ① 상태 체크 한 번마다 최소 3회
  (`setStatusErrorMessage(null)` · `setExpenseLinkPrompt(null)` · 스냅숏 알림) ② 시기/필수도/
  찜 칩 탭 ③ 검색 확정(350ms마다 1회) ④ 쿼리 상태 전이 ⑤ **오프라인 스냅숏 알림** —
  `src/offline/sync-controller.ts:183-232` `refreshSnapshot`은 내용이 같아도 **매번 새 객체**를
  실어 `notifySnapshotListeners()`를 부른다(같은 성질을 저장소가 이미
  `src/notifications/useHomeNotificationEvaluation.ts:276-282`에 값으로 적어 뒀다).

**3. 얼마나 자주.** 준비템 탭 렌더마다. 실사용에서 가장 잦은 자리는 **상태 체크 연타**(준비물
목록을 훑으며 체크하는 그 동작)이고, 체크 한 번에 위 계산이 3회 돈다.

**4. 고치는 크기 — M(파일 1: `items.tsx`).** 파생 14곳을 `useMemo`로 감싸고, 특히
`parityItems`/`categoryGroups`의 참조를 안정화해 자식의 두 메모를 되살린다.
⚠️ **선행 정리가 필수다**: 지금 그 파생은 전부 **조기 반환 아래**에 있다(`:611` 아이 미선택 ·
`:623` 조회 실패 · `:634` 로딩 — 파생 시작은 `:663`). 그대로 `useMemo`를 씌우면 훅이 조건부가
되어 규율 위반이다(홈이 같은 이유로 모션 훅을 조기 반환 위로 올려 둔 그 규율 —
`app/(tabs)/index.tsx`의 TOSS-T2 훅 묶음 주석). 즉 **훅을 조기 반환 위로 끌어올리는 재배치**가
같이 필요하고, 그게 이 트랙이 S가 아니라 M인 이유다. 값은 한 개도 바뀌면 안 된다(순수 모듈은
무접촉 — 감싸기만 한다). 덤으로 `:816-817`의 중복 계산은 `selectNextPrepFocusItems`를 한 번만
불러 두 값으로 나누면 순수 모듈 변경 없이 사라진다.

**5. 막는 것.**
- **ITEM-001 픽셀락**: 비세션 미리보기 렌더(`items.tsx:858` `if (!hasSession)` 갈래)는 한 픽셀도
  달라지면 안 된다. 훅을 위로 올리는 재배치가 그 갈래보다 위에서 일어나므로 **렌더 결과는
  불변이어야 하고**, 그 사실을 값으로 확인해야 한다.
- 훅 순서 불변 규율(렌더마다 훅 수가 같아야 한다) — 재배치의 유일한 실패 모드다.
- 새 npm 의존성 0(가상화 라이브러리 불필요 — 아래 "이미 돼 있다" 참고) · 서버 왕복 0 · 계약 0.

---

## 발견 5 — 준비템 상세도 목록이 이미 아는 이름·상태를 두고 빈 스켈레톤을 그린다

**1. 무엇이 기다림으로 보이나.** 준비템 타일을 누르면 상세가 **스켈레톤 카드 2장 + 줄 3개**로
열린다. 방금 타일에서 읽은 품목명·준비 상태·시기 라벨이 한 왕복 뒤에 나타난다.

**2. 근거.**
- `app/items/[itemTemplateId].tsx:458-462` — `useQuery({ queryKey: ["item-detail", childId,
  itemTemplateId], … })`, `placeholderData` 없음. `:826-840` 로딩 갈래가 스켈레톤 5장(`:829-838`).
- `ItemDetail = ItemSummary & { reasonText, productLinks, … }`(`src/api/client.ts:372-385`) —
  즉 **머리 부분(`name`·`status`·`necessityLevel`·`timingLabel`·`categoryId`)은 목록 응답에 전부
  있다**. 목록 캐시 키는 `["items", childId, "catalog"]`(`app/(tabs)/items.tsx:387-391`).
- **같은 파일에 캐시 읽기 선례가 이미 있다**: `:453-457`
  `queryClient.getQueryData<{children: Child[]}>(["children"])` — 주석이 규칙까지 적어 뒀다
  (*"useQuery가 아니라 getQueryData라 쿼리를 활성화하지 않고, 캐시가 비어 있으면 라벨이 null이라
  화면이 종전 그대로다 — 모르면 말하지 않는다"*). 준비템 자기 자신에만 그 규칙이 적용돼 있지 않다.

**3. 얼마나 자주.** 준비템 상세를 여는 모든 진입(목록 탭 타일 탭 · 홈 준비 카드 · 알림함
"샀나요?" 착지). 목록을 거치지 않은 딥링크에서만 종전과 같다.

**4. 고치는 크기 — S(파일 1).** `ItemDetail` 전체를 `initialData`로 넣을 수는 없다(`reasonText`·
`productLinks`가 목록에 없다 — **없는 값을 지어내면 안 된다**). 대신 **발견 3과 다른 안**이
맞다: 로딩 갈래의 첫 스켈레톤 자리에 캐시에서 읽은 **이름과 상태 배지만** 세우고, 상품 링크·
근거 문장 자리는 스켈레톤을 그대로 둔다. 캐시가 비면 지금과 한 픽셀도 다르지 않다
(`:453-457` 선례와 완전히 같은 모양 — 새 요청 0건 · 계약 0).

**5. 막는 것.**
- `loading-skeleton-contract.test.ts:27` — 이 파일의 `<SkeletonCard />`·`<SkeletonRow />`
  문자열이 살아 있어야 한다(위 안은 남긴다).
- **ITEM-002 픽셀락**은 비세션 프리뷰 렌더다(`:826` 갈래가 `hasSession &&`로 이미 게이트돼 있다).
  세션 갈래에만 손대면 캡처 무접촉이다.
- 준비템 **가격 표시**는 이번 범위 밖(이월) — `priceBandText`는 건드리지 않는다.

---

## 발견 6 — 홈 "최근 지출" 3줄이 분류를 말하지 않는다(그러기로 한 근거가 지금은 거짓이다)

**1. 무엇이 공백으로 보이나.** 홈의 최근 기록 세 줄은 `기저귀 · 45,900원 · 8월 27일`까지만
말한다. 같은 지출이 기록 탭에서는 `기저귀 · **기저귀/위생** · 8월 27일`로 읽힌다 — 홈에서 분류를
확인하려면 기록 탭으로 한 번 나갔다 와야 한다.

**2. 근거.**
- 홈 행의 부제는 `homeRecentExpenseSubtitle`이 만든다
  (`app/(tabs)/index.tsx:3123` 세션 렌더 · `src/expenses/records-list-view.ts:1104-1106`) —
  `recordsRowSubtitle({ expenseType, dateLabel })`만 넘긴다.
- 그렇게 한 **이유가 그 함수 머리말에 적혀 있다**(`records-list-view.ts:1096-1103`):
  *"홈은 `GET /home` 응답만 읽고 `["categories"]` 캐시를 **구독하지 않으므로**(그러려고 요청을
  하나 더 붙이면 홈 첫 화면 비용이 늘어난다) 카테고리 라벨 없이 같은 규칙을 쓴다."*
- **그 전제는 지금 사실이 아니다.** 홈은 `["categories"]`를 구독한다:
  `app/(tabs)/index.tsx:1178-1183` `categoriesQuery = useQuery({ queryKey: ["categories"],
  staleTime: 5분, queryFn: listCategories(..., { includeAll: true }) })`, 그리고 그 응답으로
  `:1184-1187` `resolveExpenseTileCategoryId`를 만들어 **바로 이 세 줄의 글리프**를 고른다
  (`:3114-3116`). 즉 라벨을 붙이는 데 드는 **추가 요청은 0건**이다.
- 받는 쪽도 이미 준비돼 있다: `recordsRowSubtitle`은 `categoryLabel`을 **이미 optional 인자로
  받는다**(`records-list-view.ts:838-869`), 토큰 순서도 `구분 → 작성자 → 분류 → 날짜`로 고정.

**3. 얼마나 자주.** 홈에 들어갈 때마다, 세 줄 전부. (핵심 루프 2단계 "총액 확인" 바로 아래 자리다.)

**4. 고치는 크기 — S(파일 1: `index.tsx`).** 세션 렌더의 그 map 안에서 분류 이름을 붙인다.
새 요청 0건 · 계약 0 · 순수 모듈 무접촉(공용 함수에 인자를 더하지 않고 화면에서
`recordsRowSubtitle`을 직접 부르는 안이면 `records-list-view.ts`도 안 건드린다).
⚠️ **지어내지 않기 가드가 필수다**: `buildCategoryNameLookup`은 못 찾은 id에 대해
`categoryNameFor` → 마지막에 **`"기타"`를 돌려준다**(`src/categories.ts:83-91`). 캐시가 비어 있는
콜드 스타트에서 그대로 쓰면 **모든 줄이 "기타"**라고 거짓을 말한다. 그러므로 `categoriesQuery.data`가
실제로 그 id를 갖고 있을 때만 라벨을 붙이고, 아니면 지금 문장 그대로 둔다("모르면 말하지 않는다" —
같은 화면의 `:453-457`류 규율).

**5. 막는 것.**
- **HOME-001 픽셀락**: 비세션 프리뷰 렌더는 별도 갈래이고 그 자리의 부제 호출은
  `index.tsx:2712`다(`visibleHome = authToken ? home.data! : previewHome` — `:1883`). 세션 갈래
  (`:3123`)만 바꾸면 캡처는 바이트 불변이다. **두 자리를 함께 바꾸면 캡처가 깨진다.**
- **DNC-018**: 더하는 것은 사실 토큰 하나(분류 이름)뿐 — 재촉·축하·평가 어휘 없음. 어순은 기록
  탭이 이미 쓰는 그 순서를 그대로 따른다(같은 사실이 두 화면에서 다르게 읽히면 안 된다).
- ⚠️ **트랙 충돌 주의**: `app/(tabs)/index.tsx`는 이 정찰 중에도 바뀌었다(머리말 참고).
  이 발견을 집는 트랙은 홈 탭을 만지는 다른 트랙과 **반드시 순서를 잡아야 한다**.

---

## 발견 7 — 상태 체크 한 번의 확인이 SQLite 전량 읽기 2회 뒤에 온다 (이월 권고)

**1. 무엇이 기다림으로 보이나.** 준비템 "준비했어요"를 누르면 촉각 확인(햅틱)과 "지출도 기록할까요?"
줄이 **기기 저장이 끝난 뒤에** 온다. 토스라면 누르는 순간 손끝에 오는 신호다.

**2. 근거.**
- `src/offline/sync-controller.ts:471-506` `updateItemStatusOffline`:
  `await getOfflineStore()` → `await recordLocalItemStatus(store, payload)`(SQLite 쓰기) →
  캐시 두 곳 낙관 패치(`:489-502`) → `await refreshSnapshot()`(`:503`) → 반환.
- `refreshSnapshot`(`:183-232`)은 매 호출마다 `store.listLocalExpenses()`와
  `store.listItemStatusMutations()`로 **로컬 테이블 전량을 다시 읽는다**(그 자리의 주석
  `:207-230`이 "전량을 싣는 것은 그대로다"라고 근거까지 적어 뒀다 — 자동완성 모집단이 synced
  행을 쓰기 때문).
- 화면은 그 뒤에 반응한다: `app/(tabs)/items.tsx:476-480` — `.then(() => { hapticSelection(); … })`.
  `:477-480` 주석이 기준을 명시한다: *"체크 확정의 촉각 확인 — 기준은 … 기기 저장이다(C-10)"*.

**3. 얼마나 자주.** 준비템 상태를 바꿀 때마다(목록 탭 · 상세 화면 · 동기화 상태 화면의 재시도).

**4. 고치는 크기 — M, 그러나 위험이 크다.** 낙관 캐시 패치는 이미 SQLite 쓰기 **뒤**에 있고,
햅틱은 그보다 더 뒤다. "누른 즉시 햅틱"으로 옮기는 것 자체는 한 줄이지만, 그러면 **기기 저장
실패 시 이미 울린 확인을 되돌릴 수 없다** — C-10이 기준을 "기기 저장"으로 정한 근거가 바로 그것이다.
`refreshSnapshot`을 배지 갱신용 증분 갱신으로 바꾸는 쪽은 8개 화면이 함께 읽는 값이라
`sync-controller.ts`의 계약 다발을 통째로 건드린다.

**5. 막는 것.** C-10의 확정 기준(기기 저장) · 스냅숏 `rows` 전량 계약(`:207-230`의 네 가지 근거) ·
`sync-controller`를 읽는 8개 화면. **이번 라운드에서 손대지 말 것을 권고한다** — 값으로 적어
두고, 발견 4가 렌더 비용을 걷어낸 뒤 다시 재는 편이 순서가 맞다.

---

## 이미 돼 있는 것 (값으로 — 다음 라운드가 다시 파지 않도록)

| 자리 | 실측 |
| --- | --- |
| `GET /home` 서버 쿼리 | **직렬 0**. `Promise.all`로 5개 병렬(`apps/api/src/onboarding/reporting-store.service.ts:74-81`), 접근 검사만 앞에 선다. 합계는 `SUM`, 최근 3건은 `LIMIT 3`(PERF-121). |
| 리포트 월간 추이 | 워터폴 **6 → 1**. `getMonthlyReport` 6회가 단일 `GET /reports/trend`로 접혔다(`reports.tsx:786-791`, REP-128). |
| 리포트 분기 합계 | **3 → 1**. `useQueries` 3회 → 단일 범위 질의(`reports.tsx:653-657`, GAP-067). |
| 기록 탭 목록 가상화 | `SectionList` + 모듈 스코프 `renderItem`/`keyExtractor` + 행 `memo`, `initialNumToRender=12` · `maxToRenderPerBatch=12` · `windowSize=7`(`records.tsx:2436-2478`). AppScreen 중첩 금지도 계약으로 잠겨 있다. |
| 동기화 상태 · 가져오기 미리보기 | 둘 다 스크롤러가 `FlatList` 자체(`app/sync-status.tsx:901`, `app/import/[importJobId].tsx:1299,1327`). |
| 준비템 목록 | 가상화는 없지만 **마운트 수가 묶여 있다** — 그룹당 기본 5개(`PreparationListParity.tsx:81` `INITIAL_GROUP_LIMIT`), 펼친 그룹만 렌더, 검색은 20개부터 배수 확장(`:381`, `:640-646`). 가상화 라이브러리(=새 의존성)를 살 이유가 없다. |
| 지출 저장 | **낙관적이다**. 로컬 우선(`createExpenseOffline`) 후 즉시 반환, 전송은 sync-engine이 진다. 다만 저장 후 이탈이 **650ms 지연**된다(`app/expenses/new.tsx:1598` — "저장했어요"를 보여 준 뒤 떠나는 의도된 타이머, 언마운트 시 취소된다). |
| 준비템 상태 변경 | 낙관적 캐시 패치(`sync-controller.ts:489-502` — `setQueriesData` 두 벌), 무효화를 일부러 하지 않는다(서버가 아직 옛 값). |
| 콜드 스타트 백지 | 없앴다 — 홀딩 뷰 + 스켈레톤 2장 + 이유 한 줄(`app/index.tsx:43-91`), 3초 안전 밸브 둘. |
| 당겨서 새로고침 | 10초 안전 밸브 + 450ms 최소 표시(`src/query/use-pull-to-refresh.ts:21,33`) — 무한 스피너도, 한 프레임 깜빡임도 막혀 있다. |
| 아이 전환 | `invalidateQueries`(`removeQueries` 아님 — `src/children/child-switch.ts:47,71-84`)라 **이미 본 아이로 돌아가면 캐시가 즉시 그려지고** 배경에서만 갱신된다. 같은 아이 재선택은 no-op(따뜻한 캐시 보존). |
| 공유 캐시 신선도 | 키별 단일 정책표 + 등록 1자리(`src/query/shared-cache-policy.ts`, `app/_layout.tsx:44-47`). 전역 30초. |
| `["categories"]` 재사용 | 홈·기록·준비템·리포트·지출 상세가 **같은 키**를 쓴다 — 탭을 옮겨도 재요청 0건(5분 신선도). |
| 첫 페인트 요청 수(세션·콜드) | 홈 4 병렬(+2 조건부 2단계) · 기록 4 병렬(+1 2단계) · 준비템 3 병렬 · 리포트 7 병렬(+1 2단계). 2단계로 미룬 자리는 전부 근거가 주석에 값으로 적혀 있다(UX-W(C8) 등). |
| 전역 `onlineManager` 배선 | **의도적으로 없다**(FIX-118A) — 있으면 오프라인에서 스켈레톤/스피너가 영구히 산다. 소스 스캔 계약으로 잠겨 있다. |

---

## 권고 순위

1. **발견 3 (지출 상세 initialData)** — 가장 잦은 전환에서 스켈레톤 한 장을 통째로 없앤다.
   파일 1개, 새 요청 0, 늦게 오는 값을 다루는 기계가 화면에 이미 있다. 위험 대비 체감이 가장 크다.
2. **발견 1 (전 기간 수집 동시성)** — 사용자가 **초 단위로 눈으로 세는** 유일한 대기다.
   순수 함수 하나 + 그 테스트. 서버 왕복 수 불변이라 오프라인 우선 원칙과 충돌하지 않는다.
3. **발견 2 (기록 탭 검색 디바운스)** — 전체 기간 스코프에서 키 입력당 수천 행을 다시 훑는
   구조를 끊는다. 같은 앱의 준비템 탭이 이미 쓰는 패턴을 그대로 옮기는 것이라 설계 결정이 없다.
4. **발견 4 (준비템 탭 메모화)** — 체감 개선폭은 3~4위지만 **선행 재배치**(훅을 조기 반환 위로)가
   있어 크기가 크다. 1~3이 끝난 뒤에 서는 것이 맞다. 자식의 죽은 `useMemo` 2개를 되살리는 것이
   본체다.
5. **발견 6 (홈 최근 지출 분류 라벨)** — 유일한 정보 밀도 항목이고 크기는 S지만, 홈 탭을 만지는
   다른 트랙과 겹치므로 **그 트랙이 끝난 뒤** 또는 그 트랙에 얹어 처리한다.

(발견 5는 3과 성질이 같아 3의 트랙이 여유가 있으면 같이, 발견 7은 이월.)

---

## 소유 파일 목록 (트랙 경계 — 교집합 없음)

| 트랙 | 발견 | 소유 파일 |
| --- | --- | --- |
| **C1 · 상세 즉시 그리기** | 3, 5 | `apps/mobile/app/expenses/[expenseId].tsx` · `apps/mobile/app/items/[itemTemplateId].tsx` |
| **C2 · 전 기간 수집** | 1 | `apps/mobile/src/expenses/records-search-scope.ts` · `apps/mobile/src/expenses/records-search-scope.test.ts` · `apps/mobile/src/expenses/use-search-scope-collection.ts`(주석 갱신만) |
| **C3 · 기록 탭 검색 입력** | 2 | `apps/mobile/app/(tabs)/records.tsx` · `apps/mobile/src/records-list-virtualization.test.ts`(계약 재확인) |
| **C4 · 준비템 탭 렌더 비용** | 4 | `apps/mobile/app/(tabs)/items.tsx` |
| **C5 · 홈 최근 기록 밀도** | 6 | `apps/mobile/app/(tabs)/index.tsx` ⚠️ **선점 확인 필수**(이 파일은 정찰 중에도 다른 트랙이 바꿨다) |
| — (이월) | 7 | `apps/mobile/src/offline/sync-controller.ts` — 이번 라운드 **비배정** |

**공용 파일(어느 트랙도 단독 소유하지 않는다 · 손대려면 먼저 합의):**
`apps/mobile/src/expenses/records-list-view.ts`(C3·C5가 둘 다 읽는다 — 위 안은 둘 다 **읽기만**
한다) · `apps/mobile/src/preparation/PreparationListParity.tsx`(C4가 되살리려는 메모의 소유자이지만,
승인 디자인 이식본이라 **읽기 전용**으로 둔다 — C4는 호출부 쪽 참조 안정화만으로 끝난다) ·
`apps/mobile/src/offline/sync-controller.ts` · `apps/mobile/src/query/shared-cache-policy.ts` ·
`apps/mobile/src/categories.ts`.

**이번 라운드에서 아무도 건드리지 않는 것:** `apps/mobile/app/settings/` ·
`apps/mobile/src/categories/` · `apps/mobile/src/api/api-error.ts` ·
`apps/mobile/src/family/record-permissions.ts` · `apps/mobile/src/route-surface.test.ts` ·
픽셀락 캡처 경로 전부(HOME-001 · EXP-001/003 · ITEM-001/002 · REP-001) · 준비템 가격 표시 ·
`package.json`(새 의존성 0건).
