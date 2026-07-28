# Release 4 data model and migration

## Final model boundaries

| Concern | Independent model/capability |
| --- | --- |
| Maternal lifecycle | `mother` axis with nine stable lifecycle codes and maternal profile context |
| Child lifecycle | `child` axis with ten stable lifecycle codes and child-specific context |
| Catalog taxonomy | Three-level `domain/category/subcategory` tree with stable codes, paths and ordering |
| Canonical item | Neutral item definition, metadata, lifecycle/scenario rules, review/source/version state |
| Product offer | Separate merchant/title/URL/price/availability/disclosure/health/safety relation |
| Expense taxonomy | Fourteen accounting top categories, independent of the catalog tree |
| Preparation state | Context-bound 12-state plan; item state works without a product offer |
| Content operation | Draft/review/publish/rollback revision flow with editor/reviewer separation |

Recommendation reads fail closed: only published content is eligible, review-required
or retired content is excluded from new production recommendations, and existing user
state remains queryable through compatibility mappings.

## Migration strategy

Migrations are additive. No previously applied migration was edited. Legacy fields
remain readable for one compatibility release; explicit V2 relations are the new write
target. State backfill maps prior values deterministically and stores context identity
so maternal and child plans cannot collide.

## Independent migration verification

| Path | Result |
| --- | --- |
| Empty database -> 000001..000022 -> seed -> audit | PASS; 24/120/360/408/3,278; orphan 0 |
| Release 3 representative snapshot -> latest -> backfill | PASS; legacy expense mapped/preserved, legacy item preserved, plan backfilled |
| Fresh migration count/head | 22 / `000022_catalog_editor_separation` |
| Upgrade post-state | 409 items and 3,279 aliases because one representative legacy item is intentionally preserved |

Evidence: `docs/qa/evidence/release4-database-verification.json`.

## Integrity enforcement

- Stable item/category codes and normalized aliases are unique.
- Parent relations reject self/cycle/invalid-depth structures through service validation.
- Primary category and relation foreign keys prevent orphans.
- Published item validation requires core metadata and approved high-risk review data.
- Product offers cannot substitute for a missing canonical item.
- Preparation context integrity is enforced by migration 000021 and service checks.
- Editor identity is distinct from reviewer/publisher identity after migration 000022.

Remaining migration limitation: the upgrade fixture is representative rather than a
sanitized copy of a production database, because real user data was neither available
nor permitted for this mission.
