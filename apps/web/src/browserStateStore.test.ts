import { ThreadId } from "@t3tools/contracts";
import { browserSurfaceKey, createThreadBrowserSurfaceId } from "@t3tools/shared/browserSurface";
import { describe, expect, it, vi } from "vitest";

import { selectThreadBrowserHistory, useBrowserStateStore } from "./browserStateStore";

const THREAD_ID = ThreadId.makeUnsafe("thread-1");
const THREAD_SURFACE_ID = createThreadBrowserSurfaceId(THREAD_ID);
const THREAD_SURFACE_KEY = browserSurfaceKey(THREAD_SURFACE_ID);

describe("browserStateStore selectors", () => {
  it("reuses the same empty history snapshot for unknown threads", () => {
    const selector = selectThreadBrowserHistory(THREAD_ID);
    const store = {
      surfaceStatesById: {},
      recentHistoryBySurfaceId: {},
      upsertSurfaceState: () => undefined,
      removeSurfaceState: () => undefined,
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
          surfaceStatesById: {
            [THREAD_SURFACE_KEY]: {
              surfaceId: THREAD_SURFACE_ID,
              open: true,
              activeTabId: null,
              tabs: "not-an-array",
              lastError: null,
            },
          },
          recentHistoryBySurfaceId: "not-an-object",
        },
        freshUseBrowserStateStore.getInitialState(),
      );

      expect(mergedState.surfaceStatesById).toEqual({});
      expect(mergedState.recentHistoryBySurfaceId).toEqual({});
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("migrates legacy thread-keyed persisted browser state into surface-keyed storage", async () => {
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
          migrate: (persistedState: unknown, version: number) => unknown;
        };
      };

      const migratedState = persistApi.getOptions().migrate(
        {
          threadStatesByThreadId: {
            [THREAD_ID]: {
              threadId: THREAD_ID,
              open: true,
              activeTabId: "tab-1",
              tabs: [
                {
                  id: "tab-1",
                  url: "https://example.com/",
                  title: "example.com",
                  status: "live",
                  isLoading: false,
                  canGoBack: false,
                  canGoForward: false,
                  faviconUrl: null,
                  lastCommittedUrl: "https://example.com/",
                  lastError: null,
                },
              ],
              lastError: null,
            },
          },
          recentHistoryByThreadId: {
            [THREAD_ID]: [{ url: "https://example.com/", title: "example.com", tabId: "tab-1" }],
          },
        },
        0,
      ) as {
        surfaceStatesById: Record<string, { open: boolean; surfaceId: { kind: string } }>;
        recentHistoryBySurfaceId: Record<
          string,
          Array<{ url: string; title: string; tabId: string }>
        >;
      };

      expect(migratedState.surfaceStatesById[THREAD_SURFACE_KEY]).toMatchObject({
        open: true,
        surfaceId: { kind: "thread", threadId: THREAD_ID },
      });
      expect(migratedState.recentHistoryBySurfaceId[THREAD_SURFACE_KEY]).toEqual([
        { url: "https://example.com/", title: "example.com", tabId: "tab-1" },
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("drops quote-wrapped blank persisted thread ids", async () => {
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
          surfaceStatesById: {
            [THREAD_SURFACE_KEY]: {
              surfaceId: { kind: "thread", threadId: ' "   " ' },
              open: true,
              activeTabId: null,
              tabs: [],
              lastError: null,
            },
          },
          recentHistoryBySurfaceId: {
            [' "   " ']: [{ url: "https://example.com", title: "Example", tabId: "tab-1" }],
          },
        },
        freshUseBrowserStateStore.getInitialState(),
      );

      expect(mergedState.surfaceStatesById).toEqual({});
      expect(mergedState.recentHistoryBySurfaceId).toEqual({});
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ignores quote-wrapped blank history urls when upserting thread state", () => {
    const store = useBrowserStateStore;
    const initialState = store.getInitialState();
    store.setState(initialState, true);

    store.getState().upsertSurfaceState({
      surfaceId: THREAD_SURFACE_ID,
      open: true,
      activeTabId: "tab-1",
      tabs: [
        {
          id: "tab-1",
          url: ' "   " ',
          lastCommittedUrl: ' "   " ',
          title: "Placeholder",
        },
      ],
      lastError: null,
    } as never);

    expect(selectThreadBrowserHistory(THREAD_ID)(store.getState())).toEqual([]);

    store.setState(initialState, true);
  });
});
