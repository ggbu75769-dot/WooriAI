# Release 4 catalog coverage report

Generated from PostgreSQL by `pnpm catalog:audit` on 2026-07-15.

## Counts

| Metric | Actual | Target | Result |
| --- | ---: | ---: | --- |
| Top-level domains | 24 | >=24 | PASS |
| Level-2 categories | 120 | >=100 | PASS |
| Level-3 categories | 360 | >=300 | PASS |
| Canonical items | 408 | >=400 | PASS |
| Aliases/keywords | 3,278 | >=3,000 | PASS |
| Published | 0 | editorial | BLOCKED, fail closed |
| In review | 408 | n/a | expected |
| Draft/retired | 0 / 0 | n/a | measured |
| High-risk in review | 84 | all actual targets | professional review required |
| V2 product offers | 0 | external content | item-only flow verified |

All 24 top domains contain 17 canonical items. All 19 maternal/child lifecycle
codes contain at least one item. All 24 target scenario tags plus `all` exist.

## Integrity and coverage gates

| Gate | Result |
| --- | --- |
| Lifecycle gaps | 0 |
| Top-category gaps | 0 |
| Orphans | 0 |
| Duplicate normalized canonical names | 0 |
| Alias collisions | 0 |
| Primary category `other` | 0 |
| Required metadata missing | 0 |
| Unsafe/unreviewed high-risk published | 0 |
| Taxonomy cycles/invalid hierarchy | 0 |
| Scenario code gaps | 0 |

The applicability decision matrix contains 624 covered cells and 1,200 explicit
`gap` cells. A gap cell is not an empty lifecycle: it records that the editorial
team has not yet approved applicability or not-applicable status for that exact
item/context pair. It is reported, never converted into synthetic coverage.

Search acceptance is 100/100 representative queries with no misses. Local
PostgreSQL service-layer timing after warm-up was average 3.84 ms, p95 6.85 ms,
maximum 8.94 ms. This is not a production p95 claim.

Machine evidence:

- `docs/qa/evidence/release4-catalog-audit.json`
- `docs/qa/evidence/release4-catalog-performance.json`
- `docs/qa/evidence/release4-database-verification.json`

Publication completeness is **0% (0/408)** until authorized editorial review.
Structural completeness is M2; core installed browsing/state handling is M3.
