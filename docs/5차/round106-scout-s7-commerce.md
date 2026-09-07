# 라운드 106 정찰 S7 — 커머스 루프 감사 (준비템 → 구매 링크 → 구매 후 기록)

- 범위: DNC-009/010/011 실행 경로 검증 · 가격 표시 잠금 · 링크 헬스 · 구매 확인 루프 · 집계 정직성
- 방식: **읽기 전용**. 소스 무변경, git 명령 0건. 모든 인용은 **2026-09-07 08:12~08:22Z에 읽은 시점**의 값이다
  (다른 에이전트 20개가 동시 편집 중 — 줄번호는 그 창에서만 유효하고, 값은 인용문으로 다시 확인할 것).
- 판정 한 줄: **DNC 위반으로 출시를 막을 것은 없다.** 셋 다 실행 경로에서 지켜지고 있고, 계약을 무는 테스트도
  오늘 실재한다. 다만 DNC-010에는 **운영이 한 번의 어드민 편집으로 앱 밖 문구에서 수수료 고지를 지울 수 있는
  틈**이 하나 있다(발견 1 — 앱 안 CTA는 안전하다).

---

## 0. DNC 판정 — 값과 근거 (이 문서의 가장 중요한 산출물)

### DNC-009 (추천 점수에 수수료율 금지) — **지켜짐**

| 확인한 것 | 근거 (파일:줄) |
| --- | --- |
| 점수 함수의 입력이 셋뿐이고 수수료 필드를 **읽는 줄이 없다** | `packages/domain/src/recommendation.ts:92-98` — `stageScore + necessityScore + statusScore`. `affiliateCommissionRate`는 타입에만 있고(`:70`) 본문 어디에도 등장하지 않는다 |
| 호출부가 둘뿐이고 둘 다 링크·금액을 넘기지 않는다 | `apps/api/src/onboarding/item-ranking.ts:140` · `apps/mobile/src/api/local-backend.ts:2071` (전체 호출부는 `sortRecommendedItems` grep 2건) |
| 계약이 **부정 단언**으로 무는 중 | `packages/domain/src/recommendation.boundary.test.ts:104-111` — 임의 수수료율 100건(0·음수·거대값·NaN)을 넣어도 기준값과 같음을 단언. 대장은 `packages/test-utils/src/dnc-guard-ledger.ts:360-375` |
| 가격도 순서에 안 들어간다 | `apps/mobile/src/items/link-price.ts:49-52` (표시 전용 선언) · `apps/api/src/onboarding/items-catalog.service.ts:140-155` (링크 정렬 입력은 `health_status` 하나) |
| 클릭 수가 랭킹으로 되먹임되지 않는다 | `apps/api/src/admin/affiliate-click-breakdown.service.ts:46-50` · 어드민 화면도 그 사실을 사용자에게 적는다(`apps/admin/app/clicks/page.tsx:176`) |

### DNC-010 (구매 CTA 인접 고지 은닉 금지) — **지켜짐 (앱 경로). 어드민 공유 경로에 틈 1건 → 발견 1**

| 확인한 것 | 근거 |
| --- | --- |
| 고지 문구는 **링크 집합**이 정하고 index 0에 매이지 않는다 | `apps/mobile/src/items/link-marker.ts:221-242` |
| 제휴가 섞이면 수수료 문장이 **반드시** 포함된다(운영 커스텀 문구여도 뒤에 이어붙는다) | 같은 파일 `:201-206` + 하드코딩 폴백 `:131` |
| 고지와 구매 CTA 사이에 아무것도 끼지 않는다 | `apps/mobile/app/items/[itemTemplateId].tsx:1292`(고지) → `:1294-1321`(찜/구매 버튼 행). 그 사이 노드 0개 |
| 고지 대상이 없으면 그리지 않는다 = 은닉이 아니라 **허위 고지 방지** | `link-marker.ts:241`(undefined) · 화면 `:1292` 삼항 |
| 앱 **밖으로** 나가는 링크에도 같은 판정이 붙는다 | `link-marker.ts:289-304`(`purchaseLinkShareMessage`) |
| 계약 테스트 실재 | `apps/mobile/src/items/link-marker.test.ts:172` (`dnc-guard-ledger.ts:376-383`) |
| 고지 문구 행을 **빈 값으로** 비울 수는 없다 | `apps/api/src/onboarding/items-catalog.service.ts:721-725` (`ADMIN_DISCLOSURE_REQUIRED`) |

### DNC-011 (스폰서 구분 표시) — **지켜짐**

| 확인한 것 | 근거 |
| --- | --- |
| 스폰서 판정이 제휴보다 **먼저**고, 경고 톤 배지 + "광고/스폰서" 캡션이 함께 선다 | `apps/mobile/src/items/link-marker.ts:48-56` |
| 구분이 **우대로 뒤집히지 않는다**: 채워진 "구매하기"는 첫 **비스폰서** 줄이 받는다 | 같은 파일 `:258-263` · 화면 `:909, 1223` |
| 화면에서 가장 큰 전폭 CTA도 같은 판정을 쓰고, 전부 스폰서면 **아예 서지 않는다** | 화면 `:937-938, 1315-1321` |
| 시드에 "활성 스폰서 링크 0건" 래칫이 있다 | `apps/api/test/seed-data.test.ts` — `expect(productLinkSeeds.some((link) => link.active && link.isSponsored)).toBe(false)` |
| 계약 테스트 실재 | `apps/mobile/src/items/link-marker.test.ts:58` (`dnc-guard-ledger.ts:385-395`) |

### 오늘의 운영 사실 (이 감사의 전제)

출시 트랙 LP-A **플랜 B**가 링크 67건 전량을 **비제휴 쿠팡 검색 URL**로 바꿨다
(`apps/api/prisma/seed-data.ts:1213-1236` · 전 행 `isAffiliate:false` · `affiliateUrl:null` ·
`disclosureText:null` · `priceSnapshotKrw:null`, 스폰서 슬롯 다섯은 `active:false`로 보존).
데모 픽스처도 같다(`apps/mobile/src/api/local-fixtures.ts:287-294`).

→ **오늘 실사용자 화면에는 제휴 고지도 스폰서 배지도 한 건도 뜨지 않는다.** 그것이 위반이 아니라
정직이다(받지 않는 수수료를 고지하면 반대 방향의 허위 표시). 동시에 **오늘 이 앱의 제휴 수익은 0**이고,
DNC-010/011이 실제로 시험되는 것은 플랜 A(파트너스 승인) 전환 순간이다 — 아래 발견 1·6·8이 전부 그
순간에 터지는 자리다.

### 가격 표시 잠금 — **잠긴 채다. 우회 경로 없음**(조사만, 무변경)

- 잠금의 문장: "준비템 가격 표시는 사용자 결정 대기 잠금"(`docs/5차/feature-round1-design.md:38`).
- 구현: 목록 타일 계약(`PreparationParityItem`)에 가격 칸이 **없고** 어댑터도 옮기지 않는다 —
  근거·재개 조건이 `apps/mobile/src/preparation/catalog-contract.ts:23-51`에 값으로 적혀 있다.
- 세션 목록의 가격은 `(tabs)/items.tsx:1071`의 **비세션 미리보기 갈래에만** 산다(발견 7 참고).
- 상세의 판매처 가격은 "가격 + 확인 시각"이 **한 객체에서만** 나오고(`link-price.ts:176-188`),
  미래 시각·180일 초과는 그리지 않는다(`:126-133`). 값만 크게 찍는 우회로가 타입으로 막혀 있다.
- 품목 메모 문구는 가격을 말할 수 없게 테스트가 문다(`apps/mobile/src/items/item-memo.test.ts:122-134`).
- 프리필도 금액을 지어내지 않는다(`[itemTemplateId].tsx:1390` 주석 · `items-catalog.service.ts:838`).

---

## 1. 요약 표

| # | 한 줄 | 심각도 | 크기 |
| --- | --- | --- | --- |
| 1 | 어드민 "공유 링크 복사"의 수수료 문장이 **런타임 편집 가능한 행 하나**에 매달려 있다 — 그 행을 수수료를 말하지 않는 문장으로 바꾸면 앱 밖 문구에서 고지가 사라진다 (DNC-010) | 높음(플랜 A 전환 시) | 작음 |
| 2 | 링크 열기 **실패** 안내가 초록 "✓" 성공 토스트로 뜬다 | 중 | 작음(테스트 1줄 동반) |
| 3 | 죽은 링크가 아무 표시 없이 서고, 클릭 3분 뒤 "구매하셨나요?"까지 묻는다 — 헬스 워커는 배포에서 꺼져 있다 | 중 | 중(운영 결정) |
| 4 | 구매율 분모가 **열리지 않은 누름**까지 센다(누름 시점 계측 vs 열린 뒤 대기 등록) | 중 | 작음(각주) / 중(계측) |
| 5 | 실제 구매↔링크 연결(`expenses.linked_product_link_id`)이 **쓰기 전용** — 정직한 구매율 재료가 DB에 있는데 아무도 안 읽는다 | 중 | 중 |
| 6 | 비세션 프리뷰가 **없는 스폰서·없는 수수료**를 말한다(플랜 B가 실데이터에서 지운 바로 그 표시) | 낮음(도달 좁음) | 작음 + **캡처 재승인 선행** |
| 7 | 프리뷰 목록이 **없는 별점·리뷰 수**("★ 4.7 (1,245)")와 BEST 배지를 말한다 | 낮음 | 작음 + **캡처 재승인 선행** |
| 8 | `sponsor_label` 열이 어디에도 나오지 않는다 — 누가 광고비를 냈는지 표시할 자리가 없다 | 낮음 | 작음 |
| 9 | 어드민 클릭 통계가 인앱 클릭과 익명 리다이렉트 클릭을 **한 수로 합치고**, 라벨은 전 행이 비제휴인데 "제휴 상품 링크"라고 적는다 | 낮음 | 작음 / 중 |
| 10 | 배포 런북이 **읽히지 않는** `AFFILIATE_DISCLOSURE_TEXT`를 설정하게 한다(하십시오체) | 낮음 | 작음(문서 3곳) |

---

## 2. 발견

### 1. 어드민 공유 문구의 수수료 고지가 편집 가능한 행 하나에 매달려 있다 (DNC-010)

**무엇이 신뢰를 깨는가.** DNC-010은 "구매 CTA 인접 위치의 고지를 숨기지 않는다"이고, 라운드 64 M-1이
그 규율을 **앱 밖으로 나가는 문구**까지 넓혔다. 앱은 그 약속을 하드코딩 상수로 지킨다
(`apps/mobile/src/items/link-marker.ts:131` `AFFILIATE_DISCLOSURE_FALLBACK_TEXT` → `:201-206`
`withAffiliateDisclosure`). **서버에는 그 상수가 없다.** 서버는 "수수료를 말하는 문장"을
`disclosures.affiliate_purchase` **행에서 읽어** 쓴다:

- `apps/api/src/onboarding/items-catalog.service.ts:983-985`
  `shareDisclosureText: link.isAffiliate ? withCommissionDisclosure(disclosureText, disclosures.get("affiliate_purchase")) : disclosureText`
- `apps/api/src/items-commerce/share-disclosure.ts:45-55` — `if (base.includes(commission)) return base;`

그 행은 **리비전 검토를 타지 않는 직접 쓰기 경로**로 언제든 갈아끼울 수 있다
(`apps/api/src/admin/admin.controller.ts:185-203`, `PUT /admin/disclosures/:key`, DTO는
`@IsString()`뿐 — `apps/api/src/admin/dto/admin.dto.ts:223-225`).
빈 문자열은 막힌다(`items-catalog.service.ts:721-725`). **막히지 않는 것은 "비어 있지 않지만 수수료를
말하지 않는" 값**이다. 그 값을 넣는 순간 `commission`이 그 문장이 되고, `base`가 곧 그 문장이라
`base.includes(commission)`이 참이 되어 **아무것도 이어붙지 않는다**. 즉 그 링크가 어드민 콘솔에서
카카오톡·블로그로 복사돼 나갈 때 수수료 사실이 한 글자도 따라가지 않는다.

이 파일 자신이 안전장치라고 적어 둔 것("그 상태는 시드가 막고, link-marker.test.ts가 affiliate_purchase
시드가 수수료를 말한다를 고정한다" — `share-disclosure.ts:40-43`)은 **시드**를 잠글 뿐, 운영이 덮어쓴
**런타임 행**은 잠그지 않는다.

**재현 조건.** ⓐ 플랜 A 전환으로 `isAffiliate:true` 링크가 생긴 뒤(오늘 시드는 0건이라 아직 무해),
ⓑ `PUT /api/v1/admin/disclosures/affiliate_purchase` `{"text":"좋은 상품이에요."}`,
ⓒ 어드민 링크 표에서 그 링크의 "공유 링크 복사" → `shareDisclosureText`에 수수료 문장 없음.
(앱 화면·앱 공유는 하드코딩 폴백이 막으므로 영향 없다 — 갈리는 것은 두 경로의 강도다.)

**크기: 작음.** 둘 중 하나. ⓐ 서버에 고정 수수료 문장 상수를 세워 `withCommissionDisclosure`의 두 번째
인자를 `disclosures.get(...) ?? 상수`로 만들거나, ⓑ 모바일의 `statesAffiliateCommission`(어절 판정,
`link-marker.ts:171-189`)을 `packages/contracts`로 승격해 서버가 같은 판정을 쓰게 한다. ⓑ가 라운드 44
N-2의 원래 의도(판정 한 벌)에 맞지만 문구 사본이 늘지 않게 상수도 같은 자리로 옮겨야 한다.

### 2. 링크 열기 **실패** 안내가 성공 토스트로 뜬다

**무엇이 루프를 끊는가.** 핵심 루프 4단계에서 유일하게 남는 실패 신호가 **초록 체크 아이콘**을 달고 뜬다.

- `apps/mobile/app/items/[itemTemplateId].tsx:1459` — `{linkFailureNotice ? <Toast message={linkFailureNotice} /> : null}` (tone 미지정)
- `apps/mobile/src/ui.tsx:1468-1497` — `tone = "success"` 기본값 → `{isError ? "⚠" : "✓"}`, 색은 `theme.colors.success`

같은 화면의 상태 변경 실패는 제대로 `tone="error"`를 준다(`:1409`). 즉 규율은 이미 이 파일 안에 있고
이 한 줄만 빠졌다. 사용자가 보는 것은 `✓ 링크를 열지 못했어요. 다시 시도해 주세요.`
(문구 단일 소스: `apps/mobile/src/items/link-marker.ts:337, 347`).

**재현 조건.** 기내 모드/브라우저 없는 기기에서 판매처 행 또는 "바로 구매하기" 누름 →
`clickLink.onSuccess`의 `catch` 또는 `onError` 갈래(`:717-760`) → 위 토스트.

**크기: 작음.** `tone="error"` 한 프롭. ⚠️ **소스 문자열 계약이 함께 걸린다** —
`apps/mobile/src/items/expense-link-prompt.test.ts:300`이 현재 JSX 문자열을 그대로 잠그고 있어
같은 커밋에서 고쳐야 한다.

### 3. 죽은 링크가 표시 없이 서고, 그 클릭이 구매 확인까지 간다

**무엇이 신뢰를 깨는가.** 사용자는 "구매하기"를 눌러 판매처 404를 만나고, 앱으로 돌아오면 3분 뒤
`『기저귀』 구매하셨나요?`를 받는다 — **사용자가 상품 페이지를 본 적조차 없는데** 구매를 묻는다.

- 대기 등록은 `Linking.openURL`이 던지지 않았는가만 본다(`[itemTemplateId].tsx:568-585`가 정의,
  호출은 `:723`(`onSuccess`)·`:642`(재시도)). `openURL`은 목적지가 404여도 성공한다.
- 서버는 죽은 링크를 알 수 있지만 **오늘은 모른다**: 워커가 배포에서 꺼져 있다 —
  `scripts/launch/prepare.ts:284` · `scripts/deploy/oracle-bootstrap.sh:155` 둘 다 `LINK_HEALTH_ENABLED=0`
  (`apps/api/src/worker/jobs/link-health.job.ts:78`이 `=== "1"`만 참).
- 따라서 `health_status`가 전량 null이라 **강등 정렬**(`items-catalog.service.ts:140-155`)도
  **공유 URL 차단**(`:313-317`)도 무동작이다. 그 사실은 저장소가 이미 두 곳에 정직하게 적어 두었다
  (`items-catalog.service.ts:292-295` · 어드민 배너 `apps/admin/src/lib/worker-health-view.ts:155`).
- 링크를 "깨졌어요"로 표시하지 않는 것은 **의도된 결정**이고 근거도 적혀 있다
  (`items-catalog.service.ts:283-289` — 24시간 묵은 판정으로 판매처를 공개 비난하지 않는다).
  그러니 이 발견은 표시를 요구하는 것이 아니라, **판정 자체가 존재하지 않는 상태**를 가리킨다.

**재현 조건.** 어드민이 URL을 잘못 넣거나 판매처가 페이지를 내린 링크 → 앱에서 그 링크가 1순위 그대로
서고(강등 없음), 클릭 → 404 → 3분 뒤 구매 확인 카드.

**크기: 중.** 코드 변경 없이 `LINK_HEALTH_ENABLED=1`을 켜는 것이 1차(외부 네트워크 잡이라 운영 결정 ·
`scripts/check-env.ts:119`가 "꺼짐이 정상"으로 적어 둔 값이라 문서도 함께 움직여야 한다).
앱 쪽에서 더 나아가려면 "열린 뒤 즉시 돌아온 클릭"을 대기에서 빼는 판정이 필요한데, 그건 별개 설계다.

### 4. 구매율 분모가 열리지 않은 누름까지 센다

**무엇이 수치를 흐리는가.** 두 사실이 서로 다른 시점에 기록된다.

- `affiliate_link_clicked`는 **누름** 시점에 발사된다 — `[itemTemplateId].tsx:1020-1031`
  (그 자리 주석도 "fires on the press itself"라고 적는다).
- 구매 확인 대기는 **열린 뒤에만** 남는다 — `:568-585`(GAP-060 #4가 의도적으로 옮긴 자리).

어드민 구매율의 분모는 전자다: `apps/admin/app/analytics/page.tsx:409`
`const clicks = eventCount(summary, "affiliate_link_clicked")` → `:428` `conversionRate(clicks, followup.purchased)`.
그래서 **열리지 않은 누름(오프라인·비활성 링크·허용목록 밖 도메인·스킴 오류)이 전부 분모에 남고**,
그 클릭에는 구매 확인이 애초에 뜨지 않으므로 분자에 들어갈 길이 없다 → 구매율이 구조적으로 낮게 나온다.
각주(`:478-479`)는 **기간 경계**만 말하고 이 갈래는 말하지 않는다.

라운드 29(ANA-128)의 "구매율 정직 표기"는 **회귀하지 않았다** — `purchased`만 세는 분해 집계
(`apps/api/src/admin/analytics-summary.service.ts:34-52`), 3갈래 합계와 이벤트 총계의 차이를 "분류 불가"로
드러내는 처리(`page.tsx` 분류 불가 행), "답이지 기록이 아니에요" 각주가 전부 살아 있다. 이 발견은 그
축이 아니라 **분모 쪽의 새 축**이다.

**크기:** 각주 한 줄이면 정직해진다(작음). 실제로 재려면 "열린 클릭"을 세는 계측이 하나 더 필요하다(중).

### 5. 실제 구매↔링크 연결이 쓰기 전용이다

**무엇이 루프를 끊는가.** 앱은 "샀어요 → 지출 저장"에서 어떤 링크로 산 것인지를 실제로 남긴다:
`apps/mobile/src/commerce/PurchaseFollowupPrompt.tsx:540-546` → `apps/mobile/app/expenses/new.tsx:1439`
→ 서버 저장 `apps/api/src/onboarding/expenses-store.service.ts:387`
(존재 검증도 있다 — `:179-183`). 그런데 **읽는 쪽이 없다**: `apps/admin` 전역·`apps/api/src/admin` 전역에
`linkedProductLinkId`/`linked_product_link_id` 참조가 0건이다(오늘 확인).

그래서 "클릭한 사람 중 실제로 지출을 남긴 비율"이라는 **유일하게 이벤트 근사치가 아닌 수치**가 DB에
쌓이기만 하고, 어드민은 발견 4의 근사치만 본다.

**재현 조건.** 정상 루프를 한 바퀴 돌리면(링크 클릭 → 샀어요 → 저장) `expenses.linked_product_link_id`에
값이 남는다. 어드민 어느 화면에도 그 수는 뜨지 않는다.

**크기: 중.** `affiliate_clicks × expenses(linked_product_link_id)` 조인 집계 하나 + 어드민 카드 한 장.
⚠️ 그 수를 랭킹으로 되먹이지 않는 것이 DNC-009이고, 그 규율은 `affiliate-click-breakdown.service.ts:46-50`이
이미 세워 둔 문장을 그대로 이어받으면 된다.

### 6. 비세션 프리뷰가 없는 스폰서·없는 수수료를 말한다

**무엇이 신뢰를 깨는가.** 상세 화면의 프리뷰 픽스처(`apps/mobile/app/items/[itemTemplateId].tsx:285-327`)는
아직 `isAffiliate: true` 링크 셋과 `isSponsored: true` 하나, 그리고
"…우리아이가 수수료를 받을 수 있어요"·"스폰서 광고 링크예요" 문구를 들고 있다. 그런데 플랜 B가 실 시드와
데모 픽스처를 **전량 비제휴로** 바꿨고(§0 참고), 시드 계약은 그 이유를 이렇게 적는다:
"실 스폰서 계약이 없는 출시 시점에 일반 링크가 스폰서 배지를 달면 **DNC-011의 반대 방향 오류**"
(`apps/api/prisma/seed-data.ts:1217-1224` 취지, 래칫은 `apps/api/test/seed-data.test.ts`).
프리뷰에는 그 모양이 그대로 남아 있다 — 없는 광고 계약과 받지 않는 수수료를 말한다.

**재현 조건 / 도달.** `hasSession = Boolean(authToken && childId && itemTemplateId)`(`:772`)가 거짓인 렌더.
주 경로는 픽셀락 캡처(`app/pixel-lock.tsx`가 세션을 지운다)지만, **로그인했는데 `selectedChildId`가 비어
있는 순간**도 같은 갈래다(`:342`가 persist 스토어를 읽는다 — 콜드 스타트 회복 흐름이
`app/index.tsx`의 selected-child recovery로 좁혀 두었으나 딥링크로 상세에 직접 들어오는 경로는 그 판정을
지나지 않는다). 프리뷰에서 링크를 누르면 서버 왕복 없이 그 고지 문구가 토스트로 뜬다(`:1037`).

**크기: 작음(코드) — 단 선행 조건이 있다.** ITEM-002 픽셀락 캡처 대상이라 픽스처를 바꾸면 승인 캡처가
갈린다. CLAUDE.md·DNC 규율대로 **임의 변경이 아니라 변경 요청 문서화가 먼저**다.

### 7. 프리뷰 목록이 없는 별점·리뷰 수를 말한다

`apps/mobile/app/(tabs)/items.tsx:170-205` — `["★ 4.7 (1,245)", "★ 4.8 (2,154)", "★ 4.6 (982)"]`,
`badgeText: "BEST" | "NEW"`, `priceBandText: "₩89,000"`. 서버는 별점·리뷰 수를 주지 않고(계약에 필드가
없다), 앱 금액 표기 단일 소스는 `₩` 없이 "89,000원"이며(`apps/mobile/src/money.ts` `formatKrw`),
서버가 만드는 가격대는 범위 문자열이다(`items-catalog.service.ts:319-330`).

같은 파일 `:209-221`이 **세션 목록에서는** 근거 없는 "BEST" 배지를 이미 없앴다고 적어 두었다
("서버는 그런 평가를 주지 않고… 근거 없는 추천 표시였다(DNC-009/DNC-011 취지)"). 그 규율이 프리뷰
리터럴에는 적용되지 않았다. 도달 경로와 크기는 발견 6과 같다(ITEM-001 픽셀락 → **캡처 재승인 선행**).

### 8. `sponsor_label` 열이 어디에도 나오지 않는다

`apps/api/prisma/schema.prisma:584`에 `sponsor_label`이 있고 시드가 값을 넣지만
(`apps/api/prisma/seed-data.ts:1263, 1323, 1503` — "스폰서 예시"), 그 값을 **읽는 코드는 0건**이다:
앱 DTO(`toProductLinkDto`)·어드민 DTO(`toAdminProductLinkDto`)·어드민 링크 화면·모바일 전역 어디에도 없다.
오늘의 DNC-011 최소선(고정 라벨 "스폰서" 배지 — `link-marker.ts:42, 50`)은 지켜지지만, 계약이 성사돼
실제 광고주가 생겨도 **누가 광고비를 냈는지 말할 자리가 없다**. 크기: 작음(DTO 한 칸 + 캡션 한 줄).

### 9. 어드민 클릭 통계가 두 모집단을 한 수로 합친다

`affiliate_clicks`에는 인앱 클릭(`referrerScreenId: "ITEM-003"`)과 공유 링크의 **익명** 클릭
(`referrerScreenId: "redirect"` — `apps/api/src/items-commerce/redirect.controller.ts:92`,
user/household/child 전부 null)이 함께 쌓인다. `apps/admin/app/clicks/page.tsx`의 어느 문구도 그 구분을
말하지 않고, 분해 축도 플랫폼·링크·날짜뿐이다(`affiliate-click-breakdown.service.ts:81-95`).
그래서 같은 콘솔에서 **"클릭"이 두 가지를 뜻한다** — 클릭 통계 화면은 두 모집단의 합,
분석 화면의 구매율 분모는 인앱 이벤트만(발견 4). 덧붙여 `clicks/page.tsx:73`은 "제휴 상품 링크 클릭 수"라고
적는데 오늘 전 행이 비제휴다. 크기: 각주·라벨이면 작음, referrer 분해까지면 중.

### 10. 배포 런북이 읽히지 않는 고지 문구를 설정하게 한다

`docs/5차/day1-deploy-runbook.md:37` · `docs/5차/launch-72h-plan.md:50` ·
`scripts/deploy/oracle-bootstrap.sh:145`가 `AFFILIATE_DISCLOSURE_TEXT`를
"이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."로 심는다.
**그 값을 읽는 코드는 0줄이다** — `scripts/check-env.ts:72-77`이 이미 그 사실을 정확히 적어 두었다
("이 값을 읽는 코드가 한 줄도 없어서 무엇의 기본값도 되지 못한다… 런타임 단일 소스는 disclosure 테이블").
운영자는 고지를 설정했다고 믿지만 실제 문구는 DB에서 온다. 게다가 그 문장은 하십시오체라
DNC-018(해요체)과도 어긋나므로, 만약 누군가 "이걸 쓰자"고 배선하면 두 계약을 동시에 깬다.
(`scripts/launch/prepare.ts:295`는 해요체 문장을 심는다 — 두 배포 경로의 값도 서로 다르다.)
크기: 작음(문서 3곳 + 스크립트 1곳에 "읽히지 않는 자리"임을 명시하거나 제거).

---

## 3. 권고 (우선순위 순)

1. **발견 1을 플랜 A 전환의 선행 조건으로 못 박는다.** 파트너스 승인 뒤 `isAffiliate:true`가 켜지는
   순간부터 실효가 생기는 유일한 DNC-010 틈이다. 서버 쪽 고정 수수료 문장 상수 또는
   `statesAffiliateCommission`의 contracts 승격 중 하나. 함께 `disclosures.affiliate_purchase`가 수수료를
   말하는지를 **런타임 값으로** 무는 테스트 한 줄(시드가 아니라 upsert 결과)을 세운다.
2. **발견 2를 지금 고친다.** 한 프롭 + 테스트 한 줄이고, 커머스 루프에서 사용자가 받는 유일한 실패
   신호다. 지금 그 신호는 초록 체크를 달고 있다.
3. **발견 4의 각주를 먼저 적고, 발견 5를 다음 라운드 후보로 올린다.** 각주는 오늘 당장 정직해지는
   가장 싼 수단이고, 발견 5는 이 앱이 이미 갖고 있는 유일한 **비근사** 전환 수치를 켜는 일이다.
   ⚠️ 둘 다 DNC-009 되먹임 금지 문장을 그대로 이어받을 것.
4. **발견 3은 운영 결정으로 올린다.** 코드 변경 없이 `LINK_HEALTH_ENABLED=1` 하나이고, 켜지 않는 한
   저장소가 만들어 둔 강등·공유차단 두 안전장치가 전부 죽어 있다. 켜지 않기로 하면 그 판단을
   `scripts/check-env.ts:119`의 문장 옆에 근거와 함께 남긴다.
5. **발견 6·7은 변경 요청부터.** 둘 다 "없는 사실을 말한다"는 이 저장소의 규율에 정면으로 어긋나지만
   ITEM-001/ITEM-002 픽셀락 캡처 대상이다. 임의 수정 금지 — 캡처 재승인 요청서 한 장(무엇을 왜 지우는가,
   플랜 B가 실데이터에서 지운 것과 같은 것이라는 근거)을 먼저 쓴다.

---

## 4. 소유 파일 목록 (교집합 없음)

이 정찰이 제안하는 수정이 실제로 손대는 파일. 트랙끼리 겹치지 않게 나눴다.

**트랙 A — DNC-010 서버 틈 (발견 1)**
- `apps/api/src/items-commerce/share-disclosure.ts`
- `apps/api/src/onboarding/items-catalog.service.ts` *(`toAdminProductLinkDto` 한 자리만)*
- `apps/api/test/admin-product-links-order.e2e.test.ts`

**트랙 B — 실패 신호 (발견 2)**
- `apps/mobile/app/items/[itemTemplateId].tsx` *(`:1459` 한 줄만)*
- `apps/mobile/src/items/expense-link-prompt.test.ts`

**트랙 C — 집계 정직성 (발견 4·5·9)**
- `apps/admin/app/analytics/page.tsx`
- `apps/admin/app/clicks/page.tsx`
- `apps/admin/src/admin-analytics.test.ts`
- `apps/api/src/admin/analytics-summary.service.ts`
- `apps/api/src/admin/affiliate-click-breakdown.service.ts`

**트랙 D — 링크 헬스 운영 (발견 3)**
- `scripts/launch/prepare.ts`
- `scripts/deploy/oracle-bootstrap.sh`
- `scripts/check-env.ts`
- `apps/mobile/src/release-env-catalogue.test.ts` *(값 잠금이 여기 있다 — 켜려면 함께 움직인다)*

**트랙 E — 문서 정합 (발견 10)**
- `docs/5차/day1-deploy-runbook.md`
- `docs/5차/launch-72h-plan.md`
- `docs/operations/environment-setup.md`

**트랙 F — 스폰서 라벨 (발견 8)**
- `apps/api/prisma/schema.prisma` *(읽기만 — 열은 이미 있다)*
- `apps/admin/app/links/page.tsx`
- `apps/mobile/src/items/link-marker.ts`

**트랙 G — 프리뷰 픽스처 (발견 6·7) — ⚠️ 캡처 재승인 전 착수 금지**
- `apps/mobile/app/(tabs)/items.tsx` *(프리뷰 리터럴 구간만)*
- `docs/5차/design-restore-spec.md` *(ITEM-001/ITEM-002 항목)*
- ⚠️ `apps/mobile/app/items/[itemTemplateId].tsx`의 `previewDetail`은 **트랙 B와 같은 파일**이다 —
  두 트랙을 동시에 열지 말 것. 트랙 B가 먼저다(한 줄, 승인 불필요).

---

## 5. 확인했지만 문제가 없었던 것 (다음 정찰이 다시 파지 않도록)

- **고지-CTA 인접성**: 고지(`:1292`)와 구매 버튼 행 사이에 노드가 없다. 그 사이에 카드를 끼우지 말라는
  주석이 네 곳(`:1324`, `:1347`, `:1368`, `:1407`)에 서 있다.
- **"제품 정보" 탭에서 판매처 행이 접혀도** 고지와 CTA는 그대로 렌더된다(`:1187` vs `:1292`) — 탭이
  고지를 감추는 우회로가 아니다.
- **빈 고지 문구로 비우기**는 400으로 막힌다(`items-catalog.service.ts:721-725`).
- **핵심 루프 마지막 고리**는 닫혀 있다: `linkedItemTemplateId`가 붙은 지출이 저장되면 서버가 같은
  트랜잭션에서 준비템을 `prepared`로 올리고(`expenses-store.service.ts:404-412` →
  `store-shared.ts:313-345`), `gifted`/`not_needed`는 보존한다. "샀어요" 후 시트를 닫고 이탈하면 대기가
  `pending`으로 남되 답변 예산 한 칸을 쓴다(`purchase-followup.store.ts:115` · 근거 `:88-114`).
- **아이 스코프**: 구매 확인 카드는 다른 아이의 클릭을 묻지 않는다
  (`purchase-followup.store.ts:166-179, 184-196`).
- **공개 리다이렉트**: 존재 오라클 없음, 실패에 클릭 행 없음, 실패 페이지에 링크 0개
  (`redirect.controller.ts:61-99, 111-139, 174-201`).
- **라운드 29 "구매율 정직 표기" 회귀 없음** — §발견 4 말미 참고.
