import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const repoRoot = resolve(__dirname, "..");
const mobileAppRoot = resolve(repoRoot, "apps/mobile/app");
const output = resolve(repoRoot, "docs/qa/evidence/release4-ui-route-inventory.json");
const strict = process.argv.includes("--strict");
const uiFacadeSource = readFileSync(resolve(repoRoot, "apps/mobile/src/ui.tsx"), "utf8");
const themeSource = readFileSync(resolve(repoRoot, "apps/mobile/src/theme.ts"), "utf8");
const asyncStateSource = readFileSync(resolve(repoRoot, "apps/mobile/src/design-system/patterns/AsyncState.tsx"), "utf8");

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}

function routeFor(file: string) {
  const normalized = relative(mobileAppRoot, file).split(sep).join("/").replace(/\.tsx$/, "");
  return `/${normalized.replace(/(^|\/)index$/, "$1").replace(/\/$/, "")}`.replace(/\/\([^/]+\)/g, "") || "/";
}

function countMatches(source: string, expression: RegExp) {
  return [...source.matchAll(expression)].length;
}

function importedNames(source: string, modulePattern: RegExp) {
  return [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/gs)]
    .filter((match) => modulePattern.test(match[2]))
    .flatMap((match) => match[1].split(",").map((name) => name.trim().split(/\s+as\s+/)[0]).filter(Boolean));
}

const legacyDomainWidgets = new Set(["DonutChartCard", "FamilyAvatarGroup", "HeroSummaryCard", "LineChartCard", "ProductCard", "ProductComparisonRow", "SegmentedControl"]);

function resolveLocalModule(fromFile: string, moduleName: string) {
  if (!moduleName.startsWith(".")) return null;
  const candidate = resolve(dirname(fromFile), moduleName);
  return [candidate, `${candidate}.tsx`, `${candidate}.ts`, join(candidate, "index.tsx"), join(candidate, "index.ts")]
    .find((path) => existsSync(path)) ?? null;
}

function productionUiCallPath(file: string, seen = new Set<string>()): Array<{ file: string; source: string }> {
  if (seen.has(file)) return [];
  seen.add(file);
  const source = readFileSync(file, "utf8");
  const defaultReexportOnly = /^export \{(?:\s*default\s*|[^}]*\bas\s+default\s*)\} from /m.test(source)
    && !/export\s+default\s+(?:function|class|[A-Za-z_$])/.test(source);
  const result = defaultReexportOnly ? [] : [{ file, source }];
  for (const match of source.matchAll(/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g)) {
    const dependency = resolveLocalModule(file, match[1]!);
    if (!dependency) continue;
    const normalized = dependency.split(sep).join("/");
    if (!/apps\/mobile\/(?:src\/(?:onboarding|preparation)|app\/\(onboarding\))\//.test(normalized)) continue;
    result.push(...productionUiCallPath(dependency, seen));
  }
  return result;
}

const routeFiles = filesUnder(mobileAppRoot).filter((file) => !file.endsWith(`${sep}_layout.tsx`));
const routes = routeFiles.map((file) => {
  const source = readFileSync(file, "utf8");
  const callPath = productionUiCallPath(file);
  const callPathSource = callPath.map((entry) => entry.source).join("\n");
  const relativePath = relative(repoRoot, file).split(sep).join("/");
  const isHarnessRoute = /pixel-lock|catalog-coverage-evidence/.test(relativePath);
  const isReexportRoute = /^export \{(?:\s*default\s*|[^}]*\bas\s+default\s*)\} from /m.test(source);
  const directDesignSystemComponents = [...new Set(importedNames(callPathSource, /(?:src[\\/]design-system|\.\.[\\/]design-system)$/))];
  const legacyUiComponents = [...new Set(importedNames(callPathSource, /(?:src[\\/]ui|\.\.[\\/]ui)$/))];
  const legacyFacadeComponents = legacyUiComponents.filter((name) => !legacyDomainWidgets.has(name));
  const usesPreparationSurface = source.includes("Release4PreparationScreen") || source.includes("Release4ItemDetailScreen");
  const designSystem =
    /src\/design-system|src\\design-system/.test(source) ||
    /src\/ui|src\\ui/.test(source) ||
    usesPreparationSurface ||
    isReexportRoute ||
    source.includes("<Redirect");
  const scaffold = source.includes("ScreenScaffold")
    ? "ScreenScaffold"
    : source.includes("AppScreen")
      ? "AppScreen"
      : isReexportRoute
        ? "Reexport-only"
      : source.includes("<Redirect")
        ? "Redirect-only"
        : "custom";
  return {
    route: routeFor(file),
    path: relativePath,
    owner: relative(mobileAppRoot, file).split(sep)[0].replace(/[()]/g, "") || "root",
    scaffold,
    designSystem,
    directDesignSystem: directDesignSystemComponents.length > 0 || usesPreparationSurface,
    directDesignSystemComponents,
    legacyUi: legacyFacadeComponents.length > 0,
    legacyUiComponents,
    legacyFacadeComponents,
    productionCallPathFiles: callPath.map((entry) => relative(repoRoot, entry.file).split(sep).join("/")),
    header: /PageHeader|TopAppBar|accessibilityRole="header"/.test(source),
    loading: /Skeleton|불러오고|isLoading|pending/.test(source),
    empty: /EmptyState|표시할 .* 없|아직 .* 없/.test(source),
    error: /ErrorState|isError|다시 시도|오류/.test(source),
    offline: /OfflineState|오프라인|offline/.test(source),
    permissionDenied: /permission|권한|접근할 수 없/.test(source),
    safeArea: scaffold === "ScreenScaffold" || scaffold === "AppScreen" ? "shared-scaffold" : scaffold,
    horizontalPadding: scaffold === "ScreenScaffold" || scaffold === "AppScreen" ? "responsive-shared-scaffold" : "route-owned",
    maxWidth: scaffold === "ScreenScaffold" || scaffold === "AppScreen" ? "shared-content-max" : "route-owned",
    keyboardAvoidance: /KeyboardAvoidingView|keyboardShouldPersistTaps/.test(source) || scaffold === "ScreenScaffold" || scaffold === "AppScreen",
    largeFontContract: /numberOfLines|adjustsFontSizeToFit/.test(source) ? "route-constraint-present" : "shared-font-scaling-default",
    screenReaderContract: /accessibility(Label|Role|State)=/.test(source) || legacyUiComponents.length > 0 || directDesignSystemComponents.length > 0,
    accessibilityLabels: countMatches(source, /accessibilityLabel=/g),
    rawColorLiterals: countMatches(source, /#[0-9A-Fa-f]{6}\b/g),
    transformDeclarations: countMatches(source, /\btransform\s*:/g),
    unicodeIconLiterals: countMatches(source, /[★☆●○■□▲▼▶◀‹›✅❌⚠️]/gu),
    hardcodedSpacingLiterals: countMatches(source, /\b(?:gap|padding(?:Top|Bottom|Left|Right|Horizontal|Vertical)?|margin(?:Top|Bottom|Left|Right|Horizontal|Vertical)?):\s*\d+\b/g),
    possibleSub48Targets: countMatches(source, /(?:height|width):\s*(?:[0-3]?\d|4[0-7])\b/g),
    harnessOnly: isHarnessRoute
  };
});

const productionRoutes = routes.filter((route) => !route.harnessOnly);
const renderedRoutes = productionRoutes.filter((route) => route.scaffold !== "Reexport-only" && route.scaffold !== "Redirect-only");
const reportSource = readFileSync(resolve(mobileAppRoot, "(tabs)/reports.tsx"), "utf8");
const familySource = readFileSync(resolve(mobileAppRoot, "family/index.tsx"), "utf8");
const reportProductionTransformIsolated =
  reportSource.includes("style={isPixelLockMode ? reportReferenceScaleFrameStyle() : undefined}") &&
  reportSource.includes("isPixelLockMode ? reportReferenceFrameStyle : productionReportFrameStyle");
const counts = {
  routes: productionRoutes.length,
  designSystemRoutes: productionRoutes.filter((route) => route.designSystem).length,
  directDesignSystemRoutes: productionRoutes.filter((route) => route.directDesignSystem).length,
  legacyUiRoutes: productionRoutes.filter((route) => route.legacyUi).length,
  fullyDirectMigratedRoutes: productionRoutes.filter((route) => route.directDesignSystem && !route.legacyUi).length,
  screenScaffoldRoutes: productionRoutes.filter((route) => route.scaffold !== "custom").length,
  designSystemPercentage: productionRoutes.length
    ? Math.round((productionRoutes.filter((route) => route.designSystem).length / productionRoutes.length) * 10000) / 100
    : 0,
  routesWithLoading: productionRoutes.filter((route) => route.loading).length,
  routesWithEmpty: productionRoutes.filter((route) => route.empty).length,
  routesWithError: productionRoutes.filter((route) => route.error).length,
  routesWithOffline: productionRoutes.filter((route) => route.offline).length,
  rawColorLiterals: productionRoutes.reduce((sum, route) => sum + route.rawColorLiterals, 0),
  unicodeIconLiterals: productionRoutes.reduce((sum, route) => sum + route.unicodeIconLiterals, 0),
  hardcodedSpacingLiterals: productionRoutes.reduce((sum, route) => sum + route.hardcodedSpacingLiterals, 0),
  possibleSub48Targets: productionRoutes.reduce((sum, route) => sum + route.possibleSub48Targets, 0)
};
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim(),
  counts,
  migration: {
    sharedFacadeCoverageComplete: counts.designSystemRoutes === counts.routes,
    directDesignSystemMigrationComplete: counts.legacyUiRoutes === 0 && counts.fullyDirectMigratedRoutes === counts.routes,
    definition: "A route is fully direct-migrated only when it imports the Release 4 design-system surface and no legacy src/ui facade components."
  },
  checks: {
    reportProductionTransformIsolated,
    allRoutesUseDesignSystem: counts.designSystemRoutes === counts.routes,
    allRoutesUseScreenScaffold: renderedRoutes.every((route) => route.scaffold === "ScreenScaffold" || route.scaffold === "AppScreen"),
    rawColorLiteralFree: counts.rawColorLiterals === 0,
    unicodeIconLiteralFree: counts.unicodeIconLiterals === 0,
    coreTouchTargetMinimum: /touchTarget:\s*48\b/.test(themeSource) && /height:\s*theme\.touchTarget/.test(uiFacadeSource) && /width:\s*theme\.touchTarget/.test(uiFacadeSource) && (asyncStateSource.match(/minHeight:\s*48/g)?.length ?? 0) >= 2,
    familyInviteTouchTargetCovered:
      familySource.includes('accessibilityLabel="가족 초대하기"') &&
      familySource.includes('accessibilityRole="button"') &&
      familySource.includes("hitSlop={2}") &&
      familySource.includes("height: 48") &&
      familySource.includes("width: 48"),
    commonStatePrimitives: {
      loading: asyncStateSource.includes("export function LoadingState"),
      empty: asyncStateSource.includes("export function EmptyState"),
      error: asyncStateSource.includes("export function ErrorState"),
      offline: asyncStateSource.includes("export function OfflineState"),
      sync: asyncStateSource.includes("export function SyncStatusBar")
    }
  },
  routes
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, ...counts, checks: report.checks }, null, 2));
if (strict && !Object.values(report.checks).every((value) => typeof value === "boolean" ? value : Object.values(value).every(Boolean))) {
  process.exitCode = 1;
}
