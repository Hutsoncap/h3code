import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  BrowserNavigateInputSchema,
  ContextMenuRequestSchema,
  DesktopNotificationInputSchema,
  ThreadBrowserStateSchema,
} from "./ipc";

const decodeContextMenuRequest = Schema.decodeUnknownSync(ContextMenuRequestSchema);
const decodeBrowserNavigateInput = Schema.decodeUnknownSync(BrowserNavigateInputSchema);
const decodeDesktopNotificationInput = Schema.decodeUnknownSync(DesktopNotificationInputSchema);
const decodeThreadBrowserState = Schema.decodeUnknownSync(ThreadBrowserStateSchema);

describe("ContextMenuRequestSchema", () => {
  it("parses item arrays and optional positions", () => {
    const parsed = decodeContextMenuRequest({
      items: [
        { id: "rename", label: "Rename" },
        { id: "delete", label: "Delete", destructive: true },
      ],
      position: { x: 10.5, y: 20 },
    });

    expect(parsed.items).toHaveLength(2);
    expect(parsed.position).toEqual({ x: 10.5, y: 20 });
  });
});

describe("BrowserNavigateInputSchema", () => {
  it("parses browser navigation payloads", () => {
    const parsed = decodeBrowserNavigateInput({
      threadId: " thread-1 ",
      tabId: "tab-1",
      url: "https://example.com",
    });

    expect(parsed.threadId).toBe("thread-1");
    expect(parsed.tabId).toBe("tab-1");
    expect(parsed.url).toBe("https://example.com");
  });

  it("rejects payloads without a URL", () => {
    expect(() =>
      decodeBrowserNavigateInput({
        threadId: "thread-1",
      }),
    ).toThrow();
  });
});

describe("DesktopNotificationInputSchema", () => {
  it("rejects notifications with invalid thread ids", () => {
    expect(() =>
      decodeDesktopNotificationInput({
        title: "Build complete",
        threadId: 42,
      }),
    ).toThrow();
  });
});

describe("ThreadBrowserStateSchema", () => {
  it("parses browser state snapshots", () => {
    const parsed = decodeThreadBrowserState({
      threadId: "thread-1",
      open: true,
      activeTabId: "tab-1",
      tabs: [
        {
          id: "tab-1",
          url: "https://example.com",
          title: "Example",
          status: "live",
          isLoading: false,
          canGoBack: false,
          canGoForward: false,
          faviconUrl: null,
          lastCommittedUrl: "https://example.com",
          lastError: null,
        },
      ],
      lastError: null,
    });

    expect(parsed.threadId).toBe("thread-1");
    expect(parsed.tabs[0]?.status).toBe("live");
  });
});
