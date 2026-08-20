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
