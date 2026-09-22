import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const config = require("../metro.config.js");
const root = path.resolve(__dirname, "../../..");
const patterns: RegExp[] = [config.resolver.blockList].flat();
const isBlocked = (file: string) => patterns.some((pattern) => pattern.test(path.join(root, file)));

describe("Metro native bundle inputs", () => {
  it.each([
    "apps/mobile/index.js",
    "apps/mobile/app/_layout.tsx",
    "apps/mobile/src/auth/pkce.ts",
    "packages/contracts/src/index.ts",
    "node_modules/.pnpm/expo@54.0.37/node_modules/expo/package.json"
  ])("keeps runtime input %s resolvable", (file) => {
    expect(isBlocked(file)).toBe(false);
  });

  it.each([
    ".toolcache/android-sdk-launch/platforms/android-36/android.jar",
    "artifacts/launch-20260922/android-build.log",
    ".gradle-home/caches/file.bin",
    "apps/mobile/android/app/build/file.bin",
    "apps/mobile/.expo/types/router.d.ts"
  ])("excludes generated or tooling input %s", (file) => {
    expect(isBlocked(file)).toBe(true);
  });
});
