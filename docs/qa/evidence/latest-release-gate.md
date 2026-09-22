# WooriAI Release Gate Evidence

Generated: 2026-09-22T13:43:11.378Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 412ms |
| Mobile SDK compatibility | `pnpm --filter mobile exec expo install --check` | PASS | 1616ms |
| Env example | `pnpm check:env:example` | PASS | 711ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 1689ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 1941ms |
| Database up | `pnpm db start` | PASS | 1158ms |
| Lint | `pnpm lint` | PASS | 24998ms |
| Typecheck | `pnpm typecheck` | PASS | 25481ms |
| All tests | `pnpm test --concurrency=1` | PASS | 786844ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 56256ms |
| Build dry-run | `pnpm build` | PASS | 15265ms |
| Peer dependencies | `pnpm peers check` | PASS | 579ms |
| Production dependency security | `pnpm audit --prod --audit-level=high` | PASS | 26128ms |

## Notes

- A failed prerequisite stops later gates; NOT RUN rows are not passing evidence.
- Database tests require a running PostgreSQL instance; this gate does not prove production deployment.
- Android device and native screenshot evidence must be verified separately against the current source.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
