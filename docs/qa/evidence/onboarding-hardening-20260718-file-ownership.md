# File ownership boundary

## Task-owned logical patch

The implementation touched these areas. “Touched” does not mean the file was clean at start; overlapping pre-existing content was preserved.

- Domain: `packages/domain/src/onboarding.ts`, `packages/domain/src/money-date.ts`, exports, and focused tests.
- Runtime contracts: `packages/contracts/src/onboarding.ts`, exports, and tests.
- Mobile draft/API/session: onboarding draft and secure storage, API client/local backend, selected-child/session stores, crash adapter, and their tests.
- Mobile V2 UI: `apps/mobile/src/onboarding/{BudgetV2Screen,PathFormScreens,PreparedItemsV2Screen,ReviewScreen,completion,single-flight,starter-items}.ts(x)`, onboarding controls/scaffold, and route dispatchers.
- MOD_V1 mobile UI: theme/design-system primitives, five-tab navigation, HOME, records/expense validation, preparation grid/status sheet, report chart/table, profile/family/budget/notification/privacy routes, local adapter, and related tests.
- API/contracts: onboarding completion DTO/controller/store service, privacy/trust/household runtime contracts, shared nullable deletion response, and focused unit/E2E coverage.
- Targeted data contract: Prisma marketing opt-in timestamp fields and migration `000041_mod_v1_notification_marketing_opt_in`.
- Android qualification: root app config, exact pixel-lock link wiring, standalone/pixel build scripts, screen URLs, Android manifest/plugin support, package/lockfile dependency repairs, and relevant tests.
- Evidence: `docs/MOD_V1/*`, the `onboarding-hardening-20260718-*` files, and final Android artifacts named in the runtime/provenance reports.

## Explicitly not owned by this task

- Broad pre-existing admin, catalog, finance, sync, jobs, legal, auth, infra, asset, docs, Prisma work outside the targeted MOD_V1 fields/migration, and Release 3/4/5 work already present in the dirty baseline.
- `apps/api/prisma/migrations/000039_release5u_onboarding/` and the existing 40-migration history were inputs to qualification, not modified migration output from this task.
- Production catalog publication state, production signing, deployment state, and external services.

No commit boundary was created, so ownership must be read from this manifest rather than inferred from the repository-wide diff.
