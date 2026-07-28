# Defect reproduction

## Pre-fix defects fixed by this task

1. A new draft had a `null` budget and the UI held edits in component-local state, so the default was absent and restart persistence was not guaranteed.
2. The mobile completion request sent the budget month as `YYYY-MM-DD`, while the API accepted `YYYY-MM`.
3. Prepared items rendered as a one-column list and depended on an unchecked generic icon cast.
4. Android native date selection was opened inside a React Native `Modal`, creating two interactive modal owners.
5. Completion cleanup/cache work raced navigation and collapsed validation, conflict, auth, network, and server failures into one message.

The pre-existing domain/mobile checks recorded in the task plan (`15` domain and `13` mobile) were green while these five defects remained. They are evidence of a coverage gap, not of pre-fix correctness.

## Installed-runtime defect found during qualification

The first standalone installed run completed review but could show a white/redirected state after submit or restart. Device hierarchy and persisted state isolated two causes: the local test session did not activate the selected child's scope, and completion cleanup could trigger the onboarding redirect before tab replacement settled.

The fix uses the canonical local child ID, activates the test-session child scope, resets local completion only when deliberately starting a new local onboarding flow, guards the accepted completion transition, waits for tab replacement to settle, and only then clears the draft. The fresh installed rerun reached HOME and remained there after force-stop/relaunch.
