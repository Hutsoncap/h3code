import { afterEach, describe, expect, it, vi } from "vitest";

import { createAliasedStateStorage } from "./storage";

function createMockStorage(
  entries: Iterable<[string, string]> = [],
  options: { asyncGetItem?: boolean } = {},
) {
  const backing = new Map(entries);
  const getItem = vi.fn((key: string) => {
    const value = backing.get(key) ?? null;
    return options.asyncGetItem ? Promise.resolve(value) : value;
  });
  const setItem = vi.fn((key: string, value: string) => {
    backing.set(key, value);
  });
  const removeItem = vi.fn((key: string) => {
    backing.delete(key);
  });

  return {
    backing,
    storage: {
      getItem,
      setItem,
      removeItem,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createAliasedStateStorage", () => {
  it("returns a valid current payload without touching legacy aliases", () => {
    const { backing, storage } = createMockStorage([
      ["h3code:workspace-pages:v2", JSON.stringify({ open: true })],
      ["t3code:workspace-pages:v2", JSON.stringify({ open: false })],
    ]);
    const aliasedStorage = createAliasedStateStorage(storage);

    expect(aliasedStorage.getItem("h3code:workspace-pages:v2")).toBe(
      JSON.stringify({ open: true }),
    );
    expect(backing.get("h3code:workspace-pages:v2")).toBe(JSON.stringify({ open: true }));
    expect(backing.get("t3code:workspace-pages:v2")).toBe(JSON.stringify({ open: false }));
  });

  it("drops a malformed current payload and falls back to a valid legacy alias", () => {
    const { backing, storage } = createMockStorage([
      ["h3code:workspace-pages:v2", "{not-json"],
      ["t3code:workspace-pages:v2", JSON.stringify({ open: true })],
    ]);
    const aliasedStorage = createAliasedStateStorage(storage);

    expect(aliasedStorage.getItem("h3code:workspace-pages:v2")).toBe(
      JSON.stringify({ open: true }),
    );
    expect(backing.get("h3code:workspace-pages:v2")).toBe(JSON.stringify({ open: true }));
    expect(backing.has("t3code:workspace-pages:v2")).toBe(false);
  });

  it("skips a malformed legacy alias and returns null when no valid payload remains", async () => {
    const { backing, storage } = createMockStorage([["t3code:workspace-pages:v2", "{not-json"]], {
      asyncGetItem: true,
    });
    const aliasedStorage = createAliasedStateStorage(storage);

    await expect(aliasedStorage.getItem("h3code:workspace-pages:v2")).resolves.toBeNull();
    expect(backing.has("h3code:workspace-pages:v2")).toBe(false);
    expect(backing.has("t3code:workspace-pages:v2")).toBe(false);
  });
});
