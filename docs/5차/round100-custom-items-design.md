# 라운드 100 설계 — 커스텀 품목 추가 (사용자 직접 추가 준비물)

작성: 2026-09-06 · 기준 HEAD: `master bd35c00` · 성격: **단독 설계 라운드** (코드 변경 0바이트 — 이 문서가 산출물이다)

> 이월 근거: `docs/5차/feature-round1-design.md` §6 — *"커스텀 품목 추가 | `item_templates`는 운영 시드 소유 — 서버 스키마+계약+로컬 미러 3면 수술. 단독 설계 필요"*. 이 문서가 그 3면(스키마·계약·미러)+UI까지 네 면을 한 번에 확정해, 다음 라운드의 세 트랙(T1 api / T2 contracts+client+local-backend / T3 items UI)이 **이 문서만 보고 병렬로** 집행할 수 있게 한다. 계약 확정은 §9다.

핵심 루프와의 관계(DNC-002): 커스텀 품목은 루프의 **"시기별 준비템 확인 → 구매 후 기록/상태 체크"** 단계를 강화한다 — 카탈로그 63종에 없는 물건(친정에서 받는 아기 욕조, 산모용 특정 용품)이 목록 밖에 있으면 준비 체크리스트가 반쪽이 된다. "구매 링크 클릭" 단계는 **의도적으로 비접촉**이다: 커스텀 품목에는 상품 링크·가격대·제휴 고지가 존재하지 않고, 존재하지 않는 것을 지어내지 않는다(§5.4, §6.1).

---

## 0. 현재 구조 실측 (설계가 딛는 사실들)

| 면 | 실측 | 근거 파일 |
|---|---|---|
| 서버 카탈로그 | `item_templates`(varchar(80) name · necessity_level · category_id nullable · price/reason/safety…) + `item_template_stages`(시기), **소유자 컬럼 없음 = 전 가구 공용 운영 시드**. 어드민 CRUD·시드·링크 헬스·CSV 벌크가 전부 이 표를 무필터로 읽는다 | `apps/api/prisma/schema.prisma:294~353`, `onboarding/items-catalog.service.ts` |
| 상태 | `child_item_statuses(child_id, item_template_id UNIQUE)` + **`item_template_id`에 SQL FK `REFERENCES item_templates(id)`** — 커스텀 품목 id를 이 표에 넣을 수 없다(마이그레이션 000001). DNC-007 보호 도메인 | `prisma/migrations/000001*/migration.sql:231~242` |
| 목록 API | `GET /children/:childId/items?tab=&stageBand=` — tab 술어·정렬은 순수 모듈 `item-ranking.ts`(`rankItemsForTab`), 화면은 `tab="all"` 스냅샷 하나만 쓴다(DSN-053 P2-B) | `items-commerce/items.controller.ts`, `onboarding/item-ranking.ts`, `app/(tabs)/items.tsx:367` |
| 상태 API | `PATCH /children/:childId/items/:itemTemplateId/status {status, expenseId?}` — 모바일은 이 경로를 **오프라인 아웃박스**로 탄다(`updateItemStatusOffline` → sync-engine flush) | `offline/sync-controller.ts:433`, `offline/remote-api.ts:258` |
| 계약 | `packages/contracts/src/schemas.ts`의 `itemSummarySchema`·`itemDetailSchema`·`stageBandLabelSchema`(수기 단일 소스). 모바일은 contracts를 import하지 않고 **자기 선언 + 대조 테스트**(`contracts-mirror.test.ts`) 관례 | `schemas.ts:311~429`, `apps/mobile/src/api/client.ts:280~330` |
| 로컬 미러 | `local-backend.ts`가 같은 계약을 서빙: `listItems`(1308)·`getItemDetail`(1372)·`updateItemStatus`(1404). 카탈로그는 `localItemTemplateFixtures`(앱 콘텐츠 픽스처), 사용자 데이터는 zustand persist 상태(`itemStatuses` 등, sanitize+merge 관례). 멱등 미러 선례: `idempotencyKeys` + `createExpenseIdempotent`(MOB-102) | `local-backend.ts:204~246, 1265~1416`, `local-fixtures.ts` |
| 목록 UI | `tab="all"` 스냅샷 → 낙관 보정(`effectiveStatusItems`) → 찜/필수도/검색/출산전 필터 → `PreparationListParity`(분류 이름 그룹 + `resolvePreparationTimelineBucket` 시기 버킷). 타일 구성은 승인 디자인 잠금이지만 **타일 발밑 슬롯 `renderItemFooter`는 열려 있고 이미 메모 미리보기가 쓴다** | `app/(tabs)/items.tsx`, `preparation/catalog-contract.ts`, `PreparationListParity.tsx:248` |
| 상세 UI | `["item-detail", childId, itemTemplateId]` 조회. **링크 0건 갈래가 이미 있다**: `hasPurchasableLink`가 false면 구매 CTA·판매처 비교가 서지 않고, `productLinksDisclosureText`가 undefined면 고지도 렌더하지 않는다(은닉이 아니라 "고지할 대상 없음") | `app/items/[itemTemplateId].tsx:880~902` |
| 픽셀락 | ITEM-001/ITEM-002 캡처는 **비세션 렌더**(`app/pixel-lock.tsx`가 세션을 지우고 찍는다) — 두 화면 다 `if (!hasSession)` 프리뷰 갈래에서 세션 JSX 도달 전에 반환 | `items.tsx:814`, `[itemTemplateId].tsx:836` |
| 지출 연결 | `expenses.linked_item_template_id`에도 SQL FK `REFERENCES item_templates(id)` — 커스텀 id를 실으면 FK 위반 | `migrations/000001*/migration.sql:210` |

---

## 1. 결정 D1 — 데이터 모델: **별도 테이블 `custom_items`** (상태 내장)

### 채택안

새 테이블 `custom_items` 한 장. 소유 단위는 **아이(child)**, 상태(`item_status`)를 **행에 내장**한다(별도 상태 표 없음 — 커스텀 품목은 그 아이 하나의 것이라 (품목, 아이) 조인이 항상 1:1이다).

```sql
-- apps/api/prisma/migrations/000022_custom_items/migration.sql (초안)
CREATE TABLE IF NOT EXISTS custom_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 아이 물리 파기 시 함께 삭제 (push_boundary_marks의 000013 관례와 동일)
  child_id            uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name                varchar(80) NOT NULL,            -- item_templates.name과 같은 폭
  stage_band          varchar(20) NOT NULL,            -- "0-6개월" 등 밴드 라벨 원문 (§1.3)
  necessity_level     necessity_level NOT NULL DEFAULT 'essential',
  status              item_status NOT NULL DEFAULT 'not_prepared',
  created_by_user_id  uuid NOT NULL REFERENCES users(id),
  updated_by_user_id  uuid NOT NULL REFERENCES users(id),
  deleted_at          timestamptz,
  deleted_by_user_id  uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
-- 목록 합류가 매번 도는 조회(살아 있는 행, 생성 순) 전용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_custom_items_child_active
  ON custom_items(child_id, created_at) WHERE deleted_at IS NULL;
```

```prisma
// schema.prisma 초안 (관계 미선언 관례 — 000001 참조. SQL 전용 부분 인덱스는 주석으로)
model CustomItem {
  id              String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  childId         String         @map("child_id") @db.Uuid
  name            String         @db.VarChar(80)
  /// 사용자가 고른 시기 밴드 라벨 원문(stageBandLabelSchema 4값). 스테이지 코드로의
  /// 전개는 응답 조립 시 stagesForBand()가 한다 — 매핑을 행에 복제하지 않는다(§1.3).
  stageBand       String         @map("stage_band") @db.VarChar(20)
  necessityLevel  NecessityLevel @default(essential) @map("necessity_level")
  /// child_item_statuses.status와 같은 enum. 이 행에 내장하는 근거는 §1.2.
  status          ItemStatus     @default(not_prepared)
  createdByUserId String         @map("created_by_user_id") @db.Uuid
  updatedByUserId String         @map("updated_by_user_id") @db.Uuid
  deletedAt       DateTime?      @map("deleted_at") @db.Timestamptz(6)
  deletedByUserId String?        @map("deleted_by_user_id") @db.Uuid
  createdAt       DateTime       @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime       @updatedAt @map("updated_at") @db.Timestamptz(6)

  // SQL 전용 부분 인덱스: idx_custom_items_child_active (child_id, created_at) WHERE deleted_at IS NULL
  @@map("custom_items")
}
```

### 1.1 대안과 기각 사유

| 대안 | 기각 사유 |
|---|---|
| **A. `item_templates` 확장(소유자 컬럼 추가)** | ① 그 표를 읽는 자리가 소유자 필터 없이 전방위다 — `listItemTemplatesWithStages`(앱 목록), `adminListItemTemplates`(어드민 전량), 시드 upsert, 링크 헬스 워커, CSV 벌크, `timing-label` 검증. **한 자리라도 필터를 빠뜨리면 가구 A의 커스텀 품목이 가구 B와 어드민에 샌다**(교차 가구 데이터 유출). ② `item_template_stages`·`product_links`·`child_item_statuses`·`expenses.linked_item_template_id`의 FK가 전부 이 표를 향하므로 커스텀 행이 그 그래프에 편입돼 파기·감사·수익화 의미가 흐려진다 — DNC-007이 막는 "의미 변경"에 가장 가깝다. ③ 운영 시드 소유권 침범: 시드 리셋·어드민 표가 사용자 데이터와 한 표를 공유하게 된다. 별도 테이블이면 위 표면 전부가 **자동으로 무접촉**이다(어드민은 커스텀 행의 존재조차 모른다). |
| **B. 별도 테이블 + `child_item_statuses` 재사용** | 불가능하다 — `child_item_statuses.item_template_id`는 SQL FK로 `item_templates(id)`를 참조한다(000001). FK를 풀거나 조건부로 바꾸는 것은 DNC-007 보호 도메인의 파괴적 변경이라 변경 요청이 먼저다. 상태를 커스텀 행에 내장하면 이 표는 0바이트 무접촉이고, (childId, itemId) 유니크도 구조적으로 성립한다(행 자체가 그 쌍이다). |
| **C. 가구(household) 소유 + 아이별 상태 분리** | "같은 물건을 두 아이 목록에 한 번만 등록"이 가능해지지만, 그러려면 상태 표가 다시 분리되고(2표 + 조인) 아이 전환·파기·권한의 경계가 셋으로 늘어난다. 다자녀 가구에서 아이마다 준비물이 실제로 다른 도메인이고(둘째는 물려받아서 필요 없음), 오늘 화면·상태·준비율이 전부 아이 단위다. **아이 소유 1표**가 기존 축과 정확히 겹친다. 가구 공유 필요가 실제로 보고되면 그때 별도 결정(§7). |
| **D. 서버 없이 기기 로컬 저장(zustand persist)만** | 품목 메모(트랙 D)가 고른 길이지만 여기는 맞지 않다: 준비 상태는 이미 서버 자원이고(가족 공유 — co_parent가 함께 체크한다), 커스텀 품목이 기기에만 있으면 같은 가구의 다른 기기에서 준비율·목록이 서로 다른 거짓말을 한다. 메모는 "부가 사유"라 기기 보관 고지로 접을 수 있었지만 품목은 목록의 **구성원**이다. |

### 1.2 컬럼별 결정

- **이름**: `varchar(80)`, 트림 후 1자 이상. `item_templates.name`과 같은 폭 — 목록·상세·문장 조립이 같은 이름 필드를 지나므로 폭이 갈리면 커스텀만 넘치는 표면이 생긴다. 상한 상수는 계약이 단일 소스(`CUSTOM_ITEM_NAME_MAX_LENGTH = 80`, §9), 모바일은 자기 상수 + 대조 테스트(`text-limits`·`amount-limit` 관례). 유니크 제약은 **두지 않는다** — 같은 이름 두 건은 사용자의 자유이고(사이즈만 다른 두 벌), 유니크가 만들 409 처리 비용이 더 크다.
- **시기 밴드**: 사용자가 4밴드 칩 중 하나를 고른다(기본값 = 지금 보고 있는 칩). 저장은 라벨 원문(§1.3).
- **필수도**: 사용자가 3값 중 고른다, 기본 `essential`. 근거: 사용자가 손수 추가한 물건은 "내가 필요하다고 판단한 것"이고, essential이어야 준비율(ITEM-114)의 분모에 서서 체크가 진행률을 움직인다 — 커스텀 품목의 핵심 가치가 그 체크리스트 편입이다. `convenience` 기본의 대안은 "준비율을 건드리지 않는 안전"이지만, 그러면 추가한 품목이 준비율에 반영되지 않는 이유를 화면이 설명할 길이 없다(사용자 선언값이므로 지어낸 데이터가 아니다).
- **분류(categoryId)**: **v1 제외**(§7). 커스텀 행은 목록에서 기존 "분류 없음" 그룹(`UNCATEGORIZED_GROUP_NAME`)에 앉는다 — 이미 있는 갈래라 UI 비용 0. 나중에 nullable 컬럼 가산으로 추가 가능.
- **소프트 삭제**: `deleted_at + deleted_by_user_id` — 지출(DNC-014)과 같은 관례. 목록·상세·한도 계산 전부 `deleted_at IS NULL`만 본다.
- **감사 로그**: 삭제 시 `audit_logs`에 `custom_item.delete`(id·childId만 — **이름은 싣지 않는다**: 자유 문자열은 개인정보 밀도가 높은 축이고 파기 잡이 그런 문자열을 뒤늦게 마스킹해 온 전례가 있다 — `child_item_statuses.statusNote` 주석의 판단과 동일). 생성/수정은 로그 없음(budget upsert가 로그를 남기는 이유는 "덮어쓰면 이전 값이 사라지는 한 칸"이기 때문 — 여기는 soft delete가 이력을 지킨다).
- **version 컬럼 없음**: 상태 변경의 낙관 동시성은 `child_item_statuses`도 갖지 않는 축이다(마지막 쓰기 승리). 지출과 달리 돈이 아니고 충돌 병합 화면도 없다.

### 1.3 시기 저장: 밴드 라벨 원문 vs 스테이지 코드 배열

**밴드 라벨 원문(varchar) 채택.** 사용자가 고르는 입력이 정확히 그 4값이고(`stageBandLabelSchema` — 계약·캡처·서버 쿼리 파라미터가 함께 잠근 바이트), 응답 조립 시 `stagesForBand(label)`(서버 `items-commerce/stage-bands.ts`)로 전개해 `stageCodes`를 싣는다. 스테이지 코드 배열 저장(대안)은 `item_template_stages` 모양 미러가 되지만 ① 사용자 의도(밴드 하나)보다 넓은 표현이라 역방향 표시("어느 칩을 골랐었나")가 손실되고 ② 밴드 정의가 바뀌면 저장된 코드가 낡는다 — 라벨로 두면 전개가 항상 현행 정의를 따른다. 알려진 귀결 하나를 그대로 받아들인다: `"24개월+"`는 `toddler_1_3`을 포함하므로(의도된 중복 — 서버 표 주석) 24개월+로 등록한 품목이 12-24개월 칩에서도 보인다. **카탈로그 품목이 이미 그렇게 동작하므로** 커스텀만 다르게 굴면 그쪽이 오히려 설명 불가다.

### 1.4 한도

아이당 활성(미삭제) 커스텀 품목 **200건** 상한(`CUSTOM_ITEM_MAX_PER_CHILD`). 초과 시 400 `CUSTOM_ITEM_LIMIT_EXCEEDED`. 근거: 목록 API가 매 조회마다 카탈로그(63)+커스텀 전량을 합치므로 무상한이면 한 사용자가 자기 화면과 `tab="all"` 스냅샷을 무한히 무겁게 만들 수 있다. 200은 "임신~첫돌 체크리스트"라는 도메인에서 실사용 상한을 넉넉히 웃돈다.

### 1.5 파기(retention)와의 정합

- 아이 물리 파기: `ON DELETE CASCADE`로 함께 삭제 — privacy-policy가 요구하는 "사람이 지워지면 그 사람의 행도 지워진다"를 시간 창 없이 만족(push_boundary_marks의 논리 그대로).
- ⚠️ **T1 체크리스트**: `data-retention-purge.job.ts`의 사용자 물리 파기 경로(`findReferenceBlockedUserIds` 류)가 `created_by_user_id`/`updated_by_user_id` FK 참조를 어떻게 다루는지 확인할 것 — `child_item_statuses.updated_by_user_id`와 같은 모양이므로 기존 처리(아이 파기 선행 or 참조 차단 검사)에 이 표를 **같은 방식으로** 편입해야 한다. 확인 없이 두면 이 FK가 사용자 파기를 조용히 막는 새 자리가 된다.

---

## 2. 결정 D2 — API 계약

### 2.1 엔드포인트 (base `/api/v1` 고정, DNC-006)

| 메서드/경로 | 하는 일 | 권한 | 비고 |
|---|---|---|---|
| `POST /children/:childId/custom-items` | 생성 | edit(owner/co_parent) | `@UseInterceptors(IdempotencyInterceptor)` + `Idempotency-Key` 헤더(§2.3) |
| `PATCH /children/:childId/custom-items/:customItemId` | **속성** 수정(name/stageBand/necessityLevel) | edit | status는 받지 않는다(§2.4) |
| `DELETE /children/:childId/custom-items/:customItemId` | 소프트 삭제 | edit | 200 `{ id, deleted: true }` + audit |
| `GET /children/:childId/items` (기존) | 커스텀 행 **합류**(§2.2) | 구성원(viewer 포함) | 기존 응답 확장, 가산 |
| `GET /children/:childId/items/:id` (기존) | id가 커스텀이면 커스텀 상세 갈래(§2.5) | 구성원 | 구클라이언트 호환의 핵심 |
| `PATCH /children/:childId/items/:id/status` (기존) | id가 커스텀이면 `custom_items.status` 갱신(§2.4) | edit | 오프라인 아웃박스 무개조의 핵심 |

전용 GET 목록/단건 엔드포인트는 **두지 않는다** — 소비처가 기존 목록/상세 화면뿐이고, 별도 목록을 두면 클라이언트가 두 응답을 자기 손으로 합쳐야 하며(합류 규칙이 클라이언트마다 갈린다) 로컬 미러도 두 벌이 된다.

### 2.2 목록 합류: 기존 `items` 배열에 병합 + `isCustom` 마커 (별도 배열 기각)

`listItems` 응답의 `items`에 커스텀 행을 `ItemSummary` 모양으로 **병합**하고, 가산 optional 필드 `isCustom: true`로 표시한다.

- **탭 술어는 카탈로그와 동일하게 적용**: `all` → 전부, `prepared`/`not_needed` → `TAB_STATUSES` 그대로, `now`/`soon` → 미정리 상태에서 `isInSelectedPeriod`(전개된 stageCodes) 참/거짓. 술어를 둘로 만들지 않기 위해 커스텀 행도 `RankableItem` 모양으로 빚어 **기존 `matchesTab`을 그대로 통과**시킨다.
- **순서: 카탈로그 랭킹 결과 뒤에 커스텀을 `created_at ASC`로 덧붙인다.** 커스텀 행을 `rankItemsForTab`의 점수(시기 일치 35·필수도·상태) 안에 섞지 않는 이유: ① 그 점수는 추천 순위이고 커스텀은 추천이 아니다(사용자 본인의 항목 — 순위를 매길 근거가 없다) ② 도메인 `sortRecommendedItems`와 로컬 미러의 순서 동치 계약(`recommendation-order-mirror.test.ts`)에 새 축을 넣지 않는다. "내가 추가한 것이 목록 끝"은 예측 가능한 단순 규칙이고, 화면에서는 분류 그룹("분류 없음") 안 순서로만 나타난다.
- **별도 배열(`customItems: [...]`) 기각**: 구클라이언트는 그 배열을 통째로 무시해 커스텀 품목이 그 기기에서만 사라진다(가족 공유 불일치). 병합이면 구클라이언트에도 항목이 보이고, 탭·필터·준비율·패리티 그룹·검색이 **소비자 코드 0바이트로** 전부 동작한다(전 소비처가 `ItemSummary` 필드만 읽는다 — 실측 §0).
- `stageCodes`는 `stagesForBand(row.stageBand)` 전개값, `timingLabel`은 밴드 라벨 그대로 싣는다(카탈로그의 `timingLabel` 폴백 매칭 `itemMatchesBand`와 자연 정합). `categoryId`·`priceBandText`는 **싣지 않는다**(없는 사실).
- ⚠️ **`getHome`의 `recommendedItems`에는 합류시키지 않는다.** 합류 지점을 `listItems`(컨트롤러 경로)로 한정하고 `recommendedItemsForChild`는 무접촉 — 홈 "맞춤 추천" 카드는 커머스 표면(추천→구매 링크)이라 사용자 자신의 품목은 추천이 아니고, 홈 화면 파일은 이번 라운드 0트랙이다. (대안 "홈에도 노출"은 홈 카드가 3개 슬라이스라 커스텀이 카탈로그 추천을 밀어내는 부작용이 있어 기각.)

### 2.3 멱등 규약 (온보딩 관례 인용)

`POST /children`(MOB-101)과 같은 형식: 서버는 `IdempotencyInterceptor`를 붙이고, 클라이언트는 **입력 시트가 열릴 때 초안 단위 키 하나**를 만들어(온보딩 progress store의 `getOrCreateChildCreateIdempotencyKey` 관례) 같은 제출의 재시도에 재사용, 성공 시 폐기한다. 로컬 미러는 `idempotencyKeys` 맵 + `createExpenseIdempotent` 선례를 그대로 따른다(§3.2). PATCH/DELETE는 자연 멱등이라 키가 없다(지출 수정과 동일한 판단 — `offline/types.ts:209` 주석).

### 2.4 상태 변경: 기존 status 엔드포인트의 id 다형화

`PATCH /children/:childId/items/:id/status`의 서버 구현(`updateItemStatus`)에 갈래 하나를 더한다: `requireItemTemplate`이 NOT_FOUND일 때(또는 선조회로) **그 아이의 활성 커스텀 행**을 찾으면 `custom_items.status`(+`updated_by_user_id`)를 갱신하고 같은 `ItemSummary`(+`isCustom`) 모양으로 응답한다.

근거 — 이것이 이 설계의 가장 중요한 이음새다: 모바일 상태 변경은 전부 오프라인 아웃박스를 탄다(`updateItemStatusOffline` → flush가 정확히 이 경로 하나를 부른다, `remote-api.ts:258`). 엔드포인트가 커스텀 id를 받으면 **아웃박스·대기/실패 배지·낙관 캐시 패치·재시도·아이 스코프 가드(라운드 99 F2 M-2) 전부가 클라이언트 0바이트로 커스텀에 적용**된다. 별도 상태 엔드포인트(대안)는 아웃박스 행 타입·flush 분기·배지 색인까지 한 벌을 복제해야 해서 기각.

경계: `expenseId`가 커스텀 id와 함께 오면 400 `CUSTOM_ITEM_EXPENSE_LINK_UNSUPPORTED` — `child_item_statuses.expense_id`에 해당하는 자리가 없고, 지출 연결은 §7 이월이다(조용히 버리면 사용자가 연결됐다고 믿는다 — 거짓 침묵 금지).

### 2.5 상세: 기존 GET 상세의 커스텀 갈래

`GET /children/:childId/items/:id`가 커스텀 id를 받으면 `itemDetailSchema` 모양으로 응답한다:

- `productLinks: []` — 앱의 기존 링크 0건 갈래가 CTA·판매처 비교·고지를 접는다(§5.4).
- `reasonText: CUSTOM_ITEM_REASON_TEXT`("직접 추가한 준비물이에요.") — 계약이 `min(1)` 필수라 비울 수 없고, 출처를 말하는 고정 문구는 지어낸 데이터가 아니라 사실의 라벨이다. 상수는 계약이 단일 소스(§9).
- `skipReasonText: null` · `safetyNote: null` · `usedSecondhandOk: false`(중고 OK 배지가 서지 않을 뿐 — 주장 없음) · `medicalDisclaimerRequired: false`(의료 주장 없음이 사실) · `linkedExpense: null` · `isCustom: true`.

**구클라이언트 호환이 이 갈래의 존재 이유다**: 병합 목록(§2.2)을 받은 구버전 앱이 커스텀 타일을 눌러도 404 대신 정상 상세(링크 없음 갈래)가 열린다. `isCustom`을 모르는 구버전은 수정/삭제 입구만 없는 읽기 화면을 본다 — 기능 상실이 아니라 미지원 표면의 자연 축소다.

### 2.6 권한

- 생성/수정/삭제/상태: `requireChildAccess(user, childId, /*edit*/ true)` — 서버가 준비 상태 쓰기에 이미 요구하는 것과 같은 선(owner/co_parent). viewer·gift_participant는 403 `FORBIDDEN`(모바일은 기존 `useItemStatusGate`가 같은 판정으로 입구를 잠근다 — 새 판정 불요).
- 읽기(목록 합류·상세): `requireChildAccess(user, childId)` — 구성원 전원. 커스텀 행 접근은 언제나 childId 스코프 조회(`WHERE id = :id AND child_id = :childId AND deleted_at IS NULL`)라 타 가구 id 추측이 구조적으로 404다.

---

## 3. 결정 D3 — 로컬 미러 패리티 (standalone 전 기능 동작)

### 3.1 상태·함수

`local-backend.ts`:

- `LocalBackendState`에 `customItems: LocalCustomItemRecord[]` 추가(§9 타입). `initialState`는 `[]`, `sanitizeLocalBackendState`가 비배열/오염 blob을 `[]`로 되돌린다(멤버·초대와 같은 관례). **persist version은 3 유지** — 필드 가산은 merge가 기본값으로 메우므로 일회성 초기화(v3의 성격)가 필요 없다.
- `createCustomItem(childId, body, idempotencyKey?)`: 검증(트림·80자·한도 200·밴드/필수도 값) 후 행 추가. 멱등은 `idempotencyKeys` 맵 재사용(`createExpenseIdempotent`와 같은 형식 — 같은 키 재제출이면 기존 행 반환). id는 `generateLocalId("custom-item")` — 로컬 세션 id는 서버로 나가지 않으므로 UUID 모양일 필요가 없고, 오히려 접두사가 디버그 가독성을 준다(로컬 지출 id와 같은 판단). 
- `updateCustomItem` / `deleteCustomItem`(soft delete 미러 — `deletedAt` 세팅), `updateItemStatus`에 커스텀 갈래(서버 §2.4 미러: 픽스처에서 못 찾으면 customItems에서 찾는다).
- `listItems`: 기존 반환 조립 끝에 **같은 탭 술어**(`itemMatchesBand` + 상태)로 거른 커스텀 행을 `createdAt` 순으로 덧붙인다(`isCustom: true`). `getItemDetail`: 커스텀 갈래가 §2.5와 같은 모양을 돌려준다. **서버와 미러의 합류 규칙이 문장 하나로 같아야 한다**: "탭 술어는 카탈로그와 동일, 순서는 카탈로그 뒤 created ASC" — 어긋나면 데모와 실세션의 목록이 갈린다(`recommendation-order-mirror`가 지키는 것과 같은 종류의 계약; T2가 자기 테스트로 고정).

### 3.2 데모 픽스처: **0건**

`localItemTemplateFixtures`는 앱 콘텐츠(운영 시드 미러)이고 커스텀 품목은 사용자 데이터다. 실기기 피드백 1 이후 데모도 데이터 0에서 시작하므로(`ensureSeeded`가 사용자 데이터를 만들지 않는다) **커스텀 픽스처를 심지 않는 것이 규약 준수**다. standalone 전 기능 동작은 픽스처가 아니라 생성 경로 자체가 로컬에서 도는 것으로 성립한다.

### 3.3 오프라인 생성 큐: **v1은 온라인 전용(로컬 세션은 무관하게 전부 동작)** — 권고

**권고: 생성/수정/삭제는 일반 `useMutation`(온라인 필요), 상태 변경만 기존 아웃박스를 탄다(§2.4 덕에 자동).**

근거: ① 신규 엔티티의 오프라인 생성은 로컬 id → 서버 id 입양(adopt) 문제를 낳는다 — 지출이 이 배관(`adoptServerExpense`·멱등 키·충돌 병합)을 갖추는 데 스프린트 하나가 들었고, 커스텀 품목은 목록·상세·상태 캐시 세 곳의 id 재봉이 더 붙는다. ② 사용 맥락이 다르다: 지출 기록은 "마트 지하에서 지금" 이지만 품목 추가는 목록을 훑다가 하는 계획 행동이라 오프라인 절박성이 낮다. ③ standalone(로컬 세션)은 네트워크 자체가 없으므로 이 제한과 무관하게 전부 동작한다 — 제한이 실제로 무는 것은 "실계정 + 지하철"의 생성 한 동작뿐이다. 실패 시 기존 오류 카피 관례(`use-load-error-copy` — 오프라인이면 오프라인이라고 말한다)를 따른다. 재개 조건: 오프라인 생성 요구가 실사용에서 보고되는 날, 지출 아웃박스의 입양 배관을 인용해 별도 트랙으로.

---

## 4. 결정 D4 — UI

### 4.1 진입점

세션 렌더에서 `PreparationListParity` **아래**(같은 스크롤 안)에 `SecondaryButton` "준비물 직접 추가하기" 한 줄. 근거: ① 목록을 끝까지 훑고 "없네"가 되는 지점이 정확히 거기다 ② `PreparationListParity` 내부(잠긴 뼈대)와 TopAppBar 우측 슬롯(아이 전환이 선점)을 건드리지 않는다 ③ 비세션 프리뷰는 `if (!hasSession)`에서 먼저 반환하므로 캡처 무접촉이 구조로 보장된다. 검색 0건 빈 상태에 같은 버튼을 겹치는 안은 v1.1로(§7 — 빈 상태 문구는 `PreparationListParity` 소유라 접점이 늘어난다).

### 4.2 입력 시트 (신규 컴포넌트, 판정은 순수 모듈)

필드 최소셋 셋: **이름**(TextInput, 80자 가드 — "이미 들어 있는 값"도 판정, text-limits 관례) · **시기 밴드**(4칩, 기본 = 지금 보고 있는 `stageLabel`) · **필수도**(3칩, 기본 "꼭 필요해요"). 저장 버튼은 `disabled={mutation.isPending}`(mutation-press-guard의 `control-blocks` 관례 — §6.3). 검증·문구·기본값·a11y 라벨은 순수 모듈 `src/items/custom-item-form.ts`가 소유하고 화면은 그린다(저장소 확립 규율). 키보드 위 버튼 탭은 keyboard-tap-guard 스윕 규율을 따른다(기존 시트 선례의 `keyboardShouldPersistTaps` 형식 인용). 문구는 해요체(DNC-018), 저장 성공 시 시트 닫고 `["items", childId]` invalidate 한 번.

### 4.3 목록 합류 시 정렬·버킷·표식

- 그룹: `categoryId` 없음 → 기존 "분류 없음" 그룹. 버킷: `resolvePreparationTimelineBucket`이 전개된 `stageCodes`로 카탈로그와 같은 판정 — **화면 코드 0바이트**.
- 정렬: 서버가 준 순서 그대로(카탈로그 뒤, created ASC). 클라이언트 재정렬 없음(기존 규율).
- **커스텀 표식은 타일이 아니라 발밑 슬롯**: 타일 구성(아이콘·이름·상태 pill)은 승인 디자인 잠금(`catalog-contract.ts` 머리말 — 가격 줄 결정의 전례)이므로 손대지 않고, 이미 메모 미리보기가 쓰는 `renderItemFooter`에 한 줄 텍스트 `"직접 추가한 준비물"`(작은 회색, 메모 미리보기와 나란히)을 세운다. `isCustom`이 없는 항목은 슬롯 무접촉.
- 필수도 칩·검색·찜 필터: `ItemSummary` 필드만 읽으므로 자동 적용. 준비했어요/괜찮아요 버튼: `applyStatusChange` 그대로(아웃박스 — §2.4).
- "지출도 기록할까요?" 줄: 커스텀 항목에서는 `expenseLinkParams`에 **`itemTemplateId`를 싣지 않는다**(`isCustom`이면 품목명만 프리필) — `expenses.linked_item_template_id`가 `item_templates` FK라 커스텀 id는 실을 수 없다(§0 실측). 줄 자체는 그대로 선다(지출 기록 가치는 동일; 자동 준비완료 연동만 없는데 상태는 이미 사용자가 방금 눌렀다).

### 4.4 상세 화면 갈래 (DNC 표면 접기)

`app/items/[itemTemplateId].tsx`는 커스텀 id도 같은 라우트·같은 쿼리로 연다(서버 §2.5). 렌더 갈래:

- 구매 링크·제휴 고지·가격대·판매처 비교·공유: `productLinks: []` + `priceBandText` 없음이므로 **기존 링크 0건 갈래가 전부 접는다** — DNC-010/011은 "있는 고지를 숨기지 않는다"이지 "없는 고지를 지어낸다"가 아니다(이 화면이 이미 그 문장을 주석으로 갖고 있다: "undefined면 고지할 대상이 없다는 뜻이라 렌더하지 않는다 — DNC-010의 은닉이 아니라"). **신규 조건부 은닉 코드가 0건**이라는 것이 이 설계의 요점이다.
- 추가 렌더: `isCustom`이면 상단에 출처 한 줄(reasonText가 이미 그 문구다) + **수정**(입력 시트 재사용, PATCH) + **삭제**(Alert 확인 → DELETE → items invalidate + 뒤로) 버튼. 삭제 확인 문구는 이름을 끼우므로 **조사를 값에서 고른다**(§6.5).
- 상태 변경 버튼·메모 카드: 기존 그대로 동작 — 메모 스토어 키는 `itemTemplateId` 단위라 커스텀 id도 그냥 키가 된다(0바이트).
- 게이트: 수정/삭제 입구는 `useItemStatusGate`(편집 권한)와 같은 판정을 재사용.

---

## 5. (통합) 없는 것을 지어내지 않는 표면 정리

| 표면 | 커스텀 품목에서 | 방식 |
|---|---|---|
| 구매 CTA·판매처 비교 | 없음 | 링크 0건 기존 갈래 |
| 제휴 고지(DNC-010)·스폰서(DNC-011) | 고지 대상 없음 → 미렌더 | `productLinksDisclosureText` undefined 기존 갈래 |
| 가격대 | 없음 | `priceBandText` 미포함(폴백 문구 반복 금지 — catalog-contract 규칙 인용) |
| 중고 OK·안전 노트·의료 안내 | 주장 없음 | false/null |
| 홈 맞춤 추천 | 미합류 | §2.2 |

---

## 6. 경계·리스크

### 6.1 추천 점수(DNC-009)와 무관함 — 명시

커스텀 품목은 `rankItemsForTab`/`sortRecommendedItems`의 입력에 들어가지 않고(§2.2 — 랭킹 뒤 append), 상품 링크·수수료율·스폰서 축이 아예 없다. 추천 점수 함수는 0바이트 무접촉이므로 DNC-009 표면은 움직이지 않는다. `recommendation-order-mirror.test.ts`는 카탈로그 항목의 순서 동치만 보므로 append 규칙이 양쪽에서 같으면 그대로 초록(그 "같음"은 T2의 로컬 미러 테스트가 별도로 문다).

### 6.2 준비율·축하·D-7·패리티 합류 규칙

- **준비율(ITEM-114)**: 화면이 `tab="all"` 스냅샷에서 계산하므로 커스텀 essential은 자동으로 분모에 선다 — **의도된 합류**다(사용자 선언값). 귀결: 100% 밴드에 essential 커스텀을 추가하면 축하 배너가 내려간다(정직한 재계산 — 새로 할 일이 생긴 것이 사실이다). convenience/optional 커스텀은 분모 무접촉.
- **100% 축하·다음 시기 칩**: 준비율 파생이라 위 규칙을 따를 뿐 모듈(`prep-milestones`) 무접촉.
- **D-7 예고 배너(next-stage-preview)**: 달력 트리거라 품목 집합과 무관 — 0접촉.
- **패리티 그룹 카운트("2/6 보유")**: `PreparationListParity`가 받은 배열에서 세므로 자동 합류. 시기 버킷도 §4.3.

### 6.3 대장(사문·슬라이스·리터럴 등 스윕) 예상 반응과 준수 규칙

| 그물 | 예상 반응 / 각 트랙의 의무 |
|---|---|
| **사문 대장**(`packages/test-utils/dead-export-ledger`) | 새 export는 **같은 라운드에 제품 호출부가 서야** 한다(호출부 0건이면 래칫 위반). 라운드 95 공통 금지 준수: **새 `export const` 0건 — `export function`으로 쓴다**(상수도 함수 반환 또는 계약 파일 소유로). T2·T3의 새 모듈은 배선 커밋과 한 트랙에 묶는다. |
| **슬라이스 가드**(`source-contract-slice-guard`) | T3의 배선 계약 테스트(`custom-item-wiring.test.ts` 류)가 `items.tsx`/`[itemTemplateId].tsx`를 slice로 자르면 **대장에 없는 새 파일의 미가드 자리 = 즉시 빨강**(② 새 자리 금지). 모든 `indexOf`에 실재 확인(`toBeGreaterThan(-1)` 형)을 먼저 세운다. |
| **앵커/리터럴 대장**(`comment-tolerant-anchor-ledger` · a11y 한국어 리터럴 스윕) | 소스를 읽는 새 헬퍼·앵커는 하한 방향으로만 움직이므로 늘어나는 것은 초록. 단 새 사용자 문장은 각 모듈 테스트가 문구·a11y를 자기 소유로 고정(a11y-contract 8,218줄 파일은 0트랙 — 라운드 1 관례). **색상 리터럴 신규 0건**(DNC-017 — theme 토큰만). |
| **mutation-press-guard** | 신규 `useMutation` 3~4자리(생성/수정/삭제) 전부 `disabled={mutation.isPending}`(control-blocks)로 — `does-not-block` 이유 행을 만들지 않는다. |
| **route-surface** | **신규 라우트 0** — 시트는 화면 내 컴포넌트, 상세는 기존 `[itemTemplateId]` 재사용. 대장 무접촉. |
| **korean-particle-guard** | §6.5. |
| **keyboard-tap-guard / loading-skeleton / refresh-wiring / screen-phase** | contains형 — 추가는 깨지 않되 기존 요구 문자열(RefreshControl·SkeletonCard 등) 유지 책임은 각 트랙. |
| **home-payload-consumers / shared-cache-policy / items-child-scope** | `getHome` 구독 신규 0건 · 신규 쿼리 키는 childId 스코프(생성/수정/삭제는 invalidate만 하므로 신규 구독 0건도 가능). |
| **transaction-bounds(api)** | 신규 `$transaction` 0건(단건 insert/update) — 대장 무접촉. |
| **contracts-mirror(mobile)** | "스키마 짝·필드 두 방향·상수 대장" 스윕이 새 계약 스키마의 모바일 미러 부재를 잡는다 — T2가 `ItemSummary.isCustom`·이름 상한·한도 상수의 미러+대조를 함께 싣는다. |

### 6.4 아이 전환·다자녀

커스텀 품목은 child 소유 + 쿼리 키가 이미 `["items", childId, "catalog"]`라 아이 전환 invalidate(라운드 51 #10)가 그대로 갈아 끼운다. 라운드 99 F2 M-2가 경고한 "카탈로그 템플릿 id는 아이가 달라도 같은 값" 문제가 커스텀에는 **구조적으로 없다**(id가 아이마다 고유). 같은 물건을 두 아이에 두려면 두 번 추가한다 — v1 수용(§1.1 대안 C).

### 6.5 이름 조사 (korean-particles)

커스텀 품목명은 사용자가 지은 문자열이므로 이름을 끼우는 모든 새 문장은 `src/text/korean-particles.ts`의 판정을 지난다: 삭제 확인 `` `${objectParticle(name)} 목록에서 지울까요?` ``(을/를), 실패·성공 토스트 등. 리터럴 조사를 못 박으면 `korean-particle-guard` 스윕이 빨개진다. 문장 조립은 순수 모듈(`custom-item-form.ts` / `custom-item-messages`)이 소유.

### 6.6 픽셀락 6종 비세션 렌더 무접촉 전략

- ITEM-001(목록)·ITEM-002(상세)의 캡처는 비세션이고, 두 화면 다 `if (!hasSession)` 프리뷰 갈래가 **세션 JSX 도달 전에 반환**한다 — 신규 UI(추가 버튼·시트·표식·수정/삭제)는 전부 세션 갈래 아래에만 세우므로 캡처는 구조적으로 불변이다.
- 프리뷰 픽스처(`previewItems`·`previewDetail`)·`pixelLock/styles`·`theme.ts` 0바이트.
- 배너·파생값 계열에는 기존 이중 게이트 관례(`hasSession && !isPixelLockMode`)를 그대로 적용해 값으로도 증명한다(축하 배너·D-7 배너의 형식 인용). 나머지 캡처 화면(SPL/HOME/EXP/REP/FAM/IMP/SET)은 소유 파일 밖이라 0접촉.

### 6.7 리스크 목록 (요약)

| # | 리스크 | 크기 | 대응 |
|---|---|---|---|
| R1 | status 엔드포인트 다형화(§2.4)가 기존 e2e(items-commerce·item-status-link-race)의 NOT_FOUND 경계와 상호작용 | 중 | 커스텀 갈래는 "템플릿 미존재 → 그 아이의 커스텀 조회" 순서로만 열고, 존재하지 않는 id는 종전 `ITEM_NOT_FOUND` 그대로. e2e에 두 경계 케이스 추가 |
| R2 | 사용자 물리 파기와 `created_by/updated_by` FK(§1.5) | 중 | T1 체크리스트로 명시 — purge job의 기존 `child_item_statuses` 취급을 실측 후 같은 방식 편입 |
| R3 | essential 기본값이 준비율을 움직여 "축하가 사라졌다" 문의 | 하 | 정직한 재계산(§6.2). 필수도 칩이 시트에 노출돼 사용자가 고를 수 있음 |
| R4 | 구클라이언트가 `isCustom`을 몰라 수정/삭제 입구 없이 표시 | 하 | 의도된 축소(§2.5). 상세·상태·목록은 전부 동작 |
| R5 | 서버/미러 합류 규칙 드리프트(순서·탭 술어) | 중 | 규칙을 §2.2 한 문장으로 고정 + T2 미러 테스트가 두 구현을 같은 픽스처로 대조 |
| R6 | `24개월+` ↔ `12-24개월` 중복 노출 문의 | 하 | 카탈로그와 동일한 의도된 중복(§1.3) — 상세 timingLabel이 고른 밴드를 그대로 말한다 |
| R7 | 슬라이스 가드·사문 대장 신규 위반 | 하 | §6.3 규칙을 각 트랙 프롬프트에 복사 |

---

## 7. 범위 밖으로 미룬 것 (사유 명기)

| 후보 | 사유 |
|---|---|
| 커스텀 품목 ↔ 지출 연결(linkedExpense·"샀어요" 자동 완료) | `expenses.linked_item_template_id`가 `item_templates` FK — 컬럼 이원화 또는 FK 개편이 필요한 별도 결정. v1은 품목명 프리필만(§4.3) |
| 분류(categoryId) 선택 | 시트 최소셋 유지. nullable 컬럼+요청 필드 가산으로 후속 추가 가능(§1.2) |
| 오프라인 생성 큐 | 로컬 id 입양 배관이 별도 트랙감(§3.3 — 재개 조건 명기) |
| 가구 공유 소유(두 아이 공용 등록) | 아이 소유 결정의 대안 C(§1.1) — 실요구 보고 시 |
| 커스텀 품목 사진 | DNC-016 인접(사진/영수증 AI 오해 소지) + 저장 용량·파기 설계 필요 |
| 가족 밖 공유·내보내기 | 커머스/공유 표면은 고지 규율(DNC-010)과 얽혀 별도 판단 |
| 검색 0건 빈 상태의 "직접 추가" 버튼 | 빈 상태 문구가 `PreparationListParity` 소유 — 접점 최소화를 위해 v1.1 |
| 어드민 노출(운영이 커스텀 통계를 보는 화면) | 개인 데이터 표면 신설이라 개인정보 검토 선행 |
| 홈 추천 카드 합류 | §2.2 기각 근거 — 재론 시 홈 트랙 소유 |
| 생성 analytics 이벤트 | 이름이 기기를 떠나지 않는 페이로드 설계(ANA-103 관례) 포함 후속 |

---

## 8. 트랙 분할 (T1 / T2 / T3)

**계약은 이 문서 §9가 확정한다** — 세 트랙은 서로의 코드가 아니라 §9만 본다. 파일 교집합 공집합.

| 트랙 | 소유 파일 | 테스트 요구 | 비고 |
|---|---|---|---|
| **T1 api** | `prisma/migrations/000022_custom_items/` · `prisma/schema.prisma`(CustomItem 모델 추가) · `src/items-commerce/custom-items.controller.ts`(신규) · `src/items-commerce/dto/custom-items.dto.ts`(신규) · `src/onboarding/custom-items.service.ts`(신규 — ItemsCatalogService 주입 순환 회피를 위해 별도 서비스, 합류·다형 갈래는 `items-catalog.service.ts`·`items.controller.ts` 최소 수정) · `test/custom-items.e2e.test.ts`(신규) | e2e: CRUD·권한(viewer 403)·멱등 재제출·한도·소프트 삭제·목록 합류(탭 4종 술어+순서)·상세 갈래·status 다형(R1 경계 2종)·`expenseId`+커스텀 400 · adminListItemTemplates 무오염 확인 · purge 정합(R2) | DTO는 class-validator 자체 선언(기존 items.dto 관례 — **contracts 신규 심볼 import 0건**이라 T2와 독립) |
| **T2 contracts + client + local-backend** | `packages/contracts/src/schemas.ts`(가산) · `apps/mobile/src/api/client.ts`(타입+함수 3개+로컬 라우팅) · `local-backend.ts`(상태·sanitize·함수 5곳) · `contracts-mirror.test.ts`(상수 대조 추가) · `local-backend` 계열 테스트 | zod 스키마 파스 테스트 · 미러: 생성/수정/삭제/한도/멱등/합류 순서·탭 술어(서버 규칙 §2.2를 같은 픽스처로) · sanitize(오염 blob → `[]`) · contracts-mirror(이름 상한·한도 상수 두 방향) | |
| **T3 items UI** | `app/(tabs)/items.tsx`(진입 버튼+footer 표식+프롬프트 커스텀 게이트) · `app/items/[itemTemplateId].tsx`(커스텀 갈래: 출처 줄·수정/삭제) · `src/items/custom-item-form.ts`+`.test.ts`(신규 — 검증·문구·기본값·조사·a11y) · `src/items/CustomItemSheet.tsx`(신규) · `src/items/custom-item-wiring.test.ts`(신규 — 가드된 슬라이스) | 모듈 테스트(80자 가드·트림·기본 밴드=현재 칩·조사·해요체 문구·a11y 문장) · 배선 테스트(진입 버튼 세션 갈래에만 · 프리뷰 갈래 무접촉 · press-guard `disabled` 존재) · 기존 스윕 전체 그린 | `PreparationListParity.tsx`·`catalog-contract.ts`·`prep-*`·`stage-bands` **읽기 전용** |

**커밋 순서와 병렬성**: T1 ∥ T2 완전 병렬(파일·심볼 교집합 0 — T1은 contracts 신규 심볼을 import하지 않는다). **T3는 T2 머지 후**(client 함수·`isCustom` 타입을 import한다). 즉 `T1, T2 → T3`. 각 트랙 머지 시 자기 필터 테스트 그린, 라운드 종료 시 `pnpm release:gate`(로컬 검증 기준 — launch-72h-plan). api 테스트는 실 PostgreSQL(`service postgresql start` 후 `wooriai_test`).

커밋 컨벤션 예: `feat(api): 커스텀 품목 테이블·CRUD·목록 합류 (R100-T1)` / `feat(mobile): 커스텀 품목 계약·클라이언트·로컬 미러 (R100-T2)` / `feat(mobile): 준비템 커스텀 품목 추가 UI (R100-T3)`.

---

## 9. 계약 확정 (트랙 프롬프트에 그대로 넣는 절)

### 9.1 packages/contracts/src/schemas.ts 가산 (T2 소유 — 수기 단일 소스)

```ts
// 라운드 100: 커스텀 품목(사용자 직접 추가 준비물). item_templates(운영 시드)와 별개 테이블이며
// 목록에는 ItemSummary 모양으로 합류한다(isCustom 마커). DNC-009: 추천 점수·정렬 무접촉.
export const CUSTOM_ITEM_NAME_MAX_LENGTH = 80;      // custom_items.name varchar(80)와 동치
export const CUSTOM_ITEM_MAX_PER_CHILD = 200;       // 아이당 활성(미삭제) 상한
/** 커스텀 상세의 reasonText 고정 문구 — 출처 라벨이지 지어낸 설명이 아니다. */
export const CUSTOM_ITEM_REASON_TEXT = "직접 추가한 준비물이에요.";

// itemSummarySchema에 가산(additive optional — 없으면 카탈로그 품목):
//   isCustom: z.boolean().optional()
// itemDetailSchema는 itemSummarySchema.extend이므로 자동 승계. 다른 필드 무변경.

export const createCustomItemRequestSchema = z.object({
  name: z.string().min(1).max(CUSTOM_ITEM_NAME_MAX_LENGTH),   // 서버가 트림 후 재검증
  stageBand: stageBandLabelSchema,                            // 4밴드 라벨 원문
  necessityLevel: necessityLevelSchema                        // 클라이언트가 항상 명시(기본 essential은 UI 몫)
});

export const updateCustomItemRequestSchema = createCustomItemRequestSchema.partial();
// status는 여기 없다 — 상태는 기존 PATCH /children/:childId/items/:id/status 하나가 쓴다.

export const customItemSummarySchema = itemSummarySchema.extend({ isCustom: z.literal(true) });

export const deleteCustomItemResponseSchema = z.object({ id: uuidSchema, deleted: z.literal(true) });

export type CreateCustomItemRequestDto = z.infer<typeof createCustomItemRequestSchema>;
export type UpdateCustomItemRequestDto = z.infer<typeof updateCustomItemRequestSchema>;
export type CustomItemSummaryDto = z.infer<typeof customItemSummarySchema>;
export type DeleteCustomItemResponseDto = z.infer<typeof deleteCustomItemResponseSchema>;
```

### 9.2 엔드포인트 시그니처 (T1 — DTO는 class-validator 자체 선언, 위 스키마의 미러)

```
POST   /api/v1/children/:childId/custom-items
       헤더: Idempotency-Key(선택, IdempotencyInterceptor) · 권한: edit
       바디: { name: string(1..80, trim), stageBand: StageBandLabel, necessityLevel: NecessityLevel }
       200 → CustomItemSummaryDto  (id·name·necessityLevel·status:"not_prepared"·
             timingLabel=stageBand·stageCodes=stagesForBand(stageBand)·isCustom:true)

PATCH  /api/v1/children/:childId/custom-items/:customItemId   권한: edit
       바디: 위 3필드 전부 optional → 200 CustomItemSummaryDto

DELETE /api/v1/children/:childId/custom-items/:customItemId   권한: edit
       200 → { id, deleted: true }  (soft delete + audit_logs "custom_item.delete" — 이름 미기록)

GET    /api/v1/children/:childId/items          (기존 — 확장)
       items 배열 = rankItemsForTab(카탈로그) 결과 ‖ 커스텀(created_at ASC, 같은 탭 술어, isCustom:true)

GET    /api/v1/children/:childId/items/:id      (기존 — 커스텀 갈래)
       커스텀이면: ItemDetailDto{ …summary, reasonText: CUSTOM_ITEM_REASON_TEXT,
       skipReasonText:null, usedSecondhandOk:false, safetyNote:null,
       medicalDisclaimerRequired:false, linkedExpense:null, productLinks:[], isCustom:true }

PATCH  /api/v1/children/:childId/items/:id/status   (기존 — 커스텀 갈래) 권한: edit
       템플릿 미존재 → 그 아이의 활성 커스텀 조회 → status 갱신, 200 CustomItemSummaryDto.
       커스텀 + expenseId → 400 CUSTOM_ITEM_EXPENSE_LINK_UNSUPPORTED.
```

### 9.3 에러 코드

| 코드 | HTTP | 언제 | 메시지(해요체) |
|---|---|---|---|
| `CUSTOM_ITEM_NOT_FOUND` | 404 | 그 아이의 활성 커스텀 행 없음(타 가구 id 포함) | "직접 추가한 준비물을 찾을 수 없어요." |
| `CUSTOM_ITEM_LIMIT_EXCEEDED` | 400 | 활성 행 ≥ 200에서 생성 | "직접 추가할 수 있는 준비물은 아이당 200개까지예요." |
| `CUSTOM_ITEM_EXPENSE_LINK_UNSUPPORTED` | 400 | 커스텀 id + expenseId 상태 변경 | "직접 추가한 준비물에는 아직 지출을 연결할 수 없어요." |
| (기존) `VALIDATION_ERROR` / `FORBIDDEN` / `CHILD_NOT_FOUND` / `ITEM_NOT_FOUND` | — | 형식 위반 / viewer 쓰기 / 아이 없음 / 어느 표에도 없는 id | 기존 문구 |

### 9.4 mobile client.ts (T2)

```ts
// ItemSummary 가산: isCustom?: boolean;   (ItemDetail은 승계)

export function createCustomItem(
  token: string, childId: string,
  body: { name: string; stageBand: StageBandLabel; necessityLevel: "essential" | "convenience" | "optional" },
  idempotencyKey?: string
): Promise<ItemSummary>;   // local 토큰 → localBackend.createCustomItem

export function updateCustomItem(
  token: string, childId: string, customItemId: string,
  body: Partial<{ name: string; stageBand: StageBandLabel; necessityLevel: "essential" | "convenience" | "optional" }>
): Promise<ItemSummary>;

export function deleteCustomItem(token: string, childId: string, customItemId: string):
  Promise<{ id: string; deleted: true }>;

export const CUSTOM_ITEM_NAME_MAX_LENGTH = 80;  // 자기 상수 + contracts-mirror 대조 테스트(관례)
```

### 9.5 local-backend.ts (T2)

```ts
type LocalCustomItemRecord = {
  id: string;                       // generateLocalId("custom-item")
  childId: string;
  name: string;
  stageBand: StageBandLabel;
  necessityLevel: NecessityLevel;
  status: ItemStatus;               // 기본 "not_prepared"
  createdAt: string;                // ISO
  deletedAt: string | null;
};
// state.customItems: LocalCustomItemRecord[] (initialState [], sanitize 비배열→[])
// createCustomItem(childId, body, idempotencyKey?) — idempotencyKeys 맵 재사용(MOB-102 형식)
// updateCustomItem / deleteCustomItem(soft) / updateItemStatus 커스텀 갈래
// listItems: 카탈로그 조립 뒤 같은 탭 술어(itemMatchesBand+상태)로 createdAt ASC append
// getItemDetail: §9.2 커스텀 상세 모양 그대로(productLinks [], reasonText 상수)
```

### 9.6 UI 확정값 (T3)

- 진입: 세션 렌더의 `PreparationListParity` 아래 `SecondaryButton` **"준비물 직접 추가하기"**.
- 시트 필드: 이름(80자) · 시기 밴드 4칩(기본 = 현재 `stageLabel`) · 필수도 3칩(기본 essential="꼭 필요해요").
- 타일 표식: `renderItemFooter`에 `"직접 추가한 준비물"` 한 줄(`isCustom`만).
- 상세: 커스텀이면 수정(시트 재사용)·삭제(Alert 확인, `objectParticle(name)` 사용) 버튼, 편집 게이트는 `useItemStatusGate` 재사용.
- "지출도 기록할까요?": `isCustom`이면 `expenseLinkParams`에 `itemTemplateId` 미탑재(품목명 프리필만).
- 모든 신규 `useMutation`은 `disabled={isPending}`(control-blocks) · 신규 라우트 0 · 신규 색상 리터럴 0 · 새 `export const` 0(함수형) · 배선 테스트의 슬라이스는 실재 확인 선행.

---

## 10. 검증 계획 · DNC 체크리스트

- 트랙별: 자기 신규/갱신 테스트 + `pnpm --filter api|mobile test` 그린(스윕 포함). 라운드 종료: `pnpm release:gate`. admin 0바이트(기존 그린 확인만). 스모크: `bash scripts/qa/server-smoke.sh`에 커스텀 CRUD 1왕복 추가는 T1 재량(선택).
- standalone 육안: 로컬 세션에서 추가→목록 합류→상태 체크→준비율 반영→상세→수정→삭제 1루프.
- DNC 답변(배치 보고용): screen ids preserved **yes**(신규 화면 0) · API base preserved **yes**(`/api/v1`) · affiliate disclosure preserved **yes**(커스텀은 고지 대상 자체가 없고 카탈로그 표면 무변경) · recommendation commission excluded **yes**(점수 함수 무접촉) · import preview-before-save preserved **yes**(비접촉).
