import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const androidDir = join(repoRoot, "apps", "mobile", "android");
const gradleUserHome = join(repoRoot, ".gradle-home");
const gradlew = join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const builtApkPath = join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk");
const artifactPath = join(repoRoot, "artifacts", "android", "wooriai-0.0.0-release.apk");
const reportPath = join(repoRoot, "artifacts", "android", "wooriai-0.0.0-release.json");

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

function main() {
  if (!existsSync(gradlew)) throw new Error(`GRADLEW_NOT_FOUND ${gradlew}`);

  const javaHome = findJavaHome();
  const androidSdk = findAndroidSdk();
  if (!javaHome) throw new Error("JAVA_HOME_NOT_FOUND: install JDK 17 or set JAVA_HOME.");
  if (!androidSdk) throw new Error("ANDROID_SDK_NOT_FOUND: install Android SDK or set ANDROID_HOME.");

  const env = {
    ...process.env,
    EXPO_PUBLIC_PIXEL_LOCK: "0",
    EXPO_PUBLIC_TEST_LOGIN: "1",
    EXPO_ROUTER_APP_ROOT: "apps/mobile/app",
    NODE_ENV: "production",
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidSdk,
    ANDROID_SDK_ROOT: androidSdk,
    GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || gradleUserHome
  };
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
        env: {
          EXPO_PUBLIC_PIXEL_LOCK: "0",
          EXPO_PUBLIC_TEST_LOGIN: "1",
          EXPO_ROUTER_APP_ROOT: "apps/mobile/app"
        },
        task: args.join(" "),
        apkPath: artifactPath
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Standalone APK: ${artifactPath}`);
  console.log(`Report: ${reportPath}`);
}

main();
