# WooriAI Human Queue

갱신: 2026-08-12 · 현재 실행 결과와 스토어 제출 기준은 `docs/operations/launch-readiness-2026-08-12.md`를 우선한다.

이 큐의 항목은 승인·외부 입력이 필요하지만 로컬 개선 루프를 멈추지 않는다. 입력을 받은 뒤에는 `pnpm release:store-preflight`가 10개 범주 모두 PASS인지 먼저 확인한다.

| 항목 | 왜 필요한가 | 사람이 할 일 | 예상 소요 | 폴백 | 대체 경로 |
| --- | --- | --- | --- | --- | --- |
| GitHub Actions billing/spending limit | PR #2 run `30382997599`가 job 시작 전에 차단됨 | GitHub Billing & plans에서 결제 실패 또는 spending limit 확인·복구 | 5~15분 | 로컬 `pnpm release:gate`와 Android gate 유지 | 복구 후 current HEAD workflow_dispatch 또는 PR 재실행 |
| production application ID/version/signing | 내부 debug/Pixel APK는 스토어 후보가 아님 | application ID, version policy, keystore 보관·서명 주체 결정 | 30~60분 | 내부 APK만 유지, production 주장 금지 | 입력 후 store preflight와 signed AAB gate 실행 |
| 운영 core 인프라 | 운영 API·PostgreSQL·Redis·object storage가 없음 | 승인된 endpoint와 secret storage 연결 | 반나절 이상 | local staging과 fail-closed config 유지 | 준비된 영역부터 staging smoke 분리 |
| OAuth/push/recall/merchant/monitoring | 실제 외부 연동과 장애 감지가 증명되지 않음 | 공급자 계정·credential·운영 정책 제공 | 공급자별 상이 | 관련 feature flag OFF | 각 provider를 독립 rollout |
| 법적 운영 정보 | placeholder URL은 운영 배포에 사용할 수 없음 | 승인된 약관·개인정보·지원·사업자 URL 제공 | 30분 이상 | 외부 배포 금지 | 승인 문서가 준비된 뒤 config만 연결 |
| catalog 파일럿 독립 검토 | 구조 gate 통과가 운영 게시 승인은 아님 | 12개 파일럿을 독립 검토·승인 | 30~60분 | draft 유지 | 승인된 항목만 publisher로 분리 게시 |
| 물리 Android/TalkBack·iOS | 에뮬레이터 Pixel Lock이 실제 기기 접근성을 대체하지 않음 | 기기 제공 및 수동 접근성 시나리오 수행 | 1~2시간 | 에뮬레이터·자동 회귀 유지 | Android와 iOS를 별도 자격화 |
| Play Console internal track | 로컬 APK·AAB는 store signing·심사를 증명하지 않음 | 개발자 계정에서 승인된 package의 internal release 생성 | 30~60분 + 심사 | 내부 source-bound APK 검증 유지 | store-signed 설치본으로 upgrade·cold-start·탈퇴 검증 |
| closed beta 운영 | 자동 테스트는 실제 사용자 장기 안정성을 대체하지 않음 | 최소 7일 테스터 운영, S0/S1·crash·privacy SLA 확인 | 7일 이상 | 출시 완료 주장 금지 | 단계별 rollout과 즉시 rollback 준비 |
