# 2026-09-22 출시 준비 및 검증

현재 판정: **로컬 출시 게이트 PASS / Android 에뮬레이터 기능 검증 PASS / 운영 연결 및 Play 제출 EXTERNAL_BLOCKED**.
이 문서는 이번 실행의 증거만 기록한다. 내부 APK나 로컬 테스트 성공을 실제 카카오 로그인, 운영 배포 또는 Play 승인으로 해석하지 않는다.

## 변경

- Expo 54.0.37 / React Native 0.81.5 / React 19.1로 Android API 36 및 16KB 지원 기반을 갱신했다. 기존 아키텍처를 유지하고 Android 시스템 영역을 피하도록 화면 루트의 safe area를 보완했다.
- SDK 54의 Metro 제외 목록이 배열인 점을 반영했다. 기존 조합 방식이 빈 정규식 분기를 만들어 진입 파일까지 제외하는 빌드 실패를 재현하고, 앱 입력 보존 및 도구/생성 파일 제외 회귀 테스트 10개를 추가했다.
- 카카오 등록용 HTTPS 서버 callback과 고정 앱 복귀 주소를 분리했다. state, 만료, 단일 사용, PKCE, nonce 검증 및 안전한 native 난수를 적용했다. 2026-09-23에 카카오 앱·키·OIDC 설정을 완료했으며 운영 callback 등록과 실제 로그인 검증은 남아 있다.
- Nest 11.2.5 / Next 15.5.25와 영향받는 의존성을 갱신했다. Express 쿼리 해석 동작은 기존 계약을 유지하고 실제 HTTP 회귀 테스트를 추가했다.
- `decode-uri-component@0.2.2`에는 upstream의 유한 실행 UTF-8 디코더를 backport했다. 패치를 Docker 설치에도 포함하고 실제 Expo Router 의존 경로와 긴 비정상 입력을 시험한다.
- 출시 게이트에 Expo 의존성 일치와 운영 의존성 보안 검사를 추가했다. APK 빌드는 현재 설정으로 prebuild한 후 소스 스냅샷의 빌드 전후 일치와 APK SHA-256을 기록한다.
- Windows 서버 점검의 한글 인자 손상과 실패 시 exit 0 반환을 수정했다. 관리자 E2E는 별도의 로컬 DB와 설치된 Chrome을 명시할 수 있다.
- 관리자 standalone 실행에서 정적 HTML의 nonce 누락으로 모든 스크립트가 차단되는 결함을 재현했다. 루트 layout을 요청별 렌더링으로 바꾸고, 브라우저 QA가 두 요청의 HTML/script nonce 일치 및 nonce 비재사용을 확인하도록 추가했다.
- Docker 빌드 컨텍스트에서 APK, AAB, 검증 자료, 서명키와 출시 설정을 제외했다.
- 실제 Docker 빌드에서 중첩된 `.next`가 컨텍스트에 들어가는 문제를 확인했다. `.dockerignore`를 재귀 패턴으로 보완해 중첩 캐시·환경 파일·서명키를 제외했고, 관리자 빌드 컨텍스트가 258.86MB에서 1.62MB로 줄었다.
- Android 화면의 상태표시줄 아이콘을 어둡게 지정하고, 사용하지 않는 `SYSTEM_ALERT_WINDOW` 권한을 Expo 설정에서 차단했다.
- 운영 키가 없을 때 API가 시작 실패를 로그에만 남기고 종료 코드 0을 반환하는 문제를 실제 컨테이너에서 재현했다. 시작 실패를 명시적으로 처리해 코드 1로 종료하도록 수정했다. 운영 모드와 NODE_ENV 누락 상황을 각각 별도 프로세스로 검증하는 회귀 테스트를 추가했다.

## 검증 증거

증거 디렉터리: `artifacts/launch-20260922/`.

| 경계 | 결과 | 증거 |
| --- | --- | --- |
| 전체 자동 테스트 | 517개 파일, 고유 9,378개 테스트 PASS | `release-gate-final-qualification.log` |
| 최종 모바일 전체 재실행 | 324개 파일, 6,564개 테스트 및 typecheck PASS | `release-gate-final-qualification.log` |
| 최종 API 전체 재실행 | 110개 파일, 1,055개 테스트 PASS | `release-gate-final-qualification.log` |
| API E2E 재실행 | 14개 파일, 161개 테스트 PASS | `release-gate-final-qualification.log` |
| 관리자 실제 브라우저 | 18/18 PASS | `admin-e2e.log` |
| 관리자 배포용 standalone | 최초 CSP 차단 재현 후 수정, nonce 검사 포함 18/18 PASS | `admin-production-e2e.log`, `admin-production-fixed-e2e.log`, `admin-csp-build.log` |
| 관리자 최종 HTTP 산출물 | 두 요청의 16개 script nonce 일치, nonce 비재사용, unsafe-eval 없음, icon HTTP 200 PASS | `admin-final-document.json` |
| 서버 핵심 기능 | 37/37 PASS, 종료 코드 0 | `server-smoke-verified.log` |
| 서버 접근 불가 시 실패 전파 | 종료 코드 1 | `server-smoke-negative.log` |
| PostgreSQL 백업·새 DB 복원 | 6/6 대상 테이블 행 수 일치 | `backup-restore.log` |
| 운영 의존성 보안 | critical 0 / high 0 / moderate 1 / low 0 | `audit-final.json` |
| 전체 출시 게이트 | 최종 13/13 PASS, 종료 코드 0 (이번 작업 중 총 3회 전체 통과) | `release-gate-final-qualification.log`, `docs/qa/evidence/latest-release-gate.md`; 이전 `release-gate-verified.log`, `release-gate-final-source.log` |
| 최종 Android APK | 빌드·서명·패키지·API 36·16KB ZIP 정렬 PASS, overlay 권한 없음 | `android-build-handoff.log`, `final-apk-*.log` |
| 64비트 네이티브 라이브러리 | 28/28 ELF 16KB 정렬 PASS (전체 4 ABI, 56개 라이브러리) | `final-apk-elf.json` |
| 최종 APK 설치 일치 | 빌드 파일과 설치된 base.apk SHA-256 일치, API 36 / 4KB 에뮬레이터 | `final-device-install.json` |
| Android 16KB 실제 실행 | API 36 x86_64, 페이지 크기 16,384바이트, 호환 보정 OFF에서 저장·재시작 PASS | `16kb-device-evidence.json`, `android-runtime-16kb/`, `16kb-app-errors-final.log` |
| 16KB RELRO 보호 범위 | 64비트 28/28 라이브러리의 보호 범위가 다른 쓰기 데이터를 침범하지 않음 | `final-apk-elf-protection.json` |
| Android 일반 화면 | 온보딩·지출·총액·준비템·연결 지출·CSV·오프라인, 최종 APK의 수정·선물 제외·삭제·PIN 검증 PASS | 아래 Android 검증, `android-runtime/` |
| 최종 Android 설정 회귀 | 4개 파일 29개 테스트 및 모바일 typecheck PASS | `android-final-config-tests.log` |
| 출시 입력 검사 | EXTERNAL_BLOCKED — 당시 필수 4개 값 미입력; 2026-09-23 실제 호스팅 사업자도 필수로 변경 | `launch-input-check.log` |
| 운영 AAB 사전 검사 | EXTERNAL_BLOCKED — 운영 API 주소 미입력, 빌드 전 중단 | `aab-readiness-check.log` |
| Docker API·관리자 이미지 | 두 이미지 빌드 PASS, 최종 API·관리자·PostgreSQL healthy | `docker-api-bootstrap-fix-build.log`, `docker-admin-build-final.log`, `docker-final-state.txt` |
| Docker 마이그레이션·시드 | 27개 마이그레이션 PASS, 재시드 시 기존 콘텐츠 보존 | `docker-migration.log`, `docker-seed.log`, `docker-seed-idempotent.log` |
| Docker 관리자 실제 브라우저 | MFA·CSP·역할 제한 포함 18/18 PASS | `container-admin-e2e.log` |
| Docker 운영 모드 HTTP | 건강 상태·DB·worker·접근 차단·개발 로그인 차단·CSP·아이콘 9/9 PASS | `container-http-qa.json` |
| Docker 재시작·자료 보존 | 전체 재시작 후 4개 테이블 내용 SHA-256 일치, HTTP 9/9 재검증 PASS | `container-db-after-restart.json`, `container-http-after-restart.json` |
| API 시작 실패 전파 | 수정 전 2개 회귀 테스트 실패, 수정 후 11개 관련 테스트·typecheck 및 컨테이너 exit 1 PASS | `api-startup-regression-before.log`, `api-startup-regression-after.log`, `docker-missing-secrets-fixed.log` |
| 실제 카카오 로그인·운영 서버·Play | NOT_RUN — 카카오 앱 설정 완료, 운영 callback/서버·Play 검증 필요 | 아래 외부 입력 |

보안 검사에 남은 moderate 1건은 패치한 decoder의 버전 기반 경고다. 경고를 무시 목록으로 숨기지 않았다. 초기 검사 critical 3 / high 68 / moderate 28 / low 4에서 갱신 및 코드 패치를 수행했다.

포터블 PostgreSQL의 테스트 DB는 `wooriai_launch_20260922_test`, 서버·브라우저 점검 DB는 `wooriai_launch_20260922_runtime`이다. 추가 컨테이너 검증은 별도 포트 35432의 전용 `wooriai` DB와 그 서버의 `wooriai_launch_20260922_test` DB에서 수행했다. 모두 작업용 로컬 DB이며 운영 DB를 사용하지 않았다. API E2E 161건은 전체 자동 테스트에도 포함되므로 고유 테스트 수에 중복 합산하지 않는다.

앞선 전체 게이트 실행 중 Metro 설정의 native bundle 결함을 발견했다. 별도 10개 회귀 테스트, Android Hermes 번들 export, 모바일 전체 테스트로 수정 결과를 확인했다. 이후 API 시작 실패 회귀 2개를 추가했다. 최종 전체 게이트의 합계는 관리자 838 + 공통 테스트 도구 695 + 도메인 139 + API 1,055 + 계약 87 + 모바일 6,564 = 고유 9,378개다.

마지막 재검증의 첫 시도에서는 가족 화면 테스트 1개가 `<Stack>` 설정 문자열 전체를 고정해 상태표시줄 옵션 추가를 오탐했다(`release-gate-container-fixes.log`). 앱 동작은 유지하고 해당 Stack의 `headerShown: false`를 직접 검사하도록 고쳤다. 관련 18개 테스트 통과 후 전체 게이트를 재실행해 13/13 PASS를 확인했다. 이 실패 기록은 보존했고 통과로 집계하지 않았다. 최종 게이트 완료 시각은 2026-09-22 22:43 KST다.

합산 결과는 `final-qualification-summary.json`에 기록했다. 검증 종료 후 다른 DB 클라이언트 연결이 없음을 확인하고 이번 게이트에서 시작한 포터블 PostgreSQL도 정상 정지했다(`portable-qa-db-stop.log`). DB 자료는 보존했다.

관리자 E2E 비공개 캡처에는 로컬 테스트 계정의 MFA 등록 정보가 포함될 수 있으므로 `admin-*-private/`를 스토어 자료나 공개 증거로 배포하지 않는다. 최초 및 CSP 수정 직후의 브라우저 기록에는 권한 거부 시나리오의 403과 누락된 favicon의 404 한 건이 있다. 앱의 기존 아이콘을 관리자 favicon으로 재사용했고 최종 standalone의 HTML 참조와 PNG 응답 200을 확인했다.

## Android 일반 화면 검증

Pixel Lock을 끈 standalone APK를 작업 전용 Android API 36 에뮬레이터 `emulator-5582`에 설치했다. 다른 프로젝트의 `emulator-5580`은 건드리지 않았다. 테스트 로그인과 합성 사용자 `AstraQA`를 사용했으며 실제 카카오·운영 API·물리 기기 검증과 구분한다.

최종 APK: `F:\WooriAI\wooriai-0.0.0-release-standalone.apk`.

- APK SHA-256: `2bce42f267357390b803ea6aef5761132c92d6cdb5b1f4032e58c2e16e555a97`
- 소스 스냅샷 SHA-256: `1d38ec9381315ac6655a5c1174c17cb1a839ad204cc79928c9af3f44f8456137`
- 서버 및 테스트 수정 후에도 현재 네이티브 앱 입력과 이 APK가 같은 해시임을 재확인했다(`final-source-recheck.json`).
- `kr.wooriai.app`, versionName `0.0.0`, versionCode `1`, minSdk 24, target/compileSdk 36.
- 내부 debug 키 서명, 테스트 로그인 활성화, Pixel Lock 비활성화. **Play 제출용 AAB가 아니다.** 빌드 보고서는 `artifacts/android/wooriai-0.0.0-release-standalone.json`.

상태표시줄/권한 마무리 수정 전 APK의 SHA-256은 `aeb324fa83292ef2e37acc0097ca9dd9571f5adc0c0882e3513b85881605efeb`이다. 이 파일에서 다음 흐름을 직접 확인했다. 소스 스냅샷과 빌드 보고서는 `initial-apk-build-report.json`, 화면/XML은 `android-runtime/`에 보관했다.

- 필수 동의 2개 → 테스트 로그인 → 아이 등록 → 준비템 선택 → 월 예산 500,000원 저장.
- 기저귀 지출 22,000원 저장 → 기록 목록 및 리포트 총액 22,000원 일치.
- 준비템 상세에서 구매 링크를 눌러 외부 Chrome으로 이동. Chrome 첫 실행 안내까지 확인했으며 판매처 페이지 로딩이나 실제 구매는 검증하지 않았다.
- 준비템 보유 상태 변경 → 연결 지출 15,000원 저장 → 준비율 2/3(67%)와 홈 총액 37,000원, 남은 예산 463,000원 확인.
- 비행기 모드에서 앱 강제 종료 후 재실행 → 프로필과 총액 37,000원 유지. 점검 뒤 비행기 모드를 해제했다.
- CSV 기간 선택 → Android 공유 창에서 22,000원과 15,000원 두 행 확인. 수신자를 선택하거나 전송하지 않았다.

최종 APK를 재설치한 후 다음을 다시 확인했다. `final-device-install.json`은 설치된 APK를 다시 꺼내 빌드 파일과 SHA-256을 대조한 결과다. `final-capture-manifest.json`에는 최종 소스/설치 APK에 연결된 PNG·XML 증거 파일 59개의 해시를 기록했다.

- 기존 총액 37,000원과 준비 상태 2/3 보존, 상태표시줄 시간·아이콘 가독성 개선 확인.
- 지출 22,000원 → 23,000원 수정으로 합계 38,000원 반영.
- 해당 지출을 선물로 바꾸면 23,000원을 합계에서 제외하고 15,000원 표시. 삭제 확인 후 기록 1건·15,000원으로 갱신되며 리포트와 홈도 일치.
- 홈·기록·준비템·리포트 네 탭, 프로필·설정 화면 정상 표시.
- PIN 잠금 설정 → 앱 강제 종료/재실행 시 잠금 → 잘못된 PIN 거부 → 올바른 PIN 해제 → 설정에서 잠금 끄기 완료.
- 잠금 중 `uiautomator dump --compressed`의 접근성 트리에 뒤쪽 아이 이름·지출 금액·탭 항목이 없음을 확인. TalkBack 음성 조작의 물리 기기 시험까지 수행한 것은 아니다.
- 실행 중 `wooriai://oauth/kakao` 복귀 Intent가 미등록 화면으로 이동하거나 현재 화면을 없애지 않음을 확인. 실제 provider 인증·토큰 교환은 별도 미검증이다.
- 최종 검사 구간의 ReactNativeJS/AndroidRuntime 오류 로그는 비어 있으며 앱 종료 이력은 테스트가 요청한 강제 종료만 기록됐다 (`final-app-errors.log`, `final-app-exit-info.log`).

두 차례 에뮬레이터 새 부팅 때 Android System UI 응답 대기 안내가 있었고 대기 후 회복했다. 앱 자체의 충돌과 구분한다. 이 첫 에뮬레이터의 페이지 크기는 4KB이며, 이후 별도의 16KB 실행 검증을 아래와 같이 수행했다. 내부 로그인은 데모 자료를 사용하므로 준비템의 일반 분류/아이 표기와 9개 fixture를 운영 카탈로그 100개·구매 링크 305개의 실제 앱 연동 증거로 해석하지 않는다. 마지막 기능/오류 로그 확인 후 정리 단계에서는 첫 에뮬레이터가 이미 종료되어 있었다. 종료 원인은 확인되지 않았고, 이 작업에서 다른 프로젝트의 에뮬레이터 종료 명령은 실행하지 않았다.

### 16KB Android 추가 검증

Google 공식 `system-images;android-36;google_apis_ps16k;x86_64` revision 7을 프로젝트 전용 SDK에 설치하고, 작업 전용 `emulator-5584`에서 `getconf PAGE_SIZE=16384`를 확인했다. 설치된 APK의 SHA-256은 위 최종 APK와 일치한다.

`16kb-capture-manifest.json`에는 화면 PNG·XML 24개의 SHA-256을 기록했다.

- 필수 동의 → 테스트 로그인 → 임신 중 아이 `Astra16K` 등록(출산 예정일 2027-03-01) → 준비템 선택 → 월 예산 300,000원 저장.
- 병원 지출 34,000원 저장 후 기록·리포트 금액 일치, 재실행 후 홈 총액 34,000원과 잔여 예산 266,000원 및 준비템 유지.
- `bionic.linker.16kb.app_compat.enabled=false`, `pm.16kb.app_compat.disabled=true`를 설정·조회한 뒤 앱을 다시 시작했다. 4KB 앱 호환 보정 없이 SQLite 저장 자료와 화면이 정상 유지됐다.
- 최종 ReactNativeJS/AndroidRuntime 오류 로그는 0바이트다. 검증을 마친 작업 전용 에뮬레이터는 정상 종료했다.

RELRO의 끝 주소를 단순히 16KB 배수로 판정하면 28개 중 27개 라이브러리가 실패로 표시된다(`final-apk-elf-relro.json`, 원본 진단 보존). 실제 Android linker는 RELRO를 페이지 경계까지 반올림해 보호한다. 각 라이브러리의 RELRO와 쓰기 가능한 LOAD 범위를 대조한 결과, 반올림으로 추가 보호되는 영역에 다른 쓰기 데이터가 없었다. 최종 판정은 LOAD 정렬과 이 침범 여부를 함께 검사하며 28/28 PASS다. [Android 16 linker 구현](https://android.googlesource.com/platform/bionic/+/android16-release/linker/linker_phdr.cpp#1348)과 [LLD 배치 구현](https://github.com/llvm/llvm-project/blob/release/18.x/lld/ELF/Writer.cpp#L2473)을 근거로 단순 끝 주소 검사의 과도한 실패 판정을 구분했다.

이 실행 증거는 x86_64 에뮬레이터에 해당한다. ARM64는 정적 ELF 검사까지이며 물리 기기, 실제 카카오 인증과 운영 서버 연결은 아직 검증하지 않았다.

## Docker 배포 환경 추가 검증

Docker Desktop의 시작을 막던 0바이트 IPC 소켓 디렉터리를 원본 그대로 다른 이름에 보존한 뒤 실행을 복구했다. Docker 데이터·이미지·볼륨은 초기화하지 않았다. 검증은 `wooriai-launchqa-20260922` 프로젝트와 전용 볼륨에서 진행했고, API 33000·관리자 33001·DB 35432를 모두 `127.0.0.1`에만 열었다.

`NODE_ENV=production` 이미지에서 마이그레이션 27개, 카테고리 21개·준비템 100개·구매 링크 305개 등의 초기 데이터, 관리자 MFA와 역할 제한을 확인했다. 테스트용 editor만 별도로 생성했고 초기화 스크립트의 운영 모드 보호 조건은 변경하지 않았다. 필수 키 누락 시 exit 0 결함을 수정한 최종 API 이미지는 `docker-api-bootstrap-fix-build.log`에 기록했다. HTTP 검사 첫 시도에서 관리자 무인증 응답을 401로 예상한 QA 단언은 기존 계약인 403으로 바로잡았으며 앱 권한 정책은 바꾸지 않았다.

재시작 전후 카테고리·준비템·구매 링크·관리자 테이블 4개의 내용 해시와 27개 완료 마이그레이션이 일치했다. 카카오 인증과 외부 알림·링크 상태 확인은 이 격리 환경의 검증 대상에서 제외됐으며 운영 배포를 수행한 것은 아니다. 비공개 MFA 화면은 `container-admin-private/`에 보관하고 공개 자료에 포함하지 않는다.

최종 API 이미지 ID는 `sha256:3edaefead1f1bf0e221921a8b482bb250a24afe6eba2f217f80b5c355792ad0d`, 관리자 이미지 ID는 `sha256:765063a4dcf7cf8bbd44c84ace8b8b89fac4692a9b342852d38eef627440cf97`이다. 검증 완료 후 작업용 컨테이너와 이 작업에서 시작한 Docker Desktop을 정지했고, 이미지와 DB 볼륨은 보존했다. 재실행은 `artifacts/launch-20260922/compose-qa.ps1 up -d --no-build --wait`로 가능하다(Docker Desktop 실행 필요). 이 명령은 실제 배포 설정을 사용하지 않는다.

컨테이너 파일 제외 규칙의 중첩 경로 처리는 [Docker 빌드 컨텍스트 공식 문서](https://docs.docker.com/build/concepts/context/#dockerignore-files)를 따랐다.

## 제출 전 필요한 실제 입력

1. `launch.config.json`의 운영자명, 문의 이메일, 서비스 도메인, 시행일, 실제 호스팅 사업자.
2. 카카오 앱 생성·키 보관·OIDC 활성화는 2026-09-23 완료했다. 운영 도메인이 정해지면 HTTPS callback을 등록한다. 서버와 앱의 callback은 `https://<도메인>/api/v1/auth/kakao/callback`으로 일치시킨다. 앱 복귀용 `wooriai://oauth/kakao`는 카카오 콘솔 등록 URL과 다르다.
3. 실제 운영 서버와 HTTPS 도메인 연결, 약관·개인정보·지원·계정 삭제 페이지 공개, 운영 값으로 로그인 및 핵심 흐름 확인.
4. Play 개발자 계정, 최종 앱 정보·정책 문서·데이터 보안 응답 확인, 서명된 운영 AAB의 내부 트랙 설치 검증 및 심사 제출.

새 앱용 업로드 키를 로컬에서 생성했다. 비밀값은 저장소와 로그에 포함하지 않았다.

- 저장 위치: `C:\Users\nj970\.wooriai\release-signing\20260922-new-app`
- 키 파일: `wooriai-upload.jks`, 설정: `upload-signing.json`, 공개 인증서: `upload-certificate.pem`
- 폴더 접근은 현재 Windows 사용자와 SYSTEM으로 제한했다. **현재 컴퓨터와 분리된 안전한 백업이 필요하다.**
- 이 키는 아직 Google Play에 등록되지 않았다. 기존 Play 앱이 있다면 기존 업로드 키 사용 여부를 먼저 확인한다.

실제 값을 넣은 뒤 고정 pnpm 11.7.0으로 `pnpm launch:prepare --check`, `pnpm launch:prepare`, 운영 환경 검사 및 배포 런북을 진행하고, `pnpm android:build-aab -- --check` 후 실제 AAB를 빌드한다. 누락된 값을 가짜 도메인이나 테스트 키로 채워 제출용 산출물을 만들지 않는다.

이 Windows 호스트에서는 빌드 전에 `. ./artifacts/launch-20260922/use-android-toolchain.ps1`을 실행한다. 공용 SDK를 변경하지 않은 프로젝트 전용 SDK view와 Ninja 1.13.2를 사용한다. 기본 SDK의 Ninja 1.10.2로는 긴 pnpm 경로에서 CMake 재구성 100회 반복 실패가 재현됐고, 새 Ninja를 실제 CMake 구성에 적용한 뒤 네이티브 컴파일을 통과했다. 도구 출처와 공식 SHA-256 일치는 `ninja-toolchain.json`에 기록했다.

기준 Git HEAD는 `d06e4185`의 `master`이며 기존 변경이 있는 작업 트리에 이번 변경을 보존했다. 커밋·원격 게시·운영 배포는 이 문서의 로컬 검증 결과에 포함되지 않는다.

기준 확인일: 2026-09-22. [Play API 36 요건](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en), [Android 16KB 검사 방법](https://developer.android.com/guide/practices/page-sizes), [카카오 앱 설정](https://developers.kakao.com/docs/ko/app-setting/app).

## 2026-09-23 외부 계정·다른 프로젝트 확인

동일 사용자의 `F:\Project Master\releases\wooriai`에서 공개 체험 페이지 `https://wooriai-first-look.nj9702.chatgpt.site/`를 확인했다. Sites 계정에서 소유자·공개 상태를 확인했고, 공개 GET은 HTTP 200이었다. 체험 페이지는 실제 앱·API 호스팅이 아니며 개인정보처리방침이나 지원 문의처 링크가 없어 Play 필수 URL로 사용할 수 없다. Project Master의 인계 문서에도 운영자·지원 이메일·API 도메인·카카오 앱 키가 확정된 값으로 기록되어 있지 않다.

로그인된 Google Play Console 개인 개발자 계정의 앱 목록은 비어 있다. 신분증 본인 확인, 실제 Android 기기 확인, 연락처 전화번호 인증이 `조치 필요`이고 `앱 만들기`는 비활성화되어 있다. 공개 개발자 프로필의 법적 이름과 인증된 개발자 이메일은 확인했으나, 이를 우리아이의 개인정보처리자·앱 지원처로 사용할지 확정되지 않아 저장소의 공개 문서나 `launch.config.json`에 복사하지 않았다. [Google 계정 정보 안내](https://support.google.com/googleplay/android-developer/answer/13628312)는 앱별 지원 주소를 개발자 프로필 주소와 별도로 설정할 수 있다고 설명한다. 활동 로그의 계정 생성일은 **2026-09-22**다. 따라서 이 개인 계정에는 [12명 이상·연속 14일 비공개 테스트 및 프로덕션 액세스 신청](https://support.google.com/googleplay/android-developer/answer/14151465)이 필수다. 실제 테스트 시작일은 아직 없다.

로그인된 카카오 개발자 콘솔에 별도 서비스 앱 `우리아이`(ID `1586090`, 출산/육아)를 생성하고 기존 Play 아이콘을 등록했다. 카카오 로그인과 OpenID Connect를 켰고 REST API 키·Client Secret은 Git 무시 대상 `launch.config.json`에만 보관했다. 해당 파일의 ACL은 현재 Windows 사용자와 SYSTEM으로 제한했다. 공개 체험 페이지는 앱 대표 도메인으로 등록했지만 API 도메인은 아니며, HTTPS OAuth callback과 연결 끊기 웹훅은 아직 등록되지 않았다. 키를 사용한 실제 로그인도 검증 전이다. 로컬에서 Fly·Oracle·Cloudflare 운영 계정의 인증 구성도 확인되지 않았다. 따라서 실제 운영 API 도메인과 OAuth callback, 약관·처리방침 공개, 서명된 운영 AAB·Play 내부 트랙 검증은 아직 실행하지 못했다. 계정 소유자의 Play 인증과 운영자/지원처/호스팅 결정이 들어오면 해당 경계부터 재개한다.

기존 `docs/store/assets` 휴대전화 스크린샷은 2026-09-02 Pixel Lock 웹 캡처에서 합성한 것이다. 최종 standalone APK의 일반 실행 캡처(`artifacts/launch-20260922/android-runtime/final-*.png`)와 화면 구성이 다르다. 스토어 제출 전에 운영 AAB의 실제 화면과 대조해 자산을 교체하거나 일치 근거를 확보해야 한다. [Google의 미리보기 자산 정책](https://support.google.com/googleplay/android-developer/answer/9866151)은 실제 앱 경험을 보여야 하며 원본 스크린샷의 긴 변이 짧은 변의 2배를 초과할 수 없다고 규정한다. 현재 에뮬레이터 원본은 1080×2400이므로 그대로 업로드할 수 없다.

2026-09-23에 같은 프로젝트 전용 API 36 AVD를 다시 기동해 1080×1920 원본을 직접 찍으려 했으나, 호스트의 하드웨어 가속이 차단되어 에뮬레이터가 기동하지 않았다. 소프트웨어 가속 해제 경로도 기기 연결까지 진행되지 않아 종료했다. 다른 프로젝트의 AVD나 호스트 부팅 설정은 변경하지 않았다. 기존 2026-09-22 일반 실행 캡처는 보존했고, 제출용 스크린샷 교체는 미완료다.

## 2026-09-23 실제 호스팅 사업자 안전장치·전체 재검증

`launch:prepare`가 호스팅 사업자 미입력 시 Oracle Cloud를 자동으로 개인정보처리방침에 적던 경로를 제거했다. `hostingProvider`를 다섯 번째 필수 운영 입력으로 만들고, 실제 사업자를 모르면 HTML·운영 환경 파일을 수정하지 않도록 회귀 테스트를 추가했다. 현재 `launch.config.json`의 운영자명·문의 이메일·API 도메인·시행일·호스팅 사업자는 모두 미확정이므로 `pnpm launch:prepare --check`는 해당 5개 필드를 명시하며 중단한다. 카카오 키는 별도 로컬 파일에 유지된다.

변경 후 `pnpm --filter @wooriai/test-utils exec vitest run src/launch-prepare.test.ts` 18/18, `pnpm typecheck:scripts` PASS. 로컬 PostgreSQL을 기동해 `pnpm release:gate`를 다시 실행했고 13/13 PASS였다. 고유 자동 테스트는 517개 파일 9,379개(공통 696·관리자 838·도메인 139·API 1,055·계약 87·모바일 6,564), 별도 API E2E는 14개 파일 161개 PASS이며 고유 합계에 중복 합산하지 않는다. 운영 의존성 감사는 high/critical 0, moderate 1이다. 증거는 `artifacts/launch-20260922/release-gate-hosting-provider-20260923.log`와 `docs/qa/evidence/latest-release-gate.md`에 기록했고 테스트용 로컬 DB는 검증 후 종료했다. 이 결과는 운영 배포·실제 카카오 로그인·Play 내부 트랙 검증을 뜻하지 않는다.
