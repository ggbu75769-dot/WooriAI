import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { isRelease5vSnapshotPathExcluded } from "./release5v-snapshot-path";

function git(repoRoot: string, args: string[]) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function normalized(path: string) {
  return path.split(sep).join("/");
}

function filesUnder(repoRoot: string, root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(root, entry.name);
    const path = normalized(relative(repoRoot, absolute));
    if (isRelease5vSnapshotPathExcluded(path) || lstatSync(absolute).isSymbolicLink()) return [];
    return entry.isDirectory() ? filesUnder(repoRoot, absolute) : [path];
  });
}

function sha256(bytes: Buffer | string) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

export function computeRelease5vSourceSnapshot(repoRoot: string) {
  const androidRoot = resolve(repoRoot, "apps", "mobile", "android");
  const listed = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024
  });
  if (listed.status !== 0 || !Buffer.isBuffer(listed.stdout)) {
    throw new Error(`git ls-files failed: ${String(listed.stderr ?? "")}`);
  }
  const gitFiles = listed.stdout.toString("utf8").split("\0").filter(Boolean).map(normalized);
  const androidFiles = filesUnder(repoRoot, androidRoot);
  const paths = [...new Set([...gitFiles, ...androidFiles])]
    .filter((path) => !isRelease5vSnapshotPathExcluded(path) && existsSync(resolve(repoRoot, path)) && statSync(resolve(repoRoot, path)).isFile())
    .sort((left, right) => left.localeCompare(right, "en"));
  const files = paths.map((path) => {
    const bytes = readFileSync(resolve(repoRoot, path));
    return {
      path,
      bytes: bytes.length,
      sha256: sha256(bytes),
      source: path.startsWith("apps/mobile/android/") ? "native-explicit" as const : "git-worktree" as const
    };
  });
  const aggregateInput = files.map((file) => `${file.path}\0${file.sha256}\0${file.bytes}\n`).join("");
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    actor: "source auditor and Android build engineer",
    input: "tracked, clean-owned untracked, and explicitly included ignored Android native source",
    mission: "bind every build-relevant source file to a deterministic sorted SHA-256 manifest without caches or artifacts",
    status: "SOURCE_VERIFIED",
    branch: git(repoRoot, ["branch", "--show-current"]),
    head: git(repoRoot, ["rev-parse", "HEAD"]),
    dirty: git(repoRoot, ["status", "--porcelain=v1"]).length > 0,
    fileCount: files.length,
    nativeExplicitFileCount: files.filter((file) => file.source === "native-explicit").length,
    sourceSnapshotSha256: sha256(aggregateInput),
    exclusions: ["dependencies", "build outputs", "APK/AAB", "evidence", "screenshots/traces", "caches", "local.properties"],
    files
  };
}
