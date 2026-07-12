import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_NAME = "wooriai-session";

/**
 * Re-imports both secure-session-storage and its persist-storage dependency together after a
 * vi.resetModules() call, so both references come from the same fresh module graph (avoiding a
 * mismatch where the test asserts against a stale persist-storage instance with its own,
 * unrelated in-memory map).
 */
async function loadModules() {
  const [{ persistStorage }, { secureSessionStorage }] = await Promise.all([
    import("./persist-storage"),
    import("./secure-session-storage")
  ]);
  return { persistStorage, secureSessionStorage };
}

describe("secureSessionStorage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("expo-secure-store");
  });

  describe("without a working expo-secure-store (default vitest/node environment)", () => {
    it("migrates plaintext tokens found in the legacy AsyncStorage-persisted state exactly once", async () => {
      const { persistStorage, secureSessionStorage } = await loadModules();

      // Simulate a pre-existing session persisted before secure storage was introduced: the
      // whole state (including tokens) sitting in plaintext AsyncStorage.
      await persistStorage.setItem(
        STORAGE_NAME,
        JSON.stringify({
          state: {
            accessToken: "legacy-access-token",
            refreshToken: "legacy-refresh-token",
            userId: "user-1",
            defaultHouseholdId: "household-1",
            isTestSession: false
          },
          version: 0
        })
      );

      const firstRead = await secureSessionStorage.getItem(STORAGE_NAME);
      expect(firstRead).not.toBeNull();
      const firstParsed = JSON.parse(firstRead!);
      expect(firstParsed.state).toMatchObject({
        accessToken: "legacy-access-token",
        refreshToken: "legacy-refresh-token",
        userId: "user-1",
        defaultHouseholdId: "household-1"
      });

      // The AsyncStorage copy must no longer carry the plaintext tokens after migration --
      // only the non-sensitive fields stay there.
      const rawAfterMigration = await persistStorage.getItem(STORAGE_NAME);
      const parsedAfterMigration = JSON.parse(rawAfterMigration!);
      expect(parsedAfterMigration.state.accessToken).toBeUndefined();
      expect(parsedAfterMigration.state.refreshToken).toBeUndefined();
      expect(parsedAfterMigration.state.userId).toBe("user-1");

      // A second read still returns the tokens (now sourced from the secure/fallback store,
      // not from the already-stripped AsyncStorage copy).
      const secondRead = await secureSessionStorage.getItem(STORAGE_NAME);
      const secondParsed = JSON.parse(secondRead!);
      expect(secondParsed.state.accessToken).toBe("legacy-access-token");
      expect(secondParsed.state.refreshToken).toBe("legacy-refresh-token");
    });

    it("round-trips tokens through setItem/getItem while keeping them out of the AsyncStorage copy", async () => {
      const { persistStorage, secureSessionStorage } = await loadModules();

      await secureSessionStorage.setItem(
        STORAGE_NAME,
        JSON.stringify({
          state: {
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
            userId: "user-2",
            defaultHouseholdId: null,
            isTestSession: false
          },
          version: 0
        })
      );

      const rawPersisted = await persistStorage.getItem(STORAGE_NAME);
      const parsedPersisted = JSON.parse(rawPersisted!);
      expect(parsedPersisted.state.accessToken).toBeUndefined();
      expect(parsedPersisted.state.refreshToken).toBeUndefined();
      expect(parsedPersisted.state.userId).toBe("user-2");

      const read = await secureSessionStorage.getItem(STORAGE_NAME);
      const parsedRead = JSON.parse(read!);
      expect(parsedRead.state.accessToken).toBe("new-access-token");
      expect(parsedRead.state.refreshToken).toBe("new-refresh-token");
      expect(parsedRead.state.userId).toBe("user-2");
    });

    it("clears both the token store and the AsyncStorage copy on removeItem", async () => {
      const { secureSessionStorage } = await loadModules();

      await secureSessionStorage.setItem(
        STORAGE_NAME,
        JSON.stringify({ state: { accessToken: "a", refreshToken: "b", userId: "user-3" }, version: 0 })
      );
      await secureSessionStorage.removeItem(STORAGE_NAME);

      expect(await secureSessionStorage.getItem(STORAGE_NAME)).toBeNull();
    });
  });

  describe("with expo-secure-store available", () => {
    it("routes token reads/writes through SecureStore's getItemAsync/setItemAsync/deleteItemAsync using valid key names", async () => {
      const store = new Map<string, string>();
      vi.doMock("expo-secure-store", () => ({
        getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
        setItemAsync: vi.fn(async (key: string, value: string) => {
          store.set(key, value);
        }),
        deleteItemAsync: vi.fn(async (key: string) => {
          store.delete(key);
        })
      }));

      const SecureStore = await import("expo-secure-store");
      const { secureSessionStorage } = await loadModules();

      await secureSessionStorage.setItem(
        STORAGE_NAME,
        JSON.stringify({ state: { accessToken: "secure-access", refreshToken: "secure-refresh", userId: "user-4" }, version: 0 })
      );

      // SecureStore keys must only contain alphanumerics, ".", "-", and "_".
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("wooriai-session.accessToken", "secure-access");
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("wooriai-session.refreshToken", "secure-refresh");
      for (const [key] of store) {
        expect(key).toMatch(/^[\w.-]+$/);
      }

      const read = await secureSessionStorage.getItem(STORAGE_NAME);
      const parsed = JSON.parse(read!);
      expect(parsed.state.accessToken).toBe("secure-access");
      expect(parsed.state.refreshToken).toBe("secure-refresh");
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith("wooriai-session.accessToken");

      await secureSessionStorage.removeItem(STORAGE_NAME);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("wooriai-session.accessToken");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("wooriai-session.refreshToken");
    });
  });
});
