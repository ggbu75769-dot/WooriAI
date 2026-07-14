import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");
const mobileRoot = process.cwd();

describe("standalone Android APK build", () => {
  it("builds a fresh Metro-free release APK for Android devices", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    const buildScriptPath = join(repoRoot, "scripts", "build-android-apk.ts");

    expect(packageJson.scripts["android:build-apk"]).toBe("tsx scripts/build-android-apk.ts");
    expect(existsSync(buildScriptPath)).toBe(true);

    const buildScript = readFileSync(buildScriptPath, "utf8");
    expect(buildScript).toContain('EXPO_PUBLIC_PIXEL_LOCK: "0"');
    expect(buildScript).toContain('standalone: "1"');
    expect(buildScript).toContain('production: "0"');
    expect(buildScript).toContain('EXPO_ROUTER_APP_ROOT: "apps/mobile/app"');
    expect(buildScript).toContain('"prebuild", "--platform", "android", "--no-install"');
    expect(buildScript).toContain('"assembleRelease"');
    expect(buildScript).toContain('"--rerun-tasks"');
    expect(buildScript).not.toContain("reactNativeArchitectures=x86_64");
    expect(buildScript).toContain("wooriai-0.0.0-release-${profile}.apk");
    expect(buildScript).toContain(
      'extraPackagerArgs = ["--max-workers", "1", "--entry-file", "${projectRoot}/index.js"]'
    );
  });

  it("defaults to the standalone (test-login) profile when no --profile flag is given", () => {
    const buildScriptPath = join(repoRoot, "scripts", "build-android-apk.ts");
    const buildScript = readFileSync(buildScriptPath, "utf8");

    expect(buildScript).toContain('const requested = flagValue ?? inlineValue ?? process.env.BUILD_PROFILE ?? "standalone";');
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
});
