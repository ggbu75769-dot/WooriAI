# WooriAI Release Gate Evidence

Generated: 2026-07-08T21:21:36.362Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 9933ms |
| Env example | `pnpm check:env:example` | PASS | 9844ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 12024ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 7777ms |
| Lint | `pnpm lint` | PASS | 13383ms |
| Typecheck | `pnpm typecheck` | PASS | 13876ms |
| All tests | `pnpm test` | PASS | 11295ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 21363ms |
| Build dry-run | `pnpm build` | PASS | 14377ms |
| Peer dependencies | `pnpm peers check` | PASS | 4357ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
