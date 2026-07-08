# WooriAI Rollback Plan

Batch: 11 - QA Release Hardening

## Deploy Order

1. DB migration and seed verification.
2. API deploy and health check.
3. Admin deploy and admin CMS smoke check.
4. Mobile internal rollout, then staged release.

## Stop And Rollback Criteria

| Signal | Threshold | Action |
| --- | --- | --- |
| API 5xx > 2% | Sustained for 5 minutes after deploy | Stop rollout, roll API back to previous release, preserve logs. |
| Crash-free < 99% | Internal or staged mobile release | Halt mobile rollout and revert to previous build. |
| Critical data bug | Any S0 data loss or privacy deletion failure | Stop release immediately, snapshot affected data, start incident review. |
| Affiliate disclosure missing | Any purchase CTA lacks disclosure | Disable affected links or roll back admin/product-link change. |
| Import approval breach | Preview rows save to expenses before confirm | Disable import route, roll API back, audit affected accounts. |

## Component Rollback

| Component | Rollback Path | Verification |
| --- | --- | --- |
| DB | Restore backup or run approved down migration only after data-impact review. | Reports/home totals match pre-release sample accounts. |
| API | Redeploy previous API artifact. | `/api/v1/health`, auth, expense, report, item click smoke pass. |
| Admin | Redeploy previous admin artifact or freeze admin writes by removing admin token. | Admin CMS read smoke and product-link disclosure check pass. |
| Mobile | Halt rollout and revert store/internal release track to previous build. | Login, onboarding, expense save, report, item detail smoke pass on device. |

## Evidence To Capture

- Release version and deploy timestamp.
- `docs/qa/evidence/latest-release-gate.md`.
- Migration ID and backup location.
- Monitoring screenshots for error rate, latency, signup, expense_created, product_link_clicked.
- Incident notes for any S0/S1 issue.
