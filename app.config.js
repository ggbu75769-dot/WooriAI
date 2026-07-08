const mobileConfig = require("./apps/mobile/app.json").expo;

module.exports = {
  expo: {
    ...mobileConfig,
    extra: {
      ...(mobileConfig.extra || {}),
      router: {
        ...((mobileConfig.extra && mobileConfig.extra.router) || {}),
        root: "apps/mobile/app"
      }
    }
  }
};
