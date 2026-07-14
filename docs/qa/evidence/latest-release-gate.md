# WooriAI Release Gate Evidence

Generated: 2026-07-14T12:18:26.976Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 691ms |
| Env example | `pnpm check:env:example` | PASS | 1079ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2501ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 3090ms |
| Database up | `pnpm db start` | PASS | 1833ms |
| Lint | `pnpm lint` | PASS | 10982ms |
| Typecheck | `pnpm typecheck` | PASS | 10484ms |
| All tests | `pnpm test --concurrency=1` | PASS | 132561ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 60519ms |
| Build dry-run | `pnpm build` | PASS | 8010ms |
| Peer dependencies | `pnpm peers check` | PASS | 657ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
