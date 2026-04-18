import { describe, expect, it, vi } from "vitest";

describe("workspaceStore persistence", () => {
  it("falls back to the current state when persisted workspace payloads are malformed", async () => {
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
      const { useWorkspaceStore: freshUseWorkspaceStore } = await import("./workspaceStore");
      const persistApi = freshUseWorkspaceStore.persist as unknown as {
        getOptions: () => {
          merge: (
            persistedState: unknown,
            currentState: ReturnType<typeof freshUseWorkspaceStore.getState>,
          ) => ReturnType<typeof freshUseWorkspaceStore.getState>;
        };
      };

      const mergedState = persistApi.getOptions().merge(
        {
          homeDir: 42,
          workspacePages: "not-an-array",
        },
        freshUseWorkspaceStore.getInitialState(),
      );

      expect(mergedState.homeDir).toBeNull();
      expect(mergedState.workspacePages).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("treats quote-wrapped blank persisted home directories as absent", async () => {
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
      const { useWorkspaceStore: freshUseWorkspaceStore } = await import("./workspaceStore");
      const persistApi = freshUseWorkspaceStore.persist as unknown as {
        getOptions: () => {
          merge: (
            persistedState: unknown,
            currentState: ReturnType<typeof freshUseWorkspaceStore.getState>,
          ) => ReturnType<typeof freshUseWorkspaceStore.getState>;
        };
      };

      const mergedState = persistApi.getOptions().merge(
        {
          homeDir: ' "   " ',
          workspacePages: [],
        },
        freshUseWorkspaceStore.getInitialState(),
      );

      expect(mergedState.homeDir).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("treats quote-wrapped blank home directories from runtime updates as absent", async () => {
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
      const { useWorkspaceStore: freshUseWorkspaceStore } = await import("./workspaceStore");

      freshUseWorkspaceStore.getState().setHomeDir(' "" ');

      expect(freshUseWorkspaceStore.getState().homeDir).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("treats quote-wrapped blank persisted workspace titles as absent", async () => {
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
      const { useWorkspaceStore: freshUseWorkspaceStore } = await import("./workspaceStore");
      const persistApi = freshUseWorkspaceStore.persist as unknown as {
        getOptions: () => {
          merge: (
            persistedState: unknown,
            currentState: ReturnType<typeof freshUseWorkspaceStore.getState>,
          ) => ReturnType<typeof freshUseWorkspaceStore.getState>;
        };
      };

      const mergedState = persistApi.getOptions().merge(
        {
          homeDir: null,
          workspacePages: [
            {
              id: "workspace-1",
              title: ' "   " ',
              layoutPresetId: "single-terminal",
              createdAt: "2026-04-05T10:00:00.000Z",
              updatedAt: "2026-04-05T10:00:00.000Z",
            },
          ],
        },
        freshUseWorkspaceStore.getInitialState(),
      );

      expect(mergedState.workspacePages).toEqual([
        {
          id: "workspace-1",
          title: "Workspace 1",
          layoutPresetId: "single",
          createdAt: "2026-04-05T10:00:00.000Z",
          updatedAt: "2026-04-05T10:00:00.000Z",
        },
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("treats quote-wrapped blank rename requests as absent", async () => {
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
      const { useWorkspaceStore: freshUseWorkspaceStore } = await import("./workspaceStore");

      const workspaceId = freshUseWorkspaceStore.getState().workspacePages[0]!.id;
      freshUseWorkspaceStore.getState().renameWorkspace(workspaceId, ' "   " ');

      expect(freshUseWorkspaceStore.getState().workspacePages[0]?.title).toBe("Workspace 1");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
