import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

function run(command: string, args: string[], encoding: BufferEncoding | null = "utf8") {
  return runPortableCommand(command, args, { cwd: repoRoot, encoding, maxBuffer: 128 * 1024 * 1024 });
}

function main() {
  if (!existsSync(apkPath) || !existsSync(buildReportPath)) throw new Error(`CURRENT_INTERNAL_APK_NOT_FOUND ${apkPath}`);
  const aapt = latestBuildTool(process.platform === "win32" ? "aapt.exe" : "aapt");
  const apksigner = latestBuildTool(process.platform === "win32" ? "apksigner.bat" : "apksigner");
  const badging = String(run(aapt, ["dump", "badging", apkPath]));
  const permissionsText = String(run(aapt, ["dump", "permissions", apkPath]));
  const manifest = String(run(aapt, ["dump", "xmltree", apkPath, "AndroidManifest.xml"]));
  const certificate = String(run(apksigner, ["verify", "--print-certs", apkPath]));
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
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    actor: "Android build engineer and release reviewer",
    input: "current-source standalone APK, binary manifest, Hermes bundle, and signer certificate",
    mission: "prove native properties while refusing to qualify an internal fixture APK as a store artifact",
    status: forbiddenPermissions.length === 0 && sourceBinding === "BOUND" ? "ARTIFACT_VERIFIED" : "FAIL",
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
    notes: ["debug certificate", "test login and standalone fixture runtime enabled", "not a production/store candidate"]
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "ARTIFACT_VERIFIED") {
    throw new Error(`APK_AUDIT_FAILED sourceBinding=${sourceBinding} forbiddenPermissions=${forbiddenPermissions.length}`);
  }
}

main();
