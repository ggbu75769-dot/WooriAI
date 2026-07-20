import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const snapshotRoot = join(root, "artifacts/dev-snapshots");
const startStatusPath = join(snapshotRoot, "release4e-start-status.json");
const startPatchPath = join(snapshotRoot, "release4e-start-tracked.patch");
const startUntrackedPath = join(snapshotRoot, "release4e-start-untracked-hashes.json");
const outputPath = join(snapshotRoot, "release4e-file-ownership.json");
const generatedByRelease4e = new Set([
  "scripts/generate-release4e-ownership.ts",
  "artifacts/dev-snapshots/release4e-start-status.json",
  "artifacts/dev-snapshots/release4e-start-tracked.patch",
  "artifacts/dev-snapshots/release4e-start-untracked-hashes.json",
  "artifacts/dev-snapshots/release4e-file-ownership.json"
]);

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

function statusShort() {
  return git(["-c", "core.quotePath=false", "status", "--short", "-uall"])
    .split(/\r?\n/)
    .filter(Boolean);
}

function parsePatch(value: string) {
  const sections = new Map<string, string>();
  const matches = [...value.matchAll(/^diff --git a\/(.+?) b\/(.+?)\r?$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? value.length;
    sections.set(match[2], value.slice(start, end).replaceAll("\r\n", "\n").trimEnd());
  }
  return sections;
}

function sensitivePath(path: string) {
  return /(^|[/\\])(?:\.env(?:\.|$)|.*(?:secret|credential|keystore|keychain|private[-_.]?key).*)/i.test(path);
}

function capture() {
  mkdirSync(snapshotRoot, { recursive: true });
  const lines = statusShort();
  const untrackedFiles = lines
    .filter((line) => line.startsWith("?? "))
    .map(statusPath)
    .filter((path) => !generatedByRelease4e.has(path))
    .flatMap((path) => {
      const absolute = join(root, path);
      if (!existsSync(absolute) || !statSync(absolute).isFile()) return [];
      return [{
        path,
        sizeBytes: statSync(absolute).size,
        sha256: sha256(absolute),
        sensitive: sensitivePath(path)
      }];
    });
  const upstreamResult = spawnSync("git", ["rev-parse", "--abbrev-ref", "@{upstream}"], {
    cwd: root,
    encoding: "utf8"
  });
  const startStatus = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    branch: git(["branch", "--show-current"]).trim(),
    head: git(["rev-parse", "HEAD"]).trim(),
    upstream: upstreamResult.status === 0 ? String(upstreamResult.stdout).trim() : null,
    node: process.version,
    packageManager: process.env.npm_config_user_agent ?? null,
    statusShort: lines,
    statusPorcelainV2: git(["-c", "core.quotePath=false", "status", "--porcelain=v2", "-uall"])
      .split(/\r?\n/)
      .filter(Boolean),
    diffStat: git(["diff", "--stat"]).trimEnd(),
    diffCheck: git(["diff", "--check"]).trimEnd(),
    stagedPaths: git(["diff", "--cached", "--name-only"]).split(/\r?\n/).filter(Boolean)
  };
  writeFileSync(startPatchPath, git(["-c", "core.quotePath=false", "diff", "--binary"]), "utf8");
  writeFileSync(startStatusPath, `${JSON.stringify(startStatus, null, 2)}\n`, "utf8");
  writeFileSync(
    startUntrackedPath,
    `${JSON.stringify({
      schemaVersion: 1,
      capturedAt: startStatus.capturedAt,
      rule: "Untracked content is not copied. Only path, byte size and SHA-256 are recorded.",
      files: untrackedFiles
    }, null, 2)}\n`,
    "utf8"
  );
  console.log(JSON.stringify({
    trackedStatusEntries: lines.filter((line) => !line.startsWith("?? ")).length,
    untrackedFiles: untrackedFiles.length,
    staged: startStatus.stagedPaths.length,
    sensitivePaths: untrackedFiles.filter((file) => file.sensitive).length
  }));
}

function finalize() {
  const startStatus = JSON.parse(readFileSync(startStatusPath, "utf8")) as {
    statusShort: string[];
  };
  const startUntracked = JSON.parse(readFileSync(startUntrackedPath, "utf8")) as {
    files: Array<{ path: string; sizeBytes: number; sha256: string; sensitive: boolean }>;
  };
  const currentLines = statusShort();
  const currentStatusByPath = new Map(currentLines.map((line) => [statusPath(line), line.slice(0, 2)] as const));
  const startTracked = new Set(
    startStatus.statusShort
      .filter((line) => !line.startsWith("?? "))
      .map(statusPath)
      .filter((path) => !generatedByRelease4e.has(path))
  );
  const startUntrackedByPath = new Map(startUntracked.files.map((file) => [file.path, file]));
  const repositoryTracked = new Set(
    git(["-c", "core.quotePath=false", "ls-files", "-z"])
      .split("\0")
      .filter(Boolean)
  );
  const startPatch = parsePatch(readFileSync(startPatchPath, "utf8"));
  const currentPatch = parsePatch(git(["-c", "core.quotePath=false", "diff", "--binary"]));
  const paths = [...new Set([
    ...startTracked,
    ...startUntrackedByPath.keys(),
    ...currentStatusByPath.keys(),
    ...generatedByRelease4e
  ])].sort();
  const files = paths.map((path) => {
    const absolute = join(root, path);
    const exists = existsSync(absolute) && statSync(absolute).isFile();
    const startOwnership = generatedByRelease4e.has(path)
      ? "release4e_created"
      : startTracked.has(path)
        ? "pre_existing_release4e_tracked"
        : startUntrackedByPath.has(path)
          ? "pre_existing_release4e_untracked"
          : repositoryTracked.has(path)
            ? "pre_existing_release4e_clean_tracked"
          : "release4e_created";
    const release4eTouched = startOwnership === "release4e_created"
      ? exists
      : startOwnership === "pre_existing_release4e_tracked"
        ? startPatch.get(path) !== currentPatch.get(path)
        : !exists || sha256(absolute) !== startUntrackedByPath.get(path)?.sha256;
    return {
      path,
      startOwnership,
      release4eTouched,
      overlap: startOwnership.startsWith("pre_existing_release4e") && release4eTouched,
      cleanOwned: startOwnership === "release4e_created" && exists,
      currentStatus: currentStatusByPath.get(path) ?? "clean_or_ignored",
      exists,
      sizeBytes: exists ? statSync(absolute).size : null,
      sha256: exists ? sha256(absolute) : null,
      sensitiveContentCopied: false
    };
  });
  const summary = {
    totalPaths: files.length,
    preExistingAtStart: files.filter((file) => file.startOwnership.startsWith("pre_existing_release4e")).length,
    release4eTouched: files.filter((file) => file.release4eTouched).length,
    overlap: files.filter((file) => file.overlap).length,
    cleanOwned: files.filter((file) => file.cleanOwned).length,
    deleted: files.filter((file) => !file.exists).length
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    method: "Release 4E compares the final working tree with the captured Release 4E start patch and untracked hashes.",
    policy: { preservePreExisting: true, autoStage: false, autoCommit: false, sensitiveContentCopied: false },
    summary,
    files
  }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary));
}

const command = process.argv[2];
if (command === "capture") capture();
else if (command === "finalize") finalize();
else throw new Error("Usage: tsx scripts/generate-release4e-ownership.ts <capture|finalize>");
