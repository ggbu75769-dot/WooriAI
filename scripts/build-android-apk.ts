import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const androidDir = join(repoRoot, "apps", "mobile", "android");
const gradleUserHome = join(repoRoot, ".gradle-home");
const gradlew = join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const builtApkPath = join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk");

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
  // 4차 리뷰 F6: windows 외에 linux/mac 공통 설치 경로도 폴백 탐색한다.
  const roots = [
    "C:\\Program Files\\Eclipse Adoptium",
    "C:\\Program Files\\Java",
    "C:\\Program Files\\Microsoft",
    "/usr/lib/jvm",
    "/usr/java",
    "/opt/java",
    "/Library/Java/JavaVirtualMachines"
  ];
  const javaBinary = process.platform === "win32" ? "java.exe" : "java";
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const match = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /17/.test(entry.name) && /jdk|java/i.test(entry.name))
      .map((entry) => join(root, entry.name))
      // mac은 <jdk>/Contents/Home 밑에 bin/java가 있다.
      .flatMap((candidate) => [candidate, join(candidate, "Contents", "Home")])
      .find((candidate) => existsSync(join(candidate, "bin", javaBinary)));
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

  const profile = parseProfile();
  const artifactPath = join(repoRoot, "artifacts", "android", `wooriai-0.0.0-release-${profile}.apk`);
  const reportPath = join(repoRoot, "artifacts", "android", `wooriai-0.0.0-release-${profile}.json`);

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

  // 4차 리뷰 F1: AAB 빌드(REL-011) 후 셸에 WOORIAI_UPLOAD_* 가 export된 채 남아 있으면
  // standalone/demo APK가 Play 업로드 키로 서명되거나(일부만 남은 env면 불투명한 gradle 실패),
  // 의도치 않은 서명이 나간다. APK 빌드는 항상 debug 서명이어야 하므로 자식 env에서 전부 제거한다.
  const inheritedEnv: NodeJS.ProcessEnv = { ...process.env };
  const strippedUploadKeys = Object.keys(inheritedEnv).filter((key) => key.startsWith("WOORIAI_UPLOAD_"));
  for (const key of strippedUploadKeys) delete inheritedEnv[key];
  if (strippedUploadKeys.length > 0) {
    console.log(
      `WOORIAI_UPLOAD_* env ${strippedUploadKeys.length}개를 APK 빌드에서 제거했습니다 (debug 서명 유지): ${strippedUploadKeys.join(", ")}`
    );
  }

  const env = {
    ...inheritedEnv,
    EXPO_PUBLIC_PIXEL_LOCK: "0",
    EXPO_PUBLIC_TEST_LOGIN: profileTestLoginEnv[profile],
    EXPO_ROUTER_APP_ROOT: "apps/mobile/app",
    NODE_ENV: "production",
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidSdk,
    ANDROID_SDK_ROOT: androidSdk,
    GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || gradleUserHome,
    ...(apiBaseUrl ? { EXPO_PUBLIC_API_BASE_URL: apiBaseUrl } : {})
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
        profile,
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
