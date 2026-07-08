# Pixel Lock Context Pack

1. Scope: visual convergence/automation only for `F:\WooriAI`.
2. Functional `release:gate` is already passing; keep it green.
3. Final visual validation must be Android-native adb screencaps from installed app.
4. Browser, Expo web, Playwright webpage screenshots are useful for debugging only, not final evidence.
5. Full-screen screenshot backgrounds are forbidden.
6. Real React Native/Expo components must render the UI.
7. Package should be auto-discovered; known app package is `com.anonymous.wooriai`.
8. Use `scripts/pixel-lock/pixel-lock-screens.json` as canonical screen config.
9. Artifacts live under `artifacts/pixel-lock/android/`.
10. Detailed logs go to `artifacts/pixel-lock/android/logs/`; do not paste full logs in chat.
11. Compact progress goes to `docs/pixel-lock/pixel-lock-progress.md`.
12. Strict threshold: every screen score `<= 0.0500`.
13. Target for new passing screens: `<= 0.0480`.
14. Guard screen: `SET-001` More/settings; protect it on all targeted checks.
15. Existing legacy web scores: SPL 0.0645, HOME 0.1382, EXP 0.0899, ITEM-001 0.1217, ITEM-002 0.1443, FAM 0.1139, IMP 0.0834, REP 0.1185, SET 0.0499.
16. Work order: Phase A Splash, Excel, Quick expense; Phase B Family, Report, Recommendation; Phase C Home, Product detail.
17. Preserve screen IDs from docs.
18. Preserve 4 bottom tabs: home, records, items/prep, report.
19. Preserve expense -> total -> prep item -> purchase -> post-purchase record/status loop.
20. Preserve affiliate disclosure next to purchase CTA.
21. Preserve sponsored/ad markers.
22. Recommendation score must not include commission rate.
23. Excel import preview rows must not save to expenses before approval.
24. Family invite/RBAC behavior must remain.
25. Do not change API, DB schema, auth, import logic, RBAC, affiliate logging, recommendation ranking, or tests unless only for deterministic visual fixtures.
26. Candidate accept: improve target by `>= 0.0030` or cross threshold; keep SET passing; checked siblings do not worsen over `0.0020`.
27. Shared component accept: at least 3 failing screens improve in aggregate; no checked screen worsens over `0.0030`; SET remains passing.
28. Reject immediately if target worsens, SET exceeds threshold, legal/import/RBAC/product constraints break, or release tests fail.
29. Never stack unverified candidates.
30. Before accepted candidate: commit/checkpoint.
31. Candidate commit format: `pixel lock: <SCREEN_ID> <before_score> to <after_score>`.
32. Known bad: Splash marginTop=0.
33. Known bad: Splash random viewport/status experiments.
34. Known bad: Product detail contain.
35. Known bad: Product detail viewport changes.
36. Known bad: Product detail large coral CTA.
37. Known bad: Product detail hero height changes.
38. Use adb direct launcher: `wooriai:///pixel-lock?screen=<SCREEN_ID>`.
39. Pixel lock route must be debug-only and render real screens.
40. Splash may freeze animation only in pixel-lock/debug mode.
41. Deterministic fixture labels/dates/amounts/order are required.
42. Default crop policy: same device crop for all screens when `PIXEL_ANDROID_CROP=x,y,w,h` is set; otherwise full screencap is resized to reference size.
43. No per-screen crop hacks.
44. Use zone diagnosis for speed only; final score remains global.
45. Use `npm run pixel:android:screen -- IMP-003` for target plus SET guard.
46. Use `npm run pixel:report` for compact latest table.
47. Use `npm run pixel:tune -- --screen IMP-003` to generate/rank candidate scaffolds.
48. Do not reread all docs unless a contract question requires it.
49. Prefer targeted `rg` and JSON reports.
50. Final answer must separate functional local PASS from visual Pixel Lock status.
