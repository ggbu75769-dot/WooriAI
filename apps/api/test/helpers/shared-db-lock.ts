import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * PERF-130 — a cross-worker readers/writer lock over the shared test database.
 *
 * The api suite runs test files in parallel again (see vitest.config.ts), and nearly
 * every suite only touches identifiers it generated itself. A handful cannot: they
 * assert on database-wide totals, pin the exact seeded reference data, or run a job
 * that deletes rows across the whole database. Those take the lock exclusively and
 * everyone else takes it shared, so one of them runs while nothing else does and the
 * remaining ~66 files run fully in parallel. That is far cheaper than the old
 * run-wide single-thread pin: a few short serialization points instead of every file.
 * test/helpers/db-lock.setup.ts holds the list and the reason for each entry.
 *
 * Every entry costs the whole pool the suite's full runtime, so the list is kept as
 * short as the assertions allow: TEST-131 scoped `items-commerce` to its own fixtures
 * and took it off the list, which is why the exclusive section is now the five short
 * suites rather than six. Prefer scoping a suite's assertions over adding it here.
 *
 * Vitest 2.x has no per-file "run this one alone" switch (`fileParallelism` is a
 * run-wide flag and separate pools execute concurrently), so the gate is built out
 * of atomic filesystem operations, which work across worker threads and processes
 * alike:
 *   - the writer marker is a **directory**; `mkdir` fails with EEXIST if it already
 *     exists, giving a race-free test-and-set;
 *   - each reader publishes one file under `readers/` for as long as it holds the lock.
 *
 * The check/re-check in `acquireShared` is what makes it correct: a reader that
 * published its file too late for the writer's scan to see it will observe the
 * writer marker on its own re-check and stand down.
 */

const LOCK_DIR_ENV = "WOORIAI_TEST_DB_LOCK_DIR";
const WRITER_MARKER = "writer.lock";
const READERS_DIR = "readers";

const POLL_MS = 25;
/** How long a reader waits for an exclusive suite before giving up and warning. */
const SHARED_WAIT_TIMEOUT_MS = 60_000;
/** How long an exclusive suite waits for in-flight readers to drain. */
const EXCLUSIVE_WAIT_TIMEOUT_MS = 60_000;
/**
 * Grace period after the readers list empties. A reader releases the lock from its
 * `afterAll`, which by default runs in parallel with the suite's own `afterAll`
 * row cleanup; this gives that cleanup time to land before an exclusive suite starts
 * counting. (The exclusive suites also boot a Nest app between acquiring the lock and
 * taking their `before` snapshot, so in practice there are seconds of slack on top.)
 */
const READER_DRAIN_SETTLE_MS = 250;

export type LockRelease = () => void;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Creates the lock directory for this vitest run and exports its path through the
 * environment so worker threads inherit it. Called from globalSetup, which runs in
 * the main process before any worker exists.
 */
export function createLockDir(): string {
  const dir = join(tmpdir(), `wooriai-api-test-db-lock-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, READERS_DIR), { recursive: true });
  process.env[LOCK_DIR_ENV] = dir;
  return dir;
}

/** Removes this run's lock directory. Called from globalSetup's teardown. */
export function removeLockDir() {
  const dir = process.env[LOCK_DIR_ENV];
  if (dir) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function lockDir(): string | null {
  // Absent when a suite is run without globalSetup; the gate then simply no-ops
  // rather than pretending to serialize anything.
  return process.env[LOCK_DIR_ENV] ?? null;
}

function writerHeld(dir: string): boolean {
  return existsSync(join(dir, WRITER_MARKER));
}

function readersPresent(dir: string): boolean {
  try {
    return readdirSync(join(dir, READERS_DIR)).length > 0;
  } catch {
    return false;
  }
}

/** Takes the writer marker if free. Returns false (rather than throwing) if held. */
function tryTakeWriterMarker(dir: string): boolean {
  try {
    mkdirSync(join(dir, WRITER_MARKER));
    return true;
  } catch {
    return false;
  }
}

async function acquireExclusive(dir: string): Promise<LockRelease> {
  const deadline = Date.now() + EXCLUSIVE_WAIT_TIMEOUT_MS;

  while (!tryTakeWriterMarker(dir)) {
    if (Date.now() > deadline) {
      console.warn("[shared-db-lock] 다른 배타 스위트의 락을 기다리다 시간이 초과됐어요. 그대로 진행합니다.");
      return () => {};
    }
    await sleep(POLL_MS);
  }

  // The marker is held from here on, so no new reader can start: the readers list
  // only shrinks and this wait always terminates.
  const release: LockRelease = () => rmSync(join(dir, WRITER_MARKER), { recursive: true, force: true });
  while (readersPresent(dir)) {
    if (Date.now() > deadline) {
      console.warn(
        "[shared-db-lock] 진행 중인 스위트가 락을 반납하지 않아 시간이 초과됐어요 (워커가 죽었을 수 있어요). 그대로 진행합니다."
      );
      return release;
    }
    await sleep(POLL_MS);
  }
  await sleep(READER_DRAIN_SETTLE_MS);

  return release;
}

async function acquireShared(dir: string, id: string): Promise<LockRelease> {
  const readerFile = join(dir, READERS_DIR, id);
  const deadline = Date.now() + SHARED_WAIT_TIMEOUT_MS;

  for (;;) {
    while (writerHeld(dir)) {
      if (Date.now() > deadline) {
        console.warn("[shared-db-lock] 배타 스위트를 기다리다 시간이 초과됐어요. 그대로 진행합니다.");
        return () => {};
      }
      await sleep(POLL_MS);
    }

    writeFileSync(readerFile, id);
    // Re-check: if the writer took its marker between the loop above and this write,
    // its scan of the readers list may have already run and missed this file. Standing
    // down here is what keeps that interleaving from letting both sides through.
    if (!writerHeld(dir)) {
      return () => rmSync(readerFile, { force: true });
    }
    rmSync(readerFile, { force: true });
  }
}

/**
 * Acquires the shared test database for the current test file and returns the
 * matching release function (safe to call once, from `afterAll`).
 */
export async function acquireSharedDb(mode: "shared" | "exclusive", id: string): Promise<LockRelease> {
  const dir = lockDir();
  if (!dir) {
    return () => {};
  }
  return mode === "exclusive" ? acquireExclusive(dir) : acquireShared(dir, id);
}
