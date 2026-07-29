# WooriAI Release Gate Evidence

Generated: 2026-07-29T22:27:26.920Z
Mode: local-executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 443ms |
| Mobile SDK dependencies | `pnpm mobile:deps:check` | PASS | 2405ms |
| Env example | `pnpm check:env:example` | PASS | 854ms |
| Secret scan | `pnpm security:secrets` | PASS | 1350ms |
| Production dependency audit | `pnpm security:audit` | PASS | 1213ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2113ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2364ms |
| Database up | `pnpm db start` | PASS | 1123ms |
| Isolated catalog audit | `pnpm catalog:audit` | PASS | 16958ms |
| ESLint | `pnpm lint` | PASS | 9462ms |
| Typecheck | `pnpm typecheck` | PASS | 9569ms |
| All tests | `pnpm test --concurrency=1 --force` | PASS | 130734ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 119287ms |
| Admin browser E2E | `pnpm test:admin-browser` | PASS | 99029ms |
| Production builds | `pnpm build --force` | PASS | 52791ms |
| Peer dependencies | `pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only` | PASS | 557ms |

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
