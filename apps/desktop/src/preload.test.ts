import { beforeEach, describe, expect, it, vi } from "vitest";

import { NOTIFICATIONS_SHOW_CHANNEL } from "./desktopNotifications";

const { exposeInMainWorldMock, invokeMock, onMock, removeListenerMock } = vi.hoisted(() => ({
  exposeInMainWorldMock: vi.fn(),
  invokeMock: vi.fn(),
  onMock: vi.fn(),
  removeListenerMock: vi.fn(),
}));

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: exposeInMainWorldMock,
  },
  ipcRenderer: {
    invoke: invokeMock,
    on: onMock,
    removeListener: removeListenerMock,
  },
}));

describe("preload desktop notification bridge", () => {
  beforeEach(async () => {
    exposeInMainWorldMock.mockReset();
    invokeMock.mockReset();
    onMock.mockReset();
    removeListenerMock.mockReset();
    vi.resetModules();

    await import("./preload");
  });

  it("decodes notification show results with the shared contracts schema", async () => {
    invokeMock.mockResolvedValueOnce(true);

    const desktopBridge = exposeInMainWorldMock.mock.calls[0]?.[1] as {
      notifications: { show: (input: unknown) => Promise<boolean> };
    };

    await expect(desktopBridge.notifications.show({ title: "Build complete" })).resolves.toBe(true);
    expect(invokeMock).toHaveBeenCalledWith(NOTIFICATIONS_SHOW_CHANNEL, {
      title: "Build complete",
    });
  });

  it("rejects invalid notification show responses from the main process", async () => {
    invokeMock.mockResolvedValueOnce("shown");

    const desktopBridge = exposeInMainWorldMock.mock.calls[0]?.[1] as {
      notifications: { show: (input: unknown) => Promise<boolean> };
    };

    await expect(desktopBridge.notifications.show({ title: "Build complete" })).rejects.toThrow();
  });

  it("trims and validates shell bridge inputs before invoking Electron", async () => {
    invokeMock.mockResolvedValue(undefined);

    const desktopBridge = exposeInMainWorldMock.mock.calls[0]?.[1] as {
      openExternal: (url: string) => Promise<unknown>;
      showInFolder: (path: string) => Promise<unknown>;
      shell: { showInFolder: (path: string) => Promise<unknown> };
    };

    await desktopBridge.openExternal(" https://example.com/path ");
    await desktopBridge.showInFolder(" /tmp/project ");
    await desktopBridge.shell.showInFolder(" /tmp/project ");

    expect(invokeMock).toHaveBeenNthCalledWith(
      1,
      "desktop:open-external",
      "https://example.com/path",
    );
    expect(invokeMock).toHaveBeenNthCalledWith(2, "desktop:show-in-folder", "/tmp/project");
    expect(invokeMock).toHaveBeenNthCalledWith(3, "desktop:show-in-folder", "/tmp/project");
  });

  it("rejects invalid shell bridge inputs before invoking Electron", async () => {
    const desktopBridge = exposeInMainWorldMock.mock.calls[0]?.[1] as {
      confirm: (message: string) => Promise<unknown>;
      openExternal: (url: string) => Promise<unknown>;
      showInFolder: (path: string) => Promise<unknown>;
      shell: { showInFolder: (path: string) => Promise<unknown> };
    };

    expect(() => desktopBridge.confirm("   ")).toThrow();
    expect(() => desktopBridge.openExternal("   ")).toThrow();
    expect(() => desktopBridge.showInFolder("   ")).toThrow();
    expect(() => desktopBridge.shell.showInFolder("   ")).toThrow();
    expect(() => desktopBridge.openExternal(123 as never)).toThrow();
    expect(() => desktopBridge.showInFolder(123 as never)).toThrow();
    expect(() => desktopBridge.shell.showInFolder(123 as never)).toThrow();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("drops invalid menu actions before they reach web listeners", () => {
    const desktopBridge = exposeInMainWorldMock.mock.calls[0]?.[1] as {
      onMenuAction: (listener: (action: string) => void) => () => void;
    };
    const listener = vi.fn();

    const unsubscribe = desktopBridge.onMenuAction(listener);
    const wrappedListener = onMock.mock.calls.find(
      ([channel]) => channel === "desktop:menu-action",
    )?.[1] as ((event: unknown, action: unknown) => void) | undefined;

    expect(wrappedListener).toBeDefined();
    wrappedListener?.({}, "toggle-sidebar");
    wrappedListener?.({}, "notification-open-thread:thread-123");
    wrappedListener?.({}, "not-a-real-action");
    wrappedListener?.({}, 123);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, "toggle-sidebar");
    expect(listener).toHaveBeenNthCalledWith(2, "notification-open-thread:thread-123");

    unsubscribe();
    expect(removeListenerMock).toHaveBeenCalledWith("desktop:menu-action", wrappedListener);
  });

  it("validates confirm bridge inputs before invoking Electron", async () => {
    invokeMock.mockResolvedValueOnce(true);

    const desktopBridge = exposeInMainWorldMock.mock.calls[0]?.[1] as {
      confirm: (message: string) => Promise<boolean>;
    };

    await expect(desktopBridge.confirm(" Delete project?\nThis cannot be undone. ")).resolves.toBe(
      true,
    );

    expect(invokeMock).toHaveBeenCalledWith(
      "desktop:confirm",
      "Delete project?\nThis cannot be undone.",
    );
  });
});
