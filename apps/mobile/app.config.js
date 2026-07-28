const mobileConfig = require("./app.json").expo;

module.exports = {
  expo: {
    ...mobileConfig,
    extra: {
      ...(mobileConfig.extra || {}),
      wooriaiBuildProfile: process.env.WOORIAI_BUILD_PROFILE || "development",
      wooriaiPixelLockEnabled: process.env.EXPO_PUBLIC_PIXEL_LOCK === "1",
      wooriaiTestLoginEnabled: process.env.EXPO_PUBLIC_TEST_LOGIN === "1"
    }
  }
};

