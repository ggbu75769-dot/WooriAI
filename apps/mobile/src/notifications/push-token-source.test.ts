import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPushToken,
  isPushEnabled,
  isPushSupported,
  MAX_PUSH_TOKEN_LENGTH,
  tryLoadExpoNotifications,
  type ExpoNotificationsModule
} from "./push-token-source";

/**
 * PUSH-116 token-source gate: the scaffold must resolve null (never reject, never touch the
 * native module) whenever push cannot work -- flag off, expo-notifications not installed,
 * permission missing -- and must only prompt for the OS permission when explicitly asked to.
 */

const originalFlag = process.env.EXPO_PUBLIC_PUSH_ENABLED;

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.EXPO_PUBLIC_PUSH_ENABLED;
  } else {
    process.env.EXPO_PUBLIC_PUSH_ENABLED = originalFlag;
  }
});

function fakeModule(overrides: Partial<ExpoNotificationsModule> = {}): ExpoNotificationsModule {
  return {
    getPermissionsAsync: vi.fn(async () => ({ granted: true })),
    requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
    getDevicePushTokenAsync: vi.fn(async () => ({ type: "fcm", data: "fcm-token-1" })),
    ...overrides
  } as ExpoNotificationsModule;
}

describe("PUSH-116 push token source", () => {
  it("returns null with the flag off, without even loading the module", async () => {
    delete process.env.EXPO_PUBLIC_PUSH_ENABLED;
    const loadModule = vi.fn(() => fakeModule());
    expect(isPushEnabled()).toBe(false);
    await expect(getPushToken({ loadModule })).resolves.toBeNull();
    expect(loadModule).not.toHaveBeenCalled();
  });

  it("treats any value other than \"1\" as off", async () => {
    process.env.EXPO_PUBLIC_PUSH_ENABLED = "true";
    await expect(getPushToken({ loadModule: () => fakeModule() })).resolves.toBeNull();
  });

  it("returns null when expo-notifications is not installed (flag on)", async () => {
    process.env.EXPO_PUBLIC_PUSH_ENABLED = "1";
    // The real loader: the dependency is genuinely absent in this workspace, so the dynamic
    // require inside try/catch must swallow the resolution failure.
    expect(tryLoadExpoNotifications()).toBeNull();
    await expect(getPushToken()).resolves.toBeNull();
    expect(isPushSupported()).toBe(false);
  });

  it("resolves the native device token when the module is present and permission granted", async () => {
    process.env.EXPO_PUBLIC_PUSH_ENABLED = "1";
    const module = fakeModule();
    await expect(getPushToken({ loadModule: () => module })).resolves.toBe("fcm-token-1");
    expect(isPushSupported(() => module)).toBe(true);
  });

  it("does not prompt for permission by default (boot path stays silent)", async () => {
    process.env.EXPO_PUBLIC_PUSH_ENABLED = "1";
    const module = fakeModule({ getPermissionsAsync: vi.fn(async () => ({ granted: false })) });
    await expect(getPushToken({ loadModule: () => module })).resolves.toBeNull();
    expect(module.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(module.getDevicePushTokenAsync).not.toHaveBeenCalled();
  });

  it("prompts once when requestPermission is true and returns the token on grant", async () => {
    process.env.EXPO_PUBLIC_PUSH_ENABLED = "1";
    const module = fakeModule({ getPermissionsAsync: vi.fn(async () => ({ granted: false })) });
    await expect(getPushToken({ loadModule: () => module, requestPermission: true })).resolves.toBe("fcm-token-1");
    expect(module.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("returns null when the prompt is denied", async () => {
    process.env.EXPO_PUBLIC_PUSH_ENABLED = "1";
    const module = fakeModule({
      getPermissionsAsync: vi.fn(async () => ({ granted: false })),
      requestPermissionsAsync: vi.fn(async () => ({ granted: false }))
    });
    await expect(getPushToken({ loadModule: () => module, requestPermission: true })).resolves.toBeNull();
    expect(module.getDevicePushTokenAsync).not.toHaveBeenCalled();
  });

  it("rejects tokens that would fail the server DTO bound instead of sending them", async () => {
    process.env.EXPO_PUBLIC_PUSH_ENABLED = "1";
    const tooLong = fakeModule({
      getDevicePushTokenAsync: vi.fn(async () => ({ type: "fcm", data: "x".repeat(MAX_PUSH_TOKEN_LENGTH + 1) }))
    });
    await expect(getPushToken({ loadModule: () => tooLong })).resolves.toBeNull();

    const nonString = fakeModule({
      getDevicePushTokenAsync: vi.fn(async () => ({ type: "fcm", data: 12345 }))
    });
    await expect(getPushToken({ loadModule: () => nonString })).resolves.toBeNull();
  });

  it("swallows native-module rejections into null", async () => {
    process.env.EXPO_PUBLIC_PUSH_ENABLED = "1";
    const throwing = fakeModule({
      getDevicePushTokenAsync: vi.fn(async () => {
        throw new Error("native boom");
      })
    });
    await expect(getPushToken({ loadModule: () => throwing })).resolves.toBeNull();
  });
});
