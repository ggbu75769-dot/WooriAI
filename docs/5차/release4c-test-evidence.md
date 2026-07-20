# Release 4C test evidence

## Aggregate gate

Node 20.20.2 / pnpm 10.28.1: `release:gate` 11/11 PASS. Source: `docs/qa/evidence/latest-release-gate.md`.

The passing gate includes frozen install, environment contract, Prisma validate/generate, DB start, lint, typecheck, all workspace tests, API E2E, production builds and strict peer dependency validation.

## Targeted evidence

| Area | Result |
| --- | --- |
| Catalog Admin workflow/scheduler/import | 10/10 PASS |
| App config DB-source contract | 2/2 PASS |
| Catalog structural audit | PASS |
| Search corpus | 200/200; p95 200.94 ms |
| Persona generator/domain eval | 20 personas, M2 |
| UX source contract strict | PASS; runtime cells pending |
| Production export contamination | PASS |
| Secret scan | PASS |
| Dependency audit | high threshold PASS; 8 moderate advisories retained |
| Fresh/upgrade database | PASS through 31 migrations |
| Backup/restore | PASS to new database |
| Android Pixel | 9/9 PASS, valid adb captures |
| Standalone installed smoke | PASS for fresh install, login/onboarding/home/preparation/report/restart |

## Evidence boundary

Automated/source tests do not substitute for external reviewer approval, real-provider staging, all-route TalkBack/layout execution, production restore or store-signed beta stability.
