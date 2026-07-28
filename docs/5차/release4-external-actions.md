# Release 4 external actions

The following actions require authority or assets outside this local mission:

1. Assign authorized editors/reviewers and approve general content sources.
2. Obtain professional review for all 84 high-risk items before publication.
3. Resolve 1,200 applicability decisions and two similar-name review warnings.
4. Provide verified business/legal disclosure text and approved merchant/offer data.
5. Provision real staging PostgreSQL/Redis/object storage and OAuth provider settings.
6. Run staging multi-user, offline/conflict, worker/DLQ and merchant-link E2E.
7. Supply production application ID/version policy and production signing through
   the authorized keystore/Play App Signing process.
8. Build a production-signed AAB, upload to a closed Play track, validate Play-installed
   Android 15 devices, stability, crash/ANR, rollback and data migration recovery.
9. Repeat the release gate in the supported Node 20 CI environment.

No external action above was performed or represented as complete.
