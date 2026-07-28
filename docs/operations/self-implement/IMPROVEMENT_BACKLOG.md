# WooriAI Local Improvement Backlog

갱신: 2026-07-27

| ID | 현재 결과 | 검증 | 상태 |
| --- | --- | --- | --- |
| SI-001 | offline create flush 중 추가 edit도 순차 drain | sync engine/store tests | DONE |
| SI-002 | pnpm 11.9.0 고정, 현재 Node/pnpm에서 전체 Gate | Release Gate 16/16 | DONE |
| SI-003 | household-scoped v2 cursor, persisted continuation, tombstone reconciliation | API sync cursor/E2E + mobile delta runner/reconciliation | DONE |
| SI-004 | production identity/signing/device | config preflight와 artifact provenance | EXTERNAL_BLOCKED |
| SI-005 | 5탭 current-design Pixel 계약 | adb 설치 캡처 9/9 | DONE |
| SI-006A | mobile-owned Metro/build source 경계 | clean source-bound APK와 installed hash parity | DONE |
| SI-006B | startup module graph 축소·안정성 | source regression, 설치 fatal 0 | INTERNAL DONE / DEVICE PERFORMANCE BLOCKED |
| SI-007 | 기본 catalog audit가 drifted dev DB에 의존 | 격리 41-migration DB audit, 사후 DB 0 | DONE |
| SI-008 | catalog 파일럿 정상 승인 상태가 worklist에서 제외 | DB 통합 21 tests, Admin browser, manifest publish CAS | DONE |

## 외부 우선순위

1. production application ID/version/signing
2. 운영 PostgreSQL/Redis/object storage와 backup/restore
3. OAuth/push/recall/merchant/monitoring
4. 12개 catalog 파일럿 독립 검토·게시
5. 물리 Android/TalkBack과 iOS core loop
6. Play internal track 및 단계적 rollout
