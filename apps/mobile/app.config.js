// REL-009: apps/mobile 디렉터리에서 실행되는 expo 명령용 구성.
// 기본값은 app.json, 릴리즈 오버라이드·안드로이드 플러그인은 expo-config.shared.js 참조.
const base = require("./app.json").expo;
const { applyWooriaiConfig } = require("./expo-config.shared");

module.exports = { expo: applyWooriaiConfig(base) };
