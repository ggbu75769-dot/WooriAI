# Release 4 APK inspection

Generated: 2026-07-15 22:30 KST

## Final standalone artifact

| Field | Verified value |
| --- | --- |
| Path | `artifacts/android/wooriai-0.0.0-release-standalone.apk` |
| Size | 77,606,551 bytes |
| SHA-256 | `D4F981041FBE60083D8CA2F90E5A58342A5A8C9D6B7340849E66945A22529422` |
| Package/version | `com.anonymous.wooriai`, `0.0.0` (1) |
| min/target/compile SDK | 24 / 34 / 35 |
| ABI | arm64-v8a, armeabi-v7a, x86, x86_64 |
| debuggable/testOnly | absent from manifest; Android defaults false |
| Build profile | `standalone`; Pixel Lock 0; internal test login 1; embedded JS |
| Build task | `assembleRelease --rerun-tasks` |

`apksigner` verification passed with APK Signature Scheme v2. The signer is the
Android debug certificate (`CN=Android Debug`) with certificate SHA-256
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.

Android 15/API 35 installation, clear-data cold start, process launch, and embedded
Hermes execution were captured under `artifacts/android/release4-installed/`.
Logcat contains `ReactNativeJS: Running "main"`.

## Pixel artifact

| Field | Verified value |
| --- | --- |
| Path | `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` |
| SHA-256 | `0B63C1C8D13FD0E551BA8EEB816F1C88FFAE0EE83CDFCF3849943347AAE57DA9` |
| Build task | `assembleRelease -PreactNativeArchitectures=x86_64 --rerun-tasks` |
| Runtime marker | Pixel screen sentinels found for all nine screens |
| Pixel result | 9/9 PASS; worst `ITEM-002 = 0.048747` |

The Pixel builder now always reruns Gradle tasks. This closes a discovered defect
where a prior build report recorded Pixel Lock 1 while Gradle reused a standalone
JS bundle. Invalid/missing-sentinel captures are no longer cacheable.

## Classification

Both files are **internal standalone/Pixel M3 evidence APKs**. They are not a
staging artifact, production-signed AAB, production candidate, or Play-installed
artifact. Debug-certificate signing and version `0.0.0` are explicit release blockers.
