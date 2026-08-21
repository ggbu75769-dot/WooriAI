# WooriAI Release Gate Evidence

Generated: 2026-08-21T07:43:06.691Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 7439ms |
| Env example | `pnpm check:env:example` | PASS | 975ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 1968ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 2107ms |
| Database up | `pnpm db start` | PASS | 996ms |
| Lint | `pnpm lint` | PASS | 15862ms |
| Typecheck | `pnpm typecheck` | PASS | 16300ms |
| All tests | `pnpm test --concurrency=1` | PASS | 707ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 46525ms |
| Build dry-run | `pnpm build` | PASS | 16079ms |
| Peer dependencies | `pnpm peers check` | PASS | 663ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
