# WooriAI Release Gate Evidence

Generated: 2026-07-20T06:41:18.192Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 72552ms |
| Env example | `pnpm check:env:example` | PASS | 1870ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 4501ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 4382ms |
| Database up | `pnpm db start` | PASS | 3385ms |
| ESLint | `pnpm lint` | PASS | 18219ms |
| Typecheck | `pnpm typecheck` | PASS | 21500ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 287456ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 144183ms |
| Production builds | `pnpm build --force` | PASS | 77851ms |
| Peer dependencies | `pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only` | PASS | 1254ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
