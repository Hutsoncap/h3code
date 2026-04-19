import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWebAppsStore } from "./webAppsStore";

describe("useWebAppsStore", () => {
  beforeEach(() => {
    useWebAppsStore.setState({ webApps: [] });
  });

  it("installs browser tabs as web apps and deduplicates by normalized url", () => {
    const first = useWebAppsStore.getState().installFromTab({
      title: "Docs",
      url: "https://example.com/docs",
      faviconUrl: "https://example.com/favicon.png",
    });

    const second = useWebAppsStore.getState().installFromTab({
      title: "Example Docs",
      url: "https://example.com/docs",
      faviconUrl: "https://example.com/favicon-2.png",
    });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first?.id).toBe(second?.id);
    expect(useWebAppsStore.getState().webApps).toEqual([
      {
        id: first?.id,
        name: "Example Docs",
        url: "https://example.com/docs",
        faviconUrl: "https://example.com/favicon-2.png",
        createdAt: first?.createdAt,
      },
    ]);
  });

  it("adds manual web apps only when the url is valid", () => {
    expect(
      useWebAppsStore.getState().addWebApp({
        name: "Broken",
        url: "not-a-url",
      }),
    ).toBeNull();

    const created = useWebAppsStore.getState().addWebApp({
      name: "",
      url: "https://calendar.example.com",
    });

    expect(created).not.toBeNull();
    expect(useWebAppsStore.getState().webApps).toMatchObject([
      {
        id: created?.id,
        name: "calendar.example.com",
        url: "https://calendar.example.com/",
      },
    ]);
  });

  it("falls back to the current state when persisted web apps are malformed", async () => {
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
      const { useWebAppsStore: freshUseWebAppsStore } = await import("./webAppsStore");
      const persistApi = freshUseWebAppsStore.persist as unknown as {
        getOptions: () => {
          merge: (
            persistedState: unknown,
            currentState: ReturnType<typeof freshUseWebAppsStore.getState>,
          ) => ReturnType<typeof freshUseWebAppsStore.getState>;
        };
      };

      const mergedState = persistApi.getOptions().merge(
        {
          webApps: [{ id: "app-1", name: "Broken", url: "nope", faviconUrl: null }],
        },
        freshUseWebAppsStore.getInitialState(),
      );

      expect(mergedState.webApps).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
