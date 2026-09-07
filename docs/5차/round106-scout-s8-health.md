# 라운드 106 정찰 S8 — 코드 건강·복잡도 감사

**성격**: 읽기 전용 정찰. 제품 소스·테스트·설정은 **0바이트** 고쳤다. 이 문서가 유일한 산출물이다.
**측정 시각**: 2026-09-07 08:05~08:35 UTC (개별 수치마다 읽은 시점을 적는다).
**측정 도구**: 세는 코드는 전부 스크래치패드에서 돌렸고 저장소에 남기지 않았다. 마스킹 규칙은
`packages/test-utils/src/dead-export-ledger.ts`의 `maskCommentsAndStrings`와 같은 판단을 따랐다 —
주석과 문자열 리터럴은 지우되 템플릿의 `${…}` 안은 **코드로 남긴다**(그 갈래를 지우면 살아 있는
호출부가 사라져 사문이 거짓으로 늘어난다. 실제로 첫 판에서 그 오차로 사문이 6건으로 부풀었다).

> ⚠️ **동시 편집 중의 실측이다.** 라운드 106의 다른 에이전트 스무 개가 같은 작업 트리를 고치고
> 있다. 이 문서의 수는 **읽은 시점의 수**이고, 몇 개는 관측 창 안에서 실제로 움직였다:
> `apps/api/test/import-excel.e2e.test.ts`는 08:0x에 **1715줄**, 08:27에 **1896줄**이었다.
> 그래서 아래 표는 전부 시각을 달고 있다.

---

## 요약 표

| # | 한 줄 | 영향 | 크기(측정) |
| --- | --- | --- | --- |
| S8-1 | 화면 8개가 **단일 함수** 안에서 500~1,300 실코드 줄을 진다 | 한 화면을 고칠 때 읽어야 하는 최소 단위가 화면 전체다 | HomeScreen 1,279줄·분기 193 / NewExpenseScreen 1,254줄·분기 200 (상위 8개 표) |
| S8-2 | 상위 15 거대 파일의 **큰 이유가 셋으로 갈린다**(화면·대장·데이터) | "크다"만으로는 어디를 만질지 정해지지 않는다 | 주석 비율 4.7%(seed-data) ~ 38.3%(new.tsx). 제품 소스 전체 35.2% |
| S8-3 | 라운드 105 이월의 그 쌍은 **쌍이 아니라 삼형제**다 | 이월 항목의 모집단이 실제보다 작게 적혀 있었다 | 세 모듈이 같은 5줄 맵 빌드를 든다 |
| S8-4 | 교차 모듈 **완전 동일 본체 10군 · 알파 동형 21군** | 한쪽만 고치면 다른 쪽이 조용히 드리프트한다 | 최대 413자(FNV-1a 지문 15줄) |
| S8-5 | 같은 상수를 두 곳 이상에서 선언 — **api↔contracts 4건**, 앱 안 4벌 1건, `repoRoot` 36벌 | api는 다른 자리에서는 contracts 상수를 import한다(관례가 반쪽) | 값 표 |
| S8-6 | 사문 대장이 **모집단 밖으로 선언한 자리**에 사문 16건 | 대장이 초록인 채로 그 16건을 한 번도 보지 않는다 | apps/api 4 · packages 7 · local-backend 4 · admin lib 1 |
| S8-7 | **런타임 순환 0**(파일 사이클 13은 전부 `import type`으로 끊긴다) | — (건강) | 값으로 기록 |
| S8-8 | **`as any` 0 · `@ts-ignore` 0 · `: any` 0** (제품 소스) | — (건강) | non-null 단언만 제품 338건 |
| S8-9 | mobile 테스트 시간의 **39%를 파일 두 개**가 쓴다 | 그 둘은 같은 소스 트리를 캐시 없이 반복해서 읽는다 | 35.7s + 26.8s / 합 159.2s |
| S8-10 | 관측 중 mobile 실패 4건 = **동시 편집 아티팩트** | 건강 판정이 아니다. 오해를 막기 위해 값으로 남긴다 | 4/6157 |

---

## S8-1 · 화면 8개가 단일 함수 안에서 500~1,300 실코드 줄을 진다

**측정값** (2026-09-07 08:20 UTC · 주석·빈 줄 제외한 함수 본체 줄 수, 분기는 `if/for/while/case/catch/??/?:/&&/||` 합):

| 실코드 줄 | 분기 | 자리 |
| --- | --- | --- |
| 1,279 | 193 | `apps/mobile/app/(tabs)/index.tsx:1163` `HomeScreen` |
| 1,254 | 200 | `apps/mobile/app/expenses/new.tsx:442` `NewExpenseScreen` |
| 1,082 | 166 | `apps/mobile/app/(tabs)/records.tsx:707` `RecordsScreen` |
| 880 | 129 | `apps/mobile/app/expenses/[expenseId].tsx:264` `ExpenseDetailScreen` |
| 776 | 86 | `apps/mobile/app/(tabs)/items.tsx:230` `ItemsScreen` |
| 768 | 188 | `apps/mobile/app/(tabs)/reports.tsx:358` `ReportsScreen` |
| 619 | 107 | `apps/mobile/app/items/[itemTemplateId].tsx:330` `ItemDetailScreen` |
| 558 | 86 | `apps/mobile/app/import/[importJobId].tsx:456` `ImportPreviewScreen` |
| 549 | 83 | `packages/test-utils/src/comment-tolerant-anchor-ledger.ts:487` `parseStringLiteral` |
| 413 | 68 | `apps/admin/app/reviews/page.tsx:88` `ContentReviewsPageContent` |

**왜 문제인가.** 이 저장소의 화면 파일이 큰 것 자체는 주석 때문이 **아니다**(주석은 이미 뺐다).
`HomeScreen`은 한 함수 안에서 `useQuery` **8개**, `useMemo` 16개, `useEffect` 5개를 들고,
같은 파일에 `StyleSheet.create`가 **20벌**(예산 넛지·주간 요약·누적 합계·마일스톤·첫 실행 안내·
첫 기록 축하·대기 동기화 고지 …) 서 있다. 즉 홈 화면 **하나가 섹션 20개의 관심사를 함께 진다**.
`NewExpenseScreen`은 `useState` **26개**를 한 함수에 든다.

**근거.** 위 표는 함수 본체를 중괄호 균형으로 잘라 실측했다.
섹션 수는 `grep -n "StyleSheet.create" "apps/mobile/app/(tabs)/index.tsx"` → 20행(263~1093줄).
훅 수는 같은 파일의 `grep -c`(2026-09-07 08:19 UTC).
import 수: index.tsx 60줄(고유 `../` 모듈 53), new.tsx 47(38), records.tsx 46(38), reports.tsx 45(40).

**고치는 크기.** ⚠️ **여기서는 아무것도 권하지 않는다.** 화면 분해는 이 저장소가 무는
소스 문자열 계약을 대량으로 깬다(S8-9 근거 참고 — 테스트 456개 중 **311개**가 소스를 문자열로
읽고, 그중 `expect(screen).toContain("…")` 형식이 화면 본문의 코드 조각을 그대로 문다).
이 항목은 **값으로만 남긴다**: 다음 라운드가 화면 하나를 만질 때 "이 함수가 오늘 1,279줄이다"를
알고 시작하도록.

**고치면 무엇이 좋아지나.** (해당 없음 — 관측치다.)

---

## S8-2 · 상위 15 거대 파일의 큰 이유는 셋으로 갈린다

**측정값** (2026-09-07 08:27 UTC · `총줄 / 실코드 / 주석 / 주석비율`):

| 총 | 실코드 | 주석 | 비율 | 자리 | 왜 큰가 |
| --- | --- | --- | --- | --- | --- |
| 8,354 | 5,436 | 2,351 | 28.1% | `apps/mobile/src/a11y-contract.test.ts` | 계약 하나가 `it()` **208개**를 44 describe로 든다 |
| 3,218 | 1,926 | 1,129 | 35.1% | `packages/test-utils/src/resume-condition-ledger.ts` | 대장(함수 67 + 상수 41) |
| 3,191 | 2,251 | 878 | 27.5% | `apps/mobile/app/(tabs)/index.tsx` | **화면 하나가 섹션 20개**(S8-1) |
| 3,113 | 2,137 | 760 | 24.4% | `apps/mobile/src/api/local-backend.ts` | 데모 백엔드 — 최상위 함수 **127개** |
| 2,840 | 1,698 | 1,088 | 38.3% | `apps/mobile/app/expenses/new.tsx` | 화면 하나 + 설계 근거 주석 |
| 2,611 | 1,637 | 882 | 33.8% | `apps/mobile/app/(tabs)/records.tsx` | 화면 하나 |
| 2,282 | 1,436 | 729 | 31.9% | `packages/test-utils/src/dead-export-ledger.ts` | 대장 |
| 2,281 | 2,162 | 107 | **4.7%** | `apps/api/prisma/seed-data.ts` | **순수 데이터**(주석이 거의 없다) |
| 2,183 | 1,583 | 316 | 14.5% | `apps/api/test/data-retention-purge.db.test.ts` | e2e 51 케이스 |
| 2,066 | 1,444 | 494 | 23.9% | `apps/mobile/src/korean-particle-guard.test.ts` | 계약(62 케이스) |
| 2,055 | 1,290 | 655 | 31.9% | `apps/mobile/app/(tabs)/reports.tsx` | 화면 하나 |
| 2,035 | 1,255 | 655 | 32.2% | `apps/mobile/src/offline/messages.test.ts` | 문구 계약 96 케이스 |
| 2,025 | 1,229 | 609 | 30.1% | `packages/test-utils/src/repo-self-description.test.ts` | 계약 |
| 1,934 | 1,282 | 522 | 27.0% | `apps/admin/src/admin-load-error-copy.test.ts` | 문구 계약 57 케이스 |
| 1,896 | 1,345 | 357 | 18.8% | `apps/api/test/import-excel.e2e.test.ts` | e2e (08:0x에는 1,715였다) |

**갈래 셋이다.** ⓐ **화면 파일**(5개) — 크기의 원인이 관심사 수다(S8-1).
ⓑ **대장·계약 테스트**(7개) — 크기의 원인이 케이스 수다. ⓒ **데이터**(seed-data 1개, 주석 4.7%).
즉 *"이 저장소는 주석을 길게 남긴다"* 는 **참이지만 거대 파일의 설명은 아니다**: 상위 15에서
주석을 다 빼도 12개가 1,200 실코드 줄을 넘는다.

**전체 값**(2026-09-07 08:26 UTC):
제품 소스(비테스트) **556파일 / 141,149줄 / 실코드 82,249 / 주석 49,719(35.2%)**.
테스트 **456파일 / 180,656줄 / 실코드 130,001 / 주석 32,145(17.8%)**.
⚠️ **테스트가 제품보다 크다**(180,656 > 141,149). 이 저장소의 부피는 계약 쪽에 있다.

---

## S8-3 · 라운드 105 이월은 "쌍"이 아니라 **삼형제**다

**측정값.** 라운드 105가 이월로 남긴 `importCategoryNameResolver` ↔ `buildHomeCategoryLabelResolver`는
같은 모양의 **세 번째**를 가지고 있다:

| 자리 | 맵 빌드 5줄 | 반환 폴백 |
| --- | --- | --- |
| `apps/mobile/src/categories.ts:122` `buildCategoryNameLookup` | 동일 | `?? categoryNameFor(categoryId)` ("기타") |
| `apps/mobile/src/import/preview-rows.ts:257` `importCategoryNameResolver` | 동일 | `?? null` |
| `apps/mobile/src/home/recent-expense-category.ts:31` `buildHomeCategoryLabelResolver` | 동일 | `if (!categoryId) return null;` + `?? null` |

세 함수의 **맵 빌드 5줄은 바이트가 같다**:

```
const nameById = new Map<string, string>();
for (const category of categories ?? []) {
  const name = category?.name?.trim();
  if (category?.id && name) nameById.set(category.id, name);
}
```

**왜 문제인가.** 갈리는 것은 **폴백 한 줄뿐**이고, 그 한 줄이 갈리는 이유는 세 파일의 주석에
정확히 적혀 있다(모르는 id를 "기타"라고 단정할 수 있는 화면과 없는 화면). 즉 **갈려야 하는 것은
꼬리이고 몸통은 갈릴 이유가 없다.** 몸통이 세 벌이면 `name?.trim()`·빈 이름 제외 규칙이 세 자리에서
따로 산다. 라운드 105의 이월 문장이 *"둘의 본체가 같다"* 로 적혀 있어, **셋째를 세지 않았다.**

**근거.** 알파 치환 후 토큰 3-그램 자카드: `buildCategoryNameLookup`↔`importCategoryNameResolver`
**0.88**, `buildHomeCategoryLabelResolver`↔`importCategoryNameResolver` **0.73**,
`buildCategoryNameLookup`↔`buildHomeCategoryLabelResolver` **0.67**(2026-09-07 08:12 UTC).
셋 다 정확히 위 5줄을 공유한다(육안 대조).

**고치는 크기.** 작다. `apps/mobile/src/categories.ts`에 비export 헬퍼
(예: `categoryNameMap(categories)`)를 하나 두고 셋이 그것을 부른다 — **export 이름·시그니처·
반환값은 그대로**. ⚠️ **계약 문자열 영향 0건**을 확인했다: 이 셋을 무는 소스 문자열 계약은
전부 **호출부 형태**다 —
`preview-rows.test.ts:750`·`category-household-scope.test.ts:225`가 `"importCategoryNameResolver(serverCategories)"`,
`recent-expense-category.test.ts:97-98`이 `"buildHomeCategoryLabelResolver(categoriesQuery.data?.categories)"`와
그 import 줄, `:127`이 `not.toContain("buildHomeCategoryLabelResolver")`.
**본체 안쪽을 무는 문자열은 0건**이므로 내부 헬퍼 도입은 그 계약들을 건드리지 않는다.

**고치면 무엇이 좋아지나.** "빈 이름은 이름이 아니다 / 이름은 트림한다"는 규칙이 한 자리에 선다.
그리고 라운드 105의 이월 문장이 **셋으로 정정된다** — 이월 목록의 수가 맞아야 다음 라운드가
"다 처리했다"를 판정할 수 있다.

---

## S8-4 · 교차 모듈 중복 — 완전 동일 본체 10군 · 알파 동형 21군 (전수)

**측정 방법.** 비테스트 `.ts/.tsx`의 `export function` 선언 **1,356개**(본체 60자 이상)를 잘라,
ⓐ 주석 제거 + 공백 정규화 후 해시가 같은 군, ⓑ 식별자를 첫 등장 순 알파 치환한 뒤 해시가 같은 군을
따로 셌다(2026-09-07 08:11 UTC). 아래는 **같은 군이 파일 두 개 이상에 걸친 것만** 남긴 전수다.

### ⓐ 본체가 바이트로 같은 것 (10군)

| 크기 | 자리 |
| --- | --- |
| 413자 | `children/child-create-idempotency.ts:46` `childCreateBodyFingerprint` ‖ `items/custom-item-form.ts:303` `customItemBodyFingerprint` |
| 254자 | `children/child-switch.ts:191` `resolveChildScopeLabel` ‖ `notifications/notification-child-label.ts:36` `resolveNotificationChildLabel` |
| 140자 | `consent/legal-links.ts:32` `normalizeLegalDocumentUrl` ‖ `settings/support-links.ts:43` `normalizeSupportUrl` |
| 112자 | `expenses/date-picker-month.ts:304` `expenseDatePickerMonthLabel` ‖ `month-jump.ts:239` `monthJumpYearMonthLabel` |
| 109자 | `expenses/record-row-actions.ts:127` `resolveRecordRowAction` ‖ `notifications/notification-row-actions.ts:74` `resolveNotificationRowAction` |
| 90자 | `expenses/record-row-actions.ts:62` `isRepeatableExpenseType` ‖ `offline/expense-list-reconciliation.ts:142` `countsTowardMonthlyTotal` |
| 87자 | `expenses/record-row-actions.ts:141` `recordRowAccessibilityHint` ‖ `notifications/notification-row-actions.ts:86` `notificationRowAccessibilityHint` |
| 78자 | `categories/custom-category-form.ts:324` `customCategoryArchiveConfirmCopy` ‖ `items/custom-item-form.ts:194` `customItemDeleteConfirmCopy` |
| 71자 | `apps/admin/src/lib/user-lookup-view.ts:27` `effectiveQueryLength` ‖ `apps/api/src/admin/admin-users-lookup.service.ts:53` `effectiveQueryLength` |
| 61자 | `test-utils/src/dead-export-ledger.ts:279` ‖ `dnc-scope-guard.ts:88` ‖ `dnc-secret-scan.ts:113` `readRepoFile` (+`dnc-guard-ledger.ts:97`이 알파 동형) |

(경로는 `apps/mobile/src/…` 생략. 마지막 두 줄만 다른 워크스페이스다.)

### ⓑ 알파 동형(이름만 다르고 모양이 같은 것) 중 파일이 갈리는 21군 — 대표

`getOrCreateChildCreateKey`‖`getOrCreateCustomItemKey`(189자) ·
`legalDocumentUrls`‖`supportLinkUrls`(163자) ·
`admin lib hasAnyItemFilter`‖`hasAnyLinkFilter`(150자) ·
`countPendingExportBreakdown`‖`countPendingScopeBreakdown`(148자) ·
`resolveRecordsViewNonceParam`‖`resolveDrilldownNonceParam`‖`resolveReportsMonthLandingParam`‖`resolveReportsMonthLandingNonceParam`(143자, 4벌) ·
`recordRowAccessibilityLabel`‖`notificationRowAccessibilityLabel`(115자) ·
`generateChildCreateIdempotencyKey`‖`generateCustomItemIdempotencyKey`(93자) ·
`push-token-source.ts tryLoadExpoNotifications`‖`ui/haptics.ts tryLoadExpoHaptics`(99자) ·
`api affiliate-click-breakdown isClickBreakdownWindow`‖`api analytics-summary isAnalyticsSummaryWindow`(74자).

### 갈래를 갈라 읽어야 한다 — 셋으로 갈린다

**ⓘ 계약이 묶어 놓은 미러(고칠 것 없음).**
`effectiveQueryLength`(admin↔api)는 프로세스 경계를 넘는 의도된 미러다: 어드민 쪽 주석이
*"API의 `USERS_LOOKUP_MIN_QUERY_LENGTH`와 같은 값"* 이라고 못 박고, 두 쪽 다 자기 테스트가 있다
(`apps/admin/src/lib/user-lookup-view.test.ts`). **이 항목은 그대로 두는 것이 맞다.**

**ⓘⓘ 문서화된 쌍둥이 모듈이지만 묶는 계약이 없는 것(드리프트 위험).**
`expenses/record-row-actions.ts`(378줄·export 28) ↔ `notifications/notification-row-actions.ts`
(147줄·export 15)는 **모듈 통째로 복제**다: 위 표의 세 함수가 본체 동일/알파 동형이고,
타입 이름(`*RowAlertButton`·`*RowActionSheet`)까지 1:1로 대응하며, `ANDROID_ALERT_BUTTON_LIMIT = 3`도
각자 든다. `consent/legal-links.ts` ↔ `settings/support-links.ts`도 같은 모양이고,
**두 파일의 주석이 서로를 "쌍둥이"라고 부르며 *"한쪽만 지우면 그 관례가 반쪽으로 남는다"* 고
적어 두었다.** 즉 저장소는 이 관계를 **알고 있는데 계약으로는 묶지 않았다** — 한쪽 힌트 문구를
고쳐도 다른 쪽은 초록이다.
`export/export-pending-notice.ts` ↔ `reports/pending-scope-notice.ts`도 export 11개가 1:1로
대응하지만(이름 표 대조 확인), 이쪽은 **이미 일부를 공유한다**(`export-pending-notice.ts:9`가
`pendingRowYearMonth`를 상대 모듈에서 import) — 그래서 남은 중복 2줄은 값이 작다.

**ⓘⓘⓘ 이유 없이 두 벌인 것(가장 값이 큰 자리).**
1. **FNV-1a 지문 15줄이 두 벌**(413자, 이 저장소 최대 중복). `custom-item-form.ts:303`의 주석은
   *"childCreateBodyFingerprint와 같은 판단"* 이라고 적으면서 **코드는 복사했다.** 두 벌 다
   `JSON.stringify` 정규화 + `0x811c9dc5` 시드 + `Math.imul(hash, 0x01000193)` 루프 + `padStart(8,"0")`이다.
2. **`isRepeatableExpenseType` ≡ `countsTowardMonthlyTotal`.** 두 술어가 오늘 **바이트로 같다**
   (`expenseType === undefined || null || "expense"`). 그런데 `expense-list-reconciliation.ts:132-141`의
   주석은 자기가 **앱 쪽 DNC-015 단일 소스**라고 선언한다(CLN-131: local-backend의 인라인 4벌을
   여기로 모았다는 기록까지 있다). `record-row-actions.ts`는 **import가 한 줄도 없는 무의존 모듈**이라
   그 단일 소스를 부르지 않는다. 즉 DNC-015 술어가 지금 **두 자리**에 산다.

**고치는 크기.** ⓘⓘⓘ-1만 좁고 검증 가능하다(권고 R3). 무는 소스 문자열은 전부 **호출부**다:
`shared-cache-policy.test.ts:418`·`onboarding-step-progress.test.ts:192`·`local-progress.test.ts:285`·
`consent-recovery.test.ts:132`가 `"getOrCreateChildCreateIdempotencyKey(childCreateBodyFingerprint(body))"`,
`custom-item-wiring.test.ts:82`가 `"getOrCreateCustomItemKey(keyHolder, customItemBodyFingerprint(body))"`.
**본체 안쪽을 무는 문자열 0건** — export 이름을 유지한 채 내부만 공유하면 계약 영향이 없다.
ⓘⓘⓘ-2는 **권하지 않는다**: `record-row-actions.ts`의 무의존성이 의도인지 이 정찰로는 판정할 수
없고, `recurring-flow.test.ts:160`이 `"isRepeatableExpenseType("` 문자열을 문다. 값으로만 남긴다.

---

## S8-5 · 같은 상수를 두 곳 이상에서 선언

**측정값** (2026-09-07 08:15 UTC · 줄 머리 `export const NAME = …` 전수에서 이름 또는 값이 겹치는 것):

| 이름 | 값 | 자리 | 판정 |
| --- | --- | --- | --- |
| `CUSTOM_ITEM_NAME_MAX_LENGTH` | 80 | `apps/api/src/onboarding/custom-items.service.ts:25` · `packages/contracts/src/schemas.ts:506` | ⚠️ api가 재선언 |
| `CUSTOM_ITEM_MAX_PER_CHILD` | 200 | `…custom-items.service.ts:27` · `…schemas.ts:507` | ⚠️ api가 재선언 |
| `CUSTOM_ITEM_REASON_TEXT` | `"직접 추가한 준비물이에요."` | `…custom-items.service.ts:33` · `…schemas.ts:509` | ⚠️ api가 재선언 |
| `CATEGORY_BUDGET_MAX_PER_MONTH` | 30 | `apps/api/src/onboarding/onboarding-core.service.ts:37` · `…schemas.ts:350` | ⚠️ api가 재선언 |
| `EXPENSE_LIST_MAX_LIMIT` | 500 | `apps/mobile/src/api/client.ts:198` · `…schemas.ts:309` | ✅ 의도된 미러 |
| `TREND_REPORT_DEFAULT_MONTHS` | 6 | `apps/mobile/src/api/client.ts:1318` · `…schemas.ts:589` | ✅ 의도된 미러 |
| `LINK_PRICE_MAX_AGE_DAYS` | 180 | `apps/mobile/src/items/link-price.ts:88` · `…schemas.ts:441` | ✅ 의도된 미러 |
| `NECESSITY_LEVELS` | 3원소 | `apps/admin/src/lib/admin-api.ts:38` · `packages/domain/src/enums.ts:39` | ✅ 계약이 문다 |
| `PRODUCT_PLATFORMS` | 3원소 | `apps/admin/src/lib/admin-api.ts:92` · `packages/domain/src/enums.ts:51` | ✅ 계약이 문다 |
| `ANDROID_ALERT_BUTTON_LIMIT` | 3 | `expenses/record-row-actions.ts:49` · `family/household-scope.ts:317` · `notifications/notification-row-actions.ts:50` (+ `family/invite-flow.ts:191` 비export) | ⚠️ 앱 안 4벌 |
| `DNC_CONTRACT_PATH` | `"docs/dev/do-not-change.md"` | `dnc-guard-ledger.ts:83` · `dnc-scope-guard.ts:72` · `dnc-secret-scan.ts:94` | ⚠️ 3벌 |
| `repoRoot` | `join(process.cwd(),"..","..")` | 저장소 전체 **36벌**(test-utils/src 16 · mobile/src 6 · admin/src 4 · api/test 3 · scripts 7) | ⚠️ 최다 |

**왜 문제인가 — api↔contracts 4건이 특히 그렇다.**
✅로 적은 것들은 **경계를 넘는 의도된 미러**이고 계약이 묶는다: 모바일은 `@wooriai/contracts`에
의존하지 않는다는 관례가 있고(`contracts-mirror.test.ts`·`custom-items-mirror.test.ts`·
`category-budgets-mirror.test.ts`가 계약 소스를 읽어 값을 대조한다), 어드민↔도메인은
`admin-canonical-mirrors.test.ts:533`이 `packages/domain/src/enums.ts`를 파싱해 정본과 맞춘다.
**그런데 api는 다르다**: `apps/api/package.json:23`이 `@wooriai/contracts: workspace:*`를 선언하고,
같은 앱이 다른 자리에서는 그 상수를 **그냥 import한다** —
`finance/dto/expense.dto.ts:8`(`MONEY_KRW_MAX`), `imports/dto/import.dto.ts:2`,
`onboarding/dto/upsert-budget.dto.ts:3`, `onboarding/items-catalog.service.ts:5`
(`LINK_PRICE_MAX_AGE_DAYS`), `items-commerce/stage-bands.ts:2`(`STAGE_BAND_LABELS`).
즉 **같은 앱 안에서 관례가 갈린다**: 어떤 계약 상수는 import하고 어떤 것은 복사한다.
`custom-items.service.ts:31` 주석은 *"계약 패키지의 같은 이름 상수(T2 소유)와 바이트가 같아야 한다"* 고
적지만, 그 문장을 **확인하는 테스트가 api 쪽에 없다**(`apps/api/test/custom-items.e2e.test.ts:205`는
api 자기 상수만 쓴다).

**고치는 크기.** 작고 좁다 → 권고 R2.

**고치면 무엇이 좋아지나.** *"복사인가 import인가"* 를 사람이 파일마다 기억하지 않아도 된다.
그리고 `CUSTOM_ITEM_REASON_TEXT`는 **사용자에게 보이는 문구**라(DNC-018 대상) 두 벌이 갈리면
서버 응답과 계약 스키마가 다른 문장을 말한다.

---

## S8-6 · 사문 대장이 **모집단 밖으로 선언한 자리**의 사문

**대장의 선언**(`packages/test-utils/src/dead-export-ledger.ts:344-379`, `POPULATION_ROOTS`):
모집단은 `apps/mobile/src/**/*.ts`(테스트·`local-backend`·`local-fixtures` 제외)와
`apps/admin/src/lib/**/*.ts`(테스트·`.tsx` 제외) **둘뿐**이다. 그래서 `apps/api/**`,
`packages/**`, `apps/mobile/app/**`, `apps/admin/app/**`, `apps/admin/src/components/**`,
`scripts/**`는 **한 번도 세어지지 않는다.**

**측정값.** 대장과 **같은 정의**(줄 머리 `export function`/`export const`, 호출부는 비테스트
제품 소스 + 자기 파일, 주석·문자열 마스킹·템플릿 `${}` 보존)로 그 밖을 걸었다
(2026-09-07 08:08~08:18 UTC):

| 자리 | 모집단 | 사문 | 내역 |
| --- | --- | --- | --- |
| `apps/api/src/**` | 166파일 / 173 export (fn 86 · const 87) | **4** | 아래 표 |
| `packages/*/src/**` | 18파일 / 378 export | **7** | 참조가 **테스트에도 없다** |
| `apps/mobile/src/api/local-backend.ts`·`local-fixtures.ts` | 87 export | **4** | 전부 이름이 고백하거나 테스트 픽스처 |
| `apps/admin/src/lib/**`(.tsx 포함)·`src/components/**` | 375 export | **1** | `updateContentRevisionDraft` — **이미 대장에 줄이 있다** |
| `apps/mobile/app/**`·`apps/admin/app/**`·`scripts/**` | 69파일 / 8 export | **0** | — |

**`apps/api/src`의 넷:**

| 자리 | 테스트 참조 | 판정 |
| --- | --- | --- |
| `common/logging/loggable-path.ts:124` `UNMASKED_SECRET_CANDIDATE_PATHS` | `apps/api/test/request-log-fields.test.ts` | "테스트만 부른다"(대장의 갈래 ⓑ/ⓒ에 해당) |
| `common/logging/loggable-path.ts:149` `isSecretCandidateParamName` | 같은 파일 | 〃 |
| `onboarding/import-pipeline.service.ts:216` `PG_MAX_BIND_PARAMETERS` | `apps/api/test/import-excel.e2e.test.ts` | 〃 |
| `items-commerce/stage-bands.ts:30` `isStageBandLabel` | **없음** | ⚠️ **저장소 어디에서도 참조 0건** |

**`packages`의 일곱**(호출부를 **테스트까지 포함**해도 참조가 0인 것):

| 자리 | 이유가 있는가 |
| --- | --- |
| `packages/config/src/index.ts:1` `configPackageName` | ✅ `packages/config/package.json`의 `"//"` 필드가 "스텁 패키지" 라고 적는다 |
| `packages/ui/src/index.ts:1` `uiPackageName` | ✅ 같은 형식의 스텁 기록 |
| `packages/test-utils/src/index.ts:1` `testUtilsPackageName` | ✅ 같은 형식 |
| `packages/test-utils/src/dead-export-ledger.ts:867` `findCodeOnlyProductReferences` | ✅ 소스 주석이 *"이름을 남겨 두는 것은 …사각 재측정이 이 이름으로 서 있었기 때문"* 이라 적는다 |
| `packages/test-utils/src/dead-export-ledger.ts:1022` `findDeadConstants` | ❌ 이유 없음 |
| `packages/test-utils/src/dead-export-ledger.ts:1880` `deadConstantsInContractOnlyModules` | ❌ 이유 없음 |
| `packages/test-utils/src/resume-condition-ledger.ts:2881` `blindSpotDivergences` | ❌ 이유 없음 |

**왜 문제인가.** 셋이 겹친다.
① **가장 값이 큰 사실**: 이유 없는 사문 셋이 **사문 대장 자신의 파일 안에** 있다. 대장이 자기
모집단을 `mobile/src`+`admin/src/lib`로 못 박아 두었기 때문에, 대장은 **자기 자신을 보지 못한다**.
② `isStageBandLabel`은 **테스트조차 부르지 않는다** — 대장이 세는 열여섯~스물둘은 전부
*"테스트는 부른다"* 인데, 이 하나는 그 갈래보다 한 칸 더 죽어 있다.
③ 반대로 `local-backend`·`local-fixtures`를 밖에 둔 대장의 판단은 **실측으로 옳다**: 그 넷은
`resetLocalBackendForTests`·`seedLocalDemoFixturesForTests`(이름이 고백) + 픽스처 상수 둘이고,
호출부에 테스트를 넣으면 **0건**이 된다. 대장의 머리말이 예측한 그대로다.

**근거.** 위 표의 수는 전부 스크립트 실측이고, 각 항목은 `grep -rn "\b<이름>\b" apps packages
scripts`로 재확인했다(2026-09-07 08:09·08:18 UTC).

**고치는 크기.** 지우는 판단은 이 정찰의 몫이 아니다. **좁은 것 하나만 권한다**(R4):
이유 없는 넷(`isStageBandLabel`·`findDeadConstants`·`deadConstantsInContractOnlyModules`·
`blindSpotDivergences`)에 **이유 주석 한 덩이씩** — 라운드 88 트랙 D가 아홉에 대해 이미 한 그 손이다.
⚠️ 그때와 마찬가지로 **순서가 전부다**: 대장의 그물은 주석을 마스킹하므로 이 넷이 대장 모집단
**밖**에 있는 한 순서 문제는 없지만, 언젠가 모집단을 넓힌다면 **먼저 마스킹, 그다음 주석**이다.

**고치면 무엇이 좋아지나.** *"호출부 0건인 판정은 결함이 아니라 아직 배선되지 않은 답"* 이라는
대장 자신의 문장이, 대장 밖의 넷에도 적용된다.

---

## S8-7 · 순환 의존 — 런타임 사이클 **0** (건강)

**측정값** (2026-09-07 08:14 UTC · 비테스트 `.ts/.tsx` **544파일**의 import 그래프):

- **패키지·앱 수준 간선**: `api → contracts, domain` · `contracts → domain` · `mobile → domain`.
  **패키지 사이클 0.** (`admin`은 워크스페이스 패키지를 하나도 import하지 않는다 — S8-5의
  `NECESSITY_LEVELS` 미러가 그 결과다.)
- **파일 수준**: 타입 import를 포함해 세면 사이클 **13**. 전부 `apps/mobile/src` 안이다.
- **값(value) import만 세면 사이클 0.** 13개 전부 `import type` 한 줄에서 끊긴다.

끊기는 자리(실측 확인):

| 사이클 | 끊는 줄 |
| --- | --- |
| `client → api-error → child-form → client` | `children/child-form.ts:11` `import type { UpdateChildBody }` |
| `notification.store ↔ notification-preferences.store` | `notification-preferences.store.ts:4` `import type` |
| `offline/messages ↔ offline/sync-controller` | `offline/messages.ts:10` `import type { OfflineStorageState }` |
| `preparation/catalog-contract ↔ PreparationListParity` | `catalog-contract.ts:50` `import type` |

⚠️ **이 저장소는 그 사실을 알고 소스에 적어 두었다.** `apps/mobile/src/api/api-error.ts:48-53`:
*"이 값 import는 `../children/child-form`을 거쳐 순환 **직전**까지 간다 … 지금은 그 한 줄이
`import type`이라 컴파일 뒤 사라져서 런타임 사이클이 없다. 그 줄이 값 import로 바뀌면 …
이 표의 **세 줄**이 `undefined`가 될 수 있다"*(라운드 69 리뷰 P-5).

**남는 사각 하나(값으로만).** 그 위험을 **계약이 물지 않는다** — `child-form.ts:11`이 값 import로
바뀌어도 빨개지는 테스트를 찾지 못했다. 값 import 사이클 수는 오늘 **0**이고, 그것이 0으로 유지되는
근거는 주석뿐이다. (⚠️ 이것을 계약으로 세우는 것은 새 대장을 만드는 일이라 **이 정찰은 권하지 않는다** —
값으로만 남긴다.)

---

## S8-8 · 타입 탈출구 — 제품 소스는 거의 비어 있다 (건강)

**측정값** (2026-09-07 08:16 UTC · `.next/` 빌드 산출물 제외):

| 축 | 제품 소스 | 테스트 | 비고 |
| --- | --- | --- | --- |
| `as any` | **0** | **0** | 저장소 전체 1건은 `disclosure-keys.test.ts:56`의 **영어 테스트 이름**("the same as any other unread key")이다 |
| `@ts-ignore` / `@ts-nocheck` | **0** | **0** | 저장소 12건은 전부 `apps/admin/.next/types/validator.ts`(생성물) |
| `@ts-expect-error` | **0** | **0** | — |
| `: any` | **0** | **0** | 저장소 56건 중 52건이 `.next/types/**`, 나머지 4건은 **영문 산문 안의 "any"**(`content-revisions.service.ts:520`, `year-month.ts:10`, `link-filters.test.ts:223`) |
| `as unknown as` | 14 | 21 | 제품 쪽 집중: `api/src/admin/content-revisions.service.ts` **6**(전부 `Prisma.InputJsonValue` 캐스팅), `api/src/imports/import-parser.ts` 2, `mobile/src/api/client.ts` 2 |
| non-null `!` | **338** (86파일) | 1,022 | 아래 |
| `eslint-disable` | 18 | 0 | `react-hooks/exhaustive-deps` 6 · `@typescript-eslint/no-var-requires` 5(expo 선택적 모듈 로딩) · `no-console` 2 · 기타 5 |

**non-null 단언 상위**(제품 소스, 2026-09-07 08:14 UTC):
`app/(tabs)/reports.tsx` 24 · `app/(tabs)/index.tsx` 16 · `app/settings/privacy.tsx` 15 ·
`api/src/settings/settings.controller.ts` 11 · `app/family/index.tsx` 10 · `app/settings/children.tsx` 10 ·
`app/(tabs)/records.tsx` 9 · `app/budget.tsx` 9 · `api/src/admin/dto/admin.dto.ts` 8 ·
`api/src/households/households.controller.ts` 8 · `api/src/imports/imports.controller.ts` 8 ·
`api/src/onboarding/items-catalog.service.ts` 8.

**판정.** 이 축은 **건강하다**. `as any`·`@ts-ignore`·`: any`가 제품 소스에 **한 건도 없다**는 것은
드문 일이고, 값으로 기록할 만하다. non-null 단언 338은 화면 파일에 몰려 있는데(상위 8개 중 7개가
S8-1의 거대 화면), 이는 **거대 화면의 부산물**이지 독립된 부채가 아니다 — 같은 쿼리 결과를 한 함수
안에서 스무 번 다시 좁히면서 생긴다. **권고하지 않는다**(고치려면 S8-1을 건드려야 한다).

---

## S8-9 · 테스트 실행 시간

⚠️ **측정 조건.** 이 창에서 저장소의 다른 에이전트들이 동시에 vitest를 돌리고 있었다
(2026-09-07 08:23 UTC에 `ps`로 **vitest 프로세스 44개**). 그래서 아래 벽시계 값은 **상한**이고,
파일 사이의 **상대 순위**가 이 절의 값이다.

### mobile (2026-09-07 08:05~08:25 UTC · `npx vitest run`)

**294파일 / 6,157 테스트 / 파일 시간 합 159.2s.** 상위 10:

| 초 | 케이스 | 파일 |
| --- | --- | --- |
| **35.7** | 208 | `apps/mobile/src/a11y-contract.test.ts` |
| **26.8** | 40 | `apps/mobile/src/query/shared-cache-policy.test.ts` |
| 9.1 | 62 | `apps/mobile/src/korean-particle-guard.test.ts` |
| 4.9 | 18 | `apps/mobile/src/stores/persist-upgrade.test.ts` |
| 4.8 | 18 | `apps/mobile/src/state-screen-conventions.test.ts` |
| 4.7 | 35 | `apps/mobile/src/keyboard-tap-guard.test.ts` |
| 2.3 | 21 | `apps/mobile/src/children/manage-children-flow.test.ts` |
| 2.3 | 96 | `apps/mobile/src/offline/messages.test.ts` |
| 1.7 | 12 | `apps/mobile/src/api/contracts-mirror.test.ts` |
| 1.5 | 21 | `apps/mobile/src/api/custom-items-mirror.test.ts` |

**상위 두 파일이 62.5s = 합의 39.3%**다. 나머지 292파일이 96.7s.

**왜 그 둘이 느린가 — 실측.**
- `a11y-contract.test.ts`: 리터럴 경로를 읽는 `source("…")` 호출이 **169곳**인데 **서로 다른 경로는
  53개**뿐이다(2026-09-07 08:31 UTC). 즉 **116번은 방금 읽은 파일을 다시 읽는다.**
  `source`는 `const source = (relativePath) => readFileSync(join(mobileRoot, relativePath), "utf8")`
  (`:88`) — **캐시가 없다.** 여기에 `listComponentSources()`가 **12곳**에서 불리고, 한 번마다
  `app/`+`src/`를 재귀 `readdirSync`한 뒤 **`.tsx` 61개**를 훑는다.
- `shared-cache-policy.test.ts`: `productionSources()`가 **11곳**에서 불리고, 한 번마다
  `walk(app) + walk(src)`로 **비테스트 `.ts/.tsx` 312개**를 열거·판독한다(`:34-50`). 40 케이스에 26.8s.

### admin (2026-09-07 08:26 UTC)

**42파일 / 760 테스트 / 전부 통과 / 파일 시간 합 5.8s.** 최대가
`admin-load-error-copy.test.ts` **1.0s**(57 케이스). ✅ 이 워크스페이스는 건강하다 —
고칠 자리가 없다.

### packages (test-utils / domain / contracts)

관측 창 안에서 완주하지 못했다(다른 에이전트가 같은 시각 `dead-export-ledger.test.ts`를 따로
돌리고 있었다 — 08:23 UTC `ps` 확인). **값을 지어내지 않는다**: 미측정으로 남긴다.
정적 대리 지표만 적는다 — test-utils는 **테스트 20파일**이고 그 대장들이 저장소 전수를 반복해서
걷는다(`comment-tolerant-anchor-ledger.ts` 1,197줄·`dead-export-ledger.ts` 2,282줄·
`resume-condition-ledger.ts` 3,218줄).

### api — **이 창에서는 측정할 수 없었다**

`pnpm db status`(08:14 UTC)가 `docker.sock` 없음으로 실패했고, 포터블 PostgreSQL 경로
`.toolcache/pg16/pgsql/bin`에는 **바이너리가 없다**(`.toolcache/`에는 `pgdata`·`pgpass.txt`만 있다).
`localhost:5432`는 닫혀 있다. 같은 상자에 PostgreSQL 16이 **하나 떠 있으나**
(`-D /var/lib/postgresql/r106data -p 55432`) 그것은 **다른 에이전트가 세운 인스턴스**라
여기서 쓰지 않았다.

정적 대리 지표(2026-09-07 08:29 UTC): api 테스트 **87파일 / 38,206줄**.
`apps/api/vitest.config.ts`는 워커를 `max(2, min(4, cpus))`로 상한을 두고, **직렬화가 필요한
스위트 5개**를 `test/helpers/exclusive-suites.ts`가 이름으로 든다:

| 줄 | `it()` | 스위트 |
| --- | --- | --- |
| 2,182 | 51 | `data-retention-purge.db.test.ts` |
| 543 | 8 | `admin-analytics-summary.e2e.test.ts` |
| 424 | 6 | `admin-affiliate-click-breakdown.e2e.test.ts` |
| 382 | 4 | `admin-dashboard-summary.e2e.test.ts` |
| 272 | 6 | `categories.e2e.test.ts` |

배타 스위트 다섯 중 **하나가 나머지 넷의 합보다 크다**(2,182 vs 1,621줄). 227s→106s를 만든
그 축(병렬화)의 **오늘 남은 상한이 여기**일 가능성이 있으나, **측정하지 않았으므로 단정하지 않는다.**
⚠️ 다음 라운드가 재려면 DB가 필요하고, 그때의 조건은 *"vitest가 이 상자에 혼자 있을 것"* 이다.

### 계약이 소스를 무는 폭 (리팩터링 폭발 반경)

테스트 **456파일 중 311파일(68.2%)** 이 `readFileSync`로 소스를 읽는다(2026-09-07 08:28 UTC).
테스트 안에 **문자열 리터럴로 적힌 저장소 경로는 184개**(`apps/`·`packages/`·`scripts/`·`docs/` 접두)이고,
그중 **166개가 실재**한다. 나머지 **18개**는 대부분 대장 테스트가 임시 트리에 만드는 **합성 픽스처**
(`apps/mobile/src/a.ts`·`fixture/pretend.ts`·`definitely-not-here-r93e.tsx` 등)이고,
실재하지 않는 실제 경로는 **하나**뿐이다 — `apps/api/test/mobile-link-price-contract.test.ts`.
그리고 그 하나는 **이미 유령으로 문서화되어 있다**(`packages/contracts/src/schemas.ts:438`과
`apps/mobile/src/api/contracts-mirror.test.ts:48`이 *"존재한 적이 없다"* 고 적는다).
✅ 이 축은 건강하다. **이 68.2%가 곧 "대규모 이동 금지"의 실측 근거다.**

---

## S8-10 · 관측 중 mobile 실패 4건 — 동시 편집 아티팩트 (건강 판정 아님)

08:25 UTC 실행에서 6,157 중 **4건 실패**. 넷 다 **소스 문자열 계약**이고, 하나는 테스트 이름이
자기 라운드를 밝힌다:

| 파일 | 테스트 |
| --- | --- |
| `apps/mobile/src/a11y-contract.test.ts:1046` | GAP-063 #10 — `accessibilityHint={householdNotice ??…}` 를 못 찾음 |
| `apps/mobile/src/family/household-scope.test.ts:1023` | 라운드 63 #7 — `onPress={() => router.push(addChildSc…` 를 못 찾음 |
| `apps/mobile/src/family/invite-permissions.test.ts:380` | UX-Q(A) — `import { inviteCreateErrorMessage }` 를 못 찾음 |
| `apps/mobile/src/notifications/notification-preferences.store.test.ts:159` | **"라운드 106 T7"** — 설명 문구에 `마지막 지출` 을 못 찾음 |

⚠️ **이것을 저장소 건강으로 읽지 마라.** 넷 다 "테스트는 새 계약, 소스는 아직 옛 상태"의 중간
스냅숏이고, 마지막 하나는 **오늘 진행 중인 트랙**의 이름을 달고 있다. 값으로 남기는 이유는,
다음 라운드가 이 문서를 근거로 *"S8 시점에 mobile이 빨갰다"* 고 오독하지 않게 하기 위해서다.

---

## 건강한 축 (값으로)

| 축 | 값 |
| --- | --- |
| 패키지 간 순환 | **0** (간선 4개, 모두 단방향) |
| 런타임 모듈 순환 | **0 / 544파일** (타입 포함 13은 전부 `import type`으로 끊김) |
| `as any` (제품 소스) | **0** |
| `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` | **0** |
| `: any` (제품 소스) | **0** |
| admin 테스트 | **42파일 / 760 케이스 / 5.8s / 실패 0** |
| 테스트가 이름 부른 경로의 실재율 | 문자열로 적힌 경로 184개 중 **166개 실재**, 미실재 18개 중 17개는 합성 픽스처·유령 1개는 문서화된 것 |
| 화면 라우트·스크립트의 사문 | `apps/mobile/app/**`·`apps/admin/app/**`·`scripts/**` 69파일 **0건** |
| 대장의 `local-backend` 제외 판단 | **실측으로 옳다**(4건 전부 이름 고백 또는 테스트 픽스처, 테스트 포함 시 0건) |

---

## 권고 (좁고 검증 가능한 것만 · 5개)

> ⚠️ 다섯 다 **export 이름·시그니처·반환값·사용자 문구를 바꾸지 않는다.** 각 항목에 대해
> "이 변경이 무는 소스 문자열 계약"을 실제로 세어 붙였다.

### R1 — 테스트 두 파일 안에서만 파일 읽기를 메모이즈한다 (mobile 스위트 39% 구간)

- **만지는 것**: `apps/mobile/src/a11y-contract.test.ts`, `apps/mobile/src/query/shared-cache-policy.test.ts`. **제품 소스 0바이트.**
- **무엇**: `source(relativePath)`(a11y `:88`)와 `listComponentSources()`(a11y `:91`),
  `productionSources()`(shared-cache `:49`)를 `Map` 한 개로 감싼다. 로직·단언·케이스 수 불변.
- **근거 수치**: a11y는 리터럴 경로 호출 169회 / 서로 다른 경로 53개 → **116회가 재판독**;
  `listComponentSources()` 12회 × `.tsx` 61개. shared-cache는 `productionSources()` 11회 ×
  비테스트 소스 312개. 두 파일 합 62.5s / mobile 합 159.2s.
- **계약 영향**: **0**. 두 파일 다 자기 안의 헬퍼만 바뀐다.
- **검증**: `pnpm --filter mobile test` 케이스 수(6,157)와 통과 집합이 같은지, 그리고 두 파일의
  파일 시간이 줄었는지 JSON 리포터로 대조. ⚠️ **다른 에이전트가 없는 창에서 재라** — 이번 창의
  62.5s는 vitest 44프로세스 경합 아래의 값이라 상한이다.

### R2 — `apps/api`의 계약 상수 4개를 재선언에서 `@wooriai/contracts` import로 바꾼다

- **만지는 것**: `apps/api/src/onboarding/custom-items.service.ts`(:25·:27·:33),
  `apps/api/src/onboarding/onboarding-core.service.ts`(:37). **두 파일.**
- **무엇**: `export const X = …`를 `export { X } from "@wooriai/contracts"` 형태로 바꾸되
  **이름과 값은 그대로 재export**한다(`apps/api/test/custom-items.e2e.test.ts:13`과
  `apps/api/test/category-budgets.e2e.test.ts:10`이 이 모듈에서 import하므로 export를 없애면 안 된다).
- **근거**: 같은 앱이 이미 다섯 자리에서 contracts 상수를 import한다(S8-5 목록).
  `custom-items.service.ts:31` 주석이 요구하는 *"바이트가 같아야 한다"* 가 **구조로 참**이 된다.
- **계약 영향**: 모바일 미러 테스트들은 `packages/contracts` **소스를 정규식으로 읽으므로**
  (`custom-items-mirror.test.ts:60`, `category-budgets-mirror.test.ts:103`) contracts 파일이
  안 바뀌는 이 변경에 영향받지 않는다. api 쪽에서 `export const X` 문자열을 무는 테스트는
  **0건**으로 확인했다.
- **검증**: `pnpm --filter api test` + `pnpm --filter mobile test`.

### R3 — FNV-1a 지문 15줄 두 벌을 한 자리로 (이 저장소 최대 중복)

- **만지는 것**: `apps/mobile/src/children/child-create-idempotency.ts`,
  `apps/mobile/src/items/custom-item-form.ts`. 새 파일 하나(예:
  `apps/mobile/src/idempotency/body-fingerprint.ts`)를 두거나, 둘 중 한쪽에 비export 헬퍼를 둔다.
- **무엇**: `childCreateBodyFingerprint`·`customItemBodyFingerprint`의 **본체만** 공유 헬퍼 호출로.
  **두 export 이름은 그대로 남긴다.**
- **근거**: 본체 413자가 바이트로 같다(이 저장소 최대). `custom-item-form.ts:298-302` 주석이
  *"childCreateBodyFingerprint와 같은 판단"* 이라고 이미 적고 있다.
- **계약 영향**: **0**. 무는 문자열 5건은 전부 **호출부**다 —
  `shared-cache-policy.test.ts:418`·`onboarding-step-progress.test.ts:192`·
  `local-progress.test.ts:285`·`consent-recovery.test.ts:132`·`custom-item-wiring.test.ts:82`.
  본체 안쪽을 무는 문자열 0건(실측).
- **검증**: `pnpm --filter mobile test`. 지문 값이 바뀌지 않았음은 두 모듈의 기존 단위 테스트가 문다.

### R4 — 대장 밖의 이유 없는 사문 넷에 **이유 주석 한 덩이씩**

- **만지는 것**: `apps/api/src/items-commerce/stage-bands.ts`(`isStageBandLabel`),
  `packages/test-utils/src/dead-export-ledger.ts`(`findDeadConstants` :1022 ·
  `deadConstantsInContractOnlyModules` :1880),
  `packages/test-utils/src/resume-condition-ledger.ts`(`blindSpotDivergences` :2881).
- **무엇**: **주석만.** 코드·문자열·export 값은 바이트 그대로 — 라운드 88 트랙 D가 아홉에 대해
  한 그 손과 같다. 각 주석은 *"왜 아무도 부르지 않는가"* 를 말해야 한다(*"안 쓴다"* 는 이유가 아니다).
  ⚠️ `isStageBandLabel`은 **테스트조차 부르지 않으므로** 주석이 *"살릴 것인가 지울 것인가"* 를
  다음 라운드에 넘기는 재개 조건이어야 한다.
- **근거**: S8-6의 표. 나머지 셋(`configPackageName`·`uiPackageName`·`testUtilsPackageName`)은
  이미 `package.json`의 `"//"`에 이유가 있으므로 **손대지 않는다**.
- **계약 영향**: **0**(주석만). ⚠️ 단, 대장의 그물이 주석을 마스킹하지 않는 날이 오면 순서가
  중요해진다 — 오늘은 이 넷이 모집단 밖이라 무관하다.

### R5 — `packages/test-utils`의 테스트 10개가 자기 `repoRoot`를 선언하지 않게 한다

- **만지는 것**: `packages/test-utils/src/*.test.ts` 중 `const repoRoot = join(process.cwd(),"..","..")`를
  손으로 든 **10파일**(`accessibility-checklist-shape` · `contract-net-ledger` ·
  `data-retention-promise` · `harness-catalog-cost` · `public-surface-brand` · `release-readiness` ·
  `repo-self-description` · `runtime-checklist-shape` · `source-contract-slice-guard` ·
  `store-brand-and-asset-provenance`).
- **무엇**: 같은 패키지가 **이미 `export const repoRoot`를 6곳에서 내보낸다**
  (`dead-export-ledger.ts:197` 등). 그중 하나를 import하는 한 줄로 바꾼다.
- **근거**: 저장소 전체 `repoRoot` 선언 **36벌**(test-utils 16 · mobile/src 6 · admin/src 4 ·
  api/test 3 · scripts 7). test-utils 안의 16 중 6은 모듈이 export하는 정본이고 **10이 사본**이다.
- **계약 영향**: 이 변경은 **사문 대장의 수를 움직인다** — `repoRoot` 중 몇몇은 지금 export되어 있고,
  ⚠️ **먼저 `findDeadExports()`를 돌려 그 6개가 사문 목록에 들어오는지 확인한 뒤에** 손대라.
  (S8-6 실측에서 `repoRoot`들은 사문이 아니었다 — 서로 부른다.)
- **범위 밖**: mobile/admin/api/scripts의 20벌은 **건드리지 않는다**(워크스페이스 경계를 넘는
  import를 만들게 되고, 그건 좁은 변경이 아니다).

---

## 교집합 없는 소유 파일 목록

각 권고가 만지는 파일은 아래가 전부이고, **서로 한 파일도 겹치지 않는다.**

| 권고 | 소유 파일 |
| --- | --- |
| **R1** | `apps/mobile/src/a11y-contract.test.ts`<br>`apps/mobile/src/query/shared-cache-policy.test.ts` |
| **R2** | `apps/api/src/onboarding/custom-items.service.ts`<br>`apps/api/src/onboarding/onboarding-core.service.ts` |
| **R3** | `apps/mobile/src/children/child-create-idempotency.ts`<br>`apps/mobile/src/items/custom-item-form.ts`<br>(신설 시) `apps/mobile/src/idempotency/body-fingerprint.ts` |
| **R4** | `apps/api/src/items-commerce/stage-bands.ts`<br>`packages/test-utils/src/dead-export-ledger.ts`<br>`packages/test-utils/src/resume-condition-ledger.ts` |
| **R5** | `packages/test-utils/src/accessibility-checklist-shape.test.ts`<br>`packages/test-utils/src/contract-net-ledger.test.ts`<br>`packages/test-utils/src/data-retention-promise.test.ts`<br>`packages/test-utils/src/harness-catalog-cost.test.ts`<br>`packages/test-utils/src/public-surface-brand.test.ts`<br>`packages/test-utils/src/release-readiness.test.ts`<br>`packages/test-utils/src/repo-self-description.test.ts`<br>`packages/test-utils/src/runtime-checklist-shape.test.ts`<br>`packages/test-utils/src/source-contract-slice-guard.test.ts`<br>`packages/test-utils/src/store-brand-and-asset-provenance.test.ts` |

⚠️ **R4와 R5는 같은 패키지(`packages/test-utils`)를 만지지만 파일이 다르다** — R4는 대장 모듈
둘(`dead-export-ledger.ts`·`resume-condition-ledger.ts`)의 **주석만**, R5는 테스트 10개의
**import 줄만** 만진다. 그래도 두 트랙을 나란히 돌린다면 R4를 먼저 끝내라: R5가 대장 테스트
(`repo-self-description.test.ts` 등)를 건드리므로, R4의 주석 추가가 그 테스트들 아래에서
초록인지 먼저 확인하는 편이 안전하다.

---

## 권하지 않는 것 (그리고 그 이유를 값으로)

| 안 하는 것 | 왜 |
| --- | --- |
| 거대 화면 8개 분해(S8-1) | 테스트 456 중 **311(68.2%)** 이 소스를 문자열로 읽고, 그중 다수가 화면 본문의 코드 조각을 그대로 문다. 대규모 이동은 그 계약을 수십 개 단위로 깬다 |
| `record-row-actions.ts` ↔ `notification-row-actions.ts` 모듈 통합(S8-4 ⓘⓘ) | 두 파일 주석이 이 쌍둥이 관계를 **의도로** 적고 있고, 통합의 옳고 그름은 이 정찰이 판정할 수 없다 |
| `isRepeatableExpenseType` → `countsTowardMonthlyTotal` 단일화(S8-4 ⓘⓘⓘ-2) | `record-row-actions.ts`는 **import가 한 줄도 없는 무의존 모듈**이다. 그 무의존성이 의도인지 미확인이고, `recurring-flow.test.ts:160`이 그 이름을 문자열로 문다 |
| `effectiveQueryLength`(admin↔api) 통합(S8-4 ⓘ) | 프로세스 경계를 넘는 의도된 미러이고 양쪽에 테스트가 있다 |
| `import type` 사이클 방지 계약 신설(S8-7) | 새 대장을 세우는 일이고, 오늘 위반 **0건**이다 |
| non-null 단언 338건 정리(S8-8) | 상위 8개 중 7개가 S8-1의 거대 화면이다 — 이것을 고치려면 화면을 고쳐야 한다 |
| 사문 넷 삭제(S8-6) | 대장 자신의 규율이 *"호출부 0건인 판정은 결함이 아니라 아직 배선되지 않은 답"* 이다. 이유를 적는 것이 먼저다(R4) |

---

## 다음 라운드가 다시 재야 하는 것 (재개 조건)

1. **api 테스트 시간** — 오늘은 DB가 없어 못 쟀다. 조건: PostgreSQL 접속 가능 + **vitest가 이 상자에 혼자**.
   그때 볼 것은 배타 스위트 다섯(특히 `data-retention-purge.db.test.ts` 2,182줄 / 51케이스)이
   전체 벽시계에서 차지하는 비율이다.
2. **packages 테스트 시간** — 오늘 완주하지 못했다. 같은 조건.
3. **R1 이후의 mobile 합계** — 오늘의 159.2s는 vitest 44프로세스 경합 아래의 상한이다.
   R1 전후를 **같은 조건에서** 재야 39%라는 수가 의미를 갖는다.
4. **`apps/api/src`·`packages/*/src`를 사문 대장 모집단으로 들일 것인가** — 오늘 실측으로
   그 밖에 사문 **16건**(이유 없는 것 4건)이 있음을 확인했다. 들이는 날의 조건은 대장 자신이
   적어 둔 그것과 같다: *"먼저 모집단, 그다음 바늘"*.
