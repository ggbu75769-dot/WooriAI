# WooriAI Release Gate Evidence

Generated: 2026-07-11T18:00:47.924Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 385ms |
| Env example | `pnpm check:env:example` | PASS | 633ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 1742ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 1475ms |
| Lint | `pnpm lint` | PASS | 6457ms |
| Typecheck | `pnpm typecheck` | PASS | 8075ms |
| All tests | `pnpm test` | PASS | 17941ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 7336ms |
| Build dry-run | `pnpm build` | PASS | 8171ms |
| Peer dependencies | `pnpm peers check` | PASS | 432ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
