import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const root = process.cwd();
const output = resolve(root, process.env.RELEASE5_SOURCE_SNAPSHOT_OUTPUT ?? "docs/qa/evidence/release5-source-snapshot.json");
const roots = [
  "apps/admin",
  "apps/api/src",
  "apps/api/prisma",
  "apps/api/package.json",
  "apps/mobile",
  "infra/docker",
  "packages",
  "scripts",
  "app.config.js",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  "tsconfig.base.json",
  "tsconfig.scripts.json"
];

type Entry = { path: string; bytes: number; sha256: string };

function normalize(value: string) {
  return value.split(sep).join("/");
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function git(args: string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${String(result.stderr ?? "")}`);
  return String(result.stdout ?? "").trim();
}

function excluded(path: string) {
  return /(?:^|\/)(?:node_modules|dist|build|\.gradle|\.cxx|\.expo|coverage|artifacts|screenshots|diffs|heatmaps|logs|reports)(?:\/|$)/.test(path)
    || /(?:^|\/)index\.android\.bundle$/.test(path)
    || /\.(?:apk|aab|db|sqlite|keystore|jks|p12|pem|key|log|trace)$/i.test(path)
    || /(?:^|\/)local\.properties$/.test(path);
}

function entries(): Entry[] {
  const result = spawnSync("git", ["ls-files", "-z", "-co", "--exclude-standard", "--", ...roots], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ls-files failed: ${String(result.stderr ?? "")}`);
  return [...new Set(String(result.stdout).split("\0").filter(Boolean).map(normalize))]
    .filter((path) => !excluded(path))
    .filter((path) => existsSync(resolve(root, path)) && statSync(resolve(root, path)).isFile())
    .sort()
    .map((path) => {
      const bytes = readFileSync(resolve(root, path));
      return { path, bytes: bytes.length, sha256: sha256(bytes) };
    });
}

function current() {
  const files = entries();
  const ownership = resolve(root, "docs/qa/evidence/release4h-file-ownership.json");
  return {
    schemaVersion: 1,
    release: process.env.RELEASE_SOURCE_LABEL ?? "5",
    generatedAt: new Date().toISOString(),
    branch: git(["branch", "--show-current"]),
    head: git(["rev-parse", "HEAD"]),
    dirty: Boolean(git(["status", "--short", "-uall"])),
    buildProfile: process.env.RELEASE_SOURCE_BUILD_PROFILE ?? "internal-standalone",
    fileCount: files.length,
    sourceSnapshotSha256: sha256(files.map((file) => `${file.path}\0${file.bytes}\0${file.sha256}`).join("\n")),
    ownershipManifestSha256: existsSync(ownership) ? sha256(readFileSync(ownership)) : null,
    lockfileSha256: sha256(readFileSync(resolve(root, "pnpm-lock.yaml"))),
    exclusions: ["dependencies", "build caches", "artifacts", "screenshots", "traces", "databases", "evidence outputs"],
    files
  };
}

const snapshot = current();
if (process.argv.includes("--verify")) {
  if (!existsSync(output)) throw new Error(`SOURCE_SNAPSHOT_NOT_FOUND ${normalize(relative(root, output))}`);
  const expected = JSON.parse(readFileSync(output, "utf8")) as { sourceSnapshotSha256: string };
  if (expected.sourceSnapshotSha256 !== snapshot.sourceSnapshotSha256) throw new Error(`SOURCE_SNAPSHOT_STALE expected=${expected.sourceSnapshotSha256} current=${snapshot.sourceSnapshotSha256}`);
  console.log(`[release5 snapshot] PASS ${snapshot.sourceSnapshotSha256} (${snapshot.fileCount} files)`);
} else {
  writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`[release5 snapshot] ${snapshot.sourceSnapshotSha256} (${snapshot.fileCount} files)`);
}
