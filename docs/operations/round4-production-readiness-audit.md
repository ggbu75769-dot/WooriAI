# 라운드 4 Production Readiness 감사

작성: 2026-07-12 · 브랜치: `codex/source-audit-standalone-apk` · HEAD: `6e98011`

라운드 3 보고와 실제 소스를 전수 비교한 결과. 이 문서는 작업 계획의 기준이며, 작성 직후 구현을 시작한다.

## 1. 확인된 사실 (보고 vs 실제)

| 라운드 3 보고 | 실제 코드 상태 | 판정 |
|---|---|---|
| refresh token 1회용 회전·재사용 차단 | `apps/api/src/auth/refresh-token-revocation.service.ts` — **인메모리 jti Map**. 재시작 시 전체 리셋(30일짜리 기존 토큰 전부 재사용 가능). family 무효화 없음. jti 없는 legacy 토큰은 회전 우회. hash 저장 없음 | 부분 구현 (프로토타입) |
| 실제 CSV 파일 선택 및 업로드 | 모바일은 파일명만 전송(`src/api/client.ts:487`). 서버 `createStubImportRows()`가 **파일 내용과 무관하게 하드코딩 3행 생성**(`onboarding-store.service.ts:1484`). 파서 의존성 없음 | 미구현 (스텁) |
| 관리자 CMS | 화면은 존재하나 인증은 **공용 `x-admin-token` 1개**(sessionStorage). RBAC 없음, 관리자 audit log 없음 | 부분 구현 |
| PostgreSQL (schema/migration/seed 존재) | `apps/api/src/`에서 `@prisma/client` import **0건**. 런타임 전체가 인메모리 Map 3종: `OnboardingStoreService`(1,620 LOC, 12개 컨트롤러 주입), `HouseholdRuntimeService`, `AuditLoggerService` | 스키마만 존재, 미연결 |
| release APK 생성 | 생성되나 `scripts/build-android-apk.ts:47`이 **`EXPO_PUBLIC_TEST_LOGIN=1`을 릴리즈에 강제** → 실 API에 도달하는 프로덕션 빌드 경로가 없음. debug keystore 서명 | 데모 빌드 |
| mobile 81 tests | 15파일 중 11파일이 **소스 문자열 `toContain` 검사** — 런타임 동작 검증 아님 | 통과하나 증거력 약함 |
| api 53 / admin 9 / contract 8 tests | 실재하며 인메모리 대상. DB 테스트 0건 | 통과 (DB 미검증) |

## 2. P0 갭 (코드로 해결 가능, 이번 라운드 구현)

1. **DB 영속화 부재** — 인메모리 3서비스를 Prisma 기반으로 교체. 스키마에 누락: `refresh_tokens`, `admin_users`, `disclosures`, `idempotency_keys`.
2. **인증** — refresh token hash 저장·family 무효화·재사용 시 전체 무효화, 로그아웃 전 세션 무효화, legacy 무-jti 토큰 거부.
3. **모바일 세션** — 토큰 평문 AsyncStorage → SecureStore. **refresh/401 처리 자체가 없음** → single-flight refresh 구현.
4. **프로덕션 빌드 경로 부재** — TEST_LOGIN을 env 게이트로 분리, 실 API 빌드 프로필 추가. mock backend는 번들에 남되 test 세션에서만 도달.
5. **import 파이프라인** — 서버 실 CSV/XLSX 파싱(크기·행수·formula injection 방어), 모바일 multipart 업로드, transaction 승인 저장.
6. **관리자 RBAC** — AdminUser 모델(ADMIN/EDITOR/ANALYST) + 로그인 + 서버 authorization + audit log + rate limit.
7. **API 보안 미들웨어 부재** — rate limit, body size limit, security headers, structured logging, request id, redaction.
8. **health/readiness** — DB connectivity 포함 readiness 추가.
9. **운영 스크립트** — backup/restore, bootstrap, docker-compose api 컨테이너 실행 정리.

## 3. P1 갭 (P0 후 진행)

- Idempotency-Key(지출 생성/예산), gift expenseType API 경로, 카테고리 리포트 기간 파라미터(일부 구현됨 여부 재확인), 알림 preference 모델, 접근성.

## 4. 구현 순서

1. Wave 1 (병렬): [A] API Prisma 영속화+인증+RBAC 스키마 / [B] 모바일 세션·secure store·refresh·프로덕션 빌드 경로
2. Wave 2: [C] import 실파싱(서버+모바일 연결), 보안 미들웨어·로깅·readiness
3. Wave 3: 테스트 전체·E2E(실 PostgreSQL)·backup/restore 실증
4. Wave 4: APK 빌드·에뮬레이터 검증·Pixel Lock 재측정·문서·커밋

## 5. 위험 요소

- `OnboardingStoreService` 동기 메서드 → async 전환이 12개 컨트롤러·테스트 전체에 파급. 공개 계약(응답 shape)은 유지.
- 기존 migration(000001_init)과 schema 간 drift 가능성 — 새 migration 생성 시 검증 필요.
- Windows 환경: Docker Desktop 기동 필요, pnpm은 `.toolcache/bin` shim 사용.
- Pixel Lock baseline은 절대 변경하지 않음. UI 변경은 기능 상태에 한정.

## 6. 외부 준비 항목 (사용자, 코드로 해결 불가)

카카오 OAuth 실키, 운영 DATABASE_URL, release keystore, 실 제휴 URL, 운영 서버/도메인/SSL, 법적 운영자 정보, 푸시(FCM)·모니터링(Sentry) 계정. 각 항목은 adapter/env 스키마/문서까지 코드로 완성한다.
