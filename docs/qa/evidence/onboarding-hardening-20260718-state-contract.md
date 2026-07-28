# Onboarding state contract

## Draft schema v3

- `DEFAULT_MONTHLY_BUDGET_WON = 500_000`.
- `monthlyBudgetWon` is the budget value source of truth.
- `monthlyBudgetEdited` distinguishes untouched defaulting from explicit user intent.
- Legacy nested `budget` migration is idempotent.
- Custom values and explicit `0` are preserved.
- Only an unvisited `null`/`undefined` budget is defaulted to 500,000 won.
- Explicit “set later” remains `null` and is not silently defaulted on migration or resume.

## Date contract

- Seoul current month is produced by `getSeoulYearMonth()` as `YYYY-MM`.
- Date-only parsing, formatting, and picker conversion use local calendar components and never `toISOString()`.
- Completion month is always `YYYY-MM`; child birth/due dates remain validated calendar dates.

## Readiness and completion

- UI gating, review, and request construction share `getOnboardingReadiness()` and `buildOnboardingCompletionInput()`.
- App entry resumes an incomplete draft from persisted `currentStep` through `routeForDraftCurrentStep()`.
- Unvisited required state cannot submit.
- `SUBMITTING` is both a disabled UI state and a single-flight mutation boundary.
- Retries reuse the persisted idempotency key until authoritative success.
- `ONBOARDING_ALREADY_COMPLETED` only recovers after status re-read proves `completed`.

## Prepared items and picker

- 320–479 dp portrait: three columns.
- 480 dp or landscape: four columns.
- All twelve cards are pressable checkboxes with stable codes/icons, recommended timing, count, all/clear, none, and later actions synchronized to the draft.
- Android picker stores only `set`; dismissed and neutral actions preserve the previous value. iOS owns one sheet/spinner. No platform has two interactive modal owners.
