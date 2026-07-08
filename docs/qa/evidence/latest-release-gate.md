# WooriAI Release Gate Evidence

Generated: 2026-07-08T12:44:46.508Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 5528ms |
| Env example | `pnpm check:env:example` | PASS | 6905ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 8380ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 9088ms |
| Lint | `pnpm lint` | PASS | 15526ms |
| Typecheck | `pnpm typecheck` | PASS | 15138ms |
| All tests | `pnpm test` | PASS | 13898ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 21664ms |
| Build dry-run | `pnpm build` | PASS | 15625ms |
| Peer dependencies | `pnpm peers check` | PASS | 5714ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
