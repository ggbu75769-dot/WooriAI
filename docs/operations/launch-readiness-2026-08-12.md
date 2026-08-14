# 우리아이 출시 준비 현황 — 2026-08-12

이 문서는 현재 작업본의 내부 완료 상태와 실제 스토어 출시 전 외부 입력을 분리한다. 로컬 APK/AAB, fixture, 에뮬레이터 통과를 운영 배포 또는 스토어 승인으로 표현하지 않는다.

## 1. 판정

| 영역 | 판정 | 근거 |
| --- | --- | --- |
| 내부 릴리스 후보 코드 | PASS | `docs/qa/evidence/latest-release-gate.json` 16/16 PASS, 2026-08-12 08:43 KST |
| Android 설치 UI | PASS | `artifacts/pixel-lock/android/reports/latest.json` adb 9/9 PASS |
| standalone APK | ARTIFACT_VERIFIED / INTERNAL_TEST | `docs/qa/evidence/release5v-native-artifact-audit.json` |
| 내부 AAB 파이프라인 | PASS / INTERNAL_TEST | `artifacts/android/wooriai-0.0.0-1-release-internal.json` |
| production/store | EXTERNAL_BLOCKED | `docs/qa/evidence/release5f-external-staging-readiness.json` |

## 2. 이번 개선

- 영수증 보조입력을 placeholder 중심 입력에서 보이는 라벨, 필드별 오류, 금액 정규화·원화 미리보기, 네이티브 날짜 선택기, 접근성 상태 알림이 있는 폼으로 교체했다.
- 준비템의 예정일·구매일·개봉일·교체일을 수동 `YYYY-MM-DD` 입력에서 네이티브 날짜 선택기로 교체했다.
- 영수증 API의 금액 상한과 품목명·상점명 길이를 일반 지출 계약과 맞추고, 금액 초과·문자열 초과·30회 재시도 멱등성을 E2E로 검증했다.
- 문서상 자동화 증거에만 존재하고 실제 release E2E 목록에서 빠졌던 `release5e-assisted.e2e.test.ts`를 정식 게이트에 편입했다. 테스트 분할 검사는 모든 비브라우저 테스트가 정확히 한 lane에 속하는지 보장한다.
- Android 16 KiB 감사가 32비트 ELF를 잘못 실패시키던 오탐을 수정했다. Google 공식 범위인 `arm64-v8a`와 `x86_64`를 검사하고 32비트 호환 ABI는 보존한다.

Apple Design Awards와 HIG에서 적용한 것은 자산 복제가 아니라 쉬운 첫 경험, 한 화면의 명확한 우선 행동, 네이티브 컨트롤, 큰 글자·대비·색상 외 상태 표현, Reduce Motion, 즉각적인 로딩·오류 피드백이다. 현재 한글 `우` 모노그램과 네이비·감귤·버터 브랜드 체계는 유지했다.

참고: [Apple Design Awards](https://developer.apple.com/design/awards/), [2026 Apple Design Awards winners](https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/), [Apple HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Apple HIG Loading](https://developer.apple.com/design/human-interface-guidelines/loading), [Apple HIG Pickers](https://developer.apple.com/design/human-interface-guidelines/pickers)

## 3. 반복 검증 결과

### 전체 릴리스 게이트

- 첫 실행: 16/16 PASS, 825,865 ms.
- 최종 실행: 16/16 PASS, 520,525 ms.
- 포함 범위: frozen install, Expo dependency check, 환경 예제, secret scan, production dependency audit, Prisma validate/generate, PostgreSQL·41개 migration·seed, catalog audit, lint, 8개 package typecheck, 전체 단위·API E2E·관리자 브라우저 테스트, 8개 package build, strict peer lockfile check.
- 별도 회귀: 영수증 E2E 2/2, 테스트 partition 3/3, Android build/audit 계약 20/20, 모바일 관련 선택 테스트 32/32 PASS.

### Android Pixel Lock

- 기기: 격리 AVD `sdk_gphone64_x86_64`, Android 15, 1080x2340, density 440.
- APK: `F:\WooriAI\wooriai-pixel-0b55995b0e282ec76178b701d5b318c50ec679b281efeb36a4c97d44d4f71c40.apk`.
- APK SHA-256 = 설치 `base.apk` SHA-256: `0B55995B0E282EC76178B701D5B318C50EC679B281EFEB36A4C97D44D4F71C40`.
- source snapshot: `945CAB6AFFC88950DF0F833E27C04EF80A48A8E2BB29B54EECF8BB11B45400D3`.

| 화면 | 점수 | 판정 |
| --- | ---: | --- |
| SPL-001 | 0.029122 | PASS |
| HOME-001 | 0.039053 | PASS |
| EXP-001 | 0.013754 | PASS |
| ITEM-001 | 0.040262 | PASS |
| ITEM-002 | 0.044308 | PASS |
| REP-001 | 0.046060 | PASS |
| FAM-001 | 0.038190 | PASS |
| IMP-003 | 0.035217 | PASS |
| SET-001 | 0.014608 | PASS |

### Android 산출물

- standalone APK: `F:\WooriAI\wooriai-0.0.0-release-standalone.apk`, 71,410,020 bytes, SHA-256 `3F45442801164B9DFF691DC89B423810FF4715671C7569267F3BF5FB4A6C5FC8`.
- APK 감사: source binding BOUND, target/compile SDK 36, debuggable false, allowBackup false, cleartext false, 금지 권한 0, ZIP 16 KiB PASS, 64비트 ELF 28/28 PASS.
- 내부 AAB: `F:\WooriAI\wooriai-0.0.0-1-release-internal.aab`, 36,324,483 bytes, SHA-256 `E0C92E2DCDE16559DC552F40018E4949A44AB9C0ADF6049492A8F0345EB061CB`.
- AAB 검증: embedded Hermes와 generated bundle 해시 일치, 4개 ABI 필수 native library 존재, embedded app config 일치, JAR 서명 PASS, 빌드 전후 source snapshot 안정.
- 두 산출물은 debug signing, test login/local fixture, placeholder identity를 포함하므로 store artifact 또는 production candidate가 아니다.

Android 공식 문서는 Play의 16 KiB 요구를 64비트 기기 대상으로 정의하고 `arm64-v8a`·`x86_64` ELF를 검사 대상으로 명시한다. 현재 APK는 해당 28개 라이브러리가 모두 정렬돼 있다. 실제 16 KiB 커널 기기 런타임은 아직 외부 검증 항목이다.

참고: [Android 16 KiB page-size guide](https://developer.android.com/guide/practices/page-sizes), [Google Play target API requirement](https://developer.android.com/google/play/requirements/target-sdk)

## 4. 실제 출시 전 외부 입력

`pnpm release:store-preflight`는 다음 10개 범주를 secret 값 없이 `EXTERNAL_BLOCKED`로 보고했다.

1. 승인 application ID와 공개 version/versionCode
2. production HTTPS API
3. 승인 운영자명·개인정보·약관·지원·상태 URL
4. PostgreSQL·Redis·object storage
5. Kakao·Apple·Google OAuth client
6. live push provider와 credential
7. live recall provider와 webhook secret
8. live merchant feed와 credential
9. metrics 인증
10. 외부 production keystore·alias·비밀번호 secret 참조

`pnpm release:config`도 fail-closed로 46개 production 설정 누락을 보고했다. production AAB는 승인 identity가 없어 빌드 시작 전에 `ANDROID_APPROVED_IDENTITY_REQUIRED`로 차단된다.

외부 입력 후 필요한 최종 증거는 production config/store preflight 0건, signed AAB, Play internal track store-signed 설치본, 운영 DB restore drill, live OAuth/push/storage/monitoring smoke, 승인된 법적 문서와 Data Safety, 물리 Android·iOS 접근성, 최소 7일 closed beta다.

## 5. 결론

내부에서 가능한 코드·UX·테스트·Android 산출물·설치 화면 검증은 현재 작업본에서 완료했다. 실제 스토어 출시 완료는 제품 소유자·법률·인프라·스토어 계정 입력이 제공되기 전까지 주장하지 않는다. 외부 입력의 단일 인계 목록은 `docs/HUMAN-QUEUE.md`를 사용한다.
