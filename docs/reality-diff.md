# WooriAI Reality Diff

기준 시각: 2026-07-30 02:57 KST
진실원: 실행 결과 → Git HEAD → CI → 실사용 데이터 → 문서.

## 불일치

| 등급 | 문서·기대 주장 | 실측 | 조치 | 상태 |
| --- | --- | --- | --- | --- |
| ① 틀린 것 | `docs/operations/self-implement/CURRENT_STATE.md`가 `codex/sprint2-catalog-payments` / `edaf1f3`를 현재 좌표로 표시 | 현재 제품 소스는 `codex/wooriai-apk-feedback-ux-hardening-v1` / `6a3f4a0` | CURRENT_STATE를 이 문서와 현재 제품 소스로 갱신 | CLOSED |
| ① 틀린 것 | CURRENT_STATE가 과거 Pixel APK `8244...`를 현재 산출물로 표시 | 최신 standalone 설치 검증 APK는 `6C4ABD...57BBB`, built/installed hash 일치 | APK·증거 경계 갱신 | CLOSED |
| ② 깨진 것 | PR 검사가 실행되어 코드 품질을 판정할 것으로 기대 | run `30382997599`는 step 시작 전 GitHub 결제/spending limit로 실패 | 사람 큐에 결제 복구 적재; 로컬 16/16을 별도 유지 | OPEN / EXTERNAL |
| ③ 막힌 것 | 릴리스 후보가 운영에서 사용 가능 | 프로덕션 URL·운영 빌드 ID·production signing·운영 인프라가 없음 | 승인 입력을 사람 큐로 분리, 로컬 후보와 운영 완료를 계속 구분 | OPEN / EXTERNAL |
| ③ 막힌 것 | 분석 스키마가 있으므로 과업 완주율을 계산할 수 있음 | 로컬 `analytics_events` 0건, 운영 분석 DB 없음 | 운영 배포 전 계측 경로 검증; 현재는 수치 주장 금지 | OPEN / EXTERNAL |
| ④ 헷갈리는 것 | 지출 신규 화면은 네이티브 날짜·벡터 아이콘인데 수정 화면은 직접 날짜 문자열·유니코드 아이콘 사용 | 같은 과업의 신규/수정 UI가 불일치 | `a0355e3`에서 네이티브 날짜 선택, 벡터 아이콘, 접근성·검증 회귀 추가 | LOCAL CLOSED |
| ④ 헷갈리는 것 | 이름 입력 뒤 생일 달력을 닫으면 다음 입력으로 이어질 수 있음 | 키보드가 남아 성별과 CTA를 가림 | `6a3f4a0`에서 DateField가 picker 전 keyboard dismiss; source-bound APK 재검증 | CLOSED |
| ② 깨진 것 | Release Gate는 한 소스 좌표를 안정적으로 판정함 | 동시 실행 2개가 같은 Admin `.next`를 경합해 `build-manifest.json` ENOENT false-red 발생 | `37ad654`에서 repo-scoped lock, stale 복구, token-safe release, 실제 차단 subprocess 회귀 추가 | CLOSED |
| ④ 헷갈리는 것 | EXP-003 진입 시 현재 카테고리를 즉시 확인할 수 있음 | `기저귀·위생` 선택 칩이 horizontal viewport 밖에 있어 첫 화면에 안 보임 | `90b902f`에서 선택 칩 위치 측정·자동 reveal, Android bounds·렌더 회귀 확인 | CLOSED |
| ⑤ 어긋난 것 | 모든 중요한 모바일 변경은 설치 앱 직접 증거가 있음 | 일반 `EXP-003` 수정 흐름 직접 캡처가 없었음 | standalone 설치 앱에서 생성 → 수정 → 기록·홈 합계 반영 증거 수집 | CLOSED |
| ⑤ 어긋난 것 | 현재 저장소와 Android Pixel Lock 증거가 같은 source snapshot임 | Pixel 9/9는 `a0355e3` 계열 prior-source이고 current repository exact-source rerun은 없음 | current source Pixel APK 재빌드 후 9개 adb screencap 재실행 | OPEN |

사용자 화면에 노출된 검증 불가능한 운영 수치 불일치는 0건으로 관측됐다. 단, 프로덕션 자체가 없어 “운영 화면 전수 확인”을 수행한 결과는 아니다.

## 우선순위 백로그

| 등급 | 건수 | 최상단 |
| --- | ---: | --- |
| ① 틀린 것 | 0 open | 현재 좌표·APK 문서 수정 완료 |
| ② 깨진 것 | 1 | GitHub Actions 결제 차단 해소 후 동일 HEAD CI 재실행 |
| ③ 막힌 것 | 4 | production identity/signing, 운영 core 인프라, catalog 독립 검토, 실제 계측 |
| ④ 헷갈리는 것 | 0 open | EXP-003 저장 카테고리 자동 reveal 완료 |
| ⑤ 어긋난 것 | 1 | current repository exact-source Android Pixel 9/9 재검증 |
| ⑥ 아쉬운 것 | 1 | 물리 Android/TalkBack·iOS 상호작용 검증 부재 |

최상단 3건:

1. GitHub Actions billing/spending limit 차단을 사람이 복구한 뒤 current HEAD CI를 실행한다.
2. current source Pixel APK를 재빌드하고 9개 adb screencap gate를 다시 실행한다.
3. production identity/signing 및 운영 API·DB·Redis·storage 입력이 생기기 전까지 외부 릴리스 완료 주장을 차단한다.
