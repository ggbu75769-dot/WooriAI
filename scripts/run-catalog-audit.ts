import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..");
const pgBin = process.env.PGBIN ?? resolve(repoRoot, ".toolcache/pg16/pgsql/bin");
const databaseName = "wooriai_catalog_audit_verify";
const databaseUser = "wooriai";
const databasePassword = "wooriai_dev_password";
const databaseHost = "localhost";
const databasePort = "5432";
const auditOutput = process.env.CATALOG_AUDIT_OUTPUT ?? "docs/qa/evidence/release4-catalog-audit.json";

if (process.argv.length > 2) {
  throw new Error("catalog:audit does not accept command-line arguments; set DATABASE_URL to select a database.");
}

function executable(name: string) {
  const suffix = process.platform === "win32" ? ".exe" : "";
  const bundled = resolve(pgBin, `${name}${suffix}`);
  return existsSync(bundled) ? bundled : name;
}

function runPnpm(args: string[], env: NodeJS.ProcessEnv) {
  const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "pnpm";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", "pnpm", ...args] : args;
  execFileSync(command, commandArgs, {
    cwd: repoRoot,
    env,
    stdio: "inherit"
  });
}

function audit(databaseUrl: string) {
  runPnpm(
    ["--filter", "api", "catalog:audit", "--", "--output", auditOutput],
    { ...process.env, DATABASE_URL: databaseUrl }
  );
}

function isolatedDatabaseUrl() {
  return `postgresql://${databaseUser}:${databasePassword}@${databaseHost}:${databasePort}/${databaseName}`;
}

function pgAdmin(command: "createdb" | "dropdb") {
  const args = ["-U", databaseUser, "-h", databaseHost, "-p", databasePort];
  if (command === "dropdb") args.push("--if-exists", "--force");
  args.push(databaseName);
  execFileSync(executable(command), args, {
    env: { ...process.env, PGPASSWORD: databasePassword },
    stdio: "inherit"
  });
}

const explicitDatabaseUrl = process.env.DATABASE_URL?.trim();
if (explicitDatabaseUrl) {
  audit(explicitDatabaseUrl);
} else {
  runPnpm(["db", "start"], process.env);
  pgAdmin("dropdb");
  pgAdmin("createdb");
  const databaseUrl = isolatedDatabaseUrl();
  const isolatedEnv = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "test" };
  try {
    runPnpm(["--filter", "api", "prisma:generate"], isolatedEnv);
    runPnpm(["--filter", "api", "prisma:deploy"], isolatedEnv);
    runPnpm(["--filter", "api", "seed"], isolatedEnv);
    audit(databaseUrl);
  } finally {
    pgAdmin("dropdb");
  }
}
