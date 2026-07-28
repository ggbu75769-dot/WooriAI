# WooriAI Release Gate Evidence

Generated: 2026-07-26T15:56:15.742Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 480ms |
| Mobile SDK dependencies | `pnpm mobile:deps:check` | PASS | 3142ms |
| Env example | `pnpm check:env:example` | PASS | 1113ms |
| Secret scan | `pnpm security:secrets` | PASS | 1524ms |
| Production dependency audit | `pnpm security:audit` | PASS | 1518ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 3627ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 3502ms |
| Database up | `pnpm db start` | PASS | 2127ms |
| Isolated catalog audit | `pnpm catalog:audit` | PASS | 35936ms |
| ESLint | `pnpm lint` | PASS | 11408ms |
| Typecheck | `pnpm typecheck` | PASS | 4995ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 147174ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 145694ms |
| Admin browser E2E | `pnpm test:admin-browser` | PASS | 215017ms |
| Production builds | `pnpm build --force` | PASS | 42542ms |
| Peer dependencies | `pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only` | PASS | 543ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
