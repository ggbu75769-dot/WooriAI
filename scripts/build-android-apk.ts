import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  DEFAULT_ANDROID_ARCHITECTURES,
  createAndroidBuildPlan,
  validateApkNativeLibraries
} from "./android-build-plan";
import {
  createApkArtifactMetadata,
  createExpoPrebuildInvocation,
  createGradleInvocation,
  formatAndroidBuildHelp,
  parseAndroidBuildCli,
  sha256Bytes,
  type AndroidBuildProfile
} from "./android-build-contract";
import { verifyBuildSourceSnapshots } from "./lib/release5v-source-binding";
import { computeRelease5vSourceSnapshot } from "./lib/release5v-source-snapshot";
import { syncAndroidBrandingResources } from "./lib/android-branding";

const repoRoot = process.cwd();
const mobileRoot = join(repoRoot, "apps", "mobile");
const androidDir = join(repoRoot, "apps", "mobile", "android");
const gradleUserHome = join(repoRoot, ".gradle-home");
const gradlew = join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const builtApkPath = join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk");
const appBuildGradlePath = join(androidDir, "app", "build.gradle");
const staleSourceBundlePath = join(androidDir, "app", "src", "main", "assets", "index.android.bundle");
const generatedBundlePath = join(androidDir, "app", "build", "generated", "assets", "createBundleReleaseJsAndAssets", "index.android.bundle");

// "standalone" is the existing demo build: local test login is force-enabled so the APK is
// usable without a real backend. "production" is a real-user build: test login must be off and
// a real API base URL is required so the app can never silently ship pointed at localhost.
const profileTestLoginEnv: Record<AndroidBuildProfile, "1" | "0"> = {
  standalone: "1",
  production: "0"
};

function findJavaHome() {
  if (process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  const roots = ["C:\\Program Files\\Eclipse Adoptium", "C:\\Program Files\\Java", "C:\\Program Files\\Microsoft"];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const match = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /jdk-?17|jdk.*17/i.test(entry.name))
      .map((entry) => join(root, entry.name))
      .find((candidate) => existsSync(join(candidate, "bin", process.platform === "win32" ? "java.exe" : "java")));
    if (match) return match;
  }
  return "";
}

function findAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    join(process.env.LOCALAPPDATA || "", "Android", "Sdk")
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => existsSync(join(candidate, "platform-tools"))) || "";
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 32,
    timeout: 1000 * 60 * 20
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return result;
}

function ensureWorkspaceGradleConfig() {
  if (!existsSync(appBuildGradlePath)) throw new Error(`ANDROID_BUILD_GRADLE_NOT_FOUND ${appBuildGradlePath}`);
  const current = readFileSync(appBuildGradlePath, "utf8");
  let next = current;
  if (!/^def workspaceRoot\s*=/m.test(next)) {
    next = next.replace(
      /^def projectRoot\s*=.*$/m,
      'def workspaceRoot = file("../../../..").getCanonicalFile().getAbsolutePath()\n' +
        'def projectRoot = file("../..").getCanonicalFile().getAbsolutePath()'
    );
  }
  if (!/^\s*root\s*=/m.test(next)) {
    next = next.replace(/^react\s*\{\s*$/m, "react {\n    root = file(projectRoot)");
  } else {
    next = next.replace(/^\s*root\s*=.*$/m, "    root = file(projectRoot)");
  }
  next = next.replace(/^\s*entryFile\s*=.*$/m, '    entryFile = file("${projectRoot}/index.js")');
  if (!/^\s*extraPackagerArgs\s*=/m.test(next)) {
    next = next.replace(
      /^(\s*entryFile\s*=.*)$/m,
      '$1\n    extraPackagerArgs = ["--max-workers", "1", "--reset-cache", "--entry-file", "${projectRoot}/index.js"]'
    );
  }
  if (next !== current) writeFileSync(appBuildGradlePath, next, "utf8");
}

function removeStaleSourceBundle() {
  if (!existsSync(staleSourceBundlePath)) return false;
  // React Native Gradle writes the authoritative bundle under app/build/generated/assets.
  // A manually copied bundle under src/main/assets wins during some resumed builds and can
  // silently package old JS. It is ignored by Git and must never be an Android source asset.
  unlinkSync(staleSourceBundlePath);
  return true;
}

function cleanGeneratedAndroidOutputs() {
  const targets = createAndroidBuildPlan(androidDir, DEFAULT_ANDROID_ARCHITECTURES).generatedTargets;
  const removed: string[] = [];
  for (const target of targets) {
    if (!existsSync(target)) continue;
    rmSync(target, { recursive: true, force: true });
    removed.push(target);
  }
  return removed;
}

function verifyNativeLibraries(apk: string) {
  const result = spawnSync("tar", ["-tf", apk], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 16
  });
  if (result.status !== 0) {
    throw new Error(`APK_NATIVE_LIBRARY_LIST_FAILED ${apk}\n${String(result.stderr ?? "")}`);
  }
  return validateApkNativeLibraries(result.stdout.split(/\r?\n/).filter(Boolean));
}

function verifyEmbeddedBundle(apk: string) {
  const result = spawnSync("tar", ["-xOf", apk, "assets/index.android.bundle"], {
    cwd: repoRoot,
    encoding: null,
    shell: false,
    maxBuffer: 1024 * 1024 * 64
  });
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout) || result.stdout.length === 0) {
    throw new Error(`APK_EMBEDDED_BUNDLE_MISSING ${apk}\n${String(result.stderr ?? "")}`);
  }
  if (!existsSync(generatedBundlePath)) {
    throw new Error(`GENERATED_BUNDLE_MISSING ${generatedBundlePath}`);
  }
  const generated = readFileSync(generatedBundlePath);
  const embeddedSha256 = sha256Bytes(result.stdout);
  const generatedSha256 = sha256Bytes(generated);
  if (embeddedSha256 !== generatedSha256) {
    throw new Error(`APK_EMBEDDED_BUNDLE_MISMATCH embedded=${embeddedSha256} generated=${generatedSha256}`);
  }
  return {
    embeddedBundleBytes: result.stdout.length,
    embeddedBundleSha256: embeddedSha256,
    generatedBundleSha256: generatedSha256
  };
}

function verifyEmbeddedAppConfig(apk: string, profile: AndroidBuildProfile) {
  const result = spawnSync("tar", ["-xOf", apk, "assets/app.config"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024
  });
  if (result.status !== 0 || !result.stdout) {
    throw new Error(`APK_EMBEDDED_APP_CONFIG_MISSING ${apk}\n${String(result.stderr ?? "")}`);
  }
  const config = JSON.parse(result.stdout) as {
    extra?: {
      wooriaiBuildProfile?: string;
      wooriaiPixelLockEnabled?: boolean;
      wooriaiTestLoginEnabled?: boolean;
    };
  };
  const actual = config.extra ?? {};
  const expected = {
    wooriaiBuildProfile: profile,
    wooriaiPixelLockEnabled: false,
    wooriaiTestLoginEnabled: profileTestLoginEnv[profile] === "1"
  };
  if (
    actual.wooriaiBuildProfile !== expected.wooriaiBuildProfile ||
    actual.wooriaiPixelLockEnabled !== expected.wooriaiPixelLockEnabled ||
    actual.wooriaiTestLoginEnabled !== expected.wooriaiTestLoginEnabled
  ) {
    throw new Error(
      `APK_EMBEDDED_APP_CONFIG_PROFILE_MISMATCH expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`
    );
  }
  return { embeddedAppConfig: expected };
}

async function main() {
  const options = parseAndroidBuildCli(process.argv.slice(2), process.env.BUILD_PROFILE);
  if (options.help) {
    console.log(formatAndroidBuildHelp());
    return;
  }
  const { profile, cleanRequested, resumeAfterClean } = options;
  const appConfig = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8")) as {
    expo: { version: string; android: { package: string; versionCode: number } };
  };
  const staleSourceBundleRemoved = removeStaleSourceBundle();
  const artifactPath = join(repoRoot, `wooriai-${appConfig.expo.version}-release-${profile}.apk`);
  const reportPath = join(repoRoot, "artifacts", "android", `wooriai-${appConfig.expo.version}-release-${profile}.json`);

  const javaHome = findJavaHome();
  const androidSdk = findAndroidSdk();
  if (!javaHome) throw new Error("JAVA_HOME_NOT_FOUND: install JDK 17 or set JAVA_HOME.");
  if (!androidSdk) throw new Error("ANDROID_SDK_NOT_FOUND: install Android SDK or set ANDROID_HOME.");

  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (profile === "production" && (
    /anonymous|example|change-me/i.test(appConfig.expo.android.package) ||
    appConfig.expo.version === "0.0.0" ||
    appConfig.expo.android.versionCode < 1
  )) {
    throw new Error("ANDROID_APPROVED_IDENTITY_REQUIRED");
  }
  if (profile === "production" && !apiBaseUrl) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE_URL_REQUIRED: the production profile refuses to build without a real API base URL " +
        "(set EXPO_PUBLIC_API_BASE_URL) -- otherwise the app would silently fall back to the localhost dev default."
    );
  }

  const env = {
    ...process.env,
    NODE_PATH: [join(mobileRoot, "node_modules"), process.env.NODE_PATH].filter(Boolean).join(delimiter),
    EXPO_PUBLIC_PIXEL_LOCK: "0",
    EXPO_PUBLIC_TEST_LOGIN: profileTestLoginEnv[profile],
    WOORIAI_BUILD_PROFILE: profile,
    EXPO_ROUTER_APP_ROOT: "app",
    NODE_ENV: "production",
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidSdk,
    ANDROID_SDK_ROOT: androidSdk,
    GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || gradleUserHome,
    ...(profile === "standalone" ? { WOORIAI_ALLOW_DEBUG_RELEASE_SIGNING: "1" } : {}),
    ...(apiBaseUrl ? { EXPO_PUBLIC_API_BASE_URL: apiBaseUrl } : {})
  };
  if (!existsSync(gradlew)) {
    const expoPrebuildInvocation = createExpoPrebuildInvocation(process.platform, process.execPath, mobileRoot);
    if (!existsSync(expoPrebuildInvocation.args[0])) {
      throw new Error(`EXPO_CLI_NOT_FOUND ${expoPrebuildInvocation.args[0]}`);
    }
    run(expoPrebuildInvocation.command, expoPrebuildInvocation.args, mobileRoot, env);
  }
  if (!existsSync(gradlew)) throw new Error(`GRADLEW_NOT_FOUND_AFTER_PREBUILD ${gradlew}`);
  ensureWorkspaceGradleConfig();
  const nativeBranding = await syncAndroidBrandingResources(mobileRoot, androidDir);
  const cleanedGeneratedPaths = cleanRequested ? cleanGeneratedAndroidOutputs() : [];
  const architectures = process.env.WOORIAI_ANDROID_ARCHITECTURES || DEFAULT_ANDROID_ARCHITECTURES;
  const plannedArgs = createAndroidBuildPlan(androidDir, architectures).taskArgs;
  // Release profiles share Gradle output paths but embed different Expo public environment
  // values. Even with the Gradle inputs declared in app/build.gradle, force the normal build
  // path to re-execute profile-sensitive tasks so a Pixel bundle can never be reported or copied
  // as a standalone/production APK. Resume remains incremental only after an explicit clean
  // build timed out in this same workspace; embedded-bundle and source-binding checks still run.
  const args = resumeAfterClean ? plannedArgs : [...plannedArgs, "--rerun-tasks"];
  const sourceBeforeBuild = computeRelease5vSourceSnapshot(repoRoot);
  verifyBuildSourceSnapshots(
    process.env.RELEASE5V_SOURCE_SNAPSHOT_SHA256,
    sourceBeforeBuild.sourceSnapshotSha256,
    sourceBeforeBuild.sourceSnapshotSha256
  );
  const gradleInvocation = createGradleInvocation(process.platform, javaHome, androidDir, gradlew, args);
  const result = spawnSync(gradleInvocation.command, gradleInvocation.args, {
    cwd: androidDir,
    env,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 32,
    timeout: 1000 * 60 * 30
  });
  if (result.status !== 0) {
    throw new Error(
      `${gradleInvocation.command} ${gradleInvocation.args.join(" ")} failed\n` +
        `${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`
    );
  }
  if (!existsSync(builtApkPath)) throw new Error(`RELEASE_APK_MISSING ${builtApkPath}`);
  const bundleVerification = verifyEmbeddedBundle(builtApkPath);
  const appConfigVerification = verifyEmbeddedAppConfig(builtApkPath, profile);
  const nativeLibraryVerification = verifyNativeLibraries(builtApkPath);
  const sourceAfterBuild = computeRelease5vSourceSnapshot(repoRoot);
  const sourceSnapshotVerification = verifyBuildSourceSnapshots(
    process.env.RELEASE5V_SOURCE_SNAPSHOT_SHA256,
    sourceBeforeBuild.sourceSnapshotSha256,
    sourceAfterBuild.sourceSnapshotSha256
  );

  mkdirSync(dirname(reportPath), { recursive: true });
  copyFileSync(builtApkPath, artifactPath);
  const apkArtifactMetadata = createApkArtifactMetadata(readFileSync(artifactPath));
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        profile,
        packageName: appConfig.expo.android.package,
        appVersion: appConfig.expo.version,
        versionCode: appConfig.expo.android.versionCode,
        signing: profile === "standalone" ? "debug-internal-only" : "external-production",
        env: {
          EXPO_PUBLIC_PIXEL_LOCK: "0",
          EXPO_PUBLIC_TEST_LOGIN: profileTestLoginEnv[profile],
          WOORIAI_BUILD_PROFILE: profile,
          EXPO_ROUTER_APP_ROOT: "app",
          ...(apiBaseUrl ? { EXPO_PUBLIC_API_BASE_URL: apiBaseUrl } : {})
        },
        task: args.join(" "),
        architectures,
        cleanRequested,
        resumeAfterClean,
        cleanedGeneratedPaths,
        staleSourceBundleRemoved,
        sourceSnapshotSha256: sourceAfterBuild.sourceSnapshotSha256,
        sourceSnapshotFileCount: sourceAfterBuild.fileCount,
        sourceSnapshotNativeExplicitFileCount: sourceAfterBuild.nativeExplicitFileCount,
        sourceSnapshotVerification,
        nativeBranding,
        ...bundleVerification,
        ...appConfigVerification,
        nativeLibraryVerification,
        ...apkArtifactMetadata,
        apkPath: artifactPath
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`${profile === "standalone" ? "Standalone" : "Production"} APK: ${artifactPath}`);
  console.log(`Report: ${reportPath}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
