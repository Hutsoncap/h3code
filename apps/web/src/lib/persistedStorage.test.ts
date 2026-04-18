import { describe, expect, it } from "vitest";
import {
  getPersistedStorageItem,
  removePersistedStorageItem,
  setPersistedStorageItem,
} from "./persistedStorage";
import { createAliasedStateStorage, createMemoryStorage } from "./storage";

describe("persistedStorage", () => {
  it("migrates legacy t3code keys to h3code keys", () => {
    const storage = new Map<string, string>([["t3code:theme", "dark"]]);
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };

    expect(getPersistedStorageItem(localStorage, "h3code:theme")).toBe("dark");
    expect(storage.get("h3code:theme")).toBe("dark");
    expect(storage.has("t3code:theme")).toBe(false);

    setPersistedStorageItem(localStorage, "h3code:theme", "light");
    expect(storage.get("h3code:theme")).toBe("light");
    expect(storage.has("t3code:theme")).toBe(false);

    removePersistedStorageItem(localStorage, "h3code:theme");
    expect(storage.has("h3code:theme")).toBe(false);
    expect(storage.has("t3code:theme")).toBe(false);
  });

  it("normalizes extra legacy aliases before migrating or clearing them", () => {
    const storage = new Map<string, string>([["legacy:theme", "dark"]]);
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };

    expect(
      getPersistedStorageItem(localStorage, "h3code:theme", [
        "  legacy:theme  ",
        "   ",
        "h3code:theme",
      ]),
    ).toBe("dark");
    expect(storage.get("h3code:theme")).toBe("dark");
    expect(storage.has("legacy:theme")).toBe(false);

    storage.set("legacy:theme", "stale");
    setPersistedStorageItem(localStorage, "h3code:theme", "light", ["  legacy:theme  "]);
    expect(storage.get("h3code:theme")).toBe("light");
    expect(storage.has("legacy:theme")).toBe(false);

    storage.set("legacy:theme", "stale");
    removePersistedStorageItem(localStorage, "h3code:theme", ["  legacy:theme  "]);
    expect(storage.has("h3code:theme")).toBe(false);
    expect(storage.has("legacy:theme")).toBe(false);
  });

  it("ignores quote-wrapped blank extra legacy aliases", () => {
    const storage = new Map<string, string>([['"   "', "placeholder"]]);
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };

    expect(getPersistedStorageItem(localStorage, "h3code:theme", [' "   " '])).toBeNull();
    expect(storage.has('"   "')).toBe(true);

    setPersistedStorageItem(localStorage, "h3code:theme", "light", [' "   " ']);
    expect(storage.get("h3code:theme")).toBe("light");
    expect(storage.has('"   "')).toBe(true);

    removePersistedStorageItem(localStorage, "h3code:theme", [' "   " ']);
    expect(storage.has("h3code:theme")).toBe(false);
    expect(storage.has('"   "')).toBe(true);
  });

  it("wraps zustand storage with the same alias migration behavior", () => {
    const storage = createAliasedStateStorage(createMemoryStorage());

    storage.setItem("t3code:workspace-pages:v2", "legacy");

    expect(storage.getItem("h3code:workspace-pages:v2")).toBe("legacy");
    expect(storage.getItem("t3code:workspace-pages:v2")).toBe(null);
    expect(storage.getItem("h3code:workspace-pages:v2")).toBe("legacy");
  });
});
