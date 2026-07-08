# WooriAI Pixel Lock Agent Guide

Project: `F:\WooriAI`

## Fast Context
- Functional gate is already green; remaining work is Android-native UI Pixel Lock.
- Final visual evidence must be installed Android app + `adb exec-out screencap -p`.
- Browser, Expo web, Playwright webpage screenshots are not final evidence.
- Do not use full-screen reference screenshots as UI/backgrounds.
- Use real React Native/Expo components and deterministic fixture data.

## Commands
- Release gate: `npm run release:gate`
- Full Android pixel gate: `npm run pixel:android`
- One screen + SET guard: `npm run pixel:android:screen -- SPL-001`
- Open installed app screen: `npm run pixel:open -- --screen SPL-001`
- Capture only: `npm run pixel:capture -- --screen SPL-001`
- Diff latest capture: `npm run pixel:diff -- --screen SPL-001`
- Candidate scaffold: `npm run pixel:tune -- --screen SPL-001`
- Latest compact report: `npm run pixel:report`

## Android
- Package is discovered from `apps/mobile/app.json`, Gradle, manifest, then device packages.
- Known package: `com.anonymous.wooriai`.
- ADB is auto-discovered from `ADB_PATH`, PATH, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, or `C:\Users\nj970\AppData\Local\Android\Sdk\platform-tools\adb.exe`.
- Artifacts: `artifacts/pixel-lock/android/{screenshots,diffs,heatmaps,logs,reports}`.

## Screens
- `SPL-001`: Splash, ref `docs/ui-pixel-lock/reference-crops/1_png_splash.png`
- `HOME-001`: Home, ref `docs/ui-pixel-lock/reference-crops/1_png_home.png`
- `EXP-001`: Quick expense, ref `docs/ui-pixel-lock/reference-crops/1_png_quick_expense.png`
- `ITEM-001`: Recommendation list, ref `docs/ui-pixel-lock/reference-crops/2_png_recommendation_list.png`
- `ITEM-002`: Product detail, ref `docs/ui-pixel-lock/reference-crops/2_png_product_detail.png`
- `REP-001`: Report, ref `docs/ui-pixel-lock/reference-crops/2_png_report_detail.png`
- `FAM-001`: Family, ref `docs/ui-pixel-lock/reference-crops/2_png_family_invite.png`
- `IMP-003`: Excel preview, ref `docs/ui-pixel-lock/reference-crops/2_png_excel_preview.png`
- `SET-001`: More/settings guard, ref `docs/ui-pixel-lock/reference-crops/3_png_more_menu.png`

## Thresholds
- Required: every screen `<= 0.0500`.
- New passing target: `<= 0.0480`.
- Candidate accept: target improves `>= 0.0030` or crosses `<= 0.0500`; `SET-001` stays `<= 0.0500`; checked siblings do not worsen `> 0.0020`.

## Forbidden Changes
- Do not rename P0 screen IDs.
- Keep 4 bottom tabs: `홈 / 기록 / 준비템 / 리포트`.
- Keep MVP loop: expense record -> total -> prep item -> purchase link -> post-purchase record/status.
- Keep affiliate disclosure adjacent to purchase CTA.
- Keep recommendation ranking independent of commission.
- Keep Excel preview-before-save.
- Keep family RBAC.
- Do not alter API, DB schema, auth, RBAC, import logic, affiliate logging, recommendation ranking, or release tests for visual tuning.

## Known Bad Attempts
- Splash `marginTop=0` worsened badly.
- Splash random viewport/status experiments worsened.
- Product detail `resizeMode="contain"` worsened.
- Product detail viewport changes worsened.
- Product detail large coral CTA worsened.
- Product detail hero height changes worsened.

## Done Criteria
- `npm run pixel:android` passes using adb screencaps only.
- All 9 scores are `<= 0.0500`.
- `npm run release:gate` passes.
- No screenshot-background cheating.
- Required legal/import/RBAC/product constraints remain visible/tested.
