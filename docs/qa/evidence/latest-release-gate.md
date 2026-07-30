# WooriAI Release Gate Evidence

Generated: 2026-07-30T00:07:58.298Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 442ms |
| Mobile SDK dependencies | `pnpm mobile:deps:check` | PASS | 2284ms |
| Env example | `pnpm check:env:example` | PASS | 730ms |
| Secret scan | `pnpm security:secrets` | PASS | 1436ms |
| Production dependency audit | `pnpm security:audit` | PASS | 1216ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 1932ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2248ms |
| Database up | `pnpm db start` | PASS | 1359ms |
| Isolated catalog audit | `pnpm catalog:audit` | PASS | 19018ms |
| ESLint | `pnpm lint` | PASS | 8439ms |
| Typecheck | `pnpm typecheck` | PASS | 9601ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 135958ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 125630ms |
| Admin browser E2E | `pnpm test:admin-browser` | PASS | 102982ms |
| Production builds | `pnpm build --force` | PASS | 36956ms |
| Peer dependencies | `pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only` | PASS | 437ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
