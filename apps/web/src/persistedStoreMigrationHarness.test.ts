import { ProjectId, ThreadId, TurnId } from "@t3tools/contracts";
import { browserSurfaceKey, createThreadBrowserSurfaceId } from "@t3tools/shared/browserSurface";
import { afterEach, describe, expect, it, vi } from "vitest";

const THREAD_A = ThreadId.makeUnsafe("thread-a");
const THREAD_B = ThreadId.makeUnsafe("thread-b");
const THREAD_A_SURFACE_KEY = browserSurfaceKey(createThreadBrowserSurfaceId(THREAD_A));
const PROJECT_ID = ProjectId.makeUnsafe("project-1");
const TURN_ID = TurnId.makeUnsafe("turn-1");

type PersistStore = {
  getState: () => any;
  persist: {
    getOptions: () => {
      name: string;
      version?: number;
      partialize?: (state: any) => any;
    };
  };
};

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
  } satisfies Storage;
}

function toLegacyStorageKey(currentKey: string): string {
  return currentKey.replace(/^h3code:/, "t3code:");
}

async function flushHydration() {
  await Promise.resolve();
  await Promise.resolve();
}

async function seedLegacyState<TModule>(options: {
  importModule: () => Promise<TModule>;
  selectStore: (module: TModule) => PersistStore;
  mutate: (module: TModule, store: PersistStore) => void;
}) {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", createLocalStorage(storage));

  const initialModule = await options.importModule();
  const initialStore = options.selectStore(initialModule);
  options.mutate(initialModule, initialStore);

  const persistOptions = initialStore.persist.getOptions();
  const persistedState = persistOptions.partialize
    ? persistOptions.partialize(initialStore.getState())
    : initialStore.getState();
  const currentKey = persistOptions.name;
  const legacyKey = toLegacyStorageKey(currentKey);

  storage.clear();
  storage.set(
    legacyKey,
    JSON.stringify({
      state: persistedState,
      version: persistOptions.version ?? 0,
    }),
  );

  vi.resetModules();
  vi.stubGlobal("localStorage", createLocalStorage(storage));

  const hydratedModule = await options.importModule();
  const hydratedStore = options.selectStore(hydratedModule);
  await flushHydration();

  return {
    currentKey,
    legacyKey,
    module: hydratedModule,
    storage,
    store: hydratedStore,
  };
}

describe("persisted store legacy-key migration harness", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("hydrates browser state from the legacy t3code key", async () => {
    const { storage, currentKey, legacyKey, store } = await seedLegacyState({
      importModule: () => import("./browserStateStore"),
      selectStore: (module) => module.useBrowserStateStore as PersistStore,
      mutate: (_module, store) => {
        store.getState().upsertSurfaceState({
          surfaceId: createThreadBrowserSurfaceId(THREAD_A),
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
        });
      },
    });

    expect(storage.has(currentKey)).toBe(true);
    expect(storage.has(legacyKey)).toBe(false);
    expect(store.getState().surfaceStatesById[THREAD_A_SURFACE_KEY]?.open).toBe(true);
    expect(store.getState().recentHistoryBySurfaceId[THREAD_A_SURFACE_KEY]).toEqual([
      {
        url: "https://example.com/",
        title: "example.com",
        tabId: "tab-1",
      },
    ]);
  });

  it("hydrates composer drafts from the legacy t3code key", async () => {
    const { storage, currentKey, legacyKey, store } = await seedLegacyState({
      importModule: () => import("./composerDraftStore"),
      selectStore: (module) => module.useComposerDraftStore as PersistStore,
      mutate: (_module, store) => {
        store.getState().setPrompt(THREAD_A, "legacy composer prompt");
      },
    });

    expect(storage.has(currentKey)).toBe(true);
    expect(storage.has(legacyKey)).toBe(false);
    expect(store.getState().draftsByThreadId[THREAD_A]?.prompt).toBe("legacy composer prompt");
  });

  it("hydrates single-chat panel state from the legacy t3code key", async () => {
    const { storage, currentKey, legacyKey, store } = await seedLegacyState({
      importModule: () => import("./singleChatPanelStore"),
      selectStore: (module) => module.useSingleChatPanelStore as PersistStore,
      mutate: (_module, store) => {
        store.getState().setThreadPanelState(THREAD_A, {
          panel: "diff",
          diffTurnId: TURN_ID,
          diffFilePath: "src/app.tsx",
          hasOpenedPanel: true,
          lastOpenPanel: "diff",
        });
      },
    });

    expect(storage.has(currentKey)).toBe(true);
    expect(storage.has(legacyKey)).toBe(false);
    expect(store.getState().panelStateByThreadId[THREAD_A]).toMatchObject({
      panel: "diff",
      diffTurnId: TURN_ID,
      diffFilePath: "src/app.tsx",
      hasOpenedPanel: true,
      lastOpenPanel: "diff",
    });
  });

  it("hydrates pinned items from the legacy t3code key", async () => {
    const { storage, currentKey, legacyKey, store } = await seedLegacyState({
      importModule: () => import("./pinnedItemsStore"),
      selectStore: (module) => module.usePinnedItemsStore as PersistStore,
      mutate: (_module, store) => {
        store.getState().pinItem({ kind: "thread", id: THREAD_A });
        store.getState().pinItem({ kind: "thread", id: THREAD_B });
      },
    });

    expect(storage.has(currentKey)).toBe(true);
    expect(storage.has(legacyKey)).toBe(false);
    expect(store.getState().pinnedItems).toEqual([
      { kind: "thread", id: THREAD_B },
      { kind: "thread", id: THREAD_A },
    ]);
  });

  it("hydrates sidebar sections from the legacy t3code key", async () => {
    const { storage, currentKey, legacyKey, store } = await seedLegacyState({
      importModule: () => import("./sidebarSectionsStore"),
      selectStore: (module) => module.useSidebarSectionsStore as PersistStore,
      mutate: (_module, store) => {
        store.getState().setSectionOpen("threads", false);
        store.getState().setSectionOpen("browser", false);
      },
    });

    expect(storage.has(currentKey)).toBe(true);
    expect(storage.has(legacyKey)).toBe(false);
    expect(store.getState().sections).toMatchObject({
      pinned: true,
      threads: false,
      workspaces: true,
      browser: false,
    });
  });

  it("hydrates split views from the legacy t3code key", async () => {
    const { storage, currentKey, legacyKey, store } = await seedLegacyState({
      importModule: () => import("./splitViewStore"),
      selectStore: (module) => module.useSplitViewStore as PersistStore,
      mutate: (_module, store) => {
        const splitViewId = store.getState().createFromThread({
          sourceThreadId: THREAD_A,
          ownerProjectId: PROJECT_ID,
        });
        store.getState().replacePaneThread(splitViewId, "right", THREAD_B);
        store.getState().setPanePanelState(splitViewId, "right", {
          panel: "diff",
          diffTurnId: TURN_ID,
          diffFilePath: "src/right.ts",
          hasOpenedPanel: true,
          lastOpenPanel: "diff",
        });
      },
    });

    const splitViewIds = Object.keys(store.getState().splitViewsById);
    const [splitViewId] = splitViewIds;
    expect(storage.has(currentKey)).toBe(true);
    expect(storage.has(legacyKey)).toBe(false);
    expect(splitViewIds).toHaveLength(1);
    expect(splitViewId).toBeDefined();
    if (!splitViewId) {
      throw new Error("Expected a migrated split view id");
    }
    expect(store.getState().splitViewIdBySourceThreadId[THREAD_A]).toBe(splitViewId);
    expect(store.getState().splitViewsById[splitViewId]).toMatchObject({
      sourceThreadId: THREAD_A,
      rightThreadId: THREAD_B,
    });
  });

  it("hydrates terminal state from the legacy t3code key", async () => {
    const { storage, currentKey, legacyKey, store } = await seedLegacyState({
      importModule: () => import("./terminalStateStore"),
      selectStore: (module) => module.useTerminalStateStore as PersistStore,
      mutate: (_module, store) => {
        store.getState().openTerminalThreadPage(THREAD_A, { terminalOnly: true });
        store.getState().splitTerminal(THREAD_A, "terminal-2");
      },
    });

    expect(storage.has(currentKey)).toBe(true);
    expect(storage.has(legacyKey)).toBe(false);
    expect(store.getState().terminalStateByThreadId[THREAD_A]).toMatchObject({
      entryPoint: "terminal",
      terminalOpen: true,
      terminalIds: ["default", "terminal-2"],
      activeTerminalId: "terminal-2",
    });
  });

  it("hydrates workspace state from the legacy t3code key", async () => {
    const { storage, currentKey, legacyKey, store } = await seedLegacyState({
      importModule: () => import("./workspaceStore"),
      selectStore: (module) => module.useWorkspaceStore as PersistStore,
      mutate: (_module, store) => {
        store.getState().setHomeDir("/Users/hutson/legacy-home");
        store.getState().ensureWorkspacePage("workspace-legacy");
      },
    });

    expect(storage.has(currentKey)).toBe(true);
    expect(storage.has(legacyKey)).toBe(false);
    expect(store.getState().homeDir).toBe("/Users/hutson/legacy-home");
    expect(
      store
        .getState()
        .workspacePages.some((workspace: { id: string }) => workspace.id === "workspace-legacy"),
    ).toBe(true);
  });
});
