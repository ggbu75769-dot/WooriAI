# WooriAI Release Gate Evidence

Generated: 2026-07-15T02:11:01.820Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 836ms |
| Env example | `pnpm check:env:example` | PASS | 1372ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 3481ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 4117ms |
| Database up | `pnpm db start` | PASS | 2253ms |
| ESLint | `pnpm lint` | PASS | 7783ms |
| Typecheck | `pnpm typecheck` | PASS | 4384ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 193045ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 95343ms |
| Production builds | `pnpm build --force` | PASS | 57215ms |
| Peer dependencies | `pnpm peers check` | PASS | 1021ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
