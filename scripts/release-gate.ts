import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { acquireReleaseGateLock, ReleaseGateAlreadyRunningError } from "./lib/release-gate-lock";
import { runGateCommand, runGatePlan, type GateCommand, type GateResult } from "./lib/release-gate-runner";

const devDatabaseUrl = "postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev";
const evidencePath = "docs/qa/evidence/latest-release-gate.md";
const gateCommands: GateCommand[] = [
  {
    id: "install",
    label: "Install",
    display: "pnpm install --frozen-lockfile",
    command: "pnpm",
    args: ["install", "--frozen-lockfile"]
  },
  {
    id: "env",
    label: "Env example",
    display: "pnpm check:env:example",
    command: "pnpm",
    args: ["check:env:example"]
  },
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
  {
    id: "db-start",
    label: "Database up",
    // Round 4: api 테스트가 실 PostgreSQL을 요구한다 (docker 또는 포터블 자동 감지).
    display: "pnpm db start",
    command: "pnpm",
    args: ["db", "start"]
  },
  {
    id: "lint",
    label: "Lint",
    display: "pnpm lint",
    command: "pnpm",
    args: ["lint"]
  },
  {
    id: "typecheck",
    label: "Typecheck",
    display: "pnpm typecheck",
    command: "pnpm",
    args: ["typecheck"]
  },
  {
    id: "test",
    label: "All tests",
    // --concurrency=1 serializes the per-package vitest runs: running all 8 packages'
    // suites in parallel exhausts Windows process/handle resources under load (emulator,
    // AV scans) and produces flaky "spawn UNKNOWN"/CSPRNG aborts unrelated to the code.
    display: "pnpm test --concurrency=1",
    command: "pnpm",
    args: ["test", "--concurrency=1"]
  },
  {
    id: "api-e2e",
    label: "API e2e",
    display: "pnpm --filter api test:e2e",
    command: "pnpm",
    args: ["--filter", "api", "test:e2e"]
  },
  {
    id: "build",
    label: "Build dry-run",
    display: "pnpm build",
    command: "pnpm",
    args: ["build"]
  },
  {
    id: "peers",
    label: "Peer dependencies",
    display: "pnpm peers check",
    command: "pnpm",
    args: ["peers", "check"]
  }
];

function markdownFor(results: GateResult[], dryRun: boolean) {
  const lines = [
    "# WooriAI Release Gate Evidence",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${dryRun ? "dry-run" : "executed"}`,
    "",
    "| Gate | Command | Result | Duration |",
    "| --- | --- | --- | --- |"
  ];

  for (const result of results) {
    const status = dryRun || result.status === null ? "NOT RUN" : result.status === 0 ? "PASS" : "FAIL";
    lines.push(`| ${result.label} | \`${result.display}\` | ${status} | ${result.durationMs}ms |`);
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- A failed prerequisite stops later gates; NOT RUN rows are not passing evidence.",
    "- Database tests require a running PostgreSQL instance; this gate does not prove production deployment.",
    "- Android device and native screenshot evidence must be verified separately against the current source.",
    "- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.",
    "- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items."
  );

  return `${lines.join("\n")}\n`;
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  let lock: ReturnType<typeof acquireReleaseGateLock> | undefined;
  try {
    if (!dryRun) lock = acquireReleaseGateLock(process.env.WOORIAI_RELEASE_GATE_LOCK_PATH);
    const results = dryRun
      ? gateCommands.map((gateCommand) => ({
          ...gateCommand,
          durationMs: 0,
          status: null,
          stdout: "",
          stderr: ""
        }))
      : runGatePlan(gateCommands, (gateCommand) => {
          console.log(`[release:gate] ${gateCommand.display}`);
          const result = runGateCommand(gateCommand);
          process.stdout.write(result.stdout);
          process.stderr.write(result.stderr);
          return result;
        });

    const outputPath = dryRun ? evidencePath.replace(/\.md$/, "-dry-run.md") : evidencePath;
    const absoluteEvidencePath = join(process.cwd(), outputPath);
    mkdirSync(dirname(absoluteEvidencePath), { recursive: true });
    writeFileSync(absoluteEvidencePath, markdownFor(results, dryRun));

    const failed = results.filter((result) => result.status !== null && result.status !== 0);
    if (failed.length > 0) {
      console.error(`[release:gate] failed: ${failed.map((result) => result.id).join(", ")}`);
      process.exitCode = 1;
      return;
    }

    console.log(`[release:gate] evidence written to ${outputPath}`);
  } catch (error) {
    if (!(error instanceof ReleaseGateAlreadyRunningError)) throw error;
    console.error(error.message);
    process.exitCode = 2;
  } finally {
    lock?.release();
  }
}

main();
