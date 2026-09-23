# WooriAI Release Gate Evidence

Generated: 2026-09-23T03:52:41.263Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 632ms |
| Mobile SDK compatibility | `pnpm --filter mobile exec expo install --check` | PASS | 2296ms |
| Env example | `pnpm check:env:example` | PASS | 850ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2437ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2067ms |
| Database up | `pnpm db start` | PASS | 6574ms |
| Lint | `pnpm lint` | PASS | 12028ms |
| Typecheck | `pnpm typecheck` | PASS | 12176ms |
| All tests | `pnpm test --concurrency=1` | PASS | 661301ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 66457ms |
| Build dry-run | `pnpm build` | PASS | 33272ms |
| Peer dependencies | `pnpm peers check` | PASS | 730ms |
| Production dependency security | `pnpm audit --prod --audit-level=high` | PASS | 981ms |

## Notes

- A failed prerequisite stops later gates; NOT RUN rows are not passing evidence.
- Database tests require a running PostgreSQL instance; this gate does not prove production deployment.
- Android device and native screenshot evidence must be verified separately against the current source.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
