# Sprint 2 Catalog Quality and Commerce Coverage

Generated: 2026-07-15 (Asia/Seoul)

Validated source SHA: `378906b638b3b7bce902c5f03f8e28af6693dfca`

## Decision

Commerce policy **A** is selected and enforced by `pnpm catalog:coverage`.

- Unique reviewed/active items: 160
- Commerce-enabled items: 58
- Active links: 98; inactive links: 0
- Items with 0 / 1 / 2+ links: 102 / 18 / 40
- Core items with 2+ links: 40/40
- Essential items with at least one link: 21/51 (41.2%)
- Platform distribution: `custom: 58`, `naver: 40`

The 40 comparison links are non-affiliate Naver Shopping search destinations. Existing custom links remain intact. Items without links continue to provide preparation information and check-state functionality without presenting a purchase CTA.

## Stage coverage

| Stage | Reviewed active | Minimum | Commerce items | Active links |
| --- | ---: | ---: | ---: | ---: |
| pregnancy_early | 15 | 15 | 4 | 8 |
| pregnancy_mid | 18 | 15 | 7 | 14 |
| pregnancy_late | 25 | 25 | 13 | 26 |
| newborn_0_3 | 28 | 25 | 17 | 34 |
| infant_4_6 | 24 | 18 | 13 | 26 |
| infant_7_12 | 27 | 18 | 15 | 27 |
| toddler_1_3 | 27 | 20 | 16 | 25 |
| kid_4_7 | 21 | 18 | 11 | 14 |
| elementary | 18 | 15 | 9 | 11 |
| middle_school | 16 | 12 | 7 | 9 |

## Editorial gate

The blocking checks pass with zero failures:

- Duplicate code or exact duplicate name
- Missing stage, reason, skip guidance, review date, or active review state
- Inverted or link-mismatched price range
- Missing medical safety text where required
- Unsupported category or orphan product link
- Non-HTTPS, non-allowlisted, platform-mismatched, or item-path-mismatched URL
- Missing affiliate or sponsorship disclosure
- Repeated exact `skipReasonText`

The prior repeated skip template was replaced with item-specific guidance, and generic scaffold grammar was normalized. URL validation is deterministic schema/host/policy validation; it does not claim a live fetch of every external destination.

## Human review and non-blocking warnings

Two similar-name pairs were reviewed and retained as distinct products:

- Car seat vs. newborn car-seat insert: regulated restraint product vs. size-support accessory.
- Teether vs. teether storage case: oral-use item vs. hygiene/storage accessory.

Category concentration is reported, not hidden:

- `care_education`: 27 (16.9%)
- `feeding_babyfood`: 25 (15.6%)

## Reproduction

```powershell
pnpm catalog:validate
pnpm catalog:coverage
pnpm sprint2:verify-db
```

`sprint2:verify-db` uses only `wooriai_sprint2_fresh_verify` and `wooriai_sprint2_upgrade_verify`, validates a fresh install and Sprint 1-to-latest upgrade, and removes both unless `--keep` is supplied.
