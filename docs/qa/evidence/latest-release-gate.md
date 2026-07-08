# WooriAI Release Gate Evidence

Generated: 2026-07-08T04:58:10.759Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 5504ms |
| Env example | `pnpm check:env:example` | PASS | 6264ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 7091ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 10253ms |
| Lint | `pnpm lint` | PASS | 12761ms |
| Typecheck | `pnpm typecheck` | PASS | 19109ms |
| All tests | `pnpm test` | PASS | 8571ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 21203ms |
| Build dry-run | `pnpm build` | PASS | 10265ms |
| Peer dependencies | `pnpm peers check` | PASS | 4952ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
