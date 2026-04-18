/**
 * Lightweight browser metadata cache keyed by thread.
 *
 * The live browser surface stays in Electron; the web app only keeps enough
 * state to render tabs/toolbars and survive thread switches predictably.
 */

import type { ThreadBrowserState, ThreadId } from "@t3tools/contracts";
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
const BROWSER_HISTORY_LIMIT = 12;
const EMPTY_BROWSER_HISTORY: BrowserHistoryEntry[] = [];

export interface BrowserHistoryEntry {
  url: string;
  title: string;
  tabId: string;
}

interface BrowserStateStore {
  threadStatesByThreadId: Record<string, ThreadBrowserState | undefined>;
  recentHistoryByThreadId: Record<string, BrowserHistoryEntry[] | undefined>;
  upsertThreadState: (state: ThreadBrowserState) => void;
  removeThreadState: (threadId: ThreadId) => void;
}

function normalizeHistoryUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed === "about:blank" ? "" : trimmed;
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

function normalizePersistedBrowserState(persistedState: unknown): PersistedBrowserState {
  const decoded = decodePersistedStateOrNull(PersistedBrowserStateSchema, persistedState);
  if (!decoded) {
    return {
      threadStatesByThreadId: {},
      recentHistoryByThreadId: {},
    };
  }

  const threadStatesByThreadId = Object.fromEntries(
    Object.values(decoded.threadStatesByThreadId).flatMap((state) => {
      const normalizedThreadId = trimOrNull(state.threadId);
      if (!normalizedThreadId) {
        return [];
      }

      return [
        [
          normalizedThreadId,
          {
            ...state,
            threadId: normalizedThreadId,
            tabs: state.tabs.map((tab) => ({ ...tab })),
          } satisfies ThreadBrowserState,
        ] as const,
      ];
    }),
  );
  const recentHistoryByThreadId = Object.fromEntries(
    Object.entries(decoded.recentHistoryByThreadId).flatMap(([threadId, entries]) => {
      const normalizedThreadId = trimOrNull(threadId);
      if (!normalizedThreadId) {
        return [];
      }

      return [
        [
          normalizedThreadId,
          entries.map((entry) => ({
            ...entry,
          })),
        ] as const,
      ];
    }),
  );

  return {
    threadStatesByThreadId,
    recentHistoryByThreadId,
  };
}

export const useBrowserStateStore = create<BrowserStateStore>()(
  persist(
    (set) => ({
      threadStatesByThreadId: {},
      recentHistoryByThreadId: {},
      upsertThreadState: (state) =>
        set((current) => {
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
            current.recentHistoryByThreadId[state.threadId],
          );

          return {
            threadStatesByThreadId: {
              ...current.threadStatesByThreadId,
              [state.threadId]: state,
            },
            recentHistoryByThreadId: {
              ...current.recentHistoryByThreadId,
              [state.threadId]: nextHistory,
            },
          };
        }),
      removeThreadState: (threadId) =>
        set((current) => {
          if (!Object.hasOwn(current.threadStatesByThreadId, threadId)) {
            return current;
          }
          const nextThreadStatesByThreadId = { ...current.threadStatesByThreadId };
          const nextRecentHistoryByThreadId = { ...current.recentHistoryByThreadId };
          delete nextThreadStatesByThreadId[threadId];
          delete nextRecentHistoryByThreadId[threadId];
          return {
            threadStatesByThreadId: nextThreadStatesByThreadId,
            recentHistoryByThreadId: nextRecentHistoryByThreadId,
          };
        }),
    }),
    {
      name: BROWSER_STATE_STORAGE_KEY,
      storage: createJSONStorage(() => createAliasedStateStorage(localStorage)),
      merge: (persistedState, currentState) => {
        const normalized = normalizePersistedBrowserState(persistedState);
        return {
          ...currentState,
          threadStatesByThreadId: normalized.threadStatesByThreadId,
          recentHistoryByThreadId: normalized.recentHistoryByThreadId,
        };
      },
    },
  ),
);

export function selectThreadBrowserState(
  threadId: ThreadId,
): (store: BrowserStateStore) => ThreadBrowserState | undefined {
  return (store) => store.threadStatesByThreadId[threadId];
}

export function selectThreadBrowserHistory(
  threadId: ThreadId,
): (store: BrowserStateStore) => BrowserHistoryEntry[] {
  return (store) => store.recentHistoryByThreadId[threadId] ?? EMPTY_BROWSER_HISTORY;
}
