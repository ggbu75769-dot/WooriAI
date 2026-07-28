# Release 4 provenance preflight

Generated: 2026-07-15T16:12:19.281Z
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
 M apps/api/src/app.module.ts
 M apps/api/src/common/filters/global-exception.filter.ts
 M apps/api/src/finance/dto/expense.dto.ts
 M apps/api/src/finance/expense-snapshot.ts
 M apps/api/src/finance/finance.module.ts
 M apps/api/src/jobs/job-handlers.service.ts
 M apps/api/src/jobs/jobs.module.ts
 M apps/api/src/onboarding/onboarding-store.service.ts
 M apps/mobile/app/(auth)/login.tsx
 M apps/mobile/app/(onboarding)/child-profile.tsx
 M apps/mobile/app/(onboarding)/child-status.tsx
 M apps/mobile/app/(onboarding)/prepared-items.tsx
 M apps/mobile/app/(tabs)/_layout.tsx
 M apps/mobile/app/(tabs)/index.tsx
 M apps/mobile/app/(tabs)/items.tsx
 M apps/mobile/app/(tabs)/more.tsx
 M apps/mobile/app/(tabs)/records.tsx
 M apps/mobile/app/(tabs)/reports.tsx
 M apps/mobile/app/expenses/[expenseId].tsx
 M apps/mobile/app/expenses/new.tsx
 M apps/mobile/app/family/index.tsx
 M apps/mobile/app/family/invite.tsx
 M apps/mobile/app/import/[importJobId].tsx
 M apps/mobile/app/import/index.tsx
 M apps/mobile/app/items/[itemTemplateId].tsx
 M apps/mobile/app/launch-animation.tsx
 M apps/mobile/src/android-native-ui-quality.test.ts
 M apps/mobile/src/android-standalone-apk.test.ts
 M apps/mobile/src/api/client.ts
 M apps/mobile/src/api/local-backend.ts
 M apps/mobile/src/api/local-fixtures.ts
 M apps/mobile/src/child-profile-manual-stage-and-date-guard.test.ts
 M apps/mobile/src/offline/remote-api.ts
 M apps/mobile/src/offline/sync-controller.ts
 M apps/mobile/src/offline/types.ts
 M apps/mobile/src/real-session-data-integrity.test.ts
 M apps/mobile/src/theme.ts
 M apps/mobile/src/ui-pixel-lock-flow.test.ts
 M apps/mobile/src/ui.tsx
 M docs/qa/evidence/latest-release-gate.json
 M docs/qa/evidence/latest-release-gate.md
 M docs/qa/evidence/release3-production-config-fixture.json
 M docs/qa/evidence/release3-production-config-fixture.md
 M docs/qa/evidence/release3-production-config-gate.json
 M docs/qa/evidence/release3-production-config-gate.md
 M package.json
 M packages/contracts/src/index.ts
 M packages/domain/src/enums.test.ts
 M packages/domain/src/enums.ts
 M packages/domain/src/index.ts
 M packages/test-utils/src/release-gate-runner.test.ts
 M packages/test-utils/src/release-readiness.test.ts
 M scripts/build-android-apk.ts
 M scripts/db.ts
 M scripts/pixel-lock/android-pixel-lock.ts
 M scripts/pixel-lock/build-pixel-apk.ts
 M scripts/release-gate.ts
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
?? apps/api/src/catalog-v2/admin-catalog-v2.controller.ts
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
?? apps/mobile/src/reports/period-aggregation.test.ts
?? apps/mobile/src/reports/period-aggregation.ts
?? docs/5차/release4-catalog-coverage-report.md
?? docs/5차/release4-data-model-and-migration.md
?? docs/5차/release4-design-system-migration.md
?? docs/5차/release4-enhancement-baseline.md
?? docs/5차/release4-external-actions.md
?? docs/5차/release4-feature-enhancement-completion-report.md
?? docs/5차/release4-gap-backlog.md
?? docs/5차/release4-implementation-audit.md
?? docs/5차/release4-known-limitations.md
?? docs/5차/release4-migration-manifest.md
?? docs/5차/release4-test-evidence.md
?? docs/operations/product-redesign-development-completion-report-2026-07-15.md
?? docs/qa/evidence/release4-apk-inspection.md
?? docs/qa/evidence/release4-catalog-audit.json
?? docs/qa/evidence/release4-catalog-baseline.json
?? docs/qa/evidence/release4-catalog-performance.json
?? docs/qa/evidence/release4-database-verification.json
?? docs/qa/evidence/release4-enhancement-manifest.json
?? docs/qa/evidence/release4-enhancement-preexisting-working-tree.txt
?? docs/qa/evidence/release4-production-contamination.json
?? docs/qa/evidence/release4-provenance-preflight.md
?? docs/qa/evidence/release4-report-v2-evidence.md
?? docs/qa/evidence/release4-responsive-accessibility.md
?? docs/qa/evidence/release4-ui-route-inventory.json
?? packages/contracts/src/release4-reports.test.ts
?? packages/contracts/src/release4-reports.ts
?? packages/contracts/src/release4.test.ts
?? packages/contracts/src/release4.ts
?? packages/domain/src/release4-catalog.ts
?? scripts/generate-release4-provenance.ts
?? scripts/measure-release4-catalog-performance.ts
?? scripts/run-catalog-audit.ts
?? scripts/ux-contract.ts
?? scripts/verify-release4-contamination.ts
?? scripts/verify-release4-databases.ts
```

## SHA-256 inventory

| Path | Bytes | SHA-256 |
|---|---:|---|
| apps/admin/app/catalog/page.tsx | 7159 | DCF877DD2B64FCE1C77904A1DBE697BF74E9F01550D09372C23DB80ABA1B7452 |
| apps/admin/src/components/AdminShell.tsx | 12256 | 942F8CDDC218A692D1F52B04820271CF6E882E50BC6D036232E150E2DAAB726A |
| apps/admin/src/lib/admin-api.ts | 18631 | 101864D9E6404145A08ACD103C400B84CFF2697399DFAC94F890DA0FA9BE5AC6 |
| apps/api/package.json | 2248 | 631B0138CC4103EEE9B0E1F663D7C4E9BB95AB7845723E6E4A0F24BABAE45073 |
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
| apps/api/prisma/schema.prisma | 66992 | 055394F6D24D0763E387DA19463E74C9033116D088AC2B3A92C42DB5B3A37F02 |
| apps/api/prisma/seed.ts | 25179 | AB5405F17182ABBB9A1CA1B20C2F55ADD93423C753135494E127F1C6F29D713E |
| apps/api/scripts/catalog.ts | 24738 | FB14FE067314FAFD7A856941250DB3D4AA9D6E1B85C331EB1521B4B4AD8857B1 |
| apps/api/src/app.module.ts | 1754 | 9FE28FE1375CCA7EB85A7C40C92B2F2D752FBE73A1E8BD483774BED7FD5BDFAF |
| apps/api/src/catalog-v2/admin-catalog-v2.controller.ts | 6737 | A16C4A047A9AF0CACEFEDBB8013E6680E084D013C9A504B9CA52AF2F9FAE5DA6 |
| apps/api/src/catalog-v2/catalog-v2.controller.ts | 7130 | CECB1CE2CFBDB392C47F6574C540567F1A3F3D72220C79D3D97E485D6928BB6E |
| apps/api/src/catalog-v2/catalog-v2.module.ts | 780 | 45EBC741160E7E950B71422921776171FE6395539ABBBB8E6E376C9865539DDC |
| apps/api/src/catalog-v2/catalog-v2.service.ts | 35608 | 1D627E38F07AFE6B192505B1EC3AD50F32A8541E9D0A1721C3D9E9D0B7298C35 |
| apps/api/src/catalog-v2/dto/catalog-v2.dto.ts | 7441 | 2D9559E10B49792299831531D0C696CA441B4EE7CC75D71C4C08EE83CF4835A8 |
| apps/api/src/common/filters/global-exception.filter.ts | 4195 | BD1CD2861ED569FE2E3DA2BDF0280DE7A0E4AAD617C0974FB872B11F954FACCD |
| apps/api/src/finance/dto/expense.dto.ts | 2177 | 386BDAAEE9098D892C367792512D0E586C54518668B472E71C53161C7710B40A |
| apps/api/src/finance/dto/reports-v2.dto.ts | 596 | 4CF6CA52C3087F457B914AB39FDC02D8157B366A70D736704265BD35680D975D |
| apps/api/src/finance/expense-snapshot.ts | 1648 | 453E122C4162E26303DE3E31EE089B1E5DF7E5D83A23E112241042ED6547464C |
| apps/api/src/finance/finance.module.ts | 1079 | 63DF03ECDEB54B8D822981D0A1F7EB370A83154EEFAB9632D7EFEA0E85E74DCB |
| apps/api/src/finance/reports-v2.controller.ts | 2802 | 38401D6E98649930373FB6DEF6B82EFAD0C87849372D481B1FCA3E91E50AB3C0 |
| apps/api/src/finance/reports-v2.service.ts | 24907 | 8AECD05CA535E249239529319E50734B457CF78BD99AAE86E27CB60A735F621B |
| apps/api/src/jobs/job-handlers.service.ts | 12591 | 673E7A137FC5628EF6AF36F7DA56FC124243B25114FA620C67520B8315B8CAC7 |
| apps/api/src/jobs/jobs.module.ts | 721 | D30E159377CA314998BCF6E252AC58B07117406093E9C6B06138836BA81743A4 |
| apps/api/src/onboarding/onboarding-store.service.ts | 94106 | DF1A9AF495A7F5F3810EBF35A29C89B02F975FC2B57C526D9D3D554EFC9CC414 |
| apps/api/test/catalog-v2-admin.e2e.test.ts | 5226 | B2BEF660444AA3F1988E2866DE48F0E00C8D52B188F7FF5F8C4A45D88F74ED9C |
| apps/api/test/catalog-v2.e2e.test.ts | 10074 | D7304FB90CB6F23393BA59FF66DEA86E7B7915E97A24C7DA23A85B96B0CABA8C |
| apps/api/test/release4-catalog.test.ts | 3310 | A38FF9A8361CFCD5500D839106A43D74DD59F7D69036C90C97106E20FD090FF4 |
| apps/api/test/reports-v2.e2e.test.ts | 11174 | 511C8C3AD82EA77AF92622DF7D67C8489BBD5874C3831BB6230714B17BEA44E4 |
| apps/mobile/app/(auth)/login.tsx | 9121 | 2EAA55010545D1212519FB4FB3DBA6F7FC7EF638A92F7BF7AC7142F228C78D59 |
| apps/mobile/app/(onboarding)/child-profile.tsx | 9607 | 646BEA8487BA035B5A904C3EDAC847517C3D43FD613F99CF43FA311263A34E11 |
| apps/mobile/app/(onboarding)/child-status.tsx | 4121 | ABB32E9D8E6FDC5DFDC5EB9D2D1AFEEC64347AF892C093106DCF90AD62AA7184 |
| apps/mobile/app/(onboarding)/prepared-items.tsx | 5162 | A01BCF2B417F03286F59D013939D1B92810BB25CF36F12D48ECCA634EA03AACF |
| apps/mobile/app/(tabs)/_layout.tsx | 3885 | A88DFFD9EAFA32B368D3E3E1113AB7C7A6C1B02545A5B200EF31AE0D7A342C6D |
| apps/mobile/app/(tabs)/index.tsx | 8842 | 5B16B54BBE7449FDC4118E1F1567D4F723E2ECA309F5A753975E7C189B5D4BDF |
| apps/mobile/app/(tabs)/items.tsx | 10998 | F9FF93D2DC2BDCA96F7276E632C3ABBA6F842992F2A64F0B939675DF514AB264 |
| apps/mobile/app/(tabs)/more.tsx | 6671 | FDED7CF08799AAB90ED63793198AD46B24BCA9022A48BC2C51388FE15DCB5462 |
| apps/mobile/app/(tabs)/records.tsx | 14093 | 302E321657C8DBF48B130AD1ED4C71A198E442F5A88C306303A06B2505BDBF7F |
| apps/mobile/app/(tabs)/reports.tsx | 28116 | 7586C95446B36D54EC3C0B82E9DCCF5246729C30929ADF273E62C2E9F958D3F3 |
| apps/mobile/app/expenses/[expenseId].tsx | 21665 | 13F3C08C9C9B10426A10B9FBE8440987DF1004348D5AFF8517345C211A73B3EB |
| apps/mobile/app/expenses/new.tsx | 29636 | CD93C6BD20BECB28FF6512D389BEC46C18ED334C44B302C2ECD0DBF3C3A85DBF |
| apps/mobile/app/family/index.tsx | 12093 | B81B917B768E2D06DF0E1DB6B142CB099BD64899B9F357EB506702C3D2264EF3 |
| apps/mobile/app/family/invite.tsx | 5473 | 98F0EAF48803D30E915B37F3264544739F00C8CC778C6A1A3E5EA352A3C9AD2B |
| apps/mobile/app/import/[importJobId].tsx | 10586 | A3194B17537654A5726A527E65DD34120F05BE770F312E3EBC9E05D67193FCD4 |
| apps/mobile/app/import/index.tsx | 12942 | 69A50E5D774F5C892ADC6F23AFB95BC9C74AC831A619266F0974FE9DA576DA1C |
| apps/mobile/app/items/[itemTemplateId].tsx | 16711 | CA2F1385F0BDDCD841DB906A7AB66353195DD6563A95F9A61FEE68B6899E2DB2 |
| apps/mobile/app/launch-animation.tsx | 5913 | E9A9FC7DB5221DA8A366550CE45ED4AAF0C12A120B42007FB72C47C505AEC01E |
| apps/mobile/src/android-native-ui-quality.test.ts | 6975 | 2F6E4D7A6CCB416DD94F5156E672AFC675B3D054C380210520FEED1412095969 |
| apps/mobile/src/android-standalone-apk.test.ts | 4012 | 1CEC2231F46E3CCE694E4CFD2A7E163BE845AF952884D0EF695A5CF608A72119 |
| apps/mobile/src/api/client.ts | 52619 | 6392894D53053884EAA3B9AB1E09695BE7A7DCB6F7622AD3E2C7655C6CA63C4B |
| apps/mobile/src/api/local-backend.ts | 86463 | 5E9CCFE413B87F8956693E34557C584C0B1EC2528619D83FE508F6DFB66B15A9 |
| apps/mobile/src/api/local-fixtures.ts | 7752 | 300993D9249CDAD52BED3C566AA74D2AAB586F43279F790B351B3FC942E0C79F |
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
| apps/mobile/src/offline/remote-api.ts | 4638 | 476157D5175D6405F4131FF086B5AEA25433FC515DF79F563FFAA3CEE9AF8055 |
| apps/mobile/src/offline/sync-controller.ts | 14217 | DFF006B7501493D438EB403B0F6BBC687286723C982106A841F77E14562C3F50 |
| apps/mobile/src/offline/types.ts | 5701 | CAD8D897CF093A7B1056CC86C36DF3706F1FD5621C4B73E2AF9998A50539D319 |
| apps/mobile/src/preparation/Release4ItemDetailScreen.tsx | 10356 | AAD3A880E8A0B362C305626B9D2413B67ED1F943444D663A8D41A82879E55386 |
| apps/mobile/src/preparation/Release4PreparationScreen.tsx | 15798 | 277C65C4BBF29AF0E8BB6C6731D0203E76213EEE877F1FEB93C1FF68E8D64DB3 |
| apps/mobile/src/preparation/release4-preparation.test.ts | 4079 | BE053D81C7CD622CA1A5876720A179F37FF64D2136F92F51368D73FB94775E1C |
| apps/mobile/src/real-session-data-integrity.test.ts | 3572 | 6C747C473911F898B2BD7E6E32B6135CEB1625547B5FF4C112138EEE316855C9 |
| apps/mobile/src/reports/period-aggregation.test.ts | 1484 | 0FB2B0E5691801FACEA8CC04460865AB7071682F5345C3B8ED560C5EB303F341 |
| apps/mobile/src/reports/period-aggregation.ts | 1583 | 62E937B67B3FB2A480EA5737772429A0D48765BCFCFF84BFFFCB4F1B7EA8156B |
| apps/mobile/src/theme.ts | 5548 | D7FFF167CD54E34F5218A20EC0DFE74504A05B37BD7545B17069F56AB15E6C79 |
| apps/mobile/src/ui-pixel-lock-flow.test.ts | 18990 | 5CE06E3BB2C981B88DD46AD18D92193DF0589CABEB5A24F70E39947E8585088A |
| apps/mobile/src/ui.tsx | 27552 | F97357DCC409600724F8FC900DE6BFCDE4C47AC4D7371A9C1CE3D638EAB47FD2 |
| docs/5차/release4-catalog-coverage-report.md | 2086 | 6D1493891AFE7CDCF369ED393DF5E30F2F0BFCB6D4AF845966E93DC683646FEA |
| docs/5차/release4-data-model-and-migration.md | 2808 | 9914A14CB08A3A9D65644CB07906548A420A28A61CE3A7804ED76C2A9F47320F |
| docs/5차/release4-design-system-migration.md | 1419 | 3B58F96BB06CBC33069C42B1B1DFC2365484CAF9990379996777A72DF2947470 |
| docs/5차/release4-enhancement-baseline.md | 3998 | 5A7E86AFBECF9E8054919F5EB617588E3F003897334BFE445233065ABF2B88A6 |
| docs/5차/release4-external-actions.md | 1035 | 4799F5FD748F542224540B19DF1E0CFCD9A8BBA9F0027D0BA8909BB43EB04ADC |
| docs/5차/release4-feature-enhancement-completion-report.md | 4323 | 88CF189B2A12E87A86D2C7F4D9592495F2D31A7CFA65089DE94CA602F9663FE4 |
| docs/5차/release4-gap-backlog.md | 2468 | 99CDC6B9CEB5033FC5A96BBE51113FBC7AFE393F18ED79F1228876F4202D2FDD |
| docs/5차/release4-implementation-audit.md | 4142 | 3E93B893E776525FE3442048F8FDF060DF8D4266EE45FA0E02BBA173A50C60D3 |
| docs/5차/release4-known-limitations.md | 1483 | 6E917A987FF835559AEDBDE87915000E5A7BE308B944E13D53B0B13E54EB6EBE |
| docs/5차/release4-migration-manifest.md | 778 | AAC9918C5546795E78544C038288443623AE431E22D25EB24517811F77B7C31F |
| docs/5차/release4-test-evidence.md | 2146 | AC62EFF301C08B3F1A2649AB482C323A74174642616218435929E40CDB8CDA93 |
| docs/operations/product-redesign-development-completion-report-2026-07-15.md | 9973 | B5516F4C61CE00480AFA42011121FD9CD8A9A79E49D3F02C5D102EB420FD9EB0 |
| docs/qa/evidence/latest-release-gate.json | 2069 | 6FC9BCEEAEB72DCFC5FF0918C7E869746F9FE98680AD5057B4357FB4FABD559C |
| docs/qa/evidence/latest-release-gate.md | 1178 | 5DB5BC565E48296351935FB8E68B3CF0F701F91EF7B15AB97962A73C5210F6B0 |
| docs/qa/evidence/release3-production-config-fixture.json | 310 | 431E93207F09BBE219344C68768CCFDCE64411F36D42621AF74672AF9C30ABDC |
| docs/qa/evidence/release3-production-config-fixture.md | 604 | 616212B7773EE9A5CDE0AC90DD49C8337E02187FB9FB8AABC8C684D386ED9058 |
| docs/qa/evidence/release3-production-config-gate.json | 6860 | 355312D9536329A924DCA4FF86073DF40EF3BCC930089B98E97AE471BFD9CF7B |
| docs/qa/evidence/release3-production-config-gate.md | 4607 | DCD3C38D183330ACAF0AABE96104252BE7A10AA7DCC94229C1216D7E838746EA |
| docs/qa/evidence/release4-apk-inspection.md | 2025 | 2E3505471D43387AADD890D11E9A7B112E969A18A75F8602CA9FCDD468591EF9 |
| docs/qa/evidence/release4-catalog-audit.json | 3097 | C0D3F568AF6519C80F2D0CAF5AA3E0F1BB242AD073ABB2E1CF910DA8807BA312 |
| docs/qa/evidence/release4-catalog-baseline.json | 2977 | 2D88BD10149C3FF1004111DC4ED3475DD95391490460DA4A3B20CC3ACD434566 |
| docs/qa/evidence/release4-catalog-performance.json | 418 | 9F73B6CF00F7452F21035E766F18C3AA230487A386B18EF48202839B19143DFC |
| docs/qa/evidence/release4-database-verification.json | 1072 | CA827DCE8CA477CF18F394269F879D45C8798B802F13B8C584D2F85883BB7BE3 |
| docs/qa/evidence/release4-enhancement-manifest.json | 3992 | 07ADDE68F3FE89EA31D1395E2EB6F83993BD77EA362122318C91C13E0C9C5E60 |
| docs/qa/evidence/release4-enhancement-preexisting-working-tree.txt | 5407 | 2F5975F5702266501693104A1446CD45F2747A9B21185E2F6CEA77F3373419A5 |
| docs/qa/evidence/release4-production-contamination.json | 3695 | 3AC58C479088B7924330D37D01CCFB7CDC299FAED7834658269EE7CB4044BC36 |
| docs/qa/evidence/release4-report-v2-evidence.md | 1930 | D1C4DF39FF747392214A55CCB0A241FD9B906D39B1B723E66692B48D750FF31C |
| docs/qa/evidence/release4-responsive-accessibility.md | 1568 | 27C746D2BEE78D1ED77F11AE7A1E96E56EC7549D849A2341E3514082E11B77F2 |
| docs/qa/evidence/release4-ui-route-inventory.json | 43003 | 0EEC3C001FFDFE66E0FA25254BFC6AC18B872A88804E9217A7A6ABAA57CDB31E |
| package.json | 3508 | 88C75ACD58474BC13F6424AE93370D3EA850FCBF8CC1690FDEF8FD320665771D |
| packages/contracts/src/index.ts | 185 | AF7DAF5DF2F4F99D951F00B1C451378920F3609F94A81529D3E1137B80C534C1 |
| packages/contracts/src/release4-reports.test.ts | 2597 | 5A4BA1D9A62B5947CF2ACCDFE0B49A6B86BA5FC6665F1ED4F7064758C1521B71 |
| packages/contracts/src/release4-reports.ts | 5056 | 576BC225439ED979B81F5ECBFBDEA9A4CD4947002659DC2A68FB70BA63D09161 |
| packages/contracts/src/release4.test.ts | 976 | DBA265C48C44FB9DE05278715DCD2D3CF188E317929AD657F4490E5E579C4537 |
| packages/contracts/src/release4.ts | 5099 | 1FDDC1920F0EFB016125AAE3E1EDEC90CABDB2EA7A1D8D63F608C786528CDDB3 |
| packages/domain/src/enums.test.ts | 1739 | 84F6231818D9A899963FC2A5D6CE1218E542A3993CADF9AA9D549A34F741094B |
| packages/domain/src/enums.ts | 2269 | 58EA74B886899E5E251C6A124C42B6FAF40F12075E29612205FE772FBCB14954 |
| packages/domain/src/index.ts | 150 | 175AE6728027F2A38BAA437B3AE23D5F755942B210AB1B2018D3474C6FA2D5A0 |
| packages/domain/src/release4-catalog.ts | 33521 | 308F5CD4DF6B00200F7D843655F9F72AF4D0B85086A6DA992B0FECEB2F82F657 |
| packages/test-utils/src/release-gate-runner.test.ts | 790 | 959613BDC95EE2EA9079E52CFDD12B3656174A7B580B6AC6F4AA757DF63C2041 |
| packages/test-utils/src/release-readiness.test.ts | 6526 | E335B196BFD8793AC0183AD7A355FD3C3C234E24522F1F34A77DA856474B1560 |
| scripts/build-android-apk.ts | 8973 | 91BD1BD6A293BACC562BAF5E7ADE4DE4B67F8546806E1019443351EC1E0EBF12 |
| scripts/db.ts | 8818 | 6C680D50551946AAAD4F83923ECC988F642A5B5B3D9D9C37A213A1055391ED7D |
| scripts/measure-release4-catalog-performance.ts | 2959 | 96593BBBE5F7E08D8080A8588593CA94692CD7764838B495A29ADCB9F4A9D9FA |
| scripts/pixel-lock/android-pixel-lock.ts | 34241 | 566B079020D76B6F1EAF1301FA01752B6AD61E66A44A81BC3B2213F9CD8C376C |
| scripts/pixel-lock/build-pixel-apk.ts | 6104 | 66DB4EF42F8B5A15294133BD8A0A262FA2F15CB6A75251244AC9760AE56ABB90 |
| scripts/release-gate.ts | 10844 | 670CF4CEC46CA0BC410D63187C718B460EF714555CF47FFDF2A2A3CE5A9EEFA4 |
| scripts/run-catalog-audit.ts | 673 | C77564B32D2A245027CD6CD0584F246DA973E0EB5ECCA08E8B6779C112EC96DB |
| scripts/ux-contract.ts | 8992 | 1689A0CB89D4B0F24A337D673A250D0F5DA792B12906FF4109F57B77D58F6649 |
| scripts/verify-release4-contamination.ts | 4252 | 7A51F2E80E367FC69DC132E240D3782E0550DB4161D2468AE3AFA79046E618B0 |
| scripts/verify-release4-databases.ts | 10398 | 2CE4B8F0D736A5666AA1E11DB270212531C346B152EF58C3D7DBA1CFAAB49020 |

## Remotes (read-only capture)

```text
origin	https://github.com/ggbu75769-dot/WooriAI.git (fetch)
origin	https://github.com/ggbu75769-dot/WooriAI.git (push)
```

No checkout, reset, clean, staging, commit, push, deploy, store upload, or remote write was performed by this capture.
