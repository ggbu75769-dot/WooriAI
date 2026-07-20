import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const baselinePath = join(root, "artifacts/dev-snapshots/release4e-file-ownership.json");
const outputPath = join(root, "artifacts/dev-snapshots/release4f-file-ownership.json");

function git(args: string[]) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout));
  return String(result.stdout);
}

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();
}

function statusPath(line: string) {
  const value = line.slice(3).trim();
  return value.includes(" -> ") ? value.split(" -> ").at(-1)! : value;
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as {
  files: Array<{ path: string; exists: boolean; sha256: string | null }>;
};
const baselineByPath = new Map(baseline.files.map((file) => [file.path, file]));
const statusLines = git(["-c", "core.quotePath=false", "status", "--short", "-uall"])
  .split(/\r?\n/)
  .filter(Boolean);
const statusByPath = new Map(statusLines.map((line) => [statusPath(line), line.slice(0, 2)]));
const paths = [...new Set([
  ...baselineByPath.keys(),
  ...statusByPath.keys(),
  "scripts/generate-release4f-ownership.ts"
])].sort();

const files = paths.map((path) => {
  const absolute = join(root, path);
  const exists = existsSync(absolute) && statSync(absolute).isFile();
  const currentHash = exists ? sha256(absolute) : null;
  const before = baselineByPath.get(path);
  const startOwnership = before ? "pre_existing_release4f" : "release4f_created";
  const release4fTouched = before
    ? before.exists !== exists || before.sha256 !== currentHash
    : exists;
  return {
    path,
    startOwnership,
    release4fTouched,
    overlap: startOwnership === "pre_existing_release4f" && release4fTouched,
    cleanOwned: startOwnership === "release4f_created" && exists,
    existedAtRelease4fStart: Boolean(before?.exists),
    exists,
    startSha256: before?.sha256 ?? null,
    sha256: currentHash,
    currentStatus: statusByPath.get(path) ?? "clean_or_ignored"
  };
});

const summary = {
  baseline: "Release 4E final ownership hashes",
  totalPaths: files.length,
  release4fTouched: files.filter((file) => file.release4fTouched).length,
  overlap: files.filter((file) => file.overlap).length,
  cleanOwned: files.filter((file) => file.cleanOwned).length,
  deletedPreExisting: files.filter(
    (file) => file.startOwnership === "pre_existing_release4f" && file.existedAtRelease4fStart && !file.exists
  ).length
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  method: "Release 4F compares the current tree with the SHA-256 values captured in the Release 4E final ownership manifest.",
  policy: {
    preservePreExisting: true,
    autoStage: false,
    autoCommit: false,
    destructiveGit: false
  },
  summary,
  files
}, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary));
