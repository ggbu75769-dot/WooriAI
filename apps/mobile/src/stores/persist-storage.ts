import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";

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

export const persistStorage: StateStorage =
  typeof window === "undefined" ? memoryStorage : AsyncStorage;
