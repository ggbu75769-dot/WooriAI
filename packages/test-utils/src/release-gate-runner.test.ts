import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { acquireReleaseGateLock, ReleaseGateAlreadyRunningError } from "../../../scripts/lib/release-gate-lock";

describe("release gate package-manager runner", () => {
  it("reuses npm_execpath only when the active package-manager is pnpm", () => {
    const source = readFileSync(resolve(__dirname, "../../../scripts/release-gate.ts"), "utf8");

    expect(source).toContain("basename(packageManagerCliPathCandidate)");
    expect(source).toContain("/^pnpm(?:\\.c?js)?$/i");
    expect(source).toContain("[packageManagerCliPath, ...gateCommand.args]");
    expect(source).toContain('process.env.ComSpec ?? "cmd.exe"');
    expect(source).toContain('["/d", "/s", "/c", "pnpm.cmd", ...gateCommand.args]');
    expect(source).not.toContain('["exec", "--yes", "pnpm@');
  });

  it("bounds every child command and records timeout failures", () => {
    const source = readFileSync(resolve(__dirname, "../../../scripts/release-gate.ts"), "utf8");

    expect(source).toContain("timeout: gateCommand.timeoutMs");
    expect(source).toMatch(/const timedOut = .*\.code === "ETIMEDOUT"/);
    expect(source).toContain("status: timedOut ? 124");
    expect(source).toContain("timedOut: result.timedOut");
  });

  it("retries only transient evidence-file locks before failing the completed gate", () => {
    const source = readFileSync(resolve(__dirname, "../../../scripts/release-gate.ts"), "utf8");

    expect(source).toContain('new Set(["UNKNOWN", "EBUSY", "EACCES", "EPERM"])');
    expect(source).toContain("for (let attempt = 1; attempt <= maxAttempts; attempt += 1)");
    expect(source).toContain("writeFileWithRetry(join(process.cwd(), markdownPath)");
    expect(source).toContain("writeFileWithRetry(\n    join(process.cwd(), jsonPath)");
    expect(source).not.toContain("writeFileSync(join(process.cwd(), markdownPath)");
  });

  it("blocks a concurrent full gate and releases only the lock it owns", () => {
    const releaseGateSource = readFileSync(resolve(__dirname, "../../../scripts/release-gate.ts"), "utf8");
    const temporaryRoot = mkdtempSync(join(tmpdir(), "wooriai-release-gate-lock-"));
    const lockPath = join(temporaryRoot, "release-gate.lock");

    try {
      expect(releaseGateSource).toContain("releaseGateLock = acquireReleaseGateLock(process.env.WOORIAI_RELEASE_GATE_LOCK_PATH)");
      expect(releaseGateSource).toContain("error instanceof ReleaseGateAlreadyRunningError");
      expect(releaseGateSource).toContain("releaseGateLock?.release()");
      const first = acquireReleaseGateLock(lockPath);
      const root = resolve(__dirname, "../../..");
      const blocked = spawnSync(
        process.execPath,
        [
          resolve(root, "node_modules/tsx/dist/cli.mjs"),
          resolve(root, "scripts/release-gate.ts"),
          "--dry-run"
        ],
        {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            WOORIAI_RELEASE_GATE_LOCK_PATH: lockPath
          }
        }
      );
      expect(blocked.status).toBe(2);
      expect(blocked.stderr).toContain("RELEASE_GATE_ALREADY_RUNNING");
      expect(blocked.stderr).toContain(`pid ${process.pid}`);

      writeFileSync(lockPath, JSON.stringify({
        ...first.owner,
        token: "successor-token"
      }));
      first.release();
      expect(existsSync(lockPath)).toBe(true);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("recovers an abandoned release-gate lock whose process is no longer running", () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "wooriai-release-gate-stale-"));
    const lockPath = join(temporaryRoot, "release-gate.lock");

    try {
      writeFileSync(lockPath, JSON.stringify({
        pid: 2_147_483_647,
        startedAt: "2000-01-01T00:00:00.000Z",
        cwd: temporaryRoot,
        token: "abandoned-token"
      }));
      const current = acquireReleaseGateLock(lockPath);
      expect(current.owner.pid).toBe(process.pid);
      current.release();
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("keeps portable PostgreSQL from holding the captured release-gate pipes open", () => {
    const source = readFileSync(resolve(__dirname, "../../../scripts/db.ts"), "utf8");
    const startBlock = source.slice(
      source.indexOf('execFileSync(pgExe("pg_ctl")'),
      source.indexOf("const dbExists")
    );

    expect(startBlock).toContain('"-W", "start"');
    expect(startBlock).toContain('stdio: "ignore"');
    expect(startBlock).toContain("windowsHide: true");
    expect(startBlock).toContain("for (let i = 0; i < 60 && !portableReady(); i += 1)");
    expect(startBlock).toContain("PORTABLE_POSTGRES_START_TIMEOUT");
  });

  it("uses a peer-dependency check supported by the Node 20 pnpm pin", () => {
    const source = readFileSync(resolve(__dirname, "../../../scripts/release-gate.ts"), "utf8");

    expect(source).toContain("pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only");
    expect(source).not.toContain("pnpm peers check");
  });

  it("owns a fail-closed non-secret mobile build profile", () => {
    const source = readFileSync(resolve(__dirname, "../../../scripts/release-gate.ts"), "utf8");

    expect(source).toContain('EXPO_PUBLIC_API_BASE_URL: "https://api.wooriai.test/api/v1"');
    expect(source).toContain('EXPO_PUBLIC_TEST_LOGIN: "0"');
    expect(source).toContain('EXPO_PUBLIC_PIXEL_LOCK: "0"');
  });

  it("keeps the API build on the repository TypeScript CLI", () => {
    const source = readFileSync(resolve(__dirname, "../../../scripts/build-api.ts"), "utf8");

    expect(source).toContain('resolve(root, "node_modules/typescript/bin/tsc")');
    expect(source).toContain("execFileSync(process.execPath");
    expect(source).not.toContain("process.env.npm_execpath");
  });

  it("qualifies the real Admin browser flows in local and CI release gates", () => {
    const releaseGate = readFileSync(resolve(__dirname, "../../../scripts/release-gate.ts"), "utf8");
    const ci = readFileSync(resolve(__dirname, "../../../.github/workflows/ci.yml"), "utf8");
    const harness = readFileSync(resolve(__dirname, "../../../apps/api/test/admin-browser/admin-browser-harness.ts"), "utf8");

    expect(releaseGate).toContain('id: "admin-browser"');
    expect(releaseGate).toContain('display: "pnpm test:admin-browser"');
    expect(releaseGate.indexOf('id: "api-e2e"')).toBeLessThan(releaseGate.indexOf('id: "admin-browser"'));
    expect(ci).toContain("pnpm exec playwright-core install --with-deps chromium");
    expect(ci).toContain("pnpm test:admin-browser");
    expect(ci.indexOf("playwright-core install --with-deps chromium")).toBeLessThan(ci.indexOf("pnpm test:admin-browser"));
    expect(harness).toContain("chromium.executablePath()");
  });

  it("fails the local release gate on leaked secrets or high-severity production advisories", () => {
    const releaseGate = readFileSync(resolve(__dirname, "../../../scripts/release-gate.ts"), "utf8");

    expect(releaseGate).toContain('id: "secret-scan"');
    expect(releaseGate).toContain('display: "pnpm security:secrets"');
    expect(releaseGate).toContain('id: "prod-audit"');
    expect(releaseGate).toContain('display: "pnpm security:audit"');
    expect(releaseGate.indexOf('id: "env"')).toBeLessThan(releaseGate.indexOf('id: "secret-scan"'));
    expect(releaseGate.indexOf('id: "secret-scan"')).toBeLessThan(releaseGate.indexOf('id: "prod-audit"'));
    expect(releaseGate.indexOf('id: "prod-audit"')).toBeLessThan(releaseGate.indexOf('id: "prisma-validate"'));
  });

  it("resolves both Nest and Express through the patched body-parser release", () => {
    const workspace = readFileSync(resolve(__dirname, "../../../pnpm-workspace.yaml"), "utf8");
    const lockfile = readFileSync(resolve(__dirname, "../../../pnpm-lock.yaml"), "utf8");

    expect(workspace).toContain("body-parser: 1.20.6");
    expect(lockfile).toContain("body-parser@1.20.6:");
    expect(lockfile).not.toContain("body-parser@1.20.4:");
  });

  it("resolves every build pipeline through the patched PostCSS release", () => {
    const workspace = readFileSync(resolve(__dirname, "../../../pnpm-workspace.yaml"), "utf8");
    const lockfile = readFileSync(resolve(__dirname, "../../../pnpm-lock.yaml"), "utf8");

    expect(workspace).toContain("postcss: 8.5.18");
    expect(lockfile).toContain("postcss@8.5.18:");
    expect(workspace).toContain("brace-expansion: 5.0.8");
    expect(lockfile).toContain("brace-expansion@5.0.8:");
    expect(lockfile).not.toContain("postcss@8.5.10:");
    expect(lockfile).not.toContain("postcss@8.5.11:");
  });

  it("resolves Expo archive handling above the patched node-tar security floor", () => {
    const workspace = readFileSync(resolve(__dirname, "../../../pnpm-workspace.yaml"), "utf8");
    const lockfile = readFileSync(resolve(__dirname, "../../../pnpm-lock.yaml"), "utf8");

    expect(workspace).toContain("tar: 7.5.21");
    expect(lockfile).toContain("tar@7.5.21:");
    expect(lockfile).not.toContain("tar@7.5.19:");
    expect(lockfile).not.toContain("tar@7.5.20:");
  });

  it("keeps the Admin runtime above the patched Next.js security floor", () => {
    const rootPackage = JSON.parse(
      readFileSync(resolve(__dirname, "../../../package.json"), "utf8")
    ) as { devDependencies?: Record<string, string> };
    const adminPackage = JSON.parse(
      readFileSync(resolve(__dirname, "../../../apps/admin/package.json"), "utf8")
    ) as { dependencies?: Record<string, string> };
    const lockfile = readFileSync(resolve(__dirname, "../../../pnpm-lock.yaml"), "utf8");

    expect(adminPackage.dependencies?.next).toBe("^15.5.21");
    expect(rootPackage.devDependencies?.["@next/eslint-plugin-next"]).toBe("15.5.21");
    expect(lockfile).toContain("next@15.5.21:");
    expect(lockfile).not.toContain("next@15.5.20:");
  });

  it("pins the same pnpm version for contributors and every CI job", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, "../../../package.json"), "utf8")
    ) as { packageManager?: string };
    const ci = readFileSync(resolve(__dirname, "../../../.github/workflows/ci.yml"), "utf8");
    const expectedVersion = packageJson.packageManager?.match(/^pnpm@(\d+\.\d+\.\d+)$/)?.[1];

    expect(expectedVersion).toBeDefined();
    expect(ci.match(/version: 11\.9\.0/g)).toHaveLength(2);
    expect(packageJson.packageManager).toBe("pnpm@11.9.0");
  });

  it("declares no filesystem outputs for typecheck-only workspace builds", () => {
    const turbo = JSON.parse(
      readFileSync(resolve(__dirname, "../../../turbo.json"), "utf8")
    ) as {
      tasks?: Record<string, { dependsOn?: string[]; outputs?: string[] }>;
    };
    const typecheckOnlyPackages = [
      "packages/config/package.json",
      "packages/contracts/package.json",
      "packages/domain/package.json",
      "packages/test-utils/package.json",
      "packages/ui/package.json"
    ];

    for (const packagePath of typecheckOnlyPackages) {
      const packageJson = JSON.parse(
        readFileSync(resolve(__dirname, "../../..", packagePath), "utf8")
      ) as { name?: string; scripts?: { build?: string } };

      expect(packageJson.scripts?.build).toBe("tsc --noEmit");
      expect(turbo.tasks?.[`${packageJson.name}#build`]).toEqual({
        dependsOn: ["^build"],
        outputs: []
      });
    }
  });

  it("blocks local releases and CI when Expo native dependencies drift from the SDK contract", () => {
    const rootPackage = JSON.parse(
      readFileSync(resolve(__dirname, "../../../package.json"), "utf8")
    ) as { scripts?: Record<string, string> };
    const releaseGate = readFileSync(resolve(__dirname, "../../../scripts/release-gate.ts"), "utf8");
    const ci = readFileSync(resolve(__dirname, "../../../.github/workflows/ci.yml"), "utf8");

    expect(rootPackage.scripts?.["mobile:deps:check"]).toBe("pnpm --filter mobile exec expo install --check");
    expect(rootPackage.scripts?.lint).toContain("--ext .ts,.tsx,.mts");
    expect(releaseGate).toContain('id: "mobile-deps"');
    expect(releaseGate).toContain('display: "pnpm mobile:deps:check"');
    expect(ci).toContain("pnpm mobile:deps:check");
    expect(ci.indexOf("pnpm install --frozen-lockfile")).toBeLessThan(ci.indexOf("pnpm mobile:deps:check"));
  });

  it("keeps the secret scan stable when tracked files are deleted or renamed", () => {
    const secretScan = readFileSync(resolve(__dirname, "../../../scripts/scan-secrets.ts"), "utf8");

    expect(secretScan).toContain('if (!existsSync(file)) continue;');
    expect(secretScan.indexOf("if (!existsSync(file)) continue;")).toBeLessThan(secretScan.indexOf("statSync(file)"));
    expect(secretScan).toContain('".mts"');
  });
});
