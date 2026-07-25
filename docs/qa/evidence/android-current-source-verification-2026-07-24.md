# Android Current-Source Verification — 2026-07-24

## Decision

The final local source produced an installable internal standalone APK and a Pixel Lock APK. The standalone APK, its Downloads copy and the installed `base.apk` are byte-identical by SHA-256. The installed app shows the new family icon and all six growth stages beginning with the fetus. All 9 required Pixel Lock screens passed using adb screenshots.

This is internal Android evidence, not production/store qualification. The standalone artifact uses test login, an Android debug certificate, package `com.anonymous.wooriai`, version `0.0.0`, and version code `1`.

## Source binding

- Source snapshot SHA-256: `E52FD2EB88B1FCB975DC35A4F0219E48574FFD0D8E5829E64E0A66F15CA75812`
- Files: 945
- Explicit Android native files: 85
- Verification: `VERIFIED_STABLE`
- Native branding source SHA-256: `330A711E8F11EFA93C5214CDEC3410E27675625FBC5995A545C3DCB35C5BC703`

The snapshot path filter now excludes `.codex` reporting files, as it already excludes `docs`, so evidence-only edits cannot falsely mark an unchanged executable APK as stale. A regression test covers that path.

## Standalone APK

- Build: `pnpm android:build-apk -- --profile standalone`
- Generated: `2026-07-24T05:16:00.614Z`
- Artifact: `artifacts/android/wooriai-0.0.0-release-standalone.apk`
- Downloads copy: `C:\Users\nj970\Downloads\WooriAI-준비템-latest.apk`
- Bytes: `79,531,958`
- SHA-256: `35D8F684195ED2DA209936A3D245231FEC84C448A8B72D61F72400119613880A`
- Embedded Hermes bundle SHA-256: `D7D059A9CA13652D605D75610D8F443359003A29AD918F98FF451CD174F55020`
- Native artifact audit: `ARTIFACT_VERIFIED`, qualification `INTERNAL_TEST`
- ABIs: `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`

Installed-runtime checks on `emulator-5554`:

- `adb install -r`: PASS
- Artifact, Downloads copy and installed `base.apk` SHA-256: exact match
- MainActivity: resumed; process alive
- Native launch window: new family-and-sprout icon visible; retired graph mark absent
- Growth sequence: `태아 → 아기 → 유아 → 초등학생 → 중학생 → 고등학생`
- Reduced-motion entry: fetus visible with previous/next/autoplay controls
- Fatal matches (`FATAL EXCEPTION`, React Native error/exception, Android fatal): 0
- Runtime evidence: `artifacts/android/runtime/standalone-provenance-final`

The fully cleared low-memory AVD can remain in the native launch window for more than 12 seconds. That observation is reported as emulator cold-start latency, not a blank React screen or physical-device startup result.

## Pixel Lock APK

- Build: `pnpm pixel:android:build-apk`
- APK: `artifacts/pixel-lock/android/apks/wooriai-pixel-985bec66d5e901b73f580108756f2a4e8329099d5043d6d6435664b0f313dd5e.apk`
- SHA-256: `985BEC66D5E901B73F580108756F2A4E8329099D5043D6D6435664B0F313DD5E`
- Installed `base.apk` SHA-256: exact match
- Full gate: `pnpm pixel:android`
- Gate generated: `2026-07-24T05:02:55.927Z`
- Device: `sdk_gphone64_x86_64`, Android 15, 1080x2340, density 440
- Capture: `adb shell screencap -p` plus `adb pull`
- Comparison: perceptual blurred MAE, sigma 12
- Threshold: `0.0500`

| Screen | Score | Status |
| --- | ---: | --- |
| SPL-001 Splash | 0.0295 | PASS |
| HOME-001 Home | 0.0389 | PASS |
| EXP-001 Quick expense | 0.0252 | PASS |
| ITEM-001 Recommendation list | 0.0143 | PASS |
| ITEM-002 Product detail | 0.0443 | PASS |
| REP-001 Report | 0.0474 | PASS |
| FAM-001 Family | 0.0382 | PASS |
| IMP-003 Excel preview | 0.0442 | PASS |
| SET-001 More/settings | 0.0142 | PASS |

The final report is `artifacts/pixel-lock/android/reports/latest.json`.
