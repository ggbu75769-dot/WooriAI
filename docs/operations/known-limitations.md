# 알려진 한계 (Known Limitations)

갱신: 2026-08-21 (라운드 15 · DOC-116) · 브랜치: claude/app-feature-review-design-xx71k3

라운드 5~15에서 해소된 항목은 근거 파일과 함께 "해소됨" 섹션으로 이동했다. 남은 것은 (A) 외부 계정·키가 필요한 항목, (B) 위험도 낮은 후속 개선, (C) 런타임 재검증, (D) 라운드 13~15에서 새로 확인된 설계 트레이드오프다. 각 항목은 코드 상 근거 경로를 병기한다.

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

## A. 외부 계정·키·계약 (코드로 해결 불가)

| 항목 | 현재 상태 (근거) | 필요한 사용자 조치 |
|---|---|---|
| 실 소셜 로그인 | Kakao는 서버 검증 OIDC 플로(prepare/exchange, JWKS 서명·iss/aud/exp·nonce 검증)와 모바일 플로(AUTH-102)까지 구현 완료 — env 키(`OAUTH_KAKAO_*`, `EXPO_PUBLIC_KAKAO_*`)가 없으면 비활성 (`apps/api/src/auth/kakao/kakao-auth.service.ts`, `apps/mobile/src/auth/kakao-login.ts`). Apple/Google 검증 어댑터는 미구현(`apps/api/src/auth/` 내 부재). dev provider(`/auth/oauth-login`)는 dev/test 한정 (`apps/api/src/auth/auth.service.ts`) | Kakao 콘솔 키 발급 → env 설정. Apple/Google은 검증 어댑터 구현 + 콘솔 키 필요 |
| 운영 PostgreSQL | 로컬 docker/포터블로만 검증됨 (`scripts/db.ts`) | 운영 `DATABASE_URL` 주입 후 `prisma migrate deploy` |
| 릴리즈 서명 keystore | signingConfig 주입은 자동화됨 — config plugin(REL-011)이 `WOORIAI_UPLOAD_KEYSTORE` env 존재 시 release 서명, 부재 시 debug 서명으로 빌드 (`apps/mobile/plugins/with-wooriai-android-release.js`) | 업로드 keystore 발급 + `WOORIAI_UPLOAD_KEYSTORE` 등 env 주입 |
| 실 제휴 링크 | 시드는 비제휴 dev 샘플(`https://example.com/dev/...`, `apps/api/prisma/seed-data.ts` productLinkSeeds) | 제휴 계약 + 관리자 CMS(`apps/api/src/admin/product-link-bulk.controller.ts` 포함)에서 실 URL 등록 |
| 크래시·성능 모니터링 | 구조화 로그 + 모바일 자체 ErrorBoundary만 존재 (`apps/mobile/src/errors/ErrorBoundary.tsx`) — Sentry 등 외부 SDK 미연동(코드베이스에 참조 없음) | Sentry 등 SDK 키 연동 |
| 푸시 알림 (서버 발송 활성화) | 서버 절반은 구현 완료: FCM HTTP v1 발송·토큰 등록 API·예산 경계(80/100%) 디스패치 (`apps/api/src/push/`, `apps/api/src/devices/devices.controller.ts`). `PUSH_ENABLED=1` + `FCM_SERVICE_ACCOUNT_PATH`(유효한 Firebase 서비스 계정 JSON) 없으면 안전한 no-op (`apps/api/src/push/push-config.service.ts`, PUSH-113). 클라이언트 절반 부재는 D 섹션 참조 | FCM(Firebase) 계정 + 서비스 계정 키 발급·env 주입 |
| 법적 운영자 정보 | 정책 문구에 실 사업자 정보 없음(코드베이스에 사업자 등록 정보 부재) | 실 사업자 정보로 교체 |

## B. 후속 개선 (위험도 낮음)

- 도넛 차트 원호는 border-quadrant 기법의 90° 고정 4쐐기 근사 — 조각 수·색은 실데이터와 정합하지만 각 조각의 각도는 비중을 반영하지 않음(범례 %는 실데이터) (`apps/mobile/src/ui.tsx` `DonutChartCard`).
- `isValidCalendarDate` 로컬 복제 — `packages/domain/src/money-date.ts`에 export가 있으나 `apps/mobile/app/expenses/new.tsx`, `apps/mobile/app/expenses/[expenseId].tsx`, `apps/mobile/app/(onboarding)/child-profile.tsx`에 동일 로직이 로컬 정의됨.

## C. 런타임 재검증이 남은 항목

- 노치/펀치홀 Safe Area, 큰 글꼴, 다크모드 강제 기기.
- 실기기(비에뮬레이터) 설치 검증.

## D. 라운드 13~15에서 새로 확인된 한계 (설계 트레이드오프 포함)

- **푸시: 지출 수정·삭제로 인한 경계 이동 미평가** — 예산 경계(80/100%) 푸시는 지출 커밋 직후에만 평가하며 `push_boundary_marks` 클레임으로 (아이, 월, 경계)당 최대 1회 발송(at-most-once). 수정·삭제로 월 합계가 경계 아래로 내려갔다 다시 올라와도 마크가 소멸하지 않아 재발송하지 않으며, 발송 실패 시에도 마크는 남는다 (`apps/api/src/push/push-dispatch.service.ts` 상단 주석 "알려진 한계").
- **FCM 클라이언트 절반 부재** — 서버는 디바이스 푸시 토큰 등록 API(`apps/api/src/devices/devices.controller.ts`)와 FCM 발송(`apps/api/src/push/fcm-sender.service.ts`)을 갖췄지만, 모바일 앱에는 `expo-notifications`가 설치되어 있지 않고(`apps/mobile/package.json` dependencies에 부재) 푸시 토큰 발급·등록 호출 코드가 없다. 실 단말 푸시 수신은 클라이언트 구현 전까지 불가.
- **감사로그 offset 페이지네이션의 페이지 밀림 수용** — 페이지를 넘기는 사이 새 기록이 쌓이면 항목이 밀리는 offset 방식의 한계를 명시적 트레이드오프로 수용함 (`apps/api/src/admin/audit-logs.service.ts`의 "트레이드오프(수용)" 주석).
- **모바일이 `@wooriai/contracts`에 미의존** — API 응답 타입을 `apps/mobile/src/api/client.ts`·`apps/mobile/src/analytics/events.ts`에 수기로 로컬 정의함(각 파일 주석에 명시). 서버 계약 변경 시 컴파일 타임에 잡히지 않고 수동 정합(CON-115 등)에 의존.
