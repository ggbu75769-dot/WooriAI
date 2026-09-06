# 라운드 102 설계 — 카테고리별 예산

작성: 2026-09-06 · 기준 HEAD: `master fa2518b` · 성격: **단독 설계 라운드** (코드 변경 0바이트 — 이 문서가 산출물이다)

> 이월 근거: 라운드 102 정찰 S1의 F3(가치 최대·비용 최대 — 설계 선행 판정). 같은 항목의 앞선 기록 셋이 전부 "선행 결정 필요"로 미뤄 왔다: `docs/5차/feature-round1-design.md` §6("카테고리별 예산 | budgets 스키마 확장(서버+미러)"), `docs/5차/round55-plan.md` 이월 표("유니크 제약 교체/신규 엔드포인트 = PM·서버 선행"), `docs/5차/budget-app-gap-analysis.md` #5("총액 1행뿐. 유니크 제약 교체가 필요해 PM 승인 대상"). 이 문서는 그 세 기록이 걸었던 조건 자체를 **해소하는 길**을 확정한다 — `budgets`의 유니크 제약을 교체하지 않고(§1.1 대안 A 기각) additive 별도 테이블로 가므로, gap-analysis가 말한 "PM 승인 대상(파괴적 변경)"이 발생하지 않는다. 계약 확정은 §9이고, 다음 라운드의 세 트랙(T1 api / T2 contracts+client+local-backend / T3 UI)은 **이 문서만 보고 병렬로** 집행한다.

핵심 루프와의 관계(DNC-002): 카테고리별 예산은 루프의 **"지출 기록 → 총액 확인"** 단계를 세분화한다 — "이번 달 30만 원" 다음에 나오는 질문이 "기저귀에 얼마나 썼지"이고, 오늘 리포트 도넛은 사용액만 말할 뿐 기준선이 없다. 홈의 예산 경고·푸시·페이스는 **총액 그대로**다(§4.4 — TOSS-T2 3중 발화 완화 규율 보존). 커머스 표면(준비템·구매 링크)은 0접촉이다.

---

## 0. 현재 구조 실측 (설계가 딛는 사실들)

| 면 | 실측 | 근거 파일 |
|---|---|---|
| 서버 예산 | `budgets(child_id, year_month UNIQUE, amount_krw int4, created_by_user_id)` — 총액 한 칸. **SQL FK 없음**(아이 파기는 purge job이 `tx.budget.deleteMany`로 직접, 사용자 파기는 `created_by_user_id` 참조 차단 검사 목록에 있음) | `prisma/schema.prisma:428~440`, `migrations/000001*/migration.sql:219~228`, `worker/jobs/data-retention-purge.job.ts:1044,1231` |
| 예산 API | `GET/PUT /children/:childId/budget` — PUT은 `IdempotencyInterceptor` + `budget.upsert` 감사 봉투(before/after — 덮어쓰면 이전 금액이 사라지는 한 칸이라, GAP-063 #5). GET은 행이 없으면 404 `BUDGET_NOT_FOUND`, 클라이언트는 그것을 `null`로 접는다 | `onboarding/budgets.controller.ts`, `onboarding-core.service.ts:624~679`, `client.ts:867~883` |
| 예산 계약 | `budgetSchema{childId, yearMonth, amountKrw(min 1), usedAmountKrw, remainingAmountKrw}` · `homeMonthlyBudgetSchema`는 그 extend(amountKrw min 0 — 홈은 미설정을 0으로 말한다) · `reportMonthlySchema.budgetAmountKrw` | `packages/contracts/src/schemas.ts:296~309,507~515` |
| 예산 경고 3표면 | 판정은 `@wooriai/domain`의 `reachedBudgetBoundaries` **하나**(R19-D): 홈 배너(`budget-warning.ts`) · 인앱 알림(`notifications/generators.ts`) · 서버 푸시(`push-dispatch.service.ts` — `push_boundary_marks` (아이,월,경계) 유니크 클레임으로 at-most-once). 전부 **총액** 기준 | `packages/domain/src/budget-boundary.ts`, `schema.prisma:442~466` |
| TOSS-T2 완화 규율 | 홈의 예산 발화는 의도적으로 **줄여** 왔다: 예산 사용률 넛지 카드 은퇴(#5) · 경고 배너 활성 중 월말 예상 카드 강등(#9 — "80~99% 구간의 예산 3중 발화 완화") | `docs/dev/dsn-053-deviation-toss-t2-home.md` |
| 예산 화면 | `app/budget.tsx`(BUD-001 — **픽셀락 캡처 아홉에 없음**, 라운드 71 표기 정정): 현재 예산 카드 + 새 예산 입력 + 조정 칩(±10만·지난달 실지출·**지난달 그대로**(B1(b) — 이번 달 예산이 null일 때만 지난달 1건 조회)·최근 3개월 평균(기능 라운드 1 트랙 E, 같은 defer)). 저장은 서버 직행 `useMutation` + `useExpenseEntryGate` 잠금 + `["budget"],["home"],["report"]`만 무효화 | `app/budget.tsx`, `src/home/budget-edit.ts`, `budget-suggestion.ts` |
| 카테고리 | 서버 시드 3묶음 = 정식 12(`categorySeeds`, 랜덤 UUID) + 모바일 퀵타일 별칭 8(`mobileCategoryAliasSeeds`, 고정 UUID·`mobile_*` code·`selectable:false`) + 가져오기 스텁 1. 운영자가 어드민에서 `active:false`로 **숨길 수 있고**(카테고리 숨김 플래그), R28-F3: `?includeAll=1`은 active와 무관하게 전량 — 숨긴 카테고리도 과거 지출의 **이름 해석은 유지**된다 | `prisma/seed-data.ts:78~,1183~`, `finance/categories.controller.ts:31~50`, `src/categories.ts` |
| 8타일/12종 이원 | 빠른 기록은 별칭 id로, 수정 화면·가져오기는 정식 id로 저장한다. 기록 탭 칩(REC-121/CAT-124)이 확립한 합류 규칙: 정식 칩 하나가 `matchIds`(자기 id + 같은 이름 id + 같은 분류 code의 퀵타일 별칭 id)로 **가족을 흡수**해 거른다 — 이것이 이 저장소에서 "한 카테고리"의 사용자 대면 정체성이다 | `src/expenses/records-list-view.ts:36~134` |
| 리포트 | 도넛(실제로는 정직한 가로 누적 막대)은 `GET /reports/category`(원 id 단위 groupBy, `expenseType="expense"`+`deletedAt IS NULL` 술어)를 `computeCategoryShares`로 그림. 월간 리포트 `budgetAmountKrw`는 **어느 달이든** 그 달 예산을 싣고, 끝난 달 예산 결과 한 줄(GAP-066)이 이미 그 값을 소비. 이름 해석은 `["categories"]`(includeAll 전량) 캐시 + `buildCategoryNameLookup` | `reporting-store.service.ts:89~106,291~`, `app/(tabs)/reports.tsx:584~603`, `src/reports/completed-month-budget.ts` |
| `["categories"]` 캐시 규약 | 이 키를 **채우는** 소비처는 반드시 `includeAll: true`(아니면 별칭 라벨이 "기타"로 무너진다), 구독만 하면 `enabled:false + queryFn: skipToken` — 전역 스윕이 전수 검사 | `src/categories-cache-contract.test.ts` |
| 합산 술어 | 선물·환불 제외는 서버 `sumExpenses`/`categoryBreakdown`(둘 다 `expenseType="expense"`)과 모바일 `countsTowardMonthlyTotal` 미러 한 벌(DNC-015). `EXPENSE_TYPES = ["expense","gift","refund"]` | `expenses-store.service.ts`, `src/offline/expense-list-reconciliation.ts:142`, `domain/src/enums.ts:33` |
| 로컬 미러 | `local-backend.ts`의 `budgets: Record<정규화월, number>`(아이 축 없음 — 로컬 세션 단일 아이 전제, `budgetKey = getSeoulMonthRange().yearMonth`). `getBudget`은 없으면 throw(클라이언트가 null로 접음), `upsertBudget`은 맵 갱신. 데모 픽스처의 예산은 **테스트 헬퍼만** 심는다(`seedLocalDemoFixturesForTests` — 프로덕션 ensureSeeded는 사용자 데이터 0) | `local-backend.ts:231,639,1160~1176,2448` |
| 트랜잭션 대장 | `apps/api/src`의 모든 `$transaction`은 명시 상한을 갖거나 대장에 이유와 함께 등재(양방향 잠금) | `apps/api/test/transaction-bounds.test.ts` |

---

## 1. 결정 D1 — 데이터 모델: **별도 테이블 `category_budgets`** (총액 `budgets` 무접촉)

### 채택안

새 테이블 `category_budgets` 한 장. 소유 단위는 **아이(child) × 월 × 카테고리**, 금액 한 칸.

```sql
-- apps/api/prisma/migrations/000023_category_budgets/migration.sql (초안)
-- 라운드 102 T1: 카테고리별 예산 — docs/5차/round102-category-budget-design.md §1.
-- budgets(총액 한 칸)를 확장하지 않는 이유는 §1.1(uq_budgets_child_month 교체 = 파괴적
-- 변경 + DNC-007 의미 변경). 000011~000022와 동일하게 additive-only·재실행 안전.
CREATE TABLE IF NOT EXISTS category_budgets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 아이 물리 파기 시 함께 삭제(custom_items 000022·push_boundary_marks 000013 관례 —
  -- budgets가 FK 없이 purge job의 명시 deleteMany에 기대는 것보다 이 쪽이 새 표의 정석이다. §1.5)
  child_id     uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  year_month   date NOT NULL,
  -- 카테고리는 물리 삭제되지 않는 운영 시드(active 플래그만 뒤집힘)라 캐스케이드 없음
  category_id  uuid NOT NULL REFERENCES categories(id),
  amount_krw   int  NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_category_budgets_child_month_category UNIQUE (child_id, year_month, category_id),
  -- budgets의 chk_budgets_first_day와 같은 형식 — 월 키의 정규형을 DB가 지킨다
  CONSTRAINT chk_category_budgets_first_day CHECK (date_trunc('month', year_month)::date = year_month)
);
-- 조회는 언제나 (child_id, year_month) 전량이므로 유니크 제약의 선두 컬럼이 곧 인덱스다(추가 인덱스 없음).
```

```prisma
// schema.prisma 초안 (관계 미선언 관례 — 000001 참조)
model CategoryBudget {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  childId    String   @map("child_id") @db.Uuid
  yearMonth  DateTime @map("year_month") @db.Date
  categoryId String   @map("category_id") @db.Uuid
  amountKrw  Int      @map("amount_krw")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@unique([childId, yearMonth, categoryId], map: "uq_category_budgets_child_month_category")
  @@map("category_budgets")
}
```

### 1.1 대안과 기각 사유

| 대안 | 기각 사유 |
|---|---|
| **A. `budgets` 확장(category_id nullable 추가, 유니크 교체)** | ① `uq_budgets_child_month`를 `(child_id, year_month, category_id)`로 **교체**해야 한다 — 기존 유니크를 지우는 파괴적 마이그레이션이고, gap-analysis #5가 정확히 이 지점을 "PM 승인 대상"으로 못 박았다. ② `budgets`를 읽는 자리 전부가 "총액 한 행" 전제다: `findUnique(childId_yearMonth)`(getBudget·getHome·getMonthlyReport 세 곳), 푸시 경계 판정, 이월 칩의 지난달 1건 조회. category_id 행이 같은 표에 섞이면 **한 자리라도 `category_id IS NULL` 필터를 빠뜨리는 순간 총액이 카테고리 행으로 오염**된다 — 라운드 100이 `item_templates` 확장을 기각한 것과 동형의 전방위 필터 리스크. ③ DNC-007이 보호하는 `budgets`의 의미("아이·월당 총액 한 칸")가 변한다. 별도 테이블이면 기존 표면 전부가 자동 무접촉이다. |
| **B. `budgets`에 jsonb 컬럼(`category_amounts`)** | 마이그레이션은 additive지만 ① 행 단위 검증(카테고리 실재·양수 정수)이 DTO에만 남고 DB가 아무것도 지키지 못한다 ② 감사 봉투의 before/after diff가 불투명한 blob 비교가 된다 ③ 향후 서버 집계(카테고리 예산 통계)가 불가능하다. 이 저장소의 스키마는 jsonb 사용자 데이터 선례가 없다. |
| **C. 카테고리 예산을 기기 로컬(zustand persist)만** | 예산은 이미 서버 자원이고 가족 공유 값이다(공동 가구 양쪽이 같은 기준선을 봐야 하고, 그래서 총액 예산에 감사 봉투까지 있다). 기기에만 있으면 부부의 리포트가 서로 다른 "예산 대비"를 말한다 — 라운드 100 대안 D 기각과 같은 논리. |
| **D. 카테고리 축을 8타일 별칭 id로** | 별칭 행은 CAT-124가 "선택지로 내밀지 않는다"고 결정한 행이고(`selectable:false`), 수정 화면·가져오기 지출은 정식 id로 저장된다. 예산의 축은 사용자가 **고르는** 축이어야 하므로 기록 탭 칩과 같은 모집단(정식 선택 가능 행)이 맞다 — 별칭↔정식 이원은 저장 축이 아니라 **사용액 합산 축**의 문제이고, 그것은 §5.1의 가족 합류가 푼다. |

### 1.2 컬럼별 결정

- **금액**: int4, DTO에서 `1..MONEY_KRW_MAX`(지출·총액 예산과 같은 단일 상수 — GAP-054 #2의 교훈 그대로). 0원 예산은 존재하지 않는다 — "그 카테고리 예산 없음"은 행의 부재다(0을 허용하면 "0원 예산"과 "미설정"이라는 두 침묵이 생긴다).
- **월 키**: `budgets.year_month`와 같은 `date` + first-day CHECK. 요청 정규화도 같은 자리(`normalizeYearMonthInput` → `getSeoulMonthRange`)를 그대로 지난다 — 새 정규화 코드 0건.
- **사용자 id 컬럼 없음**(`created_by/updated_by` 미보유): 총액 `budgets.created_by_user_id`는 "처음 만든 사람"만 알고 실제 행위자는 감사 로그가 답한다는 것이 이미 확립된 판단이다(upsertBudget 주석). 카테고리 행은 replace-set(§2.2)으로 지워지고 다시 서므로 행 내 작성자는 더더욱 무의미하고, 무엇보다 **사용자 물리 파기의 참조 차단 검사에 새 자리를 만들지 않는다** — `budgets.created_by_user_id`는 오늘 사용자 파기를 막는 NOT EXISTS 목록에 있고(purge job:1231), custom_items는 그 목록 편입에 T1 체크리스트가 필요했다(라운드 100 §1.5 R2). 이 표는 그 표면 자체가 없다. 행위자·시각은 기존 `budget.upsert` 감사 봉투가 답한다(§2.6).
- **soft delete 없음**: 총액 `budgets`와 같은 판단 — 덮어쓰기/삭제의 이력은 감사 봉투(before/after)가 진다. DNC-014는 **지출** soft delete 계약이고 예산은 이미 그 밖이다(budgets에 deleted_at이 없다).
- **version 없음**: 총액 예산과 같은 축(마지막 쓰기 승리). 동시 저장 레이스는 §6.7 R1의 dirty-only 전송 규칙이 좁힌다.

### 1.3 총액 예산과의 관계: **부분 독립 — 합 제약 없음, 존재는 총액에 종속** (권고)

**(a) 합 제약을 두지 않는다.** Σ(카테고리 예산) ≤ 총액도, = 총액도 강제하지 않는다. 근거: ① 카테고리 예산은 **선택 입력**이다(§4.1 — 전부 채우기 강요 금지). 기저귀 하나에만 기준선을 두는 사용자가 정상 경로이므로 합은 거의 언제나 총액 미만이고, 등식 제약은 성립 자체가 불가능하다. ② 합이 총액을 넘는 상태도 사용자의 의도일 수 있다(총액은 빠듯하게, 카테고리는 여유 있게). 서버가 400으로 막으면 "총액을 먼저 올려야 저장되는" 순서 강제가 생기는데, 그 순서는 앱이 지어낸 규칙이다. ③ 다만 화면은 사실을 **관측 톤으로 말한다**: 합이 총액을 넘으면 예산 화면에 "카테고리 예산을 더한 값이 월 예산보다 N원 커요" 한 줄(DNC-018 해요체, 평가·권고 없음 — budget-pace의 "아껴 쓰세요 금지"와 같은 경계). 저장은 막지 않는다.

**(b) 존재는 총액에 종속시킨다 — 그리고 그 제약은 검사가 아니라 DTO 구조가 진다.** 카테고리 예산은 기존 `PUT /budget` 본문의 가산 필드로만 쓸 수 있고(§2.2), 그 본문의 `amountKrw`(총액)는 종전대로 필수다. 즉 **"총액 없는 달의 카테고리 예산"은 요청 형태상 만들 수 없고**, 별도 에러 코드도 검사 코드도 필요 없다. 이 종속이 지키는 것은 GET의 하위호환이다: `GET /budget`의 "행 없음 = 404 `BUDGET_NOT_FOUND` = 클라이언트 null"이라는 계약(§0)을 한 글자도 건드리지 않는다 — 카테고리만 있는 달이 존재할 수 있다면 404를 줄 수도(카테고리 예산이 증발) 200을 줄 수도(`amountKrw` min 1 계약 위반) 없는 딜레마가 생긴다. 총액 예산에는 삭제 경로가 없으므로(upsert뿐) 이 불변식은 생성 시점 이후 영원히 유지된다.

**(c) 이월 제안과의 합류**: 기존 "지난달 그대로" 칩(B1(b))의 규율 — 이번 달 예산이 없다고 확인된 뒤에만 지난달 1건을 조회하고, **자동 저장은 절대 하지 않는다** — 을 그대로 계승한다. §2.3의 GET 확장으로 지난달 응답에 `categoryBudgets`가 공짜로 실리므로(추가 요청 0), 그 갈래에서 "지난달 카테고리 예산 그대로" 칩 하나가 카테고리 행 전체를 **채워 넣기만** 한다(§4.2). 저장은 사람이 [저장]을 누를 때만.

### 1.4 한도

아이·월당 카테고리 예산 **30건** 상한(`CATEGORY_BUDGET_MAX_PER_MONTH`). 초과 시 400 `CATEGORY_BUDGET_LIMIT_EXCEEDED`. 근거: 정식 카테고리는 오늘 12종이고 어드민이 행을 더할 수 있으나 커스텀 카테고리는 존재하지 않는 전제(§6.5)라, 30은 분류 체계가 두 배 넘게 자라도 남는 수다. 상한이 있어야 replace-set 트랜잭션(§2.2)의 문장 수가 입력에 비례하지 않는다는 트랜잭션 대장 등재 사유(§6.3)가 값으로 선다.

### 1.5 파기(retention)와의 정합

- 아이 물리 파기: `child_id ON DELETE CASCADE` — purge job의 `child.deleteMany`가 FK 위반 없이 함께 지운다(custom_items 000022와 동일). `budgets`처럼 명시 `deleteMany` phase를 새로 만들지 **않는다** — 그 명시 phase는 budgets에 FK가 없어서 생긴 보완이지 관례가 아니다.
- 사용자 물리 파기: 이 표에 user FK가 없으므로(§1.2) `findReferenceBlockedUserIds` 계열 검사 0접촉. **라운드 100 R2와 같은 체크리스트 항목이 아예 발생하지 않는 것**이 이 컬럼 결정의 산출물이다.
- ⚠️ **T1 체크리스트**: `data-retention-purge.db.test.ts`에 "아이 물리 파기 후 category_budgets 0행" 단언 1개 추가(custom_items가 같은 라운드에 한 것과 동일). 카테고리 행 자체는 운영 시드라 파기 대상이 아니다.

---

## 2. 결정 D2 — API 계약

### 2.1 엔드포인트 (base `/api/v1` 고정, DNC-006 — **신규 엔드포인트 0**)

| 메서드/경로 | 하는 일 | 권한 | 비고 |
|---|---|---|---|
| `PUT /children/:childId/budget` (기존) | 본문에 가산 optional `categoryBudgets` — 있으면 그 달의 카테고리 예산 집합을 **통째로 교체**(§2.2) | edit | 기존 `IdempotencyInterceptor`·감사 봉투 그대로, 봉투만 가산(§2.6) |
| `GET /children/:childId/budget` (기존) | 응답에 가산 `categoryBudgets: [{categoryId, amountKrw}]`(§2.3) | 구성원 | 404 의미 불변 |
| `GET /children/:childId/reports/monthly` (기존) | 응답에 가산 `categoryBudgets`(§2.4) | 구성원 | 리포트 "예산 대비" 블록의 예산 소스 |

전용 CRUD 엔드포인트(`/budget/categories` 등)는 **두지 않는다**. 근거: ① 소비처가 예산 화면(쓰기+읽기)과 리포트(읽기)뿐이고, 두 화면 다 이미 부르는 요청이 있다 — 별도 GET을 두면 클라이언트가 두 응답을 손으로 합치고 로컬 미러도 두 벌이 된다(라운드 100 §2.1과 같은 판단). ② 별도 PUT을 두면 총액과 카테고리가 두 요청·두 감사 봉투로 갈라져, 화면의 [저장] 한 번이 부분 성공할 수 있는 상태(총액만 저장되고 카테고리 실패)가 생긴다. 한 요청·한 트랜잭션이면 그 상태 자체가 없다. ③ §1.3(b)의 존재 종속이 DTO 구조로 공짜로 성립한다.

### 2.2 PUT 확장: `categoryBudgets` 필드와 replace-set 의미론

```
바디: { yearMonth, amountKrw, categoryBudgets?: Array<{ categoryId: uuid, amountKrw: 1..MONEY_KRW_MAX }> }
```

- **필드 부재 = 무접촉.** `categoryBudgets`가 본문에 없으면 그 달의 카테고리 예산 행은 한 건도 읽지도 쓰지도 않는다 — 이것이 구클라이언트(온보딩 예산 화면 포함 — `app/(onboarding)/budget.tsx`도 같은 클라이언트 함수를 쓰고 이 필드를 싣지 않는다)와 "카테고리 카드가 렌더되지 않은 저장"(§4.1)의 하위호환 전부다.
- **필드 존재 = 그 달의 집합 교체.** 배열에 있는 (categoryId, amountKrw)는 upsert, 배열에 없는 기존 행은 삭제. 빈 배열 `[]`은 "그 달 카테고리 예산 전부 해제"다. 행 단위 DELETE 엔드포인트가 필요 없는 이유가 이 의미론이다 — 화면의 "행 비우기"가 곧 삭제다.
- **원자성**: 총액 upsert + 카테고리 교체(deleteMany + createMany)를 한 `$transaction`으로 묶는다. 문장 수는 **고정 4문장**(감사 봉투 before 채우기가 read 1문장을 더한다 — deleteMany 직전의 집합이 곧 봉투의 before여야 해서 조회가 트랜잭션 안이다(§2.6) · 총액 upsert · deleteMany 한 건 · 상한 30으로 잘린 배열형 createMany 한 건)이라 입력 크기에 비례하지 않는다 — transaction-bounds 대장 등재 사유가 이 문장이다(§6.3). ※ T1 구현 갱신(L-4): 설계 초안은 3문장으로 적었으나 before 조회가 더해져 4문장이 구현 사실이다.
- **검증 순서**: DTO 형식(uuid·정수 범위·배열 상한 30·**배열 내 categoryId 중복 = `VALIDATION_ERROR`**) → 권한(§2.7) → 카테고리 실재+`active:true` 일괄 조회(하나라도 탈락하면 400 `CATEGORY_BUDGET_INVALID_CATEGORY` — 부분 적용 없음). `selectable`은 보지 않는다 — 지출의 categoryId 검증(`requireExistingCategory`)이 그 플래그를 보지 않는 것과 같은 선이되, `active:false`(운영자가 숨긴 행)는 **새로 세울 수 없다**(§6.5의 상호작용 규칙).
- 응답: 종전과 같은 예산 DTO에 §2.3의 가산 필드가 실린 것.

### 2.3 GET 확장

`GET /budget` 응답(200 갈래)에 `categoryBudgets: [{categoryId, amountKrw}]`를 항상 싣는다(없으면 `[]`). 정렬은 `categoryId` 오름차순 — 결정적이기만 하면 된다(화면 정렬은 §4.1의 칩 대장 순서가 지고, 서버가 displayOrder 조인을 하나 늘릴 이유가 없다). **행별 `usedAmountKrw`는 싣지 않는다** — 서버가 원 id 단위 합계만 정직하게 알고, 별칭/정식 이원(§0)의 가족 합류는 클라이언트 모집단 지식이기 때문이다. §5.1이 이 결정의 본문이다.

404 갈래(총액 없음)는 종전 그대로다 — §1.3(b)의 불변식 덕에 그 달에는 카테고리 행도 구조적으로 없다.

### 2.4 월간 리포트 확장

`GET /reports/monthly` 응답에 같은 모양의 `categoryBudgets`를 가산한다(그 달 행, 없으면 `[]`). 근거: 리포트 화면은 이미 `monthly` 조회(`budgetAmountKrw` 포함)와 도넛의 카테고리 분해 조회를 갖고 있다 — 예산 대비 블록(§4.3)의 재료 두 벌이 **기존 두 응답에 각각 실리므로 새 요청이 0건**이다. `getMonthlyReport`의 기존 `Promise.all`에 `categoryBudget.findMany` 하나를 더한다. 과거 달 조회도 그대로 동작한다(예산 표는 월 키로 남는다 — GAP-066의 끝난 달 예산 한 줄과 같은 성질). 추이(`/reports/trend`)·연간·누적·홈에는 싣지 않는다(소비처 없음 — 없는 소비처를 위해 페이로드를 늘리지 않는다).

### 2.5 에러 코드는 §9.3, 계약 타입은 §9.1이 확정한다.

### 2.6 감사 로그

기존 `budget.upsert` 봉투를 가산한다: 요청에 `categoryBudgets`가 있을 때만 before/after 각각에 `categoryBudgets: [{categoryId, amountKrw}]`(categoryId 오름차순 — diff가 안정되게)를 싣는다. 새 action을 만들지 않는 이유: 저장은 화면에서도 서버에서도 **한 번의 예산 저장**이고, 봉투가 갈라지면 "누가 언제 얼마에서 얼마로"라는 원래 질문(GAP-063 #5)에 두 행을 대조해야 답하게 된다. 필드가 없던 저장의 봉투는 종전과 바이트 단위로 같다(기존 감사 조회 화면·테스트 무접촉). 카테고리 id는 운영 시드 식별자라 PII가 아니다(기존 "금액·연월·childId만" 규칙 유지).

### 2.7 권한·멱등

- 쓰기: 기존 PUT의 `requireChildAccess(user, childId, /*edit*/ true)` 그대로(owner/co_parent). 모바일 입구도 기존 `useExpenseEntryGate` 잠금이 같은 저장 버튼을 이미 지키고 있어 **새 판정 0건**.
- 읽기: 구성원 전원(기존 GET 그대로).
- 멱등: 기존 `IdempotencyInterceptor` + PUT replace-set의 자연 멱등(같은 본문 재전송 = 같은 결과). 클라이언트 재시도 배관 신설 없음.

---

## 3. 결정 D3 — 로컬 미러 패리티 (standalone 전 기능 동작)

### 3.1 상태·함수 (`local-backend.ts` — 실측 §0의 기존 budgets 경로와 같은 모양으로)

- `LocalBackendState`에 `categoryBudgets: Record<string, Record<string, number>>`(정규화월 → categoryId → 금액) 추가. 기존 `budgets: Record<string, number>`와 같은 축이다 — **아이 축이 없는 것도 동일**하다(로컬 세션 단일 아이 전제, §0 실측. 미러가 원본보다 정교해질 이유가 없고, 아이 프로필 재생성 wipe(`local-backend.ts:2632` 계열)에 `categoryBudgets: {}`를 나란히 넣는다). `initialState`는 `{}`, `sanitizeLocalBackendState`는 비객체/오염 blob → `{}`(멤버·customItems 관례). persist version 유지 — 필드 가산은 merge가 기본값으로 메운다(라운드 100 §3.1과 같은 판단).
- `upsertBudget(childId, amountKrw, yearMonth, categoryBudgets?)`: 서버 §2.2 미러 — 인자 부재면 무접촉, 존재면 그 달 맵을 통째로 교체. 검증(양수 정수·`requireMoneyKrw`·상한 30·중복 id 거절)도 미러.
- `getBudget` / `getMonthlyReport`: 응답에 `categoryBudgets` 배열(categoryId 오름차순) 가산. **서버와 미러의 규칙이 문장 하나로 같아야 한다**: "필드 부재 무접촉 · 존재 시 그 달 집합 교체 · 응답은 categoryId 오름차순 배열" — T2가 자기 테스트로 양쪽 규칙을 같은 픽스처로 고정한다(라운드 100 R5와 같은 드리프트 대응).
- 카테고리 실재 검증은 로컬 픽스처 카테고리 목록(`listCategories`가 서빙하는 그 목록)에 대해 수행 — 데모에서도 "아무 문자열이나 예산 키가 되는" 상태를 만들지 않는다.

### 3.2 데모 픽스처: **0건**

카테고리 예산은 사용자 데이터다. 프로덕션 `ensureSeeded`는 사용자 데이터를 만들지 않으므로(실기기 피드백 1 이후 규약) 픽스처를 심지 않는다. 기존 테스트 헬퍼 `seedLocalDemoFixturesForTests`(총액 예산을 심는다)에 카테고리 예산을 **더하지 않는다** — 필요한 테스트가 자기 arrange에서 `upsertBudget`을 부르면 된다.

### 3.3 오프라인: **총액 예산과 같은 급 — 서버 직행, 아웃박스 없음**

총액 예산 저장이 이미 아웃박스를 타지 않는 서버 직행 쓰기다(라운드 52 C-07 — 오프라인이면 오프라인이라고 말한다). 카테고리 예산은 같은 요청의 같은 필드이므로 **같은 실패 문구 경로(`useSaveErrorCopy`)를 공짜로 탄다**. 로컬 세션은 네트워크가 없어도 전부 동작한다(§3.1). 별도 재시도 큐 없음.

---

## 4. 결정 D4 — UI

### 4.1 예산 화면(`app/budget.tsx`): "카테고리별 예산" 카드 — 선택 입력

세션 렌더의 "새 예산" 카드 **아래**에 카드 하나. 구성:

- 머리: 제목 "카테고리별 예산" + 캡션 **"원하는 카테고리에만 정해도 돼요."** — 선택 입력임을 문장이 직접 말한다(전부 채우기 강요 금지가 이 라운드의 요구이고, 빈 행은 그냥 빈 행이다).
- 행 모집단: `["categories"]` 캐시를 **이 화면이 직접 채운다** — `useQuery({queryKey: ["categories"], queryFn: () => listCategories(authToken!, { includeAll: true }), staleTime: 5*60*1000 })`(리포트 화면과 같은 형식 — `categories-cache-contract` 스윕이 요구하는 includeAll 규약 준수, §6.3). 행은 `buildRecordsCategoryChips(categories.data?.categories)`가 준 칩 대장(정식 선택 가능 행 + matchIds 가족)에서 만든다 — **단, 목록이 아직 없으면(로딩·실패·오프라인 첫 실행) 카드 자체를 그리지 않는다**(모르면 제안하지 않는다). 이 게이트가 칩 모듈의 8타일 폴백 갈래(목록 부재 시)를 구조적으로 차단해, 별칭 id로 예산이 저장되는 경로가 없다. 이미 예산이 있는 categoryId가 칩 대장에 없으면(운영자가 숨긴 카테고리 등) 그 행을 이름 해석(`buildCategoryNameLookup`)과 함께 **끼워서 유지**한다 — `selectableCategories` 규칙 (d)("현재 값은 언제나 남긴다")와 같은 판단.
- 행 하나: 카테고리 이름 + 금액 입력(`amountDigitsOnly`/`formatAmountDigits` — 총액 입력과 같은 money 모듈, `isAmountOverLimit` 같은 상한·같은 문구). 값 비우기 = 그 카테고리 예산 해제. a11y 라벨은 "{이름} 예산 입력".
- 관측 한 줄: 채워진 행 합이 총액(입력 중 값 우선, 없으면 현재 예산)보다 크면 "카테고리 예산을 더한 값이 월 예산보다 N원 커요"(§1.3(a) — 저장은 막지 않는다).
- 저장: **기존 [저장] 버튼 하나 그대로.** mutation 본문에 `categoryBudgets`를 싣는 조건은 "카테고리 카드가 렌더됐고 **사용자가 행을 하나라도 고쳤다**(dirty)" — 고치지 않은 저장은 필드 부재로 서버 무접촉이다(§6.7 R1: 두 기기 동시 편집에서 총액만 고친 저장이 남의 카테고리 예산을 낡은 프리필로 덮는 레이스를 없앤다). dirty면 **화면에 보이는 전체 집합**을 싣는다(replace-set 계약). 판정·행 조립·문구·조사·합 비교는 전부 순수 모듈 `src/home/category-budget-form.ts`가 소유하고 화면은 그린다(저장소 확립 규율). 신규 `useMutation` 없음(기존 save 하나 확장) — press-guard 무접촉.
- 성공 무효화는 종전 `["budget"],["home"],["report"]` 그대로 — 리포트 블록(§4.3)이 `["report"]`에 걸려 자동 갱신된다. 추가 키 0건.

### 4.2 이월·제안 칩 합류

- 기존 4계열 칩(±10만·지난달 실지출·지난달 그대로·최근 평균)은 **총액 입력 전용 그대로**(0접촉).
- 카테고리 카드 안에 칩 하나: **"지난달 카테고리 예산 그대로"** — 서는 조건은 기존 이월 칩과 같은 defer 갈래다(이번 달 총액 예산 null → `lastMonthBudget` 조회가 이미 켜져 있음) + `lastMonthBudget.data.categoryBudgets`가 1건 이상 + 이번 달 카테고리 행이 전부 빈 상태. 누르면 행들을 **채워 넣기만** 한다(자동 저장 없음 — B1(b)의 "사용자가 정한 적 없는 예산을 앱이 지어내지 않는다" 그대로). 추가 요청 0건(§2.3이 지난달 응답에 이미 실어 준다). 카테고리별 "최근 3개월 평균" 제안은 만들지 않는다(§7).

### 4.3 리포트: 도넛 아래 "카테고리 예산" 블록 — 월간 탭 전용, 관측 톤

- 위치: 도넛 카드(+드릴다운 안내 줄) **아래**, `hasSession && period === "월간"`이고 그 달 `monthly.data.categoryBudgets`가 1건 이상일 때만. 분기·연간에 없는 이유는 끝난 달 예산 한 줄(GAP-066)이 이미 확정한 문장 그대로다 — "예산은 (아이, 월) 한 칸이라 세 달·열두 달을 합친 예산이라는 것이 존재하지 않는다".
- **도넛 조각(범례 줄)에 직접 주석을 달지 않는다** — 채택하지 않은 대안으로 명기한다: ① 조각은 **원 id 단위**라 별칭 "기저귀"와 정식 "기저귀/위생"이 두 줄로 설 수 있는데, 가족 예산 하나를 어느 줄에 달아도(또는 양쪽에 달아도) 사실이 비틀린다. ② `DonutChartCard`는 공용 컴포넌트(`ui.tsx`)이고 비세션 장식 분기가 REP-001 픽셀락 원본이다 — 범례 줄 구조 변경은 접촉 면적 대비 얻는 게 없다. ③ 범례 줄은 이미 드릴다운 버튼이라(C-03) 한 줄에 의미를 더 싣지 않는다(카테고리 추이 카드가 "두 동작이 한 줄에 겹치지 않도록" 자기 칩을 둔 것과 같은 판단).
- 행 하나(예산이 있는 카테고리만): `"{이름} {사용액} / 예산 {예산액}"` + 보조 한 줄. 사용액은 §5.1의 가족 합류 값(도넛과 같은 응답에서 접는다 — 두 숫자의 모집단이 같다). 퍼센트·초과 판정은 **`evaluateHomeBudgetProgress` 재사용**(홈 히어로·인사이트·끝난 달 한 줄과 같은 함수 — 내림·미소진 100% 금지 캡이 그 안에 있다, 판정 두 벌 금지). 초과 행의 보조 줄은 **"예산보다 N원 더 썼어요"** — 관측 사실만(DNC-018: "아껴 쓰세요"류 지출 억제 권고 금지, budget-pace 헤더의 그 경계). 색으로만 말하지 않는다(문장이 의미를 진다 — budget-warning의 관례).
- 조립은 순수 모듈 `src/reports/category-budget-usage.ts`: 입력(칩 대장·카테고리 분해·categoryBudgets) → 행 목록(이름·사용액·예산·퍼센트·문장·a11y 라벨). 화면은 그린다.
- 대기(오프라인) 행 고지: 화면 머리의 기간 고지(`pending-scope-notice`)가 같은 달의 아래 숫자 전부를 이미 덮는다 — 이 블록이 다시 말하지 않는다(끝난 달 예산 한 줄이 내린 것과 같은 판단).

### 4.4 홈 경고는 **총액 유지** — 카테고리 경고를 홈에 만들지 않는 근거 (명기)

1. **TOSS-T2 완화 규율의 방향과 정면 충돌.** 그 변경 요청은 홈의 예산 발화를 **줄이는** 쪽으로 승인됐다 — 넛지 카드 은퇴(#5), 경고 배너 활성 중 월말 예상 카드 강등(#9, "예산 3중 발화 완화"). 카테고리 경고를 홈에 더하면 같은 80~99% 구간에서 배너가 카테고리 수만큼 늘어나는, 정확히 그 규율이 걷어낸 상태의 N배 재현이다.
2. **부분 커버리지 위에서 경고는 총액과 다른 급의 사실이다.** 총액 경고는 전 지출을 덮지만 카테고리 예산은 선택 입력(§1.3)이라, 홈이 "기저귀 예산 초과"를 외치는 동안 예산 없는 카테고리의 더 큰 지출이 조용할 수 있다 — 홈 한 줄 요약으로는 오독을 만든다. 관측·비교가 목적이면 그 자리는 리포트다(§4.3).
3. **경고 3표면의 단일 판정 계약을 흔든다.** 홈 배너·인앱 알림·서버 푸시는 `reachedBudgetBoundaries` 하나를 공유하고, 푸시는 `push_boundary_marks` (아이,월,경계) 유니크 클레임으로 at-most-once를 지킨다. 카테고리 경고를 어느 한 표면에만 더하면 세 표면이 다시 갈라지고, 셋 다 더하려면 클레임 테이블 확장(경계 축에 카테고리 추가)이 필요한 별도 설계다 — §7 이월.

따라서 이 라운드에서 `budget-warning.ts`·`generators.ts`·`push-dispatch.service.ts`·`budget-boundary.ts`·홈 화면은 **전부 0바이트**다.

---

## 5. (통합) 없는 것을 지어내지 않는 표면 정리

### 5.1 사용액 합류 — 서버는 원 id 사실만, 가족 합류는 클라이언트 단일 소스

빠른 기록 지출은 별칭 id로, 수정·가져오기 지출은 정식 id로 저장된다(§0). 예산은 정식 id에 세워지므로(§1.1 대안 D), "그 카테고리에 쓴 돈"을 정식 id 완전 일치로만 합하면 퀵타일 지출이 통째로 빠진 **가짜 사용액**이 된다. 해소는 이 저장소가 이미 확립한 정체성 규칙 하나를 재사용한다:

- 서버는 카테고리 분해를 종전대로 **원 id 단위로만** 준다(§2.3에서 행별 usedAmountKrw를 뺀 이유 — 별칭↔정식 매핑(`categoryCatalog`의 code 다리)은 모바일 소유 지식이고, 서버에 그 사본을 만들면 라운드 63 #9가 경고한 이중 소스다).
- 클라이언트는 `buildRecordsCategoryChips`의 `matchIds`(자기 id + 같은 이름 + 같은 code의 퀵타일 id)로 예산 행의 사용액을 접는다: `사용액 = Σ categoryTop[categoryId ∈ matchIds]`. 기록 탭에서 "기저귀/위생" 칩을 누르면 보이는 그 지출들의 합이 곧 그 예산의 사용액이다 — **필터가 보여주는 것과 예산이 세는 것이 같은 집합**이라는 것이 이 설계의 정직성이다.
- 방향 주의: 이 합류는 정식 칩으로의 **합집합**이라 모호하지 않다. 라운드 39 I-1이 침묵시킨 모호성은 반대 방향(정식 code 하나를 특정 타일 하나로 지목)이었고, 여기서는 발생하지 않는다. 귀결 하나를 그대로 받아들인다: "수유/이유식" 예산은 "분유/유제품"과 "식비" 타일 지출을 함께 센다 — 기록 탭 칩이 이미 정확히 그렇게 거르므로, 다르게 굴면 그쪽이 설명 불가다(라운드 100 §1.3의 24개월+ 중복과 같은 형식의 수용).

### 5.2 표면별 정리

| 표면 | 카테고리 예산에서 | 방식 |
|---|---|---|
| 행별 사용액(서버) | 싣지 않음 | §5.1 — 서버가 모르는 합류를 지어내지 않는다 |
| 예산 없는 카테고리 | 리포트 블록에 행 없음 | 사용자가 정한 적 없는 기준선을 만들지 않는다 |
| 분기·연간 "카테고리 예산" | 없음 | 월 한 칸 합성 금지(GAP-066 문장 인용, §4.3) |
| 홈·푸시·인앱 알림 | 0접촉 | §4.4 |
| 초과 문구 | "예산보다 N원 더 썼어요" 관측만 | DNC-018 톤 경계(§4.3) |
| 합>총액 | 관측 한 줄, 저장 허용 | §1.3(a) |
| 카테고리 목록 부재 | 카드 미렌더 | 모르면 제안하지 않는다(§4.1) |

---

## 6. 경계·리스크

### 6.1 DNC 접점 명시

- **DNC-007**: `budgets` 표·유니크·의미 전부 무변경(별도 표 + 응답/본문 가산). `audit_logs`는 기존 action의 봉투 가산 — additive.
- **DNC-013/015**: 금액은 양수 원화 정수 한 벌(`MONEY_KRW_MAX` 공유), 사용액 술어는 기존 `categoryBreakdown`(= `countsTowardMonthlyTotal` 미러, 선물·환불 제외) **재사용 — 새 술어 0건**. 리포트 블록·도넛·기록 탭 필터가 같은 모집단을 말한다.
- **DNC-009/010/011**: 커머스 표면 0접촉(추천·링크·고지의 입력에 예산이 들어갈 자리 자체가 없다).

### 6.2 준비율·페이스·제안 모듈과의 관계

- `budget-pace.ts`·`budget-suggestion.ts`·`budget-warning.ts`·`budget-progress.ts`: **판정 함수 무접촉**. `evaluateHomeBudgetProgress`는 리포트 블록이 읽기 전용 import로 재사용할 뿐이다(§4.3).
- 카테고리별 페이스/평균 제안은 v1 범위 밖 권고(§7) — 카테고리 하나의 월 표본은 며칠에 지출 두어 건이라 외삽 게이트(`MIN_ELAPSED_DAYS` 계열)로도 지어낸 숫자를 못 막고, 평균 제안은 카테고리×월 매트릭스 집계라는 새 엔드포인트가 필요하다.

### 6.3 대장(스윕) 예상 반응과 준수 규칙

| 그물 | 예상 반응 / 각 트랙의 의무 |
|---|---|
| **categories-cache-contract**(전역) | budget.tsx가 `queryKey: ["categories"]` 소비처로 새로 잡힌다 — `listCategories(..., { includeAll: true })` 형식이면 그대로 초록(§4.1). 기본 12행 목록으로 채우는 순간 빨강. |
| **shared-cache-policy** | `["budget"]` 선언 전수의 childId 스코프 계약 유지(신규 budget 키 없음 — 기존 키 재사용). `["categories"]` 소비처 증가는 walk가 자동 수용. 상수 경유 무효화 0건 유지. |
| **transaction-bounds(api)** | T1의 replace-set `$transaction` 1자리 신규 — **명시 상한을 주거나 대장 등재**(둘 중 하나, 아니면 빨강). 등재 사유(T1 구현 사실로 갱신 — L-4): "**고정 4문장**(감사 before 조회 findMany 한 건 · 총액 upsert · deleteMany 한 건 · 상한 30으로 잘린 createMany 한 건)이고 입력 크기에 비례하지 않는다"(§2.2 — `confirmChildProfileDeletion` 등재와 같은 기준). 대장 편입으로 기존 `onboarding-core.service.ts#1`(confirmChildProfileDeletion) 키는 `#2`로 밀렸다(파일 내 순번 키). |
| **사문 대장 / 라운드 95 공통 금지** | 새 export는 같은 라운드에 제품 호출부 필수. **모바일 새 `export const` 0건**(함수형/계약 소유) — 상수는 contracts가 갖고 모바일은 자기 상수+대조(관례). T3 새 모듈 2개는 배선 커밋과 한 트랙. |
| **contracts-mirror(mobile)** | 새 계약 스키마는 `.object({` 머리 형태로 적는다(파서 규약 — 라운드 100이 `.partial()`에서 배운 것). `CATEGORY_BUDGET_MAX_PER_MONTH` 미러+두 방향 대조를 T2가 싣는다. |
| **korean-particle-guard** | 카테고리 이름이 들어가는 새 문장은 이름 뒤 조사를 피하는 형태로 설계했다(§4.3 행 형식 — 이름은 문두 명사구). 조사가 필요한 문장을 만들게 되면 `korean-particles.ts` 판정 필수. |
| **mutation-press-guard** | 신규 `useMutation` 0(기존 save 확장) — 대장 무접촉. |
| **route-surface** | 신규 라우트 0 — 카드·블록은 화면 내 구성. |
| **색 리터럴(DNC-017)** | 신규 색상 리터럴 0 — theme 토큰만(초과 행도 색이 아니라 문장이 의미를 진다). |
| **loading-skeleton / refresh-wiring / screen-phase / keyboard-tap-guard** | contains형 — 기존 요구 문자열 유지 책임은 각 트랙. 예산 화면 카테고리 카드의 키보드 위 탭은 기존 시트 선례의 `keyboardShouldPersistTaps` 형식. |
| **repo-self-description(test-utils)** | 이 문서는 `docs/5차/round*` 라운드 노트 분류라 재개 조건 대장 면제 축(그 파일 주석 명시). 검증 완료(§10). |

### 6.4 아이 전환·다자녀

서버 행은 child 소유이고, 화면이 읽는 키(`["budget", childId]`·`["report","monthly",childId,ym]`)는 이미 childId 스코프 + `CHILD_SCOPED_QUERY_KEY_PREFIXES` teardown 대상이다 — 아이 전환 배선 신규 0건. 로컬 미러의 아이 축 부재는 기존 budgets와 같은 알려진 한계로 명기(§3.1).

### 6.5 카테고리 숨김 플래그(active)와의 상호작용

- **신규 거부**: `active:false` 카테고리에는 예산을 새로 세울 수 없다(§2.2 검증 — 숨긴 분류를 선택지로 되살리지 않는다).
- **기존 유지**: 이미 세워진 예산 행은 지우지 않는다(사용자가 정한 사실). 리포트 블록·예산 화면에서 이름은 includeAll 전량 목록이 계속 해석한다(R28-F3이 지출 이름에 확립한 그 규칙). 예산 화면에서는 행이 남아 값 수정·해제가 가능하다(§4.1의 끼워 유지).
- **커스텀 카테고리 부재 전제**: 사용자는 분류를 만들 수 없다 — 모집단은 운영 시드뿐이므로 상한 30(§1.4)과 칩 대장 재사용이 성립한다. 이 전제가 깨지는 라운드는 이 절을 재론해야 한다.

### 6.6 픽셀락 무접촉 전략

- 예산 화면(BUD-001)은 캡처 아홉에 없다(라운드 71 표기 정정 — §0). 그래도 카테고리 카드는 세션 갈래(`authToken` 존재) 아래에만 세운다 — 비세션은 캐시를 읽지도 않는 기존 구조 그대로.
- 리포트(REP-001)는 캡처 대상이다: 블록의 게이트가 `hasSession && period === "월간"` + 세션 쿼리 데이터이므로 비세션 미리보기 분기에 닿지 않는다(카테고리 추이 카드가 같은 방식으로 증명한 형식 인용). `DonutChartCard`·`pixelLock/`·`theme.ts` 0바이트.

### 6.7 리스크 목록 (요약)

| # | 리스크 | 크기 | 대응 |
|---|---|---|---|
| R1 | 두 기기 동시 저장에서 replace-set이 남의 카테고리 편집을 덮음 | 중 | dirty-only 전송(§4.1)으로 "카테고리를 안 고친 저장"은 구조적으로 무접촉. 잔여 레이스는 총액과 같은 마지막 쓰기 승리 + 감사 봉투가 이력을 진다(§2.6) |
| R2 | 별칭/정식 가족 합류 규칙 드리프트(예산 사용액 vs 기록 탭 필터) | 중 | 합류 소스를 `buildRecordsCategoryChips` **하나**로 고정(§5.1) — 새 매핑 코드 0건. T3 모듈 테스트가 "칩 matchIds 합 = 블록 사용액"을 같은 픽스처로 문다 |
| R3 | GET 404 의미와 카테고리 예산의 충돌(총액 없는 달) | 하 | DTO 구조 봉인(§1.3(b)). e2e: "총액 없는 달 GET = 종전 404 그대로" + "categoryBudgets 없는 PUT = 기존 행 무접촉" |
| R4 | 트랜잭션 대장 신규 자리 미등재로 스윕 빨강 | 하 | §6.3에 등재 사유 초안까지 — T1 프롬프트에 복사 |
| R5 | 구클라이언트/온보딩 화면 PUT이 카테고리 예산을 지움 | 하 | 필드 부재 = 무접촉 계약(§2.2) — e2e로 고정 |
| R6 | 숨긴 카테고리의 예산 행 표시 혼란 | 하 | §6.5 규칙(신규 거부·기존 유지·includeAll 이름 해석) |
| R7 | 합>총액 상태를 오류로 오독한 문의 | 하 | 관측 한 줄이 사실을 말한다(§1.3(a)) — 막지 않는 것이 의도임을 문구·문서가 남긴다 |

---

## 7. 범위 밖으로 미룬 것 (사유 명기)

| 후보 | 사유 |
|---|---|
| 카테고리 예산 홈 경고·인앱 알림·푸시 | §4.4 — TOSS-T2 완화 규율 역행 + `push_boundary_marks` 클레임 축 확장(at-most-once 계약)이 별도 설계 |
| 카테고리별 페이스(월말 예상)·최근 평균 제안 칩 | 표본 부족 외삽 = 지어낸 숫자, 평균은 카테고리×월 신규 집계 엔드포인트 필요(§6.2) |
| 서버 행별 usedAmountKrw | 별칭/정식 합류가 클라이언트 소유 지식 — 서버 사본은 이중 소스(§5.1). 재론 조건: 매핑이 서버로 승격되는 날 |
| 도넛 범례 줄 직접 주석 | §4.3 기각 3근거(원 id 이원·공용 컴포넌트/픽셀락·드릴다운 겹침) — 별도 블록 채택 |
| 카테고리 예산 자동 이월 | 제안 칩만(§4.2) — 자동 저장은 사용자가 정한 적 없는 값의 날조(B1(b) 원칙) |
| 분기·연간 카테고리 예산 | 월 한 칸 합성 금지(§4.3) |
| 예산 화면 행별 사용액 표시 | 관측 표면은 리포트로 일원화 — 예산 화면에 넣으려면 분해 응답 구독이 하나 더 필요하고, 콜드 스타트에서 모르는 값을 0으로 말하게 된다 |
| 오프라인 대기 행의 카테고리별 재조정 | 기간 고지(pending-scope-notice)가 이미 같은 달을 덮는다(§4.3) — 행 단위 재조정은 비용 대비 이득 없음 |
| 커스텀 카테고리 | DNC-001/016 인접 + 분류 체계는 운영 시드 소유(§6.5 전제) |
| 어드민 노출(카테고리 예산 통계) | 개인 데이터 표면 신설 — 개인정보 검토 선행(라운드 100과 동일) |
| 저장 analytics 이벤트 | 페이로드 설계(금액 비탑재 등, ANA-103 관례) 포함 후속 |

---

## 8. 트랙 분할 (T1 / T2 / T3)

**계약은 이 문서 §9가 확정한다** — 세 트랙은 서로의 코드가 아니라 §9만 본다. 파일 교집합 공집합.

| 트랙 | 소유 파일 | 테스트 요구 | 비고 |
|---|---|---|---|
| **T1 api** | `prisma/migrations/000023_category_budgets/` · `prisma/schema.prisma`(CategoryBudget 모델) · `onboarding/dto/upsert-budget.dto.ts`(중첩 DTO 가산) · `onboarding/onboarding-core.service.ts`(upsertBudget/getBudget 확장) · `onboarding/budgets.controller.ts`(봉투 가산 배선) · `onboarding/reporting-store.service.ts`(getMonthlyReport 가산) · `test/category-budgets.e2e.test.ts`(신규) · `test/transaction-bounds.test.ts`(대장 1행) · `test/data-retention-purge.db.test.ts`(단언 1개) | e2e: replace-set(교체·빈 배열 해제)·필드 부재 무접촉(R5)·총액 없는 달 404 불변(R3)·검증(중복 id·비활성/미존재 카테고리·상한 30·금액 범위)·권한(viewer 403)·멱등 재전송·감사 봉투 가산·월간 리포트 가산·아이 파기 캐스케이드(R2 아님 — §1.5) | DTO는 class-validator 자체 선언(contracts 신규 심볼 import 0 — T2와 독립) |
| **T2 contracts + client + local-backend** | `packages/contracts/src/schemas.ts`(가산) · `apps/mobile/src/api/client.ts`(타입 가산 + upsertBudget 5번째 인자) · `local-backend.ts`(상태·sanitize·upsertBudget/getBudget/getMonthlyReport) · `contracts-mirror.test.ts`(상수 대조) · `local-backend` 계열 테스트 | zod 파스(가산 optional 두 스키마 위치) · 미러: 교체/부재 무접촉/빈 배열/상한/검증/응답 정렬(서버 규칙 §2.2를 같은 픽스처로) · sanitize(오염 blob → `{}`) · 상수 두 방향 대조 | |
| **T3 UI** | `app/budget.tsx`(카테고리 카드 + categories 쿼리 + dirty 전송) · `src/home/category-budget-form.ts`+`.test.ts`(신규 — 행 조립·검증·문구·이월 칩 판정·합 관측·a11y) · `app/(tabs)/reports.tsx`(블록 배선) · `src/reports/category-budget-usage.ts`+`.test.ts`(신규 — 가족 합류·퍼센트·문장) · 배선 테스트(가드된 슬라이스) | 모듈 테스트(금액 가드 단일 소스·빈 행=해제·칩 defer 조건·matchIds 합류=칩 필터 동치(R2)·관측 문구 해요체·초과 관측 톤) · 배선 테스트(세션 갈래 한정·REP-001 비세션 무접촉·["categories"] includeAll) · 기존 스윕 전체 그린 | `budget-warning/pace/suggestion/progress`·`DonutChartCard`·`records-list-view.ts` **읽기 전용** |

**커밋 순서와 병렬성**: T1 ∥ T2 완전 병렬(교집합 0). **T3는 T2 머지 후**(client 타입·인자를 import한다). 즉 `T1, T2 → T3`. 각 트랙 머지 시 자기 필터 테스트 그린, 라운드 종료 시 `pnpm release:gate`(로컬 검증 기준 — launch-72h-plan). api 테스트는 실 PostgreSQL(`service postgresql start` 후 `wooriai_test`).

커밋 컨벤션 예: `feat(api): 카테고리별 예산 테이블·PUT 교체 의미론·리포트 가산 (R102-T1)` / `feat(mobile): 카테고리 예산 계약·클라이언트·로컬 미러 (R102-T2)` / `feat(mobile): 예산 화면 카테고리 행·리포트 예산 대비 블록 (R102-T3)`.

---

## 9. 계약 확정 (트랙 프롬프트에 그대로 넣는 절)

### 9.1 packages/contracts/src/schemas.ts 가산 (T2 소유 — 수기 단일 소스)

```ts
// 라운드 102: 카테고리별 예산. budgets(총액 한 칸, DNC-007)와 별개 테이블 category_budgets이며
// 기존 PUT/GET /budget과 GET /reports/monthly에 additive로만 실린다. 홈·푸시·경고 판정 무접촉.
// 계약 확정 원문은 docs/5차/round102-category-budget-design.md §9.
export const CATEGORY_BUDGET_MAX_PER_MONTH = 30; // 아이·월당 행 상한 (§1.4)

export const categoryBudgetEntrySchema = z.object({
  categoryId: uuidSchema,
  amountKrw: moneyKrwSchema // 1..MONEY_KRW_MAX — 0원 예산 없음(부재가 곧 미설정)
});

// budgetSchema 가산(additive optional — 구 서버 응답·구 캐시 통과):
//   categoryBudgets: z.array(categoryBudgetEntrySchema).optional()
// homeMonthlyBudgetSchema는 extend라 타입은 승계하되 서버는 홈에 싣지 않는다(§2.4).
// reportMonthlySchema 가산(같은 형태):
//   categoryBudgets: z.array(categoryBudgetEntrySchema).optional()

export type CategoryBudgetEntryDto = z.infer<typeof categoryBudgetEntrySchema>;
```

### 9.2 엔드포인트 시그니처 (T1 — DTO는 class-validator 자체 선언, 위 스키마의 미러)

```
PUT    /api/v1/children/:childId/budget            (기존 — 본문 가산) 권한: edit
       바디: { yearMonth, amountKrw,
               categoryBudgets?: Array<{ categoryId: uuid, amountKrw: int 1..MONEY_KRW_MAX }> }
       규칙: 필드 부재 = 카테고리 행 무접촉 · 존재 = 그 달 집합 교체(빈 배열 = 전부 해제)
             · 배열 상한 30 · categoryId 중복 = VALIDATION_ERROR
             · 카테고리 미존재/active:false = 400 CATEGORY_BUDGET_INVALID_CATEGORY(전체 거절)
             · 총액 upsert + 교체는 한 $transaction(대장 등재 §6.3)
       200 → 9.3의 GET 200과 같은 모양
       감사: 기존 budget.upsert 봉투 — categoryBudgets 필드가 있을 때만 before/after에
             categoryBudgets(categoryId 오름차순) 가산

GET    /api/v1/children/:childId/budget?yearMonth= (기존 — 응답 가산) 권한: 구성원
       200 → { childId, yearMonth, amountKrw, usedAmountKrw, remainingAmountKrw,
               categoryBudgets: [{ categoryId, amountKrw }] }   // 항상 배열, categoryId 오름차순
       총액 행 없음 → 종전 404 BUDGET_NOT_FOUND 그대로(§1.3(b) 불변식)

GET    /api/v1/children/:childId/reports/monthly   (기존 — 응답 가산) 권한: 구성원
       200 → { …종전 필드, categoryBudgets: [{ categoryId, amountKrw }] }  // 그 달 행, 없으면 []
```

### 9.3 에러 코드

| 코드 | HTTP | 언제 | 메시지(해요체) |
|---|---|---|---|
| `CATEGORY_BUDGET_INVALID_CATEGORY` | 400 | 배열의 categoryId가 미존재이거나 `active:false` | "예산을 세울 수 없는 카테고리예요." |
| `CATEGORY_BUDGET_LIMIT_EXCEEDED` | 400 | 배열 길이 > 30 | "카테고리 예산은 한 달에 30개까지 정할 수 있어요." |
| (기존) `VALIDATION_ERROR` / `FORBIDDEN` / `CHILD_NOT_FOUND` / `BUDGET_NOT_FOUND` | — | 형식 위반(중복 id·금액 범위 포함) / viewer 쓰기 / 아이 없음 / 총액 없는 달 GET | 기존 문구 |

### 9.4 mobile client.ts (T2)

```ts
export type CategoryBudgetEntry = { categoryId: string; amountKrw: number };
// Budget 가산:        categoryBudgets?: CategoryBudgetEntry[];
// MonthlyReport 가산:  categoryBudgets?: CategoryBudgetEntry[];

export function upsertBudget(
  token: string, childId: string, amountKrw: number,
  yearMonth?: string,
  categoryBudgets?: CategoryBudgetEntry[]   // undefined = 필드 미탑재(서버 무접촉)
): Promise<Budget>;  // local 토큰 → localBackend.upsertBudget(같은 5번째 인자)

// 상수 미러는 contracts-mirror 관례(자기 값 + 두 방향 대조 테스트) — 새 export const 대신
// 기존 관례에 맞춘 자리(client.ts의 기존 미러 상수 군)에 둔다: CATEGORY_BUDGET_MAX_PER_MONTH = 30
```

### 9.5 local-backend.ts (T2)

```ts
// state.categoryBudgets: Record<string /* budgetKey(월) */, Record<string /* categoryId */, number>>
//   initialState {} · sanitize 비객체 → {} · 아이 프로필 재생성 wipe에 {} 나란히(§3.1)
// upsertBudget(childId, amountKrw, yearMonth, categoryBudgets?):
//   인자 부재 = 무접촉 · 존재 = 그 달 맵 교체 · 검증(requireMoneyKrw·상한 30·중복 id·픽스처 카테고리 실재)
// getBudget / getMonthlyReport: categoryBudgets 배열(categoryId 오름차순) 가산 — §9.2와 같은 모양
// 데모 픽스처 0건(§3.2)
```

### 9.6 UI 확정값 (T3)

- 예산 화면: "새 예산" 카드 아래 **"카테고리별 예산"** 카드, 캡션 "원하는 카테고리에만 정해도 돼요.". 행 모집단 = `buildRecordsCategoryChips`(§4.1 — 목록 없으면 카드 미렌더, 기존 예산 행은 끼워 유지). 금액 입력은 money 모듈·`isAmountOverLimit` 재사용. 합>총액 관측 한 줄. 저장은 기존 버튼·기존 mutation — `categoryBudgets`는 dirty일 때만 탑재(전체 집합).
- 이월 칩: "지난달 카테고리 예산 그대로" — `budget.data === null` && 지난달 응답에 행 존재 && 이번 달 행 전부 빈 상태에서만, 채워 넣기 전용(§4.2).
- 리포트: 도넛 아래 블록(월간 탭·세션·행 1건 이상). 행 `"{이름} {사용액} / 예산 {예산액}"`, 사용액 = matchIds 가족 합(§5.1), 퍼센트/초과 = `evaluateHomeBudgetProgress` 재사용, 초과 보조 줄 "예산보다 N원 더 썼어요"(관측만).
- 홈·알림·푸시 0접촉(§4.4) · 신규 라우트 0 · 신규 색상 리터럴 0 · 신규 `useMutation` 0 · 모바일 새 `export const` 0(함수형/기존 미러 자리) · 배선 테스트 슬라이스는 실재 확인(`toBeGreaterThan(-1)`) 선행.

---

## 10. 검증 계획 · DNC 체크리스트

- 트랙별: 자기 신규/갱신 테스트 + `pnpm --filter api|mobile test` 그린(스윕 포함). 라운드 종료: `pnpm release:gate`. admin 0바이트(기존 그린 확인만). contracts는 T2 커밋에 포함(`pnpm --filter @wooriai/contracts test` 계열 그린).
- standalone 육안 1루프: 로컬 세션에서 총액 저장 → 카테고리 2행 저장 → 리포트 월간 탭 예산 대비 확인 → 행 하나 비워 저장(해제) → 리포트 반영 → 다음 달 시나리오에서 이월 칩 프리필.
- e2e 핵심 경계(§8 T1 열): 필드 부재 무접촉 · 빈 배열 해제 · 총액 없는 달 404 불변 · 비활성 카테고리 거절 · viewer 403 · 감사 봉투 가산 · 아이 파기 캐스케이드.
- 스윕 반응 확인(이 설계 라운드에서 실측): `cd packages/test-utils && npx vitest run src/repo-self-description.test.ts` **그린** — 이 문서는 라운드 노트 분류라 재개 조건 대장 면제 축(§6.3).
- DNC 답변(배치 보고용): screen ids preserved **yes**(신규 화면 0) · API base preserved **yes**(`/api/v1`, 신규 엔드포인트 0) · affiliate disclosure preserved **yes**(커머스 표면 0접촉) · recommendation commission excluded **yes**(추천 점수 무접촉) · import preview-before-save preserved **yes**(비접촉).
