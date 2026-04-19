import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createAliasedStateStorage } from "./lib/storage";
import {
  decodePersistedStateOrNull,
  PersistedPinnedItemsStateSchema,
  PersistedPinnedThreadsStateSchema,
} from "./persistenceSchema";

export type PinnedItemKind = "thread" | "workspace" | "webapp";

export interface PinnedItem {
  kind: PinnedItemKind;
  id: string;
}

type PinnedItemAllowList = Partial<Record<PinnedItemKind, readonly string[]>>;

interface PinnedItemsStoreState {
  pinnedItems: PinnedItem[];
  pinItem: (item: PinnedItem) => void;
  unpinItem: (item: PinnedItem) => void;
  togglePin: (item: PinnedItem) => void;
  reorder: (item: PinnedItem, nextIndex: number) => void;
  prune: (allowList: PinnedItemAllowList) => void;
}

const PINNED_ITEMS_STORAGE_KEY = "h3code:pinned-items:v1";
const LEGACY_PINNED_THREADS_STORAGE_KEY = "h3code:pinned-threads:v1";

function getPinnedItemKey(item: PinnedItem): string {
  return `${item.kind}:${item.id}`;
}

function normalizePinnedItems(items: readonly PinnedItem[]): PinnedItem[] {
  const seen = new Set<string>();
  const normalized: PinnedItem[] = [];

  for (const item of items) {
    if (item.id.length === 0) {
      continue;
    }

    const key = getPinnedItemKey(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(item);
  }

  return normalized;
}

function readLegacyPinnedThreadItems(): PinnedItem[] {
  if (typeof localStorage === "undefined") {
    return [];
  }

  const storage = createAliasedStateStorage(localStorage);
  const persistedValue = storage.getItem(LEGACY_PINNED_THREADS_STORAGE_KEY);
  if (typeof persistedValue !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(persistedValue) as { state?: unknown };
    const decoded =
      decodePersistedStateOrNull(PersistedPinnedThreadsStateSchema, parsed.state ?? parsed)
        ?.pinnedThreadIds ?? [];

    return normalizePinnedItems(decoded.map((id) => ({ kind: "thread", id })));
  } catch {
    return [];
  } finally {
    storage.removeItem(LEGACY_PINNED_THREADS_STORAGE_KEY);
  }
}

function hasPinnedItem(items: readonly PinnedItem[], candidate: PinnedItem): boolean {
  return items.some((item) => item.kind === candidate.kind && item.id === candidate.id);
}

function samePinnedItems(a: readonly PinnedItem[], b: readonly PinnedItem[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((item, index) => {
    const other = b[index];
    return other !== undefined && item.kind === other.kind && item.id === other.id;
  });
}

export const usePinnedItemsStore = create<PinnedItemsStoreState>()(
  persist(
    (set) => ({
      pinnedItems: [],
      pinItem: (item) => {
        if (item.id.length === 0) return;
        set((state) => {
          if (hasPinnedItem(state.pinnedItems, item)) {
            return state;
          }

          return {
            pinnedItems: [item, ...state.pinnedItems],
          };
        });
      },
      unpinItem: (item) => {
        if (item.id.length === 0) return;
        set((state) => {
          const nextPinnedItems = state.pinnedItems.filter(
            (candidate) => candidate.kind !== item.kind || candidate.id !== item.id,
          );

          return nextPinnedItems.length === state.pinnedItems.length
            ? state
            : { pinnedItems: nextPinnedItems };
        });
      },
      togglePin: (item) => {
        if (item.id.length === 0) return;
        set((state) => {
          if (hasPinnedItem(state.pinnedItems, item)) {
            return {
              pinnedItems: state.pinnedItems.filter(
                (candidate) => candidate.kind !== item.kind || candidate.id !== item.id,
              ),
            };
          }

          return {
            pinnedItems: [item, ...state.pinnedItems],
          };
        });
      },
      reorder: (item, nextIndex) => {
        if (item.id.length === 0) return;
        set((state) => {
          const currentIndex = state.pinnedItems.findIndex(
            (candidate) => candidate.kind === item.kind && candidate.id === item.id,
          );
          if (currentIndex < 0) {
            return state;
          }

          const clampedIndex = Math.max(0, Math.min(nextIndex, state.pinnedItems.length - 1));
          if (clampedIndex === currentIndex) {
            return state;
          }

          const nextPinnedItems = [...state.pinnedItems];
          const [movedItem] = nextPinnedItems.splice(currentIndex, 1);
          if (!movedItem) {
            return state;
          }
          nextPinnedItems.splice(clampedIndex, 0, movedItem);
          return { pinnedItems: nextPinnedItems };
        });
      },
      prune: (allowList) => {
        set((state) => {
          const allowSets = new Map<PinnedItemKind, Set<string>>();
          for (const [kind, ids] of Object.entries(allowList) as Array<
            [PinnedItemKind, readonly string[] | undefined]
          >) {
            if (!ids) continue;
            allowSets.set(kind, new Set(ids));
          }

          if (allowSets.size === 0) {
            return state;
          }

          const nextPinnedItems = state.pinnedItems.filter((item) => {
            const allowedIds = allowSets.get(item.kind);
            if (!allowedIds) {
              return true;
            }
            return allowedIds.has(item.id);
          });

          return samePinnedItems(nextPinnedItems, state.pinnedItems)
            ? state
            : { pinnedItems: nextPinnedItems };
        });
      },
    }),
    {
      name: PINNED_ITEMS_STORAGE_KEY,
      storage: createJSONStorage(() => createAliasedStateStorage(localStorage)),
      partialize: (state) => ({
        pinnedItems: normalizePinnedItems(state.pinnedItems),
      }),
      merge: (persistedState, currentState) => {
        const decoded = decodePersistedStateOrNull(PersistedPinnedItemsStateSchema, persistedState);
        const pinnedItems = decoded
          ? normalizePinnedItems(decoded.pinnedItems)
          : readLegacyPinnedThreadItems();

        return {
          ...currentState,
          pinnedItems,
        };
      },
    },
  ),
);
