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
