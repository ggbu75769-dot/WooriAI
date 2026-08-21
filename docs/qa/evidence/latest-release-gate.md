# WooriAI Release Gate Evidence

Generated: 2026-08-21T08:00:33.535Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 607ms |
| Env example | `pnpm check:env:example` | PASS | 990ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 1946ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2125ms |
| Database up | `pnpm db start` | PASS | 1006ms |
| Lint | `pnpm lint` | PASS | 10376ms |
| Typecheck | `pnpm typecheck` | PASS | 10250ms |
| All tests | `pnpm test --concurrency=1` | PASS | 118621ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 44591ms |
| Build dry-run | `pnpm build` | PASS | 10675ms |
| Peer dependencies | `pnpm peers check` | PASS | 702ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
