# Sprint 1 profile and onboarding scope

- Date: 2026-07-14
- Status: locally implemented and test-verified; Android device evidence is tracked separately
- Source of truth: this document describes only the Sprint 1 account, child-profile, onboarding, and navigation changes present in the repository

## Implemented scope

### PROFILE-001 account profile

- The common profile action on all four bottom tabs opens the account profile screen in one tap.
- The account profile shows the stored display name, email, and authentication provider.
- Child management, privacy, support, and app information remain reachable from the account profile.
- Logout clears the session, selected child, onboarding progress, React Query cache, and local test-backend data before returning to the launch flow.

### CHILD-001 child list, add, and switch

- A signed-in user can list, add, select, and switch between multiple children.
- Selecting a child invalidates the child-scoped `home`, `expenses`, `items`, `item-detail`, `report`, and `budget` query roots.
- Local test-backend budgets, expenses, prepared-item states, and reports are scoped by child ID.
- Persisted local data from the earlier single-child shape is upgraded with an empty `additionalChildren` collection.

### CHILD-002 child detail and correction

- A child profile can edit the nickname and stage mode.
- Pregnant and born stages require the appropriate date; manual stage accepts an explicit stage value.
- Correcting the stage mode is persisted through both the local backend and the API update contract.
- The detail screen exposes the currently loaded monthly budget and prepared-item completion state, with links to their existing editing flows.

### ONB/NAV guards

- The existing resumable onboarding flow is preserved.
- Outside Pixel Lock fixture mode, entering the tab shell without a selected child redirects to the root flow instead of rendering child-scoped screens with an invalid ID.
- Logged-out direct access to child management redirects to the launch flow.

## Verification completed before Android evidence

- Mobile TypeScript typecheck: PASS
- API TypeScript typecheck: PASS
- Script TypeScript typecheck: PASS
- Mobile test suite: 33 files, 239 tests, PASS
- API onboarding E2E: 4 tests, PASS, including multiple-child creation and stage-mode correction

## Explicitly separate lanes

### PAY-001 custom payment methods

Custom named methods, default selection, disabling, and deletion are not part of this change. `Expense.paymentMethod` is currently a fixed Prisma `PaymentMethod` enum whose safe default is `unknown` (`미지정`). PAY-001 requires a coordinated database, API, migration, and mobile contract change and must not be represented as complete by adding display-only UI.

### Child photo and gender

Photo upload/edit and gender edit are not implemented in this slice. Although related fields exist in parts of the data model, there is no completed upload/storage contract in this Sprint 1 lane. The accepted child-profile implementation here is nickname, stage/date correction, and visibility of budget/prepared-item state.

### Catalog expansion

The 160-item catalog/content expansion is a separate content and data-validation lane and has not started in this change.

## Evidence boundary

The test results above prove local contracts only. Final visual status requires a newly built embedded Android APK, installation on Android, adb `screencap` captures, all nine Pixel Lock scores at or below `0.0500`, and a passing release gate. Do not treat browser, Expo web, or the prior Sprint 0 APK as Sprint 1 visual evidence.
