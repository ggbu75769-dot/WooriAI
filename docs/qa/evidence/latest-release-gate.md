# WooriAI Release Gate Evidence

Generated: 2026-08-20T15:50:40.923Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 643ms |
| Env example | `pnpm check:env:example` | PASS | 915ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 1930ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 1973ms |
| Database up | `pnpm db start` | PASS | 975ms |
| Lint | `pnpm lint` | PASS | 11078ms |
| Typecheck | `pnpm typecheck` | PASS | 10636ms |
| All tests | `pnpm test --concurrency=1` | PASS | 106805ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 45438ms |
| Build dry-run | `pnpm build` | PASS | 10683ms |
| Peer dependencies | `pnpm peers check` | PASS | 651ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
