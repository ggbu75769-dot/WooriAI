# WooriAI Release Gate Evidence

Generated: 2026-08-14T09:28:53.810Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 502ms |
| Env example | `pnpm check:env:example` | PASS | 768ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 1475ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 1604ms |
| Database up | `pnpm db start` | PASS | 845ms |
| Lint | `pnpm lint` | PASS | 2075ms |
| Typecheck | `pnpm typecheck` | PASS | 2087ms |
| All tests | `pnpm test --concurrency=1` | PASS | 74341ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 35022ms |
| Build dry-run | `pnpm build` | PASS | 2072ms |
| Peer dependencies | `pnpm peers check` | PASS | 619ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
