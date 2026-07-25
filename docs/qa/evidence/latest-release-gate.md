# WooriAI Release Gate Evidence

Generated: 2026-07-25T11:51:45.906Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 446ms |
| Mobile SDK dependencies | `pnpm mobile:deps:check` | PASS | 1894ms |
| Env example | `pnpm check:env:example` | PASS | 701ms |
| Secret scan | `pnpm security:secrets` | PASS | 1269ms |
| Production dependency audit | `pnpm security:audit` | PASS | 1217ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2014ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2549ms |
| Database up | `pnpm db start` | PASS | 1384ms |
| ESLint | `pnpm lint` | PASS | 17147ms |
| Typecheck | `pnpm typecheck` | PASS | 10676ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 178107ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 243091ms |
| Admin browser E2E | `pnpm test:admin-browser` | PASS | 239053ms |
| Production builds | `pnpm build --force` | PASS | 49517ms |
| Peer dependencies | `pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only` | PASS | 562ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
