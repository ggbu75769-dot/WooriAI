# Release 4 provenance preflight

Generated: 2026-07-16T15:13:56.384Z
Branch: codex/sprint2-catalog-payments
HEAD: db7a7a455afec892b8fa1205e477dbe507a5931d
Upstream: NONE

## Protected pre-existing working tree

The following dirty/untracked paths existed before this provenance evidence was generated. The generator itself and this output file are excluded.

```text
M apps/admin/app/page.tsx
 M apps/admin/src/admin-cms-pages.test.ts
 M apps/admin/src/admin-cms.test.ts
 M apps/admin/src/components/AdminShell.tsx
 M apps/admin/src/lib/admin-api.ts
 M apps/api/package.json
 M apps/api/prisma/schema.prisma
 M apps/api/prisma/seed.ts
 M apps/api/scripts/catalog.ts
 M apps/api/src/app-config/app-config.service.ts
 M apps/api/src/app.module.ts
 M apps/api/src/auth/auth.module.ts
 M apps/api/src/common/filters/global-exception.filter.ts
 M apps/api/src/finance/dto/expense.dto.ts
 M apps/api/src/finance/expense-snapshot.ts
 M apps/api/src/finance/finance.module.ts
 M apps/api/src/jobs/job-handlers.service.ts
 M apps/api/src/jobs/jobs.module.ts
 M apps/api/src/legal/legal.service.ts
 M apps/api/src/onboarding/dto/upsert-consents.dto.ts
 M apps/api/src/onboarding/onboarding-store.service.ts
 M apps/api/test/onboarding.e2e.test.ts
 M apps/api/test/release3-app-config.e2e.test.ts
 M apps/api/test/release3-phase4.e2e.test.ts
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
 M apps/mobile/src/android-native-ui-quality.test.ts
 M apps/mobile/src/android-standalone-apk.test.ts
 M apps/mobile/src/api/client.ts
 M apps/mobile/src/api/local-backend.ts
 M apps/mobile/src/api/local-fixtures.ts
 M apps/mobile/src/auth/complete-oauth-login.ts
 M apps/mobile/src/categories.ts
 M apps/mobile/src/child-profile-manual-stage-and-date-guard.test.ts
 M apps/mobile/src/local-backend.test.ts
 M apps/mobile/src/offline/backoff.test.ts
 M apps/mobile/src/offline/backoff.ts
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
 M packages/domain/src/enums.test.ts
 M packages/domain/src/enums.ts
 M packages/domain/src/index.ts
 M packages/test-utils/src/release-gate-runner.test.ts
 M packages/test-utils/src/release-readiness.test.ts
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
?? apps/api/scripts/release4c-evidence.ts
?? apps/api/src/auth/providers/mock-kakao-oauth-provider.adapter.test.ts
?? apps/api/src/auth/providers/mock-kakao-oauth-provider.adapter.ts
?? apps/api/src/catalog-v2/admin-catalog-v2.controller.ts
?? apps/api/src/catalog-v2/catalog-import-file-parser.test.ts
?? apps/api/src/catalog-v2/catalog-import-file-parser.ts
?? apps/api/src/catalog-v2/catalog-v2.controller.ts
?? apps/api/src/catalog-v2/catalog-v2.module.ts
?? apps/api/src/catalog-v2/catalog-v2.service.ts
?? apps/api/src/catalog-v2/dto/catalog-v2.dto.ts
?? apps/api/src/finance/dto/reports-v2.dto.ts
?? apps/api/src/finance/reports-v2.controller.ts
?? apps/api/src/finance/reports-v2.service.ts
?? apps/api/src/legal/legal-document-policy.test.ts
?? apps/api/src/legal/legal-document-policy.ts
?? apps/api/src/notifications/dto/notifications.dto.ts
?? apps/api/src/notifications/notifications.controller.ts
?? apps/api/src/notifications/notifications.module.ts
?? apps/api/src/notifications/notifications.service.ts
?? apps/api/test/catalog-v2-admin.e2e.test.ts
?? apps/api/test/catalog-v2.e2e.test.ts
?? apps/api/test/notifications.e2e.test.ts
?? apps/api/test/release4-catalog.test.ts
?? apps/api/test/reports-v2.e2e.test.ts
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
?? apps/mobile/src/notifications/route.test.ts
?? apps/mobile/src/notifications/route.ts
?? apps/mobile/src/offline/expense-payload.test.ts
?? apps/mobile/src/offline/expense-payload.ts
?? apps/mobile/src/offline/session-scope.test.ts
?? apps/mobile/src/offline/session-scope.ts
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
?? apps/mobile/src/reports/period-aggregation.test.ts
?? apps/mobile/src/reports/period-aggregation.ts
?? apps/mobile/src/reports/request-plan.test.ts
?? apps/mobile/src/reports/request-plan.ts
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
?? docs/qa/evidence/release4e-security-audit.json
?? docs/runbooks/release4c-migration-restore-rollback.md
?? infra/docker/docker-compose.release4c.yml
?? packages/contracts/src/release4-reports.test.ts
?? packages/contracts/src/release4-reports.ts
?? packages/contracts/src/release4.test.ts
?? packages/contracts/src/release4.ts
?? packages/domain/src/preparation-lifecycle.test.ts
?? packages/domain/src/preparation-lifecycle.ts
?? packages/domain/src/release4-catalog.test.ts
?? packages/domain/src/release4-catalog.ts
?? packages/domain/src/release4c-personas.test.ts
?? packages/domain/src/release4c-personas.ts
?? packages/domain/src/report-v3-state.test.ts
?? packages/domain/src/report-v3-state.ts
?? scripts/generate-release4-provenance.ts
?? scripts/generate-release4c-file-ownership.ts
?? scripts/generate-release4c-manifest.ts
?? scripts/generate-release4c-persona-evals.ts
?? scripts/generate-release4c-route-scenarios.ts
?? scripts/generate-release4e-ownership.ts
?? scripts/measure-release4-catalog-performance.ts
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
| apps/admin/app/catalog/page.tsx | 44899 | 4BC0AB95413A83437DA026715D00B9AAAC2DC5E049DDA66A0A8FC832B0F639E9 |
| apps/admin/src/admin-cms-pages.test.ts | 8748 | C81EC2693FC3C7767C257E0A9F788009ABCFF0B8A4147435E92EDE1DA380CE54 |
| apps/admin/src/admin-cms.test.ts | 1238 | FDF31D9EBFE273543B6794CF942E2281296425B9F71D119FF5BA9E686F424A01 |
| apps/admin/src/admin-home-render.test.tsx | 647 | 6A93C69C73F259A379A9DDCCCA06A1FC0BE6214F29EE9C47517349C4CF438C0D |
| apps/admin/src/components/AdminShell.tsx | 12256 | 942F8CDDC218A692D1F52B04820271CF6E882E50BC6D036232E150E2DAAB726A |
| apps/admin/src/lib/admin-api.ts | 29090 | C6FEEFE82133F37200EA9A2EC714349F164B2FE64FA408E5F6B0BB0A3E58D66E |
| apps/api/package.json | 2342 | E29D6FD950AC04C4BFBA3AA0C37C43430C06907A043A81CE290DFFA578941409 |
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
| apps/api/prisma/schema.prisma | 75994 | F307719D32CFC7DCC644B65901F3F97952608D83C33C68D7110CF6A25B161C52 |
| apps/api/prisma/seed.ts | 27186 | 0128314709DF18683647CC68991D91259FD3EA49E5D2FB02F23B23F87A10C97F |
| apps/api/scripts/catalog.ts | 25196 | D91B34FF5EB3F749EF7506F88C7C3564D2AF55433419B782223214FF72CB39FF |
| apps/api/scripts/release4c-evidence.ts | 11537 | B3037CF27E972993F5D789BD66AFEB48708A07FDF4651A0179A7259FE6AE1C60 |
| apps/api/src/app-config/app-config.service.ts | 2846 | 5C1A4A77E546E68AF61B862F4333387DB7CB33A97F3CC3595DBE19B8F0EE1420 |
| apps/api/src/app.module.ts | 1855 | 3A439F95EE814C5C256AA54379FF6D3B39E17BEBCAE81522408E55A45C4A7285 |
| apps/api/src/auth/auth.module.ts | 1723 | 83981F465A716230098B033C31C3A6942CF32B679B717EBF9F207B19B1554A88 |
| apps/api/src/auth/providers/mock-kakao-oauth-provider.adapter.test.ts | 1153 | 62A1B7DD0E93F71A475162B330A21DC9D6A451B75FE05B9504AE0656B3441009 |
| apps/api/src/auth/providers/mock-kakao-oauth-provider.adapter.ts | 1682 | 3B52F7F80BA9046D1FA6FA27560677B025C3B2D15ABA994C0DE706795756CEEC |
| apps/api/src/catalog-v2/admin-catalog-v2.controller.ts | 17954 | FB88509E5C1093303521CD66A5E000B827C80D2F2EF57D984DBAA8FA49C19DD6 |
| apps/api/src/catalog-v2/catalog-import-file-parser.test.ts | 2204 | 3FE360F957E39FA33F0B0A0E94ACB3167C1FF88749FC3F6E13E76F53D4D60508 |
| apps/api/src/catalog-v2/catalog-import-file-parser.ts | 7456 | 57E4AB9B13E71B1999EE514C587C2174E25A35E354D8E53C302F1CE7325F01F9 |
| apps/api/src/catalog-v2/catalog-v2.controller.ts | 11649 | BB89419E921FB42D64382A263B6BFDD61998D1001855746EF4058E7B4E1C9E00 |
| apps/api/src/catalog-v2/catalog-v2.module.ts | 780 | 45EBC741160E7E950B71422921776171FE6395539ABBBB8E6E376C9865539DDC |
| apps/api/src/catalog-v2/catalog-v2.service.ts | 160978 | DC4606379FD927DF9FAE4335F5DC9A4C13D7956564E1EFD7E1366CF9F4C08B7D |
| apps/api/src/catalog-v2/dto/catalog-v2.dto.ts | 15882 | C3094D66D345A1989AFF76AC42EF57E2EBC80121D5CCD1DC635B09046129A8AC |
| apps/api/src/common/filters/global-exception.filter.ts | 4195 | BD1CD2861ED569FE2E3DA2BDF0280DE7A0E4AAD617C0974FB872B11F954FACCD |
| apps/api/src/finance/dto/expense.dto.ts | 2283 | 53385054A250503EEC9F21A4A12379D6C0AB6371B031E1CC87C20ADF4D7D10EC |
| apps/api/src/finance/dto/reports-v2.dto.ts | 596 | 4CF6CA52C3087F457B914AB39FDC02D8157B366A70D736704265BD35680D975D |
| apps/api/src/finance/expense-snapshot.ts | 1713 | 1F0A87F29A13392666746AF59BD617E695714B2AEE34CD9DE3A92ECAFEC84C77 |
| apps/api/src/finance/finance.module.ts | 1079 | 63DF03ECDEB54B8D822981D0A1F7EB370A83154EEFAB9632D7EFEA0E85E74DCB |
| apps/api/src/finance/reports-v2.controller.ts | 3069 | 55C1767102724C341C5A0772698AE3BED4FF6CE37261AA46CD41FE39FF38FEAE |
| apps/api/src/finance/reports-v2.service.ts | 35262 | 440F5C9367DEFE27ED7BE852E874148D3D7BD5FC6BF5D151DA449AA8FD015498 |
| apps/api/src/jobs/job-handlers.service.ts | 13696 | 65CC849C1400A5FC84709317573CEC2BB70BA3A18AC2C9B354D5F4F9CFF67DCB |
| apps/api/src/jobs/jobs.module.ts | 805 | 7BE27821884F3E94D7F13D443450FA6FDB70181C67138BEF8CA06AAA4870EA60 |
| apps/api/src/legal/legal-document-policy.test.ts | 2134 | 006281779AEA5D2526FBD0DA3560E5CF09ABABAFF62D2F0AE368A951D77A72F2 |
| apps/api/src/legal/legal-document-policy.ts | 2617 | 2892528ECD1CC5F7626E0FE627DBECFA9F5B7F06A032374EFC2D38A4C400C7BF |
| apps/api/src/legal/legal.service.ts | 1891 | 2B8B780DADD86B7B84CDC89D1C55995B33DC61078E2268F795E981D0CF7F9F8C |
| apps/api/src/notifications/dto/notifications.dto.ts | 412 | 760B150097EB5A04F6E844295D99D27244117989FC9E5B1BD2B8341AC80C81FF |
| apps/api/src/notifications/notifications.controller.ts | 1093 | C21A886148C6741CF5A70A399B97084BEB8E7A6066EFE45858C2332CD0A45D0D |
| apps/api/src/notifications/notifications.module.ts | 378 | 1069D8EAD3856288FCFBD950A1DCC5A4E34AE6CD5548C2C66312DD6CD11A4F16 |
| apps/api/src/notifications/notifications.service.ts | 3591 | 4B9DF68B8493C4DBFC5D566ED544D63A789F0BCC92E6B6B8658E1EEF28087E92 |
| apps/api/src/onboarding/dto/upsert-consents.dto.ts | 754 | 79419BC4F934E8E2BDD1F486981054DB45EFB67EEA837FBFC5A824978E17A371 |
| apps/api/src/onboarding/onboarding-store.service.ts | 95728 | B71B35E9E5A67CC139A4EC2F9C6CD0E5D962762C5C64F1CCD93E34328BB5FDD2 |
| apps/api/test/catalog-v2-admin.e2e.test.ts | 35706 | C7C6226079AC4C7FAEAC298CBF0DB69755B17143918FC63520F3F64058A6D4F7 |
| apps/api/test/catalog-v2.e2e.test.ts | 34702 | ED8EFEBE1BE960CD2F3AFFDF24A10F3895DC198F997C32DCD5137D5E5B823A45 |
| apps/api/test/notifications.e2e.test.ts | 3824 | 04E38BAEC0523DB011C6A24FBC9C92DEFD0EF9930188DED73CAE0032D4681F51 |
| apps/api/test/onboarding.e2e.test.ts | 16999 | DA5D6EC795D8C1F1B6A903FAADD221A174E48CC3BC0E8C6E2136DE179D76BAAB |
| apps/api/test/release3-app-config.e2e.test.ts | 2358 | D129F16CDE5E408489CE19AEFC970C63B499FE3C384E6375C995360444DE6EB5 |
| apps/api/test/release3-phase4.e2e.test.ts | 7118 | 80B859C6C0FD97E83E48621775DB712A697B93905846F365CB0457131011EA43 |
| apps/api/test/release4-catalog.test.ts | 3310 | D4B92A4D3BD50439B0EB5A47C3C11496448831AC9DC617F9CC77CB103D49C63F |
| apps/api/test/reports-v2.e2e.test.ts | 15930 | 3DBB03D04C23EB7976E56146C4A2A608217C6837C636D09E206FFD033FEB6C71 |
| apps/mobile/app/(auth)/login.tsx | 14157 | 5DEB4231A01C1A69634C0DFCDCB300A927326D0556297E14C12C5375CD0DDE13 |
| apps/mobile/app/(onboarding)/budget.tsx | 4987 | 1FF197985BEAC3A3FF636DE6E1CD0F6E7BBA735E595FEDA15E134FEBF5F49611 |
| apps/mobile/app/(onboarding)/child-profile.tsx | 9607 | C7403813F1BA43AFC6F60A07F3365CCE3065982A3B4866688057EDD305AAAA0D |
| apps/mobile/app/(onboarding)/child-status.tsx | 4121 | ABB32E9D8E6FDC5DFDC5EB9D2D1AFEEC64347AF892C093106DCF90AD62AA7184 |
| apps/mobile/app/(onboarding)/prepared-items.tsx | 5189 | 40DB95E576A8407E9162E7EDB00D947CE62672EDD99862084D041C08401B5E52 |
| apps/mobile/app/(onboarding)/resume.tsx | 3928 | 1983F2EEBB79D6FA979DE57B4E1790E87AF881307E65233A2681A27109B3F0ED |
| apps/mobile/app/(tabs)/_layout.tsx | 3885 | A88DFFD9EAFA32B368D3E3E1113AB7C7A6C1B02545A5B200EF31AE0D7A342C6D |
| apps/mobile/app/(tabs)/index.tsx | 8919 | B6D59B34787721CC6EF7C8FA04054F5B2A0088292095F6B4E704A3FB17E3BF95 |
| apps/mobile/app/(tabs)/items.tsx | 11067 | 0A4491470B4E107A6877CB15FAC0BAF847EFA87800406D0F861FA1700D1BB622 |
| apps/mobile/app/(tabs)/more.tsx | 6740 | 826C374A0A5032B26DD2064E4BBDBF3FB87EBD85DD8569AB41C3665459FA3048 |
| apps/mobile/app/(tabs)/records.tsx | 14093 | 20F0AE8CF419F3D7F8DD0BBB6A7F853F3F8FE9653AED788E4B98B2E35B3E180C |
| apps/mobile/app/(tabs)/reports.tsx | 35107 | A9C60E1E2D20FD944322AA237D39094BA0AA944B404D42D853869F31E68C80CE |
| apps/mobile/app/_layout.tsx | 2225 | 38096D8021720E08EFEF84E3D0B056C94C524B4BCD0C29692C53D5EF5428BF28 |
| apps/mobile/app/budget.tsx | 5125 | E6ED1C2348737187F1DD4B6A38486AC4083A25DC4EB3C9DB2A2B3EB07E429D13 |
| apps/mobile/app/children/[childId].tsx | 4633 | 8A9BB3B1BB12CCA45850D001BD2A8891B1A6C1C4F010992383FC6781C59DEF59 |
| apps/mobile/app/children/index.tsx | 4232 | 15340B7066201DFD7B64A8B9246E507F0AF5C4654DC954E1B2894E7DFABA4D1F |
| apps/mobile/app/children/new.tsx | 3757 | D17090B3B913623D39040F3F66E7B66A7031356630A2253F1FC0F9A1F1E53E0B |
| apps/mobile/app/expenses/[expenseId].tsx | 22989 | B480EADE996BC89F53CE3E5F74B5929CEE233D1F7F483F2F002A1A4F09E5A609 |
| apps/mobile/app/expenses/new.tsx | 29705 | F8EC16A1AACE20EEBA560C4DA9BB6118BBF4C38F9FAFE5BBBCEC9C02C5C25033 |
| apps/mobile/app/family/accept/[token].tsx | 4469 | F479C46362D5C285E1A93AC9B5443741F0200F7324AE56FC0F74A4D255790917 |
| apps/mobile/app/family/index.tsx | 17931 | EC4740731E7513F72FAEE1A99A92EEBD6F616925115BEEBBBE966B5A557B2695 |
| apps/mobile/app/family/invite.tsx | 5473 | D55B8A074F5B536A4E93DFEBE58A63BFDD393187EE70094F250567557C97F73A |
| apps/mobile/app/import/[importJobId].tsx | 10586 | 891488E99F9C7F267DD132821FEDB80723664E7A6D6D7AAE27A42E291988B5C1 |
| apps/mobile/app/import/index.tsx | 13010 | 1B4EC8D1D14865B63F6C9119E93CE93EA5900B54EE7A6E67C813450EAF09902E |
| apps/mobile/app/index.tsx | 6615 | EAEF7DE335E1941F1C0B3B281445196F1094A7774B20CCF301812A06E3DC85AF |
| apps/mobile/app/items/[itemTemplateId].tsx | 16778 | 01C814DC94027536C91EF7F12D419D86C25DDD4A654F742A8F75041C297A2E7E |
| apps/mobile/app/launch-animation.tsx | 5979 | 6A099E2CED8CA019233DC99F3CD035BD8EBB796E2447DE7B88CBE588A4188EB0 |
| apps/mobile/app/notifications.tsx | 6444 | A8AA09DA11991B98064C1E7AFDEE45B8B5B651C4697922DBEF02B3E220DB66EF |
| apps/mobile/app/payment-methods.tsx | 10227 | ED13EAB9C8B17FFB57F3EC5B7A906EB0DF924E0112D79188EA1B463584D07F67 |
| apps/mobile/app/profile.tsx | 4029 | 8273D7425152ED9E5C588E1FF4FCBF5AF4D377841879FF22225A4B5BDA29CE44 |
| apps/mobile/app/settings/index.tsx | 5207 | 44F99DDA90CD8668DE699DF6DDCF1CCDA367A868B21850EDFACF718E82EEE7A4 |
| apps/mobile/app/settings/privacy.tsx | 12931 | 1F2B3100BF3C7A16B4DFA25771B39DB11DD82C8475767F58F6E0D95856593729 |
| apps/mobile/app/sync-status.tsx | 10218 | 4FBE96C0168AFD80E220A26A2353A47934B8BD4E33E9AC14FAFB279196F97749 |
| apps/mobile/e2e/release4c-route-scenarios.json | 72519 | 92ABADF12E097D87FAE174BA3990D879E2FF8ADC62AB17E8D164F80C406F875B |
| apps/mobile/metro.config.js | 1711 | 078790834539A8407E0AFA113369F849D1D91B3145135FC42ADD4696F8395836 |
| apps/mobile/src/android-native-ui-quality.test.ts | 6976 | 8B06CC52C29AD93A21D215D4921E2ECA63EAF034015946ABEC63679F2A92CE74 |
| apps/mobile/src/android-standalone-apk.test.ts | 4316 | F7D5B2D1AF5D37FB5B50F29071A3A77FB8512C703792EB12B48527BFB14A2939 |
| apps/mobile/src/api/client.ts | 66678 | D73DDBB5A844545D866F3FBC515B4478C817D821C974902BA53F32340D6C094C |
| apps/mobile/src/api/fixture-runtime.production.ts | 967 | 429300C9C678BBBCC76682902125366A72B9CFF25EAC61723C33C3BE09D57F4C |
| apps/mobile/src/api/fixture-runtime.ts | 759 | A136807251BD3079FC447FE9D89E8563B1FDBD41AFC4ED7979EBC8DB9EC9A971 |
| apps/mobile/src/api/local-backend.ts | 122797 | 84218EFBD53CE676350508B1379D9AD5696214063A413252D0EE75DF5AB8D452 |
| apps/mobile/src/api/local-fixtures.ts | 7812 | 6C6BFC36DE85AD346848CD7648DA1F20C54D374997352C35ED51767E4F393741 |
| apps/mobile/src/api/prepared-item-ids.ts | 382 | F572BFEEAF8F8BD97D7877FE63F57039BA2F5B8A8F68D5B6973B67F62BA55848 |
| apps/mobile/src/auth/complete-oauth-login.ts | 935 | 5C894FF9EEEDD2F7B2C504A495E327E67326DA3B2BA1BD6C099B7ED7DC852259 |
| apps/mobile/src/categories.ts | 3688 | B6CE280E57CA0754C7B67886BE9377E05F581E7DFE1273D92BCA3B2251AD17A6 |
| apps/mobile/src/child-profile-manual-stage-and-date-guard.test.ts | 4072 | E3272D5C74F17546972D7060925454792855017973F0058533576CE3DCC77348 |
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
| apps/mobile/src/notifications/route.test.ts | 622 | EB04D3721B0214ECCAAB7DDD77CFB82957A15201EE605A4274C1CF46B0AFFD88 |
| apps/mobile/src/notifications/route.ts | 554 | 574C1C2109E3CEABD2DCFBE1B0463DCEB3D8EED6C682B6FD4A88A47FB3E96A0D |
| apps/mobile/src/offline/backoff.test.ts | 1406 | 70DF7A0C95CA9B4089828DA32F72E00E167AC6062E389758ADF8E1DD1FBCFF3F |
| apps/mobile/src/offline/backoff.ts | 1367 | D210D4C430E75C5D224E9EE719D3D7E5D40EDEE75389835BAB1D215ED41388CE |
| apps/mobile/src/offline/expense-list-reconciliation.test.ts | 5390 | DBBC5A5B0D5991BE8F66C9F8A624CBDBCE8089F0360C00AB16C7A96EC6B14757 |
| apps/mobile/src/offline/expense-payload.test.ts | 1104 | 152E7425CDABAE2D801B2F6B7F42B0C45EDB81BC07C8DA5F57A2E5C5F32DA642 |
| apps/mobile/src/offline/expense-payload.ts | 854 | CB689FB06CC9B12F0D64DA939C710AD5D4011110DDC02DC1245E6F015848DC9E |
| apps/mobile/src/offline/memory-offline-store.ts | 3667 | C55804459EB33281BFFB3EF9B418DF6481410A62ED4BD90C651E7ABE1E7E55BE |
| apps/mobile/src/offline/outbox-merge.test.ts | 4443 | 0CD174BF2C130330F0460E81B5E747FBA893B398402EBE3BB67278D15F460A9B |
| apps/mobile/src/offline/remote-api.ts | 4332 | F2B83AC9320E1CC4803A89315A9FA69E97F6A024230735035A5DA926E53E0052 |
| apps/mobile/src/offline/session-scope.test.ts | 4754 | E2265B30D8B704ECB9D9C683A4D38F85B09FA5B034A45DF03D4E5667119F41F2 |
| apps/mobile/src/offline/session-scope.ts | 835 | 657DD1A33170508944C2AA4A90CD3E63E5872E27482E513BDAFDE215FB845304 |
| apps/mobile/src/offline/sqlite-offline-store.ts | 10804 | AEEACFE8B3B3C667ABA05C83B1AE96698584DC5C3A416A97B716ADCD89E1D258 |
| apps/mobile/src/offline/sync-controller.ts | 16054 | 63FEFEDB170404D20B01F3FDC1866D66CDF5247700F11A33952C9D76CA61BB8C |
| apps/mobile/src/offline/sync-engine.test.ts | 22646 | EBF5455D38A950325C7BA2326E1939B72E6347AB8921DA76B6248EA2F3F56E70 |
| apps/mobile/src/offline/sync-engine.ts | 25011 | C6552A919A9250A3172B3690CD4121D8CA381E8F4DC086C2665C86FA42F9F11B |
| apps/mobile/src/offline/types.ts | 6118 | 9D4D6C318DFD4F436BA3C4BFE7EEEFCEC0E4EBC90660416EE1D30A5B19F20270 |
| apps/mobile/src/onboarding-resume.test.ts | 7534 | 683CA347F5B890C60236FB73D75B8F88C619D4D9B4A08B2A0DE6F15FD1290B57 |
| apps/mobile/src/onboarding/resume.ts | 1057 | 51678315E6C4DFDE7AD850B5815946D483F49E0330DDD2C30FF67F17DC9AA78B |
| apps/mobile/src/preparation/PreparationOverview.tsx | 10115 | 4F80C24689885D3862C01D851D4C98830AEE6AD018B6CE51E1F7CEDF659A8F45 |
| apps/mobile/src/preparation/Release4ItemDetailScreen.tsx | 31550 | 426B2703673B45FA50303E9E4EEFFCF1B8FCAECAC4F1645D2CF2FA6B7E5BCBF9 |
| apps/mobile/src/preparation/Release4PreparationScreen.tsx | 43326 | 5363C0621B8F0F6482BB9C4C472F1C49FE0663997027D06F7E45E8076957F89F |
| apps/mobile/src/preparation/item-plan-form.test.ts | 1872 | BAB90A92D93A7778C9EEA3B10376E4AC74AA195E8D389780DFD083C8D3D886B3 |
| apps/mobile/src/preparation/item-plan-form.ts | 2501 | 352CF185094CE054ED5D7C31827CDFEC7E5CC20D870888CCC97F006E9E357F3F |
| apps/mobile/src/preparation/release4-preparation.test.ts | 10504 | 2E0B692E9AD149F3A5A4B0B7B87913B75F41C3E2C856F873D97DFA8BF6EE6272 |
| apps/mobile/src/production-build-boundary.test.ts | 2407 | DC08D8FA89B263B9926E8CBB773945E6FBBB4ECD8F665C8D9D3A72346FCFA37D |
| apps/mobile/src/query/mutation-invalidation.test.ts | 1504 | AC7A9438F94DF388E4DFC2EB73836C13AB4024CD9E56F83FD042E3A976672528 |
| apps/mobile/src/query/mutation-invalidation.ts | 987 | 26B13ECC0606C4BDA8FC6D6EA0FB3F5DFE8CEB2A124E0293609C7B3DBDF8B956 |
| apps/mobile/src/real-session-data-integrity.test.ts | 4456 | EA3E57F853D9FB218346BCFCDD2ABFE006B0BAD031F3F495001CA8ADA90BF992 |
| apps/mobile/src/release4d-ux-contract.test.ts | 2297 | BA51AD291A29A56BC85632A7FAE154F56F9E9828F2621E2173B53143069EBA38 |
| apps/mobile/src/reports/period-aggregation.test.ts | 1484 | 0FB2B0E5691801FACEA8CC04460865AB7071682F5345C3B8ED560C5EB303F341 |
| apps/mobile/src/reports/period-aggregation.ts | 1583 | 62E937B67B3FB2A480EA5737772429A0D48765BCFCFF84BFFFCB4F1B7EA8156B |
| apps/mobile/src/reports/request-plan.test.ts | 932 | B763A815213A3C34ADFBC0332B66845C401045832F52798938B2768AE09E9366 |
| apps/mobile/src/reports/request-plan.ts | 1334 | 275280916E514B7520A9667142CECD73BB5D12F6F0C0799DB35572226A592342 |
| apps/mobile/src/stores/catalog-search.store.ts | 1334 | DB0D83E1BDCFCF7E666F6B93804985D4BAB23853AD565F1B5941CCA38A08C30A |
| apps/mobile/src/stores/persist-upgrade.test.ts | 15930 | D9386C533F0B724B0524B21BAD782413CA97CF5BF4FD7A2D7B6D347868162634 |
| apps/mobile/src/stores/session-cache-boundary.test.ts | 1329 | 70D3E26C03A689EA09FD1CFBA300C9C83B1FC145DF2A6472D89E4B3F0F95BC3C |
| apps/mobile/src/stores/session-cache-boundary.ts | 211 | 30AE13A803D0D07BA10601EE8A55B6E17D9A0A392226959265377A4F542D1EE9 |
| apps/mobile/src/stores/session.store.ts | 6111 | 7FB8020F8143877570E7F579E413817611749FD46576255713D82EB44E41BCAE |
| apps/mobile/src/test-login-flow.test.ts | 3302 | 258388B806BEE843649CF9C627C9B28BD2FF33AC7AD878DD850A776C9C7015F0 |
| apps/mobile/src/theme.ts | 5548 | D7FFF167CD54E34F5218A20EC0DFE74504A05B37BD7545B17069F56AB15E6C79 |
| apps/mobile/src/ui-pixel-lock-flow.test.ts | 18990 | 5CE06E3BB2C981B88DD46AD18D92193DF0589CABEB5A24F70E39947E8585088A |
| apps/mobile/src/ui.tsx | 27750 | DB04D37900704A17073A1755BB01AF92171CC7237761D819C1221C229AD79C89 |
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
| docs/operations/product-redesign-development-completion-report-2026-07-15.md | 9973 | B5516F4C61CE00480AFA42011121FD9CD8A9A79E49D3F02C5D102EB420FD9EB0 |
| docs/qa/evidence/latest-release-gate.json | 2694 | CAB0436A489CF83BAE416C7C53877B6D92C7C13528A548D990688F0FC514D183 |
| docs/qa/evidence/latest-release-gate.md | 1239 | 1863963B0C5C8A3F18162F0DBFA6355F77EC38671869143F1A609F2AF588D7E3 |
| docs/qa/evidence/release3-production-config-fixture.json | 310 | 431E93207F09BBE219344C68768CCFDCE64411F36D42621AF74672AF9C30ABDC |
| docs/qa/evidence/release3-production-config-fixture.md | 604 | 616212B7773EE9A5CDE0AC90DD49C8337E02187FB9FB8AABC8C684D386ED9058 |
| docs/qa/evidence/release3-production-config-gate.json | 6860 | 355312D9536329A924DCA4FF86073DF40EF3BCC930089B98E97AE471BFD9CF7B |
| docs/qa/evidence/release3-production-config-gate.md | 4607 | DCD3C38D183330ACAF0AABE96104252BE7A10AA7DCC94229C1216D7E838746EA |
| docs/qa/evidence/release4-apk-inspection.md | 2025 | 2E3505471D43387AADD890D11E9A7B112E969A18A75F8602CA9FCDD468591EF9 |
| docs/qa/evidence/release4-catalog-audit.json | 3333 | C70293A728858768BD7AEF9AA2A7078EAB1076F30FEB124330570346D739B6E0 |
| docs/qa/evidence/release4-catalog-baseline.json | 2977 | 2D88BD10149C3FF1004111DC4ED3475DD95391490460DA4A3B20CC3ACD434566 |
| docs/qa/evidence/release4-catalog-performance.json | 466 | 375CD08EA97F8DFBA2D47ECB48754C5D47F784013FF834D826BEE91ADF032617 |
| docs/qa/evidence/release4-database-verification.json | 1080 | 9407C998C980B22167F871846925934D31BB33060AA6376A7DA13AB02809D914 |
| docs/qa/evidence/release4-enhancement-manifest.json | 3992 | 07ADDE68F3FE89EA31D1395E2EB6F83993BD77EA362122318C91C13E0C9C5E60 |
| docs/qa/evidence/release4-enhancement-preexisting-working-tree.txt | 5407 | 2F5975F5702266501693104A1446CD45F2747A9B21185E2F6CEA77F3373419A5 |
| docs/qa/evidence/release4-production-contamination.json | 3716 | E1D18FB75E171C46BE3874BD99CAC516F37F8318125102852D53112DD476B814 |
| docs/qa/evidence/release4-production-export-contamination.json | 3078 | 4B1477A0BA1BD13DEE6415D3FB9E383BF9607CFA1A80D3613C722BC9EBF85311 |
| docs/qa/evidence/release4-provenance-preflight.md | 24896 | B9697B4605B09AFFDD4D9AA24E8C84CB94077F23DBADC174209E98F0D35F08AB |
| docs/qa/evidence/release4-report-v2-evidence.md | 1930 | D1C4DF39FF747392214A55CCB0A241FD9B906D39B1B723E66692B48D750FF31C |
| docs/qa/evidence/release4-responsive-accessibility.md | 1568 | 27C746D2BEE78D1ED77F11AE7A1E96E56EC7549D849A2341E3514082E11B77F2 |
| docs/qa/evidence/release4-ui-route-inventory.json | 43088 | 5B7FACB87DC20A659CCF26F5DE5A42C1A6279CC8C835B9BBB4B3370A468855E1 |
| docs/qa/evidence/release4c-catalog-review-inventory.json | 1067911 | 085C2D4A15DBCAD01539E7D16681B393CF3B8EB90A71F0B3B0A9944B17251B35 |
| docs/qa/evidence/release4c-coverage-matrix.json | 955540 | 7CC87BFF64080C7652CCFF0C97C80AEF4F8645A2031A1EE6799EA02F585D0D90 |
| docs/qa/evidence/release4c-findings.json | 16072 | FD2544F34BD3E0B9C387CC79665B896476530ADBE21ED1B0AEE890C4294C5121 |
| docs/qa/evidence/release4c-instruction-chain.md | 5023 | D942BAC042705D7CCDA66D4264AD5E6A3620BC0B8F44B6623F262E821CAF962F |
| docs/qa/evidence/release4c-manifest.json | 18766 | 6C892C671B6556000CF9FF67892459E318DB092B23551598C3B412401A36D09E |
| docs/qa/evidence/release4c-persona-evals.json | 78247 | 4948D27EC6D390C0C91397615240804D681332DF5770D5915F40970AAD62E361 |
| docs/qa/evidence/release4c-provenance-preflight.md | 38535 | 7713150BFA798B76FD81EEE93902DD7BCCF307BABDDC5592BDC1B338547DD45C |
| docs/qa/evidence/release4c-start-diff-stat.txt | 5287 | 8A8E7B414BAFCAFE0CAE6D33497824D1ECA353D2D298D122F788880263547E69 |
| docs/qa/evidence/release4c-start-status.txt | 24418 | 77FB00F00BB4FEFE41FB0CF8BFBF2D5C198F5A0F1078542E453F721858DCD2DF |
| docs/qa/evidence/release4e-security-audit.json | 350 | 51CD13775CBB9D721C5DBB260B394B9A0897B334EBB0D640D683CFA1165C80D9 |
| docs/runbooks/release4c-migration-restore-rollback.md | 2376 | 2C788324BD250E923614B55D06625A87A62D4A8C939F6F42E698B3206EC4EF29 |
| infra/docker/admin.Dockerfile | 491 | 58FDA13E5A78367168346BF278F2A4C4EB5851AB34356B18B7CA0989A7437F49 |
| infra/docker/api.Dockerfile | 557 | 06A648ADA439600F99677B7490A13BF385025759BAFF4D1EE31E343D02994A92 |
| infra/docker/docker-compose.release4c.yml | 813 | 5B85DDD27240BAAB862A8E858BF5A3F835868451E98758A86D7DAAF9500F6CC5 |
| infra/docker/docker-compose.yml | 3676 | 13A09AEE5D59C817BE726328731E21CF7F167452E28474C0253E4D65CCD21514 |
| infra/docker/publisher.Dockerfile | 550 | A7B7115D8CCD9FF6EE12352F053990377DE44DF2EE67E26415071BD8F61444E2 |
| infra/docker/worker.Dockerfile | 547 | 33874AE4239D76BCF5C4E485ED6B3F666975999191A8CFEEF88834D040BB585D |
| package.json | 3762 | 573647297B1F33AC4824E05671DBC9977CA93E9E8D6E5A1BC498AC893994C027 |
| packages/config/src/release.test.ts | 3612 | 19CBFE6654AE1066E71AE68B14EB87EF4FDCC80A8E796BA89706FCA24BCD43C2 |
| packages/config/src/release.ts | 6919 | 6749C6CB514207A598CB3C4F35F7DB6F7B4554981047A4E01EBA0753BBC2BD65 |
| packages/contracts/src/index.ts | 185 | AF7DAF5DF2F4F99D951F00B1C451378920F3609F94A81529D3E1137B80C534C1 |
| packages/contracts/src/release4-reports.test.ts | 2597 | 5A4BA1D9A62B5947CF2ACCDFE0B49A6B86BA5FC6665F1ED4F7064758C1521B71 |
| packages/contracts/src/release4-reports.ts | 7892 | BE52F3148771B926AD3B08243E33B621238F1153B4601B9A2656FD8FD501449C |
| packages/contracts/src/release4.test.ts | 976 | DBA265C48C44FB9DE05278715DCD2D3CF188E317929AD657F4490E5E579C4537 |
| packages/contracts/src/release4.ts | 5099 | 1FDDC1920F0EFB016125AAE3E1EDEC90CABDB2EA7A1D8D63F608C786528CDDB3 |
| packages/domain/src/enums.test.ts | 1739 | 84F6231818D9A899963FC2A5D6CE1218E542A3993CADF9AA9D549A34F741094B |
| packages/domain/src/enums.ts | 2269 | 58EA74B886899E5E251C6A124C42B6FAF40F12075E29612205FE772FBCB14954 |
| packages/domain/src/index.ts | 264 | 59863B51F3B31B7835C073BC5A3B784F533D7CD3CD09A45872D28F0F732A15F9 |
| packages/domain/src/preparation-lifecycle.test.ts | 3739 | 6CA2DA7E663E84ED6C1D692F36145D31FB85FD2ACF00D25F6B739C9A2A5DF1DA |
| packages/domain/src/preparation-lifecycle.ts | 9385 | 23C579296CC1E85CAC0C5739F9EC791A404F59AD8B53070AB746BC08B564C76C |
| packages/domain/src/release4-catalog.test.ts | 1679 | BA0AEB6D4B8564E3339FBF37BD552A5D7E62583D91542815443008E6BCBEEDB3 |
| packages/domain/src/release4-catalog.ts | 39985 | A9B6B6339F33B91F9EA1E832BAA1D062A98EB67D540CBEB9152BE9CE10C374C8 |
| packages/domain/src/release4c-personas.test.ts | 1338 | B67956B2890039CEEF85613917780B6A0045860FFD576929931E02EEA9FBDB5E |
| packages/domain/src/release4c-personas.ts | 5594 | 6FA4B02205CBE20B09F21CDAACD9EA0A033B4FD86036D942DDAE71DC9DBA5F59 |
| packages/domain/src/report-v3-state.test.ts | 977 | BE42E8079A769AE30766C6F0CC30057DF20F506976161118516D379750DACBCD |
| packages/domain/src/report-v3-state.ts | 764 | 7D69301ED97C6675C2B25DF39C97E8C881A61EC392C93E9C39159EAD0DB0F2B6 |
| packages/test-utils/src/release-gate-runner.test.ts | 2329 | ECFEF1A8799F1A6200850D19A1FB157BEA081ACF8187FCDC90217763F1D86DF3 |
| packages/test-utils/src/release-readiness.test.ts | 6583 | 3FDF727C4EF41AA64D38E0CFA1F45160AD57FE9E5A0BEF0E56851545A087B5EB |
| scripts/build-android-aab.ts | 4488 | 5663CC3D185EC91CDE2559DA501ED8107505F4A82817C6DF6A8E8C7E08792F66 |
| scripts/build-android-apk.ts | 10426 | 327AC78ACB237A2E60980BAD70C9ECB178C45BA85BA20EBC92038752BDCE2E8B |
| scripts/build-api.ts | 2531 | CA1988E73241EA6E4237D11D697CE4078E3A7112BF8A20680447D4AC5AFBE8AC |
| scripts/db.ts | 8818 | 6C680D50551946AAAD4F83923ECC988F642A5B5B3D9D9C37A213A1055391ED7D |
| scripts/generate-release4c-file-ownership.ts | 4959 | 0FB75A5DAC3EC3C6E7BFF51855EE95FC82FBB4029D80C051AC01081C0EBA65EC |
| scripts/generate-release4c-manifest.ts | 8652 | 5AC3D291417078F03C95771B2DEB2E428608A78F9E43289522EABA3977201AA7 |
| scripts/generate-release4c-persona-evals.ts | 5075 | 3541F98A63735B610681AC0BF53A94FF3EE500EC20FEC1A14F59303F6A278364 |
| scripts/generate-release4c-route-scenarios.ts | 9330 | 809C57D2F72AA963A7833350F56F0468A33AF1D19F86243C12CFC9FE1A33FD34 |
| scripts/generate-release4e-ownership.ts | 7819 | 20B4FB5D4985B9CF8631101AC1CC03EFAA00CCF5A30F8291AE960CC157D258D8 |
| scripts/measure-release4-catalog-performance.ts | 3054 | F9831EF1CCAB8FA7509D41BE90C0C8C8FDCDD2CC8D7C6DCF56B7EEC1666B6990 |
| scripts/pixel-lock/android-pixel-lock.ts | 34241 | 566B079020D76B6F1EAF1301FA01752B6AD61E66A44A81BC3B2213F9CD8C376C |
| scripts/pixel-lock/build-pixel-apk.ts | 6487 | AA831F60C084A2CE7527BA6A4483C03E2317A32D7A3E8658266F645C35790B29 |
| scripts/release-gate.ts | 11934 | A15615F4A233ED61EBEC967DF219DE97BF022C51AAF2195D271BD1600DDEB895 |
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
