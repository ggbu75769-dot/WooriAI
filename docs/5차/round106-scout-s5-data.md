# 라운드 106 정찰 S5 — 데이터 무결성·마이그레이션 감사

읽은 시점: **2026-09-07**, 라운드 106 정찰 세션. 다른 에이전트 20개가 동시 편집 중이므로 아래 모든
`파일:줄` 인용은 **그 시점의 파일 상태**다. 읽기 전용 감사 — 소스·설정·운영 DB를 하나도 건드리지 않았다.

**SQL 근거의 출처.** 공유 dev DB(`wooriai_dev`)는 이 시점에 기동 불가였다(`pnpm db status` →
docker 소켓 없음, `.toolcache/pgdata`는 빈 디렉터리라 `pnpm db start`의 포터블 경로도 `initdb`를
건너뛰고 `pg_ctl`에서 실패한다). 그래서 아래 "실측"은 전부 **일회용 임시 클러스터**에서 얻었다:
`/usr/lib/postgresql/16`으로 포트 55432에 빈 클러스터를 세우고 `apps/api/prisma/migrations/**`의
25개 `migration.sql`을 번호 순으로 그대로 적용한 뒤 `pg_catalog`을 조회하고 재현 SQL을 돌렸다.
클러스터는 감사 종료와 함께 삭제했다. 즉 아래 카탈로그 값은 **마이그레이션이 정의하는 스키마**이지
운영 DB의 현재 상태가 아니다(둘이 갈릴 수 있는 자리는 `prisma migrate deploy` 하나뿐이고, S9가
네 배포 경로 전부가 그 명령이라는 것을 같은 라운드에 확인했다 — `round106-scout-s9-ops.md:24~29`).

---

## 0. 요약

| # | 한 줄 | 심각도 | 크기 |
|---|---|---|---|
| **D1** | `children.nickname`은 `varchar(60)`인데 DTO·서비스·앱 어디에도 길이 상한이 없다 — 61자를 넣으면 온보딩이 500 | **높음** | 소 |
| **D2** | 어드민 API로는 스폰서 링크를 **만들 수 없다** — `sponsor_label`을 쓰는 런타임 경로가 0건이라 `isSponsored:true`가 CHECK 위반 500. DNC-011의 구분 표시를 운영자가 켤 수단이 없다 | **높음** | 소 |
| **D3** | 배포 스크립트가 시드를 돌리고, 그 시드가 **어드민 CMS 편집 전량을 되돌린다**. `product_links`는 자연키 매칭이라 제목을 고친 링크가 재시드에서 **중복**된다 | **높음** | 중 |
| **D4** | 라운드 103의 `categories` CASCADE를 막을 수 있는 참조가 정확히 하나 남아 있다 — `item_templates.category_id`. 어드민이 그 값을 검증 없이 받는다(없는 uuid → 500, 남의 가구 커스텀 id → 그 가구 파기가 영구 차단) | 중 | 소 |
| **D5** | `custom_items` 소프트 삭제 tombstone을 지우는 파기 phase가 없다(지출 phase 1과 비대칭). 파기 잡의 "시간 창이 없는 표는 둘" 목록이 000022~000024 이후 낡았다 | 중 | 소~중 |
| **D6** | 어드민 카테고리 **이름 변경에 중복 검사가 없다** — 라운드 103 §1.4의 불변식을 한 방향에서만 지키고, 부분 유니크 색인은 시드 행을 덮지 않는다. 결과는 칩 소멸 + 무관한 지출의 합산(허위 표시) | 중 | 소 |
| **D7** | 어드민 준비템 가격: `priceMin > priceMax` 미검증(CHECK 위반 500) · `@Max` 없음(int4 초과 500) | 중 | 소 |
| **D8** | `product_links.disclosure_text`는 `varchar(200)`인데 어드민 DTO에 `@MaxLength`가 없다 — 201자면 500. DNC-010 고지 문구를 담는 칸이다 | 낮음~중 | 소 |
| **D9** | `pushToken`의 `@MaxLength(2000)`은 **문자** 수라 멀티바이트 2000자(6000B)면 btree 인덱스 행 상한(2704B)을 넘어 500 — DTO 주석이 "닫았다"고 적은 바로 그 구멍 | 낮음 | 소 |
| **D10** | 롤백 안전지대가 없는 마이그레이션이 000024 말고 **넷 더** 있고(000008·000005·000010·000003) 어디에도 그렇게 적혀 있지 않다. 재실행 불가 마이그레이션은 **000007 하나**(실측) | 낮음~중 | 문서 |
| **D11** | `category_budgets.amount_krw`에 `> 0` CHECK가 없다 — `budgets`·`expenses`와 비대칭(서비스만 막는다) | 낮음 | 소(마이그레이션 필요) |
| **D12** | `audit_logs.household_id`는 가구 하드 삭제 뒤 **존재하지 않는 가구**를 가리키는 값으로 남는다. 의도일 수 있으나 그렇게 적힌 곳이 없다 | 낮음 | 문서 |

**축별 결론 한 줄씩** — 자세한 값은 §2·§7.

- 축 1(고아 행): FK **51개** 전량을 카탈로그에서 뽑았다(§2). 캐스케이드가 **필요한데 없는** 자리는 0건이다 — 파기 잡이 명시 삭제로 덮고 있고, §7이 그 대조를 값으로 적었다. 대신 **FK가 아예 없는 컬럼 18개**의 목록을 §2.3에 남겼다.
- 축 2(파기 정합): 라운드 103 **뒤에 생긴 표는 0건**이다(000025는 색인뿐). 빠진 표는 없다. 대신 **000022~000024가 파기 잡 클래스 문서의 완전성 선언을 낡게 만들었고**(D5), 그 셋 중 `custom_items`만 실제 동작 결함을 갖는다.
- 축 3(되돌림): 000024와 **같은 성질**의 마이그레이션 넷을 실측으로 찾았다(D10).
- 축 4(제약 vs 검증): DB가 막는데 서비스가 안 막는 자리 **다섯**(D1·D2·D7·D8·D9), 서비스가 막는데 DB가 안 막는 자리 **하나**(D11)·**하나 더**(D6, 색인의 사각지대).
- 축 5(금액·날짜): **안전하다.** Prisma 합계의 int4 초과, `@db.Date`의 타임존 왕복 둘 다 실측으로 닫혀 있다(§7).
- 축 6(시드 경계): `categories`는 라운드 103이 닫았다. **닫히지 않은 것은 반대 방향** — 시드가 운영자 편집을 덮어쓴다(D3).

---

## 1. 축 2의 직접 답 — "라운드 103 뒤에 생긴 표가 빠지지 않았는가"

**빠진 표는 없다. 라운드 103(000024) 뒤에 만들어진 표가 0건이기 때문이다.** 000025는
`CREATE INDEX idx_categories_seed` 한 줄뿐이다(`apps/api/prisma/migrations/000025_categories_seed_partial_index/migration.sql:22~23`).

`households`를 가리키는 FK는 **7개**이고, 가구 하드 삭제(`data-retention-purge.job.ts:1166`
`tx.household.deleteMany`)가 그 전부를 지난다:

| 자식 | ON DELETE | 파기 잡이 앞에서 하는 일 |
|---|---|---|
| `children.household_id` | NO ACTION | `purgeChildRows`로 먼저 삭제 (`:1157~1161`) |
| `household_members.household_id` | NO ACTION | 이 가구가 orphan으로 판정되는 조건 자체가 "남은 멤버 0" (`:1148~1153`) |
| `household_invites.household_id` | NO ACTION | `deleteMany` (`:1161`) |
| `expenses.household_id` | NO ACTION | `purgeChildRows` → `deleteExpensesHard` |
| `import_jobs.household_id` | NO ACTION | `purgeChildRows` |
| `affiliate_clicks.household_id` | NO ACTION | `updateMany` NULL (`:1162~1165`) |
| `attachments.household_id` | NO ACTION | `purgeChildRows`가 `child_id`로 지운다(그 표는 언제나 비어 있다) |
| `categories.household_id` | **CASCADE** (000024) | 잡의 코드 변경 0 — DB가 진다 |

**단, 그 CASCADE에 딸린 참조 하나가 검사되지 않는다** → D4. `categories`를 가리키는 FK는 넷
(`expenses` · `category_budgets` · `import_rows` · `item_templates`)이고 앞의 셋은 파기 순서가
이미 지우지만, `item_templates.category_id`는 **아이·가구와 무관한 운영 시드 표**라 어떤 순서로도
지워지지 않는다.

---

## 2. 축 1 — 테이블 × 부모 × ON DELETE (실측 카탈로그, FK 51건)

임시 클러스터에 25개 마이그레이션을 적용한 뒤 `pg_constraint`(`contype='f'`) 전량.
캐스케이드는 **6건뿐**이고 나머지 45건은 전부 `NO ACTION`이다.

### 2.1 ON DELETE CASCADE (6건) — 전부 "아이 또는 가구가 사라지면 함께"

| 자식 테이블 | 컬럼 | 부모 | 도입 |
|---|---|---|---|
| `categories` | `household_id` | `households` | 000024 |
| `category_budgets` | `child_id` | `children` | 000023 |
| `custom_items` | `child_id` | `children` | 000022 |
| `push_boundary_marks` | `child_id` | `children` | 000013 |
| `import_rows` | `import_job_id` | `import_jobs` | 000001 |
| `item_template_stages` | `item_template_id` | `item_templates` | 000001 |

### 2.2 ON DELETE NO ACTION (45건) — 부모별로 접어서

| 부모 | 자식(컬럼) — 전부 NO ACTION |
|---|---|
| `users` (16) | `affiliate_clicks.user_id` · `attachments.uploaded_by_user_id` · `budgets.created_by_user_id` · `child_item_statuses.updated_by_user_id` · `consents.user_id` · `custom_items.created_by_user_id` · `custom_items.updated_by_user_id` · `expenses.created_by_user_id` · `expenses.deleted_by_user_id` · `household_invites.accepted_by_user_id` · `household_invites.invited_by_user_id` · `household_members.invited_by_user_id` · `household_members.user_id` · `households.owner_user_id` · `import_jobs.user_id` · `user_devices.user_id` |
| `children` (9) | `affiliate_clicks.child_id` · `attachments.child_id` · `budgets.child_id` · `child_item_statuses.child_id` · `expenses.child_id` · `households.default_child_id` · `import_jobs.child_id` |
| `households` (6) | `affiliate_clicks.household_id` · `attachments.household_id` · `children.household_id` · `expenses.household_id` · `household_invites.household_id` · `household_members.household_id` · `import_jobs.household_id` |
| `categories` (4) | `category_budgets.category_id` · `expenses.category_id` · `import_rows.category_id` · `item_templates.category_id` · `categories.parent_category_id`(자기참조, 죽은 컬럼) |
| `item_templates` (4) | `affiliate_clicks.item_template_id` · `child_item_statuses.item_template_id` · `expenses.linked_item_template_id` · `product_links.item_template_id` |
| `expenses` (3) | `attachments.expense_id` · `child_item_statuses.expense_id` · `import_rows.duplicate_candidate_expense_id` |
| `product_links` (2) | `affiliate_clicks.product_link_id` · `expenses.linked_product_link_id` |
| `import_jobs` (1) | `expenses.import_job_id` |

### 2.3 FK가 **아예 없는** `*_id` 컬럼 (18건, 그중 참조 성격 8건)

| 테이블.컬럼 | NOT NULL | 왜 없는가 / 오늘의 상태 |
|---|---|---|
| `refresh_tokens.user_id` | 예 | 000002가 "도메인이 아직 인메모리"라서 의도적으로 뺐다(그 파일 머리말). 지금은 도메인이 DB에 있으므로 **근거가 낡았다.** 파기 잡이 명시 `deleteMany`로 덮는다(`:1097`) |
| `idempotency_keys.user_id` | 예 | 위와 같은 이유. 파기 잡 `:1100`이 덮는다 |
| `admin_sessions.admin_user_id` | 예 | 000006이 "이 스키마의 기존 컨벤션"으로 명시. `admin_users`에 **삭제 경로가 없어**(전 저장소에 `adminUser.delete` 0건 — `active` 토글만) 오늘은 고아가 생기지 않는다 |
| `content_revisions.author_admin_id` | 예 | 위와 같다 |
| `content_revisions.reviewer_admin_id` / `.entity_id` | 아니오 | `entity_id`는 신규 초안일 때 NULL이 정상(000007 주석) |
| `audit_logs.actor_user_id` | 아니오 | 000002가 **DROP**했다(어드민 행위자는 `admin_users.id`라 users FK로 표현 불가). 파기 phase 3이 NULL로 만든다 |
| `audit_logs.household_id` | 아니오 | 000002가 함께 DROP. **아무도 NULL로 만들지 않는다** → D12 |
| `custom_items.deleted_by_user_id` | 아니오 | 000022가 의도적으로 뺐다(그 파일 머리말). 파기 phase 3 `:1122`가 NULL로 끊는다 |

나머지 10건(`affiliate_clicks.sub_id`·`referrer_screen_id`, `analytics_events.event_id`·
`user_anon_id`·`household_anon_id`, `refresh_tokens.family_id`, `user_devices.device_id_hash`,
`users.provider_user_id`, `audit_logs.target_id`)은 애초에 다른 표의 행을 가리키는 값이 아니다
(`target_id`만 예외 — 다형 참조라 FK가 성립하지 않는다).

---

## 3. 발견 상세

### D1 — `children.nickname`에 길이 상한이 어디에도 없다 (높음 / 소)

**어떤 상태가 만들어지는가.** 태명·별명 칸에 61자 이상을 넣고 저장하면 온보딩 3단계(아이 프로필)
또는 설정의 아이 편집이 **500 `INTERNAL_ERROR`**로 끝난다. 사용자에게는 "요청을 처리하지
못했어요"만 보이고, 다시 눌러도 같은 결과다 — DNC-018이 금지하는 틀린 안내다.

**근거.**
- 컬럼: `apps/api/prisma/migrations/000001_init/migration.sql:130` `nickname varchar(60) NOT NULL`
- DTO: `apps/api/src/onboarding/dto/child.dto.ts:12`(create)·`:46`(update) — `@IsString() @IsNotEmpty()`뿐, `@MaxLength` 없음
- 서비스: `apps/api/src/onboarding/onboarding-core.service.ts:459`·`:542`가 값을 **그대로** 넘긴다. 같은 파일의 `normalizeChildInput`(`:116~132`)은 단계 입력만 본다
- 앱: `apps/mobile/src/children/child-form.ts:271`의 유일한 닉네임 검증은 "비어 있는가"뿐이고, 입력 필드(`apps/mobile/app/(onboarding)/child-profile.tsx:229`, `apps/mobile/app/settings/children.tsx:207~210`)에 `maxLength` 속성이 없다(그 화면의 `maxLength={10}`은 날짜 칸이다)
- 실측(임시 클러스터, Prisma 6.19.3): `nickname = "가".repeat(61)`로 `child.create` →
  `PrismaClientKnownRequestError code=P2000 "The provided value for the column is too long"`
- 이 저장소에 P2000 핸들러가 없다: `grep -rn "P2000" apps/api/src` = 0건(P2003도 `expenses-store.service.ts:159` 한 자리뿐). 그래서 GlobalExceptionFilter의 500 기본 경로로 나간다

**재현 조건.** 아이 등록/수정 폼에 61자 이상을 **붙여넣기**. 한글이든 영문이든 무관(varchar는 문자 수).

**고치는 크기.** 소. `child.dto.ts` 두 자리에 `@MaxLength(60)`(상수는 `packages/domain`에 두어
앱과 공유), 앱 입력에 같은 값의 `maxLength`. 서버·앱을 함께 고치는 것이 이 저장소의 관례다
(지출 `itemName`이 `EXPENSE_ITEM_NAME_MAX_LENGTH`로 그렇게 되어 있다 —
`apps/api/src/finance/dto/expense.dto.ts:63`).

**마이그레이션 필요한가.** 아니오.

---

### D2 — 어드민 API로는 스폰서 링크를 만들 수 없다 (높음 / 소)

**어떤 상태가 만들어지는가.** 운영자가 어드민에서 상품 링크에 `isSponsored: true`를 켜면
**500**이 난다. 스폰서 표시가 있는 링크를 만들 방법이 시드와 psql뿐이라, **DNC-011("스폰서 구분
표시")을 운영자가 실제로 켤 수 있는 경로가 오늘 없다.**

**근거.**
- DB CHECK: `chk_product_links_sponsor = (is_sponsored = false OR sponsor_label IS NOT NULL)`
  (`000001_init/migration.sql:262`)
- 쓰기 경로: `apps/api/src/onboarding/items-catalog.service.ts:651`(create)·`:681`(update) 어디에도
  `sponsorLabel`이 없다. DTO에도 없다(`apps/api/src/admin/dto/admin.dto.ts:171`·`:212`는 `isSponsored`만 받는다)
- 전 저장소에서 `sponsorLabel`을 **쓰는** 자리는 `apps/api/prisma/seed.ts:220` 하나다
  (`grep -rn sponsorLabel apps packages` — 나머지는 전부 `seed-data.ts`의 값 선언)
- e2e가 그 사실을 우회로 증명한다: `apps/api/test/items-commerce.e2e.test.ts:480~492`는 DNC-011
  스폰서 링크를 만들 때 어드민 API가 아니라 **`prisma.productLink.create`로 `sponsorLabel`을 직접
  넣는다**
- 실측: `INSERT INTO product_links(..., is_sponsored) VALUES (..., true)` →
  `ERROR: new row for relation "product_links" violates check constraint "chk_product_links_sponsor"`

**재현 조건.** 어드민 → 상품 링크 → "스폰서" 토글 ON → 저장. (기존 시드 스폰서 링크를 **수정**하는
것은 통과한다 — 그 행에는 이미 라벨이 있다. 새로 켜는 것만 막힌다.)

**고치는 크기.** 소. DTO에 `sponsorLabel?: string @MaxLength(80)`을 더하고, 서비스가
`isSponsored && !sponsorLabel`이면 전용 400(`ADMIN_SPONSOR_LABEL_REQUIRED`)으로 거절.
CHECK를 서비스가 먼저 진다는 라운드 103 M-3의 규율 그대로다.

**마이그레이션 필요한가.** 아니오(컬럼·CHECK 둘 다 이미 있다).

---

### D3 — 배포 시드가 어드민 CMS 편집을 되돌리고, 링크를 중복시킨다 (높음 / 중)

**어떤 상태가 만들어지는가.** 두 갈래다.

① **되돌림.** 운영자가 어드민에서 고친 값이 다음 배포에 **원래 시드 값으로 돌아간다.**
되돌아가는 축은 다음 전부다:

| 표 | 재시드가 강제로 되돌리는 축 | 어드민이 고칠 수 있는 축 |
|---|---|---|
| `categories` | `name` · `iconName` · `displayOrder` · `active:true` · `selectable`(정식 12는 `true` 고정) — `seed.ts:24~44`, 별칭·스텁은 `:59~78` | `name` · `displayOrder` · `active` · `selectable` (`admin-categories.service.ts:104~125`) — **네 축 전부 겹친다** |
| `item_templates` | 13축 전량(`name`·`categoryId`·`necessityLevel`·`timingLabel`·가격 둘·`reasonText`·`skipReasonText`·`usedSecondhandOk`·`safetyNote`·`medicalDisclaimerRequired`·`displayOrder`·`active`) — `seed.ts:107~121` | 같은 축 전부 |
| `item_template_stages` | 시드 단계의 `priorityWeight` upsert (`seed.ts:145~160`) — **삭제는 하지 않으므로** 운영자가 뺀 단계가 되살아나고, 운영자가 더한 단계는 남는다 | `replaceItemTemplateStages`(delete-all → 재삽입) |
| `disclosures` | `text` · `active:true` (`seed.ts:84~92`) | `updateDisclosure` / CMS 발행 |
| `product_links` | 링크 행 전량(`url`·`affiliateUrl`·`affiliatePartnerCode`·`isAffiliate`·`isSponsored`·`sponsorLabel`·가격·`displayOrder`·`active`·`disclosureText`) — `seed.ts:209~240` | 같은 축 전부 + CSV 벌크 |

② **중복.** `product_links`에는 `code` 같은 안정된 키가 없어, 시드가
`findFirst({ itemTemplateId, platform, title })`로 자기 행을 찾는다(`seed.ts:201~207`).
**`title`은 운영자가 어드민에서 바꿀 수 있는 값이다**(`admin.dto.ts:195` `title?`). 제목을 한 글자
고치면 다음 시드는 그 행을 자기 것으로 알아보지 못하고 **`create`로 두 번째 링크를 만든다**
(`seed.ts:239`). 두 링크 모두 `active`이고 각자의 `redirect_code`를 가지므로, 준비템 상세에
**같은 상품의 구매 CTA가 둘** 뜬다.

**근거.** 시드가 배포에서 실제로 돈다: `scripts/deploy/oracle-bootstrap.sh:188`
(`exec -T api pnpm --filter api seed`). 바로 위 `:186` 주석은
"시드는 기존 관리자 계정의 비밀번호/활성 상태를 **절대 덮어쓰지 않는다**(ADM-007)"라고 적는데,
그 배려는 `admin_users` **하나에만** 되어 있다(`seed.ts:243~`의 `seedAdminUsers`는 기존 계정을
건너뛴다). 콘텐츠 표 다섯은 그 반대다. CI도 같은 시드를 돌린다(`.github/workflows/ci.yml:62~63`).

라운드 65가 이 성질의 **한 조각**을 이미 적었다(`docs/5차/round65-scout.md:298` — disclosure의
`text`가 시드에 복구된다). 오늘 새로 값이 되는 것은 (a) 그 성질이 표 다섯에 걸쳐 있다는 것,
(b) **배포 경로가 그 시드를 돌린다**는 것, (c) `product_links`는 되돌림이 아니라 **증식**이라는 것이다.

**재현 조건.** 어드민에서 카테고리 이름/노출을 고치거나 링크 제목을 고친 뒤 재배포
(또는 `pnpm db seed`).

**고치는 크기.** 중. 두 갈래를 따로 판단해야 한다.
- 되돌림: 시드 `update` 갈래를 "생성 시에만 채운다"로 좁히거나(= `create`만), 운영자가 고친
  축을 표시하는 칸을 두는 것 둘 중 하나 — **어느 쪽이든 계약 판단이라 PM 확인이 먼저다**
  (시드가 콘텐츠의 단일 소스인지 아닌지를 정하는 일이다).
- 중복: `product_links`에 시드 식별자(예: `seed_key varchar` 유니크)를 두고 그것으로 매칭.
  이건 마이그레이션이 필요하다.

**마이그레이션 필요한가.** 되돌림은 아니오, 중복은 **예**(안정된 시드 키 컬럼).

---

### D4 — `categories` CASCADE를 막는 마지막 참조: `item_templates.category_id` (중 / 소)

**어떤 상태가 만들어지는가.** 두 갈래다.

① **500(쉽게 밟힌다).** 어드민 준비템 생성/수정이 `categoryId`의 **존재를 확인하지 않는다.**
형식만 맞는 uuid를 보내면 FK 위반이 그대로 500으로 나간다.

② **가구 파기 영구 차단(밟기 어렵지만 결과가 무겁다).** 어드민이 준비템의 `categoryId`에
**어떤 가구의 커스텀 분류 id**를 넣으면 FK가 그것을 그대로 받는다. 그 뒤 그 가구가
탈퇴·파기 대상이 되면 `tx.household.deleteMany`가 `categories` CASCADE를 일으키고,
그 삭제를 `item_templates_category_id_fkey`가 막는다 → phase 3 트랜잭션이 통째로 실패 →
재시도·반감·poison-skip 에스컬레이션(`data-retention-purge.job.ts:879~915`)을 거쳐
**그 사용자의 개인정보가 영원히 파기되지 않는다.** 잡은 매 틱 실패를 summary에 남기지만
(`:847~`), 원인이 "어드민이 붙인 분류"라는 사실은 어디에도 나오지 않는다.

**근거.**
- 검증 부재: `apps/api/src/onboarding/items-catalog.service.ts:582`
  (`categoryId: input.categoryId ?? null`)·`:613`. `normalizeAdminItemTemplateInput`(`:1099~1140`)은
  `categoryId`를 아예 다루지 않는다. DTO는 `@IsUUID()`뿐(`admin/dto/admin.dto.ts:30`·`:89`)
- 어드민 목록은 시드만 보여 준다(`admin-categories.service.ts:77` `where: { householdId: null }`)
  — 그래서 UI로는 고르지 못하지만, **API는 임의의 uuid를 받는다.** CMS 발행 경로도 결국 같은
  메서드를 지난다(`admin/content-revisions.service.ts` 머리말 `:91~103`)
- 실측(임시 클러스터, 한 트랜잭션):
  ```
  INSERT categories(household_id=H, is_system=false);      -- 커스텀 분류
  INSERT item_templates(category_id=그 분류);               -- 어드민이 붙인다
  DELETE FROM households WHERE id=H;                        -- 파기 잡 phase 3의 마지막 문장
  → ERROR: update or delete on table "categories" violates foreign key constraint
    "item_templates_category_id_fkey" on table "item_templates"
  ```
- `categories`를 가리키는 나머지 셋은 안전하다: `expenses`·`import_rows`는 `purgeChildRows`가
  가구 삭제 **앞에** 지우고(`:1020~1056`), `category_budgets`는 `child_id` CASCADE로 함께 사라진다

**재현 조건.** ① `PATCH /admin/items/:id`에 존재하지 않는 uuid. ② 어드민(또는 CMS 페이로드)이
커스텀 분류 id를 붙인 상태에서 그 가구의 마지막 멤버가 탈퇴 후 파기 창을 지난다.

**고치는 크기.** 소. `adminCreate/UpdateItemTemplate`이 `category.findFirst({ id, householdId: null })`로
**시드 분류인지**까지 확인하고 400으로 거절. 어드민 목록이 이미 `system-only`이므로 계약 변경은 없고,
`test/category-owner-scope.test.ts`의 소유자 필터 대장에 두 자리를 등재하면 다음 라운드가 같은 자리를
다시 열지 못한다.

**마이그레이션 필요한가.** 아니오.

---

### D5 — `custom_items` tombstone에 파기 phase가 없다 (중 / 소~중)

**어떤 상태가 만들어지는가.** 사용자가 지운 커스텀 준비물의 행이 **영원히 남는다.**
그 행에는 사용자 자유 문자열(`name varchar(80)`)이 들어 있다. 지출은 같은 자리에서
phase 1이 `PURGE_RETENTION_DAYS` 뒤 하드 삭제하는데, 커스텀 준비물은 소프트 삭제 절반만 있다.

**근거.**
- 소프트 삭제: `apps/api/src/onboarding/custom-items.service.ts:123~131`. 그 메서드의 doc comment는
  스스로 **"지출 DNC-014와 같은 관례"**라고 적는다(`:118`) — 지출의 그 관례에는 phase 1이 딸려 있다
- 파기 잡: `grep -n "customItem" apps/api/src/worker/jobs/data-retention-purge.job.ts` = 5자리이고
  전부 **다른 일**이다 — `:1122`(`deletedByUserId` NULL 끊기), `:1233~1234`·`:1745`·`:1754`(사용자
  파기의 참조 차단 검사). `deletedAt`을 술어로 쓰는 자리가 0건이다
- 지우는 유일한 길: `child_id` ON DELETE CASCADE(000022) — 즉 **아이가 물리 파기될 때뿐**이다
- 같은 라운드 100 설계 문서에도 이 축이 없다(`docs/5차/round100-custom-items-design.md`에서
  `deleted_at`은 부분 색인 정의 두 줄에만 나온다)

**같은 자리의 문서 결함.** 파기 잡 클래스 문서 `:672~686`은
> "시간 창이 **없는** 표는 둘이고 … **여기에 없는 표는 위 phase 중 하나가 덮고 있고**"

라고 **완전성**을 선언한다. 그 문장은 GAP-068 시점에는 참이었지만 000022~000024가 표 둘과
소유 컬럼 하나를 더하면서 낡았다. 오늘 그 목록에 빠져 있는 것은 셋이다:
`custom_items`·`category_budgets`·`categories`의 커스텀 행. 셋 다 phase가 없고 FK 캐스케이드에만
기댄다. 그중 **둘은 그래도 괜찮다**(`category_budgets`는 tombstone이 없고 (아이,월,분류)당 1행,
`categories` 커스텀 행은 설계 §1.6이 하드 삭제를 명시적으로 배제했다). **`custom_items`만 실제
결함이다** — tombstone이 있는 유일한 표이기 때문이다.

**재현 조건.** 커스텀 준비물을 만들고 지운 뒤 아이를 파기하지 않는다(= 정상 사용).

**고치는 크기.** 소~중. phase 1(`purgeExpenses`)과 **같은 모양**의 phase를 하나 더한다
(`deletedAt < cutoff`, `(deletedAt, id)` 전순서, 같은 `runPhase` 기계). 부분 색인
`idx_custom_items_child_active`는 `deleted_at IS NULL` 쪽이라 이 선택에 쓸 수 없으므로,
지출이 000011 §1에서 `idx_expenses_deleted_purge`를 얻은 것과 같은 판단을 다시 해야 한다.
**클래스 문서의 완전성 문장은 그와 별개로 지금 고쳐야 한다**(문서 한 단락).

**마이그레이션 필요한가.** phase만 더하면 아니오. 파기 배치가 실측으로 seq scan이면
부분 색인 하나(예 — 000011의 관례).

---

### D6 — 어드민 카테고리 이름 변경에 중복 검사가 없다 (중 / 소)

**어떤 상태가 만들어지는가.** 운영자가 시드 카테고리 이름을 다른 카테고리(시드든, 어느 가구의
커스텀이든)와 같게 바꾸면, 그 순간부터 앱에서 **칩 하나가 조용히 사라지고**, 기록 탭의 남은 칩이
사라진 칩의 지출까지 자기 합계로 끌어온다 — 사용자가 그 칩을 눌러 보는 금액이 사실이 아니게 된다.

**근거.**
- 쓰기: `apps/api/src/admin/admin-categories.service.ts:104~125`. `name: input.name?.trim()`을
  그대로 넣고, **중복 검사가 없다**(DTO에도 없다 — `admin/dto/admin-categories.dto.ts`)
- 라운드 103이 같은 불변식을 커스텀 쪽에서는 지킨다:
  `apps/api/src/households/custom-categories.service.ts`의 `requireUniqueName`은 비교 모집단을
  **① 시드 21행 전량의 이름 + ② 그 가구의 커스텀 전량**으로 잡는다(그 메서드의 doc comment).
  즉 규칙은 이미 문서화된 불변식인데, **어드민 쪽 쓰기만 그 규칙 밖에 있다**
- DB는 이 방향을 잡지 못한다: `uq_categories_household_name`은 부분 색인
  `WHERE household_id IS NOT NULL`이라(000024) **시드 행이 색인 밖**이다. 000024가 그 사실을
  스스로 적었다 — "①은 … 부분 색인 밖이고, 그 축은 서비스 검사가 유일한 방어선이다"
- 피해의 기제(앱):
  - `apps/mobile/src/categories.ts:373~396` `selectableCategories` — 같은 이름끼리 한 슬롯을 다투고,
    `rank`가 동률이면(둘 다 시드 정식 = 1, 또는 시드 정식 vs 커스텀 = 1) **뒤에 온 행이 버려진다**
  - `apps/mobile/src/expenses/records-list-view.ts:112~118` `idsByName` — 이름이 같은 모든 id를
    한 그룹으로 묶어 `matchIds`로 쓴다. 그래서 살아남은 칩이 사라진 칩의 지출을 함께 센다
  - 이 두 기제는 라운드 103이 커스텀 이름 규칙을 만든 **바로 그 근거**다(`requireUniqueName` doc comment)

**재현 조건.** 어드민 → 카테고리 → 아무 시드 행의 이름을 다른 시드 행과 같게 저장.
(커스텀과 겹치게 하려면 그 가구의 커스텀 이름을 알아야 하지만, 시드끼리는 목록만 보면 된다.)

**고치는 크기.** 소. `AdminCategoriesService.update`가 저장 전에
`category.findFirst({ where: { id: { not }, name: 정규화 } })`를 한 번 보고 400으로 거절.
정규화 규칙은 이미 한 벌 있다(`custom-categories.service.ts`의 `duplicateKey`) — 그것을 공유하면
두 쓰기 경로가 같은 뜻을 진다. **커스텀 행까지 모집단에 넣을지는 판단이 필요하다**
(어드민이 사용자 분류 이름을 보게 되므로 — 라운드 103이 어드민 표를 system-only로 좁힌 결정과 맞물린다.
"몇 건 겹친다"만 알려 주고 이름은 보여 주지 않는 형태가 그 결정과 어긋나지 않는다).

**마이그레이션 필요한가.** 아니오. (DB로 옮기려면 전역 유니크 식 색인이 필요한데, 그건 오늘 시드
21행 안에서 이미 참인지부터 확인해야 하는 파괴적 판단이다 — 서비스 검사가 맞는 크기다.)

---

### D7 — 어드민 준비템 가격: 두 개의 500 (중 / 소)

**어떤 상태가 만들어지는가.** ① `priceMinKrw > priceMaxKrw`로 저장하면 500.
② 가격에 2,147,483,647을 넘는 값을 넣으면 500(`integer out of range`).

**근거.**
- CHECK: `chk_item_templates_price_range (price_min_krw <= price_max_krw)` (`000001:180~182`)
- DTO: `admin/dto/admin.dto.ts:40~47`·`:102~110` — `@IsInt() @Min(0)`만 있고 **`@Max`가 없다**.
  같은 저장소의 다른 금액 칸은 전부 `@Max(MONEY_KRW_MAX)`를 문다
  (`finance/dto/expense.dto.ts`, `onboarding/dto/upsert-budget.dto.ts:26`)
- 서비스: `normalizeAdminItemTemplateInput`(`items-catalog.service.ts:1099~1140`)은 두 값을
  대소 비교하지 않는다
- 실측: `INSERT ... (price_min_krw, price_max_krw) VALUES (100, 10)` →
  `violates check constraint "chk_item_templates_price_range"`;
  `price_min_krw = 2147483648` → `ERROR: integer out of range`

**재현 조건.** 어드민 준비템 편집에서 최소가 > 최대가를 저장, 또는 가격에 큰 수를 입력.

**고치는 크기.** 소. DTO에 `@Max(MONEY_KRW_MAX)` 둘, `normalizeAdminItemTemplateInput`에
대소 검사 한 줄(전용 400 코드).

**마이그레이션 필요한가.** 아니오.

---

### D8 — `disclosure_text` 길이 상한이 DTO에 없다 (낮음~중 / 소)

**어떤 상태가 만들어지는가.** 어드민이 상품 링크의 고지 문구를 201자 이상으로 저장하면 500.
운영자가 DNC-010의 제휴 고지를 길게 쓰려다 저장을 못 하고, 화면에는 원인이 나오지 않는다.

**근거.** 컬럼 `disclosure_text varchar(200)`(`000001:264`), DTO `admin.dto.ts:173~175`·`:214~216`은
`@IsOptional() @IsString()`뿐. 서비스는 `cleanOptionalText`(trim)만 한다
(`items-catalog.service.ts:673`·`:708~709`). 실측: 201자 INSERT →
`ERROR: value too long for type character varying(200)`.

**고치는 크기.** 소(`@MaxLength(200)` 둘). **마이그레이션 필요한가.** 아니오.

---

### D9 — `pushToken`의 상한이 문자 수라 바이트 상한을 못 막는다 (낮음 / 소)

**어떤 상태가 만들어지는가.** 기기 등록이 500. `POST /me/devices`는 앱 부팅·권한 변경·토큰
로테이션마다 도는 상시 경로다(000015 머리말).

**근거.** DTO 주석이 스스로 이렇게 적는다 — "~2704바이트를 넘으면 P2002가 아닌 index row size
오류를 내는데 … DTO에서 먼저 400으로 거른다"(`apps/api/src/devices/dto/device.dto.ts:12~20`).
그런데 실제 게이트는 `@MaxLength(2000)`으로 **문자** 수다(`:19`). 유니크 색인
`uq_user_devices_user_push_token`(000010)은 **바이트**로 잰다.
실측(임시 클러스터): 무작위 한글 2000자(6000바이트) → `PostgresError code 54000
"index row size 6032 exceeds btree version 4 maximum"`, Prisma가 `ConnectorError`로 감싸므로
`code`가 undefined다(= P2002 재시도 경로에 걸리지 않는다). ASCII 2000자(2000바이트)는 통과한다 —
**게이트가 ASCII에만 맞다.**

**재현 조건.** 클라이언트가 멀티바이트 문자로 채운 2000자 토큰을 보낸다(정상 Expo/FCM 토큰은
ASCII라 실사용에서는 밟히지 않는다 — 악의적/버그 클라이언트 축이다).

**고치는 크기.** 소. `@MaxLength`를 유지하되 바이트 기준 검사를 하나 더하거나(약 2600바이트),
문자 상한을 안전한 값(예 800)으로 낮춘다. **마이그레이션 필요한가.** 아니오.

---

### D10 — 롤백 안전지대가 없는 마이그레이션이 000024 말고 넷 더 있다 (낮음~중 / 문서)

라운드 103이 000024에 대해 적은 판정("커스텀 행이 하나라도 생긴 뒤에는 되돌릴 방법이 둘 다
위험하다" — `000024_categories_household_owner/migration.sql:22~30`)과 **같은 성질**의 자리를
전수로 찾았다. 결과는 넷이고, 넷 다 그 사실이 적혀 있지 않다.

| 마이그레이션 | 왜 되돌릴 수 없는가 | 실측 |
|---|---|---|
| **000008** `affiliate_clicks_nullable_actor` | 공개 리다이렉트의 익명 클릭 한 건, 또는 파기 phase 2·3의 익명화 한 번이면 NULL이 생긴다. 그 뒤 `SET NOT NULL`은 실패한다 — 즉 **파기 잡이 정상 동작할수록 되돌릴 수 없어진다** | 익명 클릭 1행 삽입 후 `ALTER ... SET NOT NULL` → `ERROR: column "user_id" ... contains null values` |
| **000005** `import_rows_validation_status_len` | `low_confidence_duplicate_candidate`(35자)가 한 행이라도 저장되면 `varchar(30)`으로 되돌아갈 수 없다 | 그 값 1행 삽입 후 `ALTER ... TYPE varchar(30)` → `ERROR: value too long for type character varying(30)` |
| **000010** `user_devices_unique_token` | 이 저장소에서 **행을 실제로 삭제하는 유일한 마이그레이션**이다(`DELETE FROM user_devices a USING user_devices b ...`). 인덱스를 드롭해도 지워진 기기 행은 돌아오지 않는다 | 파일 `:14~21` |
| **000003** `round4_domain` | `children.prepared_items_set_at`은 그 파일 스스로 "child_item_statuses 행만으로는 표현할 수 없다"고 적은 값이다. 컬럼을 드롭하면 **"이 단계를 한 번은 마쳤다"는 사실의 유일한 기록**이 사라진다 | 파일 `:5~13` |

**재실행(re-run) 안전성은 별개 축이고, 그쪽은 거의 깨끗하다.** 25개 전부를 빈 DB에 순서대로 적용한
뒤 **같은 순서로 한 번 더** 돌렸다: 24개가 성공하고 **000007 하나만 실패**했다 —
`ERROR: relation "uq_product_links_redirect_code" already exists`
(`000007_round5_cms_oauth_analytics/migration.sql:80`의 `ADD CONSTRAINT`에 `IF NOT EXISTS`가 없다).
000011 이후 파일들이 머리말에 "재실행 안전(IF NOT EXISTS)"이라고 적는 관례는 실제로 지켜지고 있고,
예외는 그 관례가 생기기 전의 000007뿐이다. `migrate deploy`는 같은 마이그레이션을 두 번 돌리지
않으므로 **오늘 사고를 내는 자리는 아니다** — `_prisma_migrations`를 잃은 DB에 다시 적용하는
복구 시나리오에서만 걸린다.

**고치는 크기.** 문서. 네 마이그레이션의 머리말에 000024와 같은 형식의 ⚠️ 한 문단씩,
그리고 000007에는 "재실행 불가" 한 줄. **마이그레이션 필요한가.** 아니오(기존 파일은 수정하지
않는 것이 이 저장소의 관례이므로, 주석을 새 파일이 아니라 원본 파일에 다는 것이 맞는지는
DNC 판단이다 — 대안은 `docs/operations`에 한 표를 만드는 것이다).

---

### D11 — `category_budgets.amount_krw`에 `> 0` CHECK가 없다 (낮음 / 소)

`budgets.amount_krw`와 `expenses.amount_krw`는 둘 다 `CHECK (amount_krw > 0)`을 진다
(`000001:220`·`:203`). `category_budgets.amount_krw`는 `int NOT NULL`뿐이다
(`000023_category_budgets/migration.sql:12`). 서비스는 막는다
(`upsert-budget.dto.ts:24~26` `@Min(1) @Max(MONEY_KRW_MAX)` + `requireMoneyKrw`).
즉 오늘 뚫리지는 않지만, **같은 뜻의 값 셋 중 하나만 DB 방어선이 없다** — 라운드 102가
`chk_category_budgets_first_day`를 "budgets의 chk_budgets_first_day와 같은 형식"으로 일부러
복제한 것과 어긋나는 자리다(그 파일 `:16~17`).

**고치는 크기.** 소. **마이그레이션 필요한가.** 예(`ADD CONSTRAINT ... CHECK (amount_krw > 0)`,
additive·기존 행 전부 통과).

---

### D12 — `audit_logs.household_id`가 없는 가구를 가리킨 채 남는다 (낮음 / 문서)

가구가 하드 삭제돼도 그 가구의 감사 로그는 남고(설계상 옳다 — 클래스 문서 item 3),
phase 3은 `actorUserId`만 NULL로 만든다(`data-retention-purge.job.ts:1127~1130`).
`household_id`는 손대지 않는데 그 컬럼의 FK는 000002가 이미 DROP했으므로
(`000002_round4_auth_admin/migration.sql:12~13`) DB가 막지도 않는다.
결과는 **존재하지 않는 가구를 가리키는 uuid**이고, 그 값으로 도는 조회가 실제로 있다
(`idx_audit_logs_household_created`를 타는 어드민 뷰어 필터).

법적 결함은 아니다(가구 id는 그 자체로 개인정보가 아니고, 남기는 것이 감사 기록의 성질이다).
문제는 **그렇게 하기로 했다는 문장이 어디에도 없다**는 것이다 — `actorUserId`는 왜 NULL로
만드는지가 클래스 문서에 길게 적혀 있는데, 바로 옆 컬럼을 왜 남기는지는 없다.
다음 사람이 "빠뜨린 자리"로 읽고 phase를 더할 위험이 그대로 있다(라운드 68이
`push_boundary_marks`에 그 위험을 막으려고 "여기에 phase를 추가하지 말 것"을 적은 것과 같은 종류).

**고치는 크기.** 문서 한 단락(파기 잡 클래스 문서 item 3, 또는 schema.prisma의 `AuditLog` 머리말).

---

## 7. 이미 안전한 축 — 값으로 (다음 라운드가 다시 파지 않도록)

**이 절의 목적은 "확인했고 문제없다"를 값으로 남기는 것이다.** 아래는 전부 이번 라운드에 실제로
대조하거나 실행한 결과다.

### 7.1 마이그레이션 25개는 빈 DB에 그대로 선다
번호 순 적용 25/25 성공(PostgreSQL 16). 재실행은 24/25 성공(예외는 D10의 000007).

### 7.2 아이 파기 — `children`을 가리키는 FK **전부**가 덮여 있다
카탈로그의 10건 대 `purgeChildRows`(`data-retention-purge.job.ts:1020~1057`)를 1:1로 대조했다.
누락 0건.

| FK | 잡의 처리 |
|---|---|
| `expenses.child_id` | `deleteExpensesHard` (`:1039`) |
| `import_jobs.child_id` | `deleteMany` (`:1042`) |
| `import_rows.import_job_id` | 잡보다 먼저 `deleteMany` (`:1031`) |
| `child_item_statuses.child_id` | `deleteMany` (`:1033`) |
| `attachments.child_id` | `deleteMany` (`:1035`, 언제나 빈 표) |
| `budgets.child_id` | `deleteMany` (`:1044`) |
| `affiliate_clicks.child_id` | `updateMany` NULL (`:1045~1048`) |
| `households.default_child_id` | `updateMany` NULL (`:1049~1052`) |
| `custom_items.child_id` | SQL CASCADE (000022) |
| `category_budgets.child_id` | SQL CASCADE (000023) |
| `push_boundary_marks.child_id` | SQL CASCADE (000013) |

### 7.3 사용자 파기 — NOT NULL user FK **12개 = 검사 12개**, 정확히 일치
`selectPurgeableStubs`(`:1224~1242`)의 `NOT EXISTS` 12개와 카탈로그의 NOT NULL user FK 12개가
집합으로 같다: `households.owner_user_id` · `expenses.created_by_user_id` ·
`budgets.created_by_user_id` · `child_item_statuses.updated_by_user_id` ·
`custom_items.created_by_user_id` · `custom_items.updated_by_user_id` ·
`attachments.uploaded_by_user_id` · `import_jobs.user_id` · `user_devices.user_id` ·
`household_members.user_id` · `household_invites.invited_by_user_id` · `consents.user_id`.
nullable 넷(`affiliate_clicks.user_id` · `expenses.deleted_by_user_id` ·
`household_invites.accepted_by_user_id` · `household_members.invited_by_user_id`)은 phase 3이
NULL로 끊고, FK 없는 셋(`refresh_tokens` · `idempotency_keys` · `custom_items.deleted_by_user_id`)도
명시적으로 다뤄진다. **라운드 100이 `custom_items`를 이 목록에 편입시킨 것이 실제로 지켜져 있다.**

### 7.4 금액의 오버플로 경계 — 닫혀 있다
- 단일 값: `MONEY_KRW_MAX = 2_147_483_647` = int4 상한(`packages/contracts/src/schemas.ts:59`,
  `schemas.test.ts:55`가 그 등식을 문다). 지출·총액 예산·카테고리 예산 셋이 같은 상수를 쓴다
- **합계**: Prisma 6.19.3의 `aggregate._sum` / `groupBy._sum`이 int4를 넘는 합계를 정상 반환한다.
  실측 — 아이 하나에 `MONEY_KRW_MAX` 지출 2건을 넣고
  `expense.aggregate({_sum:{amountKrw}})` → `{"_sum":{"amountKrw":4294967294}}`,
  `groupBy(["categoryId"], {_sum})` → 같은 값. **500도, 잘림도, 정밀도 손실도 없다.**
  (`milestone-report.service.ts:61~69`, `reporting-store.service.ts:145`, `push-dispatch.service.ts:200`,
  `expenses-store.service.ts:598` 넷이 이 경로다.)
  → **"합계가 int4를 넘으면 홈이 깨진다"는 가설은 거짓이다. 다시 파지 말 것.**
- 어드민 가격 둘만 상한이 없다 → D7

### 7.5 날짜의 타임존 취급 — 닫혀 있다
- `@db.Date` 왕복이 **프로세스 TZ와 무관**하다. 실측: `TZ=UTC` / `TZ=Asia/Seoul` /
  `TZ=America/Los_Angeles` 세 번 모두 `expenses.spent_on`·`budgets.year_month`가
  `2026-09-01T00:00:00.000Z`로 읽히고 `fromDateOnly()` 결과가 `2026-09-01`로 동일하다.
  근거는 헬퍼가 UTC 자정을 명시하기 때문이다(`apps/api/src/onboarding/store-shared.ts:80~86`
  `new Date(\`${d}T00:00:00.000Z\`)` / `toISOString().slice(0,10)`)
- 월 범위는 **문자열 연산만** 한다 — `getSeoulMonthRange`(`packages/domain/src/money-date.ts:64~84`)는
  `Date`를 만들지 않고 `YYYY-MM-01` / 다음 달 `01` 문자열을 돌려준다. 시프트가 생길 자리가 없다
- `chk_budgets_first_day` / `chk_category_budgets_first_day`는 서비스가 항상 정규화한 값을 넣으므로
  뚫리지 않는다(`onboarding-core.service.ts:701~703`)
- 남는 비대칭은 표현형 하나뿐이다: `budgets.year_month`는 `date`, `push_boundary_marks.year_month`는
  `varchar(7)`(서울 기준 월). 둘 다 자기 자리에서 일관되고 서로 조인하지 않는다 —
  **결함이 아니라 두 표기다**

### 7.6 라운드 102·103 리뷰가 닫은 자리는 실제로 닫혀 있다
- 커스텀 분류 이름 P2002 → 400 번역(라운드 103 M-3): `custom-categories.service.ts`의
  `translateNameUniqueViolation` / `isNameUniqueViolation`가 살아 있고, P2002가 아닌 오류는 다시 던진다
- 지출의 `categoryId` 소유자 스코프(라운드 103 §1.9 #6): `requireExistingCategory`가
  `{ id, OR: [{householdId:null},{householdId}] }`를 진다(`expenses-store.service.ts:466~478`) —
  **남의 가구 분류 id로는 지출을 만들 수 없다**
- 카테고리 예산의 소유자 스코프(라운드 103 §1.9 #9): `requireBudgetableCategories`가
  `child.householdId`로 좁힌다(`onboarding-core.service.ts:762~768`, `:844~`)
- 배열 안 `categoryId` 중복 → 400(`@ArrayUnique`, `upsert-budget.dto.ts:98`),
  `categoryBudgets: null` → 400(`@ValidateIf`, `:96`) — 라운드 102 M-3
- 어드민 카테고리 조회 셋이 전부 `householdId: null`(라운드 103 §1.9 #2~4)

### 7.7 사용자 입력 길이·타입 게이트 중 **닫혀 있는** 것들
`expenses.item_name`/`merchant`/`memo`(`finance/dto/expense.dto.ts:63`·`68`·`77`),
`import_jobs.file_name`(SEC-115 F2, `imports/dto/import.dto.ts:11` `@MaxLength(255)`),
기기 등록 전 필드(`devices/dto/device.dto.ts` — platform `@IsIn`, appVersion 32, osVersion 64,
deviceIdHash 128 전부 컬럼 폭과 일치), 커스텀 준비물 이름 80, 커스텀 분류 이름 50,
준비템 상태 메모 계열. `households.name`은 서버 리터럴("우리 가족",
`household-runtime.service.ts:225`)이라 사용자 입력이 닿지 않는다.
**빠진 것은 `children.nickname` 하나다** → D1.

### 7.8 어드민 계정·세션의 고아 위험은 오늘 0이다
`admin_sessions.admin_user_id`와 `content_revisions.author_admin_id`는 FK가 없지만,
전 저장소에 `adminUser.delete`가 **0건**이다(`admin-users.controller.ts:165`는 `update`로
`active`를 뒤집을 뿐). 즉 부모 행이 사라질 경로가 없다. **어드민 계정 삭제 기능을 만드는 라운드가
오면 이 두 컬럼이 먼저 검토 대상이다.**

---

## 8. 권고 (5)

1. **D1을 먼저 고친다.** 이번 감사에서 가장 값싸고 가장 자주 밟히는 자리다 — 핵심 루프의 입구
   (아이 프로필)에서 사용자가 붙여넣기 한 번으로 500을 본다. `@MaxLength(60)` + 앱 `maxLength`.
   같은 커밋에서 D7·D8·D9(전부 DTO 한 줄)를 함께 닫으면 "DB가 막는데 서비스가 안 막는 자리"가
   이번 라운드에 전부 사라진다.
2. **D2는 DNC 축이라 별도로 다룬다.** 스폰서 라벨을 쓸 수 없는 것은 성능·편의가 아니라
   **DNC-011의 구분 표시를 운영이 만들 수 없다**는 뜻이다. `sponsorLabel`을 어드민 DTO·서비스에
   여는 작업 하나이고, e2e가 이미 그 상태를 우회로 만들고 있으므로 그 픽스처를 어드민 API 호출로
   바꾸는 것이 회귀 방지다.
3. **D3은 코드가 아니라 결정이 먼저다.** "시드가 콘텐츠의 단일 소스인가, 어드민이 단일 소스인가"를
   PM이 정하지 않으면 어느 방향으로 고쳐도 다음 라운드에 뒤집힌다. 다만 **`product_links`의 중복
   증식만은 그 결정과 무관하게 결함이므로** 안정된 시드 키를 먼저 넣는다(마이그레이션 1건).
4. **D5의 문서 한 단락을 지금 고친다.** 파기 잡 클래스 문서의 "여기에 없는 표는 위 phase 중 하나가
   덮고 있다"는 문장은 지금 **거짓**이고, 그 문장이야말로 다음 사람이 파기 정합을 검토할 때 가장
   먼저 읽는 줄이다. 코드 변경(custom_items tombstone phase)은 그 다음이어도 된다.
5. **D10의 표를 `docs/operations`에 한 번 만든다.** 마이그레이션마다 "롤백하면 무엇이 사라지는가"를
   한 줄씩 적은 표가 없어서, 라운드 103이 000024에 대해 힘들게 내린 판정이 다른 넷에는 없다.
   원본 마이그레이션 파일에 주석을 다는 것(000001~ 수정 금지 관례와 충돌)보다 이쪽이 안전하다.

---

## 9. 교집합 없는 소유 파일 (후속 작업 배분용)

이 정찰의 산출물은 이 문서 하나뿐이고 소스는 한 줄도 고치지 않았다. 아래는 위 권고를 실제로
수행할 때 **서로 겹치지 않게** 나눌 수 있는 소유 단위다.

| 작업 | 소유 파일 (배타) |
|---|---|
| **A. D1** 아이 별명 길이 | `apps/api/src/onboarding/dto/child.dto.ts` · `packages/domain/src/`(상수 1개) · `apps/mobile/src/children/child-form.ts` · `apps/mobile/app/(onboarding)/child-profile.tsx` · `apps/mobile/app/settings/children.tsx` |
| **B. D2·D7·D8** 어드민 DTO·상품링크·준비템 | `apps/api/src/admin/dto/admin.dto.ts` · `apps/api/src/onboarding/items-catalog.service.ts` · `apps/api/test/items-commerce.e2e.test.ts` |
| **C. D4·D6** 카테고리 소유자·이름 방어선 | `apps/api/src/admin/admin-categories.service.ts` · `apps/api/src/admin/dto/admin-categories.dto.ts` · `apps/api/test/category-owner-scope.test.ts` |
| **D. D5** 커스텀 준비물 tombstone 파기 + 클래스 문서 | `apps/api/src/worker/jobs/data-retention-purge.job.ts` · (필요 시) 새 마이그레이션 `000026_*` |
| **E. D3** 시드 경계 | `apps/api/prisma/seed.ts` · `scripts/deploy/oracle-bootstrap.sh` · (중복 키) 새 마이그레이션 |
| **F. D9** 푸시 토큰 바이트 상한 | `apps/api/src/devices/dto/device.dto.ts` |
| **G. D10·D12** 되돌림·고아 문서 | `docs/operations/`(새 문서 1) · `apps/api/prisma/schema.prisma`(`AuditLog` 머리말) |
| **H. D11** 카테고리 예산 CHECK | 새 마이그레이션 `000027_*` 단독 |

**A~H는 파일이 겹치지 않는다.** 단 **B와 D는 새 마이그레이션 번호를 쓸 수 있으므로 번호만 조율이
필요하고**, D와 G는 둘 다 파기 잡을 언급하지만 D는 코드·G는 `schema.prisma` 주석이라 파일이 다르다.

---

*읽기 전용 감사. 소스·설정·DB 하나도 고치지 않았다. 실측에 쓴 임시 PostgreSQL 클러스터는 삭제했다.*
