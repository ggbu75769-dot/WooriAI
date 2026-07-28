# Release 4C known limitations

## External blockers

- 408 catalog items require real editorial decisions; approved/published remain 0.
- 84 high-risk items require external domain/safety review.
- 1,200 coverage cells remain `review_needed`; 300 critical-required cells are explicitly external-review blocked.
- Approved Product Offer data and real merchant adapters are absent; active offers remain 0.
- Real recall, OAuth, push, object storage and merchant providers were not connected.
- External PostgreSQL/Redis/object storage staging, multi-user production-like traffic and production observability were not verified.
- Production signing identity, AAB, Play beta and closed-beta stability were not available.

## Runtime qualification still required

- All 37 routes across every applicable state.
- 63 width/font/Android layout combinations.
- TalkBack traversal, focus restore, keyboard/modal behavior and font scale 1.5.
- Complete installed persona runs, including offline/reconnect and error recovery.
- Populated Report V3 installed verification, family assignment, inventory edit, feedback resolution and recall acknowledgement.

## Security/operations follow-up

- Resolve or formally accept the eight moderate dependency advisories.
- Repeat backup/restore and forward-fix rollback against external staging and production-like data volume.
- Complete real-provider retry, rate-limit, credential rotation and incident drills.

The internal standalone APK uses test login and a debug certificate. It must never be described as a production artifact or Play release candidate.
