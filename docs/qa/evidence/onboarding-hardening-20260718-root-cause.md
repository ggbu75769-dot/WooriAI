# Root-cause analysis

## State and payload divergence

Budget value, edit intent, readiness, review rendering, and API payload were owned by separate code paths. Date-only values also passed through UTC-oriented conversion. Schema v3 now centralizes `monthlyBudgetWon` and `monthlyBudgetEdited`; shared readiness/payload builders and local date-only helpers remove those divergent paths.

## Unstable catalog presentation

Prepared-item presentation had no stable semantic item registry or validated icon boundary. It now uses stable item/category codes, an explicit twelve-icon MaterialCommunityIcons allowlist, category fallback, and one draft-backed selection model for individual, all, none, and later actions.

## Modal ownership

Android's native picker already owns its window. Nesting it in an RN modal caused overlapping interaction owners. Android now calls `DateTimePickerAndroid.open` directly; iOS retains one sheet/spinner.

## Completion race and error erasure

Navigation, progress/cache mutation, and draft deletion ran without an authoritative response barrier. The revised sequence is response-schema validation, selected-child/cache activation, progress completion, `router.replace('/(tabs)')`, navigation settlement, then draft cleanup. A persisted idempotency key and single-flight guard prevent duplicate mutations. `ApiClientError` retains non-PII code, request ID, and details while UI mapping distinguishes validation, stale/conflict, auth, network, and server cases.

## Local-session scope mismatch

Installed test-login state and selected-child state could refer to different local identities. The runtime now derives a session-scoped selected-child key and uses the canonical local child ID for completion, so restart routing reads the same completed state that submit wrote.

## Persisted-step routing mismatch

The draft correctly restored its values, but `app/index.tsx` always redirected an incomplete onboarding session to ONB-001. The entry route now maps persisted `currentStep` through `routeForDraftCurrentStep()`, so a restart resumes the corresponding visible stage.

## Local report category leakage

The local report adapter returned category identifiers as display labels, exposing raw UUIDs in the installed report. It now resolves category names through the production-safe shared category resolver, and a local-backend regression test verifies the label boundary without importing internal fixtures into the production catalog path.
