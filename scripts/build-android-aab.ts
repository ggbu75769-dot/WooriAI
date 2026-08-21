// REL-011: Play 제출용 서명된 AAB 원커맨드 빌드 파이프라인.
//   pnpm android:build-aab            → prebuild + gradle :app:bundleRelease (서명 AAB 산출)
//   pnpm android:build-aab -- --check → gradle만 제외한 전 단계 검증 (Android SDK 없는 환경용)
//
// 서명 비밀값은 env로만 전달되고 gradle 파일에는 System.getenv 참조만 남는다
// (주입 로직: apps/mobile/plugins/with-wooriai-android-release.js).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const mobileDir = join(repoRoot, "apps", "mobile");
const androidDir = join(mobileDir, "android");
const gradleUserHome = join(repoRoot, ".gradle-home");
const gradlew = join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const appBuildGradlePath = join(androidDir, "app", "build.gradle");
const builtAabPath = join(androidDir, "app", "build", "outputs", "bundle", "release", "app-release.aab");

interface SigningEnv {
  keystorePath: string;
  keystorePassword: string;
  keyAlias: string;
  keyPassword: string;
  apiBaseUrl: string;
  androidPackage: string;
  appVersion: string;
  versionCode: string;
}

function parseCheckOnly(): boolean {
  return process.argv.slice(2).includes("--check");
}

function requireEnv(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED: ${hint}`);
  return value;
}

// AAB는 항상 실사용자(production) 빌드다 — standalone/demo 프로필 없음.
// keystore 경로는 절대경로로 정규화해서 넘긴다(gradle file()이 상대경로를 app/ 기준으로 풀기 때문).
function validateEnv(): SigningEnv {
  const keystoreRaw = requireEnv(
    "WOORIAI_UPLOAD_KEYSTORE",
    "업로드 keystore 파일 경로가 필요합니다. 생성: keytool -genkeypair -v -keystore wooriai-release.keystore " +
      "-alias wooriai -keyalg RSA -keysize 4096 -validity 10000 (docs/5차/launch-72h-plan.md §3.1)"
  );
  const keystorePath = resolve(repoRoot, keystoreRaw);
  if (!existsSync(keystorePath)) {
    throw new Error(`WOORIAI_UPLOAD_KEYSTORE_NOT_FOUND: ${keystorePath} 파일이 없습니다.`);
  }
  const keystorePassword = requireEnv("WOORIAI_UPLOAD_KEYSTORE_PASSWORD", "keystore 저장소 비밀번호가 필요합니다.");
  const keyAlias = requireEnv("WOORIAI_UPLOAD_KEY_ALIAS", 'keystore key alias가 필요합니다 (예: "wooriai").');
  const keyPassword = requireEnv("WOORIAI_UPLOAD_KEY_PASSWORD", "key 비밀번호가 필요합니다.");

  const apiBaseUrl = requireEnv(
    "EXPO_PUBLIC_API_BASE_URL",
    "Play 제출용 AAB는 실 API 주소 없이는 빌드를 거부합니다 — 그렇지 않으면 localhost dev 기본값이 조용히 실릴 수 있습니다."
  );
  if (!apiBaseUrl.startsWith("https://")) {
    throw new Error(
      `EXPO_PUBLIC_API_BASE_URL_NOT_HTTPS: "${apiBaseUrl}" — Play 제출용 빌드는 https:// API 주소만 허용합니다 ` +
        "(cleartext는 network_security_config가 차단)."
    );
  }

  const androidPackage = requireEnv("WOORIAI_ANDROID_PACKAGE", "확정 패키지명이 필요합니다 (예: kr.wooriai.app).");
  const appVersion = requireEnv("WOORIAI_APP_VERSION", "스토어 표기 버전이 필요합니다 (예: 1.0.0).");
  const versionCode = requireEnv("WOORIAI_ANDROID_VERSION_CODE", "Play 업로드마다 증가하는 정수가 필요합니다 (예: 1).");
  if (!/^\d+$/.test(versionCode) || Number.parseInt(versionCode, 10) <= 0) {
    throw new Error(`WOORIAI_ANDROID_VERSION_CODE_INVALID: "${versionCode}" (양의 정수만 허용)`);
  }

  return { keystorePath, keystorePassword, keyAlias, keyPassword, apiBaseUrl, androidPackage, appVersion, versionCode };
}

function buildChildEnv(signing: SigningEnv): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // AAB는 production 고정: 테스트 로그인 금지, pixel-lock 계측 금지.
    EXPO_PUBLIC_PIXEL_LOCK: "0",
    EXPO_PUBLIC_TEST_LOGIN: "0",
    EXPO_ROUTER_APP_ROOT: "apps/mobile/app",
    NODE_ENV: "production",
    EXPO_PUBLIC_API_BASE_URL: signing.apiBaseUrl,
    WOORIAI_ANDROID_PACKAGE: signing.androidPackage,
    WOORIAI_APP_VERSION: signing.appVersion,
    WOORIAI_ANDROID_VERSION_CODE: signing.versionCode,
    // 절대경로로 정규화된 keystore — prebuild(플러그인 게이트)와 gradle(System.getenv) 양쪽에서 사용.
    WOORIAI_UPLOAD_KEYSTORE: signing.keystorePath,
    WOORIAI_UPLOAD_KEYSTORE_PASSWORD: signing.keystorePassword,
    WOORIAI_UPLOAD_KEY_ALIAS: signing.keyAlias,
    WOORIAI_UPLOAD_KEY_PASSWORD: signing.keyPassword
  };
}

function runPrebuild(env: NodeJS.ProcessEnv) {
  const args = ["expo", "prebuild", "--platform", "android", "--no-install"];
  const result = spawnSync("npx", args, {
    cwd: mobileDir,
    env,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 1024 * 1024 * 32,
    timeout: 1000 * 60 * 10
  });
  if (result.status !== 0) {
    throw new Error(`npx ${args.join(" ")} failed\n${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
}

// prebuild가 실제로 서명 구성을 주입했는지 + 비밀값이 gradle 파일에 새지 않았는지 검증.
function verifySigningInjected(signing: SigningEnv) {
  if (!existsSync(appBuildGradlePath)) throw new Error(`APP_BUILD_GRADLE_MISSING ${appBuildGradlePath}`);
  const gradle = readFileSync(appBuildGradlePath, "utf8");
  const required = [
    'storeFile file(System.getenv("WOORIAI_UPLOAD_KEYSTORE"))',
    'storePassword System.getenv("WOORIAI_UPLOAD_KEYSTORE_PASSWORD")',
    'keyAlias System.getenv("WOORIAI_UPLOAD_KEY_ALIAS")',
    'keyPassword System.getenv("WOORIAI_UPLOAD_KEY_PASSWORD")',
    // env가 있으면 업로드 서명, 없으면 debug 서명 폴백(dev 흐름 보존) — plugin 주입 형태 그대로.
    'signingConfig System.getenv("WOORIAI_UPLOAD_KEYSTORE") ? signingConfigs.release : signingConfigs.debug'
  ];
  for (const line of required) {
    if (!gradle.includes(line)) {
      throw new Error(`SIGNING_CONFIG_NOT_INJECTED: app/build.gradle에 "${line}" 이(가) 없습니다. prebuild 로그를 확인하세요.`);
    }
  }
  for (const secret of [signing.keystorePassword, signing.keyPassword]) {
    if (gradle.includes(secret)) {
      throw new Error("SECRET_LEAKED_INTO_GRADLE: 비밀번호 문자열이 app/build.gradle에 그대로 들어갔습니다. 즉시 파일을 확인하세요.");
    }
  }
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

function runGradleBundleRelease(env: NodeJS.ProcessEnv) {
  if (!existsSync(gradlew)) throw new Error(`GRADLEW_NOT_FOUND ${gradlew}`);
  const javaHome = findJavaHome();
  const androidSdk = findAndroidSdk();
  if (!javaHome) throw new Error("JAVA_HOME_NOT_FOUND: install JDK 17 or set JAVA_HOME.");
  if (!androidSdk) throw new Error("ANDROID_SDK_NOT_FOUND: install Android SDK or set ANDROID_HOME.");

  const gradleEnv = {
    ...env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidSdk,
    ANDROID_SDK_ROOT: androidSdk,
    GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || gradleUserHome
  };
  const args = [":app:bundleRelease", "--rerun-tasks"];
  const result = spawnSync(gradlew, args, {
    cwd: androidDir,
    env: gradleEnv,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 1024 * 1024 * 32,
    timeout: 1000 * 60 * 20
  });
  if (result.status !== 0) {
    throw new Error(`${gradlew} ${args.join(" ")} failed\n${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  if (!existsSync(builtAabPath)) throw new Error(`RELEASE_AAB_MISSING ${builtAabPath}`);
}

function main() {
  const checkOnly = parseCheckOnly();
  const signing = validateEnv();
  const env = buildChildEnv(signing);

  console.log(`[1/3] expo prebuild (android, 서명 구성 주입: ${signing.androidPackage} v${signing.appVersion} vc${signing.versionCode})`);
  runPrebuild(env);

  console.log("[2/3] app/build.gradle 서명 구성 검증 (System.getenv 참조 + 비밀값 미노출)");
  verifySigningInjected(signing);

  if (checkOnly) {
    console.log("[3/3] --check 모드: gradle 단계 생략");
    console.log("");
    console.log("CHECK PASS — env·prebuild·서명 주입 모두 정상.");
    console.log("실제 AAB 생성은 Android SDK + JDK 17이 있는 머신에서 같은 env로:");
    console.log("  pnpm android:build-aab");
    return;
  }

  console.log("[3/3] gradle :app:bundleRelease (서명된 AAB 생성)");
  runGradleBundleRelease(env);

  const artifactPath = join(repoRoot, "artifacts", "android", `wooriai-${signing.appVersion}-vc${signing.versionCode}-release.aab`);
  const reportPath = join(repoRoot, "artifacts", "android", `wooriai-${signing.appVersion}-vc${signing.versionCode}-release.aab.json`);
  mkdirSync(dirname(artifactPath), { recursive: true });
  copyFileSync(builtAabPath, artifactPath);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        task: ":app:bundleRelease --rerun-tasks",
        // 비밀값(비밀번호)은 리포트에 절대 기록하지 않는다.
        env: {
          EXPO_PUBLIC_API_BASE_URL: signing.apiBaseUrl,
          WOORIAI_ANDROID_PACKAGE: signing.androidPackage,
          WOORIAI_APP_VERSION: signing.appVersion,
          WOORIAI_ANDROID_VERSION_CODE: signing.versionCode,
          WOORIAI_UPLOAD_KEYSTORE: signing.keystorePath,
          EXPO_PUBLIC_TEST_LOGIN: "0",
          EXPO_PUBLIC_PIXEL_LOCK: "0"
        },
        aabPath: artifactPath
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("");
  console.log(`서명된 AAB: ${artifactPath}`);
  console.log(`(gradle 원본: ${builtAabPath})`);
  console.log(`리포트: ${reportPath}`);
  console.log("");
  console.log("다음 단계 (docs/5차/launch-72h-plan.md §4):");
  console.log("  1. Play Console → 테스트 → 내부 테스트 → 새 릴리스 만들기 → 위 .aab 업로드");
  console.log("  2. 내부 테스터로 자가 설치 → 핵심 루프 1회 완주 확인");
  console.log("  3. 데이터 안전 설문·스토어 자산 완료 후 심사 제출");
  console.log(`  4. 다음 업로드 전 WOORIAI_ANDROID_VERSION_CODE를 ${Number.parseInt(signing.versionCode, 10) + 1} 이상으로 증가`);
}

main();
