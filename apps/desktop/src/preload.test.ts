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
});
