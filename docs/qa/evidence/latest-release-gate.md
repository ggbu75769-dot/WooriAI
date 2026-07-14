# WooriAI Release Gate Evidence

Generated: 2026-07-14T11:52:58.825Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 407ms |
| Env example | `pnpm check:env:example` | PASS | 675ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2154ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 1804ms |
| Database up | `pnpm db start` | PASS | 1136ms |
| Lint | `pnpm lint` | PASS | 7961ms |
| Typecheck | `pnpm typecheck` | PASS | 6409ms |
| All tests | `pnpm test --concurrency=1` | PASS | 6456ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 65729ms |
| Build dry-run | `pnpm build` | PASS | 7264ms |
| Peer dependencies | `pnpm peers check` | PASS | 535ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
