# Release 4 known limitations

1. Production catalog readiness is 0%: 408 items are `in_review`, 84 are high
   risk, and there are no published V2 items.
2. The coverage matrix retains 1,200 explicit gap cells; 624 are covered.
3. Product Offer V2 contains no approved merchant rows.
4. A fresh production-shape Hermes export now passes the contamination scan with
   zero findings. No production-signed APK/AAB has been generated; the older
   pre-remediation production APK remains invalid evidence and must not ship.
5. Admin now supports existing-item editorial JSON preview, selected atomic
   apply, error CSV, taxonomy create/update/archive with impact preview and
   guarded reorder, seven queue drill-downs, atomic report resolution,
   state-aware legacy link retry, and the pre-existing revision history/rollback
   flow. It still lacks new-item/taxonomy import, a high-risk review workbench,
   and native R4 offer health/price provider connections.
6. Direct design-system migration is 0/37; 31 route files still use legacy UI
   imports despite 37/37 shared facade/scaffold coverage.
7. Installed evidence covers the principal internal flow, not every state of
   every route or the full width/font matrix. The static scanner retains 35
   possible sub-48 candidates and 212 hardcoded spacing literals.
8. Initial cold start on the Android 15 emulator took 14.073 s before JS startup
   and required additional time for the first animation; this is not a launch
   performance pass.
9. The standalone APK is intentionally test-only: package version `0.0.0`/code 1,
   debug certificate, test login and local fixture data. It is not a store build.
10. The production dependency audit reports 8 moderate vulnerabilities.
11. Verification used Node 25.2.1, not the required Node 20 line.
12. No production config/signing/AAB, staging services, Play install, remote
   deployment, or rollback proof exists. Production remains NO-GO.
