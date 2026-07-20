# WooriAI Local Self-Implement Current State

## Protected baseline

- Repository: `F:/WooriAI`
- Branch / HEAD: `codex/sprint2-catalog-payments` / `db7a7a455afec892b8fa1205e477dbe507a5931d`
- Starting dirty inventory: 929 entries = 187 tracked unstaged + 742 untracked + 0 staged.
- Current dirty inventory: 631 entries = 189 tracked unstaged + 442 untracked + 0 staged.
- Build/test cleanup changed generated/untracked inventory; existing source ownership was preserved. No reset, checkout, stage, commit, push, or deploy was performed.

## Qualification runtime

- Node: `F:/WooriAI/.toolcache/node-v20.20.2-win-x64/node.exe`
- pnpm: `10.28.1` from Corepack cache
- Android: isolated `wooriai_pixel_5_api35`, Android API 35 / x86_64 / 1080x2340.

## Current truth

| Area | Implemented | Current evidence | Remaining boundary | Status |
| --- | --- | --- | --- | --- |
| Offline expense sync | same-store single flight plus sequential follow-up drain | SI-001 RED→GREEN and full gates | real slow HTTP runtime | DONE |
| Android build source | mobile-owned Metro root/profile and source-bound clean APK | stable source snapshot; installed byte parity | production signer/profile | DONE / SI-006A |
| Startup source boundary | lazy fixture/catalog/offline/deep-link/session-only modules; direct startup imports | startup regressions 4/4; mobile 455/455; release 11/11 | healthy-device latency measurement | PARTIAL / SI-006B |
| Installed stability | final clean APK remains resident and reaches HOME | PID 5/5; fatal 0; HOME adb capture | current AVD compositor invalidates timing | INTERNAL PASS |
| Startup latency | five fixed-time observations attempted | AVD gfx: 13/13 janky, GPU 4.95 s bucket; HOME only in later capture | healthy AVD or physical device | NOT QUALIFIED |
| Onboarding | six-step shared readiness/completion and 500,000 won default | domain/mobile/API tests; installed HOME budget | physical accessibility | LOCAL PASS |
| Recommendation UI | category-only labels and semantic icons/colors | installed preparation capture | production catalog published-only/fail-closed | INTERNAL ONLY |
| Release gate | install through peers | 11/11 PASS, `2026-07-19T23:30:16.135Z` | deploy not authorized | LOCAL PASS |

## Native artifact

- APK: `F:/WooriAI/artifacts/android/wooriai-0.0.0-release-standalone.apk`
- Source snapshot: `F005E526FC59FE404C9460DF4C8841D5C5A49F06288610C40097004E974B46BA`
- APK SHA-256: `63140D5FEE0E79D1379A463781F6489E0E789A540886535583E0FA67968A1DA8`
- Hermes SHA-256: `82415330A925D27CBA75DC62AC4C2DF6B51EB9573750006536521CD33BBE1E82`
- Signer: Android Debug, certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`
- Qualification: internal standalone fixture, version 0.0.0; not production/store.

## Highest remaining risk

SI-006B latency remains the highest local risk. Source and installed stability are green, but the current AVD renderer is not a valid performance instrument. Do not claim startup speed improvement until a healthy compositor produces five repeatable HOME timings.
