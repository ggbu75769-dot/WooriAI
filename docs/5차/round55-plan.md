# 라운드 55 설계 — 반복/고정 지출(#4) · 앱 잠금 PIN(#9)

> GAP-054 후속 단독 2건(`docs/5차/budget-app-gap-analysis.md` §29 "후속 단독"). 정찰 시점: `master=6d8a2aa`(라운드 54 머지 직후), 브랜치 `claude/app-feature-review-design-xx71k3`. 이 문서는 **읽기 전용 정찰 + 설계**이며 코드 변경은 포함하지 않는다. 파일:라인은 정찰 시점 기준.

---

## 0. 요약 판정 (먼저 읽을 것)

| 질문 | 답 | 근거 |
|---|---|---|
| 반복 지출 저장 위치 | **zustand persist + `persistStorage`(AsyncStorage)**. 오프라인 아웃박스(SQLite)가 **아니다**. | `src/stores/persist-storage.ts:16`, 관례 5벌(§1.1). 아웃박스에 넣으면 flush가 서버로 올려 "자동 기록"이 된다 → DNC-013 위반 |
| expo-secure-store | **이미 의존성에 있다** (`apps/mobile/package.json` deps `"expo-secure-store": "~14.0.1"`) | 새 패키지 추가 없이 PIN 구현 가능 |
| PIN 해시 | 저장소에 이미 있는 순수 JS SHA-256 재사용 (`src/auth/sha256.ts`, 난수 `src/auth/pkce.ts:38 getRandomBytes`) | 새 의존성 0 |
| 리마인더 배치 | **홈 카드 한 자리만**(순위표 합류). 기록 탭에는 추가하지 않는다 | §1.5 잔소리 중복 분석 |
| PRIV-104 합류 | **둘 다 합류해야 한다**(반복 템플릿 = 계정 데이터 / PIN = 미합류 시 새 사용자 브릭) | §1.6, §2.7 |
| 서버 테이블 | 000021 초안만 문서에(§1.8). 라운드 55 실행 범위 아님 | DNC-007 additive |

---

## 1. #4 반복/고정 지출 (로컬 우선)

### 1.1 현재 코드 사실 — persist 스토어 구조

저장소의 persist 스토어는 **6벌 + 로컬 백엔드 1벌**이고, 전부 같은 형태다.

| 스토어 | 파일:라인 | 저장 키 | storage | version/migrate |
|---|---|---|---|---|
| 세션 | `src/stores/session.store.ts:238-370` | `wooriai-session` | `secureSessionStorage` | 4 + sanitize |
| 온보딩 진행도 | `src/stores/onboarding-progress.store.ts:86-114` | `wooriai-onboarding-progress` | `persistStorage` | 있음 |
| 선택된 아이 | `src/stores/selected-child.store.ts:22-30` | `wooriai-selected-child` | `persistStorage` | 있음 |
| 알림 이력 | `src/notifications/notification.store.ts:304-344` | `wooriai-notifications` | `persistStorage` | 있음 |
| **알림 종류별 on/off** | `src/notifications/notification-preferences.store.ts:164-183` | `wooriai-notification-preferences` | `persistStorage` | `version: 1` + `migrate`/`merge` 양쪽에 sanitize |
| 구매 확인 | `src/commerce/purchase-followup.store.ts:272-285` | `wooriai-purchase-followup` | `persistStorage` | 있음 |
| 홈 첫 실행 | `src/home/first-run-guide.store.ts:40-54` | `wooriai-home-first-run-guide` | `persistStorage` | 있음 |

- `persistStorage`(`src/stores/persist-storage.ts:16-17`)는 `typeof window === "undefined"`면 인메모리 Map, 아니면 AsyncStorage다 — vitest에서 스토어를 그대로 import해 왕복 테스트가 된다.
- 민감 필드만 SecureStore로 빼는 어댑터 선례가 `src/stores/secure-session-storage.ts:13-14, 125-174`에 있다(키 2개만 SecureStore, 나머지는 같은 AsyncStorage 블롭).
- **채택안**: `src/stores/recurring-expense.store.ts` = `persist(..., { name: "wooriai-recurring-expenses", storage: createJSONStorage(() => persistStorage), version: 1, migrate/merge에 sanitize })` — `notification-preferences.store.ts`를 그대로 본뜬다. 품목명·금액은 민감 자격증명이 아니므로 SecureStore 어댑터는 쓰지 않는다(세션 토큰만의 특례).
- **아웃박스 배제 근거**: `src/offline/sync-engine.ts`/`types.ts`의 `local_expenses`·`mutation_outbox`는 **실제 지출 행**을 담고 flush가 서버로 올린다. 템플릿을 여기 넣으면 "사용자가 확인하지 않은 지출"이 서버에 생긴다 = DNC-013 + DNC-012 정신 위반. 템플릿은 지출이 아니라 **입력 보조**다.
- 로컬 id 생성 관례: `src/api/local-backend.ts:398-402` `local-${prefix}-${Date.now().toString(36)}-${counter}`.

### 1.2 기존 기능과의 접점 (중복 잔소리 조사)

| 기존 기능 | 파일:라인 | 겹치는 지점 | 분리 규칙 |
|---|---|---|---|
| 최근 품목 칩 (EXP-113) | `src/expenses/recent-items.ts:74, 98-129` (`RECENT_ITEM_CHIP_LIMIT=5`, 로컬 스냅숏 우선 → 서버 월 캐시 폴백) | 둘 다 "같은 품목 다시 입력" | 칩 = **과거 사실**(무엇을 샀었나), 템플릿 = **사용자가 선언한 약속**(매월 n일). 칩 계산에 템플릿을 섞지 않는다 — 섞으면 "방금 적은 것이 맨 앞"이라는 칩 순서 계약이 깨진다(그 파일 헤더 18-22행) |
| 홈 빠른 기록 칩 | `app/(tabs)/index.tsx:1552-1560` → `src/home/quick-record-chips.ts` | 위와 같은 소스 | 불변 |
| 품목 자동완성 | `src/expenses/item-autocomplete.ts` + `src/expenses/item-name-match.ts:29-31 normalizeItemName` | 템플릿의 "이번 달 기록됐나" 판정도 이름 비교가 필요 | **`normalizeItemName`을 재사용**한다(규칙 두 벌 금지 — 그 파일 헤더 4-8행이 같은 이유로 만들어졌다) |
| `record_gap` 리마인더 (GAP-054 #6) | `src/notifications/generators.ts:295, 406-420`; 억제 근거 `:334-340`; 훅 `src/notifications/useHomeNotificationEvaluation.ts:87-141` | 둘 다 "기록하세요" | **채널이 다르다**: record_gap = 알림함 엔트리(주 1회 dedupe), 정기 지출 = 홈 카드(알림함 항목을 만들지 않는다). 정기 지출 리마인더는 `notification.store` ingest 경로에 **절대 넣지 않는다** — 넣으면 `NOTIFICATION_TYPE_OPTIONS`(6종, `notification-preferences.store.ts:51-85`)에 7번째 스위치가 필요해지고 dedupe 메모리를 소모한다 |
| 첫 실행 안내 / 준비 현황 카드 | `src/home/home-section-priority.ts:136-231` | 홈 카드 자리 경쟁 | 순위표(`HOME_SECTION_RANK`)에 정식 합류시켜 상한 2장 규칙 안에서 경쟁시킨다(§1.5) |
| 프리필 계약 | `src/expenses/record-row-actions.ts:218-297` (`buildRepeatExpenseParams`/`parseExpensePrefillParams`), 소비처 `app/expenses/new.tsx:347-382` | "기록하기" 원탭 | **같은 모듈을 확장**한다(§1.4) |

### 1.3 리마인더 판정 (순수 모듈 설계)

신규 `src/expenses/recurring-template.ts` — react-native/expo-router/저장소 비의존(vitest 대상). 저장소의 순수 모듈 규율 그대로.

```ts
export type RecurringExpenseTemplate = {
  id: string;            // local-recurring-...
  childId: string;
  itemName: string;      // trim 후 1자 이상, 120자 이하(서버 varchar(120) 미러)
  amountKrw: number;     // DNC-013: 0 초과 정수, EXPENSE_AMOUNT_MAX_KRW 이하
  categoryId: string;    // 8타일 id 또는 서버 정식 UUID(프리필이 resolveTileCategoryId로 흡수)
  paymentMethod: "card" | "cash" | "transfer" | "mobile_pay";
  merchant?: string;
  dayOfMonth: number;    // 1..31
  active: boolean;
  createdAt: string;     // ISO
  /** "이번 달은 이미 기록했어요"로 넘긴 달(YYYY-MM). 최근 12개만 유지. */
  skippedYearMonths: string[];
};
export const RECURRING_TEMPLATE_LIMIT = 20;
```

핵심 함수(전부 순수):

- `recurringDueDateForMonth(yearMonth, dayOfMonth): string` — **월말 클램프**. `dayOfMonth=31`이 2월이면 `YYYY-02-28/29`, 4월이면 `YYYY-04-30`. 날짜 산술은 새로 짜지 않고 `src/notifications/iso-week.ts`의 규율(+9h 시프트 후 `Date.UTC`/`getUTC*`)을 따른다. `Date.UTC`가 범위 초과를 조용히 넘기는 함정은 그 파일 `:74-80`이 이미 문서화했다.
- `buildRecurringReminder(input): RecurringReminder | null` — 입력은 `{ templates, childId, yearMonth, todayIso, monthExpenses, pendingRows }`.
  1. `monthExpenses === undefined`(이번 달 캐시 미도착) → **`null`**. 모르면 말하지 않는다(`weeklySummaryNotification`의 G-1 3상태 규율과 동일 — `generators.ts:428-433`).
  2. `template.childId !== childId` 또는 `!active` → 제외.
  3. `todayIso < 이번 달 due date` → 제외(아직 오지 않은 예정을 조르지 않는다).
  4. `skippedYearMonths.includes(yearMonth)` → 제외.
  5. **기록됨 판정**: 이번 달 지출 중 `normalizeItemName(expense.itemName) === normalizeItemName(template.itemName)` 이고 `expenseType`이 `"expense"`(필드 없으면 expense로 간주 — `recent-items.ts:107-109` 관례)인 행이 하나라도 있으면 기록됨. **오프라인 대기 행(`pendingRows`, `syncState !== "synced"`)도 같은 자격으로 센다** — `record_gap` P1-3이 세운 정직성 규칙(`generators.ts:322-340`)과 같다. 서버가 아직 모르는 기록을 "없다"고 말하지 않는다.
  6. 남은 것이 0건이면 `null`(0을 0이라고 말하려고 카드를 세우지 않는다 — `home-section-priority.ts:134`).
- `recurringReminderCopy(rows)` — 제목 `이번 달 정기 지출 N건이 아직 기록에 없어요`, 행 부제 `기저귀 · 38,500원 · 매월 5일`. 해요체(DNC-018). **"자동으로 기록했어요" 계열 문구 금지.**
- `recurringPrefillParams(template)` — §1.4의 파라미터로 직렬화.
- `applyRecurringSkip(template, yearMonth)` / `sanitizeTemplates(unknown)` — 저장 blob 방어(`notification-preferences.store.ts:149-162` 관례).

### 1.4 원탭 프리필 (계약 확장)

현재 `/expenses/new`가 받는 파라미터: `itemName · itemTemplateId · amountKrw · categoryId · from · merchant · linkedProductLinkId` (`app/expenses/new.tsx:347-356`). 파싱은 `parseExpensePrefillParams`(`record-row-actions.ts:286-297`)가 `itemName/amountKrw/categoryId`만 본다.

- **추가할 것 하나**: `paymentMethod`. 화면에는 이미 세그먼트 컨트롤이 있다(`new.tsx:110-115` 목록, `:471` `paymentMethodIndex` 기본 0=카드, `:796` 저장 payload). 파싱은 `parseExpensePrefillParams`를 확장해 `"card"|"cash"|"transfer"|"mobile_pay"` 화이트리스트만 통과시키고, 모르는 값은 **조용히 버린다**(그 함수 `:281-285` 주석의 규율 그대로 — 링크로 들어온 값 때문에 저장 가드에 걸려 막히는 화면을 만들지 않는다).
- `merchant`는 이미 계약에 있으므로 그대로 재사용.
- **날짜는 넘기지 않는다** — `record-row-actions.ts:226-228`이 이미 못박은 규칙(새 기록은 오늘). "매월 5일" 템플릿을 5일 지난 뒤 기록해도 오늘 날짜로 들어간다. 이것이 정직하다(사용자가 실제로 확인한 시점).
- `from=recurring`을 실어 저장 후 목적지를 `resolvePostSaveDestination`(`src/expenses/post-save-destination.ts`)이 정하게 한다 — 모르는 값은 기록 탭 폴백이라 하위호환.

### 1.5 배치 결정 — 홈 카드 한 자리

**결정: 홈 카드만. 기록 탭에는 추가하지 않는다.**

- 기록 탭 헤더(`app/(tabs)/records.tsx:1386-1420` `listHeader`)에는 이미 빠른 기록 버튼 · 확정 토스트 · 대기/실패/충돌 배지 · 아이 이름 줄 · 월 이동 · 요약 · 검색 · 필터 칩이 서 있다. 게다가 `record_gap` 알림의 딥링크 목적지가 기록 탭이다(`src/notifications/notification-route.ts:43`). 여기에 리마인더를 하나 더 세우면 같은 사람이 같은 화면에서 두 번 재촉당한다.
- 홈은 이미 "카드 다이어트" 순위표를 갖고 있고(`src/home/home-section-priority.ts:45-62`, 상한 `HOME_VISIBLE_SECTION_LIMIT=2`, 나머지는 "카드 N개 더 보기"로 접힘), 활성 목록 조립부는 `app/(tabs)/index.tsx:1530-1543`이다.
- **순위 제안**: `"recurring-reminder": 3`으로 삽입하고 기존 `milestone`→4, `weekly-summary`→5, `budget-nudge`→6, `last-month`→7, `cumulative-total`→8로 밀어낸다. 근거: 예산 경고(1)는 되돌릴 수 없는 사실, 첫 실행 안내(2)는 루프 1단계이고, 정기 지출 미기록은 **지금 행동하지 않으면 이번 달 합계가 실제와 어긋나는** 사실이라 마일스톤(날짜 안내)보다 금전적 결과가 크다.
- 관리 화면 입구는 **카드 안의 "정기 지출 관리" 텍스트 버튼 + 설정 화면 행** 둘뿐. 더보기 탭(`src/settings/more-menu.ts:97-114`)은 7행 고정이 SET-001 compact 기준의 근거로 명시돼 있으므로(그 파일 `:19-20`) **건드리지 않는다**.

### 1.6 PRIV-104 합류 — 필요하다

`src/offline/session-teardown.ts:227-257`의 `teardownOfflineSessionState`는 계정 정체성 변경(`isSessionIdentityChange`, `:52-54`)에서 사용자 단위 로컬 상태를 전부 지운다: 쿼리 캐시 → 푸시 기기 해제 → `purchase-followup`·`notifications`·`home-first-run-guide`·`first-record-celebration` reset → SQLite wipe → 커서 → 스냅샷 갱신.

- **반복 템플릿은 합류한다.** 담기는 값(품목명·금액·분류·판매처)이 명백한 계정 데이터이고, `first-run-guide`가 "아이 id로 키가 잡힌 사용자 단위 상태"라는 이유로 합류한 선례(`:240-247`)와 정확히 같다.
- 대조군: `notification-preferences`는 **일부러 합류하지 않는다**(`notification-preferences.store.ts:26-30` — "이 기기에서 어떤 알림을 보고 싶은가"라는 기기 단위 선택). 반복 템플릿은 그 범주가 아니다.
- 합류 지점: `useRecurringExpenseStore.getState().resetAll()`을 기존 reset 4줄 옆에 추가(동기 set이라 await 없음).

### 1.7 수용 기준 (#4)

1. 어떤 경로로도 **자동으로 지출이 만들어지지 않는다**. 템플릿 저장·리마인더 평가·"이미 기록했어요" 어디에서도 `createExpense`/`enqueueExpense`를 호출하지 않는다(소스 계약 테스트로 고정).
2. 템플릿 CRUD(추가·수정·삭제·활성 토글)가 앱 재시작 후 유지된다. 상한 20건, 초과 시 저장 대신 안내.
3. 이번 달 지출 캐시가 아직 없으면 카드가 **렌더되지 않는다**(틀린 N을 말하지 않는다).
4. 오프라인 대기 행으로 이번 달에 적어 둔 정기 지출은 "미기록"으로 세지 않는다.
5. "기록하기" → `/expenses/new`가 품목명·금액·분류·결제수단(·판매처)로 열리고, 날짜는 오늘이다. 저장하면 카드의 N이 1 줄어든다(같은 `["expenses", childId, 이번달]` 캐시 무효화 경로).
6. "이미 기록했어요" → 이번 달만 목록에서 빠지고, 다음 달 due date가 지나면 다시 나타난다. 지출은 생기지 않는다.
7. 홈 카드가 순위표를 지킨다: 예산 경고 + 첫 실행 안내가 동시에 떠 있으면 정기 지출 카드는 "더 보기" 뒤로 접힌다.
8. 로그아웃/계정 전환 후 템플릿이 남아 있지 않다.
9. 비세션(픽셀락 SPL-001/HOME-001) 경로에서는 카드가 존재하지 않는다.
10. 월말 클램프: `dayOfMonth=31` 템플릿이 2·4·6·9·11월에 그 달의 마지막 날로 due 처리된다(윤년 포함).

### 1.8 서버 테이블 초안 (000021 — 라운드 55 실행 범위 아님)

DNC-007은 **추가만** 허용한다(마이그레이션 최신은 `apps/api/prisma/migrations/000020_product_link_price_checked_at`). 기존 테이블·컬럼·의미는 손대지 않는다.

```sql
-- 000021_recurring_expense_templates  (초안)
CREATE TABLE IF NOT EXISTS recurring_expense_templates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id       uuid NOT NULL REFERENCES households(id),
  child_id           uuid NOT NULL REFERENCES children(id),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  category_id        uuid NOT NULL REFERENCES categories(id),
  item_name          varchar(120) NOT NULL,
  amount_krw         integer NOT NULL CHECK (amount_krw > 0),
  payment_method     payment_method NOT NULL DEFAULT 'unknown',
  merchant           varchar(120),
  recurrence_kind    text NOT NULL DEFAULT 'monthly',   -- v1은 'monthly'만
  day_of_month       smallint NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  active             boolean NOT NULL DEFAULT true,
  deleted_at         timestamptz(6),
  created_at         timestamptz(6) NOT NULL DEFAULT date_trunc('milliseconds', now()),
  updated_at         timestamptz(6) NOT NULL DEFAULT date_trunc('milliseconds', now())
);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_child
  ON recurring_expense_templates (child_id) WHERE deleted_at IS NULL;
```

주의 3가지:
- 시각 컬럼 기본값에 `date_trunc('milliseconds', ...)`를 쓴다 — known-limitations **F절 R24-L4**(커서가 밀리초 정밀도를 전제)와 같은 함정을 처음부터 피하기 위해서다.
- `expenses.expense_type`/`source` enum을 건드리지 않는다. 템플릿에서 만들어진 지출도 `source = manual`이다(사용자가 확인해서 저장했으므로 사실이다).
- 이 테이블은 **어떤 워커·잡도 이 테이블을 읽어 지출을 만들지 않는다.** 서버 자동 생성은 DNC-013의 "자동 환불 금지"와 같은 성격의 금지 사항이며 별도 PM 승인 대상이다.

---

## 2. #9 앱 잠금 (PIN)

### 2.1 현재 코드 사실 — 부팅 게이트 순서

```
app/_layout.tsx:52-69   RootLayout
  └ QueryClientProvider (:54)
      └ ErrorBoundary (:59)
          ├ <OfflineSyncLifecycle/>   (:60)  아웃박스 flush 배선
          ├ <Stack headerShown:false> (:61)  ← 모든 라우트
          └ <PurchaseFollowupLifecycle/> (:65)  Stack 뒤 = 위에 그린다
```

- 라우트 판정은 전부 `app/index.tsx`에 있다: persist 4벌 rehydrate 대기(`:70-77 storesHydrated`, 3초 밸브 `:146`), 진행도 조회 대기(두 번째 3초 밸브 `:228-234`), 픽셀락 최우선 분기(`:311-313`), 로그아웃 분기(`:320-328`), 최종 리다이렉트(`:400`).
- 홀딩 뷰: `ColdStartHoldView`(`app/index.tsx:39-55`, `testID="screen-cold-start-hold"`) + 판정 단일 소스 `src/onboarding/cold-start-hold.ts:82-89 coldStartHoldReason`(픽셀락 → hydration → 로그아웃 → 아이 복구 → 진행도).
- 탭 게이트: `app/(tabs)/_layout.tsx:41-57` — 픽셀락이면 통과, 세션 없으면 `/launch-animation`, 온보딩 미완이면 `/`.
- AppState 단일 소스: `src/offline/connectivity.ts:47-63 subscribeAppStateChange` — 네이티브 리스너가 하나만 등록되도록 이미 정리돼 있다(FIX-118A). **새 `AppState.addEventListener`를 추가하면 안 된다.**

### 2.2 SecureStore 가용성

- `apps/mobile/package.json` dependencies에 `"expo-secure-store": "~14.0.1"` **존재**. 새 의존성 0 원칙 충족.
- 안전한 로드 관례가 이미 있다: `src/stores/secure-session-storage.ts:16-36` — 정적 import 금지(네이티브 모듈 미등록 환경에서 모듈 평가 시점에 throw), 동적 `import("expo-secure-store").catch(() => null)` + 인메모리 Map 폴백. 이 파일을 그대로 본뜬다.
- 키 이름 제약: 영숫자/`.`/`-`/`_`만(같은 파일 `:10-11`).
- 해시·난수: `src/auth/sha256.ts`(순수 JS SHA-256, `node:crypto` 벡터로 검증됨), `src/auth/pkce.ts:14 toBase64Url`, `:38 getRandomBytes`. **expo-crypto는 워크스페이스 스토어에 없다**(그 파일 헤더가 명시) — 그래서 이 두 모듈이 존재한다.

### 2.3 저장 형태 — SecureStore 단일 키 (persist 미들웨어 사용 안 함)

**결정: 잠금 상태 전량을 SecureStore 한 키에 둔다. zustand `persist`(AsyncStorage)를 쓰지 않는다.**

이유: AsyncStorage가 읽히지 않는데 SecureStore는 읽히는 상황이 실제로 가능하다 — `secureSessionStorage.getItem`(`:126-136`)은 AsyncStorage가 `null`을 주면 **SecureStore의 토큰만으로 세션 봉투를 합성한다**. 잠금 플래그를 AsyncStorage에 두면 그 조합에서 "세션은 살아 있는데 잠금은 꺼진 것으로 읽히는" 구멍이 생긴다. 두 값을 같은 저장소에 두면 그 구멍이 원천적으로 없다(둘 다 못 읽으면 세션도 없다 → 잠글 대상도 없다).

```ts
// src/security/app-lock-storage.ts  — SecureStore 키 "wooriai-app-lock"
type AppLockRecord = {
  version: 1;
  enabled: boolean;
  salt: string;        // base64url, getRandomBytes(16)
  hash: string;        // base64url(sha256(`${salt}:${pin}`))
  failedCount: number;
  lockedUntilMs: number | null;
};
```
- 읽기/쓰기/삭제는 `secure-session-storage.ts`와 동일한 3함수 구조(모듈 로드 실패·throw 시 인메모리 폴백).
- zustand 스토어(`src/stores/app-lock.store.ts`)는 **persist 없이** 런타임 상태(`status`, `record`, `unlockedAtMs`, `backgroundedAtMs`)만 들고, 부팅 시 1회 `load()`로 SecureStore를 읽는다.

### 2.4 게이트 설계 — 라우트가 아니라 오버레이

**결정: `app/lock.tsx` 라우트를 만들지 않는다. `src/security/AppLockOverlay.tsx`를 `app/_layout.tsx`의 `<Stack>` **뒤**, `PurchaseFollowupLifecycle` **뒤**(= 가장 위)에 마운트한다.**

- 라우트로 만들면 뒤로가기·딥링크·`router.replace`로 우회 가능한 상태가 생긴다. 오버레이는 내비게이션 상태를 바꾸지 않으므로 우회 경로가 없다.
- `PurchaseFollowupLifecycle`(`_layout.tsx:65`)이 계정 데이터(품목명)를 담은 카드를 전역 오버레이로 그리므로, 잠금 오버레이는 **그 뒤에** 와야 위에 덮인다.
- 오버레이는 불투명 전체 화면이어야 하고, Android 하드웨어 뒤로가기를 `BackHandler`로 삼켜야 한다.

게이트 상태 판정은 홀딩 뷰 선례대로 **순수 함수 값**으로 고정한다(`cold-start-hold.ts`가 만든 관례 — 화면이 리터럴을 세 자리에 흩뿌리면 판정표가 두 벌이 된다는 라운드 52 QA P3-4의 교훈).

```ts
// src/security/app-lock.ts
export type AppLockGateStatus = "inactive" | "loading" | "locked" | "recovery" | "unlocked";
export function resolveAppLockGateStatus(input: {
  pixelLockMode: boolean;      // EXPO_PUBLIC_PIXEL_LOCK === "1"
  hasSession: boolean;         // accessToken || isTestSession
  recordStatus: "unknown" | "loaded" | "unreadable";
  enabled: boolean;
  unlockedThisForeground: boolean;
}): AppLockGateStatus;
```
판정 순서(= `coldStartHoldReason`의 순서 규율):
1. `pixelLockMode` → `inactive` (SPL-001·HOME-001·EXP-001… 캡처 경로 불변)
2. `!hasSession` → `inactive` (로그인/스플래시 화면은 잠그지 않는다. 픽셀락도 세션을 지운다 — `app/pixel-lock.tsx:58-60`)
3. `recordStatus === "unknown"` → `loading` (홀딩 문구 재사용)
4. `recordStatus === "unreadable"` → `recovery` (§2.6)
5. `!enabled` → `inactive`
6. `unlockedThisForeground` → `unlocked`
7. → `locked`

### 2.5 3초 밸브 · 콜드 스타트 홀딩 뷰와의 충돌

- 저장소의 밸브 상수는 **3초 두 곳 + 1곳**이다: `app/index.tsx:146`, `:232`, `src/notifications/useHomeNotificationEvaluation.ts:75 NOTIFICATION_HYDRATION_VALVE_MS = 3000`("같은 실패 모드를 다루는 자리가 서로 다른 상한을 갖지 않게"). 잠금 게이트도 **같은 3000ms**를 쓴다.
- **밸브 방향이 다르다는 점이 중요하다.** 기존 밸브는 "모르면 진행"(열림)이다. 잠금에서 그대로 열면 잠금 우회다. 그래서 잠금 밸브는 `unknown` → **`recovery`**로 닫는다. 브릭이 되지 않는 이유는 recovery 화면에 로그아웃 탈출구가 있기 때문이다(§2.6).
- 충돌 없음 근거: 잠금 오버레이는 `_layout`에, 홀딩 뷰는 `app/index.tsx` 라우트 안에 있다. 콜드 스타트에 둘 다 걸리면 오버레이가 위를 덮고 홀딩 뷰가 아래에서 진행된다 — 사용자는 잠금 화면만 본다. 문구가 겹치지 않도록 `loading` 상태의 오버레이는 `COLD_START_HOLD_TITLE`("불러오고 있어요")을 그대로 재사용한다(`cold-start-hold.ts:45`).

### 2.6 PIN 분실 · 실패 지연 · 백그라운드 복귀

- **실패 지연**: `APP_LOCK_MAX_ATTEMPTS = 5`. 5회 연속 실패마다 `lockedUntilMs`를 세운다(30초 → 60초 → 300초 상한). 카운터·해제 시각은 SecureStore에 저장하므로 **앱을 죽였다 켜도 유지**된다(메모리 카운터는 강제 종료로 우회된다).
- **PIN 분실 경로**: 오버레이 하단 텍스트 버튼 "PIN을 잊으셨나요?" → 확인 다이얼로그 → `clearSession()` → `/launch-animation`. 정직 고지 2줄이 필요하다:
  1. "기록은 서버에 있어서 다시 로그인하면 그대로 볼 수 있어요."
  2. **"아직 서버에 올라가지 않은 기록은 로그아웃할 때 사라져요."** — 근거: `clearSession("logout")`은 `userId`를 null로 만들고(`session.store.ts:336-350`), 그 전이가 PRIV-104 teardown을 발화시켜 `mutation_outbox`를 통째로 wipe한다(`session-teardown.ts:38-42`). 이 사실을 감추면 허위 안내다.
- **잠금은 계정 보호가 아니다.** 로그아웃 탈출구가 있으므로 PIN을 모르는 사람도 앱을 초기 상태로 되돌릴 수 있다. 다만 그 사람은 계정에 로그인할 수 없으므로 데이터는 보이지 않는다. 이 잠금이 막는 것은 "잠깐 빌려준 폰에서 곁눈질" 뿐이며, 설정 화면 문구가 이보다 크게 말하면 안 된다.
- **백그라운드 복귀**: `subscribeAppStateChange`(`connectivity.ts:47`)에 리스너 하나를 더 얹는다(새 네이티브 구독 금지). `active`가 아닌 상태로 갈 때 `backgroundedAtMs` 기록, `active` 복귀 시 `nowMs - backgroundedAtMs >= APP_LOCK_GRACE_MS`면 잠근다.
- **유예(grace) 값 = 60초**. 0으로 두면 안 되는 이유가 실제로 셋 있다: 엑셀 가져오기의 `expo-document-picker` 파일 선택, CSV 내보내기의 공유 시트, 카카오 로그인의 외부 브라우저. 셋 다 앱을 백그라운드로 보낸다. 60초를 넘기는 파일 선택은 여전히 재잠금되며, 그 경우의 신뢰 플로 억제 API는 후속(§4 위험).

### 2.7 픽셀 캡처 · 테스트 로그인 흐름과의 충돌

| 경로 | 사실 | 판정 |
|---|---|---|
| 픽셀락 캡처(SPL-001 등) | `app/pixel-lock.tsx:44-63`이 진입 시 `clearSession()`·`clearSelectedChildId()`·`resetOnboarding()`을 부르고 라우트로 replace. `EXPO_PUBLIC_PIXEL_LOCK==="1"` | 세션이 없으므로 게이트 2번 규칙에서 이미 `inactive`. 1번 규칙(픽셀락 우선)은 **이중 안전장치**다. SET-001은 `/(tabs)/more`의 비로그인 미리보기라 역시 무영향 |
| 데모(테스트) 세션 | `session.store.ts:287-312 startTestSession` — `isTestSession: true`, 실토큰 없음. 로그인 화면 `app/(auth)/login.tsx:186` | `hasSession = accessToken || isTestSession` 이므로 **데모도 잠긴다**. 일관성 우선(잠금은 기기 단위 선택). 데모↔실계정 전환은 `isSessionIdentityChange`가 true(`session-teardown.ts:53`)라 PIN이 지워지므로 잠금 상태로 갇히지 않는다 |
| PIN 미설정 사용자 | `enabled=false` | 오버레이를 **렌더하지 않는다**. 기존 화면 트리 한 픽셀도 불변 |
| `test-login-flow.test.ts` / `ui-pixel-lock-flow.test.ts` | 소스 grep 계약 | 오버레이가 `_layout.tsx`에만 추가되고 로그인/픽셀락 화면 소스는 무변경이므로 기존 단언에 영향 없음(회귀 확인 대상) |

### 2.8 PRIV-104 합류 — 필요하다 (브릭 방지)

PIN이 정체성 변경에서 지워지지 않으면: A 로그아웃 → B 로그인 → B가 A의 PIN 화면에 갇힌다 → 탈출구는 로그아웃뿐 → 로그인 → 다시 잠김. **무한 루프 = 브릭**. 따라서 `teardownOfflineSessionState`에 `clearAppLockRecord()`(SecureStore 키 삭제)를 합류시킨다. `clearSession("expired")`는 정체성을 유지하므로(`session.store.ts:338-339`) 만료로 끝난 세션은 PIN을 잃지 않는다 — 옳다(같은 사람이다).

### 2.9 수용 기준 (#9)

1. `apps/mobile/package.json`이 **한 줄도 바뀌지 않는다**(새 의존성 0). `expo-local-authentication`·`expo-crypto`가 코드 어디에도 등장하지 않는다.
2. PIN 미설정 상태에서 앱 동작·화면 트리가 불변.
3. 콜드 스타트에 세션 + 잠금 켜짐 → 어떤 탭·카드·금액도 보이기 전에 오버레이가 덮는다.
4. 백그라운드 60초 이상 후 복귀 → 잠김. 60초 미만(공유 시트·파일 피커 왕복) → 잠기지 않음.
5. 5회 실패 → 30초 대기 + 남은 초 표시. 앱 강제 종료 후 재실행해도 대기가 유지된다.
6. 픽셀락 모드/비세션에서는 오버레이가 존재하지 않는다.
7. PIN 분실 → 로그아웃 경로가 있고, **미동기화 기록 소실을 사전 고지**한다.
8. 계정 전환/로그아웃 시 PIN이 지워진다. 만료(`expired`)로는 지워지지 않는다.
9. Android 하드웨어 뒤로가기가 오버레이를 통과하지 못한다.
10. 생체 인증은 화면 어디에도 언급되지 않는다(없는 기능을 광고하지 않는다 — 푸시 토글이 `expo-notifications` 부재를 정직하게 밝히는 관례와 같다).
11. 설정 화면 문구가 "완전한 보호"를 주장하지 않는다.

---

## 3. 트랙 분할 (파일 무충돌)

머지 순서: **A · B 병렬 → C 마지막**. C는 선택 사항이 아니다 — A·B만 머지하면 계정 전환 시 템플릿 잔존(§1.6)과 새 사용자 잠금 브릭(§2.8)이 남는다.

### 트랙 A — 반복 지출 코어 (신규 파일 위주)
| 파일 | 신규/수정 |
|---|---|
| `apps/mobile/src/expenses/recurring-template.ts` | 신규(순수 판정·문구·클램프) |
| `apps/mobile/src/expenses/recurring-template.test.ts` | 신규 |
| `apps/mobile/src/stores/recurring-expense.store.ts` | 신규(persist) |
| `apps/mobile/src/stores/recurring-expense.store.test.ts` | 신규 |
| `apps/mobile/app/expenses/recurring.tsx` | 신규(관리 화면, `testID="screen-recurring-expenses"`) |
| `apps/mobile/src/expenses/record-row-actions.ts` | 수정(`paymentMethod` 프리필 계약 추가) |
| `apps/mobile/src/expenses/record-row-actions.test.ts` | 수정(왕복 케이스) |
| `apps/mobile/app/expenses/new.tsx` | 수정(프리필 → `paymentMethodIndex` 배선) |
| `apps/mobile/src/expenses/recurring-flow.test.ts` | 신규(소스 grep 계약) |

### 트랙 B — 앱 잠금 PIN (신규 파일 위주)
| 파일 | 신규/수정 |
|---|---|
| `apps/mobile/src/security/app-lock.ts` | 신규(순수: 해시·검증·실패 지연·grace·게이트 상태표·문구) |
| `apps/mobile/src/security/app-lock.test.ts` | 신규 |
| `apps/mobile/src/security/app-lock-storage.ts` | 신규(SecureStore 어댑터 + 메모리 폴백) |
| `apps/mobile/src/security/app-lock-storage.test.ts` | 신규 |
| `apps/mobile/src/security/AppLockOverlay.tsx` | 신규(전체 화면 오버레이 + BackHandler) |
| `apps/mobile/src/stores/app-lock.store.ts` | 신규(persist 없음) |
| `apps/mobile/app/settings/app-lock.tsx` | 신규(설정/변경/해제, `testID="screen-app-lock"`) |
| `apps/mobile/app/_layout.tsx` | 수정(오버레이 마운트 1줄) |
| `apps/mobile/src/security/app-lock-gate-contract.test.ts` | 신규(소스 grep: 마운트 위치·AppState 단일 구독·의존성 불변) |

### 트랙 C — 진입점 · 홈 합류 · teardown (A·B 이후)
| 파일 | 신규/수정 |
|---|---|
| `apps/mobile/src/home/home-section-priority.ts` | 수정(`"recurring-reminder"` 순위 3 삽입, 이하 재번호) |
| `apps/mobile/src/home/home-section-priority.test.ts` | 수정 |
| `apps/mobile/app/(tabs)/index.tsx` | 수정(활성 목록 합류 + 카드 렌더) |
| `apps/mobile/app/settings/index.tsx` | 수정(SET-002에 "정기 지출" · "앱 잠금" 2행 추가) |
| `apps/mobile/src/offline/session-teardown.ts` | 수정(reset 2줄: 반복 템플릿 · 앱 잠금) |
| `apps/mobile/src/offline/session-teardown.test.ts` | 수정 |
| `apps/mobile/src/settings-flow.test.ts` | 수정(설정 행 계약) |

**충돌 확인**: A는 `app/expenses/*`·`src/expenses/*`·`src/stores/recurring-*`, B는 `src/security/*`·`src/stores/app-lock*`·`app/settings/app-lock.tsx`·`app/_layout.tsx`, C는 `src/home/*`·`app/(tabs)/index.tsx`·`app/settings/index.tsx`·`src/offline/session-teardown.ts`. **교집합 0.** `app/(tabs)/records.tsx`는 세 트랙 모두 손대지 않는다(§1.5 결정).

---

## 4. 테스트 계획

이 저장소의 vitest는 react-native 컴포넌트를 렌더할 수 없다(`src/loading-skeleton-contract.test.ts:8-9`, `src/screen-header-back.test.ts:15-16`). 따라서 **순수 모듈 단위 테스트 + 화면은 소스 grep 계약**이라는 기존 두 갈래를 그대로 따른다.

### 단위(순수)
- `recurring-template.test.ts`: 월말 클램프(1/31·2/28·2/29 윤년·4/30), due 전/후, skip 왕복, 이름 정규화 매칭(공백·대소문자), gift/refund 제외, 오프라인 대기 행 포함, `monthExpenses === undefined` → null, 0건 → null, 상한 20, 손상 blob sanitize.
- `recurring-expense.store.test.ts`: 저장 키·storage·version 소스 단언(`notification-preferences.store.test.ts:154-155` 관례), 재수화 후 유지, resetAll.
- `app-lock.test.ts`: 해시 왕복·오답·형식(4자리 숫자만)·솔트가 매번 다름, 실패 5회 → 30초, 10회 → 60초, 상한 300초, `lockedUntilMs` 만료, **시계 되돌림 방어**(과거로 간 now에서 잠금이 풀리지 않음), grace 판정 경계(59초/60초/61초), `resolveAppLockGateStatus` 7분기 전수표.
- `app-lock-storage.test.ts`: 메모리 폴백 왕복, 손상 JSON → null, 삭제, 키 이름 문자 제약.

### 소스 계약(grep)
- `recurring-flow.test.ts`: 관리 화면·홈 카드 어디에도 `createExpense`/`enqueue` 문자열이 없다 / 프리필 파라미터 이름이 `new.tsx` 파싱과 일치 / `normalizeItemName`을 재사용하고 자체 정규화를 재구현하지 않는다.
- `app-lock-gate-contract.test.ts`: `_layout.tsx`에서 오버레이가 `<Stack`·`PurchaseFollowupLifecycle` **뒤**에 온다 / `AppState.addEventListener`를 직접 부르지 않고 `subscribeAppStateChange`를 쓴다 / `package.json` 의존성 목록 스냅숏 불변 / `expo-local-authentication`·`expo-crypto` 미등장 / 밸브 상수가 3000.
- `session-teardown.test.ts`: 두 reset이 호출된다 / `expired`에서는 호출되지 않는다.
- `settings-flow.test.ts`: SET-002에 2행 추가, 더보기 세션 메뉴 7행 불변(`more-menu.test.ts` 무변경 확인).
- `a11y-contract.test.ts`: 신규 `.tsx` 2개가 전역 스윕(`listComponentSources()`, `:190-197`)을 통과 — 리터럴 screen ID를 `accessibilityLabel`에 넣지 않는다. 설정 스윕(`:343-356`)의 저대비 코랄 텍스트 금지도 신규 설정 화면에 적용된다(`color: theme.colors.coral[700]`만 허용).

### 실행
```
pnpm --filter mobile test         # 이 라운드의 주 게이트(전부 mobile)
pnpm release:gate                 # 머지 전 1회 (GitHub Actions 대신 로컬이 기준)
```
api/admin은 이 라운드에서 손대지 않으므로 실 PostgreSQL 기동은 릴리즈 게이트 때만 필요하다.

---

## 5. DNC · A11Y 체크리스트

### DNC
| ID | 확인 항목 | 이 설계의 답 |
|---|---|---|
| DNC-002 | 핵심 루프 유지 | 리마인더 → 원탭 프리필 → 사용자 확인 저장은 루프 1단계를 **강화**한다. 잠금은 루프 앞의 게이트일 뿐 단계를 늘리지 않는다 |
| DNC-003 | 하단 탭 4개 | 변경 없음(관리 화면은 스택, 잠금은 오버레이) |
| DNC-004 | 화면 ID | 새 잠금 ID를 만들지 않는다. 신규 화면 testID는 `screen-recurring-expenses` / `screen-app-lock` — `screen-notifications`·`screen-cold-start-hold` 선례를 따르는 서술형이며 잠긴 ID 네임스페이스(SPL/AUTH/ONB/HOME/EXP/ITEM/REP/FAM/IMP/SET/ADM)를 침범하지 않는다 |
| DNC-005 | 스택 고정 | zustand + expo-secure-store(기존) 그대로. 새 패키지 0 |
| DNC-006 | API base | 서버 호출 추가 없음(로컬 전용). 000021은 초안만 |
| DNC-007 | 데이터 모델 | 삭제·의미 변경 없음. 000021은 **테이블 추가만** |
| DNC-012 | 미리보기 전 저장 금지 | 같은 정신: 템플릿은 **미리보기(리마인더) 후 사용자 승인(저장)** 구조다 |
| **DNC-013** | 자동 기록 금지 | **최우선 계약.** 어떤 경로로도 지출이 자동 생성되지 않는다(수용 기준 #1, 소스 계약 테스트) |
| DNC-014 | soft delete | 템플릿 삭제는 지출이 아니므로 해당 없음. 지출 삭제 경로 무변경 |
| DNC-015 | 선물 제외 | 기록됨 판정에서 `gift`/`refund` 행을 제외(`recent-items.ts` 규칙 재사용) |
| DNC-018 | 해요체·쉬운 문장 | 모든 신규 문구 해요체. 책망·불안 문구 금지(`generators.ts:371-377`의 record_gap 톤 규율을 그대로 적용) |
| DNC-019 | 시크릿 하드코딩 금지 | PIN은 사용자 입력이며 솔트+해시만 SecureStore에 저장. 평문·기본 PIN 없음 |
| DNC-009/010/011/016/020 | 해당 없음 | 추천·제휴·스폰서·의료 표면을 건드리지 않는다 |

### A11Y (A11Y-101/117 관례)
- 리마인더 카드 각 행: 바깥 `Pressable` 하나가 접근성 요소(`accessibilityRole="button"`, 한국어 라벨 `"정기 지출 기저귀 38,500원 기록하기"`), 안쪽 장식은 `accessibilityElementsHidden`.
- "이미 기록했어요"는 별도 `accessibilityRole="button"`. 롱프레스 전용 동작을 만들지 않는다(발견 불가 제스처 금지 — `record-row-actions.ts:9-12`).
- 카드는 `alert`가 아니다(일시적 알림이 아니므로). `accessibilityRole="alert"`+`accessibilityLiveRegion`은 홈의 예산 경고 배너 전용(`a11y-contract.test.ts:208-212`).
- PIN 입력: `secureTextEntry`, `keyboardType="number-pad"`, `maxLength=4`, `accessibilityLabel="PIN 4자리"`. 실패/대기 안내는 `accessibilityLiveRegion="polite"`.
- 오버레이 `loading` 상태는 스켈레톤을 접근성 트리에서 감추고 텍스트만 읽히게(`app/index.tsx:48-51` 관례).
- 신규 화면 두 곳은 `ScreenHeader`에 `onBack`을 배선한다(스택 도달 화면 계약 — `screen-header-back.test.ts`).
- 코랄 텍스트는 `theme.colors.coral[700]`만 사용(그 외는 크림/코랄 서피스에서 AA 미달).

---

## 6. 위험 · 비범위

### 위험(수용하고 문서화할 것 — 완료 시 `docs/operations/known-limitations.md` B절 후보)
1. **4자리 PIN + 솔티드 SHA-256은 KDF가 아니다.** 후보가 1만 개뿐이라 기기가 루팅돼 SecureStore 블롭이 유출되면 즉시 역산된다. 이 잠금은 곁눈질 방어이지 암호학적 보호가 아니며, 문구가 이보다 크게 말하면 안 된다. (반복 횟수를 늘린 스트레칭은 순수 JS SHA-256에서 체감 지연을 만들므로 v1 비채택.)
2. **로컬 시계 조작으로 실패 대기(`lockedUntilMs`)를 넘길 수 있다.** 서버 시각이 없는 로컬 잠금의 일반 한계로 수용.
3. **60초 grace를 넘기는 파일 선택/공유는 재잠금된다.** 엑셀 가져오기 중간에 PIN을 다시 묻는 경험이 생길 수 있다. 신뢰 플로 억제 API(`beginTrustedExternalFlow`)는 후속.
4. **잠금 중에도 백그라운드 작업은 돈다**(아웃박스 flush, 알림 평가). 화면 노출은 없지만 `announceForA11y` 토스트가 잠금 화면 위에서 계정 문구를 읽어 줄 가능성이 있다 — 구현 시 오버레이가 떠 있는 동안 토스트 렌더를 억제할지 확인 대상.
5. **이름 기반 "기록됨" 판정은 오탐이 있다.** 사용자가 "기저귀"를 "기저귀 대형"으로 적으면 미기록으로 남는다. 그래서 "이미 기록했어요"(수동 넘기기)가 반드시 함께 있어야 하며, 카드 문구는 "안 보여요"(관측)이지 "기록하지 않았어요"(단언)가 아니다.
6. **홈 순위표 재번호**는 기존 테스트 값을 바꾼다. `home-section-priority.test.ts`가 값 계약을 잡고 있으므로 함께 갱신해야 하며, 순위 변경 자체가 사용자에게 보이는 변화(마일스톤 카드가 한 칸 뒤로)라는 점을 인지할 것.
7. **트랙 C 누락 시 결함이 남는다**(§3 머지 순서).

### 비범위 — 재제안 금지 확인 (`docs/operations/known-limitations.md` A~H절 · gap-analysis §제외 판정)
| 항목 | 근거 |
|---|---|
| 생체 인증(지문/얼굴) | `expo-local-authentication` = 새 의존성. **A절** 관례(자산·의존성 추가는 사용자 몫). gap-analysis §16도 "생체는 의존성=사용자 몫"으로 이미 판정 |
| 정기 지출을 **푸시**로 알리기 | **A절** "푸시 알림 (실 단말 수신 활성화)" — 코드는 완성됐고 자산 3종(expo-notifications·google-services.json·env)이 없어 전 경로 no-op. 인앱만 가능 |
| 서버가 정기 지출을 자동 생성 | DNC-013(자동 환불 금지와 같은 성격) + DNC-012. PM 승인 대상 |
| xlsx 내보내기 | 새 의존성. gap-analysis §18 |
| 사진/영수증 AI · 위젯 · 숏컷 | DNC-016 + `android/` 손패치 금지(CLAUDE.md) |
| 카테고리별 예산(#5) · 기간 자유 통계(#12) | 유니크 제약 교체/신규 엔드포인트 = PM·서버 선행. gap-analysis §12·§19 |
| 다크 모드 · 접근성 배율 | gap-analysis §22 제외 판정(P1 트랙 충돌 + DNC-017 대응표) |
| 수입(income) enum 확장 · 월 시작일 변경 | 의미 변경/경계 하드코딩 전면. gap-analysis §22 |
| 금액 부호 계층(환불 −38,500원) | **B절** — 합계 규칙(서버 `sumExpenses`)과 함께 정해야 하는 별도 티켓 |
| 홈 이번 달 전량 조회 최적화 | **H절** — 기간 합계 엔드포인트가 선행 |
| 지출 목록 커서 정밀도 | **F절** — 000021 초안이 `date_trunc('milliseconds')`를 쓰는 이유일 뿐, 이 라운드의 작업 항목이 아님 |
