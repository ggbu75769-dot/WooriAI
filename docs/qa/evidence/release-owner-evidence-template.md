# Release Owner Evidence Packet

Purpose: collect the external proof or explicit waivers needed before WooriAI can move from local release-candidate readiness to production release approval.

Local code gates are tracked in `docs/qa/evidence/latest-release-gate.md`. This packet is for evidence that cannot be produced from the local workspace alone.

## Status Values

- `pending`: evidence has not been provided.
- `provided`: evidence link is attached and accepted by the release owner.
- `waived`: release owner explicitly accepts release without this evidence.
- `rejected`: evidence was reviewed and found insufficient.

## Required External Evidence

| Checklist ID | Owner | Status | Required proof | Evidence link | Waiver approver | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| REL-PRE-001 | Release Manager | pending | Code freeze branch, release version, tag or build number. |  |  | GitHub repository and remote branch exists; local changes still need reviewed commits and release-owner version/tag approval. |
| REL-PRE-003 | PM/Legal | pending | Privacy policy, terms, child-data handling, affiliate/sponsor disclosure, and medical-expression review approval. |  |  | Must include approval date and reviewer. |
| REL-PRE-005 | Tech Lead/PM | pending | Analytics event collection proof for onboarding, expense creation, and product-link click, or MVP analytics waiver. |  |  | Local MVP runtime uses stubs. |
| REL-INFRA-001 | Infra Owner | pending | Production env inventory and secret scan output. |  |  | Do not paste secret values into this file. Link to redacted evidence only. |
| REL-INFRA-002 | DB Owner | pending | Migration deploy dry-run, backup procedure, and rollback restore evidence against PostgreSQL or production-equivalent DB. |  |  | Prisma validate/generate alone is not enough. |
| REL-INFRA-003 | Infra Owner | pending | S3/MinIO bucket, CORS, lifecycle/retention, and access-policy proof, or explicit storage waiver. |  |  | Needed before file-backed import/storage features are enabled. |
| REL-BUILD-002 | Mobile Release Owner | pending | Production-signed/EAS iOS and Android artifacts plus physical-device or simulator install evidence. |  |  | Local Android emulator and internal APK proof pass; attach production build URLs, signing profile, iOS proof, and install confirmation. |
| REL-QA-001 | QA Owner | pending | Manual QR-00 through QR-15 pass evidence, including QR-00, QR-13, QR-14, and environment-specific flows. |  |  | Automated regression is green, but manual pass is partial. |
| REL-STORE-001 | PM/Design | pending | Store metadata, screenshots, privacy labels, review notes, and app description approval. |  |  | Required before app-store submission. |
| REL-LAUNCH-001 | Release Manager | pending | Production deploy log for DB -> API -> Admin -> Mobile rollout. |  |  | Must include timestamps and rollback readiness confirmation. |
| REL-LAUNCH-002 | Ops Owner | pending | Monitoring dashboard for API errors, latency, signup, expense creation, and product-link clicks. |  |  | Include alert thresholds and owner. |
| REL-POST-001 | PM/Ops | pending | 24h, 72h, and 7d metrics review plan or completed post-release review evidence. |  |  | Only completed after launch; prelaunch plan can be accepted with waiver. |

## Acceptance Rule

Production release approval requires every row above to be either `provided` with an accepted evidence link or `waived` with a named waiver approver.
