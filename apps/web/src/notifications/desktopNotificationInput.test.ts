import { describe, expect, it } from "vitest";

import { parseDesktopNotificationInput } from "./desktopNotificationInput";

describe("parseDesktopNotificationInput", () => {
  it("accepts valid notification payloads", () => {
    expect(
      parseDesktopNotificationInput({
        title: "Activity notification",
        body: "Notification test for chats and terminal agents.",
        silent: false,
      }),
    ).toEqual({
      title: "Activity notification",
      body: "Notification test for chats and terminal agents.",
      silent: false,
    });
  });

  it("rejects invalid notification payloads before they reach the native bridge", () => {
    expect(() =>
      parseDesktopNotificationInput({
        title: "Activity notification",
        body: "Notification test for chats and terminal agents.",
        silent: false,
        threadId: "",
      }),
    ).toThrow();
  });
});
