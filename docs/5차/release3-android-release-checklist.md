# Release 3 Android Release Checklist

Generated: 2026-07-15 (Asia/Seoul)

| Check | Status | Evidence or required action |
| --- | --- | --- |
| Android SDK/Java available | PASS | adb 37, OpenJDK 17 |
| `versionCode` single source | PASS | `apps/mobile/app.json`, value `1` |
| approved package | BLOCKED | still `com.anonymous.wooriai` |
| approved semantic version | BLOCKED | still `0.0.0` |
| signing config uses external material | PASS | Gradle reads env-referenced keystore/password variables |
| production signing key available | BLOCKED | no key/alias/secrets supplied |
| AAB command fails safely | PASS | `pnpm android:build-aab` stops at `ANDROID_APPROVED_IDENTITY_REQUIRED` |
| Expo Android export | PASS | Hermes bundle, 52 assets |
| embedded Pixel APK build | PASS | SHA-256 `43cc47d4141de0c1856bbb98a660732a4307f9317e4581d0d367b7943ee31200` |
| installed native app validation | PASS | Android 15 AVD, package versionCode 1/versionName 0.0.0 |
| adb Pixel Lock | PASS | 9/9 screens at `<= 0.0500`, generated 2026-07-15 11:02 KST |
| Play internal-track AAB install | BLOCKED | store account/signed AAB absent |
| staging API/OAuth smoke | BLOCKED | staging and real Kakao absent |
| closed-beta stability | BLOCKED | seven-day telemetry absent |

The Pixel APK is an internal release-like build with embedded JS and an explicitly allowed debug signing path. It proves installed Android rendering only; it is not a signed production AAB and cannot support public-release claims.

## Final commands after owner inputs

```text
pnpm release:config
pnpm android:build-aab
pnpm security:audit
pnpm security:secrets
```

After Play internal upload, install the track-delivered artifact, record package/version/signing certificate and Play artifact hash, then run the product smoke suite and adb screenshots again. Do not reuse the internal Pixel APK as store proof.
