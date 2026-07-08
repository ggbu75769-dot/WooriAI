# WooriAI Release Gate Evidence

Generated: 2026-07-08T06:00:43.441Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 6940ms |
| Env example | `pnpm check:env:example` | PASS | 5747ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 8528ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 8588ms |
| Lint | `pnpm lint` | PASS | 14572ms |
| Typecheck | `pnpm typecheck` | PASS | 13997ms |
| All tests | `pnpm test` | PASS | 11275ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 17959ms |
| Build dry-run | `pnpm build` | PASS | 14811ms |
| Peer dependencies | `pnpm peers check` | PASS | 6164ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
