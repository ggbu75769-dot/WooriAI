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
| 실 제휴 링크 | 시드는 비제휴 dev 샘플(`https://example.com/dev/...` **86곳** — 링크 67건의 `url` 67 + 제휴 링크의 `affiliateUrl` 19, `apps/api/prisma/seed-data.ts` productLinkSeeds). **두 시점**: 라운드 82 B 이후 **62건 / 81곳** → 라운드 83 A가 비스폰서 링크 다섯을 더한 뒤 **67건 / 86곳**. ⚠️ 이 수를 **세는 자리**는 `docs/5차/day1-deploy-runbook.md` A-5의 실행되는 인용이다(`packages/test-utils/src/repo-self-description.test.ts`가 그 명령을 실제로 돌린다) — 여기 적힌 것은 그 답의 사본이다(X-4) | 제휴 계약 + 관리자 CMS(`apps/api/src/admin/product-link-bulk.controller.ts` 포함)에서 실 URL 등록 |
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

- **카탈로그가 커지면 준비템 탭·홈·어드민 목록이 함께 느려진다 — 문턱 둘 (GAP-067 #9, 2026-08-29 실측)**. 준비템 조회는 **활성 준비템 전량 + 그 아이의 상태 행 전량**을 읽어 JS로 랭킹하고(`apps/api/src/onboarding/items-catalog.service.ts`의 `itemsForChild`), 어드민 목록은 `where`도 `take`도 없이 **모든 준비템 + 모든 링크**를 한 응답에 싣는다(`adminListItemTemplates`). 실측(`docs/qa/load-smoke-results.md` "볼륨 축 ② 카탈로그" 절): 준비템 62 → 1,062 → 3,062에서 `items?tab=now` p50 27.9 → 138.0 → 365.0ms(≈+0.11ms/준비템), 어드민 목록 p50 29.9 → 524.5 → 1,378.5ms · 응답 본문 64.7KB → **2.26MB** → 6.50MB(≈+2.2KB/준비템). 상세(`items/:itemTemplateId`)는 같은 구간에서 19.8 → 19.5ms로 **불변**이다(링크 조회가 `idx_product_links_item_platform`을 탄다). **재검토 문턱**: 앱 축은 **활성 준비템 500건**(그 지점 p50 ≈ 80ms 추정 — 넘으면 다시 재고, 첫 후보는 단계 필터를 DB로 내리는 것), 어드민 축은 **응답 본문 1MB(≈준비템 500 · 링크 1,500)** — 그때 페이지네이션·필터가 필요하다. 지금 운영 카탈로그는 준비템 62 · 링크 **67**이라 두 문턱 모두 한참 아래다(두 시점: 라운드 76까지 링크 58 → 라운드 82 B 이후 62 → 라운드 83 A 이후 67 · 준비템 62는 그동안 불변이고, 두 문턱을 정하는 것은 **준비템** 수다). 이번 라운드는 **재기만 했다**(서버 최적화 0건 — 재기 전에 고치면 무엇을 고쳤는지 증명할 수 없다).

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

### L-2. 오프라인 인지 조회 문구는 **일곱 화면**에서 멈춰 있다 — 남은 다섯은 다음 라운드 한 트랙 (→ **2026-08-29 라운드 72 트랙 B에서 열로**, 이어 **라운드 73 트랙 E에서 열하나 · P3 0으로 종결**, 그리고 **라운드 74 트랙 D에서 열넷 — 그 "종결" 뒤에 남아 있던 화면 셋 · 자리 일곱**, 이어 **라운드 86 트랙 B에서 열다섯 · 조회 제외 0**, 아래 네 갱신 블록)

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

#### L-2 갱신 (2026-08-31 · 라운드 86 트랙 B / GAP-086 #2 · 리뷰 L-12) — **열넷·제외 하나 → 열다섯·제외 0**

- ⚠️ **이 절의 수는 라운드 74에서 멈춰 있었다**(위 블록의 *"배선 열넷 · 조회 제외 하나(값)"*).
  라운드 86 트랙 B가 마지막 제외였던 `app/(onboarding)/prepared-items.tsx`를 배선하면서 오늘의
  값은 **배선 열다섯 · 조회 제외 0 · 카드가 아닌 자리 일곱**이다(저장 쪽은 종전 그대로 배선 넷 ·
  제외 0). 수를 옮겨 적지 않고 세는 자리는 `apps/mobile/src/offline/messages.test.ts` 하나이고,
  이 줄은 **그 계약이 오늘 세는 값이 무엇인지**만 가리킨다.
- ⚠️ **제외 0은 "목록을 없앴다"가 아니다.** 빈 목록은 값으로 남는다(저장 쪽 빈 목록과 같은 이유) —
  다음에 조회 실패 문장을 손으로 적는 화면이 생기는 날, 만든 사람이 **배선하거나 이유를 적거나**
  둘 중 하나를 값으로 고르게 하는 자리다.
- ⚠️ **옮겨 간 제외의 사유 셋 중 둘이 거짓이었다**(AA-3의 그 판정) — 특히 ③ *"공용 문장이 가리키는
  [다시 시도] 버튼이 이 자리에 없다"* 는 버튼이 **이미 있었다**는 점에서 거짓이었지만, ⚠️ **리뷰
  L-10이 그 참값의 단위를 좁혔다: 버튼이 실재하는 단위는 *자리*가 아니라 *화면*이다**(문장은 Card
  안, 버튼은 화면 맨 아래 — 사이에 요소 넷).

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
  ⚠️ **정정 (2026-08-30 · 라운드 83 리뷰 L-6) — 위 두 문단의 `active: true` **120**은 라운드 78 시점의
  값이고 오늘은 **129**다**(두 시점: 준비템 62 + 링크 58 = 120 → 준비템 **62 불변** + 링크 **67** = 129 —
  라운드 82 B가 넷, 라운드 83 A가 다섯을 더했다). ⚠️ **그래도 이 절의 판정과 트리거는 바이트 불변이다**:
  트리거 둘이 재는 것은 **준비템 카탈로그**(오늘도 62)와 **한 밴드의 표시 행**이지 링크 수가 아니다.
  수를 세는 자리도 이제 둘 다 있다 — 준비템은 라운드 83 C의 어드민 카드(X-5), 링크는
  `docs/5차/day1-deploy-runbook.md` A-5의 실행되는 인용이다.
- ⚠️⚠️ **정정 (2026-08-30 · 라운드 81) — 위 N+1 census가 두 자리를 세지 않았다.** 오늘 `for` 루프 안의
  `await`를 다시 전수로 걸면 **모양은 열다섯**이고 **항목 수에 비례하는 자리는 셋**이다: 위에 적힌
  `setPreparedItems`(카탈로그 **62** — 오늘도 문턱 아래) 외에 **엑셀 가져오기의 미리보기 생성
  (`importRow.create` — 문장 수 **N + 3**)과 확정(`insertExpense` 안의 `category.findUnique` 포함 —
  **2N + 2**)이 빠져 있었고, 그 둘의 상한은 62가 아니라 `importMaxRows` = 2,000**이다(32배 · 계약이
  약속한 지원 범위의 끝값이다). ⚠️ 둘 다 **옵션 없는 `$transaction`**(Prisma 기본 5초) 안이었다.
  라운드 81 트랙 E가 그 둘을 **배치 문장**(`createMany` 둘 + 분류 확인 호이스팅)으로 바꾸고 두
  `$transaction`에 명시적 상한(**timeout 30초 · maxWait 10초**)을 주어, **400행 기준 미리보기
  411 → 12문장 · 확정 811 → 13문장**이 됐다(`apps/api/test/import-excel.e2e.test.ts`가 Prisma query
  이벤트로 실측한다 — 이 저장소 최초의 왕복 계약 · 판정 **V-4**). **그래서 오늘 항목 수에 비례하는
  자리는 `setPreparedItems` 하나이고, 여전히 문턱 아래다.** ⚠️ **이 정정은 이 절의 N+1 문단 하나에만
  해당한다** — 준비템 탭 비가상화의 기각과 트리거 둘, 번들·테스트 인프라 수치는 **바이트 불변**이다.
  ⚠️ **일반형은 V-3에 적었다: "전수 확인"이라고 적힌 산문은 그 스윕이 코드로 남았을 때만 참으로
  유지된다**(이 census는 산문이었고, 그래서 여섯 라운드 동안 조용히 낡았다).
- ⚠️⚠️ **갱신 (2026-08-30 · 라운드 83) — 이 절이 적어 둔 재개 트리거 두 수에 대한 오늘의 답:
  둘 다 다시 쟀고 둘 다 발동하지 않았다(여섯 라운드 연속 미발동). 달라진 것은 앞의 하나에 *세는
  자리*가 생겼다는 것이다.** 종전까지 두 수는 **사람이 DB를 손으로 세어야 알 수 있는 값**이었고
  (W-3이 그것을 *"남은 공백"* 으로 적었다), 그래서 도래해도 아무것도 빨개지지 않았다. 라운드 83
  트랙 C가 어드민 요약에 활성 준비템 카운트 한 칸(`count` 한 방)과 대시보드 카드 하나를 세웠고,
  그 카드의 캡션은 **새 문턱을 발명하지 않고 이 절의 재개 트리거를 인용한다**(순수 모듈의 계약이
  이 문서를 읽어 두 수가 같은지 대조하므로, 이 절의 그 수가 바뀌면 **그 계약이 먼저 빨개진다**).
  ⚠️ **뒤의 하나(한 밴드의 표시 행)는 오늘 세지 않았다 — 기각을 값으로 남긴다**: `ItemTemplateStage`에
  `ItemTemplate` 관계 필드가 없어 카운트 한 방으로 셀 수 없고, 우회는 **비례 조회**이거나 **원시
  SQL**이라 그 서비스의 규율 밖이다. **재개 조건: 그 관계 필드가 생기는 날**(마이그레이션 0건
  원칙상 별도 결정) **또는 활성 카탈로그 카운트가 위 문턱을 넘는 날.**
  ⚠️⚠️ **그러나 세는 것은 화면이지 문서가 아니므로 이 절은 오늘의 두 값을 옮겨 적지 않는다**(O-3 —
  적는 순간 이 절이 그 계약 밖의 사본이 된다). **트리거 두 수와 준비템 탭 비가상화의 기각, 번들·
  테스트 인프라 수치는 이번에도 바이트 불변이다.** 판정은 **X-5**.
- ⚠️ **갱신 (2026-08-30 · 라운드 84) — 두 수를 다시 쟀고 둘 다 발동하지 않았다(일곱 라운드 연속
  미발동). 준비템 탭 비가상화는 이번에도 제안하지 않는다.** ⚠️ **세는 것은 화면이므로 이 절은 오늘의
  두 값을 옮겨 적지 않는다**(O-3 — 앞의 하나는 라운드 83 C가 세운 어드민 카드가 세고, 그 카드의
  캡션이 인용하는 문턱이 **이 절의 그 수**라 이 절이 바뀌면 순수 모듈의 계약이 먼저 빨개진다).
  ⚠️ **뒤의 하나(한 밴드의 표시 행)는 이번에도 세는 자리가 없고, 그 기각의 재개 조건은 X절 머리말에
  값으로 있다**(관계 필드 부재 — 라운드 84도 `prisma/`를 열지 않았다). **트리거 두 수와 준비템 탭
  비가상화의 기각, 번들·테스트 인프라 수치는 이번에도 바이트 불변이다.**
- ⚠️ **갱신 (2026-08-30 · 라운드 85) — 두 수를 다시 쟀고 둘 다 발동하지 않았다(여덟 라운드 연속
  미발동). 준비템 탭 비가상화는 이번에도 제안하지 않는다.** ⚠️ **세는 것은 화면이므로 이 절은 오늘의
  두 값을 옮겨 적지 않는다**(O-3 — 앞의 하나는 라운드 83 C가 세운 어드민 카드가 세고, 그 카드의 캡션이
  인용하는 문턱이 **이 절의 그 수**다). ⚠️ **다만 이번 라운드는 그 문턱이 다른 자리에서 한 번 더
  쓰였다** — 준비템 탭의 파생이 렌더 본문에 있는 것(렌더 비용)을 기각하면서 **그 기각의 재개 조건으로
  이 절의 앞 문턱을 인용했다**(Z-5 · Z절 머리말의 기각 여덟). **트리거 두 수와 준비템 탭 비가상화의
  기각, 번들·테스트 인프라 수치는 이번에도 바이트 불변이다.**
- ⚠️ **갱신 (2026-08-31 · 라운드 86) — 두 수를 다시 쟀고 둘 다 발동하지 않았다(아홉 라운드 연속
  미발동). 준비템 탭 비가상화는 이번에도 제안하지 않는다.** ⚠️ **세는 것은 화면이므로 이 절은 오늘의
  두 값을 옮겨 적지 않는다**(O-3 — 앞의 하나는 라운드 83 C가 세운 어드민 카드가 세고, 그 카드의 캡션이
  인용하는 문턱이 **이 절의 그 수**다). ⚠️ **이번 라운드는 트랙 A가 그 화면(`app/(tabs)/items.tsx`)을
  *쓰기로* 열었는데도 이 판단이 뒤집히지 않았다** — A가 더한 것은 타일 아래 슬롯의 배지 한 줄이고
  **파생·메모 구조는 한 글자도 바꾸지 않았다**(렌더 비용 기각의 근거였던 *"디바운스 뒤에야 부모 상태가
  바뀐다"* 도 그대로다 · Z-5 ⓑ). **트리거 두 수와 준비템 탭 비가상화의 기각, 번들·테스트 인프라
  수치는 이번에도 바이트 불변이다.**
- ⚠️ **갱신 (2026-08-31 · 라운드 87) — 두 수를 다시 쟀고 둘 다 발동하지 않았다(열 라운드 연속
  미발동). 준비템 탭 비가상화는 이번에도 제안하지 않는다.** ⚠️ **세는 것은 화면이므로 이 절은 오늘의
  두 값을 옮겨 적지 않는다**(O-3 — 앞의 하나는 라운드 83 C가 세운 어드민 카드가 세고, 그 카드의 캡션이
  인용하는 문턱이 **이 절의 그 수**라 이 절이 바뀌면 순수 모듈의 계약이 먼저 빨개진다).
  ⚠️ **이번 라운드는 어느 트랙도 `app/(tabs)/items.tsx`를 열지 않았다** — 다섯 트랙이 연 화면은
  온보딩 하나 · 설정 하나 · 어드민 하나이고, 준비템 탭의 파생·메모 구조는 **읽기조차 하지 않았다**.
  ⚠️ **열 라운드 연속 미발동이라는 사실 자체가 이 절의 오늘 값이다** — 그리고 그 열 라운드 동안
  **문턱을 세는 자리는 그대로 하나**다(라운드 83 C의 카드 · 뒤의 하나는 여전히 세는 자리가 없고 그
  기각의 재개 조건은 X절 머리말에 있다). **트리거 두 수와 준비템 탭 비가상화의 기각, 번들·테스트
  인프라 수치는 이번에도 바이트 불변이다.**
- ⚠️ **갱신 (2026-08-31 · 라운드 88) — 두 수를 다시 쟀고 둘 다 발동하지 않았다(**11라운드 연속
  미발동**). 준비템 탭 비가상화는 이번에도 제안하지 않는다.** ⚠️ **세는 것은 화면이므로 이 절은 오늘의
  두 값을 옮겨 적지 않는다**(O-3 — 앞의 하나는 라운드 83 C가 세운 어드민 카드가 세고, 그 카드의 캡션이
  인용하는 문턱이 **이 절의 그 수**라 이 절이 바뀌면 순수 모듈의 계약이 먼저 빨개진다).
  ⚠️ **이번 라운드도 어느 트랙도 `app/(tabs)/items.tsx`를 열지 않았다** — 다섯 트랙이 연 화면은
  설정 하나(알림)와 어드민 하나(클릭 통계)뿐이고, 나머지 셋은 계약 파일과 주석만 연다.
  ⚠️ **새 런타임 의존성도 0건이라 번들 수치의 전제도 그대로다.** **트리거 두 수와 준비템 탭 비가상화의
  기각, 번들·테스트 인프라 수치는 이번에도 바이트 불변이다.**

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

- **조회 실패의 낭독(스캐너가 쿼리로 분류한 자리 — 재실측 **열하나**) — 보류 유지, 다만 범위가 좁아졌다.**
  ⚠️ **종전 이 줄은 "열아홉"이라고 적었는데 그 값은 스캐너의 답이지 소스의 답이 아니었다**(U-1의 재실측 문단).
  T-1이 기기로 넘긴 질문의
  절반은 소스가 이미 답하고 있었고(뮤테이션 셋), 이번에 닫혔다. 남은 것은 **순수 쿼리 자리**이고 이유는
  T-1의 문장 그대로다 — *"화면 영역이 통째로 바뀌어 사용자가 다시 훑는다."* **A-20 #85가 선행**이다.
  ⚠️ **갱신 (2026-08-30 · 라운드 81) — 재실측 값도 사유도 그대로다.**
  `a11y-contract.test.ts`의 `QUERY_TRIGGER_SITES_BY_SCREEN`을 다시 더하면 `accept/[token]` 2 +
  `family/index` 4 + `import/[importJobId]` 2 + `settings/children` 1 + `settings/notifications` 1 +
  `settings/privacy` 1 = **열하나**로 위 값과 같다. **상태 변화 0 · 보류 유지**이고, 이번 라운드의 어느
  트랙도 그 자리들을 열지 않았다.
  ⚠️ **갱신 (2026-08-30 · 라운드 82) — 재실측 **열하나**, 상태 변화 0.** `QUERY_TRIGGER_SITES_BY_SCREEN`의
  여섯 화면이 오늘도 같은 수(2+4+2+1+1+1)를 들고 있고 사유도 T-1의 문장 그대로다. 라운드 82의 트랙 넷은
  `app/(tabs)/reports.tsx`·`app/(tabs)/more.tsx`·`apps/api/**`만 열었고 그 여섯 화면은 **무접촉**이다.
  **A-20 #85 선행 · 보류 유지.**
  ⚠️ **갱신 (2026-08-30 · 라운드 83) — 재실측 **열하나**, 상태 변화 0.** `QUERY_TRIGGER_SITES_BY_SCREEN`의
  여섯 화면이 오늘도 같은 수(2+4+2+1+1+1)를 들고 있고 사유도 T-1의 문장 그대로다. 라운드 83이 연 화면은
  `app/(tabs)/records.tsx`·`app/(onboarding)/child-profile.tsx`·`app/_layout.tsx`·`apps/admin/app/page.tsx`
  이고 그 여섯 화면은 **무접촉**이다. **A-20 #85 선행 · 보류 유지.**
  ⚠️ **갱신 (2026-08-30 · 라운드 84) — 재실측 **열하나**, 상태 변화 0.** `QUERY_TRIGGER_SITES_BY_SCREEN`의
  여섯 화면이 오늘도 같은 수(2+4+2+1+1+1)를 들고 있고 사유도 T-1의 문장 그대로다. ⚠️ **라운드 84는
  모바일 화면을 한 곳도 열지 않았다** — 트랙 넷이 연 것은 `apps/admin`(A) · `packages/test-utils`(B) ·
  `apps/mobile/src/api`(C) · `apps/mobile/src/query`(D)이고 `app/**`는 **전부 읽기만**이다.
  **A-20 #85 선행 · 보류 유지.**
  ⚠️ **갱신 (2026-08-30 · 라운드 85) — 재실측 **열하나**, 상태 변화 0.** `QUERY_TRIGGER_SITES_BY_SCREEN`의
  여섯 화면이 오늘도 같은 수(2+4+2+1+1+1)를 들고 있고 사유도 T-1의 문장 그대로다. ⚠️ **이번 라운드는
  트랙 A·B·C가 `app/**`를 쓰기로 열었지만 그 여섯 화면은 무접촉이다** — 열린 것은
  `app/expenses/new.tsx`(호출 인자 두 줄) · `app/expenses/[expenseId].tsx`(호출 인자 두 줄) ·
  `app/(tabs)/reports.tsx`(조립 세 줄과 프롭 한 칸)이고, 셋 다 **실패 문장·방아쇠와 접점이 0건**이다.
  **A-20 #85 선행 · 보류 유지.**
  ⚠️⚠️ **갱신 (2026-08-31 · 라운드 86) — 재실측 **열하나**, 상태 변화 0. 다만 이번 라운드는 접점이
  둘이다.** ⓐ **트랙 B가 `a11y-contract.test.ts`를 *쓰기로* 열었지만 그 표는 바이트 불변이다** — B가
  더한 것은 ONB-003 조회 실패 탈출구의 낭독 블록 하나이고, ONB-003은 이 여섯에 들어 있지 않다(모집단이
  늘지도 줄지도 않았다). ⓑ ⚠️ **트랙 C가 이 여섯 중 하나인 `app/family/index.tsx`를 *쓰기로* 열었다** —
  그 화면의 쿼리 방아쇠 자리는 오늘도 **넷**이고, C가 더한 것은 대기 초대 행의 한 줄과 확인창 제목·
  낭독 라벨이라 **새 조회도 새 실패 문장도 0건**이다(`QUERY_TRIGGER_SITES_BY_SCREEN`의 여섯 화면이
  오늘도 같은 수 2+4+2+1+1+1을 들고 있다). 사유도 T-1의 문장 그대로다 — *"화면 영역이 통째로 바뀌어
  사용자가 다시 훑는다."* **A-20 #85 선행 · 보류 유지.**
  ⚠️⚠️ **갱신 (2026-08-31 · 라운드 87) — 재실측 **열하나**, 상태 변화 0. 접점은 이번에도 둘인데
  방향이 라운드 86과 다르다.** ⓐ ⚠️ **트랙 D가 이 여섯 중 하나인 `app/settings/notifications.tsx`를
  *쓰기로* 열었다** — 그 화면의 쿼리 방아쇠 자리는 오늘도 **하나**이고, D가 더한 것은 기기 행 제목과
  스위치 낭독 라벨 두 줄이라 **새 조회도 새 실패 문장도 0건**이다(`QUERY_TRIGGER_SITES_BY_SCREEN`이
  오늘도 2+4+2+1+1+1을 들고 있다). ⓑ **트랙 C가 `a11y-contract.test.ts`를 *쓰기로* 열었지만 그 표는
  바이트 불변이다** — C가 세운 것은 **모듈 층(`src`) 낭독 스윕**이라는 *새 뿌리*이고, 그 뿌리는 이
  대장이 세는 `app/**`와 겹치지 않는다(그 사실이 새 스윕의 *걷지 않는 뿌리* 칸에 이유와 함께
  값으로 적혀 있다 — 겹치면 같은 자리가 두 모집단에서 다른 답을 낼 수 있고, **그 두 값이 바로 이
  이월이 붙들고 있는 바이트**다). ⚠️ **두 라운드 연속으로 이 파일이 열렸는데 이 표가 한 번도 움직이지
  않았다는 사실을 적어 둔다** — 다음 라운드가 *"그 파일을 또 열었으니 이 수도 움직였겠지"* 로 읽지
  않도록. 사유도 T-1의 문장 그대로다. **A-20 #85 선행 · 보류 유지.**
  ⚠️ **갱신 (2026-08-31 · 라운드 88) — 재실측 **열하나**, 상태 변화 0. 접점은 오늘도 둘이고 둘 다
  표를 움직이지 않았다.** ⓐ **트랙 B가 이 여섯 중 하나인 `app/settings/notifications.tsx`를 *쓰기로*
  열었지만 바꾼 것은 등록 인자 한 줄과 import 한 줄이다** — 그 화면의 쿼리 방아쇠 자리는 오늘도
  **하나**이고 **새 조회도 새 실패 문장도 0건**이다(`QUERY_TRIGGER_SITES_BY_SCREEN`이 오늘도
  2+4+2+1+1+1을 들고 있다). ⓑ **트랙 E가 `a11y-contract.test.ts`를 *쓰기로* 열었지만 그 표는 바이트
  불변이다** — E가 더한 것은 **프롭 대장 둘의 판정 칸**이고, 그 판정은 낭독 *출구*를 세지 조회
  *방아쇠*를 세지 않는다(⚠️ **한 파일 안에 두 대장이 사는데 모집단이 서로 다르다는 사실이 이 이월이
  붙들고 있는 바이트의 이유다**). ⚠️ **세 라운드 연속으로 이 파일이 열렸는데 이 표는 한 번도 움직이지
  않았다.** 사유도 T-1의 문장 그대로다. **A-20 #85 선행 · 보류 유지.**
- **S-3(어드민 `disabled`가 앗아가는 것) — 보류 유지, 재평가만.** 2026-08-30 재실측: 자리는 여전히
  **열하나**이고 라운드 79가 정정한 전제(`<select>`는 활성 상태에서도 드래그 복사가 되지 않는다 →
  `disabled`가 앗아가는 것은 **복사가 아니라 도달**)도 그대로다. **브라우저 확인(#130)이 선행**이고,
  이번 라운드의 어느 트랙도 그 둘을 열지 않았다.
  ⚠️ **갱신 (2026-08-30 · 라운드 81) — 재실측, 상태 변화 0.** `disabled={readOnly}`는 오늘도
  `app/items/page.tsx` **6** · `app/links/page.tsx` **5** = **열하나**이고, 라운드 81의 어느 트랙도
  `apps/admin/**`를 열지 않았다. **브라우저 확인(#130) 선행 · 보류 유지.**
  ⚠️ **갱신 (2026-08-30 · 라운드 82) — 재실측 **열하나**(items 6 · links 5), 상태 변화 0.** 라운드 79가
  정정한 전제(`disabled`가 앗아가는 것은 복사가 아니라 **도달**)도 그대로이고, 라운드 82의 어느 트랙도
  `apps/admin/**`를 열지 않았다. **브라우저 확인(#130) 선행 · 보류 유지.**
  ⚠️ **갱신 (2026-08-30 · 라운드 83) — 재실측 **열하나**(items 6 · links 5), 상태 변화 0.**
  ⚠️ **이번 라운드는 트랙 C가 `apps/admin/**`를 열었지만 접점이 0건이다** — C가 연 것은 `app/page.tsx`
  (대시보드 카드 하나)와 `src/lib/`이고, `disabled={readOnly}` 열한 자리는 `app/items/page.tsx`·
  `app/links/page.tsx`에 그대로 있다. **브라우저 확인(#130) 선행 · 보류 유지.**
  ⚠️⚠️ **갱신 (2026-08-30 · 라운드 84) — 재실측 **열하나**(items 6 · links 5), 상태 변화 0. 다만 이번
  라운드는 종전 열 라운드와 접점이 다르다: 트랙 A가 `app/items/page.tsx`를 *쓰기로* 열었다.**
  그 트랙이 그 파일에 더한 것은 **체크박스 한 줄 · 힌트 한 줄 · 필터 상태 한 칸**이고,
  ⚠️ **`disabled={readOnly}` 여섯 자리는 그 트랙의 금지 조항대로 바이트 불변이다**(머지된 소스에서
  확인 · 역할 게이트와 쓰기 동선도 0건 변경). `app/links/page.tsx`는 **무접촉**이다.
  ⚠️ **파일이 겹쳤는데 자리가 겹치지 않았다는 사실을 여기 적어 둔다** — 다음 라운드가 *"그때 그 파일을
  열었으니 이 자리도 움직였겠지"* 로 읽지 않도록. **브라우저 확인(#130) 선행 · 보류 유지.**
  ⚠️⚠️ **갱신 (2026-08-30 · 라운드 85) — 재실측 **열하나**(items 6 · links 5), 상태 변화 0. 그리고 같은
  접점이 두 라운드 연속이다: 이번에는 트랙 D가 `app/items/page.tsx`를 *쓰기로* 열었다.** 그 트랙이 그
  파일에 더한 것은 **분류 열 한 칸 · 체크박스 한 줄 · 필터 상태 한 칸**이고, ⚠️ **`disabled={readOnly}`
  여섯 자리는 그 트랙의 금지 조항대로 바이트 불변이다**(머지된 소스에서 확인 · 역할 게이트와 쓰기 동선도
  0건 변경 — 새 필터는 `viewOnly`로 등재됐다). `app/links/page.tsx`는 **무접촉**이다.
  ⚠️ **두 라운드 연속으로 같은 파일이 열렸는데 같은 자리가 한 번도 겹치지 않았다는 사실 자체가 값이라
  여기 적는다** — 다음 라운드가 *"두 번이나 그 파일을 열었으니 이 자리도 움직였겠지"* 로 읽지 않도록.
  **브라우저 확인(#130) 선행 · 보류 유지.**
  ⚠️⚠️ **갱신 (2026-08-31 · 라운드 86) — 재실측 **열하나**(items 6 · links 5), 상태 변화 0. 그리고
  이번 라운드는 그 접점이 *사라졌다*: 어느 트랙도 `app/items/page.tsx`·`app/links/page.tsx`를 열지
  않았다.** 어드민을 여는 트랙은 D 하나이고 그 소유는 `app/analytics/page.tsx`(일별 추이 표) ·
  `app/clicks/page.tsx`(같은 모듈을 지나게만 함) · `src/lib/analytics-trend-view.ts`(신설)이라,
  `disabled={readOnly}` 열한 자리와는 **파일 단위로 접점 0건**이다. ⚠️ **두 라운드 연속 같은 파일이
  열렸다가 오늘 그 겹침이 없어졌다는 대비 자체를 여기 적어 둔다** — 라운드 84·85의 두 줄을 읽고
  *"이제 이 파일은 매 라운드 열리는 자리군"* 으로 읽으면 다음 실측을 건너뛰게 된다. **접점의 유무는
  이 자리의 상태를 바꾸지 않는다**(브라우저에서 밟아 봐야 아는 것은 그대로다).
  **브라우저 확인(#130) 선행 · 보류 유지.**
  ⚠️⚠️ **갱신 (2026-08-31 · 라운드 87) — 재실측 **열하나**(items 6 · links 5), 상태 변화 0. 그리고
  *그 열한 자리에 대한 접점*은 오늘로 **세 라운드 연속 0건**이다**(라운드 85는 트랙 D가 그 파일을
  열었지만 `disabled={readOnly}` 여섯 자리는 바이트 불변이었고, 86·87은 파일조차 열리지 않았다 —
  ⚠️ **파일 접점 0건은 두 라운드 연속, 자리 접점 0건은 세 라운드 연속이다. 둘을 한 낱말로 적으면
  다음 라운드가 다른 수를 센다**). 어드민을 여는 트랙은 A 하나이고 그 소유는
  `app/audit-logs/page.tsx` · `src/lib/audit-log-rows.ts`(신설) · `src/lib/audit-log-rows.test.ts`(신설) ·
  `src/admin-audit-logs.test.ts` · `src/lib/audit-log-filters.test.ts`라, `disabled={readOnly}` 열한
  자리가 사는 `app/items/page.tsx`·`app/links/page.tsx`와는 **파일 단위로 접점이 0건**이다
  (⚠️ 트랙 A는 `src/lib/audit-log-filters.ts`를 **읽지만 바이트 불변**이다 — 그 파일에 새 export를
  더하면 미러 스윕의 면제 둘이 먼저 빨개진다는 것이 그 트랙의 금지 조항이었다).
  ⚠️ **라운드 84·85는 그 파일이 두 라운드 연속 열렸고 86·87은 두 라운드 연속 안 열렸는데, 그 열한
  자리는 네 라운드 내내 한 바이트도 움직이지 않았다 — 열림도 안 열림도 이 자리의 상태를 바꾸지
  않는다는 사실이 네 라운드에 걸쳐 값이 됐다.** 다음 라운드가 *"요즘 안 열리는 파일"* 로 읽고
  실측을 건너뛰지 않도록 여기 적어 둔다.
  **브라우저 확인(#130) 선행 · 보류 유지.**
  ⚠️⚠️ **갱신 (2026-08-31 · 라운드 88) — 재실측 **열하나**(items 6 · links 5), 상태 변화 0. 그리고
  *그 열한 자리에 대한 접점*은 오늘로 **네 라운드 연속 0건**이다**(파일 접점 0건은 세 라운드 연속이다 —
  ⚠️ **라운드 87이 적어 둔 그 구별을 그대로 이어 센다: 두 수를 한 낱말로 적으면 다음 라운드가 다른
  수를 센다**). 어드민을 여는 트랙은 A 하나이고 그 소유는 `app/clicks/page.tsx`와
  `src/lib/analytics-trend-view.test.ts` 둘뿐이라, `disabled={readOnly}` 열한 자리가 사는
  `app/items/page.tsx`·`app/links/page.tsx`와는 **파일 단위로 접점이 0건**이다(⚠️ 트랙 C의 신설 대장이
  어드민 테스트 전수를 **읽지만** 그것은 앵커를 세는 읽기이고 화면 소스는 바이트 불변이다).
  ⚠️ **네 라운드에 걸쳐 그 파일이 두 번 열리고 두 번 안 열렸는데 그 열한 자리는 한 바이트도 움직이지
  않았다** — 오늘 더하는 값은 경과 수가 아니라 **그 대비가 다섯 라운드째 같은 답을 낸다는 사실**이다.
  **브라우저 확인(#130) 선행 · 보류 유지.**
- **`withdrawn_at` — 보류 유지, 재평가만.** 저장소 전체에서 그 이름이 나오는 자리는 **셋**이고 셋 다
  *"그 컬럼이 없다"* 를 말하는 자리다. 라운드 75 P-1 → 76 Q-4 → 77 R-6 → 78·79 P3의 구조가 변하지
  않았다. **컬럼 신설은 여전히 별도 결정이고(마이그레이션 0건 원칙), 이번 라운드는 `apps/api/**`를
  열지 않았다.**
  ⚠️ **갱신 (2026-08-30 · 라운드 81) — 재실측, 상태 변화 0.** 저장소 전체 grep이 여전히 **3건**이고
  사는 파일은 **둘**(`data-retention-purge.job.ts` · `apps/api/test/withdrawn-row-write-paths.test.ts`)
  이며 셋 다 *"그 컬럼이 없다"* 를 말하는 자리다. ⚠️ **이번 라운드는 트랙 E가 `apps/api/**`를 열었지만
  마이그레이션·스키마 0건**이라 이 결정과 접점이 없다. **보류 유지.**
  ⚠️ **갱신 (2026-08-30 · 라운드 82) — 재실측 **3건 · 파일 둘**, 상태 변화 0.** 저장소 전체 grep이 오늘도
  `data-retention-purge.job.ts:385`(*"there is no withdrawn_at column"*) · `withdrawn-row-write-paths.test.ts`
  **두 줄**(121·122)뿐이고 셋 다 *"그 컬럼이 없다"* 를 말하는 자리다. ⚠️ **라운드 82는 트랙 B·C가
  `apps/api/**`를 열었지만 마이그레이션·스키마 0건**(B는 `prisma/seed-data.ts`의 배열 항목 넷, C는
  `src/onboarding/`)이라 이 결정과 접점이 없다. **컬럼 신설은 여전히 별도 결정 · 보류 유지.**
  ⚠️ **갱신 (2026-08-30 · 라운드 83) — 재실측 **3건 · 파일 둘**, 상태 변화 0.** 저장소 전체 스윕이
  오늘도 `data-retention-purge.job.ts`(*"there is no withdrawn_at column"*) 한 줄과
  `withdrawn-row-write-paths.test.ts` **두 줄**뿐이고 셋 다 *"그 컬럼이 없다"* 를 말하는 자리다.
  ⚠️ **라운드 83은 트랙 A·C가 `apps/api/**`를 열었지만 마이그레이션·스키마 0건**(A는
  `prisma/seed-data.ts`의 배열 항목 다섯, C는 `src/admin/`의 카운트 한 칸)이라 이 결정과 접점이 없다.
  **컬럼 신설은 여전히 별도 결정 · 보류 유지.**
  ⚠️ **갱신 (2026-08-30 · 라운드 84) — 재실측 **3건 · 파일 둘**, 상태 변화 0.** 저장소 전체 스윕이
  오늘도 `data-retention-purge.job.ts`(*"there is no withdrawn_at column"*) 한 줄과
  `withdrawn-row-write-paths.test.ts` **두 줄**뿐이고 셋 다 *"그 컬럼이 없다"* 를 말하는 자리다.
  ⚠️ **라운드 84는 어느 트랙도 `apps/api/src`·`prisma/`를 열지 않았다**(트랙 A는 `apps/api`를 읽기만
  하고 쓰기 0건이다) — 마이그레이션·스키마 0건이라 이 결정과 접점이 없다.
  **컬럼 신설은 여전히 별도 결정 · 보류 유지.**
  ⚠️ **갱신 (2026-08-30 · 라운드 85) — 재실측 **3건 · 파일 둘**, 상태 변화 0.** 저장소 전체 스윕이
  오늘도 `data-retention-purge.job.ts`(*"there is no withdrawn_at column"*) 한 줄과
  `withdrawn-row-write-paths.test.ts` **두 줄**(그중 하나는 스키마에 `withdrawnAt`이 **없다**는 부정
  단언이다)뿐이고, 셋 다 *"그 컬럼이 없다"* 를 말하는 자리다. ⚠️ **라운드 85는 어느 트랙도
  `apps/api/src`·`prisma/`를 열지 않았다**(트랙 E가 새로 세운 부정 스윕은 스키마를 **이름으로 읽기만**
  한다 — 쓰기 0건). **컬럼 신설은 여전히 별도 결정 · 보류 유지.**
  ⚠️ **갱신 (2026-08-31 · 라운드 86) — 재실측 **3건 · 파일 둘**, 상태 변화 0.** 저장소 전체 스윕이
  오늘도 `data-retention-purge.job.ts`(*"there is no withdrawn_at column"*) 한 줄과
  `withdrawn-row-write-paths.test.ts` **두 줄**뿐이고, 셋 다 *"그 컬럼이 없다"* 를 말하는 자리다.
  ⚠️ **다만 표기를 나눠 재면 `withdrawn_at` 둘 + `withdrawnAt` 하나다** — **셋이라는 수는 그대로이고**,
  옮겨 적은 수가 표기 방언에 따라 갈릴 수 있다는 사실만 값으로 남긴다(⚠️ **표기 통일은 제안이 아니다** —
  스키마 이름과 산문 인용은 서로 다른 축이다). ⚠️ **라운드 86은 어느 트랙도 `apps/api/src`·`prisma/`를
  열지 않았다**(트랙 E의 새 부정 스윕은 시드와 스키마를 **이름으로 읽기만** 한다 — 쓰기 0건).
  **컬럼 신설은 여전히 별도 결정 · 보류 유지.**
  ⚠️ **갱신 (2026-08-31 · 라운드 87) — 재실측 **3건 · 파일 둘**, 상태 변화 0.** 저장소 전체 스윕이
  오늘도 `data-retention-purge.job.ts`(*"there is no withdrawn_at column"*) 한 줄과
  `withdrawn-row-write-paths.test.ts` **두 줄**뿐이고, 셋 다 *"그 컬럼이 없다"* 를 말하는 자리다
  (라운드 86이 적어 둔 표기 방언 — `withdrawn_at` 둘 + `withdrawnAt` 하나 — 도 그대로이고 **셋이라는
  수는 변하지 않았다**). ⚠️ **라운드 87은 어느 트랙도 `apps/api/**`·`prisma/`를 읽기로도 쓰기로도
  열지 않았다** — 다섯 트랙의 소유가 모바일 셋 · 어드민 하나 · `packages/test-utils` 하나이고,
  그중 저장소 전역을 **읽는** 트랙 E조차 모집단 뿌리에서 `apps/api/**`를 **명시적으로 제외**하고 그
  사실을 자기 사각 칸에 *"미측정"* 으로 적었다(⚠️ **0이 측정값이 아니라 미측정이라고 적힌 첫 자리**다).
  **컬럼 신설은 여전히 별도 결정 · 보류 유지.**
  ⚠️⚠️ **갱신 (2026-08-31 · 라운드 88) — 재실측 **셋 · 파일 둘**, 상태 변화 0. 그리고 이 줄은 오늘
  *자기 수를 정정한다* — 이 문서가 자기가 낸 수를 스스로 뒤집는 첫 자리다.** 라운드 88 정찰이 한 줄
  grep으로 처음 잰 값은 **2**였고 그 값이 **틀렸다**: 그 컬럼을 `withdrawnAt`(카멜)로 적은 자리
  하나(`withdrawn-row-write-paths.test.ts:122`)를 그 바늘이 보지 못했다. ⚠️ **라운드 87의 *셋 · 파일
  둘*이 옳고 오늘 처음 잰 값이 틀렸다** — 라운드 86이 *"표기를 나눠 재면 `withdrawn_at` 둘 +
  `withdrawnAt` 하나"* 라고 적어 둔 그 방언 한 줄이 없었다면, 오늘 이 줄은 **줄어든 수를 상태 변화로
  읽었을 것**이다. ⚠️⚠️ **그래서 이 정정의 값은 수가 아니라 *절차*다**: 라운드 86이 값으로 적어 둔
  것은 수치가 아니라 **그 수를 세는 방법의 갈림**이었고, 그것이 두 라운드 뒤에 오답을 잡았다
  (판정 **AC-5** — *수를 어떻게 냈는지를 적으면 그 수가 틀렸다는 것도 함께 드러난다*). 셋 다 여전히
  *"그 컬럼이 없다"* 를 말하는 자리이고, ⚠️ **라운드 88도 어느 트랙도 `apps/api/**`·`prisma/`를
  쓰기로 열지 않았다**(트랙 D가 어드민 `src/lib/admin-api.ts`에 이유 주석을 더했을 뿐 api 소스는
  무접촉이고, 저장소 전역을 읽는 트랙 C·D의 스윕도 그 뿌리를 모집단에 넣지 않는다 — 라운드 87이
  *"미측정"* 이라고 적은 그 칸이 오늘도 미측정이다). **컬럼 신설은 여전히 별도 결정 · 보류 유지.**

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
  걷고 각 실패 문장의 방아쇠를 판정해 가르며, 뮤테이션 자리는 출구 셋
  (`announce`·`live-region`·`toast`) 중 하나를 가져야 한다.
  ⚠️ **제외도 이유가 적힌 값이다** — 쿼리로 분류된 자리는 *"화면 영역이 통째로 바뀐다 — A-20 #85 선행"*,
  축하 배너 하나는 *"실패가 아니다"*. **이유는 빈 문자열일 수 없다.**
- ⚠️⚠️ **그런데 그 값들은 스캐너의 답이지 소스의 답이 아니었다 — 라운드 80 적대적 리뷰 M-1이 재실측했다.**
  종전에 적힌 **뮤테이션 20 / 쿼리 19 · announce 19 + toast 1**은 스캐너의 구멍 셋에서 나온 수였다:
  ⓐ 삼항의 **else 가지**가 then 조건에 귀속돼(화면 하단이 통째로 상단 로딩/오류 삼항의 else인 화면),
  입력 검증·파괴적 버튼 라벨·**저장 실패 Toast**가 "쿼리 조건"에 매달렸다 ·
  ⓑ `useMutation` 옵션 객체를 통째로 제외해 **`onError`가 세우는 저장 실패 문장**이 빠졌다 ·
  ⓒ **실패 갈래**(`try/catch` · `.catch(…)`)와 `style={styles.…}`·배열 스타일을 세지 않아 로그인·준비템
  상태 변경의 실패 문장이 통째로 모집단 밖이었다. **재실측 값은 뮤테이션 25(열세 화면) / 이 스캐너가
  쿼리로 분류한 자리 11(여섯 화면)**이고 출구 분포는 **announce 20 + toast 5**,
  **`live-region`만인 자리 0건**(= iOS에서 조용한 자리 0건) · **`silent` 0건**이 부정 단언이다.
  ⚠️ **늘어난 다섯은 전부 이미 출구를 가진 자리였다**(지출 저장 실패 Toast 둘 · 준비템 상태 변경 실패
  Toast 둘 · 로그인 실패 카드 하나 — 그 카드는 프롭 쌍을 **alert 컨테이너**에 지고 `announceForA11y`
  배선도 이미 있다). **그래서 넓어진 모집단이 새로 뚫은 침묵은 0건이고, 화면 소스는 한 글자도 바뀌지
  않았다.** ⚠️ 재실측의 부작용 하나가 값으로 선다: 뮤테이션 자리가 **전부 맨 줄**이라던 부정 단언이
  이제 **하나의 예외**(로그인 — alert 컨테이너 안)를 이유와 함께 든다.
- ⚠️ **이름도 정정됐다.** 제외 칸은 *"쿼리가 세우는 실패 문장"* 이 아니라 **"이 스캐너가 쿼리 조건 아래
  danger 색 글자로 분류한 자리"** 다 — 그 열하나 중 셋은 실패 문장이 아니라 **파괴적 동작의 버튼 라벨**
  (`app/family/index.tsx`의 삭제·가구 추가·탈퇴)이고, danger 색을 입었다는 이유로 거기 서 있다.
  **판정은 같지만(통째로 범위 밖) 이름이 사실과 같아야 다음 사람이 그 수를 근거로 쓰지 않는다.**
- ⚠️ **화면별 자리 수가 값으로 서 있다** — 하나가 늘거나 줄면 빨개진다. 손 목록으로 돌아가지 않는 것이
  이 계약의 값이고, 그래서 **새 화면이 뮤테이션 실패 문장을 그리는 날 그 화면도 자동으로 이 질문을
  받는다.**
- ⚠️ **이 계약의 값 하나는 머지 순서에 의존한다**(리뷰 P-4 — 값으로만 적는다). 화면별 자리 수와
  합계는 **모집단의 절대수**라, 다른 트랙이 `app/**`에 실패 문장을 하나 더 그리거나 지우면 이 표가
  빨개진다 — 그것이 이 계약의 목적이지만, **같은 라운드의 병렬 트랙이 먼저 머지되면 그 빨간불은
  결함이 아니라 순서**다. 그때 할 일은 값을 다시 재는 것 하나이고(이 파일이 세는 방법은 파생이라
  손 목록을 고칠 일이 없다), **줄이거나 제외로 옮기는 것이 아니다.**
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
- ⚠️⚠️ **갱신 (2026-08-30 · 라운드 84) — 그 질문을 처음 실측했고, 답은 *하나*였으며 그 하나가 트랙이
  됐다.** 이름이 `*-contract.test.ts`인 파일 전수에서 제목과 본문이 갈리는 것은 **하나**뿐이었다 —
  *"contracts 수기 미러 드리프트 가드"* 라는 제목이 무는 것이 **값 넷**이고 미러의 **모집단을 세는
  자리가 0건**이었다. **트랙 C가 그 모집단을 스윕으로 세우고 제목을 본문에 맞췄다**(판정 **Y-3** —
  거기서 이 자리는 *"제목과 본문"* 이 아니라 *"먼저 세운 앱의 대장이 건너가지 않았다"* 의 사례로
  다시 읽힌다). ⚠️ **나머지 파일은 제목도 하는 일을 그대로 말한다**(스윕은 스윕이라고, 지정 대조는
  화면 하나·배선 하나를 이름으로 걸고 있다). **이 절의 판정과 종전 넷은 바이트 불변이다.**

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
- ⚠️⚠️ **잔여 갈래 하나가 남아 있었다 — 라운드 80 적대적 리뷰 M-3이 닫았다.** `record_gap`의 범위는
  *"`lastRecordedOn`보다 뒤인 행"* 하나였는데, **서울 기준 미래 날짜**의 대기 행은 정의상 언제나 그
  뒤다. 그리고 그 행은 서버가 **`EXPENSE_FUTURE_DATE`(400)로 영구 거절**하는 행이라
  (`apps/api/src/onboarding/store-shared.ts`) 종점 `failed`로 굳는다 — 즉 **이 절이 닫았다고 적은
  영구 정지가 그 한 갈래에서는 그대로 살아 있었다.** 오늘의 값: 범위에 **상한(오늘 · 서울)** 이
  붙었고(`PendingRecordScope`의 `until`), 상한은 **포함**이다(서버가 받아 줄 수 있는 마지막 날이
  오늘이다). 상한을 주지 않으면 답은 종전과 정확히 같고, 재현은 계약이 진다.
  ⚠️ **일반형 하나가 더 나온다: 범위의 한쪽만 닫으면 반대쪽이 그대로 구멍이다.**
- ⚠️ **`monthly_wrapup`에는 아직 값으로만 남는 구멍이 하나 있다**(리뷰 S-2 — 코드 변경 0건).
  그 게이트가 읽는 것은 대기 행의 **`payload.spentOn`**, 즉 **바뀐 뒤의 날짜** 하나다. 그래서
  *"지난달 지출의 날짜를 이번 달로 옮기는 수정"* 이 대기 중이면 그 행은 지난달 범위 **밖**으로
  읽히는데, 그 수정이 서버에 반영되면 **지난달 총액은 실제로 달라진다.** 반대 방향(이번 달 → 지난달)
  도 같다. ⚠️ **오늘 이것을 고치지 않는 이유는 값을 몰라서다** — 원래 달을 알려면 대기 행이
  *"바뀌기 전 날짜"* 를 함께 들어야 하고, 그것은 오프라인 큐의 행 모양을 바꾸는 별도 결정이다
  (이 라운드의 범위 밖). **틀린 금액을 말할 창은 "수정이 달을 넘는 편집" × "그 편집이 대기 중" ×
  "그달의 정리 알림이 그 사이에 평가된다" 셋이 겹칠 때뿐이고**, 그 창에서도 알림은 **뜨지 않는 게
  아니라 서버 값으로 뜬다**(정지가 아니라 정확도다 — 이 절이 닫은 축과 다른 축이다).
  ⚠️ **갱신 (2026-08-30 · 라운드 81) — 재실측, 상태 변화 0.** 게이트가 읽는 것은 여전히 대기 행의
  **바뀐 뒤 날짜** 하나이고, 원래 달을 알려면 오프라인 큐의 행 모양이 바뀌어야 한다(별도 결정 —
  이 라운드의 어느 트랙도 `src/offline/**`·`src/notifications/**`를 열지 않았다). **보류 유지.**
  ⚠️ **갱신 (2026-08-30 · 라운드 82) — 재실측, 상태 변화 0.** 게이트가 읽는 것은 여전히 대기 행의
  **바뀐 뒤 날짜** 하나이고, 라운드 82의 어느 트랙도 `src/offline/**`·`src/notifications/**`를 열지
  않았다(트랙 A가 연 리포트 탭은 알림 층과 접점이 0건이다 — 아래 W절 머리말의 "알림의 도달"과 같은
  사실이다). **보류 유지.**
  ⚠️ **갱신 (2026-08-30 · 라운드 83) — 재실측, 상태 변화 0.** 게이트가 읽는 것은 여전히 대기 행의
  **바뀐 뒤 날짜** 하나이고, 원래 달을 알려면 오프라인 큐의 행 모양이 바뀌어야 한다(별도 결정).
  라운드 83의 어느 트랙도 `src/offline/**`·`src/notifications/**`를 열지 않았다 — ⚠️ 트랙 D가 연
  캐시 정책은 `["children"]`·`["categories"]`·`["household-members"]` 셋의 신선도이고 **알림 평가가
  기대는 대기 행·dedupe 키와 접점이 0건**이다. **보류 유지.**
  ⚠️ **갱신 (2026-08-30 · 라운드 84) — 재실측, 상태 변화 0.** 게이트가 읽는 것은 여전히 대기 행의
  **바뀐 뒤 날짜** 하나이고, 원래 달을 알려면 오프라인 큐의 행 모양이 바뀌어야 한다(별도 결정).
  ⚠️ **이번 라운드는 트랙 D가 `src/offline/sync-controller.ts`를 열었지만 쓰기 0건이다** — 그 트랙이
  그 파일에서 한 일은 *"확정 시점의 `["home"]` 무효화는 flush가 한다"* 는 문장이 참인지를 **소스로
  읽어 확인한 것**뿐이고(판정 **Y-4**), 대기 행·dedupe 키·달 판정과는 접점이 0건이다. **보류 유지.**
  ⚠️ **갱신 (2026-08-30 · 라운드 85) — 재실측, 상태 변화 0.** 게이트가 읽는 것은 여전히 대기 행의
  **바뀐 뒤 날짜** 하나이고, 원래 달을 알려면 오프라인 큐의 행 모양이 바뀌어야 한다(별도 결정).
  ⚠️ **이번 라운드는 어느 트랙도 `src/offline/**`·`src/notifications/**`를 열지 않았다** — 트랙 A·B가
  `expense-list-reconciliation.ts`를 **읽기만** 하고(합계 규칙의 단일 소스), 그 읽기는 달마다 따로
  통과시키는 호출이라 대기 행의 **달 판정 자체는 한 글자도 바뀌지 않았다**. **보류 유지.**
  ⚠️ **갱신 (2026-08-31 · 라운드 86) — 재실측, 상태 변화 0.** 게이트가 읽는 것은 여전히 대기 행의
  **바뀐 뒤 날짜** 하나이고, 원래 달을 알려면 오프라인 큐의 행 모양이 바뀌어야 한다(별도 결정).
  ⚠️ **이번 라운드도 어느 트랙도 `src/notifications/**`를 열지 않았고 `src/offline/**`는 트랙 B가
  열었지만 접점이 0건이다** — B가 손댄 것은 조회 실패 배선 대장(`offline-aware-screens.ts`의 목록
  두 벌)이고, 대기 행의 달 판정도 `monthly_wrapup`의 게이트도 그 파일에 살지 않는다. **보류 유지.**
  ⚠️ **갱신 (2026-08-31 · 라운드 87) — 재실측, 상태 변화 0.** 게이트가 읽는 것은 여전히 대기 행의
  **바뀐 뒤 날짜** 하나이고, 원래 달을 알려면 오프라인 큐의 행 모양이 바뀌어야 한다(별도 결정).
  ⚠️⚠️ **이번 라운드는 트랙 D가 `src/notifications/**`를 *쓰기로* 열었는데도 접점이 0건이다** — D가
  더한 것은 기기 목록 행의 제목과 스위치 낭독 라벨을 짓는 순수 모듈 하나(`device-rows.ts`)이고,
  그 모듈은 알림 **생성기**도 dedupe 키도 대기 행도 읽지 않는다(`generators.ts`·
  `notification.store.ts` 무접촉). ⚠️ **그 디렉터리가 라운드 80 이후 처음으로 *쓰기로* 열렸다는 사실 자체를
  여기 적어 둔다** — 다음 라운드가 *"알림 층을 연 라운드가 있었으니 이 구멍도 다시 봤겠지"* 로 읽지
  않도록. **보류 유지.**
  ⚠️ **갱신 (2026-08-31 · 라운드 88) — 재실측, 상태 변화 0.** 게이트가 읽는 것은 여전히 대기 행의
  **바뀐 뒤 날짜** 하나이고, 원래 달을 알려면 오프라인 큐의 행 모양이 바뀌어야 한다(별도 결정).
  ⚠️⚠️ **두 라운드 연속으로 트랙 하나가 `src/notifications/**`를 *쓰기로* 열었는데 접점은 이번에도
  0건이다** — 트랙 B가 더한 것은 **등록 본문을 짓는 한 벌**(`buildDeviceRegistrationBody`)이고, 그
  함수는 기기 등록 요청의 필드만 짓지 알림 **생성기**도 dedupe 키도 대기 행도 읽지 않는다
  (`generators.ts`·`notification.store.ts`·`monthly-wrapup` 전부 무접촉). ⚠️ **그 디렉터리가 두 라운드
  연속 열렸다는 사실이 이 구멍의 상태를 바꾸지 않는다는 것을 여기 한 번 더 적어 둔다** — 접점의
  유무는 실측을 대신하지 않는다. **보류 유지.**
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
- ⚠️⚠️ **그런데 "두 번째 창"은 닫히지 않았었다 — 라운드 80 적대적 리뷰 M-2가 정정했다.** 위 문단이
  적은 *"내보내기 직후에 다시 읽은 총계"* 는 **언제나 직전과 같은 값**이었다: `exportCsv`는 자기
  요청으로 행을 모아 Blob을 내려줄 뿐 `pageInfo`를 건드리지 않으므로(`apps/admin/app/audit-logs/
  page.tsx`) heading은 갱신되지 않는다. 즉 그 비교는 **같은 값을 자기 자신과 비교**하고 있었고,
  창이 닫힌 것처럼 보였을 뿐이다. 오늘의 값: 내보내기 뒤 **목록을 실제로 다시 부르고**(`[초기화]` —
  `resetFilters`가 언제나 **새 필터 객체**를 세우므로 조건이 같아도 조회가 다시 돈다. 같은 값을
  다시 `setState`하면 React가 걸러 내므로 `[필터 적용]`을 다시 누르는 방법은 통하지 않는다),
  필터가 걸려 있던 자리는 그 필터를 **다시 적용해** 같은 화면으로 돌아온 뒤 총계를 다시 읽는다.
  두 시점 사이의 드리프트는 **범위**로 허용하고(`[내보내기 전 총계, 다시 읽은 총계]`), 어긋나면
  실패 메시지가 두 값을 함께 적는다. ⚠️ **일반형: 무언가를 "다시 읽었다"고 적기 전에 그것이
  갱신되는 자리인지 먼저 묻는다.**
- ⚠️ **완화 하나가 있었다 — 시점이다**(리뷰 S-6 · 위 문단의 *"단언 0건 완화"* 는 결과에 대한 말이다).
  9·10단의 좁혀짐 판정은 종전에 **읽자마자 즉시** 참이어야 했고, 오늘은 `waitForAuditTotal`이
  **최대 `STEP_TIMEOUT`(60초)** 동안 heading을 다시 읽는다. 기대값·비교 방향·검증 항목은 한 글자도
  바뀌지 않았지만, *"언제까지 참이 되어야 하는가"* 는 **즉시에서 60초로 느슨해졌다.** 그 대가로 산
  것은 관측된 플레이크(`4189=4189`)의 소멸이고, 잃은 것은 **"화면이 60초 안에만 그려지면 통과한다"**
  는 것이다(렌더가 느려지는 회귀는 이 스텝이 잡지 않는다 — 잡는 자리는 없다). **완화를 값으로 적어
  두는 이유는 다음 사람이 이 문단을 근거로 상한을 더 올리지 않게 하기 위해서다.**
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
- ⚠️ **"참조 0건" 판정은 참조가 **어떻게 적혔는가**에 민감하다**(리뷰 P-2 — 값으로만 적는다).
  이 계약이 라우트를 부르는 자리를 찾는 방법은 소스에서 **그 URL 문자열을 찾는 것**이라, 같은
  화면을 템플릿 문자열(`/items/` + id)로 **조립해서** 부르거나 상수에 담아 부르면 그
  자리는 보이지 않는다. 그래서 **"참조 0건"은 "아무도 부르지 않는다"가 아니라 "문자열로는 보이지
  않는다"** 이고, 오늘 그 목록의 넷은 전부 **이유가 함께 적힌** 자리다. ⚠️ 반대 방향의 위험이 더
  크다: 참조가 조립식으로 바뀌는 날 그 라우트가 **조용히 이 목록으로 들어온다** — 그때 물어야 하는
  것은 "지워도 되는가"가 아니라 **"이 그물이 그 참조를 볼 수 있는가"** 다.
- **일반형.** **아직 그물이 없는 축은 "파일이 아니라 표면"이다.** ⚠️ **다음 라운드가 먼저 세어 볼 만한
  것: DNC 계약 스무 줄 중 기계가 지키지 않는 것이 무엇인가** — 오늘 DNC-003이 그 답의 하나였고, 네
  라운드 동안 산문으로만 재어져 왔다.
- ⚠️ **갱신 (2026-08-30 · 라운드 81) — `/budget` 겹침은 재실측했고 상태 변화 0이다.**
  `route-surface.test.ts:187`의 `URL_OVERLAPS`가 오늘도 **둘**(`/` · `/budget`)을 이유와 함께 들고
  있고, *"어느 쪽이 이긴다"* 는 이 계약이 여전히 주장하지 않는다. **실기기 확인(`#133`) 대기 ·
  보류 유지**이며 이번 라운드의 어느 트랙도 라우트 파일을 열지 않았다.
- ⚠️ **갱신 (2026-08-30 · 라운드 82) — 재실측, 상태 변화 0.** `URL_OVERLAPS`가 오늘도 **둘**(`/` ·
  `/budget`)이다. ⚠️ **이번 라운드가 그 표면에 더한 것은 라우트가 아니라 대장 한 벌이다** — 트랙 D의
  `src/query/home-payload-consumers.test.ts`는 라우트의 **URL**이 아니라 그 화면들이 켜는 **요청**을
  세므로 이 계약의 모집단과 겹치지 않는다(같은 `app/**` 전수를 걷지만 묻는 축이 다르다). **실기기
  확인(`#133`) 대기 · 보류 유지.**
- ⚠️ **갱신 (2026-08-30 · 라운드 83) — 재실측, 상태 변화 0.** `URL_OVERLAPS`가 오늘도 **둘**(`/` ·
  `/budget`)이고 *"어느 쪽이 이긴다"* 는 이 계약이 여전히 주장하지 않는다. ⚠️ **이번 라운드가 그
  표면에 더한 것도 라우트가 아니다** — 트랙 B가 넓힌 첫 페인트 대장의 모집단(`app/(tabs)`의 탭 다섯)은
  이 계약이 세는 **URL**이 아니라 그 화면들이 켜는 **요청**이라, 같은 전수를 걷되 묻는 축이 다르다.
  **라우트 파일 이동·삭제·생성 0건 · 실기기 확인(`#133`) 대기 · 보류 유지.**
- ⚠️⚠️ **갱신 (2026-08-30 · 라운드 84) — 두 가지다. ⓐ 이 절이 남긴 질문(*"DNC 계약 스무 줄 중 기계가
  지키지 않는 것이 무엇인가"*)이 네 라운드 만에 처음 실측됐고, 그것이 트랙 B가 됐다** — 조항 전수를
  파싱하는 대장이 서서 **가드 열일곱 · 없음 셋**을 이유·재개 조건과 함께 값으로 들고 래칫이 그 값에
  걸린다(판정 **Y-5**). ⚠️ **DNC-003은 오늘도 그 답의 하나가 아니다** — 이 절이 세운 라우트 계약이
  그 조항의 가드로 대장에 이름과 줄로 실렸다(*"산문으로만 재어져 왔다"* 는 이 절의 문장은 그래서
  오늘 끝난다). **ⓑ `/budget` 겹침은 재실측했고 상태 변화 0이다** — `URL_OVERLAPS`가 오늘도 **둘**
  (`/` · `/budget`)이고 *"어느 쪽이 이긴다"* 는 이 계약이 여전히 주장하지 않으며, 라운드 84의 어느
  트랙도 라우트 파일을 열지 않았다. **실기기 확인(`#133`) 대기 · 보류 유지.**

## V. 라운드 81에서 확정한 판정 (2026-08-30 · GAP-081 트랙 F)

라운드 80이 물은 것이 **그물의 모집단이 새 질문의 단위인가** 였다면, 라운드 81은 축을 다시
**사용자 가치**로 돌렸다 — 핵심 루프의 마찰 · 성능 실측 · 이미 있는 데이터로 닫는 소형 여정, 이 셋에서만
발굴했다. 다섯 판정 다 K~U절과 같이 **결함 보고가 아니라 다음 결정의 입력**이며 2026-08-30 소스에서
확인됐다(라운드 81 트랙 A·B·C·D·E 머지 후).

⚠️⚠️ **이번 라운드의 가장 값진 관측: 이 저장소는 판정을 잘 지키고, 그 판정에 무엇을 언제 먹이는지는
덜 지킨다.** 다섯 중 **넷이 판정 규칙을 한 글자도 바꾸지 않았다** — A는 원천의 **범위**를 한 달 넓혔고
(`history:` 인자 하나), B는 같은 술어를 3분 뒤 한 번 더 불렀고(일회용 타이머 하나), C는 같은 계산의
**키**를 넓혔고(ref 키 하나), D는 같은 화면이 이미 만들어 그리고 있는 문자열을 술어에 넘겼다(선택 인자
하나). **판정은 다섯 번 다 옳았고, 그 판정이 본 것이 틀렸다**(V-1).

⚠️⚠️ **두 번째 관측: 형제를 고칠 때 셋째를 세지 않으면 그 셋째는 이유가 적힌 채로 남는다**(V-2).
라운드 58 E는 자동완성 칩과 최근 품목 칩의 원천을 넓히며 자동 분류를 **명시적으로** 남겨 두고 그 이유를
소스에 적었는데, 그 문장은 **22라운드 동안 아무도 다시 열지 않은 문**이 됐다 — 이유가 적혀 있다는 사실
자체가 재론을 막았다. 같은 저장소에 반대 사례가 있다: N-4는 기각을 적으며 *"다시 제안하려면 새 실측이
먼저 있어야 한다"* 는 **깨울 조건**을 함께 적었고, 그래서 오늘 트랙 E가 그 조건을 만족시켜 열 수 있었다.

⚠️⚠️ **세 번째 관측: "전수 확인"이라고 적힌 산문은 여섯 라운드 만에 낡았다**(V-3). N-4의 N+1 census는
*"`for` 루프 안의 `await` 전수 확인"* 이라고 적혀 있어서 이후 여섯 라운드가 그 축을 다시 세지 않았고,
**오늘 다시 세니 상한 2,000짜리 자리가 둘 있었다.** 라운드 80의 물음이 *"그물의 모집단이 새 질문의
단위인가"* 였다면 이번 물음은 한 칸 더 앞이다 — **그 전수는 실제로 전수였는가.**

**같은 저장소가 스스로 적어 둔 자리를 먼저 읽는 것이 이번에도 가장 값쌌다.** 다섯 중 셋이 이 저장소
자신의 문장에서 나왔다 — A는 `new.tsx:724-730`(*"이번 달 캐시는 매달 1일 아침에 거의 비어 있다"* —
형제 둘에 대해 이미 적어 둔 그 문장), C는 `items.tsx`의 *"분류 캐시가 오기 전에는 전부 기타로 떨어진다"*
주석, E는 **이 파일의 N-4 문단**이다.

⚠️⚠️ **이월 다섯은 전부 보류 유지이고 재실측 값만 갱신했다 — 갱신 한 줄씩은 그 판정이 사는 절에 있다**
(다음 라운드가 같은 실측을 다시 돌리지 않도록 여기서는 자리만 가리킨다).

- **이 스캐너가 쿼리로 분류한 열한 자리의 낭독** — 재실측 **11**, A-20 #85 선행 → **U절 머리말**.
- **`monthly_wrapup`의 달 이동 구멍** — 게이트가 읽는 것은 여전히 대기 행의 바뀐 뒤 날짜 하나 → **U-3**.
- **`/budget` 겹침 착지** — `URL_OVERLAPS` 여전히 둘, 확인의 표 `#133` 대기 → **U-5**.
- **S-3(어드민 `disabled`)** — 재실측 **열하나**(items 6 · links 5), 브라우저 확인 `#130` 선행 → **U절 머리말**.
- **`withdrawn_at`** — 저장소 전체 **3건 · 파일 둘**, 컬럼 신설은 여전히 별도 결정 → **U절 머리말**.

**다섯 다 2026-08-30 재실측이고 상태 변화 0이며, 이번 라운드의 어느 트랙도 그 자리들을 열지 않았다**
(⚠️ 트랙 E가 `apps/api/**`를 열었지만 **마이그레이션 0건**이라 `withdrawn_at`과 접점이 없다).

**이 라운드가 짝 문서에 남긴 것.** 확인의 표에 **#134~#138**(넷은 `실기기` · 트랙 E의 **#138은
`서버`** — 2,000행 픽스처는 실 PostgreSQL에서 재현되고 폰이 등장하지 않는다)이 서고 §0의 여섯 숫자가
파싱으로 다시 세어졌으며(실기기 116 → **120** · 서버 5 → **6** · 합계 133 → **138**), 접근성 표에는
**A-22 #90·#91**(둘 다 코드가 답할 수 없는 절반을 기기로 넘긴다)이 섰다. ⚠️ **C-3(잠금 오버레이
TalkBack 투과)은 오늘로 열다섯 라운드 연속 미확인**이고, 이 절이 그것에 대해 적을 수 있는 것은
경과 수뿐이다 — 남은 것은 사람·기기·날짜 배정이다.

### V-1. **순수 판정을 떼어 내는 규율은 규칙을 지켜 주지만 입력의 범위는 지켜 주지 않는다** — 범위는 호출부에 남고, 호출부에는 계약이 얇다

- **사실.** 네 자리의 모양이 같았다 — **판정은 순수 모듈에 잘 떼어져 있었고, 그 판정이 무엇을 보는지는
  호출부에 남아 있었다.**
  - **A.** `resolveAutoCategorySelection`(`src/expenses/category-suggestion.ts`)의 규칙은 1순위 과거
    기록 / 2순위 정적 키워드 사전이다. 규칙은 옳았고, 호출부(`app/expenses/new.tsx`)가 넘기던
    `history`가 **이번 달 캐시 하나**였다 — 매달 1일 아침 그 배열은 **정의상 비어 있어** 1순위 갈래가
    반드시 실패했다. 2순위도 걸리지 않으면 분류는 미선택이라 저장이 막힌다(라운드 51 C-#5의
    `isCategoryMissingForSave`). ⚠️ **형제 둘은 라운드 58 E에서 두 달로 넓혀졌고 자동 분류만 남아
    있었다.**
  - **B.** 자격은 시간 두 개다(`PURCHASE_FOLLOWUP_MIN_AGE_MS` 3분 · `MAX_AGE_MS` 24시간). 그런데
    그 시간이 지나는 것을 보는 자리가 없었다 — `check()`의 방아쇠는 persist 하이드레이션 ·
    `AppState "active"` · 의존성 셋뿐이고, `src/commerce/**` 전체에 `setTimeout`·`setInterval`이
    **0건**이었다. **"아직 3분이 안 됐다"로 떨어진 판정은 그 뒤로 스스로 다시 서지 않았다.**
  - **C.** 첫 펼침은 아이당 한 번이었는데(`autoExpandedContext.current === selectedContextKey`) 그
    목록을 갈아 끼우는 입력은 **넷이 더** 있었다(시기 밴드 · 필수도 · 찜 · 검색어). 그리고 콜드
    스타트에는 분류 캐시가 늦게 와 그 한 번을 **"기타" 하나**에 쓰고 ref를 잠갔다.
  - **D.** 술어는 `item.name` 하나만 봤다 — `FilterableItem`에 분류가 아예 없었다. 그런데 화면은
    placeholder에 *"품목명·별칭·분류 검색"* 을 약속하고, **그 분류 이름을 바로 아래 그룹 헤더에 이미
    그리고 있었다.**
- **오늘의 값.** 넷 다 **호출부 한 자리**로 닫혔다. A는 `recentItemServerRows`의 `useMemo`를 자동 분류
  effect **위로 옮기고** `history:` 인자를 그 배열로 바꿨다(**새 요청 0건 · 새 배열 0건 · 새 `useMemo`
  0건** — 둘 다 `getQueryData`로 이미 읽어 둔 캐시다). B는 순수 술어 하나
  (`nextPromptEligibleDelayMs`)와 그 답으로 거는 **일회용 타이머 하나**(`schedule`은 걸린 것을 먼저
  해제하므로 동시에 살아 있는 타이머는 언제나 최대 하나이고, cleanup에서 반드시 풀린다). C는 ref의
  키를 `preparationAutoExpandKey(contextKey, groupIds)`로 넓히고 재계산 조건을 순수 함수
  `resolvePreparationAutoExpand`로 떼어 냈다. D는 `FilterableItem`의 **선택 필드 하나**와
  `ItemFilterInput.categoryNameOf` — **주지 않으면 술어의 답이 오늘과 바이트 불변**이라 비세션
  미리보기·로컬 백엔드 픽스처는 한 글자도 달라지지 않는다.
- ⚠️ **판정 규칙은 넷 다 무변경이다.** A는 순수 모듈 소스 0건 변경(같은 품목명의 과거 분류가 여럿일 때
  누가 이기는지는 `item-name-match.ts`가 이미 답한다 — 매칭 등급 우선, 동률이면 `sortByRecency`의 최신
  행). B는 창 상수·세션 슬롯(`promptSessionGate`)·아이 게이트·앱 잠금 보류가 **한 글자도 약해지지
  않았다** — 타이머가 하는 일은 *"그때 다시 물어본다"* 하나다. C는 이식본의 렌더 트리가 한 노드도 바뀌지
  않았고(DSN-053), **사용자가 접은 그룹은 되펼치지 않는다**(재계산은 *"펼쳐 둔 그룹 중 지금 목록에
  살아 있는 것이 0"* 일 때만 — ⚠️ 그 조건의 정확한 뜻은 아래 정정 문단이 좁힌다). D는 정렬이 서버가 준
  순서 그대로다.
- ⚠️⚠️ **정정 (2026-08-30 · 라운드 81 적대적 리뷰) — 넷 중 셋에서 "판정이 보는 것"이 한 겹 더
  남아 있었다.** 이 절이 적어 둔 값들이 그때는 참이 아니었고, 같은 라운드 안에서 소스로 닫혔다.
  - **B(구매 확인 카드) 둘.** ⓐ 타이머가 **백그라운드에서 발화**해도 판정이 그대로 돌았다 — 앱 잠금
    보류(`unlockedThisForeground`)는 백그라운드를 덮지 못하므로, 사용자가 본 적 없는 물음이 **세션 표출
    슬롯과 낭독 기억(`announcedKeyRef`)을 태우고** 정작 카드를 볼 때는 낭독이 오지 않았다. 이제 타이머
    콜백은 `AppState.currentState === "active"`가 아니면 아무것도 하지 않고 다음 `"active"`에 맡기며,
    낭독 기억은 **카드가 실제로 그려지는 프레임**(잠금 보류·아이 게이트를 지난 뒤)에서만 소모된다.
    ⓑ **미래 `clickedAt`**(시계 역행 blob)은 남은 시간을 `Math.min`으로 3분에 자르는 바람에 **3분 주기
    폴링**이 됐다 — *"헛도는 깨움 0건"* 과 정면으로 어긋나는 값이었다. 이제 그런 항목은 자르지 않고
    **세지 않는다**(부정 계약이 `purchase-followup.store.test.ts`에 섰다).
  - **C(준비템 첫 펼침) 둘.** ⓐ *"펼쳐 둔 그룹 중 살아 있는 것이 0"* 은 사용자가 손으로 **전부 접은**
    화면에서도 참이라(빈 배열의 `some`은 언제나 false다), 칩 하나로 목록이 갈리기만 하면 접어 둔 화면이
    첫 그룹부터 다시 펼쳐졌다 — 즉 **"되펼치지 않는다"는 이 절과 체크표 #91의 약속이 실제로는 지켜지지
    않았다.** 이제 같은 아이 안에서 펼침이 0이면 그것을 **의도한 상태**로 보고 손대지 않는다(아이가 바뀐
    경우와 첫 계산은 종전대로 첫 그룹을 편다). ⓑ **검색 중에는 판정이 쉰다** — 검색이 켜지면 화면은 분류
    섹션 대신 평평한 결과 그리드를 그리는데, 그 동안 결과 목록의 서명으로 자동 펼침을 다시 계산해 **보이지도
    않는 화면의 상태**가 바뀌고 검색을 닫으면 사용자의 펼침이 다른 그룹으로 갈아치워졌다(좁아졌다 넓어지는
    왕복의 손실). 이제 검색 중에는 키도 갱신하지 않으므로 **왕복이 무손실**이다.
  - **D(분류 이름 검색)의 잔여 하나.** 술어는 정직하지만 **매칭 근거가 화면에 없다**: 검색이 켜진 동안
    분류 헤더는 렌더되지 않고(평평한 결과 그리드), 시기별 세그먼트에서는 헤더가 시기 밴드다. 그래서
    계약 ⓐ가 말하는 *"그룹 헤더가 세는 집합과 같다"* 는 **집합의 동일성**이지 *"사용자가 그 근거를 읽을 수
    있다"* 가 아니다 — 그 사실을 테스트 문구에 좁혀 적었다. 결과 카드에 매칭 사유를 적는 것은 승인 디자인
    이식본(DSN-053)의 렌더를 여는 일이라 **디자인 승인이 선행**이고, 그때까지 이 잔여는 여기 값으로 남는다
    (위 "별칭 원천 0건"과 같은 취급이다).
  - **A(자동 분류 원천)의 과잉 주장 하나.** 주석이 *"매달 1일의 공백을 메웠다"* 라고만 적었는데, 그 공백이
    메워지는 조건은 **지난달 캐시가 이미 받아져 있을 때**다(이 경로는 새 요청을 0건으로 두는 것이 규율이라
    캐시를 받아 오지 않는다). 콜드 스타트 직후의 1일 아침에는 두 달치가 모두 비어 종전과 같다 — `new.tsx`와
    `category-suggestion.ts` 머리말이 이제 그 조건을 함께 말한다.
- ⚠️ **D의 나머지 절반은 값으로만 남는다 — "별칭"에는 원천이 0건이다**(실측: `ItemSummary` ·
  `PreparationParityItem` · `itemTemplateSeeds` 어디에도 별칭 필드가 없다). **셋 중 하나는 데이터가 못
  지키는 약속**인데, 그 문구는 승인 디자인 이식본의 카피라 **정정은 디자인 승인이 선행**이다. 이번
  라운드가 한 일은 지킬 수 있는 약속 하나를 실제로 지킨 것이고, **기각이 아니라 원천 0건**이라는 사실을
  여기 값으로 남긴다(다음 라운드가 이것을 결함으로 다시 줍지 않도록).
- ⚠️ **그리고 D가 세운 규율 하나가 소스에 값으로 있다: 분류 이름의 출처는 화면의 단일 조립기
  `groupKeyOf` 하나다.** 두 번째 조립기를 두면 검색이 **화면에 없는 이름을 찾거나 화면에 있는 이름을 못
  찾는** 방향이 열린다. 같은 규율이 분류 캐시가 비었을 때의 답도 정한다 — 그때는 모든 항목의 이름이
  "기타"라 *"기타"* 검색이 전체를 통과시키는데, **화면도 그때 모든 항목을 "기타" 그룹에 그리므로 그것이
  어긋남이 아니라 정직한 답**이다.
- **일반형.** **순수 판정을 떼어 내는 규율은 규칙을 지켜 주지만 *입력의 범위*는 지켜 주지 않는다.**
  범위는 호출부에 남고, 호출부에는 계약이 얇다. ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 순수 술어를
  부르는 자리 중 *그 술어가 무엇을 보는지*를 계약이 묻는 자리가 몇인가(오늘 그 대조를 세운 것은 트랙 A의
  세 원천 대조표 하나다 — 자동완성=통합 · 최근 칩=로컬 우선 + 서버 두 달 · 자동 분류=**서버 두 달**).
- ⚠️ **갱신 (2026-08-30 · 라운드 82) — 위 질문의 오늘의 답: 그 대조를 세운 자리는 셋이 됐다.** 라운드 81 A의
  **세 원천 대조표**(`auto-fill-wiring.test.ts`)에 둘이 더해졌다 — **트랙 B의 대장**
  (`apps/api/test/seed-data.test.ts`의 `ITEM_CODES_WITHOUT_PRODUCT_LINK` — *랭킹이 보는 집합*, 즉
  `calculateRecommendationScore`가 점수를 매기는 카탈로그 중 구매 경로가 0건인 것이 무엇인가를 **실측
  집합과 두 방향으로** 대조한다)과 **트랙 D의 대장**(`apps/mobile/src/query/home-payload-consumers.test.ts`
  — *화면이 보는 응답*, 즉 어느 화면이 `/home` 응답을 실제로 구독하고 첫 페인트에 무엇을 켜는가를 소스
  선언과 대조한다). ⚠️ **이 절은 그 수를 계약으로 만들지 않는다** — 셋은 오늘의 관측이고, *세는 방법*
  (무엇을 "그 술어가 보는 것을 묻는 자리"로 셀 것인가)을 정하는 것은 다음 라운드의 몫이다. 그것을 정하지
  않은 채 수만 적으면 그 수가 곧 V-3이 말한 산문형 전수가 된다.

### V-2. **값으로 적힌 보류는 살아남지만, 그 보류를 깨울 조건이 함께 적혀야 한다** — 22라운드 동안 열리지 않은 문과, 여섯 라운드 만에 열린 문

- **사실.** 라운드 58 E는 형제 둘의 원천을 넓히면서 자동 분류를 **명시적으로** 남겨 두고 그 이유를
  `new.tsx`에 적었다 — *"자동 분류는 후보를 제안하는 것이 아니라 사용자가 손대지 않은 타일을 **대신
  누르는** 판정이라, 원천을 넓히면 판정 자체가 달라진다 … 넓힐 근거가 설 때까지 이 화면의 저장 결과를
  바꾸지 않는 쪽을 고른다."* ⚠️ **좋은 보류였고, 22라운드 동안 아무도 그 근거를 재지 않았다.** 그 자리에
  이유가 **적혀 있었다는 사실 자체**가 재론을 막았다.
- ⚠️ **반대 사례가 같은 파일에 있다.** N-4는 기각을 적으며 재개 조건을 함께 적었다 — *"다시 제안하려면
  이 수치들이 달라졌다는 새 실측이 먼저 있어야 한다."* 라운드 77·78이 그 조건을 지켜 준비템 탭
  비가상화를 두 번 다시 재었고, 이번 라운드는 그 조건을 **다른 방향으로** 만족시켰다(수치가 달라진 것이
  아니라 **세지 않은 자리가 있었다** — V-3).
- **오늘의 값 — 라운드 58 E 유예의 오늘 답을 값으로 적는다.** 넓힌 축은 **성격이 같은 원천 한 달**이다:
  자동 분류가 받는 것은 서버가 확정한 행 **두 달치**(이번 달 캐시 + `getQueryData`로 읽은 지난달 캐시)
  이고, 라운드 58 E가 미룬 질문 둘 중 *"아직 안 올라간 로컬 행이 그 다툼에 끼는가"* 는 **여전히 별도
  결정**이라 오프라인 스냅숏(`suggestRows`)은 이 자리에 오지 않는다. ⚠️ **그 사실이 두 곳에 동시에
  산다** — `new.tsx`의 주석과, `auto-fill-wiring.test.ts`의 **부정 단언**(`suggestRows`가 자동 분류에
  넘어가면 빨개진다). **주석만 있으면 다음 라운드가 조용히 지나갈 수 있고, 단언만 있으면 왜 막는지가
  사라진다.**
- ⚠️ **낡는 것은 문서만이 아니다 — 소스 주석도 같이 낡는다.** 트랙 A가 머지된 뒤에도
  `category-suggestion.ts`의 머리말은 *"데이터 출처는 이미 받아 둔 서버 지출 캐시 **이번 달치**뿐"*
  이라고 적고 있었다(모듈 자신은 한 글자도 바뀌지 않았으므로 어떤 테스트도 빨개지지 않았다). 라운드
  중에 한 줄로 정정했다(`f666900` — 오늘 그 문단은 **두 달치**라고 적고 라운드 81 A가 메운 공백을 함께
  가리킨다). **판정을 값으로 적는 자리가 소스일 때, 그 값도 라운드가 지나면 낡는다.**
- **일반형.** **값으로 적힌 보류는 살아남지만, 그 보류를 깨울 조건이 함께 적혀야 한다.** 조건 없는
  보류는 *이유가 적혀 있다는 이유로* 재론되지 않는다 — 22라운드가 그 증거이고, N-4의 한 줄이 반대편
  증거다.

### V-3. **"전수 확인"이라고 적힌 산문은 여섯 라운드 만에 낡았다** — 전수는 코드로 남았을 때만 참으로 유지된다

- **사실.** N-4(라운드 73)의 N+1 census는 *"`for` 루프 안의 `await` 전수 확인. 항목 수에 비례하는
  유일한 자리는 `onboarding-core.service.ts`의 `setPreparedItems`인데 상한이 카탈로그 62건"* 이라고
  적었고, **이후 여섯 라운드가 그 축을 다시 세지 않았다.** 2026-08-30 재실측: 그 모양은 **열다섯**이고
  항목 수에 비례하는 자리는 **셋**이다 — `setPreparedItems`(카탈로그 62 · 그대로 문턱 아래) + **가져오기
  둘**.
- ⚠️⚠️ **빠졌던 둘의 상한은 62가 아니라 2,000이다(32배).** `import-pipeline.service.ts`의 미리보기
  생성이 **N + 3**문장(행마다 `importRow.create`), 확정이 **2N + 2**문장(행마다 `insertExpense`, 그
  안에서 행마다 `category.findUnique` — 시드 분류는 **12개**뿐이라 같은 인자가 반복되는 **교과서적
  N+1**이었다)이었고, **둘 다 옵션 없는 `$transaction`**(`PrismaService`에도 `transactionOptions` 0건 =
  Prisma 기본 5초) 안이었다. `importMaxRows = 2000`은 **예외 입력이 아니라 계약이 약속한 지원 범위의
  끝값**이다(AC-IMP-001 · `source-lock.md` IMPAPI-001 · QA 런북 QR-10 · 확인의 표 `#54`).
- **오늘의 값.** N-4의 **N+1 문단 하나만** 정정했다(그 절의 다른 판정 — 준비템 탭 비가상화의 기각과
  재개 트리거 둘 — 은 **바이트 불변**이다: 오늘도 카탈로그 62 / 한 밴드 62 미만이라 발동하지 않았다).
  ⚠️ **그리고 census 자체는 여전히 산문이다** — 이번 라운드가 코드로 남긴 것은 **왕복을 세는 계약**
  (V-4)이지 *"for 안 await"* 의 전수 스윕이 아니다. **그 사실을 값으로 적는다: 이 절의 수치도 다음
  라운드에 같은 방식으로 낡을 수 있다.**
- **일반형.** **전수라는 단어는 그 스윕이 코드로 남았을 때만 참으로 유지된다.** 산문으로 적힌 전수는
  그것을 읽은 사람이 *"이미 세어 봤다"* 고 믿게 만들어, **다시 세는 일 자체를 막는다.**
- ⚠️ **갱신 (2026-08-30 · 라운드 82) — census 재실측: 트랙 C **직전**의 모양은 **열여섯**이었고, 항목
  수에 비례하면서 인터랙티브 트랜잭션 **안**인 자리는 **하나**였다(`setPreparedItems`) — **트랙 C가
  그것을 닫았다.** 라운드 81 census가 센 열다섯에서 하나 늘어 열여섯이 됐고(라운드 81 E가 가져오기
  확정에 올린 누락 분류 확인 루프가 그 하나이고, 실패 경로에서만 도는 자리다), 그중
  `setPreparedItems`의 `upsert` 루프(문장 수 **N + 1**)가 배치 둘로 접혔다 —
  `updateMany` + `createMany({ skipDuplicates: true })`로 **문장 셋 고정**이고, 접을 수 있었던 근거는
  스키마의 `@@unique([childId, itemTemplateId])`가 upsert의 판정 키와 같은 칸이라는 사실이다.
  ⚠️ **라운드 82 리뷰 M-3 정정 — 오늘(머지 후) 실측은 열여섯이 아니라 열다섯이다**: 접힌 그 루프가
  `for` 안 `await`의 모양에서 **사라졌기 때문**이다(라운드 82 이전 16 → 오늘 15). 종전 이 문단은
  "모양은 열여섯"과 "남은 열여섯"을 같은 수로 적어 **접기 전과 접은 뒤가 같다고 말하는 자기모순**이
  었다. 남은 **열다섯**은 전부 **항목 수에 비례하지 않거나 인터랙티브 트랜잭션 밖**이다(워커 잡 ·
  스케줄러 · 재시도 루프 · 단계 코드 배치 · 동의 정의 순회).
  ⚠️⚠️ **그리고 이 절이 문턱의 근거로 적은 그 62는 계약이 아니라 시드 값이다**(W-3). *"상한이 카탈로그
  62건"* 이라고 적었을 때 62를 정하는 것은 코드가 아니라 어드민 화면이고
  (`items-catalog.service.ts`의 `adminCreateItemTemplate`), **그 수를 세는 자리는 저장소에 0건**이다.
  그래서 트랙 C가 준 상한(`PREPARED_ITEMS_TX_OPTIONS` — timeout 30초 · maxWait 10초 · 근거는
  `PURGE_TX_OPTIONS` 주석의 인용)은 62를 믿고 고른 값이 아니라 **62를 믿지 않기로 한 값**이다.
  ⚠️ N-4의 다른 판정(준비템 탭 비가상화의 기각과 재개 트리거 둘)은 이번에도 **바이트 불변**이고,
  census 자체는 **여전히 산문이다** — 이번 라운드가 코드로 남긴 것도 왕복을 세는 계약(V-4 갱신)이지
  *"for 안 await"* 의 전수 스윕이 아니다.
  ⚠️ **원복 (2026-08-30 · 라운드 83 리뷰 H-1) — 이 절과 W-3이 인용한 `$transaction` 자리 수
  "스물일곱"은 오늘도 맞다.** 라운드 83이 그것을 한 번 *"스물아홉"* 으로 정정했다가 같은 라운드의
  리뷰가 되돌렸다: 스물아홉은 grep이 센 **줄 수**이고 계약이 세는 것은 **호출 자리**다 — 차이 둘은
  주석 안의 `$transaction` **언급**(`household-runtime.service.ts` · `import-pipeline.service.ts`)이고,
  `transaction-bounds.test.ts`는 그 둘을 세지 않는다고 자기 머리말에 적은 뒤
  `household-runtime.service.ts`의 세 자리를 **이름으로 묻는 단언**으로 그 사실을 고정한다.
  ⚠️ **그 계약은 어느 쪽 수에도 빨개지지 않는다** — 무는 것이 자리 수가 아니라 *각 자리가 명시 상한을
  갖거나 이유와 함께 대장에 있는가*(양방향)이기 때문이다. **그래서 이 자리에서 낡은 것은 아무것도
  없었고, 낡은 줄 알고 고친 손이 맞던 사본을 틀리게 만들었다** — 그 일반형은 **X-4 ⓑ**다.
  ⚠️ 라운드 83의 어느 트랙도 `for` 안
  `await`의 census를 다시 돌리지 않았고(트랙 A·C가 연 `apps/api/**`는 `prisma/seed-data.ts`의 배열
  항목 다섯과 `src/admin/`의 카운트 한 칸이라 루프 0건), **N-4의 다른 판정은 이번에도 바이트 불변이다.**

### V-4. **이 저장소에 왕복을 세는 그물이 0건이었다** — 라운드 80의 라우트 표면과 같은 모양

- **사실.** 문구·토큰·env·역할·슬라이스·여정·라우트에는 전수 스윕이 있는데 **한 요청이 도는 문장 수를
  세는 자리가 `apps/api/test` 어디에도 없었다**(실측 0건). 라운드 80이 라우트 표면에 대해 발견한 것과
  **정확히 같은 모양**이다.
- **오늘의 값 — 그물의 첫 매듭.** `import-excel.e2e.test.ts`가 `PrismaService`를 **query 이벤트를
  내보내는 서브클래스**로 갈아 끼우고(Prisma 6에는 `$use` 미들웨어가 없다) 요청 하나가 내보낸 **SQL
  문장 수를 실측**한다. ⚠️⚠️ **단언이 수치를 손으로 적지 않는 것이 이 계약의 값이다** — 목표 문장 수를
  상수로 박으면 다음 라운드에 낡고, 낡은 줄은 계약이 아니라 유지비다(V-3이 바로 그 사례다). 그래서 두
  단언 다 **행 수 자신으로** 표현한다: ⓐ 400행 요청의 문장 수가 **400 미만**일 것 · ⓑ 행 수를 4배로
  늘려도 증가분이 **늘어난 행 수의 10분의 1 미만**일 것. **종전 소스에서는 둘 다 빨개진다.**
- ⚠️ **그 계약이 초록이 되도록 소스가 바뀐 값.** 미리보기의 행 삽입이 `tx.importRow.createMany` **한
  문장**이 됐고(저장소 관례가 이미 있다 — `analytics.service.ts`가 같은 이유로 같은 것을 쓴다), 확정은
  분류 존재 확인을 **이 배치의 유일 id 집합 한 번**으로 루프 밖에 올린 뒤 삽입을 `tx.expense.createMany`
  한 문장으로 모았다. **400행 기준 실측: 미리보기 411 → 12문장 · 확정 811 → 13문장.** 그리고 두
  `$transaction`에 **근거가 함께 적힌 명시 상한**이 붙었다(`IMPORT_TX_OPTIONS` — timeout **30초** ·
  maxWait **10초**. 파기 잡의 `PURGE_TX_OPTIONS`가 같은 이유로 고른 값이고, 그 주석이 근거의 원본이다).
  **기본값에 기대는 것을 그만두는 것이 이 항목의 본체다.**
- ⚠️ **바이트 불변을 값으로.** 없는 분류가 섞인 배치는 오늘도 **같은 코드·같은 문장·같은 400**
  (`EXPENSE_CATEGORY_INVALID`)이고 지출은 **0건** 생긴다 — 실패는 같은 트랜잭션의 롤백이라 결과가
  같다. `importMaxRows = 2000` · DNC-012(미리보기 승인 전 저장 금지) ·
  응답 DTO · 감사 봉투 · `insertExpense`의 본문과 시그니처는 **무접촉**이고, 마이그레이션·스키마·시드는
  **0건**이다.
- ⚠️⚠️ **정정 (2026-08-30 · 라운드 81 적대적 리뷰) — 위 문단이 종전에 적었던 *"던지는 시점만 앞당겨지고
  결과는 같다"* 는 그대로는 참이 아니다.** 순서는 실제로 바뀌었다: 종전에는 행 순서대로 `insertExpense`를
  돌았으므로 앞선 행의 품목명 문제(`EXPENSE_ITEM_NAME_REQUIRED`)가 뒤 행의 분류 문제보다 먼저 나갈 수
  있었고, 지금은 분류 확인이 배치 전체에 대해 먼저 돈다. **참인 것은 좁은 문장이다 — 오늘 도달 가능한
  입력에서는 같다.** 근거도 값이다: 확정이 넣는 행은 전부 `validationStatusForImportRow === "valid"`를
  통과한 행이라 품목명이 비어 있을 수 없고(`missing_item_name`이 먼저 걸린다) `categoryId`도 null일 수
  없다(`missing_category`) — 두 오류가 한 배치에서 경합하는 입력 자체가 만들어지지 않는다. **그 필터가
  느슨해지는 날 이 순서는 실제로 코드를 바꾼다**(서비스 주석이 같은 문장으로 좁혀졌다).
- ⚠️ **같은 리뷰가 배치 전환의 남은 셋을 닫았다.**
  - **누락 분류 전부를 확인한다.** 종전에는 **첫 누락 하나만** 단일 소스에 다시 물었는데, Prisma 인터랙티브
    트랜잭션의 기본 격리는 Read Committed라 그 재조회 사이에 그 분류가 만들어져 커밋되면 통과한다 — 그때
    나머지 누락은 확인되지 않은 채 INSERT로 흘러가고 결과는 400이 아니라 **FK 위반(500)**이었다. 이제 누락
    **전부**를 같은 단일 소스에 묻는다(실패 경로에서만 도는 왕복이라 문장 수 계약은 무접촉).
  - **`createMany`의 반환 count를 대조한다.** 미리보기는 `rows.length`와, 확정은 `importableRows.length`와
    대조해 다르면 던진다(같은 트랜잭션 롤백). 그리고 `importedCount`·감사 봉투에 실리는 값은 이제 **실제로
    들어간 count**다 — 종전에는 "넣으려던 수"를 사실처럼 적었다. ⚠️ 관례의 인용도 여기서 갈린다:
    `analytics.service.ts`는 `skipDuplicates`를 쓰기 **때문에** count를 일부러 보지 않는다(재전송 멱등).
  - **바인드 파라미터 천장이 계약으로 섰다.** 배치 한 문장의 파라미터 수는 `행 수 × 컬럼 수`이고 PostgreSQL
    프로토콜의 상한은 **65,535**다. 오늘의 값: 미리보기 2,000 × 13 = **26,000** · 확정 2,000 × 15 =
    **30,000**(15컬럼 기준 최대 **4,369행**). 컬럼 수를 손으로 적지 않고 **행을 만드는 두 함수의 키 수**를
    세므로(`buildImportRowCreateData` · `buildImportedExpenseCreateData`), 지출에 칸이 늘거나 `importMaxRows`가
    커져 곱이 상한에 닿는 날 `import-excel.e2e.test.ts`가 빨개진다.
  - ⚠️ **수치 정합 하나.** 그 스위트 머리말이 종전 소스의 문장 수를 **403/802**(트랜잭션 안의 비례분)로
    적어, 같은 사실을 두고 이 문서(**411/811** — 요청 전체 실측)와 다른 숫자를 말했다. 이제 머리말이 자기가
    세는 값이 요청 전체임을 밝히고 **411/811**로 적는다(차이 여덟·아홉이 행 수와 무관한 상수 오버헤드다).
- **일반형.** **아직 그물이 없던 축은 "한 요청이 무엇을 몇 번 하는가"였다.** ⚠️ **다음 라운드가 먼저
  세어 볼 만한 것**: 이 그물의 모집단은 오늘 **가져오기 한 경로**뿐이다 — 라운드 80이 대장에 대해 물은
  질문(*"모집단이 새 질문의 단위인가"*)을 이 그물에도 그대로 물어야 하는 날이 온다.
- ⚠️ **갱신 (2026-08-30 · 라운드 82) — 위 질문의 오늘의 답: 모집단이 **둘**이 됐고 하네스는 **한 벌**이다.**
  트랙 C가 계측을 스위트 밖으로 올려 `apps/api/test/helpers/query-statement-counter.ts` 한 벌로 만들었고
  (`QueryCountingPrismaService` + `attachQueryStatementCounter`), 이제 그것을 쓰는 경로가 둘이다 —
  **가져오기**(`import-excel.e2e.test.ts`)와 **준비템 저장**(`onboarding.e2e.test.ts`의 `POST
  /children/:childId/prepared-items`). ⚠️ **두 벌을 만들지 않은 것이 이 갱신의 본체다**: 하네스가 갈리면
  *"몇 문장인가"* 를 두 곳이 서로 다른 방법으로 답하게 되고, 그것이 라운드 80이 대장에 대해 물은 바로 그
  질문이 왕복 그물에 오는 모양이다. 규율도 그대로 상속됐다 — **손으로 적은 문장 수를 쓰지 않는다**:
  준비템 쪽 두 단언도 항목 수 자신으로 표현된다(ⓐ 문장 수가 항목 수보다 작을 것 · ⓑ 항목 수를 두 배로
  했을 때의 증가분이 늘어난 항목 수의 10분의 1 미만일 것 — 종전 소스에서는 둘 다 빨개진다).
  ⚠️⚠️ **그리고 이 라운드는 인접한 축 하나를 대장으로 세웠다 — `$transaction` 상한**
  (`apps/api/test/transaction-bounds.test.ts`). `apps/api/src`의 `$transaction` 호출 **스물일곱 자리**를
  주석·문자열을 건너뛰며 전수로 훑어, 각 자리가 **명시 상한을 갖거나 이유와 함께 대장에 있거나** 둘 중
  하나임을 묻는다(오늘 대장에 등재된 무상한 자리는 **열둘** — 배열형 · 고정 문장 수 · 로그인 경로처럼
  기본값이 옳은 자리들이다). ⚠️ **래칫이 아니라 양방향 대장이다** — 상한을 갖게 된 자리가 대장에 남아
  있어도 빨개진다. 자리 수 자체는 계약이 아니라 관측이라 **파일이 그 수를 손으로 적지 않는다.**

### V-5. **성능의 부채는 클라이언트가 아니라 서버에 있었다** — 문턱을 넘은 유일한 자리는 행 수에 비례하는 트랜잭션 둘

- **사실(실측 후보 0건).** 성능 축을 클라이언트에서 먼저 재었고 **후보가 0건이었다**.
  - **기록 탭**: `SectionList` + 모듈 스코프 `renderRecordsRow`/`recordsRowKey` + `memo` 행 둘 + 헤더
    memo이고, `listData`의 `useMemo` 의존 다섯이 **전부 안정된 참조**다. **PERF-102 이후 이 화면에
    재계산 후보가 없다.**
  - **홈**: 쿼리 여섯이 규율대로다 — 지난달 두 쿼리는 첫 페인트 이후로 미뤄지고(`isFetched` 게이트),
    `lastMonthBudget`은 *"이번 달 예산이 실제로 없다"* 가 확인된 뒤에만 켜진다. **줄일 왕복 0건.**
  - **준비템 탭 비가상화**: **4라운드 연속 문턱 아래**(N-4의 트리거 둘 — 카탈로그 **200건** · 한 밴드
    표시 행 **100** — 에 대해 오늘 값은 **62 / 62 미만**). `PreparationListParity`의 `useMemo` 둘이 부모
    렌더마다 다시 도는 것도 재었고 **같은 문턱을 공유한다**(그 위를 도는 것은 `filter` 두 벌이고 N은
    62 미만이다 — 자식이 내부 상태로 다시 그리는 경로에서는 memo가 정상 동작한다).
  - **목록 조회의 N+1**: 0건이다 — `items-catalog.service.ts`의 조회 경로는 전부 `findMany` 배치이고,
    준비템 탭이 쓰는 요청은 `tab="all"` 하나다.
- **오늘의 값.** 문턱을 실제로 넘은 유일한 자리는 **행 수에 비례하는 트랜잭션 둘**이었다(V-3·V-4).
  ⚠️ **이 사실을 값으로 적는 이유는 다음 라운드가 같은 곳을 다시 파지 않게 하기 위해서다** — 성능을
  물을 때 화면부터 여는 것이 이 저장소에서는 대개 헛수고다.
- **일반형.** **이 저장소의 렌더 규율은 이미 좋고, 재어 볼 값이 남은 곳은 DB 왕복이다.** ⚠️ 그리고 그
  둘은 발견되는 방식도 다르다 — 렌더의 부채는 **화면을 열면 보이고**, 왕복의 부채는 **세는 그물이
  있어야만 보인다**(V-4가 그 첫 자리다).

## W. 라운드 82에서 확정한 판정 (2026-08-30 · GAP-082 트랙 F)

라운드 81이 물은 것이 **판정이 무엇을 보는가** 였다면, 라운드 82의 물음은 그 한 칸 옆이다 —
**그 판정이 옆 갈래에서는 아예 돌지 않는다.** 축은 라운드 81과 같이 **사용자 가치**였고(핵심 루프의
빈 자리 · 서버 견고성 · 성능/정직성), 다섯 판정 다 K~V절과 같이 **결함 보고가 아니라 다음 결정의
입력**이며 2026-08-30 소스에서 확인됐다(라운드 82 트랙 A·B·C·D 머지 후).

⚠️⚠️ **이번 라운드의 가장 값진 관측: 이 저장소는 *지금 보고 있는 갈래*를 아주 잘 지키고, *옆 갈래*는
덜 지킨다.** 네 트랙이 전부 *"형제는 있는데 셋째가 없다"* 의 모양이었다 — 월간에는 인사이트 문장이
있고 분기·연간에는 없었고(A), 58개 품목에는 구매 링크가 있고 넷에는 없었고(B), 가져오기 트랜잭션
둘에는 상한과 배치가 있고 준비템 저장에는 없었고(C), 홈은 넓은 원천을 1순위로 쓰는데 리포트·더보기는
좁은 원천을 기다렸다(D). **넷 다 규칙을 고친 것이 아니라 규칙이 닿지 않던 갈래를 규칙 안으로 들인
것이다**(W-1).

⚠️⚠️ **두 번째 관측: 예외 목록의 형식이 그 목록의 수명을 정한다**(W-2). 이름 일곱을 적어 둔 면제
목록은 그 일곱 중 셋이 이미 조건을 만족하는데도 초록이었고, 그래서 **실제 공백 넷이 보이지 않았다.**
같은 저장소의 반대 사례가 라운드 73 E의 두 방향 제외 목록이다 — 형식 하나가 갈랐다.

⚠️⚠️ **세 번째 관측: 문턱의 근거가 시드 값이었다**(W-3). V-3이 `setPreparedItems`를 문턱 아래로 둔
근거는 *"상한이 카탈로그 62건"* 인데, **62를 정하는 것은 코드가 아니라 어드민 화면**이고 그 수를 세는
자리가 0건이다. N-4가 재개 트리거로 적은 *"카탈로그 200건"* 도 같은 성질의 수다.

⚠️⚠️ **네 번째 관측: 그물이 0건인 축이 아니라 *하나*인 축이 둘 있었다**(W-4). 라운드 80은 라우트
표면에서, 81은 왕복에서 *"이 축에는 그물이 0건"* 을 찾았다. 오늘 찾은 것은 0건이 아니라 **1**이고,
둘 다 이 저장소가 스스로 남겨 둔 다음 질문이었다(V-4의 마지막 줄이 그중 하나다).

⚠️⚠️ **다섯 번째 관측: 이번에도 가장 값싼 발굴은 저장소 자신의 문장이었는데, 방향이 반대였다**(W-5).
라운드 81은 저장소가 *"이것이 문제다"* 라고 적어 둔 자리에서 셋을 찾았다. 오늘 넷 중 셋은 저장소가
**"이것은 문제가 아니다"** 라고 적어 둔 주석에서 나왔다.

⚠️⚠️ **이월 다섯은 전부 보류 유지이고 재실측 값만 갱신했다 — 갱신 한 줄씩은 그 판정이 사는 절에 있다**
(다음 라운드가 같은 실측을 다시 돌리지 않도록 여기서는 자리만 가리킨다).

- **이 스캐너가 쿼리로 분류한 열한 자리의 낭독** — 재실측 **11**, A-20 #85 선행 → **U절 머리말**.
- **`monthly_wrapup`의 달 이동 구멍** — 게이트가 읽는 것은 여전히 대기 행의 바뀐 뒤 날짜 하나 → **U-3**.
- **`/budget` 겹침 착지** — `URL_OVERLAPS` 여전히 **둘**, 확인의 표 `#133` 대기 → **U-5**.
- **S-3(어드민 `disabled`)** — 재실측 **열하나**(items 6 · links 5), 브라우저 확인 `#130` 선행 → **U절 머리말**.
- **`withdrawn_at`** — 저장소 전체 **3건 · 파일 둘**, 컬럼 신설은 여전히 별도 결정 → **U절 머리말**.

**다섯 다 2026-08-30 재실측이고 상태 변화 0이며, 이번 라운드의 어느 트랙도 그 자리들을 쓰기로 열지
않았다**(⚠️ 트랙 B·C가 `apps/api/**`를 열었지만 **마이그레이션·스키마 0건**이라 `withdrawn_at`과 접점이
없고, 트랙 A·D가 연 화면 둘은 `QUERY_TRIGGER_SITES_BY_SCREEN`의 여섯 화면 **밖**이다).

⚠️⚠️ **이번 라운드가 실측하고 기각한 셋을 값으로 남긴다 — 재개 조건과 함께**(V-2가 세운 규율: 조건
없는 보류는 이유가 적혀 있다는 이유로 재론되지 않는다).

- **`getHome`의 카탈로그 전량 읽기 — 재었고 제안하지 않는다.** `recommendedItemsForChild`는 활성
  카탈로그 **62행** + 그 아이의 상태 행 전량을 읽어 **셋**으로 자른다. PERF-121이 지출에 대해 한 것
  (*"전 행 로드 후 JS 집계 → DB 집계 + LIMIT"*)을 여기에 하려면 정렬을 SQL로 내려야 하는데, **그 정렬은
  `packages/domain/src/recommendation.ts`의 점수다** — SQL로 내리는 순간 **채점기가 두 벌이 되고**, 그것은
  DNC-009(추천 점수에 수수료율 반영 금지)를 지키는 부정 단언이 겨누는 바로 그 구조다. 문장 수는 이미
  상수(**3**)라 V-4의 그물에도 걸리지 않는다 — 비례하는 것은 **행 수뿐**이다. ⚠️ **재개 조건은 N-4의
  트리거와 *같은 값*이다: 활성 카탈로그 200건.** 그 조건이 도래하면 먼저 물을 것은 "SQL로 내릴까"가
  아니라 **"채점기를 한 벌로 유지하면서 자를 방법이 있는가"** 다.
- **리포트 `previousMonth`를 트렌드 응답으로 대체하는 것 — 재었고 제안하지 않는다.**
  `monthlyTrend`의 `months[4]`가 이미 지난달 총액이고 서버가 두 값의 동치를 e2e로 물고 있어(REP-128)
  기술적으로는 가능하다. 그러나 `previousMonth`의 캐시 키는 `["report","monthly",childId,지난달]`로
  **월간 카드와 같은 키**라, 없애면 [◀] 한 칸 이동이 오늘의 **즉시 렌더**에서 새 요청으로 바뀐다.
  **확실한 캐시 온기를 잃고 첫 페인트 요청 하나를 얻는 교환이라 기각한다**(라운드 67 A#6이 분기에서
  반대 방향으로 내린 그 교환의 거울이다). ⚠️ **재개 조건**: 기간 이동이 오늘의 즉시 렌더를 잃지 않는
  다른 방법이 서거나(예: 트렌드 응답이 월간 카드의 키를 함께 채우는 배선), 첫 페인트 요청 수가 실측으로
  문제가 되는 날.
- **준비템 상세의 판매처가 언제나 한 줄인 것 — 관측이지 결함이 아니다.** 시드 링크가 품목에 **1:1**로
  붙어 있어 링크가 둘 이상인 품목이 **0건**이다. 그래서 라운드 64 #1이 세운 *"전폭 CTA는 비스폰서
  1순위를 연다"* 판정과 DNC-011의 스폰서 시각 구분은 **오늘 시드에서 거의 실행되지 않는다**(유일한
  예외가 `stroller` — 하나뿐인 링크가 스폰서라 전폭 CTA가 아예 서지 않는 그 경로다). ⚠️ **코드의 결함이
  아니라 카탈로그의 폭이고, 트랙 B가 더한 링크 넷도 1:1을 깨지 않는다**(넷 다 링크 0건이던 품목에
  하나씩 붙었다). **재개 조건: 한 품목에 링크가 둘 이상인 시드가 생기는 날** — 그때 비로소 그 두 판정이
  실행되고, 그 실행을 확인할 자리는 이 표가 아니라 접근성 표와 확인의 표다.
  ⚠️⚠️ **정정 (2026-08-30 · 라운드 83) — *"유일한 예외가 `stroller`"* 는 하나가 아니라 다섯이었고,
  이 문단이 적어 둔 재개 조건은 트랙 A로 도래했다.** ⓐ **수의 정정**: 당시 시드에서 *하나뿐인 링크가
  스폰서라 전폭 CTA가 아예 서지 않는* 품목은 `stroller` 하나가 아니라
  **다섯**(`wipes_bulk`·`stroller`·`pregnancy_diary`·`push_walker`·`kids_bicycle`)이었다 — 같은 사실을
  같은 라운드의 소스 주석(`app/items/[itemTemplateId].tsx`)은 **다섯**으로 정확히 적고 있었다(X-4 ⓐ).
  ⓑ **범위의 정정**: 그래서 *"그 두 판정(라운드 64 #1의 비스폰서 1순위 · DNC-011의 스폰서 시각 구분)이
  오늘 시드에서 거의 실행되지 않는다"* 는 **다섯 배 넓은 사실**이었다 — 실행되지 않은 것이 아니라
  **다섯 품목에서 전폭 CTA가 서지 않는 쪽으로 실행되고 있었다.** ⓒ **재개 조건의 도래**: 라운드 83
  트랙 A가 그 다섯에 일반 링크 다섯을 더해 **한 품목에 링크가 둘 이상인 시드가 다섯 생겼다**(활성 링크
  62 → **67** · 링크 둘 이상인 품목 0 → **다섯**). 즉 이 문단이 *"그때 비로소"* 라고 적은 그날이
  오늘이고, **판매처 1:1은 더 이상 이 시드의 사실이 아니다.** ⓓ **이 문단이 지시한 확인의 이행**:
  그 실행을 확인할 자리로 이 문단이 지목한 둘에 각각 오늘 항목이 섰다 — 접근성 표 **A-24 #94**
  (다섯 품목 상세에서 채워진 판매처 행과 외곽선 행이 TalkBack에서 **스폰서 구분과 함께** 읽히는가) ·
  확인의 표 **#143**(표면 `서버`). ⚠️ **판정 자체(*"코드의 결함이 아니라 카탈로그의 폭이다"*)는 그대로
  참이고, 낡은 것은 그 판정이 인용한 수치와 그 수치가 정한 범위였다** — 폭이 넓어진 것도 오늘
  카탈로그가 한 일이다(**품목 수는 62로 한 칸도 변하지 않았다**). ⚠️ **판매처 1:1을 카탈로그 폭으로
  넓히는 축은 영구 기각 유지다**(트랙 A가 연 것은 스폰서 유일 링크 다섯의 **강조**이지 링크 수의
  일반적 확대가 아니다).

⚠️⚠️ **알림 도달의 측정값을 보류로 남긴다 — 셋 다 게이트가 다르고, 그 게이트는 코드가 아니다.**
인앱 알림 **종류는 일곱**인데 —

- ⓐ **그것을 평가해 만드는 자리는 하나다**(`useHomeNotificationEvaluation`을 부르는
  `app/(tabs)/index.tsx`). 게이트는 **U절이 세운 규율**(*"평가는 홈 하나"*)이고 라운드 81 P3에서 보류된
  그대로다 — 평가를 두 번째 화면에 얹는 것은 같은 스냅샷을 두 표면이 보게 만드는 결정이라 U-3이 다룬
  축과 정면으로 만난다.
- ⓑ **벨과 미읽음 배지가 서는 자리도 하나다**(`NotificationBell`의 사용처가 `index.tsx` 둘 — 같은 화면).
  게이트는 **승인 디자인의 헤더 슬롯**이다: 다른 탭 헤더에 벨을 세우는 것은 이식본의 렌더를 여는 일이라
  **디자인 승인이 선행**이다(D의 "매칭 사유 표시"와 같은 취급 — V-1).
- ⓒ **서버 푸시가 덮는 종류는 둘이다**(`push-dispatch.service.ts`의 `budget_80`·`budget_100`).
  게이트는 **영구 기각**이다 — 서버 알림 층은 라운드 62~81이 이월 목록에 값으로 적어 둔 그 항목이고,
  이번 라운드도 상태 변화 0이다.

**즉 홈 탭을 열지 않는 세션에는 알림 층이 통째로 없다.** ⚠️ **그 사실은 결함 보고가 아니라 측정값이다** —
셋의 게이트가 각각 규율 · 디자인 승인 · 영구 기각이라 **코드가 답할 자리가 아니고**, 그래서 이번 라운드는
값만 남기고 아무 자리도 열지 않았다(알림 층 · 홈 카드 구성 **무접촉**).

**이 라운드가 짝 문서에 남긴 것.** 확인의 표에 **#139~#142**(⚠️ **넷 중 둘이 `서버`다** — 트랙 B의 시드
링크와 트랙 C의 문장 수는 **실 PostgreSQL에서 재현되고 폰이 등장하지 않는다**. 나머지 둘이 `실기기`)가
서고 §0의 여섯 숫자가 파싱으로 다시 세어졌으며(실기기 120 → **122** · 서버 6 → **8** · 합계 138 →
**142**), 접근성 표에는 **A-23 #92·#93**(둘 다 코드가 답할 수 없는 절반을 기기로 넘긴다)이 섰다.
⚠️ **C-3(잠금 오버레이 TalkBack 투과)은 오늘로 열여섯 라운드 연속 미확인**이고, 이 절이 그것에 대해
적을 수 있는 것은 경과 수뿐이다 — 남은 것은 사람·기기·날짜 배정이다.

### W-1. **갈래를 늘릴 때 계약은 "새 갈래가 옳은가"를 묻고 "그 갈래가 존재하는가"는 묻지 않는다** — 네 트랙 전부 형제는 있고 셋째가 없는 모양이었다

- **사실.** 네 자리의 모양이 같았다 — **규칙은 옳았고, 그 규칙이 한 갈래에서만 돌고 있었다.**
  - **A.** 리포트 탭의 인사이트 카드(승인 캡처 REP-001의 구획 ⑤)가 `period === "월간"` 게이트 **하나로
    카드 전체**를 껐다. 그래서 [분기]를 누르면 총액·도넛·추이는 바뀌는데 방금까지 있던 한 줄이 사라졌다 —
    **화면이 더 넓은 기간을 보여 주면서 말은 덜 했다.** 그 게이트가 원래 막으려던 것은 **예산 문장**
    이었는데(*"분기·연간에는 합친 예산이라는 것이 존재하지 않는다"*), 그 하나의 이유가 카드 전체의
    이유가 돼 있었다(W-5의 셋 중 하나).
  - **B.** 시드 62개 품목 중 58개에 구매 링크가 있고 **넷에 0건**이었다. 그 넷 중 둘
    (`pregnancy_vitamin`·`diaper_stock`)이 `essential`이라 도메인 점수로 재면 자기 시기 *"지금 필요"*
    목록의 **머리**에 선다 — 즉 온보딩을 막 마친 사용자에게 앱이 처음 내미는 추천 카드가 구매 경로
    0건이었고, **핵심 루프 4단계가 1순위에서 시작되지 않았다.**
  - **C.** 행 수에 비례하는 인터랙티브 트랜잭션 셋 중 **가져오기 둘**은 라운드 81 E에서 배치와 명시
    상한을 받았고 **준비템 저장 하나**가 그대로 남았다(`upsert` 루프 = 문장 수 **N + 1** · Prisma 기본
    5초). 그 화면은 온보딩의 마지막에서 둘째라(ONB-003) 실패한 사용자는 **고른 항목을 전부 버리지 않는
    한 홈에 도달하지 못한다** — 라운드 72 A가 만든 로컬 탈출구는 **체크가 0건일 때만** 열리므로,
    항목을 실제로 고른 사람일수록 막힌다.
  - **D.** `/home` 응답을 구독하는 화면이 **셋**이었는데 뒤의 둘(리포트·더보기)은 그 응답에서 `child`
    밖의 필드를 **하나도** 읽지 않았다. 그리고 그 `child`는 두 화면이 이미 켜 둔 `["children"]` 행의
    **진부분집합**이다(서버가 두 응답의 아이를 같은 `toChildDto`로 만든다). **넓은 원천을 이미 손에
    들고 좁은 원천을 기다리고 있었다.**
- **오늘의 값.** 넷 다 **새 갈래를 만든 것이 아니라 있던 규칙의 모집단을 넓혔다**.
  A는 순수 모듈 하나(`src/reports/period-insight.ts`)를 세워 **도넛에 넘어가는 그 조각 배열 그대로**를
  받는다 — `computeCategoryShares`(범례와 같은 함수·같은 최대잔여법)를 지나므로 **반올림 규칙의 두 번째
  벌이 생기지 않고**, 새 요청·새 캐시 키·새 집계가 **0건**이다. B는 링크 0건 넷에 **일반 링크**
  (`isAffiliate: false` · `isSponsored: false` · `disclosureText: null`) 넷을 더했다. C는 `upsert` 루프를
  `updateMany` + `createMany({ skipDuplicates: true })` 둘로 접었다(문장 **셋 고정**). D는 프로필 카드가
  `childId`로 `["children"]`에서 행을 찾게 해 **이름 · 단계 · 판정 재료가 같은 한 행**에서 오게 했다.
- ⚠️ **판정 규칙은 넷 다 무변경이다.** A의 월간 문장은 `monthly-insight.ts` 하나가 그대로 소유하고
  (새 모듈의 `unit`이 `"quarter" | "year"` 뿐인 것이 그 규율의 타입 표현이다), **없는 값은 여전히 말하지
  않는다** — 분기·연간에는 예산 문장도 비교 문장도 공유 버튼도 서지 않고 근거가 없으면 카드 자체가 없다
  (DNC-018과 월간의 `null` 규율 그대로). B의 넷은 **DNC-010 고지 문장도 DNC-011 스폰서 배지도 한 줄
  늘리지 않는다**(고지 판정은 링크 **집합**에서 나오고 넷 다 비제휴·비스폰서다) — 추천 점수
  (`calculateRecommendationScore`)도 링크 수를 보지 않으므로 **순서가 한 칸도 바뀌지 않는다**(DNC-009).
  C는 `updatedCount`의 의미(라운드 45 UX-Y)·`active` 유효 판정(라운드 46 Q-1)·`gifted`를 덮는 성질이
  **한 글자도 움직이지 않았고**, 그것을 세는 동치 계약이 배치 계약과 나란히 선다.
  ⚠️ **라운드 82 리뷰 L-11 — C의 동치는 "단일 요청 기준"이다**(주장을 그만큼 좁혀 적는다):
  `updateMany` → `createMany({ skipDuplicates: true })` **사이**에 다른 트랜잭션이 같은
  `(childId, itemTemplateId)` 행을 **새로 만들어 커밋하면** 그 한 항목은 종전 upsert(단일
  `INSERT ... ON CONFLICT DO UPDATE`)와 달리 덮이지 않는다. 그 창까지 닫는 방법은 알려져 있고
  (`createMany` 뒤에 `updateMany` 한 번 더 — 문장 넷 고정), 채택하지 않은 이유는 그 창에서 살아남는
  값이 사용자가 방금 직접 누른 더 구체적인 상태라는 판단과, 문장 셋을 인용하는 문서 넷이다
  (근거는 `setPreparedItems` 주석). D는 라운드 49 QA(P2-3)의
  규율이 **약해지지 않고 강해졌다** — 목록에서 `childId`로 찾으므로 아이를 모르는 창에서는 행이 아예 없고
  종전처럼 `loadingProfile`("...")이 그려진다. **남의 이름이 그려질 자리가 구조적으로 없다.**
- ⚠️ **비세션 미리보기는 넷 다 무접촉이다** — A는 게이트 위쪽(월간 렌더)이 바이트 불변이고, D의
  `!authToken → previewProfile` 경로는 **한 노드도 바뀌지 않았다**(SET-001 픽셀락).
- **일반형.** **갈래를 늘릴 때 계약은 대개 *새 갈래가 옳은가*를 묻고 *그 갈래가 존재하는가*는 묻지
  않는다.** 라운드 81의 V-1이 *"판정은 옳은데 그 판정이 본 것이 틀렸다"* 였다면 이것은 한 칸 옆이다 —
  **그 판정이 옆 갈래에서는 아예 돌지 않는다.** ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 세그먼트·탭·
  등급처럼 **갈래가 있는 표면** 중 계약이 *모든 갈래에 대해* 같은 질문을 하는 자리가 몇인가(오늘 그렇게
  선 것은 트랙 B의 대장 하나다 — 그 계약은 `essential` 전량에 **예외 없이** 같은 질문을 한다).
- ⚠️ **갱신 (2026-08-30 · 라운드 83) — 그 "예외 없이 같은 질문"이 화면의 질문과 달랐다.** 위 문장이
  본보기로 든 트랙 B의 대장·단언은 *"링크 ≥1"* 을 물었는데 상세 화면의 강조 판정은 *"비스폰서 링크
  ≥1"* 을 묻는다 — 두 질문의 답이 갈리는 품목이 **다섯**이었고 계약은 초록이었다. **모든 갈래에 같은
  질문을 하는 것과 화면과 같은 질문을 하는 것은 다른 성질이다**(판정 **X-1** · 라운드 83 트랙 A가
  같은 형식의 대장을 하나 더 세워 닫았다).

### W-2. **이름으로 적은 예외는 값으로 적은 예외보다 빨리 낡는다** — 일곱 중 셋이 이미 조건을 만족하는데도 초록이었다

- **사실.** `apps/api/test/seed-data.test.ts`의 `LEGACY_ITEM_CODES_WITHOUT_LINK_REQUIREMENT`는 품목
  **이름 일곱**이었고, *"링크 ≥1"* 규칙에서 그 일곱을 면제했다. 그 목록이 진 문제는 셋이다.
  1. **실측과 어긋났다.** 일곱 중 **셋**(`car_seat`·`baby_bath`·`stroller`)은 이미 링크가 있었다.
     목록이 세는 것은 *"링크가 없는 품목"* 이 아니라 **"언젠가 링크가 없던 품목의 이름"** 이었다.
  2. **래칫이 없었다.** 새 품목이 링크 없이 들어와도 **이름 한 줄만 더하면 초록**이었다.
  3. ⚠️ **그래서 실제 공백이 보이지 않았다.** 링크 0건 넷 중 둘이 `essential`이었고(W-1의 B),
     이 파일은 초록이었으며, **그 초록의 이유가 "그 품목의 이름이 여기 적혀 있어서"였다.**
- ⚠️ **같은 저장소에 반대 사례가 있다.** `src/offline/offline-aware-screens.ts`의
  `OFFLINE_AWARE_LOAD_ERROR_EXEMPT_SCREENS`는 **두 방향**을 진다(라운드 73 E) — 여기 있으면 배선 목록에
  없어야 하고, 실제로 그 훅을 부르지 않아야 한다. **같은 "예외 목록"인데 형식 하나가 수명을 갈랐다.**
- **오늘의 값 — 이름 목록을 측정 대장 + 래칫으로 바꿨다.** `ITEM_CODES_WITHOUT_PRODUCT_LINK`는 키가
  **링크 0건 품목의 집합**이고 값이 **그 이유**다. 세 계약이 그것을 문다 — ① 대장의 키 집합이 **실측한**
  링크 0건 집합과 **두 방향으로** 같다(대장에 없는데 0건이어도, 대장에 있는데 링크가 생겨도 빨개진다),
  ② 각 항목에 **빈 문자열이 아닌 이유**가 있다, ③ 대장의 크기가 오늘 값을 **넘을 수 없다**(래칫).
  ⚠️ **오늘 그 대장은 비어 있고 래칫은 0이다 — 지워서 빈 것이 아니라 재서 빈 것이다**(트랙 B가 링크 0건
  넷에 일반 링크 넷을 더해 62개 품목이 전부 링크를 갖는다). 다시 하나라도 비면 ①이 먼저 빨개지고, 그것을
  대장에 적어 면제하려 하면 ③이 그다음에 빨개진다.
- ⚠️ **이름 일곱은 지우지 않았다 — 계약을 뒤집었다.** 지우면 다음 라운드가 같은 넷을 "새 결함"으로 다시
  줍고 **면제가 있었다는 사실도 함께 없어진다.** 그래서 그 배열이 지금 지는 계약은 면제가 아니라 그
  반대다: *"일곱이 **전부** 링크를 갖는다"* — **예외 목록의 은퇴 증서**이고, no-op이 되지 않도록 일곱이
  실재하는 품목 코드인지도 함께 묻는다.
- ⚠️ **여기에 더해진 계약 하나가 W-1의 일반형을 값으로 만든다**: *"`essential` 품목은 예외 없이 링크
  ≥1"*. **예외 목록이 아예 없는 형식**이라, 다음에 `essential` 품목이 링크 없이 들어오면 이름을 적어
  빠져나갈 문이 없다(그 단언은 라운드 82 이전 시드에서 **둘**로 빨갰다).
- **일반형.** **예외 목록은 그것이 *측정된 집합과 같다*는 단언을 함께 지고 있을 때만 계약이고, 아니면
  면제부다.** 이름은 사람이 적고 집합은 코드가 잰다 — 둘이 어긋나는 순간을 **아무도 보지 못하는 것**이
  이름 목록의 성질이다. ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소의 예외·제외 목록 중 두 방향
  대조를 지지 않는 것이 몇인가(오늘 두 방향을 지는 것으로 확인된 것은 라운드 73 E의 오프라인 제외 목록 ·
  트랙 B의 링크 대장 · 트랙 C의 `$transaction` 상한 대장 · 트랙 D의 `/home` 구독 대장이다).
- ⚠️ **갱신 (2026-08-30 · 라운드 84) — 그 질문을 전수로 실측했고 답은 *0건*이다(트랙이 되지 않았다).**
  이름 규칙으로 모집단을 만들어(예외·제외·대장 꼴의 선언 상수에서 상수·파생 수치를 뺀 전수) 하나씩
  돌면 **대장 → 실재/이유의 반대 방향 단언이 없는 것은 0건**이다. ⚠️ **그래도 사각 둘을 값으로 남기고,
  둘 다 오늘 값이 0건이라 조용할 뿐이다**: ⓐ **저장 제외 목록은 파일의 실재를 묻지 않는다**(조회 쪽
  어드민 대장들은 `existsSync`를 함께 문다 — 오늘 그 목록이 비어 있어 증상이 없다 · 재개 조건: 그
  목록에 첫 줄이 서는 날), ⓑ **어느 스윕도 *"걷는 뿌리 ∪ 제외 뿌리 = 실제 뿌리 전수"* 를 묻지
  않는다**(오늘 실제 뿌리가 전부 목록 안이라 빨개질 줄이 0건 · 재개 조건: 새 소스 뿌리가 생기는 날).
  ⚠️ **이 절의 판정이 경고한 그 성질은 여기서도 그대로다** — *"0건"* 은 *"괜찮다"* 가 아니라 *"오늘 값이
  0이다"* 이고, 그래서 둘 다 **재개 조건과 함께** 기각했다(판정 **Y-2** · 기각 목록은 Y절 머리말).

### W-3. **문턱을 시드 값으로 세우면 그 문턱은 코드 리뷰가 아니라 운영이 넘긴다** — 62를 정하는 것은 계약이 아니라 어드민 화면이었다

- **사실.** V-3의 N+1 census는 `setPreparedItems`를 문턱 아래로 두면서 근거를 *"상한이 카탈로그 62건"*
  이라고 적었다. ⚠️ **그런데 62는 계약이 아니라 오늘의 시드 값이다** — 그 자리의 N을 정하는 것은
  `itemTemplate.findMany({ active: true })`이고, 그 표를 늘리는 것은 어드민 화면
  (`items-catalog.service.ts`의 `adminCreateItemTemplate`)이다. **그리고 그 수를 세는 자리가 저장소에
  0건이다.** N-4가 준비템 탭 비가상화의 재개 트리거로 적은 *"카탈로그 200건"* 도 정확히 같은 성질의
  수다 — **코드 밖의 사람이 넘길 수 있고, 넘어가도 아무것도 빨개지지 않는다.**
- ⚠️ **그래서 이 문턱은 조용히 넘어간다.** 카탈로그가 자란 다음 날 준비물 화면에서 여든 개를 체크한
  사용자는 여든한 문장을 **Prisma 기본 5초** 예산 안에서 직렬로 돌리게 되고, 넘기면 P2028 롤백이다.
  코드 리뷰가 그 순간을 보지 못하는 이유는 **그날 아무 코드도 바뀌지 않기 때문**이다.
- **오늘의 값 — 문턱을 믿는 대신 둘을 세웠다.** ⓐ **일감을 비례에서 떼어 냈다**(W-1의 C — 문장 셋
  고정). ⓑ **기본값에 기대는 것을 그만뒀다**: `PREPARED_ITEMS_TX_OPTIONS`(timeout **30초** · maxWait
  **10초**)는 새로 발명한 값이 아니라 **인용**이다 — 근거의 원본은 파기 잡의 `PURGE_TX_OPTIONS` 주석이고
  가져오기의 `IMPORT_TX_OPTIONS`가 이미 그것을 인용했다. ⚠️ **상한을 준 이유는 62를 믿어서가 아니라
  62를 믿지 않기로 해서다.**
- ⚠️ **그리고 그 판단을 저장소 전체에 물었다** — `apps/api/test/transaction-bounds.test.ts`가
  `apps/api/src`의 `$transaction` **스물일곱 자리**를 전수로 훑어 *"명시 상한을 갖거나 이유와 함께 대장에
  있거나"* 를 묻는다. **새 자리가 생기면 둘 다 아니므로 빨개지고**, 그때 재는 사람이 이유 한 줄을 적거나
  상한을 준다. ⚠️ **그 대장의 크기는 고정하지 않는다**(상한이 필요 없는 트랜잭션은 실제로 있다 — 배열형 ·
  고정 문장 수 · 로그인 경로) — 대신 **양방향**으로 잠가 상한을 갖게 된 자리가 대장에 남아 있어도
  빨개진다. **자리의 이름을 줄 번호가 아니라 `파일#순번` + 감싼 메서드로 부르는 것**이 그 대장의 두 번째
  규율이다(위쪽 한 줄만 늘어도 대장 전체가 낡는 것을 막는다).
  ⚠️ **원복 (2026-08-30 · 라운드 83 리뷰 H-1) — 위 "스물일곱 자리"는 오늘도 맞다.** 라운드 83이 grep
  줄 수를 자리 수로 읽어 *"스물아홉"* 으로 정정했다가 같은 라운드의 리뷰가 되돌렸다(차이 둘은 주석
  안의 언급이고, `transaction-bounds.test.ts`가 그 둘을 이름으로 제외해 고정한다 — V-3의 같은 줄).
  ⚠️ **그때도 그 계약은 초록이었다 — 수를 세지 않기 때문이다**(자리 목록을 자기가 만들고, 각 자리가
  *명시 상한* 또는 *이유가 적힌 대장* 둘 중 하나에 속하는지를 양방향으로만 문다). **여기 옮겨 적힌
  수가 계약 밖의 사본이라는 성질은 그대로이고**, 이번에 드러난 것은 그 사본이 **낡을 때만이 아니라
  고쳐질 때도** 틀릴 수 있다는 것이다 — 그 성질을 일반형으로 적은 것이 **X-4**다.
- ⚠️ **남은 공백을 값으로 적는다: 카탈로그의 크기를 세는 자리는 오늘도 0건이다.** 이 라운드가 한 일은
  *"그 수가 커져도 이 트랜잭션은 견딘다"* 를 만든 것이지 **그 수가 커진 것을 알려 주는 자리를 만든 것이
  아니다.** N-4의 재개 트리거(카탈로그 200 · 한 밴드 100)도 여전히 **사람이 손으로 재는 수**다.
  ⚠️ **갱신 (2026-08-30 · 라운드 83) — 이 공백은 오늘 닫혔다**(완료도 값으로 적혀야 사라진다 — U절
  머리말): 트랙 C가 어드민 요약에 활성 준비템 카운트 한 칸(`count` 한 방)과 대시보드 카드 하나를 세워
  **앞의 수를 세는 자리가 생겼다**. ⚠️ **뒤의 하나(한 밴드)는 관계 필드 부재로 기각했고 재개 조건은
  X절 머리말에 값으로 있다.** ⚠️ **이 절은 그 수를 옮겨 적지 않는다**(O-3 — 세는 것은 화면이다).
  판정은 **X-5**.
- **일반형.** **문턱을 시드 값으로 세우면 그 문턱은 코드 리뷰가 아니라 운영이 넘는다.** 판정이 기대는
  수가 코드 밖에서 정해진다면 그 판정에는 **수를 세는 자리**가 함께 있어야 하고, 없다면 그 판정의 결론은
  *"오늘은 괜찮다"* 까지다. ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 문서와 소스가 문턱의 근거로
  인용하는 수 중 **시드·설정처럼 코드 밖에서 정해지는 것이 몇인가**(오늘 확인된 둘이 카탈로그 62와
  재개 트리거 200이고, 둘 다 같은 표가 정한다).
- ⚠️ **갱신 (2026-08-30 · 라운드 84) — 그 질문을 전수로 실측했고 이 축에 새 후보는 0건이다(트랙이
  되지 않았다).** 오늘 코드 밖에서 정해지는 문턱은 넷이고, **세는 자리가 있는 것은 라운드 83 C의
  어드민 카드가 세는 하나**이며 나머지는 **문서가 정한 수**라 문서를 읽는 계약이 대조하거나
  (`catalog-size-view.test.ts`) 계약이 **관계**(대장·래칫)만 문다. 곁가지로 하나 더 재었는데
  (어드민 사용자 조회의 *"users가 커지면 인덱스가 필요하다"*) ⚠️ **그 수를 세는 자리는 이미 있다**
  (대시보드의 활성 사용자 수). ⚠️ **문턱 인용 대장을 새로 세우는 것은 기각했다 — 그 대장 자신이 다시
  사본이 되기 때문이다**(X-4). **재개 조건: 세는 자리가 없는 문턱이 하나 더 생기는 날**(판정 **Y-2** ·
  기각은 Y절 머리말에 값으로). ⚠️ **이 절은 그 수들을 옮겨 적지 않는다**(세는 것은 화면과 계약이다).

### W-4. **첫 매듭을 만든 그물은 다음 라운드에 모집단을 물어야 한다** — 오늘 모집단이 하나인 그물이 둘이었다

- **사실.** 라운드 80은 라우트 표면에서, 81은 왕복에서 *"이 축에는 그물이 0건"* 을 찾았다. 오늘 찾은
  것은 **0건이 아니라 1**이고, 둘 다 그 그물을 만든 라운드가 **스스로 적어 둔 다음 질문**이었다.
  - ⓐ **첫 페인트 요청 구성.** 계약은 `src/home/home-cold-start-defer.test.ts` **하나**였고 모집단이
    **화면 하나**(홈)였다. 그래서 리포트 탭이 여덟 개의 요청으로 첫 페인트를 여는 것도, 더보기가
    `/home`을 기다리느라 프로필 카드만 `"..."` 인 것도 **아무 계약도 묻지 않았다.**
  - ⓑ **한 요청의 문장 수.** 계약은 `import-excel.e2e.test.ts` **하나**였고 모집단이 **경로 하나**
    (가져오기)였다 — **V-4가 자기 마지막 줄에 적어 둔 그 질문이다.**
- **오늘의 값.** ⓐ 트랙 D가 **화면별 첫 페인트 요청 구성**을 대장으로 세웠다
  (`src/query/home-payload-consumers.test.ts`의 `FIRST_PAINT_QUERY_LEDGER` — 홈 · 리포트 · 더보기 **셋**).
  ⚠️ **수치를 손으로 적지 않는 것이 그 대장의 규율이다**: 각 화면의 쿼리 이름 · 키 · `enabled` 식이 소스
  선언과 대조되고(쿼리가 하나 늘면 **대장이 먼저 빨개진다**), 첫 페인트 수는 그 목록에서 **센다**.
  단언도 값이 아니라 **종전과의 대소**로 적힌다(리포트가 여덟보다 작을 것 · 더보기가 둘보다 작을 것).
  ⓑ 트랙 C가 문장 수 계측을 스위트 밖으로 올려 **하네스 한 벌**로 만들고
  (`test/helpers/query-statement-counter.ts`) 두 번째 경로(준비템 저장)를 그 모집단에 넣었다.
- ⚠️ **`/home` 쪽에는 그물이 하나 더 섰다 — 구독 자체의 대장.** 그 응답을 **부르거나 켜는** `app/**`
  화면 집합이 대장과 정확히 같아야 하고(오늘 **홈 하나**), **구독하지 않으면서 그 키를 만지는** 자리는
  이유와 함께 등재돼야 한다(무효화 · 캐시 읽기 · 주석 — 그 세 얼굴이 아닌 줄이 하나라도 있으면
  빨개진다). ⚠️ **두 방향인 이유는 라운드 74 D가 겪은 사각 때문이다** — 한 방향만 있으면 새 화면이
  변수명을 달리해 구독을 되살려도 두 목록이 일치한 채 통과한다. 그리고 **목록을 늘리는 것 자체는 금지가
  아니다**: 늘리려면 이유가 함께 들어와야 하고 그 이유는 *"그 응답의 `child` 밖 필드를 읽는다"* 여야 한다
  (`child` 네 칸만 필요하다면 그것은 이미 켜 둔 `["children"]`의 진부분집합이라 근거가 되지 못한다).
- ⚠️ **모집단이 넓어진 만큼 새 질문도 생겼다 — 그것을 값으로 적는다.** ⓐ의 대장은 오늘 **세 화면**뿐이고
  (기록 탭 · 준비템 탭 · 지출 화면은 밖에 있다), ⓑ의 모집단은 **두 경로**뿐이다. **둘 다 "전수"가
  아니라 "오늘 잰 것"이고**, 그 사실을 적지 않으면 다음 라운드가 이 문단을 V-3이 말한 산문형 전수로
  읽는다.
- **일반형.** **첫 매듭을 만든 그물은 다음 라운드에 *모집단*을 물어야 하고, 묻지 않으면 그물이 아니라 그
  한 자리의 회귀 테스트로 굳는다.** ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 첫 페인트 대장에 들어와야
  할 화면이 몇인가(모집단을 "탭 다섯"으로 할지 "`app/**` 전수"로 할지가 그 답을 정한다 — 그리고 그것이
  라운드 80이 대장에 대해, 81이 census에 대해, 오늘 C가 하네스에 대해 물은 같은 질문이다).
- ⚠️⚠️ **갱신 (2026-08-30 · 라운드 83) — 이 절이 남긴 모집단 질문 넷에 대한 오늘의 답: 하나만
  넓혔고 셋은 재개 조건과 함께 기각했다**(이행판의 판정은 **X-2**이고, 기각 셋의 재개 조건은 X절
  머리말에 값으로 있다).
  ⓐ **첫 페인트 대장 — 넓혔다. 모집단은 `app/(tabs)`의 탭 다섯이다**(기록 탭·준비템 탭 편입 · 대장의
  화면 집합이 탭 전수와 같은지를 계약이 스스로 센다). ⚠️ **`app/**` 전수는 기각**이다 — 탭 밖 화면은
  이 대장의 기준 프레임(*세션 있음 · 아이 정해짐 · 콜드 스타트 첫 렌더*)이 성립하지 않고 실측 최대가
  **셋**이다. **재개 조건: 탭 밖 화면 하나가 첫 페인트에 넷 이상을 켜는 날.** ⚠️ **넓히자마자 답이
  나왔다**: 대장 밖이던 기록 탭이 홈이 명시적으로 미룬 그 쿼리를 미루지 않아 첫 페인트가 넷이었고,
  트랙 B가 같은 defer 규율을 얹어 **넷 → 셋**이 됐다(단언은 값이 아니라 종전과의 대소다).
  ⓑ **문장 수 하네스 — 오늘 넓힐 자리 0건.** 셋째 후보는 하나뿐인데 **배열형 `$transaction` · CSV
  500행 상한 · 어드민 단발 작업** 셋을 동시에 만족해 사용자가 기다리는 요청이 아니다.
  **재개 조건: 사용자 요청 경로에 입력 비례 쓰기가 하나 더 생기는 날.**
  ⓒ **`$transaction` 상한 대장 — 모집단은 이미 맞다**(계약이 `apps/api/src` 전수를 자기가 세고,
  저장소의 다른 `$transaction`은 `prisma/`·`scripts/`에 0건이다). **넓힐 자리 0건이고 오늘 한 것은
  W-3의 인용 수치 정정 한 줄뿐이다**(X-4).
  ⓓ **원천 대조 셋 — 오늘 넓힐 자리 0건 · 상태 변화 0.**

### W-5. **값으로 적힌 "괜찮다"는 값으로 적힌 "문제다"보다 오래 검토되지 않는다** — 넷 중 셋이 "이것은 문제가 아니다"라고 적힌 주석에서 나왔다

- **사실.** 라운드 81은 저장소가 *"이것이 문제다"* 라고 적어 둔 자리에서 셋을 찾았다(V절 머리말).
  오늘 넷 중 셋은 방향이 반대였다 — 저장소가 **"이것은 문제가 아니다"** 라고 적어 둔 주석이 출발점이다.
  - **`app/items/[itemTemplateId].tsx`의 구매처 0건 주석.** *"시드 62개 품목 중 4개(영양제·기저귀 재고·
    이유식 메이커·첫 그림책)가 링크 0개다"* — 그리고 그 문장이 하는 일은 **그 화면이 죽은 CTA와 헛
    고지를 그리지 않는 이유를 대는 것**이었다(DNC-010의 은닉이 아니라 고지 대상 부재라는 판정 — 옳다).
    ⚠️ **그 넷이 무엇인지 · 어디에 서는지는 아무도 세지 않았다.** 그 넷 중 둘이 `essential`이고 추천
    카드의 머리에 선다는 사실은 **주석이 사실을 정확히 적어 둔 채로** 여섯 라운드 넘게 조용했다(트랙 B).
  - **`app/(tabs)/reports.tsx`의 예산 문장 주석.** *"분기·연간에는 합친 예산이라는 것이 존재하지
    않는다"* — 옳은 판정이고 지금도 옳다. ⚠️ **그런데 그 하나의 이유가 카드 전체의 게이트가 됐다**
    (트랙 A).
  - **`app/(tabs)/more.tsx`의 원천 주석.** *"`HomeSummary.child`에는 `stageMode`가 없어 `["children"]`을
    쓴다"* — 사실이고, 그 화면은 실제로 넓은 원천을 이미 켜 두고 있었다. ⚠️ **그런데 이름은 계속 좁은
    원천에서 왔다**(트랙 D).
- ⚠️ **셋의 공통점은 "주석이 틀렸다"가 아니다 — 셋 다 참이었다.** 공통점은 **그 문장이 답한 질문의 범위**
  다. 각 주석은 *"이 자리에서 이렇게 하는 것이 옳은가"* 에 답했고, 아무도 *"그 사실이 다른 자리에서도
  같은 뜻인가"* 를 묻지 않았다. **"문제다"라고 적힌 문장은 누군가 고치러 오지만, "문제가 아니다"라고
  적힌 문장은 그 자체가 재론을 닫는다** — V-2가 라운드 58 E의 보류에서 발견한 것과 같은 성질이고,
  여기서는 그것이 **기각이 아니라 관측의 형태**로 나타났다.
- **오늘의 값.** 셋 다 주석을 **지우지 않았다** — 셋 다 그 자리의 판정으로는 오늘도 참이기 때문이다.
  ⚠️ **라운드 82 리뷰 M-4 정정 — 그중 하나는 *수치*가 이미 낡아 있었다.** 구매처 0건 주석의
  *"넷이 링크 0개다"* 는 **트랙 B가 그 넷을 채운 뒤** 거짓이 됐는데(같은 라운드 안에서), 그 주석은
  트랙 B의 손이 닿지 않는 파일에 있어 그대로 남았다 — *"셋 다 오늘도 참"* 이라고 적은 이 문단이
  그 사실을 덮었다. 이제 그 주석은 `link-marker.ts:97`과 **같은 방식**(당시 수치 + 라운드 82 B
  이후 수치)으로 두 시점을 함께 적고, 그 분기가 왜 여전히 죽은 코드가 아닌지(어드민 비활성화 ·
  운영 데이터)도 함께 적는다. **판정은 그대로 참이고, 낡은 것은 그 판정이 인용한 수치였다.** 대신 각 주석이 답하지
  않은 절반을 **다른 형식으로** 세웠다: 구매처 0건은 **대장 + 래칫**으로(W-2), 예산 문장은 새 모듈의
  *"말하지 않는 것"* 목록으로(예산 문장 없음 · 비교 문장 없음 · 공유 문구 없음 · 월간 문장 없음 —
  **각각 왜 없는지가 함께 적혀 있다**), 원천은 **구독 대장**으로(W-4).
- **일반형.** **값으로 적힌 *괜찮다*는 값으로 적힌 *문제다*보다 오래 검토되지 않는다.** 그래서 *"이것은
  문제가 아니다"* 라고 적을 때는 **그 판단이 참인 범위**를 함께 적는 편이 낫다 — V-2가 보류에 대해 요구한
  *"깨울 조건"* 의 관측판이다. ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소의 *"문제가 아니다"*
  주석 중 **범위가 함께 적힌 것이 몇인가**(오늘 셋을 열었고, 셋 다 열기 전에는 범위가 없었다).
- ⚠️ **갱신 (2026-08-30 · 라운드 84) — 그 질문을 제품 소스 전수로 실측했고, 답은 *전부가 범위를 진다*
  (범위 없는 것 0건)이다. 트랙이 되지 않았다.** ⚠️ **그리고 그것이 이 판정의 값이다** — 라운드 82가
  셋에 붙인 그 규율이 **나머지에도 이미 있었고**, 세어 보기 전에는 그 사실을 알 수 없었다.
  **재개 조건: 범위 없는 *"문제가 아니다"* 가 새로 생기는 날**(그날 이 문단이 그 자리를 가리킨다 ·
  판정 **Y-2** — *"답이 아니오인 질문을 세는 비용은 낮다"* 의 다섯 사례 중 하나가 이 줄이다).

## X. 라운드 83에서 확정한 판정 (2026-08-30 · GAP-083 트랙 F)

라운드 82가 물은 것이 **그 판정이 옆 갈래에서는 아예 돌지 않는다** 였다면, 라운드 83의 물음은 그 한 칸
안쪽이다 — **갈래를 규칙 안으로 들였는데 그 규칙이 화면과 같은 것을 묻지 않았다.** 축은 라운드 81·82와
같이 **사용자 가치**였고(핵심 루프의 막힌 자리 · 첫 페인트 · 캐시 정직성 · 운영이 넘는 문턱), 다섯 판정
다 K~W절과 같이 **결함 보고가 아니라 다음 결정의 입력**이며 2026-08-30 소스에서 확인됐다
(라운드 83 트랙 A·B·C·D 머지 후).

⚠️⚠️ **이번 라운드의 가장 값진 관측: 규칙이 화면과 같은 술어를 쓰지 않으면 그 규칙은 갈래를 덮은 것이
아니라 *센* 것이다**(X-1). 라운드 82 B가 세운 계약은 *"링크 ≥1"* 을 물었고 상세 화면이 묻는 것은
*"비스폰서 링크 ≥1"* 이었다. 두 질문의 답이 갈리는 품목이 **다섯** 있었고, 그 다섯 화면에서는 이 앱이
핵심 루프 4단계를 여는 **가장 큰 버튼이 아예 서지 않았는데 계약은 초록이었다.** **W-1이 "그 갈래가
존재하는가를 묻지 않는다"였다면 이것은 "그 질문이 화면의 질문과 같은가를 묻지 않는다"이다.**

⚠️⚠️ **두 번째 관측: 모집단 질문의 값은 "넓힌다"가 아니라 "넓힐지를 값으로 답한다"에 있다**(X-2).
W-4가 남긴 모집단 질문은 **넷**이었고, 오늘 넓힌 것은 **하나**(첫 페인트 대장 → 탭 다섯)뿐이다.
나머지 셋은 **재개 조건과 함께 기각**했고, **그 기각도 답이다** — 답하지 않은 질문만 다음 라운드에
같은 값으로 다시 선다.

⚠️⚠️ **세 번째 관측: 기본값이 관대하면 규율의 구멍이 증상을 내지 않는다**(X-3). `["children"]`을 바꾸는
쓰기 경로 전수에서 **한 자리만** 성공 뒤 무효화가 0건이었는데, **전역 기본 30초가 그것을 덮고 있었다.**
그 구멍은 결함으로 신고되지 않는다 — **기본값을 바꾸려는 사람이 처음 만난다.**

⚠️⚠️ **네 번째 관측: 값을 세는 계약이 있는 축에서도 문서에 옮겨 적힌 그 값은 계약 밖의 사본이다**(X-4).
같은 사실을 **소스는 다섯**으로, **W절은 하나**로 적고 있었다. **계약은 초록이었다** — 계약이 무는 것이
그 수가 아니기 때문이다. 라운드 74 O-3이 이름 붙인 병의 세 번째 재발이고, 이번에는 **계약이 있는 축에서**
났다. ⚠️ **그리고 이 라운드의 리뷰가 같은 관측의 뒷면을 보탰다**: 사본을 **고치는 손**도 계약 밖이라,
W-3의 `$transaction` 자리 수를 "정정"한 한 줄이 **맞던 수를 틀린 수로** 바꿨다(리뷰 H-1이 원복 · X-4 ⓑ).

⚠️⚠️ **다섯 번째 관측: "다음 라운드가 세어 볼 것"으로 적힌 문장은 실제로 세어질 때만 값이다**(X-5).
W-3이 *"남은 공백"* 이라고 **정확히** 적어 둔 자리(카탈로그의 크기를 세는 자리 0건)가 한 라운드를 그대로
지났고, 같은 절의 다른 수는 바로 그 한 라운드에 낡았다. 오늘 트랙 C가 그 공백을 닫았다 — **닫은 것은
문장이 아니라 카드 하나다.**

⚠️⚠️ **이월 다섯은 전부 보류 유지이고 재실측 값만 갱신했다 — 갱신 한 줄씩은 그 판정이 사는 절에 있다**
(다음 라운드가 같은 실측을 다시 돌리지 않도록 여기서는 자리만 가리킨다).

- **이 스캐너가 쿼리로 분류한 열한 자리의 낭독** — 재실측 **11**, A-20 #85 선행 → **U절 머리말**.
- **`monthly_wrapup`의 달 이동 구멍** — 게이트가 읽는 것은 여전히 대기 행의 바뀐 뒤 날짜 하나 → **U-3**.
- **`/budget` 겹침 착지** — `URL_OVERLAPS` 여전히 **둘**, 확인의 표 `#133` 대기 → **U-5**.
- **S-3(어드민 `disabled`)** — 재실측 **열하나**(items 6 · links 5), 브라우저 확인 `#130` 선행 → **U절 머리말**.
- **`withdrawn_at`** — 저장소 전체 **3건 · 파일 둘**, 컬럼 신설은 여전히 별도 결정 → **U절 머리말**.

**다섯 다 2026-08-30 재실측이고 상태 변화 0이며, 이번 라운드의 어느 트랙도 그 자리들을 쓰기로 열지
않았다**(⚠️ 트랙 A·C가 `apps/api/**`를 열었지만 **마이그레이션·스키마 0건**이라 `withdrawn_at`과 접점이
없고 — A는 `prisma/seed-data.ts`의 배열 항목 다섯, C는 `src/admin/`의 카운트 한 칸 — 트랙 B·D가 연
화면 셋은 `QUERY_TRIGGER_SITES_BY_SCREEN`의 여섯 화면 **밖**이다. 트랙 C가 `apps/admin/**`를 열었지만
S-3의 `disabled={readOnly}` 열한 자리는 `app/items/page.tsx`·`app/links/page.tsx`이고 C가 연 것은
`app/page.tsx`와 `src/lib/`라 **접점 0건**이다).

⚠️⚠️ **이번 라운드가 실측하고 기각한 여섯을 값으로 남긴다 — 전부 재개 조건과 함께**(V-2가 세운 규율:
조건 없는 보류는 이유가 적혀 있다는 이유로 재론되지 않는다).

- **첫 페인트 대장을 `app/**` 전수로 넓히는 것 — 재었고 제안하지 않는다.** 탭 밖 화면은 사용자가
  목적을 갖고 들어가는 자리라 대장의 기준 프레임(*세션 있음 · 아이 정해짐 · 콜드 스타트 첫 렌더*)이
  성립하지 않고, `FIRST_PAINT_FRAME`이 화면마다 새 이름의 값을 요구해 **유지비가 값보다 커진다.**
  실측상 탭 밖 최대는 **셋**이다(`app/expenses/[expenseId].tsx` — expense · categories · children ·
  `household-members`는 이미 미룬다). ⚠️ **재개 조건: 탭 밖 화면 하나가 첫 페인트에 넷 이상을 켜는 날.**
- **문장 수 하네스에 세 번째 모집단을 만드는 것 — 재었고 제안하지 않는다.**
  `test/helpers/query-statement-counter.ts`를 쓰는 스위트는 **둘**(가져오기 · 준비템 저장)이고, 셋째
  후보로 남은 것은 `POST /admin/product-links/bulk-apply` **하나**인데 그 자리는 ⓐ **배열형
  `$transaction`** 이라 인터랙티브 상한 밖이고(상한 대장에 이유와 함께 있다), ⓑ 입력이 **CSV 500행으로
  잘려 있으며**(`BULK_CSV_MAX_ROWS`), ⓒ **어드민 단발 작업**이라 사용자가 화면 앞에서 기다리는 요청이
  아니다. ⚠️ **재개 조건: 사용자 요청 경로에 입력 비례 쓰기가 하나 더 생기는 날.**
- **워커 잡별 시간 예산 — 재었고 제안하지 않는다.** 잡 **일곱**이 `SchedulerService.tick()`에서 순차로
  돌고 각 잡에 try/catch + 구조화 로그 + 상태 기록이 있으며, 겹침은 `running` 플래그가 막고
  `/health/worker`가 `stale`(3× 간격)과 `degraded`(연속 실패 3회)를 둘 다 낸다. ⚠️ **다만 잡별 시간
  예산은 0건이고, `link-health`의 최악은 기본 틱 간격의 열 배쯤이다** — 그때 `stale`은 *"루프가
  멈췄다"* 가 아니라 *"한 틱이 길다"* 를 가리킨다. 세우지 않는 이유 셋: 그 잡은 **옵트인**(기본 꺼짐)
  이고, 개별 링크 실패가 잡을 죽이지 않으며, 예산을 주는 것은 *"검사 수를 줄인다"* 는 **운영 결정**
  이지 코드가 혼자 정할 값이 아니다. ⚠️ **재개 조건: 링크 헬스를 실제로 켜는 날 — 그날 먼저 정할
  것은 타임아웃이 아니라 배치 크기다.**
- **리포트 탭의 첫 페인트를 더 줄이는 것 — 재었고 제안하지 않는다.** 후보는 `cumulative`(구획 ⑥ ·
  화면 아래쪽)인데 그 응답은 **기간 칩과 무관한 전 기간 값**이라 미루면 얻는 것은 첫 페인트 하나이고
  잃는 것은 그 카드의 즉시 렌더다. 게다가 **그 쿼리의 `isError`가 화면 전체의 조회 실패 카드 판정에
  들어간다** — 미루면 **실패를 늦게 말하게 된다.** ⚠️ **재개 조건: 리포트의 첫 페인트가 실측으로
  문제가 되는 날**(대장이 그 수를 이미 세고 있으므로 근거는 그때 대장에서 나온다).
- **`ItemTemplateStage`의 밴드별 카운트 — 관계 필드 부재로 이번에 세지 않는다.** 그 모델에는
  `ItemTemplate` 관계 필드가 없어 `where: { itemTemplate: { active: true } }`를 쓸 수 없고, 우회하면
  **활성 id 전량을 먼저 읽는 비례 조회**이거나 **원시 SQL**이다 — 둘 다 그 서비스가 스스로 적어 둔
  규율(카운트 한 방 · 행 스캔 없음) 밖이다. ⚠️ **재개 조건: 그 관계 필드가 생기는 날**(마이그레이션
  0건 원칙상 별도 결정) **또는 활성 카탈로그 카운트가 N-4의 문턱을 넘는 날.**
- **`PURCHASE_FOLLOWUP_MERCHANT_LABELS`가 오늘 시드에서 한 번도 실행되지 않는다 — 관측이지 결함이
  아니다.** 판매처 프리필 라벨은 `coupang`·`naver`에만 있는데 시드 링크가 **전부 `platform: "custom"`**
  이라 실세션에서 그 라벨은 언제나 `undefined`이고, 그 모듈의 규율대로 **모르면 지어내지 않아** 빈
  칸이 된다. ⚠️ **재개 조건: 실제 파트너 링크가 들어오는 날**(외부 계정·키가 선행이라 이 저장소의
  제외 목록에 있는 축이다).

**이 라운드가 짝 문서에 남긴 것.** 확인의 표에 **#143~#146**(⚠️ **넷의 표면이 셋으로 갈린다** —
트랙 A의 시드 링크는 `서버`, 트랙 C의 어드민 카드는 `브라우저`, 트랙 B·D의 화면 동작은 `실기기`다)이
서고 §0의 여섯 숫자가 파싱으로 다시 세어졌으며(실기기 122 → **124** · 브라우저 11 → **12** ·
서버 8 → **9** · 합계 142 → **146**), 접근성 표에는 **A-24 #94·#95**(둘 다 코드가 답할 수 없는 절반을
기기로 넘긴다)가 섰다. ⚠️ **C-3(잠금 오버레이 TalkBack 투과)은 오늘로 열일곱 라운드 연속 미확인**이고,
이 절이 그것에 대해 적을 수 있는 것은 경과 수뿐이다 — 남은 것은 사람·기기·날짜 배정이다.

### X-1. **갈래를 규칙 안으로 들일 때 규칙이 화면과 같은 술어를 쓰지 않으면 그 규칙은 갈래를 덮은 것이 아니라 센 것이다** — *"링크 ≥1"* 과 *"비스폰서 링크 ≥1"* 사이에 다섯 품목이 있었고 계약은 초록이었다

- **사실.** 라운드 82 B가 링크 0건 넷을 채우고 세운 계약 둘은 **링크의 개수**를 물었다 —
  대장(`ITEM_CODES_WITHOUT_PRODUCT_LINK`)의 키가 *"링크가 0건인 품목"* 이고, 예외 없는 단언이
  *"`essential` 품목은 링크 ≥1"* 이다. ⚠️ **그런데 상세 화면의 판정은 그 질문을 하지 않는다.**
  `src/items/link-marker.ts`의 `primaryPurchaseLinkIndex`는
  `links.findIndex((link) => !link.isSponsored)`이고 **전부 스폰서면 `-1`** 인데, 그 `-1` 하나가
  `app/items/[itemTemplateId].tsx`의 **판매처 행 채움**(`filledPurchaseRowIndex`)과 **전폭 구매
  CTA**(`primaryPurchaseLink`)를 **동시에** 끈다. **화면이 묻는 것은 "비스폰서 링크가 있는가"다.**
- ⚠️⚠️ **두 질문의 답이 갈리는 품목이 라운드 82 시드에 다섯 있었다** —
  `wipes_bulk`·`stroller`·`pregnancy_diary`·`push_walker`·`kids_bicycle`. 다섯 다 링크가 **정확히
  하나**이고 그 하나가 **스폰서**라, 개수를 세는 계약은 다섯 전부에 대해 **초록**이었고 그동안 그
  다섯 상세에서는 **핵심 루프 4단계를 여는 가장 큰 버튼이 서지 않았다.** ⚠️ 그중
  `wipes_bulk`는 **카탈로그가 스스로 `essential`이라고 부르는 품목**이라, 예외 없는 그 단언조차
  같은 자리를 지나가고 있었다.
- ⚠️ **화면의 판정은 옳다 — 고칠 것이 아니다.** 전부 스폰서일 때 전폭 CTA를 렌더하지 않는 것은
  라운드 64 #1이 DNC-011의 시각 구분을 지키려고 세운 규율이고(광고를 광고라고 말한 자리에서만
  누르게 한다), 그 링크는 스폰서 배지와 캡션과 함께 판매처 행에 그대로 서 있다. **없던 것은 구매
  경로가 아니라 강조였고, 없던 것을 세는 자리가 계약에 없었다.**
- **오늘의 값 — 대장을 지우지 않고 같은 형식으로 하나 더 세웠다.**
  ⓐ 트랙 A가 그 다섯에 **일반 링크 다섯**(`isAffiliate: false` · `isSponsored: false` ·
  `disclosureText: null`)을 더했다 — 활성 링크 **62 → 67**, 그중 일반이 **38 → 43**이고 **스폰서
  링크는 한 건도 지우지 않았다**(다섯 그대로).
  ⓑ 두 번째 대장 `ITEM_CODES_WITHOUT_NON_SPONSORED_LINK`는 키가 **활성 비스폰서 링크가 0건인
  품목**이고 값이 그 이유이며, 무는 계약도 W-2와 같은 셋이다(두 방향 대조 · 빈 문자열이 아닌 이유 ·
  래칫). ⚠️ **오늘 그 대장은 비어 있고 래칫은 0이다 — 지워서 빈 것이 아니라 재서 빈 것이고, 라운드
  82 시드에서는 그 줄이 다섯으로 빨갛다.**
  ⓒ 여기에 *"`essential` 품목은 예외 없이 **비스폰서** 링크 ≥1"* 과 **랭커 파생**(각 시기 *"지금
  필요"* 최고점 무리에 비스폰서 0건 품목이 없다)이 함께 선다 — **화면이 실제로 세우는 순서에서**
  같은 질문을 한다.
  ⓓ ⚠️ **첫 대장은 지우지 않았다**: 둘은 **다른 질문**이고, 지우면 다음 라운드가 링크 0건을 새
  결함으로 다시 줍는다(W-2가 이름 일곱에 대해 내린 그 판단의 반복이다).
- ⚠️ **DNC 셋은 한 줄도 늘거나 줄지 않았다.** 새 다섯이 전부 비제휴·비스폰서라 **DNC-010 고지
  문장도 DNC-011 스폰서 배지도 새로 서지 않고**(고지 판정은 링크 **집합**에서 나온다), 추천 점수는
  링크 수를 보지 않으므로 **순서가 한 칸도 바뀌지 않는다**(DNC-009). ITEM-002 픽셀락 경로는 index 0이
  원래 비스폰서라 **한 픽셀도 달라지지 않는다.**
- **일반형.** **갈래를 규칙 안으로 들일 때 그 규칙이 화면과 같은 술어를 쓰지 않으면, 그 규칙은
  갈래를 덮은 것이 아니라 *센* 것이다.** W-1이 *"그 갈래가 존재하는가를 묻지 않는다"* 였다면 이것은
  한 칸 안쪽이다 — **그 질문이 화면의 질문과 같은가를 묻지 않는다.** ⚠️ **다음 라운드가 먼저 세어 볼
  만한 것**: 이 저장소의 대장·래칫 중 **화면의 술어를 그대로 쓰지 않는 것이 몇인가**(오늘 하나를
  찾았고, 그 하나는 같은 라운드가 세운 계약이었다).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 라운드 84 **Y-1**이 답했다 — 그리고 답이 나온 자리는 대장·래칫이 아니라 **운영자 도구**였다.
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 그 축은 라운드 85 **Z-3**이 한 번 더 이어받았고(같은 질문의 둘째 이행), 라운드 86 **AA-2**가 *술어*가 아니라 *도달 경로*로 한 칸 넓혔다.
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### X-2. **모집단 질문의 값은 "넓힌다"가 아니라 "넓힐지를 값으로 답한다"에 있다** — 넷 중 하나만 넓혔고 셋은 재개 조건과 함께 기각했다

- **사실.** W-4가 남긴 모집단 질문은 **넷**이었다 — ⓐ 첫 페인트 대장(오늘 **세 화면**) · ⓑ 문장 수
  하네스(오늘 **두 경로**) · ⓒ `$transaction` 상한 대장 · ⓓ 원천 대조 셋. **그 넷에 오늘 답한다.**
- **오늘의 값 — 넓힌 것은 하나다.** ⓐ 트랙 B가 첫 페인트 대장의 모집단을 **`app/(tabs)`의 탭
  다섯**으로 정했다(기록 탭 · 준비템 탭 편입). ⚠️ **모집단을 넓히자마자 결함 하나가 드러났다** —
  대장 밖이던 기록 탭이 **홈이 명시적으로 미룬 바로 그 쿼리를 미루지 않아** 첫 페인트가 넷이었고,
  그중 둘이 **달 전량 커서 루프**였다. 트랙 B가 홈과 같은 defer 규율(`expenses.isFetched` 게이트)을
  한 표현식으로 얹어 **넷 → 셋**이 됐고, 단언은 값이 아니라 **종전과의 대소**로 적힌다. **이것이
  W-4가 말한 *"그물이 아니라 그 한 자리의 회귀 테스트로 굳는다"* 의 실물이다** — 모집단이 답을
  만들었지 새 계약이 답을 만든 것이 아니다.
- **셋은 기각했고, 기각도 답이다**(각각의 재개 조건은 이 절 머리말에 값으로 있다).
  ⓑ 하네스의 세 번째 모집단 — 남은 후보 하나가 **배열형 `$transaction` · CSV 500행 상한 · 어드민
  단발 작업** 셋을 동시에 만족해 **사용자가 기다리는 요청이 아니다.**
  ⓒ 상한 대장 — **모집단은 이미 맞다**: 그 계약은 `apps/api/src` 전수를 **자기가 세고** 자리 수를
  손으로 적지 않으며, 저장소의 다른 `$transaction`은 `prisma/`·`scripts/`에 **0건**이다. **넓힐
  자리가 0건이라 오늘 한 일은 정정 한 줄뿐이다**(X-4).
  ⓓ 원천 대조 셋 — 오늘 넓힐 자리 **0건**이고 상태 변화도 0이다.
- ⚠️ **`app/**` 전수를 고르지 않은 것이 이 절의 판정이다.** 탭 밖 화면은 대장의 기준 프레임이
  성립하지 않고 실측 최대가 **셋**이라, 넓히면 얻는 것은 자리 수이고 잃는 것은 **그 대장이 무엇을
  재는지의 정의**다. **모집단은 클수록 좋은 것이 아니라 질문의 단위와 같아야 좋은 것이다**(U절
  머리말의 일반형이 여기서 다시 참이었다).
- **일반형.** **모집단 질문의 값은 *넓힌다*가 아니라 *넓힐지를 값으로 답한다*에 있다.** 답하지 않은
  질문만 다음 라운드에 같은 값으로 다시 서고, **기각을 재개 조건과 함께 적으면 그 질문은 조건이
  도래할 때까지 조용해진다**(V-2). ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 문서에 *"다음
  라운드가 먼저 세어 볼 만한 것"* 으로 적힌 문장 중 **실제로 답이 적힌 것이 몇인가**(오늘 넷 중
  넷에 답했고, 그 답 중 셋이 기각이다).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 라운드 84 **Y-2**가 이 문서 전수로 답했다.
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 그 전수는 라운드 86 **AA-5**가 Z절 다섯에 대해, 오늘 **AB-5**와 **AB절 머리말**이 AA절 다섯과 X~AA절 열여섯에 대해 다시 세었다 — **세 라운드 연속 이행**이다.
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### X-3. **기본값이 관대하면 규율의 구멍이 증상을 내지 않는다** — 30초가 무효화 부재를 덮고 있었고, 그 구멍은 기본값을 바꾸려는 사람이 처음 만난다

- **사실.** `["children"]`을 바꾸는 쓰기 경로를 전수로 걸면 **일곱**이고(쓰기 API로는 **다섯** —
  `createChild`·`updateChild`·`confirmChildProfileDeletion`·`confirmHouseholdLeave`·`acceptInvite`),
  그중 **하나만** 성공 뒤 아무것도 무효화하지 않았다 — **온보딩의 아이 생성**
  (`app/(onboarding)/child-profile.tsx`). 설정 > 아이 관리 셋 · 아이 삭제 · 가구 탈퇴 · 초대 수락은
  전부 명시 무효화를 갖는다.
- ⚠️⚠️ **그런데 아무도 증상을 보지 못했다.** 이유가 둘이고 둘 다 "오늘 참"이었다 — ⓐ 그 화면 자신은
  `["children"]`을 **읽지 않아** 온보딩 안에서는 어긋날 자리가 없고, ⓑ **전역 기본 30초**가 그 뒤를
  덮었다(다음 탭에 도착할 때쯤이면 이미 stale이라 재조회가 돈다). **구멍은 있었고 증상만 없었다.**
- ⚠️⚠️ **그 구멍은 기본값을 바꾸려는 사람이 처음 만난다.** 트랙 D가 공유 키의 신선도를 키별로 올리려
  하자(`["children"]` 30초 → 5분) 같은 구멍이 **열 배로** 열렸다 — 온보딩을 막 마친 사람의 다음
  화면들이 **방금 만든 아이가 없는 목록**을 최대 5분 동안 그릴 수 있다. **그래서 이 트랙의 성패는
  코드가 아니라 순서였다**: 무효화 한 줄을 **먼저** 넣고(그 줄은 오늘 소스에서 빨간 줄이었다) 그
  다음에 정책을 세웠다.
- ⚠️ **같은 성질의 사실이 하나 더 있었고, 그것도 기본값이 덮고 있었다.** 같은 캐시 항목에
  `staleTime`이 다른 관찰자가 붙으면 **짧은 쪽이 실효 주기를 정한다**(짧은 쪽이 먼저 stale 판정을
  받아 재조회하고 그 응답이 공유 항목을 통째로 갈아 끼운다). 그래서 `["children"]`에 5분을 적어 둔
  **한 자리**는 열셋의 30초 옆에서 **5분을 얻은 적이 없고**, 그 사실은 화면 소스 어디에도 적혀
  있지 않았다. ⚠️ **이 문장은 소스로만 재던 가설이라 트랙 D가 react-query 실물 재현으로 먼저 못
  박았다** — 가설대로였다.
- **오늘의 값.** ⓐ 무효화 한 줄(`void queryClient.invalidateQueries({ queryKey: ["children"] })` —
  `await`하지 않는 이유가 그 자리에 값으로 있다: 그 화면에 활성 관찰자가 없어 기다릴 재조회가 없고
  ONB-002 → ONB-003 이동 타이밍을 한 틱도 바꾸지 않기 위해서다). ⓑ 정책의 **원천 단일**
  (`src/query/shared-cache-policy.ts` 한 곳 · 등록은 `app/_layout.tsx` 한 자리에서 그 표를 훑기만
  한다 — 두 번째 자리가 생기면 계약이 빨개진다). ⓒ **두 대장이 두 방향**: 정책 대장은 *"둘 이상의
  자리가 켜는 키 전수"* 를 테스트가 **스스로 세고**, 무효화 대장은 쓰기 경로 전수가 명시 무효화를
  가질 것과 **대장에 적힌 경로가 실재할 것**을 함께 문다.
- ⚠️ **길게 두지 않기로 한 것도 값으로 적혔다.** `["expenses"]`·`["budget"]`은 표에 **`null`로**
  올라 있다 — *"총액이 늘어나는 것을 보러 오는 화면이라 낡은 숫자는 곧 틀린 숫자다."* **전역 기본
  30초는 한 글자도 바뀌지 않았고**, 표에 없는 키는 전부 종전 그대로다.
- **일반형.** **관대한 기본값은 규율의 구멍을 *고치지* 않고 *덮는다*.** 그래서 기본값을 조이는
  변경은 언제나 **먼저 그 기본값이 덮고 있던 것을 세는 일**이고, 그 순서를 뒤집으면 그 변경은
  성능을 얻으면서 **없는 사실을 화면에 그리게 한다**. ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**:
  전역 기본이 오늘도 덮고 있는 자리가 몇인가 — **공유 키 중 무효화 대장을 갖지 않은 것**이 그 답의
  단위다(오늘 대장이 선 것은 `["children"]` 하나다).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 라운드 84 **Y-4**가 답했다 — 덮는 것이 기본값이 아니라 **다른 경로**여도 성질이 같다는 답이다.
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 오늘 이 축을 **쓰기로** 연 트랙은 0건이다(다섯 트랙 다 새 쿼리·새 캐시 키·새 무효화 0건).
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### X-4. **값을 세는 계약이 있는 축에서도 문서에 옮겨 적힌 그 값은 계약 밖의 사본이다** — 같은 사실을 소스는 다섯, W절은 하나로 적었다

- **사실 ⓐ — 다섯 대 하나.** 라운드 82 소스의 상세 화면 주석은 *"유일한 링크가 스폰서인 품목
  **다섯**: 유모차·임신일기·물티슈 대용량·보행기·유아 자전거"* 라고 **정확히** 적고 있었다. 같은
  라운드의 **W절 세 번째 기각 문단**은 같은 사실을 *"유일한 예외가 `stroller`"* — **하나**로 적었다.
  ⚠️ **둘 다 같은 시드를 보고 있었고, 소스가 맞았다.** 그리고 그 문단이 그 수를 근거로 내린 결론
  (*"그 두 판정은 오늘 시드에서 거의 실행되지 않는다"*)은 **다섯 배 넓은 사실**이었다.
- **사실 ⓑ — 사본은 고치는 손도 계약 밖이다.** 이 라운드는 W-3이 적은 *"`apps/api/src`의
  `$transaction` **스물일곱 자리**"* 를 실측 **스물아홉**으로 "정정"했다. ⚠️⚠️ **그 정정이 틀렸고
  같은 라운드의 리뷰가 잡았다**(리뷰 H-1) — **스물일곱이 오늘도 맞다.** 스물아홉은 grep이 센 **줄
  수**이고 계약이 세는 것은 **호출 자리**다: 그 차이 둘은 주석 안의 `$transaction` 언급이며,
  `transaction-bounds.test.ts`는 그 둘을 세지 않는다고 자기 머리말에 적은 뒤
  `household-runtime.service.ts`의 세 자리를 **이름으로 묻는 단언**으로 그 사실을 고정한다.
  ⚠️ **그 계약은 어느 쪽 수에도 초록이다 — 수를 세지 않기 때문이다.** 자리 목록을 **자기가
  만들고**(파일 전수 스캔), 각 자리가 *명시 상한* 또는 *이유가 적힌 대장* 둘 중 하나에 속하는지를
  **양방향**으로만 문다. ⚠️ **그것이 옳은 설계다** — 자리 수를 고정하면 새 트랜잭션이 이유 없이
  대장을 늘리는 것과 구분되지 않는다. **그래서 ⓐ와 ⓑ가 함께 말하는 것은 하나가 아니라 둘이다:
  계약 밖의 사본은 낡을 뿐 아니라, 계약을 읽지 않고 고치면 맞던 사본이 틀리게 된다.**
- ⚠️ **판정은 둘 다 그대로 참이다.** W절의 기각(*"준비템 상세의 판매처가 언제나 한 줄인 것은 관측이지
  결함이 아니다"*)도, W-3의 판정(*"문턱을 시드 값으로 세우면 그 문턱은 운영이 넘는다"*)도 오늘
  참이다 — ⓐ에서는 **그 판정이 인용한 수치가 낡았고**, ⓑ에서는 **낡지 않은 수치를 고쳤다.** 앞의
  것은 라운드 82 리뷰 M-4가 `link-marker.ts:97` 주석에 대해 내린 그 결론과 **같은 모양**이다.
- **오늘의 값.** 실제 정정은 **한 줄**이다 — W절 세 번째 기각 문단의 *"하나"* → **다섯**(그 문단이
  적어 둔 재개 조건의 도래와 함께). 판정은 다시 쓰지 않았다. ⚠️ **`$transaction` 쪽에 남은 것은
  정정이 아니라 원복이다**: V-3·W-3의 **스물일곱**은 그대로 두고, 그 자리에 **왜 그 수가 맞는지**
  (계약이 주석 둘을 이름으로 제외한다)를 한 줄로 적었다 — 수를 한 번 더 옮겨 적는 대신 **그 수를
  세는 자리를 가리킨다.**
- ⚠️ **그리고 이 절은 N-4의 두 수를 옮겨 적지 않는다**(O-3의 규율). 트랙 C가 세운 것은 **문서의
  문장이 아니라 화면의 카드**이고, 그 카드가 세는 수는 **그 화면이 센다** — 이 절이 그 수를 적으면
  오늘 옳은 그 문장이 **내일 이 절을 낡게 만든다.** 이 판정이 방금 진단한 병을 이 판정이 다시 앓지
  않도록, 답은 X-5에 **"자리를 세웠다"** 로만 적는다.
- **일반형.** **값을 세는 계약이 있는 축에서도, 문서에 옮겨 적힌 그 값은 계약 밖의 사본이다.**
  계약이 무는 것은 대개 **관계**(상한을 갖거나 대장에 있거나)이지 **수**가 아니고, 그래서 수는
  계약이 초록인 채로 낡는다. ⚠️ **오늘 이 일반형을 지는 사실은 ⓐ 하나다** — ⓑ는 같은 성질의 뒷면
  이고(사본을 고치는 손도 계약 밖이다), 그 자리의 수는 낡지 않았다. ⚠️ **다음 라운드가 먼저 세어
  볼 만한 것**: 이 문서가 소스의 수를 인용하는 자리 중 **그 수를 세는 계약이 실제로 있는 것이
  몇인가**(오늘 정정한 하나는 그 계약이 아예 없는 자리였다).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 라운드 84 **Y-5**가 답했다 — 절대 규칙 문서를 **조항별로** 세는 자리가 그때 처음 생겼다.
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 오늘 그 축이 하나 더 늘었다: **AB-5**가 가리키는 트랙 E의 대장이 *호출부 0건인 export*를 값으로 세고, **자기가 못 보는 것도 함께** 적는다.
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### X-5. **"다음 라운드가 세어 볼 것"으로 적힌 문장은 실제로 세어질 때만 값이다** — W-3이 "남은 공백"이라고 정확히 적어 둔 자리가 한 라운드를 그대로 지났다

- **사실.** W-3은 자기 판정의 남은 절반을 **정확히** 적었다: *"남은 공백을 값으로 적는다: 카탈로그의
  크기를 세는 자리는 오늘도 0건이다. 이 라운드가 한 일은 그 수가 커져도 이 트랜잭션은 견딘다를
  만든 것이지 **그 수가 커진 것을 알려 주는 자리를 만든 것이 아니다.**"* ⚠️ **그 문장이 적힌 뒤 한
  라운드 동안 그 자리는 0건 그대로였고, 같은 절의 다른 수는 낡지도 않았는데 한 번 잘못 고쳐졌다**
  (X-4 ⓑ · 리뷰 H-1이 원복). **문장은 정확했고, 정확한 문장은 아무것도 세지 않는다.**
- ⚠️ **그 공백이 무엇을 조용하게 두는지도 이미 적혀 있었다.** N-4가 준비템 탭 비가상화를 기각하며
  적은 재개 트리거와 라운드 82가 `getHome`의 카탈로그 전량 읽기를 기각하며 적은 재개 조건은
  **같은 수**이고, 그 수가 도래하는 날 **아무 코드도 바뀌지 않으므로 코드 리뷰가 그 순간을 보지
  못한다.** 다음 정찰이 알아차리려면 **누군가 DB를 손으로 세어야 했다.**
- **오늘의 값 — 세는 자리를 세웠다.** 트랙 C가 어드민 요약에 활성 준비템 카운트 한 칸을 더하고
  (`count({ where: { active: true } })` **한 방** — 그 파일의 규율인 *카운트 한 방 · 행 스캔 없음*
  그대로) 대시보드에 **아홉 번째 카드**를 세웠다. ⚠️ **카드의 캡션은 새 판정이 아니라 인용이다** —
  문턱은 이 파일에서 발명한 값이 아니라 **N-4가 적어 둔 재개 트리거**이고, 순수 모듈의 계약이
  `known-limitations.md`를 **읽어서** 그 두 수가 같은지 대조한다(문서가 다른 수로 바뀌면 **그
  계약이 먼저 빨개진다**). **알림·경고·차단은 0건이다** — 넘었을 때 무엇을 할지는 운영 결정이고,
  이 트랙이 만든 것은 **보이는 수 하나**다.
- ⚠️ **`href`가 없는 것이 그 카드의 판정이다.** 이 수의 모집단은 `active: true` 전수인데 준비템 목록
  화면의 모집단이 그것과 같다고 말할 수 없어, 넘어간 목록의 줄 수가 카드의 수와 어긋난다 —
  **라운드 44 N-5가 깨진 링크 카드에서 겪은 그 어긋남을 미리 닫은 것이다.**
- ⚠️ **두 트리거 중 뒤의 하나(밴드별 최대)는 세우지 않았고, 그 기각도 재개 조건과 함께 적혔다**
  (이 절 머리말 · 관계 필드 부재). **그래서 오늘 세어지는 것은 둘 중 앞의 하나뿐이고, 그 사실이
  값이다.**
- ⚠️ **이 절이 다 하지 못한 것도 값으로 적는다.** W-3이 자기 마지막 줄에 적은 *"다음 라운드가 먼저
  세어 볼 만한 것: 이 문서와 소스가 문턱의 근거로 인용하는 수 중 **코드 밖에서 정해지는 것이
  몇인가**"* 는 **오늘 세지 않았다.** 오늘 한 것은 그 목록을 만드는 일이 아니라 **그중 하나에
  세는 자리를 붙이는 일**이었다.
- **일반형.** **"다음 라운드가 세어 볼 것"으로 적힌 문장은 그 라운드가 실제로 세었을 때만 값이 되고,
  세지 않으면 그 문장은 *이미 알고 있다*는 착각의 근거가 된다**(V-3이 산문형 전수에 대해 말한 것의
  이월판이다 — 거기서는 *"전수"* 라는 단어가, 여기서는 *"다음 라운드"* 라는 말이 같은 일을 한다).
  ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 문서의 재개 조건·재개 트리거 중 **도래를 알려 주는
  자리를 가진 것이 몇인가**(오늘 하나가 생겼고, 나머지는 전부 사람이 손으로 재는 수다).
- ⚠️ **갱신 (2026-08-31 · 라운드 88 트랙 F) — 답한 자리를 되짚는다.** 라운드 86 **AA-3**이 그 축의 첫
  절반을 답했고(재개 조건 중 오늘 전제를 다시 재어 본 것), 라운드 87 **AB-3**이 *자기 자리를 소스에도
  적어 둔 것*으로 한 칸 좁혔으며, 라운드 88 **AC절 머리말**이 결정형 전수를 다시 세어 그 목록을 세
  번째로 냈다. ⚠️ **그 판정들을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 —
  O-3·X-4) — 질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지
  않도록 **가리키기만 한다.** ⚠️ **이 되짚는 줄은 라운드 87이 열여섯 자리에 붙이고 *따로 세지 않았다*
  고 적어 둔 나머지 **다섯** 중 하나다**(X-5 · Y-5 · Z-5 · AA-5 · AA절 머리말의 인용 한 줄 — 그 다섯을
  세는 자리는 **AC-5**이고, 그 수를 어떻게 냈는지도 거기 있다).

## Y. 라운드 84에서 확정한 판정 (2026-08-30 · GAP-084 트랙 F)

라운드 83이 물은 것이 **규칙이 화면과 같은 것을 묻는가** 였다면, 라운드 84의 물음은 그 한 칸
바깥이다 — **규칙을 화면의 술어에 맞췄는데, 그 술어로 일하는 사람의 도구는 아직 옛 질문을 한다.**
축은 라운드 81~83과 같이 **사용자 가치**였고(핵심 루프의 막힌 자리 · 저장소가 자기를 세는 자리 ·
캐시 정직성 · 절대 규칙의 가드), 다섯 판정 다 K~X절과 같이 **결함 보고가 아니라 다음 결정의 입력**
이며 2026-08-30 소스에서 확인됐다(라운드 84 트랙 A·B·C·D 머지 후).

⚠️⚠️ **이번 라운드의 가장 값진 관측: 규칙을 화면의 술어에 맞춘 라운드는 그 술어로 일하는 사람의
도구도 같은 술어인지를 이어서 물어야 한다**(Y-1). 라운드 83이 계약과 화면을 *"활성 ∧ 비스폰서 링크
≥1"* 로 맞췄는데, **그 갈래를 실제로 만들 수 있는 유일한 손**(어드민)의 필터는 *"활성 링크 ≥1"* 을
묻고 있었다. 운영자가 스폰서 링크 하나만 붙이면 그 준비템은 어드민에서 *"링크 있음"* 으로 보이고,
앱 상세에서는 **핵심 루프 4단계를 여는 가장 큰 버튼이 서지 않으며**, 시드 계약은 시드만 무므로
초록이다. **X-1이 *"규칙이 화면과 다른 질문을 한다"* 였다면 이것은 *"규칙은 맞췄는데 그 규칙을
쓰는 도구가 안 맞았다"* 이다** — Q-5(*"판정을 테스트에만 두면 그 판정은 시드만 문다"*)와 X-1의
합류점이고, 그 갈래를 만드는 손이 정확히 그 화면이라는 점이 이 판정의 무게다.

⚠️⚠️ **두 번째 관측: 답이 "아니오"인 질문을 세는 비용은 낮고, 세지 않으면 그 질문은 매 라운드 같은
값으로 다시 선다**(Y-2). 이 문서에 *"다음 라운드가 (먼저) 세어 볼 (만한) 것"* 으로 적힌 문장의 전수를
이번 라운드가 처음으로 다 셌고, **오늘 이전에 답이 적혀 있던 것은 넷뿐이었다.** 오늘 **넷이 트랙이
되고 여덟이 값 또는 재개 조건으로 닫혔으며**, 그 여덟 중 다섯의 답은 *"오늘 값 0건"* 이다.
⚠️ **그리고 그 0건들은 세어 보기 전에는 알 수 없었다** — 세는 데 든 것은 각각 한 번의 전수 스윕이다.
**X-5가 *"세어 볼 것으로 적힌 문장은 실제로 세어질 때만 값이다"* 였다면 이것은 그 이행판이다.**

⚠️⚠️ **세 번째 관측: 같은 관례가 두 앱에 필요할 때 먼저 세운 쪽의 대장은 나머지로 건너가지
않는다**(Y-3). 어드민에는 손 미러를 세는 대장이 이미 있고(P-4 — 미러 **스물여섯** · 정본 여덟 파일 ·
두 방향), 모바일에는 같은 종류의 미러를 세는 자리가 **0건**이었다. ⚠️ **그런데 실제로 갈린 자리는
모바일에 있었고, 그것을 찾은 것은 계약이 아니라 사람이었다** — 사람은 정직하게 방어적 접근자와
그 이유를 소스에 적었다. **관례는 본보기로 남았고, 본보기는 건너가지 않는다.**

⚠️⚠️ **네 번째 관측: 덮는 것이 기본값이 아니라 다른 경로여도 성질은 같다**(Y-4). X-3이 찾은 것은
*"관대한 기본값이 규율의 구멍을 덮는다"* 였고, 오늘 찾은 것은 *"다른 경로(오프라인 flush)가 세 화면의
누락을 덮는다"* 이다 — 지출 한 건을 바꾸는 다섯 경로 중 **셋**이 `["home"]`을 무효화하지 않고 확정
시점의 flush가 그것을 덮는다. ⚠️ **그리고 같은 파일이 형제 키(`["items"]`)에 대해서는 그 사실을 값으로
적어 두었고 `["home"]`에 대해서만 비어 있었다** — **같은 파일이 같은 사실을 한 키에는 적고 다른 키에는
적지 않았다면, 그 침묵은 판단이 아니라 누락일 가능성이 높다.**

⚠️⚠️ **다섯 번째 관측: 이 저장소에서 가장 자주 인용되는 문서가, 자기를 세는 계약이 가장 없는
문서였다**(Y-5). `docs/dev/do-not-change.md`는 CLAUDE.md·AGENTS.md·CODEX_START_HERE.md가 첫 줄로
가리키는 절대 규칙이고 코드 주석이 조항 ID를 수백 번 인용하는데, **그 문서에 줄이 늘거나 문구가
완화돼도 빨개지는 자리는 사실상 없었다.** ⚠️ **O-3이 이름 붙인 병(인용이 실측을 대신한다)의 가장 큰
사례가 판정 문서가 아니라 계약 문서에 있었다.**

⚠️⚠️ **이월 다섯은 전부 보류 유지이고 재실측 값만 갱신했다 — 갱신 한 줄씩은 그 판정이 사는 절에 있다**
(다음 라운드가 같은 실측을 다시 돌리지 않도록 여기서는 자리만 가리킨다).

- **이 스캐너가 쿼리로 분류한 자리의 낭독** — 재실측 상태 변화 0, A-20 #85 선행 → **U절 머리말**.
- **`monthly_wrapup`의 달 이동 구멍** — 게이트가 읽는 것은 여전히 대기 행의 바뀐 뒤 날짜 하나 → **U-3**.
- **`/budget` 겹침 착지** — `URL_OVERLAPS` 여전히 **둘**, 확인의 표 `#133` 대기 → **U-5**.
- **S-3(어드민 `disabled`)** — 재실측 **열하나**(items 6 · links 5), 브라우저 확인 `#130` 선행 → **U절 머리말**.
- **`withdrawn_at`** — 저장소 전체 **3건 · 파일 둘**, 컬럼 신설은 여전히 별도 결정 → **U절 머리말**.

**다섯 다 2026-08-30 재실측이고 상태 변화 0이다.** ⚠️⚠️ **다만 이번 라운드에는 종전 열 라운드와 다른
접점이 하나 있었다: 트랙 A가 S-3이 사는 파일(`apps/admin/app/items/page.tsx`)을 쓰기로 열었다.**
그 트랙의 금지 조항이 `disabled={readOnly}` **여섯 자리의 바이트 불변**을 명시했고, 머지된 소스에서
그 여섯 자리는 한 글자도 달라지지 않았다(트랙 A가 그 파일에 더한 것은 체크박스 한 줄 · 힌트 한 줄 ·
필터 상태 한 칸이다). **파일이 겹쳤는데 자리가 겹치지 않았다는 사실 자체가 값이라 U절 머리말의 S-3
줄에 함께 적었다** — 다음 라운드가 *"그때 그 파일을 열었으니 S-3도 움직였겠지"* 로 읽지 않도록.
나머지 넷은 접점 0건이다(⚠️ 어느 트랙도 `apps/api/src`·`prisma/`·`src/offline/**`를 쓰기로 열지
않았다 — 트랙 D는 `sync-controller.ts`를 **읽기만** 한다).

⚠️⚠️ **X-5가 남긴 질문에 대한 오늘의 답을 한 자리에 남긴다 — 열여섯 전수와 각각의 답이다.**
⚠️ **수치는 여기 옮겨 적지 않고 그 수를 세는 자리를 가리킨다**(O-3·X-4의 규율 — 옮겨 적힌 수는
계약 밖의 사본이고, 아래 답의 상당수는 **계약이 아니라 정찰이 손으로 잰 수**라 더욱 그렇다.
열여섯의 전수와 실측값은 `docs/5차/round84-scout.md`의 **선행 확인 2** 표가 든다).

- **넷이 트랙이 됐다.** ⓐ **U-2**(계약 파일 제목 중 본문이 그만큼 묻지 않는 것) → **트랙 C** ·
  ⓑ **U-5**(DNC 스무 줄 중 기계가 지키지 않는 것) → **트랙 B** · ⓒ **X-1**(대장·래칫 중 화면의
  술어를 쓰지 않는 것) → **트랙 A** · ⓓ **X-3**(공유 키 중 무효화 대장을 갖지 않은 것) → **트랙 D**.
  **넷 다 답이 "하나 있다" 또는 "여럿 있다"였고, 그래서 넷 다 코드가 됐다.**
- **다섯의 답이 *"오늘 값 0건"* 이다 — 그리고 이 다섯은 세어 보기 전에는 알 수 없었다.**
  ⓔ **T절 머리말**(같은 함수를 부르는 표면 여럿의 입력이 갈리는가) — 공용 판정 상위 여섯을 실측해
  **갈리는 자리 0건**이고, 최상위 하나는 **인자가 0개**라 갈릴 수가 없다. ⚠️ **재개 조건: 인자를
  받는 공용 판정이 세 표면 이상에 새로 걸리는 날.**
  ⓕ **W-2**(예외·제외 목록 중 두 방향을 지지 않는 것) — 이름 규칙으로 모집단을 만들어 전수를 돌면
  **반대 방향 단언이 없는 것 0건**이다(사각 둘은 아래 기각에 값으로 있다).
  ⓖ **W-3**(문턱의 근거 중 코드 밖에서 정해지는 수) — **이 축에 새 후보 0건**이다. 세는 자리가 있는
  것은 라운드 83 C의 어드민 카드가 세는 하나이고, 나머지는 **문서가 정한 수**라 문서를 읽는 계약이
  대조하거나(`catalog-size-view.test.ts`) 계약이 **관계**만 문다. ⚠️ **재개 조건: 세는 자리가 없는
  문턱이 하나 더 생기는 날.**
  ⓗ **W-5**(*"문제가 아니다"* 주석 중 범위가 적힌 것) — 제품 소스 전수에서 그 주석 **전부**가 범위
  또는 재개 조건을 함께 진다. **범위 없는 것 0건.** ⚠️ **재개 조건: 범위 없는 *"문제가 아니다"* 가
  새로 생기는 날.**
  ⓘ **X-4**(문서가 인용하는 소스 수 중 그 수를 세는 계약이 있는 것) — **이 축에 새 후보 0건**이다.
  ⚠️ **유일하게 수를 세는 자리는 확인의 표 §0**이고(`runtime-checklist-shape.test.ts`가 파싱으로 다시
  센다), 스모크·어드민 E2E의 계수는 **세는 계약 0건**이라 정찰이 매 라운드 손으로 잰다 — 그 자동화는
  **P-3의 영구 기각과 같은 축**이다(아래 기각).
- **넷은 이미 답이 적혀 있던 것이고, 오늘 재실측해도 그 답이 그대로였다.**
  ⓙ **V-1**(순수 술어의 입력 범위를 묻는 대조) — 라운드 82·83이 답했고 **넓힐 자리 0건**.
  ⓚ **V-5**(문장 수 하네스의 모집단) — 라운드 83이 셋째를 재개 조건과 함께 기각했고 그 조건은
  **미도래**. ⓛ **W-1**(갈래마다 같은 질문을 하는 계약) — X-1이 답했고 남은 축은 Y-1로 이어진다.
  ⓜ **W-4**(첫 페인트 대장에 들어와야 할 화면) — 라운드 83이 탭 다섯으로 답했고, ⚠️ **그 답이 적어
  둔 재개 조건(탭 밖 화면 하나가 첫 페인트에 넷 이상을 켜는 날)은 오늘도 도래하지 않았다** —
  탭 밖 최대는 여전히 셋이고, 네 번째 후보는 그 화면의 `householdId`가 아이를 찾기 전에는 `null`
  이라 첫 페인트에 켜지지 않는다.
- **하나는 메타이고, 이 절이 그 답이다.** ⓝ **X-2**(이 문서의 *"세어 볼 것"* 중 답이 적힌 것이
  몇인가) — 오늘 이전에는 넷이었고 **오늘 열여섯 전수에 답이 적혔다.** ⚠️ **그 답의 다수가 기각이라는
  사실이 X-2의 일반형을 한 번 더 참으로 만든다** — *"모집단 질문의 값은 넓힌다가 아니라 넓힐지를
  값으로 답한다에 있다."*
- **둘은 값과 재개 조건으로 닫았다(0건도 트랙도 아니다).** ⓞ **S절 머리말**(요약·반환값의 0 소비자)
  — 오늘 그 자리들은 전부 **이미 이유가 적힌 자리**이고, 하나는 계약 축소(DNC-006 인접)라 별도
  결정이며 다른 하나는 사용자 결정 대기다. ⚠️ **재개 조건: 세 번째 0 소비자가 생기는 날, 또는
  `listItems`의 `stageBand`를 지우자는 결정이 서는 날.**
  ⓟ **X-5**(재개 조건 중 도래를 알려 주는 자리를 가진 것) — 오늘도 그 자리를 가진 것은 라운드 83 C가
  세운 하나뿐이고 **그마저 빨개지는 계약이 아니라 사람이 보는 카드**다. 감지기를 붙일 자리가 세
  파일에 흩어져 있어 이 라운드의 트랙 넷과 파일 소유가 엉킨다. ⚠️ **재개 조건: 어느 트랙이 그 세
  파일 중 하나를 이미 열게 되는 라운드**(그때 곁다리로 한 줄).

⚠️⚠️ **이번 라운드가 실측하고 기각한 아홉을 값으로 남긴다 — 전부 재개 조건과 함께**(V-2가 세운 규율:
조건 없는 보류는 이유가 적혀 있다는 이유로 재론되지 않는다).

- **`stageBand`의 0 소비자를 정리하는 것 — 재었고 제안하지 않는다.** 앱의 호출부는 둘뿐이고 둘 다 그
  인자를 넘기지 않는데, **서버는 그 파라미터의 분기를 그대로 들고 있다**(준비템 탭이 밴드 판정을 화면
  안으로 옮기면서 남은 자리다). 지우는 것은 **계약 축소**(DNC-006 인접)라 별도 결정이고, e2e·로컬
  백엔드가 그 갈래를 여전히 검증한다. ⚠️ **재개 조건: 세 번째 0 소비자가 생기는 날, 또는 그
  파라미터를 지우자는 결정이 서는 날.**
- **어드민·모바일 스윕의 *"걷는 뿌리 ∪ 제외 뿌리 = 실제 뿌리 전수"* 를 묻는 것 — 재었고 제안하지
  않는다.** 어드민 스윕 넷은 **걷는 뿌리**와 **제외 뿌리의 실재·이유**를 값으로 묻지만, *새 뿌리가
  생겼는데 어느 목록에도 없는 경우* 를 묻는 자리는 0건이다. 오늘 어드민의 실제 소스 뿌리는 전부
  목록 안이라 **빨개질 줄이 0건**이고, 넣을 자리가 스윕 넷에 흩어져 있어 이 라운드의 어느 트랙과도
  축이 다르다. ⚠️ **재개 조건: `apps/admin` 또는 `apps/mobile`에 새 소스 뿌리가 생기는 날.**
- **저장 제외 목록에 *파일의 실재* 단언을 붙이는 것 — 재었고 제안하지 않는다.** 그 목록을 무는 계약은
  이유 길이와 배선 목록과의 배타만 묻고(조회 쪽 어드민 대장들은 `existsSync`를 함께 문다), **오늘 그
  목록이 비어 있어 증상이 0건이다.** ⚠️ **재개 조건: 그 목록에 첫 줄이 서는 날**(그날 이 문단이 그
  자리를 가리킨다).
- **재개 조건의 도래를 알려 주는 감지기를 만드는 것 — 재었고 제안하지 않는다.** 문서의 서로 다른 재개
  조건 중 도래를 알려 주는 자리를 가진 것은 라운드 83 C의 카드 하나뿐이고, 나머지는 **사람이 손으로
  재는 수**다. 붙일 자리가 시드 계약·첫 페인트 대장·스키마 파싱 **셋에 흩어져** 있어 파일 소유가
  이 라운드의 넷과 엉킨다. ⚠️ **재개 조건: 어느 트랙이 그 세 파일 중 하나를 이미 열게 되는 라운드.**
- **문턱을 인용하는 자리의 대장을 세우는 것 — 재었고 제안하지 않는다.** 오늘 실측한 문턱 넷 중 세는
  자리가 있는 것은 하나이고 나머지는 **문서가 정한 수**(문서를 읽는 계약이 대조한다)이거나 **계약이
  관계만 무는 수**다. 대장을 하나 더 세우면 그 대장 자신이 다시 사본이 된다(X-4). ⚠️ **재개 조건:
  세는 자리가 없는 문턱이 하나 더 생기는 날.**
- **스모크·어드민 E2E 계수의 자동화 — 영구 기각 유지.** 두 수를 세는 계약은 0건이고 정찰이 매 라운드
  손으로 재는데, **그 자동화는 P-3(테스트 건수 자동화)의 영구 기각과 같은 축**이다 — 세는 대상이
  스크립트의 실행 단위라 그 수를 고정하면 스크립트를 고치는 손과 계약을 고치는 손이 갈린다.
  ⚠️ **재개 조건: 그 두 스크립트가 산출물(요약 JSON 등)을 남기게 되는 날** — 그때 세는 것은 소스가
  아니라 산출물이다.
- **밴드 분포의 하한을 손보는 것 — 관측만 하고 제안하지 않는다.** 시드에서 가장 얇은 밴드가 계약
  하한과 **같은 수**에 붙어 있다(그 수는 시드 계약이 세므로 여기 옮겨 적지 않는다). ⚠️ **그런데
  카탈로그 확충은 콘텐츠 결정이고 코드가 답할 자리가 아니다** — 줄어들면 그 계약이 먼저 빨개지므로
  **오늘 감지기는 이미 있다.** ⚠️ **재개 조건: 그 하한이 실제로 깨지는 날**(계약이 그날을 알려 준다)
  **또는 카탈로그 확충이 콘텐츠 결정으로 서는 날.**
- **후보 1에 대시보드 카운트 카드를 하나 더 세우는 것 — 이번에는 세우지 않는다.** 라운드 83 C가 세운
  카드가 아홉이고, **이 수는 목록에서 골라내는 것이 값이지 세는 것이 값이 아니다**(오늘 그 필터에
  걸리는 품목이 시드에 0건이라 카드는 언제나 0을 그린다). ⚠️ **재개 조건: 이 필터에 걸리는 품목이
  실제로 생기는 날.**
- **후보 4의 `["home"]`을 세 화면에 즉시 무효화로 더하는 것 — 재었고 제안하지 않는다.** 세 경로 다
  **로컬 우선**이라 그 시점의 서버는 아직 옛 값을 들고 있고, 지금 무효화하면 **그 옛 값을 다시
  받아온다.** 확정 시점의 무효화는 flush가 하고 그 사실이 대장의 `provenBy`로 소스에서 검증된다.
  ⚠️ **재개 조건: flush의 `["home"]` 무효화가 조건부가 되는 날** — 그날 이 세 화면의 홈은 옛 값을 든다.

**이 라운드가 짝 문서에 남긴 것.** 확인의 표에 **#147 하나**가 서고(⚠️ **표면은 `브라우저`** — 트랙
B·C·D는 **소스 계약이라 표에 행이 서지 않는다**) §0의 여섯 숫자가 파싱으로 다시 세어졌으며, 접근성
표에는 **A-25 #96** 하나가 섰다. ⚠️⚠️ **그래서 `실기기` 행은 라운드 76 이후 처음으로 늘지 않았고,
그 0의 뜻을 §1-1 머리말이 한 줄로 말한다 — *"확인할 것이 없다"가 아니라 "이번 라운드가 폰에 보이는
동작을 한 곳도 바꾸지 않았다"* 이다.** ⚠️ **C-3(잠금 오버레이 TalkBack 투과)은 오늘로 열여덟 라운드
연속 미확인**이고, 이 절이 그것에 대해 적을 수 있는 것은 경과 수뿐이다 — ⚠️ **다만 이번 라운드에는
새 `실기기` 행이 0건인데도 그 칸이 비어 있었고, 그것이 이 줄이 기다리는 것은 우선순위가 아니라
사람·기기·날짜 배정이라는 증거다.**

### Y-1. **규칙을 화면의 술어에 맞춘 라운드는 그 술어로 일하는 사람의 도구도 같은 술어인지 이어서 물어야 한다** — 계약과 화면은 "비스폰서 링크 ≥1"을 함께 묻는데 어드민 필터는 "링크 ≥1"을 묻고 있었다

- **사실.** 라운드 83이 두 번째 대장(`ITEM_CODES_WITHOUT_NON_SPONSORED_LINK`)과 *"`essential` 품목은
  예외 없이 **비스폰서** 링크 ≥1"* 을 세워 **계약의 질문을 화면의 질문에 맞췄다.** 화면의 술어는
  `src/items/link-marker.ts`의 `primaryPurchaseLinkIndex`
  (`links.findIndex((link) => !link.isSponsored)`)이고, 앱이 받는 링크는 **활성만**이므로 실제 술어는
  **"활성 ∧ 비스폰서 링크 ≥1"** 이다. ⚠️ **그런데 어드민의 *'상품 링크 없음만 보기'* 는
  `activeProductLinkCount(item) > 0`으로 거른다 — 스폰서 여부를 한 번도 보지 않는다.**
- ⚠️⚠️ **그리고 그 두 술어가 갈리는 갈래를 만들 수 있는 유일한 손이 정확히 그 화면이다.** 운영자가
  준비템을 만들고 **스폰서 링크 하나만** 붙이면 그 준비템은 ① 어드민에서 *"링크 있음"* 으로 보이고
  ② 앱 상세에서 **전폭 CTA가 서지 않으며** ③ 시드 계약은 **시드만 무므로** 초록이다.
  **Q-5가 이름 붙인 그 모양이다** — *"판정을 테스트에만 두면 그 판정은 시드만 문다."*
- ⚠️ **화면의 판정은 옳고 서버도 옳다 — 고칠 것은 도구였다.** 전부 스폰서일 때 채워진 CTA를 렌더하지
  않는 것은 DNC-011의 시각 구분을 지키는 규율이고(광고를 광고라고 말한 자리에서만 누르게 한다),
  스폰서 유일이 **언제나 결함인 것도 아니다** — 그 판단은 운영이 한다. **없던 것은 규칙도 화면도
  아니고, 그 상태를 볼 수 있는 눈이었다.**
- **오늘의 값 — 판정 한 칸과 화면 두 줄이다.** ⓐ `apps/admin/src/lib/item-filters.ts`에
  `activeNonSponsoredLinkCount`(활성 ∧ 비스폰서)와 그것을 쓰는 필터 조건 한 줄. ⓑ 목록 화면에
  체크박스 한 줄 + 힌트 한 줄(기존 줄과 **같은 형식** · 해요체 · 단정 금지). ⓒ ⚠️ **술어의 동치를
  계약이 문다** — 어드민 테스트가 `link-marker.ts`를 **소스 텍스트로 읽어** 그 `findIndex`가 그대로인지
  확인한다(어드민은 모바일 패키지를 의존하지 않으므로 `admin-canonical-mirrors.test.ts`의 그 관례
  그대로다). **모바일이 술어를 바꾸면 어드민 계약이 먼저 빨개진다.**
- ⚠️ **기존 필터는 한 글자도 바꾸지 않았다 — 둘은 다른 질문이다.** 링크가 0건인 준비템은 **두 필터
  모두**에 걸리고 스폰서 유일 준비템은 **새 필터에만** 걸린다. 바꿨다면 다음 라운드가 링크 0건을 새
  결함으로 다시 줍는다(X-1 ⓓ · W-2가 이름 목록에 대해 내린 그 판단의 반복이다).
- ⚠️ **DNC 셋은 한 줄도 늘거나 줄지 않았다.** 이 트랙은 **세고 고를** 뿐이라 스폰서 링크를 숨기거나
  뒤로 미는 변경이 0건이고(DNC-011), 정렬·추천 점수와 무관하며(DNC-009), 고지 문장도 새로 서지
  않는다(DNC-010). **서버 0건 · 새 요청 0건**이다 — `active`와 `isSponsored`가 목록 응답에 **이미**
  실려 있었다.
- ⚠️ **오늘 그 필터에 걸리는 품목은 시드에 0건이고, 그것이 이 트랙의 계약을 픽스처로 밀어냈다.**
  세는 대상이 오늘 0이라 **시드로는 그 갈래를 밟을 수 없어**, 계약이 스폰서 유일 품목을 픽스처로
  만들어 센다. **0건인 자리를 계약이 스스로 만들어 세는 것과 0건이라 세지 않는 것은 다르다.**
- **일반형.** **규칙을 화면의 술어에 맞춘 라운드는, 그 술어로 일하는 사람의 도구도 같은 술어로
  맞췄는지를 이어서 물어야 한다 — 도구가 옛 질문에 머물면 규칙은 옳은 채로 도달하지 않는다.**
  ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소의 **운영자 도구**(어드민 필터·정렬·요약·검색)
  중 **앱 화면의 술어와 다른 질문을 하는 것이 몇인가**(오늘 하나를 찾았고, 그 하나는 바로 전 라운드가
  화면에 맞춘 술어였다).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 라운드 85 **Z-3**이 그 축을 세는 형식으로 답했고(앱이 바꾼 축 셋 중 둘은 따라갔고 하나가 갈렸다), 라운드 86 **AA-2**가 같은 도구에서 *술어*가 아니라 **도달 경로**가 갈린 자리를 냈다.
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 오늘 그 도구에서 한 자리가 더 나왔고 판정은 **AB-2**다 — 이번에는 **그 화면이 자기 한계를 문장으로 자백하고 있었다.**
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### Y-2. **답이 "아니오"인 질문을 세는 비용은 낮고, 세지 않으면 그 질문은 매 라운드 다시 선다** — 열여섯 중 여덟이 오늘 0건 또는 재개 조건으로 닫혔다

- **사실.** 이 문서에 *"다음 라운드가 (먼저) 세어 볼 (만한) 것"* 으로 적힌 문장의 전수를 이번 라운드가
  처음으로 다 셌다. **오늘 이전에 답이 적혀 있던 것은 넷뿐이었고**, 나머지는 *"물었고 답하지 않은"*
  상태로 라운드마다 다시 서 있었다. **가장 오래된 것은 네 라운드를 그대로 지났다**(U-5의 DNC 질문 —
  Y-5가 그것을 닫는다).
- ⚠️⚠️ **값은 "넷이 발동했다"가 아니라 "열여섯에 답이 적혔다"에 있다.** 오늘 **넷이 트랙**이 되고
  **여덟이 값·재개 조건**으로 닫혔으며 하나는 메타, 넷은 이미 답이 있던 것이다(전수와 각각의 답은
  이 절 머리말에 값으로 있다). ⚠️ **그 여덟 중 다섯의 답은 *"오늘 값 0건"* 이고, 그 0건들은 세어 보기
  전에는 알 수 없었다** — 예컨대 *"문제가 아니다"* 주석은 **전부** 이미 범위를 지고 있었고, 예외·제외
  목록은 전수에서 반대 방향 단언이 빠진 것이 없었다.
- ⚠️ **세는 비용이 낮다는 것이 이 판정의 절반이다.** 다섯 다 **전수 스윕 한 번**이면 답이 나왔고
  (이름 규칙 · grep · 파싱), 그중 어느 것도 새 계약을 필요로 하지 않았다. **비싼 것은 세는 일이
  아니라 세지 않은 채 매 라운드 그 질문을 다시 세우는 일이었다** — 같은 문장이 다음 정찰의 후보
  목록에 다시 오르고, 다시 재어지지 않은 채 다시 적힌다.
- ⚠️ **다만 "0건"과 "괜찮다"는 다르고, 그 차이를 값으로 적었다.** 두 방향 0건 없음 옆에는 **사각 둘**이
  함께 적혔고(저장 제외 목록의 실재 단언 · 뿌리 분할의 완전성), 둘 다 **오늘 값이 0건이라 조용할
  뿐**이다. 그 둘은 기각으로 닫되 **재개 조건과 함께** 닫았다 — W-5가 *"문제가 아니다"* 에 대해 요구한
  그 범위 표기의 이행이다.
- ⚠️ **이 판정이 자기에게도 적용된다.** 오늘 답한 열여섯 중 **여덟이 새 *"세어 볼 만한 것"* 을 남겼고**
  (각 판정의 마지막 줄), 그 여덟은 다음 라운드에 같은 방식으로 세어질 때만 값이 된다. **X-5가 한
  라운드를 그대로 지나간 이유는 문장이 부정확해서가 아니라 아무도 그 문장을 실행 항목으로 읽지
  않았기 때문이다** — 이번 라운드는 그것을 **정찰의 고정 절차**로 만들었다(정찰 노트 선행 확인 2).
- **일반형.** **답이 "아니오"인 질문을 세는 비용은 낮고, 세지 않으면 그 질문은 매 라운드 같은 값으로
  다시 선다.** 그래서 *"다음 라운드가 세어 볼 만한 것"* 은 **다음 라운드의 첫 일**이어야 하고, 그
  결과가 0건이면 **0건이라고 적는 것이 답이다.** ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 오늘 답한
  열여섯이 남긴 새 문장 중 **다음 라운드가 실제로 답한 것이 몇인가**(오늘 열여섯 중 열여섯에 답했고,
  그 답의 다수가 기각이다).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 라운드 86 **AA-5**가 Z절 다섯에 대해 답했고, 오늘 **AB절 머리말**이 AA절 다섯에 대해 답한다(**다섯 다 발동**).
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 그리고 오늘 이 질문의 답이 하나 더 늘었다: **답이 적힌 뒤에도 그 답을 되짚는 줄이 없으면 질문은 다시 세어진다** — 이 줄이 바로 그 이행이다(**AB-5**).
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### Y-3. **같은 관례가 두 앱에 필요할 때 먼저 세운 쪽의 대장은 나머지로 건너가지 않는다** — 어드민에는 손 미러를 세는 대장이 있고 모바일에는 0건인데, 갈린 자리는 모바일에 있었다

- **사실.** 모바일은 `@wooriai/contracts`를 의존성으로 들지 않으므로 서버 계약을 **수기로 미러**한다
  (그 사실은 소스 주석 둘이 같은 문장으로 적고 있고, `contracts:generate`는 스텁이다). ⚠️ **그런데
  그 미러를 무는 계약의 제목은 *"수기 미러 드리프트 가드"* 인데 본문이 물던 것은 값 넷이었고,
  미러의 모집단(스키마 몇 · 필드 몇이 미러인가)을 세는 자리는 0건이었다.**
- ⚠️⚠️ **어드민에는 그 대장이 이미 있다.** `admin-canonical-mirrors.test.ts`가 미러 **스물여섯** ·
  정본 **여덟 파일** · 걷는 뿌리 · 못 잡는 선언 형태까지 값으로 들고 두 방향을 문다(P-4가 세웠다).
  ⚠️ **모바일 쪽에는 같은 형식이 0건이었고, 모바일이 미러하는 것은 어드민보다 더 자주 바뀌는 것
  (서버 응답 필드)이다.** **관례는 세워진 자리에 남았고, 필요가 더 큰 쪽으로 건너가지 않았다.**
- ⚠️⚠️ **그리고 이미 갈린 자리가 하나 있었는데, 그것을 찾은 것은 계약이 아니라 사람이었다.**
  계약의 지출 스키마에는 있고 모바일 타입에는 없는 필드가 하나 있었고(**앱이 실제로 쓰는 필드**다 —
  기록 행의 작성자 표기가 그것으로 선다), 그래서 소스에는 **타입에 없는 필드를 방어적으로 좁히는
  접근자**가 이유와 함께 서 있다. ⚠️ **사람은 정직했다 — 정직한 우회는 값이지만, 두 번째 우회가
  생기는 순간 *"이 앱이 서버 응답을 어떻게 아는가"* 의 답은 타입이 아니라 접근자들이 된다.**
- **오늘의 값 — 모집단을 스윕이 센다.** ⓐ 계약 소스의 `export const` **전수를 파싱해** 셋(객체
  스키마 · 값 스키마 · 상수)으로 분류하고, 객체 스키마와 모바일 타입의 **짝을 이름 규칙으로** 지어
  **필드 이름 집합을 두 방향** 비교한다 — **짝 목록도 손으로 적지 않는다.** ⓑ 갈리는 자리는 **면제
  대장**에 이유와 함께 있고(오늘 하나 · 그 이유가 사는 소스 자리를 **가리킨다**), ⚠️ **면제의 수에
  래칫이 걸린다.** ⓒ 짝이 없는 스키마도 **이유와 함께** 대장에 있다. ⓓ 상수 쪽은 대조가 **다른
  파일에도** 있어서, 대장이 그 자리를 **파일 이름으로 가리킨다**. ⓔ ⚠️ **describe 제목을 본문에
  맞췄다 — U-2의 이행이다**(제목이 무는 범위와 본문의 모집단이 같아졌다).
- ⚠️ **`createdByUserId`를 모바일 타입에 더하는 것은 이 트랙의 범위 밖이고 별도 결정이다.** 더하면
  방어적 접근자의 존재 이유가 바뀌고 그 정리는 다른 축의 파일을 여는 일이다. **이 트랙이 한 일은
  그 사실을 대장의 한 줄로 만든 것이지 고친 것이 아니다** — ⚠️ **그리고 그 한 줄이 오늘 빨간 줄이라는
  것을 확인했다**(면제를 지우면 계약이 즉시 빨개진다).
- **일반형.** **같은 관례가 두 앱에 필요할 때, 먼저 세운 쪽의 대장은 나머지 쪽으로 자동으로 건너가지
  않는다 — 건너갔는지를 묻는 것이 다음 라운드의 일이다.** P-4가 어드민에서 내린 판정이 모바일에서
  **네 라운드 뒤에** 같은 모양으로 반복됐고, 그동안 그 사실을 아는 자리는 사람의 주석 하나였다.
  ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소에서 **한쪽 앱에만 있는 대장·스윕이 몇이고,
  그중 반대쪽에 같은 필요가 있는 것이 몇인가**(오늘 하나를 옮겼고, 그것을 찾은 것은 계약이 아니었다).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 오늘 **AB-1**이 그 질문의 한 자리를 값으로 냈다 — 라운드 75가 어드민에서 넓힌 뿌리 관례(*걷는 뿌리와 걷지 않는 뿌리와 그 이유가 둘 다 값*)를 모바일이 **열두 라운드 뒤에** 따라갔다(트랙 C).
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 그리고 트랙 E의 대장은 처음부터 **두 앱을 함께** 모집단으로 든다 — 한쪽에만 서는 대장을 새로 만들지 않는 것이 그 트랙의 결정이었다.
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### Y-4. **덮는 것이 기본값이 아니라 다른 경로여도 성질은 같다** — 지출 쓰기 다섯 중 셋이 `["home"]`을 무효화하지 않고 flush가 그것을 덮는다

- **사실.** 지출 한 건을 바꾸는 경로는 **다섯**이고(빠른 기록 · 상세 수정 · 상세 삭제 · 기록 탭 행
  삭제 · flush 확정), 그 다섯이 무효화하는 키 집합이 서로 다르다. ⚠️ **확정 시점의 집합을 기준선으로
  놓고 재면 세 경로가 `["home"]`을 무효화하지 않는다** — 그리고 그 차이가 적힌 자리는 0건이었다.
- ⚠️⚠️ **오늘 그 차이를 덮는 것은 신선도가 아니라 오프라인 flush다.** 세 경로 다 **로컬 우선**이라
  그 `onSuccess`는 서버가 아직 옛 값을 들고 있는 시점에 돌고, 거기서 `["home"]`을 무효화하면 **그 옛
  값을 다시 받아온다.** 확정 시점의 무효화는 `sync-controller.ts`의 `summary.synced > 0` 갈래가
  한다 — **즉 세 화면의 침묵은 옳고, 옳은 이유가 다른 파일에 있었다.**
- ⚠️⚠️ **그런데 같은 파일이 형제 키에 대해서는 그 사실을 값으로 적어 두었다.** 연결 지출의
  `["items"]`·`["item-detail"]`에 대해서는 *"실서버에서 실제로 듣는 것은 flush 쪽 무효화"* 라는
  문장이 소스에 있고, `["home"]`에 대해서만 그 자리가 비어 있었다. **같은 파일이 같은 사실을 한 키에는
  적고 다른 키에는 적지 않았다면, 그 침묵은 판단이 아니라 누락일 가능성이 높다.**
- **오늘의 값 — 배선이 아니라 사실을 아는 자리다.** ⓐ **공유 키 전수의 커버리지**: 정책 표가 다루는
  키 전수가 각각 *"앱 안 쓰기 경로 0건"* 또는 *"쓰기 경로 전수 + 무효화 자리"* 를 값으로 갖고, 그
  전수를 테스트가 **스스로 센다**. ⓑ **지출 쓰기 대장(두 방향)**: 다섯 경로의 무효화 키 집합을
  **소스의 뮤테이션 구간에서 세어** 대장과 정확히 같은지 본다(경로가 늘거나 집합이 바뀌면 빨개진다).
  ⓒ ⚠️ **갈린 자리마다 빈 문자열이 아닌 이유가 있고, 그 이유가 참인지를 소스로 확인한다** — 오늘의
  이유(*"확정 시점의 `["home"]` 무효화는 flush가 한다"*)는 `sync-controller.ts`의 그 갈래에 그 키가
  실재한다는 사실로 검증된다(`provenBy`). ⓓ **래칫**: 이유 없이 갈린 집합이 0건이다.
- ⚠️ **무효화를 한 줄도 더하거나 지우지 않았다.** 더했다면 옛 값을 받아오는 화면을 만들었을 것이고,
  지웠다면 flush가 덮는 범위를 좁혔을 것이다. **이 트랙이 만든 것은 동작이 아니라 그 동작이 왜
  옳은지를 아는 자리이고**, 그래서 **화면 0건 · 신선도 값 0건 · 서버 0건**이다.
- ⚠️ **X-3과 다른 점 하나를 값으로 적는다.** X-3에서 덮고 있던 것은 **전역 기본값**이라 그것을
  **조이려는 사람**이 구멍을 처음 만났다. 오늘 덮고 있는 것은 **다른 경로**라, 그것을 만나는 사람은
  **flush의 무효화 목록을 손보는 사람**이다 — ⚠️ **그 사람은 지출 화면을 열지 않으므로 자기가 무엇을
  깨뜨렸는지 볼 수 없다.** 그래서 대장의 재개 조건이 *"flush의 무효화가 조건부가 되는 날"* 이다.
- **일반형.** **덮는 것이 기본값이든 다른 경로든 성질은 같다 — 덮는 것을 손보는 사람이 그 구멍을 처음
  만난다.** 그리고 **그 사실이 어딘가에 적혀 있지 않으면, 그 사람은 자기가 손보는 것이 무엇을 덮고
  있었는지 알 방법이 없다.** ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 앱에서 **한 경로의
  올바름이 다른 경로에 의존하는 자리가 몇이고, 그중 그 의존이 값으로 적힌 것이 몇인가**(오늘 셋을
  적었고, 형제 키 둘은 이미 적혀 있었다).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 라운드 86 **AA-R ①**이 그 모양 하나를 값으로 적었고(연결 판정이 *첫* 실패의 판정에 의존한다 — 오늘도 재실측했고 재개 조건 미도래), 오늘 **AB-3**이 같은 축의 화면 자리 하나를 닫는다.
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 오늘 닫힌 자리에서 의존하고 있던 것은 캐시나 flush가 아니라 **옆 갈래의 문장**이었다 — 버튼의 뜻이 그 문장에 기대고 있었고, 그 의존은 어디에도 적혀 있지 않았다.
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### Y-5. **가장 자주 인용되는 문서가 자기를 세는 계약이 가장 없는 문서였다** — 절대 규칙 스무 줄 중 가드 열일곱 · 없음 셋

- **사실.** `docs/dev/do-not-change.md`는 이 저장소의 절대 규칙이고 CLAUDE.md·AGENTS.md·
  CODEX_START_HERE.md가 모두 그 파일을 첫 줄로 가리키며 테스트 주석은 조항 ID를 수백 번 인용한다.
  ⚠️ **그런데 U-5가 라운드 80에 물은 그 질문(*"기계가 지키지 않는 조항이 무엇인가"*)은 네 라운드 동안
  답이 적히지 않았고**, 처음 실측하니 **그 문서에 줄이 늘거나 문구가 완화돼도 빨개지는 자리는
  사실상 없었다.**
- ⚠️⚠️ **오늘의 값은 대장이다 — 조항 스무 줄 전수를 파싱해 각각에 둘 중 하나를 붙인다.**
  ① **가드 있음** — 가드 파일 경로 + **그 단언을 특정하는 소스 줄**(실재를 확인한다) ·
  ② **가드 없음** — **빈 문자열이 아닌 이유 + 재개 조건**. 실측 결과는 **가드 열일곱 · 없음 셋**
  (`DNC-001`·`DNC-016`·`DNC-019`)이고 **래칫이 그 값에 걸린다.**
- ⚠️⚠️ **판정 기준을 먼저 세운 것이 이 트랙의 절반이다 — 그러지 않으면 대장이 면제부가 된다.**
  ⓐ **인용은 가드가 아니다**: 주석에 조항 ID가 적혀 있다는 사실은 아무것도 막지 않으므로, 가드 칸은
  **주석이 아닌 줄에 선 단언**만 받는다(판정기가 그것을 기계로 강제하고, 그 판정기 자신을 픽스처로
  실증한다). ⓑ **이웃의 가드로 세탁하지 않는다**: 이웃 조항의 가드가 위반의 **증상 하나**를 부수적으로
  잡는 것은 그 이웃의 가드다. ⓒ **대장은 자기 자신을 가드로 세지 않는다** — 세는 순간 *"가드 있음"* 은
  *"대장에 줄이 있다"* 는 말이 된다.
- ⚠️⚠️ **그 기준으로 다시 재니 정찰의 예측과 둘이 갈렸고, 갈린 둘이 이 판정의 값이다.**
  ⓐ **`DNC-005`(기술 스택)는 인용이 0건인데 가드는 있다** — 다른 목적의 단언 하나가 모바일
  의존성 이름 **전수**를 못 박고 있어서, 그 넷 중 하나라도 갈아 끼우면 빨개진다. ⚠️ **그 단언은
  DNC-005를 인용조차 하지 않으므로, 그 파일이 완화되는 날 이 조항은 *조용히* 무가드가 된다** —
  이제는 대장이 먼저 빨개진다. ⓑ **`DNC-001`(포지셔닝)은 인용이 둘인데 가드는 없다** — 둘 다 주석이다.
  **인용 수로 재면 답이 둘이고 단언으로 재면 셋이다.**
- ⚠️ **가드를 이번에 만들지 않은 것이 판단이다.** 비어 있는 셋에 무엇을 어떻게 막을지는 **각각 다른
  축의 결정**이고(부정 스윕의 모집단 · *"무엇을 비밀값으로 볼 것인가"*), 서두르면 그 가드가 곧
  면제부가 된다(W-2가 이름 목록에 대해 내린 그 경고다). **먼저 세는 것이 이 트랙의 전부이고, 셋 다
  이유와 재개 조건을 값으로 진다.**
- ⚠️ **덤으로 정찰의 문장 하나가 정정됐다**: *"문서 자체를 읽는 계약은 하나"* 가 아니라 **둘**이다 —
  다만 둘째가 무는 것은 **"규칙 목록의 사본이 둘 이상 있지 않다"** 는 문서 위생이지 **어느 조항의
  내용도 아니다.** **조항 하나를 실제로 지키는 것은 여전히 하나뿐이고, 그 사실이 이 대장이 선 이유다.**
- **일반형.** **가장 자주 인용되는 문서가 자기를 세는 계약이 가장 없는 문서일 수 있다** — 인용이 많다는
  사실이 지켜진다는 증거로 읽히기 때문이다(O-3이 이름 붙인 병의 가장 큰 사례가 판정 문서가 아니라
  **계약 문서**에 있었다). ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소가 **문서를 읽어 지키는
  계약이 몇이고 그 문서들이 어느 것인가**(오늘 그 목록에 하나가 늘었고, 절대 규칙 문서에 대해서는
  **조항별로** 세는 자리가 처음 생겼다).
- ⚠️⚠️ **갱신 (2026-08-31 · 라운드 88 트랙 F) — 되짚어 보니 이 질문은 *아직 전수로 답해지지 않았다.***
  네 라운드가 지나는 동안 그 목록에 자리가 더 늘었지만(라운드 85 E의 DNC 대장 셋 · 라운드 83 C의
  어드민 카드가 인용하는 **N-4**의 문턱 · 라운드 75 C의 확인의 표 계약), **문서를 읽어 지키는 계약의
  전수를 센 라운드는 아직 없다.** ⚠️ **적어 두지 않으면 이 자리는 다음 라운드에도 *답해진 질문*으로
  읽힌다** — 그래서 오늘 이 줄이 하는 일은 답을 옮겨 적는 것이 아니라 **답이 없다는 사실을 값으로
  적는 것**이고, 같은 질문을 **AC절 끝의 다섯**에 다시 세워 다음 라운드의 목록에 올린다(AA-5가 이름
  붙인 그 규율: 셀 수 있는 모양으로 다시 적지 않으면 질문은 라운드를 건너 살아남되 아무도 답하지
  않는다). ⚠️ **이 되짚는 줄은 라운드 87이 *따로 세지 않았다*고 적어 둔 나머지 **다섯** 중 하나다**
  (그 다섯을 세는 자리는 **AC-5**다).

## Z. 라운드 85에서 확정한 판정 (2026-08-30 · GAP-085 트랙 F)

라운드 84가 물은 것이 **규칙을 화면의 술어에 맞췄는데 그 술어로 일하는 사람의 도구는 같은 술어인가**
였다면, 라운드 85의 물음은 그 한 칸 **앞**이다 — **전제를 넓힌 라운드는 그 전제를 *이유로 대는* 자리를
함께 세었는가.** 축은 라운드 81~84와 같이 **사용자 가치**였고(핵심 루프 1·2·5단계 · 화면 품질 ·
운영자 도구 · 절대 규칙의 가드), 다섯 판정 다 K~Y절과 같이 **결함 보고가 아니라 다음 결정의 입력**
이며 2026-08-30 소스에서 확인됐다(라운드 85 트랙 A·B·C·D·E 머지 후).

⚠️⚠️ **이번 라운드의 가장 값진 관측: 전제를 넓힌 라운드는 그 전제를 *이유로 대는* 자리를 함께
세어야 한다**(Z-1). GAP-058 #6이 제안의 모집단을 *"이번 달 한 달치"* 에서 **두 달치**로 넓히면서 그
이유를 정확히 적었는데(*"매달 1일 아침에 캐시가 거의 비어 있다"*), **같은 두 화면에서 같은 전제를
이유로 침묵하던 형제 소비자 둘**(빠른 기록의 맥락 한 줄 · 지출 상세의 *"이 품목 이력"*)은 그대로
남았다. 그래서 오늘 그 둘의 머리말에는 **거짓이 된 전제**가 근거로 살아 있었다 —
*"이 화면이 가진 캐시는 이번 달 한 달치뿐"* · *"이번 달 캐시 한 달치만 본다."*
⚠️ **전제를 바꾼 라운드가 세어야 하는 것은 그 전제를 *쓰는* 자리가 아니라 그 전제를 *이유로 대는*
자리다** — 앞의 것은 컴파일러가 찾아 주고, 뒤의 것은 **주석에만** 있다.

⚠️⚠️ **두 번째 관측: 응답의 필드를 버리는 `map` 한 줄이 화면의 표현력 상한을 그 자리에서
정한다**(Z-2). 추이 응답의 각 점은 `{ yearMonth, totalExpenseKrw }`인데 리포트 화면이 절반을 버려,
차트는 **어느 달의 얼마인지**를 눈으로도 소리로도 말하지 못했다. ⚠️⚠️ **그리고 그 상태가 계약으로
고정돼 있었다** — 낭독 문자열을 **글자 단위로** 무는 단언이 있어서 *덜 말하는 상태가 회귀가 아니라
기준선*이었고, 접근성 체크표 13행은 그 자리에 대해 *"추세를 문장으로 듣는다"* 고 적고 있었다.
**버려진 필드는 다음 라운드에 *"데이터가 없다"* 로 읽힌다.**

⚠️⚠️ **세 번째 관측: 운영자 도구가 앱과 다른 질문을 하는 자리는 하나씩 발견되는 것이 아니라, 앱이
화면의 축을 바꿀 때마다 그 축만큼 생긴다**(Z-3). 라운드 84가 찾은 것은 *"앱이 강조하는 버튼이 서지
않는 준비템을 운영자가 볼 수 없다"* — **만들 수 있는 손**이었고, 오늘 찾은 것은 *"앱이 목록을 묶는
축(분류)을 운영자가 볼 수도 고를 수도 없다"* — **묶는 축**이다. 둘 다 그 갈래를 만드는 손이 정확히 그
화면이고, 둘 다 **시드가 0건이라 계약이 조용했다.** **Y-1은 한 번으로 끝나는 모양이 아니었다.**

⚠️⚠️ **네 번째 관측: 재개 조건에는 사건형과 결정형이 있고, 결정형은 어느 라운드가 자기 일로 집어
들지 않으면 영원히 미도래로 남는다**(Z-4). 이 문서의 재개 조건 대부분은 **사건**을 기다리고(*"카탈로그가
문턱에 닿는 날"* · *"새 뿌리가 생기는 날"*) 그런 조건은 저절로 도래해 대개 그때 누군가 알아챈다.
그런데 DNC-016·019의 조건은 **결정**을 기다렸다(*"부정 스윕의 모집단이 결정되는 날"* · *"무엇을
비밀값으로 볼 것인가가 결정되는 날"*). ⚠️ **오늘 트랙 E가 DNC-016을 자기 일로 집어 들었고, 그러자
그 조건은 도래했다** — 그리고 그 도래가 **DNC-001에 매달려 있던 가설 하나를 값으로 반증했다**
(*"그 스윕의 모집단이 이 조항의 첫 가드가 된다 — 같은 축이다"* 는 거짓이었다). **결정형 조건은
기다림의 대상이 아니라 배정의 대상이다.**

⚠️⚠️ **다섯 번째 관측: 성능은 오늘 세 축 전부에서 *"값 0건"* 이었고, 그 0건은 재어 보기 전에는 알 수
없었다**(Z-5). 첫 페인트는 **대장이 이미 세고 있었고**(그 최대치를 더 줄이는 것은 라운드 82가 재고
기각했다), 번들은 **의존성 목록이 세는 자리**이며 새 의존성을 드는 트랙이 0건이고, api의 루프 여덟은
전부 **행 수가 아니라 정의 수·단계 수**에 비례했다. ⚠️ **유일하게 남은 자리 하나(준비템 탭의 파생이
렌더 본문에 있는 것)마저 그 화면의 검색이 디바운스라, 근거로 댈 수 있는 것이 *"메모가 없다"* 뿐이었다
— 그래서 세우지 않았다.** **수치 실측 없는 성능 제안은 다음 라운드에 그대로 되돌아온다.**

⚠️⚠️ **이월 다섯은 전부 보류 유지이고 재실측 값만 갱신했다 — 갱신 한 줄씩은 그 판정이 사는 절에 있다**
(다음 라운드가 같은 실측을 다시 돌리지 않도록 여기서는 자리만 가리킨다).

- **이 스캐너가 쿼리로 분류한 자리의 낭독** — 재실측 상태 변화 0, A-20 #85 선행 → **U절 머리말**.
- **`monthly_wrapup`의 달 이동 구멍** — 게이트가 읽는 것은 여전히 대기 행의 바뀐 뒤 날짜 하나 → **U-3**.
- **S-3(어드민 `disabled`)** — 재실측 **열하나**(items 6 · links 5), 브라우저 확인 `#130` 선행 → **U절 머리말**.
- **`withdrawn_at`** — 저장소 전체 **3건 · 파일 둘**, 컬럼 신설은 여전히 별도 결정 → **U절 머리말**.
- **`/budget` 겹침 착지** — `URL_OVERLAPS` 여전히 **둘**, 확인의 표 `#133` 대기. ⚠️ **이 이월의 갱신
  줄은 U-5에 더하지 않는다** — 그 절의 질문(*"DNC 스무 줄 중 기계가 지키지 않는 것"*)에는 라운드 84가
  전수로 답했고 오늘 상태 변화가 0이라, 같은 답을 다시 쓰면 **그 자체가 계약 밖의 사본이 된다**(O-3).
  여기 적힌 한 줄이 그 이월의 오늘 값이다.

**다섯 다 2026-08-30 재실측이고 상태 변화 0이다.** ⚠️⚠️ **그리고 라운드 84에 이어 이번에도 접점이
하나 있었다: 트랙 D가 S-3이 사는 파일(`apps/admin/app/items/page.tsx`)을 쓰기로 열었다.** 그 트랙의
금지 조항이 `disabled={readOnly}` **여섯 자리의 바이트 불변**을 명시했고, 머지된 소스에서 그 여섯
자리는 한 글자도 달라지지 않았다(트랙 D가 그 파일에 더한 것은 분류 열 한 칸 · 체크박스 한 줄 ·
필터 상태 한 칸이다). ⚠️ **두 라운드 연속으로 같은 파일이 열렸는데 같은 자리가 한 번도 겹치지 않았다는
사실 자체가 값이라** U절 머리말의 S-3 줄에 함께 적었다 — 다음 라운드가 *"두 번이나 그 파일을 열었으니
S-3도 움직였겠지"* 로 읽지 않도록. 나머지 넷은 접점 0건이다(⚠️ 어느 트랙도 `apps/api/src`·`prisma/`·
`src/offline/**`·`src/notifications/**`·`app/**`의 라우트 파일을 **쓰기로** 열지 않았다).

⚠️⚠️ **Y-1~Y-5가 남긴 *"먼저 세어 볼 만한 것"* 다섯 전수와 오늘의 답이다 — 발동 하나 · 0건 하나 ·
이미 적혀 있음 하나 · 목록으로 답함 하나 · 메타 하나.** ⚠️ **수치는 여기 옮겨 적지 않고 그 수를 세는
자리를 가리킨다**(O-3·X-4의 규율 — 옮겨 적힌 수는 계약 밖의 사본이고, 아래 답의 상당수는 **계약이
아니라 정찰이 손으로 잰 수**라 더욱 그렇다. 전수와 실측값은 `docs/5차/round85-scout.md`의
**선행 확인 3~6·11**이 든다).

- **Y-1**(운영자 도구 중 **앱 화면의 술어와 다른 질문을 하는 것이 몇인가**) — ⚠️ **발동했다.** 어드민의
  판정 모듈 여섯 중 앱에도 같은 축이 있는 **넷**을 앱의 정본과 하나씩 견줘 **갈린 둘**(준비템 검색 ·
  분류 축)을 찾았고, 둘이 한 화면의 한 축이라 **트랙 D 하나로 묶였다**(Z-3). 나머지 둘(링크 술어 ·
  가격 신선도)은 **같다** — 앞엣것은 라운드 84 A가 맞췄고 뒤엣것은 미러 스윕이 문다. ⚠️ **재개 조건:
  앱이 화면의 축을 또 바꾸는 날**(그 라운드가 같은 질문을 자기 몫으로 진다).
- **Y-2**(오늘 열여섯이 남긴 새 문장 중 **다음 라운드가 실제로 답한 것이 몇인가**) — **메타이고 이 절이
  그 답이다.** Y-1~Y-5의 다섯 전수에 오늘 답이 적혔다(이 목록이 그것이다). ⚠️ **나머지 열하나를 다시
  세지 않은 것도 답이다** — 라운드 84가 값 또는 재개 조건으로 닫았고 오늘 상태 변화가 0이라, 다시 쓰면
  **그 자체가 사본이 된다**(U-2·U-5·W-2·W-3·W-5·X-1~X-5는 이번 라운드에 갱신 0건이다).
- **Y-3**(한쪽 앱에만 있는 대장·스윕 중 **반대쪽에 같은 필요가 있는 것이 몇인가**) — ⚠️ **오늘 값 0건.**
  저장소를 훑는 스윕의 모집단을 셋(모바일 · 어드민 · api+packages)으로 갈라 전수를 견줬고, 어드민 쪽
  여섯은 전부 **Next.js 라우트 구조**(뿌리 · 역할 게이트 · 문구 · API 표면)를 묻는데 모바일에는 그
  구조가 없다. 반대 방향에서 어드민에 같은 필요가 있던 하나는 **라운드 84 C가 이미 옮겼다.**
  ⚠️ **재개 조건(사건형): 어느 한쪽에 새 스윕이 서는 날** — 그날 그 트랙이 반대쪽에 같은 축이 있는지를
  함께 묻는다.
- **Y-4**(한 경로의 올바름이 **다른 경로에 의존하는 자리** 중 그 의존이 값으로 적힌 것이 몇인가) —
  **이미 적혀 있다.** 실측한 여섯이 **여섯 다** 그 의존을 소스에 문장으로 지고 있었고(지출 쓰기 세
  화면의 `["home"]` · 연결 지출의 `["items"]`·`["item-detail"]` · `["children"]`의 신선도 · 맥락 한
  줄의 합계 규칙 · *"이 품목 이력"* 의 모집단 · 판매처 제안의 매칭), 그중 둘은 **이번 라운드가 손댄
  모듈**이라 그 문장을 다시 확인했다. ⚠️ **재개 조건(사건형): 그런 자리가 하나 더 생기는 날, 또는 위
  여섯 중 하나의 의존이 끊기는 날.**
- **Y-5**(저장소가 **문서를 읽어 지키는 계약이 몇이고 그 문서들이 어느 것인가**) — **목록으로 답했다.**
  `packages/test-utils/src`에서 `docs/**`를 읽는 계약은 **여섯**이고(그중 하나가 라운드 84 B의 DNC
  대장이다), 그 여섯이 읽는 문서와 무는 축은 정찰 노트가 값으로 든다. ⚠️ **그리고 Y-5가 적어 둔
  갈림이 오늘도 그대로다** — *읽는 것*과 *조항·값을 지키는 것*은 다르고, 문서의 내용 한 줄과 코드를
  **글자로 대조**하는 것은 그중 셋뿐이다. ⚠️ **이 축에 새 후보는 0건이었고, 오늘 값진 것은 *"문서가
  몇인가"* 가 아니라 **그 대장의 무가드 셋이 언제 열리는가**였다 — 그것이 트랙 E가 됐다**(Z-4).
  ⚠️ **재개 조건(사건형): 문서를 읽는 계약이 새로 서는 날.**

⚠️⚠️ **이번 라운드가 실측하고 기각한 여덟을 값으로 남긴다 — 전부 재개 조건과 함께**(V-2가 세운 규율:
조건 없는 보류는 이유가 적혀 있다는 이유로 재론되지 않는다). ⚠️ **그중 둘은 재개 조건이 *결정형*이라는
사실을 함께 적는다**(Z-4의 이행 — 결정형 조건은 아무 사건도 일으키지 않으므로, 적어 두지 않으면 다음
라운드가 그것을 *"아직 안 왔다"* 로 읽고 지나간다).

- **Y-3의 0건(한쪽 앱에만 있는 대장·스윕) — 재었고 제안하지 않는다.** 위 목록의 그 답이다.
  ⚠️ **재개 조건(사건형): 어느 한쪽에 새 스윕이 서는 날.**
- **Y-4의 *"이미 적혀 있다"*(경로 사이의 의존) — 재었고 제안하지 않는다.** 여섯 다 이유가 소스에 있다.
  ⚠️ **재개 조건(사건형): 그런 자리가 하나 더 생기는 날 또는 여섯 중 하나의 의존이 끊기는 날.**
- **Y-5의 목록(문서를 읽는 계약) — 재었고 새 후보가 0건이라 제안하지 않는다.**
  ⚠️ **재개 조건(사건형): 문서를 읽는 계약이 새로 서는 날.**
- **성능 넷 — 재었고 넷 다 제안하지 않는다**(Z-5). ⓐ **첫 페인트**: 대장이 이미 세고 그 최대치를 더
  줄이는 것은 라운드 82가 재고 기각했다(⚠️ **트랙 C가 그 화면을 열었지만 쿼리는 한 줄도 더하거나
  미루지 않았다**) — **재개 조건(사건형): 그 화면이 첫 페인트를 늘리는 날.** ⓑ **렌더 비용**: 준비템
  탭의 파생이 렌더 본문에 있는데 그 검색은 **디바운스된 뒤에야** 부모 상태를 바꾸고 오늘 카탈로그가
  작아, 근거로 댈 수 있는 것이 *"메모가 없다"* 뿐이다 — **재개 조건(사건형): 활성 카탈로그가 N-4의
  문턱에 닿는 날**(그 수를 세는 자리는 라운드 83 C의 어드민 카드다) **또는 그 탭의 프레임 시간을
  실기기에서 재는 자리가 생기는 날.** ⓒ **번들**: 새 런타임 의존성을 드는 트랙이 이번에도 0건이다 —
  **재개 조건(사건형): 새 의존성이 드는 날.** ⓓ **api의 루프 여덟**: 비례하는 것이 *행 수*가 아니라
  **정의 수·단계 수**라 배치화의 값이 0에 가깝고, 실제로 비례하던 둘은 라운드 81 E·82 C가 이미 뗐다 —
  **재개 조건(사건형): 루프의 반복 수가 사용자 데이터에 비례하는 자리가 새로 생기는 날**(상한 대장이
  그 자리를 이미 센다).
- **기록 탭 검색이 분류 이름을 보지 않는 것 — 재었고 제안하지 않는다.** 라운드 81 D가 준비템 탭에서
  고친 것과 **모양은 같지만 갈리는 지점이 둘**이다: ⓐ 이 화면에는 **분류 칩 줄이 검색칸 바로 아래에**
  있고 오늘 그 줄이 정규 열둘을 전부 세우며(CAT-124), ⓑ placeholder가 훑는 곳을 **정확히 말한다**
  (*품목명 · 판매처 · 메모* — `RECORDS_SEARCH_FIELDS_LABEL`이 단일 소스다). 라운드 81 D가 고친 것은
  *약속과 판정이 갈린* 자리였는데 **여기서는 약속이 참이다.** ⚠️⚠️ **재개 조건이 결정형이다: 그 칩 줄을
  좁히기로(선택 가능한 분류만 세우기로) 정하거나 placeholder가 분류를 약속하게 되는 날** — 둘 다
  저절로 일어나는 사건이 아니라 **문구·정책 결정**이라, 어느 라운드가 그 결정을 자기 일로 집어 들지
  않으면 이 자리는 영원히 조용하다.
- **온보딩 준비물 화면의 조회 실패 문구 — 재었고 제안하지 않는다(다만 이유의 첫 항이 낡았다).**
  오프라인 대장의 제외 이유 셋 중 첫 항(*"조회 실패와 0건이 같은 조건을 나눠 쓴다"*)은 **오늘 거짓**
  이다 — 소스는 이미 `itemsQuery.isError`로 두 문장을 가른다. 나머지 둘(*카드가 아니다* · *더 구체적인
  탈출구 문장이 있다*)은 그대로 참이고, 배선은 여전히 **더 좋은 문장을 공용 문장으로 후퇴시키는 일**
  이라 **제외 판정은 유지**한다. ⚠️ **낡은 첫 항은 다음 트랙이 그 파일을 열 때 곁다리로 정정한다 —
  이번 라운드는 `src/offline/**`를 연 트랙이 0건이다.** ⚠️⚠️ **재개 조건이 결정형이다: 그 화면에
  [다시 시도] 버튼이 서는 날** — 그것은 관측되는 사건이 아니라 **그 화면의 탈출구를 바꾸겠다는 결정**
  이고, 그 결정이 서야 공용 문장이 가리키는 행동이 실제로 그 자리에 생긴다.
- **결제 수단 기본값이 언제나 카드인 것 — 오늘 새로 재었고 제안하지 않는다.** 그 필드의 소비자는
  **CSV 한 칸과 상세 한 줄**뿐이라 기억해 줄 값이 작다. ⚠️ **재개 조건(사건형): 그 값을 읽는 집계·화면이
  생기는 날.**
- **후보 4에 대시보드 카운트 카드를 하나 더 세우는 것 — 이번에도 세우지 않는다.** 라운드 84가 같은
  자리에서 내린 판단 그대로다 — **이 수는 목록에서 골라내는 것이 값이지 세는 것이 값이 아니고**, 오늘
  그 필터에 걸리는 품목이 시드에 0건이라 카드는 언제나 0을 그린다. ⚠️ **재개 조건(사건형): 이 필터에
  걸리는 품목이 실제로 생기는 날.**

**이 라운드가 짝 문서에 남긴 것.** 확인의 표에 **#148~#151 넷**이 서고(⚠️ **표면은 `실기기` 셋 ·
`브라우저` 하나** — 트랙 E는 **소스 계약이라 표에 행이 서지 않는다**) §0의 여섯 숫자가 파싱으로 다시
세어졌으며, 접근성 표에는 **A-26 #97** 하나가 섰다. ⚠️⚠️ **그래서 `실기기` 행은 라운드 84에 처음으로
늘지 않았다가 이번 라운드에 셋이 늘었고, 그 대비를 §1-1 머리말이 한 줄로 말한다 — *소스 계약만 있던
라운드와 화면을 바꾼 라운드가 이 표에서 어떻게 다르게 보이는가*.** ⚠️ **A-26에는 행 자체가 지지 않는
사실 하나를 함께 적었다**: 접근성 표 13행의 기대 문장(*"추세를 문장으로 듣는다"*)이 **트랙 C 전에는
참이 아니었다**는 사실이다 — **행의 문장은 바이트 불변**이므로 그 사실은 근거 칸이 아니라 A-26의 줄이
진다(Z-2). ⚠️ **C-3(잠금 오버레이 TalkBack 투과)은 오늘로 열아홉 라운드 연속 미확인**이고, 이 절이
그것에 대해 적을 수 있는 것은 경과 수뿐이다 — ⚠️ **다만 이번 라운드에는 새 `실기기` 행이 셋이나
섰는데도 그 칸이 여전히 비어 있고, 그것이 이 줄이 기다리는 것은 우선순위가 아니라 사람·기기·날짜
배정이라는 증거를 한 번 더 준다**(라운드 84는 `실기기`가 0건인데도 비어 있었다 — **0건이든 셋이든
같은 칸이 비어 있다**).

⚠️ **N-4의 두 문턱은 오늘로 여덟 라운드 연속 미발동이고, 준비템 탭 비가상화는 이번에도 제안하지
않는다** — ⚠️ **그 두 수는 화면이 세므로 이 절도 옮겨 적지 않는다**(O-3 · 갱신 한 줄은 N-4에 있다).

### Z-1. **전제를 넓힌 라운드는 그 전제를 *이유로 대는* 자리를 함께 세어야 한다** — 모집단을 두 달로 넓힌 라운드가 "한 달치뿐"을 이유로 침묵하던 형제 둘을 그대로 두었다

- **사실.** GAP-058 #6은 판매처 제안·자동완성의 모집단을 **두 달**로 넓히면서 이유를 정확히 적었다
  (*"매달 1일 아침에 캐시가 거의 비어 있다"*). 그 뒤로 **같은 두 화면이 지난달 캐시를 손에 들고 있다** —
  빠른 기록(`app/expenses/new.tsx`)과 지출 상세(`app/expenses/[expenseId].tsx`) 둘 다 그 값을
  `getQueryData`로 이미 읽는다. ⚠️ **그런데 같은 화면의 형제 소비자 둘은 그 전제가 넓어지기 전의
  이유로 침묵하고 있었다**: `src/expenses/entry-context-line.ts`의 머리말은 *"이 화면이 가진 캐시는
  이번 달 한 달치뿐"* 이라고, `src/expenses/item-history.ts`의 머리말은 *"이번 달 캐시 한 달치만
  본다"* 고 적고 있었다. **둘 다 오늘 거짓이다.**
- ⚠️⚠️ **거짓이 된 것은 코드가 아니라 근거다.** 두 자리의 동작(*모르는 달은 말하지 않는다*)은 여전히
  옳고, 그 판단을 떠받치던 사실만 낡았다 — **컴파일러도 테스트도 근거를 검사하지 않으므로 이런 낡음은
  라운드를 건너 산다.** 형제 소비자가 매달 1일 아침에 어떻게 보였는지가 그 값이다: 30cm 옆의 판매처
  칩은 지난달 상호를 띄우는데 맥락 한 줄과 이력은 **통째로 사라졌다**.
- **오늘의 값 — 인자 둘씩과 삭제된 문장 둘이다.** ⓐ 두 모듈이 **지난달 캐시와 그 달을 선택 인자로**
  받고, 화면은 **이미 손에 든 값**을 넘긴다 — **새 요청 0건 · 새 키 0건**이고 인자를 넘기지 않는
  호출부의 결과는 **바이트 동일**이다(폴백). ⓑ 맥락 한 줄은 기록 날짜가 지난달이면 **그 달의 합계**로
  서고 문구가 **끝난 달의 과거형**이 된다(*"지금까지"* 를 쓰지 않는 것이 부정 단언이다). ⓒ 이력은
  **달마다 따로 재조정한 뒤 잇는다** — `reconcileMonthlyExpenses`가 한 달에 답하는 함수라 두 달을 한
  번에 넣으면 대기 행이 옆 달 모집단에 섞인다(누수가 **양방향으로** 막힌다). ⓓ **범위 고지는 실제로
  센 달에서 파생한다** — 두 달을 보면서 *"이번 달 기준"* 이라고 말하는 것이 이 모듈이 막으려던 바로 그
  허위 표시이고, 지난달 캐시가 없는 날 두 달을 말하는 것도 같은 거짓이다. ⓔ ⚠️ **거짓이 된 문장은
  지웠고, 그 문자열의 *부재*를 테스트가 문다.**
- ⚠️ **두 달보다 넓히지 않은 것이 판단이다.** 셋째 달 캐시를 손에 든 화면은 오늘 0건이고, 없는 캐시를
  부르는 순간 두 모듈의 규칙(*"새 요청 0건"*)이 깨진다. **넓힌 것은 전제가 아니라 캐시다.**
- **일반형.** **전제를 바꾼 라운드가 세어야 하는 것은 그 전제를 *쓰는* 자리가 아니라 그 전제를 *이유로
  대는* 자리다** — 앞의 것은 컴파일러가 찾아 주고, 뒤의 것은 주석에만 있다. ⚠️ **다음 라운드가 먼저
  세어 볼 만한 것**: 이 저장소의 주석 중 **다른 라운드의 전제를 근거로 인용한 것이 몇이고, 그중 오늘
  거짓인 것이 몇인가**(오늘 둘을 고쳤고, 둘 다 같은 GAP 하나를 인용하고 있었다).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 라운드 86의 **AA절 머리말**이 이 질문에 전수로 답했다(기계로 가를 수 있는 부분모집단에서 거짓 0건 · 산문 근거에서 손으로 찾은 거짓 둘).
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 그 답이 남긴 **재개 조건(결정형 · 손은 안)** 은 오늘도 도래하지 않았고, 오늘 집지 않은 이유는 **AB절 머리말의 기각 열셋**에 값으로 있다 — 순서상 *호출부를 세는 기계*가 *주석의 근거를 세는 대장*보다 먼저다.
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### Z-2. **응답의 필드를 버리는 `map` 한 줄이 화면의 표현력 상한을 정한다** — 추이 차트가 어느 달의 얼마인지 눈으로도 소리로도 말하지 못했고, 그 상태가 낭독 계약으로 고정돼 있었다

- **사실.** 추이 응답의 각 점은 `{ yearMonth, totalExpenseKrw }`인데 리포트 화면의 조립이 값만 남겨
  **달을 버렸다.** 그 결과 차트에는 x축 라벨이 없고, 낭독은 *"…추이 차트, 합계 …"* 에서 멈췄다 —
  **그래프를 못 보는 사람에게 이 카드가 말하는 것은 합계 하나뿐**이었다.
- ⚠️⚠️ **그리고 그 상태가 계약으로 고정돼 있었다.** `src/a11y-contract.test.ts`가 그 낭독 문자열을
  **글자 단위로** 물고 있어서, **덜 말하는 상태가 회귀가 아니라 기준선**이었다. ⚠️ **같은 자리에 대해
  접근성 체크표 13행은 *"그래프를 못 봐도 추세를 문장으로 듣는다"* 고 적고 있었다** — 계약은 초록이고
  문서는 참이라고 적혀 있는데, **둘 다 오늘 이전에는 그 문장을 지지하지 않았다.**
- **오늘의 값 — 순수 모듈 하나와 실데이터 갈래 두 자리다.** ⓐ `src/reports/trend-point-labels.ts`가
  `yearMonth`에서 **x축 라벨과 낭독 계열을 파생**한다 — **지어내기 0건**(달을 모르면 축 전체를
  포기하고, 라벨 수가 점 수와 다르면 그리지 않는다). ⓑ 축 라벨은 **플롯 영역의 이미 비어 있는 아래
  여백**에 절대 배치로 들어가 선·점 좌표에 닿지 않고, 바깥 View가 `accessible`이라 라벨이 **하나하나
  따로 읽히지 않는다** — 소리로는 낭독 계열이 대신 말한다. ⓒ 월간·분기·연간이 **한 모듈**을 쓰고,
  금액은 `formatKrw` 하나를 지난다. ⓓ ⚠️ **비세션 미리보기와 점 2개 미만의 장식 폴백은 이 값에 닿지
  않는다** — 그 갈래의 렌더와 낭독은 **바이트 불변**이고 픽셀락이 그것을 지킨다.
- ⚠️ **계약을 고친 것이 이 트랙의 절반이다.** 글자로 무는 그 단언을 **새 문장으로 갱신**했고, 계열
  문구를 **이 파일이 짓지 않는다**는 사실(순수 모듈이 짓는다)과 **실데이터 갈래에만 붙는다**는 조건을
  함께 물게 했다. **낭독을 늘린 라운드가 그 낭독을 무는 계약을 같이 손대지 않으면, 다음 라운드는
  다시 옛 문장을 기준선으로 읽는다.**
- ⚠️ **접근성 표 13행은 한 글자도 바꾸지 않았다** — 기대 문장은 이제 참이고, *"그전에는 참이 아니었다"*
  는 사실은 행이 아니라 **A-26의 줄**이 진다(행의 문장·기대 동작은 바이트 불변이라는 이 문서 쌍의
  규율 그대로다).
- **일반형.** **응답의 필드를 버리는 `map` 한 줄은 화면의 표현력 상한을 그 자리에서 정한다** — 그리고
  그 상한은 시간이 지나면 *"데이터가 없다"* 로 읽힌다(다음 사람은 화면이 버린 것을 볼 수 없다).
  ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 서버 응답의 필드를 **화면이 버리는 자리가 몇이고, 그중
  버린 필드로 화면이 더 말할 수 있었던 것이 몇인가**(오늘 하나를 되살렸고, 그 하나는 **낭독 계약이
  그 상태를 기준선으로 굳히고 있던** 자리였다).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 라운드 86 **AA-4**(모바일 열하나와 그 스윕의 사각)와 **AA-2**(어드민의 호버 한 자리)가 함께 답했다.
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 오늘 그 축의 자리가 하나 더 닫혔다(**AB-1** · 트랙 D) — 이번 필드는 *버려진* 것이 아니라 **응답에 실려 오는데 화면이 한 번도 읽지 않던** 것이었고, 그 값이 없어서 목록 두 줄이 같은 줄이었다.
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### Z-3. **운영자 도구가 앱과 다른 질문을 하는 자리는 앱이 화면의 축을 바꿀 때마다 그 축만큼 생긴다** — 라운드 84는 *만들 수 있는 손*을 찾았고 오늘은 *묶는 축*을 찾았다

- **사실.** 앱의 준비템 탭은 목록을 **분류로 묶어** 그룹 헤더에 그 이름을 크게 그리고, 그 화면의 검색은
  **이름 ∨ 분류 표시명**을 훑는다(라운드 81 D). ⚠️ **그런데 어드민 목록의 열에는 분류가 없었고 분류
  필터도 0건이었으며, 검색은 이름 하나만 훑었다** — **분류를 정하는 칸은 정확히 그 화면의 폼에 있고,
  비우면 그 값이 비어 있는 채로 남는다.**
- ⚠️⚠️ **Y-1의 모양이 두 번째로 나왔고, 이번 것은 *만들 수 있는 손*이 아니라 *묶는 축*이다.**
  라운드 84가 찾은 것은 *"앱이 강조하는 버튼이 서지 않는 준비템을 운영자가 볼 수 없다"* 였고 오늘 것은
  *"앱이 목록을 묶는 축을 운영자가 볼 수도 고를 수도 없다"* 이다. **둘 다 그 갈래를 만드는 손이 정확히
  그 화면**이고, **둘 다 시드에 그 갈래가 0건이라 계약이 조용했다.**
- **오늘의 값 — 열 하나 · 필터 하나 · 술어 한 줄이다.** ⓐ 목록에 **분류 열**(빈 값은 `-`, 이름을 모르는
  경우는 기존 폴백 라벨 — **없는 사실을 단정하지 않는다**). ⓑ **분류 없는 준비템만 보기** 필터
  (⚠️ `null`·빈 문자열만 걸고 **키 부재는 *모름*으로 둔다** — N-8의 방향 그대로). ⓒ 검색이 **이름 ∨
  분류 표시명**이 된다 — 앱과 같은 질문이다. ⓓ ⚠️ **술어의 동치를 계약이 문다**: 어드민 테스트가
  모바일의 판정을 **소스 텍스트로 읽어** 그대로인지 확인한다(어드민은 모바일 패키지를 의존하지 않으므로
  `admin-canonical-mirrors.test.ts`의 그 관례 그대로다) — **모바일이 술어를 바꾸면 어드민 계약이 먼저
  빨개진다.** ⓔ 시드에 분류 없는 준비템이 0건이라 **계약이 그런 항목을 픽스처로 만들어** 열·필터·검색
  셋을 모두 밟는다(*0건인 자리를 계약이 스스로 만들어 세는 것과 0건이라 세지 않는 것은 다르다*).
  ⓕ 곁다리 한 줄 — 링크 필터 주석의 **낡은 시드 수**를 오늘 실측값으로 정정했다(판정·동작 0건 변경).
- ⚠️ **서버 0건 · 새 요청 0건**이다 — 분류 값은 어드민 목록 응답에 **이미** 실려 있었다. ⚠️ **DNC 셋도
  한 줄도 늘거나 줄지 않았다**: 이 트랙은 **세고 고를** 뿐이라 스폰서 링크를 숨기거나 뒤로 미는 변경이
  0건이고(DNC-011), 정렬·추천 점수와 무관하며(DNC-009), 고지 문장이 새로 서지 않는다(DNC-010).
- ⚠️ **분류를 필수 입력으로 만드는 것은 이 트랙의 범위 밖이고 별도 결정이다** — 서버가 생략을
  *"분류 없음"*/*"기존 유지"* 로 나눠 읽는 계약이 있고, 그것을 바꾸는 것은 **카탈로그 정책**이지 코드
  판정이 아니다(**재개 조건: 그 정책이 서는 날** — ⚠️ 결정형이다).
- **일반형.** **운영자 도구가 앱과 다른 질문을 하는 자리는 하나씩 발견되는 것이 아니라, 앱이 화면의
  축을 바꿀 때마다 그 축만큼 생긴다 — 축을 바꾼 라운드가 그 도구를 함께 물어야 한다.**
  ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 앱이 **최근 다섯 라운드에 바꾼 화면의 축이 몇이고, 그중
  운영자 도구가 따라간 것이 몇인가**(오늘 하나를 따라가게 했고, 그 하나는 라운드 81이 앱에 세운
  축이었다 — **네 라운드 동안 갈려 있었다**).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 라운드 86의 **AA절 머리말**이 답했다(운영자 도구에 같은 축이 있는 것 셋 · 둘은 따라갔고 하나가 갈렸다).
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 오늘이 그 질문의 **셋째 이행**이고 방향이 반대다: 이번에 갈린 자리는 앱이 바꾼 축을 어드민이 못 따라간 것이 아니라 **어드민에만 있던 자리**였다(**AB-2**) — 그래서 이 질문은 여전히 *한 번으로 끝나는 모양이 아니다*.
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### Z-4. **재개 조건에는 사건형과 결정형이 있고, 결정형은 집어 들지 않으면 영원히 미도래로 남는다** — 트랙 E가 DNC-016을 집어 들자 조건은 도래했고, 그 도래가 DNC-001의 가설을 반증했다

- **사실.** 라운드 84 B가 세운 DNC 대장은 조항 스무 줄 전수에 **가드 있음**(파일 + 단언을 특정하는 줄)
  또는 **가드 없음**(이유 + 재개 조건)을 붙였고, 무가드 셋(`DNC-001`·`DNC-016`·`DNC-019`)의 조건 중
  둘이 **결정**을 기다렸다 — *"부정 스윕의 모집단이 결정되는 날"* · *"무엇을 비밀값으로 볼 것인가가
  결정되는 날"*. ⚠️ **그리고 DNC-001의 조건 절반은 그 결정에 *매달려* 있었다**(*"DNC-016의 부정 스윕이
  서는 날 — 그 스윕의 모집단이 이 조항의 첫 가드가 된다(같은 축이다)"*).
- ⚠️⚠️ **오늘 트랙 E가 그 결정을 자기 일로 집어 들었고, 그러자 조건은 도래했다.** 범위 밖 여섯이
  **각각 자기 뿌리와 바늘**을 값으로 갖는 부정 스윕이 섰고(뿌리는 여덟 — 스키마의 테이블·열거형·열,
  API 엔드포인트 경로, 앱·어드민 라우트 파일, 의존성 이름, 워커 잡 이름), 여섯의 문구는 **DNC 문서의
  그 행에서 파싱해 대조**하므로 **조항에 일곱째가 붙으면 그 스윕이 먼저 빨개진다.** 오늘 바늘에 걸리는
  자리 둘(가격 스냅샷 두 칸)은 **이유·재개 조건·증명**과 함께 면제 대장에 있고, 그 이유가 참인지를
  같은 계약이 **소스로 다시 확인한다**(이력 테이블 부재 · 주기 잡 부재 — *정직 표시*의 근거이지 가격
  추적이 아니다).
- ⚠️⚠️ **그리고 그 도래가 값 하나를 더 냈다: DNC-001에 적혀 있던 가설이 거짓이었다.** 그 조항이
  이름으로 잠근 포지션 이탈 축은 **셋**(커뮤니티 · 쇼핑몰 · 일반 가계부)인데 새 스윕이 걷는 것은
  **셋 중 하나**뿐이고, 나머지 둘은 무엇이 **생기는지**가 아니라 무엇이 **빠지는지**를 물어야 해서
  **그물의 방향이 반대**다. ⚠️ **그 하나조차 이 조항의 가드가 아니다** — 그 라우트가 서면 빨개지는 것은
  이웃 조항의 항목이고, *이웃의 가드로 세탁하지 않는다*는 것이 이 대장의 판정 기준이다. **그래서
  DNC-001은 무가드로 남기고 이유를 그 사실로 갱신했다**(가설을 지우고 실측을 적었다).
- **오늘의 값 — 래칫이 닫힌 수만큼만 내려갔다.** 실제로 닫힌 것은 **DNC-016 하나**이고 상한은
  **3 → 2**다. ⚠️ **DNC-019는 이번에 열지 않았다** — 그 결정(*"무엇을 비밀값으로 볼 것인가"*)은
  테스트 픽스처의 가짜 값과 진짜 값을 가르는 기준을 세우는 일이라 **축이 다르고**, 두 결정을 한 트랙에
  넣으면 둘 다 서둘러진다(W-2가 이름 목록에 대해 내린 그 경고다). **이유와 재개 조건은 그대로 둔다.**
- ⚠️ **부정(자기 참조)도 값이다** — 새 스윕은 **자기 파일을 모집단에 넣지 않는다**(넣으면 *"금지어가
  적힌 파일"* 이 스스로 위반이 된다). 그리고 대장의 단언 칸이 가리키는 줄은 **여섯을 도는 루프 안**에
  있으므로, 배열이 비거나 항목이 빠지면 0회 돌고도 초록이 된다 — **그래서 모집단으로 그 `for` 줄과
  여섯의 id 전수를 함께 못 박았다.**
- **일반형.** **재개 조건을 적을 때는 그것이 사건인지 결정인지를 함께 적어야 한다 — 결정이라면 그
  결정을 누가 언제 내리는지가 조건의 절반이다.** 사건형 조건은 저절로 도래하고 대개 그때 누군가
  알아채지만, **결정형 조건은 아무 사건도 일으키지 않으므로 배정되지 않으면 영원히 *"아직 아니다"* 로
  남는다.** ⚠️ **이 절이 그 규율을 자기에게도 적용했다** — 위 기각 여덟은 전부 재개 조건과 함께 있고,
  그중 **둘은 결정형이라고 이름 붙여** 두었다. ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 문서의
  재개 조건 중 **결정형이 몇이고, 그중 그 결정의 소유자가 적힌 것이 몇인가**(오늘 하나를 집어 들어
  닫았고, 남은 결정형 하나는 **이유와 재개 조건이 그대로**다).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 라운드 86 **AA-3**과 그 절의 결정형 전수표가 답했다(다섯 · 소유자가 적힌 것 0건 → 그 라운드가 소유자 칸을 채웠다).
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 오늘 그 표가 **아홉**으로 다시 세어졌고(손이 안 넷 · 밖 다섯 — **AB절 머리말**의 전수표), 그중 하나를 집어 그날 닫았다(**AB-3**). ⚠️ **수가 다섯에서 아홉으로 는 것은 조건이 늘어서가 아니라 산문 안에 형이 갈려 있던 것을 전수로 세었기 때문이다.**
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### Z-5. **성능 세 축이 전부 "값 0건"이었고, 그 0건은 재어 보기 전에는 알 수 없었다** — 그리고 마지막 자리 하나는 근거가 "메모가 없다" 뿐이라 세우지 않았다

- **사실.** 이번 라운드는 성능을 **트랙으로 세우지 않았는데, 세우지 않기 위해 세 축을 다 쟀다.**
  ⓐ **첫 페인트** — 화면별 요청 수는 **대장이 `enabled` 식에서 계산하고**(라운드 83 B가 탭 다섯으로
  모집단을 넓혔다), 최대를 더 줄이는 것은 **라운드 82가 재고 기각**했다(그 화면의 실패 판정에 들어가는
  쿼리를 미루면 **실패를 늦게 말하게 된다**). ⓑ **번들** — 모바일의 런타임 의존성 목록이 그 수를 세는
  자리이고 `@wooriai/*`는 하나뿐이다(*계약 패키지를 들지 않는 것*이 수기 미러 관례의 근거다).
  ⓒ **api의 루프** — 루프 안에서 DB를 치는 자리 **여덟**을 전수로 훑었고, **비례가 큰 것은 0건**이다
  (워커 둘은 배치 상한을 이미 지고, 어드민 둘은 한 방씩이며, 온보딩 둘은 **동의 정의 수·단계 수**에
  비례한다). 실제로 행 수에 비례하던 둘은 **라운드 81 E·82 C가 이미 뗐다.**
- ⚠️⚠️ **그 0건들은 재어 보기 전에는 알 수 없었다 — 그리고 세는 값은 낮았다.** 셋 다 **전수 스윕 한
  번**(대장 파싱 · 목록 읽기 · grep)이면 답이 나왔고, 어느 것도 새 계약을 필요로 하지 않았다.
  **비싼 것은 세는 일이 아니라, 세지 않은 채 매 라운드 같은 성능 후보를 다시 세우는 일이다**(Y-2의
  일반형이 성능 축에서 한 번 더 참이었다).
- ⚠️⚠️ **네 번째 자리 하나는 값이 아니라 *근거의 부재* 때문에 세우지 않았다.** 준비템 탭은 검색어가
  상태인데 파생 전부(분류 이름 해석기 · 필터 · 그룹 조립)가 **렌더 본문**에 있다 — 라운드 42 L-5가
  지출 상세에 대해 뗀 그 비용의 모양이다. ⚠️ **그런데 그 화면의 검색은 디바운스된 뒤에야 부모 상태를
  바꾸고, 오늘 카탈로그는 작다** — 그래서 정찰이 근거로 댈 수 있는 것이 *"메모가 없다"* 뿐이었다.
  **수치 실측 없는 성능 트랙은 이 저장소의 규율 밖이므로 세우지 않고, 재개 조건과 함께 기각했다.**
- ⚠️ **수는 여기 옮겨 적지 않는다.** 첫 페인트는 **대장이**, 카탈로그 크기는 **라운드 83 C의 어드민
  카드가**, 의존성은 **그 목록 자신이** 센다 — 옮겨 적는 순간 이 절이 그 계약들 밖의 사본이 된다
  (O-3·X-4). **이 절이 남기는 것은 값이 아니라 *어디가 세는가*와 *언제 다시 물어야 하는가*다.**
- **일반형.** **성능은 "느껴진다"로 열 수 없고 "재었다"로만 열 수 있다 — 그리고 재는 비용이 낮다면 답이
  0건이어도 그 0건을 적는 것이 그 라운드의 값이다.** 적지 않으면 같은 후보가 다음 정찰의 목록에 다시
  오르고, 다시 재어지지 않은 채 다시 적힌다. ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 문서가
  기각한 성능 후보 중 **재개 조건이 실제로 도래한 것이 몇인가**(오늘 넷을 기각했고, 그중 하나의 조건은
  **N-4의 문턱**이라 **세는 자리가 이미 있다** — 나머지 셋은 사람이 알아채야 한다).
- ⚠️ **갱신 (2026-08-31 · 라운드 88 트랙 F) — 답한 자리를 되짚는다.** 라운드 86 **AA절 머리말**, 라운드
  87 **AB절 머리말**, 라운드 88 **AC절 머리말**의 기각 목록이 그 넷을 매 라운드 다시 재어 **세 라운드
  연속 넷 다 미도래**로 답했다(⚠️ **수는 여기 옮겨 적지 않는다** — 앞의 하나는 N-4의 문턱을 세는
  어드민 카드가, 번들은 의존성 목록 자신이 센다 · O-3·X-4). ⚠️ **그리고 그 세 번의 답이 값인 이유는
  *0건이 세 번 반복됐다*가 아니라 *재는 비용이 세 번 다 낮았다*는 것이다** — 질문이 셀 수 있는 모양
  이라 매 라운드 다시 재어졌다(AA-5의 두 조건). ⚠️ **이 되짚는 줄은 라운드 87이 *따로 세지 않았다*고
  적어 둔 나머지 **다섯** 중 하나다**(그 다섯을 세는 자리는 **AC-5**다).

## AA. 라운드 86에서 확정한 판정 (2026-08-31 · GAP-086 트랙 F)

라운드 85가 물은 것이 **전제를 넓힌 라운드는 그 전제를 *이유로 대는* 자리를 함께 세었는가** 였다면,
라운드 86의 물음은 그 한 칸 **옆**이다 — **무엇을 어디로 옮긴 라운드는, 옮기지 *못한* 나머지 절반이
어디로 갔는지를 세었는가.** 축은 라운드 81~85와 같이 **사용자 가치**였고(핵심 루프 3단계 · 온보딩 ·
가족 · 운영자 도구 · 절대 규칙의 가드), 다섯 판정 다 K~Z절과 같이 **결함 보고가 아니라 다음 결정의
입력**이며 2026-08-31 소스에서 확인됐다(라운드 86 트랙 A·B·C·D·E 머지 후).

⚠️⚠️ **이번 라운드의 가장 값진 관측: 판정을 옮긴 라운드는 옮기지 못한 절반의 행방을 함께 세어야
한다**(AA-1). DSN-053 P2-B가 준비템 목록을 승인 디자인의 타일 그리드로 옮기면서 **목록 배지 판정의
절반(준비 상태)** 은 타일의 상태 pill이 이어받았는데, **나머지 절반(필수도)이 이어받은 자리는 0건**
이었다. 그런데 ⚠️ **그 축의 필터는 목록 위에 그대로 서 있었다** — 사용자는 [필수] 칩으로 **고를 수는
있는데** 칩을 끄는 순간 무엇이 필수였는지 화면에서 사라졌고, 그 판정을 담은 함수는 **호출부 0건인 채
계약만 초록**이었다. ⚠️ **화면이 부르지 않는 판정에 남은 계약은 다음 사람에게 *"이미 그렇게 그린다"*
로 읽힌다** — 그 머리말이 실제로 그렇게 적혀 있었고, 그것이 이 라운드가 고친 두 번째 것이다.

⚠️⚠️ **두 번째 관측: 값을 마우스에만 주는 화면은 값을 버린 화면과 같은 자리에 선다**(AA-2). 라운드 85
C가 앱의 추이 차트에 각 점의 이름을 돌려준 뒤에도, 운영자의 분석 화면은 각 막대의 값을 `title` 속성
**하나로만** 줬다 — 호버는 마우스에만 열리고 막대는 포커스를 받지 않으며 `role="img"` 컨테이너의
자식은 보조기술에 개별 노출되지 않으므로, **키보드·스크린리더 운영자에게 그 카드의 값은 0개**였다.
⚠️⚠️ **그리고 옳은 형식이 같은 저장소의 형제 화면에 이미 있었다** — 클릭 통계 화면은 같은 모양의
막대 아래에 **날짜·건수 표**를 이미 그리고 있었다. **없어서 못 한 것이 아니라, 옆 화면에 있는 것을
따라가지 않은 것이다.** Z-2의 일반형이 한 칸 넓어진다: *버려진 필드*뿐 아니라 **호버로만 도달하는
값**도 다음 사람에게는 *"데이터가 없다"* 로 읽힌다.

⚠️⚠️ **세 번째 관측: 결정형 조건 중에는 그 결정을 내릴 손이 이 저장소 안에 있는 것이 있고, 그것은
조건이 아니라 미배정 작업이다**(AA-3). Z-4는 재개 조건을 사건형과 결정형으로 갈랐는데, 오늘 결정형
다섯을 전수로 세어 각각 *"그 결정을 내릴 손이 어디에 있는가"* 를 붙여 보니 **손이 저장소 안에 있는
것이 셋**이었다. 그런 조건은 기다릴 대상이 아니라 **어느 라운드가 자기 몫으로 지면 그날 도래하는
것**이고, 오늘 트랙 B·E가 둘을 그렇게 닫았다. ⚠️⚠️ **그리고 트랙 B가 집어 든 조건에서 값 하나가 더
나왔다: 그 조건의 전제 자체가 부분 거짓이었다.** Z절은 *"그 화면에 [다시 시도] 버튼이 서는 날"* 을
조건으로 적었는데 — **그 버튼은 이미 서 있었다.** 없던 것은 버튼이 아니라 *"지금은 오프라인이에요"*
라고 말하는 **문장 쪽**이었고, 그래서 배정된 일은 *버튼 세우기*가 아니라 **오프라인 배선**이었다.
⚠️ **자기가 자기를 기다리는 조건은 오래 서 있는 동안 전제까지 낡는다.**

⚠️⚠️ **네 번째 관측: 스윕의 결과에는 그 스윕이 구조적으로 못 보는 것을 함께 적어야 한다 — 수는
상한이 아니라 하한이다**(AA-4). Z-2가 남긴 질문(*"화면이 버리는 응답 필드가 몇인가"*)에 답하려고
응답 타입의 필드 전수를 뽑아 이름이 한 번도 나오지 않는 것을 셌더니 **열하나**가 나왔고, 하나씩
판정해 **열은 값이 0**이었다. ⚠️ **그런데 값이 있던 하나는 그 열하나 안에 없었다** —
`PendingInvite.createdAt`은 `createdAt`·`id`·`status`처럼 **여러 타입이 공유하는 흔한 이름**이라
이름 기반 스윕이 다른 타입의 같은 이름과 구분하지 못했고, **정확히 그 사각에 있던 하나가 되돌릴 수
없는 [취소]의 대상을 구별하는 값**이었다. **그 사각을 함께 적지 않으면 다음 라운드는 열하나를
전수로 읽는다.**

⚠️⚠️ **다섯 번째 관측: 라운드가 남기는 가장 싼 자산은 다음 라운드가 셀 수 있는 질문이다**(AA-5).
Z-1~Z-5가 각 절 끝에 남긴 *"다음 라운드가 먼저 세어 볼 만한 것"* 다섯 중 **넷이 발동해 오늘 다섯
트랙 중 넷이 됐다**(Z-1 → A·B의 곁다리 · Z-2 → C·D · Z-3 → D · Z-4 → B·E). ⚠️ **세어 보니 셋은
이미 화면에 있는 결함이었다** — 질문을 남기는 데 든 비용은 문장 한 줄이었고, 그 문장이 없었다면
오늘의 정찰은 같은 자리를 처음부터 다시 찾아야 했다. **Y-2 규율의 네 번째 이행이고, 지금까지 중
수확이 가장 컸다.**

⚠️ **되짚는 줄 (2026-08-31 · 라운드 88 트랙 F).** 이 문단이 그 질문 문장을 인용하는 자리라 라운드 87의
스윕이 이 자리도 **질문 하나로 셌다** — ⚠️ **그러나 여기 있는 것은 질문이 아니라 인용이고, 그 다섯의
답은 같은 라운드의 **AB절 머리말**이 이미 냈다**(Z-1~Z-5에 대한 답 다섯). 오늘 이 줄을 붙이는 이유는
하나다: 라운드 87이 *"따로 세지 않았다"* 고 적은 **다섯** 중 이 자리가 하나이고, 세어 보니 **다섯 중
하나는 질문이 아니었다**는 사실 자체가 그 스윕의 모집단에 대한 답이다(**AC-5** — 그 다섯을 세는 자리와
세는 방법이 거기 있다). ⚠️ **판정은 옮겨 적지 않고 어느 절이 답했는지만 가리킨다**(O-3·X-4).

⚠️⚠️ **이월 다섯은 전부 보류 유지이고 재실측 값만 갱신했다 — 갱신 한 줄씩은 그 판정이 사는 절에 있다**
(다음 라운드가 같은 실측을 다시 돌리지 않도록 여기서는 자리만 가리킨다).

- **이 스캐너가 쿼리로 분류한 자리의 낭독** — 재실측 상태 변화 0, A-20 #85 선행 → **U절 머리말**
  (⚠️ 이번에는 접점이 **둘**이다 — 트랙 B가 그 계약 파일을, 트랙 C가 그 여섯 화면 중 하나를 열었다).
- **`monthly_wrapup`의 달 이동 구멍** — 게이트가 읽는 것은 여전히 대기 행의 바뀐 뒤 날짜 하나 → **U-3**.
- **S-3(어드민 `disabled`)** — 재실측 **열하나**(items 6 · links 5), 브라우저 확인 `#130` 선행 →
  **U절 머리말**(⚠️ 두 라운드 연속이던 접점이 **오늘 0건으로 사라졌다**).
- **`withdrawn_at`** — 저장소 전체 **3건 · 파일 둘**, 컬럼 신설은 여전히 별도 결정 → **U절 머리말**.
- **`/budget` 겹침 착지** — `URL_OVERLAPS` 여전히 **둘**, 확인의 표 `#133` 대기. ⚠️ **이 이월의 갱신
  줄은 U-5에 더하지 않는다** — 그 절의 질문에는 라운드 84가 전수로 답했고 오늘 상태 변화가 0이라,
  같은 답을 다시 쓰면 **그 자체가 계약 밖의 사본이 된다**(O-3). 여기 적힌 한 줄이 그 이월의 오늘
  값이고, **어느 트랙도 라우트 표면을 열지 않았다.**

**다섯 다 2026-08-31 재실측이고 상태 변화 0이다.** ⚠️⚠️ **그리고 이번 라운드의 접점 지도는 라운드
84·85와 반대 방향으로 하나 움직였다: S-3이 사는 두 파일은 오늘 아무도 열지 않았고**(어드민을 여는
트랙 D의 소유는 `app/analytics/page.tsx`·`app/clicks/page.tsx`·`src/lib/analytics-trend-view.ts`
셋뿐이다), **대신 쿼리 방아쇠 대장 쪽에 접점이 둘 생겼다**(트랙 B가 `a11y-contract.test.ts`를 —
그 표는 바이트 불변 · 트랙 C가 `app/family/index.tsx`를 — 그 화면의 자리 수는 오늘도 넷). ⚠️ **두
라운드 연속 겹치던 파일이 오늘 안 열렸다는 사실 자체를 U절 머리말의 S-3 줄에 적었다** — 다음
라운드가 *"매 라운드 열리는 파일"* 로 읽고 실측을 건너뛰지 않도록. 나머지 셋은 접점 0건이다
(⚠️ 어느 트랙도 `apps/api/src`·`prisma/`·`src/notifications/**`·라우트 표면 대장을 **쓰기로** 열지
않았다).

⚠️⚠️ **Z-1~Z-5가 남긴 *"먼저 세어 볼 만한 것"* 다섯 전수와 오늘의 답이다 — 발동 넷 · 미도래 하나.**
⚠️ **수치는 여기 옮겨 적지 않고 그 수를 세는 자리를 가리킨다**(O-3·X-4의 규율 — 옮겨 적힌 수는 계약
밖의 사본이고, 아래 답의 상당수는 **계약이 아니라 정찰이 손으로 잰 수**라 더욱 그렇다. 전수와
실측값은 `docs/5차/round86-scout.md`의 **선행 확인 2~6·9·11**이 든다).

- **Z-1**(**다른 라운드의 전제를 근거로 인용한 주석**이 몇이고 그중 오늘 거짓인 것이 몇인가) —
  ⚠️ **발동했다.** 기계로 가를 수 있는 부분모집단(현재 상태를 **수치·0건으로 단정**하는 주석)에서는
  **거짓 0건**이었고, ⚠️ **산문 근거에서 손으로 찾은 거짓이 둘**이었다(`item-labels.ts` 머리말의
  *"배지는 두 값을 말한다"* · `offline-aware-screens.ts` 제외 사유의 첫 항). **둘 다 오늘 그 파일을
  연 트랙이 곁다리로 고쳤다**(A·B). ⚠️ **이 축의 한계도 답의 일부다**: 주석에는 문법이 없어
  *"이것이 근거다"* 를 기계가 표시하지 못하므로, 오늘 센 다섯은 **문장 모양이 우연히 규칙적이던
  부분집합**일 뿐이다. ⚠️ **재개 조건(결정형): 근거를 값으로 적는 관례(대장)를 어느 라운드가 세우는
  날** — 라운드 84 B의 DNC 대장·85 E의 면제 대장이 그 모양이고, **오늘은 세우지 않았다**(대장을 하나
  더 세우는 것은 그 자체로 한 트랙이고, 오늘 다섯 트랙은 전부 화면·계약에 있었다).
- **Z-2**(**서버 응답의 필드를 화면이 버리는 자리**가 몇이고 그중 더 말할 수 있었던 것이 몇인가) —
  ⚠️ **발동했다.** 모바일에서 **열하나**를 셌고 하나씩 판정해 **열은 값이 0**이었으며, ⚠️ **값이 있던
  하나는 그 열하나 밖에 있었다**(AA-4 — 흔한 이름의 사각). 그리고 ⚠️ **어드민에서 모양이 다른 하나가
  더 나왔다**: 필드를 **버린** 것이 아니라 **마우스에만 준** 자리다(AA-2). **그래서 이 질문의 오늘 답은
  둘이고, 둘이 트랙 C·D가 됐다.** ⚠️ **재개 조건(사건형): 응답에 새 필드가 실리는 날, 또는 화면이
  이미 손에 든 값으로 더 말할 수 있는 자리가 하나 더 발견되는 날** — ⚠️ **다만 그 스윕을 다시 돌릴
  때는 흔한 이름이 모집단 밖이라는 사실을 함께 지고 돌려야 한다.**
- **Z-3**(앱이 **최근 다섯 라운드에 바꾼 화면의 축**이 몇이고 그중 운영자 도구가 따라간 것이 몇인가) —
  ⚠️ **발동했다.** 운영자 도구에 같은 축이 있는 것은 **셋**이었고 **둘은 따라갔으며**(분류로 묶고 그
  이름으로 검색 — 라운드 85 D가 옮겼다 · 활성 ∧ 비스폰서 링크 술어 — 라운드 84 A가 어드민 쪽이었다)
  **하나가 갈렸다**(차트가 각 점의 값을 말하는가 — 오늘 트랙 D가 닫았다). 두 달 모집단은 운영자
  도구에 **같은 축이 없다**(어드민은 사용자 지출을 보지 않는다). ⚠️ **재개 조건(사건형): 앱이 화면의
  축을 또 바꾸는 날**(Z-3이 적은 그대로 · 오늘이 그 **둘째 이행**이고, 두 번 다 갈린 자리가 나왔다 —
  **Y-1은 여전히 한 번으로 끝나는 모양이 아니다**).
- **Z-4**(이 문서의 재개 조건 중 **결정형이 몇이고 그중 그 결정의 소유자가 적힌 것**이 몇인가) —
  ⚠️ **발동했다.** 이름 붙은 결정형은 **다섯**이고 **소유자가 적힌 것은 0건**이었다. ⚠️ **Z-4의
  일반형(*"결정이라면 그 결정을 누가 언제 내리는지가 조건의 절반"*)이 자기 절의 기각 목록에서 아직
  지켜지지 않고 있었다** — 오늘 트랙 F가 그 절반을 채운다(아래 전수표: 집어 든 둘은 트랙 이름으로,
  남은 셋은 *"오늘 집지 않은 이유"* 와 *"손이 어디에 있는가"* 로). ⚠️ **재개 조건(사건형): 결정형
  조건이 하나 더 생기는 날** — 그날 그 조건을 적는 트랙이 소유자 칸을 함께 적는다.
- **Z-5**(기각한 **성능 후보 중 재개 조건이 실제로 도래한 것**이 몇인가) — **미도래: 넷 중 0이고,
  넷 다 다시 쟀다.** ⓐ 첫 페인트(라운드 85 C가 리포트 화면을 열었지만 쿼리 선언을 늘리지 않았다) ·
  ⓑ 렌더 비용(활성 카탈로그가 N-4 문턱 아래이고, ⚠️ **트랙 A가 그 화면을 열었지만 파생·메모 구조는
  한 글자도 바꾸지 않았다**) · ⓒ 번들(새 런타임 의존성을 드는 트랙 0건) · ⓓ api의 루프(`apps/api/**`를
  **쓰기로** 여는 트랙 0건). ⚠️ **수는 여기 옮겨 적지 않는다** — ⓑ의 문턱은 라운드 83 C의 어드민
  카드가, ⓒ는 의존성 목록 자신이 센다. ⚠️ **재개 조건은 넷 다 종전 그대로다**(Z-5의 그 문장).

⚠️⚠️ **U-2·U-5·W-2·W-3·W-5·X-1~X-5·Y-1~Y-5의 판정은 다시 쓰지 않는다.** 라운드 84·85가 그 전수에
답했고 **오늘 상태 변화가 0**이라, 같은 답을 다시 쓰면 **그 자체가 계약 밖의 사본이 된다**(O-3).
⚠️ **Z-1~Z-5는 위 목록의 갱신 한 줄씩이 오늘의 값이고, 그 절들의 본문도 다시 쓰지 않았다.**

⚠️ **N-4의 두 문턱은 오늘로 아홉 라운드 연속 미발동이고, 준비템 탭 비가상화는 이번에도 제안하지
않는다** — ⚠️ **그 두 수는 화면이 세므로 이 절도 옮겨 적지 않는다**(O-3 · 갱신 한 줄은 N-4에 있다).

⚠️⚠️ **Z-4의 이행 — 결정형 재개 조건 다섯 전수와 오늘의 처분이다.** ⚠️ **다섯 각각에 *"그 결정을 내릴
손이 이 저장소 안에 있는가"* 를 함께 적는다**(AA-3 — 손이 안에 있으면 그것은 조건이 아니라 **아직
배정되지 않은 작업**이고, 밖에 있으면 문서가 할 수 있는 일은 경과를 정직하게 적는 것뿐이다).

| # | 결정형 조건 | 손이 저장소 안에 있는가 | 오늘의 처분 |
| --- | --- | --- | --- |
| 1 | **온보딩 준비물 화면의 탈출구** — *"[다시 시도] 버튼이 서는 날"* | ⚠️ **안에 있다** | ⚠️ **집어 들었다 → 트랙 B.** 그리고 집어 들자 **조건의 전제가 부분 거짓**이었다(버튼은 이미 있었다 — AA-3) |
| 2 | **DNC-019의 스윕 모양** — *"무엇을 비밀값으로 볼 것인가"* | ⚠️ **안에 있다** | ⚠️ **집어 들었다 → 트랙 E.** 래칫이 실제로 닫힌 수만큼 내려갔고(**2 → 1**), 오늘 무가드는 `DNC-001` 하나다 |
| 3 | **기록 탭 검색의 분류 갈래** — *"칩 줄을 좁히거나 placeholder가 분류를 약속하는 날"* | **안에 있다**(문구·정책 결정이지만 그 문구의 단일 소스가 이 저장소에 있다) | **집지 않는다 — 오늘도 약속이 참이기 때문이다.** placeholder가 훑는 곳을 정확히 말하고 분류 칩 줄이 정규 열둘을 세운다 — **고칠 어긋남이 0건**이라, 집어 드는 것이 값이 아니라 문구를 바꾸는 일이 된다 |
| 4 | **준비템 분류 필수 입력** — *"카탈로그 정책이 서는 날"* | ⚠️ **절반만** — 코드는 안에 있지만 **그 결정의 소유자는 밖**(카탈로그를 운영하는 사람)이다 | **집지 않는다.** 서버가 생략을 *"분류 없음"*/*"기존 유지"* 로 나눠 읽는 계약이 있고, 그것을 바꾸는 것은 **정책**이지 코드 판정이 아니다(Z-3의 판단 그대로) |
| 5 | **C-3 잠금 오버레이 TalkBack 투과** — *"사람·기기·날짜 배정"* | ⚠️⚠️ **밖에 있다** | **트랙 F의 소유 밖이다**(아래 · 오늘로 **스무 라운드 연속 미확인**). ⚠️ **다섯 중 이 하나만 성질이 다르다 — *"집어 들 수 있는 결정형"* 으로 읽으면 잘못된 기대다** |

⚠️ **이 표가 값인 이유는 셋의 대비다**: 손이 안에 있는 셋 중 **둘은 오늘 닫혔고**(1·2) **하나는 재어
보니 고칠 어긋남이 0이었다**(3) — 즉 손이 안에 있는 조건은 **집어 들면 그날 답이 난다.** 밖에 있는
하나(5)는 스무 라운드째 그대로다. **결정형 조건을 적을 때 함께 적어야 하는 것은 조건의 문장이 아니라
그 결정의 손이 어디에 있는가다.**

⚠️⚠️ **이번 라운드가 실측하고 기각한 열둘을 값으로 남긴다 — 전부 재개 조건과 함께**(V-2가 세운 규율:
조건 없는 보류는 이유가 적혀 있다는 이유로 재론되지 않는다). ⚠️ **그중 셋은 재개 조건이 *결정형*
이라는 사실을 함께 적는다**(Z-4·AA-3의 이행 — 결정형 조건은 아무 사건도 일으키지 않으므로, 적어 두지
않으면 다음 라운드가 그것을 *"아직 안 왔다"* 로 읽고 지나간다).

- **응답 필드 열(모바일) — 재었고 열 다 제안하지 않는다.** 시스템 분류 여부·클릭 추적 id·요청 바디는
  **표시 대상이 아니고**, `flowId` 둘은 화면이 **이미 아는 값**이며, 검수 화면의 후보 수는 그 화면이
  **자기 판정으로 이미** 세고, 마일스톤 시작일은 카드가 *"태어나서 N일째"* 로 창을 이미 말한다.
  초대의 `channel`은 **앱이 언제나 하나로만 만들어** 그리면 정보가 아니라 소음이고, `canReshareLink`는
  **서버가 언제나 false**이며 화면이 그 사실을 문장으로 이미 말한다. ⚠️ **재개 조건(사건형): 그 필드를
  읽는 화면·집계가 생기는 날 또는 서버가 그 값을 실제로 갈라 주기 시작하는 날**(`canReshareLink`가
  true를 줄 수 있게 되는 날, 오늘 화면이 하드코딩으로 아는 사실이 갈린다). ⚠️⚠️ **그리고 이 열의 곁에서
  나온 하나는 재개 조건이 결정형이다: 서버가 같은 역할의 중복 대기 초대를 막는 것** — 그것은 관측되는
  사건이 아니라 **초대 정책을 바꾸겠다는 결정**이고, 오늘 트랙 C가 한 일은 그 결정 없이도 **둘을
  구별되게** 만든 것이다(AA-4).
- **워커 잡 실패 알림 경로 — 재었고 제안하지 않는다.** 연속 실패를 세는 임계와 `degraded` 계산이 이미
  있고, 어드민 대시보드가 그 상태와 **실패한 잡 이름**을 문장으로 그린다. 남은 것은 *"사람에게 밀어
  주는 층"* 인데 그것은 **서버 알림 층(영구 기각)** 이다. ⚠️ **재개 조건(사건형): 운영 배포에 알림
  채널이 실제로 생기는 날.**
- **어드민 감사 뷰의 대상(targetType·targetId) 필터 — 재었고 제안하지 않는다.** 필터 셋(액션 정확
  일치 + 프리셋 · 행위자 · 기간)이 있고 검증 문구도 원인을 말하며, *"이 준비템에 무슨 일이 있었나"* 는
  **콘텐츠 리비전 뷰가 이미 답한다.** ⚠️⚠️ **재개 조건이 결정형이다: 서버 DTO에 그 파라미터가 0건이라,
  문의가 생기는 날(사건)이 와도 *서버 계약을 넓히겠다는 결정* 이 없으면 화면 쪽에 아무것도 서지
  않는다** — 그날 서버 필터가 **함께** 서야 한다.
- **카카오 로그인 스캐폴드 — 재었고 *스캐폴드가 아니다*.** 모바일은 prepare→authorize→exchange 전
  구간과 PKCE·취소·타임아웃 오류 코드를 갖고 있고 서버 쪽도 컨트롤러·서비스·OIDC 클라이언트가
  실재한다. 꺼져 있는 이유는 **환경변수**이고 그것은 **A절(외부 계정·키)** 이다. ⚠️ **재개 조건(사건형):
  그 키가 들어오는 날**(A절 소관).
- **데모 거울 정합 — 재었고 제안하지 않는다.** 로컬 백엔드가 합계 술어를 실화면과 **같은 함수**로
  지나고 픽스처 머리말이 *"실서버 시드 미러"* 라고 자기 근거를 적는다 — 오늘 갈린 자리를 찾지 못했다.
  ⚠️ **재개 조건(사건형): 서버 응답 모양이 바뀌는 날**(미러 스윕이 그 자리를 문다).
- **설정 화면 완성도 · 오프라인 아웃박스 UI — 재었고 제안하지 않는다.** 설정의 아홉 줄이 전부 실재
  라우트로 가고, 동기화 화면은 충돌·실패·대기 세 구역과 일괄 재시도/버리기를 갖는다. ⚠️ **다만 사문
  하나를 실측했다**: 일괄 재시도의 범위를 말하는 라벨(*"전체 재시도"*)을 화면이 쓰지 않는다 — 화면은
  **대상과 건수를 말하는 라벨**을 쓰기 때문이고 그것이 옳은 판정이다. ⚠️ **트랙으로 세우지 않는다**
  (문구 하나 · 사용자에게 보이는 변화 0건). ⚠️ **재개 조건(사건형): 준비템 상태 큐까지 다루는 일괄
  액션이 서는 날**(그날 범위를 말하는 그 라벨이 실제로 필요해진다).
- **성능 넷 — 재었고 넷 다 제안하지 않는다**(위 Z-5의 답). ⓐ **첫 페인트** — **재개 조건(사건형): 그
  화면이 첫 페인트를 늘리는 날.** ⓑ **렌더 비용**(준비템 탭의 파생이 렌더 본문) — ⚠️ **트랙 A가 그
  화면을 열었는데도 근거가 바뀌지 않았다**(footer 슬롯 한 줄 · 파생·메모 구조 무접촉 · 검색은 여전히
  디바운스 뒤에야 부모 상태를 바꾼다) — **재개 조건(사건형): 활성 카탈로그가 N-4의 문턱에 닿는 날
  또는 그 탭의 프레임 시간을 실기기에서 재는 자리가 생기는 날.** ⓒ **번들** — **재개 조건(사건형):
  새 의존성이 드는 날.** ⓓ **api의 루프** — **재개 조건(사건형): 루프의 반복 수가 사용자 데이터에
  비례하는 자리가 새로 생기는 날**(상한 대장이 그 자리를 이미 센다).
- **기록 탭 검색이 분류 이름을 보지 않는 것 — 재었고 이번에도 제안하지 않는다.** 이유는 Z절의 그것과
  같고 오늘 재실측에서도 **약속이 참이다**(placeholder가 훑는 곳을 정확히 말하고, 분류 칩 줄이
  검색칸 바로 아래에 정규 열둘을 세운다). ⚠️⚠️ **재개 조건이 결정형이다**(위 표의 3) — 그리고
  ⚠️ **오늘 그 결정형을 집지 않은 이유가 처음으로 값이 됐다: 손은 저장소 안에 있는데 고칠 어긋남이
  0건이라, 집어 드는 것이 *판정을 맞추는 일*이 아니라 *문구를 바꾸는 일*이 된다**(AA-3의 셋 중 이
  하나만 그렇다).
- **시드 카탈로그의 밴드 분포 — 오늘 새로 재었고 제안하지 않는다.** 시기 코드 열 전수를 세어 보니
  **비어 있거나 한둘뿐인 밴드가 0건**이었다 — 즉 *"어떤 시기에는 보여줄 것이 거의 없다"* 는 가설이
  값 0이었다(⚠️ 이것은 **밴드별 카운트 카드**(영구 기각)와 다른 축이고, 재어 보고 나서야 0인 것을
  알았다 — Z-5의 일반형이 성능 밖에서 한 번 더 참이다). ⚠️ **재개 조건(사건형): 어느 밴드의 준비템이
  실제로 비는 날**(카탈로그를 줄이거나 시기 코드를 늘리는 변경이 그 사건이다).

**이 라운드가 짝 문서에 남긴 것.** 확인의 표에 **#152~#155 넷**이 서고(⚠️ **표면은 `실기기` 셋 ·
`브라우저` 하나** — 트랙 E는 **소스 계약이라 표에 행이 서지 않는다**) §0의 여섯 숫자가 파싱으로 다시
세어졌으며, 접근성 표에는 **A-27 #98·#99·#100 셋**이 섰다. ⚠️⚠️ **A-27이 A-26·A-25와 다른 점 하나를
그 절의 머리말이 진다: 이번 셋은 다 *새 요소가 아니라 새 문장 한 줄*인데 셋 다 이미 소리를 내던 자리
옆에 붙었다** — 그래서 셋이 공통으로 묻는 것이 *"그 한 줄이 이웃의 낭독을 방해하지 않는가"* 다(코드는
노드를 세울 뿐 **읽히는 순서와 듣는 시간**을 알지 못한다). ⚠️ **트랙 D의 어드민 항목은 종전 판정대로
행이 아니라 문단으로 적었다**(브라우저 화면은 그 표의 조건 밖이다) — ⚠️ **다만 그 트랙이 고친 것이
정확히 접근성 축이라는 사실은 문단이 진다**: 종전 그 카드의 값은 **키보드·스크린리더 운영자에게
0개**였다(AA-2). ⚠️⚠️ **C-3(잠금 오버레이 TalkBack 투과)은 오늘로 스무 라운드 연속 미확인**이고,
⚠️ **이번 라운드가 그 줄에 더하는 값은 경과 수가 아니라 *분류* 다: 위 표의 다섯 중 이 하나만 손이
저장소 밖이다.** 오늘 집어 든 둘은 손이 안에 있어 그 라운드가 스스로 닫을 수 있었지만, 이 줄의
결정(사람·기기·날짜)은 저장소 안의 어느 트랙도 내릴 수 없다 — **우선순위가 아니라 배정이고, 그
배정의 자리가 이 저장소 밖이다.** ⚠️ **그래서 다음 라운드가 이 줄을 *"집어 들 수 있는 결정형"* 목록에
올리는 것은 잘못된 기대다.** 그 줄 옆에는 이번에도 새 `실기기` 행이 셋이나 섰다(라운드 84는 0건,
85·86은 셋씩 — **0건이든 셋이든 같은 칸이 비어 있다**).

### AA-1. **판정을 옮긴 라운드는 옮기지 못한 절반의 행방을 함께 세어야 한다** — 목록은 필수도로 *고를* 수는 있는데 어느 것이 필수인지 *볼* 수는 없었다

- **사실.** 라운드 48 T1은 근거 없는 "BEST" 배지를 걷어내면서 목록 배지의 규칙을 세웠다 —
  *"준비 상태가 있으면 상태 라벨, 없으면 필수도 라벨"*. 그 뒤 DSN-053 P2-B가 목록을 승인 디자인의
  타일 그리드로 옮기면서 **준비 상태는 타일의 상태 pill이 이어받았고**(그 사실은 계약의 주석에도
  적혀 있다) ⚠️ **필수도가 이어받은 자리는 0건이었다.** 그 판정을 담은 함수는 오늘 **자기 파일과
  테스트에서만** 이름이 나온다 — **화면 호출부 0건.**
- ⚠️⚠️ **그런데 그 축의 필터는 목록 위에 그대로 서 있었다.** 화면은 [필수]·[편의]·[선택] 칩을
  그리고 그 상태가 목록 판정에 들어간다. **고르는 축은 있는데 그 축의 값이 목록 어디에도 그려지지
  않았고**, 칩을 끄는 순간 구분이 사라졌다. 상세 화면은 같은 필드를 *"필수도: 필수"* 로 말한다 —
  **목록과 상세가 같은 값에 대해 서로 다른 것을 보여 주고 있었다**(라운드 48이 닫으려던 그 갈림).
- ⚠️⚠️ **그리고 사문이 된 판정에 남은 계약이 그 사실을 감췄다.** 그 함수의 단언은 오늘도 초록이었고
  머리말은 *"배지는 이제 응답에 실제로 있는 두 값만 말한다"* 고 적고 있었다 — ⚠️ **다음 사람에게
  그 문장은 *"화면이 이미 그렇게 그린다"* 로 읽힌다.** **아무 테스트도 빨개지지 않았다: 그 판정은
  초록으로 단언되고 있었고, 다만 아무도 부르지 않았다.**
- **오늘의 값 — 한 줄과 뺄셈 하나다.** ⓐ 화면이 **자기 소유의 슬롯**(타일 아래 footer)에서
  `necessityBadgeLabel`을 부른다 — **상세가 오늘 쓰는 그 함수 그대로**이고, 문구는 칩의 단일 소스에서
  오므로 **새 한국어 문장 0건**이다. ⓑ `optional`에는 라벨이 붙지 않는다(**모든 타일에 배지가 붙으면
  배지가 아무것도 구분하지 못한다** — 모듈의 기존 판정). ⓒ ⚠️ **사문이 된 목록 배지 판정을 걷었고**,
  그 계약이 물던 어휘 단언 둘은 **오늘 살아 있는 판정으로 옮겼다** — **화면이 부르지 않는 판정에
  계약을 남기지 않는다.** ⓓ ⚠️ **거짓이 된 머리말을 실측으로 갱신했다** — 이제 그 문장은 *두 값을
  각각 오늘 어디가 그리는지*를 적는다(Z-1의 이행). ⓔ **계약이 호출부의 실재를 문다**(목록 소스가 그
  함수를 실제로 부르는지 · `optional` 부정 · **죽은 이름의 부재**).
- ⚠️ **타일 자체는 열지 않았다** — 승인 디자인의 카드는 이식본이라 렌더가 승인 자산이고, 그 안에
  배지를 넣는 것은 **디자인 승인 선행**이다(**재개 조건: 그 승인이 서는 날**). 정렬·강조·추천 점수도
  무접촉이다(DNC-009) — **이 트랙이 더한 것은 카탈로그의 사실 하나이지 순위가 아니다.**
- **일반형.** **판정을 다른 자리로 옮긴 라운드는 옮기지 못한 절반이 어디로 갔는지를 함께 세어야
  한다** — 옮긴 절반은 화면에 보이므로 아무도 묻지 않고, 남은 절반은 **계약이 초록이라 아무도
  모른다.** ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소의 순수 판정 모듈 중 **화면 호출부가
  0건인 export가 몇이고, 그중 계약만 초록인 것이 몇인가**(오늘 하나를 되살렸고 하나를 걷었다 — 라운드
  72 E가 죽은 프롭 셋에 대해 같은 모양을 이미 한 번 봤다).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 오늘 트랙 E가 이 질문에 **전수로** 답했다 — 호출부 0건인 export를 세는 대장이 섰고, 판정은 **AB-5**가 진다.
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 그리고 세어 보는 동안 그 수가 한 번 줄었다: 정찰이 센 열일곱 중 하나(`hasAnyAuditLogFilter`)를 **병렬 트랙 A가 되살려** 오늘 대장은 열여섯이다 — **세는 자리가 서던 그 라운드에 답이 하나 바뀌었다.**
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### AA-2. **값을 마우스에만 주는 화면은 값을 버린 화면과 같은 자리에 선다** — 그리고 옳은 형식이 같은 저장소의 형제 화면에 이미 있었다

- **사실.** 운영자의 분석 화면은 일별 추이를 `div` 막대로 그리고 각 막대의 값을 **`title` 속성
  하나로만** 줬다. 바깥 컨테이너는 `role="img"`에 *"…일별 이벤트 수 막대 그래프"* 라는 `aria-label`을
  달고 있었는데 ⚠️ **그 라벨에 수치가 0건**이라, 화면이 말하는 것은 *"막대 그래프가 있다"* 뿐이었다.
  축 라벨도 **양 끝 두 개**뿐이라 가운데 봉우리가 며칠인지 화면 어디에도 없었다.
- ⚠️⚠️ **그래서 마우스가 없는 사람에게 이 카드는 비어 있었다.** `title`은 호버로만 뜨고, 막대는
  포커스를 받지 않으며, `role="img"` 컨테이너 안의 자식은 보조기술에 개별 노출되지 않는다 —
  **키보드·스크린리더 운영자에게 그 카드의 값은 0개**였다. **그리고 계약은 그 상태를 *존재*로만
  셌다**: 무는 것이 *"`dailyTotals`를 쓰는 막대가 있고 외부 차트 라이브러리를 들지 않는다"* 여서,
  **값이 텍스트로 도달하는가는 어느 단언도 묻지 않았다.**
- ⚠️⚠️ **옳은 형식은 같은 저장소에 이미 있었다.** 클릭 통계 화면은 **같은 모양의 막대**를 그린 뒤
  바로 아래에 **날짜·클릭 수 표**를 세운다(최근 날짜가 위로 오게 뒤집어서). **같은 저장소 · 같은
  데이터 모양 · 같은 카드 관례인데 한쪽에만 표가 있었다** — 없어서 못 한 것이 아니라 **옆 화면에
  있는 것을 따라가지 않은 것**이다.
- **오늘의 값 — 순수 모듈 하나와 표 한 벌이다.** ⓐ 두 화면이 **같은 자리에서** 막대 라벨·표 행·
  최대치 문장을 만든다(`analytics-trend-view.ts` — `worker-health-view.ts`·`catalog-size-view.ts`의
  관례). ⚠️ **각자 조립하면 다음 라운드에 다시 갈린다 — 오늘이 그 증거다.** ⓑ 분석 화면에 형제
  화면과 **같은 형식**의 날짜·건수 표가 선다(열 이름·정렬·숫자 표기 그대로 · **새 표기 규칙 0건**).
  ⓒ **최대치 한 줄이 서되 지어내지 않는다** — 값이 전부 0인 기간에는 그 문장이 **서지 않는다**
  (아무 일도 없던 날을 봉우리로 만들지 않는다). ⓓ ⚠️ **클릭 화면이 그리는 글자는 바이트 불변**이다 —
  그 화면에서 바뀐 것은 *어디서 값을 만드는가*뿐이다. ⓔ **서버 0건 · 새 요청 0건**(`dailyTotals`는
  두 요약 응답에 **이미** 실려 있었다) · **막대의 색·높이·간격·토글·퍼널 0건 변경 · 새 의존성 0건.**
- ⚠️ **막대를 포커스 가능하게 만들지 않은 것이 판단이다** — 표가 이미 그 값을 텍스트로 주므로 새
  상호작용 표면은 값이 아니고, 그것은 **디자인·접근성 결정**이다(**재개 조건: 그 결정이 서는 날**).
- **일반형.** **값을 마우스에만 주는 화면은 값을 버린 화면과 같은 자리에 선다** — Z-2가 *"응답의
  필드를 버리는 `map` 한 줄"* 에 대해 적은 것이 **도달 경로**에도 그대로 참이고, 호버로만 닿는 값은
  다음 사람에게 *"데이터가 없다"* 로 읽힌다. ⚠️ **그리고 그런 자리를 고칠 때 가장 먼저 물어야 하는
  것은 *어떻게 그릴까*가 아니라 *이 저장소에 이미 옳은 형식이 있는가*다.** ⚠️ **다음 라운드가 먼저
  세어 볼 만한 것**: 두 화면이 **같은 모양의 UI를 각자 조립하는 자리가 몇이고, 그중 둘이 이미 갈려
  있는 것이 몇인가**(오늘 하나를 모듈로 모았고, 그 하나는 **네 라운드 동안 갈려 있었다**).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 오늘 정찰이 어드민 전수로 다시 세었고 트랙 A가 그 자리를 닫았다 — 판정은 **AB-2**다.
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 같은 스윕에서 모바일 지출 입력 두 화면도 모집단에 들어왔는데 **재어 보니 조립만 다르고 판정은 갈리지 않았다** — 그 기각은 **AB절 머리말**에 재개 조건과 함께 있다(0건도 재어 본 값이다).
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### AA-3. **결정을 내릴 손이 저장소 안에 있는 결정형 조건은 조건이 아니라 미배정 작업이다** — 그리고 그 조건은 오래 서 있는 동안 자기 전제까지 낡았다

- **사실.** Z-4는 재개 조건을 **사건형**과 **결정형**으로 갈랐고, 결정형은 *"어느 라운드가 자기 일로
  집어 들지 않으면 영원히 미도래로 남는다"* 고 적었다. 오늘 이름 붙은 결정형 **다섯**을 전수로 세어
  각각 *"그 결정을 내릴 손이 어디에 있는가"* 를 붙였더니 **셋은 안, 하나는 절반, 하나는 밖**이었다
  (위 전수표). ⚠️ **손이 안에 있는 조건은 기다릴 대상이 아니다 — 아직 배정되지 않은 작업이다.**
- ⚠️⚠️ **오늘 트랙 B가 그중 하나를 집어 들었고, 집어 들자 조건의 전제가 부분 거짓이었다.**
  Z절의 그 조건은 *"그 화면에 [다시 시도] 버튼이 서는 날"* 이었고 제외 사유 셋이 함께 적혀 있었는데,
  재실측하면 ⓐ **① *"조회 실패와 0건이 같은 조건을 나눠 쓴다"* 는 거짓**(소스가 이미 두 문장을
  갈라 그리고 있었다 — Z절이 그 낡음을 값으로 적어 두었다), ⓑ **② *"카드가 아니라 Card 안 Text 한
  줄이다"* 는 참**, ⓒ ⚠️⚠️ **③ *"공용 문장이 가리키는 [다시 시도] 버튼이 이 자리에 없다"* 도 거짓 —
  그 버튼은 이미 서 있었다**(조회 실패 갈래에서 같은 조회를 다시 부르는 버튼). **즉 없던 것은 버튼이
  아니라 *"지금은 오프라인이에요"* 라고 말하는 문장 쪽이었고, 배정된 일은 *버튼 세우기*가 아니라
  **오프라인 배선**이었다.**
- ⚠️ **그리고 그 조건이 지키려던 진짜 값은 배선하면서도 지켜졌다.** 제외 사유가 막으려던 것은
  *"더 구체적인 탈출구 문장을 공용 문장으로 후퇴시키는 것"* 이었는데, 오늘 공용 문장은 화면 고유의
  안내를 **대체하지 않고 그 위에 한 줄로 얹힌다.** 버튼 라벨도 공용 값으로 후퇴하지 않았다 —
  온보딩에는 저장·건너뛰기·로컬 통과 버튼이 함께 서 있어 **무엇을 다시 하는지가 라벨에 남아야
  한다**(그 이유가 배선 대장의 그 칸에 값으로 적혀 있다).
- **오늘의 값 — 빈 목록 하나와 낭독 한 짝이다.** ⓐ 조회 쪽 **제외 대장이 오늘 0건이 됐다** — 그리고
  ⚠️ **비었다고 목록을 없애지 않는다**(저장 쪽 빈 제외 목록과 같은 이유): 자리를 비워 두어야 다음에
  조회 실패 문장을 손으로 적는 화면이 생기는 날 만든 사람이 두 답 중 하나를 **값으로** 고른다.
  ⚠️ **그리고 이 0은 *"아직 안 봤다"* 가 아니라 `app/**` 스윕이 세어 본 값이다.** ⓑ 배선 목록은
  열넷 → **열다섯**이 됐고, 이 화면은 **모양이 하나 더 다른 첫 항목**이라 그 이유를 함께 진다(버튼
  **라벨**도 카드 값이 아니다). ⓒ **0건 갈래는 한 글자도 바뀌지 않았다** — 실패가 아닌 자리에는
  오프라인 문장도 탈출구도 붙지 않는다(**두 갈래를 더 벌린다**). ⓓ **낭독 계약이 문장과 버튼을 한
  짝으로 문다**(조건이 성립할 때만 서는 노드 · 역할·라벨의 소리 도달 · 라벨↔onPress 짝). ⓔ **새
  쿼리·새 키·폴러 0건**이고 건너뛰기·로컬 통과 판정은 **무접촉**이다.
- **일반형.** **재개 조건이 결정형이면 그 다음에 물어야 하는 것은 *언제 오는가*가 아니라 *그 결정을
  내릴 손이 어디에 있는가*다** — 손이 저장소 안에 있으면 그것은 조건이 아니라 **아직 배정되지 않은
  작업**이고, 배정되지 않은 채 오래 서 있으면 ⚠️ **그 조건의 전제까지 함께 낡는다**(오늘 하나는 전제
  둘 중 둘이 거짓이었다). ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 문서의 재개 조건 중 **그
  조건의 전제를 오늘 다시 재어 본 것이 몇인가**(조건은 도래를 기다리는 동안 아무도 다시 읽지 않는다 —
  오늘 하나를 열었더니 전제 둘이 거짓이었다).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 오늘 답했다 — 재개 조건이 나오는 줄 전수 가운데 **전제를 다시 재어 본 것이 일곱**이고, 그 일곱 중 하나에서 오늘의 트랙 하나가 나왔다(**AB-3**).
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 그 하나는 라운드 86에 **전제가 이미 부분 거짓**이던 조건이고, 오늘 다시 재니 남은 전제는 참이었다 — **조건은 재어 볼 때만 상태가 갱신된다**는 이 질문의 답이 두 라운드 연속 값이 됐다.
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### AA-4. **스윕의 결과에는 그 스윕이 구조적으로 못 보는 것을 함께 적어야 한다 — 수는 하한이다** — 값이 있던 하나가 정확히 그 사각에 있었다

- **사실.** Z-2가 남긴 질문(*"화면이 버리는 응답 필드가 몇인가"*)에 답하려고 응답 타입의 필드 전수를
  뽑아 `src/**`·`app/**`에서 **한 번도 이름이 나오지 않는** 것을 셌고, **열하나**가 나왔다. 하나씩
  판정해 **열은 값이 0**이었다(표시 대상이 아니거나 · 화면이 이미 아는 값이거나 · 화면이 그 사실을
  **자기 판정으로 이미** 세거나 · 서버가 언제나 같은 값을 주어 그리면 소음이 되는 것들).
- ⚠️⚠️ **그런데 값이 있던 하나는 그 열하나 안에 없었다.** `PendingInvite.createdAt`은
  `createdAt`·`id`·`status`처럼 **여러 타입이 공유하는 흔한 이름**이라, 이름으로 훑는 스윕이 다른
  타입의 같은 이름과 **구분하지 못했다.** 그래서 그 필드는 *"화면이 쓰고 있다"* 로 분류돼 모집단
  밖으로 빠졌고 — ⚠️ **정확히 그 자리가 이 라운드에서 값이 있던 유일한 자리였다.**
- ⚠️⚠️ **그 사각이 감춘 것이 무엇이었나.** 한 가구에 같은 역할의 대기 초대가 **둘 이상 설 수 있는데**
  (서버의 초대 생성에 중복 방지가 0건이고 TTL이 고정이다) 화면이 그리는 것은 역할 라벨·만료 문구·
  배지·[취소] 넷뿐이라, 같은 날 만든 두 초대는 **글자 하나 다르지 않았다.** ⚠️ **되돌릴 수 없는
  [취소]의 확인창 제목도, 낭독 라벨도 같았다** — TalkBack 사용자에게는 **같은 문장이 두 번** 들리고,
  그중 어느 것을 지우는지 화면이 말하지 않았다. **아무 테스트도 빨개지지 않았다: 그 자리의 계약이
  무는 것은 역할 라벨과 만료 문구였다.**
- **오늘의 값 — 순수 함수 하나가 만든 값이 세 자리를 지난다.** ⓐ `createdAt`에서 **분 단위까지** 적는
  한 줄을 파생한다(날짜까지만 적으면 같은 날 두 번 만든 초대가 **다시 같은 줄**이 된다). ⓑ **어휘는
  *"만든"* 이다** — `createdAt`이 말하는 것은 링크가 **만들어진 시각**뿐이고, 실제로 상대에게 보냈는지
  서버도 앱도 모르므로 *"보냈어요"* 는 단정이 된다(초대 화면의 버튼도 [초대 링크 만들기]라 같은 동사를
  쓴다). ⓒ **행 한 줄 · 취소 확인창 제목 · 낭독 라벨 셋이 같은 값을 읽는다** — 값을 한 곳에서만 만들어
  **두 문장이 갈릴 자리를 만들지 않는다**(라운드 51 P2-3의 규율). ⓓ ⚠️ **지어내지 않는다** — 값이
  없거나 파싱되지 않으면 **`null`을 돌려주고 그 줄을 그리지 않으며**, 확인창·낭독은 종전 문장으로
  돌아간다(원문 ISO 문자열을 그대로 흘리지도 않는다). ⓔ **새 요청 0건 · 서버 0건 · 초대 생성·취소
  경로 0건 변경 · 역할 라벨과 만료 문구 바이트 불변.**
- ⚠️ **옆 필드 셋을 그리지 않은 것도 판단이다**(선행 확인의 그 판정 그대로) — 발송 채널은 앱이 언제나
  하나로만 만들고, 초대한 사람은 언제나 같으며, 재공유 가능 여부는 서버가 언제나 false다.
  **손에 들었다고 다 그리는 것이 아니라, 그려서 갈라지는 것만 그린다.**
- **일반형.** **스윕이 낸 수에는 그 스윕이 구조적으로 못 보는 것을 함께 적어야 한다 — 그러지 않으면
  다음 사람이 하한을 전수로 읽는다.** 이름으로 훑는 스윕은 **흔한 이름을 가르지 못하고**, 값이 있는
  자리는 흔히 그 사각에 있다(오늘이 그랬다). ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소의
  스윕 중 **자기 모집단의 사각을 값으로 적어 둔 것이 몇인가**(오늘 하나에 적었고, 라운드 85 E의 면제
  대장·라운드 81 V-3의 *"산문 census"* 판정이 같은 축이다 — **적혀 있지 않은 사각은 다음 라운드에
  전수로 읽힌다**).
- ⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 F) — 답한 자리를 되짚는다.** 오늘 답했다 — 디렉터리를 걷는 스윕 전수 가운데 **자기 사각을 값으로 적어 둔 것이 다섯**이었고, ⚠️ **적지 않은 사각 하나에 오늘의 결함이 앉아 있었다**(**AB-4**).
  ⚠️ **그 판정을 여기 옮겨 적지 않는다**(옮겨 적으면 그것이 계약 밖의 사본이 된다 — O-3·X-4) —
  질문만 읽는 사람이 *"아직 아무도 안 셌다"* 로 읽고 같은 스윕을 처음부터 다시 돌리지 않도록
  **가리키기만 한다.** ⚠️ 오늘 그 다섯이 **일곱**이 됐다: 트랙 C의 모듈 층 낭독 스윕과 트랙 E의 대장이 둘 다 **태어날 때부터** 뿌리·제외·사각을 값으로 진다(수를 세는 자리는 그 두 파일 자신이다 — 이 절은 옮겨 적지 않는다).
  ⚠️ 이 되짚는 줄은 오늘 **열여섯** 자리에 선다(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4) — **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고(이 문서 전체로는 서른여섯 번 · 서른한 절), 그 스윕 자신의 사각은 **AB-5**가 진다.

### AA-5. **라운드가 남기는 가장 싼 자산은 다음 라운드가 셀 수 있는 질문이다** — Z-1~Z-4가 오늘 다섯 트랙 중 넷을 냈다

- **사실.** Z-1~Z-5는 각 절 끝에 *"다음 라운드가 먼저 세어 볼 만한 것"* 을 한 줄씩 남겼다(Y-2가 세운
  규율의 세 번째 이행이었다). 오늘 그 다섯을 전수로 세었더니 **넷이 발동했고**, 그 넷이 이번 라운드의
  다섯 트랙 중 **넷**이 됐다: Z-1 → 트랙 A·B의 곁다리(거짓이 된 근거 둘) · Z-2 → 트랙 C·D ·
  Z-3 → 트랙 D · Z-4 → 트랙 B·E. **다섯째(성능)는 넷 다 재개 조건이 오지 않아 미도래였고, 그 0도
  재어 본 값이다.**
- ⚠️⚠️ **세어 보니 셋은 이미 화면에 있는 결함이었다.** 질문들은 *"세어 보라"* 였는데, 세는 순간
  **사용자가 오늘 보고 있는 자리**가 나왔다 — 목록이 필수도를 말하지 않는 것 · 대기 초대 둘이 구별되지
  않는 것 · 운영자 차트가 값을 마우스에만 주는 것. **질문이 없었다면 오늘의 정찰은 그 셋을 처음부터
  다시 찾아야 했다.**
- **오늘의 값 — 이 절 자신이 그 답이다.** ⓐ 다섯 전수와 오늘의 답이 **한 자리에** 있다(위 목록).
  ⓑ ⚠️ **수치는 옮겨 적지 않고 세는 자리를 가리켰다**(O-3·X-4) — 옮겨 적힌 수는 계약 밖의 사본이고,
  이 답의 상당수는 **계약이 아니라 정찰이 손으로 잰 수**라 더욱 그렇다. ⓒ ⚠️ **답이 *"미도래"* 인
  하나도 적었다**(Z-5) — 적지 않으면 같은 후보가 다음 정찰의 목록에 다시 오르고, 다시 재어지지 않은
  채 다시 적힌다. ⓓ **그리고 이 절도 다섯 개의 질문을 남긴다**(AA-1~AA-5의 각 끝줄) — 그것이 다음
  라운드가 이 규율을 이어받는 유일한 방법이다.
- ⚠️ **다만 이 자산의 한계도 값이다.** 오늘 넷이 발동한 것은 **질문이 셀 수 있는 모양**이었기
  때문이다(*"몇이고 그중 몇인가"*). ⚠️ **셀 수 없는 모양으로 적힌 질문은 다음 라운드가 답하지
  못한다** — C-3이 열아홉 라운드 동안 그랬듯이, **답이 사람에게 있는 질문은 세는 것으로 닫히지
  않는다**(AA-3의 다섯 중 손이 밖에 있는 그 하나).
- **일반형.** **라운드가 남기는 가장 싼 자산은 다음 라운드가 *셀 수 있는* 질문이다** — 비용은 문장
  한 줄이고, 수확은 다음 라운드의 트랙 목록이다. ⚠️ **그리고 그 질문은 두 조건을 지켜야 값이 된다:
  ① 세는 방법이 문장 안에 있을 것, ② 답이 저장소 안에 있을 것.** 둘 중 하나라도 없으면 그 질문은
  라운드를 건너 살아남되 **아무도 답하지 않는다.** ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: K~AA절이
  남긴 *"다음 라운드가 먼저 세어 볼 만한 것"* 전수 중 **아직 한 번도 답해지지 않은 것이 몇이고, 그중
  ①·② 둘 중 하나가 없어서 답해지지 않은 것이 몇인가**(오늘 다섯 중 넷이 답해졌고, 그 넷은 둘 다
  갖추고 있었다).
- ⚠️⚠️ **갱신 (2026-08-31 · 라운드 88 트랙 F) — 답한 자리를 되짚고, 그 답의 사각까지 되짚는다.**
  라운드 87 **AB-5**가 답했고(전수를 세니 답해지지 않은 것은 0건이었다) ⚠️ **그 답을 내는 스윕
  자신에게 사각이 있었다는 것이 그 절의 판정이다** — 그리고 그 사각(*"서른여섯에서 열여섯과 열다섯을
  뺀 나머지 다섯은 오늘 따로 세지 않았다"*)을 오늘 **AC-5**가 기계로 다시 세어 이행했다.
  ⚠️ **판정을 여기 옮겨 적지 않는다**(O-3·X-4) — 어느 절이 답했는지만 가리킨다.
  ⚠️ **이 되짚는 줄은 그 나머지 **다섯** 중 하나이고**(X-5 · Y-5 · Z-5 · AA-5 · AA절 머리말의 인용
  한 줄), **다섯 중 하나는 오늘 *아직 답해지지 않았다*로 답해졌다**(Y-5) — **되짚는 줄의 값은 답이
  있다고 적는 데 있는 것이 아니라 없다는 것도 같은 자리에 적는 데 있다.**

### AA-R. 라운드 86 **적대 리뷰가 남긴 한계 둘** (2026-08-31 · 리뷰 L-14 · L-10)

> ⚠️ 이 절은 판정(AA-1~AA-5)이 아니라 **오늘 고치지 않기로 한 것과 그 이유**다. 리뷰가 연 열넷 중
> 열둘은 코드·계약·문서로 닫혔고, 아래 둘만 값으로 남는다 — 적어 두지 않으면 다음 라운드가 같은
> 자리를 다시 발견하고 같은 판단을 처음부터 다시 한다(Z-4·AA-3이 같은 자리에서 배운 것).

- ⚠️ **한계 ① — 연결 판정은 *에러로 전환되는 순간*에만 서고, 연속 실패에서는 다시 서지 않는다**
  (`apps/mobile/src/offline/use-load-error-copy.ts` · 리뷰 L-14). `useErrorTimeConnectivity`의
  effect deps는 `[isError]` 하나다. 그래서 실패 카드가 떠 있는 동안 사용자가 [다시 시도]를 눌러
  **또 실패하면**(react-query에서 `isError`는 계속 참이다) 그 두 번째 실패의 문구는 **첫 실패
  때의 연결 판정**을 그대로 쓴다 — 터널에 들어간 뒤의 실패가 *"잠시 후 다시"* 로, 터널을 빠져나온
  뒤의 실패가 *"지금은 오프라인이에요"* 로 읽힐 수 있다.
  - **오늘 고치지 않는 이유**: 최소 수정안(`errorUpdatedAt`이나 `failureCount`를 deps에 더하기)은
    훅이 그 값을 **받지 못하기 때문에** 시그니처를 늘려야 하고, 그러면 조회 배선 **열다섯**과 저장
    배선, 그리고 공용 배선을 직접 부르는 가져오기·개인정보·온보딩의 자리들이 **전부** 그 값을 골라
    넘겨야 한다(수는 옮겨 적지 않는다 — 세는 자리는 `offline-aware-screens.ts`의 두 목록과
    `messages.test.ts`의 스윕이고, 그 스윕은 호출 문자열을 **글자로** 물고 있다). 선택 인자로 열어 두는 길도 있지만 **오늘 그것을 넘기는 화면이 0건**이라
    호출부 없는 인자가 되고, 이 저장소는 그것을 **초록인 채 거짓말하는 판정**으로 이미 한 번
    걷어 냈다(라운드 86 A의 `itemListBadgeLabel`). 즉 값은 열아홉 화면 공통 계약을 흔드는 폭이고,
    오늘 리뷰가 요구한 폭은 그보다 작다.
  - **재개 조건(사건형)**: 연속 실패 사이에 연결 상태가 실제로 갈리는 사용자 보고가 오거나, 조회
    실패 카드에 **자동 재시도**가 붙는 날(그날은 연속 실패가 사람의 탭이 아니라 앱의 동작이 되므로
    같은 문장이 훨씬 자주 낡는다). ⚠️ 그날 고칠 자리는 훅 하나이고, 이 절이 그 자리와 폭을 미리
    적어 둔다 — 그것이 이 한 줄의 값이다.
  - ⚠️ **갱신 (2026-08-31 · 라운드 87) — 재실측했고 재개 조건 미도래, 상태 변화 0.**
    `use-load-error-copy.ts`의 effect deps는 오늘도 `[isError]` 하나이고 저장소에 **자동 재시도·폴러는
    0건**이다. ⚠️ **이번 라운드는 트랙 B가 그 훅을 부르는 화면 하나를 *쓰기로* 열었는데도 이 한계가
    움직이지 않았다** — B가 바꾼 것은 그 문구가 **어느 갈래에 서는가**이지 그 문구를 **언제 다시
    판정하는가**가 아니다(훅의 시그니처·deps·호출 인자 전부 바이트 불변). ⚠️ **오히려 이 절이 적어 둔
    폭이 오늘 한 칸 더 정확해졌다**: 그 훅을 부르는 조회 배선은 이제 **열다섯**이고, 그 수를 세는
    자리는 여전히 `offline-aware-screens.ts`의 두 목록과 `messages.test.ts`의 스윕이다(⚠️ **수는 여기
    옮겨 적는 대신 세는 자리를 가리킨다** — O-3). **재개 조건 그대로 · 보류 유지.**
  - ⚠️ **갱신 (2026-08-31 · 라운드 88) — 재실측했고 재개 조건 미도래, 상태 변화 0.**
    `use-load-error-copy.ts`의 effect deps는 오늘도 `[isError]` 하나이고 저장소에 **자동 재시도·폴러는
    여전히 0건**이다. ⚠️ **이번 라운드는 어느 트랙도 그 훅을 *쓰기로* 열지 않았고, 그 훅을 부르는
    화면도 한 곳도 열지 않았다** — 화면을 여는 두 트랙의 소유는 알림 설정 하나와 어드민 하나이고
    둘 다 이 훅의 호출부가 아니다. ⚠️ **다만 이 한계를 세는 자리 하나가 오늘 한 칸 더 단단해졌다**:
    조회 배선 수를 세는 `offline-aware-screens.ts`가 트랙 D의 주석 마스킹 대상 아홉 파일 중 하나였는데,
    **그 파일에 더해진 것은 이유 주석뿐이고 목록 두 벌의 값은 바이트 불변**이다(⚠️ **수는 여기 옮겨
    적지 않는다** — O-3). **재개 조건 그대로 · 보류 유지.**
- ⚠️ **한계 ② — 온보딩 준비물 화면의 `isError && hasOptions` 창에는 실패 문장이 서지 않는다**
  (`apps/mobile/app/(onboarding)/prepared-items.tsx` · 리뷰 L-10). 목록이 한 번 뜬 뒤 다시
  불러오기가 실패하면 **[목록 다시 불러오기] 버튼만** 목록 아래에 맥락 없이 남는다(실패 문장 두
  줄이 `!hasOptions` 갈래에 묶여 있다). ⚠️ **이것은 라운드 86 트랙 B의 회귀가 아니다** — 버튼은
  그 라운드 전에도 그 자리에 있었고, 문장 쪽은 아예 없었다. 오늘 달라진 것은 실패 갈래의 문장이
  생겼다는 것뿐이고, 이 창은 종전과 같은 모습이다.
  - **오늘 고치지 않는 이유**: 문장을 이 창까지 내보내려면 실패 문구를 목록이 있는 갈래로도 세워야
    하는데, 그것은 트랙 B가 지킨 규율(*"얹되 지우지 않는다"* — 고유 안내 위에 한 줄만 얹는다)보다
    **넓은 배치 변경**이고 0건 갈래·목록 갈래의 두 그림을 함께 다시 재야 한다.
  - **재개 조건(결정형 · 손은 저장소 안)**: 기기 확인(`runtime-verification-required.md` #153 ⓕ)이
    *"그 무맥락 버튼이 오해를 만든다"* 로 답하는 날, 또는 어느 라운드가 이 배치를 자기 일로 집어 드는
    날. ⚠️ AA-3의 규율대로 **손이 안에 있다고 적는다** — 그러면 이것은 기다릴 조건이 아니라 아직
    배정되지 않은 작업이다.
  - ⚠️⚠️ **갱신 (2026-08-31 · 라운드 87 트랙 B) — 닫혔다. 그리고 *어떻게* 닫혔는지가 이 줄의 값이다.**
    실패 두 줄의 조건이 0건 갈래 안의 삼항에서 **[목록 다시 불러오기] 버튼과 같은 형제 갈래**
    (`itemsQuery.isError`)로 올라갔고, 0건 갈래는 `!itemsQuery.isError`로 좁혀졌다 — **두 문구는 한
    글자도 바뀌지 않았고**(얹되 지우지 않는다는 그 규율 그대로) 위에서 *"넓은 배치 변경"* 이라고
    적었던 그 폭은 실제로는 **갈래 조건 하나**였다. ⚠️⚠️ **이 조건이 결정형이었고 그 결정을 내릴 손이
    저장소 안에 있었다는 사실을 함께 남긴다** — 라운드 86이 AA-3의 규율대로 *"손이 안에 있다"* 고
    적어 두었고, 그 문장이 **다음 라운드의 배정표가 됐다**(오늘 트랙 B의 커밋 메시지가 그 배정을
    근거로 든다). ⚠️ **AA-3이 이름 붙인 분류의 첫 집행이고**, 그 집행이 무엇을 값으로 만들었는지는
    **AB-3**이 진다(집어 들자 남은 전제가 다시 재어졌다는 사실 포함). ⚠️ **기기 확인은 사라지지 않고
    자리를 옮긴다**: `#153` ⓕ가 묻던 *"그 무맥락 버튼이 오해를 만드는가"* 는 오늘 조건이 사라져
    무의미해진 것이 아니라, **문장이 선 뒤에도 그 둘이 한 짝으로 읽히는가**로 바뀌어 `#156` ⓑ와
    접근성 표 **A-28 #102**가 진다(⚠️ **그 창에서는 문장과 버튼 사이에 목록 전체가 낀다** — 라운드 86
    리뷰 L-10이 첫 실패 창에 대해 잰 그 거리보다 멀다). ⚠️ **`#153`의 그 칸은 지우지 않는다** — 그
    행은 라운드 86 시점의 사실이고, 행의 문장·기대 동작을 뒤늦게 고치지 않는 것이 이 문서 쌍의
    규율이다(**행 바이트 불변**).

## AB. 라운드 87에서 확정한 판정 (2026-08-31 · GAP-087 트랙 F)

라운드 86이 물은 것이 **무엇을 어디로 옮긴 라운드는 옮기지 *못한* 나머지 절반이 어디로 갔는지를
세었는가** 였다면, 라운드 87의 물음은 그 한 칸 **아래**다 — **한 층에서 닫은 규율은 옆 층에서 다시
세어지는가.** 축은 라운드 81~86과 같이 **사용자 가치**였고(운영자 도구 · 온보딩 · 알림 설정 · 저장소가
자기를 세는 자리), 다섯 판정 다 K~AA절과 같이 **결함 보고가 아니라 다음 결정의 입력**이며 2026-08-31
소스에서 확인됐다(라운드 87 트랙 A·B·C·D·E 머지 후). ⚠️ **이번 라운드의 다섯 트랙 중 핵심 루프의
렌더를 여는 것은 0건이고 그 사실도 값이다** — 오늘 닫힌 다섯은 전부 루프의 **바깥 테두리**에 있었다.

⚠️⚠️ **이번 라운드의 가장 값진 관측: 한 층에서 닫은 규율은 옆 층에서 다시 세어지지 않는다**(AB-1).
라운드 86은 화면 층에서 셋을 닫았다 — **호버로만 닿는 값**(AA-2 · 어드민 분석 화면) · **실패 문장의
오프라인 배선**(AA-3 · 온보딩 준비물) · **행마다 갈리는 낭독 라벨**(AA-4 · 가족 화면의 대기 초대).
⚠️ **오늘 그 셋이 각각 한 칸 옆에서 살아 있었다**: 호버는 **형제 앱의 다른 화면**(감사 로그 표 —
트랙 A), 실패 문장은 **같은 화면의 형제 갈래**(목록이 남은 창 — 트랙 B), 낭독 라벨은 **형제 화면**
(알림 설정의 기기 목록 — 트랙 D)에. ⚠️⚠️ **그리고 넷째가 층 자체였다**: 낭독의 출구를 세는 두 스윕이
`app/**` **한 뿌리**만 걸어, 문구가 모듈에 사는 온보딩 세 화면을 **구조적으로 보지 못했다**(트랙 C).
**셋 다 *고칠 방법*이 없어서 남은 것이 아니라 *세는 자리*가 없어서 남았다** — 그래서 세 트랙이 화면
한 줄과 함께 **모집단 한 벌**을 세운다.

⚠️⚠️ **두 번째 관측: 화면이 자기 도달 경로의 한계를 문장으로 자백하고 있으면 그것은 관측이 아니라
결함의 자백이다**(AB-2). 감사 로그 표의 각주는 *"전체 ID는 칸에 **마우스를 올리면** 보여요"* 라고
적고 있었고 소스 주석도 *"UUID 전체는 `title` 속성으로만"* 이라고 적어 두었다. ⚠️⚠️ **그리고 그 값을
요구하는 필터가 같은 화면에 있었다** — 행위자 ID 칸은 **UUID 전체**를 요구하며 형식이 아니면 막는다.
**표가 보여 준 것으로 그 표의 필터를 채울 수 없었다.** AA-2가 *"값을 마우스에만 주는 화면은 값을 버린
화면과 같은 자리에 선다"* 였다면 이것은 그 한 칸 안쪽이다 — **그 화면이 그 사실을 이미 알고 문장으로
적어 두고 있었다.**

⚠️⚠️ **세 번째 관측: 조건이 자기 손과 자기 자리를 함께 적어 두면 그것은 조건이 아니라 배정 대기
작업이다**(AB-3). AA-R ②는 **문서와 소스 두 곳**에 자리를 적어 두었다 — 문서는 *"손은 저장소 안"* 이라고,
소스는 *"다음 라운드가 집어 들 자리"* 라고. 오늘 전제를 다시 재니 아직 참이었고, 집어 들자 고칠 것은
**갈래 조건 하나**였다(문구는 한 글자도 바뀌지 않았다). **참일 때 집는 것이 싸다.** ⚠️ **AA-3이 이름
붙인 분류의 첫 집행이고, 그 분류가 다음 라운드의 배정표로 실제로 쓰였다는 것이 이 관측의 값이다.**

⚠️⚠️ **네 번째 관측: 대장에 이름이 있다는 사실이 *"그 자리는 세어졌다"* 로 읽힌다**(AB-4). 낭독 프롭을
건 자리를 세는 대장에 `OnboardingSaveErrorCard`가 **여섯째 항목**으로 서 있었고 설명까지 *"모듈 층의 한
자리"* 라고 적혀 있었다 — ⚠️ **그런데 그 프롭 조합은 안드로이드 전용이고, 그것이 반쪽이라는 판정은
어디에도 없었다.** 앱의 첫 여정 셋(ONB-002·003·004)의 저장 실패가 **iOS에서 소리 없이** 서 있었고,
**아무 테스트도 빨개지지 않았다.** 라운드 86 A가 `itemListBadgeLabel`에서 본 착시(*계약만 초록인데
아무도 부르지 않는다*)가 **한 칸 옆에서 반복됐다** — 이번에는 *부르지 않는다*가 아니라 *반만 부른다*이다.

⚠️⚠️ **다섯 번째 관측: 스윕의 사각은 정찰 자신의 스윕에도 있다**(AB-5). AA-5가 남긴 질문에 답하려고
*"다음 라운드가 먼저 세어 볼 만한 것"* 의 전수를 세는데, **한 줄 grep이 스물여덟만 셌다** — 그 문장이
줄바꿈으로 갈린 자리 **여덟**을 놓쳤고(실제는 서른여섯), ⚠️⚠️ **그 사각에 Z-1과 AA-2가 앉아 있었다.**
같은 성질이 응답 필드 축에서도 한 번 더 나왔다: 라운드 86이 이름으로 훑어 *"화면이 쓰고 있다"* 로
분류한 `osVersion`은 **등록 경로와 타입 선언에만** 나오고 **화면은 한 번도 읽지 않았다** — AA-4가 이름
붙인 흔한 이름의 사각이 **다른 필드에서 재발했고 오늘의 트랙 하나가 정확히 거기 있었다.**
**수를 낼 때는 그 수를 어떻게 냈는지도 함께 적는다.**

⚠️⚠️ **이월 다섯은 전부 보류 유지이고 재실측 값만 갱신했다 — 갱신 한 줄씩은 그 판정이 사는 절에 있다**
(다음 라운드가 같은 실측을 다시 돌리지 않도록 여기서는 자리만 가리킨다).

- **이 스캐너가 쿼리로 분류한 자리의 낭독** — 재실측 상태 변화 0, A-20 #85 선행 → **U절 머리말**
  (⚠️ 접점이 둘인데 방향이 라운드 86과 다르다 — 트랙 D가 그 여섯 화면 중 하나를, 트랙 C가 그 계약
  파일을 열었고 **표는 바이트 불변**이다).
- **`monthly_wrapup`의 달 이동 구멍** — 게이트가 읽는 것은 여전히 대기 행의 바뀐 뒤 날짜 하나 → **U-3**
  (⚠️ 트랙 D가 `src/notifications/**`를 **쓰기로** 열었는데도 접점 0건이다).
- **S-3(어드민 `disabled`)** — 재실측 **열하나**(items 6 · links 5), 브라우저 확인 `#130` 선행 →
  **U절 머리말**(⚠️ **세 라운드 연속 접점 0건**이다).
- **`withdrawn_at`** — 저장소 전체 **3건 · 파일 둘**, 컬럼 신설은 여전히 별도 결정 → **U절 머리말**
  (⚠️ 어느 트랙도 `apps/api/**`·`prisma/`를 열지 않았고, 저장소 전역을 읽는 트랙 E조차 그 뿌리를
  **명시적으로 제외**하고 그 사실을 *미측정*으로 적었다).
- **`/budget` 겹침 착지** — `URL_OVERLAPS` 여전히 **둘**, 확인의 표 `#133` 대기. ⚠️ **이 이월의 갱신
  줄은 U-5에 더하지 않는다**(라운드 86이 세운 그 판단 그대로 — 그 절의 질문에는 라운드 84가 전수로
  답했고 오늘 상태 변화가 0이라, 같은 답을 다시 쓰면 **그 자체가 계약 밖의 사본이 된다** · O-3).
  여기 적힌 한 줄이 그 이월의 오늘 값이고, **어느 트랙도 라우트 표면을 열지 않았다.**

**다섯 다 2026-08-31 재실측이고 상태 변화 0이다.** ⚠️⚠️ **그리고 이번 라운드의 접점 지도는 라운드 86과
정확히 반대 방향으로 하나 움직였다: 두 라운드 연속 0건이던 `src/notifications/**`가 오늘 열렸고**
(트랙 D — 라운드 80 이후 처음으로 **쓰기로** 열렸다), **대신 어드민의 S-3은 *그 열한 자리에 대한 접점*이
세 라운드 연속 0건이다**(⚠️ 파일 접점 0건은 두 라운드 연속이다 — 두 수를 한 낱말로 적지 않는다). 두 사실 다 그 자리의 상태를 바꾸지 않는다는 것이 이 문단의 값이다 — **접점의 유무는 실측을
대신하지 않는다.**

⚠️⚠️ **AA-1~AA-5가 남긴 *"먼저 세어 볼 만한 것"* 다섯 전수와 오늘의 답이다 — 다섯 다 발동했다.**
⚠️ **수치는 여기 옮겨 적지 않고 그 수를 세는 자리를 가리킨다**(O-3·X-4의 규율 — 옮겨 적힌 수는 계약
밖의 사본이고, 아래 답의 상당수는 **계약이 아니라 정찰이 손으로 잰 수**라 더욱 그렇다. 전수와 실측값은
`docs/5차/round87-scout.md`의 **선행 확인 3~10**이 든다).

- **AA-1**(**순수 판정 모듈 중 화면 호출부가 0건인 export**가 몇이고 그중 계약만 초록인 것이 몇인가) —
  ⚠️ **발동했고 오늘의 트랙 하나가 통째로 그 답이다**(트랙 E). 모집단을 먼저 값으로 정하고
  (`export function` · 계약 전용 데이터 모듈 제외 · 자기 파일 제외) 호출부 0건을 전수로 세어 **항목마다
  이유**를 셋 중 하나로 갈랐다 — *이름이 고백하는 것* · *이유가 소스에 있는 것* · *이유가 대장에만 있는 것*.
  ⚠️⚠️ **그리고 세는 자리가 서던 그 라운드에 답이 하나 바뀌었다**: 정찰이 센 열일곱 중 하나
  (`hasAnyAuditLogFilter`)를 **병렬 트랙 A가 되살려** 대장은 열여섯으로 섰고, **그 계약이 첫 실행에서
  실제로 빨갛게 잡았다**(수는 그 파일이 센다 — 이 절은 옮겨 적지 않는다). ⚠️ **오늘 그 열여섯 중
  사용자에게 보이는 결함은 0건이다** — 하나씩 판정했고 그 판정이 각 줄의 이유로 붙어 있다.
  ⚠️ **재개 조건(사건형): 새 사문이 생기는 날** — 그날 두 답 중 하나(지우거나 · 이유를 적거나)를
  **값으로** 고르게 되고, 래칫이 그 선택을 강제한다.
- **AA-2**(**두 화면이 같은 모양의 UI를 각자 조립하는 자리**가 몇이고 그중 둘이 이미 갈려 있는 것이
  몇인가) — ⚠️ **발동했다.** 어드민 전수를 다시 세니 호버로만 닿는 값이 남은 자리는 **한 화면**이었고
  (라운드 86 D가 닫은 둘은 이제 표가 도달 경로를 진다) **그 하나가 트랙 A가 됐다**(AB-2). ⚠️ **같은
  스윕에서 모바일 지출 입력 두 화면도 모집단에 들어왔는데 재어 보니 *조립만 다르고 판정은 같았다*** —
  그 기각은 아래 열셋에 재개 조건과 함께 있다(**0건도 재어 본 값이다**). ⚠️ **재개 조건(사건형): 어느
  한쪽에 새 저장 가드·새 도달 경로가 서는 날**(그날 반대쪽에 같은 축이 있는지를 그 트랙이 함께 센다).
- **AA-3**(이 문서의 재개 조건 중 **그 조건의 전제를 오늘 다시 재어 본 것**이 몇인가) — ⚠️ **발동했다.**
  재개 조건이 나오는 줄 전수 가운데 **오늘 전제를 재실측한 것은 일곱**(이월 보류 다섯 + AA-R 둘)이고,
  그 일곱 중 하나에서 오늘의 트랙 하나가 나왔다(AA-R ② → 트랙 B · AB-3). ⚠️⚠️ **그리고 이 답에는
  사각이 하나 붙는다**: 그 줄들 가운데 **괄호로 형(사건형·결정형)을 밝힌 것은 소수**이고 나머지는 산문
  안에서 형이 갈린다 — **표기 불균형 자체가 AA-3의 다음 사각이다**(수는 정찰 노트가 센다).
  ⚠️ **재개 조건(결정형 · 손은 저장소 안): 재개 조건을 적을 때 형을 괄호로 밝히는 관례가 서는 날** —
  그날 이 사각이 기계로 세어진다.
- **AA-4**(이 저장소의 스윕 중 **자기 모집단의 사각을 값으로 적어 둔 것**이 몇인가) — ⚠️ **발동했다.**
  디렉터리를 걸어 **모집단을 스스로 만드는** 계약 전수 가운데 뿌리·제외·사각을 값으로 적은 것은
  **다섯**이었고, ⚠️⚠️ **적지 않은 사각 하나에 오늘의 결함이 앉아 있었다**(낭독 스윕 둘이 `app/**` 한
  뿌리만 걸었다 — AB-4). 오늘 그 다섯이 **일곱**이 됐다: 트랙 C의 모듈 층 스윕과 트랙 E의 대장이 둘 다
  **태어날 때부터** 그 셋을 값으로 진다(수를 세는 자리는 그 두 파일 자신이다).
  ⚠️ **재개 조건(사건형): 디렉터리를 걷는 스윕이 하나 더 서는 날** — 그날 그 스윕이 자기 사각을 함께
  적는지가 이 질문의 다음 답이다.
- **AA-5**(K~AA절이 남긴 *"먼저 세어 볼 만한 것"* 전수 중 **아직 한 번도 답해지지 않은 것**이 몇이고,
  그중 ①·② 둘 중 하나가 없어서 답해지지 않은 것이 몇인가) — ⚠️ **발동했고 답은 0이다.** 전수를 세니
  **답해지지 않은 것이 0건**이었다(R-6~W-5는 그 자리에 갱신 줄이 붙어 있고, X~AA는 각 라운드가 절 안에서
  답했다). ⚠️⚠️ **그런데 세는 동안 값이 나온 것은 *답의 유무*가 아니라 *답을 되짚는 줄의 부재*였다** —
  **X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4 열여섯**은 질문만 읽는 사람에게 *"아직 아무도 안 셌다"* 로
  읽힌다. 오늘 트랙 F가 그 **열여섯 자리에 되짚는 한 줄씩**을 붙였다(판정은 옮겨 적지 않고 가리키기만
  한다). ⚠️ **그 열여섯을 세는 자리는 `docs/5차/round87-scout.md`의 선행 확인 8**이고, ⚠️⚠️ **그 수를
  처음 잴 때 여덟을 놓친 사각이 오늘의 판정 AB-5다.**
  ⚠️ **재개 조건(사건형): 새 절이 서는 날** — 그날 그 절의 질문 다섯이 이 목록에 더해지고, 되짚는 줄은
  **그 질문이 답해진 라운드**가 붙인다.

⚠️⚠️ **U-2·U-5·W-2·W-3·W-5·X-5·Y-5·Z-5의 판정은 다시 쓰지 않는다.** 라운드 84~86이 그 전수에 답했고
**오늘 상태 변화가 0**이라, 같은 답을 다시 쓰면 **그 자체가 계약 밖의 사본이 된다**(O-3).
⚠️ **X-1~X-4·Y-1~Y-4·Z-1~Z-4·AA-1~AA-4는 위에서 말한 *되짚는 한 줄*이 오늘의 값이고, 그 절들의 본문도
다시 쓰지 않았다.**

⚠️ **N-4의 두 문턱은 오늘로 열 라운드 연속 미발동이고, 준비템 탭 비가상화는 이번에도 제안하지
않는다** — ⚠️ **그 두 수는 화면이 세므로 이 절도 옮겨 적지 않는다**(O-3 · 갱신 한 줄은 N-4에 있다).

⚠️⚠️ **AA-3의 이행 — 결정형 재개 조건 전수와 오늘의 처분이다. 라운드 86의 다섯이 오늘 아홉이 됐다**
(⚠️ **조건이 늘어서가 아니라 산문 안에 형이 갈려 있던 것을 전수로 세었기 때문이다** — 그 사실이 위
AA-3의 답에 사각으로 적혀 있다). ⚠️ **아홉 각각에 *"그 결정을 내릴 손이 이 저장소 안에 있는가"* 를
함께 적는다**(손이 안에 있으면 그것은 조건이 아니라 **아직 배정되지 않은 작업**이고, 밖에 있으면
문서가 할 수 있는 일은 경과를 정직하게 적는 것뿐이다).

| # | 결정형 조건 | 사는 곳 | 손이 저장소 안에 있는가 | 오늘의 처분 |
| --- | --- | --- | --- | --- |
| 1 | **온보딩 `isError && hasOptions` 창에 실패 문장이 서지 않는다** | AA-R ② | ⚠️ **안에 있다**(문서와 **소스 두 곳**이 자리를 적어 두었다) | ⚠️⚠️ **집어 들었다 → 트랙 B.** 고칠 것은 **갈래 조건 하나**였고 문구는 바이트 불변이다 — **AA-3 분류의 첫 집행**(AB-3) |
| 2 | **근거를 값으로 적는 관례(대장)** — *"어느 라운드가 세우는 날"* | Z-1 갱신 | 안에 있다 | **집지 않는다 — 순서 때문이다.** 오늘의 세 실측이 전부 **소스 구조**에서 나왔고 주석 축은 그보다 뒤다. ⚠️ **재개 조건을 좁힌다: 트랙 E의 호출부 대장이 한 라운드를 살아남는 날** |
| 3 | **막대를 포커스 가능하게 만들 것인가**(디자인·접근성 결정) | AA-2 | 안에 있다 | **집지 않는다 — 그 결정의 값이 오늘 0이다.** 라운드 86 D의 표가 이미 값을 텍스트로 주므로 새 상호작용 표면은 값이 아니다. ⚠️ **재개 조건: 표로 닿지 못하는 값이 차트에 생기는 날** |
| 4 | **기록 탭 검색의 분류 갈래** — *"placeholder가 분류를 약속하는 날"* | Z절 | 안에 있다(문구의 단일 소스가 저장소 안이다) | **집지 않는다 — 오늘도 약속이 참이다.** 재실측에서 라벨이 여전히 *"품목명, 판매처, 메모"* 하나이고 placeholder가 그 값에서 파생한다 — **고칠 어긋남이 0건** |
| 5 | **준비템 분류 필수 입력** — *"카탈로그 정책이 서는 날"* | Z-3 | ⚠️ **밖에 있다**(카탈로그 정책 · 서버 계약) | **집지 않는다.** 서버가 생략을 *"분류 없음"*/*"기존 유지"* 로 나눠 읽는 계약이 있고, 그것을 바꾸는 것은 **정책**이지 코드 판정이 아니다 |
| 6 | **서버의 중복 대기 초대 방지** | AA-4 | ⚠️ **밖에 있다**(초대 정책) | **집지 않는다.** 라운드 86 C가 한 일은 그 결정 없이도 **둘을 구별되게** 만든 것이고, 그 판정은 오늘도 참이다 |
| 7 | **감사 뷰의 대상(targetType·targetId) 필터** | AA절 기각 | ⚠️ **밖에 있다**(서버 DTO에 그 파라미터가 0건) | **집지 않는다 — ⚠️ 트랙 A는 서버를 열지 않았다.** 오늘 A가 연 것은 *같은 값에 도달하는 길*이지 *새 축의 필터*가 아니다 |
| 8 | **타일 안 배지(승인 디자인)** | AA-1 | ⚠️ **밖에 있다**(디자인 승인) | **집지 않는다.** 승인 자산의 렌더를 여는 것은 이 저장소의 결정이 아니다 |
| 9 | **C-3 잠금 오버레이 TalkBack 투과** — *"사람·기기·날짜 배정"* | 접근성 표 C-3 | ⚠️⚠️ **밖에 있다** | **트랙 F의 소유 밖이다**(오늘로 **스물한 라운드 연속 미확인**). ⚠️ **아홉 중 이 하나만 성질이 또 다르다 — 나머지 밖 넷은 *다른 사람이 내릴 결정*이고, 이 줄은 *아무도 배정하지 않은 사람의 시간*이다** |

⚠️ **이 표가 라운드 86의 표보다 값이 큰 이유는 셋이다.** ⓐ **수가 다섯에서 아홉으로 늘었는데 그것이
새 부채가 아니다** — 산문 안에 형이 갈려 있던 것을 전수로 세었을 뿐이고, **세어 보기 전에는 넷이
보이지 않았다.** ⓑ **손이 안에 있는 넷 중 하나는 집혀 그날 닫혔고 셋은 *집지 않은 이유가 값이 됐다*** —
순서(2) · 값 0(3) · 어긋남 0건(4). **손이 안에 있다고 다 집는 것이 아니라, 집지 않는 이유를 값으로
적는 것이 그 분류의 나머지 절반이다.** ⓒ **밖에 있는 다섯 중 넷과 하나가 또 갈린다**(위 9의 칸) —
**결정형 조건을 적을 때 함께 적어야 하는 것은 조건의 문장이 아니라 그 결정의 손이 어디에 있는가다.**

⚠️⚠️ **이번 라운드가 실측하고 기각한 열셋을 값으로 남긴다 — 전부 재개 조건과 함께**(V-2가 세운 규율:
조건 없는 보류는 이유가 적혀 있다는 이유로 재론되지 않는다). ⚠️ **그중 넷은 재개 조건이 *결정형*
이라는 사실과 그 결정의 손이 어디에 있는지를 함께 적는다**(Z-4·AA-3·AB-3의 이행).

- **응답 필드 축(모바일) — 라운드 86의 열은 이월 그대로이고, 오늘 그 축에서 나온 하나는 *기각이 아니라
  사각이었다*.** 라운드 86이 판정한 열은 오늘도 값이 0이다(표시 대상이 아니거나 · 화면이 이미 아는
  값이거나 · 서버가 언제나 같은 값을 준다). ⚠️⚠️ **다만 그 스윕이 *쓰고 있다* 로 분류한
  `UserDeviceSummary.osVersion`은 등록 경로와 타입 선언에만 나오고 화면은 한 번도 읽지 않았다** —
  AA-4의 사각이 다른 필드에서 재발했고 **오늘 트랙 D가 정확히 거기 있었다**(AB-1·AB-5).
  ⚠️ **재개 조건(사건형): 응답에 새 필드가 실리는 날, 또는 그 스윕을 다시 돌리는 날** — ⚠️ **다시
  돌릴 때는 이름 훑기가 흔한 이름을 가르지 못한다는 사실을 함께 지고 돌려야 한다.**
- **사문 열여섯의 판정 — 재었고 오늘 지우지 않는다.** 대장에 선 열여섯은 하나씩 판정했고 **사용자에게
  보이는 결함이 0건**이라, 이 라운드가 한 일은 **세는 자리를 세우는 것**이고 지우는 판단은 그 자리가
  선 다음이다. ⚠️ **재개 조건(사건형): 그 대장이 한 라운드를 살아남는 날** — 그날 *지운다/이유를 적는다*
  두 답 중 하나를 항목별로 고르는 것이 트랙이 된다.
- **지출 입력 두 화면의 조립 — 재었고 갈리지 않았다(핵심 루프 1단계).** 새 기록은 묶음 헬퍼로 **저장
  버튼 위 한 줄**을, 수정은 같은 모듈의 단품으로 **칸 옆 인라인 오류**를 세우는데 **두 화면 다 상한·
  0 이하·날짜·정수 넷을 막고 버튼을 잠근다** — 조립만 다르고 판정은 같다.
  ⚠️ **재개 조건(사건형): 어느 한쪽에 새 저장 가드가 서는 날.**
- **감사 뷰 CSV — 재었고 제안하지 않는다.** 내려받는 CSV의 열에는 행위자·대상·가구 식별자가 **전부**
  실려 있고 수식 인젝션 중화까지 지난다 — 전체 ID의 도달 경로가 아예 없었던 것은 아니다.
  ⚠️ **다만 그것은 파일 한 벌을 내려받는 길이고, 화면 위에서 한 행을 되짚는 길이 아니다**(트랙 A가 연
  것이 후자다). ⚠️ **재개 조건(사건형): CSV의 열이 화면의 열과 갈리는 날.**
- **콘텐츠 리비전 편집 표면 — 재었고 제안하지 않는다.** `updateContentRevisionDraft`의 호출부가 0건인
  것은 **초안을 고치는 화면이 없기 때문**이고, 반려받은 편집자는 원래 화면에서 다시 저장해 새 초안을
  만든다 — **흐름이 닫혀 있다.** ⚠️ 그때까지 값인 것은 *"표면이 있다"* 는 계약 문장이 *"닿는다"* 로
  오해되지 않게 하는 것뿐이고, 오늘 그 자리는 트랙 E의 대장이 진다.
  ⚠️ **재개 조건(사건형): 검수 화면에서 초안 본문을 고치는 요구가 실제로 서는 날.**
- **어드민 손 미러 — 재었고 갈린 것 0건.** 정본을 소스로 읽어 대조하는 계약이 이미 있고 면제 둘에는
  이유가 값으로 있다. ⚠️ **그리고 그 면제 둘이 가리키는 파일이 이번 라운드의 트랙 A가 여는 파일이라,
  *"새 export를 더하지 않는다"* 가 그 트랙의 금지 조항이었다**(더했다면 미러 스윕이 먼저 빨개진다).
  ⚠️ **재개 조건(사건형): 새 손 미러가 서는 날.**
- **`SYNC_STATUS_RETRY_ALL_LABEL` — 재실측했고 화면 참조는 오늘도 0건이다.** 일괄 재시도의 **범위**를
  말하는 그 라벨을 화면이 쓰지 않는 것은 화면이 **대상과 건수를 말하는 라벨**을 쓰기 때문이고 그것이
  옳은 판정이다. ⚠️ **이 상수는 `export const`라 트랙 E 대장의 모집단 밖이고, 그 사실이 그 대장의 사각
  칸에 값으로 적혀 있다.** ⚠️ **재개 조건(사건형): 준비템 상태 큐까지 다루는 일괄 액션이 서는 날.**
- **성능 넷 — 재실측했고 넷 다 미도래다.** ⓐ **첫 페인트**(⚠️ 어느 트랙도 `useQuery` 선언을 늘리지
  않았다) · ⓑ **렌더 비용**(활성 카탈로그는 N-4 문턱 아래이고 ⚠️ **어느 트랙도 준비템 탭을 열지
  않았다**) · ⓒ **번들**(⚠️ **새 런타임 의존성 0건 — 다섯 트랙 다 기존 import만 쓴다**) · ⓓ **api의
  루프**(⚠️ **`apps/api/**` 쓰기 0건**). ⚠️ **수는 여기 옮겨 적지 않는다** — ⓑ의 문턱은 라운드 83 C의
  어드민 카드가, ⓒ는 의존성 목록 자신이 센다. ⚠️ **재개 조건은 넷 다 종전 그대로다**(Z-5의 그 문장).
- **기록 탭 검색이 분류 이름을 보지 않는 것 — 재었고 이번에도 제안하지 않는다.** 재실측에서도
  **약속이 참이다**(라벨이 훑는 곳을 정확히 말하고 분류 칩 줄이 검색칸 아래에 선다).
  ⚠️⚠️ **재개 조건이 결정형이고 손은 저장소 안이다**(위 표의 4) — 그런데 **고칠 어긋남이 0건이라
  집어 드는 것이 *판정을 맞추는 일*이 아니라 *문구를 바꾸는 일*이 된다.** 두 라운드 연속 같은 답이다.
- **Z-1의 "근거 대장" — 결정형이고 손은 안이지만 오늘 집지 않는다.** 이유는 **순서**다: 오늘의 세 실측
  (호출부 0건 · 호버 도달 경로 · 낭독 출구)이 전부 **주석이 아니라 소스 구조**에서 나왔고, 주석 축의
  대장은 그 뒤에 서는 것이 순서다. ⚠️ **재개 조건(결정형 · 손은 저장소 안): 트랙 E의 호출부 대장이 한
  라운드를 살아남는 날** — 라운드 86이 적어 둔 *"어느 라운드가 세우는 날"* 보다 **한 칸 좁아졌다.**
- **막대 포커스 가능화 — 재었고 값이 0이다.** 라운드 86 D의 표가 이미 값을 텍스트로 주므로 새 상호작용
  표면은 값이 아니다. ⚠️ **재개 조건(결정형 · 손은 저장소 안): 표로 닿지 못하는 값이 차트에 생기는 날.**
- **손이 밖인 다섯 — 넷은 다른 사람이 내릴 결정이고 하나는 배정이다**(위 표의 5~9). 준비템 분류 필수
  입력 · 서버의 중복 대기 초대 방지 · 감사 뷰의 대상 축 필터 · 타일 안 배지는 **카탈로그 정책 · 초대
  정책 · 서버 계약 · 디자인 승인**이 각각 선행이고, C-3은 **사람·기기·날짜 배정**이다.
  ⚠️ **재개 조건(전부 결정형 · 손은 저장소 밖): 그 결정이 서는 날** — ⚠️ **넷과 하나를 한 줄에 적지
  않는 이유가 그 칸이다**(앞의 넷은 결정할 사람이 있고, 뒤의 하나는 그 사람이 아직 정해지지 않았다).
- **`${seller}에서 구매하기` 둘 — 제외 확인이지 제안이 아니다.** 낭독 라벨을 템플릿 리터럴로 만드는
  자리를 전수로 훑는 과정에서 이 둘이 걸렸는데, 준비템 판매처 1:1과 구매 확인 판매처 라벨은
  **영구 기각** 축이다(라운드 62~86이 남긴 그대로). ⚠️ **재개 조건: 없다 — 이 줄은 재론 대상이 아니라
  스윕이 그 둘을 다시 줍지 않게 하는 표식이다.**

**이 라운드가 짝 문서에 남긴 것.** 확인의 표에 **#156~#159 넷**이 서고(⚠️ **표면은 `실기기` 셋 ·
`브라우저` 하나** — 라운드 85·86과 **같은 배분이 세 라운드 연속**이다 · 트랙 E는 **소스 계약이라 표에
행이 서지 않는다**) §0의 여섯 숫자가 파싱으로 다시 세어졌으며, 접근성 표에는 **A-28 #101·#102·#103
셋**이 섰다. ⚠️⚠️ **A-28이 A-27과 다른 점 하나를 그 절의 머리말이 진다: 라운드 86의 셋은 *새 노드 한
줄이 이웃의 낭독을 방해하지 않는가*를 물었고, 이번 셋은 *이미 서 있던 자리가 실제로 도달하는가*를
묻는다**(카드는 프롭을 달고도 한 플랫폼에만 답했고, 버튼은 그 창에서 맥락이 없었으며, 스위치 라벨은
두 기기에 같은 문자열이었다). ⚠️⚠️ **그리고 이번 셋 중 둘은 기기 조건 자체가 다르다** — `#101`은
**iPhone**이 있어야 답이 나고(VoiceOver), `#103`은 같은 플랫폼 기기가 **두 대** 있어야 재현된다.
**그 표가 *"기기 한 대로는 답이 나지 않는 행"* 을 값으로 적은 것은 이번이 처음이고, 그 사실은 배정을
쉽게 만드는 쪽이 아니라 어렵게 만드는 쪽이다.** ⚠️ **트랙 A의 어드민 항목은 종전 판정대로 행이 아니라
문단으로 적었다**(브라우저 화면은 그 표의 조건 밖이다) — ⚠️ **다만 그 트랙이 고친 것이 정확히 접근성
축이라는 사실은 문단이 진다**: 종전 그 표의 전체 UUID는 마우스 호버에만 있었고 **화면이 그 사실을
스스로 자백하고 있었다**(AB-2). ⚠️⚠️ **C-3(잠금 오버레이 TalkBack 투과)은 오늘로 스물한 라운드 연속
미확인**이고, ⚠️ **이번 라운드가 그 줄에 더하는 값은 경과 수가 아니라 *분류가 한 라운드를 살아남았다*
는 사실이다**: 라운드 86이 붙인 *"손이 저장소 밖"* 이라는 분류를 라운드 87이 **실제로 써서** 결정형
아홉을 다시 세고 그중 손이 안인 하나를 그날 닫았다(위 표의 1). **같은 문서의 결정형 하나는 한 라운드
안에 닫혔고, 이 줄은 스물한 라운드째 그대로다 — 다른 것은 우선순위가 아니라 그 결정의 손이 있는
자리다.** 그 줄 옆에는 이번에도 새 `실기기` 행이 셋 섰다(라운드 84는 0건, 85·86·87은 셋씩 —
**0건이든 셋이든 같은 칸이 비어 있다**).

### AB-1. **한 층에서 닫은 규율은 옆 층에서 다시 세어지지 않는다** — 화면 층에서 닫힌 셋이 모듈 층·형제 갈래·형제 화면·형제 앱에 그대로 남아 있었다

- **사실.** 라운드 86은 셋을 닫았다 — 값이 **마우스에만** 있는 자리(AA-2 · 어드민 분석 화면) · 조회
  실패의 **오프라인 배선**(AA-3 · 온보딩 준비물) · 목록 행 컨트롤의 **행마다 갈리는 낭독 라벨**
  (AA-4 · 가족 화면의 대기 초대). ⚠️ **셋 다 그 라운드가 연 화면에서는 옳게 닫혔다.**
- ⚠️⚠️ **오늘 그 셋이 각각 한 칸 옆에서 살아 있었고, 옆의 거리가 셋 다 달랐다.**
  ⓐ **형제 앱의 다른 화면** — 감사 로그 표의 전체 식별자는 오늘도 `title` 속성에만 있었다(트랙 A).
  ⓑ **같은 화면의 형제 갈래** — 실패 문장 두 줄이 0건 갈래 안에 묶여 있어, 목록이 남은 채 실패한 창
  에서는 버튼만 맥락 없이 섰다(트랙 B). ⓒ **형제 화면** — 알림 설정의 기기 목록은 두 행의 제목도 두
  스위치의 낭독도 **글자 하나 다르지 않았다**(트랙 D). ⚠️ **그리고 넷째는 옆이 아니라 아래였다**:
  낭독의 출구를 세는 두 스윕이 `app/**` **한 뿌리**만 걸어, 실패 문구가 **모듈**에 사는 온보딩 세
  화면을 **구조적으로 보지 못했다**(트랙 C · AB-4).
- ⚠️⚠️ **넷 다 *고칠 방법*이 없어서 남은 것이 아니다 — *세는 자리*가 없어서 남았다.** 라운드 86의 세
  계약이 문 것은 **그 화면의 그 자리**였다(목록 소스가 그 함수를 실제로 부르는가 · 문장과 버튼이 한
  짝인가 · 행·확인창·낭독 셋이 같은 값인가). **옳은 계약이고, 모집단이 하나짜리였을 뿐이다.**
- **오늘의 값 — 화면 한 줄마다 모집단 한 벌이다.** ⓐ 트랙 D는 기기 행의 제목·낭독 라벨을 한 모듈에서
  파생하고(`device-rows.ts` — **플랫폼 문자열은 인자로 받아 새 이름을 짓지 않는다**) *이 기기* 사실을
  **낭독에도** 보낸다. ⓑ 트랙 C는 낭독 스윕에 **모듈 층 뿌리**를 더한다(걷는 뿌리와 걷지 않는 뿌리와
  그 이유가 **둘 다 값**). ⓒ 트랙 E는 호출부 0건인 export를 **두 앱 전수로** 센다. ⓓ 트랙 A·B는 그
  자리를 닫으면서 **호출부의 실재**와 **조건절의 실행**을 계약으로 못 박는다.
- ⚠️ **그리고 이 판정은 라운드 86을 나무라지 않는다.** 한 라운드가 닫을 수 있는 것은 자기가 연 화면
  이고, **옆 층에 같은 필요가 있는지는 다음 라운드의 질문**이다(Y-3이 두 앱에 대해 이름 붙인 그 축이
  층·갈래·화면으로 세 번 더 참이었다). ⚠️ **다만 그 질문을 *묻는 자리*가 없으면 옆 층은 조용하다** —
  오늘 셋이 그랬다.
- **일반형.** **한 층에서 닫은 규율은 옆 층에서 저절로 다시 세어지지 않는다 — 규율을 닫은 라운드가
  세운 계약은 대개 *그 자리*를 물지 *그 규율이 필요한 모집단*을 묻지 않기 때문이다.** 그래서 규율을
  닫은 다음 라운드가 먼저 할 일은 같은 규율을 한 번 더 닫는 것이 아니라 **그 규율의 모집단을 값으로
  정하는 것**이다. ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소가 닫은 규율 중 **그 규율의
  모집단을 값으로 가진 것이 몇이고, 그중 모집단이 *한 자리*인 것이 몇인가**(오늘 셋에 모집단이
  생겼고, 그 셋은 전부 어제까지 한 자리였다).
- ⚠️ **갱신 (2026-08-31 · 라운드 88 트랙 F) — 답한 자리를 되짚는다.** 라운드 88 **AC절 머리말**이
  답했다(전수와 실측은 `docs/5차/round88-scout.md`의 **선행 확인 3**이 든다 — 닫힌 규율을 전수로 세고
  모집단이 값으로 있는 것과 없거나 한 자리인 것을 갈랐다). ⚠️ **판정을 여기 옮겨 적지 않는다**(O-3·X-4)
  — 어느 절이 답했는지만 가리킨다. ⚠️ **그 답에서 오늘의 트랙 셋이 나왔고, 그 사실이 이 질문이 낸
  가장 큰 값이다.**

### AB-2. **화면이 자기 도달 경로의 한계를 문장으로 자백하고 있으면 그것은 관측이 아니라 결함의 자백이다** — 그리고 그 값을 요구하는 필터가 같은 화면에 있었다

- **사실.** 감사 로그 표는 행위자·대상 두 칸에 **UUID 앞 8자**만 글자로 세우고 전체 값을 `title`
  속성(마우스 호버)으로만 줬다. ⚠️ **그 사실은 숨겨져 있지 않았다** — 소스 주석이 *"UUID 전체는
  `title` 속성으로만"* 이라고 적었고, 화면의 각주가 사용자에게 *"전체 ID는 칸에 **마우스를 올리면**
  보여요"* 라고 말하고 있었다.
- ⚠️⚠️ **그리고 그 값을 요구하는 필터가 같은 화면에 있었다.** 위 필터 폼의 행위자 ID 칸은 **UUID
  전체**를 요구하고 형식이 아니면 *"행위자 ID는 UUID 형식이어야 해요"* 로 막는다. **표가 보여 준
  것으로 그 표의 필터를 채울 수 없었다** — 키보드·스크린리더 운영자에게는 그 값에 닿는 길이 아예
  없었고, 마우스를 쓰는 운영자에게도 **호버로 읽어 손으로 옮겨 적는** 길뿐이었다.
- ⚠️ **AA-2의 일반형이 그대로 참이고, 한 칸 더 나쁘다.** 라운드 86이 분석 화면에서 찾은 것은 *"값이
  마우스에만 있다"* 였는데, 여기서는 **그 화면이 그 사실을 이미 알고 문장으로 적어 두고 있었다.**
  ⚠️ **문장으로 적힌 한계는 다음 사람에게 *설명*으로 읽힌다** — *"그렇게 설계됐구나"* 로 읽히지
  *"여기가 막혀 있다"* 로 읽히지 않는다.
- **오늘의 값 — 펼침 하나와 되짚는 링크 하나, 그리고 사문 하나의 부활이다.** ⓐ 두 칸의 전체 식별자가
  같은 행의 `details`/`summary` 관례(그 표가 *상세* 칸에서 이미 쓰는 형식)로 **글자로** 펼쳐지고,
  값은 한 번 클릭으로 통째로 잡힌다. ⓑ 어드민 계정이 **아닌** 행위자 행에는 펼침 안에 [이 행위자의
  기록만 보기]가 서는데 **새 주소를 만들지 않고** 사용자 조회 화면이 이미 쓰는 한 함수에서 온다.
  ⓒ ⚠️ **0건 문장이 두 갈래가 됐다** — 종전에는 필터를 **하나도 걸지 않은** 운영자에게도 *"조건에
  맞는 기록이 없어요"* 라고 말해 **없는 조건을 지우러 가게** 했다. **그 둘을 가르는 판정은 이미 있었고
  호출부가 0건이었다**(AA-1이 물은 그 모양이고, 그 부활이 트랙 E의 대장을 열일곱에서 열여섯으로
  줄였다). ⓓ **각주가 표를 가리킨다** — *"마우스를 올리면"* 이 사라졌다(라운드 86 리뷰 L-11이 분석
  화면의 각주에 세운 그 규율). ⓔ ⚠️ **`title` 속성은 지우지 않았다** — 이 트랙은 도달 경로를 **더한
  것이지 뺀 것이 아니다.**
- ⚠️ **서버·CSV·필터 폼·역할 게이트는 0건 변경이다.** 내려받는 CSV에는 그 식별자들이 원래 전부 실려
  있었고(그 사실은 위 기각 목록에 값으로 있다), **오늘 더한 것은 파일이 아니라 화면 위의 한 행을
  되짚는 길**이다.
- **일반형.** **화면이나 그 소스가 자기 도달 경로의 한계를 문장으로 적어 두고 있으면, 그 문장은 설명이
  아니라 결함의 자백이다** — 그리고 그 자백을 **가장 빨리 검산하는 방법**은 *"그 값을 요구하는 다른
  기능이 같은 화면에 있는가"* 를 묻는 것이다. 있으면 그 한계는 설계가 아니라 **끊긴 자리**다.
  ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소의 화면 문구·주석 중 **자기 도달 경로의 한계를
  스스로 적어 둔 것이 몇이고, 그중 그 값을 요구하는 기능이 같은 화면에 있는 것이 몇인가**(오늘 하나를
  찾았고, 그 하나는 **자백과 요구가 같은 화면 안에서 두 뼘 거리**였다).
- ⚠️ **갱신 (2026-08-31 · 라운드 88 트랙 F) — 답한 자리를 되짚는다.** 라운드 88 **AC절 머리말**이
  답했다(전수와 실측은 `docs/5차/round88-scout.md`의 **선행 확인 4**가 든다). ⚠️ **그 답은 이 질문의
  모양을 한 칸 바꿨다** — 오늘 남은 자백 하나는 *참인데 아무도 묻지 않는 것*이 아니라 **거짓이 된 뒤에도
  남아 있는 것**이었고, 그 판정은 **AC-1**이 진다. ⚠️ **판정을 여기 옮겨 적지 않는다**(O-3·X-4) —
  어느 절이 답했는지만 가리킨다.

### AB-3. **조건이 자기 손과 자기 자리를 함께 적어 두면 그것은 조건이 아니라 배정 대기 작업이다** — 참일 때 집는 것이 싸고, 오래 서 있으면 전제부터 낡는다

- **사실.** AA-R ②는 라운드 86이 *"오늘 고치지 않기로 한 것"* 으로 남긴 두 줄 중 하나였고, 그 줄은
  **두 곳에 자리를 적어 두었다** — 문서는 *"재개 조건(결정형 · **손은 저장소 안**)"* 이라고, 소스는
  화면 주석에 *"다음 라운드가 집어 들 자리로 … 값으로 적었다"* 라고. ⚠️ **조건이 자기 손과 자기
  자리를 함께 적어 둔 첫 사례다.**
- ⚠️⚠️ **오늘 전제를 다시 쟀고 참이었다.** 라운드 86이 적은 두 사실(⓵ 문장 두 줄이 0건 갈래에 묶여
  있다 · ⓶ 버튼은 그 라운드 전에도 그 자리에 있었다)이 오늘 소스에서 그대로였고, ⚠️ **함께 적혀 있던
  *"고치려면 넓은 배치 변경이다"* 만 오늘 재니 과대평가였다** — 실제로 필요한 것은 **갈래 조건
  하나**였다.
- **오늘의 값 — 조건 하나와 픽스처 다섯이다.** ⓐ 실패 두 줄이 **[목록 다시 불러오기] 버튼과 같은
  형제 갈래**로 올라갔고, 0건 갈래는 *실패가 아닐 때만* 서도록 좁혀졌다. ⓑ ⚠️ **두 문구는 바이트
  불변이다** — 라운드 86 B가 지킨 규율(*"얹되 지우지 않는다"*)이 이 변경에서도 그대로다. ⓒ ⚠️ **계약이
  자리 검사에서 실행으로 바뀌었다**: 종전 단언은 문자열이 *어느 갈래 안에 있는가*를 소스 텍스트로
  봤는데, **텍스트가 옮겨져도 초록일 수 있는 모양**이었다 — 오늘은 조건절을 **실제로 실행하는 픽스처
  다섯**이 네 창(0건 · 첫 실패 · 목록 남은 실패 · 정상)의 답을 값으로 고정한다. ⓓ **새 쿼리·새 키·
  폴러 0건**이고 건너뛰기·로컬 통과 판정은 무접촉이다.
- ⚠️ **그리고 이 판정의 나머지 절반은 *집지 않은 것들*이다.** 오늘 결정형 아홉을 전수로 세니 손이
  안에 있는 것이 **넷**이었고, 하나는 집혀 닫혔지만 셋은 집지 않았다 — **그 셋의 이유가 값이 됐다**
  (순서 · 값 0 · 어긋남 0건 · 위 표). ⚠️⚠️ **손이 안에 있다고 다 집는 것이 아니다 — 집지 않는 이유를
  값으로 적는 것이 이 분류의 나머지 절반이고, 그러지 않으면 그 셋은 다음 라운드에 *"왜 안 집었지"* 로
  다시 세어진다.**
- **일반형.** **재개 조건이 자기 손(누가 결정하는가)과 자기 자리(어디를 고치는가)를 함께 적어 두면,
  그것은 더 이상 조건이 아니라 아직 배정되지 않은 작업이다** — 그리고 **그 작업은 참일 때 집는 것이
  싸다**: 조건은 도래를 기다리는 동안 아무도 다시 읽지 않으므로 **전제부터 낡는다**(라운드 86은 전제
  둘 중 둘이 거짓이었고, 오늘은 *고치는 폭*의 추정이 과대였다 — **두 라운드 연속 전제가 낡은 자리가
  나왔다**). ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 문서의 재개 조건 중 **자기 자리를 소스에도
  적어 둔 것이 몇이고, 그중 손이 저장소 안인 것이 몇인가**(오늘 하나가 그랬고 그 하나가 그날 닫혔다 —
  **소스와 문서 두 곳에 적힌 조건은 지금까지 100% 배정 대기 작업이었다**).
- ⚠️ **갱신 (2026-08-31 · 라운드 88 트랙 F) — 답한 자리를 되짚는다.** 라운드 88 **AC절 머리말**이
  답했다(전수와 실측은 `docs/5차/round88-scout.md`의 **선행 확인 5**가 든다 — 그 100%가 오늘도
  유지됐고, 소스에 자기 자리를 적어 둔 결정형이 그날 곧바로 트랙이 됐다). ⚠️ **그리고 그 조건은 자기
  손·자기 자리에 더해 *자기 재개 시점*까지 적어 두고 있었다** — 그 관측의 판정은 **AC-3**이 진다.
  ⚠️ **판정을 여기 옮겨 적지 않는다**(O-3·X-4) — 어느 절이 답했는지만 가리킨다.

### AB-4. **대장에 이름이 있다는 사실이 "그 자리는 세어졌다"로 읽힌다** — 프롭을 건 사실은 값으로 있었고, 그 프롭이 반쪽이라는 판정은 어디에도 없었다

- **사실.** 온보딩 저장 실패 카드에는 라운드 79가 걸어 둔 낭독 프롭 **둘**이 있었고, 그 사실은 대장에
  **여섯째 항목**으로 값으로 적혀 있었으며 설명까지 *"모듈 층의 한 자리"* 라고 정확했다.
  ⚠️⚠️ **그런데 이 저장소 자신의 분류로 그 프롭 조합은 *안드로이드 한정*이고, 그 이유가 같은 파일에
  값으로 적혀 있었다** — `accessibilityLiveRegion`은 한 플랫폼의 프롭이고 `alert` 역할에는 대응
  트레이트가 없어 **크로스플랫폼 출구는 `announceForA11y` 하나**다. **그 카드에 그것이 0건이었다.**
- ⚠️⚠️ **도달 경로는 실재했고 앱의 첫 여정이었다.** ONB-002·003·004 세 화면의 저장 실패가 전부 이
  카드를 세운다 — **iOS에서 앱을 처음 여는 사람의 첫 실패가 소리 없이 서 있었다.**
- ⚠️⚠️ **그리고 아무 테스트도 빨개지지 않았다.** 낭독 출구를 세는 스윕은 둘인데 **둘 다 모집단이
  `app/**` 한 뿌리**였다 — 하나는 화면 대장을, 하나는 라우트 소스 전수를 걷는다. 온보딩 세 화면은 실패
  문구를 **컴포넌트 태그 하나**로 그리므로 스캐너가 문장을 볼 자리가 없었고, 그래서 두 스윕의 부정
  단언(*"프롭만 걸려 한 플랫폼에서만 읽히는 자리 0건"*)이 **모집단 밖에서 거짓인 채 초록**이었다.
- ⚠️ **라운드 86 A의 착시가 한 칸 옆에서 반복됐다.** 그때는 *"계약만 초록인데 아무도 부르지 않는다"*
  였고, 이번은 *"대장에 이름이 있는데 반만 부른다"* 이다 — **둘 다 다음 사람에게 *"이 자리는 이미
  세어졌다"* 로 읽힌다.** ⚠️ **대장은 *무엇이 되었는가*를 적었지 *무엇이 확인되었는가*를 적지 않았다.**
- **오늘의 값 — 한 줄과 뿌리 한 벌이다.** ⓐ 카드가 서는 순간 **화면에 이미 그려진 그 문자열**을
  읽는다(문구를 두 벌로 적지 않는다 · effect의 의존이 그 문장이라 사유가 갈린 두 번째 실패는
  조용해지지 않는다). ⓑ 낭독 스윕에 **모듈 층 뿌리**가 선다 — ⚠️ **기존 두 스윕을 고치지 않고 그
  옆에 세운다**(모집단을 옮기면 U절 이월이 붙들고 있는 값 셋이 함께 흔들린다). ⓒ **걷지 않는 뿌리와
  그 이유가 값이다**(어드민이 라운드 75에 같은 사각을 닫으며 세운 그 형식 — Y-3의 축이 오늘 한 칸
  건너갔다). ⓓ **오늘 그 뿌리의 세 자리는 전부 `announce` 출구**이고, 프롭이 **한 짝만** 걸린 자리는
  모집단 밖이라는 사실이 사각으로 적혀 있다.
- ⚠️ **프롭 둘은 걷지 않았다** — 안드로이드에서 그 둘이 하는 일은 그대로이고, 오늘 더한 것은 **없던
  플랫폼의 출구 하나**다. 그래서 이 변경의 유일한 위험은 **안드로이드에서 같은 문장이 두 번 들리는
  것**이고, 코드는 출구를 셀 뿐 겹쳐 들리는지를 알지 못해 그 판정은 접근성 표 **A-28 #101 ⓑ**가 진다.
- **일반형.** **대장에 이름이 있다는 사실은 다음 사람에게 *"그 자리는 세어졌다"* 로 읽힌다 — 대장이
  적은 것이 *무엇이 되었는가*(프롭을 걸었다)이고 *무엇이 확인되었는가*(그래서 소리가 난다)가 아닐
  때 특히 그렇다.** 그래서 대장의 항목에는 **되었다는 사실**과 **그것이 충분한가의 판정**이 함께 있어야
  하고, 판정이 없으면 그 이름은 **초록의 근거로 오독된다.** ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**:
  이 저장소의 대장 중 **항목마다 *판정*까지 함께 적은 것이 몇이고, *한 일*만 적은 것이 몇인가**(오늘
  하나에서 후자가 값을 냈고, 그 대장은 이 저장소에서 가장 정확한 대장 중 하나였다).
- ⚠️ **갱신 (2026-08-31 · 라운드 88 트랙 F) — 답한 자리를 되짚는다.** 라운드 88 **AC절 머리말**이
  답했고(전수와 실측은 `docs/5차/round88-scout.md`의 **선행 확인 6**이 든다), ⚠️⚠️ **그 답이 가리킨
  *한 일만 적는 대장* 안에 이 판정을 낳은 대장 둘이 그대로 있어서 오늘의 트랙 하나가 됐다** — 그
  처방의 판정은 **AC-4**가 진다. ⚠️ **판정을 여기 옮겨 적지 않는다**(O-3·X-4) — 어느 절이 답했는지만
  가리킨다.

### AB-5. **스윕의 사각은 정찰 자신의 스윕에도 있다** — 수를 낼 때는 그 수를 어떻게 냈는지도 함께 적는다

- **사실.** AA-5가 남긴 질문(*"K~AA절이 남긴 먼저 세어 볼 만한 것 전수 중 아직 답해지지 않은 것이
  몇인가"*)에 답하려고 그 문장을 세었는데, **한 줄 grep이 스물여덟만 셌다.** ⚠️⚠️ **그 문장이
  줄바꿈으로 갈린 자리가 여덟 있었고**(`다음 라운드가 먼저` / `세어 볼 만한 것`), 실제 수는
  **서른여섯**이었다. ⚠️⚠️ **그리고 그 여덟 안에 Z-1과 AA-2가 앉아 있었다** — 오늘의 트랙 둘이 그
  질문에서 나왔으니, 사각을 알아차리지 못했다면 **이 라운드의 목록이 달랐다.**
- ⚠️⚠️ **같은 성질이 다른 축에서 한 번 더 나왔다.** 라운드 86이 응답 필드를 이름으로 훑어 *"화면이
  쓰고 있다"* 로 분류한 `osVersion`은 **등록 경로와 타입 선언에만** 나오고 **화면은 한 번도 읽지
  않았다** — AA-4가 이름 붙인 흔한 이름의 사각이 **다른 필드에서 재발했고**, 그 자리가 오늘 트랙 D가
  된다. **AA-4의 일반형(*수는 상한이 아니라 하한이다*)이 오늘 두 번 참이었고, 한 번은 그 일반형을 쓴
  라운드의 다음 라운드가 자기 스윕에서 겪었다.**
- **오늘의 값 — 태어날 때부터 사각을 지는 대장과 스윕이다.** ⓐ 트랙 E의 대장은 **모집단 결정을 먼저
  값으로** 적고(무엇을 호출부로 볼 것인가 · 무엇을 모집단으로 볼 것인가) 사각을 **다섯** 진다:
  `export const` 축이 모집단 밖이라는 사실과 그 대부분이 계약 전용 데이터 모듈이라는 사실 · 이름
  훑기가 흔한 이름을 가르지 못한다는 사실 · `.tsx` 컴포넌트가 모집단 밖이라는 사실 · ⚠️⚠️ **그리고
  `apps/api/**`·`packages/**`의 값이 0인 것은 *측정값이 아니라 미측정*이라는 사실.** ⓑ 트랙 C의 모듈
  층 스윕도 **걷는 뿌리·걷지 않는 뿌리·사각**을 함께 진다. ⓒ **사각마다 하한이 함께 있다** — 그래야
  *"적어 둔 사각이 실은 없다"*(유령 사각)를 계약이 가른다.
- ⚠️ **이 절이 자기 사각도 적는다.** 오늘 붙인 **되짚는 줄 열여섯**은 X~AA절만 덮는다 — 그 앞
  절들(R-6~W-5)의 **열다섯**에는 이미 그 자리에 갱신 줄이 붙어 있어 제외했고, 서른여섯에서 그 둘을
  뺀 **나머지 다섯**은 오늘 따로 세지 않았다. ⚠️ **그 제외의 근거는 정찰이 한 번 훑어 본 것이지
  기계가 센 값이 아니다** — 그 자리들을 다시 세는 것은 다음 라운드의 일이고, **이 문장이 없으면
  다음 라운드는 열여섯을 전수로 읽는다.**
- **일반형.** **스윕의 사각은 남의 스윕에만 있는 것이 아니라 *지금 그 수를 내고 있는 스윕*에도 있다** —
  그래서 **수를 낼 때는 그 수를 어떻게 냈는지(모집단 · 바늘 · 놓칠 수 있는 것)를 함께 적는다.** 적지
  않으면 다음 사람은 **하한을 전수로 읽고**, 값이 있는 자리는 흔히 바로 그 사각에 있다(오늘 두 번
  그랬다). ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 문서와 이 저장소가 낸 수 가운데 **그 수를
  어떻게 냈는지가 함께 적힌 것이 몇이고, 수만 적힌 것이 몇인가**(오늘 둘에 그 절차를 붙였고, 이 절의
  판정 다섯 중 둘은 **절차를 적지 않았다면 나오지 않았다**).
- ⚠️⚠️ **갱신 (2026-08-31 · 라운드 88 트랙 F) — 답한 자리를 되짚고, 이 절이 남긴 이월도 함께 되짚는다.**
  질문에는 라운드 88 **AC절 머리말**이 답했고(전수와 실측은 `docs/5차/round88-scout.md`의 **선행 확인
  7**이 든다), ⚠️ **이 절이 자기 사각으로 적어 둔 *따로 세지 않은 다섯*은 오늘 **AC-5**가 기계로 다시
  세어 이행했다** — 그 다섯 자리(X-5 · Y-5 · Z-5 · AA-5 · AA절 머리말의 인용 한 줄)에 각각 되짚는
  줄이 섰고, 그중 하나는 *아직 답해지지 않았다*로 답해졌다. ⚠️⚠️ **그리고 이 절의 일반형이 오늘 한 번
  더 참이었다**: 이 라운드의 정찰이 낸 수 하나가 **틀렸다는 것을 그 절차가 드러냈고**(`withdrawn_at` —
  U절 머리말의 그 줄이 이 문서가 자기 수를 정정한 첫 자리다), 그 판정은 **AC-5**가 진다.
  ⚠️ **판정을 여기 옮겨 적지 않는다**(O-3·X-4) — 어느 절이 답했는지만 가리킨다.

## AC. 라운드 88에서 확정한 판정 (2026-08-31 · GAP-088 트랙 F)

라운드 87이 물은 것이 **한 층에서 닫은 규율이 옆 층에서 다시 세어지는가** 였다면, 라운드 88의 물음은
그보다 한 칸 더 조용한 자리에 있다 — **그 옆 자리를 지키고 있는 것이 무엇인가.** 세어 보니 **계약이었다.**
축은 라운드 81~87과 같이 **사용자 가치**였고(운영자 도구 · 알림 설정 · 저장소가 자기를 세는 자리), 다섯
판정 다 K~AB절과 같이 **결함 보고가 아니라 다음 결정의 입력**이며 2026-08-31 소스에서 확인됐다(라운드 88
트랙 A·B·C·D·E 머지 후). ⚠️ **이번 라운드도 핵심 루프의 렌더를 여는 트랙은 0건이고, 다섯 중 셋은 화면을
아예 열지 않는다** — 그 사실이 짝 문서의 표면 배분을 세 라운드 만에 처음으로 갈랐고, 그 이유는 §1-1
머리말이 값으로 진다.

⚠️⚠️ **이번 라운드의 가장 값진 관측: 계약은 자기 트랙의 범위를 적었을 뿐인데 다음 사람에게는 결정으로
읽힌다**(AC-1). 라운드 86 리뷰 L-11은 분석 화면의 각주를 갈래로 바꾸면서 형제 화면에 대해
*"클릭 화면의 그 줄은 이 트랙 이전부터 표와 함께 서 있던 문장이라 바이트 불변 대상이다"* 라고 적었다 —
**트랙의 범위를 지킨 옳은 문장이다.** ⚠️⚠️ **그런데 그 문장이 계약에서는 옛 문장을 `toContain`으로,
새 문장의 부재를 `not.toContain`으로 함께 무는 모양이 됐다** — 그래서 그 뒤 두 라운드 동안 클릭 화면의
각주는 *조용히 남은 것*이 아니라 **지켜졌다.** 라운드 87 AB-1이 *"옆 층은 조용하다"* 를 닫았다면 오늘은
그 한 칸 아래다: **모집단이 없는 규율은 잊히는 데서 그치지 않고, 그 사이에 반대 방향으로 굳는다.**

⚠️⚠️ **두 번째 관측: 모듈이 만들어 주는 값을 화면이 한 번도 읽지 않는 자리는 형제 화면을 나란히 놓아야
보인다**(AC-2). 오늘 그 모양이 **셋**이었고 셋 다 *만드는 쪽은 옳았다*: 추이 모듈은 두 화면 모두에게
최대치 문장을 계산해 주는데 **한 화면만 읽었고**, 표 이름은 형식을 빌려 간 화면에만 있었으며(원본 표에
`aria-label`이 0건), 기기 등록 API는 두 값을 이미 선택 항목으로 받는데 **두 등록 경로 중 하나만 보냈다.**
⚠️ **셋 다 한 화면만 보면 결함이 아니다** — 각자의 자리에서는 전부 옳은 코드였고, **형제를 나란히 놓는
순간에만 갈림이 보인다.** 라운드 87 트랙 D가 `osVersion`에서 만난 그 모양이 오늘 **두 자리 더** 있었다.

⚠️⚠️ **세 번째 관측: 조건이 자기 재개 시점까지 적어 두면 그것은 다음 라운드의 배정표다**(AC-3).
라운드 87은 Z-1의 결정형 조건을 *"어느 라운드가 세우는 날"* 에서 **"트랙 E의 호출부 대장이 한 라운드를
살아남는 날"** 로 좁혀 적었다. ⚠️ **오늘 그 문장이 그대로 참이 됐고, 참인지 재는 데 든 비용은 파일 하나가
master에 있는지 보는 것이었다.** 그리고 그 처분은 **그 대장 자신의 사각 하나를 먼저 배우게** 만들었다 —
이유 주석이 export의 이름을 부르는 순간 그 항목이 대장에서 조용히 사라지므로, 순서가 **마스킹 먼저,
주석 나중** 하나뿐이었다. ⚠️ **조건은 좁혀질수록 싸게 집힌다** — 그리고 좁힌 문장이 순서까지 지정했다.

⚠️⚠️ **네 번째 관측: 대장에 판정 칸이 없으면 그 대장을 만든 라운드의 다음 라운드가 같은 착시를 다시
만든다**(AC-4). AB-4는 *"대장에 이름이 있다는 사실이 그 자리는 세어졌다로 읽힌다"* 를 닫았는데,
⚠️⚠️ **그 판정을 낳은 대장 둘이 오늘도 *한 일*만 적고 있었다** — 프롭을 걸었다는 사실은 값으로 있고
*그래서 소리가 나는가*를 적는 칸이 없었다. **처방은 처방을 낳은 자리에 가장 늦게 온다.** ⚠️ **그리고
판정 칸을 세우자 그 자리에서 값이 하나 나왔다**: 정찰은 *"아홉이 전부 초록일 가능성이 높다"* 고 적었는데
**그 전제가 거짓이었다**(오늘도 크로스플랫폼 출구가 0건인 자리가 하나 남아 있다 — 그 사실이 이 판정으로
처음 값이 됐고, 접근성 표 **C-12**가 그 확인을 진다).

⚠️⚠️ **다섯 번째 관측: 수를 어떻게 냈는지를 적으면 그 수가 틀렸다는 것도 함께 드러난다**(AC-5).
AB-5가 *"수를 낼 때는 그 수를 어떻게 냈는지도 함께 적는다"* 를 세웠는데, 오늘 그 규율이 **자기 문서의
수 하나를 뒤집었다** — 이 라운드의 정찰이 처음 잰 `withdrawn_at`의 값이 틀렸고 **라운드 87의 값이
옳았다**(표기 방언 하나가 수를 갈랐고, 라운드 86이 값으로 적어 둔 그 방언 한 줄이 그것을 잡았다).
⚠️ **그 정정을 적은 자리가 U절 머리말이고, 이 문서가 자기 수를 스스로 정정한 첫 자리다.**

⚠️⚠️ **이월 다섯은 전부 보류 유지이고 재실측 값만 갱신했다 — 갱신 한 줄씩은 그 판정이 사는 절에 있다**
(다음 라운드가 같은 실측을 다시 돌리지 않도록 여기서는 자리만 가리킨다).

- **이 스캐너가 쿼리로 분류한 자리의 낭독** — 재실측 상태 변화 0, A-20 #85 선행 → **U절 머리말**
  (⚠️ 접점이 둘인데 둘 다 표를 움직이지 않았다 — 트랙 B가 그 여섯 화면 중 하나를, 트랙 E가 그 계약
  파일을 열었고 **표는 바이트 불변**이다 · **세 라운드 연속으로 그 파일이 열렸다**).
- **`monthly_wrapup`의 달 이동 구멍** — 게이트가 읽는 것은 여전히 대기 행의 바뀐 뒤 날짜 하나 → **U-3**
  (⚠️ **두 라운드 연속으로 `src/notifications/**`가 쓰기로 열렸는데도 접점 0건이다**).
- **S-3(어드민 `disabled`)** — 재실측 **열하나**(items 6 · links 5), 브라우저 확인 `#130` 선행 →
  **U절 머리말**(⚠️⚠️ **네 라운드 연속 접점 0건**이고 파일 접점 0건은 세 라운드 연속이다 — 라운드 87이
  세운 그 구별을 그대로 이어 센다).
- **`withdrawn_at`** — 저장소 전체 **셋 · 파일 둘**, 컬럼 신설은 여전히 별도 결정 → **U절 머리말**
  (⚠️⚠️ **그 줄에 오늘의 자기 정정이 함께 있다** — 오늘 처음 잰 **2**가 틀렸고 라운드 87의 **셋**이
  옳았다 · AC-5의 이행이다).
- **AA-R ① 연속 실패 재판정** — deps는 오늘도 `[isError]` 하나 · 자동 재시도·폴러 **0건** → **AA-R ①**
  (⚠️ 어느 트랙도 그 훅도 그 훅의 호출부 화면도 열지 않았다).

**다섯 다 2026-08-31 재실측이고 상태 변화 0이다.** ⚠️⚠️ **그리고 이번 라운드의 접점 지도는 라운드 87과
같은 방향으로 한 칸 더 갔다: `src/notifications/**`가 두 라운드 연속 *쓰기로* 열렸고, 어드민의 S-3은
그 열한 자리에 대한 접점이 네 라운드 연속 0건이다.** 두 사실 다 그 자리의 상태를 바꾸지 않는다는 것이
이 문단의 값이다 — **접점의 유무는 실측을 대신하지 않는다.**

⚠️⚠️ **AB-1~AB-5가 남긴 질문 다섯 전수와 오늘의 답이다 — 다섯 다 발동했다.**
⚠️ **수치는 여기 옮겨 적지 않고 그 수를 세는 자리를 가리킨다**(O-3·X-4의 규율 — 옮겨 적힌 수는 계약
밖의 사본이고, 아래 답의 상당수는 **계약이 아니라 정찰이 손으로 잰 수**라 더욱 그렇다).
⚠️⚠️ **그리고 답마다 *그 수를 어떻게 냈는지*가 어디에 적혀 있는지도 함께 가리킨다**(AB-5의 그 규율 —
모집단과 바늘을 적지 않은 수는 다음 라운드가 전수로 읽는다).

- **AB-1**(**닫은 규율 중 그 규율의 모집단을 값으로 가진 것**이 몇이고, 그중 모집단이 *한 자리*인 것이
  몇인가) — ⚠️ **발동했고 오늘의 트랙 셋이 그 답에서 나왔다**(A·C·E). 규율을 전수로 세어 **모집단을
  값으로 가진 것**과 **없거나 한 자리인 것**으로 갈랐고, ⚠️⚠️ **다섯 후보가 전부 뒤쪽에 있었다.**
  오늘 그중 셋에 모집단이 선다 — 두 화면을 한 질문 아래 두는 루프(A) · 앵커 규율의 신설 대장(C) ·
  대장 규율의 판정 칸(E). **수와 그 수를 낸 방법**(모집단 = *소스에 계약이 실재하는 규율* · 바늘 =
  *그 계약의 모집단이 손 배열·손 핀인가 스스로 만드는 집합인가* · `readdirSync` 트리 걷기와 단언 모양
  대조): `docs/5차/round88-scout.md`의 **선행 확인 3**.
  ⚠️ **재개 조건(사건형): 규율이 하나 더 닫히는 날** — 그날 그 규율이 모집단을 함께 세우는지가 이
  질문의 다음 답이다(오늘 셋이 그렇게 섰다).
- **AB-2**(화면 문구·주석 중 **자기 도달 경로의 한계를 스스로 적어 둔 것**이 몇이고, 그중 그 값을
  요구하는 기능이 같은 화면에 있는 것이 몇인가) — ⚠️ **발동했다 → 트랙 A.** ⚠️⚠️ **그리고 답이 이
  질문의 모양을 한 칸 바꿨다**: 사용자에게 보이는 자백으로 남은 하나는 *참인데 아무도 묻지 않는 것*이
  아니라 **거짓이 된 뒤에도 남아 있는 것**이었다(같은 카드 안에 표가 이미 서 있었다). ⚠️ **그 값을
  요구하는 *필터*는 그 화면에 없었고, 대신 그 값을 이미 주는 *표*가 있었다** — AB-2의 검산법
  (*"그 값을 요구하는 다른 기능이 같은 화면에 있는가"*)에 **한 칸이 더해진 셈이다**(요구하는 기능이
  아니라 **이미 주는 자리**가 같은 화면에 있으면 그 자백은 그날로 거짓이다). **수와 그 방법**(모집단 =
  두 앱의 비테스트 `.ts`/`.tsx` 전수 · 바늘 = 도달 경로의 한계를 말하는 표현 스물다섯 · ⚠️ **`title=`이
  React 프롭 이름과 충돌해 히트의 거의 전부가 잡음이었고 사람이 걷어 냈다**): 같은 문서의 **선행 확인 4**
  (⚠️ **낱말 바늘은 모집단을 만들지 못한다** — 그 사실이 그 자리에 값으로 적혀 있다).
  ⚠️ **재개 조건(사건형): 화면이 새 도달 경로를 얻는 날** — 그날 그 화면의 각주가 함께 갈리는지를 본다.
- **AB-3**(이 문서의 재개 조건 중 **자기 자리를 소스에도 적어 둔 것**이 몇이고, 그중 손이 저장소 안인
  것이 몇인가) — ⚠️ **발동했다 → 트랙 D.** 소스에도 자리를 적어 둔 파일을 전수로 세니 **형을 괄호로
  밝히고 손의 위치까지 적은 것은 하나**였고(라운드 87 트랙 E가 AA-3의 표기 관례를 소스로 처음 가져간
  그 파일), ⚠️⚠️ **그 하나에 사는 결정형 중 전제가 오늘 참이 된 것이 그날의 트랙이 됐다.**
  ⚠️ **AB-3의 일반형(*소스와 문서 두 곳에 적힌 조건은 지금까지 100% 배정 대기 작업이었다*)이 오늘도
  유지된다.** **수와 그 방법**(재개 조건 줄을 줄 단위로 세되 ⚠️ *"재개 조건"* 하나만 센 라운드 87의
  수와 *"재개 트리거"* 를 함께 센 오늘의 수를 **한 낱말로 적지 않는다** · 형 표기와 손 위치를 따로
  집계): 같은 문서의 **선행 확인 5**.
  ⚠️ **재개 조건(사건형): 소스에 자기 자리를 적는 조건이 하나 더 생기는 날.**
- **AB-4**(이 저장소의 **대장 중 항목마다 *판정*까지 함께 적은 것**이 몇이고, *한 일*만 적은 것이
  몇인가) — ⚠️ **발동했다 → 트랙 E.** ⚠️⚠️ **그리고 *한 일*만 적는 쪽에 이 질문을 낳은 대장 둘이
  그대로 있었다.** 오늘 그 둘에 판정 칸이 서고, 판정은 **손으로 적지 않고 모집단에서 파생**한다
  (자리마다 낭독 출구를 소스에서 분류하고, 크로스플랫폼이 아니면 그 이유가 값으로 있어야 통과한다 ·
  빈 문자열 금지 · 낡은 이유도 금지). **수와 그 방법**(모집단 = 대문자 상수로 선언된 배열·레코드 중
  항목이 둘 이상이고 이름·머리말이 대장꼴인 것 · 바늘 = 항목 본문에 `reason`·`이유`·`근거`·`판정`·
  `provenBy`·`증명` 중 하나가 있는가 · ⚠️ **바늘이 낱말이라 이유를 값으로 지고도 그 낱말을 안 쓰는
  대장을 잘못 분류한다 — 그 수는 상한이다**): 같은 문서의 **선행 확인 6**.
  ⚠️ **재개 조건(사건형): 대장이 하나 더 서는 날** — 그날 그 대장이 판정 칸을 함께 지는지가 다음 답이고,
  오늘 선 두 대장의 **래칫이 그 요구를 자동으로 물린다**(열째 항목이 붙는 날 판정도 함께 요구된다).
- **AB-5**(이 문서와 이 저장소가 낸 수 가운데 **그 수를 어떻게 냈는지가 함께 적힌 것**이 몇이고, 수만
  적힌 것이 몇인가) — ⚠️ **발동했고, 이번에도 트랙이 아니라 *오늘 낸 수마다 붙는 절차*가 그 답이다**
  (트랙 C·D·E의 사각 칸과 이 절). ⚠️⚠️ **그리고 그 절차가 오늘 두 번 값을 냈다**: 정찰의 앵커 스윕이
  낸 하한 둘이 트랙 C의 기계 스윕에서 **틀린 것으로 드러났고**(식별자·경로까지 세면 더 많고, 문장
  하나를 앵커 둘이 물어 하나가 더 있었다 — 트랙이 정직하게 정정했다), `withdrawn_at`의 첫 실측이
  **라운드 87의 값에 의해 뒤집혔다**(위 이월 목록 · AC-5). **수와 그 방법**(모집단 = `readdirSync`로
  트리를 걸어 **모집단을 스스로 만드는** 파일 전수 · ⚠️ `apps/api`와 `scripts`는 **미측정이지 0이
  아니다**): 같은 문서의 **선행 확인 7**.
  ⚠️ **재개 조건(사건형): 스윕이 하나 더 서는 날** — 그날 그 스윕이 자기 모집단·바늘·사각을 함께 적는지가
  다음 답이다(오늘 신설된 그물은 태어날 때부터 그 셋을 진다).

⚠️⚠️ **AB-5의 이월을 이행했다 — 라운드 87이 되짚는 줄을 붙이지 않고 남긴 *다섯*을 오늘 기계로 세었다.**
AB-5는 자기 사각을 이렇게 적어 두었다: *"서른여섯에서 X~AA절 열여섯과 R-6~W-5 열다섯을 뺀 나머지
다섯은 오늘 따로 세지 않았다 … 이 문장이 없으면 다음 라운드는 열여섯을 전수로 읽는다."*
⚠️ **오늘 같은 needle을 줄바꿈 허용으로 다시 돌렸다**(그 문장이 두 줄에 걸쳐 갈리는 자리가 있다는 것이
AB-5가 발견한 그 사각이다): **히트는 라운드 87과 같은 서른여섯이고, 그 히트가 사는 *자리*(절·머리말 단위)는 서른둘이다**
(한 자리가 그 문장을 두 번 이상 적는 곳이 **셋**이고 그 셋이 히트 넷을 더한다 — ⚠️ **히트와 자리를
한 낱말로 적으면 다음 라운드가 다른 수를 센다**). ⚠️ **모집단에서 뺀 것도 라운드 87과 같다**: AB절
자신의 다섯과 그 절 머리말이 그 문장을 **인용**한 하나 — ⚠️ **오늘 이 AC절이 더하는 다섯도 같은 이유로
다음 라운드의 몫이고, 그것을 여기 적어 두는 것이 다음 라운드가 서른여섯과 마흔둘을 헷갈리지 않게 하는
유일한 방법이다.** 그 서른둘은 이렇게 갈린다:
- **열여섯** — 라운드 87이 되짚는 줄을 붙인 자리(X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4).
- **열하나** — 그 앞(S절 머리말 · T절 머리말 · U-2 · U-5 · V-1 · V-4 · W-1~W-5)이고 **그 자리에 이미
  갱신 줄이 붙어 있다.** ⚠️⚠️ **라운드 87은 이것을 *열다섯*이라고 적었는데 오늘 기계로 세니 열하나다** —
  AB-5 자신이 *"그 제외의 근거는 정찰이 한 번 훑어 본 것이지 기계가 센 값이 아니다"* 라고 적어 둔 바로
  그 자리이고, **그 문장이 없었으면 오늘 이 차이는 드러나지 않았다**(AC-5의 두 번째 사례).
- **다섯** — **되짚는 줄도 갱신 줄도 없던 나머지**: **X-5 · Y-5 · Z-5 · AA-5 · AA절 머리말의 인용 한 줄.**
  ⚠️ **오늘 그 다섯 자리에 되짚는 줄이 하나씩 섰다**(판정은 옮겨 적지 않고 **어느 절이 답했는지만**
  가리킨다). ⚠️⚠️ **그리고 그 다섯 중 하나는 *아직 답해지지 않았다*로 답해졌고**(Y-5 — 문서를 읽어
  지키는 계약의 전수는 아직 세어진 적이 없다) **하나는 질문이 아니라 인용이었다**(AA절 머리말) —
  **되짚는 줄의 값은 답이 있다고 적는 데 있는 것이 아니라 없다는 것도 같은 자리에 적는 데 있다.**
⚠️ **AB-1~AB-5 자신에게도 같은 한 줄씩을 붙였다** — 다섯 다 *"라운드 88 AC절 머리말이 답했다"* 와 그
수를 낸 자리(정찰의 선행 확인 3~7)만 가리키고 판정은 옮겨 적지 않는다.

⚠️⚠️ **U-2·U-5·W-2·W-3·W-5·X-5·Y-5·Z-5의 판정은 다시 쓰지 않는다.** 라운드 84~87이 그 전수에 답했고
**오늘 상태 변화가 0**이라, 같은 답을 다시 쓰면 **그 자체가 계약 밖의 사본이 된다**(O-3).
⚠️ **AB절 본문도 다시 쓰지 않았다** — AB-1~AB-5에 오늘 선 것은 *되짚는 한 줄*뿐이고, 그 절들의 판정과
머리말의 표는 **바이트 불변**이다.

⚠️ **N-4의 두 문턱은 오늘로 11라운드 연속 미발동이고, 준비템 탭 비가상화는 이번에도 제안하지
않는다** — ⚠️ **그 두 수는 화면이 세므로 이 절도 옮겨 적지 않는다**(O-3 · 갱신 한 줄은 N-4에 있다).

⚠️⚠️ **AA-3의 이행 — 결정형 재개 조건 전수와 오늘의 처분이다. 라운드 87의 아홉이 오늘 열이 됐다.**
⚠️⚠️ **아홉 → 열은 새 부채가 아니라 *세는 자리가 늘었다*는 뜻이다**: 라운드 87이 집어 든 하나가 그날
닫혀 여덟이 됐고, 거기에 **소스에 사는 결정형 둘**이 더해졌다 — `dead-export-ledger.ts`가 AA-3의 표기
관례(*형을 괄호로 밝히고 손의 위치를 함께 적는다*)를 **소스로 처음 가져간 자리**라, 그 파일이 자기
안에 적어 둔 결정형 둘이 오늘 처음 이 표의 모집단에 들어왔다. **문서 밖에서 자란 조건이 문서의 표에
들어온 첫 라운드다.**

| # | 결정형 조건 | 사는 곳 | 손이 저장소 안에 있는가 | 오늘의 처분 |
| --- | --- | --- | --- | --- |
| 1 | **근거를 값으로 적는 관례(대장)** — *"트랙 E의 호출부 대장이 한 라운드를 살아남는 날"* | Z-1 갱신 · AB절 표 2 | ⚠️ **안에 있다** | ⚠️⚠️ **집어 들었다 → 트랙 D.** 전제가 참이었고(대장이 master에 서 있다), 처분은 **아홉의 이유를 소스로 옮기는 것**이었다 — ⚠️ **그 전에 대장이 자기 사각 하나(주석 마스킹)를 먼저 배워야 했다**(AC-3) |
| 2 | **막대를 포커스 가능하게 만들 것인가**(디자인·접근성 결정) | AA-2 | 안에 있다 | **집지 않는다 — 값이 오늘 0이다.** ⚠️ **오늘 그 0이 한 칸 더 단단해졌다**: 트랙 A 이후 **두 화면 다** 각주가 표를 가리키므로 값에 닿는 길이 텍스트로 안내된다. ⚠️ **재개 조건: 표로 닿지 못하는 값이 차트에 생기는 날** |
| 3 | **기록 탭 검색의 분류 갈래** — *"placeholder가 분류를 약속하는 날"* | Z절 | 안에 있다 | **집지 않는다 — 오늘도 약속이 참이다**(라벨이 훑는 곳을 정확히 말하고 placeholder가 그 값에서 파생한다) — **고칠 어긋남이 0건 · 세 라운드 연속 같은 답** |
| 4 | **준비템 분류 필수 입력** — *"카탈로그 정책이 서는 날"* | Z-3 | ⚠️ **밖에 있다**(카탈로그 정책 · 서버 계약) | **집지 않는다.** 변화 0 |
| 5 | **서버의 중복 대기 초대 방지** | AA-4 | ⚠️ **밖에 있다**(초대 정책) | **집지 않는다.** 변화 0 |
| 6 | **감사 뷰의 대상(targetType·targetId) 필터** | AA절 기각 | ⚠️ **밖에 있다**(서버 DTO에 그 파라미터가 0건) | **집지 않는다 — ⚠️ 어느 트랙도 `apps/api/**`를 쓰기로 열지 않았다** |
| 7 | **타일 안 배지(승인 디자인)** | AA-1 | ⚠️ **밖에 있다**(디자인 승인) | **집지 않는다.** 변화 0 |
| 8 | **C-3 잠금 오버레이 TalkBack 투과** — *"사람·기기·날짜 배정"* | 접근성 표 C-3 | ⚠️⚠️ **밖에 있다** | **트랙 F의 소유 밖이다**(오늘로 **스물두 라운드 연속 미확인**). ⚠️ **열 중 이 하나만 성질이 또 다르다 — 밖의 나머지 넷은 *다른 사람이 내릴 결정*이고, 이 줄은 *아무도 배정하지 않은 사람의 시간*이다** |
| 9 | **JSX 사용을 참조로 세는 판정** | `packages/test-utils/src/dead-export-ledger.ts`(**소스**) | 안에 있다 | **집지 않는다 — 미도래**(그 판정이 아직 서지 않았다). ⚠️ **오늘 이 표에 처음 들어온 둘 중 하나다** |
| 10 | **계약 전용 데이터 모듈을 뿌리에서 가르는 판정** | `packages/test-utils/src/dead-export-ledger.ts`(**소스**) | 안에 있다 | **집지 않는다 — 미도래.** ⚠️ **트랙 D가 오늘 그 사각 칸의 수를 재실측했지만 판정 자체는 세우지 않았다**(⚠️ **한 트랙이 그물 하나에 축 둘을 얹지 않는다**) |

⚠️ **이 표가 라운드 87의 표보다 값이 큰 이유는 셋이다.** ⓐ **수가 늘었는데 그것이 새 부채가 아니다** —
하나는 닫혔고, 더해진 둘은 **문서가 아니라 소스에 살던 조건**이 처음 세어진 것이다(그 둘은 어제도
있었고, 어제는 이 표의 모집단이 문서였을 뿐이다). ⓑ **손이 안에 있는 넷 중 하나는 집혀 그날 닫혔고
셋은 *집지 않은 이유가 값이 됐다*** — 값 0(2) · 어긋남 0건(3) · 미도래 둘(9·10). ⓒ ⚠️⚠️ **그리고
이번에는 *집지 않는 이유*에 새 종류가 하나 붙었다: 그물 배정**(10 — 그 판정을 세우려면 오늘 트랙 D가
연 그 파일에 축을 하나 더 얹어야 했고, **한 트랙이 한 그물에 축 둘을 얹지 않는 것**이 라운드 85~87이
같은 자리에서 받은 경고다). **집지 않는 이유가 값이 되려면 그 이유가 *조건의 성질*만이 아니라 *그
라운드의 구조*도 말해야 한다.**
⚠️ **그리고 오늘 이 문서의 기각 목록이 결정형 조건 **둘**을 새로 적었다**(AA-3의 표기 관례 기계 ·
조회 실패 창의 모집단 — 둘 다 손이 저장소 안이다). **그 둘은 이 표에 아직 세우지 않는다** — 이 표의
모집단은 *판정 절에 사는 조건*이고, 오늘 처음 적힌 조건은 다음 라운드가 전수로 셀 때 들어온다.
⚠️ **그 사실을 적어 두는 것이 이 표의 다음 수가 열보다 클 수 있다는 예고이고, *늘어난 수가 늘어난
부채가 아니라는 것*을 두 라운드 연속 적는 이유다.**

⚠️⚠️ **이번 라운드가 실측하고 기각한 열넷을 값으로 남긴다 — 전부 재개 조건과 함께**(V-2가 세운 규율:
조건 없는 보류는 이유가 적혀 있다는 이유로 재론되지 않는다). ⚠️ **그중 넷은 재개 조건이 *결정형*
이라는 사실과 그 결정의 손이 어디에 있는지를 함께 적는다**(Z-4·AA-3·AB-3의 이행).

- **응답 필드 축(모바일) — 스윕을 다시 돌렸고 값은 오늘도 0이다.** 라운드 87의 재개 조건(*"그 스윕을
  다시 돌리는 날"*)을 이행해 타입 선언 전수를 다시 걸었고, **화면이 한 번도 읽지 않는 필드 열다섯**을
  손으로 판정하니 오늘 값이 있는 것은 **0건**이었다(이유가 소스에 있는 것 · 계약이 *그리지 않는다*를
  이미 못 박은 것 · 표시 대상이 아닌 것). ⚠️⚠️ **다만 그 열다섯 중 넷은 필드의 결함이 아니라 스윕의
  사각이었다** — `.field` 속성 접근만 세는 바늘이 **구조 분해를 놓쳤다**(AA-4가 이름 붙인 사각의 세
  번째 재발이고, **이번에는 그것을 알고도 다른 모양으로 밟았다**). ⚠️ **재개 조건(사건형): 응답에 새
  필드가 실리는 날, 또는 그 스윕을 다시 돌리는 날** — ⚠️ **다시 돌릴 때는 구조 분해를 세는 바늘을
  함께 지고 돌려야 한다.**
- **조회 실패 창의 모집단 — 처음으로 재었고 0건이다. 그리고 그 0의 이유가 반대다.** 라운드 87 트랙 B가
  닫은 규율(*"목록이 남은 채 실패한 창에서도 화면이 실패를 말한다"*)의 모집단을 배선 대장 전수로
  돌리니 **같은 결함은 0건**이었는데, 이유는 모바일 화면들이 실패를 감추기 때문이 아니라 **화면을 통째로
  실패 카드로 대체하기 때문**이다(`resolveScreenPhase` · MOB-130). **실패는 언제나 말해지고, 대신 옛
  데이터가 사라진다.** ⚠️ **바꾸려면 화면 구조 결정이라 후보로 올리지 않는다.**
  ⚠️ **재개 조건(결정형 · 손은 저장소 안): 재조회 실패 창에서 옛 목록을 남길지 정하는 날** — 그날 그
  여섯 화면이 한 트랙의 모집단이 된다. **0건도 재어 본 값이다.**
- **`HouseholdMember.joinedAt` — 재었고 값이 0이다.** 가족 화면의 대기 초대 행은 라운드 86 C가 행마다
  갈리게 만들었는데 구성원 행에는 이 필드가 실려 오고도 서지 않는다 — ⚠️ **그러나 구성원 행은
  이름으로 이미 갈린다.** **가를 필요가 없는 자리에 값을 더하는 것은 값이 아니다.**
  ⚠️ **재개 조건(사건형): 이름 없는 구성원 행이 생기는 날**(그날 이 필드가 처음 값이 된다).
- **이월 다섯 — 전부 재실측했고 상태 변화 0**(위 목록 · 갱신 줄은 각 판정이 사는 절에 있다).
  ⚠️ **재개 조건은 다섯 다 종전 그대로다.**
- **성능 넷 — 재실측했고 넷 다 미도래다.** ⓐ **첫 페인트**(⚠️ 어느 트랙도 `useQuery` 선언을 늘리지
  않았다) · ⓑ **렌더 비용**(활성 카탈로그는 N-4 문턱 아래이고 ⚠️ **어느 트랙도 준비템 탭을 열지
  않았다**) · ⓒ **번들**(⚠️ **새 런타임 의존성 0건 — 다섯 트랙 다 기존 import만 쓴다**) · ⓓ **api의
  루프**(⚠️ **`apps/api/**` 쓰기 0건**). ⚠️ **수는 여기 옮겨 적지 않는다** — ⓑ의 문턱은 라운드 83 C의
  어드민 카드가, ⓒ는 의존성 목록 자신이 센다. ⚠️ **재개 조건은 넷 다 종전 그대로다**(Z-5의 그 문장 ·
  **세 라운드 연속 넷 다 미도래**).
- **기록 탭 검색이 분류 이름을 보지 않는 것 — 재었고 이번에도 제안하지 않는다.** 재실측에서도 약속이
  참이다(라벨이 훑는 곳을 정확히 말하고 분류 칩 줄이 검색칸 아래에 선다). ⚠️⚠️ **재개 조건이 결정형이고
  손은 저장소 안이다**(위 표의 3) — 그런데 **고칠 어긋남이 0건이라 집어 드는 것이 *판정을 맞추는 일*이
  아니라 *문구를 바꾸는 일*이 된다.** **세 라운드 연속 같은 답이다.**
- **막대 포커스 가능화 — 재었고 값이 0이다.** ⚠️ **오늘 그 0이 한 칸 더 단단해졌다** — 트랙 A 이후
  **두 화면 다** 각주가 표를 가리키므로, 새 상호작용 표면 없이도 값에 닿는 길이 안내된다.
  ⚠️ **재개 조건(결정형 · 손은 저장소 안): 표로 닿지 못하는 값이 차트에 생기는 날.**
- **행마다 갈리는 낭독 라벨의 모집단 — 재었고 오늘 세우지 않는다.** AB-1의 답에서 그 규율이 여전히
  **손 핀뿐**이라는 것이 확인됐고 전제도 참이다. ⚠️ **집지 않는 이유는 그물 배정이다** — 그 스윕은
  `a11y-contract.test.ts`에 서야 하는데 그 파일은 이번 라운드에 **트랙 E 하나**가 열고, E가 지는 것은
  AB-4의 답이라 **한 트랙이 그물 하나에 축 둘을 얹지 않는다.**
  ⚠️ **재개 조건(사건형): a11y 그물을 여는 다음 트랙이 서는 날.**
- **AA-3의 "형을 괄호로 밝히는 관례" 기계 — 전제는 참인데 오늘 집지 않는다.** 관례는 한 라운드를
  살아남았다. ⚠️ **집지 않는 이유는 순서와 결합이다**: 그 기계는 `known-limitations.md`를 파싱해야 하고
  그 문서는 **트랙 F의 소유**라, 같은 라운드에 세우면 **계약이 문서를 지키는 것이 아니라 문서가 계약을
  맞추게 된다**(F가 이 절을 쓰면서 그 계약을 만족시켜야 한다). ⚠️ **재개 조건(결정형 · 손은 저장소 안):
  문서 축을 무는 스윕을 F 밖의 트랙이 소유할 수 있게 되는 날** — 예컨대 F가 절을 먼저 쓰고 **다음
  라운드**가 그 계약을 세우는 순서다. ⚠️ **그 조건은 라운드 88 정찰이 처음 적었고, 이 줄이 그것을
  판정 문서로 옮긴다.**
- **손이 밖인 다섯 — 넷은 다른 사람이 내릴 결정이고 하나는 배정이다**(위 표의 4~8). 준비템 분류 필수
  입력 · 서버의 중복 대기 초대 방지 · 감사 뷰의 대상 축 필터 · 타일 안 배지는 **카탈로그 정책 · 초대
  정책 · 서버 계약 · 디자인 승인**이 각각 선행이고, C-3은 **사람·기기·날짜 배정**이다.
  ⚠️ **재개 조건(전부 결정형 · 손은 저장소 밖): 그 결정이 서는 날** — ⚠️ **넷과 하나를 한 줄에 적지
  않는 이유가 그 칸이다.**
- **`${seller}에서 구매하기` 둘 — 제외 확인이지 제안이 아니다.** 준비템 판매처 1:1과 구매 확인 판매처
  라벨은 **영구 기각** 축이다(라운드 62~87이 남긴 그대로). ⚠️ **재개 조건: 없다 — 이 줄은 재론 대상이
  아니라 스윕이 그 둘을 다시 줍지 않게 하는 표식이다.**
- **감사 뷰 CSV — 재었고 제안하지 않는다.** 내려받는 CSV의 열에는 식별자가 전부 실려 있고, 화면 위에서
  한 행을 되짚는 길은 라운드 87 A가 이미 열었다. ⚠️ **재개 조건(사건형): CSV의 열이 화면의 열과
  갈리는 날.**
- **콘텐츠 리비전 편집 표면 — 재었고 제안하지 않는다.** 호출부가 0건인 것은 초안을 고치는 화면이 없기
  때문이고 흐름이 닫혀 있다. ⚠️ **오늘 그 자리에 값이 하나 붙었다** — 트랙 D가 **그 이유를 소스 주석으로
  옮겨** 대장이 아니라 파일이 그 사실을 지게 했다(*"표면이 있다"* 가 *"닿는다"* 로 오해되지 않도록).
  ⚠️ **재개 조건(사건형): 검수 화면에서 초안 본문을 고치는 요구가 실제로 서는 날.**
- **어드민 손 미러 — 재었고 갈린 것 0건.** 정본을 소스로 읽어 대조하는 계약이 이미 있고 면제 둘에는
  이유가 값으로 있다. ⚠️ **이번 라운드에도 트랙 A의 금지 조항이 *새 export를 더하지 않는다*였다**
  (더했다면 미러 스윕이 먼저 빨개진다). ⚠️ **재개 조건(사건형): 새 손 미러가 서는 날.**

**이 라운드가 짝 문서에 남긴 것.** 확인의 표에 **#160~#161 둘**이 서고 §0의 여섯 숫자가 파싱으로 다시
세어졌으며, 접근성 표에는 **A-29 #104 하나**와 **C-12 한 줄**이 섰다.
⚠️⚠️ **표면 배분이 라운드 85·86·87의 *실기기 셋 · 브라우저 하나*와 처음으로 갈렸다 — 오늘은 실기기
하나 · 브라우저 하나다. 그리고 그 이유가 §0의 수보다 값이 크다**: 줄어든 것은 **확인을 미뤄서가 아니라
다섯 트랙 중 셋이 화면을 한 곳도 열지 않았기 때문**이다(신설 앵커 대장 · 사문 대장의 주석 마스킹 ·
프롭 대장 둘의 판정 칸 — 셋 다 **화면 0건 · 문구 0건 · 렌더 0건**이라 사람이 밟을 자리를 만들지
않는다). ⚠️ **라운드 84가 `실기기` 0건에 대해 세운 그 구분(*"확인할 것이 없다"* 가 아니라 *"폰에 보이는
동작을 한 곳도 바꾸지 않았다"*)의 셋째 판이고, 이번에는 그 값이 0이 아니라 하나다.** ⚠️⚠️ **그래서 이
라운드는 표가 세는 것이 무엇인지를 한 번 더 보여 준다: 오늘 더해진 계약은 이 표의 어느 행보다 많지만,
이 표가 세는 것은 계약의 수가 아니라 사람이 폰이나 브라우저를 잡아야 하는 자리의 수다.**
⚠️⚠️ **A-29가 A-28과 다른 점 하나는 그 절의 머리말이 진다: 라운드 87의 셋은 *이미 서 있던 자리가 실제로
도달하는가*를 물었고, 이번 하나는 *그 자리에 값이 실제로 들어오는가*를 묻는다**(라운드 87 D가 세운 구별
조각은 옳았고, 그 값을 올리는 경로가 둘 중 하나뿐이었다). ⚠️ **그 하나는 기기 조건이 A-28 #103과 같은
두 대이고, 오늘 조건이 하나 더 붙었다 — 그 계정이 알림 권한을 한 번도 준 적이 없어야 한다.**
⚠️ **트랙 A의 어드민 항목은 종전 판정대로 행이 아니라 문단으로 적었다**(브라우저 화면은 그 표의 조건
밖이다) — ⚠️ **다만 그 트랙이 고친 것이 정확히 접근성 축이라는 사실은 문단이 진다**: 표가 선 뒤에도
각주가 마우스만 말하면 그 카드는 키보드·스크린리더 운영자에게 여전히 마우스 전용이고, **그 화면의 추이
표에는 이름조차 없었다.** ⚠️ **트랙 C·D·E는 소스 계약이라 두 표 어디에도 행이 서지 않는다.**
⚠️⚠️ **다만 트랙 E가 판정으로 처음 값이 되게 한 사실 하나는 접근성 표의 일이 됐다 — 그리고 그것은
*신설 UI*가 아니라 *미확인 축*이라 A절이 아니라 C절에 앉는다**(`C-12` — 끝난 초대 카드가 오늘도
크로스플랫폼 출구 0건이다). **판정과 수리를 한 라운드에 섞지 않는 것이 이 저장소의 관례이고, 그래서
오늘 그 자리에 남는 것은 고침이 아니라 사람의 확인이다.** ⚠️⚠️ **C-3(잠금 오버레이 TalkBack 투과)은
오늘로 스물두 라운드 연속 미확인**이고, ⚠️ **이번 라운드가 그 줄에 더하는 값은 경과 수가 아니라
*새 실기기 행이 셋에서 하나로 줄었는데도 같은 칸이 비어 있다*는 대비다** — 라운드 84의 0건, 85·86·87의
셋씩, 오늘의 하나가 **다섯 라운드에 걸쳐 같은 답을 냈다: 이 줄이 기다리는 것은 새 행의 수가 아니라
배정이다.**

### AC-1. **계약은 자기 트랙의 범위를 적었을 뿐인데 다음 사람에게는 결정으로 읽힌다** — 그리고 그 계약이 형제 화면의 옛 문장을 바이트로 지키고 있었다

- **사실.** 라운드 86 리뷰 L-11은 어드민 분석 화면의 각주를 갈래로 바꿨다 — 표가 서면 *"날짜별 이벤트
  수는 위 표에서 볼 수 있어요…"*, 표가 못 선 응답에서만 옛 문장이 남는다. ⚠️ **그 라운드는 형제 화면
  (클릭 통계)을 범위 밖으로 두면서 그 사실을 계약에 적었다**: *"분석 화면만 고친다 — 클릭 화면의 그
  줄은 이 트랙 이전부터 표와 함께 서 있던 문장이라 바이트 불변 대상이다."*
- ⚠️⚠️ **그 문장은 옳았고, 그 문장이 만든 단언 둘이 옆 화면의 결함을 못 박았다.** 계약은 클릭 화면의
  옛 각주를 `toContain`으로 **있어야 한다**고 물고, 새 문장을 `not.toContain`으로 **없어야 한다**고
  물었다. ⚠️ **그래서 그 뒤 두 라운드 동안 클릭 화면의 각주는 조용히 남은 것이 아니라 지켜졌다** —
  누가 그 화면을 고치려 했다면 **그 트랙이 아니라 계약이 먼저 빨개졌을 것**이다.
- ⚠️⚠️ **그리고 그 각주는 오늘 이미 거짓이었다.** 같은 카드 안에서 바로 위가 `trend.showTable` 갈래로
  **날짜·클릭 수 표를 세운다** — 즉 *"막대에 마우스를 올리면"* 이라는 유일 경로 서술이 **유일 경로가
  아니게 된 지 오래**였다. AB-2가 *"자백이 참인데 아무도 묻지 않는다"* 였다면 이것은 그 한 칸 옆이다:
  **자백이 거짓이 된 뒤에도 남아 있었고, 계약이 그것을 지키고 있었다.**
- **오늘의 값 — 화면 세 줄과 계약의 모집단 하나다.** ⓐ 각주가 **분석 화면과 같은 값(`trend.showTable`)**
  에서 같은 판정을 받는다(표가 선 응답에서는 표를 가리키고, 못 선 응답에서만 종전 문장이 남는다).
  ⓑ 같은 모듈이 이미 계산해 주던 **최대치 한 줄**이 그 위에 선다(⚠️ **문구는 모듈이 짓는다 — 화면에
  새 한국어 문장 0건**). ⓒ 추이 표가 **자기 이름**을 얻고, 막대 그림의 이름과 **끝말로 갈려** 겹쳐
  읽히지 않는다. ⓓ ⚠️⚠️ **계약의 세 자리가 *한 화면을 무는 단언*에서 *두 화면을 함께 도는 루프*로
  바뀌었다** — 이제 두 화면이 **같은 질문을 받는다**(⚠️ 그것이 이 트랙의 축이다: 고친 것은 한 화면이고
  **모집단이 둘이 됐다**). ⓔ DNC-009 고지 · 막대 식과 호버 `title` · 표 머리 · 오류 문구는 **바이트
  불변**이고 **새 상호작용 표면 0건**이다.
- ⚠️ **그리고 이 판정은 라운드 86을 나무라지 않는다.** 트랙이 자기 범위를 적는 것은 규율이고, 그 문장이
  없었다면 그 라운드는 자기가 열지 않은 화면을 함께 고쳤을 것이다. ⚠️ **문제는 범위를 적은 문장이
  *계약의 단언*이 될 때 생긴다** — 산문으로 적힌 범위는 다음 라운드가 다시 읽지만, **단언으로 적힌
  범위는 다음 라운드를 막는다.**
- **일반형.** **트랙의 범위를 적은 문장은 다음 사람에게 *결정*으로 읽히고, 그 문장이 계약의 단언이 되면
  그 결정은 기계가 집행한다.** 그래서 범위를 계약에 적을 때는 **범위인지 판정인지**를 함께 적어야 하고,
  가장 싼 방법은 **모집단을 둘로 만들어 같은 질문을 함께 돌리는 것**이다(오늘 셋 자리가 그렇게 바뀌었다).
  ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소의 계약 중 **한 화면·한 파일만 무는 단언이
  몇이고, 그중 형제가 실재하는 것이 몇인가**(오늘 셋을 루프로 바꿨고, 그 셋은 전부 어제까지 한 자리였다).
- ⚠️ **갱신 (2026-08-31 · 라운드 89 트랙 F) — 답한 자리를 되짚는다.** 라운드 89 **AD절 머리말**이
  전수로 답했다(수와 그 수를 낸 방법은 `docs/5차/round89-scout.md`의 **선행 확인 4**가 든다).
  ⚠️ **판정을 여기 옮겨 적지 않는다**(O-3·X-4) — 어느 절이 답했는지만 가리킨다.

### AC-2. **모듈이 만들어 주는 값을 화면이 한 번도 읽지 않는 자리는 형제 화면을 나란히 놓아야 보인다** — 오늘 그 모양이 셋이었고 셋 다 만드는 쪽은 옳았다

- **사실.** 오늘 닫힌 자리 셋은 서로 다른 앱·다른 층인데 **같은 모양**이었다. ⓐ 추이 모듈은 두 화면
  모두에게 최대치 문장을 계산해 주는데 **한 화면만 읽었다.** ⓑ 표 이름은 **형식을 빌려 간 화면에만**
  있었고 원본 표에는 0건이었다. ⓒ 기기 등록 API는 앱 버전·OS 버전을 **이미 선택 항목으로 받는데**
  등록 경로 둘 중 **하나만 보냈다.**
- ⚠️⚠️ **셋 다 한 화면만 보면 결함이 아니다.** 각 자리에서 코드는 옳았다 — 모듈은 값을 만들었고, 화면은
  자기가 그리기로 한 것만 그렸으며, 두 등록 호출은 각자 필요한 필드를 보냈다. **갈림은 형제를 나란히
  놓는 순간에만 보인다.**
- ⚠️⚠️ **그리고 ⓒ에서는 그 갈림이 사용자의 첫 순간에 정확히 걸렸다.** 부팅 등록은 권한을 묻지 않으므로
  **권한을 준 적 없는 사용자에게는 언제나 빈손으로 돌아오고**, 권한을 묻는 유일한 자리가 마스터
  토글이다 — 즉 **첫 기기 행은 언제나 토글이 만들고, 그 경로가 두 값을 보내지 않았다.** 라운드 87 D가
  세운 구별 조각은 옳았는데 **그 조각이 서야 할 첫 순간에 값이 없었다**(⚠️ 되돌아오는 길은 다음 앱
  시작이고, 재시도가 세션당 한 번으로 막혀 **같은 세션에는 오지 않는다**).
- **오늘의 값 — 한 벌 하나와 한 줄 셋이다.** ⓐ 등록 본문을 짓는 자리가 **하나**가 되고 두 호출이 그것을
  부른다(⚠️ **두 곳에 손으로 적은 필드 목록을 두지 않는다** — 라운드 51 P2-3이 세운 그 규율). ⓑ 화면이
  바꾼 것은 **등록 인자 한 줄과 import 한 줄**이고 **한국어는 0글자**다. ⓒ 계약이 *두 경로가 같은 키
  집합을 보낸다*를 **양방향 차집합으로** 문다(한쪽에만 있는 키가 0건이라는 뜻이고, 새 필드가 한쪽에만
  붙으면 그날 빨개진다). ⓓ **값이 없거나 버전 모양이 아니면 조각은 서지 않고 제목·낭독이 종전 문자열과
  바이트가 같다**(지어내지 않는다 — 라운드 87 D의 그 규율 그대로). ⓔ **권한을 묻는 자리는 늘지 않았다.**
- ⚠️ **셋 중 둘은 *읽지 않는 것*이었고 하나는 *보내지 않는 것*이었다** — 그래서 고침의 모양도 갈렸다
  (앞의 둘은 화면이 한 줄을 읽으면 되고, 뒤의 하나는 **호출부 둘이 한 벌을 공유**해야 했다).
  ⚠️ **공통점은 고칠 코드가 아니라 *보는 방법*이었다: 형제를 나란히 놓기 전에는 셋 다 보이지 않았다.**
- **일반형.** **모듈·API가 만들어 주는 값을 화면이 한 번도 읽지 않는 자리는 그 화면 안에서는 결함으로
  보이지 않는다 — 형제(같은 모듈을 쓰는 다른 화면 · 같은 API를 부르는 다른 경로)를 나란히 놓아야
  보인다.** 그래서 값을 만드는 쪽을 고친 라운드의 다음 질문은 *"그 값을 쓰는 자리가 전부인가"* 이고,
  ⚠️ **그 질문은 대개 *만든 라운드*가 아니라 *그 다음 라운드*의 몫이다**(라운드 87 D의 이월이 오늘
  트랙 B가 된 것처럼). ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 같은 API를 부르는 **호출부가 둘 이상인
  자리**가 몇이고, 그중 **보내는 필드 집합이 갈리는 것**이 몇인가(오늘 하나를 닫았고, 그 하나는
  사용자의 첫 순간에 걸려 있었다).
- ⚠️ **갱신 (2026-08-31 · 라운드 89 트랙 F) — 답한 자리를 되짚는다.** 라운드 89 **AD절 머리말**이
  전수로 답했다(수와 그 방법은 같은 문서의 **선행 확인 5**가 든다). ⚠️ **판정을 여기 옮겨 적지
  않는다**(O-3·X-4) — 어느 절이 답했는지만 가리킨다.

### AC-3. **조건이 자기 재개 시점까지 적어 두면 그것은 다음 라운드의 배정표다** — 그리고 좁힌 문장은 순서까지 지정했다

- **사실.** 라운드 87은 Z-1의 결정형 조건을 집지 않기로 하면서 그 이유(**순서** — 오늘의 실측이 전부
  소스 구조에서 나왔고 주석 축은 그 뒤다)와 함께 재개 조건을 **좁혀** 적었다: *"트랙 E의 호출부 대장이
  한 라운드를 살아남는 날."* 라운드 86이 적었던 *"어느 라운드가 세우는 날"* 에서 한 칸 좁힌 문장이다.
- ⚠️⚠️ **오늘 그 전제를 재는 데 든 비용은 파일 하나가 master에 있는지 보는 것이었다.** 조건이 *사건*으로
  적혀 있으면 재는 비용이 낮고, **낮으면 실제로 재어진다** — AA-3이 *"조건은 도래를 기다리는 동안 아무도
  다시 읽지 않아 전제부터 낡는다"* 고 적은 그 병의 반대 사례다.
- ⚠️⚠️ **그리고 집어 들자 그 처분이 대장 자신의 사각 하나를 먼저 요구했다.** 대장은 *이유가 대장에만
  있는 것*을 아홉으로 세고 있었는데, 그 이유를 **소스 주석으로 옮기는 순간** 참조를 세는 함수가 주석
  안의 이름을 참조로 읽어 **그 항목이 대장에서 조용히 사라진다.** 그 사실은 대장 자신의 사각 칸에
  *"재개 조건(사건형): 이 재측정이 0을 넘는 날 — 그날 이 그물은 마스킹을 배워야 한다"* 로 적혀 있었다.
  ⚠️ **그래서 이 트랙의 순서는 하나뿐이었다: 먼저 마스킹, 그다음 주석.** 거꾸로 했다면 아홉이 래칫
  아래로 사라지고 **계약이 아무것도 지키지 못한 채 초록이 됐을 것이다.**
- **오늘의 값 — 마스킹 하나와 이유 아홉이다.** ⓐ 참조를 세는 스윕이 **주석을 마스킹**하도록 배웠고
  (길이·줄을 보존해 자리 계산이 어긋나지 않는다), ⚠️ **그 마스킹을 TS 파서와 저장소 전수로 대조해
  *과잉 0자 · 누락 0자*를 증명했다**(대조가 실제 결함 하나를 잡았다 — JSX 텍스트 안의 `http://`가
  주석으로 읽히던 자리). ⓑ 아홉의 *왜 화면이 부르지 않는가*가 **소스 주석으로** 옮겨졌고, 계약이 그
  이유를 **소스에서 실제로 찾는다**(표식만 복사하는 것은 막힌다). ⓒ **항목은 하나도 지우지 않았고
  래칫도 그대로다** — 이 라운드가 한 일은 *지우는 판단*이 아니라 **이유가 사는 층을 옮기는 것**이다.
  ⓓ **사각도 함께 재측정됐다**(주석이 살려 주던 상수들이 드러나 `export const` 축의 수가 늘었고, 문자열
  리터럴 축은 **재는 자로만** 신설돼 마스킹하지 않는다는 사실이 값으로 적혔다).
- ⚠️ **이 판정의 나머지 절반도 순서에 있다.** 오늘 결정형 열 중 손이 안인 다섯 가운데 하나는 집혔고
  넷은 집지 않았는데, **집지 않은 이유 중 하나가 이번에 처음으로 *그물 배정*이었다**(같은 파일에 축을
  둘 얹지 않는다 — 위 표의 10). ⚠️ **조건의 성질이 같아도 그 라운드의 구조가 다르면 처분이 갈린다.**
- **일반형.** **재개 조건이 자기 손·자기 자리에 더해 *자기 재개 시점*까지 적어 두면, 그것은 조건이
  아니라 다음 라운드의 배정표다** — 그리고 **좁게 적힌 조건일수록 싸게 집힌다**(재는 비용이 파일 하나를
  보는 일이면 실제로 재어진다). ⚠️ **다만 집는 순간 그 조건이 사는 그물의 사각이 함께 깨어나므로,
  좁힌 문장은 *언제*뿐 아니라 *무엇을 먼저*까지 적어 두는 편이 낫다**(오늘 그 순서를 그 파일 자신이
  적어 두었다). ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소의 재개 조건 중 **집을 때의 순서를
  함께 적어 둔 것이 몇인가**(오늘 하나가 그랬고, 그 하나가 없었다면 그날 계약이 조용히 비었을 것이다).
- ⚠️ **갱신 (2026-08-31 · 라운드 89 트랙 F) — 답한 자리를 되짚는다.** 라운드 89 **AD절 머리말**과
  **AD-3**이 답했다(수와 그 방법은 같은 문서의 **선행 확인 6**이 든다). ⚠️ **판정을 여기 옮겨 적지
  않는다**(O-3·X-4) — 어느 절이 답했는지만 가리킨다.

### AC-4. **대장에 판정 칸이 없으면 그 대장을 만든 라운드의 다음 라운드가 같은 착시를 다시 만든다** — 처방은 처방을 낳은 자리에 가장 늦게 온다

- **사실.** 라운드 87 AB-4는 *"대장에 이름이 있다는 사실이 그 자리는 세어졌다로 읽힌다"* 를 판정으로
  세우고 그 한 자리를 닫았다. ⚠️⚠️ **그런데 그 판정을 낳은 대장 둘은 오늘도 `{ file, before, after,
  added, places, what }` 이고 `what`은 *무엇을 했는가*만 적는다** — *그래서 두 플랫폼에서 소리가
  나는가*를 적는 칸이 없다. 계약이 무는 것도 *"프롭이 그 자리에 그 수만큼 있고, 빼면 종전 바이트다"*
  뿐이었다.
- ⚠️ **판정을 지을 재료는 같은 파일에 이미 다 있었다** — 출구를 세 칸으로 매기는 판정과, *"한쪽은
  플랫폼 프롭이고 다른 쪽에는 대응 트레이트가 없어 크로스플랫폼 출구는 낭독 호출 하나"* 라는 근거가
  값으로 적혀 있었다. **대장이 그 판정을 부르지 않을 뿐이었다.**
- **오늘의 값 — 파생된 판정 칸 하나다.** ⓐ 항목마다 그 자리의 낭독 출구를 **소스에서 분류**하고
  (JSX 갈래와 effect 배선 조건을 대조한다), ⓑ 크로스플랫폼 출구가 없는 자리가 있으면 **그 이유가 값으로
  있어야** 통과한다(빈 문자열 금지 · **조용한 자리의 조건 이름이 이유에 들어 있어야 한다** — 낡은 이유가
  남지 못한다), ⓒ 반대로 그런 자리가 없으면 그 칸은 **반드시 비어 있어야** 한다(유령 판정 금지),
  ⓓ **유령 방지**로 자리 수·파생 수·마스킹 전후·중복이 함께 대조되고, ⓔ **래칫이 타입과 값 양쪽에
  걸려** 열째 항목이 붙는 날 판정 칸이 **자동으로** 요구된다. ⚠️ **손으로 적은 판정은 못 박지 않았다 —
  판정은 모집단에서 파생한다.**
- ⚠️⚠️ **그리고 판정 칸을 세우자 정찰의 전제 하나가 거짓으로 드러났다.** 정찰은 *"오늘 그 판정을 돌리면
  아홉이 전부 초록일 가능성이 높다"* 고 적었는데, 돌려 보니 **오늘도 크로스플랫폼 출구가 0건인 자리가
  하나 남아 있었다**(끝난 초대 카드 — 그 카드의 문장이 *저장 실패 문구*가 아니라 **초대 상태 안내
  상수**라 라운드 79의 저장 실패 스윕 모집단에도 서지 않았다). ⚠️ **그 사실은 어제까지 아무 데도 적혀
  있지 않았고, 오늘 판정으로 처음 값이 됐다** — 확인은 접근성 표 **C-12**가 진다. ⚠️ **이 트랙은 화면을
  한 바이트도 열지 않았으므로 프롭을 빼거나 더하는 제안은 하지 않는다**(판정과 수리를 한 라운드에
  섞지 않는다).
- ⚠️ **사각도 함께 값으로 섰다** — 그중 하나는 **effect 밖 핸들러가 부르는 낭독은 이 그물이 세지 않는다**
  는 사실이고, ⚠️ **그것이 실재하는 자리가 오늘 하나 있어 그 항목의 이유 칸이 그 사실을 함께 진다**
  (**적어 둔 사각이 실은 없는 것**, 즉 유령 사각을 가르는 방법이 그것이다 — AB-5가 세운 그 규율).
- **일반형.** **대장에 판정 칸이 없으면 그 대장은 *무엇이 되었는가*만 적고, 그 이름은 다음 사람에게
  *그래서 충분하다*로 읽힌다** — 그리고 **그 착시는 그 대장을 만든 라운드의 다음 라운드가 다시 만든다.**
  ⚠️ **처방이 가장 늦게 도착하는 자리는 그 처방을 낳은 자리다**(AB-4를 쓴 라운드도 자기 대장에는 칸을
  세우지 않았다). ⚠️ **판정을 세울 때 손으로 적으면 그것은 또 하나의 *한 일*이 되므로, 판정은 반드시
  모집단에서 파생하고 래칫이 그 파생을 강제해야 한다.** ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**:
  이 저장소의 대장 중 **판정 칸이 있고 그 판정이 모집단에서 파생하는 것이 몇이고, 손으로 적힌 것이
  몇인가**(오늘 둘에 파생 판정이 섰고, 그 파생이 곧바로 사실 하나를 뒤집었다).
- ⚠️ **갱신 (2026-08-31 · 라운드 89 트랙 F) — 답한 자리를 되짚는다.** 라운드 89 **AD절 머리말**과
  **AD-1**이 답했다(수와 그 방법은 같은 문서의 **선행 확인 7**이 든다). ⚠️ **판정을 여기 옮겨 적지
  않는다**(O-3·X-4) — 어느 절이 답했는지만 가리킨다.

### AC-5. **수를 어떻게 냈는지를 적으면 그 수가 틀렸다는 것도 함께 드러난다** — 오늘 이 문서가 자기 수를 처음으로 정정했다

- **사실.** AB-5는 *"수를 낼 때는 그 수를 어떻게 냈는지(모집단·바늘·놓칠 수 있는 것)도 함께 적는다"*
  를 세웠다. ⚠️⚠️ **오늘 그 규율이 세 자리에서 값을 냈고, 그중 하나는 이 문서 자신의 수였다.**
- ⓐ **`withdrawn_at` — 라운드 87이 옳고 오늘의 첫 실측이 틀렸다.** 한 줄 grep이 **2**를 냈는데 실제는
  **셋**이다(그 컬럼을 카멜로 적은 자리 하나를 바늘이 보지 못했다). ⚠️⚠️ **라운드 86이 *"표기를 나눠
  재면 둘 + 하나"* 라고 적어 둔 그 방언 한 줄이 없었다면 오늘 이 문서는 줄어든 수를 상태 변화로
  읽었을 것이다** — 값을 낸 것은 수가 아니라 **그 수를 세는 방법의 갈림을 적어 둔 문장**이다.
  ⚠️ **그 정정을 적은 자리가 U절 머리말이고, 이 문서가 자기 수를 스스로 정정한 첫 자리다.**
- ⓑ **앵커 스윕의 하한 둘 — 트랙이 다시 세어 정정했다.** 정찰이 손으로 잰 두 수가 기계 스윕에서
  **둘 다 낮았다**(하나는 바늘이 식별자·경로를 빼고 세었기 때문이고, 다른 하나는 **문장 하나를 앵커
  둘이 물고 있었기** 때문이다). ⚠️ **트랙은 정찰의 수를 그대로 옮기지 않고 다시 세어 갈린 이유를 함께
  적었다** — 라운드 87 트랙 E가 세운 그 형식의 두 번째 이행이다.
- ⓒ **AB-5 자신의 이월 — 열다섯이 아니라 열하나였다.** 그 절이 *"기계가 센 값이 아니다"* 라고 적어 둔
  그 제외를 오늘 기계로 다시 세니 수가 갈렸고, **나머지 다섯의 정체는 그대로 확인됐다**(위 머리말).
  ⚠️ **사각을 적어 둔 문장이 없었다면 이 차이는 드러나지 않았고, 다음 라운드는 열여섯을 전수로
  읽었을 것이다.**
- ⚠️⚠️ **그리고 이 절은 자기 사각도 적는다.** 오늘의 세 정정은 전부 **바늘의 사각**(표기 방언 ·
  식별자 포함 여부 · 한 문장에 앵커 둘)이고, ⚠️ **모집단의 사각은 오늘 재지 않았다** — 예컨대 위
  ⓒ의 스윕은 `known-limitations.md` 한 파일만 걸으므로 **다른 문서에 같은 문장이 있으면 보지 못한다.**
  ⚠️ **그 사실을 적어 두는 것이 이 절이 자기에게 적용하는 규율이다.**
- **일반형.** **수를 어떻게 냈는지를 적으면 그 수는 다음 라운드에 *검산 가능한 값*이 되고, 검산 가능한
  값만이 틀렸다는 것을 드러낸다.** 절차 없이 적힌 수는 라운드를 건너 살아남되 **아무도 뒤집을 수 없다** —
  뒤집으려면 그 수를 처음부터 다시 내야 하고, 그 비용이 높으면 아무도 내지 않는다. ⚠️⚠️ **그래서 절차를
  적는 진짜 값은 *오늘의 정확도*가 아니라 *내일의 정정 가능성*이다**(오늘 셋 중 둘은 두 라운드 전에
  적어 둔 절차가 잡았다). ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소가 **문서를 읽어 지키는
  계약이 몇이고 그 문서들이 어느 것인가**(⚠️ **Y-5가 라운드 84에 남긴 질문이고 오늘까지 전수로 답해진
  적이 없다** — 되짚어 보니 답이 없다는 사실이 오늘 처음 값이 됐고, 그래서 같은 질문을 셀 수 있는 모양
  그대로 다시 세운다).
- ⚠️ **갱신 (2026-08-31 · 라운드 89 트랙 F) — 답한 자리를 되짚는다.** 라운드 89 **AD절 머리말**과
  **AD-4**가 답했다(수와 그 방법은 같은 문서의 **선행 확인 8**이 든다). ⚠️ **판정을 여기 옮겨 적지
  않는다**(O-3·X-4) — 어느 절이 답했는지만 가리킨다.

## AD. 라운드 89에서 확정한 판정 (2026-08-31 · GAP-089 트랙 F)

라운드 88이 물은 것이 **그 옆 자리를 지키고 있는 것이 무엇인가**(답: 계약이었다)였다면, 라운드 89의
물음은 그 한 칸 뒤에 있다 — **판정이 값으로 선 다음에는 무슨 일이 일어나는가.** 세어 보니 답은
**아무 일도 일어나지 않는다**였다. 축은 라운드 81~88과 같이 **사용자 가치**였고(가족 초대 · 운영자
도구 · 저장소가 자기 문서를 세는 자리), 다섯 판정 다 K~AC절과 같이 **결함 보고가 아니라 다음 결정의
입력**이며 2026-08-31 소스에서 확인됐다(라운드 89 트랙 A·B·C·D·E 머지 후). ⚠️ **이번 라운드도 핵심
루프의 렌더를 여는 트랙은 0건이고, 다섯 중 셋은 화면을 아예 열지 않는다** — 그 배분이 라운드 88과
같아 **두 라운드 연속**이 됐고, 그 사실은 짝 문서의 §1-1 머리말이 값으로 진다.

⚠️⚠️ **이번 라운드의 가장 값진 관측: 판정을 세우는 것과 그 판정이 가리킨 자리를 고치는 것은 서로 다른
라운드의 일이고, 뒤쪽은 배정되지 않으면 오지 않는다**(AD-1). 라운드 88 트랙 E는 프롭 대장에 파생
판정 칸을 세워 *"끝난 초대 카드는 크로스플랫폼 출구가 0건이다"* 를 처음 값으로 만들었다 — **그 판정은
옳았고, 그 자리는 그날 하나도 고쳐지지 않았다.** ⚠️ **그리고 그것은 그 트랙의 잘못이 아니다**: *판정과
수리를 한 라운드에 섞지 않는다*는 것이 이 저장소의 관례이고 그 트랙의 금지 조항이었다. ⚠️⚠️ **문제는
관례의 나머지 절반이 아무 데도 적혀 있지 않았다는 것이다** — *"다음 라운드가 그 수리를 집는다"* 가
어디에도 없으면 판정은 값으로 선 채로 라운드를 건너 살아남는다. **오늘 그 절반을 트랙 A가 이행했고,
이 절이 그것을 관례로 적는다.**

⚠️⚠️ **두 번째 관측: 한 자리에 이름을 준 라운드의 다음 질문은 "그 화면의 형제 자리는 전부인가"이고,
그 이름의 재료는 대개 화면에 이미 있다**(AD-2). 라운드 88 트랙 A가 추이 표 하나에 `aria-label`을 주자
같은 앱의 `<table>` **열일곱** 중 이름을 가진 것이 **둘**뿐이라는 사실이 처음 보였고, **한 화면에 이름
없는 표가 둘 이상 서는 자리가 넷**이었다 — 소리로 훑는 운영자는 그 화면에서 *"표"* 를 두세 번 들었다.
⚠️ **고침에 새 한국어가 거의 필요 없었다는 점이 이 관측의 절반이다**: 아홉은 바로 위 `<h2>`에 `id`를
주고 표가 그것을 가리키면 끝이었다. ⚠️⚠️ **나머지 여덟이 화면의 이름을 지어야 했던 이유는 접근성이
아니라 *읽기 계약의 바이트 앵커*였다** — 정찰은 셋을 예상했고 실측은 여덟이었으며, 갈린 다섯은 다른
계약이 그 표의 제목·id·반복 구조를 글자로 물고 있어 `aria-labelledby`로 바꾸면 그쪽이 먼저 빨개지는
자리였다. **전제를 다시 잰 값이 트랙의 모양을 바꾼 사례다.**

⚠️⚠️ **세 번째 관측: 순서를 함께 적은 재개 조건은 실제로 집히고, 순서가 없는 조건은 집히지 않는다**
(AD-3). 오늘 집어 든 결정형이 **둘**인데 **둘 다 순서가 먼저 적혀 있어서 집혔다** — 하나는
*"계약 전용 데이터 모듈을 뿌리에서 가르는 판정이 서는 날 — 그날 이 축이 모집단으로 들어온다"*
(트랙 C), 다른 하나는 *"F가 절을 먼저 쓰고 다음 라운드가 그 계약을 세우는 순서"*(트랙 D)다.
⚠️ **같은 표의 아홉 중 순서가 없는 것들은 오늘도 0건 집혔다.** ⚠️⚠️ **그리고 순서를 적어 둔 값은
집는 날에 두 번째로 나타났다**: 트랙 C가 축을 넓히자 라운드 88이 먼저 배운 주석 마스킹이 없었으면
**모집단의 사문 마흔 중 스물이 조용히 사라졌을** 자리였다(그 수는 9에서 20이 됐다). **순서는 집는
날짜를 정하는 것이 아니라 집었을 때 계약이 비어 있지 않게 한다.**

⚠️⚠️ **네 번째 관측: 판정 문서를 무는 계약이 한 줄·한 낱말이면 그 문서의 어느 자리가 낡아도 아무도
모른다**(AD-4). 라운드 88 AC-5가 전수로 답한 그 사실 — **6,285줄짜리 판정 문서를 무는 단언은 N-4
문턱 한 줄 하나**, **1,082줄짜리 접근성 표를 무는 단언은 존재 확인과 `"44px"` 하나** — 이 오늘 두 곳에서
값을 냈다. ⓐ 재개 조건의 표기 관례(AA-3)는 두 라운드를 살아남았지만 **어떤 계약도 그것을 보지
않았고**, ⓑ 접근성 표의 C-3 경과 수는 **같은 파일 두 자리에서 세 라운드째 갈려** 있었다. ⚠️⚠️ **둘 다
"틀린 문장"이 아니라 "낡은 수"였고, 낡은 수는 자기가 낡았다고 말하지 않는다** — 그래서 오늘 그 두
문서에 각각 계약이 하나씩 섰다(트랙 D·E). ⚠️ **그리고 그 계약의 모양이 관측의 나머지 절반이다**:
둘 다 **하한과 정합만** 묻고 전수 일치를 묻지 않는다 — 문서를 쓰는 손이 계약을 맞추게 되는 순간
그물은 뒤집힌다.

⚠️⚠️ **다섯 번째 관측: 재개 조건이 "다음 트랙이 서는 날"이면 그 조건은 규율에 막혀 영원히 미도래로
남는다**(AD-5). 라운드 88이 *행마다 갈리는 낭독 라벨의 모집단*을 기각하며 적은 조건은
*"a11y 그물을 여는 다음 트랙이 서는 날"* 이었는데, **a11y 그물을 여는 트랙은 언제나 자기 축이 있으므로**
(오늘은 트랙 A) *한 트랙이 한 그물에 축 둘을 얹지 않는다*는 규율이 그 조건을 **매번** 막는다.
⚠️ **조건이 참이 되는 순간이 조건이 집힐 수 없는 순간과 같다** — 그것이 자기 모순이다. ⚠️⚠️ **그래서
오늘 그 조건을 좁혀 다시 적었다**: *"그 스윕 자체가 한 트랙의 축이 되는 라운드가 서는 날."*
**조건은 *언제*와 *무엇을 먼저*뿐 아니라 *자기가 누구의 축이 되어야 하는지*까지 적어야 한다.**

⚠️⚠️ **이월 다섯은 전부 보류 유지이고 재실측 값만 갱신했다 — 갱신 한 줄씩은 그 판정이 사는 절에 있다**
(다음 라운드가 같은 실측을 다시 돌리지 않도록 여기서는 자리만 가리킨다).

- **이 스캐너가 쿼리로 분류한 자리의 낭독** — 재실측 상태 변화 0, A-20 #85 선행 → **U절 머리말**
  (⚠️ 접점 0건이다 — 다섯 트랙 중 그 여섯 화면을 여는 것도 그 계약 파일을 여는 것도 없다 ·
  **세 라운드 연속으로 열리던 그 파일이 이번에는 열리지 않았다**).
- **`monthly_wrapup`의 달 이동 구멍** — 게이트가 읽는 것은 여전히 대기 행의 바뀐 뒤 날짜 하나 → **U-3**
  (⚠️ **두 라운드 연속으로 열리던 `src/notifications/**`가 이번 라운드에는 접점 0건이다**).
- **S-3(어드민 `disabled`)** — 판정 종전 그대로, 브라우저 확인 `#130` 선행 → **U절 머리말**.
  ⚠️⚠️ **다만 *"접점 0건"* 의 연속이 오늘 끊긴다 — 그리고 끊긴 방식이 값이다**: 트랙 B가
  `app/items/page.tsx`와 `app/links/page.tsx`를 **표 이름 축으로만** 열었고(각각 `aria-labelledby`
  한 줄과 `<h2>`의 `id` 한 줄), **역할 게이트·폼·저장 경로·`disabled` 처리는 바이트 불변**이다.
  ⚠️ **그러므로 오늘의 정확한 문장은 *"다섯 라운드 만에 그 두 파일이 열렸고, 열린 축은 표 이름 하나이며
  S-3은 손대지 않았다"* 이다** — *"열지 않았다"* 와 *"열었지만 그 축이 아니다"* 는 다른 문장이고,
  라운드 87이 세운 그 구별(파일 접점과 축 접점을 따로 센다)을 여기서 이어 센다.
- **`withdrawn_at`** — 저장소 전체 셋 · 파일 둘, 컬럼 신설은 여전히 별도 결정 → **U절 머리말**
  (⚠️ **이번 라운드는 이 수를 다시 재지 않았다** — 어느 트랙도 그 두 파일을 열지 않았고, 라운드 88이
  자기 정정으로 확정한 값을 여기서 옮겨 적지 않는다).
- **AA-R ① 연속 실패 재판정** — deps는 오늘도 `[isError]` 하나 · 자동 재시도·폴러 **0건** → **AA-R ①**
  (⚠️ 어느 트랙도 그 훅도 그 훅의 호출부 화면도 열지 않았다).

**다섯 다 2026-08-31 재실측이고 상태 변화 0이다**(`withdrawn_at`은 재실측 대상이 아니었다는 사실이
그 줄의 값이다). ⚠️⚠️ **그리고 이번 라운드의 접점 지도는 라운드 88과 정확히 반대 방향으로 한 칸 갔다:
두 라운드 연속 열리던 두 뿌리가 오늘 0건이 되고, 네 라운드 연속 0건이던 S-3의 두 파일이 열렸다 —
그런데 열린 축이 그 판정의 축이 아니다.** **접점의 유무는 실측을 대신하지 않고, 접점의 *축*까지 세어야
그 문장이 참이 된다.**

⚠️⚠️ **AC-1~AC-5가 남긴 질문 다섯 전수와 오늘의 답이다 — 다섯 다 답했고 넷이 발동했다.**
⚠️ **수치는 여기 옮겨 적되 *그 수를 어떻게 냈는지*를 반드시 함께 가리킨다**(AC-5가 세운 그 규율 —
모집단과 바늘을 적지 않은 수는 다음 라운드가 전수로 다시 읽는다). ⚠️⚠️ **그리고 이 답들은 계약이 아니라
정찰이 손으로 잰 수다** — 계약이 세는 수와 한 낱말로 적지 않는다.

- **AC-1**(**한 화면·한 파일만 무는 단언**이 몇이고, 그중 **형제가 실재하는 것**이 몇인가) —
  ⚠️ **발동했으나 오늘의 트랙이 되지는 않았다.** **답**: 화면 파일을 하나라도 무는 계약 **183** ·
  그중 **한 화면만 무는 것 83 · 둘 이상을 함께 무는 것 100** · 그 83 가운데 **같은 이름 형제 모듈이
  화면 둘 이상에 실려 형제가 실재하는 것 일곱** · ⚠️ **그 일곱을 손으로 열어 확인한 살아 있는 결함
  0건.** **수를 낸 방법**(모집단 = `apps/**`·`packages/**`의 `.test.ts(x)` 전수 중 화면의 상대 경로를
  **문자열 리터럴**로 적는 것 · 바늘 = 그 리터럴을 실재 화면 목록(어드민 11 · 모바일 38)과 접미
  일치로 맞춘 뒤, 같은 이름 형제 모듈의 import 수를 다시 센다 · 사각 둘 = **경로를 상수로 조립하는
  계약**과 **다른 이름의 형제 모듈**을 못 본다 → **일곱은 하한이다**):
  `docs/5차/round89-scout.md`의 **선행 확인 4**.
  ⚠️⚠️ **그리고 이 질문의 진짜 답은 옆에 있었다** — 라운드 88 A가 *한 화면을 무는 단언*을 *두 화면을
  도는 루프*로 바꾼 그 자리에서 **화면에 실제로 준 것은 표 이름 하나**였고, **그 이름을 형제 표
  열다섯은 오늘까지 0건 갖고 있었다**(→ AD-2).
  ⚠️ **재개 조건(사건형): 그 일곱 중 한 자리에서 형제 화면이 실제로 갈리는 날** — ⚠️ **그날의 하한은
  일곱이 아니다**(위 사각 둘).
- **AC-2**(**같은 API를 부르는 호출부가 둘 이상인 자리**가 몇이고, 그중 **보내는 필드 집합이 갈리는
  것**이 몇인가) — ⚠️ **답은 0이고, 0도 재어 본 값이다.** **답**: 모바일 `client.ts`의 `export function`
  **58** 중 데모 거울을 뺀 실 호출부 둘 이상 **20**(본문 객체를 두 자리 이상에서 세우는 것 둘 · 키
  집합이 갈리는 것 하나 = `updateChild`의 PATCH 부분 갱신 — **의도된 갈림**) · 어드민 `admin-api.ts`의
  **48** 중 호출부 둘 이상 **15**(갈리는 것 둘 — 둘 다 `entityId` 선택성·필터 축이라 시그니처가 그
  선택성을 이미 적는다). **오늘 결함으로 셀 것은 0건이다.** **수를 낸 방법**(모집단에서
  `src/api/local-backend.ts`를 뺐다 — 같은 이름을 **다시 구현하는 데모 거울**이지 호출부가 아니고,
  넣으면 함수 45가 "호출부 둘 이상"으로 잡혀 그 수가 아무것도 말하지 않는다 · 바늘 = 괄호 균형을 세어
  인자를 자르고 **최상위 키만** 집계한다 — 중첩 `payload: { … }` 안의 키를 세면 갈리지 않는 것이 갈려
  보이고 **첫 실측이 실제로 그렇게 틀렸다** · 사각 = 변수로 만든 본문을 넘기는 호출은 키를 못 보므로
  **오차의 방향이 갈림을 놓치는 쪽**이다): 같은 문서의 **선행 확인 5**.
  ⚠️ **라운드 88 B가 닫은 자리도 함께 재실측했다** — `registerDevice`는 오늘도 **한 벌**을 두 경로가
  공유한다. ⚠️ **재개 조건(사건형): 본문에 새 필드가 붙는 날, 또는 그 스윕을 다시 돌리는 날** —
  ⚠️ **다시 돌릴 때는 변수로 만든 본문을 따라가는 바늘을 함께 지고 돌려야 한다.**
- **AC-3**(이 저장소의 재개 조건 중 **집을 때의 순서를 함께 적어 둔 것**이 몇인가) — ⚠️⚠️ **발동했고
  오늘의 트랙 둘이 그 답에서 나왔다**(C·D). **답**: 재개 조건이 등장하는 자리 **278** 중 조건 문장
  자체가 순서·선행을 함께 적은 것 **열셋(기계) → 여덟(손 판정)** 이고, 그 여덟 중 **둘은 이미
  소진됐으며 하나가 오늘 도래했다**(AA-3 기계) · **순서가 없는 조건 스물넷 중 오늘 집힌 것은 0건**이다.
  **수를 낸 방법**(모집단 = `known-limitations.md` + `apps/**`·`packages/**`의 `.ts(x)` 전수 +
  `docs/qa/**`의 `.md` · 바늘 = *"재개 조건|재개 트리거"* 가 나오는 지점부터 다음 줄까지를 이어 붙여
  **조건 문장 하나**를 자르고 그 안에서만 *먼저·그 전에·선행·그다음·순서·앞서* 를 찾는다 — ⚠️ **줄
  전체나 문단으로 창을 넓히면 산문이 섞여 66이 나오고, 그 넓은 창의 수를 이 답으로 적지 않는다**):
  같은 문서의 **선행 확인 6**.
  ⚠️⚠️ **그리고 같은 날 트랙 D가 같은 문서를 *다른 바늘로* 다시 세었다 — 그 수(자리 203 · 괄호 바늘
  61 · 줄 바늘 84 · 손의 위치 12/14)를 이 답의 278·열셋·여덟과 한 낱말로 적지 않는다.** 두 스윕은
  **묻는 것이 다르다**: 이 답은 *순서를 적었는가*를, 그 대장은 *형과 손의 위치를 적었는가*를 센다.
  ⚠️ **재개 조건(사건형): 순서를 적은 조건이 하나 더 도래하는 날.**
- **AC-4**(이 저장소의 대장 중 **판정 칸이 있고 그 판정이 모집단에서 파생하는 것**이 몇이고, **손으로
  적힌 것**이 몇인가) — ⚠️⚠️ **발동했고, 트랙이 아니라 *그 판정이 가리킨 자리를 고치는 것*이 오늘의
  값이 됐다**(→ AD-1 · 트랙 A). **답**: 대장꼴 상수 **75** 중 이유·한 일 칸을 진 것 **40** ·
  **판정 칸을 진 것 둘**이고 **둘 다 모집단에서 파생**한다(라운드 88 E가 세운 `ROUND79/80_ANNOUNCE_PROPS_ADDED`의
  `crossPlatform`) · **손으로 적힌 판정 0건.** **수를 낸 방법**(모집단 = `apps/**`·`packages/**`·`scripts/**`의
  `.ts(x)` 전수에서 `const 대문자이름 = [ … ]` 꼴 **객체 배열**이고 항목 키가 둘 이상인 것 —
  ⚠️ **라운드 88의 *마흔여덟* 과 바늘이 다르다**: 그 라운드는 `export const`만 셌고 오늘은 테스트 파일
  안의 `const` 대장까지 센다. **두 수를 한 낱말로 적지 않는다** · 사각 둘 = `Record`·`Map`꼴 대장을
  못 보고, `floor`+`measure` 쌍은 판정 *이름*을 갖지 않아 이 수에 들지 않는다 → **둘은 하한이다**):
  같은 문서의 **선행 확인 7**.
  ⚠️ **재개 조건(사건형): 대장이 하나 더 서는 날** — 오늘 선 대장 하나(재개 조건 표기 관례)는 판정
  칸 대신 **하한 래칫과 면제의 이유**를 진다. 그 둘이 같은 요구의 다른 모양인지가 다음 답이다.
- **AC-5**(이 저장소가 **문서를 읽어 지키는 계약**이 몇이고 **그 문서들이 어느 것인가**) —
  ⚠️⚠️ **발동했고 오늘의 트랙 둘이 그 답에서 나왔다**(D·E). **답**: 계약 파일 **열**과 스크립트 **둘**이
  문서를 읽고, 지켜지는 문서는 **스물여섯**이다 · ⚠️⚠️ **그 스물여섯 중 판정 문서 둘을 무는 단언은
  각각 한 줄과 한 낱말이었다** — `known-limitations.md`(6,285줄)는 **N-4 문턱 한 줄**,
  `accessibility-offline-checklist.md`(1,082줄)는 **존재 확인 + `"44px"`**. **수를 낸 방법**(모집단 =
  `apps/**`·`packages/**`·`scripts/**`의 `.ts(x)` 전수 · 바늘 = `readFileSync`/`existsSync`를 쓰면서
  **주석을 지운 코드 안에** `.md` 문자열 리터럴이 있는 것 — ⚠️ **주석을 지우지 않으면 *"이 문서를 보라"*
  는 안내 주석이 계약으로 잡혀 18로 부푼다** · 사각 둘 = 문서 경로를 상수로 조립하는 계약과
  `apps/api/**`의 e2e는 세지 않았다): 같은 문서의 **선행 확인 8**.
  ⚠️⚠️ **오늘 그 둘이 각각 하나씩 늘었다** — `known-limitations.md`에 재개 조건 표기 관례 대장(트랙 D)이,
  `accessibility-offline-checklist.md`에 C-3 경과 수의 자기집계 짝 계약(트랙 E)이 섰다. **그래서 이
  질문의 다음 답은 수가 아니라 *무엇을 무는가*여야 한다.**
  ⚠️ **재개 조건(사건형): 문서를 무는 계약이 하나 더 서는 날** — 그날 그 계약이 **하한을 무는지 전수
  일치를 무는지**가 다음 답이다(오늘 선 둘은 전부 하한·정합이다).

⚠️ **U-2·U-5·W-2·W-3·W-5·X-5·Y-5·Z-5, 그리고 AB-1~AB-5·AC-1~AC-5의 판정은 다시 쓰지 않는다.**
라운드 84~88이 그 전수에 답했고 **오늘 상태 변화가 0**이라, 같은 답을 다시 쓰면 **그 자체가 계약 밖의
사본이 된다**(O-3). ⚠️ **AC절 본문에 오늘 선 것은 *되짚는 한 줄*뿐이고**(AC-1~AC-5 다섯 자리),
그 절들의 판정과 머리말의 표는 **바이트 불변**이다.

⚠️ **N-4의 두 문턱은 오늘로 12라운드 연속 미발동이고, 준비템 탭 비가상화는 이번에도 제안하지
않는다** — ⚠️⚠️ **그 두 수는 화면이 세므로 이 절도 옮겨 적지 않고**(O-3 · 갱신 한 줄은 N-4에 있다),
⚠️⚠️ **이번 라운드는 그 수를 아예 재지 않았다**(활성 카탈로그 수는 실 PostgreSQL을 요구하는데 다섯
트랙 중 `apps/api/**`를 여는 것도 준비템 탭을 여는 것도 0건이었다). **"오늘 재지 않았다"가 이 자리의
값이고, 라운드 88의 수를 인용하지 않는 이유도 그것이다.**

⚠️⚠️ **AA-3의 이행 — 결정형 재개 조건 전수와 오늘의 처분이다. 라운드 88의 열이 오늘 열하나가 됐다.**
⚠️⚠️ **열 → 열하나도 새 부채가 아니라 *세는 자리가 늘었다*는 뜻이다**: 라운드 88이 집어 든 하나가 그날
닫혀 아홉이 됐고, 거기에 **라운드 88의 기각 목록이 새로 결정형이라고 이름 붙인 둘**(AA-3의 표기 관례
기계 · 재조회 실패 창)이 오늘 전수에 들어왔다. **기각이 조건을 값으로 적으면 그 조건은 다음 라운드의
표에 선다 — V-2가 세운 규율이 모집단으로 되돌아오는 자리다.**

| # | 결정형 조건 | 사는 곳 | 손이 저장소 안에 있는가 | 오늘의 처분(2026-08-31 실측) |
| --- | --- | --- | --- | --- |
| 1 | **막대를 포커스 가능하게 만들 것인가**(디자인·접근성 결정) | AA-2 | 안에 있다 | **집지 않는다 — 값이 오늘도 0이다.** 두 화면 다 `trend.showTable` 갈래의 표가 값을 텍스트로 준다(재실측 · 라운드 88 A 이후 변화 0) |
| 2 | **기록 탭 검색의 분류 갈래** — *"placeholder가 분류를 약속하는 날"* | Z절 | 안에 있다 | **집지 않는다 — 오늘도 약속이 참이다**(라벨이 훑는 곳을 정확히 말하고 placeholder가 그 값에서 파생한다) — **고칠 어긋남 0건 · 네 라운드 연속 같은 답** |
| 3 | **준비템 분류 필수 입력** — *"카탈로그 정책이 서는 날"* | Z-3 | ⚠️ **밖에 있다**(카탈로그 정책 · 서버 계약) | **집지 않는다.** 변화 0 |
| 4 | **서버의 중복 대기 초대 방지** | AA-4 | ⚠️ **밖에 있다**(초대 정책) | **집지 않는다.** 변화 0 |
| 5 | **감사 뷰의 대상(targetType·targetId) 필터** | AA절 기각 | ⚠️ **밖에 있다**(서버 DTO에 그 파라미터가 0건) | **집지 않는다 — ⚠️ 어느 트랙도 `apps/api/**`를 쓰기로 열지 않았다** |
| 6 | **타일 안 배지(승인 디자인)** | AA-1 | ⚠️ **밖에 있다**(디자인 승인) | **집지 않는다.** 변화 0 |
| 7 | **C-3 잠금 오버레이 TalkBack 투과** — *"사람·기기·날짜 배정"* | 접근성 표 C-3 | ⚠️⚠️ **밖에 있다** | **트랙 F의 소유 밖이다**(오늘로 **스물세 라운드째 미확인**). ⚠️⚠️ **오늘 이 줄에 값이 하나 붙었지만 그것은 확인이 아니다** — 경과 수를 말하는 **두 자리**가 세 라운드째 갈려 있었고 오늘 함께 올라갔으며, **그 갈림을 이제 계약이 센다**(트랙 E). **수의 정합은 기계가 지키고, 확인은 여전히 배정이다** |
| 8 | **JSX 사용을 참조로 세는 판정** | `packages/test-utils/src/dead-export-ledger.ts`(**소스**) | 안에 있다 | **집지 않는다 — 미도래**(그 판정이 아직 서지 않았다 · 전제는 참이고 `.tsx`의 `export function` **141**이 오늘도 모집단 밖이다). ⚠️ **집지 않은 이유가 이번에도 그물 배정이다** — 트랙 C가 같은 파일을 열었고 **한 트랙이 한 그물에 축 둘을 얹지 않는다** |
| 9 | **계약 전용 데이터 모듈을 뿌리에서 가르는 판정** | `dead-export-ledger.ts`(**소스**) | 안에 있다 | ⚠️⚠️ **집어 들었다 → 트랙 C. 그리고 닫혔다.** 판정이 서서 `export const` 축 **652**가 모집단에 들어왔고, 손으로 적던 모듈 목록이 **파생 면제**(열여덟 자리 · 여섯 모듈)로 바뀌었다 — ⚠️ **그 손 목록의 이유 한 줄이 거짓으로 판명됐다**(`SYNC_STATUS_RETRY_ALL_LABEL`은 계약이 읽는 값이 아니라 화면이 라운드 58에 떠난 사용자 문장이다) |
| 10 | **AA-3의 표기 관례 기계** — *"F가 절을 먼저 쓰고 다음 라운드가 그 계약을 세우는 순서"* | AC절 기각(`:6077`) | 안에 있다 | ⚠️⚠️ **집어 들었다 → 트랙 D.** **순서 조건이 도래했다**(라운드 88 F가 AC절을 먼저 썼다). 저장소의 **열다섯째** 그물이 서고, 계약은 **하한 래칫**과 **결정형이면 손의 위치를 함께 적었을 것** 하나만 문다 |
| 11 | **재조회 실패 창에서 옛 목록을 남길지** | AC절 기각(`:6048`) | 안에 있다 | **집지 않는다 — 화면 구조 결정이고 오늘 값 0건**(라운드 88이 배선 대장 전수로 0을 냈고, 어느 트랙도 `src/offline/**`의 화면 구조를 열지 않았다) |

⚠️⚠️ **이 표가 라운드 88의 표보다 값이 큰 이유는 하나다: 집는 수가 하나에서 둘로 늘었고, 둘 다
*순서가 먼저 적혀 있었기 때문에* 집혔다.** 9는 *"그 판정이 서는 날 — 그날 이 축이 모집단으로
들어온다"* 를, 10은 *"F가 절을 먼저 쓰고 다음 라운드가 그 계약을 세우는 순서"* 를 조건 문장 안에 이미
적고 있었다. ⚠️ **반대로 8은 전제가 오늘도 참인데 집히지 않았고, 그 이유는 순서가 아니라 배정이다**
(같은 파일에 축 둘을 얹지 않는다). ⚠️⚠️ **그래서 AC-3의 일반형이 오늘 처음 두 자리에서 동시에
이행됐다**(→ AD-3). ⚠️ **다음 라운드의 표는 아홉에서 시작한다** — 9와 10이 닫혀 빠지고, 아래 기각
목록이 새로 결정형이라고 이름 붙이는 것들이 그 자리에 들어온다.

⚠️⚠️ **이번 라운드가 실측하고 기각한 열여섯을 값으로 남긴다 — 전부 재개 조건과 함께**(V-2가 세운 규율:
조건 없는 보류는 이유가 적혀 있다는 이유로 재론되지 않는다). ⚠️ **그중 다섯은 재개 조건이 *결정형*
이라는 사실과 그 결정의 손이 어디에 있는지를 함께 적고**, 여섯째 줄(손이 밖인 다섯)은 다섯 조건을
한 줄에 묶어 **전부 결정형 · 손은 저장소 밖**이라고 적는다(Z-4·AA-3·AB-3·AC-3의 이행).
⚠️ **아래 마지막 두 줄은 그 열여섯에 들지 않는다** — 라운드 62~88이 남긴 **상태 변화 0의 표식**과
**제외 목록 준수 확인**이고, 재론 대상이 아니라 스윕이 그것들을 다시 줍지 않게 하는 자리다.

- **AC-2의 답이 0이다 — 호출부 둘 이상의 필드 갈림 0건**(위 답 다섯의 둘째). 갈리는 셋은 전부 PATCH의
  부분 갱신·선택 필드라 의도된 것이다. ⚠️ **재개 조건(사건형): 본문에 새 필드가 붙는 날, 또는 그
  스윕을 다시 돌리는 날** — ⚠️ **다시 돌릴 때는 변수로 만든 본문을 따라가는 바늘을 함께 지고 돌려야
  한다**(오늘의 사각).
- **AC-1의 일곱 — 재었고 살아 있는 결함 0건**(위 답 다섯의 첫째). 한 화면만 무는 계약 83을 두 화면
  루프로 바꾸는 것은 **오늘 고칠 어긋남이 0건**이라 *판정을 맞추는 일*이 아니라 *계약의 모양을 바꾸는
  일*이 된다. ⚠️ **재개 조건(사건형): 그 일곱 중 한 자리에서 형제 화면이 실제로 갈리는 날.**
- **AA-3 기계의 나머지 절반 — 소스에 사는 재개 조건의 표기까지 무는 것은 오늘 세우지 않았다.**
  오늘 선 대장(트랙 D)은 소스 축을 **읽기만** 하고 하한을 오늘의 넷이 아니라 **셋**으로 잡았다 —
  같은 라운드의 트랙 C가 그 파일을 열어 **도래한 조건 하나를 소진하며 지울 수 있기 때문**이고,
  **도래한 조건을 지우는 것은 옳은 손이라 그물이 그것을 막으면 족쇄가 된다.** ⚠️ **재개 조건(사건형):
  소스의 재개 조건 표기가 둘째 파일에 서는 날** — 그날 그 축은 하한 하나가 아니라 뿌리 목록을 얻는다.
- **`dead-export-ledger.ts`의 결정형 8(JSX 사용을 참조로 세는 판정) — 전제는 참인데 집지 않는다.**
  `.tsx`의 `export function` **141**이 오늘도 모집단 밖이고, 그 수는 축을 넓힌 뒤에도 움직이지 않았다.
  ⚠️ **집지 않는 이유는 그물 배정이다**(트랙 C가 그 파일을 열었다).
  ⚠️ **재개 조건(결정형 · 손은 저장소 안): 그 판정이 서는 날 — 그날 141이 모집단으로 들어온다.**
- **앵커 대장의 사각 `helper-named-reader` 164 — 재었고 오늘도 하한 그대로이며 집지 않는다.** 앵커
  전수 **698**(code-only 620 · comment-tolerant **70**/래칫 70 · comment-only **8**/래칫 8 ·
  unanchored 0)과 면제 **8**이 라운드 88과 **한 자리도 다르지 않다** — ⚠️ **오늘 움직이지 않은 유일한
  대장이다.** ⚠️ **집지 않는 이유는 래칫이다**: 모집단이 넓어지면 `comment-tolerant` 래칫 70이 첫날부터
  전수로 다시 적혀야 하고, 그것이 라운드 85~88이 같은 자리에서 받은 경고다.
  ⚠️ **재개 조건(결정형 · 손은 저장소 안): 저장소가 소스 리더 이름을 한 벌로 모으는 날, 또는 이 대장이
  헬퍼 정의를 따라가 루트를 푸는 법을 배우는 날.**
- **문자열 리터럴 축(사문 대장) — ⚠️⚠️ 오늘 이 조건이 *발동했고*, 처분은 다음 라운드 몫이다.**
  라운드 88은 *"참조가 전부 문자열뿐인 export 0건 → 실피해 0"* 이라고 적었는데, 트랙 C가 `export const`
  축을 들이자 그 수가 **0에서 넷**이 됐다(`shared-cache-policy.ts`의 표 상수 넷 — 같은 파일 안의 표
  설명 문자열이 자기 이름을 인용해 살아 있다). ⚠️ **그런데 그 트랙은 문을 열지 않았다**: 한 트랙이 한
  그물에 축 둘을 얹지 않고(오늘 얹은 축은 `export const` 하나다), **넷 다 결정 ③의 자리 표 축이 이미
  면제하는 표라 문자열 마스킹을 켜도 대장의 줄은 0이 는다**(트랙 C가 그 넷을 하나씩 확인해 값으로
  적었다). ⚠️ **그래서 오늘의 실피해는 *못 본 사문 넷*이 아니라 *그물이 축 하나를 아직 안 본다*이고,
  이 조건은 **발동한 채로 다음 라운드에 넘어간다**.** ⚠️ **재개 조건(사건형): 이미 도래했다 — 남은
  것은 배정이고, 그날의 일은 문자열 마스킹과 템플릿 `${…}` 갈래를 **한 번에** 검증하는 것이다.**
- **행마다 갈리는 낭독 라벨의 모집단 — 재었고 오늘도 세우지 않으며, ⚠️⚠️ 그 재개 조건을 좁혀 다시
  적는다.** 라운드 88이 적은 조건은 *"a11y 그물을 여는 다음 트랙이 서는 날"* 이었는데, **a11y 그물을
  여는 트랙은 언제나 자기 축이 있으므로**(오늘은 트랙 A) *한 트랙이 한 그물에 축 둘을 얹지 않는다*는
  규율이 그 조건을 **매번** 막는다 — **조건이 참이 되는 순간이 조건을 집을 수 없는 순간과 같다.**
  ⚠️ **재개 조건(사건형 · 좁혀 다시 적음): a11y 그물을 여는 트랙의 축이 *바로 이 모집단*인 라운드가
  서는 날** — 즉 **그 스윕 자체가 한 트랙의 축이 되어야 한다**(→ AD-5).
- **조회 실패 창의 모집단 — 라운드 88이 0으로 닫았고 오늘 다시 세지 않았다.** 어느 트랙도
  `src/offline/**`의 화면 구조를 열지 않는다. ⚠️ **재개 조건(결정형 · 손은 저장소 안): 재조회 실패
  창에서 옛 목록을 남길지 정하는 날** — 그날 그 여섯 화면이 한 트랙의 모집단이 된다.
- **응답 필드 축(모바일) — 라운드 88의 판정 그대로이고 오늘 다시 돌리지 않았다.** 어느 트랙도 응답
  타입 선언을 늘리지 않았다(모바일이 연 것은 화면 한 갈래와 문구 모듈 하나뿐이다).
  ⚠️ **재개 조건(사건형): 응답에 새 필드가 실리는 날, 또는 그 스윕을 다시 돌리는 날** — ⚠️ **다시
  돌릴 때는 구조 분해를 세는 바늘을 함께 지고 돌려야 한다.**
- **`HouseholdMember.joinedAt` — 재었고 값이 0이다.** 오늘 트랙 A가 그 화면의 **형제 화면**(초대 수락)을
  열었지만 구성원 행은 손대지 않았고, 구성원 행은 여전히 **이름으로 이미 갈린다.** ⚠️ **가를 필요가
  없는 자리에 값을 더하는 것은 값이 아니다.** ⚠️ **재개 조건(사건형): 이름 없는 구성원 행이 생기는 날.**
- **기록 탭 검색이 분류 이름을 보지 않는 것 — 재었고 이번에도 제안하지 않는다.** 라벨이 훑는 곳을
  정확히 말하고 분류 칩 줄이 검색칸 아래에 선다 — **어긋남 0건 · 네 라운드 연속 같은 답.**
  ⚠️ **재개 조건(결정형 · 손은 저장소 안): placeholder가 분류를 약속하는 날** — 그런데 고칠 어긋남이
  0건이라 집어 드는 것은 *판정을 맞추는 일*이 아니라 *문구를 바꾸는 일*이 된다.
- **막대 포커스 가능화 — 재었고 값이 0이다.** 두 화면 다 표가 값을 텍스트로 주고, 오늘 그 표들은
  **이름까지 얻었다**(트랙 B) — ⚠️ **그래서 0이 한 칸 더 단단해졌다**: 값에 닿는 길이 안내될 뿐 아니라
  그 길의 이름이 소리로 불린다. ⚠️ **재개 조건(결정형 · 손은 저장소 안): 표로 닿지 못하는 값이 차트에
  생기는 날.**
- **이월 다섯(U절 셋 · S-3 · `withdrawn_at`) — 판정 종전 그대로**(위 이월 목록 · 갱신 줄은 각 판정이
  사는 절에 있다). ⚠️⚠️ **다만 S-3의 줄에는 오늘의 구별이 함께 선다**: *"다섯 라운드 만에 그 두 파일이
  열렸고, 열린 축은 표 이름 하나이며 S-3은 손대지 않았다."* ⚠️ **재개 조건은 다섯 다 종전 그대로다.**
- **성능 넷 — ⓐ·ⓒ·ⓓ는 재었고 미도래, ⓑ는 오늘 재지 않았다.** ⓐ **첫 페인트**(⚠️ 어느 트랙도 `useQuery`
  선언을 늘리지 않았다 — 트랙 A가 더한 것은 `useEffect` 한 벌이다) · ⓒ **번들**(⚠️ **새 런타임 의존성
  0건 — 다섯 트랙 다 기존 import만 쓴다**) · ⓓ **api의 루프**(⚠️ **`apps/api/**` 쓰기 0건**).
  ⓑ **렌더 비용**은 활성 카탈로그 수가 실 DB를 요구해 **오늘 재지 않았다**(라운드 88의 수를 인용하지
  않는다 — 옮겨 적은 수는 계약 밖의 사본이 된다 · O-3). ⚠️ **어느 트랙도 준비템 탭을 열지 않았다.**
  ⚠️ **재개 조건은 넷 다 종전 그대로다**(**네 라운드 연속 넷 다 미도래**).
- **손이 밖인 다섯 — 넷은 다른 사람이 내릴 결정이고 하나는 배정이다**(위 표의 3~7). 준비템 분류 필수
  입력 · 서버의 중복 대기 초대 방지 · 감사 뷰의 대상 축 필터 · 타일 안 배지는 **카탈로그 정책 · 초대
  정책 · 서버 계약 · 디자인 승인**이 각각 선행이고, C-3은 **사람·기기·날짜 배정**이다.
  ⚠️ **재개 조건(전부 결정형 · 손은 저장소 밖): 그 결정이 서는 날** — ⚠️ **넷과 하나를 한 줄에 적지
  않는 이유가 그 칸이다**(넷은 결정을 기다리고, 하나는 시간을 기다린다).
- **`${seller}에서 구매하기` 둘 — 제외 확인이지 제안이 아니다.** 준비템 판매처 1:1과 구매 확인 판매처
  라벨은 **영구 기각** 축이다(라운드 62~88이 남긴 그대로). ⚠️ **재개 조건: 없다 — 이 줄은 재론 대상이
  아니라 스윕이 그 둘을 다시 줍지 않게 하는 표식이다.**
- **감사 뷰 CSV · 콘텐츠 리비전 편집 표면 · 어드민 손 미러 · `SYNC_STATUS_RETRY_ALL_LABEL` · 지출 입력
  두 화면의 조립 · CSV 왕복 다섯 열 손실 · `refund` 생성 불가 · `link_health`의 `errors` 카운터 ·
  서버 알림 층 · 홈의 손 폴 다섯 · 공유 카드 왕복 · 어드민 카탈로그 전량 조회 · 미출처 틴트 둘 ·
  첫돌 이후 마일스톤 고착 · api 하네스 동시 실행 구멍 · 서버 중복 아이 가드 부재 · 크래시 파이프라인
  부재 · `Share.share`의 catch 없는 `void` 둘 · 결제 수단 기본값 — 라운드 62~88이 남긴 그대로이고
  상태 변화 0.** ⚠️⚠️ **다만 `SYNC_STATUS_RETRY_ALL_LABEL` 하나는 오늘 성질이 바뀌었다** — 그 이름이
  사문 대장의 **면제**(계약 전용 데이터 모듈)에 손으로 적혀 있었는데, 트랙 C의 파생 판정이 그 이유를
  **거짓**으로 판정해 면제에서 꺼내 **대장의 줄**로 옮겼다(그 문장은 계약이 읽는 값이 아니라 화면이
  라운드 58에 떠난 사용자 문장이다). ⚠️ **기각의 상태는 그대로이고, 바뀐 것은 그 기각이 사는 층이다.**
- **제외 목록 준수 확인**: 준비템 목록 **가격 표시**(잠금 · ⚠️ **다섯 트랙 어디에도 가격·링크 수가
  들어가지 않았다**) · 오프라인 로컬 아이 복구 · 외부 계정/키/자산 · **C-3 잠금 오버레이 낭독** ·
  **P-2 법무 대조** · P-3 테스트 건수 자동화 · **표기 방언 통일** · S-4 파기 `targetId` · 40주 초과
  달력 · `onBudgetRelevantChange` · 4가구/`viewedHouseholdId` · **지출→리포트 정확성 축** ·
  **공유 왕복 축** · **준비템 완료율 동기부여** · **준비템 탭 비가상화** · **홈 수치 정합** —
  **전부 오늘도 제안하지 않았다.**

⚠️⚠️ **트립와이어 대조 — 라운드 88이 남긴 래칫·하한을 오늘 HEAD에서 다시 잰 값이다.**
⚠️ **정찰은 이 자리를 *"전부 움직이지 않았다"* 로 적었고 그 실측은 옳았다 — 다만 그것은 **트랙 다섯이
머지되기 전**의 값이다.** ⚠️⚠️ **오늘 다시 재니 열한 자리 중 아홉이 움직였고, 움직이지 않은 둘은 같은
대장(앵커 대장)의 두 칸이다. 그 갈림 자체가 이 표가 기록하는 값이다** — **정찰의 수를 옮겨 적었다면 이 절은 오늘
전부 틀렸을 것이다**(O-3의 병이 트립와이어 표에서 어떻게 발병하는지의 실례다).

| 자리 | 라운드 88이 남긴 값 | 2026-08-31 HEAD 재실측 | 움직였는가 |
| --- | --- | --- | --- |
| 사문 대장 항목 / 래칫 | 16 / 16 | **22 / 22** | ⚠️ **움직였다** — 부채가 아니라 **세는 자리**가 늘었다(`export const` 축 652가 모집단에 들어왔다) |
| 사문 대장의 사각 일곱 | 24 · 17 · 77 · 9 · 26 · 141 · 0 | **18 · 0 · 226 · 20 · 55 · 141 · 0** | ⚠️ **움직였다 — 그리고 둘이 닫혔다**(`export-const-axis`·`contract-only-data-modules`가 `CLOSED_BLIND_SPOTS`로 옮겨 갔고, 그 자리에 파생 면제와 미측정 뿌리가 들어왔다) |
| 사문 대장의 갈래(이름·소스·대장) | 5 / 11 / 0 | **5 / 15 / 2** | ⚠️ **움직였다** — 라운드 88이 *"사라진 것이 아니라 비어 있다"* 고 적어 둔 셋째 갈래에 오늘 둘이 섰다 |
| 계약 전용 데이터 모듈의 면제 | 손으로 적은 **모듈 다섯** | **파생 판정 · 자리 열여덟 / 모듈 여섯** | ⚠️ **움직였다** — 손 목록이 사라지고 판정이 그 자리를 진다(그 목록의 이유 하나는 **거짓**이었다) |
| 앵커 대장(앵커 전수 · code-only · comment-tolerant/래칫 · comment-only/래칫 · unanchored) | 698 · 620 · 70/70 · 8/8 · 0 | **698 · 620 · 70/70 · 8/8 · 0** | **그대로다 — 오늘 움직이지 않은 유일한 자리** |
| 앵커 대장의 면제 | 8 | **8** | 그대로다 |
| 계약 그물 수 | 14 | **15** | ⚠️ **움직였다** — 재개 조건 표기 관례 대장이 **열다섯째**로 섰다(⚠️ 트랙 B의 어드민 표 이름 스윕은 이 수에 들지 않는다: 앱 하나만 걷는 **앱 내 스윕**이다) |
| 프롭 대장 아홉의 출구 / `crossPlatform`이 비어 있지 않은 항목 | {announce 20 · live-region 2} / **하나** | **{announce 21 · live-region 1} / 하나** | ⚠️ **움직였다** — 항목 수는 그대로인데 **출구가 하나 옮겨 갔다**. ⚠️⚠️ **그 한 칸이 이 라운드의 주제다**: 라운드 88의 판정이 만든 값이 라운드 89의 고침이 됐고, 남은 하나는 화면의 결함이 아니라 **그물이 effect 층만 세는 사각**이다 |
| 짝 문서(행 수 · 실기기 · 브라우저 · 서버 · 작업) | 161 · 134 · 17 · 9 · 1 | **163 · 135 · 18 · 9 · 1** | ⚠️ **움직였다** — `#162`(실기기 · 트랙 A) · `#163`(브라우저 · 트랙 B) |
| 접근성 표 | A-29까지 | **A-30까지**(#105) | ⚠️ **움직였다** |
| 접근성 표 C절 C-3 / "수동 증거" 절 | **22 / 19**(갈림 셋) | **23 / 23**(갈림 0) | ⚠️⚠️ **움직였고, 갈림이 닫혔다** — 라운드 88이 이 자리를 *"오늘의 결함"* 이라고 적어 둔 그 둘이고, 오늘 **함께** 올렸다 |

⚠️ **표의 마지막 줄이 이 라운드의 트립와이어 관례에 더하는 것이 하나 있다**: 라운드 88은 그 갈림을
**보고에만** 남겼고 문서에는 값이 되지 않았다 — 그래서 세 라운드를 살아남았다. ⚠️⚠️ **오늘부터 그
자리는 보고가 아니라 계약이 진다**(트랙 E). **트립와이어의 다음 갱신은 사람이 기억해서가 아니라
빨간불이 요구해서 온다.**

**이 라운드가 짝 문서에 남긴 것.** 확인의 표에 **#162~#163 둘**이 서고 §0의 여섯 숫자와 머리말의
재계산 줄이 파싱으로 다시 세어졌으며, 접근성 표에는 **A-30 #105 하나**와 **C-12의 상태 갱신**,
그리고 **C-3의 두 자리 갱신**이 섰다.
⚠️⚠️ **표면 배분은 라운드 88과 같다 — 실기기 하나 · 브라우저 하나이고, 라운드 85·86·87의 *실기기 셋*과
갈린 것이 이번으로 두 라운드 연속이다. 그리고 그 이유가 §0의 수보다 값이 크다**: 줄어든 것은
**확인을 미뤄서가 아니라 다섯 트랙 중 셋이 화면을 한 곳도 열지 않았기 때문**이다(사문 대장의
`export const` 축 · 재개 조건 표기 관례 대장 · 접근성 표의 짝 계약 — 셋 다 **화면 0건 · 문구 0건 ·
렌더 0건**이라 사람이 밟을 자리를 만들지 않는다). ⚠️ **라운드 84가 `실기기` 0건에 대해 세운 그 구분
(*"확인할 것이 없다"* 가 아니라 *"폰에 보이는 동작을 한 곳도 바꾸지 않았다"*)의 넷째 판이고, 두 라운드
연속이라는 사실이 오늘 처음 값이 된다** — 한 번은 그 라운드의 모양이지만 두 번은 **이 저장소의 트랙이
점점 더 자주 계약 층에 선다**는 뜻이다. ⚠️⚠️ **그래도 이 표가 세는 것은 계약의 수가 아니라 사람이
폰이나 브라우저를 잡아야 하는 자리의 수라는 문장은 그대로다.**
⚠️ **A-30이 A-29와 다른 점 하나는 그 절의 머리말이 진다**: 라운드 88의 하나는 *그 자리에 값이 실제로
들어오는가*를 물었고, **이번 하나는 *판정이 값으로 선 자리를 실제로 고쳤는가*를 묻는다.** ⚠️ **기기
조건도 성질이 다르다** — A-28 #103·A-29 #104가 *같은 플랫폼 기기 두 대*를 요구한 데 비해 이 줄은
**서로 다른 플랫폼 한 대씩**이고(결함이 있던 쪽이 iOS이므로), 재료는 **끝난 초대 링크 하나**면 된다.
⚠️ **트랙 B의 어드민 항목은 종전 판정대로 행이 아니라 문단으로 적었다**(브라우저 화면은 그 표의 조건
밖이다) — ⚠️ **다만 그 트랙이 고친 것이 정확히 접근성 축이라는 사실은 문단이 진다**: 이름 없는 표가
둘 이상 선 화면에서 운영자는 *"표"* 를 두세 번 듣고 어느 것이 무엇인지 알 길이 없었다.
⚠️ **트랙 C·D·E는 소스 계약이라 두 표 어디에도 행이 서지 않는다.**
⚠️⚠️ **그리고 `C-12`의 상태가 오늘 바뀐다 — 그 줄의 재개 조건은 *사건형: 이 카드를 여는 트랙이 서는
날*이었고 오늘 트랙 A가 그 날이다.** ⚠️⚠️ **그 줄이 함께 적기로 한 것이 있었다 — *판정과 확인 중
무엇이 먼저였는지* — 이고, 오늘의 답은 **판정이 먼저였다**이다**: 라운드 88 E의 파생 판정이 그 자리를
처음 값으로 만들었고 → 라운드 89 A가 고쳤으며 → **확인은 그 뒤에 온다.** ⚠️ **그래서 그 줄은 오늘도
*미확인*이지만 묻는 것이 달라졌다** — 종전에는 *정말 안 들리는가*(결함의 재현)였고 오늘부터는
*이제 들리는가*(고침의 도달)다. ⚠️⚠️ **C-3(잠금 오버레이 TalkBack 투과)은 오늘로 스물세 라운드째
미확인**이고, ⚠️ **이번 라운드가 그 줄에 더하는 값은 경과 수가 아니라 *그 경과 수를 말하는 두 자리가
세 라운드째 갈려 있었다*는 사실과, **오늘부터 그 갈림을 계약이 센다**는 사실이다.

### AD-1. **판정이 값으로 서는 것과 그 판정이 가리킨 자리를 고치는 것은 서로 다른 라운드의 일이고, 뒤쪽은 배정되지 않으면 오지 않는다** — 관례의 나머지 절반은 아무 데도 적혀 있지 않았다

- **사실.** 라운드 88 트랙 E는 낭독 프롭 대장 둘에 **파생 판정 칸**을 세웠고, 그 판정이 아홉 항목·자리
  스물둘 가운데 **한 자리가 크로스플랫폼 출구 0건**이라는 사실을 처음 값으로 만들었다 —
  `app/family/accept/[token].tsx`의 끝난 초대 카드다(만료·취소·이미 처리된 초대 · 조회 404/400과 수락
  400 셋이 함께 보는 **막다른 길**). ⚠️ **그 카드에는 라운드 79가 건 `accessibilityLiveRegion="polite"` +
  `accessibilityRole="alert"` 프롭 조합만 있었고, 그 조합은 이 저장소 자신의 분류로 안드로이드
  한정이다**(앞은 `@platform android` 프롭이고 뒤에는 VoiceOver의 대응 트레이트가 없다).
- ⚠️⚠️ **그 판정은 옳았고, 그 자리는 그날 한 바이트도 고쳐지지 않았다.** 그리고 그것은 그 트랙의
  잘못이 아니다 — *판정과 수리를 한 라운드에 섞지 않는다*가 이 저장소의 관례이고 **그 트랙의 금지
  조항**이었다(프롭을 빼거나 더하는 제안 금지). ⚠️ **문제는 관례의 나머지 절반이 어디에도 적혀 있지
  않았다는 것이다**: *"그러면 그 수리는 누가 언제 집는가."* 접근성 표 **C-12**가 그 확인을 지고 재개
  조건까지 적어 두었지만(*사건형: 이 카드를 여는 트랙이 서는 날*), **그 조건은 스스로 트랙을 만들지
  않는다.** 조건이 참이 되려면 누군가 그 카드를 열기로 **배정**해야 한다.
- ⚠️⚠️ **그 사이에 이 자리가 다른 스윕에도 서지 않는다는 사실이 함께 값으로 있었다.** 라운드 79의
  저장 실패 낭독 스윕은 모집단을 *저장 실패 문구*의 이름으로 세는데, 이 카드의 문장은 **초대 상태 안내
  상수**다. **판정 칸이 없었으면 오늘도 아무 데도 적혀 있지 않았을 자리**이고, 판정 칸이 있어도
  **배정이 없으면 고쳐지지 않을 자리**였다.
- **오늘의 값 — effect 한 벌과 모듈 함수 하나, 그리고 수 한 칸의 이동이다.** ⓐ `inviteUnavailable`
  갈래에 `announceForA11y` effect가 서고 ⚠️ **그 `if` 조건은 카드의 최내곽 JSX 갈래와 글자로 같다**
  (라운드 88 리뷰 **L-1**이 이름 붙인 사각 — 판정이 두 조건을 **문자열로** 맞춰 보므로 다르면 배선이
  있어도 `live-region`으로 센다. **그 사각의 첫 소비자가 이 자리이고, 트랙의 계약 조항이 그것을 못
  박았다**). ⓑ 낭독 문장은 **카드가 이미 그리는 상수들**을 문구 모듈이 잇는다(화면에 새 한국어 리터럴
  0건 · 눈과 귀가 다른 말을 하지 않는다 · **세션이 있을 때만 서는 한 줄까지 같은 축으로 따라간다**).
  ⓒ **프롭은 한 바이트도 건드리지 않았다**(대장의 `after`가 그 바이트다). ⓓ 파생 판정이 다시 돌아
  출구가 **{announce 20 · live-region 2}에서 {announce 21 · live-region 1}로** 옮겨 갔고, 이유 칸은
  **남은 조용한 자리 하나만** 말하도록 다시 써졌다(⚠️ **낡은 이유가 남으면 그 계약이 빨개진다** —
  라운드 88 E가 세운 조항 그대로). ⓔ 남은 하나는 **화면의 결함이 아니라 그물의 사각**이다(뒤처리 실패
  카드의 낭독이 effect가 아니라 핸들러 안에 있어 이 그물이 `announce`로 세지 못한다).
- ⚠️ **그리고 이 판정은 라운드 88을 나무라지 않는다.** 판정과 수리를 섞지 않는 것은 규율이고, 섞었다면
  그 라운드는 자기가 세운 판정을 자기가 만족시키는 자리에 섰을 것이다. ⚠️⚠️ **문제는 규율의 앞쪽 절반만
  적혀 있었다는 것이다** — 뒤쪽 절반(*다음 라운드가 그 수리를 집는다*)이 값으로 없으면 판정은 라운드를
  건너 살아남고, **살아남은 판정은 다음 사람에게 *이미 처리된 것*처럼 읽힌다**(AB-4가 이름 붙인 그
  착시가 판정 칸에서 한 번 더 나는 모양이다).
- **일반형.** **판정을 세우는 라운드와 그 판정이 가리킨 자리를 고치는 라운드는 다르고, 뒤쪽은 배정되지
  않으면 오지 않는다.** 그래서 판정을 세우는 트랙이 남겨야 하는 것은 판정만이 아니라 **그 수리의 재개
  조건**이고, 그 조건은 *언제*뿐 아니라 **누가 그것을 자기 축으로 삼는가**까지 적어야 한다(→ AD-5).
  ⚠️ **오늘 그 조건이 실제로 집혔다는 사실이 이 판정의 증거다** — 조건이 *"이 카드를 여는 트랙이 서는
  날"* 이라고 **카드를 이름으로** 지목하고 있었기 때문에 정찰이 그것을 후보로 세울 수 있었다.
  ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소의 **판정 칸·사각 칸이 값으로 지목한 자리** 가운데
  **아직 고쳐지지 않은 것이 몇이고, 그중 재개 조건이 *자기를 고칠 트랙*을 이름으로 적은 것이 몇인가**
  (오늘 하나가 그렇게 적혀 있어서 집혔고, 적히지 않은 것들은 오늘도 그대로다).

### AD-2. **한 자리에 이름을 준 라운드의 다음 질문은 "그 화면의 형제 자리는 전부인가"이고, 그 이름의 재료는 대개 화면에 이미 있다** — 그리고 남는 자리를 정하는 것은 접근성이 아니라 옆 계약의 바이트였다

- **사실.** 라운드 88 트랙 A는 어드민 클릭 통계의 추이 표에 `aria-label`을 주면서 그것을 형제 화면
  (분석)과 같은 루프로 물었다 — **옳은 고침이었다.** ⚠️⚠️ **그런데 같은 앱의 `<table>`을 전수로 세니
  열일곱이었고, 이름을 가진 것은 그 둘뿐이었다.** 나머지 **열다섯**은 이름이 0건이었고,
  ⚠️ **한 화면에 이름 없는 표가 둘 이상 서는 자리가 넷**이었다(클릭 통계 둘 · 분석 셋 · 검토 셋 ·
  사용자 조회 둘) — **소리로 훑는 운영자는 그 화면에서 *"표"* 를 두세 번 듣고 어느 것이 무엇인지 알
  길이 없다.**
- ⚠️ **이름을 지을 재료는 대부분 화면에 이미 있었다.** 열다섯 중 대부분이 `<section>` 안에서 바로 위에
  `<h2>`를 갖는다 — **그 `<h2>`에 `id`를 주고 표가 `aria-labelledby`로 가리키면 새 한국어 0글자**이고,
  화면에 보이는 제목과 소리로 들리는 이름이 **같은 문자열**이 된다(두 벌을 두면 그 순간 갈리기
  시작한다). 오늘 그렇게 이름을 얻은 것이 **아홉**이다.
- ⚠️⚠️ **그리고 나머지 여덟이 이 판정의 진짜 값이다 — 정찰은 셋을 예상했고 실측은 여덟이었다.**
  갈린 다섯의 이유는 접근성이 아니라 **읽기 계약의 바이트 앵커**였다: 다른 계약이 그 표의 제목·`id`
  수·반복 구조를 **글자로** 물고 있어서(KPI 퍼널의 `h2` 앵커 · 검토 화면의 `id` 수 핀 · 사용자 조회의
  `map` 반복), `aria-labelledby`로 바꾸면 **그 계약이 먼저 빨개진다.** ⚠️ **즉 이름의 출처를 정한 것은
  화면의 접근성 구조가 아니라 *옆 계약이 무엇을 바이트로 물고 있는가*였다** — 라운드 88 AC-1이
  *"단언으로 적힌 범위는 다음 라운드를 막는다"* 로 이름 붙인 그 모양의 두 번째 판이고, 이번에는
  **막은 것이 아니라 고침의 모양을 바꿨다.**
- **오늘의 값 — 화면 아홉과 스윕 하나다.** ⓐ 어드민의 `<table>` **열일곱이 전부 이름을 갖는다**
  (`aria-labelledby` 아홉 + `aria-label` 여덟). ⓑ 사용자 조회의 두 표는 **사용자 이름을 이름에 실어**
  두 사람을 나란히 펼쳐도 갈린다. ⓒ ⚠️ **보이는 화면은 한 픽셀도 바뀌지 않았다** — 더한 것은 `id`와
  접근성 속성뿐이다. ⓓ ⚠️⚠️ **그리고 이 규율이 처음으로 모집단을 얻었다**: `app/**` 전수에서 `<table`을
  세고 이름이 0건인 것을 모으는 **앱 내 스윕**이 섰다(단언 18). ⚠️ **그 스윕은 계약 그물 열다섯에 들지
  않는다** — 그물 목록은 앱 경계를 넘는 것들이고 이 스윕은 `apps/admin/app/**` 하나만 걷는다.
- ⚠️ **그리고 이 트랙은 S-3을 손대지 않았다.** `app/items/page.tsx`·`app/links/page.tsx`가 **다섯 라운드
  만에** 열렸지만 열린 축은 **표 이름 하나**이고 역할 게이트·폼·저장 경로는 바이트 불변이다 —
  ⚠️ ***"열지 않았다"* 와 *"열었지만 그 축이 아니다"* 는 다른 문장이고, 이월 목록이 그 구별을 진다.**
- **일반형.** **한 자리에 이름(또는 라벨·설명)을 준 라운드가 남기는 질문은 *"그 화면의 형제 자리는
  전부인가"* 이고, 그 질문은 대개 그 라운드가 아니라 다음 라운드의 몫이다.** 그리고 **이름의 재료는
  대개 화면에 이미 있다** — 새로 짓는 한국어가 필요한 자리는 소수이고, 그 소수를 정하는 것은 접근성
  구조가 아니라 **옆 계약이 무엇을 바이트로 물고 있는가**인 경우가 있다. ⚠️ **그래서 전제를 다시 재기
  전에는 트랙의 크기를 알 수 없다**(오늘 셋이 여덟이 됐다).
  ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소의 **접근성 이름이 필요한 구조**(표 말고도
  `role="group"`·랜드마크·목록·다이얼로그) 가운데 **이름이 0건인 것이 몇이고, 그중 바로 위 제목에서
  이름을 파생할 수 있는 것이 몇인가**(오늘 표 열일곱에 대해 답했고, 아홉이 제목에서 나왔다).

### AD-3. **순서를 함께 적은 재개 조건은 실제로 집히고, 순서가 없는 조건은 집히지 않는다** — 오늘 집은 둘이 둘 다 순서를 먼저 적고 있었다

- **사실.** 오늘 집어 든 결정형 재개 조건이 **둘**이다. ⓐ *"계약 전용 데이터 모듈을 뿌리에서 가르는
  판정이 서는 날 — **그날** 이 축이 모집단으로 들어온다"*(사문 대장의 사각 칸 · 트랙 C) ·
  ⓑ *"문서 축을 무는 스윕을 F 밖의 트랙이 소유할 수 있게 되는 날 — 예컨대 **F가 절을 먼저 쓰고 다음
  라운드가 그 계약을 세우는 순서**"*(AC절 기각 · 트랙 D). ⚠️⚠️ **둘 다 조건 문장 안에 *무엇을 먼저*를
  적고 있었고, 그래서 정찰이 전제가 참인지를 싸게 잴 수 있었다** — ⓐ는 `measure(baseDir)`를 돌려
  보는 것이었고, ⓑ는 **AC절이 master에 있는지 보는 것**이었다.
- ⚠️ **같은 표의 나머지 아홉 가운데 순서가 없는 것들은 오늘도 0건 집혔다.** 그중 하나(JSX 사용을
  참조로 세는 판정)는 **전제가 오늘도 참**인데 집히지 않았고, 그 이유는 순서가 아니라 **그물 배정**이다
  (같은 파일에 축 둘을 얹지 않는다). ⚠️ **조건의 성질이 같아도 그 라운드의 구조가 다르면 처분이
  갈린다는 라운드 88의 관찰이 오늘도 그대로 참이다.**
- ⚠️⚠️ **그리고 순서를 적어 둔 값은 집는 날 두 번째로 나타났다.** 트랙 C가 `export const` 축을 들이자,
  라운드 88이 먼저 배운 **주석 마스킹**이 없었다면 **모집단의 사문 마흔 중 스물이 조용히 사라졌을**
  자리가 됐다(그 사각의 수가 9에서 20이 됐다). **순서가 없었다면 축을 넓히는 날 그 그물은 절반이 새는
  채로 초록이었을 것이다** — 라운드 88 AC-3이 *"먼저 마스킹, 그다음 주석"* 으로 적어 둔 그 순서가 한
  라운드 뒤에 **두 번째 배당**을 냈다.
- **오늘의 값 — 닫힌 조건 둘과 그 처분의 모양이다.** ⓐ 사문 대장의 축이 넓어져 항목이 **16에서 22**로
  늘고 래칫이 함께 올라갔다(⚠️ **부채가 아니라 세는 자리가 늘었다**). ⓑ 손으로 적던 면제 목록이
  **파생 판정**으로 바뀌었고(자리 열여덟 · 모듈 여섯), ⚠️⚠️ **그 손 목록의 이유 하나가 거짓으로
  판명됐다** — `SYNC_STATUS_RETRY_ALL_LABEL`은 계약이 읽는 값이 아니라 **화면이 라운드 58에 떠난 사용자
  문장**이라, 판정이 그것을 면제에서 꺼내 대장의 줄로 옮겼다. ⓒ 셋째 갈래(`reason-in-ledger`)가
  **0에서 둘로** 되살아났고(그중 하나는 **테스트조차 부르지 않는다**), ⓓ 닫힌 사각 둘은 지워지지 않고
  `CLOSED_BLIND_SPOTS`로 옮겨 **무엇이 언제 닫았는지**를 값으로 들고 산다.
- ⚠️ **그리고 오늘 이 트랙이 발동시킨 조건 하나는 집지 않고 넘겼다** — 문자열 리터럴 축의 사건형 조건
  (*"참조가 전부 문자열뿐인 export가 0을 넘는 날"*)이 **0에서 넷**이 됐는데, **한 트랙이 한 그물에 축
  둘을 얹지 않는다**는 규율이 그 자리를 다음 라운드로 넘긴다. ⚠️⚠️ **넘기면서 값을 정확히 적은 것이 이
  처분의 값이다**: 그 넷은 **자리 표 축이 이미 면제하는 표**라 문자열 마스킹을 켜도 **대장의 줄은 0이
  는다**. **조건이 도래했다는 사실과 도래해도 대장이 움직이지 않는다는 사실이 같은 자리에 적혀 있다.**
- **일반형.** **재개 조건이 *언제*뿐 아니라 *무엇을 먼저*까지 적어 두면 그것은 조건이 아니라 다음
  라운드의 배정표이고, 그 배정은 실제로 집힌다.** 그리고 **집는 날 그 순서는 두 번 배당한다** — 한 번은
  *집을 수 있게* 하고, 한 번은 *집었을 때 계약이 비어 있지 않게* 한다. ⚠️ **순서 없이 적힌 조건은
  전제가 참이어도 집히지 않는다** — 재는 비용이 높거나(전제를 다시 세워야 한다) 집는 날의 사각을
  아무도 모르기 때문이다.
  ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 오늘 **도래한 채로 넘어간 조건이 몇이고**, 그중
  **그날 무엇을 먼저 해야 하는지가 적혀 있는 것이 몇인가**(오늘 하나가 도래한 채 넘어갔고, 그 하나는
  *문자열 마스킹과 템플릿 갈래를 한 번에* 라고 적혀 있다).

### AD-4. **판정 문서를 무는 계약이 한 줄·한 낱말이면 그 문서의 어느 자리가 낡아도 아무도 모른다** — 그리고 낡은 수는 자기가 낡았다고 말하지 않는다

- **사실.** 라운드 88 AC-5의 답이 전수로 말했다 — 이 저장소가 **문서를 읽어 지키는 계약은 열**이고
  지켜지는 문서는 **스물여섯**인데, **판정 문서 둘을 무는 단언은 각각 한 줄과 한 낱말**이었다:
  `known-limitations.md`(6,285줄)에는 **N-4 문턱 한 줄**, `accessibility-offline-checklist.md`(1,082줄)에는
  **존재 확인과 `"44px"`**. ⚠️⚠️ **오늘 그 두 문서에서 낡은 자리가 하나씩 나왔고, 둘 다 그 얇음이 원인이었다.**
- ⓐ **재개 조건의 표기 관례(AA-3)는 두 라운드를 살아남았지만 어떤 계약도 그것을 보지 않았다.**
  관례는 *"재개 조건(사건형|결정형 · 손은 안|밖)"* 이고 **결정형이면 그 결정을 내릴 손이 어디 있는지를
  함께 적는다**인데, ⚠️ **트랙 D가 이 절이 써지기 전의 문서를 전수로 세니 괄호 바늘의 결정형 열둘 중
  하나가 손의 위치를 적지 않고** 서 있었다(라운드 86 Z-1의 기록 — 관례가 완성되기 직전의 모양이라
  그 대장의 면제 줄이 이유·재개 조건과 함께 진다). ⚠️ **오늘 이 절이 더한 줄들 때문에 그 수는 이미
  올라갔고, 계약이 무는 것은 값이 아니라 하한이라 그 갱신은 초록이다** — **하한만 무는 이유가
  이것이다.**
- ⓑ **접근성 표의 C-3 경과 수는 같은 파일 두 자리에서 세 라운드째 갈려 있었다.** C절의 행은
  **스물두**(67~88)라고 적었고 "수동 증거" 절은 **열아홉**(67~85)에 멈춰 있었다 —
  ⚠️⚠️ **두 자리 다 자기 안에서는 정합이었다**(수사 = 목록 길이). **갈린 것은 *어디까지 적었는가*
  뿐이라 어느 라운드도 그것을 결함으로 읽지 못했고**, 라운드 86·87·88의 트랙 F가 C절만 올리는 동안
  갈림이 셋으로 벌어졌다. ⚠️ **라운드 88 F는 그 사실을 알았지만 *보고에만* 남겼다** — 문서에 값이 되지
  않으면 다음 라운드는 그것을 읽지 않는다.
- **오늘의 값 — 계약 둘과 그 계약의 *모양*이다.** ⓐ 재개 조건 표기 관례가 대장 하나를 얻었다
  (저장소의 **열다섯째** 그물). ⓑ 접근성 표의 C-3 경과 수가 짝 계약 하나를 얻었다
  (`runtime-checklist-shape.test.ts`의 짝 — **그물 수에 들지 않는다**). ⓒ ⚠️⚠️ **그리고 둘 다 하한과
  정합만 문다**: 표기 대장은 *형을 밝힌 자리 수와 손의 위치를 적은 자리 수가 **줄지 않았는가***와
  *결정형이면 손의 위치를 함께 적었는가* 하나뿐이고, 접근성 짝 계약은 *수사가 목록 길이와 같은가 ·
  한 목록이 다른 목록의 접두인가 · 두 목록의 끝 라운드 차이가 셋을 넘지 않는가*를 묻는다.
  ⚠️ **상한이나 전수 일치를 물면 문서를 쓰는 손이 계약을 맞추게 되고, 그 순간 그물은 뒤집힌다** —
  **계약이 문서를 지키는 것이 아니라 문서가 계약을 맞추는 것**이 되기 때문이다.
- ⚠️⚠️ **그리고 순서가 그 뒤집힘을 막았다.** 라운드 88이 이 후보를 집지 않은 이유가 정확히 그
  순환이었고(문서를 무는 계약을 문서를 쓰는 손이 세우면 계약이 아니다), 오늘 그 순환이 끊긴 것은
  **F가 절을 먼저 쓰고 다음 라운드가 그 계약을 세웠기 때문**이다 — 트랙 D·E는 문서를 **읽기만** 했고,
  F(이 절)는 그 계약이 이미 선 뒤에 쓴다. ⚠️ **그래서 오늘 이 절을 쓰는 동안 계약 둘이 실제로 한 번씩
  빨개졌다**: C절만 89로 올린 순간 갈림이 넷이 되어 접근성 짝 계약이 그 갱신을 막았고, 두 자리를 함께
  올려서야 초록이 됐다. **계약이 문서를 지키는 모양이 그날 처음 눈에 보였다.**
- **일반형.** **판정 문서를 무는 계약이 한 줄·한 낱말이면 그 문서의 어느 자리가 낡아도 아무도
  모른다** — 그리고 **낡는 방식은 대개 *틀린 문장*이 아니라 *낡은 수*이고, 낡은 수는 자기 안에서
  정합이라 읽어서는 잡히지 않는다.** ⚠️ **그래서 판정 문서에 계약을 세울 때 물어야 하는 것은
  *무엇이 참인가*가 아니라 *같은 사실을 말하는 자리가 몇이고 그것들이 서로 맞는가*이다.**
  ⚠️⚠️ **그리고 그 계약은 반드시 하한·정합만 물어야 한다** — 문서는 라운드마다 자라므로 상한을 물면
  다음 라운드의 F가 계약을 맞추게 되고, 그러면 그물은 문서를 지키는 자리에서 문서에 지켜지는 자리로
  넘어간다.
  ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소의 판정 문서·확인 문서에서 **같은 사실을 두 자리
  이상에서 말하는 곳이 몇이고, 그중 계약이 그 정합을 세는 것이 몇인가**(오늘 하나에 계약이 섰고,
  `C-12`처럼 아직 경과 수 축이 없는 줄은 그 계약의 사각에 값으로 적혀 있다).

### AD-5. **재개 조건이 "다음 트랙이 서는 날"이면 그 조건은 규율에 막혀 영원히 미도래로 남는다** — 조건은 자기가 누구의 축이 되어야 하는지까지 적어야 한다

- **사실.** 라운드 88은 *행마다 갈리는 낭독 라벨의 모집단*을 기각하며 재개 조건을 이렇게 적었다:
  *"a11y 그물을 여는 다음 트랙이 서는 날."* ⚠️⚠️ **그런데 a11y 그물(`a11y-contract.test.ts`)을 여는
  트랙은 언제나 자기 축이 있다** — 오늘은 트랙 A(끝난 초대 카드의 낭독 판정)이고, 라운드 88에는
  트랙 E(프롭 대장의 판정 칸)였다. **그리고 *한 트랙이 한 그물에 축 둘을 얹지 않는다*는 규율이 그
  라운드마다 이 조건을 막는다.**
- ⚠️⚠️ **즉 조건이 참이 되는 순간이 조건을 집을 수 없는 순간과 같다.** 조건은 자기가 참이 되기를
  기다리는데, 참이 되는 사건이 곧 자기를 막는 사건이다 — **자기 모순이고, 그 사실이 오늘 처음 값이
  됐다**(라운드 88·89 두 라운드가 같은 자리에서 같은 이유로 이 조건을 지나쳤다).
- ⚠️ **이 모순은 조건이 잘못 적혀서가 아니라 *덜 적혀서* 생긴다.** 조건은 **언제**(a11y 그물이 열리는
  날)를 적었고 라운드 88 AC-3의 처방을 따라 **무엇을 먼저**도 적을 수 있었지만, **누구의 축이 되어야
  하는지**를 적지 않았다. ⚠️⚠️ **그런데 이 저장소의 규율은 축의 단위로 작동한다** — 파일이 아니라
  **축**을 하나로 제한하므로, 조건이 자기를 *다른 축의 곁다리*로 적으면 규율이 매번 이긴다.
- **오늘의 값 — 조건 한 줄을 좁혀 다시 적은 것이다.** *"a11y 그물을 여는 트랙의 축이 **바로 이
  모집단**인 라운드가 서는 날 — 즉 그 스윕 자체가 한 트랙의 축이 되어야 한다."* ⚠️ **이 라운드가
  기각을 값으로 남기며 *조건 자체를 고친 것*은 이번이 처음이다**(V-2가 세운 규율은 *조건과 함께
  기각하라*였고, 오늘 그 규율에 한 칸이 더해진다: **조건이 도래할 수 없는 모양이면 그것도 기각의
  일부로 고쳐 적는다**).
- ⚠️ **같은 검산을 오늘의 다른 조건들에도 돌렸다.** 결정형 열하나 가운데 *"그 판정이 서는 날"* 꼴로
  적힌 것들은 **자기가 어느 트랙의 축이 되는지를 함께 적고 있어** 이 모순에 걸리지 않고(오늘 둘이
  그렇게 집혔다), **손이 저장소 밖인 다섯**은 애초에 저장소의 규율이 막는 자리가 아니다(막는 것은
  다른 사람의 결정과 배정이다). ⚠️ **오늘 이 모순에 걸린 조건은 하나뿐이고, 그 하나를 고쳤다.**
- **일반형.** **재개 조건은 *언제*와 *무엇을 먼저*뿐 아니라 *자기가 누구의 축이 되어야 하는지*까지
  적어야 한다.** 조건이 자기를 다른 일의 곁다리로 적으면, 그 조건이 참이 되는 사건이 곧 그 조건을
  막는 사건이 되어 **영원히 미도래로 남는다** — 그리고 그 상태는 *아직 때가 아니다*와 구별되지 않아
  **아무도 이상하다고 느끼지 않는다.** ⚠️ **조건을 적을 때의 검산은 한 줄이면 된다: *이 조건이 참이
  되는 라운드에, 이것을 집을 트랙이 실제로 설 수 있는가.***
  ⚠️ **다음 라운드가 먼저 세어 볼 만한 것**: 이 저장소의 재개 조건 가운데 **자기가 누구의 축이 되어야
  하는지를 적은 것이 몇이고, *다른 트랙이 서는 날* 꼴로 적혀 규율에 막히는 것이 몇인가**(오늘 하나를
  찾아 고쳤고, 그 하나는 두 라운드를 그렇게 서 있었다).
