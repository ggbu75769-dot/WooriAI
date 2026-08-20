// REL-009: Round 5A 빌드 노트(docs/qa/round5a-apk-build-note.md)의 수동 안드로이드 패치 2종을
// expo prebuild 시 자동 적용하는 config plugin. 이 플러그인 덕에 android/ 재생성 후에도
// src/android-standalone-apk.test.ts 검사가 손패치 없이 통과한다.
const { withAppBuildGradle, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const PACKAGER_ARGS_LINE =
  '    extraPackagerArgs = ["--max-workers", "1", "--entry-file", "${projectRoot}/index.js"]';
const BUNDLE_COMMAND_ANCHOR = 'bundleCommand = "export:embed"';

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<!-- REL-009: 로컬 개발 호스트 외 cleartext 차단 (자동 생성 — plugins/with-wooriai-android-release.js) -->
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
</network-security-config>
`;

/** 모노레포 serverRoot vs RN gradle plugin의 상대 entry 불일치 우회 (빌드 노트 참조). */
function withPackagerArgs(config) {
  return withAppBuildGradle(config, (mod) => {
    const gradle = mod.modResults.contents;
    // 주의: RN 템플릿에 주석 처리된 `// extraPackagerArgs = []` 예시 줄이 있으므로
    // 중복 방지 검사는 실제 주입 내용(--max-workers)으로 해야 한다.
    if (!gradle.includes("--max-workers")) {
      if (!gradle.includes(BUNDLE_COMMAND_ANCHOR)) {
        throw new Error(
          "with-wooriai-android-release: app/build.gradle에서 bundleCommand 앵커를 찾지 못했습니다. " +
            "expo/RN 템플릿 변경 여부를 확인하세요."
        );
      }
      mod.modResults.contents = gradle.replace(
        BUNDLE_COMMAND_ANCHOR,
        `${BUNDLE_COMMAND_ANCHOR}\n\n    // REL-009 자동 적용 (plugins/with-wooriai-android-release.js)\n${PACKAGER_ARGS_LINE}`
      );
    }
    return mod;
  });
}

function withNetworkSecurityConfig(config) {
  config = withDangerousMod(config, [
    "android",
    (mod) => {
      const xmlDir = join(mod.modRequest.platformProjectRoot, "app", "src", "main", "res", "xml");
      mkdirSync(xmlDir, { recursive: true });
      writeFileSync(join(xmlDir, "network_security_config.xml"), NETWORK_SECURITY_CONFIG, "utf8");
      return mod;
    }
  ]);
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) {
      application.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    }
    return mod;
  });
}

module.exports = function withWooriaiAndroidRelease(config) {
  return withNetworkSecurityConfig(withPackagerArgs(config));
};
