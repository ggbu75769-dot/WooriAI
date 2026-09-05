import { randomUUID } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type ReleaseGateLockOwner = {
  pid: number;
  startedAt: string;
  cwd: string;
  token: string;
};

export class ReleaseGateAlreadyRunningError extends Error {
  constructor(
    readonly lockPath: string,
    readonly owner: ReleaseGateLockOwner | null
  ) {
    const ownerSummary = owner ? `pid ${owner.pid}, since ${owner.startedAt}` : "owner details are still being written";
    super(
      `RELEASE_GATE_ALREADY_RUNNING: another full release gate owns this repository (${ownerSummary}). ` +
        "Wait for it to finish before starting another full gate."
    );
    this.name = "ReleaseGateAlreadyRunningError";
  }
}

const incompleteLockGraceMs = 60_000;

function readOwner(lockPath: string): ReleaseGateLockOwner | null {
  try {
    const parsed = JSON.parse(readFileSync(lockPath, "utf8")) as Partial<ReleaseGateLockOwner>;
    if (
      !Number.isInteger(parsed.pid) ||
      parsed.pid! <= 0 ||
      typeof parsed.startedAt !== "string" ||
      typeof parsed.cwd !== "string" ||
      typeof parsed.token !== "string"
    ) {
      return null;
    }
    return parsed as ReleaseGateLockOwner;
  } catch {
    return null;
  }
}

function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function lockAgeMs(lockPath: string): number | null {
  try {
    return Date.now() - statSync(lockPath).mtimeMs;
  } catch {
    return null;
  }
}

function removeAbandonedLock(lockPath: string, owner: ReleaseGateLockOwner) {
  const recoveryPath = `${lockPath}.recovery`;
  try {
    mkdirSync(recoveryPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    throw new Error(
      `RELEASE_GATE_RECOVERY_BUSY: inspect ${recoveryPath}/owner.json before retrying or removing recovery state.`
    );
  }
  const recoveryOwnerPath = join(recoveryPath, "owner.json");
  try {
    writeFileSync(recoveryOwnerPath, JSON.stringify(owner), "utf8");
    // Recheck under exclusive recovery ownership: another contender may have
    // replaced the stale lock since our first observation.
    const current = readOwner(lockPath);
    const age = lockAgeMs(lockPath);
    if ((current && processIsRunning(current.pid)) || (!current && age !== null && age < incompleteLockGraceMs)) {
      throw new ReleaseGateAlreadyRunningError(lockPath, current);
    }
    try {
      unlinkSync(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  } finally {
    try {
      unlinkSync(recoveryOwnerPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    rmdirSync(recoveryPath);
  }
}

export function acquireReleaseGateLock(lockPath = join(process.cwd(), ".toolcache", "release-gate.lock")) {
  mkdirSync(dirname(lockPath), { recursive: true });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const owner: ReleaseGateLockOwner = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      cwd: process.cwd(),
      token: randomUUID()
    };

    try {
      const descriptor = openSync(lockPath, "wx");
      let wroteOwner = false;
      try {
        writeFileSync(descriptor, `${JSON.stringify(owner, null, 2)}\n`, "utf8");
        wroteOwner = true;
      } finally {
        closeSync(descriptor);
        if (!wroteOwner) {
          try {
            unlinkSync(lockPath);
          } catch {
            // Preserve the original write error. A fresh incomplete lock fails closed briefly.
          }
        }
      }

      return {
        owner,
        release() {
          const currentOwner = readOwner(lockPath);
          if (currentOwner?.token !== owner.token) return;
          try {
            unlinkSync(lockPath);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const currentOwner = readOwner(lockPath);
      const ageMs = lockAgeMs(lockPath);
      const active = currentOwner && processIsRunning(currentOwner.pid);
      const incompleteAndFresh = !currentOwner && ageMs !== null && ageMs < incompleteLockGraceMs;
      if (active || incompleteAndFresh) {
        throw new ReleaseGateAlreadyRunningError(lockPath, currentOwner);
      }
      removeAbandonedLock(lockPath, owner);
    }
  }

  throw new ReleaseGateAlreadyRunningError(lockPath, readOwner(lockPath));
}
