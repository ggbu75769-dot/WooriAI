# Release 3 관측성·장애 대응 런북

## 수집 경계

- 로그 허용: request/trace/job id, hashed dedupe key, route, status, latency, error code, app version, environment.
- 로그 금지: token/OAuth code/password/signed URL/memo/itemName/email/phone/full IP/raw user-agent/legal export payload.
- `/api/v1/internal/metrics`는 production에서 `x-internal-token`을 요구하며 외부 ingress에서도 차단한다.

## 핵심 지표와 초기 alert 조건

| 영역 | 지표 | 초기 조건 |
| --- | --- | --- |
| API | request count/duration/5xx | 5xx 비율 5분 2% 초과 |
| Auth | auth success/failure, refresh reuse | reuse 1건 즉시 조사 |
| Sync | success/conflict/failure | failure 5분 연속 또는 conflict 급증 |
| Outbox | pending, oldest age | oldest 120초 초과 |
| DLQ | open count | 1건 이상 warning, privacy는 critical |
| Privacy | failed, oldest open age | failed 1건 또는 SLA 50% 초과 |
| Content/link | scheduled publish/link failure | publish 1건, link failure 급증 |
| Notification | state별 delivery | failed ratio 임계치 승인 필요 |
| Report | integrity mismatch | 1건 즉시 critical |

Queue depth/age의 BullMQ 직접 scrape, vendor dashboard, paging channel은 아직 연결되지 않았다. Redis service가 확보되면 worker/publisher readiness와 BullMQ depth를 같은 internal network에서 수집한다.

## 장애 순서

1. request/trace/job id로 범위를 고정하고 민감 payload를 복사하지 않는다.
2. DB readiness, Redis 연결, worker/publisher process, outbox age, DLQ를 확인한다.
3. privacy/report mismatch는 신규 관련 작업을 일시 중지하고 운영자에게 즉시 escalate한다.
4. retry는 idempotency/dedupe key 확인 후 수행하고, terminal error를 무한 재시도하지 않는다.
5. 복구 후 source SHA, 영향, 재처리 수, 개인정보 영향, 후속 action을 기록한다.
