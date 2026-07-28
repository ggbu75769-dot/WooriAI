# SI-006 Android build-source qualification

## Result

The installed app no longer relies on an Android build path that bypasses the mobile-owned Metro configuration. The resulting standalone APK is source-bound, byte-matched to the installed package, reaches HOME on every cold start, and has no fatal exception. Startup latency remains open.

## Root cause

`apps/mobile/android/app/build.gradle` used the repository workspace as the React Native root. Expo CLI therefore started outside `apps/mobile`, where no `metro.config.js` exists. Direct mobile bundles and source tests used the correct configuration, while native APK builds could use a different resolver/cache/profile boundary.

## Regression evidence

1. Native-root regression failed before the fix because the Gradle and builder source still used the workspace root or old router-root values.
2. A stricter negative assertion then failed on the stale Pixel report value `EXPO_ROUTER_APP_ROOT: apps/mobile/app`.
3. After correction, `android-startup-evaluation.test.ts` and `android-standalone-apk.test.ts` passed: 2 files / 11 tests.

## Implementation

- React Native Gradle `root` is the mobile project and `entryFile` is `${projectRoot}/index.js`.
- Standalone APK, production AAB, and Pixel builders use `EXPO_ROUTER_APP_ROOT=app`.
- Pixel report values match the actual build environment.
- Metro profile cache version reflects the native-root change.
- Existing auth, API, DB, RBAC, onboarding, catalog, and UI behavior was not changed by this slice.

## Rejected performance experiment

Global Metro `inlineRequires=true` passed source tests but made the installed APK slower. Five cold starts were 15.24, 16.21, 23.43, 24.57, and 24.60 seconds. It was removed before the final gate/build. This experiment is not part of the handed-off APK.

## Verification

| Check | Result |
| --- | --- |
| Targeted native-build tests | PASS, 2 files / 11 tests |
| Final release gate | PASS, 11/11 |
| Source binding | PASS, expected/before/after all `15C9FF...3477` |
| Native audit | `ARTIFACT_VERIFIED`, `INTERNAL_TEST`, `BOUND` |
| APK/install byte parity | PASS, both `19AB0F...DA6E` |
| Cold HOME | PASS 5/5, 11.60–13.39 s |
| Process alive | PASS 5/5 |
| Fatal / JS exception | 0 |
| Visual HOME | PASS, real installed adb screencap |
| Physical device / TalkBack | NOT_RUN / BLOCKED |

## Evidence paths

- APK: `F:/WooriAI/artifacts/android/wooriai-0.0.0-release-standalone.apk`
- Installed base copy: `F:/WooriAI/artifacts/self-implement/20260720-si006/installed-base-native-root.apk`
- Final HOME captures: `F:/WooriAI/artifacts/self-implement/20260720-si006/qualified-native-root-final/home-{1..5}.png`
- Source snapshot: `F:/WooriAI/docs/qa/evidence/release5v-source-snapshot.json`
- Native audit: `F:/WooriAI/docs/qa/evidence/release5v-native-artifact-audit.json`
- Full gate: `F:/WooriAI/docs/qa/evidence/latest-release-gate.json`

## Honest boundary

This is an internal standalone fixture APK signed with the Android debug certificate and versioned 0.0.0. It is not a production/store artifact. The source/build mismatch is fixed; the remaining 10+ second startup latency is not.

