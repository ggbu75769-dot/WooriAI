# Release 3 Migration Manifest

Generated: 2026-07-15 (Asia/Seoul)

## Migration chain

The additive chain was applied on an empty PostgreSQL database and seeded successfully.

1. `000001_init`
2. `000002_round4_auth_admin`
3. `000003_round4_domain`
4. `000004_round4_import_rows_reviewed`
5. `000005_round4_import_rows_validation_status_len`
6. `000006_round5_admin_mfa_sessions`
7. `000007_round5_cms_oauth_analytics`
8. `000008_affiliate_clicks_nullable_actor`
9. `000009_catalog_content`
10. `000010_user_payment_methods`
11. `000011_catalog_content_backfill`
12. `000012_release3_foundation`

Migration head: `000012_release3_foundation`.

## Release 3 additions

`000012` adds enums for consent, privacy request, link health, and notification delivery; tables for OAuth identities, legal documents, consent events, privacy requests/events, outbox/DLQ/processed jobs, presets, sync cursor state, catalog source/context tags, product link health, notification preferences/deliveries, remote config, support reports, and report-integrity checks.

The migration is additive-first. Existing legacy auth provider columns, payment methods, expense links, and existing content models remain available for compatibility. No committed migration was rewritten.

## Verification and rollback

- `prisma validate`: PASS.
- clean database apply `000001`–`000012`: PASS.
- seed: PASS.
- API E2E after migration: 74/74 PASS.
- rollback point: Git `7721fc152ca23e848856eff00c495d56960d4437`; database rollback is restore/forward-fix only, not destructive down migration.
- before production, run the backup/restore runbook and rehearse restore into an isolated database. That drill is not yet executed.
