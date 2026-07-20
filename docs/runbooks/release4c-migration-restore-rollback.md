# Release 4C migration, restore and rollback runbook

## Preconditions

1. Confirm branch/HEAD and capture `git status --porcelain=v2`.
2. Confirm Node 20.20.2 and pinned pnpm 10.28.1.
3. Back up the target database and record SHA-256, migration head and representative totals.
4. Pause publisher/workers for catalog or privacy jobs when consistency requires it.
5. Do not edit an existing migration or run destructive Git cleanup.

## Fresh and upgrade validation

Use an isolated database URL. Run Prisma validate/generate, apply all migrations through 31, seed only the allowed non-production fixture profile, then run catalog and report integrity checks. For upgrade, restore the previous-release snapshot first and apply only forward migrations.

Required checks: users/households/memberships, expenses and gift/refund/support ledger totals, item-plan states and versions, catalog revisions/approvals, published safety state, outbox/privacy pending jobs and migration count.

## Backup and restore

1. Create a PostgreSQL custom/plain backup with credentials excluded from logs.
2. Hash the backup.
3. Apply representative mutations to the source database.
4. Restore into a new empty database, never over the source.
5. Compare the required checks above and application reads against the recorded pre-mutation values.
6. Keep the source and restored database identifiers in evidence so they cannot be confused.

Release 4C local reference backup: `artifacts/db-backups/release4c-local-staging-31-migrations.sql`, SHA-256 `5B25EDE91379ABB849A361821F76B34C1EADD92316A2144455E93ACE9412BEA6`.

## Rollback strategy

Do not rely on down migrations. Prefer:

1. Disable the affected feature flag/internal preview.
2. Pause publisher/worker consumers.
3. Route traffic to the N-1 compatible application only if the forward schema remains compatible.
4. Apply a forward-fix migration for data/schema defects.
5. Reprocess idempotent outbox/DLQ jobs after validation.
6. For content errors, suspend/recall or create a rollback-as-new-revision; never erase approval history.

## Stop conditions

Stop rollout on ledger divergence, lost approvals/revisions, unsafe published content, permission regression, non-idempotent privacy jobs, migration mismatch or inability to restore representative values. Production execution requires separate approval and external staging evidence.
