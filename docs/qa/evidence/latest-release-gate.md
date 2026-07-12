# WooriAI Release Gate Evidence

Generated: 2026-07-12T03:26:36.439Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 1200ms |
| Env example | `pnpm check:env:example` | PASS | 837ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2469ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 1881ms |
| Lint | `pnpm lint` | PASS | 9795ms |
| Typecheck | `pnpm typecheck` | PASS | 9952ms |
| All tests | `pnpm test --concurrency=1` | PASS | 6746ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 9659ms |
| Build dry-run | `pnpm build` | PASS | 7725ms |
| Peer dependencies | `pnpm peers check` | PASS | 478ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
