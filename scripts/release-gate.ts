import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type GateCommand = {
  id: string;
  label: string;
  display: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
};

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
    display: "pnpm test",
    command: "pnpm",
    args: ["test"]
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

function runGateCommand(gateCommand: GateCommand) {
  const startedAt = Date.now();
  const packageManagerCliPath = process.env.npm_execpath;
  const executable = packageManagerCliPath ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const args = packageManagerCliPath ? [packageManagerCliPath, ...gateCommand.args] : gateCommand.args;
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...gateCommand.env }
  });
  const durationMs = Date.now() - startedAt;
  return {
    ...gateCommand,
    durationMs,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}${result.error ? String(result.error) : ""}`
  };
}

function windowsQuote(value: string) {
  return /^[A-Za-z0-9_/:.=+-]+$/.test(value) ? value : `"${value.replaceAll('"', '\\"')}"`;
}

function markdownFor(results: ReturnType<typeof runGateCommand>[], dryRun: boolean) {
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
    const status = dryRun ? "NOT RUN" : result.status === 0 ? "PASS" : "FAIL";
    lines.push(`| ${result.label} | \`${result.display}\` | ${status} | ${result.durationMs}ms |`);
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- DB migration deploy/seed needs a running PostgreSQL instance; local Docker is unavailable in this workspace.",
    "- Local Android debug APK install and native screenshots are captured in `docs/ui-pixel-lock/native-screenshots/manifest.json`.",
    "- Mobile iOS/Android internal builds require Expo/EAS credentials and device install evidence from the release owner.",
    "- Store listing, production secret scan, monitoring dashboard, and post-release metrics are release-owner evidence items."
  );

  return `${lines.join("\n")}\n`;
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const results = dryRun
    ? gateCommands.map((gateCommand) => ({ ...gateCommand, durationMs: 0, status: 0, stdout: "", stderr: "" }))
    : gateCommands.map((gateCommand) => {
        console.log(`[release:gate] ${gateCommand.display}`);
        const result = runGateCommand(gateCommand);
        process.stdout.write(result.stdout);
        process.stderr.write(result.stderr);
        return result;
      });

  const absoluteEvidencePath = join(process.cwd(), evidencePath);
  mkdirSync(dirname(absoluteEvidencePath), { recursive: true });
  writeFileSync(absoluteEvidencePath, markdownFor(results, dryRun));

  const failed = results.filter((result) => result.status !== 0);
  if (failed.length > 0) {
    console.error(`[release:gate] failed: ${failed.map((result) => result.id).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[release:gate] evidence written to ${evidencePath}`);
}

main();
