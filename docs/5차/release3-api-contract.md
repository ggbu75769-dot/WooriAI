# Release 3 API Contract Inventory

Updated: 2026-07-15 (Asia/Seoul)

All routes remain under `/api/v1`. New public inputs and responses must have strict schemas in `packages/contracts`; Nest DTOs are transport validation wrappers, not a second domain contract.

## Existing routes reused without parallel implementations

| Area | Existing routes | Auth / scope | Idempotency / concurrency | Release 3 action |
| --- | --- | --- | --- | --- |
| Auth | `POST /auth/oauth-login`, `/auth/refresh`, `/auth/logout`, `GET /me` | dev login restricted to dev/test; JWT for subject routes | refresh CAS + family revocation | retain compatibility; production blocks dev endpoint |
| Kakao | `POST /auth/kakao/prepare`, `/auth/kakao/exchange` | public transaction with exact redirect allowlist | transaction CAS, state/nonce/replay checks | normalize identity lookup; add provider unlink adapter and mobile completion |
| Household | member list/remove, invite/read/accept | member/owner RBAC | invite token and membership uniqueness | add ownership transfer/leave/delete contracts |
| Expense/budget/report | CRUD, shortcuts, budget, home, monthly/yearly/cumulative/category | child/household RBAC | `Idempotency-Key`, optimistic version | preserve; add payment snapshot and integrity job |
| Payment methods | `/me/payment-methods` CRUD/default | subject user | DB serialization for one default | preserve endpoints; evolve storage compatibly rather than duplicate |
| Items/commerce | child items/status, link click and opaque redirect | household for item state; public redirect | status/upsert and click dedupe policy | add health/freshness fields without ranking commission |
| Import | create/status/rows/update/confirm | household RBAC | confirm transaction; preview before save | route parsing work through worker/outbox |
| Consent | `GET/PUT /consents` | subject | snapshot upsert | connect append-only event and legal document hash |
| Sync | `GET /sync/changes` | all caller household IDs | stable `(updatedAt,id)` keyset cursor | add client cursor persistence/full-resync contract |
| Settings | privacy info; child/household/account preview+confirm | subject/household | two-step confirmation | account confirmation creates privacy state-machine request |
| Admin/CMS | auth/MFA/session, content revisions, item/link/disclosure/click summary | HttpOnly session, CSRF, MFA, RBAC | revision CAS and reviewer separation | extend operations APIs; do not expose raw sensitive payloads |

## New Release 3 routes

| Method and path | Contract | Auth / scope | Idempotency / audit / pagination | Stable errors |
| --- | --- | --- | --- | --- |
| `GET /legal/documents/current` | current published required/optional docs, version/hash | public | ETag; no audit | `LEGAL_DOCUMENT_NOT_FOUND` |
| `GET /legal/documents/:type/:version` | immutable published document | public | cacheable | `LEGAL_DOCUMENT_NOT_FOUND` |
| `GET /consents/current`, `/consents/history` | snapshot + append-only history | subject | history cursor pagination | `AUTH_REQUIRED` |
| `PUT /consents` | document ID/hash/action/source/app version | subject | transaction event+snapshot; audit | `CONSENT_DOCUMENT_MISMATCH`, `REQUIRED_CONSENT_REVOKE_FORBIDDEN` |
| `POST /privacy/data-export` | re-auth proof placeholder plus format request | subject | idempotency key; outbox; audit | `PRIVACY_REAUTH_REQUIRED`, `PRIVACY_REQUEST_ACTIVE` |
| `GET /privacy/requests/:id` | state and safe retention/failure summary | owner subject | no raw processor details | `PRIVACY_REQUEST_NOT_FOUND` |
| `POST /households/:id/transfer-ownership` | target active co-parent, expected owner/version | current owner | serializable transaction/CAS; audit | `OWNER_TRANSFER_TARGET_INVALID`, `OWNER_TRANSFER_CONFLICT` |
| `POST /households/:id/leave` | explicit confirmed action | active member | request idempotency; audit | `OWNER_TRANSFER_REQUIRED` |
| `DELETE /households/:id` | owner confirmation for sole-member household | owner | idempotency; privacy outbox; audit | `HOUSEHOLD_NOT_EMPTY`, `HOUSEHOLD_DELETE_CONFLICT` |
| `GET /app-config` | versioned safe public config | public | ETag/short cache | returns fail-safe config on unavailable optional source |
| payment preset routes | strict preset CRUD/archive/pin | subject and selected household/child context | idempotency for create; audit changes | `PRESET_NOT_FOUND`, `HOUSEHOLD_FORBIDDEN` |
| notification preference/device routes | preference snapshot and token registration | subject | token hash/upsert; audit preference | `NOTIFICATION_PROVIDER_DISABLED` |
| support/link reports | category + internal IDs + bounded reason code | subject/public where documented | rate limit/idempotency; audit | `REPORT_TARGET_NOT_FOUND`, `REPORT_REASON_INVALID` |
| admin operations routes | privacy requests, DLQ, link health, scheduled content, config, deliveries, integrity, runtime | admin/editor/analyst matrix | cursor pagination; high-risk retry/cancel requires MFA+CSRF+audit | `ADMIN_ROLE_FORBIDDEN`, `JOB_STATE_CONFLICT` |
| internal health/metrics | readiness details / vendor-neutral metrics | internal network token in production | no user data | `INTERNAL_AUTH_REQUIRED` |

## Compatibility rules

- existing response fields remain; new fields are additive and nullable/default-safe.
- legacy `users.auth_provider/provider_user_id` dual-read remains until all identities are backfilled and a later approved migration removes it.
- `user_payment_methods` and `expenses.payment_method_id` remain valid while Release 3 adds label snapshots/household semantics.
- error codes are stable strings and authorization failures do not reveal cross-household resource existence.
- all list endpoints added in Release 3 use bounded cursor pagination.
