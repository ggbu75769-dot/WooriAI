// 모노레포 루트에서 실행되는 expo 명령(scripts/build-android-apk.ts 등)용 구성.
// REL-009: 기본값은 apps/mobile/app.json, 릴리즈 오버라이드·안드로이드 플러그인은
// apps/mobile/expo-config.shared.js를 공유 (모바일 cwd 빌드와 동일 구성 보장).
const mobileConfig = require("./apps/mobile/app.json").expo;
const { applyWooriaiConfig } = require("./apps/mobile/expo-config.shared");

const expo = applyWooriaiConfig(mobileConfig);

module.exports = {
  expo: {
    ...expo,
    extra: {
      ...(expo.extra || {}),
      router: {
        ...((expo.extra && expo.extra.router) || {}),
        root: "apps/mobile/app"
      }
    }
  }
};
