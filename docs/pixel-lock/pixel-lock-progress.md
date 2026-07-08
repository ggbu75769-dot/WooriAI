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
- Current `pixel:android` status: `BLOCKED` because `adb devices` reports no connected device/emulator.
- Verified `npm run pixel:tune -- --screen IMP-003` writes candidate scaffold under `artifacts/pixel-lock/android/reports/`.
- Verified `npm run pixel:report` prints compact latest report.
- Fixed `npm run release:gate` so it resolves pnpm through npm's own CLI path instead of assuming `pnpm.cmd` is on PATH.
- Verified `npm run release:gate`: PASS at `2026-07-08T04:58:10.759Z`.

## Latest Android Report
| Screen | Score | Status | Note |
| --- | ---: | --- | --- |
| SPL-001 | 1.0000 | blocked | ADB_DEVICE_NOT_FOUND |
| HOME-001 | 1.0000 | blocked | ADB_DEVICE_NOT_FOUND |
| EXP-001 | 1.0000 | blocked | ADB_DEVICE_NOT_FOUND |
| ITEM-001 | 1.0000 | blocked | ADB_DEVICE_NOT_FOUND |
| ITEM-002 | 1.0000 | blocked | ADB_DEVICE_NOT_FOUND |
| REP-001 | 1.0000 | blocked | ADB_DEVICE_NOT_FOUND |
| FAM-001 | 1.0000 | blocked | ADB_DEVICE_NOT_FOUND |
| IMP-003 | 1.0000 | blocked | ADB_DEVICE_NOT_FOUND |
| SET-001 | 1.0000 | blocked | ADB_DEVICE_NOT_FOUND |

## Next
1. Connect or start Android emulator/device.
2. Install/open app.
3. Run `npm run pixel:android`.
4. If baseline captures are produced, tune Phase A screens: `SPL-001`, `IMP-003`, `EXP-001`.
