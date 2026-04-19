import { trimOrNull } from "@t3tools/shared/model";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createAliasedStateStorage } from "./lib/storage";
import { decodePersistedStateOrNull, PersistedWebAppsStoreStateSchema } from "./persistenceSchema";

const WEB_APPS_STORAGE_KEY = "h3code:web-apps:v1";

export interface WebAppEntry {
  id: string;
  name: string;
  url: string;
  faviconUrl: string | null;
  createdAt: string;
}

interface InstallWebAppInput {
  title?: string | null | undefined;
  url?: string | null | undefined;
  faviconUrl?: string | null | undefined;
}

interface AddWebAppInput {
  name?: string | null | undefined;
  url?: string | null | undefined;
  faviconUrl?: string | null | undefined;
}

interface WebAppsStoreState {
  webApps: WebAppEntry[];
  installFromTab: (input: InstallWebAppInput) => WebAppEntry | null;
  addWebApp: (input: AddWebAppInput) => WebAppEntry | null;
  renameWebApp: (webAppId: string, name: string) => void;
  deleteWebApp: (webAppId: string) => void;
  reorderWebApp: (webAppId: string, nextIndex: number) => void;
}

function randomWebAppId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeWebAppFaviconUrl(faviconUrl: string | null | undefined): string | null {
  const normalized = trimOrNull(faviconUrl);
  return normalized ?? null;
}

export function normalizeWebAppUrl(url: string | null | undefined): string | null {
  const normalized = trimOrNull(url);
  if (!normalized || normalized === "about:blank") {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function fallbackWebAppName(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

function normalizeWebAppName(name: string | null | undefined, url: string): string {
  const normalized = trimOrNull(name)?.replace(/\s+/g, " ");
  return normalized ?? fallbackWebAppName(url);
}

function normalizeWebApps(webApps: readonly WebAppEntry[]): WebAppEntry[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const normalized: WebAppEntry[] = [];

  for (const webApp of webApps) {
    const id = trimOrNull(webApp.id) ?? "";
    const url = normalizeWebAppUrl(webApp.url);
    if (!id || !url || seenIds.has(id) || seenUrls.has(url)) {
      continue;
    }

    seenIds.add(id);
    seenUrls.add(url);
    normalized.push({
      id,
      name: normalizeWebAppName(webApp.name, url),
      url,
      faviconUrl: normalizeWebAppFaviconUrl(webApp.faviconUrl),
      createdAt: webApp.createdAt || nowIso(),
    });
  }

  return normalized;
}

function reorderAtIndex<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return [...items];
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) {
    return [...items];
  }
  next.splice(toIndex, 0, moved);
  return next;
}

export const useWebAppsStore = create<WebAppsStoreState>()(
  persist(
    (set) => ({
      webApps: [],
      installFromTab: (input) => {
        const url = normalizeWebAppUrl(input.url);
        if (!url) {
          return null;
        }

        const faviconUrl = normalizeWebAppFaviconUrl(input.faviconUrl);
        let installedEntry: WebAppEntry | null = null;

        set((state) => {
          const existingIndex = state.webApps.findIndex((webApp) => webApp.url === url);
          if (existingIndex >= 0) {
            const existingEntry = state.webApps[existingIndex];
            if (!existingEntry) {
              return state;
            }

            const nextEntry: WebAppEntry = {
              ...existingEntry,
              name: normalizeWebAppName(input.title, url),
              faviconUrl,
            };
            installedEntry = nextEntry;

            const nextWebApps = [...state.webApps];
            nextWebApps.splice(existingIndex, 1);
            nextWebApps.unshift(nextEntry);
            return { webApps: nextWebApps };
          }

          const nextEntry: WebAppEntry = {
            id: randomWebAppId(),
            name: normalizeWebAppName(input.title, url),
            url,
            faviconUrl,
            createdAt: nowIso(),
          };
          installedEntry = nextEntry;
          return {
            webApps: [nextEntry, ...state.webApps],
          };
        });

        return installedEntry;
      },
      addWebApp: (input) => {
        const url = normalizeWebAppUrl(input.url);
        if (!url) {
          return null;
        }

        const faviconUrl = normalizeWebAppFaviconUrl(input.faviconUrl);
        let createdEntry: WebAppEntry | null = null;

        set((state) => {
          const existingIndex = state.webApps.findIndex((webApp) => webApp.url === url);
          if (existingIndex >= 0) {
            const existingEntry = state.webApps[existingIndex];
            if (!existingEntry) {
              return state;
            }

            const nextEntry: WebAppEntry = {
              ...existingEntry,
              name: normalizeWebAppName(input.name, url),
              faviconUrl: faviconUrl ?? existingEntry.faviconUrl,
            };
            createdEntry = nextEntry;

            const nextWebApps = [...state.webApps];
            nextWebApps.splice(existingIndex, 1);
            nextWebApps.unshift(nextEntry);
            return { webApps: nextWebApps };
          }

          const nextEntry: WebAppEntry = {
            id: randomWebAppId(),
            name: normalizeWebAppName(input.name, url),
            url,
            faviconUrl,
            createdAt: nowIso(),
          };
          createdEntry = nextEntry;
          return {
            webApps: [nextEntry, ...state.webApps],
          };
        });

        return createdEntry;
      },
      renameWebApp: (webAppId, name) =>
        set((state) => ({
          webApps: state.webApps.map((webApp) =>
            webApp.id === webAppId
              ? {
                  ...webApp,
                  name: normalizeWebAppName(name, webApp.url),
                }
              : webApp,
          ),
        })),
      deleteWebApp: (webAppId) =>
        set((state) => ({
          webApps: state.webApps.filter((webApp) => webApp.id !== webAppId),
        })),
      reorderWebApp: (webAppId, nextIndex) =>
        set((state) => {
          const currentIndex = state.webApps.findIndex((webApp) => webApp.id === webAppId);
          if (currentIndex < 0) {
            return state;
          }

          const clampedIndex = Math.max(0, Math.min(nextIndex, state.webApps.length - 1));
          if (clampedIndex === currentIndex) {
            return state;
          }

          return {
            webApps: reorderAtIndex(state.webApps, currentIndex, clampedIndex),
          };
        }),
    }),
    {
      name: WEB_APPS_STORAGE_KEY,
      storage: createJSONStorage(() => createAliasedStateStorage(localStorage)),
      partialize: (state) => ({
        webApps: normalizeWebApps(state.webApps),
      }),
      merge: (persistedState, currentState) => {
        const decoded = decodePersistedStateOrNull(
          PersistedWebAppsStoreStateSchema,
          persistedState,
        );

        return {
          ...currentState,
          webApps: decoded ? normalizeWebApps(decoded.webApps) : currentState.webApps,
        };
      },
    },
  ),
);
