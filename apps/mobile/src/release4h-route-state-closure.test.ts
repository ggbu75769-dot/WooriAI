import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Scenario = { status: string; reason: string; sourceSignal?: boolean };
type RouteEntry = { sourcePath: string; renderedByDestination: boolean; scenarios: Record<string, Scenario> };

const root = path.resolve(process.cwd(), "../..");
const evidence = JSON.parse(
  readFileSync(path.join(root, "apps/mobile/e2e/release4c-route-scenarios.json"), "utf8")
) as { routes: RouteEntry[]; summary: { classifiedScenarios: number; statusCounts: Record<string, number> } };

describe("Release 4H route-state contract closure", () => {
  it("derives every production route cell and leaves no ambiguous legacy status", () => {
    const cells = evidence.routes.flatMap((route) => Object.values(route.scenarios));
    expect(cells).toHaveLength(evidence.summary.classifiedScenarios);
    expect(cells.some((cell) => /code_present_runtime|runtime_verification_required|later|difficult/i.test(cell.status))).toBe(false);
    expect(cells.every((cell) => ["AUTOMATED_PASS", "AUTOMATED_FAIL", "RUNTIME_ONLY", "NOT_APPLICABLE", "BLOCKED_EXTERNAL"].includes(cell.status))).toBe(true);
  });

  it("backs each automated cell with a source module and an explicit assertion reason", () => {
    for (const route of evidence.routes) {
      expect(existsSync(path.join(root, route.sourcePath)), route.sourcePath).toBe(true);
      for (const scenario of Object.values(route.scenarios)) {
        if (scenario.status !== "AUTOMATED_PASS") continue;
        expect(scenario.sourceSignal).toBe(true);
        expect(scenario.reason).toContain("release4h-route-state-closure.test.ts");
      }
    }
  });

  it("keeps every runtime-only cell tied to a concrete native limitation", () => {
    const runtime = evidence.routes.flatMap((route) =>
      Object.entries(route.scenarios).flatMap(([name, scenario]) => scenario.status === "RUNTIME_ONLY" ? [{ name, scenario }] : [])
    );
    expect(runtime.length).toBeGreaterThan(0);
    for (const { name, scenario } of runtime) {
      expect(["offline", "loading", "authorization", "large_monetary_values", "large_catalog_list"]).toContain(name);
      expect(scenario.reason).toMatch(/installed-app|deterministic|overflow|scroll|source-state signal/);
    }
  });
});
