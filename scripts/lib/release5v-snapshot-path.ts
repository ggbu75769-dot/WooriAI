export function isRelease5vSnapshotPathExcluded(path: string) {
  const value = `/${path.replaceAll("\\", "/").toLowerCase()}/`;
  return value.includes("/node_modules/") ||
    value.includes("/.turbo/") ||
    value.includes("/.gradle/") ||
    value.includes("/.gradle-home/") ||
    value.includes("/.android-avd") ||
    value.includes("/.cxx/") ||
    value.includes("/.expo/") ||
    value.includes("/.next/") ||
    value.includes("/coverage/") ||
    value.includes("/artifacts/") ||
    value.includes("/docs/") ||
    value.includes("/tmp/") ||
    value.includes("/codex/") ||
    value.includes("/screenshots/") ||
    value.includes("/traces/") ||
    value.includes("/test-results/") ||
    value.includes("/apps/mobile/dist/") ||
    value.includes("/apps/api/dist/") ||
    value.includes("/apps/admin/out/") ||
    value.includes("/.codex/") ||
    value.includes("/apps/mobile/android/build/") ||
    value.includes("/apps/mobile/android/app/build/") ||
    value.endsWith("/apps/mobile/android/local.properties/") ||
    value.endsWith("/apps/mobile/android/app/src/main/assets/index.android.bundle/") ||
    value.endsWith(".apk/") || value.endsWith(".aab/");
}
