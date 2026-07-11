import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("release gate package-manager runner", () => {
  it("passes gate arguments directly to the active package-manager CLI", () => {
    const source = readFileSync(resolve(__dirname, "../../../scripts/release-gate.ts"), "utf8");

    expect(source).toContain("[packageManagerCliPath, ...gateCommand.args]");
    expect(source).not.toContain('["exec", "--yes", "pnpm@');
  });
});
