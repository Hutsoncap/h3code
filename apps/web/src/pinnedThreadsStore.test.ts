// FILE: pinnedThreadsStore.test.ts
// Purpose: Verifies the global pinned-thread store mutates ids predictably.
// Layer: UI state store test

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThreadId } from "@t3tools/contracts";
import { usePinnedThreadsStore } from "./pinnedThreadsStore";

describe("usePinnedThreadsStore", () => {
  beforeEach(() => {
    usePinnedThreadsStore.setState({ pinnedThreadIds: [] });
  });

  it("toggles a pinned thread id on and off", () => {
    usePinnedThreadsStore.getState().togglePinnedThread("thread-1" as ThreadId);
    expect(usePinnedThreadsStore.getState().pinnedThreadIds).toEqual(["thread-1"]);

    usePinnedThreadsStore.getState().togglePinnedThread("thread-1" as ThreadId);
    expect(usePinnedThreadsStore.getState().pinnedThreadIds).toEqual([]);
  });

  it("prunes thread ids that are no longer present", () => {
    usePinnedThreadsStore.setState({
      pinnedThreadIds: ["thread-2" as ThreadId, "thread-1" as ThreadId],
    });

    usePinnedThreadsStore.getState().prunePinnedThreads(["thread-1" as ThreadId]);
    expect(usePinnedThreadsStore.getState().pinnedThreadIds).toEqual(["thread-1"]);
  });

  it("falls back to the current state when persisted pins are malformed", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } satisfies Storage);
    vi.resetModules();
    try {
      const { usePinnedThreadsStore: freshUsePinnedThreadsStore } =
        await import("./pinnedThreadsStore");
      const persistApi = freshUsePinnedThreadsStore.persist as unknown as {
        getOptions: () => {
          merge: (
            persistedState: unknown,
            currentState: ReturnType<typeof freshUsePinnedThreadsStore.getState>,
          ) => ReturnType<typeof freshUsePinnedThreadsStore.getState>;
        };
      };

      const mergedState = persistApi.getOptions().merge(
        {
          pinnedThreadIds: "not-an-array",
        },
        freshUsePinnedThreadsStore.getInitialState(),
      );

      expect(mergedState.pinnedThreadIds).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
