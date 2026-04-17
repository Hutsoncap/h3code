import { describe, expect, it } from "vitest";

import { useWorkspaceStore } from "./workspaceStore";

describe("workspaceStore persistence", () => {
  it("falls back to the current state when persisted workspace payloads are malformed", () => {
    const persistApi = useWorkspaceStore.persist as unknown as {
      getOptions: () => {
        merge: (
          persistedState: unknown,
          currentState: ReturnType<typeof useWorkspaceStore.getState>,
        ) => ReturnType<typeof useWorkspaceStore.getState>;
      };
    };

    const mergedState = persistApi.getOptions().merge(
      {
        homeDir: 42,
        workspacePages: "not-an-array",
      },
      useWorkspaceStore.getInitialState(),
    );

    expect(mergedState.homeDir).toBeNull();
    expect(mergedState.workspacePages).toHaveLength(1);
  });
});
