# 장애 대응 (Incident Response)

## 심각도 분류

| 등급 | 기준 | 예시 | 초동 |
|---|---|---|---|
| SEV1 | 전체 사용 불가·데이터 유실·보안 침해 | DB 다운, 토큰 유출, 지출 데이터 소실 | 즉시 대응, 필요 시 롤백 |
| SEV2 | 핵심 루프 일부 불가 | 지출 저장 실패, 로그인 실패율 급증 | 1시간 내 대응 |
| SEV3 | 부가 기능 결함 | 리포트 지연, 특정 화면 오류 | 다음 배포에 수정 |

## 초동 절차

1. 헬스체크 3종 확인 — 엔드포인트 표와 판정 기준은
   [release-runbook.md §3.1](release-runbook.md)에 있다.
   - `GET /api/v1/health` — liveness. 200이어도 DB를 보지 않으므로 **이것만으로 정상 판정 금지**.
   - `GET /api/v1/health/ready` — readiness(DB 연결 포함). **503이면 DB 문제**.
   - `GET /api/v1/health/worker` — 워커 상태. **항상 200**이므로 본문의 `"stale":true`·
     `"degraded":true`와 `jobs[].lastStatus`를 읽는다(모니터 설정은
     [release-runbook.md §3.2](release-runbook.md)).
2. 서버 로그에서 requestId 기준으로 오류 추적 (structured JSON 로그, Authorization 헤더는 redact됨).
3. DB 상태: `pnpm db status`, 연결 수·디스크 확인. 데이터는 PostgreSQL에 영속되므로
   **API를 재기동해도 사용자 데이터가 사라지지 않는다** — "재시작하면 초기화되는" 프로토타입
   시절의 가정으로 판단하지 않는다.
4. 마이그레이션 적용 여부 확인: 배포와 스키마가 어긋난 증상이면
   `pnpm --filter api prisma:deploy` 재실행([database-migrations.md](database-migrations.md)).
5. 최근 배포와 상관 있으면 [rollback.md](rollback.md) 수행.

## 보안 사고 (토큰/키 유출 의심)

1. `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` 즉시 교체 → 전체 세션 무효화됨(재로그인 유도).
2. refresh token은 DB에서 family 단위 revoke 가능: `UPDATE refresh_tokens SET revoked_at=now() WHERE user_id='...';`
3. 관리자 계정 침해 시: `UPDATE admin_users SET active=false WHERE email='...';` + 비밀번호 재설정.
4. `audit_logs`로 침해 기간 내 변경 이력 전수 조사.

## 데이터 사고

1. 쓰기 트래픽 차단(점검 모드) 후 [database-backup-restore.md](database-backup-restore.md)로 복원 범위 판단.
2. 부분 복원이 필요하면 백업을 별도 DB에 restore 후 필요한 행만 이관.
3. Prisma는 down migration을 만들지 않으므로 스키마를 되돌려야 하는 사고는 **배포 직전 백업
   복원이 유일한 경로**다(백업 이후 데이터는 유실 — 최후 수단). [rollback.md](rollback.md) §1 참조.

## 백그라운드 워커 정지 (SEV3, 조용히 쌓이는 장애)

퍼지/정리 잡이 멈추면 화면에는 아무 증상이 없고 오래된 데이터만 계속 쌓인다 — 그래서 별도
항목으로 둔다.

증상은 두 갈래다 — **루프가 멈춤(`stale`)** 과 **루프는 도는데 특정 잡이 계속 실패
(`degraded`, OPS-130)**. 둘 다 화면에는 아무 증상이 없다.

1. `GET /api/v1/health/worker` 본문 확인: `enabled`(의도적으로 끈 배포인가), `stale`(enabled인데
   인터벌 3배 안에 끝난 틱이 없음), `degraded`(어떤 잡이 `failureThreshold`회 연속 실패),
   `jobs[].lastStatus`/`lastRunAt`/`consecutiveFailures`.
2. `stale=true`면 API 프로세스 재기동으로 스케줄러를 되살린다. 상태는 프로세스 단위라
   재기동 시 초기화된다.
3. `degraded=true`면 **재기동으로 해결되지 않는다**(카운터만 초기화됨). `consecutiveFailures`가
   가장 큰 잡을 찾아 서버 로그에서 `job=<이름> status=failed` 라인의 스택을 읽는다 — 오류
   문자열은 무인증 엔드포인트에 노출되지 않고 로그에만 남는다. 파기 잡이라면
   `phase=<라벨> ... 수동 조치 필요` ERROR 로그(poison-skip)를 함께 확인한다.
4. `enabled=false`인데 워커가 돌아야 하는 배포라면 **`WORKER_ENABLED=1`이 주입됐는지** 확인한다
   (주기는 `WORKER_INTERVAL_MS`, 미설정 시 기본값). `enabled=false`는 `stale`을 항상 `false`로
   만들어 모니터가 조용하므로, "알림이 없었다"가 "워커가 돌았다"를 뜻하지 않는다.
5. 재발 방지: 업타임 체커의 keyword 모니터(`"stale":true`·`"degraded":true` **둘 다**)가 실제로
   걸려 있는지 확인 ([release-runbook.md §3.2](release-runbook.md)).

## 사후

- 타임라인·원인·영향 범위·재발 방지책을 기록하고, 회귀 테스트를 추가한다.
- known-limitations.md에 남은 위험을 갱신한다.
