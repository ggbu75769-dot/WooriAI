# WooriAI Release Gate Evidence

Generated: 2026-07-08T17:13:09.024Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 9188ms |
| Env example | `pnpm check:env:example` | PASS | 7287ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 8595ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 9925ms |
| Lint | `pnpm lint` | PASS | 20893ms |
| Typecheck | `pnpm typecheck` | PASS | 17445ms |
| All tests | `pnpm test` | PASS | 12918ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 23145ms |
| Build dry-run | `pnpm build` | PASS | 15815ms |
| Peer dependencies | `pnpm peers check` | PASS | 6869ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
