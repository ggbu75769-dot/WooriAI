# WooriAI Release Gate Evidence

Generated: 2026-07-29T16:22:44.436Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 776ms |
| Mobile SDK dependencies | `pnpm mobile:deps:check` | PASS | 3034ms |
| Env example | `pnpm check:env:example` | PASS | 883ms |
| Secret scan | `pnpm security:secrets` | PASS | 2120ms |
| Production dependency audit | `pnpm security:audit` | PASS | 1504ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2560ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2980ms |
| Database up | `pnpm db start` | PASS | 9775ms |
| Isolated catalog audit | `pnpm catalog:audit` | PASS | 28234ms |
| ESLint | `pnpm lint` | PASS | 18058ms |
| Typecheck | `pnpm typecheck` | PASS | 22306ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 139229ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 117324ms |
| Admin browser E2E | `pnpm test:admin-browser` | PASS | 113161ms |
| Production builds | `pnpm build --force` | PASS | 45211ms |
| Peer dependencies | `pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only` | PASS | 478ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
