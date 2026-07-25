import { existsSync, readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import { spawnSync } from "node:child_process";

const result = spawnSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8" });
if (result.status !== 0) throw new Error("SECRET_SCAN_FILE_LIST_FAILED");

const excluded = new Set([
  "apps/mobile/android/app/debug.keystore",
  "scripts/scan-secrets.ts"
]);
const textExtensions = new Set([".cjs", ".css", ".env", ".gradle", ".html", ".js", ".json", ".md", ".mjs", ".mts", ".prisma", ".properties", ".sql", ".ts", ".tsx", ".yaml", ".yml"]);
const rules = [
  { id: "private-key", regex: new RegExp(`-----BEGIN (?:RSA |EC |OPENSSH )?${"PRIVATE KEY"}-----`) },
  { id: "aws-access-key", regex: /AKIA[0-9A-Z]{16}/ },
  { id: "github-token", regex: /gh[pousr]_[A-Za-z0-9_]{30,}/ },
  { id: "slack-token", regex: /xox[baprs]-[A-Za-z0-9-]{20,}/ },
  { id: "google-api-key", regex: /AIza[0-9A-Za-z_-]{35}/ }
];

const findings: Array<{ file: string; rule: string }> = [];
for (const file of result.stdout.split(/\r?\n/).filter(Boolean)) {
  const normalized = file.replace(/\\/g, "/");
  if (excluded.has(normalized) || !textExtensions.has(extname(normalized).toLowerCase())) continue;
  if (!existsSync(file)) continue;
  if (statSync(file).size > 2 * 1024 * 1024) continue;
  const content = readFileSync(file, "utf8");
  for (const rule of rules) {
    if (rule.regex.test(content)) findings.push({ file: normalized, rule: rule.id });
  }
}

if (findings.length > 0) {
  for (const finding of findings) console.error(`[secret-scan] ${finding.rule}: ${finding.file}`);
  process.exitCode = 1;
} else {
  console.log(`[secret-scan] PASS (${rules.length} high-confidence rules; secret values never printed)`);
}
