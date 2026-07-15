# Release 3 API Change Log

Generated: 2026-07-15 (Asia/Seoul)

All product routes remain under `/api/v1`; additions are additive and existing Sprint 2 contracts stay available.

## Added or extended contracts

| Domain | Change |
| --- | --- |
| Auth | OAuth identity normalization, provider adapter, Kakao mobile callback/PKCE completion, production dev-auth lockout |
| Legal/consent | current/versioned legal documents; current/history consent with immutable events and document hash |
| Privacy | deletion/export request creation, status, retry events, ownership transfer/leave/delete guards |
| Jobs/admin | privacy, outbox/DLQ, retry/cancel, link health, notification, integrity, runtime and remote-config operations |
| Product | quick-expense presets, notification preferences/device support, trust/support reports, app-config with ETag |
| Internal | readiness and token-protected metrics without user payloads |

## Compatibility and safety

- generated OpenAPI manifest: 33 paths, source SHA-256 `16a2937d20a01cf38b4777a968e4f08b42a93e194cdd4a9acd4340d41dba20cb`.
- strict contracts live in `packages/contracts`; Nest DTOs validate transport input.
- authorization stays household/user scoped; cross-scope resources are not revealed.
- concurrency-sensitive paths use CAS, advisory/row locks, or unique constraints as appropriate.
- recommendation ranking remains commission-independent and affiliate disclosure remains adjacent to purchase actions.
- legacy auth and payment fields remain dual-read/additive; removal requires a later approved migration.

The detailed route matrix and stable error codes are in `release3-api-contract.md`.
