# WooriAI Release Gate Evidence

Generated: 2026-07-29T17:56:29.852Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 415ms |
| Mobile SDK dependencies | `pnpm mobile:deps:check` | PASS | 2028ms |
| Env example | `pnpm check:env:example` | PASS | 684ms |
| Secret scan | `pnpm security:secrets` | PASS | 1235ms |
| Production dependency audit | `pnpm security:audit` | PASS | 1121ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 1868ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 1791ms |
| Database up | `pnpm db start` | PASS | 1161ms |
| Isolated catalog audit | `pnpm catalog:audit` | PASS | 17778ms |
| ESLint | `pnpm lint` | PASS | 8355ms |
| Typecheck | `pnpm typecheck` | PASS | 3702ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 106555ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 104614ms |
| Admin browser E2E | `pnpm test:admin-browser` | PASS | 101248ms |
| Production builds | `pnpm build --force` | PASS | 26391ms |
| Peer dependencies | `pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only` | PASS | 490ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
