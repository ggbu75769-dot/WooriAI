# WooriAI Release Gate Evidence

Generated: 2026-07-08T21:57:59.022Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 9686ms |
| Env example | `pnpm check:env:example` | PASS | 8709ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 12775ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 9021ms |
| Lint | `pnpm lint` | PASS | 21244ms |
| Typecheck | `pnpm typecheck` | PASS | 19138ms |
| All tests | `pnpm test` | PASS | 11990ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 26769ms |
| Build dry-run | `pnpm build` | PASS | 16765ms |
| Peer dependencies | `pnpm peers check` | PASS | 7114ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
