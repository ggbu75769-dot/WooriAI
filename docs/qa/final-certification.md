# 출시 전 최종 인증 패스 (2026-08-20, master a400a35 + 스모크 28검사 확장)

동일 시점·동일 트리에서 모든 검증 계층을 연속 실행한 결과. 재현 방법은 각 항목의 명령 참조.

| 계층 | 명령 | 결과 |
|---|---|---|
| API 단위+e2e (실 Postgres, 마이그레이션 10) | `cd apps/api && pnpm test` | **266/266** |
| Mobile 단위+여정+계약 | `cd apps/mobile && pnpm test` | **469/469** |
| Admin | `cd apps/admin && pnpm test` | **68/68** |
| Domain / Contracts | `pnpm --filter @wooriai/{domain,contracts} test` | **28/28 · 35/35** |
| 릴리즈 게이트 (11단계) | `PGBIN=… pnpm release:gate` | **11/11 PASS** (evidence 갱신) |
| 실서버 HTTP 스모크 (핵심 루프 전체 + 워커 헬스) | `scripts/qa/server-smoke.sh` | **28/28** (실패 0) |
| 어드민 실브라우저 E2E (로그인·MFA·전 페이지) | `node scripts/qa/admin-e2e.mjs` | **7/7 PASS** |
| 백업→복구 드릴 (6테이블 정합) | `scripts/qa/backup-restore-drill.sh` | **PASS** |

**합계: 자동화 테스트 866개 + 실서버 28검사 + 브라우저 7단계 + 복구 드릴, 실패 0.**

## 리뷰 이력 (수렴 확인)

| 라운드 | 발견 | 처리 |
|---|---|---|
| 1차 (전체 21커밋) | 8건 (치명 1) | 전량 수정 |
| 2차 (배포·시드·랜딩) | 13건 (치명 1) | 전량 수정 |
| 3차 (파기·프록시·집계) | 7건 (파괴적 정합성 0) | 전량 수정 |
| 4차 (3차 수정분 재검) | 6건 (M1 잔존 리스크 포함) | 전량 수정 |

심각도·건수 모두 라운드마다 하강 — 코드 측 수렴 상태.

## 잔여 항목 (전부 외부 자산 대기)

`docs/5차/launch-readiness-status.md` 참조: Oracle VM(런북 §4 한 줄), 카카오 키(env 3종), Play 계정+keystore, 쿠팡 승인(플랜 B 가능), 법적 문서 placeholder 확정.
