import type { StateStorage } from "zustand/middleware";
import { isTestLoginBuild } from "../pixelLock/build-profile";
import { persistStorage, setPersistedItemDurably } from "./persist-storage";

const LEGACY_ACCESS_TOKEN_KEY = "wooriai-session.accessToken";
const LEGACY_REFRESH_TOKEN_KEY = "wooriai-session.refreshToken";
const CREDENTIALS_KEY = "wooriai-session.credentials-v2";
const CREDENTIALS_VERSION = 2;

type SecureStoreModule = typeof import("expo-secure-store");

type PersistedEnvelope = {
  state?: Record<string, unknown>;
  version?: number;
  credentialCommitId?: string;
  [key: string]: unknown;
};

type CredentialEnvelope = {
  version: typeof CREDENTIALS_VERSION;
  commitId: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
  sessionGeneration: number;
};

const memoryFallback = new Map<string, string>();
let secureStoreModulePromise: Promise<SecureStoreModule | null> | null = null;
let storageQueue: Promise<void> = Promise.resolve();
let commitCounter = 0;

function enqueueStorageOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(operation, operation);
  storageQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

/** Resolves after every secure-session read/write already queued by zustand has settled. */
export function waitForSecureSessionStorageIdle(): Promise<void> {
  return enqueueStorageOperation(async () => undefined);
}

function nextCommitId(): string {
  commitCounter += 1;
  return `${Date.now().toString(36)}-${commitCounter.toString(36)}`;
}

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
  await SecureStore.setItemAsync(key, value);
  memoryFallback.delete(key);
}

async function secureRemoveItem(key: string): Promise<void> {
  memoryFallback.delete(key);
  const SecureStore = await loadSecureStore();
  if (!SecureStore) return;
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // A durable commit-id tombstone in AsyncStorage makes a leftover credential
    // envelope unusable on the next hydration even when native deletion fails.
  }
}

function parseEnvelope(raw: string): PersistedEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as PersistedEnvelope;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseCredentials(raw: string | null): CredentialEnvelope | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CredentialEnvelope>;
    if (
      parsed.version !== CREDENTIALS_VERSION ||
      typeof parsed.commitId !== "string" ||
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.sessionGeneration !== "number" ||
      !Number.isSafeInteger(parsed.sessionGeneration) ||
      parsed.sessionGeneration < 0
    ) {
      return null;
    }
    return parsed as CredentialEnvelope;
  } catch {
    return null;
  }
}

function withoutPersistedTokens(envelope: PersistedEnvelope): PersistedEnvelope {
  const { accessToken: _accessToken, refreshToken: _refreshToken, ...state } = envelope.state ?? {};
  return { ...envelope, state };
}

function restorableOwner(
  envelope: PersistedEnvelope
): { userId: string; sessionGeneration: number } | null {
  if (
    !envelope.state ||
    typeof envelope.state.userId !== "string" ||
    envelope.state.userId.length === 0 ||
    envelope.state.isTestSession === true
  ) {
    return null;
  }
  const generation = envelope.state.sessionGeneration;
  if (generation === undefined) {
    return { userId: envelope.state.userId, sessionGeneration: 0 };
  }
  if (
    typeof generation !== "number" ||
    !Number.isSafeInteger(generation) ||
    generation < 0
  ) {
    return null;
  }
  return { userId: envelope.state.userId, sessionGeneration: generation };
}

async function removeAllCredentialKeys(): Promise<void> {
  await Promise.all([
    secureRemoveItem(CREDENTIALS_KEY),
    secureRemoveItem(LEGACY_ACCESS_TOKEN_KEY),
    secureRemoveItem(LEGACY_REFRESH_TOKEN_KEY)
  ]);
}

async function persistLoggedOutTombstone(name: string, envelope?: PersistedEnvelope): Promise<PersistedEnvelope> {
  const tombstone = {
    ...(envelope ? withoutPersistedTokens(envelope) : { state: {}, version: 0 }),
    credentialCommitId: nextCommitId()
  };
  // Persist the invalidating commit before best-effort native deletion. A crash
  // or SecureStore failure can leave bytes behind, but they no longer match.
  await setPersistedItemDurably(name, JSON.stringify(tombstone));
  await removeAllCredentialKeys();
  return tombstone;
}

async function writeCredentialState(name: string, envelope: PersistedEnvelope): Promise<void> {
  const { accessToken, refreshToken, ...restState } = envelope.state ?? {};
  const userId = restState.userId;
  const sessionGeneration = restState.sessionGeneration ?? 0;
  const hasTokens = typeof accessToken === "string" && typeof refreshToken === "string";
  const hasOwner =
    typeof userId === "string" &&
    userId.length > 0 &&
    typeof sessionGeneration === "number" &&
    Number.isSafeInteger(sessionGeneration) &&
    sessionGeneration >= 0;

  if (!hasTokens || !hasOwner || isTestLoginBuild()) {
    await persistLoggedOutTombstone(name, { ...envelope, state: restState });
    return;
  }

  const commitId = nextCommitId();
  const credentials: CredentialEnvelope = {
    version: CREDENTIALS_VERSION,
    commitId,
    accessToken,
    refreshToken,
    userId,
    sessionGeneration
  };

  // Credentials are committed first. If the app stops before the matching
  // AsyncStorage commit, hydration sees a mismatch and fails closed.
  await secureSetItem(CREDENTIALS_KEY, JSON.stringify(credentials));
  await persistStorage.setItem(
    name,
    JSON.stringify({ ...envelope, state: restState, credentialCommitId: commitId })
  );
  await Promise.all([
    secureRemoveItem(LEGACY_ACCESS_TOKEN_KEY),
    secureRemoveItem(LEGACY_REFRESH_TOKEN_KEY)
  ]);
}

async function migrateLegacyCredentials(
  name: string,
  envelope: PersistedEnvelope
): Promise<CredentialEnvelope | null> {
  const owner = restorableOwner(envelope);
  if (!owner) return null;
  const state = envelope.state ?? {};
  const legacyAccess =
    typeof state.accessToken === "string"
      ? state.accessToken
      : await secureGetItem(LEGACY_ACCESS_TOKEN_KEY);
  const legacyRefresh =
    typeof state.refreshToken === "string"
      ? state.refreshToken
      : await secureGetItem(LEGACY_REFRESH_TOKEN_KEY);
  if (!legacyAccess || !legacyRefresh) return null;

  const commitId = nextCommitId();
  const credentials: CredentialEnvelope = {
    version: CREDENTIALS_VERSION,
    commitId,
    accessToken: legacyAccess,
    refreshToken: legacyRefresh,
    userId: owner.userId,
    sessionGeneration: owner.sessionGeneration
  };
  const sanitized = withoutPersistedTokens(envelope);
  await secureSetItem(CREDENTIALS_KEY, JSON.stringify(credentials));
  await persistStorage.setItem(
    name,
    JSON.stringify({
      ...sanitized,
      state: { ...sanitized.state, sessionGeneration: owner.sessionGeneration },
      credentialCommitId: commitId
    })
  );
  await Promise.all([
    secureRemoveItem(LEGACY_ACCESS_TOKEN_KEY),
    secureRemoveItem(LEGACY_REFRESH_TOKEN_KEY)
  ]);
  return credentials;
}

async function readCredentialState(name: string): Promise<string | null> {
  const raw = await persistStorage.getItem(name);

  if (!raw) {
    await removeAllCredentialKeys();
    return null;
  }

  const envelope = parseEnvelope(raw);
  if (!envelope) {
    await persistLoggedOutTombstone(name);
    return null;
  }

  if (isTestLoginBuild()) {
    const sanitized = await persistLoggedOutTombstone(name, envelope);
    return JSON.stringify({
      ...sanitized,
      state: { ...sanitized.state, accessToken: null, refreshToken: null }
    });
  }

  const owner = restorableOwner(envelope);
  if (!owner) {
    const sanitized = await persistLoggedOutTombstone(name, envelope);
    const state = sanitized.state ?? {};
    return state.isTestSession === true ? JSON.stringify(sanitized) : null;
  }

  let credentials = parseCredentials(await secureGetItem(CREDENTIALS_KEY));
  if (
    !credentials ||
    credentials.commitId !== envelope.credentialCommitId ||
    credentials.userId !== owner.userId ||
    credentials.sessionGeneration !== owner.sessionGeneration
  ) {
    credentials = await migrateLegacyCredentials(name, envelope);
  }

  if (!credentials) {
    await persistLoggedOutTombstone(name, envelope);
    return null;
  }

  return JSON.stringify({
    ...withoutPersistedTokens(envelope),
    credentialCommitId: credentials.commitId,
    state: {
      ...withoutPersistedTokens(envelope).state,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken
    }
  });
}

export const secureSessionStorage: StateStorage = {
  getItem(name) {
    return enqueueStorageOperation(() => readCredentialState(name));
  },

  setItem(name, value) {
    return enqueueStorageOperation(async () => {
      const envelope = parseEnvelope(value);
      if (!envelope || !envelope.state) {
        await persistLoggedOutTombstone(name);
        return;
      }
      await writeCredentialState(name, envelope);
    });
  },

  removeItem(name) {
    return enqueueStorageOperation(async () => {
      await persistLoggedOutTombstone(name);
    });
  }
};

/**
 * Persists the security boundary before the in-memory Zustand session is cleared.
 * Calling this separately lets logout remain visibly active when durable storage is
 * unavailable instead of claiming success and resurrecting credentials after restart.
 */
export function durablyInvalidateSecureSession(
  name: string = "wooriai-session"
): Promise<void> {
  return enqueueStorageOperation(async () => {
    await persistLoggedOutTombstone(name);
  });
}
