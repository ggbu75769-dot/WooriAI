import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
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
 *
 * ---------------------------------------------------------------------------
 * 라운드 61 A — 이 프로토콜이 기대는 **락 반납 순서 불변식**
 * ---------------------------------------------------------------------------
 * 마커/리더 파일을 지우는 것(= 반납)은 "그 스위트가 DB를 더는 건드리지 않는다"는 뜻이어야
 * 한다. 그렇지 않으면 다음 스위트가 락을 잡은 뒤에도 떠나는 스위트의 DELETE/INSERT가 계속
 * 착지하고, 전역 델타를 세는 배타 스위트가 확률적으로 깨진다.
 *
 * 반납은 `db-lock.setup.ts`의 `afterAll(release)`로 예약되므로, 그 뜻이 성립하려면
 * **release가 그 파일 자신의 정리 훅보다 뒤에** 돌아야 한다. vitest에서 그것을 보장하는
 * 것은 `sequence.hooks: "stack"`이다 — setup 파일의 afterAll이 가장 먼저 등록되므로,
 * after 훅을 역순으로(그리고 **순차로**) 도는 stack 아래에서만 release가 마지막이 된다.
 *
 * 라운드 61 A에서 실측한 표 (vitest 2.1.9, 훅을 파일 최상위에 등록했을 때):
 *
 *   sequence.hooks | release 시점
 *   ---------------+---------------------------------------------
 *   "stack"        | 스위트 정리가 **끝난 뒤** (안전)
 *   "parallel"     | 스위트 정리와 **동시에** 시작 (구멍이 열린다)
 *   "list"         | 스위트 정리보다 **먼저** (구멍이 열린다)
 *
 * 이 저장소가 지금까지 안전했던 이유는 두 겹의 **암묵적** 우연이었다:
 *   ⓐ vitest 2.1.9의 resolveConfig가 `sequence.hooks`를 "stack"으로 채운다. 같은 버전의
 *     CLI 도움말은 기본값을 "parallel"이라고 적고 있어(문서가 코드와 어긋난다) 이 값에
 *     기대는 것은 그 자체로 위험했다;
 *   ⓑ DB를 쓰는 스위트가 전부 정리 훅을 `describe(...)` **안에** 두고 있다. 자식 스위트의
 *     afterAll은 부모(파일) 스위트의 afterAll보다 항상 먼저 끝나므로 hooks 설정과 무관하게
 *     안전하다 — 정리를 `describe` 밖으로 한 줄 옮기는 순간 사라지는 보호막이다.
 *
 * 그래서 라운드 61 A는 ⓐ를 **명시**로 바꿨다: `vitest.config.ts`가 `sequence.hooks: "stack"`을
 * 직접 고정하고, 아래 `assertReleaseOrderingGuarantee`가 실제로 적용된 값을 워커에서 읽어
 * 확인한다. CLI `--sequence.hooks=parallel`이나 훗날의 기본값 변경은 이제 1/3 확률의
 * 플레이크가 아니라 첫 파일에서 즉시 빨간불이 된다. 그러면 ⓑ에 기대지 않아도 된다.
 */

const LOCK_DIR_ENV = "WOORIAI_TEST_DB_LOCK_DIR";
/** 동시 실행 감지용 레지스트리 경로 — createLockDir이 채우고 teardown이 읽는다(진단 전용). */
const RUN_REGISTRY_ENV = "WOORIAI_TEST_DB_RUN_REGISTRY_DIR";
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
 * Settle period at the end of `acquireExclusive` — note it runs **unconditionally**,
 * after the drain loop, so it applies to the exclusive→exclusive hand-off just as much
 * as to the reader→writer one. (Only its name and this comment used to be
 * reader-specific; 라운드 61 A corrected the prose, not the placement.)
 *
 * 이것이 막는 것은 **순서가 아니라 잔향**이다. 순서는 `sequence.hooks: "stack"`이 보장한다
 * (파일 머리말 참고) — 즉 앞선 스위트의 `await`된 정리는 반납 시점에 이미 끝나 있다. 남는
 * 것은 그 스위트가 await하지 않고 흘려보낸 작업(닫히는 Nest 앱의 뒷정리 등)뿐이고, 이
 * 유예는 그 여운에 주는 여유다. 순서 보장을 대신하지 못하므로 이 값을 키워 플레이크를
 * 덮으려는 시도는 잘못된 방향이다. (배타 스위트는 락을 잡은 뒤 Nest를 띄우고 "before"
 * 스냅샷을 찍으므로 실제로는 그 위에 수 초의 여유가 더 붙는다.)
 */
const READER_DRAIN_SETTLE_MS = 250;

/**
 * vitest 워커에 실제로 적용된 `sequence.hooks` 값. 읽을 수 없으면 null.
 *
 * `__vitest_worker__`는 공개 API가 아니라 vitest가 워커 전역에 두는 내부 상태다. 그래서
 * 읽히지 않을 때는 **검사를 건너뛴다** — 내부 구조가 바뀌었다는 이유로 멀쩡한 실행을
 * 세우는 것은 이 가드가 막으려는 문제보다 나쁘다. 값을 확실히 읽었고 그 값이 틀렸을
 * 때에만 실패한다.
 */
function effectiveHookSequence(): string | null {
  const worker = (globalThis as { __vitest_worker__?: { config?: { sequence?: { hooks?: unknown } } } })
    .__vitest_worker__;
  const hooks = worker?.config?.sequence?.hooks;
  return typeof hooks === "string" ? hooks : null;
}

/** 반납 순서 불변식이 실제로 서 있는지 확인한다 — 파일 머리말의 라운드 61 A 표 참고. */
export function assertReleaseOrderingGuarantee(id: string): void {
  const hooks = effectiveHookSequence();
  if (hooks === null || hooks === "stack") {
    return;
  }
  throw new Error(
    `[shared-db-lock] sequence.hooks가 "${hooks}"예요 — 이 값에서는 락 반납(afterAll)이 ` +
      `스위트 자신의 정리보다 먼저(또는 동시에) 돌아서, 반납이 "DB를 더는 건드리지 않는다"를 ` +
      `뜻하지 않게 돼요. 다음 배타 스위트가 이전 스위트의 DELETE 위에서 전역 델타를 세다가 ` +
      `확률적으로 깨져요(라운드 61 A). "stack"으로 돌려주세요 — apps/api/vitest.config.ts가 ` +
      `고정하고 있으니, CLI \`--sequence.hooks\`나 상위 설정이 덮어쓰고 있는지 확인해 주세요 ` +
      `(요청 스위트: ${id}).`
  );
}

export type LockRelease = () => void;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 라운드 61 A — 이 락의 두 번째 경계: **한 실행 안에서만** 배타가 성립한다.
 *
 * 락 디렉터리 이름이 그 실행의 pid라서, 같은 `wooriai_test`를 향한 `pnpm --filter api test`가
 * 둘 동시에 돌면 서로의 락 디렉터리를 보지 못한다 — 배타 스위트가 서로를 전혀 모른 채 겹쳐
 * 돌고, 전역 델타 단언이 정확히 라운드 60이 관측한 모양으로 깨진다
 * (`expected 2 to be 1` — 남의 실행이 만든 사용자 한 명이 before/after 사이에 낀다).
 *
 * 라운드 61 A는 이것을 **닫지 않고 이름을 붙였다**. 닫으려면 락 디렉터리를 DB 단위 고정
 * 경로로 옮겨야 하는데, `createLockDir`의 초기화 `rmSync`와 teardown의 삭제가 곧바로 남의
 * 실행이 들고 있는 락을 지워 버린다 — 참조 카운팅이 필요한 별개의 설계 변경이고, 지금
 * 실패는 "동시에 돌리지 않는다"로 피할 수 있다. 대신 **원인 불명으로 남지 않게** 한다:
 * 같은 DB를 쓰는 다른 실행이 살아 있으면 globalSetup이 크게 경고한다. 실패시키지는 않는다 —
 * 한 대의 개발 머신/CI 러너에서 여러 세션이 도는 것은 흔한 현실이고, 여기서 하드 실패로
 * 만들면 막으려는 플레이크보다 더 자주 앞을 가로막는다.
 */
const RUN_REGISTRY_PREFIX = "wooriai-api-test-runs";

type RunRecord = { pid: number; startedAt: string; lockDir: string };

/** 같은 DATABASE_URL을 쓰는 실행끼리만 서로를 본다 — 다른 DB를 향한 실행은 무관하다. */
function runRegistryDir(databaseUrl = process.env.DATABASE_URL ?? "unset"): string {
  const key = createHash("sha1").update(databaseUrl).digest("hex").slice(0, 12);
  return join(tmpdir(), `${RUN_REGISTRY_PREFIX}-${key}`);
}

/**
 * 레지스트리에서 **살아 있는 남의 실행**만 골라낸다. 죽은 실행(크래시로 teardown을 못 돈
 * 기록)은 지우고 지나간다. `ownerAlive`와 같은 보수적 판정을 쓴다 — 살았는지 죽었는지 알 수
 * 없으면 살아 있다고 본다.
 */
export function findConcurrentRuns(registryDir = runRegistryDir(), selfPid = process.pid): RunRecord[] {
  let entries: string[];
  try {
    entries = readdirSync(registryDir);
  } catch {
    return [];
  }

  const live: RunRecord[] = [];
  for (const entry of entries) {
    // `<pid>.json.partial`은 다른 실행이 지금 쓰는 중인 임시 파일이다 — 건드리지 않는다.
    if (!entry.endsWith(".json")) {
      continue;
    }
    const path = join(registryDir, entry);
    let record: RunRecord | null = null;
    try {
      record = JSON.parse(readFileSync(path, "utf8")) as RunRecord;
    } catch {
      record = null;
    }
    if (!record || typeof record.pid !== "number") {
      rmSync(path, { force: true });
      continue;
    }
    if (!ownerAlive({ pid: record.pid, suite: "", takenAt: record.startedAt })) {
      rmSync(path, { force: true });
      continue;
    }
    if (record.pid !== selfPid) {
      live.push(record);
    }
  }
  return live;
}

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

  // 진단 전용 — 여기서 던지면 안 된다(globalSetup이 죽으면 실행 전체가 날아간다).
  try {
    const registryDir = runRegistryDir();
    mkdirSync(registryDir, { recursive: true });
    const others = findConcurrentRuns(registryDir);
    if (others.length > 0) {
      const list = others.map((run) => `pid ${run.pid} (${run.startedAt})`).join(", ");
      console.warn(
        `\n[shared-db-lock] ⚠️ 같은 테스트 DB를 쓰는 api 테스트 실행이 이미 돌고 있어요: ${list}.\n` +
          `이 락은 **한 실행 안에서만** 배타를 보장해요(락 디렉터리가 실행 pid로 나뉘어요). 두 실행의 ` +
          `배타 스위트는 서로를 보지 못한 채 겹쳐 돌고, 전역 델타 단언이 "expected 2 to be 1" 같은 ` +
          `모양으로 깨질 수 있어요.\n` +
          `이 실행이 그렇게 깨졌다면 코드가 아니라 이 동시 실행을 먼저 의심해 주세요 — 한 번에 하나만 ` +
          `돌리거나, DATABASE_URL로 실행마다 다른 DB를 주세요. (라운드 61 A / docs/5차/round61-backlog.md B-1)\n`
      );
    }
    // 원자적으로 쓴다(write→rename): 동시에 시작한 다른 실행이 절반만 쓰인 JSON을 읽고
    // "손상된 기록"으로 지워 버리면, 정작 경고해야 할 그 실행을 못 보게 된다.
    const recordPath = join(registryDir, `${process.pid}.json`);
    const stagingPath = `${recordPath}.partial`;
    writeFileSync(
      stagingPath,
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), lockDir: dir } satisfies RunRecord)
    );
    renameSync(stagingPath, recordPath);
    process.env[RUN_REGISTRY_ENV] = registryDir;
  } catch {
    // 레지스트리는 진단일 뿐이고, 락 자체는 이것 없이도 그대로 옳다.
  }

  return dir;
}

/** Removes this run's lock directory. Called from globalSetup's teardown. */
export function removeLockDir() {
  const registryDir = process.env[RUN_REGISTRY_ENV];
  if (registryDir) {
    rmSync(join(registryDir, `${process.pid}.json`), { force: true });
  }
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
  // 라운드 61 A: 락을 잡기 **전에** 반납 순서 불변식부터 확인한다. 여기가 모든 스위트가
  // 반드시 지나가는 한 지점이라, 이 검사를 우회하고 락을 잡을 방법이 없다.
  assertReleaseOrderingGuarantee(id);

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
