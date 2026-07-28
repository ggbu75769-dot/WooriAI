# Sprint 0 Android Pixel Gate evidence

Generated: `2026-07-14T11:51:06.670Z`

## Result

- Command: `pnpm exec tsx scripts/pixel-lock/android-pixel-lock.ts android --force`
- Reproduction command: `pnpm pixel:android`
- Status: `PASS` (`9/9`)
- Threshold: every screen `<= 0.0500`
- Render validation: every screen `valid`; no recorded JS/bundle errors
- Capture source: installed Android app using `adb shell screencap -p` and `adb pull`
- Product/APK source commit: `0cf1e2189b342ff4a82a24947a9e3e52825a5b39`
- Reference approval commit: `011d582`
- Pixel runner commit: `decd350`
- APK SHA-256: `9295dfd7268a77210094f7d8750892f26e6d55335a4390e23c151f75e9927cfd`
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

The non-force reproduction completed with the same scores and 9/9 result after the runner was corrected to reuse each cached screenshot's matching XML and logcat evidence. The original full-resolution Android captures approved for this reference set are recorded in `docs/ui-pixel-lock/native-screenshots/sprint0-0cf1e21/manifest.json`.
