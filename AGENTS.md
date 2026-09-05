# WooriAI agent guide

- Confirm checkout, branch, and dirty state. Read CLAUDE.md for repository commands and docs/dev/do-not-change.md for the single locked-behavior contract; do not copy that contract into another instruction file.
- Implement the requested scope and preserve unrelated work. Load only the task-relevant contract; historical Pixel Lock work is not the default project task.
- Match verification to the change. Run affected checks once for the same source and environment. Releases still require pnpm release:gate; API tests require a real PostgreSQL database.
- Use pnpm as declared in package.json. Avoid repeated installs or complete builds for documentation-only changes.
- For Android visual comparison or Pixel Lock, read [the focused guide](docs/ui-pixel-lock/AGENT_GUIDE.md). Preserve its device evidence, thresholds, and release requirements.
- Distinguish local checks, device proof, GitHub source, deployed server, and store readiness. Report the result and any unresolved blocker concisely.
