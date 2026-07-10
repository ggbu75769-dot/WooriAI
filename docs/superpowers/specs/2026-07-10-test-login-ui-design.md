# Test Login UI Design

Date: 2026-07-10  
Scope: Android test APK login and `AUTH-001` presentation

## Goal

Make the standalone Android test APK usable without a Kakao account or a separately running API server. Replace the placeholder-looking `AUTH-001` screen with a complete WooriAI-branded login and required-consent experience.

## Root Cause

The current button is labelled `카카오로 시작하기`, but it does not use the Kakao SDK. It calls the development OAuth API with a generated provider token. The standalone APK falls back to `http://localhost:3000/api/v1`, so Android attempts to contact itself and the login always fails when no API server is available.

The current login screen also exposes the internal screen ID and renders its consent controls as raw `[ ]` text, which makes the screen look unfinished.

## Selected Approach

Add a build-scoped local test session. `android:build-apk` will enable this mode with `EXPO_PUBLIC_TEST_LOGIN=1`. The login screen will show `테스트 계정으로 시작하기`; after both required consents are checked, the button starts a persisted local test session and opens the fixture-backed home screen without calling OAuth or consent APIs.

The real OAuth/API path remains in the code for builds where test login is disabled. No Kakao SDK or credential work is included.

## UI Design

The screen will use existing React Native components, theme tokens, and bundled WooriAI assets:

- Brand mark and the `우리아이` name at the top.
- A warm headline and short explanation that this is a test account.
- A compact `테스트용 APK` badge so the local behavior is explicit.
- A white consent card containing two separate required checkbox rows:
  - `이용약관 동의`
  - `개인정보 수집·이용 동의`
- Native accessibility checkbox semantics and visible checked/unchecked states.
- A full-width coral CTA labelled `테스트 계정으로 시작하기`.
- A short note explaining that test data stays on the device and is not a real Kakao login.

The internal `AUTH-001` identifier remains available as a test/accessibility identifier but is not displayed as customer-facing copy.

## State and Navigation

The persisted session store will gain an explicit local-test-session flag and actions to start or clear it. Starting a test session will not create fake OAuth tokens.

On successful test entry:

1. Both required consent controls must be checked.
2. The local test-session flag is persisted.
3. Onboarding is marked as completed for this test session.
4. The app replaces the login route with the four-tab home shell.

On later launches, the root route recognises the persisted local test session and returns to the home shell. Because no access token is present, API queries remain disabled and existing deterministic preview data is used.

When test login is disabled, the existing development OAuth and consent API behavior remains available.

## Error Handling

Local test login has no network dependency, so it does not show the API connection error. The real API login path retains its pending guard and connection error message.

The CTA remains disabled until both required consents are accepted. Repeated presses while a real login is pending remain blocked.

## Tests

Implementation will follow a red-green-refactor cycle. Regression coverage will verify:

- The Android standalone build enables `EXPO_PUBLIC_TEST_LOGIN=1`.
- Test builds display `테스트 계정으로 시작하기` and do not display `카카오로 시작하기`.
- Both required consent rows and the branded login structure exist.
- Starting a local test session persists the explicit test-session state without fake tokens.
- The root route admits a persisted test session to the home shell.
- Existing OAuth, onboarding, Pixel Lock, typecheck, and release gates remain intact.

## Android Verification

After implementation:

1. Run the focused mobile tests and confirm the new regression first fails, then passes.
2. Run the mobile test suite and typecheck.
3. Build `artifacts/android/wooriai-0.0.0-release.apk` with `npm run android:build-apk`.
4. Install the APK on the connected Android emulator.
5. Clear app data, open the installed app, and capture `AUTH-001` with `adb shell screencap` plus `adb pull`.
6. Accept both consents, tap the test-login CTA, and capture the resulting home screen.
7. Relaunch the app and verify the persisted test session returns to home.
8. Run `npm run release:gate`.

## Constraints Preserved

- Keep the fixed P0 screen IDs and four bottom tabs.
- Keep the MVP expense-to-report-to-preparation-item loop unchanged.
- Do not change API, database, auth/RBAC contracts, import behavior, affiliate logging, or recommendation ranking.
- Keep the real OAuth path rather than presenting the local test session as production authentication.
- Use real React Native components and deterministic fixture data; do not use screenshots as UI backgrounds.
- Do not disturb existing Pixel Lock tuning changes in the working tree.
