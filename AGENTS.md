# WooriAI agent guide

React Native/Expo mobile app, NestJS API, PostgreSQL/Prisma, and admin workspace. Use the package manager pinned in package.json.

## Product contracts
- Keep the expense -> total -> preparation item -> purchase link -> post-purchase record loop.
- Preserve the five tabs: 홈 / 기록 / 준비템 / 리포트 / 더보기 and existing screen IDs.
- Keep affiliate disclosure beside purchase CTAs; ranking is independent of commission.
- Preserve Excel preview-before-save, family RBAC, soft deletion with audit logs, positive integer KRW amounts, and exclusion of gifts from default expense totals.
- Preserve API, DB, auth, import, privacy, and recommendation contracts. Visual tuning must not alter those behaviors or release tests.

## Task routing and verification
- Check branch, dirty files, and the affected workspace first. Read CODEX_START_HERE.md only for product/contract routing.
- For requested Pixel Lock work, read [the Android guide](docs/ui-pixel-lock/AGENT_GUIDE.md). Its nine-screen device gate applies to that work; it does not establish ordinary-runtime or store readiness.
- For script changes: pnpm typecheck:scripts and pnpm test:scripts. For other behavior changes, run the affected package tests and typecheck.
- Run pnpm release:gate for release qualification or shared-boundary changes requiring it. Run pnpm pixel:android for final Pixel Lock qualification. Do not repeat full builds or captures for docs-only edits.
- Existing passing reports are historical evidence; verify their source/input binding before reuse. Report local, device, and store results separately.

## Android handoff
- Write every final APK directly to F:\WooriAI. Keep reports, screenshots, diffs, heatmaps, and logs under artifacts.
- Use real React Native components and deterministic fixtures for Pixel Lock; screenshot backgrounds and browser captures do not qualify as installed Android evidence.
- Keep active work, dependencies, signing material, source, and evidence intact during cleanup.
