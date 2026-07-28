# WooriAI Local Self-Implement Current State

갱신: 2026-07-27

전체 기준선은 `docs/operations/current-development-status-and-next-design-baseline-2026-07-26.md`가 우선한다.

## Git·소스 경계

- 저장소: `F:/WooriAI`
- 브랜치: `codex/sprint2-catalog-payments`
- HEAD: `edaf1f3850ac1f66055440eb04b51445d5ae4069`
- upstream divergence: `0 / 0`
- 현재 변경: unstaged/untracked, staged 0
- 이번 개발에서 reset, checkout, stage, commit, push, deploy를 수행하지 않음

## 현재 검증

| 영역 | 현재 증거 | 판정 |
| --- | --- | --- |
| 전체 Release Gate | isolated catalog audit 포함 16/16 PASS, `2026-07-26T15:56:15.746Z` | LOCAL PASS |
| Android Pixel Lock | adb 설치 캡처 9/9, 최대 0.0474 | INTERNAL PASS |
| 일반 standalone 흐름 | 로그인·온보딩·홈·준비템·지출 입력을 설치 앱에서 확인 | INTERNAL PASS |
| 카탈로그 구조 | 409 item, 3,287 alias, 485 evidence, 구조 gate PASS | LOCAL PASS |
| 카탈로그 운영 게시 | evidence 485건 모두 draft, 독립 검토 0, 게시 0 | FAIL-CLOSED |
| 파일럿 런타임 | 구조·근거·두 승인·승인자 분리·manifest 무결성·publisher 분리 | IMPLEMENTED |
| production config | 46개 승인값/자격증명 차단 | EXTERNAL_BLOCKED |
| 외부 staging | core/OAuth/push/recall/merchant/signing 6영역 | EXTERNAL_BLOCKED |

## Android 산출물

- standalone APK: `F:/WooriAI/wooriai-0.0.0-release-standalone.apk`
- standalone SHA-256: `EF165BC7677C36D3CC9DB987B56E353647F9E9BC756B6C6565CB455AA7879190`
- Pixel Lock APK: `F:/WooriAI/wooriai-pixel-8244faa73e6480ce5f21251555fa3f36d3e727413df366f2715f950cd67e2135.apk`
- Pixel APK SHA-256: `8244FAA73E6480CE5F21251555FA3F36D3E727413DF366F2715F950CD67E2135`
- 두 APK 모두 내부 검증용이며 production identity/signing/store 후보가 아님
- 최종 APK는 프로젝트 루트에만 둔다. `artifacts`에는 보고서·스크린샷·로그만 둔다.

## 현재 남은 경계

코드 내부에서 확정 가능한 P0 경로는 완료됐다. 다음 단계에는 승인된 application ID/version/signing, 운영 인프라와 provider 자격증명, 법적 운영자 정보, 독립 catalog 검토자, 물리 Android/iOS 기기가 필요하다.
