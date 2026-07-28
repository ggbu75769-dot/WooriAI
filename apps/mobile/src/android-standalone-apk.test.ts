import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANDROID_ARCHITECTURES,
  createAndroidBuildPlan,
  validateApkNativeLibraries
} from "../../../scripts/android-build-plan";
import {
  createPixelApkBuildResumeMetadata,
  createApkArtifactMetadata,
  createExpoPrebuildInvocation,
  createGradleInvocation,
  formatAndroidBuildHelp,
  formatPixelApkBuildHelp,
  parseAndroidBuildCli,
  parsePixelApkBuildCli
} from "../../../scripts/android-build-contract";
import {
  evaluateArtifactSourceBinding,
  verifyBuildSourceSnapshots
} from "../../../scripts/lib/release5v-source-binding";

const repoRoot = join(process.cwd(), "..", "..");
const mobileRoot = process.cwd();

describe("standalone Android APK build", () => {
  it("prints help without treating pnpm's argument separator as a build option", () => {
    expect(parseAndroidBuildCli(["--", "--help"], undefined)).toEqual({
      profile: "standalone",
      cleanRequested: false,
      resumeAfterClean: false,
      help: true
    });
    expect(formatAndroidBuildHelp()).toContain("pnpm android:build-apk");
    expect(formatAndroidBuildHelp()).toContain("Output: project root");
    expect(formatAndroidBuildHelp()).toContain("--resume-after-clean");
  });

  it("rejects unknown, incomplete, and conflicting build arguments before Gradle starts", () => {
    expect(() => parseAndroidBuildCli(["--unknown"], undefined)).toThrow(/UNKNOWN_ANDROID_BUILD_ARGUMENT/);
    expect(() => parseAndroidBuildCli(["--profile"], undefined)).toThrow(/ANDROID_BUILD_PROFILE_VALUE_REQUIRED/);
    expect(() => parseAndroidBuildCli(["--clean", "--resume-after-clean"], undefined)).toThrow(
      /ANDROID_BUILD_FLAGS_CONFLICT/
    );
    expect(() => parseAndroidBuildCli([], "preview")).toThrow(/UNKNOWN_BUILD_PROFILE/);
  });

  it("rejects unknown Pixel APK build arguments before starting the long Gradle task", () => {
    expect(parsePixelApkBuildCli(["--", "--resume-after-timeout"])).toEqual({
      resumeAfterTimeout: true,
      help: false
    });
    expect(parsePixelApkBuildCli(["--help"])).toEqual({ resumeAfterTimeout: false, help: true });
    expect(() => parsePixelApkBuildCli(["--resume-after-timeoutx"])).toThrow(
      /UNKNOWN_PIXEL_APK_BUILD_ARGUMENT/
    );
    expect(formatPixelApkBuildHelp()).toContain("--resume-after-timeout");
    expect(formatPixelApkBuildHelp()).toContain("Output: project root");
  });

  it("distinguishes requested resume mode from an automatic timeout recovery", () => {
    expect(createPixelApkBuildResumeMetadata(true, false)).toEqual({
      resumeAfterTimeout: true,
      resumeModeRequested: true,
      autoResumedAfterTimeout: false
    });
    expect(createPixelApkBuildResumeMetadata(false, true)).toEqual({
      resumeAfterTimeout: true,
      resumeModeRequested: false,
      autoResumedAfterTimeout: true
    });
    expect(createPixelApkBuildResumeMetadata(false, false)).toEqual({
      resumeAfterTimeout: false,
      resumeModeRequested: false,
      autoResumedAfterTimeout: false
    });
  });

  it("creates deterministic hash and size metadata for the copied APK bytes", () => {
    expect(createApkArtifactMetadata(Buffer.from("abc"))).toEqual({
      apkSha256: "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD",
      apkBytes: 3
    });
  });

  it("invokes the Windows Gradle wrapper without a command shell", () => {
    const androidDir = "C:\\workspace\\apps\\mobile\\android";
    const invocation = createGradleInvocation(
      "win32",
      "C:\\Java\\jdk-17",
      androidDir,
      join(androidDir, "gradlew.bat"),
      ["assembleRelease", "-PreactNativeArchitectures=x86_64"]
    );

    expect(invocation.command).toBe("C:\\Java\\jdk-17\\bin\\java.exe");
    expect(invocation.args).toContain("org.gradle.wrapper.GradleWrapperMain");
    expect(invocation.args.at(-1)).toBe("-PreactNativeArchitectures=x86_64");
  });

  it("invokes the local Expo prebuild CLI through Node without a command shell", () => {
    const invocation = createExpoPrebuildInvocation(
      "win32",
      "C:\\Node\\node.exe",
      "C:\\workspace\\apps\\mobile"
    );

    expect(invocation.command).toBe("C:\\Node\\node.exe");
    expect(invocation.args).toEqual([
      "C:\\workspace\\apps\\mobile\\node_modules\\expo\\bin\\cli",
      "prebuild",
      "--platform",
      "android",
      "--no-install"
    ]);
  });

  it("builds a fresh Metro-free release APK for Android devices", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    const buildScriptPath = join(repoRoot, "scripts", "build-android-apk.ts");

    expect(packageJson.scripts["android:build-apk"]).toBe("tsx scripts/build-android-apk.ts");
    expect(existsSync(buildScriptPath)).toBe(true);

    const buildScript = readFileSync(buildScriptPath, "utf8");
    expect(buildScript).toContain('EXPO_PUBLIC_PIXEL_LOCK: "0"');
    expect(buildScript).toContain('standalone: "1"');
    expect(buildScript).toContain('production: "0"');
    expect(buildScript).toContain('EXPO_ROUTER_APP_ROOT: "app"');
    expect(buildScript).toContain('NODE_PATH: [join(mobileRoot, "node_modules"), process.env.NODE_PATH]');
    expect(buildScript).toContain("createExpoPrebuildInvocation(process.platform, process.execPath, mobileRoot)");
    const androidDir = join(mobileRoot, "android");
    const plan = createAndroidBuildPlan(androidDir, DEFAULT_ANDROID_ARCHITECTURES);
    expect(plan.taskArgs).toEqual([
      "assembleRelease",
      "--max-workers=1",
      "--no-parallel",
      "-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64"
    ]);
    expect(plan.generatedTargets).toEqual([
      join(androidDir, "app", "build"),
      join(androidDir, "build"),
      join(androidDir, ".cxx"),
      join(androidDir, "app", ".cxx")
    ]);
    expect(buildScript).toContain("const { profile, cleanRequested, resumeAfterClean } = options");
    expect(buildScript).toContain('const args = resumeAfterClean ? plannedArgs : [...plannedArgs, "--rerun-tasks"]');
    expect(buildScript).toContain("removeStaleSourceBundle");
    expect(buildScript).toContain('"assets", "index.android.bundle"');
    expect(buildScript).toContain("verifyEmbeddedBundle");
    expect(buildScript).toContain("APK_EMBEDDED_BUNDLE_MISMATCH");
    expect(buildScript).toContain("verifyEmbeddedAppConfig");
    expect(buildScript).toContain("APK_EMBEDDED_APP_CONFIG_PROFILE_MISMATCH");
    expect(buildScript).toContain("validateApkNativeLibraries");
    expect(buildScript).toContain("computeRelease5vSourceSnapshot");
    expect(buildScript).toContain("verifyBuildSourceSnapshots");
    expect(buildScript).toContain("sourceSnapshotVerification");
    expect(buildScript).toContain("await syncAndroidBrandingResources(mobileRoot, androidDir)");
    expect(buildScript).toContain("nativeBranding");
    expect(buildScript).toContain("parseAndroidBuildCli(process.argv.slice(2), process.env.BUILD_PROFILE)");
    expect(buildScript).toContain("createApkArtifactMetadata(readFileSync(artifactPath))");
    expect(buildScript).toContain("...apkArtifactMetadata");
    expect(buildScript).not.toContain('shell: process.platform === "win32"');
    expect(buildScript).not.toContain("reactNativeArchitectures=x86_64");
    expect(buildScript).toContain("wooriai-${appConfig.expo.version}-release-${profile}.apk");
    expect(buildScript).toContain(
      'const artifactPath = join(repoRoot, `wooriai-${appConfig.expo.version}-release-${profile}.apk`)'
    );
    expect(buildScript).not.toContain(
      'join(repoRoot, "artifacts", "android", `wooriai-${appConfig.expo.version}-release-${profile}.apk`)'
    );
    expect(buildScript).toContain('readFileSync(join(mobileRoot, "app.json"), "utf8")');
    expect(buildScript).toContain(
      'extraPackagerArgs = ["--max-workers", "1", "--reset-cache", "--entry-file", "${projectRoot}/index.js"]'
    );
  });

  it("rejects an APK that advertises an ABI without the Expo native core needed at JS startup", () => {
    expect(() => validateApkNativeLibraries([
      "lib/arm64-v8a/libexpo-modules-core.so",
      "lib/arm64-v8a/libhermes.so",
      "lib/arm64-v8a/libreactnative.so",
      "lib/x86_64/libhermes.so",
      "lib/x86_64/libreactnative.so"
    ])).toThrow(/APK_NATIVE_LIBRARY_INCOMPLETE.*x86_64.*libexpo-modules-core\.so/);
  });

  it("accepts only when every packaged ABI carries Expo core, Hermes, and React Native", () => {
    expect(validateApkNativeLibraries([
      "lib/arm64-v8a/libexpo-modules-core.so",
      "lib/arm64-v8a/libhermes.so",
      "lib/arm64-v8a/libreactnative.so",
      "lib/x86_64/libexpo-modules-core.so",
      "lib/x86_64/libhermes.so",
      "lib/x86_64/libreactnative.so"
    ])).toEqual({
      abis: ["arm64-v8a", "x86_64"],
      requiredLibraries: ["libexpo-modules-core.so", "libhermes.so", "libreactnative.so"]
    });
  });

  it("rejects stale or mutable source provenance instead of trusting a reported hash", () => {
    const expected = "A".repeat(64);
    const changed = "B".repeat(64);

    expect(() => verifyBuildSourceSnapshots(expected, changed, changed)).toThrow(
      /SOURCE_SNAPSHOT_EXPECTED_MISMATCH/
    );
    expect(() => verifyBuildSourceSnapshots(undefined, expected, changed)).toThrow(
      /SOURCE_CHANGED_DURING_ANDROID_BUILD/
    );
    expect(evaluateArtifactSourceBinding(expected, undefined, expected)).toBe("UNVERIFIED");
    expect(evaluateArtifactSourceBinding(expected, "VERIFIED_STABLE", changed)).toBe("STALE");
  });

  it("defaults to the standalone (test-login) profile when no --profile flag is given", () => {
    expect(parseAndroidBuildCli([], undefined).profile).toBe("standalone");
    expect(parseAndroidBuildCli([], "production").profile).toBe("production");
    expect(parseAndroidBuildCli(["--profile=standalone"], "production").profile).toBe("standalone");
  });

  it("requires EXPO_PUBLIC_API_BASE_URL for the production profile instead of silently building against localhost", () => {
    const buildScriptPath = join(repoRoot, "scripts", "build-android-apk.ts");
    const buildScript = readFileSync(buildScriptPath, "utf8");

    expect(buildScript).toContain('profile === "production" && !apiBaseUrl');
    expect(buildScript).toContain("EXPO_PUBLIC_API_BASE_URL_REQUIRED");
  });

  it("blocks cleartext traffic except for local development hosts", () => {
    const appConfig = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8"));
    const pluginPath = join(mobileRoot, "plugins", "with-network-security-config.js");
    expect(appConfig.expo.plugins).toContain("./plugins/with-network-security-config");
    expect(existsSync(pluginPath)).toBe(true);

    const networkSecurityConfig = readFileSync(pluginPath, "utf8");
    expect(networkSecurityConfig).toContain('cleartextTrafficPermitted="false"');
    expect(networkSecurityConfig).toContain(">10.0.2.2<");
    expect(networkSecurityConfig).toContain(">localhost<");
    expect(networkSecurityConfig).toContain(
      'application.$["android:networkSecurityConfig"] = "@xml/network_security_config"'
    );
  });

  it("rebuilds the Pixel Lock bundle and resumes a timed-out Gradle build exactly once", () => {
    const pixelBuildScript = readFileSync(join(repoRoot, "scripts", "pixel-lock", "build-pixel-apk.ts"), "utf8");

    expect(pixelBuildScript).toContain("const incrementalArgs =");
    expect(pixelBuildScript).toContain("parsePixelApkBuildCli(process.argv.slice(2))");
    expect(pixelBuildScript).toContain(
      'let args = resumeAfterTimeout ? incrementalArgs : [...incrementalArgs, "--rerun-tasks"]'
    );
    expect(pixelBuildScript).toContain('NODE_PATH: [join(mobileRoot, "node_modules"), process.env.NODE_PATH]');
    expect(pixelBuildScript).toContain("timeout: 1000 * 60 * 30");
    expect(pixelBuildScript).toContain("allowTimeout: !resumeAfterTimeout");
    expect(pixelBuildScript).toContain("if (primaryResult.timedOut)");
    expect(pixelBuildScript).toContain("autoResumedAfterTimeout = true");
    expect(pixelBuildScript).toContain(
      "createPixelApkBuildResumeMetadata(resumeAfterTimeout, autoResumedAfterTimeout)"
    );
    expect(pixelBuildScript).toContain("buildAttempts");
    expect(pixelBuildScript).toContain("durationMs: primaryResult.durationMs");
    expect(pixelBuildScript).toContain("durationMs: resumeResult.durationMs");
    expect(pixelBuildScript).toContain("computeRelease5vSourceSnapshot");
    expect(pixelBuildScript).toContain("verifyBuildSourceSnapshots");
    expect(pixelBuildScript).toContain("sourceBeforeBuild.sourceSnapshotSha256");
    expect(pixelBuildScript).toContain("sourceAfterBuild.sourceSnapshotSha256");
    expect(pixelBuildScript).toContain("sourceSnapshotVerification");
    expect(pixelBuildScript).toContain("await syncAndroidBrandingResources(mobileRoot, androidDir)");
    expect(pixelBuildScript).toContain("nativeBranding");
    expect(pixelBuildScript).toContain('const rootApkPath = join(repoRoot, `wooriai-pixel-${apkSha256}.apk`)');
    expect(pixelBuildScript).toContain("copyFileSync(apkPath, rootApkPath)");
    expect(pixelBuildScript).not.toContain('join(repoRoot, "artifacts", "pixel-lock", "android", "apks")');
    expect(pixelBuildScript).toContain("gradleApkPath: apkPath");
    expect(pixelBuildScript).toContain("createExpoPrebuildInvocation(process.platform, process.execPath, mobileRoot)");
    expect(pixelBuildScript).toContain("createGradleInvocation(process.platform, javaHome, androidDir, gradlew, args)");
    expect(pixelBuildScript).not.toContain('shell: process.platform === "win32"');
    expect(pixelBuildScript).not.toContain('if (process.env.PIXEL_ANDROID_RERUN_TASKS === "1")');
  });

  it("models release-profile environment values as native build inputs", () => {
    const gradleSource = readFileSync(join(mobileRoot, "android", "app", "build.gradle"), "utf8");
    const metroSource = readFileSync(join(mobileRoot, "metro.config.js"), "utf8");

    expect(gradleSource).toContain('task.name == "createBundleReleaseJsAndAssets"');
    expect(gradleSource).toContain('task.inputs.property("wooriai.profile.${key}", value)');
    expect(gradleSource).toContain('task.name == "generateReleaseBuildConfig"');
    expect(gradleSource).toContain('System.getenv("EXPO_PUBLIC_PIXEL_LOCK") ?: "0"');
    expect(gradleSource).toContain('System.getenv("EXPO_PUBLIC_TEST_LOGIN") ?: "0"');
    expect(gradleSource).toContain('System.getenv("WOORIAI_BUILD_PROFILE") ?: "unset"');
    expect(gradleSource).toContain('"--reset-cache"');
    expect(metroSource).toContain("config.cacheVersion = bundleProfileCacheKey");
    expect(metroSource).toContain('process.env.EXPO_PUBLIC_PIXEL_LOCK || "0"');
    expect(metroSource).toContain('process.env.EXPO_PUBLIC_TEST_LOGIN || "0"');
    expect(metroSource).toContain('process.env.WOORIAI_BUILD_PROFILE || "development"');
  });

  it("resolves mobile Expo config plugins from the workspace root after a frozen pnpm install", () => {
    const rootAppConfig = readFileSync(join(repoRoot, "app.config.js"), "utf8");

    expect(rootAppConfig).toContain('"expo-router": "./apps/mobile/node_modules/expo-router/app.plugin.js"');
    expect(rootAppConfig).toContain('"expo-asset": "./apps/mobile/node_modules/expo-asset/app.plugin.js"');
    expect(rootAppConfig).toContain('"./apps/mobile/plugins/with-network-security-config"');
    expect(rootAppConfig).toContain("wooriaiBuildProfile: process.env.WOORIAI_BUILD_PROFILE");
    expect(rootAppConfig).toContain('wooriaiPixelLockEnabled: process.env.EXPO_PUBLIC_PIXEL_LOCK === "1"');
    expect(rootAppConfig).toContain('wooriaiTestLoginEnabled: process.env.EXPO_PUBLIC_TEST_LOGIN === "1"');
    const mobileAppConfig = readFileSync(join(mobileRoot, "app.config.js"), "utf8");
    expect(mobileAppConfig).toContain("wooriaiBuildProfile: process.env.WOORIAI_BUILD_PROFILE");
    expect(mobileAppConfig).toContain('wooriaiPixelLockEnabled: process.env.EXPO_PUBLIC_PIXEL_LOCK === "1"');
    expect(mobileAppConfig).toContain('wooriaiTestLoginEnabled: process.env.EXPO_PUBLIC_TEST_LOGIN === "1"');
    const pixelProfileNativeSource = readFileSync(join(mobileRoot, "src", "pixelLock", "build-profile.native.ts"), "utf8");
    expect(pixelProfileNativeSource).toContain("Constants.expoConfig?.extra");
    expect(pixelProfileNativeSource).toContain("export function isPixelLockBuild()");
    expect(pixelProfileNativeSource).toContain("export function isTestLoginBuild()");
  });
});
