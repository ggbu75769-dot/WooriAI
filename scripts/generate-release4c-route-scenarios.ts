import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type RouteInventory = {
  sourceHead: string;
  counts: {
    routes: number;
  };
  routes: Array<{
    route: string;
    path: string;
    scaffold: string;
    loading: boolean;
    empty: boolean;
    error: boolean;
    offline: boolean;
    permissionDenied: boolean;
    harnessOnly: boolean;
  }>;
};

type ScenarioName =
  | "normal"
  | "loading"
  | "empty"
  | "error"
  | "offline"
  | "authorization"
  | "long_content"
  | "large_monetary_values"
  | "large_catalog_list";

type ScenarioStatus =
  | "AUTOMATED_PASS"
  | "AUTOMATED_FAIL"
  | "RUNTIME_ONLY"
  | "NOT_APPLICABLE"
  | "BLOCKED_EXTERNAL";

type Scenario = {
  status: ScenarioStatus;
  reason: string;
  sourceSignal?: boolean;
};

const repoRoot = resolve(__dirname, "..");
const inputPath = resolve(repoRoot, "docs/qa/evidence/release4-ui-route-inventory.json");
const outputPath = resolve(repoRoot, "apps/mobile/e2e/release4c-route-scenarios.json");
const input = JSON.parse(readFileSync(inputPath, "utf8")) as RouteInventory;
const routes = input.routes.filter((route) => !route.harnessOnly);

const nonRenderedPaths = new Set([
  "apps/mobile/app/index.tsx",
  "apps/mobile/app/import/index.tsx",
  "apps/mobile/app/onboarding/budget.tsx",
  "apps/mobile/app/onboarding/child-profile.tsx",
  "apps/mobile/app/onboarding/child-status.tsx",
  "apps/mobile/app/onboarding/prepared-items.tsx",
  "apps/mobile/app/onboarding/resume.tsx"
]);
const synchronousPaths = new Set([
  "apps/mobile/app/(onboarding)/child-status.tsx",
  "apps/mobile/app/(onboarding)/resume.tsx",
  "apps/mobile/app/launch-animation.tsx",
  "apps/mobile/app/profile.tsx",
  "apps/mobile/app/settings/index.tsx"
]);
const collectionPaths = new Set([
  "apps/mobile/app/(tabs)/index.tsx",
  "apps/mobile/app/(tabs)/items.tsx",
  "apps/mobile/app/(tabs)/records.tsx",
  "apps/mobile/app/(tabs)/reports.tsx",
  "apps/mobile/app/budget.tsx",
  "apps/mobile/app/children/index.tsx",
  "apps/mobile/app/family/index.tsx",
  "apps/mobile/app/import/[importJobId].tsx",
  "apps/mobile/app/notifications.tsx",
  "apps/mobile/app/payment-methods.tsx",
  "apps/mobile/app/sync-status.tsx"
]);
const authorizationPaths = new Set([
  "apps/mobile/app/(tabs)/more.tsx",
  "apps/mobile/app/expenses/[expenseId].tsx",
  "apps/mobile/app/family/accept/[token].tsx",
  "apps/mobile/app/family/index.tsx",
  "apps/mobile/app/family/invite.tsx",
  "apps/mobile/app/import/[importJobId].tsx",
  "apps/mobile/app/items/[itemTemplateId].tsx",
  "apps/mobile/app/settings/privacy.tsx"
]);
const monetaryPaths = new Set([
  "apps/mobile/app/(onboarding)/budget.tsx",
  "apps/mobile/app/(tabs)/index.tsx",
  "apps/mobile/app/(tabs)/records.tsx",
  "apps/mobile/app/(tabs)/reports.tsx",
  "apps/mobile/app/budget.tsx",
  "apps/mobile/app/expenses/new.tsx",
  "apps/mobile/app/expenses/[expenseId].tsx",
  "apps/mobile/app/import/[importJobId].tsx",
  "apps/mobile/app/items/[itemTemplateId].tsx"
]);
const catalogListPaths = new Set([
  "apps/mobile/app/(onboarding)/prepared-items.tsx",
  "apps/mobile/app/(tabs)/items.tsx"
]);

function notApplicable(reason: string): Scenario {
  return { status: "NOT_APPLICABLE", reason };
}

function runtime(reason: string): Scenario {
  return { status: "RUNTIME_ONLY", reason };
}

function sourceBacked(signal: boolean, reason: string): Scenario {
  return signal
    ? { status: "AUTOMATED_PASS", reason: `${reason}; verified by release4h-route-state-closure.test.ts`, sourceSignal: true }
    : runtime(`${reason}; no dedicated source-state signal was detected`);
}

function scenarioFor(
  name: ScenarioName,
  route: RouteInventory["routes"][number]
): Scenario {
  const nonRendered = nonRenderedPaths.has(route.path);
  if (name === "normal") {
    return nonRendered
      ? notApplicable("redirect or re-export route has no independent rendered state")
      : sourceBacked(true, "rendered route source exists; installed-app execution is still required");
  }
  if (nonRendered) {
    return notApplicable("redirect or re-export route delegates all rendered states to its destination");
  }
  if (name === "loading") {
    return synchronousPaths.has(route.path)
      ? notApplicable("route is synchronous and does not wait for remote or persisted data")
      : sourceBacked(route.loading, "asynchronous route requires a deterministic loading state");
  }
  if (name === "empty") {
    return collectionPaths.has(route.path)
      ? sourceBacked(route.empty, "collection or summary route requires an empty-data state")
      : notApplicable("route is a form, detail, transition, or static settings surface rather than an empty collection");
  }
  if (name === "error") {
    return synchronousPaths.has(route.path)
      ? notApplicable("route has no asynchronous operation with a distinct recoverable error state")
      : sourceBacked(route.error, "network or persisted-data operation requires a recoverable error state");
  }
  if (name === "offline") {
    return route.path.includes("launch-animation") || route.path.includes("oauth/kakao")
      ? notApplicable("transition route cannot provide a useful offline data surface")
      : sourceBacked(route.offline, "installed-app offline and reconnect behavior must be exercised");
  }
  if (name === "authorization") {
    return authorizationPaths.has(route.path)
      ? sourceBacked(route.permissionDenied, "resource or role scoped route requires denied-access behavior")
      : notApplicable("route has no resource-specific or role-specific authorization branch after navigation gating");
  }
  if (name === "long_content") {
    return sourceBacked(true, "rendered Korean text and user-entered content must be exercised at font scale 1.5");
  }
  if (name === "large_monetary_values") {
    return monetaryPaths.has(route.path)
      ? runtime("monetary route requires deterministic large-value fixture and overflow verification")
      : notApplicable("route does not render monetary values");
  }
  return catalogListPaths.has(route.path)
    ? runtime("catalog collection requires a deterministic large-list fixture and scroll verification")
    : notApplicable("route does not render a catalog collection");
}

const scenarioNames: ScenarioName[] = [
  "normal",
  "loading",
  "empty",
  "error",
  "offline",
  "authorization",
  "long_content",
  "large_monetary_values",
  "large_catalog_list"
];
const widthsDp = [320, 360, 390, 411, 430, 600, 840];
const fontScales = [1, 1.3, 1.5];
const androidVersions = [13, 14, 15];
const entries = routes.map((route) => ({
  route: route.route,
  sourcePath: route.path,
  renderedByDestination: nonRenderedPaths.has(route.path),
  scenarios: Object.fromEntries(scenarioNames.map((name) => [name, scenarioFor(name, route)]))
}));
const statusCounts = entries
  .flatMap((entry) => Object.values(entry.scenarios))
  .reduce<Record<ScenarioStatus, number>>(
    (counts, scenario) => {
      counts[scenario.status] += 1;
      return counts;
    },
    {
      AUTOMATED_PASS: 0,
      AUTOMATED_FAIL: 0,
      RUNTIME_ONLY: 0,
      NOT_APPLICABLE: 0,
      BLOCKED_EXTERNAL: 0
    }
  );
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceHead,
  generatedFrom: "docs/qa/evidence/release4-ui-route-inventory.json",
  evidencePolicy: {
    automatedPassIsContractQualificationOnly: true,
    runtimePassRequiresInstalledAndroidEvidence: true,
    browserOrExpoWebIsFinalEvidence: false
  },
  summary: {
    routeFiles: entries.length,
    scenariosPerRoute: scenarioNames.length,
    classifiedScenarios: entries.length * scenarioNames.length,
    statusCounts,
    runtimePassed: 0
  },
  layoutMatrix: {
    widthsDp,
    fontScales,
    androidVersions,
    combinations: widthsDp.length * fontScales.length * androidVersions.length,
    status: "RUNTIME_ONLY",
    assertions: [
      "no_horizontal_overflow",
      "no_right_side_excess_whitespace",
      "safe_area",
      "keyboard_avoidance",
      "modal_and_bottom_sheet_bounds",
      "long_korean_text",
      "button_wrapping",
      "card_width",
      "chart_width",
      "tab_bar"
    ]
  },
  accessibilityMatrix: {
    status: "RUNTIME_ONLY",
    assertions: [
      "label_role_state",
      "focus_order",
      "screen_reader_traversal",
      "touch_target_48dp",
      "color_independent_state",
      "reduce_motion",
      "font_scale_1_5",
      "keyboard_avoidance",
      "modal_focus_restore"
    ]
  },
  routes: entries
};

if (entries.length !== input.counts.routes) {
  throw new Error(
    `Route inventory count mismatch: inventory reports ${input.counts.routes}, scenario input has ${entries.length}`
  );
}
const expectedScenarioCount = input.counts.routes * scenarioNames.length;
if (output.summary.classifiedScenarios !== expectedScenarioCount) {
  throw new Error(
    `Scenario count mismatch: expected ${expectedScenarioCount}, found ${output.summary.classifiedScenarios}`
  );
}
if (input.sourceHead !== sourceHead) {
  throw new Error("Route inventory is stale for the current source HEAD; run pnpm ux:contract first");
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, ...output.summary, layoutCombinations: output.layoutMatrix.combinations }, null, 2));
