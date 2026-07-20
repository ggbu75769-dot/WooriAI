# Release 4 provenance preflight

Generated: 2026-07-16T07:37:20.470Z
Branch: codex/sprint2-catalog-payments
HEAD: db7a7a455afec892b8fa1205e477dbe507a5931d
Upstream: NONE

## Protected pre-existing working tree

The following dirty/untracked paths existed before this provenance evidence was generated. The generator itself and this output file are excluded.

```text
M apps/admin/src/admin-cms-pages.test.ts
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
 M apps/api/src/onboarding/onboarding-store.service.ts
 M apps/api/test/onboarding.e2e.test.ts
 M apps/api/test/release3-app-config.e2e.test.ts
 M apps/mobile/app/(auth)/login.tsx
 M apps/mobile/app/(onboarding)/budget.tsx
 M apps/mobile/app/(onboarding)/child-profile.tsx
 M apps/mobile/app/(onboarding)/child-status.tsx
 M apps/mobile/app/(onboarding)/prepared-items.tsx
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
 M apps/mobile/src/categories.ts
 M apps/mobile/src/child-profile-manual-stage-and-date-guard.test.ts
 M apps/mobile/src/local-backend.test.ts
 M apps/mobile/src/offline/remote-api.ts
 M apps/mobile/src/offline/sync-controller.ts
 M apps/mobile/src/offline/types.ts
 M apps/mobile/src/real-session-data-integrity.test.ts
 M apps/mobile/src/stores/persist-upgrade.test.ts
 M apps/mobile/src/stores/session.store.ts
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
?? apps/api/test/catalog-v2-admin.e2e.test.ts
?? apps/api/test/catalog-v2.e2e.test.ts
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
?? apps/mobile/src/preparation/Release4ItemDetailScreen.tsx
?? apps/mobile/src/preparation/Release4PreparationScreen.tsx
?? apps/mobile/src/preparation/release4-preparation.test.ts
?? apps/mobile/src/production-build-boundary.test.ts
?? apps/mobile/src/reports/period-aggregation.test.ts
?? apps/mobile/src/reports/period-aggregation.ts
?? apps/mobile/src/stores/catalog-search.store.ts
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
?? docs/5차/release4c-baseline-revalidation.md
?? docs/5차/release4c-catalog-review-worklist.md
?? docs/5차/release4c-coverage-applicability.md
?? docs/5차/release4c-independent-implementation-audit.md
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
?? docs/qa/evidence/release4c-persona-evals.json
?? docs/qa/evidence/release4c-start-diff-stat.txt
?? docs/qa/evidence/release4c-start-status.txt
?? infra/docker/docker-compose.release4c.yml
?? packages/contracts/src/release4-reports.test.ts
?? packages/contracts/src/release4-reports.ts
?? packages/contracts/src/release4.test.ts
?? packages/contracts/src/release4.ts
?? packages/domain/src/release4-catalog.test.ts
?? packages/domain/src/release4-catalog.ts
?? packages/domain/src/release4c-personas.test.ts
?? packages/domain/src/release4c-personas.ts
?? scripts/generate-release4-provenance.ts
?? scripts/generate-release4c-persona-evals.ts
?? scripts/generate-release4c-route-scenarios.ts
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
| apps/admin/src/components/AdminShell.tsx | 12256 | 942F8CDDC218A692D1F52B04820271CF6E882E50BC6D036232E150E2DAAB726A |
| apps/admin/src/lib/admin-api.ts | 29090 | C6FEEFE82133F37200EA9A2EC714349F164B2FE64FA408E5F6B0BB0A3E58D66E |
| apps/api/package.json | 2311 | 346618565E77E644E933FF972E0AECCC6A6DB302D6F7CA6B3DF29CFD4A906AAF |
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
| apps/api/prisma/seed.ts | 25827 | DDD8D2392E87A9A1586768DD4D317CE4C0FFB7324242DE13404C8C3A008AAA32 |
| apps/api/scripts/catalog.ts | 25196 | D91B34FF5EB3F749EF7506F88C7C3564D2AF55433419B782223214FF72CB39FF |
| apps/api/scripts/release4c-evidence.ts | 11537 | B3037CF27E972993F5D789BD66AFEB48708A07FDF4651A0179A7259FE6AE1C60 |
| apps/api/src/app-config/app-config.service.ts | 2846 | 5C1A4A77E546E68AF61B862F4333387DB7CB33A97F3CC3595DBE19B8F0EE1420 |
| apps/api/src/app.module.ts | 1754 | 9FE28FE1375CCA7EB85A7C40C92B2F2D752FBE73A1E8BD483774BED7FD5BDFAF |
| apps/api/src/auth/auth.module.ts | 1723 | 83981F465A716230098B033C31C3A6942CF32B679B717EBF9F207B19B1554A88 |
| apps/api/src/auth/providers/mock-kakao-oauth-provider.adapter.test.ts | 1153 | 62A1B7DD0E93F71A475162B330A21DC9D6A451B75FE05B9504AE0656B3441009 |
| apps/api/src/auth/providers/mock-kakao-oauth-provider.adapter.ts | 1682 | 3B52F7F80BA9046D1FA6FA27560677B025C3B2D15ABA994C0DE706795756CEEC |
| apps/api/src/catalog-v2/admin-catalog-v2.controller.ts | 17954 | FB88509E5C1093303521CD66A5E000B827C80D2F2EF57D984DBAA8FA49C19DD6 |
| apps/api/src/catalog-v2/catalog-import-file-parser.test.ts | 2204 | 3FE360F957E39FA33F0B0A0E94ACB3167C1FF88749FC3F6E13E76F53D4D60508 |
| apps/api/src/catalog-v2/catalog-import-file-parser.ts | 7456 | 57E4AB9B13E71B1999EE514C587C2174E25A35E354D8E53C302F1CE7325F01F9 |
| apps/api/src/catalog-v2/catalog-v2.controller.ts | 11649 | BB89419E921FB42D64382A263B6BFDD61998D1001855746EF4058E7B4E1C9E00 |
| apps/api/src/catalog-v2/catalog-v2.module.ts | 780 | 45EBC741160E7E950B71422921776171FE6395539ABBBB8E6E376C9865539DDC |
| apps/api/src/catalog-v2/catalog-v2.service.ts | 160127 | 81F8E496D1454F9A156DB35D3A5459D544C2CEB28469D87F9A8E038D2A33D3E4 |
| apps/api/src/catalog-v2/dto/catalog-v2.dto.ts | 15882 | C3094D66D345A1989AFF76AC42EF57E2EBC80121D5CCD1DC635B09046129A8AC |
| apps/api/src/common/filters/global-exception.filter.ts | 4195 | BD1CD2861ED569FE2E3DA2BDF0280DE7A0E4AAD617C0974FB872B11F954FACCD |
| apps/api/src/finance/dto/expense.dto.ts | 2283 | 53385054A250503EEC9F21A4A12379D6C0AB6371B031E1CC87C20ADF4D7D10EC |
| apps/api/src/finance/dto/reports-v2.dto.ts | 596 | 4CF6CA52C3087F457B914AB39FDC02D8157B366A70D736704265BD35680D975D |
| apps/api/src/finance/expense-snapshot.ts | 1713 | 1F0A87F29A13392666746AF59BD617E695714B2AEE34CD9DE3A92ECAFEC84C77 |
| apps/api/src/finance/finance.module.ts | 1079 | 63DF03ECDEB54B8D822981D0A1F7EB370A83154EEFAB9632D7EFEA0E85E74DCB |
| apps/api/src/finance/reports-v2.controller.ts | 3069 | 55C1767102724C341C5A0772698AE3BED4FF6CE37261AA46CD41FE39FF38FEAE |
| apps/api/src/finance/reports-v2.service.ts | 31294 | 1196C18D828F2D2273B55304FFBA99FCB1419CE3FA6F9D3F65B52E1C6D2118E7 |
| apps/api/src/jobs/job-handlers.service.ts | 13696 | 65CC849C1400A5FC84709317573CEC2BB70BA3A18AC2C9B354D5F4F9CFF67DCB |
| apps/api/src/jobs/jobs.module.ts | 805 | 7BE27821884F3E94D7F13D443450FA6FDB70181C67138BEF8CA06AAA4870EA60 |
| apps/api/src/onboarding/onboarding-store.service.ts | 95288 | 56DD5ABC3B5DB4C0CA8A938B38C078306E90960507BC5B0CD82E24CC020720A8 |
| apps/api/test/catalog-v2-admin.e2e.test.ts | 35706 | C7C6226079AC4C7FAEAC298CBF0DB69755B17143918FC63520F3F64058A6D4F7 |
| apps/api/test/catalog-v2.e2e.test.ts | 33863 | 459D7E07DC3308CC7E86A37AA4D748234910FDA24F0649BB2820CB5AD005D425 |
| apps/api/test/onboarding.e2e.test.ts | 16999 | DA5D6EC795D8C1F1B6A903FAADD221A174E48CC3BC0E8C6E2136DE179D76BAAB |
| apps/api/test/release3-app-config.e2e.test.ts | 2358 | D129F16CDE5E408489CE19AEFC970C63B499FE3C384E6375C995360444DE6EB5 |
| apps/api/test/release4-catalog.test.ts | 3310 | D4B92A4D3BD50439B0EB5A47C3C11496448831AC9DC617F9CC77CB103D49C63F |
| apps/api/test/reports-v2.e2e.test.ts | 14720 | 98BB93838733B15D440E281750D55823D45D4313CB11677244E1E130A1351917 |
| apps/mobile/app/(auth)/login.tsx | 9121 | BFF983AF3515CE5F3C20CACFF3A6DB803C83C798FEB92E821A2EC35A20A057E0 |
| apps/mobile/app/(onboarding)/budget.tsx | 4987 | 1FF197985BEAC3A3FF636DE6E1CD0F6E7BBA735E595FEDA15E134FEBF5F49611 |
| apps/mobile/app/(onboarding)/child-profile.tsx | 9607 | C7403813F1BA43AFC6F60A07F3365CCE3065982A3B4866688057EDD305AAAA0D |
| apps/mobile/app/(onboarding)/child-status.tsx | 4121 | ABB32E9D8E6FDC5DFDC5EB9D2D1AFEEC64347AF892C093106DCF90AD62AA7184 |
| apps/mobile/app/(onboarding)/prepared-items.tsx | 5189 | 40DB95E576A8407E9162E7EDB00D947CE62672EDD99862084D041C08401B5E52 |
| apps/mobile/app/(tabs)/_layout.tsx | 3885 | A88DFFD9EAFA32B368D3E3E1113AB7C7A6C1B02545A5B200EF31AE0D7A342C6D |
| apps/mobile/app/(tabs)/index.tsx | 8919 | B6D59B34787721CC6EF7C8FA04054F5B2A0088292095F6B4E704A3FB17E3BF95 |
| apps/mobile/app/(tabs)/items.tsx | 11067 | 0A4491470B4E107A6877CB15FAC0BAF847EFA87800406D0F861FA1700D1BB622 |
| apps/mobile/app/(tabs)/more.tsx | 6740 | 826C374A0A5032B26DD2064E4BBDBF3FB87EBD85DD8569AB41C3665459FA3048 |
| apps/mobile/app/(tabs)/records.tsx | 14093 | 20F0AE8CF419F3D7F8DD0BBB6A7F853F3F8FE9653AED788E4B98B2E35B3E180C |
| apps/mobile/app/(tabs)/reports.tsx | 36679 | 6426140CD37EE860B1E166EA7747C83B9CCA44BF72EC8C48063247215B075C61 |
| apps/mobile/app/_layout.tsx | 1392 | 621DA5B7EAD1D49BD281BDA0794EF892EB5938C3CF9EB34BE2ED5EE9E56E052C |
| apps/mobile/app/budget.tsx | 5125 | E6ED1C2348737187F1DD4B6A38486AC4083A25DC4EB3C9DB2A2B3EB07E429D13 |
| apps/mobile/app/children/[childId].tsx | 4633 | 8A9BB3B1BB12CCA45850D001BD2A8891B1A6C1C4F010992383FC6781C59DEF59 |
| apps/mobile/app/children/index.tsx | 4232 | 15340B7066201DFD7B64A8B9246E507F0AF5C4654DC954E1B2894E7DFABA4D1F |
| apps/mobile/app/children/new.tsx | 3757 | D17090B3B913623D39040F3F66E7B66A7031356630A2253F1FC0F9A1F1E53E0B |
| apps/mobile/app/expenses/[expenseId].tsx | 21665 | B73A22DF133B0BD62C369A06510594A2E063DC70D690ED26C52194D07D071B07 |
| apps/mobile/app/expenses/new.tsx | 29705 | F8EC16A1AACE20EEBA560C4DA9BB6118BBF4C38F9FAFE5BBBCEC9C02C5C25033 |
| apps/mobile/app/family/accept/[token].tsx | 4469 | F479C46362D5C285E1A93AC9B5443741F0200F7324AE56FC0F74A4D255790917 |
| apps/mobile/app/family/index.tsx | 12313 | DC2D3A6861C07AB75787E4FFDD5BD069CB5CCD85B8089EFA017BE46DE1073D96 |
| apps/mobile/app/family/invite.tsx | 5473 | D55B8A074F5B536A4E93DFEBE58A63BFDD393187EE70094F250567557C97F73A |
| apps/mobile/app/import/[importJobId].tsx | 10586 | 891488E99F9C7F267DD132821FEDB80723664E7A6D6D7AAE27A42E291988B5C1 |
| apps/mobile/app/import/index.tsx | 13010 | 1B4EC8D1D14865B63F6C9119E93CE93EA5900B54EE7A6E67C813450EAF09902E |
| apps/mobile/app/index.tsx | 6615 | EAEF7DE335E1941F1C0B3B281445196F1094A7774B20CCF301812A06E3DC85AF |
| apps/mobile/app/items/[itemTemplateId].tsx | 16778 | 01C814DC94027536C91EF7F12D419D86C25DDD4A654F742A8F75041C297A2E7E |
| apps/mobile/app/launch-animation.tsx | 5979 | 6A099E2CED8CA019233DC99F3CD035BD8EBB796E2447DE7B88CBE588A4188EB0 |
| apps/mobile/app/payment-methods.tsx | 10227 | ED13EAB9C8B17FFB57F3EC5B7A906EB0DF924E0112D79188EA1B463584D07F67 |
| apps/mobile/app/profile.tsx | 4029 | 8273D7425152ED9E5C588E1FF4FCBF5AF4D377841879FF22225A4B5BDA29CE44 |
| apps/mobile/app/settings/index.tsx | 5207 | 44F99DDA90CD8668DE699DF6DDCF1CCDA367A868B21850EDFACF718E82EEE7A4 |
| apps/mobile/app/settings/privacy.tsx | 12786 | 354A5639F09EFFC27873891FE96C5556B52AEC13E4D2AAB168D6B2E967654D6C |
| apps/mobile/app/sync-status.tsx | 10218 | 4FBE96C0168AFD80E220A26A2353A47934B8BD4E33E9AC14FAFB279196F97749 |
| apps/mobile/e2e/release4c-route-scenarios.json | 72519 | 92ABADF12E097D87FAE174BA3990D879E2FF8ADC62AB17E8D164F80C406F875B |
| apps/mobile/metro.config.js | 1711 | 078790834539A8407E0AFA113369F849D1D91B3145135FC42ADD4696F8395836 |
| apps/mobile/src/android-native-ui-quality.test.ts | 6976 | 8B06CC52C29AD93A21D215D4921E2ECA63EAF034015946ABEC63679F2A92CE74 |
| apps/mobile/src/android-standalone-apk.test.ts | 4138 | 5CF48164AB517618BB211EDC5C3484BDB19C005E1A14C999E60F8F299D910D52 |
| apps/mobile/src/api/client.ts | 63957 | 0010A3CEBAE425B3BCDEA9C54C463D33BD22E6D0199FA88F0829625D8148CB2B |
| apps/mobile/src/api/fixture-runtime.production.ts | 967 | 429300C9C678BBBCC76682902125366A72B9CFF25EAC61723C33C3BE09D57F4C |
| apps/mobile/src/api/fixture-runtime.ts | 759 | A136807251BD3079FC447FE9D89E8563B1FDBD41AFC4ED7979EBC8DB9EC9A971 |
| apps/mobile/src/api/local-backend.ts | 115637 | D32BB6B89A87E312C713DF120412642F45B97C2272C1760BF8BD09091C8BA6C8 |
| apps/mobile/src/api/local-fixtures.ts | 7812 | 6C6BFC36DE85AD346848CD7648DA1F20C54D374997352C35ED51767E4F393741 |
| apps/mobile/src/api/prepared-item-ids.ts | 382 | F572BFEEAF8F8BD97D7877FE63F57039BA2F5B8A8F68D5B6973B67F62BA55848 |
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
| apps/mobile/src/local-backend.test.ts | 12255 | 21E307B38CCE198455FE118F089DDFA3B682F915E896B94FC49D3B92A6FF3A84 |
| apps/mobile/src/offline/remote-api.ts | 4638 | 476157D5175D6405F4131FF086B5AEA25433FC515DF79F563FFAA3CEE9AF8055 |
| apps/mobile/src/offline/sync-controller.ts | 14217 | DFF006B7501493D438EB403B0F6BBC687286723C982106A841F77E14562C3F50 |
| apps/mobile/src/offline/types.ts | 5701 | CAD8D897CF093A7B1056CC86C36DF3706F1FD5621C4B73E2AF9998A50539D319 |
| apps/mobile/src/preparation/Release4ItemDetailScreen.tsx | 23227 | 2AA2EB4C6CD30A2121898052C875246CB5F3D58B94068AA4FA75FBBA8F552542 |
| apps/mobile/src/preparation/Release4PreparationScreen.tsx | 38922 | 7132632F554857BDCAE50DC3508A99D4F17A5AE0709E5D9649007B3999627133 |
| apps/mobile/src/preparation/release4-preparation.test.ts | 9563 | E6C443C92F0471E49A2EA8CCCCA8D2226AEB8325AD80E8AF3F680B302FDB14E2 |
| apps/mobile/src/production-build-boundary.test.ts | 2407 | DC08D8FA89B263B9926E8CBB773945E6FBBB4ECD8F665C8D9D3A72346FCFA37D |
| apps/mobile/src/real-session-data-integrity.test.ts | 4159 | BFA25836140BF1D327992A34C3ACD58A1712CBDF7159A84ABFE2A101A382CB0E |
| apps/mobile/src/reports/period-aggregation.test.ts | 1484 | 0FB2B0E5691801FACEA8CC04460865AB7071682F5345C3B8ED560C5EB303F341 |
| apps/mobile/src/reports/period-aggregation.ts | 1583 | 62E937B67B3FB2A480EA5737772429A0D48765BCFCFF84BFFFCB4F1B7EA8156B |
| apps/mobile/src/stores/catalog-search.store.ts | 1334 | DB0D83E1BDCFCF7E666F6B93804985D4BAB23853AD565F1B5941CCA38A08C30A |
| apps/mobile/src/stores/persist-upgrade.test.ts | 15930 | D9386C533F0B724B0524B21BAD782413CA97CF5BF4FD7A2D7B6D347868162634 |
| apps/mobile/src/stores/session.store.ts | 6035 | 78C83AEA267FF6DF8D639D128D8A3A200EB2E5A4AA2592E6FA7B42C6B58314BA |
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
| docs/5차/release4c-baseline-revalidation.md | 6052 | FCEAF7DFC154F28B65B1B75AC21D72BB4046B4719ACAF93E824C1A997EAED215 |
| docs/5차/release4c-catalog-review-worklist.md | 471 | 19F4AC8DB9588B475373142AE678CF233803A4F4605A2B83CBFAA5F12530BD24 |
| docs/5차/release4c-coverage-applicability.md | 475 | 89BFAAA25BC0D5F94F052A395B3AD175234ECA54735AB6ECD54753A69831F114 |
| docs/5차/release4c-independent-implementation-audit.md | 9509 | 5C61D1CE0E18F9B341BF3DFEA0E694404CF77B438E857150DCF4A2FAA8BE7902 |
| docs/operations/product-redesign-development-completion-report-2026-07-15.md | 9973 | B5516F4C61CE00480AFA42011121FD9CD8A9A79E49D3F02C5D102EB420FD9EB0 |
| docs/qa/evidence/latest-release-gate.json | 2692 | 5E3DF6BE9B8DEFB91938184ACEB71E275C3E123F45430D18C645A2C1E4AB745F |
| docs/qa/evidence/latest-release-gate.md | 1237 | FF6175EC8CB5CF05724E941F72B4229C4FA5FF9D97BB4262011047CE18750CC6 |
| docs/qa/evidence/release3-production-config-fixture.json | 310 | 431E93207F09BBE219344C68768CCFDCE64411F36D42621AF74672AF9C30ABDC |
| docs/qa/evidence/release3-production-config-fixture.md | 604 | 616212B7773EE9A5CDE0AC90DD49C8337E02187FB9FB8AABC8C684D386ED9058 |
| docs/qa/evidence/release3-production-config-gate.json | 6860 | 355312D9536329A924DCA4FF86073DF40EF3BCC930089B98E97AE471BFD9CF7B |
| docs/qa/evidence/release3-production-config-gate.md | 4607 | DCD3C38D183330ACAF0AABE96104252BE7A10AA7DCC94229C1216D7E838746EA |
| docs/qa/evidence/release4-apk-inspection.md | 2025 | 2E3505471D43387AADD890D11E9A7B112E969A18A75F8602CA9FCDD468591EF9 |
| docs/qa/evidence/release4-catalog-audit.json | 3333 | B6AA556A152BB6924B87C49F666ED3DF9D2AB76893E1D1D07C11D56F719CA58D |
| docs/qa/evidence/release4-catalog-baseline.json | 2977 | 2D88BD10149C3FF1004111DC4ED3475DD95391490460DA4A3B20CC3ACD434566 |
| docs/qa/evidence/release4-catalog-performance.json | 466 | 70172DA03EB188DAF7B828CC2AC87A16DD87394EB4BA4691C3A813DE3C96CCC4 |
| docs/qa/evidence/release4-database-verification.json | 1072 | AFC92DE6C43845AE8986C2B40B3F04F9474D49F3342DB3854550A2EB7C09D5F2 |
| docs/qa/evidence/release4-enhancement-manifest.json | 3992 | 07ADDE68F3FE89EA31D1395E2EB6F83993BD77EA362122318C91C13E0C9C5E60 |
| docs/qa/evidence/release4-enhancement-preexisting-working-tree.txt | 5407 | 2F5975F5702266501693104A1446CD45F2747A9B21185E2F6CEA77F3373419A5 |
| docs/qa/evidence/release4-production-contamination.json | 3695 | A74A055DE3A744FFD2DC1425DDF1FAD30368AD73235F331E502470FBF249084B |
| docs/qa/evidence/release4-production-export-contamination.json | 3111 | A274F2D31F19B297330D6B9E14330FEF65AE25428DFC2219FE0ADEC2C0B986AD |
| docs/qa/evidence/release4-provenance-preflight.md | 24896 | B9697B4605B09AFFDD4D9AA24E8C84CB94077F23DBADC174209E98F0D35F08AB |
| docs/qa/evidence/release4-report-v2-evidence.md | 1930 | D1C4DF39FF747392214A55CCB0A241FD9B906D39B1B723E66692B48D750FF31C |
| docs/qa/evidence/release4-responsive-accessibility.md | 1568 | 27C746D2BEE78D1ED77F11AE7A1E96E56EC7549D849A2341E3514082E11B77F2 |
| docs/qa/evidence/release4-ui-route-inventory.json | 43047 | 9E2C37F3F5EC853ADF0A5B2177643B158953698E5A312BA375C7A4920B2CF476 |
| docs/qa/evidence/release4c-catalog-review-inventory.json | 1067911 | 085C2D4A15DBCAD01539E7D16681B393CF3B8EB90A71F0B3B0A9944B17251B35 |
| docs/qa/evidence/release4c-coverage-matrix.json | 955540 | 7CC87BFF64080C7652CCFF0C97C80AEF4F8645A2031A1EE6799EA02F585D0D90 |
| docs/qa/evidence/release4c-findings.json | 16673 | 179FC43E54D4216EA6C0D430452E30D8C11A7AC4B825C00B8A13D872255D126E |
| docs/qa/evidence/release4c-instruction-chain.md | 5023 | D942BAC042705D7CCDA66D4264AD5E6A3620BC0B8F44B6623F262E821CAF962F |
| docs/qa/evidence/release4c-persona-evals.json | 78247 | 4948D27EC6D390C0C91397615240804D681332DF5770D5915F40970AAD62E361 |
| docs/qa/evidence/release4c-start-diff-stat.txt | 5287 | 8A8E7B414BAFCAFE0CAE6D33497824D1ECA353D2D298D122F788880263547E69 |
| docs/qa/evidence/release4c-start-status.txt | 24418 | 77FB00F00BB4FEFE41FB0CF8BFBF2D5C198F5A0F1078542E453F721858DCD2DF |
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
| packages/contracts/src/release4-reports.ts | 7073 | F4757DF21911CDF49DD32F0E39A24A1E1BBF23BA364FD5F6DC19A14FC3CBB172 |
| packages/contracts/src/release4.test.ts | 976 | DBA265C48C44FB9DE05278715DCD2D3CF188E317929AD657F4490E5E579C4537 |
| packages/contracts/src/release4.ts | 5099 | 1FDDC1920F0EFB016125AAE3E1EDEC90CABDB2EA7A1D8D63F608C786528CDDB3 |
| packages/domain/src/enums.test.ts | 1739 | 84F6231818D9A899963FC2A5D6CE1218E542A3993CADF9AA9D549A34F741094B |
| packages/domain/src/enums.ts | 2269 | 58EA74B886899E5E251C6A124C42B6FAF40F12075E29612205FE772FBCB14954 |
| packages/domain/src/index.ts | 188 | A446B7F8E487422F04F8C7680D440C96D83115E9F7784BB37B717F6528FE4ACA |
| packages/domain/src/release4-catalog.test.ts | 1441 | B1C27459BC503CBAF7CBB618F7B767ECCAAF9608DDD7BD32F075F0F3BFF42734 |
| packages/domain/src/release4-catalog.ts | 39548 | 92504F7EFE5C77B1BE2C942B83133DBB936F2676E8E3E5337F3B38D05AB70C50 |
| packages/domain/src/release4c-personas.test.ts | 1338 | B67956B2890039CEEF85613917780B6A0045860FFD576929931E02EEA9FBDB5E |
| packages/domain/src/release4c-personas.ts | 5594 | 6FA4B02205CBE20B09F21CDAACD9EA0A033B4FD86036D942DDAE71DC9DBA5F59 |
| packages/test-utils/src/release-gate-runner.test.ts | 2329 | ECFEF1A8799F1A6200850D19A1FB157BEA081ACF8187FCDC90217763F1D86DF3 |
| packages/test-utils/src/release-readiness.test.ts | 6583 | 3FDF727C4EF41AA64D38E0CFA1F45160AD57FE9E5A0BEF0E56851545A087B5EB |
| scripts/build-android-aab.ts | 4488 | 5663CC3D185EC91CDE2559DA501ED8107505F4A82817C6DF6A8E8C7E08792F66 |
| scripts/build-android-apk.ts | 10426 | 327AC78ACB237A2E60980BAD70C9ECB178C45BA85BA20EBC92038752BDCE2E8B |
| scripts/build-api.ts | 2531 | CA1988E73241EA6E4237D11D697CE4078E3A7112BF8A20680447D4AC5AFBE8AC |
| scripts/db.ts | 8818 | 6C680D50551946AAAD4F83923ECC988F642A5B5B3D9D9C37A213A1055391ED7D |
| scripts/generate-release4c-persona-evals.ts | 5075 | 3541F98A63735B610681AC0BF53A94FF3EE500EC20FEC1A14F59303F6A278364 |
| scripts/generate-release4c-route-scenarios.ts | 9330 | 809C57D2F72AA963A7833350F56F0468A33AF1D19F86243C12CFC9FE1A33FD34 |
| scripts/measure-release4-catalog-performance.ts | 3054 | F9831EF1CCAB8FA7509D41BE90C0C8C8FDCDD2CC8D7C6DCF56B7EEC1666B6990 |
| scripts/pixel-lock/android-pixel-lock.ts | 34241 | 566B079020D76B6F1EAF1301FA01752B6AD61E66A44A81BC3B2213F9CD8C376C |
| scripts/pixel-lock/build-pixel-apk.ts | 6487 | AA831F60C084A2CE7527BA6A4483C03E2317A32D7A3E8658266F645C35790B29 |
| scripts/release-gate.ts | 11934 | A15615F4A233ED61EBEC967DF219DE97BF022C51AAF2195D271BD1600DDEB895 |
| scripts/run-catalog-audit.ts | 673 | C77564B32D2A245027CD6CD0584F246DA973E0EB5ECCA08E8B6779C112EC96DB |
| scripts/ux-contract.ts | 9384 | 57FC482DDCAB5C30D0CD360BFD19C7A4CE5B4A5F4EA2C4175064585A72EC1813 |
| scripts/verify-release4-contamination.ts | 4961 | 929E298369FFB91763CD0EB103226DC44D0B9B594267727E12C01F178B44D45B |
| scripts/verify-release4-databases.ts | 10398 | 2CE4B8F0D736A5666AA1E11DB270212531C346B152EF58C3D7DBA1CFAAB49020 |
| scripts/verify-release4-production-export.ts | 2563 | 8E7DB4DEA7C87424C7589C4BA296002580D17A5E41D3B637F9072EA54152E9E0 |

## Remotes (read-only capture)

```text
origin	https://github.com/ggbu75769-dot/WooriAI.git (fetch)
origin	https://github.com/ggbu75769-dot/WooriAI.git (push)
```

No checkout, reset, clean, staging, commit, push, deploy, store upload, or remote write was performed by this capture.
