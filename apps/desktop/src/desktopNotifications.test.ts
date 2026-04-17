import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  registerDesktopNotificationShowHandler,
  NOTIFICATIONS_SHOW_CHANNEL,
} from "./desktopNotifications";

describe("registerDesktopNotificationShowHandler", () => {
  const removeHandler = vi.fn();
  const handle = vi.fn();

  beforeEach(() => {
    removeHandler.mockReset();
    handle.mockReset();
  });

  it("registers the desktop notification show channel", () => {
    registerDesktopNotificationShowHandler({
      ipc: { removeHandler, handle },
      isDevelopment: true,
      showNotification: vi.fn(() => true),
    });

    expect(removeHandler).toHaveBeenCalledWith(NOTIFICATIONS_SHOW_CHANNEL);
    expect(handle).toHaveBeenCalledWith(NOTIFICATIONS_SHOW_CHANNEL, expect.any(Function));
  });

  it("rejects excess fields before notification logic runs in development", async () => {
    const showNotification = vi.fn(() => true);

    registerDesktopNotificationShowHandler({
      ipc: { removeHandler, handle },
      isDevelopment: true,
      showNotification,
    });

    const registered = handle.mock.calls[0]?.[1] as
      | ((event: unknown, payload: unknown) => unknown)
      | undefined;

    await expect(
      registered?.(
        {},
        {
          title: "Build complete",
          body: "Thread finished",
          silent: false,
          threadId: "thread-1",
          extra: true,
        },
      ),
    ).rejects.toThrow(/Unexpected key/);
    expect(showNotification).not.toHaveBeenCalled();
  });
});
