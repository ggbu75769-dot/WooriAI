import { join, relative, resolve, sep } from "node:path";

export const DEFAULT_ANDROID_ARCHITECTURES = "armeabi-v7a,arm64-v8a,x86,x86_64";
const REQUIRED_APK_NATIVE_LIBRARIES = ["libexpo-modules-core.so", "libhermes.so", "libreactnative.so"];
const PAGE_SIZE_16K_ABIS = new Set(["arm64-v8a", "x86_64"]);

export function filter16KiBPageSizeLibraries(entries: string[]) {
  return entries.filter((entry) => {
    const match = entry.replaceAll("\\", "/").match(/^lib\/([^/]+)\/[^/]+\.so$/);
    return Boolean(match?.[1] && PAGE_SIZE_16K_ABIS.has(match[1]));
  });
}

export function validateApkNativeLibraries(entries: string[]) {
  const normalized = new Set(entries.map((entry) => entry.replaceAll("\\", "/")));
  const abis = [...new Set(entries.flatMap((entry) => {
    const match = entry.replaceAll("\\", "/").match(/^lib\/([^/]+)\/[^/]+\.so$/);
    return match ? [match[1]] : [];
  }))].sort((left, right) => left.localeCompare(right, "en"));
  if (abis.length === 0) throw new Error("APK_NATIVE_LIBRARY_INCOMPLETE no-native-abis");

  const missing = abis.flatMap((abi) => REQUIRED_APK_NATIVE_LIBRARIES
    .filter((library) => !normalized.has(`lib/${abi}/${library}`))
    .map((library) => `${abi}/${library}`));
  if (missing.length > 0) {
    throw new Error(`APK_NATIVE_LIBRARY_INCOMPLETE ${missing.join(",")}`);
  }
  return { abis, requiredLibraries: [...REQUIRED_APK_NATIVE_LIBRARIES] };
}

export function createAndroidBuildPlan(androidDir: string, architectures: string) {
  const generatedTargets = [
    join(androidDir, "app", "build"),
    join(androidDir, "build"),
    join(androidDir, ".cxx"),
    join(androidDir, "app", ".cxx")
  ].map((target) => {
    const resolved = resolve(target);
    const scoped = relative(androidDir, resolved);
    if (!scoped || scoped === ".." || scoped.startsWith(`..${sep}`) || resolve(androidDir, scoped) !== resolved) {
      throw new Error(`UNSAFE_ANDROID_GENERATED_TARGET ${resolved}`);
    }
    return resolved;
  });

  return {
    generatedTargets,
    taskArgs: ["assembleRelease", "--max-workers=1", "--no-parallel", `-PreactNativeArchitectures=${architectures}`]
  };
}
