# WooriAI Release Gate Evidence

Generated: 2026-07-14T16:29:12.644Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 539ms |
| Env example | `pnpm check:env:example` | PASS | 834ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2305ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2077ms |
| Database up | `pnpm db start` | PASS | 4991ms |
| Lint | `pnpm lint` | PASS | 8477ms |
| Typecheck | `pnpm typecheck` | PASS | 8115ms |
| All tests | `pnpm test --concurrency=1` | PASS | 102662ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 64481ms |
| Build dry-run | `pnpm build` | PASS | 8335ms |
| Peer dependencies | `pnpm peers check` | PASS | 662ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
