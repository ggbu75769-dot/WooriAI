import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  injectPackagerArgs,
  applyNetworkSecurityManifest,
  NETWORK_SECURITY_CONFIG
} from "../plugins/with-wooriai-android-release";

const repoRoot = join(process.cwd(), "..", "..");

describe("standalone Android APK build", () => {
  it("configures a fresh Metro-free release APK build without requiring generated android files", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    const buildScriptPath = join(repoRoot, "scripts", "build-android-apk.ts");

    expect(packageJson.scripts["android:build-apk"]).toBe("tsx scripts/build-android-apk.ts");
    expect(existsSync(buildScriptPath)).toBe(true);

    const buildScript = readFileSync(buildScriptPath, "utf8");
    expect(buildScript).toContain('EXPO_PUBLIC_PIXEL_LOCK: "0"');
    expect(buildScript).toContain('standalone: "1"');
    expect(buildScript).toContain('production: "0"');
    expect(buildScript).toContain('EXPO_ROUTER_APP_ROOT: "apps/mobile/app"');
    expect(buildScript).toContain('"assembleRelease"');
    expect(buildScript).toContain('"--rerun-tasks"');
    expect(buildScript).not.toContain("reactNativeArchitectures=x86_64");
    expect(buildScript).toContain("wooriai-0.0.0-release-${profile}.apk");
    // 마지막 --entry-file 절대경로 override는 모노레포 serverRoot vs RN gradle plugin의
    // 상대 entry 불일치를 우회하는 필수 구성 — docs/qa/round5a-apk-build-note.md 참조.
    expect(injectPackagerArgs('react {\n    bundleCommand = "export:embed"\n}')).toContain(
      'extraPackagerArgs = ["--max-workers", "1", "--entry-file", "${projectRoot}/index.js"]'
    );
  });

  it("keeps packager injection idempotent and rejects an unsupported template", () => {
    const gradle = injectPackagerArgs('bundleCommand = "export:embed"');
    expect(injectPackagerArgs(gradle)).toBe(gradle);
    expect(() => injectPackagerArgs("react {}")).toThrow("bundleCommand");
  });

  it("defaults to the standalone (test-login) profile when no --profile flag is given", () => {
    const buildScriptPath = join(repoRoot, "scripts", "build-android-apk.ts");
    const buildScript = readFileSync(buildScriptPath, "utf8");

    expect(buildScript).toContain(
      'const requested = flagValue ?? inlineValue ?? process.env.BUILD_PROFILE ?? "standalone";'
    );
  });

  it("requires EXPO_PUBLIC_API_BASE_URL for the production profile instead of silently building against localhost", () => {
    const buildScriptPath = join(repoRoot, "scripts", "build-android-apk.ts");
    const buildScript = readFileSync(buildScriptPath, "utf8");

    expect(buildScript).toContain('profile === "production" && !apiBaseUrl');
    expect(buildScript).toContain("EXPO_PUBLIC_API_BASE_URL_REQUIRED");
  });

  it("blocks cleartext traffic except for local development hosts", () => {
    const networkSecurityConfig = NETWORK_SECURITY_CONFIG;
    expect(networkSecurityConfig).toContain('cleartextTrafficPermitted="false"');
    expect(networkSecurityConfig).toContain(">10.0.2.2<");
    expect(networkSecurityConfig).toContain(">localhost<");

    const manifest = applyNetworkSecurityManifest({ application: [{ $: { "android:name": ".MainApplication" } }] });
    expect(manifest.application[0].$).toMatchObject({
      "android:name": ".MainApplication",
      "android:networkSecurityConfig": "@xml/network_security_config"
    });
  });
});
