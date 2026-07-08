# WooriAI Release Gate Evidence

Generated: 2026-07-08T18:37:41.276Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 12409ms |
| Env example | `pnpm check:env:example` | PASS | 11444ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 8495ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 6729ms |
| Lint | `pnpm lint` | PASS | 15998ms |
| Typecheck | `pnpm typecheck` | PASS | 14599ms |
| All tests | `pnpm test` | PASS | 12827ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 25615ms |
| Build dry-run | `pnpm build` | PASS | 17432ms |
| Peer dependencies | `pnpm peers check` | PASS | 5835ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
