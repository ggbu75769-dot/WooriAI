const mobileConfig = require("./apps/mobile/app.json").expo;
const workspacePluginPaths = {
  "expo-router": "./apps/mobile/node_modules/expo-router/app.plugin.js",
  "expo-asset": "./apps/mobile/node_modules/expo-asset/app.plugin.js",
  "@react-native-community/datetimepicker": "./apps/mobile/node_modules/@react-native-community/datetimepicker/app.plugin.js",
  "expo-secure-store": "./apps/mobile/node_modules/expo-secure-store/app.plugin.js",
  "expo-sqlite": "./apps/mobile/node_modules/expo-sqlite/app.plugin.js",
  "expo-build-properties": "./apps/mobile/node_modules/expo-build-properties/app.plugin.js"
};

module.exports = {
  expo: {
    ...mobileConfig,
    plugins: (mobileConfig.plugins || []).map((plugin) => {
      if (plugin === "./plugins/with-network-security-config") {
        return "./apps/mobile/plugins/with-network-security-config";
      }
      if (Array.isArray(plugin)) {
        return [workspacePluginPaths[plugin[0]] || plugin[0], plugin[1]];
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
