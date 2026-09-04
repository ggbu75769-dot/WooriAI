# 기능 라운드 1 설계 — 병렬 기능 트랙 6개 (A~F)

작성: 2026-09-04 · 기준 HEAD: `master b30c73f` · 성격: **기능 추가 라운드** (지난 83라운드의 결함 수리·계약 강화와 달리, 사용자에게 새 가치가 *보이는* 변경만 담는다)

> 이 문서는 정찰 산출물이다. 코드 변경 0바이트 — 아래 트랙은 각각 독립 에이전트가 병렬로 집행한다.

---

## 0. 현재 기능 지도 (실측 요약)

4탭 + 보조 화면의 **이미 하는 것**을 먼저 적는다. 이번 라운드 후보가 기존 기능과 겹치지 않음을 여기서 확인했다.

| 화면 | 이미 있는 것 (실측) | 이번 라운드가 얹는 것 |
|---|---|---|
| 홈 `(tabs)/index.tsx` | 아기 카운터·주간 요약·예산 진행/경고(80/100% 문턱)·지난달 비교·마일스톤 카운트다운·준비 넛지·퀵기록 칩·정기지출 리마인더·첫기록 축하 | **월말 예상 지출(페이스 예측)** — 문턱 경고는 있는데 *앞을 보는* 숫자가 없다 (트랙 A) |
| 기록 `(tabs)/records.tsx` | 월 이동·리스트/달력 토글(persist)·검색(근거 부제까지)·카테고리 칩·일별 그룹/소계·롱프레스 액션(수정/또 기록/삭제)·가상화 | **정렬(최신순↔금액 큰 순)** — 정렬은 고정 1종뿐 (트랙 B) |
| 리포트 `(tabs)/reports.tsx` | 월간/분기/연간 카드·**총액** 6개월 추이(REP-128)·기간 카테고리 비중·카테고리→기록 드릴다운·누적·마일스톤 리포트·공유 | **카테고리별 월 추이** — 비중은 한 기간 스냅샷뿐, "기저귀가 달마다 어떻게 변했나"가 없다 (트랙 C) |
| 준비템 `(tabs)/items.tsx` | 시기 밴드 칩·필수도 필터·검색·준비율 마일스톤·100% 축하+다음 시기 칩·구매 링크(고지·스폰서 구분) | **다음 시기 D-day 예고 배너** — 다음 시기 안내는 100% *완료 트리거*뿐, *달력 트리거*가 없다 (트랙 F) |
| 품목 상세 `items/[itemTemplateId].tsx` | 상태 변경(보유/선물/불필요)·지출 연결·구매 링크+고지 | **품목 메모(기기 보관)** — "왜 이걸 보류했는지" 적을 곳이 없다 (트랙 D) |
| 예산 `budget.tsx` | 예산 편집·"지난달 예산 그대로" 이월 제안 칩(라운드 48 B1) | **최근 3개월 실지출 평균 제안 칩** — 지난달 *예산*은 제안하는데 실제 *쓴 돈*은 근거로 안 준다 (트랙 E) |
| 기타 | 지출 입력(프리셋 칩 누적·자동완성·초안), 상세, 가져오기, 내보내기(CSV), 가족, 알림(예산/시기전환/주간/월말/구매확인/기록공백), 설정/잠금/동의 | 이번 라운드 비접촉 |

## 1. Standalone 제약 실측 — 로컬 백엔드가 미러하는 범위

사용자는 서버 없는 standalone APK로 테스트한다. `src/api/client.ts`가 로컬 토큰이면 `src/api/local-backend.ts`(2,336줄)로 라우팅하며, **이번 라운드가 쓰는 읽기 경로는 전부 이미 미러돼 있다**:

- `getHome`(853) · `listExpenses`(868) · `getBudget/upsertBudget`(1084/1094) — 트랙 A·B·E
- `getTrendReport`(1129, REP-128 — `monthlyTotals` N개월) — 트랙 E
- `getCategoryReport(childId, {yearMonth})`(1164 — 임의 월 지원 확인) — 트랙 C
- `listItems`(1308, `stageBand` 선택 인자 ITEM-121) · `getItemDetail`(1372) — 트랙 D·F
- `listChildren`(1953 — `stageMode`·`dueDate`·`birthDate`·`stageLabel` 포함, MOB-118) — 트랙 F

**라운드 공통 규칙 ①: 신규 서버 엔드포인트 0건 · 로컬 백엔드/픽스처 수정 0바이트.** 여섯 트랙 전부 (a) 기존 미러된 읽기 경로의 재조합이거나 (b) 기기 로컬 저장(zustand persist)이다. 그래서 standalone에서 전 기능이 동작하고, `local-backend.ts`·`local-fixtures.ts`·`client.ts`·`packages/contracts`를 두고 트랙끼리 충돌할 일이 원천적으로 없다. 서버가 필요한 후보는 전부 §6으로 이월했다.

## 2. 제약 (설계에 이미 반영)

- **DNC**: 추천 점수에 수수료 금지(DNC-009)·고지 유지(DNC-010)·스폰서 구분(DNC-011) — 이번 라운드는 추천/링크 로직 비접촉. 자동 지출 생성 금지(DNC-012·recurring-template.ts 규율) — 트랙 E는 *제안만* 하고 저장은 사람이 한다. 문구는 해요체(DNC-018). 토큰 잠금(DNC-017) — 신규 색상 리터럴 금지, `theme.ts` 비접촉.
- **준비템 가격 표시는 사용자 결정 대기 잠금** — 어떤 트랙도 품목 가격을 새 자리에 표시하지 않는다(트랙 D 메모·F 배너 포함).
- **외부 계정/키 금지** — 푸시 실발송·카카오 없음. 알림성 기능은 기존 인앱 알림/화면 배너로만.
- **핵심 루프 보호(DNC-002)** — 여섯 트랙 모두 루프의 한 단계를 *강화*한다(A·E: 총액 확인, B: 기록 확인, C: 총액→기록, D·F: 준비템 확인). 루프 밖 신규 화면 0, 신규 라우트 0(→ `route-surface.test.ts` 비접촉).
- **허위 데이터 금지** — 트랙 A의 예측은 "이 속도면 ~정도가 될 것 같아요"로 추정임을 문구에 못 박고, 확정 수치(사용액·초과액)는 기존 카드 소유로 남긴다.

## 3. 트랙 설계

공통 관례(전 트랙): 판정·문구는 **순수 모듈**(react-native 비의존, vitest 단위 테스트)에 두고 화면은 그리기만 한다(이 저장소의 확립된 규율 — vitest가 RN을 렌더할 수 없다). 화면 배선이 계약이면 자기 소유의 `*-wiring.test.ts`(소스 문자열 계약, `amount-presets-wiring.test.ts` 관례)로 고정한다. **다른 트랙의 신규 모듈 import 금지** — 기존 모듈 import는 읽기 전용.

### 트랙 A — 홈: 월말 예상 지출 카드 (예산 페이스)

- **정의**: 이번 달 지출 페이스(사용액 ÷ 경과일 × 월일수)로 월말 예상 지출을 계산해, 예산 대비 "이 속도면 예산 안/약 N원 초과 예상"을 홈에 한 장으로 보여준다.
- **가치**: 지금 경고는 80%/100% *도달 후* 사후 통보다. 예측이 있으면 초과 *전에* 소비를 조절할 수 있다 — 예산 앱 갭 분석(`budget-app-gap-analysis.md`)의 대표 결핍.
- **소유 파일**: `app/(tabs)/index.tsx`(수정) · `src/home/budget-pace.ts`(신규) · `src/home/budget-pace.test.ts`(신규) · `src/home/home-section-priority.ts`+`.test.ts`(수정 — 섹션 등록/순서)
- **데이터**: 기존 `HomeSummary.monthly`(usedAmountKrw·amountKrw·yearMonth) + 서울 오늘 날짜(`home/day-math.ts`·`notifications/iso-week.ts` 재사용, 읽기 전용). **신규 쿼리 0.**
- **표시 규칙(모듈이 판정)**: 예산이 있는 달만 · 경과 3일 미만이면 숨김(표본 부족) · 이미 100% 초과면 숨김(기존 초과 배너가 확정 사실을 말하는 중 — 문구 중복 금지) · 반올림은 천원 단위.
- **무는 기존 계약**: `home-section-priority`(섹션 순서 — 핀 이관 A 소유) · `budget-warning.ts`와의 문구 경계(초과 *사실*은 저쪽, 초과 *예상*은 이쪽 — budget-warning은 비접촉) · `refresh-wiring-contract`가 index.tsx에 요구하는 문자열(RefreshControl 등) 유지.
- **테스트**: budget-pace.test.ts(경계: 월초/예산없음/초과/미래월·나눗셈 정수 규율·문구·a11y 라벨), home-section-priority.test.ts 갱신.
- **하지 않는 것**: 카테고리별 예측·지출 억제 권고 문구("아껴 쓰세요" 금지 — 관측만).
- **규모**: 파일 5(신규 2) · 난이도 하~중.

### 트랙 B — 기록: 정렬 옵션 (최신순 ↔ 금액 큰 순)

- **정의**: 기록 탭 리스트에 정렬 토글을 더한다. 금액 큰 순은 일별 그룹 헤더 없이 평평한 목록으로 그리고, 선택은 세션 간 기억한다(기존 리스트/달력 persist와 같은 저장소).
- **가치**: "이번 달 뭐가 제일 컸지"가 지금은 스크롤+암산이다. 카테고리 칩·검색과 조합하면 "기저귀 중 최대 지출"까지 두 탭.
- **소유 파일**: `app/(tabs)/records.tsx`(수정) · `src/expenses/records-sort.ts`(신규)+`.test.ts` · `src/stores/records-view.store.ts`+`.test.ts`(수정 — 정렬 상태 추가) · `src/expenses/records-list-view.ts`+`.test.ts`(수정 — 평평 모드 목록 조립)
- **데이터**: 이미 받아 둔 월 지출 배열의 클라이언트 정렬. **신규 쿼리 0 · 로컬 미러 불필요.**
- **판정 규칙(모듈)**: 정렬은 필터(검색·칩) *결과 위에* 적용 · 동액이면 최신 우선(안정 정렬) · 달력 보기에서는 토글 숨김 · 금액순에서 일별 소계 숨김(합계가 아닌 정렬에 소계를 붙이면 거짓 신호).
- **무는 기존 계약**: `records-view.store.test.ts`(persist sanitize — 핀 이관 B 소유) · `refresh-wiring-contract.test.ts`가 import하는 `buildRecordsEmptyMonthState` **시그니처 불변** · `records-date-groups.ts`·`record-row-actions.ts`·검색 판정 모듈은 **비접촉**(정렬은 그 결과의 순서만 바꾼다).
- **테스트**: records-sort.test.ts(안정성·필터 조합·persist sanitize·달력 모드 게이트·토글 a11y 라벨), records-list-view.test.ts 갱신(평평 모드).
- **하지 않는 것**: 다중 월 정렬/검색(기록 탭은 월 단위 화면이라는 기존 결정 유지 — category-drilldown 헤더의 착지 월 규칙 참고).
- **규모**: 파일 7(신규 2) · 난이도 중 (records.tsx가 1,400줄+라 배선 위치 선정이 일).

### 트랙 C — 리포트: 카테고리별 월 추이

- **정의**: 카테고리 비중 카드에서 카테고리 하나를 고르면 그 카테고리의 최근 6개월 월별 지출 미니 차트(막대)를 펼쳐 보여준다.
- **가치**: 총액 추이는 있지만 "분유값이 오르는 중인지"는 답할 수 없다. 시기 전환기(이유식 시작 등) 부모의 실제 질문.
- **소유 파일**: `app/(tabs)/reports.tsx`(수정) · `src/reports/category-trend.ts`(신규)+`.test.ts`
- **데이터**: 기존 `getCategoryReport(childId, {yearMonth})`를 최근 6개월에 대해 `useQueries`로 — **탭했을 때만** 켠다(리포트 진입 비용 0 유지, REP-128이 이 파일에서 없앤 워터폴을 재도입하지 않도록 병렬 발사). queryKey는 기존 `["report","category",childId,{yearMonth}]` 꼴 그대로 → 월간 탭 캐시와 공유. **로컬 미러: 이미 지원**(local-backend `getCategoryReport`가 임의 yearMonth를 받는다 — §1) · **신규 엔드포인트 0.**
- **판정 규칙(모듈)**: 값 정규화는 `lineChartMath.ts`/`line-chart-normalization` 관례 재사용(읽기 전용) · 기록 0원 달은 0으로 그리되 "기록 없음"과 구분 문구 · 카테고리 이름은 `buildCategoryNameLookup` 재사용.
- **무는 기존 계약**: `category-share.ts`·`category-drilldown.ts` **비접촉**(비중·드릴다운 판정은 그대로 — 추이는 별도 모듈) · `loading-skeleton-contract`가 reports.tsx에 요구하는 `<SkeletonCard />` 문자열 유지 · 신규 쿼리의 로딩 표현은 카드 내부 스켈레톤(계약 파일 수정 불필요 — contains 계약).
- **테스트**: category-trend.test.ts(6개월 창 산출·부분 실패 시 표시 규칙·0원/빈 데이터·라벨·a11y 문장).
- **하지 않는 것**: 추이 점→기록 드릴다운(기존 드릴다운은 기간 카드 소유 — 후속), 카테고리 다중 비교 차트.
- **규모**: 파일 3(신규 2) · 난이도 중.

> **각주(실동작 괴리 — 기능 라운드 1 리뷰 M-5, 두 시점).** 위 데이터 절의 "`useQueries`로 · 기존 `["report","category",…]` 키"는 구현되지 않았다: 리포트 화면의 조회 표면이 스윕 셋(GAP-067 · 첫 페인트 대장 · shared-cache-policy)으로 잠겨 있어, 실제 구현은 자기 훅(src/reports/use-category-trend.ts)의 직접 읽기다 — 여섯 달 = 직접 읽기 5 + 보고 있는 달의 기존 조회 1, 신선도는 그 조회의 dataUpdatedAt에 묶는다. 첫 구현은 그 신호의 초기값 0을 정착한 신호처럼 다뤄 **차트를 연 채 월을 옮기면 과거 다섯 달을 두 번(요청 10) 읽었다**. 수리 후: 발사 판정은 순수 모듈(category-trend.ts의 planCategoryTrendMonthReads)이 지고, 신호 0에는 메모만 비우고 발사를 유예해 응답 도착 후 한 번만 읽는다(요청 5 보장 — category-trend.test.ts의 시퀀스 계약).

### 트랙 D — 품목 상세: 품목 메모 (기기 보관)

- **정의**: 준비템 상세 화면에 자유 메모 입력(예: "산후조리원에서 준다고 함", "언니네서 물려받기로")을 더한다. 기기 로컬 저장(zustand persist).
- **가치**: 보유/불필요/보류 *상태*만으로는 "왜"가 남지 않는다. 준비템 목록이 진짜 체크리스트가 되려면 사유 한 줄이 필요하다.
- **소유 파일**: `app/items/[itemTemplateId].tsx`(수정) · `src/items/item-memo.store.ts`(신규)+`.test.ts` · `src/items/item-memo.ts`(신규 — 글자 상한·고지 문구·라벨 순수 모듈)+`.test.ts`
- **데이터/미러**: **네트워크 0** — `stores/persist-storage.ts` 재사용(읽기 전용 import). 서버 세션이든 standalone이든 동일 동작. 서버 스키마(`child_item_statuses`)에 memo 칼럼을 더하는 길은 계약·마이그레이션·로컬 미러 3면 수술이라 이월(§6) — 대신 화면에 **"이 메모는 이 기기에만 저장돼요"** 고지를 붙인다(가족 공유 오해 방지, DNC-018 해요체).
- **판정 규칙(모듈)**: 상한 200자(`text-limits.ts` 관례 참고, import는 하지 않고 자체 상수 — 그 파일은 지출 입력 소유) · 키는 `itemTemplateId` 단위(아이 전환과 무관한 물건 메모) · 저장은 blur/뒤로가기 시 자동(버튼 없음 → 네트워크 뮤테이션 아님 → `mutation-press-guard` 모집단 밖).
- **무는 기존 계약**: `loading-skeleton-contract`가 이 파일에 요구하는 `<SkeletonCard />`·`<SkeletonRow />` 유지 · `items-commerce-flow.test.ts`가 이 화면 소스를 읽는다 — 구매 링크/고지 블록 비접촉이면 그대로 통과, 어긋나면 핀 이관은 D 소유 · persist 업그레이드 관례(`persist-upgrade.test.ts`)는 **읽기만**(새 스토어는 자기 테스트에서 sanitize 검증).
- **테스트**: item-memo.test.ts(상한·트림·빈 메모 삭제·고지 문구·a11y 라벨), item-memo.store.test.ts(persist sanitize·손상 blob 폴백).
- **하지 않는 것**: 서버 동기화·가족 공유 메모·품목 목록에서의 메모 미리보기(목록 파일은 F 소유).
- **규모**: 파일 5(신규 4) · 난이도 하~중.

### 트랙 E — 예산: 최근 3개월 실지출 평균 제안 칩

- **정의**: 예산 편집 화면의 제안 칩을 한 장 더한다 — "최근 3개월 평균 N원을 썼어요 · 이 값으로 시작". 기존 "지난달 예산 그대로" 칩(라운드 48 B1) 옆에 선다.
- **가치**: 예산을 처음 세우는(또는 매달 다시 세우는) 부모에게 근거 있는 시작값을 준다. 지난달 *예산*이 없던 사용자(예산 기능을 늦게 발견)에게는 지금 제안이 아예 없다 — 이 칩은 지출 기록만 있으면 선다.
- **소유 파일**: `app/budget.tsx`(수정) · `src/home/budget-suggestion.ts`(신규)+`.test.ts` · `src/home/budget-edit.ts`+`.test.ts`(수정 — 칩 판정 나란히 서는 규칙)
- **데이터**: 기존 `getTrendReport(childId, 지난달, 3)` 1회(`monthlyTotals` 평균, 천원 반올림). 예산이 없다고 확인된 뒤에만 켠다(기존 이월 칩과 같은 defer 판단). **로컬 미러: 이미 지원**(REP-128) · **신규 엔드포인트 0.**
- **판정 규칙(모듈)**: 기록이 있는 달만 분모로(0원 달 3개면 제안 안 함 — 지어낸 예산 금지) · 이월 칩과 값이 같으면 하나만 · **자동 저장 절대 금지**(사용자가 칩→[저장] — 이 화면의 확립된 규율을 인용해 테스트로 고정).
- **무는 기존 계약**: budget-edit 칩 판정 테스트(핀 이관 E 소유) · `loading-skeleton-contract`의 budget.tsx `<SkeletonCard />` 유지 · A 트랙과 같은 `src/home/` 디렉토리지만 **파일 단위 완전 분리**(A: budget-pace·home-section-priority / E: budget-suggestion·budget-edit — budget-progress·budget-warning은 둘 다 비접촉).
- **테스트**: budget-suggestion.test.ts(평균·부분 데이터·0원 달 제외·이월 칩 중복 판정·문구·a11y).
- **하지 않는 것**: 카테고리별 예산·예산 자동 갱신·홈 화면 노출(홈은 A 소유).
- **규모**: 파일 5(신규 2) · 난이도 하.

### 트랙 F — 준비템 탭: 다음 시기 D-day 예고 배너

- **정의**: 다음 시기 밴드 시작이 14일 이내로 다가오면 준비템 탭 상단에 "생후 7~9개월 시기가 D-N일 뒤에 시작돼요 · 미리 볼까요?" 배너를 세우고, 탭하면 기존 시기 칩 선택으로 그 밴드를 미리 연다(새 화면 없음).
- **가치**: 지금 "다음 시기" 안내는 준비율 100% *완료 트리거*뿐이다(UX-E 축하 칩). 준비가 덜 된 사용자일수록 시기 전환에 미리 대비할 안내가 필요한데, *달력 트리거*가 없다. 시기 전환 *후* 알림(stage_transition)보다 한 발 앞선다.
- **소유 파일**: `app/(tabs)/items.tsx`(수정) · `src/items/next-stage-preview.ts`(신규)+`.test.ts`
- **데이터**: 기존 children 캐시(`stageMode`·`dueDate`·`birthDate` — MOB-118 DTO 확인) + `bandDefinitions`(`stage-bands.ts` 읽기 전용)로 다음 밴드 시작일 계산. 임신 중이면 다음 경계는 출산 예정일. **신규 쿼리 0 · 로컬 미러: listChildren 기존 지원.**
- **판정 규칙(모듈)**: `stageMode === "manual"` 또는 날짜 없음 → 숨김(지어내지 않는다) · 마지막 밴드 → 숨김 · 이미 다음 밴드를 보고 있는 중 → 숨김 · **100% 축하 배너가 서 있으면 숨김**(같은 행선지를 두 배너가 말하지 않는다 — 판정은 이 모듈이 소유) · 날짜 산술은 iso-week.ts 규율(라이브러리 없이 `Date.UTC`, 서울 달력).
- **무는 기존 계약**: `prep-milestones.ts`·`stage-bands.ts`·`pre-birth-filter.ts` **비접촉**(전부 읽기 전용 — 축하 칩의 `nextStageBandLabel`도 그대로 두고, 이 모듈은 자기 판정만 새로 만든다) · `refresh-wiring-contract`의 items.tsx 문자열 유지 · 어긋나는 items 화면 스윕이 있으면 핀 이관 F 소유.
- **테스트**: next-stage-preview.test.ts(D-day 경계 0/1/14/15·임신→출산 경계·manual 숨김·마지막 밴드·축하 배너 우선·문구/a11y — 구매 재촉 금지 규율은 prep-milestones 머리말 인용).
- **하지 않는 것**: 다음 밴드 미준비 개수 집계(추가 쿼리 필요 — 후속) · 인앱 알림 발행(generators.ts는 이번 라운드 전 트랙 비접촉 — §6 "D-7 예고 알림" 이월과 짝).
- **규모**: 파일 3(신규 2) · 난이도 중 (items.tsx 1,000줄+ 배선).

> **각주(기능 라운드 1 리뷰 H-1·M-2 — 실동작, 두 시점).** ① 위 판정 규칙의 "이미 다음 밴드를 보고 있는 중 → 숨김"은 **임신 갈래와 양립하지 않았다**: 임신 스테이지 셋이 전부 "0-6개월" 밴드라 기본 칩이 곧 목적지 밴드이고, 첫 구현이 그 억제를 임신 갈래에도 적용해 "임신 중이면 다음 경계는 출산 예정일"이라는 본문 약속이 **기본 상태에서 한 번도 성립하지 않았다**. 수리 후 실동작: 임신 갈래는 억제의 예외다 — 배너는 기본 상태에서도 서고(제목 "출산 예정일까지 D-N"), 이미 0-6개월 칩을 보는 중이면 D-day 제목만 남기고 "미리 볼까요" 버튼을 접는다(이미 선택된 칩을 다시 고르는 버튼은 거짓 어포던스, D-day는 칩과 무관한 달력 사실). ② 본문 정의의 문구 예시("…D-N일 뒤에 시작돼요 · 미리 볼까요?")도 실동작과 다르다: 'D-N'과 '일 뒤'의 이중 표기를 걷어내고 milestone-countdown의 카운트다운 제목 관례("…까지 D-N" + spokenTitle "…N일 남았어요")를 따른다. 판정·문구의 단일 소스는 src/items/next-stage-preview.ts.

## 4. 공유 파일 충돌 지도

여러 트랙이 원할 법한 파일의 배정. **여기 없는 파일을 두 트랙이 고치게 되면 설계 위반 — 멈추고 문서화한다.**

| 파일 | 배정 | 비고 |
|---|---|---|
| `src/api/local-backend.ts` · `local-fixtures.ts` · `client.ts` · `packages/contracts/**` | **0트랙 (비접촉)** | 라운드 규칙 ① — 신규 엔드포인트 없는 설계로 원천 회피 |
| `src/a11y-contract.test.ts` (8,218줄) | **0트랙** | 관례상 값·문구 계약은 각 트랙 모듈 테스트가 진다(라운드 66~69 형식). 신규 문장의 *낭독 배선 스윕* 추가는 후속 라운드 몫 |
| `src/ui.tsx` · `src/ui/**` · `theme.ts` · `design-system/**` | **0트랙** | 기존 컴포넌트·토큰만 사용(DNC-017). 새 공용 컴포넌트가 필요해 보이면 트랙 안 지역 컴포넌트로 |
| `src/notifications/generators.ts` | **0트랙** | D-7 예고 *알림*은 F의 배너와 판정 로직이 겹쳐 후속으로 이월(§6) |
| `app/(tabs)/index.tsx` + `src/home/{budget-pace, home-section-priority}` | **A** | |
| `app/(tabs)/records.tsx` + `src/expenses/{records-sort, records-list-view}` + `src/stores/records-view.store` | **B** | `buildRecordsEmptyMonthState` 시그니처 불변(refresh 계약이 import) |
| `app/(tabs)/reports.tsx` + `src/reports/category-trend` | **C** | category-share·drilldown·trend-* 기존 모듈 비접촉 |
| `app/items/[itemTemplateId].tsx` + `src/items/item-memo*` | **D** | |
| `app/budget.tsx` + `src/home/{budget-suggestion, budget-edit}` | **E** | A와 디렉토리 공유·파일 분리. budget-progress/warning은 A·E 모두 비접촉 |
| `app/(tabs)/items.tsx` + `src/items/next-stage-preview` | **F** | stage-bands·prep-milestones 읽기 전용 |
| 스윕 계열(`mutation-press-guard`·`korean-particle-guard`·`keyboard-tap-guard`·`loading-skeleton-contract`·`refresh-wiring-contract`·`route-surface`·`screen-phase` 등) | **0트랙 (파일 비접촉)** | contains형 소스 계약이라 *추가*는 깨지 않는다. 각 트랙의 새 바이트가 스윕 규율을 **지켜서** 초록을 유지하는 책임은 각 트랙에 있다(스윕을 고쳐서 통과하는 것은 금지). 신규 라우트 0·신규 네트워크 뮤테이션 0이므로 모집단형 스윕도 움직이지 않는다 |

**트랙 간 의존 0 확인**: 어떤 트랙도 다른 트랙의 신규 모듈을 import하지 않고, 수정 파일 교집합이 공집합이며, 각 트랙의 테스트는 자기 소유 파일만 읽는다(기존 모듈 import는 전부 읽기 전용). → 어느 순서로 머지돼도 각각 `pnpm --filter mobile test` 그린.

## 5. 검증 계획

- 트랙별: 자기 신규/갱신 테스트 + `pnpm --filter mobile test` 전체 그린(스윕 포함).
- 라운드 종료: `pnpm release:gate`(로컬 검증이 기준 — launch-72h-plan). api·admin은 이번 라운드 0바이트라 기존 그린 유지 확인만.
- standalone 확인: `local-backend.test.ts` 그린 + (수동) 로컬 세션에서 6기능 육안 확인 — 전 트랙이 기존 미러/기기 저장만 쓰므로 별도 미러 테스트는 불필요.

## 6. 후속 라운드로 미룬 후보 (이월 사유 명기)

| 후보 | 사유 |
|---|---|
| 다크 모드 | DNC-017 토큰 잠금 + `theme.ts`·전 화면 파일을 무는 전면 충돌 — 단독 라운드감. 현재 토큰은 라이트 단일 팔레트(실측) |
| 커스텀 품목 추가 | `item_templates`는 운영 시드 소유 — 서버 스키마+계약+로컬 미러 3면 수술. 단독 설계 필요 |
| 품목 메모 서버 동기화/가족 공유 | D의 후속 — `child_item_statuses` 확장 + 로컬 미러 필요 |
| 시기 전환 D-7 예고 **알림**(generators.ts) | F의 배너와 판정 공유 → 같은 라운드에 두 트랙으로 쪼개면 의존 발생. F 머지 후 그 모듈을 재사용하는 1트랙 |
| 카테고리별 예산 | budgets 스키마 확장(서버+미러) |
| 카테고리 추이 점→기록 드릴다운 | C 후속 — 기존 드릴다운 파라미터 규약 확장 필요 |
| 다음 밴드 미준비 개수(F 배너에) | 추가 쿼리 설계 필요 |
| 데이터 JSON 백업/복원 | 복원이 진짜 가치인데 쓰기 경로 전면(멱등·충돌) 설계 필요. CSV 내보내기는 기존재 |
| 지출 사진 첨부 | DNC-016 인접(영수증 AI 오해 소지) + 저장 용량 설계 |
| 선물 통계(아낀 금액) | 품목 가격 표시가 사용자 결정 잠금 — 금액 없는 개수 통계는 가치 부족 |
| 준비템 목록 메모 미리보기 | items.tsx가 F 소유 — D 머지 후 |
| 서버 푸시 실발송·카카오 공유 | 외부 계정/키 금지 |

## 7. 트랙 요약표

| 트랙 | 기능 | 루프 단계 | 소유 파일 | 신규 쿼리 | 로컬 미러 | 난이도 |
|---|---|---|---|---|---|---|
| A | 홈 월말 예상 지출 카드 | 총액 확인 | 5 (신규 2) | 0 | 불필요(기존 home) | 하~중 |
| B | 기록 정렬(금액순) | 기록 확인 | 7 (신규 2) | 0 | 불필요(클라 정렬) | 중 |
| C | 카테고리별 월 추이 | 총액→기록 | 3 (신규 2) | 6 (온디맨드·기존 키) | 기존 지원 | 중 |
| D | 품목 메모(기기 보관) | 준비템 확인 | 5 (신규 4) | 0 | 불필요(기기 저장) | 하~중 |
| E | 예산 3개월 평균 제안 | 총액 확인 | 5 (신규 2) | 1 (조건부) | 기존 지원(trend) | 하 |
| F | 다음 시기 D-day 배너 | 준비템 확인 | 3 (신규 2) | 0 | 기존 지원(children) | 중 |
