# WooriAI Local Self-Implement Current State

갱신: 2026-07-30 01:28 KST

현재 실측 기준선은 `docs/state-of-truth.md`, 문서·실행 차이는 `docs/reality-diff.md`가 우선한다. `docs/operations/current-development-status-and-next-design-baseline-2026-07-26.md`는 2026-07-26 당시의 역사 증거다.

## Git·소스 경계

- 저장소: `F:/WooriAI`
- 브랜치: `codex/wooriai-apk-feedback-ux-hardening-v1`
- 측정 대상 제품 소스: `a0355e39d0694a21d92b7b21c5f9c2479d4400b0`
- 보고서 포함 현재 HEAD: `git log -1 --oneline`으로 조회
- upstream divergence: `git rev-list --left-right --count '@{upstream}...HEAD'`로 조회
- 외부 배포·push: 이번 사이클에서 수행하지 않음

## 현재 검증

| 영역 | 현재 증거 | 판정 |
| --- | --- | --- |
| 전체 Release Gate | isolated catalog audit 포함 16/16 | LOCAL PASS |
| Android Pixel Lock | 설치 APK adb 캡처 9/9, 최대 0.0474 | INTERNAL PASS |
| EXP-003 수정 회귀 | focused 4 files / 34 tests | LOCAL PASS |
| 일반 EXP-003 설치 앱 흐름 | 현재 변경 이후 별도 adb walkthrough 없음 | NOT RUN |
| GitHub CI | run `30382997599`, step 시작 전 billing 차단 | EXTERNAL BLOCKED |
| 실사용 analytics | 로컬 0건, 운영 데이터 위치 없음 | NO DATA |
| production config·배포 | 승인 값·인프라·서명·배포 ID 없음 | EXTERNAL BLOCKED |

## Android 산출물

- Pixel Lock APK: `F:/WooriAI/wooriai-pixel-11eaf1731860f9cd3c6d0c31424d46192bf73003fa28b858f23f9f44e248af2c.apk`
- Pixel APK / installed base SHA-256: `11EAF1731860F9CD3C6D0C31424D46192BF73003FA28B858F23F9F44E248AF2C`
- source snapshot SHA-256: `0253F8AC1B40C29FFCBDAFF41716626FC0F285F48C078056C7A06D6E560903`
- 내부 검증용이며 production identity/signing/store 후보가 아님
- 최종 APK는 프로젝트 루트에만 둔다. `artifacts`에는 보고서·스크린샷·로그만 둔다.

## 다음 진입점

일반 설치 앱에서 지출 생성 → 수정 → 기록·합계 반영을 직접 수행해 `EXP-003` 변경의 adb runtime 증거를 추가한다. 외부 입력은 `docs/HUMAN-QUEUE.md`에서 별도로 추적한다.
