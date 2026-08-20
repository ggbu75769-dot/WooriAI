# WooriAI Release Gate Evidence

Generated: 2026-08-20T18:49:23.132Z
Mode: executed

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | PASS | 2806ms |
| Env example | `pnpm check:env:example` | PASS | 1031ms |
| Prisma validate | `pnpm --filter api prisma:validate` | PASS | 2046ms |
| Prisma generate | `pnpm --filter api prisma:generate` | PASS | 3522ms |
| Database up | `pnpm db start` | PASS | 1012ms |
| Lint | `pnpm lint` | PASS | 20426ms |
| Typecheck | `pnpm typecheck` | PASS | 16491ms |
| All tests | `pnpm test --concurrency=1` | PASS | 122067ms |
| API e2e | `pnpm --filter api test:e2e` | PASS | 44409ms |
| Build dry-run | `pnpm build` | PASS | 15154ms |
| Peer dependencies | `pnpm peers check` | PASS | 663ms |

## Notes

- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.
- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.
- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.
- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items.
