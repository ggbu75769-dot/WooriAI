# Installed Android runtime smoke

## Device and binary

- Isolated AVD home: `F:\WooriAI\.android-avd`
- Serial/model: `emulator-5554` / `sdk_gphone64_x86_64`
- Android: 15 / API 35 / x86_64
- Surface: 1080x2340, density 440 (about 393 dp)
- Package: `com.anonymous.wooriai`
- APK: `artifacts/android/wooriai-0.0.0-release-standalone.apk`
- APK SHA-256: `5EC5C3695A992F0520500D62F37FF56560DF9164102E288A8CBCBBE98387E32C`
- Source snapshot SHA-256: `410DA0BB23625C7F6F251ACB1A696E0FB60058A85A9D058CFCE6A8F21E60139C`
- Source binding: `BOUND`; qualification: `INTERNAL_TEST`

The standalone APK was rebuilt from the recorded source snapshot and exercised without Metro. It is debug-signed and uses test login/local fixtures, so it is not a production or store candidate. After the category-label, startup-crash, and source-binding follow-ups, the current source passed the full 11/11 `release:gate` at `2026-07-19T04:33:01.052Z`.

## 2026-07-19 startup-crash follow-up

- Exact failure reproduced from the previous APK on the isolated x86_64 AVD: `TypeError: Cannot read property 'EventEmitter' of undefined`, followed by `"main" has not been registered` and `FATAL EXCEPTION: mqt_native_modules`.
- Root cause: the build command requested only `arm64-v8a`. The APK contained React Native/Hermes libraries for other ABIs but omitted `libexpo-modules-core.so` outside ARM64, so Expo native module registration failed on x86_64.
- Build fix: standalone APKs now default to `armeabi-v7a,arm64-v8a,x86,x86_64` and fail packaging unless every included ABI contains `libexpo-modules-core.so`, `libhermes.so`, and `libreactnative.so`.
- Persisted-state hardening: truncated Zustand/session envelopes are discarded, native storage failures degrade to process-local storage, and the root navigation gate has a bounded hydration fallback.
- Corrupt-state runtime proof: `wooriai-session` and `wooriai-selected-child` were injected as invalid JSON, the APK was reinstalled with `adb install -r`, and both invalid rows were removed after native hydration. The process remained foreground with zero fatal/boot signatures.
- Repeated launch proof: ten independent `force-stop -> cold-start -> 7 second observation` cycles all retained a live PID and foreground `MainActivity`; fatal/boot signature count was `0` in every cycle.
- Native library proof: four ABIs times three required libraries were inspected directly inside the final APK (12/12 present). APK source binding is `BOUND`.
- Final installed screencap: `artifacts/android/wooriai-source-verified-20260719.png`, SHA-256 `B769E9C5333E8CEDEAD72AB2AEDD5FF59267022AD75235A26DB14C87FB04BAE4`. It contains the rendered React Native splash/landing UI rather than a blank Surface capture.
- Source-binding proof: a legacy report with a non-empty hash but no build-time verification was intentionally rejected as `UNVERIFIED`. The current build report records identical `expected`, `before`, and `after` hashes with `VERIFIED_STABLE`; the independent artifact audit recomputed current source and returned `BOUND`.

The three-stage onboarding/TalkBack screenshots below are retained from the earlier functional qualification. The current crash-fix APK was requalified specifically for install, corrupt-state recovery, and repeated cold-start; the entire onboarding journey and TalkBack traversal were not rerun for this binary.

## Final fresh onboarding run

The current MOD_V1 UI has three visible stages: child information, preparation status, and monthly budget.

1. Fresh launch proved that prior HOME state was absent (`35-final-fresh-launch`).
2. Stage 1 rendered as 1/3; child values and Android native date picker were exercised (`36-final-onboarding-1`, `37-final-child-ready`).
3. Picker open/cancel/reopen/set preserved the prior value on cancel and stored the selected local date only (`06-date-picker`, `07-date-cancelled`, `08-child-ready`).
4. The preparation grid rendered three columns at 393 dp. All twelve cards/icons were present and select-all reached 12/12 (`38-final-all-selected`).
5. Stage 3 rendered 500,000 won on first entry and preserved explicit none/later intent (`39-final-budget-none`).
6. Force-stop/relaunch restored the persisted draft directly to 3/3 with the same budget rather than redirecting to the first stage (`40-final-fresh-resume`).
7. Final submit reached HOME with the selected child, 500,000 won budget, and all five tabs visible (`41-final-fresh-home`).

The final evidence is under `docs/MOD_V1/evidence/android`. The installed restart defect found during qualification was fixed by routing from persisted `currentStep` via `routeForDraftCurrentStep()`; the post-fix fresh resume evidence above is authoritative.

## Other installed surfaces

- All eight preparation states: `19-item-status-sheet`.
- Report chart/table parity with Korean category labels and no raw UUID: `32-final-report-labels`.
- Real profile hub: `33-profile`.
- Font scale 1.5 HOME smoke with the five-tab tree retained: `34-font-scale-1.5-home`; the device was restored to 1.0 afterward.
- Category-only onboarding recommendations after the follow-up rebuild: `43-category-only-starter-items`; the visible/accessibility labels include `기저귀`, `아기띠`, and `블록 세트`, and exclude the fixture product-name tokens.

The legacy nine-screen `pixel:android` numeric report belongs to the four-tab reference contract and is not used as MOD_V1 qualification evidence because MOD_V1 requires five tabs. No replacement numeric reference set was fabricated.

## TalkBack

Android Accessibility Suite/TalkBack was enabled and confirmed as a bound spoken/haptic/audible service. HOME remained present and the hierarchy contained a focused labelled node (`42-talkback-smoke`). The service and accessibility settings were restored to disabled/null after capture.

This is service/focus/tree smoke evidence. Complete human auditory review and exhaustive sequential traversal are `NOT_RUN`, so they are not reported as a full TalkBack pass.
# Current standalone rerun — 2026-07-19

- Source snapshot: `CB4274EF975A2CEE27EC8328FAF6BCAD8EAD4C45869E8078E8982844FF67413D`.
- APK/installed base SHA-256: `D82B3483D1A8F638B38B768A841092C031D914916A2EDC403FA54F29A16E24A4`.
- Device: isolated `emulator-5554`, Android 15/API 35, x86_64, 1080x2340/440 dpi.
- Upgrade install preserved the completed local onboarding state and restored HOME with `TestBaby`, `생후 0개월`, and the 500,000 won budget.
- Five non-interactive cold starts: 5/5 live foreground MainActivity, 0 fatal/JS exceptions, 4/5 HOME by 12 seconds, 5/5 HOME by 20 seconds. The slow run remained on the native splash and did not exit or render the false React launch route.
- Preparation runtime: three-column grid, category-only labels, distinct semantic icon/color assignments; evidence `html-redesign-android-20260719/standalone-final-cb4274/items-grid-final.png`.
- Final full source gate: 11/11 PASS. Strict UX contract: PASS. Physical-device and human TalkBack qualification: NOT_RUN.
