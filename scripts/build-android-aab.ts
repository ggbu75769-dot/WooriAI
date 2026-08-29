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

/* ---------------------------------------------------------------------------
 * 라운드 73 트랙 A(GAP-073 #1ⓑⓓ) — **실사용자 빌드가 요구하는 EXPO_PUBLIC_* 한 자리.**
 *
 * 종전 이 스크립트가 fail-closed로 물은 EXPO_PUBLIC_*는 API 주소 **하나**였다. 그 하나에는
 * 이유가 적혀 있었다 — "없으면 조용히 localhost dev 기본값이 실린다". 그런데 앱이 읽는 나머지
 * 키들도 성질이 같은데(없어도 빌드는 끝까지 성공하고, 앱은 조용히 다른 것을 한다) 아무도 묻지
 * 않았다. 그래서 카카오 키·약관 URL 없이 만든 AAB가 Play까지 올라갈 수 있었다.
 *
 * `buildChildEnv`가 `...process.env`를 펼치므로 값이 있으면 실린다 — 이 목록이 하는 일은
 * **없을 때 빌드를 끝내지 않는 것**이고, 키마다 "없으면 사용자가 무엇을 잃는가"를 값으로 진다.
 * 그 한 줄이 곧 거부 메시지다(DNC-019: 키 이름과 이유만 — 값은 어떤 경로로도 출력하지 않는다).
 *
 * 강제와 선택을 나눈다:
 *  - **필수**: 없으면 앱이 오동작하거나(카카오) 읽지 못한 문서에 동의시킨다(약관·개인정보).
 *  - **명시 opt-out**: 지원·FAQ는 페이지 호스팅이 사용자 자산이라 없을 수 있다. 다만
 *    조용히 통과시키지 않는다 — `WOORIAI_ALLOW_MISSING_SUPPORT_LINKS=1`로 **적어야** 지나가고,
 *    그때 무엇을 잃는지 출력한다(L-3이 예고한 그 상태를 침묵으로 두지 않는다).
 * ------------------------------------------------------------------------- */
type PublicEnvRequirement = {
  key: string;
  /** 없으면 사용자가 무엇을 잃는가. 거부 메시지에 그대로 실린다. */
  loss: string;
  /** 열 수 있는 http(s) 주소여야 하는 키(앱의 normalize 규칙과 같은 판정). */
  httpUrl?: true;
};

const RELEASE_REQUIRED_PUBLIC_ENV: PublicEnvRequirement[] = [
  {
    key: "EXPO_PUBLIC_KAKAO_ENABLED",
    loss:
      '"1"이 아니면 앱이 실 카카오 대신 개발 스텁 경로로 로그인합니다 — 실사용자는 서버의 501(OAUTH_LOGIN_NOT_IMPLEMENTED)만 받고 ' +
      "첫 화면에서 가입 자체를 못 합니다."
  },
  {
    key: "EXPO_PUBLIC_KAKAO_CLIENT_ID",
    loss: "카카오 앱 키가 없으면 실 카카오 로그인이 켜지지 않습니다(위와 같은 결과 — 실사용자가 가입할 수 없습니다)."
  },
  {
    key: "EXPO_PUBLIC_KAKAO_REDIRECT_URI",
    loss:
      "리다이렉트 URI가 없으면 실 카카오 로그인이 켜지지 않습니다. 카카오 콘솔과 서버의 OAUTH_KAKAO_REDIRECT_URIS 양쪽에 등록된 값이어야 합니다."
  },
  {
    key: "EXPO_PUBLIC_TERMS_URL",
    loss: "로그인 화면의 이용약관 [보기] 링크가 서지 않습니다 — 사용자가 **읽지 못한 문서에 필수 동의**하게 됩니다.",
    httpUrl: true
  },
  {
    key: "EXPO_PUBLIC_PRIVACY_POLICY_URL",
    loss:
      "개인정보처리방침 [보기] 링크가 서지 않습니다 — 읽지 못한 문서에 필수 동의하게 되고, Play 등록 URL과 같은 값이어야 합니다.",
    httpUrl: true
  }
];

/** 명시 opt-out 플래그. 값이 "1"일 때만 아래 둘의 부재가 빌드를 통과한다. */
const SUPPORT_LINKS_OPT_OUT = "WOORIAI_ALLOW_MISSING_SUPPORT_LINKS";

const RELEASE_OPTIONAL_PUBLIC_ENV: PublicEnvRequirement[] = [
  {
    key: "EXPO_PUBLIC_SUPPORT_URL",
    loss: "더보기·설정의 [고객 지원] 행이 서지 않습니다 — 앱 안에 도움으로 가는 길이 0건인 채로 나갑니다.",
    httpUrl: true
  },
  {
    key: "EXPO_PUBLIC_FAQ_URL",
    loss: "더보기·설정의 [자주 묻는 질문] 행이 서지 않습니다 — 앱 안에 도움으로 가는 길이 0건인 채로 나갑니다.",
    httpUrl: true
  }
];

/** 앱의 normalize 규칙과 같은 판정(src/consent/legal-links.ts · src/settings/support-links.ts). */
function assertHttpUrl(spec: PublicEnvRequirement) {
  if (!spec.httpUrl) return;
  const value = process.env[spec.key] ?? "";
  if (!/^https?:\/\/\S+$/i.test(value.trim())) {
    // 값은 출력하지 않는다(DNC-019) — 앱이 그 값을 어떻게 볼지만 말한다.
    throw new Error(
      `${spec.key}_NOT_HTTP_URL: 앱은 http(s):// 주소만 링크로 인정합니다(그 밖의 값은 주입되지 않은 것과 같이 취급합니다). ${spec.loss}`
    );
  }
}

/** 실사용자 빌드가 갖춰야 할 EXPO_PUBLIC_*를 fail-closed로 확인한다. */
function validateReleasePublicEnv() {
  // 목록이 비면 이 관문은 아무것도 묻지 않는 관문이 된다 — 그 상태를 조용히 두지 않는다.
  if (RELEASE_REQUIRED_PUBLIC_ENV.length === 0) {
    throw new Error(
      "RELEASE_PUBLIC_ENV_LIST_EMPTY: 실사용자 빌드가 요구하는 EXPO_PUBLIC_* 목록이 비어 있습니다 " +
        "(scripts/build-android-aab.ts의 RELEASE_REQUIRED_PUBLIC_ENV)."
    );
  }
  for (const spec of RELEASE_REQUIRED_PUBLIC_ENV) {
    requireEnv(spec.key, spec.loss);
    assertHttpUrl(spec);
  }
  // 카카오는 "주입됐는가"가 아니라 "켜졌는가"를 묻는다 — 앱의 getKakaoEnvConfig()가 셋 중
  // ENABLED만 "1" 비교이고, "0"이면 나머지 둘이 있어도 개발 스텁 경로가 선다.
  if (process.env.EXPO_PUBLIC_KAKAO_ENABLED !== "1") {
    throw new Error(
      `EXPO_PUBLIC_KAKAO_ENABLED_NOT_ENABLED: ${RELEASE_REQUIRED_PUBLIC_ENV[0].loss} (허용 값은 "1" 하나입니다.)`
    );
  }

  const missingOptional = RELEASE_OPTIONAL_PUBLIC_ENV.filter((spec) => !process.env[spec.key]?.trim());
  const optedOut = process.env[SUPPORT_LINKS_OPT_OUT] === "1";
  if (missingOptional.length > 0 && !optedOut) {
    throw new Error(
      `${missingOptional[0].key}_REQUIRED: ${missingOptional[0].loss} ` +
        `도움 페이지 없이 내보내려면 ${SUPPORT_LINKS_OPT_OUT}=1로 명시하세요(그 선택은 아래 손실 안내와 함께 기록됩니다).`
    );
  }
  // opt-out으로 지나가더라도 **무엇을 잃는지는 출력한다**(침묵 통과 금지).
  for (const spec of missingOptional) {
    console.warn(`[android:build-aab] ${SUPPORT_LINKS_OPT_OUT}=1 — ${spec.key} 없이 빌드합니다. ${spec.loss}`);
  }
  for (const spec of RELEASE_OPTIONAL_PUBLIC_ENV) {
    if (process.env[spec.key]?.trim()) assertHttpUrl(spec);
  }
}

// AAB는 항상 실사용자(production) 빌드다 — standalone/demo 프로필 없음.
// keystore 경로는 절대경로로 정규화해서 넘긴다(gradle file()이 상대경로를 app/ 기준으로 풀기 때문).
function validateEnv(): SigningEnv {
  const keystoreRaw = requireEnv(
    "WOORIAI_UPLOAD_KEYSTORE",
    "업로드 keystore 파일 경로가 필요합니다. 생성(레포 밖에 두고 반드시 2곳 백업 — 분실 시 앱 영구 업데이트 불가): " +
      "keytool -genkeypair -v -keystore $HOME/wooriai-release.keystore -alias wooriai -keyalg RSA -keysize 4096 " +
      "-validity 10000 (docs/5차/launch-72h-plan.md §3.1)"
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

  // 라운드 73 트랙 A: 서명·정체성 다음은 **실사용자가 첫 화면에서 받는 것**이다.
  validateReleasePublicEnv();

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

// 4차 리뷰 F2: 비밀값 누출 검사는 파일 전체가 아니라 "이 파이프라인이 쓰는 영역"(plugin의
// REL-011 주입 블록)에만 적용한다. 전체 includes 검사는 RN 템플릿에 원래 있던 리터럴과
// 비밀번호가 우연히 같기만 해도(예: debug keystore 비밀번호 "android") 오탐으로 빌드를 막았다.
// 비밀값을 gradle 파일에 쓸 수 있는 코드는 plugin 주입뿐이므로, 주입 블록만 검사해도
// 실제 누출(주입 블록 안의 비밀값 리터럴)에는 여전히 fail-closed다.
const INJECTED_SIGNING_MARKER = "// REL-011 자동 주입 (plugins/with-wooriai-android-release.js)";
const INJECTED_BUILDTYPE_MARKER = "// REL-011: gradle 실행 시점에 env가 있으면 업로드 keystore 서명";

// marker부터 isEnd를 만족하는 첫 줄까지(포함)를 잘라 반환. marker가 없으면 "".
function collectInjectedRegion(gradle: string, marker: string, isEnd: (line: string) => boolean): string {
  const start = gradle.indexOf(marker);
  if (start === -1) return "";
  const collected: string[] = [];
  for (const line of gradle.slice(start).split("\n")) {
    collected.push(line);
    if (isEnd(line)) break;
  }
  return collected.join("\n");
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
  const injectedRegions = [
    // signingConfigs.release 주입 블록: 마커 주석부터 if 블록 닫힘까지 (storeFile~keyPassword 포함).
    collectInjectedRegion(gradle, INJECTED_SIGNING_MARKER, (line) => line.trim() === "}"),
    // release buildType 서명 전환: 마커 주석부터 signingConfig ternary 라인까지.
    collectInjectedRegion(gradle, INJECTED_BUILDTYPE_MARKER, (line) => line.includes("signingConfig "))
  ];
  if (injectedRegions.some((region) => region === "")) {
    // 마커가 없으면 검사가 헛돌게 되므로 fail-closed로 즉시 실패시킨다.
    throw new Error(
      "SIGNING_INJECTION_MARKER_MISSING: app/build.gradle에서 REL-011 주입 마커 주석을 찾지 못했습니다. " +
        "plugins/with-wooriai-android-release.js 변경 여부를 확인하세요."
    );
  }
  // 주석 줄은 plugin이 쓰는 고정 텍스트라 비밀값이 들어갈 수 없는데, "android" 같은 흔한
  // 단어(파일명·명령어)를 포함하므로 검사 대상에서 제외한다. 실제 누출은 값 줄(storePassword 등)에
  // 리터럴로 나타나며 그 줄들은 전부 검사한다.
  const injectedText = injectedRegions
    .join("\n")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  for (const secret of [signing.keystorePassword, signing.keyPassword]) {
    if (injectedText.includes(secret)) {
      throw new Error(
        "SECRET_LEAKED_INTO_GRADLE: 비밀번호 문자열이 app/build.gradle의 REL-011 주입 블록에서 발견됐습니다 " +
          "(누출 또는 흔한 gradle 문자열과의 충돌). 즉시 파일을 확인하세요."
      );
    }
  }
}

/** REL-120: RN gradle plugin은 JDK 17 툴체인을 요구한다. JAVA_HOME이 다른 메이저(예: 21)를
 *  가리키면 gradle 깊은 단계에서 늦게 실패하므로, release 파일의 버전 문자열로 미리 검사해
 *  17이 아니면 폴백 탐색으로 넘어가고 경고를 남긴다(진단 시간 단축). */
function javaMajorVersionOf(home: string): number | null {
  try {
    const release = readFileSync(join(home, "release"), "utf8");
    const match = release.match(/JAVA_VERSION="(\d+)/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function findJavaHome() {
  if (process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) {
    const major = javaMajorVersionOf(process.env.JAVA_HOME);
    if (major === null || major === 17) return process.env.JAVA_HOME;
    console.warn(
      `[android:build-aab] JAVA_HOME이 JDK ${major}을 가리킵니다 — RN gradle plugin은 17이 필요해 폴백 탐색합니다.`
    );
  }
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
