# 라운드 106 정찰 S10 — "토스급 슈퍼앱"까지 남은 거리 (실측)

> **읽은 시점**: 2026-09-07, 워킹트리 HEAD 파일 실독(git 명령 0건 · 웹 검색 0건 · 소스 변경 0바이트).
> **방법**: 근거는 전부 이 저장소의 파일이다. 화면이 "무엇을 한다"고 적을 때는 그 동작을 만드는
> 코드 줄을 함께 적었고, 확인할 수 없는 것(실기기 렌더·실제 배포 env·스토어 심사)은 **모른다고 적었다.**
> **동시 편집 경고**: 다른 에이전트 20개가 같은 트리를 편집 중이다. 아래 줄 번호는 위 시점의 값이고,
> 인용은 되도록 **심볼명·상수명**을 함께 적어 줄이 밀려도 찾아갈 수 있게 했다.
> 라운드 104 정찰 A/B/C가 지적한 자리 중 여럿은 **라운드 105가 이미 닫았다** — 이 문서는 그것을
> 다시 세었고, 닫힌 것은 닫혔다고 적는다(§부록 A).

---

## 0. 한 문장 요약

**앱은 다 만들어져 있는데, 실사용자가 들어올 문이 잠겨 있다.**
지출 기록 → 총액 → 시기별 준비물 → 구매 링크 → 구매 후 확인까지 다섯 칸이 **코드로는 전부 이어져 있고**
오프라인 우선 저장·가족 공유·다자녀까지 실제로 돈다. 그런데 오늘 빌드로는 **실사용자가 로그인할 수 없고**
(카카오 키 미주입 + 서버 dev 스텁은 프로덕션 501 fail-closed), 푸시는 패키지가 없어 완전 비활성,
앱 안에 도움을 구할 길은 0건, 커머스는 제휴 0건(일반 쿠팡 검색 링크 62개)이라 **수익도 0**이다.
남은 거리는 "기능을 더 만드는 것"이 아니라 **꺼져 있는 스위치 넷을 켜는 것**(그 넷 중 셋이 사장님 몫)과,
**네 탭 중 세 탭에서 앱의 나머지 절반으로 갈 길이 없는 것**을 여는 것이다.

---

## 1. 기능 인벤토리 — 라우트 전수

`apps/mobile/app/**`의 `.tsx`는 **40개**이고, 레이아웃 2를 뺀 **라우트 파일이 38개**, URL로 접으면 **36개**다
(겹치는 URL 둘 때문에 38 → 36). 그 38 중 다섯은 **한 줄짜리 재수출**(`app/onboarding/*.tsx`)이므로
**실제 화면 모듈은 33개**이고, 그중 캡처 전용 `/pixel-lock`을 빼면 **사용자 여정에 서는 화면은 32개**다.
대장은 `apps/mobile/src/route-surface.test.ts`의 `ROUTE_SURFACE`가 이미 값으로 물고 있고, 아래 표는
그 대장에 **"오늘 실제로 무엇을 하는가"** 한 줄을 붙인 것이다.

판정 어휘 세 가지:
- **동작** — 세션이 있으면 오늘 그대로 돈다.
- **부분** — 돌지만 한쪽 갈래가 비어 있거나 다른 화면이 있어야만 의미가 산다.
- **비활성/그림자** — 오늘 사용자 여정에 서지 않는다(env 미주입 · 캡처 전용 · 아무도 부르지 않음).

### 1.1 사용자 여정에 서는 화면 (32 — 표는 28행, 27행이 설정 하위 5화면을 묶었다)

| # | 라우트 | 오늘 하는 일 (한 줄) | 판정 | 근거 |
|---|---|---|---|---|
| 1 | `/login` (`(auth)/login.tsx`, 650줄) | "카카오로 시작하기" 한 개. 카카오 env 셋이 주입돼 있으면 실 OIDC(PKCE), 아니면 dev 스텁 `/auth/oauth-login` 호출 | **부분** | `login.tsx:190` `isKakaoLoginAvailable() ? await loginWithKakao() : await oauthLogin("kakao")` |
| 2 | `/launch-animation` | 스플래시(인트로 300ms + 단계 320ms×n + 마지막 350ms). 세션 없으면 탭 레이아웃이 여기로 보낸다 | 동작 | `launch-animation.tsx:18,19,26`; `(tabs)/_layout.tsx` `<Redirect href="/launch-animation" />` |
| 3 | `/` (`index.tsx`, 495줄) | 진입 라우팅. 저장소 rehydrate·선택 아이 복구·서버 온보딩 진행도를 읽고 갈 곳을 정한다. 각 단계에 3초 안전밸브 2개 | 동작 | `index.tsx:185`, `:281` `setTimeout(…, 3000)` |
| 4 | `/onboarding/child-status` | 임신/출산/육아 3택 타일 | 동작 | `(onboarding)/child-status.tsx` (150줄) |
| 5 | `/onboarding/child-profile` | 태명·생년월일/예정일·수동 단계 입력, 검증은 `src/children/child-form.ts` 공유 | 동작 | 378줄 |
| 6 | `/onboarding/prepared-items` | 이미 준비한 준비템 체크(`POST /children/:id/prepared-items`) | 동작 | `children.controller.ts:47` |
| 7 | `/onboarding/budget` | 월 예산 입력(`PUT /children/:id/budget`) | 동작 | `budgets.controller.ts:55` |
| 8 | `/onboarding/resume` | 중단 지점 이어하기 카드 | 동작 | `src/onboarding/resume.ts` |
| 9 | `/` 탭 홈 (`(tabs)/index.tsx`, **3190줄**) | 이번 달 합계·예산 진행바·주간 카드·최근 지출 3줄·퀵액션·빠른 기록 칩·알림 벨·FAB. 로딩/실패 갈래에도 FAB와 프로필 진입이 남는다 | 동작 | `:1867`, `:2750`, `:2774` `floatingAction=`; `:1816` 실패 갈래의 `router.push("/(tabs)/more")` |
| 10 | `/records` (2610줄) | 월별 지출 목록(SectionList 가상화) · 달력 · 검색(디바운스 있음) · 전 기간 검색(동시성 4) · 행 롱프레스 액션 | 동작 | `:199-203` PERF-102 주석, `SEARCH_SCOPE_COLLECT_CONCURRENCY = 4` (`records-search-scope.ts:139`) |
| 11 | `/items` (1512줄) | 시기 밴드 탭 + 필요도 필터 + 준비템 타일. 상태 체크는 오프라인 큐를 탄다 | **부분** | 아래 §4.1 — 가상화 0(FlatList 0건) |
| 12 | `/items/[itemTemplateId]` (1535줄) | 준비템 상세 + 구매 링크 CTA + 제휴/스폰서 고지 + 클릭 기록 + 지출 연결 | 동작 | `:717` `clickProductLink(...)`, `:1292` `<AffiliateDisclosure …>` |
| 13 | `/reports` (2054줄) | 월/분기/연 · 카테고리 도넛 · 6개월 추이 · 누적 · 마일스톤 | 동작 | `reports.controller.ts` 6개 엔드포인트 |
| 14 | `/more` (`(tabs)/more.tsx`, 715줄) | 프로필 카드 + 4구획 메뉴(아이·가족 / 예산·데이터 / 설정). **탭 바에는 없다**(`href: null`) | 동작 | `(tabs)/_layout.tsx` `<Tabs.Screen name="more" options={{ href: null }} />` |
| 15 | `/expenses/new` (**2839줄**) | 빠른 기록 시트. SQLite 우선 저장 → 아웃박스. 자동완성·판매처 추천·금액 프리셋·초안 자동저장(500ms) | 동작 | `:1575` 이후 무효화 6묶음이 `void (async () => …)`로 확정 밖에 있다 |
| 16 | `/expenses/[expenseId]` (1660줄) | 지출 상세·수정·삭제(soft delete)·정기 지출로 등록 | 동작 | `expenses.controller.ts:90,110` |
| 17 | `/expenses/recurring` (665줄) | "매달 이맘때 이 정도" 메모 등록. **지출을 만들지 않는다**(그 사실을 화면 위쪽에 먼저 적는다) | **부분(설계상)** | `recurring.tsx:55-64` 머리말; `recurring-flow.test.ts`가 `createExpense` import 0건을 고정 |
| 18 | `/budget` (723줄) | 예산 수정. 사용액·잔액·지난달 실적을 **새 요청 없이** 기존 캐시에서 읽는다 | 동작 | `budget.tsx:61-66` |
| 19 | `/family` (1010줄) | 가구 구성원 목록 · 역할 · 초대 관리 · 내보내기 | 동작 | `households.controller.ts` |
| 20 | `/family/invite` (373줄) | 초대 링크 발급 | **부분** | 링크 도메인은 서버 `INVITE_LINK_BASE_URL` — 미설정이면 `https://wooriai.local`(`.env.example:111`) |
| 21 | `/family/accept/[token]` (530줄) | 초대 수락. 오프라인/네트워크/영구 실패 갈래가 각각 다른 문장 | 동작 | `family/accept/[token].tsx:52-59` |
| 22 | `/import` (765줄) | 엑셀/CSV 업로드(`expo-document-picker`) | 동작 | `import/index.tsx` |
| 23 | `/import/[importJobId]` (1555줄) | 파싱 결과 미리보기 · 행 수정 · 승인 · 되돌리기. **승인 전에는 `expenses`에 저장하지 않는다**(DNC-012) | 동작 | `imports.controller.ts:133,164,205` |
| 24 | `/notifications` (453줄) | 인앱 알림함(로컬 생성 알림). 탭하면 그 아이로 전환한 뒤 목적지로 | 동작 | `notifications.tsx:42-48` |
| 25 | `/sync-status` (1014줄) | 대기·실패·충돌 큐(FlatList 가상화). 재시도/버리기/충돌 3지선다 | 동작 | `sync-status.tsx:78-83` |
| 26 | `/settings` (545줄) | 9행 설정 허브 | 동작 | `settings/index.tsx:316-426` |
| 27 | `/settings/children`·`/settings/privacy`·`/settings/app-lock`·`/settings/categories`·`/settings/amount-presets` | 아이 관리(954) · 약관/삭제/탈퇴(1037) · PIN 잠금(444) · 커스텀 분류(514) · 금액 프리셋(171) | 동작 | 각 파일 머리말 |
| 28 | `/settings/notifications` (399줄) | 기기 목록 + 푸시 마스터 토글 — **토글이 정직하게 비활성**이고 "앱 업데이트 후 사용할 수 있어요"를 안내 | **부분(정직한 비활성)** | `settings/notifications.tsx:47-49` |

### 1.2 오늘 사용자 여정에 서지 않는 자리 (모듈 1 + 그림자 URL 4 + 겹침 URL 2, 그리고 스캐폴드 4)

| 자리 | 왜 서지 않는가 | 근거 |
|---|---|---|
| `/pixel-lock` (70줄) | `__DEV__` 또는 `EXPO_PUBLIC_PIXEL_LOCK=1`일 때만 열린다. 출시 빌드에는 없다 | `pixel-lock.tsx:21`; `route-surface.test.ts` `SPECIAL_ROUTE_DOORS` |
| `/child-profile`·`/child-status`·`/prepared-items`·`/resume` (그림자 4) | `(onboarding)` 그룹 세그먼트가 URL에서 지워져 생긴 **참조 0건 URL**. 앱은 언제나 `/onboarding/*` 정본만 부른다 | `route-surface.test.ts` `UNREFERENCED_URL_REASONS` |
| `/budget` (겹침) | `(onboarding)/budget.tsx`와 `budget.tsx`가 **같은 URL**에 등록된다. 어느 쪽이 이기는지는 **소스가 답하지 못한다** — 실기기 확인 항목 | `route-surface.test.ts` `URL_OVERLAPS`, `docs/qa/runtime-verification-required.md §1-1` |
| `/` (겹침) | `(tabs)/index.tsx`와 `index.tsx`가 둘 다 `/`. 앱은 홈으로 갈 때 `"/(tabs)"`를 부르고 진입으로 갈 때만 `"/"`를 불러 오늘은 안 부딪힌다(딥링크·복원은 미확인) | 위와 같음 |

**스캐폴드 — 배선은 다 됐고 값만 없다 (4):**

| 기능 | 오늘 상태 | 켜는 조건 | 근거 |
|---|---|---|---|
| 카카오 실 로그인 | **꺼짐**. `.env.example`이 `EXPO_PUBLIC_KAKAO_ENABLED=0`, CLIENT_ID 빈 값. 저장소에 `.env` 없음 | 카카오 개발자 콘솔 앱 + 3개 키 주입 + 서버 `OAUTH_KAKAO_*` | `.env.example:17-19`; `src/auth/kakao-login.ts` 머리말 |
| FCM 푸시 | **완전 비활성**. `expo-notifications`가 `apps/mobile/package.json` 의존성에 **없다**. `tryLoadExpoNotifications()`가 항상 null | ⚠️ **새 npm 의존성 설치**(승인 필요) + Firebase 자격 + `PUSH_ENABLED=1` + `EXPO_PUBLIC_PUSH_ENABLED=1` | `package.json` dependencies 전수; `src/notifications/push-token-source.ts:1-40` |
| 고객 지원 / FAQ 행 | **행 자체가 서지 않는다.** `EXPO_PUBLIC_SUPPORT_URL`·`EXPO_PUBLIC_FAQ_URL`이 `.env.example`에서 빈 값 | 두 HTML을 호스팅하고 URL 주입 | `.env.example:91-92`; `src/settings/support-links.ts` `supportLinkUrls()` |
| 약관 · 개인정보 [보기] 링크 | **링크가 그려지지 않는다.** `EXPO_PUBLIC_TERMS_URL`·`EXPO_PUBLIC_PRIVACY_POLICY_URL`이 빈 값 | 호스팅 URL 주입(Play 등록 URL과 같은 값) | `.env.example:86-87`; `src/consent/legal-links.ts` |

> ⚠️ 넷 다 **"고칠 수 없어서 감춘다"** 관례를 지킨다 — 죽은 버튼을 만들지 않고 행을 통째로 지운다.
> 그 판단은 옳다. 다만 **넷이 동시에 꺼져 있는 오늘의 앱**은, 사용자 입장에서 "로그인도 안 되고 ·
> 알림도 없고 · 문의할 곳도 없는 앱"이다. 각 결정이 옳아도 합이 그렇다는 사실을 값으로 적어 둔다.

---

## 2. 핵심 루프의 완결성 (DNC-002)

| 칸 | 코드가 하는가 | 오늘 끊기는가 | 근거 |
|---|---|---|---|
| ① 지출 기록 | **예.** SQLite 우선 저장 → 아웃박스 → 플러시. 오프라인에서도 실제로 남는다 | 끊기지 않음 | `src/offline/sync-controller.ts:532` `createExpenseOffline` |
| ② 총액 확인 | **예.** 홈·기록·리포트 셋이 같은 재조정(`reconcileMonthlyExpenses`)을 지나 대기 행까지 포함해 센다. 서버 집계는 일자 groupBy라 행 수에 안 눕는다 | 끊기지 않음 | `reporting-store.service.ts` `getTrendReport`/`getYearlyReport`/`getCumulativeReport` |
| ③ 시기별 준비물 | **예.** 62개 시드 템플릿 × 단계(stageCodes) + 커스텀 준비템(아이당 200 상한) | 끊기지 않음 | `apps/api/prisma/seed-data.ts` `itemTemplateSeeds` 62건; `CUSTOM_ITEM_MAX_PER_CHILD = 200` |
| ④ 구매 링크 클릭 | **예 — 다만 목적지가 상품이 아니라 검색 결과다.** 링크 67건 = 활성 62건(전부 `https://www.coupang.com/np/search?q=…`) + 비활성 스폰서 자리 5건. `isAffiliate: false` · `affiliateUrl: null` · `disclosureText: null` | **수익 고리가 끊겨 있다** | `seed-data.ts` `productLinkSeeds` 67객체 실측(활성 62 / 비활성 5), 머리말 "플랜 B" |
| ⑤ 구매 후 기록/상태 | **예.** 클릭이 pending을 만들고, 포그라운드 복귀 때 카드가 묻고, **지출 저장이 그 대기를 해소한다**(`linkedItemTemplateId` 사실 하나로만 — 이름 추측 금지) | 끊기지 않음 | `src/commerce/purchase-followup-resolution.ts`; `app/_layout.tsx:6` `PurchaseFollowupLifecycle` |

**결론**: 루프 다섯 칸 중 **제품 동작으로 끊긴 칸은 0개**다. 끊긴 것은 ④의 **사업 고리**(제휴 수수료)이고,
그것은 코드가 아니라 쿠팡 파트너스 승인이 여는 자리다. 전환 도구는 이미 있다 —
`docs/5차/plan-a-affiliate-links-template.csv` + 어드민 CSV 일괄 미리보기/적용
(`apps/api/src/admin/product-link-bulk.service.ts`, `apps/admin/app/links/page.tsx`).

⚠️ 다만 루프 **앞**에 문이 하나 잠겨 있다: **로그인**(§3-ㄹ / §6-L1). 루프가 아무리 완결이어도
그 문을 못 지나면 사용자는 루프에 들어오지 못한다.

---

## 3. "토스급"을 이 코드베이스 기준으로 분해한 네 축

### (ㄱ) 실패해도 사용자가 갇히지 않는가 — **오늘: 상(上). 이 저장소가 가장 잘하는 축이다.**

**값으로:**
- 조회 실패 문구·오프라인 인지의 **단일 소스가 하나**이고, 그 목록이 `app/**` 스윕과 정확히 일치하는지를
  계약이 센다 — `src/offline/offline-aware-screens.ts`(배선된 조회 화면 · 제외 이유 · 배선된 저장 화면 3목록).
- 동기화 큐에 **재시도·버리기·충돌 3지선다**가 서 있다(`app/sync-status.tsx`, 1014줄, 재시도 관련 문자열 21건).
- 라운드 104가 찾은 "갇히는" 자리 셋이 **닫혔다**:
  - 접힌 수정이 멱등키를 물려받아 409로 굳던 자리 → 본문이 달라지면 새 키가 나가고 `VERSION_CONFLICT`
    (= 이미 설계된 회복 경로)로 떨어진다. `src/offline/outbox-merge.ts` `foldedUpdateIdempotencyKey`.
  - 401 한 번이 큐 전량을 태우던 자리 → 401·408·429가 transient 갈래로 가고 그 갈래는 `break`다.
    `src/offline/sync-engine.ts:909`, `:1127`(준비템 큐도 같은 규칙).

**약한 화면 (남은 것):**
| 화면 | 무엇이 약한가 | 근거 |
|---|---|---|
| `(auth)/login.tsx` | **유일한 진짜 막다른 길.** 실사용자 빌드 + 카카오 키 미주입이면 서버가 501로 fail-closed하는데, 화면은 `LOGIN_FAILED_MESSAGE`("네트워크 연결을 확인한 뒤 다시 시도")를 띄운다. 네트워크는 멀쩡하고, 몇 번을 눌러도 같다 | `apps/api/src/auth/auth.service.ts:26-32`; `src/auth/login-copy.ts` `loginFailureMessage` |
| `(tabs)/records`·`items`·`reports` | 홈이 아닌 탭에서 **설정·알림함으로 가는 길이 없다.** `/(tabs)/more`를 미는 자리는 `(tabs)/index.tsx` 두 곳뿐이고, `NotificationBell`도 홈에만 있다 | `grep router.push("/(tabs)/more")` → index.tsx 2건; `grep NotificationBell` → index.tsx만 |
| 오프라인 쓰기 미지원 화면 | 예산 저장·커스텀 분류·커스텀 준비템·가족 초대는 **오프라인에서 할 수 없다**(문구는 정직하게 오프라인이라 말하지만 행동은 없다). 오프라인 쓰기가 있는 것은 지출 4연산 + 준비템 상태뿐 | `sync-controller.ts` export 전수: `createExpenseOffline`·`updateExpenseOffline`·`deleteExpenseOffline`·`updateItemStatusOffline` |

### (ㄴ) 기다림이 보이지 않는가 — **오늘: 중상(中上). 라운드 105가 크게 올려놨다.**

**값으로 닫힌 것:**
- 저장 확정이 서버 재조회를 기다리지 않는다 — 무효화 6묶음이 `void (async …)`로 확정 밖에 있다
  (`app/expenses/new.tsx:1574` 이후, 머리말 "라운드 104 SAVE(F1)").
- 홈 로딩 갈래에도 FAB가 선다(`(tabs)/index.tsx:1867`).
- 전 기간 검색이 **동시성 4**로 돈다(`records-search-scope.ts:139`).
- 검색 입력에 확정 지연이 있다(`recordsSearchCommitDelayMs` — `records-search-responsiveness.test.ts`).
- 준비템 탭 `useMemo` 0 → **24개**(`(tabs)/items.tsx`), 자식의 `useMemo` 2개가 적중한다
  (`src/items/items-render-cost.test.ts`가 값으로 문다).

**남은 기다림 (값):**
| 자리 | 얼마나 | 근거 |
|---|---|---|
| 콜드 스타트 | 스플래시(≈1.0~1.2초) **+ 최악 6초**(rehydrate 3초 + 진행도 조회 3초, 두 안전밸브) | `launch-animation.tsx:18,19,26`; `index.tsx:185`,`:281` `setTimeout(…, 3000)` |
| 모든 조회 실패 | 요청당 상한 10초 × react-query 기본 retry 3회 + 백오프. **`onlineManager` 배선이 없어** 오프라인에서 즉시 paused로 끝나는 탈출구가 없다 | `src/api/client.ts:83` `DEFAULT_FETCH_TIMEOUT_MS = 10_000`; `src/query/app-refetch.ts:11-13` "FIX-118A: onlineManager 배선은 의도적으로 없다" |
| 저장 후 화면 이탈 | 성공 후 `setTimeout(…, 650)` 뒤에 `router.replace` | `app/expenses/new.tsx:1632` |
| 준비템 탭 첫 페인트 | 카탈로그 전량을 **한 번에 마운트**(가상화 0) — §4.1 | `(tabs)/items.tsx` FlatList 0건 |

### (ㄷ) 한 손으로 되는가 — **오늘: 중(中).**

**값으로 좋은 것:**
- 터치 타깃 토큰 `theme.touchTarget = 48`(`src/theme.ts:248`)이 있고 a11y 계약이 그것을 센다.
- **네 탭 전부에 FAB가 있다** — 홈·기록·준비템·리포트 넷이 `AppScreen`의 `floatingAction` 슬롯을 쓴다
  (라운드 104 F5가 지적한 자리가 닫혔다). `grep -l floatingAction` → 탭 4개 + `src/ui.tsx`.
- 지출 입력 시트가 `KeyboardAvoidingView`로 요약바를 키보드 위로 밀어 올린다(`app/expenses/new.tsx:1830`).

**약한 화면:**
| 화면 | 무엇이 약한가 | 근거 |
|---|---|---|
| 기록·준비템·리포트 탭 | 설정 세계로 가려면 **홈으로 돌아간 뒤 우상단**을 눌러야 한다. 우상단은 한 손 엄지의 가장 먼 지점이고, 그 경로가 3탭에서는 아예 없다 | §3-ㄱ의 같은 근거 |
| 설정 하위 5화면 | 홈 → 더보기 → 설정 → X = **탭 3번**, 매번 상단 좌측 back으로 되돌아온다 | 라우트 도달 맵(`/settings/app-lock`·`categories`·`amount-presets`는 `app/settings/index.tsx`가 유일한 입구) |
| 준비템 탭 | 밴드 탭 · 필요도 필터가 화면 상단에 가로로 서 있고, 목록은 그 아래 전체를 세로로 채운다(가상화 없음) | `(tabs)/items.tsx:1037`, `:1196`, `:1209` |

> ⚠️ **소스로 답할 수 없는 것**: 실제 엄지 도달 범위·기기 크기별 레이아웃은 이 저장소의 vitest가
> 렌더할 수 없다(react-native 바인딩 없음). 위 셋은 **경로의 깊이와 컨트롤의 위치**만 센 것이다.

### (ㄹ) 말이 정직한가 — **오늘: 상(上). 단, 정직이 깨지는 자리 둘.**

**값으로 좋은 것 (이 저장소의 진짜 자산):**
- 제휴가 아닌 링크에 제휴 고지를 붙이지 않는다 — 62개 활성 링크가 `disclosureText: null`이고,
  시드 머리말이 그 이유를 "DNC-010의 반대 방향 오류"로 못 박는다.
- 스폰서 계약이 없어 스폰서 배지를 달지 않는다 — 예시 5건은 `active: false`로 내려 뒀다.
- 정기 지출 화면이 **"이 화면은 지출을 만들지 않는다"**를 화면 위쪽에 먼저 적는다.
- 푸시 토글이 켜지는 척하지 않고 비활성 + 이유를 말한다.
- 가격 스냅샷을 지어내지 않는다(`priceSnapshotKrw: null` — "검색 결과 페이지에는 단일 가격이 없다").
- 로그인 문구의 두 갈래(테스트/스토어)가 뒤바뀌지 않도록 순수 모듈 + 계약으로 고정돼 있다.

**정직이 깨지는 자리 둘:**
| 자리 | 무엇이 사실이 아닌가 | 근거 |
|---|---|---|
| `(auth)/login.tsx` 실패 문구 | 카카오 미설정 실사용자 빌드에서 "**네트워크 연결을 확인한 뒤 다시 시도해 주세요**"라고 말한다. 원인은 네트워크가 아니라 **기능 미설정**이고, 다시 시도해도 절대 성공하지 않는다. 이 저장소가 다른 네 자리(더보기·설정·개인정보·가져오기)에서 지키는 규율 — *"다시 눌러도 결과가 같은 실패에 기다리라고 말하지 않는다"* — 이 여기서만 깨진다 | `src/settings/support-links.ts` `SUPPORT_LINK_FAILED_MESSAGE` 머리말(라운드 72 리뷰 M-1)의 규율 ↔ `login-copy.ts` `LOGIN_FAILED_MESSAGE` |
| `app/import/index.tsx:479` | "**AI 분류 미리보기**" + "총 128건 · ₩1,245,700" 목업. 실제 파서는 `exceljs` + **키워드 `includes` 매칭**이고 AI가 아니다 | `apps/api/src/imports/import-parser.ts:82-83` "Keyword -> seeded category code"; 목업은 `showPreviewMockup`(비세션)에서만 그려지고 스크린리더에는 숨겨져 있어 **피해 범위는 로그인 전 화면 한 곳** |

---

## 4. 데이터가 쌓일수록 나빠지는 자리 — 상한이 없는 자리를 센다

### 4.1 상한이 **없는** 자리 (실측)

| 자리 | 상한 | 시나리오에서 무슨 일이 | 근거 |
|---|---|---|---|
| **준비템 탭 렌더** | **없음** | 시드 62 + 커스텀 200 = **최대 262행을 한 번에 마운트**한다. `(tabs)/items.tsx`·`PreparationListParity.tsx`(762줄) 둘 다 `FlatList` **0건**, 목록은 `.map()` + 부모의 `AppScreen`(ScrollView) | `grep -c FlatList` → items.tsx 0 / PreparationListParity.tsx 0; `CUSTOM_ITEM_MAX_PER_CHILD = 200` |
| **전 기간 검색의 메모리** | 달 수만 상한(아이 나이) | 21~33개월치 지출 **행 전량**을 react-query 캐시에 올려 두고(`useQueries`가 그 달들을 active로 세운다), 매 재조립마다 전량을 훑는다. 3년치 1만 건이면 1만 행이 메모리에 산다 | `src/expenses/use-search-scope-collection.ts` `monthQueries` + `rebuildSearchScopeResult` |
| **홈의 월 조회 2건** | 달당 25,000건 | 홈은 **이번 달 + 지난달** 전량을 각각 수집한다(`fetchMonthExpenses` × 2). 달당 500건 초과면 순차 커서 왕복이 늘고, 50페이지(=25,000행)를 넘으면 **부분 결과 대신 오류**를 던진다 | `(tabs)/index.tsx:1222`,`:1253`; `EXPORT_MAX_PAGES_PER_MONTH = 50` |
| **알림함** | 없음 | `src/notifications/notification.store.ts`에 쌓이고, 정리 수단은 "모두 지우기"와 행 하나 삭제뿐 | `app/notifications.tsx:42-48` |
| **정기 지출 템플릿** | **20** | 상한 있음 — 문제 없음 | `src/expenses/recurring-template.ts:90` `RECURRING_TEMPLATE_LIMIT = 20` |

### 4.2 상한이 **있는** 자리 (이 앱이 이미 잘 막아 둔 곳)

| 자리 | 상한 | 근거 |
|---|---|---|
| 지출 목록 응답 | 기본 200 / 최대 500, keyset 커서 | `EXPENSE_LIST_DEFAULT_LIMIT`·`EXPENSE_LIST_MAX_LIMIT`(`packages/contracts`) |
| 한 달 수집 | 50페이지 = 25,000행, 넘으면 **조용히 자르지 않고 오류** | `src/export/expense-page-collector.ts:30` |
| 리포트 3종(추이·연간·누적) | **행 수가 아니라 "지출이 있었던 날짜 수"**로 전송량이 결정된다(DB에서 `groupBy spentOn` 후 JS에서 월/연 접기). 3년치 1만 건이어도 최대 1,095행 | `reporting-store.service.ts` `getTrendReport`·`getYearlyReport`·`getCumulativeReport` |
| 커스텀 분류 | 가구당 **15**(정식 12 + 15 = 27 ≤ 카테고리 예산 상한 30) | `CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD = 15` |
| 커스텀 준비템 | 아이당 **200** | `CUSTOM_ITEM_MAX_PER_CHILD = 200` |
| 기록 탭 목록 | SectionList 가상화 | `(tabs)/records.tsx:199-203` |
| 동기화 큐 화면 | FlatList 가상화 | `app/sync-status.tsx:78-83` |
| 가져오기 | 파일당 2,000행 · 10MB | `import-parser.ts` `DEFAULT_MAX_ROWS = 2000` |
| 데이터 보존 | 텔레메트리 400일 · 감사 730일 · 가져오기 행 90일 · 초대 90일 · 어드민 세션 30일 · 파기 유예 30일 | `.env.example:35-80` + `data_retention_purge` 잡 |

> **판정**: 지출 1만 건 · 3년치 · 커스텀 분류 15개는 **서버가 이미 견딘다**(집계가 일자 groupBy다).
> 무너지는 쪽은 **모바일 렌더 한 곳(준비템 탭)** 과 **전 기간 검색의 메모리 한 곳**이다.

---

## 5. 경쟁 우위가 실제로 코드에 있는가

| 주장 | 코드로 확인한 결과 | 근거 |
|---|---|---|
| **시기별 준비물 + 지출을 한 곳에서** | **진짜다.** 준비템 상세의 "지출 기록하고 준비 완료"가 `linkedItemTemplateId`를 실어 지출을 만들고, 서버가 그 준비템을 자동으로 '준비 완료'로 올린다(`store-shared.ts markLinkedItemPrepared`). 반대 방향도 있다 — 저장된 지출이 구매 확인 대기를 해소한다. **이름 추측으로 잇지 않고 id 사실 하나로만 잇는다** | `app/expenses/new.tsx:1617-1618` 무효화; `src/commerce/purchase-followup-resolution.ts` |
| **오프라인 우선** | **진짜다, 단 지출과 준비템 상태에 한해서.** expo-sqlite 실저장 + `PRAGMA user_version` 마이그레이션 러너 + 아웃박스 + 멱등키 + 충돌 3지선다 + 델타 풀(`GET /sync/changes`). 여기까지가 이 저장소에서 가장 깊게 만들어진 부분이다 | `src/offline/` 40여 파일; `sqlite-offline-store.ts` `OFFLINE_DB_MIGRATIONS` |
| **가족 공유** | **진짜다.** 역할 4종(owner/co_parent/viewer/gift_participant)이 서버 RBAC와 모바일 게이트(`useExpenseEntryGate`·`useItemStatusGate`) 양쪽에 있고, 보기 전용 참여자에게는 **지킬 수 없는 약속 문장을 아예 접는다**. 초대는 토큰 + 7일 만료 + 감사 로그 | `apps/api/src/households/`; `src/family/record-permissions.ts`; `(tabs)/index.tsx:1839-1846` |
| **다자녀** | **진짜다.** 선택 아이 스토어 + 전환 시 아이 스코프 캐시 무효화 한 벌(`applyChildSwitch`)을 헤더·아이 관리·알림 탭이 **같이** 쓴다 | `src/children/child-switch.ts` |
| **엑셀 가져오기** | **진짜다.** `exceljs` + `iconv-lite`(CP949), 매직바이트 검사, 열 자동 인식(구체어 우선 · `항목`은 폴백), 승인 전 미저장(DNC-012), 되돌리기까지 | `apps/api/src/imports/import-parser.ts` |
| **"AI 분석"** | **아니다.** 키워드 `includes` 매칭이다. 앱은 로그인 전 목업 한 곳에서만 "AI 분류 미리보기"라고 적는다 | §3-ㄹ |
| **수익 구조(제휴)** | **오늘은 없다.** 활성 링크 62건 전부 비제휴 검색 링크 | §2 ④ |

---

## 6. 끊긴 고리 목록 (오늘 실제로 끊겨 있는 것만)

| ID | 끊긴 것 | 누가 끊었나 | 누가 이을 수 있나 | 근거 |
|---|---|---|---|---|
| **L1** | **실사용자 로그인.** 스토어 빌드는 "카카오로 시작하기"를 그리고, 키가 없으면 dev 스텁을 부르고, 서버는 프로덕션에서 501을 던지고, 화면은 네트워크 탓을 한다 | env 미주입 | **사장님**(카카오 콘솔 앱·키) + 코드(미설정 상태의 문구·상태) | `auth.service.ts:26-32`; `login.tsx:190`; `.env.example:17-19` |
| **L2** | **앱 안에 도움을 구할 길 0건.** 문의·FAQ 행이 서지 않는다 | URL 미주입 | **사장님**(두 HTML 호스팅) | `.env.example:91-92`; `infra/site/{support,faq}.html` 존재 |
| **L3** | **약관·개인정보 [보기] 링크 0건.** Play 등록 URL과 같은 값이 앱에도 필요하다 | URL 미주입 | **사장님**(호스팅) | `.env.example:86-87` |
| **L4** | **푸시 알림 전량.** 서버 발송 경로(FCM HTTP v1)는 있는데 기기가 토큰을 만들 수 없다 | `expo-notifications` 미설치 | ⚠️ **새 npm 의존성 승인** + Firebase 자격(사장님) | `apps/mobile/package.json`; `push-token-source.ts` |
| **L5** | **제휴 수익.** 링크는 살아 있지만 전부 비제휴 검색 링크 | 쿠팡 파트너스 미승인 | **사장님**(파트너스 승인) → 어드민 CSV 일괄 적용 | `seed-data.ts` `productLinkSeeds` 머리말 |
| **L6** | **탭 3개에서 앱의 나머지 절반으로 가는 길.** 기록·준비템·리포트에서 설정·알림함에 못 간다 | 코드 | 코드 | `grep`으로 진입점 전수: 홈 2건뿐 |
| **L7** | **준비템 탭의 가상화.** 최대 262행을 한 번에 마운트 | 코드 | 코드 | `grep -c FlatList` = 0 |
| **L8** | **오프라인 쓰기가 지출·준비템 상태에만 있다.** 예산·분류·커스텀 준비템·가족은 온라인 전용 | 설계 | 코드(범위 결정 필요) | `sync-controller.ts` export 전수 |
| **L9** | **`/budget` URL 겹침의 착지 화면이 미상.** 예산 알림을 탭했을 때 온보딩 예산 화면이 열릴 가능성을 소스가 배제하지 못한다 | expo-router 규칙 | **실기기 확인** | `route-surface.test.ts` `URL_OVERLAPS`; `docs/qa/runtime-verification-required.md §1-1` |

---

## 7. 다음 다섯 라운드 — 무엇을 하면 가장 크게 좋아지는가

우선순위 근거는 전부 위 실측이다. **소유 파일은 교집합이 없다.**

### P1 — 실사용자가 로그인할 수 있게 한다 (L1) ⚠️ **사장님 몫 포함(외부 계정)**

- **왜 1등인가**: 루프 다섯 칸이 전부 이어져 있는데 **그 앞의 문 하나가 잠겨 있다.** 다른 어떤 개선도
  로그인을 지나지 못한 사람에게는 도달하지 않는다.
- **사장님 몫**: 카카오 개발자 콘솔 앱 생성 → REST API 키 · redirect URI 등록 → 3개 키를 빌드에 주입,
  서버 `OAUTH_KAKAO_CLIENT_ID` · `OAUTH_KAKAO_REDIRECT_URIS` 설정.
- **코드 몫(사장님 없이도 오늘 가능)**: 키가 없는 실사용자 빌드에서 **거짓말을 멈춘다** —
  ⓐ `loginFailureMessage`에 "미설정" 갈래를 하나 더 세우거나, ⓑ CTA 자체를 비활성 + 이유로 바꾼다
  (이 저장소가 푸시 토글·지원 링크·공유 버튼에서 이미 세 번 쓴 그 형식). **새 의존성 0 · 픽셀락 무접촉**
  (AUTH-001은 `scripts/pixel-lock/pixel-lock-screens.json`의 캡처 대상이 아니다 — `login-copy.ts` 머리말이 그 사실을 적어 뒀다).
- **소유 파일**:
  - `apps/mobile/app/(auth)/login.tsx`
  - `apps/mobile/src/auth/login-copy.ts`
  - `apps/mobile/src/auth/kakao-login.ts`
  - `apps/mobile/src/auth/release-build.ts`
  - `apps/api/src/auth/auth.service.ts`
  - `apps/api/src/auth/kakao/` (디렉터리 전체)

### P2 — 탭 넷 전부에 프로필·알림 진입 슬롯을 세운다 (L6)

- **왜 2등인가**: 오늘 앱의 **절반**(설정 9행 · 알림함 · 가족 · 가져오기 · 동기화 상태)이 홈에서만 열린다.
  DNC-003이 탭을 넷으로 잠갔으므로 다섯째 탭은 답이 아니고, 답은 **홈 헤더가 이미 쓰는 그 슬롯**을
  나머지 셋에 그대로 옮기는 것이다(`testID="home-profile-entry"` + `NotificationBell`).
- **픽셀락**: 리포트(REP-001)·준비템(ITEM-001) 캡처는 **비세션 렌더**다. `reports.tsx:1255`가 FAB를
  `hasSession ? … : undefined`로 세운 그 선례를 그대로 따르면 **재캡처 없이** 세션 화면만 바뀐다.
- **소유 파일**:
  - `apps/mobile/src/ui.tsx` (AppScreen 헤더 슬롯)
  - `apps/mobile/app/(tabs)/records.tsx`
  - `apps/mobile/app/(tabs)/reports.tsx`
  - `apps/mobile/src/notifications/NotificationBell.tsx`
  - `apps/mobile/src/route-surface.test.ts` (진입점 대장 갱신)

### P3 — 준비템 탭을 가상화한다 (L7)

- **왜 3등인가**: 이 앱의 **차별점 그 자체인 화면**이 유일하게 가상화가 없는 목록이다. 커스텀 준비템
  상한이 200이므로 최악 262행이고, 기록 탭(PERF-102)·동기화 화면(SYNC-127)이 **같은 이유로 이미
  FlatList로 옮긴 선례**가 저장소 안에 둘 있다. 라운드 105가 `useMemo`로 재계산은 이미 막았으므로
  남은 것은 **마운트 비용** 하나다.
- **주의**: `AppScreen`(ScrollView) 안에 FlatList를 중첩하면 가상화가 꺼진다 — 기록 탭이 한 그대로
  스크롤러 자체를 리스트로 바꾸고 배경·패딩을 리스트에 직접 준다.
- **소유 파일**:
  - `apps/mobile/app/(tabs)/items.tsx`
  - `apps/mobile/src/preparation/PreparationListParity.tsx`
  - `apps/mobile/src/preparation/preparation-grouping.ts`
  - `apps/mobile/src/items/items-render-cost.test.ts`

### P4 — 꺼져 있는 스위치 셋을 켠다: 지원/FAQ · 약관 URL · 푸시 (L2·L3·L4) ⚠️ **사장님 몫 + 새 npm 의존성**

- **왜 4등인가**: 셋 다 **코드는 이미 끝나 있고 값만 없다.** 그런데 셋이 함께 꺼져 있어서 오늘의 앱에는
  **리텐션 장치가 0개**이고 **문의 창구도 0개**다. 스토어 심사에도 약관·개인정보 URL이 필요하다.
- **사장님 몫**: ⓐ `infra/site/{support,faq}.html`과 `infra/legal/*.html`을 호스팅하고 URL 4개 주입,
  ⓑ Firebase 프로젝트 + `google-services.json` + 서비스 계정 JSON.
- **⚠️ 새 npm 의존성**: `expo-notifications` 설치가 필요하다(승인 대상). 설치 전까지는 `settings/notifications.tsx`의
  정직한 비활성이 정답이므로 **코드를 미리 바꾸지 않는다.**
- **소유 파일**:
  - `infra/site/support.html`, `infra/site/faq.html`, `infra/site/README.md`
  - `.env.example`, `scripts/check-env.ts`, `scripts/deploy/oracle-bootstrap.sh`
  - `apps/mobile/src/settings/support-links.ts`, `apps/mobile/src/consent/legal-links.ts`
  - `apps/mobile/app/(tabs)/more.tsx`, `apps/mobile/app/settings/index.tsx`, `apps/mobile/app/settings/notifications.tsx`
  - `apps/mobile/src/notifications/push-token-source.ts`

### P5 — 제휴 전환 준비를 끝까지 리허설한다 (L5) ⚠️ **사장님 몫(쿠팡 파트너스 승인)**

- **왜 5등인가**: 수익 0의 원인은 코드가 아니라 승인이다. 그러나 **승인 도착일에 바로 전환되려면**
  CSV 템플릿 · 어드민 일괄 미리보기/적용 · 시드 upsert 키(itemTemplateId, platform, title)가 실제로
  맞물리는지를 **미리 한 번 돌려 봐야 한다**(시드 머리말이 "재시드 대신 `pnpm db reset`이 필요하다"고
  경고하는 자리가 바로 그 함정이다).
- **코드 몫(오늘 가능)**: 더미 딥링크로 CSV 왕복 리허설, `isAffiliate: true` 전환 시 고지 문구가
  실제로 CTA 옆에 서는지(DNC-010) e2e로 고정.
- **소유 파일**:
  - `apps/api/prisma/seed-data.ts`
  - `docs/5차/plan-a-affiliate-links-template.csv`
  - `apps/api/src/admin/product-link-bulk.service.ts`, `apps/api/src/admin/product-link-bulk-csv.util.ts`
  - `apps/admin/app/links/page.tsx`

### 이번 라운드에 **하지 말아야 할 것**

- **새 기능 추가.** 화면 모듈 33개 중 32개가 오늘 여정에 서고, 그중 판정이 "동작"인 것이 대부분이다
  (§1.1에서 "부분"으로 적은 것은 로그인 · 준비템 탭 · 정기 지출 · 가족 초대 · 푸시 설정 다섯뿐이다).
  기능이 모자라서 안 팔리는 상태가 아니다.
- **`/budget` URL 겹침을 소스만 보고 "고치는" 것.** 어느 화면이 이기는지 소스는 모른다 — **실기기 확인
  먼저**(L9), 그다음에 결정.

---

## 부록 A — 라운드 104 지적 중 오늘 이미 닫힌 것 (재측정)

| 라운드 104 항목 | 오늘 | 근거 |
|---|---|---|
| A-F1 저장이 서버 재조회를 기다린다 | **닫힘** | `app/expenses/new.tsx` 무효화가 `void (async …)` 밖으로 나갔다 |
| A-F2 홈 로딩 갈래에 기록 입구가 없다 | **닫힘** | `(tabs)/index.tsx:1867` 로딩 갈래의 `floatingAction` |
| A-F3 달 전환 시 합계 카드가 사라진다 | **닫힘** | `records-search-responsiveness.test.ts` #3 |
| A-F4 / C-1 전 기간 검색이 직렬 | **닫힘** | `SEARCH_SCOPE_COLLECT_CONCURRENCY = 4` |
| C-2 검색 디바운스 없음 | **닫힘** | `recordsSearchCommitDelayMs` |
| A-F5 준비템·리포트에 기록 입구 없음 | **닫힘** | 탭 넷 전부 `floatingAction` |
| C-4 준비템 탭 `useMemo` 0개 | **닫힘** | `useMemo` 24개 + `items-render-cost.test.ts` |
| B-1 접힌 수정의 멱등키 → 중복 지출 | **닫힘** | `outbox-merge.ts` `foldedUpdateIdempotencyKey` |
| B-2 401 한 번이 큐 전량을 태움 | **닫힘** | `sync-engine.ts:909` 재시도 가능 4xx 분기 |
| B-3 429·408 자동 재시도 상실 | **닫힘** | 같은 자리 |
| **A-F6 준비템 탭 가상화 없음** | **열려 있음** | 이 문서 §4.1 · P3 |

## 부록 B — 이 문서가 세지 못한 것 (정직하게)

1. **실기기 렌더**. 이 저장소의 vitest는 react-native를 렌더하지 못한다(네이티브 바인딩·테스트 렌더러 없음).
   §3-ㄷ의 판정은 전부 **경로 깊이와 컨트롤 위치**를 센 것이지 실제 조작감이 아니다.
2. **실제 배포 env**. 저장소에 `.env`가 없다. §1.2·§6의 "꺼짐" 판정은 전부 `.env.example`의 값과
   `scripts/deploy/oracle-bootstrap.sh`가 만드는 `.env.production`을 근거로 한 것이다. 사장님의 실제
   빌드에 다른 값이 들어가 있다면 그 항목은 그만큼 이미 닫혀 있다.
3. **테스트 그린 여부**. 이 정찰은 읽기 전용이라 `pnpm test`·`pnpm release:gate`를 돌리지 않았다.
   테스트 파일 수만 세었다: **454개**(api 87 · mobile 293 · admin 42 · packages 32).
4. **`/budget`·`/` URL 겹침의 착지 화면**. 소스가 답할 수 없다(L9).
5. **스토어 심사 상태·경쟁 앱**. 웹 검색 금지 범위이고, 이 저장소가 답하지 않는다.
