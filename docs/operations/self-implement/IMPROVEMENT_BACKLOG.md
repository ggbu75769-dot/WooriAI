# WooriAI Local Improvement Backlog

Priority follows the attached Local-First v2.0 contract. Implemented structure, installed-runtime proof, and external qualification remain separate.

| ID | Problem | User impact | Evidence | Exit condition | Score | Status |
| --- | --- | --- | --- | --- | ---: | --- |
| SI-001 | An edit appended during an active create flush could remain pending | Latest expense could fail to reach the server until another trigger | RED expected 2 calls but got 1; fixed suite and installed APK stable | sequential follow-up drain, outbox empty, final row synced | 43 | DONE |
| SI-006A | Native Gradle builds ran from repo root and could bypass `apps/mobile/metro.config.js` | APK source/profile validation could report a bundle produced under the wrong Metro ownership | RED native-root regression; old/new Hermes hashes; source-bound clean APK | all native builders use mobile root; report parity; source-bound installed APK | 41 | DONE |
| SI-006B | Startup graph owned fixture/catalog/offline and unrelated secure-draft work | Users can interpret the splash interval as a close or frozen app | source graph reduced; 476/476 mobile tests; release 15/15; current-source installed fatal 0; current AVD GPU timings remain compositor-dependent | five HOME timings on a healthy physical-device compositor, then marker-led optimization if still slow | 39 | PARTIAL / DEVICE_BLOCKED |
| SI-002 | Ambient shell Node/pnpm differed from the repository contract | Wrong runtime could remove dependencies or interrupt verification | repository now pins pnpm 11.9.0; Node 25.2.1/pnpm 11.9.0 completed release 15/15, Android builds, and installed runtime proof | pinned package-manager contract and CI compatibility gate stay green | 14 | DONE |
| SI-003 | Delta pull does not persist/use a cursor and relies on query invalidation | Large/offline datasets lack direct delta-convergence proof | `getSyncChanges(token)` ignores cursor/body in the current lifecycle | persisted cursor plus tombstone application and convergence regression | 18 | DEFERRED |
| SI-004 | Current APK uses debug signing/version 0.0.0; physical/TalkBack not run | It cannot be called a production or store candidate | native audit and AVD provenance | production signing/version/API decision plus physical-device qualification | 7 | EXTERNAL_BLOCKED |
| SI-005 | Legacy 4-tab Pixel references conflict with the current 5-tab redesign | Visual scores can be invalid or misleading | AGENTS reference contract versus current installed UI | user-approved current-design references and threshold migration | 10 | BLOCKED |

## SI-006 experiment decision

Global `inlineRequires` remains rejected. Dynamic fixture/client candidates and granular domain loading passed source tests, but candidate AVD timings were not accepted as improvements. The final source retains only explicit, test-protected module ownership boundaries. The final AVD process is stable, but its compositor produced 4.95-second GPU frames, so latency remains unqualified rather than failed or passed.
