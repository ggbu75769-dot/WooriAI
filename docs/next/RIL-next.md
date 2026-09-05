# WooriAI Recursive Improvement Loop — Cycle 5 Revision

기준 시각: 2026-07-30 03:13 KST  
검토 범위: autopilot cycle 1~5

## 예측 정확도

| 예측 사이클 | 다음 예측 | 실제 | 목표 방향 | 범위·노력 |
| --- | --- | --- | --- | --- |
| 1 → 2 | 설치 앱 지출 생성·수정·합계 검증 | 과업 PASS, 인접 결함 2건 추가 발견 | 적중 | 과소예측 |
| 2 → 3 | 선택 카테고리 자동 reveal | Android bounds가 offscreen에서 onscreen으로 이동 | 적중 | 적중 |
| 3 → 4 | Release Gate 단일 실행 guard | 실제 중복 subprocess 차단, stale/token 회귀 추가 | 적중 | 검증 횟수 과소예측 |
| 4 → 5 | current-source Pixel 9화면 재검증 | source/built/installed 일치, 9/9 PASS | 적중 | 적중 |

- 목표 방향 정확도: 4/4 = 100%.
- 범위·노력 정확도: 2/4 = 50%.
- 시스템 편향: 완료 방향은 잘 맞추지만 직접 실행에서 나오는 인접 결함과 source-exact 재검증 비용을 반복해서 낮게 본다.
- 운용 개정: 다음 예측부터 `예상 변경 범위 / 예상 직접검증 시간 / 새 결함 발견 시 폴백`을 한 줄에 함께 적는다.

## 게이트 감사

- 실제로 걸린 게이트: Release Gate production build가 동시 `.next` 작성으로 1회 false-red를 냈다. 원인은 repo 상호배제 부재였고 `37ad654`의 lock 및 실제 동시 실행 회귀로 구조 수정했다.
- 반복 위험: source-bound Android 증거가 제품·게이트 커밋 뒤 prior-source가 되는 일이 반복됐다. cycle 5에서 current source Pixel APK를 clean rebuild하고 source/built/installed 3중 일치를 다시 확보했다.
- 5사이클 동안 red가 없던 안전 게이트를 단순 삭제하지 않는다. env, secret, Prisma, lint, type, peer gate는 각각 다른 고위험 실패를 막아 서로 대체되지 않는다.
- 기준 상향: Android Pixel 승격 목표는 기존 필수 `<= 0.0500`에서 `<= 0.0480`으로 높인다. cycle 5의 9개 화면은 최고 `0.047382`로 상향 목표도 통과했다. 필수 fail threshold 변경은 두 번째 독립 current-source 실행에서도 `<= 0.0480`이 재현된 뒤 코드 gate로 승격한다.
- 기존 gate가 놓친 영역: overall score는 PASS지만 IMP-003 bottom CTA `0.0728`, ITEM-002 bottom/footer `0.0726`, REP-001 bottom CTA `0.0684`다. zone 회귀 기준은 다음 시각 튜닝에서 후보 기준으로 사용한다.

## 직접 써 보기·재발

- cycle 2에서 신규 사용자 onboarding → 지출 생성 → 수정 → 기록·홈 합계를 직접 완주했다. 5사이클 내 최소 1회 조건을 충족했다.
- 발견했던 keyboard 가림과 selected category 미노출은 각각 렌더/source contract와 current-source Android 재검증으로 닫혔다.
- 동일 결함의 재발은 cycle 5까지 0건이다.
- 다음 직접 과업은 아직 current-source 설치 앱에서 끝까지 증명하지 않은 `준비템 선택 → 제휴 고지 확인 → 구매 링크 → 구매 후 상태 기록`이다.

## 다음 5사이클 운용 개정

1. full Release Gate는 repo lock 소유자 1개만 실행한다. focused 검증 뒤 사이클 종료 시 정확한 소스에서 한 번 실행한다.
2. Android 증거는 항상 source snapshot, built APK, installed `base.apk`를 함께 기록한다.
3. Pixel 후보는 overall `<= 0.0480`과 checked zone 비악화 여부를 함께 보고한다.
4. 직접 과업에서 새 결함이 나오면 예측 실패가 아니라 범위 과소예측으로 수치화하고 바로 백로그에 넣는다.
5. cycle 10에서 같은 방식으로 목표 방향 정확도와 범위·노력 정확도를 분리 계산한다.
