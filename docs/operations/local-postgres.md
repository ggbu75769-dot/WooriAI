# 로컬 PostgreSQL 운영

라운드 4 기준. API의 모든 도메인 데이터는 PostgreSQL(Prisma)에 영속화된다.

## 접속 정보 (로컬 개발 공통)

| 항목 | 값 |
|---|---|
| 호스트/포트 | `localhost:5432` |
| DB | `wooriai_dev` |
| 계정 | `wooriai` / `wooriai_dev_password` |
| DATABASE_URL | `postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev` |

## 시작 방법

```powershell
pnpm db start      # postgres 시작 (docker 우선, 불가 시 포터블 fallback)
pnpm db migrate    # prisma migrate deploy
pnpm db seed       # 카테고리·준비템·상품링크·고지·관리자 계정 시드 (멱등)
pnpm db status     # 접속 상태 확인
pnpm db stop       # 중지
```

### 경로 1: Docker Compose (권장)

`infra/docker/docker-compose.yml`의 `postgres` 서비스(postgres:15-alpine, named volume `wooriai_postgres_data`, healthcheck 포함).

```powershell
docker compose -f infra/docker/docker-compose.yml up -d postgres
```

### 경로 2: 포터블 PostgreSQL (Docker를 쓸 수 없는 환경)

Docker 데몬에 접속할 수 없으면 `pnpm db start`가 자동으로 포터블 PostgreSQL 16을 사용한다.

- 바이너리: `.toolcache/pg16/pgsql/bin` (또는 `PGBIN` 환경변수로 지정)
- 데이터 디렉토리: `.toolcache/pgdata` (없으면 initdb 자동 실행)
- 로그: `.toolcache/pglog.txt`
- EDB 배포 zip: https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64-binaries.zip 을 `.toolcache/pg16`에 풀면 된다.

두 경로 모두 동일 계정/포트를 쓰므로 애플리케이션 설정은 동일하다.

## 시드 데이터

`apps/api/prisma/seed.ts` — 모두 upsert 기반(재실행 안전):

- 카테고리 12종, 준비템 템플릿·단계 매핑, 상품 링크(비제휴 dev 샘플), 고지 3종
- 관리자 계정: `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` 환경변수 사용. 미설정 시 development 한정 `admin@wooriai.local` / `wooriai-dev-admin` (production에서는 env 없으면 생략)

## 운영 DB 전환

운영에서는 `DATABASE_URL`만 운영 인스턴스 값으로 교체하면 된다. 절차는 [production-cutover.md](production-cutover.md), 백업·복구는 [database-backup-restore.md](database-backup-restore.md) 참조.
