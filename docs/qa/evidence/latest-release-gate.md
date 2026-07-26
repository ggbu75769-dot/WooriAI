# WooriAI Release Gate Evidence

Generated: 2026-07-26T10:53:52.257Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 459ms |
| Mobile SDK dependencies | `pnpm mobile:deps:check` | PASS | 2061ms |
| Env example | `pnpm check:env:example` | PASS | 859ms |
| Secret scan | `pnpm security:secrets` | PASS | 1337ms |
| Production dependency audit | `pnpm security:audit` | PASS | 1359ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2070ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2338ms |
| Database up | `pnpm db start` | PASS | 2116ms |
| ESLint | `pnpm lint` | PASS | 14011ms |
| Typecheck | `pnpm typecheck` | PASS | 4908ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 142796ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 140629ms |
| Admin browser E2E | `pnpm test:admin-browser` | PASS | 197174ms |
| Production builds | `pnpm build --force` | PASS | 47996ms |
| Peer dependencies | `pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only` | PASS | 688ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
