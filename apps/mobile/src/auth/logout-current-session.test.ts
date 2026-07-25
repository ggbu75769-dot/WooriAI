import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitForSecureSessionStorageIdle } from "../stores/secure-session-storage";
import { useSessionStore } from "../stores/session.store";
import { logoutCurrentSession } from "./logout-current-session";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("logoutCurrentSession", () => {
  beforeEach(async () => {
    useSessionStore.getState().clearSession();
    await waitForSecureSessionStorageIdle();
    useSessionStore.getState().setSession({
      accessToken: "access-a",
      refreshToken: "refresh-a",
      userId: "user-a",
      defaultHouseholdId: "household-a"
    });
    await waitForSecureSessionStorageIdle();
  });

  afterEach(async () => {
    useSessionStore.getState().clearSession();
    await waitForSecureSessionStorageIdle();
  });

  it("closes the UI boundary before waiting for truthful remote revocation", async () => {
    const remote = deferred<{ success: boolean }>();
    const revoke = vi.fn(() => remote.promise);
    const onLocalCleared = vi.fn();

    const logout = logoutCurrentSession({ revoke, onLocalCleared });
    await vi.waitFor(() => expect(onLocalCleared).toHaveBeenCalledTimes(1));
    expect(revoke).toHaveBeenCalledWith("access-a", "refresh-a");
    expect(useSessionStore.getState()).toMatchObject({
      accessToken: null,
      refreshToken: null,
      userId: null
    });
    remote.resolve({ success: true });
    await expect(logout).resolves.toEqual({ serverRevoked: true, localCleared: true });
  });

  it("never clears a new login that replaces the owner while revocation is in flight", async () => {
    const remote = deferred<{ success: boolean }>();
    const logout = logoutCurrentSession({ revoke: () => remote.promise });

    useSessionStore.getState().setSession({
      accessToken: "access-b",
      refreshToken: "refresh-b",
      userId: "user-b",
      defaultHouseholdId: "household-b"
    });
    await expect(logout).resolves.toEqual({ serverRevoked: null, localCleared: false });
    expect(useSessionStore.getState()).toMatchObject({
      accessToken: "access-b",
      refreshToken: "refresh-b",
      userId: "user-b",
      defaultHouseholdId: "household-b"
    });
  });

  it("clears locally before an asynchronous remote failure", async () => {
    const revoke = vi.fn(async () => {
      throw new TypeError("Network request failed");
    });

    await expect(logoutCurrentSession({ revoke })).resolves.toEqual({
      serverRevoked: false,
      localCleared: true
    });
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledTimes(1));
    expect(useSessionStore.getState().accessToken).toBeNull();
  });

  it("shares one remote request across duplicate logout taps", async () => {
    const remote = deferred<{ success: boolean }>();
    const revoke = vi.fn(() => remote.promise);

    const first = logoutCurrentSession({ revoke });
    const second = logoutCurrentSession({ revoke });
    expect(first).toBe(second);
    remote.resolve({ success: true });
    await Promise.all([first, second]);
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("keeps local test sessions network-free", async () => {
    useSessionStore.getState().clearSession();
    await useSessionStore.getState().startTestSession();
    await waitForSecureSessionStorageIdle();
    const revoke = vi.fn(async () => ({ success: true }));

    await expect(logoutCurrentSession({ revoke })).resolves.toEqual({
      serverRevoked: null,
      localCleared: true
    });
    expect(revoke).not.toHaveBeenCalled();
  });

  it("keeps the current session active when the durable logout tombstone cannot be saved", async () => {
    const persistLocalLogout = vi.fn(async () => {
      throw new Error("AsyncStorage unavailable");
    });

    await expect(
      logoutCurrentSession({
        revoke: async () => ({ success: true }),
        persistLocalLogout
      })
    ).resolves.toEqual({
      serverRevoked: null,
      localCleared: false
    });
    expect(persistLocalLogout).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState()).toMatchObject({
      accessToken: "access-a",
      refreshToken: "refresh-a",
      userId: "user-a"
    });
  });
});
