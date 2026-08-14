import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateExternalReadiness } from "./lib/release5-external-readiness";

const production = process.argv.includes("--production");
const outputFlag = process.argv.indexOf("--output");
const outputPath = resolve(outputFlag >= 0 ? process.argv[outputFlag + 1] ?? "" : "docs/qa/evidence/release5f-external-staging-readiness.json");

const app = JSON.parse(readFileSync(resolve("apps/mobile/app.json"), "utf8")) as {
  expo: { version: string; android: { package: string; versionCode: number } };
};
const evaluation = evaluateExternalReadiness({
  env: process.env,
  identity: {
    packageName: app.expo.android.package,
    version: app.expo.version,
    versionCode: app.expo.android.versionCode
  },
  pathExists: existsSync
});
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  actor: "release_engineer",
  input: { profile: production ? "production" : "local", credentialValuesIncluded: false },
  mission: "Validate external staging prerequisites without exposing secret values.",
  status: evaluation.status,
  failClosed: true,
  diagnosticsExposeSecrets: false,
  featureRequirements: {
    external_recall_provider: "DB-backed flag plus live mode and webhook secret",
    merchant_offer_comparison: "DB-backed flag plus live mode and merchant credential"
  },
  identity: {
    packageName: app.expo.android.package,
    version: app.expo.version,
    versionCode: app.expo.android.versionCode
  },
  checks: evaluation.checks,
  runbook: [
    "Provision separate staging credentials and approved endpoints.",
    "Run the production config validator before activating either DB-backed feature flag.",
    "Verify OAuth, push, recall, object storage, and merchant adapter health without logging secrets.",
    "Run the smoke manifest and restore drill; roll back by publishing a new Remote Config version."
  ]
};

mkdirSync(resolve(outputPath, ".."), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`[release5 external readiness] ${report.status}; evidence=${outputPath}`);
if (production && evaluation.status !== "PASS") process.exitCode = 1;
