# Release 3 Operations Runbook

Generated: 2026-07-15 (Asia/Seoul)

## Local verification

```text
pnpm db start
pnpm release:gate
pnpm release:config
pnpm pixel:android:build-apk
pnpm pixel:android -- --force
```

`release:config` must fail until all approved production values are injected. Never bypass it with the fixture mode; fixture mode only tests the validator.

## Deployment order after external approval

1. snapshot/backup the database and record artifact/source checksums.
2. apply additive migrations through `000012_release3_foundation`.
3. deploy API and verify liveness/readiness.
4. deploy publisher and worker with Redis/object-storage/provider access.
5. deploy Admin and public legal/privacy pages.
6. run staging OAuth, privacy, outbox/DLQ, notification, metrics/alert, and core-loop smoke tests.
7. build externally signed AAB, upload to Play internal track, install that track artifact, then repeat Android smoke/visual checks.

## Required health signals

- API request count/duration/5xx and auth success/failure.
- refresh reuse, sync success/conflict/failure.
- outbox pending/age, DLQ count, privacy failure/age.
- scheduled publish failures, link health, notification state.
- report integrity mismatch and mobile crash/error codes.

Production `/internal/metrics` requires `INTERNAL_METRICS_TOKEN` and must not be exposed publicly. Logs may include request/job/trace IDs and stable error codes, but not user payloads.

## Incident and rollback

- stop new publisher/worker intake for queue corruption or processor incidents; preserve DLQ and audit rows.
- disable optional features with remote-config kill switches; the mobile client uses last-known-good/fail-safe behavior.
- prefer forward-fix for additive schema issues. Restore into an isolated database before any production restore.
- roll application artifacts back to the recorded prior SHA only when schema compatibility is confirmed.
- rollback code point for this release is `7721fc152ca23e848856eff00c495d56960d4437`.

## Detailed procedures

- backup/restore: `docs/operations/release3-backup-restore-runbook.md`
- Android: `docs/operations/release3-android-release-runbook.md`
- observability: `docs/operations/release3-observability-runbook.md`
- data safety: `docs/operations/release3-data-safety-inventory.md`
- iOS follow-up: `docs/operations/release3-ios-followup.md`

No production backup restore, rollback, or incident drill has been executed in this work.
