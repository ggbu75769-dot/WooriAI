import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";
import { persistentRuntimeAvailable } from "./persist-runtime";

const memory = new Map<string, string>();

const memoryStorage: StateStorage = {
  getItem: (name) => memory.get(name) ?? null,
  setItem: (name, value) => {
    memory.set(name, value);
  },
  removeItem: (name) => {
    memory.delete(name);
  }
};

/** Keep native storage errors local while retaining the latest process-local write. */
export function createResilientPersistStorage(storage: StateStorage): StateStorage {
  const fallback = new Map<string, string>();

  return {
    async getItem(name) {
      let value: string | null;
      try {
        value = await storage.getItem(name);
      } catch {
        return fallback.get(name) ?? null;
      }
      if (value === null) return fallback.get(name) ?? null;
      fallback.delete(name);
      return value;
    },
    async setItem(name, value) {
      try {
        await storage.setItem(name, value);
        fallback.delete(name);
      } catch {
        fallback.set(name, value);
      }
    },
    async removeItem(name) {
      fallback.delete(name);
      try {
        await storage.removeItem(name);
      } catch {
        // The in-process value is already cleared; a later valid write replaces stale native data.
      }
    }
  };
}

export function shouldUsePersistentRuntimeStorage(runtimeAvailable: boolean) {
  return runtimeAvailable;
}

const runtimeStorage: StateStorage =
  shouldUsePersistentRuntimeStorage(persistentRuntimeAvailable)
    ? AsyncStorage
    : memoryStorage;

export const persistStorage: StateStorage = createResilientPersistStorage(runtimeStorage);

/**
 * Security-sensitive invalidation cannot use the resilient adapter: its process-local
 * fallback intentionally keeps UX writes alive after a native failure, but that fallback
 * disappears on process death. Logout tombstones must reach the underlying durable store or
 * reject so the UI can keep the current session and ask the user to retry.
 */
export async function setPersistedItemDurably(name: string, value: string): Promise<void> {
  await runtimeStorage.setItem(name, value);
}

/**
 * Zustand's JSON storage calls JSON.parse after StateStorage.getItem resolves. A truncated value
 * therefore rejects the whole hydration before migrate/merge can sanitize it. Use this adapter
 * only for createJSONStorage consumers; direct draft readers retain raw values so they can run
 * their own quarantine logic.
 */
export function createValidatedJsonPersistStorage(storage: StateStorage): StateStorage {
  return {
    async getItem(name) {
      const value = await storage.getItem(name);
      if (value === null) return null;
      try {
        JSON.parse(value);
        return value;
      } catch {
        await storage.removeItem(name);
        return null;
      }
    },
    setItem: (name, value) => storage.setItem(name, value),
    removeItem: (name) => storage.removeItem(name)
  };
}

export const zustandPersistStorage: StateStorage = createValidatedJsonPersistStorage(persistStorage);
