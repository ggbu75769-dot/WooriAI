# Release 4C Admin operations

## Implemented

- Taxonomy tree, parent change, max-depth/cycle checks, CAS reorder, preview, audit and rollback as new revision.
- CSV/XLSX import parser with encoding/schema/size/row limits, formula injection defense, normalization, duplicate/alias/taxonomy/source validation, dry-run, partial error report and review-batch creation.
- Field/revision/source/approval/publish/suspend/recall history and rollback preview.
- Editorial, domain, safety, source, scheduled, suspended/recalled, user report, offer/link, import failure and outbox/DLQ queue surfaces with search/filter/pagination/assignment/RBAC/audit.
- Review manifest importer with schema validation, revision/content-hash match, identity/role mapping, expiry, idempotency and import-not-publish behavior.
- Offer approval, freshness/link/safety state and affiliate disclosure; active approved offers remain zero.

## Safety controls

Self approval returns 403, stale approval returns 409, content-hash changes invalidate approvals, high-risk bulk approval is not provided, import never directly publishes, and concurrent publish has one winner.

## Maturity

API/Admin source and automated tests are M2. No authenticated human operator browser session, external reviewer manifest or production merchant data was available, so Admin operations are not classified M3/M4.
