# Release 4 design-system migration

## Decision

Shared facade/scaffold adoption is broad, but **direct Release 4 design-system
migration is not complete**. A route is counted as fully migrated only when it
imports the Release 4 surface directly and no longer imports legacy `src/ui`.

## Measured inventory

| Metric | Value |
| --- | ---: |
| Route files | 37 |
| Shared facade/design-system coverage | 37 |
| Direct design-system imports | 3 |
| Routes importing legacy `src/ui` | 31 |
| Fully direct-migrated routes | **0** |
| Shared screen scaffold/equivalent | 37 |
| Loading / empty / error / offline | 16 / 17 / 24 / 5 |
| Raw color literals | 0 |
| Unicode/emoji icon literals | 0 |
| Hardcoded spacing literals | 212 |
| Possible sub-48 targets | 35 |

`pnpm ux:contract --strict` passes the shared safety and scaffold checks. It does
not convert the direct migration count into 100%. Pixel-only report transforms
remain isolated from the production report tree. Exhaustive installed-device
verification of all 37 routes is not claimed.

