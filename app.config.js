const mobileConfig = require("./apps/mobile/app.json").expo;
const workspacePluginPaths = {
  "expo-router": "./apps/mobile/node_modules/expo-router/app.plugin.js",
  "expo-asset": "./apps/mobile/node_modules/expo-asset/app.plugin.js"
};

module.exports = {
  expo: {
    ...mobileConfig,
    plugins: (mobileConfig.plugins || []).map((plugin) => {
      if (plugin === "./plugins/with-network-security-config") {
        return "./apps/mobile/plugins/with-network-security-config";
      }
      return workspacePluginPaths[plugin] || plugin;
    }),
    extra: {
      ...(mobileConfig.extra || {}),
      wooriaiBuildProfile: process.env.WOORIAI_BUILD_PROFILE || "development",
      wooriaiPixelLockEnabled: process.env.EXPO_PUBLIC_PIXEL_LOCK === "1",
      wooriaiTestLoginEnabled: process.env.EXPO_PUBLIC_TEST_LOGIN === "1",
      router: {
        ...((mobileConfig.extra && mobileConfig.extra.router) || {}),
        root: "apps/mobile/app"
      }
    }
  }
};
