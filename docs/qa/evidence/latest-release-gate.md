# WooriAI Release Gate Evidence

Generated: 2026-07-29T17:01:34.537Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 453ms |
| Mobile SDK dependencies | `pnpm mobile:deps:check` | PASS | 2346ms |
| Env example | `pnpm check:env:example` | PASS | 666ms |
| Secret scan | `pnpm security:secrets` | PASS | 1571ms |
| Production dependency audit | `pnpm security:audit` | PASS | 1203ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 1903ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 1783ms |
| Database up | `pnpm db start` | PASS | 1172ms |
| Isolated catalog audit | `pnpm catalog:audit` | PASS | 17340ms |
| ESLint | `pnpm lint` | PASS | 10033ms |
| Typecheck | `pnpm typecheck` | PASS | 10405ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 110722ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 108141ms |
| Admin browser E2E | `pnpm test:admin-browser` | PASS | 103406ms |
| Production builds | `pnpm build --force` | PASS | 34693ms |
| Peer dependencies | `pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only` | PASS | 473ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
