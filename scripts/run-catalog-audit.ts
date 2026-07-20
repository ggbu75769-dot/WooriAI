import { execSync } from "node:child_process";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..");
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev";
const auditOutput = process.env.CATALOG_AUDIT_OUTPUT ?? "docs/qa/evidence/release4-catalog-audit.json";

if (process.argv.length > 2) {
  throw new Error("catalog:audit does not accept command-line arguments; set DATABASE_URL to select a database.");
}

execSync(`pnpm --filter api catalog:audit -- --output ${auditOutput}`, {
  cwd: repoRoot,
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: "inherit"
});
