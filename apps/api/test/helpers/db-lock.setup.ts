import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { afterAll, expect } from "vitest";
import { acquireSharedDb } from "./shared-db-lock";

/**
 * PERF-130 setup file: gates every test file on the shared-database readers/writer
 * lock before the file itself is loaded. Registered via `setupFiles` in
 * vitest.config.ts, so no individual suite has to know the mechanism exists.
 *
 * Almost every suite scopes what it reads and writes to identifiers it generated
 * itself (see the note at the bottom of test/helpers/test-db.ts) and so runs fully in
 * parallel. The exceptions below cannot, because they read or write state that is
 * database-wide by definition:
 *
 *   - the three admin aggregate suites snapshot a total before and after and assert
 *     on the delta, and those endpoints count every row in wooriai_test;
 *   - `categories.e2e` pins the exact seeded category list (12 selectable / 21 total),
 *     which any suite that inserts a category would change;
 *   - `items-commerce` compares a `tab=all` snapshot against the union of the four
 *     status tabs, and both are derived from the global item_templates table, so a
 *     template inserted between those reads makes the two sets disagree;
 *   - `data-retention-purge` runs the purge job, which deletes withdrawn users and
 *     orphaned households across the whole database — including rows other suites
 *     are still using.
 *
 * See test/helpers/shared-db-lock.ts for the protocol. Add a file here only if it
 * genuinely cannot scope itself — an exclusive suite stalls the whole worker pool
 * while it runs, so the list is a cost, not a default.
 */
const EXCLUSIVE_SUITES = new Set([
  "admin-dashboard-summary.e2e.test.ts",
  "admin-analytics-summary.e2e.test.ts",
  "admin-affiliate-click-breakdown.e2e.test.ts",
  "categories.e2e.test.ts",
  "items-commerce.e2e.test.ts",
  "data-retention-purge.db.test.ts"
]);

// Vitest populates the worker's test path before it executes setup files, so this
// resolves to the file this setup run belongs to.
const testPath = expect.getState().testPath ?? "";
const mode = EXCLUSIVE_SUITES.has(basename(testPath)) ? "exclusive" : "shared";

// Top-level await: the gate closes before the test file's own module graph loads,
// which keeps it independent of `sequence.hooks` ordering between this setup file's
// hooks and the suite's.
const release = await acquireSharedDb(mode, `${basename(testPath) || "unknown"}-${randomUUID()}`);

afterAll(release);
