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
    // 라운드 61 A: 위 락의 **정확성 조건**이라 명시적으로 고정한다 (기본값에 기대지 않는다).
    //
    // 반납은 setup 파일의 `afterAll(release)`이고, 그것이 "이 스위트는 DB를 더는 건드리지
    // 않는다"를 뜻하려면 스위트 자신의 정리 훅보다 **뒤에** 돌아야 한다. setup의 훅이 가장
    // 먼저 등록되므로, after 훅을 역순·순차로 도는 "stack"에서만 그것이 성립한다.
    // "parallel"이면 정리와 동시에, "list"면 정리보다 먼저 반납된다(둘 다 실측).
    //
    // 이 값은 vitest 2.1.9의 resolveConfig가 이미 채우는 기본값과 **같다** — 워커에서 적용값을
    // 읽어 확인했다. 그래서 이 줄 자체의 실행 시간 비용은 0이다. 라운드 61 A 실측(조용한 창,
    // 4코어): 고정 전 6회 평균 69.5s(76파일/661테스트) → 고정 후 3회 평균 71.0s
    // (77파일/672테스트). 늘어난 1.5초는 그 사이 늘어난 테스트 파일 몫이지 이 설정 몫이 아니다.
    // 고정하는 이유는 속도가 아니라, 같은 버전의 CLI 도움말이 기본값을 "parallel"이라고 적고
    // 있을 만큼 이 기본값이 불안정한 근거이기 때문이다. test/helpers/shared-db-lock.ts의
    // `assertReleaseOrderingGuarantee`가 실제 적용값을 워커에서 확인하고,
    // test/db-lock-release-order.test.ts가 순서 자체를 런타임에 재현한다.
    sequence: { hooks: "stack" },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    maxWorkers: MAX_WORKERS,
    minWorkers: 1
  }
});
