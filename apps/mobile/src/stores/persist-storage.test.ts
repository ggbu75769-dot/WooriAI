import type { StateStorage } from "zustand/middleware";
import { describe, expect, it, vi } from "vitest";
import { persistentRuntimeAvailable as nativeRuntimeAvailable } from "./persist-runtime.native";
import { persistentRuntimeAvailable as nodeRuntimeAvailable } from "./persist-runtime";
import { persistentRuntimeAvailable as webRuntimeAvailable } from "./persist-runtime.web";
import {
  createResilientPersistStorage,
  createValidatedJsonPersistStorage,
  shouldUsePersistentRuntimeStorage
} from "./persist-storage";

describe("createResilientPersistStorage", () => {
  it("uses AsyncStorage on React Native even when the Hermes runtime has no window global", () => {
    expect(shouldUsePersistentRuntimeStorage(nativeRuntimeAvailable)).toBe(true);
    expect(shouldUsePersistentRuntimeStorage(webRuntimeAvailable)).toBe(true);
    expect(shouldUsePersistentRuntimeStorage(nodeRuntimeAvailable)).toBe(false);
  });

  it("discards a truncated JSON value so zustand hydration receives null", async () => {
    const values = new Map<string, string>([["store", '{"state":{"broken":true']]);
    const backing: StateStorage = {
      getItem: async (name) => values.get(name) ?? null,
      setItem: async (name, value) => { values.set(name, value); },
      removeItem: async (name) => { values.delete(name); }
    };

    const storage = createValidatedJsonPersistStorage(backing);

    await expect(storage.getItem("store")).resolves.toBeNull();
    expect(values.has("store")).toBe(false);
  });

  it("falls back to the latest in-process value when the native storage rejects", async () => {
    const backing: StateStorage = {
      getItem: vi.fn(async () => { throw new Error("native-read-failed"); }),
      setItem: vi.fn(async () => { throw new Error("native-write-failed"); }),
      removeItem: vi.fn(async () => { throw new Error("native-remove-failed"); })
    };
    const storage = createResilientPersistStorage(backing);
    const valid = JSON.stringify({ state: { ready: true }, version: 1 });

    await storage.setItem("store", valid);
    await expect(storage.getItem("store")).resolves.toBe(valid);
    await storage.removeItem("store");
    await expect(storage.getItem("store")).resolves.toBeNull();
  });
});
