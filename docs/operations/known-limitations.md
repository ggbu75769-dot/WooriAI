# 알려진 한계 (Known Limitations)

갱신: 2026-08-27 (라운드 24 리뷰 후속 · R24-L4/M3까지 반영) · 브랜치: claude/app-feature-review-design-xx71k3

라운드 5~20에서 해소된 항목은 근거 파일과 함께 "해소됨" 섹션으로 옮겼다. 남은 것은 (A) 외부 계정·키가 필요한 항목, (B) 위험도 낮은 후속 개선, (C) 런타임 재검증, (D) 라운드 13~15에서 확인된 설계 트레이드오프, (E) 라운드 16~18에서 새로 확인된 한계·계약, (F) 라운드 24에서 새로 확인된 한계다. 각 항목은 코드 상 근거 경로를 병기한다.

라운드 21은 아직 진행 중이라 별도 "해소됨" 절을 만들지 않았다 — 이 라운드에서 고친 것은 각 티켓 커밋과 해당 절의 본문에 반영하고, 라운드가 마감되면 라운드 19~20 절과 같은 형식으로 묶는다. 라운드 21 시점에 **아래 A~E 항목 중 해소된 것은 없었다**(A의 외부 자산 3종·B의 부호 계층/카테고리 노출 범위·D의 계약은 모두 그대로였다). 그 뒤 **B의 "카테고리 노출 범위"만 CAT-124에서 해소됐다**(서버 `categories.selectable` + `GET /categories?includeAll=1`, 마이그레이션 000018) — B절의 해당 항목 참고. A의 외부 자산 3종과 B의 부호 계층, D의 계약은 여전히 그대로다.

## 라운드 4에서 해소됨 (참고)

- ~~PostgreSQL 영속화~~ → 전 도메인 Prisma 전환 완료, 재시작 후 데이터 유지 검증.
- ~~refresh 토큰 무효화/회전 없음~~ → hash 저장·1회용 회전·재사용 시 family 전체 무효화·동시 사용 CAS 차단.
- ~~관리자 공용 토큰~~ → email/password + RBAC(admin/editor/analyst) + 감사 로그. 공용 토큰은 dev/test 전용.
- ~~AI 임포트 스텁·파일 피커 미구현~~ → expo-document-picker + multipart 업로드 + 서버 실 CSV/XLSX 파싱(CP949, formula injection 방어, 중복 후보 탐지).
- ~~Idempotency-Key 미처리~~ → 지출 생성·예산·import 승인에 적용.
- ~~감사 로그 인메모리 휘발~~ → audit_logs 테이블 영속화.
- ~~카테고리 리포트 전체 기간 고정~~ → 서버 기간 파라미터 지원.
- ~~토큰 평문 AsyncStorage~~ → SecureStore + 1회 마이그레이션. 콜드 스타트 세션 복원 결함도 수정.
- rate limit·security headers·body 제한·구조화 로깅·health/readiness 추가.

## 라운드 5~15에서 해소됨 (참고)

- ~~준비템 탭 기본 선택이 고정 "12-24개월"~~ → 아이 단계 연동 완료: `apps/mobile/src/items/stage-bands.ts`의 `resolveDefaultStageLabel`이 현재 아이 단계로 기본 밴드를 계산(`apps/mobile/app/(tabs)/items.tsx`에서 사용). "12-24개월" 고정은 픽셀락 모드·테스트 세션·단계 미확정 시 폴백으로만 남음(`apps/mobile/src/items/stage-bands.test.ts`).
- ~~아이 단계 계산 기본 '오늘'이 UTC (`packages/domain/src/stage.ts`) — KST 00~09시 하루 오차.~~ **해결(FIX-STAGE-UTC)**: 기본 '오늘'을 `getSeoulToday()`(Asia/Seoul) 기준으로 계산하며, 서울 자정 주차/개월 롤오버·월말 생일 경계 테스트로 고정.
- ~~지출 수정 화면에 날짜/카테고리 편집 UI 미노출~~ → `apps/mobile/app/expenses/[expenseId].tsx`에 카테고리 칩 행(서버 카테고리 목록 연동, CAT-101/UX-5B-EXP)과 날짜 편집(최근 날짜 칩 + 직접 입력, 미래 날짜·달력 유효성 검증) 노출.
- ~~idempotency_keys 만료 행 정리 스케줄러 미구현~~ → `apps/api/src/worker/jobs/idempotency-key-cleanup.job.ts` 워커 잡 구현(refresh 토큰·OAuth 트랜잭션 정리 잡과 동일한 `apps/api/src/worker/` 체계).
- ~~관리자 계정 관리 API 미구현~~ → `apps/api/src/admin/admin-users.controller.ts` 구현(계정 생성·역할 변경을 seed/DB 직접 조작 없이 API로 수행).
- ~~앱 정보 버전 하드코딩~~ → `apps/mobile/app/(tabs)/more.tsx`(UX-5B-7)에서 expo-constants의 `Constants.expoConfig.version`으로 실제 버전 표시.
- ~~대화형 알림/온보딩 이어하기 등 P1 항목~~ → 인앱 알림 센터 구현(NOTI-102, `apps/mobile/app/notifications.tsx` — 예산 80/100%·단계 전환·구매 대기·주간 요약 알림 + 읽음 처리·딥링크), 온보딩 이어하기 구현(`apps/mobile/app/(onboarding)/resume.tsx`).
- ~~applicationId `com.anonymous.wooriai`~~ → `apps/mobile/app.json`의 `android.package`가 `kr.wooriai.app`으로 변경됨.

## 라운드 16~18에서 해소됨 (참고)

- ~~`isValidCalendarDate` 로컬 복제~~ → **해결(MOB-121)**: 날짜 검증이 `@wooriai/domain` 단일 소스로 통일됐다. `apps/mobile/app/expenses/new.tsx:5`·`apps/mobile/app/expenses/[expenseId].tsx:5`가 `isValidCalendarDate`/`isFutureSeoulDate`를 도메인에서 import하고, 온보딩·아이 관리 폼은 `apps/mobile/src/children/child-form.ts:3`의 공유 모듈이 같은 도메인 함수를 감싼다(`apps/mobile/app/(onboarding)/child-profile.tsx`는 그 모듈만 사용). 서버(`apps/api/src/onboarding/store-shared.ts`, `apps/api/src/imports/import-parser.ts`)도 같은 함수를 쓴다. 배선은 `apps/mobile/src/child-profile-manual-stage-and-date-guard.test.ts`가 소스 검사로 고정.
- ~~FCM 클라이언트 절반 전면 부재~~ → **대부분 해결(PUSH-116)**: 모바일 쪽 코드는 다 있다 — 토큰 소스(`apps/mobile/src/notifications/push-token-source.ts`, 네이티브 FCM 디바이스 토큰 + 권한 처리 + 길이 상한), 부팅 시 등록 훅(`apps/mobile/src/notifications/usePushDeviceRegistration.ts` → `POST /me/devices`, `app/(tabs)/_layout.tsx`에서 마운트), 알림 설정 화면(`apps/mobile/app/settings/notifications.tsx` — 마스터 토글 + 기기별 on/off). 남은 것은 **코드가 아니라 자산 2개**(expo-notifications 의존성 설치 + Firebase `google-services.json`·env 플래그)뿐이라 A 섹션 "푸시 알림" 행으로 이관했다. 미설치 상태에서는 동적 `require` try/catch로 전 경로가 no-op이고 설정 화면은 토글을 비활성 + "앱 업데이트 후 사용할 수 있어요"로 정직하게 표시한다(허위 표시 금지).

## 라운드 19~20에서 해소됨 (참고)

- ~~인앱 알림 목록이 어느 아이의 알림인지 알려주지 않음 (다자녀)~~ → **해결(R19-D + R20-C)**: R19-D가 알림 dedupeKey와 엔트리에 `childId`를 넣어 "한 달에 아이 1명분만 알림이 뜨는" 스코프 결함을 없앴고(`apps/mobile/src/notifications/generators.ts`, `apps/mobile/src/notifications/notification.store.ts`), R20-C가 표시 쪽을 마무리했다. 알림 화면이 저장된 `childId`를 읽어 **가구에 아이가 2명 이상일 때만** 행 제목 앞에 태명을 붙인다(`다온이 · 이번 달 예산의 80%를 사용했어요`) — 같은 달에 겉보기가 같은 예산 알림 두 줄이 더는 생기지 않는다 (`apps/mobile/app/notifications.tsx`). 이름은 `["children"]` 쿼리 캐시에서 해석해 대개 추가 요청이 없고, 접두는 제목 텍스트의 일부라 행 접근성 라벨로도 함께 읽힌다. 표시/미표시 판정은 순수 함수로 분리했고(`apps/mobile/src/notifications/notification-child-label.ts`) 아이 1명·2명, `childId` 없는 구 알림, 이름 미해석(목록에 없는 childId·로딩 전·공백 태명) 경우를 단위 테스트로 고정했다(`notification-child-label.test.ts`) — 어느 경우든 빈 접두 대신 기존 그대로 표시한다.
- ~~도넛 차트 원호는 90° 고정 4쐐기 근사~~ → **해결(R20-A)**: 실데이터 경로는 도넛 대신 **값 비례 가로 스택 바**로 그린다. border-quadrant 기법으로는 임의 각도를 만들 수 없고(네 개의 90° 쐐기가 전부) SVG/conic-gradient 의존성 추가는 범위 밖이라, 비중을 정확히 표현하는 바가 각도가 거짓말하는 원보다 낫다는 판단. 비중 계산은 순수 모듈로 분리했다 — `apps/mobile/src/reports/category-share.ts`(0·음수·비유한 값 제외, 최대잉여법으로 정수 % 합계 정확히 100, 극소 조각은 최소 폭 2%로 보장하고 나머지를 재정규화, 반올림해서 0%가 되는 조각은 `<1%`로 표기), 테스트는 `apps/mobile/src/reports/category-share.test.ts`·`apps/mobile/src/design-foundation.test.ts`. 범례는 색 스와치+이름+금액+%를 유지하고 A11Y-117 관례대로 바는 장식(decorative), 범례 각 행이 한 요소로 읽힌다(`apps/mobile/src/ui.tsx` `DonutChartCard`). 비로그인 미리보기(픽셀락 캡처 기준 화면)만 기존 장식 원호를 그대로 둔다 — LineChartCard의 장식 라인과 같은 관례.

## A. 외부 계정·키·계약 (코드로 해결 불가)

| 항목 | 현재 상태 (근거) | 필요한 사용자 조치 |
|---|---|---|
| 실 소셜 로그인 | Kakao는 서버 검증 OIDC 플로(prepare/exchange, JWKS 서명·iss/aud/exp·nonce 검증)와 모바일 플로(AUTH-102)까지 구현 완료 — env 키(`OAUTH_KAKAO_*`, `EXPO_PUBLIC_KAKAO_*`)가 없으면 비활성 (`apps/api/src/auth/kakao/kakao-auth.service.ts`, `apps/mobile/src/auth/kakao-login.ts`). Apple/Google 검증 어댑터는 미구현(`apps/api/src/auth/`에 kakao 디렉터리만 존재). dev provider(`/auth/oauth-login`)는 dev/test 한정 (`apps/api/src/auth/auth.service.ts`) | Kakao 콘솔 키 발급 → env 설정. Apple/Google은 검증 어댑터 구현 + 콘솔 키 필요 |
| 운영 PostgreSQL | 로컬 docker/포터블로만 검증됨 (`scripts/db.ts`) | 운영 `DATABASE_URL` 주입 후 `prisma migrate deploy` |
| 릴리즈 서명 keystore | signingConfig 주입은 자동화됨 — config plugin(REL-011)이 `WOORIAI_UPLOAD_KEYSTORE` env 존재 시 release 서명, 부재 시 debug 서명으로 빌드 (`apps/mobile/plugins/with-wooriai-android-release.js`) | 업로드 keystore 발급 + `WOORIAI_UPLOAD_KEYSTORE` 등 env 주입 |
| 실 제휴 링크 | 시드는 비제휴 dev 샘플(`https://example.com/dev/...` 77곳, `apps/api/prisma/seed-data.ts` productLinkSeeds) | 제휴 계약 + 관리자 CMS(`apps/api/src/admin/product-link-bulk.controller.ts` 포함)에서 실 URL 등록 |
| 크래시·성능 모니터링 | 구조화 로그 + 모바일 자체 ErrorBoundary만 존재 (`apps/mobile/src/errors/ErrorBoundary.tsx` — "No crash pipeline yet (Sentry 추후)") — 외부 SDK 미연동 | Sentry 등 SDK 키 연동 |
| 푸시 알림 (실 단말 수신 활성화) | **서버·클라이언트 코드는 양쪽 다 구현 완료**: 서버는 FCM HTTP v1 발송·토큰 등록 API·예산 경계(80/100%) 디스패치 (`apps/api/src/push/`, `apps/api/src/devices/devices.controller.ts`), 모바일은 토큰 소스·부팅 등록 훅·알림 설정 화면 (PUSH-116, 위 "라운드 16~18에서 해소됨" 참고). 남은 것은 자산 3종뿐이다 — ① `expo-notifications` 의존성 미설치(`apps/mobile/package.json`에 부재 — 새 의존성 추가는 사용자 몫), ② Firebase `google-services.json` 부재(`apps/mobile/`에 없음, app.json에 `googleServicesFile` 미지정), ③ env(`PUSH_ENABLED=1` + `FCM_SERVICE_ACCOUNT_PATH`, `EXPO_PUBLIC_PUSH_ENABLED=1`). 셋 중 하나라도 없으면 서버는 no-op(`apps/api/src/push/push-config.service.ts`), 클라이언트는 토큰 `null` → 전 경로 무동작 | FCM(Firebase) 계정 + 서비스 계정 키 발급·env 주입 + `npx expo install expo-notifications` + `expo prebuild` (활성 절차 전문: `apps/mobile/src/notifications/push-token-source.ts` 모듈 주석) |
| 법적 운영자 정보 | 정책 문구에 실 사업자 정보 없음(코드베이스에 사업자 등록 정보 부재) | 실 사업자 정보로 교체 |

## B. 후속 개선 (위험도 낮음)

- **금액 표시에 부호 계층이 없음 — `refund`는 라벨로만 구분됨(REC-121/K1, 부분 해소)** (MOB-121 후속). `apps/mobile/src/money.ts`의 `formatKrw`는 항상 절대값을 찍고(음수·NaN도 부호 없이), 부호는 호출자의 표현 책임이다 — 그런데 MOB-121이 그 부호를 그리던 유일한 컴포넌트(D0 `MoneyText`, 미채택으로 판단)를 삭제해 부호를 그리는 화면이 하나도 남지 않았다. `refund`는 도메인·서버 계약상 유효한 `expenseType`(`packages/domain/src/enums.ts` `EXPENSE_TYPES`)이고 가져오기/API 경로로 생길 수 있다.
  - **REC-121에서 고친 것**: 기록 목록이 `gift`만 "선물 ·"로 구분하고 환불 행은 일반 지출과 **완전히 동일하게** 보이던 문제를 없앴다 — 행 부제를 순수 함수 `recordsRowSubtitle`(`apps/mobile/src/expenses/records-list-view.ts`)로 모아 `refund`에 "환불 ·" 접두를 붙인다(`apps/mobile/app/(tabs)/records.tsx` `ServerExpenseListRow`).
  - **REC-121b에서 해소된 것 — 기록 탭 월 합계의 환불 불일치**: REC-121이 곁가지로 발견해 "별도 티켓 대상"으로 남겼던 불일치를 없앴다. 서버 총액은 `expenseType === "expense"`만 합산해 선물과 환불을 **둘 다** 빼고 세는데(`apps/api/src/onboarding/expenses-store.service.ts` `sumExpenses`, DNC-015 — 홈·리포트가 이걸 쓴다), 기록 탭 월 합계는 `!== "gift"`로만 걸러 환불을 지출처럼 **더하고 있었다**(환불 행이 있는 달에 홈과 기록 탭 숫자가 어긋남). 이제 `reconcileMonthlyExpenses`(`apps/mobile/src/offline/expense-list-reconciliation.ts`)도 같은 술어(`countsTowardMonthlyTotal` — `expenseType === "expense"`, 필드 없는 레거시 오프라인 페이로드는 expense로 간주, `src/expenses/recent-items.ts` 관례)를 서버 행·오프라인 행 양쪽에 적용한다. 블랙리스트 대신 화이트리스트라 서버가 새 `expenseType`을 추가해도 기록 탭이 자동으로 지출로 세지 않는다. 표시는 불변 — 환불 행은 목록에 그대로 남고 "환불 ·" 부제로만 구분된다(합계 규칙만 바뀜). 회귀 고정: `apps/mobile/src/offline/expense-list-reconciliation.test.ts`(환불 단독/선물·환불 혼합/레거시 무필드 케이스).
  - **남은 것(의도적 판단)**: 금액 자체는 여전히 부호 없이 그린다. ⓐ `formatKrw`가 부호를 찍지 않는 것이 계약이고, ⓑ 기록 탭 월 합계는 (이제 서버와 동일하게) 환불을 **제외**할 뿐 빼지는 않는다 — 여기서 "-38,500원"을 그리면 합계가 하지 않는 뺄셈을 주장하는 셈이라 라벨로만 구분한다. 부호 계층을 되살리려면 합계 규칙(환불을 음수로 반영할지)을 서버 `sumExpenses`와 함께 정해야 하며, 그건 서버 집계 변경이라 여전히 별도 티켓 대상이다.
  - (곁가지였던 고아 export `formatKrwParts`/`MoneyKrwParts`와 삭제된 컴포넌트를 가리키던 `apps/mobile/src/theme.ts` 주석은 라운드 19에서 정리됨 — R19-E.)
- ~~**카테고리 목록이 서버에서 21개로 내려옴 — 지출 수정 화면은 19개로 좁혀 그림(R20-B, 부분 해소)**~~ → **해소(CAT-124)**. 아래 R20-B/REC-121 경위는 기록으로 남기고, 마지막 "남은 것" 항목이 CAT-124로 어떻게 닫혔는지는 그 아래 별도 항목에 적었다. 시드는 세 묶음 그대로다: 정식 12개(`categorySeeds`) + 모바일 퀵타일 별칭 8개(`mobileCategoryAliasSeeds` — 모바일이 하드코딩한 UUID를 유효하게 만들려고 만든 것) + 가져오기 스텁 1개(`importStubCategorySeeds`, 코드 `import_stub_default`, 이름 "가져오기 기본") = 21행(`apps/api/prisma/seed-data.ts`, `apps/api/prisma/seed.ts`).
  - **R20-B에서 고친 것**: 지출 수정 화면(`apps/mobile/app/expenses/[expenseId].tsx`)이 이 목록을 그대로 그리지 않고 표시 전용 순수 함수 `selectableCategories`(`apps/mobile/src/categories.ts`)를 통과시킨다 — ⓐ `import_` 접두 코드(가져오기 스텁) 제외, ⓑ **이름이 완전히 같은** 항목은 1개만 노출(정식 코드가 `mobile_` 접두 별칭을 이김), ⓒ 현재 지출에 이미 저장된 `categoryId`는 ⓐ·ⓑ에 걸려도 항상 포함하고 동명 그룹에서 우선 채택(선택 상태·재선택 가능성 유지). 서버 응답·리포트 이름 해석(`buildCategoryNameLookup`)·다른 화면은 불변. 결과: "기타" 중복 1건과 "가져오기 기본"이 사라져 21 → **19개**. 데모(로컬 세션) 목록에서도 카탈로그와 픽스처가 겹쳐 생기던 "기저귀"·"분유/유제품" 중복이 함께 사라진다.
  - **REC-121에서 넓힌 것**: 기록 탭 카테고리 필터 칩도 같은 `selectableCategories`를 통과한 서버 목록으로 그린다(그전에는 정적 8타일이라 정식 12개로 기록된 지출이 어떤 칩에도 잡히지 않았다 — `apps/mobile/src/expenses/records-list-view.ts` `buildRecordsCategoryChips`). 단 *필터*는 합쳐진 동명 그룹의 id를 **전부** 매칭한다(`matchIds`) — 살아남은 "기타" 칩 하나만 비교하면 별칭 id로 저장된 빠른 기록 "기타" 지출이 통째로 사라지기 때문. 부작용으로 가져오기 스텁("가져오기 기본")은 필터 칩으로 제공되지 않아 해당 행은 "전체"에서만 보인다.
  - ~~**남은 것**: "기저귀/위생"과 별칭 "기저귀", "수유/이유식"과 "분유/유제품"처럼 *뜻은 겹치지만 이름이 다른* 쌍은 여전히 나란히 뜬다(그래서 12개가 아니라 19개다).~~ → **CAT-124에서 해소** (바로 아래 항목).
  - **배포 결합 주의(R26 리뷰)**: 이 해소는 필드 추가가 아니라 **기본 응답 행 축소**(21→12)라 구클라이언트에 하위 호환이 아니다 — includeAll을 모르는 앱은 별칭·스텁 행을 못 받아 칩 매칭·라벨이 무너진다. 스토어 미출시 상태라 현재 영향 없음. API·앱을 같은 사이클로 배포할 것(launch-72h-plan §2.1에 명시).
- **카테고리 노출 범위 — CAT-124에서 서버 계약으로 해소** (위 R20-B 항목의 후속). 별칭·스텁 행을 지우는 대신 `categories`에 노출 여부 플래그를 더했다.
  - **스키마**: 마이그레이션 `000018_categories_selectable`이 `categories.selectable boolean NOT NULL DEFAULT true`를 추가하고(`ADD COLUMN IF NOT EXISTS`, additive 관례), 별칭 8행 + 가져오기 스텁 1행을 seed 코드 기준으로 `false`로 내린다. `isSystem`을 재활용하지 않은 이유는 그 컬럼이 이미 "시스템 시드 vs 사용자 정의"라는 **다른 뜻**을 갖고 있기 때문이다(별칭·스텁도 시스템이 만든 행이다) — 뜻을 겹쳐 쓰면 DNC-007 위반이다. 재시드 정합은 `apps/api/prisma/seed.ts`가 두 경로 모두 플래그를 명시해 지킨다.
  - **DNC-007 준수**: 컬럼 추가만 — **행 삭제 없음, 기존 id 불변, `active` 불변**. 별칭·스텁 행은 살아 있고, 지출 생성/수정의 `categoryId` 검증(`apps/api/src/onboarding/expenses-store.service.ts` `requireExistingCategory`)은 존재 확인만 하므로 `selectable=false`인 id로도 **여전히 지출을 만들 수 있다** — 8타일 빠른 입력(`apps/mobile/app/expenses/new.tsx`)과 오프라인 재전송 경로가 그대로 동작한다.
  - **API**: `GET /api/v1/categories`는 기본적으로 `selectable = true`만(= 정식 12개), `?includeAll=1`(또는 `includeAll=true`)이면 전량 21행을 돌려준다. 알 수 없는 값은 조용히 무시하지 않고 400 `VALIDATION_ERROR`다(`ListCategoriesQueryDto`, `apps/api/src/finance/dto/query.dto.ts`). 응답 DTO에 `selectable`이 추가됐고 계약상 **optional**이라 구 클라이언트는 무시하면 된다(`packages/contracts/src/schemas.ts` `categoryListItemSchema`).
  - **모바일**: 이름 해석(`buildCategoryNameLookup`)은 전량이 필요하므로 앱은 공유 `["categories"]` 캐시를 **`includeAll=1`로** 채운다(기록·리포트·지출 수정·CSV 내보내기 4곳). 표시 단계의 `selectableCategories`(`apps/mobile/src/categories.ts`)가 `selectable === false`인 행을 감춰 선택 목록이 19 → **12개**가 된다. 플래그가 **없는** 항목은 감추지 않으므로 구 서버/구 캐시 응답도 종전대로 동작한다. 현재 지출에 이미 저장된 카테고리는 노출 제외여도 항상 칩으로 남는다(R20-B 규칙 유지).
  - **필터 하위 호환**: 별칭 칩이 사라지므로 기록 탭 필터는 동명 흡수(REC-121 `matchIds`)에 더해, 같은 taxonomy `code`를 가진 퀵타일 별칭 id를 정식 칩이 흡수한다(`apps/mobile/src/expenses/records-list-view.ts`). 카탈로그 id가 서버 별칭 행 id와 바이트 단위로 같아서 가능한 매핑이며, "기저귀/위생" 칩이 "기저귀" 타일 id를, "수유/이유식" 칩이 "분유/유제품"·"식비" 두 타일 id를 함께 건다. 별칭이 아직 칩을 갖는 경우(구 응답·현재 선택)에는 흡수하지 않아 한 지출이 두 칩에 걸리지 않는다.
  - **남은 것**: 가져오기 스텁("가져오기 기본")은 대응하는 taxonomy code가 없어 여전히 필터 칩이 없고 "전체"에서만 보인다(REC-121 때와 동일, 의도된 한계). 데모(로컬) 백엔드는 정식/별칭 분리가 없어 모든 행이 `selectable: true`이며 `includeAll`은 무효과다 — 거기서 어느 행이든 감추면 데모 지출이 걸릴 칩이 사라진다(`apps/mobile/src/api/local-backend.ts` 주석).
  - 회귀 고정: `apps/api/test/categories.e2e.test.ts`(기본 12건·includeAll 21건·쿼리 검증·별칭 id 지출 생성/수정 허용 + 목록·리포트 집계), `apps/mobile/src/expense-edit-categories.test.ts`(플래그 유무 양쪽), `apps/mobile/src/expenses/records-list-view.test.ts`(칩 흡수·중복 매칭 금지), `apps/mobile/src/category-name-lookup.test.ts`, `packages/contracts/src/schemas.test.ts`.

## C. 런타임 재검증이 남은 항목

- 노치/펀치홀 Safe Area, 큰 글꼴, 다크모드 강제 기기.
- 실기기(비에뮬레이터) 설치 검증.

## D. 라운드 13~15에서 확인된 설계 트레이드오프

- **푸시: 지출 수정·삭제로 인한 경계 이동 미평가** — 예산 경계(80/100%) 푸시는 지출 커밋 직후에만 평가하며 `push_boundary_marks` 클레임으로 (아이, 월, 경계)당 최대 1회 발송(at-most-once). 수정·삭제로 월 합계가 경계 아래로 내려갔다 다시 올라와도 마크가 소멸하지 않아 재발송하지 않으며, 발송 실패 시에도 마크는 남는다 (`apps/api/src/push/push-dispatch.service.ts` 상단 주석 "알려진 한계").
- **감사로그 offset 페이지네이션의 페이지 밀림 수용** — 페이지를 넘기는 사이 새 기록이 쌓이면 항목이 밀리는 offset 방식의 한계, 그리고 무필터 조회 `count(*)` 비용을 명시적 트레이드오프로 수용함. 내부 관리 화면(저빈도·소수 사용자)이라 단순함 우선 (`apps/api/src/admin/audit-logs.service.ts`의 "트레이드오프(수용)" 주석).
- **모바일이 `@wooriai/contracts`에 미의존** — API 응답 타입을 `apps/mobile/src/api/client.ts`·`apps/mobile/src/analytics/events.ts`에 수기로 로컬 정의함(각 파일 주석에 명시). 서버 계약 변경 시 컴파일 타임에 잡히지 않고 수동 정합(CON-115 등)에 의존.

## E. 라운드 16~18에서 새로 확인된 한계·계약

- **admin 쓰기 경로의 멱등키가 부분 적용** — `IdempotencyInterceptor`는 opt-in 라우트 단위다. 라운드 19(R19-F)에서 재시도 위험이 큰 admin 생성류에 서버측 인터셉터가 붙었고(`POST /admin/product-links/bulk-apply`(CSV 최대 500행), `POST /admin/users`, `POST /admin/item-templates`, `POST /admin/product-links`, `POST /admin/content-revisions/:id/approve-publish`) 클라이언트도 그 경로에 한해 `Idempotency-Key`를 보낸다(`apps/admin/src/lib/admin-api.ts` — 시도 1회당 1키 홀더 + `IDEMPOTENT_WRITE_TIMEOUT_MESSAGE`). **R20-D에서 잔여 상태 전이 POST를 하나씩 확인해 결론을 냈다**: `POST /admin/content-revisions/:id/rollback`만 인터셉터를 추가로 붙였고(롤백 대상은 계속 `published`라 상태 조건이 재실행을 막지 못하고, 호출할 때마다 새 리비전 행 생성 + 라이브 재기록이라는 실질 부작용이 있다), `submit`·`reject`·`schedule`은 **비부착으로 확정**했다 — 순수 상태 전이라 재시도해도 새 행이나 라이브 쓰기가 없고 서버 CAS(또는 `status !== "draft"` 선검사)가 두 번째 실행을 막으므로, 중복이라 해봐야 감사 로그 1건뿐이다(판단 근거는 `apps/api/src/admin/content-revisions.controller.ts`의 라우트별 주석, 회귀 고정은 `apps/admin/src/admin-idempotency.test.ts`). 남은 것은 disclosures PUT 등 나머지 쓰기이며, 이들은 같은 요청이 두 번 도달하면 두 번 반영될 수 있어 클라이언트가 쓰기 타임아웃(60초)을 "실패"로 단정하지 않고 반영 여부 재확인을 안내하는 완화책에 의존한다(`AdminApiTimeoutError.retryUnsafe`, FIX-118C). (PATCH 수정류는 같은 body를 두 번 써도 결과가 같은 자연 멱등이라 부착 대상이 아니다.)
- **관리자 임시 비밀번호(tempPassword)가 `idempotency_keys.response_json`에 최대 24시간 평문으로 남고, 정리는 TTL 잡에만 의존한다 (FIX-119A/L-2)** — `POST /admin/users`는 계정 생성 응답으로 일회용 임시 비밀번호를 딱 한 번 돌려주는데, 재시도 시 그 응답을 재생하려면 응답 본문을 저장해야 한다. 그래서 tempPassword가 멱등키 행의 `response_json`에 그대로 들어가 완료 TTL(24h) 동안 남는다(`apps/api/src/admin/admin-users.controller.ts`의 "트레이드오프" 주석, `apps/api/src/common/idempotency/idempotency.interceptor.ts`의 `IDEMPOTENCY_TTL_MS`). 감사 로그에는 절대 남기지 않으며, 어차피 첫 로그인 후 교체되는 일회용 자격증명이고 DB 읽기 권한은 이미 `password_hash`를 직접 바꿀 수 있는 신뢰 경계라 새 노출면이 열리지는 않는다 — 다만 **파기 경로가 하나뿐**이라는 점이 한계다:
  - 삭제하는 주체는 만료 행을 지우는 TTL 정리 경로뿐이다 — 워커 잡(`apps/api/src/worker/jobs/idempotency-key-cleanup.job.ts`, `expiresAt < now`)과 인터셉터의 확률적(2%) 청소. 워커가 돌지 않는 배포에서는 인터셉터 청소가 유일한 정리 수단이고, 그건 **같은 라우트로 새 요청이 들어와야만** 실행된다(admin 계정 생성처럼 저빈도 엔드포인트에서는 사실상 무기한 잔존 가능).
  - **데이터 파기 잡의 대상이 아니다.** `data-retention-purge.job.ts`는 탈퇴 사용자(`users.id`) 스코프로만 `idempotency_keys`를 지운다. admin 쓰기 행의 `user_id`는 `admin_users.id`(또는 레거시 dev 토큰의 파생 uuid)라 그 스코프에 걸리지 않는다.
  - **백업 스냅샷에는 그대로 남는다.** TTL이 지나 행이 지워져도 그 이전에 뜬 DB 백업(`docs/operations/database-backup-restore.md`)에는 평문 tempPassword가 포함된 채로 보존 기간만큼 남는다. 운영상 완화책은 "발급 즉시 전달 → 첫 로그인에서 교체"이며, 근본 해결(응답 저장 시 민감 필드 마스킹·암호화)은 별도 티켓 대상이다.
- **온보딩 스토어 분해로 public이 된 메서드는 접근검증을 하지 않는다 (호출자 의무 계약)** — REF-118이 갓 서비스였던 `onboarding-store.service.ts`를 5개 서비스 + 공용 `child-access.service.ts`로 쪼개면서, 다른 서비스가 재사용해야 하는 childId/householdId 기반 메서드(`insertExpense`/`expensesForChild`/`sumExpenses`)가 public이 됐다. 이들은 **스스로 권한을 확인하지 않는다** — 호출자가 먼저 `requireChildAccess`(또는 `requireExpenseAccess`)를 호출해야 한다. FIX-118B(F5)에서 클래스 주석 + 각 메서드 JSDoc의 "⚠️ 호출 전 접근검증 필수" 경고로 계약을 문서화했으나, 컴파일러가 강제하지는 못한다 — 새 호출부를 추가할 때 리뷰에서 반드시 확인해야 하는 항목이다 (`apps/api/src/onboarding/expenses-store.service.ts`, `apps/api/src/onboarding/child-access.service.ts`).
- **데모(로컬) 세션에서는 아이를 추가할 수 없음 (의도된 제한)** — 데모 백엔드의 `createChild`는 픽스처 아이 1명의 이름을 바꿀 뿐이라, 예전 흐름은 실제로 일어나지 않은 일에 "추가했어요"를 띄우고 있었다. FIX-118B(F3)에서 데모 세션은 추가 버튼 자체를 감추고 "데모에서는 아이를 추가할 수 없어요. 로그인하면 아이를 추가할 수 있어요."를 안내한다(편집·개명은 데모에서도 실제로 동작하므로 열어 둠). 허위 성공을 만들지 않기 위한 의도된 제한이며, 데모 백엔드를 다자녀로 확장하기 전까지 유지된다 (`apps/mobile/app/settings/children.tsx`, `apps/mobile/src/children/manage-children-flow.test.ts`).

## F. 라운드 24에서 새로 확인된 한계

- **지출 목록/동기화 커서는 `created_at`·`updated_at`이 밀리초 정밀도라는 것을 전제한다 (R24-L4)** — 두 keyset 커서(`encodeExpenseCursor`/`decodeExpenseCursor`가 있는 `apps/api/src/onboarding/expenses-store.service.ts`, `encodeCursor`/`decodeCursor`가 있는 `apps/api/src/sync/cursor.ts`)는 시각 조각을 `Date.prototype.toISOString()`으로 찍는다 — 즉 **UTC 밀리초 3자리**다. 반면 `expenses.created_at`/`updated_at`은 `timestamptz(6)`(마이크로초)이다. 지금은 안전하다: 이 두 컬럼에 값을 넣는 경로가 전부 Prisma 클라이언트(JS `Date` = 밀리초)이거나 `now()` 기본값을 Prisma가 밀리초로 읽어 오는 형태라, 커서 왕복(Date → ISO ms 문자열 → Date)이 무손실이다.
  - **트리거 조건**: 누군가 **raw SQL·psql·백업 복구·백필 스크립트**로 sub-ms 정밀도의 `created_at`/`updated_at`을 심는 경우. 예: `INSERT … created_at = now()`를 psql에서 직접 실행하면 마이크로초까지 저장된다(Prisma를 경유하지 않으므로 절단되지 않는다).
  - **증상**: 그 행이 페이지 경계에 걸리면 **한 건이 조용히 유실된다**. 커서가 `…05.123456`을 `…05.123`으로 내림해 인코딩하고, 다음 페이지 술어 `created_at < 커서`(목록) / `updated_at > 커서`(동기화)가 그 행 자신을 제외하거나 반대로 무한 반복시킨다. 목록에서는 "기록 탭에서 한 건이 안 보임", 동기화에서는 "오프라인 클라이언트가 그 변경을 영영 못 받음"으로 나타난다.
  - **해소 방법**: 백필·복구 스크립트는 시각 컬럼을 반드시 밀리초로 절단해 넣을 것 — `date_trunc('milliseconds', now())`, 기존 데이터 정정은 `UPDATE expenses SET created_at = date_trunc('milliseconds', created_at), updated_at = date_trunc('milliseconds', updated_at) WHERE …`. (컬럼 타입을 `timestamptz(3)`로 좁히는 것이 근본 해결이지만, 기존 마이그레이션 수정이 아니라 새 마이그레이션 + 전 테이블 재작성이라 별도 티켓 대상이다.)
  - **R24-L4에서 넣어 둔 저비용 가드**: 두 디코더가 이제 **인코더가 만들 수 없는 시각 형태를 손상 커서로 거부한다**(sub-ms 정밀도, 밀리초 생략, `Z` 아닌 오프셋 표기 → 400 `EXPENSE_CURSOR_INVALID` / `SYNC_CURSOR_INVALID`). 이것은 위 유실 자체를 막지 못한다 — 서버가 만든 커서는 어차피 밀리초로 내림된 뒤이기 때문이다. 막아 주는 것은 "손으로 만든/손상된 커서가 조용히 내림돼 엉뚱한 경계로 동작하는" 쪽이며, 위 트리거 조건을 문서화해 두는 것이 이 항목의 본체다. 회귀 고정: `apps/api/test/sync-cursor.test.ts`, `apps/api/test/expenses-pagination.e2e.test.ts`.
- **~~지출 목록 커서는 깊은 페이지에서 앞 페이지를 다시 훑는다 — O(offset) (R24-M3)~~ 해소됨 (라운드 25 후속A)** — Prisma가 튜플 비교를 표현하지 못해 커서 술어가 3분기 OR로 나가는 구조는 그대로지만, OR가 함의하는 상한 `spent_on <= 커서`를 AND로 명시해 000017 인덱스의 (child_id, spent_on) 범위가 Index Cond로 올라간다 — 실측 offset 10,000에서 10,255→228버퍼(45배). 결과 집합 불변은 `expenses-pagination.e2e.test.ts` 왕복 계약이, 플랜 모양은 `perf-indexes.db.test.ts`의 R24-M3 후속A 단언이 고정한다. 상세 실측·판단은 `docs/operations/perf-index-notes.md` R24-M3 절 참고.
