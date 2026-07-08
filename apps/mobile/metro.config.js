const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules")
];
config.resolver.unstable_enableSymlinks = true;
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
