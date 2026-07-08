# Android Pixel Lock Playbook

## Full Gate
1. Connect/start Android device or emulator.
2. Ensure app is installed.
3. Run `npm run pixel:android`.
4. Read compact result at `artifacts/pixel-lock/android/reports/latest.md`.
5. Full gate fails if any screen score is above `0.0500`.

## One Screen
1. Run `npm run pixel:android:screen -- IMP-003`.
2. The command captures target plus `SET-001` guard.
3. Accept only if target improves by `>= 0.0030` or crosses `<= 0.0500`, and `SET-001` remains `<= 0.0500`.

## Open/Capture/Diff Manually
- Open: `npm run pixel:open -- --screen IMP-003`
- Capture: `npm run pixel:capture -- --screen IMP-003`
- Diff: `npm run pixel:diff -- --screen IMP-003`
- Report: `npm run pixel:report`

## Tune A Screen
1. Check latest target score and zone diagnosis.
2. Edit only screen-specific pixel style constants or debug overrides.
3. Run `npm run pixel:android:screen -- <SCREEN_ID>`.
4. If worse, revert immediately.
5. If accepted, commit: `pixel lock: <SCREEN_ID> <before_score> to <after_score>`.
6. Do not stack unverified candidates.

## Candidate Tuner
1. Run `npm run pixel:tune -- --screen IMP-003`.
2. It writes candidate scaffolds/recommendations under `artifacts/pixel-lock/android/reports/`.
3. Apply one candidate at a time.
4. Re-run target plus guard.

## Recovery
- If candidate worsens and no commit was made: `git checkout -- <changed files>` only for files touched by that candidate.
- If candidate was committed: `git revert <commit>`.
- Do not use `git reset --hard` unless explicitly requested.

## Crop Policy
- Use one global crop rectangle per device only: `PIXEL_ANDROID_CROP=x,y,w,h`.
- If unset, use full adb screencap.
- No per-screen crop hacks.

## Logs
- Full command output goes under `artifacts/pixel-lock/android/logs/`.
- Chat reports only changed files, commands, score table, and blockers.
