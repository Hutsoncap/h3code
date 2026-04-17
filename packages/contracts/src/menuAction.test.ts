import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { DesktopMenuAction } from "./menuAction";

const decodeDesktopMenuAction = Schema.decodeUnknownSync(DesktopMenuAction);

describe("DesktopMenuAction", () => {
  it("accepts the known static menu actions", () => {
    expect(decodeDesktopMenuAction("toggle-sidebar")).toBe("toggle-sidebar");
    expect(decodeDesktopMenuAction("open-settings")).toBe("open-settings");
    expect(decodeDesktopMenuAction("toggle-browser")).toBe("toggle-browser");
    expect(decodeDesktopMenuAction("new-terminal-tab")).toBe("new-terminal-tab");
  });

  it("accepts notification thread open actions with a thread id suffix", () => {
    expect(decodeDesktopMenuAction("notification-open-thread:thread-123")).toBe(
      "notification-open-thread:thread-123",
    );
  });

  it("rejects malformed actions", () => {
    expect(() => decodeDesktopMenuAction("notification-open-thread:")).toThrow();
    expect(() => decodeDesktopMenuAction("open-settings:extra")).toThrow();
    expect(() => decodeDesktopMenuAction("not-a-real-action")).toThrow();
  });
});
