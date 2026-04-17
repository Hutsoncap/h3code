import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import { selectThreadBrowserHistory, useBrowserStateStore } from "./browserStateStore";

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

  it("falls back to empty browser state when persisted payloads are malformed", () => {
    const persistApi = useBrowserStateStore.persist as unknown as {
      getOptions: () => {
        merge: (
          persistedState: unknown,
          currentState: ReturnType<typeof useBrowserStateStore.getState>,
        ) => ReturnType<typeof useBrowserStateStore.getState>;
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
      useBrowserStateStore.getInitialState(),
    );

    expect(mergedState.threadStatesByThreadId).toEqual({});
    expect(mergedState.recentHistoryByThreadId).toEqual({});
  });
});
