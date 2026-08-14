# WooriAI Release Gate Evidence

Generated: 2026-08-12T06:47:02.679Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 639ms |
| Mobile SDK dependencies | `pnpm mobile:deps:check` | PASS | 3370ms |
| Env example | `pnpm check:env:example` | PASS | 1260ms |
| Secret scan | `pnpm security:secrets` | PASS | 5889ms |
| Production dependency audit | `pnpm security:audit` | PASS | 1674ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2204ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 1980ms |
| Database up | `pnpm db start` | PASS | 10919ms |
| Isolated catalog audit | `pnpm catalog:audit` | PASS | 28377ms |
| ESLint | `pnpm lint` | PASS | 20381ms |
| Typecheck | `pnpm typecheck` | PASS | 16839ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 231212ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 208657ms |
| Admin browser E2E | `pnpm test:admin-browser` | PASS | 218143ms |
| Production builds | `pnpm build --force` | PASS | 121775ms |
| Peer dependencies | `pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only` | PASS | 560ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
