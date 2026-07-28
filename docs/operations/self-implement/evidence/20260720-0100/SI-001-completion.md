# SI-001 Completion Evidence

## Problem and reproduction

- Active create flush used a fixed mutation snapshot.
- An edit appended an update while create was in flight, then its second `flushOutbox()` call received the first Promise without requesting another pass.
- The old test manually invoked a later third flush and therefore passed.
- Regression changed the test to the real two-caller sequence; pre-fix result: 1 failed / 17 passed, `expected 1 to be 2` at `sync-engine.test.ts:532`.

## Root fix

- Same-store concurrent calls still share one Promise and never overlap sends.
- A weak follow-up marker requests a sequential drain pass for mutations appended after the active snapshot.
- Summary counters aggregate across drained passes.
- Cleanup runs inside the async function before Promise settlement so a boundary caller starts a fresh drain rather than attaching to completed work.

## Verification

| Check | Result |
| --- | --- |
| SI-001 regression | PASS, 18/18 |
| Adjacent sync/outbox/volume | PASS, 28/28 |
| Mobile typecheck | PASS |
| Mobile package | PASS, 79 files / 450 tests |
| Full release gate | PASS, 11/11 at 2026-07-19T16:24:43.665Z |
| Source snapshot | VERIFIED_STABLE, `71FBB8E0...50D17` |
| Clean standalone APK audit | ARTIFACT_VERIFIED / INTERNAL_TEST |
| Installed APK hash parity | PASS, `3554C7CA...703F0` both sides |
| Android cold HOME | PASS 3/3, 11.6s / 15.6s / 16.1s |
| Android fatal/JS exception scan | PASS, 0 matches |

## Native evidence

- APK: `F:/WooriAI/artifacts/android/wooriai-0.0.0-release-standalone.apk`
- Build report: `F:/WooriAI/artifacts/android/wooriai-0.0.0-release-standalone.json`
- Installed pull: `F:/WooriAI/artifacts/self-implement/20260720-si001/installed-base.apk`
- HOME screenshot: `F:/WooriAI/artifacts/self-implement/20260720-si001/home-qualified.png`
- Accessibility tree: `F:/WooriAI/artifacts/self-implement/20260720-si001/window-22s.xml`
- Current native audit: `docs/qa/evidence/release5v-native-artifact-audit.json`

## Limits

- Internal standalone test-login fixture only; not production/store artifact.
- Debug certificate, package `com.anonymous.wooriai`, version `0.0.0`.
- Physical device and TalkBack human auditory qualification NOT RUN.
- The installed standalone local backend cannot naturally hold a real HTTP create request in flight; the exact concurrency behavior is proven at the sync-engine boundary test, while native qualification proves the changed bundle installs, starts, and reaches HOME without fatal errors.
