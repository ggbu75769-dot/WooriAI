# WooriAI Release Gate Evidence

Generated: 2026-09-23T09:13:52.099Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 690ms |
| Mobile SDK compatibility | `pnpm --filter mobile exec expo install --check` | PASS | 2232ms |
| Env example | `pnpm check:env:example` | PASS | 879ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2558ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2242ms |
| Database up | `pnpm db start` | PASS | 6543ms |
| Lint | `pnpm lint` | PASS | 15223ms |
| Typecheck | `pnpm typecheck` | PASS | 16490ms |
| All tests | `pnpm test --concurrency=1` | PASS | 449190ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 48928ms |
| Build dry-run | `pnpm build` | PASS | 15285ms |
| Peer dependencies | `pnpm peers check` | PASS | 600ms |
| Production dependency security | `pnpm audit --prod --audit-level=high` | PASS | 805ms |

## Notes

- A failed prerequisite stops later gates; NOT RUN rows are not passing evidence.
- Database tests require a running PostgreSQL instance; this gate does not prove production deployment.
- Android device and native screenshot evidence must be verified separately against the current source.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
