# 우리아이 출시 준비 현황 — 2026-08-11

이 문서는 “코드 구현 완료”, “로컬 검증 완료”, “외부 입력 필요”, “스토어·운영 검증 완료”를 분리한다. 로컬 APK 또는 fixture 통과를 실제 출시로 표현하지 않는다.

## 1. 현재 판정

| 영역 | 현재 상태 | 다음 증거 |
| --- | --- | --- |
| 핵심 기능 | 로컬 구현·반복 전체 gate·current-source Android 설치 과업 통과 | 운영 서비스·스토어 서명본 재검증 |
| 계정·개인정보 | 동의, 인증 사용자 전용 JSON export·앱 저장/공유, 7일 탈퇴 유예·취소, 소유권 이전 차단 구현 | 승인된 법적 문서와 공개 HTTPS URL, 운영 SLA 검증 |
| 브랜드 | 기존 포털 심볼까지 제품 경로에서 폐기하고 한글 `우` 기반 모노그램·정확한 한글 워드마크·네이비/감귤/버터 체계로 전면 교체·설치 확인 | production identity로 빌드한 설치본 |
| 시작·로딩 | 성장 단계 시작 화면, Reduce Motion·screen reader 우회, 브랜드 hydration/loading surface 구현·cold-start 5회 PASS | 물리 기기 TalkBack |
| Pixel Lock | 현재 source에서 Android 15 adb screencap 9/9 통과 | store-signed 설치본 재측정 |
| 보안 의존성 | 공개 수정 버전 없는 `image-size` 2건을 로컬 백포트·PoC 회귀로 차단 | upstream 수정 버전 공개 시 패치 제거·재감사 |
| Android 식별·서명 | placeholder (`com.anonymous.wooriai`, `0.0.0`) | 승인 package/version/versionCode/외부 keystore |
| 운영 인프라 | fail-closed 설정 gate와 store preflight 구현 | API·PostgreSQL·Redis·object storage·monitoring 실값 |
| 외부 연동 | adapter와 계약 구현 | Kakao OAuth·push·merchant 실 credential smoke |
| 스토어 제출 | 미제출 | Play Console internal track 설치·검토 |
| Play 기술 정책 | Expo SDK 54·React Native 0.81.5, API 36 compile/target, 16 KiB ZIP·ELF 정렬 28/28 검증 | 16 KiB 페이지 크기 물리 기기 검증 |

### 2026-08-11 실행 증거

- `pnpm release:gate`: 16/16 PASS
- 전체 release gate를 개선 전·후 3회 이상 실행했으며 최신 반복은 16/16 PASS
- 출시 도구 단위 테스트 5개 파일·29개를 `pnpm test`에 편입하고 PASS
- `pnpm pixel:android`: 9/9 PASS, 전 화면 `<= 0.0500`
- Pixel Lock 점수: SPL `.029122`, HOME `.039053`, EXP `.013754`, ITEM-001 `.040262`, ITEM-002 `.044308`, REP `.046060`, FAM `.038190`, IMP `.035217`, SET `.014451`
- Pixel APK와 설치 `base.apk`: SHA-256 `6B6414D1718CDFA76B8A3618C233A8F0D888B278C3997FEBC784DFE24878B4D1`
- Standalone APK와 설치 `base.apk`: SHA-256 `558AA36ADF2FC35419D02BF14DA7920C6A1B0F30762279C683F000DC37F950C5`
- 내부 AAB: SHA-256 `70696558C0C6AFEF1BDF331257F5D09466C0C8D54702F41F777B06BB3505AEAE`, arm64-v8a/armeabi-v7a/x86/x86_64, embedded Hermes/config/native libraries 및 JAR 서명 PASS
- production AAB 명령은 승인 application ID·외부 keystore·HTTPS API가 없으면 `ANDROID_APPROVED_IDENTITY_REQUIRED`부터 즉시 중단하며, 내부 검증 AAB는 명시적 `--internal-test`에서만 생성됨
- 최신 Standalone APK·내부 AAB·Pixel APK source snapshot: `58D7DD054880CCA0B71CFB964384712985A052EE085B7E6253B4B50630759CA0` (각 빌드 전후 동일)
- Standalone 정적 감사: target/compile SDK 36, `debuggable=false`, `allowBackup=false`, cleartext 차단, 금지 권한 0, 16 KiB ZIP·ELF 정렬 28/28 PASS
- 설치 앱 실제 흐름: 필수 동의 → 온보딩 → 홈 → 더보기 → 약관·개인정보·계정 → 개인정보 JSON 생성 → `준비 완료` → Android 공유 Chooser에서 JSON 파일·Quick Share·Drive·Gmail 노출
- 설치 앱 cold launch 5회: 390/520/470/525/490 ms, fatal 로그 0, 설치 `base.apk`와 root APK SHA-256 일치
- 전역 한국어 어절 경계 처리와 압축 라벨 정책을 적용하고 정적 회귀 테스트를 추가함
- 설치 Android에서 한글 `우` 모노그램 native splash와 정확한 `우리아이` 워드마크를 adb 캡처로 확인하고 launcher foreground 사각 배경 회귀를 제거함 (`artifacts/android/standalone-runtime/hangul-logo-native.png`, `artifacts/android/standalone-runtime/hangul-logo-login-final.png`)
- font scale 1.5 설치 앱에서 약관·개인정보·CTA·footer가 화면 안에 유지되고 `처리방침`이 글자 중간에서 잘리지 않음 (`artifacts/android/standalone-runtime/login-font150-fixed.png`)
- TalkBack spoken/haptic/audible service bound, touch exploration·앱 window focus·체크박스 focus node 확인 후 설정 원복
- current migration 41개+seed를 격리 source DB에 적용하고 별도 target에 복원: 93개 테이블·12,178행, catalog/row fingerprint 일치, raw backup 미보존, 두 임시 DB 제거
- 개인정보 export HTTP/DB E2E: 요청 → worker 완료 → 소유자 인증 다운로드 → 민감 인증 식별자 제외 → 비인증 401 검증
- `pnpm release:config:fixture`: PASS; gate 로직만 검증하며 현재 placeholder 설정을 production으로 인증하지 않음
- `pnpm release:config`: 의도한 fail-closed 동작으로 FAIL, 승인·credential·운영 인프라가 필요한 외부 blocker 46건을 구체적으로 보고
- `pnpm release:store-preflight`: 의도한 exit 1 / `EXTERNAL_BLOCKED`; 앱 identity, HTTPS API, 법적 URL, core infra, OAuth, live provider, metrics, 외부 signing의 10개 범주를 secret 값 없이 보고

현재 root APK:

- Pixel Lock: `F:\WooriAI\wooriai-pixel-6b6414d1718cdfa76b8a3618c233a8f0d888b278c3997febc784dfe24878b4d1.apk`
- Standalone internal test: `F:\WooriAI\wooriai-0.0.0-release-standalone.apk`
- Internal AAB pipeline proof: `F:\WooriAI\wooriai-0.0.0-1-release-internal.aab`

Standalone APK는 debug certificate, test-login/local fixture, placeholder package/version을 포함한 **내부 검증용**이다. 설치·기능·native 설정 증거이지 Play 제출용 production candidate가 아니다.

## 2. 디자인 연구를 적용한 원칙

Apple Design Awards 2026의 공통 패턴을 제품에 맞게 재구성했다. 화면이나 자산을 복제하지 않고, 다음 설계 언어만 적용한다.

- **한눈에 읽히는 우선순위**: Structured와 Tide Guide처럼 홈·리포트의 핵심 숫자와 다음 행동을 먼저 보여준다.
- **절제된 기능 밀도**: grug와 Primary처럼 한 화면의 기본 CTA를 하나로 유지하고 보조 기능은 더보기·상세로 보낸다.
- **읽지 않아도 이해되는 상호작용**: Sago Mini Jinja's Garden처럼 아이콘, 상태명, 진행률을 함께 사용하고 색만으로 상태를 구분하지 않는다.
- **쉬운 첫 경험**: Moonlitt처럼 가입 전 필수 동의와 시작 목적을 짧고 직접적으로 안내한다.
- **포용성**: Guitar Wiz처럼 screen reader label, 큰 글자, 충분한 대비, Reduce Motion을 기본 계약으로 둔다.
- **촉각적 피드백**: (Not Boring) Camera처럼 누름 상태를 즉시 보여주되 장식성 연속 애니메이션은 로딩 외에는 사용하지 않는다.

참고: [Apple Design Awards](https://developer.apple.com/kr/design/awards/), [2026 winners](https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/), [Apple HIG Launching](https://developer.apple.com/design/human-interface-guidelines/launching), [Apple HIG Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)

## 3. Google Play 제출 전 체크리스트

### 코드·빌드

- [ ] 승인된 application ID, semantic version, versionCode 적용
- [ ] test login, Pixel Lock, dev auth를 모두 OFF로 고정
- [ ] production API URL과 external signing secret 주입 후 `pnpm release:config` 및 `pnpm release:store-preflight` PASS
- [ ] signed AAB 생성, SHA-256·source snapshot·서명 인증서 fingerprint 기록
- [x] 내부 fixture AAB 파이프라인에서 bundle·Hermes·ABI·JAR 서명·source binding 검증
- [x] compileSdk/targetSdk 36과 CI Android API 36 toolchain 고정
- [x] current-source APK 16 KiB ZIP 정렬·ELF 정렬 28/28 정적 검증
- [ ] store-signed APK/AAB 정렬 재감사와 16 KiB 페이지 크기 물리 기기 런타임 검증
- [ ] internal track store-signed 설치본으로 upgrade/cold-start/logout/login/OAuth 검증
- [x] current-source 설치 앱 adb screencap Pixel Lock 9/9 `<= 0.0500`
- [ ] store-signed 설치 앱 adb screencap Pixel Lock 9/9 `<= 0.0500` 재검증

### 개인정보·정책

- [ ] 운영자·연락처·보존기간·processor가 반영된 약관/개인정보처리방침 법률 승인
- [ ] 개인정보처리방침, 이용약관, 고객지원, 서비스 상태 공개 HTTPS URL
- [ ] 앱 안과 공개 웹에서 계정 삭제를 찾을 수 있고 동일 계정에 연결되는지 확인
- [ ] Play Data Safety 답변을 [데이터 안전 인벤토리](./release3-data-safety-inventory.md)와 운영 실구성에 맞춰 승인
- [ ] 분석·제휴·가져오기·알림 기본 OFF, 선택 동의와 철회 동작 확인
- [ ] 아동·가족 데이터의 법정대리인·연령·보존 정책 확정

참고: [Google Play target API 기준](https://developer.android.com/google/play/requirements/target-sdk), [16 KiB 페이지 크기](https://developer.android.com/guide/practices/page-sizes), [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en), [Account deletion requirement](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)

### 운영·출시

- [x] current migration 41개+seed의 격리 DB backup/restore drill과 schema·row fingerprint 검증
- [ ] 운영 DB migration, backup/restore, rollback rehearsal
- [ ] Redis queue, object storage retention, privacy deletion worker 실검증
- [ ] crash·metrics dashboard와 S0/S1 alert 수신자 연결
- [ ] catalog 독립 검토와 승인된 offer만 게시
- [ ] 7일 이상 closed beta, S0/S1 0건, 계정 삭제·export SLA 확인
- [ ] 물리 Android TalkBack/큰 글자/가로모드, iOS native 핵심 loop 별도 검증

## 4. 승인 없이는 확정하지 않는 값

다음 값은 제품 소유자·법률·인프라·스토어 계정 소유자의 결정이므로 임의 생성하지 않는다.

- Android application ID, 공개 버전 정책, keystore와 비밀번호
- 법적 운영자명, 개인정보처리방침·약관의 실질 내용과 공개 URL
- 운영 도메인, DB/Redis/storage endpoint와 secret
- Kakao/FCM/monitoring/merchant credential
- catalog의 독립 검토·게시 승인
