# Release 3 Execution Log

Updated: 2026-07-15 (Asia/Seoul)

## Phase 0 — Preflight and baseline

Status: COMPLETE

### Source state

| Item | Expected | Actual |
| --- | --- | --- |
| Repository | `F:\WooriAI` | `F:\WooriAI` |
| Branch | `codex/sprint2-catalog-payments` | `codex/sprint2-catalog-payments` |
| HEAD | `7721fc152ca23e848856eff00c495d56960d4437` | `7721fc152ca23e848856eff00c495d56960d4437` |
| Verified product source | `378906b638b3b7bce902c5f03f8e28af6693dfca` | present in history; current HEAD contains later evidence commits |
| Upstream | not specified | none configured; `origin/HEAD` points to `origin/master` |
| Package manager | pnpm 11.7.0 | pnpm 11.7.0 |
| Node | 20 | 25.2.1 on the host; CI remains pinned to 20 |

### Working-tree protection

The tree was not clean at preflight. The following pre-existing, untracked user file is preserved and is not part of Release 3 changes:

- `docs/operations/product-redesign-development-completion-report-2026-07-15.md`
- SHA-256: `B5516F4C61CE00480AFA42011121FD9CD8A9A79E49D3F02C5D102EB420FD9EB0`

No reset, checkout, clean, stash, branch switch, or destructive Git operation was performed. Because the dirty state predates this work, Release 3 stays on the current branch.

### Tooling

| Tool | Result |
| --- | --- |
| Docker CLI | 29.6.1 present |
| Docker daemon | unavailable (`dockerDesktopLinuxEngine` pipe missing) |
| PostgreSQL | available on `localhost:5432` through the repository portable fallback |
| Redis | not running at baseline |
| Java | OpenJDK 17.0.19 |
| Android SDK / adb | adb 37.0.0 found at the documented SDK path |
| Android device | no connected device at baseline |

### Baseline commands

| Command | Result | Classification |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS, workspace already up to date | baseline |
| `pnpm check:env:example` | PASS, 17 required variables | baseline |
| `pnpm lint` | PASS, 8/8 Turbo tasks; currently TypeScript-only lint | baseline limitation |
| `pnpm typecheck` | PASS, 8/8 Turbo tasks | baseline |
| `pnpm test` | PASS by Turbo cache replay; not accepted as fresh execution evidence | baseline limitation |
| `pnpm --filter api test:e2e` before DB start | FAIL, PostgreSQL unavailable | environment failure |
| `pnpm db start` | PASS, portable PostgreSQL fallback | environment recovery |
| `pnpm --filter api test:e2e` after DB start | PASS, 15 files / 73 tests | fresh baseline |
| `pnpm build` | PASS, but all app build scripts are `tsc --noEmit` aliases | baseline limitation |

### Baseline findings carried into later phases

- API, Admin, and Mobile do not yet produce real production build artifacts from their `build` scripts.
- CI pushes only on `main`, while the remote default branch is `master`.
- CI has PostgreSQL but no Redis service or separated release jobs.
- the release gate is a local quality runner, not a production configuration gate, and writes Markdown only.
- package/app versions are `0.0.0`; Android package is `com.anonymous.wooriai`.
- Sprint 0–2 functionality is present and the fresh API release E2E baseline is green.

## Phase progress

| Phase | Status | Evidence |
| --- | --- | --- |
| 0 | COMPLETE | this file and the three adjacent Release 3 records |
| 1 | COMPLETE | `release3-data-map.md`, `release3-api-contract.md`, `release3-architecture-contract.md` |
| 2 | COMPLETE | real ESLint/API/Next/Expo builds, CI services/jobs, production config gate, Dockerfiles |
| 3 | COMPLETE (local) | OAuth identity migration, provider adapter, Kakao mobile PKCE/callback, replay/concurrency tests |
| 4 | COMPLETE (local) | legal/consent/privacy request state machine, ownership transfer, public information routes |
| 5 | COMPLETE (local) | outbox, publisher/worker, dedupe, DLQ, schedules; real Redis runtime remains unexecuted |
| 6 | COMPLETE (local) | presets, remote config, notifications, trust/support, link/integrity foundations |
| 7 | COMPLETE (local) | admin operations APIs/UI and account-control APIs |
| 8 | COMPLETE (local) | redaction, metrics, distributed limits, safe links, crash boundary, security workflows, Android path |
| 9 | COMPLETE | release gate, fresh installed-app Pixel proof, checksums, nine final reports, local commits |

## Phase 2 — Build, CI, and release-gate foundation

Status: COMPLETE

| Verification | Result |
| --- | --- |
| `pnpm lint` | PASS, actual ESLint scan plus script typecheck |
| `pnpm --filter api build` | PASS, `apps/api/dist/main.cjs` plus source map and Prisma deployment files |
| API artifact runtime | PASS, bundled artifact returned `{"status":"ok"}` from `/api/v1/health` |
| `pnpm --filter admin build` | PASS, optimized Next production pages and middleware |
| `pnpm --filter mobile build` | PASS, Android Hermes bundle and 52 assets exported to `apps/mobile/dist` |
| `pnpm --filter @wooriai/config test` | PASS, 2 release configuration tests |
| `pnpm release:config` | expected FAIL for current placeholder package/version/legal/signing/env state |
| `pnpm release:config:fixture` | PASS; validates gate logic only, not current release readiness |
| `pnpm contracts:generate` | PASS, 33-path manifest bound to source SHA-256 `16a2937d...20cb` |
| Docker Compose config parse | PASS; daemon execution remains externally blocked |

Changes include a Node 20 API production artifact, Next standalone container mode on Linux, Android Expo export, Redis CI service, real remote default branch trigger, fresh no-cache tests/builds, configuration JSON evidence, and release-build checksums. Placeholder values remain unchanged and are correctly blocked rather than silently replaced.

## Phase 3–8 implementation summary

- migration `000012_release3_foundation` adds the additive Release 3 identity, legal/privacy, job, preset, sync, catalog, notification, config, trust, and integrity persistence contract.
- Kakao/OAuth mobile completion is implemented behind provider adapters and production fail-closed configuration; real provider credentials were not supplied.
- privacy deletion/export and external unlink are auditable state machines with outbox/retry contracts; live object storage and external processors remain blockers.
- API builds separate `main`, `publisher`, and `worker` entrypoints. Redis-backed behavior is implemented and tested with controlled adapters; this host had no real Redis runtime.
- product/admin features include quick presets, remote config/kill switches, notification preferences/deliveries, link health, integrity, and operations surfaces.
- security hardening adds shared redaction, Redis-backed rate/MFA limits, safe-link SSRF guards, metrics, crash boundary, dependency/secret checks, and production configuration gates.

## Phase 9 final verification

| Verification | Result |
| --- | --- |
| implementation commit | `f65b9375eae21a0846ea60a50403766898de9a54` |
| `pnpm release:gate` | PASS, 11/11 |
| fresh workspace tests | PASS, 555 tests; UI package test command remains deferred/zero |
| API E2E | PASS, 15 files / 74 tests |
| production builds | PASS, 8/8 |
| production configuration | expected FAIL, 43 explicit blockers |
| Android internal APK | PASS, reproducible SHA-256 `43cc47d...1200` |
| installed adb Pixel Lock | PASS, 9/9 on Android 15 |
| signed AAB / Play / staging / beta | NOT EXECUTED; external blockers |

Final reports are `release3-development-completion-report.md` through `release3-known-limitations.md`. The release verdict is local M2 plus Android visual M3, not a public release candidate.
