import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { childScopedRequestEnabled } from "./query/child-scope";

const workspaceRoot = path.resolve(process.cwd(), "../..");

describe("Release 5U no-child request budget", () => {
  it("keeps child-scoped request eligibility at zero across 30 no-child restores", () => {
    for (let repeat = 0; repeat < 30; repeat += 1) {
      expect(childScopedRequestEnabled(`access-${repeat}`, null)).toBe(false);
    }
    expect(childScopedRequestEnabled("access", "child-1")).toBe(true);
  });

  it("wires every core tab through the shared child-scope guard", () => {
    for (const relativePath of [
      "apps/mobile/app/(tabs)/index.tsx",
      "apps/mobile/app/(tabs)/items.tsx",
      "apps/mobile/app/(tabs)/records.tsx",
      "apps/mobile/app/(tabs)/reports.tsx"
    ]) {
      const source = readFileSync(path.join(workspaceRoot, relativePath), "utf8");
      expect(source, relativePath).toContain("childScopedRequestEnabled");
    }
  });
});
