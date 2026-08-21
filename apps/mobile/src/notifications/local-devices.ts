import type { RegisterDeviceBody, UserDeviceSummary } from "../api/client";

/**
 * PUSH-116: local-session (demo/test) mirror of the server's /me/devices endpoints
 * (apps/api/src/devices/devices.controller.ts, NOTI-100), consumed by the local-token branch of
 * registerDevice/listMyDevices/updateDevice in src/api/client.ts.
 *
 * Deliberately in-memory (module scope), NOT persisted like src/api/local-backend.ts's store:
 * a push token is per-boot runtime state of the physical device -- persisting a demo session's
 * fake registration across restarts would show a stale "등록됨" for a token that no longer
 * exists. In practice a local test session never obtains a real push token anyway (the
 * expo-notifications scaffold returns null, see push-token-source.ts), so this exists so the
 * SET-006 screen and the boot-registration hook behave contract-identically in demo mode.
 *
 * Semantics mirrored from the server:
 * - register is an upsert on pushToken: same token updates the existing row instead of creating
 *   a duplicate; a fresh registration defaults notificationEnabled to true; an update keeps the
 *   user's previous toggle choice when the body omits it.
 * - update of an unknown device id fails like the server's 404 DEVICE_NOT_FOUND.
 */

type LocalDeviceRecord = {
  id: string;
  platform: string;
  pushToken: string;
  notificationEnabled: boolean;
  appVersion: string | null;
  osVersion: string | null;
  createdAt: string;
  updatedAt: string;
};

let localDevices: LocalDeviceRecord[] = [];
let localDeviceIdCounter = 0;

// 서버의 toDeviceResponse와 동일하게 pushToken은 응답에서 제외한다.
function toDeviceSummary(device: LocalDeviceRecord): UserDeviceSummary {
  return {
    id: device.id,
    platform: device.platform,
    notificationEnabled: device.notificationEnabled,
    appVersion: device.appVersion,
    osVersion: device.osVersion,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt
  };
}

export function registerLocalDevice(body: RegisterDeviceBody): UserDeviceSummary {
  const now = new Date().toISOString();
  const existing = localDevices.find((device) => device.pushToken === body.pushToken);
  if (existing) {
    existing.platform = body.platform;
    existing.appVersion = body.appVersion ?? existing.appVersion;
    existing.osVersion = body.osVersion ?? existing.osVersion;
    existing.notificationEnabled = body.notificationEnabled ?? existing.notificationEnabled;
    existing.updatedAt = now;
    return toDeviceSummary(existing);
  }
  localDeviceIdCounter += 1;
  const created: LocalDeviceRecord = {
    id: `local-device-${localDeviceIdCounter}`,
    platform: body.platform,
    pushToken: body.pushToken,
    notificationEnabled: body.notificationEnabled ?? true,
    appVersion: body.appVersion ?? null,
    osVersion: body.osVersion ?? null,
    createdAt: now,
    updatedAt: now
  };
  localDevices.push(created);
  return toDeviceSummary(created);
}

export function listLocalDevices(): { devices: UserDeviceSummary[] } {
  return { devices: localDevices.map(toDeviceSummary) };
}

export function updateLocalDevice(deviceId: string, notificationEnabled: boolean): UserDeviceSummary {
  const device = localDevices.find((entry) => entry.id === deviceId);
  if (!device) {
    // 서버 404 응답 본문과 같은 메시지 -- 화면의 실패 처리 경로가 세션 종류와 무관하게 동작한다.
    throw new Error(JSON.stringify({ error: { code: "DEVICE_NOT_FOUND", message: "등록된 기기를 찾을 수 없어요." } }));
  }
  device.notificationEnabled = notificationEnabled;
  device.updatedAt = new Date().toISOString();
  return toDeviceSummary(device);
}

/** Test-only helper (mirrors resetLocalBackendForTests in src/api/local-backend.ts). */
export function resetLocalDevicesForTests() {
  localDevices = [];
  localDeviceIdCounter = 0;
}
