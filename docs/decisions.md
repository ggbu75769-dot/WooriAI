# WooriAI Autopilot Decisions

- 2026-07-30 01:28 KST / 과거 날짜형 baseline 대신 `docs/state-of-truth.md`를 현재 좌표의 우선 문서로 둔다 / 오래된 HEAD·APK 주장을 자동으로 현재 사실처럼 읽는 위험 제거 / 과거 보고서는 역사 증거로 보존.
- 2026-07-30 01:28 KST / GitHub run `30382997599`를 코드 실패가 아닌 CI 인프라 차단으로 분류한다 / job step 0개와 billing annotation 1건 / 로컬 gate 상태와 CI 상태를 분리 보고.
- 2026-07-30 01:28 KST / analytics 0건에서 완주율·재사용률을 계산하지 않는다 / 운영 분모가 없고 로컬 DB도 0행 / 수치 발명 없이 계측 검증을 운영 백로그에 유지.
- 2026-07-30 01:28 KST / EXP-003 UI 개선을 새 개념 없이 기존 공유 컨트롤 심화로 해결한다 / 신규 지출 흐름과의 불일치가 원인 / 새 화면·새 의존성 없이 단일 revert 가능.
- 2026-07-30 01:28 KST / Pixel Lock 9/9를 일반 EXP-003 runtime 증거로 대체하지 않는다 / P0 fixture 화면 집합에 EXP-003이 없음 / 다음 T2 walkthrough가 별도 증거를 만든다.
- 2026-07-30 02:01 KST / Android DateField를 열기 전에 소프트 키보드를 닫는다 / 직접 walkthrough에서 이름 입력 키보드가 성별·CTA를 가림 / 모든 onboarding 날짜 필드에 같은 복구 적용.
- 2026-07-30 02:01 KST / 현재 standalone 과업 증거와 prior-source Pixel 9/9를 분리한다 / keyboard 변경 후 standalone은 source-bound 재검증했지만 Pixel 전체는 재실행하지 않음 / exact-source가 아닌 visual 증거를 현재 완료로 오인하지 않음.
- 2026-07-30 02:38 KST / EXP-003이 저장 카테고리 위치를 측정해 선택 칩을 자동 reveal한다 / 직접 사용에서 현재 분류가 viewport 밖에 숨었음 / 새 화면·의존성 없이 기존 가로 칩 과업을 복구.
- 2026-07-30 02:38 KST / 중복 Release Gate 실패를 제품 빌드 실패와 분리하되 재발 가능한 구조 결함으로 백로그화한다 / 첫 게이트 하위 프로세스와 두 번째 gate가 `.next`를 경합했고 단일 재실행은 16/16 PASS / 다음 T4에서 repo-scoped 상호배제를 굳힘.
- 2026-07-30 02:57 KST / full/dry-run Release Gate는 저장소당 하나만 실행하고 config-only는 별도 증거라 lock 밖에 둔다 / `.next`·최신 evidence의 단일 작성자가 필요하지만 config 검증은 공유 빌드 산출물을 쓰지 않음 / 중복 full gate는 PID·시각을 포함한 exit 2로 조용하지 않게 차단.
- 2026-07-30 02:57 KST / lock 해제는 owner token 일치 시에만 허용하고 죽은 PID·3시간 초과 lock은 복구한다 / 강제 종료 잔여와 PID 재사용 모두 고려 / 영구 교착 없이 후속 실행의 lock을 이전 실행이 삭제하지 못함.
