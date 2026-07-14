import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("Sprint 1 profile and onboarding product contract", () => {
  it("separates the account profile from child profiles and keeps profile one tap from every tab", () => {
    expect(existsSync(join(mobileRoot, "app/profile.tsx"))).toBe(true);
    const profile = source("app/profile.tsx");
    expect(profile).toContain('testID="screen-PROFILE-001"');
    expect(profile).toContain('label="이름"');
    expect(profile).toContain('label="이메일"');
    expect(profile).toContain('label="로그인 방식"');

    for (const screen of ["index.tsx", "records.tsx", "items.tsx", "reports.tsx"]) {
      expect(source(`app/(tabs)/${screen}`), screen).toContain('router.push("/profile" as Href)');
    }
  });

  it("blocks direct tab entry when there is no selected child", () => {
    const layout = source("app/(tabs)/_layout.tsx");
    expect(layout).toContain("useSelectedChildStore");
    expect(layout).toContain("if (!selectedChildId)");
    expect(layout).toContain('<Redirect href="/" />');
  });

  it("provides real add, switch, and edit child routes", () => {
    for (const route of ["app/children/index.tsx", "app/children/new.tsx", "app/children/[childId].tsx"]) {
      expect(existsSync(join(mobileRoot, route)), route).toBe(true);
    }
    const switcher = source("app/children/index.tsx");
    expect(switcher).toContain("invalidateChildScopedQueries");
    expect(switcher).toContain('router.push("/children/new" as Href)');
    expect(source("app/children/new.tsx")).toContain("createChild");
    expect(source("app/children/[childId].tsx")).toContain("updateChild");
  });

  it("refreshes every child-scoped product query after switching or editing", () => {
    const cache = source("src/children/query-cache.ts");
    for (const root of ["home", "expenses", "items", "item-detail", "report", "budget"]) {
      expect(cache).toContain(`"${root}"`);
    }
  });

  it("removes local sample state as part of test-session logout", () => {
    expect(source("app/profile.tsx")).toContain("if (isTestSession) resetLocalBackend()");
    expect(source("app/settings/index.tsx")).toContain("if (isTestSession) resetLocalBackend()");
  });

  it("keeps an explicit unspecified option beside user-registered payment methods", () => {
    const expense = source("app/expenses/new.tsx");
    expect(expense).toContain('{ id: null, type: "unknown" as const, label: "미지정", isDefault: false }');
    expect(expense).toContain("listPaymentMethods");
    expect(expense).toContain("useState(0)");
  });
});
