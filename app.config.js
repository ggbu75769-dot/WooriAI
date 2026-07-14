const mobileConfig = require("./apps/mobile/app.json").expo;

module.exports = {
  expo: {
    ...mobileConfig,
    plugins: (mobileConfig.plugins || []).map((plugin) =>
      plugin === "./plugins/with-network-security-config"
        ? "./apps/mobile/plugins/with-network-security-config"
        : plugin
    ),
    extra: {
      ...(mobileConfig.extra || {}),
      router: {
        ...((mobileConfig.extra && mobileConfig.extra.router) || {}),
        root: "apps/mobile/app"
      }
    }
  }
};
