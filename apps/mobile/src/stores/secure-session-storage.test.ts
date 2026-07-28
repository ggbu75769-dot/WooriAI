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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("secureSessionStorage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("expo-secure-store");
    delete process.env.EXPO_PUBLIC_TEST_LOGIN;
  });

  describe("without a working expo-secure-store (default vitest/node environment)", () => {
    it("discards a truncated persisted envelope instead of returning invalid JSON to zustand hydration", async () => {
      const { persistStorage, secureSessionStorage } = await loadModules();

      await persistStorage.setItem(STORAGE_NAME, '{"state":{"isTestSession":true');

      await expect(secureSessionStorage.getItem(STORAGE_NAME)).resolves.toBeNull();
      const tombstone = JSON.parse((await persistStorage.getItem(STORAGE_NAME))!);
      expect(tombstone.credentialCommitId).toEqual(expect.any(String));
      expect(tombstone.state).toEqual({});
    });

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
        JSON.stringify({
          state: {
            accessToken: "secure-access",
            refreshToken: "secure-refresh",
            userId: "user-4",
            sessionGeneration: 4
          },
          version: 0
        })
      );

      // One owner-bound credential envelope prevents access/refresh/user fields
      // from being torn across separate native writes.
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "wooriai-session.credentials-v2",
        expect.stringContaining('"userId":"user-4"')
      );
      for (const [key] of store) {
        expect(key).toMatch(/^[\w.-]+$/);
      }

      const read = await secureSessionStorage.getItem(STORAGE_NAME);
      const parsed = JSON.parse(read!);
      expect(parsed.state.accessToken).toBe("secure-access");
      expect(parsed.state.refreshToken).toBe("secure-refresh");
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith("wooriai-session.credentials-v2");

      await secureSessionStorage.removeItem(STORAGE_NAME);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("wooriai-session.credentials-v2");
      await expect(secureSessionStorage.getItem(STORAGE_NAME)).resolves.toBeNull();
    });

    it("linearizes a delayed login write before logout so stale credentials cannot reappear", async () => {
      const store = new Map<string, string>();
      const releaseWrite = deferred<void>();
      vi.doMock("expo-secure-store", () => ({
        getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
        setItemAsync: vi.fn(async (key: string, value: string) => {
          await releaseWrite.promise;
          store.set(key, value);
        }),
        deleteItemAsync: vi.fn(async (key: string) => {
          store.delete(key);
        })
      }));
      const { secureSessionStorage } = await loadModules();

      const writeA = secureSessionStorage.setItem(
        STORAGE_NAME,
        JSON.stringify({
          state: {
            accessToken: "access-a",
            refreshToken: "refresh-a",
            userId: "user-a",
            sessionGeneration: 1
          },
          version: 3
        })
      );
      const logout = secureSessionStorage.removeItem(STORAGE_NAME);
      releaseWrite.resolve();
      await Promise.all([writeA, logout]);

      await expect(secureSessionStorage.getItem(STORAGE_NAME)).resolves.toBeNull();
      expect(store.has("wooriai-session.credentials-v2")).toBe(false);
    });

    it("orders logout before an immediate new login and restores only the new owner", async () => {
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
      const { secureSessionStorage } = await loadModules();

      const logout = secureSessionStorage.removeItem(STORAGE_NAME);
      const writeB = secureSessionStorage.setItem(
        STORAGE_NAME,
        JSON.stringify({
          state: {
            accessToken: "access-b",
            refreshToken: "refresh-b",
            userId: "user-b",
            sessionGeneration: 2
          },
          version: 3
        })
      );
      await Promise.all([logout, writeB]);

      const restored = JSON.parse((await secureSessionStorage.getItem(STORAGE_NAME))!);
      expect(restored.state).toMatchObject({
        accessToken: "access-b",
        refreshToken: "refresh-b",
        userId: "user-b",
        sessionGeneration: 2
      });
    });

    it("lets the queue recover after a failed native write", async () => {
      const store = new Map<string, string>();
      let shouldFail = true;
      vi.doMock("expo-secure-store", () => ({
        getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
        setItemAsync: vi.fn(async (key: string, value: string) => {
          if (shouldFail) {
            shouldFail = false;
            throw new Error("native write failed");
          }
          store.set(key, value);
        }),
        deleteItemAsync: vi.fn(async (key: string) => {
          store.delete(key);
        })
      }));
      const { secureSessionStorage } = await loadModules();
      const value = (userId: string) =>
        JSON.stringify({
          state: {
            accessToken: `access-${userId}`,
            refreshToken: `refresh-${userId}`,
            userId,
            sessionGeneration: 1
          },
          version: 3
        });

      await expect(secureSessionStorage.setItem(STORAGE_NAME, value("a"))).rejects.toThrow(
        "native write failed"
      );
      await expect(secureSessionStorage.setItem(STORAGE_NAME, value("b"))).resolves.toBeUndefined();
      const restored = JSON.parse((await secureSessionStorage.getItem(STORAGE_NAME))!);
      expect(restored.state.userId).toBe("b");
    });

    it("prioritizes the durable logout tombstone when native deletion fails", async () => {
      const store = new Map<string, string>();
      vi.doMock("expo-secure-store", () => ({
        getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
        setItemAsync: vi.fn(async (key: string, value: string) => {
          store.set(key, value);
        }),
        deleteItemAsync: vi.fn(async () => {
          throw new Error("keychain unavailable");
        })
      }));
      const { persistStorage, secureSessionStorage } = await loadModules();
      await secureSessionStorage.setItem(
        STORAGE_NAME,
        JSON.stringify({
          state: {
            accessToken: "access-a",
            refreshToken: "refresh-a",
            userId: "user-a",
            sessionGeneration: 1
          },
          version: 3
        })
      );
      expect(store.has("wooriai-session.credentials-v2")).toBe(true);

      await secureSessionStorage.removeItem(STORAGE_NAME);
      expect(store.has("wooriai-session.credentials-v2")).toBe(true);
      await expect(secureSessionStorage.getItem(STORAGE_NAME)).resolves.toBeNull();
      const tombstone = JSON.parse((await persistStorage.getItem(STORAGE_NAME))!);
      expect(tombstone.credentialCommitId).toEqual(expect.any(String));
      expect(tombstone.state).toEqual({});
    });

    it("fails closed when the persisted owner and credential owner diverge", async () => {
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
      const { persistStorage, secureSessionStorage } = await loadModules();
      await secureSessionStorage.setItem(
        STORAGE_NAME,
        JSON.stringify({
          state: {
            accessToken: "access-a",
            refreshToken: "refresh-a",
            userId: "user-a",
            sessionGeneration: 1
          },
          version: 3
        })
      );
      const persisted = JSON.parse((await persistStorage.getItem(STORAGE_NAME))!);
      persisted.state.userId = "user-b";
      await persistStorage.setItem(STORAGE_NAME, JSON.stringify(persisted));

      await expect(secureSessionStorage.getItem(STORAGE_NAME)).resolves.toBeNull();
    });
  });

  describe("in the standalone local-test profile", () => {
    it("restores the local session without waiting for SecureStore token reads", async () => {
      process.env.EXPO_PUBLIC_TEST_LOGIN = "1";
      const secureGet = vi.fn(async () => new Promise<string | null>(() => undefined));
      vi.doMock("expo-secure-store", () => ({
        getItemAsync: secureGet,
        setItemAsync: vi.fn(async () => undefined),
        deleteItemAsync: vi.fn(async () => undefined)
      }));
      const { persistStorage, secureSessionStorage } = await loadModules();
      await persistStorage.setItem(
        STORAGE_NAME,
        JSON.stringify({
          state: {
            accessToken: "stale-access",
            refreshToken: "stale-refresh",
            isTestSession: true
          },
          version: 2
        })
      );

      const restored = await secureSessionStorage.getItem(STORAGE_NAME);
      const parsed = JSON.parse(restored!);

      expect(parsed.state).toMatchObject({
        accessToken: null,
        refreshToken: null,
        isTestSession: true
      });
      expect(secureGet).not.toHaveBeenCalled();
    });
  });
});
