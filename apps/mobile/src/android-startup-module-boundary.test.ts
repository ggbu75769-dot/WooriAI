import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const readMobile = (path: string) => readFileSync(join(mobileRoot, path), "utf8");

function staticImports(path: string): string[] {
  const source = readMobile(path);
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return sourceFile.statements.flatMap((statement) => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return [];
    return [statement.moduleSpecifier.text];
  });
}

describe("Android first-render module boundary", () => {
  it("keeps fixture backend evaluation and offline database work outside the startup graph", () => {
    expect(staticImports("app/_layout.tsx")).not.toContain("../src/offline/sync-controller");
    expect(staticImports("app/_layout.tsx")).not.toContain("../src/api/client");
    expect(staticImports("app/index.tsx")).not.toContain("../src/api/fixture-runtime");
    expect(staticImports("app/(tabs)/index.tsx")).not.toEqual(expect.arrayContaining([
      "../../src/api/fixture-runtime",
      "../../src/offline/sync-controller"
    ]));
    expect(staticImports("src/stores/session.store.ts")).not.toContain("../api/fixture-runtime");
    expect(staticImports("src/stores/session.store.ts")).not.toEqual(expect.arrayContaining([
      "../receipts/offline-draft",
      "./onboarding-draft.store",
      "./onboarding-progress.store"
    ]));
    expect(staticImports("src/stores/selected-child.store.ts")).not.toContain("../api/fixture-runtime");

    expect(staticImports("src/api/client.ts")).not.toEqual(expect.arrayContaining([
      "./fixture-runtime",
      "./local-backend",
      "./local-fixtures"
    ]));
    expect(staticImports("src/api/fixture-backend-loader.native.ts")).not.toContain("./local-backend");
    expect(readMobile("src/api/fixture-backend-loader.native.ts")).toContain('require("./local-backend")');
    expect(readMobile("src/api/client.ts")).toContain("setTimeout(() => {");
    for (const path of [
      "src/api/client.ts",
      "src/api/local-backend.ts",
      "src/design-system/components/OnboardingControls.tsx",
      "src/stores/onboarding-draft.store.ts"
    ]) {
      expect(staticImports(path), path).not.toContain("@wooriai/domain");
    }
    expect(staticImports("src/api/catalog-domain-loader.native.ts")).not.toContain("@wooriai/domain/release4-catalog");
    expect(readMobile("src/api/catalog-domain-loader.native.ts")).toContain('require("@wooriai/domain/release4-catalog")');

    for (const [path, barrel] of [
      ["app/_layout.tsx", "../src/design-system"],
      ["app/index.tsx", "../src/design-system"],
      ["app/(tabs)/_layout.tsx", "../../src/design-system"],
      ["app/(tabs)/index.tsx", "../../src/design-system"]
    ] as const) {
      expect(staticImports(path), path).not.toContain(barrel);
    }
  });

  it("loads sync only after the first React render while preserving the lifecycle", () => {
    const rootLayout = readMobile("app/_layout.tsx");
    expect(rootLayout).toContain('import("../src/offline/OfflineSyncLifecycle")');
    expect(rootLayout).toContain("InteractionManager.runAfterInteractions");
    expect(readMobile("src/offline/OfflineSyncLifecycle.tsx")).toContain(
      "useOfflineSyncLifecycle(token, scopeKey, sessionGeneration, client)"
    );
  });

  it("does not hold a completed session on secure onboarding-draft hydration", () => {
    const indexRoute = readMobile("app/index.tsx");
    const navigationGate = indexRoute.match(
      /function navigationStoresHydrated\(\)[\s\S]*?\n}/
    )?.[0];
    expect(navigationGate).toBeDefined();
    expect(navigationGate).not.toContain("useOnboardingDraftStore");
    expect(indexRoute).toContain("if (hasReachedHome)");
    expect(indexRoute).toContain("if (!draftHydrated)");
  });

  it("uses lightweight profile-aware fixture identifiers in startup-safe modules", () => {
    const identifiers = readMobile("src/api/fixture-identifiers.ts");
    expect(staticImports("src/api/fixture-identifiers.ts")).not.toEqual(expect.arrayContaining([
      "./client",
      "./local-backend",
      "./local-fixtures",
      "./fixture-runtime"
    ]));
    expect(identifiers).toContain('fixtureSessionToken = "wooriai-local-session"');

    const metro = readMobile("metro.config.js");
    expect(metro).toContain('`@wooriai/domain/${name}`');
    expect(metro).toContain('path.resolve(domainSourceRoot, `${name}.ts`)');
    expect(metro).toContain("fixture-identifiers.production.ts");
    expect(metro).toContain("fixture-backend-loader.production.ts");
    expect(readMobile("src/api/fixture-identifiers.production.ts")).not.toContain("wooriai-local-session");
    expect(readMobile("src/api/fixture-backend-loader.production.ts")).not.toContain("./local-backend");
  });
});
