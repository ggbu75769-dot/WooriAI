# Sprint 1 Android Pixel Gate evidence

Generated: `2026-07-14T12:26:58.745Z`

## Result

- APK build command: `pnpm pixel:android:build-apk`
- Install command: `adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Data reset command: `adb shell pm clear com.anonymous.wooriai`
- Forced capture command: `pnpm exec tsx scripts/pixel-lock/android-pixel-lock.ts android --force`
- Reproduction command: `pnpm pixel:android`
- Status: `PASS` (`9/9`)
- Threshold: every screen `<= 0.0500`
- Render validation: every screen `valid`; all expected UI sentinels found; no recorded JS/bundle errors
- Capture source: installed Android app using `adb shell screencap -p` and `adb pull`
- Product/APK source commit: `5fc7accbb9504dac0b1354f9c12adb081c33505c`
- Sprint 1 feature commit: `b42439a`
- Sprint 1 regression-test commit: `5abba06`
- APK report dirty state: `false`
- APK SHA-256: `bc3377814b7debad21e057ae14ef035d56e9110989de4b13ac9f01544cf2c62b`
- Package: `com.anonymous.wooriai`
- Device: `sdk_gphone64_x86_64`, Android 15, `1080x2340`, density `440`
- Comparison: shared content crop excluding system bars; perceptual blurred MAE, sigma 12

| Screen | Score | Render | Result |
| --- | ---: | --- | --- |
| SPL-001 | 0.0230 | valid | PASS |
| HOME-001 | 0.0000 | valid | PASS |
| EXP-001 | 0.0000 | valid | PASS |
| ITEM-001 | 0.0000 | valid | PASS |
| ITEM-002 | 0.0489 | valid | PASS |
| REP-001 | 0.0397 | valid | PASS |
| FAM-001 | 0.0363 | valid | PASS |
| IMP-003 | 0.0459 | valid | PASS |
| SET-001 | 0.0195 | valid | PASS |

The forced run produced fresh PNG files between 2026-07-14 21:21:55 and 21:26:42 Asia/Seoul. The normal reproduction completed immediately afterward with the same scores and 9/9 result by reusing the matching screenshot, UI XML, and logcat evidence.

## Release gate

- Command: `pnpm release:gate`
- Result: `PASS` (`11/11`)
- Generated evidence: `docs/qa/evidence/latest-release-gate.md`
- Mobile suite inside the gate: 33 files, 239 tests, PASS
- API full suite inside the gate: 34 files, 168 tests, PASS
- API release E2E inside the gate: 14 files, 68 tests, PASS

## Scope boundary

This evidence proves that the Sprint 1 account/multi-child code did not regress the required nine-screen Android Pixel Lock suite. PROFILE-001 and CHILD-001/002 are not yet registered Pixel Lock screen IDs, so their behavior is covered by the Sprint 1 regression tests and API E2E rather than by a score in this table.
