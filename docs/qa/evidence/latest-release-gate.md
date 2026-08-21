# WooriAI Release Gate Evidence

Generated: 2026-08-21T11:16:12.290Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 737ms |
| Env example | `pnpm check:env:example` | PASS | 1113ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2367ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2538ms |
| Database up | `pnpm db start` | PASS | 1304ms |
| Lint | `pnpm lint` | PASS | 14992ms |
| Typecheck | `pnpm typecheck` | PASS | 14129ms |
| All tests | `pnpm test --concurrency=1` | PASS | 935ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 54752ms |
| Build dry-run | `pnpm build` | PASS | 13866ms |
| Peer dependencies | `pnpm peers check` | PASS | 822ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
