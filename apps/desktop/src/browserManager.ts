import * as Crypto from "node:crypto";

import { BrowserWindow, session, shell, WebContentsView } from "electron";
import type {
  BrowserSurfaceId,
  BrowserSurfaceState,
  BrowserNavigateInput,
  BrowserNewTabInput,
  BrowserOpenInput,
  BrowserPanelBounds,
  BrowserSetPanelBoundsInput,
  BrowserTabInput,
  BrowserTabState,
  BrowserThreadInput,
} from "@t3tools/contracts";
import {
  browserSurfaceKey,
  resolveBrowserSurfaceId,
  sameBrowserSurfaceId,
} from "@t3tools/shared/browserSurface";

const ABOUT_BLANK_URL = "about:blank";
const BROWSER_SESSION_PARTITION = "persist:h3code-browser";
const LEGACY_BROWSER_SESSION_PARTITION = "persist:t3code-browser";
const BROWSER_THREAD_SUSPEND_DELAY_MS = 30_000;
const BROWSER_ERROR_ABORTED = -3;
const SEARCH_URL_PREFIX = "https://www.google.com/search?q=";

type BrowserStateListener = (state: BrowserSurfaceState) => void;

interface LiveTabRuntime {
  key: string;
  surfaceId: BrowserSurfaceId;
  tabId: string;
  view: WebContentsView;
}

function createBrowserTab(url = ABOUT_BLANK_URL): BrowserTabState {
  return {
    id: Crypto.randomUUID(),
    url,
    title: defaultTitleForUrl(url),
    status: "suspended",
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    faviconUrl: null,
    lastCommittedUrl: null,
    lastError: null,
  };
}

function defaultBrowserSurfaceState(surfaceId: BrowserSurfaceId): BrowserSurfaceState {
  return {
    surfaceId,
    open: false,
    activeTabId: null,
    tabs: [],
    lastError: null,
  };
}

function cloneBrowserState(state: BrowserSurfaceState): BrowserSurfaceState {
  return {
    ...state,
    tabs: state.tabs.map((tab) => ({ ...tab })),
  };
}

function defaultTitleForUrl(url: string): string {
  if (url === ABOUT_BLANK_URL) {
    return "New tab";
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname || url;
  } catch {
    return url;
  }
}

function normalizeBounds(bounds: BrowserPanelBounds | null): BrowserPanelBounds | null {
  if (!bounds) return null;
  if (
    !Number.isFinite(bounds.x) ||
    !Number.isFinite(bounds.y) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height)
  ) {
    return null;
  }

  const width = Math.max(0, Math.floor(bounds.width));
  const height = Math.max(0, Math.floor(bounds.height));
  if (width === 0 || height === 0) {
    return null;
  }

  return {
    x: Math.max(0, Math.floor(bounds.x)),
    y: Math.max(0, Math.floor(bounds.y)),
    width,
    height,
  };
}

function looksLikeUrlInput(value: string): boolean {
  return (
    value.includes(".") ||
    value.startsWith("localhost") ||
    value.startsWith("127.0.0.1") ||
    value.startsWith("0.0.0.0") ||
    value.startsWith("[::1]")
  );
}

function normalizeUrlInput(input: string | undefined): string {
  const trimmed = input?.trim() ?? "";
  if (trimmed.length === 0) {
    return ABOUT_BLANK_URL;
  }

  try {
    const withScheme = new URL(trimmed);
    if (withScheme.protocol === "http:" || withScheme.protocol === "https:") {
      return withScheme.toString();
    }
    if (withScheme.protocol === "about:") {
      return withScheme.toString();
    }
  } catch {
    // Fall through to heuristics below.
  }

  if (trimmed.includes(" ")) {
    return `${SEARCH_URL_PREFIX}${encodeURIComponent(trimmed)}`;
  }

  if (looksLikeUrlInput(trimmed)) {
    const prefersHttp =
      trimmed.startsWith("localhost") ||
      trimmed.startsWith("127.0.0.1") ||
      trimmed.startsWith("0.0.0.0") ||
      trimmed.startsWith("[::1]");
    const scheme = prefersHttp ? "http" : "https";
    try {
      return new URL(`${scheme}://${trimmed}`).toString();
    } catch {
      return `${SEARCH_URL_PREFIX}${encodeURIComponent(trimmed)}`;
    }
  }

  return `${SEARCH_URL_PREFIX}${encodeURIComponent(trimmed)}`;
}

function isAbortedNavigationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /ERR_ABORTED|\(-3\)/i.test(error.message);
}

function mapBrowserLoadError(errorCode: number): string {
  switch (errorCode) {
    case -102:
      return "Connection refused.";
    case -105:
      return "Couldn't resolve this address.";
    case -106:
      return "You're offline.";
    case -118:
      return "This page took too long to respond.";
    case -137:
      return "A secure connection couldn't be established.";
    case -200:
      return "A secure connection couldn't be established.";
    default:
      return "Couldn't open this page.";
  }
}

function buildRuntimeKey(surfaceId: BrowserSurfaceId, tabId: string): string {
  return `${browserSurfaceKey(surfaceId)}:${tabId}`;
}

function resolveSurfaceIdOrThrow(input: {
  surfaceId?: BrowserSurfaceId | null | undefined;
  threadId?: string | null | undefined;
}): BrowserSurfaceId {
  const surfaceId = resolveBrowserSurfaceId(input as never);
  if (!surfaceId) {
    throw new Error("Browser surfaceId is required.");
  }
  return surfaceId;
}

function resolveCookieUrl(cookie: Electron.Cookie): string | null {
  const normalizedDomain = cookie.domain?.replace(/^\./, "").trim() ?? "";
  if (normalizedDomain.length === 0) {
    return null;
  }

  const normalizedPath = cookie.path?.trim() || "/";
  const path = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
  const protocol = cookie.secure === true ? "https" : "http";
  return `${protocol}://${normalizedDomain}${path}`;
}

export async function migrateLegacyBrowserSessionPartition(): Promise<void> {
  const nextSession = session.fromPartition(BROWSER_SESSION_PARTITION);
  const legacySession = session.fromPartition(LEGACY_BROWSER_SESSION_PARTITION);
  const [nextCookies, legacyCookies] = await Promise.all([
    nextSession.cookies.get({}),
    legacySession.cookies.get({}),
  ]);

  if (nextCookies.length > 0 || legacyCookies.length === 0) {
    return;
  }

  for (const legacyCookie of legacyCookies) {
    const url = resolveCookieUrl(legacyCookie);
    if (!url) {
      continue;
    }

    try {
      const cookieDetails: Electron.CookiesSetDetails = {
        url,
        name: legacyCookie.name,
        value: legacyCookie.value,
        ...(legacyCookie.domain ? { domain: legacyCookie.domain } : {}),
        ...(legacyCookie.path ? { path: legacyCookie.path } : {}),
        ...(typeof legacyCookie.secure === "boolean" ? { secure: legacyCookie.secure } : {}),
        ...(typeof legacyCookie.httpOnly === "boolean" ? { httpOnly: legacyCookie.httpOnly } : {}),
        ...(legacyCookie.sameSite ? { sameSite: legacyCookie.sameSite } : {}),
        ...(!legacyCookie.session && typeof legacyCookie.expirationDate === "number"
          ? { expirationDate: legacyCookie.expirationDate }
          : {}),
      };
      await nextSession.cookies.set(cookieDetails);
    } catch {
      // Ignore individual cookie failures so one malformed legacy cookie does
      // not block the rest of the browser-session migration.
    }
  }

  await nextSession.flushStorageData();
}

export class DesktopBrowserManager {
  private window: BrowserWindow | null = null;
  private activeSurfaceId: BrowserSurfaceId | null = null;
  private activeBounds: BrowserPanelBounds | null = null;
  private attachedRuntimeKey: string | null = null;
  private readonly states = new Map<string, BrowserSurfaceState>();
  private readonly runtimes = new Map<string, LiveTabRuntime>();
  private readonly listeners = new Set<BrowserStateListener>();
  private readonly suspendTimers = new Map<string, ReturnType<typeof setTimeout>>();

  setWindow(window: BrowserWindow | null): void {
    this.window = window;
    if (window) {
      if (this.activeSurfaceId && this.activeBounds) {
        this.attachActiveTab(this.activeSurfaceId, this.activeBounds);
      }
      return;
    }

    this.detachAttachedRuntime();
    this.destroyAllRuntimes();
  }

  subscribe(listener: BrowserStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    for (const timer of this.suspendTimers.values()) {
      clearTimeout(timer);
    }
    this.suspendTimers.clear();
    this.detachAttachedRuntime();
    this.destroyAllRuntimes();
    this.listeners.clear();
    this.states.clear();
    this.window = null;
    this.activeSurfaceId = null;
    this.activeBounds = null;
  }

  open(input: BrowserOpenInput): BrowserSurfaceState {
    const surfaceId = resolveSurfaceIdOrThrow(input);
    const state = this.ensureWorkspace(surfaceId, input.initialUrl);
    state.open = true;
    syncThreadLastError(state);

    if (
      this.activeBounds &&
      (this.activeSurfaceId === null || sameBrowserSurfaceId(this.activeSurfaceId, surfaceId))
    ) {
      this.activateThread(surfaceId, this.activeBounds);
    }

    this.emitState(surfaceId);
    return cloneBrowserState(state);
  }

  close(input: BrowserThreadInput): BrowserSurfaceState {
    const surfaceId = resolveSurfaceIdOrThrow(input);
    const surfaceKey = browserSurfaceKey(surfaceId);
    this.clearSuspendTimer(surfaceId);

    if (this.activeSurfaceId && sameBrowserSurfaceId(this.activeSurfaceId, surfaceId)) {
      this.detachAttachedRuntime();
      this.activeSurfaceId = null;
    }

    this.destroyThreadRuntimes(surfaceId);

    const state = this.getOrCreateState(surfaceId);
    state.open = false;
    state.activeTabId = null;
    state.tabs = [];
    state.lastError = null;
    this.states.set(surfaceKey, state);
    this.emitState(surfaceId);
    return cloneBrowserState(state);
  }

  hide(input: BrowserThreadInput): void {
    const surfaceId = resolveSurfaceIdOrThrow(input);
    const state = this.states.get(browserSurfaceKey(surfaceId));
    if (!state?.open) {
      return;
    }

    if (this.activeSurfaceId && sameBrowserSurfaceId(this.activeSurfaceId, surfaceId)) {
      this.detachAttachedRuntime();
      this.activeSurfaceId = null;
    }

    this.scheduleThreadSuspend(surfaceId);
  }

  getState(input: BrowserThreadInput): BrowserSurfaceState {
    const surfaceId = resolveSurfaceIdOrThrow(input);
    return cloneBrowserState(this.getOrCreateState(surfaceId));
  }

  setPanelBounds(input: BrowserSetPanelBoundsInput): BrowserSurfaceState {
    const surfaceId = resolveSurfaceIdOrThrow(input);
    const state = this.getOrCreateState(surfaceId);
    const nextBounds = normalizeBounds(input.bounds);
    this.activeBounds = nextBounds;

    if (!state.open || nextBounds === null) {
      if (this.activeSurfaceId && sameBrowserSurfaceId(this.activeSurfaceId, surfaceId)) {
        this.detachAttachedRuntime();
        this.activeSurfaceId = null;
        this.scheduleThreadSuspend(surfaceId);
      }
      return cloneBrowserState(state);
    }

    this.activateThread(surfaceId, nextBounds);
    return cloneBrowserState(state);
  }

  navigate(input: BrowserNavigateInput): BrowserSurfaceState {
    const surfaceId = resolveSurfaceIdOrThrow(input);
    const state = this.ensureWorkspace(surfaceId);
    const tab = this.resolveTab(state, input.tabId);
    const nextUrl = normalizeUrlInput(input.url);
    tab.url = nextUrl;
    tab.title = defaultTitleForUrl(nextUrl);
    tab.lastCommittedUrl = null;
    tab.lastError = null;
    syncThreadLastError(state);

    if (this.activeSurfaceId && sameBrowserSurfaceId(this.activeSurfaceId, surfaceId)) {
      // Load the target tab directly so we don't clobber its pending URL with a
      // thread-wide runtime sync from the old live page state.
      const runtime = this.ensureLiveRuntime(surfaceId, tab.id);
      this.clearSuspendTimer(surfaceId);
      if (state.activeTabId === tab.id && this.activeBounds) {
        this.attachRuntime(runtime, this.activeBounds);
      }
      void this.loadTab(surfaceId, tab.id, { force: true, runtime });
    }

    this.emitState(surfaceId);
    return cloneBrowserState(state);
  }

  reload(input: BrowserTabInput): BrowserSurfaceState {
    const surfaceId = resolveSurfaceIdOrThrow(input);
    const state = this.ensureWorkspace(surfaceId);
    const tab = this.resolveTab(state, input.tabId);
    const runtime = this.runtimes.get(buildRuntimeKey(surfaceId, tab.id));
    if (runtime) {
      runtime.view.webContents.reload();
    } else if (this.activeSurfaceId && sameBrowserSurfaceId(this.activeSurfaceId, surfaceId)) {
      this.resumeThread(surfaceId);
      void this.loadTab(surfaceId, tab.id, { force: true });
    }
    return cloneBrowserState(state);
  }

  goBack(input: BrowserTabInput): BrowserSurfaceState {
    const surfaceId = resolveSurfaceIdOrThrow(input);
    const runtime = this.runtimes.get(buildRuntimeKey(surfaceId, input.tabId));
    if (runtime && runtime.view.webContents.canGoBack()) {
      runtime.view.webContents.goBack();
    }
    return this.getState({ surfaceId });
  }

  goForward(input: BrowserTabInput): BrowserSurfaceState {
    const surfaceId = resolveSurfaceIdOrThrow(input);
    const runtime = this.runtimes.get(buildRuntimeKey(surfaceId, input.tabId));
    if (runtime && runtime.view.webContents.canGoForward()) {
      runtime.view.webContents.goForward();
    }
    return this.getState({ surfaceId });
  }

  newTab(input: BrowserNewTabInput): BrowserSurfaceState {
    const surfaceId = resolveSurfaceIdOrThrow(input);
    const state = this.ensureWorkspace(surfaceId);
    const tab = createBrowserTab(normalizeUrlInput(input.url));
    state.tabs = [...state.tabs, tab];
    if (input.activate !== false || !state.activeTabId) {
      state.activeTabId = tab.id;
    }

    if (this.activeSurfaceId && sameBrowserSurfaceId(this.activeSurfaceId, surfaceId)) {
      this.resumeThread(surfaceId);
      if (state.activeTabId === tab.id && this.activeBounds) {
        this.ensureLiveRuntime(surfaceId, tab.id);
        void this.loadTab(surfaceId, tab.id, { force: true });
        this.attachActiveTab(surfaceId, this.activeBounds);
      }
    } else {
      tab.status = "suspended";
    }

    syncThreadLastError(state);
    this.emitState(surfaceId);
    return cloneBrowserState(state);
  }

  closeTab(input: BrowserTabInput): BrowserSurfaceState {
    const surfaceId = resolveSurfaceIdOrThrow(input);
    const state = this.ensureWorkspace(surfaceId);
    const nextTabs = state.tabs.filter((tab) => tab.id !== input.tabId);
    if (nextTabs.length === state.tabs.length) {
      return cloneBrowserState(state);
    }

    this.destroyRuntime(surfaceId, input.tabId);
    state.tabs = nextTabs;

    if (nextTabs.length === 0) {
      state.open = false;
      state.activeTabId = null;
      state.lastError = null;
      if (this.activeSurfaceId && sameBrowserSurfaceId(this.activeSurfaceId, surfaceId)) {
        this.detachAttachedRuntime();
        this.activeSurfaceId = null;
      }
      this.emitState(surfaceId);
      return cloneBrowserState(state);
    }

    if (!state.activeTabId || state.activeTabId === input.tabId) {
      state.activeTabId = nextTabs[Math.max(0, nextTabs.length - 1)]?.id ?? null;
    }

    if (
      this.activeSurfaceId &&
      sameBrowserSurfaceId(this.activeSurfaceId, surfaceId) &&
      this.activeBounds
    ) {
      this.attachActiveTab(surfaceId, this.activeBounds);
    }

    syncThreadLastError(state);
    this.emitState(surfaceId);
    return cloneBrowserState(state);
  }

  selectTab(input: BrowserTabInput): BrowserSurfaceState {
    const surfaceId = resolveSurfaceIdOrThrow(input);
    const state = this.ensureWorkspace(surfaceId);
    const tab = this.resolveTab(state, input.tabId);
    if (state.activeTabId !== tab.id) {
      state.activeTabId = tab.id;
      syncThreadLastError(state);
      this.emitState(surfaceId);
    }

    if (this.activeSurfaceId && sameBrowserSurfaceId(this.activeSurfaceId, surfaceId)) {
      this.resumeThread(surfaceId);
      if (this.activeBounds) {
        this.attachActiveTab(surfaceId, this.activeBounds);
      }
    }

    return cloneBrowserState(state);
  }

  openDevTools(input: BrowserTabInput): void {
    const surfaceId = resolveSurfaceIdOrThrow(input);
    const state = this.ensureWorkspace(surfaceId);
    const tab = this.resolveTab(state, input.tabId);
    if (state.activeTabId !== tab.id) {
      state.activeTabId = tab.id;
      syncThreadLastError(state);
      this.emitState(surfaceId);
    }

    this.resumeThread(surfaceId);
    const runtime = this.ensureLiveRuntime(surfaceId, tab.id);
    if (this.activeBounds) {
      this.attachActiveTab(surfaceId, this.activeBounds);
    }
    runtime.view.webContents.openDevTools({ mode: "detach" });
  }

  private activateThread(surfaceId: BrowserSurfaceId, bounds: BrowserPanelBounds): void {
    const previousActiveSurfaceId =
      this.activeSurfaceId && !sameBrowserSurfaceId(this.activeSurfaceId, surfaceId)
        ? this.activeSurfaceId
        : null;

    this.activeSurfaceId = surfaceId;
    this.activeBounds = bounds;
    if (previousActiveSurfaceId) {
      this.scheduleThreadSuspend(previousActiveSurfaceId);
    }
    this.resumeThread(surfaceId);
    this.attachActiveTab(surfaceId, bounds);
  }

  private resumeThread(surfaceId: BrowserSurfaceId): void {
    const state = this.ensureWorkspace(surfaceId);
    if (!state.open) {
      return;
    }

    this.clearSuspendTimer(surfaceId);
    const activeTab = this.getActiveTab(state);

    // Only resume the visible tab. Waking every tab can fan out into several
    // Chromium renderer processes and background page activity at once.
    for (const tab of state.tabs) {
      if (tab.id !== activeTab?.id) {
        continue;
      }
      const runtime = this.ensureLiveRuntime(surfaceId, tab.id);
      if (tab.status === "suspended") {
        void this.loadTab(surfaceId, tab.id, { force: true, runtime });
      } else {
        syncTabStateFromRuntime(state, tab, runtime.view.webContents);
      }
    }

    syncThreadLastError(state);
    this.emitState(surfaceId);
  }

  private scheduleThreadSuspend(surfaceId: BrowserSurfaceId): void {
    const surfaceKey = browserSurfaceKey(surfaceId);
    const state = this.states.get(surfaceKey);
    if (
      !state?.open ||
      (this.activeSurfaceId && sameBrowserSurfaceId(this.activeSurfaceId, surfaceId))
    ) {
      return;
    }

    this.clearSuspendTimer(surfaceId);
    const timer = setTimeout(() => {
      this.suspendThread(surfaceId);
      this.suspendTimers.delete(surfaceKey);
    }, BROWSER_THREAD_SUSPEND_DELAY_MS);
    timer.unref();
    this.suspendTimers.set(surfaceKey, timer);
  }

  private suspendThread(surfaceId: BrowserSurfaceId): void {
    const state = this.states.get(browserSurfaceKey(surfaceId));
    if (!state || (this.activeSurfaceId && sameBrowserSurfaceId(this.activeSurfaceId, surfaceId))) {
      return;
    }

    for (const tab of state.tabs) {
      this.destroyRuntime(surfaceId, tab.id);
      tab.status = "suspended";
      tab.isLoading = false;
      tab.canGoBack = false;
      tab.canGoForward = false;
    }

    syncThreadLastError(state);
    this.emitState(surfaceId);
  }

  private clearSuspendTimer(surfaceId: BrowserSurfaceId): void {
    const surfaceKey = browserSurfaceKey(surfaceId);
    const existing = this.suspendTimers.get(surfaceKey);
    if (!existing) {
      return;
    }
    clearTimeout(existing);
    this.suspendTimers.delete(surfaceKey);
  }

  private attachActiveTab(surfaceId: BrowserSurfaceId, bounds: BrowserPanelBounds): void {
    const state = this.ensureWorkspace(surfaceId);
    const activeTab = this.getActiveTab(state);
    if (!activeTab) {
      return;
    }

    const runtime = this.ensureLiveRuntime(surfaceId, activeTab.id);
    this.attachRuntime(runtime, bounds);
    if (activeTab.status === "suspended") {
      void this.loadTab(surfaceId, activeTab.id, { force: true, runtime });
    } else {
      this.syncRuntimeState(surfaceId, activeTab.id);
    }
  }

  private attachRuntime(runtime: LiveTabRuntime, bounds: BrowserPanelBounds): void {
    const window = this.window;
    if (!window) {
      return;
    }

    if (this.attachedRuntimeKey === runtime.key) {
      runtime.view.setBounds(bounds);
      return;
    }

    this.detachAttachedRuntime();
    window.contentView.addChildView(runtime.view);
    runtime.view.setBounds(bounds);
    this.attachedRuntimeKey = runtime.key;
  }

  private detachAttachedRuntime(): void {
    if (!this.window || !this.attachedRuntimeKey) {
      this.attachedRuntimeKey = null;
      return;
    }

    const runtime = this.runtimes.get(this.attachedRuntimeKey);
    if (runtime) {
      this.window.contentView.removeChildView(runtime.view);
    }
    this.attachedRuntimeKey = null;
  }

  private ensureLiveRuntime(surfaceId: BrowserSurfaceId, tabId: string): LiveTabRuntime {
    const key = buildRuntimeKey(surfaceId, tabId);
    const existing = this.runtimes.get(key);
    if (existing) {
      return existing;
    }

    const runtime = this.createLiveRuntime(surfaceId, tabId);
    this.runtimes.set(key, runtime);
    const state = this.ensureWorkspace(surfaceId);
    const tab = this.getTab(state, tabId);
    if (tab) {
      tab.status = "live";
      tab.lastError = null;
      syncThreadLastError(state);
    }
    return runtime;
  }

  private createLiveRuntime(surfaceId: BrowserSurfaceId, tabId: string): LiveTabRuntime {
    const view = new WebContentsView({
      webPreferences: {
        partition: BROWSER_SESSION_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const runtime: LiveTabRuntime = {
      key: buildRuntimeKey(surfaceId, tabId),
      surfaceId,
      tabId,
      view,
    };
    const webContents = view.webContents;

    webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("http://") || url.startsWith("https://") || url === ABOUT_BLANK_URL) {
        this.newTab({
          surfaceId,
          url,
          activate: true,
        });
        if (
          this.activeSurfaceId &&
          sameBrowserSurfaceId(this.activeSurfaceId, surfaceId) &&
          this.activeBounds
        ) {
          this.attachActiveTab(surfaceId, this.activeBounds);
        }
        return { action: "deny" };
      }

      void shell.openExternal(url);
      return { action: "deny" };
    });

    webContents.on("page-title-updated", (event) => {
      event.preventDefault();
      this.syncRuntimeState(surfaceId, tabId);
    });
    webContents.on("page-favicon-updated", (_event, faviconUrls) => {
      this.syncRuntimeState(surfaceId, tabId, faviconUrls);
    });
    webContents.on("did-start-loading", () => {
      this.syncRuntimeState(surfaceId, tabId);
    });
    webContents.on("did-stop-loading", () => {
      this.syncRuntimeState(surfaceId, tabId);
    });
    webContents.on("did-navigate", () => {
      this.syncRuntimeState(surfaceId, tabId);
    });
    webContents.on("did-navigate-in-page", () => {
      this.syncRuntimeState(surfaceId, tabId);
    });
    webContents.on(
      "did-fail-load",
      (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame || errorCode === BROWSER_ERROR_ABORTED) {
          return;
        }

        const state = this.states.get(browserSurfaceKey(surfaceId));
        const tab = state ? this.getTab(state, tabId) : null;
        if (!state || !tab) {
          return;
        }

        tab.url = validatedURL || tab.url;
        tab.title = defaultTitleForUrl(tab.url);
        tab.isLoading = false;
        tab.lastError = mapBrowserLoadError(errorCode);
        syncThreadLastError(state);
        this.emitState(surfaceId);
      },
    );
    webContents.on("render-process-gone", () => {
      const state = this.states.get(browserSurfaceKey(surfaceId));
      const tab = state ? this.getTab(state, tabId) : null;
      this.destroyRuntime(surfaceId, tabId);
      if (state && tab) {
        tab.status = "suspended";
        tab.isLoading = false;
        tab.lastError = "This tab stopped unexpectedly.";
        syncThreadLastError(state);
        this.emitState(surfaceId);
      }
      if (
        this.activeSurfaceId &&
        sameBrowserSurfaceId(this.activeSurfaceId, surfaceId) &&
        this.activeBounds
      ) {
        this.attachActiveTab(surfaceId, this.activeBounds);
      }
    });

    return runtime;
  }

  private async loadTab(
    surfaceId: BrowserSurfaceId,
    tabId: string,
    options: { force?: boolean; runtime?: LiveTabRuntime } = {},
  ): Promise<void> {
    const state = this.ensureWorkspace(surfaceId);
    const tab = this.getTab(state, tabId);
    if (!tab) {
      return;
    }

    const runtime = options.runtime ?? this.ensureLiveRuntime(surfaceId, tabId);
    const webContents = runtime.view.webContents;
    const nextUrl = normalizeUrlInput(
      options.force === true ? tab.url : (tab.lastCommittedUrl ?? tab.url),
    );
    const currentUrl = webContents.getURL();
    const shouldLoad = options.force === true || currentUrl !== nextUrl || currentUrl.length === 0;

    if (!shouldLoad) {
      this.syncRuntimeState(surfaceId, tabId);
      return;
    }

    tab.url = nextUrl;
    tab.status = "live";
    tab.isLoading = true;
    tab.lastError = null;
    syncThreadLastError(state);
    this.emitState(surfaceId);

    try {
      await webContents.loadURL(nextUrl);
      this.syncRuntimeState(surfaceId, tabId);
    } catch (error) {
      if (isAbortedNavigationError(error)) {
        this.syncRuntimeState(surfaceId, tabId);
        return;
      }

      tab.isLoading = false;
      tab.lastError = "Couldn't open this page.";
      syncThreadLastError(state);
      this.emitState(surfaceId);
    }
  }

  private syncRuntimeState(
    surfaceId: BrowserSurfaceId,
    tabId: string,
    faviconUrls?: string[],
  ): void {
    const state = this.states.get(browserSurfaceKey(surfaceId));
    const tab = state ? this.getTab(state, tabId) : null;
    const runtime = this.runtimes.get(buildRuntimeKey(surfaceId, tabId));
    if (!state || !tab || !runtime) {
      return;
    }

    syncTabStateFromRuntime(state, tab, runtime.view.webContents, faviconUrls);
    syncThreadLastError(state);
    this.emitState(surfaceId);
  }

  private destroyThreadRuntimes(surfaceId: BrowserSurfaceId): void {
    const state = this.states.get(browserSurfaceKey(surfaceId));
    if (!state) {
      return;
    }

    for (const tab of state.tabs) {
      this.destroyRuntime(surfaceId, tab.id);
    }
  }

  private destroyAllRuntimes(): void {
    for (const runtime of this.runtimes.values()) {
      this.destroyRuntime(runtime.surfaceId, runtime.tabId);
    }
  }

  private destroyRuntime(surfaceId: BrowserSurfaceId, tabId: string): void {
    const key = buildRuntimeKey(surfaceId, tabId);
    const runtime = this.runtimes.get(key);
    if (!runtime) {
      return;
    }

    if (this.attachedRuntimeKey === key) {
      this.detachAttachedRuntime();
    }

    this.runtimes.delete(key);
    const webContents = runtime.view.webContents;
    if (!webContents.isDestroyed()) {
      webContents.close({ waitForBeforeUnload: false });
    }
  }

  private getOrCreateState(surfaceId: BrowserSurfaceId): BrowserSurfaceState {
    const surfaceKey = browserSurfaceKey(surfaceId);
    const existing = this.states.get(surfaceKey);
    if (existing) {
      return existing;
    }

    const initial = defaultBrowserSurfaceState(surfaceId);
    this.states.set(surfaceKey, initial);
    return initial;
  }

  private ensureWorkspace(surfaceId: BrowserSurfaceId, initialUrl?: string): BrowserSurfaceState {
    const state = this.getOrCreateState(surfaceId);
    if (state.tabs.length === 0) {
      const initialTab = createBrowserTab(normalizeUrlInput(initialUrl));
      state.tabs = [initialTab];
      state.activeTabId = initialTab.id;
    }

    if (!state.activeTabId || !state.tabs.some((tab) => tab.id === state.activeTabId)) {
      state.activeTabId = state.tabs[0]?.id ?? null;
    }

    return state;
  }

  private resolveTab(state: BrowserSurfaceState, tabId?: string): BrowserTabState {
    const resolvedTabId = tabId ?? state.activeTabId;
    const existing =
      (resolvedTabId ? state.tabs.find((tab) => tab.id === resolvedTabId) : undefined) ??
      state.tabs[0];
    if (existing) {
      return existing;
    }

    const fallback = createBrowserTab();
    state.tabs = [fallback];
    state.activeTabId = fallback.id;
    return fallback;
  }

  private getActiveTab(state: BrowserSurfaceState): BrowserTabState | null {
    if (!state.activeTabId) {
      return state.tabs[0] ?? null;
    }
    return state.tabs.find((tab) => tab.id === state.activeTabId) ?? state.tabs[0] ?? null;
  }

  private getTab(state: BrowserSurfaceState, tabId: string): BrowserTabState | null {
    return state.tabs.find((tab) => tab.id === tabId) ?? null;
  }

  private emitState(surfaceId: BrowserSurfaceId): void {
    const state = cloneBrowserState(this.getOrCreateState(surfaceId));
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

function syncTabStateFromRuntime(
  state: BrowserSurfaceState,
  tab: BrowserTabState,
  webContents: WebContentsView["webContents"],
  faviconUrls?: string[],
): void {
  const currentUrl = webContents.getURL();
  const nextUrl = currentUrl || tab.url;
  const nextTitle = webContents.getTitle();
  tab.status = "live";
  tab.url = nextUrl;
  tab.title = !nextTitle || nextTitle === ABOUT_BLANK_URL ? defaultTitleForUrl(nextUrl) : nextTitle;
  tab.isLoading = webContents.isLoading();
  tab.canGoBack = webContents.canGoBack();
  tab.canGoForward = webContents.canGoForward();
  tab.lastCommittedUrl = currentUrl || tab.lastCommittedUrl;
  if (faviconUrls) {
    tab.faviconUrl = faviconUrls[0] ?? tab.faviconUrl;
  }
  if (tab.lastError && !tab.isLoading) {
    tab.lastError = null;
  }
  syncThreadLastError(state);
}

function syncThreadLastError(state: BrowserSurfaceState): void {
  const activeTab =
    (state.activeTabId ? state.tabs.find((tab) => tab.id === state.activeTabId) : undefined) ??
    state.tabs[0];
  state.lastError = activeTab?.lastError ?? null;
}
