# WooriAI Release Gate Evidence

Generated: 2026-07-30T01:02:50.911Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 488ms |
| Mobile SDK dependencies | `pnpm mobile:deps:check` | PASS | 2848ms |
| Env example | `pnpm check:env:example` | PASS | 718ms |
| Secret scan | `pnpm security:secrets` | PASS | 1290ms |
| Production dependency audit | `pnpm security:audit` | PASS | 1208ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2513ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2507ms |
| Database up | `pnpm db start` | PASS | 1155ms |
| Isolated catalog audit | `pnpm catalog:audit` | PASS | 18378ms |
| ESLint | `pnpm lint` | PASS | 10803ms |
| Typecheck | `pnpm typecheck` | PASS | 10745ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 148339ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 133315ms |
| Admin browser E2E | `pnpm test:admin-browser` | PASS | 109396ms |
| Production builds | `pnpm build --force` | PASS | 55727ms |
| Peer dependencies | `pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only` | PASS | 503ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
