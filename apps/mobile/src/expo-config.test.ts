import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
// REL-009 공유 릴리즈 구성은 순수 CJS라 node/vitest에서 그대로 불러올 수 있다
// (플러그인 require는 함수 참조만 가져오고 실행하지 않는다).
import { applyWooriaiConfig } from "../expo-config.shared";

const baseExpo = {
  name: "wooriai",
  version: "0.9.0",
  android: { package: "kr.wooriai.dev" },
  plugins: []
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("REL-009 expo-config.shared versionCode 파싱 (WOORIAI_ANDROID_VERSION_CODE)", () => {
  it("미설정이면 versionCode를 얹지 않는다", () => {
    vi.stubEnv("WOORIAI_ANDROID_VERSION_CODE", "");
    const config = applyWooriaiConfig(baseExpo);
    expect(config.android.versionCode).toBeUndefined();
  });

  it("전체가 십진 숫자인 값만 정수 versionCode로 파싱한다", () => {
    vi.stubEnv("WOORIAI_ANDROID_VERSION_CODE", "42");
    const config = applyWooriaiConfig(baseExpo);
    expect(config.android.versionCode).toBe(42);
  });

  it('parseInt가 조용히 삼키던 쓰레기 값("1.5", "2abc", "1O0", " 3", "0x10")은 한국어 오류로 거부한다', () => {
    for (const garbage of ["1.5", "2abc", "1O0", " 3", "3 ", "0x10", "+1", "-1", "1e3"]) {
      vi.stubEnv("WOORIAI_ANDROID_VERSION_CODE", garbage);
      expect(() => applyWooriaiConfig(baseExpo)).toThrowError(
        `WOORIAI_ANDROID_VERSION_CODE는 양의 정수여야 합니다: ${garbage}`
      );
    }
  });

  it("0은 양의 정수가 아니므로 거부한다", () => {
    vi.stubEnv("WOORIAI_ANDROID_VERSION_CODE", "0");
    expect(() => applyWooriaiConfig(baseExpo)).toThrowError(
      "WOORIAI_ANDROID_VERSION_CODE는 양의 정수여야 합니다: 0"
    );
  });
});

/**
 * 실기기 APK 피드백 3·4 (첫 로딩 화면 / 앱 아이콘).
 *
 * 3: 네이티브 스플래시가 아예 미설정이라 앱이 뜨는 첫 순간이 빈 흰 화면이었고, 그 뒤
 *    launch-animation 화면이 잘려 보였다. expo-splash-screen을 붙여 첫 프레임부터
 *    브랜드 배경(크림) + 로고가 보이게 한다.
 * 4: 아이콘 자산은 새로 그렸지만(지갑 + 아이 얼굴) adaptive foreground가 투명 배경이라
 *    런처가 쓰는 배경색이 아이콘 그라데이션 상단색과 어긋나 있었다.
 */
describe("실기기 피드백 3·4: 네이티브 스플래시 + 앱 아이콘 배선 (app.json)", () => {
  const appConfig = JSON.parse(readFileSync(join(process.cwd(), "app.json"), "utf8")).expo;

  it("expo-splash-screen 플러그인이 Sprout Wallet splash-mark 자산·크림 배경으로 설정돼 있다 (DSN-053 P0)", () => {
    const splashPlugin = appConfig.plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen"
    );
    expect(splashPlugin, "app.json plugins에 expo-splash-screen이 있어야 한다").toBeTruthy();
    expect(splashPlugin[1]).toEqual({
      image: "./assets/splash-mark.png",
      imageWidth: 200,
      resizeMode: "contain",
      backgroundColor: "#FFF9F3"
    });
    expect(existsSync(join(process.cwd(), "assets/splash-mark.png"))).toBe(true);
  });

  it("expo-splash-screen이 mobile 의존성으로 잠겨 있다 (CI는 frozen-lockfile)", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    expect(pkg.dependencies["expo-splash-screen"]).toBeTruthy();
  });

  it("앱 아이콘·적응형 아이콘 자산이 있고 배경색이 아이콘 코랄과 같다", () => {
    expect(appConfig.icon).toBe("./assets/icon.png");
    expect(appConfig.android.adaptiveIcon.foregroundImage).toBe("./assets/adaptive-icon.png");
    // DSN-053 P0: c20deeb Sprout Wallet 원본 복원 — 아이콘 배경과 같은 크림(#FFF9F3).
    // monochrome은 Android 13+ 테마 아이콘용(원본 계보와 동일).
    expect(appConfig.android.adaptiveIcon.backgroundColor).toBe("#FFF9F3");
    expect(appConfig.android.adaptiveIcon.monochromeImage).toBe("./assets/monochrome-icon.png");
    expect(appConfig.notification).toEqual({ icon: "./assets/notification-icon.png", color: "#FF6B4A" });
    for (const asset of ["assets/icon.png", "assets/adaptive-icon.png"]) {
      expect(existsSync(join(process.cwd(), asset)), `${asset} should exist`).toBe(true);
    }
  });
});
