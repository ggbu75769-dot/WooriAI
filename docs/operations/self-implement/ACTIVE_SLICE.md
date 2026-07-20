# SI-006B / Android startup module boundary and runtime requalification

## Outcome

`PARTIAL_COMPLETE` — startup ownership was reduced and protected by regression tests; the clean installed APK is stable and reaches HOME, but startup latency is not qualified because the isolated AVD graphics path degraded to 4.95-second GPU frames.

## Confirmed source defects

- The first route statically pulled the standalone fixture backend, catalog, offline lifecycle, and full design-system barrel into the startup graph.
- A completed session waited for secure onboarding-draft hydration even though that draft is relevant only when onboarding must resume.
- Root deep-link APIs and session actions statically evaluated modules that are unused on ordinary startup.
- Metro could not resolve the new workspace domain subpaths without a mobile-owned explicit resolver map.

## Implementation

- Split fixture identifiers from the backend and keep the backend/catalog behind native lazy loaders.
- Split the lightweight sync snapshot from SQLite lifecycle code and mount the lifecycle after first interactions.
- Route completed sessions without waiting for onboarding-draft SecureStore; incomplete sessions remain fail-closed.
- Remove full design-system barrel imports from root, index, tabs layout, and HOME.
- Dynamically load root deep-link API work and session-only onboarding/receipt cleanup.
- Add a lightweight non-blank startup surface and `android-startup-module-boundary.test.ts`.
- Map only the declared `@wooriai/domain/*` source subpaths in Metro; production fixture fail-closed swaps remain intact.

## Verification

- RED→GREEN startup boundary: 4/4 PASS.
- Mobile: 81 files / 455 tests PASS; mobile typecheck PASS.
- Release gate: 11/11 PASS at `2026-07-19T23:30:16.135Z`.
- Clean source snapshot: `F005E526FC59FE404C9460DF4C8841D5C5A49F06288610C40097004E974B46BA`, before/after stable.
- Clean APK: `63140D5FEE0E79D1379A463781F6489E0E789A540886535583E0FA67968A1DA8`.
- Installed `base.apk`: byte-identical.
- Process alive 5/5; Android fatal exception 0; installed HOME and preparation-category screenshots captured.

## Honest runtime boundary

- The final AVD rendered 13/13 measured frames as janky and recorded 12 GPU frames in the 4,950 ms bucket. Fixed 13/20/25-second captures remained on the native splash, while a later capture reached HOME.
- These timings are not accepted as source startup measurements. Startup performance is `NOT_QUALIFIED / AVD_BLOCKED`, not PASS.
- Physical-device, TalkBack, production signing/version, store, push, and deploy remain `NOT_RUN / BLOCKED`.

## Next exact action

Run the same clean APK on a healthy hardware-accelerated AVD or physical Android device. Accept latency only if five cold starts reach HOME with a stable compositor; otherwise add native/JS startup markers around AppRegistry, router readiness, hydration, and HOME query readiness before changing behavior again.
