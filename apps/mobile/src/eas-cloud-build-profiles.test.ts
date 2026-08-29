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

/* ---------------------------------------------------------------------------
 * 라운드 73 후속(적대적 리뷰 ①) — **AAB 관문이 덮지 못하는 경로: EAS 클라우드 production.**
 *
 * `scripts/build-android-aab.ts`의 fail-closed 관문은 **로컬 파이프라인에만** 있다. 가이드가
 * 스토어 경로로 권하는 `eas build --profile production`은 그 스크립트를 한 줄도 거치지 않고,
 * `eas.json`의 `env`도 이 키들을 담지 않는다(실 키·실 주소를 커밋하지 않기 때문 — 아래 두
 * 부정 단언이 그것을 지킨다). 즉 **클라우드 경로에는 관문이 없다.**
 *
 * 관문을 클라우드에 옮겨 심을 수 없다는 것도 확인했다: 빌드 프로필의 `prebuildCommand`는 임의
 * 명령이 아니라 `npx expo <값>`의 **인자**로 쓰인다(@expo/build-tools의 `getPrebuildCommandArgs` —
 * `npx `/`expo ` 접두를 떼고 `--platform`을 덧붙여 `expo prebuild`에 넘긴다). 검증 스크립트를
 * 적으면 prebuild 자체가 깨지므로 넣지 않았다.
 *
 * 그래서 코드로 세울 수 있는 방어선은 **"덮지 못한 키는 문서가 이름으로 진다"** 하나다.
 * 목록의 주인은 여전히 빌드 스크립트이고(여기서 그 목록을 다시 적지 않는다 — 소스에서 읽는다),
 * 이 단언은 로컬 관문에 키가 늘었는데 가이드가 그대로인 상태를 잡는다.
 * ------------------------------------------------------------------------- */
const AAB_SCRIPT_PATH = join(repoRoot, "scripts", "build-android-aab.ts");
const GUIDE_PATH = join(repoRoot, "docs", "5차", "apk-build-guide.md");
const GUIDE_EAS_ENV_HEADING = "### 3-1. 실사용자 빌드가 요구하는";
/** 클라우드로 나가는 실사용자 빌드 프로필(데모 `preview`는 여기 해당하지 않는다). */
const REAL_USER_PROFILES = ["production", "production-apk"] as const;

/** 관문 목록의 주인은 빌드 스크립트다 — 키를 여기 옮겨 적지 않고 그 파일에서 읽는다. */
function releaseRequiredPublicEnvKeys(): string[] {
  const source = readFileSync(AAB_SCRIPT_PATH, "utf8");
  const marker = "const RELEASE_REQUIRED_PUBLIC_ENV: PublicEnvRequirement[] = [";
  const start = source.indexOf(marker);
  expect(start, `${AAB_SCRIPT_PATH}에 RELEASE_REQUIRED_PUBLIC_ENV 목록이 있어야 해요`).toBeGreaterThan(-1);
  const body = source.slice(start, source.indexOf("\n];", start));
  const keys = [...body.matchAll(/key:\s*"([A-Z0-9_]+)"/g)].map((match) => match[1]);
  // 목록이 비면 이 대조도 아무것도 묻지 않는 대조가 된다(스크립트 쪽도 같은 이유로 fail-closed다).
  expect(keys.length, "RELEASE_REQUIRED_PUBLIC_ENV가 비어 있어요").toBeGreaterThan(0);
  return keys;
}

/** 가이드의 §3-1(EAS 환경변수 주입 절) 본문. */
function guideEasEnvSection(): string {
  const guide = readFileSync(GUIDE_PATH, "utf8");
  const start = guide.indexOf(GUIDE_EAS_ENV_HEADING);
  expect(start, `apk-build-guide.md에 "${GUIDE_EAS_ENV_HEADING}" 절이 있어야 해요`).toBeGreaterThan(-1);
  const nextTopLevel = guide.indexOf("\n## ", start);
  return guide.slice(start, nextTopLevel === -1 ? undefined : nextTopLevel);
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

  it("실사용자 프로필이 덮지 않는 관문 키를 가이드가 이름으로 진다 (파생 단언 · 목록은 빌드 스크립트가 주인)", () => {
    const requiredKeys = releaseRequiredPublicEnvKeys();
    const section = guideEasEnvSection();
    // 절이 무엇을 하라고 말하는지부터 값이다 — "적혀만 있다"가 아니라 "EAS 환경변수로 넣어라"여야 한다.
    expect(section).toContain("EAS 환경변수");
    expect(section).toContain("eas env:list --environment production");

    for (const name of REAL_USER_PROFILES) {
      const env = profile(name).env ?? {};
      for (const key of requiredKeys) {
        // 프로필 env가 덮으면 클라우드에서도 그 값이 실린다 — 그 키는 문서에 기대지 않는다.
        if (Object.prototype.hasOwnProperty.call(env, key)) continue;
        expect(
          section,
          `${name} 프로필이 ${key}를 덮지 않으므로 apk-build-guide.md §3-1이 그 키를 이름으로 적어야 해요`
        ).toContain(key);
      }
    }
  });

  it("android/가 gitignore라 EAS가 prebuild를 돌리고 릴리즈 config plugin이 적용된다", () => {
    // 이 두 전제가 깨지면(예: android/를 커밋) EAS는 prebuild를 건너뛰고
    // network_security_config·extraPackagerArgs 패치가 빠진 채 빌드된다.
    expect(readFileSync(join(repoRoot, ".gitignore"), "utf8")).toMatch(/^android\/$/m);
    expect(readFileSync(join(mobileRoot, "app.config.js"), "utf8")).toContain("expo-config.shared");
  });
});
