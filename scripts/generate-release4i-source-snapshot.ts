import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const outputPath = resolve(
  repoRoot,
  process.env.RELEASE4I_SOURCE_SNAPSHOT_OUTPUT ?? "docs/qa/evidence/release4i-source-snapshot.json"
);

type SnapshotEntry = { path: string; bytes: number; sha256: string };
type Snapshot = {
  schemaVersion: 1;
  release: "4I";
  generatedAt: string;
  branch: string;
  head: string;
  dirty: boolean;
  buildProfile: "standalone";
  fileCount: number;
  sourceSnapshotSha256: string;
  ownershipManifestSha256: string | null;
  lockfileSha256: string;
  files: SnapshotEntry[];
};

const roots = [
  "apps/mobile",
  "packages",
  "app.config.js",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  "tsconfig.base.json",
  "scripts/build-android-apk.ts",
  "scripts/generate-release4-provenance.ts",
  "scripts/generate-release4i-source-snapshot.ts",
  "scripts/verify-release4-contamination.ts",
  "scripts/verify-release4-production-export.ts"
];

function normalize(path: string) {
  return path.split(sep).join("/");
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function git(args: string[], allowFailure = false) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 1024 * 1024 * 32 });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(" ")} failed\n${String(result.stderr ?? "")}`);
  }
  return String(result.stdout ?? "").trim();
}

function excluded(path: string) {
  return (
    /(?:^|\/)(?:node_modules|dist|build|\.gradle|\.cxx|\.expo|coverage|artifacts)(?:\/|$)/.test(path) ||
    /(?:^|\/)index\.android\.bundle$/.test(path) ||
    /\.(?:apk|aab|keystore|jks|p12|pem|key|log|trace)$/i.test(path) ||
    /(?:^|\/)local\.properties$/.test(path)
  );
}

function sourceFiles() {
  const result = spawnSync("git", ["ls-files", "-z", "-co", "--exclude-standard", "--", ...roots], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64
  });
  if (result.status !== 0) throw new Error(`git ls-files failed\n${String(result.stderr ?? "")}`);
  return [...new Set(String(result.stdout).split("\0").filter(Boolean).map(normalize))]
    .filter((path) => !excluded(path))
    .filter((path) => existsSync(resolve(repoRoot, path)) && statSync(resolve(repoRoot, path)).isFile())
    .sort();
}

function entries(): SnapshotEntry[] {
  return sourceFiles().map((path) => {
    const bytes = readFileSync(resolve(repoRoot, path));
    return { path, bytes: bytes.length, sha256: sha256(bytes) };
  });
}

function snapshotDigest(files: SnapshotEntry[]) {
  return sha256(files.map((file) => `${file.path}\0${file.bytes}\0${file.sha256}`).join("\n"));
}

function optionalFileHash(path: string) {
  const absolute = resolve(repoRoot, path);
  return existsSync(absolute) ? sha256(readFileSync(absolute)) : null;
}

function currentSnapshot(): Snapshot {
  const files = entries();
  return {
    schemaVersion: 1,
    release: "4I",
    generatedAt: new Date().toISOString(),
    branch: git(["branch", "--show-current"]),
    head: git(["rev-parse", "HEAD"]),
    dirty: git(["status", "--short", "-uall"]).length > 0,
    buildProfile: "standalone",
    fileCount: files.length,
    sourceSnapshotSha256: snapshotDigest(files),
    ownershipManifestSha256: optionalFileHash("docs/qa/evidence/release4h-file-ownership.json"),
    lockfileSha256: sha256(readFileSync(resolve(repoRoot, "pnpm-lock.yaml"))),
    files
  };
}

function main() {
  const current = currentSnapshot();
  if (process.argv.includes("--verify")) {
    if (!existsSync(outputPath)) throw new Error(`SOURCE_SNAPSHOT_NOT_FOUND ${normalize(relative(repoRoot, outputPath))}`);
    const expected = JSON.parse(readFileSync(outputPath, "utf8")) as Snapshot;
    if (expected.sourceSnapshotSha256 !== current.sourceSnapshotSha256) {
      throw new Error(
        `SOURCE_SNAPSHOT_STALE expected=${expected.sourceSnapshotSha256} current=${current.sourceSnapshotSha256}`
      );
    }
    console.log(`Source snapshot verified: ${current.sourceSnapshotSha256} (${current.fileCount} files)`);
    return;
  }
  writeFileSync(outputPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  console.log(`Source snapshot: ${normalize(relative(repoRoot, outputPath))}`);
  console.log(`SHA-256: ${current.sourceSnapshotSha256} (${current.fileCount} files)`);
}

main();
