# WooriAI Release Gate Evidence

Generated: 2026-08-21T12:08:38.464Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 851ms |
| Env example | `pnpm check:env:example` | PASS | 1134ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2325ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2471ms |
| Database up | `pnpm db start` | PASS | 1178ms |
| Lint | `pnpm lint` | PASS | 19275ms |
| Typecheck | `pnpm typecheck` | PASS | 18249ms |
| All tests | `pnpm test --concurrency=1` | PASS | 947ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 56737ms |
| Build dry-run | `pnpm build` | PASS | 18989ms |
| Peer dependencies | `pnpm peers check` | PASS | 872ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
