# WooriAI Release Gate Evidence

Generated: 2026-07-08T20:46:39.182Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 12108ms |
| Env example | `pnpm check:env:example` | PASS | 7866ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 9579ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 7680ms |
| Lint | `pnpm lint` | PASS | 14171ms |
| Typecheck | `pnpm typecheck` | PASS | 15021ms |
| All tests | `pnpm test` | PASS | 11614ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 24250ms |
| Build dry-run | `pnpm build` | PASS | 11341ms |
| Peer dependencies | `pnpm peers check` | PASS | 4094ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
