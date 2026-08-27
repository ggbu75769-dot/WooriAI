import { cpus } from "node:os";
import { defineConfig } from "vitest/config";

// PERF-130: the suite used to be pinned to a single worker with fileParallelism
// off, because node:crypto's scryptSync (admin-password.ts) intermittently threw
// "Deriving bits failed" -- or OOM'd a worker -- when many e2e suites booted a Nest
// app at once, each paying AdminModule's ~16-32MB constant-time-login hash *at
// module load*. That hash is now derived lazily and memoized on first login
// (admin-auth.service.ts), so merely loading AdminModule costs nothing and the
// simultaneous-derivation spike is gone. Suites can run in parallel again.
//
// Width is capped rather than left at vitest's default (CPU count) because the
// e2e suites all share one Postgres (wooriai_test): every extra worker multiplies
// the live Prisma connection pools and the row-level contention on shared tables.
// Measured on the 4-core box this repo is validated on, 4 workers is also simply
// the fastest setting -- 6 was ~20% slower. Override per-run with
// `--poolOptions.threads.maxThreads=N` on a wider machine.
const MAX_WORKERS = Math.max(2, Math.min(4, cpus().length));

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // Parallelism is only safe because suites scope what they read and write to
    // identifiers they generated themselves (see the note at the bottom of
    // test/helpers/test-db.ts). This gates each file on a readers/writer lock so the
    // few that genuinely cannot -- database-wide aggregates, the exact seeded
    // reference data, the purge job -- still get the database to themselves.
    // test/helpers/db-lock.setup.ts names them and says why.
    setupFiles: ["./test/helpers/db-lock.setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    poolOptions: {
      threads: {
        maxThreads: MAX_WORKERS,
        minThreads: 1
      }
    }
  }
});
