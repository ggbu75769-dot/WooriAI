const { mkdirSync, readFileSync, writeFileSync, existsSync } = require("node:fs");
const { resolve, join } = require("node:path");
const { EXPO_ROUTER_CTX_IGNORE } = require("expo-router/_ctx-shared");
const { getTypedRoutesDeclarationFile } = require("expo-router/build/typed-routes/generate");
const requireContext = require("expo-router/build/testing-library/require-context-ponyfill").default;

// Expo 개발 서버가 남긴 .expo 타입은 Git에 없으며 다른 체크아웃의 경로를 담을 수 있다.
// 린트/빌드도 현재 app 디렉터리에서 공식 생성기로 타입을 만들어 같은 경로를 검사한다.
function generateRouteTypes(projectRoot = resolve(__dirname, "..")) {
  const appRoot = join(projectRoot, "app");
  if (!existsSync(appRoot)) throw new Error(`Route directory not found: ${appRoot}`);
  const context = requireContext(appRoot, true, EXPO_ROUTER_CTX_IGNORE);
  const declarations = getTypedRoutesDeclarationFile(context);
  if (!declarations) throw new Error("Expo Router did not generate route declarations");
  const outputDir = join(projectRoot, ".expo", "types");
  const output = join(outputDir, "router.d.ts");
  mkdirSync(outputDir, { recursive: true });
  if (!existsSync(output) || readFileSync(output, "utf8") !== declarations) {
    writeFileSync(output, declarations);
  }
  return output;
}

module.exports = { generateRouteTypes };
if (require.main === module) generateRouteTypes();
