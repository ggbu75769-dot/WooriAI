// REL-011: Play 제출용 서명 AAB 파이프라인 계약 테스트.
// 서명 주입은 순수 함수(injectUploadSigning)로 검증한다 — 실제 android/ 디렉터리는
// 다른 테스트(android-standalone-apk.test.ts)와 공유되는 데다 prebuild 이력에 따라
// 주입 유무가 달라지므로, RN 템플릿 형태의 픽스처 문자열로 결정적으로 검사한다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  injectUploadSigning,
  shouldInjectUploadSigning
} from "../plugins/with-wooriai-android-release";

const repoRoot = join(process.cwd(), "..", "..");

// expo prebuild가 생성하는 RN 템플릿 build.gradle의 서명 관련 구간 (앵커 부분 원문 유지).
const TEMPLATE_GRADLE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            minifyEnabled enableProguardInReleaseBuilds
        }
    }
}
`;

describe("REL-011 업로드 keystore 서명 주입 (config plugin)", () => {
  it("env 게이트: WOORIAI_UPLOAD_KEYSTORE 미설정/빈 값이면 주입하지 않는다 (dev 흐름 보존)", () => {
    expect(shouldInjectUploadSigning({})).toBe(false);
    expect(shouldInjectUploadSigning({ WOORIAI_UPLOAD_KEYSTORE: "" })).toBe(false);
    expect(shouldInjectUploadSigning({ WOORIAI_UPLOAD_KEYSTORE: "/abs/wooriai-release.keystore" })).toBe(true);
  });

  it("signingConfigs.release를 System.getenv 참조로 주입하고 release buildType 서명을 전환한다", () => {
    const injected = injectUploadSigning(TEMPLATE_GRADLE);

    // 비밀값 4종 전부 gradle 실행 시점 env 참조여야 한다.
    expect(injected).toContain('storeFile file(System.getenv("WOORIAI_UPLOAD_KEYSTORE"))');
    expect(injected).toContain('storePassword System.getenv("WOORIAI_UPLOAD_KEYSTORE_PASSWORD")');
    expect(injected).toContain('keyAlias System.getenv("WOORIAI_UPLOAD_KEY_ALIAS")');
    expect(injected).toContain('keyPassword System.getenv("WOORIAI_UPLOAD_KEY_PASSWORD")');
    // signingConfigs 클로저는 configuration 단계에서 즉시 평가되므로 if 가드 없이는
    // env 미설정 시 debug 빌드까지 깨진다 — 가드가 반드시 있어야 한다.
    expect(injected).toContain('if (System.getenv("WOORIAI_UPLOAD_KEYSTORE")) {');
    // release buildType: env 있으면 업로드 서명, 없으면 템플릿과 동일한 debug 서명 폴백.
    expect(injected).toContain(
      'signingConfig System.getenv("WOORIAI_UPLOAD_KEYSTORE") ? signingConfigs.release : signingConfigs.debug'
    );
    // debug buildType은 그대로.
    expect(injected).toContain("signingConfig signingConfigs.debug\n        }\n        release {");
  });

  it("비밀값 리터럴을 gradle 파일에 남기지 않는다 (storePassword/keyPassword는 debug 템플릿 값 + getenv 참조뿐)", () => {
    const injected = injectUploadSigning(TEMPLATE_GRADLE);
    // storePassword는 정확히 2회: debug 블록의 'android' 리터럴, release 블록의 getenv 참조.
    expect(injected.match(/storePassword/g)).toHaveLength(2);
    expect(injected.match(/storePassword '/g)).toHaveLength(1);
    expect(injected.match(/keyPassword/g)).toHaveLength(2);
    expect(injected.match(/keyPassword '/g)).toHaveLength(1);
  });

  it("멱등: 이미 주입된 gradle에 다시 적용해도 변화가 없다", () => {
    const once = injectUploadSigning(TEMPLATE_GRADLE);
    expect(injectUploadSigning(once)).toBe(once);
  });

  it("RN 템플릿 앵커가 사라지면 조용히 넘어가지 않고 실패한다", () => {
    expect(() => injectUploadSigning("android { }")).toThrowError(/debug signingConfig 앵커/);
    const withoutReleaseAnchor = TEMPLATE_GRADLE.replace(
      "// see https://reactnative.dev/docs/signed-apk-android.",
      ""
    );
    expect(() => injectUploadSigning(withoutReleaseAnchor)).toThrowError(/release buildType 서명 앵커/);
  });
});

describe("REL-011 원커맨드 AAB 빌드 스크립트 (scripts/build-android-aab.ts)", () => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const buildScript = readFileSync(join(repoRoot, "scripts", "build-android-aab.ts"), "utf8");

  it("pnpm android:build-aab 한 줄로 실행된다", () => {
    expect(packageJson.scripts["android:build-aab"]).toBe("tsx scripts/build-android-aab.ts");
  });

  it("서명 env 4종 + 앱 정체성 env를 검증하고 keystore 경로 존재를 확인한다", () => {
    expect(buildScript).toContain('requireEnv(\n    "WOORIAI_UPLOAD_KEYSTORE"');
    expect(buildScript).toContain("WOORIAI_UPLOAD_KEYSTORE_NOT_FOUND");
    expect(buildScript).toContain('"WOORIAI_UPLOAD_KEYSTORE_PASSWORD"');
    expect(buildScript).toContain('"WOORIAI_UPLOAD_KEY_ALIAS"');
    expect(buildScript).toContain('"WOORIAI_UPLOAD_KEY_PASSWORD"');
    expect(buildScript).toContain('"WOORIAI_ANDROID_PACKAGE"');
    expect(buildScript).toContain('"WOORIAI_APP_VERSION"');
    expect(buildScript).toContain('"WOORIAI_ANDROID_VERSION_CODE"');
  });

  it("AAB는 항상 production: https API 강제 + 테스트 로그인/픽셀락 차단", () => {
    expect(buildScript).toContain('apiBaseUrl.startsWith("https://")');
    expect(buildScript).toContain("EXPO_PUBLIC_API_BASE_URL_NOT_HTTPS");
    expect(buildScript).toContain('EXPO_PUBLIC_TEST_LOGIN: "0"');
    expect(buildScript).toContain('EXPO_PUBLIC_PIXEL_LOCK: "0"');
    expect(buildScript).toContain('EXPO_ROUTER_APP_ROOT: "apps/mobile/app"');
  });

  it("prebuild 후 gradle :app:bundleRelease로 서명 AAB를 만들고 표준 출력 경로를 알린다", () => {
    expect(buildScript).toContain('"expo", "prebuild", "--platform", "android", "--no-install"');
    expect(buildScript).toContain('":app:bundleRelease"');
    expect(buildScript).toContain('"outputs", "bundle", "release", "app-release.aab"');
    // 주입 검증: 비밀값이 gradle 파일에 그대로 들어가면 즉시 실패해야 한다.
    expect(buildScript).toContain("SIGNING_CONFIG_NOT_INJECTED");
    expect(buildScript).toContain("SECRET_LEAKED_INTO_GRADLE");
  });

  it("--check 모드는 gradle만 제외한 전 단계(env 검증→prebuild→주입 검증)를 수행한다", () => {
    expect(buildScript).toContain('process.argv.slice(2).includes("--check")');
    expect(buildScript).toContain("CHECK PASS");
  });
});
