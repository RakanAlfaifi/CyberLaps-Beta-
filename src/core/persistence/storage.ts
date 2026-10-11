import type { StateStorage } from "zustand/middleware";

const STORAGE_PREFIX = "cyberlaps:";
/** Prefix used before the CyberLaps rename. Saved data under it is moved over once. */
const LEGACY_PREFIXES = ["cyber-lab:"];

export const storageKey = (name: string): string => `${STORAGE_PREFIX}${name}`;

const memory = new Map<string, string>();
const memoryStorage: StateStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

let migrated = false;

/** Moves `cyber-lab:*` keys to `cyberlaps:*` without overwriting anything already saved under the new name. */
export function migrateLegacyKeys(storage: Storage): void {
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => k !== null);
  for (const key of keys) {
    const legacy = LEGACY_PREFIXES.find((prefix) => key.startsWith(prefix));
    if (!legacy) continue;
    const next = storageKey(key.slice(legacy.length));
    const value = storage.getItem(key);
    if (value !== null && storage.getItem(next) === null) storage.setItem(next, value);
    storage.removeItem(key);
  }
}

/**
 * Returns localStorage when it works. Falls back to in-memory storage
 * (private mode, blocked storage, quota errors) so the lab still runs.
 */
export function getBrowserStorage(): StateStorage {
  try {
    const probe = storageKey("__probe__");
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    if (!migrated) {
      migrated = true;
      migrateLegacyKeys(window.localStorage);
    }
    return window.localStorage;
  } catch {
    return memoryStorage;
  }
}
