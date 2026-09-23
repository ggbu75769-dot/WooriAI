# WooriAI Release Gate Evidence

Generated: 2026-09-23T04:59:13.652Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 610ms |
| Mobile SDK compatibility | `pnpm --filter mobile exec expo install --check` | PASS | 2307ms |
| Env example | `pnpm check:env:example` | PASS | 1024ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2743ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2707ms |
| Database up | `pnpm db start` | PASS | 1695ms |
| Lint | `pnpm lint` | PASS | 26113ms |
| Typecheck | `pnpm typecheck` | PASS | 25854ms |
| All tests | `pnpm test --concurrency=1` | PASS | 754814ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 63065ms |
| Build dry-run | `pnpm build` | PASS | 18048ms |
| Peer dependencies | `pnpm peers check` | PASS | 895ms |
| Production dependency security | `pnpm audit --prod --audit-level=high` | PASS | 1022ms |

## Notes

- A failed prerequisite stops later gates; NOT RUN rows are not passing evidence.
- Database tests require a running PostgreSQL instance; this gate does not prove production deployment.
- Android device and native screenshot evidence must be verified separately against the current source.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
