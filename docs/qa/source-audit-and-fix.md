# 우리아이 소스 전수 감사 및 수정 보고서

작성: 2026-07-12 · 브랜치: codex/test-login-ui · 작업 방식: 전수 조사(병렬 탐사 3) → P0~P3 분류 → 병렬 수정(executor 5) → 독립 검수(diff-reviewer) → 지적사항 일괄 수정 → 통합 게이트 → APK 빌드

## 1. 분석한 범위

- 모노레포 전체: apps/mobile(Expo RN + expo-router), apps/api(NestJS 10), apps/admin(Next), packages/{domain, contracts, config, test-utils, ui}
- Android 네이티브: apps/mobile/android (Gradle 8.10.2, AGP/RN 플러그인, minSdk 24 / target 34 / compile 35, applicationId com.anonymous.wooriai)
- 기준 문서: docs/4차 v0.4 프롬프트 세트(최신 확정 기준), docs/2차 화면정의 v0.2, docs/1차 기획 v0.1, AGENTS.md(픽셀락 가이드), CODEX_START_HERE.md(v0.5 래퍼)
- 테스트: 8개 패키지 vitest, API e2e 8파일, mobile 소스 계약 테스트, release:gate 10게이트
- 검색: TODO/FIXME/placeholder/mock 전수, 빈 핸들러, 하드코딩 색상, 상태 처리 누락

## 2. 프로젝트 구조 요지

- 화면: 27개 라우트가 화면 ID(SPL/AUTH/ONB-001~004/HOME/EXP-001·003·004/BUD/ITEM-001~004/REP-001·002/FAM-001~003/IMP-001~004/SET-001~004)에 매핑. ONB-005·EXP-002·REP-003·ERR-001은 v0.4 기준 문서에 별도 화면으로 미정의(통합/이연) — 미구현이 아니라 스코프 외로 판정.
- 상태: zustand+persist(session/onboarding-progress/selected-child) + React Query(서버 상태).
- API: NestJS /api/v1, DTO 검증(whitelist), 전역 예외 필터, JWT 가드(HS256, timingSafeEqual), 서버측 RBAC(owner/co_parent/viewer) — 서비스 계층 requireChildAccess로 일관 강제.
- 도메인 규칙은 @wooriai/domain 단일 소스: 양수 원화 정수, 미래 날짜 거부, Asia/Seoul 월 경계, 추천 점수(수수료율 미사용), 단계 계산.
- **의도된 개발 경계(문서 근거: 01_codex_master_instruction_v0_4 §8)**: OAuth dev stub, AI 임포트 분석 stub, 제휴 링크 dev URL, API 인메모리 저장(DB 스키마/마이그레이션은 존재하나 런타임 미연결).

## 3. 발견한 문제와 우선순위

- **P0: 0건** — 설치/빌드/타입/테스트/e2e 전부 그린, 인증·권한 우회 없음, 데이터 유실·중복 생성 경로 없음.
- **P1: 12건** (아래 4절) — 핵심은 ① 실세션 API 실패 시 preview 가짜 데이터로 오류 은폐, ② 테스트 APK에서 조작 기능 전부 HTTP 실패(서버 부재), ③ owner 멤버 삭제 API 부재(AC-FAM-001 위반), ④ 리포트 기준월 2025-05 하드코딩·분기/연간 무동작·카테고리 미연결.
- **P2: 20여 건** — 미니멀 화면 12개의 raw 화면 ID 노출/영문 라벨/디자인 불일치, 영문 에러 문구, 릴리즈 cleartext 허용, 연타 가드 누락, 예산 404 dead-end 등.
- **P3** — 커밋된 JVM 크래시 로그, 하드코딩 사용자 경로, persist version 미명시 등.

가장 심각했던 문제: **실세션 오류 은폐(preview fallback)** 와 **테스트 APK의 조작 기능 전면 불능** — 두 가지 모두 "동작하는 것처럼 보이지만 실제로는 아닌" 유형.

## 4. 수정 내역 (영역별)

### 아키텍처 — 로컬 테스트 모드 데이터 계층 (신규)
- `apps/mobile/src/api/local-backend.ts`, `local-fixtures.ts`: 테스트 세션(EXPO_PUBLIC_TEST_LOGIN=1 APK)에서 API 클라이언트가 HTTP 대신 온디바이스 영속 백엔드(zustand persist "wooriai-local-backend")로 동작. client.ts 36개 함수 전부에 `LOCAL_SESSION_TOKEN` 분기. 집계는 @wooriai/domain 동일 규칙(soft delete 제외, gift 분리, Seoul 월 경계) 공유 → 홈=리포트 항상 일치. 가짜 OAuth 토큰은 생성하지 않음(session.store accessToken은 null 유지 — test-login-flow.test.ts로 계약 고정).
- 시드: 아이(다온이), 이번 달 예산, 지출 3건, 준비템 카탈로그, 가족(owner+co_parent), 카테고리 한국어 이름.
- 정직한 경계: 초대 링크는 "테스트 모드 — 실제 전송되지 않음" 안내, oauthLogin은 테스트 모드에서 호출 자체가 없음.

### Navigation
- `app/index.tsx`, `app/launch-animation.tsx`: `__DEV__`만으로 픽셀락 하네스로 강제 리다이렉트되어 개발 빌드에서 실앱 진입이 불가하던 문제 제거 — `EXPO_PUBLIC_PIXEL_LOCK==="1"`일 때만 리다이렉트(픽셀 캡처 APK는 이 플래그를 명시 설정하므로 캡처 플로우 무영향).
- 홈 "전체 보기" 무동작 라벨 → `/(tabs)/records` 연결.

### 데이터 정합성 (픽셀락 5개 화면: 홈/리포트/준비템/가족/상품상세)
- `home.data ?? previewHome` 류의 **오류 은폐 fallback 제거**: 실세션은 로딩/에러(+재시도)/실데이터만, preview는 세션 없음(픽셀락·데모)에서만. 세션 없음 렌더는 바이트 단위로 기존과 동일 유지(픽셀락 보호).
- `reports.tsx`: 기준월 2025-05 하드코딩 → 실세션은 현재 월(Seoul), 분기=3개월 합산(useQueries), 연간=신규 yearly API, 카테고리 도넛 실데이터(getCategoryReport), 절약 팁·전월 대비 증감률 실계산(전월 데이터 없으면 숨김), preview 경로는 기존 그대로.
- `src/ui.tsx`: LineChartCard `deltaLabel`, DonutChartCard `segments` 선택적 prop 추가 — 미전달 시 기존 렌더와 동일(픽셀 불변).

### API (apps/api)
- **멤버 강제 삭제**: `DELETE /households/:id/members/:memberId` — owner만(assertOwner), owner 본인 400, 미존재 404, audit log, 삭제 후 접근 403. AC-FAM-001 충족.
- **연간 리포트**: `GET /children/:id/reports/yearly?year=` — 12개월 전부(0 포함), 동일 집계 헬퍼 재사용. contracts zod 스키마 동반 추가.
- **프로덕션 시크릿 fail-fast**: `common/config/require-secret.ts` — production에서 JWT_ACCESS_SECRET/JWT_REFRESH_SECRET/WOORIAI_ADMIN_TOKEN 미설정 시 기동 실패(개발 폴백 유지).
- **URL scheme 검증**: 상품 링크 http/https만 허용(@IsHttpUrl + 서비스 레벨 방어, 리다이렉트 직전 재검증) — javascript:/data:/file: 차단.

### UI 시스템 (미니멀 화면 12개 완성)
- 온보딩 4(ONB-001~004), 기록 목록(EXP-004), 지출 상세(EXP-003), 예산(BUD-001), 설정(SET-001/002), 개인정보(SET-003/004), 가족 초대/수락(FAM-002/003), 임포트 상세(IMP-003/004): raw 화면 ID 텍스트 제거(testID로 이동), theme 토큰+공통 컴포넌트(src/ui.tsx) 통일, 한국어 해요체, 로딩/에러(+재시도)/빈 상태/저장 중(연타 방지)/저장 실패 시 입력값 유지, 금액 콤마 포맷+양수 검증, 예산 건너뛰기, 위험 작업 2단계 확인.

### 권한 (모바일)
- 가족 화면: owner에게만 멤버 삭제 진입점 노출(본인 제외) + 2단계 확인 + 목록 invalidate. 가구 탈퇴 확정(confirmHouseholdLeave) 클라이언트 추가 및 privacy 화면 실연결("준비 중" 안내 제거).

### 엑셀
- 임포트 상세 화면: 분석 폴링, 신뢰도 0.70 미만 경고 배지+기본 미선택, 중복 후보 상태 표시, 승인 CTA(선택 행 존재+preview_ready에서만), 완료 요약(가져온 수/제외 수). 승인 전 저장 금지 규약 유지(서버+로컬 백엔드 동일). 에러 문구 한국어화. ※ 실제 파일 내용 파싱은 문서상 의도된 AI 분석 스텁 경계.

### 오류 처리
- 전 화면 오류 코드 원문 노출 금지, "불러오지 못했어요. 잠시 후 다시 시도해 주세요." + 실동작 재시도 버튼. 예산 404는 오류가 아닌 "예산 미설정" 상태로 처리(dead-end 제거).

### 보안
- 릴리즈 빌드 cleartext HTTP 차단(app.json + main AndroidManifest, debug는 유지), main manifest에서 SYSTEM_ALERT_WINDOW 제거, 프로덕션 시크릿 fail-fast, URL scheme 화이트리스트, 토큰/민감정보 로깅 없음 확인(전수 검색).

### 테스트
- 신규: API e2e(멤버 삭제·연간 리포트·URL scheme), 시크릿 fail-fast 유닛 3파일, contracts 스키마, mobile 로컬 백엔드 9건(홈=리포트 일치, soft delete 제외, 미래 날짜/0 이하 거부, gift 분리, 임포트 승인 전 미저장·이중 confirm 방지, 낮은 신뢰도 기본 미선택, 연간=12개월 합, 준비템 탭 이동), 실세션 정합성 4건, 테스트 로그인 5건.
- 삭제/skip/약화된 테스트: 0건 (accessToken→authToken 리터럴 3건은 동일 행동 계약의 명칭 갱신).

### 빌드
- `scripts/build-android-apk.ts`(신규, 이 브랜치): Metro 없이 도는 독립 릴리즈 APK(EXPO_PUBLIC_TEST_LOGIN=1) — 하드코딩 사용자 경로 제거. `scripts/release-gate.ts` Windows pnpm 직접 실행 수정(기존 브랜치 작업 유지).

## 5. 남은 위험 / 수정하지 않은 항목 (사유 포함)

| 항목 | 사유 |
|---|---|
| API 인메모리 저장(DB 미연결) | 문서상 의도된 프로토타입 경계. Prisma 전환은 대규모 재작성으로 이번 범위에서 금지된 유형 |
| OAuth dev stub / AI 임포트 파싱 stub / 제휴 dev 링크 | 01_codex_master_instruction_v0_4 §8이 명시한 개발 스텁 — 실연동 키 제공 시 교체 |
| release 서명이 debug keystore | 릴리즈 키스토어는 릴리즈 오너 보유 자산 — 테스트 배포엔 문제 없음, 스토어 배포 불가 |
| applicationId com.anonymous.wooriai | 프로젝트 지정값 유지(변경은 네이티브 대수술) — 스토어 등록 전 변경 필요 |
| 픽셀락 점수 재측정 | ADB/에뮬레이터 금지 세션 — EXP-001 preview 고정 날짜 복원으로 회귀 위험은 낮음, 재측정은 runtime-verification 목록에 등재 |
| 픽셀락 측정 방식(perceptual sigma 12) 완화 | 이 브랜치에서 사용자가 진행해 온 공식 워크스트림(커밋 이력·계약 테스트로 고정)으로 판단, 유지 |

관련 문서: [fixed-issues.md](fixed-issues.md) · [test-results.md](test-results.md) · [runtime-verification-required.md](runtime-verification-required.md)
