// REL-009: app.json(정적 기본값)에 릴리즈용 env 오버라이드와 안드로이드 릴리즈 플러그인을 얹는다.
// apps/mobile/app.config.js(모바일 cwd 빌드)와 루트 app.config.js(모노레포 루트 빌드)가 공유해
// 어느 경로로 빌드해도 같은 구성이 나오도록 한다.
//
// 릴리즈 빌드 시 주입할 env:
//   WOORIAI_ANDROID_PACKAGE  확정 패키지명 (예: kr.wooriai.app) — 미설정 시 dev 기본값 유지
//   WOORIAI_APP_VERSION      스토어 표기 버전 (예: 1.0.0)
//   WOORIAI_ANDROID_VERSION_CODE  Play 업로드마다 증가하는 정수 (예: 1)
const withWooriaiAndroidRelease = require("./plugins/with-wooriai-android-release");

function applyWooriaiConfig(baseExpo) {
  const androidPackage = process.env.WOORIAI_ANDROID_PACKAGE || baseExpo.android?.package;
  const version = process.env.WOORIAI_APP_VERSION || baseExpo.version;
  const versionCodeRaw = process.env.WOORIAI_ANDROID_VERSION_CODE;
  const versionCode = versionCodeRaw ? Number.parseInt(versionCodeRaw, 10) : undefined;
  if (versionCodeRaw && (!Number.isInteger(versionCode) || versionCode <= 0)) {
    throw new Error(`WOORIAI_ANDROID_VERSION_CODE는 양의 정수여야 합니다: ${versionCodeRaw}`);
  }

  return {
    ...baseExpo,
    version,
    android: {
      ...(baseExpo.android || {}),
      package: androidPackage,
      ...(versionCode ? { versionCode } : {})
    },
    plugins: [...(baseExpo.plugins || []), withWooriaiAndroidRelease]
  };
}

module.exports = { applyWooriaiConfig };
