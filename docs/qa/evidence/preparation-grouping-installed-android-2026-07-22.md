# 준비템 10분류·시기 묶음·5탭 설치 Android 증거 — 2026-07-22

## 판정

- 첨부 HTML의 시각 언어를 유지한 React Native 준비템 화면: **PASS**
- 분류별 10개 그룹과 품목 분산: **PASS (10/10)**
- 시기별 4개 접이식 그룹과 펼침/닫힘: **PASS (4/4)**
- 하단 5탭 `홈 / 기록 / 준비템 / 리포트 / 더보기` 및 `더보기` 이동: **PASS (5/5)**
- 모바일 전체 테스트: **PASS (82 files / 463 tests)**
- 전체 릴리스 게이트: **PASS**

## 설치 앱 증거

- 패키지: `com.anonymous.wooriai`, 버전 `0.0.0`
- 설치 APK SHA-256: `58369BEAF4C033E2DAA10280D84887EBCB05B1E2D6B2101D263676CBAB08F38D`
- 설치 대상: 격리 Android 15 AVD
- 캡처 방식: `adb shell screencap -p` 후 `adb pull`
- 상단 준비템: `artifacts/pixel-lock/android/screenshots/ITEM-001-20260722-2.png`
- 10분류 중간: `artifacts/pixel-lock/android/screenshots/ITEM-001-20260722-categories-lower.png`
- 10분류 하단: `artifacts/pixel-lock/android/screenshots/ITEM-001-20260722-categories-bottom.png`
- 시기별 펼침: `artifacts/pixel-lock/android/screenshots/ITEM-001-20260722-timing.png`
- 시기별 4그룹: `artifacts/pixel-lock/android/screenshots/ITEM-001-20260722-timing-collapsed.png`
- 5탭 및 더보기 화면: `artifacts/pixel-lock/android/screenshots/SET-001-20260722-five-tabs.png`

uiautomator XML을 합산해 다음 레이블을 실제 설치 앱에서 확인했다.

- 분류: `건강·진료`, `의류·착용`, `편안함·회복`, `위생·목욕`, `입원·출산`, `수유·이유식`, `수면·공간`, `기저귀·생활`, `외출·놀이·교육`, `가족·기록`
- 시기: `지금 준비해요`, `곧 필요해요`, `여유 있게 준비해요`, `정리된 품목`
- 탭: `홈`, `기록`, `준비템`, `리포트`, `더보기`

## 최신 standalone APK

- 파일: `artifacts/android/wooriai-0.0.0-release-standalone.apk`
- SHA-256: `70A4183AAB335C3EAF160805FBEF3E3D34F9523A3FC4236CD078553BED70FC6A`
- 크기: `77,318,546 bytes`
- 생성 시각: `2026-07-22 02:08:01 KST`
- 프로필: `standalone`, 테스트 로그인 포함, 디버그 내부 서명
- ABI: `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`
- 내장 JS 번들 검증: 생성 번들 SHA-256과 APK 내장 번들 SHA-256 일치
- 서명 검증: APK Signature Scheme v2 **PASS**

## 상태 경계

이번 변경은 준비템 화면 구조와 전역 하단 탭 수를 의도적으로 바꿨다. 이전 4탭·3분류 기준의 전체 9화면 Pixel Lock 참조는 현재 제품 요구와 충돌하므로, 이 작업에서는 기존 전체 Pixel Lock을 통과했다고 주장하지 않는다. 설치 앱 캡처와 릴리스 게이트는 별도로 검증했다.
