# Onboarding hardening instruction chain

## Effective order

1. User implementation plan: audit and fix the six-step onboarding flow, then qualify it on installed Android.
2. Repository `AGENTS.md`: preserve the dirty worktree; adb `screencap` is the only final visual evidence; keep all nine P0 screen IDs and product/legal/RBAC/import constraints.
3. Repository contracts and tests: `/onboarding/*` aliases dispatch to `(onboarding)` V2 screens; production catalog remains published-only/fail-closed.

## Mutation boundary

- Branch stayed `codex/sprint2-catalog-payments` at `db7a7a455afec892b8fa1205e477dbe507a5931d`.
- No destructive Git command, stage, commit, push, PR, deploy, DB schema edit, or Prisma migration edit was performed.
- The shared dirty worktree was preserved. Task edits were limited to onboarding/domain/contracts/mobile/API tests and the Android qualification/build support required by this request.
- The disposable database name was allowlisted as `^wooriai_onboarding_hardening_[0-9]{8}$` before drop.

## Qualification rule

- M1: source and targeted tests.
- M2: full release gate plus deterministic source snapshot and clean build.
- M3: installed Android flow, restart persistence, adb evidence, nine-screen pixel gate, and TalkBack smoke.
- Internal fixtures and debug-signed APK evidence never imply a production catalog publication or production release.
