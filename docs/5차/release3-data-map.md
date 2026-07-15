# Release 3 Data Classification and Lifecycle Map

Updated: 2026-07-15 (Asia/Seoul)

Legend: `yes` in Export means the authenticated subject export includes the record or an appropriate projection. Raw secrets, operational hashes, and third-party credentials are never exported.

| Data / models | Class | Creator | Read / change authority | Delete / retention policy | Export | Logs / analytics | Processor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `users`, `oauth_identities` | identity | OAuth adapter / user | subject; restricted admin support | erase direct PII and unlink identities on deletion; anonymized actor only where shared integrity requires it | yes | internal IDs only; no email/phone/provider subject | OAuth providers |
| `refresh_tokens`, `oauth_transactions`, `admin_sessions` | authentication secret/token | auth services | server only; revoke/consume only | short configurable TTL; purge used/revoked/expired | no | never log token, code, verifier, nonce, signed URL | OAuth provider for code exchange |
| `households`, `household_members`, `household_invites` | household | owner / invited user | member RBAC; owner controls membership | owner transfer before shared-household exit; sole household purge subject to policy | yes | IDs/action only | notification provider for invitations |
| `children`, `child_item_statuses` | child | household member | household RBAC | shared household retains after owner transfer; sole household deletion purges; profile PII minimized | yes | no nickname, date, image URL in logs/analytics | object storage if images enabled |
| `expenses`, `budgets`, `user_payment_methods`, future presets | financial | household writer | household RBAC; viewer read-only | soft-delete expenses; archived used payment method; purge with sole household after policy checks | yes | no amount, item name, memo, merchant, payment label | none |
| `categories`, `item_templates`, stages, sources/tags | content | seed/editor/reviewer | public app reads published; CMS RBAC changes | revisions retained for audit; retired rather than destructive delete | no subject export | content IDs/status only | source links are public URLs |
| `product_links`, health, `affiliate_clicks`, `analytics_events` | affiliate/analytics | admin, worker, client | aggregate admin reads; restricted raw access | configured TTL/minimization; click/user IDs anonymized where possible | user-attributable records only where policy approves | strict registry; never raw PII/financial text | affiliate destinations; optional analytics processor |
| `legal_documents`, `consents`, `consent_events` | legal/consent | legal/admin publisher; user actions | public document read; subject consent read/write; admin audit read | append-only evidence subject to approved legal retention; no invented duration | yes | version/hash/action only | none unless approved legal host |
| `privacy_requests`, events, exports | legal/privacy operations | authenticated subject / worker | subject status token or auth; privacy admin | state/event evidence minimized; export object expires and is deleted | request/status yes; archive is the export | no PII payload, file name, URL or archive content | object storage, OAuth unlink processors |
| `import_jobs`, `import_rows`, `attachments` | object/financial | household writer | scoped household access | purge source/rows/object on cancellation, account/sole-household deletion, or configured expiry | import history yes; raw source only if policy permits | no file name, raw row, item, amount or signed URL | object storage; import worker |
| `audit_logs`, `job_outbox`, `dead_letter_jobs`, delivery/integrity rows | operational/audit | API/worker/admin | restricted admin/operations | payload allowlist/redaction; configurable operational retention; resolved DLQ retained minimally | no | already operational; never embed raw PII | Redis is transport only |
| `admin_users`, MFA recovery material | authentication/admin | authorized admin | admin security role only | disable/revoke; secret rotation; approved retention | no | no password, TOTP secret, recovery code or raw email | optional email invitation processor |

## Deletion and export boundaries

- Shared household: ownership must move to an active `co_parent`; shared financial/child rows remain. The departing user's PII, OAuth identities, devices and sessions are removed. Actor references become a non-PII tombstone strategy if integrity requires them.
- Sole household: child, expense, budget, item state, import, attachment/object records are purge candidates. Legal/audit exceptions are explicit configuration and summaries, not silent full-record retention.
- Export includes subject profile, accessible child/household membership, expenses, budgets, item states, consent history and import history. It excludes authentication hashes, admin/audit internals, queue payloads and other members' direct identity data.
- Retention durations are configuration placeholders until legal/operations approval. Release gates reject an unapproved production policy.
