import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = resolve(__dirname, "..");
const repoRoot = resolve(mobileRoot, "../..");
const readMobile = (path: string) => readFileSync(join(mobileRoot, path), "utf8");
const readRepo = (path: string) => readFileSync(join(repoRoot, path), "utf8");

describe("production mobile bundle boundary", () => {
  it("forbids temporary visual overrides in the full Android pixel gate and records override provenance", () => {
    const androidPixelGate = readRepo("scripts/pixel-lock/android-pixel-lock.ts");
    expect(androidPixelGate).toContain("PIXEL_ANDROID_OVERRIDES_FORBIDDEN_FOR_FULL_GATE");
    expect(androidPixelGate).toContain("pixelAndroidOverrides: process.env.PIXEL_ANDROID_OVERRIDES || null");
  });

  it("routes fixture imports through the Metro-swappable runtime", () => {
    const client = readMobile("src/api/client.ts");
    expect(client).toContain('from "./fixture-identifiers"');
    expect(client).toContain('from "./fixture-backend-loader"');
    expect(client).not.toContain('from "./fixture-runtime"');
    expect(client).not.toMatch(/from "\.\/local-(backend|fixtures)"/);

    const metro = readMobile("metro.config.js");
    expect(metro).toContain("fixture-runtime.production.ts");
    expect(metro).toContain("fixture-identifiers.production.ts");
    expect(metro).toContain("fixture-backend-loader.production.ts");
    expect(metro).toContain("WOORIAI_BUILD_PROFILE === \"production\"");
    expect(metro).toContain("EXPO_PUBLIC_API_BASE_URL_HTTPS_REQUIRED_FOR_PRODUCTION_BUNDLE");
  });

  it("keeps production-reachable routes and stores off direct fixture imports", () => {
    const productionReachablePaths = [
      "app/index.tsx",
      "app/profile.tsx",
      "app/settings/index.tsx",
      "app/settings/privacy.tsx",
      "app/(onboarding)/prepared-items.tsx",
      "src/categories.ts",
      "src/stores/session.store.ts",
      "src/api/client.ts"
    ];
    for (const path of productionReachablePaths) {
      expect(readMobile(path), path).not.toMatch(/from ".*\/local-(backend|fixtures)"/);
    }
  });

  it("keeps forbidden fixture signatures out of the production replacement", () => {
    const productionRuntime = readMobile("src/api/fixture-runtime.production.ts");
    const productionIdentifiers = readMobile("src/api/fixture-identifiers.production.ts");
    const productionBackendLoader = readMobile("src/api/fixture-backend-loader.production.ts");
    for (const forbidden of [
      "wooriai-local-backend",
      "local-child-daon",
      "local-household-daon",
      "wooriai-local-session",
      "LOCAL_SESSION_TOKEN",
      "pixel-screen-",
      "localhost:3000",
      "10.0.2.2:3000"
    ]) {
      expect(productionRuntime).not.toContain(forbidden);
      expect(productionIdentifiers).not.toContain(forbidden);
      expect(productionBackendLoader).not.toContain(forbidden);
    }
  });

  it("marks every Android release entrypoint with an explicit build profile", () => {
    const apkBuild = readRepo("scripts/build-android-apk.ts");
    const pixelBuild = readRepo("scripts/pixel-lock/build-pixel-apk.ts");
    expect(apkBuild).toContain("WOORIAI_BUILD_PROFILE: profile");
    expect(apkBuild).toContain('profile === "standalone" && process.env.EXPO_PUBLIC_AUTHORITY_RECOVERY_FIXTURE === "1" ? "1" : "0"');
    expect(pixelBuild).toContain('EXPO_PUBLIC_AUTHORITY_RECOVERY_FIXTURE: "0"');
    expect(pixelBuild).toContain('EXPO_PUBLIC_SAFETY_ALTERNATIVE_FIXTURE: "0"');
    const aabBuild = readRepo("scripts/build-android-aab.ts");
    const releaseGate = readRepo("scripts/release-gate.ts");
    expect(aabBuild).toContain('WOORIAI_BUILD_PROFILE: "production"');
    expect(aabBuild).toContain('EXPO_PUBLIC_AUTHORITY_RECOVERY_FIXTURE: "0"');
    expect(releaseGate).toContain('WOORIAI_BUILD_PROFILE: "production"');
    expect(releaseGate).toContain('EXPO_PUBLIC_AUTHORITY_RECOVERY_FIXTURE: "0"');
  });
});
