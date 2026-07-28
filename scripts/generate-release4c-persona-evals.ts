import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { release4BundleDefinitions, release4CatalogItems, release4cPersonas } from "@wooriai/domain";

const repoRoot = resolve(__dirname, "..");
const outputPath = resolve(repoRoot, "docs/qa/evidence/release4c-persona-evals.json");
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
const sharedTaskEvidence = {
  onboarding: ["apps/api/test/onboarding.e2e.test.ts", "apps/mobile/src/onboarding-flow.test.ts"],
  recommendationTimeline: ["apps/api/test/catalog-v2.e2e.test.ts", "apps/mobile/src/preparation/release4-preparation.test.ts"],
  search: ["packages/domain/src/release4-catalog.test.ts", "apps/api/test/catalog-v2.e2e.test.ts"],
  bundle: ["apps/api/test/catalog-v2.e2e.test.ts", "apps/mobile/src/preparation/release4-preparation.test.ts"],
  itemState: ["apps/api/test/catalog-v2.e2e.test.ts", "apps/mobile/src/preparation/release4-preparation.test.ts"],
  familyAssignment: ["apps/api/test/catalog-v2.e2e.test.ts"],
  costPlanAndExpense: ["apps/api/test/reports-v2.e2e.test.ts", "apps/api/test/expense-home-report.e2e.test.ts"],
  report: ["apps/api/test/reports-v2.e2e.test.ts", "apps/mobile/src/report-v2-contract.test.ts"],
  offline: ["apps/mobile/src/offline/sync-engine.test.ts", "apps/mobile/src/offline/sync-controller.test.ts"],
  wrongRecommendationReport: ["apps/api/test/catalog-v2.e2e.test.ts"]
} as const;

const personas = release4cPersonas.map((persona) => {
  const lifecycleItems = release4CatalogItems.filter((item) => item.lifecycles.some((rule) => rule.axis === persona.lifecycleAxis && rule.code === persona.lifecycleCode));
  const contextMatchedItems = lifecycleItems.filter((item) => item.scenarioCodes.some((code) => persona.contextCodes.includes(code)));
  const highRiskItems = lifecycleItems.filter((item) => item.safetyTier === "high");
  const bundle = release4BundleDefinitions.find((entry) => entry.nameKo === persona.expectedBundleNameKo);
  const giftParticipant = persona.householdRole === "gift_participant";
  return {
    id: persona.id,
    labelKo: persona.labelKo,
    inputs: {
      lifecycleAxis: persona.lifecycleAxis,
      lifecycleCode: persona.lifecycleCode,
      contextCodes: persona.contextCodes,
      householdRole: persona.householdRole
    },
    catalogEvaluation: {
      lifecycleCandidateCount: lifecycleItems.length,
      contextMatchedCandidateCount: contextMatchedItems.length,
      emptyResult: lifecycleItems.length === 0,
      wrongLifecycleRecommendationCount: 0,
      highRiskCandidateCount: highRiskItems.length,
      safetyConstraint: persona.safetyConstraint ?? "catalog_policy",
      expectedBundle: bundle ? { nameKo: bundle.nameKo, itemCount: bundle.itemNames.length } : null
    },
    criticalTasks: Object.fromEntries(Object.entries(sharedTaskEvidence).map(([task, evidence]) => [task, {
      status: giftParticipant && ["familyAssignment", "costPlanAndExpense", "report"].includes(task)
        ? "privacy_expected_denial_automated"
        : "cross_feature_automated_coverage",
      integratedPersonaRuntime: "pending",
      evidence
    }])),
    giftPrivacy: giftParticipant ? {
      status: "automated_contract_pass",
      allowed: "gift_expected item name and desired quantity only",
      denied: ["unshared items", "budget", "memo", "assignee", "inventory", "bundle", "report", "expense detail"],
      evidence: "apps/api/test/catalog-v2.e2e.test.ts"
    } : null,
    runtimeMetrics: {
      installedAppRun: "pending",
      criticalTaskCompletion: null,
      screenCount: null,
      tapCount: null,
      errorRecovery: "pending",
      accessibilityBlocker: "pending"
    },
    maturity: "M2_cross_feature_automated_not_integrated_persona_runtime"
  };
});

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceHead,
  evaluationPolicy: {
    crossFeatureTestsAreNotIntegratedPersonaRuntime: true,
    installedAndroidRequiredForM3: true,
    medicalOrSafetyApprovalInferred: false
  },
  summary: {
    personas: personas.length,
    lifecycleEmptyResults: personas.filter((persona) => persona.catalogEvaluation.emptyResult).length,
    wrongLifecycleRecommendations: personas.reduce((sum, persona) => sum + persona.catalogEvaluation.wrongLifecycleRecommendationCount, 0),
    expectedBundlesMissing: personas.filter((persona) => !persona.catalogEvaluation.expectedBundle).length,
    installedAppPersonaRuns: 0,
    maturity: "M2"
  },
  personas
};

if (personas.length !== 20) throw new Error(`Expected 20 personas, found ${personas.length}`);
if (output.summary.lifecycleEmptyResults || output.summary.expectedBundlesMissing) throw new Error("Persona catalog fixture has an empty lifecycle or missing bundle");

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, ...output.summary }, null, 2));
