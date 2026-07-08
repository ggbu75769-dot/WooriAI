# WooriAI Release Gate Evidence

Generated: 2026-07-08T21:35:18.724Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 8251ms |
| Env example | `pnpm check:env:example` | PASS | 9685ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 11990ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 9750ms |
| Lint | `pnpm lint` | PASS | 16466ms |
| Typecheck | `pnpm typecheck` | PASS | 15625ms |
| All tests | `pnpm test` | PASS | 16881ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 21091ms |
| Build dry-run | `pnpm build` | PASS | 15406ms |
| Peer dependencies | `pnpm peers check` | PASS | 4418ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
