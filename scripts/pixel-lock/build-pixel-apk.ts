import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  createPixelApkBuildResumeMetadata,
  createExpoPrebuildInvocation,
  createGradleInvocation,
  formatPixelApkBuildHelp,
  parsePixelApkBuildCli
} from "../android-build-contract";
import { verifyBuildSourceSnapshots } from "../lib/release5v-source-binding";
import { computeRelease5vSourceSnapshot } from "../lib/release5v-source-snapshot";
import { syncAndroidBrandingResources } from "../lib/android-branding";

const repoRoot = process.cwd();
const mobileRoot = join(repoRoot, "apps", "mobile");
const androidDir = join(repoRoot, "apps", "mobile", "android");
const gradleUserHome = join(repoRoot, ".gradle-home");
const reportPath = join(repoRoot, "artifacts", "pixel-lock", "android", "reports", "pixel-apk.json");
const gradlew = join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const appBuildGradlePath = join(androidDir, "app", "build.gradle");
const apkPath = join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk");
const appJsonPath = join(repoRoot, "apps", "mobile", "app.json");

function findJavaHome() {
  if (process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  const roots = [
    "C:\\Program Files\\Eclipse Adoptium",
    "C:\\Program Files\\Java",
    "C:\\Program Files\\Microsoft"
  ];
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
    join(process.env.LOCALAPPDATA || "", "Android", "Sdk"),
    "C:\\Users\\nj970\\AppData\\Local\\Android\\Sdk"
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => existsSync(join(candidate, "platform-tools"))) || "";
}

function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  options: { allowTimeout?: boolean } = {}
) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 32,
    timeout: 1000 * 60 * 30
  });
  const durationMs = Date.now() - startedAt;
  const timedOut = (result.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
  if (result.status !== 0 && !(options.allowTimeout && timedOut)) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return { timedOut, durationMs };
}

function ensurePixelGradleConfig() {
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
  next = next.replace(
    /^\s*entryFile\s*=.*$/m,
    '    entryFile = file("${projectRoot}/index.js")'
  );
  if (!/^\s*extraPackagerArgs\s*=/m.test(next)) {
    next = next.replace(
      /^(\s*entryFile\s*=.*)$/m,
      '$1\n    extraPackagerArgs = ["--max-workers", "1", "--entry-file", "${projectRoot}/index.js"]'
    );
  }
  if (next !== current) writeFileSync(appBuildGradlePath, next, "utf8");
}

async function main() {
  const options = parsePixelApkBuildCli(process.argv.slice(2));
  if (options.help) {
    console.log(formatPixelApkBuildHelp());
    return;
  }
  const { resumeAfterTimeout } = options;
  const javaHome = findJavaHome();
  const androidSdk = findAndroidSdk();
  if (!javaHome) throw new Error("JAVA_HOME_NOT_FOUND: install JDK 17 or set JAVA_HOME.");
  if (!androidSdk) throw new Error("ANDROID_SDK_NOT_FOUND: install Android SDK or set ANDROID_HOME.");
  const env = {
    ...process.env,
    NODE_PATH: [join(mobileRoot, "node_modules"), process.env.NODE_PATH].filter(Boolean).join(delimiter),
    EXPO_PUBLIC_PIXEL_LOCK: "1",
    WOORIAI_ALLOW_DEBUG_RELEASE_SIGNING: "1",
    EXPO_ROUTER_APP_ROOT: "app",
    NODE_ENV: "production",
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidSdk,
    ANDROID_SDK_ROOT: androidSdk,
    GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || gradleUserHome
  };
  if (!existsSync(gradlew)) {
    const expoPrebuildInvocation = createExpoPrebuildInvocation(process.platform, process.execPath, mobileRoot);
    if (!existsSync(expoPrebuildInvocation.args[0])) {
      throw new Error(`EXPO_CLI_NOT_FOUND ${expoPrebuildInvocation.args[0]}`);
    }
    run(expoPrebuildInvocation.command, expoPrebuildInvocation.args, mobileRoot, env);
  }
  if (!existsSync(gradlew)) throw new Error(`GRADLEW_NOT_FOUND_AFTER_PREBUILD ${gradlew}`);
  ensurePixelGradleConfig();
  const nativeBranding = await syncAndroidBrandingResources(mobileRoot, androidDir);
  // The standalone and Pixel Lock profiles share Gradle's release task outputs but embed
  // different EXPO_PUBLIC_PIXEL_LOCK values. The normal path therefore keeps the conservative
  // forced rebuild. If that bounded attempt times out, resume its partial outputs exactly once;
  // source binding and installed sentinel validation remain the final proof of the embedded bundle.
  const incrementalArgs = ["assembleRelease", "--max-workers=1", "--no-parallel", "-PreactNativeArchitectures=x86_64"];
  let args = resumeAfterTimeout ? incrementalArgs : [...incrementalArgs, "--rerun-tasks"];
  let autoResumedAfterTimeout = false;
  const buildAttempts: Array<{ task: string; result: "PASS" | "TIMEOUT_RESUME"; durationMs: number }> = [];
  const sourceBeforeBuild = computeRelease5vSourceSnapshot(repoRoot);
  verifyBuildSourceSnapshots(
    process.env.RELEASE5V_SOURCE_SNAPSHOT_SHA256,
    sourceBeforeBuild.sourceSnapshotSha256,
    sourceBeforeBuild.sourceSnapshotSha256
  );
  let gradleInvocation = createGradleInvocation(process.platform, javaHome, androidDir, gradlew, args);
  const primaryResult = run(gradleInvocation.command, gradleInvocation.args, androidDir, env, {
    allowTimeout: !resumeAfterTimeout
  });
  buildAttempts.push({
    task: args.join(" "),
    result: primaryResult.timedOut ? "TIMEOUT_RESUME" : "PASS",
    durationMs: primaryResult.durationMs
  });
  if (primaryResult.timedOut) {
    console.warn("[pixel:apk] Gradle timed out after 30 minutes; resuming partial outputs once.");
    autoResumedAfterTimeout = true;
    args = incrementalArgs;
    gradleInvocation = createGradleInvocation(process.platform, javaHome, androidDir, gradlew, args);
    const resumeResult = run(gradleInvocation.command, gradleInvocation.args, androidDir, env);
    buildAttempts.push({ task: args.join(" "), result: "PASS", durationMs: resumeResult.durationMs });
  }
  if (!existsSync(apkPath)) throw new Error(`PIXEL_APK_MISSING ${apkPath}`);
  const sourceAfterBuild = computeRelease5vSourceSnapshot(repoRoot);
  const sourceSnapshotVerification = verifyBuildSourceSnapshots(
    process.env.RELEASE5V_SOURCE_SNAPSHOT_SHA256,
    sourceBeforeBuild.sourceSnapshotSha256,
    sourceAfterBuild.sourceSnapshotSha256
  );
  const appConfig = JSON.parse(readFileSync(appJsonPath, "utf8"));
  const apkSha256 = createHash("sha256").update(readFileSync(apkPath)).digest("hex");
  const rootApkPath = join(repoRoot, `wooriai-pixel-${apkSha256}.apk`);
  copyFileSync(apkPath, rootApkPath);
  const report = {
    generatedAt: new Date().toISOString(),
    sourceCommit: sourceAfterBuild.head,
    dirty: sourceAfterBuild.dirty,
    sourceSnapshotSha256: sourceAfterBuild.sourceSnapshotSha256,
    sourceSnapshotFileCount: sourceAfterBuild.fileCount,
    sourceSnapshotNativeExplicitFileCount: sourceAfterBuild.nativeExplicitFileCount,
    sourceSnapshotVerification,
    nativeBranding,
    profile: "pixel-lock",
    apkSha256,
    packageName: appConfig.expo.android.package,
    appVersion: appConfig.expo.version,
    env: { EXPO_PUBLIC_PIXEL_LOCK: "1", EXPO_ROUTER_APP_ROOT: "app" },
    ...createPixelApkBuildResumeMetadata(resumeAfterTimeout, autoResumedAfterTimeout),
    buildAttempts,
    task: args.join(" "),
    apkPath: rootApkPath,
    gradleApkPath: apkPath
  };
  mkdirSync(join(repoRoot, "artifacts", "pixel-lock", "android", "reports"), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Pixel APK: ${rootApkPath}`);
  console.log(`Report: ${reportPath}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
