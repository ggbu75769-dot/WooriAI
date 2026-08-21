# WooriAI Release Gate Evidence

Generated: 2026-08-21T01:47:57.890Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 1141ms |
| Env example | `pnpm check:env:example` | PASS | 1102ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 7281ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 3902ms |
| Database up | `pnpm db start` | PASS | 1075ms |
| Lint | `pnpm lint` | PASS | 11685ms |
| Typecheck | `pnpm typecheck` | PASS | 8313ms |
| All tests | `pnpm test --concurrency=1` | PASS | 8224ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 44024ms |
| Build dry-run | `pnpm build` | PASS | 7881ms |
| Peer dependencies | `pnpm peers check` | PASS | 654ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
