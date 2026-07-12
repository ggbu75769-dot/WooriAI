# 라운드 4 개발 완료 보고

작성: 2026-07-12 · 브랜치: `codex/source-audit-standalone-apk` · 기준: `6e98011` → `c203921` (14커밋, 115파일, +9,593/-1,426)

라운드 3까지 "인메모리 데모"였던 우리아이를 **실 PostgreSQL 기반의 배포 가능한 서비스 구조**로 전환하고, 커머스 카탈로그를 전 연령으로 확장한 라운드다. 모든 항목은 실제 테스트·설치 APK·DB 조회로 검증했다.

---

## 1. 최종 검증 수치 (전부 PASS)

| 항목 | 결과 |
|---|---|
| api 테스트 (실 PostgreSQL) | 22파일 / **82개** PASS, skip 0 |
| mobile 테스트 | 19파일 / **118개** PASS |
| admin 테스트 | 9개 PASS |
| contracts / domain | 8개 / 19개 PASS |
| typecheck (전 패키지) | PASS |
| APK 설치 검증 | production 프로필 APK를 에뮬레이터 설치, 온보딩→지출→홈/기록 반영→재실행 세션 복원 실동작 확인 |
| 데이터 영속성 | API 재시작·에뮬레이터 재부팅 후 데이터 유지 확인 (DB 행 직접 조회 대조) |

---

## 2. 영역별 완료 내용

### 2.1 데이터베이스 — 인메모리 전면 제거 (0a2b766, 6bf4f56)

- **production 경로의 인메모리 저장소 3종을 전부 Prisma/PostgreSQL로 교체**: `OnboardingStoreService`(지출·예산·리포트·준비템·import·동의·고지·클릭), `HouseholdRuntimeService`(가구·멤버·초대), `AuditLoggerService`(감사 로그).
- 스키마 확장: `refresh_tokens`, `admin_users`(+`admin_role` enum), `idempotency_keys`, `disclosures` + 도메인 보강 컬럼. 마이그레이션 000002~000005.
- 시드(멱등 upsert): 카테고리 12종 + 모바일 별칭 9종, 준비템 62종, 상품링크 58개, 고지 3종, 관리자 계정.
- 트랜잭션 적용 지점: 로그인(사용자+가구+멤버), 지출 생성, import 승인(전량 rollback 검증), 초대 수락, 아이/계정 삭제, 준비물 일괄 설정, 토큰 회전.
- 집계: 월/연/누적/카테고리 리포트를 DB groupBy/aggregate로, Asia/Seoul 월 경계·삭제 지출 제외·선물 제외 의미 유지. 홈=기록=리포트 합계 일치 테스트로 강제.
- 로컬 실행: `pnpm db start|migrate|seed|reset|backup|restore|status` (docker compose 우선, Docker 불가 환경은 포터블 PostgreSQL 16 자동 fallback).

### 2.2 인증·세션 (dd93753, 4742a41, 8c80d8b)

- **refresh token 영속 회전**: sha256 해시만 저장, jti+family 단위 관리, 1회용 회전. **재사용 탐지 시 family 전체 무효화**. 동시 사용(double-spend)은 CAS + PostgreSQL advisory lock으로 차단 — 동시성 테스트로 증명.
- 로그아웃 시 family revoke, 계정 탈퇴 시 전체 세션 무효화, 만료 토큰 자동 정리. legacy(무-jti) 토큰 거부.
- **모바일**: 토큰을 평문 AsyncStorage → **SecureStore**로 이동(레거시 평문 1회 마이그레이션 후 삭제). 401 시 single-flight refresh + 1회 재시도(동시 요청은 promise 공유), refresh 실패 시 세션 정리.
- **콜드 스타트 세션 복원 결함 수정**: persist 재수화 완료 전 리다이렉트로 로그인 화면에 떨어지던 버그 — 실기기 검증에서 발견·수정, 3초 안전판 포함.

### 2.3 관리자 CMS (b911f63)

- 공용 `x-admin-token` → **이메일/비밀번호 로그인 + RBAC**(admin/editor/analyst). 비밀번호 scrypt 해시, 로그인 brute-force 제한(email+IP 5회/15분), 타이밍 등화.
- 서버 라우트 가드로 권한 강제: 조회는 전 역할, 준비템/링크/고지 수정은 admin·editor만.
- 감사 로그 영속화: 모든 CMS 변경(before/after)·관리자 로그인 성공/실패 기록.
- 레거시 공용 토큰은 development/test 전용, production은 무조건 403.
- admin 웹앱 로그인 화면 전환. 개발 계정: `admin@wooriai.local` / `wooriai-dev-admin` (production은 env 필수).

### 2.4 엑셀/CSV import 실구현 (305c4d7)

- 파일명만 보내고 하드코딩 3행을 만들던 스텁 → **실제 파일 바이트 multipart 업로드 + 서버 실파싱**.
- CSV: BOM/UTF-8, 깨짐 감지 시 CP949 자동 재해석, 따옴표/개행 안전 토크나이저. XLSX: exceljs, 손상 파일 안전 실패, **압축 폭탄 방어**(행 사전검사+조기 중단).
- 한국어 헤더 자동 탐지(날짜/일자/금액/출금/내용/적요…), 날짜·금액 정규화, 카테고리 키워드 매핑+신뢰도(0.70 미만 기본 미선택), **기존 지출 대비 중복 후보 탐지**, formula injection 무해화, 2,000행/10MB/셀 500자 제한.
- 승인 전 지출 미저장, 승인은 CAS 선점 + 단일 트랜잭션(이중 승인 차단·중간 실패 시 전량 rollback — 테스트 증명). 원본 파일 미보존, 행 내용 로그 미기록.

### 2.5 보안·관측성 (305c4d7, 447b177)

- **Idempotency-Key**: 지출 생성·예산 upsert·import 승인 — 동일 키+동일 요청은 응답 재생, 다른 요청은 409, 동시 요청은 1회만 실행. 요청 경로 포함 해시(교차 리소스 오재생 차단), 예약 60초/완료 24h TTL·만료 회수.
- rate limit(전역 300/min·인증 30/min, body 파싱 전 실행), security headers, 1MB body 제한(413 정합), 요청 로깅(JSON, requestId, 민감정보 미기록), graceful shutdown, `GET /health/ready`(DB 연결 포함).
- 검수로 확인: 가구 간 IDOR 차단(멤버십 매요청 DB 재조회), 토큰/비밀번호 로그 무노출, dev bypass의 production 차단, URL scheme 검증.

### 2.6 커머스 — 전 연령 제품 커버 (f8f460d, 4edb145, c203921)

- **카탈로그 7종 → 62종**: 임신초기 5·중기 8·후기 15·신생아 18·4-6개월 14·7-12개월 17·유아 17·4-7세 11·초등 9·중등 7 (단계 중복 포함). 전건에 필수/편의/선택, 가격대, 필요한 이유, 안 사도 되는 경우(편의/선택 필수 — 테스트로 강제), 중고 가능, 안전·의료 고지. dev 상품링크 55개(제휴/스폰서 표시 혼합).
- **연령 칩 필터 구조 수정**: timingLabel 문자열 완전일치(4세+ 제품이 화면에서 소실) → 아이템 stageCodes 집합 매칭. "24개월+"가 유아~중등을 실제 커버.
- 기본 칩 = 아이 현재 단계 자동 선택(사용자 조작 후엔 미개입), 배너 텍스트 칩 연동. 픽셀락 캡처 조건에서는 기존과 동일 렌더 보장.
- 추천 점수는 단계일치>필수도>상태>예산>관심 — 제휴 수수료율 미반영 원칙 유지.

### 2.7 가계부 (8dc88c8 + 기존 확인)

- 확인 결과 건재: 최근 품목 빠른 재입력, 수정 화면 전 필드(품목/금액/날짜/카테고리/메모) 편집, 검색, 선물 합계 제외, 저장 중복 탭 방지, soft delete.
- 보완 3건: 수정 화면 **선물 토글**, 빠른기록 **draft 보존**(debounce 저장·복원·저장/닫기 시 삭제), 기록 탭 **카테고리 필터**(월 합계 카드는 전체 유지로 홈과 정합).

### 2.8 빌드·운영 (4742a41, 6470a8b, e2c449a)

- APK 빌드 프로필 분리: `standalone`(온디바이스 데모) / `production`(실 API, `EXPO_PUBLIC_API_BASE_URL` 필수, 미설정 시 빌드 거부). cleartext는 10.0.2.2/localhost만 허용(network security config).
- 테스트 전용 DB(`wooriai_test`) 분리 — 테스트 데이터가 dev 앱 화면에 노출되던 오염 차단. globalSetup이 migrate+seed 자동 적용.
- CI에 PostgreSQL 서비스 + migrate + seed 단계, release gate에 DB 기동 단계.
- 운영 문서 신설: local-postgres, database-migrations, database-backup-restore, admin-access, rollback, incident-response, round4-production-readiness-audit, known-limitations(라운드4 갱신).

---

## 3. 커밋 이력 (6e98011 이후, 시간순)

| 커밋 | 내용 |
|---|---|
| 0a2b766 | feat(db): PostgreSQL/Prisma 영속화 기반 |
| dd93753 | feat(auth): refresh 영속 회전·재사용 탐지·family 무효화 |
| b911f63 | feat(admin): 관리자 인증·RBAC·감사 로그 |
| 6bf4f56 | feat(core): 도메인 전체 PostgreSQL 영속화 |
| 4742a41 | feat(mobile): SecureStore·single-flight refresh·빌드 프로필 |
| 6470a8b | chore(ops): DB 스크립트·CI·운영 문서 |
| 305c4d7 | feat(import+sec): 실파싱·Idempotency·rate limit·로깅 |
| 8c80d8b | fix(mobile): 콜드 스타트 세션 복원 |
| e2c449a | fix(test+ops): 테스트 DB 분리·시드 자동화 |
| 447b177 | fix(review): 2차 검수 결함 수정 (idempotency·미들웨어 순서 등) |
| f8f460d | feat(commerce): 카탈로그 62종 확장 |
| 4edb145 | feat(items): 단계 집합 칩 필터 |
| 8dc88c8 | feat(ledger): 선물 토글·draft·카테고리 필터 |
| c203921 | feat(items): 기본 칩 아이 단계 연동 |

원격 push는 하지 않았다.

---

## 4. 사용자가 준비해야 하는 외부 항목

| 항목 | 넣을 위치 |
|---|---|
| 카카오 OAuth 실키 | `OAUTH_KAKAO_CLIENT_ID` 등 env + provider 검증 어댑터 실구현 연결 |
| 운영 DB | `DATABASE_URL` 교체 후 `pnpm db migrate` |
| 릴리즈 keystore | Gradle signingConfig (현 debug 서명) |
| 실제 패키지명 | `com.anonymous.wooriai` 교체(native 재빌드) |
| 실 제휴 링크 | 관리자 CMS에서 등록 (dev 샘플 대체) |
| JWT/관리자 운영 secret | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_SEED_EMAIL/PASSWORD` |
| 모니터링/푸시 | Sentry·FCM 키 |
| 법적 운영자 정보 | 정책 문구 placeholder 교체 |

세부는 [known-limitations.md](known-limitations.md) 참조.

---

## 5. 실행 명령 모음

```powershell
pnpm db start          # 로컬 PostgreSQL (docker/포터블 자동)
pnpm db migrate        # prisma migrate deploy
pnpm db seed           # 시드 (멱등)
pnpm --filter api start:dev            # API (localhost:3000)
pnpm --filter admin dev                # 관리자 웹
pnpm --filter mobile start             # 모바일 (Expo)
pnpm test              # 전체 테스트 (api는 wooriai_test DB 자동)
pnpm release:gate      # 릴리즈 게이트
pnpm android:build-apk --profile production   # 실 API APK (EXPO_PUBLIC_API_BASE_URL 필요)
pnpm db backup / pnpm db restore <file>       # 백업·복구
```

## 6. 남은 작업 (다음 라운드 후보)

- Pixel Lock 9화면 재측정(`pnpm pixel:android`) 및 release gate 전체 1회 실행 — 코드 준비 완료, 실행만 남음.
- backup/restore 실증 기록(qa 문서화), 아이템 상세 화면 reasonText/skipReason 렌더(픽셀락 잠금이라 디자인 승인 필요), 4세+ 세분 칩, 알림 인프라, 온보딩 이어하기.
