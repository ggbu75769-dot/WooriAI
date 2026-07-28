# Release 4 gap backlog

Generated: 2026-07-16 KST. Completion status is intentionally conservative.

## Closed in this pass

| ID | Result | Evidence |
| --- | --- | --- |
| R4-PROV-001 | Independently classified the prior/current APKs and created deterministic source/build/APK provenance | `artifacts/android/release4-build-provenance.json` |
| R4-PROV-002 | Removed ignored stale source bundle precedence and made builds fail on missing/mismatched embedded JS | `scripts/build-android-apk.ts` |
| R4-REP-001 | Added explicit KST/currency/exclusive-end summary contract and same-ledger category/series/maturity output | Report service, shared contracts and E2E tests |
| R4-QA-001 | Added embedded production-bundle contamination scanner | `docs/qa/evidence/release4-production-contamination.json` |
| R4-AUDIT-001 | Separated shared facade coverage from real direct design-system migration | `docs/qa/evidence/release4-ui-route-inventory.json` |
| R4-P0-009 | Removed production-reachable fixture imports and verified a fresh Android Hermes export with zero forbidden signatures | `docs/qa/evidence/release4-production-export-contamination.json` |
| R4-ADM-IMPORT-001 | Added existing-item editorial JSON preview, selected atomic apply, formula-safe error CSV and re-review reset | `artifacts/release4-admin-import-evidence.json` |
| R4-ADM-TAXONOMY-001 | Added taxonomy tree create/update/archive, impact preview, exact-sibling reorder and optimistic version guards | `artifacts/release4-admin-taxonomy-evidence.json` |
| R4-ADM-QUEUE-001 | Added seven typed queue drill-downs, item targeting, atomic report resolution and state-aware legacy link health retry | `artifacts/release4-admin-queue-evidence.json` |

## Open P0 / production blockers

| ID | Classification | Gap | Closure condition |
| --- | --- | --- | --- |
| R4-P0-003 | Repository/content | Published catalog 0/408; all 84 high-risk items await review | Authorized editorial and professional/source approval |
| R4-P0-005 | Repository/product | Admin remains partial after import, taxonomy and queue-detail slices | New-item/taxonomy import, high-risk review workbench, native R4 offer health/price provider connection |
| R4-P0-010 | Repository/UI | Direct design-system migration 0/37; 31 routes still import `src/ui` | Migrate and verify each route without facade-only counting |
| R4-P0-008 | `EXTERNAL_BLOCKED` | No production API/OAuth/push/legal config, production keystore, signed production AAB/APK, staging or Play closed-beta access | Supply controlled environments/credentials, build the signed artifact, repeat contamination scan on it and execute external validation |

## Open P1

| Gap | Current value | Acceptance |
| --- | ---: | --- |
| Coverage decisions | 624 covered / 1,200 gap cells | Review every applicable/not-applicable decision |
| Offers | 0 | Approved merchants, links, price/recall operation |
| Route device matrix | Core installed flows only | All critical states at required widths/font scales |
| Touch targets | 35 static candidates | Manual classification and installed measurement |
| Hardcoded spacing | 212 route literals | Tokenize or explicitly justify |
| Dependency risk | 8 moderate production audit findings | Upgrade/mitigate without regression |
| Node parity | Node 25.2.1 local | Repeat on required Node 20 CI image |

No remote push, cloud deployment, store upload, production database mutation,
keystore creation, commit, or staging was performed.
