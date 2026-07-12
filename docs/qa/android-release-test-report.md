# Android Release APK 테스트 리포트

작성: 2026-07-12 · 브랜치: codex/source-audit-standalone-apk · 검증 환경: Windows 11, android-35 에뮬레이터(Pixel 7, x86_64, Android 15), JDK 17.0.19, Node 25.2.1

**브라우저 미리보기가 아니라 실제 Android release APK를 에뮬레이터에 설치하여 검증했다.**

## 1. 빌드 산출물

| 항목 | 값 |
|---|---|
| APK 경로 | `artifacts/android/wooriai-0.0.0-release.apk` |
| SHA-256 | `c979d278bb34be5ebc10ee39ae2fc988cf246b8e23a56935fdad111f34b52708` |
| 크기 | 64,707,798 B |
| 빌드 태스크 | `assembleRelease --rerun-tasks` (Metro 불필요) |
| env | `EXPO_PUBLIC_TEST_LOGIN=1`, `EXPO_PUBLIC_PIXEL_LOCK=0` |
| package | `com.anonymous.wooriai` |
| version | 0.0.0 |
| 서명 | debug keystore (테스트 설치용, 스토어 배포 불가) |

## 2. APK 런타임 검증 시나리오 (수정 반영 APK, clean install)

| # | 시나리오 | 결과 | 증거 |
|---|---|---|---|
| 1 | 앱 실행 → 스플래시/온보딩 인트로 → 로그인(AUTH-001) | PASS | r01-launch.png |
| 2 | 동의 2개 체크 → 테스트 계정 로그인 → 홈 진입 | PASS | r02-home.png |
| 3 | 홈: 이번 달 97,200원, 예산 1,600,000원, 최근 지출 3건, 다온이 24개월 | PASS | r02-home.png |
| 4 | **지출 시트(세션): 금액 빈 값("₩ 0"), 저장 버튼 disabled** | PASS(수정 확인) | r03: enabled=false |
| 5 | 금액 15,000 입력 시 저장 버튼 활성화 | PASS | r04: enabled=true |
| 6 | 식비 카테고리 저장 → 홈/기록 합계 즉시 반영 | PASS | r04-filled.png |
| 7 | **리포트 카테고리 비중: 한국어명(기저귀/분유·유제품/유아용 세제/식비), raw ID 없음** | PASS(P0-1 수정) | r05: 기저귀41%·식비13% |
| 8 | **새 식비 카테고리가 별도 집계로 분리** | PASS(P0-1 수정) | r05 |
| 9 | 홈=리포트 일치(총 ₩112,200 = 누적 ₩112,200) | PASS | r05-reports.png |
| 10 | **상품 상세: 대표가 89,000원(실 가격대), 허위 평점 ★4.8 제거, 판매처 89,000원** | PASS(P1-3 수정) | r06: 89,000원 |
| 11 | 제휴 고지가 구매 CTA 인접 표시 | PASS | r06 |
| 12 | 계정 삭제 2단계 확인(preview → "정말 삭제할까요?") | PASS | r08/r09 |
| 13 | **계정 삭제 후 launch 화면 복귀(라우팅)** | PASS(P1-8 수정) | r10-after-delete.png |
| 14 | **재로그인 시 삭제 전 데이터 없이 깨끗한 시드 복원(로컬 리셋)** | PASS(P1-8 수정) | r12: 97,200원, 식비 없음 |
| 15 | 지출 생성/수정(5,000)/삭제(2단계) — soft delete 후 합계 제외 | PASS | (이전 빌드) 07~13 |
| 16 | 앱 재실행 후 데이터 유지 | PASS | 20-relaunch / loop-relaunch |
| 17 | 준비템 목록 실 fixture(아기띠 89,000원), 상태 탭 | PASS | 15-items.png |
| 18 | 엑셀 임포트(IMP-003) 승인 흐름, 영문 문구 한국어화 | PASS | 19-import + 소스 수정 |
| 19 | 가족(FAM-001): owner 멤버 삭제 버튼 노출(RBAC) | PASS | 21-profile.png |

## 3. 반복 회귀 검증

### 3.1 전체 릴리즈 게이트 3회 연속

| 실행 | 결과 |
|---|---|
| GATE RUN 1 | PASS (turbo 8 successful/8, evidence written) |
| GATE RUN 2 | PASS (8 successful/8) |
| GATE RUN 3 | PASS (8 successful/8) |

- 3회 전체에서 FAIL/error/Command failed: **0건** (`artifacts/gate-3x.log`).
- 게이트 구성: install(frozen)/env/prisma validate·generate/lint/typecheck/all tests/API e2e/build/peers.
- 자동 테스트 규모: 모바일 12파일/56 + API 16파일/46 + API e2e 8파일/17 + domain/contracts/config/ui/test-utils.

### 3.2 지출 핵심 흐름 20회 반복 (APK, adb 자동화)

- 방법: 홈/기록 → 빠른 지출 기록 → 금액 1,000원 → 카테고리 → 저장, 20회 반복.
- **합계 = 97,200 + 20×1,000 = 117,200원 (정확히 일치)** → 중복 생성 없음, 합계 불일치 없음.
- crash 없음(루프 후 `topResumedActivity` 생존 확인).
- **재실행 후 117,200원 유지**(persist).
- 메모리: 루프 전 PSS 123MB → 루프 직후 212MB → **프로세스 재시작 후 100MB로 복귀** → 누적 캐시일 뿐 영구 누수 아님.
- 증거: `artifacts/smoke/loop-final.xml`(117,200원), `loop-relaunch.xml`(재실행 유지).

## 4. 실행하지 않은 것 (사유)

- 실 OAuth 로그인, 실 API 서버(https) 연결 빌드, DB 영속 — 외부 키/인프라 의존([known-limitations](../operations/known-limitations.md)).
- Android 픽셀락 점수 재측정(`pnpm pixel:android`) — perceptual diff는 별도 캡처 워크스트림. 이번 수정은 세션 있음 경로만 변경하여 preview(픽셀락 캡처) 경로는 바이트 보존(계약 테스트 통과).
