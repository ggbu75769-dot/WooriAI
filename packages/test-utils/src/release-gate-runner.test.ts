import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

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
});
