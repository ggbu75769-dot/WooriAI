# Onboarding hardening final report

## Outcome

- M1 — PASS: draft schema v3, default 500,000 won, shared readiness/payload/date contracts, responsive 12-item grid/registry, Android native picker ownership, authoritative completion sequencing, typed errors, and regression coverage are implemented.
- M2 — PASS for the current source-bound startup-crash source: source snapshot `410DA0BB23625C7F6F251ACB1A696E0FB60058A85A9D058CFCE6A8F21E60139C`; `release:gate` 11/11 PASS at `2026-07-19T04:33:01.052Z`.
- M3 — PASS for internal installed-Android functional qualification: the final source-bound APK ran fresh through the three visible onboarding stages, picker, all-select/deselect, none, default budget, restart resume, single completion, HOME/5 tabs, expense/report, item state sheet, font 1.5, and TalkBack bound-service/focus smoke.

## Runtime defects found and fixed

- A previous standalone APK was built with `-PreactNativeArchitectures=arm64-v8a`, while still appearing to contain multiple ABI directories. On x86_64 it lacked `libexpo-modules-core.so`, producing `EventEmitter undefined`, `"main" has not been registered`, and immediate process death. The build now produces a four-ABI APK and validates Expo/Hermes/React Native core libraries per ABI before publishing the artifact.
- The APK build report previously trusted a caller-supplied source hash, and the artifact audit treated any non-empty hash as `BOUND`. Build now recomputes source before and after Gradle, rejects stale expected hashes or mid-build changes before artifact copy, and audit independently recomputes current source. Missing verification is `UNVERIFIED`; mismatched current source is `STALE`.
- Truncated AsyncStorage/Zustand state could reject hydration or leave the root gate blank. Persisted JSON is now validated and discarded when corrupt, session tokens are cleared with a corrupt envelope, and root navigation has a bounded fallback. Installed corrupt-state injection and ten cold-start cycles pass on the isolated x86_64 AVD.
- Persisted draft restart restored values but hard-coded navigation returned to ONB-001. `app/index.tsx` now routes through `routeForDraftCurrentStep(draft.currentStep)`.
- Local Report V3 exposed raw category UUIDs in the chart and accessibility table. The local adapter now resolves the shared Korean category label without importing fixture modules into production-reachable code.
- Starter recommendations exposed three local sellable-product names. The registry/preview/item-template boundary now returns category-only labels such as `기저귀`, `아기띠`, and `블록 세트`.

## Important limits

- The current product contract has three visible onboarding stages. Older 1/6–6/6 evidence is superseded and is not used for MOD_V1 qualification.
- TalkBack result is a bound-service/focus/tree smoke, not a complete human auditory assessment.
- The APK is debug-signed, test-login enabled, and fixture-backed: `INTERNAL_TEST`, not production/store candidate.
- The current APK startup regression was executed on the isolated x86_64 Android 15 AVD. No physical Android device was connected, so physical-device runtime remains `NOT_RUN`.
- The full three-stage onboarding and TalkBack evidence predates the startup-crash rebuild. For the current binary, install, corrupt-state recovery, ABI completeness, and ten repeated cold-starts are PASS; full journey/TalkBack rerun is `NOT_RUN`.
- The twelve-item runtime qualification uses deterministic internal fixtures. Production catalog remains published-only/fail-closed and no publication success is claimed.
- The old 4-tab numeric Pixel Lock reference conflicts with the new 5-tab v2 IA and is not used as a MOD_V1 PASS claim.
- No deploy, stage, commit, push, PR, or destructive Git operation was performed.

## Final artifacts

- Source manifest: `docs/qa/evidence/release5v-source-snapshot.json`
- Full gate: `docs/qa/evidence/latest-release-gate.json`
- Standalone APK: `artifacts/android/wooriai-0.0.0-release-standalone.apk`
- APK audit: `docs/qa/evidence/release5v-native-artifact-audit.json`
- MOD report: `docs/MOD_V1/CODEX_IMPLEMENTATION_REPORT.md`
- Final fresh HOME: `docs/MOD_V1/evidence/android/41-final-fresh-home.png`
- Final report/table: `docs/MOD_V1/evidence/android/32-final-report-labels.png`
- TalkBack smoke: `docs/MOD_V1/evidence/android/42-talkback-smoke.png`
- Category-only starter labels: `docs/MOD_V1/evidence/android/43-category-only-starter-items.png`
- Current follow-up provenance: `docs/qa/evidence/category-label-fix-20260719-provenance.json`
- Current startup-crash APK SHA-256: `5EC5C3695A992F0520500D62F37FF56560DF9164102E288A8CBCBBE98387E32C`
- Current source snapshot SHA-256: `410DA0BB23625C7F6F251ACB1A696E0FB60058A85A9D058CFCE6A8F21E60139C`

The Docker PostgreSQL service started for qualification was stopped. Font scale is restored to 1.0 and TalkBack/accessibility services are restored to disabled/null.

## 2026-07-19 current-source correction

- The earlier hashes and startup-fallback wording above are superseded by this section and `onboarding-hardening-20260718-android-provenance.json` schema v3.
- Root cause of the intermittent logo/blank/false-launch path: a slow native Zustand hydration was treated as a completed logged-out state. The root and index gates now retry persistence reads without setting `hydrated=true` from a timeout, so routing waits for settled session/scope inputs.
- The standalone profile restores the non-sensitive local test session without awaiting SecureStore token reads; stale real tokens remain unavailable to the internal test profile.
- Current source snapshot: `CB4274EF975A2CEE27EC8328FAF6BCAD8EAD4C45869E8078E8982844FF67413D` (889 files, 82 native-explicit files).
- Current APK: `artifacts/android/wooriai-0.0.0-release-standalone.apk`, SHA-256 `D82B3483D1A8F638B38B768A841092C031D914916A2EDC403FA54F29A16E24A4`, 77,757,107 bytes. Installed `base.apk` is byte-identical.
- Embedded profile: `standalone`, Pixel Lock disabled, test login enabled. Hermes SHA-256: `49A21B26F395F91CD2926A8DF46417A27EE07347EEF38324B731F319C55C2995`.
- Verification: mobile typecheck PASS; mobile 79 files / 450 tests PASS; `ux:contract --strict` PASS; final `release:gate` 11/11 PASS at `2026-07-19T15:49:31.880Z`.
- Installed Android: five cold starts retained a live foreground MainActivity with zero fatal/JS exceptions; four reached restored HOME by 12 seconds and the slowest AVD run reached HOME by 20 seconds. Restored values include `TestBaby`, `생후 0개월`, and `예산 500,000원`.
- The installed preparation grid shows category-only labels and distinct semantic icons/colors in three columns. No sellable product name or brand is used as the card title.
- Qualification remains `INTERNAL_TEST`: debug signer, fixture/test-login profile, no physical-device/TalkBack human qualification, no production catalog publication, and no legacy Pixel Lock PASS claim.
