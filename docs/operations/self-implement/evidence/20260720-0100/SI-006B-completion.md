# SI-006B startup module boundary and Android requalification

## Result

Startup source ownership is reduced and regression-protected. The final clean standalone APK passes the complete local gate, installs byte-identically, remains alive in five launches, and reaches HOME without a fatal exception. Startup latency is not qualified because the isolated AVD compositor degraded during the run.

## RED → GREEN

- Before: root/first routes statically reached fixture backend, catalog, SQLite lifecycle, full design-system barrel, root deep-link client, and onboarding/receipt stores.
- Before: a completed session was gated on secure onboarding-draft hydration.
- RED: `android-startup-module-boundary.test.ts` failed each asserted boundary before implementation.
- GREEN: startup boundary 4/4, combined login/parity 21/21, mobile 455/455, release gate 11/11.

## Installed evidence

| Check | Result |
| --- | --- |
| Clean source binding | `VERIFIED_STABLE`, `F005E526...46BA` |
| APK/install parity | PASS, `63140D5F...1DA8` |
| Package | `com.anonymous.wooriai`, 0.0.0 (1), x86_64 |
| Process alive | 5/5 |
| Android fatal exception | 0 |
| HOME | PASS in later adb capture; TestBaby and 500,000 won visible |
| Preparation UI | category-only labels, distinct semantic icons/colors visible |
| Startup timing | NOT_QUALIFIED / AVD_BLOCKED |

## Timing exclusion

The final AVD reported 13/13 janky frames, 100% frame deadline misses, and 12 GPU frames at 4,950 ms. Captures at 13, 20, and 25 seconds therefore remained on the native splash even though the activity and process were resumed; a later capture showed HOME. This is recorded as invalid performance infrastructure, not as a latency PASS.

## Evidence paths

- APK: `F:/WooriAI/artifacts/android/wooriai-0.0.0-release-standalone.apk`
- Pulled installed APK: `F:/WooriAI/artifacts/android/installed-base-final.apk`
- HOME: `F:/WooriAI/artifacts/self-implement/20260720-si006b/final-clean-runs/run-5-late.png`
- Preparation UI: `F:/WooriAI/artifacts/self-implement/20260720-si006b/final-clean-runs/items-installed.png`
- Release gate: `F:/WooriAI/docs/qa/evidence/latest-release-gate.json`

## Boundary

Internal test fixture only. Debug signer, version 0.0.0, no production catalog publication claim. Physical device, TalkBack, production signing/store, commit, push, and deploy were not run.
