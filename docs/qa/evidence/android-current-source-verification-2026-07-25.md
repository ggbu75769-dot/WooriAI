# Android Current-Source Verification — 2026-07-25

## Decision

The current local source produced an installable internal standalone APK. The
project-root artifact and the installed `base.apk` are byte-identical by
SHA-256, the app reached its consent screen after a cold start, and the app
process had zero fatal Android or React Native log matches.

This is internal Android evidence, not production or store qualification. The
artifact uses test login, an Android debug certificate, package
`com.anonymous.wooriai`, version `0.0.0`, and version code `1`.

## Source and artifact binding

- Source snapshot SHA-256:
  `4DE76B24F79C447DBDEB362A60526BF2497A4D756523518ECA8824CA220F35CF`
- Snapshot files: 946
- Explicit Android native files: 85
- Source verification: `VERIFIED_STABLE`
- Build: `pnpm android:build-apk -- --profile standalone`
- Artifact: `F:\WooriAI\wooriai-0.0.0-release-standalone.apk`
- Bytes: `79,536,558`
- APK SHA-256:
  `6C61371D4B20FFC49D39263C5FEB0A1A0B09A264D2740986B0CB0E633E6D7CC3`
- Embedded Hermes bundle SHA-256:
  `E15C7D785529205B882F111AAE79A60D49F50F60C18FEF11B465EE96C4C42D84`
- ABIs: `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`
- Required native libraries verified: `libexpo-modules-core.so`, `libhermes.so`,
  `libreactnative.so`

## Installed runtime

- Device: isolated `emulator-5554`, Android 15 x86_64
- `adb install -r`: PASS
- Cold start: PASS, `com.anonymous.wooriai/.MainActivity`
- Final app PID: `1609`
- Artifact and installed `base.apk` SHA-256: exact match
- Fatal Android/React Native log matches: 0
- Final adb screencap:
  `artifacts/android/runtime/publish-20260725/launch-dialog-dismissed.png`

The low-memory headless emulator showed one `System UI isn't responding`
dialog. The app process remained healthy; after the system dialog was
dismissed, an adb screencap showed the rendered WooriAI consent screen. This is
reported as an emulator System UI limitation, not a physical-device result.

## Release gate

`pnpm release:gate` generated fresh evidence at
`2026-07-25T11:51:45.913Z` and passed all 15 checks:

- secret scan and high-severity production dependency audit
- lint and typecheck
- all 8 workspace test packages, including mobile 561/561
- API E2E 125/125
- real Chromium Admin E2E 9/9
- forced production builds 8/8
- frozen lockfile and strict peer dependency checks

The Android Pixel Lock 9/9 result dated 2026-07-24 remains historical evidence;
the visual gate was not rerun during this dependency/publication task.
