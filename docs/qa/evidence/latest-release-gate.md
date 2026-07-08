# WooriAI Release Gate Evidence

Generated: 2026-07-08T20:24:10.433Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 10705ms |
| Env example | `pnpm check:env:example` | PASS | 8788ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 11160ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 13215ms |
| Lint | `pnpm lint` | PASS | 26809ms |
| Typecheck | `pnpm typecheck` | PASS | 17256ms |
| All tests | `pnpm test` | PASS | 14011ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 22702ms |
| Build dry-run | `pnpm build` | PASS | 12655ms |
| Peer dependencies | `pnpm peers check` | PASS | 4955ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
