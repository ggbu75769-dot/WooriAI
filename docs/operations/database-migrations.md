# 데이터베이스 마이그레이션

Prisma Migrate 사용. 스키마: `apps/api/prisma/schema.prisma`, 마이그레이션: `apps/api/prisma/migrations/`.

## 현재 마이그레이션

| 폴더 | 내용 |
|---|---|
| `000001_init` | 초기 19개 테이블 + enum + CHECK 제약 + 리포트 뷰 |
| `000002_round4_auth_admin` | `refresh_tokens`, `admin_users`(+`admin_role` enum), `idempotency_keys`, `disclosures` |
| (이후) | `pnpm --filter api exec prisma migrate dev --name <이름>` 으로 생성 |

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
5. CI(.github/workflows/ci.yml)가 PR마다 `migrate deploy` + `seed` + 전체 테스트를 실 PostgreSQL 서비스 컨테이너로 실행한다.

## 기존 개발 데이터

라운드 3까지의 데이터는 인메모리였으므로 마이그레이션 대상이 없다. 라운드 4부터의 개발 데이터는 `pnpm db backup`으로 보존 후 `pnpm db reset`으로 초기화한다.
