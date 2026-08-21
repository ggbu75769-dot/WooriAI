import { useEffect } from "react";
import { create } from "zustand";
import {
  registerDevice,
  updateDevice,
  type DevicePlatform,
  type RegisterDeviceBody,
  type UserDeviceSummary
} from "../api/client";
import { getPushToken } from "./push-token-source";

/**
 * PUSH-116 boot registration: as soon as a session exists AND the push flag is on AND the
 * device can actually produce a push token (expo-notifications installed + OS permission
 * already granted -- see push-token-source.ts), register this device against POST /me/devices.
 * The server upserts on (user, pushToken), so firing this on every boot is idempotent; any
 * failure is swallowed (푸시 등록은 best-effort -- 절대 부팅/네비게이션을 막지 않는다).
 *
 * Mounted from app/(tabs)/_layout.tsx (the first point where a usable session is guaranteed,
 * chosen over app/_layout.tsx to keep the root layout untouched). Token null이면 아무 것도
 * 하지 않으므로 expo-notifications 미설치/플래그 off인 오늘의 빌드에서는 완전한 no-op이다.
 */

type PushRegistrationState = {
  /** POST /me/devices가 돌려준 이 기기의 row id. list 응답은 pushToken을 숨기므로(서버
   * toDeviceResponse) "이 기기" 판별은 이 id로만 가능하다 -- SET-006 화면이 구독한다. */
  registeredDeviceId: string | null;
  setRegisteredDeviceId: (deviceId: string | null) => void;
};

/** Per-boot runtime state only (푸시 토큰과 같은 수명) -- deliberately not persisted. */
export const usePushRegistrationStore = create<PushRegistrationState>()((set) => ({
  registeredDeviceId: null,
  setRegisteredDeviceId: (registeredDeviceId) => set({ registeredDeviceId })
}));

/** react-native/expo-constants는 vitest/node에서 로드 불가라 지연 require로만 읽는다
 * (kakao-login.ts의 lazy expo-linking과 같은 이유). */
export function getCurrentDevicePlatform(): DevicePlatform | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require("react-native") as { Platform: { OS: string } };
    return Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;
  } catch {
    return null;
  }
}

function getCurrentOsVersion(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require("react-native") as { Platform: { Version: unknown } };
    return Platform.Version === undefined ? undefined : String(Platform.Version).slice(0, 64);
  } catch {
    return undefined;
  }
}

function getCurrentAppVersion(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const imported = require("expo-constants") as {
      default?: { expoConfig?: { version?: string } };
      expoConfig?: { version?: string };
    };
    const version = (imported.default ?? imported).expoConfig?.version;
    return typeof version === "string" ? version.slice(0, 32) : undefined;
  } catch {
    return undefined;
  }
}

export type PushRegistrationDeps = {
  getToken: () => Promise<string | null>;
  getPlatform: () => DevicePlatform | null;
  register: (authToken: string, body: RegisterDeviceBody) => Promise<UserDeviceSummary>;
  onRegistered: (deviceId: string) => void;
};

const defaultDeps: PushRegistrationDeps = {
  getToken: () => getPushToken(),
  getPlatform: getCurrentDevicePlatform,
  register: registerDevice,
  onRegistered: (deviceId) => usePushRegistrationStore.getState().setRegisteredDeviceId(deviceId)
};

/**
 * Single-flight per auth token per boot: remounts of the tabs layout (ErrorBoundary retry,
 * fast refresh) never re-register; a *different* session logging in later the same boot does.
 * The guard is kept even on failure -- 실패 무시 계약: 다음 부팅의 재시도(서버 upsert 멱등)로
 * 충분하고, 같은 부팅 안에서 등록 재시도 폭주를 만들지 않는다.
 */
const attemptedAuthTokens = new Set<string>();

/** Test-only helper: clears the single-flight guard and the registered-device id. */
export function resetPushRegistrationForTests() {
  attemptedAuthTokens.clear();
  usePushRegistrationStore.setState({ registeredDeviceId: null });
}

/** The hook's whole logic, extracted for direct testing (`overrides` = test seam only). */
export async function runPushDeviceRegistration(
  authToken: string | null,
  overrides: Partial<PushRegistrationDeps> = {}
): Promise<void> {
  if (!authToken) return;
  if (attemptedAuthTokens.has(authToken)) return;
  attemptedAuthTokens.add(authToken);
  const deps: PushRegistrationDeps = { ...defaultDeps, ...overrides };
  try {
    const pushToken = await deps.getToken();
    if (!pushToken) return; // 플래그 off / 미설치 / 권한 없음 -- 아무 것도 안 함.
    const platform = deps.getPlatform();
    if (!platform) return;
    const registered = await deps.register(authToken, {
      platform,
      pushToken,
      appVersion: getCurrentAppVersion(),
      osVersion: getCurrentOsVersion()
    });
    deps.onRegistered(registered.id);
  } catch {
    // 등록 실패는 조용히 무시 -- 화면(SET-006)에서 수동 토글로 다시 시도할 수 있고,
    // 다음 부팅에서 자연 재시도된다.
  }
}

export function usePushDeviceRegistration(authToken: string | null) {
  useEffect(() => {
    void runPushDeviceRegistration(authToken);
  }, [authToken]);
}

/**
 * FIX-118A (M-4, client half): session teardown counterpart of the boot registration above.
 *
 * A device row is keyed by (user, pushToken) server-side, so after a logout / account switch this
 * physical device is still an *enabled* push target of the account that just left -- it would keep
 * receiving that account's push notifications (on a device its owner no longer controls) until the
 * token happens to be re-registered by someone else. Turning the row off is therefore done at
 * teardown, best-effort:
 *
 *   - the store is reset FIRST and unconditionally, so the SET-006 screen never shows the outgoing
 *     account's device row as "이 기기" even if the request below fails;
 *   - the request uses the OUTGOING session's token (session-teardown.ts passes it -- the store
 *     has already moved on by then), which is still valid at this point;
 *   - failures are swallowed. There is no retry: the next session's boot registration re-upserts
 *     this device under the new account anyway, and a hung request must never delay teardown.
 *
 * The single-flight guard entry is dropped too, so re-logging in with the *same* token string
 * (exactly what the demo/test session does -- LOCAL_SESSION_TOKEN is a constant) registers again
 * instead of being skipped as "already attempted this boot".
 */
export async function deactivateRegisteredPushDevice(
  authToken: string | null,
  overrides: { update?: (token: string, deviceId: string, notificationEnabled: boolean) => Promise<unknown> } = {}
): Promise<void> {
  const { registeredDeviceId } = usePushRegistrationStore.getState();
  usePushRegistrationStore.getState().setRegisteredDeviceId(null);
  if (authToken) {
    attemptedAuthTokens.delete(authToken);
  }
  if (!registeredDeviceId || !authToken) return;
  try {
    await (overrides.update ?? updateDevice)(authToken, registeredDeviceId, false);
  } catch {
    // 실패 무시 -- 위 주석의 best-effort 계약.
  }
}
