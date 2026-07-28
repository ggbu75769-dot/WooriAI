# WooriAI Release Gate Evidence

Generated: 2026-07-28T17:06:27.231Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 588ms |
| Mobile SDK dependencies | `pnpm mobile:deps:check` | PASS | 2423ms |
| Env example | `pnpm check:env:example` | PASS | 854ms |
| Secret scan | `pnpm security:secrets` | PASS | 1238ms |
| Production dependency audit | `pnpm security:audit` | PASS | 1680ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 1760ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2659ms |
| Database up | `pnpm db start` | PASS | 1856ms |
| Isolated catalog audit | `pnpm catalog:audit` | PASS | 38610ms |
| ESLint | `pnpm lint` | PASS | 19094ms |
| Typecheck | `pnpm typecheck` | PASS | 6073ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 169048ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 218646ms |
| Admin browser E2E | `pnpm test:admin-browser` | PASS | 229172ms |
| Production builds | `pnpm build --force` | PASS | 55477ms |
| Peer dependencies | `pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only` | PASS | 583ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
