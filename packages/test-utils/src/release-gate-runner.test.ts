import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acquireReleaseGateLock, ReleaseGateAlreadyRunningError } from "../../../scripts/lib/release-gate-lock";
import { packageManagerInvocation, runGatePlan, type GateCommand } from "../../../scripts/lib/release-gate-runner";

const temporaryRoots: string[] = [];
const root = resolve(__dirname, "../../..");
function temporaryRoot() {
  const directory = mkdtempSync(join(tmpdir(), "wooriai-gate-test-"));
  temporaryRoots.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of temporaryRoots.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function cli(cwd: string, args: string[], env: Record<string, string> = {}) {
  const overrides = new Set(Object.keys(env).map((key) => key.toLowerCase()));
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !overrides.has(key.toLowerCase()))
  );
  return spawnSync(
    process.execPath,
    [join(root, "node_modules/tsx/dist/cli.mjs"), join(root, "scripts/release-gate.ts"), ...args],
    {
      cwd,
      env: { ...inherited, ...env },
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: 30_000,
      windowsHide: true
    }
  );
}

describe("release verification ownership and execution", () => {
  it("keeps a live process's lock even when a long gate exceeds three hours", () => {
    const file = join(temporaryRoot(), "gate.lock");
    const lock = acquireReleaseGateLock(file);
    const old = new Date(Date.now() - 4 * 60 * 60_000);
    utimesSync(file, old, old);
    expect(() => acquireReleaseGateLock(file)).toThrow(ReleaseGateAlreadyRunningError);
    const blocked = cli(temporaryRoot(), [], {
      WOORIAI_RELEASE_GATE_LOCK_PATH: file
    });
    expect(blocked.status).toBe(2);
    expect(blocked.stderr).toContain("RELEASE_GATE_ALREADY_RUNNING");
    lock.release();
    expect(existsSync(file)).toBe(false);
  });

  it("recovers a dead owner but does not release a successor's lock", () => {
    const file = join(temporaryRoot(), "gate.lock");
    writeFileSync(
      file,
      JSON.stringify({
        pid: 2147483647,
        startedAt: "2000-01-01",
        cwd: root,
        token: "dead"
      })
    );
    const lock = acquireReleaseGateLock(file);
    expect(lock.owner.pid).toBe(process.pid);
    expect(existsSync(`${file}.recovery`)).toBe(false);
    writeFileSync(file, JSON.stringify({ ...lock.owner, token: "successor" }));
    lock.release();
    expect(JSON.parse(readFileSync(file, "utf8")).token).toBe("successor");
  });

  it("does not interrupt an incomplete lock or another recovery", () => {
    const file = join(temporaryRoot(), "gate.lock");
    writeFileSync(file, "{");
    expect(() => acquireReleaseGateLock(file)).toThrow(ReleaseGateAlreadyRunningError);
    utimesSync(file, new Date(0), new Date(0));
    mkdirSync(`${file}.recovery`);
    expect(() => acquireReleaseGateLock(file)).toThrow("RELEASE_GATE_RECOVERY_BUSY");
    expect(readFileSync(file, "utf8")).toBe("{");
  });

  it("skips dependent commands after failure and keeps them NOT RUN", () => {
    const commands: GateCommand[] = ["install", "test", "build"].map((id) => ({
      id,
      label: id,
      command: "pnpm",
      display: id,
      args: [id]
    }));
    const executed: string[] = [];
    const results = runGatePlan(commands, (command) => {
      executed.push(command.id);
      return {
        ...command,
        durationMs: 1,
        status: 9,
        stdout: "",
        stderr: "failed"
      };
    });
    expect(executed).toEqual(["install"]);
    expect(results.map((result) => result.status)).toEqual([9, null, null]);
  });

  it("uses pnpm's launcher and ignores an npm launcher", () => {
    expect(packageManagerInvocation(["test"], { npm_execpath: "/tools/pnpm.cjs" }, "linux", "/node")).toEqual({
      executable: "/node",
      args: ["/tools/pnpm.cjs", "test"]
    });
    expect(packageManagerInvocation(["test"], { npm_execpath: "/tools/npm-cli.js" }, "win32")).toEqual({
      executable: "cmd.exe",
      args: ["/d", "/s", "/c", "pnpm.cmd", "test"]
    });
  });

  it("writes a separate dry-run plan without replacing executed evidence", () => {
    const cwd = temporaryRoot();
    const directory = join(cwd, "docs/qa/evidence");
    mkdirSync(directory, { recursive: true });
    const evidence = join(directory, "latest-release-gate.md");
    writeFileSync(evidence, "previous executed evidence");
    const result = cli(cwd, ["--dry-run"]);
    expect(result.status).toBe(0);
    expect(readFileSync(evidence, "utf8")).toBe("previous executed evidence");
    expect(readFileSync(join(directory, "latest-release-gate-dry-run.md"), "utf8")).toContain("NOT RUN");
  });

  it("streams large child logs and releases the lock when a prerequisite fails", () => {
    const cwd = temporaryRoot();
    const pnpm = join(cwd, "pnpm.cjs");
    writeFileSync(pnpm, 'process.stdout.write("x".repeat(2 * 1024 * 1024)); process.exitCode = 7;');
    const result = cli(cwd, [], { npm_execpath: pnpm });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout.length, result.stdout + result.stderr).toBeGreaterThan(2 * 1024 * 1024);
    expect(result.stderr).toContain("failed: install");
    const evidence = readFileSync(join(cwd, "docs/qa/evidence/latest-release-gate.md"), "utf8");
    expect(evidence).toContain("FAIL");
    expect(evidence.match(/NOT RUN/g)?.length).toBeGreaterThan(5);
    expect(existsSync(join(cwd, ".toolcache/release-gate.lock"))).toBe(false);
  });
});
