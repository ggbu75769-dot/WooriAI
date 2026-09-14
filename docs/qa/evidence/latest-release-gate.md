# WooriAI Release Gate Evidence

Generated: 2026-09-14T01:22:55.418Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 442ms |
| Env example | `pnpm check:env:example` | PASS | 795ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 1736ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 1906ms |
| Database up | `pnpm db start` | PASS | 1327ms |
| Lint | `pnpm lint` | PASS | 11130ms |
| Typecheck | `pnpm typecheck` | PASS | 13293ms |
| All tests | `pnpm test --concurrency=1` | PASS | 525881ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 50476ms |
| Build dry-run | `pnpm build` | PASS | 21151ms |
| Peer dependencies | `pnpm peers check` | PASS | 596ms |

## Notes

- A failed prerequisite stops later gates; NOT RUN rows are not passing evidence.
- Database tests require a running PostgreSQL instance; this gate does not prove production deployment.
- Android device and native screenshot evidence must be verified separately against the current source.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
