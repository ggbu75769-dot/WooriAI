// REL-009: Round 5A 빌드 노트(docs/qa/round5a-apk-build-note.md)의 수동 안드로이드 패치 2종을
// expo prebuild 시 자동 적용하는 config plugin. 이 플러그인 덕에 android/ 재생성 후에도
// src/android-standalone-apk.test.ts 검사가 손패치 없이 통과한다.
// REL-011: Play 제출용 업로드 keystore 서명(signingConfigs.release) 자동 주입 추가 —
// prebuild 시점에 WOORIAI_UPLOAD_KEYSTORE env가 설정된 경우에만 동작한다.
const { withAppBuildGradle, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const PACKAGER_ARGS_LINE = '    extraPackagerArgs = ["--max-workers", "1", "--entry-file", "${projectRoot}/index.js"]';
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

// ─── REL-011: 업로드 keystore 서명 주입 ───────────────────────────────────────
// gradle이 빌드 시점에 System.getenv로 비밀값을 읽게 하여, 비밀번호가
// android/app/build.gradle 파일 자체에는 절대 남지 않도록 한다.
// (keystore 경로는 절대경로여야 한다 — file()이 상대경로를 app/ 기준으로 풀기 때문.)
const UPLOAD_KEYSTORE_ENV = "WOORIAI_UPLOAD_KEYSTORE";

// RN 템플릿의 debug signingConfig 블록 전체를 앵커로 사용 (expo prebuild 산출물 기준).
const DEBUG_SIGNING_BLOCK = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }`;

// RN 템플릿의 release buildType 안에서만 등장하는 주석 줄 + debug 서명 줄을 앵커로 사용
// ("signingConfig signingConfigs.debug"는 debug buildType에도 있어 단독으로는 모호함).
const RELEASE_BUILDTYPE_ANCHOR = `            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

const RELEASE_SIGNING_BLOCK = `        release {
            // REL-011 자동 주입 (plugins/with-wooriai-android-release.js)
            // 비밀값은 gradle 실행 시점에 System.getenv로 읽는다 — 이 파일에 저장 금지.
            // if 가드 필수: signingConfigs 클로저는 configuration 단계에서 즉시 평가되므로,
            // env 없이 file(null)을 호출하면 debug 빌드까지 전부 깨진다.
            if (System.getenv("WOORIAI_UPLOAD_KEYSTORE")) {
                storeFile file(System.getenv("WOORIAI_UPLOAD_KEYSTORE"))
                storePassword System.getenv("WOORIAI_UPLOAD_KEYSTORE_PASSWORD")
                keyAlias System.getenv("WOORIAI_UPLOAD_KEY_ALIAS")
                keyPassword System.getenv("WOORIAI_UPLOAD_KEY_PASSWORD")
            }
        }`;

/** prebuild 시점 env로 서명 주입 여부를 결정 (미설정/빈 문자열이면 dev 흐름 그대로). */
function shouldInjectUploadSigning(env = process.env) {
  return Boolean(env[UPLOAD_KEYSTORE_ENV]);
}

/**
 * app/build.gradle 내용에 signingConfigs.release를 주입하고 release buildType이
 * 이를 사용하도록 전환한 문자열을 반환한다. 이미 주입돼 있으면 그대로 반환(멱등).
 */
function injectUploadSigning(gradle) {
  if (gradle.includes('System.getenv("WOORIAI_UPLOAD_KEYSTORE")')) return gradle;
  if (!gradle.includes(DEBUG_SIGNING_BLOCK)) {
    throw new Error(
      "with-wooriai-android-release: app/build.gradle에서 debug signingConfig 앵커를 찾지 못했습니다. " +
        "expo/RN 템플릿 변경 여부를 확인하세요."
    );
  }
  if (!gradle.includes(RELEASE_BUILDTYPE_ANCHOR)) {
    throw new Error(
      "with-wooriai-android-release: app/build.gradle에서 release buildType 서명 앵커를 찾지 못했습니다. " +
        "expo/RN 템플릿 변경 여부를 확인하세요."
    );
  }
  return gradle
    .replace(DEBUG_SIGNING_BLOCK, `${DEBUG_SIGNING_BLOCK}\n${RELEASE_SIGNING_BLOCK}`)
    .replace(
      RELEASE_BUILDTYPE_ANCHOR,
      `            // see https://reactnative.dev/docs/signed-apk-android.\n` +
        `            // REL-011: gradle 실행 시점에 env가 있으면 업로드 keystore 서명, 없으면 템플릿과\n` +
        `            // 동일한 debug 서명(기존 standalone APK 흐름 유지). AAB는 반드시\n` +
        `            // pnpm android:build-aab로 빌드할 것 — env를 검증·주입해 서명을 보장한다.\n` +
        `            signingConfig System.getenv("WOORIAI_UPLOAD_KEYSTORE") ? signingConfigs.release : signingConfigs.debug`
    );
}

function withUploadSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (shouldInjectUploadSigning()) {
      mod.modResults.contents = injectUploadSigning(mod.modResults.contents);
    }
    return mod;
  });
}

/** 모노레포 serverRoot vs RN gradle plugin의 상대 entry 불일치 우회 (빌드 노트 참조). */
function injectPackagerArgs(gradle) {
  // 주의: RN 템플릿에 주석 처리된 `// extraPackagerArgs = []` 예시 줄이 있으므로
  // 중복 방지 검사는 실제 주입 내용(--max-workers)으로 해야 한다.
  if (!gradle.includes("--max-workers")) {
    if (!gradle.includes(BUNDLE_COMMAND_ANCHOR)) {
      throw new Error(
        "with-wooriai-android-release: app/build.gradle에서 bundleCommand 앵커를 찾지 못했습니다. " +
          "expo/RN 템플릿 변경 여부를 확인하세요."
      );
    }
    return gradle.replace(
      BUNDLE_COMMAND_ANCHOR,
      `${BUNDLE_COMMAND_ANCHOR}\n\n    // REL-009 자동 적용 (plugins/with-wooriai-android-release.js)\n${PACKAGER_ARGS_LINE}`
    );
  }
  return gradle;
}

function withPackagerArgs(config) {
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = injectPackagerArgs(mod.modResults.contents);
    return mod;
  });
}

function applyNetworkSecurityManifest(manifest) {
  const application = manifest.application?.[0];
  if (application) application.$["android:networkSecurityConfig"] = "@xml/network_security_config";
  return manifest;
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
    mod.modResults.manifest = applyNetworkSecurityManifest(mod.modResults.manifest);
    return mod;
  });
}

module.exports = function withWooriaiAndroidRelease(config) {
  return withUploadSigning(withNetworkSecurityConfig(withPackagerArgs(config)));
};
// REL-011: 순수 함수 테스트용(src/android-release-aab.test.ts) 내보내기.
module.exports.injectUploadSigning = injectUploadSigning;
module.exports.shouldInjectUploadSigning = shouldInjectUploadSigning;
module.exports.injectPackagerArgs = injectPackagerArgs;
module.exports.applyNetworkSecurityManifest = applyNetworkSecurityManifest;
module.exports.NETWORK_SECURITY_CONFIG = NETWORK_SECURITY_CONFIG;
