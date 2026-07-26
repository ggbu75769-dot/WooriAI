# WooriAI 전체 개발 현황 및 다음 개발 설계 기준선

- 작성 기준일: 2026-07-26 21:55 KST
- 대상 저장소: `F:\WooriAI`
- 문서 목적: 현재까지 구현된 전체 제품·기술 범위, 검증 수준, 미완료 경계, 현재 작업 중 변경을 한 문서에 고정하여 다음 개발 설계의 기준선으로 사용
- 현재 브랜치: `codex/sprint2-catalog-payments`
- 현재 HEAD: `7bc46213ea2ee9b17db4b8259ced8149378b2d74`
- HEAD 커밋: `docs: record current release evidence`
- 판정: **기능 범위가 넓은 로컬 통합 후보 / 현재 dirty source snapshot의 자동·Android 검증 완료 / 운영 출시 전 단계**

---

## 0. 이 문서를 읽는 방법

이 저장소에는 서로 다른 시점의 완료보고서, QA 증거, Android APK, Pixel Lock 결과가 함께 있다. 따라서 다음 네 상태를 섞지 않는다.

| 상태 | 의미 |
| --- | --- |
| 구현됨 | 코드·스키마·화면 또는 계약이 현재 작업 트리에 존재 |
| 현재 소스 검증 | 이 문서 작성 시점의 작업 트리 또는 동일한 소스 스냅샷에서 직접 다시 실행해 확인 |
| 과거 증거 | 이전 소스 스냅샷에서 통과했지만 현재 작업 트리와 정확히 같다고 볼 수 없음 |
| 외부 미검증 | 운영 계정, 실기기, 서명키, 외부 제공자, 스토어, 배포 환경이 없어 로컬에서 완료 판정할 수 없음 |

핵심 결론은 다음과 같다.

1. 제품의 핵심 루프, 모바일 앱, Nest API, Next Admin, PostgreSQL/Prisma 영속화, 오프라인 동기화, 카탈로그, 가족 권한, 개인정보 처리, Release 5 운영 도구까지 폭넓게 구현되어 있다.
2. 현재 작업 트리는 총 66개 경로가 변경되어 있다. 추적 파일 수정 49개, 미추적 17개이며 staged는 0개다. 이 문서를 제외한 65개 경로에는 가족 권한 원자성, 계정삭제 복구, 검증된 안전 대체품목, Today/알림 안전 lifecycle, Android build profile·provenance 강화가 함께 들어 있다.
3. 2026-07-26 현재 소스에서 전체 패키지 테스트는 8/8 패키지, 185개 파일, 1,030개 테스트가 통과했다.
4. 현재 소스에서 전체 Release Gate를 다시 실행해 15/15 PASS로 증거 파일을 갱신했다. install, dependency compatibility, secret/dependency audit, Prisma, lint, typecheck, 전체 테스트, API E2E, Admin browser E2E, production build, strict peers가 모두 PASS다.
5. 현재 소스 스냅샷 `66AF...`에서 Pixel APK를 새로 빌드·설치했고, built/installed hash 일치와 Android Pixel Lock 9/9 PASS를 확인했다. 최악 점수는 `REP-001 = 0.047382`로 임계치 `0.0500` 안이다.
6. 같은 `66AF...` 소스 스냅샷의 정상 standalone APK와 설치된 `base.apk` SHA-256도 `98E43...`로 일치하며, fresh onboarding부터 안전 경고·알림·확인·일반 action snooze·재시작 복원까지 설치 앱 journey가 PASS했다. 다만 테스트 로그인·디버그 서명·임시 package/version이므로 스토어 후보는 아니다.
7. 정규 카탈로그는 구조상 409개까지 확장됐지만 마지막 측정에서 409개 전부 `in_review`, 게시 0개, 판매 오퍼 0개였다. 구조 완성과 운영 게시 준비를 분리해야 한다.

---

## 1. 현재 저장소 기준선

### 1.1 Git 상태

| 항목 | 현재 값 |
| --- | --- |
| 브랜치 | `codex/sprint2-catalog-payments` |
| HEAD | `7bc46213ea2ee9b17db4b8259ced8149378b2d74` |
| upstream 비교 | 0 behind / 0 ahead |
| 브랜치 커밋 수 | 90 |
| Git 추적 파일 수 | 2,193 |
| 전체 변경 경로 | 66 |
| 이 문서 제외 변경 경로 | 65 |
| 추적 파일 수정 | 49 |
| 미추적 경로 | 17 |
| staged | 0 |

`0 behind / 0 ahead`는 HEAD 커밋이 현재 설정된 upstream과 같다는 뜻이다. 아래 65개 로컬 변경 경로와 이 문서는 원격에 포함되지 않는다.

현재 tracked diff 규모:

- 49개 추적 파일
- `+2,893 / -463`
- 미추적 제품 소스·테스트·문서 17개

영역별 변경 경로:

| 영역 | 전체 | 추적 수정 | 미추적 |
| --- | ---: | ---: | ---: |
| `apps/admin` | 3 | 3 | 0 |
| `apps/api` | 26 | 19 | 7 |
| `apps/mobile` | 25 | 16 | 9 |
| `packages` | 2 | 2 | 0 |
| `scripts` | 7 | 7 | 0 |
| `docs` | 3 | 2 | 1 |

### 1.2 현재 작업 환경

| 도구 | 현재 값 |
| --- | --- |
| Node.js | `v25.2.1` |
| pnpm | `11.9.0` |
| npm | `11.6.2` |
| Git | `2.52.0.windows.1` |
| Android 대상 | `emulator-5554` |
| Android 모델 | `sdk_gphone64_x86_64` |
| Android 버전 | 15 |
| 화면 | 1080 × 2340 |
| density | 440 |

저장소의 `packageManager` 계약은 `pnpm@11.9.0`이다. 현재 pnpm은 이 계약과 일치한다.

### 1.3 현재 작업 트리 변경의 성격

현재 미커밋 변경은 단순 UI 조정이 아니다. 다음 다섯 영역을 동시에 건드린다.

1. 가족 소유권·구성원·초대·가족삭제의 동시성 및 감사로그 원자성
2. 계정삭제 7일 유예, 소유권 차단, 취소, 재시도, 접근철회 상태 전이
3. 리콜 품목의 검증된 안전 대체품목 근거·독립 검수·활성화·비활성화
4. 홈 Today Center, 안전 알림 inbox, 확인·snooze·재시작 복원을 잇는 사용자 lifecycle
5. 정상/Pixel/검증 fixture APK 간 환경 오염 방지와 provenance 분리

현재 dirty snapshot에 대한 로컬 검증은 완료됐지만 Git SHA로 고정된 릴리즈 단위는 아니다. 따라서 다음 개발에 들어가기 전에 이 변경을 하나의 명시적 Genesis Cycle 7 기준선으로 commit/PR화하는 것이 우선이다.

---

## 2. 제품 정의와 절대 보존 계약

### 2.1 제품 포지셔닝

WooriAI는 일반 가계부, 쇼핑몰, 커뮤니티가 아니다.

핵심 제품 정의:

> 아이에게 쓴 비용을 기록하고, 성장 시기와 상황에 맞는 준비물을 확인하며, 구매 이후 기록과 준비 상태까지 연결하는 가족 단위 생활 도구

고정 MVP 루프:

```text
지출 기록
  → 누적/기간별 총액 확인
  → 시기별 준비템 확인
  → 구매 링크 선택
  → 구매 후 지출 기록 또는 준비 상태 갱신
```

### 2.2 현재 고정된 하단 탭

현재 계약과 구현은 5개 탭이다.

1. 홈
2. 기록
3. 준비템
4. 리포트
5. 더보기

과거 문서 일부에는 4탭 또는 `프로필` 탭 표현이 남아 있지만, 현재 `AGENTS.md`, 현재 Expo Router 구현, 현재 Pixel Lock은 `더보기`를 포함한 5탭을 기준으로 한다.

### 2.3 변경 금지 핵심

- P0 화면 ID를 임의 변경하지 않는다.
- 추천 순위에 제휴 수수료율을 직접 반영하지 않는다.
- 구매 CTA 인접 위치의 제휴 고지를 숨기지 않는다.
- 스폰서 상품은 일반 추천과 구분한다.
- Excel/CSV 분석 결과를 사용자의 미리보기·확인 전에 지출로 저장하지 않는다.
- 지출 삭제는 soft delete와 audit log를 유지한다.
- 선물 지출은 기본 지출 합계에서 제외한다.
- 가족 역할 `owner / co_parent / viewer / gift_participant`와 권한 원칙을 유지한다.
- 금액은 0보다 큰 원화 정수다.
- 운영 secret, OAuth secret, 제휴 ID, 운영 DB URL을 소스에 넣지 않는다.
- 의료 효능을 단정하지 않는다.

---

## 3. 전체 시스템 구조

```mermaid
flowchart LR
    subgraph Mobile["React Native + Expo 모바일"]
        Router["Expo Router 56 TSX routes"]
        Query["TanStack Query"]
        Local["Zustand + SecureStore + SQLite"]
        Offline["Offline outbox / delta reconciliation"]
    end

    subgraph API["NestJS API"]
        Rest["REST /api/v1"]
        Auth["OAuth / token rotation / RBAC"]
        DomainApi["Expense / Report / Catalog / Family / Privacy"]
        Jobs["Outbox / Publisher / Worker / DLQ"]
    end

    subgraph Admin["Next.js Admin"]
        Cms["Catalog / content / disclosure"]
        Ops["Operations / privacy / Release 5 readiness"]
        Sec["Cookie session / MFA / CSRF / CSP"]
    end

    subgraph Data["Data & external boundaries"]
        PG["PostgreSQL + Prisma"]
        Redis["Redis / BullMQ"]
        Object["S3-compatible object storage"]
        Providers["OAuth / push / merchant / recall providers"]
    end

    Router --> Query
    Query --> Rest
    Local --> Offline
    Offline --> Rest
    Rest --> Auth
    Rest --> DomainApi
    DomainApi --> PG
    Jobs --> PG
    Jobs --> Redis
    Jobs -. external .-> Object
    Jobs -. external .-> Providers
    Cms --> Rest
    Ops --> Rest
    Sec --> Rest
```

### 3.1 모노레포 패키지

| 경로 | 역할 | 주요 기술 |
| --- | --- | --- |
| `apps/mobile` | Android/iOS 모바일 앱 | React Native 0.76.9, Expo 52, Expo Router 4, React Query, Zustand |
| `apps/api` | 제품 API, 운영 API, worker/publisher | NestJS 11, Prisma 6, PostgreSQL, BullMQ, Redis |
| `apps/admin` | 내부 Admin CMS | Next.js 15, React 18 |
| `packages/domain` | 금액·날짜·단계·추천·온보딩 순수 규칙 | TypeScript |
| `packages/contracts` | Zod 기반 공유 API 계약 | Zod |
| `packages/ui` | 공유 UI 패키지 기반 | TypeScript |
| `packages/config` | 릴리즈 설정 계약 | TypeScript |
| `packages/test-utils` | release readiness, Pixel 정규화 등 검증 도구 | Vitest |
| `scripts` | 릴리즈, Android, DB, 카탈로그, Pixel, 증거 생성 | TypeScript/tsx |

### 3.2 현재 코드 규모 지표

| 지표 | 현재 수 |
| --- | ---: |
| 모바일 TSX 라우트 파일 | 56 |
| Admin TSX 화면/레이아웃 | 15 |
| API Nest 모듈 | 26 |
| API 컨트롤러 | 37 |
| API E2E 파일 | 30 |
| Prisma enum | 42 |
| Prisma model | 92 |
| Prisma migration | 41 |
| Mobile 테스트 파일 | 107 |
| API 테스트 파일 | 77 |
| Admin 테스트 파일 | 8 |

---

## 4. 개발 이력 요약

### 4.1 Batch 00~11: MVP 골격 완성

| Batch | 핵심 내용 | 현재 해석 |
| --- | --- | --- |
| 00 | Source Lock, Do Not Change 계약 | 제품·기술·화면 경계의 시작점 |
| 01 | pnpm monorepo, 앱·패키지 부트스트랩 | 현재 구조로 확장됨 |
| 02 | domain/contracts | 현재 API·모바일 공유 계약의 기반 |
| 03 | Prisma schema/seed | 이후 41개 migration, 92개 model로 확장 |
| 04 | API foundation, auth guard, RBAC, 오류 규격 | 현재 `/api/v1` 전반의 기반 |
| 05 | 인증·동의·온보딩 | 이후 Release 5U/5V 및 MOD_V1에서 강화 |
| 06 | 지출·예산·홈·리포트 | PostgreSQL 영속화·Report V2/V3·오프라인까지 확장 |
| 07 | 준비템·상품 링크·제휴 클릭 | canonical catalog/offer/review 구조로 확장 |
| 08 | 가족 초대·RBAC | 현재 Cycle 6 권한 원자성 작업으로 강화 중 |
| 09 | Excel/CSV import preview-confirm | 실제 CSV/XLSX 파싱, 중복/수식 방어까지 확장 |
| 10 | Admin CMS·설정·개인정보 | MFA/CSRF/CSP, privacy workflow로 확장 |
| 11 | QA·release gate·runbook | 현재 15단계 release gate와 Android 증거 체계로 확장 |

### 4.2 Round 4 / Round 5A

주요 발전:

- 전체 핵심 도메인을 Prisma/PostgreSQL 영속화
- refresh token hash 저장, 1회용 회전, 재사용 탐지 및 token family 무효화
- Admin email/password, TOTP MFA, HttpOnly cookie session, CSRF, CSP
- 실제 CSV/XLSX 파싱과 파일 선택
- 지출 낙관적 동시성 `version`
- 모바일 SQLite outbox, 충돌 표시, 재시도, delta sync
- 카카오 OIDC 어댑터·PKCE·state/nonce/replay 방어 구조
- CMS Draft → Review → Publish
- opaque affiliate redirect 및 클릭 기록
- analytics envelope와 PII 차단

### 4.3 제품 재설계 Sprint 0~2

#### Sprint 0

- 데모 fallback과 가짜 성공 상태 제거
- 홈·지출·준비템·리포트의 실제 query/mutation 중심 구조
- Pixel Lock 기준 화면과 Android 캡처 자동화 정비

#### Sprint 1

- 계정 프로필과 자녀 프로필 분리
- 다중 자녀 추가·수정·선택·전환
- 자녀 전환 시 홈·지출·준비템·리포트·예산 query 무효화
- 기존 단일 자녀 저장 데이터를 다중 자녀 구조로 승격
- 비로그인·자녀 미선택 딥링크 가드

#### Sprint 2

- 사용자 결제수단 CRUD, 기본값 1개, 비활성화 후 과거 지출 연결 보존
- 최근 90일 빠른 지출 프리셋
- 민감 카드·계좌 숫자열 입력 방어
- 자녀 성별 선택·직접입력·비우기
- 준비템 콘텐츠와 상품 링크 확대
- 카탈로그 validate/coverage/DB upgrade 검증

### 4.4 Release 3

- API main/publisher/worker 분리
- transactional outbox, retry/cancel, dedupe, DLQ
- remote config, notification preference, support/trust
- privacy export/deletion 상태 머신
- 구조화 로그, internal metrics, rate/MFA attempt limit
- Android AAB/APK 빌드 계약과 production config fail-closed

### 4.5 Release 4 / 4C~4I

- 24 domain / 120 category / 360 subcategory의 정규 카탈로그 구조
- canonical item, alias, lifecycle, context, source, safety, review, revision, approval 분리
- KST 서버 소유 리포트 기간과 Report V2/V3
- catalog import preview/apply/error CSV
- taxonomy 영향 미리보기·재정렬·archive
- catalog workflow queue, report resolution, link health
- notification, remote config, scheduler, publisher/worker 복구
- local staging parity와 실패 주입 검증

### 4.6 Release 5 / 5U / 5V

- legal/catalog/pilot readiness
- Today, preparation calendar, custom bundle, weekly briefing
- receipt 기반 보조 지출, 반복 지출 예측, 지출-품목 연결
- merchant feed, recall provider, safety alert
- onboarding draft scope·멱등·원자적 완료
- account/household/child scope 격리
- claim-to-source 증거 및 source snapshot
- production fixture contamination 방지

### 4.7 MOD_V1

- 현재 5탭 정보구조
- 공통 디자인 시스템과 48dp 터치 영역
- 3개 가시 단계 온보딩
- 기본 월 예산 500,000원
- Android native date picker
- HOME/기록/준비템/리포트/프로필·더보기 재정비
- 큰 글꼴, TalkBack bound-service/focus smoke
- 준비템 상품명 대신 카테고리명 중심 표현

### 4.8 2026-07-25 통합 하드닝

커밋된 최신 기준선의 주요 내용:

- Node/pnpm/CI/release gate 및 테스트 파티션 하드닝
- Android 빌드 source snapshot과 native branding 검증
- 준비템 HTML parity와 grouping
- Admin catalog/operations 강화
- 모바일 first-render 모듈 경계 단순화
- SQLite offline store, delta reconciliation, sync continuation
- purchase follow-up 상태 저장과 제휴 링크 orchestration
- 로그아웃 시 세션·저장소·구매 상태 정리
- 앱 아이콘·스플래시·성장 단계 이미지 정비

### 4.9 현재 미커밋 Cycle 5·6 및 Genesis Cycle 7

현재 작업 중인 변화:

- Cycle 5: 검증된 안전 대체품목과 공개 근거 URL 정책
- Cycle 6: 가족 권한 lifecycle 원자성, 계정삭제 차단·취소·재시도, fixture/normal APK 분리
- Genesis Cycle 7: 안전 경고를 홈 Today Center, 알림 inbox, 준비템 context, 확인 상태와 연결하고 일반 recurring/replacement action의 snooze 및 재시작 복원을 완성

이 부분은 아래 14장에서 상세히 다룬다. 현재 dirty source snapshot `66AF...` 기준으로 Release Gate 15/15, standalone 설치 journey, Pixel Lock 9/9까지 통합 검증됐다.

---

## 5. 모바일 앱 상세 현황

### 5.1 라우팅과 화면

현재 `apps/mobile/app`에는 56개 TSX 라우트가 있다.

주요 그룹:

- 인증: 로그인, Kakao callback
- 온보딩: 상태 선택, 임신/출생/직접 단계, 자녀 프로필, 준비물, 예산, review, resume
- 5탭: 홈, 기록, 준비템, 리포트, 더보기
- 자녀: 목록, 추가, 수정
- 지출: 신규, 상세 수정
- 준비템: 목록, 상세, 달력, custom bundle
- 가족: 구성원, 초대, 초대 수락
- Excel/CSV: 업로드, 분석/미리보기
- 설정: 프로필, 알림, 개인정보, 동기화 상태
- Release 5: 영수증 입력, weekly briefing, report source
- Pixel Lock: deterministic fixture screen

### 5.2 인증·세션

구현:

- SecureStore 기반 access/refresh token 저장
- 기존 AsyncStorage token의 1회 migration
- single-flight token refresh
- refresh 응답 손실·재시도와 세션 scope 방어
- logout 시 token, selected child, query cache, 로컬 fixture, 구매 follow-up 상태 정리
- standalone 테스트 로그인과 실제 세션의 명시적 분리
- 프로덕션 빌드에서 test login/fixture가 켜지지 않도록 경계 테스트

현재 외부 경계:

- 실제 Kakao 콘솔·운영 키·실 사용자 end-to-end는 미검증
- Apple 로그인은 실제 provider/native/server 구현이 없어 성공으로 표시하지 않음
- Google 로그인도 운영 자격증명과 runtime 검증 없음

### 5.3 온보딩

구현:

- 임신, 출생, 직접 단계 선택
- KST date-only 규칙
- scoped onboarding draft v3
- 사용자/가족 scope 변경 시 오래된 draft 차단
- 준비물 상태 `SELECTED / SKIPPED / COMPLETED_NONE` 구분
- 기본 월 예산 500,000원
- 3개 가시 단계 UX
- 마지막 제출 시 멱등키 고정, single-flight, atomic API completion
- 완료 전 자녀/profile을 미리 생성하지 않는 계약
- 재시작 후 현재 단계 복원
- 자녀 선택과 query cache 갱신

검증:

- domain/mobile/API 계약 테스트
- Android 설치 앱 온보딩 walkthrough 증거
- native date picker 사용

남은 외부 검증:

- 실제 운영 OAuth 이후 온보딩
- 저사양 실기기
- 전체 TalkBack 순차 탐색과 한국어 음성 청취 품질

### 5.4 홈

구현:

- 선택된 자녀 요약
- 월 예산, 사용액, 잔액
- 빠른 기록 진입
- 최근 지출
- 준비템 추천·진행 상태
- 동기화 상태
- 자녀 전환 및 계정/프로필 진입
- loading/empty/error/offline 상태

데이터 경계:

- 실제 세션은 API query
- standalone 내부 검증은 명시적 fixture backend
- 프로덕션에서 fixture 데이터 사용을 차단하는 테스트 존재

### 5.5 지출·예산·결제수단

구현:

- 수동 지출 생성·조회·수정·soft delete
- positive KRW integer
- 미래 날짜 차단
- gift/refund/support 분리
- 결제수단 선택과 사용자별 기본값
- 과거 지출의 비활성 결제수단 연결 보존
- 최근 90일 빠른 지출 프리셋
- 빠른 지출에서 과거 금액 자동 복사 금지
- Idempotency-Key
- optimistic concurrency `version`
- 오프라인 생성·수정·삭제 큐
- 충돌 후 서버/로컬 선택과 재조정

검증:

- DB transaction rollback
- 동일 idempotency key 동시 요청
- version conflict
- create/update/delete 후 홈·리포트 합계 일치
- gift 제외

### 5.6 오프라인 및 동기화

구현:

- SQLite 기반 오프라인 저장소
- memory fallback
- outbox merge
- single-flight flush
- flush 중 추가 mutation의 후속 drain
- delta pull runner
- tombstone/변경 reconciliation
- legacy schema upgrade와 실패 시 rollback
- account/household/child scope 격리
- pending/syncing/offline/conflict/synced 표시
- 세션 전환 시 오래된 delta와 query 차단

남은 검증:

- 실제 느린 네트워크·장시간 offline·대용량 사용자 데이터
- 운영 API와의 다중 기기 수렴
- 물리기기 process death 중 SQLite/네트워크 복구

### 5.7 준비템·추천·구매 후속

구현:

- 자녀 단계·산모 단계·context 기반 준비템
- 맞춤/전체/내 준비함
- 상태 변경 및 query invalidation
- 필요 이유, 안 사도 되는 경우, 안전 주의, 중고/대여 정책
- product link와 sponsored/affiliate 표시
- 제휴 click 기록
- opaque redirect
- 구매 후 지출 또는 준비 상태 연결
- purchase follow-up store와 session boundary
- commission-independent ranking

현재 주의:

- canonical 필요품목과 판매 가능한 product offer는 별도 모델이다.
- 제품이 필요하다는 판단과 구매 링크가 있다는 사실을 동일시하면 안 된다.
- published-only/fail-closed 정책을 유지해야 한다.

### 5.8 가족

구현:

- 구성원 목록
- 역할별 초대
- 초대 preview/accept
- owner-only 초대 생성
- co-parent 지출 작성
- viewer 읽기 전용
- gift participant 제한
- 구성원 제거
- 소유권 이전
- 가족 나가기
- 가족 삭제

현재 Cycle 6 강화:

- 동시 소유권 이전/구성원 제거/나가기/초대 수락/가족 삭제 충돌 직렬화
- 소유자가 남지 않는 상태 방지
- archive된 가족에 구성원이 활성화되는 상태 방지
- 권한 변경과 감사로그를 같은 transaction으로 묶음
- 정확한 blocking household로 이동
- stale target을 명확한 오류 코드로 처리

### 5.9 Excel/CSV 가져오기

구현:

- expo-document-picker
- multipart 업로드
- CSV/XLSX 파싱
- CP949 처리
- 10MB/2,000행 제한
- formula injection 방어
- duplicate 후보
- confidence 기반 기본 선택
- row 수정/선택
- preview-before-save
- confirm 시에만 expense 생성
- 오류 CSV

남은 범위:

- 운영 object storage
- 실제 대용량/악성 파일 부하 테스트
- Excel export 제품 기능

### 5.10 알림·주간 브리핑·보조 기능

구현:

- notification preference
- marketing opt-in timestamp
- device token 계약
- notification delivery/attempt 모델
- critical safety notification과 일반 알림의 중요도·아이콘·테두리 구분
- 알림 category/navigation metadata를 이용한 정확한 child/item/preparation context 이동
- Today action
- 안전 확인 action은 숨기거나 snooze할 수 없도록 고정
- 일반 due/replacement/recurring action은 다음 날까지 snooze
- optimistic response와 authoritative server response의 version 비교
- 앱 재시작 후 acknowledgement·snooze·replacement 상태 복원
- preparation calendar
- custom bundle
- weekly briefing
- receipt draft/confirmation
- report source
- support reason code

외부 경계:

- 실제 FCM/APNs provider
- 운영 스케줄러
- 실제 수신·딥링크·알림 권한 실기기 검증

---

## 6. API 상세 현황

### 6.1 API 기본

- Base path: `/api/v1`
- NestJS 11
- DTO validation
- 공통 오류 envelope
- request ID 및 구조화 로그
- body size 제한
- security headers
- rate limit
- idempotency interceptor
- auth/role guard

### 6.2 현재 모듈

26개 Nest 모듈:

- admin
- analytics
- app-config
- auth
- catalog-v2
- audit
- object storage
- finance
- health
- households
- imports
- items-commerce
- jobs
- legal
- metrics
- notifications
- onboarding
- presets
- prisma
- privacy
- release5
- settings
- sync
- trust
- app root

### 6.3 인증과 보안

구현:

- OAuth identity 정규화
- Kakao provider adapter
- PKCE/state/nonce/replay 방어
- refresh token hash 저장
- rotation과 reuse detection
- concurrent refresh CAS
- production dev-auth 차단
- Admin password + TOTP MFA
- recovery code
- cookie session
- CSRF
- nonce CSP와 `frame-ancestors 'none'`
- SSRF/private IP/redirect 방어
- 공개 HTTPS URL 정책

현재 Cycle 5의 공개 URL 정책은 다음을 차단한다.

- HTTP
- loopback
- private IPv4
- link-local
- private/reserved IPv6
- userinfo
- 비표준 공개 근거 경로
- 파싱 불가능 URL

모바일은 서버가 준 URL을 열기 직전 다시 검증한다.

### 6.4 지출·리포트

구현:

- expense CRUD
- soft delete + audit
- version concurrency
- budget
- monthly/cumulative/category/yearly report
- KST 기간
- report maturity
- source traceability
- payer/gift/refund/support 분리
- aggregate 모델

### 6.5 Worker와 운영

구현:

- transactional `job_outbox`
- 별도 publisher/worker entry
- BullMQ/Redis 경계
- dedupe
- retry/cancel
- lease recovery
- dead letter queue
- processed job
- schedule handler
- provider acknowledgement loss reconciliation

외부 경계:

- 운영 Redis
- 운영 worker scale
- 실제 provider
- 장애 대시보드와 alert

---

## 7. Admin CMS 상세 현황

### 7.1 현재 화면

15개 TSX 화면/레이아웃:

- dashboard
- catalog
- items
- links
- disclosures
- clicks
- operations
- privacy
- account deletion
- data export
- legal terms
- support
- reviews
- Release 5 readiness

### 7.2 보안

구현:

- client-held Bearer/localStorage token 사용 금지
- cookie session
- password 1단계 + TOTP/recovery code 2단계
- MFA setup QR/manual key
- recovery code 1회 표시
- CSRF header
- 401 시 session clear 및 로그인 이동
- same-origin `/api/v1` proxy
- CSP nonce
- X-Frame-Options
- X-Content-Type-Options

### 7.3 카탈로그 운영

구현:

- item template 생성/수정
- product link 생성/수정
- disclosure 관리
- affiliate click summary
- canonical item review/publish workflow
- revision/approval/history
- rollback은 새 draft revision으로만 수행
- taxonomy tree, archive 영향 preview, exact-sibling reorder
- 구조/coverage/operations queue
- bounded JSON/CSV/XLSX import preview/apply
- 오류 CSV
- 신고 batch 해결
- 지원되는 link health retry

### 7.4 Release 5 readiness console

구현:

- legal candidate preview
- evidence source 생성
- 독립 evidence 검수
- pilot worklist/manifest preview
- recall worklist
- merchant feed preview
- 안전 대체품목 비활성 mapping
- 독립 검수 후 세 번째 담당자 활성화
- 즉시 비활성화

중요:

- Admin 화면에 버튼이 있다는 이유만으로 운영 publish가 완료된 것은 아니다.
- 현재는 fail-closed 운영 준비 도구이며, 실제 사람의 승인·법무·외부 provider가 필요하다.

---

## 8. 데이터베이스와 도메인 모델

### 8.1 현재 스키마 규모

| 항목 | 수 |
| --- | ---: |
| migration | 41 |
| enum | 42 |
| model | 92 |

### 8.2 주요 도메인 그룹

#### 사용자·인증

- User
- OAuthIdentity
- RefreshToken
- UserDevice
- AdminUser
- AdminSession
- OauthTransaction

#### 가족·자녀

- Household
- HouseholdMember
- HouseholdInvite
- Child
- MotherProfile
- PreparationContextProfile

#### 회계

- Expense
- Budget
- UserPaymentMethod
- QuickExpensePreset
- ExpenseCategoryV2
- ReportDailyAggregate
- ReceiptDraft
- ReceiptConfirmation
- ExpensePlanLinkEvent

#### 준비템·카탈로그

- ItemTemplate
- ItemTemplateStage
- ChildItemStatus
- ItemDefinition
- CatalogNode
- ItemDefinitionCategory
- ItemLifecycleRule
- ItemContextRule
- ItemAttribute
- ItemEvidenceSource
- ItemSafetyRule
- ItemAlternative
- ItemDependency
- ItemBundle
- ItemBundleMember
- ItemSynonym
- CatalogItemRevision
- CatalogItemApproval
- CatalogItemWorkflowEvent
- CatalogCoverageDecision
- CatalogItemReport

#### 커머스

- ProductLink
- ProductOffer
- ProductLinkHealth
- AffiliateClick
- MerchantFeedImport
- MerchantFeedRow
- RecallProviderEvent

#### 사용자 준비 상태

- UserItemPlan
- UserItemPlanHistory
- UserItemPlanComment
- CustomPreparationBundle
- CustomPreparationBundleItem
- CustomBundleApplication

#### Import

- ImportJob
- ImportRow
- CatalogImport

#### 개인정보·법무·감사

- Consent
- LegalDocument
- ConsentEvent
- PrivacyRequest
- PrivacyRequestEvent
- Attachment
- AuditLog
- ContentRevision

#### 운영

- JobOutbox
- DeadLetterJob
- ProcessedJob
- NotificationPreference
- NotificationDelivery
- NotificationDeliveryAttempt
- RemoteConfig
- RemoteConfigRevision
- ServiceInstanceHeartbeat
- SupportReport
- ReportIntegrityCheck
- AnalyticsEvent

### 8.3 반드시 분리해야 하는 네 데이터 계층

다음은 이름이 비슷하지만 설계상 서로 다른 개념이다.

| 계층 | 의미 | 대표 모델 |
| --- | --- | --- |
| 기존 앱 준비템 | 화면·legacy 호환 중심 template | `ItemTemplate`, `ProductLink` |
| 정규 필요품목 카탈로그 | 생활 필요성과 근거 중심 canonical item | `ItemDefinition`, lifecycle/context/evidence |
| 판매 오퍼 | 실제 판매처·재고·리콜·승인 | `ProductOffer`, `MerchantFeed*` |
| 사용자 준비 상태 | 특정 가족/아이의 계획과 상태 | `UserItemPlan`, `ChildItemStatus` |

다음 개발에서 이 네 계층을 하나의 `item` 테이블이나 DTO로 다시 합치면 안 된다.

---

## 9. 카탈로그 현재 상태

### 9.1 마지막 정규 카탈로그 감사

마지막 저장된 감사 시점:

- 생성일: 2026-07-21 KST 근처
- 감사 소스 HEAD: `46c5d55584d8b839600d0198ac7e28a242cae69f`
- 현재 HEAD 이전 스냅샷이므로 수치는 **마지막 측정값**이다.

| 항목 | 마지막 측정 |
| --- | ---: |
| domain | 24 |
| category | 120 |
| subcategory | 360 |
| canonical item | 409 |
| alias | 3,287 |
| high-risk item | 85 |
| context rule | 495 |
| distinct context | 25 |
| item status | `in_review` 409 |
| published | 0 |
| product offer | 0 |
| orphan | 0 |
| duplicate canonical name | 0 |
| alias collision | 0 |
| unsafe published item | 0 |

판정:

- 구조 완전성: PASS
- scenario personalization 구조: PASS
- published content readiness: FAIL

### 9.2 현재 제품 설계에 주는 의미

- “409개 준비템 구현”은 “409개 운영 추천 게시”가 아니다.
- 85개 high-risk 품목은 전문 검수와 독립 승인 없이 노출하면 안 된다.
- 판매 오퍼 0개이므로 canonical 필요품목과 실제 구매 가능성을 분리해서 UX를 설계해야 한다.
- 게시 가능한 콘텐츠가 부족하면 앱은 fixture나 `in_review` 데이터를 운영 사용자에게 보여주는 대신 정직한 빈 상태를 보여야 한다.
- 다음 개발 설계 전에 현재 HEAD/현재 DB로 catalog audit를 다시 생성해야 한다.

---

## 10. 디자인 시스템과 접근성

### 10.1 현재 코드의 실사용 토큰

현재 코드:

- Primary: `#C94627`
- Canvas/background: `#FFFDFC`
- Text primary: `#211E1C`
- 공통 spacing/radius/type/motion token
- chart palette 별도

### 10.2 문서 계약 충돌

`docs/dev/source-lock.md`와 `docs/dev/do-not-change.md`에는 과거 Phase 2 토큰이 남아 있다.

- Primary: `#FF8A7A`
- Background: `#FFF8F1`
- Text: `#242424`

반면 MOD_V1 문서와 현재 코드, 최신 native branding은 `#C94627 / #FFFDFC / #211E1C`를 사용한다.

이것은 다음 개발 설계 전 반드시 결정해야 할 문서 거버넌스 문제다.

권장 결정:

1. 현재 코드·현재 Pixel reference를 canonical로 승인
2. Source Lock/Do Not Change의 색상 토큰을 새 버전으로 명시적 갱신
3. legacy 토큰은 alias/마이그레이션 기록으로만 유지

색상 충돌을 방치하면 다음 개발자가 오래된 문서를 따라 현재 UI를 되돌릴 위험이 있다.

### 10.3 접근성 구현

구현:

- 48dp 중심 touch target
- accessibility role/label/state
- expanded/collapsed 상태
- live region
- alert
- chart와 접근성 데이터 표의 동일 source
- font scale 1.5 대응
- reduce motion 경계
- 320~840dp source contract
- TalkBack bound-service/focus smoke

남은 검증:

- 한국어 발화 인간 청취
- 전체 화면 순차 탐색
- 실제 노치/펀치홀
- 물리기기 320/480/840dp 대표 화면
- 다크모드 강제 상태의 의도된 처리

---

## 11. 보안·개인정보 현황

### 11.1 구현된 보안

- 운영 secret fail-fast
- dev auth production 차단
- password/MFA rate limit
- refresh token rotation/reuse family revoke
- cookie/CSRF/CSP Admin
- request body limit
- secret scan
- production dependency audit
- SSRF/private IP/redirect 차단
- URL scheme/공개 HTTPS 검증
- CSV formula injection 방어
- PII analytics envelope 차단
- 구조화 로그 redaction
- forbidden mobile storage/permission audit
- `allowBackup=false`
- cleartext traffic 차단

### 11.2 개인정보 기능

구현:

- versioned legal docs
- append-only consent event
- export request
- deletion request
- 7일 grace
- grace 중 cancel
- 기한 후 접근철회
- processor queue/purge/retained exception/completed/failed 상태
- 현재 삭제 요청 조회
- public status token 경계
- Release 5 데이터셋 export/delete disposition

현재 Cycle 6:

- 소유 중인 가족이 남아 있으면 삭제를 fail-closed
- 어느 가족이 차단하는지 반환
- 접근을 철회하지 않은 채 `failed / OWNER_TRANSFER_REQUIRED`
- 소유권 이전 후 즉시 retry
- 차단 상태에서도 cancel
- 처리 단계에서는 cancel과 신규 삭제 버튼 숨김

### 11.3 법무·운영 외부 경계

- 개인정보 처리방침 실 사업자 정보
- 아동/가족 데이터 정책 승인
- 제휴/스폰서 고지 법무 승인
- 의료·안전 문구 전문 검수
- 실제 export 보관·암호화·삭제 processor
- 운영 데이터 보존 예외 승인

---

## 12. 테스트와 품질 게이트

### 12.1 현재 소스에서 실행한 전체 테스트

실행:

```powershell
pnpm test --concurrency=1 --force
```

결과:

| 패키지 | 파일 | 테스트 | 결과 |
| --- | ---: | ---: | --- |
| admin | 8 | 36 | PASS |
| @wooriai/ui | 1 | 1 | PASS |
| @wooriai/config | 1 | 3 | PASS |
| @wooriai/test-utils | 3 | 26 | PASS |
| @wooriai/domain | 12 | 78 | PASS |
| @wooriai/contracts | 5 | 41 | PASS |
| mobile | 107 | 614 | PASS |
| api | 48 | 231 | PASS |
| 합계 | 185 | 1,030 | PASS |

검증 해석:

- Release Gate 안에서 `pnpm test --concurrency=1 --force`를 실행해 PASS
- Gate 기록상 전체 테스트 단계 약 2분 23초
- 직후 동일 source hash의 Turbo cache replay에서도 같은 185개 파일/1,030개 테스트 PASS 확인
- 8/8 패키지 성공

### 12.2 현재 소스의 가족 권한 집중 DB 테스트

실행:

```powershell
pnpm --filter api exec vitest run --config vitest.e2e.config.mts test/household-authority-lifecycle.db.test.ts
```

결과:

- 1 file
- 10 tests
- PASS
- PostgreSQL `wooriai_test`
- 41 migrations, pending migration 0

검증된 동시성:

- transfer vs remove
- transfer vs leave
- delete vs invite accept
- invite create vs delete
- privacy activation vs invite accept
- privacy activation vs ownership transfer
- privacy activation vs household delete
- 감사로그 실패 시 권한 변경 rollback

### 12.3 현재 소스의 안전 대체품목 테스트

전체 API 테스트에 포함되어 실행됨:

- `release5-safety-alternatives.db.test.ts`
- 19 tests
- PASS

검증:

- 근거 캡처자와 검수자 분리
- 세 번째 활성화 담당자
- exact alternative claim
- review due/expiry
- stale evidence fail-closed
- 동시 approve/reject 단일 winner
- mapping transaction + audit rollback
- role/household privacy
- serialization retry

### 12.4 저장된 최신 전체 Release Gate

증거 파일:

- `docs/qa/evidence/latest-release-gate.json`
- `docs/qa/evidence/latest-release-gate.md`
- 생성: `2026-07-26T10:53:52Z` = 2026-07-26 19:53 KST

결과:

| Gate | 저장된 결과 |
| --- | --- |
| install | PASS |
| mobile dependency compatibility | PASS |
| env example | PASS |
| secret scan | PASS |
| production dependency audit | PASS |
| Prisma validate/generate | PASS |
| DB start | PASS |
| lint | PASS |
| typecheck | PASS |
| all tests | PASS |
| API E2E | PASS |
| Admin browser E2E | PASS |
| production build | PASS |
| strict peers | PASS |

현재 해석:

- 현재 dirty source snapshot에서 전체 15단계 Gate가 PASS다.
- test 단계는 `--force`로 실행되어 8/8 패키지, 185개 파일, 1,030개 테스트가 통과했다.
- API E2E와 Admin browser E2E도 같은 Gate 실행에서 통과했다.
- 이는 로컬 통합 후보 증거이며, clean commit/CI, production 배포, 실제 OAuth, store signing, backup restore, closed beta 안정성을 증명하지는 않는다.

### 12.5 현재 품질 상태 요약

| 범위 | 상태 |
| --- | --- |
| current unit/integration package tests | PASS |
| current authority concurrency focused DB | PASS |
| current API E2E | PASS |
| current Admin browser E2E | PASS |
| current full release gate | 15/15 PASS |
| current exact-source Android Pixel 9-screen | 9/9 PASS |

---

## 13. Android·APK·Pixel Lock 현황

### 13.1 APK 보관 규칙

모든 최종 APK는 프로젝트 루트 `F:\WooriAI`에 둔다.

`artifacts`에는 다음만 둔다.

- JSON/Markdown report
- adb screenshot
- diff/heatmap
- UIAutomator XML
- logcat
- provenance

### 13.2 현재 정상 standalone APK

| 항목 | 값 |
| --- | --- |
| APK | `wooriai-0.0.0-release-standalone.apk` |
| SHA-256 | `98E43EEF980F98CFFAB51372019958375CCE9B04F97DE6E3F52FBB979B86794F` |
| bytes | 79,551,462 |
| source snapshot | `66AF661F1B6364CB60D198ACC74201F52421C9C98064039DA5CAD9E90F49CCCC` |
| source files | 960 |
| native explicit files | 75 |
| source verification | `VERIFIED_STABLE` |
| generated/embedded bundle | `36918F38EF052CBBF877575C9DA74FF392E3E174460BB8E82C2A3A138605193C` 일치 |
| package | `com.anonymous.wooriai` |
| version | `0.0.0` |
| versionCode | 1 |
| signing | debug-internal-only |
| ABIs | armeabi-v7a, arm64-v8a, x86, x86_64 |
| test login | enabled |
| Pixel fixture | disabled |
| authority fixture | disabled |
| safety fixture | disabled |

설치 검증:

- built APK와 installed `base.apk` SHA-256 일치
- fresh onboarding으로 `Cycle7` 자녀 생성
- 홈의 안전 경고 노출
- critical inbox 알림 `Cycle7 · 기저귀 공식 안전 안내`
- 알림에서 `아이 · Cycle7` context와 `리콜 알림 · 기저귀`를 정확히 선택
- acknowledgement 후 홈 안전 경고 제거
- 일반 recurring action은 `내일까지 미뤘어요.` 결과 확인
- 앱 재시작 후 안전 경고와 snooze 대상은 계속 숨김, replacement action은 유지
- fatal log match 0

판정:

- 현재 `66AF...` 소스 정상 standalone 내부 검증: PASS
- production/store: NOT QUALIFIED

### 13.3 현재 authority recovery fixture APK

| 항목 | 값 |
| --- | --- |
| APK | `wooriai-0.0.0-release-standalone-authority-8b70...apk` |
| SHA-256 | `8B70CD18C94843389965A2C84346CF763EE7663696777501A61349604FA0E86B` |
| source snapshot | 이전 Cycle 6 전용 `AEBE...` |
| authority fixture | enabled |
| safety fixture | disabled |
| built/installed hash | 일치 |

설치 journey:

- owner leave guard
- blocked account deletion
- blocked request cancel
- exact blocking household 이동
- ownership transfer
- retry
- immediate processing
- processing 상태에서 cancel/신규 삭제 액션 숨김

판정:

- deterministic 내부 fixture runtime: PASS
- 운영 동작 증거: 아님

### 13.4 현재 exact-source Pixel APK

| 항목 | 값 |
| --- | --- |
| APK | `wooriai-pixel-63f321...apk` |
| SHA-256 | `63F32119D2C7753B7A7A665641CE9BA743FC4F2B3A7D8E2796EE233A772AAC6A` |
| installed base SHA-256 | built hash와 일치 |
| source snapshot | `66AF661F1B6364CB60D198ACC74201F52421C9C98064039DA5CAD9E90F49CCCC` |
| source verification | `VERIFIED_STABLE` |
| profile | pixel-lock |
| Pixel fixture | enabled |
| authority/safety fixture | disabled |
| build | PASS |
| full screen gate | 9/9 PASS |

중요:

- standalone과 Pixel APK는 같은 `66AF...` source snapshot을 공유한다.
- `PIXEL_ANDROID_OVERRIDES` 없이 빌드·설치·캡처했다.
- built APK와 설치된 `base.apk` 해시가 일치한다.

### 13.5 최신 완료 Pixel Lock

완료 증거:

- 생성: 2026-07-26 20:44 KST
- source snapshot: `66AF661F1B6364CB60D198ACC74201F52421C9C98064039DA5CAD9E90F49CCCC`
- Pixel APK SHA-256: `63F32119D2C7753B7A7A665641CE9BA743FC4F2B3A7D8E2796EE233A772AAC6A`
- installed `base.apk` hash: built hash와 일치
- Android 15, 1080×2340, density 440
- adb `screencap` + pull
- threshold: `<= 0.0500`

| 화면 | 점수 | 결과 |
| --- | ---: | --- |
| SPL-001 | 0.029517 | PASS |
| HOME-001 | 0.038868 | PASS |
| EXP-001 | 0.000000 | PASS |
| ITEM-001 | 0.017230 | PASS |
| ITEM-002 | 0.044262 | PASS |
| REP-001 | 0.047382 | PASS |
| FAM-001 | 0.038233 | PASS |
| IMP-003 | 0.044157 | PASS |
| SET-001 | 0.014230 | PASS |

판정:

- 9/9 PASS
- worst: `REP-001 = 0.047382`
- 모든 화면 render valid
- 새로운 통과 목표 `<= 0.0480`도 모든 화면 충족

정확한 현재 상태:

> standalone 설치 journey, Release Gate 15/15, Android Pixel Lock 9/9는 모두 동일한 현재 source snapshot `66AF...`에 묶여 있다. 다만 이 snapshot은 dirty working tree 기준이므로 clean commit SHA/CI/운영 배포 증거와는 구분한다.

### 13.6 스토어 후보가 아닌 이유

- package가 `com.anonymous.wooriai`
- version `0.0.0`
- versionCode 1
- Android Debug certificate
- test login 포함
- 운영 API URL/실 OAuth 미검증
- production signing 없음
- Play internal track 없음
- 물리기기 없음
- iOS 빌드 없음

---

## 14. 현재 미커밋 Cycle 5·6 및 Genesis Cycle 7 상세

### 14.1 가족 권한 transaction

주요 파일:

- `apps/api/src/common/authorization/plan-reader.ts`
- `apps/api/src/households/authority-transaction.ts`
- `apps/api/src/households/household-runtime.service.ts`
- `apps/api/src/households/households.controller.ts`
- `apps/api/test/household-authority-lifecycle.db.test.ts`

핵심 설계:

- user row와 household row를 정렬해 lock
- operation-specific member/invite row 추가 lock
- 현재 active user/household/owner를 transaction 안에서 재검증
- mutation과 audit log를 한 transaction으로 기록
- audit log 실패 시 mutation rollback
- 소유권 version 증가
- owner member와 household ownerUserId 동시 변경
- 삭제 시 pending invite expire
- 초대 수락 시 만료시간과 pending 상태를 CAS

방지하는 결함:

- transfer 직후 이전 owner가 owner로 남음
- remove와 transfer race에서 owner 없음
- archive된 household에 invite accept
- privacy access revoke 직전 새 owner 승격
- audit는 실패했는데 실제 권한만 바뀜

### 14.2 계정삭제 복구

주요 파일:

- `apps/api/src/privacy/privacy-state.ts`
- `apps/api/src/privacy/privacy.service.ts`
- `apps/api/src/privacy/privacy.controller.ts`
- `apps/mobile/src/privacy/account-deletion-presentation.ts`
- `apps/mobile/app/settings/privacy.tsx`
- `apps/mobile/src/authority-recovery.test.ts`

상태:

```text
requested
  → access_revoked
  → processor_delete_queued
  → purging
  → completed | retained_exception

requested/processing
  → failed

requested(grace) 또는 owner-blocked failed
  → cancelled

owner-blocked failed
  → requested(retry)
```

UX 규칙:

- 차단 상태: 삭제가 시작되지 않았고 접근도 유지됨을 명시
- blocking household로 이동
- owner transfer 후 재시도
- 유예 또는 차단 상태에서만 취소
- 즉시 처리 단계에서는 취소·신규 삭제 액션 숨김

### 14.3 검증된 안전 대체품목

주요 파일:

- `apps/api/src/release5/item-evidence-policy.ts`
- `apps/api/src/release5/release5-external.service.ts`
- `apps/api/src/release5/release5-readiness.service.ts`
- `apps/api/src/common/security/public-https-url.ts`
- `apps/api/test/release5-safety-alternatives.db.test.ts`
- `apps/admin/app/release5/page.tsx`
- `apps/mobile/src/preparation/PreparationOverview.tsx`
- `apps/mobile/src/preparation/safety-query-scope.ts`
- `apps/mobile/src/security/public-evidence-url.ts`

승인 분리:

1. editor/admin A가 evidence 캡처
2. 다른 admin B가 content hash를 확인하고 독립 검수
3. 다른 admin C가 exact alternative claim을 확인하고 mapping 활성화

fail-closed 조건:

- published item 아님
- evidence 없음
- source revision 불일치
- capturer 없음
- self-review
- expired
- review due
- public HTTPS URL 불안전
- exact alternative claim 없음
- mapping이 stale/replaced

모바일:

- 리콜과 provider recall을 리콜 알림으로 표시
- provider correction은 정정 안내로 표시
- correction에는 대체품목 CTA를 노출하지 않음
- 검증된 대체품목 펼침/접힘
- 근거 제목·안전 메모·공개 URL
- account/household/context를 포함한 query key
- scope가 바뀌면 선택된 alert와 cache 무효화

### 14.4 fixture 오염 방지

추가된 환경:

- `EXPO_PUBLIC_AUTHORITY_RECOVERY_FIXTURE`
- `EXPO_PUBLIC_SAFETY_ALTERNATIVE_FIXTURE`

정책:

- standalone profile에서 명시적으로 `1`인 경우만 활성화
- release gate는 둘 다 `0`
- Pixel build는 둘 다 `0`
- build report에 실제 env 기록
- fixture APK와 normal APK의 Hermes bundle/hash 분리
- canonical root standalone은 항상 정상 APK로 복원

### 14.5 안전 경고·Today Center·알림 lifecycle

주요 파일:

- `apps/mobile/src/home/TodayCenterCard.tsx`
- `apps/mobile/src/home/today-center.ts`
- `apps/mobile/src/home/today-center-mutation.ts`
- `apps/mobile/app/notifications.tsx`
- `apps/mobile/src/notifications/route.ts`
- `apps/api/src/release5/release5-daily.service.ts`
- `apps/api/src/release5/dto/release5-daily.dto.ts`
- `packages/contracts/src/release5.ts`

핵심 설계:

- 안전 확인, sync conflict, 연체된 담당 작업, 교체 예정, 반복 구매, 이번 주 예정, 비용 미배정, 일반 추천을 구분된 action kind로 유지
- `safety_acknowledgement`는 일반 action보다 우선하며 숨김·snooze 불가
- 일반 action은 versioned preference를 사용해 다음 날까지 snooze
- 서버가 반환한 authoritative version이 optimistic 상태보다 최신이면 서버 상태로 수렴
- 알림 route metadata에 child/item/context를 보존해 잘못된 자녀나 준비템으로 이동하지 않음
- critical 안전 알림과 일반 알림을 importance·아이콘·색상으로 구분
- acknowledgement, snooze, replacement 상태를 local backend와 persisted store에서 재시작 후 복원

현재 설치 앱 검증:

- fresh onboarding에서 `Cycle7` 자녀 생성
- 홈 안전 경고 → critical inbox → 정확한 child/item safety context 이동
- acknowledgement 후 홈 안전 경고 제거
- 일반 recurring action snooze 후 결과 문구 확인
- 앱 재시작 뒤 acknowledgement와 snooze 유지
- replacement action은 독립 lifecycle로 계속 노출

이 통합 journey의 기계 판독 증거는 `artifacts/android/genesis-cycle7/final-provenance.json`이다.

---

## 15. 현재 알려진 불일치와 기술 부채

### 15.1 문서 drift

다음 문서는 현재 코드보다 오래된 사실을 포함할 수 있다.

- `docs/operations/known-limitations.md`
- `docs/operations/release-runbook.md`
- `docs/operations/self-implement/*`
- 일부 Release 3/4/5 완료보고서
- MOD_V1 당시의 Pixel reference 충돌 설명

예:

- 과거 문서에는 in-memory runtime 한계가 남아 있으나 현재 핵심 도메인은 PostgreSQL/Prisma 영속화됨
- 과거에는 Pixel reference와 5탭이 충돌했지만 현재 `AGENTS.md`와 최신 Pixel Gate는 5탭을 기준으로 정리됨
- 과거 APK는 `artifacts/android`에 있었으나 현재 규칙은 최종 APK를 반드시 프로젝트 루트에 둠
- 마지막 full-gate PASS 수치는 이후 소스 변경 전 값일 수 있음

### 15.2 디자인 토큰 source-of-truth 충돌

- Source Lock: `#FF8A7A / #FFF8F1`
- 현재 코드/MOD_V1: `#C94627 / #FFFDFC`

다음 설계 전에 해결해야 한다.

### 15.3 현재 HEAD와 현재 제품 소스가 동일한 릴리즈 단위가 아님

- HEAD는 upstream과 같음
- 이 문서를 제외한 65개 작업 트리 변경 경로는 미커밋
- 현재 standalone·Pixel·Release Gate는 동일한 dirty source snapshot `66AF...`에 묶임
- `66AF...`는 Git commit SHA가 아니므로 commit 이후 같은 증거를 새 commit-bound snapshot으로 다시 생성해야 함

즉, “현재 버전”을 하나의 Git SHA로 표현할 수 없다.

### 15.4 카탈로그 게시 0

구조와 테스트는 강하지만 운영 사용자에게 보여줄 수 있는 승인 콘텐츠가 부족하다.

### 15.5 외부 provider

미완료:

- 실제 Kakao/Apple/Google
- FCM/APNs
- object storage
- merchant/affiliate
- recall provider
- monitoring/crash vendor

### 15.6 운영 identity

- 실제 Android applicationId 미정
- versioning 미정
- signing key 미정
- store metadata 미정

### 15.7 실기기·iOS

- Android emulator 내부 증거는 강함
- 물리 Android 전체 회귀 없음
- iOS native build/install 없음

### 15.8 성능

- first-render 모듈 graph는 줄였음
- 현재 AVD renderer는 startup 성능 측정 도구로 신뢰하기 어려웠음
- 물리기기 또는 건강한 compositor에서 5회 반복 기준 필요

---

## 16. 운영 출시 전 미완료 항목

| 영역 | 현재 | 출시 전 필요 |
| --- | --- | --- |
| Git 기준선 | dirty 변경 66개, staged 0 | 리뷰 가능한 commit/PR과 release tag |
| Full release gate | dirty snapshot 15/15 PASS | clean commit/CI에서 동일 Gate |
| Pixel Lock | current `66AF...` 9/9 PASS | clean commit-bound 재생성 + 물리기기 |
| Android identity | anonymous/0.0.0/1 | 실제 package/version |
| Android signing | debug | production keystore |
| Android device | emulator | 물리기기 |
| iOS | 미검증 | build/install/core loop |
| OAuth | local/mock 구조 | 운영 provider |
| DB | local PostgreSQL 검증 | 운영 migrate/backup/restore |
| Redis/worker | local/contract | 운영 runtime |
| catalog publish | 0 published | 전문가 검수·승인·게시 |
| product offer | 0 measured | 실제 판매처/법무/링크 상태 |
| object storage | 외부 미검증 | bucket/CORS/retention/encryption |
| push | 외부 미검증 | FCM/APNs |
| monitoring | 구조만 존재 | dashboard/alert/SLO |
| legal | placeholder/내부 | 사업자·아동·제휴·의료 승인 |
| store | 없음 | listing/privacy labels/review |
| launch | 없음 | staged rollout/rollback/watch |

---

## 17. 다음 개발 설계 전에 먼저 결정할 것

### 결정 1. 현재 Genesis Cycle 7을 어떤 릴리즈 단위로 고정할 것인가

권장:

- `authority/privacy/safety-evidence/today-lifecycle`을 하나의 통합 보안·신뢰 릴리즈로 정의
- 이 문서를 제외한 변경 65개 경로를 기능별로 소유권 감사
- 중간 generated evidence와 제품 소스를 분리
- 현재 로컬 기준 `66AF...`를 commit-bound source hash로 다시 고정

### 결정 2. 디자인 토큰 canonical 버전

선택 필요:

- 과거 Source Lock 복귀
- 현재 MOD_V1 토큰 정식 승인

현재 Pixel과 코드 기준으로는 MOD_V1 토큰을 새 canonical version으로 승인하는 편이 자연스럽다.

### 결정 3. 다음 목표가 로컬 완성인지 운영 출시인지

#### 로컬 완성 목표

- dirty snapshot full gate 15/15와 Pixel 9/9는 완료
- clean commit 기준 source/APK hash 재생성
- clean commit 기준 Gate 15/15와 Pixel 9/9 재현
- 문서 drift 정리

#### 운영 출시 목표

위 항목에 더해:

- package/version/signing
- OAuth
- DB/Redis/object storage
- catalog publication
- monitoring
- physical Android/iOS
- legal/store

### 결정 4. canonical catalog 게시 전략

필요:

- 어떤 item부터 publish할지
- high-risk 전문 검수자
- evidence source 허용 목록
- review SLA
- offer 연결 전 빈 상태 UX
- recall/alternative 운영자 역할

### 결정 5. 외부 provider 우선순위

권장 순서:

1. 운영 PostgreSQL + backup/restore
2. Kakao OAuth
3. production Android identity/signing
4. monitoring/crash
5. FCM
6. object storage/import export
7. merchant/affiliate/recall

---

## 18. 권장 다음 개발 Epic

### Epic A. Genesis Cycle 7 통합 및 기준선 고정

목표:

- 현재 권한·개인정보·안전대체·Today/알림 lifecycle 변경을 review 가능한 단위로 고정

완료 조건:

- file ownership 감사
- dirty snapshot의 PASS 증거를 commit 기준으로 재생성
- full API E2E와 Admin browser E2E
- full release gate 15/15
- Pixel Lock 9/9
- clean commit-bound source snapshot
- normal/fixture APK 분리 증거

### Epic B. 문서·계약 정규화

목표:

- 다음 개발자가 서로 충돌하는 문서를 따라가지 않도록 현재 계약을 단일화

완료 조건:

- 5탭 canonical
- 디자인 토큰 canonical
- APK 보관 규칙 canonical
- 오래된 in-memory 설명 제거
- 최신 DB/API/route counts 반영
- 완료/외부 미검증 구분

### Epic C. 운영 identity와 배포 파이프라인

목표:

- 내부 APK를 실제 내부 배포 후보로 승격

완료 조건:

- applicationId
- semver/versionCode
- keystore
- HTTPS API
- production profile
- signed AAB
- Play internal track
- installed physical-device smoke

### Epic D. 운영 인증

목표:

- local/test login 없이 실제 사용자 session 완성

완료 조건:

- Kakao console
- redirect/deep link
- token verification
- unlink
- refresh/logout
- onboarding
- account deletion
- provider outage UX

### Epic E. 카탈로그 게시와 안전 운영

목표:

- 구조상 존재하는 canonical item을 실제 publish 가능한 콘텐츠로 전환

완료 조건:

- 우선순위 item 승인
- high-risk 독립 검수
- evidence freshness
- public URL
- pilot manifest
- offer와 필요성 분리
- recall/alternative runbook

### Epic F. 운영 인프라·관측

목표:

- 장애가 나도 데이터와 원인을 확인할 수 있는 운영 상태

완료 조건:

- production PostgreSQL
- migration dry-run
- backup restore drill
- Redis worker
- metrics dashboard
- alert
- crash report
- job DLQ 운영 화면

### Epic G. 물리기기·iOS 품질

목표:

- emulator 중심 내부 증거를 실제 기기 품질로 승격

완료 조건:

- Android physical 2종 이상
- startup 5회
- TalkBack 전체 흐름
- font scale
- offline/process death
- iOS build/install
- VoiceOver 핵심 흐름

---

## 19. 다음 개발 설계용 우선순위 백로그

| 우선순위 | 작업 | 이유 |
| --- | --- | --- |
| P0 | 현재 변경 65개 경로 ownership/commit 설계 | 현재 버전을 Git SHA로 고정할 수 없음 |
| P0 | clean commit-bound full release gate | dirty snapshot 15/15를 리뷰 가능한 SHA로 승격해야 함 |
| P0 | clean commit-bound Android Pixel 9/9 | dirty snapshot 9/9를 동일 SHA로 재생성해야 함 |
| P0 | 디자인 토큰 문서 충돌 해소 | 다음 UI 개발의 회귀 위험 |
| P0 | catalog audit 재생성 | 마지막 수치가 이전 HEAD |
| P0 | production identity/signing 결정 | 스토어 후보 전환의 전제 |
| P1 | Kakao 운영 OAuth | 실제 사용자 진입 전제 |
| P1 | 우선 catalog publish pilot | 준비템 제품 가치의 핵심 |
| P1 | 운영 DB/backup/restore | 데이터 안전 전제 |
| P1 | monitoring/crash | closed beta 전제 |
| P1 | physical Android qualification | emulator 한계 제거 |
| P2 | push provider | 알림/주간 브리핑 실사용 |
| P2 | object storage/export | import/export 운영 완성 |
| P2 | iOS | 플랫폼 확대 |
| P2 | merchant/recall provider | 커머스·안전 자동화 |

---

## 20. 재현 명령

### 20.1 코드 품질

```powershell
pnpm install --frozen-lockfile
pnpm mobile:deps:check
pnpm check:env:example
pnpm security:secrets
pnpm security:audit
pnpm lint
pnpm typecheck
pnpm test --concurrency=1 --force
pnpm --filter api test:e2e
pnpm test:admin-browser
pnpm build --force
```

### 20.2 전체 릴리즈

```powershell
npm run release:gate
```

### 20.3 카탈로그

```powershell
pnpm catalog:validate
pnpm catalog:audit
pnpm catalog:coverage
pnpm catalog:performance
```

현재 DB URL과 migration 대상이 명시적으로 맞는지 확인한 뒤 실행한다.

### 20.4 Android standalone

```powershell
pnpm android:build-apk -- --profile standalone
```

최종 APK는 반드시 `F:\WooriAI` 루트에 생성한다.

### 20.5 Pixel Lock

```powershell
npm run pixel:android:build-apk
npm run pixel:android
npm run pixel:report
```

최종 증거는 설치된 Android 앱의 adb screencap이어야 한다.

### 20.6 한 화면 집중

```powershell
npm run pixel:android:screen -- SPL-001
npm run pixel:open -- --screen SPL-001
npm run pixel:capture -- --screen SPL-001
npm run pixel:diff -- --screen SPL-001
```

---

## 21. 다음 개발자가 먼저 읽을 파일

### 계약

- `AGENTS.md`
- `docs/dev/source-lock.md`
- `docs/dev/do-not-change.md`

### 현재 제품·출시 상태

- 이 문서
- `docs/qa/evidence/latest-release-gate.json`
- `docs/qa/completion-audit.md`
- `docs/qa/functional-verification-report.md`
- `docs/operations/known-limitations.md`

### Android

- `artifacts/android/genesis-cycle7/final-provenance.json`
- `artifacts/android/wooriai-0.0.0-release-standalone.json`
- `artifacts/android/cycle6-normal-standalone-provenance.json`
- `artifacts/android/cycle6-authority-recovery-provenance.json`
- `artifacts/pixel-lock/android/reports/latest.json`
- `artifacts/pixel-lock/android/reports/pixel-apk.json`

### 카탈로그

- `docs/qa/evidence/release4-catalog-audit.json`
- `docs/qa/evidence/preparation-catalog-editorial-audit-2026-07-20.md`
- `apps/api/prisma/schema.prisma`
- `packages/domain/src/release4-catalog.ts`

### 현재 Cycle 5·6 및 Genesis Cycle 7

- `apps/api/test/household-authority-lifecycle.db.test.ts`
- `apps/api/test/release5-safety-alternatives.db.test.ts`
- `apps/mobile/src/authority-recovery.test.ts`
- `apps/mobile/src/preparation/PreparationOverview.safety.test.tsx`
- `apps/mobile/src/home/TodayCenterCard.test.tsx`
- `apps/mobile/src/home/today-center-mutation.test.ts`
- `apps/api/test/release5d-daily.e2e.test.ts`

---

## 22. 최종 상태 매트릭스

| 영역 | 구현 | 현재 자동 검증 | Android 설치 증거 | 운영 준비 |
| --- | --- | --- | --- | --- |
| 인증·세션 | 높음 | PASS | 내부 테스트 로그인 PASS | 실제 OAuth 필요 |
| 온보딩 | 높음 | PASS | PASS | 실제 OAuth/실기기 필요 |
| 지출·예산 | 높음 | PASS | PASS | 운영 DB/모니터링 필요 |
| 오프라인 sync | 높음 | PASS | 부분 | 실네트워크/다중기기 필요 |
| 홈·리포트 | 높음 | PASS | current Pixel PASS | 운영 데이터/실기기 |
| 준비템 | 높음 | PASS | Pixel/설치 증거 | 게시 콘텐츠 필요 |
| 커머스·제휴 | 구조 높음 | PASS | 내부 fixture | 실 계약/offer 필요 |
| 가족 RBAC | 높음 | PASS | Cycle 6 fixture PASS | 운영 다중 사용자 부하 |
| 개인정보 삭제 | 높음 | PASS | Cycle 6 normal/fixture PASS | 실제 processor/법무 |
| Excel/CSV import | 높음 | PASS | current Pixel IMP PASS | object storage/부하 |
| Admin | 높음 | current browser E2E PASS | 해당 없음 | 운영 계정/배포 |
| 카탈로그 구조 | 높음 | PASS | browse 증거 | 게시 0 |
| 안전 대체품목 | 높음 | 19 DB tests + full gate PASS | current standalone journey | 실제 provider/운영 검수 |
| Today·알림 lifecycle | 높음 | contract/UI/API PASS | current standalone journey | FCM/APNs·실기기 |
| Android 빌드 | 높음 | provenance PASS | hash parity PASS | identity/signing |
| Pixel Lock | 자동화 높음 | current 9/9 PASS | adb installed hash parity | clean commit/물리기기 |
| iOS | 낮음 | source 호환 일부 | 없음 | 미완료 |
| 운영 인프라 | 계약 중간 | local 검증 | 해당 없음 | 배포 미완료 |

---

## 23. 최종 판정

WooriAI는 초기 MVP 수준을 넘어 다음 요소를 가진 큰 로컬 제품 후보로 발전했다.

- 다중 자녀·가족 권한
- PostgreSQL 영속 회계
- 오프라인 동기화
- 정규 카탈로그와 운영 workflow
- 제휴·구매 후속
- Excel/CSV import
- Admin MFA/CSRF/CSP
- 개인정보 삭제 상태 머신
- worker/outbox/DLQ
- Android source-bound APK
- adb 기반 9화면 Pixel Lock

하지만 현재 시점에서 운영 출시 완료로 볼 수는 없다.

가장 가까운 다음 목표는 새 기능 추가가 아니라 현재 통합 결과를 review 가능한 clean commit 기준선으로 승격하는 것이다.

1. 현재 Cycle 5·6/Genesis Cycle 7 변경 65개 경로의 ownership·commit 범위 고정
2. commit-bound source snapshot에서 Release Gate 15/15와 Android Pixel Lock 9/9 재현
3. standalone/Pixel/fixture provenance와 Git SHA 연결
4. 디자인 토큰·카탈로그 게시·운영 identity 결정

dirty snapshot 기준 자동·Android 검증 자체는 이미 완료됐다. 위 네 가지가 끝나면 다음 개발 설계는 “무엇이 구현됐는지 다시 조사하는 단계”가 아니라 “운영 출시 또는 다음 제품 Epic을 선택하는 단계”에서 시작할 수 있다.
