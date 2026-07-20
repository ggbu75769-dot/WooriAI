# Release 4 provenance preflight

Generated: 2026-07-17T11:32:35.361Z
Branch: codex/sprint2-catalog-payments
HEAD: db7a7a455afec892b8fa1205e477dbe507a5931d
Upstream: NONE

## Protected pre-existing working tree

The following dirty/untracked paths existed before this provenance evidence was generated. The generator itself and this output file are excluded.

```text
M apps/admin/app/operations/page.tsx
 M apps/admin/app/page.tsx
 M apps/admin/src/admin-cms-pages.test.ts
 M apps/admin/src/admin-cms.test.ts
 M apps/admin/src/components/AdminShell.tsx
 M apps/admin/src/lib/admin-api.ts
 M apps/api/package.json
 M apps/api/prisma/schema.prisma
 M apps/api/prisma/seed.ts
 M apps/api/scripts/catalog.ts
 M apps/api/src/admin/admin-auth.guard.ts
 M apps/api/src/admin/admin-auth.service.ts
 M apps/api/src/admin/admin-jobs.controller.ts
 M apps/api/src/admin/admin-operations.controller.ts
 M apps/api/src/admin/admin-token.guard.ts
 M apps/api/src/admin/admin.module.ts
 M apps/api/src/admin/dto/admin-operations.dto.ts
 M apps/api/src/app-config/app-config.controller.ts
 M apps/api/src/app-config/app-config.service.ts
 M apps/api/src/app.module.ts
 M apps/api/src/auth/auth.module.ts
 M apps/api/src/common/filters/global-exception.filter.ts
 M apps/api/src/common/idempotency/idempotency.interceptor.ts
 M apps/api/src/finance/dto/expense.dto.ts
 M apps/api/src/finance/expense-snapshot.ts
 M apps/api/src/finance/finance.module.ts
 M apps/api/src/finance/home.controller.ts
 M apps/api/src/jobs/job-handlers.service.ts
 M apps/api/src/jobs/jobs.module.ts
 M apps/api/src/jobs/outbox-publisher.service.ts
 M apps/api/src/legal/legal.service.ts
 M apps/api/src/main.ts
 M apps/api/src/onboarding/dto/upsert-consents.dto.ts
 M apps/api/src/onboarding/onboarding-store.service.ts
 M apps/api/src/publisher.ts
 M apps/api/src/sync/sync.controller.ts
 M apps/api/src/sync/sync.service.ts
 M apps/api/src/trust/dto/trust.dto.ts
 M apps/api/src/trust/trust.service.ts
 M apps/api/src/worker.ts
 M apps/api/test/admin-mfa-session.e2e.test.ts
 M apps/api/test/admin-token.guard.test.ts
 M apps/api/test/onboarding.e2e.test.ts
 M apps/api/test/release3-app-config.e2e.test.ts
 M apps/api/test/release3-jobs.db.test.ts
 M apps/api/test/release3-phase4.e2e.test.ts
 M apps/api/vitest.config.ts
 M apps/mobile/app/(auth)/login.tsx
 M apps/mobile/app/(onboarding)/budget.tsx
 M apps/mobile/app/(onboarding)/child-profile.tsx
 M apps/mobile/app/(onboarding)/child-status.tsx
 M apps/mobile/app/(onboarding)/prepared-items.tsx
 M apps/mobile/app/(onboarding)/resume.tsx
 M apps/mobile/app/(tabs)/_layout.tsx
 M apps/mobile/app/(tabs)/index.tsx
 M apps/mobile/app/(tabs)/items.tsx
 M apps/mobile/app/(tabs)/more.tsx
 M apps/mobile/app/(tabs)/records.tsx
 M apps/mobile/app/(tabs)/reports.tsx
 M apps/mobile/app/_layout.tsx
 M apps/mobile/app/budget.tsx
 M apps/mobile/app/children/[childId].tsx
 M apps/mobile/app/children/index.tsx
 M apps/mobile/app/children/new.tsx
 M apps/mobile/app/expenses/[expenseId].tsx
 M apps/mobile/app/expenses/new.tsx
 M apps/mobile/app/family/accept/[token].tsx
 M apps/mobile/app/family/index.tsx
 M apps/mobile/app/family/invite.tsx
 M apps/mobile/app/import/[importJobId].tsx
 M apps/mobile/app/import/index.tsx
 M apps/mobile/app/index.tsx
 M apps/mobile/app/items/[itemTemplateId].tsx
 M apps/mobile/app/launch-animation.tsx
 M apps/mobile/app/notifications.tsx
 M apps/mobile/app/payment-methods.tsx
 M apps/mobile/app/profile.tsx
 M apps/mobile/app/settings/index.tsx
 M apps/mobile/app/settings/privacy.tsx
 M apps/mobile/app/sync-status.tsx
 M apps/mobile/metro.config.js
 M apps/mobile/package.json
 M apps/mobile/plugins/with-network-security-config.js
 M apps/mobile/src/android-native-ui-quality.test.ts
 M apps/mobile/src/android-standalone-apk.test.ts
 M apps/mobile/src/api/client.ts
 M apps/mobile/src/api/local-backend.ts
 M apps/mobile/src/api/local-fixtures.ts
 M apps/mobile/src/auth/complete-oauth-login.ts
 M apps/mobile/src/categories.ts
 M apps/mobile/src/child-profile-manual-stage-and-date-guard.test.ts
 M apps/mobile/src/config/app-config.test.ts
 M apps/mobile/src/config/app-config.ts
 M apps/mobile/src/local-backend.test.ts
 M apps/mobile/src/offline/backoff.test.ts
 M apps/mobile/src/offline/backoff.ts
 M apps/mobile/src/offline/errors.ts
 M apps/mobile/src/offline/expense-list-reconciliation.test.ts
 M apps/mobile/src/offline/memory-offline-store.ts
 M apps/mobile/src/offline/outbox-merge.test.ts
 M apps/mobile/src/offline/remote-api.ts
 M apps/mobile/src/offline/sqlite-offline-store.ts
 M apps/mobile/src/offline/sync-controller.ts
 M apps/mobile/src/offline/sync-engine.test.ts
 M apps/mobile/src/offline/sync-engine.ts
 M apps/mobile/src/offline/types.ts
 M apps/mobile/src/onboarding-resume.test.ts
 M apps/mobile/src/onboarding/resume.ts
 M apps/mobile/src/real-session-data-integrity.test.ts
 M apps/mobile/src/stores/persist-upgrade.test.ts
 M apps/mobile/src/stores/session.store.ts
 M apps/mobile/src/test-login-flow.test.ts
 M apps/mobile/src/theme.ts
 M apps/mobile/src/ui-pixel-lock-flow.test.ts
 M apps/mobile/src/ui.tsx
 M docs/audit/feature-traceability-matrix.md
 M docs/qa/evidence/latest-release-gate.json
 M docs/qa/evidence/latest-release-gate.md
 M docs/qa/evidence/release3-production-config-fixture.json
 M docs/qa/evidence/release3-production-config-fixture.md
 M docs/qa/evidence/release3-production-config-gate.json
 M docs/qa/evidence/release3-production-config-gate.md
 M infra/docker/admin.Dockerfile
 M infra/docker/api.Dockerfile
 M infra/docker/docker-compose.yml
 M infra/docker/publisher.Dockerfile
 M infra/docker/worker.Dockerfile
 M package.json
 M packages/config/src/release.test.ts
 M packages/config/src/release.ts
 M packages/contracts/src/index.ts
 M packages/contracts/src/release3.ts
 M packages/domain/src/enums.test.ts
 M packages/domain/src/enums.ts
 M packages/domain/src/index.ts
 M packages/test-utils/src/release-gate-runner.test.ts
 M packages/test-utils/src/release-readiness.test.ts
 M pnpm-lock.yaml
 M pnpm-workspace.yaml
 M scripts/build-android-aab.ts
 M scripts/build-android-apk.ts
 M scripts/build-api.ts
 M scripts/db.ts
 M scripts/pixel-lock/android-pixel-lock.ts
 M scripts/pixel-lock/build-pixel-apk.ts
 M scripts/release-gate.ts
?? .dockerignore
?? apps/admin/app/catalog/page.tsx
?? apps/admin/src/admin-home-render.test.tsx
?? apps/api/prisma/migrations/000013_catalog_taxonomy/migration.sql
?? apps/api/prisma/migrations/000014_item_definition_v2/migration.sql
?? apps/api/prisma/migrations/000015_item_plan_status_v2/migration.sql
?? apps/api/prisma/migrations/000016_expense_taxonomy_v2/migration.sql
?? apps/api/prisma/migrations/000017_report_aggregate_v2/migration.sql
?? apps/api/prisma/migrations/000018_catalog_search_alias/migration.sql
?? apps/api/prisma/migrations/000019_item_plan_missing_states/migration.sql
?? apps/api/prisma/migrations/000020_item_plan_state_backfill/migration.sql
?? apps/api/prisma/migrations/000021_item_plan_context_integrity/migration.sql
?? apps/api/prisma/migrations/000022_catalog_editor_separation/migration.sql
?? apps/api/prisma/migrations/000023_release4c_catalog_workflow/migration.sql
?? apps/api/prisma/migrations/000024_release4c_coverage_applicability/migration.sql
?? apps/api/prisma/migrations/000025_release4c_item_inventory_collaboration/migration.sql
?? apps/api/prisma/migrations/000026_release4c_expense_payer/migration.sql
?? apps/api/prisma/migrations/000027_release4c_payer_legacy_compat/migration.sql
?? apps/api/prisma/migrations/000028_catalog_feedback_loop/migration.sql
?? apps/api/prisma/migrations/000029_catalog_safety_alerts/migration.sql
?? apps/api/prisma/migrations/000030_product_offer_approval_comparison/migration.sql
?? apps/api/prisma/migrations/000031_release4c_preparation_context/migration.sql
?? apps/api/prisma/migrations/000032_notification_navigation_scope/migration.sql
?? apps/api/prisma/migrations/000033_release4i_operational_resilience/migration.sql
?? apps/api/prisma/migrations/000034_release5_legal_catalog_readiness/migration.sql
?? apps/api/prisma/migrations/000035_release5_daily_use/migration.sql
?? apps/api/prisma/migrations/000036_release5_assisted_input/migration.sql
?? apps/api/prisma/migrations/000037_release5_external_readiness/migration.sql
?? apps/api/prisma/migrations/000038_release5_recall_alert_events/migration.sql
?? apps/api/scripts/release4c-evidence.ts
?? apps/api/src/auth/providers/mock-kakao-oauth-provider.adapter.test.ts
?? apps/api/src/auth/providers/mock-kakao-oauth-provider.adapter.ts
?? apps/api/src/catalog-v2/admin-catalog-v2.controller.ts
?? apps/api/src/catalog-v2/catalog-import-file-parser.test.ts
?? apps/api/src/catalog-v2/catalog-import-file-parser.ts
?? apps/api/src/catalog-v2/catalog-import-storage.service.ts
?? apps/api/src/catalog-v2/catalog-import-workflow.service.ts
?? apps/api/src/catalog-v2/catalog-v2.controller.ts
?? apps/api/src/catalog-v2/catalog-v2.module.ts
?? apps/api/src/catalog-v2/catalog-v2.service.ts
?? apps/api/src/catalog-v2/dto/catalog-v2.dto.ts
?? apps/api/src/common/idempotency/idempotency-request.ts
?? apps/api/src/common/operations/notification-ack-failpoint.ts
?? apps/api/src/common/operations/service-heartbeat.service.ts
?? apps/api/src/common/operations/worker-crash-failpoint.ts
?? apps/api/src/common/storage/object-storage.module.ts
?? apps/api/src/finance/dto/reports-v2.dto.ts
?? apps/api/src/finance/reports-v2.controller.ts
?? apps/api/src/finance/reports-v2.service.ts
?? apps/api/src/finance/reports-v2.sources.test.ts
?? apps/api/src/jobs/notification-delivery.service.ts
?? apps/api/src/legal/legal-document-policy.test.ts
?? apps/api/src/legal/legal-document-policy.ts
?? apps/api/src/notifications/dto/notifications.dto.ts
?? apps/api/src/notifications/notification-provider.adapter.ts
?? apps/api/src/notifications/notifications.controller.ts
?? apps/api/src/notifications/notifications.module.ts
?? apps/api/src/notifications/notifications.service.ts
?? apps/api/src/release5/dto/release5-assisted.dto.ts
?? apps/api/src/release5/dto/release5-daily.dto.ts
?? apps/api/src/release5/dto/release5-external.dto.ts
?? apps/api/src/release5/dto/release5-readiness.dto.ts
?? apps/api/src/release5/release5-admin.controller.ts
?? apps/api/src/release5/release5-assisted.service.ts
?? apps/api/src/release5/release5-daily.service.ts
?? apps/api/src/release5/release5-external.service.ts
?? apps/api/src/release5/release5-provider.controller.ts
?? apps/api/src/release5/release5-readiness.service.ts
?? apps/api/src/release5/release5-user.controller.ts
?? apps/api/src/release5/release5.module.ts
?? apps/api/src/sync/dto/legacy-reconcile.dto.ts
?? apps/api/src/sync/legacy-reconcile.test.ts
?? apps/api/test/admin-browser/admin-auth.browser.test.ts
?? apps/api/test/admin-browser/admin-browser-harness.ts
?? apps/api/test/admin-browser/admin-catalog.browser.test.ts
?? apps/api/test/admin-browser/admin-operations.browser.test.ts
?? apps/api/test/catalog-v2-admin.e2e.test.ts
?? apps/api/test/catalog-v2.e2e.test.ts
?? apps/api/test/fixtures/release4i-local-staging-import.csv
?? apps/api/test/legacy-offline-reconcile.e2e.test.ts
?? apps/api/test/notifications.e2e.test.ts
?? apps/api/test/release4-catalog.test.ts
?? apps/api/test/release4i-import-object-consistency.db.test.ts
?? apps/api/test/release4i-worker-failpoint.test.ts
?? apps/api/test/release5a-connected-golden.e2e.test.ts
?? apps/api/test/release5c-readiness.db.test.ts
?? apps/api/test/release5d-daily.e2e.test.ts
?? apps/api/test/release5e-assisted.e2e.test.ts
?? apps/api/test/release5f-external-readiness.db.test.ts
?? apps/api/test/reports-v2.e2e.test.ts
?? apps/api/vitest.browser.config.ts
?? apps/mobile/app/custom-bundles.tsx
?? apps/mobile/app/notification-preferences.tsx
?? apps/mobile/app/preparation-calendar.tsx
?? apps/mobile/app/receipts/new.tsx
?? apps/mobile/app/reports/sources.tsx
?? apps/mobile/app/weekly-briefing.tsx
?? apps/mobile/e2e/release4c-route-scenarios.json
?? apps/mobile/src/api/fixture-runtime.production.ts
?? apps/mobile/src/api/fixture-runtime.ts
?? apps/mobile/src/api/prepared-item-ids.ts
?? apps/mobile/src/design-system/components/NoticeCard.tsx
?? apps/mobile/src/design-system/components/PageHeader.tsx
?? apps/mobile/src/design-system/components/ResponsiveGrid.tsx
?? apps/mobile/src/design-system/components/ScreenScaffold.tsx
?? apps/mobile/src/design-system/components/SectionCard.tsx
?? apps/mobile/src/design-system/components/StatusChip.tsx
?? apps/mobile/src/design-system/index.ts
?? apps/mobile/src/design-system/patterns/AsyncState.tsx
?? apps/mobile/src/design-system/release4-design-system.test.ts
?? apps/mobile/src/design-system/tokens/breakpoint.ts
?? apps/mobile/src/design-system/tokens/color.ts
?? apps/mobile/src/design-system/tokens/elevation.ts
?? apps/mobile/src/design-system/tokens/icon.ts
?? apps/mobile/src/design-system/tokens/motion.ts
?? apps/mobile/src/design-system/tokens/radius.ts
?? apps/mobile/src/design-system/tokens/spacing.ts
?? apps/mobile/src/design-system/tokens/typography.ts
?? apps/mobile/src/legal/consent.test.ts
?? apps/mobile/src/legal/consent.ts
?? apps/mobile/src/native-profile-boundary.test.ts
?? apps/mobile/src/navigation/pending-intent.test.ts
?? apps/mobile/src/navigation/pending-intent.ts
?? apps/mobile/src/notifications/route.test.ts
?? apps/mobile/src/notifications/route.ts
?? apps/mobile/src/offline/expense-payload.test.ts
?? apps/mobile/src/offline/expense-payload.ts
?? apps/mobile/src/offline/expense-sync-request.ts
?? apps/mobile/src/offline/legacy-reconciliation.test.ts
?? apps/mobile/src/offline/legacy-reconciliation.ts
?? apps/mobile/src/offline/offline-volume.test.ts
?? apps/mobile/src/offline/session-scope.test.ts
?? apps/mobile/src/offline/session-scope.ts
?? apps/mobile/src/offline/sqlite-upgrade.test.ts
?? apps/mobile/src/offline/sqlite-upgrade.ts
?? apps/mobile/src/offline/sync-display-state.test.ts
?? apps/mobile/src/offline/sync-display-state.ts
?? apps/mobile/src/preparation/PreparationOverview.tsx
?? apps/mobile/src/preparation/Release4ItemDetailScreen.tsx
?? apps/mobile/src/preparation/Release4PreparationScreen.tsx
?? apps/mobile/src/preparation/item-plan-form.test.ts
?? apps/mobile/src/preparation/item-plan-form.ts
?? apps/mobile/src/preparation/release4-preparation.test.ts
?? apps/mobile/src/production-build-boundary.test.ts
?? apps/mobile/src/query/mutation-invalidation.test.ts
?? apps/mobile/src/query/mutation-invalidation.ts
?? apps/mobile/src/release4d-ux-contract.test.ts
?? apps/mobile/src/release4g-route-registry.test.ts
?? apps/mobile/src/release4h-route-state-closure.test.ts
?? apps/mobile/src/reports/period-aggregation.test.ts
?? apps/mobile/src/reports/period-aggregation.ts
?? apps/mobile/src/reports/request-plan.test.ts
?? apps/mobile/src/reports/request-plan.ts
?? apps/mobile/src/reports/source-navigation.test.ts
?? apps/mobile/src/reports/source-navigation.ts
?? apps/mobile/src/screen-scaffold-render.test.tsx
?? apps/mobile/src/shared-controls-render.test.tsx
?? apps/mobile/src/stores/catalog-search.store.ts
?? apps/mobile/src/stores/session-cache-boundary.test.ts
?? apps/mobile/src/stores/session-cache-boundary.ts
?? docs/5차/release4-admin-editorial-import-design-2026-07-16.md
?? docs/5차/release4-admin-operations-queue-design-2026-07-16.md
?? docs/5차/release4-admin-taxonomy-operations-design-2026-07-16.md
?? docs/5차/release4-android-evidence.md
?? docs/5차/release4-catalog-coverage-report.md
?? docs/5차/release4-catalog-coverage.md
?? docs/5차/release4-data-model-and-migration.md
?? docs/5차/release4-design-system-migration.md
?? docs/5차/release4-enhancement-baseline.md
?? docs/5차/release4-external-actions.md
?? docs/5차/release4-feature-enhancement-completion-report.md
?? docs/5차/release4-gap-backlog.md
?? docs/5차/release4-implementation-audit.md
?? docs/5차/release4-known-limitations.md
?? docs/5차/release4-migration-manifest.md
?? docs/5차/release4-next-improvement-design-2026-07-16.md
?? docs/5차/release4-report-v2-validation.md
?? docs/5차/release4-test-evidence.md
?? docs/5차/release4c-admin-operations.md
?? docs/5차/release4c-baseline-revalidation.md
?? docs/5차/release4c-catalog-review-worklist.md
?? docs/5차/release4c-coverage-applicability.md
?? docs/5차/release4c-development-completion-report.md
?? docs/5차/release4c-independent-implementation-audit.md
?? docs/5차/release4c-known-limitations.md
?? docs/5차/release4c-local-staging-evidence.md
?? docs/5차/release4c-p0-p1-fix-report.md
?? docs/5차/release4c-product-evaluation.md
?? docs/5차/release4c-product-feature-completion.md
?? docs/5차/release4c-route-accessibility-matrix.md
?? docs/5차/release4c-test-evidence.md
?? docs/5차/release4e-functional-verification.md
?? docs/operations/product-redesign-development-completion-report-2026-07-15.md
?? docs/qa/evidence/release4-apk-inspection.md
?? docs/qa/evidence/release4-catalog-audit.json
?? docs/qa/evidence/release4-catalog-baseline.json
?? docs/qa/evidence/release4-catalog-performance.json
?? docs/qa/evidence/release4-database-verification.json
?? docs/qa/evidence/release4-enhancement-manifest.json
?? docs/qa/evidence/release4-enhancement-preexisting-working-tree.txt
?? docs/qa/evidence/release4-production-contamination.json
?? docs/qa/evidence/release4-production-export-contamination.json
?? docs/qa/evidence/release4-provenance-preflight.md
?? docs/qa/evidence/release4-report-v2-evidence.md
?? docs/qa/evidence/release4-responsive-accessibility.md
?? docs/qa/evidence/release4-ui-route-inventory.json
?? docs/qa/evidence/release4c-catalog-review-inventory.json
?? docs/qa/evidence/release4c-coverage-matrix.json
?? docs/qa/evidence/release4c-findings.json
?? docs/qa/evidence/release4c-instruction-chain.md
?? docs/qa/evidence/release4c-manifest.json
?? docs/qa/evidence/release4c-persona-evals.json
?? docs/qa/evidence/release4c-provenance-preflight.md
?? docs/qa/evidence/release4c-start-diff-stat.txt
?? docs/qa/evidence/release4c-start-status.txt
?? docs/qa/evidence/release4e-aim-traceability.json
?? docs/qa/evidence/release4e-findings.json
?? docs/qa/evidence/release4e-manifest.json
?? docs/qa/evidence/release4e-provenance-preflight.md
?? docs/qa/evidence/release4e-security-audit.json
?? docs/qa/evidence/release4e-test-evidence.json
?? docs/qa/evidence/release4f-admin-browser-evidence.json
?? docs/qa/evidence/release4f-aim-traceability.json
?? docs/qa/evidence/release4f-build-provenance.json
?? docs/qa/evidence/release4f-dependency-risk.json
?? docs/qa/evidence/release4f-file-ownership.json
?? docs/qa/evidence/release4f-findings.json
?? docs/qa/evidence/release4f-manifest.json
?? docs/qa/evidence/release4f-offline-state-machine.json
?? docs/qa/evidence/release4f-report-traceability.json
?? docs/qa/evidence/release4f-sqlite-upgrade-evidence.json
?? docs/qa/evidence/release4f-test-evidence.json
?? docs/qa/evidence/release4g-admin-browser-evidence.json
?? docs/qa/evidence/release4g-aim-traceability.json
?? docs/qa/evidence/release4g-build-provenance.json
?? docs/qa/evidence/release4g-file-ownership.json
?? docs/qa/evidence/release4g-findings.json
?? docs/qa/evidence/release4g-golden-missions.json
?? docs/qa/evidence/release4g-manifest.json
?? docs/qa/evidence/release4g-mobile-state-matrix.json
?? docs/qa/evidence/release4g-offline-recovery.json
?? docs/qa/evidence/release4g-report-consistency.json
?? docs/qa/evidence/release4g-test-evidence.json
?? docs/qa/evidence/release4h-admin-browser-evidence.json
?? docs/qa/evidence/release4h-aim-traceability.json
?? docs/qa/evidence/release4h-build-provenance.json
?? docs/qa/evidence/release4h-collaboration-events.json
?? docs/qa/evidence/release4h-dependency-delta.json
?? docs/qa/evidence/release4h-file-ownership.json
?? docs/qa/evidence/release4h-findings.json
?? docs/qa/evidence/release4h-local-staging-faults.json
?? docs/qa/evidence/release4h-manifest.json
?? docs/qa/evidence/release4h-native-artifact-audit.json
?? docs/qa/evidence/release4h-navigation-restore.json
?? docs/qa/evidence/release4h-notification-pipeline.json
?? docs/qa/evidence/release4h-query-budget.json
?? docs/qa/evidence/release4h-route-contract-closure.json
?? docs/qa/evidence/release4h-scheduler-evidence.json
?? docs/qa/evidence/release4h-test-evidence.json
?? docs/qa/evidence/release4i-admin-browser-evidence.json
?? docs/qa/evidence/release4i-aim-traceability.json
?? docs/qa/evidence/release4i-build-provenance.json
?? docs/qa/evidence/release4i-file-ownership.json
?? docs/qa/evidence/release4i-findings.json
?? docs/qa/evidence/release4i-import-object-consistency.json
?? docs/qa/evidence/release4i-local-rc-mission.json
?? docs/qa/evidence/release4i-local-staging-faults.json
?? docs/qa/evidence/release4i-manifest.json
?? docs/qa/evidence/release4i-native-artifact-audit.json
?? docs/qa/evidence/release4i-operations-dashboard.json
?? docs/qa/evidence/release4i-orphan-reconciliation.json
?? docs/qa/evidence/release4i-publisher-reconciliation.json
?? docs/qa/evidence/release4i-query-budget.json
?? docs/qa/evidence/release4i-remote-config-convergence.json
?? docs/qa/evidence/release4i-source-snapshot.json
?? docs/qa/evidence/release4i-test-evidence.json
?? docs/qa/evidence/release4i-worker-recovery.json
?? docs/qa/evidence/release5-source-snapshot.json
?? docs/qa/evidence/release5f-external-staging-readiness.json
?? docs/runbooks/release4c-migration-restore-rollback.md
?? infra/docker/docker-compose.release4c.yml
?? packages/contracts/src/release4-reports.test.ts
?? packages/contracts/src/release4-reports.ts
?? packages/contracts/src/release4.test.ts
?? packages/contracts/src/release4.ts
?? packages/contracts/src/release5.ts
?? packages/domain/src/duplicate-purchase.test.ts
?? packages/domain/src/duplicate-purchase.ts
?? packages/domain/src/preparation-lifecycle.test.ts
?? packages/domain/src/preparation-lifecycle.ts
?? packages/domain/src/preparation-temporal.test.ts
?? packages/domain/src/preparation-temporal.ts
?? packages/domain/src/release4-catalog.test.ts
?? packages/domain/src/release4-catalog.ts
?? packages/domain/src/release4c-personas.test.ts
?? packages/domain/src/release4c-personas.ts
?? packages/domain/src/release5.test.ts
?? packages/domain/src/release5.ts
?? packages/domain/src/report-v3-state.test.ts
?? packages/domain/src/report-v3-state.ts
?? scripts/generate-release4-provenance.ts
?? scripts/generate-release4c-file-ownership.ts
?? scripts/generate-release4c-manifest.ts
?? scripts/generate-release4c-persona-evals.ts
?? scripts/generate-release4c-route-scenarios.ts
?? scripts/generate-release4e-ownership.ts
?? scripts/generate-release4f-ownership.ts
?? scripts/generate-release4i-source-snapshot.ts
?? scripts/generate-release5-evidence.ts
?? scripts/generate-release5-source-snapshot.ts
?? scripts/measure-release4-catalog-performance.ts
?? scripts/release4i-minio-fault.ps1
?? scripts/release4i-notification-ack-fault.ps1
?? scripts/release5-external-readiness.ts
?? scripts/run-catalog-audit.ts
?? scripts/ux-contract.ts
?? scripts/verify-release4-contamination.ts
?? scripts/verify-release4-databases.ts
?? scripts/verify-release4-production-export.ts
```

## SHA-256 inventory

| Path | Bytes | SHA-256 |
|---|---:|---|
| .dockerignore | 263 | 4FF042D2646ADD957DD8A1F84A707E5FC1F3732B16194DCF6CFDAB75163C95D9 |
| apps/admin/app/catalog/page.tsx | 50832 | AAD61C9AD72BBF0BFCD419F2F7D31686429100462CC333F3AD2B6BF6FC838E98 |
| apps/admin/app/page.tsx | 2583 | F9E8C84C75C0523C650809DEA3EAC8E81FC3FEF90A77AA6BAE0B3184607DA476 |
| apps/admin/src/admin-cms-pages.test.ts | 8748 | C81EC2693FC3C7767C257E0A9F788009ABCFF0B8A4147435E92EDE1DA380CE54 |
| apps/admin/src/admin-cms.test.ts | 1238 | FDF31D9EBFE273543B6794CF942E2281296425B9F71D119FF5BA9E686F424A01 |
| apps/admin/src/admin-home-render.test.tsx | 647 | 6A93C69C73F259A379A9DDCCCA06A1FC0BE6214F29EE9C47517349C4CF438C0D |
| apps/admin/src/components/AdminShell.tsx | 12952 | EC8C3EA5625CD3E0B7B5D119F12F90A241B14B481C1410561E49961DD69388CB |
| apps/admin/src/lib/admin-api.ts | 32403 | 425677B9284AB0FA0C183B744871405A65FE9C46451349B719ECE9849A20D825 |
| apps/api/package.json | 2548 | 7A18F4FDBEDE4CBC793BC67EEB34400C09F24D29FDDB27FB9AE119C66E69E61C |
| apps/api/prisma/migrations/000013_catalog_taxonomy/migration.sql | 2415 | 9754B9E2CDD2EBBC7018BAEBCA24BDA3F6946AF6638654F47773B25AE42A34F1 |
| apps/api/prisma/migrations/000014_item_definition_v2/migration.sql | 14347 | 719F18EE24C43D82301BBDA2CD2BB7068A4D082EEF422076369A6525C3F08961 |
| apps/api/prisma/migrations/000015_item_plan_status_v2/migration.sql | 4207 | 67118B1B6110065835A3A3646D09A6E78F390BDFC929C4B8729F40734887144E |
| apps/api/prisma/migrations/000016_expense_taxonomy_v2/migration.sql | 4799 | 0100C090A97503DE0CB85755B01847F56A70680895978BA41B860FC5E64CEE28 |
| apps/api/prisma/migrations/000017_report_aggregate_v2/migration.sql | 1775 | 0E3D7394B5E4B6D6B5A798358B96E55A5DFDFB2955C881062754343A074D1510 |
| apps/api/prisma/migrations/000018_catalog_search_alias/migration.sql | 2549 | 97A2872AE8FAE62F69504CBE62756C798A5E297FC4C96EEA718A82A9261CF721 |
| apps/api/prisma/migrations/000019_item_plan_missing_states/migration.sql | 313 | F3F9055A6591A9F56823A092466823455B38FA71C72BC895BEFC384D3EDAF8EF |
| apps/api/prisma/migrations/000020_item_plan_state_backfill/migration.sql | 198 | 302978AF4E5FD6B19F9ADD0B4812800154A4B1EACCA601ACB532CCBF2073329A |
| apps/api/prisma/migrations/000021_item_plan_context_integrity/migration.sql | 548 | B6F1CD065C98F3DBA113C9F2657FDE177350B98C78D5068D3694FB9FD3D3C19E |
| apps/api/prisma/migrations/000022_catalog_editor_separation/migration.sql | 346 | 873164B1C1716F0095948253094E046D312FE33ECE1D870010184A606D09E275 |
| apps/api/prisma/migrations/000023_release4c_catalog_workflow/migration.sql | 4450 | B36997AB10565137347FD4987BAA35FBFE7687BD15C9EEEFDF3A2B0A2204E18A |
| apps/api/prisma/migrations/000024_release4c_coverage_applicability/migration.sql | 1410 | BBCAA1587263689DE1E2B890167BED55DBEA9B67E1D6B082D9658693DDF78763 |
| apps/api/prisma/migrations/000025_release4c_item_inventory_collaboration/migration.sql | 1845 | 0818789C540051EE6760FD89AECB62DCB7CF9F4A3E31A0E7DC9647EB526E7FB2 |
| apps/api/prisma/migrations/000026_release4c_expense_payer/migration.sql | 451 | BA7DE728F7F06F9B620DAF614C4E96672CDD2ED79B293EAD8161ED5033052C54 |
| apps/api/prisma/migrations/000027_release4c_payer_legacy_compat/migration.sql | 67 | DA5D5F7423C45B880F3879A1E114BD5980092529E6C699D726A2BBDF5BD8BD55 |
| apps/api/prisma/migrations/000028_catalog_feedback_loop/migration.sql | 363 | EFE340A3956ED3859ED00A303EFDAABA2F670F7BA4D72B2A005D325F6AB6A3A1 |
| apps/api/prisma/migrations/000029_catalog_safety_alerts/migration.sql | 1373 | 1E26EBAE87E114C07787D419278C1A9774814ECDA9A3CF04BD7B0D2513009907 |
| apps/api/prisma/migrations/000030_product_offer_approval_comparison/migration.sql | 801 | EF1C5CAFC0DB881C592DDF7B09FAAE867D3A5D9EF2E68737F71A08C25962B5F7 |
| apps/api/prisma/migrations/000031_release4c_preparation_context/migration.sql | 2703 | 64FBAE259D84E5E27B52064DFDED2B5E59669A461C4BF751094A3DB20193C8AC |
| apps/api/prisma/migrations/000032_notification_navigation_scope/migration.sql | 298 | 70CF7EB04C710F0D26FF979389E2E77C54EA9DB13CF401BA5B5F5FA11F36EEB2 |
| apps/api/prisma/migrations/000033_release4i_operational_resilience/migration.sql | 4896 | F23F3C1FD4C43047B04C9A89949C2B5C7424AB2A1451444036E40C26A9467A2D |
| apps/api/prisma/migrations/000034_release5_legal_catalog_readiness/migration.sql | 1558 | FD2939E5DA9D9197F2E840BF215752BDCEBF4F8C2B62FBDEBCE2019E041F198D |
| apps/api/prisma/migrations/000035_release5_daily_use/migration.sql | 5844 | E9938116E290E4E0F53EA2B1FE4796C7A7492E0B106D7CF1AAA741E94A378873 |
| apps/api/prisma/migrations/000036_release5_assisted_input/migration.sql | 3363 | 82DCABE1652988D507AF63AD74754F43754F7CC235FE3DD2933E34B59DB7F436 |
| apps/api/prisma/migrations/000037_release5_external_readiness/migration.sql | 4920 | C696FC8D6DFA959102F9046C7363CE05490BECF0D52DF63E76A5EC53CA783454 |
| apps/api/prisma/migrations/000038_release5_recall_alert_events/migration.sql | 267 | BCD3ADB659E8FFC33D2D19A98FEBB3464715ED6663B3940080EAC0D574468A30 |
| apps/api/prisma/schema.prisma | 94345 | 40C5C7874D550922591C5EF49CA1EE47C76DFEDF50451FD5567CCE11112F488C |
| apps/api/prisma/seed.ts | 27186 | 0128314709DF18683647CC68991D91259FD3EA49E5D2FB02F23B23F87A10C97F |
| apps/api/scripts/catalog.ts | 25196 | D91B34FF5EB3F749EF7506F88C7C3564D2AF55433419B782223214FF72CB39FF |
| apps/api/scripts/release4c-evidence.ts | 11537 | B3037CF27E972993F5D789BD66AFEB48708A07FDF4651A0179A7259FE6AE1C60 |
| apps/api/src/admin/admin-auth.guard.ts | 4790 | 037DA0399B5422DEB6AE0047D2F09CC88226FE21F89C0C0CD26DA0DCDA9C7EAC |
| apps/api/src/admin/admin-auth.service.ts | 12167 | D33FB51F25282CEBD7947804F248A4738EAAE697AEFEFF5B16119987A2D2BEB7 |
| apps/api/src/admin/admin-jobs.controller.ts | 3621 | E4871F4AB497318328502CAEA099FF44FB1715F5A84523910690853C609D854E |
| apps/api/src/admin/admin-operations.controller.ts | 14290 | 888FAE1F7B6AF072B0287726C8054C106F2DB06A219D25BEF8B0BA1E78DFC918 |
| apps/api/src/admin/admin-token.guard.ts | 2519 | 68199DEEE00C9C9A97D9A790B5F2A268ECDF3490F4B9765EFF2FEA505C312860 |
| apps/api/src/admin/admin.module.ts | 1564 | 8DF4CD34ED84524E9034982B54A9F3966F14611BFCD69369CE66D5C46D6F5274 |
| apps/api/src/admin/dto/admin-operations.dto.ts | 788 | 006E169108FE3D4C2D7CC363BCCE2159E0E87C9157B10C0E767DD503F9428C48 |
| apps/api/src/app-config/app-config.controller.ts | 2930 | 0CBCD95F05B99B95A795C8C717DE06EB37833377EAF607486886DF7E013CC386 |
| apps/api/src/app-config/app-config.service.ts | 8731 | 691D5BE547DD094E70FE684BB3847D17CA34B678B0B64616DC5F16DD79198AFC |
| apps/api/src/app.module.ts | 2065 | A9028426D9438E2B1FA08371AFCC1B14C3A4FDF923694BB2E308D3B3BE9A0289 |
| apps/api/src/auth/auth.module.ts | 1723 | 83981F465A716230098B033C31C3A6942CF32B679B717EBF9F207B19B1554A88 |
| apps/api/src/auth/providers/mock-kakao-oauth-provider.adapter.test.ts | 1153 | 62A1B7DD0E93F71A475162B330A21DC9D6A451B75FE05B9504AE0656B3441009 |
| apps/api/src/auth/providers/mock-kakao-oauth-provider.adapter.ts | 1682 | 3B52F7F80BA9046D1FA6FA27560677B025C3B2D15ABA994C0DE706795756CEEC |
| apps/api/src/catalog-v2/admin-catalog-v2.controller.ts | 20615 | 0305B257B441360C1FC1A073DA19057B4F48236C12FEFF76EAF9D52995E00122 |
| apps/api/src/catalog-v2/catalog-import-file-parser.test.ts | 2204 | 3FE360F957E39FA33F0B0A0E94ACB3167C1FF88749FC3F6E13E76F53D4D60508 |
| apps/api/src/catalog-v2/catalog-import-file-parser.ts | 7456 | 57E4AB9B13E71B1999EE514C587C2174E25A35E354D8E53C302F1CE7325F01F9 |
| apps/api/src/catalog-v2/catalog-import-storage.service.ts | 7194 | BC9BFA70B9ACE1118D7ECBE9BD8A05FF8C2D11867F3DC8B05E4477B2DF149DD0 |
| apps/api/src/catalog-v2/catalog-import-workflow.service.ts | 9613 | 581ADCE740F9F9906F59B912B36351AD2B47EC00C75A17D2B566CDD667C55024 |
| apps/api/src/catalog-v2/catalog-v2.controller.ts | 11797 | D787A9FE4E16A0FEED0098EE4A479272AEC4B97760E647C667FDA0D3AC1FA57B |
| apps/api/src/catalog-v2/catalog-v2.module.ts | 1022 | 191742BE7F9263A947FBBBED7445518009EA2C54485E55E70BE99838C8F3E0A8 |
| apps/api/src/catalog-v2/catalog-v2.service.ts | 171723 | 256BE5A7D01D1CCB07473481D4EC91E14FB01796C32E1DB769955C9014267794 |
| apps/api/src/catalog-v2/dto/catalog-v2.dto.ts | 16290 | 44574FEC6E9DB74DD25C35AB11110DEFB625E2FF453F2AA556C0871B768E68F4 |
| apps/api/src/common/filters/global-exception.filter.ts | 4195 | BD1CD2861ED569FE2E3DA2BDF0280DE7A0E4AAD617C0974FB872B11F954FACCD |
| apps/api/src/common/idempotency/idempotency-request.ts | 254 | 13784CE2768C25ADBE3C7A58A66CB01580F9241A8D0FCFF3F08D9FE63C18A515 |
| apps/api/src/common/idempotency/idempotency.interceptor.ts | 8343 | 6E26D760851DEE3CEB41E81A44EA2073A0F6F13C2C1DB4BEF7C02DF56A7A4EFC |
| apps/api/src/common/operations/notification-ack-failpoint.ts | 353 | 9FC77A44610614A477500DC5EF083D4C6420E3C500E9DC460B02A85267572F9D |
| apps/api/src/common/operations/service-heartbeat.service.ts | 3001 | 32F90E4722727F5A8F4295679B11A78B982C9211F279B22498FB79BF021E56E0 |
| apps/api/src/common/operations/worker-crash-failpoint.ts | 332 | CD01B2AA97C5D14738B9219AB80652B75B3FDE082ACCAAD04A271867CD8D32A9 |
| apps/api/src/common/storage/object-storage.module.ts | 289 | BD1C3060E91EDE570AC3C99FAA7194B2DB6E3446B1112D46A463D60F27FE86CF |
| apps/api/src/finance/dto/expense.dto.ts | 2283 | 53385054A250503EEC9F21A4A12379D6C0AB6371B031E1CC87C20ADF4D7D10EC |
| apps/api/src/finance/dto/reports-v2.dto.ts | 1258 | D61C3F830DA6A1B72B66EF92B8E4317753BC8BAC443320527E079096E8FA352C |
| apps/api/src/finance/expense-snapshot.ts | 1713 | 1F0A87F29A13392666746AF59BD617E695714B2AEE34CD9DE3A92ECAFEC84C77 |
| apps/api/src/finance/finance.module.ts | 1241 | 54505EC63469A91D07C8E30222FDCF990853EEE0E7D983E5D88952F65ABF752D |
| apps/api/src/finance/home.controller.ts | 1480 | BA04F43656E1372682CAB3F55D428A8AED266F855FD238479E6F75DE6BA6065D |
| apps/api/src/finance/reports-v2.controller.ts | 3700 | 4BFE8D63D00E23B9D36198719E138F309221226E4990B366CDE097BEB4E174CD |
| apps/api/src/finance/reports-v2.service.ts | 43338 | 633844B99CF03B525DCABB58BD38952B3D5665FD451F76CDFB2D39A1B83DC614 |
| apps/api/src/finance/reports-v2.sources.test.ts | 5528 | 8843FE9D177019FC0D6CCF47D574573A663268AD50137582D588C97F8CF637F3 |
| apps/api/src/jobs/job-handlers.service.ts | 16308 | 23BE2D1CA201FECE9F54445E4BC09BFBA2B831B57758FD8CDF39B7C94850D958 |
| apps/api/src/jobs/jobs.module.ts | 919 | 3118D1ABBA135974DEC285A8ECE02B9271B924238BAD868E276FBE4A735E4ACD |
| apps/api/src/jobs/notification-delivery.service.ts | 6387 | 0F005E8F0A04B28636CE537D7357956F36C122BC509DB48755CA76681DD0BD7C |
| apps/api/src/jobs/outbox-publisher.service.ts | 3516 | 92AE8970D1F4CC3D6CACA33F797417FD4F92D55040DF51F877055167C6428CB6 |
| apps/api/src/legal/legal-document-policy.test.ts | 2410 | EFC0E383490651A7AC94E54106BD5A86E6A2BF8D79E53ED730E2D9DAEDCFDEB1 |
| apps/api/src/legal/legal-document-policy.ts | 2813 | A1AE75049DB1CFBC8D3A27CADAC58165E4981F63457A00ADF75935784C1B3A66 |
| apps/api/src/legal/legal.service.ts | 1891 | 2B8B780DADD86B7B84CDC89D1C55995B33DC61078E2268F795E981D0CF7F9F8C |
| apps/api/src/main.ts | 1720 | E6C613ADB0EDBFB1F301FE260F2A3FBC6CFD96CC5F8D3E67832453ADA9C4208D |
| apps/api/src/notifications/dto/notifications.dto.ts | 412 | 760B150097EB5A04F6E844295D99D27244117989FC9E5B1BD2B8341AC80C81FF |
| apps/api/src/notifications/notification-provider.adapter.ts | 2492 | 91770DE34A2E79C76C70258CBC6B5685E0D8655A3A5875CA31C5326A5D60CD53 |
| apps/api/src/notifications/notifications.controller.ts | 1093 | C21A886148C6741CF5A70A399B97084BEB8E7A6066EFE45858C2332CD0A45D0D |
| apps/api/src/notifications/notifications.module.ts | 757 | 82670C0E5976D606129C6CA4F1A4E43C76605D8752DD05BC93613BB9998B794D |
| apps/api/src/notifications/notifications.service.ts | 6285 | 138CB292A718EB55F397669D72922595559D76DC20181521E9769B0014D25988 |
| apps/api/src/onboarding/dto/upsert-consents.dto.ts | 754 | 79419BC4F934E8E2BDD1F486981054DB45EFB67EEA837FBFC5A824978E17A371 |
| apps/api/src/onboarding/onboarding-store.service.ts | 95991 | 9BDB8FD0358B3EDF33FD14148442F48A220E1E1C9FF6267B6E33089457C2DE98 |
| apps/api/src/publisher.ts | 1874 | 48AA713B207A48103B27258FC56BABF359A88280513DCF5B633486030B01335E |
| apps/api/src/release5/dto/release5-assisted.dto.ts | 2272 | B1CA45717FCCF9B600EC054304541B6C6AA00DDEEC45D6ED7D64858DCE19618B |
| apps/api/src/release5/dto/release5-daily.dto.ts | 2124 | BB64000404E0C41972A47D35C1DD9049225A733FC460BDAF5204C06B0A440158 |
| apps/api/src/release5/dto/release5-external.dto.ts | 2623 | E7A2B3FDC873AD6D907509D6071314CDC823DD235B7A22767227A2951DE59374 |
| apps/api/src/release5/dto/release5-readiness.dto.ts | 2026 | 6D8F83E6B967EBFFE6E0CCDAFC58A8F5A52BEC79C75DB70EB974D5E328A5A7E0 |
| apps/api/src/release5/release5-admin.controller.ts | 9103 | 33B9B2FB904CE5A84C4E7E2C63FC528BBD832E80F282B627043F5F48F915FC88 |
| apps/api/src/release5/release5-assisted.service.ts | 16975 | 1CFE437CE183FB94B3F7460F888087093961FC1542D994BA7C7D44523267DA60 |
| apps/api/src/release5/release5-daily.service.ts | 23391 | 9B22F02796BA21631BC8CC1E033E6D4ACAF1C8DC6F877CE30993C47E03398B38 |
| apps/api/src/release5/release5-external.service.ts | 20013 | 873C4198ED81813027A33F904C876853F28F53C02E6A29D33BA6575235249151 |
| apps/api/src/release5/release5-provider.controller.ts | 632 | D6420AA0E9CBFB6A42967143FC933C37FA4E01C0051D8B2851D0CBB8AACDDBB1 |
| apps/api/src/release5/release5-readiness.service.ts | 14919 | 67B9AE57735AEB5B707FC32DB6F90718F8817D432E52923F0777A79BC7F9BE49 |
| apps/api/src/release5/release5-user.controller.ts | 7094 | 2981ABC20C2F8D53FAECD3ED5E182AA713D60BA489219FCED8E12241020A72B3 |
| apps/api/src/release5/release5.module.ts | 1284 | 81FF73DDFC6A4D59C5A20A220821E3E37952ABF891A15F6ADDD2541D25A9F740 |
| apps/api/src/sync/dto/legacy-reconcile.dto.ts | 836 | B0F2838241A27307AC18B5677A13D517039AE3CC023D815CF6890A4C87056043 |
| apps/api/src/sync/legacy-reconcile.test.ts | 2436 | 0AE530C9510FEE3726343A2B0390046F92C6510B931694A5360441E683C5E411 |
| apps/api/src/sync/sync.controller.ts | 1158 | 04008D2CA4E478D5C5BFEBDC0B03C0CB07FE52CCFD5B1118B6B09319250FB978 |
| apps/api/src/sync/sync.service.ts | 5719 | 23442D20368A915FAED9729320B13CA801F0AA2A1E15897495455F6A68C0478B |
| apps/api/src/trust/dto/trust.dto.ts | 1683 | 36D327160E5862D0FD82F836A4819DC33846210D9BBF9096FF36725F1EE74D13 |
| apps/api/src/trust/trust.service.ts | 4676 | 8F9C740F34CFF3D200E78EA074D90A9863089DF264D90D13893D6B0E997F5143 |
| apps/api/src/worker.ts | 4359 | 07A08035AD881E507DB70A4CEBCDB4DF5798067426D3987B5B9FEA2848C56DF5 |
| apps/api/test/admin-browser/admin-auth.browser.test.ts | 4512 | 3B077C9D91E6D5FA8839100649EFAB6E5F7DD936D3265E59BC77B56B4C9A93BD |
| apps/api/test/admin-browser/admin-browser-harness.ts | 4941 | 437A9797A38CB7E17FA3ACBAA0C4972728E09B433A01ABA307E837918AAD4C2D |
| apps/api/test/admin-browser/admin-catalog.browser.test.ts | 23213 | E7F56224CF7D128275C4744177168D90CC8418AC30FEFA8ACB743154205A44FF |
| apps/api/test/admin-browser/admin-operations.browser.test.ts | 9313 | D43CEFA640A8C319FB8E922E0CA446CA7F15B8C6ECCFB66A0683B5D6E35FD05B |
| apps/api/test/admin-mfa-session.e2e.test.ts | 16611 | 174BDFD04125DE0F095E1EC2725AFFDDB92AF8260C546A47053A5F28F345BD23 |
| apps/api/test/admin-token.guard.test.ts | 3281 | 92D8F59FFC462B0710B732F3068991EABA111B40AEF6514D5B17BCD9B8319919 |
| apps/api/test/catalog-v2-admin.e2e.test.ts | 40231 | 53D615CDF0D06F2E764BE06E179BDD7BBDF4387D79E659ED56569CC70594A306 |
| apps/api/test/catalog-v2.e2e.test.ts | 40536 | 0E82DCACCD1AE5A9F366BC74E57F6FB85BF16E1AEC8579466BD32A277D46D4BA |
| apps/api/test/fixtures/release4i-local-staging-import.csv | 83 | D86A02C6ECCAD1DB8D6D049E1D32ADDB51F5A407026D9F71323E52D1C632CEF9 |
| apps/api/test/legacy-offline-reconcile.e2e.test.ts | 4521 | 6AC18E9301BE02CFE8CA54F833BE0791314090696F22E22C152CB3C0DE7D9374 |
| apps/api/test/notifications.e2e.test.ts | 8817 | C0C7841E2D05782F38C2F4DBCE7A786965ED1122B48B304309F2B74DA8035496 |
| apps/api/test/onboarding.e2e.test.ts | 16999 | DA5D6EC795D8C1F1B6A903FAADD221A174E48CC3BC0E8C6E2136DE179D76BAAB |
| apps/api/test/release3-app-config.e2e.test.ts | 3535 | AF9BBA7829D255871AA51042EC1847D8D45BE842CDCD92F45F92A125B9B693D0 |
| apps/api/test/release3-jobs.db.test.ts | 9493 | E1B584402E9290E81FB9AFD5FA73DB640071DD9D6C85F28A3DFC2AD5D89BCAD6 |
| apps/api/test/release3-phase4.e2e.test.ts | 9912 | ADBEA6055101DCFF7657E74E94D0732F480E1959107FA6DAD8621FBE849ABCE2 |
| apps/api/test/release4-catalog.test.ts | 3310 | D4B92A4D3BD50439B0EB5A47C3C11496448831AC9DC617F9CC77CB103D49C63F |
| apps/api/test/release4i-import-object-consistency.db.test.ts | 7517 | DE4C6993F744B3AFC10D25480BFDD25CC10D8086F7780EA41300B96E9A11FE40 |
| apps/api/test/release4i-worker-failpoint.test.ts | 1770 | A9D6283B5D83BEC43A4B8ACD2F42579807829174B4D1A5920995B031F7E6DC81 |
| apps/api/test/release5a-connected-golden.e2e.test.ts | 5434 | 3D7C0B70B4388D2321EC8FC54751A252D5D8BEE75A0078CE121F4916334A4C28 |
| apps/api/test/release5c-readiness.db.test.ts | 5989 | 60BE3B040AB9FF93F049D066BF25FE66BA929A5E8AD0A6C8B4385452B9FFBD31 |
| apps/api/test/release5d-daily.e2e.test.ts | 8530 | EB75AAC13CD67517EAEC390EE2CCC7063C5D85E39C417F4E248E6E7A8F8CE5F9 |
| apps/api/test/release5e-assisted.e2e.test.ts | 8287 | 98668C4C7024903904A7346FECC8CD93E80AF3C0A7566A002180D91E1569D02C |
| apps/api/test/release5f-external-readiness.db.test.ts | 7384 | 55A60D613F292EB42E34D8C16C3358BF6A839AAE6078B783C760735C4BC15B06 |
| apps/api/test/reports-v2.e2e.test.ts | 18776 | F34542A0A9CC3204395F42EA09531A29FFA2BD0F04ACDABBA6542D861E404D14 |
| apps/api/vitest.browser.config.ts | 418 | 7C59145DEF7CCCF163C2DE0D5AE7D02BB5F4A50ADFF5F84B9D1CC8BD4078D513 |
| apps/api/vitest.config.ts | 1002 | BA543F2A7C126B418D7F4A05D7FD007E1D90F7D1C572A672EA280CCD1ABF43C2 |
| apps/mobile/app/(auth)/login.tsx | 14157 | 5DEB4231A01C1A69634C0DFCDCB300A927326D0556297E14C12C5375CD0DDE13 |
| apps/mobile/app/(onboarding)/budget.tsx | 4987 | 1FF197985BEAC3A3FF636DE6E1CD0F6E7BBA735E595FEDA15E134FEBF5F49611 |
| apps/mobile/app/(onboarding)/child-profile.tsx | 9607 | C7403813F1BA43AFC6F60A07F3365CCE3065982A3B4866688057EDD305AAAA0D |
| apps/mobile/app/(onboarding)/child-status.tsx | 4121 | ABB32E9D8E6FDC5DFDC5EB9D2D1AFEEC64347AF892C093106DCF90AD62AA7184 |
| apps/mobile/app/(onboarding)/prepared-items.tsx | 5189 | 40DB95E576A8407E9162E7EDB00D947CE62672EDD99862084D041C08401B5E52 |
| apps/mobile/app/(onboarding)/resume.tsx | 3928 | 1983F2EEBB79D6FA979DE57B4E1790E87AF881307E65233A2681A27109B3F0ED |
| apps/mobile/app/(tabs)/_layout.tsx | 3885 | A88DFFD9EAFA32B368D3E3E1113AB7C7A6C1B02545A5B200EF31AE0D7A342C6D |
| apps/mobile/app/(tabs)/index.tsx | 10315 | C540F78752BB9FE02C2619754C353F277811428C1D00142B6F252A970F8E0822 |
| apps/mobile/app/(tabs)/items.tsx | 11067 | 0A4491470B4E107A6877CB15FAC0BAF847EFA87800406D0F861FA1700D1BB622 |
| apps/mobile/app/(tabs)/more.tsx | 6740 | 826C374A0A5032B26DD2064E4BBDBF3FB87EBD85DD8569AB41C3665459FA3048 |
| apps/mobile/app/(tabs)/records.tsx | 14209 | ED9B63A79DE606BEFF08AC44A260CA8B2D8E28B84EBD6369C426E4EC511E2A29 |
| apps/mobile/app/(tabs)/reports.tsx | 38476 | 95DD90A7578501511BADD2947A56AEB36084194280A4E0F47F92563F908E48BD |
| apps/mobile/app/_layout.tsx | 6684 | 89A3548E176263A9E007DEF0665AA49247358810B77C781748428857E35A86B2 |
| apps/mobile/app/budget.tsx | 5125 | E6ED1C2348737187F1DD4B6A38486AC4083A25DC4EB3C9DB2A2B3EB07E429D13 |
| apps/mobile/app/children/[childId].tsx | 4633 | 8A9BB3B1BB12CCA45850D001BD2A8891B1A6C1C4F010992383FC6781C59DEF59 |
| apps/mobile/app/children/index.tsx | 4232 | 15340B7066201DFD7B64A8B9246E507F0AF5C4654DC954E1B2894E7DFABA4D1F |
| apps/mobile/app/children/new.tsx | 3757 | D17090B3B913623D39040F3F66E7B66A7031356630A2253F1FC0F9A1F1E53E0B |
| apps/mobile/app/custom-bundles.tsx | 4589 | B2C758592418F45451D7CF42D6C0AFD1BA9B2D292809C301B9D8874C2FA4B86D |
| apps/mobile/app/expenses/[expenseId].tsx | 24982 | A41755CD2064E09DCAD9C6491F49B6A75833E4351B39703678AA83A441E2A844 |
| apps/mobile/app/expenses/new.tsx | 29567 | CB0542D7814F55242CD593ABA8ED32A032F10480578F24B08DBBBAC13C54DBC8 |
| apps/mobile/app/family/accept/[token].tsx | 4469 | F479C46362D5C285E1A93AC9B5443741F0200F7324AE56FC0F74A4D255790917 |
| apps/mobile/app/family/index.tsx | 17931 | EC4740731E7513F72FAEE1A99A92EEBD6F616925115BEEBBBE966B5A557B2695 |
| apps/mobile/app/family/invite.tsx | 5473 | D55B8A074F5B536A4E93DFEBE58A63BFDD393187EE70094F250567557C97F73A |
| apps/mobile/app/import/[importJobId].tsx | 10586 | 891488E99F9C7F267DD132821FEDB80723664E7A6D6D7AAE27A42E291988B5C1 |
| apps/mobile/app/import/index.tsx | 13010 | 1B4EC8D1D14865B63F6C9119E93CE93EA5900B54EE7A6E67C813450EAF09902E |
| apps/mobile/app/index.tsx | 6615 | EAEF7DE335E1941F1C0B3B281445196F1094A7774B20CCF301812A06E3DC85AF |
| apps/mobile/app/items/[itemTemplateId].tsx | 16778 | 01C814DC94027536C91EF7F12D419D86C25DDD4A654F742A8F75041C297A2E7E |
| apps/mobile/app/launch-animation.tsx | 5979 | 6A099E2CED8CA019233DC99F3CD035BD8EBB796E2447DE7B88CBE588A4188EB0 |
| apps/mobile/app/notification-preferences.tsx | 4064 | B15D951CA86DFBCA058C8090E0D913377EA1505898DAEC62AECB71CBD6FE031C |
| apps/mobile/app/notifications.tsx | 6461 | 90A495A945B84E55489C7317D6C9FF60B8F8D21756DB34B73B32A0919E9221F6 |
| apps/mobile/app/payment-methods.tsx | 10227 | ED13EAB9C8B17FFB57F3EC5B7A906EB0DF924E0112D79188EA1B463584D07F67 |
| apps/mobile/app/preparation-calendar.tsx | 2918 | 91B4E7D660BE884FEF878B25DE6013FBE92B957695677BB9F97C529FE464F829 |
| apps/mobile/app/profile.tsx | 4029 | 8273D7425152ED9E5C588E1FF4FCBF5AF4D377841879FF22225A4B5BDA29CE44 |
| apps/mobile/app/receipts/new.tsx | 5754 | D196DD9963B26D232FF9B8E9B6BA4980622280818B548BBC435FA93AA1FBE151 |
| apps/mobile/app/reports/sources.tsx | 6978 | 25718D2056346CD416F128A55223D672BF9520C5B6A87EC5D779CFA5A8A42BB3 |
| apps/mobile/app/settings/index.tsx | 6850 | 98B67597E9DAFB1B2A8C78CA2B56046958DB8BCAD8A42F9AA0FA3500087AD834 |
| apps/mobile/app/settings/privacy.tsx | 12931 | 1F2B3100BF3C7A16B4DFA25771B39DB11DD82C8475767F58F6E0D95856593729 |
| apps/mobile/app/sync-status.tsx | 14393 | A7BCE4B29167775854DEA238759D80A1C6DAF81E7ED3F33D2C3539B99E75E814 |
| apps/mobile/app/weekly-briefing.tsx | 2832 | CD9EB744BBDA612BE0E498DDA21489B9CE51C49FB7F22C9A42B7D613EF3DD0EB |
| apps/mobile/e2e/release4c-route-scenarios.json | 76546 | ACF0EE103C9302EBC7CD92BA3DC2E2B78B3492BF819155A24E274CBE183E88FD |
| apps/mobile/metro.config.js | 1711 | 078790834539A8407E0AFA113369F849D1D91B3145135FC42ADD4696F8395836 |
| apps/mobile/package.json | 1417 | C3C29F7E8ED13B70F7A9BD1892206404074E15F180468E063C0FFD10CC7626B0 |
| apps/mobile/plugins/with-network-security-config.js | 4642 | 4A2AA4D4CE60BCD89A8816F0D04A333701EF12CDDC5133307A084ABF34F0AEEF |
| apps/mobile/src/android-native-ui-quality.test.ts | 6976 | 8B06CC52C29AD93A21D215D4921E2ECA63EAF034015946ABEC63679F2A92CE74 |
| apps/mobile/src/android-standalone-apk.test.ts | 4316 | F7D5B2D1AF5D37FB5B50F29071A3A77FB8512C703792EB12B48527BFB14A2939 |
| apps/mobile/src/api/client.ts | 75069 | 548BBB1DBBE2B7A7A5CC33452F6B0A5C3DD81D82A94E3CA05E02409DD34AD76F |
| apps/mobile/src/api/fixture-runtime.production.ts | 967 | 429300C9C678BBBCC76682902125366A72B9CFF25EAC61723C33C3BE09D57F4C |
| apps/mobile/src/api/fixture-runtime.ts | 759 | A136807251BD3079FC447FE9D89E8563B1FDBD41AFC4ED7979EBC8DB9EC9A971 |
| apps/mobile/src/api/local-backend.ts | 126811 | 5338A917388D2D84BC5F28E779A2B4503CC3E2829C19909B988530D477DFACCF |
| apps/mobile/src/api/local-fixtures.ts | 7812 | 6C6BFC36DE85AD346848CD7648DA1F20C54D374997352C35ED51767E4F393741 |
| apps/mobile/src/api/prepared-item-ids.ts | 382 | F572BFEEAF8F8BD97D7877FE63F57039BA2F5B8A8F68D5B6973B67F62BA55848 |
| apps/mobile/src/auth/complete-oauth-login.ts | 935 | 5C894FF9EEEDD2F7B2C504A495E327E67326DA3B2BA1BD6C099B7ED7DC852259 |
| apps/mobile/src/categories.ts | 3688 | B6CE280E57CA0754C7B67886BE9377E05F581E7DFE1273D92BCA3B2251AD17A6 |
| apps/mobile/src/child-profile-manual-stage-and-date-guard.test.ts | 4072 | E3272D5C74F17546972D7060925454792855017973F0058533576CE3DCC77348 |
| apps/mobile/src/config/app-config.test.ts | 2500 | E0068FFE878E1B68739778B7F47612FE59CB152056298E2B0D188BBBA1CAB1A4 |
| apps/mobile/src/config/app-config.ts | 3132 | B6138E75EFA4BCBE1D082C4A4EB0339EBBFB06BFECBE0AFF13B771DD0CF06956 |
| apps/mobile/src/design-system/components/NoticeCard.tsx | 1022 | 70C270F6081E8FEF3491ADD921F69C5C491D4F4D4CCE02B22FA3799DDEEB925B |
| apps/mobile/src/design-system/components/PageHeader.tsx | 823 | E20E0979BAC133EB7AF70D5BD92BC5C90D26B96C1CE30C1526DA6D965C14260F |
| apps/mobile/src/design-system/components/ResponsiveGrid.tsx | 802 | 9A25CB6FC9776E2248F8EB01C1560AABA438DD265386D958890B28650A42E603 |
| apps/mobile/src/design-system/components/ScreenScaffold.tsx | 1272 | 3F17360DFA2AC429E935BEF7FB354CA0664CC7AAF45F2F75B36383CE9BB4E78C |
| apps/mobile/src/design-system/components/SectionCard.tsx | 697 | DF870318FABFC1A2D0D8C091861D790BE15BBD01707CFAB21AE02143033D846D |
| apps/mobile/src/design-system/components/StatusChip.tsx | 1179 | 1A4BF72B09D5FA5A1DBA484E8C71F0D77DD3F74D20F771681D00C2E56DC5E7A8 |
| apps/mobile/src/design-system/index.ts | 830 | 030E3123536FADE98614F5BDBB96185965582423E47B795B261E336142D7BC88 |
| apps/mobile/src/design-system/patterns/AsyncState.tsx | 4017 | FC6958FFE53086E1120E7138497AC0AD2F78DB2E8FC0DC1BFAB9AA1AF811325C |
| apps/mobile/src/design-system/release4-design-system.test.ts | 3361 | DF024EC754ABD30B3976AAF7E1AB8B6BA3A00E836074E0C7FEB932BB7AA00973 |
| apps/mobile/src/design-system/tokens/breakpoint.ts | 96 | D59AB028ACADFCAE953AFF73B707198D1B49920FC11B43EFDB81D10BC5483805 |
| apps/mobile/src/design-system/tokens/color.ts | 646 | 2E2C5D2F69320592D0F48E5AFF70F017CED8E62C47B9EAA5E146D26A04847B36 |
| apps/mobile/src/design-system/tokens/elevation.ts | 385 | 647D5FEB2CC742E99E59078E9B31D5F8194D8FA993332F209DA0A80A4980493C |
| apps/mobile/src/design-system/tokens/icon.ts | 90 | 08BD156DC5303D3BE8B2EA65462EF79DA206B2879113C8AC0DC0A4F431C2A7DA |
| apps/mobile/src/design-system/tokens/motion.ts | 101 | B76D386F3B7A0BA4160E17B40F306EE591EF559AFD8282B32373FA30C77D1661 |
| apps/mobile/src/design-system/tokens/radius.ts | 111 | 3A1CE365F7D3AFDCDE7794388F9075F0C0B665CB1BB215808CAB31E23746476E |
| apps/mobile/src/design-system/tokens/spacing.ts | 156 | 0CCD48FB76F44AFA6B169F58C0A855554BF44824B71741D048E54B8A4E5F1E68 |
| apps/mobile/src/design-system/tokens/typography.ts | 553 | 57E3A21372C6568B764E76E2C4297F95CB12D656DA6999792F200B2AAD1D23A8 |
| apps/mobile/src/legal/consent.test.ts | 1540 | 9185FD755F44E9436F7BF9CE144B6ACE3B5C2CEE7C081D308A9C3B22DBF5DE2C |
| apps/mobile/src/legal/consent.ts | 985 | 3AC93A6017203776FAECBE7B6A7B9102F067B22484F361D6DB1DB56728223230 |
| apps/mobile/src/local-backend.test.ts | 12255 | 21E307B38CCE198455FE118F089DDFA3B682F915E896B94FC49D3B92A6FF3A84 |
| apps/mobile/src/native-profile-boundary.test.ts | 3142 | 6B383AD234C89BB076654192E20CB62472DD857D6F67871EA8B2D49D3AA9916A |
| apps/mobile/src/navigation/pending-intent.test.ts | 3254 | 13E3A089D23189305749BE904B87E8C16614E1FC593079B59CB3DB4389D81309 |
| apps/mobile/src/navigation/pending-intent.ts | 1917 | 261DE6841FF40B5AB5453C1AEAF1F4708C82E594B064543D48E7C361989475BD |
| apps/mobile/src/notifications/route.test.ts | 1518 | E4ED02B3538053C1A101B87DCAD5C0D377308B9245FF41891DA35F6B7D983005 |
| apps/mobile/src/notifications/route.ts | 1307 | CA991758C86EC37445DF2797F96F334C1B4E6E6366351869191D2367BE5F1787 |
| apps/mobile/src/offline/backoff.test.ts | 1406 | 70DF7A0C95CA9B4089828DA32F72E00E167AC6062E389758ADF8E1DD1FBCFF3F |
| apps/mobile/src/offline/backoff.ts | 1367 | D210D4C430E75C5D224E9EE719D3D7E5D40EDEE75389835BAB1D215ED41388CE |
| apps/mobile/src/offline/errors.ts | 1793 | 4F17979F25B1B26505C4CD45239F89C18E24F6085E30D7B8A0E9099357B6A19F |
| apps/mobile/src/offline/expense-list-reconciliation.test.ts | 5413 | 4D29A8A6D880A504ACF1A6E225B1224A7BE264FA1D293918113F3E9CDFC33D32 |
| apps/mobile/src/offline/expense-payload.test.ts | 1104 | 152E7425CDABAE2D801B2F6B7F42B0C45EDB81BC07C8DA5F57A2E5C5F32DA642 |
| apps/mobile/src/offline/expense-payload.ts | 854 | CB689FB06CC9B12F0D64DA939C710AD5D4011110DDC02DC1245E6F015848DC9E |
| apps/mobile/src/offline/expense-sync-request.ts | 1216 | 24C5DC54F5DADC22D62494A0C6787DE449465CFBEF8514131CA375DF8AA6FFD9 |
| apps/mobile/src/offline/legacy-reconciliation.test.ts | 5701 | 2BE592CDB5760B7E89DAF420A01748827EEF597662D89009AE0F36365C1A913A |
| apps/mobile/src/offline/legacy-reconciliation.ts | 7424 | 3935C4CC96BEFFA3EFAFC1C197E3FE08BCA1740D4C8571B34F8CC7D079488B5C |
| apps/mobile/src/offline/memory-offline-store.ts | 4438 | 92C19CBFCC51908EEDD1DE6530D963F2EF5983332EA4AD911EEB9799DA146C20 |
| apps/mobile/src/offline/offline-volume.test.ts | 4774 | FA67C0D0AAB11FFBFB993DC2F8D9B96256AF43C8ED15E48B560711EAF159182E |
| apps/mobile/src/offline/outbox-merge.test.ts | 4443 | 0CD174BF2C130330F0460E81B5E747FBA893B398402EBE3BB67278D15F460A9B |
| apps/mobile/src/offline/remote-api.ts | 3580 | 66B984B5FE89050F6E7DDC5564638D0336BCDC7FE1735EB3D956E60639CF465C |
| apps/mobile/src/offline/session-scope.test.ts | 4754 | E2265B30D8B704ECB9D9C683A4D38F85B09FA5B034A45DF03D4E5667119F41F2 |
| apps/mobile/src/offline/session-scope.ts | 835 | 657DD1A33170508944C2AA4A90CD3E63E5872E27482E513BDAFDE215FB845304 |
| apps/mobile/src/offline/sqlite-offline-store.ts | 18738 | EC1BBAC54FD956F3641273C4735E0CDDF52C0817F9E234813CA59AD5A0C2D979 |
| apps/mobile/src/offline/sqlite-upgrade.test.ts | 12596 | 02C44792E612E7985D96FCD717448ED0DB1272045DB6FAEE8F49C2C7478B9FDD |
| apps/mobile/src/offline/sqlite-upgrade.ts | 3678 | 7700B4E6282BDACE852E6A2DBE9C31129242E5D502945F8F29DACF139DA75DCB |
| apps/mobile/src/offline/sync-controller.ts | 21353 | 1926F677ED9C6D4559A3240DB560FCA73D2EBEE3579B75A5FD46F5603F219612 |
| apps/mobile/src/offline/sync-display-state.test.ts | 2739 | 45C24C41C213FF4AD3B2F41849572E67BA64588E6144B25B981B62495BE0DC0B |
| apps/mobile/src/offline/sync-display-state.ts | 3916 | 6548FD0CB351EDCE9CDD91233F72F854B23F726FBBE1C8571CEF3DA07C7D565D |
| apps/mobile/src/offline/sync-engine.test.ts | 24251 | 62F3B7E4E59D95B2339A972E4645F9257C806CC98E26DAE02A05CFDDB93AA5C5 |
| apps/mobile/src/offline/sync-engine.ts | 25736 | 87B9A0D9DA4F413595CC5101B77962BE984902EA954B9273B1692A83E8F0695A |
| apps/mobile/src/offline/types.ts | 7251 | ACDAC339BE8912CAD93FA7DA2709590F3215FD053309105A8351D6E467BE5D0E |
| apps/mobile/src/onboarding-resume.test.ts | 7534 | 683CA347F5B890C60236FB73D75B8F88C619D4D9B4A08B2A0DE6F15FD1290B57 |
| apps/mobile/src/onboarding/resume.ts | 1057 | 51678315E6C4DFDE7AD850B5815946D483F49E0330DDD2C30FF67F17DC9AA78B |
| apps/mobile/src/preparation/PreparationOverview.tsx | 10115 | 4F80C24689885D3862C01D851D4C98830AEE6AD018B6CE51E1F7CEDF659A8F45 |
| apps/mobile/src/preparation/Release4ItemDetailScreen.tsx | 33586 | 82725465B88B3E1EBDD7157DEE94752742781EE98D5C30A3936DA501D060D5D7 |
| apps/mobile/src/preparation/Release4PreparationScreen.tsx | 43424 | 51613684F6448814FE895D0F24487B5AE8CB284B59B39A463993716D42B5C3B1 |
| apps/mobile/src/preparation/item-plan-form.test.ts | 1872 | BAB90A92D93A7778C9EEA3B10376E4AC74AA195E8D389780DFD083C8D3D886B3 |
| apps/mobile/src/preparation/item-plan-form.ts | 2501 | 352CF185094CE054ED5D7C31827CDFEC7E5CC20D870888CCC97F006E9E357F3F |
| apps/mobile/src/preparation/release4-preparation.test.ts | 10504 | 2E0B692E9AD149F3A5A4B0B7B87913B75F41C3E2C856F873D97DFA8BF6EE6272 |
| apps/mobile/src/production-build-boundary.test.ts | 2407 | DC08D8FA89B263B9926E8CBB773945E6FBBB4ECD8F665C8D9D3A72346FCFA37D |
| apps/mobile/src/query/mutation-invalidation.test.ts | 2259 | 57FD2B9BE4DE53A4C5D6B025A6E9E3F80F38436B2F811438F48B39EB76A2A0EF |
| apps/mobile/src/query/mutation-invalidation.ts | 1562 | BB73CB8CFEABA5E3FD5A110F86163BE1842A28DD411AEA4894887CC8C5795DBB |
| apps/mobile/src/real-session-data-integrity.test.ts | 4456 | EA3E57F853D9FB218346BCFCDD2ABFE006B0BAD031F3F495001CA8ADA90BF992 |
| apps/mobile/src/release4d-ux-contract.test.ts | 2297 | BA51AD291A29A56BC85632A7FAE154F56F9E9828F2621E2173B53143069EBA38 |
| apps/mobile/src/release4g-route-registry.test.ts | 2620 | 9EE683D185CF89E1EB8623F041971384B99A13C369C789A253F1A78742FC697B |
| apps/mobile/src/release4h-route-state-closure.test.ts | 2327 | 191E1C9071930B650B9AFF17862F59F6A6BCA6B4AA62E0126B10F8507AC7483C |
| apps/mobile/src/reports/period-aggregation.test.ts | 1484 | 0FB2B0E5691801FACEA8CC04460865AB7071682F5345C3B8ED560C5EB303F341 |
| apps/mobile/src/reports/period-aggregation.ts | 1583 | 62E937B67B3FB2A480EA5737772429A0D48765BCFCFF84BFFFCB4F1B7EA8156B |
| apps/mobile/src/reports/request-plan.test.ts | 932 | B763A815213A3C34ADFBC0332B66845C401045832F52798938B2768AE09E9366 |
| apps/mobile/src/reports/request-plan.ts | 1334 | 275280916E514B7520A9667142CECD73BB5D12F6F0C0799DB35572226A592342 |
| apps/mobile/src/reports/source-navigation.test.ts | 2158 | B359382594765CBA1EC843A0F8B4B658F46049DC5EE81CCF98C6AEF254E48715 |
| apps/mobile/src/reports/source-navigation.ts | 1694 | B9F54CB0B955DF52657B25930D6CFEDA9682E2E7BBB353AE6E75970B53482A73 |
| apps/mobile/src/screen-scaffold-render.test.tsx | 1634 | FE25B650B824B7FF850110B4D41E76D8D94593A4F48FC4D0E1D761960A198598 |
| apps/mobile/src/shared-controls-render.test.tsx | 3022 | F9B3E1F8A94AD091671473F0E633664F2BE8E739FD62B84EFCDF2B77239AEA11 |
| apps/mobile/src/stores/catalog-search.store.ts | 1334 | DB0D83E1BDCFCF7E666F6B93804985D4BAB23853AD565F1B5941CCA38A08C30A |
| apps/mobile/src/stores/persist-upgrade.test.ts | 15930 | D9386C533F0B724B0524B21BAD782413CA97CF5BF4FD7A2D7B6D347868162634 |
| apps/mobile/src/stores/session-cache-boundary.test.ts | 1329 | 70D3E26C03A689EA09FD1CFBA300C9C83B1FC145DF2A6472D89E4B3F0F95BC3C |
| apps/mobile/src/stores/session-cache-boundary.ts | 211 | 30AE13A803D0D07BA10601EE8A55B6E17D9A0A392226959265377A4F542D1EE9 |
| apps/mobile/src/stores/session.store.ts | 6111 | 7FB8020F8143877570E7F579E413817611749FD46576255713D82EB44E41BCAE |
| apps/mobile/src/test-login-flow.test.ts | 3302 | 258388B806BEE843649CF9C627C9B28BD2FF33AC7AD878DD850A776C9C7015F0 |
| apps/mobile/src/theme.ts | 5548 | D7FFF167CD54E34F5218A20EC0DFE74504A05B37BD7545B17069F56AB15E6C79 |
| apps/mobile/src/ui-pixel-lock-flow.test.ts | 18990 | 5CE06E3BB2C981B88DD46AD18D92193DF0589CABEB5A24F70E39947E8585088A |
| apps/mobile/src/ui.tsx | 28358 | F5536AB9580FB2AE880DE5ACCD037A46C042DC31907D9A2DBBD165C80008F0BA |
| docs/5차/release4-admin-editorial-import-design-2026-07-16.md | 3441 | 812F4D784824D98DF5E376516EA9F6E40F818B2DE440A4A198C3977F97ACC10B |
| docs/5차/release4-admin-operations-queue-design-2026-07-16.md | 4691 | 7A80522D07F616928A6CC1F511AB211615CAEBBE3F07732C3C8C4B57EA18ABA3 |
| docs/5차/release4-admin-taxonomy-operations-design-2026-07-16.md | 4100 | 5828F6D5B9F87A3F477571FC20F5F09DB21C4F838127B31CD0F0D49C985765DF |
| docs/5차/release4-android-evidence.md | 1971 | 18216089A28785DD12856D2D59758ACBF9B84046FEA51626256FC1B4DF447509 |
| docs/5차/release4-catalog-coverage-report.md | 2086 | 6D1493891AFE7CDCF369ED393DF5E30F2F0BFCB6D4AF845966E93DC683646FEA |
| docs/5차/release4-catalog-coverage.md | 989 | 6C5DD3AB2CFF5B3544442A0179AACDB74DC9E02D663B8DA66D2C715541508E99 |
| docs/5차/release4-data-model-and-migration.md | 2808 | 9914A14CB08A3A9D65644CB07906548A420A28A61CE3A7804ED76C2A9F47320F |
| docs/5차/release4-design-system-migration.md | 1050 | 1DBBD74AD7F3DE06CC6D08AB44535AAD06CE19C04A2F8EEF9431F0F881CCA8CC |
| docs/5차/release4-enhancement-baseline.md | 3998 | 5A7E86AFBECF9E8054919F5EB617588E3F003897334BFE445233065ABF2B88A6 |
| docs/5차/release4-external-actions.md | 1035 | 4799F5FD748F542224540B19DF1E0CFCD9A8BBA9F0027D0BA8909BB43EB04ADC |
| docs/5차/release4-feature-enhancement-completion-report.md | 4387 | 81BE30A56F1122A7ABE64DC747EA9546BAEE9599D85D57B0BFF3F39DE646AD29 |
| docs/5차/release4-gap-backlog.md | 3472 | 672CB8574C6CB925B7CB882E9AA3C51FDEF0EB60D8D56F4F3CE9F2B413E77890 |
| docs/5차/release4-implementation-audit.md | 4147 | 7D364D56C3B21F8AC82272F353D7D028F113A961A159678DEDFB9E7F0CEA2C54 |
| docs/5차/release4-known-limitations.md | 1944 | EC43116FA11F83F99AF95F745FA6F3DB9F50CBEED6C40419C12E509DAE6D343B |
| docs/5차/release4-migration-manifest.md | 778 | AAC9918C5546795E78544C038288443623AE431E22D25EB24517811F77B7C31F |
| docs/5차/release4-next-improvement-design-2026-07-16.md | 6415 | 11A06C575F33F15784AFF14C70489744B1E9447637AF999A2589588D5D982058 |
| docs/5차/release4-report-v2-validation.md | 1564 | DD58EEC5F8C947C0B79981CA056836FF150914D3DF33CA43C90C5F02E2F2EB08 |
| docs/5차/release4-test-evidence.md | 3173 | A847A197E6D66B0AC13E8A55CC696082CF8C85785E3752B11A9FB2EE751A4109 |
| docs/5차/release4c-admin-operations.md | 1364 | BDD3FBB3FD25914F6DDF6CDE1FD54DA8252DDABB64782CB8341D8E6F60B4B9E2 |
| docs/5차/release4c-baseline-revalidation.md | 2607 | 59465B5863134FD3175DB0124350A202733C30AF7EB4B2D4D470D2FC2E35D69E |
| docs/5차/release4c-catalog-review-worklist.md | 471 | 19F4AC8DB9588B475373142AE678CF233803A4F4605A2B83CBFAA5F12530BD24 |
| docs/5차/release4c-coverage-applicability.md | 475 | 89BFAAA25BC0D5F94F052A395B3AD175234ECA54735AB6ECD54753A69831F114 |
| docs/5차/release4c-development-completion-report.md | 1233 | A9ECCFFACE21DE37988B1F5025450D734CECAF09EB33957CC4B1BCDC5CF4783E |
| docs/5차/release4c-independent-implementation-audit.md | 4151 | 7502FE11C1BB98C7242E9A123715BAE031DA21C129870E128D8094A0D789D035 |
| docs/5차/release4c-known-limitations.md | 1592 | 4EA95045078252FFA739B8D9C18140875A780207B871824314E3A1C35E20D01B |
| docs/5차/release4c-local-staging-evidence.md | 1845 | 5CF36DBDC98389F05A68D1E723A40246194BED58BE065169EDB479D92952F5D3 |
| docs/5차/release4c-p0-p1-fix-report.md | 2063 | 2E75B173360462CCCF2F77270A51F53F26E4DC823FCDC2A05D47164AEA7B1587 |
| docs/5차/release4c-product-evaluation.md | 1092 | DD78628957E135516F8FE65B499A261E8F9584AF705CE4630BF5874B32D27B07 |
| docs/5차/release4c-product-feature-completion.md | 2535 | BFC7E0B3DE9476068BC14C4DA06633B0811872467036465D3971B23F2158B164 |
| docs/5차/release4c-route-accessibility-matrix.md | 1253 | 70188A9074260BB316F7D4FD877E0E6C3D944D12351F95B14BDC48BAD9984BC3 |
| docs/5차/release4c-test-evidence.md | 1308 | 4A6C4EE39287A268A797BF8388BF42DFCECEDB4580325760FA95B53CA90BE8DB |
| docs/5차/release4e-functional-verification.md | 6297 | 84603919A4D9CF03363D4C25FA18D86A06ACE682803E51DB5C466DB759BAFA77 |
| docs/audit/feature-traceability-matrix.md | 6127 | 5AE562FF2D099206AB762C4ADBD448DBC782664469658C1A92E120AAED282B61 |
| docs/operations/product-redesign-development-completion-report-2026-07-15.md | 9973 | B5516F4C61CE00480AFA42011121FD9CD8A9A79E49D3F02C5D102EB420FD9EB0 |
| docs/qa/evidence/latest-release-gate.json | 2692 | 58064911683CFF9F6A7EF3F0EFDB7670849E132E6CEF47423A61D8714D0EF7F6 |
| docs/qa/evidence/latest-release-gate.md | 1237 | 7A6B8B457F1AC4ED71A62CBE0501BF5BFD37B61C1C5833E9DC2F5265173EA585 |
| docs/qa/evidence/release3-production-config-fixture.json | 360 | D6264A1C9062103F83CC91F5EA8A7DCC819F1DE67C501F710C99688E13928ABD |
| docs/qa/evidence/release3-production-config-fixture.md | 604 | 0F900F666B7CCB9E2201C54885ED17041115E992F8012B6E47244B16BA3D07B6 |
| docs/qa/evidence/release3-production-config-gate.json | 7369 | D18601F77D800D0F6A1789860E31F8279B21813EDF3249C7A531ABC1242DB927 |
| docs/qa/evidence/release3-production-config-gate.md | 4886 | 25988A28EE2AD7DFD56BF02966596C28C189291B881A8AD7D69C71EEEC8F164C |
| docs/qa/evidence/release4-apk-inspection.md | 2025 | 2E3505471D43387AADD890D11E9A7B112E969A18A75F8602CA9FCDD468591EF9 |
| docs/qa/evidence/release4-catalog-audit.json | 3333 | A92C455DF79BC5B5DBAE92A1CFC799E696CD0412FB566077B40A95436C58C257 |
| docs/qa/evidence/release4-catalog-baseline.json | 2977 | 2D88BD10149C3FF1004111DC4ED3475DD95391490460DA4A3B20CC3ACD434566 |
| docs/qa/evidence/release4-catalog-performance.json | 466 | 375CD08EA97F8DFBA2D47ECB48754C5D47F784013FF834D826BEE91ADF032617 |
| docs/qa/evidence/release4-database-verification.json | 1078 | 05E5CC81F0EBB4E73FC2A66F8C17EC34E351654A9ECF60DC34AF8F7877A90798 |
| docs/qa/evidence/release4-enhancement-manifest.json | 3992 | 07ADDE68F3FE89EA31D1395E2EB6F83993BD77EA362122318C91C13E0C9C5E60 |
| docs/qa/evidence/release4-enhancement-preexisting-working-tree.txt | 5407 | 2F5975F5702266501693104A1446CD45F2747A9B21185E2F6CEA77F3373419A5 |
| docs/qa/evidence/release4-production-contamination.json | 3716 | CF78B0BDDFEF03BA6DE3B626B261CC728CFC1300C93E153E936051A019158FAB |
| docs/qa/evidence/release4-production-export-contamination.json | 3078 | F8F1D7B0AE504BC11CBC89C6D6C0C87D856970027951EA1B31520693D398A813 |
| docs/qa/evidence/release4-provenance-preflight.md | 24896 | B9697B4605B09AFFDD4D9AA24E8C84CB94077F23DBADC174209E98F0D35F08AB |
| docs/qa/evidence/release4-report-v2-evidence.md | 1930 | D1C4DF39FF747392214A55CCB0A241FD9B906D39B1B723E66692B48D750FF31C |
| docs/qa/evidence/release4-responsive-accessibility.md | 1568 | 27C746D2BEE78D1ED77F11AE7A1E96E56EC7549D849A2341E3514082E11B77F2 |
| docs/qa/evidence/release4-ui-route-inventory.json | 44194 | 648B1FBD65D2712801E9C2BD647CE276674166AFD83897872995D6074F9CF194 |
| docs/qa/evidence/release4c-catalog-review-inventory.json | 1067911 | 085C2D4A15DBCAD01539E7D16681B393CF3B8EB90A71F0B3B0A9944B17251B35 |
| docs/qa/evidence/release4c-coverage-matrix.json | 955540 | 7CC87BFF64080C7652CCFF0C97C80AEF4F8645A2031A1EE6799EA02F585D0D90 |
| docs/qa/evidence/release4c-findings.json | 16072 | FD2544F34BD3E0B9C387CC79665B896476530ADBE21ED1B0AEE890C4294C5121 |
| docs/qa/evidence/release4c-instruction-chain.md | 5023 | D942BAC042705D7CCDA66D4264AD5E6A3620BC0B8F44B6623F262E821CAF962F |
| docs/qa/evidence/release4c-manifest.json | 18766 | 6C892C671B6556000CF9FF67892459E318DB092B23551598C3B412401A36D09E |
| docs/qa/evidence/release4c-persona-evals.json | 78247 | 4948D27EC6D390C0C91397615240804D681332DF5770D5915F40970AAD62E361 |
| docs/qa/evidence/release4c-provenance-preflight.md | 38535 | 7713150BFA798B76FD81EEE93902DD7BCCF307BABDDC5592BDC1B338547DD45C |
| docs/qa/evidence/release4c-start-diff-stat.txt | 5287 | 8A8E7B414BAFCAFE0CAE6D33497824D1ECA353D2D298D122F788880263547E69 |
| docs/qa/evidence/release4c-start-status.txt | 24418 | 77FB00F00BB4FEFE41FB0CF8BFBF2D5C198F5A0F1078542E453F721858DCD2DF |
| docs/qa/evidence/release4e-aim-traceability.json | 9968 | 0C208512389537AAD82ADABAECA5BB4F4D1575AE4CFF227D11781F0FB5394F6B |
| docs/qa/evidence/release4e-findings.json | 8745 | 7EA21B5806D45503A7A3A516F706EC6876A2489F1780E0419882BA4744FBE5D6 |
| docs/qa/evidence/release4e-manifest.json | 1875 | 20C6859DE77E987C9980F880752A799B2A0F54C63D54A80F60813D36CB06A37E |
| docs/qa/evidence/release4e-provenance-preflight.md | 49559 | B615087E761F1F7CF07E22DF86BFD77BD553F8A9C3F10EB51A319A56285546A6 |
| docs/qa/evidence/release4e-security-audit.json | 350 | 51CD13775CBB9D721C5DBB260B394B9A0897B334EBB0D640D683CFA1165C80D9 |
| docs/qa/evidence/release4e-test-evidence.json | 5086 | 4F9EE6DC49E2DFD020E180A80EA5831074EDEB10725C63692165240F29FB3369 |
| docs/qa/evidence/release4f-admin-browser-evidence.json | 1694 | 932473F155D90917B15765E4462D0C1AA92A965061DCA40C751124AE7B10592C |
| docs/qa/evidence/release4f-aim-traceability.json | 8748 | AADDEE848D7127A4F8713AE868B70A6D2C30C2E9604B659BA55CD8AA66E7893A |
| docs/qa/evidence/release4f-build-provenance.json | 1842 | 8697162A71A28256CE2ED5F334155B9B7165EA5F0765C08628C57D009AA6110D |
| docs/qa/evidence/release4f-dependency-risk.json | 6124 | 949CDBEC0117A51AB63B019F67E94712AC17F3288A86AA9E9F8B4923A8671FE4 |
| docs/qa/evidence/release4f-file-ownership.json | 825 | F20E31C5A835385A7A3F6250A88B5DD7BA9E078AB8DE7B70D4901C4824EC8C1E |
| docs/qa/evidence/release4f-findings.json | 6686 | 84E55A28D6DA0B6C3432D8DF4575A5029E725DF3A4AEEF0AF31468D77CC8F603 |
| docs/qa/evidence/release4f-manifest.json | 2093 | 68ED7E5A61AEAFADAA20F4CFA6A4706330B518A7C3324D28979B59C5864D00DB |
| docs/qa/evidence/release4f-offline-state-machine.json | 2081 | 764F1441C00808E33EC1162A37F98709AB05DD93182626F5A91B11FE8C587363 |
| docs/qa/evidence/release4f-report-traceability.json | 1961 | 4BC2C2A43C56DFAC89AB18F344BDBE234042CD583377F93FD187EB19E83ED11A |
| docs/qa/evidence/release4f-sqlite-upgrade-evidence.json | 1595 | 294C3219D1F072F0A5F1448D8EC1B6D8954555EAA1C63A8D0463BD6DFC140A3C |
| docs/qa/evidence/release4f-test-evidence.json | 5195 | AB6383B888CC8EC530B6638DE49E613A94EAF40F32CDCC351EFE26AA6DD8B5A3 |
| docs/qa/evidence/release4g-admin-browser-evidence.json | 1527 | 29098D965965BB8625932CAF593B304AEA6DFBA55CE0F61F4814461DFABD745F |
| docs/qa/evidence/release4g-aim-traceability.json | 7239 | 3E59ADD82CF5E9F0CC0E93964B28F59D051F6E99924841B917361DD85260EDDC |
| docs/qa/evidence/release4g-build-provenance.json | 2667 | 7F1C396C66360F33C01CEA96E6679AA55D4D68973ED2B9793A6102BA4351E462 |
| docs/qa/evidence/release4g-file-ownership.json | 4294 | 137D57DD51600B9B6DB82616BB5BFE4CDA39D52927B2FF120F95681262C15734 |
| docs/qa/evidence/release4g-findings.json | 8131 | 32EBEA4BF1FDAE241E4CD8F754BE93465D1D2CC3BF2A231ED182204D8C45CC59 |
| docs/qa/evidence/release4g-golden-missions.json | 2032 | 90E1AF1AB4C0075F6120AFAB57E27D71C31B9333C0C2DB2C2E9B498C7E23DBF8 |
| docs/qa/evidence/release4g-manifest.json | 2718 | 2939BDB1C8ACDC27612F1A47031E74A1FCA86464389B9E98194211B2F58678EA |
| docs/qa/evidence/release4g-mobile-state-matrix.json | 1663 | 4F38F0F58A9C2B556B9DADA8F518FF1D9B63F5958C6F30504AB6BC4E2BBE99D1 |
| docs/qa/evidence/release4g-offline-recovery.json | 1158 | A814E50D389FB404F83B40D9C26D79C6351EC7DDBC09927C015EE6C0D6EEE7B8 |
| docs/qa/evidence/release4g-report-consistency.json | 1384 | 7C7AAE100B8F45D3B0A25DE649ABD5E24535797313C993225D12F461E878252B |
| docs/qa/evidence/release4g-test-evidence.json | 4362 | 7E0EB6484930CB972655B2CA63B97F2121A4B8DBAED3452C57123D7052339808 |
| docs/qa/evidence/release4h-admin-browser-evidence.json | 1503 | D10F829DB7EF3CEC238637C86D405689BBF03F2BAD9CBA3E045BF5F8299F5E4B |
| docs/qa/evidence/release4h-aim-traceability.json | 8620 | C38592F817826C9CF0DFC925C1539F2D53C54F62936B5CC619A0FF36C411CB28 |
| docs/qa/evidence/release4h-build-provenance.json | 2042 | DC663543487031A72BE97579F283ACEC1D7681BFF5B0F7E85059986A24DE4355 |
| docs/qa/evidence/release4h-collaboration-events.json | 972 | 852223EF6C6FC9DCB2F040202A322C29BFFC5D417A2E3445E116D1E0C544D8C6 |
| docs/qa/evidence/release4h-dependency-delta.json | 2117 | 6BF31EDC559B59F5E684CFED1150BE520C3F65B31E41E68F59D91B29C31354AB |
| docs/qa/evidence/release4h-file-ownership.json | 4166 | C33961DFB52FB39DE3D6ED8D7EC417BA416A42E0ED2C58EF0726E404AAD2790F |
| docs/qa/evidence/release4h-findings.json | 7440 | 7DDCA1AF39CA0189BAA6C675B09808558374B7569C2639563A2F061C7A774E2A |
| docs/qa/evidence/release4h-local-staging-faults.json | 2687 | BF5A600A6CBAFC1280C8A2A2BF09438C6E1BDB893006CFF214FA3F31CB4F8B5F |
| docs/qa/evidence/release4h-manifest.json | 3698 | 64B7EE79DCC0A76EF0A5B3917EBFE0E6AE88D4BAD5A0C415545E5E655953BDE5 |
| docs/qa/evidence/release4h-native-artifact-audit.json | 2356 | 72926359A6B191C76AF2A1CCC26F50F813F5CAAF36FA8B8504C9CCF08037BDF1 |
| docs/qa/evidence/release4h-navigation-restore.json | 1057 | 0C06C740A5C4DB0CC9CBE87626876E0785E1B1E39953A2CC741B7164FE3E216F |
| docs/qa/evidence/release4h-notification-pipeline.json | 1113 | E6FD5D58BE63507BAA340027C65A257D79774BC06CE904DFAF72DCD633CA1A0B |
| docs/qa/evidence/release4h-query-budget.json | 1639 | 9B85A94924F8579F0633C434F1CA04A4D1594E2557AA9242CEF4BFE21C185CB1 |
| docs/qa/evidence/release4h-route-contract-closure.json | 1421 | 5ABAA53F88C19FA0FB6D9647F6119B7CC663B48D99A76F4D84F9FE2BD0A88398 |
| docs/qa/evidence/release4h-scheduler-evidence.json | 903 | BA26A67BDD867D42E92EA572D66B507D7D0EE32F48DABAA27BD556855FBA5259 |
| docs/qa/evidence/release4h-test-evidence.json | 3566 | D01469C0D9F2B530A6A93FCC00DCA377549B579CE72B0CC81BB9B28B43640A6F |
| docs/qa/evidence/release4i-admin-browser-evidence.json | 601 | A30A6345435B11E263B7CAE6BA4901AB7E60E95065562ED3579F8EB116B17E24 |
| docs/qa/evidence/release4i-aim-traceability.json | 4778 | B623AB91E23D7C67B359E8F3EE71A964CDF347497700EF748DF2C8D94CA69AA2 |
| docs/qa/evidence/release4i-build-provenance.json | 1459 | FCB0FD6AA92A056F4309ED022ECDB608FDE23C623EBED5BA502D2C7AE1BD55D3 |
| docs/qa/evidence/release4i-file-ownership.json | 5302 | 5EA18891D635F8F35B0267CA9E12C1CD0E8BEE8188DC8C3B4FDB952803B41D6E |
| docs/qa/evidence/release4i-findings.json | 4492 | BCB414FAB37D0AFAAB4723F3E8E5AFD8AD170311BFA43BB11CCA6D6306176037 |
| docs/qa/evidence/release4i-import-object-consistency.json | 994 | 2369C8DAD31777A99B8EBF29A2338F9523DB38551AFFAA35FF83A817FE23195F |
| docs/qa/evidence/release4i-local-rc-mission.json | 717 | 65EC269C3518397E031812ABC6BF5C946E5E9B89447939846AAC6DA037BB3310 |
| docs/qa/evidence/release4i-local-staging-faults.json | 1006 | A9C5A9AC67C82933C89D7CD688C0173DF0233423576891F5D94BB04259F865FF |
| docs/qa/evidence/release4i-manifest.json | 1987 | 8F6FA2B91A2F41796567E482CD8B6E62E347659B3D0F7D1B3B5E2CFC7C56AEF5 |
| docs/qa/evidence/release4i-native-artifact-audit.json | 1939 | 642C832E0A0436B9F3A78A7A3385B95CA402A283991680411CD079180CCA51B9 |
| docs/qa/evidence/release4i-operations-dashboard.json | 942 | 207D633A6069DCC2E9DD0AF81E134DB923A8E7FB2EC560202D0060AB942BF2BF |
| docs/qa/evidence/release4i-orphan-reconciliation.json | 501 | 63D5FB3B99A3FC0A7D36FB3E91DEBE1FCE7302FCD83E0548C05E240031714F6A |
| docs/qa/evidence/release4i-publisher-reconciliation.json | 603 | E33CE03640DF8030BF1612627C6303B979B64EF9D625FC108A5A4B6312A3E612 |
| docs/qa/evidence/release4i-query-budget.json | 813 | 1B477B541D35F10C248B13EF5F0680C787E753D540725EFA97FC28B160982980 |
| docs/qa/evidence/release4i-remote-config-convergence.json | 964 | 2AACDCEBF7FE3332928250EF24B393BEA9857D0971A6AA735E3EEB8BDE39D166 |
| docs/qa/evidence/release4i-source-snapshot.json | 58763 | 05E33492D648AEA324660F4DD01DA46EE45D7D630A2C3A0B1E435CEA823D5682 |
| docs/qa/evidence/release4i-test-evidence.json | 2056 | E86825855A459A0A478E0AE99BAE20D5665D4FDBCD4483EC6CBCCF39CFB0273C |
| docs/qa/evidence/release4i-worker-recovery.json | 667 | 43AF0D8E5CB07FAE9E1A9E6EBB864B3BF72DD7F2842370CFDD7915A674F61507 |
| docs/qa/evidence/release5-source-snapshot.json | 113300 | 11B19653D2318B392D92C6FFAEF6C1929FA3375EE357B08253E8CA25A7DA03E9 |
| docs/qa/evidence/release5f-external-staging-readiness.json | 2094 | B323EE2B1D5B8267CFB40FBB295DD87960D9CF9CA950B2A900AAD854732F19F9 |
| docs/runbooks/release4c-migration-restore-rollback.md | 2376 | 2C788324BD250E923614B55D06625A87A62D4A8C939F6F42E698B3206EC4EF29 |
| infra/docker/admin.Dockerfile | 491 | 58FDA13E5A78367168346BF278F2A4C4EB5851AB34356B18B7CA0989A7437F49 |
| infra/docker/api.Dockerfile | 557 | 06A648ADA439600F99677B7490A13BF385025759BAFF4D1EE31E343D02994A92 |
| infra/docker/docker-compose.release4c.yml | 905 | 42476BCA9855EC7264F924B79C6AB494B93059C598A28A602F692C1B058496BB |
| infra/docker/docker-compose.yml | 3709 | 224EC8A78CAAC70C35DBBADAED4E9A2E696782E5B9C4001CA6218F3D49E680E6 |
| infra/docker/publisher.Dockerfile | 550 | A7B7115D8CCD9FF6EE12352F053990377DE44DF2EE67E26415071BD8F61444E2 |
| infra/docker/worker.Dockerfile | 547 | 33874AE4239D76BCF5C4E485ED6B3F666975999191A8CFEEF88834D040BB585D |
| package.json | 4096 | 0D2FB46B4589A3591E12CFA57C799CD9C4D78D3754F2017A9E0A55410A295D3F |
| packages/config/src/release.test.ts | 3719 | 40DF5FADA3129D527167F58D6D94867B1DB4376F3903C1F20E7A3A6FE7C9347C |
| packages/config/src/release.ts | 7410 | 6B1DC43A47B2090F06D8325426200B588390E5214C52C35F1FF7E817F4832B8A |
| packages/contracts/src/index.ts | 213 | 6CA81EF318BB89B2A7652E7E2F415695F6AB6CF7197F5612A4B91F6039F7A1BC |
| packages/contracts/src/release3.ts | 2915 | ABAD8E02CCA5AF2447F4F228328B89D1F4CA22948FC9FAA4CD3E0D21187CFEC1 |
| packages/contracts/src/release4-reports.test.ts | 3425 | 3651C25B984453748B91F5C738380BEAC6A0CB0D449A2F9304B10505841C48E0 |
| packages/contracts/src/release4-reports.ts | 9640 | E7417B543929350074F7DB61D8FE1A24B5688AEC10A7DCC9DEE90EF9DEF5FC8F |
| packages/contracts/src/release4.test.ts | 976 | DBA265C48C44FB9DE05278715DCD2D3CF188E317929AD657F4490E5E579C4537 |
| packages/contracts/src/release4.ts | 5099 | 1FDDC1920F0EFB016125AAE3E1EDEC90CABDB2EA7A1D8D63F608C786528CDDB3 |
| packages/contracts/src/release5.ts | 4866 | 7BF0FBDFEFCAB606BE6A584A6CD8B0CBD75A6F622955144496C61B2BECE080CD |
| packages/domain/src/duplicate-purchase.test.ts | 2079 | 16A68BD9B169AC39F1FC8F864B8C998AA43D882BBAC8FCBBD8AFD9AE951EA182 |
| packages/domain/src/duplicate-purchase.ts | 1298 | 3C999633E09785953BBE463A58449B109A0DBDCE84A0704C28F0130985E4D5A2 |
| packages/domain/src/enums.test.ts | 1750 | D96F435E1C624CD090DAEB8F89266ED3905B9553BCF03A52AE928B8FB4A644EF |
| packages/domain/src/enums.ts | 2280 | 79695CAFCFB8F1E133D3DC694C942095C329A2384DF64ABDC9B8C656698B45A3 |
| packages/domain/src/index.ts | 370 | 254DE4D0929B538E6E43FDB8E21B644A8BA5B297877C20A945F442033AF66AA1 |
| packages/domain/src/preparation-lifecycle.test.ts | 3831 | 8AD4FC24461B3D52AB4637468BF250256A01A1D27C2B583459485D354C9CAFCC |
| packages/domain/src/preparation-lifecycle.ts | 9385 | 23C579296CC1E85CAC0C5739F9EC791A404F59AD8B53070AB746BC08B564C76C |
| packages/domain/src/preparation-temporal.test.ts | 1927 | 027394F58E166E805AF1E89845657E8E1FCFE55DFD021112D8FF5A36434BCDBC |
| packages/domain/src/preparation-temporal.ts | 1447 | 5AA21E276DCC5034C77B926F62ED721BEF531319F29F802B97587809C9284771 |
| packages/domain/src/release4-catalog.test.ts | 1679 | BA0AEB6D4B8564E3339FBF37BD552A5D7E62583D91542815443008E6BCBEEDB3 |
| packages/domain/src/release4-catalog.ts | 39985 | A9B6B6339F33B91F9EA1E832BAA1D062A98EB67D540CBEB9152BE9CE10C374C8 |
| packages/domain/src/release4c-personas.test.ts | 1338 | B67956B2890039CEEF85613917780B6A0045860FFD576929931E02EEA9FBDB5E |
| packages/domain/src/release4c-personas.ts | 5594 | 6FA4B02205CBE20B09F21CDAACD9EA0A033B4FD86036D942DDAE71DC9DBA5F59 |
| packages/domain/src/release5.test.ts | 3386 | BA7E2BFEB757E98699B04A5659FDC5896FEB64C76D3625C4A6ABA425965C0159 |
| packages/domain/src/release5.ts | 6826 | 2C93AD021E95C48A28B3E64F68970879386C1C0009F75537D718425444FC7183 |
| packages/domain/src/report-v3-state.test.ts | 977 | BE42E8079A769AE30766C6F0CC30057DF20F506976161118516D379750DACBCD |
| packages/domain/src/report-v3-state.ts | 764 | 7D69301ED97C6675C2B25DF39C97E8C881A61EC392C93E9C39159EAD0DB0F2B6 |
| packages/test-utils/src/release-gate-runner.test.ts | 2329 | ECFEF1A8799F1A6200850D19A1FB157BEA081ACF8187FCDC90217763F1D86DF3 |
| packages/test-utils/src/release-readiness.test.ts | 6583 | 3FDF727C4EF41AA64D38E0CFA1F45160AD57FE9E5A0BEF0E56851545A087B5EB |
| pnpm-lock.yaml | 477475 | D1F04462275EEA5BAE9E118CA98F0A74EBCD27C15A273FB086446D64A54A350D |
| pnpm-workspace.yaml | 802 | 6B51EA7A43BB4ADDD98505B01218505A81BC78421085B95248555E08A22BF595 |
| scripts/build-android-aab.ts | 4488 | 5663CC3D185EC91CDE2559DA501ED8107505F4A82817C6DF6A8E8C7E08792F66 |
| scripts/build-android-apk.ts | 10692 | 1509EC1ABFF9C0F79898279FB35300923FF053C26EF7796978F40130508EC237 |
| scripts/build-api.ts | 2561 | 6043B0B55EE18E19D9BF476D8A54C355B908D6DF9D6EE00F84C1CA635C0E9DFC |
| scripts/db.ts | 8818 | 6C680D50551946AAAD4F83923ECC988F642A5B5B3D9D9C37A213A1055391ED7D |
| scripts/generate-release4c-file-ownership.ts | 4959 | 0FB75A5DAC3EC3C6E7BFF51855EE95FC82FBB4029D80C051AC01081C0EBA65EC |
| scripts/generate-release4c-manifest.ts | 8652 | 5AC3D291417078F03C95771B2DEB2E428608A78F9E43289522EABA3977201AA7 |
| scripts/generate-release4c-persona-evals.ts | 5075 | 3541F98A63735B610681AC0BF53A94FF3EE500EC20FEC1A14F59303F6A278364 |
| scripts/generate-release4c-route-scenarios.ts | 9572 | 09424429E2E019133707FB43A7FC2B3B0D1E9BBEE59C7D86DEF08ED1DC3CD136 |
| scripts/generate-release4e-ownership.ts | 8054 | 3597521B806D94A0EF8C558BA7D14B255FEF7589275A415735255C129A5835C3 |
| scripts/generate-release4f-ownership.ts | 3338 | 1787278E0BF8969EB05630501266CA055700C8F5C3CE6D10DE4C0D0230E785E3 |
| scripts/generate-release4i-source-snapshot.ts | 4620 | A15DD8050D47641800FC7E848DA4ACED6861CDAF94E799CEC312DE2109CD9E90 |
| scripts/generate-release5-evidence.ts | 23081 | B82D7631A321A449E4A5547AD74B012BF7619C512671B3824F9981FBEB7B21F6 |
| scripts/generate-release5-source-snapshot.ts | 3904 | 1E3B3866732234028DB6A2031BC86DC48B1D7FB21B124B33361249F7293980B6 |
| scripts/measure-release4-catalog-performance.ts | 3054 | F9831EF1CCAB8FA7509D41BE90C0C8C8FDCDD2CC8D7C6DCF56B7EEC1666B6990 |
| scripts/pixel-lock/android-pixel-lock.ts | 34241 | 566B079020D76B6F1EAF1301FA01752B6AD61E66A44A81BC3B2213F9CD8C376C |
| scripts/pixel-lock/build-pixel-apk.ts | 6487 | AA831F60C084A2CE7527BA6A4483C03E2317A32D7A3E8658266F645C35790B29 |
| scripts/release-gate.ts | 12000 | 280F78F8EBCDD38AC49B11BEF7809F45231CA56C33DB56CAF40B031C399D71B8 |
| scripts/release4i-minio-fault.ps1 | 1397 | C1DC750C930752F6B6C4F1AF899D0A725478611399D729B83DC747DCEF43DE23 |
| scripts/release4i-notification-ack-fault.ps1 | 2809 | 254A22DF5264EF4247D915CB9454EA607944EF976D07607C656AB8F8CE8609CC |
| scripts/release5-external-readiness.ts | 3017 | AF41B5324BEB0A39F979772DD433FE0DA14151D9E7D16D52E7107AF2BBBF5E1E |
| scripts/run-catalog-audit.ts | 673 | C77564B32D2A245027CD6CD0584F246DA973E0EB5ECCA08E8B6779C112EC96DB |
| scripts/ux-contract.ts | 9384 | A969EFDB007366B7785170247BA0C02816E744ABB0E504A3149C20ABFF867D42 |
| scripts/verify-release4-contamination.ts | 4961 | 929E298369FFB91763CD0EB103226DC44D0B9B594267727E12C01F178B44D45B |
| scripts/verify-release4-databases.ts | 10694 | 36C81B2D7D653F5E512DEFF866D4812140D6693167C0418DF635043099ADD95A |
| scripts/verify-release4-production-export.ts | 2563 | 8E7DB4DEA7C87424C7589C4BA296002580D17A5E41D3B637F9072EA54152E9E0 |

## Remotes (read-only capture)

```text
origin	https://github.com/ggbu75769-dot/WooriAI.git (fetch)
origin	https://github.com/ggbu75769-dot/WooriAI.git (push)
```

No checkout, reset, clean, staging, commit, push, deploy, store upload, or remote write was performed by this capture.
