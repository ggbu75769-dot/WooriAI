# Release 3 Feature Matrix

Updated: 2026-07-15 (Asia/Seoul)

| Area | Final local implementation | Remaining release gap | Maturity |
| --- | --- | --- | --- |
| Product data integrity | PostgreSQL/Prisma, reports, link health, report-integrity records and metrics | production integrity schedule/alerts unproven | M2 |
| Mobile offline | existing SQLite outbox/conflicts/tombstones retained; sync state schema added | full per-scope cursor/full-resync wiring remains | M2 baseline; schema M1 |
| Authentication | hashed rotation, OAuth identities, Kakao adapter/PKCE callback, unlink job, production dev-auth denial | real Kakao/unlink staging proof absent | M2 local/mock |
| Consent/privacy | versioned legal docs, immutable events, deletion/export state machine, owner transfer, public pages | approved text, live processors, complete web deletion and sole-household purge proof | M2 local |
| Payment methods | existing safe user-scoped CRUD/default/archive retained; preset integration added | household account redesign not completed | M2 compatibility |
| Quick expense | 90-day shortcuts plus durable preset CRUD/archive/pin | production UX telemetry absent | M2 |
| Catalog/recommendation | 160 reviewed items retained; source/context/link-health schema and safe link checker | normalized production source backfill and egress pinning | M2 logic; content schema M1 |
| Admin/CMS | RBAC/MFA/CSRF/revisions plus operations console and account-control APIs | complete account UI and scheduled retry/cancel UI absent | M2 |
| Queue/worker | separate publisher/worker, outbox, dedupe, DLQ, retry/cancel, schedules | real Redis/crash-recovery integration and import processor absent | M2 controlled tests |
| Remote config | ETag API, audited admin edit, mobile last-known-good/fail-safe, kill switches | production rollout/rollback telemetry absent | M2 |
| Notifications | preferences, delivery state, device/support contracts and worker topic | real provider delivery absent | M2 contract/local |
| Observability | redacted structured logs, trace IDs, metrics, protected endpoint, runbooks, crash boundary | collector/alerts/crash vendor not connected | M2 local |
| Builds/CI | real builds, fresh tests, Redis/Postgres CI, pinned actions, audits/checksums/container scan job | local Docker/Trivy execution not run | M2 |
| Android | reproducible embedded APK installed on Android 15; 9/9 adb Pixel Lock | approved package/version/signing, AAB, Play, staging, beta absent | M3 internal visual |
| iOS | provider-neutral architecture and follow-up checklist | native build, Apple credentials, TestFlight, push/login/deletion proof absent | M1 |

Locked regression contract remains intact: P0 screen IDs; four bottom tabs; expense → total → prep item → purchase link → post-purchase status loop; adjacent affiliate disclosure; commission-independent ranking; Excel preview-before-save; family RBAC.
