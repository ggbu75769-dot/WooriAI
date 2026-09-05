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

현재 개발 DB를 초기화하지 않는 자동 드릴을 먼저 실행한다.

```powershell
pnpm db:restore-drill
```

이 명령은 임시 source DB에 현재 migration과 seed를 적용하고, 메모리상의 dump를 별도 임시 target DB에 복원한다. 93개 테이블의 catalog fingerprint와 전체 행수 fingerprint를 비교한 뒤 두 임시 DB를 모두 제거하며 raw backup은 남기지 않는다. 결과는 `artifacts/db-restore-drill/latest.json`에 기록한다.

운영 또는 승인된 staging에서는 별도로 다음 절차를 수행한다.

1. 테스트 계정·지출·준비 상태 생성 (API 또는 앱에서)
2. `pnpm db backup` → 암호화된 외부 보관 위치와 hash 기록
3. 운영 DB가 아닌 격리 복원 DB 생성
4. `pnpm db restore <파일>`을 격리 복원 DB 설정으로 실행
5. API 재시작 후 홈/리포트 합계와 privacy/outbox 상태가 백업 시점과 동일한지 확인

현재 개발 DB를 직접 `reset`하여 복원 드릴을 수행하지 않는다. 로컬 stale 데이터나 개인 작업을 파괴할 수 있다.

## 운영 권장 사항

- 운영 DB는 관리형 서비스의 자동 스냅샷(일 1회 이상) + 위 pg_dump를 배포 직전 수동 실행.
- 백업 파일에는 개인정보가 포함되므로 저장소에 커밋 금지(`artifacts/`는 .gitignore 대상), 암호화된 저장소에 보관, 보존 기한(예: 30일) 후 파기.
- 복구 리허설을 월 1회 스테이징에서 수행.
