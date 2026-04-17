import { Debouncer } from "@tanstack/react-pacer";
import { resolveLegacyStorageKeys } from "./persistedStorage";

export interface StateStorage<R = unknown> {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => R;
  removeItem: (name: string) => R;
}

export interface DebouncedStorage<R = unknown> extends StateStorage<R> {
  flush: () => void;
}

function readStorageMethod<K extends keyof StateStorage>(
  storage: StateStorage,
  method: K,
): StateStorage[K] | null {
  const candidate = (storage as Partial<StateStorage>)[method];
  return typeof candidate === "function" ? (candidate as StateStorage[K]) : null;
}

function getStorageItem(
  storage: StateStorage,
  name: string,
): string | null | Promise<string | null> {
  const getItem = readStorageMethod(storage, "getItem");
  return getItem ? getItem.call(storage, name) : null;
}

function setStorageItem(storage: StateStorage, name: string, value: string): unknown {
  const setItem = readStorageMethod(storage, "setItem");
  return setItem ? setItem.call(storage, name, value) : undefined;
}

function removeStorageItem(storage: StateStorage, name: string): unknown {
  const removeItem = readStorageMethod(storage, "removeItem");
  return removeItem ? removeItem.call(storage, name) : undefined;
}

export function createMemoryStorage(): StateStorage {
  const store = new Map<string, string>();
  return {
    getItem: (name) => store.get(name) ?? null,
    setItem: (name, value) => {
      store.set(name, value);
    },
    removeItem: (name) => {
      store.delete(name);
    },
  };
}

export function createDebouncedStorage(
  baseStorage: StateStorage,
  debounceMs: number = 300,
): DebouncedStorage {
  const debouncedSetItem = new Debouncer(
    (name: string, value: string) => {
      setStorageItem(baseStorage, name, value);
    },
    { wait: debounceMs },
  );

  return {
    getItem: (name) => getStorageItem(baseStorage, name),
    setItem: (name, value) => {
      debouncedSetItem.maybeExecute(name, value);
    },
    removeItem: (name) => {
      debouncedSetItem.cancel();
      removeStorageItem(baseStorage, name);
    },
    flush: () => {
      debouncedSetItem.flush();
    },
  };
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof value === "object" && value !== null && "then" in value;
}

async function readAliasedStorageItem(
  baseStorage: StateStorage,
  name: string,
): Promise<string | null> {
  const currentValue = await getStorageItem(baseStorage, name);
  if (currentValue !== null) {
    return currentValue;
  }

  for (const legacyKey of resolveLegacyStorageKeys(name)) {
    const legacyValue = await getStorageItem(baseStorage, legacyKey);
    if (legacyValue === null) {
      continue;
    }

    await setStorageItem(baseStorage, name, legacyValue);
    await removeStorageItem(baseStorage, legacyKey);
    return legacyValue;
  }

  return null;
}

export function createAliasedStateStorage(baseStorage: StateStorage): StateStorage {
  return {
    getItem: (name) => {
      const currentValue = getStorageItem(baseStorage, name);
      if (isPromiseLike(currentValue)) {
        return readAliasedStorageItem(baseStorage, name);
      }
      if (currentValue !== null) {
        return currentValue;
      }

      for (const legacyKey of resolveLegacyStorageKeys(name)) {
        const legacyValue = getStorageItem(baseStorage, legacyKey);
        if (legacyValue === null || isPromiseLike(legacyValue)) {
          continue;
        }

        setStorageItem(baseStorage, name, legacyValue);
        removeStorageItem(baseStorage, legacyKey);
        return legacyValue;
      }

      return null;
    },
    setItem: (name, value) => {
      const result = setStorageItem(baseStorage, name, value);
      for (const legacyKey of resolveLegacyStorageKeys(name)) {
        removeStorageItem(baseStorage, legacyKey);
      }
      return result;
    },
    removeItem: (name) => {
      const result = removeStorageItem(baseStorage, name);
      for (const legacyKey of resolveLegacyStorageKeys(name)) {
        removeStorageItem(baseStorage, legacyKey);
      }
      return result;
    },
  };
}
