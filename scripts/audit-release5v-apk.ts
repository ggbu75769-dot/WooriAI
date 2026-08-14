import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { filter16KiBPageSizeLibraries } from "./android-build-plan";
import { runPortableCommand } from "./release5v-command-runner";
import { evaluateArtifactSourceBinding } from "./lib/release5v-source-binding";
import { computeRelease5vSourceSnapshot } from "./lib/release5v-source-snapshot";

const repoRoot = process.cwd();
const mobileRoot = resolve(repoRoot, "apps", "mobile");
const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
const appConfig = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8")) as { expo: { version: string } };
const apkPath = resolve(repoRoot, `wooriai-${appConfig.expo.version}-release-standalone.apk`);
const buildReportPath = resolve(repoRoot, "artifacts", "android", `wooriai-${appConfig.expo.version}-release-standalone.json`);
const outputPath = resolve(repoRoot, "docs", "qa", "evidence", "release5v-native-artifact-audit.json");

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function latestBuildTool(name: string) {
  const root = join(sdkRoot, "build-tools");
  if (!existsSync(root)) throw new Error(`ANDROID_BUILD_TOOLS_NOT_FOUND ${root}`);
  const versions = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
  const found = versions.map((version) => join(root, version, name)).find(existsSync);
  if (!found) throw new Error(`ANDROID_TOOL_NOT_FOUND ${name}`);
  return found;
}

function latestNdkTool(name: string) {
  const ndkRoots = [
    process.env.ANDROID_NDK_HOME,
    ...(!existsSync(join(sdkRoot, "ndk"))
      ? []
      : readdirSync(join(sdkRoot, "ndk"), { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => join(sdkRoot, "ndk", entry.name))
          .sort()
          .reverse())
  ].filter((value): value is string => Boolean(value));
  const hostTag = process.platform === "win32" ? "windows-x86_64" : process.platform === "darwin" ? "darwin-x86_64" : "linux-x86_64";
  const executable = process.platform === "win32" ? `${name}.exe` : name;
  const found = ndkRoots.map((root) => join(root, "toolchains", "llvm", "prebuilt", hostTag, "bin", executable)).find(existsSync);
  if (!found) throw new Error(`ANDROID_NDK_TOOL_NOT_FOUND ${name}`);
  return found;
}

function run(command: string, args: string[], encoding: BufferEncoding | null = "utf8") {
  return runPortableCommand(command, args, { cwd: repoRoot, encoding, maxBuffer: 128 * 1024 * 1024 });
}

function auditElfAlignment16KiB(apkPath: string) {
  const readelf = latestNdkTool("llvm-readelf");
  const allEntries = String(run("tar", ["-tf", apkPath])).split(/\r?\n/).filter((entry) => /^lib\/[^/]+\/[^/]+\.so$/.test(entry));
  const entries = filter16KiBPageSizeLibraries(allEntries);
  if (entries.length === 0) throw new Error("APK_NATIVE_LIBRARIES_MISSING");
  const tempRoot = mkdtempSync(join(tmpdir(), "wooriai-elf-audit-"));
  try {
    const libraries = entries.map((entry, index) => {
      const bytes = run("tar", ["-xOf", apkPath, entry], null);
      if (!Buffer.isBuffer(bytes)) throw new Error(`APK_NATIVE_LIBRARY_READ_FAILED ${entry}`);
      const tempPath = join(tempRoot, `${index}-${basename(entry)}`);
      writeFileSync(tempPath, bytes);
      const programHeaders = String(run(readelf, ["-lW", tempPath]));
      const loadAlignments = [...programHeaders.matchAll(/^\s*LOAD\s+.*\s(0x[0-9a-f]+)\s*$/gim)]
        .map((match) => Number.parseInt(match[1]!, 16));
      const aligned = loadAlignments.length > 0 && loadAlignments.every((alignment) => alignment >= 16 * 1024);
      return { entry, loadAlignments, aligned };
    });
    return {
      libraryCount: libraries.length,
      ignored32BitLibraryCount: allEntries.length - libraries.length,
      evaluatedAbis: [...new Set(entries.map((entry) => entry.split("/")[1]))].sort(),
      alignedLibraryCount: libraries.filter((library) => library.aligned).length,
      invalidLibraries: libraries.filter((library) => !library.aligned),
      aligned: libraries.every((library) => library.aligned)
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function main() {
  if (!existsSync(apkPath) || !existsSync(buildReportPath)) throw new Error(`CURRENT_INTERNAL_APK_NOT_FOUND ${apkPath}`);
  const aapt = latestBuildTool(process.platform === "win32" ? "aapt.exe" : "aapt");
  const apksigner = latestBuildTool(process.platform === "win32" ? "apksigner.bat" : "apksigner");
  const zipalign = latestBuildTool(process.platform === "win32" ? "zipalign.exe" : "zipalign");
  const badging = String(run(aapt, ["dump", "badging", apkPath]));
  const permissionsText = String(run(aapt, ["dump", "permissions", apkPath]));
  const manifest = String(run(aapt, ["dump", "xmltree", apkPath, "AndroidManifest.xml"]));
  const certificate = String(run(apksigner, ["verify", "--print-certs", apkPath]));
  run(zipalign, ["-c", "-P", "16", "-v", "4", apkPath]);
  const elfAlignment = auditElfAlignment16KiB(apkPath);
  const bundle = run("tar", ["-xOf", apkPath, "assets/index.android.bundle"], null);
  if (!Buffer.isBuffer(bundle)) throw new Error("APK_HERMES_BUNDLE_MISSING");
  const apk = readFileSync(apkPath);
  const buildReport = JSON.parse(readFileSync(buildReportPath, "utf8")) as {
    sourceSnapshotSha256?: string | null;
    sourceSnapshotVerification?: { status?: string };
    profile?: string;
    task?: string;
    cleanedGeneratedPaths?: string[];
  };
  const currentSourceSnapshot = computeRelease5vSourceSnapshot(repoRoot);
  const sourceBinding = evaluateArtifactSourceBinding(
    buildReport.sourceSnapshotSha256,
    buildReport.sourceSnapshotVerification?.status,
    currentSourceSnapshot.sourceSnapshotSha256
  );
  const permissionNames = [...permissionsText.matchAll(/uses-permission: name='([^']+)'/g)].map((match) => match[1]);
  const forbiddenPermissions = permissionNames.filter((name) => [
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.MANAGE_EXTERNAL_STORAGE",
    "android.permission.READ_MEDIA_IMAGES",
    "android.permission.READ_MEDIA_VIDEO",
    "android.permission.READ_MEDIA_AUDIO"
  ].includes(name));
  const markers = ["다온", "Daon", "local-child-", "wooriai-local-session", "localhost", "x-admin-token"];
  const markerMatches = markers.filter((marker) => bundle.includes(Buffer.from(marker, "utf8")));
  const packageMatch = badging.match(/package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/);
  const targetSdk = Number(badging.match(/targetSdkVersion:'(\d+)'/)?.[1] ?? 0);
  const compileSdk = Number(badging.match(/compileSdkVersion[=:]'(\d+)'/)?.[1] ?? 0);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    actor: "Android build engineer and release reviewer",
    input: "current-source standalone APK, binary manifest, Hermes bundle, and signer certificate",
    mission: "prove native properties while refusing to qualify an internal fixture APK as a store artifact",
    status: forbiddenPermissions.length === 0 && sourceBinding === "BOUND" && targetSdk >= 36 && compileSdk >= 36 && elfAlignment.aligned ? "ARTIFACT_VERIFIED" : "FAIL",
    qualification: "INTERNAL_TEST",
    storeArtifact: false,
    productionCandidate: false,
    apkPath,
    apkBytes: apk.length,
    apkSha256: sha256(apk),
    hermesBytes: bundle.length,
    hermesSha256: sha256(bundle),
    packageName: packageMatch?.[1] ?? null,
    versionCode: packageMatch?.[2] ?? null,
    versionName: packageMatch?.[3] ?? null,
    targetSdk,
    compileSdk,
    zipAlignment16KiB: true,
    elfAlignment16KiB: elfAlignment.aligned,
    nativeLibraryCount: elfAlignment.libraryCount,
    ignored32BitNativeLibraryCount: elfAlignment.ignored32BitLibraryCount,
    elfAlignmentEvaluatedAbis: elfAlignment.evaluatedAbis,
    alignedNativeLibraryCount: elfAlignment.alignedLibraryCount,
    invalidNativeLibraries: elfAlignment.invalidLibraries,
    debuggable: badging.includes("application-debuggable"),
    allowBackupFalse: /android:allowBackup[^\n]*0x0\b/.test(manifest),
    cleartextFalse: /android:usesCleartextTraffic[^\n]*0x0\b/.test(manifest),
    permissions: permissionNames,
    forbiddenPermissions,
    exportedComponentsReviewed: manifest.includes("android:exported"),
    deepLinks: { scheme: manifest.includes('Raw: "wooriai"'), oauth: manifest.includes('Raw: "oauth"'), items: manifest.includes('Raw: "items"') },
    certificate: certificate.trim().split(/\r?\n/),
    fixtureMarkers: markerMatches,
    contamination: markerMatches.length > 0 ? "INTERNAL_TEST_EXPECTED" : "NONE_FOUND",
    sourceSnapshotSha256: buildReport.sourceSnapshotSha256 ?? null,
    currentSourceSnapshotSha256: currentSourceSnapshot.sourceSnapshotSha256,
    sourceSnapshotVerification: buildReport.sourceSnapshotVerification ?? null,
    sourceBinding,
    buildTask: buildReport.task ?? null,
    cleanedGeneratedPaths: buildReport.cleanedGeneratedPaths ?? [],
    notes: [
      "debug certificate",
      "test login and standalone fixture runtime enabled",
      "not a production/store candidate",
      "16 KiB ZIP and ELF alignment are static packaging evidence; runtime page-size compatibility remains a separate device test"
    ]
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "ARTIFACT_VERIFIED") {
    throw new Error(`APK_AUDIT_FAILED sourceBinding=${sourceBinding} forbiddenPermissions=${forbiddenPermissions.length} targetSdk=${targetSdk} compileSdk=${compileSdk} elfAlignment16KiB=${elfAlignment.aligned}`);
  }
}

main();
