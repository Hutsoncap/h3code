import * as Schema from "effect/Schema";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_WINDOW = globalThis.window;

function createLocalStorage(storage: Map<string, string>): Storage {
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size;
    },
  };
}

async function loadUseLocalStorageModule(storageEntries: Iterable<[string, string]>) {
  vi.resetModules();

  const storage = new Map(storageEntries);
  const localStorage = createLocalStorage(storage);

  vi.stubGlobal("window", {
    localStorage,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });

  return { ...(await import("./useLocalStorage")), storage };
}

afterEach(() => {
  vi.unstubAllGlobals();

  if (ORIGINAL_WINDOW === undefined) {
    Reflect.deleteProperty(globalThis, "window");
  } else {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: ORIGINAL_WINDOW,
    });
  }

  vi.restoreAllMocks();
});

describe("getLocalStorageItem", () => {
  it("returns persisted values when the stored JSON matches the schema", async () => {
    const { getLocalStorageItem, storage } = await loadUseLocalStorageModule([
      ["h3code:editor", JSON.stringify({ count: 1 })],
    ]);
    const schema = Schema.Struct({ count: Schema.Number });

    expect(getLocalStorageItem("h3code:editor", schema)).toEqual({ count: 1 });
    expect(storage.get("h3code:editor")).toBe(JSON.stringify({ count: 1 }));
  });

  it("returns null and clears malformed JSON instead of throwing", async () => {
    const { getLocalStorageItem, storage } = await loadUseLocalStorageModule([
      ["h3code:editor", "{not-json"],
    ]);
    const schema = Schema.Struct({ count: Schema.Number });

    expect(getLocalStorageItem("h3code:editor", schema)).toBeNull();
    expect(storage.has("h3code:editor")).toBe(false);
  });

  it("returns null and clears schema-incompatible values instead of throwing", async () => {
    const { getLocalStorageItem, storage } = await loadUseLocalStorageModule([
      ["h3code:editor", JSON.stringify({ count: "oops" })],
    ]);
    const schema = Schema.Struct({ count: Schema.Number });

    expect(getLocalStorageItem("h3code:editor", schema)).toBeNull();
    expect(storage.has("h3code:editor")).toBe(false);
  });
});

describe("useLocalStorage", () => {
  it("falls back to the initial value when the stored payload is malformed", async () => {
    const { useLocalStorage } = await loadUseLocalStorageModule([
      ["h3code:last-editor", "{not-json"],
    ]);

    let renderedValue: string | null = null;

    function Harness() {
      const [value] = useLocalStorage("h3code:last-editor", "fallback", Schema.String);
      renderedValue = value;
      return null;
    }

    renderToStaticMarkup(createElement(Harness));

    expect(renderedValue).toBe("fallback");
  });
});
