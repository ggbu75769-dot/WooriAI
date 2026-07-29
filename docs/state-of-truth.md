# WooriAI State of Truth

측정 시각: 2026-07-30 07:49 KST

이 문서는 버전명이 아니라 실행 결과, Git 커밋, CI 실행 ID로 현재 좌표를 고정한다. 날짜가 붙은 과거 완료 보고서보다 이 문서가 우선한다.

## 제품 설정

- 제품 한 줄 정의: 보호자가 아이별 지출을 기록하고, 준비물을 근거와 함께 선택·구매·사후 관리하며, 가족과 권한을 나눠 운영하는 모바일 앱.
- 로컬 실행: `pnpm db start`, `pnpm --filter api start:dev`, `pnpm --filter mobile start`.
- Android 검증 실행: `pnpm pixel:android:build-apk`, `pnpm pixel:android`.
- 프로덕션 URL: 없음. 승인된 운영 API·Admin·스토어 배포 빌드 ID도 없다.
- 핵심 사용자 과업:
  1. 아이를 선택하고 지출을 기록해 월 합계와 기록에 반영한다.
  2. 준비템을 비교하고 구매 링크로 이동한 뒤 구매·사용 상태를 기록한다.
  3. 월간·주간 리포트에서 지출과 준비 진행의 근거를 확인한다.
  4. Excel 지출을 미리 본 뒤 확정 저장한다.
  5. 가족을 초대하고 역할별 권한으로 함께 관리한다.
- 절대 금지: P0 화면 ID 변경, 5개 하단 탭 변경, 구매 CTA 인접 제휴 고지 제거, 수수료 기반 추천 순위 변경, Excel 미리보기 생략, 가족 RBAC 완화, 안전·리콜 동작의 fail-open 처리.
- 승인 없이 변경하지 않는 항목: 운영 비용, 외부 공개·스토어 제출, 파괴적 DB/운영 데이터 작업, 인증·권한·시크릿, 법적 문서의 실질 내용, 불변 조항 완화.

## Git 좌표

| 항목 | 실측값 | 재현 명령 |
| --- | --- | --- |
| 저장소 | `ggbu75769-dot/WooriAI` (private) | `gh repo view --json nameWithOwner,isPrivate` |
| 브랜치 | `codex/wooriai-apk-feedback-ux-hardening-v1` | `git branch --show-current` |
| 측정 대상 제품 소스 | `9c82096` | `git log -1 --format=%H -- apps/mobile` |
| 측정 시 upstream 차이 | behind 0 / ahead 10 | `git rev-list --left-right --count '@{upstream}...9c82096'` |
| 제품 소스 실변경 | Android 구매 CTA가 `Linking` 수신자를 보존하고 실제 URL 열기를 최종 판정으로 사용 | `git show --stat --oneline 9c82096` |
| 현재 게이트 구현 | `37ad654` | `git log -1 --format=%H -- scripts/release-gate.ts` |
| 이 보고서를 담은 커밋 | 동적 조회 | `git log -1 --format=%H -- docs/state-of-truth.md` |

측정 대상 제품 소스는 아직 원격에 push하지 않았으므로 GitHub CI 실행이 없다. 원격 최신 제품 HEAD는 `aae301b6286b57ea505fb3cb55ef182c2bade195`다. 이 보고서 커밋은 제품 코드를 바꾸지 않으며, 최종 저장소 HEAD와 upstream 차이는 위 동적 명령으로 확인한다.

## 실제 소스 표면

| 표면 | 수치 | 재현 명령 |
| --- | ---: | --- |
| Expo Router route 파일 | 56 | `rg --files apps/mobile/app \| Where-Object { $_ -match '\.(ts\|tsx)$' }` |
| API Nest module | 26 | `rg --files apps/api/src \| Where-Object { $_ -match '\.module\.ts$' }` |
| API controller | 37 | `rg --files apps/api/src \| Where-Object { $_ -match '\.controller\.ts$' }` |
| Admin App Router page | 14 | `rg --files apps/admin/app \| Where-Object { $_ -match 'page\.(ts\|tsx)$' }` |
| 하단 탭 | 5 (`홈/기록/준비템/리포트/더보기`) | `Get-Content 'apps/mobile/app/(tabs)/_layout.tsx'` |
| CI workflow | 1 (`CI`) | `Get-ChildItem .github/workflows -File` |

실제 루트 매니페스트는 lint, typecheck, test, build, release gate, catalog audit, Android build, Android Pixel Lock, 보안·환경 검사를 제공한다. 명령 원본은 `package.json`이다.

## 실행·게이트 실측

동일 소스에서 2026-07-30 KST에 생성한 `docs/qa/evidence/latest-release-gate.json`을 기준으로 한다.

| 검증 | 결과 | 실측 |
| --- | --- | --- |
| 로컬 Release Gate | PASS | `pnpm release:gate` → 16/16 |
| 전체 모노레포 테스트 | PASS | Release Gate 내부 `pnpm test --concurrency=1 --force` |
| API E2E | PASS | Release Gate 내부 `pnpm --filter api test:e2e` |
| Admin browser E2E | PASS | Release Gate 내부 `pnpm test:admin-browser` |
| production build | PASS | Release Gate 내부 `pnpm build --force` |
| 모바일 회귀 | PASS | mobile Vitest 107 files / 626 tests, mobile typecheck, 전체 lint |
| Release Gate 동시 실행 | PASS | 두 번째 full/dry-run subprocess가 exit 2 + `RELEASE_GATE_ALREADY_RUNNING`; test-utils 3 files / 28 tests |
| Release Gate lock 정리 | PASS | 최종 16/16 정상 종료 뒤 `.toolcache/release-gate.lock` 없음 |
| 일반 Android 과업 | PASS | 준비 상태 `알아보기` → 판매처 Chrome 열기 → 홈 구매 후속 → 아기 체온계 15,000원 지출 → 합계·동기화 반영 |
| Android standalone 동일성 | PASS | built SHA-256 = installed `base.apk` SHA-256 = `089732...1A5D4` |
| Android 구매 후속 | PASS | final-source APK에서 Chrome `ChromeTabbedActivity`, 홈 후속 카드, 15,000원 기존 기록 유지, `구매 안 했어요` 후 카드 제거 |
| Android Pixel Lock | PASS / CURRENT SOURCE SNAPSHOT | snapshot `721590...DBFA1`, adb screencap 9/9, 최고 REP-001 `0.0474`; 전 화면 `<= 0.0480` |

Android 증거:

- current standalone APK: `F:/WooriAI/wooriai-0.0.0-release-standalone.apk`
- current APK / installed base SHA-256: `089732BAD02BF9D872466206A177619F786CF77C1C0DEA8BEFAB01465431A5D4`
- current source snapshot SHA-256: `721590F9398B07C5E3C9E8D451E360B0051DA852DE5CF15DBD2BCB15E20DBFA1`
- current embedded bundle SHA-256: `2A9F99371790CBC3B3B11E6B6D7875DD5197BB51930052B40B007EC81121687C`
- current report: `artifacts/android/wooriai-0.0.0-release-standalone.json`
- walkthrough: `docs/walkthrough/2026-07-30.md`
- current Pixel APK: `F:/WooriAI/wooriai-pixel-df4ff4a31ed61be13f1c05392e80ed68d0ecf56959025563dd100c10894d33ed.apk`
- current Pixel APK / installed base SHA-256: `DF4FF4A31ED61BE13F1C05392E80ED68D0ECF56959025563DD100C10894D33ED`
- current Pixel source snapshot SHA-256: `721590F9398B07C5E3C9E8D451E360B0051DA852DE5CF15DBD2BCB15E20DBFA1`
- current Pixel report: `artifacts/pixel-lock/android/reports/latest.md`

standalone과 Pixel APK는 제품 커밋 `9c82096`과 동일한 모바일·네이티브 source snapshot `721590...DBFA1`을 포함한다. Pixel 보고서의 `sourceCommit`은 빌드 당시 pre-commit HEAD를 기록하지만 snapshot 전후 검증은 `VERIFIED_STABLE`이고, 해당 제품 파일은 이후 `9c82096`으로 변경 없이 커밋됐다.

## CI 현재 상태

`.github/workflows/ci.yml`에는 `quality-and-integration`, `android-compile`, `container-security` 3개 job이 있다.

| 실행 | HEAD | 결과 | 원인 |
| --- | --- | --- | --- |
| GitHub Actions run `30382997599` | `aae301b` | failure, 1/3 실패 | job step 시작 전 결제 실패 또는 spending limit 안내 |

재현 명령:

- `gh run list --workflow CI --limit 12`
- `gh run view 30382997599 --json jobs,conclusion`
- `gh api repos/ggbu75769-dot/WooriAI/check-runs/90355214182/annotations`

이는 코드 테스트 실패가 아니라 GitHub Actions 실행 인프라 차단이다. 2026-07-28의 해당 실행에는 step과 실패 로그가 없고 annotation 1건만 있다.

## 실사용 데이터

- 코드상 위치: PostgreSQL `analytics_events`; API `POST /api/v1/analytics/events`; 모바일 큐 `apps/mobile/src/analytics/client.ts`.
- 로컬 개발 DB 실측: 이벤트 0, 익명 사용자 0, 익명 가구 0.
- 재현 명령: `psql ... -c 'SELECT COUNT(*) AS total_events, COUNT(DISTINCT user_anon_id), COUNT(DISTINCT household_anon_id) FROM analytics_events;'`.
- 운영 분석 DB/로그 위치: 없음.
- 결론: 퍼널 완주율·재사용률은 분모가 없어 계산하지 않는다. 로컬 0건을 실사용 0명으로 해석하지 않는다.

## 정직성 경계

- 로컬 Release Gate, source-bound standalone Android 과업, current-source Android Pixel 9/9은 내부 후보 품질을 증명한다.
- 프로덕션 배포, 실제 OAuth, production signing, 운영 백업 복구, closed beta, 물리기기 TalkBack, iOS는 증명하지 않는다.
- 일반 standalone은 비제휴 테스트 판매처이므로 실제 제휴 고지 런타임은 발생시키지 않았다. ITEM-002 Pixel fixture와 정적 회귀가 고지-CTA 인접성을 증명하고, standalone은 판매처 열기·복귀·구매 후속·지출 기록을 증명한다.
- 프로덕션 화면이 없으므로 현재 수집 가능한 대외 노출 주장과 배포 HEAD 일치 여부는 `NOT APPLICABLE / NOT DEPLOYED`다.
