import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegisterDeviceBody, UserDeviceSummary } from "../api/client";
import { registerLocalDevice, listLocalDevices, resetLocalDevicesForTests, updateLocalDevice } from "./local-devices";
import {
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
