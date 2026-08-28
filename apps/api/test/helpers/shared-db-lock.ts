import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * PERF-130 — a cross-worker readers/writer lock over the shared test database.
 *
 * The api suite runs test files in parallel again (see vitest.config.ts), and nearly
 * every suite only touches identifiers it generated itself. A handful cannot: they
 * assert on database-wide totals, pin the exact seeded reference data, or run a job
 * that deletes rows across the whole database. Those take the lock exclusively and
 * everyone else takes it shared, so one of them runs while nothing else does and every
 * other file runs fully in parallel. That is far cheaper than the old run-wide
 * single-thread pin: a few short serialization points instead of every file.
 *
 * `EXCLUSIVE_SUITES` in test/helpers/exclusive-suites.ts is the single source of truth for
 * *which* suites those are and why. This comment deliberately quotes no count — R31
 * 리뷰 F1: the counts that used to live here ("the four short suites", "~66 files")
 * drifted out of date every time the list moved, and a stale number in a comment is
 * worse than no number at all. Read the constant.
 *
 * Every entry costs the whole pool the suite's full runtime, so the list is kept as
 * short as the assertions allow: TEST-131 scoped `items-commerce` to its own fixtures
 * and took it off the list, and TEST-132 did the same for `link-health` (which the
 * round-30 review had added to work around a global `updateMany`). Prefer scoping a
 * suite's assertions over adding it here.
 *
 * Vitest 2.x has no per-file "run this one alone" switch (`fileParallelism` is a
 * run-wide flag and separate pools execute concurrently), so the gate is built out
 * of atomic filesystem operations, which work across worker threads and processes
 * alike:
 *   - the writer marker is a **directory**; `mkdir` fails with EEXIST if it already
 *     exists, giving a race-free test-and-set. Once taken, the holder drops an
 *     `owner.json` inside it (pid + suite name) so waiters can name the holder in a
 *     timeout message and reclaim the marker if that pid is gone;
 *   - each reader publishes one file under `readers/` for as long as it holds the lock.
 *
 * The check/re-check in `acquireShared` is what makes it correct: a reader that
 * published its file too late for the writer's scan to see it will observe the
 * writer marker on its own re-check and stand down.
 */

const LOCK_DIR_ENV = "WOORIAI_TEST_DB_LOCK_DIR";
const WRITER_MARKER = "writer.lock";
/** Owner record written *inside* the writer marker directory (diagnostics + stale reclaim). */
const WRITER_OWNER_FILE = "owner.json";
const READERS_DIR = "readers";

const POLL_MS = 25;
/**
 * How long a reader waits for an exclusive suite before giving up.
 *
 * R31 리뷰 F4: this is a **per-phase** budget, not a budget for the whole acquire.
 * `acquireExclusive` has two waits (take the marker, then drain the readers) and used
 * to share one deadline between them, so a slow first phase could leave the second
 * phase a fraction of a second and fail a perfectly healthy run. Each phase now gets
 * its own deadline; the worst case a single phase can hang is still this value.
 */
const SHARED_WAIT_TIMEOUT_MS = 60_000;
/** How long an exclusive suite waits, per phase — see the note above. */
const EXCLUSIVE_WAIT_TIMEOUT_MS = 60_000;
/**
 * R31 리뷰 F5: a writer marker whose owning process is gone (worker crash, SIGKILL)
 * used to wedge every other file until the 60s timeout, and then failed them too. A
 * waiter now checks the recorded pid with `process.kill(pid, 0)` and reclaims the
 * marker. Reclaiming is only done after the *same* dead owner has been observed for
 * this long, so the sub-millisecond window between another waiter's `mkdir` and its
 * owner-file write can never be mistaken for a corpse.
 */
const STALE_OWNER_GRACE_MS = 1_000;
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
  // Absent when a suite is run without globalSetup — see `acquireSharedDb` for what
  // happens then (it is no longer a silent no-op).
  return process.env[LOCK_DIR_ENV] ?? null;
}

function writerHeld(dir: string): boolean {
  return existsSync(join(dir, WRITER_MARKER));
}

function readerIds(dir: string): string[] {
  try {
    return readdirSync(join(dir, READERS_DIR));
  } catch {
    return [];
  }
}

function readersPresent(dir: string): boolean {
  return readerIds(dir).length > 0;
}

type WriterOwner = { pid: number; suite: string; takenAt: string };

/** Reads the writer marker's owner record, or null when it is absent/unreadable. */
function readWriterOwner(dir: string): WriterOwner | null {
  try {
    const parsed = JSON.parse(readFileSync(join(dir, WRITER_MARKER, WRITER_OWNER_FILE), "utf8")) as WriterOwner;
    return typeof parsed?.pid === "number" ? parsed : null;
  } catch {
    return null;
  }
}

/** Names the current writer for an error message, without ever throwing itself. */
function writerOwnerLabel(dir: string): string {
  const owner = readWriterOwner(dir);
  return owner ? `${owner.suite} (pid ${owner.pid}, ${owner.takenAt})` : "알 수 없음 (owner 기록 없음)";
}

/**
 * Is the marker's owner still running? Unknown owners count as alive — reclaiming a
 * lock we cannot prove is abandoned would be far worse than waiting out the timeout.
 */
function ownerAlive(owner: WriterOwner | null): boolean {
  if (!owner) {
    return true;
  }
  try {
    process.kill(owner.pid, 0);
    return true;
  } catch (error) {
    // ESRCH = no such process. EPERM means it exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

const ownerSignature = (owner: WriterOwner | null) => (owner ? `${owner.pid}@${owner.takenAt}` : "unknown");

/**
 * Watches the writer marker across poll ticks and removes it once the same dead owner
 * has been observed for STALE_OWNER_GRACE_MS. Returns a stateful probe so the grace
 * period is per-waiter (a fresh marker resets it via its new signature).
 */
function makeStaleWriterReclaimer(dir: string) {
  let seenSignature: string | null = null;
  let seenSince = 0;

  return function reclaimIfStale(): boolean {
    const owner = readWriterOwner(dir);
    const signature = ownerSignature(owner);
    if (signature !== seenSignature) {
      seenSignature = signature;
      seenSince = Date.now();
      return false;
    }
    if (ownerAlive(owner) || Date.now() - seenSince < STALE_OWNER_GRACE_MS) {
      return false;
    }
    // Re-read right before removing: if the marker changed hands in the meantime the
    // signature no longer matches and we leave the new owner's marker alone.
    if (ownerSignature(readWriterOwner(dir)) !== signature) {
      return false;
    }
    rmSync(join(dir, WRITER_MARKER), { recursive: true, force: true });
    seenSignature = null;
    return true;
  };
}

/** Takes the writer marker if free. Returns false (rather than throwing) if held. */
function tryTakeWriterMarker(dir: string, id: string): boolean {
  try {
    // `mkdir` is the atomic test-and-set; the owner record is written only after it
    // succeeds, so a half-written marker can never look like a free one.
    mkdirSync(join(dir, WRITER_MARKER));
  } catch {
    return false;
  }
  try {
    const owner: WriterOwner = { pid: process.pid, suite: id, takenAt: new Date().toISOString() };
    writeFileSync(join(dir, WRITER_MARKER, WRITER_OWNER_FILE), JSON.stringify(owner));
  } catch {
    // Diagnostics only — the lock itself is already held and stays correct without it.
  }
  return true;
}

async function acquireExclusive(dir: string, id: string): Promise<LockRelease> {
  // R31 리뷰 F4: 단계마다 독립된 예산. 마커 획득에 오래 걸렸다고 리더 배출 대기가
  // 남은 시간만 받으면, 멀쩡한 실행이 "1초 안에 배출 못 했다"로 터진다.
  const markerDeadline = Date.now() + EXCLUSIVE_WAIT_TIMEOUT_MS;
  const reclaimIfStale = makeStaleWriterReclaimer(dir);

  while (!tryTakeWriterMarker(dir, id)) {
    // R31 리뷰 F5: 죽은 워커가 남긴 마커는 회수한다 — 그렇지 않으면 남은 파일 전부가
    // 60초를 기다렸다가 똑같이 실패한다.
    if (reclaimIfStale()) {
      continue;
    }
    if (Date.now() > markerDeadline) {
      // R30 리뷰 F4: 무보호로 진행하면 전역 델타 단언이 원인 불명으로 깨진다 —
      // 명시적 실패가 진단에 낫다.
      throw new Error(
        `[shared-db-lock] 다른 배타 스위트의 락을 기다리다 시간이 초과됐어요 (워커 크래시 의심). ` +
          `락 디렉터리: ${dir} / 보유 스위트: ${writerOwnerLabel(dir)} / 대기 스위트: ${id}`
      );
    }
    await sleep(POLL_MS);
  }

  // The marker is held from here on, so no new reader can start: the readers list
  // only shrinks and this wait always terminates.
  const release: LockRelease = () => rmSync(join(dir, WRITER_MARKER), { recursive: true, force: true });
  const drainDeadline = Date.now() + EXCLUSIVE_WAIT_TIMEOUT_MS;
  while (readersPresent(dir)) {
    if (Date.now() > drainDeadline) {
      const stuck = readerIds(dir).join(", ");
      release();
      throw new Error(
        `[shared-db-lock] 진행 중인 스위트가 락을 반납하지 않아 시간이 초과됐어요 (워커가 죽었을 수 있어요). ` +
          `락 디렉터리: ${dir} / 반납하지 않은 스위트: ${stuck} / 대기 스위트: ${id}`
      );
    }
    await sleep(POLL_MS);
  }
  await sleep(READER_DRAIN_SETTLE_MS);

  return release;
}

async function acquireShared(dir: string, id: string): Promise<LockRelease> {
  const readerFile = join(dir, READERS_DIR, id);
  const deadline = Date.now() + SHARED_WAIT_TIMEOUT_MS;
  const reclaimIfStale = makeStaleWriterReclaimer(dir);

  for (;;) {
    while (writerHeld(dir)) {
      if (reclaimIfStale()) {
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error(
          `[shared-db-lock] 배타 스위트를 기다리다 시간이 초과됐어요 (워커 크래시 의심). ` +
            `락 디렉터리: ${dir} / 보유 스위트: ${writerOwnerLabel(dir)} / 대기 스위트: ${id}`
        );
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
 * 라운드 51 D-#4: globalSetup 없이 돈 실행에서 락 디렉터리가 없을 때의 옵트아웃.
 *
 * 예전에는 그 경우를 **말없이** no-op으로 넘겼다. 그러면 배타 스위트도 아무 보호 없이
 * 돌면서 통과/실패가 그날의 운에 달리고, 실패해도 "락이 없었다"는 사실이 어디에도
 * 남지 않는다. 기본값은 이제 실패다. 다만 단일 파일을 손으로 돌려 보는 습관
 * (`vitest run test/foo.test.ts`는 이 저장소 설정에서는 globalSetup을 함께 돌리지만,
 * 다른 설정/툴로 부르는 경우가 있다)을 깨지 않도록, 이 환경 변수를 1로 두면 예전처럼
 * no-op 하되 **stderr에 경고를 남긴다**.
 */
const ALLOW_NO_LOCK_ENV = "WOORIAI_TEST_ALLOW_NO_LOCK";

/**
 * Acquires the shared test database for the current test file and returns the
 * matching release function (safe to call once, from `afterAll`).
 *
 * 락 디렉터리가 없으면(= globalSetup을 거치지 않은 실행) 던진다 — 위
 * ALLOW_NO_LOCK_ENV 주석 참고. 조용한 통과보다 즉시 실패가 낫다.
 */
export async function acquireSharedDb(mode: "shared" | "exclusive", id: string): Promise<LockRelease> {
  const dir = lockDir();
  if (!dir) {
    if (process.env[ALLOW_NO_LOCK_ENV] !== "1") {
      throw new Error(
        `[shared-db-lock] 공유 DB 락 디렉터리(${LOCK_DIR_ENV})가 없어요 — globalSetup을 거치지 않은 ` +
          `실행이에요. 이대로 진행하면 배타 스위트가 아무 보호 없이 다른 파일과 겹쳐 돌아요 ` +
          `(요청 스위트: ${id} / 모드: ${mode}). \`pnpm --filter api test\`로 실행하거나, ` +
          `의도한 것이라면 ${ALLOW_NO_LOCK_ENV}=1을 지정해 주세요.`
      );
    }
    console.warn(
      `[shared-db-lock] ${ALLOW_NO_LOCK_ENV}=1 — 공유 DB 락 없이 진행해요. 병렬 실행 중이라면 ` +
        `배타 스위트(${id})의 결과를 신뢰할 수 없어요.`
    );
    return () => {};
  }
  return mode === "exclusive" ? acquireExclusive(dir, id) : acquireShared(dir, id);
}
