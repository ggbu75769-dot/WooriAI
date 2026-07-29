# WooriAI Local Self-Implement Current State

갱신: 2026-07-30 02:01 KST

현재 실측 기준선은 `docs/state-of-truth.md`, 문서·실행 차이는 `docs/reality-diff.md`가 우선한다. `docs/operations/current-development-status-and-next-design-baseline-2026-07-26.md`는 2026-07-26 당시의 역사 증거다.

## Git·소스 경계

- 저장소: `F:/WooriAI`
- 브랜치: `codex/wooriai-apk-feedback-ux-hardening-v1`
- 측정 대상 제품 소스: `6a3f4a0`
- 보고서 포함 현재 HEAD: `git log -1 --oneline`으로 조회
- upstream divergence: `git rev-list --left-right --count '@{upstream}...HEAD'`로 조회
- 외부 배포·push: 이번 사이클에서 수행하지 않음

## 현재 검증

| 영역 | 현재 증거 | 판정 |
| --- | --- | --- |
| 전체 Release Gate | isolated catalog audit 포함 16/16 | LOCAL PASS |
| Android Pixel Lock | prior source 설치 APK adb 캡처 9/9, 최대 0.0474 | LAST PASS / PRIOR SOURCE |
| EXP-003 수정 회귀 | focused 4 files / 34 tests | LOCAL PASS |
| 일반 EXP-003 설치 앱 흐름 | 생성 → 날짜·금액 수정 → 기록·홈 합계 반영 | INTERNAL PASS |
| onboarding keyboard 수정 | source-bound standalone, adb 전체 content/성별/CTA 노출 | INTERNAL PASS |
| GitHub CI | run `30382997599`, step 시작 전 billing 차단 | EXTERNAL BLOCKED |
| 실사용 analytics | 로컬 0건, 운영 데이터 위치 없음 | NO DATA |
| production config·배포 | 승인 값·인프라·서명·배포 ID 없음 | EXTERNAL BLOCKED |

## Android 산출물

- standalone APK: `F:/WooriAI/wooriai-0.0.0-release-standalone.apk`
- standalone APK / installed base SHA-256: `6C4ABDE6DA0FD822B5C18D896A7425308275488ABD3A7D54AA3982A851057BBB`
- source snapshot SHA-256: `D6D6F3D363BC8F00570A2212CD1969B25C7821D4E3143D6B894B44060B4EE1F8`
- 내부 검증용이며 production identity/signing/store 후보가 아님
- 최종 APK는 프로젝트 루트에만 둔다. `artifacts`에는 보고서·스크린샷·로그만 둔다.

## 다음 진입점

EXP-003 진입 시 현재 선택 카테고리 칩을 첫 horizontal viewport에 자동 reveal한다. 외부 입력은 `docs/HUMAN-QUEUE.md`에서 별도로 추적한다.
