# Release 3 Security and Privacy Review

Generated: 2026-07-15 (Asia/Seoul)

## Implemented controls

| Control | Evidence | Status |
| --- | --- | --- |
| Production fail-closed config | 43 explicit config blockers; non-secret fixture passes | PASS locally |
| Distributed rate/MFA limits | Redis Lua counter with HMAC identifiers; high-risk production failure closes | PASS unit/integration-mock |
| OAuth transaction safety | exact redirect allowlist, state/nonce/PKCE, expiry/replay/concurrent-first-login tests | PASS local/mock |
| Refresh tokens | hashed rotation, CAS/reuse family revocation retained | PASS regression |
| Admin | HttpOnly session, CSRF, MFA, RBAC, last-admin/advisory-lock protection | PASS DB/API tests |
| Logging | structured metadata, shared redactor, no raw user ID/email/memo/amount payloads | PASS tests |
| Link safety | HTTPS/credentials/allowlist, DNS resolution, private IPv4/IPv6 rejection, five redirects, bounded fallback | 11 tests PASS |
| Analytics | explicit opt-in/default-off contract, HMAC anonymous ID, schema/forbidden-key checks | PASS E2E |
| Privacy traceability | versioned legal docs, append-only consent, deletion/export request event history and outbox | PASS local E2E |
| Secrets/dependencies | secret scan PASS; high/critical audit PASS; pinned GitHub actions | PASS with residual moderate findings |

## Privacy data boundary

The canonical data classification and processor map is `release3-data-map.md`. High-risk payment/identity values such as card/account/resident numbers are rejected rather than stored. Export/import formula injection defenses and integer KRW semantics remain covered by regression tests.

## Residual risks

- safe-link DNS validation and HTTP fetch can still be separated by DNS rebinding because the current fetch layer may resolve again; production should use an egress proxy or IP-pinned transport.
- deletion processing anonymizes shared household rows, but complete sole-household purge and real external OAuth unlink/object deletion have not been exercised with production processors.
- export creates the request/outbox contract; encrypted S3-compatible object generation, signed download URL, expiry deletion, and provider retry are not live-verified.
- Redis-backed controls are unit-tested, but no real Redis integration run occurred on this host.
- dependency audit retains 8 moderate advisories; no high or critical advisory remains at the enforced threshold.
- mobile crash adapter is a no-PII boundary/no-op provider until an approved vendor is connected.

## Release decision

Security/privacy code maturity is M2 locally. Production privacy and security readiness is not proven until provider integration, retention approval, staging abuse tests, restore/rollback drills, and alert delivery are complete.
