import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const mobileRoot = join(repoRoot, "apps", "mobile");
const androidDir = join(repoRoot, "apps", "mobile", "android");
const gradleUserHome = join(repoRoot, ".gradle-home");
const gradlew = join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const builtApkPath = join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk");
const appBuildGradlePath = join(androidDir, "app", "build.gradle");

type BuildProfile = "standalone" | "production";

// "standalone" is the existing demo build: local test login is force-enabled so the APK is
// usable without a real backend. "production" is a real-user build: test login must be off and
// a real API base URL is required so the app can never silently ship pointed at localhost.
const profileTestLoginEnv: Record<BuildProfile, "1" | "0"> = {
  standalone: "1",
  production: "0"
};

function parseProfile(): BuildProfile {
  const args = process.argv.slice(2);
  const flagIndex = args.indexOf("--profile");
  const flagValue = flagIndex !== -1 ? args[flagIndex + 1] : undefined;
  const inlineArg = args.find((arg) => arg.startsWith("--profile="));
  const inlineValue = inlineArg ? inlineArg.slice("--profile=".length) : undefined;
  // No flag/env at all preserves the historical default (standalone) so existing callers of
  // `pnpm android:build-apk` keep working unchanged.
  const requested = flagValue ?? inlineValue ?? process.env.BUILD_PROFILE ?? "standalone";

  if (requested !== "standalone" && requested !== "production") {
    throw new Error(`UNKNOWN_BUILD_PROFILE: "${requested}" (expected "standalone" or "production")`);
  }
  return requested;
}

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
    shell: process.platform === "win32",
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
    next = next.replace(/^react\s*\{\s*$/m, "react {\n    root = file(workspaceRoot)");
  } else {
    next = next.replace(/^\s*root\s*=.*$/m, "    root = file(workspaceRoot)");
  }
  next = next.replace(/^\s*entryFile\s*=.*$/m, '    entryFile = file("${workspaceRoot}/apps/mobile/index.js")');
  if (!/^\s*extraPackagerArgs\s*=/m.test(next)) {
    next = next.replace(
      /^(\s*entryFile\s*=.*)$/m,
      '$1\n    extraPackagerArgs = ["--max-workers", "1", "--entry-file", "${projectRoot}/index.js"]'
    );
  }
  if (next !== current) writeFileSync(appBuildGradlePath, next, "utf8");
}

function main() {
  const profile = parseProfile();
  const appConfig = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8")) as {
    expo: { version: string; android: { package: string; versionCode: number } };
  };
  const artifactPath = join(repoRoot, "artifacts", "android", `wooriai-${appConfig.expo.version}-release-${profile}.apk`);
  const reportPath = join(repoRoot, "artifacts", "android", `wooriai-${appConfig.expo.version}-release-${profile}.json`);

  const javaHome = findJavaHome();
  const androidSdk = findAndroidSdk();
  if (!javaHome) throw new Error("JAVA_HOME_NOT_FOUND: install JDK 17 or set JAVA_HOME.");
  if (!androidSdk) throw new Error("ANDROID_SDK_NOT_FOUND: install Android SDK or set ANDROID_HOME.");

  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (profile === "production" && !apiBaseUrl) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE_URL_REQUIRED: the production profile refuses to build without a real API base URL " +
        "(set EXPO_PUBLIC_API_BASE_URL) -- otherwise the app would silently fall back to the localhost dev default."
    );
  }

  const env = {
    ...process.env,
    EXPO_PUBLIC_PIXEL_LOCK: "0",
    EXPO_PUBLIC_TEST_LOGIN: profileTestLoginEnv[profile],
    EXPO_ROUTER_APP_ROOT: "apps/mobile/app",
    NODE_ENV: "production",
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidSdk,
    ANDROID_SDK_ROOT: androidSdk,
    GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || gradleUserHome,
    ...(profile === "standalone" ? { WOORIAI_ALLOW_DEBUG_RELEASE_SIGNING: "1" } : {}),
    ...(apiBaseUrl ? { EXPO_PUBLIC_API_BASE_URL: apiBaseUrl } : {})
  };
  if (!existsSync(gradlew)) {
    run("pnpm", ["exec", "expo", "prebuild", "--platform", "android", "--no-install"], mobileRoot, env);
  }
  if (!existsSync(gradlew)) throw new Error(`GRADLEW_NOT_FOUND_AFTER_PREBUILD ${gradlew}`);
  ensureWorkspaceGradleConfig();
  const args = ["assembleRelease", "--rerun-tasks"];
  const result = spawnSync(gradlew, args, {
    cwd: androidDir,
    env,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 1024 * 1024 * 32,
    timeout: 1000 * 60 * 20
  });
  if (result.status !== 0) {
    throw new Error(`${gradlew} ${args.join(" ")} failed\n${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  if (!existsSync(builtApkPath)) throw new Error(`RELEASE_APK_MISSING ${builtApkPath}`);

  mkdirSync(dirname(artifactPath), { recursive: true });
  copyFileSync(builtApkPath, artifactPath);
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
          EXPO_ROUTER_APP_ROOT: "apps/mobile/app",
          ...(apiBaseUrl ? { EXPO_PUBLIC_API_BASE_URL: apiBaseUrl } : {})
        },
        task: args.join(" "),
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

main();
