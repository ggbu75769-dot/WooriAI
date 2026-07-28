# Release 3 Decision Log

Updated: 2026-07-15 (Asia/Seoul)

| ID | Decision | Reason / consequence |
| --- | --- | --- |
| R3-001 | Work on the existing `codex/sprint2-catalog-payments` branch. | A pre-existing untracked user report makes a branch switch unsafe. The file is excluded from staging and commits. |
| R3-002 | Treat the attached Release 3 instruction as an additive acceptance layer beneath `docs/dev/do-not-change.md`. | New release/privacy/operations features must not alter the locked product loop, screen IDs, RBAC, affiliate disclosure, import approval, or recommendation independence. |
| R3-003 | Reuse existing Sprint 0–2 models and services before adding new ones. | The repository already has payment methods, Kakao prepare/exchange, consent snapshots, delta sync, CMS revisions, audit logs, and privacy preview routes. |
| R3-004 | Use additive Prisma migrations only. | Existing migrations `000001` through `000011` are immutable release history. |
| R3-005 | Keep legacy provider fields and `UserPaymentMethod` compatibility during Release 3. | OAuth identity normalization and household payment-account evolution require dual-read / compatibility windows. |
| R3-006 | Use provider-neutral adapters and fail closed in production when external credentials are absent. | Kakao, notification, object storage, crash reporting, and cloud deployment cannot be truthfully proven locally. |
| R3-007 | Keep analytics and marketing disabled by default and dangerous remote flags OFF. | Privacy-by-default and Release 3 input defaults. |
| R3-008 | Store UTC instants and apply `Asia/Seoul` only to business boundaries and UI. | Prevent KST midnight/month drift without corrupting sync ordering. |
| R3-009 | Use at-least-once queue semantics with idempotent handlers and a transactional DB outbox. | Removes the DB-commit/job-publication loss window and makes retry/DLQ behavior explicit. |
| R3-010 | A local test pass can reach at most M2; an installed adb-captured Android build can reach M3. | No staging, real OAuth console, store signing, or closed-beta evidence is available. |
| R3-011 | Do not invent operator identity, legal retention periods, production package/domain, signing material, or RPO/RTO. | These remain explicit production release blockers enforced by the release gate. |
