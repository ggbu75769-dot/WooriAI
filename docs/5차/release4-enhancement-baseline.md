# Release 4 enhancement baseline

Generated: 2026-07-15T18:49:08+09:00  
Business timezone: Asia/Seoul

## Source baseline

| Field | Independently verified value |
| --- | --- |
| Repository | `F:\WooriAI` |
| Branch | `codex/sprint2-catalog-payments` |
| Expected branch | MATCH |
| HEAD | `db7a7a455afec892b8fa1205e477dbe507a5931d` |
| HEAD subject | `docs(release): record release3 evidence and blockers` |
| Configured upstream | none |
| Working tree | DIRTY before this mission turn |
| Pre-existing tracked modifications | 41 files |
| Pre-existing untracked files | 44 files (63 collapsed status entries total) |
| Migration head on disk | `000018_catalog_search_alias` |
| Package manager declaration | `pnpm@11.7.0` |

The complete protected-path snapshot is stored in
`docs/qa/evidence/release4-enhancement-preexisting-working-tree.txt`. No reset,
restore, clean, stash-drop, force-push, or broad staging command is permitted.

## Authority and repository rules read

- Root `AGENTS.md`: installed Android app plus adb `screencap` is the final visual
  truth; browser screenshots are not final evidence.
- `docs/dev/source-lock.md`: locked product loop, five bottom tabs, architecture,
  API/DB compatibility, and affiliate/import/RBAC constraints remain authoritative.
- `docs/dev/do-not-change.md`: protected product, security, and compliance contracts
  remain in force.
- Existing Release 3/Sprint 2 completion and QA reports were treated as audit input,
  not as proof for the current dirty source.

## Current evidence baseline

| Evidence | Finding | Status |
| --- | --- | --- |
| Standalone APK | Exists; 77,599,871 bytes; supplied SHA-256 matches | VERIFIED |
| APK package/version | `com.anonymous.wooriai`, `0.0.0` (1) | VERIFIED |
| APK signing | Android debug certificate, v2 signature | VERIFIED |
| APK debuggable/testOnly | both absent from manifest (default false) | VERIFIED |
| APK target SDK | 34; compiled with 35 | VERIFIED |
| Release gate report | 11 reported PASS steps, generated 2026-07-15T09:08:19Z | HISTORICAL/NOT SOURCE-LINKED |
| Pixel Lock report | 9/9 PASS; worst 0.0489 on Android 15 | HISTORICAL/DIFFERENT APK HASH |
| Pixel APK provenance | HEAD matches but `dirty=true`; hash is `c0f456...75a75` | VERIFIED GAP |
| Supplied standalone APK hash | `be56b6...324c` | VERIFIED |
| Installed screenshot | file exists, but no cryptographic source/APK link | UNVERIFIED RUNTIME LINK |

## Baseline decision

Phase 0 result: **PASS with provenance gaps recorded**.

The source branch/HEAD, dirty tree, migration head, and supplied APK identity are
now fixed. The APK is correctly classified as an internal standalone test artifact.
The current release-gate and Pixel Lock reports cannot close M2/M3 for the current
dirty implementation because the release report lacks a source-tree hash and the
Pixel APK hash differs from the supplied standalone APK. Fresh gates and a fresh
source-linked Android build/capture are required later in this mission.

## Final verification update

The baseline above remains the protected starting point. The mission completed
against the same branch and HEAD without resetting the pre-existing dirty tree.

| Field | Final independently verified value |
| --- | --- |
| Migration head | `000022_catalog_editor_separation` (22 migrations) |
| Fresh release gate | PASS, 11/11 steps, generated `2026-07-15T13:21:17.201Z` |
| Final standalone APK | 77,606,551 bytes; SHA-256 `D4F981041FBE60083D8CA2F90E5A58342A5A8C9D6B7340849E66945A22529422` |
| Standalone runtime | Android 15 fresh install/clear-data/cold start PASS; embedded Hermes JS logged `Running "main"` |
| Pixel APK | SHA-256 `0B63C1C8D13FD0E551BA8EEB816F1C88FFAE0EE83CDFCF3849943347AAE57DA9`; forced `--rerun-tasks` |
| Pixel Lock | 9/9 valid adb captures PASS; worst `ITEM-002 = 0.048747` |

This update does not change the artifact classification: both APKs are internal,
debug-certificate-signed evidence artifacts, not staging, Play, or production artifacts.
