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

/**
 * 라운드 73 트랙 A(GAP-073 #1ⓑⓓ) — **실사용자 빌드가 요구하는 EXPO_PUBLIC_* 집합.**
 *
 * 종전 이 파이프라인이 fail-closed로 물은 EXPO_PUBLIC_*는 API 주소 하나뿐이었다. 나머지
 * 일곱은 같은 성질(없어도 빌드는 끝까지 성공하고, 앱은 조용히 다른 것을 한다)인데도 침묵했다.
 *
 * 계약의 형태가 목록이다 — 파일이 아니라 **집합**을 센다. 스크립트를 그대로 실행하면 prebuild가
 * 돌기 때문에(그리고 keystore가 필요하다), 이 저장소가 스크립트 계약에 쓰는 소스 검증 관례를
 * 따르되 **목록의 성질**(비어 있지 않음 · 필수/opt-out 분리 · 키마다 손실 한 줄)을 단언한다.
 */
describe("라운드 73 트랙 A — AAB가 실사용자 빌드의 EXPO_PUBLIC_*를 fail-closed로 묻는다", () => {
  const buildScript = readFileSync(join(repoRoot, "scripts", "build-android-aab.ts"), "utf8");

  const listBody = (name: string) => {
    const start = buildScript.indexOf(`const ${name}: PublicEnvRequirement[] = [`);
    expect(start, `${name} 목록이 없습니다`).toBeGreaterThan(-1);
    return buildScript.slice(start, buildScript.indexOf("\n];", start));
  };
  const keysIn = (name: string) => [...listBody(name).matchAll(/key:\s*"([A-Z0-9_]+)"/g)].map((m) => m[1]);

  it("ⓐ 집합이 값으로 서 있고 비어 있지 않다 (비면 빌드가 스스로 거부한다)", () => {
    expect(keysIn("RELEASE_REQUIRED_PUBLIC_ENV").length).toBeGreaterThan(0);
    // 목록이 비면 이 관문은 아무것도 묻지 않는 관문이 된다 — 그 상태에도 fail-closed다.
    expect(buildScript).toContain("RELEASE_PUBLIC_ENV_LIST_EMPTY");
    expect(buildScript).toContain("if (RELEASE_REQUIRED_PUBLIC_ENV.length === 0)");
  });

  it("ⓑ 필수는 카카오 셋 + 약관·개인정보 둘이다 (없으면 앱이 오동작하거나 읽지 못한 문서에 동의시킨다)", () => {
    expect(keysIn("RELEASE_REQUIRED_PUBLIC_ENV")).toEqual([
      "EXPO_PUBLIC_KAKAO_ENABLED",
      "EXPO_PUBLIC_KAKAO_CLIENT_ID",
      "EXPO_PUBLIC_KAKAO_REDIRECT_URI",
      "EXPO_PUBLIC_TERMS_URL",
      "EXPO_PUBLIC_PRIVACY_POLICY_URL"
    ]);
    // 카카오는 "주입됐는가"가 아니라 "켜졌는가"를 묻는다(앱의 getKakaoEnvConfig와 같은 판정).
    expect(buildScript).toContain('process.env.EXPO_PUBLIC_KAKAO_ENABLED !== "1"');
    expect(buildScript).toContain("EXPO_PUBLIC_KAKAO_ENABLED_NOT_ENABLED");
    // 거부는 API 주소와 같은 형식(`<KEY>_REQUIRED: 이유`)으로 나간다.
    expect(buildScript).toContain("`${name}_REQUIRED: ${hint}`");
    expect(buildScript).toContain("requireEnv(spec.key, spec.loss);");
  });

  it("ⓒ 지원·FAQ 둘은 명시 opt-out에서만 통과하고, 그때 손실을 출력한다", () => {
    expect(keysIn("RELEASE_OPTIONAL_PUBLIC_ENV")).toEqual(["EXPO_PUBLIC_SUPPORT_URL", "EXPO_PUBLIC_FAQ_URL"]);
    expect(buildScript).toContain('const SUPPORT_LINKS_OPT_OUT = "WOORIAI_ALLOW_MISSING_SUPPORT_LINKS";');
    expect(buildScript).toContain("const optedOut = process.env[SUPPORT_LINKS_OPT_OUT] === \"1\";");
    // opt-out이 아니면 필수와 같은 형식으로 거부한다.
    expect(buildScript).toContain("`${missingOptional[0].key}_REQUIRED: ${missingOptional[0].loss} `");
    // opt-out이어도 침묵하지 않는다 — L-3이 예고한 그 상태를 값으로 말한다.
    expect(buildScript).toContain("앱 안에 도움으로 가는 길이 0건인 채로 나갑니다.");
    expect(buildScript).toContain("console.warn(`[android:build-aab] ${SUPPORT_LINKS_OPT_OUT}=1");
  });

  it("ⓓ 키마다 \"없으면 사용자가 무엇을 잃는가\"가 한 줄씩 있고, 그 줄이 곧 거부 메시지다", () => {
    for (const name of ["RELEASE_REQUIRED_PUBLIC_ENV", "RELEASE_OPTIONAL_PUBLIC_ENV"]) {
      const body = listBody(name);
      const keys = keysIn(name);
      const losses = [...body.matchAll(/loss:/g)];
      expect(losses.length, `${name}: 키 ${keys.length}개에 손실 문구 ${losses.length}개`).toBe(keys.length);
    }
  });

  it("ⓔ DNC-019: 거부 메시지에 env **값**이 실리지 않는다 (키 이름과 이유만)", () => {
    const start = buildScript.indexOf("type PublicEnvRequirement");
    const end = buildScript.indexOf("function buildChildEnv");
    const region = buildScript.slice(start, end);
    // 값 보간(`${process.env[...]}` · `${value}`)이 이 영역의 어떤 메시지에도 없다.
    expect(region).not.toMatch(/\$\{process\.env\[[^\]]+\]\}/);
    expect(region).not.toMatch(/\$\{value\}/);
    // 라운드 73 후속(적대적 리뷰 ⑧): 같은 누출이 **점 접근**으로도 쓰인다 —
    // `${process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID}`는 대괄호 형태를 막아도 그대로 통과했다.
    expect(region).not.toMatch(/\$\{process\.env\.[A-Za-z_$][\w$]*\}/);
    expect(region).toContain("// 값은 출력하지 않는다(DNC-019)");
  });

  /**
   * 라운드 73 후속(적대적 리뷰 ⑨) — **"열 수 있는 주소"의 판정이 두 벌이 되지 않는다.**
   *
   * 관문의 `assertHttpUrl`은 주석으로 "앱의 normalize 규칙과 같은 판정"이라고 말하는데,
   * 그 말이 참인지는 아무도 묻지 않았다. 두 규칙이 갈리면 관문이 통과시킨 값이 앱에서
   * **주입되지 않은 것과 같이** 취급되고(링크가 조용히 사라진다), 반대로 앱은 열 수 있는 값을
   * 관문이 막을 수도 있다. 그래서 세 자리의 정규식 원문이 글자 단위로 같은지 본다.
   */
  it("ⓖ URL 판정 정규식이 앱의 normalize 소스 둘과 글자 단위로 같다", () => {
    const urlPattern = /\/\^https\?:\\\/\\\/\\S\+\$\/i/;
    const scriptMatch = urlPattern.exec(buildScript);
    expect(scriptMatch, "build-android-aab.ts의 http(s) 판정 정규식을 찾지 못했어요").not.toBeNull();

    // 앱 쪽 단일 소스 둘(동의 문서 링크 · 지원/FAQ 링크).
    for (const relativePath of ["src/consent/legal-links.ts", "src/settings/support-links.ts"]) {
      const source = readFileSync(join(process.cwd(), relativePath), "utf8");
      const appMatch = urlPattern.exec(source);
      expect(appMatch, `${relativePath}의 normalize 정규식을 찾지 못했어요`).not.toBeNull();
      expect(appMatch![0], `${relativePath} ↔ build-android-aab.ts`).toBe(scriptMatch![0]);
      // 그 판정이 "trim한 값"에 걸린다는 것도 양쪽이 같다.
      expect(source).toContain(".trim()");
    }
    expect(buildScript).toContain("process.env[spec.key] ?? \"\"");
    expect(buildScript).toContain(".trim()");
    // 그리고 그 사실을 스크립트가 주석으로 가리키는 자리도 남아 있어야 한다(다음 사람이 찾을 길).
    expect(buildScript).toContain("src/consent/legal-links.ts");
    expect(buildScript).toContain("src/settings/support-links.ts");
  });

  it("ⓕ 이 관문은 서명·정체성 검증과 같은 자리(validateEnv)에서 fail-closed로 돈다", () => {
    expect(buildScript).toContain("validateReleasePublicEnv();");
    const validateStart = buildScript.indexOf("function validateEnv(): SigningEnv");
    const validateEnd = buildScript.indexOf("function buildChildEnv");
    const validateBody = buildScript.slice(validateStart, validateEnd);
    expect(validateBody).toContain("validateReleasePublicEnv();");
    // 반환(=빌드 진행) 전에 호출된다.
    expect(validateBody.indexOf("validateReleasePublicEnv();")).toBeLessThan(
      validateBody.indexOf("return { keystorePath")
    );
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
