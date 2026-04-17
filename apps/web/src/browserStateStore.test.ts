import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vitest";

import { selectThreadBrowserHistory } from "./browserStateStore";

const THREAD_ID = ThreadId.makeUnsafe("thread-1");

describe("browserStateStore selectors", () => {
  it("reuses the same empty history snapshot for unknown threads", () => {
    const selector = selectThreadBrowserHistory(THREAD_ID);
    const store = {
      threadStatesByThreadId: {},
      recentHistoryByThreadId: {},
      upsertThreadState: () => undefined,
      removeThreadState: () => undefined,
    };

    const first = selector(store);
    const second = selector(store);

    expect(first).toBe(second);
    expect(first).toEqual([]);
  });

  it("falls back to empty browser state when persisted payloads are malformed", async () => {
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
      const { useBrowserStateStore: freshUseBrowserStateStore } =
        await import("./browserStateStore");
      const persistApi = freshUseBrowserStateStore.persist as unknown as {
        getOptions: () => {
          merge: (
            persistedState: unknown,
            currentState: ReturnType<typeof freshUseBrowserStateStore.getState>,
          ) => ReturnType<typeof freshUseBrowserStateStore.getState>;
        };
      };

      const mergedState = persistApi.getOptions().merge(
        {
          threadStatesByThreadId: {
            [THREAD_ID]: {
              threadId: THREAD_ID,
              open: true,
              activeTabId: null,
              tabs: "not-an-array",
              lastError: null,
            },
          },
          recentHistoryByThreadId: "not-an-object",
        },
        freshUseBrowserStateStore.getInitialState(),
      );

      expect(mergedState.threadStatesByThreadId).toEqual({});
      expect(mergedState.recentHistoryByThreadId).toEqual({});
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
