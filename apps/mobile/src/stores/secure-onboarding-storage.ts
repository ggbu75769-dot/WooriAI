import type { StateStorage } from "zustand/middleware";

type SecureStoreModule = typeof import("expo-secure-store");

const memoryFallback = new Map<string, string>();
let secureStorePromise: Promise<SecureStoreModule | null> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

function enqueueMutation(work: () => Promise<void>): Promise<void> {
  mutationQueue = mutationQueue.then(work, work);
  return mutationQueue;
}

function loadSecureStore(): Promise<SecureStoreModule | null> {
  secureStorePromise ??= import("expo-secure-store").catch(() => null);
  return secureStorePromise;
}

export const secureOnboardingStorage: StateStorage = {
  async getItem(name) {
    await mutationQueue.catch(() => undefined);
    const SecureStore = await loadSecureStore();
    if (!SecureStore) return safeStoredJson(name, memoryFallback.get(name) ?? null);
    try {
      return safeStoredJson(name, (await SecureStore.getItemAsync(name)) ?? null, SecureStore);
    } catch {
      return safeStoredJson(name, memoryFallback.get(name) ?? null);
    }
  },

  setItem(name, value) {
    return enqueueMutation(async () => {
      const SecureStore = await loadSecureStore();
      if (!SecureStore) {
        memoryFallback.set(name, value);
        return;
      }
      try {
        await SecureStore.setItemAsync(name, value);
        memoryFallback.delete(name);
      } catch {
        memoryFallback.set(name, value);
      }
    });
  },

  removeItem(name) {
    return enqueueMutation(async () => {
      memoryFallback.delete(name);
      const SecureStore = await loadSecureStore();
      if (!SecureStore) return;
      try {
        await SecureStore.deleteItemAsync(name);
      } catch {
        // A missing native key is already equivalent to a cleared draft.
      }
    });
  }
};

async function discardCorruptValue(name: string, SecureStore?: SecureStoreModule) {
  memoryFallback.delete(name);
  if (SecureStore) {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      // A corrupt draft must fail closed even if native cleanup is temporarily unavailable.
    }
  }
}

function safeStoredJson(name: string, value: string | null, SecureStore?: SecureStoreModule): string | null {
  if (value === null) return null;
  try {
    JSON.parse(value);
    return value;
  } catch {
    void discardCorruptValue(name, SecureStore);
    return null;
  }
}
