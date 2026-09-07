# 데이터베이스 마이그레이션

Prisma Migrate 사용. 스키마: `apps/api/prisma/schema.prisma`, 마이그레이션: `apps/api/prisma/migrations/`.

## 현재 마이그레이션

**단일 소스는 `apps/api/prisma/migrations/` 디렉터리 자신이다** — 이 문서는 목록도 개수도
손으로 옮겨 적지 않는다. 오늘(2026-09-07) 그 디렉터리는 `000001_init` ~ `000025_categories_seed_partial_index`이고,
그 수를 세어야 하면 디렉터리를 세면 된다(`ls apps/api/prisma/migrations | grep -c '^0'`).

⚠️ **두 시점**: 이 절은 종전에 `000001`·`000002` 두 줄만 표로 적고 나머지를 "(이후)"로 뭉갰다.
그 표가 태어난 시점(라운드 4)에는 마이그레이션이 그 둘 언저리였으므로 **그때는 사실상 전수였다**.
오늘은 25개이고, 그중 스물셋이 "(이후)" 한 칸에 접혀 있었다. 표를 늘려 봐야 다음 라운드에 다시
낡으므로 표를 되살리는 대신 **가리키는 방향을 바꾼다** — 아래 두 줄만 남긴다.

| 무엇을 알고 싶은가 | 어디를 보는가 |
|---|---|
| 전체 목록·개수 | `apps/api/prisma/migrations/` 디렉터리 (단일 소스) |
| 각 마이그레이션이 무엇을 하는가·왜 그렇게 했는가 | 그 폴더의 `migration.sql` 머리말 주석 (`000018`·`000024`가 좋은 예) |
| 되돌릴 수 있는가 | [rollback.md](rollback.md) **§1.1** — `000007`·`000008`·`000010`·`000018`·`000024`는 롤백 안전지대가 없다 |
| 새로 만들기 | `pnpm --filter api exec prisma migrate dev --name <이름>` |

배포에서 **개수를 세는 절차는 없다.** 네 경로가 전부 `prisma migrate deploy`(= 미적용분 전부)다 —
`fly.toml`의 `release_command` · `infra/docker/docker-compose.prod.yml`의 `migrate` 서비스 ·
`.github/workflows/ci.yml` · 로컬 게이트가 쓰는 `apps/api/test/global-setup.ts`. 확인은 개수가
아니라 `prisma migrate status`의 답으로 한다.

## 명령

```powershell
# 적용 (빈 DB 포함, 운영/CI에서 사용)
pnpm db migrate            # = pnpm --filter api prisma:deploy

# 개발 중 새 마이그레이션 생성 (스키마 수정 후)
pnpm --filter api prisma:migrate    # prisma migrate dev

# 스키마 검증 / 클라이언트 생성
pnpm --filter api prisma:validate
pnpm --filter api prisma:generate

# 개발 DB 전체 리셋 (모든 데이터 삭제 후 재적용 + seed)
pnpm db reset
```

## 규칙

1. 적용된 마이그레이션 SQL은 절대 수정하지 않는다. 변경은 항상 새 마이그레이션으로.
2. 마이그레이션은 빈 DB에 처음부터 순서대로 적용 가능해야 한다 (`pnpm db reset`으로 검증).
3. 운영 적용 전 스테이징/백업 필수 — [database-backup-restore.md](database-backup-restore.md).
4. 파괴적 변경(컬럼 삭제·타입 변경)은 2단계(확장→수축)로 나눈다.
4-1. **새 마이그레이션의 머리말에 롤백 성질을 한 줄 적는다**(라운드 106 F5가 세운 관례).
   `000024_categories_household_owner`가 이미 그렇게 하고 있다 — 코드만 되돌릴 때와 컬럼을
   드롭할 때가 각각 어떻게 위험한지를 SQL 파일이 스스로 적는다. 이 한 줄이 있으면
   [rollback.md](rollback.md) §1.1의 표가 다시 낡지 않는다(표는 사본, 원본은 SQL 파일).
5. CI(.github/workflows/ci.yml)가 PR마다 `migrate deploy` + `seed` + 전체 테스트를 실 PostgreSQL 서비스 컨테이너로 실행한다.

## 기존 개발 데이터

라운드 3까지의 데이터는 인메모리였으므로 마이그레이션 대상이 없다. 라운드 4부터의 개발 데이터는 `pnpm db backup`으로 보존 후 `pnpm db reset`으로 초기화한다.
