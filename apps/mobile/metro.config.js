const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const config = getDefaultConfig(projectRoot);
const productionFixtureRuntime = path.resolve(projectRoot, "src/api/fixture-runtime.production.ts");
const productionFixtureIdentifiers = path.resolve(projectRoot, "src/api/fixture-identifiers.production.ts");
const productionFixtureBackendLoader = path.resolve(projectRoot, "src/api/fixture-backend-loader.production.ts");
const domainSourceRoot = path.resolve(workspaceRoot, "packages/domain/src");
const domainSubpathSources = new Map(
  [
    "enums",
    "money-date",
    "onboarding",
    "preparation-lifecycle",
    "recommendation",
    "report-v3-state",
    "release4-catalog",
    "stage"
  ].map((name) => [`@wooriai/domain/${name}`, path.resolve(domainSourceRoot, `${name}.ts`)])
);
const bundleProfileCacheKey = [
  "wooriai-profile-native-root-v2",
  process.env.WOORIAI_BUILD_PROFILE || "development",
  process.env.EXPO_PUBLIC_PIXEL_LOCK || "0",
  process.env.EXPO_PUBLIC_TEST_LOGIN || "0",
  process.env.EXPO_PUBLIC_API_BASE_URL || "unset"
].join(":");
const isProductionBundle =
  process.env.WOORIAI_BUILD_PROFILE === "production" ||
  (process.env.NODE_ENV === "production" &&
    process.env.EXPO_PUBLIC_TEST_LOGIN !== "1" &&
    process.env.EXPO_PUBLIC_PIXEL_LOCK !== "1");

if (isProductionBundle && !/^https:\/\//.test(process.env.EXPO_PUBLIC_API_BASE_URL || "")) {
  throw new Error("EXPO_PUBLIC_API_BASE_URL_HTTPS_REQUIRED_FOR_PRODUCTION_BUNDLE");
}

config.watchFolders = [workspaceRoot];
// Expo public environment variables are compiled into the JavaScript bundle. Metro's default
// transform cache does not guarantee that those values participate in its cache key, so Pixel
// Lock, standalone, and production builds must never share a transformed module cache.
config.cacheVersion = bundleProfileCacheKey;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules")
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const domainSource = domainSubpathSources.get(moduleName);
  if (domainSource) {
    return { filePath: domainSource, type: "sourceFile" };
  }
  if (isProductionBundle && /(^|[/\\])fixture-runtime$/.test(moduleName)) {
    return { filePath: productionFixtureRuntime, type: "sourceFile" };
  }
  if (isProductionBundle && /(^|[/\\])fixture-identifiers$/.test(moduleName)) {
    return { filePath: productionFixtureIdentifiers, type: "sourceFile" };
  }
  if (isProductionBundle && /(^|[/\\])fixture-backend-loader$/.test(moduleName)) {
    return { filePath: productionFixtureBackendLoader, type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};
const pixelLockBlockList = [
  ".android-avd",
  ".gradle-home",
  ".pixel-lock-avd",
  "artifacts",
  "backups",
  "apps/mobile/android"
].map((name) => new RegExp(`${escapeRegex(path.resolve(workspaceRoot, name))}[/\\\\].*`));
config.resolver.blockList = new RegExp(
  [config.resolver.blockList, ...pixelLockBlockList].map((pattern) => pattern.source).join("|")
);

module.exports = config;
