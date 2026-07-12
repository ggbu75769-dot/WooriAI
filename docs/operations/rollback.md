# 롤백 절차

## 1. API 서버 롤백

1. 이전 릴리즈 커밋/태그로 배포 대상 전환.
2. **마이그레이션 호환성 확인**: 롤백 대상 코드가 현재 DB 스키마와 호환되는지 확인한다. 라운드 4 마이그레이션은 additive(테이블·컬럼 추가) 위주라 코드만 롤백해도 대체로 안전하다.
3. 스키마 롤백이 불가피하면 — Prisma는 down migration을 생성하지 않으므로 [database-backup-restore.md](database-backup-restore.md)의 배포 직전 백업으로 복원한다. **백업 이후 데이터는 유실되므로 최후 수단.**
4. 재기동 후 `GET /api/v1/health/ready`가 200인지 확인.

## 2. 모바일 앱 롤백

- 스토어 배포 전 단계이므로 이전 APK 아티팩트(artifacts/android/)를 재배포하면 된다.
- 스토어 배포 후에는 Play Console의 단계적 출시 중단 → 이전 버전 재출시. 서버 API는 하위 호환을 유지해야 한다(응답 필드 제거 금지).

## 3. 관리자 CMS 롤백

- API와 함께 롤백. 레거시 x-admin-token 경로는 production에서 항상 차단이므로 롤백 후에도 관리자 JWT 로그인이 필요하다.

## 4. 롤백 판단 기준

즉시 롤백: 로그인 불가, 지출 저장 실패율 급증, 데이터 정합성 오류(홈≠리포트), readiness 연속 실패.
수정 후 배포(롤백 불필요): 특정 화면 UI 결함, 통계 지연.

## 5. 롤백 후 조치

- 원인 회귀 테스트 추가 전까지 재배포 금지.
- `audit_logs`·서버 로그로 영향 사용자 범위 파악, [incident-response.md](incident-response.md) 절차 수행.
