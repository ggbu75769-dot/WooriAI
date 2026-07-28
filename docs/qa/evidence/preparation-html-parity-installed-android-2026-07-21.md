# 준비템 HTML 패리티 및 설치 Android 증거 — 2026-07-21

## 판정

- 구현·카탈로그·릴리스 게이트: **PASS**
- ITEM-001 설치 앱 Pixel Lock: **PASS (`0.0000`)**
- 전체 9화면 Pixel Lock: **INVALID**. 현재 HEAD의 기존 화면 6개가 보존된 기준을 통과하지 못하므로 전체 완료 조건은 충족하지 못했다.
- 운영 배포·카탈로그 승인: 실행하지 않음.

## 입력 및 기준 잠금

- 첨부 HTML: `C:\Users\nj970\Downloads\준비템 최종 (standalone).html`
- HTML SHA-256: `2198D0452E73E00303FC03584D403486DD792BA2CF29626EFC49A440EB7ACC6F`
- 기준 뷰포트: `390x820`
- ITEM-001 기준 PNG SHA-256: `3A09775CAE9543F52B63143628D1F3783DFBEA7CF3D466EC4A2D6D19F8E2515C`
- ITEM-001 외 8개 기준 이미지는 변경하지 않았다.
- 기준은 설치된 React Native 앱을 adb로 캡처한 뒤 시스템 상태/내비게이션 바를 제외하고 `390x820`으로 정규화했다. 앱은 HTML이나 캡처 이미지를 배경으로 사용하지 않는다.

## 카탈로그 검증

- 정식 품목: `409`
- 항목별 편집 감사 레코드: `409`
- 개인화에서 숨긴 선택/문서성 항목: `79`
- 카탈로그 검증 오류: `0`
- 기본 상위 20개 문서성 항목 포함 여부: `false`
- 기본 상위 12개: 신생아 기저귀, 신생아 침대, 단단한 아기 매트리스, 고정형 매트리스 시트, 아기 체온계, 신생아 아기띠, 신생아 욕조, 후드형 아기 타월, 신생아 배냇저고리, 신생아 유모차, 젖병, 신생아용 카시트.
- `역류방지쿠션`은 `R4-C09-018`, 별칭 `역방쿠`, 조건부·전문 검토 및 수면 공간 제외 경고로 유지한다.

## APK 및 설치 증거

- 빌드 명령: `npm run pixel:android:build-apk -- --resume-after-timeout`
- APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- APK SHA-256: `21E757C56B6784F22A66DED8B21501EB2DE7E67661D78466C85C3CA67F69EBA5`
- APK 크기: `69,108,749 bytes`
- 패키지: `com.anonymous.wooriai`, 버전 `0.0.0`
- 설치: Android 15 격리 AVD에 `adb install -r` 성공, 설치 시각 `2026-07-20 14:33:56Z`.
- 캡처: `adb shell screencap -p` 후 pull. 검증 후 AVD는 종료했다.

## Pixel Lock 결과

강제 실행: `npm run pixel:android -- --force`, 생성 시각 `2026-07-20T14:50:47.094Z`.

| 화면 | 렌더 | 점수 | 판정 |
| --- | --- | ---: | --- |
| SPL-001 | valid | 0.0242 | PASS |
| HOME-001 | valid | 0.1057 | FAIL |
| EXP-001 | invalid | 1.0000 | INVALID |
| ITEM-001 | valid | 0.0000 | PASS |
| ITEM-002 | valid | 0.0503 | FAIL |
| REP-001 | valid | 0.0484 | PASS |
| FAM-001 | invalid | 1.0000 | INVALID |
| IMP-003 | valid | 0.0534 | FAIL |
| SET-001 | invalid | 1.0000 | INVALID |

EXP/FAM/SET은 sentinel을 찾았지만 기존 러너의 희소 화면 기준(`nonBg < 0.1`)에 걸렸다. 이 작업에서 품질 게이트를 완화하거나 나머지 8개 기준을 교체하지 않았다. HOME/ITEM-002/IMP-003도 이번 준비템 구현 범위 밖의 현재 HEAD 드리프트로 남아 있다.

## 릴리스 검증

- `npm run release:gate`: **PASS**, exit `0`, 생성 시각 `2026-07-20T15:21:58.007Z`.
- install, env, Prisma validate/generate, DB, lint, typecheck, 전체 테스트, API E2E, production builds, peer dependencies가 모두 PASS.
- 모바일 전체: `81` files / `459` tests PASS.
- 자정 경계 테스트는 UTC 날짜 대신 `getSeoulToday()`를 사용하도록 보정해 사용자 마감일 우선 계약을 KST 기준으로 검증한다.

## 상태 경계

준비템 기능·정렬·ITEM 설치 캡처와 릴리스 게이트는 검증됐다. 그러나 전체 Pixel Lock은 3/9 PASS이므로 이 변경을 “9/9 시각 자격 완료”로 보고해서는 안 된다.
