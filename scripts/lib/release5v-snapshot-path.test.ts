import { describe, expect, it } from "vitest";
import { isRelease5vSnapshotPathExcluded } from "./release5v-snapshot-path";

describe("Release 5V source snapshot path filter", () => {
  it.each([
    ".android-avd/avd/device.img",
    ".android-avd-home/adbkey",
    ".android-avd-home/modem-nv-ram-5554",
    "apps/mobile/android/app/build/outputs/apk/release/app-release.apk",
    "artifacts/android/app.apk"
  ])("excludes runtime or generated path %s", (path) => {
    expect(isRelease5vSnapshotPathExcluded(path)).toBe(true);
  });

  it.each([
    "apps/mobile/app/_layout.tsx",
    "apps/mobile/src/stores/persist-storage.ts",
    "apps/mobile/android/app/src/main/AndroidManifest.xml",
    "packages/domain/src/onboarding.ts",
    "pnpm-lock.yaml"
  ])("keeps build-relevant source path %s", (path) => {
    expect(isRelease5vSnapshotPathExcluded(path)).toBe(false);
  });
});
