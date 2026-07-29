# WooriAI Release Gate Evidence

Generated: 2026-07-29T17:29:29.090Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 496ms |
| Mobile SDK dependencies | `pnpm mobile:deps:check` | PASS | 1938ms |
| Env example | `pnpm check:env:example` | PASS | 669ms |
| Secret scan | `pnpm security:secrets` | PASS | 1085ms |
| Production dependency audit | `pnpm security:audit` | PASS | 1133ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 1603ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2165ms |
| Database up | `pnpm db start` | PASS | 1032ms |
| Isolated catalog audit | `pnpm catalog:audit` | PASS | 19978ms |
| ESLint | `pnpm lint` | PASS | 10141ms |
| Typecheck | `pnpm typecheck` | PASS | 4724ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 111977ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 109066ms |
| Admin browser E2E | `pnpm test:admin-browser` | PASS | 104295ms |
| Production builds | `pnpm build --force` | PASS | 30257ms |
| Peer dependencies | `pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only` | PASS | 517ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
