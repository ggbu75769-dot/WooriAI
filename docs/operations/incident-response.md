# 장애 대응 (Incident Response)

## 심각도 분류

| 등급 | 기준 | 예시 | 초동 |
|---|---|---|---|
| SEV1 | 전체 사용 불가·데이터 유실·보안 침해 | DB 다운, 토큰 유출, 지출 데이터 소실 | 즉시 대응, 필요 시 롤백 |
| SEV2 | 핵심 루프 일부 불가 | 지출 저장 실패, 로그인 실패율 급증 | 1시간 내 대응 |
| SEV3 | 부가 기능 결함 | 리포트 지연, 특정 화면 오류 | 다음 배포에 수정 |

## 초동 절차

1. `GET /api/v1/health` (liveness) / `GET /api/v1/health/ready` (DB 연결 포함) 확인.
2. 서버 로그에서 requestId 기준으로 오류 추적 (structured JSON 로그, Authorization 헤더는 redact됨).
3. DB 상태: `pnpm db status`, 연결 수·디스크 확인.
4. 최근 배포와 상관 있으면 [rollback.md](rollback.md) 수행.

## 보안 사고 (토큰/키 유출 의심)

1. `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` 즉시 교체 → 전체 세션 무효화됨(재로그인 유도).
2. refresh token은 DB에서 family 단위 revoke 가능: `UPDATE refresh_tokens SET revoked_at=now() WHERE user_id='...';`
3. 관리자 계정 침해 시: `UPDATE admin_users SET active=false WHERE email='...';` + 비밀번호 재설정.
4. `audit_logs`로 침해 기간 내 변경 이력 전수 조사.

## 데이터 사고

1. 쓰기 트래픽 차단(점검 모드) 후 [database-backup-restore.md](database-backup-restore.md)로 복원 범위 판단.
2. 부분 복원이 필요하면 백업을 별도 DB에 restore 후 필요한 행만 이관.

## 사후

- 타임라인·원인·영향 범위·재발 방지책을 기록하고, 회귀 테스트를 추가한다.
- known-limitations.md에 남은 위험을 갱신한다.
