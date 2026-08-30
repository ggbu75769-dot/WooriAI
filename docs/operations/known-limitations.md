# 알려진 한계 (Known Limitations)

갱신: 2026-08-30 (라운드 79 트랙 F — **T절 신설**(판정 다섯: 정확해진 문장이 소리로는 오지 않았다 · 같은 함수, 다른 입력 · L-1의 답은 "통합하지 않는다" · S-2의 나머지 절반 · 파서를 합치기 전에 오늘의 답이 같은지부터 묻는다) · **L-1 종결**(세 라운드 이월된 질문에 답이 났고 그물이 섰다) · S-3 갱신(⚠️ **전제 정정** — `<select>`는 활성이어도 드래그 복사가 되지 않으므로 `disabled`가 앗는 것은 **복사가 아니라 도달**이다. 브라우저 확인이 선행이라 **보류**) · S-5 갱신(`clickLink` 주석의 사유 정정 · **35 / 28**) · S-2·S-4 각 한 줄) · 그 앞: 2026-08-30 (라운드 78 트랙 F — **S절 신설**) · 그 앞: 2026-08-30 (라운드 77 트랙 F — **R절 신설**) · 그 앞: 2026-08-30 (라운드 76 트랙 F — **Q절 신설**) · 그 앞: 2026-08-30 (라운드 75 트랙 F — **P절 신설**(판정 넷: 탈퇴 계정의 파기 시계 · 우리가 남의 이름으로 한 약속의 단일 소스 · 표가 자기를 세게 됐다 · 관례는 본보기 하나로 남는다) · O-2 한 줄(잔여의 **이유**가 바뀌었다) · L-1 한 줄(여정 파일 목록의 실측 드리프트) · N-3 한 줄(어드민 스윕의 **범위**가 넓어졌다)) · 그 앞: 2026-08-29 (라운드 74 트랙 F — **O절 신설**(판정 넷: 로그에 남겨도 되는 것의 경계 · 준비템 시기 표시의 세 자리 · 인용이 실측을 대신하기 시작했다 · 종결 선언의 조건) · L-2 갱신(배선 열넷 · 옛 리터럴 부정 단언 신설) · N-3 한 줄) · 그 앞: 2026-08-29 (라운드 73 후속 리뷰 — N-1에 클라우드 빌드 경로의 사각 추가 · N-2의 §5 모순 **해소** · L-2 종결/N-3의 스윕 보장 범위 정정 · 줄 번호 앵커를 식별자 인용으로) · 그 앞: 2026-08-29 (라운드 73 트랙 F — N절 신설) · 그 앞: 2026-08-29 (라운드 72 트랙 F — M절 신설 · L-2/L-3 갱신) · 그 앞: 2026-08-29 (라운드 71 트랙 F — L절 신설) · 그 앞: 2026-08-29 (라운드 70 트랙 F — K절 신설) · 그 앞: 2026-08-28 (라운드 57 QA까지 반영) · 브랜치: claude/app-feature-review-design-xx71k3

라운드 5~20에서 해소된 항목은 근거 파일과 함께 "해소됨" 섹션으로 옮겼다. 남은 것은 (A) 외부 계정·키가 필요한 항목, (B) 위험도 낮은 후속 개선, (C) 런타임 재검증, (D) 라운드 13~15에서 확인된 설계 트레이드오프, (E) 라운드 16~18에서 새로 확인된 한계·계약, (F) 라운드 24에서 새로 확인된 한계, (G) 라운드 27~28에서 새로 확인된 동작 계약, (H) 라운드 33에서 확인된 설계 트레이드오프, (I) 라운드 55에서 수용한 위험(앱 잠금·정기 지출), (K) 라운드 70에서 확정한 판정 셋(가족 역할의 실제 범위 · 소유권 이전 부재 · 승인 캡처에 실재하는 문자열 둘), (L) 라운드 71에서 확정한 판정 셋(아웃박스 계약의 그림자 · 오프라인 인지 조회 문구가 멈춘 자리 · 지원·FAQ URL의 정직한 감춤), (M) 라운드 72에서 확정한 판정 셋(온보딩의 서버 의존 경계 · 추천 점수의 배선 상태 · "기록 0건 기간" 화면 셋), (N) 라운드 73에서 확정한 판정 넷(빌드 성격의 경계 · 앱 밖 공개 표면 넷과 브랜드 단일 소스 · 어드민의 판정을 소비하는 목록 · 실측해서 기각한 두 축), (O) 라운드 74에서 확정한 판정 넷(로그에 남겨도 되는 것의 경계 · 준비템 시기 표시의 세 자리 · 인용이 실측을 대신하기 시작했다 · 종결 선언의 조건), (P) 라운드 75에서 확정한 판정 넷(탈퇴 계정의 파기 시계와 방향이 뒤집힌 주석 · 우리가 남의 이름으로 한 약속의 단일 소스 · 표가 자기를 세게 됐다 · 관례는 본보기 하나로 남는다), (Q) 라운드 76에서 확정한 판정 다섯, (R) 라운드 77에서 확정한 판정 여섯, (S) 라운드 78에서 확정한 판정 다섯, (T) 라운드 79에서 확정한 판정 다섯(정확해진 문장이 소리로는 오지 않았다 · 같은 함수, 다른 입력 · L-1의 답은 "통합하지 않는다" · S-2의 나머지 절반 · 파서를 합치기 전에 오늘의 답이 같은지부터 묻는다), (U) 라운드 80에서 확정한 판정 다섯(그물의 모집단이 잘못된 단위였다 · 이름이 낭독인 계약이 아홉 라운드 동안 가시성만 물었다 · 게이트는 지연이 아니라 정지였다 · 응답을 기다리는 것과 화면을 기다리는 것은 다르다 · 라우트 표면에는 80라운드 동안 그물이 없었다)이다(J는 라운드 65의 감사 공백이 라운드 66에서 해소된 기록이다). 각 항목은 코드 상 근거 경로를 병기한다.

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
- ⚠️ **갱신 (2026-08-30 · 라운드 75 정찰 실측) — 그 손 목록이 오늘 드리프트를 하나 갖고 있다.**
  `src/import/import-failure-messages.test.ts`의 `IMPORT_JOURNEY_SERVER_FILES`는 서버 파일 **둘**
  (`imports/import-parser.ts` · `onboarding/import-pipeline.service.ts`)을 손으로 드는데, 그 여정에는
  **셋째 파일이 있다** — `apps/api/src/imports/imports.controller.ts`가 `IMPORT_FILE_TYPE_INVALID`를
  던진다. ⚠️ **오늘 사용자에게는 아무 일도 일어나지 않는다**(그 코드는 라운드 45가 업로드 화면을
  위해 이미 표에 세워 둔 값이다). 위험한 것은 다음이다: **그 컨트롤러에 새 코드가 하나 들어오면
  스윕은 초록인 채로 그것을 놓친다** — 목록이 파일 단위라 목록 밖 파일은 구조적으로 보이지 않는다
  (O-4가 이름 붙인 그 모양이 파일 목록 층에서 다시 난 것이다). **라운드 75의 어느 트랙도 이 파일을
  열지 않았다 — 보류다.** 다만 이 절이 남긴 질문("여정 목록을 만들지, 발견할 때마다 세울지")의
  **중간 크기 답 하나**가 오늘 값으로 보인다: 여정 목록을 정의하지 않고도, **여정의 파일 목록이 그
  여정의 컨트롤러를 빠뜨리지 않았는지**는 물을 수 있다.
- ⚠️ **갱신 (2026-08-30 · 라운드 76 트랙 C) — 그 중간 크기 답이 오늘 계약이 됐다. 큰 질문은 남는다.**
  `IMPORT_JOURNEY_SERVER_FILES`는 이제 **손 목록이 아니라 파생 계약을 지난다**:
  `apps/api/src/**/*.controller.ts` **서른둘**(하한 단언 ≥30이 앞에 선다 — 정규식이 조용히 0건이 되면
  이 계약도 함께 죽는다)을 훑어 **여정 파일을 import하는 컨트롤러**를 뽑고, 그 집합이 목록에
  포함되거나 **이유와 함께 제외**돼야 한다. 오늘 답은 정확히 하나이고(`imports/imports.controller.ts` —
  `import-pipeline.service`에서 `ImportPipelineService`·`IMPORT_MAX_FILE_SIZE_BYTES`를 든다) 그 하나가
  목록에 편입돼 **둘 → 셋**이 됐다. ⚠️ **문구 0건 · 서버 0건 · 표 0건**(그 컨트롤러가 오늘 던지는
  `IMPORT_FILE_TYPE_INVALID`는 이미 제외 목록에 이유가 있어 다른 단언은 전부 초록 그대로다 — 코드
  스윕 하한 ≥10도 움직이지 않았다). **바뀐 것은 값이 아니라 목록이 무엇에서 파생되는가다.**
  ⚠️ **형제 스윕에는 이 모양이 서지 않는다**(`src/settings/destructive-flow-messages.test.ts`의 단위는
  **메서드**이고 `src/api/api-error.test.ts`의 단위는 **아웃박스 파일**이다 — 컨트롤러 파생이 그
  단위에 맞지 않는다는 사실을 그 자리에 주석 한 줄로 남겼다). ⚠️ **그리고 이 절이 남긴 큰 질문은
  닫히지 않았다**: 저장소에 **여정 목록은 여전히 없고**, "이 저장소에 즉시 요청 여정이 몇 개인가"에
  오늘도 답이 없다. 오늘 닫힌 것은 *한 여정의 파일 목록이 자기 컨트롤러를 빠뜨리는가*이고, 그것은
  **여정을 정의하지 않고도 물을 수 있는 질문이었다**는 사실이 이 갱신이 남기는 값이다.
- ⚠️ **갱신 (2026-08-30 · 라운드 77) — 큰 질문은 그대로이고, 이번에는 그 여정에 *목록 없이* 답했다.**
  실측: 저장소에서 여정 단위의 서버 파일 목록을 가진 것은 오늘도 **하나뿐**이다
  (`IMPORT_JOURNEY_SERVER_FILES` — 라운드 76 C 이후 **셋**). **커머스 여정에는 그런 목록이 없고,
  이번 라운드도 신설하지 않았다.** ⚠️ **그런데 트랙 A가 그 여정의 실패 문구를 정직하게 만들었다** —
  서버가 코드로 말한 두 실패를 **앱 전역 표**에 편입하는 방식이라, **여정을 정의하지 않고도** 답이
  났다(라운드 76 Q-3이 이름 붙인 그 구분의 두 번째 사례다). **여정 목록 신설은 이번에도 별도 결정**
  이고, 그 결정을 미룬 채로도 답할 수 있는 질문이 하나 더 있었다는 사실이 이 갱신의 값이다.
- ⚠️ **갱신 (2026-08-30 · 라운드 78 트랙 A) — 두 번째 여정 목록이 섰고, 큰 질문의 절반이 답을 얻었다.**
  실측: 저장소에서 여정 단위의 서버 파일 목록을 가진 것은 라운드 77까지 **하나뿐**이었고
  (`IMPORT_JOURNEY_SERVER_FILES` — 셋. 아웃박스 스윕의 `outboxPathFiles` 넷은 여정이 아니라 **큐의
  단위**다), 이번 라운드에 **둘**이 됐다 — `CHILD_PROFILE_JOURNEY_SERVER_FILES`(아이 프로필 여정 —
  `onboarding-core.service.ts` · `child-access.service.ts` · 코드 **10** 전수 · **이유가 적힌 제외 넷**).
  ⚠️ **그런데 이 갱신이 남기는 값은 목록 자체가 아니라 *목록이 필요한지 묻는 기준*이다**:
  **"그 여정의 화면이 서버 코드를 읽는 경로를 갖고 있는가."** 갖고 있는데 스윕이 없으면 **표가 자라도
  그 여정만 조용하고**(S-1의 아이 프로필 여정 — 표에 이미 있던 코드조차 설 수 없었다), 경로가 아예
  없으면 **목록보다 경로가 먼저**다(라운드 71 L-1 ⓑ의 개인정보 여정이 그 모양이었다). **여정을 정의하지
  않고도 물을 수 있는 질문이 하나 더 늘었고, 큰 질문("이 저장소에 즉시 요청 여정이 몇 개인가")은 이번에도
  닫히지 않는다.** ⚠️ **남은 여정 넷**(가족 · 동기화/오프라인 · 설정/파기 · 인증)**은 이번에도 목록을
  신설하지 않았다** — 다만 **가족 여정은 다음 라운드가 물어야 할 질문이 다르다**: 이미 전용 모듈 셋
  (`invite-permissions.ts` · `member-mutation-messages.ts` · `invite-accept-messages.ts`)이 코드를 읽고
  있어, *"목록이 없다"* 가 아니라 ***"세 모듈이 같은 표를 같은 순서로 읽는가"*** 다.
- ⚠️⚠️ **종결 (2026-08-30 · 라운드 79 트랙 C) — 세 라운드 이월된 그 질문에 답이 났고, 답은 "통합하지
  않는다"였다. 그리고 그물이 섰다.** ⚠️ **모듈은 셋이 아니라 넷이고, 넷 다 다른 표를 든다** —
  `resolveSaveErrorCopy`(공용 표) · `memberMutationErrorMessage`(자기 표 넷) ·
  `inviteCreateErrorMessage`(훅을 지난 표) · `invite-accept-messages`(코드 목록 둘). **그 분리에는 각각
  이유가 있다**(서버 원문이 영어다 · 이 화면 맥락에서만 뜻이 통한다 · 무인증 공개 조회라 가르면 앱이
  **존재 오라클**이 된다 · 훅의 답을 받는다). ⚠️ **없던 것은 표의 통합이 아니라 그물이었다** —
  `FAMILY_JOURNEY_SERVER_FILES`가 **세 번째 여정 스윕**으로 서서 서버 파일 둘의 4xx 코드 **일곱**이
  **네 출구의 합집합**(공용 표 둘 · 자기 표 넷 · 코드 목록 둘 · 이유가 적힌 제외 하나)을 정확히 덮는지
  묻는다. ⚠️ **네 출구를 명시하는 것이 이 스윕의 본체다** — 앞의 두 스윕은 출구가 하나·둘이라 적을 것이
  없었고, 적지 않으면 다음 라운드가 *"표에 없다"* 를 결함으로 읽는다. 판정 순서 넷도 파생 단언으로
  못박혔고, `inviteCreateErrorMessage`의 `isOnline`이 **훅의 답에서 파생한 값**이라는 사실(오프라인이
  앞이어도 되는 유일한 근거)은 화면 소스로 확인된다 — 독립 폴로 바뀌는 날 빨개진다.
  ⚠️ **종결은 그 종결을 세는 목록이 그것을 세고 있을 때만 종결이다**(O-4) — 이 종결을 세는 것은
  **스윕 자신**이고(제외 코드를 서버가 실제로 던지는지 · 네 출구가 실재하는지 · 관문 파일이 목록에 있는지를
  매번 다시 묻는다), 그래서 이 줄은 산문이 아니라 **계약 위에** 선다. 오늘의 판정은 아래 **T-3**이 진다.
  ⚠️ **큰 질문("이 저장소에 즉시 요청 여정이 몇 개인가")은 이번에도 닫히지 않는다** — 여정 목록은 이제
  **셋**이고(가져오기 · 아이 프로필 · 가족), **남은 여정 셋**(동기화/오프라인 · 설정/파기 · 인증)은
  목록을 신설하지 않았다.

### L-2. 오프라인 인지 조회 문구는 **일곱 화면**에서 멈춰 있다 — 남은 다섯은 다음 라운드 한 트랙 (→ **2026-08-29 라운드 72 트랙 B에서 열로**, 이어 **라운드 73 트랙 E에서 열하나 · P3 0으로 종결**, 그리고 **라운드 74 트랙 D에서 열넷 — 그 "종결" 뒤에 남아 있던 화면 셋 · 자리 일곱**, 아래 세 갱신 블록)

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

#### L-2 갱신 (2026-08-29 · 라운드 74 트랙 D / GAP-074 #4) — **"P3 0" 뒤에 일곱 자리가 살아 있었고, 이제 그것을 세는 단언이 있다**

- **오늘의 값: 배선 열넷 · 카드가 아닌 자리 여섯 · 조회 제외 하나(값) · 저장 배선 넷 ·
  저장 제외 0(빈 목록이 값이다) · 산문에만 있던 제외 0건.**
  `OFFLINE_AWARE_LOAD_ERROR_SCREENS`는 **열넷**이다(종전 열하나 + `app/expenses/[expenseId].tsx` ·
  `app/settings/privacy.tsx` · `app/import/[importJobId].tsx`). 세 화면이 나눠 갖는 자리는 **일곱**이다 —
  지출 상세의 실패 카드 하나 · 개인정보 화면의 **넷**(동의 내역 조회 + 파기 미리보기 셋: 아이 삭제 ·
  가구 탈퇴 · 계정 삭제) · 검수 화면의 **둘**(잡 조회 · 행 목록 조회).
- ⚠️ **새로 선 것은 반대 방향의 단언이다 — 옛 리터럴 부정 단언 스윕**
  (`src/offline/messages.test.ts`, 라운드 74 트랙 D). 종전 두 스윕은 **훅을 부르는 화면**을 세었고,
  그래서 위 종결 블록이 스스로 적어 둔 사각("새 화면이 공용 훅을 아예 부르지 않고 자기 문장을
  손으로 적으면 **양쪽이 일치한 채 통과한다**")이 그대로 열려 있었다. 새 스윕이 묻는 것은 그
  반대다: **`app/**`에 옛 실패 리터럴이 살아 있는 화면은 배선 목록이나 제외 목록에 예외 없이
  이름이 있을 것.** 조회·저장 **양쪽에 같은 형태**로 선다(라운드 73 N-3이 지목한 그 대칭이고,
  그래서 저장 쪽 제외 목록 `OFFLINE_AWARE_SAVE_ERROR_EXEMPT_SCREENS`도 함께 생겼다 —
  오늘 그 목록은 비어 있고, **비어 있다는 것 자체가 스윕이 세어 본 값**이다).
  - **바늘은 손으로 적지 않는다** — 공용 상수의 앞 문장에서 파생한다(`LOAD_ERROR_NOTICE` →
    "불러오지 못했어요" · `SAVE_ERROR_NOTICE` → "저장하지 못했어요"). 그래서 주어가 앞에 붙은
    변형("기기 목록을 …" · "초대 정보를 …")도 같은 그물에 걸리고, 문구가 바뀌면 세는 대상이
    함께 따라간다. 화면 **주석의 인용**은 걷어내고 본다(이 저장소의 화면 주석은 자기가 무엇을
    고쳤는지 설명하려고 옛 문장을 인용한다).
  - **스윕 자신이 찢어져 있어도 통과하지 않게** 바늘·주석 제거·비어 있지 않음을 값으로 못박았다
    (저장 쪽 답이 오늘 0건이라 필요한 장치다).
- **카드가 아닌 자리는 넷 → 여섯이다**(`OFFLINE_AWARE_LOAD_ERROR_NON_CARD_SCREENS`): 종전 넷
  (`settings/children.tsx` · `settings/index.tsx` · `settings/notifications.tsx` ·
  `family/accept/[token].tsx`)에 `import/[importJobId].tsx`와 `settings/privacy.tsx`가 더해졌다.
  ⚠️ **이 둘은 "한 화면 안에 자리가 여럿"인 첫 항목**이라 이유가 적는 것이 하나 늘었다 — 자리
  모양뿐 아니라 **왜 훅을 자리마다 하나씩 부르는가**(둘·넷은 동시에 화면에 설 수 있고 각자 다른
  요청이라, 한쪽의 연결 판정이 다른 쪽 문장에 얹히면 안 된다 — 라운드 70 리뷰 M-2 · 71 리뷰 S-6).
  - ⚠️ **파기 미리보기 셋에는 [다시 시도] 버튼이 없는데도 배선한다.** 그 자리의 재시도 수단은
    바로 위 [확인] 버튼이고 실패해도 계속 눌린다 — **공용 문장이 가리키는 행동이 그 자리에
    실제로 있다.** 버튼도 더 구체적인 문장도 없어 제외로 남은 온보딩 준비물 한 줄과 갈리는
    지점이 정확히 이것이다(제외의 이유가 "카드가 아니다"가 아니라 "가리킬 행동이 없다"임이
    이번에 값으로 드러났다).
- **제외의 위치가 산문에서 값으로 옮겨졌다.** 종전 두 블록이 "명시적 제외 셋"이라고 적어 온 그
  셋(개인정보 · 검수 · 지출 상세)은 **어느 목록에도 없었다** — 이유는 이 문서의 산문 한 문단에만
  있었고, 산문은 아무 단언도 깨지 않는다. 오늘 그 셋은 **배선**으로 판정됐고, 배선하지 않기로
  한 자리는 **하나**(`app/(onboarding)/prepared-items.tsx`)뿐이며 그 이유는 값으로 목록 안에 있다.
  즉 **이 절이 "제외 셋"이라고 부르던 것은 오늘부로 0이다** — 남은 제외는 값 목록이 세는 하나뿐이다.
- ⚠️ **무접촉으로 남은 자리도 값이다**: `app/import/[importJobId].tsx`의 일괄 선택 중간 실패
  (`IMPORT_BULK_PARTIAL_FAILURE_TEXT`)는 이 트랙의 대상이 **아니다** — 그 자리에 조회 문구를
  돌려 쓰면 "앞부분은 이미 서버에 남아 있다"는 사실을 감춘다(그 경고가 소스에 적혀 있었고,
  트랙이 그것을 지켰다). `app/family/index.tsx`는 이미 단일 소스로 갈리고 있어 결함이 아니며,
  온라인 갈래는 열넷 전부 **종전과 바이트 단위로 같다**.
- **남은 사실(다음 결정의 입력)**: 이 갱신이 닫은 것은 "**옛** 문장을 세는 단언이 없다"이지
  "**새** 문장이 생기면 빨개진다"가 아니다. 오늘의 그물은 오늘의 두 공용 상수에서 파생하므로,
  전혀 다른 어휘로 새 실패 문장을 짓는 화면은 여전히 어느 목록에도 걸리지 않는다. 그 축까지
  잡으려면 "화면이 그리는 실패 문자열은 전부 순수 모듈에서 온다"는 형태의 단언이 필요하고,
  그것은 오늘 저장 쪽에서 **사실이지만**(그래서 저장 제외가 0이다) 계약으로 서 있지는 않다.

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
- ✅ **갱신 (2026-08-29 · 라운드 74 트랙 D) — 이 절이 예고한 그 부정 단언이 섰다.** 위 "그 스윕이
  보장하는 범위" 정정이 *"새 리터럴을 감지하는 단언이 아니다"* 라고 적어 둔 사각을, 모바일 쪽에서
  **옛 리터럴 부정 단언 스윕**이 조회·저장 양방향으로 닫았다(L-2 라운드 74 갱신 블록 —
  옛 실패 리터럴이 살아 있는 `app/**` 화면은 배선 목록이나 제외 목록에 예외 없이 이름이 있어야
  한다). ⚠️ **어드민 쪽에는 아직 그 대칭이 없다** — `LOAD_ERROR_COPY_SITES` 열다섯을 지키는
  스윕은 여전히 목록↔사용 집합의 일치만 보고, `apps/admin/app/**`에 손으로 적은 실패 문장이
  생기면 오늘도 양쪽이 일치한 채 통과한다(라운드 74 트랙 D의 소유는 모바일이었다). 그 앵커
  문자열은 이번 라운드에 **18스텝**으로 갱신됐다(라운드 74 트랙 E — 기존 열일곱의 이름·순서는
  불변이고 새 스텝이 맨 뒤에 붙었다).
- ✅ **갱신 (2026-08-30 · 라운드 75 트랙 D) — 그 사각의 모양은 횟수가 아니라 *범위*였고, 절반이
  닫혔다.** 위 라운드 74 갱신이 *"어드민 쪽에는 아직 그 대칭이 없다"* 고 적은 뒤 재어 보니, 어드민
  스윕(`src/admin-load-error-copy.test.ts`의 `appScreenPaths()`)은 `app/**` **하나만** 걷고 있었다 —
  그래서 `src/**`에 있던 조회 실패 자리 **하나**가 구조적으로 보이지 않았고, 하필 그 자리가
  **새 운영자가 반드시 지나야 하는 MFA 등록 관문**이었다(`src/components/AdminShell.tsx`의
  `MfaSetupScreen`). 거기서는 `loadErrorCopy`의 손 사본이 이유를 버렸고, **[다시 시도]도 없고**
  [등록 완료]는 `!secret`이라 눌리지 않아 남은 조작이 **"다른 계정으로 로그인"(= 로그아웃)뿐**인
  **막다른 화면**이었다(읽기 타임아웃 10초 하나로 갇힌다). 오늘의 값: 스윕 범위는 **`app/**` +
  `src/components/**`** 이고(`src/lib/**`는 화면이 아니라 판정·API 래퍼·세션 컨텍스트 모듈이라
  범위 밖 — **그 이유가 값으로** 있다), `LOAD_ERROR_COPY_SITES`는 **열다섯 → 열여섯**,
  그 자리가 공용 판정과 `canRetry`를 읽는다(⚠️ **종전 폴백 문장 "MFA 등록 정보를 불러오지
  못했어요." 바이트 불변 · 새 한국어 문구 0건** · 401은 열다섯 자리와 같은 **첫 갈래**로 세션을
  정리한다 — 등록 **전** 화면이라 재시도가 아니라 로그인 화면이 답이고, 그래서
  `NO_AUTH_BRANCH_CATCH_SITES`는 `app/page.tsx` 하나 그대로다). ⚠️ **여전히 없는 것**: 어드민에는
  **옛 리터럴 부정 단언**이 아직 없다 — 새 화면이 한 벌을 아예 부르지 않고 자기 문장을 손으로
  적으면 오늘도 목록·사용 집합이 일치한 채 통과한다(모바일은 라운드 74 D가 그 대칭을 세웠다).
  **넓어진 것은 범위이지 단언의 종류가 아니다.** ⚠️ 그리고 이 라운드가 남기는 규율 한 줄:
  **스윕의 범위는 "어디에 코드가 있는가"가 아니라 "어디에 사용자가 있는가"로 정해야 한다** —
  `src/components/**`가 `app/**`보다 덜 중요해 보였을 뿐, 거기 서 있던 것은 어드민 전체의 관문이었다.

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
- ⚠️ **갱신 (2026-08-30 · 라운드 77) — 준비템 탭의 비가상화 렌더를 재었고, 문턱 아래였다.**
  사실: `app/(tabs)/items.tsx`는 `AppScreen`(ScrollView) 안에서 `.map`으로 행을 그린다 — 기록
  탭(SectionList) · 동기화 상태(FlatList) · 엑셀 검수(FlatList)가 PERF-102 이후 옮겨 간 그 구조가
  아니다. **오늘의 상한은 카탈로그 62행**이고(시드 `active: true` 120 = 준비템 62 + 링크 58 —
  라운드 76 이후 **상태 변화 없음**), 화면이 실제로 그리는 것은 밴드·필수도·상태 필터를 지난 뒤라
  그보다 **적다**. PERF-102가 기록 탭을 옮긴 근거는 *"a month of heavy use is hundreds of rows"* 였고
  **여기는 그 문턱이 아니다.** ⚠️ **이 절의 기각 조건("새 실측이 먼저 있어야 한다")을 지켜 재었고
  넘지 않았다고 적는다.** **다시 볼 트리거**: 어드민 카탈로그가 **200건**을 넘거나, **한 밴드의 표시
  행이 100을 넘는** 날.
- ⚠️ **갱신 (2026-08-30 · 라운드 78) — 다시 재었고 이번에도 문턱 아래다. 트리거는 무변경.**
  시드 카탈로그는 라운드 77 이후로도 그대로다: `active: true` **120**(준비템 62 + 링크 58) ·
  `isSponsored: true` 5 · `timingLabel` 63 — **상태 변화 없음**이라 한 밴드의 표시 행은 여전히
  **62 미만**이고, 위 트리거 둘(**카탈로그 200건** · **한 밴드 100행**)은 **발동하지 않았다.**
  ⚠️ **이 절의 기각 조건("새 실측이 먼저 있어야 한다")을 지켜 재었고 넘지 않았다** — 두 라운드 연속이다.

## O. 라운드 74에서 확정한 판정 (2026-08-29 · GAP-074 트랙 F)

라운드 73이 축을 **앱 안에서 앱 밖으로** 옮겼다면, 라운드 74는 한 겹 더 밖으로 나갔다 —
**이 저장소가 남기는 기록**이다. 서버가 남기는 줄(요청 로그) · 카탈로그가 적어 둔 시기(사용자가
매일 읽는 준비템 콘텐츠) · 저장소가 자기 자신을 적은 문서(README·AGENTS·CODEX_START_HERE·런북) ·
앱이 아직 세지 않던 옛 문장. 넷 다 **사람이 읽는 기록**이었고, 넷 다 그날 사실과 달랐다.
K·L·M·N절과 같이 **결함 보고가 아니라 다음 결정의 입력**이며, 넷 다 2026-08-29 소스에서
확인됐다(커밋 b4c473f C · 68cacc5 D · 0fef936 A · f7826c1 B · 3c73cc1 E).

### O-1. **로그에 남겨도 되는 것의 경계** — 필드 집합이 목록이 됐고, 한 스트림에 두 형식이 산다

- **왜 경계를 값으로 정해야 했나.** 요청 로거의 주석은 *"never includes headers, body, query
  params, or **any auth material**"* 을 약속했는데, 그 약속을 **세는 것이 저장소 전체에 0건**
  이었다. 그 사이에 `path: req.path`가 실제 경로를 통째로 적었고, 가족 초대 토큰(48자 hex)이
  URL 경로에 실려 오므로 **평문 토큰이 status 200 = level `info`로 빠짐없이 stdout에 쌓였다.**
  DB에는 sha256 해시만 넣기로 한 값이(`inviteTokenHash`, TTL 7일) 로그로 새어 나간 것이고,
  `x-logging`이 서비스마다 10MB × 3파일을 유지하므로 그 창은 토큰의 7일보다 짧지 않았다.
- **오늘의 필드 집합은 목록이다**(`REQUEST_LOG_FIELDS`, `request-logger.middleware.ts`):
  **`ts` · `level` · `requestId` · `method` · `path` · `status` · `durationMs` · `userId?`
  여덟이고 그 밖의 키는 0건**이다. 주석에만 있던 "pre-approved field set"이 값이 됐고, 그 위에
  세 겹이 걸린다 — 타입 쪽 사본(초과 속성 검사) · 실제 직렬화된 줄의 키 집합 단언 ·
  **목록 밖 키 0건의 부정 단언**(`apps/api/test/request-log-fields.test.ts`).
  ⚠️ **`requestId`·`userId`는 한 글자도 바뀌지 않았다** — `incident-response.md` §초동 2가
  시키는 requestId 추적이 그대로여야 하기 때문이다.
- **비밀값을 담는 경로 매개변수의 전수와, 예외의 이유**(`common/logging/loggable-path.ts`).
  판정 규칙은 **매개변수 이름의 모양** 하나다(`token|secret|password|…|key|code|hash|…`).
  오늘 `apps/api/src/**`의 라우트 매개변수 어휘 중 그 규칙에 걸리는 것은 **셋**이고
  (`:token`·`:code`·`:key` — 나머지는 전부 `…Id` 꼴), 걸린 자리는 예외 없이 두 목록 중 하나에 있다.
  - **가리는 셋**(`MASKED_SECRET_PATHS` — 전부 초대 토큰이다): `/invite/:token`(전역 프리픽스
    **밖**의 공개 랜딩) · `/api/v1/invites/:token`(무인증 조회 — 토큰 자체가 인증이다) ·
    `/api/v1/invites/:token/accept`. 로그에 남는 값은 **라우트 모양 그대로**라 운영자는 여전히
    셋을 서로 다른 줄로 식별한다. ⚠️ **부분 마스킹은 하지 않는다** — 48자 hex의 앞 4자는 같은
    초대의 조회→수락→랜딩을 잇는 상관관계 추적을 그대로 열어 주고, 그 조각으로 운영자가 할 수
    있는 일은 없다.
  - **가리지 않는 둘과 그 이유**(`UNMASKED_SECRET_CANDIDATE_PATHS`): `/api/v1/r/:code`는
    **앱이 사용자에게 공유하라고 내주는 공개 값**이고(카카오톡으로 오가는 값이라 감출 비밀이
    없다) 클릭 추적에서 어느 링크가 눌렸는지 아는 **유일한 키**다 — 가리면 그 로그로 할 수 있는
    일이 사라진다. `/api/v1/admin/disclosures/:key`는 난수가 아니라 **운영이 정한 카탈로그
    이름**(`coupang` 같은 값)이고 이미 감사 로그 봉투에 원문으로 남는다.
  - ⚠️ **판정 규칙을 일부러 과하게 잡았다는 사실도 값이다.** 정찰이 예외로 이름 붙인 것은
    `/r/:code` 하나였고, `:key`는 그 과잉 포착이 데려온 두 번째 줄이다. **규칙을 좁히지 않는
    것이 판정이다** — 빠뜨린 비밀값은 조용한 구멍이지만, 더 걸린 자리는 이유 한 줄이 늘 뿐이다.
- ⚠️ **한 스트림에 두 형식이 산다 — 그리고 `LOG_LEVEL`은 그중 하나만 조인다.** 오늘 서버 stdout에는
  요청 로그의 **JSON 한 줄**(`console.log(JSON.stringify(...))` — 저장소 전체에서 **1자리**)과
  NestJS `Logger`의 **텍스트 + 여러 줄 스택**(`new Logger(...)` **13자리** — 전역 예외 필터 ·
  스케줄러 · 파기 잡 등)이 **섞여 흐른다.** `LOG_LEVEL`은 **요청 로거만** 읽고(Nest `Logger`는
  그 값을 보지 않는다), `NODE_ENV=test`에서는 `LOG_LEVEL`이 명시되지 않는 한 요청 로그가 침묵한다
  (테스트 배터리의 출력을 지키는 장치다 — 이 침묵 규칙과 `LOG_LEVEL` 판정은 이번 라운드에 **무변경**이다).
  - **결과로 남는 운영 사실 하나**: `docker compose logs api`를 JSON 파서에 통째로 넣으면
    **오류 줄이 조용히 빠진다.** 런북이 종전에 *"structured JSON 로그"* 한마디로 뭉갠 것이 바로
    이 자리이고, 라운드 74 트랙 C가 `incident-response.md`를 그 사실로 바꿨다.
  - ⚠️ **형식 통일은 이번 라운드의 판정이 아니다**(P3). 로그 수집 도구 선택과 묶인 결정이라
    코드가 아니라 제품·운영 결정이다. 여기서 한 것은 **그 사실을 정확히 적는 것**까지다.
- **크래시 파이프라인 부재는 기록된 결정이다** — `apps/mobile/src/errors/error-boundary-core.ts`의
  *"no crash pipeline yet — Sentry 추후, grep-able until then"*. 실기기에서 앱이 죽으면 운영자는
  아무것도 모른다. **후보로 올리지 않는 이유**는 외부 서비스 계약이 필요하고 코드가 아니라 제품
  결정이기 때문이다. 다만 릴리즈 런북이 그 부재를 **체크박스**로 갖고 있던 것(체크할 수 없는 칸이
  릴리즈 관문에 서 있던 것)은 라운드 74 트랙 C가 **정직한 부재**로 바꿨다 — 오늘의 오류 추적은
  서버 requestId 로그와 기기 `console.error` 둘뿐이다.
- **남은 사실(다음 결정의 입력)**: 이 판정이 세운 것은 **경로**의 경계다. 감사 로그·워커 로그·
  어드민 쪽은 각자 이미 자기 규율을 갖고 있고(라운드 29의 검색어 마스킹 · 라운드 66의 파일명
  90일 마스킹 · `WorkerStatusService`의 오류 문자열 미노출), 이번 라운드는 그 셋을 **한 글자도
  건드리지 않았다.** 아직 목록이 없는 자리는 **로그의 수명**이다 — 10MB × 3파일이라는 회전 조건이
  "비밀값이 아닌 것들의 보존 기간"으로 판정된 적은 없다.

### O-2. **준비템 시기 표시의 세 자리** — 목록·상세·기본 칩이 각자 다른 것을 본다

- **세 자리와 각자의 입력.** ⓐ **목록**은 `stageCodes`로 고른다(`itemMatchesBand` — 밴드 표는
  모바일 `src/items/stage-bands.ts`와 서버 `items-commerce/stage-bands.ts`가 같은 값이고 그 일치를
  계약이 본다). ⓑ **상세**는 `timingLabel`을 읽어 **사실 줄로 승격**한다
  (`app/items/[itemTemplateId].tsx`의 `productDetailFacts` — "준비 시기: …"). ⓒ **기본 칩**은
  스테이지 코드만 보고 골랐다. **셋의 입력이 다르다는 것이 결함의 뿌리**이고, 그래서 화면 둘이
  같은 품목에 대해 서로 다른 나이를 말할 수 있었다.
- **오늘 어긋나 있던 열 건과 그 정정**(`apps/api/prisma/seed-data.ts` — ⚠️ **`timingLabel`
  문자열만** 바뀌었다):
  - **`"12~24개월"` → `"6~24개월"` 다섯** — `safety_gate`(안전문) · `corner_guards`(모서리/콘센트
    보호) · `push_walker`(걸음마 보조 장난감) · `first_shoes`(첫 걸음마 신발) ·
    `snack_container`(간식 용기/빨대컵). 다섯 다 `stageCodes`에 `infant_7_12`이 있어 **첫돌 이전
    구간**(`6-12개월` 밴드)에 서는데 상세는 12개월부터라고 말했다.
  - **`"24개월 이후"` → `"12개월 이후"` 다섯** — `toddler_dental`(유아 칫솔/치약) ·
    `toddler_tableware`(유아 식기 세트) · `sticker_books`(스티커북/놀이책) ·
    `daycare_kit`(어린이집 준비물) · `toddler_rain_gear`(유아 우비/장화). 다섯 다
    `stageCodes`에 `toddler_1_3`이 있어 `12-24개월` 밴드에 서는데 상세는 아직 1년이 남았다고 말했다.
    - ⚠️ **라운드 74 적대적 리뷰 B-2의 재정정.** 이 다섯은 처음에 `"12~24개월"`로 내려왔는데,
      다섯 다 `kid_4_7`(47~95개월)도 함께 지므로 이번엔 **뒤쪽이 어긋났다** — 네 살 아이의
      부모가 `24개월+` 칩에서 연 상세가 "준비 시기: 12~24개월"이라고 말하는 자리다. 어긋남의
      방향만 뒤집힌 같은 결함이라, 두 칩을 함께 덮는 `"12개월 이후"`로 다시 내렸다.
  - ⚠️ **새 어휘 하나**(`"12개월 이후"`): 앞의 다섯(`"6~24개월"`)은 종전 62건의 사전 안에 있던
    표기지만, 뒤의 다섯은 `12-24개월`·`24개월+` **두 칩에 함께 서므로** 사전 안의 어떤 닫힌
    표기도(앞 칩만) 어떤 늦은 표기도(뒤 칩만) 맞지 않았다. 사전이 이미 쓰는 `"N개월 이후"`
    **꼴을 그대로** 따르는 숫자 하나를 더했고, 그 하나가 최소임을 테스트가 값으로 센다
    (`TIMING_LABEL_VOCABULARY_ROUND74_ADDED` — 길이 1 · 꼴 검사 · 실제 사용 확인).
    품목·필수도·가격·링크·`reasonText`·`skipReasonText`·`safetyNote`는 **한 글자도** 만지지 않았다.
  - **계약은 파생이고 대칭이다**(`apps/api/test/seed-data.test.ts`): ① 라벨이 말하는 개월 구간이
    `stageCodes`가 덮는 구간(**합집합** — 불연속 조합의 빈 구간을 덮은 것으로 세지 않는다)을
    벗어나지 않을 것, ② **뒤 방향** — 품목이 지는 스테이지 하나하나가 라벨과 겹칠 것(라운드 74
    리뷰 B-2가 세운 절. 한 방향만 보던 종전 계약이 위 재정정 대상을 초록으로 통과시켰다),
    ③ 라벨이 자기가 서는 칩 중 하나와는 반드시 겹칠 것. 경계는 `packages/domain`의 스테이지
    정의에서 **읽어 오고**, 개월 수를 테스트가 손으로 다시 적지 않는다. 여기에 한 겹 더 있다:
    라벨이 **시기 칩의 이름을 그대로 말하면** 그 품목이 더 이른 칩에 서 있지 않을 것(구간
    안이어도 틀린 칩을 못 서게 한다). 같은 대칭 계약이 데모 카탈로그에도 선다
    (`apps/mobile/src/items/stage-bands.test.ts` — `local-fixtures.ts`의 라벨 셋).
- ⚠️ **`toddler_1_3`을 밴드 둘이 나눠 갖는 것은 설계다 — 겹칠 때 고르는 것은 나이다.**
  그 스테이지는 도메인상 **13~47개월**인데 밴드 `"12-24개월"`과 `"24개월+"`이 함께 갖는다(서버
  주석이 그 중복의 이유를 적어 두었다: 24개월+ 칩에서도 걸음마기 준비물이 이어 보이게 한다).
  종전에는 **겹칠 때 어느 쪽인지 정할 입력이 없어서** 표에 적힌 `"12-24개월"`이 늘 나왔고,
  생후 30개월 아이의 부모가 받는 그 칩에 라운드 69 C의 정직성 장치가 **`resolved: true`**
  ("아이의 실제 시기에서 나왔다")를 붙였다 — **모름을 정직하게 만든 반환 타입이, 틀린 값을
  사실로 단정하는 자리에서 침묵하고 있었다.**
  - 오늘의 판정: `resolveDefaultStageLabel`이 `birthDate`를 함께 받아(같은 `["children"]` 응답에
    이미 실려 온다 — **새 요청 0건 · 서버 0건**) 겹치는 스테이지에서만 나이로 고른다. 나이를
    모르면 **종전 값 그대로 + `resolved: false`**(라운드 69 C의 갈래를 한 자리 넓힐 뿐이다).
  - ⚠️ **바뀌지 않은 것**: 밴드 라벨 **네 문자열 바이트 불변**(`"0-6개월"`·`"6-12개월"`·
    `"12-24개월"`·`"24개월+"` — ITEM-001 캡처 · `packages/contracts`의 `STAGE_BAND_LABELS` ·
    서버 쿼리 파라미터가 함께 잠근 값이다) · `bandDefinitions`/`STAGE_BAND_STAGES` 표 무변경 ·
    **픽셀락 최우선 게이트 순서 불변**(`isPixelLockMode` → `hasManualSelection` → 나이).
    나이의 경계도 손으로 적지 않는다 — **밴드 라벨 문자열이 스스로 말하는 시작 개월**에서 파생한다.
- ⚠️ **남은 사실: 어드민 CMS의 자유 입력은 계약 밖이다.** 위 계약이 무는 것은 **시드**다.
  `apps/admin/app/items/page.tsx`의 `timingLabel` 편집 필드는 운영자가 어떤 문자열이든 넣을 수
  있고, 그 값을 `stageCodes`와 대조하는 자리는 오늘 **서버·어드민 어디에도 0건**이다. 즉 시드가
  초록이 된 뒤에도 **운영 입력은 그 밖**이다. 막을지는 별도 결정이다(CMS의 자유도를 줄이는
  판단이고, 이번 라운드는 그 판단을 하지 않았다) — 다만 **적어 두지 않으면 다음 라운드가
  "계약이 있으니 안전하다"고 읽는다.**
  - ⚠️ **갱신 (2026-08-30 · 라운드 75 트랙 E/F) — 잔여는 그대로인데 그 잔여의 *이유*가 바뀌었다.**
    종전 이 자리는 *"막을지는 별도 결정"* 이라고 적었다(= 사람이 판단만 하면 되는 자리로 읽힌다).
    오늘 재어 보니 **막고 안 막고 이전에 어드민이 그 판정을 내릴 수 없다** — 대조에 필요한 스테이지
    개월 경계는 `packages/domain`에 있고, `apps/admin`은 그 패키지를 **의존성으로 들지 않는다**
    (dependencies 넷: `next`·`qrcode`·`react`·`react-dom`. 그 제약은 라운드 60 리뷰 P2-8이 근거와
    함께 세운 판정이고 오늘도 성립한다 — P-4). 그러므로 다음 라운드가 이 자리를 열 때 먼저 답할
    것은 **"막을까"가 아니라 "어드민에 도메인 경계를 어떻게 들일까"** 셋 중 하나다: 빌드 설정
    (`transpilePackages` — domain의 `main`이 raw TS다) · 서버가 판정해 응답에 싣기 · 값 미러 +
    대조 테스트(P-4가 아홉 자리에 세운 그 모양). **판정을 이월할 때는 이월의 이유까지 적어야
    한다** — "미결정"과 "의존 구조"는 다음 라운드가 여는 문이 서로 다르다. 서버·어드민 어디에도
    대조가 **0건**이라는 사실 자체는 오늘도 그대로다.
  - ⚠️ **종결 (2026-08-30 · 라운드 76 트랙 E) — 셋 중 "서버"를 열었다. 나머지 둘을 기각한 근거를
    함께 적는다.** ① **빌드 설정(`transpilePackages`)** — `apps/admin`의 dependencies 넷을 늘리는
    일이고(domain의 `main`이 raw TS다), 그 제약이 곧 라운드 60 P2-8이 세운 손 미러 관례의 **근거**라
    뒤집는 것은 별도 판단이다. **기각.** ③ **값 미러 + 대조 테스트** — P-4가 세운 대장이 받아 줄
    모양이긴 한데, 미러해야 하는 것이 문자열 목록이 아니라 **개월 경계 산술**(라벨 구간 ↔ `stageCodes`
    합집합의 겹침)이라 미러가 아니라 **로직 사본**이 된다. **기각.** ② **서버가 판정한다** — 재어 보니
    이 길에는 남은 일이 거의 없었다: `apps/api`는 이미 `@wooriai/domain`을 의존성으로 들고, **판정
    로직이 이미 저장소에 있었다.** 다만 `apps/api/test/seed-data.test.ts` **안에** 있었다
    (`stageNotationRanges`·`parseTimingLabelMonths`) — 그것이 라운드 74 B의 계약이 **시드만** 물던
    구조적 이유다(아래 Q-5). 오늘 그 로직이 `apps/api/src/onboarding/timing-label-range.ts`로 **모듈
    승격**됐고(경계는 종전처럼 `packages/domain`에서 **파생** — 손으로 적은 개월 숫자 0건),
    카탈로그 **생성·수정·게시·검토 초안 네 경로**가 그 판정을 지나 **명백한 모순만** 400
    `ITEM_TIMING_LABEL_MISMATCH`로 거절한다(메시지가 어긋난 구간을 그대로 말한다).
    `seed-data.test.ts`는 지역 사본을 지우고 그 모듈을 import하며 **단언은 한 줄도 바뀌지 않았다**
    (계약이 약해지지 않았다는 증거를 그 방식으로 남긴다). ⚠️ **CMS의 자유도는 줄이지 않았다** —
    파싱되지 않는 라벨(`"출산 전후"`·`"돌 무렵"`, 임신·세(歲) 표기)과 빈 값은 **오늘과 똑같이
    저장된다**(모르면 지어내지 않는다). ⚠️ **시드 값 0건 · 밴드 라벨 네 문자열 무접촉 · 기존 행
    일괄 검증·정정 0건 · 마이그레이션 0건 · 어드민 0건.** 그 사유가 운영자 화면에 닿는 것은 같은
    라운드의 트랙 B다(Q-2) — **두 트랙이 합쳐져야 루프가 닫힌다**는 사실이 이 종결의 마지막 값이다.
    브라우저 확인은 `runtime-verification-required.md` **#118**.
- **P3로 남는 값 하나**: `itemMatchesBand`의 `timingLabel` 폴백은 구조적으로 사문이다(서버 응답의
  `stageCodes`는 항상 비어 있지 않고, 시드 라벨은 물결표·밴드 라벨은 하이픈이라 문자열이 같아질
  수 없다). 살아 있는 경로는 `app/(tabs)/items.tsx`의 픽셀락 픽스처 셋뿐이라 **걷지 않는다.**

### O-3. **인용이 실측을 대신하기 시작했다** — 근거를 적는 습관이 근거를 다시 재는 습관을 밀어냈다

- **라운드 47이 세운 좋은 관습이 있었다** — 문서가 수치를 적을 때 **`근거: <명령>`** 을 함께
  적는 것이다. 그런데 2026-08-29에 재어 보니 그 형식을 쓰는 **여섯 자리 중 다섯이 틀린 숫자를
  근거와 함께** 적고 있었다. 인용이 신뢰를 만들면서, 그 인용을 **다시 돌려 보는 일**은 아무도
  하지 않게 된 것이다.
  - **스모크 체크 수 — 네 자리가 `31`이라고 적었고 실제 답은 `37`이다**
    (명령: `grep -c '^chk ' scripts/qa/server-smoke.sh`).
    `README.md` · `docs/5차/oracle-free-deploy-runbook.md` ·
    `docs/5차/day1-deploy-runbook.md` · `docs/5차/launch-readiness-status.md` 넷 전수.
    ⚠️ **스크립트 자신은 그 이력을 적고 있었다** — *"총 37 체크(라운드 59 트랙 D에서 31 → 37)"*.
    **라운드 59가 값을 올리면서 문서 넷 중 하나만 고쳤고, 그 뒤 열다섯 라운드가 지나갔다.**
  - **`check:env` 카탈로그 — `선택 34`라고 적었고 실제 답은 `41`이다**(필수는 22로 맞다).
    라운드 71·73이 카탈로그에 키를 더하면서(`EXPO_PUBLIC_SUPPORT_URL`·`EXPO_PUBLIC_FAQ_URL` 등)
    이 숫자를 함께 옮기지 않았다.
  - **게이트 단계 수 — 여섯째 자리는 숫자가 맞고 근거 명령이 틀렸다.** `release-runbook.md`의
    `11/11`은 사실이고 뒤에 나열된 단계 이름 열한 개도 맞는데, 근거로 적힌
    `grep -c 'label:' scripts/release-gate.ts`의 답은 **12**다(타입 선언 `label: string;` 한 줄이
    함께 세어진다). **고칠 것은 숫자가 아니라 명령이었다** — 라운드 74 트랙 C가
    `grep -c '    label: "' …`로 좁혔다.
  - **오늘의 값**: 스모크 **37** · 게이트 **11** · `check:env` **필수 22 · 선택 41**. 이 절의
    수치가 다시 낡으면 그것을 먼저 말하는 것은 이 문서가 아니라
    `packages/test-utils/src/repo-self-description.test.ts`다 — 그 계약이 문서가 적은
    `근거: <명령> → <수치>`를 **실제로 실행해** 대조한다(읽기 전용 파이프라인만 돌린다).
- **에이전트 진입 문서 셋이 서로 다른 저장소를 설명하고 있었다.** `CLAUDE.md`는 전수 대조에도
  사실만 적혀 있었는데, 관례상 **가장 먼저 읽히는** `AGENTS.md`가 가장 낡아 있었다: 프로젝트
  경로가 `F:\WooriAI` · *"남은 일은 Android 픽셀락"* · 명령이 전부 `npm run`(이 저장소는 pnpm
  workspace다) · 패키지명이 `com.anonymous.wooriai`(오늘 값은 `kr.wooriai.app`) · Windows 하드코딩
  경로 둘. 새 사람은 그 파일로 저장소를 배우고, 그 배움이 전부 틀렸다.
- ⚠️ **가장 값진 관측: DNC 계약의 사본이 충돌 우선순위 1위였고, 그것이 폐기 팔레트를 잠그고
  있었다.**
  - `AGENTS.md`의 "Forbidden Changes" 아홉 줄은 **DNC 계약의 두 번째 사본**이었다 — 영어로,
    부분만, 출처 표시 없이. DNC-013·014·015·017·018·019·020이 그 목록에 **없었다**(해요체 규율도,
    비밀값 금지도, 의료 단정 금지도 빠져 있었다). 그리고 **아무 계약도 둘의 일치를 묻지 않았다.**
  - `CODEX_START_HERE.md` §2는 문서 충돌 시 **1순위**로 `docs/4차/prompts/04_do_not_change_v0_4.md`,
    2순위로 같은 폴더의 v0.4 계약 YAML을 지목했다. 그 두 파일의 DNC-017은
    **`#FF8A7A`/`#7DDCC7`/`#FFF8F1`** 을 잠근다 — **DNC v0.5(DSN-053, 사용자 승인)가 갈아 끼운
    바로 그 이전 값**이고, 라운드 53과 73이 두 번 걷어낸 드리프트 팔레트다. 즉 **저장소의 공식
    충돌 규칙을 그대로 따르는 사람은 폐기 팔레트로 되돌아갔다.** 라운드 73 N-2가 "팔레트가 네
    벌"이라고 적었는데, **다섯 번째 벌이 계약 문서 안에 있었다.**
  - **오늘의 판정**: 진입 문서는 규칙 목록을 **갖지 않고 가리킨다**(`docs/dev/do-not-change.md`가
    현행 단일 소스라는 사실을 §2가 1순위로 적는다). ⚠️ **`docs/4차/**`는 한 글자도 고치지 않았다** —
    그것은 승인 계보의 **원본 보존본**이고, 고친 것은 **가리키는 문장**이다.
  - ⚠️ **그래서 폐기 팔레트 스윕에는 면제가 있고, 그 면제 이유가 값으로 남는다**
    (`repo-self-description.test.ts`의 `RETIRED_SWEEP_EXEMPT`): v0.4 문서 둘은 보존본이라 옛 값이
    남아 있는 것이 **정상**이고, 계약이 지키는 것은 "진입 문서가 그 둘을 **현행 규칙으로 가리키지
    못한다**"는 쪽이다(우선순위 목록에서 저장소 사본보다 아래에 있고 "보존본"이라고 적혀 있을 것).
    라운드 73 B가 `docs/ui-pixel-lock/**`에 내린 것과 같은 형태의 판정이다.
- **남은 사실(다음 결정의 입력)**: 오늘 계약이 도는 인용은 **트랙 C 소유 문서 일곱**에 한한다.
  같은 형식의 인용이 다른 문서에 생기면 그 자리는 여전히 아무도 돌려 보지 않는다 — 이 절이
  기록하는 교훈은 숫자 다섯이 아니라 그 성질이다: **형식이 신뢰를 만들면, 그 형식은 기계가
  지켜야 한다.**

### O-4. **종결 선언의 조건** — 종결은 그 종결을 세는 목록이 그것을 세고 있을 때만 종결이다

- **무슨 일이 있었나.** 라운드 73 트랙 E는 `OFFLINE_AWARE_LOAD_ERROR_EXEMPT_SCREENS`를 **정확히
  이 문제를 위해** 만들었다 — *"제외를 값으로 적지 않으면 다음 라운드가 같은 줄을 또 세고 또
  이월한다."* 그리고 **넷 중 하나만 그 안에 넣은 뒤 L-2를 "P3 0개"로 종결했다.** 나머지 셋
  (지출 상세 · 개인정보 파기 미리보기 · 검수 조회)의 제외 사유는 **known-limitations의 산문 한
  문단**에만 남았고, **산문은 아무 단언도 깨지 않는다.**
- **그래서 종결 뒤에도 화면 셋 · 자리 일곱이 옛 문장을 그대로 말하고 있었다.** 그중 둘은
  핵심 루프와 되돌릴 수 없는 버튼 위였다 — 지하철에서 기록 탭이 "지금은 오프라인이에요"라고
  말한 30초 뒤, 같은 앱의 **지출 상세**가 "잠시 후 다시 시도해 주세요"라고 말했고, **계정 삭제
  미리보기**는 기다릴 대상이 없는데 기다리라고 말했다. ⚠️ **같은 파일의 저장 쪽은 이미
  정직했다**(라운드 71 B) — 형제 훅 하나가 같은 모듈 안에서 조회 자리 넷을 지나쳐 갔다.
- **왜 세 스윕이 전부 초록이었나.** 그 스윕들은 **훅을 부르는 화면**을 센다(목록 ↔ 사용 집합의
  일치). 훅을 아예 부르지 않고 자기 문장을 손으로 적은 화면은 **사용 집합에도 목록에도 없으므로
  양쪽이 일치한 채 통과한다** — 라운드 73 L-2/N-3이 그 사각을 이름까지 붙여 적어 두었고,
  **그 사각 위에서 종결이 선언됐다.**
- **오늘의 값**(라운드 74 트랙 D — 자세한 것은 L-2 라운드 74 갱신 블록): 조회 배선 **열넷** ·
  카드가 아닌 자리 **여섯** · 조회 제외 **하나(이유가 값으로)** · 저장 배선 **넷** ·
  저장 제외 **0(빈 목록이 값이다)** · **산문에만 있는 제외 0건**. 그리고 반대 방향의 단언이
  섰다 — **옛 리터럴이 살아 있는 `app/**` 화면은 배선 목록이나 제외 목록에 예외 없이 이름이
  있어야 한다**(조회·저장 대칭).
- ⚠️ **판정: 종결은 그 종결을 세는 목록이 그것을 세고 있을 때만 종결이다.**
  라운드 73 N-2가 *"무접촉을 지키는 부정 단언은 무엇의 무접촉인지까지 좁혀 적어야 한다"* 고 적은
  것과 **같은 층의 교훈이고, 이번에는 긍정 쪽(종결)에서 났다.** 값 목록을 만드는 것과 그 목록에
  실제로 넣는 것은 다른 일이고, **문서의 산문은 둘 사이의 간격을 메우지 못한다** — 오히려 메운
  것처럼 보이게 해서 다음 라운드의 눈을 가린다.
- **이 판정이 적용되는 자리는 이 저장소에 더 있다**(다음 결정의 입력): 라운드 71 L-1의
  `IMPORT_JOURNEY_SERVER_FILES`("여정 목록이 없다") · 라운드 72 M-3("상황 목록이 없다") ·
  오늘 O-2의 **어드민 CMS 자유 입력** · 오늘 O-3의 **트랙 C 소유 밖 문서의 인용**. 넷 다 "판정은
  적혀 있는데 그것을 세는 목록이 없다"는 같은 모양이고, 그중 **적어 두기만 한 것과 값으로 넣은
  것을 구분해 읽는 것**이 이 절의 쓸모다.

## P. 라운드 75에서 확정한 판정 (2026-08-30 · GAP-075 트랙 F)

라운드 74가 축을 **이 저장소가 남기는 기록**으로 옮겼다면, 라운드 75는 한 겹 더 밖으로 나갔다 —
**이 저장소가 *남의 이름으로* 한 약속**이다. 개인정보처리방침·계정 삭제 안내(Play의 계정 삭제
URL)·데이터 안전 답안지는 이 저장소가 **이용자와 심사기관에게** 한 진술인데, 그 진술의 숫자
여섯을 코드와 잇는 줄이 한 줄도 없었고(P-2), 그중 하나는 **이미 지켜지지 않고 있었다**(P-1).
나머지 둘은 같은 병이 저장소 안쪽에서 난 자리다 — 라운드 74가 이번 라운드를 위해 만든 바로 그
표가 자기 수치를 세지 못했고(P-3), 라운드 60이 세운 좋은 관례가 본보기 하나로 남아 있었다(P-4).
K·L·M·N·O절과 같이 **결함 보고가 아니라 다음 결정의 입력**이며, 넷 다 2026-08-30 소스에서
확인됐다(라운드 75 트랙 A·B·C·D·E 머지 후).

⚠️ **이번 라운드의 가장 값진 관측은 절 하나에 담기지 않는다: 사실이 기록돼 있었는데 방향이
뒤집혀 있었다.** P-1의 결함은 숨어 있지 않았고 코드 주석이 정확히 그 동작을 적은 뒤
**"conservative, never premature"** 라고 평가했다. 데이터를 **일찍 지우지 않는다**는 축에서는
맞는 말이다. 그런데 개인정보 보존에서 위반은 **일찍 지우는 것이 아니라 약속보다 오래 들고 있는
것**이고, 그 축에서 같은 문장은 정반대를 뜻한다. 라운드 73 N-2가 *"무접촉을 지키는 부정 단언은
무엇의 무접촉인지까지 좁혀 적어야 한다"* 고 적은 것의 쌍둥이다 — **판정을 적을 때는 그 판정이
어느 축에서 좋은 말인지까지 적어야 한다. "보수적"은 축을 말하지 않으면 아무 뜻도 아니다.**

### P-1. **탈퇴한 계정의 파기 시계** — 거절될 로그인이 행을 쓰고 있었고, 그 사실은 "보수적"이라고 적혀 있었다

- **무슨 일이 있었나 — 여섯이 한 줄로 이어져 있었다.**
  - ⓐ **거절될 로그인이 먼저 행을 썼다.** `households/household-runtime.service.ts`의
    `attemptFindOrCreateProviderUser`는 찾은 행에 **status를 보지 않고** `lastLoginAt`을 썼다.
    탈퇴·차단 판정은 그 **뒤에**, 호출부에서 난다(`auth/kakao/kakao-auth.service.ts` —
    `USER_BLOCKED` 403 · `USER_WITHDRAWN` 403). **로그인이 거절되기 전에 행이 이미 갱신됐다.**
  - ⓑ **그 갱신이 파기 시계를 밀었다.** `users.updated_at`은 Prisma `@updatedAt`이고, 파기 잡
    phase 3의 후보 조건이 바로 그 컬럼이다(`worker/jobs/data-retention-purge.job.ts` —
    `status: "withdrawn" · deletedAt: null · updatedAt < cutoff`, 기본 창 **30일**). 탈퇴한 사람이
    29일째에 한 번 로그인해 보면 시계가 **0으로 돌아갔다.** 한 달에 한 번씩만 눌러 보면 그 계정은
    **영원히 파기되지 않았다.**
  - ⓒ ⚠️ **그 사실이 코드에 적혀 있었다 — 반대 뜻으로**(위 머리말의 그 관측).
  - ⓓ **법적 표면 셋이 그 30일을 *조건 없이* 약속한다.** `infra/legal/privacy-policy.html`
    (*"삭제 처리 후 30일이 경과하면 지체 없이 … 완전 파기"*) · `infra/legal/account-deletion.html`
    (그 파일 말미가 자기 성격을 적는다 — **Google Play 데이터 안전 요건의 계정 삭제 안내 URL**) ·
    `docs/store/data-safety-answers.md`. **셋 어디에도 "시도하지 않으면"이라는 단서가 없다.**
  - ⓔ ⚠️ **앱의 문장은 참이었는데, 그 문장의 근거는 참이 아니었다.**
    `api-error.ts`의 `USER_WITHDRAWN`과 `app/settings/privacy.tsx`의
    `ACCOUNT_DELETE_REJOIN_NOTICE`("삭제 후 30일 동안은 같은 계정으로 다시 가입할 수 없어요.")는
    **하한**을 말하므로 오늘도 거짓이 아니고, 그 옆 주석이 *"30일은 하한이다 … 30일이 지나면 된다고는
    약속하지 않는다"* 라고 근거까지 적어 두었다. 그런데 그 주석이 든 근거는 **파기 잡이 배치로 돈다**는
    것이지 **시계가 되감긴다**는 것이 아니었다. 즉 앱은 **틀린 이유로 맞는 말을 하고 있었고**, 그
    우연한 정직함이 "이 자리는 이미 판정됐다"는 인상을 남겨 여섯 라운드 동안 아무도 그 아래를 보지
    않았다. **문장이 참인 것과 그 문장의 근거가 참인 것은 다른 일이다.**
  - ⓕ **운영자도 거짓을 읽었다.** 같은 `lastLoginAt`이 CS 조회 화면의 **"마지막 활동"** 이다
    (`apps/admin/src/lib/user-lookup-view.ts`의 `lastActivityLabel`). 문전박대당한 계정이 운영자에게는
    **"어제 활동함"** 으로 보였다.
- **오늘의 값 — 거절될 로그인은 행을 쓰지 않는다.** update 갈래는 `existing.status === "active"`일
  때만 `lastLoginAt`을 쓰고, 그 밖의 status는 **찾은 행 그대로** 돌려준다(호출부가 같은 행을 읽어
  종전과 **바이트 동일한 403**을 낸다). ⚠️ **바뀌지 않은 것**: 응답 계약 0건
  (`USER_BLOCKED`·`USER_WITHDRAWN`의 코드·문장·403 · **차단이 탈퇴보다 먼저 나는 판정 순서**) ·
  **새 사용자 생성 갈래 무변경**(생성 시 `lastLoginAt`은 그대로) · **정상 로그인 무변경** ·
  P2002 재시도 경로 무변경 · 파기 잡의 **로직·phase 순서·배치 상한·상수 여섯 0건**(주석 한 문단만) ·
  **모바일 0건**(그 문장은 하한으로 정직했다) · **어드민 0건**(`lastActivityLabel`은 그대로이고,
  값이 거짓이던 **원인**이 사라졌다) · **마이그레이션 0건 · 새 컬럼 0건.**
- **계약은 두 방향이다.** ① **부정 단언**(`apps/api/test/auth-kakao-oidc.e2e.test.ts`) — 탈퇴·차단
  계정의 로그인 시도가 `users.updated_at`·`last_login_at`을 **한 값도 움직이지 않는다**(`active`는
  종전대로 갱신된다). ② **파생 단언**(`apps/api/test/data-retention-purge.db.test.ts`) — 30일 창을
  넘긴 탈퇴 계정이 **로그인 시도를 한 뒤에도** 다음 파기 배치에서 지워진다. ⚠️ **이 단언은 고치기
  전에 실제로 빨갰다** — 그것이 결함의 증명이다. 종전 테스트가 이 자리를 놓친 이유도 값이다:
  e2e는 403과 코드만 보았고, 파기 db 테스트는 `updatedAt`을 **고정값으로 만들어 넣어** "로그인
  시도가 그 값을 민다"는 경로를 아예 지나가지 않았다.
- ⚠️ **남은 사실(다음 결정의 입력) — 구조는 그대로다.** 파기 잡이 탈퇴 시각을 아는 방법은 여전히
  `updated_at` 하나뿐이다(`withdrawUser`는 status만 뒤집고 `deletedAt`을 찍지 않는다). 근본 해결은
  `withdrawn_at` 컬럼이고 그것은 **마이그레이션**이라 이번 라운드 밖이었다. 그래서 오늘의 부정
  단언이 지키는 것은 **그 값을 움직이던 유일한 경로 하나**이고, **탈퇴한 계정의 행을 쓰는 새 경로가
  생기면 같은 결함이 돌아오는데 그 단언은 침묵한다.** 그 경고는 문서에만 있지 않다 — 파기 잡의 클래스
  주석(item 3)과 `attemptFindOrCreateProviderUser`의 주석이 오늘의 사실과 함께 그것을 적는다
  (라운드 74 O-4의 규율: 산문은 아무 단언도 깨지 못하므로, **경고는 그 경로를 여는 사람이 반드시
  읽는 자리에** 둔다). 실기기·서버 확인은 `docs/qa/runtime-verification-required.md` **#111**(그리고
  30일 창이 실제로 닫히는지는 **#112 ⓒ**와 같은 자리에서 이어 밟는다).
- ⚠️ **그리고 이 수정은 관측성을 조금 잃었다(라운드 75 적대적 리뷰 S-7 · 값으로 남긴다).**
  종전에는 차단·탈퇴 계정이 로그인을 시도하면 적어도 `users.last_login_at`이 움직여 **시도가 있었다는
  흔적**이 남았다(그 흔적이 어드민 CS 화면에서 "마지막 활동"으로 **거짓말**을 했기 때문에 없앤 것이다).
  오늘은 그 시도가 **조회 가능한 흔적을 아무것도 남기지 않는다** — `auth.login` 감사 로그는
  `kakao-auth.service.ts`에서 **403 판정을 통과한 뒤에만** 기록되고(차단·탈퇴는 그 앞에서 던진다),
  거절 자체를 세는 카운터도 없다. 즉 "탈퇴한 계정이 계속 로그인을 시도하고 있다"는 사실을 오늘
  운영자가 확인할 방법은 **요청 로그의 4xx뿐**이다(요청 로그에는 userId가 없다 — 인증 전이다).
  ⚠️ **거짓 활동 표시를 없애는 것과 시도를 세는 것은 다른 축이고, 후자를 원하면 그것은 감사 로그의
  새 액션(예: `auth.login_rejected`)이지 `users` 행이 아니다** — 행을 다시 만지는 순간 P-1이 돌아온다.
- ⚠️ **갱신 (2026-08-30 · 라운드 76 트랙 D) — 그 관측성 손실은 이 절이 적어 둔 그 축에서 해소됐고,
  `withdrawn_at` 구조는 그대로다.** 차단·탈퇴 거절이 403을 던지기 **전에** `auth.login_rejected` 감사
  행을 하나 남긴다(`reason: "blocked" | "withdrawn"` + provider만 · **PII 0건** — `sub`·이메일·닉네임·
  토큰 없음 · DNC-019). 이 절이 방향까지 적어 둔 그대로 **`users` 행 쓰기는 0건**이고(`updated_at`·
  `last_login_at` 무변경 — 위 부정 단언을 트랙 D가 **다시 확인**한다), 응답 계약·판정 순서·정상
  로그인도 바이트 불변이다. ⚠️ **남은 절반은 그대로다**: 파기 잡이 탈퇴 시각을 아는 방법은 여전히
  `updated_at` 하나뿐이고, **탈퇴 계정의 행을 쓰는 새 경로가 생기면 같은 결함이 돌아오는데 그 부정
  단언은 침묵한다.** `withdrawn_at` 컬럼은 마이그레이션이라 이번 라운드에도 **밖**이다(라운드 76 P3).
  실기기 확인은 `runtime-verification-required.md` **#117**.

### P-2. **우리가 남의 이름으로 한 약속의 단일 소스** — 무접촉과 무단언이 같은 말이 되어 있었다

- **왜 이 경계를 값으로 정해야 했나.** 파기 창을 정하는 상수는 **여섯**이고
  (`worker/jobs/data-retention-purge.job.ts`의 `DEFAULT_*_RETENTION_DAYS` — 파기 **30** · 감사 로그
  **730** · 분석 이벤트 **400** · 제휴 클릭 **400** · 가져오기 행 **90** · 초대 **90**), 그 여섯이
  사람이 읽는 문서 셋에 **손으로** 적혀 있다(방침이 여섯을 전부 적고 마지막 줄이 다섯을 **순서까지**
  나열한다 — *"기본값은 각각 730일·400일·400일·90일·90일"*). ⚠️ **그중 무엇도 계약이 읽지 않았다.**
  `infra/legal/**`를 여는 테스트는 셋인데 전부 **색과 링크**만 본다. 라운드 73 트랙 B가 *"법적 문서
  본문은 무접촉(법률 검토 대상)"* 이라고 내린 판정은 옳았는데, **무접촉과 무단언이 같은 말이 되어
  버렸다.** 오늘 여섯은 전부 맞다 — 즉 이것은 *"지금 틀렸다"* 가 아니라 **"틀려도 아무 일도
  일어나지 않는다"** 이고, 차이는 **여기서 틀리면 그것이 법적 진술이 된다**는 것이다.
- **오늘의 값**(`packages/test-utils/src/data-retention-promise.test.ts`, 신설 — 계약 **29건**,
  변이 검증 5회. `@wooriai/test-utils` **54 → 83**): ⓐ 방향이 **상수 → 문서**다(문서에서 값을 읽어
  상수와 맞추는 반대 방향이 아니다 — **상수가 단일 소스라는 사실이 방향으로 드러난다**. 값은 파싱해
  오고 테스트가 숫자를 손으로 다시 적지 않는다: 적는 순간 그 파일이 일곱 번째 사본이 된다).
  ⓑ 방침의 **다섯 창 나열**이 상수 다섯과 **값도 순서도** 같을 것(하나가 밀리면 전부 밀리는 문장이다).
  ⓒ **전수 스윕** — 세 문서의 모든 기간 표현이 ① 상수 값의 되풀이 ② 단위만 바꾼 재진술(2년 = 730일)
  ③ **이유와 함께 적은 면제** 셋 중 하나일 것(분류되지 않은 숫자는 빨갛다). ⓓ 데이터 안전 답안지 ↔
  방침의 **보존 기간 숫자** 일치. ⓔ 법령 보존 기간의 `[대괄호]` 자리표시자는 **숫자 없이** 남아 있을 것.
- ⚠️ **계약은 문서를 고치지 않는다.** 오늘 초록이므로 이 트랙은 `infra/legal/**`·`docs/store/**`를
  **열어서 읽기만** 했다(본문 0건 · `<style>` 0건 · placeholder 0건 · 파기 잡의 상수·로직 0건 ·
  `check-env.ts` 무접촉). 언젠가 빨개지면 그때 **사람이 법률 검토와 함께** 고친다 — 그것이 이 계약이
  존재하는 이유다. 축 분리도 값이다: `public-surface-brand.test.ts`가 같은 HTML을 **색** 축으로 읽고,
  이 계약은 **숫자**를 진다. **한 파일을 두 계약이 각자 다른 축으로 읽는 것은 겹침이 아니다.**
- ⚠️ **일곱 번째 사본이 저장소 안에 있었다(라운드 75 적대적 리뷰 S-5).** 위에서 "문서 **셋**"이라고
  센 손 사본 목록은 전수가 아니었다 — `scripts/check-env.ts`의 **선택 카탈로그**가 같은 여섯을
  note 문장으로 되풀이한다("기본 30(PRIV-105)" · "기본 400(SEC-130)" · "기본 730(GAP-058 #10)" ·
  "기본 90(GAP-060 #5, …)" · "기본 90(GAP-062 #8, …)"). 그 문장은 `pnpm check:env`가 **배포
  담당자에게 그대로 출력하는 값**이라, 상수가 바뀌고 note가 안 바뀌면 배포 담당자가 틀린 기본값을
  읽는다. **그래서 오늘 그 사본도 같은 방향(상수 → note)으로 묶었다** —
  `data-retention-promise.test.ts`가 여섯 override 키의 note를 파싱해 `기본 N`의 N이 상수와 같은지
  본다. ⚠️ **`check-env.ts`는 여전히 무접촉이다**(카탈로그·문구 0건 — 계약은 **묻기만** 한다).
- ⚠️ **남은 사실(다음 결정의 입력) — 계약이 볼 수 있는 것은 저장소 안까지다.** 사용자가 읽는 것은
  **배포된 페이지**이고 실제로 도는 것은 **배포 env의 값**이며(여섯 override 키는 `check:env`의
  **선택** 카탈로그에 이미 있다), Play 콘솔에 **제출된** 답변도 저장소 밖이다. 셋 다 계약의 시야
  밖이라 사람이 확인한다(`runtime-verification-required.md` **#112**). ⚠️ 그리고 방침 파일의 HTML
  주석이 요구하는 *"데이터 안전 답안지와 항목이 1:1로 일치"* 중 **항목 이름 전수 대조는 하지
  않았다** — 그건 법무 판단이고, 오늘 건 것은 **보존 기간 숫자의 일치** 하나다.

### P-3. **표가 자기를 세게 됐다** — 좋은 관습이 다음 라운드에 낡도록 설계돼 있었다

- **무슨 일이 있었나.** 라운드 74 트랙 E가 세운 `runtime-verification-required.md` **§0**(모든 행에
  `표면` 칸 + 표면별 행 수·합계·§1 수)은 이 문서의 가장 유용한 개선인데, **그 절이 자기 규율 밖에
  있었다**: 그 수치를 다시 세는 것이 저장소에 **0건**이었고(그 문서를 여는 코드 셋은 전부 주석에서
  이름을 부를 뿐이다), **행을 더하는 것은 그 표 자신이 못박은 라운드 종료 조건**이다. 즉 **라운드
  75가 행을 더하는 순간 §0의 여섯 숫자가 전부 조용히 틀리도록** 설계돼 있었다. 라운드 74 O-3이
  이름 붙인 병(*"인용이 실측을 대신한다"*)이 **O-3을 쓴 라운드의 산출물에** 심겨 있었고, 라운드 59가
  스모크를 31 → 37로 올리면서 문서 넷 중 하나만 고친 것과 **정확히 같은 층**이다.
  ⚠️ **좋은 관습을 새로 만들 때, 그 관습이 다음 라운드에 어떻게 낡을지를 같은 자리에서 물어야 한다.**
- **오늘의 값**(`packages/test-utils/src/runtime-checklist-shape.test.ts`, 신설 — 계약 **21건**.
  `@wooriai/test-utils` **83 → 104**): §0 표의 네 수·합계·§1 수·셸 블록 주석의 숫자·§1-1 머리말의
  라운드 구간을 **전부 그 파일을 파싱한 값에서 파생**시켜 대조하고, 덤으로 **모든 표의 셀 수**(부정
  단언) · **표면 값 넷과 빈 칸 0건**(전수) · **행 번호 1..N 연속·중복 0건**을 함께 본다. 라운드 75
  신설분 **111~114**를 편입한 뒤 오늘의 수치는 **실기기 106 · 브라우저 3 · 서버 4 · 작업 1 ·
  합계 114**(§1 **12** + §1-1 **102**)이고, **이 숫자를 사람이 옮겨 적지 않아도 다음 라운드에 자동으로
  맞는다.** ⚠️ **행 삭제 0건 · 행 번호 불변 · 각 행의 문장·기대 동작·근거 파일·부정 조건 바이트 불변 ·
  표면 값 재분류 0건**(105·1·3·1의 배정은 라운드 74의 판정이다 — 이 트랙은 **세기만** 했다).
- **덤으로 고친 렌더 결함 하나와 그 원인.** `#98` 행은 셀이 **여섯**인데 그 표의 헤더는 **다섯**이라,
  GFM이 초과 셀을 버려 **근거 파일 칸이 통째로 렌더에서 사라져 있었다**(그 칸에 있던
  `offline-aware-screens.ts`·`messages.test.ts`·접근성 체크표 참조가 전부 보이지 않았다). 원인은
  라운드 72 리뷰 P-4가 더한 **"부정 조건 한 칸"** 이 `|`로 시작해 새 셀이 되어 버린 것이고 —
  **문장은 살아 있고 자리만 틀렸다.** 그래서 고친 것도 **셀 경계뿐**이다(글자 0건 삭제). 저장소 전체
  마크다운 표를 훑어 같은 결함을 셌더니 **살아 있는 문서에서는 이 한 행뿐**이었다
  (`docs/5차/round55-plan.md`에도 있지만 완료된 계획 문서라 문턱 아래이고,
  `docs/qa/fixed-issues.md`의 `\|`는 이스케이프라 **결함이 아니다** — 다음 라운드가 같은 스캔을 돌릴 때
  오탐으로 세지 않도록 적어 둔다).
- ⚠️ **두 인용 방언을 통일하지 *않은* 이유 둘 — 재어 본 결과다.** 라운드 74 C가 계약으로 되살린 형식은
  **`근거: <명령> → <수치>` 한 줄**이고 그 계약이 명령을 실제로 돌린다. §0은 같은 관습을
  **셸 코드 블록 하나 + 세 명령**으로 적었다 — 파서가 못 보는 형태다. 그래도 합치지 않는다:
  **①** §0의 첫 명령은 `for … do … done` 셸 루프라, 라운드 74 리뷰 C-1이 세운 **읽기 전용 가드**
  (`FORBIDDEN_COMMAND_PATTERNS` + 따옴표 밖 메타문자 금지)에 **정당하게** 거부당한다.
  **②** 이 표를 `OWNED_DOCS`에 넣으면 그 계약의 다른 단언 하나가 곧바로 빨개진다 — 이 표에는
  **DNC 조항이 열넷** 인용돼 있는데 "규칙 목록의 사본" 금지 단언의 상한은 **셋**이다. QA 체크표가
  행마다 근거 조항을 적는 것은 **옳은 일**이므로 상한을 넓히면 원래 잡으려던 사본 감지가 무뎌진다.
  **두 계약은 서로 다른 것을 지키고 있고, 합치면 둘 다 약해진다.** 그래서 §0의 셸 블록은 **사람이
  손으로 같은 값을 확인하는 근거**로 남기고(그 위에 계약이 같은 값을 파싱으로도 센다는 한 줄을 적었다),
  계약은 **셸을 실행하지 않는다.** ⚠️ **방언이 둘인 것 자체는 결함이 아니다 — 각자 무엇을 하는지가
  값으로 적혀 있지 않은 것이 결함이었다.**
- ⚠️ **`docs/5차/launch-readiness-status.md`가 `OWNED_DOCS`에 못 들어가는 이유(오늘 기준).**
  그 파일에는 `근거:` 인용이 둘 있고(스모크 37 · `check:env` 선택 41) 라운드 74 C 이후 **값이 맞으므로**
  편입할 만한데, 둘이 막는다: **DNC 조항 넷**(위 상한 셋) 그리고 ⚠️ **`"11/11"`이 옛 수치 부정 스윕
  목록에 있는데 오늘 그 값은 참이다**("릴리즈 게이트 11/11 PASS" — 게이트는 실제로 11단계이고, 라운드
  74가 고친 것은 그 옆의 **근거 명령**이지 단계 수가 아니었다). 즉 그 부정 스윕이 **참인 문자열 하나를
  금지**하고 있다. **이번 라운드의 어느 트랙도 그 목록을 좁히지 않았다** — 좁히는 것은 그 스윕이
  무엇을 겨누는지 다시 정하는 일이고, 별도 판단이다.
- ⚠️ **그리고 그 파일의 테스트 건수는 인용이 될 수 없다(다음 라운드가 시간을 쓰지 않도록 적는다).**
  *"api … · mobile … · admin … · domain … · contracts … · test-utils … (총 …)"* 는 **스위트를 실제로
  돌려야** 나오는 값이라 `근거: <명령>` 형식이 담을 수 없다(계약 안에서 전 스위트를 도는 셈이다).
  **라운드마다 사람이 다시 재는 수밖에 없는 유일한 수치**다.

### P-4. **관례는 본보기 하나로 남는다** — 손 미러 여덟(세어 보니 아홉, 다시 세어 보니 **스물여섯**) 중 대조가 붙은 것은 하나였다

- **관례도 그 근거도 이미 적혀 있었다.** 라운드 60 리뷰 P2-8이 `app/analytics/page.tsx`에
  *"왜 import가 아니라 **손 미러 + 대조 테스트**인가"* 를 근거와 함께 적어 두었고, 그 근거는 오늘도
  사실이다 — `apps/admin`의 dependencies는 **넷뿐**이고(`next`·`qrcode`·`react`·`react-dom`)
  `@wooriai/contracts`도 `@wooriai/domain`도 없다(어드민이 계약 패키지를 들면 zod가 번들로 따라
  들어온다). ⚠️ **그런데 그 관례를 실제로 받은 미러는 여덟 중 하나였다**(`ONBOARDING_STEPS`).
  나머지 일곱(`NECESSITY_LEVELS`·`CHILD_STAGE_CODES`·`CHILD_STAGE_LABELS`·`PRODUCT_PLATFORMS`·
  `LinkHealthStatus`·`ANALYTICS_EVENT_NAMES`·`ADMIN_ROLES`)에는 대조가 **없었다.** 오늘 여덟은 전부
  정본과 같으므로 이것도 *"지금 틀렸다"* 가 아니라 **"틀려도 조용하다"** 이다.
- ⚠️ **그리고 정찰이 손으로 센 여덟도 전수가 아니었다.** 트랙 E가 `admin-api.ts`의 상수 표를
  **전수 스크레이프**하자 **아홉 번째**가 나왔다(`CLICK_SUMMARY_DAYS_OPTIONS` — 서버가 받는 클릭
  분해 창의 미러). **관례를 세울 때 "이 관례를 받아야 하는 자리가 오늘 몇 개인가"를 세지 않으면,
  관례는 본보기 하나로 남고 나머지는 그 본보기의 존재를 근거로 안전해 보인다** — 그리고 그 개수를
  **손으로** 세면 그 목록도 같은 방식으로 낡는다(라운드 74 O-4: 종결은 그 종결을 세는 목록이 그것을
  세고 있을 때만 종결이다). 라운드 74 O-4가 **종결 선언** 쪽에서 발견한 모양이 **관례 도입** 쪽에서
  다시 난 것이다.
- **오늘의 값**(`apps/admin/src/admin-canonical-mirrors.test.ts`, 신설 — `apps/admin` **440**):
  정본 파일을 **소스 텍스트로 파싱해** 미러의 **리터럴과 순서**를 대조한다(정본 **다섯**:
  `packages/domain/src/enums.ts` · `packages/contracts/src/analytics.ts` · `apps/api/prisma/schema.prisma` ·
  `apps/api/src/worker/jobs/link-health.job.ts` · `apps/api/src/admin/affiliate-click-breakdown.service.ts`
  — 전부 **읽기만**. ⚠️ 다섯째는 정찰의 여덟 목록에 없던 아홉 번째 미러의 정본이라 이 목록에서도
  빠져 있었다: **손으로 센 목록은 자기가 놓친 것을 두 번 놓친다.**). ⓑ **라벨 표는 키 집합만** 묻고
  한국어 문자열은 묻지 않는다 — 어드민 라벨이 앱과 **일부러 다르고**(`"신생아 (0~3개월)"` vs 도메인의
  `"0~3개월"` — 운영자 표는 코드가 무엇인지 함께 말해야 한다) **그 이유가 값으로** 적혀 있다(면제가
  아니라 판정이다). ⓒ 이벤트 이름의 **합집합**(화면의 6 + ANA-127의 4)이 `analyticsEventRegistry`의
  **열**과 정확히 일치할 것(부정 단언: 라벨 없는 이름 0건 · 유령 라벨 0건 — 그 폴백이 깨지면 운영자의
  분석 표에 영문 이름이 그대로 뜬다). ⓓ **전수 대장** — 상수 표를 긁어 미러 목록과 대조한다.
  ⚠️ **값 0건**(대장에 든 미러가 전부 정본과 같다 — 이 트랙은 **묶기만** 했다) ·
  렌더·정렬·응답 처리·6+4 분리 규칙 0건 · `package.json`·`next.config.js` 무접촉
  (의존성 0건 — 그 제약이 이 관례의 근거다).
- ⚠️ **그 "전수"가 전수가 아니었다(라운드 75 적대적 리뷰 M-1 · 같은 라운드 안에서 고침).**
  처음 세운 ⓓ 단언은 *"새 미러는 대조 없이 생기지 못한다"* 고 적었는데, 그 눈은 **`src/lib/admin-api.ts`
  한 파일**에서 **두 선언 형태**(`export const NAME: T[] =` · `export const NAME: Record<…> =`)만
  긁었다. 즉 그 문장이 참인 범위는 *"그 파일 안에서, 그 두 형태로 적혔을 때"* 였고, 재어 보니 같은
  종류의 손 미러가 그 밖에 **열** 살아 있었다 — `src/lib/user-lookup-view.ts`의 라벨 **다섯**
  (`UserStatus`·`AuthProvider`·`MemberRole`·`MemberStatus`·`ChildStageMode` enum의 사본) ·
  `app/reviews/page.tsx`의 **둘**(`CONTENT_REVISION_ENTITY_TYPES`·`CONTENT_REVISION_STATUSES`) ·
  `app/analytics/page.tsx`의 `DAYS_OPTIONS`(서버 `ANALYTICS_SUMMARY_WINDOWS`) ·
  `src/lib/link-filters.ts`의 링크 헬스 칩 · `src/lib/disclosure-keys.ts`의 앱이 읽는 고지 키
  (이 마지막 하나는 라운드 65가 이미 대조를 붙여 뒀는데 **대장이 그것을 세지 못했다**).
  **오늘 편입한 뒤 대장은 스물여섯이고, 정본은 여덟 파일이다**(위 다섯 + 서버 DTO
  `admin/dto/content-revision.dto.ts` · `admin/analytics-summary.service.ts` ·
  `onboarding/items-catalog.service.ts`). 열 다 **값 0건**(전부 정본과 같았다).
  그리고 눈 자체를 트랙 D의 모양으로 바꿨다: **걷는 뿌리**(`src`·`app`)와 **걷지 않는 뿌리·이유**,
  **긁는 선언 형태**(`as const`(타입 주석 없음) · `Readonly<Record<…>>` · 여러 줄 타입 주석 ·
  소문자 이름)와 **그래도 못 잡는 형태**(`NON_SCRAPED_DECLARATION_FORMS` — 이유와 함께)가 전부 값이고,
  긁힌 상수 표는 예외 없이 **대장에 있거나 `NON_MIRROR_CONSTANT_TABLES`에 이유와 함께** 있어야 한다
  (오늘 후자는 열여덟이다 — 화면 배치·필터 프리셋·CSV 열처럼 **정본이 없는** 표들이다).
  ⚠️ **오늘의 정확한 문장은 이것이다: "대장이 걷는 뿌리 안에서, 여기 적힌 선언 형태로 적힌 새 상수
  표는 대조 없이 생기지 못한다."** 라운드 74 O-4의 규율이 낱말 하나에서 다시 났다 —
  **전수는 무엇을 걷는지가 값으로 적혀 있을 때만 전수다.**
- **사본이 사본을 지키던 자리와, 자라지 않은 서술 둘.** `admin-analytics.test.ts`는
  `ANALYTICS_EVENT_NAMES`를 **테스트 안에 손으로 적은 여섯 리터럴**과 대조했다(정본을 읽지 않았다) —
  오늘은 **레지스트리 파생**이다. 그리고 화면·테스트의 주석 둘이 *"ANA-127이 더한 **두** 이벤트"*
  라고 적고 있었는데 오늘 그 경로로 들어오는 것은 **넷**이다. **라벨 표는 넷으로 자랐는데 그것을
  설명하는 문장 둘은 자라지 않았다** — 사본이 사본을 낳는 정확한 증상이고, 정정도 **숫자를 손으로 다시
  적는 대신 계약이 세는 값을 가리키는** 형태로 했다.
- ⚠️ **남은 사실(다음 결정의 입력) — O-2 잔여가 이월된 이유가 오늘 처음 값으로 나왔다.**
  라운드 74 O-2의 마지막 문단(어드민 CMS의 `timingLabel` 자유 입력)이 이월된 이유는 **"미결정"이
  아니라 "의존 구조"** 였다: 그 대조를 어드민이 런타임에 하려면 스테이지의 개월 경계가 필요하고 그것은
  `packages/domain`에 있는데, 어드민이 그 패키지를 못 드는 이유가 바로 위 P2-8의 근거다(게다가 domain의
  `main`은 raw TS라 Next에서 쓰려면 `transpilePackages` — **빌드 설정 변경**이라 별도 결정이다).
  자세한 것은 **O-2의 2026-08-30 갱신**에 적었다. **이 트랙이 한 일은 왜 못 닫았는지를 값으로 적는
  것까지다.** 브라우저 확인은 `runtime-verification-required.md` **#114**.
- ⚠️ **갱신 (2026-08-30 · 라운드 76 트랙 D) — 그 면제의 판정이 *한 방향에만* 옳았다.** 이 절의
  대장은 `AUDIT_LOG_ACTION_PRESETS`를 *"부분집합이라 전수 대조 대상이 아니다"* 로 면제했는데
  (`admin-canonical-mirrors.test.ts`), 부분집합이라 **"서버의 전부가 프리셋에 있어야 한다"** 는
  틀리지만 **"프리셋에 있는 것은 서버에 있어야 한다"** 는 여전히 참이어야 했다. 그 방향의
  **유령 부정 단언**이 오늘까지 0건이었다 — 오타 하나·서버에서 사라진 액션 하나는 CS에게
  **언제나 0건인 필터 후보**를 주고, 0건은 화면에서 "기록이 없다"와 구별되지 않는다. 오늘 그
  단언이 `audit-log-filters.test.ts`에 섰고(`apps/api/src` 전수에서 액션 문자열을 긁는다 — 주석은
  걷어낸다), **프리셋 스물셋은 전부 실재한다**(값 0건). ⚠️ **반대 방향은 세우지 않았다** — 이 절의
  면제 문장은 그 방향에서 오늘도 옳다. **면제를 적을 때는 그 면제가 어느 방향에서 옳은지까지 적어야
  한다**(P-1 머리말의 "축"이 낱말 하나에서 다시 난 자리다). ⚠️ `admin-canonical-mirrors.test.ts`는
  **무접촉**이다 — 단언은 다른 파일에 섰고 대장 스물여섯은 그대로다.

## Q. 라운드 76에서 확정한 판정 (2026-08-30 · GAP-076 트랙 F)

라운드 75가 축을 **이 저장소가 남의 이름으로 한 약속**으로 옮겼다면, 라운드 76은 한 겹 안으로
돌아왔다 — **목록이 닫힌 곳의 바로 옆 칸**이다. 모바일의 오프라인 정직은 `app/**`에서 완전히
닫혔고(라운드 72~74), 어드민의 조회 사유 소비는 열여섯 자리에서 완전히 닫혔다(라운드 73~75).
그런데 이번 라운드의 후보 둘은 **화면이 아니라 모듈**에서(Q-1), **조회가 아니라 쓰기**에서(Q-2)
같은 결함을 냈다. K~P절과 같이 **결함 보고가 아니라 다음 결정의 입력**이며, 다섯 다 2026-08-30
소스에서 확인됐다(라운드 76 트랙 A·B·C·D·E 머지 후).

⚠️ **이번 라운드의 가장 값진 관측: 스윕의 축은 "무엇을 걷는가"뿐 아니라 "무엇을 세는가"로도
정해진다.** 라운드 75가 어드민 스윕에서 얻은 교훈은 *"스윕의 범위는 어디에 코드가 있는가가 아니라
**어디에 사용자가 있는가**로 정해야 한다"* 였다. 오늘 그 쌍둥이가 나왔다 — `app/**`을 걷는 것은
옳았지만 **모듈이 문장을 갖는 저장소**에서는 그 뿌리가 답이 아니었고(Q-1), 조회를 세는 대장 옆에는
**쓰기를 세는 대장**이 있어야 했다(Q-2). ⚠️ **그리고 한 파일 안에서 옳은 답을 이미 적어 둔 자리가
있으면, 그 형제들이 왜 다른 답을 하는지를 값으로 물어야 한다 — 주석은 형제에게 전파되지 않는다**
(Q-2의 `app/reviews/page.tsx`가 그 증거다: 형제 넷 중 하나만 서버의 말을 들었고, 그 자리에 이유를
적은 주석까지 달려 있었다).

### Q-1. **문장이 사는 층** — 스윕은 화면을 걷고 있었는데 실패 문장은 모듈에 살았다

- **무슨 일이 있었나.** `apps/mobile/src/family/invite-permissions.ts`의 `inviteCreateErrorMessage`는
  403만 갈라내고 나머지 전부를 *"초대 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요."* 로
  답했다 — **`isOnline`을 받지 않았다.** 형제 모듈(`src/family/member-mutation-messages.ts`)은 라운드
  52부터 그 판정을 지나고 있었고, 그 모듈을 쓰는 **가족 화면은 조회·저장 양쪽이 이미 정직했다.**
  ⚠️ **즉 정직한 화면에서 [초대 링크 만들기]를 눌러 들어간 다음 화면만 아니었다** — 가족 참여
  여정의 **첫 단추**이고, 거기서 멈춘 사람은 초대 수락·역할·공동 기록을 한 번도 보지 못한다.
- ⚠️ **왜 두 스윕 사이로 빠졌나 — 뿌리와 바늘, 둘 다였다.** ⓐ 라운드 74 D가 세운 옛 리터럴 부정
  스윕은 **`app/**` 한 뿌리**를, 그것도 **`.tsx`만** 걷는다. ⓑ 그 바늘은 `SAVE_ERROR_NOTICE`의 **앞
  문장**(`"저장하지 못했어요"`)이라 `"초대 링크를 **만들지** 못했어요"`는 **바늘 모양으로도** 걸리지
  않았다. **저장 쪽 `src/**`는 오늘까지 아무도 세지 않았다.** 그리고 그 사실은 저장 제외 목록의
  머리말에 이미 적혀 있었다 — *"화면들이 그리는 저장 실패 문장은 전부 순수 모듈에서 온다"*.
  **스윕이 "화면 0건"이라고 답할 수 있던 이유가 곧 그 스윕이 아무것도 못 보던 이유였다.**
- **오늘의 값 — 모듈 층에 대장 셋이 섰다**(`src/offline/offline-aware-screens.ts` ·
  스윕은 `src/offline/messages.test.ts`). 바늘 셋(`"불러오지 못했어요"` · `"저장하지 못했어요"` ·
  꼬리 조각 `"잠시 후 다시"`)은 **공용 상수에서 파생**시키고, `src/**`(`.ts`·`.tsx`, 테스트 제외)에서
  걸린 모듈은 예외 없이 셋 중 하나에 있어야 한다 — 오늘 **열여섯**이다: **배선 여섯**
  (`export/ExpenseCsvExport.tsx` · `family/invite-permissions.ts` · `family/member-mutation-messages.ts` ·
  `import/import-failure-messages.ts` · `onboarding/step-ui.tsx` · `settings/destructive-flow-messages.ts`) ·
  **이유가 적힌 면제 여덟** · **정의상 밖 둘**(문장의 단일 소스 자신 · 목록 자신). 면제 이유는
  **빈 문자열 금지**이고 공통 기준은 하나다 — *그 실패에 연결이 등장하지 않거나, 등장했다면 이미
  다른 판정이 답했다.* 화면 쪽 목록은 `app/family/invite.tsx` 편입으로 **넷 → 다섯**이고,
  **온라인 갈래는 바이트 불변**이다(두 문자열·403 갈래·판정 순서 — 새 문구 0건 · 서버 0건).
- ⚠️ **면제 여덟 중 하나는 "면제이면서 이미 정직한" 자리다.** `onboarding/selected-child-recovery.ts`는
  바늘에 걸리는 문장이 **온라인 갈래**이고 오프라인은 같은 자리에서 `OFFLINE_RETRY_NOTICE`로 갈린다 —
  즉 **면제 목록에 있으면서 `isOnline` 판정을 실제로 지난다.** 정찰의 갈래 셋은 그 사실을 담지 못했고,
  트랙 A가 그것을 단언 하나로 못박았다. **면제는 "판정을 안 지난다"가 아니라 "이 스윕이 요구하는
  배선이 없어도 된다"이고, 둘을 같은 낱말로 적으면 다음 라운드가 그 자리를 다시 연다.**
- ⚠️ **파생 바늘을 문장 **전체**로 잡으면 그물이 찢어진다 — 오늘 처음 값으로 나왔다.** 꼬리를
  공용 상수 그대로(`"잠시 후 다시 시도해 주세요"`) 잡으면 붙여 쓴 방언(`"시도해주세요"`)을 쓰는
  파일 셋(`src/auth/kakao-login.ts` · `src/export/ExpenseCsvExport.tsx` ·
  `src/export/expense-page-collector.ts`)이 **구조적으로 안 걸린다.** 그래서 바늘은 `"잠시 후 다시"`
  까지만 잡는다 — **표기 방언을 통일하지 않은 대가를 그물이 대신 치르고 있고, 그 사실이 이제 값으로
  적혀 있다.**
- ⚠️ **그 방언 둘은 이번 라운드에 고치지 않았다 — 다음 라운드의 시작점이 될 수치를 남긴다.**
  실측(주석 제외, `app/**`+`src/**`): 띄어 쓴 `"시도해 주세요"` **30건 / 파일 열여덟**, 붙여 쓴
  `"시도해주세요"` **10건 / 파일 셋**(`src/auth/kakao-login.ts` 7 · `src/export/ExpenseCsvExport.tsx` 2 ·
  `src/export/expense-page-collector.ts` 1). **둘 다 사용자에게 보이고**, 하필 그 셋이 **가입 첫 10분**
  (카카오 로그인 실패)과 **월말 정리**(CSV 내보내기) 여정에 있다. 고치지 않은 이유 둘: ① 둘 다
  어법상 허용되는 표기라 **거짓이 아니고**, ② 고치면 사용자 문구 열 줄이 바이트로 바뀌는데 그 축
  (문구 표기 통일)은 이번 라운드 어느 트랙의 축도 아니었다. **트랙 A는 그 파일들을 대장에 이름과
  이유로만 올리고 문구는 0건 만졌다.**
- ⚠️ **남은 사실(다음 라운드 후보) — 화면이 이미 계산한 문구를 버린다**(라운드 76 리뷰 P-3).
  `app/family/invite.tsx`는 공용 훅에게 **완성된 문장**을 받아 놓고(`useSaveErrorCopy(...)`),
  그것을 **불리언 하나로만** 읽고(`!== OFFLINE_SAVE_NOTICE`) 버린 뒤 문장은 모듈에서 다시 받는다.
  오늘 그 둘은 같은 값으로 수렴하므로 **결함이 아니고**(온라인 갈래 바이트 불변이 그 사실을 문다),
  그렇게 지은 이유도 값으로 적혀 있다 — 문구의 단일 소스를 모듈 하나로 유지하기 위해서다. 다만
  **문장을 만드는 자리가 둘인 구조**는 두 판정이 갈라지는 날 조용히 어긋난다. 형제 화면
  (`app/family/accept/[token].tsx`)이 훅의 문장을 **그대로 쓰는** 것과 다른 모양이라는 사실을
  다음 라운드의 입력으로 남긴다.
  - ⚠️⚠️ **정정 (2026-08-30 · 라운드 80 트랙 F) — 위 "남은 사실"은 이미 닫힌 사실이다.** 오늘 실측:
    `app/family/invite.tsx`가 `inviteCreateErrorMessage`에 `serverCopy: inviteSaveErrorCopy`를
    **함께 넘기고**, `src/family/invite-permissions.ts`가 그 값을 **셋째 갈래**로 쓴다(라운드 77 트랙 E —
    이 절의 아래 갱신 문단 마지막 줄도 *"R-5에서 종결"* 이라고 적는다). **불리언 하나로만 읽고 버리는
    구조는 오늘 없다.** ⚠️ **그런데 이 항목은 여전히 현재형("버린다")으로 적혀 있었고, 두 문단이
    서로 반대를 말하는 채로 세 라운드가 지났다** — 위 본문은 사실 그대로 두되(라운드 76 시점의 실측
    기록이다) **오늘의 상태는 닫힘**이라는 것을 여기 값으로 적는다. ⚠️ **이유를 함께 적는다: 닫힌 것을
    닫혔다고 적지 않으면 다음 사람이 그 문단을 근거로 같은 일을 다시 한다** — 라운드 80이 이 자리를
    후보로 다시 주웠던 것이 그 증거이고, 그 일반형은 **U절 머리말의 세 번째 관측**에 적혀 있다
    (*"이월은 값으로 적히면 살아남지만, 완료도 값으로 적혀야 사라진다"*).
- ⚠️ **갱신 (2026-08-30 · 라운드 77) — 수치는 그대로이고, 그 결정이 값을 치르는 자리가 어디인지가
  이번에 보였다.** 표기 방언은 재실측해도 같다(띄어 쓴 **30건 / 파일 열여덟** · 붙여 쓴
  **10건 / 파일 셋**) — 기각 사유도 그대로다(둘 다 어법상 허용 · **거짓이 아님**).
  ⚠️ **정정(라운드 77 적대적 리뷰 M-2)**: 이 자리에 한동안 *"**31건** — 라운드 76의 30에서 트랙 A의
  대장 문장 하나가 늘었다"* 라고 적혀 있었는데 **둘 다 거짓이었다.** 2026-08-30 재실측(주석·테스트
  제외, `app/**`+`src/**`)은 **30건 / 파일 열여덟**이고, 트랙 A가 지은 두 문장은 *"…확인해 주세요."*
  로 끝나 이 수치를 **한 건도 늘리지 않는다**. ⚠️ 그 사실 자체가 R-1 규율(*"새 문장을 짓는 순간
  표기를 고른다"*)이 실제로 지켜졌다는 **증거**다 — 늘었다는 인과 문장은 지켜진 규율을 어겼다고
  적고 있었던 셈이다. ⚠️ **다만 통일하지 않기로 한 결정이 대가를 치르는 자리는 이제
  "고칠 때"가 아니라 **새 문장을 짓는 순간**이다** — 라운드 77 트랙 A가 앱 전역 표에 두 줄을 더하는데,
  그 문장이 붙여 쓴 방언을 쓰면 방언 파일이 **넷**이 된다. 그래서 그 트랙의 금지 조항에 *"띄어 쓴
  표기를 쓴다"* 를 **명시로** 적었다(R-1). **그물이 대가를 대신 치르던 자리(꼬리를 `"잠시 후 다시"`
  까지만 잡는다)에 이어, 이제 새 문장마다 사람이 한 번씩 고르는 자리가 생겼다.** 그리고 이 절이 남긴
  P-3 잔여(**화면이 이미 계산한 문구를 버린다**)는 라운드 77 트랙 E가 닫았다 — **R-5에서 종결**.

### Q-2. **쓰기 실패의 대장** — 조회 열여섯 옆에 쓰기를 세는 것이 없었고, 한 문장은 없는 원인을 단정했다

- **경계는 옳게 적혀 있었다 — 그래서 그 밖이 비어 있었다.** `src/lib/load-error-copy.ts`의 머리말이
  스스로 *"쓰기 실패의 판정은 R19-F가 근거와 함께 세워 뒀다 — **여기는 조회만이다**"* 라고 적는다.
  그 문장은 참이었고, 그래서 **쓰기 쪽에는 오늘까지 목록이 없었다.** 어드민의 catch를 전수로 세면
  **마흔넷**이고(`app/**` + `src/components/**`), 갈래는 **조회 열여섯**(한 벌) · **쓰기 열넷** ·
  **면제 열넷**이다. 그 쓰기 중 **아홉**이 서버가 보낸 한국어 사유를 **통째로 버렸다**(그 세 파일의
  쓰기 catch에는 `AdminApiError`·`isTimeoutError` grep이 **0건**이었다).
- ⚠️ **버리는 것과 함께 R19-F의 문장 둘이 화면에 닿지 못했다.** `WRITE_TIMEOUT_MESSAGE`
  (*"반영 여부가 확실하지 않으니 목록을 새로고침해 확인한 뒤 다시 시도하세요"* — **재시도를 권하지
  않기 위해** 지은 문장)와 `IDEMPOTENT_WRITE_TIMEOUT_MESSAGE`(*"같은 요청을 다시 보내면 중복 없이
  처리돼요"*)가 전부 폴백 한 문장으로 수렴했다. 그 폴백은 *"저장하지 못했어요. **입력값을 확인**하고
  **다시 시도**해 주세요."* — 타임아웃에서 **틀린 원인(입력값)** 을 지목하고 **금지된 행동(재시도)** 을
  권한다. 버리는 아홉 중 **넷이 멱등키를 실어 보내는 쓰기**라, 안전하게 재시도할 수 있는 사람에게
  **재시도하면 안 된다고 읽히는 침묵**을 주고 있었다.
- ⚠️⚠️ **그중 한 자리는 없는 원인을 단정했다 — 그리고 정답이 같은 파일 30줄 아래 있었다.**
  `app/reviews/page.tsx`의 `handleApprove` catch는 **모든 실패**에 *"승인 게시하지 못했어요. 본인이
  작성한 초안은 승인할 수 없어요."* 를 세웠다(네트워크 끊김·500·60초 타임아웃·이미 게시된 초안 전부).
  같은 화면의 `handleSchedule`은 *"// API가 이미 한국어 사용자 메시지를 내려줘요"* 라는 주석과 함께
  서버 문장을 쓴다. **한 파일 안에서 형제 넷 중 하나만 서버의 말을 들었고, 그중 하나는 남이 쓴 초안을
  승인하다 서버가 잠깐 죽어도 운영자에게 계정 권한 문제를 의심하게 만들었다.**
- **오늘의 값 — 조회가 가진 한 벌을 쓰기에도 세웠다**(`apps/admin/src/lib/write-error-copy.ts` +
  `src/admin-write-error-copy.test.ts`, 둘 다 신설. `apps/admin` **455 → 475**). 판정을 새로 만들지
  않았고(`admin-api.ts`는 **읽기만** — `AdminApiTimeoutError`가 `AdminApiError`를 상속해 두 타임아웃
  문장을 이미 싣고 온다) `load-error-copy.ts`와 **합치지도 않았다**(쓰기의 재시도 판정은 조회와
  **정반대**다 — R19-F). ⚠️ **새 한국어 문구 0건이고 폴백 열셋은 바이트 불변**이며, **문자열이 바뀐
  자리는 위 원인 단정 한 절뿐이다**(서버가 그 이유를 알면 서버가 말한다). 대장은 자리 수로 적히고
  (`WRITE_ERROR_COPY_SITES` — 일곱 파일 열넷), 대장 밖에서 쓰기 폴백을 손으로 적으면 **부정 단언이
  빨개진다**. ⓔ 부정 단언(*어떤 쓰기 폴백도 실패 원인을 단정하지 않는다*)은 **고치기 전에 빨갰다.**
- ⚠️ **스윕이 정찰의 열아홉에 없던 자리를 하나 찾았다.** `src/components/ProductLinkBulkReplace.tsx`의
  CSV 일괄 적용 catch다 — **정찰이 손으로 센 목록은 자기가 놓친 것을 두 번 놓친다**는 P-4의 문장이
  같은 모양으로 다시 났고, 이번에는 **손이 아니라 스윕이 먼저 세었기 때문에** 그 자리가 대장에
  들어왔다.
- ⚠️ **충돌 우회 둘을 값으로 적는다(둘 다 잃는 문장 0건).** ⓐ **`AdminShell.tsx`의 쓰기 다섯은 면제로
  남았다** — 이미 `error instanceof AdminApiError ? error.message : 폴백` 손 사본이라 **사유를 말하고
  있고**, 그 파일의 형태는 라운드 75가 고정한 계약이 물고 있어 한 벌로 바꾸면 그쪽이 빨개진다. 사본이
  다섯 벌인 것이 다음 드리프트의 씨앗이라는 P-4의 교훈은 여전히 유효하므로 **면제 이유에 그 사실을
  함께 적었다.** ⓑ **대장 둘은 모듈이 아니라 스윕이 사는 테스트 파일에 산다** — 조회 쪽처럼 `src/lib/**`에
  두면 라운드 75 E의 상수 표 전수 스크레이프가 물고, 편입할 자리(`NON_MIRROR_CONSTANT_TABLES`)가 이
  트랙의 무접촉 대상이라 초록으로 만들 수 없다. 테스트 파일은 그 스크레이프의 **명시적 제외 뿌리**다.
  **두 대장을 한 자리로 모으려면 그 파일에 두 줄을 더하는 별도 결정이 필요하다.**
- ⚠️ **남은 사실(다음 결정의 입력).** 가져오기 **미리보기 catch**는 서버가 보내는 CSV 검증 사유를
  아직 나르지 않는다. 이번 라운드는 그 자리를 열지 않았고(축이 **쓰기**였다), **다음 라운드 후보로
  값으로 남긴다.**
- ⚠️ **갱신 (2026-08-30 · 라운드 77 트랙 C) — 그 잔여가 닫혔고, 남은 면제 둘은 성질이 다르다.**
  미리보기 catch가 갈래 넷을 지나고(401 → 타임아웃 전용 → **연결 실패 전용** → `writeErrorMessage`)
  폴백에서 원인 단정 한 절이 빠졌다. 대장 총합은 **열넷 → 열다섯**(면제 `#bulk-preview`가 자리 수로
  이동). ⚠️ **그 자리는 대장에 들어오는 순간 고치기 전에 빨갰다** — 이 절이 세운 ⓔ 부정 단언의 꼬리
  화이트리스트 셋에 *"CSV 형식을 확인하고 다시 시도해 주세요."* 가 없었기 때문이다(**새 꼬리 0건**).
  ⚠️ **남은 면제 셋 중 이 파일의 둘(`#recheck-current-state` · `#copy-csv-header`)은 사유 바이트
  불변이고, 성질이 다르다 — 둘 다 화면에 세우는 문장이 없다.** 그리고 이 대장은 이제 **쓰기 단위인데
  읽기 의미의 POST를 하나 안고 있다**(bulk-preview는 검증만 하고 아무것도 쓰지 않는데 상한 판정에서만
  쓰기다) — 그 예외를 다음 라운드가 다시 세지 않도록 그 자리에 값으로 적었다. **자세한 것은 R-3.**

### Q-3. **여정 목록이 자기 컨트롤러를 센다** — 중간 크기 답 하나, 큰 질문은 그대로

- **사실.** `IMPORT_JOURNEY_SERVER_FILES`가 손으로 들던 서버 파일 **둘**은 그 여정의 **셋째 파일**을
  빠뜨리고 있었다(`imports/imports.controller.ts` — `FileInterceptor`의 `fileFilter`가 던지는
  mimetype 1차 관문). **오늘 사용자에게는 아무 일도 일어나지 않는다**(그 코드는 라운드 45가 이미 표에
  세워 뒀다). 위험한 것은 다음이다 — **그 컨트롤러에 새 코드가 하나 들어오면 스윕은 초록인 채로 그것을
  놓친다.**
- **오늘의 값.** 컨트롤러 트리 **서른둘**을 훑어 여정 파일을 import하는 컨트롤러를 **파생**시키고,
  그 집합이 목록에 있거나 이유와 함께 제외되게 했다(하한 단언 ≥30이 앞에 선다). 목록은 **둘 → 셋**이고
  **문구 0건 · 서버 0건 · 표 0건**이다. 자세한 것은 **L-1의 2026-08-30 갱신**에 적었다.
- ⚠️ **L-1의 큰 질문은 여전히 열려 있다** — 저장소에 **여정 목록은 없고**, "이 저장소에 즉시 요청
  여정이 몇 개인가"에 오늘도 답이 없다. 오늘 닫힌 것은 **여정을 정의하지 않고도 물을 수 있던 한
  질문**이고, 그 구분이 이 절이 남기는 값이다.

### Q-4. **거절을 세는 대칭** — 운영자의 실패는 세 종류로 세면서 이용자의 거절은 0이었다

- **사실.** 서버가 기록하는 감사 액션 중 **어드민의 실패한 로그인은 셋**이 센다
  (`admin.login_failed` · `admin.mfa_login_failed` · `admin.password_change_failed`). 앱 로그인에는
  대응하는 액션이 **0건**이었다 — 성공(`auth.login`)만 세고, 그마저 **403 판정을 통과한 뒤에만**
  선다. 라운드 75 A가 `users` 행 쓰기를 막은 뒤로 차단·탈퇴 계정의 로그인 시도는 **조회 가능한 흔적을
  아무것도** 남기지 않았다. **같은 저장소가 운영자의 실패는 세고 이용자의 거절은 세지 않았고, 그
  비대칭은 아무 단언도 깨지 않아 CS가 답할 수 없는 문의가 올 때까지 보이지 않는다.**
- ⚠️ **축 구분이 이 판정의 핵심이다 — `audit_logs` 행이지 `users` 행이 아니다.** P-1이 없앤 것은
  **거짓 활동 표시**였고, 그 자리에 값을 되돌리는 것은 P-1을 되돌리는 일이다. 오늘 더한 것은
  **다른 테이블의 행 하나**다(`audit_logs`는 `users`에 FK가 없고, 파기 잡 phase 3이 탈퇴 계정의 감사
  로그를 익명화한다 — 행 하나를 더 쓰는 것이 파기 약속을 되돌리지 않는다). **거짓 표시를 없애는 것과
  시도를 세는 것은 다른 축이고, 그 방향은 P-1이 이미 적어 두었다.**
- ⚠️ **다만 그 "익명화"의 범위를 정확히 적어 둔다**(라운드 76 리뷰 S-4 — 잡 주석의 같은 문장을 함께
  고쳤다). phase 3이 null로 바꾸는 것은 **`actor_user_id` 하나**이고(`ip_hash`는 이미 솔트 단방향
  해시다), **`target_id`는 그대로 남는다** — `target_type`이 `"users"`인 행에서 그 값은 그 사용자의
  id다. 내부 UUID이고(제공자 식별자·연락처가 아니다) 가리키는 `users` 행은 그때 이미 하드 삭제되거나
  익명화돼 있어 **저장된 개인정보로 이어지지 않지만**, *"actorUserId가 감사 행의 유일한 원본 사용자
  식별자"* 라는 서술은 **틀렸다.** 오늘 더한 `auth.login_rejected` 행도 `targetType: "users"`라 같은
  자리에 선다.
- **오늘의 값.** 403 두 갈래 **앞**에 `auth.login_rejected` 한 행(`reason: "blocked" | "withdrawn"` +
  provider). **`users` 행 쓰기 0건 · 응답 계약 0건 · 판정 순서(차단 → 탈퇴) 불변 · 정상 로그인
  무변경 · PII 0건**(`sub`·이메일·닉네임·토큰 — DNC-019). 어드민 프리셋은 **스물둘 → 스물셋**이고,
  그 옆에 **유령 부정 단언**이 함께 섰다(P-4 갱신 — 프리셋 전부가 서버 소스에 실재한다. 오늘 서버가
  기록하는 액션은 **마흔셋**이고, 그 하나가 오늘 더해진 값이다).
- ⚠️ **남은 사실(다음 결정의 입력) — `withdrawn_at`은 여전히 밖이다.** 파기 잡이 탈퇴 시각을 아는
  방법은 `updated_at` 하나뿐이고, 그 구조를 이 라운드도 건드리지 않았다(마이그레이션 0건 원칙).
  **탈퇴 계정의 행을 쓰는 새 경로가 생기면 P-1의 결함이 돌아오는데 그 부정 단언은 침묵한다** —
  오늘 더한 감사 행은 그 경고를 해소하지 않는다(다른 테이블이기 때문이다).

### Q-5. **판정을 테스트에만 두면 그 판정은 시드만 문다**

- **무슨 일이 있었나.** 라운드 74 B가 준비템 시기 표시에 세운 계약은 훌륭했고 시드의 어긋남 **열
  건**을 실제로 고쳤다. 그런데 그 계약이 무는 것은 **시드뿐**이었고, 어드민 CMS의 `timingLabel`
  자유 입력은 저장될 때 **서버·어드민 어디에서도 대조되지 않았다**. ⚠️ **그 구조적 이유가 이번
  라운드에 값으로 나왔다: 판정 로직(`stageNotationRanges`·`parseTimingLabelMonths`)이 `apps/api`의
  **테스트 파일 안에** 살고 있었다.** 계약이 옳을수록 그 사실이 안 보인다 — 초록이 계속 나오기
  때문이다. **판정이 테스트에만 있으면 그 판정이 미는 것은 테스트가 만드는 입력뿐이다.**
- ⚠️ **그리고 라운드 75가 이월의 *이유*까지 적어 둔 덕분에 이번 라운드가 값을 냈다.** O-2가 *"미결정"*
  이 아니라 *"의존 구조"* 라고 다시 적혀 있어서, 이번 라운드는 "막을까"를 묻지 않고 **셋 중 어느 문을
  열까**만 물었고 — 재어 보니 답이 이미 저장소 안에 있었다. **라운드 75가 그 이유를 적지 않았다면
  이번 라운드도 같은 자리를 "미결정"으로 지나갔을 것이다.**
- **오늘의 값.** 판정이 `apps/api/src/onboarding/timing-label-range.ts`로 **모듈 승격**되고(경계는
  `packages/domain` 프로빙에서 **파생** — 손으로 적은 개월 숫자 0건), 카탈로그 **생성·수정·게시·검토
  초안 네 경로**가 그 관문을 지난다(400 `ITEM_TIMING_LABEL_MISMATCH` — 메시지가 어긋난 구간을 그대로
  말한다). `seed-data.test.ts`는 지역 사본을 지우고 그 모듈을 import하며 **단언은 한 줄도 바뀌지
  않았다.** `apps/api` **802 → 815**. 셋 중 나머지 둘(빌드 설정 · 값 미러)을 기각한 근거는
  **O-2의 2026-08-30 종결**에 적었다.
- ⚠️ **CMS의 자유도는 줄이지 않았다 — 이것이 이 판정의 절반이다.** 파싱되지 않는 라벨(`"출산 전후"`·
  `"돌 무렵"`, 임신·세(歲) 표기)과 빈 값은 **오늘과 똑같이 저장된다.** 막는 것은 **명백한 모순**뿐이고,
  그것이 `"모르면 지어내지 않는다"`를 판정 층에서 지키는 방법이다. **자유도를 줄이는 판단은 오늘도
  하지 않았다.**
- **판정기의 규칙은 셋이다**(라운드 76 리뷰 M-3에서 서술을 정정했다 — 종전 *"조금이라도 겹치면 통과"*
  류의 한 줄 요약은 **틀렸다**: 그것은 ②의 절반만 말하고 ①③을 통째로 빠뜨린다).
  ① 라벨 구간이 **선택한 시기 합집합의 한 조각 안에** 있을 것(불연속한 조합의 사이 빈 구간은 덮은
  것이 아니다), ② **선택한 시기 하나하나가** 라벨과 겹칠 것(대칭 — 한 시기라도 한 달도 안 겹치면
  그 칩의 목록에 서면서 상세는 다른 나이를 말한다), ③ 라벨이 **칩 이름**을 그대로 말하면 **그 칩과
  겹치지 않는 더 이른 칩에 서 있지 않을** 것.
  ⚠️ ③의 꼬리("그 칩과 겹치지 않는")가 **라운드 76 리뷰 M-2가 더한 값**이다: 밴드 표는 서로소가
  아니라 `toddler_1_3`이 `"12-24개월"`과 `"24개월+"` 양쪽에 **의도적으로** 서는데, 그 중복을 "더 이른
  칩"으로 세면 `"24개월 이후"` 라벨은 **어떤 조합으로도 통과할 수 없었다**(①을 지나려면 `toddler_1_3`이
  있어야 하는데 그것이 있으면 ③이 거절한다). 운영자가 고칠 방법이 없는 거절은 판정이 아니라 봉쇄다 —
  이름을 말한 칩에 **함께 서 있는** 스테이지는 이른 칩의 증거가 아니라 그 중복 자신이다. 그리고 그
  자리가 다시 막히지 않도록 **전 밴드 칩 이름 × 조합 전수 프로빙**("통과 조합이 최소 하나 있다")이
  단언으로 섰다.
- **저장된 값 쪽 확인은 이미 계약 안에 있다**(라운드 76 리뷰 P-1 — 별도의 일회성 리포트를 돌리지
  않은 근거): `items-catalog-timing-label.test.ts`의 DB 스위트가 **실제로 저장된 시드 카탈로그 전
  행**을 읽어 같은 판정을 돌리고 전부 초록임을 센다(`judged >= 60`). 마이그레이션·일괄 정정은 그대로
  0건이고, "오늘 저장된 값이 전부 초록"이라는 사실만 그 단언이 진다.
- ⚠️ **루프는 두 트랙이 합쳐져야 닫힌다.** 이 트랙이 만드는 **사유**는 트랙 B(Q-2)가 열기 전까지
  운영자 화면에 닿지 못했다(`app/items/page.tsx`의 쓰기 catch 둘이 서버 메시지를 버렸다). 한 라운드
  안에서 **사유를 만드는 트랙과 그 사유를 나르는 트랙이 따로 섰고**, 그 둘이 파일을 한 곳도 겹치지
  않은 채 합쳐졌다는 사실을 값으로 남긴다. 그리고 그 400 코드는 라운드 통합 시 **모바일 `api-error`의
  제외 목록에 이유와 함께** 편입됐다(어드민 CMS 전용 코드라 앱 여정이 지나지 않는다는 사실이 값으로
  적힌다 — `apps/mobile` **4,627**).

## R. 라운드 77에서 확정한 판정 (2026-08-30 · GAP-077 트랙 F)

라운드 76이 축을 **목록이 닫힌 곳의 바로 옆 칸**으로 잡았다면, 라운드 77은 축을 **핵심 루프의
오른쪽 절반**(준비템 확인 → 링크 클릭 → 구매 확인 → 기록)과 **그 루프를 운영하는 사람의 화면**으로
옮겼다. K~Q절과 같이 **결함 보고가 아니라 다음 결정의 입력**이며, 다섯 다 2026-08-30 소스에서
확인됐다(라운드 77 트랙 A·B·C·D·E 머지 후).

⚠️ **이번 라운드의 가장 값진 관측: `"다시 시도해 주세요"` 가 이 저장소의 기본값이고, 그 기본값이
옳은지를 묻는 자리가 층마다 따로 있다.** 라운드 70~76은 그 물음을 **여정별로** 닫아 왔다 —
저장(70 B) · 조회(72~75) · 모듈(76 A) · 어드민 쓰기(76 B). 이번에 나온 셋은 여정이 아니라 **층**으로
갈렸다: 사용자의 **즉시 요청**(R-1) · 클라이언트 **전송 계층**(R-2) · **검증 전용 요청**(R-3).
셋 다 "재시도가 통하는가"를 **아는 코드가 바로 옆에 있는데** 묻지 않았다. 그리고 넷째는 문장이
아니라 **화면**에 있었다(R-4).

⚠️⚠️ **그리고 이번 라운드에 처음으로 이름이 붙은 것 하나: 버리는 것이 방패 노릇을 하고 있던 자리가
둘 나왔다.** ⓐ CSV 미리보기 catch는 사유를 통째로 버려서 **쓰기 타임아웃 문구의 거짓이 화면에 서지
않았고**(R-3), ⓑ 초대 화면은 훅의 문장을 버려서 **표가 자라도 아무 일이 없었다**(R-5).
**결함을 가리는 결함은 고치는 순서를 뒤집는다** — 사유를 나르기 전에 판정을 먼저 세워야 한다.

### R-1. **핵심 루프 4단계의 막다른 문장** — 서버는 이유를 코드로 말했고, 앱의 표는 그 코드를 밖에 뒀다

- **무슨 일이 있었나.** `apps/api/src/onboarding/items-catalog.service.ts`는 구매 링크 클릭이
  실패할 때 이유를 코드로 말한다 — `PRODUCT_LINK_NOT_FOUND`(404, **갈래 둘**: 링크가 `active:false`가
  되었거나 지워졌을 때 · **허용 도메인 목록 밖**일 때)과 `PRODUCT_LINK_URL_SCHEME_INVALID`(400).
  ⚠️ **셋 다 다시 눌러도 결과가 같다.** 그런데 앱의 `onError`는 `error` 인자를 **받지도 않았고**,
  연결이 있는 실패 전부에 *"링크를 열지 못했어요. **잠시 후 다시 시도해 주세요.**"* 한 문장을 세웠다.
  그 상세에 다른 판매처 링크가 두 개 더 서 있어도, 앱이 "기다리면 된다"고 말했으므로 사용자는 그것을
  누를 이유가 없다. **핵심 루프의 4단계에서 끊기고 5단계(구매 확인·기록)는 한 번도 열리지 않는다.**
- ⚠️ **형제 코드는 이미 표 안에서 정직했다.** `LINKED_PRODUCT_LINK_NOT_FOUND`(지출 저장 경로)는
  *"연결하려던 구매 링크를 찾지 못했어요. 링크 없이 다시 저장해 주세요."* 이고, 그 자리에는
  *"`잠시 후 다시`를 담지 않는다"* 는 부정 단언까지 서 있었다. **같은 사실(그 링크가 없다)을 두 코드가
  말하는데 한쪽만 정직했고, 새 문형을 지을 필요도 없었다**(표에 `ITEM_NOT_FOUND` 계열이 이미 있다).
- ⚠️⚠️ **이 판정의 본체 — 제외의 이유가 둘이면, 하나가 거짓이 되어도 조용하다.**
  `src/api/api-error.test.ts`가 그 코드를 표 밖에 두며 적은 이유는 둘이었다: *"클릭은 아웃박스를 타지
  않는 즉시 요청이라 큐 행이 남지 않는다"*(**참** — 그 스윕의 단위로는 옳은 제외) + *"그 화면이 자기
  문구를 쓴다"*(**오늘 거짓을 나른다**). 뒤엣것이 참이 아니게 된 날에도 스윕은 초록이다. 그래서
  규율을 값으로 적는다: **면제·제외의 사유는 그 스윕의 단위로만 적고, 그 밖의 사실은 사유가 아니라
  관측이다.** 라운드 76 Q-1이 얻은 문장(*"면제는 '판정을 안 지난다'가 아니라 '이 스윕이 요구하는
  배선이 없어도 된다'이다"*)의 쌍둥이다.
- **오늘의 값.** 표에 두 줄이 편입되고(`api-error.ts` — *"이 구매 링크는 더 이상 열 수 없어요. 내려간
  링크일 수 있으니 **이 준비템의 구매 링크를 다시 확인해 주세요.**"* · 주소 쪽 한 줄), 화면의 `onError` 한 자리가
  `apiErrorCodeOf`·`apiErrorMessageForCode`를 지난다 — **아는 코드면 폴을 띄우지 않고**(서버가
  답했다는 것이 곧 연결이 있었다는 뜻이다) `showLinkNotice`로, 모르는 실패면 **종전 그대로**
  `showLinkFailure`로 간다. **판정 신설 0건 · 새 모듈 0건 · 서버 0건**이고 종전 폴백·오프라인 갈래·
  `linkNoticeSeqRef` 걸쇠는 **바이트 불변**이다. `apps/mobile` **4,635**(`api-error` 40 → 44).
- ⚠️ **새 문장이 표기 방언의 대가를 처음으로 치렀다** — 꼬리에 `"잠시 후 다시"` 0건이고 표기는
  **띄어 쓴 쪽**이다. **통일하지 않기로 한 결정이 값을 치르는 자리는 이제 새 문장을 짓는 순간이다**
  (Q-1 갱신 참고).
- ⚠️ **접점 하나 — 적대적 리뷰 M-3이 닫았다.** `purchase-followup-flow.test.ts`가 이 화면의
  `onError` **시그니처 전체**(`"onError: () => {"`)를 구간의 **끝점**으로 잡고 있었는데, 트랙 A가 그
  핸들러에 `error` 인자를 달자 그 문자열이 사라졌다. `indexOf`는 실패를 던지지 않고 **-1**을
  돌려주고, `slice(start, -1)`은 *"파일 끝까지"* 를 뜻한다 — 그래서 *"열기 실패 catch는 구매 확인
  대기를 등록하지 않는다"* 는 단언이 **파일 절반을 훑는 다른 단언**이 된 채 초록이었다(트랙 A가
  블록을 옮겨 둔 덕분에 답만 우연히 맞았다). ⚠️ **바늘이 사라지면 그물이 찢어지는 것이 아니라
  넓어진다** — `indexOf`를 끝점으로 쓰는 소스 계약의 일반형 위험이다. 오늘의 값: 끝점을 인자 모양에
  매이지 않는 접두(`"onError: ("`)로 바꾸고, **두 자리 모두 `toBeGreaterThan(-1)` 가드**를 세웠다
  (같은 파일 42-44행이 이미 쓰던 형식). 트랙 A가 옮긴 `clickLink` 블록은 **그대로 둔다** — 되돌리는
  판단은 다음 라운드의 몫이고, 이 리뷰는 최소 수정이다.

### R-2. **연결 실패의 판정 공백** — 타임아웃에는 R19-F 판정 셋이 있었고, 연결 실패에는 없었다

- **무슨 일이 있었나.** `apps/admin/src/lib/admin-api.ts`의 `request()`는 **같은 함수 안에서** 두
  갈래를 정반대로 다뤘다. 타임아웃은 `method`·`idempotent`로 갈려 문장 셋을 고르고(읽기 / 비멱등 쓰기
  *"반영 여부가 확실하지 않으니 목록을 새로고침해 확인한 뒤 다시 시도하세요"* / 멱등 쓰기) `retryUnsafe`
  까지 싣는데, 바로 아래 연결 실패는 **그 두 값이 스코프에 이미 있는데도 읽지 않고** 한 문장을 던졌다 —
  GET·POST·PATCH·DELETE 전부가 *"…다시 시도해 주세요."* 를 받았다.
- ⚠️ **`fetch`의 거절은 "보내지 못했다"와 "보냈는데 답을 못 받았다"를 구분하지 않는다.** 연결이 서기
  전에 죽으면 서버는 아무것도 모르지만, 요청 본문이 나간 뒤 커넥션이 끊기면(리셋·TLS 종료·중간 프록시)
  서버는 이미 처리했을 수 있다. 클라이언트가 그 둘을 가를 방법은 없고 — **그것이 정확히
  `WRITE_TIMEOUT_MESSAGE`가 존재하는 이유다.** 같은 불확실성에 타임아웃은 보수적으로, 연결 실패는
  낙관적으로 말하고 있었다.
- **그 문장이 닿는 쓰기를 세어 봤다**(실측): `request()`를 부르는 쓰기 호출 **스물넷** 중 멱등키를
  실어 보내는 것이 **여섯**(준비템 생성 · 링크 생성 · CSV 일괄 적용 · 승인 게시 · 롤백 · 관리자 생성)
  이고, ⚠️ **나머지 열여덟은 멱등키가 없다** — 서버가 중복을 걸러 주지 않는 쓰기에 재시도를 권했다.
  라운드 76 B가 쓰기 catch 아홉을 한 벌로 모으면서 그 문장의 **도달 범위가 넓어졌고**(의도한 값이었다),
  그래서 고칠 자리도 하나로 모였다.
- **오늘의 값.** 연결 실패도 **같은 두 값으로만** 갈린다(`STATE_CHANGING_METHODS.has(method)` ·
  `Boolean(idempotencyKey)` — **새 판정 0건**). ⚠️ **타임아웃 상수를 재활용하지 않은 이유가 값으로
  적혀 있다**: 그 셋은 *"(10초)"* · *"(60초)"* 를 문장에 못박고 있어 연결 실패에 그대로 쓰면 거짓이다.
  그래서 **같은 규율의 새 문장 둘**이 섰고(이 라운드에서 새 한국어 문장이 서는 **유일한 자리**),
  **읽기 문장은 바이트 불변**이다. 타입도 늘리지 않아(`AdminApiError(0, …)` 그대로 · **새 클래스 0건**)
  `writeErrorMessage`·`loadErrorCopy`와 화면 전부가 **무접촉**이다. `admin-api.test.ts` **18 → 30**(적대적 리뷰 M-1이 둘, P-2가 하나를 더했다).
- ⚠️ **읽기 문장이 상수로 올라가지 않고 catch 자리에 리터럴로 남은 이유도 값이다.** 조회 한 벌의
  테스트(`admin-load-error-copy.test.ts`)가 그 한 줄을 **소스에서 정규식으로** 읽어 네트워크 갈래를
  재현한다 — 상수 이름으로 바꾸면 그 그물이 조용히 찢어지고, 그 스크레이프가 곧 **"읽기 바이트
  불변"의 안전망**이다. **무접촉 파일이 이 트랙의 계약을 대신 물고 있는 모양**이라 값으로 적는다.
- ⚠️⚠️ **정정(적대적 리뷰 M-1) — 축이 HTTP 메서드가 아니었다.** 위 "같은 두 값으로만 갈린다"는
  판정이 **메서드 하나로 갈리는 판정**이라, 반영을 확인할 **목록이 아예 없는 POST**까지 비멱등 쓰기
  문장을 받았다: `adminLogin`·`adminVerifyMfaLogin`·`adminLogout`·`adminChangePassword`·
  `adminMfaSetupStart`·`adminMfaSetupVerify`·`adminMfaDisable`, 그리고 검증만 하는
  `bulkPreviewProductLinks`. **로그인 화면이 그 첫 자리다** — 운영자가 아직 목록을 본 적도 없는데
  *"목록을 새로고침해 확인한 뒤 다시 시도하세요"* 를 읽는다. ⚠️ 그리고 그중 `adminMfaSetupStart`는
  **조회 실패 한 벌의 열여섯 자리 중 하나**(`AdminShell`의 MFA 등록 관문)가 부르는 요청이라,
  트랙 B는 *"조회 열여섯은 아무것도 달라지지 않는다"* 는 자기 계약을 **한 자리에서 조용히 깼다**
  (그 자리의 테스트가 소스 스크레이프라 초록이었다). **오늘의 값**: `request()`가 명시 플래그
  `retrySafe`를 받고(추론 0건 — 메서드로 유추하면 다음 라운드의 새 POST가 조용히 한쪽에 떨어진다)
  그 여덟이 **연결 실패·타임아웃 양쪽에서** 읽기와 같은 규율의 문장을 받는다. 그래서 오늘의 분류는
  셋이다 — 쓰기 호출 **스물넷 = retrySafe 여덟 + 멱등 여섯 + 멱등키 없는 진짜 쓰기 열**.
  ⚠️ *"멱등키 없는 쓰기 열여덟"* 이라는 종전 수치가 가리키던 자리는 실제로는 **열**이었다.
  ⚠️ **타임아웃 쪽 문장 하나가 늘었다**: 이 여덟도 상한은 **쓰기 60초 그대로**라(bulk-preview 500행이
  실제로 10초를 넘긴다) 읽기 문장을 그대로 쓰면 *"(10초)"* 가 거짓이 된다 — 규율은 같고 괄호 안의
  값만 다른 문장 하나(*"요청 시간이 초과됐어요(60초). 네트워크 상태를 확인하고 다시 시도해 주세요."*).
  **타임아웃 갈래 셋의 문장·`retryUnsafe`·상한 두 값은 무변경**이고, 이로써 **"조회 열여섯 무변경"이
  다시 사실이 된다**(`load-error-copy.ts`·`AdminShell.tsx` 무접촉).
- ⚠️ **관측 하나(적대적 리뷰 S-5) — 연결 실패 문장에서는 두 지시의 순서가 값이다.** 비멱등 쓰기의
  연결 실패는 *"네트워크 상태를 확인하고, 목록을 새로고침해 확인한 뒤 다시 시도하세요"* 로 **연결
  확인이 먼저**다. 타임아웃 쪽(`WRITE_TIMEOUT_MESSAGE`)에는 그 절이 아예 없다 — 응답을 기다렸다는
  것 자체가 연결이 있었다는 뜻이기 때문이다. **같은 규율의 두 문장이 지시 하나만큼 다른 이유가
  실패의 성질에 있다**는 사실을 값으로 남긴다(다음 라운드가 두 문장을 하나로 합치려 할 때의 입력).
- ⚠️ **`isConnectionFailureError`의 판정 재료가 code로 옮겨 갔다**(적대적 리뷰 P-2). 종전 술어는
  `status === 0 && !(타임아웃)` 이었는데, status 0은 *"응답이 아예 없었다"* 는 뜻일 뿐이라 만드는
  자리가 늘 수 있다(오늘 둘). **셋째가 생기는 날 그 술어는 그것을 연결 실패로 읽고 아무 단언도
  깨지 않는다.** 이제 연결 실패를 만드는 자리가 `CONNECTION_FAILURE_CODE`를 스스로 붙이고 술어는
  그 code만 읽는다(타임아웃의 `"TIMEOUT"`과 같은 축). 타입·status·화면은 전부 무변경이다.

### R-3. **버리는 것이 방패였다** — 미리보기 catch가 사유를 버려서 거짓 하나가 화면에 서지 않았다

- **무슨 일이 있었나.** `ProductLinkBulkReplace.tsx`의 `handlePreview` catch는 `err`를 **401 판정에만
  쓰고 버렸다.** 그래서 한 문장이 **모든 실패**에 섰다 — *"미리보기에 실패했어요. **CSV 형식을
  확인하고** 다시 시도해 주세요."*(403 · 5xx · 연결 실패 · 60초 타임아웃 · DTO 검증 400). **그중 CSV
  형식이 원인인 것은 하나뿐**이다. 라운드 76이 `app/reviews/page.tsx`에서 고친 그 모양(**첫 문장은
  참, 꼬리는 없는 원인의 단정**)이 **면제 목록 안에서** 살아 있었다.
- ⚠️⚠️ **이 절이 남기는 관측 — 그 자리에 한 벌을 그냥 붙였으면 새 거짓이 섰다.**
  `POST /bulk-preview`는 상한 판정에서 **쓰기(60초)** 로 분류되고 멱등키가 없어, 사유를 나르는 순간
  *"**반영 여부가 확실하지 않으니** 목록을 새로고침해 확인한 뒤…"* 가 뜬다 — **아무것도 쓰지 않는
  요청에 대한 거짓**이다. **오늘 그 문장이 화면에 서지 않던 유일한 이유가 이 catch가 사유를 통째로
  버렸기 때문**이고, 그러니 **버리는 것이 우연히 방패 노릇을 하고 있었다.** 결함을 가리는 결함은
  **고치는 순서를 뒤집는다** — 나르기 전에 판정을 먼저 세워야 한다(그것이 이 트랙에 갈래 셋을
  요구한 이유다. 트랙 B가 연결 실패를 갈래 셋으로 나눈 뒤에는 **연결 실패 전용 갈래**까지 넷이 됐다).
- **면제의 이유도 절반만 맞았다.** `WRITE_ERROR_COPY_EXEMPT_SITES`의 `#bulk-preview` 사유는 *"미리보기는
  서버가 검증만 하고 아무것도 쓰지 않는 요청이라 이 대장의 단위(쓰기)가 아니다"* 였다. **그 절반은
  참**이고, **쓰기가 아니라는 사실은 *사유를 버려도 된다*는 뜻이 아니다** — R-1이 제외 사유에서 얻은
  그 규율이 **면제 사유에서 한 번 더 났다**(같은 라운드에 같은 병이 두 자리).
- **오늘의 값.** catch가 갈래 넷을 지나고(401 → 타임아웃 전용 → 연결 실패 전용 → `writeErrorMessage`),
  폴백에서 **원인 단정 한 절이 빠졌다**(꼬리는 화이트리스트의 `"다시 시도해 주세요."` — **새 꼬리 0건**).
  대장은 **면제 → 자리 수**로 옮겨 총합 **열넷 → 열다섯**이고, ⚠️ **라운드 76 B의 부정 단언(*어떤 쓰기
  폴백도 원인을 단정하지 않는다*)이 고치기 전에 빨갰다** — 그 자리가 대장에 들어오는 순간 꼬리
  화이트리스트가 걸렀다. **쓰기 단위의 대장이 읽기 의미의 POST를 하나 안게 됐다**는 사실도 그 자리에
  값으로 적혀 있다(다음 라운드가 그 예외를 다시 세지 않도록). 남은 면제 둘(`#recheck-current-state` ·
  `#copy-csv-header`)은 **사유 바이트 불변**이고, 둘 다 화면에 세우는 문장이 없다는 점에서 성질이 다르다.
- ⚠️ **메인 통합이 판정 하나를 신설했다** — `isConnectionFailureError`(`admin-api.ts`). 화면이 status
  코드를 손으로 읽지 않고 술어를 읽게 하려는 자리이고, **트랙 B가 만든 문장과 트랙 C가 막는 자리가
  봉합되는 지점**이다(두 트랙의 관측이 하나로 합쳐진 유일한 자리라 값으로 남긴다).

### R-4. **역할 게이트의 세 번째 상태** — `isEditor` 하나로 갈린 화면에서 `analyst`는 `admin`의 화면을 본다

- **사실.** 준비템·링크·고지 문구 세 화면이 역할을 `isEditor` **하나로만** 읽어 갈래가 둘뿐이었다 —
  편집자면 "검토 요청", **아니면 곧바로 저장**. `analyst`는 "아니면" 쪽에 떨어져 `admin`과 **똑같은
  화면**을 봤다([추가]·[저장] 버튼 · 전체 입력 폼 · 성공 배너 문안까지). 서버는 그 쓰기를
  `@RequireAdminRoles("admin")`으로 막고 **`analyst`에게 열린 쓰기 경로는 0건**인데, 화면은 누르기
  전까지 그 사실을 말하지 않는다. 라운드 76 전에는 그 실패가 영문(*"Admin access is required."*)이었고,
  라운드 76 뒤에는 *"저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요."* 다 — **둘 다 그가
  무엇을 해야 하는지 말하지 않는다.**
- ⚠️ **같은 저장소가 그 답을 이미 두 번 적어 두었다.** `app/categories/page.tsx`는 `canEdit`으로 갈려
  캡션 한 줄을 세우고(*"지금 계정은 조회만 할 수 있어요. 수정은 관리자(admin) 권한이 필요해요."*),
  `app/reviews/page.tsx`는 `isAdmin`으로 승인·롤백 버튼을 가린다. **다섯 화면 중 둘은 정직하고 셋은
  아니었다.** 그리고 **오늘 이 사실을 무는 테스트는 0건이었다** — 기존 넷은 `editor`와 `admin`만
  확인했고 **`analyst`가 무엇을 보는지는 아무도 묻지 않았다.**
- ⚠️⚠️ **판정: 내비 감춤과 컨트롤 감춤은 서로 다른 축이다.** `AdminShell.tsx`의 `NAV_ITEMS`에는 이미
  `roles` 기계가 있고 오늘 셋이 쓴다. **그러나 이 축의 답은 내비를 감추는 것이 아니다** —
  `analyst`는 준비템·링크·고지를 **읽어야** 한다(그것이 분석가의 일이다). 답은 `/categories`가 이미
  고른 그 답, **편집 컨트롤만** 감추는 것이다.
- **오늘의 값.** 세 화면의 제출 컨트롤 **여섯 자리**가 `canEdit`(`admin` 또는 `editor` — 편집자는 검토
  요청 경로가 **실제로 통한다**)을 지나고, 거짓이면 그 자리에 캡션 한 줄이 선다. 캡션은
  `src/lib/admin-role-copy.ts`(신설 — **문자열 상수 하나**)로 올라가 **사본이 저장소에 하나뿐**이고
  **문자열은 바이트 불변**이다. **새 한국어 문구 0건 · 서버 0건**이며 `isEditor` 갈래(검토 요청 문안
  넷·성공 배너 둘·힌트 넷)와 **쓰기 catch 2·2·2**는 무변경이다(컨트롤을 감출 뿐 catch를 지우지
  않는다). 전수 단언의 단위는 **다섯 화면**이다. `apps/admin` **510**(신설 **17** — 적대적 리뷰 S-1·S-2가 둘을 더했다).
- ⚠️ **신설 모듈이 상수 표 스크레이프의 단위가 아니라는 사실을 주석 한 줄로 적었다** — `Record` 표가
  아니라 문자열 상수 하나라 라운드 75 E의 전수 스크레이프에도, 그 제외 목록에도 새 줄이 필요 없다.
  **여기에 표를 하나라도 더하는 라운드는 그 대장부터 열어야 한다.**
- ⚠️ **접점 하나(다음 라운드의 입력).** `admin-categories-users-lookup.test.ts`(비소유)가 categories
  소스에서 그 리터럴을 찾아 주석 인용을 남기고 있다. **그 옛 단언을 상수 import 대조로 바꾸면 인용을
  지울 수 있다.**
- ⚠️⚠️ **정정(적대적 리뷰 S-1) — 캡션이 화면 자신의 게이트보다 한 칸 위를 요구했다.** 위 "문자열
  바이트 불변"은 **사본을 하나로 모으는 축에서는 옳았지만**, 그 한 문장이 게이트가 다른 다섯 화면에
  나뉘어 서면서 셋에서 거짓이 됐다: 준비템·링크·고지의 게이트는 `admin || editor`인데 캡션은
  *"수정은 관리자(admin) 권한이 필요해요"* 라고 말한다 — 그것을 읽은 **편집자**는 자기에게 이미 있는
  권한(검토 요청 경로)을 관리자에게 요청하러 간다. **오늘의 값**: 상수가 **둘**이 되고
  (`ADMIN_WRITE_ROLE_NOTICE` — 게이트가 `admin` 하나인 화면용, **바이트 불변** ·
  `ADMIN_EDITOR_WRITE_ROLE_NOTICE` — *"…수정은 편집자(editor) 이상 권한이 필요해요."*), 어느 화면이
  어느 문장을 부르는지가 **대장의 `allows`에서 파생**된다(손으로 고르는 자리가 아니다). 카테고리는
  검토 경로가 없어 정말 `admin` 전용이라 종전 문장 그대로이고, 비소유 계약
  (`admin-categories-users-lookup.test.ts`)이 찾는 리터럴도 그래서 **무접촉**이다.
- ⚠️⚠️ **정정(적대적 리뷰 S-2) — 게이트 위치 판정이 부분 문자열이었다.** 전수 단언 ⓐ는 제출 컨트롤을
  감싸는 표현식 **머리말이 게이트 이름을 담기만 하면** 통과였다. 그래서 갈래가 **뒤집혀도**
  (`{!canEdit ? <저장 버튼/> : <캡션/>}`) 초록이다 — 이 계약이 막으려던 바로 그 결함을 재현해도
  아무것도 빨개지지 않는다. ⚠️ **부정형을 단순히 배제할 수도 없다**: 카테고리 화면이 실제로 쓰는
  모양이 `{!canEdit ? <->  : <저장 버튼/>}` 라, 컨트롤이 **거짓 갈래**에 있는 것이 정상이다. 오늘의
  값: 판정이 최상위 삼항을 갈라 **컨트롤이 어느 갈래에 있는지**까지 읽고(조건이 긍정이면 참 갈래,
  부정이면 거짓 갈래), **뒤집힌 소스가 실제로 빨개지는 것을 재현 단언으로 못박았다** — 강화 자체가
  침묵으로 되돌아가지 않게.

### R-5. **훅의 문장을 불리언 한 칸으로 읽는 구조** — 오늘 결함이 아니었던 이유와, 표가 자라면 결함이 되는 이유 (Q-1 P-3 종결)

- **사실.** `app/family/invite.tsx`는 공용 훅에게 **완성된 문장**을 받아 놓고(`useSaveErrorCopy`),
  그것을 `!== OFFLINE_SAVE_NOTICE` **한 번 비교하고 버린 뒤** 문장을 모듈에서 다시 받았다. ⚠️ **그래서
  "서버가 코드로 말한 실패"의 문장은 이 화면에 구조적으로 설 수 없었다** — 아는 코드가 오면 훅의 답이
  `OFFLINE_SAVE_NOTICE`가 아니므로 `isOnline: true`가 되고, 모듈은 일반 폴백을 돌려준다. 라운드 76은
  그 파생을 의도로 적고 단언까지 세웠고(*"서버가 코드를 준 실패는 오프라인으로 읽히지 않는다"*),
  **그 단언은 참이었고 참인 채로 문장을 버렸다.**
- **오늘 결함이 아니었던 이유.** 초대 생성이 서버에서 얻는 코드는 `FORBIDDEN` **하나**이고, 그것은
  모듈의 **첫 갈래**가 이미 전용 문장으로 답한다. **두 판정이 오늘 같은 값으로 수렴한다.**
- ⚠️ **표가 자라는 순간 결함이 되는 이유.** `API_ERROR_MESSAGES`는 라운드마다 코드를 받아 왔고
  **이번 라운드 R-1이 둘을 더했다.** 초대 경로에 코드가 하나 생기는 날(초대 개수 상한 · 이미 구성원)
  화면은 **아무 단언도 깨지 않은 채** 일반 문장을 말한다 — 정리해야 할 대기 초대는 **바로 전 화면**에
  목록으로 떠 있는데. **버리는 것이 방패였던 두 번째 자리다**(R-3과 같은 모양: 표가 자라도 아무 일이
  없다는 사실이 곧 그 구조가 답을 못 한다는 사실이다).
- **오늘의 값.** 모듈이 인자 하나를 더 받아(`serverCopy`) 갈래가 **넷**이 된다 — **403 → 오프라인 →
  서버가 말한 문장 → 초대 전용 폴백**. `serverCopy`가 훅도 모르는 폴백이면 종전 그대로다.
  ⚠️ **오늘 도달 가능한 모든 입력에서 출력이 바이트 불변**이고(403 · 오프라인 · 모르는 실패 ·
  null/undefined), 두 문자열과 `isOnline` 파생 표현도 **무변경**이다. 계약의 본체는 **표의 아무 코드로나
  그 문장이 화면에 실제로 서는 것을 재현하는 전수 루프**다. `src/offline/**`는 **전부 무접촉**
  (`OFFLINE_AWARE_SAVE_ERROR_SCREENS` 다섯 · 모듈 대장 셋 6·8·2 그대로 — 그 조건이 트랙 A와 E를
  파일로 갈라 놓은 근거다). `apps/mobile` **4,631 → 4,635**(R-1 합산).
- ⚠️ **형제 화면과 축이 같아졌다.** `app/family/accept/[token].tsx`는 훅의 문장을 **그대로 쓴다** —
  한 여정의 두 화면이 같은 훅을 정반대로 쓰던 이유가 값으로 남고, 이제 그 갈라짐이 없다.
  **Q-1이 남긴 P-3 잔여는 여기서 종결한다.**

### R-6. **이번 라운드가 실측하고 기각·보류한 것** (다음 라운드가 다시 세지 않도록)

- **표기 방언(`"시도해 주세요"` vs `"시도해주세요"`) — 재실측했고 이번에도 통일하지 않는다.**
  수치는 Q-1이 남긴 그대로다(띄어 쓴 쪽 **30건 / 파일 열여덟** · 붙여 쓴 쪽 **10건 / 파일 셋**).
  기각 사유도 그대로다(둘 다 어법상 허용 · **거짓이 아님** · 어느 트랙의 축도 아님).
  ⚠️ **정정(적대적 리뷰 M-2)**: 여기에 *"31건 — 트랙 A의 대장 문장 하나가 늘었다"* 라고 적혀
  있었으나 2026-08-30 재실측은 **30건**이고, 트랙 A의 두 문장은 *"…확인해 주세요."* 로 끝나 이
  수치를 **늘리지 않는다** — 그것이 R-1 규율이 지켜졌다는 증거다.
  **다만 그 대가를 확인한 자리가 하나 늘었다 — Q-1 갱신 참고.**
- **`withdrawn_at` 컬럼 — 보류 유지**(마이그레이션 0건 원칙 · P-1 → Q-4가 남긴 구조 그대로).
  ⚠️ **이번 라운드의 어느 트랙도 `apps/api/src/auth/**`·`users` 테이블·파기 잡을 열지 않았다.**
- **파기 phase 3의 `targetId`(라운드 76 리뷰 S-4 후속) — 기각.** 제품 표면에 *"탈퇴하면 감사 로그가
  익명화된다"* 는 문장이 **0건**이고, 지우면 *"누구에 대한 조치였는가"* 라는 감사 기록의 본체가
  사라진다. **허위 표시 축이 아니라 보존 정책 결정**이고 그 판단은 P-2(법무)와 같은 성질이다.
- **준비템 탭의 비가상화 렌더 — N-4의 문턱 아래라 제안하지 않는다**(N-4 갱신 참고).
- **손배선 연결 폴 다섯 — 결함 아님(전수 확인).** `useErrorTimeConnectivity`(라운드 72 E) 밖에 남은
  `isCurrentlyOnline()` 호출 다섯 중 **라운드 52 C-07이 없앤 두 구멍**(언마운트 setState · 늦게 도착한
  옛 판정)이 서는 자리는 **하나도 없다** — 넷은 setState를 하지 않고, 커머스 상세는 `linkNoticeSeqRef`
  걸쇠로 두 구멍을 직접 막는다. **다음 라운드가 같은 스윕을 다시 돌리지 않도록 적어 둔다.**
- **하단 탭 넷 · 죽은 라우트 0건은 이번 라운드가 다시 세지 않았다**(라운드 76이 전수로 확인했다 —
  **재스윕하지 않았다는 사실**이 다음 라운드의 입력이다).
- ⚠️ **다음 라운드 후보 둘(적대적 리뷰 P-1·P-3) — 값만 남기고 이번에는 열지 않는다.**
  - **P-1: `analyst`에게 편집 **입력칸**은 그대로 남는다.** R-4는 제출 컨트롤만 감췄고(그것이 그
    트랙의 축이었다 — 읽기 권한자가 값을 보는 것은 정당하다는 `/categories`의 판정), 그래서
    준비템·링크·고지의 **입력 폼 자체는 `analyst`에게도 편집 가능한 채로** 서 있다. 값을 고치고
    캡션을 읽고서야 저장할 수 없다는 것을 아는 순서라, "누르기 전에 말한다"는 목표의 **절반만**
    닿았다. ⚠️ 다만 폼을 `readOnly`로 내리는 것은 **다섯 화면의 입력 컴포넌트 전수**를 여는 축이라
    별도 결정이다(그 컴포넌트들은 `mode`로만 갈리고 역할을 모른다).
  - **P-3: `admin-api.ts`의 수치 계약은 "함수당 호출 하나"를 가정한다.** 스물넷은 소스에서
    `method: "…"` 리터럴을 세고, 여덟·여섯은 `{ retrySafe: true }`와 `idempotencyKey?: string`
    시그니처를 센다 — 한 함수가 `request()`를 **두 번** 부르거나 조건부로 메서드를 고르는 날 세 수치가
    조용히 어긋난다(오늘은 전수가 함수당 하나라 참이다). **함수 단위 파싱으로 바꾸는 것이 다음
    라운드의 후보**이고, 그때 `adminApiWriteFunctions()`(`admin-write-role-gate.test.ts`)가 이미 쓰는
    `\nexport function` 분할이 그 본보기다.
- ⚠️ **갱신 (2026-08-30 · 라운드 78) — 후보 둘은 채택돼 닫혔고, 표기 방언 수치는 그대로다.**
  **P-1은 트랙 C**(S-3), **P-3은 트랙 D**(S-4)가 가져갔다 — 이월 목록에서 **둘이 빠진다**.
  ⚠️ **표기 방언은 재실측했고 값이 변하지 않았다**: 띄어 쓴 쪽 **30건 / 파일 열여덟** · 붙여 쓴 쪽
  **10건 / 파일 셋**(2026-08-30 · 주석·테스트 제외 · `app/**`+`src/**`). 기각 사유도 그대로다(둘 다
  어법상 허용 · 거짓이 아님 · 어느 트랙의 축도 아님). ⚠️ **그런데 이번 라운드도 그 대가를 치를 자리가
  있었다** — 트랙 A가 표에 **세 줄**을 더했는데, 셋 다 기존 문장(`child-form.ts`의 폼 상수 둘 · 서버
  원문 하나)에서 오므로 **이 수치를 늘리지 않았다.** R-1 규율이 **두 라운드 연속** 지켜졌다는 증거다.
  ⚠️ **`withdrawn_at`은 보류 그대로다**(마이그레이션 0건 원칙 · P-1 → Q-4 → R-6이 남긴 구조 그대로):
  이번 라운드의 어느 트랙도 `apps/api/src/auth/**`·`users` 테이블·파기 잡을 열지 않았다(트랙 B가 연
  것은 `worker/jobs/scheduled-publish.job.ts` 하나이고 파기 잡은 **읽기 전용 본보기**였다).
  **파기 phase 3의 `targetId`도 기각 그대로**이고, 이번 라운드가 새로 기각한 넷은 S절 머리말에 있다.

## S. 라운드 78에서 확정한 판정 (2026-08-30 · GAP-078 트랙 F)

라운드 77이 축을 **핵심 루프의 오른쪽 절반**(준비템 → 링크 → 구매 → 기록)으로 잡았다면, 라운드 78은
축을 그 루프의 **왼쪽 끝 — 루프가 시작되기도 전의 관문**(아이 프로필 · 임신→출생 전환)과, 루프를
**사람 없이** 돌리는 층(백그라운드 워커)으로 옮겼다. K~R절과 같이 **결함 보고가 아니라 다음 결정의
입력**이며, 다섯 다 2026-08-30 소스에서 확인됐다(라운드 78 트랙 A·B·C·D·E 머지 후).

⚠️ **이번 라운드의 가장 값진 관측: 라운드 77이 세운 다섯 판정이 전부 "한 칸 옆"에서 그대로 다시
성립했다.** R-1(표 밖의 코드) → **아이 프로필 여정**(S-1) · R-3(버리는 것이 방패)의 **거울상** →
예약 게시 잡(S-2) · R-4(역할 게이트) → **편집 컨트롤**(S-3) · R-6 P-3(단위가 섞인 수치) → 그대로
(S-4) · R-1 리뷰 M-3(`indexOf` 끝점) → **저장소 전역의 일반형**(S-5 · 스윕 실측 **자리 121**.
⚠️ **정정 — 라운드 78 리뷰 S-5**: 이 자리에 정찰의 어림값 *74* 를 적어 두었는데, S-5 본문이 이미
"스윕 쪽이 옳다"고 적어 둔 것과 어긋났다. 요약 줄이 어림값을 나르면 인용이 실측을 대신한다 —
라운드 74 O-3이 이름 붙인 그 병이다). 고친 자리는 고쳐졌고 **같은 병이
이웃 칸에 그대로 있었다.** 그래서 값으로 적는다: **판정을 세운 라운드는 그 판정이 성립하는 자리를
전부 닫지 않는다** — 그것이 이월 목록이 매 라운드 다시 차는 이유이고, 이번 라운드가 **다섯 중 다섯을
이월에서 꺼내 쓴** 이유다.

⚠️⚠️ **그리고 이번 라운드에 처음 이름이 붙은 것 하나: "담아서 돌려주는데 아무도 읽지 않는다."**
R-3은 *버리는 것이 방패였다* 를 이름 붙였다(사유를 버려서 거짓이 화면에 서지 않았다). S-2는 그
**거울상**이다 — 사유를 버리지 않고 **정직하게 요약에 담아 돌려주는데**, 그 요약을 읽는 코드가
**0건**이라 결과가 같다. **버리는 것과 담아 두고 아무도 안 읽는 것은 관측 가능성에서 구별되지
않는다.** ⚠️ **구별되는 순간은 고칠 때다** — 버린 자리는 사유를 나르는 배선을 새로 만들어야 하고
(R-3 · 라운드 77 트랙 C), 담아 둔 자리는 **이미 있는 신호 경로에 연결만 하면 된다**(그것이 트랙 B가
어드민 파일을 **0건** 열고도 대시보드 문장을 살린 이유다). **다음 라운드가 먼저 세어 볼 만한 것:
요약·반환값을 읽는 소비자가 0건인 자리.**

⚠️ **후보가 0건이었던 축 하나를 값으로 남긴다 — 지출→리포트 데이터 정확성**(이번 라운드가 가중해
따라간 세 방향 중 하나이고, **전수로 재었더니 열 자리가 없었다**). 다음 라운드가 같은 스윕을 다시
돌리지 않도록 여섯 근거를 적는다.
- **합계 술어가 한 곳이다.** `expenses-store.service.ts`의 `sumExpenses`가
  `deletedAt: null` + `expenseType: "expense"`(선물·환불 제외 — DNC-014/015) 하나를 들고, 홈·월간·
  추이·연간·누적·카테고리 **여섯 집계 전부**가 그 술어를 글자 그대로 되풀이한다
  (`reporting-store.service.ts`). 목록의 `totalAmountKrw`도 배열 합이 아니라 그 DB 집계다
  (페이지네이션이 총액을 흔들지 않게 한 자리).
- **기간 경계도 한 곳이다.** `getSeoulMonthRange`의 `[startInclusive, endExclusive)` 하나를 여섯이
  함께 쓰고, 연·분기 경계는 정수 산술이라 서버 로컬 타임존과 무관하다(`trailingYearMonths`).
  날짜가 `date` 컬럼(일자)이라 **시간대가 개입할 자리가 없다.**
- **경계 입력의 500 구멍은 이미 막혀 있다.** `YEAR_MONTH_INPUT_PATTERN`이 월을 `01-12`로 묶고,
  그 주석이 *"unbounded `\d{2}`가 `2026-13`을 통과시켜 `getSeoulMonthRange`에서 500으로 터지던"*
  사실을 값으로 적어 두었다.
- ⚠️ **`refund` 구분은 서버가 만들 수 없는 값이다 — 결함 아님(전수 확인).** `EXPENSE_TYPES`는
  셋인데 생성·수정 DTO는 `expense|gift`만 받고(`packages/contracts/src/schemas.ts`),
  `apps/api/src`에서 `"refund"`를 쓰는 자리는 **주석 한 줄**뿐이다. 앱의 환불 처리 전량(배지 ·
  `REFUND_BADGE_NOTICE` · 선물 체크박스 비활성 · `expenseTypeForWire` · `LocalExpenseKind` ·
  CSV 구분 열 · 반복/자동완성 제외)은 **이미 저장된 행을 잃지 않기 위한 보존 로직**이고 허위 표시가
  아니다(REC-121/121b가 이미 그 판단을 적었다 — 부호 계층 복원은 서버 `sumExpenses` 변경이 선행이라
  별도 티켓이다).
- **CSV 왕복의 다섯 열 손실 — 범위 밖으로 기각(상태 변화 0건).** 재가져오기가 살리는 칸은 날짜·항목·
  금액·메모 넷이고 구분·카테고리·판매처·결제수단·출처는 버려진다. ⚠️ **구분이 사라지면 선물·환불 행이
  지출로 되돌아온다**(DNC-015가 합계에서 빼는 행이 합계에 들어온다). 되살리려면 `import_rows`에 칸을
  더하는 **스키마 변경 + 확정 경로 변경**이 함께 필요하고 그 결정은 DNC-012·DNC-015 판단이 선행이라,
  **마이그레이션 0건 원칙 밖의 별도 결정**이다. 오늘 그 사실은 **소스 주석과 왕복 테스트 양쪽에 값으로
  고정돼 있어** 조용하지 않다(`src/export/expense-csv.ts` · `apps/api/test/mobile-export-csv-roundtrip.test.ts`).
- **결론: 이 축에서 이번 라운드가 열 자리는 없었다.** 재지 않은 것이 아니라 **재었고 후보가 0건**이다.

### S-1. **루프에 들어오기 전 관문의 막다른 문장** — 그 여정에는 스윕이 없어서, 표에 **이미 있던** 문장조차 설 수 없었다

- **무슨 일이 있었나.** `apps/api/src/onboarding/onboarding-core.service.ts`는 아이 프로필 여정의
  실패를 코드로 말한다 — `CHILD_BIRTH_DATE_FUTURE`(400) · `CHILD_DUE_DATE_BEYOND_TERM`(400) ·
  `CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED`(400) · `CHILD_STAGE_INPUT_REQUIRED`(400). ⚠️ **넷 다 다시
  눌러도 결과가 같은데**, 온보딩 화면은 그중 어느 것에도 답하지 못하고 *"저장하지 못했어요…"* 한
  문장을 세웠다. 임신 중에 가입한 사람이 [아이가 태어났어요]를 누르는 자리가 **핵심 루프에 들어오기
  전의 관문**이고, 거기서 막히면 100일 리포트·준비템 밴드·마일스톤 카운트다운이 전부 **출산예정일에
  고정된 화면**에 남는다(라운드 27이 stageMode 전환을 만든 바로 그 이유다).
- ⚠️ **그 여정에는 스윕이 0건이었다.** `src/api/api-error.test.ts`의 교집합 계약은 단위가 **아웃박스·
  준비템 상태 큐**이고 `outboxPathFiles`는 넷이라 `onboarding-core.service.ts`가 그 안에 없다. 그래서
  표에 있던 유일한 아이 코드(`CHILD_BIRTH_DATE_TOO_OLD`)는 **라운드 69 B가 손으로** 넣은 것이었고,
  그 뒤 서버가 더한 세 코드는 **아무 단언도 깨지 않은 채** 표 밖에 있었다.
- ⚠️⚠️ **이 판정의 본체 — 표를 넓히는 것만으로는 닿지 않는 화면이 있다.** 온보딩 모듈
  (`src/onboarding/step-ui.tsx`의 `onboardingSaveErrorMessage`)은 아는 코드가 **둘**뿐이고
  `API_ERROR_MESSAGES`를 **부르지 않았다.** 그래서 **표에 이미 있던 `CHILD_BIRTH_DATE_TOO_OLD`조차
  이 화면에는 구조적으로 설 수 없었다** — 같은 실패가 아이 관리 화면(`app/settings/children.tsx` →
  `useSaveErrorCopy` → `resolveSaveErrorCopy` → 표)에서는 *"20년보다 오래된 날은 고를 수 없어요."*
  이고 온보딩에서는 일반 폴백이었다. **한 여정의 두 화면이 같은 실패를 정반대로 말하던 자리**이고,
  라운드 77 R-5가 `invite.tsx` ↔ `accept/[token].tsx`에서 잡은 그 비대칭의 쌍둥이다.
- **오늘의 값.** 표에 **세 줄**이 편입되고(`child-form.ts`의 리터럴 하나가
  `CHILD_BIRTH_DATE_FUTURE_ERROR` 상수로 승격돼 읽히고, `CHILD_DUE_DATE_BEYOND_TERM_ERROR`는 이미
  있던 상수를 읽으며, 전환 거절만 서버 원문 그대로다 — **새 한국어 문장 0건 · 문자열 바이트 불변**),
  온보딩 모듈의 갈래가 **다섯**이 된다: **전용 셋 → 표 → 오프라인 → 전용 폴백.**
  ⚠️⚠️ **정정 — 라운드 78 리뷰 M-1**: 처음 이 갈래는 표를 오프라인 **뒤**에 두고 그 근거를
  *"오프라인으로 판정된 실패에는 서버 코드가 애초에 없다"* 로 적었는데 **그 근거가 거짓이다** —
  `isOnline`은 실패 값에서 파생한 값이 아니라 카드가 뜨는 순간 도는 **독립된 폴 한 번**이라,
  서버가 400을 준 직후 연결이 끊기면 두 사실이 **동시에** 참이고 이유를 아는 실패가 오프라인 문장으로
  접혔다. 순서는 **코드 → 오프라인**으로 되돌렸다(표를 직접 보는 저장소의 다른 둘 —
  `resolveSaveErrorCopy`·`memberMutationErrorMessage` — 이 세운 그 순서다. `inviteCreateErrorMessage`
  만 오프라인이 앞인데 그 자리는 **표를 직접 보지 않는다** — 이미 표를 지난 훅의 답을 받는다).
  ⚠️ **셋째 전용 갈래는 리뷰 M-2가 세웠다**: `CHILD_NOT_FOUND`의 표 문장이 *"아이 목록에서 확인해
  주세요"* 로 끝나는데 **온보딩에는 그 목적지가 없다**(공동양육자가 아이를 지우면 ONB-003·004 저장이
  그 404를 받는다 — 도달 경로는 실재한다). 문장은 아이 삭제 흐름이 이미 쓰는 그것을 그대로 읽는다
  (**새 한국어 문장 0건**). ⚠️ 이 스윕은 **화면 적합성을 판정하지 못한다**는 사실도 함께 기록됐다
  (표에 있는 문장이 어떤 화면에서는 갈 곳 없는 안내가 된다).
  `CONSENT_REQUIRED`·403·모르는 실패의 출력은 **바이트 불변**이고, 달라지는 것은 **표가 아는
  코드**와 **그 코드가 오프라인 폴과 겹치는 자리**뿐이다. 그리고 **두 번째 여정 스윕**이 섰다(`CHILD_PROFILE_JOURNEY_SERVER_FILES` — 서버 파일
  둘 · 코드 **10** 전수 · **이유가 적힌 제외 넷**). ⚠️ **기존 아웃박스 스윕과 합치지 않았다** —
  단위가 다르고(아이 저장에는 큐가 없다), R-1이 얻은 규율(*제외 사유는 그 스윕의 단위로만 적는다*)이
  그 분리의 근거다. `apps/mobile` **4,635 → 4,648**(신규 **13**) — ⚠️ 라운드 78 리뷰 M-1·M-2가 갈래 순서와 `CHILD_NOT_FOUND` 전용 갈래의 계약 둘을 더해 **4,650**이다.
- ⚠️ **제외 넷의 사유가 이 절이 남기는 재사용 가능한 값이다.** ⓐ `CHILD_STAGE_INPUT_REQUIRED` —
  **한 코드가 서버에서 세 문장을 나른다**(예정일/생년월일/단계). **표의 단위는 코드**라 하나를 고르면
  나머지 둘에 거짓이 된다. ⓑ `BUDGET_NOT_FOUND` — 실패가 아니라 **정상 흐름**이다(클라이언트가 `null`로
  접는다 — "예산 미설정"이 그 화면의 정상 상태다). ⓒ `CONSENT_REQUIRED` — 문구가 아니라 **복구 동선**
  (`onReconsent`)이 답이라, 표에 넣으면 그 동선을 잃는다. ⓓ `SETTINGS_CONFIRMATION_REQUIRED` — 확인
  문자열은 **앱이 만드는 상수**이지 사용자가 치는 값이 아니라, 이 코드가 나오면 사용자가 고칠 것이 없는
  **배선 어긋남**이다.
- ⚠️⚠️ **관측 하나 — 표는 "코드 하나 = 문장 하나"를 가정하는데 서버는 그렇지 않다.** 2026-08-30 실측:
  서버가 던지는 코드 **95** 중 **열여덟**이 서로 다른 문장을 둘 이상 나른다(최대 `FORBIDDEN` **다섯**).
  오늘 표 안에 있는 셋이 그 열여덟에 속하고(`FORBIDDEN` 5 · `ITEM_NOT_FOUND` 2 ·
  `PRODUCT_LINK_NOT_FOUND` 2 — 뒤 둘은 한쪽이 어드민 영문이다), **셋 다 앱이 부르는 갈래는 하나뿐**이라
  오늘 거짓은 없다. 그 사실을 **전수 부정 단언으로 못박았다**(오늘 셋). **표를 늘리는 다음 라운드가
  먼저 물어야 할 질문이 이것이다.**

### S-2. **담아서 돌려주는데 아무도 읽지 않는다** — R-3의 거울상, 그리고 격리와 가시성이 배타가 아니라는 사실

- **무슨 일이 있었나.** `apps/api/src/worker/jobs/scheduled-publish.job.ts`는 예약 게시가 실패하면 그
  행을 `in_review`로 되돌리고 `scheduledFor`를 남긴 뒤 `{ publishedCount, failedCount, recoveredCount }`
  를 **반환**했다 — 소스 주석이 *"the failure is surfaced via the returned summary … rather than
  thrown"* 이라고 **정직하게** 적어 두었다. ⚠️ **그 요약을 읽는 제품 코드가 저장소에 0건이었다**
  (`failedCount`는 이 파일이 쓰는 한 자리와 e2e 테스트의 "0인지" 단언 둘뿐 — 앱·어드민·모니터 어디에도
  소비자가 없다). 던지지 않은 잡을 스케줄러가 `status=ok`로 기록하므로 `consecutiveFailures`가 **0으로
  리셋**되고 `degraded`는 영영 false였다. `stale`도 false다(틱은 정상이다). **대시보드는 "정상"이라고
  썼다.** — 운영자가 금요일 저녁에 건 예약이 주말 내내 **2,880번** 실패해도, 월요일 아침 화면에는
  *"백그라운드 작업: 정상 · 마지막 실행 방금 전"* 과 *"지난 예약 · 아직 게시되지 않았어요"* 가 **서로
  모순되지 않은 채 둘 다 참이 아닌** 상태로 서 있었다.
- ⚠️⚠️ **바로 옆 잡이 그 병을 이름까지 붙여 이미 고쳐 두었다.** `data-retention-purge.job.ts`의 클래스
  주석: *"run() executes ALL phases first (isolation above is unchanged), but if any phase failed
  terminally it then throws … **Previously a stalled phase was invisible: run() swallowed the error and
  the scheduler logged status=ok forever.**"* **정확히 같은 문장이 예약 게시 잡에 대해 참이었다.**
- ⚠️⚠️ **판정: 격리와 가시성은 서로 배타가 아니다.** *한 초안이 나머지를 막지 않는다*(격리)와 *틱이
  끝난 뒤 실패를 던진다*(가시성)는 **동시에 참일 수 있고**, 파기 잡이 그것을 이미 증명해 두었다.
  종전 구조가 둘을 맞바꾼 것처럼 보였던 이유는 **던지는 자리를 배치 안에 두었기 때문**이지 성질이
  아니었다.
- ⚠️ **대조 하나 — `link_health`의 `errors` 카운터는 결함이 아니다.** 그 잡도 판정 실패로 중단되지
  않지만 **대시보드가 그 수를 읽어** *"N건은 확인하지 못했어요"* 로 말한다(라운드 44 N-9). **예약
  게시와 정확히 반대**이고, 그 대조가 이 판정의 근거다. 같은 폴더의 세 잡 중 **혼자 남은 셋째**가
  예약 게시였다.
- **오늘의 값.** 잡이 **due 초안 전수를 처리하고 보상까지 끝낸 뒤** `ScheduledPublishFailureError`를
  던진다(파기 잡의 생성자 모양 그대로 — 요약을 메시지에 담는다). ⚠️ **`publishDueScheduled`는 한 글자도
  바뀌지 않았다**(보상·CAS·크래시 복구·감사 로그·`SYSTEM_WORKER_ACTOR`는 `content-revisions.service.ts`의
  계약이고 이 트랙의 파일이 아니다) — 던지는 자리는 **얇은 어댑터**인 잡 하나다. 부정 단언 셋이 함께
  섰다: 실패 0건 틱은 **던지지 않고 요약이 종전과 같다** · 실패가 있어도 **전수 시도·보상 뒤에** 던진다 ·
  `recovered`만으로는 던지지 않는다(**복구는 성공이다**). 그리고 **연속 3회에서 `degraded`가 실제로
  참이 되고 잡 이름이 `failingJobNames`에 실리는 것**을 서버 쪽에서 못박았다 — ⚠️ **어드민 파일을 한
  자리도 열지 않고** 대시보드의 *"연속 3회 이상 실패한 작업이 있어요: cms_scheduled_publish"* 가 살아난다
  (배선 0건 · 응답 스키마 무변경 · 한국어 화면 문구 0건). `apps/api` **817 → 821**(신규 **4**).
- ⚠️ **대가를 값으로 적는다 — 실패가 이어지는 동안 `lastSummary`는 계속 `{}`다.** 스케줄러가 실패 시
  빈 요약을 기록하므로, **매 틱 실패하는 영구 실패에서는 그 공백이 한 틱이 아니라 실패가 끝날 때까지
  이어지고**(그동안 `degraded`도 참으로 유지된다) 정상 틱이 한 번 돌아야 요약이 다시 채워진다.
  ⚠️ **정정(라운드 78 리뷰 S-2)**: 처음 이 줄은 *"그 틱의 `publishedCount`는 대시보드에서 사라진다"*
  라고 단수로 적었는데 **둘 다 정확하지 않았다** — 공백은 한 틱에 그치지 않고, 대시보드에서 사라지는
  것도 카운트 전부가 아니라 **마지막 틱의 요약 숫자**뿐이다(`lastStatus` · `consecutiveFailures` ·
  잡 이름은 그대로 서고, 오히려 그 셋이 이번 라운드에 처음으로 사실을 말하기 시작했다).
  **파기 잡이 이미 치른 그 대가**이고, 라운드 44 M-3이 그것을 다루는 방법을 이미 배웠다(요약 대신
  `lastStatus`·`consecutiveFailures`를 읽는다).
- ⚠️⚠️ **절반은 그대로 남는다 — `/reviews`의 지난 예약 배지는 여전히 "발행 실패"를 구분하지 못한다.**
  `OVERDUE_SCHEDULE_NOTE`(*"지난 예약 · 아직 게시되지 않았어요"*)는 `status === "in_review"` + 지난
  `scheduledFor` 하나로만 서고(`apps/admin/src/lib/revision-rows.ts`), **실패 보상으로 되돌아온 행과
  워커가 꺼져 있어 손도 못 댄 행이 글자까지 같은 한 줄을 받는다.** 예약 폼 위의 워커 안내도
  `off`·`stale`만 말하고 `degraded`는 일부러 뺐다(실패 중인 잡이 링크 검사일 수 있어서다 — 그 판단은
  그대로 옳다). 즉 이번 라운드가 살린 것은 **대시보드 쪽 신호**이고, **그 초안 옆에서 이유를 말하는
  일**은 남았다. 다음 라운드가 물을 것: 지난 예약 배지가 `cms_scheduled_publish`의 실패를 읽어
  *"게시를 시도했지만 실패했어요"* 와 *"아직 시도되지 않았어요"* 를 가를 것인가(그 둘은 운영자가 할
  일이 다르다).
- ⚠️ **갱신 (2026-08-30 · 라운드 79 트랙 D) — 그 절반이 닫혔다.** 위 문단이 다음 라운드에 물으라고 적어
  둔 것(*"지난 예약 배지가 `cms_scheduled_publish`의 실패를 읽어 두 사실을 가를 것인가"*)에 답이 났다 —
  가른다. 판정 한 자리 + 잡 이름 상수 한 줄 + 화면의 인자 한 개이고, **서버·응답 스키마·`SCHEDULE_BLOCKING_WORKER_STATES`는
  전부 무접촉**이다. 오늘의 판정은 아래 **T-4**가 진다.
- ⚠️ **테스트 쪽 잔여도 함께 정리됐다** — 영구 실패 픽스처를 **10년 미래로 격리**해 다른 케이스의 due
  집합을 흔들지 않게 했고, 손으로 지우던 잔여 행 **둘**이 정리됐다. ⚠️ **라운드 78 리뷰 M-5**: 그 격리
  축이 **요약 전체를 비교하는 나머지 자리 셋**에도 적용됐다 — 스코프된 Prisma는 *이 파일의 잡이 남의
  행을 보지 않게* 할 뿐 **남의 비스코프 잡이 이 파일의 행을 보는 것은 막지 못하고**, `publishing`
  픽스처는 예약 시각과 무관하게 회수되므로 `updatedAt`까지 함께 옮겨야 한다.

### S-3. **역할 게이트의 나머지 절반** — R-4가 감춘 것은 제출 컨트롤뿐이었다

- **사실.** 라운드 77 R-4는 다섯 화면의 **제출 컨트롤**을 `canEdit` 뒤로 보냈다. 그런데 [수정] 토글은
  역할을 몰랐고(`app/items/page.tsx` · `app/links/page.tsx`), `ItemFormFields`·`LinkFormFields`·고지
  `<textarea>`는 `mode: "create" | "edit"`만 받아 **역할을 몰랐다.** 그래서 `analyst`는 오늘도 [수정]을
  눌러 폼을 열고 **세 필드를 고친 뒤에야** 저장 버튼이 없다는 것을 알았다 — R-4가 세운 목표
  (*"누르기 전에 말한다"*)가 **누른 뒤·고친 뒤**로 밀려 있었고, [닫기]를 누르면 그 편집분은 조용히
  사라졌다.
- ⚠️ **옆 탭이 이미 그 답을 갖고 있었다.** `app/categories/page.tsx`는 행의 입력칸을 `isEditing`일 때만
  그리고 `isEditing`에 들어가는 문이 `canEdit` 뒤에 있어, `analyst`가 편집 가능한 입력칸을 보는 경로가
  **구조적으로 0건**이다. **다섯 화면 중 하나만 그 답을 갖고 있었고, R-4는 그 답의 절반만 가져왔다.**
- ⚠️⚠️ **판정: 빈 생성 폼에는 "값을 보는 것은 정당하다"가 적용되지 않는다.** R-4가 편집 폼을 남긴 근거는
  *읽기 권한자가 값을 보는 것은 정당하다*였는데, 세 화면의 "새 X 추가" 카드는 `analyst`에게도 **빈 폼
  전체**를 렌더했다 — **읽을 데이터가 0건**이므로 그 근거가 여기에는 서지 않는다. **같은 판정이 두 폼에
  서로 다르게 적용된다는 사실**이 이 절의 값이다.
- ⚠️ **`<select>`에 `readOnly`가 없어 두 속성으로 갈린다.** `readOnly`는 값을 **읽고 복사할 수 있게**
  남기지만 HTML 명세상 `<select>`·`<input type="checkbox">`에는 그 속성이 없어 `disabled`만이 같은 뜻을
  낸다. **다음 라운드가 그 비대칭을 결함으로 읽지 않도록** 이유가 소스 주석에 값으로 적혀 있다.
- ⚠️ **다음 라운드 후보(라운드 78 리뷰 P-2) — `disabled`가 실제로 무엇을 앗아가는가.** `readOnly`가
  선 칸은 값을 **드래그해 복사**할 수 있는데 `disabled`가 선 칸은 그렇지 않다. 즉 `analyst`는 준비템의
  이름·URL은 복사할 수 있고 **카테고리·필수 여부·활성 여부는 복사할 수 없다** — 조회가 일인 역할에게
  그 차이는 자의적이다. 오늘 그 값은 여전히 **보이므로** 결함으로 올리지 않았고, 밟아 볼 만한 대안
  셋을 값으로 남긴다: ⓐ 비편집 상태에서 `<select>`·체크박스를 **텍스트 한 줄**로 바꿔 그리기(값이
  선택 가능한 텍스트가 된다) · ⓑ `disabled` 대신 `aria-disabled` + 이벤트 차단(복사는 남고 조작만
  막힌다 — ⚠️ 폼 제출에서 값이 함께 나가는지 먼저 확인해야 한다) · ⓒ 그대로 두고 **그 사실을 화면에
  적기**. ⚠️ **셋 다 화면을 여는 결정이므로 이 라운드의 축이 아니다.**
- ⚠️⚠️ **갱신 (2026-08-30 · 라운드 79) — 기각이 아니라 *전제를 정정한 뒤 보류*다.** 위 근거(*"`readOnly`가
  선 칸은 드래그 복사가 되는데 `disabled`가 선 칸은 그렇지 않다"*)는 `<select>`에 대해 **절반만 참**이다 —
  ⚠️ **라운드 79 리뷰(S-3)가 그 정정을 다시 한 칸 정정한다 — 근거는 HTML *명세*가 아니라 브라우저(UA)의
  *위젯 동작*이다.** `<select>`의 옵션 텍스트는 UA가 그리는 위젯의 일부라 **활성 상태에서도 드래그로
  선택·복사되지 않고**(체크박스에는 애초에 복사할 텍스트가 0건이다), 그래서 `disabled`가 실제로 앗아가는
  것은 **복사가 아니라 도달**이다. ⚠️⚠️ **그리고 `disabled`는 접근성 트리에서 그 칸을 지우지 않는다** —
  칸은 남고 **"사용 안 함"으로 값과 함께 읽힌다.** 잃는 것은 셋이다: **탭 순서 · 조작 · 목록을 열어
  다른 값을 훑는 것**(종전 서술 *"스크린리더 포커스가 닿지 않는다"* 는 **순차 포커스** 이야기였고,
  훑기로는 여전히 닿는다). ⚠️ **그러면 대안의 값이 재배열된다**: ⓑ는 **복사를 되살리지 못하고 포커스만 되살리며**,
  ⓐ만 복사·도달을 함께 되살리고, ⓒ는 종전 그대로다. **오늘 값이 여전히 보이므로 결함으로 올리지 않는다**
  (실측 자리 **열하나** — `app/items/page.tsx` 여섯 · `app/links/page.tsx` 다섯이고 라운드 79의 어느
  트랙도 그 셋을 열지 않았다). ⚠️⚠️ **결정보다 브라우저 확인이 선행이다** — 위 명세 판단이 실제 브라우저에서
  참인지를 먼저 밟는다(`runtime-verification-required.md` §1-1 **#130**(표면 `브라우저`) · 접근성 체크표
  **A-20 #87**). 전제가 틀린 채로 대안을 고르면 **되살리지 못하는 것을 되살렸다고 적게 된다.**
- **오늘의 값.** 생성 카드가 `canEdit` 뒤로 가고 그 자리에 **라운드 77이 만든 캡션 상수 그대로**가 서며
  (`admin-role-copy.ts` **무접촉** — 사본 0건 추가), 편집 폼은 남되 **전 칸이 `readOnly`/`disabled`**로
  내려가고(값 복사는 그대로 된다), 토글 라벨이 `!canEdit`이면 `"수정"` 대신 **`"보기"`** 가 된다
  (⚠️ **이미 이 콘솔에 있는 낱말**이라 **새 한국어 문장 0건 · 새 낱말 0건**). 대장에는 `edits` 칸이
  더해져 `submits`가 이미 지나던 **갈래 위치 판정**(라운드 77 리뷰 S-2)을 그대로 재사용한다 —
  `submits`·`allows`·`kind`·`SCREEN_NOTICE_CONSTANTS`는 **한 칸도 바뀌지 않았고**, `isEditor` 갈래와
  쓰기 catch **2·2·2**(`WRITE_ERROR_COPY_SITES` 총합 **열다섯**)도 무변경이다. 필터·검색 입력칸도
  그대로다(⚠️ **조회는 `analyst`의 일이다** — `readOnly`가 가는 자리는 **폼 컴포넌트 안**뿐이라는 것이
  이 트랙의 경계였다). `apps/admin` **510 → 521**(트랙 C 여덟 · 트랙 D 셋 합산) — ⚠️ 라운드 78 리뷰 S-7이 `codeOnly` 재현 하나를 더해 **522**다.
- ⚠️ **계약 쪽에서 구멍 하나가 함께 봉합됐다.** `edits` 칸을 세우면서 **JSX 여닫이 필터**가 붙어 함수
  본문의 `{` 를 갈래로 오독하던 자리가 막혔다 — **강화가 침묵으로 되돌아가지 않게** 뒤집힌 소스가
  실제로 빨개지는 것까지 재현 단언으로 못박은 S-2의 규율이 이번에도 그대로 적용됐다.

### S-4. **오늘 참이라 조용한 가정** — 세 수치가 서로 다른 단위로 세어지고 있었다

- **사실.** `apps/admin/src/lib/admin-api.test.ts`의 한 단언 안에서 두 단위가 섞였다: 쓰기 호출
  (`method: "…"`)과 `retrySafe`는 **파일 전체의 호출부**를 세고, 멱등은 **함수 시그니처**
  (`idempotencyKey?: string`)를 셌다. 그 뺄셈이 참이던 것은 *"함수 하나가 `request()`를 정확히 한 번
  부른다"* 는 **적히지 않은 가정** 덕분이다.
- **오늘 그 가정은 참이었다**(2026-08-30 실측): `admin-api.ts`를 `\nexport (async )?function`으로 갈라
  세면 쓰기 호출 **24**가 함수 24개에 하나씩 있고, `export` 밖의 쓰기 호출 **0건** · 한 함수에 둘 이상인
  자리 **0건** · `retrySafe`가 둘 붙은 자리 **0건**이다. ⚠️ **그래서 오늘은 아무도 이 가정을 볼 수
  없었다.**
- ⚠️ **어긋나는 날의 모양이 셋이고, 셋 다 어느 단언도 깨지 않는다.** ⓐ 한 함수가 `request()`를 **두 번**
  부르면(생성 후 즉시 재조회, 조건부 PATCH/DELETE) 쓰기 호출만 늘어 **"비멱등 쓰기가 하나 늘어난 것처럼"**
  보인다. ⓑ 멱등키를 인자로 받지 않고 **안에서 만드는** 함수는 놓쳐서 비멱등으로 세어진다. ⓒ 반대로
  `idempotencyKey?: string`을 받되 `request()`에 **넘기지 않는** 함수는 멱등으로 세어진다.
- ⚠️⚠️ **이것은 R-2가 `retrySafe`를 명시 플래그로 만든 판단의 *검증 쪽 쌍둥이*다.** R-2는 *"메서드로
  유추하면 다음 라운드의 새 POST가 조용히 한쪽에 떨어진다"* 고 적고 추론을 명시로 바꿨는데, **그 수치를
  세는 쪽은 여전히 추론이었다.** 그리고 그 수치는 *"연결 실패·타임아웃의 문장 선택이 옳은지"* 를 묻는
  **유일한 자리**라, 뜻을 잃으면 R-2의 본체가 함께 조용해진다.
- **오늘의 값.** 세 분류가 **함수 표 하나에서 파생**된다(호출부 세기와 시그니처 세기를 섞지 않는다) —
  각 함수마다 `{ writeCalls, retrySafe, idempotencyKeyParam, idempotencyKeyForwarded }`를 읽고, **가정이
  단언으로 승격**됐다: **쓰기 함수 전수가 `request()`를 정확히 한 번 부른다** · 멱등키를 시그니처로 받고
  `request()`에 넘기지 않는 함수가 **0건**이다. **답은 종전과 같다**(**24 = retrySafe 8 + 멱등 6 +
  비멱등 10** — 수치 넷과 이름 목록 **바이트 불변**). ⚠️ **세는 방법만 바뀌었다는 것이 이 트랙의
  안전망**이고, 그 위에 **드리프트 재현**(가정이 깨진 소스를 넣으면 실제로 빨개진다)이 얹혔다.
  `admin-api.test.ts` **30 → 33**(⚠️ **정정 — 라운드 78 리뷰 S-4**: 처음 이 줄은 *27 → 31* 이라고
  적었는데 출발점이 틀렸다. 라운드 77 R-2가 같은 파일을 **18 → 30**으로 적어 뒀고(위 R-2절), 이
  트랙의 실측 증가는 **셋**이다 — 델타를 넷으로 적으면 두 절이 서로 다른 저장소를 말하게 된다).
  ⚠️ **제품 소스 0건**(`src/lib/admin-api.ts` 무접촉 — 이 트랙은 **세는 방법**만 고쳤다).
- ⚠️ **다음 라운드 후보(라운드 78 리뷰 P-3) — 추출 전에 두 파서의 단위 차이부터 계약으로 고정한다.**
  두 사본은 이름만 같고 **세는 단위가 다르다**: 이 파일의 것은 함수마다
  `{ writeCalls, retrySafe, idempotencyKeyParam, idempotencyKeyForwarded }`를 읽는 **쓰기 분류용**이고,
  옆 파일의 것은 역할 게이트가 지켜야 할 **쓰기 함수 이름 목록**을 뽑는다. 그 차이를 적어 두지 않은 채
  공용 모듈로 합치면 **한쪽의 단위가 조용히 다른 쪽을 덮는다**(R-6 P-3이 이름 붙인 그 병의 재발이다).
  순서는 ⓐ 두 호출부가 오늘 같은 답을 낸다는 것을 **교차 단언**으로 먼저 고정하고 → ⓑ 그 단언이 초록인
  채로 추출한다. ⚠️ **ⓐ 없이 ⓑ만 하는 것이 이 후보의 실패 모양이다.**
- ⚠️ **갱신 (2026-08-30 · 라운드 79 트랙 E) — 그 순서 그대로 닫혔다.** ⓐ 교차 단언(차집합이 한 방향으로
  `draftAndSubmitContentRevision` 하나 · 반대 0건)이 먼저 초록이 된 뒤 ⓑ 공용 파서 한 벌이 섰고, **두 단위는
  인자이며 어느 쪽도 기본값이 아니다.** ⚠️ **문서에 없던 차이가 하나 더 있었다는 사실**(선언 끝 뒤 꼬리)이
  함께 승격됐다 — 오늘의 판정은 아래 **T-5**가 진다.
- ⚠️ **사본 하나를 허용한 판단도 값으로 적혀 있다.** 같은 함수 단위 파싱이 옆 파일
  (`admin-write-role-gate.test.ts`의 `adminApiWriteFunctions()`)에 이미 있지만, **공용 모듈로 추출하면
  두 트랙이 같은 파일을 열게 되므로** 이번 라운드는 사본 하나를 두고 그 이유를 주석에 남겼다.
  **공용 헬퍼 추출은 다음 라운드의 결정이다.**

### S-5. **`indexOf` 끝점 위험은 일반형이었다** — 그리고 시작점 `-1`이 끝점 `-1`보다 조용하다

- **사실.** 라운드 77 리뷰 M-3이 한 자리에서 잡은 모양(구간을 자르는 표식이 사라지면 `indexOf`가 -1을
  돌려주고 `slice`가 그것을 **실패가 아니라 위치로** 읽는다)을 저장소 전체에서 세어 보니 일반형이었다.
  정찰의 어림 스윕은 **74자리 / 파일 41**(가드 있는 자리 2)로 적었고, 그중 **열한 자리**는 바늘이
  **인자·시그니처 모양**이라 M-3과 **같은 방식으로** 끊긴다(`"onError: (error) => {"` — 인자 이름을
  `err`로 바꾸는 리팩터 한 번에 끊어진다).
- ⚠️⚠️ **판정: 두 실패 방향이 다르고, 조용한 쪽이 더 위험하다.** **끝점이 `-1`이면 구간이 파일 끝까지
  넓어진다**(M-3이 만난 경우 — 답이 우연히 맞아 초록이었다). **시작점이 `-1`이면 구간이 빈 문자열이
  되어 부정 단언이 언제나 통과한다.** ⚠️ **그물이 넓어지는 것은 언젠가 빨개질 수 있지만, 빈 그물은
  영원히 초록이다.**
- **오늘의 값.** **열두 자리**에 시작·끝 두 인덱스의 실재 확인이 섰고(형식은 M-3이 세운 그것 —
  `toBeGreaterThan(-1)` / `toBeGreaterThan(시작)`), 바늘은 **인자 모양에 매이지 않는 접두**로 바뀌었다.
  ⚠️ **각 단언의 판정·기대값은 바이트 불변**이고, **잘라 낸 열한 구간이 가드 전후로 바이트 동일**한 것을
  확인했다(가드는 실패를 **드러내는** 것이지 판정을 바꾸는 것이 아니다). 나머지는
  `packages/test-utils/src/source-contract-slice-guard.test.ts`가 **파일별 미가드 자리 수 대장**으로
  얼렸다 — **비증가 래칫** + **대장에 없는 파일에 새 자리가 나면 빨개진다**. `packages/test-utils`
  **107 → 112**(신규 **5**) — ⚠️ 라운드 78 리뷰 M-4·P-1이 둘(인라인 자리 하한 · 유령 방지)을 더해 **114**다. ⚠️ **제품 소스 0건.**
- ⚠️ **정찰의 어림값과 스윕의 값이 달랐고, 스윕 쪽이 옳다.** 스윕이 센 값은 **자리 121 · 가드 35 ·
  미가드 86 / 미가드 파일 56**이다(정찰: 74 / 41). 차이의 이유는 다섯이고 다섯 다 스윕이 **더 넓게**
  잡기 때문이다 — ⓐ `lastIndexOf`도 센다(못 찾으면 똑같이 -1이다) · ⓑ 끝점을 `slice(` 안에서 곧바로
  부르지 않고 **이름 붙은 인덱스**로 빼 둔 자리도 센다 · ⓒ 가드를 **자리별**로 보아 **-1이 될 수 있는
  두 끝 모두**가 확인돼야 가드로 친다 · ⓓ **단언이 파생식 위에 서도 센다** · ⓔ **`expect(…)` 안에서
  곧바로 자른 자리**(오늘 **열둘**)도 센다.
- ⚠️⚠️ **정정 — 라운드 78 리뷰 M-4: 그물이 처음에는 이 병의 가장 나쁜 자리를 놓치고 있었다.**
  처음 스윕은 `const` 선언 + **맨이름 단언**만 봤고(위 ⓓ·ⓔ가 없었다), 그래서
  `apps/mobile/src/api/recommendation-order-mirror.test.ts`의 **DNC-009 부정 단언**(가격·수수료가
  점수 입력에 실리지 않는다)이 그물 밖에 있었다 — 두 인덱스가 전부 인라인이라 이름조차 없었고,
  표식이 사라지면 **DNC 계약이 빈 구간 위에서 영원히 초록**이 되는 자리였다. 그 자리에는 실재 확인이
  섰고(가드 하한에 편입), 스윕은 ⓓ·ⓔ로 넓어졌다. 넓힌 그물이 더 센 자리는 **다섯**(미가드 81 → 86)
  이고 그중 둘은 새 파일이다. **수치는 전부 대장에서 파생하고**(리뷰 P-1 — 손으로 적은 합계를 지웠다),
  대장·하한의 키가 실재하는 파일인지도 함께 묻는다(유령 줄 금지). **수치를 대장으로 옮긴 이유가 정확히 이것**이고, ⚠️ **대장은 줄 번호로 적지 않는다**
  (단위는 `파일 → 개수`다 — 줄 번호로 적으면 그 파일을 여는 모든 트랙이 대장을 함께 고쳐야 한다).
- ⚠️⚠️ **그리고 이 위험은 이미 제품 소스의 배치를 정한 적이 있다 — 그 사유는 오늘 낡았다.**
  `app/items/[itemTemplateId].tsx`의 주석은 `clickLink` 뮤테이션 블록을 옮긴 이유를 *"다른 파일의 소스
  계약이 끝점을 잃기 때문"* 이라고 적는다. **소스 스캔 계약이 제품 코드의 줄 순서를 정한 첫 자리**이고,
  ⚠️ **스캔 계약은 관찰이어야 하며 제약이 되면 꼬리가 몸통을 흔든다.** **되돌리지 않는다는 것이 이번
  라운드의 판정이다**(되돌리면 동작 0건 변경에 줄 이동만 한 번 더 생기고, 옮긴 자리는 읽는 순서로도
  옳다 — 헬퍼 뒤에 소비자). 다만 **그 주석의 사유는 낡았다** — 오늘 그 자리를 지키는 것은 사라진 끝점이
  아니라 *"등록이 전부 이 뮤테이션 앞에 있다"* 는 사실이고(M-3이 끝점을 접두로 바꿨다), **그 한 줄은
  제품 소스라 이번 라운드가 손대지 않았다.** **그 파일을 여는 다음 라운드의 몫이고, 사유가 낡았다는
  사실이 값이다.**
- ⚠️ **공용 헬퍼(`sliceBetween`)는 만들지 않았다** — 50파일 마이그레이션은 이 라운드의 축이 아니고,
  헬퍼를 먼저 만들면 **쓰는 자리가 열둘뿐인 모듈**이 선다. **다음 라운드의 결정으로 남긴다.**
- ⚠️⚠️ **갱신 (2026-08-30 · 라운드 79) — 낡은 사유는 정정됐고(코드 0줄), 그 위험이 어디까지 자랐는지는
  이제 수치로 있다.** `app/items/[itemTemplateId].tsx`의 `clickLink` 주석은 블록을 옮긴 이유를 *"다른 파일의
  소스 계약이 끝점을 잃기 때문"* 이라고 적었는데 **그 제약은 오늘 존재하지 않는다**(끝점은 이미 접두로
  바뀌었고 두 인덱스의 실재 확인까지 서 있으며, 그 단언은 onSuccess의 catch부터 같은 뮤테이션의 onError까지를
  자르므로 **블록 위치와 무관하게 참**이다). **되돌리지 않는다는 판정은 그대로**이고 고쳐진 것은 **사유 한
  문단**뿐이다 — *"헬퍼 뒤에 소비자"* 라는 읽는 순서와 *"등록이 전부 이 뮤테이션 앞에 있다"* 는 사실.
  **코드 0줄 · 동작 0건.** ⚠️⚠️ **그리고 같은 위험이 제품 소스 쪽에서는 이미 잠금에 가깝다는 수치가 이번에
  나왔다**: `app/(tabs)/index.tsx`를 **소스로 읽는 테스트가 35**이고 **그중 28이 `indexOf`를 쓴다.**
  ⚠️ **그 수치가 라운드 79 후보 2의 최소안을 실제로 정했다** — 더 정확해 보이던 대안(*"배너와 같은 수를
  훅에 넘긴다"*)은 `monthlyUsed`(`:1482`)와 훅 호출(`:1260`) 중 **하나를 옮겨야** 해서 그 파일을 여는데,
  최소안은 **그 파일을 열지 않고 같은 정직성을 얻는다**(아래 T-2). **스캔 계약이 관찰을 넘어 설계를
  제약하기 시작했다는 이 절의 경고가, 처음으로 특정 파일의 특정 결정에서 값으로 실현됐다.**

## T. 라운드 79에서 확정한 판정 (2026-08-30 · GAP-079 트랙 F)

라운드 78이 축을 **루프에 들어오기 전 관문 + 사람 없이 도는 층**으로 잡았다면, 라운드 79는 축을 그
문장들이 **사용자에게 실제로 도달하는가** 로 옮겼다 — 낭독(소리) · 알림(도달) · 여정 스윕의 세 번째
자리 · 운영자 화면의 사유 구분. K~S절과 같이 **결함 보고가 아니라 다음 결정의 입력**이며, 다섯 다
2026-08-30 소스에서 확인됐다(라운드 79 트랙 A·B·C·D·E 머지 후).

⚠️⚠️ **이번 라운드의 가장 값진 관측: 다섯 라운드가 *문장의 정확도*만 올렸고, *도달*은 한 번도
세어지지 않았다.** 라운드 70·73·76·77·78이 저장 실패 문구를 다섯 번 정확하게 만드는 동안(표를 물리고 ·
초대 참여와 기기 알림을 · 초대 생성을 · 훅의 문장을 버리지 않게 · 온보딩 갈래를 다섯으로), 그 문장이
서는 **일곱 자리 중 여섯이 스크린리더에 자동으로 오지 않았고**(T-1), 예산 알림은 **화면이 보는 것과
다른 수** 위에서 판정했으며(T-2), 운영자 화면 하나는 대시보드가 이미 말하기 시작한 사실을 **아직 읽지
않았다**(T-4). **정확한 문장과 도달하는 문장은 다른 축이고, 이 저장소는 지금까지 앞의 축만 세어 왔다.**
⚠️ **다섯 판정 전부 "어떤 단언도 깨지 않는 사실"이었다** — 문장이 소리로 오는지 세는 것이 없었고 ·
같은 함수의 입력이 같은지 세는 것이 없었고 · 가족 여정에 그물이 없었고 · 배지가 워커를 보지 않았고 ·
두 파서의 답이 같은지 묻는 것이 없었다.

⚠️⚠️ **새 이름 하나: "같은 함수, 다른 입력."** 라운드 78 S-4가 *같은 이름, 다른 단위*를 이름 붙였다면
T-2는 그 한 칸 옆이다 — 세 표면이 **같은 판정 함수**를 부르고 소스가 *"규칙이 갈라질 수 없다"* 고 적어
두었는데, **먹이는 수가 달랐다.** ⚠️ **함수를 공유했다는 사실은 입력이 같다는 뜻이 아니고, 그 문장을
적은 주석은 그 차이를 가린다.** **다음 라운드가 먼저 세어 볼 만한 것: "같은 함수를 부르는 표면 여럿"의
입력이 같은지.**

**같은 저장소가 같은 물음에 이미 답해 둔 자리를 먼저 찾는 것이 이번에도 가장 값쌌다.** T-1의 조합은
**같은 저장소의 열다섯 자리**에, T-2의 규율은 **같은 파일의 형제 알림 둘**에, T-3의 형식은 **같은 테스트
파일의 두 번째 스윕**에, T-4의 대조는 **같은 모듈의 `link_health` 상수**에, T-5의 본보기는 **옆 테스트
파일**에 완성된 채 있었다. ⚠️ **다섯 트랙 전부 새 한국어 문장 0건**이고 예외는 **트랙 D의 배지 갈래
한 절**뿐이며, 그것도 잡 이름을 말하는 사실 한 줄이라 재시도를 권하지 않는다(표기 방언과 무관하다).

**오늘의 수치.** `apps/mobile` **4,650 → 4,684**(트랙 A 신규 **7** + 계약 갱신 · 트랙 B **8**(generators
**47 → 55**) · 트랙 C **19**) · `apps/admin` **522 → 540**(트랙 D **10** · 트랙 E **8**) ·
`apps/api` **821**·`packages/domain` **131**·`packages/contracts` **66**·`packages/test-utils` **114**는
**무변경**(⚠️ api 소스를 여는 트랙이 0건이었고, 라운드 78 E의 슬라이스 가드 대장은 다섯 트랙이 *"새
`indexOf` 자리에는 예외 없이 실재 확인을 함께 세운다"* 를 공통 금지로 지켜 한 줄도 움직이지 않았다).

⚠️⚠️ **후보가 0건이었던 축 셋을 값으로 남긴다 — 다음 라운드가 같은 스윕을 다시 돌리지 않도록.**

- **공유 카드/리포트 공유 왕복 — 전수로 재었고 후보 0건.** 다섯 근거다. ⓐ **공유 문구는 숫자를 다시
  세지 않는다**(`src/reports/share-text.ts`는 `MonthlyInsight`와 `PendingScopeBreakdown`을 **타입으로만**
  받고 집계를 재현하지 않는다 — 화면의 문장과 보낸 문장이 갈릴 자리가 없다). ⓑ **fail-safe가 이미 서
  있다**(진행 중인 달인데 구간 줄이 없는 인사이트를 만나면 **메시지 전체를 만들지 않는다** — 라운드 36
  F-5. `?? 0`이 0원을 말할 것처럼 보이는 자리는 `insight === null → null` 게이트가 앞에서 접는다).
  ⓒ **대기 고지가 공유 카드까지 따라간다**(GAP-064 #3의 네 번째 자리 — 문구를 새로 짓지 않고
  `cumulativeTotalPendingNoticeText`를 부르며 지시어 하나만 갈린다). ⓓ **개인정보 입력이 구조적으로
  좁다**(들어가는 식별 정보는 아이 이름 하나이고 대기 고지가 싣는 것은 **숫자 두 칸**뿐 — 입력 타입이
  그것을 강제한다). ⓔ **계측이 주장하지 않는다**(`report_share_tapped`는 시트를 **여는 시점**만 세고,
  그 이상을 주장하면 허위 집계라는 사실이 소스 주석에 있다). ⚠️ **남는 것 하나(결함 아님·값으로만)**:
  `Share.share` 호출 여섯 중 **둘**이 catch 없는 `void`다(`app/items/[itemTemplateId].tsx`) — 나머지
  넷은 try/catch로 취소를 정상 경로로 받는다. 릴리즈에서 조용한 미처리 거절이라 **사용자에게 보이는
  차이가 0**이고, 그래서 결함으로 올리지 않는다. **다음에 그 파일을 여는 라운드의 곁다리다.**
- ⚠️⚠️ **알림 도달의 서버 층 — 결함이 아니라 선언된 설계다.** 실측:
  `apps/api/src/push/push-dispatch.service.ts`가 서버에서 발송하는 것은 **예산 경계 둘뿐**이고, 나머지
  다섯(시기 전환 · 구매 확인 · 주간 요약 · 기록 공백 · 지난달 정리)은 **모바일이 홈 데이터로부터 만드는
  인앱 알림**이다(그 사실이 그 파일 머리말에 값으로 적혀 있다 — 서버에 알림 테이블도 생성 서비스도
  없다). ⚠️ **즉 앱을 열지 않으면 그 다섯은 생기지 않는다.** 바꾸려면 **서버 알림 도메인 신설**(스키마 +
  워커 잡)이 선행이라 마이그레이션 0건 원칙 밖이다. **T-2는 그 층을 건드리지 않고 판정의 입력만 고친다.**
- **홈의 손 폴 다섯 — 결함 아님(전수 확인).** 라운드 72 E가 `useErrorTimeConnectivity`를 export한 뒤에도
  화면이 직접 `void isCurrentlyOnline().then(...)`을 부르는 자리가 다섯 남아 있다(`ExpenseCsvExport.tsx` ·
  `app/expenses/new.tsx` · `app/items/[itemTemplateId].tsx` · `app/family/index.tsx` · `app/import/index.tsx`).
  ⚠️ **훅이 고치는 두 문제(언마운트 뒤 setState · 늦게 온 옛 판정이 최신을 덮음)가 다섯 다 성립하지
  않는다** — 넷은 Alert/Toast 한 방이라 상태가 없고, 하나는 `linkNoticeSeqRef` 걸쇠를 스스로 들고 있다.
  **다음 라운드가 손 미러로 다시 세지 않도록 적어 둔다**(P-4의 단위와 다르다).

### T-1. **정확해진 문장이 소리로는 오지 않았다** — 다섯 라운드가 올린 것은 정확도였고, 도달은 한 번도 세어지지 않았다

- **사실.** 저장 실패 문구의 대장(`src/offline/offline-aware-screens.ts`의 `OFFLINE_AWARE_SAVE_ERROR_SCREENS`
  — 다섯 화면)이 그리는 실패 문장 자리는 **일곱**이다. 2026-08-30 전수: 그중 **자동으로 낭독되는 것은
  하나**(`app/budget.tsx`의 Toast — `announceForA11y` + role + live region을 프리미티브가 이미 진다)였고,
  **나머지 여섯은 맨 `<Text>`** 로 눌린 [저장]·[초대 링크 만들기] 버튼 **바로 위**에 서 있었다.
  포커스가 그 버튼에 남아 있으므로 **화면에는 있고 소리로는 없다.**
- ⚠️⚠️ **이 저장소는 그 상황을 이미 자기 소스에 문장으로 적어 두고 있었다.** `app/expenses/new.tsx`의
  날짜 입력 오류 자리: *"입력 도중 나타나는 오류라 포커스가 TextInput에 남아 있다 — 스크린리더가 스스로
  읽어 주지 않으면 조용히 막힌다. (auth)/login.tsx 관례와 같은 조합."* 그 조합은
  `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"` **둘 다**이고, 그것을 함께 건 자리가
  저장소에 **열다섯**이었다. **저장 실패 대장 다섯 화면은 그 그물 밖이었다** — 관례도, 계약도, 본보기도
  이미 있는데 **대장과 관례를 잇는 줄 하나가 없었다.**
- ⚠️ **모듈 층에도 한 모양이 있었다 — role만 있고 live region이 없는 자리.** 실측으로 `role="alert"`
  단독인 자리는 **넷**이었고(`src/onboarding/step-ui.tsx` · `app/family/accept/[token].tsx` 둘 ·
  `app/(tabs)/items.tsx`), **하필 그중 셋이 라운드 70·78이 문장을 정확하게 만든 바로 그 카드들**이다.
  **역할은 읽히는데 문장은 자동으로 오지 않는다** — 넷째만 준비템 100% 축하 배너라 실패가 아니다.
- **오늘의 값.** **더한 것은 프롭 둘뿐이다 — 새 한국어 문장 0건 · 새 컴포넌트 0건 · 렌더 0건 변경 ·
  서버 0건 · 보이는 화면 한 픽셀도 무변경**(`accessibilityRole`·`accessibilityLiveRegion`은 레이아웃
  속성이 아니다 — 라운드 65가 hitSlop에서 쓴 그 판단과 같은 근거). 계약은 **손 목록이 아니라 대장에서
  파생한다**: 대장 화면 전수가 그리는 저장 실패 자리가 **낭독되는 노드 안**에 있을 것(출구 둘 — live
  region 조합 · Toast). **오늘 낭독 밖은 0건**이고, 그 0은 손으로 적은 값이 아니라 **자기 무효화되는
  제외 목록**에서 파생한다(오늘 빈 값이고, **비어 있는 경위**가 값으로 적혀 있다 — 빈 목록이 "아무도
  세지 않았다"로 읽히지 않게). 부정 단언(실패 문장 위 `role="alert"` 단독 **0건** — 축하 배너 하나는
  **이유와 함께** 제외) · 재현 단언(프롭을 뺀 소스가 실제로 빨개진다) · 바이트 불변 단언(더한 프롭을
  빼면 종전 바이트와 **정확히 같아진다**)이 함께 섰다.
- ⚠️⚠️ **이 트랙이 남기는 두 번째 값 — 소스 계약이 다른 트랙의 손을 묶는 모양이 처음 값으로 적혔다.**
  일곱 자리 중 넷은 **소유 밖 소스 계약이 여는 태그를 바이트로 핀**하고 있어 프롭 한 칸을 더하면 그 핀이
  깨졌다. 그 넷은 트랙 A가 끝날 때 남아 있었고, **같은 라운드의 통합이 핀 셋을 *바이트*에서 *모양*으로
  풀면서**(`<Text[^>]*style=…` 꼴) 같은 걸음에 프롭을 걸어 완결됐다. ⚠️ **그 완화에 대한 의존이 단언으로
  서 있다**(풀린 핀 **다섯** — 트랙 C가 둘, 통합이 셋) — 바이트 핀으로 되돌아가는 날 그 줄이 **먼저**
  빨개져서, 화면이 침묵으로 되돌아가는 것이 사고가 아니라 **결정**이 되게 한다. **S-5가 이름 붙인
  위험("스캔 계약이 제약이 되면 꼬리가 몸통을 흔든다")이 접근성 층에서 실현된 첫 자리이고, 답은
  "계약을 지우는 것"이 아니라 "계약이 묻는 단위를 바이트에서 모양으로 낮추는 것"이었다.**
- ⚠️⚠️ **판정 — 저장과 조회를 가르는 근거는 "포커스가 어디 남는가" 하나다.** 조회 실패 대장
  **열넷**(`OFFLINE_AWARE_LOAD_ERROR_SCREENS`)은 이번에 열지 않았다(⚠️ **정찰은 이 수를 *열다섯*으로
  적었는데 실측은 **열넷**이다 — 스윕 쪽이 옳다). 저장 실패는 **눌린 버튼에 포커스가 남은 채로** 문장이
  그 버튼 바로 위에 서고, 조회 실패는 **화면 영역이 통째로 바뀌어** 사용자가 다시 훑는다. 그 차이가
  실제로 자동 낭독을 필요로 하는지는 **기기에서만 안다** — 그래서 그 질문은 실기기 항목이고
  (`runtime-verification-required.md` §1-1 **#127** · 접근성 체크표 **A-20 #85**), 답이 *"필요하다"* 로
  나오면 **다음 라운드가 같은 형식으로 그 열넷을 연다.** ⚠️ **이 문단이 값으로 남는 이유**: 적지 않으면
  다음 라운드가 같은 스윕을 산문으로 다시 센다.

- ⚠️⚠️ **라운드 79 리뷰(M-1) — 위 "낭독 밖 0건"은 *안드로이드 한정*이었다.** 걸린 프롭 둘은 한
  플랫폼의 답이다: `accessibilityLiveRegion`은 React Native 문서가 **`@platform android`** 로 표시한
  프롭이고, `accessibilityRole="alert"`에는 iOS/VoiceOver에서 대응하는 트레이트가 없다. **즉 프롭만
  걸린 자리는 iOS에서 여전히 완전히 조용했고**, 문서와 계약은 그 사실을 반대로 적고 있었다
  (`runtime-verification-required.md` #127 ⓗ가 *"iOS에서는 role이 답한다"* 고 적었다 — 정정됐다).
  ⚠️ **답은 이번에도 저장소 안에 이미 있었다**: `src/ui.tsx`의 `announceForA11y`이고,
  `app/(auth)/login.tsx`가 **같은 이유**(포커스가 눌린 버튼에 남는다)로 실패 문장에 그것을 건다.
  리뷰는 대장 안 맨 `<Text>` **여섯** 자리에 `useEffect(() => { if (실패) announceForA11y(문장); }, [...])`
  를 걸었다(Toast 자리는 컴포넌트가 이미 announce하므로 무접촉). **새 한국어 문장 0건 · 새 컴포넌트
  0건 · 렌더 0건.** 계약의 `exit` 축도 함께 셋이 됐다 — `announce`(두 플랫폼) · `live-region`
  (**안드로이드 한정**) · `toast`이고, **`live-region`만인 자리는 0건**이다. ⚠️ **여기서 배운 일반형**:
  *"프롭을 걸었다"*는 **어느 플랫폼에서** 걸었는지를 말하지 않는다 — 크로스플랫폼 앱의 접근성 계약은
  출구를 플랫폼별로 세지 않으면 절반만 센 것이다.
- **다음 라운드 후보(값으로만 · 이번 라운드가 열지 않았다).**
  ⓐ **조회 실패 대장 열넷**에 같은 질문을 하는 날, 그 질문은 이제 *"프롭이 걸렸는가"*가 아니라
  *"두 플랫폼 다 도달하는가"*다(위 축이 그 형식을 이미 갖고 있다).
  ⓑ **대장 밖 한 자리** — `app/settings/notifications.tsx`의 손으로 적은 푸시 설정 실패 줄은 프롭
  둘은 걸렸지만 announce 배선은 없다(대장이 세지 않는 자리라 이번 스윕의 모집단 밖이었다).
  결함으로 올리지 않는 이유: 그 줄은 대장의 단일 소스를 지나지 않아 **다른 계약이 지는 자리**다.
  ⓒ **`role="alert"` 단독 자리 하나**(축하 배너)는 그대로 둔다 — 실패가 아니고, DNC-018이 그
  자리에서 끼어들지 않기를 요구한다.
- ⚠️⚠️ **갱신 (2026-08-30 · 라운드 80) — 위 판정의 축이 "저장/조회"에서 "뮤테이션/쿼리"로 정정됐고,
  그래서 A-20 #85가 묻는 범위가 *좁아졌다*.** 라운드 80이 재어 보니 조회 대장 **열넷 안에 뮤테이션이
  세우는 문장이 셋**(개인정보 화면의 파기 미리보기 — `useLoadErrorCopy`를 쓰지만 방아쇠가
  `.mutate()`다) 있었고 대장 **밖**에 같은 모양이 **열** 더 있었다. 그 열셋은 라운드 80 트랙 A가
  닫았고, **A-20 #85가 기기에 넘긴 질문에 남는 것은 순수 쿼리 자리뿐이다.** ⚠️ **위 문단의 제외
  사유도 같은 이유로 다시 적혀야 한다** — "조회 대장은 범위 밖"이 아니라 **"쿼리 방아쇠는 화면 영역이
  통째로 바뀐다"** 이고, 계약의 `LOAD_ERROR_ANNOUNCE_OUT_OF_SCOPE_REASON`이 그렇게 정정됐다.
  판정은 **U-1**, 새 실기기 항목은 짝 문서 **#131**이다.

### T-2. **같은 함수, 다른 입력** — 주석이 *"규칙이 갈라질 수 없다"* 고 적어 둔 자리에서 입력이 갈려 있었다

- **사실.** 홈 화면은 예산 판정의 입력을 **재조정 값**에서 만든다 — `resolveThisMonthUsedKrw`의 한 값을
  히어로·진행바·예산 경고 배너·"지난달 같은 시점 대비" **넷이 함께 읽는다**(우선순위와 그 이유가
  `src/home/budget-edit.ts`에 값으로 적혀 있다: *"그 달에 아직 올라가지 않은 로컬 변경이 실제로 있을
  때만 캐시 우선"*). ⚠️ **그런데 같은 화면이 같은 순간에 만드는 예산 *알림*은 서버 원본을 본다** —
  훅에 넘어가는 것은 `home.data`이고 `budgetNotifications`가 받는 `spentKrw`는
  `monthly.usedAmountKrw`, 즉 **`resolveThisMonthUsedKrw`의 2순위(서버 집계) 그 자체**다.
- ⚠️⚠️ **그리고 그 사실이 소스에 "갈릴 수 없다"고 적혀 있었다.** `apps/api/src/push/push-dispatch.service.ts`:
  *"서버 푸시·홈 배너·인앱 알림 세 표면이 같은 함수를 호출하므로 규칙이 갈라질 수 없다."*
  **판정 함수는 하나가 맞다**(`reachedBudgetBoundaries` — 셋 다 부른다). ⚠️ **갈라지는 것은 규칙이 아니라
  입력이다. 함수를 공유했다는 사실은 입력이 같다는 뜻이 아니고, 그 문장을 적은 주석은 그 차이를 가린다.**
  라운드 78 S-4의 정확한 쌍둥이다 — *같은 이름, 다른 단위*가 이번에는 *같은 함수, 다른 입력*으로 나타났다.
- ⚠️ **형제 알림 둘은 이미 답을 갖고 있었다.** `record_gap`과 `monthly_wrapup`은 `hasPendingLocalRecords`가
  참이면 **발화하지 않는다** — 그 이유가 같은 파일에 적혀 있다(*"서버 스냅샷이 모르는 기록을 두고 단언하지
  않는다 … 사용자가 반박할 수 있는 거짓말이 가장 나쁜 종류다"*). **그 값은 이미 이 훅에 넘어와 있었고,
  예산만 그 게이트를 지나지 않았다.**
- ⚠️⚠️ **판정의 축 — 알림은 목록에 얼어붙는 스냅샷인가, 화면의 거울인가.** 이것이 두 답을 가르는 질문이고,
  **저장소는 이미 두 번 앞을 답했다**(형제 알림 둘). 스냅샷이면 **모르는 동안 침묵**해야 하고, 거울이면
  **화면과 같은 수**를 먹여야 한다. ⚠️ **주간 요약은 뒤를 답한 자리이고 그래서 이 게이트 밖이다** —
  1순위가 **홈 주간 카드가 재조정 캐시로 이미 만든 값**이라 화면과 같은 수를 말하고, 서버 집계는 그 캐시가
  **확정 실패**했을 때의 폴백뿐이다(그때는 서버 값이 유일하게 아는 사실이다).
- **오늘의 값.** 형제 둘이 이미 지고 있는 규율을 예산에도 적용했다 — `budgetNotifications`의 **경계 판정
  앞**에 게이트 한 줄이 선다. **새 인자 0건**(그 값은 라운드 54 P1-3부터 이미 그 입력에 있었다) ·
  **배선 0건** · **문구·dedupeKey 형식 바이트 불변** · **서버 0건** · `app/(tabs)/index.tsx` **무접촉**.
  계약은 파생 단언(대기 행이 참이면 `budget_80`·`budget_100` 후보가 **0건** — 형제 둘과 **같은 갈래
  형식**) · **키를 태우지 않을 것**(억제된 평가가 dedupe 메모리에 기록을 남기지 않아 동기화 뒤 다음 평가가
  **정확히 한 번** 발화) · 부정 단언(대기 0건이면 종전과 **바이트 불변** — 오늘 대다수 경로)이고,
  게이트 **밖 셋의 이유**가 값으로 적혔다.
- ⚠️ **대가를 값으로 적는다 — 대기 행이 있는 동안 인앱 예산 알림은 *미뤄진다*.** 손실이 아니라 지연인
  이유는 둘이다: **같은 순간 배너가 화면에서 말하고 있고**(재조정 값으로), **서버 푸시는 지출 커밋 시점에
  `push_boundary_marks` 클레임으로 따로 간다**(at-most-once). ⚠️ **종전 반대 방향이 더 나빴다는 사실도
  함께 남긴다**: 서버가 이미 80%인데 이 기기에 **삭제 대기** 행이 있어 재조정 합계가 79%면 **배너는 서지
  않는데 알림은 뜨고 그 달의 `budget_80` dedupeKey를 태웠다** — 나중에 진짜로 80%를 넘겨도 그 달에는
  다시 오지 않았다.
- ⚠️⚠️ **고르지 않은 대안과 그 이유가 이 절의 재사용 가능한 값이다.** *"배너와 같은 수를 훅에 넘긴다"*
  (인자 하나 추가)가 더 정확해 보이고 주간 요약이 이미 그 형태인데, `monthlyUsed`는
  `app/(tabs)/index.tsx:1482`에서 만들어지고 훅 호출은 `:1260`이라 **둘 중 하나를 옮겨야 한다.**
  ⚠️ **그 파일을 소스로 읽는 테스트가 35이고 그중 28이 `indexOf`를 쓴다** — S-5가 이름 붙인 위험(자리가
  바뀌면 잘린 구간이 조용히 다른 것이 된다)이 **가장 크게 실현될 수 있는 단일 파일**이다. **최소안은 그
  파일을 열지 않고 같은 정직성을 얻는다.** 대안을 고르는 판단 기준도 함께 적어 둔다: **얼어붙는
  스냅샷인가(→ 침묵), 화면의 거울인가(→ 같은 수).**

- ⚠️⚠️ **라운드 79 리뷰(M-3·S-1) — 게이트의 *술어*가 위 서술("대가는 지연")을 거짓으로 만들고
  있었다.** 형제 둘이 쓰던 `hasPendingRecordsForChild`는 ⓐ `syncState !== "synced"`를 **전부** 세고
  ⓑ **달을 가리지 않는다**. 그 술어를 예산에 그대로 먹이면 두 가지가 어긋난다.
  · **종점 상태**: `failed`·`conflict` 행은 큐가 스스로 다시 보내지 않아 **사용자가 재시도하거나
    폐기할 때까지 영구히 남는다.** 예산 dedupeKey는 **달 단위**라, 그 한 행이 **그 달의 예산 알림을
    영영** 막았다 — 지연이 아니라 **그 달 전체의 손실**이다(record_gap은 주 단위 dedupe라 성질이
    다르고, 그래서 그쪽에서는 같은 술어가 옳다).
  · **달**: 3월에 실패한 행이 8월 경계를 막을 이유가 없다.
  그래서 예산만 자기 술어를 든다 — `hasRecoverablePendingRecordsForMonth`(**회복 가능한 상태
  (pending·syncing) × 그 달**). ⚠️ **그 달 단위는 배너가 서버 집계 대신 재조정 캐시를 고르는 조건
  (`hasPendingMonthAdjustments`)과 같다** — 두 표면이 같은 "이번 달"을 보게 하는 것이 이 게이트의
  목적이므로 단위도 같아야 한다는 것이 판정이다(계약이 두 술어를 같은 행으로 나란히 돌려 그 사실을
  문다). **형제 둘의 값과 동작은 한 글자도 바뀌지 않았다.**
- ⚠️ **그 대가로 위 "고르지 않은 대안"의 근거 하나가 반쯤 무너졌다 — 값으로 적는다.** 최소안의 장점은
  *"`app/(tabs)/index.tsx`를 열지 않는다"* 였는데, 올바른 술어는 **그 화면이 이미 들고 있는 스냅샷과
  `thisYearMonth`** 로만 만들 수 있어 결국 그 파일에 **한 줄(+훅 인자 하나)** 이 늘었다. 새 요청·새
  구독은 여전히 0건이고, 그 파일을 소스로 읽는 계약 둘(`notification-flow.test.ts`의 호출 핀 ·
  `monthly-wrapup.test.ts`의 deps 핀)은 **바이트 핀에서 모양 핀으로** 함께 낮췄다(T-1이 접근성 층에서
  쓴 그 답과 같다). ⚠️ **판정**: *"그 파일을 열지 않는다"* 는 설계 목표가 아니라 **비용**이고, 비용이
  정직성과 부딪히면 정직성이 이긴다 — 대신 그 파일을 여는 걸음은 **핀을 함께 낮추는 걸음**이어야 한다.
- **다음 라운드 후보(값으로만).** ⓐ **형제 둘에도 같은 병이 남아 있다** — `record_gap`·`monthly_wrapup`은
  여전히 종점 상태 행을 세므로, 실패 한 행이 있는 기기에서는 그 둘이 **영구히** 침묵한다. 그쪽은
  dedupe 단위(주·달)와 문장의 성질이 달라 **같은 답이 옳은지가 다른 질문**이라 이번에 열지 않았다.
  ⓑ **게이트의 달과 알림의 달이 다른 순간이 있다** — 게이트는 서울 달력의 `thisYearMonth`(배너와 같은
  값)를, 알림은 `/home`의 `monthly.yearMonth`(서버)를 본다. 자정·월초 경계의 짧은 창에서 둘이 갈릴 수
  있고, 오늘 그 창의 답은 **배너와 같은 쪽**이다(두 표면을 맞추는 것이 이 게이트의 목적이므로).
- ⚠️⚠️ **갱신 (2026-08-30 · 라운드 80) — 후보 ⓐ가 채택됐고 답은 "상태가 아니라 **범위**"였다.
  그리고 ⓑ의 창은 닫혔다.** ⓐ 형제 둘의 병은 **지연이 아니라 정지**였다(`failed`·`conflict` 한 행이
  남은 기기에서 `record_gap`·`monthly_wrapup`이 **영영** 발화하지 않았다 — 핵심 루프의 재진입 유도
  둘이 조용히 죽는다). ⚠️ **그런데 답은 예산처럼 상태를 좁히는 것이 아니었다** — 두 알림이 실제로
  단언하는 것을 보면 어떤 행이 판정을 바꿀 수 있는지가 정해진다: `record_gap`은 *"마지막 기록 이후
  N일"* 이라 **`lastRecordedOn`보다 뒤인 행**만, `monthly_wrapup`은 *"지난달 총액"* 이라 **지난달
  행**만 그 판정을 바꾼다. **상태 집합은 종전 그대로(종점 포함)이고 좁힌 축은 범위이며, "서버가
  모르는 기록을 두고 단언하지 않는다"는 규율은 한 글자도 약해지지 않았다** — 오히려 그 규율이 원래
  뜻하던 것에 정확해졌다. ⓑ **오늘의 답**: 예산 게이트가 보던 달은 기기 서울 달력이었고 그 게이트가
  막는 알림이 태우는 키의 달은 **서버의 달**이라, 게이트의 달을 **알림이 키를 태우는 달**로 맞췄다
  (표현식 하나 · 훅 시그니처 한 칸도 늘지 않았다). 배너·진행바는 기기 달력을 계속 본다 — **라이브
  표면이라 단위가 다르다**는 사실이 그 자리에 값으로 적혀 있다. 판정은 **U-3**, 실기기 항목은 짝 문서
  **#132**다.

### T-3. **L-1의 답 — 통합하지 않는다.** 네 모듈이 각자 표를 드는 데는 각각 이유가 있고, 없던 것은 표가 아니라 그물이었다

- **사실.** 세 라운드 이월된 질문(*"세 모듈이 같은 표를 같은 순서로 읽는가"*)을 실측했다.
  ⚠️ **모듈은 셋이 아니라 넷이고, 넷 다 다른 표를 든다.**
  ⓐ `resolveSaveErrorCopy` — `apiErrorCodeOf` · **표 → 오프라인 → 폴백** · 공용 표.
  ⓑ `memberMutationErrorMessage` — `familyErrorCodeOf`(공용 + 옛 봉투 JSON) · **403 → 자기 표(넷) →
  오프라인 → 종류별 폴백** · 자기 표.
  ⓒ `inviteCreateErrorMessage` — `isInviteForbiddenError`(봉투 JSON 직접) · **403 → 오프라인 → 훅의 답 →
  초대 폴백** · 훅을 지난 표.
  ⓓ `invite-accept-messages` — `hasApiErrorCode` · **코드 둘 → 한 문장**(오프라인 갈래 없음) · 코드 목록 둘.
- ⚠️⚠️ **표를 통합하면 안 되는 이유가 이미 소스에 있었다.** 서버 원문이 영어이거나
  (`HOUSEHOLD_MEMBER_NOT_FOUND: "Household member was not found."`) **이 화면 맥락에서만 뜻이 통한다**
  (*"이미 가족에서 빠진 구성원이에요"*). `invite-accept-messages.ts`는 더 강하다 — `INVITE_NOT_FOUND`와
  `INVITE_NOT_PENDING`을 **일부러 한 문장으로 받는다**(무인증 공개 조회라 둘을 가르면 앱이 **존재
  오라클**이 된다). **표에 넣는 순간 그 판단이 사라진다.**
- ⚠️ **`inviteCreateErrorMessage`만 오프라인이 앞인 것도 결함이 아니다.** 그 자리의 `isOnline`은 독립된
  폴이 아니라 `inviteSaveErrorCopy !== OFFLINE_SAVE_NOTICE`라 **훅의 답에서 파생한 값**이다 — 서버가
  코드를 준 실패는 훅에서 이미 표의 문장으로 갈라지므로 그 비교가 참이 되어 오프라인 갈래를 지나간다.
  ⚠️ **그것이 오프라인이 앞이어도 되는 유일한 근거이므로, 화면이 독립 폴로 바꾸는 날 빨개지게 계약으로
  세웠다.**
- ⚠️⚠️ **그리고 이 여정이 S-1의 열린 질문에 답을 갖고 있었다.** S-1은 *"표는 코드 하나 = 문장 하나를
  가정하는데 서버는 그렇지 않다"* 를 관측하고 **표를 늘리는 다음 라운드가 먼저 물어야 할 질문**이라고
  적었다. **가족 여정이 그 반례를 이미 풀어 두었다**: `FORBIDDEN`은 이 여정에서 서버 문장 둘을 나르고,
  앱은 그것을 **호출부로 가른다** — 초대 생성이면 `INVITE_FORBIDDEN_MESSAGE`, 구성원 관리면
  `MEMBER_MANAGE_FORBIDDEN_MESSAGE`, 그 밖이면 표의 중립 문장(**셋이 서로 다른 문장임**을 단언이 센다).
  ⚠️⚠️ **답은 "코드를 나누는 것"이 아니라 "부르는 자리가 가르는 것"이었다.** 그리고 **반대 방향의 답도
  같은 여정에 있다** — 초대 수락은 문장 둘을 나르는 두 코드를 **일부러 하나로** 받는다(존재 오라클 금지).
  ⚠️ **정찰 값 정정**: 정찰은 이 여정에서 문장을 둘 이상 나르는 코드를 `INVITE_NOT_PENDING` **하나**로
  적었는데 스윕은 **셋**을 센다(`FORBIDDEN` · `INVITE_NOT_FOUND` · `INVITE_NOT_PENDING`) — **스윕 쪽이
  옳다**(O-3: 인용이 실측을 대신하지 않게).
- **오늘의 값.** **제품 소스 0건 · 새 한국어 문장 0건 · 표 통합 0건.** 세 번째 여정 스윕
  `FAMILY_JOURNEY_SERVER_FILES`가 `CHILD_PROFILE_JOURNEY_SERVER_FILES`와 **같은 형식**으로 섰다 — 서버
  파일 **둘**(서비스 하나 + **관문 하나** — 컨트롤러가 오늘 4xx를 직접 던지지 않아도 목록에 들고 있어야
  그 자리에 코드가 생기는 날 스윕이 본다. 라운드 76 C가 가져오기 여정에서 배운 그 교훈)의 4xx 코드
  **일곱**이 **네 출구의 합집합**을 정확히 덮는다. ⚠️⚠️ **네 출구를 명시하는 것이 이 스윕의 본체다** —
  라운드 78 A의 스윕은 출구가 둘이었는데 이 여정은 **넷**이고, 그 사실을 적지 않으면 다음 라운드가
  *"표에 없다"* 를 결함으로 읽는다. 출구는 **손으로 적은 코드 목록이 아니라 각 모듈에 실제로 물어본
  답**이라(사본을 만들면 그 순간 다섯째 표가 생긴다) 모듈의 표가 바뀌면 판정도 함께 바뀐다.
  판정 순서 넷도 파생 단언으로 못박혔다. `apps/mobile` **신규 19**.
- ⚠️ **제외 하나의 사유가 이 절이 남기는 재사용 가능한 값이다.** `HOUSEHOLD_NOT_FOUND` — *"가구 행 자체가
  사라진 경우다. 세션이 그 가구를 들고 있는 한 사용자가 고칠 것이 없는 **배선 어긋남**이라 이 여정의 어느
  화면도 이 코드를 문구로 받을 필요가 없다"*(78 A의 `SETTINGS_CONFIRMATION_REQUIRED` 사유와 같은 모양).
  ⚠️ **그 사유가 기대는 사실은 산문이 아니라 세어져 있다** — `HOUSEHOLD_NOT_FOUND`를 읽는 **제품 소스가
  저장소 전체에서 0건**임을 스윕이 매번 다시 확인하고(제품 소스 **326**을 걷는다 · **테스트 파일은
  소비자가 아니다**), 소비자가 하나라도 생기는 날 그 줄이 빨개져 **제외 사유를 다시 보게 한다.**
- ⚠️ **큰 질문은 이번에도 닫히지 않는다.** 여정 목록은 **셋**이 됐고(가져오기 · 아이 프로필 · 가족),
  **남은 여정 셋**(동기화/오프라인 · 설정/파기 · 인증)은 목록을 신설하지 않았다. **"이 저장소에 즉시 요청
  여정이 몇 개인가"에 오늘도 답이 없다** — 닫힌 것은 *가족 여정에 그물이 있는가*이고, 그것은 **여정을
  정의하지 않고도 물을 수 있는 질문이었다**(Q-3이 이름 붙인 그 구분의 세 번째 사례다).

### T-4. **S-2의 나머지 절반** — 대시보드는 살아났고, 운영자가 실제로 일하는 화면은 아직 한 줄이었다

- **사실.** 라운드 78 B가 예약 게시 잡의 실패를 워커 상태까지 올렸고, 대시보드는 *"연속 3회 이상 실패한
  작업이 있어요: cms_scheduled_publish"* 를 말하기 시작했다. ⚠️ **그런데 운영자가 실제로 일하는 화면은
  `/reviews`이고, 거기 배지는 여전히 한 줄이었다** — `OVERDUE_SCHEDULE_NOTE`(*"지난 예약 · 아직 게시되지
  않았어요"*)가 `status === "in_review"` + 지난 `scheduledFor` **둘로만** 서서, **실패 보상으로 되돌아온
  행과 워커가 꺼져 있어 손도 못 댄 행이 글자까지 같은 한 줄을 받았다.** 그 주석이 적은 원인도
  *"워커가 꺼졌거나 멈춘 동안 그 시각이 지나갔다"* **둘뿐**이라 라운드 78 B 이후 **낡아 있었다.**
- ⚠️⚠️ **두 화면이 같은 사실에 대해 운영자에게 서로 다른 다음 행동을 시켰다.** 대시보드는 *"잡이 실패
  중"* 이라 말하고 배지는 *"아직 게시되지 않았다"* 라 말한다 — 배지만 보면 **워커를 켜면 된다는 뜻**으로
  읽혀, 운영자는 인프라 담당에게 묻고 **워커는 정상이라는 답**을 받는다.
- ⚠️ **필요한 값은 그 화면이 이미 손에 들고 있었다.** `/reviews`는 `loadWorker` → `setWorker`로 워커 상태
  객체를 이미 받아 두고 예약 폼 위 안내가 그것을 읽는데, **배지만 읽지 않았다.** S-2가 이름 붙인 그
  모양(*담아서 돌려주는데 아무도 읽지 않는다*)의 **화면 층 잔여**이고, 그래서 고치는 값이 쌌다 —
  **새 요청 0건 · 새 상태 0건 · 응답 스키마 0건.**
- ⚠️⚠️ **판정 — 문장은 *잡에 대해* 말한다.** 워커가 알려 주는 사실은 *"예약 게시 잡이 연속 실패 중"*이지
  *"이 초안이 실패했다"*가 **아니다**(그 잡은 그 틱의 대상 전부를 처리하고, 이 행이 그중에 있었는지는 그
  응답에 없다). **초안 단위로 단정하면 라운드 78 B가 서버에서 피한 허위가 배지에서 되살아난다** — 그것이
  이 트랙의 경계였다. 그래서 종전 문장을 **그대로 두고 뒤에 한 절을 잇는다**(확실한 사실 — *"아직 게시되지
  않았다"* — 은 이 경우에도 그대로다). ⚠️ **이 라운드가 더한 유일한 한국어 문장**이고, 재시도를 권하지
  않으므로 표기 방언과 무관하다.
- ⚠️ **바로 옆의 대조가 이 판정의 근거다.** `SCHEDULE_BLOCKING_WORKER_STATES`는 `degraded`를 **일부러
  뺐다** — 실패 중인 잡이 링크 검사일 수 있어서이고, **그 판단은 그대로 옳다**(무접촉). ⚠️ **배지는 잡
  이름을 볼 수 있으므로 그 이유가 서지 않는다** — `LINK_HEALTH_JOB_NAME` 옆에 `SCHEDULED_PUBLISH_JOB_NAME`
  한 줄이면 *예약 게시 잡이 실패 중인가* 를 정확히 물을 수 있다. **같은 신호를 두 자리가 서로 다른
  해상도로 읽어도 되는 이유**가 이 절의 재사용 가능한 값이다: 폼은 *"지금 예약을 걸어도 되는가"* 를 묻고,
  배지는 *"이 행이 왜 안 나갔는가"* 를 묻는다.
- **오늘의 값.** 판정 한 자리 + 상수 한 줄 + 화면의 인자 한 개다. **부정 단언 셋**이 함께 섰다 — 워커
  상태를 **모르면**(null) 종전 문장 **바이트 불변**(그 화면이 이미 지키는 *"모르면 말하지 않는다"*) ·
  실패 중인 잡이 `link_health`뿐이면 종전 그대로 · 지난 예약이 아니면 배지 자체가 없다. 임계치는
  대시보드와 **같은 것**을 쓴다(두 화면이 같은 순간 다른 사실을 말하지 않게). 낡은 원인 주석은 **둘에서
  셋**으로 갱신됐고, ⚠️ **`/reviews`에 컨트롤은 0건 추가**다(`onClick=`·`id=` 0건 — 트랙 E가 읽는 역할
  게이트 대장의 `submits`·`edits` 수치를 흔들지 않는 것이 D와 E의 분리 조건이었다). **서버 0건 ·
  마이그레이션 0건.** `apps/admin` **신규 10**.

- ⚠️⚠️ **라운드 79 리뷰(M-2·S-6) — 그 배지가 워커 상태의 *표시 우선순위*를 건너뛰고 있었다.**
  `failingJobNames()`는 잡의 **잔존 카운터**만 읽으므로, 임계치를 넘긴 뒤 워커가 꺼지거나(`off`)
  멈춰도(`stale`) 계속 참이다. 그러면 같은 화면의 두 줄이 **서로 다른 다음 행동**을 시킨다 — 예약 폼 위
  안내는 *"워커가 꺼져 있어요"* 라고 말하는데 배지는 *"연속 실패 중이에요"* 라고 **현재진행으로** 말한다
  (꺼진 워커는 실패 중일 수 없다). ⚠️ **이 절이 고치려던 병("두 화면이 서로 다른 다음 행동을 시킨다")이
  같은 화면 안에서 재발한 셈이다.** 그래서 실패 절은 `workerHealthState(health) === "degraded"`일 때만
  선다 — **대시보드 한 줄이 잡 이름을 말하는 순간과 정확히 같은 조건**이다(`workerHealthStateNote`의
  degraded 갈래). 부정 단언 둘이 함께 섰다(`stale`+잔존 실패 · `off`+잔존 실패 → **종전 문장**).
- ⚠️ **S-6 — 그 함수는 `note`를 신뢰하지 않는다.** 인자로 온 문장이 이 모듈이 아는 그 문장
  (`OVERDUE_SCHEDULE_NOTE`)이 아니면 뒤에 절을 잇지 않고 **그대로** 돌려준다. **문장을 조립하는 자리는
  이 모듈 하나**여야 하고, 호출부가 다른 배지를 넘기는 날 *"예약 게시 작업이 …"* 가 남의 문장에 붙어
  뜻이 어긋나는 것을 막는다. **판정의 일반형**: 조립 함수가 인자로 받은 문장을 **아는 문장인지 묻지
  않으면**, 그 함수는 자기가 모르는 문장까지 대신 주장하게 된다.

### T-5. **파서를 합치기 전에 오늘의 답이 같은지부터 묻는다** — 그리고 문서에 없던 차이가 하나 더 있었다

- **사실.** S-4가 지시한 순서(ⓐ 교차 단언 → ⓑ 추출)의 ⓐ를 실제로 돌렸다(2026-08-30 · `admin-api.ts`를
  두 파서로 각각 파싱). **오늘의 답**: `export function` **48** · 두 파서의 쓰기 함수 집합이 **정확히 하나
  차이**다 — 역할 게이트 쪽 **25**, 함수 표 쪽 **24**, 차이는 `draftAndSubmitContentRevision`(쓰기 함수를
  부르는 **한 겹 합성**을 승계하는 쪽에만 있다) 하나뿐이고 **반대 방향 차이는 0건**이다.
  ⚠️ **그 차이가 소스 주석이 적어 둔 설명과 정확히 일치한다** — 즉 문서가 옳았다는 것을 **재어서** 알았다.
- ⚠️⚠️ **문서에 적히지 않은 차이도 하나 있었다(오늘 답은 같다).** 함수 표 쪽은 선언의 끝을
  `ADMIN_API_DECLARATION_END_PATTERN`으로 자르고, 역할 게이트 쪽은 **다음 `export function`까지의 청크
  전체**를 본다. 즉 **선언 끝 뒤 꼬리(파일 상수·주석)에 쓰기 메서드 리터럴이 생기면 한쪽만 센다.**
  실측: 오늘 그런 자리는 **0건**이다. ⚠️⚠️ **그래서 오늘은 아무도 이 차이를 볼 수 없었다** — S-4가
  *"오늘 참이라 조용한 가정"* 이라고 이름 붙인 바로 그 모양이 **파서 자신에게** 한 겹 더 있었고,
  **가정을 승격하러 간 도구가 자기 안에 승격되지 않은 가정을 갖고 있었다.** 그 사실이 오늘 단언으로
  섰다(꼬리에 쓰기 메서드가 있는 자리 **0건**).
- ⚠️ **ⓐ 없이 ⓑ만 했을 때의 실패 모양이 이 절의 값이다.** 공용 모듈이 한쪽 단위(예: 함수 표 쪽)로 서면
  역할 게이트는 그때부터 `draftAndSubmitContentRevision`을 **쓰기 함수로 세지 않는다.** 그 함수는
  create + submit 둘을 부르는 합성이라 역할 게이트가 지켜야 할 목록에서 **조용히 빠지고**, **어떤 단언도
  깨지지 않으며**, 다음에 그 경로에 역할 구멍이 생기면 아무도 모른다. **한쪽의 단위가 조용히 다른 쪽을
  덮는다**(R-6 P-3이 이름 붙인 그 병).
- **오늘의 값.** **제품 소스 0건**(`src/lib/admin-api.ts` 무접촉) · **수치·이름 목록 바이트 불변**
  (**24 = retrySafe 8 + 멱등 6 + 비멱등 10** · 역할 게이트 **25** · `export function` **48**). 교차
  단언이 먼저 초록이 된 뒤 공용 파서 한 벌이 섰고, ⚠️ **두 단위를 인자로 받으며 어느 쪽도 기본값이
  아니다** — **기본값이 곧 "조용히 덮는다"의 입구**라, 부르는 자리가 자기 단위를 **말하지 않고는** 이
  파서를 쓸 수 없다(목록 밖 값을 넘기면 파서가 **던진다** — 조용히 비지 않는다). 드리프트 재현(두 파서가
  갈라지는 소스를 넣으면 실제로 빨개진다)도 함께 섰다. `apps/admin` **신규 8**.
- ⚠️ **공용 파서를 둔 자리도 판단이다.** `apps/admin/test/admin-api-source-parser.ts` — **`src/lib/`에
  두면 어드민 런타임 번들에 죽은 코드가 실리고**, `src/`·`app/` 아래에 두면 이 워크스페이스의 소스 스윕
  (미러 스크레이프 · 역할 게이트 · 조회/쓰기 실패 문구)이 **화면 소스로 읽는다.** 두 뿌리 밖이라 어느
  스윕도 이 파일을 걷지 않고, `.test.ts`가 아니라 슬라이스 가드 대장의 스윕에도 들지 않는다.
  **테스트 전용 모듈의 자리는 "번들에 실리는가"와 "스윕이 걷는가" 둘 다로 정해진다**는 사실이 값이다.
- ⚠️⚠️ **라운드 79 리뷰(S-5) — 바로 그 "어느 스윕도 걷지 않는다"가 그대로 두면 구멍이다.**
  소스 계약의 **자르기를 실제로 하는 코드**가 슬라이스 가드의 모집단 밖에 서 있었다. 모집단을 넓히면
  그 대장이 헬퍼·픽스처까지 세게 되므로(그 결정은 다음 라운드의 것이다) **예외를 값으로 적고 같은
  검출기를 그 파일에 직접 돌린다** — 라운드 78 E의 대장 형식 그대로이고, 그 줄은 **자기 무효화**된다
  (파일이 사라지거나 미가드 자리가 생기면 빨개진다). 오늘 그 파일의 미가드 자리는 **0건**이다
  (`slice`가 정규식 `exec` 결과를 **널 검사한 뒤**의 index만 쓴다).
- ⚠️ **라운드 79 리뷰(S-4) — 번들 밖 계약도 한 파일이 아니라 전수여야 한다.** 종전 단언은
  `admin-api.ts` 한 곳과 **파일명 넷**만 봤다: 다른 화면·훅이 이 파서를 import하면 번들에 실리는데도
  초록이었다. 이제 번들 뿌리(`src/**`·`app/**`)의 **비테스트 소스 전수**에서 참조가 0건인지 묻고,
  스윕이 실제로 파일을 걷었다는 실재 확인을 함께 세운다(0건 스윕 위의 부정 단언은 영원한 초록이다).
- ⚠️ **라운드 79 리뷰(P-3) — 합성 승계는 정확히 한 겹이고, 그 경계가 이제 계약이다.** 역할 게이트
  단위의 승계 루프는 **고정점이 아니다**: 한 번만 돌고, 근거는 **직접 쓰기 함수**뿐이다(승계로 방금
  오른 이름은 근거가 되지 않는다 — 자라는 집합을 다시 읽으면 순서에 따라 두 겹이 우연히 섞인다).
  *합성을 부르는 합성*은 오늘 **0건**이고, 그 0건과 경계의 모양이 함께 단언으로 섰다 — 두 겹이 생기는
  날 그것이 사고가 아니라 **결정**이 되게 한다(ⓓ가 꼬리 차이에 쓴 그 규율의 재적용이다).
- ⚠️ **라운드 79 리뷰(P-1) — 같은 병이 모바일 접근성 스캐너에도 한 겹 있었다(값으로만).**
  `a11y-contract.test.ts`의 JSX 스캐너가 **자기 닫힘 중첩**(`<Text …/>`)을 중첩으로 세어 바깥 요소의
  본문 끝을 파일 끝까지 밀고 있었다 — 그 뒤의 자리가 통째로 삼켜져 **출구가 잘못 매겨질** 수 있었다.
  여는 태그 판정에 이미 있던 기준(`endsWith("/>")`)을 중첩 판정에도 적용하고 재현 픽스처를 세웠다.
  **판정**: 같은 파일 안에서 한 번 내린 판정은 **그 파일의 모든 갈래에** 적용돼야 한다.
- ⚠️⚠️ **갱신 (2026-08-30 · 라운드 80) — 리뷰 S-5가 다음 라운드로 넘긴 *모집단 결정*이 내려졌다:
  모집단은 파일 이름이 아니라 하는 일이다.** 슬라이스 가드의 스캔 뿌리에 **테스트 전용 뿌리 둘**이
  전수로 편입되면서(`apps/admin/test` 포함) 라운드 79의 **한 파일 예외 줄은 사라지고 대장 한 줄이
  대신 섰다** — 검출기가 두 벌로 돌던 임시안이 하나로 줄었고, 그 사실 자체가 단언으로 선다(예외가
  소스에 남아 있으면 빨개진다). 모집단 **294 → 296**이고 **대장 수치·가드 하한은 비증가**다.
  ⚠️ **이것이 라운드 78 E가 래칫을 세운 이유(*"기억이 아니라 대장이 센다"*)로 되돌아온 걸음이다** —
  임시안의 비용은 *새 테스트 전용 헬퍼가 생길 때마다 사람이 그 예외를 기억해야 한다*였다.
  ⚠️ **모집단을 "이름"에서 "하는 일"로 옮긴 이 걸음은 U-1이 낭독 층에서 한 것과 같은 모양이다**
  (거기서는 *대장 → 방아쇠*, 여기서는 *`.test.ts` → 소스를 문자열로 읽어 자르는 파일*).
  `apps/api`는 **범위 밖 유지**다(그 확장은 또 다른 결정이다).

## U. 라운드 80에서 확정한 판정 (2026-08-30 · GAP-080 트랙 F)

라운드 79가 축을 **문장이 사용자에게 도달하는가** 로 옮겼다면, 라운드 80은 그 한 칸 아래를 물었다 —
**그 도달을 세는 그물의 모집단이 이 질문의 단위인가.** 80라운드째라 이번 축은 새 기능 발굴이 아니라
**누적 부채 정리와 판정 현행화**였고, 다섯 판정 다 K~T절과 같이 **결함 보고가 아니라 다음 결정의
입력**이며 2026-08-30 소스에서 확인됐다(라운드 80 트랙 A·B·C·D·E 머지 후).

⚠️⚠️ **이번 라운드의 가장 값진 관측: 그물의 모집단이 잘못된 단위였다.** 라운드 79는 낭독을
**대장**(`OFFLINE_AWARE_SAVE_ERROR_SCREENS`)으로 셌고, 그것이 옳은 축이라고 판단해 조회 대장 열넷을
실기기 답이 올 때까지 미뤘다. ⚠️ **그런데 그 두 대장을 가르는 축(조회/저장)과 낭독이 실제로 기대는
축(포커스가 어디 남는가)이 같지 않았다** — 조회 대장 **안에** 뮤테이션 자리가 셋 있었고, 대장 **밖**에
같은 모양이 **열**이 더 있었다. **대장은 문구의 단일 소스를 세는 단위이지 도달을 세는 단위가 아니었고,
그 사실은 기기가 아니라 소스가 답했다**(U-1). 같은 모양이 이번 라운드에 한 겹 더 있다 — 자르기 계약이
자기 모집단을 **파일 이름**(`.test.ts`)으로 잡고 있었고, 자르기를 실제로 하는 코드가 그 밖에 있었다
(T-5 갱신). **일반형: 어떤 그물을 새 축에 재사용할 때는 그 그물의 모집단이 새 질문의 단위인지 먼저
묻는다.**

⚠️⚠️ **두 번째 관측: "이름이 낭독인 계약"이 아홉 라운드 동안 초록이었다**(U-2). 라운드 79가 T-1에서
*"정확도만 다섯 번 올랐고 도달은 한 번도 세어지지 않았다"* 고 적었는데, **그 문장의 가장 이른 사례는
계약 파일 자신이었다.** **일반형: 계약의 제목이 묻는 것과 본문이 묻는 것이 갈리면, 그 계약은 갈린
만큼 조용하다.**

⚠️⚠️ **세 번째 관측: 80라운드째의 부채는 "열린 것"보다 "닫혔는데 열렸다고 적힌 것"이 많다.**
이번 총점검에서 **코드로 닫을 수 있는데 아직 열린 것**은 다섯이었고, **판정이 낡은 것**은 둘이었다 —
`docs/5차/launch-readiness-status.md`의 §5/§6 모순 서술(이미 라운드 73 후속이 닫았다)과
**Q-1의 초대 화면 "남은 사실"**(라운드 77 트랙 E가 닫았고 같은 절의 아래 문단이 *"R-5에서 종결"* 이라고
적고 있었다). ⚠️ **그리고 낡은 판정 둘은 둘 다 "다음 트랙의 몫"이라고 적힌 채로 남아 있었다 —
소유자를 지목하는 문장이 소유자를 만들지는 않는다.** 이번 라운드가 트랙 F에 그 둘을 **이름으로**
배정해 한 줄씩 정정했다. **일반형: 이월은 값으로 적히면 살아남지만, 완료도 값으로 적혀야 사라진다**
(적지 않으면 다음 사람이 그 문단을 근거로 같은 일을 다시 한다 — 라운드 80 정찰이 실제로 그 둘을
후보로 다시 주웠다).

**같은 저장소가 같은 물음에 이미 답해 둔 자리를 먼저 찾는 것이 이번에도 가장 값쌌다.** U-1의 배선은
**같은 화면의 성공 안내 둘**에, U-3의 범위는 **같은 입력 안의 두 값**(`lastRecordedOn` ·
`monthly.yearMonth`)에, U-4의 술어 대기는 **Playwright의 폴 상한** 안에, U-5의 제외 형식은 **이 저장소가
이미 다섯 번 쓴 형식**에 완성된 채 있었다. ⚠️ **다섯 트랙 통틀어 새 한국어 문장 0건**이고, 제품 소스를
여는 트랙은 **둘**(A·B)뿐이며 그중 B가 여는 것은 **표현식 둘**이다.

**오늘의 수치.** `apps/mobile` **4,691 → 4,721**(트랙 A **17** · 트랙 B **0**(generators 70 — 갈래 재편) ·
트랙 D 신규 **13**) · `packages/test-utils` **115 → 117**(트랙 E) · `apps/admin` **543** ·
`apps/api` **821**·`packages/domain` **131**·`packages/contracts` **66**은 **무변경**
(⚠️ api 소스를 여는 트랙이 0건이었고 — 트랙 C가 연 것은 QA 스크립트 하나다 — 라운드 78 E의 슬라이스
가드는 다섯 트랙이 *"새 `indexOf` 자리에는 예외 없이 실재 확인을 함께 세운다"* 를 공통 금지로 지켜
**대장 수치가 한 줄도 늘지 않았고**, 트랙 E가 모집단만 넓혔다).

⚠️⚠️ **보류를 유지한 축 셋을 값으로 남긴다 — 다음 라운드가 같은 실측을 다시 돌리지 않도록.**

- **조회 실패의 낭독(쿼리 방아쇠 열아홉) — 보류 유지, 다만 범위가 좁아졌다.** T-1이 기기로 넘긴 질문의
  절반은 소스가 이미 답하고 있었고(뮤테이션 셋), 이번에 닫혔다. 남은 것은 **순수 쿼리 자리**이고 이유는
  T-1의 문장 그대로다 — *"화면 영역이 통째로 바뀌어 사용자가 다시 훑는다."* **A-20 #85가 선행**이다.
- **S-3(어드민 `disabled`가 앗아가는 것) — 보류 유지, 재평가만.** 2026-08-30 재실측: 자리는 여전히
  **열하나**이고 라운드 79가 정정한 전제(`<select>`는 활성 상태에서도 드래그 복사가 되지 않는다 →
  `disabled`가 앗아가는 것은 **복사가 아니라 도달**)도 그대로다. **브라우저 확인(#130)이 선행**이고,
  이번 라운드의 어느 트랙도 그 둘을 열지 않았다.
- **`withdrawn_at` — 보류 유지, 재평가만.** 저장소 전체에서 그 이름이 나오는 자리는 **셋**이고 셋 다
  *"그 컬럼이 없다"* 를 말하는 자리다. 라운드 75 P-1 → 76 Q-4 → 77 R-6 → 78·79 P3의 구조가 변하지
  않았다. **컬럼 신설은 여전히 별도 결정이고(마이그레이션 0건 원칙), 이번 라운드는 `apps/api/**`를
  열지 않았다.**

### U-1. **그물의 모집단이 잘못된 단위였다** — 대장은 문구의 단일 소스를 세고, 낭독은 방아쇠에 기댄다

- **사실.** 2026-08-30 전수: `app/**`에서 **뮤테이션의 `isError` 아래 서는 실패 문장**은 **스무 자리**이고,
  라운드 79가 닫은 것은 그중 **일곱**(대장 다섯 화면)이었다. 남은 **열셋**은 프롭도 announce도 0건이거나
  (열둘) 프롭만 걸린 자리(하나)였다: `app/settings/privacy.tsx` **일곱** · `app/import/index.tsx` **둘** ·
  `app/import/[importJobId].tsx` **셋** · `app/settings/notifications.tsx` **하나**.
- ⚠️⚠️ **가장 값싼 증거가 한 파일 안에 있었다.** `app/settings/privacy.tsx`는 `announceForA11y`를 이미
  **두 번** 부른다 — 아이 삭제 완료 안내와 동의 재수집 완료. **둘 다 성공이다.** 같은 화면의 **실패**
  문장 일곱 자리는 맨 `<Text>`였다. **성공하면 소리로 말해 주고 실패하면 침묵하는 화면**이었고, 그
  화면의 계약 파일은 그 상황을 *"낭독 계약"* 이라고 부르며 초록이었다(U-2).
- ⚠️⚠️ **단위가 대장이 아니라 방아쇠였다는 증거는 조회 대장 안에 있었다.** 파기 미리보기 셋
  (아이·가구·계정)은 `useLoadErrorCopy`를 쓰지만 방아쇠는 **`useMutation`의 `.mutate()`** 이고,
  대장 자신이 그 사실을 이미 적고 있었다 — *"그 자리의 재시도 수단은 바로 위 [확인] 버튼이고 실패해도
  계속 눌린다."* **저장/조회는 문구의 단일 소스를 가르는 축이지 포커스가 어디 남는가를 가르는 축이
  아니었다.**
- **오늘의 값.** 계약의 모집단이 **손 목록에서 방아쇠 파생 전수**로 바뀌었다 — `app/**` 라우트 전수를
  걷고 각 실패 문장의 방아쇠를 판정해 **뮤테이션 20 / 쿼리 19**로 가르며, 뮤테이션 스무 자리는 출구 셋
  (`announce`·`live-region`·`toast`) 중 하나를 가져야 한다. 오늘의 분포는 **announce 19 + toast 1**이고
  **`live-region`만인 자리 0건**(= iOS에서 조용한 자리 0건) · **`silent` 0건**이 부정 단언이다.
  ⚠️ **제외도 이유가 적힌 값이다** — 쿼리 열아홉은 *"화면 영역이 통째로 바뀐다 — A-20 #85 선행"*,
  축하 배너 하나는 *"실패가 아니다"*. **이유는 빈 문자열일 수 없다.**
- ⚠️ **화면별 자리 수가 값으로 서 있다** — 하나가 늘거나 줄면 빨개진다. 손 목록으로 돌아가지 않는 것이
  이 계약의 값이고, 그래서 **새 화면이 뮤테이션 실패 문장을 그리는 날 그 화면도 자동으로 이 질문을
  받는다.**
- **일반형.** **어떤 그물을 새 축에 재사용할 때는 그 그물의 모집단이 새 질문의 단위인지 먼저 묻는다.**
  ⚠️ 이 판정은 도구 층에도 같은 모양으로 한 번 더 나타났다(T-5 갱신 — `.test.ts`라는 **이름** 대신
  *소스를 문자열로 읽어 자르는 파일*이라는 **하는 일**).

### U-2. **이름이 낭독인 계약이 아홉 라운드 동안 가시성만 물었다** — 제목과 본문이 갈리면 그 계약은 갈린 만큼 조용하다

- **사실.** `src/a11y-contract.test.ts`의 describe 제목은 *"되돌릴 수 없는 흐름의 실패 문구 **낭독**
  계약 (SET-004)"* 이고 머리말은 *"이 문장이 뜨는 순간은 사용자가 결과를 가장 알고 싶은 순간이다
  ('내 계정이 지워졌나?')"* 라고 적는데, 실제로 묻던 셋은 ⓐ 각자 다른 문장인가 · ⓑ **보이는 Text로
  서는가** · ⓒ 화면이 문장을 다시 짓지 않는가였다. **가시성을 낭독이라고 부른 자리**이고, 라운드 71 B가
  세운 뒤 **아홉 라운드 동안 초록**이었다.
- ⚠️ **라운드 79가 T-1에서 이름 붙인 병(*정확도만 세고 도달은 세지 않았다*)의 가장 오래된 사례가
  계약 파일 자신이었다.** 그 사이 다섯 라운드가 그 화면들의 문장을 더 정확하게 만들었고, 그때마다 이
  계약은 초록으로 통과했다 — **묻지 않는 것은 깨지지 않는다.**
- **오늘의 값.** 종전 셋은 **바이트 불변**으로 두고 **넷째**가 잇는다: 그 자리들이 실제로 낭독 출구를
  갖는가. ⚠️ **종전 셋을 지우지 않은 것이 판단이다** — 그 셋이 지키는 것(문장의 유일성 · 가시성 ·
  화면이 문장을 다시 짓지 않음)은 여전히 참이어야 하고, 이 라운드가 발견한 것은 **그 셋이 틀렸다**가
  아니라 **제목이 넷째를 약속하고 있었다**이다.
- **일반형.** **계약의 제목이 묻는 것과 본문이 묻는 것이 갈리면, 그 계약은 갈린 만큼 조용하다.**
  ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소의 계약 파일 제목 중 *본문이 그 제목만큼 묻지
  않는 것*이 몇인가(오늘 이 한 자리는 실측으로 나왔고, 세는 것은 아직 없다).

### U-3. **형제 둘의 게이트는 지연이 아니라 정지였다** — 그리고 좁히는 축은 상태가 아니라 범위였다

- **사실.** `record_gap`·`monthly_wrapup`은 `hasPendingRecordsForChild`(`syncState !== "synced"` **전부** ·
  달 무관)가 참이면 `null`을 돌려줬다. `failed`·`conflict`는 **큐가 스스로 다시 보내지 않는 종점**이고
  사용자가 재시도하거나 폐기할 때까지 남는다(라운드 57~59가 영구 실패 행을 정식 상태로 만들었으므로
  가정이 아니라 실재하는 상태다). ⚠️ **게이트가 참인 동안에는 dedupe 키를 태우지 않으므로 문제는
  dedupe가 아니라 평가 자체가 영원히 `null`을 낸다는 것이다** — 4xx로 거절된 한 행이 남은 기기에서 그
  둘은 **영영** 발화하지 않았다. **핵심 루프의 재진입 유도 둘이 조용히 죽고, 아무 단언도 깨지지 않으며,
  사용자는 알림을 껐다고 생각한다.**
- ⚠️⚠️ **답은 "상태를 좁힌다"가 아니었다.** 예산은 dedupe가 달 단위라 회복 가능 상태로 좁히는 것이
  옳았지만(T-2), 형제 둘에는 **각자의 알림이 실제로 단언하는 것**이 답을 정해 준다:
  `record_gap`은 *"마지막 기록 이후 N일"* 이라 **`lastRecordedOn`보다 뒤인 행**만, `monthly_wrapup`은
  *"지난달 총액"* 이라 **지난달 행**만 그 판정을 바꾼다. **3월에 실패한 행은 8월의 공백 판정을 바꿀 수
  없다.** ⚠️ **두 값 다 이미 각자의 입력 안에 있었다** — 새 인자도 새 요청도 0건이다.
- **오늘의 값.** 술어 하나가 **범위 인자**(`PendingRecordScope` — 시점 / 달)를 받고, 범위를 주지 않으면
  **종전과 정확히 같다**. **상태 집합은 형제 둘에서 종전 그대로(종점 포함)** 이고, 범위 안에 드는 대기
  행에는 **여전히 침묵한다** — *"서버가 모르는 기록을 두고 단언하지 않는다"* 는 규율은 한 글자도
  약해지지 않았고 **오히려 그 규율이 원래 뜻하던 것에 정확해졌다.** 계약이 세 게이트의 단위를 **한 표로
  나란히** 돌린다(record_gap=시점 · monthly_wrapup=지난달 · budget=이번 달 × 회복 가능).
- ⚠️ **그리고 예산 게이트의 달이 알림의 달과 갈리는 창이 닫혔다**(T-2 후보 ⓑ). 게이트가 보던 달은 기기
  서울 달력이었고 그 게이트가 막는 알림이 태우는 키의 달은 **`/home` 응답의 달**이라, 자정·월초 경계나
  **지난달 캐시로 그리는 콜드 스타트**에서 게이트가 8월 대기 행을 보고 **7월 알림을 막거나** 그 반대를
  할 수 있었다. 게이트의 달을 **그 알림이 키를 태우는 달**로 맞췄다(표현식 하나). ⚠️ **배너·진행바는
  기기 달력을 계속 본다 — 라이브 표면이라 단위가 다르고, 그 사실이 그 자리에 값으로 적혀 있다.**
- **일반형.** **게이트의 범위는 그 게이트가 막는 것이 무엇을 단언하는지에서 나온다.** 같은 스냅샷을 세
  표면이 함께 볼 때 갈라지는 것은 규칙이 아니라 **입력**이고(T-2), 그 입력을 정하는 것은 상태가 아니라
  **그 알림이 무엇을 말하는가**다.

### U-4. **응답을 기다리는 것과 화면을 기다리는 것은 다르다** — 한 헬퍼가 두 자리에서 다른 가정을 지고 있었다

- **사실.** `scripts/qa/admin-e2e.mjs`의 9·10단은 필터를 적용한 뒤 `page.waitForResponse(...)`로 기다리고
  **곧바로** heading의 `innerText`를 읽었다. ⚠️ **`waitForResponse`가 보장하는 것은 HTTP 응답의 도착이지
  React 커밋과 heading 재렌더가 아니다** — 응답이 막 도착한 프레임에서는 **직전(무필터) 총계를 그대로
  읽고**, 그때 `filteredTotal === total`이 되어 *"strict narrowing"* 단언이 깨진다. 관찰된 플레이크
  문자열(`4189=4189 non-narrowing`, 재실행 2회 그린)이 **정확히 그 모양이다.**
- ⚠️ **같은 창이 한 번 더 있었다**: 필터 총계를 읽은 시점과 CSV를 내보낸 시점 사이에 감사 로그가 한
  줄이라도 쌓이면(그 e2e 자신이 `admin.login`을 만든다) 행 수 비교가 어긋난다. 그리고 **9단에도 같은
  모양이 있었는데 거기서는 비교 방향이 stale 값을 통과시켜 조용했다** — **한 헬퍼가 두 자리에서 서로
  다른 가정을 지고 있었다.**
- ⚠️⚠️ **그 순간 판단해야 하는 것은 "제품 결함인가 도구 결함인가"인데, 오늘 그 답이 스크립트 안에
  없었다.** 실패 메시지가 `4189=4189`뿐이라 필터가 안 먹은 것인지 화면이 아직 안 그려진 것인지 구분되지
  않았고, **72시간 계획의 게이트가 그 자리에서 멈춘다.**
- **오늘의 값.** 총계를 읽는 자리가 **조건이 참이 될 때까지 다시 읽는 술어 대기**(`waitForAuditTotal`)로
  바뀌었다 — 필터 적용 뒤에는 *"총계가 바뀌었다"*, 초기화 뒤에는 *"총계가 그 이상으로 돌아왔다"* 를
  기다리고, 9단의 같은 자리도 같은 규율을 지난다. 내보내기 행 수는 **내보내기 직후에 다시 읽은 총계**와
  비교한다. ⚠️ **실패 메시지가 두 원인을 갈라 말한다**(ⓐ 제품 — 필터가 안 먹었다 / ⓑ 도구 — heading이
  아직 갱신되지 않았을 수 있다) — **다음 사람이 재실행 대신 판단을 한다.** **단언 0건 완화 · 검증 항목
  0건 삭제 · 스텝 수 18 불변 · 제품 소스 0건**이고, 18/18 ×3 + 실패 경로 실측 2회로 확인했다.
- **일반형.** **비동기 화면을 미는 도구에서 "기다린다"는 무엇을 기다리는지까지가 계약이다.** 응답을
  기다리는 것은 서버의 사실이고, 단언이 읽는 것은 **렌더된 화면의 사실**이다 — 그 둘 사이의 프레임이
  플레이크의 자리이고, ⚠️ **그 플레이크가 조용한 쪽(통과하는 방향)으로 나 있으면 아무도 모른다**(9단).

### U-5. **라우트 표면에는 80라운드 동안 그물이 없었다** — 그리고 재어 보니 같은 URL에 두 화면이 둘 있었다

- **사실.** `apps/mobile/src`의 계약 파일 서른아홉 중 **라우트 파일을 열거하는 것은 0건**이었다
  (`readdirSync`를 쓰는 열넷은 문구·토큰·env·슬라이스를 센다). **DNC-003(하단 탭 넷)을 지키는 단언은
  간접 셋뿐**이었고 — `Tabs.Screen` 문자열의 존재만 본다 — **탭이 다섯 번째로 늘어도 빨개지는 자리가
  없었다.** 문구·토큰·env·역할·슬라이스·여정에는 전수 스윕이 있는데 **표면에는 없었다.**
- ⚠️⚠️ **재어 보니 같은 URL에 두 화면이 있는 자리가 둘이다**(정찰은 하나로 적었고 **실측이 둘로
  정정했다**). expo-router에서 `(...)`는 URL에 나타나지 않는 그룹이라, `app/(onboarding)/budget.tsx`가
  **`/budget`으로도** 등록되고 그 URL에는 예산 수정 화면(`app/budget.tsx`)이 이미 있다. 같은 이유로
  홈 탭(`app/(tabs)/index.tsx`)이 **`/`로도** 등록되고 그 URL에는 진입 라우팅 화면(`app/index.tsx`)이
  있다.
- ⚠️ **`/budget`은 한가한 라우트가 아니다** — 더보기 메뉴 · 설정 화면 · 홈 예산 진행바 ·
  **예산 경계 알림의 착지 지점** 넷이 그 문자열을 쓴다. 이기는 쪽이 온보딩 예산 화면이면 *"예산 수정"*
  을 누른 사람이 **초기 예산 설정 화면**(기본값 500,000 · 저장 후 다음 단계)에 착지하고, 저장하면 그
  달의 예산이 덮어써진다. **오늘 그 일이 일어나지 않는다는 근거는 "여태 안 그랬다"뿐이고, 그 근거는
  그룹에 파일이 하나 늘어나는 순간 사라진다.**
- ⚠️⚠️ **계약은 어느 쪽이 이기는지 주장하지 않는다 — 그것이 이 트랙의 성패였다.** 겹침 항목의
  `landingScreen`은 **`null`로 강제**되고, 그것이 게으름이 아니라 판정이라는 사실이 소스에 적혀 있다:
  **expo-router의 충돌 해소 규칙은 소스가 답할 수 없으므로 모르는 것을 말하지 않는다.** 그 답은 확인의
  표가 진다(**#133** · 표면 `실기기`).
- **오늘의 값.** 라우트 파일 **36행 전수 열거 + URL 정규화**(그룹 세그먼트 제거) · **DNC-003 파생**
  (탭 바에 서는 `Tabs.Screen`이 정확히 넷이고 이름이 홈·기록·준비템·리포트 — 다섯째는 `href: null`이
  빼고, **그 `href: null`이 DNC-003을 지키는 바로 그 장치**라는 사실이 값으로 있다) · **겹침 둘이 이유와
  함께**(셋째가 생기는 날 빨개진다) · **참조 0건 URL 넷**(`(onboarding)` 그림자 — 다섯째가 `/budget`이라
  겹침 표로 갔다)이 이유가 적힌 제외에. ⚠️ **정찰이 참조 0건으로 적은 셋**(`pixel-lock` ·
  `launch-animation` · `(tabs)/more`)은 **실측하면 부르는 자리가 있어**, 그 문과 증거를 값으로 적는 별도
  목록이 됐다. **제품 소스 0건 · 라우트 파일 이동·삭제·생성 0건 · 화면 0건.**
- **일반형.** **아직 그물이 없는 축은 "파일이 아니라 표면"이다.** ⚠️ **다음 라운드가 먼저 세어 볼 만한
  것: DNC 계약 스무 줄 중 기계가 지키지 않는 것이 무엇인가** — 오늘 DNC-003이 그 답의 하나였고, 네
  라운드 동안 산문으로만 재어져 왔다.
