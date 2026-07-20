import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outputPath = join(root, "docs/qa/evidence/release4c-manifest.json");

function json(path: string) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(join(root, path))).digest("hex").toUpperCase();
}

function git(args: string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(String(result.stderr));
  return String(result.stdout).trim();
}

function evidence(path: string) {
  const absolute = join(root, path);
  return existsSync(absolute)
    ? { path: path.replaceAll("\\", "/"), bytes: statSync(absolute).size, sha256: sha256(path) }
    : { path: path.replaceAll("\\", "/"), missing: true };
}

const provenance = json("artifacts/android/release4c-build-provenance.json");
const pixelApk = json("artifacts/pixel-lock/android/reports/pixel-apk.json");
const pixel = json("artifacts/pixel-lock/android/reports/latest.json");
const gate = json("docs/qa/evidence/latest-release-gate.json");
const catalog = json("docs/qa/evidence/release4-catalog-audit.json");
const review = json("docs/qa/evidence/release4c-catalog-review-inventory.json");
const coverage = json("docs/qa/evidence/release4c-coverage-matrix.json");
const persona = json("docs/qa/evidence/release4c-persona-evals.json");
const routes = json("apps/mobile/e2e/release4c-route-scenarios.json");
const findings = json("docs/qa/evidence/release4c-findings.json");
const ownership = json("artifacts/dev-snapshots/release4c-file-ownership.json");
const migrations = readdirSync(join(root, "apps/api/prisma/migrations"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^\d{6}_/.test(entry.name))
  .map((entry) => entry.name)
  .sort();
const status = git(["-c", "core.quotePath=false", "status", "--short", "-uall"]);

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  verdict: {
    implementationAudit: "P0_P1_CLOSED_LOCAL",
    productFeatureMaturity: "MOSTLY_M2_SELECTED_M3",
    catalogStructuralCompleteness: "PASS",
    catalogReviewReadiness: "INVENTORY_COMPLETE_EXTERNAL_APPROVAL_REQUIRED",
    catalogPublishedCompleteness: "0_OF_408",
    adminOperations: "M2",
    installedAppUx: "CORE_SMOKE_AND_PIXEL_9_OF_9_FULL_ROUTE_MATRIX_PENDING",
    localStagingParity: "LOCAL_STAGING_PARITY",
    externalStaging: "NOT_VERIFIED",
    production: "NO_GO"
  },
  source: {
    branch: git(["branch", "--show-current"]),
    head: git(["rev-parse", "HEAD"]),
    upstream: null,
    finalWorktreeStatusSha256: createHash("sha256").update(status).digest("hex").toUpperCase(),
    buildTimeWorktreeStatusSha256: provenance.repository.worktreeStatusSha256,
    mobileSourceTreeSha256: provenance.source.mobileSourceTreeHash,
    mobileBuildInputTreeSha256: provenance.source.mobileBuildInputTreeHash,
    apiSourceTreeSha256: provenance.source.apiSourceTreeHash,
    contractsSourceTreeSha256: provenance.source.contractsSourceTreeHash,
    ownershipSummary: ownership.summary,
    noStageCommitPushDeployOrPublish: true
  },
  migrations: {
    count: migrations.length,
    head: migrations.at(-1),
    fresh: "PASS",
    previousSnapshotUpgrade: "PASS",
    nMinusOneAndProductionRollback: "NOT_EXTERNALLY_VERIFIED"
  },
  tests: {
    node: "20.20.2",
    packageManager: "pnpm 10.28.1",
    releaseGate: { passed: gate.results.filter((result: { result: string }) => result.result === "PASS").length, total: gate.results.length, results: gate.results },
    catalogAdminTargeted: "10_OF_10_PASS",
    appConfigTargeted: "2_OF_2_PASS",
    search: { queries: 200, successes: 200, p95Ms: 200.94, thresholdMs: 500 },
    secrets: "PASS",
    dependencyAudit: "PASS_AT_HIGH_THRESHOLD_8_MODERATE_REMAIN"
  },
  builds: {
    api: "PASS",
    adminProduction: "PASS",
    mobileProductionExport: "PASS",
    productionContamination: "PASS",
    dockerApiImage: "sha256:e2a910e2207b3445edbf1b5d8bbab07425b4abe5e98b292a5326ed2c97ffd175"
  },
  catalog: {
    counts: catalog.counts,
    integrity: catalog.integrity,
    review: review.summary,
    publishedEndpointPolicy: "PUBLISHED_ONLY",
    selfApprovalOrAutomaticPublishPerformed: false
  },
  coverage: coverage.summary,
  personaEvaluation: persona.summary,
  routes: {
    summary: routes.summary,
    layoutMatrix: routes.layoutMatrix,
    installedSmoke: ["fresh_install", "test_login", "onboarding", "home", "preparation", "empty_report", "process_restart"],
    fullRuntimeMatrixComplete: false
  },
  accessibility: {
    pixelScreens: pixel.screens.map((screen: { screenId: string; score: number; pass: boolean; renderValid: boolean }) => ({
      screenId: screen.screenId,
      score: screen.score,
      pass: screen.pass,
      renderValid: screen.renderValid
    })),
    touchTargetSourceChecks: "PASS_WITH_RUNTIME_FOLLOWUP",
    talkBackFullRouteMatrix: "PENDING"
  },
  reportV3: {
    code: true,
    contract: true,
    automatedTest: true,
    kstSelectorParity: true,
    giftRefundSupportSeparated: true,
    plannedActualSeparated: true,
    sparseForecastSuppressed: true,
    installedRuntime: "EMPTY_STATE_ONLY"
  },
  localStaging: {
    classification: "LOCAL_STAGING_PARITY",
    topology: { postgres: 1, redis: 1, minio: 1, api: 2, worker: 2, publisher: 1, admin: 1 },
    remoteConfig: { replicaPorts: [53100, 53101], source: "database", configVersion: 1, result: "PASS" },
    mockOAuthReplay: "PASS",
    distributedRateLimit: "PASS",
    duplicateDeliveryDlq: "PASS",
    workerRestart: "PASS",
    scheduledPublishRace: "PASS"
  },
  restoreDrill: {
    result: "PASS_LOCAL_NEW_DATABASE",
    backup: evidence("artifacts/db-backups/release4c-local-staging-31-migrations.sql"),
    expectedSha256: "5B25EDE91379ABB849A361821F76B34C1EADD92316A2144455E93ACE9412BEA6",
    verified: { expenseTotal: 123456, planBudget: 150000, publishedItems: 1, approvals: 2, outboxRows: 2, migrations: 31 }
  },
  android: {
    standalone: {
      classification: "INTERNAL_STANDALONE_NOT_PRODUCTION",
      apk: provenance.apk,
      installedDevice: { model: pixel.device.model, androidVersion: pixel.device.androidVersion, freshInstall: true, clearData: true, testLogin: true, processRestart: true },
      installedEvidence: [
        evidence("artifacts/android/release4c-installed/cold-start.png"),
        evidence("artifacts/android/release4c-installed/home.png"),
        evidence("artifacts/android/release4c-installed/preparation.png"),
        evidence("artifacts/android/release4c-installed/report-v3.png"),
        evidence("artifacts/android/release4c-installed/process-restart-15s.png")
      ]
    },
    pixel: {
      classification: "INTERNAL_PIXEL_EVIDENCE_APK",
      apkSha256: pixelApk.apkSha256.toUpperCase(),
      buildReport: evidence("artifacts/pixel-lock/android/reports/pixel-apk.json"),
      resultReport: evidence("artifacts/pixel-lock/android/reports/latest.json"),
      status: pixel.status,
      validScreens: pixel.screens.filter((screen: { renderValid: boolean }) => screen.renderValid).length,
      passedScreens: pixel.screens.filter((screen: { pass: boolean }) => screen.pass).length
    }
  },
  findings: findings.summary,
  knownBlockers: [
    "408 editorial approvals absent",
    "84 high-risk external safety/domain approvals absent",
    "1200 coverage cells remain review_needed",
    "approved active Product Offer count is zero",
    "complete 37-route installed state/accessibility matrix pending",
    "complete installed persona runs pending",
    "external staging and real providers not verified",
    "production signing, AAB, Play beta and closed beta not performed"
  ],
  evidence: [
    evidence("docs/qa/evidence/release4c-findings.json"),
    evidence("docs/qa/evidence/release4c-catalog-review-inventory.json"),
    evidence("docs/qa/evidence/release4c-coverage-matrix.json"),
    evidence("docs/qa/evidence/release4c-persona-evals.json"),
    evidence("apps/mobile/e2e/release4c-route-scenarios.json"),
    evidence("artifacts/dev-snapshots/release4c-file-ownership.json"),
    evidence("artifacts/android/release4c-build-provenance.json"),
    evidence("docs/qa/evidence/latest-release-gate.json")
  ]
};

writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Manifest: ${relative(root, outputPath)}`);
