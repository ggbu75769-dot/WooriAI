# 알려진 한계 (Known Limitations)

갱신: 2026-08-29 (라운드 70 트랙 F — K절 신설) · 그 앞: 2026-08-28 (라운드 57 QA까지 반영) · 브랜치: claude/app-feature-review-design-xx71k3

라운드 5~20에서 해소된 항목은 근거 파일과 함께 "해소됨" 섹션으로 옮겼다. 남은 것은 (A) 외부 계정·키가 필요한 항목, (B) 위험도 낮은 후속 개선, (C) 런타임 재검증, (D) 라운드 13~15에서 확인된 설계 트레이드오프, (E) 라운드 16~18에서 새로 확인된 한계·계약, (F) 라운드 24에서 새로 확인된 한계, (G) 라운드 27~28에서 새로 확인된 동작 계약, (H) 라운드 33에서 확인된 설계 트레이드오프, (I) 라운드 55에서 수용한 위험(앱 잠금·정기 지출), (K) 라운드 70에서 확정한 판정 셋(가족 역할의 실제 범위 · 소유권 이전 부재 · 승인 캡처에 실재하는 문자열 둘)이다(J는 라운드 65의 감사 공백이 라운드 66에서 해소된 기록이다). 각 항목은 코드 상 근거 경로를 병기한다.

라운드 21 이후로는 라운드별 "해소됨" 절을 새로 만들지 않는다 — 각 라운드에서 고친 것은 해당 절의 본문에 바로 반영하고, 남은 한계만 A~H에 유지한다. 라운드 21 시점에 A~E 중 해소된 것은 없었고, 그 뒤 **B의 "카테고리 노출 범위"가 CAT-124에서 해소됐다**(서버 `categories.selectable` + `GET /categories?includeAll=1`, 마이그레이션 000018 — B절의 해당 항목 참고). 라운드 47 기준으로 **A의 외부 자산 3종과 B의 부호 계층, D의 계약은 여전히 그대로**이고, H는 라운드 43에서 부분 완화됐다(아래 H절).

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

- **카탈로그가 커지면 준비템 탭·홈·어드민 목록이 함께 느려진다 — 문턱 둘 (GAP-067 #9, 2026-08-29 실측)**. 준비템 조회는 **활성 준비템 전량 + 그 아이의 상태 행 전량**을 읽어 JS로 랭킹하고(`apps/api/src/onboarding/items-catalog.service.ts`의 `itemsForChild`), 어드민 목록은 `where`도 `take`도 없이 **모든 준비템 + 모든 링크**를 한 응답에 싣는다(`adminListItemTemplates`). 실측(`docs/qa/load-smoke-results.md` "볼륨 축 ② 카탈로그" 절): 준비템 62 → 1,062 → 3,062에서 `items?tab=now` p50 27.9 → 138.0 → 365.0ms(≈+0.11ms/준비템), 어드민 목록 p50 29.9 → 524.5 → 1,378.5ms · 응답 본문 64.7KB → **2.26MB** → 6.50MB(≈+2.2KB/준비템). 상세(`items/:itemTemplateId`)는 같은 구간에서 19.8 → 19.5ms로 **불변**이다(링크 조회가 `idx_product_links_item_platform`을 탄다). **재검토 문턱**: 앱 축은 **활성 준비템 500건**(그 지점 p50 ≈ 80ms 추정 — 넘으면 다시 재고, 첫 후보는 단계 필터를 DB로 내리는 것), 어드민 축은 **응답 본문 1MB(≈준비템 500 · 링크 1,500)** — 그때 페이지네이션·필터가 필요하다. 지금 운영 카탈로그는 준비템 62 · 링크 58이라 두 문턱 모두 한참 아래다. 이번 라운드는 **재기만 했다**(서버 최적화 0건 — 재기 전에 고치면 무엇을 고쳤는지 증명할 수 없다).

## C. 런타임 재검증이 남은 항목

**이 절의 규율(GAP-067 #10, 2026-08-29).** 아래 **네 줄**은 라운드를 거듭하며 문장만 다듬어졌고
(라운드 66이 강제 다크 줄을 "강제 다크 기기에서 글자가 읽히는가" 한 질문으로 좁혔다) **답은 한 번도
오지 않았다.** 그래서 이번 라운드는 문장을 또 좁히는 대신 **답이 도착할 자리와 조건**을 붙인다 —
각 줄에 ⓐ 기기 조건, ⓑ 밟을 화면, ⓒ 답을 적을 자리를 명시한다. 답이 오면 그 줄을 지우고 결과를
`docs/qa/accessibility-offline-checklist.md` "수동 증거"에 남긴다.

숫자 정합(라운드 67 적대 리뷰 #5): 넷 중 **셋**(Safe Area · 큰 글꼴 · 강제 다크)이
`docs/qa/runtime-verification-required.md` **§2**의 그 세 줄이고, 넷째(**잠금 오버레이 TalkBack
투과**)는 §2가 아니라 접근성 체크표 **C-3**으로 답이 간다. 그래서 §2는 "세 줄", 이 절은 "네 줄"이
맞다 — 종전에는 이 머리말도 "세 줄"이라 적혀 있어서, 읽는 사람이 C-3 줄을 목록에 없는 덤으로
오해할 수 있었다. 다섯째 항목(실기기 설치 검증)은 ⓐⓑⓒ가 붙지 않는 별개의 한 줄이다.

- **노치/펀치홀 Safe Area 실측** — ⓐ 상단 컷아웃이 있는 실기기(또는 컷아웃을 켠 에뮬레이터
  개발자 옵션), ⓑ 홈·기록·리포트·준비템 상세·설정 다섯 화면의 상단 헤더와 하단 탭바, ⓒ 답은
  `docs/qa/runtime-verification-required.md` §2 첫 줄에 "확인일 + 기기명 + 결과"로 적는다.
- **시스템 글꼴 최대 확대에서의 글자 잘림** — ⓐ 안드로이드 설정 > 디스플레이 > 글꼴 크기 최대,
  ⓑ 금액이 큰 화면 셋(홈 히어로 · 리포트 총 지출 카드 · 지출 상세)과 이번 라운드 신설 문구
  (끝난 달 빈 카드 · 내보내기 달 선택 시트 · 되돌리기 결과 카드), ⓒ 같은 자리(§2)에 적는다.
  접근성 체크표의 C-9와 **같은 건**이다.
- **강제 다크 기기에서 글자가 읽히는가** — ⓐ 안드로이드 설정 > 디스플레이 > 어두운 테마 켬
  (앱은 light 고정 선언이다), ⓑ 위 다섯 화면 + 파괴 플로우 Alert 셋, ⓒ 답은 접근성 체크표
  **C-2** 줄에 "확인일 · 기기 · 읽히는가(예/아니오) · 안 읽히는 자리"로 적는다. 라운드 66이
  좁혀 둔 그 질문 그대로이고, 이번 라운드가 더한 것은 **어디에 답을 적는가** 하나다.
- **잠금 오버레이 TalkBack 투과(C-3) — 릴리즈 전 필수** — ⓐ TalkBack을 켠 실기기 + 앱 잠금 PIN
  설정, ⓑ 홈에서 금액이 보이는 상태로 앱을 백그라운드에 보냈다 돌아와 잠금 화면에서 화면을
  훑기, ⓒ 답은 접근성 체크표 C-3 줄과 "수동 증거"에 함께 적는다(금액·품목이 들리면 그 자체가
  결함 보고다 — 앱 잠금이 약속을 지키지 못한 것이다).
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
  - **엔드투엔드로도 한 번 쟀다 (GAP-060 #8, 2026-08-28)** — 위 실측은 쿼리 플랜/버퍼 수준이었고, HTTP 왕복으로 깊은 커서를 재 본 적은 없었다. 볼륨 축 실측(`docs/qa/load-smoke-results.md`)에서 5,001행 중 **마지막 꽉 찬 페이지를 여는 커서 p50 155.7ms vs. 첫 페이지 186.0ms** — 이 볼륨에서는 깊이 페널티가 관측되지 않았다. 다만 **단일 볼륨·단일 환경의 한 번의 측정**이라 "이 조건에서 깊은 페이지가 첫 페이지보다 느리지 않다"까지가 이 수치가 지지하는 전부이고, 커서 술어의 구조(3분기 OR)가 사라진 것은 아니다 — 그 판정 문구의 한계는 실측 문서 §판정에도 같은 말로 적혀 있다.

## G. 라운드 27~28에서 새로 확인된 동작 계약

- **공동 기록 작성자 라벨은 "확실할 때만" 붙는다 — 세 순간에는 조용히 생략된다 (라운드 27 L-4 / 라운드 28 F5)** — 기록 탭 행 부제와 지출 상세의 작성자 표기(`apps/mobile/src/expenses/records-list-view.ts`의 `resolveExpenseHouseholdId` + `resolveExpenseAuthorLabel`)는 **보고 있는 아이의 가구**를 찾아 그 구성원 목록에서 이름을 푼다. 가구를 확정하지 못하면 라벨을 만들지 않고 `null`을 돌려주며, 화면은 이 기능이 없던 때(FAM-127 이전)와 **한 글자도 다르지 않게** 그려진다 — "· " 빈 접두도, "가족" 같은 자리표시자도 만들지 않는다. **의도적 선택이다: 틀린 라벨(다가구 계정에서 엉뚱한 가구의 이름)은 허위 표시고, 생략은 정보가 하나 적을 뿐이다.**
  - **트리거 ①: `["children"]` 조회 실패** — 아이 목록 캐시가 없으면(네트워크 실패·에러) 가구를 모른다. 여기서 세션의 `defaultHouseholdId`로 폴백하면 두 가구에 속한 계정에서 **다른 가구의 구성원 이름**이 그려질 수 있어, 폴백 대신 생략한다.
  - **트리거 ②: soft delete된 아이** — 아이 목록은 살아 있는 아이만 담으므로, 삭제된 아이의 지출을 보고 있으면 그 아이가 목록에 없어 가구를 확정할 수 없다(같은 이유로 생략).
  - **트리거 ③: 첫 진입 과도기** — 앱을 켜고 `["children"]`·`["household-members", householdId]` 두 캐시가 채워지기 전 몇 프레임 동안은 라벨이 없다가, 캐시가 도착하면 나타난다.
  - **증상**: "부부가 같이 쓰는데 어떤 행에는 이름이 뜨고 어떤 행에는 안 뜬다"는 인상. 실제로는 위 세 경우 + 원래부터 라벨을 붙이지 않는 경우(1인 가구, `active` 구성원 2명 미만, 내보내진 구성원의 옛 기록, 서버가 `createdByUserId`를 주지 않는 오프라인 대기 행)가 섞인 결과다.
  - **해소 방향**(별도 티켓): 가구를 확정하지 못한 동안 라벨 자리 자체를 스켈레톤으로 비워 두면 "없음"과 "아직 모름"을 구분할 수 있다. 지금은 그 구분을 위해 화면 문구를 늘리는 비용이 이득보다 커서 생략을 유지한다. 회귀 고정: `apps/mobile/src/expenses/records-list-view.test.ts`.

## H. 라운드 33에서 확인된 설계 트레이드오프

- **홈 주간 카드가 이번 달 지출 "전량"을 캐시로 끌어온다 — 콜드 스타트 1회 비용 (라운드 33 F7)** — 홈의 "이번 주 요약 · 기록 스트릭" 카드(`apps/mobile/src/home/weekly-summary.ts`)는 주 합계를 정확히 내기 위해 이번 달·지난달 지출 **행**이 필요하다(월 합계 API로는 "월요일부터 오늘까지"를 자를 수 없다). 그래서 홈이 `["expenses", childId, 이번 달]` 쿼리를 `fetchMonthExpenses`(커서 루프, 페이지당 최대 500건)로 돌린다 — 지출이 많은 달이면 홈을 처음 여는 순간 한 달치 전체가 **여러 요청**으로 넘어온다.
  - **수용한 이유**: 캐시 키가 기록 탭과 **문자 그대로 같아서**(`app/(tabs)/records.tsx`) 두 화면이 같은 응답을 공유한다. 즉 비용은 세션당 콜드 스타트 1회뿐이고, 그 뒤 기록 탭 진입은 물론 홈 재방문도 추가 요청이 0건이다(지출 생성/수정/가져오기가 `["expenses"]` 프리픽스를 invalidate할 때만 다시 받는다). 부분 페이지만 읽는 대안은 앞날짜가 통째로 빠져 "이번 주"가 틀린 숫자가 되므로(REC-124(H1)와 같은 함정) 선택지가 아니다.
  - **증상이 나타나는 조건**: 한 달 지출이 수백 건인 계정 + 느린 회선에서 홈 첫 진입. 카드는 캐시가 다 도착할 때까지 아예 렌더되지 않으므로(부분 합계에 "이번 주"라는 이름을 붙이지 않는다) 틀린 숫자가 보이지는 않고, 카드가 늦게 나타난다.
  - **라운드 43(UX-W C8)에서 부분 완화** — 콜드 스타트에 **지난달** 쿼리까지 동시에 돌던 것을 이번 달 쿼리가 끝난 뒤(`thisMonthExpenses.isFetched`)로 미뤘다. 지난달 데이터를 쓰는 소비자는 홈의 두 곳뿐이고 둘 다 "완전한 데이터일 때만 렌더"라 첫 페인트를 붙잡을 이유가 없었다. 이번 달 쿼리는 주간 카드가 첫 페인트에 쓰므로 그대로 둔다. 계약 고정: `apps/mobile/src/home/home-cold-start-defer.test.ts`(쿼리 `enabled` 조건 + 선언 순서 + 주간 알림 3상태 상호작용).
  - **크기를 실제로 쟀다 (GAP-060 #8, 2026-08-28)** — 이 항목은 오랫동안 "수용한 위험"이면서 **얼마나 큰 위험인지는 잰 적이 없는** 상태였다. 볼륨 축 실측(`docs/qa/load-smoke-results.md` "볼륨 축 ① 지출 실측" 절)이 그 공백을 메운다: 전량 루프의 비용은 페이지 수에 정직하게 비례해 **201행/월(1페이지) p50 88.4ms → 5,001행/월(11페이지) p50 1,384ms**(≈15.7배)였고, 오류·429는 0건이었다. 즉 위 "증상이 나타나는 조건"으로 적어 둔 **한 달 수백 건 구간은 여전히 1페이지**라 100ms대다. 재검토 문턱은 그 실측이 제안한 대로 **월 1,000행(3페이지)**이며, 로컬 루프백 측정에는 페이지당 RTT가 빠져 있으므로 실기기에서는 이보다 나쁘다. (측정은 dev 모드 단일 컨테이너 3회, 전량 루프 p50이 1384~2066ms로 흔들렸다 — **배율이 신호이고 절대값은 참고치**다.)
  - **해소 방향**(별도 티켓, 여전히 유효): 서버에 기간(`startDate`/`endDate`) 합계 엔드포인트가 생기면 주 구간만 물어보는 편이 싸다 — defer는 첫 페인트를 앞당길 뿐 이번 달 전량 조회 자체는 남아 있다. 지금은 새 API 없이 기존 캐시를 재사용한다는 원칙(UX-A)을 우선한다. 위 실측도 이 방향을 폐기할 근거는 주지 않았다(1페이지에서 싸다는 것이지, 루프가 사라진 것이 아니다). 회귀 고정: `apps/mobile/src/home/weekly-summary.test.ts`, `apps/mobile/src/expenses/month-expenses.test.ts`.

## I. 라운드 55에서 수용한 위험 (앱 잠금 · 정기 지출)

라운드 55 설계 문서(`docs/5차/round55-plan.md` §6)가 "수용하고 문서화할 것"으로 열거한 항목이다. 다섯은 그 목록에서 그대로 왔고, 여섯 번째(앱 스위처 미리보기)는 구현 뒤 확인된 같은 성격의 한계라 함께 둔다. 공통 성격: **이 잠금은 곁눈질 방어이지 암호학적 보호가 아니며, 문구가 그보다 크게 말하지 않는 것이 계약이다**(`apps/mobile/src/security/app-lock.ts` 머리말의 `APP_LOCK_SCOPE_NOTICE` 규율).

- **PIN 해시가 KDF가 아니다 — 솔티드 SHA-256 1회 (설계 §6 위험 1)**. 4자리 PIN은 후보가 1만 개뿐이라, 기기가 루팅돼 SecureStore 블롭이 유출되면 즉시 역산된다 (`apps/mobile/src/security/app-lock.ts`, 해시는 `src/auth/sha256.ts` 재사용). **왜 이대로 두는가**: ⓐ 반복 스트레칭은 순수 JS SHA-256에서 체감 지연을 만들고(잠금 해제는 앱을 열 때마다 지나는 길이다), ⓑ 제대로 된 KDF는 새 의존성(`expo-crypto` 등)이라 **A절** 관례상 사용자 몫이며, ⓒ 이 잠금이 막는 것은 애초에 "잠깐 빌려준 폰에서 곁눈질" 하나다 — 루팅된 기기를 손에 쥔 공격자는 SecureStore 블롭 말고도 SQLite의 지출 원본을 그대로 읽을 수 있어, PIN 해시를 강화해도 그 사람이 못 보게 되는 것이 없다. **해소 방향**(별도 티켓): 네이티브 KDF 또는 생체 인증 — 둘 다 새 의존성이 선행이다.
- **로컬 시계를 앞으로 돌리면 실패 대기를 넘길 수 있다 (설계 §6 위험 2)**. 연속 5회 실패마다 서는 대기(30초 → 60초 → 300초)는 `lockedUntilMs`(기기 시각)로만 판정한다 (`apps/mobile/src/security/app-lock.ts`의 `APP_LOCK_LOCKOUT_STEPS_MS`). 서버 시각이 없는 로컬 잠금의 일반 한계로 수용한다 — 이 판정에 서버를 끌어들이면 **오프라인에서 앱이 열리지 않는다**(오프라인 우선이 이 앱의 근간이다). 표시 쪽 방어만 있다: 시계를 과거로 돌려도 남은 시간이 `APP_LOCK_LOCKOUT_MAX_MS` 이상으로 커 보이지 않는다. 실패 **횟수** 자체는 SecureStore에 남아 강제 종료로는 초기화되지 않는다.
- **60초 유예를 넘기는 파일 선택·공유는 재잠금된다 (설계 §6 위험 3)**. 백그라운드 유예는 60초 고정이다 (`APP_LOCK_GRACE_MS`). 이 값이 0이면 안 되는 이유가 실제로 셋 있다 — 엑셀 가져오기의 파일 선택(expo-document-picker), CSV 내보내기의 공유 시트, 카카오 로그인의 외부 브라우저. 셋 다 앱을 백그라운드로 보낸다. 그래서 60초를 두되, 파일을 오래 고른 사용자는 돌아왔을 때 PIN을 다시 묻게 된다. **증상**: 가져오기 중간에 잠금 화면이 뜬다(작업은 잃지 않는다 — 검수 화면은 잡 id로 다시 열리고, 재진입 카드가 그 잡을 가리킨다: `apps/mobile/src/stores/import-resume.store.ts`). **해소 방향**(별도 티켓): 신뢰 플로 억제 API(`beginTrustedExternalFlow`) — 유예를 시간이 아니라 "우리가 띄운 외부 화면"이라는 사실로 판정하게 만든다.
- **잠금 중에도 백그라운드 작업은 돌고, 낭독이 잠금 화면 위로 샐 수 있다 (설계 §6 위험 4)**. 잠금 오버레이는 화면을 덮을 뿐 아웃박스 flush·알림 평가를 멈추지 않는다(멈추면 잠긴 기기가 동기화를 영원히 미룬다). 화면 노출은 없지만, `announceForA11y`로 나가는 문장은 오버레이와 무관하게 스크린리더가 읽는다 (`apps/mobile/src/security/AppLockOverlay.tsx`가 쓰는 것과 같은 통로). **범위 (라운드 60 트랙 B에서 정정)**: 이 문장은 원래 "이 통로로 나가는 문장은 상태 안내(‘동기화 대기 N건’ 계열)이지 금액·품목명 원문이 아니다"였는데, **사실이 아니었다**. 구매 확인 카드(`apps/mobile/src/commerce/PurchaseFollowupPrompt.tsx`)는 콜드 스타트·포그라운드 복귀에 **스스로** 떠서 『품목명』 구매하셨나요?를 낭독했고, 그 두 순간이 바로 잠금이 PIN을 묻는 순간이다 — 잠긴 폰에서 품목명 원문이 소리로 새는 유일한 경로였다(오버레이도 접근성 방패도 명령형 낭독은 막지 못한다). 라운드 60 트랙 B(GAP-060 #6)가 그 카드의 후보 판정·낭독·렌더를 **잠금 게이트가 blocking인 동안 보류**하도록 고쳤다(판정은 `apps/mobile/src/commerce/purchase-followup-resolution.ts`의 `isPurchaseFollowupHeldByAppLock` 한 곳, 잠금 상태는 저장소 단일 판정 `resolveAppLockGateStatus`를 읽기만 한다). **이 수정 이후의 상태**: 사용자 조작 없이 이 통로로 나가는 문장은 동기화 결과 토스트 계열("기기에 저장했어요"·대기/실패 건수)뿐이고, 나머지 낭독은 전부 사용자가 그 화면에서 직접 일으키는 것이라 오버레이가 입력을 가로채는 동안에는 발생하지 않는다. 대기 항목은 보류될 뿐 사라지지 않아 잠금을 푼 뒤 조건이 여전하면 그때 묻는다. ⚠️ **실기기 미실측**: 위 판정은 단위·소스 계약(`purchase-followup-resolution.test.ts`)으로만 고정했고, TalkBack/VoiceOver를 켠 실기기에서 잠금 화면 낭독을 직접 들어 본 적은 없다. **해소 방향**(별도 티켓): 오버레이가 떠 있는 동안 앱 전역의 토스트·낭독을 억제하는 게이트 하나 — 그 게이트가 잠금 화면 자신의 안내까지 삼키지 않게 하는 것이 설계의 핵심이라 한 줄로 끝나지 않는다.
- **정기 지출의 "기록됨" 판정은 이름 기반이라 오탐이 있다 (설계 §6 위험 5)**. 이번 달에 같은 품목이 기록됐는지를 정규화된 **이름**으로 본다 (`apps/mobile/src/expenses/recurring-template.ts`의 `recordedItemNamesForMonth`, 비교 규칙은 `item-name-match.ts` 단일 소스). "기저귀"를 "기저귀 대형"으로 적으면 미기록으로 남아 카드가 계속 뜬다. **왜 이대로 두는가**: 템플릿과 지출을 id로 잇는 것은 서버 스키마 변경이고(DNC-012·PM 선행), 자동 기록은 DNC-013 금지다. 대신 두 가지가 이 오탐을 감당한다 — ⓐ 카드 문구가 **관측**("이번 달에 아직 안 보여요")이지 단언("기록하지 않았어요")이 아니고, ⓑ "이미 기록했어요" 수동 넘기기가 그 달을 목록에서 뺀다(`skippedYearMonths`). 반대 방향 오탐(다른 이유로 산 "기저귀"를 정기 지출로 셈)도 같은 성격이며, 그 경우 카드가 뜨지 않을 뿐 지출이 만들어지지는 않는다.
- **앱 스위처 미리보기는 방어하지 않는다 (구현 후 확인)**. 잠금이 걸린 상태에서도 OS의 최근 앱 목록에는 **마지막 화면 스냅샷**이 남아, 홈 화면의 이번 달 총액 같은 값이 잠금 없이 보일 수 있다. 안드로이드에서 이것을 막는 표준 수단은 `FLAG_SECURE`이고, 이 저장소에는 그 플래그를 세우는 코드가 없다(`apps/mobile/plugins/with-wooriai-android-release.js`는 서명·릴리즈 패치만 다룬다). **왜 이대로 두는가**: 전역 `FLAG_SECURE`는 스크린샷 전체를 막아 사용자가 자기 가계부를 캡처해 공유하는 정상 사용까지 차단하고, 잠금 상태에서만 켜고 끄는 것은 네이티브 모듈이 필요하다(새 의존성 = **A절**). 그리고 이 한계는 위 첫 항목이 정한 잠금의 성격과 같은 선 위에 있다 — 곁눈질 방어까지다. **해소 방향**(별도 티켓): 잠금 상태에서만 `FLAG_SECURE`를 켜는 config plugin + 네이티브 모듈.

## J. 라운드 65에서 확인된 감사 로그 공백 → 라운드 66에서 해소됨 (참고)

- ~~**DNC-010 고지 문구의 "이전 값"은 직접 덮어쓰기 경로에만 남는다**~~ → **해결(GAP-066 #7)**: 리비전 발행 두 경로도 이제 발행 직전 라이브 스냅숏을 `before`에 싣는다.
  - **공백이었던 것**: `disclosures` 행은 key당 한 칸 upsert라 덮어쓰면 이전 문구가 **사실 자체로 사라지고**, 남는 근거는 감사 로그뿐이다. 그런데 그 근거가 직접 덮어쓰기(`PUT /admin/disclosures/:key` → `admin.disclosure.update`, GAP-065 #9)에만 있었고, 같은 문구를 바꾸는 리비전 발행 두 경로 — admin의 승인 발행(`admin.content_revision.approve_publish`)과 예약 시각의 워커 발행(`admin.content_revision.scheduled_publish`) — 의 봉투에는 `after`뿐이라 **바뀌기 전 문구가 어디에도 없었다**. 리비전 행에는 발행할 `payload`(=새 문구)만 있고 직전 라이브 값은 없다.
  - **어떻게 메웠나**: 두 발행 경로가 라이브 쓰기 **직전에** 스냅숏을 한 번 읽어 봉투의 `before`로 싣는다 (`apps/api/src/admin/content-revisions.service.ts`의 `publishAuditBefore`). 검수 화면 diff가 쓰는 `getLiveSnapshot`을 **읽기만** 하므로 그 함수의 계약(payload와 live의 키 합집합)은 그대로다. 고지는 라이브가 id가 아니라 **key로** 주소지정되므로(upsert-by-key) key로 라이브 행을 찾아 스냅숏을 뜬다 — entityId 없이 만든 초안도 before가 남는다. `before`가 null이면 그 대상이 아직 없던 **신규 생성 발행**이라는 뜻이고(라운드 65 E와 같은 표식), 고지 발행은 봉투의 `key`가 어느 문구인지 답한다(targetId는 revision id다). `rollback`은 종전대로다 — 이미 자기 `before`(fromRevisionId/fromRevisionNo)를 갖고 있다.
  - **범위·크기 판단**: 세 entityType(`item_template`·`product_link`·`disclosure`) 전부에 싣는다 — "누가 안전 주의 문구를 약하게 바꿨나"는 고지와 같은 모양의 질문이다. 스냅숏 필드는 고정 목록이라 봉투가 무한히 자라지 않고(보존 730일), **PII는 없다**(전부 운영이 쓴 카탈로그 콘텐츠). 마이그레이션 0건·화면 0건.
  - **CS 동선**: 어드민 감사 로그 화면의 액션 프리셋에 예약 발행(`admin.content_revision.scheduled_publish`)이 없어 문자열을 외워 손으로 쳐야 했다 — 함께 등재했다 (`apps/admin/src/lib/audit-log-filters.ts`, GAP-066 #9). 고지 이력은 이제 **세 액션을 함께 보면 빈 곳이 없다**.
  - **회귀 고정**: `apps/api/test/content-revisions.e2e.test.ts`의 "publish audit envelope (GAP-066 #7)" — 리비전으로 바꾼 고지의 `before.text`가 바뀌기 **전** 문구인지, 새 key는 before가 null인지, 워커 발행도 같은 봉투를 남기는지(행위자는 `system:worker`), 준비템 발행에도 스냅숏이 실리고 고지가 아닌 봉투에는 `key`가 없는지.

## K. 라운드 70에서 확정한 판정 (2026-08-29 · GAP-070 트랙 F)

라운드 70의 축은 **가족**이었고(초대를 받은 사람 · 보기 전용의 저장 · 초대하는 사람이 읽는 역할
설명 · 관리자가 떠날 때), 트랙 A~E가 고친 것은 전부 **앱이 말하는 문장**이다. 그 과정에서 고치지
않기로 한(또는 고칠 수 없는) 사실 셋이 확정됐다 — 아래 셋은 **결함 보고가 아니라 다음 결정의
입력**이다. 셋 다 코드로 값이 확인됐고, 그 확인 자체가 이 절의 본체다.

### K-1. `gift_participant`는 오늘 `viewer`와 권한이 **완전히 같다** — 원안과의 차이는 PM 판단 대기

- **사실**: 서버에는 **읽기 스코프가 없다.** 역할이 판정에 들어가는 자리는 쓰기 하나뿐이다 —
  `canEdit`(= `owner|co_parent`, `apps/api/src/onboarding/store-shared.ts`)과
  `children.controller.ts`의 `@RequireHouseholdRoles("owner","co_parent")`.
  `HouseholdRoleGuard`(`apps/api/src/common/guards/household-role.guard.ts`)는 라우트가 역할을
  선언할 때만 걸리고, 조회 경로는 **구성원인가**만 본다(`child-access.service.ts` — `edit=false`면
  `role`이 있기만 하면 통과). 즉 `gift_participant`가 보는 것은 `viewer`와 한 글자도 다르지 않고,
  둘 다 `owner`가 보는 것과 같다: 홈 총 지출 · 기록 탭 전량 · 예산 · 리포트 · CSV 내보내기.
  앱도 두 역할을 구분하지 않는다(`apps/mobile/src/family/record-permissions.ts`의
  `VIEW_ONLY_ROLES` — 쓰기 잠금용 한 벌뿐이다).
- **원안과의 차이**: `docs/0_원본아이디어/아이_가계부_어플_설계.txt:159`는
  `| 선물참여자 | "선물했어요"만 입력 가능, 전체 금액은 제한적으로 노출 |`이라고 적었다. 구현은
  그 두 절이 **양쪽 다 뒤집혀 있다** — 입력은 전부 막혔고, 전체 금액은 전부 열렸다. 이 차이는
  gap-analysis 제외 판정에도, 이 문서의 어느 절에도 없었다(라운드 70 정찰이 처음 적는다).
- **라운드 70 C가 한 일 = 앱이 지어낸 약속을 거둔 것**뿐이다. 초대 화면의 역할 설명이 없는
  제약을 약속하고 있었고("선물 준비 목록만 함께 볼 수 있어요" — 거짓, "기록만 확인할 수 있어요" —
  절반만 참), 그 문장이 프라이버시 결정을 유도했다. 이제 설명문은 `EXPENSE_EDIT_ROLES`에서
  파생되고(서버 `canEdit`의 거울), 보는 범위는 역할 줄이 아니라 목록 **위**의 공통 고지 한 줄이
  말한다(`apps/mobile/src/family/invite-flow.ts`의 `INVITE_SCOPE_NOTICE` — 초대 화면과 가족 화면
  역할 Alert 두 자리가 같은 상수를 읽는다). **역할 값·라벨은 무변경**이다(DNC-008이 이름으로 잠근
  넷 · `memberLabels.ts`). 회귀 고정: `apps/mobile/src/family/invite-flow.test.ts`(파생 단언 +
  "…만 볼 수 있어요" 계열이 되살아나지 않는 **부정 단언**).
- **남은 결정(PM)**: 원안대로 **읽기 스코프를 서버에 만들 것인가**. 홈·기록·리포트·예산·CSV 전
  경로에 역할 스코프를 넣는 것은 서버 계약 결정이고 DNC-008("역할과 **권한 원칙**을 바꾸지
  않는다")이 정면으로 걸린다 — 원안 복원이라 해도 PM 승인이 먼저다. 결정이 오기 전까지 앱은
  **오늘의 사실**을 말한다(문장이 판정에서 파생되므로, 언젠가 두 역할이 실제로 갈리면 문장이
  따라 움직이거나 테스트가 빨개진다).
- **스토어 문구도 같은 계보였다** — `docs/store/play-listing.md` §3의 6번 항목이
  "역할(공동 양육자/보기 전용/선물 참여자)에 따라 권한이 달라요."라고만 적어 두어, 읽는 사람이
  보는 범위도 갈린다고 읽을 수 있었다. 라운드 70 F가 그 두 문장을 앱의 고지와 같은 사실로
  정정했다(트랙 C 판정과의 정합 — 그 문서의 §3 갱신 노트 참고).

### K-2. **소유권을 넘기는 경로가 저장소에 0건이다** — 관리자가 나가면 그 가구는 초대·구성원 관리를 영구히 잃는다

- **사실**: `leaveHousehold`·`withdrawUser`(`apps/api/src/households/household-runtime.service.ts`)에
  **마지막 관리자 가드가 없다** — 구성원 행을 `left`로 바꾸고 끝이다. 그런데 권한 판정은 **구성원
  역할**을 본다(`assertOwner`)이므로, 관리자의 구성원 행이 `left`가 되는 순간 그 가구에는 `owner`
  역할을 가진 사람이 **아무도 없다**(`households.ownerUserId` 컬럼은 남지만 판정에 쓰이지 않는다).
  그리고 관리자만 할 수 있는 일이 셋이다 — 초대 생성(`createInvite`) · 초대 취소(`cancelInvite`) ·
  구성원 삭제(`removeMember`). **역할 변경 엔드포인트는 저장소에 0건**이다(역할은 초대할 때 한 번
  정해지고 그 뒤로 바뀌지 않는다). `removeMember`가 관리자 자신을 막으며 안내하는 "Use the leave
  or account deletion flow instead."의 **그 흐름이 바로 가구를 관리 불능으로 만드는 흐름**이다.
- **결과**: 관리자가 나간 뒤 남은 가족은 새 구성원을 영영 초대할 수 없고, 나간 사람도 다시 들어올
  길이 없다(들여보낼 수 있는 사람이 없으므로). 회복 경로는 오늘도 **새 가구를 만들어 그동안의
  기록을 버리는 것**뿐이다.
- **라운드 70 D가 한 일 = 막지 않고 말하는 것**뿐이다. 되돌릴 수 없는 두 흐름의 "진행하면 이렇게
  돼요" 상자가 역할을 보지 않는 정적 배열이었는데, 이제 요청자의 역할에서 파생한다 — 관리자면
  한 줄이 선다("관리자인 내가 나가면 그 가족에 관리자가 없어져서 새 구성원 초대와 구성원 관리를
  아무도 할 수 없어요", `apps/api/src/settings/settings.controller.ts`의
  `LAST_OWNER_LEAVE_IMPACT_LINE`). 데모 백엔드 거울도 **글자까지 같다**
  (`apps/mobile/src/api/local-backend.ts` — 라운드 46이 세운 "impact 서버-데모 통일" 규율).
  판정에 쓰는 값은 `AuthenticatedUser.households`의 역할뿐이라 **새 조회 0건**이고, 남은 구성원
  수는 세지 않는다. 회귀 고정: `apps/api/test/admin-settings.e2e.test.ts`(관리자 두 좌표 +
  **비관리자는 종전과 바이트 단위로 같다**) · `apps/mobile/src/local-backend.test.ts`(데모 거울).
- **탈퇴를 막지 않는 이유**: 막으면 마지막 관리자가 자기 계정에 갇히고, 계정 삭제 경로로 어차피
  같은 결과가 난다.
- **남은 결정(별도 티켓 · PM)**: **소유권 이전 기능**은 새 엔드포인트 + 역할 변경 + 감사 + 화면
  이고 DNC-008의 "권한 원칙"에 닿는다 — 이번 라운드의 범위 밖이다. 이 절의 존재 이유가 그
  결정의 입력을 남겨 두는 것이다(대안 후보 둘: ⓐ 마지막 관리자의 탈퇴 시 남은 구성원 중 한
  명에게 자동 승계, ⓑ 명시적 이전 화면. 둘 다 "누가 받는가"를 정하는 서버 계약 결정이다).

### K-3. `"무료배송"` 기본값과 알림 벨 이모지(🔔)는 **승인 캡처 본문에 실재한다** — 재캡처 승인 전 접촉 금지 (7·4라운드 이월 종결)

- **`ProductComparisonRow`의 `caption` 기본값 `"무료배송"`은 실사용자에게 도달하지 않는다.**
  근거 셋을 값으로 확인했다: ⓐ 실호출부는 한 곳뿐이고
  (`apps/mobile/app/items/[itemTemplateId].tsx:997`) 그 자리는 `caption={hasSession ? … : undefined}`
  라 **기본값이 서는 것은 비세션 분기뿐**이다(`apps/mobile/src/ui.tsx`의 `caption = "무료배송"`),
  ⓑ 그 분기로 가는 길은 `apps/mobile/app/pixel-lock.tsx`의 `ITEM-002` 라우트
  (`/items/preview-diaper-party-pack`) 하나뿐인데 앱 안에서 준비템 상세로 가려면 탭 셸을 지나야
  하고 비로그인 세션은 그 게이트가 "/"로 되돌린다, ⓒ 그리고 그 문자열은
  `docs/ui-pixel-lock/live-screenshots/manifest.json`의 product-detail `bodyText`에 **세 번
  실재한다**(2026-08-29 재확인 — 파일 전체 3건).
- **알림 벨 🔔도 같은 판정이다.** 같은 manifest의 home `bodyText`에 실재하고(1건), 그리는 노드는
  `apps/mobile/src/notifications/NotificationBell.tsx:22`이며 HOME-001 픽셀락 분기가 그것을 그린다
  (`apps/mobile/app/(tabs)/index.tsx:2105`의 `action={<NotificationBell />}`).
- **판정**: 둘 다 **재캡처 승인 없이는 못 고치고**, 앞의 것은 고칠 필요도 없다(실사용자 도달 0).
  일곱 라운드(무료배송)·네 라운드(벨) 이월을 여기서 **종결한다** — 다음 라운드의 후보 목록에 다시
  올리지 않는다. 되살아나는 조건은 하나다: **승인 캡처(DSN 계열) 재촬영이 결정되는 날.**
- **반면 온보딩 첫 화면의 이모지 셋(🤰👶🧸)은 어느 캡처에도 없었다** — 잠긴 라우트는 아홉이고
  (SPL-001·HOME-001·EXP-001·ITEM-001·ITEM-002·REP-001·FAM-001·IMP-003·SET-001) 온보딩은 그 목록
  밖이다. 그래서 라운드 70 E가 **그 셋만** Ionicons outline 한 벌로 바꿨다(탭바·알림함·가져오기와
  같은 관례 — `apps/mobile/app/(onboarding)/child-status.tsx`). 같은 이모지 문제를 한 라운드에
  세 자리에서 서로 다르게 처리한 이유가 이 절의 세 문단이다: **캡처 본문에 있는가**가 갈림이다.
