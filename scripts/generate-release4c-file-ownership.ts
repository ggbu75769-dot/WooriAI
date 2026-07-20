import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const startStatusPath = join(root, "artifacts/dev-snapshots/release4c-start-status.json");
const startPatchPath = join(root, "artifacts/dev-snapshots/release4c-start-tracked.patch");
const startUntrackedPath = join(root, "artifacts/dev-snapshots/release4c-start-untracked-hashes.json");
const outputPath = join(root, "artifacts/dev-snapshots/release4c-file-ownership.json");
const generatedAfterOwnership = new Set(["docs/qa/evidence/release4c-manifest.json"]);

function git(args: string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(String(result.stderr));
  return String(result.stdout);
}

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();
}

function parsePatch(value: string) {
  const sections = new Map<string, string>();
  const matches = [...value.matchAll(/^diff --git a\/(.+?) b\/(.+?)\r?$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const path = match[2];
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? value.length;
    sections.set(path, value.slice(start, end).replaceAll("\r\n", "\n").trimEnd());
  }
  return sections;
}

function statusPaths(lines: string[]) {
  return lines
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .map((path) => (path.includes(" -> ") ? path.split(" -> ").at(-1)! : path));
}

const startStatus = JSON.parse(readFileSync(startStatusPath, "utf8")) as { statusShort: string[] };
const startUntracked = JSON.parse(readFileSync(startUntrackedPath, "utf8")) as {
  files: Array<{ path: string; sizeBytes: number; sha256: string; sensitive: boolean }>;
};
const currentStatusLines = git(["-c", "core.quotePath=false", "status", "--short", "-uall"])
  .split(/\r?\n/)
  .filter(Boolean);
const currentStatusByPath = new Map(
  currentStatusLines.map((line) => {
    const path = statusPaths([line])[0];
    return [path, line.slice(0, 2)] as const;
  })
);

const startTracked = new Set(statusPaths(startStatus.statusShort.filter((line) => !line.startsWith("??"))));
const startUntrackedByPath = new Map(startUntracked.files.map((file) => [file.path, file]));
const startPatch = parsePatch(readFileSync(startPatchPath, "utf8"));
const currentPatch = parsePatch(git(["-c", "core.quotePath=false", "diff", "--binary"]));
const paths = [...new Set([...startTracked, ...startUntrackedByPath.keys(), ...currentStatusByPath.keys()])].sort();

const files = paths.map((path) => {
  const absolute = join(root, path);
  const exists = existsSync(absolute) && statSync(absolute).isFile();
  const startOwnership = startTracked.has(path)
    ? "pre_existing_user_tracked"
    : startUntrackedByPath.has(path)
      ? "pre_existing_user_untracked"
      : "release4c_created";
  const release4cTouched =
    startOwnership === "release4c_created"
      ? true
      : startOwnership === "pre_existing_user_tracked"
        ? startPatch.get(path) !== currentPatch.get(path)
        : !exists || sha256(absolute) !== startUntrackedByPath.get(path)?.sha256;
  return {
    path,
    startOwnership,
    release4cTouched,
    overlap: startOwnership.startsWith("pre_existing_user") && release4cTouched,
    cleanOwned: startOwnership === "release4c_created",
    currentStatus: currentStatusByPath.get(path) ?? "clean_or_ignored",
    exists,
    sizeBytes: exists ? statSync(absolute).size : null,
    sha256: exists && !generatedAfterOwnership.has(path) ? sha256(absolute) : null,
    digestNote: generatedAfterOwnership.has(path)
      ? "Generated after the ownership inventory to avoid a self-referential digest cycle."
      : null,
    sensitiveContentCopied: false
  };
});

const summary = {
  totalPaths: files.length,
  preExistingUser: files.filter((file) => file.startOwnership.startsWith("pre_existing_user")).length,
  release4cTouched: files.filter((file) => file.release4cTouched).length,
  overlap: files.filter((file) => file.overlap).length,
  cleanOwned: files.filter((file) => file.cleanOwned).length,
  deleted: files.filter((file) => !file.exists).length
};

writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      method: "Tracked ownership compares the full current per-file git diff with the Phase 0 binary patch; untracked ownership compares current SHA-256 with the Phase 0 hash inventory.",
      policy: { preservePreExisting: true, autoStage: false, autoCommit: false, sensitiveContentCopied: false },
      summary,
      files
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(JSON.stringify(summary));
