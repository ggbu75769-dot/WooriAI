# 알려진 한계 (Known Limitations)

갱신: 2026-08-29 (라운드 73 후속 리뷰 — N-1에 클라우드 빌드 경로의 사각 추가 · N-2의 §5 모순 **해소** · L-2 종결/N-3의 스윕 보장 범위 정정 · 줄 번호 앵커를 식별자 인용으로) · 그 앞: 2026-08-29 (라운드 73 트랙 F — N절 신설) · 그 앞: 2026-08-29 (라운드 72 트랙 F — M절 신설 · L-2/L-3 갱신) · 그 앞: 2026-08-29 (라운드 71 트랙 F — L절 신설) · 그 앞: 2026-08-29 (라운드 70 트랙 F — K절 신설) · 그 앞: 2026-08-28 (라운드 57 QA까지 반영) · 브랜치: claude/app-feature-review-design-xx71k3

라운드 5~20에서 해소된 항목은 근거 파일과 함께 "해소됨" 섹션으로 옮겼다. 남은 것은 (A) 외부 계정·키가 필요한 항목, (B) 위험도 낮은 후속 개선, (C) 런타임 재검증, (D) 라운드 13~15에서 확인된 설계 트레이드오프, (E) 라운드 16~18에서 새로 확인된 한계·계약, (F) 라운드 24에서 새로 확인된 한계, (G) 라운드 27~28에서 새로 확인된 동작 계약, (H) 라운드 33에서 확인된 설계 트레이드오프, (I) 라운드 55에서 수용한 위험(앱 잠금·정기 지출), (K) 라운드 70에서 확정한 판정 셋(가족 역할의 실제 범위 · 소유권 이전 부재 · 승인 캡처에 실재하는 문자열 둘), (L) 라운드 71에서 확정한 판정 셋(아웃박스 계약의 그림자 · 오프라인 인지 조회 문구가 멈춘 자리 · 지원·FAQ URL의 정직한 감춤), (M) 라운드 72에서 확정한 판정 셋(온보딩의 서버 의존 경계 · 추천 점수의 배선 상태 · "기록 0건 기간" 화면 셋)이다(J는 라운드 65의 감사 공백이 라운드 66에서 해소된 기록이다). 각 항목은 코드 상 근거 경로를 병기한다.

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

## L. 라운드 71에서 확정한 판정 (2026-08-29 · GAP-071 트랙 F)

라운드 71의 축은 **여정의 끝에서 앱이 하는 말**이었다(마지막 버튼을 누른 사람 · 되돌릴 수 없는
버튼을 누른 사람 · 현관에서 막힌 사람 · 물어볼 곳을 찾는 사람 · 잠긴 화면의 머리말을 읽는 사람).
트랙 A~E가 고친 것은 전부 **앱이 말하는 문장**이고, 그 과정에서 고치지 않기로 한(또는 이번에
고칠 수 없는) 사실 셋이 확정됐다 — K절과 같이 **결함 보고가 아니라 다음 결정의 입력**이다.
셋 다 코드로 값이 확인됐고, 그 확인 자체가 이 절의 본체다.

### L-1. 아웃박스 계약의 그림자 — 교집합 소스 계약은 **큐가 지나는 파일만** 본다

- **사실**: `apps/mobile/src/api/api-error.test.ts`의 교집합 소스 계약이 훑는 서버 파일은 **넷**이다
  (`store-shared.ts` · `expenses-store.service.ts` · `child-access.service.ts` ·
  `items-catalog.service.ts`). 그 넷은 전부 **아웃박스·상태 큐가 지나는** 파일이라, 그 계약이 묻는
  것은 정확히 "큐가 만나는 4xx 코드가 표에 있는가"이고 **큐를 타지 않는 여정은 구조적으로 그 시야
  밖**이다. 계약이 훌륭하게 작동하는 만큼, 밖에 있는 것은 아무도 세지 않는다.
- **값으로 확인됐다 — 즉시 요청 여정 둘이 그 시야 밖이었고, 모양이 서로 달랐다.**
  ⓐ **가져오기**: 서버 파일 둘(`imports/import-parser.ts` ·
  `onboarding/import-pipeline.service.ts`)이 던지는 **아홉 코드** 중 **일곱이 표에 없었다**(나머지
  둘 — `IMPORT_TOO_MANY_ROWS`·`IMPORT_FILE_TYPE_INVALID` — 은 라운드 45가 업로드 화면을 위해 이미
  세워 둔 줄이다). 그 일곱이 이번 라운드에 문장을 얻었다.
  ⓑ **개인정보**: 반대 모양이다. 세 확정이 지나는 코드 넷 중 둘(`FORBIDDEN` · `CHILD_NOT_FOUND`)은
  표에 **있었는데도** 화면에 닿지 않았다 — 그 화면이 `apiErrorMessage`를 **한 번도 부르지 않기**
  때문이다(전수 grep 0건). 표에 있느냐 없느냐가 아니라 **여정이 그 표를 지나느냐**가 갈림이었다.
  두 경우 모두 표를 넓히는 것으로는 닿지 않는 자리라, 라운드 70이 내린 결론("판정은 한 벌, 문구는
  화면별")이 여기서도 유일한 답이었다.
- **라운드 71이 세운 형제 스윕은 둘이고, 단위가 서로 다르다.**
  - `src/import/import-failure-messages.test.ts`의 **"여정 스윕 소스 계약"** — 단위가 **파일**이다.
    서버 파일 둘을 읽어 `code: "…"`를 전부 긁고, 각 코드가 이 여정의 표에 있거나 **이유가 적힌
    제외 목록**에 있는지 묻는다. 정규식이 조용히 0건이 되지 않도록 하한 단언(≥9)이 앞에 서고,
    반대 방향(표에만 있는 유령 줄 금지)과 제외 둘이 실제로 앱 전역 표의 답을 받는지까지 함께 본다.
  - `src/settings/destructive-flow-messages.test.ts`의 **"서버가 실제로 던지는 코드"** — 단위가
    **메서드**다(`requireChildAccess` · `confirmChildProfileDeletion` · `assertConfirmation` ·
    `leaveHousehold` · `assertMember` · `withdrawUser` · `upsertConsents`). 파일 전체를 긁으면 그
    여정이 지나지 않는 초대·구성원 관리 코드가 섞이기 때문이다. 404 줄이 서지 않는 두 흐름
    (계정 삭제·동의 저장)은 **빈칸의 근거가 값으로** 남아 있다
    (`DESTRUCTIVE_FLOW_ABSENT_TARGET_BRANCHES` — 그 경로에 404 도메인 코드가 생기면 빨개진다).
- **남은 것(다음 결정)**: 저장소에 **여정 목록이 없다.** 두 스윕은 각자 자기 여정의 서버 자리를
  손으로 적어 두었고(`IMPORT_JOURNEY_SERVER_FILES` · 위 메서드 일곱), 그 목록이 낡는지는 아무도
  세지 않는다 — 아웃박스 계약이 파일 넷을 세는 것과 **같은 층의 사각이 한 칸 위로 옮겨간 것**이다.
  "이 저장소에 즉시 요청 여정이 몇 개인가"에 답이 없는 한, 다음 라운드도 여정 하나를 발견해서
  스윕 하나를 세우는 방식으로 갚게 된다. 그 목록을 만들지, 아니면 여정을 발견할 때마다 세우는
  지금 방식을 유지할지가 이 절이 남기는 입력이다(전자는 "여정"의 경계를 정의하는 일이라 값싸지 않다).

### L-2. 오프라인 인지 조회 문구는 **일곱 화면**에서 멈춰 있다 — 남은 다섯은 다음 라운드 한 트랙 (→ **2026-08-29 라운드 72 트랙 B에서 열로**, 이어 **라운드 73 트랙 E에서 열하나 · P3 0으로 종결**, 아래 두 갱신 블록)

- **사실**: `apps/mobile/src/offline/offline-aware-screens.ts`의
  `OFFLINE_AWARE_LOAD_ERROR_SCREENS`가 목록의 **단일 소스**이고, 오늘 값은 **일곱**이다(홈 ·
  준비템 · 기록 · 리포트 · 예산 · 가족 · 준비템 상세). `src/offline/messages.test.ts`가 `app/**`의
  `useLoadErrorCopy(` 사용 집합과 그 목록이 **정확히 일치**하는지 보므로 목록과 현실은 갈리지
  않는다. **이 파일은 이번 라운드 무접촉이다.**
- 목록 밖 화면은 옛 리터럴("불러오지 못했어요. 잠시 후 다시 시도해 주세요.")을 그대로 쓴다.
  **다음 라운드가 한 트랙으로 밀 다섯**: `app/settings/children.tsx` ·
  `app/settings/notifications.tsx` · `app/settings/index.tsx` ·
  `app/(onboarding)/prepared-items.tsx`(이 자리는 이미 탈출구 문장을 갖고 있어 급하지 않다) ·
  `app/family/index.tsx`의 대기 초대 줄. **나눠 밀면 트랙 배타가 깨진다** — 목록이 단일 소스라
  다섯이 같은 파일의 한 줄씩을 만진다.
- **이번 라운드가 지나간 화면에서도 조회 문구는 의도적으로 남았다**: `app/settings/privacy.tsx`의
  `loadFailedText` 네 자리 · 검수 화면(`app/import/[importJobId].tsx`)의 조회 실패 둘 ·
  지출 상세(`app/expenses/[expenseId].tsx`)의 실패 카드. 세 자리 다 **[다시 시도]가 실제로 통하는
  실패**라 트랙 A·B·E의 금지 목록이 명시적으로 제외했고, 이번에 고친 것은 **쓰기·확정의 실패**다.
  현관(`app/index.tsx`)만 예외로 오프라인 갈래를 얻었는데, 그것도 이 목록에 합류한 것이 아니라
  자기 판정 모듈에서 갈랐다(`resolveSelectedChildRecoveryErrorCopy` — 그 카드는 `useLoadErrorCopy`를
  쓰는 조회 카드가 아니라 탭 셸 앞의 전면 카드다. 문구는 새로 짓지 않고 `OFFLINE_RETRY_NOTICE`를
  그대로 읽는다).
- 그래서 오늘의 숫자는 **배선 일곱 · P3 다섯 · 명시적 제외 셋**이다. 다음 트랙이 다섯을 밀면 목록은
  열둘이 되고, 셋은 그때도 각 화면의 판단으로 남는다(조회 실패에 오프라인 인지를 넣는 것은 문장이
  아니라 그 자리의 재시도 가능성에 관한 판단이다).

#### L-2 갱신 (2026-08-29 · 라운드 72 트랙 B / GAP-072 #2) — **넷을 밀었고, 숫자는 열둘이 아니라 열이다**

- **오늘의 값: 배선 열 · P3 하나 · 명시적 제외 셋 · 그리고 목록 안의 "카드가 아닌 자리" 셋.**
  `OFFLINE_AWARE_LOAD_ERROR_SCREENS`는 이제 **열**이다(종전 일곱 + `app/settings/children.tsx` ·
  `app/settings/index.tsx` · `app/settings/notifications.tsx`). `app/family/index.tsx`는 구성원
  목록으로 **이미 안에 있었으므로** 대기 초대 줄이 합류해도 목록 길이는 변하지 않는다 — 위에서
  예고한 "열둘"이 열이 된 이유가 그것이다(다섯 중 하나는 목록에 이름을 더하지 않는 자리였고,
  다섯째는 아래 P3로 남았다). 계약(`src/offline/messages.test.ts`)이 `app/**`의
  `useLoadErrorCopy(` 사용 집합과 목록의 **정확한 일치**를 보므로 이 숫자는 손으로 세지 않는다.
- **P3는 이제 하나다 — `app/(onboarding)/prepared-items.tsx`.** 라운드 72 트랙 A가 이 화면을
  열었지만 **조회 실패 문구는 배선하지 않았다**(오늘도 `:147`의 옛 리터럴 그대로:
  "준비물 목록을 불러오지 못했어요. 이 단계는 건너뛰고 나중에 준비템 탭에서 체크해도 돼요."
  — 소스 재확인 2026-08-29). 그 트랙이 이 화면에서 고친 것은 **저장 실패**의 문구·탈출구이지
  조회 실패가 아니다(M-1 참고). 그래서 이 자리는 여전히 "탈출구 문장을 이미 갖고 있어 급하지
  않은" 한 줄로 남고, 배선하려는 라운드는 이 화면의 조회 실패가 **다음 단계로 갈 수 있는가**와
  얽혀 있다는 사실(라운드 72 정찰 선행 확인 2)을 먼저 읽어야 한다.
- **명시적 제외 셋은 그대로다**: `app/settings/privacy.tsx:150`의 `loadFailedText` ·
  검수 화면(`app/import/[importJobId].tsx:131`)의 조회 실패 둘 · 지출 상세
  (`app/expenses/[expenseId].tsx:791`)의 실패 카드. 셋 다 [다시 시도]가 실제로 통하는 실패라는
  판정이 유지된다(라운드 72 트랙 B의 금지 목록이 다시 명시했다).
- ⚠️ **새로 생긴 값 하나: 목록에 있으나 카드가 아닌 자리 셋**
  (`OFFLINE_AWARE_LOAD_ERROR_NON_CARD_SCREENS`, `src/offline/offline-aware-screens.ts`).
  라운드 71까지 목록의 일곱은 전부 `EmptyStateCard`였기 때문에 목록의 계약이 두 겹(① 훅 사용
  집합과의 일치 · ② 카드의 `title`·`actionLabel` 프롭으로 값을 받을 것)으로 붙어 있었는데,
  이번에 들어온 셋은 카드가 아니다 — `children.tsx`·`notifications.tsx`는 Card+Text+
  [다시 시도] SecondaryButton이고, `settings/index.tsx`는 **요약 카드의 값 한 줄**이다.
- ⚠️ **`app/settings/index.tsx`의 요약 줄은 목록 안이지만 문구 계약 밖이다**(정찰이 "목록 밖"으로
  예상했던 그 자리 — 결론은 **목록 안 + 카드 계약 밖**으로 갈렸다). 그 자리는 제목도
  [다시 시도] 버튼도 없어서 `LoadErrorCopy.title`(두 문장)을 그대로 실을 수 없다(줄이 접혀
  레이아웃이 바뀌고, 뒷문장이 가리키는 행동이 그 자리에 없다). 그래서 화면이 공용 훅에서 받는
  것은 **연결 판정 하나**이고 문구는 같은 단일 소스 문장의 **앞 문장만** 잘라 쓴다
  ("지금은 오프라인이에요." — 새 문구 0건). 그런데도 목록에 이름이 남는 이유는 계약 ① 때문이다:
  훅을 쓰는 화면은 예외 없이 목록에 있어야 한다. **온라인 갈래는 종전 문자열
  ("불러오지 못했어요") 그대로**다.
- 이 값이 필요한 이유는 다음 라운드가 둘 중 하나를 하지 않게 하기 위해서다 — ②를 만족시키려고
  **화면 구조를 카드로 바꾸거나**(레이아웃 변경), 셋을 목록에서 빼서 ①을 깨거나(그러면 세 계약
  파일이 다시 이 화면들을 지나쳐 간다 — 라운드 38 H-12가 `reports.tsx`에서 겪은 그 일).

#### L-2 종결 (2026-08-29 · 라운드 73 트랙 E / GAP-073 #5) — **P3가 0이 됐고, 저장 쪽에 목록이 생겼다**

- **오늘의 값: 배선 열하나 · P3 0개 · 명시적 제외 셋(코드 밖) + 값으로 적힌 제외 하나 · 카드가 아닌
  자리 넷.** `OFFLINE_AWARE_LOAD_ERROR_SCREENS`는 **열하나**다(종전 열 + `app/family/accept/[token].tsx` —
  초대 정보 조회). 계약 형식은 그대로다(`src/offline/messages.test.ts`가 `app/**`의 `useLoadErrorCopy(`
  사용 집합과 목록의 **정확한 일치**를 본다).
- ⚠️ **여덟 라운드 이월이 여기서 끝난다 — 답이 배선이 아니라 제외였다.**
  `app/(onboarding)/prepared-items.tsx`의 마지막 P3는 **기각**됐고, 그 판정이
  `OFFLINE_AWARE_LOAD_ERROR_EXEMPT_SCREENS`(같은 파일, 이유 문자열 포함)에 **값으로** 적혔다. 이유 셋:
  ① 조회 실패 **카드가 아니라** `Card` 안 `Text` 한 줄이고, ② 그 한 줄을 조회 실패와 "이 시기 준비물
  0건"이 **같은 조건**(`!isLoadingOptions && !hasOptions`)으로 나눠 쓰며, ③ 이미 **이 화면 전용의 더
  구체적인 탈출구 문장**을 갖고 있다("이 단계는 건너뛰고 나중에 준비템 탭에서 체크해도 돼요"). 공용
  문장은 [다시 시도]를 가리키는데 **이 자리에는 그 버튼이 없으므로**, 배선은 더 좋은 문장을 공용 문장으로
  **후퇴**시키는 일이 된다. "배선하지 않는다"는 판정은 어떤 단언도 깨지 않으므로, 적어 두지 않으면 다음
  라운드가 같은 줄을 또 세고 또 이월한다 — 그래서 **제외가 값이다**(그 목록의 계약도 두 방향이다:
  이름이 있는 화면은 배선 목록에 **없고**, 실제로 공용 훅을 **부르지 않으며**, 이유는 빈 문자열일 수 없다).
- **명시적 제외 셋은 그대로다**(`app/settings/privacy.tsx`의 `loadFailedText` · 검수 화면의 조회 실패 둘 ·
  지출 상세의 실패 카드) — 셋 다 [다시 시도]가 실제로 통하는 실패라는 판정이 유지된다.
- **카드가 아닌 자리는 셋 → 넷이다**(`OFFLINE_AWARE_LOAD_ERROR_NON_CARD_SCREENS`): 종전 셋
  (`settings/children.tsx` · `settings/index.tsx` · `settings/notifications.tsx`)에 초대 화면이 더해졌다 —
  Card + Text + [다시 시도] SecondaryButton 구조라 카드 프롭이 없고, **온라인 갈래에만** 주어("초대 정보를")를
  붙여 종전 문자열과 **바이트 단위로 같다**(만료·사용된 초대 카드는 이 갈래에 서지 않는다 — 라운드 70 A).
- ⚠️ **새로 생긴 값: 저장 쪽에도 목록이 생겼다 — `OFFLINE_AWARE_SAVE_ERROR_SCREENS`(둘 → 넷).**
  조회 쪽은 라운드 38 H-12 이후 목록이 있어서 숫자가 라운드마다 줄었는데, **저장 쪽에는 목록 자체가
  없었다**: `useSaveErrorCopy`를 지키던 계약이 두 경로를 **손으로 적은 배열**이었고 `app/**`을 훑는
  스윕이 없어 **목록이 낡아도 아무도 몰랐다.** 이제 같은 파일이 두 목록의 단일 소스이고, 손배열은
  `app/**` 스윕으로 교체됐다(조회 쪽과 **같은 형태**). 오늘의 넷:
  `app/budget.tsx` · `app/settings/children.tsx` · **`app/settings/notifications.tsx`**(기기 알림 스위치
  PATCH) · **`app/family/accept/[token].tsx`**(초대 참여 POST).
  - **새 문구는 0건**이다 — 판정은 `resolveSaveErrorCopy` 한 벌(**아는 코드 → 오프라인 → 모르는 실패**)이고,
    화면이 더하는 것은 주어 한 조각("알림 설정을")이거나 그 화면 전용 폴백 하나다. 접두는 **오프라인
    갈래에 붙이지 않는다**("알림 설정을 지금은 오프라인이에요…"는 문장이 아니고, 오프라인은 이 저장만의
    사실도 아니다). **온라인 갈래는 종전과 바이트 단위로 같다.**
  - ⚠️ `HOUSEHOLD_ALREADY_MEMBER`(409) 갈래와 라운드 70 A의 만료·사용 갈래는 **바이트 불변**이다.
    오프라인 문장이 서는 조건이 `=== OFFLINE_SAVE_NOTICE`인 것이 계약이고, 판정 순서상 그 비교가 참이면
    "서버가 아무 코드도 주지 않았다"가 이미 참이라 **아는 코드가 오프라인 문장에 가려지지 않는다.**
  - ⚠️ **이 스윕이 실제로 보장하는 범위**(2026-08-29 후속 정정): 잡는 것은 **목록 ↔ 사용 집합의
    불일치**다 — 공용 훅을 부르는데 목록에 없는 화면, 목록에 있는데 부르지 않는 화면, 자리 수가
    달라진 화면. **새 리터럴 감지는 아니다**: 새 화면이 공용 훅을 아예 부르지 않고 자기 문장을
    손으로 적으면 사용 집합에도 목록에도 없으므로 **양쪽이 일치한 채 통과한다.** 그래서 "이제
    목록이 센다"는 "목록이 낡지 않는다"까지이고, "새 문구가 생기면 빨개진다"가 아니다. 그 축을
    잡으려면 다른 형태의 단언(예: 옛 리터럴의 부정 단언 스윕)이 따로 필요하고, 오늘 그것은 조회
    쪽에도 저장 쪽에도 없다.
- **남은 사실(다음 결정의 입력)**: 라운드 71 L-1("여정 목록이 없다") · 라운드 72 M-3("상황 목록이 없다") ·
  이번의 "저장 쪽에 목록이 없다"는 **같은 층의 사각이 한 칸씩 옮겨간 것**이다. 이 저장소에서 결함이
  살아남는 방식은 이제 거의 언제나 **"세는 목록이 없다"** 하나다 — 다음 라운드가 물어야 할 것은
  "**아직 목록이 없는 축이 무엇인가**"다.

### L-3. 지원·FAQ URL은 **주입 전까지 앱에서 보이지 않는다** — 정직한 감춤과, 그 스위치가 켜지는 단계

- **사실**: 트랙 D가 세운 두 행(자주 묻는 질문 · 고객 지원)은 `EXPO_PUBLIC_FAQ_URL` ·
  `EXPO_PUBLIC_SUPPORT_URL`이 주입된 빌드에만 선다. 값이 없으면 `buildSupportMenuRows()`가
  **빈 배열**이라 더보기 탭과 설정 화면이 종전과 한 글자도 다르지 않고, 정규화가 `https?://`만
  인정하므로 잘못된 값으로 죽은 링크가 생기지도 않는다
  (`apps/mobile/src/settings/support-links.ts` · `src/settings/more-menu.ts`).
- 이것은 이 저장소가 이미 세 번 쓴 형식의 **네 번째**다(푸시 토글: 자산 없음 → 정직한 비활성 ·
  약관 링크: URL 없음 → 링크 없음 · 공유 URL: health 없음 → 버튼 없음). 값을 지어내지 않는 이유도
  같다 — `[지원 이메일]`은 아직 placeholder이고(위 **A절** · 출시 준비 현황 §사용자 액션),
  **앱이 아는 것은 URL 하나까지**다.
- **출시 절차의 어느 단계에서 켜지는가** — 세 걸음이고, 가운데를 건너뛰면 스토어에는 지원 URL이
  있는데 **앱 안에는 도움으로 가는 길이 0건**인 채로 출시된다.
  1. `infra/site/README.md`의 배포 절차대로 정적 사이트를 올려 `support.html` · `faq.html`의 공개
     URL을 얻는다(legal 문서 복사 → Cloudflare Pages).
  2. 같은 README의 **§배포 후 앱 env 주입**대로 두 키를 앱 빌드 env에 넣고 **다시 빌드**한다.
     `EXPO_PUBLIC_*`는 babel-preset-expo가 **번들 시점에 인라인**하므로 이미 만든 APK에 값을
     넣을 수는 없다 — 재빌드가 이 스위치의 전부다.
  3. 같은 support URL을 Play Console **지원 URL** 칸에 입력한다
     (`docs/store/play-listing.md` §6 기타 등록 정보 — 그 행이 앱 안 입구와 **같은 주소**여야 한다).
- **남은 한계**: 앱이 여는 것은 외부 브라우저 하나다(`Linking.openURL` — 인앱 웹뷰 0건, 새 의존성은
  A절). 문서 본문을 앱 번들에 복사하지 않으므로(`infra/site/*.html`이 단일 소스 — 두 벌이 되면
  개정할 때 갈린다) **오프라인에서는 이 두 행이 열리지 않는다.** 열지 못하면 조용히 넘기지 않고
  "링크를 열지 못했어요"를 Alert으로 말한다(아무 일도 일어나지 않는 행은 그 자체가 가짜 버튼이다).
  ⚠️ 그 열기 판정은 `Linking.canOpenURL`이고, **Android 11(API 30)부터는 매니페스트 `<queries>`
  선언이 없으면 브라우저가 설치돼 있어도 false**가 돌아온다. 이 저장소에는 그 선언이 **0건**이고
  매니페스트는 `expo prebuild` 템플릿이 만들므로(`android/`는 gitignore · config plugin은 서명·릴리즈
  패치만), "행은 서는데 언제나 실패 Alert만 뜨는" 상태가 **소스로는 보이지 않는다** — 실기기 확인
  항목이다(`docs/qa/runtime-verification-required.md` §1-1 #95 ⓒ-1). 같은 API를 쓰는 약관·개인정보
  링크도 같은 조건 위에 있다. 필요해지면 해법은 `app.json`(또는 config plugin)에 `queries`를
  선언하는 것이고, **`android/` 손패치는 금지**다.
  그리고 이 행들은 **세션 메뉴에만** 선다 — SET-001 픽셀락 캡처가 그리는 비로그인 미리보기 행
  목록(`previewMenuRowActions`)은 한 줄도 바뀌지 않았다.

#### L-3 갱신 (2026-08-29 · 라운드 72 트랙 F) — **경고의 범위와, 문장을 좁히는 단서 하나**

위 문단의 `Linking.canOpenURL` 경고는 **지원·FAQ 행만** 걱정하고 있었다. 라운드 72 정찰이 같은
API를 지나는 자리를 전수로 세어 보니 그 걱정은 **범위가 훨씬 넓고, 동시에 문장이 과할 수도**
있었다. 아래 셋을 덧붙인다 — 위 문단의 판정 자체는 그대로다(고쳐 쓰지 않는다).

- ⓐ **범위: 링크 종류 다섯 · 호출 자리 셋 · 그중 둘이 구매 링크.** 이 API를 지나는 링크 종류는
  다섯이다 — 자주 묻는 질문 · 고객 지원 · 약관/개인정보(설정·개인정보 화면) · **로그인 화면의
  약관** · **구매 링크**. 실제 호출 자리는 정찰 시점 넷이었고(그중 하나가 로그인 화면의 넷째
  사본), 라운드 72 트랙 E가 그 사본을 걷어 **오늘은 셋**이다(2026-08-29 전수 grep):
  `src/settings/open-external-url.ts:32`(앞의 네 종류를 전부 받는 규칙 한 벌) ·
  `app/items/[itemTemplateId].tsx:530`·`:555`(**구매 링크 — 핵심 루프 4단계다**).
  즉 **그 경고가 사실이라면 다치는 것은 도움 메뉴가 아니라 커머스 왕복 전체**다. 구매 링크
  둘이 규칙 한 벌에 합류하지 않는 이유는 값으로 적혀 있다(`src/shared-decision-wiring.test.ts`의
  `EXTERNAL_LINK_EXEMPT`): 그 자리는 "못 열면 말하기"로 끝나지 않고 성공 시 구매 후속 등록
  (`registerPurchaseFollowup`)이, 실패 시 COM-106 공유 링크 폴백 UI가 걸린다.
- ⓑ **`https` 자동 노출 단서 — 그래서 이번에도 `app.json`·config plugin은 무접촉이다.**
  안드로이드 패키지 가시성의 **자동 노출 규칙**은 호스트 없는 `https` VIEW+BROWSABLE 인텐트
  필터를 가진 브라우저를 예외로 두는 것으로 알려져 있어, **`https` 주소에 대해서는 `<queries>`
  선언 없이도 `canOpenURL`이 true를 돌려줄 가능성이 크다.** 이 저장소의 외부 링크는 **전부
  `https`**이고 커스텀 스킴을 여는 자리는 **0건**이다(전수 확인). 방증이 하나 더 있다 —
  카카오 로그인은 `canOpenURL`을 묻지 않고 곧바로 `Linking.openURL(authorizeUrl)`을 부르는데
  (`src/auth/kakao-login.ts:246`) 그 경로는 실기기에서 동작해 왔다. ⚠️ **다만 그것은 `openURL`이
  통한다는 신호이지 `canOpenURL`이 true라는 증거가 아니다**(가시성 필터가 거는 것은 *묻는* 쪽
  이다). 그래서 이 저장소의 판단은 **"실기기 확인 전까지 문장을 좁힌다"**이고, 답이 "false"로
  오면 그때 해법은 `app.json`(또는 config plugin)에 `queries`를 선언하는 것이다 —
  **`android/` 손패치는 금지**이고 그건 별도 트랙이다.
- ⓒ **실기기 확인 대상을 넓혔다.** `docs/qa/runtime-verification-required.md` §1-1 **#95 ⓒ-1**은
  지원·FAQ·약관만 밟게 돼 있었는데, 이번에 **구매 링크 둘**이 그 항목에 함께 들어왔다(같은 표의
  라운드 72분 **#101**도 그 자리를 지난다). 한 기기에서 네 종류를 이어 밟으면 답이 한 번에 온다.

## M. 라운드 72에서 확정한 판정 (2026-08-29 · GAP-072 트랙 F)

라운드 72의 축은 둘이었다 — **여정의 시작**(아직 아무것도 갖지 않은 사람의 첫 10분)과 **핵심
루프의 사용감**(추천 품질 · 리포트 유용성). 트랙 A~E가 고친 것은 라우팅 하나와 문장·순서
넷이고, 그 과정에서 고치지 않기로 한(또는 이번에 고칠 수 없는) 사실 셋이 확정됐다 — K·L절과
같이 **결함 보고가 아니라 다음 결정의 입력**이다. 셋 다 코드로 값이 확인됐고(2026-08-29 소스
재확인), 그 확인 자체가 이 절의 본체다.

### M-1. 온보딩의 **서버 의존 경계** — 어느 단계가 서버를 정말 필요로 하는가

- **왜 이 경계를 값으로 정해야 했나.** 라운드 71 C가 현관의 전면 차단을 완화했고, 라운드 72
  정찰이 보니 **온보딩 전체**가 같은 성격이었다(전수 grep: `app/(onboarding)/**`·
  `src/onboarding/**`에서 `isCurrentlyOnline` 사용이 라운드 71 C의 한 곳뿐이었다). 그런데
  온보딩은 현관과 다르다 — `POST /children`은 **정말로 서버가 필요하다**(childId가 없으면 그
  뒤 전부가 없다). 그래서 옳은 답은 "오프라인에서도 다 되게 한다"가 아니라 **어느 단계가 서버를
  정말 필요로 하는가를 값으로 정하는 것**이었다.
- **오늘의 경계(네 단계).**
  - **ONB-001**(아이 상태 선택) — **로컬.** 아이가 만들어지기 전이라 되돌아가도 잃을 것이 없다.
  - **ONB-002**(아이 프로필 저장) — ⚠️ **서버 필수.** 여기만 서버 쓰기를 대체할 수 없다. 이
    트랙이 한 일은 문구를 정직하게 만든 것뿐이다(아래).
  - **ONB-003**(준비물 체크) — **조건부 로컬.** 저장이 **실패했고 체크가 0건일 때만** 로컬로
    통과한다(`canPassPreparedItemsLocally`, `src/onboarding/local-progress.ts`). 체크가 하나라도
    있으면 그 길은 열리지 않는다 — "0건을 보내지 못한 것"과 "12건을 보내지 못한 것"은 다른
    실패이고, 후자를 로컬로 넘기면 앱이 **저장한 척**하게 된다.
  - **ONB-004**(예산) — **로컬.** 그 화면의 건너뛰기는 원래부터 순수 로컬이었다. 같은 온보딩
    안에서 3단계와 4단계의 규율이 달랐던 것이 이번 결함의 절반이었다.
- **실패 문구도 그 경계 위에서 갈린다.** `onboardingSaveErrorMessage`(`src/onboarding/step-ui.tsx`)의
  판정 순서는 **코드 → 오프라인 → 모르는 실패**다. 코드가 먼저인 이유: **서버가 답을 줬다는
  사실 자체가 연결이 있었다는 뜻**이라, 그 경우까지 오프라인으로 말하면 그것이 또 하나의 틀린
  안내가 된다. `CONSENT_REQUIRED`·403·**온라인의 모르는 실패**는 종전과 바이트 단위로 같다.
- ⚠️ **로컬 폴백이 정하는 것은 다음 단계이지 완료가 아니다.** 서버 진행도가 답하지 않을 때의
  목적지 표(`LOCAL_ONBOARDING_NEXT_STEP_BY_HIGHEST_COMPLETED`)에는 **`"home"`이 없고**, 폴백은
  `hasReachedHome`을 세우지 않는다(부정 단언으로 고정돼 있다). 아이가 있다는 사실만으로 온보딩을
  끝냈다고 단정하면 **예산 단계가 통째로 사라지고** 그 사람은 예산을 정할 기회를 영영 얻지
  못한다. 그리고 이 판정은 **조회가 실패했거나 3초 밸브에 걸린 갈래에서만** 산다 — 서버가
  답하면 종전 목적지가 한 글자도 바뀌지 않는다.
- ⚠️ **서버에는 중복 아이 가드가 없다 — 그리고 그 결정이 DNC-007에 닿는다.**
  `apps/api/src/onboarding/onboarding-core.service.ts`의 `prisma.child.create`는 **조건 없는
  생성**이다. 멱등키는 "한 번의 제출"만 지킨다 — 성공하면 앱이 키를 지우고
  (`app/(onboarding)/child-profile.tsx`의 `clearChildCreateIdempotencyKey`) 서버 TTL은 24시간이라
  (`idempotency.interceptor.ts`), **이미 성공한 뒤 ONB-002에 다시 들어오는 경로**는 아무것도
  막지 못한다. 라운드 72는 그 창을 **라우팅 쪽에서** 닫았고(로컬 폴백), 그래도 남는 경로
  (뒤로 가기·딥링크)에는 **막지 않고 말한다**: 사실 한 줄
  ("이 기기에는 이미 등록한 아이가 있어요. 여기서 계속하면 아이가 하나 더 생겨요.")과
  [등록한 아이로 계속하기] 버튼이 서고, **폼도 [다음]도 그대로 쓸 수 있다.**
  - **왜 서버에서 막지 않는가**: 같은 이름의 둘째 아이를 만드는 것은 **정당할 수 있다**(쌍둥이·
    같은 태명). 서버 `createChild`에 중복 가드를 넣는 일은 그 정당한 경우를 앱이 대신 금지하는
    것이고, 이미 저장된 아이 행의 의미를 바꾸는 **도메인 규칙 변경**이라 DNC-007("기존 데이터·
    도메인 계약을 임의로 바꾸지 않는다")에 정면으로 닿는다. **별도 결정(PM)**이고, 라운드 72는
    서버 0건·마이그레이션 0건이다.
  - **남은 사실**: 그래서 오늘도 API·데모 경로로는 같은 이름의 아이가 둘 생길 수 있다. 앱은 그
    사실을 **말하고**, 지우는 것은 아이 관리 화면의 프로필 삭제 흐름이 진다.

### M-2. 추천 점수의 **배선 상태** — 다섯 입력 중 셋만 순서에 도달한다

- **왜 이 판정이 필요했나.** 추천 점수는 이 저장소에서 유일하게 "설계는 있는데 배선이 없는"
  모듈이었다. `budgetFits`는 첫 커밋부터 상수였고 `userInterest`는 상태 점수와 **정확히
  상쇄되도록** 값이 정해져 있었는데(20 = 15 + 5), 그것이 의도였는지 사고였는지가 저장소 어디에도
  적혀 있지 않았다. 라운드 72 트랙 D가 한 일의 절반은 그 답을 **값으로 남기는 것**이다.
- **오늘 순서에 도달하는 입력은 셋이다**(`packages/domain/src/recommendation.ts`):
  **시기 일치**(35) · **필수도**(essential 30 · convenience 20 · optional 10) ·
  **상태**(interested **25** · not_prepared 20 · prepared/gifted/not_needed 0). 동점이면
  `id.localeCompare`, 그 뒤 `displayOrder`가 가른다.
- **도달하지 않던 둘은 입력에서 사라졌다.**
  - `budgetFits`(10점): 넘기는 자리 **둘 다 `true` 고정**이었다(서버 `item-ranking.ts` · 데모
    거울 `local-backend.ts`). 전 항목에 같은 10점이 붙으므로 **순서 기여가 정확히 0**이었고,
    그래서 제거해도 **순서가 한 칸도 바뀌지 않는다**(그것이 이 제거의 안전 근거다).
  - `userInterest`(5점): `item.status === "interested"`로 **status에서 파생**시켜 넘겼으므로
    독립 입력이 아니라 같은 사실의 두 번째 사본이었고, 값이 `15 + 5 = 20 = not_prepared 20`으로
    **정확히 동점**이 되게 정해져 있었다. 찜을 눌러도 목록이 한 칸도 움직이지 않은 이유다.
- **오늘 정한 방향과 그 근거**: **찜(25) > 미준비(20)**. `not_prepared`는 모든 항목이 처음부터
  갖는 **기본값**이라 사용자의 행동이 아니고, `interested`는 사용자가 화면에서 **직접 누른 한
  번의 판단**이다. 간격은 5점이라 **찜이 필수도를 뒤집지 못한다**(필수도 간격 10 · 시기 일치
  35 — 세 크기의 대소가 계약으로 고정돼 있다). 서버와 **데모 거울**이 같은 점수 입력 셋을
  넘긴다는 것도 파생 계약이 지킨다(`src/api/recommendation-order-mirror.test.ts`).
- **`priorityWeight`가 오늘 정하는 것**(선언은 `apps/api/prisma/schema.prisma`의 그 컬럼 주석 —
  라운드 64~67의 죽은 컬럼 선언과 같은 형식): **한 준비템의 `stageCodes` 배열 안 순서 하나뿐**
  이다. 쓰는 자리는 `seed.ts`와 어드민 저장이고 셋 다 `stageCodes.length - index`(작성자가 적은
  배열 순서를 되감는 값), 읽는 자리는 `items-catalog.service.ts`의 두 `orderBy` 뿐이며 둘 다 그
  배열을 원래 순서로 복원하는 데만 쓴다. **항목 간 순위에는 닿지 않는다** — 목록·홈 카드의
  순서는 `rankItemsForTab` → `sortRecommendedItems` → `displayOrder` 경로가 정하고 그 경로는 이
  컬럼을 읽지 않는다. 배열 순서 자체도 화면에서 순위가 되지 않는다(`stageCodes`를 보는 모든
  자리가 `.includes()`/`.some()`이라 순서를 읽지 않는다).
  ⚠️ **"준비물에 시기별 우선순위가 매겨져 있다"의 근거로 인용하지 말 것.** 값도 인덱스도
  건드리지 않았다(마이그레이션 0건 — 선언만).
- **가격이 영원히 들어가지 않는 이유(DNC-009 인접)**: 이 모듈의 입력에는 **금액 필드가 존재하지
  않는다.** `affiliateCommissionRate`는 **받되 어떤 계산에도 들어가지 않고**, 그 사실을 계약이
  **부정 단언**으로 증명한다(수수료율을 실어도 점수가 한 점도 달라지지 않는다 — 필드를 지우면
  그 단언을 쓸 자리가 사라지므로 남겨 둔다). 가격을 순서에 넣지 않는다는 판정은 이미 두 곳에
  값으로 적혀 있고(`src/items/link-price.ts:51` · `src/preparation/catalog-contract.ts:46`) 그대로
  유지된다. `budgetFits`를 되살리려면 "예산"이 무엇인지부터 정해야 한다 — 월 예산은 아이 단위의
  **한 값**이고 준비템은 범위만 가지므로 항목마다 참/거짓을 내려면 새 판정이 필요하다. 그건
  필드 하나를 다시 켜는 일이 아니라 **기능을 만드는 일**이고, 금액을 순서에 넣는 판정이라
  **DNC-009 문단을 먼저 읽어야 하는 결정**이다.
- **함께 남기는 사실(코드 아님)**: 카탈로그 62건의 시기 분포가 앞쪽에 얇다(임신초 5 · 임신중 8 ·
  임신말 15 · 신생아 18 …). **임신 초기 사용자가 보는 "지금 필요"는 최대 5건**이고 그 순서는
  모든 계정에서 같다 — 순서 판정이 아니라 **운영 카탈로그**의 사실이라 어드민 CMS의 몫이다.

### M-3. **"기록 0건 기간"을 보여 주는 화면은 셋이다** — 목록이 없어서 형제 화면끼리 정직성 등급이 갈렸다

- **사실**: 라운드 39 I-5와 라운드 67 A(#2)가 **기록 탭에서** 고친 것과 **글자 그대로 같은
  문장**이 리포트 탭에 그대로 남아 있었다("첫 기록을 남기면 **이번 달** 비용을 바로
  보여드릴게요." + [지출 기록하기] → 파라미터 없는 `/expenses/new`). 라운드 66 A(#2)가 그 화면의
  기간 라벨을 **21개월**을 건너는 월 선택 시트 입구로 만든 뒤로 그 문장의 전제는 이미 깨져
  있었고, 카드는 **월간·분기·연간 세 탭이 함께** 쓰므로 연간 탭에서는 화면이 "2025년"과
  "이번 달"을 동시에 말했다. **아무 테스트도 그것을 묻지 않았다.**
- ⚠️ **살아남은 이유는 문장이 아니라 목록이 없었기 때문이다.** 두 화면이 **같은 상황**을
  만난다는 사실이 저장소 어디에도 적혀 있지 않았다. 그래서 계약이 물어야 할 것은 "이 문장을
  쓰는 모듈이 몇 개인가"가 아니라 **"이 상황을 만나는 화면이 몇 개인가"**이고, 그 단위는
  문장(모듈)이 아니라 **상황**이다.
- **오늘의 목록은 셋이다**(`EMPTY_RECORD_PERIOD_SCREENS`, `src/reports/empty-period-card.ts`):
  `app/(tabs)/index.tsx`(홈의 "최근 지출" 빈 카드 — 언제나 **현재 달**) ·
  `app/(tabs)/records.tsx`(기록 탭의 빈 달 카드) · `app/(tabs)/reports.tsx`(리포트 탭의 빈 기간
  카드). `src/reports/empty-period-card.test.ts`가 `app/**`을 훑어 이 목록과 **정확히 일치**하는지
  보므로, 같은 상황을 그리는 화면이 새로 생기면 그 테스트가 먼저 깨진다.
- **문장은 두 벌이 되지 않았다**: 리포트의 끝난 기간 문장은 형제 모듈
  `buildRecordsEmptyMonthState`(`src/expenses/records-list-view.ts` — **읽기만**)를 그대로 불러
  제목만 읽고, 리포트 고유의 기간 단위(분기·연간)만 새 모듈이 더한다. 끝난 기간의 액션은
  `/expenses/new`가 **아니다**(날짜를 지어내지 않는다 — 기록 탭이 세운 그 규칙 그대로).
- ⚠️ **남는 사실 하나(다음 라운드가 다시 세지 않도록)**: **현재 분기·현재 연도**에서는 종전
  문장이 그대로 서므로 카드가 여전히 "이번 달"이라고 말한다. 그 자리를 라운드 72가 건드리지
  않은 이유는 둘이다 — ⓐ 그 문장은 홈·기록 탭의 현재 달 카드와 **한 벌**이라(그 일치를
  `src/refresh-wiring-contract.test.ts`가 고정한다) 리포트만 기간별 변형을 새로 지으면 저장소에
  **네 번째 문장**이 생기고, ⓑ 진행 중인 기간의 그 약속은 아직 **지킬 수 있는 약속**이라
  거짓이 아니다(끝난 기간에서만 거짓이 된다). 즉 남은 것은 **지시대명사의 단위 불일치**이지
  허위 표시가 아니다.

## N. 라운드 73에서 확정한 판정 (2026-08-29 · GAP-073 트랙 F)

라운드 73은 축을 **앱 안에서 앱 밖으로** 옮겼다 — 사용자가 앱을 설치하기 **전에** 보는 것(스토어
등록 정보·자산), 앱 **없이** 보는 것(공유된 구매 링크가 떨어지는 페이지·초대 랜딩·지원 사이트·
법적 문서), 그리고 **그 빌드를 만드는 파이프라인**이다. 트랙 A~E가 고친 것은 갈래의 기준 하나 ·
관문 하나 · 네 표면의 색 리터럴 · 그리고 판정을 읽는 자리 **열여덟**(어드민 조회 실패 열다섯 ·
모바일 초대·알림 셋)이고, 그 과정에서 **다음 라운드가 다시 재지 않아도 되는 사실 넷**이 값으로
확정됐다. K·L·M절과 같이 **결함 보고가 아니라 다음 결정의 입력**이며, 넷 다
2026-08-29 소스에서 확인됐다(커밋 b016be8 A · b495b7f B · 2d49c0c C · 24d5b54 D · 2ce0674 E).

### N-1. **무엇이 실사용자 빌드를 만드는가** — 빌드 성격의 경계와, env 부재를 그 대용으로 쓰면 안 되는 이유

- **왜 경계를 값으로 정해야 했나.** 이 저장소에는 "이 빌드가 무엇인가"를 묻는 자리가 **없었고**,
  대신 `EXPO_PUBLIC_TEST_LOGIN`·`EXPO_PUBLIC_PIXEL_LOCK`·`isKakaoLoginAvailable()`이 자리마다 그
  대용으로 쓰였다. 로그인 실패 문구가 그 사례다 — 갈래의 기준이 `isKakaoLoginAvailable()`(= **env가
  주입됐는가**)이라서, **카카오 키 없이 만든 스토어 빌드**의 실사용자가 "카카오로 시작하기"를 누르면
  개발자용 문장("서버에 연결할 수 없어요. PC와 같은 Wi-Fi에서 API 서버가 켜져 있는지 확인해 주세요.")을
  받았다. 그 사람에게는 PC도 API 서버도 없다. 라운드 65 B(#3)의 "스토어 빌드 첫 화면 문구 뒤집힘"과
  **뿌리가 같다**(그때는 삼항의 두 갈래가 뒤집혔고, 이번엔 삼항의 **기준**이 틀렸다).
- **오늘의 경계(신호 셋 — 새 env 0건).** `apps/mobile/src/auth/release-build.ts`의
  `isDeveloperBuild()`는 **셋 중 하나라도 참이면 개발(비-실사용자) 빌드**다: `__DEV__`(Metro 개발
  번들) · `EXPO_PUBLIC_TEST_LOGIN=1`(데모/테스트) · `EXPO_PUBLIC_PIXEL_LOCK=1`(픽셀락 캡처). 셋 다
  이 저장소가 **이미 쓰던** 신호이고, 실사용자 빌드는 그 셋이 모두 거짓인 빌드다 — Play AAB와
  production APK가 정확히 그 상태다(두 스크립트가 `TEST_LOGIN: "0"`·`PIXEL_LOCK: "0"`을 자식 env에
  못 박고, 릴리즈 번들이라 `__DEV__`도 false다).
- ⚠️ **이 술어는 카카오 env를 읽지 않는다.** 키의 유무는 **로그인 경로**의 사실이지 빌드 성격의
  사실이 아니다(키를 안 넣고 만든 스토어 빌드도 스토어 빌드다). 두 질문이 서로를 대용하지 않게 하는
  것이 그 모듈의 존재 이유이고, 문구 함수(`loginFailureMessage`)가 **둘을 각각 인자로** 받는 것이
  그 계약의 형태다. **두 문장은 바이트 단위로 종전 그대로**이고 새 문구는 0건이다 — 바뀐 것은 어느
  빌드가 어느 문장을 받는가뿐이며, 실사용자 빌드에서 "PC와 같은 Wi-Fi" 문장은 **도달 불가**다(부정 단언).
  `app/(auth)/login.tsx`의 `login()` 안 **경로 선택**
  (`isKakaoLoginAvailable() ? loginWithKakao() : oauthLogin("kakao")`)은 한 글자도 바뀌지 않았다.
  (2026-08-29 후속: 종전 이 문장과 소스·테스트 주석 셋이 `login.tsx:184`로 가리켰는데 그 줄 번호는
  이미 낡아 있었다 — 앵커를 **식별자 인용**으로 바꿨다. 줄 번호는 옮겨가도 조용하지만 함수·삼항의
  이름은 바뀌면 검색이 실패한다.)
- **AAB 관문이 fail-closed로 묻는 키(`scripts/build-android-aab.ts`).** 종전 이 관문이 물은
  `EXPO_PUBLIC_*`는 **API 주소 하나**였다(그 하나에만 "없으면 조용히 localhost가 실린다"는 이유가
  적혀 있었다).
  - **필수 다섯** — `EXPO_PUBLIC_KAKAO_ENABLED`(값이 `"1"`이어야 한다 · 주입 여부가 아니라 **켜졌는가**를
    묻는다) · `EXPO_PUBLIC_KAKAO_CLIENT_ID` · `EXPO_PUBLIC_KAKAO_REDIRECT_URI` ·
    `EXPO_PUBLIC_TERMS_URL` · `EXPO_PUBLIC_PRIVACY_POLICY_URL`. 뒤의 둘은 `http(s)://` 형식까지
    본다(앱의 normalize 규칙과 같은 판정 — 그 밖의 값은 앱에서 **주입되지 않은 것과 같이** 취급된다).
    없으면 사용자가 **가입 자체를 못 하거나**(서버 `oauthLogin`은 프로덕션에서 501 fail-closed다),
    **읽지 못한 문서에 필수 동의**하게 된다.
  - **명시 opt-out 둘** — `EXPO_PUBLIC_SUPPORT_URL`·`EXPO_PUBLIC_FAQ_URL`은
    `WOORIAI_ALLOW_MISSING_SUPPORT_LINKS=1`로 **적어야** 지나간다. 그때도 침묵하지 않는다: 무엇을
    잃는지("앱 안에 도움으로 가는 길이 0건인 채로 나갑니다")를 **출력한다** — L-3이 예고한 그 상태다.
  - ⚠️ **거부 메시지에 값은 실리지 않는다**(DNC-019 — 키 이름과 "없으면 무엇을 잃는가"만). 그리고
    **목록이 비면 그 자체가 실패**다(아무것도 묻지 않는 관문이 되는 상태를 조용히 두지 않는다).
  - 서명·정체성 쪽(keystore 넷 · 패키지·버전 셋 · `https://` API 주소)은 **종전 그대로**다.
- ⚠️ **그 관문은 로컬 경로에만 있다 — 스토어로 가는 클라우드 경로에는 없다**(2026-08-29 후속 확인).
  `docs/5차/apk-build-guide.md`가 스토어 AAB의 두 경로 중 **EAS `production` 프로필**을 권하는데
  (키 분실 위험이 낮아서다), `eas build`는 `scripts/build-android-aab.ts`를 **한 줄도 거치지 않는다.**
  `eas.json`의 `env`도 이 키들을 담지 않는다(실 키·실 주소를 커밋하지 않기 때문 — 그 부정 단언이
  `apps/mobile/src/eas-cloud-build-profiles.test.ts`에 있다). 즉 **카카오 키·약관 URL 없이 만든
  클라우드 AAB가 Play까지 올라갈 수 있는 상태는 그대로다.**
  - **관문을 클라우드로 옮겨 심을 수는 없었다.** 빌드 프로필의 `prebuildCommand`는 임의 명령이
    아니라 `npx expo <값>`의 **인자**로 쓰인다(@expo/eas-json 22.0.0 스키마에 필드는 있지만,
    @expo/build-tools의 `getPrebuildCommandArgs`가 `npx `/`expo ` 접두를 떼고 `--platform`을 붙여
    `expo prebuild`에 넘긴다 — 그 파일에는 "deprecate prebuildCommand" TODO도 있다). 검증
    스크립트를 적으면 prebuild 자체가 깨지므로 **넣지 않았다**(임의 명령 훅은 `eas.json`이 아니라
    package.json의 `eas-build-*` 라이프사이클이고, 그것은 데모 `preview` 빌드까지 함께 막는다).
  - **그래서 이번에 세운 것은 코드가 아니라 대조다**: ① 가이드에 §3-1(실사용자 빌드가 요구하는
    `EXPO_PUBLIC_*` 표 + `eas env:list --environment production` 대조 + `pnpm check:env --scope=mobile`)이
    생겼고, ② §5의 "사전 검증: 없음" 칸이 그 절차를 가리키게 바뀌었으며, ③ **파생 단언**이 붙었다 —
    `RELEASE_REQUIRED_PUBLIC_ENV`를 빌드 스크립트 소스에서 읽어, 실사용자 프로필(`production` ·
    `production-apk`)의 `env`가 덮지 않는 키마다 가이드가 그 키를 **이름으로** 적고 있는지 대조한다
    (`eas-cloud-build-profiles.test.ts`). 로컬 관문에 키가 늘면 문서가 먼저 빨개진다.
  - **남은 사실**: 이것은 **사람의 대조**이지 fail-closed가 아니다. 클라우드 경로에 진짜 관문을
    세우려면 `eas.json` 밖의 수단(예: 제출 전 원격에서 도는 점검 단계)이 필요하고, 그것은 코드가
    아니라 **런북의 일**이다 — 이 절 끝의 `.env.production` 공백과 같은 성질이다.
- **드리프트 가드의 세 번째 방향(`scripts/check-env.ts`).** 종전 가드는 **카탈로그 ↔ `.env.example`
  양방향만** 봤고 소스는 한 번도 읽지 않았다 — 그래서 "코드가 읽는데 어느 쪽에도 없는 키"는 어디에서도
  보이지 않았다(오늘 그런 키가 둘이었다: `EXPO_PUBLIC_SUPPORT_URL`·`EXPO_PUBLIC_FAQ_URL` — 라운드 71 D).
  이제 `apps/mobile/{app,src}`가 읽는 `process.env.EXPO_PUBLIC_*` **전수(오늘 11키)** 가 카탈로그나
  `INTENTIONALLY_UNCATALOGUED`에 있어야 한다. `EXPO_PUBLIC_*`만 보는 이유는 그 접두사만이 "빌드에
  주입되지 않으면 앱이 **조용히** 다른 것을 한다"는 성질을 갖기 때문이다(서버 키의 미주입은 부팅·요청
  실패로 드러난다). 사각에 있던 둘은 카탈로그와 `.env.example`(빈 값 + 주석)로 옮겼다.
- **배포가 만드는 파일도 침묵하지 않는다.** `scripts/deploy/oracle-bootstrap.sh`의
  `.env.production` heredoc이 `LINK_HEALTH_ENABLED=0`·`PUSH_ENABLED=0`을 **값과 이유와 함께** 적는다.
  ⚠️ **값을 바꾼 것이 아니라 침묵을 명시로 바꾼 것**이다(켜는 것은 별도 제품 결정 — 외부 네트워크 잡
  · 쿠팡/네이버 호출). 기존 파일 덮어쓰기 금지 가드(`if [ ! -f ]`)도 그대로다.
- **남은 사실(다음 결정의 입력)**: 그 `.env.production`을 **게이트가 보지는 않는다.** `check:env`는
  `process.env`를, `check:env:example`은 `.env.example`을 본다 — 스크립트에 `--file` 인자가 있으므로
  `tsx scripts/check-env.ts --file .env.production`은 가능하지만, **그 경로를 부르는 게이트 단계가
  저장소에 0건**이다. 서버에서 만들어지는 파일을 CI가 읽을 수 없다는 것이 그 공백의 이유이고,
  메우려면 "배포 후 원격에서 한 번 돌린다"는 **운영 절차**가 필요하다(코드가 아니라 런북의 일이다).

### N-2. **앱 밖 공개 표면은 넷이고, 브랜드 값의 단일 소스는 한 자리다** — 오늘 팔레트가 네 벌이었다는 사실

- **왜 이 목록이 필요했나.** 이 저장소의 규율("확인하고 말한다" · "지어내지 않는다" · "정직한 부재")은
  앱 안에서 성숙했는데 **앱 경계에서 멈췄다.** 72라운드 동안 **스윕 단위가 된 적 없는 표면**이 셋
  있었고(설치 **전** 접점 · 앱 **없이** 보는 접점 · 그 빌드를 만드는 파이프라인), 오늘 재어 보니
  **팔레트가 네 벌**이었다:
  - 앱 **`#C94627`**(DNC-017 v0.5 승인값) · 스토어 자산 **`#DB4F2E`**(어느 시점의 토큰도 아니다) ·
    API 공개 HTML **`#FF7A59`**(어느 시점의 토큰도 아니다) · 정적 사이트/법적 문서 **`#FF8A7A`**
    (v0.5가 "이전 값"으로 명시한 드리프트 팔레트). 배경도 같은 방식으로 갈려 있었다
    (`#FFFDFC` / `#FFF8F1` / `#FFF8F2`).
  - 결함의 성격이 인앱과 다르다 — 인앱은 "앱이 틀린 말을 한다"였는데 여기는 **"앱 밖이 다른 앱을
    보여 준다"** 다. 초대받은 사람은 초대 랜딩(주황 A) → 스토어(주황 B) → 앱(주황 C)을 차례로 본다.
- **오늘의 단일 소스는 `docs/brand/brand-tokens.json`이다**(BRAND-001, 트랙 B 신설). 언어가 TS·CSS·
  HTML·Python·문서로 갈려 **런타임 공유가 불가능**하므로, 단일 소스의 형태는 "한 자리에 적힌 값 +
  그 값과의 일치를 묻는 계약"이다(`packages/test-utils/src/store-brand-and-asset-provenance.test.ts` ·
  `public-surface-brand.test.ts`). 그 파일은 값을 **새로 정하지 않는다** — DNC-017 v0.5가 잠근 셋
  (`#C94627`·`#267A68`·`#FFFDFC`)과 그 값이 실제로 사는 자리(`apps/mobile/src/theme.ts`)를 기계가
  읽을 수 있게 옮겨 적을 뿐이고, 값을 바꾸려면 **DNC 절차대로 `do-not-change.md`를 먼저 고친다**.
  폐기값 **여덟**과 "물어도 되는 자리 / 물으면 안 되는 자리"(`retiredSweepScope`)도 같은 파일이 진다.
- **앱 밖 공개 표면은 넷이다**(트랙 C가 v0.5로 옮긴 그 넷): ① 정적 지원 사이트(`infra/site/site.css`) ·
  ② 법적 문서 셋(`infra/legal/{terms-of-service,privacy-policy,account-deletion}.html`) ·
  ③ **공유된 구매 링크가 죽었을 때 떨어지는 페이지**(`items-commerce/redirect.controller.ts` —
  핵심 루프 4단계의 실패 표면) · ④ **가족 초대 랜딩**(`households/invite-landing.controller.ts` —
  초대받은 사람이 앱을 깔기 전에 보는 유일한 화면).
  - ⚠️ **바뀐 것은 `<style>` 블록의 색 리터럴뿐이다**: 404 · `Vary: Accept` · `Cache-Control: no-store` ·
    `X-Frame-Options: DENY` · **링크 `<a>` 0건** · 초대 랜딩의 200·오라클 없음·헤더 셋 · 법적 문서의
    본문·placeholder·보존 창 문구는 **바이트 불변**이다.
  - **초대 랜딩 `.cta`의 대비가 AA를 넘었다**: 흰 텍스트가 `#FF7A59` 위에서 **2.57:1**(AA 미달)이었고
    `#C94627` 위에서 **4.78:1**이다. 승인 팔레트로 가는 것이 대비를 **고치는** 방향이었다.
  - `site.css:3`의 **거짓 인용**도 사라졌다 — 그 줄은 `#FF8A7A`/`#FFF8F1`을 적으면서 근거로 DNC-017을
    인용했는데, v0.5가 **바로 그 두 값을 갈아 끼운 개정**이다. 지금은 값과 개정 근거와 단일 소스를 적는다.
- ⚠️ **스토어 자산은 지금의 앱이 아니다 — 그리고 그것이 제출 차단이다.** 스크린샷 3장의 원본
  (`docs/store/assets/sources/`)은 지배색이 `#FF6B52`/`#FFF8F1`인 **DSN-053(2026-08-27) 이전 빌드**의
  캡처이고(파일 mtime 2026-08-21), 512 아이콘·피처 그래픽은 생성기 상수에서 온 `#DB4F2E`/`#FFF8F1`이다.
  이제 각 캡처의 출처는 `screenshot-manifest.json`의 **`capturedFrom`** 칸이 지고(오늘 셋 다
  `"lineage": "pre-DSN-053"`), 생성기는 **미선언·구세대 캡처의 합성을 거부**한다(명시 opt-out으로만 통과하고
  그때도 "스토어에 올리지 마세요"를 출력한다). **재캡처는 손그림이 아니라 기기 캡처 파이프라인
  (`scripts/pixel-lock/**`)의 산출물에서 온다** — 절차는 `docs/store/submission-checklist.md` §0.1,
  자산별 현황은 `docs/store/play-listing.md` §6, 실기기 몫은 `runtime-verification-required.md` §1-1 #103이다.
- ✅ **`docs/store/play-listing.md` §5 머리말의 §6 모순 — 해소됨 (2026-08-29 후속).**
  종전 §5 머리말은 그 3장을 두고 "**최소 요건(2장)을 이미 충족**하므로 **이대로 제출 가능**"이라고
  적었는데, 같은 문서 §6은 같은 자산 셋을 **⛔ 재캡처/재생성 전 제출 불가**로 판정했다. 사실은 §6
  쪽이다 — "자산이 **존재**한다"와 "자산이 **지금의 앱**이다"는 다른 이야기이고, §5의 그 문장은 앞의
  것만 세고 있었다.
  - **왜 라운드 73 본편이 고치지 못했나**: 트랙 B의 계약이 **§1~5 무변경을 부정 단언으로 고정**해
    두어서(`store-brand-and-asset-provenance.test.ts`), §5를 고치면 계약이 빨개졌다 — **부정 단언이
    정정을 막고 있던** 자리다. 그 계약이 지키려던 것은 "등록 정보 **문안**이 트랙 B에 딸려 바뀌지
    않는다"이지 "상태 표기가 §6과 어긋난 채로 남는다"가 아니었다.
  - **이번에 한 것**: ① §5 머리말을 사실 문장으로 바꿨다 — 장수·규격은 최소 요건을 넘지만 제출 가능
    여부는 **계보 판정**이고 오늘 그 판정은 ⛔이며, 현황은 §6 · 해제 절차는
    `docs/store/submission-checklist.md` §0.1이 진다(§5는 스스로 판정하지 않고 **가리키기만** 한다).
    ② 부정 단언을 그 원래 뜻으로 좁혔다 — **§1~4 문안**에는 트랙 B의 토큰(`brand-tokens.json` ·
    `capturedFrom` · "제출 불가" · "DNC-017 v0.5")이 0건이고, **§5는 촬영 가이드 본문이 그대로이면서
    §6·§0.1을 가리키고 "이대로 제출 가능"이 없다**를 각각 묻는다. 범위 이탈은 여전히 잡히고, 정정은
    더 이상 막히지 않는다.
  - **교훈(다음 결정의 입력)**: 무접촉을 지키는 부정 단언은 **무엇의 무접촉인지**까지 좁혀 적어야
    한다. "§1~5 전체"처럼 넓게 잡으면, 그 안에 있는 **거짓 문장까지 함께 고정**되고 다음 라운드는
    그 거짓을 고칠 수 없다.
- **P3(사실만 남긴다 — 이번 라운드의 판정 아님)**
  - **출처 없는 틴트 `#fdeee6`가 둘 있다**: `infra/site/site.css`의 `--badge-bg`와
    `infra/legal/privacy-policy.html`의 표 머리(`th { background: #fdeee6; }`). **폐기값은 아니다**
    (`brand-tokens.json`의 `retired` 여덟 중 어느 것도 아니고, 그래서 트랙 C의 스윕에 걸리지 않았다) —
    다만 **어느 토큰에서 왔는지도 적혀 있지 않다.** 승인 팔레트에서 파생시킬지, 그대로 둘지는 값이
    아니라 디자인 판단이라 이번 라운드가 정하지 않았다.
  - **어드민의 색도 승인 팔레트가 아니다**(`#FFF8F1` 등). **내부 도구이고 사용자 접점이 아니므로**
    스윕 범위 밖이다(`retiredSweepScope.exempt`에 이유와 함께 적혀 있다).
  - `docs/ui-pixel-lock/**`와 `docs/store/assets/**`에 옛 값이 **적혀 있는 것이 사실**이다(전자는 승인
    계보의 기준, 후자는 재캡처 전 현황) — 두 자리 다 스윕 면제이고, 면제 이유가 값으로 남아 있다.

### N-3. **어드민의 판정은 있었다 — 없던 것은 그 판정을 소비하는 목록이다**

- **사실**: `apps/admin/src/lib/admin-api.ts`의 `request()`는 실패마다 **구체적인 한국어 문장**을
  만든다(읽기 타임아웃 10초 · 네트워크 실패 · 서버가 준 문장). 그런데 라운드 73 전에는 조회 실패
  **열다섯 자리 중 열**이 그 문장을 통째로 버리고 `"…를 불러오지 못했어요."` 한 문장으로 수렴했고,
  그 아래에는 예외 없이 [다시 시도]가 섰다. 형제 넷(카테고리 · 감사 로그 둘 · 사용자 조회)은 이미
  `isTimeoutError`로 갈리고 있었으므로, **한 앱 안에서 같은 실패가 화면마다 다른 등급으로** 말해졌다.
  판정이 없어서가 아니라 **화면이 그 판정을 읽지 않아서**다.
- **오늘의 소비 집합은 열다섯이다**(`LOAD_ERROR_COPY_SITES`, `apps/admin/src/lib/load-error-copy.ts` —
  대시보드 2 · 준비템 2 · 검토 2 · 감사 로그 2 · 링크·클릭·분석·고지·사용자·카테고리·사용자 조회 각 1).
  `src/admin-load-error-copy.test.ts`가 `app/**`을 훑어 이 표와 **정확히 일치**하는지 본다.
  **모바일이 라운드 38~72에 걸쳐 배운 형식**("판정은 한 벌, 문구는 화면별, 그리고 목록이 그 소비를
  센다")이 어드민에 도착한 것이다.
  - ⚠️ **그 스윕이 보장하는 범위**(2026-08-29 후속 정정 — L-2 종결 블록의 같은 정정과 한 쌍이다):
    잡는 것은 **목록 ↔ 사용 집합의 불일치**다(부르는데 목록에 없다 · 목록에 있는데 안 부른다 ·
    자리 수가 달라졌다). **새 조회 화면이 그 한 벌을 아예 부르지 않고 자기 문장을 손으로 적으면
    사용 집합에도 목록에도 없어 통과한다** — 새 리터럴을 감지하는 단언이 아니다. 종전 이 자리에
    적혀 있던 "새 조회 화면이 한 벌을 부르지 않으면 먼저 빨개진다"는 그 점에서 과장이었다.
- **네 갈래이고, 새 문구는 0건이다**: 타임아웃 → `admin-api.ts`의 그 문장 · 네트워크 실패 → 그 문장 ·
  서버가 문장을 줬으면 **서버 문장** · 그 밖이면 **종전 화면별 기본문장 그대로**. `load-error-copy.ts`
  안에는 한국어 문자열 리터럴이 **하나도 없다**(부정 단언). **401은 이 모듈에 닿지 않는다** — 모든
  화면의 첫 갈래가 `isAuthError → clearSession()`이고 그 앞에는 아무것도 끼우지 않았다. **쓰기 실패
  문구도 무접촉**이다(R19-F의 "재시도를 권하지 않는다" 판정 — 이 트랙은 **조회**만이다).
- **[다시 시도]는 이제 `AdminApiError.status`에서 파생된다**: status 0(네트워크·타임아웃) · 5xx ·
  408/425/429에만 서고, 그 밖의 4xx(400·403·404·409·422 …)에는 서지 않는다(다시 눌러도 같은 답이 온다).
  `AdminApiError`가 아닌 모르는 실패에는 한 번 더가 답일 수 있으므로 버튼이 남는다.
- ⚠️ **예외는 하나이고 값으로 남아 있다**(`LOAD_ERROR_COPY_EXEMPT_SITES`): 검토 화면의 **워커 상태
  조회**는 실패해도 아무 말도 하지 않는다 — 꺼졌는지 멈췄는지 **모르는** 상태에서 예약 폼 위에 문장을
  세우면 그것이 곧 허위 표시다(대시보드는 그 조회를 사용자에게 보여 주는 자리라 실패를 말한다).
- **예약 게시는 말하되 막지 않는다.** 검토 화면이 `getWorkerHealth()`를 실제로 부르고, 상태가
  `off`·`stale`일 때만 예약 폼 위에 사실 한 줄을 세운다 — 문장은 `workerHealthStateNote()`가 이미 가진
  것을 **그대로** 읽는다(새 문구 0건). `degraded`는 그 목록에 **없다**: 실패 중인 잡이 링크 검사일 수
  있고 그때 예약 게시는 정상 실행되므로, 확인되지 않은 것을 예약 폼 위에서 단정하지 않는다.
  - ⚠️ **막지 않는 이유**: 워커는 켜질 수 있고, 켜지면 밀린 예약이 **실제로 처리된다**
    (`content-revisions.service.ts`). 막는 것이 아니라 **말하는 것**이 이 자리의 판정이다.
  - **지난 예약 표시**(`scheduledFor < now && status === "in_review"`)도 같은 규율이다 — 확실한 사실은
    "아직 게시되지 않았다" 하나뿐이라 그것만 적는다("지난 예약 · 아직 게시되지 않았어요"). "영영 안
    나간다"고 말하지 않는 이유는 서버가 다시 켜지면 늦게라도 처리하기 때문이다.
- **서버는 0건이다**(`apps/api/src/admin/**` · `content-revisions.service.ts` 무접촉 · 마이그레이션 0건).
  바뀐 것은 그 값을 **누가 읽는가**뿐이고, `admin-e2e.mjs`의 **17스텝 앵커**는 계약으로 고정됐다.

### N-4. **실측해서 기각한 두 축 — 성능·용량과 테스트 인프라의 오늘 수치**

다음 라운드가 같은 축을 다시 파지 않도록 **오늘의 수치**를 남긴다. 둘 다 모회의 제안 축이었고,
재어 보니 **문턱을 넘는 것이 없었다**. 이 저장소의 부채는 성능이 아니라 **경계**에 쌓여 있다.

- **성능·용량 (2026-08-29 실측 · 제안하지 않음)**
  - **DB**: 마이그레이션 21개 중 넷이 성능 전용(`000011_perf_indexes` · `000014_perf_round15` ·
    `000017_expenses_list_keyset_idx` · `000021_admin_sessions_revoked_at_idx`), `schema.prisma`의
    `@@index`/`@@unique`가 **61개**. 핵심 루프의 집계는 전부 `groupBy` 한 방이고
    (`reporting-store.service.ts` — 이 파일 전체의 DB 왕복이 **넷**).
  - **N+1**: `for` 루프 안의 `await` 전수 확인. 항목 수에 비례하는 유일한 자리는
    `onboarding-core.service.ts`의 `setPreparedItems`(`childItemStatus.upsert`)인데 상한이
    **카탈로그 62건**이고 한 트랜잭션 안이라 문턱 아래다.
  - **번들**: `apps/mobile/assets` 전체가 **1.1MB**(라운드 61이 4.1MB 잔재를 걷은 뒤 값)이고,
    참조 0건 자산은 `assets/illustrations/logo_lockup.png` **하나(8.2KB)** 뿐이다.
  - **어드민 목록 전량 조회**는 라운드 67이 이미 문턱(500건)과 현재값을 값으로 적었고, 오늘도 카탈로그는
    **62건**이다 — **상태 변화 없음**.
- **테스트 인프라 (2026-08-29 구조 실측 · 제안하지 않음)**
  - 테스트 파일 수: **api 78 · mobile 236 · admin 31 · domain 9 · contracts 3.**
    `apps/api/vitest.config.ts`는 워커 폭 상한 · `sequence.hooks: "stack"` · 배타 락의 근거를 **실측
    수치와 함께** 이미 적고 있고(라운드 30·61), 모바일에는 vitest 설정 파일이 아예 없다(기본값).
  - ⚠️ **값으로 남기는 관측 하나**: **모바일 테스트 236개 중 179개가 소스 파일을 읽는다**
    (`readFileSync`/`readdirSync`). 이 저장소가 가장 잘 쓰는 형식이고 이번 라운드의 계약 다섯도 그
    형식이지만, 그 비율은 "테스트가 **행동**이 아니라 **소스의 모양**을 본다"는 뜻이기도 하다.
    **판정이 아니라 관측**이다 — 다만 이 비율이 계속 오르면 그 성질이 굳는다.
- ⚠️ **기각의 뜻**: "재지 않았다"가 아니라 **"재었고 문턱을 넘지 않았다"** 이다. 다시 제안하려면 이
  수치들이 달라졌다는 **새 실측**이 먼저 있어야 한다(실측 없는 제안은 하지 않는다).
