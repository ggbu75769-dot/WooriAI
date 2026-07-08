# WooriAI Release Gate Evidence

Generated: 2026-07-08T08:52:48.460Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 3778ms |
| Env example | `pnpm check:env:example` | PASS | 4025ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 6233ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 5952ms |
| Lint | `pnpm lint` | PASS | 9884ms |
| Typecheck | `pnpm typecheck` | PASS | 12510ms |
| All tests | `pnpm test` | PASS | 7832ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 15638ms |
| Build dry-run | `pnpm build` | PASS | 14067ms |
| Peer dependencies | `pnpm peers check` | PASS | 3490ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
