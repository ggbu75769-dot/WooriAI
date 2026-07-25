import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const apkPath = resolve(
  repoRoot,
  process.env.RELEASE4_APK_PATH ?? "wooriai-0.0.0-release-standalone.apk"
);
const buildReportPath = apkPath.replace(/\.apk$/i, ".json");
const outputPath = resolve(
  repoRoot,
  process.env.RELEASE4_PROVENANCE_OUTPUT ?? "artifacts/android/release4-build-provenance.json"
);
const preflightPath = resolve(
  repoRoot,
  process.env.RELEASE4_PROVENANCE_PREFLIGHT ?? "docs/qa/evidence/release4-provenance-preflight.md"
);
const reportedPriorApkSha256 =
  process.env.RELEASE4_BASELINE_APK_SHA256 ??
  "BE56B676B9E643D2F73494E9F223B02E0D6B208A1F6F61C1D5AE265C40EF324C";
const generatedByPath = "scripts/generate-release4-provenance.ts";

type BuildReport = {
  generatedAt?: string;
  profile?: string;
  signing?: string;
  task?: string;
  env?: Record<string, string>;
};

type FileDigest = { path: string; bytes: number; sha256: string };

function normalizePath(path: string) {
  return path.split(sep).join("/");
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function run(command: string, args: string[], options: { binary?: boolean; allowFailure?: boolean } = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: options.binary ? null : "utf8",
    shell: process.platform === "win32" && /\.bat$/i.test(command),
    maxBuffer: 1024 * 1024 * 128
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed\n${String(result.stderr ?? "")}`);
  }
  return result;
}

function gitText(args: string[]) {
  const result = run("git", args);
  return String(result.stdout).trim();
}

function gitFiles(paths: string[], includeUntracked: boolean) {
  const args = includeUntracked
    ? ["ls-files", "-z", "-co", "--exclude-standard", "--", ...paths]
    : ["ls-files", "-z", "--", ...paths];
  return String(run("git", args).stdout)
    .split("\0")
    .filter(Boolean)
    .map((path) => normalizePath(path))
    .filter((path) => existsSync(join(repoRoot, path)) && statSync(join(repoRoot, path)).isFile())
    .sort();
}

function hashFiles(paths: string[]) {
  const digest = createHash("sha256");
  for (const path of [...new Set(paths)].sort()) {
    const bytes = readFileSync(join(repoRoot, path));
    digest.update(path);
    digest.update("\0");
    digest.update(String(bytes.length));
    digest.update("\0");
    digest.update(sha256(bytes));
    digest.update("\n");
  }
  return digest.digest("hex").toUpperCase();
}

function walkFiles(root: string, shouldExclude: (relativePath: string) => boolean) {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      const relativePath = normalizePath(relative(repoRoot, absolutePath));
      if (shouldExclude(relativePath)) continue;
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile()) files.push(relativePath);
    }
  };
  visit(root);
  return files.sort();
}

function findLatestBuildToolsFile(fileName: string) {
  const sdkRoot =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
  const buildToolsRoot = join(sdkRoot, "build-tools");
  if (!existsSync(buildToolsRoot)) return null;
  const versions = readdirSync(buildToolsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
  for (const version of versions) {
    const candidate = join(buildToolsRoot, version, fileName);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function inspectApkAssets() {
  const listResult = run("tar", ["-tf", apkPath]);
  const assetPaths = String(listResult.stdout)
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("assets/") && !entry.endsWith("/"))
    .sort();
  const assets: FileDigest[] = assetPaths.map((path) => {
    const extractResult = run("tar", ["-xOf", apkPath, path], { binary: true });
    const bytes = Buffer.isBuffer(extractResult.stdout)
      ? extractResult.stdout
      : Buffer.from(extractResult.stdout ?? "");
    return { path, bytes: bytes.length, sha256: sha256(bytes) };
  });
  const manifest = assets.map((asset) => `${asset.path}\0${asset.bytes}\0${asset.sha256}`).join("\n");
  return {
    assets,
    assetManifestHash: sha256(manifest),
    embeddedBundle: assets.find((asset) => asset.path === "assets/index.android.bundle") ?? null
  };
}

function parseBadging(output: string) {
  const packageMatch = output.match(/package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/);
  const sdkMatch = output.match(/minSdkVersion:'([^']+)'/);
  const targetSdkMatch = output.match(/targetSdkVersion:'([^']+)'/);
  const nativeCodeMatch = output.match(/native-code:\s*(.+)/);
  return {
    packageName: packageMatch?.[1] ?? null,
    versionCode: packageMatch?.[2] ?? null,
    versionName: packageMatch?.[3] ?? null,
    minSdk: sdkMatch?.[1] ?? null,
    targetSdk: targetSdkMatch?.[1] ?? null,
    nativeAbis: nativeCodeMatch ? [...nativeCodeMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]) : []
  };
}

function manifestBoolean(xmlTree: string, name: string) {
  const match = new RegExp(`android:${name}[^=]*=(true|false|0x[01])`, "i").exec(xmlTree);
  if (!match) return null;
  return match[1].toLowerCase() === "true" || match[1] === "0x1";
}

function parseManifestDetails(xmlTree: string) {
  const permissions = [...xmlTree.matchAll(/E: uses-permission[^\n]*\r?\n\s+A:[^\n]*:name[^=]*="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
  const dangerousPermissions = permissions.filter((permission) =>
    /(?:READ_|WRITE_|CAMERA|RECORD_AUDIO|ACCESS_FINE_LOCATION|ACCESS_COARSE_LOCATION|READ_CONTACTS|POST_NOTIFICATIONS)/.test(permission)
  );

  const components: Array<{
    type: "activity" | "service" | "receiver" | "provider";
    name: string | null;
    exported: boolean | null;
    permission: string | null;
    deepLinks: Array<{ scheme: string | null; host: string | null; path: string | null }>;
  }> = [];
  let current: (typeof components)[number] | null = null;
  let componentIndent = -1;
  let currentData: (typeof components)[number]["deepLinks"][number] | null = null;
  let dataIndent = -1;

  for (const line of xmlTree.split(/\r?\n/)) {
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const element = /E: (activity|service|receiver|provider|data)\b/.exec(line)?.[1];
    if (current && element && element !== "data" && indent <= componentIndent) {
      components.push(current);
      current = null;
      currentData = null;
    }
    if (element && element !== "data") {
      current = { type: element as (typeof components)[number]["type"], name: null, exported: null, permission: null, deepLinks: [] };
      componentIndent = indent;
      continue;
    }
    if (!current) continue;
    if (element === "data") {
      currentData = { scheme: null, host: null, path: null };
      current.deepLinks.push(currentData);
      dataIndent = indent;
      continue;
    }
    if (currentData && /^\s*E:/.test(line) && indent <= dataIndent) currentData = null;
    const rawValue = /\(Raw: "([^"]*)"\)/.exec(line)?.[1];
    if (/android:name\b/.test(line) && indent > componentIndent && current.name === null) current.name = rawValue ?? null;
    if (/android:exported\b/.test(line)) current.exported = /=true\b/.test(line) || /=0x1\b/.test(line);
    if (/android:permission\b/.test(line)) current.permission = rawValue ?? null;
    if (currentData && /android:scheme\b/.test(line)) currentData.scheme = rawValue ?? null;
    if (currentData && /android:host\b/.test(line)) currentData.host = rawValue ?? null;
    if (currentData && /android:(?:path|pathPrefix|pathPattern|pathAdvancedPattern)\b/.test(line)) currentData.path = rawValue ?? null;
  }
  if (current) components.push(current);

  return {
    allowBackup: manifestBoolean(xmlTree, "allowBackup"),
    usesCleartextTraffic: manifestBoolean(xmlTree, "usesCleartextTraffic"),
    permissions,
    dangerousPermissions,
    exportedComponents: components.filter((component) => component.exported === true),
    deepLinks: components.flatMap((component) =>
      component.deepLinks
        .filter((link) => link.scheme !== null)
        .map((link) => ({ component: component.name, ...link }))
    )
  };
}

function inspectManifest(inspectorGaps: string[]) {
  const aapt2 = findLatestBuildToolsFile(process.platform === "win32" ? "aapt2.exe" : "aapt2");
  if (!aapt2) {
    inspectorGaps.push("aapt2 not found; package and manifest attributes were not independently decoded");
    return {
      packageName: null,
      versionCode: null,
      versionName: null,
      minSdk: null,
      targetSdk: null,
      nativeAbis: [] as string[],
      debuggable: null,
      testOnly: null,
      tool: null
    };
  }
  const badging = String(run(aapt2, ["dump", "badging", apkPath]).stdout);
  const xmlTree = String(run(aapt2, ["dump", "xmltree", "--file", "AndroidManifest.xml", apkPath]).stdout);
  return {
    ...parseBadging(badging),
    debuggable: manifestBoolean(xmlTree, "debuggable"),
    testOnly: manifestBoolean(xmlTree, "testOnly"),
    ...parseManifestDetails(xmlTree),
    tool: normalizePath(aapt2)
  };
}

function inspectSigning(inspectorGaps: string[]) {
  const apksigner = findLatestBuildToolsFile(process.platform === "win32" ? "apksigner.bat" : "apksigner");
  if (!apksigner) {
    inspectorGaps.push("apksigner not found; APK signature and certificate were not independently verified");
    return { verified: null, certificateDn: null, certificateSha256: null, schemes: null, tool: null };
  }
  const verifyResult = run(apksigner, ["verify", "--verbose", "--print-certs", apkPath], { allowFailure: true });
  const output = `${String(verifyResult.stdout ?? "")}\n${String(verifyResult.stderr ?? "")}`;
  const certificateDn = output.match(/Signer #1 certificate DN:\s*(.+)/)?.[1]?.trim() ?? null;
  const certificateSha256 = output.match(/Signer #1 certificate SHA-256 digest:\s*([A-Fa-f0-9]+)/)?.[1]?.toUpperCase() ?? null;
  const scheme = (version: number) =>
    new RegExp(`Verified using v${version} scheme[^:]*:\\s*(true|false)`, "i").exec(output)?.[1] === "true";
  return {
    verified: verifyResult.status === 0,
    certificateDn,
    certificateSha256,
    schemes: { v1: scheme(1), v2: scheme(2), v3: scheme(3), v4: scheme(4) },
    tool: normalizePath(apksigner)
  };
}

function digestWorkingTreePaths(paths: string[]) {
  return paths
    .filter(
      (path) =>
        path !== generatedByPath &&
        path !== normalizePath(relative(repoRoot, preflightPath)) &&
        path !== normalizePath(relative(repoRoot, outputPath))
    )
    .filter((path) => existsSync(join(repoRoot, path)) && statSync(join(repoRoot, path)).isFile())
    .sort()
    .map((path) => {
      const bytes = readFileSync(join(repoRoot, path));
      return { path, bytes: bytes.length, sha256: sha256(bytes) };
    });
}

function writePreflightEvidence() {
  const rawStatus = gitText(["-c", "core.quotePath=false", "status", "--short", "-uall"]);
  const statusPaths = rawStatus
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .map((path) => path.includes(" -> ") ? path.split(" -> ").at(-1)! : path);
  const digests = digestWorkingTreePaths(statusPaths);
  const branch = gitText(["branch", "--show-current"]);
  const head = gitText(["rev-parse", "HEAD"]);
  const remotes = gitText(["remote", "-v"]);
  const upstreamResult = run("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], { allowFailure: true });
  const upstream = upstreamResult.status === 0 ? String(upstreamResult.stdout).trim() : "NONE";
  const lines = [
    "# Release 4 provenance preflight",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Branch: ${branch}`,
    `HEAD: ${head}`,
    `Upstream: ${upstream}`,
    "",
    "## Protected pre-existing working tree",
    "",
    "The following dirty/untracked paths existed before this provenance evidence was generated. The generator itself and this output file are excluded.",
    "",
    "```text",
    rawStatus,
    "```",
    "",
    "## SHA-256 inventory",
    "",
    "| Path | Bytes | SHA-256 |",
    "|---|---:|---|",
    ...digests.map((digest) => `| ${digest.path.replaceAll("|", "\\|")} | ${digest.bytes} | ${digest.sha256} |`),
    "",
    "## Remotes (read-only capture)",
    "",
    "```text",
    remotes,
    "```",
    "",
    "No checkout, reset, clean, staging, commit, push, deploy, store upload, or remote write was performed by this capture."
  ];
  mkdirSync(dirname(preflightPath), { recursive: true });
  writeFileSync(preflightPath, `${lines.join("\n")}\n`, "utf8");
}

function main() {
  if (!existsSync(apkPath)) throw new Error(`APK_NOT_FOUND ${apkPath}`);
  if (!existsSync(preflightPath)) {
    writePreflightEvidence();
  }

  const inspectorGaps: string[] = [];
  const apkBytes = readFileSync(apkPath);
  const assets = inspectApkAssets();
  if (!assets.embeddedBundle) {
    throw new Error(`APK_EMBEDDED_BUNDLE_MISSING ${apkPath}`);
  }
  const manifest = inspectManifest(inspectorGaps);
  const signing = inspectSigning(inspectorGaps);
  const buildReport = existsSync(buildReportPath)
    ? (JSON.parse(readFileSync(buildReportPath, "utf8")) as BuildReport)
    : null;
  if (!buildReport) inspectorGaps.push(`build metadata missing: ${normalizePath(relative(repoRoot, buildReportPath))}`);

  const mobileTrackedFiles = gitFiles(["apps/mobile"], false);
  const mobileBuildFiles = gitFiles(["apps/mobile", "app.config.js"], true);
  const mobileConfigFiles = gitFiles(
    [
      "apps/mobile/app.json",
      "apps/mobile/package.json",
      "apps/mobile/babel.config.js",
      "apps/mobile/metro.config.js",
      "app.config.js"
    ],
    true
  );
  const apiTrackedFiles = gitFiles(["apps/api"], false);
  const apiBuildFiles = gitFiles(["apps/api"], true);
  const contractTrackedFiles = gitFiles(["packages/contracts"], false);
  const contractBuildFiles = gitFiles(["packages/contracts"], true);
  const nativeGradleFiles = walkFiles(join(repoRoot, "apps", "mobile", "android"), (path) =>
    /(?:^|\/)(?:build|\.gradle|\.cxx)(?:\/|$)/.test(path) ||
    /(?:^|\/)local\.properties$/.test(path) ||
    /\.(?:keystore|jks|p12|pem|key)$/i.test(path)
  );
  const status = gitText(["-c", "core.quotePath=false", "status", "--short", "-uall"]);
  const apkSha256 = sha256(apkBytes);
  const env = buildReport?.env ?? {};

  const provenance = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repository: {
      branch: gitText(["branch", "--show-current"]),
      commit: gitText(["rev-parse", "HEAD"]),
      worktreeStatusSha256: sha256(status),
      worktreeDirty: status.length > 0
    },
    source: {
      hashMethod: "SHA-256 over sorted records path\\0byteLength\\0fileSHA256 for current working-tree file bytes",
      mobileSourceTreeHash: hashFiles(mobileTrackedFiles),
      mobileSourceFileCount: mobileTrackedFiles.length,
      mobileBuildInputTreeHash: hashFiles(mobileBuildFiles),
      mobileBuildInputFileCount: mobileBuildFiles.length,
      mobileConfigHash: hashFiles(mobileConfigFiles),
      mobileConfigFileCount: mobileConfigFiles.length,
      gradleInputHash: hashFiles(nativeGradleFiles),
      gradleInputFileCount: nativeGradleFiles.length,
      apiSourceTreeHash: hashFiles(apiTrackedFiles),
      apiSourceFileCount: apiTrackedFiles.length,
      apiBuildInputTreeHash: hashFiles(apiBuildFiles),
      apiBuildInputFileCount: apiBuildFiles.length,
      contractsSourceTreeHash: hashFiles(contractTrackedFiles),
      contractsSourceFileCount: contractTrackedFiles.length,
      contractsBuildInputTreeHash: hashFiles(contractBuildFiles),
      contractsBuildInputFileCount: contractBuildFiles.length,
      lockfileHash: sha256(readFileSync(join(repoRoot, "pnpm-lock.yaml")))
    },
    build: {
      profile: buildReport?.profile ?? null,
      buildVariant: "release",
      authProfile: env.EXPO_PUBLIC_TEST_LOGIN === "1" ? "standalone-test-login" : "real-user",
      apiBaseUrlProfile: Object.hasOwn(env, "EXPO_PUBLIC_API_BASE_URL") ? "configured" : "not-recorded",
      pixelLockProfile: env.EXPO_PUBLIC_PIXEL_LOCK === "1" ? "pixel-lock" : "normal-app",
      signingProfile: buildReport?.signing ?? null,
      buildGeneratedAt: buildReport?.generatedAt ?? null,
      gradleTask: buildReport?.task ?? null,
      metadataPath: existsSync(buildReportPath) ? normalizePath(relative(repoRoot, buildReportPath)) : null,
      note: "Environment values and credentials are intentionally excluded; only non-secret profiles are recorded."
    },
    apk: {
      path: normalizePath(relative(repoRoot, apkPath)),
      fileName: basename(apkPath),
      sizeBytes: apkBytes.length,
      sha256: apkSha256,
      reportedPriorApkSha256,
      unchangedArtifact: apkSha256 === reportedPriorApkSha256,
      artifactClassification: apkSha256 === reportedPriorApkSha256 ? "UNCHANGED_ARTIFACT" : "DIFFERENT_ARTIFACT",
      signing,
      manifest,
      embeddedBundle: assets.embeddedBundle,
      assetManifestHash: assets.assetManifestHash,
      assets: assets.assets
    },
    inspection: {
      toolsUsed: ["git", "tar", manifest.tool, signing.tool].filter(Boolean),
      unavailableOptionalTools: ["bundletool", "jadx"],
      gaps: inspectorGaps
    }
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
  console.log(`Provenance: ${outputPath}`);
  console.log(`APK SHA-256: ${apkSha256}`);
  console.log(`Embedded bundle SHA-256: ${assets.embeddedBundle?.sha256 ?? "MISSING"}`);
  console.log(`Mobile source tree SHA-256: ${provenance.source.mobileSourceTreeHash}`);
}

main();
