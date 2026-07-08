# WooriAI Release Gate Evidence

Generated: 2026-07-08T04:14:01.923Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 1074ms |
| Env example | `pnpm check:env:example` | PASS | 1253ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 3243ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 3014ms |
| Lint | `pnpm lint` | PASS | 7774ms |
| Typecheck | `pnpm typecheck` | PASS | 7250ms |
| All tests | `pnpm test` | PASS | 5249ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 15839ms |
| Build dry-run | `pnpm build` | PASS | 7437ms |
| Peer dependencies | `pnpm peers check` | PASS | 747ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
