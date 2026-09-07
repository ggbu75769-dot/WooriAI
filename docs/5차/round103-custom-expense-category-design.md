# 라운드 103 설계 — 커스텀 지출 카테고리 (사용자가 분류를 직접 추가)

작성: 2026-09-07 · 기준 HEAD: `master 418a8d2` · 성격: **단독 설계 라운드** (코드 변경 0바이트 — 이 문서가 산출물이다)

> 이월 근거: 라운드 103 정찰 S1의 F11(**[P2] · 난도 상 · 대(大) · PM 판단 선행** — "집계·리포트·CSV·가져오기·자동 분류 전반 파급, DNC-007 categories 의미 보존 검토 필요"). 저장소의 앞선 기록 둘이 같은 항목을 조건부로 미뤄 두었다: `docs/5차/round102-category-budget-design.md` §7 이월표("**커스텀 카테고리** | DNC-001/016 인접 + 분류 체계는 운영 시드 소유(§6.5 전제)")와 같은 문서 §6.5의 마지막 줄 — *"커스텀 카테고리 부재 전제: 사용자는 분류를 만들 수 없다 … **이 전제가 깨지는 라운드는 이 절을 재론해야 한다**."* 이 문서가 그 재론이다(§6.3). 계약 확정은 §9이고, 다음 라운드의 세 트랙(T1 api / T2 contracts+client+local-backend / T3 UI)은 **이 문서만 보고** 집행한다.

핵심 루프와의 관계(DNC-002): 커스텀 분류는 루프의 **"지출 기록 → 총액 확인"** 단계를 사용자의 말로 정확하게 만든다 — 시드 12분류에 없는 지출(산후도우미, 조리원 추가결제, 돌잔치, 친정 지원)은 오늘 전부 "기타"로 떨어지고, 리포트 도넛은 그 "기타"를 두 번째로 큰 조각으로 그리면서 **무엇인지는 끝내 말하지 못한다**. 커머스 표면(준비템·구매 링크·추천 점수)은 **0접촉**이다(§6.1).

---

## 0. 현재 구조 실측 (설계가 딛는 사실들)

| 면 | 실측 | 근거 파일 |
|---|---|---|
| 분류 표 | `categories(id, parent_category_id(죽은 컬럼), code varchar(50) **UNIQUE**, name varchar(50), icon_name varchar(50) NULL, display_order, is_system bool **DEFAULT true**, active bool, selectable bool)` — **소유자 컬럼 없음 = 전 가구 공용 운영 시드** | `prisma/schema.prisma:262~291`, `migrations/000001*/migration.sql:151~162` |
| **지출의 분류 참조는 SQL FK다** | `expenses.category_id uuid **NOT NULL** REFERENCES categories(id)` — 이 설계 전체를 결정하는 한 줄이다. `categories`에 없는 id는 **그 칸에 들어갈 수 없고**, 그 칸은 nullable도 아니다 | `migrations/000001*/migration.sql:201`, `schema.prisma:360` |
| 같은 표를 가리키는 FK 셋 더 | `item_templates.category_id`(NULL 허용) · `import_rows.category_id`(NULL 허용) · `category_budgets.category_id`(라운드 102, NOT NULL) | `migration.sql:168,317`, `migrations/000023*/migration.sql:11` |
| 시드 21행 | 정식 12(`categorySeeds`, **랜덤 UUID**) + 모바일 퀵타일 별칭 8(`mobileCategoryAliasSeeds`, 고정 UUID·`mobile_*` code·`selectable:false`) + 가져오기 스텁 1(`import_stub_default`). **전 행이 `is_system=true`** — 시드도 어드민도 그 칸을 쓰지 않는다 | `prisma/seed-data.ts:78,1183,1201`, `prisma/seed.ts:23~60` |
| 노출 두 축 (라운드 26·28) | `selectable`(고르라고 내밀 행인가, CAT-124) · `active`(살아 있는 행인가). `GET /categories`는 기본 `active && selectable`, **`?includeAll=1`은 `active`와도 무관하게 전량**(R28-F3) — 운영자가 숨긴 분류로 기록된 **과거 지출의 이름 해석은 유지**된다 | `finance/categories.controller.ts:25~48`, `migrations/000018_categories_selectable/migration.sql` |
| **000018이 남긴 두 문장** | ① *"`is_system`을 재활용하지 않는 이유는 그 컬럼이 **'시스템 시드 vs 사용자 정의'라는 다른 뜻을 이미 갖고 있어서**다"* ② *"DNC-007 준수: **컬럼 추가만** 한다 — 행 삭제 없음, 기존 id 불변, active 불변"* | `migrations/000018*/migration.sql:12~24` |
| 어드민 | `AdminCategoriesService`에 **create도 delete도 없다**(*"행을 지우거나 id/code를 바꾸는 순간 과거 지출의 카테고리 해석이 깨진다"*). 편집 축은 name/displayOrder/active/selectable 넷. 목록은 **필터 없이 전량** | `admin/admin-categories.service.ts:1~90` |
| `prisma.category` 읽는 자리 **전수 10** | `finance/categories.controller.ts:48` · `admin/admin-categories.service.ts:59,69,78` · `finance/milestone-report.service.ts:76`(id 집합 조회) · `onboarding/expenses-store.service.ts:451`(`requireExistingCategory`) · `onboarding/import-pipeline.service.ts:758`(확정 전 실재), `:928`(code→id) · `onboarding/onboarding-core.service.ts:839`(`requireBudgetableCategories`) · `prisma/seed.ts`(code 스코프 upsert/조회). **워커 0건 · 링크 헬스 0건 · CSV 벌크 0건** | 위 파일들 |
| 집계 여섯 | 홈·월간·추이·연간·누적·카테고리 **전부** `expense.groupBy(by:["categoryId"])` + `deletedAt:null` + `expenseType:"expense"` 한 술어(DNC-015)를 되풀이하고, **원 id만** 돌려준다. 이름 해석은 클라이언트 몫 | `reporting-store.service.ts:303~322`, `known-limitations.md` S-4 |
| 마일스톤 리포트 | 100일/첫돌 리포트만 **서버가 이름을 해석**한다 — `groupBy` 상위 5의 id 집합으로 `category.findMany` | `finance/milestone-report.service.ts:60~95` |
| 이름 해석(모바일) | `buildCategoryNameLookup(["categories"] 캐시)` → 없으면 `categoryNameFor`(8타일+데모 픽스처) → 없으면 **"기타"**. 도넛 범례·인사이트 문장·공유 문구·CSV 열이 전부 이 하나를 지난다 | `src/categories.ts:122~131` |
| `["categories"]` 캐시 규약 | **전역 단일 키**. 소비처 10(기록·리포트·수정·CSV·예산·가져오기·동기화·준비템·홈 예산·입력 맥락). 채우는 자리는 반드시 `includeAll: true`, 구독만 하면 `enabled:false + queryFn: skipToken` — 전역 스윕이 전수 검사 | `src/categories-cache-contract.test.ts` |
| 고를 목록 좁히기 | `selectableCategories(list, currentId)` 규칙 (a)~(d): `selectable===false`·`active===false` 제외 · `import_` 접두 제외 · **동명 그룹 하나로 접기**(현재값 > 정식 > `mobile_` 별칭 순으로 생존) · **현재값은 언제나 남긴다** | `src/categories.ts:290~355` |
| 기록 탭 칩 가족 규칙 | `buildRecordsCategoryChips`가 정식 칩 하나에 `matchIds`(자기 id + 동명 id + 같은 `code`의 퀵타일 별칭 id)를 달아 가족을 흡수한다. 목록이 비면 정적 8타일로 폴백 | `src/expenses/records-list-view.ts:83~147` |
| 입력 8타일 | `app/expenses/new.tsx`는 **정적 `categoryCatalog` 8개만** 그린다(EXP-001 픽셀락 격자). 서버 목록을 칩으로 그리는 곳은 **지출 수정 화면**(`app/expenses/[expenseId].tsx:509`)이다 | `app/expenses/new.tsx:2072,2206` |
| 색·아이콘 | `theme.colors.categoryColors: Record<CategoryCode, string>` — 소비처는 **둘뿐**이고(8타일 격자 · 준비템 타일 비주얼) 둘 다 정적 카탈로그 code를 키로 쓴다. 서버 목록에서 온 분류가 색을 받는 자리는 **0건** | `src/theme.ts:132~145`, `src/preparation/item-visuals.ts:201` |
| 자동 분류 추천 | 1순위 과거 기록에서 고르되 `if (!catalogIds.has(row.categoryId)) continue` — **8타일 id만** 통과한다. 2순위 키워드 사전도 8타일로만 해석 | `src/expenses/category-suggestion.ts:160,196` |
| 가져오기 자동 매핑 | 파서의 `CATEGORY_KEYWORDS`는 **정식 code 고정 목록**이고, 파이프라인이 그 code로 `category.findMany({code:{in:…}})`를 돈다. 미매칭이면 스텁 id | `imports/import-parser.ts:578`, `import-pipeline.service.ts:928,962` |
| CSV | 내보내기 헤더 `날짜,구분,**카테고리**,항목,…`이고 이름은 주입된 `buildCategoryNameLookup`이 만든다. **재가져오기 왕복에서는 카테고리 열이 버려진다**(이미 알려진 손실, 상태 변화 0) | `src/export/expense-csv.ts:69,123`, `known-limitations.md` S-4 |
| FK 위반의 번역 범위 | `createExpenseRowOrTranslateFk`는 **`linked_product_link` 위반 하나만** 400으로 번역한다. *"다른 FK 위반은 그대로 다시 던진다"* → 500. 그리고 모바일 아웃박스는 5xx를 일시 실패로 보고 **무한 재시도(poison pill)** 한다 | `expenses-store.service.ts:143~195` |
| 파기(retention) | 아이 파기는 `purgeChildRows`(지출 → … → `child.deleteMany`), 고아 가구는 그 뒤 `household.deleteMany`. 사용자 하드 삭제는 **NOT NULL user FK마다 NOT EXISTS 한 줄**(두 자리에 같은 목록) | `worker/jobs/data-retention-purge.job.ts:977~1056,1150~1168,1215~1243` |
| DNC-007 가드의 모집단 | `db-contract.test.ts`의 `tableNames`에 **`categories`가 실재한다**(조항 본문에는 없다). 단언은 `@@map("<표>")`의 존재 — 즉 **표를 지우거나 이름을 바꾸면** 빨개진다 | `apps/api/test/db-contract.test.ts:37~57`, `packages/test-utils/src/dnc-guard-ledger.ts:324` |
| 라우트 대장 | `app/**` 라우트 파일 전수 열거 + 손 대장(`["settings/amount-presets.tsx", "/settings/amount-presets"]` 형태). 새 라우트는 **기본값이 빨강** | `src/route-surface.test.ts:160` |
| 보기 전용 문구 대장 | `VIEW_ONLY_HEADLINES`가 "어느 화면이 어느 문장을 쓰는가"의 단일 소스이고 *"게이트를 지나는 새 화면이 생기면 이 표에 자리가 없어 빨개진다"* | `src/family/record-permissions.ts:165~189` |

---

## 1. 결정 D1 — 데이터 모델: **`categories`에 소유자 컬럼 가산** (별도 테이블 기각)

### 채택안

`categories`에 nullable `household_id` 한 칸을 더한다. **`NULL` = 오늘의 21행(운영 시드) · `NOT NULL` = 그 가구가 만든 분류.** 새 표 0장.

```sql
-- apps/api/prisma/migrations/000024_categories_household_owner/migration.sql (초안)
-- 라운드 103 T1: 커스텀 지출 카테고리 — docs/5차/round103-custom-expense-category-design.md §1.
-- 별도 표를 만들지 않는 이유는 §1.1(대안 A) — expenses.category_id가 NOT NULL FK라
-- categories 밖의 id는 지출에 저장될 수 없다. 000018과 같은 additive 관례:
-- 컬럼 추가만 · 행 삭제 없음 · 기존 id 불변 · active/selectable 불변.
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id) ON DELETE CASCADE;

-- 가구 목록 조회는 언제나 (household_id) 단일 술어다. 시드 21행은 NULL이라 색인에 들지 않는다.
CREATE INDEX IF NOT EXISTS idx_categories_household
  ON categories(household_id) WHERE household_id IS NOT NULL;

-- 이름 중복은 서비스가 먼저 400으로 막지만(§1.4), 마지막 방어선은 DB가 진다.
-- 정규화(trim + 소문자)를 색인 식에 그대로 적는다 — 서비스와 같은 규칙.
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_household_name
  ON categories(household_id, lower(btrim(name))) WHERE household_id IS NOT NULL;

-- is_system은 000018이 "시스템 시드 vs 사용자 정의"라고 이미 뜻을 적어 둔 칸이다.
-- 그 뜻과 소유자 칸이 절대 갈리지 않도록 DB가 등호를 진다 — 클라이언트가 받는 유일한
-- 표식이 is_system이기 때문이다(§2.2: 응답에 household_id는 커스텀 행에만 실린다).
-- 오늘 21행 전부 (household_id IS NULL, is_system = true)라 검증은 즉시 통과한다.
ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS chk_categories_owner_is_system,
  ADD CONSTRAINT chk_categories_owner_is_system CHECK ((household_id IS NULL) = is_system);
```

```prisma
model Category {
  // …기존 컬럼 무변경…
  /// 라운드 103: 이 분류를 만든 가구. NULL이면 운영 시드(오늘의 21행)다.
  /// 이 칸이 값인 행은 `is_system = false`이고(DB CHECK가 등호를 진다),
  /// `GET /categories`는 호출자가 속한 가구의 행만 시드에 합류시킨다(§2.2).
  householdId String? @map("household_id") @db.Uuid

  @@index([active, displayOrder], map: "idx_categories_active_order")
  // SQL 전용: idx_categories_household (household_id) WHERE household_id IS NOT NULL
  // SQL 전용: uq_categories_household_name (household_id, lower(btrim(name))) WHERE household_id IS NOT NULL
  @@map("categories")
}
```

### 1.1 대안과 기각 사유

| 대안 | 기각 사유 |
|---|---|
| **A. 별도 표 `custom_expense_categories` + `expenses.custom_category_id` 가산** (라운드 100·102의 패턴) | **구조적으로 불가능에 가깝다.** `expenses.category_id`는 `NOT NULL REFERENCES categories(id)`라(§0) 커스텀 id를 그 칸에 넣을 수 없고, 그 칸을 비울 수도 없다. 그래서 별도 표는 **지출에 두 번째 분류 축**을 강요한다. 그 순간 파급이 반대로 뒤집힌다: ① 집계 **여섯 전부**가 `groupBy(["categoryId"])` 하나에서 `by:["categoryId","customCategoryId"]` + 합성 키로 바뀐다 ② 계약 `categoryBreakdownEntrySchema.categoryId: uuidSchema`가 깨진다(월간 `categoryTop`·카테고리 리포트가 같은 계약을 공유한다 — CON-121) ③ 칩의 `matchIds: string[]`·드릴다운 파라미터 `categoryId`·CSV 이름 해석·`category_budgets.category_id`(FK)가 전부 두 벌이 된다 ④ 라운드 102가 세운 카테고리 예산은 커스텀에 **아예 설 수 없다**(그 표의 FK도 `categories`를 향한다). **라운드 100이 `custom_items`로 별도 표를 고를 수 있었던 것은 `child_item_statuses`의 상태를 행에 내장해 조인을 없앨 수 있었기 때문이고, 여기는 없앨 조인이 아니라 NOT NULL FK다.** |
| **A′. 별도 표 + `expenses` FK 해제(또는 조건부 FK/트리거)** | `expenses`는 DNC-007이 이름으로 잠근 도메인이고, FK 제거는 파괴적 변경이다. 게다가 그 FK는 오늘 **실제로 일한다** — `requireExistingCategory`가 뚫린 경합(Read Committed)에서 마지막 방어선이 그것이다(`import-pipeline.service.ts:759~778`의 주석이 그 시나리오를 값으로 적어 두었다). 변경 요청이 먼저다. |
| **B. 별도 표 + 그 표의 PK가 `categories(id)`를 참조**(그림자 행 방식) | FK와 집계는 살아나지만, 소유자 판정이 **조인**이 되어 §1.8의 필터 자리마다 조인이 하나씩 붙는다. 얻는 것은 "`categories`에 컬럼을 더하지 않았다"는 형식뿐인데, **표의 내용은 어차피 바뀐다**(사용자 행이 그 표에 산다). 형식을 위해 조인을 사는 거래라 기각. |
| **C. 커스텀 분류를 기기 로컬(zustand persist)에만** | 분류는 가족 공유 값이다 — 부부가 같은 도넛을 보고 같은 칩으로 걸러야 하고, `expenses.category_id`는 서버에 저장되므로 이름만 기기에 있으면 **다른 기기에서 그 지출이 "기타"로 무너진다**(R28-F3이 정확히 그 상태를 허위 표시로 규정했다). 라운드 100 대안 D와 같은 논리. |
| **D. `parent_category_id`(죽은 컬럼) 소생** | 그 칸의 주석이 소생 금지를 이미 적었다: *"계층을 실제로 쓰려면 조회·집계·리포트가 전부 '부모로 접기'를 알아야 하는데 … 컬럼 하나가 아니라 리포트 계약의 변경이다."* 커스텀 분류는 계층이 아니라 평면 항목이다. |
| **E. 어드민이 가구 요청을 받아 대신 만들어 준다** | 운영 비용이 사용자 수에 비례하고, 어드민 표에 사용자 데이터가 쌓인다(라운드 100·102가 나란히 기각한 "개인 데이터 표면 신설"). |

### 1.2 채택안이 지는 비용과 그 비용을 갚는 방법

대안 A의 파급이 반대로 큰 대신, 채택안은 **누수 표면**을 진다 — 소유자 필터를 한 자리라도 빠뜨리면 가구 A의 분류가 가구 B나 어드민에 샌다. 라운드 100이 `item_templates` 확장(그 문서 §1.1 대안 A)을 기각한 바로 그 이유다. **그 기각이 여기 그대로 적용되지 않는 근거는 모집단을 세었기 때문이다**: `item_templates`를 읽는 자리는 앱·어드민·시드·링크 헬스 워커·CSV 벌크·timing-label 검증으로 흩어져 있고 **워커가 포함되어 자라는 집합**인 반면, `prisma.category`를 읽는 자리는 **전수 10**이고 전부 `apps/api/src`(+시드) 안이며 워커가 0건이다(§0).

그래서 이 설계는 그 10을 **대장으로 고정한다**(§1.8) — 이 저장소가 `transaction-bounds`·`categories-cache-contract`로 이미 두 번 쓴 방법이다. 새 자리가 생기면 기본값이 빨강이다.

### 1.3 소유 단위: **가구(household)** — 아이 소유 기각

- **`GET /categories`에는 아이 파라미터가 없다.** 아이 소유로 가면 그 엔드포인트가 childId를 받아야 하고, 캐시 키가 전역 `["categories"]`에서 `["categories", childId]`로 바뀐다 — 소비처 10곳과 전역 스윕(`categories-cache-contract`), 그리고 구독 전용 화면(`sync-status.tsx`의 `skipToken` 갈래)이 함께 움직이는 변경이다. 얻는 것 없이 캐시 계약 하나를 통째로 다시 쓴다.
- **분류는 재고가 아니라 말버릇이다.** 라운드 100이 커스텀 **품목**을 아이 소유로 정한 근거는 *"둘째는 물려받아서 필요 없음"* — 아이마다 준비물이 실제로 다르다는 사실이었다. "산후도우미"는 첫째에게도 둘째에게도 같은 분류다.
- **지출 행이 이미 `household_id`를 든다**(`expenses.household_id NOT NULL`). 소유 축을 가구로 두면 "이 지출의 가구가 이 분류의 가구인가"가 **행 두 칸 비교**로 끝난다.
- 다가구 사용자(`AuthenticatedUser.households`는 배열이다): 읽기는 **속한 가구 전부의 합집합**, 쓰기는 URL의 `:householdId`가 지목한다(§2.3). 합집합이 정직한 이유는 그 전부가 이 사람의 가구이기 때문이고, 결정적 선택이 필요한 자리에서 하나를 고르는 선례(`analytics.service.ts:35`의 `households.map(h=>h.id).sort()[0]`)를 **쓰지 않는** 이유는 읽기에는 고를 필요가 없기 때문이다.

### 1.4 이름 — 길이·중복·정규화

- **길이**: `categories.name varchar(50)`을 그대로 쓴다 → `CUSTOM_CATEGORY_NAME_MAX_LENGTH = 50`(계약이 단일 소스, 모바일은 자기 상수 + 대조 — `text-limits`·`amount-limit` 관례). 컬럼 폭을 바꾸지 않는 것이 additive 규율이고, 정식 분류 이름과 같은 폭이라 표시 자리가 갈리지 않는다.
- **정규화**: 저장값은 `trim()` + 내부 연속 공백 1칸 접기. 빈 문자열은 400(`VALIDATION_ERROR`).
- **중복 금지 — 이 규칙이 없으면 조용히 칩이 사라진다.** `selectableCategories` 규칙 (c)는 **동명 그룹을 하나로 접고**, 생존자 순위는 `현재값 > 정식·커스텀 > mobile_ 별칭`이다. 커스텀 행은 `mobile_` 접두가 아니므로 정식과 **동순위**가 되어, 이름이 같으면 입력 순서로 하나가 조용히 사라진다(그 행에 지출이 있어도). 그리고 `buildRecordsCategoryChips`의 `idsByName`은 **전량 목록**을 훑으므로, 커스텀 "기저귀"는 퀵타일 별칭 "기저귀"의 id를 자기 `matchIds`로 흡수해 **무관한 지출을 자기 합계로 끌어온다**.
  ⇒ 서버가 생성·이름변경 시 400 `CUSTOM_CATEGORY_NAME_DUPLICATE`로 막는다. 비교 모집단은 **① 시드 21행 전량의 이름**(별칭·스텁 포함 — 위 두 번째 이유 때문에 정식 12만으로는 부족하다) **② 그 가구의 커스텀 행 전량**(보관된 것 포함 — 보관 해제가 중복을 만들면 안 된다). 비교는 정규화 후 `toLowerCase()` 일치.
- **유니크 제약을 두는 축**: DB의 `uq_categories_household_name`은 ②만 지킨다(①은 `household_id IS NULL`이라 부분 색인 밖). ①은 서비스 검사가 유일한 방어선이고, 그 사실을 T1 e2e가 값으로 문다.

### 1.5 아이콘·색: **주지 않는다** (v1 확정, 이월 아님)

- **색 선택을 주지 않는 것이 DNC-017과 정합적이다.** `theme.colors.categoryColors`는 `Record<CategoryCode, string>`이고 소비처는 8타일 격자와 준비템 타일 비주얼 **둘뿐**인데, 둘 다 서버 목록이 아니라 정적 카탈로그 code를 키로 쓴다(§0). 즉 **커스텀 분류가 색을 받을 자리가 오늘 0건**이다. 색을 주려면 (ㄱ) 팔레트 밖 색을 사용자에게 고르게 하거나(= 토큰 잠금 밖 색 리터럴이 데이터로 들어온다 — DNC-017이 막는 드리프트의 데이터판) (ㄴ) 팔레트 인덱스를 저장하되 그 값을 그리는 화면을 새로 만들어야 한다. 둘 다 이 라운드의 값이 아니다.
- **아이콘도 같다.** `categories.icon_name`은 nullable이고 로컬 미러가 이미 `iconName: null`을 서빙한다(`local-backend.ts:947`). 커스텀 행은 `icon_name = NULL`이고, 칩·범례·CSV·리포트는 전부 **텍스트만** 쓰므로 렌더 변화 0이다.
- 결과: 사용자가 정하는 것은 **이름 하나**다. 라운드 100의 시트가 필드 셋을 가진 것과 다른 판단인 이유는, 거기서는 필수도·시기가 **준비율과 목록 버킷이라는 소비처를 실제로 가졌기** 때문이다. 여기서는 색·아이콘의 소비처가 0이다 — 없는 소비처를 위해 사용자에게 결정을 시키지 않는다.

### 1.6 **핵심 난제 — 삭제와, 이미 그 분류로 기록된 지출의 처분**

**결론: 하드 삭제는 어떤 경로로도 제공하지 않는다. "삭제"의 자리에 서는 것은 `active = false`(보관)이고, 그 분류로 기록된 지출은 어디로도 가지 않는다.**

| 후보 | 판정 |
|---|---|
| 하드 삭제 + 지출을 "기타"로 재배정 | **기각.** 사용자가 적어 둔 분류를 앱이 조용히 다른 값으로 바꾸는 것은 허위 기록이다. R28-F3이 *운영자의* 토글에 대해 이미 내린 판정(*"사용자가 실제로 적어 둔 이름이 아니므로 허위 표시다"*)이 사용자 자신의 조작에도 그대로 적용된다 — 오히려 여기서는 되돌릴 방법도 없다. |
| 하드 삭제 + 지출이 있으면 거절(0건일 때만 삭제) | **기각 — 500 poison pill 때문이다.** `createExpenseRowOrTranslateFk`는 `linked_product_link` FK **하나만** 400으로 번역하고 나머지는 다시 던진다. 지출 저장과 분류 삭제가 겹치면 그 INSERT는 `fk_expenses_category` 위반 → **500**이고, 모바일 아웃박스는 5xx를 일시 실패로 보고 **무한 재시도**하며 그 뒤 큐 전체를 막는다(그 주석이 이름 붙인 바로 그 poison pill). 막으려면 FK 번역 표면을 넓혀야 하는데, 같은 주석이 *"여기서 넓게 삼키면 서버 버그가 사용자 입력 오류로 위장된다"*고 그 확장을 미리 거절해 두었다. 0건 검사와 삭제 사이의 경합은 검사로 못 없앤다. |
| **보관(`active = false`)** | **채택.** 이 저장소에 **이미 있는 축**이고 뜻도 이미 정해져 있다 — *"이름은 유지하고 새로 고를 수는 없게"*(R28-F3). 귀결이 정확히 요구사항이다: 기본 `GET /categories`에서 빠져 **새 기록에서 고를 수 없고**, `?includeAll=1`에는 남아 **과거 지출의 이름은 영원히 해석되며**, 리포트 도넛·CSV·기록 칩(현재값 규칙 (d))이 전부 종전대로 동작한다. **지출 행은 한 바이트도 건드리지 않는다.** |
| 보관 해제(복원) | **채택.** 같은 PATCH의 `active: true`. 보관이 되돌릴 수 있는 조작이라는 사실이 "삭제"라는 말을 쓰지 않는 근거이기도 하다. |
| 이름 바꾸기 | **채택**(오타 교정의 정답). 이름 변경은 과거 지출의 표시 라벨을 바꾸지만, 그것은 **자기 기록에 자기가 붙인 이름**이라 R28-F3(운영자가 남의 표시를 바꾼다)과 다른 축이다. 어드민이 정식 분류 이름을 이미 고칠 수 있다는 선례와 같은 선. |

**UI는 이 사실을 그대로 말한다**(§9.6 확정 카피): 버튼은 "보관", 확인 문구는 *"이미 기록한 지출은 그대로 남고, 앞으로 새 기록에서 고를 수 없어요."* — "삭제"라는 말을 쓰지 않는 것이 이 결정의 절반이다.

행이 물리적으로 사라지는 경로는 **파기(retention) 하나뿐**이다(§1.8).

### 1.7 한도: 가구당 **15행** (보관 포함)

`CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD = 15`. 초과 시 400 `CUSTOM_CATEGORY_LIMIT_EXCEEDED`. 근거 셋:

1. `GET /categories`는 **페이지네이션이 없고 전량이 한 캐시에 통째로 앉는다**(소비처 10). 21 + 15 = 36행이 상한이다.
2. **라운드 102와의 산술.** 그 문서 §1.4는 카테고리 예산 상한 30을 *"정식 12종이고 … 커스텀 카테고리는 존재하지 않는 전제라, 30은 분류 체계가 두 배 넘게 자라도 남는 수"*라고 정당화했다. 이 라운드가 그 전제를 깬다 — 12 + 15 = **27 ≤ 30**이라야 그 문장이 계속 참이다. (대안: 커스텀 20 + 예산 상한 40으로 인상 → **기각**. 이미 출시된 계약·미러·폼 상수를 실측된 필요 없이 움직인다.)
3. 보관 행도 세는 이유: 세지 않으면 "만들고 보관"을 반복해 전량 목록을 무한히 불릴 수 있다. 오타는 **이름 바꾸기**로 고치는 것이지 새 행으로 고치는 것이 아니다(§1.6) — 그래서 자리를 낭비할 이유가 없다.

`display_order`는 **서버가 정한다**: `2000 + (그 가구의 기존 커스텀 행 수)`. 시드 대역(10~999 정식, 1001~1009 별칭·스텁)보다 크므로 `GET /categories`·어드민의 공통 정렬(`displayOrder ASC, code ASC`)에서 **언제나 시드 뒤**에 선다. 사용자에게 순서 조정을 주지 않는다(v1 — §7).

### 1.8 파기(retention)와의 정합

- **가구 하드 삭제**: `household_id ON DELETE CASCADE`. 파기 잡의 순서가 이미 안전하다 — 고아 가구 갈래는 `purgeChildRows`(지출 삭제 포함) → `child.deleteMany`(→ `category_budgets` 캐스케이드) → `household.deleteMany` 순이므로, 커스텀 분류를 가리키던 행은 그 시점에 이미 없다.
- **사용자 하드 삭제**: 이 컬럼 결정의 산출물 하나 — **커스텀 분류에 `created_by_user_id`를 두지 않는다.** NOT NULL user FK를 하나 더하면 `findReferenceBlockedUserIds`와 `selectPurgeableStubs`의 **두 자리에 NOT EXISTS 한 줄씩**을 같은 목록으로 추가해야 하고(라운드 100 R2가 밟은 그 체크리스트), 빠뜨리면 이 표가 사용자 파기를 조용히 막는 새 자리가 된다. 행위자·시각은 감사 로그가 답한다(§2.5) — 라운드 102 §1.2와 같은 판단.
- ⚠️ **T1 체크리스트**: `data-retention-purge.db.test.ts`에 "가구 물리 파기 후 그 가구의 `categories` 행 0건 · 시드 21행 불변" 단언 1개(라운드 100·102가 각각 한 것과 동형).

### 1.9 소유자 필터 대장 (누수 방지 규율 — T1 산출물)

`apps/api/test/category-owner-scope.test.ts`(신규): `apps/api/src`와 `apps/api/prisma/seed.ts`에서 `prisma.category.`/`tx.category.`/`client.category.` 호출 자리를 **전수로 걸어** 각 자리가 대장에 **입장(stance)** 과 함께 등재돼 있는지 검사한다. 등재되지 않은 새 자리는 **기본값이 빨강**이다(`transaction-bounds.test.ts`의 양방향 잠금 형식 그대로).

| # | 자리 | 입장 | T1이 하는 일 |
|---|---|---|---|
| 1 | `finance/categories.controller.ts:48` | **household-scoped** | `where`에 `OR: [{householdId: null}, {householdId: {in: 호출자 가구 ids}}]` 가산(§2.2) |
| 2 | `admin/admin-categories.service.ts:59` list | **system-only** | `where: { householdId: null }` 가산 — 운영자는 사용자 분류를 보지 않는다 |
| 3 | `admin/admin-categories.service.ts:69` findById | **system-only** | 같은 조건 → 없으면 종전 404 `CATEGORY_NOT_FOUND` |
| 4 | `admin/admin-categories.service.ts:78` update | **system-only** | ③을 먼저 지나므로 자연히 좁아진다(단언으로 고정) |
| 5 | `finance/milestone-report.service.ts:76` | **id-derived, 안전** | 무변경. id 집합이 그 아이의 지출에서 파생되므로 남의 분류가 들어올 수 없다 |
| 6 | `onboarding/expenses-store.service.ts:451` `requireExistingCategory` | **household-scoped** | 인자에 `householdId` 추가 → `{ id, OR: [{householdId: null}, {householdId}] }`. 호출부 둘 다 값을 이미 갖고 있다(`insertExpense(client, householdId, …)` · `updateExpense`의 `expense.householdId`) |
| 7 | `onboarding/import-pipeline.service.ts:758` 확정 전 실재 | **household-scoped** | 같은 조건(`job.householdId`) — 확정이 남의 분류를 지출에 심지 못한다 |
| 8 | `onboarding/import-pipeline.service.ts:928` code→id | **system-only** | `where: { code: {in: …}, householdId: null }` 가산. 오늘 파서는 정식 code만 내므로 동작 변화 0이고, 방어선이다 |
| 9 | `onboarding/onboarding-core.service.ts:839` `requireBudgetableCategories` | **household-scoped** | 아이의 `householdId`로 좁힌다 — 남의 커스텀 분류에 예산을 세울 수 없다(라운드 102 계약은 그대로). 값은 이미 손에 있다: `upsertBudget`이 첫 줄에서 `requireChildAccess`가 돌려준 `child`를 든다(`:695`) |
| 10 | `prisma/seed.ts:24,59,95` | **code-scoped, 안전** | 무변경. 시드 code 집합으로 이미 좁고 커스텀 code는 `custom_` 접두라 절대 겹치지 않는다 |

---

## 2. 결정 D2 — API 계약

### 2.1 엔드포인트 (base `/api/v1` 고정, DNC-006 — 신규 **둘**)

| 메서드/경로 | 하는 일 | 권한 | 비고 |
|---|---|---|---|
| `GET /categories` (기존) | 응답에 호출자 가구의 커스텀 행 **합류**(§2.2) | 구성원 전원 | **계약 필드 추가 없이** `isSystem:false`가 표식이다 |
| `POST /households/:householdId/categories` | 생성 | owner/co_parent | `IdempotencyInterceptor` + `Idempotency-Key`(라운드 100 §2.3 관례) |
| `PATCH /households/:householdId/categories/:categoryId` | 이름 변경 · 보관(`active:false`) · 복원(`active:true`) | owner/co_parent | 자연 멱등 |

**`DELETE`는 두지 않는다** — §1.6. 지우지 않는 동사에 `DELETE`를 붙이면 API 표면 자체가 거짓말이 된다.
전용 `GET`도 두지 않는다 — 소비처(수정 화면 칩·기록 칩·리포트 이름·CSV·예산·가져오기 검수·관리 화면)가 전부 이미 `["categories"]` 하나를 본다. 두 번째 목록을 만들면 클라이언트가 두 응답을 손으로 합치고 로컬 미러도 두 벌이 된다(라운드 100 §2.1·102 §2.1과 같은 판단).

### 2.2 `GET /categories` 합류 규칙

```
where: {
  ...(includeAll ? {} : { active: true, selectable: true }),   // 종전 두 축 그대로
  OR: [{ householdId: null }, { householdId: { in: 호출자.households.map(h => h.id) } }]
}
orderBy: [{ displayOrder: "asc" }, { code: "asc" }]            // 종전 그대로
```

- **노출 두 축은 종전 의미 그대로 커스텀에도 적용된다**: 커스텀 행은 언제나 `selectable = true`(사용자가 고르라고 만든 행이다), `active`가 보관 축이다. 즉 기본 목록에는 활성 커스텀만, `?includeAll=1`에는 보관된 것까지 — R28-F3의 규칙이 커스텀에 **그대로 재사용**된다(새 규칙 0건).
- **표식**: `householdId`의 유무다. ⚠️ **정정(T1 실측)** — 이 절은 원래 표식을 `isSystem: false`로 적고 근거를 *"오늘 값이 항상 `true`"*로 들었는데, 그 실측이 틀렸다: `prisma/seed.ts`가 퀵타일 별칭 8행과 가져오기 스텁 1행을 `isSystem: false`로 시드한다(dev DB 실측 `t`=12 / `f`=9). 그래서 `?includeAll=1` 응답에는 `isSystem === false`인 **시드** 행이 아홉 개 있고, 그 축만으로 거르면 사용자가 만들지 않은 별칭이 커스텀으로 잡힌다. 같은 이유로 §1의 CHECK도 양방향 등호에서 `household_id IS NULL OR is_system = false`로 좁혔다(양방향이면 그 아홉 행에서 마이그레이션이 실패한다). §4.1의 판정식은 `householdId` 절이 있어 그대로 안전하다. 아래 문단이 말하는 "읽기 경로의 계약 추가 0건"은 유지된다 — `isSystem`은 계약에 이미 required로 있고, 가산 필드는 `householdId` 하나뿐이다. 이 필드는 계약에 **이미 required로 있고**(`categoryListItemSchema:119`) 오늘 값이 항상 `true`라 소비자가 아무도 분기하지 않는다 — 000018이 *"시스템 시드 vs 사용자 정의"*라고 뜻을 적어 둔 그 칸의 첫 소비처가 이 라운드다. **읽기 경로의 계약 추가 0건**이 이 설계의 산출물이다.
- **가산 필드 하나**: `householdId?: string` — **커스텀 행에만** 싣는다(시드 행에는 키 자체가 없다). 관리 화면이 PATCH 대상 URL을 만들고, 다가구 사용자에게 "이 분류는 다른 가구 것"을 구분해 주는 용도다. additive optional이라 구 클라이언트·구 캐시 무접촉.
- 별칭·스텁 관련 규칙(§0)은 **한 글자도 바뀌지 않는다**. 커스텀 code는 `custom_` 접두라 `mobile_`·`import_` 접두 규칙에 걸리지 않고, `catalogIdsByCode`(퀵타일 code 다리)에도 없으므로 기록 탭 칩의 `matchIds`는 **자기 id 하나**다 — 가족 규칙에 새 축이 들어가지 않는다.

### 2.3 `POST` / `PATCH`

```
POST /api/v1/households/:householdId/categories
  바디: { name: string }                       // trim + 공백 접기 후 1..50
  서버가 정한다: code = "custom_" + 32hex(랜덤)  // 전역 UNIQUE varchar(50) 안에서 39자
                 iconName = null · isSystem = false · active = true · selectable = true
                 displayOrder = 2000 + (그 가구의 기존 커스텀 행 수)
  200 → CategoryListItem (isSystem:false, householdId 포함)

PATCH /api/v1/households/:householdId/categories/:categoryId
  바디: { name?: string, active?: boolean }    // 둘 다 optional, 최소 하나 필요
  200 → CategoryListItem
```

- **검증 순서**: DTO 형식(길이·타입) → 권한(가드) → 대상 행이 **그 가구의 커스텀 행인지**(아니면 404 `CUSTOM_CATEGORY_NOT_FOUND` — 시드 행 id·타 가구 id 전부 여기로 떨어진다. 403이 아니라 404인 이유는 "내가 만든 분류"라는 자원이 없기 때문이고, 존재 신탁을 만들지 않는 부수 효과도 얻는다) → 이름 중복(§1.4) → 한도(POST만, §1.7).
- **`code`·`displayOrder`·`iconName`·`selectable`·`isSystem`은 요청이 정할 수 없다.** 어드민 편집 축이 넷으로 좁혀 있는 것과 같은 규율이고, `code`가 전역 유니크·`is_system`이 CHECK로 묶여 있어서 열면 곧바로 계약이 깨진다.
- `active: false`로 보관해도 **행·id·code는 그대로**다. 이것이 §1.6 전체가 기대는 사실이다.

### 2.4 권한·멱등

- 쓰기: `@UseGuards(JwtAuthGuard, HouseholdRoleGuard)` + `@RequireHouseholdRoles("owner", "co_parent")` — 기존 선언형 가드를 그대로 쓴다(`households/:householdId/invites`와 같은 형식). `EXPENSE_EDIT_ROLES`와 같은 역할 집합이라 **새 권한 개념 0건**.
- 읽기: 기존 `GET /categories`(구성원 전원 — viewer·gift_participant 포함). **읽기를 좁히면 안 된다**: 보기 전용 참여자도 리포트 범례와 CSV에서 이름을 봐야 하고, 좁히는 순간 그 사람 화면에서만 "기타"로 무너진다.
- 멱등: POST는 `IdempotencyInterceptor`(클라이언트는 시트 열릴 때 초안 단위 키 하나 — 라운드 100 §2.3). PATCH는 자연 멱등.

### 2.5 감사 로그

`custom_category.create`는 남기지 않는다(행 자체가 기록이고 soft delete가 없어 사라지지 않는다 — 라운드 100 §1.2의 판단). **`custom_category.update`는 남긴다**: 이름 변경과 보관은 `budget.upsert`가 로그를 남기는 그 이유(*"덮어쓰면 이전 값이 사라지는 한 칸"*)에 해당한다.

봉투에 **이름 문자열은 싣지 않는다** — 사용자 자유 문자열은 개인정보 밀도가 높은 축이라는 라운드 100 §1.2의 결정을 그대로 따른다. 싣는 것: `{ categoryId, householdId, changed: ["name"|"active"], activeBefore, activeAfter }`. 알려진 귀결을 그대로 받아들인다 — **이름의 이전 값은 남지 않는다**(가구 내부의 자기 라벨이라 대조가 필요한 분쟁 축이 아니다).

### 2.6 다른 표면의 검증이 소유를 보게 되는 자리

§1.9의 6·7·9다. 셋 다 **기존 함수의 인자 하나**이고 새 엔드포인트·새 에러 코드가 없다:
- 지출 생성/수정: 남의 가구 분류 id는 종전과 같은 400 `EXPENSE_CATEGORY_INVALID`("존재하지 않는 카테고리예요…") — 그 사람에게 그 분류는 실제로 존재하지 않는다.
- 가져오기 확정: 같은 코드로 떨어진다(그 경로가 이미 `requireExistingCategory`에 묻는다).
- 카테고리 예산: 라운드 102의 `CATEGORY_BUDGET_INVALID_CATEGORY` 그대로. **자기 가구의 활성 커스텀 분류에는 예산을 세울 수 있다**(§5의 표) — `category_budgets.category_id`가 같은 표를 가리키므로 마이그레이션 0건이다.

---

## 3. 결정 D3 — 로컬 미러 패리티 (standalone 전 기능 동작)

### 3.1 상태·함수 (`local-backend.ts`)

- `LocalBackendState`에 `customCategories: LocalCustomCategoryRecord[]` 추가(§9.5). `initialState`는 `[]`, `sanitizeLocalBackendState`가 비배열/오염 blob을 `[]`로 되돌린다(`customItems` 관례 그대로). **persist version 3 유지** — 필드 가산은 merge가 기본값으로 메운다.
- **아이 축도 가구 축도 없다**: 로컬 세션은 단일 가구·단일 아이 전제다(`budgets`·`categoryBudgets`가 이미 그렇다 — 라운드 102 §3.1의 알려진 한계). 서버의 `householdId`는 응답 조립 시 `LOCAL_HOUSEHOLD_ID`를 싣는다.
- `listCategories()`: 기존 반환(8타일 + 로컬 픽스처 4)에 커스텀 행을 `displayOrder` 오름차순으로 **합류**시킨다. 데모 목록은 전부 `selectable: true`라는 기존 문단은 그대로 참이고, 커스텀도 `selectable: true`·`isSystem: false`다. `includeAll` 인자는 종전대로 데모에서 무의미하지만 **보관(`active:false`) 행이 생기는 순간 의미가 생긴다** — `includeAll`이 false면 `active:false` 행을 뺀다(서버와 같은 갈래를 미러가 실제로 갖는다).
- `createCustomCategory(householdId, name, idempotencyKey?)` / `updateCustomCategory(householdId, categoryId, patch)`: 검증(트림·50자·중복·한도 15)과 **검증 순서**까지 서버 미러(형식 → 대상 실재 → 중복 → 한도). 문구는 서버 코드와 짝이 있는 것만 `API_ERROR_MESSAGES` 한 곳에서 온다(라운드 102 §3.1이 세운 규율). id는 `generateLocalId("custom-category")`.
- **서버와 미러의 규칙이 문장 하나로 같아야 한다**: *"보관은 `active:false`이고 행은 남는다 · 기본 목록은 활성만 · includeAll은 전량 · 이름 중복은 시드+자기 가구 전량 기준"* — T2가 자기 테스트로 두 구현을 같은 픽스처로 문다(라운드 100 R5·102의 드리프트 대응과 같은 형식).

### 3.2 데모 픽스처: **0건**

커스텀 분류는 사용자 데이터다. 프로덕션 `ensureSeeded`는 사용자 데이터를 만들지 않는다(실기기 피드백 1 이후 규약). 테스트 헬퍼 `seedLocalDemoFixturesForTests`에도 더하지 않는다 — 필요한 테스트가 자기 arrange에서 `createCustomCategory`를 부른다.

### 3.3 오프라인: **v1 온라인 전용** — 그리고 그 근거가 라운드 100보다 강하다

라운드 100 §3.3은 "로컬 id → 서버 id 입양 배관이 비싸다"를 근거로 온라인 전용을 골랐다. 여기서는 근거가 **구조적**이다: 오프라인에서 만든 분류의 id는 서버에 존재하지 않으므로, 그 id를 단 지출이 아웃박스에 실리면 flush에서 **`fk_expenses_category` 위반 → 500 → 무한 재시도 poison pill**이 된다(§0의 그 주석). 즉 오프라인 생성은 배관 비용의 문제가 아니라 **큐를 막는 결함**이다.

그래서: 생성·수정은 일반 `useMutation`(온라인 필요, 실패 시 기존 `useSaveErrorCopy` 경로 — 오프라인이면 오프라인이라고 말한다). 오프라인에서 지출을 기록할 때 고를 수 있는 분류는 **이미 `["categories"]` 캐시에 있는 것**뿐이고, 그것은 종전과 같은 동작이다. 로컬 세션(standalone)은 네트워크가 없어도 §3.1로 전부 동작한다. 재개 조건: 오프라인 생성 요구가 실사용에서 보고되고, 지출 아웃박스가 "분류 생성 선행" 의존을 표현할 수 있게 되는 날.

---

## 4. 결정 D4 — UI

### 4.1 관리 화면 `app/settings/categories.tsx` (신규 라우트 1)

선례는 **`app/settings/amount-presets.tsx`**(라운드 101 W2 F6a) — 사용자 데이터 편집을 설정 하위 화면으로 세운 최근 자리이고, 라우트 대장에 한 줄 추가하는 형식까지 그대로다.

- 머리: `ScreenHeader` 제목 **"지출 분류"**, subtitle **"우리 가족이 쓰는 분류를 직접 더할 수 있어요."**
- 목록: `["categories"]` 캐시를 **`includeAll: true`로 이 화면이 직접 채운다**(전역 규약 준수 — §6.4). `isSystem === false && householdId === 현재 가구`인 행만 그린다. 두 구획: **사용 중**(`active`) / **보관한 분류**(`!active`). 시드 12/21행은 **그리지 않는다** — 사용자가 어쩔 수 없는 행을 목록에 두면 "왜 이건 못 지우지"만 남는다.
- 행: 이름 텍스트 + [이름 바꾸기](인라인 TextInput → [저장]) + [보관] / 보관 구획에서는 [다시 사용].
- 추가: 하단 TextInput + [분류 추가]. 상한 도달 시 버튼 비활성 + 안내 한 줄(문구는 `api-error` 표 단일 소스).
- 빈 상태: **"아직 직접 추가한 분류가 없어요."**
- 판정·문구·중복·상한·a11y 라벨은 전부 순수 모듈 `src/categories/custom-category-form.ts`가 소유하고 화면은 그린다(저장소 확립 규율). 모든 `useMutation`은 `disabled={mutation.isPending}`(control-blocks).
- **게이트**: `useExpenseEntryGate`(= `EXPENSE_EDIT_ROLES` owner/co_parent). 잠기면 입구를 지우지 않고 안내로 답한다(그 훅의 확립 규율). 머리말 문장은 `VIEW_ONLY_HEADLINES`에 자리를 **새로 만들어야 한다**(§9.6 — 대장이 그것을 요구한다).
- 성공 무효화: `["categories"]` 한 번. 이름 변경·보관이 기록 칩·리포트 범례·CSV에 즉시 반영된다(그 셋이 같은 캐시를 읽는다). **추가 키 0건.**

### 4.2 진입점

`app/settings/index.tsx`에 행 하나 — 라벨 **"지출 분류 관리"**, 설명 *"직접 만든 분류를 더하고, 이름을 바꾸고, 보관해요."* `amount-presets` 행 바로 아래(둘 다 "기록을 내 방식으로" 성격).

지출 **수정** 화면 칩 행 끝의 "+ 분류 추가" 바로가기는 **v1.1로 이월**한다(§7): 그 칩 행은 `selectableCategories` 결과를 그대로 그리는 자리이고 `expense-edit-categories.test.ts`가 그 모양을 고정하고 있어, 칩 하나가 아니라 칩 대장의 모양을 바꾸는 변경이 된다. v1의 발견 경로는 설정 하나이고, **만든 뒤에는 수정 화면 칩에 자동으로 나타난다**(§4.3) — 분류를 만드는 것은 계획 행동이라는 라운드 100 §3.3의 같은 판단.

### 4.3 클라이언트 코드 0바이트로 따라오는 표면 (이 설계의 요점)

커스텀 행이 `GET /categories` 응답의 정상 항목이므로, **아래는 전부 T3가 손대지 않아도 동작한다**:

| 표면 | 이유 |
|---|---|
| 지출 수정 화면 칩 행 | `selectableCategories(categories.data.categories, categoryId)`가 그대로 통과시킨다(커스텀은 (a)~(c) 어느 규칙에도 걸리지 않는다) |
| 기록 탭 필터 칩 + `matchIds` | `buildRecordsCategoryChips`가 칩을 만들고 `matchIds = [자기 id]`가 된다(§2.2) |
| 리포트 도넛·범례·드릴다운·인사이트 문장·공유 문구 | 전부 `buildCategoryNameLookup`/`categoryLabel(categoryId)` 하나를 지난다 |
| CSV 내보내기 "카테고리" 열 | 같은 lookup을 주입받는다 |
| 가져오기 검수 화면의 행 분류 칩 | `selectableCategories` 소비처다 |
| 카테고리별 예산(라운드 102) 행·리포트 예산 대비 블록 | 예산 화면 행 모집단이 `buildRecordsCategoryChips`이고 FK가 같은 표를 가리킨다 |
| 마일스톤(100일/첫돌) 리포트 상위 분류 이름 | 서버가 id로 같은 표에서 읽는다 |

### 4.4 넣지 **않는** 두 자리와 그 근거

1. **입력 화면 8타일 격자(EXP-001)**: 승인 캡처의 잠긴 격자이고, 타일은 `categoryColors[code]`로 색을 받는데 커스텀에는 code도 색도 없다(§1.5). 커스텀을 타일로 넣으려면 격자 수·색 규칙·픽셀락 재승인이 함께 움직인다. **v1은 "빠른 기록은 8타일, 분류 조정은 수정 화면"** 이고, 그 경로는 오늘도 그대로다.
2. **자동 분류 추천**: `suggestFromHistory`가 `catalogIds.has(row.categoryId)`로 8타일만 통과시킨다 — 그 필터는 결함이 아니라 **입력 화면이 8타일만 그리기 때문**이다. 추천이 8타일 밖 id를 내면 화면에 누를 타일이 없다. 두 자리는 한 결정으로 묶여 있고(§7), 1이 열리는 날 함께 연다.

---

## 5. 파급 표면 전수와 각각의 처분

| 표면 | v1 처분 | 근거 |
|---|---|---|
| `GET /categories` | **포함** (가구 스코프 합류) | §2.2 |
| 입력 8타일 / "분류별 빠른 품목" 아코디언 | **0접촉** | §4.4-1 (EXP-001 픽셀락 · `categoryColors` 키 축) |
| 지출 수정 화면 칩 행 | **자동 포함** | §4.3 |
| 기록 탭 필터 칩 · `matchIds` 가족 규칙 | **자동 포함, 규칙 무변경** | 커스텀 code는 `custom_` 접두 → 퀵타일 다리(`catalogIdsByCode`)에 없다 |
| 리포트 도넛·범례·드릴다운·추이·연간 | **자동 포함** | 집계 여섯이 원 id를 그대로 준다(§0) |
| 월간 인사이트 문장·공유 텍스트 | **자동 포함** | `categoryLabel` 재사용. ⚠️ 사용자 문자열이 공유 텍스트로 앱 밖에 나간다 — `childName`과 같은 취급(사용자가 스스로 보내는 값, `share-text.ts` 기존 주석) |
| 마일스톤(100일/첫돌) 리포트 | **자동 포함** | 서버 id 해석(§0) |
| **카테고리별 예산(라운드 102)** | **포함 — 커스텀에도 예산을 세울 수 있다** | 같은 표 FK. 검증만 가구 스코프로 좁힌다(§1.9 #9). 상한 30과의 산술은 §1.7 |
| CSV 내보내기 카테고리 열 | **자동 포함** | 주입 lookup |
| CSV **재가져오기 왕복** | **손실 유지 — 변화 0** | 카테고리 열은 이미 왕복에서 버려진다(S-4 실측). 커스텀이 그 사실을 바꾸지도, 악화시키지도 않는다 |
| 가져오기 **검수 화면**의 분류 칩 | **자동 포함** | `selectableCategories` 소비처 |
| 가져오기 **자동 매핑**(키워드→code) | **불가 — 명시** | 파서 `CATEGORY_KEYWORDS`는 정식 code 고정 목록. 커스텀은 자동으로 붙지 않고 사용자가 검수에서 고른다(§7) |
| 자동 분류 추천(품목명→타일) | **불가 — 명시** | §4.4-2 |
| 어드민 카테고리 관리 화면 | **0접촉(서버가 감춘다)** | `householdId: null` 필터(§1.9 #2~4). 개인 데이터 표면 신설 금지 — 라운드 100·102와 같은 판단 |
| 어드민 준비템 분류 셀렉트 | **0접촉** | 위 필터의 파생(`itemCategoryOptions`는 어드민 목록만 본다) |
| `expense_recorded` 애널리틱스 페이로드 | **0접촉 — 이미 안전** | `analyticsCategoryCodeForCategoryId`가 정적 8타일 카탈로그에 없는 id를 `"etc"`로 접는다(`analytics/events.ts:106`). 잠긴 `ANALYTICS_CATEGORY_CODES` 12종 enum에 커스텀 code가 실릴 경로가 없고 이름 문자열도 페이로드에 들어가지 않는다(`analytics.pii-lint.test.ts`). 게다가 이 이벤트는 8타일 입력 화면에서만 발화하므로(그 화면은 §4.4-1이 열지 않는다) 커스텀 id가 도달하지도 않는다 |
| 홈·인앱 알림·푸시 | **0접촉** | 분류를 말하는 자리가 없다 |
| 준비템 목록·상세 | **0접촉** | `item_templates.category_id`는 운영 시드끼리의 관계다 |
| 동기화 상태 화면 | **0접촉** | `["categories"]` 구독 전용(skipToken) — 이름 해석만 좋아진다 |

---

## 6. 경계·리스크

### 6.1 DNC 접점 명시

- **DNC-007** — 이 라운드의 중심 논점. 조항 본문은 `categories`를 이름으로 잠그지 않지만(`expenses`·`budgets`·`item_templates` … 목록에 없다), **가드의 모집단(`db-contract.test.ts`의 `tableNames`)에는 `categories`가 실재한다.** 채택안이 그 조항을 지키는 근거 넷:
  1. **표를 지우지도 이름을 바꾸지도 않는다** — 가드의 실제 단언(`@@map("categories")`)은 그대로 초록이다.
  2. **행 삭제 0 · 기존 id 불변 · code 불변 · active/selectable 불변** — 000018이 스스로 *"DNC-007 준수"*라고 적은 그 조건 목록과 **글자 단위로 같은** 조건을 만족한다. 즉 이 저장소는 `categories`에 대한 additive 컬럼 추가를 **이미 한 번 DNC-007 준수로 판정했다**(선례 인용).
  3. **`expenses`의 의미가 변하지 않는다** — `category_id`는 여전히 "이 지출이 속한 분류"이고, FK도 NOT NULL도 그대로다. 달라지는 것은 그 분류를 **누가 만들었는가**이며, 그 축의 이름(`is_system`)은 000018이 *"시스템 시드 vs 사용자 정의"*라고 이미 정의해 두었다 — 새 뜻을 짓는 것이 아니라 **비어 있던 뜻을 처음 쓰는 것**이다.
  4. **리포트·권한·수익화 구조**(조항의 보호 사유)가 그대로다: 집계 술어 무변경, 권한은 기존 역할 집합 재사용, 커머스 표면 0접촉.
  ⚠️ 그럼에도 이 문서는 이 판정을 **PM 판단 항목으로 표기한다**(정찰 S1의 "PM 판단 선행"). 위 넷은 근거이지 승인이 아니다 — T1 착수 전 이 절이 승인된다.
- **DNC-013/014/015**: 금액·soft delete·선물 제외 전부 무접촉. 커스텀은 분류 축이라 합산 술어에 항이 없다.
- **DNC-009/010/011**: 추천 점수·제휴 고지·스폰서 구분 **0접촉**. 커스텀 분류는 상품·링크·수수료 축과 교차하는 자리가 아예 없다(`item_templates.category_id`는 어드민만 쓰고 어드민은 커스텀을 보지 못한다).
- **DNC-012**: 가져오기 미리보기·승인 흐름 무변경. 커스텀은 검수 화면의 **선택지**로만 나타난다.
- **DNC-016**: 여섯 범위 밖(사진 AI·커뮤니티·가격 추적·중고·금융 제휴·의료)과 무관. `dnc-scope-guard`의 바늘(테이블·엔드포인트·라우트·의존성·잡 이름)에 `custom`/`category` 계열은 없다 — 신규 의존성 0 · 신규 워커 잡 0.
- **DNC-017**: 신규 색 리터럴 0(§1.5). 사용자에게 색을 고르게 하지 않는 것이 이 조항의 정신이다.
- **DNC-018**: 새 문장 전량 해요체, 비난·재시도 권유 없음(§9.6).

### 6.2 라운드 26·28 노출 플래그와의 관계 — 충돌 없음, **재사용**

| 축 | 시드 행 | 커스텀 행 |
|---|---|---|
| `selectable` | 별칭 8 + 스텁 1이 `false`(CAT-124) | **언제나 `true`** — 사용자가 고르라고 만든 행이다 |
| `active` | 운영자가 어드민에서 끈다 | **사용자의 "보관"이 그 축이다**(§1.6) |
| `?includeAll=1` | active 무관 전량(R28-F3 — 과거 지출 이름 해석) | 같은 규칙. 보관해도 이름은 영원히 해석된다 |
| `selectableCategories` (a) | `false` 둘 다 제외, 현재값은 유지(d) | 같은 규칙 그대로 — **새 분기 0건** |

즉 이 기능은 라운드 26·28이 만든 두 축을 **한 개도 새로 만들지 않고** 사용한다. 그 두 축이 "서버 정공법"이었기에 커스텀이 그 위에 그냥 설 수 있다는 것이, 이 설계가 작아지는 이유다.

### 6.3 라운드 102 §6.5 마지막 줄의 재론 (그 문서가 요구한 절)

라운드 102 §6.5는 *"커스텀 카테고리 부재 전제: 사용자는 분류를 만들 수 없다 — 모집단은 운영 시드뿐이므로 상한 30(§1.4)과 칩 대장 재사용이 성립한다. **이 전제가 깨지는 라운드는 이 절을 재론해야 한다**"*고 적었다. 재론 결과:

1. **상한 30은 유효하다** — 커스텀 상한을 15로 정해 12 + 15 = 27 ≤ 30을 유지했다(§1.7). 그 문장이 계속 참이도록 **이쪽 숫자를 맞춘 것**이지 저쪽을 움직이지 않았다.
2. **칩 대장 재사용도 유효하다** — 예산 화면의 행 모집단은 `buildRecordsCategoryChips`이고, 커스텀 칩은 `matchIds = [자기 id]`라 가족 합류 규칙에 새 축이 들어가지 않는다(§2.2). 커스텀 분류의 예산 사용액은 그 id 하나의 합이고, 기록 탭에서 그 칩을 눌렀을 때 보이는 지출 집합과 **정확히 같다**(라운드 102 §5.1이 요구한 정직성이 커스텀에서 자동으로 성립한다 — 별칭 이원이 없기 때문이다).
3. **활성 판정 규칙도 그대로** — 라운드 102 §6.5의 "신규 거부·기존 유지"(보관된 분류에는 예산을 **새로** 세울 수 없고, 이미 선 행은 유지·수정·해제 가능)가 커스텀 보관에 **그대로** 적용된다. 새 규칙 0건.
4. **§1.9 #9**만 T1의 실제 코드 변경이다(예산 검증의 가구 스코프).
⇒ T1 커밋은 라운드 102 §6.5의 그 문단을 **이 절을 가리키도록 갱신**한다(문서 정합 — 1줄).

### 6.4 대장(스윕) 예상 반응과 준수 규칙

| 그물 | 예상 반응 / 각 트랙의 의무 |
|---|---|
| **db-contract(api) / dnc-guard-ledger** | `tableNames`에 `categories`가 있고 단언은 `@@map` 존재다 — 컬럼 가산은 초록. 표를 지우거나 이름을 바꾸는 변경이 아님을 T1이 값으로 확인한다. |
| **category-owner-scope(api, 신규)** | §1.9의 대장. T1이 **만들고** 열 자리를 등재한다. 등재 없는 새 `prisma.category.` 호출은 빨강. |
| **migration-000018-drift(api)** | 000018의 code 목록과 시드 대조 — 커스텀 code는 시드가 아니므로 무접촉. |
| **seed-data(api)** | 정식 12행 목록을 정확히 고정한다 — 시드 무변경이라 초록. |
| **transaction-bounds(api)** | 신규 `$transaction` **0건**(POST/PATCH는 단건 insert/update + 검증 조회). 대장 무접촉. |
| **data-retention-purge(api)** | 단언 1개 추가(§1.8). 사용자 FK를 만들지 않았으므로 `findReferenceBlockedUserIds`/`selectPurgeableStubs`의 NOT EXISTS 목록은 **무접촉**. |
| **categories-cache-contract(mobile, 전역)** | 관리 화면이 `queryKey: ["categories"]` 새 소비처로 잡힌다 — `listCategories(..., { includeAll: true })` 형식이어야 초록(§4.1). 기본 목록으로 채우면 빨강. |
| **shared-cache-policy(mobile)** | 신규 쿼리 키 0건(기존 `["categories"]` 재사용). 무효화도 그 키 하나. |
| **route-surface(mobile)** | **신규 라우트 1** — `["settings/categories.tsx", "/settings/categories"]` 한 줄을 대장에 추가하지 않으면 빨강(기본값 실패). 겹치는 URL 목록·참조 0건 목록은 무접촉. |
| **record-permissions(mobile)** | 게이트를 지나는 새 화면이므로 `VIEW_ONLY_HEADLINES`에 자리가 없으면 빨강 — **새 문장 상수 + 표 항목**을 T3가 함께 싣는다(§9.6). 역할 문자열을 화면에서 직접 비교하지 않는다. |
| **mutation-press-guard(mobile)** | 신규 `useMutation` 3자리(생성·이름변경·보관/복원) 전부 `disabled={mutation.isPending}`(control-blocks) — `does-not-block` 이유 행을 만들지 않는다. |
| **사문 대장 / 라운드 95 공통 금지** | 새 export는 같은 라운드에 제품 호출부 필수. **모바일 새 `export const` 0건** — 상수는 contracts가 갖고 모바일은 자기 상수 + 두 방향 대조(라운드 102 §9.4가 정정한 그 규율). 새 모듈은 배선 커밋과 한 트랙. |
| **contracts-mirror(mobile)** | 새 스키마는 `.object({` 머리 형태로 적는다(파서 규약). `CUSTOM_CATEGORY_NAME_MAX_LENGTH`·`CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD` 미러 + 두 방향 대조를 T2가 싣는다. |
| **슬라이스 가드(source-contract-slice-guard)** | T3 배선 테스트가 소스를 자르면 모든 `indexOf`에 실재 확인(`toBeGreaterThan(-1)`)을 먼저 세운다. |
| **korean-particle-guard(mobile)** | 사용자 이름이 들어가는 새 문장은 **조사를 피하는 형태**로 설계했다(§9.6 — `"{이름}" 분류를 보관할까요?` · a11y `"{이름} 보관"`). 조사가 필요한 문장을 만들게 되면 `korean-particles.ts` 판정 필수. |
| **loading-skeleton / refresh-wiring / screen-phase / keyboard-tap-guard** | contains형 — 새 설정 하위 화면은 `amount-presets`가 이미 통과한 형식을 그대로 따른다. |
| **repo-self-description(test-utils)** | 이 문서는 `docs/5차/round*` 라운드 노트 분류라 모집단 밖(재개 조건 대장 면제 축). 검증 완료(§10). |

### 6.5 픽셀락 무접촉 전략

- 캡처 아홉(SPL/HOME/EXP-001/ITEM-001/ITEM-002/REP-001/FAM/IMP-003/SET-001) 중 **분류를 그리는 것은 EXP-001과 REP-001 둘**이다. EXP-001은 §4.4-1로 **0바이트**(8타일 격자·색 규칙 무변경). REP-001은 도넛이 서버 응답으로 그려지는데 **비세션 캡처**라 세션 쿼리에 닿지 않는다(라운드 102 §6.6이 같은 방식으로 증명한 형식).
- SET-001(`app/(tabs)/more.tsx`)은 탭 화면이고, 진입점을 더하는 곳은 `app/settings/index.tsx`(캡처 밖)다. `amount-presets` 행이 같은 자리에 이미 서 있다.
- `pixelLock/`·`theme.ts`·`DonutChartCard`·`PreparationListParity` **0바이트**.

### 6.6 다가구·아이 전환

- 커스텀 행은 **가구** 소유이고 `["categories"]`는 아이 축이 없는 전역 캐시다 — 아이 전환 teardown(`CHILD_SCOPED_QUERY_KEY_PREFIXES`)과 교차하지 않는다. 같은 가구의 두 아이는 같은 분류를 본다(의도).
- 다가구 사용자: 읽기는 합집합이라 다른 가구의 커스텀 이름이 목록에 보인다(그 사람의 가구다). 관리 화면은 `householdId`로 현재 가구 것만 편집 대상으로 그린다(§4.1). **알려진 귀결 하나**: 두 가구가 같은 이름의 커스텀을 각각 가지면 `selectableCategories` (c)가 하나로 접는다 — 지출은 가구별로 갈려 있어 잘못 매칭되지 않지만 칩이 하나로 보인다. 실사용 빈도가 사실상 0이라 v1은 수용하고 기록만 남긴다(§7).

### 6.7 리스크 목록 (요약)

| # | 리스크 | 크기 | 대응 |
|---|---|---|---|
| R1 | **소유자 필터 누락 = 교차 가구/어드민 유출** | **상** | §1.9 대장 + 신규 스윕(등재 없는 새 호출 = 빨강) + e2e: 타 가구 분류가 `GET /categories`·지출 저장·예산·가져오기 확정·어드민 목록 어디에도 나타나지 않음 |
| R2 | 하드 삭제 경로가 나중에 생겨 FK 500 poison pill 부활 | 중 | §1.6을 계약으로 — `DELETE` 엔드포인트 없음, e2e가 "보관 후에도 지출·이름 불변"을 문다. 재개 조건: FK 번역 표면 확장 결정이 선행 |
| R3 | 이름 중복이 칩을 조용히 삼킴(§1.4) | 중 | 서버 400 + DB 부분 유니크. e2e: 시드 이름(별칭 포함)·자기 가구 보관 행과의 충돌 전부 거절 |
| R4 | 라운드 102 상한 30과의 산술 드리프트 | 중 | §1.7의 15가 **파생값**임을 문서·계약 주석에 적고, T2 대조 테스트가 `12 + CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD <= CATEGORY_BUDGET_MAX_PER_MONTH`를 값으로 문다 |
| R5 | 서버/미러 규칙 드리프트(보관·includeAll·중복) | 중 | 규칙을 §3.1 한 문장으로 고정 + T2가 두 구현을 같은 픽스처로 대조 |
| R6 | 어드민이 사용자 분류를 편집·비활성화 | 중 | §1.9 #2~4(system-only) + e2e: 커스텀 id로 어드민 PATCH → 404 |
| R7 | 신규 라우트/문구 대장 미갱신으로 스윕 빨강 | 하 | §6.4의 두 줄을 T3 프롬프트에 복사 |
| R8 | 공유 텍스트로 사용자 문자열이 앱 밖에 나감 | 하 | 사용자가 스스로 보내는 값(`childName` 선례). 문서에 명기, 코드 변경 없음 |
| R9 | 다가구 동명 커스텀이 칩에서 접힘 | 하 | §6.6 수용·기록 |

---

## 7. 범위 밖으로 미룬 것 (사유 명기) · **v1 축소안 권고**

### v1 축소안 (권고)

**v1 = 서버 모델 + `GET /categories` 합류 + 관리 화면(설정 하위) 하나.** 그 이상을 자르지 않는 이유는, 채택안(§1) 아래에서 **리포트·CSV·예산·기록 칩·수정 화면·가져오기 검수는 "포함"이 아니라 "자동"**이기 때문이다 — 그것들을 "v1에서 뺀다"는 선택지 자체가 없다(빼려면 오히려 억제 코드를 새로 써야 한다). 그래서 이 라운드의 축소는 **표면을 자르는 것이 아니라 두 자리를 열지 않는 것**이다: 입력 8타일과 자동 분류 추천(§4.4). 이 둘이 v1에서 빠져도 루프는 닫힌다 — 빠른 기록 → (필요하면) 수정 화면에서 분류 조정 → 리포트·예산·CSV에 그대로 반영.

### 이월표

| 후보 | 사유 |
|---|---|
| 입력 화면 8타일 격자에 커스텀 편입 | EXP-001 픽셀락 격자 + `categoryColors` 색 규칙 재설계 + 승인 재캡처. 자동 분류 추천과 한 결정으로 묶인다(§4.4) |
| 자동 분류 추천이 커스텀을 고름 | 위와 한 묶음 — 추천이 8타일 밖 id를 내면 누를 타일이 없다(`category-suggestion.ts:196`) |
| 지출 수정 화면 칩 행의 "+ 분류 추가" 바로가기 | v1.1. 칩 행은 `expense-edit-categories.test.ts`가 모양을 고정한 자리라 칩 대장 변경이 된다(§4.2) |
| 아이콘·색 선택 | §1.5 — 소비처 0건 + DNC-017 정합. 재개 조건: 커스텀을 그리는 색 있는 표면이 생기는 날 |
| 사용자 순서 조정(displayOrder) | 서버가 시드 뒤 대역을 준다(§1.7). 순서 편집은 드래그 UI + 재정렬 계약이 별도 |
| 가져오기 **키워드 사전**에 커스텀 학습 | 파서는 서버 정적 사전이고, 가구별 사전은 파싱 경로에 가구 상태를 들이는 별도 설계. v1은 검수 화면에서 사람이 고른다 |
| CSV 재가져오기의 카테고리 열 복원 | 이미 알려진 손실이고 `import_rows` 스키마 + 확정 경로 변경이 함께 필요하다(S-4가 DNC-012·015 선행으로 판정) |
| 커스텀 → 정식 분류 **병합**(기록 일괄 재배정) | 지출 행의 `category_id`를 대량 갱신하는 조작이라 감사·되돌리기 설계가 선행(가져오기 되돌리기와 같은 급) |
| 하드 삭제 | §1.6 — FK 번역 표면 확장 결정이 선행 |
| 가구 간 분류 공유·복제 | 소유 축이 가구 하나라는 결정의 반대편(§1.3). 실요구 보고 시 |
| 어드민 노출(커스텀 통계·CS 조회) | 개인 데이터 표면 신설 — 개인정보 검토 선행(라운드 100·102와 동일) |
| 홈·알림에 커스텀 분류 언급 | 홈은 총액 축이다(라운드 102 §4.4의 TOSS-T2 완화 규율) |
| 생성 analytics 이벤트 | 이름이 기기를 떠나지 않는 페이로드 설계(ANA-103 관례) 포함 후속 |

---

## 8. 트랙 분할 (T1 / T2 / T3)

**계약은 이 문서 §9가 확정한다** — 세 트랙은 서로의 코드가 아니라 §9만 본다. 파일 교집합 공집합.

| 트랙 | 소유 파일 | 테스트 요구 | 비고 |
|---|---|---|---|
| **T1 api** | `prisma/migrations/000024_categories_household_owner/` · `prisma/schema.prisma`(Category 컬럼 1) · `finance/categories.controller.ts`(가구 스코프) · `finance/dto/custom-categories.dto.ts`(신규) · `households/custom-categories.controller.ts`+`.service.ts`(신규) · `admin/admin-categories.service.ts`(system-only 3자리) · `onboarding/expenses-store.service.ts`(`requireExistingCategory` 인자) · `onboarding/import-pipeline.service.ts`(2자리) · `onboarding/onboarding-core.service.ts`(`requireBudgetableCategories` 스코프) · `test/custom-categories.e2e.test.ts`(신규) · `test/category-owner-scope.test.ts`(신규 대장) · `test/data-retention-purge.db.test.ts`(단언 1) · `docs/5차/round102-…md` §6.5 1줄 갱신 | e2e: CRUD(생성·이름변경·보관·복원)·권한(viewer 403·타가구 404)·멱등 재제출·한도 15·이름 중복(시드 21 이름 포함)·`GET /categories` 합류와 includeAll 갈래·**보관 후 지출 무변경 + 이름 계속 해석**·지출/예산/가져오기 확정의 타가구 거절·어드민 무오염·감사 봉투(이름 미기록)·파기 캐스케이드. 대장 테스트: 열 자리 등재 + 새 자리 빨강 | DTO는 class-validator 자체 선언(contracts 신규 심볼 import 0 — T2와 독립) |
| **T2 contracts + client + local-backend** | `packages/contracts/src/schemas.ts`(가산) · `apps/mobile/src/api/client.ts`(타입 가산 + 함수 2) · `apps/mobile/src/api/local-backend.ts`(상태·sanitize·listCategories 합류·함수 2) · `contracts-mirror.test.ts`(상수 두 방향) · `local-backend` 계열 테스트 | zod 파스(가산 optional `householdId`) · 미러: 생성/이름변경/보관/복원/한도/중복/includeAll 갈래·정렬(서버 규칙 §2.2·§3.1을 같은 픽스처로) · sanitize(오염 blob → `[]`) · **`12 + CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD <= CATEGORY_BUDGET_MAX_PER_MONTH`** 대조(R4) | |
| **T3 UI** | `app/settings/categories.tsx`(신규) · `app/settings/index.tsx`(진입 행) · `src/categories/custom-category-form.ts`+`.test.ts`(신규 — 검증·문구·중복·상한·a11y) · `src/family/record-permissions.ts`(문장 상수 + `VIEW_ONLY_HEADLINES` 항목) · `src/route-surface.test.ts`(대장 1줄) · `src/categories/custom-category-wiring.test.ts`(신규 — 가드된 슬라이스) | 모듈 테스트(50자 가드·트림·중복 문구·해요체·조사 없는 형태·a11y 문장) · 배선 테스트(`["categories"]` includeAll · 게이트 참조 · press-guard `disabled` · 세션 갈래) · 기존 스윕 전체 그린(route-surface·record-permissions·categories-cache-contract 포함) | `src/categories.ts`·`records-list-view.ts`·`theme.ts`·`DonutChartCard` **읽기 전용** |

**커밋 순서와 병렬성**: T1 ∥ T2 완전 병렬(교집합 0 — T1은 contracts 신규 심볼을 import하지 않는다). **T3는 T2 머지 후**(client 함수·타입을 import한다). 즉 `T1, T2 → T3`. 각 트랙 머지 시 자기 필터 테스트 그린, 라운드 종료 시 `pnpm release:gate`. api 테스트는 실 PostgreSQL(`pnpm db status` → 필요하면 `pnpm db start`).

커밋 컨벤션 예: `feat(api): 커스텀 지출 분류 소유자 컬럼·가구 스코프·관리 엔드포인트 (R103-T1)` / `feat(mobile): 커스텀 분류 계약·클라이언트·로컬 미러 (R103-T2)` / `feat(mobile): 지출 분류 관리 화면 (R103-T3)`.

---

## 9. 계약 확정 (트랙 프롬프트에 그대로 넣는 절)

### 9.1 packages/contracts/src/schemas.ts 가산 (T2 소유 — 수기 단일 소스)

```ts
// 라운드 103: 커스텀 지출 카테고리. 별도 표가 아니라 categories의 가구 소유 행이다
// (expenses.category_id가 NOT NULL FK라 그 밖의 id는 지출에 저장될 수 없다 — 설계 §1.1).
// 표식은 기존 isSystem(false)이고, 읽기 경로의 계약 추가는 householdId 하나뿐이다.
// 계약 확정 원문은 docs/5차/round103-custom-expense-category-design.md §9.
export const CUSTOM_CATEGORY_NAME_MAX_LENGTH = 50; // categories.name varchar(50)와 동치
/**
 * 가구당 커스텀 분류 행 상한(보관 포함). 15는 파생값이다 —
 * 정식 12 + 15 = 27 <= CATEGORY_BUDGET_MAX_PER_MONTH(30, 라운드 102 §1.4).
 * 이 부등식이 깨지면 카테고리 예산 화면이 상한에 먼저 부딪힌다(설계 §1.7 · R4).
 */
export const CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD = 15;

// categoryListItemSchema 가산(additive optional — 구 서버 응답·구 캐시 통과):
//   householdId: uuidSchema.optional()   // 커스텀 행에만 실린다. 시드 행에는 키가 없다.
// isSystem/active/selectable/iconName은 무변경 — 커스텀은 isSystem:false, iconName:null,
// selectable:true, active가 보관 축이다(설계 §2.2).

export const createCustomCategoryRequestSchema = z.object({
  name: z.string().min(1).max(CUSTOM_CATEGORY_NAME_MAX_LENGTH) // 서버가 trim·공백접기 후 재검증
});

export const updateCustomCategoryRequestSchema = z.object({
  name: z.string().min(1).max(CUSTOM_CATEGORY_NAME_MAX_LENGTH).optional(),
  active: z.boolean().optional() // false = 보관(삭제 아님), true = 복원. 설계 §1.6
});

export type CreateCustomCategoryRequestDto = z.infer<typeof createCustomCategoryRequestSchema>;
export type UpdateCustomCategoryRequestDto = z.infer<typeof updateCustomCategoryRequestSchema>;
```

### 9.2 엔드포인트 시그니처 (T1 — DTO는 class-validator 자체 선언, 위 스키마의 미러)

```
GET    /api/v1/categories?includeAll=1        (기존 — 응답 합류) 권한: 구성원 전원
       where: (includeAll ? {} : { active:true, selectable:true })
              AND (household_id IS NULL OR household_id IN 호출자.households)
       정렬 종전 그대로(displayOrder ASC, code ASC)
       커스텀 행: isSystem:false · householdId 실림 · iconName:null · selectable:true

POST   /api/v1/households/:householdId/categories       권한: owner/co_parent
       헤더: Idempotency-Key(선택, IdempotencyInterceptor)
       바디: { name: string(1..50, trim + 연속공백 1칸) }
       서버 결정: code="custom_"+32hex · isSystem=false · active=true · selectable=true
                  iconName=null · displayOrder=2000+(그 가구 기존 커스텀 행 수)
       200 → CategoryListItem
       400 CUSTOM_CATEGORY_NAME_DUPLICATE / CUSTOM_CATEGORY_LIMIT_EXCEEDED / VALIDATION_ERROR

PATCH  /api/v1/households/:householdId/categories/:categoryId   권한: owner/co_parent
       바디: { name?, active? }  — 최소 하나 필요(둘 다 없으면 VALIDATION_ERROR)
       대상은 그 가구의 커스텀 행만. 시드 행·타 가구 행 → 404 CUSTOM_CATEGORY_NOT_FOUND
       active:false = 보관(행·id·code 불변, 지출 무접촉) · active:true = 복원
       200 → CategoryListItem
       감사: custom_category.update { categoryId, householdId, changed:["name"|"active"],
             activeBefore, activeAfter }  — 이름 문자열은 싣지 않는다(설계 §2.5)

(DELETE 없음 — 설계 §1.6)
```

### 9.3 에러 코드

| 코드 | HTTP | 언제 | 메시지(해요체) |
|---|---|---|---|
| `CUSTOM_CATEGORY_NAME_DUPLICATE` | 400 | 정규화한 이름이 시드 21행 또는 그 가구의 커스텀 행(보관 포함)과 겹침 | "이미 있는 분류 이름이에요. 다른 이름으로 적어 주세요." |
| `CUSTOM_CATEGORY_LIMIT_EXCEEDED` | 400 | 그 가구의 커스텀 행이 이미 15개 | "직접 추가한 분류는 가구당 15개까지예요. 쓰지 않는 분류는 보관하고, 이름은 언제든 바꿀 수 있어요." |
| `CUSTOM_CATEGORY_NOT_FOUND` | 404 | 그 가구의 커스텀 행이 아님(시드 행·타 가구 포함) | "직접 추가한 분류를 찾을 수 없어요." |
| (기존) `VALIDATION_ERROR` | 400 | 길이·공백·빈 바디 | 기존 문구 |
| (기존) `FORBIDDEN` | 403 | viewer·gift_participant 쓰기(HouseholdRoleGuard) | 기존 문구 |
| (기존) `EXPENSE_CATEGORY_INVALID` | 400 | 지출 저장에 타 가구/미존재 분류 id | 기존 문구 |
| (기존) `CATEGORY_BUDGET_INVALID_CATEGORY` | 400 | 예산에 타 가구/보관된 분류(신규 행) | 기존 문구(라운드 102) |

### 9.4 mobile client.ts (T2)

```ts
// CategoryListItem 가산: householdId?: string;   // 커스텀 행에만
export function createCustomCategory(
  token: string, householdId: string, name: string, idempotencyKey?: string
): Promise<CategoryListItem>;   // local 토큰 → localBackend.createCustomCategory

export function updateCustomCategory(
  token: string, householdId: string, categoryId: string,
  patch: { name?: string; active?: boolean }
): Promise<CategoryListItem>;   // local 토큰 → localBackend.updateCustomCategory

// 상수 미러는 라운드 102 §9.4가 정정한 규율 그대로: client.ts에 미러 상수를 두지 않는다.
// 값 사본은 그 값을 실제로 쓰는 자리의 **비export 리터럴**이고(local-backend.ts ·
// custom-category-form.ts), 두 방향 대조는 각 모듈의 테스트가 진다.
```

### 9.5 local-backend.ts (T2)

```ts
type LocalCustomCategoryRecord = {
  id: string;            // generateLocalId("custom-category")
  code: string;          // "custom_" + 로컬 접미 — 데모 목록 안에서만 유일하면 된다
  name: string;
  displayOrder: number;  // 2000 + 기존 커스텀 행 수
  active: boolean;       // false = 보관
  createdAt: string;     // ISO
};
// state.customCategories: LocalCustomCategoryRecord[] (initialState [], sanitize 비배열→[])
// listCategories(options?: { includeAll?: boolean }):
//   8타일 + 로컬 픽스처 4 + customCategories(includeAll이 아니면 active만),
//   displayOrder 오름차순. 커스텀은 isSystem:false · iconName:null · selectable:true ·
//   householdId: LOCAL_HOUSEHOLD_ID
// createCustomCategory(householdId, name, idempotencyKey?) — idempotencyKeys 맵 재사용(MOB-102 형식)
//   검증 순서 미러: 형식(트림·1..50) → 이름 중복(데모 목록 전량 + 자기 커스텀 전량) → 한도 15
// updateCustomCategory(householdId, categoryId, { name?, active? })
//   대상이 커스텀이 아니면 CUSTOM_CATEGORY_NOT_FOUND 문구로 throw
// 데모 픽스처 0건(§3.2) · 아이/가구 축 없음(단일 세션 전제)
```

### 9.6 UI 확정값 (T3)

- **라우트**: `app/settings/categories.tsx` → `/settings/categories`. `src/route-surface.test.ts`의 손 대장에 `["settings/categories.tsx", "/settings/categories"]` 한 줄 추가(없으면 빨강).
- **진입**: `app/settings/index.tsx`의 `amount-presets` 행 아래 — 라벨 **"지출 분류 관리"**, 설명 **"직접 만든 분류를 더하고, 이름을 바꾸고, 보관해요."**
- **확정 카피(화면 문장 전량)**
  - 제목 **"지출 분류"** · subtitle **"우리 가족이 쓰는 분류를 직접 더할 수 있어요."**
  - 구획 제목 **"사용 중"** / **"보관한 분류"**
  - 빈 상태 **"아직 직접 추가한 분류가 없어요."**
  - 추가 입력 placeholder **"예: 산후도우미"** · 버튼 **"분류 추가"**
  - 행 버튼 **"이름 바꾸기"** / **"저장"** / **"보관"** / (보관 구획) **"다시 사용"**
  - 보관 확인(Alert) 본문 **`"{이름}" 분류를 보관할까요? 이미 기록한 지출은 그대로 남고, 앞으로 새 기록에서 고를 수 없어요.`**
  - 보관 구획 맺음 안내 **"보관한 분류로 기록한 지출은 그대로 남아요."**
  - ⚠️ 상한·중복 문구는 화면이 짓지 않는다 — `api-error` 표(§9.3)와 순수 모듈이 단일 소스다.
  - ⚠️ **"삭제"라는 낱말을 쓰지 않는다**(§1.6). 지우지 않는 조작에 그 말을 붙이면 문장이 거짓이 된다.
- **조사 규율**: 사용자 이름 뒤에 조사를 두지 않는 형태로 확정했다(`"{이름}" 분류를 …` · a11y `"{이름} 보관"`). 형태를 바꾸어 조사가 필요해지면 `src/text/korean-particles.ts` 판정 필수(§6.4).
- **a11y**: 행 라벨 `"{이름}. 지출 분류"` · 버튼 라벨 `"{이름} 보관"` / `"{이름} 다시 사용"` / `"{이름} 이름 바꾸기"`. 저장을 잠그는 오류(길이·중복·상한)는 `theme.colors.danger` + `accessibilityLiveRegion="polite"`(라운드 102 §9.6의 색·낭독 갈래 규율 그대로), 관측 톤 안내는 캡션 회색.
- **게이트**: `useExpenseEntryGate`. `src/family/record-permissions.ts`에 문장 상수 신설 —
  `CATEGORY_EDIT_VIEW_ONLY_MESSAGE = "보기 전용으로 참여하고 있어요. 지출 분류는 관리자·공동부모가 더하고 고칠 수 있어요."` — 그리고 `VIEW_ONLY_HEADLINES`에 `categories:` 항목 추가(대장이 요구한다).
- **쿼리**: `useQuery({ queryKey: ["categories"], queryFn: () => listCategories(authToken!, { includeAll: true }), staleTime: 5*60*1000 })` — 전역 규약 준수. 성공 시 `["categories"]` 한 번만 무효화.
- 신규 라우트 1 · 신규 쿼리 키 0 · 신규 색상 리터럴 0 · 모바일 새 `export const` 0(함수형/계약 소유) · 신규 `useMutation` 3(전부 `disabled={isPending}`) · 배선 테스트 슬라이스는 실재 확인(`toBeGreaterThan(-1)`) 선행.

---

## 10. 검증 계획 · DNC 체크리스트

- 트랙별: 자기 신규/갱신 테스트 + `pnpm --filter api|mobile test` 그린(스윕 포함). 라운드 종료: `pnpm release:gate`. contracts는 T2 커밋에 포함. **admin 앱은 0바이트**(서버가 감추므로 화면 코드 변경 없음 — 기존 그린 확인만).
- e2e 핵심 경계(T1): 타 가구 분류가 여섯 표면(목록·지출 저장·지출 수정·예산·가져오기 확정·어드민) 어디에도 나타나지 않음 · viewer 403 · 보관 후 **지출 행 불변 + `includeAll` 이름 해석 유지** · 이름 중복(별칭 이름 포함) 거절 · 한도 15 · 멱등 재제출 · 감사 봉투에 이름 문자열 부재 · 가구 파기 캐스케이드 + 시드 21행 불변.
- standalone 육안 1루프: 로컬 세션에서 분류 추가 → 지출 수정 화면 칩에 등장 → 그 분류로 기록 → 기록 탭 칩 필터 → 리포트 도넛 범례 → 카테고리 예산 행 → CSV 내보내기 열 → 이름 바꾸기 → 보관 → 기록·리포트에서 이름이 그대로 남는지 확인 → 다시 사용.
- 스윕 반응 확인(이 설계 라운드에서 실측): `cd packages/test-utils && npx vitest run src/repo-self-description.test.ts` **그린**(35 tests) — 이 문서는 라운드 노트 분류라 재개 조건 대장 면제 축(§6.4).
- **PM 판단 항목(착수 전 승인 필요)**: §6.1의 DNC-007 판정(운영 시드 표에 사용자 소유 행을 허용하고, 그 축을 `is_system`으로 표현한다) · §1.6의 "하드 삭제 없음, 보관만" · §1.7의 상한 15.
- DNC 답변(배치 보고용): screen ids preserved **yes**(DNC-004의 잠긴 ID 밖 — 설정 하위 화면 1) · API base preserved **yes**(`/api/v1`) · affiliate disclosure preserved **yes**(커머스 표면 0접촉) · recommendation commission excluded **yes**(추천 점수 무접촉) · import preview-before-save preserved **yes**(검수 선택지만 늘어난다).
