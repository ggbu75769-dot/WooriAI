# WooriAI Pixel Lock Agent Guide

Scope: this file covers **Android UI Pixel Lock only**. It is not the repo entry point.

- Repo overview / commands / test policy: [`CLAUDE.md`](CLAUDE.md), [`README.md`](README.md).
- Locked behavior (DNC-001~020) has **one source**: [`docs/dev/do-not-change.md`](docs/dev/do-not-change.md) (v0.5).
  Do not keep a second copy of those rules anywhere — read that file and, on conflict, document the
  requested change instead of changing locked behavior.
- Project root is wherever this repo is checked out (Linux/macOS/Windows). No absolute machine path is
  assumed by any command below.

## Fast Context
- Pixel Lock is one workstream among many; the repo has moved on well past it (rounds 13~ shipped API,
  admin, offline, release and store work). Check `docs/5차/` for the current round before assuming
  "only pixel lock is left".
- Final visual evidence must be installed Android app + adb `screencap`.
- Browser, Expo web, Playwright webpage screenshots are not final evidence.
- Do not use full-screen reference screenshots as UI/backgrounds.
- Use real React Native/Expo components and deterministic fixture data.

## Commands
This is a **pnpm workspace** (`packageManager: pnpm@11.7.0` in the root `package.json`); `npm run` is
not the package manager here. Use `pnpm <script>` (or `npx --yes pnpm@11.7.0 <script>` on a machine
without pnpm installed).

- Release gate: `pnpm release:gate`
- Full Android pixel gate: `pnpm pixel:android`
- Embedded Pixel Lock APK: `pnpm pixel:android:build-apk`
- One screen + SET guard: `pnpm pixel:android:screen -- SPL-001`
- Open installed app screen: `pnpm pixel:open -- --screen SPL-001`
- Capture only: `pnpm pixel:capture -- --screen SPL-001`
- Diff latest capture: `pnpm pixel:diff -- --screen SPL-001`
- Candidate scaffold: `pnpm pixel:tune -- --screen SPL-001`
- Latest compact report: `pnpm pixel:report`

## Android
- Package is discovered from `apps/mobile/app.json`, Gradle, manifest, then device packages.
- Known package: `kr.wooriai.app` (`apps/mobile/app.json` → `expo.android.package`).
- ADB is auto-discovered in this order: `ADB_PATH`, `adb` on PATH, `ANDROID_HOME`, `ANDROID_SDK_ROOT`,
  `%LOCALAPPDATA%`, then a legacy Windows fallback path baked into
  `scripts/pixel-lock/android-pixel-lock.ts` — set `ADB_PATH` rather than relying on that last one.
- Artifacts: `artifacts/pixel-lock/android/{screenshots,diffs,heatmaps,logs,reports}`.
- If no device exists, use an isolated AVD home inside the checkout (`<repo>/.android-avd`) instead of the
  user-home `.android/avd` directory.
- Blank white adb captures mean Android JS delivery failed; do not tune against those scores.
- This bare RN debug APK needs React Native Metro or an embedded debug JS bundle before screenshots are meaningful.
- `pnpm pixel:android:build-apk` builds a release-like APK with `EXPO_PUBLIC_PIXEL_LOCK=1` and embedded JS for Metro-free adb validation experiments.
- Embedded export runs from workspace root; root `app.config.js` pins Expo Router to `apps/mobile/app`.
- This device uses `adb shell screencap -p /sdcard/...` + `adb pull`; prior `adb exec-out screencap -p` returned a white Surface while RN content was visible.
- Prefer RN Metro over Expo web/dev server for the existing debug APK; prior Expo attempts returned `index.bundle` 404.
- RN Metro requires `@react-native-community/cli@15.0.1` in `apps/mobile`.
- Keep Pixel Lock, Gradle, and native build artifacts blocked in `apps/mobile/metro.config.js`.
- CI Metro does not watch source edits; restart Metro after source changes, or use `PIXEL_ANDROID_OVERRIDES` only for temporary candidate measurement.

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
The locked-behavior contract is **not restated here**. Read the single source:
[`docs/dev/do-not-change.md`](docs/dev/do-not-change.md) (DNC-001~020, v0.5).

This file used to carry a nine-line English summary of it. That copy was partial — it silently dropped
the money rules, soft delete, gift exclusion, design-token lock, 해요체 copy tone, secrets and
medical-claim rules — and nothing checked it against the source, so it drifted. Visual tuning never
justifies changing API, DB schema, auth, RBAC, import logic, affiliate logging, recommendation ranking
or release tests — the reasons are in that file, per rule ID.

## Known Bad Attempts
- Splash `marginTop=0` worsened badly.
- Splash random viewport/status experiments worsened.
- Product detail `resizeMode="contain"` worsened.
- Product detail viewport changes worsened.
- Product detail large coral CTA worsened.
- Product detail hero height changes worsened.
- Blank white adb shell captures are JS delivery failures, not visual tuning data.

## Done Criteria
- `pnpm pixel:android` passes using adb screencaps only.
- All 9 scores are `<= 0.0500`.
- `pnpm release:gate` passes.
- No screenshot-background cheating.
- Required legal/import/RBAC/product constraints remain visible/tested.
