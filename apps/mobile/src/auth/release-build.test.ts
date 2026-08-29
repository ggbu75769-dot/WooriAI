import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEV_STUB_LOGIN_FAILED_MESSAGE,
  LOGIN_FAILED_MESSAGE,
  loginFailureMessage
} from "./login-copy";
import { isDeveloperBuild, isRealUserBuild, readBuildCharacter, resolveIsDeveloperBuild } from "./release-build";

/**
 * 라운드 73 트랙 A(GAP-073 #1ⓐ) — **갈래의 기준이 빌드 성격일 것.**
 *
 * 이 계약이 잡는 것은 "없는 것"이다: 종전에는 실사용자 빌드가 개발자용 문장을 받을 수 있다는
 * 사실이 **어떤 단언도 깨지 않았다**(문구도 갈래도 그 자리에 있었고, 다만 기준이 틀렸다).
 * 그래서 여기서는 **네 조합을 전수로** 돌려 부정 단언을 세운다 — 실사용자 빌드에서
 * "PC와 같은 Wi-Fi" 문장은 **도달 불가**다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const ORIGINAL_TEST_LOGIN = process.env.EXPO_PUBLIC_TEST_LOGIN;
const ORIGINAL_PIXEL_LOCK = process.env.EXPO_PUBLIC_PIXEL_LOCK;

function restoreEnv() {
  if (ORIGINAL_TEST_LOGIN === undefined) delete process.env.EXPO_PUBLIC_TEST_LOGIN;
  else process.env.EXPO_PUBLIC_TEST_LOGIN = ORIGINAL_TEST_LOGIN;
  if (ORIGINAL_PIXEL_LOCK === undefined) delete process.env.EXPO_PUBLIC_PIXEL_LOCK;
  else process.env.EXPO_PUBLIC_PIXEL_LOCK = ORIGINAL_PIXEL_LOCK;
}

describe("라운드 73 트랙 A — 빌드 성격 술어(src/auth/release-build.ts)", () => {
  afterEach(restoreEnv);

  it("셋 중 하나라도 참이면 개발 빌드다 (전수 8조합)", () => {
    const flags = [false, true];
    for (const devBundle of flags) {
      for (const testLogin of flags) {
        for (const pixelLock of flags) {
          const character = { devBundle, testLogin, pixelLock };
          expect(resolveIsDeveloperBuild(character), JSON.stringify(character)).toBe(
            devBundle || testLogin || pixelLock
          );
        }
      }
    }
  });

  it("실사용자 빌드는 셋이 모두 거짓인 빌드다 — Play AAB·production APK가 만드는 상태 그대로", () => {
    // scripts/build-android-aab.ts · build-android-apk.ts의 production 프로필이 못 박는 값.
    expect(resolveIsDeveloperBuild({ devBundle: false, testLogin: false, pixelLock: false })).toBe(false);
  });

  it("env 신호를 리터럴 멤버 표현식으로 읽는다 (babel-preset-expo 인라인 규칙)", () => {
    const releaseSource = source("src/auth/release-build.ts");
    expect(releaseSource).toContain('process.env.EXPO_PUBLIC_TEST_LOGIN === "1"');
    expect(releaseSource).toContain('process.env.EXPO_PUBLIC_PIXEL_LOCK === "1"');
    // 빌드 성격 판정이 카카오 env를 대용으로 쓰지 않는다 — 이 모듈의 존재 이유다.
    // (머리말이 그 결함을 이력으로 인용하는 것과, 코드가 그 값을 읽는 것은 다르다.)
    const code = releaseSource.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    expect(code).not.toContain("EXPO_PUBLIC_KAKAO");
    expect(code).not.toContain("isKakaoLoginAvailable");
  });

  it("`__DEV__`가 없는 실행기에서도 죽지 않고 나머지 두 신호로 판정한다", () => {
    // vitest에는 RN 전역이 없다. 없는 전역을 그대로 읽으면 ReferenceError로 로그인 화면이 죽는다.
    delete process.env.EXPO_PUBLIC_TEST_LOGIN;
    delete process.env.EXPO_PUBLIC_PIXEL_LOCK;
    expect(readBuildCharacter()).toEqual({ devBundle: false, testLogin: false, pixelLock: false });
    expect(isDeveloperBuild()).toBe(false);
    expect(isRealUserBuild()).toBe(true);

    process.env.EXPO_PUBLIC_TEST_LOGIN = "1";
    expect(isDeveloperBuild()).toBe(true);
    expect(isRealUserBuild()).toBe(false);

    process.env.EXPO_PUBLIC_TEST_LOGIN = "0";
    process.env.EXPO_PUBLIC_PIXEL_LOCK = "1";
    expect(isDeveloperBuild()).toBe(true);
  });
});

describe("라운드 73 트랙 A — 로그인 실패 문구의 갈래(src/auth/login-copy.ts)", () => {
  it("⚠️ 부정 단언: 실사용자 빌드에서는 어떤 조합으로도 \"PC와 같은 Wi-Fi\" 문장에 닿지 않는다", () => {
    for (const kakaoConfigured of [false, true]) {
      const message = loginFailureMessage({ developerBuild: false, kakaoConfigured });
      expect(message, `kakaoConfigured=${kakaoConfigured}`).not.toContain("PC와 같은 Wi-Fi");
      expect(message).toBe(LOGIN_FAILED_MESSAGE);
    }
  });

  it("개발 빌드의 두 문장이 바이트 단위로 종전 그대로다 (새 문구 0건)", () => {
    // 종전 app/(auth)/login.tsx:246-250의 두 리터럴 원문.
    expect(LOGIN_FAILED_MESSAGE).toBe("로그인 중 문제가 발생했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    expect(DEV_STUB_LOGIN_FAILED_MESSAGE).toBe(
      "서버에 연결할 수 없어요. PC와 같은 Wi-Fi에서 API 서버가 켜져 있는지 확인해 주세요."
    );
  });

  it("개발 빌드: 개발 스텁 경로일 때만 Wi-Fi 문장, 카카오가 설정돼 있으면 종전 첫 문장 그대로", () => {
    expect(loginFailureMessage({ developerBuild: true, kakaoConfigured: false })).toBe(
      DEV_STUB_LOGIN_FAILED_MESSAGE
    );
    expect(loginFailureMessage({ developerBuild: true, kakaoConfigured: true })).toBe(LOGIN_FAILED_MESSAGE);
  });

  it("갈래는 네 조합에서 두 문장만 낸다 (제3의 문구가 생기지 않는다)", () => {
    const produced = new Set<string>();
    for (const developerBuild of [false, true]) {
      for (const kakaoConfigured of [false, true]) {
        produced.add(loginFailureMessage({ developerBuild, kakaoConfigured }));
      }
    }
    expect([...produced].sort()).toEqual([DEV_STUB_LOGIN_FAILED_MESSAGE, LOGIN_FAILED_MESSAGE].sort());
  });
});
