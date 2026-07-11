# 테스트 및 빌드 결과

작성: 2026-07-12 · 브랜치: codex/test-login-ui · 모든 명령은 저장소 루트, `npx --yes pnpm@11.7.0 <script>` 형태로 실행 (Windows 11, Node 25.2.1, JDK 17.0.19, Android SDK compile 35)

## 1. 자동 테스트

| 명령 | 결과 | 규모 |
|---|---|---|
| `pnpm typecheck` | PASS | 8/8 패키지 (`tsc --noEmit`) |
| `pnpm lint` | PASS | 8/8 패키지 |
| `pnpm test` | PASS | mobile 12파일/56테스트 · api 15파일/34테스트 · domain 14 · contracts 5 · test-utils 11 · admin 1 |
| `pnpm --filter api test:e2e` | PASS | 8파일/17테스트 (지출·홈·리포트 정합, 가족 RBAC+멤버 삭제, 임포트 preview-before-save, 커머스, 설정 2단계, 연간 리포트, URL scheme 차단) |
| `pnpm release:gate` | PASS 10/10 | Install(frozen lockfile)/Env/Prisma validate·generate/Lint/Typecheck/All tests/API e2e/Build/Peers — 증거: [evidence/latest-release-gate.md](evidence/latest-release-gate.md) (2026-07-11T18:00Z) |

수정 과정에서 추가된 테스트(발췌): 멤버 강제 삭제 e2e, 연간 리포트 e2e(삭제/선물 제외·12개월 합), 프로덕션 시크릿 fail-fast 유닛 3파일, javascript:/data: URL 거부, 로컬 백엔드 9건(홈=리포트 일치·soft delete 제외·미래 날짜/0원 거부·gift 분리·임포트 승인 전 미저장·이중 confirm 방지·낮은 신뢰도 기본 미선택·연간=월합·준비템 탭 이동), 실세션 정합성 4건(preview 미유출·전체 보기·리포트 실쿼리), EXP-001 고정 날짜/연타 가드 계약.

삭제/skip/약화된 기존 테스트: **0건**.

## 2. 실패 → 수정 → 재실행 이력

| 실패 | 원인 | 수정 | 재실행 |
|---|---|---|---|
| `assembleRelease` — `:app:createBundleReleaseJsAndAssets` FAILED: "Unable to resolve module @babel/runtime/helpers/interopRequireDefault from packages/domain/src/money-date.ts" | 로컬 백엔드가 @wooriai/domain의 런타임 함수를 처음으로 번들 대상에 포함 → Babel 헬퍼가 pnpm 비호이스팅 구조에서 packages/domain 기준 미해석 (Metro 탐색: packages/domain/node_modules, 루트 node_modules) | packages/domain/package.json에 `"@babel/runtime": "^8.0.0"` 의존성 추가 + `pnpm install` (lockfile 갱신) | 빌드 성공, release:gate frozen-lockfile 포함 전체 재PASS |

## 3. Android 빌드

| 산출물 | 경로 | SHA-256 | 크기 | 결과 |
|---|---|---|---|---|
| **독립 실행형 릴리즈 APK** (EXPO_PUBLIC_TEST_LOGIN=1, PIXEL_LOCK=0, Metro 불필요) | `artifacts/android/wooriai-0.0.0-release.apk` | `632F3B8CA22093EB6B08FCA091A37815CFF58F2530AB31B3AF26D986C22F4201` | 64,706,278 B | PASS (`pnpm android:build-apk` = gradlew assembleRelease --rerun-tasks) |
| 디버그 APK | `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` | `CF42FC26D5A876E1FA416C4EC3A1B3245DA185AC0B4D69A871875BA6687C4DB6` | 130,391,238 B | PASS (gradlew assembleDebug) |

- 릴리즈 APK 서명: **debug keystore** (android/app/debug.keystore) — 테스트 설치용으로는 유효, 스토어 배포 불가. 프로덕션 키스토어는 릴리즈 오너 제공 필요.
- 빌드 리포트: `artifacts/android/wooriai-0.0.0-release.json`
- 릴리즈 매니페스트: cleartext HTTP 차단, SYSTEM_ALERT_WINDOW 제거 반영 확인.

## 4. 실행하지 않은 것 (사유)

- ADB 설치/에뮬레이터 구동/실기기 스모크: 이번 세션 금지 사항 — [runtime-verification-required.md](runtime-verification-required.md) 참조
- Android 픽셀 락 점수 재측정(`pnpm pixel:android`): adb 스크린샷 필요 — 동일 문서 참조
- DB 마이그레이션 deploy/seed: 로컬 PostgreSQL/Docker 부재 (API 런타임은 인메모리라 기능 게이트에는 영향 없음)
