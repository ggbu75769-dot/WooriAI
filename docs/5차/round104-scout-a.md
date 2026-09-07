# 라운드 104 정찰 A — 핵심 기록 루프의 마찰 지점 (실측)

작성: 2026-09-07 · 성격: **읽기 전용 정찰** (소스 0바이트 변경 · git 명령 0건) · 산출물은 이 파일 하나

기준 루프(DNC-002 · CLAUDE.md): **지출 기록 → 총액 확인 → 시기별 준비템 확인 → 구매 링크 클릭 → 구매 후 기록/상태 체크.**

이 문서의 규율: **읽은 코드가 실제로 하는 일만 적는다.** "느릴 것이다" 류의 추정은 쓰지 않았고,
지연을 말하는 자리는 전부 그 지연을 만드는 상수(타임아웃·재시도·백오프)를 코드에서 인용했다.

**정찰에서 제외한 파일**(다른 에이전트가 동시 편집 중): `apps/mobile/app/settings/**` ·
`apps/mobile/src/categories/**` · `apps/mobile/src/api/api-error.ts` ·
`apps/mobile/src/family/record-permissions.ts` · `apps/mobile/src/route-surface.test.ts`.
아래 어떤 발견도 이 다섯을 근거로 삼지 않는다.

---

## 요약 표

| # | 한 줄 | 영향 | 크기 | 즉시 착수 |
|---|---|---|---|---|
| **F1** | 저장을 눌러도 시트가 닫히지 않고 "저장하는 중"으로 남는다 — 이미 기기에 저장이 끝났는데도 서버 재조회 4묶음을 기다린다(연결이 나쁠수록 길어지고, 상한이 없다) | **상** | **S** | O |
| **F2** | 홈이 로딩 스켈레톤인 동안 기록 입구(FAB·빠른 기록)가 화면에서 통째로 사라진다 — 같은 화면의 **실패** 갈래는 그 입구를 남기는데 **로딩** 갈래만 없다 | 중 | S | O |
| **F3** | 기록 탭에서 달을 한 칸 넘기면 "N월 합계" 카드가 사라지고 목록이 스켈레톤이 된다(이전 값 유지 없음) | 중 | S | O |
| **F4** | 전 기간 검색이 21개월을 **직렬**로 걷는다(달마다 왕복 하나씩, 병렬도 상한도 없음) | 중 | S | O |
| **F5** | 준비템·리포트 탭에는 기록 입구가 없다 — 리포트는 "그 기간에 기록이 0건"일 때만, 준비템은 상태를 바꾼 뒤 뜨는 프롬프트로만 존재한다 | 중 | S | O (세션 게이트면 픽셀락 무접촉) |
| **F6** | 준비템 탭은 서버 카탈로그 전량(시드 62행 + 커스텀)을 가상화 없이 한 번에 그린다 | 하 | M | O |
| **F7** | 판매처만 적고 ×로 닫으면 방금 친 판매처가 초안째 지워진다 (닫기 판정이 3칸만 본다) | 하 | S | O |

---

## F1 — 저장은 끝났는데 시트는 계속 "저장하는 중"이다

### 1. 무엇이 문제인가
저장을 누르면 "기기에 저장했어요" 토스트가 즉시 뜨는데, 같은 화면의 저장 버튼은 동시에
"저장하는 중"으로 잠긴 채 남고 시트도 닫히지 않는다 — 이미 로컬 저장이 끝난 뒤 서버 재조회
네 묶음이 순차로 끝나기를 기다리기 때문이다.

### 2. 근거

**대기가 생기는 자리 — `apps/mobile/app/expenses/new.tsx` 저장 성공 핸들러**

- `:1544-1545` `await queryClient.invalidateQueries({ queryKey: ["expenses"] })` → `await … ["home"]`
- `:1570-1571` `await … ["report"]` → `await … ["budget"]`
- `:1586-1587` 준비템 연결 기록이면 `await … ["items"]` → `await … ["item-detail"]` (묶음 6개)
- `:1592-1594` `if (continueRecording) { resetFormForNextEntry(); return; }` — **폼 비우기가 그 await 전부 뒤에 있다**
- `:1598` `leaveTimerRef.current = setTimeout(() => router.replace(postSaveDestination), 650)` — 이동 타이머는 await가 다 끝난 **뒤에** 걸린다

**그 await가 실제로 네트워크를 기다린다는 실측**
`node_modules/.pnpm/@tanstack+query-core@5.101.2/…/build/modern/queryClient.js:148-180` —
`invalidateQueries`는 `refetchQueries(...)`를 그대로 돌려주고, `refetchQueries`는
`Promise.all(promises).then(noop)`이다. 즉 **매칭되는 활성 쿼리의 refetch 완료까지 resolve하지
않는다.** 그리고 `build/modern/mutation.js:115-128`이 `await this.options.onSuccess?.(...)`이므로
그 시간 동안 뮤테이션 상태는 계속 `pending`이다.

**화면에 동시에 서는 두 문장**
- `app/expenses/new.tsx:2667-2668` — `{savedMessage ? <Toast message={savedMessage} tone="success" /> : null}` (성공 토스트는 `:1511`에서 await 전에 세워진다)
- `app/expenses/new.tsx:2772-2775` — `disabled={saveExpense.isPending || isSaveBlocked}` · `label={saveExpense.isPending ? "저장하는 중" : "저장하기"}`
- `:2793-2794` — "저장하고 계속 기록"도 같은 `isPending`으로 잠긴다

**대기 길이를 정하는 상수 (전부 저장소 코드)**
- `app/_layout.tsx:22-33` — QueryClient 기본값에서 **`retry`는 손대지 않는다**(주석이 명시). 곧 react-query 기본 `retry: 3` + 지수 백오프(1s·2s·4s ≈ 7초).
- `src/api/client.ts:83` — `const DEFAULT_FETCH_TIMEOUT_MS = 10_000;` (요청 하나당 상한 10초, 4회 시도면 40초)
- `src/query/app-refetch.ts:11-27` — **`onlineManager` 배선을 의도적으로 제거했다**(FIX-118A). 즉 react-query는 오프라인에서도 online=true로 보고 refetch를 실제로 시도하며, "paused"로 즉시 resolve되는 탈출구가 **없다.**
- 곧 한 묶음의 최악은 `4 × 10초 + 7초 ≈ 47초`이고, 묶음이 4개(연결 기록이면 6개)라 **직렬로 쌓인다.**

**동시에 활성인 쿼리가 몇 개인가** — `app/(tabs)/_layout.tsx:60-80`에 `unmountOnBlur`/`lazy`
재정의가 없다(전 저장소 grep 0건). 탭은 한 번 포커스되면 계속 마운트되므로, 리포트 탭을 한 번
열어 둔 사용자의 저장 한 건은 `["expenses"]`(홈 2 + 기록 1, 각각 `fetchMonthExpenses` 커서 루프) ·
`["home"]` 1 · `["report"]` 6(`app/(tabs)/reports.tsx:544·549·554·589·730·787`) · `["budget"]`을
전부 훑는다.

**같은 모양이 지출 쓰기 다른 경로에도 있다**
- `app/expenses/[expenseId].tsx:778-787` (수정 저장 — await 4개 뒤 650ms 이동)
- `app/expenses/[expenseId].tsx:803-811` (삭제 — 같은 모양)
- `app/(tabs)/records.tsx:1340-1345` (행 액션시트 삭제 — await 3개, 화면 이동은 없음)

### 3. 얼마나 자주 밟히나
**매번.** 지출을 저장하는 모든 경로가 이 자리를 지난다. 길이는 회선 상태가 정하지만
0이 되는 경우는 없다(로컬 저장은 이미 끝났는데도 최소 한 번의 왕복은 기다린다).
"저장하고 계속 기록"(마트 연속 기록)에서는 **폼이 비워지는 시점**까지 밀리므로,
그동안 사용자가 다음 항목을 치기 시작하면 `resetFormForNextEntry()`가 그 입력을 덮는다.

### 4. 고치는 크기
**S.** 파일 2~3개(`app/expenses/new.tsx`, `app/expenses/[expenseId].tsx`, 선택적으로
`app/(tabs)/records.tsx`). 새 계약 0 · 서버 변경 0.
방향은 "무효화는 그대로 두고 **기다리지 않는다**"이다 — `await`를 걷어 fire-and-forget으로
바꾸면 캐시를 낡음으로 표시하는 효과는 한 글자도 바뀌지 않고 화면만 즉시 진행한다.

⚠️ 기존 계약과의 관계(중요): `src/refresh-wiring-contract.test.ts:119-176`이 무는 것은
**문자열의 존재**뿐이다 — `(body.match(/queryClient\.invalidateQueries\(\{ queryKey: \["(report|budget)"\] \}\)/g) ?? [])`.
`void queryClient.invalidateQueries({ queryKey: ["report"] })` 형태로 바꿔도 이 계약은 그대로
그린이다(잘라 보는 구간의 시작·끝 표식 `onSuccess: async () => {` / `const isPixelLockAmountCapture`도
그대로 남는다). 즉 이 수정은 **계약 파일을 건드리지 않고** 가능하다.

### 5. 막는 것이 있나
없다. EXP-001 픽셀락은 **세션 없는 초기 렌더**의 캡처이고(`app/pixel-lock.tsx`가 세션을 지운 뒤
이동), 이 자리는 저장 뮤테이션의 성공 핸들러라 캡처 경로에 존재하지 않는다.
DNC 접점 없음(허위 데이터 아님 — 무효화 키는 그대로 유지된다).

---

## F2 — 홈이 로딩인 동안 기록 입구가 사라진다

### 1. 무엇이 문제인가
홈을 여는 순간(콜드 스타트·아이 전환) 화면이 스켈레톤 5개로 바뀌는데, 그 화면에는 지출을
기록할 입구가 하나도 없다 — 같은 화면의 **실패** 갈래는 "기록은 지금도 남길 수 있어요" 한 줄과
기록 버튼을 남기는데, **로딩** 갈래만 그것이 없다.

### 2. 근거
- `app/(tabs)/index.tsx:1833-1847` — `if (hasSession && homePhase === "loading")` 갈래는
  `<AppScreen>` 안에 `SkeletonCard` 2 + `SkeletonRow` 3만 그린다. FAB도, `floatingAction` 슬롯도,
  기록 버튼도 없다.
- 바로 위 `:1821-1828`(실패 갈래)에는 그 입구가 있다 —
  `<TextButton label={OFFLINE_RECORDING_ENTRY_LABEL} onPress={() => router.push("/expenses/new")} />`
  와 그 위 `OFFLINE_RECORDING_STILL_AVAILABLE_NOTICE` 한 줄.
- `:1631-1634`의 주석이 그 자리의 근거를 이미 적어 두었다: *"이 앱에서 지출 기록은 SQLite 우선
  저장이라 조회가 실패한 순간에도 **실제로** 남길 수 있고, 홈은 그 입구(빠른 기록·FAB)를 늘 들고
  있는 화면이다."* — 그 약속이 **로딩 동안에는 지켜지지 않는다.**
- 로딩이 얼마나 갈 수 있나: `homePhase`의 입력은 `home.isPending`(`:1628`)이고 그 쿼리는
  `:1163-1167` `queryKey: ["home", childId]`다. 실패 확정까지는 `retry` 기본 3회
  (`app/_layout.tsx:22-33`이 "retry는 건드리지 않는다"라고 명시) × 요청당 10초 상한
  (`src/api/client.ts:83`) + 백오프 ≈ **최대 47초**. 그동안 계속 로딩 갈래다.
- 아이 전환도 같은 자리로 온다: 키가 `["home", childId]`라 아이가 바뀌면 캐시가 없어
  `isPending`이 다시 true다.

### 3. 얼마나 자주 밟히나
**콜드 스타트마다 1회 + 아이 전환마다 1회.** 회선이 좋으면 수백 ms라 눈에 띄지 않고,
지하·엘리베이터·마트 지하층처럼 "요청이 늦게 실패하는" 자리에서 길어진다 — 그리고 그런
자리가 정확히 지출을 적는 자리다. 탈출구는 있다(기록 탭의 FAB는 로딩 중에도 렌더된다 —
`app/(tabs)/records.tsx:2483-2491`은 SectionList 바깥의 절대배치라 목록 상태와 무관하다).
다만 그 탈출구는 "탭을 옮기면 된다"는 것을 아는 사람만 쓴다.

### 4. 고치는 크기
**S.** 파일 1개(`app/(tabs)/index.tsx`). 실패 갈래가 이미 쓰는 문구 상수 두 개
(`OFFLINE_RECORDING_STILL_AVAILABLE_NOTICE` · `OFFLINE_RECORDING_ENTRY_LABEL`)를 로딩 갈래에도
같은 게이트(`expenseGate.locked ? null : …`)로 세우면 끝난다. 새 한국어 0글자 · 새 계약 0 ·
서버 0.

### 5. 막는 것이 있나
없다. HOME-001 픽셀락 캡처는 `authToken === null` 렌더인데(같은 파일 `:2632`의 `if (!authToken)`
갈래), 이 갈래의 조건은 `hasSession && homePhase === "loading"`이라 캡처가 지나가지 않는다.

---

## F3 — 달을 넘기면 합계 카드와 목록이 통째로 사라진다

### 1. 무엇이 문제인가
기록 탭에서 ‹ 화살표로 지난달을 보면, 그 달을 처음 여는 순간 "N월 합계" 카드가 사라지고
목록 자리가 스켈레톤이 된다 — 방금까지 보던 숫자가 남지 않는다.

### 2. 근거
- `app/(tabs)/records.tsx:1152-1157` — `queryKey: ["expenses", childId, recordsYearMonth]`.
  달을 옮기면 `recordsYearMonth`(`:1088`)가 바뀌어 **키 자체가 바뀐다.** 저장소 전체에
  `placeholderData` / `keepPreviousData` 사용은 **0건**이다(`app/**`·`src/**` grep).
- 그래서 새 달은 `isLoading === true`가 되고,
  `:1614` `const showList = !expenses.isLoading && !expenses.isError && Boolean(expenses.data);`
  `:1615` `const hasVisibleRecords = showList && listData.length > 0;`
- `:2316-2329` — 월 합계 카드는 `{hasVisibleRecords ? (<Card> … {formatKrw(monthlyTotalKrw)} …)}`
  이므로 로딩 동안 **카드째 사라진다.**
- `:2364-2370` — 그 자리에는 `SkeletonCard` + `SkeletonRow` 3이 선다.
- 한 달 조회는 단일 요청이 아니다: `queryFn: () => fetchMonthExpenses((page) => listExpenses(...))`
  — `:1148-1151`의 주석대로 페이지당 200건 커서 루프라, 기록이 많은 달은 왕복이 여러 번이다.

### 3. 얼마나 자주 밟히나
**과거 달을 처음 열 때마다.** 같은 달로 되돌아오면 캐시가 있어 즉시다(gcTime 기본 5분 이내).
즉 "지난달 얼마 썼지"를 확인하러 ‹를 두어 번 누르는 동선에서 매번 밟힌다.

### 4. 고치는 크기
**S.** 파일 1개(`app/(tabs)/records.tsx`) — 그 `useQuery`에 이전 달 데이터를 유지하는 옵션을
더하고, 유지 중이라는 사실을 화면이 정직하게 말하게 한다(합계 카드가 **다른 달의 숫자를 이 달의
것처럼** 말하면 안 되므로, 유지값을 그대로 쓰는 대신 "불러오는 중" 표시와 함께 두거나 헤더의 달
라벨과 값의 달을 함께 판정해야 한다). 서버 0 · 새 계약 0.

### 5. 막는 것이 있나
기록 탭에는 픽셀락이 없다(잠금 6종: EXP-001·HOME-001·REP-001·ITEM-001·IMP-003·SET-001).
다만 **허위 표시 금지**가 설계 제약이다 — 값의 달과 라벨의 달이 어긋나는 프레임을 만들면 안 되므로
"이전 값을 그냥 남긴다"는 단순안은 그대로 쓸 수 없다. 그것이 이 항목이 S이면서도 판정 설계가
필요한 이유다.

---

## F4 — 전 기간 검색이 21개월을 직렬로 건넌다

### 1. 무엇이 문제인가
기록 탭의 검색은 보고 있는 달 안에서만 걸리고, "전체 기간에서 찾기"를 누르면 달을 **하나씩 차례로**
불러온다 — 21개월이면 왕복 21번이 순서대로 이어진다.

### 2. 근거
- `src/expenses/records-search-scope.ts:109-119` —
  ```
  for (let index = months.length - 1; index >= 0; index -= 1) {
    const yearMonth = months[index];
    try { const month = await ensureMonth(yearMonth); … }
    …
    onProgress?.(months.length - index, months.length);
  }
  ```
  루프 안에서 `await`하므로 **동시 실행이 0**이다(병렬 상한 개념 자체가 없다).
- 달 하나가 곧 왕복 하나가 아니다: 훅이 넘기는 `ensureMonth`는
  `src/expenses/use-search-scope-collection.ts:24-30`의 주석대로
  `queryClient.ensureQueryData(["expenses", childId, ym], …)` + `fetchMonthExpenses`(전량 커서 루프)라,
  기록이 많은 달은 그 안에서 또 여러 번 돈다.
- 같은 주석이 직렬임을 전제로 재시도를 좁혀 두었다: *"`retry: 1`을 명시한다 — … 이 루프가 21개월을
  **직렬로** 걷기 때문이다(달마다 재시도가 길면 수집 전체가 그 배수로 늘어진다)."*
- 진행 표시는 있다(`records-search-scope.ts:154-160` `"불러오는 중 3/21"`) — 즉 **느리다는 것을
  화면이 이미 인정하고 있다.**
- 21이라는 수는 `resolveSearchScopeMonths`(`:63-75`)가 아이의 생년월일/예정일에서 만든 하한과
  이번 달 사이의 달 수다.

### 3. 얼마나 자주 밟히나
**"이거 언제 샀더라"를 물을 때마다.** 이 앱의 검색 기본 스코프가 한 달이므로(`:17`의 주석 —
*"검색어를 쳤다고 21개월치 조회를 몰래 사지 않는다"*), 지난 것을 찾는 사람은 거의 항상 이 버튼을
지난다.

### 4. 고치는 크기
**S.** 파일 2개(`src/expenses/records-search-scope.ts` + `src/expenses/use-search-scope-collection.ts`)
와 그 테스트. 루프를 **상한 있는 병렬**(예: 동시 3~4)로 바꾸면 되고, `onProgress`는 완료 건수만
세므로 시그니처가 바뀌지 않는다 — 소비 화면(`app/(tabs)/records.tsx`)은 **한 줄도 바뀌지 않는다.**
서버 0 · 새 계약 0.
⚠️ 순서 계약 하나는 지켜야 한다: 지금 루프는 **최신 달부터** 걷고(`:109`의 역방향 인덱스)
`failedMonths`를 오름차순으로 정렬해 돌려준다(`:120`). 병렬화해도 결과 배열의 달 순서와
`failedMonths` 정렬은 그대로여야 한다(그 순서를 `rebuildSearchScopeResult`와 화면 고지가 읽는다).

### 5. 막는 것이 있나
없다. 픽셀락 무접촉(전 기간 검색은 세션 화면의 온디맨드 동작), 새 의존성 0(동시성 제한은 코드 몇 줄),
DNC 접점 없음.

---

## F5 — 준비템·리포트 탭에는 기록 입구가 없다

### 1. 무엇이 문제인가
루프의 4·5단계(준비템 확인 → 구매 → 구매 후 기록)를 밟고 있는 사용자가 서 있는 화면에는
지출을 적기 시작할 버튼이 없다. 준비템 탭에는 상시 입구가 없고, 리포트 탭의 입구는
**그 기간에 기록이 하나도 없을 때만** 나타난다.

### 2. 근거
- 탭별 FAB 실측(`grep -c FloatingActionButton`): `app/(tabs)/index.tsx` **3** ·
  `app/(tabs)/records.tsx` **2** · `app/(tabs)/items.tsx` **0** · `app/(tabs)/reports.tsx` **0**.
- 홈: `app/(tabs)/index.tsx:2738` — `floatingAction={<FloatingActionButton onPress={expenseGate.guard(() => router.push("/expenses/new"))} />}`
- 기록: `app/(tabs)/records.tsx:2483-2491` — SectionList 바깥의 절대배치 오버레이.
- 리포트: `app/(tabs)/reports.tsx:1475-1485` — `/expenses/new`로 가는 유일한 자리가
  `categoryData.length === 0` 갈래의 `EmptyStateCard` 액션이다(그것도 `emptyPeriodCard.action`이
  `"go-current-period"`가 아닐 때만). 기록이 있는 정상 상태에서는 입구가 **0개**다.
- 준비템: `app/(tabs)/items.tsx:831` `openExpenseLinkPrompt = expenseGate.guard(…)` — 목록 행의
  상태를 바꾼 **뒤에** 뜨는 프롬프트다(`src/items/expense-link-prompt.ts` 머리말이 그 성격을 적어
  두었다: *"목록 행의 '준비했어요'는 상태만 바꾸고 끝이라, 지출은 영영 기록되지 않은 채 총액이
  실제보다 작게 남았다"*). 상시 입구는 상세 화면(`app/items/[itemTemplateId].tsx:1380-1405`)에
  들어가야 나온다.
- 구매 확인 카드는 이 공백을 메우지 못한다: `src/commerce/purchase-followup.store.ts:90`
  `PURCHASE_FOLLOWUP_MIN_AGE_MS = 3 * 60 * 1000` — 링크를 누르고 **3분이 지나야** 물어보고,
  `:115` `PURCHASE_FOLLOWUP_MAX_PROMPTS = 2`, `src/commerce/purchase-followup-session.ts:54`
  `PURCHASE_FOLLOWUP_MAX_SESSION_PROMPTS = 2`로 횟수가 좁다. 즉 "링크 열고 → 3분 안에 돌아온"
  경로에는 카드가 서지 않는다.

### 3. 얼마나 자주 밟히나
루프의 3·4단계에 있는 **모든 순간.** 준비템을 훑다가 "아 이거 어제 마트에서 샀지"를 떠올린
사람은 탭을 옮기거나 상세로 들어가야 한다. 리포트에서 "총액이 왜 이렇게 적지 → 아 그거 안 적었네"를
알아챈 사람도 마찬가지다(그 순간이 리포트 탭이 존재하는 이유인데도).

### 4. 고치는 크기
**S.** 파일 2개(`app/(tabs)/items.tsx`, `app/(tabs)/reports.tsx`). 두 화면 모두 이미
`AppScreen`을 쓰고(`items.tsx:974`, `reports.tsx:1222`) `useExpenseEntryGate`를 이미 들고 있다
(`items.tsx:277`, `reports.tsx:385`) — 홈과 **같은 한 줄**을 `floatingAction` 슬롯에 넘기면 된다.
새 컴포넌트 0 · 새 게이트 0 · 새 문구 0 · 서버 0.
⚠️ 함께 필요한 것: 기록 탭이 이미 쓴 바닥 여백 관례
(`records.tsx:2480` `paddingBottom: theme.spacing.screen + theme.ctaHeight + 8`) — 없으면 마지막
행이 버튼에 가린다. `src/ui.tsx:120-181`의 AppScreen `contentContainerStyle`은 그 여백을 스스로
주지 않는다.

### 5. 막는 것이 있나
**픽셀락은 걸리지 않는다 — 단, 세션 게이트가 조건이다.** ITEM-001/REP-001 캡처는
`app/pixel-lock.tsx`가 세션을 지운 뒤 찍는 비세션 렌더이고, `src/ui.tsx:163-165`가
`if (!floatingAction) { return scroller; }`라 **슬롯에 아무것도 넘기지 않으면 렌더 트리가 노드
하나도 달라지지 않는다.** 그래서 `floatingAction={hasSession ? <FAB/> : undefined}` 형태여야 하고,
그 형태이면 두 캡처는 한 픽셀도 바뀌지 않는다. 홈이 이미 같은 판단을 해 두었다
(`index.tsx:2735` *"비세션 미리보기(HOME-001 픽셀락)는 종전처럼 콘텐츠 끝에 그린다"*).
준비템 가격 표시 잠금 · DNC-009/010/011과는 접점이 없다(구매 표면을 건드리지 않는다).

---

## F6 — 준비템 탭이 카탈로그 전량을 가상화 없이 그린다

### 1. 무엇이 문제인가
준비템 탭은 서버가 준 준비템을 전부 한 번에 렌더한다 — 시기 밴드로 화면을 좁혀도 목록 자체는
줄지 않고, 상태 버튼을 한 번 누를 때마다 그 전량이 다시 그려진다.

### 2. 근거
- `app/(tabs)/items.tsx:387-391` — `queryFn: () => listItems(authToken!, childId!, "all")`.
  서버에 상한이 없다(`apps/api/src/onboarding/items-catalog.service.ts`에 `take`/`limit` 0건).
  시드만 **62행**(`apps/api/prisma/seed-data.ts:93`의 `itemTemplateSeeds` 항목 수)이고,
  라운드 100의 커스텀 품목이 그 위에 더해진다.
- `:974` — 스크롤러가 `AppScreen`(= `src/ui.tsx:145`의 `ScrollView`)이다. 저장소의 가상화 목록
  (`FlatList`/`SectionList`)은 `app/sync-status.tsx` · `app/import/[importJobId].tsx` ·
  `app/(tabs)/records.tsx` 셋뿐이고 준비템 탭은 거기 없다.
- `:964-970` — `parityItems`는 `sessionRows` 전량을 그대로 매핑한다(밴드는 각 항목에
  `timelineBucket`을 **붙이기만** 한다).
- `src/preparation/PreparationListParity.tsx:397-409` — 그룹을 만들고
  `:657` `categories.map(...)`, `:713` `populatedTimingBands.map(...)`으로 전부 그린다.
  화면이 `minimumGroupSize={1}`을 넘기므로(`items.tsx:990`) 작은 그룹도 접히지 않는다.
- 같은 문제를 기록 탭은 이미 한 번 겪고 옮겼다: `app/(tabs)/records.tsx:198-202` —
  *"PERF-102: a month of heavy use is hundreds of rows. The old ScrollView(+AppScreen) + .map()
  mounted every row eagerly (jank + memory)."*

### 3. 얼마나 자주 밟히나
준비템 탭을 열 때마다(진입 비용), 그리고 그 화면에서 상태를 바꿀 때마다(리렌더 비용).
행 수가 기록 탭의 "수백"보다는 적어서(62+) 증상의 크기는 그보다 작다 — 그래서 영향 **하**로 둔다.

### 4. 고치는 크기
**M.** 스크롤러를 바꾸는 일이라 `app/(tabs)/items.tsx`와
`src/preparation/PreparationListParity.tsx` 두 파일의 구조가 함께 움직인다(기록 탭이 PERF-102에서
한 것과 같은 모양: AppScreen의 배경·패딩을 리스트에 직접 옮기고 중첩을 피한다). 서버 0 · 새 계약 0.

### 5. 막는 것이 있나
ITEM-001 캡처는 비세션 미리보기 갈래(`items.tsx:860-918`)를 찍으므로 세션 갈래만 옮기면 캡처는
불변이다 — 다만 두 갈래가 같은 컴포넌트를 공유하는 구간이 있어 **분리 설계가 선행**되어야 한다.
그래서 F5(같은 파일, S)보다 뒤에 두고, 두 트랙이 같은 파일을 동시에 잡지 않도록 순서를 지켜야 한다.

---

## F7 — 판매처만 적고 닫으면 그 값이 지워진다

### 1. 무엇이 문제인가
시트를 열어 판매처만 적고 ×로 닫으면, 500ms 자동 저장이 남겨 둔 초안이 닫기 판정에 의해
지워진다 — 다음에 다시 열면 적은 것이 없다.

### 2. 근거
- `src/expenses/entry-form-guards.ts:29-33` — `QuickExpenseInputSnapshot`은
  `{ itemName, amountText, memo }` **세 칸뿐**이다.
- `:83-88` — `shouldClearQuickExpenseDraftOnClose`는 그 세 칸만 비교한다
  (`untouched || !hasQuickExpenseInput(current)`).
- `app/expenses/new.tsx:1834-1838` — 닫기 ×가 넘기는 값이
  `current: { itemName, amountText, memo }`라 판매처가 들어가지 않는다.
- 반면 자동 저장은 판매처를 **친 것으로 센다**: `app/expenses/new.tsx:1070`
  `const hasTypedInput = Boolean(itemName.trim() || amountText.trim() || memo.trim() || merchant.trim());`
  그리고 `:1086`에서 `merchant`를 초안에 싣는다.
- 이 비대칭은 코드가 스스로 적어 두었다 — `app/expenses/new.tsx:1066-1069`:
  *"⚠️ 닫기 ×의 초안 폐기 판정(shouldClearQuickExpenseDraftOnClose)은 여전히 세 칸 스냅숏이라
  판매처만 친 채 ×로 닫으면 그 경로가 초안을 지운다 — 그 판정은 entry-form-guards.ts 소유라
  이 트랙 밖이고…"*

### 3. 얼마나 자주 밟히나
**드물다 — 특정 조건.** "판매처만 적고 다른 칸은 하나도 안 적은 채 닫는" 순서에서만 발생한다.
같은 판정이 날짜·선물 체크·분류도 보지 않으므로, "그제 칩만 눌러 두고 닫았다"도 같은 자리로 온다
(그쪽은 잃는 것이 더 작다).

### 4. 고치는 크기
**S.** 파일 2개(`src/expenses/entry-form-guards.ts` + 호출부 `app/expenses/new.tsx`) — 스냅숏에
`merchant`를 가산 필드로 더하고 호출부 두 줄을 맞춘다. 서버 0 · 새 계약 0.
⚠️ 같은 스냅숏 타입을 지출 상세(`app/expenses/[expenseId].tsx`)도 import하므로 그 쪽 호출부를
함께 봐야 한다(가산 optional로 두면 무접촉).

### 5. 막는 것이 있나
없다. 비세션 렌더 무접촉(판정은 `authToken` 뒤 · 초안 자체가 픽셀락 경로에서 꺼져 있다 —
`new.tsx:1004` `if (process.env.EXPO_PUBLIC_PIXEL_LOCK === "1") return;`).

---

## 권고 순위 — 지금 병렬로 낼 트랙 (파일 교집합 0)

| 순위 | 트랙 | 담는 발견 | **소유 파일(이 트랙만 만진다)** |
|---|---|---|---|
| 1 | **T-A 저장 확정 지연** | F1 | `apps/mobile/app/expenses/new.tsx` · `apps/mobile/app/expenses/[expenseId].tsx` |
| 2 | **T-B 홈 로딩 중 기록 입구** | F2 | `apps/mobile/app/(tabs)/index.tsx` |
| 3 | **T-C 준비템·리포트 탭 기록 입구** | F5 | `apps/mobile/app/(tabs)/items.tsx` · `apps/mobile/app/(tabs)/reports.tsx` |
| 4 | **T-D 전 기간 검색 병렬화** | F4 | `apps/mobile/src/expenses/records-search-scope.ts` · `apps/mobile/src/expenses/use-search-scope-collection.ts` (+ 두 파일의 `*.test.ts`) |
| 5 | **T-E 달 전환 시 목록 유지** | F3 | `apps/mobile/app/(tabs)/records.tsx` |

### 트랙 경계에 대한 실측 메모
- **T-A와 T-E는 파일을 나눠 두었다.** F1의 같은 모양이 `app/(tabs)/records.tsx:1340-1345`
  (행 삭제)에도 있지만, 그 경로에는 이동 타이머도 폼 리셋도 없어 사용자가 기다리는 자리가 아니다.
  그래서 T-A의 범위에서 빼고 records.tsx는 T-E 단독 소유로 둔다(원하면 T-E가 그 세 줄을 함께
  가져가면 되고, 그때도 파일 교집합은 여전히 0이다).
- **테스트 파일 교집합도 0이다.** `src/refresh-wiring-contract.test.ts`는 무효화 **문자열의 존재**만
  무므로(F1 §4) T-A가 그 파일을 고칠 필요가 없다. T-D의 테스트는 그 두 모듈 전용이다.
- **T-C와 F6(준비템 가상화)은 같은 파일을 잡는다.** F6은 이번 병렬 묶음에서 뺐다 — T-C가 끝난
  뒤 별도로 가야 충돌이 없다.
- T-B·T-C·T-E는 서로 다른 탭 파일 하나씩이라 완전히 독립이다.

---

## 이월(이번에 손댈 수 없는 것)

| 항목 | 왜 이월인가 |
|---|---|
| F6 준비템 탭 가상화 | 크기 M + T-C와 같은 파일. 순서로만 풀린다(코드 제약이지 승인 제약은 아니다) |
| 준비템 탭에 상시 FAB를 **비세션에도** 그리는 안 | ITEM-001 재캡처 필요 — 실기기 승인 캡처는 사용자만 할 수 있다. 세션 게이트 안이면 이월이 아니다(F5 §5) |
| F1의 대안 — 무효화 자체를 걷어내는 안 | `src/refresh-wiring-contract.test.ts:119-176`의 6경로 계약(GAP-062 #1)을 깨고, 리포트·예산이 옛 숫자를 말하는 문제가 되살아난다. **기다리지 않는 것**만 고친다 |
| F3의 "이전 달 값을 그대로 남긴다" 단순안 | 값의 달과 헤더의 달이 어긋나는 프레임을 만든다(허위 표시 금지). 판정 설계가 선행 |
| `onlineManager` 재배선으로 오프라인 refetch를 즉시 끝내는 안 | `src/query/app-refetch.ts:11-27`이 그 배선을 **의도적으로 제거**했고(실버그 3건), 되돌리려면 *"먼저 모든 화면에 paused 상태 UI를 만들어야 한다"*고 못박아 두었다. F1은 그 배선 없이 풀린다 |

---

## 정찰의 한계 (있는 그대로)

- **실행 측정은 하지 않았다.** 위의 모든 시간 값은 저장소 안의 상수(재시도 3회 ·
  `DEFAULT_FETCH_TIMEOUT_MS = 10_000` · 백오프 1/2/4초 · 650ms 타이머)와 라이브러리 소스
  (query-core 5.101.2의 `Promise.all`)에서 **계산한 상한**이지, 실기기에서 잰 값이 아니다.
  "몇 초가 걸린다"가 아니라 "무엇을 기다리는가"로 읽어야 한다.
- **읽지 않은 파일이 있다.** 서두에 적은 다섯 파일(설정 화면 · categories · api-error ·
  record-permissions · route-surface 테스트)은 동시 편집 중이라 열지 않았다. 그래서 이 문서에는
  카테고리 체계·보기 전용 문구 대장·라우트 대장에 관한 지적이 하나도 없다 —
  **없어서 안 적은 것이 아니라 보지 않아서 안 적었다.**
- **억지로 채우지 않았다.** 루프 위에서 실제로 코드가 그렇게 하고 있는 것만 7건 적었고,
  그중 지금 병렬로 낼 만한 것은 5건이다. 나머지 두 건(F6·F7)은 크기·빈도를 그대로 적어 두었다.
