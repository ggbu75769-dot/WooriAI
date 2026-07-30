# WooriAI Release Gate Evidence

Generated: 2026-07-30T01:16:56.514Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 486ms |
| Mobile SDK dependencies | `pnpm mobile:deps:check` | PASS | 1755ms |
| Env example | `pnpm check:env:example` | PASS | 803ms |
| Secret scan | `pnpm security:secrets` | PASS | 1325ms |
| Production dependency audit | `pnpm security:audit` | PASS | 1168ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2361ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2330ms |
| Database up | `pnpm db start` | PASS | 1155ms |
| Isolated catalog audit | `pnpm catalog:audit` | PASS | 18709ms |
| ESLint | `pnpm lint` | PASS | 8917ms |
| Typecheck | `pnpm typecheck` | PASS | 10417ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 157843ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 133183ms |
| Admin browser E2E | `pnpm test:admin-browser` | PASS | 110955ms |
| Production builds | `pnpm build --force` | PASS | 36448ms |
| Peer dependencies | `pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only` | PASS | 440ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
