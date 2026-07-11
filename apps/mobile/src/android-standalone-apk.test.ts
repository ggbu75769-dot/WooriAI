import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");
const mobileRoot = process.cwd();

describe("standalone Android APK build", () => {
  it("builds a fresh Metro-free release APK for Android devices", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    const buildScriptPath = join(repoRoot, "scripts", "build-android-apk.ts");
    const appBuildGradlePath = join(mobileRoot, "android", "app", "build.gradle");

    expect(packageJson.scripts["android:build-apk"]).toBe("tsx scripts/build-android-apk.ts");
    expect(existsSync(buildScriptPath)).toBe(true);

    const buildScript = readFileSync(buildScriptPath, "utf8");
    expect(buildScript).toContain('EXPO_PUBLIC_PIXEL_LOCK: "0"');
    expect(buildScript).toContain('EXPO_PUBLIC_TEST_LOGIN: "1"');
    expect(buildScript).toContain('EXPO_ROUTER_APP_ROOT: "apps/mobile/app"');
    expect(buildScript).toContain('"assembleRelease"');
    expect(buildScript).toContain('"--rerun-tasks"');
    expect(buildScript).not.toContain("reactNativeArchitectures=x86_64");
    expect(buildScript).toContain("wooriai-0.0.0-release.apk");
    expect(readFileSync(appBuildGradlePath, "utf8")).toContain('extraPackagerArgs = ["--max-workers", "1"]');
  });
});
