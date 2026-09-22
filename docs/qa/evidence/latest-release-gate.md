# WooriAI Release Gate Evidence

Generated: 2026-09-22T23:34:09.264Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 513ms |
| Mobile SDK compatibility | `pnpm --filter mobile exec expo install --check` | PASS | 2663ms |
| Env example | `pnpm check:env:example` | PASS | 1300ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2922ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2681ms |
| Database up | `pnpm db start` | PASS | 1797ms |
| Lint | `pnpm lint` | PASS | 5572ms |
| Typecheck | `pnpm typecheck` | PASS | 4986ms |
| All tests | `pnpm test --concurrency=1` | PASS | 360303ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 54137ms |
| Build dry-run | `pnpm build` | PASS | 5694ms |
| Peer dependencies | `pnpm peers check` | PASS | 550ms |
| Production dependency security | `pnpm audit --prod --audit-level=high` | PASS | 828ms |

## Notes

- A failed prerequisite stops later gates; NOT RUN rows are not passing evidence.
- Database tests require a running PostgreSQL instance; this gate does not prove production deployment.
- Android device and native screenshot evidence must be verified separately against the current source.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
