# Release 4 Android evidence

## Artifact and install

- APK: `artifacts/android/wooriai-0.0.0-release-standalone.apk`
- SHA-256: `318AB0229F37FFF868E65662CA82F5C459938354B2C3DF2D0AA770B0E1EFE158`
- Bytes: `77,557,203`
- Embedded JS SHA-256: `5657C2156B5DF1FBC1ED9A416D580494FA197125A0008F164ECF3F2EB3B665A2`
- Generated JS SHA-256: same; build hard gate passed
- Package: `com.anonymous.wooriai`, version `0.0.0` (1), min 24, target 34
- Signing: v2, Android Debug certificate; internal only
- Device: `emulator-5554`, Android 15 / API 35
- `adb install -r`: Success in 69.519 s; first install time preserved and
  `lastUpdateTime` changed to `2026-07-15 16:53:45` device time.

Cold explicit launch returned `LaunchState: COLD`, total 14.073 s. The initial
white screencap was rejected under the repository rule; later captures were made
only after the RN hierarchy rendered.

## Installed app captures

| Flow | Evidence |
| --- | --- |
| Current launch animation | `artifacts/android/release4-final-installed/login-late.png` |
| Current test-login consent | `artifacts/android/release4-final-installed/auth-current.png` |
| ONB-001 status selection | `artifacts/android/release4-final-installed/post-login.png` |
| ONB-003 prepared items | `artifacts/android/release4-final-installed/onboarding-budget.png` |
| HOME-001 | `artifacts/android/release4-final-installed/home.png` |
| Preparation route | `artifacts/android/release4-final-installed/items.png` |
| REP-001 | `artifacts/android/release4-final-installed/report.png` |

The login hierarchy contains the current-source `test-login-button` and test APK
consent UI. This distinguishes the final APK from the discarded stale-bundle APK
that showed the obsolete Kakao placeholder screen.

## Not proven

The final standalone APK is not production-signed and intentionally includes test
login/local fixtures. Full route, offline, width/font, Pixel Lock and Play-install
matrices were not rerun for this exact APK.

