# Release 3 백업·복구 런북

상태: 절차 정의 완료, 실제 cloud restore drill 미실행. 공급자와 운영 RPO/RTO는 승인 전 placeholder다.

## 목표와 전제

- PostgreSQL이 사용자·동의·개인정보 요청·outbox의 유일한 source of truth다.
- Redis/BullMQ는 재생성 가능한 전달 계층이며 백업 복구 기준 데이터가 아니다.
- Object storage에는 import 원본과 export 결과가 있을 수 있고 DB object key와 수명 정책을 함께 검증한다.
- RPO: `APPROVAL_REQUIRED`; RTO: `APPROVAL_REQUIRED`. 승인 전 공개 출시 gate를 닫는다.

## 백업 정책

1. PostgreSQL PITR를 활성화하고 WAL 보존·암호화·복구 가능 기간을 운영자 승인값으로 설정한다.
2. 매일 암호화 snapshot을 만들고, schema migration 직전 별도 pre-migration snapshot을 만든다.
3. snapshot·WAL·object storage는 운영 DB 계정과 분리된 권한으로 보존한다.
4. privacy export object는 `PRIVACY_EXPORT_TTL_HOURS` 만료 후 삭제하고 signed URL 원문을 로그에 남기지 않는다.
5. 삭제 요청의 외부 processor 처리 결과와 재시도 가능한 event/outbox 기록은 DB에 보존한다.

## Restore drill

1. production 쓰기를 중지하고 source SHA, migration head, 마지막 정상 시점, incident id를 기록한다.
2. 격리된 새 DB에 snapshot을 복원하고 선택한 시점까지 WAL을 재생한다. 운영 DB를 덮어쓰지 않는다.
3. `pnpm --filter api prisma:validate` 후 `prisma_migrations`가 저장소 head와 일치하는지 확인한다.
4. seed는 신규 빈 환경에서만 실행한다. 복원 DB에는 seed를 재실행하지 않는다.
5. FK·unique·expense 합계·report integrity·열린 privacy request·outbox/DLQ를 점검한다.
6. 복원 시점 이후 이미 완료된 계정 삭제/외부 unlink event 목록을 원본 감사 증적과 대조해 재생한다. 삭제된 PII를 되살린 채 트래픽을 열지 않는다.
7. Object key 존재·암호화·expiry를 확인하고 누락된 export는 재생성, 누락된 import 원본은 실패 상태로 격리한다.
8. 새 Redis를 빈 상태로 시작하고 미발행 outbox를 publisher가 재전달하도록 한다. 중복 전달은 `ProcessedJob` unique key로 검증한다.
9. readiness, smoke, OAuth callback, delete/export, outbox 처리, report sum을 통과한 뒤 트래픽을 전환한다.

## Rollback과 forward-fix

- 순서: 트래픽 차단 → worker/publisher 중지 → 앱/API 이전 artifact 전환 → DB 호환성 확인 → 트래픽 재개.
- additive migration은 기본적으로 rollback SQL로 되돌리지 않고 forward-fix한다.
- 파괴적 migration은 별도 승인·dual read/write 기간·복구 drill 없이는 실행하지 않는다.
- 이전 artifact가 새 schema를 읽을 수 없으면 application rollback을 금지하고 forward-fix한다.

## Drill 증적

운영자는 날짜, 공급자, snapshot id(비밀 아님), 시작/종료, 측정 RPO/RTO, source SHA, migration head, privacy replay 수, integrity 결과, 승인자를 `docs/qa/evidence/`에 남긴다. 현재는 실제 drill 증적이 없으므로 공개 출시 blocker다.
