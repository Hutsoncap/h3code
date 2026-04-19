/**
 * Lightweight browser metadata cache keyed by browser surface.
 *
 * The live browser surface stays in Electron; the web app only keeps enough
 * state to render tabs/toolbars and survive surface switches predictably.
 */

import * as Schema from "effect/Schema";
import type {
  BrowserSurfaceId,
  BrowserSurfaceState,
  BrowserTabState,
  ThreadId,
} from "@t3tools/contracts";
import { BrowserTabStateSchema, ThreadId as ThreadIdSchema } from "@t3tools/contracts";
import { browserSurfaceKey, createThreadBrowserSurfaceId } from "@t3tools/shared/browserSurface";
import { trimOrNull } from "@t3tools/shared/model";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createAliasedStateStorage } from "./lib/storage";
import {
  decodePersistedStateOrNull,
  type PersistedBrowserState,
  PersistedBrowserStateSchema,
} from "./persistenceSchema";

const BROWSER_STATE_STORAGE_KEY = "h3code:browser-state:v1";
const BROWSER_STATE_STORAGE_VERSION = 1;
const BROWSER_HISTORY_LIMIT = 12;
const EMPTY_BROWSER_HISTORY: BrowserHistoryEntry[] = [];

const LegacyThreadBrowserStateSchema = Schema.Struct({
  threadId: ThreadIdSchema,
  open: Schema.Boolean,
  activeTabId: Schema.NullOr(Schema.String),
  tabs: Schema.Array(BrowserTabStateSchema),
  lastError: Schema.NullOr(Schema.String),
});

const LegacyPersistedBrowserStateSchema = Schema.Struct({
  threadStatesByThreadId: Schema.Record(Schema.String, LegacyThreadBrowserStateSchema),
  recentHistoryByThreadId: Schema.Record(
    Schema.String,
    Schema.Array(
      Schema.Struct({
        url: Schema.String,
        title: Schema.String,
        tabId: Schema.String,
      }),
    ),
  ),
});

type LegacyPersistedBrowserState = typeof LegacyPersistedBrowserStateSchema.Type;

export interface BrowserHistoryEntry {
  url: string;
  title: string;
  tabId: string;
}

interface BrowserStateStore {
  surfaceStatesById: Record<string, BrowserSurfaceState | undefined>;
  recentHistoryBySurfaceId: Record<string, BrowserHistoryEntry[] | undefined>;
  upsertSurfaceState: (state: BrowserSurfaceState) => void;
  removeSurfaceState: (surfaceId: BrowserSurfaceId) => void;
}

type BrowserSurfaceStateLike = Omit<BrowserSurfaceState, "tabs"> & {
  tabs: readonly BrowserTabState[];
};

function cloneBrowserTabs(tabs: readonly BrowserTabState[]): BrowserTabState[] {
  return tabs.map((tab) => ({ ...tab }));
}

function normalizeHistoryUrl(url: string): string {
  const trimmed = trimOrNull(url);
  if (!trimmed) {
    return "";
  }
  return trimmed === "about:blank" ? "" : trimmed;
}

function normalizeBrowserSurfaceId(surfaceId: BrowserSurfaceId): BrowserSurfaceId | null {
  switch (surfaceId.kind) {
    case "thread": {
      const threadId = trimOrNull(surfaceId.threadId);
      return threadId ? createThreadBrowserSurfaceId(threadId as ThreadId) : null;
    }
    case "standalone": {
      const id = trimOrNull(surfaceId.id);
      return id
        ? {
            kind: "standalone",
            id,
          }
        : null;
    }
    case "webapp": {
      const webAppId = trimOrNull(surfaceId.webAppId);
      return webAppId
        ? {
            kind: "webapp",
            webAppId,
          }
        : null;
    }
  }
}

function upsertRecentHistoryEntry(
  entries: BrowserHistoryEntry[] | undefined,
  nextEntry: BrowserHistoryEntry,
): BrowserHistoryEntry[] {
  const normalizedUrl = normalizeHistoryUrl(nextEntry.url);
  if (normalizedUrl.length === 0) {
    return entries ?? [];
  }

  const nextEntries = (entries ?? []).filter(
    (entry) => normalizeHistoryUrl(entry.url) !== normalizedUrl,
  );
  nextEntries.unshift({
    ...nextEntry,
    url: normalizedUrl,
  });
  return nextEntries.slice(0, BROWSER_HISTORY_LIMIT);
}

function normalizeBrowserSurfaceState(state: BrowserSurfaceStateLike): BrowserSurfaceState {
  return {
    ...state,
    tabs: cloneBrowserTabs(state.tabs),
  };
}

function normalizePersistedBrowserState(persistedState: unknown): PersistedBrowserState {
  const decoded = decodePersistedStateOrNull(PersistedBrowserStateSchema, persistedState);
  if (decoded) {
    const surfaceStatesById = Object.fromEntries(
      Object.values(decoded.surfaceStatesById).flatMap((state) => {
        const normalizedSurfaceId = normalizeBrowserSurfaceId(state.surfaceId);
        if (!normalizedSurfaceId) {
          return [];
        }

        const normalizedState = normalizeBrowserSurfaceState({
          ...state,
          surfaceId: normalizedSurfaceId,
        });
        return [[browserSurfaceKey(normalizedState.surfaceId), normalizedState] as const];
      }),
    );

    const recentHistoryBySurfaceId = Object.fromEntries(
      Object.entries(decoded.recentHistoryBySurfaceId).flatMap(([surfaceKey, entries]) => {
        const normalizedKey = trimOrNull(surfaceKey);
        if (!normalizedKey) {
          return [];
        }

        return [
          [
            normalizedKey,
            entries.map((entry) => ({
              ...entry,
            })),
          ] as const,
        ];
      }),
    );

    return {
      surfaceStatesById,
      recentHistoryBySurfaceId,
    };
  }

  const legacyDecoded = decodePersistedStateOrNull(
    LegacyPersistedBrowserStateSchema,
    persistedState,
  );
  if (!legacyDecoded) {
    return {
      surfaceStatesById: {},
      recentHistoryBySurfaceId: {},
    };
  }

  return migrateLegacyPersistedBrowserState(legacyDecoded);
}

function migrateLegacyPersistedBrowserState(
  persistedState: LegacyPersistedBrowserState,
): PersistedBrowserState {
  const surfaceStatesById = Object.fromEntries(
    Object.values(persistedState.threadStatesByThreadId).flatMap((state) => {
      const normalizedThreadId = trimOrNull(state.threadId);
      if (!normalizedThreadId) {
        return [];
      }

      const surfaceId = createThreadBrowserSurfaceId(normalizedThreadId as ThreadId);
      return [
        [
          browserSurfaceKey(surfaceId),
          {
            surfaceId,
            open: state.open,
            activeTabId: state.activeTabId,
            tabs: cloneBrowserTabs(state.tabs),
            lastError: state.lastError,
          } satisfies BrowserSurfaceState,
        ] as const,
      ];
    }),
  );

  const recentHistoryBySurfaceId = Object.fromEntries(
    Object.entries(persistedState.recentHistoryByThreadId).flatMap(([threadId, entries]) => {
      const normalizedThreadId = trimOrNull(threadId);
      if (!normalizedThreadId) {
        return [];
      }

      const surfaceId = createThreadBrowserSurfaceId(normalizedThreadId as ThreadId);
      return [
        [
          browserSurfaceKey(surfaceId),
          entries.map((entry) => ({
            ...entry,
          })),
        ] as const,
      ];
    }),
  );

  return {
    surfaceStatesById,
    recentHistoryBySurfaceId,
  };
}

export const useBrowserStateStore = create<BrowserStateStore>()(
  persist(
    (set) => ({
      surfaceStatesById: {},
      recentHistoryBySurfaceId: {},
      upsertSurfaceState: (state) =>
        set((current) => {
          const surfaceKey = browserSurfaceKey(state.surfaceId);
          const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
          const orderedTabs = activeTab
            ? [activeTab, ...state.tabs.filter((tab) => tab.id !== activeTab.id)]
            : state.tabs;
          const nextHistory = orderedTabs.reduce(
            (entries, tab) =>
              upsertRecentHistoryEntry(entries, {
                url: tab.lastCommittedUrl ?? tab.url,
                title: tab.title,
                tabId: tab.id,
              }),
            current.recentHistoryBySurfaceId[surfaceKey],
          );

          return {
            surfaceStatesById: {
              ...current.surfaceStatesById,
              [surfaceKey]: normalizeBrowserSurfaceState(state),
            },
            recentHistoryBySurfaceId: {
              ...current.recentHistoryBySurfaceId,
              [surfaceKey]: nextHistory,
            },
          };
        }),
      removeSurfaceState: (surfaceId) =>
        set((current) => {
          const surfaceKey = browserSurfaceKey(surfaceId);
          if (!Object.hasOwn(current.surfaceStatesById, surfaceKey)) {
            return current;
          }

          const nextSurfaceStatesById = { ...current.surfaceStatesById };
          const nextRecentHistoryBySurfaceId = { ...current.recentHistoryBySurfaceId };
          delete nextSurfaceStatesById[surfaceKey];
          delete nextRecentHistoryBySurfaceId[surfaceKey];
          return {
            surfaceStatesById: nextSurfaceStatesById,
            recentHistoryBySurfaceId: nextRecentHistoryBySurfaceId,
          };
        }),
    }),
    {
      name: BROWSER_STATE_STORAGE_KEY,
      version: BROWSER_STATE_STORAGE_VERSION,
      storage: createJSONStorage(() => createAliasedStateStorage(localStorage)),
      partialize: (state) => ({
        surfaceStatesById: state.surfaceStatesById,
        recentHistoryBySurfaceId: state.recentHistoryBySurfaceId,
      }),
      migrate: (persistedState) => normalizePersistedBrowserState(persistedState),
      merge: (persistedState, currentState) => {
        const normalized = normalizePersistedBrowserState(persistedState);
        return {
          ...currentState,
          surfaceStatesById: normalized.surfaceStatesById,
          recentHistoryBySurfaceId: normalized.recentHistoryBySurfaceId,
        };
      },
    },
  ),
);

export function selectBrowserSurfaceState(
  surfaceId: BrowserSurfaceId,
): (store: BrowserStateStore) => BrowserSurfaceState | undefined {
  const surfaceKey = browserSurfaceKey(surfaceId);
  return (store) => store.surfaceStatesById[surfaceKey];
}

export function selectBrowserSurfaceHistory(
  surfaceId: BrowserSurfaceId,
): (store: BrowserStateStore) => BrowserHistoryEntry[] {
  const surfaceKey = browserSurfaceKey(surfaceId);
  return (store) => store.recentHistoryBySurfaceId[surfaceKey] ?? EMPTY_BROWSER_HISTORY;
}

export function selectThreadBrowserState(
  threadId: ThreadId,
): (store: BrowserStateStore) => BrowserSurfaceState | undefined {
  return selectBrowserSurfaceState(createThreadBrowserSurfaceId(threadId));
}

export function selectThreadBrowserHistory(
  threadId: ThreadId,
): (store: BrowserStateStore) => BrowserHistoryEntry[] {
  return selectBrowserSurfaceHistory(createThreadBrowserSurfaceId(threadId));
}
