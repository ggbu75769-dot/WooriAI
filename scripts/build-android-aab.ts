import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { DEFAULT_ANDROID_ARCHITECTURES, validateApkNativeLibraries } from "./android-build-plan";
import { createGradleInvocation, sha256Bytes } from "./android-build-contract";
import { syncAndroidBrandingResources } from "./lib/android-branding";
import { verifyBuildSourceSnapshots } from "./lib/release5v-source-binding";
import { computeRelease5vSourceSnapshot } from "./lib/release5v-source-snapshot";

const repoRoot = process.cwd();
const mobileRoot = join(repoRoot, "apps", "mobile");
const androidRoot = join(mobileRoot, "android");
const gradleUserHome = join(repoRoot, ".gradle-home");
const gradlew = join(androidRoot, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const builtAab = join(androidRoot, "app", "build", "outputs", "bundle", "release", "app-release.aab");
const generatedBundle = join(androidRoot, "app", "build", "generated", "assets", "createBundleReleaseJsAndAssets", "index.android.bundle");
const staleSourceBundle = join(androidRoot, "app", "src", "main", "assets", "index.android.bundle");

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || /change-me/i.test(value)) throw new Error(`${name}_REQUIRED`);
  return value;
}

function findJavaHome(): string {
  if (process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  for (const root of ["C:\\Program Files\\Eclipse Adoptium", "C:\\Program Files\\Java", "C:\\Program Files\\Microsoft"]) {
    if (!existsSync(root)) continue;
    const match = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /jdk-?17|jdk.*17/i.test(entry.name))
      .map((entry) => join(root, entry.name))
      .find((candidate) => existsSync(join(candidate, "bin", process.platform === "win32" ? "java.exe" : "java")));
    if (match) return match;
  }
  return "";
}

function findAndroidSdk(): string {
  return [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk")]
    .filter((value): value is string => Boolean(value))
    .find((candidate) => existsSync(join(candidate, "platform-tools"))) ?? "";
}

function extractAabEntry(path: string) {
  const result = spawnSync("tar", ["-xOf", builtAab, path], {
    cwd: repoRoot,
    encoding: null,
    shell: false,
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout) || result.stdout.length === 0) {
    throw new Error(`AAB_ENTRY_MISSING ${path}\n${String(result.stderr ?? "")}`);
  }
  return result.stdout;
}

function verifyAabContents(internalTest: boolean) {
  const list = spawnSync("tar", ["-tf", builtAab], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    maxBuffer: 16 * 1024 * 1024
  });
  if (list.status !== 0) throw new Error(`AAB_CONTENT_LIST_FAILED\n${String(list.stderr ?? "")}`);
  const entries = list.stdout.split(/\r?\n/).filter(Boolean);
  const nativeLibraryVerification = validateApkNativeLibraries(
    entries.map((entry) => entry.replace(/^base\//, ""))
  );
  const embeddedBundle = extractAabEntry("base/assets/index.android.bundle");
  if (!existsSync(generatedBundle)) throw new Error(`GENERATED_BUNDLE_MISSING ${generatedBundle}`);
  const generatedBundleBytes = readFileSync(generatedBundle);
  const embeddedBundleSha256 = sha256Bytes(embeddedBundle);
  const generatedBundleSha256 = sha256Bytes(generatedBundleBytes);
  if (embeddedBundleSha256 !== generatedBundleSha256) {
    throw new Error(`AAB_EMBEDDED_BUNDLE_MISMATCH embedded=${embeddedBundleSha256} generated=${generatedBundleSha256}`);
  }
  const appConfig = JSON.parse(extractAabEntry("base/assets/app.config").toString("utf8")) as {
    extra?: {
      wooriaiBuildProfile?: string;
      wooriaiPixelLockEnabled?: boolean;
      wooriaiTestLoginEnabled?: boolean;
    };
  };
  const expectedAppConfig = {
    wooriaiBuildProfile: internalTest ? "standalone" : "production",
    wooriaiPixelLockEnabled: false,
    wooriaiTestLoginEnabled: internalTest
  };
  const actual = appConfig.extra ?? {};
  if (
    actual.wooriaiBuildProfile !== expectedAppConfig.wooriaiBuildProfile ||
    actual.wooriaiPixelLockEnabled !== expectedAppConfig.wooriaiPixelLockEnabled ||
    actual.wooriaiTestLoginEnabled !== expectedAppConfig.wooriaiTestLoginEnabled
  ) {
    throw new Error(`AAB_EMBEDDED_APP_CONFIG_PROFILE_MISMATCH expected=${JSON.stringify(expectedAppConfig)} actual=${JSON.stringify(actual)}`);
  }
  return {
    embeddedBundleBytes: embeddedBundle.length,
    embeddedBundleSha256,
    generatedBundleSha256,
    embeddedAppConfig: expectedAppConfig,
    nativeLibraryVerification
  };
}

async function main() {
  const args = process.argv.slice(2).filter((argument) => argument !== "--");
  const internalTest = args.includes("--internal-test");
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: pnpm android:build-aab -- [--internal-test]");
    console.log("Production is the default and requires approved identity, HTTPS API, and external signing.");
    console.log("--internal-test builds a clearly labeled debug-signed fixture AAB for local pipeline verification only.");
    return;
  }
  const unknown = args.filter((argument) => argument !== "--internal-test");
  if (unknown.length > 0) throw new Error(`UNKNOWN_ANDROID_AAB_ARGUMENT: ${unknown.join(",")}`);

  const app = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8")) as {
    expo: { version: string; android: { package: string; versionCode: number } };
  };
  if (!internalTest && (/anonymous|example|change-me/i.test(app.expo.android.package) || app.expo.version === "0.0.0" || app.expo.android.versionCode < 1)) {
    throw new Error("ANDROID_APPROVED_IDENTITY_REQUIRED");
  }

  let apiBaseUrl: string | undefined;
  if (!internalTest) {
    const keystorePath = required("ANDROID_SIGNING_KEYSTORE_PATH");
    if (!existsSync(keystorePath)) throw new Error("ANDROID_SIGNING_KEYSTORE_NOT_FOUND");
    required("ANDROID_SIGNING_KEY_ALIAS");
    const storePasswordEnv = required("ANDROID_SIGNING_STORE_PASSWORD_ENV");
    const keyPasswordEnv = required("ANDROID_SIGNING_KEY_PASSWORD_ENV");
    required(storePasswordEnv);
    required(keyPasswordEnv);
    apiBaseUrl = required("EXPO_PUBLIC_API_BASE_URL");
    if (!/^https:\/\//.test(apiBaseUrl)) throw new Error("EXPO_PUBLIC_API_BASE_URL_HTTPS_REQUIRED");
  }

  const javaHome = findJavaHome();
  const androidSdk = findAndroidSdk();
  if (!javaHome) throw new Error("JAVA_HOME_NOT_FOUND");
  if (!androidSdk) throw new Error("ANDROID_SDK_NOT_FOUND");
  if (!existsSync(gradlew)) throw new Error("GRADLEW_NOT_FOUND");
  if (existsSync(staleSourceBundle)) unlinkSync(staleSourceBundle);

  const env = {
    ...process.env,
    NODE_PATH: [join(mobileRoot, "node_modules"), process.env.NODE_PATH].filter(Boolean).join(delimiter),
    NODE_ENV: "production",
    EXPO_PUBLIC_PIXEL_LOCK: "0",
    EXPO_PUBLIC_AUTHORITY_RECOVERY_FIXTURE: "0",
    EXPO_PUBLIC_SAFETY_ALTERNATIVE_FIXTURE: "0",
    EXPO_PUBLIC_TEST_LOGIN: internalTest ? "1" : "0",
    WOORIAI_BUILD_PROFILE: internalTest ? "standalone" : "production",
    EXPO_ROUTER_APP_ROOT: "app",
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidSdk,
    ANDROID_SDK_ROOT: androidSdk,
    GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || gradleUserHome,
    ...(internalTest ? { WOORIAI_ALLOW_DEBUG_RELEASE_SIGNING: "1" } : {}),
    ...(apiBaseUrl ? { EXPO_PUBLIC_API_BASE_URL: apiBaseUrl } : {})
  };
  const nativeBranding = await syncAndroidBrandingResources(mobileRoot, androidRoot);
  const sourceBeforeBuild = computeRelease5vSourceSnapshot(repoRoot);
  verifyBuildSourceSnapshots(
    process.env.RELEASE5V_SOURCE_SNAPSHOT_SHA256,
    sourceBeforeBuild.sourceSnapshotSha256,
    sourceBeforeBuild.sourceSnapshotSha256
  );
  const architectures = process.env.WOORIAI_ANDROID_ARCHITECTURES || DEFAULT_ANDROID_ARCHITECTURES;
  const taskArgs = ["bundleRelease", "--max-workers=1", "--no-parallel", `-PreactNativeArchitectures=${architectures}`, "--rerun-tasks"];
  const gradleInvocation = createGradleInvocation(process.platform, javaHome, androidRoot, gradlew, taskArgs);
  const result = spawnSync(gradleInvocation.command, gradleInvocation.args, {
    cwd: androidRoot,
    env,
    encoding: "utf8",
    shell: false,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 30 * 60 * 1000
  });
  if (result.status !== 0) {
    throw new Error(`ANDROID_AAB_BUILD_FAILED\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  if (!existsSync(builtAab)) throw new Error("ANDROID_AAB_MISSING");

  const contentVerification = verifyAabContents(internalTest);
  const signer = join(javaHome, "bin", process.platform === "win32" ? "jarsigner.exe" : "jarsigner");
  const signerResult = spawnSync(signer, ["-verify", builtAab], { cwd: repoRoot, encoding: "utf8", shell: false });
  if (signerResult.status !== 0) throw new Error(`ANDROID_AAB_SIGNATURE_INVALID\n${signerResult.stdout ?? ""}\n${signerResult.stderr ?? ""}`);

  const sourceAfterBuild = computeRelease5vSourceSnapshot(repoRoot);
  const sourceSnapshotVerification = verifyBuildSourceSnapshots(
    process.env.RELEASE5V_SOURCE_SNAPSHOT_SHA256,
    sourceBeforeBuild.sourceSnapshotSha256,
    sourceAfterBuild.sourceSnapshotSha256
  );
  const suffix = internalTest ? "release-internal" : "release";
  const artifact = join(repoRoot, `wooriai-${app.expo.version}-${app.expo.android.versionCode}-${suffix}.aab`);
  const report = join(repoRoot, "artifacts", "android", `wooriai-${app.expo.version}-${app.expo.android.versionCode}-${suffix}.json`);
  mkdirSync(dirname(report), { recursive: true });
  copyFileSync(builtAab, artifact);
  const artifactBytes = readFileSync(artifact);
  writeFileSync(report, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    qualification: internalTest ? "INTERNAL_TEST" : "PRODUCTION_CANDIDATE",
    storeArtifact: !internalTest,
    productionCandidate: !internalTest,
    packageName: app.expo.android.package,
    appVersion: app.expo.version,
    versionCode: app.expo.android.versionCode,
    signing: internalTest ? "debug-internal-only" : "external-production",
    architectures,
    task: taskArgs.join(" "),
    sourceSnapshotSha256: sourceAfterBuild.sourceSnapshotSha256,
    sourceSnapshotFileCount: sourceAfterBuild.fileCount,
    sourceSnapshotNativeExplicitFileCount: sourceAfterBuild.nativeExplicitFileCount,
    sourceSnapshotVerification,
    nativeBranding,
    ...contentVerification,
    signatureVerified: true,
    aabSha256: sha256Bytes(artifactBytes),
    aabBytes: artifactBytes.length,
    aabPath: artifact
  }, null, 2)}\n`);
  console.log(`${internalTest ? "Internal test" : "Production"} AAB: ${artifact}`);
  console.log(`Report: ${report}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
