# 데이터베이스 백업·복구

`scripts/db.ts`가 docker/포터블 PostgreSQL을 자동 감지해 pg_dump/psql을 실행한다.

## 백업

```powershell
pnpm db backup
# → artifacts/db-backups/wooriai-<timestamp>.sql (pg_dump --clean --if-exists)
```

## 복구

```powershell
pnpm db restore artifacts/db-backups/wooriai-<timestamp>.sql
```

`--clean --if-exists` 덤프이므로 복구 시 기존 객체를 drop 후 재생성한다(백업 시점 상태로 완전 대체).

## 검증 절차 (릴리즈 전 필수)

1. 테스트 계정·지출·준비 상태 생성 (API 또는 앱에서)
2. `pnpm db backup` → 파일 경로 기록
3. `pnpm db reset` (데이터 초기화)
4. `pnpm db restore <파일>`
5. API 재시작 후 홈/리포트 합계가 백업 시점과 동일한지 확인

실행 결과 증거는 `docs/qa/round4-test-evidence.md`에 기록한다.

## 운영 권장 사항

- 운영 DB는 관리형 서비스의 자동 스냅샷(일 1회 이상) + 위 pg_dump를 배포 직전 수동 실행.
- 백업 파일에는 개인정보가 포함되므로 저장소에 커밋 금지(`artifacts/`는 .gitignore 대상), 암호화된 저장소에 보관, 보존 기한(예: 30일) 후 파기.
- 복구 리허설을 월 1회 스테이징에서 수행.

## 보존 기간과의 관계 (숫자 정합 — 2026-08-28, GAP-058 #10)

DB 안의 데이터에는 **네 개의 서로 다른 보존 창**이 있고, 전부 워커 잡
`data_retention_purge`(`apps/api/src/worker/jobs/data-retention-purge.job.ts`)가 집행한다.
복구·백업 정책을 정할 때 이 숫자들과 어긋나지 않게 한다.

| 대상 | 기본값 | 환경 변수 | 성격 |
|---|---|---|---|
| 삭제 처리된 지출·아이 프로필·탈퇴 계정 (1~4단계) | **30일** | `PURGE_RETENTION_DAYS` | 삭제 후 유예. 개인정보처리방침의 "30일이 경과하면 지체 없이 완전 파기" 문구와 같은 숫자 — 바꾸면 문서도 함께 바꾼다 |
| 분석 이벤트 (6단계) | **400일**(≈13개월) | `ANALYTICS_EVENTS_RETENTION_DAYS` | 전년 동기 비교용 |
| 제휴 클릭 (7단계) | **400일** | `AFFILIATE_CLICKS_RETENTION_DAYS` | 정산 클레임 대응용 |
| 감사 로그 (8단계) | **730일**(2년) | `AUDIT_LOGS_RETENTION_DAYS` | 책임 추적 기록이라 가장 길다. ⚠️ **짧게 조정하는 것은 PM/법무 확인 대상** |

**백업 보존 기한이 위 숫자보다 길면 파기가 무의미해진다.** 파기는 운영 DB에서만 일어나므로,
30일 지나 파기된 지출도 그보다 오래된 백업 파일 안에는 그대로 남아 있다. 위의 "보존 기한(예:
30일) 후 파기"는 그래서 권장이 아니라 **정합 조건**이다 — 백업을 더 오래 보관해야 한다면
(예: 분기 스냅샷) 그 사실을 개인정보처리방침의 파기 항목에 명시하거나, 복구 시 파기 대상이
되살아나지 않도록 복구 직후 워커를 한 틱 돌려 재파기하는 절차를 함께 둔다(잡은 멱등하며,
파기 대상이 없으면 아무 일도 하지 않는다).
