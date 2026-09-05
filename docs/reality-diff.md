# WooriAI Reality Diff

기준 시각: 2026-07-30 10:29 KST
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
| ⑤ 어긋난 것 | 현재 저장소와 Android Pixel Lock 증거가 같은 source snapshot임 | Pixel 9/9는 `a0355e3` 계열 prior-source였음 | clean source `70921b8`, snapshot `91FA...E8D7`에서 APK 재빌드·built/installed 일치·9/9 재실행 | CLOSED |
| ② 깨진 것 | 안전한 판매처 CTA는 Android 브라우저로 이동하고 복귀 후 구매 후속을 남김 | Chrome과 HTTPS manifest query가 있어도 `Linking.canOpenURL`을 수신자 없이 호출해 동기 TypeError 후 일반 실패 메시지만 표시 | `9c82096`에서 수신자 보존, `canOpenURL` 참고값화, Custom Tab 복구·LOCKED 실패 폐쇄와 Android 직접 증거 추가 | CLOSED |
| ⑥ 아쉬운 것 | overall Pixel PASS면 IMP-003 CTA 영역도 충분히 근접함 | IMP bottom CTA `0.072793`, footer `0.060984` | Pixel-only inset 40으로 CTA `0.036341`, footer `0.033191`, overall `0.034990`; SET·REP 유지 | CLOSED |
| ② 깨진 것 | `pixel:capture` 뒤 `pixel:diff`가 방금 캡처한 화면을 검증함 | 전환 중 흰 SET Surface와 과거 XML을 섞어 `PASS 0.0328`로 오판 가능 | readiness/stable capture 강제, screenshot보다 오래된 XML·logcat 거부, 실제 SET capture-only 재검증 | CLOSED |
| ④ 헷갈리는 것 | `pixel:tune`의 inset 후보가 현재값 주변의 조정값으로 읽힘 | fallback 56인데 scaffold `-8..8`은 절대값이라 첫 두 후보가 footer 침범·overall FAIL | `52afb97`에서 style/generated effective baseline, absolute 의미, 단위, target+siblings+SET guard를 생성 | CLOSED |
| ② 깨진 것 | production dependency audit PASS가 취약점 0건으로 읽힐 수 있음 | high threshold는 통과했지만 Expo CLI 경로의 `tar 7.5.19`에 moderate `GHSA-r292-9mhp-454m` 1건 존재했음 | `8db7615`에서 `7.5.21` 고정, lockfile floor 회귀, audit 0건·Expo·전체 gate·Android 재검증 | CLOSED |
| ⑥ 아쉬운 것 | 남은 Pixel 내부 하단 영역도 참조와 충분히 근접함 | ITEM-002 footer `0.072596`, REP CTA `0.068396` | 다음 시각 트랙에서 개별 후보·sibling guard 적용 | OPEN / LOCAL |
| ⑤ 어긋난 것 | 모든 핵심 사용자 과업이 일반 설치 앱에서 직접 증명됨 | Excel preview-before-save는 Pixel fixture·자동 회귀만 있고 선택→미리보기→승인 저장→기록 반영 직접 증거가 없음 | 다음 T2에서 current-source standalone으로 처음부터 끝까지 수행하고 마찰을 백로그화 | OPEN / LOCAL |

사용자 화면에 노출된 검증 불가능한 운영 수치 불일치는 0건으로 관측됐다. 단, 프로덕션 자체가 없어 “운영 화면 전수 확인”을 수행한 결과는 아니다.

## 우선순위 백로그

| 등급 | 건수 | 최상단 |
| --- | ---: | --- |
| ① 틀린 것 | 0 open | 현재 좌표·APK 문서 수정 완료 |
| ② 깨진 것 | 1 | GitHub Actions 결제 차단 해소 후 동일 HEAD CI 재실행 |
| ③ 막힌 것 | 4 | production identity/signing, 운영 core 인프라, catalog 독립 검토, 실제 계측 |
| ④ 헷갈리는 것 | 0 open | source-aware absolute 후보와 guard 생성 완료 |
| ⑤ 어긋난 것 | 1 | Excel preview-before-save 일반 설치 앱 직접 완주 증거 확보 |
| ⑥ 아쉬운 것 | 2 | ITEM-002/REP 하단 zone 편차; 물리 Android/TalkBack·iOS 상호작용 검증 부재 |

최상단 3건:

1. GitHub Actions billing/spending limit 차단을 사람이 복구한 뒤 current HEAD CI를 실행한다.
2. production identity/signing 및 운영 API·DB·Redis·storage 입력이 생기기 전까지 외부 릴리스 완료 주장을 차단한다.
3. 다음 T2 직접 사용에서 Excel preview-before-save → 승인 저장 → 기록 반영 과업의 일반 설치 앱 증거와 마찰을 수집한다.
