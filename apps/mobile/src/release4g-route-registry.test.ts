import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = path.resolve(process.cwd(), "../..");
const appRoot = path.join(workspaceRoot, "apps/mobile/app");
const blockingRoutePaths = [
  "(auth)/login.tsx",
  "(onboarding)/budget.tsx",
  "(onboarding)/child-profile.tsx",
  "(onboarding)/child-status.tsx",
  "(onboarding)/prepared-items.tsx",
  "(onboarding)/resume.tsx",
  "(tabs)/index.tsx",
  "(tabs)/items.tsx",
  "(tabs)/records.tsx",
  "(tabs)/reports.tsx",
  "children/index.tsx",
  "items/[itemTemplateId].tsx",
  "expenses/new.tsx",
  "expenses/[expenseId].tsx",
  "reports/sources.tsx",
  "notifications.tsx",
  "family/index.tsx",
  "settings/privacy.tsx",
  "sync-status.tsx"
] as const;

describe("Release 4G mobile route registry contract", () => {
  it("tracks 51 current production routes and all 19 blocking route modules", () => {
    const inventory = JSON.parse(
      readFileSync(path.join(workspaceRoot, "docs/qa/evidence/release4-ui-route-inventory.json"), "utf8")
    ) as { routes: Array<{ path: string; harnessOnly: boolean }> };
    const currentProductionRoutes = inventory.routes.filter((route) => !route.harnessOnly);
    // Release 5U adds the path-specific onboarding and core-task routes while
    // retaining every earlier deep-link target. The regenerated inventory is
    // the source of truth for the current 51-route production surface.
    const reportSourcePath = "apps/mobile/app/reports/sources.tsx";
    const inventoried = new Set(currentProductionRoutes.map((route) => route.path));
    expect(currentProductionRoutes).toHaveLength(51);
    expect(inventoried.has(reportSourcePath)).toBe(true);
    expect(existsSync(path.join(workspaceRoot, reportSourcePath))).toBe(true);

    expect(blockingRoutePaths).toHaveLength(19);
    for (const routePath of blockingRoutePaths) {
      expect(existsSync(path.join(appRoot, routePath)), routePath).toBe(true);
    }
  });

  it("keeps authentication central and blocking routes on shared state/accessibility surfaces", () => {
    const rootLayout = readFileSync(path.join(appRoot, "_layout.tsx"), "utf8");
    const offlineLifecycle = readFileSync(path.join(appRoot, "..", "src", "offline", "OfflineSyncLifecycle.tsx"), "utf8");
    expect(rootLayout).toContain("useSessionStore");
    expect(rootLayout).toContain("DeferredOfflineSyncLifecycle");
    expect(offlineLifecycle).toContain("useOfflineSyncLifecycle");

    for (const routePath of blockingRoutePaths) {
      const source = readFileSync(path.join(appRoot, routePath), "utf8");
      expect(source, routePath).toMatch(/AppScreen|ScreenScaffold|Redirect|export \{ default \}/);
      expect(source, routePath).not.toMatch(/stack\s*trace|sqlite.*error|sql.*error/i);
    }
  });
});
