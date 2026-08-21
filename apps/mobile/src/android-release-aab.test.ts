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

  it("주입은 원자적: injectUploadSigning 단일 호출이 release 서명 블록과 buildType 전환 ternary를 함께 만든다", () => {
    // 4차 리뷰 F5: 두 주입이 별개 게이트로 갈라지면 "release 블록은 있는데 전환은 안 된"
    // (또는 그 반대) 반쪽 상태가 가능해진다. 단일 순수 함수가 둘 다 만들어야 한다.
    const injected = injectUploadSigning(TEMPLATE_GRADLE);
    const hasReleaseSigningBlock = injected.includes('storeFile file(System.getenv("WOORIAI_UPLOAD_KEYSTORE"))');
    const hasBuildTypeSwitch = injected.includes(
      'signingConfig System.getenv("WOORIAI_UPLOAD_KEYSTORE") ? signingConfigs.release : signingConfigs.debug'
    );
    expect(hasReleaseSigningBlock).toBe(true);
    expect(hasBuildTypeSwitch).toBe(true);
    // 미주입 입력에는 둘 다 없어야 한다 — 한쪽만 존재하는 상태를 만들 경로가 없음을 고정.
    expect(TEMPLATE_GRADLE).not.toContain("signingConfigs.release");
    expect(TEMPLATE_GRADLE).not.toContain("System.getenv");
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

// 4차 리뷰 후속 계약: 서명 env 격리(F1) + 누출 검사 스코프(F2).
describe("4차 리뷰: 업로드 서명 env 격리 및 누출 검사 스코프", () => {
  const aabScript = readFileSync(join(repoRoot, "scripts", "build-android-aab.ts"), "utf8");
  const apkScript = readFileSync(join(repoRoot, "scripts", "build-android-apk.ts"), "utf8");

  it("F1: build-android-apk.ts는 WOORIAI_UPLOAD_* env를 자식 gradle env에서 제거한다 (APK는 항상 debug 서명)", () => {
    // AAB 빌드 후 셸에 export가 남아도 standalone/demo APK가 업로드 키로 서명되지 않는다.
    expect(apkScript).toContain('key.startsWith("WOORIAI_UPLOAD_")');
    expect(apkScript).toContain("delete inheritedEnv[key]");
    // gradle에는 정리된 env가 넘어가야 한다 — process.env를 직접 전개하지 않는다.
    expect(apkScript).toContain("...inheritedEnv,");
    expect(apkScript).not.toContain("...process.env,");
    // 제거가 일어났으면 한 줄 알림을 남긴다.
    expect(apkScript).toContain("debug 서명 유지");
  });

  it("F2: AAB 누출 검사는 REL-011 주입 블록에만 적용된다 (debug keystore 리터럴 'android' 오탐 방지)", () => {
    // 파일 전체 대상 includes(secret) 검사는 금지 — 주입 영역만 잘라 검사한다.
    expect(aabScript).not.toContain("gradle.includes(secret)");
    expect(aabScript).toContain("injectedText.includes(secret)");
    expect(aabScript).toContain("collectInjectedRegion");
    expect(aabScript).toContain('"// REL-011 자동 주입 (plugins/with-wooriai-android-release.js)"');
    expect(aabScript).toContain('"// REL-011: gradle 실행 시점에 env가 있으면 업로드 keystore 서명"');
    // 마커가 사라지면 검사가 헛도는 대신 fail-closed로 실패한다.
    expect(aabScript).toContain("SIGNING_INJECTION_MARKER_MISSING");
    // 실제 누출은 여전히 즉시 실패 + 오탐 가능성을 안내하는 완화된 문구.
    expect(aabScript).toContain("SECRET_LEAKED_INTO_GRADLE");
    expect(aabScript).toContain("누출 또는 흔한 gradle 문자열과의 충돌");
  });
});
