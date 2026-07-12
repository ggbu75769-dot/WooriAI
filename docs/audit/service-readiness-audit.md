# 우리아이 서비스 준비도 감사 (Service Readiness Audit)

작성: 2026-07-12 · 브랜치: codex/source-audit-standalone-apk · 방식: 독립 병렬 감사(모바일/API) → 런타임 에뮬레이터 재현 → 병렬 수정(executor 4) → 독립 검수(diff-reviewer) → 통합 게이트 → APK 재빌드·재검증

이 문서는 이번 감사·수정 세션의 작업 기록이다. 기존 `docs/qa/*.md`의 통과 기록을 증거로 신뢰하지 않고, 소스·테스트·**실제 Android release APK(에뮬레이터)** 로 직접 재검증했다.

## 1. 시스템 구조 (실제 확인된 스택)

- **모노레포**: pnpm 11 + turbo. `apps/mobile`(Expo RN + expo-router), `apps/api`(NestJS 10, `/api/v1`), `apps/admin`(Next), `packages/{domain, contracts, config, ui, test-utils}`.
- **모바일 상태**: zustand + persist(session / selected-child / onboarding-progress / local-backend) + TanStack Query.
- **API**: NestJS, DTO whitelist 검증, 전역 예외 필터, JWT 가드(HS256, timingSafeEqual), 서비스 계층 RBAC(owner/co_parent/viewer), **인메모리 저장소(프로토타입 경계)**.
- **도메인 규칙 단일 소스** `@wooriai/domain`: 양수 원화 정수, 미래 날짜 거부, Asia/Seoul 월 경계, 준비템 추천 점수(수수료율 미사용), 아이 단계 계산.
- **독립 실행형 테스트 모드**: `EXPO_PUBLIC_TEST_LOGIN=1` 릴리즈 APK에서 API 클라이언트가 HTTP 대신 온디바이스 영속 로컬 백엔드(`apps/mobile/src/api/local-backend.ts`)로 동작. 집계는 `@wooriai/domain` 동일 규칙 공유 → 홈=리포트 일치.
- **Android**: Gradle 8.10.2, minSdk 24 / target 34 / compile 35, applicationId `com.anonymous.wooriai`, debug keystore 서명.

## 2. 감사 방법과 커버리지

- 모바일 전 라우트(17개 화면), API 전 컨트롤러(13개), domain/contracts를 **독립 에이전트 2대**가 기존 QA 문서를 참조하지 않고 소스에서 직접 검증.
- **실제 release APK를 android-35 에뮬레이터(Pixel 7)에 설치**하고 로그인→온보딩→홈→지출 생성/수정/삭제→리포트→준비템→상품상세→엑셀→가족→설정→앱 재실행 플로우를 UI 자동화(adb + uiautomator dump)로 재현.

## 3. 발견한 문제와 우선순위

### P0 (치명) — 런타임으로 직접 재현, 즉시 수정함

| ID | 문제 | 재현 |
|---|---|---|
| P0-1 | **지출 카테고리 8종이 전부 동일 categoryId**(`aaaaaaaa-…`). 어떤 카테고리를 눌러도 같은 id로 저장되어 카테고리 집계가 무효. 리포트 도넛 범례가 `local-category-diaper` 같은 **raw ID를 사용자에게 노출**(한국어 이름 매핑 `localCategoryNameKo`는 존재하나 미사용). | 리포트 화면에서 `local-category-diaper/formula/detergent` 노출 확인 |
| P0-2 | **"이번 달" 기준이 `DEFAULT_YEAR_MONTH="2026-07"`로 하드코딩**. 오늘(2026-07-12)은 우연히 맞지만 2026-08-01부터 기록 탭·예산 화면이 영원히 2026년 7월을 "이번 달"로 표시(홈은 현재 월 계산 → 홈과 불일치). | 소스 확인 + records/budget 호출부 추적 |

### P1 (높음) — 수정함

- 상품 상세의 **허위 평점·허위 대표가**: 아기띠(목록 89,000원·★4.7)를 열면 상세는 평점 `★4.8(2,154)`, 대표가 `42,900원`, 쿠팡 `45,900원`이 상품과 무관하게 고정(대표가<최저가 모순). 런타임 재현.
- **빠른 지출 원탭 오기록**: 세션 있을 때도 `기저귀/38500`이 사전 입력되어 시트를 열자마자 저장하면 38,500원 지출 생성.
- **(tabs) 라우트 가드 부재**: 세션/온보딩 가드가 `app/index.tsx` 한 곳뿐. 딥링크·직접 네비게이션으로 세션 없이 진입 시 preview 목데이터가 실화면처럼 노출.
- **계정 삭제 후 로컬 미정리·라우팅 부재**: `clearSession()`만 호출, 화면 이동·로컬 스토어 정리 없음 → 테스트 모드에서 삭제 후 재로그인 시 삭제 전 데이터 복원.
- **API: NODE_ENV 미설정 시 공개 dev 폴백 시크릿 사용** → 서명 클레임 위조로 임의 가구 owner 등록(IDOR 연쇄). fail-fast가 production에만, 그리고 요청 시점 lazy.
- **API: OAuth 로그인이 무검증 스텁**이며 프로덕션 차단 없음 → 배포 시 누구나 임의 문자열로 계정 생성/사칭 가능.
- **영문 문구 노출**: 엑셀 임포트 화면 접근성 라벨 "Rows are not saved as expenses until you confirm them."

### P2 (중간) — 일부 수정, 일부 문서화

- 준비템 연령 칩 무기능(클릭해도 결과 불변), "더 많은 추천 보기" 죽은 버튼, 실세션 가짜 평점 캡션 → **수정**.
- 외부 링크 실패 무음 처리 → **수정**(canOpenURL 선검사 + 실패 안내).
- API: 관리자 토큰 비교 non-timing-safe → **수정**(safeCompare).
- API: 업로드 파일 크기 제한이 multer 레벨에 없음(메모리 고갈 DoS) → **수정**(10MB limit).
- 엑셀 임포트 index 화면의 하드코딩 데모 미리보기/파일명, 더보기 라벨-동작 불일치, 가족 하드코딩 이름/코드 → **known-limitations 문서화**(픽셀락 고정 데모 화면 + AI 분석 스텁 경계).

### P3 (낮음) — 문서화

- 아이 단계 계산 기본 '오늘'이 UTC(KST 00~09시 하루 오차), gift 타입 지출 API 생성 경로 공백, idempotency 부재, 감사 로그 인메모리 휘발, 결제수단 하드코딩 표시명 등. 상세는 [known-limitations](../operations/known-limitations.md).

## 4. 데이터 정합성·보안 검증 결과 (수정 후)

- **홈=리포트 일치**: 단일 도메인 집계(`expensesForChild` → soft delete 제외·gift 제외·Seoul 월 경계) 공유. 런타임에서 홈 97,200원 = 리포트 총지출 ₩97,200 = 누적 ₩97,200 확인.
- **soft delete**: 삭제 시 모든 집계에서 제외(런타임: 식비 5,000원 삭제 후 합계 102,200→97,200 복귀, 목록에서 제거). API는 삭제자·시각 감사 로그 기록.
- **IDOR/RBAC**: child/expense/budget/import/item/report/home 전 경로가 `requireChildAccess`/`requireExpenseAccess`/`requireImportJobAccess` 경유(누락 경로 없음). viewer 쓰기 차단, 초대·멤버 삭제·전체 삭제 owner 전용(assertOwner), 멤버 제거 즉시 토큰 무효.
- **엑셀**: 승인 전 expenses 미저장, 신뢰도 0.70 미만 기본 미선택+경고, 이중 confirm 차단.
- **제휴**: 클릭 로그 저장(실 API), URL scheme http/https 화이트리스트 3중 적용, 추천 점수에 수수료율 미사용, 구매 CTA 인접 제휴 고지 표시(런타임 확인).
- **프로덕션 안전**: 시크릿 부팅 검증 + dev/test 한정 폴백, 프로덕션 OAuth 스텁 차단(501), 관리자 토큰 timing-safe.

## 5. 수정 대상 파일 (요약)

모바일: `src/categories.ts`(신규), `app/expenses/new.tsx`, `app/(tabs)/reports.tsx`, `app/(tabs)/items.tsx`, `app/items/[itemTemplateId].tsx`, `app/(tabs)/_layout.tsx`, `app/settings/privacy.tsx`, `app/import/index.tsx`, `src/api/client.ts`, `src/api/local-backend.ts`.
API: `common/config/require-secret.ts`, `main.ts`, `auth/auth.service.ts`, `auth/token.service.ts`, `admin/admin-token.guard.ts`, `imports/imports.controller.ts` + 회귀 테스트 4파일.

상세 추적: [feature-traceability-matrix.md](feature-traceability-matrix.md) · 테스트 증거: [../qa/android-release-test-report.md](../qa/android-release-test-report.md) · 잔여: [../operations/known-limitations.md](../operations/known-limitations.md)
