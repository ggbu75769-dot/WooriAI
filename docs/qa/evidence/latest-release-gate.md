# WooriAI Release Gate Evidence

Generated: 2026-09-23T09:56:44.070Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 501ms |
| Mobile SDK compatibility | `pnpm --filter mobile exec expo install --check` | PASS | 2214ms |
| Env example | `pnpm check:env:example` | PASS | 839ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2479ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2123ms |
| Database up | `pnpm db start` | PASS | 6529ms |
| Lint | `pnpm lint` | PASS | 12461ms |
| Typecheck | `pnpm typecheck` | PASS | 12093ms |
| All tests | `pnpm test --concurrency=1` | PASS | 401631ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 44374ms |
| Build dry-run | `pnpm build` | PASS | 12459ms |
| Peer dependencies | `pnpm peers check` | PASS | 572ms |
| Production dependency security | `pnpm audit --prod --audit-level=high` | PASS | 789ms |

## Notes

- A failed prerequisite stops later gates; NOT RUN rows are not passing evidence.
- Database tests require a running PostgreSQL instance; this gate does not prove production deployment.
- Android device and native screenshot evidence must be verified separately against the current source.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
