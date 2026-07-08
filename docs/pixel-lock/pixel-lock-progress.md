# Pixel Lock Progress

## Baseline
- Git baseline: `a0c3300 baseline before android pixel lock automation`
- Package source: `apps/mobile/app.json`, `apps/mobile/android/app/build.gradle`, `AndroidManifest.xml`
- Known package: `com.anonymous.wooriai`
- ADB PATH discovery: `C:\Users\nj970\AppData\Local\Android\Sdk\platform-tools\adb.exe`
- Current device: `sdk_gphone64_x86_64`, Android 15, `1080x2340`, density `440`.
- Crop policy: default shared Android app content crop excludes status and navigation bars using uiautomator system-bar bounds. Override only with `PIXEL_ANDROID_CROP=x,y,w,h`.
- Threshold: `0.0500`; new passing target `0.0480`.

## Legacy Web Scores For Orientation Only
| Screen | Score | Status |
| --- | ---: | --- |
| SPL-001 | 0.0645 | fail |
| HOME-001 | 0.1382 | fail |
| EXP-001 | 0.0899 | fail |
| ITEM-001 | 0.1217 | fail |
| ITEM-002 | 0.1443 | fail |
| REP-001 | 0.1185 | fail |
| FAM-001 | 0.1139 | fail |
| IMP-003 | 0.0834 | fail |
| SET-001 | 0.0499 | pass fragile |

## Automation Log
- Created Android-native pixel lock command contract.
- Created compact context/playbook/progress docs.
- Created screen config: `scripts/pixel-lock/pixel-lock-screens.json`.
- Added debug-only `/pixel-lock?screen=<SCREEN_ID>` launcher route.
- Added pixel-lock style/override scaffold for future candidate tuning.
- Verified `npm run pixel:android` writes `artifacts/pixel-lock/android/reports/latest.json` and `.md`.
- Verified `npm run pixel:tune -- --screen IMP-003` writes candidate scaffold under `artifacts/pixel-lock/android/reports/`.
- Verified `npm run pixel:report` prints compact latest report.
- Fixed `npm run release:gate` so it resolves pnpm through npm's own CLI path instead of assuming `pnpm.cmd` is on PATH.
- Verified `npm run release:gate`: PASS at `2026-07-08T04:58:10.759Z`.
- Created isolated AVD home at `F:\WooriAI\.android-avd` because `C:\Users\nj970\.android\avd` is a broken link.
- Created and booted `wooriai_pixel_5_api35`; Android device info: `sdk_gphone64_x86_64`, Android 15, `1080x2340`, density `440`.
- Installed `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
- First real adb capture produced blank white app shell because JS bundle was not loaded.
- Metro via Expo CLI returned web/manifest behavior and `index.bundle` 404 for this bare RN debug APK.
- Added `@react-native-community/cli@15.0.1` to `mobile` dev dependencies to run RN Metro.
- RN Metro starts, but bundle compilation is still blocked by monorepo/pnpm resolver/watch behavior; tuning is not meaningful until a non-blank RN screen is captured.
- Updated `apps/mobile/metro.config.js` to exclude Pixel Lock, Gradle, and native build artifacts from Metro watch scope.
- Added valid-render gate: blank/low-color screenshots, missing sentinels, and JS/runtime log errors report `INVALID` instead of visual `FAIL`.
- Installed project-local Node `22.11.0` in `.toolcache/` for Expo/RN Metro; system Node 25 was not used for Android bundle delivery.
- Fixed Metro config so Android's `.expo/.virtual-metro-entry` is no longer blocked by the `.expo` blockList.
- Fixed `/pixel-lock` route navigation to wait for Expo Router root navigation before `router.replace`.
- Found `adb exec-out screencap -p` captured a white Surface while RN content was visible in uiautomator; switched Android capture helper to `adb shell screencap -p /sdcard/...` plus `adb pull`.
- Verified HOME-001 and SET-001 render real RN content via adb/uiautomator sentinels and non-blank screenshot metrics.
- Verified `npm run release:gate`: PASS at `2026-07-08T08:52:48.460Z`.
- Added readiness polling before capture so adb screenshots wait for expected Pixel Lock sentinels instead of capturing Metro `Bundling 100%` overlays.
- Changed default Android crop policy from full screencap resize to shared content-area crop (`statusBar.bottom` to `navigationBar.top`) for every screen on the device.
- Added Pixel Lock cold starts before each direct screen launch to prevent stale RN warning overlays from contaminating screenshots.
- Accepted `SPL-001` candidate: `groupScale 1.27 -> 1.22`, `topOffset -22 -> -16`; score `0.2079 -> 0.2007`, SET guard stayed `0.0635`.
- Rejected `SPL-001` candidate: generated override `groupScale=1.12`, `topOffset=-109`; score worsened to `0.2531` and was reverted.
- Rejected `IMP-003` candidate: `scale 0.902 -> 0.884`, `scaleY 1.149 -> 1.034`, `topOffset -8 -> -40`; render became invalid/blank and was reverted.
- Accepted `EXP-001` candidate: `quickExpensePixelScale 0.96 -> 0.88`; score `0.1880 -> 0.1729`, SET guard stayed `0.0635`.
- Updated mobile source-contract tests for accepted SPL/EXP pixel constants and verified `npm run release:gate`: PASS at `2026-07-08T12:44:46.508Z`.
- Added Android normalization modes matching existing web rules: `tailCropFill` for `EXP-001`, `containAspect` for `ITEM-001`, `REP-001`, `FAM-001`, `IMP-003`, and `SET-001`.
- Improved Android speed/reliability: first-screen cold start only, warm deep links after that, removed `am start -W`, added post-ready surface settle, and tightened blank/loading screenshot invalidation.
- Added debug-only deep-link override plumbing for future runtime candidates; SET offset candidate was not accepted because it did not produce a valid/improving adb capture.
- Verified full Android adb baseline: all 9 screens `renderValid=true`; Pixel Lock still FAIL by score.
- Verified `npm run release:gate`: PASS at `2026-07-08T14:10:00.470Z`.

## Latest Android Report
Generated by `npm run pixel:android -- --force` after valid RN rendering and shared content-area crop were restored.

| Screen | Render | Score | Status | Top zones |
| --- | --- | ---: | --- | --- |
| SPL-001 | valid | 0.2007 | fail | content/list/cards 0.3260, bottom-cta 0.2493 |
| HOME-001 | valid | 0.1567 | fail | hero/main-card 0.2284, top/status/header 0.1871 |
| EXP-001 | valid | 0.1381 | fail | bottom-tab/footer 0.3707, bottom-cta 0.1327 |
| ITEM-001 | valid | 0.1280 | fail | hero/main-card 0.1919, content/list/cards 0.1630 |
| ITEM-002 | valid | 0.2231 | fail | bottom-tab/footer 0.4174, hero/main-card 0.2796 |
| REP-001 | valid | 0.1249 | fail | content/list/cards 0.1741, bottom-cta 0.1496 |
| FAM-001 | valid | 0.1180 | fail | bottom-cta 0.2703, hero/main-card 0.1618 |
| IMP-003 | valid | 0.1509 | fail | bottom-cta 0.3235, bottom-tab/footer 0.2732 |
| SET-001 | valid | 0.0551 | fail | hero/main-card 0.0952, bottom-tab/footer 0.0879 |

## Next
1. Get `SET-001` below `0.0500` first so it can act as a real guard again.
2. Continue Phase A visual tuning: `SPL-001`, `IMP-003`, `EXP-001`.
3. Keep using adb screenshots only and run full Android gate after each accepted phase.
