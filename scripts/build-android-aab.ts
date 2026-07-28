import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const mobileRoot = join(repoRoot, "apps", "mobile");
const androidRoot = join(mobileRoot, "android");
const gradlew = join(androidRoot, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const builtAab = join(androidRoot, "app", "build", "outputs", "bundle", "release", "app-release.aab");

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

function main() {
  const app = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8")) as {
    expo: { version: string; android: { package: string; versionCode: number } };
  };
  if (/anonymous|example|change-me/i.test(app.expo.android.package) || app.expo.version === "0.0.0" || app.expo.android.versionCode < 1) {
    throw new Error("ANDROID_APPROVED_IDENTITY_REQUIRED");
  }
  const keystorePath = required("ANDROID_SIGNING_KEYSTORE_PATH");
  if (!existsSync(keystorePath)) throw new Error("ANDROID_SIGNING_KEYSTORE_NOT_FOUND");
  required("ANDROID_SIGNING_KEY_ALIAS");
  const storePasswordEnv = required("ANDROID_SIGNING_STORE_PASSWORD_ENV");
  const keyPasswordEnv = required("ANDROID_SIGNING_KEY_PASSWORD_ENV");
  required(storePasswordEnv);
  required(keyPasswordEnv);
  const apiBaseUrl = required("EXPO_PUBLIC_API_BASE_URL");
  if (!/^https:\/\//.test(apiBaseUrl)) throw new Error("EXPO_PUBLIC_API_BASE_URL_HTTPS_REQUIRED");
  const javaHome = findJavaHome();
  const androidSdk = findAndroidSdk();
  if (!javaHome) throw new Error("JAVA_HOME_NOT_FOUND");
  if (!androidSdk) throw new Error("ANDROID_SDK_NOT_FOUND");
  if (!existsSync(gradlew)) throw new Error("GRADLEW_NOT_FOUND");

  const env = {
    ...process.env,
    NODE_PATH: [join(mobileRoot, "node_modules"), process.env.NODE_PATH].filter(Boolean).join(delimiter),
    NODE_ENV: "production",
    EXPO_PUBLIC_PIXEL_LOCK: "0",
    EXPO_PUBLIC_AUTHORITY_RECOVERY_FIXTURE: "0",
    EXPO_PUBLIC_SAFETY_ALTERNATIVE_FIXTURE: "0",
    EXPO_PUBLIC_TEST_LOGIN: "0",
    WOORIAI_BUILD_PROFILE: "production",
    EXPO_ROUTER_APP_ROOT: "app",
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidSdk,
    ANDROID_SDK_ROOT: androidSdk
  };
  const result = spawnSync(gradlew, ["bundleRelease", "--rerun-tasks"], {
    cwd: androidRoot,
    env,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 20 * 60 * 1000
  });
  if (result.status !== 0) throw new Error(`ANDROID_AAB_BUILD_FAILED\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  if (!existsSync(builtAab)) throw new Error("ANDROID_AAB_MISSING");

  const artifact = join(repoRoot, "artifacts", "android", `wooriai-${app.expo.version}-${app.expo.android.versionCode}-release.aab`);
  const report = artifact.replace(/\.aab$/, ".json");
  mkdirSync(dirname(artifact), { recursive: true });
  copyFileSync(builtAab, artifact);
  const sha256 = createHash("sha256").update(readFileSync(artifact)).digest("hex");
  writeFileSync(report, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    packageName: app.expo.android.package,
    appVersion: app.expo.version,
    versionCode: app.expo.android.versionCode,
    signing: "external-production",
    sourceCommit: spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).stdout.trim(),
    sha256,
    artifact
  }, null, 2)}\n`);
  console.log(`Signed AAB: ${artifact}`);
  console.log(`SHA-256: ${sha256}`);
}

main();
