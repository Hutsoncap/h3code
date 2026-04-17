import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  BrowserOpenInputSchema,
  BrowserNavigateInputSchema,
  BrowserSetPanelBoundsInputSchema,
  BrowserTabInputSchema,
  BrowserThreadInputSchema,
  ContextMenuRequestSchema,
  ContextMenuPositionSchema,
  DesktopUpdateActionResultSchema,
  DesktopUpdateStateSchema,
  DesktopNotificationInputSchema,
  DesktopNotificationShowResultSchema,
  DesktopServerTranscribeVoiceInputSchema,
  ThreadBrowserStateSchema,
} from "./ipc";

const decodeBrowserOpenInput = Schema.decodeUnknownSync(BrowserOpenInputSchema);
const decodeContextMenuRequest = Schema.decodeUnknownSync(ContextMenuRequestSchema);
const decodeContextMenuPosition = Schema.decodeUnknownSync(ContextMenuPositionSchema);
const decodeBrowserNavigateInput = Schema.decodeUnknownSync(BrowserNavigateInputSchema);
const decodeBrowserSetPanelBoundsInput = Schema.decodeUnknownSync(BrowserSetPanelBoundsInputSchema);
const decodeBrowserThreadInput = Schema.decodeUnknownSync(BrowserThreadInputSchema);
const decodeBrowserTabInput = Schema.decodeUnknownSync(BrowserTabInputSchema);
const decodeDesktopServerTranscribeVoiceInput = Schema.decodeUnknownSync(
  DesktopServerTranscribeVoiceInputSchema,
);
const decodeDesktopUpdateState = Schema.decodeUnknownSync(DesktopUpdateStateSchema);
const decodeDesktopUpdateActionResult = Schema.decodeUnknownSync(DesktopUpdateActionResultSchema);
const decodeDesktopNotificationInput = Schema.decodeUnknownSync(DesktopNotificationInputSchema);
const decodeDesktopNotificationShowResult = Schema.decodeUnknownSync(
  DesktopNotificationShowResultSchema,
);
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

describe("BrowserSetPanelBoundsInputSchema", () => {
  it("parses nullable panel bounds payloads", () => {
    const parsed = decodeBrowserSetPanelBoundsInput({
      threadId: " thread-1 ",
      bounds: {
        x: 24,
        y: 48,
        width: 1280,
        height: 720,
      },
    });

    expect(parsed.threadId).toBe("thread-1");
    expect(parsed.bounds).toEqual({
      x: 24,
      y: 48,
      width: 1280,
      height: 720,
    });

    const parsedWithoutBounds = decodeBrowserSetPanelBoundsInput({
      threadId: "thread-1",
      bounds: null,
    });

    expect(parsedWithoutBounds.bounds).toBeNull();
  });

  it("rejects malformed panel bounds", () => {
    expect(() =>
      decodeBrowserSetPanelBoundsInput({
        threadId: "thread-1",
        bounds: {
          x: 24,
          y: 48,
          width: "1280",
          height: 720,
        },
      }),
    ).toThrow();
  });
});

describe("BrowserOpenInputSchema", () => {
  it("parses browser open payloads with optional initial urls", () => {
    const parsed = decodeBrowserOpenInput({
      threadId: " thread-1 ",
      initialUrl: "https://example.com",
    });

    expect(parsed.threadId).toBe("thread-1");
    expect(parsed.initialUrl).toBe("https://example.com");
  });

  it("parses browser open payloads without an initial url", () => {
    const parsed = decodeBrowserOpenInput({
      threadId: "thread-1",
    });

    expect(parsed.threadId).toBe("thread-1");
    expect(parsed.initialUrl).toBeUndefined();
  });
});

describe("BrowserThreadInputSchema", () => {
  it("parses thread-scoped browser payloads", () => {
    const parsed = decodeBrowserThreadInput({
      threadId: " thread-1 ",
    });

    expect(parsed.threadId).toBe("thread-1");
  });
});

describe("BrowserTabInputSchema", () => {
  it("parses browser tab payloads", () => {
    const parsed = decodeBrowserTabInput({
      threadId: " thread-1 ",
      tabId: " tab-1 ",
    });

    expect(parsed.threadId).toBe("thread-1");
    expect(parsed.tabId).toBe(" tab-1 ");
  });
});

describe("ContextMenuPositionSchema", () => {
  it("parses pointer coordinates", () => {
    const parsed = decodeContextMenuPosition({
      x: 10.5,
      y: 20,
    });

    expect(parsed).toEqual({ x: 10.5, y: 20 });
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

describe("DesktopUpdateStateSchema", () => {
  it("parses desktop update snapshots", () => {
    const parsed = decodeDesktopUpdateState({
      enabled: true,
      status: "downloading",
      currentVersion: "1.2.3",
      hostArch: "arm64",
      appArch: "x64",
      runningUnderArm64Translation: true,
      availableVersion: "1.2.4",
      downloadedVersion: null,
      downloadPercent: 42,
      checkedAt: "2026-04-17T12:34:56.000Z",
      message: "Downloading update",
      errorContext: null,
      canRetry: false,
    });

    expect(parsed.status).toBe("downloading");
    expect(parsed.availableVersion).toBe("1.2.4");
    expect(parsed.downloadPercent).toBe(42);
  });

  it("rejects invalid status literals", () => {
    expect(() =>
      decodeDesktopUpdateState({
        enabled: true,
        status: "installing",
        currentVersion: "1.2.3",
        hostArch: "arm64",
        appArch: "arm64",
        runningUnderArm64Translation: false,
        availableVersion: null,
        downloadedVersion: null,
        downloadPercent: null,
        checkedAt: null,
        message: null,
        errorContext: null,
        canRetry: true,
      }),
    ).toThrow();
  });
});

describe("DesktopUpdateActionResultSchema", () => {
  it("parses nested desktop update action results", () => {
    const parsed = decodeDesktopUpdateActionResult({
      accepted: true,
      completed: false,
      state: {
        enabled: true,
        status: "downloaded",
        currentVersion: "1.2.3",
        hostArch: "arm64",
        appArch: "arm64",
        runningUnderArm64Translation: false,
        availableVersion: "1.2.4",
        downloadedVersion: "1.2.4",
        downloadPercent: 100,
        checkedAt: "2026-04-17T12:34:56.000Z",
        message: "Ready to install",
        errorContext: null,
        canRetry: false,
      },
    });

    expect(parsed.accepted).toBe(true);
    expect(parsed.completed).toBe(false);
    expect(parsed.state.status).toBe("downloaded");
  });

  it("rejects malformed nested state", () => {
    expect(() =>
      decodeDesktopUpdateActionResult({
        accepted: true,
        completed: false,
        state: {
          enabled: true,
          status: "error",
          currentVersion: "1.2.3",
          hostArch: "arm64",
          appArch: "arm64",
          runningUnderArm64Translation: false,
          availableVersion: "1.2.4",
          downloadedVersion: null,
          downloadPercent: "100",
          checkedAt: "2026-04-17T12:34:56.000Z",
          message: "Install failed",
          errorContext: "install",
          canRetry: true,
        },
      }),
    ).toThrow();
  });
});

describe("DesktopNotificationShowResultSchema", () => {
  it("parses boolean results from the desktop notification bridge", () => {
    expect(decodeDesktopNotificationShowResult(true)).toBe(true);
    expect(decodeDesktopNotificationShowResult(false)).toBe(false);
  });

  it("rejects non-boolean results", () => {
    expect(() => decodeDesktopNotificationShowResult("shown")).toThrow();
  });
});

describe("DesktopServerTranscribeVoiceInputSchema", () => {
  it("parses desktop voice transcription payloads", () => {
    const parsed = decodeDesktopServerTranscribeVoiceInput({
      provider: "codex",
      cwd: " /tmp/workspace ",
      threadId: " thread-1 ",
      mimeType: " audio/wav ",
      sampleRateHz: 24_000,
      durationMs: 1_000,
      audioBase64: " UklGRigAAABXQVZF ",
    });

    expect(parsed.cwd).toBe("/tmp/workspace");
    expect(parsed.threadId).toBe("thread-1");
    expect(parsed.mimeType).toBe("audio/wav");
    expect(parsed.audioBase64).toBe("UklGRigAAABXQVZF");
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
