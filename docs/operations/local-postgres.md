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

`apps/api/prisma/seed.ts` — **없는 행을 만들 뿐, 있는 행의 콘텐츠는 고치지 않는다**(재실행 안전):

- 정식 카테고리 12종(+ 모바일 별칭 8 · 가져오기 스텁 1 = 21행), 준비템 템플릿·단계 매핑,
  상품 링크(**비제휴 실 쿠팡 검색 링크** 67건), 고지 3종
- ⚠️ **두 시점(라운드 107 트랙 E)**: 이 절은 종전에 *"모두 upsert 기반(재실행 안전)"* 이라고
  적었다. `upsert`인 것은 그때 참이었지만 그 `update` 갈래가 곧 위험이었다 — 재시드가 어드민
  편집분을 시드 값으로 되돌렸고, 상품 링크는 자연키가 `(준비템, 플랫폼, 제목)`이라 제목을 고치면
  **행이 하나 더 생겼다**. 오늘은 있는 행을 건너뛰고, 상품 링크는 안정 키
  `product_links.seed_key`(마이그레이션 000026)로 자기 행을 찾는다(`apps/api/prisma/seed.ts:33`,
  회귀 고정 `apps/api/test/seed-boundary.db.test.ts`).
  로컬 dev/test DB를 **시드 값으로 맞추고 싶을 때만** `SEED_OVERWRITE_CONTENT=1 pnpm db seed`
  (배포 경로는 이 값을 설정하지 않는다).
- ⚠️ **두 시점**: 상품 링크는 종전에 `https://example.com/dev/...` 플레이스홀더였고 이 줄은 그것을
  *"dev 샘플"* 이라 불렀다(그때는 참). 출시 트랙 LP-A가 전부 실 쿠팡 검색 링크로 교체해 오늘
  example.com은 **0곳**이다(`grep -c 'https://example.com' apps/api/prisma/seed-data.ts` → 0).
  제휴 딥링크(`affiliateUrl`)는 여전히 0건이다.
- 관리자 계정: `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` 환경변수 사용. 미설정 시 development 한정 `admin@wooriai.local` / `wooriai-dev-admin` (production에서는 env 없으면 생략)

## 운영 DB 전환

운영에서는 `DATABASE_URL`만 운영 인스턴스 값으로 교체하면 된다. 백업·복구는
[database-backup-restore.md](database-backup-restore.md) 참조.
⚠️ **끊긴 링크 정정**: 이 줄은 절차 문서로 `production-cutover.md`를 가리켰으나 **그 파일은 오늘
저장소에 없다**(2026-09-07 확인). 오늘 실제로 배포 절차를 지고 있는 문서는
`docs/5차/day1-deploy-runbook.md`(경로 A: Fly · 경로 B: 셀프호스트)와
`docs/5차/oracle-free-deploy-runbook.md`(Oracle Always Free 원샷)이다.
⚠️ **그리고 `DATABASE_URL`을 운영 값으로 export한 셸에서는 `pnpm db reset`·`restore`를 부르지 않는다**
— 모든 `pnpm db` 명령이 그 변수를 대상으로 따르고, 로컬 dev가 아니면 `--confirm=<DB이름>`을 요구한다
(`scripts/db.ts:119~181`).
