import type { StateStorage } from "zustand/middleware";
import { persistStorage } from "./persist-storage";

/**
 * zustand persist storage adapter for the session store. Only the sensitive token fields
 * (accessToken, refreshToken) are routed to expo-secure-store; everything else in the
 * persisted session state (userId, defaultHouseholdId, isTestSession, ...) keeps using the
 * existing AsyncStorage-backed `persistStorage` under the same "wooriai-session" key.
 *
 * SecureStore key names may only contain alphanumerics, ".", "-", and "_" -- both keys below
 * satisfy that.
 */
const ACCESS_TOKEN_KEY = "wooriai-session.accessToken";
const REFRESH_TOKEN_KEY = "wooriai-session.refreshToken";

type SecureStoreModule = typeof import("expo-secure-store");

// In-memory fallback used whenever expo-secure-store can't be loaded (web, vitest/node,
// or any environment without the native module installed).
const memoryFallback = new Map<string, string>();

let secureStoreModulePromise: Promise<SecureStoreModule | null> | null = null;

/**
 * Lazily (and safely) loads expo-secure-store. The package throws synchronously at module
 * evaluation time when its native module isn't registered (e.g. under vitest/node, or on web),
 * so it must never be imported statically at the top of this file -- doing so would break every
 * test that transitively imports the session store. Wrapping the dynamic import in a promise
 * catch keeps that failure local and lets callers fall back to the in-memory map instead.
 */
function loadSecureStore(): Promise<SecureStoreModule | null> {
  if (!secureStoreModulePromise) {
    secureStoreModulePromise = import("expo-secure-store").catch(() => null);
  }
  return secureStoreModulePromise;
}

async function secureGetItem(key: string): Promise<string | null> {
  const SecureStore = await loadSecureStore();
  if (!SecureStore) return memoryFallback.get(key) ?? null;
  try {
    return (await SecureStore.getItemAsync(key)) ?? null;
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

async function secureSetItem(key: string, value: string): Promise<void> {
  const SecureStore = await loadSecureStore();
  if (!SecureStore) {
    memoryFallback.set(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
    memoryFallback.delete(key);
  } catch {
    memoryFallback.set(key, value);
  }
}

async function secureRemoveItem(key: string): Promise<void> {
  memoryFallback.delete(key);
  const SecureStore = await loadSecureStore();
  if (!SecureStore) return;
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Nothing to clean up if the native call itself fails (e.g. key never existed).
  }
}

type PersistedEnvelope = {
  state?: Record<string, unknown>;
  version?: number;
  [key: string]: unknown;
};

function parseEnvelope(raw: string): PersistedEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as PersistedEnvelope;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Reads the two token fields out of SecureStore, migrating any plaintext tokens still sitting
 * in the legacy AsyncStorage-persisted state (from before secure storage was introduced) into
 * SecureStore exactly once, then stripping them from the AsyncStorage copy going forward.
 */
async function readTokensWithMigration(
  name: string,
  envelope: PersistedEnvelope
): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const legacyAccessToken =
    typeof envelope.state?.accessToken === "string" ? (envelope.state.accessToken as string) : null;
  const legacyRefreshToken =
    typeof envelope.state?.refreshToken === "string" ? (envelope.state.refreshToken as string) : null;

  let [accessToken, refreshToken] = await Promise.all([
    secureGetItem(ACCESS_TOKEN_KEY),
    secureGetItem(REFRESH_TOKEN_KEY)
  ]);

  const needsMigration =
    (legacyAccessToken !== null && accessToken === null) ||
    (legacyRefreshToken !== null && refreshToken === null);

  if (needsMigration) {
    accessToken = accessToken ?? legacyAccessToken;
    refreshToken = refreshToken ?? legacyRefreshToken;
    await Promise.all([
      accessToken ? secureSetItem(ACCESS_TOKEN_KEY, accessToken) : secureRemoveItem(ACCESS_TOKEN_KEY),
      refreshToken ? secureSetItem(REFRESH_TOKEN_KEY, refreshToken) : secureRemoveItem(REFRESH_TOKEN_KEY)
    ]);
    const { accessToken: _legacyAccess, refreshToken: _legacyRefresh, ...restState } = envelope.state ?? {};
    await persistStorage.setItem(name, JSON.stringify({ ...envelope, state: restState }));
  }

  return { accessToken, refreshToken };
}

export const secureSessionStorage: StateStorage = {
  async getItem(name) {
    const raw = await persistStorage.getItem(name);

    if (!raw) {
      const [accessToken, refreshToken] = await Promise.all([
        secureGetItem(ACCESS_TOKEN_KEY),
        secureGetItem(REFRESH_TOKEN_KEY)
      ]);
      if (accessToken === null && refreshToken === null) return null;
      return JSON.stringify({ state: { accessToken, refreshToken }, version: 0 });
    }

    const envelope = parseEnvelope(raw);
    if (!envelope || !envelope.state) return raw;

    const { accessToken, refreshToken } = await readTokensWithMigration(name, envelope);

    return JSON.stringify({
      ...envelope,
      state: { ...envelope.state, accessToken, refreshToken }
    });
  },

  async setItem(name, value) {
    const envelope = parseEnvelope(value);
    if (!envelope || !envelope.state) {
      await persistStorage.setItem(name, value);
      return;
    }

    const { accessToken, refreshToken, ...restState } = envelope.state as {
      accessToken?: unknown;
      refreshToken?: unknown;
      [key: string]: unknown;
    };

    await Promise.all([
      typeof accessToken === "string" ? secureSetItem(ACCESS_TOKEN_KEY, accessToken) : secureRemoveItem(ACCESS_TOKEN_KEY),
      typeof refreshToken === "string" ? secureSetItem(REFRESH_TOKEN_KEY, refreshToken) : secureRemoveItem(REFRESH_TOKEN_KEY)
    ]);

    await persistStorage.setItem(name, JSON.stringify({ ...envelope, state: restState }));
  },

  async removeItem(name) {
    await Promise.all([secureRemoveItem(ACCESS_TOKEN_KEY), secureRemoveItem(REFRESH_TOKEN_KEY)]);
    await persistStorage.removeItem(name);
  }
};
