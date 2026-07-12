# WooriAI Release Gate Evidence

Generated: 2026-07-12T00:49:22.957Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 436ms |
| Env example | `pnpm check:env:example` | PASS | 657ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 1572ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 1701ms |
| Lint | `pnpm lint` | PASS | 2075ms |
| Typecheck | `pnpm typecheck` | PASS | 2378ms |
| All tests | `pnpm test` | PASS | 1283ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 8568ms |
| Build dry-run | `pnpm build` | PASS | 4497ms |
| Peer dependencies | `pnpm peers check` | PASS | 658ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
