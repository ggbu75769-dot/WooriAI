# Release 4 migration manifest

| Migration | Purpose |
| --- | --- |
| 000013 | Catalog hierarchy and lifecycle taxonomy foundation |
| 000014 | Canonical item V2 and product-offer separation |
| 000015 | Preparation plan status V2 |
| 000016 | Expense taxonomy V2 separation |
| 000017 | Report aggregate V2 support |
| 000018 | Normalized catalog search aliases |
| 000019 | Add `gift_expected` and `replacement_needed` plan states |
| 000020 | Deterministic compatibility state backfill |
| 000021 | Maternal/child preparation context integrity |
| 000022 | Catalog editor/reviewer identity separation |

Head: `000022_catalog_editor_separation`. Fresh and upgrade paths both pass. The
machine-readable results are in `docs/qa/evidence/release4-database-verification.json`.
