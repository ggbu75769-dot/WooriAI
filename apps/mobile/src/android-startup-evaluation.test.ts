import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(mobileRoot, "..", "..");

describe("Android production startup module evaluation", () => {
  it("aligns the native Expo bundler with the SDK 54 monorepo server root", () => {
    const gradle = readFileSync(join(mobileRoot, "android", "app", "build.gradle"), "utf8");
    const apkBuilder = readFileSync(join(repoRoot, "scripts", "build-android-apk.ts"), "utf8");
    const pixelBuilder = readFileSync(join(repoRoot, "scripts", "pixel-lock", "build-pixel-apk.ts"), "utf8");
    const aabBuilder = readFileSync(join(repoRoot, "scripts", "build-android-aab.ts"), "utf8");

    expect(gradle).toContain("root = file(workspaceRoot)");
    expect(gradle).toContain('bundleConfig = file("${projectRoot}/metro.config.js")');
    expect(apkBuilder).toContain('root = file(workspaceRoot)');
    expect(pixelBuilder).toContain('root = file(workspaceRoot)');
    expect(apkBuilder).toContain('EXPO_ROUTER_APP_ROOT: "app"');
    expect(pixelBuilder).toContain('EXPO_ROUTER_APP_ROOT: "app"');
    expect(aabBuilder).toContain('EXPO_ROUTER_APP_ROOT: "app"');
    expect(apkBuilder).not.toContain('EXPO_ROUTER_APP_ROOT: "apps/mobile/app"');
    expect(pixelBuilder).not.toContain('EXPO_ROUTER_APP_ROOT: "apps/mobile/app"');
    expect(aabBuilder).not.toContain('EXPO_ROUTER_APP_ROOT: "apps/mobile/app"');
  });
});
