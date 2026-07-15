# Release 3 Known Limitations

Generated: 2026-07-15 (Asia/Seoul)

## Release blockers

- package `com.anonymous.wooriai` and version `0.0.0` remain intentional placeholders and fail the production gate.
- there is no externally signed AAB, Play internal-track install, real Kakao credential, approved legal content, staging deployment, or seven-day closed beta.
- production backup restore, rollback, S0/S1 incident, and alert-delivery drills were not executed.

## Runtime and product gaps

- Redis publisher/worker integration was not run because Docker/Redis were unavailable; local fake/unit and PostgreSQL state-machine tests are green.
- `import.parse` remains a terminal/unconnected queue handler rather than a fully live Redis import processor.
- real S3 export object creation/expiry deletion, OAuth unlink, and notification delivery providers are adapters/contracts only.
- deletion handles shared-household anonymization, but a production-grade sole-household full purge and processor reconciliation remain unproven.
- public privacy routes are informational/static flows; production web reauthentication and end-to-end account deletion are not proven.
- Admin exposes operations controls, but a complete admin-account management UI and scheduled-content retry/cancel UI are not present; the account APIs and core scheduled worker controls exist.
- payment methods retain the compatible user-scoped Sprint 2 model rather than a completed household-account redesign.
- `SyncCursorState` exists but the full mobile per-scope cursor/full-resync lifecycle is not wired end to end.
- normalized catalog source/context models exist but are not fully populated from an approved production content pipeline.
- safe-link validation has residual DNS rebinding risk without IP-pinned transport/egress proxy.

## Test and tooling gaps

- `@wooriai/ui` still reports tests deferred to Batch 05; its package test command runs zero tests.
- dependency audit has 8 moderate advisories; high and critical thresholds pass.
- local container build/Trivy scan was not executed because the Docker daemon was unavailable; CI configuration exists.
- Node 25.2.1 was used on the host while CI/runtime contracts stay pinned to Node 20.
- iOS has only structural follow-up notes; Apple credentials, native build, TestFlight, login, push, and deletion verification are incomplete.

These limitations prevent M4–M6 and public-release claims. They do not invalidate the recorded local M2 automation or installed-Android M3 visual proof.
