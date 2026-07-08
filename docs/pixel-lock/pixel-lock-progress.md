# Pixel Lock Progress

## Baseline
- Git baseline: `a0c3300 baseline before android pixel lock automation`
- Package source: `apps/mobile/app.json`, `apps/mobile/android/app/build.gradle`, `AndroidManifest.xml`
- Known package: `com.anonymous.wooriai`
- ADB PATH discovery: `C:\Users\nj970\AppData\Local\Android\Sdk\platform-tools\adb.exe`
- Current device status: no adb device connected at automation setup time.
- Crop policy: global device crop only via `PIXEL_ANDROID_CROP=x,y,w,h`; otherwise full adb screencap is resized to reference crop size with shared scoring math.
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

## Latest Android Report
| Screen | Score | Status | Note |
| --- | ---: | --- | --- |
| SPL-001 | 0.2674 | fail | blank app shell, not a valid UI score |
| HOME-001 | 0.2409 | fail | blank app shell, not a valid UI score |
| EXP-001 | 0.1306 | fail | blank app shell, not a valid UI score |
| ITEM-001 | 0.1313 | fail | blank app shell, not a valid UI score |
| ITEM-002 | 0.2167 | fail | blank app shell, not a valid UI score |
| REP-001 | 0.1325 | fail | blank app shell, not a valid UI score |
| FAM-001 | 0.0912 | fail | blank app shell, not a valid UI score |
| IMP-003 | 0.1264 | fail | blank app shell, not a valid UI score |
| SET-001 | 0.0656 | fail | blank app shell, not a valid UI score |

## Next
1. Fix Android JS delivery first: either make RN Metro serve `index.bundle` reliably under pnpm, or build a pixel-lock debug APK with an embedded dev bundle.
2. Confirm a non-blank `HOME-001` adb screenshot.
3. Re-run `npm run pixel:android`.
4. If valid screen captures are produced, tune Phase A screens: `SPL-001`, `IMP-003`, `EXP-001`.
