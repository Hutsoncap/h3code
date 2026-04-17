import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThreadId } from "@t3tools/contracts";

const {
  fromPartition,
  BrowserWindow,
  WebContentsView,
  createdViews,
  openExternal,
  resetElectronMocks,
} = vi.hoisted(() => {
  const createdViews: MockWebContentsView[] = [];
  const openExternal = vi.fn();

  class MockWebContents {
    currentUrl = "";
    title = "";
    loading = false;
    destroyed = false;
    canGoBackValue = false;
    canGoForwardValue = false;
    readonly loadURL = vi.fn(async (url: string) => {
      this.currentUrl = url;
      this.title = new URL(url).hostname || url;
      this.loading = false;
    });
    readonly reload = vi.fn();
    readonly goBack = vi.fn();
    readonly goForward = vi.fn();
    readonly openDevTools = vi.fn();
    readonly close = vi.fn(() => {
      this.destroyed = true;
    });
    readonly setWindowOpenHandler = vi.fn();
    readonly getURL = vi.fn(() => this.currentUrl);
    readonly getTitle = vi.fn(() => this.title);
    readonly isLoading = vi.fn(() => this.loading);
    readonly canGoBack = vi.fn(() => this.canGoBackValue);
    readonly canGoForward = vi.fn(() => this.canGoForwardValue);
    readonly isDestroyed = vi.fn(() => this.destroyed);
    readonly on = vi.fn();
  }

  class MockWebContentsView {
    readonly webContents = new MockWebContents();
    readonly setBounds = vi.fn();

    constructor(_options?: unknown) {
      createdViews.push(this);
    }
  }

  class MockBrowserWindow {
    readonly contentView = {
      addChildView: vi.fn(),
      removeChildView: vi.fn(),
    };
  }

  return {
    fromPartition: vi.fn(),
    BrowserWindow: MockBrowserWindow,
    WebContentsView: MockWebContentsView,
    createdViews,
    openExternal,
    resetElectronMocks: () => {
      createdViews.splice(0, createdViews.length);
      openExternal.mockReset();
    },
  };
});

vi.mock("electron", () => {
  return {
    BrowserWindow,
    WebContentsView,
    shell: {
      openExternal,
    },
    session: {
      fromPartition,
    },
  };
});

import { DesktopBrowserManager, migrateLegacyBrowserSessionPartition } from "./browserManager";

type CookieLike = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "unspecified" | "no_restriction" | "lax" | "strict";
  session?: boolean;
  expirationDate?: number;
};

function createSession(cookiesToRead: readonly CookieLike[]) {
  return {
    cookies: {
      get: vi.fn(async () => cookiesToRead),
      set: vi.fn(async () => undefined),
    },
    flushStorageData: vi.fn(async () => undefined),
  };
}

const THREAD_A = ThreadId.makeUnsafe("thread-a");
const THREAD_B = ThreadId.makeUnsafe("thread-b");
const PANEL_BOUNDS = { x: 10, y: 20, width: 800, height: 600 };
type ManagerWindow = NonNullable<Parameters<DesktopBrowserManager["setWindow"]>[0]>;

type TimerHandle = { unref: ReturnType<typeof vi.fn> };

function createTimerHarness() {
  const pending = new Map<TimerHandle, () => void>();
  const scheduled: Array<{ handle: TimerHandle; delay: number }> = [];
  const cleared: TimerHandle[] = [];
  const setTimeoutSpy = vi
    .spyOn(globalThis, "setTimeout")
    .mockImplementation((callback: TimerHandler, delay?: number) => {
      const handle = { unref: vi.fn() };
      pending.set(handle, () => {
        if (typeof callback === "function") {
          callback();
        }
      });
      scheduled.push({ handle, delay: Number(delay ?? 0) });
      return handle as unknown as ReturnType<typeof setTimeout>;
    });
  const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout").mockImplementation((handle) => {
    const timerHandle = handle as unknown as TimerHandle;
    pending.delete(timerHandle);
    cleared.push(timerHandle);
  });

  return {
    scheduled,
    cleared,
    pendingCount: () => pending.size,
    latestHandle: () => scheduled.at(-1)?.handle ?? null,
    run: (handle: TimerHandle) => {
      const callback = pending.get(handle);
      pending.delete(handle);
      callback?.();
    },
    restore: () => {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    },
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("migrateLegacyBrowserSessionPartition", () => {
  beforeEach(() => {
    fromPartition.mockReset();
    resetElectronMocks();
  });

  it("copies legacy cookies into the h3code partition when the new partition is empty", async () => {
    const nextSession = createSession([]);
    const legacySession = createSession([
      {
        name: "sid",
        value: "abc123",
        domain: ".example.com",
        path: "/account",
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        session: false,
        expirationDate: 1_734_441_600,
      },
    ]);

    fromPartition.mockImplementation((partition: string) => {
      if (partition === "persist:h3code-browser") {
        return nextSession;
      }
      if (partition === "persist:t3code-browser") {
        return legacySession;
      }
      throw new Error(`unexpected partition ${partition}`);
    });

    await migrateLegacyBrowserSessionPartition();

    expect(nextSession.cookies.set).toHaveBeenCalledWith({
      url: "https://example.com/account",
      name: "sid",
      value: "abc123",
      domain: ".example.com",
      path: "/account",
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      expirationDate: 1_734_441_600,
    });
    expect(nextSession.flushStorageData).toHaveBeenCalledTimes(1);
  });

  it("leaves the legacy partition alone when the h3code partition already has cookies", async () => {
    const nextSession = createSession([
      {
        name: "sid",
        value: "current",
        domain: ".example.com",
      },
    ]);
    const legacySession = createSession([
      {
        name: "sid",
        value: "legacy",
        domain: ".example.com",
      },
    ]);

    fromPartition.mockImplementation((partition: string) => {
      if (partition === "persist:h3code-browser") {
        return nextSession;
      }
      if (partition === "persist:t3code-browser") {
        return legacySession;
      }
      throw new Error(`unexpected partition ${partition}`);
    });

    await migrateLegacyBrowserSessionPartition();

    expect(nextSession.cookies.set).not.toHaveBeenCalled();
    expect(nextSession.flushStorageData).not.toHaveBeenCalled();
  });
});

describe("DesktopBrowserManager suspension behavior", () => {
  beforeEach(() => {
    resetElectronMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("schedules hidden-panel suspension and tears down the live runtime after the delay", async () => {
    const timers = createTimerHarness();
    try {
      const manager = new DesktopBrowserManager();
      const window = new BrowserWindow() as unknown as ManagerWindow;

      manager.setWindow(window);
      const opened = manager.open({
        threadId: THREAD_A,
        initialUrl: "https://example.com/docs",
      });
      manager.setPanelBounds({ threadId: THREAD_A, bounds: PANEL_BOUNDS });
      await flushMicrotasks();

      const liveView = createdViews[0];
      expect(liveView).toBeDefined();
      if (!liveView) {
        throw new Error("Expected a live browser view to be created");
      }
      expect(window.contentView.addChildView).toHaveBeenCalledWith(liveView);
      expect(opened.tabs).toHaveLength(1);

      manager.setPanelBounds({ threadId: THREAD_A, bounds: null });

      const scheduledTimer = timers.latestHandle();
      expect(scheduledTimer).not.toBeNull();
      expect(timers.scheduled.at(-1)?.delay).toBe(30_000);
      expect(scheduledTimer?.unref).toHaveBeenCalledTimes(1);
      expect(window.contentView.removeChildView).toHaveBeenCalledWith(liveView);

      timers.run(scheduledTimer!);

      const nextState = manager.getState({ threadId: THREAD_A });
      expect(nextState.open).toBe(true);
      expect(nextState.tabs[0]?.status).toBe("suspended");
      expect(liveView.webContents.close).toHaveBeenCalledWith({ waitForBeforeUnload: false });
    } finally {
      timers.restore();
    }
  });

  it("cancels a pending suspend when a handed-off thread becomes active again", async () => {
    const timers = createTimerHarness();
    try {
      const manager = new DesktopBrowserManager();
      const window = new BrowserWindow() as unknown as ManagerWindow;

      manager.setWindow(window);
      manager.open({ threadId: THREAD_A, initialUrl: "https://example.com/a" });
      manager.setPanelBounds({ threadId: THREAD_A, bounds: PANEL_BOUNDS });
      await flushMicrotasks();

      manager.open({ threadId: THREAD_B, initialUrl: "https://example.com/b" });
      manager.setPanelBounds({ threadId: THREAD_B, bounds: PANEL_BOUNDS });
      await flushMicrotasks();

      const threadATimer = timers.latestHandle();
      const threadAView = createdViews[0];
      const threadBView = createdViews[1];

      expect(threadATimer).not.toBeNull();
      expect(threadAView).toBeDefined();
      expect(threadBView).toBeDefined();
      if (!threadAView || !threadBView) {
        throw new Error("Expected both thread runtimes to be created");
      }
      expect(timers.pendingCount()).toBe(1);

      manager.setPanelBounds({ threadId: THREAD_A, bounds: PANEL_BOUNDS });
      await flushMicrotasks();

      expect(timers.cleared).toContain(threadATimer);
      expect(timers.pendingCount()).toBe(1);

      const threadBTimer = timers.latestHandle();
      expect(threadBTimer).not.toBe(threadATimer);

      timers.run(threadBTimer!);

      expect(threadAView?.webContents.close).not.toHaveBeenCalled();
      expect(threadBView?.webContents.close).toHaveBeenCalledWith({
        waitForBeforeUnload: false,
      });
      expect(manager.getState({ threadId: THREAD_A }).tabs[0]?.status).toBe("live");
      expect(manager.getState({ threadId: THREAD_B }).tabs[0]?.status).toBe("suspended");
    } finally {
      timers.restore();
    }
  });

  it("disposes live runtimes and clears pending suspend timers", async () => {
    const timers = createTimerHarness();
    try {
      const manager = new DesktopBrowserManager();
      const window = new BrowserWindow() as unknown as ManagerWindow;

      manager.setWindow(window);
      manager.open({ threadId: THREAD_A, initialUrl: "https://example.com/a" });
      manager.setPanelBounds({ threadId: THREAD_A, bounds: PANEL_BOUNDS });
      await flushMicrotasks();

      const liveView = createdViews[0];
      expect(liveView).toBeDefined();
      if (!liveView) {
        throw new Error("Expected a live browser view to be created");
      }
      manager.hide({ threadId: THREAD_A });
      const scheduledTimer = timers.latestHandle();

      manager.dispose();

      expect(timers.cleared).toContain(scheduledTimer);
      expect(liveView?.webContents.close).toHaveBeenCalledWith({
        waitForBeforeUnload: false,
      });
      expect(window.contentView.removeChildView).toHaveBeenCalledWith(liveView);

      timers.run(scheduledTimer!);

      expect(liveView?.webContents.close).toHaveBeenCalledTimes(1);
      expect(manager.getState({ threadId: THREAD_A }).tabs).toEqual([]);
    } finally {
      timers.restore();
    }
  });
});
