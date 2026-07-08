# WooriAI Release Gate Evidence

Generated: 2026-07-08T14:10:00.470Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 8169ms |
| Env example | `pnpm check:env:example` | PASS | 11099ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 21773ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 30544ms |
| Lint | `pnpm lint` | PASS | 43434ms |
| Typecheck | `pnpm typecheck` | PASS | 26208ms |
| All tests | `pnpm test` | PASS | 13084ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 27745ms |
| Build dry-run | `pnpm build` | PASS | 21501ms |
| Peer dependencies | `pnpm peers check` | PASS | 11469ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
