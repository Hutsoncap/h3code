import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThreadId } from "@t3tools/contracts";
import { usePinnedItemsStore } from "./pinnedItemsStore";

describe("usePinnedItemsStore", () => {
  beforeEach(() => {
    usePinnedItemsStore.setState({ pinnedItems: [] });
  });

  it("toggles pinned items across kinds without duplicating them", () => {
    usePinnedItemsStore.getState().togglePin({ kind: "thread", id: "thread-1" as ThreadId });
    usePinnedItemsStore.getState().togglePin({ kind: "workspace", id: "workspace-1" });
    usePinnedItemsStore.getState().togglePin({ kind: "thread", id: "thread-1" as ThreadId });

    expect(usePinnedItemsStore.getState().pinnedItems).toEqual([
      { kind: "workspace", id: "workspace-1" },
    ]);
  });

  it("prunes only the kinds included in the allow list", () => {
    usePinnedItemsStore.setState({
      pinnedItems: [
        { kind: "workspace", id: "workspace-2" },
        { kind: "thread", id: "thread-2" as ThreadId },
        { kind: "thread", id: "thread-1" as ThreadId },
      ],
    });

    usePinnedItemsStore.getState().prune({
      thread: ["thread-1" as ThreadId],
    });

    expect(usePinnedItemsStore.getState().pinnedItems).toEqual([
      { kind: "workspace", id: "workspace-2" },
      { kind: "thread", id: "thread-1" as ThreadId },
    ]);
  });

  it("migrates legacy pinned thread storage into the generic pinned item list", async () => {
    const storage = new Map<string, string>();
    storage.set(
      "h3code:pinned-threads:v1",
      JSON.stringify({
        state: {
          pinnedThreadIds: ["thread-2", "thread-1"],
        },
        version: 0,
      }),
    );

    vi.stubGlobal("localStorage", {
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
    } satisfies Storage);
    vi.resetModules();

    try {
      const { usePinnedItemsStore: freshUsePinnedItemsStore } = await import("./pinnedItemsStore");
      await Promise.resolve();
      await Promise.resolve();

      expect(freshUsePinnedItemsStore.getState().pinnedItems).toEqual([
        { kind: "thread", id: "thread-2" },
        { kind: "thread", id: "thread-1" },
      ]);
      expect(storage.has("h3code:pinned-threads:v1")).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
