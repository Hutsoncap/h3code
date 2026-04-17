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

  it("validates shell bridge inputs with shared contracts schemas before invoking Electron", async () => {
    invokeMock.mockResolvedValue(undefined);

    const desktopBridge = exposeInMainWorldMock.mock.calls[0]?.[1] as {
      openExternal: (url: string) => Promise<unknown>;
      showInFolder: (path: string) => Promise<unknown>;
      shell: { showInFolder: (path: string) => Promise<unknown> };
    };

    await desktopBridge.openExternal("https://example.com");
    await desktopBridge.showInFolder("/tmp/project");
    await desktopBridge.shell.showInFolder("/tmp/project");

    expect(invokeMock).toHaveBeenNthCalledWith(1, "desktop:open-external", "https://example.com");
    expect(invokeMock).toHaveBeenNthCalledWith(2, "desktop:show-in-folder", "/tmp/project");
    expect(invokeMock).toHaveBeenNthCalledWith(3, "desktop:show-in-folder", "/tmp/project");
  });

  it("rejects invalid shell bridge inputs before invoking Electron", async () => {
    const desktopBridge = exposeInMainWorldMock.mock.calls[0]?.[1] as {
      openExternal: (url: string) => Promise<unknown>;
      showInFolder: (path: string) => Promise<unknown>;
      shell: { showInFolder: (path: string) => Promise<unknown> };
    };

    expect(() => desktopBridge.openExternal(123 as never)).toThrow();
    expect(() => desktopBridge.showInFolder(123 as never)).toThrow();
    expect(() => desktopBridge.shell.showInFolder(123 as never)).toThrow();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
