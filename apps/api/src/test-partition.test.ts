import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { releaseGateE2eFiles } from "../vitest.test-groups";

const apiRoot = resolve(__dirname, "..");

function testFilesUnder(directory: string): string[] {
  const absoluteDirectory = resolve(apiRoot, directory);
  return readdirSync(absoluteDirectory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
    .map((entry) => relative(apiRoot, resolve(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

describe("API release-gate test partition", () => {
  it("owns one unique, existing E2E file list", () => {
    expect(new Set(releaseGateE2eFiles).size).toBe(releaseGateE2eFiles.length);
    expect(releaseGateE2eFiles.every((file) => existsSync(resolve(apiRoot, file)))).toBe(true);
  });

  it("partitions every non-browser test into exactly one release-gate lane", () => {
    const allNonBrowserTests = [...testFilesUnder("src"), ...testFilesUnder("test")]
      .filter((file) => !file.startsWith("test/admin-browser/"))
      .sort();
    const e2eFiles = new Set(releaseGateE2eFiles);
    const unitFiles = allNonBrowserTests.filter((file) => !e2eFiles.has(file));

    expect([...unitFiles, ...releaseGateE2eFiles].sort()).toEqual(allNonBrowserTests);
  });

  it("runs the shared list once in the dedicated E2E config", () => {
    const packageJson = JSON.parse(readFileSync(resolve(apiRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const tsconfig = JSON.parse(readFileSync(resolve(apiRoot, "tsconfig.json"), "utf8")) as {
      include?: string[];
    };
    const unitConfig = readFileSync(resolve(apiRoot, "vitest.config.mts"), "utf8");
    const e2eConfig = readFileSync(resolve(apiRoot, "vitest.e2e.config.mts"), "utf8");
    const browserConfig = readFileSync(resolve(apiRoot, "vitest.browser.config.mts"), "utf8");

    expect(packageJson.scripts.test).toBe("vitest run");
    expect(packageJson.scripts["test:e2e"]).toBe("vitest run --config vitest.e2e.config.mts");
    expect(packageJson.scripts["test:admin-browser"]).toBe("vitest run --config vitest.browser.config.mts");
    expect(unitConfig).toContain("...releaseGateE2eFiles");
    expect(e2eConfig).toContain("include: releaseGateE2eFiles");
    expect(browserConfig).toContain('include: ["test/admin-browser/**/*.browser.test.ts"]');
    expect(tsconfig.include).toContain("vitest*.mts");
  });
});
