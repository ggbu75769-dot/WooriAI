import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RegisterDeviceBody, UserDeviceSummary } from "../api/client";
import { deviceRowSwitchLabel, deviceRowTitle } from "./device-rows";
import { registerLocalDevice, listLocalDevices, resetLocalDevicesForTests, updateLocalDevice } from "./local-devices";
import { getPushToken, type ExpoNotificationsModule } from "./push-token-source";
import {
  buildDeviceRegistrationBody,
  resetPushRegistrationForTests,
  runPushDeviceRegistration,
  usePushRegistrationStore
} from "./usePushDeviceRegistration";

/**
 * PUSH-116 boot-registration logic (the testable core of usePushDeviceRegistration) plus the
 * local-session /me/devices mirror consumed by client.ts's local-token branch.
 */

function deviceSummary(id: string): UserDeviceSummary {
  const now = new Date().toISOString();
  return {
    id,
    platform: "android",
    notificationEnabled: true,
    appVersion: null,
    osVersion: null,
    createdAt: now,
    updatedAt: now
  };
}

describe("PUSH-116 runPushDeviceRegistration", () => {
  beforeEach(() => {
    resetPushRegistrationForTests();
  });

  it("does nothing without a session token", async () => {
    const register = vi.fn();
    await runPushDeviceRegistration(null, { getToken: async () => "tok", register });
    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing when the token source yields null (flag off / not installed / no permission)", async () => {
    const register = vi.fn();
    await runPushDeviceRegistration("auth-1", { getToken: async () => null, register });
    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing on an unsupported platform even with a token", async () => {
    const register = vi.fn();
    await runPushDeviceRegistration("auth-1", {
      getToken: async () => "tok",
      getPlatform: () => null,
      register
    });
    expect(register).not.toHaveBeenCalled();
  });

  it("registers exactly once with platform + pushToken and records the device id", async () => {
    const register = vi.fn(async (_auth: string, body: RegisterDeviceBody) => {
      expect(body.platform).toBe("android");
      expect(body.pushToken).toBe("fcm-tok-1");
      return deviceSummary("device-9");
    });
    await runPushDeviceRegistration("auth-1", {
      getToken: async () => "fcm-tok-1",
      getPlatform: () => "android",
      register
    });
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith("auth-1", expect.objectContaining({ platform: "android", pushToken: "fcm-tok-1" }));
    expect(usePushRegistrationStore.getState().registeredDeviceId).toBe("device-9");
  });

  it("is single-flight per auth token per boot (remounts never re-register)", async () => {
    const register = vi.fn(async () => deviceSummary("device-9"));
    const deps = { getToken: async () => "tok", getPlatform: () => "android" as const, register };
    await runPushDeviceRegistration("auth-1", deps);
    await runPushDeviceRegistration("auth-1", deps);
    expect(register).toHaveBeenCalledTimes(1);
    // A different session later the same boot still registers.
    await runPushDeviceRegistration("auth-2", deps);
    expect(register).toHaveBeenCalledTimes(2);
  });

  it("swallows registration failures and leaves no device id behind", async () => {
    const register = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(
      runPushDeviceRegistration("auth-1", { getToken: async () => "tok", getPlatform: () => "ios", register })
    ).resolves.toBeUndefined();
    expect(usePushRegistrationStore.getState().registeredDeviceId).toBeNull();
  });

  it("swallows a rejecting token source", async () => {
    const register = vi.fn();
    await expect(
      runPushDeviceRegistration("auth-1", {
        getToken: async () => {
          throw new Error("native boom");
        },
        register
      })
    ).resolves.toBeUndefined();
    expect(register).not.toHaveBeenCalled();
  });
});

describe("PUSH-116 local-session /me/devices mirror", () => {
  beforeEach(() => {
    resetLocalDevicesForTests();
  });

  it("registers a new device with notifications on by default and hides the push token", () => {
    const created = registerLocalDevice({ platform: "android", pushToken: "tok-a" });
    expect(created.notificationEnabled).toBe(true);
    expect(created).not.toHaveProperty("pushToken");
    expect(listLocalDevices().devices).toHaveLength(1);
  });

  it("upserts on pushToken instead of duplicating, preserving the user's toggle choice", () => {
    const created = registerLocalDevice({ platform: "android", pushToken: "tok-a" });
    updateLocalDevice(created.id, false);
    const again = registerLocalDevice({ platform: "android", pushToken: "tok-a", appVersion: "1.0.1" });
    expect(again.id).toBe(created.id);
    expect(again.notificationEnabled).toBe(false); // 갱신이 사용자의 off 선택을 되돌리지 않는다
    expect(again.appVersion).toBe("1.0.1");
    expect(listLocalDevices().devices).toHaveLength(1);
  });

  it("toggles per-device notifications and 404s unknown ids like the server", () => {
    const created = registerLocalDevice({ platform: "ios", pushToken: "tok-b", notificationEnabled: false });
    expect(created.notificationEnabled).toBe(false);
    expect(updateLocalDevice(created.id, true).notificationEnabled).toBe(true);
    expect(() => updateLocalDevice("nope", true)).toThrowError(/DEVICE_NOT_FOUND/);
  });
});

/**
 * 라운드 88 트랙 B — **등록 경로 둘이 같은 한 벌을 보낸다.**
 *
 * 종전에는 부팅 훅만 `appVersion`·`osVersion`을 실었다. 그런데 **권한을 준 적 없는 사용자의 첫
 * 기기 행을 만드는 것은 언제나 마스터 토글이다**(부팅 훅은 권한을 묻지 않아 그 창에서 토큰이
 * null이다) — 그래서 라운드 87 D가 기기 행을 가르려고 읽는 값이 정확히 그 첫 행에서만 비었고,
 * 안드로이드 기기를 둘 등록한 사람에게 두 줄이 글자 하나 다르지 않았다.
 *
 * 이 대장이 무는 것은 다섯이다: 필드 목록의 자리가 **하나**라는 것(ⓐ), 두 호출의 **키 집합이
 * 다르지 않다**는 것(ⓑ), 부팅 훅이 **여전히 권한을 묻지 않는다**는 것(ⓒ), 값이 없으면 라운드
 * 87 D의 판정대로 **종전 문자열로 돌아간다**는 것(ⓓ), 그리고 **값이 비던 그 창 자체**(ⓔ).
 *
 * ⚠️ 화면은 vitest에서 렌더되지 않으므로(react-native 네이티브 바인딩 없음) 토글 갈래는
 * `push-settings-contract.test.ts`의 관례대로 **소스로** 묶고, 그 소스가 부르는 한 벌은 여기서
 * **실행해** 확인한다. 두 게터는 이 환경에서 `require`가 실패해 `undefined`를 돌려주므로
 * 실행 쪽이 볼 수 있는 것은 **키 집합**이고, 값이 어디서 오는지는 ⓐ·ⓔ의 소스 단언이 묶는다.
 */
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const HOOK_PATH = "src/notifications/usePushDeviceRegistration.ts";
const SCREEN_PATH = "app/settings/notifications.tsx";

/** 주석은 이 트랙의 근거를 **인용**하므로(그 인용이 근거다) 코드 줄만 본다. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[^\n"'`]*\/\/.*$/gm, "");
}

/** 권한을 준 적 없는 기기: 조회는 거절, 물으면 허락(push-token-source.test.ts의 fakeModule 관례). */
function neverGrantedModule(): ExpoNotificationsModule {
  return {
    getPermissionsAsync: vi.fn(async () => ({ granted: false })),
    requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
    getDevicePushTokenAsync: vi.fn(async () => ({ type: "fcm", data: "fcm-token-1" }))
  } as ExpoNotificationsModule;
}

describe("라운드 88 트랙 B 등록 한 벌", () => {
  const originalFlag = process.env.EXPO_PUBLIC_PUSH_ENABLED;

  beforeEach(() => {
    resetPushRegistrationForTests();
    process.env.EXPO_PUBLIC_PUSH_ENABLED = "1";
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.EXPO_PUBLIC_PUSH_ENABLED;
    } else {
      process.env.EXPO_PUBLIC_PUSH_ENABLED = originalFlag;
    }
  });

  it("ⓐ 필드 목록은 한 자리가 짓고 두 호출이 함께 읽는다", () => {
    const hook = stripComments(source(HOOK_PATH));
    const screen = stripComments(source(SCREEN_PATH));

    // 목록은 빌더 안에 딱 한 번 선다 — 갈릴 자리가 없다.
    expect(hook).toContain("export function buildDeviceRegistrationBody(");
    expect(hook.match(/appVersion:/g) ?? [], "appVersion 목록 자리 전수").toHaveLength(1);
    expect(hook.match(/osVersion:/g) ?? [], "osVersion 목록 자리 전수").toHaveLength(1);

    // 두 호출이 그 한 벌을 부른다(⚠️ 호출부 없는 export가 아니다).
    expect(hook).toContain("deps.register(authToken, buildDeviceRegistrationBody({ platform, pushToken }))");
    expect(screen).toContain(
      "registerDevice(authToken!, buildDeviceRegistrationBody({ platform, pushToken, notificationEnabled: next }))"
    );
    expect(screen.match(/registerDevice\(/g) ?? [], "화면의 등록 호출 전수").toHaveLength(1);

    // 화면은 그 목록을 손으로 적지 않는다(라운드 51 P2-3: 같은 목록을 두 곳에 적지 않는다).
    expect(screen).not.toContain("osVersion:");
    expect(screen).not.toContain("appVersion");
  });

  it("ⓑ 부팅 등록과 마스터 토글 등록의 키 집합이 다르지 않다", async () => {
    const bodies: RegisterDeviceBody[] = [];
    const register = vi.fn(async (_auth: string, body: RegisterDeviceBody) => {
      bodies.push(body);
      return deviceSummary("device-boot");
    });
    await runPushDeviceRegistration("auth-keys", {
      getToken: async () => "tok-keys",
      getPlatform: () => "android",
      register
    });
    expect(register).toHaveBeenCalledTimes(1);

    // 토글이 보내는 본문 — 화면의 등록 인자가 부르는 그 한 벌이다(ⓐ의 소스 단언이 묶는다).
    const toggleBody = buildDeviceRegistrationBody({
      platform: "android",
      pushToken: "tok-keys",
      notificationEnabled: true
    });

    const bootKeys = Object.keys(bodies[0]).sort();
    const toggleKeys = Object.keys(toggleBody).sort();
    expect(bootKeys).toEqual(toggleKeys);
    // 부정 단언: 어느 쪽에도 상대가 갖지 않은 키가 없다.
    expect(bootKeys.filter((key) => !toggleKeys.includes(key)), "부팅에만 있는 키").toEqual([]);
    expect(toggleKeys.filter((key) => !bootKeys.includes(key)), "토글에만 있는 키").toEqual([]);
    // 그 집합이 오늘 갈렸던 정확히 그 둘을 포함한다.
    expect(bootKeys).toEqual(["appVersion", "notificationEnabled", "osVersion", "platform", "pushToken"]);

    // 전선은 종전과 같다: 부팅 쪽 `notificationEnabled`는 undefined라 JSON에서 지워지고
    // (client.ts requestJson의 JSON.stringify), 로컬 거울은 `?? true`로 같은 기본값을 쓴다.
    expect(bodies[0].notificationEnabled).toBeUndefined();
    expect(JSON.parse(JSON.stringify(bodies[0]))).toEqual({ platform: "android", pushToken: "tok-keys" });
    expect(registerLocalDevice(bodies[0]).notificationEnabled).toBe(true);
    resetLocalDevicesForTests();
  });

  it("ⓒ 부팅 훅은 여전히 권한을 묻지 않고, 묻는 자리는 화면의 토글 하나다", async () => {
    const notifications = neverGrantedModule();
    const register = vi.fn();
    await runPushDeviceRegistration("auth-perm", {
      // 부팅 훅의 기본값과 같은 인자다(defaultDeps.getToken은 옵션 없이 부른다).
      getToken: () => getPushToken({ loadModule: () => notifications }),
      getPlatform: () => "android",
      register
    });
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();

    const hook = stripComments(source(HOOK_PATH));
    expect(hook).toContain("getToken: () => getPushToken()");
    expect(hook, "이 트랙은 부팅 경로에 프롬프트를 늘리지 않는다").not.toContain("requestPermission");
    const screen = stripComments(source(SCREEN_PATH));
    expect(screen.match(/requestPermission: true/g) ?? [], "권한을 묻는 자리 전수").toHaveLength(1);
  });

  it("ⓓ 값이 없으면 조각이 서지 않고 종전 문자열과 바이트가 같다", () => {
    // vitest에는 react-native·expo-constants가 없어 두 게터가 undefined를 돌려준다 —
    // 값이 도달하지 못하는 창이 그대로 재현된다(지어내지 않는다).
    const body = buildDeviceRegistrationBody({ platform: "android", pushToken: "tok-none" });
    expect(body.appVersion).toBeUndefined();
    expect(body.osVersion).toBeUndefined();

    // 라운드 87 D의 판정을 그대로 지난다 — 이 트랙은 device-rows.ts를 한 바이트도 바꾸지 않는다.
    expect(deviceRowTitle("Android 기기", body.osVersion ?? null)).toBe("Android 기기");
    expect(deviceRowSwitchLabel("Android 기기", body.osVersion ?? null, false)).toBe("Android 기기 알림");
    expect(deviceRowSwitchLabel("iPhone · iOS", body.osVersion ?? null, true)).toBe("iPhone · iOS 알림, 이 기기");
    // 버전 모양이 아닌 값도 마찬가지다(원문을 흘리지 않는다).
    for (const notAVersion of ["", " ", "Unknown"]) {
      expect(deviceRowTitle("Android 기기", notAVersion), notAVersion).toBe("Android 기기");
    }
  });

  it("ⓔ 권한을 준 적 없는 사용자가 토글로 처음 등록하는 창", async () => {
    const notifications = neverGrantedModule();

    // 그 창에서 부팅 훅은 아무 행도 만들지 못한다 — **첫 기기 행은 언제나 토글이 만든다.**
    const bootRegister = vi.fn();
    await runPushDeviceRegistration("auth-window", {
      getToken: () => getPushToken({ loadModule: () => notifications }),
      getPlatform: () => "android",
      register: bootRegister
    });
    expect(bootRegister, "부팅 훅은 권한 없는 창에서 등록하지 않는다").not.toHaveBeenCalled();

    // 토글만 권한을 묻고, 그 토큰으로 화면이 만드는 본문이 이것이다(ⓐ가 그 호출을 묶는다).
    const pushToken = await getPushToken({ loadModule: () => notifications, requestPermission: true });
    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(pushToken).toBe("fcm-token-1");

    const firstRowBody = buildDeviceRegistrationBody({
      platform: "android",
      pushToken: pushToken as string,
      notificationEnabled: true
    });
    // 그 창에서도 두 값이 **함께** 실려 나간다(오늘 값이 비던 유일한 자리였다).
    expect(Object.keys(firstRowBody).sort()).toEqual([
      "appVersion",
      "notificationEnabled",
      "osVersion",
      "platform",
      "pushToken"
    ]);
    expect(firstRowBody.notificationEnabled).toBe(true);

    // 실린 값이 어디서 오는지는 소스가 묶는다(vitest에는 그 두 네이티브 소스가 없다).
    const hook = stripComments(source(HOOK_PATH));
    expect(hook).toContain("appVersion: getCurrentAppVersion()");
    expect(hook).toContain("osVersion: getCurrentOsVersion()");
  });
});
