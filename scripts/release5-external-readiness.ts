import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Check = { id: string; requiredForLive: boolean; present: boolean; status: "PASS" | "EXTERNAL_BLOCKED"; detail: string };

const production = process.argv.includes("--production");
const outputFlag = process.argv.indexOf("--output");
const outputPath = resolve(outputFlag >= 0 ? process.argv[outputFlag + 1] ?? "" : "docs/qa/evidence/release5f-external-staging-readiness.json");

function present(name: string) {
  return Boolean(process.env[name]?.trim());
}

function check(id: string, names: string[], detail: string): Check {
  const available = names.every(present);
  return { id, requiredForLive: true, present: available, status: available ? "PASS" : "EXTERNAL_BLOCKED", detail };
}

const checks: Check[] = [
  check("external_staging_core", ["DATABASE_URL", "REDIS_URL", "S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"], "PostgreSQL, Redis, and object storage credentials"),
  check("oauth", ["OAUTH_KAKAO_CLIENT_ID", "OAUTH_APPLE_CLIENT_ID", "OAUTH_GOOGLE_CLIENT_ID"], "Live OAuth client identifiers"),
  check("push", ["NOTIFICATION_PROVIDER_MODE", "PUSH_PROVIDER_CREDENTIAL"], "Live push provider mode and credential"),
  check("recall", ["RECALL_PROVIDER_MODE", "RECALL_PROVIDER_WEBHOOK_SECRET"], "Live recall mode and webhook signature secret"),
  check("merchant", ["MERCHANT_FEED_MODE", "MERCHANT_FEED_CREDENTIAL"], "Live merchant feed mode and credential"),
  check("signing", ["ANDROID_SIGNING_KEYSTORE_PATH", "ANDROID_SIGNING_KEY_ALIAS", "ANDROID_SIGNING_STORE_PASSWORD_ENV", "ANDROID_SIGNING_KEY_PASSWORD_ENV"], "Production Android signing configuration")
];

const liveReady = checks.every((entry) => entry.present);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  actor: "release_engineer",
  input: { profile: production ? "production" : "local", credentialValuesIncluded: false },
  mission: "Validate external staging prerequisites without exposing secret values.",
  status: liveReady ? "PASS" : "EXTERNAL_BLOCKED",
  failClosed: true,
  diagnosticsExposeSecrets: false,
  featureRequirements: {
    external_recall_provider: "DB-backed flag plus live mode and webhook secret",
    merchant_offer_comparison: "DB-backed flag plus live mode and merchant credential"
  },
  checks,
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
if (production && !liveReady) process.exitCode = 1;
