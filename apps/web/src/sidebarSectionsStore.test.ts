import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarSectionsStore } from "./sidebarSectionsStore";

describe("useSidebarSectionsStore", () => {
  beforeEach(() => {
    useSidebarSectionsStore.setState({
      sections: {
        pinned: true,
        threads: true,
        workspaces: true,
        browser: true,
      },
    });
  });

  it("toggles section visibility", () => {
    useSidebarSectionsStore.getState().toggleSection("threads");
    expect(useSidebarSectionsStore.getState().sections.threads).toBe(false);

    useSidebarSectionsStore.getState().toggleSection("threads");
    expect(useSidebarSectionsStore.getState().sections.threads).toBe(true);
  });

  it("updates a section explicitly", () => {
    useSidebarSectionsStore.getState().setSectionOpen("workspaces", false);
    expect(useSidebarSectionsStore.getState().sections).toMatchObject({
      threads: true,
      workspaces: false,
    });
  });

  it("falls back to the current state when persisted sections are malformed", async () => {
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
      const { useSidebarSectionsStore: freshUseSidebarSectionsStore } =
        await import("./sidebarSectionsStore");
      const persistApi = freshUseSidebarSectionsStore.persist as unknown as {
        getOptions: () => {
          merge: (
            persistedState: unknown,
            currentState: ReturnType<typeof freshUseSidebarSectionsStore.getState>,
          ) => ReturnType<typeof freshUseSidebarSectionsStore.getState>;
        };
      };

      const mergedState = persistApi.getOptions().merge(
        {
          sections: {
            pinned: true,
            threads: "nope",
            workspaces: false,
          },
        },
        freshUseSidebarSectionsStore.getInitialState(),
      );

      expect(mergedState.sections).toEqual({
        pinned: true,
        threads: true,
        workspaces: true,
        browser: true,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
