import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { validateProductionReleaseConfig, type ReleaseConfigIssue } from "@wooriai/config";

type GateCommand = {
  id: string;
  label: string;
  display: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
};

type GateResult = GateCommand & {
  durationMs: number;
  status: number;
  stdout: string;
  stderr: string;
  issues?: ReleaseConfigIssue[];
};

const devDatabaseUrl = "postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev";
const gateCommands: GateCommand[] = [
  { id: "install", label: "Install", display: "pnpm install --frozen-lockfile", command: "pnpm", args: ["install", "--frozen-lockfile"] },
  { id: "env", label: "Env example", display: "pnpm check:env:example", command: "pnpm", args: ["check:env:example"] },
  {
    id: "prisma-validate",
    label: "Prisma validate",
    display: "pnpm --filter api prisma:validate",
    command: "pnpm",
    args: ["--filter", "api", "prisma:validate"],
    env: { DATABASE_URL: devDatabaseUrl }
  },
  {
    id: "prisma-generate",
    label: "Prisma generate",
    display: "pnpm --filter api prisma:generate",
    command: "pnpm",
    args: ["--filter", "api", "prisma:generate"],
    env: { DATABASE_URL: devDatabaseUrl }
  },
  { id: "db-start", label: "Database up", display: "pnpm db start", command: "pnpm", args: ["db", "start"] },
  { id: "lint", label: "ESLint", display: "pnpm lint", command: "pnpm", args: ["lint"] },
  { id: "typecheck", label: "Typecheck", display: "pnpm typecheck", command: "pnpm", args: ["typecheck"] },
  {
    id: "test",
    label: "All tests",
    display: "pnpm test --concurrency=1 --force",
    command: "pnpm",
    args: ["test", "--concurrency=1", "--force"]
  },
  { id: "api-e2e", label: "API e2e", display: "pnpm --filter api test:e2e", command: "pnpm", args: ["--filter", "api", "test:e2e"] },
  { id: "build", label: "Production builds", display: "pnpm build --force", command: "pnpm", args: ["build", "--force"] },
  { id: "peers", label: "Peer dependencies", display: "pnpm peers check", command: "pnpm", args: ["peers", "check"] }
];

function runGateCommand(gateCommand: GateCommand): GateResult {
  const startedAt = Date.now();
  const packageManagerCliPath = process.env.npm_execpath;
  const executable = packageManagerCliPath ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const args = packageManagerCliPath ? [packageManagerCliPath, ...gateCommand.args] : gateCommand.args;
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...gateCommand.env }
  });
  return {
    ...gateCommand,
    durationMs: Date.now() - startedAt,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}${result.error ? String(result.error) : ""}`
  };
}

function latestMigrationHead() {
  return readdirSync(join(process.cwd(), "apps/api/prisma/migrations"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .at(-1) ?? "";
}

function fixtureEnvironment(migrationHead: string): Record<string, string> {
  return {
    NODE_ENV: "production",
    ENABLE_DEV_AUTH: "false",
    LEGAL_OPERATOR_NAME: "Approved Operator",
    PRIVACY_POLICY_URL: "https://legal.wooriai.test/privacy",
    TERMS_URL: "https://legal.wooriai.test/terms",
    SUPPORT_URL: "https://support.wooriai.test",
    STATUS_PAGE_URL: "https://status.wooriai.test",
    EXPO_PUBLIC_API_BASE_URL: "https://api.wooriai.test/api/v1",
    REDIS_URL: "rediss://cache.wooriai.test:6379",
    S3_ENDPOINT: "https://objects.wooriai.test",
    S3_BUCKET: "wooriai-production",
    S3_ACCESS_KEY_ID: "fixture-access-key",
    S3_SECRET_ACCESS_KEY: "fixture-secret-key",
    OAUTH_KAKAO_CLIENT_ID: "prod-client-123",
    OAUTH_KAKAO_REDIRECT_URIS: "wooriai://oauth/kakao,https://auth.wooriai.test/oauth/kakao",
    FEATURE_ANALYTICS_DEFAULT: "false",
    FEATURE_AFFILIATE_DEFAULT: "false",
    FEATURE_IMPORT_DEFAULT: "false",
    FEATURE_NOTIFICATION_DEFAULT: "false",
    ANALYTICS_OPT_IN_DEFAULT: "false",
    AFFILIATE_ALLOWED_DOMAINS: "coupang.com,naver.com",
    ANDROID_SIGNING_KEYSTORE_PATH: "C:/external/release.keystore",
    ANDROID_SIGNING_KEY_ALIAS: "release",
    ANDROID_SIGNING_STORE_PASSWORD_ENV: "SIGNING_STORE_PASSWORD",
    ANDROID_SIGNING_KEY_PASSWORD_ENV: "SIGNING_KEY_PASSWORD",
    SIGNING_STORE_PASSWORD: "fixture-only-secret",
    SIGNING_KEY_PASSWORD: "fixture-only-secret",
    RELEASE_EXPECTED_MIGRATION_HEAD: migrationHead,
    CONTRACT_GENERATION_CHECK: "passed",
    JWT_ACCESS_SECRET: "fixture-access-secret",
    JWT_REFRESH_SECRET: "fixture-refresh-secret",
    AFFILIATE_CLICK_IP_SALT: "fixture-affiliate-salt",
    ANALYTICS_ANON_SALT: "fixture-analytics-salt",
    PRIVACY_STATUS_TOKEN_SECRET: "fixture-privacy-status-secret",
    PRIVACY_HASH_SALT: "fixture-privacy-hash-salt",
    DEVICE_ID_HASH_SALT: "fixture-device-hash-salt",
    RATE_LIMIT_KEY_SALT: "fixture-rate-limit-salt",
    INTERNAL_METRICS_TOKEN: "fixture-internal-metrics-token",
    OAUTH_PROVIDER_ADAPTER: "http",
    QUEUE_ADAPTER: "redis",
    OBJECT_STORAGE_ADAPTER: "s3",
    PRIVACY_PROCESSOR_MODE: "live",
    NOTIFICATION_PROVIDER_MODE: "live"
  };
}

function runProductionConfigGate(fixture: boolean): GateResult {
  const startedAt = Date.now();
  const migrationHead = latestMigrationHead();
  const appJson = JSON.parse(readFileSync(join(process.cwd(), "apps/mobile/app.json"), "utf8")) as {
    expo: { version?: string; android?: { package?: string; versionCode?: number } };
  };
  const env = fixture ? fixtureEnvironment(migrationHead) : process.env;
  const mobile = fixture ? { version: "3.0.0", android: { package: "app.wooriai.mobile", versionCode: 30000 } } : appJson.expo;
  const issues = validateProductionReleaseConfig({ env, mobile, migrationHead });
  return {
    id: "production-config",
    label: fixture ? "Production config fixture" : "Production config",
    display: fixture ? "pnpm release:config:fixture" : "pnpm release:config",
    command: "internal",
    args: [],
    durationMs: Date.now() - startedAt,
    status: issues.length === 0 ? 0 : 1,
    stdout: issues.length === 0 ? "Production configuration contract passed.\n" : "",
    stderr: issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n"),
    issues
  };
}

function markdownFor(results: GateResult[], mode: string, dryRun: boolean) {
  const lines = [
    "# WooriAI Release Gate Evidence",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${mode}`,
    "",
    "| Gate | Command | Result | Duration |",
    "| --- | --- | --- | --- |"
  ];

  for (const result of results) {
    const status = dryRun ? "NOT RUN" : result.status === 0 ? "PASS" : "FAIL";
    lines.push(`| ${result.label} | \`${result.display}\` | ${status} | ${result.durationMs}ms |`);
  }

  const configIssues = results.flatMap((result) => result.issues ?? []);
  if (configIssues.length > 0) {
    lines.push("", "## Production configuration blockers", "");
    for (const issue of configIssues) lines.push(`- \`${issue.code}\`: ${issue.message}`);
  }

  lines.push(
    "",
    "## Evidence boundary",
    "",
    "- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.",
    "- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.",
    "- The fixture mode validates only gate logic and never certifies the repository's current placeholder values."
  );
  return `${lines.join("\n")}\n`;
}

function writeEvidence(results: GateResult[], mode: string, dryRun: boolean, baseName: string) {
  const markdownPath = baseName === "latest-release-gate"
    ? "docs/qa/evidence/latest-release-gate.md"
    : `docs/qa/evidence/${baseName}.md`;
  const jsonPath = `docs/qa/evidence/${baseName}.json`;
  mkdirSync(dirname(join(process.cwd(), markdownPath)), { recursive: true });
  writeFileSync(join(process.cwd(), markdownPath), markdownFor(results, mode, dryRun));
  writeFileSync(
    join(process.cwd(), jsonPath),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode,
        results: results.map((result) => ({
          id: result.id,
          label: result.label,
          command: result.display,
          result: dryRun ? "NOT_RUN" : result.status === 0 ? "PASS" : "FAIL",
          durationMs: result.durationMs,
          issues: result.issues ?? []
        }))
      },
      null,
      2
    )}\n`
  );
  return { markdownPath, jsonPath };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const production = args.includes("--production");
  const configOnly = args.includes("--config-only");
  const fixture = args.includes("--fixture");
  const mode = configOnly ? (fixture ? "production-config-fixture" : "production-config") : production ? "production-full" : dryRun ? "local-dry-run" : "local-executed";

  const selectedCommands = configOnly ? [] : gateCommands;
  const results: GateResult[] = [];
  if (production) results.push(runProductionConfigGate(fixture));
  for (const command of selectedCommands) {
    if (dryRun) {
      results.push({ ...command, durationMs: 0, status: 0, stdout: "", stderr: "" });
      continue;
    }
    console.log(`[release:gate] ${command.display}`);
    const result = runGateCommand(command);
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    results.push(result);
  }

  const baseName = configOnly
    ? fixture
      ? "release3-production-config-fixture"
      : "release3-production-config-gate"
    : "latest-release-gate";
  const evidence = writeEvidence(results, mode, dryRun, baseName);
  const failed = results.filter((result) => result.status !== 0);
  if (failed.length > 0) {
    console.error(`[release:gate] failed: ${failed.map((result) => result.id).join(", ")}`);
    console.error(`[release:gate] evidence: ${evidence.markdownPath}, ${evidence.jsonPath}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[release:gate] evidence: ${evidence.markdownPath}, ${evidence.jsonPath}`);
}

main();
