import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * REL-013: EAS(Expo 클라우드) 빌드 프로필 계약.
 *
 * eas.json은 앱 코드가 아니라 빌드 구성이지만, 로컬 파이프라인(scripts/build-android-apk.ts,
 * scripts/build-android-aab.ts)이 env로 강제하는 "허위 빌드 금지" 규칙 — 실사용자 빌드에
 * 테스트 로그인을 켠 채 내보내지 않는다, 데모 빌드는 백엔드 없이 동작한다 — 이 클라우드
 * 빌드에서도 그대로 유지되는지 확인한다. 클라우드 빌드는 로컬 스크립트를 거치지 않으므로
 * eas.json의 env가 유일한 방어선이다.
 *
 * 스키마 정합(필드명·허용값)은 @expo/eas-json의 joi 스키마 기준으로 확인했다
 * (docs/5차/apk-build-guide.md §6). 여기서는 값 규칙만 잠근다.
 */
type BuildProfile = {
  distribution?: string;
  environment?: string;
  android?: { buildType?: string };
  env?: Record<string, string>;
};
type EasJson = {
  cli?: { version?: string; appVersionSource?: string };
  build?: Record<string, BuildProfile>;
  submit?: Record<string, unknown>;
};

const mobileRoot = process.cwd();
const repoRoot = join(mobileRoot, "..", "..");
const easJsonPath = join(mobileRoot, "eas.json");
const easJsonRaw = readFileSync(easJsonPath, "utf8");
// 주석 없는 순수 JSON 유지: eas-cli는 JSON5도 읽지만, 다른 도구가 JSON.parse로 읽어도
// 깨지지 않도록 한다.
const easJson = JSON.parse(easJsonRaw) as EasJson;

function profile(name: string): BuildProfile {
  const found = easJson.build?.[name];
  expect(found, `eas.json build.${name} 프로필이 없습니다`).toBeDefined();
  return found as BuildProfile;
}

describe("EAS 클라우드 빌드 프로필", () => {
  it("APK 2종 + 스토어 AAB 1종을 제공한다", () => {
    expect(profile("preview").android?.buildType).toBe("apk");
    expect(profile("production-apk").android?.buildType).toBe("apk");
    expect(profile("production").android?.buildType).toBe("app-bundle");
    expect(profile("preview").distribution).toBe("internal");
    expect(profile("production-apk").distribution).toBe("internal");
    expect(profile("production").distribution).toBe("store");
  });

  it("preview는 백엔드 없이 도는 데모 빌드다 (로컬 standalone 프로필과 동일 env)", () => {
    // scripts/build-android-apk.ts의 standalone: EXPO_PUBLIC_TEST_LOGIN=1, PIXEL_LOCK=0.
    const env = profile("preview").env ?? {};
    expect(env.EXPO_PUBLIC_TEST_LOGIN).toBe("1");
    expect(env.EXPO_PUBLIC_PIXEL_LOCK).toBe("0");
    // 데모 빌드에는 실 백엔드가 없으므로 카카오 로그인·푸시 경로도 꺼진 채로 나가야 한다.
    expect(env.EXPO_PUBLIC_KAKAO_ENABLED).toBe("0");
    expect(env.EXPO_PUBLIC_PUSH_ENABLED).toBe("0");
  });

  it("실사용자 빌드는 테스트 로그인을 절대 켜지 않는다", () => {
    for (const name of ["production-apk", "production"]) {
      const env = profile(name).env ?? {};
      expect(env.EXPO_PUBLIC_TEST_LOGIN, `${name} 프로필`).toBe("0");
      expect(env.EXPO_PUBLIC_PIXEL_LOCK, `${name} 프로필`).toBe("0");
    }
  });

  it("API 주소를 eas.json에 플레이스홀더로 박아두지 않는다", () => {
    // 가짜 주소가 커밋돼 있으면 실사용자 빌드가 "동작하는 것처럼" 나간다.
    // 실 주소는 EAS 환경변수(eas env:create)로만 주입한다 — apk-build-guide.md §3.
    expect(easJsonRaw).not.toContain("EXPO_PUBLIC_API_BASE_URL");
  });

  it("비밀값·서명 키 관련 env를 eas.json에 담지 않는다", () => {
    // 업로드 keystore는 EAS가 관리하거나 `eas credentials`로 업로드한다.
    // (EAS는 빌드 시점에 eas-build-inject-android-credentials.gradle을 build.gradle 끝에
    //  apply해 release 서명을 덮으므로 WOORIAI_UPLOAD_*를 클라우드에 넣어도 무의미하다.)
    expect(easJsonRaw).not.toContain("WOORIAI_UPLOAD_");
    expect(easJsonRaw.toLowerCase()).not.toMatch(/password|secret|serviceaccount|"token"/);
  });

  it("모든 env 값이 문자열이다 (EAS 스키마 요구)", () => {
    for (const [name, buildProfile] of Object.entries(easJson.build ?? {})) {
      for (const [key, value] of Object.entries(buildProfile.env ?? {})) {
        expect(typeof value, `build.${name}.env.${key}`).toBe("string");
      }
    }
  });

  it("versionCode는 config plugin(env)이 정하므로 appVersionSource는 local이다", () => {
    // expo-config.shared.js가 WOORIAI_ANDROID_VERSION_CODE를 읽어 app config에 넣는다.
    // remote로 두면 EAS가 versionCode를 따로 관리해 로컬 AAB 빌드와 값이 어긋난다.
    expect(easJson.cli?.appVersionSource).toBe("local");
  });

  it("android/가 gitignore라 EAS가 prebuild를 돌리고 릴리즈 config plugin이 적용된다", () => {
    // 이 두 전제가 깨지면(예: android/를 커밋) EAS는 prebuild를 건너뛰고
    // network_security_config·extraPackagerArgs 패치가 빠진 채 빌드된다.
    expect(readFileSync(join(repoRoot, ".gitignore"), "utf8")).toMatch(/^android\/$/m);
    expect(readFileSync(join(mobileRoot, "app.config.js"), "utf8")).toContain("expo-config.shared");
  });
});
