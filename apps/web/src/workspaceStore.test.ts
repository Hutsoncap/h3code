import { describe, expect, it, vi } from "vitest";

import { useWorkspaceStore } from "./workspaceStore";

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
});
