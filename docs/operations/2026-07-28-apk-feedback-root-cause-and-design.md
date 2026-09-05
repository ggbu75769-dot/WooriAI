# APK 사용자 피드백 UX 하드닝 — 기준선, 원인 분석, 설계

- 상태: 작업 중
- 시작 시각: 2026-07-28 KST
- 저장소: `https://github.com/ggbu75769-dot/WooriAI.git`
- 작업 루트: `F:\WooriAI`

## 1. 안전 기준선

| 항목 | 값 |
| --- | --- |
| authoritative baseline branch | `origin/codex/sprint2-catalog-payments` |
| authoritative baseline SHA | `3eaa4bcaa7c39840692744ea70915238280010fb` |
| PR #1 head | `codex/sprint2-catalog-payments` / `3eaa4bcaa7c39840692744ea70915238280010fb` |
| PR #1 base | `master` / `f2e5c92f346a18d6abf65197e3b279a805d771e9` |
| baseline vs `origin/master` | 31 ahead / 0 behind |
| 시작 worktree | clean, staged 0, unstaged 0, untracked 0 |
| 작업 브랜치 | `codex/wooriai-apk-feedback-ux-hardening-v1` |
| 작업 시작 SHA | `3eaa4bcaa7c39840692744ea70915238280010fb` |
| 별도 worktree 미사용 사유 | 최종 APK 고정 출력 경로가 `F:\WooriAI`이므로 clean 루트에서 전용 브랜치로 분리 |
| 보존할 로컬 변경 | 없음 |
| backup ref / patch / bundle | clean 기준선이므로 불필요; 생성하지 않음 |

`git fetch --all --prune` 후 로컬 HEAD, 원격 개발 브랜치, PR #1 head가 같은 SHA임을 확인했다. `origin/master`는 이 SHA의 ancestor다. 기준선 확정 전 제품 코드는 수정하지 않았다.

## 2. 시작 환경

| 도구 | 값 |
| --- | --- |
| Git | `2.52.0.windows.1` |
| Node.js | `v25.2.1` |
| pnpm | `11.9.0` |
| npm | `11.6.2` |
| Java | Temurin OpenJDK `17.0.19` |
| Android SDK command-line tools | `20.0` |
| Android platforms | `android-35`, `android-36` |
| adb | `1.0.41`, platform-tools `37.0.0-14910828` |
| 시작 시 adb device | 없음 |
| 전용 AVD home | `F:\WooriAI\.android-avd` |

## 3. 계약 해석

- 현재 5개 하단 탭, P0 screen ID, 가족 RBAC, Excel preview-before-save, soft delete/audit, 제휴 고지, 수수료 독립 추천 순위는 보존한다.
- `docs/dev/do-not-change.md`의 과거 `미래 지출 금지` 문구와 이번 P0 요구의 `내일 예정 지출`은 충돌한다. 이번 지시는 내일까지만 허용하고 모레 이후는 계속 차단하는 명시적 상위 변경으로 해석한다.
- `in_review` 카탈로그를 운영 게시하지 않는다. fixture/standalone 품목 확장과 production publish readiness는 별도 판정한다.
- Pixel fixture와 일반 통합 화면의 런타임 증거를 분리한다. Android 최종 시각 증거는 설치 앱의 adb `screencap`만 사용한다.

## 4. 재현 및 원인 분석

| 영역 | 사용자 증상 | 재현 절차 | UI 원인 | 상태/API/DB 원인 | 테스트 누락 | 수정 대상 | 회귀 위험 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 홈 | 샘플 안내와 `오늘의 가족 준비`가 월 비용을 첫 화면 아래로 밀어냄 | fresh install → 기기 세션 시작 → 온보딩 완료 → 홈 | `SampleDataBanner`와 `TodayCenterCard`가 일반 홈에 함께 렌더링됨 | `/home`이 기능 플래그 확인 뒤 Today Center 집계를 매번 결합함 | 일반 홈의 정보 우선순위와 사용자 문구 금지 검사가 없음 | 배너 표시 중단, 홈 Today Center 결합 제거, source-quality 문구 검사 | 안전 알림 자체를 함께 제거하지 않도록 전용 서비스·알림 경로 보존 |
| 지출 | 날짜가 `오늘` 단일 pill/14일 목록이고 검색이 없으며 카테고리당 3개뿐임 | 홈 → 지출 기록 → 날짜/분류별 품목/상세 입력 확인 | 수동 날짜 입력과 과거 chip 목록 중심, 카탈로그 36개 고정, 상세 토글 후 스크롤 보정 없음 | 클라이언트·로컬·API가 미래 날짜를 전부 거부하고 집계가 예정/실현을 구분하지 않음 | 내일/모레 KST 경계, 검색 별칭·초성, 6→12→24, 예정 합계 제외 테스트 없음 | 내일까지만 저장, 3분할+native calendar, 96개 검색 카탈로그, 예정 배지와 실현 합계 분리 | 월말 내일 기록의 다음 달 접근, import는 계속 미래 금지 |
| 준비템 | 온보딩에서 3개 준비 완료를 골라도 `152개 중 0개 보유` | fresh install → 온보딩 준비물 3개 선택 → 준비템 → 내 준비 목록 | 전체 생애주기 카탈로그를 진행률 분모로 쓰고 사용자 계획만의 상태 상세가 없음 | 실제 API는 `userItemPlan(owned)`를 만들지만 로컬 APK는 구형 `itemStatuses`에만 저장해 Release 4 타임라인과 단절 | 로컬 온보딩 완료 후 일반 준비 타임라인 상태 검증 없음 | 로컬 완료 시 canonical `itemPlans`도 원자적으로 생성, 사용자 추적 품목만 진행률 계산, 펼침 상세·검색 버튼·6개 단위 표시 | 실제 API/로컬 fixture 계약 불일치, Pixel fixture와 일반 화면 혼동 |
| 리포트 | 1건을 기록해도 카테고리 분석을 숨기고 월/분기/연간을 탭으로만 보여 주며 기술 문구 노출 | 기저귀 12,000원 저장 → 리포트 | `recordCount >= 3` UI gate, 단일 기간 카드, `Report V3`/`ledger` 문구 | 서버·로컬 maturity도 카테고리를 3건부터 허용하고 내일 예정 행을 기간 집계에 포함 | 1건 카테고리 표시와 예정 행 제외 계약 없음 | 1건부터 카테고리, 현재 월·분기·연간 동시 요약, 6개월 추이+접근성 표, 사용자 문구로 교체 | 추가 집계 요청 수와 캐시 키 중복, 빈 데이터 상태 |

### 4.1 설치 기준선 증거

- baseline APK: `F:\WooriAI\wooriai-0.0.0-release-standalone.apk`
- SHA-256: `6BB00A10D74C4DFB42ABC36A63EDB4C4834148F36083EA781614C24CF443CCB8`
- APK source snapshot: `978FC5CDC514628DCA0297516EBE171CB3277196A3640A26FA01D3AA10919B35` / 961 files
- 독립 재계산한 builder snapshot과 위 값이 일치했다.
- 설치 환경: isolated `wooriai_pixel_5_api35`, Android 15, `1080x2340`, density 440
- baseline 캡처: `artifacts/apk-feedback-2026-07-28/baseline`
- force-stop/restart 후 아이 프로필과 12,000원 지출이 유지됐고 앱 FATAL EXCEPTION은 없었다. 초기 System UI ANR은 메모리 2GB AVD와 호스트 메모리 압박에서 발생한 외부 환경 사건으로 분리한다.

## 5. 보존할 현재 구현

- 기록 → 합계 → 준비템 → 구매 링크 → 구매 후 기록/상태의 핵심 루프
- child/household exact-scope와 fail-closed 안전 동작
- 오프라인 outbox 및 서버 reconciliation 계약
- 서버 소유 KST 기간과 Report V3 계산 기반
- source snapshot, APK hash, installed `base.apk`, adb 캡처를 연결하는 Android provenance 체계

## 6. 설계 결정

### 6.1 UX 구조

- 홈: 아이 전환 → 월 예산/사용액 → 빠른 실행 → 준비 품목·최근 기록 순서를 유지한다.
- 지출: 어제/오늘/내일 고정 선택과 독립 48dp 달력 버튼을 첫 입력으로 둔다. 달력 최대일은 내일이다.
- 품목 검색: 품목명, 별칭, 태그, 분류명, 한글 초성을 하나의 정규화·점수 함수로 검색한다. 결과는 정확 일치 → prefix → 부분 일치 → 초성 일치 → 사용 빈도 순이다.
- 준비템: 추천 전체 수가 아니라 사용자가 상태를 정한 품목을 `준비 중/완료` 진행률로 계산한다. 카드는 눌러 상태별 목록을 확인한다.
- 리포트: 현재 월·분기·연간을 동시에 요약하고, 선택한 기간 상세 아래에 카테고리와 월별 추이를 접근성 표와 함께 제공한다.

### 6.2 데이터 계약

- 수동 지출 생성·수정: KST 기준 내일까지 허용, 모레 이후 거부.
- Excel import: 기존 계약대로 미래 행 전체 거부.
- 예정 행: 기록 목록에는 남고 `예정`으로 표시하지만 홈, 예산 사용액, 월/분기/연간, 카테고리, 추이, 누적 실현 지출에는 포함하지 않는다.
- 실제 API와 local backend는 같은 계약을 적용한다.

### 6.3 디자인 레퍼런스 경계

- Mobbin 검색은 유료 플랜 요구로 실행 불가했다. 외부 이미지를 대신 사용하지 않았다.
- 로컬 UI/UX 지침에서 모바일 48dp 터치 타깃, 검색의 직접 피드백, progressive disclosure, 접근성 표를 채택했다.
- WooriAI의 기존 coral/semantic token과 타이포 체계는 보존했으며, 검색 도구가 제안한 별도 색상·폰트는 적용하지 않았다.
