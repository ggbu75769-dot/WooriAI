# WooriAI Local Self-Implement Blockers

## BLK-001 / Production Android qualification

- Classification: `EXTERNAL_DEPENDENCY`
- Impact: production/store PASS cannot be claimed.
- Evidence: the current source-bound APK is `debug-internal-only`, version `0.0.0`; physical device and TalkBack are NOT RUN.
- Unblock: production signing/version/API profile decision plus a physical Android/TalkBack-capable device.
- Allowed progress: local source, automated tests, clean APK audit, and isolated AVD internal qualification.

## BLK-002 / Current-design Pixel reference governance

- Classification: `CONTRACT_CONFLICT`
- Impact: legacy 9-screen Pixel scores cannot qualify the current 5-tab HTML redesign.
- Evidence: AGENTS references preserve the older 4-tab surface while the installed current UI has 5 tabs; prior provenance marks the old visual gate invalid for this surface.
- Unblock: user-approved current-design reference set and threshold migration.
- Allowed progress: functional/native crash/persistence evidence; no visual Pixel PASS claim.

## BLK-003 / Startup performance physical-device baseline

- Classification: `EXTERNAL_DEPENDENCY`
- Impact: AVD timing proves the current delay and regression direction but cannot certify production-device startup performance.
- Evidence: final API 35 AVD HOME 5/5 at 11.60–13.39 seconds; fatal 0; global inline-requires experiment was worse.
- Unblock: supported physical Android device plus release-profile signing/API decision.
- Allowed progress: instrument and optimize the measured JS/session/store owner locally, retain AVD regression evidence, and keep physical status NOT_RUN.

