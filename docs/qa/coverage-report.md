# 커버리지 실측 보고 (QA-COV)

- 측정일: 2026-08-21
- 도구: vitest 2.1.9 + `@vitest/coverage-v8@2.1.9` (v8 provider), 설정 파일 무변경 — CLI 플래그로만 실행
- 명령: `npx vitest run --coverage --coverage.provider=v8 --coverage.reporter=json --coverage.reporter=json-summary` (패키지별 실행)
- API 실행 DB: 동시 작업 중인 `wooriai_test`와의 간섭을 피하려고 **전용 클론 `wooriai_cov`** 를 만들어 `DATABASE_URL`로 주입 (globalSetup이 마이그레이션·시드 수행). 측정 후 DB는 삭제(원복) 완료.
- **의존성 추가됨(미커밋)**: `@vitest/coverage-v8`가 워크스페이스에 없어 루트 dev로 설치 — `package.json`·`pnpm-lock.yaml` 변경이 남아 있음. 오케스트레이터가 유지/원복 결정 필요. (처음 `pnpm add -D -w`는 4.x를 받아 vitest 2.x와 비호환 → `@vitest/coverage-v8@2.1.9`로 고정 재설치함.)
- 측정 안정성 메모: 다른 에이전트의 동시 편집으로 mobile 1회차에서 `error-boundary-contract.test.ts` 1건이 일시 실패(재실행 시 통과), 실행 간 테스트 수도 변동(mobile 494→507, api 266→272). 아래 수치는 **마지막(전체 그린) 실행** 기준이며, 코드가 계속 변하는 중이라 ±1%p 수준의 오차가 있을 수 있음.
- admin(apps/admin), contracts/ui/config/test-utils 패키지는 티켓 범위(지시된 3개 패키지) 밖이라 측정하지 않음.

## 1. 패키지별 총계

| 패키지 | Lines | Branches | Functions | Statements |
|---|---|---|---|---|
| apps/api | **89.17%** (9,171/10,284) | **80.25%** (1,573/1,960) | **95.40%** (602/631) | 89.17% |
| apps/mobile | **29.64%** (3,634/12,260) | **81.19%** (1,088/1,340) | **71.99%** (311/432) | 29.64% |
| packages/domain | **93.79%** (242/258) | **85.71%** (60/70) | **95.23%** (20/21) | 93.79% |

mobile의 라인 커버리지가 낮은 주원인: Expo Router 화면(`app/**/*.tsx`) 34개와 pixelLock 스타일·UI 컴포넌트가 전부 0%로 잡힘(렌더 테스트 부재, 로직은 `src/*`로 분리되어 그쪽은 대체로 양호). 분기 커버리지(81%)가 실제 로직 커버리지에 더 가까움.

## 2. 런치-크리티컬 최저 커버리지 Top 10 (리스크 순위)

위험도 기준: 인증/토큰 > 오프라인 동기화 > 퍼지 잡 > 결제 인접 커머스 > 임포트 파서. 생성물·설정 파일 제외. "미커버 분기"는 json-summary + coverage-final의 비실행 라인과 소스 대조로 판독.

### 1) `apps/mobile/src/offline/sync-controller.ts` — 0% (오프라인 동기화 글루)
- 미커버: 파일 전체 — SQLite 스토어 싱글턴 생성, 연결성 감시 기반 백그라운드 flush, 화면용 상태 스냅샷.
- 참고: 파일 주석에 "native SQLite/AppState/expo-network 때문에 vitest로 단위 테스트 불가, 의도적으로 얇게 유지"라고 명시됨. 다만 세션 전환 teardown·flush 트리거 순서 회귀는 아무도 못 잡는 상태.
- 제안 테스트: expo-sqlite/expo-network를 모듈 목으로 대체해 "온라인 전환 → flushOutbox 1회 호출·상태 스냅샷 갱신" 시나리오 1건.

### 2) `apps/mobile/src/offline/sqlite-offline-store.ts` — 0% (오프라인 영속 저장소)
- 미커버: 파일 전체 — 테이블 DDL, WAL 설정, memory-offline-store와 1:1 미러라고 주장하는 모든 쿼리.
- 리스크: 미러가 어긋나면(컬럼/제약 불일치) 테스트는 그린인데 실기기에서만 깨짐.
- 제안 테스트: better-sqlite3(또는 expo-sqlite 목)로 OfflineStore 계약 테스트를 memory 구현과 **동일 스위트로 공유 실행**(계약 동형성 검증).

### 3) `apps/api/src/auth/kakao/kakao-oidc-client.http.ts` — 14.66% L (실 카카오 OIDC 클라이언트)
- 미커버: `exchangeCode` 전체(fetch 실패 L61-66, non-2xx L68-73, JSON 파싱 실패/`id_token` 부재 L75-81), `verifyIdToken` 전체(RS256 고정·issuer/audience 검증 L90-108). 테스트는 페이크 클라이언트로만 통과 중.
- 리스크: 로그인 경로의 실 구현이 무테스트 — alg 고정, 에러→`UnauthorizedException` 매핑 회귀를 못 잡음.
- 제안 테스트: `fetch` 목 + jose 로컬 JWKS로 토큰 교환 4분기(성공/네트워크 오류/400/`id_token` 누락)와 위조·만료 idToken 거부를 단위 검증.

### 4) `apps/mobile/src/api/client.ts` — 54.56% L / 70.37% B (API 클라이언트·토큰 리프레시)
- 미커버: `requestMultipartJson`의 401→단일비행 리프레시 재시도(L396-437), `requestExpenseJson`의 동일 분기(L683-697)와 409 conflict 스냅샷 파싱(L713-722), 프라이버시 삭제 계열 래퍼(`preview/confirmAccountDeletion` 등 L1003-1057), 아이템/초대/임포트 래퍼 다수.
- 리스크: 리프레시 실패 시 `clearSession()` 분기(강제 로그아웃)와 임포트 업로드 재시도는 인증 만료 사용자 전원이 타는 경로.
- 제안 테스트: fetch 목으로 "401 → refresh 성공 → 원요청 1회 재시도 / refresh 401 → 세션 클리어" 매트릭스를 requestJson·Multipart·Expense 3변형에 대해 검증.

### 5) `apps/api/src/imports/import-parser.ts` — 67.68% L / **49.05% B** (엑셀/CSV 임포트 파서)
- 미커버: **`inferColumns` 전체(L306-354, 헤더 없는 파일의 열 추론)**, 빈 그리드 L83, 2,000행 초과 L93, `toParsedRow`의 열 부재(-1) 분기 L102-110, CP949/인코딩 폴백·따옴표 CSV 토크나이저 분기(L128-269 산재), 날짜/금액 정규화 엣지(L362-429 산재).
- 리스크: 은행 앱 내보내기처럼 헤더 없는 CSV가 들어오면 무테스트 코드가 열을 "추론"해 금액/날짜를 뒤바꿀 수 있음.
- 제안 테스트: 헤더 없는 CSV(날짜·금액·품명 순서 셔플 3종) + BOM/CP949 + 2,001행 파일로 `parseImportFile` 픽스처 테스블.

### 6) `apps/api/src/common/idempotency/idempotency.interceptor.ts` — 77.04% L / 60.46% B (중복 결제성 요청 방지)
- 미커버: 핸들러 실패 시 키 해제(L118-120), 만료 예약 회수 후 재예약(L155-164), 경쟁 삭제 후 재귀 재예약(L150-154), `waitForCompletion`의 행 소실 409(L179-180)·폴링 타임아웃 409(L184-186), 확률적 청소(L137-140), 배열 헤더/미인증 스킵(L63-72).
- 리스크: 이 분기들이 정확히 "동시 더블탭 지출 기록/구매 기록" 시 중복 생성 여부를 가름.
- 제안 테스트: 프리즈마 목 또는 실DB로 동시 2요청(같은 키+같은/다른 body), 핸들러 예외 후 재시도 성공, 만료 예약 회수 시나리오 4건.

### 7) `apps/api/src/admin/admin-token-crypto.ts` — 54.32% L (관리자 토큰 서명/검증)
- 미커버: MFA pending 토큰의 형식 불량(L61-63)·서명 불일치(L66-68)·type/만료(L72-74) 거부 분기.
  - 이 측정 당시 함께 미커버였던 `signAdminAccessToken`·`verifyAdminAccessToken`(admin JWT 액세스 토큰 경로)은 참조처가 없어 CLEAN-121에서 제거됨.
- 리스크: 관리자 세션 위조 방어 로직이 직접 검증되지 않음.
- 제안 테스트: sign→verify 라운드트립 + 서명 변조/만료/`type` 스왑 거부 단위 테스트.

### 8) `apps/mobile/src/offline/remote-api.ts` — 0% (동기화 원격 어댑터)
- 미커버: 파일 전체 — `ExpenseHttpError`/`ExpenseVersionConflictError` → `RemotePermanentError`/`RemoteVersionConflictError` 매핑, payload→patch 변환.
- 리스크: 매핑이 틀리면 sync-engine이 영구 오류를 무한 재시도하거나 충돌을 실패로 오분류.
- 제안 테스트: api/client 함수들을 목으로 두고 4xx/409/네트워크 오류가 각각 어떤 도메인 에러로 변환되는지 계약 테스트.

### 9) `apps/mobile/src/offline/sync-engine.ts` — 84.04% L / 72.41% B (동기화 코어)
- 미커버: delete 플러시 경로(서버 미도달 행 로컬 정리 L357-368, 원격 delete L360-368), `current=null` 미해결 충돌의 failed 강등(L371-390), `fallBackToFailedForUnresolvableConflict`(L457-463), `retryFailedMutation`/`discardFailedMutation`(L468-481), 커서 스코프 엣지(L117,151).
- 리스크: 사용자 트리거 "재시도/삭제" 복구 UX와 삭제 동기화가 무테스트.
- 제안 테스트: memory-offline-store + 목 remote로 "오프라인 삭제→flush", "409(current=null)→failed→재시도 성공" 2시나리오.

### 10) `apps/mobile/src/commerce/purchase-followup.store.ts` — 77.08% L (구매 후속 프롬프트 저장소)
- 미커버: `sanitizedEntries`의 영속 blob 검증 전체(L131-152 — 구버전/손상 데이터 필드 타입 검사·상태 화이트리스트·엔트리 상한 절단), 만료 분기 L68.
- 리스크: 앱 업데이트 후 손상된 persist 복원 시 구매 후속 프롬프트(핵심 루프의 "구매 후 기록" 진입점)가 크래시 대신 조용히 복구되는지 미검증.
- 제안 테스트: 필드 누락/타입 오염/status 불량/초과 개수 blob 4종을 rehydrate해 `[]` 폴백·절단을 검증.

차순위(Top 10 밖 관찰): `admin-password.ts`(분기 40% — env 미설정 분기 L28-47), `auth/kakao-login.ts`(expo-linking 브라우저 세션 L214-250), `secure-session-storage.ts`(SecureStore 실패 폴백 분기 다수), `finance/expenses.service.ts`(CAS 롤백 `rollbackVersionBump` L138-144·삭제 버전게이트 실패 L130-132), `product-link-bulk-csv.util.ts`(CSV 오류행 리포트 L132-149). 참고로 **퍼지 잡(`data-retention-purge.job.ts`)은 96.35% L / 92.68% B로 양호** — 남은 미커버는 poison-row skip 로깅(L378-386, L457-459)과 stub 퍼지의 전량-blocked 조기 반환(L631-648)뿐.

## 3. 커버리지 0% 파일 전체 목록

### apps/api (2)
- `prisma/seed.ts` (시드 스크립트 — 테스트 프로세스 밖 `execSync`로 실행돼 계측 안 됨)
- `src/main.ts` (부트스트랩)

### packages/domain (1)
- `src/index.ts` (re-export 배럴)

### apps/mobile (69)
설정/엔트리(4): `app.config.js`, `index.js`, `metro.config.js`, `react-native.config.js`

Expo Router 화면(34): `app/_layout.tsx`, `app/budget.tsx`, `app/index.tsx`, `app/launch-animation.tsx`, `app/notifications.tsx`, `app/pixel-lock.tsx`, `app/sync-status.tsx`, `app/(auth)/login.tsx`, `app/(onboarding)/{budget,child-profile,child-status,prepared-items,resume}.tsx`, `app/(tabs)/{_layout,index,items,more,records,reports}.tsx`, `app/expenses/{[expenseId],new}.tsx`, `app/family/{index,invite,accept/[token]}.tsx`, `app/import/{[importJobId],index}.tsx`, `app/items/[itemTemplateId].tsx`, `app/onboarding/{budget,child-profile,child-status,prepared-items,resume}.tsx`, `app/settings/{index,privacy}.tsx`

src 로직/글루(31): `src/ui.tsx`, `src/analytics/index.ts`, `src/commerce/PurchaseFollowupPrompt.tsx`, `src/errors/ErrorBoundary.tsx`, `src/export/share-csv.ts`, `src/notifications/NotificationBell.tsx`, `src/notifications/useHomeNotificationEvaluation.ts`, `src/offline/connectivity.ts`, `src/offline/remote-api.ts`, `src/offline/sqlite-offline-store.ts`, `src/offline/sync-controller.ts`, `src/onboarding/step-ui.tsx`, `src/pixelLock/overrides.ts`, `src/pixelLock/styles/*`(11개), `src/stores/onboarding-resume.store.ts`, `src/ui/{EmptyState,ListRow,MoneyText,Skeleton,StageBadge,index}.tsx|ts`

이 중 **런치-크리티컬 0%**: `src/offline/sync-controller.ts`, `src/offline/sqlite-offline-store.ts`, `src/offline/remote-api.ts`, `src/offline/connectivity.ts`, `src/commerce/PurchaseFollowupPrompt.tsx`, `src/errors/ErrorBoundary.tsx`, `app/(auth)/login.tsx`, `app/expenses/new.tsx`, `app/import/*`.

## 4. 다음 라운드 권장 테스트 Top 5 (가치순)

1. **API 임포트 파서 — 헤더 없는 CSV 열 추론**: `inferColumns` 전체 + 인코딩/행수 상한 분기. 파서 분기 커버리지 49%는 이번 실측 최악이며, 사용자 돈 데이터를 직접 오염시킬 수 있는 경로. (순수 함수라 픽스처 테스트 비용도 최저)
2. **API 멱등성 인터셉터 — 동시성/만료/실패 회수**: 같은 키 동시 2요청, 핸들러 실패 후 키 해제·정상 재시도, 만료 예약 회수, 폴링 타임아웃 409. 지출/구매 기록 중복 생성 방지의 최후 방어선.
3. **mobile API 클라이언트 — 401 리프레시 재시도 매트릭스**: requestJson/Multipart/Expense 3변형 × (refresh 성공/401/네트워크 오류). 세션 만료 사용자 전원이 타는 경로이며 `clearSession` 오발동은 곧 "갑자기 로그아웃" CS로 직결.
4. **API 카카오 OIDC 실 클라이언트**: fetch/JWKS 목으로 교환·검증 실패 분기 전체. 페이크 클라이언트만 검증되는 현 상태는 실 로그인 회귀에 무방비.
5. **mobile 오프라인 삭제·충돌 복구 경로**: remote-api 에러 매핑 계약 + sync-engine의 delete 플러시·`current=null` 충돌 강등·retry/discard. memory-offline-store가 이미 있어 목 비용이 낮고, 오프라인 UX 신뢰의 핵심.

## 부록: 측정 원복 상태

- `wooriai_cov` DB: 측정 후 `dropdb` 완료.
- `coverage/` 출력 디렉터리(api·mobile·domain): gitignore 대상이라 저장소 오염 없음.
- 남은 저장소 변경: `package.json`·`pnpm-lock.yaml`의 `@vitest/coverage-v8@2.1.9` devDependency 추가(워크스페이스 루트, 미커밋) — 유지 권장(다음 라운드 커버리지 재측정에 필요), 원복 시 `pnpm remove -w @vitest/coverage-v8`.
