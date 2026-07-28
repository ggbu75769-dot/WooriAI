# WooriAI Local Self-Implement Run Log

## 2026-07-20 / Session baseline

- Slice: SI-001 (active)
- protected start: branch `codex/sprint2-catalog-payments`, HEAD `db7a7a4`, dirty 929, staged 0
- exact Git inventory commands executed: porcelain v2 branch status, diff stat/name-status, staged name-status, untracked manifest, 20 commits
- source map: 52 mobile route files, 37 API controller files, Prisma entity/enum map, 79 mobile test files and 69 API test files inspected
- environment anomaly: ambient Node 25.2.1/pnpm 11.9.0 failed before tests with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; no files changed by the attempt
- corrected baseline: pinned Node 20.20.2 + pnpm 10.28.1; mobile 79 files / 450 tests PASS
- last full evidence: release gate 11/11 PASS at 2026-07-19T15:49:31.880Z; Android source-bound internal AVD 5/5 cold-start home by 20s, fatal 0
- next: add failing SI-001 regression test before implementation

## 2026-07-20 / SI-001 complete

- reproduction: actual two-caller interleaving test failed 1/18 with `expected 1 to be 2`; existing suite had hidden the defect with a manual later flush
- implementation: same-store active caller sets a weak follow-up marker; one shared drain runs sequential fixed-snapshot passes and aggregates summaries; cleanup occurs before Promise settlement
- changed product files: `apps/mobile/src/offline/sync-engine.ts`, `apps/mobile/src/offline/sync-engine.test.ts`
- targeted: sync engine 18/18 PASS; adjacent offline 28/28 PASS
- package: mobile typecheck PASS; 79 files / 450 tests PASS
- full regression: release gate 11/11 PASS, generated 2026-07-19T16:24:43.665Z
- source: `71FBB8E043E862ABE7AB1387474BFF742780B8A21EB492BD8CB71452A7150D17`, 889 files, native-explicit 82
- APK: clean standalone `3554C7CAF44A42BCB25133B38AAEBEFCBDFC4472944137B9F9F688D2522703F0`, installed base byte-identical
- Android: isolated API 35 AVD; 3/3 HOME marker at 11.6s / 15.6s / 16.1s; PID 3/3; fatal/JS exception 0
- visual/accessibility evidence: HOME shows TestBaby, 생후 0개월, 예산 500,000원, 5 tabs and sample-data disclosure
- qualification: INTERNAL_TEST only; debug signer, version 0.0.0, physical device/TalkBack NOT RUN
- Git: stage/commit/push/deploy 0
- next: SI-006 startup latency source/timing audit

## 2026-07-20 / SI-006 baseline

- installed source-bound APK remains stable: process alive, HOME reachable, fatal/JS exception 0
- precise capture: Activity displayed 1.489 s; native splash only through elapsed 13.73 s; first RN loading card at elapsed 16.56 s
- `libexpo-sqlite.so` loads around 15 s, so SQLite is downstream of the pre-render interval rather than the initial native blocker
- startup source graph: Metro inline requires absent; root synchronous route reaches API client/local fixture/offline/store graph
- release sourcemap: 1,270 sources / 5,681,494 source bytes; `local-backend.ts` 136,482 bytes, `client.ts` 79,820 bytes
- next: RED regression for effective Metro `inlineRequires`, then minimal transform fix

## 2026-07-20 / SI-006 source-boundary fix and qualification

- RED 1: native Gradle/APK/Pixel/AAB builders were not consistently rooted at `apps/mobile`, so Android builds could bypass the only effective `metro.config.js`.
- direct proof: bundling from the mobile project loaded 1,279 modules and produced SHA-256 `6461088F2AA1B9AC17280789F646D69F8CD9B0D98AC25EE5EE95A4F1FCA64FA0`, while the old native path had kept a stale byte-identical Hermes bundle.
- implementation: Gradle root/entry moved to `projectRoot`; APK, AAB, and Pixel environments use `EXPO_ROUTER_APP_ROOT=app`; profile cache key bumped; report parity added.
- RED 2: stricter regression found one stale Pixel-report value `apps/mobile/app`; report corrected and 2 files / 11 targeted tests passed.
- rejected experiment: source-bound inline-requires APK was stable but slower at 15.24, 16.21, 23.43, 24.57, and 24.60 seconds; transform removed.
- final full gate: 11/11 PASS at `2026-07-19T20:19:13.077Z`, summed gate duration 536,404 ms.
- final source: `15C9FF8046AFD16AA8444D139474EA22E1CAFEF8C8F60107FBECE4C996373477`, 890 files, 82 native-explicit files.
- final APK: `19AB0F1C048576716A3F326D90BD9F7DDA53037755B1E560A83314381387DA6E`; Hermes `1F0A2AEAD99EC711FCD293750D7A03951242D0B670560A2D5C6721FDBD549C6B`; installed base byte-identical.
- Android final: isolated API 35 AVD, HOME 5/5 at 12.69 / 13.39 / 13.05 / 13.11 / 11.60 seconds, PID alive 5/5, fatal/JS exception 0.
- decision: build-source correctness and installed stability PASS; startup performance remains OPEN / NOT_FIXED.
- qualification: INTERNAL_TEST only; debug signer, version 0.0.0, physical device/TalkBack NOT RUN.
- Git: staged 0; no commit, push, or deploy.

## 2026-07-20 / SI-006B startup module boundary and clean requalification

- RED: new startup source test reproduced eager fixture backend, SQLite lifecycle, full design-system barrel, root API, session-only stores, and completed-session secure-draft gating.
- implementation: lightweight fixture identifiers; native lazy backend/catalog loaders; sync snapshot/lifecycle split; completed-session route gate; direct startup component imports; lazy root deep-link/session-only work; explicit Metro domain-subpath map.
- targeted: startup 4/4, login/parity combined 21/21; typecheck PASS.
- mobile: 81 files / 455 tests PASS.
- release gate: 11/11 PASS at `2026-07-19T23:30:16.135Z`; summed stage duration 854,380 ms; JSON SHA-256 `57FCF82FDCE89F155EA2D252BEC0F8929A092FB81A211391C68E7E6DD6A21B15`.
- clean build: source `F005E526FC59FE404C9460DF4C8841D5C5A49F06288610C40097004E974B46BA`, Hermes `82415330A925D27CBA75DC62AC4C2DF6B51EB9573750006536521CD33BBE1E82`, APK `63140D5FEE0E79D1379A463781F6489E0E789A540886535583E0FA67968A1DA8`; installed base byte-identical.
- installed: process alive 5/5, Android fatal 0, HOME reached, 500,000 won visible; preparation page shows category-only labels with colored semantic icons.
- timing boundary: AVD gfx rendered 13/13 frames janky and placed 12 GPU frames in the 4,950 ms bucket. Fixed 13/20/25 s captures stayed on native splash, so startup latency is NOT_QUALIFIED / AVD_BLOCKED.
- Git: staged 0; no commit, push, deploy, or production catalog claim.
