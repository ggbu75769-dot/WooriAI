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
// the live Prisma connection pools and the row-level contention on shared tables,
// and past some point the database, not the CPU, is what the run waits on.
//
// R31 리뷰 F9: an older note here claimed "6 workers was ~20% slower", which could not
// be reproduced, so it is gone. Re-measured on the 4-core box this repo is validated
// on (71 files / 607 tests, all green either way): 4 workers took 93s / 88s / 92s and
// 6 workers took 89s / 104s -- the two settings are equivalent inside a run-to-run
// spread of roughly +-15s. So the cap rests on the resource argument above (Prisma
// connection pools and row contention on one shared Postgres), not on a wall-clock
// win. Override per-run with `--maxWorkers=N` on a wider machine.
//
// R30 리뷰 F1: vitest 2.x의 기본 pool은 "forks"이고 forks 풀은
// poolOptions.threads.*를 읽지 않는다(그 설정은 조용히 무시돼 코어-1 워커가 떴다).
// 그래서 풀 종류와 무관하게 적용되는 최상위 maxWorkers/minWorkers로 상한을 건다.
const MAX_WORKERS = Math.max(2, Math.min(4, cpus().length));

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // Parallelism is only safe because suites scope what they read and write to
    // identifiers they generated themselves (see the note at the bottom of
    // test/helpers/test-db.ts). This gates each file on a readers/writer lock so the
    // few that genuinely cannot -- database-wide aggregates, the exact seeded
    // reference data, the purge job -- still get the database to themselves.
    // test/helpers/exclusive-suites.ts names them and says why; the setup file below
    // only applies that list (and now fails loudly instead of degrading to shared when
    // it cannot tell which file it belongs to — 라운드 51 D-#4).
    setupFiles: ["./test/helpers/db-lock.setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    maxWorkers: MAX_WORKERS,
    minWorkers: 1
  }
});
