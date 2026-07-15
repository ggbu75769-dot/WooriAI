import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const mobileRoot = join(repoRoot, "apps", "mobile");
const androidDir = join(repoRoot, "apps", "mobile", "android");
const gradleUserHome = join(repoRoot, ".gradle-home");
const reportPath = join(repoRoot, "artifacts", "pixel-lock", "android", "reports", "pixel-apk.json");
const gradlew = join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const appBuildGradlePath = join(androidDir, "app", "build.gradle");
const apkPath = join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk");
const appJsonPath = join(repoRoot, "apps", "mobile", "app.json");

function gitOutput(args: string[]) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed\n${result.stderr ?? ""}`);
  }
  return String(result.stdout ?? "").trim();
}

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

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 1024 * 1024 * 32,
    timeout: 1000 * 60 * 15
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return result;
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
    next = next.replace(/^react\s*\{\s*$/m, "react {\n    root = file(workspaceRoot)");
  } else {
    next = next.replace(/^\s*root\s*=.*$/m, "    root = file(workspaceRoot)");
  }
  next = next.replace(
    /^\s*entryFile\s*=.*$/m,
    '    entryFile = file("${workspaceRoot}/apps/mobile/index.js")'
  );
  if (!/^\s*extraPackagerArgs\s*=/m.test(next)) {
    next = next.replace(
      /^(\s*entryFile\s*=.*)$/m,
      '$1\n    extraPackagerArgs = ["--max-workers", "1", "--entry-file", "${projectRoot}/index.js"]'
    );
  }
  if (next !== current) writeFileSync(appBuildGradlePath, next, "utf8");
}

function main() {
  const sourceCommit = gitOutput(["rev-parse", "HEAD"]);
  const dirty = gitOutput(["status", "--porcelain"]).length > 0;
  const env = {
    ...process.env,
    EXPO_PUBLIC_PIXEL_LOCK: "1",
    WOORIAI_ALLOW_DEBUG_RELEASE_SIGNING: "1",
    EXPO_ROUTER_APP_ROOT: "apps/mobile/app",
    NODE_ENV: "production",
    JAVA_HOME: findJavaHome(),
    ANDROID_HOME: findAndroidSdk(),
    ANDROID_SDK_ROOT: findAndroidSdk(),
    GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || gradleUserHome
  };
  if (!env.JAVA_HOME) throw new Error("JAVA_HOME_NOT_FOUND: install JDK 17 or set JAVA_HOME.");
  if (!env.ANDROID_HOME) throw new Error("ANDROID_SDK_NOT_FOUND: install Android SDK or set ANDROID_HOME.");
  if (!existsSync(gradlew)) {
    run("pnpm", ["exec", "expo", "prebuild", "--platform", "android", "--no-install"], mobileRoot, env);
  }
  if (!existsSync(gradlew)) throw new Error(`GRADLEW_NOT_FOUND_AFTER_PREBUILD ${gradlew}`);
  ensurePixelGradleConfig();
  const args = ["assembleRelease", "-PreactNativeArchitectures=x86_64"];
  if (process.env.PIXEL_ANDROID_RERUN_TASKS === "1") args.push("--rerun-tasks");
  run(gradlew, args, androidDir, env);
  if (!existsSync(apkPath)) throw new Error(`PIXEL_APK_MISSING ${apkPath}`);
  const appConfig = JSON.parse(readFileSync(appJsonPath, "utf8"));
  const apkSha256 = createHash("sha256").update(readFileSync(apkPath)).digest("hex");
  const report = {
    generatedAt: new Date().toISOString(),
    sourceCommit,
    dirty,
    profile: "pixel-lock",
    apkSha256,
    packageName: appConfig.expo.android.package,
    appVersion: appConfig.expo.version,
    env: { EXPO_PUBLIC_PIXEL_LOCK: "1", EXPO_ROUTER_APP_ROOT: "apps/mobile/app" },
    task: args.join(" "),
    apkPath
  };
  mkdirSync(join(repoRoot, "artifacts", "pixel-lock", "android", "reports"), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Pixel APK: ${apkPath}`);
  console.log(`Report: ${reportPath}`);
}

main();
